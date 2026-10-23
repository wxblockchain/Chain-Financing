/* ==========================================================================
   shell.js — 借贷平台原型公共运行时（本平台唯一来源）
   面客端与运营端共用：i18n、状态、hash 路由、导航与面包屑渲染、顶栏/侧栏工具区、
   官网与控制台两种外壳骨架、Toast、Modal / Drawer 宿主、演示工具。

   模块只提供自己的页面、文案、演示数据与状态，然后调用：
       CF.define({ ... });  CF.boot();
   模块不得重建导航、路由或外壳骨架。

   模块接口
     id        模块标识
     dict      { en:{}, zh:{} } 文案，合并进公共字典
     content(pageId)  返回该页内容区 HTML
     onAct(act, value, event)  模块自己的点击动作；返回 true 表示已处理
   ========================================================================== */
(function (CF) {
  "use strict";

  /* ---------------------------------------------------------------- 状态 */
  /* 面客端身份在同一标签页内跨刷新、跨模块页面沿用：各模块是独立 HTML，不沿用就会在跳页后回到访客。 */
  var ROLE_KEY = 'hc.portal-role', PORTAL_ROLES = ['guest', 'signed', 'asset', 'fund'];
  function savedRole() { try { var v = sessionStorage.getItem(ROLE_KEY); return PORTAL_ROLES.indexOf(v) >= 0 ? v : 'guest'; } catch (e) { return 'guest'; } }
  var S = {
    lang: "en",              // 默认英文；不读浏览器语言（国际化基线 3.1）
    tz: null,                // 按浏览器推断，推断失败兜底 UTC
    end: "asset",            // asset = 面客端 · admin = 运营端
    role: savedRole(),       // guest / signed / asset / fund / ops
    party: { asset: "entity-demo-a", fund: "fund-a" }, // 演示身份对应的资产方企业 / 资金机构，仅演示视角使用
    page: null,
    st: "default",           // 演示状态：default/loading/empty/noresult/error/denied
    sort: "at",              // 当前排序键；列表默认按时间倒序
    sortDir: "desc",
    shown: 20,               // 滚动加载已显示条数（两个广场）
    toTop: false,            // 重排 / 重置筛选后把视口带回列表顶部
    pageNo: 1,               // 分页页码（我的控制台）
    menu: null,              // 当前展开的下拉
    layer: null,             // { type:'drawer'|'modal', key:... }
    demo: false
  };
  CF.S = S;

  // 独立原型沿用登录样例的钱包；登录宿主覆盖此函数，返回当前登录账号的地址。
  // 仅展示，不读取钱包插件，不建立会话；宿主返回空地址时不可回退为演示地址。
  CF.portalAccount = function () {
    return { walletAddress: "0x1111111111111111111111111111111111111111" };
  };

  /* 面客消息快照属于壳层。未接入数据的模块为空池，不编造未读数。 */
  var N = CF.notifications = { rows: [], panelState: "default", preview: null };
  N.allowed = function () { return S.end === "asset" && (S.role === "asset" || S.role === "fund"); };
  N.visible = function () {
    return N.allowed() ? N.rows.filter(function (r) {
      return r.platform === "lending" && r.end === "asset" && r.owner === S.role;
    }).sort(function (a,b) {
      /* 按消息创建时间从新到旧；at 是业务发生时间，只用于展示。 */
      var x = b.created || b.at, y = a.created || a.at;
      return x.localeCompare(y) || b.id.localeCompare(a.id);
    }) : [];
  };
  N.expired = function (r) { return !!r.expires && Date.parse(r.expires) <= Date.now(); };
  N.unread = function () { return N.visible().filter(function (r) { return !r.read && !N.expired(r); }).length; };
  N.markRead = function (ids) {
    N.visible().forEach(function (r) { if (ids.indexOf(r.id) !== -1) r.read = true; });
    if (N.onRead) N.onRead(ids);
  };
  CF.enterPage = function (target, params) {
    var id = String(target).replace(/^lending:/, "");
    if (id === "P-F51") id = "P-F-AM-01"; // 兼容旧入口，不再登记或展示首页。
    if (!/^lending:/.test(target) || !CF.PAGES[id]) {
      (S.unknownTargets || (S.unknownTargets = [])).push(target);
      location.hash = "#/"; return;
    }
    location.hash = "#" + CF.ENTRY[id] + (params ? "?" + new URLSearchParams(params).toString() : "");
  };
  CF.authSurface = function () {
    if (N.allowed()) return null;
    /* 登录未绑定角色已经登录，不再提示登录，按不适用当前身份处理。 */
    if (S.role === "signed") {
      return CF.empty(L("This page is not available for your current role", "该页面不适用于当前身份"),
        L("You can continue exploring public information.", "你可以继续浏览公开信息。"),
        '<button class="btn primary" data-act="go" data-v="/assets">' + L("Back to assets", "返回资产广场") + '</button>');
    }
    return CF.empty(S.role === "limited" ? L("Complete your account setup", "请先完成账户必办事项") : L("Sign in to view your messages", "登录后查看消息"),
      S.role === "limited" ? L("Complete the required steps for your account to continue.", "完成账户必办事项后即可继续。") : L("After signing in, you will return to this page.", "登录后将返回当前页面。"),
      '<button class="btn primary" data-act="' + (S.role === "limited" ? "prerequisite" : "signin") + '">' +
      (S.role === "limited" ? L("Continue setup", "继续完善") : L("Connect wallet", "连接钱包")) + '</button>');
  };

  var M = null;              // 当前模块
  var DICT = { en: {}, zh: {} };

  /* ------------------------------------------------------------ 小工具 */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function L(en, zh) { return S.lang === "en" ? en : zh; }
  function t(key) { var d = DICT[S.lang] || {}; return d[key] != null ? d[key] : key; }
  function $(id) { return document.getElementById(id); }
  CF.esc = esc; CF.L = L; CF.t = t;

  /* 表单呈现：只生成字段标签 / 只读标识，不参与 required 校验、值、权限或提交。 */
  CF.readOnlyBadge = function () {
    return '<span class="field-readonly-label">' + L('Read only', '只读') + '</span>';
  };
  CF.fieldLabel = function (text, required, readonly) {
    text = String(text);
    if (required === undefined) required = /\*\s*$/.test(text);
    return (required ? '<span class="required-mark" aria-hidden="true">*</span><span class="sr-only">' + L('Required: ', '必填：') + '</span>' : '') +
      esc(text.replace(/\s*\*\s*$/, '')) + (readonly ? CF.readOnlyBadge() : '');
  };

  function resolveTz() {
    try {
      var z = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return z || "UTC";
    } catch (e) { return "UTC"; }
  }

  var MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  /* 时间一律带时区标注（国际化基线 4）。 */
  CF.fmtDate = function (iso) {
    var d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    var y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
    return S.lang === "en" ? (MO[m] + " " + day + ", " + y) : (y + " 年 " + (m + 1) + " 月 " + day + " 日");
  };
  /* 消息列表与预览：24 小时内用相对时间，更早的用完整时刻；详情页始终用完整时刻。两端消息中心共用。 */
  CF.relTime = function (iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return CF.fmtTime(iso);
    var m = Math.max(0, Math.floor((Date.now() - t) / 60000)), h = Math.floor(m / 60);
    if (m < 1) return L("Just now", "刚刚");
    if (m < 60) return L(m + (m === 1 ? " minute ago" : " minutes ago"), m + " 分钟前");
    if (m < 1440) return L(h + (h === 1 ? " hour ago" : " hours ago"), h + " 小时前");
    return CF.fmtTime(iso);
  };
  /* 时刻按当前展示时区换算并标注该时区；业务日期沿既有口径，不随展示时区改写。 */
  CF.fmtTime = function (iso) {
    var d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    var tz = S.tz || "UTC", parts = {};
    var options = { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false };
    var formatter;
    try {
      formatter = new Intl.DateTimeFormat("en-US", options);
    } catch (e) {
      tz = options.timeZone = "UTC";
      formatter = new Intl.DateTimeFormat("en-US", options);
    }
    formatter.formatToParts(d).forEach(function (part) { parts[part.type] = part.value; });
    var date = S.lang === "en" ? MO[Number(parts.month) - 1] + " " + Number(parts.day) + ", " + parts.year
      : parts.year + " 年 " + Number(parts.month) + " 月 " + Number(parts.day) + " 日";
    return date + (S.lang === "en" ? ", " : " ") + (parts.hour === "24" ? "00" : parts.hour) + ":" + parts.minute + " (" + tz + ")";
  };
  /* 紧凑时刻：yyyy-MM-dd HH:mm，按当前展示时区换算，不随语言改变格式；时区由调用方在表头或值后标注。 */
  CF.fmtStamp = function (iso) {
    var d = new Date(iso);
    if (isNaN(d)) return String(iso == null ? "" : iso);
    try {
      var p = {};
      new Intl.DateTimeFormat("en-CA", { timeZone: S.tz || "UTC", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
      return p.year + "-" + p.month + "-" + p.day + " " + (p.hour === "24" ? "00" : p.hour) + ":" + p.minute;
    } catch (e) { return d.toISOString().slice(0, 16).replace("T", " "); }
  };
  /* 金额：三位分隔 + 币种前置，不做汇率换算（国际化基线 5）。 */
  CF.fmtAmt = function (n, ccy) {
    var s = Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (ccy ? ccy + " " : "") + s;
  };

  /* ------------------------------------------------------------ 图标 */
  var ICON = {
    globe: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/><path d="M1.8 8h12.4M8 1.8c1.7 1.8 2.6 3.9 2.6 6.2S9.7 12.4 8 14.2C6.3 12.4 5.4 10.3 5.4 8S6.3 3.6 8 1.8z"/></svg>',
    bell: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M4 6.6a4 4 0 118 0c0 3 .9 4.2 1.4 4.7H2.6C3.1 10.8 4 9.6 4 6.6z"/><path d="M6.6 13.6a1.6 1.6 0 002.8 0"/></svg>',
    caret: '<svg viewBox="0 0 10 10" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 4l3 3 3-3"/></svg>',
    close: '<svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8"/></svg>',
    funnel: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2.6 4h10.8M4.6 8h6.8M6.6 12h2.8"/></svg>',
    search: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7.1" cy="7.1" r="4.3"/><path d="M10.4 10.4 14 14"/></svg>',
    chain: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.4 3.7 8.2 8 10.8l4.3-2.6L8 1.4Zm0 10.8L3.7 9.6 8 14.6l4.3-5L8 12.2Z"/></svg>',
    expand: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 2H2v4M10 14h4v-4M14 6V2h-4M2 10v4h4"/></svg>',
    pool: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 2.2 14 5 8 7.8 2 5l6-2.8Z"/><path d="M2 8.4 8 11.2l6-2.8M2 11.6 8 14.4l6-2.8"/></svg>',
    copy: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5.4" y="5.4" width="8.2" height="8.2" rx="2"/><path d="M10.6 5.4V4.4a2 2 0 0 0-2-2H4.4a2 2 0 0 0-2 2v4.2a2 2 0 0 0 2 2h1"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 3 18 18M10.6 5.1 12 5c6.4 0 10 7 10 7a20 20 0 0 1-3.3 4.1M6.1 6.1A21 21 0 0 0 2 12s3.6 7 10 7a11 11 0 0 0 5.9-1.8M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    external: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M9.2 2.6H13.4V6.8M13.4 2.6 7.6 8.4M11.2 9.6v3.2a1 1 0 0 1-1 1H3.2a1 1 0 0 1-1-1V5.8a1 1 0 0 1 1-1h3.2"/></svg>'
  };
  CF.ICON = ICON;
  // WS-432: the original Harbour Credit mark is the customer homepage entry.
  ICON.homeBrand = '<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="8" fill="currentColor"/><path d="M6.5 17.5c2.4 0 2.4-2 4.8-2s2.4 2 4.8 2 2.4-2 4.8-2M6.5 12c2.4 0 2.4-2 4.8-2s2.4 2 4.8 2 2.4-2 4.8-2" fill="none" style="stroke:var(--on-accent)" stroke-width="2" stroke-linecap="round"/></svg>';

  /* ------------------------------------------------------------ 公共片段 */
  CF.tag = function (kind, text) {
    return '<span class="tag ' + kind + '"><span class="dot"></span>' + esc(text) + "</span>";
  };
  /* 资产标识：代币、币种与所属链在文字前统一带标记，两个广场共用一套。 */
  var CCY_GLYPH = {USD: '$', EUR: '\u20AC', JPY: '\u00A5', CNY: '\u00A5', USDT: '\u20AE', USDC: '$'};
  CF.icoChip = function (label, opts) {
    opts = opts || {};
    var glyph = opts.glyph || CCY_GLYPH[label] || esc(String(label).slice(0, 2).toUpperCase());
    return '<span class="ico-chip' + (opts.small ? ' sm' : '') + '"' + (opts.iconOnly ? ' title="' + esc(label) + '"' : '') + '>' +
      '<span class="ico"' + (opts.hue ? ' data-hue="' + esc(String(opts.hue)) + '"' : '') + ' aria-hidden="true">' + glyph + '</span>' +
      (opts.iconOnly ? '<span class="sr-only">' + esc(label) + '</span>' : '<span>' + esc(label) + '</span>') + '</span>';
  };
  CF.filterSelect = function (id, label, options, current, attrs) {
    return '<span class="fb">' + ICON.funnel +
      '<select class="inp" id="' + esc(id) + '"' + (attrs || '') + ' aria-label="' + esc(label) + '"' +
      (current ? ' data-on="1"' : '') + '>' +
      options.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (o[0] === current ? ' selected' : '') + '>' +
          esc(o[0] === '' ? label + '：' + o[1] : o[1]) + '</option>';
      }).join('') + '</select></span>';
  };
  /* Operations use a visible label/value pair; IDs, options and native select events stay local. */
  CF.opsFilterSelect = function (id, label, options, current) {
    return '<div class="ops-filter-select"' + (current && current !== 'all' ? ' data-on="1"' : '') + '>' +
      '<label for="' + esc(id) + '">' + esc(label) + '</label>' +
      '<select class="inp" id="' + esc(id) + '">' + options.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (o[0] === current ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select></div>';
  };
  document.addEventListener('change', function (event) {
    var select = event.target.closest('.ops-filter-select>select');
    if (select) select.parentElement.dataset.on = select.value && select.value !== 'all' ? '1' : '0';
  });
  /* 多选筛选：未选时药丸只显示字段名；选中后显示已选数量，面板里勾选，全选或清空回到不限。 */
  CF.filterMenu = function (id, label, options, selected) {
    selected = selected || [];
    var open = S.menu === 'filter:' + id, n = selected.length;
    var panel = open ? '<div class="fb-panel" role="group" aria-label="' + esc(label) + '">' +
      options.map(function (o) {
        return '<label class="fb-opt"><input type="checkbox" id="' + esc(id + '-' + o[0]) + '" data-filter="' + esc(id) +
          '" value="' + esc(o[0]) + '"' + (selected.indexOf(o[0]) >= 0 ? ' checked' : '') + '><span>' + esc(o[1]) + '</span></label>';
      }).join('') + '</div>' : '';
    return '<span class="fb fb-menu">' + ICON.funnel +
      '<button type="button" class="inp fb-btn" id="' + esc(id) + '" data-act="menu" data-v="filter:' + esc(id) + '"' +
      ' aria-haspopup="true" aria-expanded="' + open + '"' + (n ? ' data-on="1"' : '') + '>' +
      esc(n ? label + ' · ' + n : label) + '</button>' + panel + '</span>';
  };
  CF.filterSearch = function (id, placeholder, value, fullLabel, className) {
    return '<span class="fb-q' + (className ? ' ' + esc(className) : '') + '">' + ICON.search +
      '<input class="inp" id="' + esc(id) + '" type="search" value="' + esc(value || '') +
      '" placeholder="' + esc(placeholder) + '" title="' + esc(fullLabel || placeholder) +
      '" aria-label="' + esc(fullLabel || placeholder) + '"></span>';
  };
  // Compact filters can wrap near either viewport edge. Keep the existing
  // checkbox menu inside the viewport without changing its owner or events.
  var filterMenuFrame = 0;
  function fitFilterMenus() {
    cancelAnimationFrame(filterMenuFrame);
    filterMenuFrame = requestAnimationFrame(function () {
      document.querySelectorAll('.filterbar .fb-panel').forEach(function (panel) {
        panel.style.maxWidth = Math.max(0, window.innerWidth - 32) + 'px';
        panel.style.marginLeft = '0px';
        var rect = panel.getBoundingClientRect(), shift = Math.min(0, window.innerWidth - 16 - rect.right);
        if (rect.left + shift < 16) shift = 16 - rect.left;
        panel.style.marginLeft = shift + 'px';
      });
    });
  }
  window.addEventListener('resize', fitFilterMenus);
  if (document.fonts) document.fonts.ready.then(fitFilterMenus);
  /* 环形占比图：数值由旁边的表格给出，图形只负责比例。 */
  CF.donut = function (parts, center, caption) {
    var total = parts.reduce(function (n, p) { return n + Math.max(0, p.value); }, 0);
    var r = 54, c = 2 * Math.PI * r, at = 0;
    var arcs = total ? parts.filter(function (p) { return p.value > 0; }).map(function (p) {
      var len = c * (p.value / total), dash = '<circle class="seg" data-tone="' + esc(p.tone) + '" cx="70" cy="70" r="' + r +
        '" stroke-dasharray="' + len.toFixed(2) + ' ' + (c - len).toFixed(2) + '" stroke-dashoffset="' + (-at).toFixed(2) + '"></circle>';
      at += len; return dash;
    }).join('') : '';
    return '<svg class="donut" viewBox="0 0 140 140" role="img" aria-label="' + esc(caption) + '">' +
      '<g transform="rotate(-90 70 70)"><circle class="track" cx="70" cy="70" r="' + r + '"></circle>' + arcs + '</g>' +
      '<text class="donut-center" x="70" y="70" text-anchor="middle">' + esc(center.value) + '</text>' +
      '<text class="donut-cap" x="70" y="88" text-anchor="middle">' + esc(center.label) + '</text></svg>';
  };
  /* 复制、放大这类反复出现的功能统一用图标按钮，可访问名仍是完整说明。 */
  CF.copyBtn = function (act, value, label, extra) {
    label = label || L('Copy', '复制');
    return '<button class="btn icon bare" type="button" data-act="' + esc(act) + '" data-v="' + esc(value) + '"' +
      (extra || '') + ' title="' + esc(label) + '" aria-label="' + esc(label) + '">' + ICON.copy + '</button>';
  };
  CF.linkOut = function (href, label) {
    return '<a class="btn icon bare" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer" title="' +
      esc(label) + '" aria-label="' + esc(label) + '">' + ICON.external + '</a>';
  };
  CF.note = function (kind, html) {
    var role = kind === "red" ? ' role="alert"' : "";
    return '<div class="note ' + (kind === "red" ? "red" : kind) + '"' + role + ">" + html + "</div>";
  };
  CF.empty = function (title, desc, actHtml) {
    return '<div class="tbl-empty"><b>' + esc(title) + "</b>" + esc(desc) + (actHtml || "") + "</div>";
  };
  CF.skelTable = function (rows) {
    var out = "";
    for (var i = 0; i < (rows || 5); i++) {
      out += '<div class="skel-row" aria-hidden="true"><span class="skel"></span><span class="skel"></span>' +
             '<span class="skel"></span><span class="skel"></span></div>';
    }
    return '<div role="status" aria-live="polite"><span class="sr-only">' +
           L("Loading", "加载中") + "</span>" + out + "</div>";
  };

  CF.PAGE_SIZE = 20;

  /* 滚动加载的列表尾部：一个可聚焦的「加载更多」既是键盘可达的控件，
     也是滚动哨兵——滚到它就自动加载下一批，不必点。 */
  CF.moreFoot = function (total) {
    if (total <= S.shown) {
      return '<div class="loadmore done">' +
        L("End of list", "已到末尾") + " \u00b7 " +
        L(total + (total === 1 ? " item" : " items"), "共 " + total + " 条") + "</div>";
    }
    return '<div class="loadmore"><button class="btn" type="button" data-act="more">' +
      L("Load more", "加载更多") + "</button>" +
      '<span class="tiny" role="status">' +
      L("Showing " + S.shown + " of " + total, "已显示 " + S.shown + " / " + total + " 条") +
      "</span></div>";
  };

  /* 分页尾部：给需要按页翻的列表用。 */
  CF.pagerFoot = function (total, size) {
    var pages = Math.max(1, Math.ceil(total / size));
    var btns = "";
    for (var i = 1; i <= pages; i++) {
      btns += '<button class="pgbtn" type="button" data-act="pageno" data-v="' + i + '"' +
        (i === S.pageNo ? ' aria-current="true"' : "") + ">" + i + "</button>";
    }
    return '<div class="pager"><span class="total">' +
      L(total + (total === 1 ? " item" : " items"), "共 " + total + " 条") + "</span>" +
      '<button class="pgbtn" type="button" data-act="pageno" data-v="' + (S.pageNo - 1) + '"' +
        (S.pageNo <= 1 ? " disabled" : "") + ">&larr;</button>" + btns +
      '<button class="pgbtn" type="button" data-act="pageno" data-v="' + (S.pageNo + 1) + '"' +
        (S.pageNo >= pages ? " disabled" : "") + ">&rarr;</button></div>";
  };

  /* 页面级状态表面：模块把自己的默认内容传进来，公共层负责其余状态。 */
  CF.surface = function (opts) {
    if (S.st === "loading") return CF.skelTable(opts.skelRows);
    if (S.st === "denied") {
      return CF.empty(
        L("You do not have access to this view", "你没有查看该视图的权限"),
        opts.deniedDesc || L("This view is limited to the entity that owns the record. Public fields stay visible on the marketplace.",
          "该视图仅对记录所属主体开放。广场上的公开字段不受影响。"),
        '<button class="btn" type="button" data-act="go" data-v="' + esc(opts.backTo || "/") + '">' +
        (opts.backLabel || L("Back to the marketplace", "返回广场")) + "</button>");
    }
    if (S.st === "error") {
      return CF.empty(
        opts.errorTitle || L("Could not load this list", "列表加载失败"),
        L("The request did not complete. Retry, or come back in a moment.", "请求没有完成。可以重试，或稍后再来。"),
        '<button class="btn primary" type="button" data-act="retry">' + L("Retry", "重试") + "</button>");
    }
    if (S.st === "empty") return CF.empty(opts.emptyTitle, opts.emptyDesc, opts.emptyAct || "");
    if (S.st === "noresult") {
      return CF.empty(
        L("No results match these filters", "没有符合筛选条件的结果"),
        L("Widen the range or clear one of the filters.", "放宽范围，或清掉其中一个筛选条件。"),
        '<button class="btn" type="button" data-act="clearfilter">' + L("Clear filters", "清空筛选") + "</button>");
    }
    return null;
  };

  /* ------------------------------------------------------------ 导航渲染 */
  function resetList() { S.shown = CF.PAGE_SIZE; S.pageNo = 1; S.toTop = true; }
  CF.resetList = resetList;

  /* 未登录访客与登录未绑定角色看不到需要登录的导航入口；页面本身仍可由深链或评审目录打开，展示其引导。 */
  function navItems() {
    return (CF.NAV[S.end] || []).filter(function (id) {
      if (!CF.PAGES[id]) return false;
      if (CF.PAGES[id].auth && S.end === "asset" && (S.role === "guest" || S.role === "signed")) return false;
      return !M || !M.allowNav || M.allowNav(id);
    });
  }

  function renderPortalNav() {
    if (CF.PAGES['P-HOME-01']) {
      var brand = document.querySelector('.portal-head .brand');
      if (brand) {
        brand.href = '#/home';
        brand.setAttribute('aria-label', 'Harbour Credit · ' + L('Home', '首页'));
        var mark = brand.querySelector('.brand-mark');
        if (mark) { mark.innerHTML = ICON.homeBrand; mark.classList.add('brand-home'); }
        var sub = brand.querySelector('.brand-sub');
        if (sub) sub.textContent = '港湾';
      }
    }
    var html = navItems().map(function (id) {
      var p = CF.PAGES[id];
      var cur = id === S.page ? ' aria-current="page"' : "";
      return '<a class="nav-item" href="#' + esc(CF.ENTRY[id]) + '"' + cur + ">" + esc(t(p.navKey)) + "</a>";
    }).join("");
    $("nav").innerHTML = html;
  }

  function renderAdminNav() {
    if (CF.AdminMenu) {
      $("anav").innerHTML = CF.AdminMenu.render(M);
      $("anav").setAttribute("aria-label", L("Main navigation", "主导航"));
      document.querySelectorAll('.sidebar .brand-sub').forEach(function(el){el.textContent=L('Operations','运营管理');});
      return;
    }
    var html = '<div class="nav-group">' + esc(t("navGroupOps")) + "</div>";
    html += navItems().map(function (id) {
      var p = CF.PAGES[id];
      var cur = id === S.page ? ' aria-current="page"' : "";
      return '<a class="nav-item" href="#' + esc(CF.ENTRY[id]) + '"' + cur + '><span class="nav-ico" aria-hidden="true">' +
             (p.ico || "▤") + "</span>" + esc(t(p.navKey)) + "</a>";
    }).join("");
    $("anav").innerHTML = html;
  }

  /* ------------------------------------------------------------ 工具区 */
  function langDd() {
    var open = S.menu === "lang";
    var list = open
      ? '<div class="dd-list" role="menu">' +
        '<div class="dd-head">' + L("Language", "语言") + "</div>" +
        '<button type="button" role="menuitem" data-act="lang" data-v="en" aria-current="' + (S.lang === "en") + '">English</button>' +
        '<button type="button" role="menuitem" data-act="lang" data-v="zh" aria-current="' + (S.lang === "zh") + '">简体中文</button>' +
        "</div>"
      : "";
    return '<div class="dd"><button class="dd-btn" type="button" data-act="menu" data-v="lang" ' +
      'aria-haspopup="menu" aria-expanded="' + open + '">' + ICON.globe +
      "<span>" + (S.lang === "en" ? "EN" : "中文") + "</span>" + ICON.caret + "</button>" + list + "</div>";
  }

  function bell(unread) {
    if (S.end === "admin") return '<button class="bell" type="button" data-act="toast" data-v="notify" aria-label="' + L("Notifications", "消息中心") + '">' + ICON.bell + (unread ? '<span class="badge">' + unread + '</span>' : '') + '</button>';
    // 尚未装载消息模块的独立原型保留其旧入口协议，避免抢走该模块自有的演示动作。
    if (!N.preview) return '<button class="bell" type="button" data-act="toast" data-v="notify" aria-label="' + L("Notifications", "消息中心") + '">' + ICON.bell + '<span class="badge">3</span></button>';
    var count = unread > 99 ? "99+" : String(unread), open = S.menu === "notifications";
    var panel = "";
    if (open) {
      var body = N.panelState === "loading" ? CF.skelTable(3) : N.panelState === "error"
        ? CF.empty(L("Failed to load. Please try again", "加载失败，请重试"), "", '<button class="btn" data-act="notify-retry">' + L("Retry", "重试") + '</button>')
        : N.visible().slice(0,10).map(function (r) {
          return '<a class="nc-preview" href="#/notification?id=' + encodeURIComponent(r.id) + '">' +
            (N.preview ? N.preview(r) : esc(L("Notification", "通知"))) + '</a>';
        }).join("");
      panel = '<section id="notification-panel" class="nc-panel" aria-label="' + L("Recent messages", "最近消息") + '"><div class="nc-panel-head"><b>' + L("Notifications", "消息中心") + '</b></div><div class="nc-preview-list">' +
        (body || CF.empty(L("You have no messages yet", "还没有任何消息"), "", "")) +
        '</div><a class="nc-panel-foot" href="#/notifications" data-act="go" data-v="/notifications">' + L("View all", "查看全部") + '</a></section>';
    }
    return '<div class="dd nc-bell-wrap"><button class="bell" type="button" data-act="menu" data-v="notifications" aria-controls="notification-panel" aria-expanded="' + open + '" aria-label="' +
      L("Notifications", "消息中心") + (unread ? ' · ' + count + L(" unread", " 条未读") : '') + '">' + ICON.bell +
      (unread ? '<span class="badge" aria-hidden="true">' + count + '</span>' : '') + '</button>' + panel + '</div>';
  }

  /* 已绑定角色显示当前角色与账户事项；登录未绑定角色只有登录地址标识与退出。 */
  function accountDd() {
    var unbound = S.role === "signed";
    var who = S.role === "fund" ? L("Funder", "资金方") : L("Asset holder", "资产方");
    var identity = CF.portalAccount() || {};
    var address = typeof identity.walletAddress === "string" ? identity.walletAddress.trim() : "";
    var label = address ? (address.length > 10 ? address.slice(0, 6) + "…" + address.slice(-4) : address) : L("My account", "我的账户");
    var open = S.menu === "acct";
    var items = unbound ? "" :
      '<div class="portal-account-role">' + esc(who) + "</div>" +
      '<button type="button" role="menuitem" data-act="toast" data-v="acct">' + L("User information", "用户信息") + "</button>" +
      '<button type="button" role="menuitem" data-act="toast" data-v="inst">' + (S.role === "fund" ? L("Institution information", "机构信息") : L("Company information", "企业信息")) + "</button>" +
      '<button type="button" role="menuitem" data-act="toast" data-v="entacct">' + (S.role === "fund" ? L("Institution accounts", "机构账户") : L("Company accounts", "企业账户")) + "</button>" +
      '<button type="button" role="menuitem" data-act="' + (N.preview ? "go" : "toast") + '" data-v="' + (N.preview ? "/notifications" : "notify") + '">' + L("Messages", "消息中心") + "</button>" +
      '<div class="dd-sep"></div>';
    var list = open
      ? '<div class="dd-list" id="portal-account-menu" role="menu" aria-label="' + L("Account menu", "账户菜单") + '">' +
        items +
        '<button type="button" role="menuitem" data-act="signout">' + L("Sign out", "退出登录") + "</button>" +
        "</div>"
      : "";
    return '<div class="dd portal-account"><button class="dd-btn" type="button" data-act="menu" data-v="acct" ' +
      'aria-haspopup="menu" aria-controls="portal-account-menu" aria-expanded="' + open + '" title="' + esc(address || label) + '" aria-label="' +
      esc(L("Account menu", "账户菜单") + (address ? " · " + address : "")) + '"><span' + (address ? ' class="portal-account-address"' : '') + '>' +
      esc(label) + "</span>" + ICON.caret + "</button>" + (!open && address ? '<span class="portal-account-hint" role="tooltip">' + esc(address) + '</span>' : '') + list + "</div>";
  }

  function renderPortalTools() {
    var html = (N.allowed() ? bell(N.unread()) : "") + langDd();
    if (S.role === "guest") {
      html += '<button class="btn primary sm" type="button" data-act="signin">' + L("Connect wallet", "连接钱包") + "</button>";
    } else {
      html += accountDd();
    }
    $("tools").innerHTML = html;
  }

  function renderAdminTools() {
    // Account information lives in the top account menu and account settings.
    if ($("asidefoot")) { $("asidefoot").innerHTML = ''; $("asidefoot").hidden = true; }
    if (CF.AdminMenu) {
      $("atools").innerHTML = (CF.opsNotifications ? CF.opsNotifications.bell() : "") + langDd() + CF.AdminMenu.tools(M);
      return;
    }
    if (M && M.adminTools) {
      $("atools").innerHTML = (M.adminNotifications ? M.adminNotifications() : '') + langDd() + M.adminTools();
      return;
    }
    var context = M && M.adminContext ? M.adminContext() : null;
    $("atools").innerHTML = langDd() + (context && context.hideNotifications ? "" : bell(2)) + (CF.AdminMenu ? CF.AdminMenu.tools() : '');
  }

  CF.refreshAdminTools = renderAdminTools;

  /* ------------------------------------------------------------ 面包屑 */
  function renderCrumb() {
    var p = CF.PAGES[S.page] || {};
    // 两端只展示真实父级；默认落地页不代表其他一级入口的父页面。
    var chain = [S.page], seen = {};
    seen[S.page] = true;
    var parent = p.parent;
    while (parent && CF.PAGES[parent] && CF.PAGES[parent].end === S.end && !seen[parent]) {
      chain.unshift(parent); seen[parent] = true; parent = CF.PAGES[parent].parent;
    }
    var crumb = $(S.end === "asset" ? "crumb" : "acrumb");
    var visible = p.layout !== "site" && chain.length > 1;
    if (S.end === "asset") $("subwrap").hidden = !visible;
    if (!visible) {
      if (crumb) {
        if (S.end === "admin") crumb.remove();
        else crumb.innerHTML = "";
      }
      return;
    }
    function label(id) {
      var page = CF.PAGES[id];
      return t(page.crumbKey || page.navKey);
    }
    function href(id) {
      var route = M && M.breadcrumbRoute ? M.breadcrumbRoute(id) : null;
      return "#" + (route || CF.ENTRY[id]);
    }
    var items = chain.map(function (id, i) {
      var current = i === chain.length - 1;
      return '<li class="crumb-item' + (current ? ' is-current' : '') + '">' +
        (i ? '<span class="crumb-sep" aria-hidden="true">›</span>' : '') +
        (current ? '<span class="crumb-cur" aria-current="page">' + esc(label(id)) + '</span>' :
          '<a class="crumb-link" href="' + esc(href(id)) + '">' + esc(label(id)) + '</a>') + '</li>';
    }).join('');
    if (S.end === "admin") {
      // 内容重绘后挂在页面内；兼容仍将挂载点放在顶栏的旧模块模板。
      if (!crumb) { crumb = document.createElement("div"); crumb.id = "acrumb"; }
      crumb.className = "crumbbar-in";
      $("acontent").prepend(crumb);
    }
    crumb.innerHTML =
      '<nav class="breadcrumb" aria-label="' + L("Breadcrumb", "面包屑导航") + '">' +
      '<ol class="crumb-list">' + items + '</ol></nav>';
  }

  /* ------------------------------------------------------------ 浮层 */
  CF.toast = function (msg) {
    var wrap = $("toasts");
    var el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2600);
  };
  var layerOpener = null;
  CF.openLayer = function (type, key, data, under) {
    var active = document.activeElement;
    layerOpener = active && {id:active.id,act:active.getAttribute("data-act"),value:active.getAttribute("data-v")};
    S.layer = { type: type, key: key, data: data, under: under }; render(); };
  CF.closeLayer = function () {
    S.layer = null; render();
    var el = layerOpener && (layerOpener.id ? $(layerOpener.id) : Array.from(document.querySelectorAll("[data-act]")).find(function(node) {
      return node.getAttribute("data-act") === layerOpener.act && node.getAttribute("data-v") === layerOpener.value;
    }));
    if(el) el.focus({preventScroll:true});
    layerOpener = null;
  };

  function renderLayer() {
    var host = $("layers");
    ["app", "portal", "focus"].forEach(function(id) { if ($(id)) $(id).inert = !!S.layer; });
    ["demoBtn", "demoPanel"].forEach(function(id) { if ($(id)) $(id).inert = !!S.layer && !(M && M.reviewToolsInLayer); });
    if (!S.layer) { host.innerHTML = ""; return; }
    function markup(layer) {
    var body = M && M.layers && M.layers[layer.key] ? M.layers[layer.key](layer.data) : null;
    if (!body) return "";
    if (layer.type === "drawer") {
      return '<div class="scrim" data-act="closelayer"></div>' +
        '<aside class="drawer" role="dialog" aria-modal="true" aria-label="' + esc(body.title) + '">' +
        '<div class="drawer-h"><b>' + esc(body.title) + '</b>' +
        '<button class="btn ghost sm" type="button" data-act="closelayer" style="margin-left:auto" aria-label="' +
        L("Close", "关闭") + '">' + ICON.close + "</button></div>" +
        '<div class="drawer-b">' + body.html + "</div>" +
        (body.foot ? '<div class="drawer-f">' + body.foot + "</div>" : "") + "</aside>";
    } else {
      return '<div class="modal-mask" data-act="closelayer">' +
        '<div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(body.title) + '" data-stop="1">' +
        /* body.dismiss 为真时标题栏带关闭按钮（国际产品对话框的常规形态）；不传则保持原样。 */
        '<div class="modal-h' + (body.dismiss ? ' has-x' : '') + '">' + (body.dismiss ? '<span>' + esc(body.title) + '</span><button class="btn ghost sm modal-x" type="button" data-act="closelayer" aria-label="' +
          L("Close", "关闭") + '">' + ICON.close + '</button>' : esc(body.title)) + "</div>" +
        '<div class="modal-b">' + body.html + "</div>" +
        '<div class="modal-f">' + (body.foot || "") + "</div></div></div>";
    }
    }
    host.innerHTML = (S.layer.under ? '<div inert aria-hidden="true">' + markup(S.layer.under) + '</div>' : '') + markup(S.layer);
    var first = host.lastElementChild && host.lastElementChild.querySelector("button, a, input, select, textarea");
    if (first) first.focus();
  }

  /* ------------------------------------------------------------ 演示工具 */
  function seg(act, cur, opts) {
    return '<div class="seg">' + opts.map(function (o) {
      return '<button type="button" data-act="' + act + '" data-v="' + o[0] + '" aria-pressed="' +
        (cur === o[0]) + '">' + esc(o[1]) + "</button>";
    }).join("") + "</div>";
  }

  /* Shared review navigation. Page adapters own fixtures; the shell never seeds business data. */
  var REVIEW_OPEN = CF.REVIEW_OPEN = 'hc.review-open';
  var reviewPages = {}, reviewActive = null, reviewObserver = null;
  var reviewSearch = '', reviewMore = false, reviewFocus = '';
  var reviewModule = '', reviewFeedback = false, reviewPending = null, reviewScene = null;
  var reviewAutoClose = false;
  var reviewNames = {
    default: ['Default', '默认'], loading: ['Loading', '加载中'], empty: ['Empty', '空数据'],
    noresult: ['No results', '筛选无结果'], error: ['Load failed', '加载失败'], denied: ['No access', '无权限']
  };
  function reviewText(value) { return Array.isArray(value) ? L(value[0], value[1]) : value; }
  function reviewCurrent() {
    return Object.keys(reviewPages).find(function (id) {
      return id === S.page || (reviewPages[id].aliases || []).indexOf(S.page) >= 0;
    });
  }
  function reviewStates(config) {
    return (typeof config.states === 'function' ? config.states() : config.states || ['default']).map(function (state) {
      return typeof state === 'string' ? {id: state, label: reviewNames[state] || [state, state], group: 'feedback'} : state;
    });
  }
  function reviewLabel(id) {
    var c = reviewPages[id], p = CF.PAGES[id], key = p.navKey || p.crumbKey;
    return c.label || [DICT.en[key] || key || id, DICT.zh[key] || key || id];
  }
  function reviewScenarios(config) {
    return (typeof config.scenarios === 'function' ? config.scenarios() : config.scenarios || []);
  }
  function reviewListed(id) {
    var c = reviewPages[id], p = CF.PAGES[id];
    return p && p.end === S.end && (!c.visible || c.visible());
  }
  function reviewGroup(id) { return reviewPages[id].group || ['Pages', '页面']; }
  function reviewGroupKey(id) { var g = reviewGroup(id); return Array.isArray(g) ? g[0] : g; }
  function reviewModuleOptions() {
    var groups = {};
    Object.keys(reviewPages).filter(reviewListed).forEach(function (id) { groups[reviewGroupKey(id)] = reviewGroup(id); });
    if (!groups[reviewModule]) reviewModule = '';
    return '<option value="">' + L('All modules', '全部模块') + '</option>' + Object.keys(groups).map(function (key) {
      return '<option value="' + esc(key) + '"' + (reviewModule === key ? ' selected' : '') + '>' + esc(reviewText(groups[key])) + '</option>';
    }).join('');
  }
  function reviewChoice(id, item, kind) {
    var disabled = S.layer || item.available === false;
    var selected = id === reviewCurrent() && (kind === 'scene' ? reviewScene && reviewScene.page === id && reviewScene.id === item.id :
      !reviewScene && (reviewPages[id].get ? reviewPages[id].get() : S.st) === item.id);
    return '<button type="button" class="review-choice" data-review-page="' + esc(id) + '" data-review-' + kind + '="' + esc(item.id) + '"' +
      (disabled ? ' disabled' : '') + ' aria-pressed="' + !!selected + '"><strong>' + esc(reviewText(item.label)) + '</strong>' +
      '<span>' + esc(reviewText(item.description) || (item.available === false ? L('No matching record for this identity', '当前身份下没有对应记录') :
        kind === 'scene' ? L('Open an existing demonstration record', '定位现有演示记录') : L('Show this page state', '展示此页面状态'))) + '</span></button>';
  }
  function reviewSearchResults() {
    var query = reviewSearch.toLocaleLowerCase().trim(), matches = [];
    if (!query) return '';
    var words = query.split(/\s+/);
    Object.keys(reviewPages).filter(reviewListed).forEach(function (id) {
      if (reviewModule && reviewGroupKey(id) !== reviewModule) return;
      var c = reviewPages[id], label = reviewLabel(id), group = reviewGroup(id);
      var base = [id, label, group].flat().join(' ');
      var items = [{id:'default', label:label, description:group, kind:'state', available:!!reviewRoute(id,c)}]
        .concat(reviewScenarios(c).map(function (s) { return Object.assign({kind:'scene'},s); }))
        .concat(reviewStates(c).filter(function (s) { return s.id !== 'default'; }).map(function (s) { return Object.assign({kind:'state'},s); }));
      items.forEach(function (item) {
        var text = [base, item.label, item.description, item.id].flat().join(' ').toLocaleLowerCase();
        if (words.every(function (word) { return text.indexOf(word) >= 0; })) matches.push({page:id,item:item});
      });
    });
    return '<div class="review-result-count" role="status">' + L(matches.length + ' matches', '找到 ' + matches.length + ' 项') + '</div>' +
      (matches.length ? matches.slice(0,40).map(function (match) {
        return '<div class="review-result"><small>' + esc(reviewText(reviewLabel(match.page))) + '</small>' + reviewChoice(match.page,match.item,match.item.kind) + '</div>';
      }).join('') : '<p class="review-step">' + L('Try a page, business state or ID in English or Chinese.', '可尝试中英文页面名、业务状态或编号。') + '</p>') +
      (matches.length > 40 ? '<p class="review-step">' + L('Showing the first 40; narrow the search or choose a module.', '显示前 40 项，请增加关键词或选择模块。') + '</p>' : '');
  }
  function reviewRoute(id, config) {
    if (config.navigate) return true;
    try { return (typeof config.route === 'function' ? config.route() : config.route || CF.ENTRY[id]) || null; }
    catch (error) { return null; }
  }
  function reviewClear() {
    if (reviewActive && reviewPages[reviewActive]) {
      var config = reviewPages[reviewActive];
      if (config.reset) config.reset(); else S.st = 'default';
    }
    reviewActive = null;
    reviewScene = null;
  }
  function reviewSync() {
    reviewPartyGuard();
    if (reviewActive && reviewActive !== reviewCurrent()) reviewClear();
    if (reviewScene && reviewScene.route !== location.hash) reviewScene = null;
    if (reviewPending && reviewPending.page !== reviewCurrent()) reviewPending = null;
    if (reviewPending && reviewPending.page === reviewCurrent()) {
      var pending = reviewPending, config = reviewPages[pending.page]; reviewPending = null;
      if (pending.scene) {
        var scene = reviewScenarios(config).find(function (s) { return s.id === pending.scene; });
        if (scene && scene.available !== false) {
          if (scene.enter) scene.enter();
          reviewScene = {page:pending.page, id:scene.id, route:location.hash};
        }
      } else if (pending.state) {
        if (config.set) config.set(pending.state); else S.st = pending.state;
      }
      reviewActive = pending.page;
      queueMicrotask(function () { if ($('demoPanel')) $('demoPanel').scrollTop = 0; });
      if (reviewAutoClose) { S.demo = false; queueMicrotask(function () { $('demoBtn')?.focus({preventScroll:true}); }); }
    }
  }
  function reviewApply(value) {
    var id = reviewCurrent(), config = reviewPages[id];
    if (!config || !reviewStates(config).some(function (state) { return state.id === value; })) return;
    if (S.layer) return;
    var proceed = function () {
      reviewClear(); reviewPending = null;
      if (value === 'default' && config.reset) config.reset();
      reviewActive = id; S.menu = null;
      if (config.set) config.set(value); else S.st = value;
      S.demo = true; render();
      queueMicrotask(function () { decorateReview(); $('review-f-' + value)?.focus({preventScroll:true}); });
    };
    if (config.beforeChange) config.beforeChange(proceed); else proceed();
  }
  function reviewGo(id, selection) {
    var config = reviewPages[id];
    if (!config || !CF.PAGES[id] || CF.PAGES[id].end !== S.end || S.layer) return;
    if (selection && selection.state && !reviewStates(config).some(function (s) { return s.id === selection.state; })) return;
    if (selection && selection.scene && !reviewScenarios(config).some(function (s) { return s.id === selection.scene && s.available !== false; })) return;
    var proceed = function () {
      reviewClear(); S.st = 'default'; S.menu = null; reviewSearch = ''; reviewMore = false;
      queueMicrotask(function () { if ($('demoPanel')) $('demoPanel').scrollTop = 0; });
      reviewPending = null;
      if (config.navigate) { config.navigate(); return; }
      if (config.reset) config.reset();
      var scene = selection && selection.scene && reviewScenarios(config).find(function (s) { return s.id === selection.scene; });
      if (scene && scene.available === false) return;
      var route = scene && scene.route ? (typeof scene.route === 'function' ? scene.route() : scene.route) :
        (typeof config.route === 'function' ? config.route() : config.route || CF.ENTRY[id]);
      if (!route) { CF.toast(L('Open a record from its list first.', '请先从列表选择一条记录。')); decorateReview(); return; }
      if (config.enter) config.enter();
      if (selection) reviewPending = Object.assign({page:id},selection);
      if (location.hash !== '#' + route.replace(/^#/, '')) location.hash = '#' + route.replace(/^#/, '');
      else render();
    };
    var current = reviewPages[reviewCurrent()];
    if (current && current.beforeChange) current.beforeChange(proceed);
    else if (S.end === 'admin' && CF.AdminMenu) CF.AdminMenu.beforeLeave(proceed);
    else proceed();
  }
  /* ---------------------------------------------------------- 演示条
     底部常驻的演示条：第一行切换“谁在看”（视角），第二行切换“当前页的状态”。
     视角始终停留在当前页面与当前对象上，便于同一项目在项目方、当前报价方、其他资金方之间来回对照；
     页面目录与模块的高级模拟收进弹层，不再占据演示主路径。 */
  var DEFAULT_PARTY = { asset: 'entity-demo-a', fund: 'fund-a' };
  var reviewPerspectives = [
    {id: 'guest', role: 'guest', group: ['Signed out', '未登录'], label: ['Visitor', '访客']},
    {id: 'signed', role: 'signed', group: ['Signed in', '已登录'], label: ['No role bound', '未绑定角色']},
    {id: 'asset-a', role: 'asset', party: {asset: 'entity-demo-a'}, group: ['Asset holder', '资产方'], label: ['Demo Asset Company A', '演示资产企业 A'], short: ['Company A', '企业 A']},
    {id: 'asset-b', role: 'asset', party: {asset: 'entity-demo-b'}, group: ['Asset holder', '资产方'], label: ['Demo Asset Company B', '演示资产企业 B'], short: ['Company B', '企业 B'], multi: true},
    {id: 'fund-a', role: 'fund', party: {fund: 'fund-a'}, group: ['Funder', '资金方'], label: ['Demo Capital A', '演示资金机构 A'], short: ['Capital A', '机构 A']},
    {id: 'fund-b', role: 'fund', party: {fund: 'fund-b'}, group: ['Funder', '资金方'], label: ['Demo Capital B', '演示资金机构 B'], short: ['Capital B', '机构 B'], multi: true}
  ];
  var reviewPop = '', reviewPartyNotice = false;
  function reviewIdentityShown() { return S.end !== 'admin'; }
  function perspectiveNow() {
    var party = S.party || DEFAULT_PARTY;
    if (S.role === 'asset') return party.asset === 'entity-demo-b' ? 'asset-b' : 'asset-a';
    if (S.role === 'fund') return party.fund === 'fund-b' ? 'fund-b' : 'fund-a';
    return S.role === 'signed' ? 'signed' : 'guest';
  }
  /* 第二家企业只在区分企业的页面开放；其余页面按默认企业呈现，避免展示出不成立的数据组合。 */
  function perspectiveAllowed(item, config) { return !item.multi || !!(config && config.parties); }
  function reviewPartyGuard() {
    if (!reviewIdentityShown()) return;
    var item = reviewPerspectives.find(function (x) { return x.id === perspectiveNow(); });
    var config = reviewPages[reviewCurrent()];
    if (item && item.multi && config && !config.parties) {
      S.party = Object.assign({}, DEFAULT_PARTY);
      reviewPartyNotice = true;
    }
  }
  function reviewPerspectiveGo(id) {
    var item = reviewPerspectives.find(function (x) { return x.id === id; });
    var config = reviewPages[reviewCurrent()];
    if (!item || S.layer || !reviewIdentityShown() || !perspectiveAllowed(item, config)) return;
    var proceed = function () {
      reviewClear();
      S.role = item.role; S.party = Object.assign({}, DEFAULT_PARTY, item.party || {});
      // 登录模块同步演示账户的注册、认证和会话；不改真实登录或业务数据库。
      if (CF.review.prepareIdentity) CF.review.prepareIdentity(item.role);
      S.menu = null; S.layer = null; S.st = 'default'; S.demo = true;
      reviewFocus = 'review-p-' + id;
      resetList();
      var cur = reviewCurrent(), next = reviewPages[cur];
      // 新视角仍能打开当前页就留在原页；否则落到该身份的默认入口。
      var reachable = next && (!next.visible || next.visible()) && !!reviewRoute(cur, next) &&
        !(CF.PAGES[cur] && CF.PAGES[cur].auth && (item.role === 'guest' || item.role === 'signed'));
      var entry = reachable ? null : CF.ENTRY[defaultPage()];
      if (entry && location.hash !== '#' + entry) { location.hash = '#' + entry; return; }
      render();
    };
    if (config && config.beforeChange) config.beforeChange(proceed); else proceed();
  }
  function reviewHashPath(route) { return String(route || '').replace(/^#/, '').split('?')[0]; }
  function reviewTag(tag) {
    if (!tag) return '';
    return '<span class="tag"' + (tag.tone ? ' data-tone="' + esc(tag.tone) + '"' : '') + '>' + esc(reviewText(tag.label)) + '</span>';
  }
  function reviewPerspectiveRow(config) {
    var now = perspectiveNow(), groups = [];
    reviewPerspectives.forEach(function (item) {
      var key = reviewText(item.group), last = groups[groups.length - 1];
      if (!last || last.key !== key) groups.push(last = {key: key, items: []});
      last.items.push(item);
    });
    return '<div class="dock-row" role="group" aria-label="' + L('Who is viewing', '视角') + '"><span class="dock-label">' + L('Viewing as', '视角') + '</span>' +
      '<div class="dock-chips">' + groups.map(function (group, gi) {
        return (gi ? '<span class="dock-sep" aria-hidden="true"></span>' : '') +
          (group.items.length > 1 || group.items[0].party ? '<span class="dock-group-label">' + esc(group.key) + '</span>' : '') +
          group.items.map(function (item) {
            var allowed = perspectiveAllowed(item, config);
            var tag = allowed && config && config.perspective ? config.perspective(item.id) : null;
            var full = reviewText(item.label) + (tag ? ' · ' + reviewText(tag.label) : '');
            return '<button type="button" class="demo-chip" id="review-p-' + item.id + '" data-review-perspective="' + item.id + '"' +
              ' aria-pressed="' + (item.id === now) + '"' + (allowed && !S.layer ? '' : ' disabled') +
              ' aria-label="' + esc(full) + '" title="' + esc(allowed ? full : L('This page does not distinguish companies', '此页面不区分企业')) + '">' +
              esc(reviewText(item.short || item.label)) + reviewTag(tag) + '</button>';
          }).join('');
      }).join('') + '</div></div>';
  }
  function reviewStateRow(current, config) {
    if (!config) return '<div class="dock-row"><span class="dock-label">' + L('State', '状态') + '</span><p class="review-step">' +
      L('This page has no registered states.', '此页面未登记演示状态。') + '</p></div>';
    var states = reviewStates(config), scenes = reviewScenarios(config);
    var value = config.get ? config.get() : S.st;
    var feedback = states.filter(function (s) { return s.id === 'denied' || !['business', 'step'].includes(s.group); });
    var business = states.filter(function (s) { return s.id !== 'denied' && ['business', 'step'].includes(s.group); });
    var hereFull = location.hash.replace(/^#/, '');
    var sceneChips = scenes.map(function (scene) {
      // 适配器能判断“当前对象是否就处在该状态”时以它为准；否则按完整路由（含查询参数）比对。
      var full = String(scene.route || '').replace(/^#/, '');
      var onThis = typeof scene.current === 'boolean' ? scene.current : !!full && full === hereFull;
      var picked = reviewScene && reviewScene.page === current && reviewScene.id === scene.id;
      var disabled = S.layer || scene.available === false;
      var note = scene.available === false ? L('none', '无记录') : onThis ? L('current', '当前') : (scene.sample || '');
      return '<button type="button" class="demo-chip" id="review-s-' + esc(scene.id) + '" data-review-page="' + esc(current) + '" data-review-scene="' + esc(scene.id) + '"' +
        ' aria-pressed="' + !!(picked || onThis) + '"' + (disabled ? ' disabled' : '') +
        ' title="' + esc(reviewText(scene.description) || '') + '">' + esc(reviewText(scene.label)) +
        (note ? '<small>' + esc(note) + '</small>' : '') + '</button>';
    });
    var businessChips = business.map(function (state) {
      return '<button type="button" class="demo-chip" data-review-page="' + esc(current) + '" data-review-state="' + esc(state.id) + '"' +
        ' aria-pressed="' + (!reviewScene && value === state.id) + '"' + (S.layer ? ' disabled' : '') + '>' + esc(reviewText(state.label)) + '</button>';
    });
    var feedbackChips = feedback.map(function (state) {
      var on = !reviewScene && (value === state.id || state.id === 'default' && !feedback.some(function (s) { return s.id === value; }) && !business.some(function (s) { return s.id === value; }));
      return '<button type="button" class="demo-chip quiet" id="review-f-' + esc(state.id) + '" data-review-feedback="' + esc(state.id) + '"' +
        ' aria-pressed="' + !!on + '"' + (S.layer ? ' disabled' : '') + '>' + esc(reviewText(state.label)) + '</button>';
    });
    /* 可选的“同一阶段的另一种取值”（如结算方式）：页面自行登记 variants，未登记的页面不出现这一组。 */
    var variant = typeof config.variants === 'function' ? config.variants() : config.variants;
    var variantChips = variant && variant.options && variant.options.length ? variant.options.map(function (o) {
      return '<button type="button" class="demo-chip" id="review-v-' + esc(o.id) + '" data-review-variant="' + esc(o.id) + '"' +
        ' aria-pressed="' + !!o.current + '"' + (S.layer || o.available === false ? ' disabled' : '') +
        (o.description ? ' title="' + esc(reviewText(o.description)) + '"' : '') + '>' + esc(reviewText(o.label)) +
        (o.note ? '<small>' + esc(reviewText(o.note)) + '</small>' : '') + '</button>';
    }) : [];
    var bizAll = sceneChips.concat(businessChips);
    return '<div class="dock-row" role="group" aria-label="' + L('Page state', '本页状态') + '"><span class="dock-label">' + L('Page state', '本页状态') + '</span>' +
      '<div class="dock-chips">' +
      (bizAll.length ? '<span class="dock-group-label">' + L('Business', '业务') + '</span>' + bizAll.join('') + '<span class="dock-sep" aria-hidden="true"></span>' : '') +
      (variantChips.length ? '<span class="dock-group-label">' + esc(reviewText(variant.label)) + '</span>' + variantChips.join('') + '<span class="dock-sep" aria-hidden="true"></span>' : '') +
      (feedbackChips.length ? '<span class="dock-group-label">' + L('Display', '显示') + '</span>' + feedbackChips.join('') : '') +
      '</div></div>';
  }
  function reviewDirectory() {
    if (reviewSearch.trim()) return '<div class="review-results" id="review-results">' + reviewSearchResults() + '</div>';
    var groups = [], current = reviewCurrent();
    Object.keys(reviewPages).filter(reviewListed).forEach(function (id) {
      var key = reviewText(reviewGroup(id)), last = groups.find(function (g) { return g.key === key; });
      if (!last) groups.push(last = {key: key, ids: []});
      last.ids.push(id);
    });
    return '<div class="review-results" id="review-results">' + groups.map(function (g) {
      return '<div class="dir-group"><h6>' + esc(g.key) + '</h6>' + g.ids.map(function (id) {
        var openable = id === current || !!reviewRoute(id, reviewPages[id]);
        return '<button type="button" class="dir-item" data-review-page="' + esc(id) + '" data-review-state="default"' +
          (id === current ? ' aria-current="page"' : '') + (openable && !S.layer ? '' : ' disabled') + '>' +
          '<span>' + esc(reviewText(reviewLabel(id))) + '</span><small>' + esc(openable ? id : L('open from its list', '需先从列表进入')) + '</small></button>';
      }).join('') + '</div>';
    }).join('') + '</div>';
  }
  function decorateReview() {
    var panel = $('demoPanel');
    if (!panel || panel.hidden) return;
    if (reviewObserver) reviewObserver.disconnect();
    panel.classList.add('demo-dock');
    var header = panel.querySelector(':scope > .review-switcher');
    var more = panel.querySelector(':scope > .review-more');
    if (!header) { header = document.createElement('section'); header.className = 'review-switcher'; panel.prepend(header); }
    if (!more) {
      more = document.createElement('section'); more.className = 'review-more dock-pop'; more.id = 'review-more';
      more.setAttribute('aria-label', L('Advanced simulations', '高级模拟与外部事件'));
      more.innerHTML = '<div class="dock-pop-head"><strong>' + L('Advanced simulations', '高级模拟与外部事件') + '</strong></div><div class="review-more-body"></div>';
      panel.append(more);
    }
    var body = more.querySelector('.review-more-body');
    Array.from(panel.childNodes).forEach(function (node) { if (node !== header && node !== more) body.append(node); });
    var retainedFocus = header.contains(document.activeElement) && document.activeElement.id;
    if (panel.firstElementChild !== header) panel.prepend(header);
    // 旧的整页选择器、身份开关与部署单元开关由演示条接管，不在高级模拟里重复出现。
    var legacy = '[data-act="ops-state"], [data-act="ag-state"], [data-act="om-scene"]' +
      (reviewIdentityShown() ? ', [data-act="role"]' : '');
    body.querySelectorAll(legacy).forEach(function (button) {
      var group = button.parentElement;
      if (group && Array.from(group.children).every(function (child) { return child.matches(legacy); })) {
        if (group.previousElementSibling?.tagName === 'H5') group.previousElementSibling.hidden = true;
        group.hidden = true;
      }
    });
    var hasMore = Array.from(body.children).some(function (el) { return !el.hidden && el.textContent.trim(); });
    more.hidden = reviewPop !== 'more' || !hasMore;
    var current = reviewCurrent(), config = reviewPages[current];
    var subject = config && config.subject ? config.subject() : null;
    var active = document.activeElement, focusId = retainedFocus || (header.contains(active) && active.id);
    header.innerHTML =
      '<div class="dock-top">' +
        '<span class="dock-badge">' + L('Demo', '演示') + '</span>' +
        '<div class="dock-where" role="status"><strong>' + esc(current ? reviewText(reviewLabel(current)) : L('Unregistered page', '未登记页面')) + '</strong>' +
          (subject ? '<small>' + esc(reviewText(subject)) + '</small>' : '') +
          (current ? '<small class="mono">' + esc(current) + '</small>' : '') + '</div>' +
        (S.layer ? '<span class="review-step">' + L('Finish or cancel the open dialog first.', '请先完成或取消当前弹层。') + '</span>' : '') +
        (reviewPartyNotice ? '<span class="review-step">' + L('This page uses the default companies.', '此页面按默认企业展示。') + '</span>' : '') +
        '<button type="button" class="btn sm' + (reviewPop === 'pages' ? ' on' : '') + '" id="review-pages-btn" data-review-pop="pages" aria-expanded="' + (reviewPop === 'pages') + '" aria-controls="review-pages">' + L('Pages', '切换页面') + '</button>' +
        (hasMore ? '<button type="button" class="btn sm' + (reviewPop === 'more' ? ' on' : '') + '" id="review-more-btn" data-review-pop="more" aria-expanded="' + (reviewPop === 'more') + '" aria-controls="review-more">' + L('More simulations', '更多模拟') + '</button>' : '') +
        '<button type="button" class="btn sm" data-act="review-reset"' + (!config || S.layer ? ' disabled' : '') + '>' + L('Restore default', '恢复默认') + '</button>' +
        '<button type="button" class="btn icon bare" data-act="demo" aria-label="' + L('Close demo tools', '关闭演示工具') + '" title="' + L('Close demo tools', '关闭演示工具') + '">' + ICON.close + '</button>' +
      '</div>' +
      (reviewIdentityShown() ? reviewPerspectiveRow(config) : '') +
      reviewStateRow(current, config) +
      '<section class="dock-pop dock-pages" id="review-pages"' + (reviewPop === 'pages' ? '' : ' hidden') + ' aria-label="' + L('Pages', '切换页面') + '">' +
        '<label class="sr-only" for="review-search">' + L('Find a page or business state', '查找页面或业务状态') + '</label>' +
        '<input class="inp" id="review-search" type="search" value="' + esc(reviewSearch) + '" placeholder="' + L('Search pages or states', '搜索页面或状态') + '">' +
        reviewDirectory() +
      '</section>';
    reviewPartyNotice = false;
    // 横向滑动的行里，让已选中的视角 / 状态始终露在可视范围内。
    header.querySelectorAll('.dock-chips').forEach(function (row) {
      var chip = row.querySelector('[aria-pressed="true"]');
      if (!chip || row.scrollWidth <= row.clientWidth) return;
      var r = row.getBoundingClientRect(), c = chip.getBoundingClientRect();
      if (c.left < r.left || c.right > r.right) row.scrollLeft += c.left - r.left - (r.width - c.width) / 2;
    });
    if (reviewFocus || focusId) { $(reviewFocus || focusId)?.focus({preventScroll:true}); reviewFocus = ''; }
    // 演示条打开时，页面底部让出同样高度，避免挡住最后一屏内容。
    document.documentElement.style.setProperty('--dock-h', Math.ceil(header.getBoundingClientRect().height) + 'px');
    document.body.classList.add('demo-open');
    if (reviewObserver) reviewObserver.observe(panel, {childList:true});
  }
  CF.review = {
    register: function (id, config) { reviewPages[id] = config; },
    setTools: function (html) {
      var panel = $('demoPanel');
      var host = panel.querySelector(':scope > .review-more > .review-more-body') || panel;
      host.innerHTML = html;
    },
    pages: reviewPages, current: reviewCurrent, refresh: decorateReview,
    perspective: perspectiveNow
  };
  function reviewClose(focusButton) {
    S.demo = false; reviewPop = ''; renderDemo();
    if (focusButton) $('demoBtn').focus();
  }
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || !S.demo || S.layer || !event.target.closest('#demoPanel')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (reviewPop) { var back = reviewPop === 'pages' ? 'review-pages-btn' : 'review-more-btn'; reviewPop = ''; decorateReview(); $(back)?.focus(); return; }
    reviewClose(true);
  }, true);
  document.addEventListener('input', function (event) {
    if (event.target.id !== 'review-search') return;
    reviewSearch = event.target.value;
    var host = $('review-results'); if (host) host.outerHTML = reviewDirectory();
  });
  document.addEventListener('click', function (event) {
    if (!event.target.closest('#demoPanel')) {
      if (reviewPop && S.demo) { reviewPop = ''; decorateReview(); }
      return;
    }
    var pop = event.target.closest('[data-review-pop]');
    if (pop) {
      event.preventDefault(); event.stopImmediatePropagation();
      reviewPop = reviewPop === pop.dataset.reviewPop ? '' : pop.dataset.reviewPop;
      reviewFocus = reviewPop === 'pages' ? 'review-search' : pop.id;
      decorateReview(); return;
    }
    var perspective = event.target.closest('[data-review-perspective]');
    if (perspective) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!perspective.disabled) reviewPerspectiveGo(perspective.dataset.reviewPerspective);
      return;
    }
    var variantBtn = event.target.closest('[data-review-variant]');
    if (variantBtn) {
      event.preventDefault(); event.stopImmediatePropagation();
      var vconfig = reviewPages[reviewCurrent()], vset = vconfig && (typeof vconfig.variants === 'function' ? vconfig.variants() : vconfig.variants);
      if (!variantBtn.disabled && vset && vset.pick) {
        var vid = variantBtn.id, go = function () { vset.pick(variantBtn.dataset.reviewVariant); render(); queueMicrotask(function () { decorateReview(); $(vid)?.focus({preventScroll:true}); }); };
        if (vconfig.beforeChange) vconfig.beforeChange(go); else go();
      }
      return;
    }
    var feedback = event.target.closest('[data-review-feedback]');
    if (feedback) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!feedback.disabled) { reviewFocus = ''; reviewApply(feedback.dataset.reviewFeedback); }
      return;
    }
    var button = event.target.closest('[data-review-page]');
    if (!button || button.disabled) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (button.classList.contains('dir-item')) { reviewPop = ''; reviewFocus = ''; }
    else reviewFocus = button.id;
    reviewGo(button.dataset.reviewPage, button.hasAttribute('data-review-scene') ? {scene:button.dataset.reviewScene} : {state:button.dataset.reviewState});
  }, true);

  function renderDemo() {
    $("demoBtn").textContent = S.demo ? L("Close demo tools", "关闭演示工具") : L("Demo tools", "演示工具");
    var panel = $("demoPanel");
    $("demoBtn").setAttribute("aria-expanded", String(S.demo));
    panel.hidden = !S.demo || !!S.layer && !(M && M.reviewToolsInLayer);
    /* 演示条展开时由条内的关闭按钮收起，浮动入口让位，避免两个入口重叠。 */
    $("demoBtn").hidden = !!S.layer && !(M && M.reviewToolsInLayer) || !panel.hidden;
    if (panel.hidden) { document.body.classList.remove("demo-open"); return; }
    if (M && M.demoOnly) { panel.innerHTML = M.demo(); return; }
    var roles = S.end === "admin"
      ? [["ops", L("Operations admin", "运营管理员")]]
      : [["guest", L("Signed out", "未登录访客")], ["signed", L("Signed in · no role bound", "登录未绑定角色")], ["asset", L("Asset holder", "资产方")], ["fund", L("Funder", "资金方")]];
    panel.innerHTML =
      '<div class="grp"><h5>' + L("Deployment unit", "部署单元") + "</h5>" +
      seg("end", S.end, [["asset", L("Customer-facing", "面客端")], ["admin", L("Operations console", "运营端")]]) + "</div>" +
      '<div class="grp"><h5>' + L("Identity", "身份") + "</h5>" + seg("role", S.role, roles) + "</div>" +
      '<p class="why">' + L(
        "These switches exist for review only. They are not part of the product: the two deployment units ship separately and a visitor never switches identity in place.",
        "这些开关只为评审存在，不是产品功能：两个部署单元分开上线，访客也不会在页面里就地切换身份。") + "</p>" + (M && M.demo ? M.demo() : "");
  }

  /* ------------------------------------------------------------ 路由 */
  function pageFromHash() {
    var h = location.hash.replace(/^#/, "") || "/";
    for (var id in CF.ENTRY) { if (CF.ENTRY[id] === h || CF.ENTRY[id] === h.split("?")[0]) return id; }
    return null;
  }

  function defaultPage() {
    var n = navItems();
    return n.length ? n[0] : null;
  }

  /* honourHashEnd=true 时，深链决定进哪个部署单元（冷启动从 file:// 直接打开某条深链）；
     false 时由当前部署单元决定落哪一页（评审工具里切端，不被地址栏里的旧路由拽回去）。 */
  function syncRoute(honourHashEnd) {
    var id = pageFromHash();
    if (id && CF.PAGES[id] && honourHashEnd && CF.PAGES[id].end !== S.end) {
      S.end = CF.PAGES[id].end;
      if (S.end === "admin") S.role = "ops";
    }
    if (!id || !CF.PAGES[id] || CF.PAGES[id].end !== S.end) { id = defaultPage(); }
    S.page = id;
    var want = CF.ENTRY[id];
    /* 直接写 location.hash，不用 history.replaceState —— 交付件要能从 file:// 双击打开，
       部分浏览器在 file:// 下对 replaceState 抛 SecurityError。 */
    if (location.hash.replace(/^#/, "").split("?")[0] !== want.split("?")[0]) { location.hash = "#" + want; }
  }

  /* focus + C-L03：新增契约，未配置的旧模块不产生提示条或布局变化。 */
  var completionItems = [], completionFolded = false, completionListOpen = false;
  CF.setCompletion = function (items) {
    completionItems = (items || []).slice().sort(function (a, b) { return a.priority - b.priority; });
  };
  CF.resetCompletion = function () {
    completionItems = []; completionFolded = false; completionListOpen = false;
  };
  function renderCompletion() {
    var host = $("completion");
    if (!host && !completionItems.length) return;
    if (!host) {
      host = document.createElement("section"); host.id = "completion"; host.className = "completion";
      var main = document.querySelector("#portal .portal-main");
      if (!main) return;
      main.parentNode.insertBefore(host, main);
    }
    if (S.role === "guest") CF.resetCompletion();
    if (S.layer) return; // 弹层期间不重绘常驻条
    host.hidden = !completionItems.length;
    if (host.hidden) { host.innerHTML = ""; return; }
    function action(item) {
      return '<button class="btn" type="button" data-act="' + esc(item.act) + '" data-v="' + esc(item.value || "") + '">' + esc(item.label) + '</button>';
    }
    var first = completionItems[0], count = completionItems.length;
    if (completionFolded) {
      host.innerHTML = '<div class="completion-in"><button class="completion-fold" type="button" data-act="completion-fold" aria-expanded="false">' +
        '<span aria-hidden="true">ⓘ</span>' + esc(L(count + ' pending item(s) · Expand', '待完成 ' + count + ' 项 · 展开')) + '</button></div>';
      return;
    }
    host.innerHTML = '<div class="completion-in"><span class="completion-copy">' + esc(first.text) + '</span>' + action(first) +
      (count > 1 ? '<button class="btn ghost" type="button" data-act="completion-list" aria-expanded="' + completionListOpen + '">' +
        esc(L((count - 1) + ' more pending', '还有 ' + (count - 1) + ' 项待完成')) + '</button>' : '') +
      '<button class="btn ghost" type="button" data-act="completion-fold" aria-expanded="true" aria-label="' + L('Collapse reminders', '折叠补全提示') + '">⌃</button>' +
      (completionListOpen && count > 1 ? '<ul class="completion-list">' + completionItems.slice(1).map(function (item) {
        return '<li><span>' + esc(item.text) + '</span>' + action(item) + '</li>';
      }).join('') + '</ul>' : '') + '</div>';
  }
  function renderFocus() {
    var p = CF.PAGES[S.page] || {}, focus = $("focus");
    if (!focus) throw new Error('focus layout requires the shared focus container');
    $("portal").hidden = true; $("app").hidden = true; focus.hidden = false;
    $("focusTools").innerHTML = langDd();
    $("focusContent").innerHTML = M && M.content ? M.content(S.page) : '';
    if (M && M.afterRender) M.afterRender();
    renderLayer(); renderDemo();
    document.title = t(p.navKey || p.crumbKey) + ' · Harbour Credit';
  }

  /* ------------------------------------------------------------ 渲染 */
  function render() {
    var active = document.activeElement;
    if (!reviewFocus && active?.closest('.review-switcher') && active.id) reviewFocus = active.id;
    var focusKey = active && active.id;
    var focusAct = active && active.getAttribute("data-act"), focusV = active && active.getAttribute("data-v");
    reviewSync();
    if (S.end === "asset" && PORTAL_ROLES.indexOf(S.role) >= 0) { try { sessionStorage.setItem(ROLE_KEY, S.role); } catch (e) {} }
    if (M && M.beforeRender) M.beforeRender();
    if (!N.allowed() && S.menu === "notifications") S.menu = null;
    document.documentElement.setAttribute("data-end", S.end);
    document.body.classList.toggle("list-full", !!S.listFull);
    document.documentElement.setAttribute("lang", S.lang === "en" ? "en" : "zh-CN");
    if ((CF.PAGES[S.page] || {}).layout === "focus") { renderFocus(); return; }
    if ($("focus")) $("focus").hidden = true;
    var portal = $("portal"), app = $("app");
    portal.hidden = S.end !== "asset";
    app.hidden = S.end !== "admin";

    if (S.end === "asset") {
      renderPortalNav(); renderPortalTools();
    } else {
      renderAdminNav(); renderAdminTools();
    }
    var host = S.end === "asset" ? $("content") : $("acontent");
    var p = CF.PAGES[S.page] || {};
    /* 内置列表区是整段重绘的，重绘前记下它滚到哪、重绘后放回去；
       否则每加载一批，列表都会跳回顶部。 */
    var prevBox = host.querySelector(".listbox");
    var keepScroll = prevBox ? prevBox.scrollTop : 0;
    host.innerHTML = M && M.content ? M.content(S.page) : "";
    renderCrumb();
    var nextBox = host.querySelector(".listbox");
    if (nextBox && keepScroll && !S.toTop) nextBox.scrollTop = keepScroll;
    /* 官网层用整幅容器，不套 1560px 内容区的内边距。 */
    if (S.end === "asset") {
      var wrap = $("content");
      wrap.className = p.layout === "site" ? "" : "portal-wrap";
    }
    if (M && M.afterRender) M.afterRender();
    if (S.end === "asset") renderPortalTools();
    renderLayer();
    renderDemo();
    fitFilterMenus();
    if (!S.layer && active && !document.contains(active)) {
      var replacement = focusKey && $(focusKey);
      if (!replacement && focusAct) replacement = Array.from(document.querySelectorAll("[data-act]")).find(function (el) {
        return el.getAttribute("data-act") === focusAct && el.getAttribute("data-v") === focusV;
      });
      if (replacement) replacement.focus({preventScroll:true});
    }
    if (S.toTop) {
      S.toTop = false;
      var box = document.querySelector(".listbox");
      if (box) box.scrollTop = 0;
      var anchor = document.querySelector(".portal-wrap, .content");
      if (anchor) window.scrollTo({ top: Math.max(0, anchor.offsetTop - (document.querySelector(".portal-head")?.offsetHeight || 0) - (document.querySelector(".portal-sub")?.offsetHeight || 0) - 20), behavior: "auto" });
    }
    renderCompletion();
    observeMore();
    document.title = (t(p.navKey || p.crumbKey) || "Harbour Credit") + " · Harbour Credit";
  }
  CF.render = render;

  /* 滚到「加载更多」就自动加载下一批；按钮本身保留，键盘用户照样可达。 */
  var moreObserver = null;
  function observeMore() {
    if (moreObserver) { moreObserver.disconnect(); moreObserver = null; }
    if (typeof IntersectionObserver !== "function") return;
    var btn = document.querySelector(".loadmore button[data-act='more']");
    if (!btn) return;
    /* 列表在内置框里滚时，哨兵要以那个框为 root；窄屏交还整页滚动时 root 为视口。 */
    var box = btn.closest(".listbox");
    var root = box && box.scrollHeight > box.clientHeight + 1 ? box : null;
    moreObserver = new IntersectionObserver(function (entries) {
      if (entries.some(function (x) { return x.isIntersecting; })) {
        S.shown += CF.PAGE_SIZE;
        render();
      }
    }, { root: root, rootMargin: "120px" });
    moreObserver.observe(btn);
  }

  /* ------------------------------------------------------------ 事件 */
  function onClick(e) {
    var el = e.target.closest("[data-act]");
    if (!el) {
      if (S.menu && !e.target.closest(".fb-panel")) { S.menu = null; render(); }
      return;
    }
    var act = el.getAttribute("data-act"), v = el.getAttribute("data-v");

    if (el.disabled || el.getAttribute("aria-disabled") === "true") { e.preventDefault(); return; }
    if (M && M.onBeforeAct && M.onBeforeAct(act, v, e)) { e.preventDefault(); render(); return; }
    if (act === "notify-retry") { N.panelState = "default"; render(); return; }
    if (act === "prerequisite") { CF.toast(L("Account setup handoff — demonstration only.", "账户必办事项交接 —— 仅演示。")); return; }
    if (act === "completion-fold") { completionFolded = !completionFolded; e.preventDefault(); renderCompletion(); return; }
    if (act === "completion-list") { completionListOpen = !completionListOpen; e.preventDefault(); renderCompletion(); return; }
    if (act === "menu") { clearTimeout(accountHoverTimer);S.menu = v === "acct" && accountHoverOpened ? "acct" : S.menu === v ? null : v; accountHoverOpened=false;if(v==='acct')accountHoverSuppressed=true; e.preventDefault(); render(); if(v==='acct')document.querySelector('#portal-account-menu [role="menuitem"]')?.focus(); return; }
    if (act === "lang") { S.lang = v; S.menu = null; e.preventDefault(); render(); return; }
    if (act === "end") {
      S.end = v; S.role = v === "admin" ? "ops" : "guest"; S.st = "default"; S.layer = null;
      syncRoute(false); render(); return;
    }
    if (act === "role") { S.role = v; S.menu = null; S.layer = null; resetList(); render(); return; }
    if (act === "st") { S.st = v; S.layer = null; resetList(); render(); return; }
    if (act === "list-full") { S.listFull = !S.listFull; S.menu = null; render(); queueMicrotask(function () { $(v)?.focus({preventScroll:true}); }); return; }
    if (act === "review-reset") { reviewApply("default"); return; }
    if (act === "demo") { S.demo = !S.demo; render(); if (!S.demo) $("demoBtn").focus(); return; }
    if (act === "closelayer") {
      if (el.hasAttribute("data-stop") || (el.classList.contains("modal-mask") && e.target.closest("[data-stop]"))) return;
      CF.closeLayer(); return;
    }
    if (act === "go") { S.menu = null; location.hash = "#" + v; e.preventDefault(); return; }
    if (act === "retry" || act === "clearfilter") {
      S.st = "default"; resetList(); e.preventDefault(); render(); return;
    }
    if (act === "more") { S.shown += CF.PAGE_SIZE; e.preventDefault(); render(); return; }
    if (act === "pageno") { S.pageNo = Math.max(1, parseInt(v, 10) || 1); e.preventDefault(); render(); return; }
    if (act === "signin") {
      S.role = "asset"; e.preventDefault();
      CF.toast(L("Signed in as an asset holder — demonstration only.", "已以资产方身份登录 —— 仅为演示。"));
      render(); return;
    }
    if (act === "signout") {
      S.role = "guest"; S.menu = null; e.preventDefault();
      if (CF.PAGES[S.page] && CF.PAGES[S.page].auth) location.hash = "#/";
      render(); return;
    }
    if (act === "toast") {
      e.preventDefault();
      CF.toast(L("This entry belongs to another module and is not part of the baseline sample.",
                 "该入口属于其他模块，不在本底座样板范围内。"));
      S.menu = null; render(); return;
    }
    if (M && M.onAct && M.onAct(act, v, e)) { e.preventDefault(); render(); return; }
  }

  function onKey(e) {
    if (e.key === "Tab" && S.layer) {
      var nodes = Array.from($("layers").querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(function(node) { return !node.closest('[inert]') && node.getClientRects().length; });
      if (M && M.reviewToolsInLayer) { nodes = nodes.concat(Array.from(document.querySelectorAll('#demoBtn, #demoPanel:not([hidden]) button:not(:disabled)'))); }
      var first = nodes[0], last = nodes[nodes.length - 1];
      if (first && e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (first && !e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    if (e.key === "Escape") {
      clearTimeout(accountHoverTimer);accountHoverOpened=false;accountHoverSuppressed=true;
      if (S.layer) { if (M && M.onBeforeAct && M.onBeforeAct("closelayer", null, e)) return; CF.closeLayer(); return; }
      if (S.listFull && !S.menu) { S.listFull = false; render(); document.querySelector('[data-act="list-full"]')?.focus({preventScroll:true}); return; }
      if (S.menu) { var menu = S.menu; S.menu = null; render(); var btn = document.querySelector('[data-act="menu"][data-v="' + menu + '"]'); if(btn) btn.focus(); }
    }
  }

  /* ------------------------------------------------------------ 启动 */
  var accountHoverTimer, accountHoverOpened=false, accountHoverSuppressed=false;
  document.addEventListener('pointermove',function(e){if(!e.target.closest('.portal-account'))accountHoverSuppressed=false;});
  document.addEventListener('pointerover',function(e){
    var target=e.target.closest('.portal-account');
    if(!target || e.pointerType==='touch' || target.contains(e.relatedTarget) || accountHoverSuppressed)return;
    clearTimeout(accountHoverTimer);
    accountHoverTimer=setTimeout(function(){if(document.querySelector('.portal-account:hover') && !S.layer && S.menu!=='acct'){S.menu='acct';accountHoverOpened=true;render();}},180);
  });
  document.addEventListener('pointerout',function(e){
    var target=e.target.closest('.portal-account');
    if(!target || target.contains(e.relatedTarget))return;
    clearTimeout(accountHoverTimer);
    accountHoverTimer=setTimeout(function(){var current=document.querySelector('.portal-account');if(current && !current.matches(':hover')){accountHoverSuppressed=false;if(S.menu==='acct' && !current.contains(document.activeElement)){S.menu=null;accountHoverOpened=false;render();}}},180);
  });
  CF.define = function (mod) {
    var previous = M;
    if (previous && mod.pages) {
      var content = mod.content, action = mod.onAct;
      var breadcrumb = mod.breadcrumbRoute;
      mod.breadcrumbRoute = function (id) {
        return (breadcrumb && breadcrumb(id)) || (previous.breadcrumbRoute && previous.breadcrumbRoute(id));
      };
      mod.content = function (page) { return mod.pages.indexOf(page) >= 0 ? content(page) : previous.content(page); };
      mod.onAct = function (act,v,e) { return (action && action(act,v,e)) || (previous.onAct && previous.onAct(act,v,e)); };
      mod.layers = Object.assign({}, previous.layers, mod.layers);
    }
    M = mod;
    ["en", "zh"].forEach(function (lg) {
      var src = (mod.dict && mod.dict[lg]) || {};
      for (var k in src) DICT[lg][k] = src[k];
    });
  };

  CF.boot = function () {
    if (window.AdminPrototypeBundle?.reviewOpen) { S.demo = true; window.AdminPrototypeBundle.reviewOpen = false; }
    try { if (localStorage.getItem(REVIEW_OPEN) === '1') { S.demo = true; localStorage.removeItem(REVIEW_OPEN); } } catch (error) {}
    S.tz = resolveTz();
    syncRoute(true);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    // Only reveal the focused link inside the horizontal nav; keep page scroll unchanged.
    $("nav")?.addEventListener("focusin", function (event) {
      var item = event.target.closest(".nav-item");
      if (!item) return;
      var nav = event.currentTarget, bounds = nav.getBoundingClientRect();
      var rect = item.getBoundingClientRect(), style = getComputedStyle(nav);
      // Navigation padding also reserves space for the 2px outline + 2px offset.
      var left = bounds.left + parseFloat(style.paddingLeft);
      var right = bounds.right - parseFloat(style.paddingRight);
      if (rect.left < left) nav.scrollLeft += rect.left - left;
      else if (rect.right > right) nav.scrollLeft += rect.right - right;
    });
    window.addEventListener("hashchange", function () {
      var prevPage = S.page;
      var id = pageFromHash();
      if (M && M.onRoute) M.onRoute(prevPage, id);
      if (id && CF.PAGES[id]) {
        if (CF.PAGES[id].end !== S.end) { S.end = CF.PAGES[id].end; S.role = S.end === "admin" ? "ops" : S.role; }
        /* 同一页面内改筛选只是改查询串，打开的筛选面板不该被关掉。 */
        var samePage = S.page === id;
        S.page = id; if (!samePage) { S.menu = null; S.listFull = false; }
        S.layer = null; S.st = "default"; S.sort = "at"; S.sortDir = "desc";
        if (!(CF.PAGES[id].retainList && CF.PAGES[prevPage] && CF.PAGES[prevPage].retainList)) resetList();
      } else { syncRoute(true); }
      render();
    });
    $("demoBtn").setAttribute("data-act", "demo");
    $("demoBtn").setAttribute("aria-controls", "demoPanel");
    reviewObserver = new MutationObserver(decorateReview);
    reviewObserver.observe($("demoPanel"), {childList:true});
    render();
  };
})(window.CF = window.CF || {});
