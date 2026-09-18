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
  CF.PAGES[DETAIL] = { end: "asset", layout: "portal", crumbKey: "crumbToken", auth: false };
  CF.ENTRY[DETAIL] = "/assets/" + AM.TOKENS[0].no;

  /* ------------------------------------------------------------ 视图状态
     筛选、排序、搜索关键词与页码写在 URL 上，URL 是视图状态的唯一事实源：
     刷新、分享、前进后退与从详情页返回都原样恢复。 */
  function hashPath() { return location.hash.replace(/^#/, ""); }

  /* URL 保存业务视图；会话内按 URL 保存内外滚动位置。公共壳层仍负责渲染。
     file:// 或禁用存储时退回内存，不影响浏览。 */
  var positionKey = "am-positions:" + location.pathname;
  var positions = {}, renderedPath = "", restoreFrame = 0, resetPosition = false;
  try { positions = JSON.parse(sessionStorage.getItem(positionKey) || "{}"); } catch (e) {}
  if (!positions || typeof positions !== "object") positions = {};
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  function rememberPosition() {
    if (!renderedPath || renderedPath !== hashPath() || restoreFrame) return;
    var box = document.getElementById("am-listbox");
    positions[renderedPath] = { outer: window.scrollY, inner: box ? box.scrollTop : 0 };
    try { sessionStorage.setItem(positionKey, JSON.stringify(positions)); } catch (e) {}
  }

  function restorePosition(page) {
    if (!resetPosition) rememberPosition();
    var path = hashPath();
    var saved = resetPosition ? { outer: 0, inner: 0 } : positions[path] || { outer: 0, inner: 0 };
    renderedPath = path;
    resetPosition = false;
    cancelAnimationFrame(restoreFrame);
    restoreFrame = requestAnimationFrame(function () {
      restoreFrame = 0;
      if (hashPath() !== path) return;
      var box = document.getElementById("am-listbox");
      if (box && page === LIST) box.scrollTop = saved.inner || 0;
      window.scrollTo(0, saved.outer || 0);
      rememberPosition();
    });
  }
  document.addEventListener("scroll", rememberPosition, true);
  window.addEventListener("pagehide", rememberPosition);

  function readView() {
    var h = hashPath();
    /* 详情页地址下沿用登记表里保存的列表视图，返回列表时筛选排序页码原样恢复。 */
    if (!/^\/assets(\?|$)/.test(h)) h = CF.ENTRY[LIST] || "/assets";
    var qi = h.indexOf("?");
    var v = { ts: "", ps: "", kind: "", holder: "", q: "", sort: "at", dir: "desc", page: 1 };
    if (qi < 0) return v;
    h.slice(qi + 1).split("&").forEach(function (seg) {
      if (!seg) return;
      var i = seg.indexOf("="), k = i < 0 ? seg : seg.slice(0, i);
      var raw = i < 0 ? "" : seg.slice(i + 1).replace(/\+/g, " ");
      var val;
      try { val = decodeURIComponent(raw); } catch (e) { val = raw; }
      if (k === "page") v.page = Math.max(1, parseInt(val, 10) || 1);
      else if (Object.prototype.hasOwnProperty.call(v, k)) v[k] = val;
    });
    if (["at", "val", "due"].indexOf(v.sort) < 0) v.sort = "at";
    if (v.dir !== "asc") v.dir = "desc";
    return v;
  }

  function viewHash(v) {
    var q = [];
    ["ts", "ps", "kind", "holder", "q"].forEach(function (k) {
      if (v[k]) q.push(k + "=" + encodeURIComponent(v[k]));
    });
    if (v.sort !== "at" || v.dir !== "desc") { q.push("sort=" + v.sort); q.push("dir=" + v.dir); }
    if (v.page > 1) q.push("page=" + v.page);
    return "/assets" + (q.length ? "?" + q.join("&") : "");
  }

  /* 公共路由按登记表精确匹配。把当前地址回写进登记表，深链与查询串就能走
     公共路由本身，不必在模块里另起一套路由。 */
  function syncEntry() {
    var h = hashPath();
    if (/^\/assets\/[^/?#]+$/.test(h)) CF.ENTRY[DETAIL] = h;
    else if (/^\/assets(\?|$)/.test(h)) CF.ENTRY[LIST] = h;
  }

  var hits = [];
  function writeView(v) {
    rememberPosition();
    var h = viewHash(v), now = Date.now();
    hits.push(now);
    hits = hits.filter(function (t) { return now - t < 6000; });
    CF.ENTRY[LIST] = h;
    positions[h] = { outer: 0, inner: 0 };
    resetPosition = true;
    S.toTop = true;
    if (hashPath() !== h) location.hash = "#" + h;
    else CF.render();
  }
  function throttled() { return hits.length > 10; }

  function hasFilter(v) { return !!(v.ts || v.ps || v.kind || v.holder || v.q); }
  function curTokenNo() {
    var m = hashPath().match(/^\/assets\/([^/?#]+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  /* ------------------------------------------------------------ 文案 */
  var dict = {
    en: {
      navHome: "Home", navAssets: "Asset marketplace", navPlaza: "Lending marketplace",
      navConsole: "My console", crumbToken: "Token details"
    },
    zh: {
      navHome: "首页", navAssets: "资产广场", navPlaza: "借贷广场",
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
    return '<button class="btn-link sm" type="button" data-act="copy" data-v="' + esc(value) +
      '" data-k="' + esc(label) + '">' + L("Copy", "复制") + "</button>";
  }

  /* 区块浏览器外链：唯一的新窗口；链接旁常驻未核验标注。 */
  function explorer(hash) {
    return '<a class="btn-link sm" href="' + esc(AM.EXPLORER_TX + hash) + '" target="_blank" rel="noopener noreferrer">' +
      L("Block explorer", "区块浏览器") + '<span class="ar" aria-hidden="true">↗</span></a>';
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
  function match(t, v) {
    if (v.ts && t.ts !== v.ts) return false;
    if (v.ps && (pledgeOf(t).on ? "pledged" : "unpledged") !== v.ps) return false;
    if (v.kind && v.kind !== "ar") return false;
    if (v.holder && String(t.holder) !== v.holder) return false;
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
      '<button type="button" data-act="sort" data-v="' + key + '">' + esc(label) +
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
    S.pageNo = v.page;

    var base = S.st === "empty" ? [] : AM.TOKENS;
    var rows = S.st === "noresult" ? [] : sortRows(base.filter(function (t) { return match(t, v); }), v);

    var total = rows.length;
    var value = rows.reduce(function (n, t) { return n + t.val; }, 0);
    var voids = rows.filter(function (t) { return t.ts === "void"; }).length;

    /* 手改地址把页码填过了末页时落回最后一页，不给一张没有行的空表。 */
    var pages = Math.max(1, Math.ceil(total / CF.PAGE_SIZE));
    if (v.page > pages) { v.page = pages; S.pageNo = pages; }

    var head = '<div class="page-head"><div>' +
      '<h1 class="page-title">' + L("Asset marketplace", "资产广场") + "</h1>" +
      '<p class="page-desc">' + L(
        "Every token listed on the platform, with its underlying receivable and on-chain record. Read-only, open to everyone.",
        "平台上的全部代币及其底层应收账款与链上记录。只读，对所有人开放。") + "</p></div></div>";

    /* 头部汇总：含已失效代币；空态显示 0，不隐藏整块。
       汇总与列表同批到达，因此加载中时汇总也处在加载中，不先出数再出表。 */
    var wait = S.st === "loading";
    function statV(html) { return wait ? '<div class="v"><span class="skel am-skel-v"></span></div>' : '<div class="v">' + html + "</div>"; }
    var summary = '<div class="stat-row am-summary">' +
      '<div class="stat"><div class="k">' + L("Tokens", "代币数量") + "</div>" +
        statV(total.toLocaleString("en-US")) +
        '<div class="n">' + L("tokens", "张") + "</div></div>" +
      '<div class="stat"><div class="k">' + L("Token value", "代币价值") + "</div>" +
        statV(CF.fmtAmt(value, "USD")) +
        '<div class="n">' + L("Converted at each issuance-time FX rate", "按各笔签发时汇率折算") + "</div></div>" +
      '<div class="stat"><div class="k">' + L("Of which void", "其中失效") + "</div>" +
        statV(voids.toLocaleString("en-US")) +
        '<div class="n">' + L("tokens", "张") + "</div></div></div>" +
      '<p class="sum-note">' + L(
        "Token count and token value include void tokens.",
        "代币数量与代币价值含已失效代币。") + "</p>";

    var holders = AM.HOLDERS.map(function (h, i) { return [String(i), nm(h)]; });
    var filters = '<div class="filters">' +
      selField("am-ts", "ts", L("Token status", "代币状态"),
        [["valid", L("Valid", "有效")], ["void", L("Void", "失效")]], v.ts) +
      selField("am-ps", "ps", L("Pledge status", "质押状态"),
        [["unpledged", L("Not pledged", "未质押")], ["pledged", L("Pledged", "已质押")]], v.ps) +
      selField("am-kind", "kind", L("Token type", "代币类型"), [["ar", tokenKind()]], v.kind) +
      selField("am-holder", "holder", L("Asset originator", "资产方企业"), holders, v.holder) +
      '<div class="field am-q"><label for="am-q">' + L("Search", "搜索") + "</label>" +
      '<input class="inp" id="am-q" type="search" value="' + esc(v.q) + '" placeholder="' +
      esc(L("Token ID, asset originator or minting transaction hash",
            "代币编号、资产方企业名或铸造交易哈希")) + '"></div>' +
      '<div class="acts">' +
      '<button class="btn" type="button" data-act="clearfilter">' + L("Reset", "重置") + "</button>" +
      '<button class="btn primary" type="button" data-act="search">' + L("Search", "查询") + "</button>" +
      "</div></div>";

    var body;
    var alt = CF.surface({
      skelRows: 6,
      emptyTitle: L("No tokens yet", "暂无代币"),
      emptyDesc: L("Tokens appear here as soon as they are synced from the issuance platform.",
                   "代币从代币发行平台同步过来后即出现在这里。")
    });
    if (alt) {
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
      var start = (v.page - 1) * CF.PAGE_SIZE;
      body = '<div class="tablewrap listbox" id="am-listbox" role="region" tabindex="0" aria-label="' +
        L("Token list", "代币列表") + '"><table class="tbl resp am-tbl"><thead><tr>' +
        '<th scope="col">' + L("Token", "代币") + "</th>" +
        '<th scope="col">' + L("Token ID", "代币编号") + "</th>" +
        '<th scope="col">' + L("Asset originator", "资产方企业") + "</th>" +
        '<th scope="col">' + L("Token type", "代币类型") + "</th>" +
        '<th scope="col">' + L("Token amount", "代币数量") + "</th>" +
        sortTh("val", L("Token value", "代币价值")) +
        '<th scope="col">' + L("Token status", "代币状态") + "</th>" +
        '<th scope="col">' + L("Pledge status", "质押状态") + "</th>" +
        sortTh("due", L("Underlying receivable term", "底层应收账款账期")) +
        sortTh("at", L("Minted at", "铸造时间")) +
        "</tr></thead><tbody>" +
        rows.slice(start, start + CF.PAGE_SIZE).map(listRow).join("") +
        "</tbody></table></div>" + CF.pagerFoot(total, CF.PAGE_SIZE);
    }

    var limit = throttled()
      ? CF.note("warn", L("Requests are coming in quickly. Browsing is unaffected — the marketplace limits how often the data can be pulled.",
                          "请求有点频繁。浏览不受影响，广场对数据拉取频次有限制。")) + '<div class="am-gap"></div>'
      : "";

    return head + summary + '<div class="am-gap"></div>' + limit +
      '<div class="card">' + filters + body + "</div>";
  }

  function listRow(t) {
    var mark = '<span class="tok-mark" data-hue="' + ((t.holder % 4) + 1) + '" aria-hidden="true">' +
      esc(markText(t)) + "</span>";
    return '<tr data-act="open" data-v="' + esc(t.no) + '">' +
      '<td data-label="' + esc(L("Token", "代币")) + '"><div class="tok">' + mark +
        '<span class="tok-name">' + esc(tokenName(t)) + "</span></div></td>" +
      '<td data-label="' + esc(L("Token ID", "代币编号")) + '"><div class="cell-wrap">' +
        '<a class="mono am-id" href="#/assets/' + esc(t.no) + '">' + esc(t.no) + "</a>" +
        copyBtn(t.no, L("Token ID", "代币编号")) + "</div></td>" +
      '<td data-label="' + esc(L("Asset originator", "资产方企业")) + '">' + esc(holderName(t)) + "</td>" +
      '<td data-label="' + esc(L("Token type", "代币类型")) + '">' + esc(tokenKind()) + "</td>" +
      '<td data-label="' + esc(L("Token amount", "代币数量")) + '" class="num">' + t.qty.toFixed(2) + "</td>" +
      '<td data-label="' + esc(L("Token value", "代币价值")) + '" class="num nw">' + CF.fmtAmt(t.val, "USD") + "</td>" +
      '<td data-label="' + esc(L("Token status", "代币状态")) + '">' + tsTag(t) + "</td>" +
      '<td data-label="' + esc(L("Pledge status", "质押状态")) + '">' + psTag(t) + "</td>" +
      '<td data-label="' + esc(L("Underlying receivable term", "底层应收账款账期")) + '" class="tiny am-term">' +
        esc(t.from) + "<br>" + esc(t.to) + "</td>" +
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
    var no = curTokenNo();
    var t = null;
    AM.TOKENS.forEach(function (x) { if (x.no === no) t = x; });

    var back = '<a class="btn-link am-back" href="#' + esc(CF.ENTRY[LIST]) + '">' +
      '<span aria-hidden="true">←</span>' + L("Back to the asset marketplace", "返回资产广场") + "</a>";

    /* 编号不存在与格式非法返回同一结果，不暴露编号是否存在。 */
    if (!t) {
      return back + '<div class="card am-detail">' + CF.empty(
        L("Content not found", "内容不存在"),
        L("This address does not point to a token on the marketplace.", "该地址没有对应的代币。"),
        '<a class="btn" href="#' + esc(CF.ENTRY[LIST]) + '">' + L("Back to the asset marketplace", "返回资产广场") + "</a>"
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
      [L("Token amount", "代币数量"), '<span class="num">' + t.qty.toFixed(2) + "</span>"],
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

    var pledgeBody;
    if (!p.on) {
      pledgeBody = dl([[L("Pledge status", "质押状态"), psTag(t)]]);
    } else if (p.project.draft) {
      pledgeBody = dl([
        [L("Pledge status", "质押状态"), psTag(t)],
        [L("Financing project", "所属融资项目"),
          '<span class="muted">' + L("The financing project is not public yet", "所属融资项目尚未公开") + "</span>"]
      ]);
    } else {
      pledgeBody = dl([
        [L("Pledge status", "质押状态"), psTag(t)],
        [L("Financing project", "所属融资项目"),
          '<a class="btn-link" href="#/marketplace/project/' + esc(p.project.id) + '" data-act="deeplink" data-v="' +
          esc(p.project.id) + '">' + esc(nm(p.project.name)) +
          '<span class="ar" aria-hidden="true">→</span></a>', true]
      ]);
    }
    var pledge = section(L("Current pledge", "当前质押信息"), pledgeBody);

    var cta = '<section class="card am-sec am-cta"><div class="card-b">' +
      "<p>" + (S.role === "guest"
        ? L("Become a funder and finance receivables like this one.", "成为资金方，参与此类资产融资。")
        : L("Browse financing projects backed by receivables like this one.", "前往借贷广场，查看此类资产的融资项目。")) + "</p>" +
      '<button class="btn primary" type="button" data-act="deeplink" data-v="cta">' +
      (S.role === "guest" ? L("Apply to join", "申请入驻") : L("Go to the lending marketplace", "前往借贷广场")) +
      "</button></div></section>";

    return back + '<div class="am-detail">' + overview + info + origin + attest + pledge + cta + "</div>";
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
  CF.define({
    id: "portal-asset-marketplace",
    dict: dict,
    content: function (page) {
      restorePosition(page);
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
      if (act === "open") {
        CF.ENTRY[DETAIL] = "/assets/" + v;
        location.hash = "#" + CF.ENTRY[DETAIL];
        return true;
      }
      if (act === "sort") {
        var view = readView();
        if (view.sort === v) view.dir = view.dir === "asc" ? "desc" : "asc";
        else { view.sort = v; view.dir = "desc"; }
        view.page = 1;
        writeView(view);
        return true;
      }
      if (act === "search") {
        var el = document.getElementById("am-q");
        var w = readView();
        w.q = el ? el.value.trim() : "";
        w.page = 1;
        refocus = "am-q";
        writeView(w);
        return true;
      }
      if (act === "copy") {
        try {
          if (navigator.clipboard) navigator.clipboard.writeText(v);
          CF.toast(L("Copied.", "已复制。"));
        } catch (e) {
          CF.toast(L("Copy is unavailable here — select the value to copy it.", "此处无法自动复制，请手动选中后复制。"));
        }
        return true;
      }
      if (act === "deeplink") {
        if (v === "cta") {
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

  /* 下面三个监听器在 CF.boot() 之前注册，因此先于公共运行时执行：
     它们只做「把用户动作写回 URL」这一件公共层没有的事，不第二次渲染页面。 */
  window.addEventListener("hashchange", syncEntry);

  document.addEventListener("click", function (e) {
    rememberPosition();
    var el = e.target.closest ? e.target.closest("[data-act]") : null;
    if (!el || el.disabled) return;
    var act = el.getAttribute("data-act"), v;
    if (act === "pageno") {
      v = readView();
      v.page = Math.max(1, parseInt(el.getAttribute("data-v"), 10) || 1);
      writeView(v);
    } else if (act === "clearfilter") {
      v = readView();
      v.ts = v.ps = v.kind = v.holder = v.q = "";
      v.page = 1;
      writeView(v);
    }
  });

  document.addEventListener("change", function (e) {
    var el = e.target;
    if (!el || !el.getAttribute || !el.getAttribute("data-f")) return;
    var v = readView();
    v[el.getAttribute("data-f")] = el.value;
    v.page = 1;
    refocus = el.id;
    writeView(v);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || !e.target || e.target.id !== "am-q") return;
    e.preventDefault();
    var v = readView();
    v.q = e.target.value.trim();
    v.page = 1;
    refocus = "am-q";
    writeView(v);
  });

  /* 评审件双击打开时直接落在本模块首页，不落到其他模块的路由上。 */
  if (!hashPath() || hashPath() === "/") location.hash = "#/assets";
  syncEntry();
  if (!CF.deferBoot) CF.boot();
})(window.CF);
