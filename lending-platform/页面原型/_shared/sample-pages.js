(function (CF) {
  var L = CF.L, esc = CF.esc, S = CF.S, tag = CF.tag;
  if(document.getElementById("focus")) {
    CF.PAGES["DEMO-FOCUS"] = {end:"asset", layout:"focus", navKey:"focusSample"};
    CF.ENTRY["DEMO-FOCUS"] = "/sample/focus";
  }

  /* ====================== 演示数据 ======================================
     全部为演示数据，不对应任何真实企业、金额或利率。 */
  var ASSETS = [
    { no: "TK20260612000147", name: "HC-AR-2606", holder: ["Asset Holder A", "资产方 A"],
      kind: "ar", qty: 1250, val: 1250000, ts: "valid", ps: "pledged",
      from: "2026-06-12", to: "2026-09-10", at: "2026-06-12T10:20:00" },
    { no: "TK20260705000288", name: "HC-AR-2607", holder: ["Asset Holder B", "资产方 B"],
      kind: "ar", qty: 860, val: 860000, ts: "valid", ps: "unpledged",
      from: "2026-07-05", to: "2026-11-02", at: "2026-07-05T09:05:00" },
    { no: "TK20260818000361", name: "HC-AR-2608", holder: ["Asset Holder C", "资产方 C"],
      kind: "ar", qty: 2040, val: 2040000, ts: "valid", ps: "pledged",
      from: "2026-08-18", to: "2026-10-17", at: "2026-08-18T16:40:00" },
    { no: "TK20260220000092", name: "HC-AR-2602", holder: ["Asset Holder A", "资产方 A"],
      kind: "ar", qty: 460, val: 460000, ts: "void", ps: "unpledged",
      from: "2026-02-20", to: "2026-05-21", at: "2026-02-20T11:15:00" },
    { no: "TK20260903000415", name: "HC-AR-2609", holder: ["Asset Holder D", "资产方 D"],
      kind: "ar", qty: 1120, val: 1120000, ts: "valid", ps: "unpledged",
      from: "2026-09-03", to: "2027-01-01", at: "2026-09-03T08:30:00" }
  ];

  var REQUESTS = [
    { id: "S-FP-26090107", holder: ["Asset Holder A", "资产方 A"], amt: 800000, ccy: "USD",
      tenor: 90, rate: "6.40 – 7.20", st: "quoting", token: "AR-USD-2606", at: "2026-09-16T09:20:00" },
    { id: "S-FP-26090312", holder: ["Asset Holder B", "资产方 B"], amt: 520000, ccy: "EUR",
      tenor: 120, rate: "5.80 – 6.50", st: "review", token: "AR-EUR-2607", at: "2026-09-15T14:05:00" },
    { id: "S-FP-26082804", holder: ["Asset Holder C", "资产方 C"], amt: 1400000, ccy: "USD",
      tenor: 60, rate: "6.95", st: "disbursing", token: "AR-USD-2608", at: "2026-09-12T11:40:00" },
    { id: "S-FP-26081902", holder: ["Asset Holder A", "资产方 A"], amt: 460000, ccy: "USD",
      tenor: 90, rate: "7.10", st: "repaying", token: "AR-USD-2606", at: "2026-09-09T16:30:00" }
  ];

  /* 上面五条是手写样例，下面按同一形状补足到 47 / 33 条，
     只为演示每批 20 条的滚动加载，全部仍是演示数据。 */
  (function () {
    var holders = [["Asset Holder A", "资产方 A"], ["Asset Holder B", "资产方 B"],
                   ["Asset Holder C", "资产方 C"], ["Asset Holder D", "资产方 D"],
                   ["Asset Holder E", "资产方 E"], ["Asset Holder F", "资产方 F"]];
    function pad(n, w) { return ("000000" + n).slice(-w); }
    for (var i = 0; i < 42; i++) {
      var mo = (i % 9) + 1, day = (i % 26) + 2, seq = 500 + i * 7;
      var ds = "2026-" + pad(mo, 2) + "-" + pad(day, 2);
      var de = "2026-" + pad(Math.min(12, mo + 3), 2) + "-" + pad(day, 2);
      ASSETS.push({
        no: "TK2026" + pad(mo, 2) + pad(day, 2) + pad(seq, 6),
        name: "HC-AR-26" + pad(mo, 2) + "-" + pad(i + 1, 2),
        holder: holders[i % holders.length],
        kind: "ar",
        qty: 180 + (i % 17) * 95,
        val: (180 + (i % 17) * 95) * 1000,
        ts: i % 11 === 0 ? "void" : "valid",
        ps: i % 3 === 0 ? "pledged" : "unpledged",
        from: ds, to: de,
        at: ds + "T" + pad(8 + (i % 9), 2) + ":" + pad((i * 7) % 60, 2) + ":00"
      });
    }
    var sts = ["quoting", "review", "disbursing", "repaying"];
    for (var j = 0; j < 29; j++) {
      var m2 = (j % 9) + 1, d2 = (j % 25) + 3;
      var ds2 = "2026-" + pad(m2, 2) + "-" + pad(d2, 2);
      REQUESTS.push({
        id: "S-FP-26" + pad(m2, 2) + pad(d2, 2) + pad(100 + j * 3, 2),
        holder: holders[j % holders.length],
        amt: 150000 + (j % 13) * 85000,
        ccy: j % 4 === 1 ? "EUR" : "USD",
        tenor: [60, 90, 120][j % 3],
        rate: (5.4 + (j % 9) * 0.25).toFixed(2),
        st: sts[j % sts.length],
        token: ASSETS[j % ASSETS.length].name,
        at: ds2 + "T" + pad(9 + (j % 8), 2) + ":" + pad((j * 11) % 60, 2) + ":00"
      });
    }
  })();

  var AGREEMENTS = [
    { code: "AG-PLEDGE", name: ["Pledge service agreement", "质押服务协议"], ver: "V2.1",
      st: "effective", eff: "2026-08-01T00:00:00" },
    { code: "AG-FUNDER", name: ["Funder onboarding terms", "资金方入驻条款"], ver: "V1.4",
      st: "effective", eff: "2026-06-15T00:00:00" },
    { code: "AG-PRIVACY", name: ["Privacy notice", "隐私声明"], ver: "V3.0",
      st: "pending", eff: "2026-10-01T00:00:00" },
    { code: "AG-RISK", name: ["Risk disclosure", "风险揭示书"], ver: "V1.0",
      st: "archived", eff: "2025-11-01T00:00:00" }
  ];

  var ST_TAG = {
    valid: ["ok", ["Valid", "有效"]],
    void: ["", ["Void", "失效"]],
    pledged: ["accent", ["Pledged", "已质押"]],
    unpledged: ["", ["Not pledged", "未质押"]],
    quoting: ["accent", ["Receiving quotes", "报价中"]],
    review: ["warn", ["Pledge under review", "质押审核中"]],
    disbursing: ["violet", ["Disbursing", "放款中"]],
    repaying: ["ok", ["Repaying", "还款中"]],
    effective: ["ok", ["Effective", "生效中"]],
    pending: ["warn", ["Takes effect later", "待生效"]],
    archived: ["", ["Archived", "已归档"]]
  };
  function stTag(k) {
    var s = ST_TAG[k]; return tag(s[0], L(s[1][0], s[1][1]));
  }
  function nm(pair) { return L(pair[0], pair[1]); }

  /* ====================== 文案 ========================================== */
  var dict = {
    en: {
      focusSample: "Centered card", navHome: "Home", navAssets: "Asset marketplace", navPlaza: "Lending marketplace",
      navConsole: "My console", navOverview: "Overview", navAgreements: "Agreements",
      navGroupOps: "Operations"
    },
    zh: {
      focusSample: "居中卡片", navHome: "首页", navAssets: "资产广场", navPlaza: "借贷广场",
      navConsole: "我的控制台", navOverview: "总览", navAgreements: "协议管理",
      navGroupOps: "运营"
    }
  };

  /* ====================== 官网首页 ====================================== */
  /* 24×24 圆角方形首字母块；没有 logo 时不用通用占位图。 */
  function tokMark(text) {
    var ch = String(text || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
    var hue = (ch.charCodeAt(0) % 4) + 1;
    return '<span class="tok-mark" data-hue="' + hue + '" aria-hidden="true">' + esc(ch) + "</span>";
  }
  function tokCell(mark, name) {
    return '<div class="tok">' + tokMark(mark) + '<span class="tok-name">' + esc(name) + "</span></div>";
  }

  function assetMiniRow(a) {
    return '<a class="mini-row" href="#/assets">' +
      '<div class="lead-col">' + tokCell(a.name.slice(-2), a.name) +
        '<div class="sub">' + esc(nm(a.holder)) + " · " + esc(a.no) + "</div></div>" +
      '<div class="val"><span class="k">' + L("Token value", "代币价值") + '</span>' +
        '<span class="v">' + CF.fmtAmt(a.val, "USD") + "</span></div>" +
      '<div class="val"><span class="k">' + L("Pledge status", "质押状态") + '</span>' +
        '<span class="v txt">' + L(a.ps === "pledged" ? "Pledged" : "Not pledged",
                               a.ps === "pledged" ? "已质押" : "未质押") + "</span></div>" +
      '<span class="go" aria-hidden="true">&rarr;</span></a>';
  }

  function reqMiniRow(r) {
    return '<a class="mini-row" href="#/marketplace">' +
      '<div class="lead-col">' + tokCell(r.holder[0].slice(-1), r.id) +
        '<div class="sub">' + esc(nm(r.holder)) + " · " + r.tenor + L(" days", " 天") + "</div></div>" +
      '<div class="val"><span class="k">' + L("Amount", "金额") + '</span>' +
        '<span class="v">' + CF.fmtAmt(r.amt, r.ccy) + "</span></div>" +
      '<div class="val"><span class="k">' + L("Indicative rate", "参考年化") + '</span>' +
        '<span class="v">' + esc(r.rate) + " %</span></div>" +
      '<span class="go" aria-hidden="true">&rarr;</span></a>';
  }

  var STEPS = [
    [["Asset onboarding", "资产上架"], ["Tokenised receivables arrive from the issuance platform.", "已确权的应收账款由代币发行平台上架。"]],
    [["Pool and pledge", "建池与质押"], ["The holder pools an asset and pledges it against a financing request.", "资产方建池，并将其质押给一笔融资需求。"]],
    [["Credit and quote", "授信与报价"], ["Funders assess the request and submit a quote.", "资金方核定授信并提交报价。"]],
    [["Disbursement", "放款"], ["The accepted quote becomes a deal and the funder disburses.", "接受报价后成交，资金方放款。"]],
    [["Repayment", "还款"], ["Repayments run to schedule; settlement releases the pledge.", "按计划还款；结清后释放质押。"]]
  ];

  function pageHome() {
    var signedOut = S.role === "guest";
    return '<section class="site-hero"><div class="site-wrap"><div class="hero-grid"><div>' +
      '<p class="eyebrow">' + L("Cross-border receivables financing", "跨境应收账款融资") + "</p>" +
      "<h1>" + L("Tokenised receivables, financed end to end.", "已代币化的应收账款，融资全流程贯通。") + "</h1>" +
      "</div><div>" +
      '<p class="lede">' + L(
        "Browse listed assets and open financing requests without signing in. Sign in when you are ready to pledge, quote, disburse or repay.",
        "已上架资产与在招标的融资需求无需登录即可浏览。需要质押、报价、放款或还款时再登录。") + "</p>" +
      '<div class="acts">' +
      '<a class="btn primary" href="#/marketplace">' + L("Browse the lending marketplace", "浏览借贷广场") + "</a>" +
      '<a class="btn" href="#/assets">' + L("See listed assets", "查看已上架资产") + "</a>" +
      "</div></div></div></div></section>" +

      '<section class="site-band"><div class="site-wrap">' +
      '<div class="sec-head"><div>' +
      '<h2 class="sec-title">' + L("Listed assets", "已上架资产") + "</h2>" +
      '<p class="sec-note">' + L("Tokenised receivable pools available to pledge.", "可用于质押的应收账款池。") + "</p>" +
      '</div><a class="btn-link more" href="#/assets">' + L("See all", "查看全部") +
      '<span class="ar" aria-hidden="true">&rarr;</span></a></div>' +
      '<div class="mini-list">' + ASSETS.slice(0, 3).map(assetMiniRow).join("") + "</div>" +
      "</div></section>" +

      '<section class="site-band alt"><div class="site-wrap">' +
      '<div class="sec-head"><div>' +
      '<h2 class="sec-title">' + L("Open financing requests", "在招标的融资需求") + "</h2>" +
      '<p class="sec-note">' + L("Requests currently receiving or executing quotes.", "正在接受报价或执行中的融资需求。") + "</p>" +
      '</div><a class="btn-link more" href="#/marketplace">' + L("See all", "查看全部") +
      '<span class="ar" aria-hidden="true">&rarr;</span></a></div>' +
      '<div class="mini-list">' + REQUESTS.slice(0, 3).map(reqMiniRow).join("") + "</div>" +
      "</div></section>" +

      '<section class="site-band"><div class="site-wrap">' +
      '<div class="sec-head"><div><h2 class="sec-title">' + L("How a deal runs", "一笔业务怎么走") + "</h2></div></div>" +
      '<div class="site-steps">' + STEPS.map(function (s, i) {
        return '<div class="step" data-on="' + (i === 0 ? 1 : 0) + '">' +
          '<span class="sn">' + ("0" + (i + 1)) + "</span>" +
          "<h4>" + esc(nm(s[0])) + "</h4><p>" + esc(nm(s[1])) + "</p></div>";
      }).join("") + "</div></div></section>" +

      '<section class="site-band alt"><div class="site-wrap"><div class="site-paths">' +
      '<div class="path"><h3>' + L("For asset holders", "资产方") + "</h3><ul>" +
      "<li>" + L("Pool listed receivables and publish a financing request.", "用已上架的应收账款建池，发布融资需求。") + "</li>" +
      "<li>" + L("Compare quotes and accept one.", "比较报价并接受其中一个。") + "</li>" +
      "<li>" + L("Track disbursement and repayment in one place.", "在一处跟踪放款与还款。") + "</li>" +
      "</ul>" + (signedOut
        ? '<button class="btn primary" type="button" data-act="signin">' + L("Sign in", "登录") + "</button>"
        : '<a class="btn primary" href="#/console">' + L("Go to my console", "进入我的控制台") + "</a>") +
      "</div>" +
      '<div class="path"><h3>' + L("For funders", "资金方") + "</h3><ul>" +
      "<li>" + L("Review open requests and the pledged asset behind each one.", "查看在招标的需求与其背后的质押资产。") + "</li>" +
      "<li>" + L("Submit a quote with your rate and tenor.", "按你的利率与期限提交报价。") + "</li>" +
      "<li>" + L("Disburse and confirm repayments.", "放款并确认还款。") + "</li>" +
      "</ul>" + (signedOut
        ? '<button class="btn" type="button" data-act="toast" data-v="apply">' + L("Apply to join", "申请入驻") + "</button>"
        : '<a class="btn" href="#/marketplace">' + L("Find a request", "寻找需求") + "</a>") +
      "</div></div></div></section>";
  }

  /* ====================== 资产广场 ====================================== */
  /* 列集与头部汇总取《资产广场 · 已上架代币只读域》PRD 的 L-AM-01～L-AM-10 与 F-AM-02。
     本页是列表形态的 shell 母版，完整字段校验与验收归 WS-350。 */
  function sortTh(key, label) {
    var cur = S.sort === key;
    var dir = cur ? S.sortDir : null;
    var aria = cur ? (dir === "asc" ? "ascending" : "descending") : "none";
    return '<th class="sortable" aria-sort="' + aria + '" scope="col">' +
      '<button type="button" data-act="sort" data-v="' + key + '">' + esc(label) +
      '<span class="ar" aria-hidden="true">' + (dir === "asc" ? "\u2191" : "\u2193") + "</span></button></th>";
  }

  function sortedAssets() {
    var list = ASSETS.slice();
    var key = S.sort || "at", dir = S.sortDir === "asc" ? 1 : -1;
    list.sort(function (a, b) {
      var x = key === "val" ? a.val : (key === "to" ? a.to : a.at);
      var y = key === "val" ? b.val : (key === "to" ? b.to : b.at);
      return x > y ? dir : (x < y ? -dir : 0);
    });
    return list;
  }

  function assetRow(a) {
    return "<tr>" +
      '<td data-label="' + L("Token", "代币") + '">' + tokCell(a.name.slice(-2), a.name) + "</td>" +
      '<td data-label="' + L("Token number", "代币编号") + '"><div class="cell-wrap">' +
        '<span class="mono nw">' + esc(a.no) + "</span>" +
        '<button class="btn-link sm" type="button" data-act="copy" data-v="' + esc(a.no) + '">' +
        L("Copy", "复制") + "</button></div></td>" +
      '<td data-label="' + L("Asset holder", "资产方企业") + '">' + esc(nm(a.holder)) + "</td>" +
      '<td data-label="' + L("Token type", "代币类型") + '">' + L("Receivables", "应收账款类") + "</td>" +
      '<td data-label="' + L("Token quantity", "代币数量") + '" class="num">' + a.qty.toFixed(2) + "</td>" +
      '<td data-label="' + L("Token value", "代币价值") + '" class="num nw">' + CF.fmtAmt(a.val, "USD") + "</td>" +
      '<td data-label="' + L("Token status", "代币状态") + '">' + stTag(a.ts) + "</td>" +
      '<td data-label="' + L("Pledge status", "质押状态") + '">' + stTag(a.ps) + "</td>" +
      '<td data-label="' + L("Receivable term", "底层应收账款账期") + '" class="tiny nw">' +
        esc(a.from) + " \u2013 " + esc(a.to) + "</td>" +
      '<td data-label="' + L("Minted at", "铸造时间") + '" class="tiny">' + CF.fmtTime(a.at) + "</td>" +
      "</tr>";
  }

  function pageAssets() {
    var alt = CF.surface({
      skelRows: 5,
      emptyTitle: L("No tokens synced yet", "暂无已同步代币"),
      emptyDesc: L("Tokens appear here once the issuance platform lists them.", "代币发行平台上架后，代币会出现在这里。")
    });
    var shown = S.st === "empty" || S.st === "noresult" ? [] : ASSETS;
    var total = shown.length;
    var value = shown.reduce(function (n, a) { return n + a.val; }, 0);
    var voidCount = shown.filter(function (a) { return a.ts === "void"; }).length;

    var head = '<div class="page-head"><div>' +
      '<h1 class="page-title">' + L("Asset marketplace", "资产广场") + "</h1>" +
      '<p class="page-desc">' + L(
        "Tokens synced from the issuance platform. Read-only, open to everyone.",
        "由代币发行平台同步过来的代币，只读，对所有人开放。") + "</p></div></div>";

    /* 头部汇总三项；空态显示 0 不隐藏整块。 */
    var summary = '<div class="stat-row">' +
      '<div class="stat"><div class="k">' + L("Tokens", "代币数量") + '</div><div class="v">' +
        total + '</div><div class="n">' + L("issued tokens", "张") + "</div></div>" +
      '<div class="stat"><div class="k">' + L("Token value", "代币价值") + '</div><div class="v">' +
        CF.fmtAmt(value, "USD") + "</div></div>" +
      '<div class="stat"><div class="k">' + L("Of which void", "其中失效") + '</div><div class="v">' +
        voidCount + '</div><div class="n">' + L("issued tokens", "张") + "</div></div>" +
      '</div><p class="sum-note">' +
      L("Converted at each issuance-time FX rate.", "按各笔签发时汇率折算。") + "</p>";

    var filters = '<div class="filters">' +
      '<div class="field"><label for="a-ts">' + L("Token status", "代币状态") + "</label>" +
      '<select class="inp" id="a-ts"><option>' + L("All", "全部") + "</option><option>" +
        L("Valid", "有效") + "</option><option>" + L("Void", "失效") + "</option></select></div>" +
      '<div class="field"><label for="a-ps">' + L("Pledge status", "质押状态") + "</label>" +
      '<select class="inp" id="a-ps"><option>' + L("All", "全部") + "</option><option>" +
        L("Pledged", "已质押") + "</option><option>" + L("Not pledged", "未质押") + "</select></div>" +
      '<div class="field"><label for="a-kind">' + L("Token type", "代币类型") + "</label>" +
      '<select class="inp" id="a-kind"><option>' + L("All", "全部") + "</option><option>" +
        L("Receivables", "应收账款类") + "</option></select></div>" +
      '<div class="field"><label for="a-holder">' + L("Asset holder", "资产方企业") + "</label>" +
      '<select class="inp" id="a-holder"><option>' + L("All", "全部") + "</option><option>" +
        L("Asset Holder A", "资产方 A") + "</option><option>" + L("Asset Holder B", "资产方 B") + "</select></div>" +
      '<div class="field"><label for="a-kw">' + L("Search", "搜索") + "</label>" +
      '<input class="inp" id="a-kw" type="search" placeholder="' +
        L("Token number, holder or minting hash", "代币编号、资产方企业名或铸造交易哈希") + '"></div>' +
      '<div class="acts"><button class="btn" type="button" data-act="clearfilter">' + L("Reset", "重置") + "</button>" +
      '<button class="btn primary" type="button" data-act="clearfilter">' + L("Search", "查询") + "</button></div>" +
      "</div>";

    var table = '<div class="tablewrap listbox"><table class="tbl resp"><thead><tr>' +
      "<th>" + L("Token", "代币") + "</th><th>" + L("Token number", "代币编号") + "</th>" +
      "<th>" + L("Asset holder", "资产方企业") + "</th><th>" + L("Token type", "代币类型") + "</th>" +
      "<th>" + L("Token quantity", "代币数量") + "</th>" +
      sortTh("val", L("Token value", "代币价值")) +
      "<th>" + L("Token status", "代币状态") + "</th><th>" + L("Pledge status", "质押状态") + "</th>" +
      sortTh("to", L("Receivable term", "底层应收账款账期")) +
      sortTh("at", L("Minted at", "铸造时间")) +
      "</tr></thead><tbody>" +
      sortedAssets().slice(0, S.shown).map(assetRow).join("") +
      "</tbody></table>" + CF.moreFoot(total) + "</div>";

    return head + summary + '<div style="height:var(--sp-6)"></div>' +
      '<div class="card">' + filters + (alt || table) + "</div>";
  }

  /* ====================== 借贷广场 ====================================== */
  function reqRow(r) {
    var guest = S.role === "guest";
    var canQuote = !guest && S.role === "fund" && r.st === "quoting";
    var quoteAttrs = canQuote
      ? ' data-act="quote" data-v="' + esc(r.id) + '"'
      : ' class="actlink off" aria-disabled="true" title="' + esc(guest
          ? L("Sign in to submit a quote.", "登录后可提交报价。")
          : L("Quoting is limited to funder accounts on requests that are receiving quotes.", "仅资金方账号可对报价中的需求提交报价。")) + '"';
    return "<tr>" +
      '<td data-label="' + L("Request", "需求") + '"><div class="tok">' + tokMark(r.holder[0].slice(-1)) +
        '<div class="cell-wrap"><div class="cell-main mono nw">' + esc(r.id) + "</div>" +
        '<div class="cell-sub">' + esc(nm(r.holder)) + "</div></div></div></td>" +
      '<td data-label="' + L("Amount", "金额") + '" class="num">' + CF.fmtAmt(r.amt, r.ccy) + "</td>" +
      '<td data-label="' + L("Tenor", "期限") + '">' + r.tenor + L(" days", " 天") + "</td>" +
      '<td data-label="' + L("Rate", "年化") + '" class="num">' + esc(r.rate) + " %</td>" +
      '<td data-label="' + L("Pledged token", "质押代币") + '"><span class="hash">' + esc(r.token) + "</span></td>" +
      '<td data-label="' + L("Status", "状态") + '">' + stTag(r.st) + "</td>" +
      '<td data-label="' + L("Updated", "更新") + '" class="tiny">' + CF.fmtTime(r.at) + "</td>" +
      '<td class="col-act">' +
        '<a class="actlink" href="#/marketplace" data-act="detail" data-v="' + esc(r.id) + '">' + L("View", "查看") + "</a>" +
        (canQuote
          ? '<a class="actlink"' + quoteAttrs + ">" + L("Quote", "报价") + "</a>"
          : "<span" + quoteAttrs + ">" + L("Quote", "报价") + "</span>") +
      "</td></tr>";
  }

  function sortedRequests() {
    var list = REQUESTS.slice();
    var key = S.sort === "amt" ? "amt" : "at", dir = S.sortDir === "asc" ? 1 : -1;
    list.sort(function (a, b) { return a[key] > b[key] ? dir : (a[key] < b[key] ? -dir : 0); });
    return list;
  }

  function pagePlaza() {
    var guest = S.role === "guest";
    var alt = CF.surface({
      skelRows: 5,
      emptyTitle: L("No open financing requests", "暂无在招标的融资需求"),
      emptyDesc: L("Published requests appear here. Drafts are not listed.", "已发布的需求会出现在这里，草稿不进入广场。")
    });
    var head = '<div class="page-head"><div>' +
      '<h1 class="page-title">' + L("Lending marketplace", "借贷广场") + "</h1>" +
      '<p class="page-desc">' + L(
        "Financing requests backed by pledged receivable pools.",
        "由已质押应收账款池支撑的融资需求。") + "</p></div>" +
      (guest ? "" : '<div class="page-actions"><button class="btn primary" type="button" data-act="toast" data-v="new">' +
        L("Publish a request", "发布融资需求") + "</button></div>") +
      "</div>";

    var guestNote = guest
      ? CF.note("accent", "<div>" + L(
          "Everything on this page is public. Sign in to act on it.",
          "本页信息全量公开，登录后即可操作。") +
          ' <button class="btn-link" type="button" data-act="signin">' + L("Sign in", "登录") +
          '<span class="ar" aria-hidden="true">&rarr;</span></button></div>') + '<div style="height:var(--sp-5)"></div>'
      : "";

    var table = '<div class="tablewrap listbox"><table class="tbl resp"><thead><tr>' +
      "<th>" + L("Request", "需求") + "</th>" + sortTh("amt", L("Amount", "金额")) +
      "<th>" + L("Tenor", "期限") + "</th><th>" + L("Rate", "年化") + "</th>" +
      "<th>" + L("Pledged token", "质押代币") + "</th><th>" + L("Status", "状态") + "</th>" +
      sortTh("at", L("Updated", "更新")) + '<th class="col-act">' + L("Actions", "操作") + "</th>" +
      "</tr></thead><tbody>" +
      sortedRequests().slice(0, S.shown).map(reqRow).join("") +
      "</tbody></table>" + CF.moreFoot(REQUESTS.length) + "</div>";

    return head + guestNote +
      '<div class="card"><div class="filters">' +
      '<div class="field"><label for="p-ccy">' + L("Currency", "币种") + "</label>" +
      '<select class="inp" id="p-ccy"><option>' + L("All", "全部") + "</option><option>USD</option><option>EUR</option></select></div>" +
      '<div class="field"><label for="p-tenor">' + L("Tenor", "期限") + "</label>" +
      '<select class="inp" id="p-tenor"><option>' + L("All", "全部") + "</option><option>60</option><option>90</option><option>120</option></select></div>" +
      '<div class="field"><label for="p-kw">' + L("Keyword", "关键词") + "</label>" +
      '<input class="inp" id="p-kw" type="search" placeholder="' + L("Request ID or holder", "需求编号或资产方") + '"></div>' +
      '<div class="acts"><button class="btn" type="button" data-act="clearfilter">' + L("Reset", "重置") + "</button>" +
      '<button class="btn primary" type="button" data-act="clearfilter">' + L("Search", "查询") + "</button></div>" +
      "</div>" + (alt || table) + "</div>";
  }

  /* ====================== 我的控制台 ==================================== */
  function pageConsole() {
    if (S.role === "guest") {
      return '<div class="card"><div class="tbl-empty"><b>' +
        L("Sign in to open your console", "登录后查看你的控制台") + "</b>" +
        L("The console shows only your own requests, quotes and repayment schedule.",
          "控制台只展示属于你自己的需求、报价与还款计划。") +
        '<div><button class="btn primary" type="button" data-act="signin" style="margin-top:var(--sp-4)">' +
        L("Sign in", "登录") + "</button></div></div></div>";
    }
    var alt = CF.surface({
      skelRows: 4, backTo: "/marketplace",
      emptyTitle: L("Nothing here yet", "暂无记录"),
      emptyDesc: L("Your requests appear here once you publish one.", "发布融资需求后会出现在这里。")
    });
    var mine = REQUESTS.filter(function (r) { return r.holder[0] === "Asset Holder A"; });
    var SIZE = 5, from = (S.pageNo - 1) * SIZE;
    var rows = mine.slice(from, from + SIZE).map(function (r) {
      return "<tr>" +
        '<td data-label="' + L("Request", "需求") + '"><span class="mono cell-main">' + esc(r.id) + "</span></td>" +
        '<td data-label="' + L("Amount", "金额") + '" class="num">' + CF.fmtAmt(r.amt, r.ccy) + "</td>" +
        '<td data-label="' + L("Status", "状态") + '">' + stTag(r.st) + "</td>" +
        '<td data-label="' + L("Updated", "更新") + '" class="tiny">' + CF.fmtTime(r.at) + "</td>" +
        '<td class="col-act"><a class="actlink" href="#/marketplace" data-act="detail" data-v="' + esc(r.id) + '">' +
        L("View", "查看") + "</a></td></tr>";
    }).join("");
    var pager = CF.pagerFoot(mine.length, SIZE);

    return '<div class="page-head"><div>' +
      '<h1 class="page-title">' + L("My console", "我的控制台") + "</h1>" +
      '<p class="page-desc">' + L("A read-only summary of your own activity.", "你自己业务的只读汇总。") + "</p></div></div>" +
      '<div class="stat-row" style="margin-bottom:var(--sp-6)">' +
      '<div class="stat"><div class="k">' + L("Active requests", "进行中的需求") + '</div><div class="v">2</div>' +
      '<div class="n">' + L("1 receiving quotes", "其中 1 条报价中") + "</div></div>" +
      '<div class="stat"><div class="k">' + L("Pledged value", "质押金额") + '</div><div class="v">' +
      CF.fmtAmt(1250000, "USD") + '</div><div class="n">' + L("1 pool", "1 个资产池") + "</div></div>" +
      '<div class="stat"><div class="k">' + L("Next repayment", "下一期还款") + '</div><div class="v">' +
      CF.fmtAmt(158400, "USD") + '</div><div class="n">' + CF.fmtDate("2026-10-08T00:00:00") + "</div></div>" +
      "</div>" +
      '<div class="card"><div class="card-head">' + L("My financing requests", "我的融资需求") + "</div>" +
      (alt || '<div class="tablewrap"><table class="tbl resp"><thead><tr><th>' +
        L("Request", "需求") + "</th><th>" + L("Amount", "金额") + "</th><th>" + L("Status", "状态") +
        "</th><th>" + L("Updated", "更新") + '</th><th class="col-act">' + L("Actions", "操作") +
        "</th></tr></thead><tbody>" + rows + "</tbody></table></div>" + pager) +
      "</div>";
  }

  /* ====================== 管理端：总览 ================================== */
  function pageOverview() {
    var alt = CF.surface({
      skelRows: 4,
      emptyTitle: L("Nothing waiting on you", "暂无待办"),
      emptyDesc: L("Submitted reviews appear here.", "提交上来的审核会出现在这里。")
    });
    var rows = REQUESTS.slice(0, 3).map(function (r) {
      return "<tr>" +
        '<td data-label="' + L("Request", "需求") + '"><div class="cell-wrap">' +
          '<span class="mono cell-main">' + esc(r.id) + "</span>" +
          '<div class="cell-sub">' + esc(nm(r.holder)) + "</div></div></td>" +
        '<td data-label="' + L("Amount", "金额") + '" class="num">' + CF.fmtAmt(r.amt, r.ccy) + "</td>" +
        '<td data-label="' + L("Status", "状态") + '">' + stTag(r.st) + "</td>" +
        '<td data-label="' + L("Updated", "更新") + '" class="tiny">' + CF.fmtTime(r.at) + "</td>" +
        "</tr>";
    }).join("");
    return '<div class="page-head"><div><h1 class="page-title">' + L("Overview", "总览") + "</h1>" +
      '<p class="page-desc">' + L("Operations workload across the lending platform.", "借贷平台运营侧的工作量概览。") +
      "</p></div></div>" +
      '<div class="stat-row" style="margin-bottom:var(--sp-6)">' +
      '<div class="stat"><div class="k">' + L("Pledge reviews pending", "待审核质押") + '</div><div class="v">3</div></div>' +
      '<div class="stat"><div class="k">' + L("Funder applications", "资金方入驻申请") + '</div><div class="v">2</div></div>' +
      '<div class="stat"><div class="k">' + L("Agreements effective", "生效中的协议") + '</div><div class="v">2</div></div>' +
      "</div>" +
      '<div class="card"><div class="card-head">' + L("Recent financing activity", "最近的融资动态") + "</div>" +
      (alt || '<div class="tablewrap"><table class="tbl"><thead><tr><th>' + L("Request", "需求") +
        "</th><th>" + L("Amount", "金额") + "</th><th>" + L("Status", "状态") + "</th><th>" +
        L("Updated", "更新") + "</th></tr></thead><tbody>" + rows + "</tbody></table></div>") +
      "</div>";
  }

  /* ====================== 管理端：协议管理 ============================== */
  function pageAgreements() {
    var alt = CF.surface({
      skelRows: 4,
      emptyTitle: L("No agreements yet", "暂无协议"),
      emptyDesc: L("Published agreement versions appear here.", "发布后的协议版本会出现在这里。")
    });
    var rows = AGREEMENTS.map(function (a) {
      return "<tr>" +
        '<td data-label="' + L("Code", "编码") + '"><span class="mono cell-main">' + esc(a.code) + "</span></td>" +
        '<td data-label="' + L("Agreement", "协议") + '">' + esc(nm(a.name)) + "</td>" +
        '<td data-label="' + L("Version", "版本") + '" class="num">' + esc(a.ver) + "</td>" +
        '<td data-label="' + L("Status", "状态") + '">' + stTag(a.st) + "</td>" +
        '<td data-label="' + L("Takes effect", "生效时间") + '" class="tiny">' + CF.fmtTime(a.eff) + "</td>" +
        '<td class="col-act"><a class="actlink" href="#/ops/agreements" data-act="agdetail" data-v="' +
          esc(a.code) + '">' + L("Details", "详情") + "</a>" +
        (a.st === "archived"
          ? '<span class="actlink off" aria-disabled="true" title="' +
            esc(L("Archived versions cannot be edited.", "已归档版本不可编辑。")) + '">' + L("Edit", "编辑") + "</span>"
          : '<a class="actlink" href="#/ops/agreements" data-act="toast" data-v="edit">' + L("Edit", "编辑") + "</a>") +
        "</td></tr>";
    }).join("");
    return '<div class="page-head"><div><h1 class="page-title">' + L("Agreements", "协议管理") + "</h1>" +
      '<p class="page-desc">' + L("Agreement versions shown to platform users.", "面向平台用户展示的协议版本。") +
      '</p></div><div class="page-actions">' +
      '<button class="btn primary" type="button" data-act="toast" data-v="newver">' +
      L("New version", "新建版本") + "</button></div></div>" +
      '<div class="card"><div class="filters">' +
      '<div class="field"><label for="a-st">' + L("Status", "状态") + "</label>" +
      '<select class="inp" id="a-st"><option>' + L("All", "全部") + "</option><option>" +
      L("Effective", "生效中") + "</option><option>" + L("Takes effect later", "待生效") + "</option><option>" +
      L("Archived", "已归档") + "</option></select></div>" +
      '<div class="field"><label for="a-kw">' + L("Keyword", "关键词") + "</label>" +
      '<input class="inp" id="a-kw" type="search" placeholder="' + L("Code or name", "编码或名称") + '"></div>' +
      '<div class="acts"><button class="btn" type="button" data-act="clearfilter">' + L("Reset", "重置") + "</button></div>" +
      "</div>" +
      (alt || '<div class="tablewrap"><table class="tbl"><thead><tr><th>' + L("Code", "编码") +
        "</th><th>" + L("Agreement", "协议") + "</th><th>" + L("Version", "版本") + "</th><th>" +
        L("Status", "状态") + "</th><th>" + L("Takes effect", "生效时间") + '</th><th class="col-act">' +
        L("Actions", "操作") + "</th></tr></thead><tbody>" + rows + "</tbody></table></div>") +
      "</div>";
  }

  /* ====================== 抽屉 ========================================== */
  var layers = {
    reqDetail: function (id) {
      var r = REQUESTS.filter(function (x) { return x.id === id; })[0];
      if (!r) return null;
      var guest = S.role === "guest";
      var canQuote = !guest && S.role === "fund" && r.st === "quoting";
      return {
        title: L("Financing request", "融资需求") + " · " + r.id,
        html: '<div style="margin-bottom:var(--sp-5)">' + stTag(r.st) + "</div>" +
          '<dl class="dl">' +
          "<dt>" + L("Requested by", "发起方") + "</dt><dd>" + esc(nm(r.holder)) + "</dd>" +
          "<dt>" + L("Amount", "金额") + '</dt><dd class="num">' + CF.fmtAmt(r.amt, r.ccy) + "</dd>" +
          "<dt>" + L("Tenor", "期限") + "</dt><dd>" + r.tenor + L(" days", " 天") + "</dd>" +
          "<dt>" + L("Indicative rate", "参考年化") + '</dt><dd class="num">' + esc(r.rate) + " %</dd>" +
          "<dt>" + L("Pledged token", "质押代币") + '</dt><dd><span class="hash">' + esc(r.token) + "</span></dd>" +
          "<dt>" + L("Last updated", "最后更新") + "</dt><dd>" + CF.fmtTime(r.at) + "</dd>" +
          "</dl>" +
          (guest ? '<div style="margin-top:var(--sp-6)">' + CF.note("accent",
            "<div>" + L("Everything here is public. Sign in to act on it.", "此处信息全量公开，登录后即可操作。") +
            "</div>") + "</div>" : ""),
        foot: guest
          ? '<button class="btn primary" type="button" data-act="signin">' + L("Sign in", "登录") + "</button>"
          : '<button class="btn" type="button" data-act="closelayer">' + L("Close", "关闭") + "</button>" +
            '<button class="btn primary" type="button"' + (canQuote ? ' data-act="quote" data-v="' + esc(r.id) + '"' :
              ' aria-disabled="true" title="' + esc(L("Quoting is limited to funder accounts on requests that are receiving quotes.",
              "仅资金方账号可对报价中的需求提交报价。")) + '"') + ">" + L("Submit a quote", "提交报价") + "</button>"
      };
    },
    agDetail: function (code) {
      var a = AGREEMENTS.filter(function (x) { return x.code === code; })[0];
      if (!a) return null;
      return {
        title: nm(a.name) + " · " + a.ver,
        html: '<div style="margin-bottom:var(--sp-5)">' + stTag(a.st) + "</div>" +
          '<dl class="dl">' +
          "<dt>" + L("Code", "编码") + '</dt><dd class="mono">' + esc(a.code) + "</dd>" +
          "<dt>" + L("Version", "版本") + '</dt><dd class="num">' + esc(a.ver) + "</dd>" +
          "<dt>" + L("Takes effect", "生效时间") + "</dt><dd>" + CF.fmtTime(a.eff) + "</dd>" +
          "</dl>",
        foot: '<button class="btn" type="button" data-act="closelayer">' + L("Close", "关闭") + "</button>"
      };
    }
  };

  /* ====================== 页脚（Ft1） =================================== */
  function renderFoot() {
    var el = document.getElementById("foot");
    if (!el) return;
    el.innerHTML = '<div class="ft-in">' +
      '<p class="ft-mark">Harbour Credit</p>' +
      '<p class="ft-tag">' + L(
        "Cross-border receivables financing on tokenised assets.",
        "基于代币化资产的跨境应收账款融资。") + "</p>" +
      '<nav class="ft-links" aria-label="' + L("Footer", "页脚") + '">' +
      '<a href="#/" data-act="toast" data-v="terms">' + L("Terms", "服务协议") + "</a>" +
      '<a href="#/" data-act="toast" data-v="privacy">' + L("Privacy", "隐私声明") + "</a>" +
      '<a href="#/" data-act="toast" data-v="risk">' + L("Risk disclosure", "风险揭示") + "</a>" +
      '<a href="#/" data-act="toast" data-v="contact">' + L("Contact", "联系我们") + "</a>" +
      "</nav>" +
      '<div class="ft-meta"><span>' + L("Prototype baseline", "原型底座样板") + "</span>" +
      "<span>" + L("Demonstration data — not real companies, amounts or rates",
                   "演示数据 —— 非真实企业、金额或利率") + "</span>" +
      "<span>" + L("Times shown in", "时间时区") + " " + esc(S.tz || "UTC") + "</span></div></div>";
  }

  /* ====================== 模块接入 ====================================== */
  var PAGE_FN = {
    "P-F51": pageHome, "P-F-AM-01": pageAssets, "P-LS-01": pagePlaza, "P-MC-01": pageConsole,
    "P-O06": pageOverview, "P-O-AG-01": pageAgreements
  };

  CF.renderFooter = renderFoot;
  CF.define({
    id: "lending-baseline",
    dict: dict,
    layers: layers,
    content: function (page) {
      renderFoot();
      if (page === "DEMO-FOCUS") return '<h1 class="page-title">' + L('Centered card', '居中卡片') + '</h1><p class="page-desc">' + L('A focused task with lightweight tools.', '聚焦单一任务，保留轻量工具。') + '</p><p><a class="btn" href="#/">' + L('Back to sample', '返回样板') + '</a></p>';
      // 目标页自行处理承载单元；未知锚点与未知对象不打开抽屉。
      var q = new URLSearchParams(location.hash.split("?")[1] || "");
      if (page === "P-LS-01" && q.get("panel") === "detail" && REQUESTS.some(function(r){ return r.id === q.get("object"); })) {
        if (CF.lastSampleTarget !== location.hash) S.layer = {type:"drawer",key:"reqDetail",data:q.get("object")};
        CF.lastSampleTarget = location.hash;
      } else CF.lastSampleTarget = null;
      var fn = PAGE_FN[page];
      return fn ? fn() : "";
    },
    onAct: function (act, v) {
      if (act === "detail") { CF.openLayer("drawer", "reqDetail", v); return true; }
      if (act === "agdetail") { CF.openLayer("drawer", "agDetail", v); return true; }
      if (act === "sort") {
        if (S.sort === v) { S.sortDir = S.sortDir === "asc" ? "desc" : "asc"; }
        else { S.sort = v; S.sortDir = "desc"; }
        CF.resetList();
        return true;
      }
      if (act === "copy") {
        try {
          if (navigator.clipboard) navigator.clipboard.writeText(v);
          CF.toast(L("Token number copied.", "代币编号已复制。"));
        } catch (e) {
          CF.toast(L("Copy is unavailable here — select the number to copy it.",
                     "此处无法自动复制，请手动选中编号。"));
        }
        return true;
      }
      if (act === "quote") {
        CF.closeLayer();
        CF.toast(L("Quote submitted — demonstration only.", "报价已提交 —— 仅为演示。"));
        return true;
      }
      return false;
    }
  });

  if (!CF.deferBoot) CF.boot();
})(window.CF);
