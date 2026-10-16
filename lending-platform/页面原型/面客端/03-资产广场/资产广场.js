/* ==========================================================================
   资产广场.js — 面客端 · 资产广场（已上架代币只读域）
   页面：P-F-AM-01 资产广场列表页 · P-F-AM-02 代币详情页
   本模块只提供自己的页面、文案、演示数据与状态；token、组件、整页骨架与运行时
   全部取 ../../_shared/，不重建导航、不覆盖公共组件。
   ========================================================================== */
(function (CF) {
  "use strict";

  var L = CF.L, esc = CF.esc, S = CF.S, AM = CF.AM;
  var LIST = "P-F-AM-01", DETAIL = "P-F-AM-02";

  /* ------------------------------------------------------------ 页面登记
     列表页已在 registry.portal.js 登记；详情页按登记表注释由本模块追加。
     详情页不进顶栏导航：它由列表行与外部分享链接带出。 */
  CF.PAGES[DETAIL] = { end: "asset", layout: "portal", crumbKey: "crumbToken", parent: LIST, auth: false };
  CF.ENTRY[DETAIL] = "/assets/" + AM.TOKENS[0].no;

  /* 可分享视图：条件 + 已加载条数 + 行锚点/偏移 + 内外滚动位置。
     不依赖会话缓存；滚动与追加 replace 当前历史项，条件变化新增历史项。 */
  function hashPath() { return location.hash.replace(/^#/, ""); }
  function isList() { return /^\/assets(\?|$)/.test(hashPath()); }
  var load = null, timer = 0, restoreFrame = 0, restoring = false;
  var intentFrame = 0, touchY = null, restoreListFocus = false, returnFocus = null;
  var failNext = false, demoLimit = 52, hits = [], marketView = "cards";
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  function number(value, fallback, max, precise) {
    var n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.min(max, precise ? n : Math.floor(n)) : fallback;
  }
  function readView() {
    var h = isList() ? hashPath() : CF.ENTRY[LIST] || "/assets";
    var q = new URLSearchParams(h.split("?")[1] || "");
    var v = { ts: "", kind: "", issuer: "", q: "", sort: "at", dir: "desc",
      loaded: 20, scroll: 0, outer: 0, anchor: "", offset: 0 };
    ["ts", "kind", "issuer", "q", "sort", "dir", "anchor"].forEach(function (key) {
      if (q.has(key)) v[key] = q.get(key);
    });
    if (["at", "val", "due"].indexOf(v.sort) < 0) v.sort = "at";
    if (v.dir !== "asc") v.dir = "desc";
    v.loaded = Math.min(AM.TOKENS.length, Math.max(20, Math.ceil(number(q.get("loaded") || 20, 20, AM.TOKENS.length) / 20) * 20));
    ["scroll", "outer"].forEach(function (key) { v[key] = number(q.get(key), 0, 1000000); });
    var offset = Number(q.get("offset"));
    v.offset = Number.isFinite(offset) ? Math.max(-1000000, Math.min(1000000, offset)) : 0;
    return v;
  }
  function viewHash(v) {
    var q = new URLSearchParams();
    ["ts", "kind", "issuer", "q"].forEach(function (key) { if (v[key]) q.set(key, v[key]); });
    if (v.sort !== "at" || v.dir !== "desc") { q.set("sort", v.sort); q.set("dir", v.dir); }
    if (v.loaded > 20) q.set("loaded", v.loaded);
    ["scroll", "outer", "offset"].forEach(function (key) { if (v[key]) q.set(key, key === "offset" ? Math.round(v[key] * 1000) / 1000 : Math.round(v[key])); });
    if (v.anchor) q.set("anchor", v.anchor);
    return "/assets" + (q.size ? "?" + q.toString() : "");
  }
  function replaceView(v) {
    var h = viewHash(v);
    history.replaceState(history.state, "", "#" + h);
    CF.ENTRY[LIST] = h;
  }
  function rememberPosition() {
    if (!isList() || restoring || !load || load.phase === "initial" || S.st !== "default") return;
    var box = document.getElementById("am-listbox");
    if (!box) return;
    var v = readView();
    v.loaded = load.shown; v.scroll = box.scrollTop; v.outer = window.scrollY;
    v.anchor = ""; v.offset = 0;
    var top = box.getBoundingClientRect().top;
    var row = Array.from(box.querySelectorAll("tbody tr")).find(function (r) { return r.getBoundingClientRect().bottom > top; });
    if (row) { v.anchor = row.getAttribute("data-v"); v.offset = top - row.getBoundingClientRect().top; }
    replaceView(v);
  }
  function cancelLoad() {
    clearTimeout(timer); timer = 0; load = null;
    cancelAnimationFrame(intentFrame); intentFrame = 0; touchY = null; restoreListFocus = false; returnFocus = null;
  }
  function syncEntry() {
    var h = hashPath();
    if (/^\/assets\/[^/?#]+(?:\?|$)/.test(h)) {
      CF.ENTRY[DETAIL] = h;
      var back = new URLSearchParams(h.split("?")[1] || "").get("return");
      if (back && /^\/assets(\?|$)/.test(back)) CF.ENTRY[LIST] = back;
    } else if (isList()) CF.ENTRY[LIST] = h;
  }
  function writeView(v) {
    rememberPosition(); cancelLoad();
    v.loaded = 20; v.scroll = v.outer = v.offset = 0; v.anchor = "";
    var h = viewHash(v), now = Date.now();
    hits.push(now); hits = hits.filter(function (t) { return now - t < 6000; });
    S.st = "default"; S.toTop = false;
    CF.ENTRY[LIST] = h;
    if (hashPath() !== h) location.hash = "#" + h;
    else CF.render();
  }
  function throttled() { return hits.length > 10; }
  function ensureLoad(v, total) {
    if (!load) {
      load = { shown: Math.min(v.loaded, total), total: total, phase: "initial" };
      var owner = load;
      timer = setTimeout(function () {
        timer = 0;
        if (load !== owner || !isList()) return;
        owner.phase = "idle"; CF.render();
      }, 450);
    }
    load.total = total;
    return load;
  }
  function appendBatch() {
    if (!isList() || !load || ["idle", "error"].indexOf(load.phase) < 0 || load.shown >= load.total || S.st !== "default") return;
    rememberPosition();
    var owner = load, failing = failNext;
    failNext = false; owner.phase = "append";
    renderBatch();
    timer = setTimeout(function () {
      timer = 0;
      if (load !== owner || !isList()) return;
      rememberPosition();
      owner.phase = failing ? "error" : "idle";
      if (!failing) owner.shown = Math.min(owner.total, owner.shown + CF.PAGE_SIZE);
      var v = readView(); v.loaded = owner.shown; replaceView(v);
      renderBatch();
    }, 600);
  }
  function renderBatch() {
    var box = document.getElementById("am-listbox");
    var foot = box && box.querySelector(".loadmore"), footHeight = foot ? foot.getBoundingClientRect().height : 0;
    restoreListFocus = !!box && (document.activeElement === box || !!box.querySelector(".loadmore :focus"));
    CF.render();
    // 加载提示不能缩短旧尾部，否则底部 scrollTop 会先被浏览器夹小。
    var nextFoot = document.querySelector("#am-listbox .loadmore");
    if (load && load.phase === "append" && nextFoot) nextFoot.style.minHeight = footHeight + "px";
  }
  function tail(total) {
    if (load.phase === "append") return '<div class="loadmore" role="status" aria-live="polite">' + L("Loading more…", "正在加载更多…") + '</div>';
    if (load.phase === "error") return '<div class="loadmore" role="alert">' + L("Could not load more. Your items are still here.", "加载失败，已显示内容保留。") +
      '<button class="btn" data-act="am-more" type="button">' + L("Retry", "重试") + '</button></div>';
    S.shown = load.shown;
    // 正常批次只由内嵌下滑触发；失败保留明确重试，不自动循环失败请求。
    /* 一条记录是一笔代币（可含多枚），计数单位用「笔」，不与数量单位「枚」混淆。 */
    if (load.shown >= total) return '<div class="loadmore done">' + L("End of list · " + total + (total === 1 ? " record" : " records"), "已到末尾 · 共 " + total + " 笔") + "</div>";
    return '<div class="loadmore" role="status">' + L("Scroll down to load more", "下滑自动加载更多") +
      '<span class="tiny">' + L("Showing " + load.shown + " of " + total + " records", "已显示 " + load.shown + " / " + total + " 笔") + '</span></div>';
  }
  /* 放大态的列表高度要扣掉顶栏；顶栏在窄屏会折行，所以按实际高度取值。 */
  function syncHead() {
    var head = document.querySelector("#portal .portal-head");
    if (head) document.documentElement.style.setProperty("--am-head", head.offsetHeight + "px");
  }
  window.addEventListener("resize", syncHead);
  function afterList(v) {
    syncHead();
    restoring = true; S.toTop = false;
    cancelAnimationFrame(restoreFrame);
    restoreFrame = requestAnimationFrame(function () {
      if (!isList()) { restoring = false; return; }
      var box = document.getElementById("am-listbox");
      if (box) {
        if (restoreListFocus) box.focus({ preventScroll: true });
        restoreListFocus = false;
        box.scrollTop = v.scroll;
        var row = Array.from(box.querySelectorAll("tbody tr")).find(function (r) { return r.getAttribute("data-v") === v.anchor; });
        if (row && v.scroll) {
          var rowTop = row.getBoundingClientRect().top - box.getBoundingClientRect().top;
          // 新链接保留完整行位于框顶下方时的负偏移；旧零偏移链接保留像素位置。
          if (v.offset || rowTop <= 0) box.scrollTop += rowTop + v.offset;
        }
      }
      window.scrollTo(0, v.outer);
      renderDemoExtras();
      restoreFrame = requestAnimationFrame(function () {
        restoring = false; restoreFrame = 0;
        if (box) {
          rememberPosition();
          // 先恢复范围与位置，再恢复键盘落点；不让 focus 把列表另滚到一处。
          if (returnFocus) {
            var origin = Array.from(box.querySelectorAll('tr[data-act="am-open"]')).find(function (r) { return r.dataset.v === returnFocus; });
            (origin || box).focus({ preventScroll: true });
            returnFocus = null;
          }
        }
      });
    });
  }
  function renderDemoExtras() {
    var panel = document.getElementById("demoPanel");
    if (!panel || document.getElementById("am-demo")) return;
    if (curTokenNo()) {
      panel.insertAdjacentHTML("beforeend", '<div class="grp" id="am-demo"><h5>' + L("Holders · fictional responses", "持有方 · 虚构响应") + '</h5>' +
        [["sample", L("Normal", "正常")], ["loading", L("Loading", "加载中")], ["error", L("Load failed", "读取失败")],
         ["empty", L("No holders", "持有方为空")], ["zero", L("Zero-balance addresses only", "只有零余额地址")],
         ["mismatch", L("Total ≠ token amount", "合计≠代币数量")], ["missing", L("Holder missing address", "持有方缺地址")],
         ["conflict", L("Pledge record mismatch", "质押记录核对不上")], ["unavailable", L("Unavailable", "资料不可用")]].map(function (x) {
          return '<button class="btn" data-act="am-holding-state" data-v="' + x[0] + '">' + x[1] + '</button>';
        }).join("") + '<h5>' + L("Open a sample", "打开样例") + '</h5>' +
        AM.SHOWCASE.map(function (no) { return '<button class="btn" data-act="am-holding-token" data-v="' + no + '">' + no + '</button>'; }).join("") + '</div>');
      return;
    }
    panel.insertAdjacentHTML("beforeend", '<div class="grp" id="am-demo"><h5>' + L("Asset list demonstration", "资产列表演示") + '</h5>' +
      '<button class="btn" data-act="am-fail">' + L("Fail next batch", "下一批失败") + '</button>' +
      [7, 20, 52].map(function (n) { return '<button class="btn" data-act="am-size" data-v="' + n + '">' + L(n + " sample records", n + " 笔样例") + '</button>'; }).join("") + '</div>');
  }
  function autoAppend(box) {
    if (!isList() || restoring || !box || box !== document.getElementById("am-listbox")) return;
    if (box.scrollHeight - box.clientHeight - box.scrollTop < 80 && load && load.phase === "idle") appendBatch();
  }
  // 恢复本身不追加；用户在已恢复的底部继续下滑，即使位置没变也能加载。
  function scrollIntent(e) {
    var box = e.target.closest && e.target.closest("#am-listbox");
    if (!box || intentFrame) return;
    intentFrame = requestAnimationFrame(function () { intentFrame = 0; autoAppend(box); });
  }
  document.addEventListener("wheel", function (e) { if (e.deltaY > 0) scrollIntent(e); }, { passive: true });
  document.addEventListener("keydown", function (e) {
    if (e.target.id === "am-listbox" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey &&
        ["ArrowDown", "PageDown", "End", " "].indexOf(e.key) >= 0) scrollIntent(e);
  });
  document.addEventListener("touchstart", function (e) {
    touchY = e.touches.length === 1 && e.target.closest("#am-listbox") ? e.touches[0].clientY : null;
  }, { passive: true });
  document.addEventListener("touchmove", function (e) {
    if (e.touches.length !== 1) { touchY = null; return; }
    var y = e.touches[0].clientY;
    if (touchY !== null && y < touchY) scrollIntent(e);
    touchY = y;
  }, { passive: true });
  document.addEventListener("scroll", function (e) {
    if (!isList() || restoring) return;
    var box = document.getElementById("am-listbox");
    var down = box && e.target === box && box.scrollTop > readView().scroll;
    rememberPosition();
    if (down) autoAppend(box);
  }, true);
  window.addEventListener("pagehide", rememberPosition);

  function hasFilter(v) { return !!(v.ts || v.kind || v.issuer || v.q); }
  function tokenNoFromPath(path) {
    var m = path.match(/^\/assets\/([^/?#]+)(?:\?|$)/);
    if (!m) return null;
    try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
  }
  function curTokenNo() { return tokenNoFromPath(hashPath()); }

  /* ------------------------------------------------------------ 文案 */
  var dict = {
    en: {
      navAssets: "Asset marketplace", navPlaza: "Lending marketplace",
      navConsole: "My console", crumbToken: "Token details"
    },
    zh: {
      navAssets: "资产广场", navPlaza: "借贷广场",
      navConsole: "我的控制台", crumbToken: "代币详情"
    }
  };

  function nm(pair) { return L(pair[0], pair[1]); }
  function issuerName(t) { return nm(AM.ISSUERS[t.issuer]); }
  function sellerName(t) { return nm(AM.SELLERS[t.seller]); }
  function buyerName(t) { return nm(AM.BUYERS[t.buyer]); }
  /* 代币名称未下发时展示合约名称，不自造符号。 */
  function tokenName(t) { return t.name || nm(AM.CONTRACT.name); }
  /* 代币标准与底层资产类型合并后的单一取值；本期配置表只有一行。 */
  function tokenKind() { return nm(AM.TOKEN_TYPE); }
  /* 代币标识图取上游配置的图片；演示数据用四种几何图形代替真实图片。
     未配置标识图时不造字母块或通用图标，只靠代币名称辨识；列表保留同宽空位让名称对齐。 */
  var LOGO = [
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="6.5"/></svg>',
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 4.5 19.5 18h-15L12 4.5Z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5" transform="rotate(45 12 12)"/></svg>',
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 6h5.2v5.2H6zM12.8 6H18v5.2h-5.2zM6 12.8h5.2V18H6zM12.8 12.8H18V18h-5.2z"/></svg>'
  ];
  function tokenLogo(t, cls) {
    if (!t.logo) return cls ? "" : '<span class="am-logo-slot" aria-hidden="true"></span>';
    return '<span class="tok-mark am-logo' + (cls ? " " + cls : "") + '" data-hue="' + t.logo.hue + '" role="img" aria-label="' +
      esc(tokenName(t)) + '">' + LOGO[t.logo.shape] + "</span>";
  }
  /* 时间统一为 yyyy-MM-dd HH:mm（用户时区，游客取浏览器时区）。
     列表只给日期与时刻、时区标在表头；详情每处时间后标时区。 */
  function stamp(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    try {
      var p = {};
      new Intl.DateTimeFormat("en-CA", { timeZone: S.tz, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
      return p.year + "-" + p.month + "-" + p.day + " " + (p.hour === "24" ? "00" : p.hour) + ":" + p.minute;
    } catch (e) { return CF.fmtTime(iso); }
  }
  function tzName() { return S.tz || "UTC"; }
  function stampTz(iso) { return '<span class="num">' + stamp(iso) + '</span> <span class="muted">(' + esc(tzName()) + ")</span>"; }
  function dash() { return '<span class="faint">—</span>'; }

  function tsTag(t) {
    return t.ts === "valid" ? CF.tag("ok", L("Valid", "有效")) : CF.tag("", L("Void", "失效"));
  }
  function tsWhy(t) {
    return t.ts === "valid"
      ? L("Underlying receivable falls due on " + t.to, "对应应收账款于 " + t.to + " 到期")
      : L("Underlying receivable matured on " + t.to, "对应应收账款已于 " + t.to + " 到期");
  }
  function shortHash(h) { return h ? h.slice(0, 10) + "…" + h.slice(-8) : ""; }

  function copyBtn(value, label) {
    return CF.copyBtn("copy", value, L("Copy ", "复制") + label, ' data-k="' + esc(label) + '"');
  }

  async function copyValue(value) {
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      CF.toast(L("Copied.", "已复制。"));
    } catch (e) {
      CF.toast(L("Couldn’t copy. Select the text and copy it manually.", "复制失败，请手动选择后复制。"));
    }
  }

  function cents(value) { return Math.round(value * 100); }
  function sum(rows, key) { return rows.reduce(function (n, t) { return n + cents(t[key]); }, 0) / 100; }
  function quantity(value) { return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  /* 详情里的金额统一为「币种图标 + 数字 + 小字号币种代码」；数量同样是「数字 + 小字号单位」，不带图标。 */
  function money(value, ccy) { return CF.market.amount(value, ccy, { icon: true }); }
  function qty(value) {
    return '<span class="mk-money am-qty"><span class="mk-money-number">' + quantity(value) +
      '</span><span class="mk-money-unit">' + L("tokens", "枚") + "</span></span>";
  }
  /* 持有方：代币发行平台给出当前全部持有方，借贷平台给出质押记录，两者按代币编号核对后逐个展示。
     默认就有数据；加载中、读取失败和各类核对不上的情形留在评审工具里切换。 */
  var holdingMode = "sample", holdingLoad = null, holdingTimer = 0;
  function resetHoldings() { clearTimeout(holdingTimer); holdingLoad = null; }
  var CONTRACTS = Object.keys(AM.PLEDGE_CONTRACT).map(function (k) { return AM.PLEDGE_CONTRACT[k].toLowerCase(); });
  /* 返回核对后的持有方行；任一项核对不上返回 null，整块按「持有方信息暂不可用」处理。 */
  function holderRows(t) {
    var rows = (AM.HOLDINGS[t.no] || []).map(function (r) { return Object.assign({}, r); });
    var pledges = (AM.PLEDGES[t.no] || []).map(function (r) { return Object.assign({}, r); });
    if (holdingMode === "unavailable") return null;
    if (holdingMode === "empty") rows = [];
    if (holdingMode === "zero") rows = rows.map(function (r) { return Object.assign(r, { qty: 0 }); });
    if (holdingMode === "mismatch" && rows.length) rows[rows.length - 1].qty = Math.round(rows[rows.length - 1].qty * 50) / 100;
    if (holdingMode === "missing" && rows.length) rows[0].address = "";
    if (holdingMode === "conflict") {
      if (pledges.length) pledges.pop();
      else if (rows.length) rows[0].address = AM.PLEDGE_CONTRACT[AM.PROJECTS[0].id];
    }
    var live = rows.filter(function (r) { return typeof r.qty === "number" && r.qty > 0; });
    if (!live.length || live.length !== rows.length) return null;
    var seen = {};
    for (var k = 0; k < rows.length; k++) {
      var a = String(rows[k].address || "").toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(a) || seen[a]) return null;
      seen[a] = true;
    }
    if (cents(sum(rows, "qty")) !== cents(t.qty)) return null;
    var out = [];
    for (k = 0; k < rows.length; k++) {
      var addr = rows[k].address.toLowerCase();
      var rec = pledges.filter(function (p) { return p.contract.toLowerCase() === addr; })[0];
      /* 合约地址持有却无质押记录，或有记录而合约不在持有方中，都核对不上。 */
      if (CONTRACTS.indexOf(addr) >= 0 && !rec) return null;
      var pledged = !!rec && (rec.state === "in" || rec.state === "exiting");
      out.push({ address: rows[k].address, qty: rows[k].qty,
        value: Math.round(rows[k].qty * t.val / t.qty * 100) / 100,
        pledged: pledged, project: pledged ? rec.project : null });
    }
    if (pledges.some(function (p) { return !seen[p.contract.toLowerCase()]; })) return null;
    /* 排列：持有数量从多到少，同量按地址，同一条件下顺序稳定。 */
    return out.sort(function (x, y) { return y.qty - x.qty || (x.address > y.address ? 1 : -1); });
  }
  function holdingTable(t) {
    var key = t.no + ":" + holdingMode;
    if (!holdingLoad || holdingLoad.key !== key) {
      resetHoldings(); holdingLoad = { key: key, phase: "loading" };
      if (holdingMode !== "loading") holdingTimer = setTimeout(function () {
        if (!holdingLoad || holdingLoad.key !== key || curTokenNo() !== t.no) return;
        holdingLoad.phase = "done";
        var y = scrollY; CF.render(); requestAnimationFrame(function () { window.scrollTo(0, y); });
      }, 400);
    }
    var title = L("Holders", "持有方"), body;
    if (holdingLoad.phase === "loading") body = '<div role="status" aria-live="polite">' + CF.skelTable(2) + '</div>';
    else if (holdingMode === "error") body = '<div role="alert">' + CF.empty(L("Could not load holders", "持有方信息加载失败"), "",
      '<button class="btn" data-act="am-holding-retry">' + L("Retry", "重试") + '</button>') + '</div>';
    else {
      var rows = holderRows(t);
      if (!rows) body = CF.empty(L("Holder information is temporarily unavailable", "持有方信息暂不可用"), "", "");
      else {
        var heads = [L("Holder", "持有方"), L("Holding amount", "持有数量"), L("Corresponding value", "对应价值"), L("Pledge status", "质押状态"), L("Financing project", "所属融资项目")];
        body = '<div class="tablewrap"><table class="tbl resp am-holdings"><thead><tr>' + heads.map(function (h) { return '<th scope="col">' + h + '</th>'; }).join("") + '</tr></thead><tbody>' +
          rows.map(function (r) {
            var project = !r.pledged ? dash() : !r.project.published ? '<span class="muted">' + L("Not public yet", "所属融资项目尚未公开") + "</span>" :
              '<a class="btn-link" href="#/project/' + esc(r.project.id) + '" data-act="am-project" data-v="' + esc(r.project.id) + '">' + esc(nm(r.project.name)) + '</a>';
            var values = ['<span class="copy-pair"><span class="mono am-address" title="' + esc(r.address) + '">' + esc(r.address.slice(0, 6) + "…" + r.address.slice(-4)) + '</span>' +
              CF.copyBtn("am-address-copy", r.address, L("Copy holder address", "复制持有方地址")) + '</span>',
              qty(r.qty), money(r.value, "USD"),
              CF.tag(r.pledged ? "accent" : "", r.pledged ? L("Pledged", "已质押") : L("Not pledged", "未质押")), project];
            return '<tr>' + values.map(function (v, i) { return '<td data-label="' + esc(heads[i]) + '"><div class="cell-wrap">' + v + '</div></td>'; }).join("") + '</tr>';
          }).join("") + '</tbody></table></div>';
      }
    }
    return '<section class="card am-sec" id="am-holdings"><div class="card-head"><h2>' + title + '</h2></div>' + body + '</section>';
  }

  /* 区块浏览器外链：唯一的新窗口；链接旁常驻未核验标注。 */
  function explorer(hash, chain) {
    return CF.linkOut((AM.EXPLORERS[chain || AM.CHAIN] || AM.EXPLORER_TX) + hash, L("Open block explorer", "在区块浏览器打开"));
  }
  function notVerified() {
    return '<p class="tiny am-caveat">' +
      L("Not verified by the platform; link provided for your own checking.",
        "平台未核验该交易，链接仅供自行查验。") + "</p>";
  }
  function hashRow(hash, chain) {
    if (!hash) return dash();
    return '<div class="am-hash"><span class="hash">' + esc(shortHash(hash)) + "</span>" +
      copyBtn(hash, L("Transaction hash", "交易哈希")) + explorer(hash, chain) + "</div>" + notVerified();
  }

  /* ------------------------------------------------------------ 筛选与排序 */
  /* 每个筛选项都可多选，URL 里按逗号串存；空串代表不限。 */
  function list(value) { return value ? String(value).split(",").filter(Boolean) : []; }
  function anyOf(value, candidate) { var l = list(value); return !l.length || l.indexOf(candidate) >= 0; }
  function match(t, v) {
    if (!anyOf(v.ts, t.ts)) return false;
    if (!anyOf(v.kind, "ar")) return false;
    if (!anyOf(v.issuer, String(t.issuer))) return false;
    if (v.q) {
      var k = v.q.trim().toLowerCase();
      var hay = [t.no, AM.ISSUERS[t.issuer][0], AM.ISSUERS[t.issuer][1], t.mintTx].join(" ").toLowerCase();
      if (hay.indexOf(k) < 0) return false;
    }
    return true;
  }
  function sortRows(list, v) {
    var dir = v.dir === "asc" ? 1 : -1;
    return list.sort(function (a, b) {
      var x = v.sort === "val" ? a.val : (v.sort === "due" ? a.to : a.at);
      var y = v.sort === "val" ? b.val : (v.sort === "due" ? b.to : b.at);
      if (x === y) return a.no > b.no ? 1 : -1;
      return x > y ? dir : -dir;
    });
  }

  function sortTh(key, label, cls, extra) {
    var v = readView(), cur = v.sort === key;
    var aria = cur ? (v.dir === "asc" ? "ascending" : "descending") : "none";
    return '<th class="sortable ' + (cls || "") + '" aria-sort="' + aria + '" scope="col">' +
      '<button type="button" data-act="am-sort" data-v="' + key + '">' + '<span class="am-th-l">' + esc(label) + (extra || "") + "</span>" +
      '<span class="ar" aria-hidden="true">' + (cur && v.dir === "asc" ? "↑" : "↓") + "</span></button></th>";
  }

  /* 排序：账期到期日不在列表信息项里，没有可点的表头，所以排序单独给一个控件，
     三种依据和方向都从这里选；两个可见列的表头按钮与它同步。 */
  var SORT_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' +
    '<path d="M4.6 2.8v10.4M2.4 10.8l2.2 2.4 2.2-2.4M11.4 13.2V2.8M9.2 5.2l2.2-2.4 2.2 2.4"/></svg>';
  function sortField(v) {
    var opts = [
      ["at:desc", L("Newest minted", "最新铸造")],
      ["at:asc", L("Oldest minted", "最早铸造")],
      ["val:desc", L("Value: high to low", "价值从高到低")],
      ["val:asc", L("Value: low to high", "价值从低到高")],
      ["due:asc", L("Due date: soonest", "到期日由近及远")],
      ["due:desc", L("Due date: latest", "到期日由远及近")]
    ];
    /* 排序图标已表明这是排序，选项不再加「排序：」前缀，给筛选行省出宽度。 */
    var cur = v.sort + ":" + v.dir, label = L("Sort", "排序");
    return '<span class="fb">' + SORT_ICON +
      '<select class="inp" id="am-sort" data-sort="1" aria-label="' + esc(label) + '" title="' + esc(label) + '"' +
      (cur === "at:desc" ? "" : ' data-on="1"') + ">" +
      opts.map(function (o) {
        return '<option value="' + o[0] + '"' + (o[0] === cur ? " selected" : "") + ">" +
          esc(o[1]) + "</option>";
      }).join("") + "</select></span>";
  }

  function selField(id, key, label, opts, cur) {
    var o = '<option value="">' + esc(L("All", "全部")) + "</option>";
    opts.forEach(function (p) {
      o += '<option value="' + esc(p[0]) + '"' + (cur === p[0] ? " selected" : "") + ">" + esc(p[1]) + "</option>";
    });
    return '<div class="field"><label for="' + id + '">' + esc(label) + "</label>" +
      '<select class="inp" id="' + id + '" data-f="' + key + '">' + o + "</select></div>";
  }

  /* ------------------------------------------------------------ 列表页 */
  function pageList() {
    var v = readView();

    var base = S.st === "empty" ? [] : AM.TOKENS.slice(0, demoLimit);
    var rows = S.st === "noresult" ? [] : sortRows(base.filter(function (t) { return match(t, v); }), v);

    var total = rows.length;
    /* 汇总按当前筛选与搜索的匹配全集求和，各笔各计一次，含失效代币；
       「其中失效」是代币数量的子集，不是第三个独立来源。 */
    var amount = sum(rows, "qty"), value = sum(rows, "val");
    var voidAmount = sum(rows.filter(function (t) { return t.ts === "void"; }), "qty");

    ensureLoad(v, total);
    afterList(v);

    var head = '<div class="page-head"><div>' +
      '<h1 class="page-title">' + L("Asset marketplace", "资产广场") + "</h1>" +
      '<p class="page-desc">' + L(
        "Receivables, tokenized. Explore the assets behind each on-chain record.",
        "查看代币背后的应收账款与链上事实。") + "</p></div></div>";

    /* 头部汇总：含已失效代币；空态显示 0，不隐藏整块。
       汇总与列表同批到达，因此加载中时汇总也处在加载中，不先出数再出表。 */
    var wait = S.st === "loading" || (S.st === "default" && load.phase === "initial");
    function statV(html) {
      if (wait) return '<div class="v"><span class="skel am-skel-v"></span></div>';
      // 首批没读到就没有可信的合计：给横线，不拿上一次的数字冒充当前结果。
      if (S.st === "error") return '<div class="v">' + dash() + "</div>";
      return '<div class="v">' + html + "</div>";
    }
    var summary = '<div class="mk-overview"><div class="stat-strip am-summary">' +
      '<div class="s"><div class="k">' + L("Token value", "代币价值") + '</div>' +
      statV(CF.market.amount(value,"USD",{compact:true,icon:true})) +
      '<div class="n">' + L("Converted at each issuance-time FX rate", "按各笔签发时汇率折算") + '</div></div>' +
      '<div class="s"><div class="k">' + L("Token amount", "代币数量") + '</div>' + statV(quantity(amount)) +
      '<div class="n">' + L("tokens · void tokens included", "枚 · 含已失效代币") + '</div></div>' +
      '<div class="s"><div class="k">' + L("Of which void", "其中失效") + '</div>' + statV(quantity(voidAmount)) +
      '<div class="n">' + L("tokens · part of the amount above", "枚 · 代币数量的子集") + '</div></div></div>' +
      (wait ? '<div class="mk-distribution">' + CF.skelTable(2) + '</div>' : S.st === 'error' ? '<div class="mk-distribution muted">' + L('Composition unavailable', '构成暂不可用') + '</div>' : CF.market.distribution(L('Token validity by amount', '代币数量构成'), [
        {key:'valid',label:L('Valid','有效'),value:Math.max(0,amount-voidAmount),tone:'accent'},
        {key:'void',label:L('Void','失效'),value:voidAmount,tone:'muted'}
      ], 'am-chart-status', v.ts, L('tokens','枚'))) + '</div>';

    var issuers = AM.ISSUERS.map(function (h, i) { return [String(i), nm(h)]; });
    var filters = '<div class="filterbar am-filters"><div class="am-filter-options">' +
      CF.filterMenu("am-ts", L("Token status", "代币状态"),
        [["valid", L("Valid", "有效")], ["void", L("Void", "失效")]], list(v.ts)) +
      CF.filterMenu("am-kind", L("Token type", "代币类型"), [["ar", tokenKind()]], list(v.kind)) +
      CF.filterMenu("am-issuer", L("Issuer", "发行方"), issuers, list(v.issuer)) +
      sortField(v) + '</div>' +
      CF.filterSearch("am-q", L("Token ID, issuer or hash", "代币编号、发行方或哈希"), v.q,
                      L("Token ID, issuer name or minting transaction hash", "代币编号、发行方名称或铸造交易哈希")) +
      '<div class="fb-acts">' +
      '<button class="btn" type="button" data-act="clearfilter">' + L("Reset", "重置") + "</button>" +
      '<button class="btn primary" type="button" data-act="am-search">' + L("Search", "查询") + "</button>" +
      '</div></div>';

    var body;
    var alt = CF.surface({
      skelRows: 6,
      emptyTitle: L("No tokens yet", "暂无代币"),
      emptyDesc: L("Tokens appear here once they are synced to the platform.", "代币同步到平台后会显示在这里。")
    });
    if (wait) {
      body = CF.skelTable(6);
    } else if (alt) {
      body = alt;
    } else if (!total) {
      body = hasFilter(v)
        ? CF.empty(L("No results match these filters", "没有符合筛选条件的结果"),
            L("Widen the range or clear one of the filters.", "放宽范围，或清掉其中一个筛选条件。"),
            '<button class="btn" type="button" data-act="clearfilter">' + L("Clear filters", "清空筛选") + "</button>")
        : CF.empty(L("No tokens yet", "暂无代币"),
            L("Tokens appear here once they are synced to the platform.", "代币同步到平台后会显示在这里。"), "");
    } else {
      body = '<div class="tablewrap listbox listbox-contained am-tbl-zone" id="am-listbox" role="region" tabindex="0" aria-label="' +
        L("Token list", "代币列表") + '"><table class="tbl resp am-tbl"><thead><tr>' +
        '<th scope="col" class="mk-network-col">' + L("Network", "网络") + "</th>" +
        '<th scope="col">' + L("Token", "代币") + "</th>" +
        '<th scope="col">' + L("Token ID", "代币编号") + "</th>" +
        '<th scope="col">' + L("Issuer", "发行方") + "</th>" +
        '<th scope="col" class="am-col-x">' + L("Token type", "代币类型") + "</th>" +
        '<th scope="col" class="am-r">' + L("Token amount (tokens)", "代币数量（枚）") + "</th>" +
        sortTh("val", L("Token value", "代币价值"), "am-r") +
        '<th scope="col">' + L("Token status", "代币状态") + "</th>" +
        sortTh("at", L("Minted at", "铸造时间"), "am-col-x", '<span class="am-tz">' + esc(tzName()) + "</span>") +
        "</tr></thead><tbody>" +
        rows.slice(0, load.shown).map(listRow).join("") +
        "</tbody></table>" + tail(total) + "</div>";
    }

    var limit = throttled()
      ? CF.note("warn", L("You’re searching quickly. Wait a moment before changing filters again — the tokens shown stay available.",
                          "操作较频繁，请稍后再筛选或搜索；已显示的内容不受影响。")) + '<div class="am-gap"></div>'
      : "";

    return '<div class="am-market-page">' + head + summary + limit +
      '<div class="card listzone" data-view="' + marketView + '" data-density="' + (S.listFull ? "full" : "core") + '">' + filters +
      '<div class="mk-result-head"><h2>' + CF.market.icon('asset') + L('Token registry', '代币清单') + '</h2><div class="mk-result-tools">' + CF.market.views(marketView, 'am-view') + fullBar(wait || S.st === "error" ? null : total) + '</div></div>' + body + '</div></div>';
  }

  /* 列表可放大到整窗，便于连续核对长列表；再次点击或 Esc 还原。 */
  function fullBar(total) {
    return '<div class="am-toolbar-end">' + (total === null ? '' : '<span class="am-total" role="status">' +
      esc(L(total + (total === 1 ? " record" : " records"), "共 " + total + " 笔")) + '</span>') +
      '<button class="btn icon" type="button" id="am-full" data-act="list-full" data-v="am-full" aria-pressed="' + !!S.listFull +
      '" title="' + esc(S.listFull ? L("Back to the compact list", "收起，回到精简列表") : L("Expand to show all fields", "放大，查看全部信息")) +
      '" aria-label="' + esc(S.listFull ? L("Back to the compact list", "收起，回到精简列表") : L("Expand to show all fields", "放大，查看全部信息")) + '">' +
      (S.listFull ? CF.ICON.close : CF.ICON.expand) + "</button></div>";
  }

  function listRow(t) {
    var mark = tokenLogo(t);
    return '<tr tabindex="0" aria-label="' + esc(L("Open token details: ", "打开代币详情：") + t.no) + '" data-act="am-open" data-v="' + esc(t.no) + '">' +
      '<td class="mk-network-cell" data-label="' + esc(L("Network", "网络")) + '">' + CF.market.network(AM.CHAIN) + '</td>' +
      '<td class="mk-item-cell" data-label="' + esc(L("Token", "代币")) + '"><div class="tok">' + mark +
        '<span class="tok-name">' + esc(tokenName(t)) + "</span></div></td>" +
      '<td data-label="' + esc(L("Token ID", "代币编号")) + '"><div class="cell-wrap">' +
        '<button class="btn-link mono am-id" type="button" data-act="am-copy" data-v="' + esc(t.no) + '" aria-label="' +
        esc(L("Copy token ID: ", "复制代币编号：") + t.no) + '" title="' + L("Copy token ID", "复制代币编号") + '">' + esc(t.no) + "</button></div></td>" +
      '<td data-label="' + esc(L("Issuer", "发行方")) + '">' + esc(issuerName(t)) + "</td>" +
      '<td class="am-col-x" data-label="' + esc(L("Token type", "代币类型")) + '">' + esc(tokenKind()) + "</td>" +
      /* 单位「枚」写在表头和卡片字段名里，单元格只给数字。 */
      '<td data-label="' + esc(L("Token amount (tokens)", "代币数量（枚）")) + '" class="am-r"><div class="cell-wrap am-number"><span class="num">' + quantity(t.qty) +
        '</span></div></td>' +
      '<td data-label="' + esc(L("Token value", "代币价值")) + '" class="am-r"><div class="cell-wrap am-number">' + CF.market.amount(t.val,"USD") + '</div></td>' +
      '<td data-label="' + esc(L("Token status", "代币状态")) + '">' + tsTag(t) + "</td>" +
      '<td data-label="' + esc(L("Minted at", "铸造时间")) + '" class="am-at am-col-x"><span class="am-stamp">' + stamp(t.at) + '</span></td>' +
      "</tr>";
  }

  /* ------------------------------------------------------------ 详情页 */
  function section(title, inner) {
    return '<section class="card am-sec"><div class="card-head"><h2>' + esc(title) + "</h2></div>" +
      '<div class="card-b">' + inner + "</div></section>";
  }
  /* 第三个元素为 true 的字段占整行：合约地址与两个哈希在半行里读不完。 */
  function dl(pairs) {
    return "<dl class=\"dl\">" + pairs.map(function (p) {
      return '<div class="am-fact' + (p[2] ? ' wide' : '') + '"><dt>' + esc(p[0]) + '</dt><dd>' + p[1] + '</dd></div>';
    }).join("") + "</dl>";
  }

  function pageDetail() {
    setTimeout(renderDemoExtras, 0);
    var no = curTokenNo();
    var t = null;
    AM.TOKENS.forEach(function (x) { if (x.no === no) t = x; });

    /* 编号不存在与格式非法返回同一结果，不暴露编号是否存在。 */
    if (!t) {
      return '<div class="card am-detail">' + CF.empty(
        L("Content not found", "内容不存在"),
        L("Check that the link is complete, or go back to the asset marketplace.", "请检查链接是否完整，或返回资产广场查找。"),
        ""
      ) + "</div>";
    }

    var mark = tokenLogo(t, "am-mark");

    /* 顶部只做身份识别：标识图、名称与代币状态同一行，编号与状态依据合为一行；
       发行方、账期、链等事实只在下方分区出现一次，不在顶部重复摘要。 */
    var overview = '<section class="am-ov"><div class="am-ov-top">' + mark + '<div class="am-ov-id">' +
        '<div class="am-ov-title"><h1 class="page-title">' + esc(tokenName(t)) + "</h1>" + tsTag(t) + "</div>" +
        '<div class="am-ov-meta"><span class="am-ov-no"><span class="mono">' + esc(t.no) + "</span>" +
        copyBtn(t.no, L("Token ID", "代币编号")) + '</span><span class="am-ov-why">' + esc(tsWhy(t)) + "</span></div>" +
      "</div></div></section>";

    var info = section(L("Token information", "代币信息"), dl([
      [L("Issuer", "发行方"), esc(issuerName(t))],
      [L("Token type", "代币类型"), esc(tokenKind())],
      [L("Token amount", "代币数量"), qty(t.qty)],
      [L("Token value", "代币价值"), money(t.val, "USD")],
      /* 铸造链：代币铸造所在的链，只读。 */
      [L("Minting chain", "铸造链"), CF.market.network(AM.CHAIN)],
      [L("Minted at", "铸造时间"), stampTz(t.at)],
      [L("Token contract", "代币发行合约"), '<div class="am-long"><span>' + esc(nm(AM.CONTRACT.name)) + "</span>" +
        /* 发行合约地址是链上查验的必要事实，完整展示、不缩略。 */
        '<span class="am-addr"><span class="mono">' + esc(AM.CONTRACT.addr) + "</span>" +
        copyBtn(AM.CONTRACT.addr, L("Token contract address", "代币发行合约地址")) + "</span></div>"],
      [L("Minting transaction hash", "铸造交易哈希"), hashRow(t.mintTx)]
    ]));

    var origin = section(L("Basic information", "基础资料信息"), dl([
      [L("Seller", "卖方企业名"), esc(sellerName(t))],
      [L("Buyer", "买方企业名"), esc(buyerName(t))],
      [L("Receivable amount", "应收账款金额"), money(t.recvAmt, t.recvCcy)],
      [L("Underlying receivable term", "底层应收账款账期"), esc(t.from) + " – " + esc(t.to)],
      [L("Trade type", "贸易类型"), esc(nm(AM.TRADES[t.trade]))],
      [L("Settlement method", "结算方式"), esc(nm(AM.SETTLES[t.settle]))]
    ]));

    var a = t.attest || {};
    /* 存证所在链给链名，不给链 ID；存证交易按这条链打开区块浏览器。 */
    var attest = section(L("On-chain attestation", "链上存证"), dl([
      [L("Attestation chain", "存证链"), a.chain ? CF.market.network(a.chain) : dash()],
      [L("Block height", "区块高度"), a.block ? '<span class="num">' + a.block + "</span>" : dash()],
      [L("Attested at", "存证时间"), a.at ? stampTz(a.at) : dash()],
      [L("Attestation hash", "存证哈希"), a.hash
        ? '<div class="am-hash"><span class="hash">' + esc(shortHash(a.hash)) + "</span>" +
          copyBtn(a.hash, L("Attestation hash", "存证哈希")) + "</div>"
        : dash()],
      [L("Attestation transaction hash", "链上存证交易哈希"), hashRow(a.tx, a.chain)]
    ]));

    return '<div class="am-detail">' + overview + info + origin + attest + holdingTable(t) + "</div>";
  }

  /* ------------------------------------------------------------ 页脚 */
  function renderFoot() {
    var el = document.getElementById("foot");
    if (!el) return;
    el.innerHTML = '<div class="ft-in">' +
      '<p class="ft-mark">Harbour Credit</p>' +
      '<p class="ft-tag">' + L("Cross-border receivables financing on tokenised assets.",
        "基于代币化资产的跨境应收账款融资。") + "</p>" +
      '<nav class="ft-links" aria-label="' + L("Footer", "页脚") + '">' +
      ["terms:" + L("Terms", "服务协议"), "privacy:" + L("Privacy", "隐私声明"),
       "risk:" + L("Risk disclosure", "风险揭示"), "contact:" + L("Contact", "联系我们")]
        .map(function (s) {
          var i = s.indexOf(":");
          return '<a href="#' + esc(CF.ENTRY[LIST]) + '" data-act="deeplink" data-v="' + s.slice(0, i) + '">' +
            esc(s.slice(i + 1)) + "</a>";
        }).join("") + "</nav>" +
      '<div class="ft-meta"><span>' +
      L("Demonstration data — not real companies, amounts, receivables or transactions",
        "演示数据 —— 非真实企业、金额、应收账款或链上交易") + "</span>" +
      "<span>" + L("Time zone: ", "时区：") + esc(S.tz || "UTC") + "</span></div></div>";
  }

  /* ------------------------------------------------------------ 模块接入 */
  var refocus = null;

  CF.renderFooter = renderFoot;

  CF.review.register(LIST, {group:['Assets','资产广场'], states:['default','loading','empty','noresult','error','denied'],
    route:'/assets', set(value){cancelLoad();S.st=value;}, reset(){cancelLoad();failNext=false;S.st='default';}});
  CF.review.register(DETAIL, {group:['Assets','资产广场'], states:['default','denied'],
    scenarios:()=>[['valid',['Valid token','有效代币']],['void',['Void token','失效代币']]].map(([st,label])=>{const row=AM.TOKENS.find(r=>r.ts===st);return {id:st,label,available:!!row,route:row?'/assets/'+row.no:null,description:['Read-only token details','查看已有代币详情']};}),
    route:()=>'/assets/'+AM.TOKENS[0].no});

  CF.define({
    id: "portal-asset-marketplace",
    pages: [LIST, DETAIL],
    dict: dict,
    content: function (page) {
      renderFoot();
      if (S.end !== "asset") {
        return CF.note("", L("This module ships the customer-facing pages only.",
                             "本模块只交付面客端页面。"));
      }
      if (S.st === "denied") {
        return CF.note("", L("The asset marketplace is a public read-only area: there is no restricted view here.",
                             "资产广场是公开只读区域，没有受限视图。"));
      }
      if (page === LIST || page === DETAIL) {
        if (refocus) {
          var want = refocus;
          refocus = null;
          setTimeout(function () {
            var el = document.getElementById(want);
            if (!el) return;
            el.focus({ preventScroll: true });
            if (el.tagName === "INPUT") {
              try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {}
            }
          }, 0);
        }
        return page === LIST ? pageList() : pageDetail();
      }
      return CF.note("", L("This page belongs to another module.", "该页面属于其他模块。") +
        ' <a href="#' + esc(CF.ENTRY[LIST]) + '">' + L("Back to the asset marketplace", "返回资产广场") + "</a>");
    },
    onAct: function (act, v) {
      if (act === "copy") {
        copyValue(v);
        return true;
      }
      if (act === "deeplink") {
        if (/^S-FP-/.test(String(v))) {
          CF.toast(L("Opens this financing request in the lending marketplace, which is outside this prototype.",
                     "该链接指向借贷广场的融资需求详情，不在本原型范围内。"));
        } else {
          CF.toast(L("This entry belongs to another module and is outside this prototype.",
                     "该入口属于其他模块，不在本原型范围内。"));
        }
        return true;
      }
      return false;
    }
  });

  /* 在公共事件分发之前处理本列表动作；不影响组合装载的消息中心。 */
  window.addEventListener("hashchange", function (e) {
    var fromToken = tokenNoFromPath(new URL(e.oldURL).hash.replace(/^#/, ""));
    cancelLoad(); resetHoldings(); syncEntry();
    if (isList()) returnFocus = fromToken;
  });
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]");
    if (!el || !curTokenNo()) return;
    var act = el.dataset.act, value = el.dataset.v;
    if (["am-holding-state", "am-holding-token", "am-holding-retry", "am-address-copy", "am-project"].indexOf(act) < 0) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (act === "am-address-copy") { copyValue(value); return; }
    if (act === "am-project") {
      CF.AM.returnDetail = location.hash; location.hash = "#/project/" + value;
      var project = CF.LS.project(value);
      if (project && ["closed", "settled"].indexOf(project.state) >= 0) setTimeout(function () {
        CF.toast(project.state === "closed" ? L("This project is closed.", "该项目已关闭。") : L("This project is settled.", "该项目已结清。"));
      }, 0);
      return;
    }
    resetHoldings();
    if (act === "am-holding-token") { holdingMode = "sample"; location.hash = "#/assets/" + value + "?return=" + encodeURIComponent(CF.ENTRY[LIST]); }
    else { holdingMode = act === "am-holding-retry" ? "sample" : value; CF.render(); }
  }, true);
  document.addEventListener("click", function (e) {
    if (!isList()) return;
    var el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    var act = el.getAttribute("data-act"), value = el.getAttribute("data-v");
    rememberPosition();
    if (act === "st") { cancelLoad(); return; }
    if (act.indexOf("am-") !== 0 && act !== "clearfilter" && act !== "retry") return;
    e.preventDefault(); e.stopImmediatePropagation();
    var v = readView();
    if (act === "am-view") { marketView = value === 'table' ? 'table' : 'cards'; CF.render(); requestAnimationFrame(function(){document.querySelector('.mk-views [data-v="'+marketView+'"]')?.focus({preventScroll:true});}); }
    else if (act === "am-chart-status") { v.ts = v.ts === value ? '' : value; writeView(v); }
    else if (act === "am-copy") copyValue(value);
    else if (act === "am-open") {
      cancelLoad();
      CF.ENTRY[DETAIL] = "/assets/" + value + "?return=" + encodeURIComponent(CF.ENTRY[LIST]);
      location.hash = "#" + CF.ENTRY[DETAIL];
    } else if (act === "am-more") appendBatch();
    else if (act === "am-fail") { failNext = true; CF.toast(L("Next batch will fail — demonstration.", "下一批将加载失败 —— 演示。")); }
    else if (act === "am-size") { demoLimit = Number(value); writeView(v); }
    else if (act === "am-sort") {
      if (v.sort === value) v.dir = v.dir === "asc" ? "desc" : "asc";
      else { v.sort = value; v.dir = "desc"; }
      writeView(v);
    } else if (act === "am-search") {
      v.q = document.getElementById("am-q").value.trim(); refocus = "am-q"; writeView(v);
    } else if (act === "clearfilter") {
      v.ts = v.kind = v.issuer = v.q = ""; S.menu = null; writeView(v);
    } else if (act === "retry") { cancelLoad(); S.st = "default"; CF.render(); }
  }, true);
  document.addEventListener("change", function (e) {
    var el = e.target;
    if (!isList() || !el.closest("#content")) return;
    var v = readView();
    var group = el.getAttribute("data-filter");
    if (group) {
      var key = {"am-ts": "ts", "am-kind": "kind", "am-issuer": "issuer"}[group];
      if (!key) return;
      v[key] = Array.from(document.querySelectorAll('[data-filter="' + group + '"]'))
        .filter(function (b) { return b.checked; }).map(function (b) { return b.value; }).join(",");
    } else if (el.getAttribute("data-sort")) {
      var pair = String(el.value).split(":");
      v.sort = ["at", "val", "due"].indexOf(pair[0]) >= 0 ? pair[0] : "at";
      v.dir = pair[1] === "asc" ? "asc" : "desc";
    } else if (el.getAttribute("data-f")) v[el.getAttribute("data-f")] = el.value;
    else return;
    refocus = el.id; writeView(v);
  });
  document.addEventListener("keydown", function (e) {
    if (isList() && e.target.matches('tr[data-act="am-open"]') && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault(); e.stopPropagation(); e.target.click(); return;
    }
    if (e.key !== "Enter" || !e.target || e.target.id !== "am-q") return;
    e.preventDefault();
    var v = readView(); v.q = e.target.value.trim(); refocus = "am-q"; writeView(v);
  });

  /* 评审件双击与旧根地址直接进入资产广场，保留有效详情深链。 */
  if (!hashPath() || hashPath() === "/") location.hash = "#/assets";
  syncEntry();
  if (!CF.deferBoot) CF.boot();
})(window.CF);
