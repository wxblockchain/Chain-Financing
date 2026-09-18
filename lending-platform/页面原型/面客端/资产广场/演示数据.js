/* ==========================================================================
   演示数据.js — 资产广场（已上架代币只读域）的演示数据
   全部为演示数据，不对应任何真实企业、金额、账期、地址或交易。
   链上地址与哈希按格式规则生成，指向的不是任何真实链上对象。
   ========================================================================== */
(function (CF) {
  var AM = (CF.AM = CF.AM || {});

  /* 本期唯一合约与唯一链。合约名称与地址属平台自身的公开部署信息。 */
  AM.CONTRACT = {
    name: ["HC Receivables Token", "HC 应收账款代币"],
    addr: "0x7a41c9f0b2d85e6431cc0a9e7f2b5d8e31047ca6"
  };
  AM.CHAIN = "ETH";
  AM.CHAIN_ID = "1";
  AM.EXPLORER_TX = "https://etherscan.io/tx/";

  AM.HOLDERS = [
    ["Asset Holder A", "资产方 A"], ["Asset Holder B", "资产方 B"],
    ["Asset Holder C", "资产方 C"], ["Asset Holder D", "资产方 D"],
    ["Asset Holder E", "资产方 E"], ["Asset Holder F", "资产方 F"]
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

  /* 本平台质押记录（融资事实，权威在本平台）。
     st: PS-1 可质押 / PS-2 已质押 / PS-4 已释放；chain: 链上转移结果。
     这两根轴只参与对外二元收敛，不进页面。 */
  var PROJECTS = [
    { id: "S-FP-26090107", name: ["Receivables pool 26090107", "融资项目 26090107"], draft: false },
    { id: "S-FP-26082804", name: ["Receivables pool 26082804", "融资项目 26082804"], draft: false },
    { id: "S-FP-26091502", name: ["Receivables pool 26091502", "融资项目 26091502"], draft: true }
  ];

  var TOKENS = [];

  /* —— 手写的几条，覆盖详情页与列表上要看清的分支 —— */
  TOKENS.push({
    no: "TK20260612000147", name: "HC-AR-2606", holder: 0, buyer: 0,
    qty: 1250, val: 1250000, ts: "valid",
    pl: { st: "PS-2", chain: "ok", project: PROJECTS[0] },
    from: "2026-06-12", to: "2026-09-10", at: "2026-06-12T10:20:00",
    recvAmt: 1250000, recvCcy: "USD", trade: 0, settle: 0,
    mintTx: txHash(147),
    attest: { hash: "0x" + hex(9147, 64), tx: txHash(2147), block: 21486312, at: "2026-06-11T22:14:00" }
  });
  /* 失效 + 已质押：两个标签同时出现是正确的。 */
  TOKENS.push({
    no: "TK20260220000092", name: "HC-AR-2602", holder: 1, buyer: 1,
    qty: 460, val: 460000, ts: "void",
    pl: { st: "PS-2", chain: "ok", project: PROJECTS[1] },
    from: "2026-02-20", to: "2026-05-21", at: "2026-02-20T11:15:00",
    recvAmt: 398000, recvCcy: "EUR", trade: 1, settle: 1,
    mintTx: txHash(92),
    attest: { hash: "0x" + hex(9092, 64), tx: txHash(2092), block: 20874155, at: "2026-02-19T20:02:00" }
  });
  /* 已质押，但所属融资项目还是草稿：给标签，不给深链。 */
  TOKENS.push({
    no: "TK20260903000415", name: "HC-AR-2609", holder: 2, buyer: 2,
    qty: 1120, val: 1120000, ts: "valid",
    pl: { st: "PS-2", chain: "ok", project: PROJECTS[2] },
    from: "2026-09-03", to: "2027-01-01", at: "2026-09-03T08:30:00",
    recvAmt: 1120000, recvCcy: "USD", trade: 0, settle: 2,
    mintTx: txHash(415),
    attest: { hash: "0x" + hex(9415, 64), tx: txHash(2415), block: 21702880, at: "2026-09-02T19:41:00" }
  });
  /* 链上转移处理中：对外保守显示未质押。 */
  TOKENS.push({
    no: "TK20260705000288", name: "HC-AR-2607", holder: 3, buyer: 3,
    qty: 860, val: 860000, ts: "valid",
    pl: { st: "PS-2", chain: "pending", project: PROJECTS[0] },
    from: "2026-07-05", to: "2026-11-02", at: "2026-07-05T09:05:00",
    recvAmt: 94600000, recvCcy: "JPY", trade: 2, settle: 0,
    mintTx: txHash(288),
    attest: { hash: "0x" + hex(9288, 64), tx: txHash(2288), block: 21551904, at: "2026-07-04T23:28:00" }
  });
  /* 代币名称未下发：该列展示合约名称，不自造符号。 */
  TOKENS.push({
    no: "TK20260818000361", name: "", holder: 4, buyer: 4,
    qty: 2040, val: 2040000, ts: "valid",
    pl: { st: "PS-4", chain: "ok", project: PROJECTS[1] },
    from: "2026-08-18", to: "2026-10-17", at: "2026-08-18T16:40:00",
    recvAmt: 2040000, recvCcy: "USD", trade: 0, settle: 1,
    mintTx: txHash(361),
    attest: { hash: "0x" + hex(9361, 64), tx: txHash(2361), block: 21648073, at: "2026-08-17T15:09:00" }
  });
  /* 已同步的链上存证缺项：该区块按字段显示“—”，不隐藏整块。 */
  TOKENS.push({
    no: "TK20260416000203", name: "HC-AR-2604", holder: 5, buyer: 0,
    qty: 640, val: 640000, ts: "valid",
    pl: { st: "PS-2", chain: "failed", project: PROJECTS[1] },
    from: "2026-04-16", to: "2026-10-14", at: "2026-04-16T13:52:00",
    recvAmt: 512000, recvCcy: "EUR", trade: 1, settle: 2,
    mintTx: txHash(203),
    attest: { hash: "0x" + hex(9203, 64), tx: "", block: null, at: "" }
  });

  /* —— 按同一形状补足到 52 条，只为演示每页 20 条的分页，全部仍是演示数据 —— */
  (function () {
    for (var i = 0; i < 46; i++) {
      var mo = (i % 9) + 1, day = (i % 26) + 2, seq = 500 + i * 7;
      var ds = "2026-" + pad(mo, 2) + "-" + pad(day, 2);
      var de = "2026-" + pad(Math.min(12, mo + 3), 2) + "-" + pad(day, 2);
      var qty = 180 + (i % 17) * 95;
      var pl = i % 3 === 0
        ? { st: "PS-2", chain: "ok", project: PROJECTS[i % 2] }
        : (i % 7 === 2 ? { st: "PS-4", chain: "ok", project: PROJECTS[1] } : { st: "PS-1", chain: "", project: null });
      var ccy = ["USD", "EUR", "USD", "JPY"][i % 4];
      TOKENS.push({
        no: "TK2026" + pad(mo, 2) + pad(day, 2) + pad(seq, 6),
        name: "HC-AR-26" + pad(mo, 2) + "-" + pad(i + 1, 2),
        holder: i % AM.HOLDERS.length, buyer: i % BUYERS.length,
        qty: qty, val: qty * 1000,
        ts: i % 11 === 0 ? "void" : "valid",
        pl: pl,
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
    }
  })();

  AM.TOKENS = TOKENS;
  AM.BUYERS = BUYERS;
  AM.TRADES = TRADES;
  AM.SETTLES = SETTLES;
})(window.CF = window.CF || {});
