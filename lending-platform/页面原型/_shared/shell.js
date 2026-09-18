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
    menu: null,              // 当前展开的下拉
    layer: null,             // { type:'drawer'|'modal', key:... }
    demo: false
  };
  CF.S = S;

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
    close: '<svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8"/></svg>'
  };
  CF.ICON = ICON;

  /* ------------------------------------------------------------ 公共片段 */
  CF.tag = function (kind, text) {
    return '<span class="tag ' + kind + '"><span class="dot"></span>' + esc(text) + "</span>";
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

  /* 页面级状态表面：模块把自己的默认内容传进来，公共层负责其余状态。 */
  CF.surface = function (opts) {
    if (S.st === "loading") return CF.skelTable(opts.skelRows);
    if (S.st === "denied") {
      return CF.empty(
        L("You do not have access to this view", "你没有查看该视图的权限"),
        L("This view is limited to the entity that owns the record. Public fields stay visible on the marketplace.",
          "该视图仅对记录所属主体开放。广场上的公开字段不受影响。"),
        '<button class="btn" type="button" data-act="go" data-v="' + esc(opts.backTo || "/") + '">' +
        L("Back to the marketplace", "返回广场") + "</button>");
    }
    if (S.st === "error") {
      return CF.empty(
        L("Could not load this list", "列表加载失败"),
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
  function navItems() { return (CF.NAV[S.end] || []).filter(function (id) { return CF.PAGES[id]; }); }

  function renderPortalNav() {
    var html = navItems().map(function (id) {
      var p = CF.PAGES[id];
      var cur = id === S.page ? ' aria-current="page"' : "";
      return '<a class="nav-item" href="#' + esc(CF.ENTRY[id]) + '"' + cur + ">" + esc(t(p.navKey)) + "</a>";
    }).join("");
    $("nav").innerHTML = html;
  }

  function renderAdminNav() {
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
    return '<button class="bell" type="button" data-act="toast" data-v="notify" aria-label="' +
      L("Notifications", "消息中心") + '">' + ICON.bell +
      (unread ? '<span class="badge">' + unread + "</span>" : "") + "</button>";
  }

  function accountDd() {
    var who = S.role === "fund" ? L("Funder", "资金方") : L("Asset holder", "资产方");
    var initials = S.role === "fund" ? "F" : "A";
    var open = S.menu === "acct";
    var list = open
      ? '<div class="dd-list" role="menu">' +
        '<div class="dd-head">' + esc(who) + "</div>" +
        '<button type="button" role="menuitem" data-act="toast" data-v="acct">' + L("Account settings", "账户设置") + "</button>" +
        '<button type="button" role="menuitem" data-act="toast" data-v="inst">' + L("Institution", "机构信息") + "</button>" +
        '<div class="dd-sep"></div>' +
        '<button type="button" role="menuitem" data-act="signout">' + L("Sign out", "退出登录") + "</button>" +
        "</div>"
      : "";
    return '<div class="dd"><button class="dd-btn" type="button" data-act="menu" data-v="acct" ' +
      'aria-haspopup="menu" aria-expanded="' + open + '"><span class="op-avatar xs">' +
      initials + "</span><span>" + esc(who) + "</span>" + ICON.caret + "</button>" + list + "</div>";
  }

  function renderPortalTools() {
    var html = langDd();
    if (S.role === "guest") {
      html += '<button class="btn ghost sm" type="button" data-act="signin">' + L("Sign in", "登录") + "</button>" +
              '<button class="btn primary sm" type="button" data-act="toast" data-v="apply">' +
              L("Apply to join", "申请入驻") + "</button>";
    } else {
      html += bell(3) + accountDd();
    }
    $("tools").innerHTML = html;
  }

  function renderAdminTools() {
    $("atools").innerHTML = langDd() + bell(2);
    $("asidefoot").innerHTML =
      '<div class="op-row"><span class="op-avatar">OP</span><div style="min-width:0">' +
      '<div class="op-name">' + L("Operations admin", "运营管理员") + "</div>" +
      '<div class="op-role">' + L("Signed in", "已登录") + "</div></div></div>";
  }

  /* ------------------------------------------------------------ 面包屑 */
  function renderCrumb() {
    var p = CF.PAGES[S.page] || {};
    if (S.end === "asset") {
      var sub = $("subwrap");
      if (p.layout === "site") { sub.hidden = true; return; }
      sub.hidden = false;
      $("crumb").innerHTML =
        '<a class="crumb-link" href="#/">' + esc(t("navHome")) + "</a><span>/</span>" +
        '<span class="crumb-cur">' + esc(t(p.navKey || p.crumbKey)) + "</span>";
    } else {
      $("acrumb").innerHTML =
        '<span>' + L("Operations", "运营端") + "</span><span>/</span>" +
        '<span class="crumb-cur">' + esc(t(p.navKey || p.crumbKey)) + "</span>";
    }
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
  CF.openLayer = function (type, key, data) { S.layer = { type: type, key: key, data: data }; render(); };
  CF.closeLayer = function () { S.layer = null; render(); };

  function renderLayer() {
    var host = $("layers");
    if (!S.layer) { host.innerHTML = ""; return; }
    var body = M && M.layers && M.layers[S.layer.key] ? M.layers[S.layer.key](S.layer.data) : null;
    if (!body) { host.innerHTML = ""; return; }
    if (S.layer.type === "drawer") {
      host.innerHTML = '<div class="scrim" data-act="closelayer"></div>' +
        '<aside class="drawer" role="dialog" aria-modal="true" aria-label="' + esc(body.title) + '">' +
        '<div class="drawer-h"><b>' + esc(body.title) + '</b>' +
        '<button class="btn ghost sm" type="button" data-act="closelayer" style="margin-left:auto" aria-label="' +
        L("Close", "关闭") + '">' + ICON.close + "</button></div>" +
        '<div class="drawer-b">' + body.html + "</div>" +
        (body.foot ? '<div class="drawer-f">' + body.foot + "</div>" : "") + "</aside>";
    } else {
      host.innerHTML = '<div class="modal-mask" data-act="closelayer">' +
        '<div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(body.title) + '" data-stop="1">' +
        '<div class="modal-h">' + esc(body.title) + "</div>" +
        '<div class="modal-b">' + body.html + "</div>" +
        '<div class="modal-f">' + (body.foot || "") + "</div></div></div>";
    }
    var first = host.querySelector("button, a, input");
    if (first) first.focus();
  }

  /* ------------------------------------------------------------ 演示工具 */
  function seg(act, cur, opts) {
    return '<div class="seg">' + opts.map(function (o) {
      return '<button type="button" data-act="' + act + '" data-v="' + o[0] + '" aria-pressed="' +
        (cur === o[0]) + '">' + esc(o[1]) + "</button>";
    }).join("") + "</div>";
  }

  function renderDemo() {
    $("demoBtn").textContent = S.demo ? L("Close demo tools", "关闭演示工具") : L("Demo tools", "演示工具");
    var panel = $("demoPanel");
    panel.hidden = !S.demo;
    if (!S.demo) return;
    var roles = S.end === "admin"
      ? [["ops", L("Operations admin", "运营管理员")]]
      : [["guest", L("Signed out", "未登录访客")], ["asset", L("Asset holder", "资产方")], ["fund", L("Funder", "资金方")]];
    panel.innerHTML =
      '<div class="grp"><h5>' + L("Deployment unit", "部署单元") + "</h5>" +
      seg("end", S.end, [["asset", L("Customer-facing", "面客端")], ["admin", L("Operations console", "管理端")]]) + "</div>" +
      '<div class="grp"><h5>' + L("Identity", "身份") + "</h5>" + seg("role", S.role, roles) + "</div>" +
      '<div class="grp"><h5>' + L("Page state", "页面状态") + "</h5>" +
      seg("st", S.st, [["default", L("Default", "默认")], ["loading", L("Loading", "加载中")],
        ["empty", L("Empty", "空数据")], ["noresult", L("No results", "筛选无结果")],
        ["error", L("Load failed", "加载失败")], ["denied", L("No access", "无权限")]]) + "</div>" +
      '<p class="why">' + L(
        "These switches exist for review only. They are not part of the product: the two deployment units ship separately and a visitor never switches identity in place.",
        "这些开关只为评审存在，不是产品功能：两个部署单元分开上线，访客也不会在页面里就地切换身份。") + "</p>";
  }

  /* ------------------------------------------------------------ 路由 */
  function pageFromHash() {
    var h = location.hash.replace(/^#/, "") || "/";
    for (var id in CF.ENTRY) { if (CF.ENTRY[id] === h) return id; }
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
    if (location.hash.replace(/^#/, "") !== want) { location.hash = "#" + want; }
  }

  /* ------------------------------------------------------------ 渲染 */
  function render() {
    document.documentElement.setAttribute("data-end", S.end);
    document.documentElement.setAttribute("lang", S.lang === "en" ? "en" : "zh-CN");
    var portal = $("portal"), app = $("app");
    portal.hidden = S.end !== "asset";
    app.hidden = S.end !== "admin";

    if (S.end === "asset") {
      renderPortalNav(); renderPortalTools();
    } else {
      renderAdminNav(); renderAdminTools();
    }
    renderCrumb();

    var host = S.end === "asset" ? $("content") : $("acontent");
    var p = CF.PAGES[S.page] || {};
    host.innerHTML = M && M.content ? M.content(S.page) : "";
    /* 官网层用整幅容器，不套 1560px 内容区的内边距。 */
    if (S.end === "asset") {
      var wrap = $("content");
      wrap.className = p.layout === "site" ? "" : "portal-wrap";
    }
    renderLayer();
    renderDemo();
    document.title = (t(p.navKey || p.crumbKey) || "Harbour Credit") + " · Harbour Credit";
  }
  CF.render = render;

  /* ------------------------------------------------------------ 事件 */
  function onClick(e) {
    var el = e.target.closest("[data-act]");
    if (!el) {
      if (S.menu) { S.menu = null; render(); }
      return;
    }
    var act = el.getAttribute("data-act"), v = el.getAttribute("data-v");

    if (act === "menu") { S.menu = S.menu === v ? null : v; e.preventDefault(); render(); return; }
    if (act === "lang") { S.lang = v; S.menu = null; e.preventDefault(); render(); return; }
    if (act === "end") {
      S.end = v; S.role = v === "admin" ? "ops" : "guest"; S.st = "default"; S.layer = null;
      syncRoute(false); render(); return;
    }
    if (act === "role") { S.role = v; S.layer = null; render(); return; }
    if (act === "st") { S.st = v; S.layer = null; render(); return; }
    if (act === "demo") { S.demo = !S.demo; render(); return; }
    if (act === "closelayer") {
      if (el.hasAttribute("data-stop")) return;
      CF.closeLayer(); return;
    }
    if (act === "go") { location.hash = "#" + v; e.preventDefault(); return; }
    if (act === "retry" || act === "clearfilter") { S.st = "default"; e.preventDefault(); render(); return; }
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
    if (e.key === "Escape") {
      if (S.layer) { CF.closeLayer(); return; }
      if (S.menu) { S.menu = null; render(); }
    }
  }

  /* ------------------------------------------------------------ 启动 */
  CF.define = function (mod) {
    M = mod;
    ["en", "zh"].forEach(function (lg) {
      var src = (mod.dict && mod.dict[lg]) || {};
      for (var k in src) DICT[lg][k] = src[k];
    });
  };

  CF.boot = function () {
    S.tz = resolveTz();
    syncRoute(true);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("hashchange", function () {
      var id = pageFromHash();
      if (id && CF.PAGES[id]) {
        if (CF.PAGES[id].end !== S.end) { S.end = CF.PAGES[id].end; S.role = S.end === "admin" ? "ops" : S.role; }
        S.page = id; S.layer = null; S.st = "default"; S.sort = "at"; S.sortDir = "desc";
      }
      render();
    });
    $("demoBtn").setAttribute("data-act", "demo");
    render();
  };
})(window.CF = window.CF || {});
