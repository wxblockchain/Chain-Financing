/* ==========================================================================
   shell.js — Chain Financing 原型公共运行时（唯一来源）
   两个端、所有模块共用：i18n、状态、路由与 URL 同步、侧栏与面包屑、
   顶栏工具区、Toast、Modal / Drawer 宿主、PRD 面板、状态切换条、通用片段。

   模块只需要提供自己的页面、文案、演示数据与状态表，然后调用：
       CF.define({ ... });   CF.boot();
   模块不得重新实现本文件已有的任何能力，也不得重建导航或路由。

   模块接口（除 id / dict / content 外均可省略）
     id            模块标识，仅用于调试
     end           默认端别：admin（管理端） / asset（资产端） / ops（运营端画布）
     home          默认落地页 ID
     owns          本模块真正实现的 page ID 列表；不在其中的导航目标由 shell
                   统一渲染为归属指向页
     dict          { en:{}, zh:{} } 文案，合并进公共 DICT
     prd           { pageId: {...} } PRD 摘录
     states        { pageId: [[key,en,zh], ...] } 每页可切换的状态
     state()       返回模块自己的初始状态字段，与公共字段合并
     content()     app 版式的内容区 HTML
     focus()       focus 版式的整页 HTML
     modals        { type: fn } 弹窗表
     drawers       { name: fn } 抽屉表（prd 由 shell 提供，不要覆盖）
     account()     顶栏账户菜单的身份信息 { avatar, ident, ok, okText, badText }
     notify()      通知铃铛 C-20 / 快捷面板 C-21 的数据源。实现它的模块拿到带计数的角标与
                   快捷面板；不实现的模块仍有铃铛，但不渲染角标（不替模块编造未读数）。
                   返回 { unread:Number, phase:"loading"|"ready"|"error", items:[msgItem 结构] }
     notifyOpen(id) 面板内点击某条消息时由 shell 回调，模块自己决定路由到哪一页
     notifyRetry()  面板失败态点「重试」时由 shell 回调
     topExtra()    顶栏在 PRD 按钮之前追加的自定义按钮
     topbarPrd     置 false 表示 app 版式顶栏不放 PRD 按钮（模块在别处自己放）
     crumbParts()  面包屑当前级之前的可点击层级 [[文案, pageId], ...]
     prdKey()      PRD 取值键，缺省用当前 page
     prdFoot()     PRD 面板底部的口径说明（各模块指向自己的 PRD 文件）
     modalLocked(m) 返回 true 表示该弹窗不能被 Esc 关闭
     onGo(p) / onSetState(k) 导航与状态切换时模块自己的收尾
     hash          { build(), read() } 自定义 URL 方案；缺省用 #/<page>
     onAct(n,a,v)  模块自己的 data-act 处理，返回 true 表示已处理
     onInput(n,k)  模块自己的 input / change 处理
     afterRender() 每次渲染后的收尾（如重绘 canvas）
   ========================================================================== */
