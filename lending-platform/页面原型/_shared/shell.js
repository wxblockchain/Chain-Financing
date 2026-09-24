/* ==========================================================================
   shell.js — 借贷平台原型公共运行时（本平台唯一来源）
   面客端与管理端共用：i18n、状态、hash 路由、导航与面包屑渲染、顶栏/侧栏工具区、
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
  var S = {
    lang: "en",              // 默认英文；不读浏览器语言（国际化基线 3.1）
    tz: null,                // 按浏览器推断，推断失败兜底 UTC
    end: "asset",            // asset = 面客端 · admin = 管理端
    role: "guest",           // guest / asset / fund / ops
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
    }).sort(function (a,b) { return b.at.localeCompare(a.at) || b.id.localeCompare(a.id); }) : [];
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
    return CF.empty(S.role === "limited" ? L("Complete your account setup", "请先完成账户必办事项") : L("Sign in to view your messages", "登录后查看消息"),
      S.role === "limited" ? L("Complete the required steps for your account to continue.", "完成账户必办事项后即可继续。") : L("After signing in, you will return to this page.", "登录后将返回当前页面。"),
      '<button class="btn primary" data-act="' + (S.role === "limited" ? "prerequisite" : "signin") + '">' +
      (S.role === "limited" ? L("Continue setup", "继续完善") : L("Sign in", "登录")) + '</button>');
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
  CF.fmtTime = function (iso) {
    var d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    var hh = ("0" + d.getHours()).slice(-2), mm = ("0" + d.getMinutes()).slice(-2);
    return CF.fmtDate(iso) + (S.lang === "en" ? ", " : " ") + hh + ":" + mm + " (" + S.tz + ")";
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
    external: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M9.2 2.6H13.4V6.8M13.4 2.6 7.6 8.4M11.2 9.6v3.2a1 1 0 0 1-1 1H3.2a1 1 0 0 1-1-1V5.8a1 1 0 0 1 1-1h3.2"/></svg>'
  };
  CF.ICON = ICON;

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
  CF.filterSearch = function (id, placeholder, value, fullLabel) {
    return '<span class="fb-q">' + ICON.search +
      '<input class="inp" id="' + esc(id) + '" type="search" value="' + esc(value || '') +
      '" placeholder="' + esc(placeholder) + '" title="' + esc(fullLabel || placeholder) +
      '" aria-label="' + esc(fullLabel || placeholder) + '"></span>';
  };
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

  /* 未登录访客看不到需要登录的导航入口；页面本身仍可由深链或评审目录打开，展示其登录引导。 */
  function navItems() {
    return (CF.NAV[S.end] || []).filter(function (id) {
      if (!CF.PAGES[id]) return false;
      if (CF.PAGES[id].auth && S.end === "asset" && S.role === "guest") return false;
      return !M || !M.allowNav || M.allowNav(id);
    });
  }

  function renderPortalNav() {
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

  function accountDd() {
    var who = S.role === "fund" ? L("Funder", "资金方") : L("Asset holder", "资产方");
    var identity = CF.portalAccount() || {};
    var address = typeof identity.walletAddress === "string" ? identity.walletAddress.trim() : "";
    var label = address ? (address.length > 10 ? address.slice(0, 6) + "…" + address.slice(-4) : address) : L("My account", "我的账户");
    var open = S.menu === "acct";
    var list = open
      ? '<div class="dd-list" id="portal-account-menu" role="menu" aria-label="' + L("Account menu", "账户菜单") + '">' +
        '<div class="portal-account-role">' + esc(who) + "</div>" +
        '<button type="button" role="menuitem" data-act="toast" data-v="acct">' + L("Account settings", "账户设置") + "</button>" +
        '<button type="button" role="menuitem" data-act="toast" data-v="inst">' + (S.role === "fund" ? L("User information", "用户信息") : L("Company information", "企业信息")) + "</button>" +
        (N.allowed() && N.preview ? '<button type="button" role="menuitem" data-act="go" data-v="/notifications">' + L("Notifications", "消息中心") + '</button>' : '') +
        '<div class="dd-sep"></div>' +
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
      html += '<button class="btn primary sm" type="button" data-act="signin">' + L("Sign in", "登录") + "</button>";
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
        '<div class="modal-h">' + esc(body.title) + "</div>" +
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
  }
  function reviewSync() {
    if (reviewActive && reviewActive !== reviewCurrent()) reviewClear();
  }
  function reviewApply(value) {
    var id = reviewCurrent(), config = reviewPages[id];
    if (!config || !reviewStates(config).some(function (state) { return state.id === value; })) return;
    if (S.layer) return;
    var proceed = function () {
      reviewClear();
      if (value === 'default' && config.reset) config.reset();
      reviewActive = id; S.menu = null;
      if (config.set) config.set(value); else S.st = value;
      S.demo = true; render();
      queueMicrotask(function () { decorateReview(); $('review-state')?.focus({preventScroll:true}); });
    };
    if (config.beforeChange) config.beforeChange(proceed); else proceed();
  }
  function reviewGo(id) {
    var config = reviewPages[id];
    if (!config || !CF.PAGES[id] || CF.PAGES[id].end !== S.end || S.layer) return;
    var proceed = function () {
      reviewClear(); S.st = 'default'; S.menu = null; reviewSearch = ''; reviewMore = false; reviewFocus = 'review-page';
      if (config.navigate) { config.navigate(); return; }
      if (config.reset) config.reset();
      var route = typeof config.route === 'function' ? config.route() : config.route || CF.ENTRY[id];
      if (!route) { CF.toast(L('Open a record from its list first.', '请先从列表选择一条记录。')); decorateReview(); return; }
      if (config.enter) config.enter();
      if (location.hash !== '#' + route.replace(/^#/, '')) location.hash = '#' + route.replace(/^#/, '');
      else render();
    };
    var current = reviewPages[reviewCurrent()];
    if (current && current.beforeChange) current.beforeChange(proceed);
    else if (S.end === 'admin' && CF.AdminMenu) CF.AdminMenu.beforeLeave(proceed);
    else proceed();
  }
  /* Sign-in state is the first review axis on the customer-facing unit: pick who is looking,
     then the page, then that page's state. Operations identity comes from its real sign-in. */
  var reviewIdentities = [
    {id: 'guest', label: ['Signed out visitor', '未登录访客'], group: ['Signed out', '未登录']},
    {id: 'asset', label: ['Asset holder', '资产方'], group: ['Signed in', '已登录']},
    {id: 'fund', label: ['Funder', '资金方'], group: ['Signed in', '已登录']},
    {id: 'limited', label: ['Restricted session', '受限会话'], group: ['Signed in', '已登录']}
  ];
  function reviewIdentityShown() { return S.end !== 'admin'; }
  function reviewIdentityOptions() {
    var groups = {};
    reviewIdentities.forEach(function (identity) {
      var group = reviewText(identity.group);
      (groups[group] || (groups[group] = [])).push('<option value="' + esc(identity.id) + '"' +
        (identity.id === S.role ? ' selected' : '') + '>' + esc(reviewText(identity.label)) + '</option>');
    });
    return Object.keys(groups).map(function (group) {
      return '<optgroup label="' + esc(group) + '">' + groups[group].join('') + '</optgroup>';
    }).join('');
  }
  function reviewIdentityGo(value) {
    if (!reviewIdentityShown() || S.layer || !reviewIdentities.some(function (identity) { return identity.id === value; })) return;
    var config = reviewPages[reviewCurrent()];
    var proceed = function () {
      reviewClear();
      S.role = value; S.menu = null; S.layer = null; S.st = 'default'; S.demo = true;
      reviewSearch = ''; reviewFocus = 'review-identity';
      resetList();
      var id = reviewCurrent(), next = reviewPages[id];
      // Stay on the page under the new identity when it can still be opened; otherwise land on its entry.
      var reachable = next && (!next.visible || next.visible()) && !!reviewRoute(id, next) &&
        !(CF.PAGES[id] && CF.PAGES[id].auth && value === 'guest');
      var entry = reachable ? null : CF.ENTRY[defaultPage()];
      if (entry && location.hash !== '#' + entry) { location.hash = '#' + entry; return; }
      render();
    };
    if (config && config.beforeChange) config.beforeChange(proceed); else proceed();
  }
  function reviewOptions() {
    var groups = {}, current = reviewCurrent(), query = reviewSearch.toLocaleLowerCase().trim();
    Object.keys(reviewPages).forEach(function (id) {
      var config = reviewPages[id], page = CF.PAGES[id];
      if (!page || page.end !== S.end || config.visible && !config.visible()) return;
      var label = reviewText(config.label) || t(page.navKey || page.crumbKey);
      if (query && id !== current && (id + ' ' + label).toLocaleLowerCase().indexOf(query) < 0) return;
      var group = reviewText(config.group) || L('Pages', '页面');
      var openable = id === current || !!reviewRoute(id, config);
      (groups[group] || (groups[group] = [])).push('<option value="' + esc(id) + '"' + (id === current ? ' selected' : '') +
        (openable ? '' : ' disabled') + '>' +
        esc(label + ' · ' + id + (openable ? '' : ' · ' + L('open from its list', '需先从列表进入'))) + '</option>');
    });
    return (!current ? '<option value="">' + L('Choose a page', '选择页面') + '</option>' : '') + Object.keys(groups).map(function (key) {
      return '<optgroup label="' + esc(key) + '">' + groups[key].join('') + '</optgroup>';
    }).join('');
  }
  function decorateReview() {
    var panel = $('demoPanel');
    if (!panel || panel.hidden) return;
    if (reviewObserver) reviewObserver.disconnect();
    var header = panel.querySelector(':scope > .review-switcher');
    var more = panel.querySelector(':scope > .review-more');
    if (!header) { header = document.createElement('section'); header.className = 'review-switcher'; panel.prepend(header); }
    if (!more) {
      more = document.createElement('details'); more.className = 'review-more'; more.open = reviewMore;
      var summary = document.createElement('summary'); summary.textContent = L('More simulations', '更多模拟'); more.append(summary);
      var body = document.createElement('div'); body.className = 'review-more-body'; more.append(body); panel.append(more);
      more.addEventListener('toggle', function () { reviewMore = more.open; });
    }
    Array.from(panel.childNodes).forEach(function (node) { if (node !== header && node !== more) more.lastElementChild.append(node); });
    var retainedFocus = header.contains(document.activeElement) && document.activeElement.id;
    if (panel.firstElementChild !== header) panel.prepend(header);
    // Legacy whole-page selectors move to the canonical state control, without duplicating them.
    var legacy = '[data-act="ops-state"], [data-act="ag-state"], [data-act="om-scene"]' +
      (reviewIdentityShown() ? ', [data-act="role"]' : '');
    more.querySelectorAll(legacy).forEach(function (button) {
      var group = button.parentElement;
      if (group && Array.from(group.children).every(function (child) { return child.matches(legacy); })) {
        if (group.previousElementSibling?.tagName === 'H5') group.previousElementSibling.hidden = true;
        group.hidden = true;
      }
    });
    var legacyState = more.querySelector('#pr-view');
    if (legacyState) legacyState.closest('.field').hidden = true;
    var current = reviewCurrent(), config = reviewPages[current];
    var states = config ? reviewStates(config) : [];
    var value = config ? (config.get ? config.get() : S.st) : '';
    var groups = {}, groupLabels = {feedback: L('Interface feedback', '界面反馈'), business: L('Business states', '业务状态'), step: L('Flow steps', '流程步骤')};
    states.forEach(function (state) {
      var group = groupLabels[state.group] || reviewText(state.group) || groupLabels.feedback;
      (groups[group] || (groups[group] = [])).push('<option value="' + esc(state.id) + '"' + (state.id === value ? ' selected' : '') + '>' + esc(reviewText(state.label)) + '</option>');
    });
    var live = config && !states.some(function (state) { return state.id === value; });
    var active = document.activeElement, focusId = retainedFocus || (header.contains(active) && active.id);
    var step = reviewIdentityShown() ? 1 : 0;
    header.innerHTML = '<div class="review-heading"><strong>' + L('Prototype review', '原型评审') + '</strong><span>' + L('Simulation only', '仅模拟') + '</span></div>' +
      (reviewIdentityShown() ? '<label for="review-identity">' + L('1 · Sign-in state', '1 · 登录状态') + '</label>' +
        '<select class="inp" id="review-identity"' + (S.layer ? ' disabled' : '') + '>' + reviewIdentityOptions() + '</select>' : '') +
      '<label for="review-search">' + L('Find a page', '查找页面') + '</label><input class="inp" id="review-search" type="search" value="' + esc(reviewSearch) + '" placeholder="' + L('Page name or ID', '页面名称或编号') + '">' +
      '<label for="review-page">' + (step + 1) + L(' · Page', ' · 页面') + '</label><select class="inp" id="review-page"' + (S.layer ? ' disabled' : '') + '>' + reviewOptions() + '</select>' +
      (config && config.step ? '<p class="review-step">' + esc(L('Current step: ', '当前步骤：') + config.step()) + '</p>' : '') +
      '<label for="review-state">' + (step + 2) + L(' · State', ' · 状态') + '</label><select class="inp" id="review-state"' + (!states.length || S.layer ? ' disabled' : '') + '>' +
      (live ? '<option value="" selected disabled>' + L('Current flow', '当前流程状态') + '</option>' : '') +
      (!states.length ? '<option>' + L('Follow the page flow', '通过页面流程触发') + '</option>' : Object.keys(groups).map(function (group) { return '<optgroup label="' + esc(group) + '">' + groups[group].join('') + '</optgroup>'; }).join('')) + '</select>' +
      '<button class="btn" type="button" data-act="review-reset"' + (!config || S.layer ? ' disabled' : '') + '>' + L('Restore default', '恢复默认') + '</button>';
    if (reviewFocus || focusId) { $(reviewFocus || focusId)?.focus({preventScroll:true}); reviewFocus = ''; }
    if (reviewObserver) reviewObserver.observe(panel, {childList:true});
  }
  CF.review = {
    register: function (id, config) { reviewPages[id] = config; },
    setTools: function (html) {
      var panel = $('demoPanel');
      var host = panel.querySelector(':scope > .review-more > .review-more-body') || panel;
      host.innerHTML = html;
    },
    pages: reviewPages, current: reviewCurrent, refresh: decorateReview
  };
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && S.demo && !S.layer && event.target.closest('#demoPanel')) {
      event.preventDefault(); event.stopImmediatePropagation(); S.demo = false; renderDemo(); $('demoBtn').focus();
    }
  }, true);
  document.addEventListener('input', function (event) {
    if (event.target.id !== 'review-search') return;
    reviewSearch = event.target.value; $('review-page').innerHTML = reviewOptions();
  });
  document.addEventListener('change', function (event) {
    if (event.target.id === 'review-identity') reviewIdentityGo(event.target.value);
    if (event.target.id === 'review-page') reviewGo(event.target.value);
    if (event.target.id === 'review-state') reviewApply(event.target.value);
  });

  function renderDemo() {
    $("demoBtn").textContent = S.demo ? L("Close demo tools", "关闭演示工具") : L("Demo tools", "演示工具");
    var panel = $("demoPanel");
    $("demoBtn").setAttribute("aria-expanded", String(S.demo));
    $("demoBtn").hidden = !!S.layer && !(M && M.reviewToolsInLayer);
    panel.hidden = !S.demo || !!S.layer && !(M && M.reviewToolsInLayer);
    if (panel.hidden) return;
    if (M && M.demoOnly) { panel.innerHTML = M.demo(); return; }
    var roles = S.end === "admin"
      ? [["ops", L("Operations admin", "运营管理员")]]
      : [["limited", L("Restricted session", "受限会话")], ["guest", L("Signed out", "未登录访客")], ["asset", L("Asset holder", "资产方")], ["fund", L("Funder", "资金方")]];
    panel.innerHTML =
      '<div class="grp"><h5>' + L("Deployment unit", "部署单元") + "</h5>" +
      seg("end", S.end, [["asset", L("Customer-facing", "面客端")], ["admin", L("Operations console", "管理端")]]) + "</div>" +
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
