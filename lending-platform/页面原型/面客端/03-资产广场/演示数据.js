/* ==========================================================================
   演示数据.js — 资产广场（已上架代币只读域）的演示数据
   全部为演示数据，不对应任何真实企业、金额、账期、地址或交易。
   链上地址与哈希按格式规则生成，指向的不是任何真实链上对象。
   ========================================================================== */
(function (CF) {
  var AM = (CF.AM = CF.AM || {});

  /* 本期唯一的代币发行合约与唯一的铸造链。合约名称与地址属平台自身的公开部署信息。 */
  AM.CONTRACT = {
    name: ["HC Receivables Token", "HC 应收账款代币"],
    addr: "0x7a41c9f0b2d85e6431cc0a9e7f2b5d8e31047ca6"
  };
  /* 铸造链：代币铸造所在的链。持有方地址、发行合约地址和铸造交易哈希都在这条链上。 */
  AM.CHAIN = "ETH";
  AM.EXPLORER_TX = "https://etherscan.io/tx/";
  /* 各链的区块浏览器交易页前缀：铸造交易按铸造链，存证交易按存证所在链。 */
  AM.EXPLORERS = { ETH: "https://etherscan.io/tx/", TRON: "https://tronscan.org/#/transaction/" };
  /* 代币标准与底层资产类型合并后的单一取值；本期配置表只有这一行。 */
  AM.TOKEN_TYPE = ["ERC-20-Receivables", "ERC-20-应收账款"];

  /* 发行方：一笔代币有且只有一个发行方。基础资料里的卖方企业名是另一字段，不假定与发行方相同。 */
  AM.ISSUERS = [
    ["Issuer A", "发行方 A"], ["Issuer B", "发行方 B"],
    ["Issuer C", "发行方 C"], ["Issuer D", "发行方 D"],
    ["Issuer E", "发行方 E"], ["Issuer F", "发行方 F"]
  ];
  var SELLERS = [
    ["Seller A", "卖方 A"], ["Seller B", "卖方 B"], ["Seller C", "卖方 C"],
    ["Seller D", "卖方 D"], ["Seller E", "卖方 E"], ["Seller F", "卖方 F"]
  ];
  var BUYERS = [
    ["Buyer A", "买方 A"], ["Buyer B", "买方 B"], ["Buyer C", "买方 C"],
    ["Buyer D", "买方 D"], ["Buyer E", "买方 E"]
  ];
  var TRADES = [
    ["General trade", "一般贸易"], ["Processing trade", "加工贸易"], ["Entrepot trade", "转口贸易"]
  ];
  var SETTLES = [
    ["T/T", "电汇 T/T"], ["Open account", "赊销 O/A"], ["D/P", "付款交单 D/P"]
  ];

  function pad(n, w) { return ("0000000000" + n).slice(-w); }

  /* 定值伪随机：同一份演示数据每次渲染结果一致，避免评审时数字跳动。 */
  function hex(seed, len) {
    var s = "", x = (seed * 2654435761) % 2147483647;
    while (s.length < len) {
      x = (x * 1103515245 + 12345) % 2147483648;
      s += pad(x.toString(16), 8);
    }
    return s.slice(0, len);
  }
  function txHash(seed) { return "0x" + hex(seed, 64); }

  var PROJECTS = [
    { id: "S-FP-26090107", name: ["Receivables pool 26090107", "融资项目 26090107"], published: true },
    { id: "S-FP-26082804", name: ["Receivables pool 26082804", "融资项目 26082804"], published: true },
    { id: "S-FP-26091502", name: ["Receivables pool 26091502", "融资项目 26091502"], published: false }
  ];
  var P0 = PROJECTS[0], P1 = PROJECTS[1], P2 = PROJECTS[2];
  var PLEDGE_CONTRACT = {
    "S-FP-26090107": "0x9c07d41b6a5f2e8043bd17c9e0aa3f55d2618b07",
    "S-FP-26082804": "0x4e82a6d0917cb35fe2d84071aa9c6b3e50f71d28",
    "S-FP-26091502": "0x2b6f0ac5d34719e8ba05c7d61f4e93028ad5c614"
  };

  /* 两个来源，按代币编号核对，页面只展示核对后的结果：
     AM.HOLDINGS[编号] —— 代币发行平台给出的当前全部持有方：[{ address, qty }]
     AM.PLEDGES[编号]  —— 借贷平台的质押记录：[{ contract, project, state, review }]
       state：in 在合约内仍属项目 · exiting 解押或撤回已发起、转出未成功 · released 项目关闭或结清后已业务释放、待提取
       review：质押审核结论，只用来演示"已质押不等于已通过审核"，不进页面。
     质押上链处理中 / 失败、转出完成的代币仍在企业地址，没有合约持有方，也不留质押记录。 */
  AM.HOLDINGS = {};
  AM.PLEDGES = {};
  function ent(seed) { return "0x" + hex(seed, 40); }
  /* spec：[[持有数量, 质押去向或 null]]；去向为 [项目, 状态, 审核结论] 时该持有方是项目质押合约。 */
  function hold(t, spec, seed) {
    AM.HOLDINGS[t.no] = []; AM.PLEDGES[t.no] = [];
    spec.forEach(function (x, k) {
      var where = x[1];
      var address = where ? PLEDGE_CONTRACT[where[0].id] : ent(seed + k * 31);
      AM.HOLDINGS[t.no].push({ address: address, qty: x[0] });
      if (where) AM.PLEDGES[t.no].push({ contract: address, project: where[0], state: where[1], review: where[2] || "approved" });
    });
  }

  var TOKENS = [];

  /* —— 手写的几条，覆盖详情页与列表上要看清的分支 —— */
  TOKENS.push({
    no: "TK20260612000147", logo: { shape: 0, hue: 1 }, name: "HC-AR-2606", issuer: 0, buyer: 0, seller: 0,
    qty: 1250000.25, val: 1250000.25, ts: "valid",
    from: "2026-06-12", to: "2026-09-10", at: "2026-06-12T10:20:00",
    recvAmt: 1250000, recvCcy: "USD", trade: 0, settle: 0,
    mintTx: txHash(147),
    attest: { hash: "0x" + hex(9147, 64), tx: txHash(2147), block: 21486312, at: "2026-06-11T22:14:00" }
  });
  hold(TOKENS[TOKENS.length - 1], [[1000000, [P0, "in"]], [250000.25, null]], 1029);
  /* 代币失效，持有方仍在质押合约内：代币状态失效与持有方已质押各自成立。 */
  TOKENS.push({
    no: "TK20260220000092", logo: { shape: 1, hue: 2 }, name: "HC-AR-2602", issuer: 1, buyer: 1, seller: 1,
    qty: 460000.75, val: 460000.75, ts: "void",
    from: "2026-02-20", to: "2026-05-21", at: "2026-02-20T11:15:00",
    recvAmt: 398000, recvCcy: "EUR", trade: 1, settle: 1,
    mintTx: txHash(92),
    attest: { hash: "0x" + hex(9092, 64), tx: txHash(2092), block: 20874155, at: "2026-02-19T20:02:00" }
  });
  hold(TOKENS[TOKENS.length - 1], [[460000.75, [P1, "in"]]], 644);
  /* 质押审核尚未通过、所属项目已通过审核但尚未发布：持有方已质押，只提示项目尚未公开。 */
  TOKENS.push({
    no: "TK20260903000415", logo: { shape: 2, hue: 3 }, name: "HC-AR-2609", issuer: 2, buyer: 2, seller: 2,
    qty: 1120000, val: 1120000, ts: "valid",
    from: "2026-09-03", to: "2027-01-01", at: "2026-09-03T08:30:00",
    recvAmt: 1120000, recvCcy: "USD", trade: 0, settle: 2,
    mintTx: txHash(415),
    attest: { hash: "0x" + hex(9415, 64), tx: txHash(2415), block: 21702880, at: "2026-09-02T19:41:00" }
  });
  hold(TOKENS[TOKENS.length - 1], [[1120000, [P2, "in", "pending"]]], 2905);
  /* 两个持有方分属两个融资项目，其中一笔质押审核已驳回、尚未解押，仍是已质押。 */
  TOKENS.push({
    no: "TK20260728000534", logo: { shape: 3, hue: 4 }, name: "HC-AR-2607B", issuer: 1, buyer: 3, seller: 5,
    qty: 735000.5, val: 735000.5, ts: "valid",
    from: "2026-07-28", to: "2026-12-24", at: "2026-07-28T14:06:00",
    recvAmt: 735000, recvCcy: "USD", trade: 2, settle: 1,
    mintTx: txHash(534),
    attest: { hash: "0x" + hex(9534, 64), tx: txHash(2534), block: 21598420, at: "2026-07-27T18:33:00" }
  });
  hold(TOKENS[TOKENS.length - 1], [[500000.5, [P0, "in", "rejected"]], [235000, [P1, "in"]]], 3738);
  /* 解押已发起、链上转出尚未成功：仍在质押合约内并属该项目，已质押。 */
  TOKENS.push({
    no: "TK20260509000276", logo: { shape: 1, hue: 1 }, name: "HC-AR-2605", issuer: 3, buyer: 4, seller: 3,
    qty: 980000, val: 980000, ts: "valid",
    from: "2026-05-09", to: "2026-11-05", at: "2026-05-09T09:48:00",
    recvAmt: 902000, recvCcy: "EUR", trade: 0, settle: 0,
    mintTx: txHash(276),
    attest: { hash: "0x" + hex(9276, 64), tx: txHash(2276), block: 21322509, at: "2026-05-08T21:17:00" }
  });
  hold(TOKENS[TOKENS.length - 1], [[980000, [P1, "exiting"]]], 1932);
  /* 质押上链处理中：代币仍在企业地址，未质押。 */
  TOKENS.push({
    no: "TK20260705000288", logo: { shape: 2, hue: 4 }, name: "HC-AR-2607", issuer: 3, buyer: 3, seller: 4,
    qty: 860000, val: 860000, ts: "valid",
    from: "2026-07-05", to: "2026-11-02", at: "2026-07-05T09:05:00",
    recvAmt: 94600000, recvCcy: "JPY", trade: 2, settle: 0,
    mintTx: txHash(288),
    attest: { hash: "0x" + hex(9288, 64), tx: txHash(2288), block: 21551904, at: "2026-07-04T23:28:00" }
  });
  hold(TOKENS[TOKENS.length - 1], [[860000, null]], 2016);
  /* 代币名称与标识图都未下发：名称展示合约名称，不自造符号或标识。两个企业地址持有，均未质押。 */
  TOKENS.push({
    no: "TK20260818000361", logo: null, name: "", issuer: 4, buyer: 4, seller: 4,
    qty: 2040000, val: 2040000, ts: "valid",
    from: "2026-08-18", to: "2026-10-17", at: "2026-08-18T16:40:00",
    recvAmt: 2040000, recvCcy: "USD", trade: 0, settle: 1,
    mintTx: txHash(361),
    attest: { hash: "0x" + hex(9361, 64), tx: txHash(2361), block: 21648073, at: "2026-08-17T15:09:00" }
  });
  hold(TOKENS[TOKENS.length - 1], [[1224000, null], [816000, null]], 2527);
  /* 已同步的链上存证缺项：该区块按字段显示“—”，不隐藏整块。质押上链失败，代币仍在企业地址。 */
  TOKENS.push({
    no: "TK20260416000203", logo: { shape: 0, hue: 3 }, name: "HC-AR-2604", issuer: 5, buyer: 0, seller: 5,
    qty: 640000, val: 640000, ts: "valid",
    from: "2026-04-16", to: "2026-10-14", at: "2026-04-16T13:52:00",
    recvAmt: 512000, recvCcy: "EUR", trade: 1, settle: 2,
    mintTx: txHash(203),
    attest: { hash: "0x" + hex(9203, 64), tx: "", block: null, at: "" }
  });
  hold(TOKENS[TOKENS.length - 1], [[640000, null]], 1421);

  /* —— 按同一形状补足到 52 条，只为演示每批 20 条的连续追加，全部仍是演示数据 —— */
  (function () {
    for (var i = 0; i < 44; i++) {
      var mo = (i % 9) + 1, day = (i % 26) + 2, seq = 500 + i * 7;
      var ds = "2026-" + pad(mo, 2) + "-" + pad(day, 2);
      var de = "2026-" + pad(Math.min(12, mo + 3), 2) + "-" + pad(day, 2);
      var qty = 180 + (i % 17) * 95;
      var ccy = ["USD", "EUR", "USD", "JPY"][i % 4];
      TOKENS.push({
        no: "TK2026" + pad(mo, 2) + pad(day, 2) + pad(seq, 6),
        name: "HC-AR-26" + pad(mo, 2) + "-" + pad(i + 1, 2),
        logo: i % 5 === 4 ? null : { shape: i % 4, hue: (i % 4) + 1 },
        issuer: i % AM.ISSUERS.length, buyer: i % BUYERS.length, seller: (i + 2) % SELLERS.length,
        qty: qty * 1000, val: qty * 1000,
        ts: i % 11 === 0 ? "void" : "valid",
        from: ds, to: de,
        at: ds + "T" + pad(8 + (i % 9), 2) + ":" + pad((i * 7) % 60, 2) + ":00",
        recvAmt: ccy === "JPY" ? qty * 110000 : qty * 1000, recvCcy: ccy,
        trade: i % TRADES.length, settle: i % SETTLES.length,
        mintTx: txHash(seq),
        attest: {
          hash: "0x" + hex(9000 + seq, 64), tx: txHash(2000 + seq),
          block: 21000000 + seq * 37, at: ds + "T0" + (i % 8) + ":1" + (i % 6) + ":00"
        }
      });
      var t = TOKENS[TOKENS.length - 1], q = t.qty;
      /* 已质押整笔在合约 / 业务释放待提取整笔在合约 / 两个企业地址分持 / 单个企业地址 */
      hold(t, i % 3 === 0 ? [[q, [PROJECTS[i % 2], "in", i % 6 === 3 ? "pending" : "approved"]]]
        : i % 7 === 2 ? [[q, [P1, "released"]]]
        : i % 4 === 1 ? [[Math.round(q * 70) / 100, null], [(Math.round(q * 100) - Math.round(q * 70)) / 100, null]]
        : [[q, null]], 4100 + i * 13);
    }
  })();

  /* 链上存证所在的链：资产可信平台本期在 Ethereum 上存证。 */
  TOKENS.forEach(function (t) { t.attest.chain = "ETH"; });

  /* 评审工具里可直接打开的几笔代币：部分质押、分属两个项目、项目尚未发布、解押转出中、
     业务释放待提取、两个企业地址分持、失效但持有方已质押。 */
  AM.SHOWCASE = [
    "TK20260612000147", "TK20260728000534", "TK20260903000415", "TK20260509000276",
    TOKENS.filter(function (t) { return AM.PLEDGES[t.no].some(function (r) { return r.state === "released"; }); })[0].no,
    "TK20260818000361", "TK20260220000092"
  ];

  AM.PROJECTS = PROJECTS;
  AM.PLEDGE_CONTRACT = PLEDGE_CONTRACT;
  AM.TOKENS = TOKENS;
  AM.SELLERS = SELLERS;
  AM.BUYERS = BUYERS;
  AM.TRADES = TRADES;
  AM.SETTLES = SETTLES;
})(window.CF = window.CF || {});