(function (CF) {
  "use strict";

  /* ------------------------------- 图标 ---------------------------------- */
  CF.ICO = {
    globe:'<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">'
       +'<circle cx="10" cy="10" r="7.3"/><path d="M2.7 10h14.6M10 2.7c1.9 2 2.9 4.6 2.9 7.3s-1 5.3-2.9 7.3c-1.9-2-2.9-4.6-2.9-7.3s1-5.3 2.9-7.3Z"/></svg>',
    caret:'<svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5.5 8l4.5 4.5L14.5 8"/></svg>',
    copy:'<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5">'
       +'<rect x="7" y="7" width="9.5" height="9.5" rx="2"/><path d="M13 4.5H5.5A2 2 0 0 0 3.5 6.5V14"/></svg>',
    ok:'<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4.5 10.5l3.5 3.5 7.5-8"/></svg>',
    warn:'<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 6v5M10 14h.01"/><circle cx="10" cy="10" r="7.3"/></svg>',
    info:'<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 9v5M10 6h.01"/><circle cx="10" cy="10" r="7.3"/></svg>',
    doc:'<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5">'
       +'<path d="M11.5 2.5H6A1.5 1.5 0 0 0 4.5 4v12A1.5 1.5 0 0 0 6 17.5h8a1.5 1.5 0 0 0 1.5-1.5V6.5Z"/>'
       +'<path d="M11.5 2.5v4h4M7.3 10.5h5.4M7.3 13.5h5.4"/></svg>',
    gear:'<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5">'
       +'<circle cx="10" cy="10" r="2.6"/><path d="M10 2.6v2M10 15.4v2M17.4 10h-2M4.6 10h-2M15.2 4.8l-1.4 1.4M6.2 13.8l-1.4 1.4M15.2 15.2l-1.4-1.4M6.2 6.2 4.8 4.8"/></svg>',
    up:'<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5">'
       +'<path d="M10 13.5V3.5M6.5 7 10 3.5 13.5 7M3.5 13v2.5A1.5 1.5 0 0 0 5 17h10a1.5 1.5 0 0 0 1.5-1.5V13"/></svg>',
    clock:'<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6">'
       +'<circle cx="10" cy="10" r="7.3"/><path d="M10 5.6V10l3 1.8"/></svg>',
    dl:'<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6">'
       +'<path d="M10 3.5v9M6.5 9 10 12.5 13.5 9M4 15.5h12"/></svg>',
    ext:'<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5">'
       +'<path d="M11 3.5h5.5V9M16.5 3.5 9 11"/><path d="M15 12v3.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 15.5v-9A1.5 1.5 0 0 1 4.5 5H8"/></svg>',
    eye:'<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6">'
       +'<path d="M1.7 10S4.7 4.6 10 4.6 18.3 10 18.3 10 15.3 15.4 10 15.4 1.7 10 1.7 10Z"/><circle cx="10" cy="10" r="2.6"/></svg>',
    eyeOff:'<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6">'
       +'<path d="M8 5c.6-.2 1.3-.3 2-.3 5.3 0 8.3 5.3 8.3 5.3a15 15 0 0 1-2.6 3.2M4.6 6.2A15 15 0 0 0 1.7 10S4.7 15.4 10 15.4c1.2 0 2.2-.3 3.2-.7"/><path d="M3 3l14 14"/></svg>',
    bell:'<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5">'
       +'<path d="M10 2.8a4.6 4.6 0 0 0-4.6 4.6c0 3.5-1.2 4.6-1.2 4.6h11.6s-1.2-1.1-1.2-4.6A4.6 4.6 0 0 0 10 2.8Z"/>'
       +'<path d="M8.6 15a1.6 1.6 0 0 0 2.8 0"/></svg>',
    lock:'<svg viewBox="0 0 20 20" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5">'
       +'<rect x="4" y="8.5" width="12" height="8" rx="2"/><path d="M6.8 8.5V6.4a3.2 3.2 0 0 1 6.4 0v2.1"/></svg>'
  };

  /* ------------------------- 公共文案（两端共用） ------------------------- */
  /* 侧栏菜单文案属于登记表，不属于任何单个模块，所以放在公共层；
     模块 dict 里的同名键仍可覆盖。 */
  CF.DICT = {
    en: { stateSwitch:"Prototype · state", prdOpen:"PRD excerpt", close:"Close",
          adminConsole:"Console", opsConsole:"Operations", grpMenu:"Menu",
          navAgreements:"Agreements", navUserManagement:"User management",
          navIdentityReviews:"Identity reviews", navBusinessReviews:"Business reviews", navAccount:"Account settings",
          navOverview:"Overview", navUserCenter:"User center",
          navTokenManagement:"Token Management", navSmartContracts:"Smart Contracts",
          navReceivableGroup:"Receivables", navReceivables:"My receivables",
          navConfirmReceivables:"Receivable confirmation",
          navReceivableAdmin:"Receivables",
          navDataSync:"Data sync", navDataSyncAssets:"Push confirmed assets", navDataSyncBatches:"Push batches",
          navAssetInventory:"Asset inventory",
          accountSettings:"Account settings",
          ownedTitle:"Owned by another module",
          ownedBody:"This page is delivered by the {m} prototype. This module does not re-implement it.",
          goThere:"Open the {m} prototype",
          msgCenter:"Notifications", bellTitle:"Notifications",
          bellUnread:"Notifications · unread", bellRead:"Notifications",
          notifAria:"Notifications, {n} unread", notifAriaNone:"Notifications, no unread",
          notifViewAll:"View all", notifEmpty:"No notifications yet", notifFail:"Failed to load.",
          retry:"Retry", markRead:"Mark as read", expired:"Expired", loading:"Loading",
          extTitle:"Owned by another requirement",
          extBody:"This page belongs to the {m} module ({r}). This prototype only provides the entry point — the bell and the account menu item — and does not implement the page itself.",
          extNote:"Bell behaviour (quick panel, unread badge, read semantics) and the message list are defined by {r}." },
    zh: { stateSwitch:"原型 · 状态", prdOpen:"PRD 摘录", close:"关闭",
          adminConsole:"管理端", opsConsole:"运营端", grpMenu:"菜单",
          navAgreements:"协议管理", navUserManagement:"用户管理",
          navIdentityReviews:"个人认证审核", navBusinessReviews:"企业认证审核", navAccount:"账户设置",
          navOverview:"总览", navUserCenter:"用户中心",
          navTokenManagement:"代币管理", navSmartContracts:"智能合约",
          navReceivableGroup:"应收账款", navReceivables:"我的应收账款",
          navConfirmReceivables:"应收账款确权",
          navReceivableAdmin:"应收账款",
          navDataSync:"数据同步", navDataSyncAssets:"已确权资产推送", navDataSyncBatches:"推送记录",
          navAssetInventory:"资产清单",
          accountSettings:"账户设置",
          ownedTitle:"本页归其他模块",
          ownedBody:"本页由「{m}」原型交付，本模块不重复实现该页面。",
          goThere:"打开「{m}」原型",
          msgCenter:"消息中心", bellTitle:"通知",
          bellUnread:"通知 · 有未读", bellRead:"通知",
          notifAria:"通知，{n} 条未读", notifAriaNone:"通知，无未读",
          notifViewAll:"查看全部", notifEmpty:"暂无消息", notifFail:"加载失败。",
          retry:"重试", markRead:"标为已读", expired:"已过期", loading:"加载中",
          extTitle:"本页归其他需求",
          extBody:"本页归「{m}」模块（{r}），本原型只负责入口位置与承载——顶栏铃铛与账号下拉里的「消息中心」——页面本身不在本模块实现。",
          extNote:"铃铛的形态与行为（快捷面板、未读角标、已读语义）以及消息列表均由 {r} 定义。" }
  };
  CF.PRD = {};
  CF.STATES = {};

  var M = null;                                   /* 当前模块 */
  var S = null;                                   /* 全局状态 */
  var tid = 0;
  var lastHash = "";

  /* ------------------------------ 基础工具 ------------------------------- */
  function t(k, v) {
    var d = CF.DICT[S.lang] || CF.DICT.en, s = d[k];
    if (s === undefined) s = CF.DICT.en[k];
    if (s === undefined) return "";
    if (v) for (var p in v) s = s.split("{" + p + "}").join(v[p]);
    return s;
  }
  function L(en, zh) { return S.lang === "en" ? en : zh; }
  function esc(x) {
    return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function q(sel) { return document.querySelector(sel); }
  function gap(h) { return '<div style="height:' + (h || 14) + 'px"></div>'; }
  function md(x) {
    return esc(x).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
                 .replace(/`([^`]+)`/g, '<code class="mono">$1</code>');
  }
  function tzOff() {
    return S.tz === "UTC" ? 0 : (S.tz === "America/New_York" ? -4 : (S.tz === "Europe/London" ? 1 : 8));
  }
  /* 空值一律显示为「—」；需要「此刻」的场景显式调用 fmtNow()。 */
  function fmtTime(iso, sec) {
    if (!iso) return "—";
    var off = tzOff(), x = new Date(new Date(iso).getTime() + off * 3600000);
    var MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var Y = x.getUTCFullYear(), m = x.getUTCMonth(), D = x.getUTCDate(),
        h = ("0" + x.getUTCHours()).slice(-2), mi = ("0" + x.getUTCMinutes()).slice(-2),
        s2 = ("0" + x.getUTCSeconds()).slice(-2);
    var date = S.lang === "en" ? (MO[m] + " " + D + ", " + Y)
                               : (Y + "-" + ("0" + (m + 1)).slice(-2) + "-" + ("0" + D).slice(-2));
    return date + (S.lang === "en" ? ", " : " ") + h + ":" + mi + (sec ? ":" + s2 : "")
         + " (UTC" + (off >= 0 ? "+" : "") + off + ")";
  }
  function fmtNow(sec) { return fmtTime(new Date().toISOString(), sec); }
  function fmtDate(iso) {
    if (!iso) return "—";
    var x = new Date(new Date(iso).getTime() + tzOff() * 3600000);
    return x.getUTCFullYear() + "-" + ("0" + (x.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + x.getUTCDate()).slice(-2);
  }
  /* 列表时间：24 小时内相对时间，超过则绝对时间（WS-302 13.4 / WS-304 12.4）。
     nowIso 由模块传入，保证演示数据的时间口径稳定可复现。 */
  function fmtRel(iso, nowIso) {
    if (!iso) return "—";
    var now = nowIso ? Date.parse(nowIso) : Date.now();
    var d = now - Date.parse(iso);
    if (d < 0) d = 0;
    if (d >= 86400000) return fmtTime(iso);
    var mi = Math.floor(d / 60000), h = Math.floor(d / 3600000);
    if (mi < 1) return S.lang === "en" ? "Just now" : "刚刚";
    if (mi < 60) return S.lang === "en" ? (mi + (mi === 1 ? " min ago" : " mins ago")) : (mi + " 分钟前");
    return S.lang === "en" ? (h + (h === 1 ? " hour ago" : " hours ago")) : (h + " 小时前");
  }
  function isoToLocalInput(iso) {
    if (!iso) return "";
    var x = new Date(new Date(iso).getTime() + tzOff() * 3600000);
    return x.getUTCFullYear() + "-" + ("0" + (x.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + x.getUTCDate()).slice(-2)
      + "T" + ("0" + x.getUTCHours()).slice(-2) + ":" + ("0" + x.getUTCMinutes()).slice(-2);
  }
  function localInputToIso(v) {
    if (!v) return null;
    return new Date(Date.parse(v + ":00Z") - tzOff() * 3600000).toISOString();
  }

  /* ------------------------------ 通用片段 ------------------------------- */
  /* role 可显式指定；未指定时红色提示自动取 alert，保证错误一定会被读屏播报。 */
  function note(kind, body, title, role) {
    var r = role || (kind === "red" ? "alert" : "");
    var ic = kind === "red" || kind === "amber" ? CF.ICO.warn : kind === "green" ? CF.ICO.ok : CF.ICO.info;
    return '<div class="note' + (kind ? " " + kind : "") + '"' + (r ? ' role="' + r + '"' : "")
      + '><span class="ico">' + ic + '</span><div>'
      + (title ? "<b>" + title + "</b>" : "") + body + "</div></div>";
  }
  function stateBar(list, act, cur, style) {
    if (!list || list.length < 2) return "";
    return '<div class="statebar"' + (style ? ' style="' + style + '"' : "") + '>'
      + '<span class="pill dash">' + t("stateSwitch") + "</span>"
      + '<div class="seg">' + list.map(function (x) {
          return '<button type="button" data-act="' + act + '" data-v="' + x[0] + '" aria-pressed="'
            + (cur === x[0]) + '">' + L(x[1], x[2]) + "</button>";
        }).join("") + "</div></div>";
  }
  function pageStates() { return stateBar(CF.STATES[S.page], "st", S.st); }
  function pageHead(title, desc, actions) {
    return '<div class="page-head"><div><h1 class="page-title">' + title + "</h1>"
      + (desc ? '<p class="page-desc">' + desc + "</p>" : "") + "</div>"
      + '<div class="page-actions">' + (actions || "") + "</div></div>" + pageStates();
  }

  /* --------------------- 消息列表项 C-22（列表与快捷面板共用） --------------- */
  /* 进度节点四态 → pill 变体。四态是封闭枚举（WS-304 7.8.2），标签始终带文本，
     不以颜色为唯一提示。两处渲染共用这张表，避免两端各造一套颜色语义。 */
  CF.NODE_PILL = { in_progress:"gray", action_required:"amber", succeeded:"green", failed:"red" };

  /* m: { id, catLabel, title, summary, timeText, timeTitle, unread, expired,
          node:{ text, status, label } }
     o: { act, compact, markable, markAct, current } */
  function msgItem(m, o) {
    o = o || {};
    var cls = "msg" + (m.unread ? " unread" : " read") + (m.expired ? " expired" : "")
            + (o.compact ? " compact" : "") + (o.current ? " current" : "");
    var np = m.node ? (CF.NODE_PILL[m.node.status] || "gray") : "";
    var body =
      '<span class="ud"' + (m.unread ? "" : ' aria-hidden="true"') + '></span>'
      + '<span class="msg-bd">'
      + '<span class="msg-top">'
      + (m.catLabel ? '<span class="tag">' + esc(m.catLabel) + "</span>" : "")
      + '<span class="msg-ti">' + esc(m.title) + "</span>"
      + (m.expired ? '<span class="pill dash">' + t("expired") + "</span>" : "")
      + "</span>"
      + (m.node ? '<span class="msg-node"><span class="nt">' + esc(m.node.text) + "</span>"
                  + '<span class="pill ' + np + '">' + esc(m.node.label) + "</span></span>" : "")
      + (m.summary ? '<span class="msg-sum">' + esc(m.summary) + "</span>" : "")
      + "</span>";
    return '<li class="' + cls + '">'
      + '<button class="msg-hit" type="button" data-act="' + (o.act || "notifyGo") + '" data-v="' + esc(m.id) + '">'
      + body + "</button>"
      + '<span class="msg-side">'
      + '<span class="msg-tm mono"' + (m.timeTitle ? ' title="' + esc(m.timeTitle) + '"' : "") + ">"
      + esc(m.timeText) + "</span>"
      + (o.markable && m.unread
          ? '<button class="actlink" type="button" data-act="' + (o.markAct || "markRead")
            + '" data-v="' + esc(m.id) + '">' + t("markRead") + "</button>"
          : "")
      + "</span></li>";
  }

  /* ------------------- 通知铃铛 C-20 与快捷面板 C-21 ---------------------- */
  /* 带计数角标与快捷面板的完整形态，只在模块实现了 notify() 时渲染；
     其余模块由 bellBtn() 渲染成不带角标的入口，见下。 */
  function notifyBell() {
    var d = M.notify() || {}, n = d.unread || 0, open = S.menu === "bell";
    var cap = (CF.NOTIFY_CAP || 99);
    var label = n > 0 ? t("notifAria", { n: n > cap ? cap + "+" : n }) : t("notifAriaNone");
    return '<div class="dd">'
      /* data-f 让 Esc 关闭面板、重渲染后焦点回到铃铛本身 */
      + '<button class="bell" type="button" data-f="bell" data-act="menu" data-v="bell" aria-expanded="' + open + '"'
      + ' aria-label="' + esc(label) + '" title="' + esc(t("msgCenter")) + '">' + CF.ICO.bell
      /* 无未读时不渲染角标，也不展示 0 */
      + (n > 0 ? '<span class="bdg" aria-hidden="true">' + (n > cap ? cap + "+" : n) + "</span>" : "")
      + "</button>"
      /* 角标数值变化由 polite 活动区播报，不抢占焦点（WS-304 7.1.1） */
      + '<span class="sr-only" aria-live="polite">' + esc(label) + "</span>"
      + (open ? notifyPanel(d) : "") + "</div>";
  }
  function notifyPanel(d) {
    var body;
    if (d.phase === "loading") {
      body = '<div role="status" aria-live="polite" aria-label="' + t("loading") + '">'
        + '<div class="skel-row"><div class="skel m"></div><div class="skel s"></div></div>'
        + '<div class="skel-row"><div class="skel"></div><div class="skel s"></div></div>'
        + '<div class="skel-row"><div class="skel m"></div><div class="skel s"></div></div></div>';
    } else if (d.phase === "error") {
      body = '<div class="panel-msg" role="alert"><p>' + t("notifFail") + "</p>"
        + '<button class="btn sm" type="button" data-act="notifyRetry">' + t("retry") + "</button></div>";
    } else if (!(d.items || []).length) {
      body = '<div class="panel-msg"><span class="panel-ico">' + CF.ICO.bell + "</span><p>" + t("notifEmpty") + "</p></div>";
    } else {
      body = '<ul class="msgs">' + d.items.map(function (m) {
        return msgItem(m, { act: "notifyGo", compact: true });
      }).join("") + "</ul>";
    }
    return '<div class="dd-list panel" role="dialog" aria-label="' + esc(t("msgCenter")) + '">'
      + '<div class="panel-h"><b>' + t("msgCenter") + "</b>"
      + '<button class="modal-x" type="button" data-act="menu" data-v="bell" aria-label="' + t("close") + '">✕</button></div>'
      + '<div class="panel-b">' + body + "</div>"
      + '<div class="panel-f"><button class="btn sm block" type="button" data-act="notifyAll">'
      + t("notifViewAll") + "</button></div></div>";
  }

  /* ------------------------------- Toast --------------------------------- */
  function toast(kind, title, body) {
    if (S.toasts.filter(function (x) { return x.title === title; })[0]) return;   /* 去重 */
    var id = ++tid;
    if (S.toasts.length >= 3) S.toasts.shift();
    S.toasts.push({ id: id, kind: kind, title: title, body: body || "" });
    render();
    setTimeout(function () {
      S.toasts = S.toasts.filter(function (x) { return x.id !== id; }); render();
    }, kind === "danger" ? 5000 : 3000);
  }
  function renderToasts() {
    if (!S.toasts.length) return "";
    return '<div class="toasts" role="region" aria-live="polite">' + S.toasts.map(function (x) {
      return '<div class="toast ' + x.kind + '"><span class="ico">'
        + (x.kind === "danger" ? CF.ICO.warn : x.kind === "success" ? CF.ICO.ok : CF.ICO.info) + "</span>"
        + '<div class="tx"><b>' + esc(x.title) + "</b>" + (x.body ? "<span>" + esc(x.body) + "</span>" : "") + "</div>"
        + '<button class="cl" type="button" data-act="toastClose" data-i="' + x.id + '" aria-label="'
        + t("close") + '">✕</button></div>';
    }).join("") + "</div>";
  }

  /* ---------------------------- 顶栏工具区 -------------------------------- */
  function langSwitcher() {
    var open = S.menu === "lang";
    return '<div class="dd"><button class="dd-btn" type="button" data-act="menu" data-v="lang" aria-expanded="' + open + '">'
      + CF.ICO.globe + "<span>" + L("EN", "中文") + "</span>" + CF.ICO.caret + "</button>"
      + (open ? '<div class="dd-list" role="menu">'
        + '<button type="button" role="menuitem" data-act="lang" data-v="en" aria-current="' + (S.lang === "en") + '">English</button>'
        + '<button type="button" role="menuitem" data-act="lang" data-v="zh" aria-current="' + (S.lang === "zh") + '">简体中文</button>'
        + "</div>" : "") + "</div>";
  }
  /* C-20 通知铃铛：顶栏内、语言切换器左侧，双端通用。
     只表现「有未读 / 无未读」两种样子；点击进入消息中心（页面归 WS-304）。 */
  function msgPage() { return (CF.MSG_PAGE || {})[S.end] || null; }
  function bellBtn() {
    var id = msgPage(); if (!id) return "";
    if (M.notify) return notifyBell(id);
    /* 没有数据源的模块：保留铃铛的位置与形态，但**不渲染角标**——
       公共层不替模块编造未读数。点它按跨文件规则直接落到消息通知原型。 */
    var href = crossHref(id);
    var body = CF.ICO.bell;
    if (href) return '<a class="bell" href="' + esc(href) + '" aria-label="' + t("bellRead")
      + '" title="' + t("bellTitle") + '">' + body + "</a>";
    return '<button class="bell" type="button" data-act="go" data-v="' + id + '" aria-label="'
      + t("bellRead") + '" title="' + t("bellTitle") + '">' + body + "</button>";
  }
  function accountMenu() {
    if (!M.account) return "";
    var a = M.account(), open = S.menu === "acc";
    return '<div class="dd"><button class="dd-btn acc" type="button" data-act="menu" data-v="acc" aria-expanded="' + open + '">'
      + '<span class="av">' + esc(a.avatar) + '</span><span class="nm">' + esc(a.ident) + "</span>" + CF.ICO.caret + "</button>"
      + (open ? '<div class="dd-list wide" role="menu">'
        + '<div class="dd-head"><b>' + esc(a.ident) + "</b>"
        + '<span class="pill ' + (a.ok ? "green" : "amber") + '">' + (a.ok ? a.okText : a.badText) + "</span></div>"
        + notifyMenuItem()
        + (!a.settings ? "" : crossHref(a.settings)
            ? '<a role="menuitem" href="' + esc(crossHref(a.settings)) + '">' + t("accountSettings") + "</a>"
            : '<button type="button" role="menuitem" data-act="go" data-v="' + a.settings + '">' + t("accountSettings") + "</button>")
        + '<button type="button" role="menuitem" data-act="' + (a.signOutPage ? "go" : "signout") + '"'
        + (a.signOutPage ? ' data-v="' + a.signOutPage + '"' : "") + ">" + t("signOut") + "</button>"
        + "</div>" : "") + "</div>";
  }
  function notifyMenuItem() {
    var id = msgPage();
    if (!id || !CF.PAGES[id]) return "";
    var href = crossHref(id);
    return href
      ? '<a role="menuitem" href="' + esc(href) + '">' + t("msgCenter") + "</a>"
      : '<button type="button" role="menuitem" data-act="go" data-v="' + id + '">' + t("msgCenter") + "</button>";
  }
  function prdKey() { return M.prdKey ? M.prdKey() : S.page; }
  function prdBtn() {
    if (!CF.PRD[prdKey()]) return "";
    return '<button class="btn sm" type="button" data-act="openPrd" title="' + t("prdOpen") + '">'
      + '<span class="mono" style="font-size:10px">PRD</span></button>';
  }

  /* ------------------------------ 侧栏导航 -------------------------------- */
  /* 目标页不在本文件里时，返回指向对方原型文件的相对地址；否则返回 null。 */
  function crossHref(id) {
    if ((M.owns || []).indexOf(id) >= 0) return null;
    var mod = CF.MODULES[CF.OWNER[id]];
    if (!mod) return null;
    return "../" + mod.dir + "/" + mod.file + (CF.ENTRY[id] || "#/" + id.toLowerCase());
  }

  function renderNav() {
    var end = S.end || "admin";
    var ids = CF.NAV[end] || [];
    var cur = CF.PAGES[S.page] || {};
    var head = '<div class="nav-label">'
      + t(end === "admin" ? "adminConsole" : end === "ops" ? "opsConsole" : "grpMenu") + "</div>";
    function item(id, sub) {
      var r = CF.PAGES[id] || {};
      var on = cur.nav === id;
      var ico = r.icoKey ? CF.ICO[r.icoKey] : (r.ico || "");
      var body = (sub ? "" : '<span class="nav-ico">' + ico + "</span>") + "<span>" + t(r.navKey) + "</span>";
      var href = crossHref(id);
      /* 跨文件用真链接，点一下直接到对方原型的对应页面，不停在占位页 */
      if (href) {
        return '<a class="nav-item' + (sub ? " nav-subitem" : "") + '" href="' + esc(href) + '">' + body + "</a>";
      }
      return '<button class="nav-item' + (sub ? " nav-subitem" : "") + (on ? " active" : "") + '" type="button" data-act="go" data-v="' + id + '"'
        + (on ? ' aria-current="page"' : "") + ">" + body + "</button>";
    }
    return head + ids.map(function (entry) {
      if (typeof entry === "string") return item(entry, false);
      var children = entry.children || [], on = children.indexOf(cur.nav) >= 0;
      var ico = entry.icoKey ? CF.ICO[entry.icoKey] : (entry.ico || "");
      return '<div class="nav-group' + (on ? " active" : "") + '"><div class="nav-parent">'
        + '<span class="nav-ico">' + ico + "</span><span>" + t(entry.navKey) + "</span>"
        + '<span class="nav-caret" aria-hidden="true">' + CF.ICO.caret + "</span></div>"
        + '<div class="nav-children">' + children.map(function (id) { return item(id, true); }).join("") + "</div></div>";
    }).join("");
  }
  function renderCrumb() {
    var r = CF.PAGES[S.page] || {};
    var cur = r.crumb ? r.crumb[S.lang === "en" ? 0 : 1] : (r.name ? r.name[S.lang === "en" ? 0 : 1] : S.page);
    if (M.crumbCur) { var c = M.crumbCur(); if (c != null) cur = c; }
    var parts = M.crumbParts ? (M.crumbParts() || []) : [];
    var html = parts.map(function (p) {
      return '<button class="crumb-link" type="button" data-act="crumb" data-v="' + p[1] + '"'
        + ' data-k="' + esc(p[2] == null ? "" : p[2]) + '">' + esc(p[0]) + "</button>"
        + '<span class="sep">/</span>';
    }).join("");
    return html + '<span class="crumb-cur">' + esc(cur) + "</span>";
  }

  /* 直接用 URL 落到不属于本文件的页面时的兜底页：说明归属，并给出跳转入口。
     正常从侧栏点击不会走到这里——那条路径是直接跨文件跳转的。 */
  function ownedElsewhere(id) {
    var ext = (CF.EXTERNAL || {})[id];
    if (ext) {
      var r0 = CF.PAGES[id] || {};
      var mn = ext.name[S.lang === "en" ? 0 : 1];
      return pageHead(r0.name ? r0.name[S.lang === "en" ? 0 : 1] : id, "", "")
        + '<div class="card"><div class="card-b shell">' + CF.ICO.info
        + "<p><b>" + t("extTitle") + "</b><br>" + t("extBody", { m: mn, r: ext.req }) + "</p>"
        + '<p class="tiny">' + t("extNote", { r: ext.req }) + "</p>"
        + '<span class="pill dash">' + esc(ext.req) + " · " + esc(id) + "</span></div></div>";
    }
    var mod = CF.MODULES[CF.OWNER[id]];
    var label = mod ? mod.name[S.lang === "en" ? 0 : 1] : "";
    var r = CF.PAGES[id] || {};
    var href = crossHref(id);
    return pageHead(t(r.navKey || "") || (r.name ? r.name[S.lang === "en" ? 0 : 1] : id), "", "")
      + '<div class="card"><div class="card-b shell">' + CF.ICO.info
      + "<p><b>" + t("ownedTitle") + "</b><br>" + t("ownedBody", { m: label }) + "</p>"
      + (href ? '<a class="btn primary" href="' + esc(href) + '">' + t("goThere", { m: label }) + "</a>"
              : '<span class="pill dash">' + esc(id) + "</span>")
      + "</div></div>";
  }

  /* ------------------------------ Modal / Drawer -------------------------- */
  function renderModal() {
    var m = S.modal; if (!m) return "";
    var fn = (M.modals || {})[m.type];
    return fn ? fn() : "";
  }
  function renderDrawer() {
    if (!S.drawer) return "";
    var body = S.drawer === "prd" ? drawerPrd() : ((M.drawers || {})[S.drawer] || function () { return ""; })();
    return '<div class="drawer-scrim" data-act="closeDrawer"></div>' + body;
  }
  function drawerPrd() {
    var d = CF.PRD[prdKey()];
    if (!d) return '<aside class="drawer prd"><div class="drawer-h"><b>PRD</b>'
      + '<button class="modal-x" type="button" data-act="closeDrawer" aria-label="' + t("close") + '">✕</button></div>'
      + '<div class="drawer-b"><p class="tiny">' + L("No dedicated PRD excerpt for this page.", "本页无独立 PRD 摘录。") + "</p></div></aside>";
    function sec(label, items, n, open) {
      if (!n) return "";
      return '<details class="prd-sec"' + (open ? " open" : "") + '><summary><span class="caret">▸</span>' + label
        + '<span class="cnt">' + n + "</span></summary><div class=\"bd\">" + items + "</div></details>";
    }
    function rows(arr, meta) {
      return (arr || []).map(function (x) {
        return '<div class="prd-item"><div class="k">' + esc(x[0])
          + (meta ? '<span class="meta">' + esc(x[1]) + "</span>" : "")
          + '</div><div class="v">' + md(meta ? x[2] : x[1]) + "</div></div>";
      }).join("");
    }
    var c = (d.copy || []).map(function (x) {
      return '<div class="prd-copy"><span class="sc">' + esc(x[0]) + '</span><span class="en">EN&nbsp;&nbsp;' + esc(x[1]) + "</span>"
        + '<span class="zh">中文&nbsp;&nbsp;' + esc(x[2]) + "</span></div>";
    }).join("");
    return '<aside class="drawer prd" role="complementary" aria-label="PRD">'
      + '<div class="drawer-h"><b>PRD · ' + esc(d.title) + "</b>"
      + '<button class="modal-x" type="button" data-act="closeDrawer" aria-label="' + t("close") + '">✕</button></div>'
      + '<div class="drawer-b"><div class="prd-src">' + esc(d.src) + "</div>"
      + sec("① 字段与校验规则", rows(d.fields, true), (d.fields || []).length, true)
      + sec("② 关键业务规则", rows(d.rules), (d.rules || []).length, true)
      + sec("③ 状态与异常分支", rows(d.states), (d.states || []).length, false)
      + sec("④ 中英双语文案", c, (d.copy || []).length, false)
      + '<div class="prd-foot">' + (M.prdFoot ? M.prdFoot() : "") + "</div></div></aside>";
  }

  /* ------------------------------- 路由 ---------------------------------- */
  function defaultState(p) { var l = CF.STATES[p]; return l ? l[0][0] : "default"; }
  function go(page, st) {
    S.page = page; S.st = st || defaultState(page);
    S.menu = null; S.modal = null; S.drawer = null;
    if (M.onGo) M.onGo(page);
    render(); syncURL();
    window.scrollTo(0, 0);
  }
  function setState(k) {
    S.st = k; S.menu = null;
    if (M.onSetState) M.onSetState(k);
    render(); syncURL();
  }
  function defaultHash() {
    return "#/" + S.page.toLowerCase() + (S.st && S.st !== defaultState(S.page) ? "?st=" + S.st : "");
  }
  function buildHash() {
    /* 外部需求的占位页不进模块自定义 URL 方案：模块不认识这些 ID，
       让它们统一走默认 #/<page-id>，深链与刷新才不会掉回模块首页。 */
    if ((CF.EXTERNAL || {})[S.page]) return defaultHash();
    if (M.hash && M.hash.build) return M.hash.build();
    return defaultHash();
  }
  function syncURL() {
    var h = buildHash();
    if (h === location.hash) return;
    lastHash = h;
    try { history.pushState(null, "", h); } catch (e) { location.hash = h; }
  }
  function readURL() {
    var h0 = (location.hash || "").replace(/^#\/?/, "").split("?")[0].toUpperCase();
    if (!(CF.EXTERNAL || {})[h0] && M.hash && M.hash.read) return M.hash.read();
    var h = location.hash || ""; if (!h) return false;
    var parts = h.replace(/^#\/?/, "").split("?"), id = (parts[0] || "").toUpperCase(), qs = {};
    (parts[1] || "").split("&").forEach(function (kv) {
      if (!kv) return; var i = kv.indexOf("="); qs[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1));
    });
    if (!CF.PAGES[id]) return false;
    S.page = id;
    S.st = qs.st && (CF.STATES[id] || []).some(function (x) { return x[0] === qs.st; }) ? qs.st : defaultState(id);
    return true;
  }

  /* ------------------------------- 渲染 ---------------------------------- */
  function render() {
    var el = document.activeElement;
    var fk = el && el.getAttribute ? el.getAttribute("data-f") : null;
    var sel = null; try { sel = el && el.selectionStart; } catch (e) {}

    var r = CF.PAGES[S.page] || { end: M.end || "admin", layout: "app" };
    S.end = r.end;

    /* 外部占位页（消息中心）的状态归一化与铃铛角标联动。
       放在 render 里而不是 setState 里：模块可以有自己的 go / setState，
       但两者最终都会调 render，这样在任何模块里表现都一致。 */
    var ext = (CF.EXTERNAL || {})[S.page];
    if (ext) {
      var sts = (CF.STATES[S.page] || []).map(function (x) { return x[0]; });
      if (sts.indexOf(S.st) < 0) S.st = sts[0];
      S.unread = (S.st === "unread");
    }
    document.documentElement.setAttribute("data-end", r.end);

    var isFocus = r.layout === "focus";
    var focusHost = q("#focus");
    if (focusHost) { focusHost.hidden = !isFocus; }
    q("#app").hidden = isFocus;

    if (isFocus) {
      if (focusHost) focusHost.innerHTML = M.focus ? M.focus() : "";
      q("#nav").innerHTML = ""; q("#topRight").innerHTML = "";
      q("#content").innerHTML = ""; q("#crumb").innerHTML = "";
    } else {
      if (focusHost) focusHost.innerHTML = "";
      q("#brandSub").textContent = r.end === "admin" ? t("adminConsole")
                                 : r.end === "ops" ? t("opsConsole") : "";
      q("#nav").innerHTML = renderNav();
      q("#crumb").innerHTML = renderCrumb();
      q("#topRight").innerHTML = (M.topExtra ? M.topExtra() : "")
        + (M.topbarPrd === false ? "" : prdBtn()) + bellBtn() + langSwitcher() + accountMenu();
      var owns = M.owns || [];
      q("#content").innerHTML = owns.indexOf(S.page) < 0 ? ownedElsewhere(S.page) : M.content();
    }
    q("#layers").innerHTML = renderToasts() + renderModal() + renderDrawer();

    if (M.afterRender) M.afterRender();
    if (fk) {
      var n = q('[data-f="' + fk + '"]');
      if (n && n.focus) {
        n.focus();
        try { if (sel != null && n.setSelectionRange) n.setSelectionRange(sel, sel); } catch (e2) {}
      }
    }
  }

  /* ---------------------------- 事件委托 --------------------------------- */
  function wire() {
    document.addEventListener("click", function (e) {
      var n = e.target.closest("[data-act]");
      /* 点击空白关闭下拉 */
      if (!n) {
        if (S.menu && !e.target.closest(".dd-list")) { S.menu = null; render(); }
        return;
      }
      var a = n.getAttribute("data-act"), v = n.getAttribute("data-v");

      if (M.onAct && M.onAct(n, a, v, e) === true) return;

      if (a === "go" || a === "crumb") { go(v); return; }
      if (a === "st") { setState(v); return; }
      if (a === "lang") { S.lang = v; S.menu = null; render(); return; }
      if (a === "menu") { S.menu = S.menu === v ? null : v; render(); return; }
      /* 铃铛面板内的三个动作由公共层统一处理，模块只提供数据与落点 */
      if (a === "notifyGo") { S.menu = null; if (M.notifyOpen) M.notifyOpen(v); else render(); return; }
      if (a === "notifyRetry") { if (M.notifyRetry) M.notifyRetry(); else render(); return; }
      if (a === "notifyAll") {
        var np = msgPage();
        S.menu = null; if (np) go(np); else render();
        return;
      }
      if (a === "openPrd") { S.drawer = "prd"; S.menu = null; render(); return; }
      if (a === "closeDrawer") { S.drawer = null; render(); return; }
      if (a === "closeModal") { S.modal = null; render(); return; }
      if (a === "toastClose") {
        var id = parseInt(n.getAttribute("data-i"), 10);
        S.toasts = S.toasts.filter(function (x) { return x.id !== id; }); render(); return;
      }
      if (S.menu) { S.menu = null; render(); }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (S.modal) {
        if (M.modalLocked && M.modalLocked(S.modal)) return;   /* 模块可声明强制弹窗 */
        S.modal = null; render(); return;
      }
      if (S.drawer) { S.drawer = null; render(); return; }
      if (S.menu) { S.menu = null; render(); }
    });

    window.addEventListener("hashchange", function () {
      if (location.hash === lastHash) return;
      /* 记下这次是从 URL 进来的，否则「列表 →（手改 URL / 深链）详情 → 后退」会因为
         lastHash 停在列表地址而把后退整个吃掉，页面卡在详情上。 */
      lastHash = location.hash;
      if (readURL()) render();
    });
  }

  /* ------------------------------ 装配入口 -------------------------------- */
  CF.define = function (mod) {
    M = mod;
    ["en", "zh"].forEach(function (lang) {
      var src = (mod.dict || {})[lang] || {};
      for (var k in src) CF.DICT[lang][k] = src[k];
    });
    for (var p in (mod.prd || {})) CF.PRD[p] = mod.prd[p];
    for (var s in (mod.states || {})) CF.STATES[s] = mod.states[s];
  };

  CF.boot = function () {
    S = { lang: "en", tz: "Asia/Shanghai", end: M.end || "admin",
          page: M.home, st: "default", menu: null, modal: null, drawer: null, toasts: [],
          unread: true };
    var extra = M.state ? M.state() : {};
    for (var k in extra) S[k] = extra[k];
    S.st = defaultState(S.page);
    CF.S = S;
    if (M.onBoot) M.onBoot(S);              /* 模块拿到同一个 state 引用 */
    wire();
    if (!readURL()) syncURL();
    render();
  };

  /* --------------------- 暴露给模块使用的公共能力 -------------------------- */
  CF.t = t; CF.L = L; CF.esc = esc; CF.q = q; CF.gap = gap; CF.md = md;
  CF.fmtTime = fmtTime; CF.fmtNow = fmtNow; CF.fmtDate = fmtDate;
  CF.isoToLocalInput = isoToLocalInput; CF.localInputToIso = localInputToIso; CF.tzOff = tzOff;
  CF.note = note; CF.pageHead = pageHead; CF.stateBar = stateBar; CF.pageStates = pageStates;
  CF.fmtRel = fmtRel; CF.msgItem = msgItem;
  CF.toast = toast; CF.go = go; CF.setState = setState; CF.render = render;
  CF.syncURL = syncURL; CF.defaultState = defaultState; CF.drawerPrd = drawerPrd;
  CF.langSwitcher = langSwitcher; CF.accountMenu = accountMenu; CF.prdBtn = prdBtn;
  CF.route = function () { return CF.PAGES[S.page] || {}; };
  CF.pageName = function (id) {
    var r = CF.PAGES[id];
    return r && r.name ? r.name[S.lang === "en" ? 0 : 1] : id;
  };
  CF.state = function () { return S; };

})(window.CF = window.CF || {});
