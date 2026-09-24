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
  var failNext = false, demoLimit = 52, hits = [];
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  function number(value, fallback, max, precise) {
    var n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.min(max, precise ? n : Math.floor(n)) : fallback;
  }
  function readView() {
    var h = isList() ? hashPath() : CF.ENTRY[LIST] || "/assets";
    var q = new URLSearchParams(h.split("?")[1] || "");
    var v = { ts: "", ps: "", kind: "", holder: "", q: "", sort: "at", dir: "desc",
      loaded: 20, scroll: 0, outer: 0, anchor: "", offset: 0 };
    ["ts", "ps", "kind", "holder", "q", "sort", "dir", "anchor"].forEach(function (key) {
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
    ["ts", "ps", "kind", "holder", "q"].forEach(function (key) { if (v[key]) q.set(key, v[key]); });
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
    if (load.shown >= total) return CF.moreFoot(total);
    return '<div class="loadmore" role="status">' + L("Scroll down to load more", "下滑自动加载更多") +
      '<span class="tiny">' + L("Showing " + load.shown + " of " + total, "已显示 " + load.shown + " / " + total + " 条") + '</span></div>';
  }
  function afterList(v) {
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
      panel.insertAdjacentHTML("beforeend", '<div class="grp" id="am-demo"><h5>' + L("Holding data · fictional samples", "持有资料 · 虚构样例") + '</h5>' +
        [["sample", L("Single-address sample", "单地址样例")], ["loading", L("Loading", "加载中")], ["error", L("Load failed", "加载失败")], ["empty", L("Complete empty set", "完整空集合")], ["missing", L("Missing fields", "字段缺失")], ["conflict", L("Conflicting relations", "关系冲突")], ["unavailable", L("Unavailable", "资料不可用")]].map(function (x) {
          return '<button class="btn" data-act="am-holding-state" data-v="' + x[0] + '">' + x[1] + '</button>';
        }).join("") + '<h5>' + L("Open a sample", "打开样例") + '</h5>' +
        Object.keys(AM.HOLDING_SAMPLES).map(function (no) { return '<button class="btn" data-act="am-holding-token" data-v="' + no + '">' + no + '</button>'; }).join("") + '</div>');
      return;
    }
    panel.insertAdjacentHTML("beforeend", '<div class="grp" id="am-demo"><h5>' + L("Asset list demonstration", "资产列表演示") + '</h5>' +
      '<button class="btn" data-act="am-fail">' + L("Fail next batch", "下一批失败") + '</button>' +
      [7, 20, 52].map(function (n) { return '<button class="btn" data-act="am-size" data-v="' + n + '">' + L(n + " sample items", n + " 条样例") + '</button>'; }).join("") + '</div>');
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

  function hasFilter(v) { return !!(v.ts || v.ps || v.kind || v.holder || v.q); }
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
  function holderName(t) { return nm(AM.HOLDERS[t.holder]); }
  function buyerName(t) { return nm(AM.BUYERS[t.buyer]); }
  /* 代币名称未下发时展示合约名称，不自造符号。 */
  function tokenName(t) { return t.name || nm(AM.CONTRACT.name); }
  function tokenKind() { return L("Receivables", "应收账款类"); }
  /* 没有 logo 时的首字母块：资产方字母 + 编号末位，整列不会长成一个样。 */
  function markText(t) { return AM.HOLDERS[t.holder][0].slice(-1) + t.no.slice(-1); }
  function dash() { return '<span class="faint">—</span>'; }

  /* 代币状态取上游同步数据；质押状态取本平台质押记录，链上过程态只参与
     收敛、不出现在页面上。 */
  function pledgeOf(t) {
    var p = t.pl;
    if (p && p.st === "PS-2" && p.chain === "ok") return { on: true, project: p.project };
    return { on: false, project: null };
  }
  function tsTag(t) {
    return t.ts === "valid" ? CF.tag("ok", L("Valid", "有效")) : CF.tag("", L("Void", "失效"));
  }
  function psTag(t) {
    return pledgeOf(t).on ? CF.tag("accent", L("Pledged", "已质押")) : CF.tag("", L("Not pledged", "未质押"));
  }
  function tsWhy(t) {
    return t.ts === "valid"
      ? L("Underlying receivable falls due on " + t.to, "对应应收账款于 " + t.to + " 到期")
      : L("Underlying receivable matured on " + t.to, "对应应收账款已于 " + t.to + " 到期");
  }
  function psWhy(t) {
    var p = pledgeOf(t);
    if (!p.on) return L("No active pledge on this token", "该代币当前没有生效的质押");
    if (p.project.draft) return L("The financing project is not public yet", "所属融资项目尚未公开");
    return L("Counted in " + p.project.id, "已计入 " + p.project.id);
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
      CF.toast(L("Could not copy. Select the value and copy it manually.", "复制失败，请手动选中编号或文本后复制。"));
    }
  }

  function cents(value) { return Math.round(value * 100); }
  function sum(rows, key) { return rows.reduce(function (n, t) { return n + cents(t[key]); }, 0) / 100; }
  function quantity(value) { return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  /* 持有地址由发行平台同步，默认就有数据；其他响应情况留在评审工具里切换。 */
  var holdingMode = "sample", holdingLoad = null, holdingTimer = 0;
  function resetHoldings() { clearTimeout(holdingTimer); holdingLoad = null; }
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
    var title = L("Token holding addresses", "代币持有地址"), body;
    if (holdingLoad.phase === "loading") body = '<div role="status" aria-live="polite">' + CF.skelTable(2) + '</div>';
    else if (holdingMode === "error") body = '<div role="alert">' + CF.empty(L("Could not load holding information", "持有信息加载失败"), "",
      '<button class="btn" data-act="am-holding-retry">' + L("Retry", "重试") + '</button>') + '</div>';
    else if (holdingMode === "empty") body = CF.empty(L("No holding addresses", "暂无持有地址"), "", "");
    else {
      var data = AM.HOLDING_SAMPLES[t.no];
      if (holdingMode === "missing" && data) data = { complete: true, rows: data.rows.map(function (r) { return Object.assign({}, r, { qty: null }); }) };
      if (holdingMode === "conflict" && data) data = { complete: true, rows: data.rows.concat(data.rows) };
      var valid = ["sample", "missing", "conflict"].indexOf(holdingMode) >= 0 && data && data.complete === true && Array.isArray(data.rows) && data.rows.length === 1;
      if (valid) valid = data.rows.every(function (r) {
        if (!r || typeof r !== "object") return false;
        var p = pledgeOf(t);
        return /^0x[0-9a-fA-F]{40}$/.test(r.address) && typeof r.qty === "number" && Number.isFinite(r.qty) && r.qty > 0 &&
          typeof r.value === "number" && Number.isFinite(r.value) && r.value >= 0 && typeof r.pledged === "boolean" &&
          r.pledged === p.on && (r.pledged ? r.project && p.project && r.project.id === p.project.id && r.project.draft === p.project.draft &&
            (r.project.draft || Array.isArray(r.project.name) && r.project.name.length === 2 && r.project.name.every(function (n) { return typeof n === "string" && n.trim(); })) : r.project === null);
      }) && cents(sum(data.rows, "qty")) === cents(t.qty) && cents(sum(data.rows, "value")) === cents(t.val);
      if (!valid) body = CF.empty(L("Holding information is temporarily unavailable", "持有信息暂不可用"), "", "");
      else {
        var heads = [L("Address", "地址"), L("Holding amount", "持有数量"), L("Corresponding value", "对应价值"), L("Pledge status", "质押状态"), L("Financing project", "所属融资项目")];
        body = '<p class="tiny am-holding-demo">' + L("Fictional demonstration data", "虚构演示数据") + '</p><div class="tablewrap"><table class="tbl resp am-holdings"><thead><tr>' + heads.map(function (h) { return '<th scope="col">' + h + '</th>'; }).join("") + '</tr></thead><tbody>' +
          data.rows.map(function (r) {
            var project = !r.pledged ? dash() : r.project.draft ? L("The financing project is not public yet", "所属融资项目尚未公开") :
              '<a class="btn-link" href="#/project/' + esc(r.project.id) + '" data-act="am-project" data-v="' + esc(r.project.id) + '">' + esc(nm(r.project.name)) + '</a>';
            var values = ['<span class="copy-pair"><span class="mono am-address">' + esc(r.address.slice(0, 6) + "…" + r.address.slice(-4)) + '</span>' +
              CF.copyBtn("am-address-copy", r.address, L("Copy address", "复制地址")) + '</span>', quantity(r.qty) + L(" tokens", " 枚"), CF.fmtAmt(r.value, "USD"), CF.tag(r.pledged ? "accent" : "", r.pledged ? L("Pledged", "已质押") : L("Not pledged", "未质押")), project];
            return '<tr>' + values.map(function (v, i) { return '<td data-label="' + esc(heads[i]) + '"><div class="cell-wrap">' + v + '</div></td>'; }).join("") + '</tr>';
          }).join("") + '</tbody></table></div>';
      }
    }
    return '<section class="card am-sec" id="am-holdings"><div class="card-head">' + title + '</div>' + body + '</section>';
  }

  /* 区块浏览器外链：唯一的新窗口；链接旁常驻未核验标注。 */
  function explorer(hash) {
    return CF.linkOut(AM.EXPLORER_TX + hash, L("Open block explorer", "在区块浏览器打开"));
  }
  function notVerified() {
    return '<p class="tiny am-caveat">' +
      L("Not verified by the platform; link provided for your own checking.",
        "平台未核验该交易，链接仅供自行查验。") + "</p>";
  }
  function hashRow(hash) {
    if (!hash) return dash();
    return '<div class="am-hash"><span class="hash">' + esc(shortHash(hash)) + "</span>" +
      copyBtn(hash, L("Transaction hash", "交易哈希")) + explorer(hash) + "</div>" + notVerified();
  }

  /* ------------------------------------------------------------ 筛选与排序 */
  /* 每个筛选项都可多选，URL 里按逗号串存；空串代表不限。 */
  function list(value) { return value ? String(value).split(",").filter(Boolean) : []; }
  function anyOf(value, candidate) { var l = list(value); return !l.length || l.indexOf(candidate) >= 0; }
  function match(t, v) {
    if (!anyOf(v.ts, t.ts)) return false;
    if (!anyOf(v.ps, pledgeOf(t).on ? "pledged" : "unpledged")) return false;
    if (!anyOf(v.kind, "ar")) return false;
    if (!anyOf(v.holder, String(t.holder))) return false;
    if (v.q) {
      var k = v.q.trim().toLowerCase();
      var hay = [t.no, AM.HOLDERS[t.holder][0], AM.HOLDERS[t.holder][1], t.mintTx].join(" ").toLowerCase();
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

  function sortTh(key, label, cls) {
    var v = readView(), cur = v.sort === key;
    var aria = cur ? (v.dir === "asc" ? "ascending" : "descending") : "none";
    return '<th class="sortable ' + (cls || "") + '" aria-sort="' + aria + '" scope="col">' +
      '<button type="button" data-act="am-sort" data-v="' + key + '">' + esc(label) +
      '<span class="ar" aria-hidden="true">' + (cur && v.dir === "asc" ? "↑" : "↓") + "</span></button></th>";
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
    /* 汇总只计有效代币：失效代币仍在列表里，但不进数量与价值合计。 */
    var live = rows.filter(function (t) { return t.ts !== "void"; });
    var value = sum(live, "val"), amount = sum(live, "qty");

    ensureLoad(v, total);
    afterList(v);

    var head = '<div class="page-head"><div>' +
      '<h1 class="page-title">' + L("Asset marketplace", "资产广场") + "</h1>" +
      '<p class="page-desc">' + L(
        "Every token listed on the platform, with its underlying receivable and on-chain record.",
        "平台上的全部代币及其底层应收账款与链上记录。") + "</p></div></div>";

    /* 头部汇总：含已失效代币；空态显示 0，不隐藏整块。
       汇总与列表同批到达，因此加载中时汇总也处在加载中，不先出数再出表。 */
    var wait = S.st === "loading" || (S.st === "default" && load.phase === "initial");
    function statV(html) { return wait ? '<div class="v"><span class="skel am-skel-v"></span></div>' : '<div class="v">' + html + "</div>"; }
    var summary = '<div class="stat-strip am-summary">' +
      '<div class="s"><div class="k">' + L("Valid tokens", "有效代币数量") +
        CF.icoChip(AM.CHAIN, {glyph: CF.ICON.chain, hue: 3, small: true}) + "</div>" +
        statV(quantity(amount)) +
        '<div class="n">' + L("tokens · void tokens excluded", "枚 · 不含已失效代币") + "</div></div>" +
      '<div class="s" data-tone="accent"><div class="k">' + L("Valid token value", "有效代币价值") + "</div>" +
        statV('<span class="u">USD</span>' + CF.fmtAmt(value)) +
        '<div class="n">' + L("Converted at each issuance-time FX rate", "按各笔签发时汇率折算") + "</div></div></div>";

    var holders = AM.HOLDERS.map(function (h, i) { return [String(i), nm(h)]; });
    var filters = '<div class="filterbar">' +
      CF.filterMenu("am-ts", L("Token status", "代币状态"),
        [["valid", L("Valid", "有效")], ["void", L("Void", "失效")]], list(v.ts)) +
      CF.filterMenu("am-ps", L("Pledge status", "质押状态"),
        [["unpledged", L("Not pledged", "未质押")], ["pledged", L("Pledged", "已质押")]], list(v.ps)) +
      CF.filterMenu("am-kind", L("Token type", "代币类型"), [["ar", tokenKind()]], list(v.kind)) +
      CF.filterMenu("am-holder", L("Asset originator", "资产方企业"), holders, list(v.holder)) +
      CF.filterSearch("am-q", L("Token ID, asset originator or minting transaction hash",
                                "代币编号、资产方企业名或铸造交易哈希"), v.q) +
      '<div class="fb-acts">' +
      '<button class="btn" type="button" data-act="clearfilter">' + L("Reset", "重置") + "</button>" +
      '<button class="btn primary" type="button" data-act="am-search">' + L("Search", "查询") + "</button>" +
      "</div></div>";

    var body;
    var alt = CF.surface({
      skelRows: 6,
      emptyTitle: L("No tokens yet", "暂无代币"),
      emptyDesc: L("Tokens appear here as soon as they are synced from the issuance platform.",
                   "代币从代币发行平台同步过来后即出现在这里。")
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
            L("Tokens appear here as soon as they are synced from the issuance platform.",
              "代币从代币发行平台同步过来后即出现在这里。"), "");
    } else {
      body = fullBar(total) + '<div class="tablewrap listbox listbox-contained am-tbl-zone" id="am-listbox" role="region" tabindex="0" aria-label="' +
        L("Token list", "代币列表") + '"><table class="tbl resp am-tbl"><thead><tr>' +
        '<th scope="col">' + L("Token", "代币") + "</th>" +
        '<th scope="col">' + L("Token ID", "代币编号") + "</th>" +
        '<th scope="col">' + L("Chain", "所属链") + "</th>" +
        '<th scope="col">' + L("Asset originator", "资产方企业") + "</th>" +
        '<th scope="col">' + L("Token type", "代币类型") + "</th>" +
        '<th scope="col">' + L("Token amount", "代币数量") + "</th>" +
        sortTh("val", L("Token value", "代币价值")) +
        '<th scope="col">' + L("Token status", "代币状态") + "</th>" +
        '<th scope="col">' + L("Pledge status", "质押状态") + "</th>" +
        sortTh("at", L("Minted at", "铸造时间")) +
        "</tr></thead><tbody>" +
        rows.slice(0, load.shown).map(listRow).join("") +
        "</tbody></table>" + tail(total) + "</div>";
    }

    var limit = throttled()
      ? CF.note("warn", L("Requests are coming in quickly. Browsing is unaffected — the marketplace limits how often the data can be pulled.",
                          "请求有点频繁。浏览不受影响，广场对数据拉取频次有限制。")) + '<div class="am-gap"></div>'
      : "";

    return head + summary + limit +
      '<div class="card listzone">' + filters + body + "</div>";
  }

  /* 列表可放大到整窗，便于连续核对长列表；再次点击或 Esc 还原。 */
  function fullBar(total) {
    return '<div class="list-full-bar"><span>' +
      esc(L("Showing ", "共 ") + total + L(" tokens", " 条代币")) + "</span>" +
      '<button class="btn icon" type="button" id="am-full" data-act="list-full" data-v="am-full" aria-pressed="' + !!S.listFull +
      '" title="' + esc(S.listFull ? L("Exit full window", "退出放大") : L("Expand to window", "放大到整窗")) +
      '" aria-label="' + esc(S.listFull ? L("Exit full window", "退出放大") : L("Expand to window", "放大到整窗")) + '">' +
      (S.listFull ? CF.ICON.close : CF.ICON.expand) + "</button></div>";
  }

  function listRow(t) {
    var mark = '<span class="tok-mark" data-hue="' + ((t.holder % 4) + 1) + '" aria-hidden="true">' +
      esc(markText(t)) + "</span>";
    return '<tr tabindex="0" aria-label="' + esc(L("Open token details: ", "打开代币详情：") + t.no) + '" data-act="am-open" data-v="' + esc(t.no) + '">' +
      '<td data-label="' + esc(L("Token", "代币")) + '"><div class="tok">' + mark +
        '<span class="tok-name">' + esc(tokenName(t)) + "</span></div></td>" +
      '<td data-label="' + esc(L("Token ID", "代币编号")) + '"><div class="cell-wrap">' +
        '<button class="btn-link mono am-id" type="button" data-act="am-copy" data-v="' + esc(t.no) + '" aria-label="' +
        esc(L("Copy token ID: ", "复制代币编号：") + t.no) + '" title="' + L("Copy token ID", "复制代币编号") + '">' + esc(t.no) + "</button></div></td>" +
      '<td data-label="' + esc(L("Chain", "所属链")) + '">' + CF.icoChip(AM.CHAIN, {glyph: CF.ICON.chain, hue: 3, small: true}) + "</td>" +
      '<td data-label="' + esc(L("Asset originator", "资产方企业")) + '">' + esc(holderName(t)) + "</td>" +
      '<td data-label="' + esc(L("Token type", "代币类型")) + '">' + esc(tokenKind()) + "</td>" +
      '<td data-label="' + esc(L("Token amount", "代币数量")) + '" class="num">' + t.qty.toFixed(2) + L(" tokens", " 枚") + "</td>" +
      '<td data-label="' + esc(L("Token value", "代币价值")) + '" class="num nw am-val">' +
        CF.icoChip("USD", {hue: 1, small: true, iconOnly: true}) + '<span class="am-val-n">' + CF.fmtAmt(t.val, "USD") + "</span></td>" +
      '<td data-label="' + esc(L("Token status", "代币状态")) + '">' + tsTag(t) + "</td>" +
      '<td data-label="' + esc(L("Pledge status", "质押状态")) + '">' + psTag(t) + "</td>" +
      '<td data-label="' + esc(L("Minted at", "铸造时间")) + '" class="tiny am-at">' + CF.fmtTime(t.at) + "</td>" +
      "</tr>";
  }

  /* ------------------------------------------------------------ 详情页 */
  function section(title, inner) {
    return '<section class="card am-sec"><div class="card-head">' + esc(title) + "</div>" +
      '<div class="card-b">' + inner + "</div></section>";
  }
  /* 第三个元素为 true 的字段占整行：合约地址与两个哈希在半行里读不完。 */
  function dl(pairs) {
    return "<dl class=\"dl\">" + pairs.map(function (p) {
      return "<dt" + (p[2] ? ' class="wide-k"' : "") + ">" + esc(p[0]) + "</dt>" +
        "<dd" + (p[2] ? ' class="wide"' : "") + ">" + p[1] + "</dd>";
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
        L("This address does not point to a token on the marketplace.", "该地址没有对应的代币。"),
        ""
      ) + "</div>";
    }

    var p = pledgeOf(t);
    var mark = '<span class="tok-mark am-mark" data-hue="' + ((t.holder % 4) + 1) + '" aria-hidden="true">' +
      esc(markText(t)) + "</span>";

    var overview = '<section class="card am-sec am-ov"><div class="card-b">' +
      '<div class="am-ov-top">' + mark + '<div class="am-ov-id">' +
        '<h1 class="page-title">' + esc(tokenName(t)) + "</h1>" +
        '<div class="am-ov-no"><span class="mono">' + esc(t.no) + "</span>" +
        copyBtn(t.no, L("Token ID", "代币编号")) + "</div></div></div>" +
      '<div class="am-ov-tags">' +
        '<div class="am-ov-tag">' + tsTag(t) + '<span class="tiny">' + esc(tsWhy(t)) + "</span></div>" +
        '<div class="am-ov-tag">' + psTag(t) + '<span class="tiny">' + esc(psWhy(t)) + "</span></div>" +
      "</div></div></section>";

    var info = section(L("Token information", "代币信息"), dl([
      [L("Token amount", "代币数量"), '<span class="num">' + t.qty.toFixed(2) + L(" tokens", " 枚") + "</span>"],
      [L("Token value", "代币价值"), '<span class="num">' + CF.fmtAmt(t.val, "USD") + "</span>"],
      [L("Token type", "代币类型"), esc(tokenKind())],
      [L("Chain", "所属链"), esc(AM.CHAIN)],
      [L("Token contract", "所属合约"), esc(nm(AM.CONTRACT.name)) +
        '<div class="am-addr"><span class="mono">' + esc(AM.CONTRACT.addr) + "</span>" +
        copyBtn(AM.CONTRACT.addr, L("Contract address", "合约地址")) + "</div>", true],
      [L("Minting transaction hash", "铸造交易哈希"), hashRow(t.mintTx), true],
      [L("Minted at", "铸造时间"), CF.fmtTime(t.at)]
    ]));

    var origin = section(L("Underlying receivable", "原始资料信息"), dl([
      [L("Asset originator", "资产方企业名"), esc(holderName(t))],
      [L("Buyer", "买方企业名"), esc(buyerName(t))],
      [L("Receivable amount", "应收账款金额"), '<span class="num">' + CF.fmtAmt(t.recvAmt, t.recvCcy) + "</span>"],
      [L("Underlying receivable term", "底层应收账款账期"), esc(t.from) + " – " + esc(t.to)],
      [L("Trade type", "贸易类型"), esc(nm(AM.TRADES[t.trade]))],
      [L("Settlement method", "结算方式"), esc(nm(AM.SETTLES[t.settle]))]
    ]));

    var a = t.attest || {};
    var attest = section(L("On-chain attestation", "链上存证"), dl([
      [L("Attestation hash", "存证哈希"), a.hash
        ? '<div class="am-hash"><span class="hash">' + esc(shortHash(a.hash)) + "</span>" +
          copyBtn(a.hash, L("Attestation hash", "存证哈希")) + "</div>"
        : dash(), true],
      [L("Attestation transaction hash", "链上存证交易哈希"), hashRow(a.tx), true],
      [L("Block height", "区块高度"), a.block ? '<span class="num">' + a.block + "</span>" : dash()],
      [L("Chain ID", "链 ID"), '<span class="num">' + esc(AM.CHAIN_ID) + "</span>"],
      [L("Attested at", "存证时间"), a.at ? CF.fmtTime(a.at) : dash()]
    ]));

    var cta = '<section class="card am-sec am-cta"><div class="card-b">' +
      "<p>" + (S.role === "guest"
        ? L("Become a funder and finance receivables like this one.", "成为资金方，参与此类资产融资。")
        : L("Browse financing projects backed by receivables like this one.", "前往借贷广场，查看此类资产的融资项目。")) + "</p>" +
      '<button class="btn primary" type="button" data-act="deeplink" data-v="cta">' +
      (S.role === "guest" ? L("Apply to join", "申请入驻") : L("Go to the lending marketplace", "前往借贷广场")) +
      "</button></div></section>";

    return '<div class="am-detail">' + overview + info + origin + attest + holdingTable(t) + cta + "</div>";
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
      "<span>" + L("Times shown in", "时间时区") + " " + esc(S.tz || "UTC") + "</span></div></div>";
  }

  /* ------------------------------------------------------------ 模块接入 */
  var refocus = null;

  CF.renderFooter = renderFoot;

  CF.review.register(LIST, {group:['Assets','资产广场'], states:['default','loading','empty','noresult','error','denied'],
    route:'/assets', set(value){cancelLoad();S.st=value;}, reset(){cancelLoad();failNext=false;S.st='default';}});
  CF.review.register(DETAIL, {group:['Assets','资产广场'], states:['default','denied'],
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
        if (v === "cta") {
          if (S.role !== "guest" && CF.LSView) { location.hash = "#/marketplace"; return true; }
          CF.toast(S.role === "guest"
            ? L("Sign-up runs in the account module, outside this prototype.", "申请入驻属账号模块，不在本原型范围内。")
            : L("Opens the lending marketplace, which is outside this prototype.", "该入口指向借贷广场，不在本原型范围内。"));
        } else if (/^S-FP-/.test(String(v))) {
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
    if (act.indexOf("am-") !== 0 && act !== "clearfilter" && act !== "retry" && act !== "filter-set") return;
    e.preventDefault(); e.stopImmediatePropagation();
    var v = readView();
    if (act === "am-copy") copyValue(value);
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
      v.ts = v.ps = v.kind = v.holder = v.q = ""; S.menu = null; writeView(v);
    } else if (act === "filter-set") {
      var parts = String(value).split("|"), key = {"am-ts": "ts", "am-ps": "ps", "am-kind": "kind", "am-holder": "holder"}[parts[0]];
      if (!key) return;
      v[key] = parts[1] === "all" ? "" : "";
      if (parts[1] === "all") {
        var boxes = Array.from(document.querySelectorAll('[data-filter="' + parts[0] + '"]'));
        v[key] = boxes.map(function (b) { return b.value; }).join(",");
      }
      refocus = parts[0]; writeView(v);
    } else if (act === "retry") { cancelLoad(); S.st = "default"; CF.render(); }
  }, true);
  document.addEventListener("change", function (e) {
    var el = e.target;
    if (!isList() || !el.closest("#content")) return;
    var v = readView();
    var group = el.getAttribute("data-filter");
    if (group) {
      var key = {"am-ts": "ts", "am-ps": "ps", "am-kind": "kind", "am-holder": "holder"}[group];
      if (!key) return;
      v[key] = Array.from(document.querySelectorAll('[data-filter="' + group + '"]'))
        .filter(function (b) { return b.checked; }).map(function (b) { return b.value; }).join(",");
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
