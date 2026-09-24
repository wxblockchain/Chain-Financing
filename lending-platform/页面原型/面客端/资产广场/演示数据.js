/* ==========================================================================
   演示数据.js — 资产广场（已上架代币只读域）的演示数据
   全部为演示数据，不对应任何真实企业、金额、账期、地址或交易。
   链上地址与哈希按格式规则生成，指向的不是任何真实链上对象。
   ========================================================================== */
(function (CF) {
  var AM = (CF.AM = CF.AM || {});

  /* 本期唯一的代币发行合约与唯一的质押链。合约名称与地址属平台自身的公开部署信息。 */
  AM.CONTRACT = {
    name: ["HC Receivables Token", "HC 应收账款代币"],
    addr: "0x7a41c9f0b2d85e6431cc0a9e7f2b5d8e31047ca6"
  };
  /* 质押链：代币与质押合约所在链。结算收款链属企业账户模块，不在本模块出现。 */
  AM.CHAIN = "ETH";
  AM.CHAIN_ID = "1";
  AM.EXPLORER_TX = "https://etherscan.io/tx/";
  /* 代币标准与底层资产类型合并后的单一取值；本期配置表只有这一行。 */
  AM.TOKEN_TYPE = ["ERC-20-Receivables", "ERC-20-应收账款"];

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

  /* 本平台质押事实（权威在本平台），两根轴都不进页面：
     hold —— 代币与项目质押合约的当前关系
       in       代币在质押合约内
       exiting  自助解押已发起，链上转出尚未成功（代币仍在合约内）
       pending  质押上链处理中
       failed   质押上链失败
       out      解押转出完成
     review —— 质押审核结论：pending / approved / rejected。
       审核结论不改变对外的二元展示，只用来演示"已质押不等于已通过审核"。 */
  var PROJECTS = [
    { id: "S-FP-26090107", name: ["Receivables pool 26090107", "融资项目 26090107"], draft: false },
    { id: "S-FP-26082804", name: ["Receivables pool 26082804", "融资项目 26082804"], draft: false },
    { id: "S-FP-26091502", name: ["Receivables pool 26091502", "融资项目 26091502"], draft: true }
  ];

  /* 对外二元收敛的唯一判定：代币当前是否在项目质押合约内。 */
  AM.inPledgeContract = function (t) {
    var p = t && t.pl;
    return !!(p && p.project && (p.hold === "in" || p.hold === "exiting"));
  };

  var TOKENS = [];

  /* —— 手写的几条，覆盖详情页与列表上要看清的分支 —— */
  TOKENS.push({
    no: "TK20260612000147", name: "HC-AR-2606", holder: 0, buyer: 0,
    qty: 1250000.25, val: 1250000.25, ts: "valid",
    pl: { hold: "in", review: "approved", project: PROJECTS[0] },
    from: "2026-06-12", to: "2026-09-10", at: "2026-06-12T10:20:00",
    recvAmt: 1250000, recvCcy: "USD", trade: 0, settle: 0,
    mintTx: txHash(147),
    attest: { hash: "0x" + hex(9147, 64), tx: txHash(2147), block: 21486312, at: "2026-06-11T22:14:00" }
  });
  /* 失效 + 已质押：两个标签同时出现是正确的。 */
  TOKENS.push({
    no: "TK20260220000092", name: "HC-AR-2602", holder: 1, buyer: 1,
    qty: 460000.75, val: 460000.75, ts: "void",
    pl: { hold: "in", review: "approved", project: PROJECTS[1] },
    from: "2026-02-20", to: "2026-05-21", at: "2026-02-20T11:15:00",
    recvAmt: 398000, recvCcy: "EUR", trade: 1, settle: 1,
    mintTx: txHash(92),
    attest: { hash: "0x" + hex(9092, 64), tx: txHash(2092), block: 20874155, at: "2026-02-19T20:02:00" }
  });
  /* 在质押合约内、质押审核尚未通过，且所属融资项目还是草稿：给已质押标签，不给项目名与深链。 */
  TOKENS.push({
    no: "TK20260903000415", name: "HC-AR-2609", holder: 2, buyer: 2,
    qty: 1120000, val: 1120000, ts: "valid",
    pl: { hold: "in", review: "pending", project: PROJECTS[2] },
    from: "2026-09-03", to: "2027-01-01", at: "2026-09-03T08:30:00",
    recvAmt: 1120000, recvCcy: "USD", trade: 0, settle: 2,
    mintTx: txHash(415),
    attest: { hash: "0x" + hex(9415, 64), tx: txHash(2415), block: 21702880, at: "2026-09-02T19:41:00" }
  });
  /* 质押审核已驳回、尚未解押：代币仍在质押合约内，对外仍是已质押。 */
  TOKENS.push({
    no: "TK20260728000534", name: "HC-AR-2607B", holder: 1, buyer: 3,
    qty: 735000.5, val: 735000.5, ts: "valid",
    pl: { hold: "in", review: "rejected", project: PROJECTS[0] },
    from: "2026-07-28", to: "2026-12-24", at: "2026-07-28T14:06:00",
    recvAmt: 735000, recvCcy: "USD", trade: 2, settle: 1,
    mintTx: txHash(534),
    attest: { hash: "0x" + hex(9534, 64), tx: txHash(2534), block: 21598420, at: "2026-07-27T18:33:00" }
  });
  /* 自助解押已发起、链上转出尚未成功：代币物理上仍在质押合约内，仍按已质押与当前项目展示。 */
  TOKENS.push({
    no: "TK20260509000276", name: "HC-AR-2605", holder: 3, buyer: 4,
    qty: 980000, val: 980000, ts: "valid",
    pl: { hold: "exiting", review: "approved", project: PROJECTS[1] },
    from: "2026-05-09", to: "2026-11-05", at: "2026-05-09T09:48:00",
    recvAmt: 902000, recvCcy: "EUR", trade: 0, settle: 0,
    mintTx: txHash(276),
    attest: { hash: "0x" + hex(9276, 64), tx: txHash(2276), block: 21322509, at: "2026-05-08T21:17:00" }
  });
  /* 质押上链处理中：代币还不在质押合约内，对外是未质押。 */
  TOKENS.push({
    no: "TK20260705000288", name: "HC-AR-2607", holder: 3, buyer: 3,
    qty: 860000, val: 860000, ts: "valid",
    pl: { hold: "pending", review: null, project: PROJECTS[0] },
    from: "2026-07-05", to: "2026-11-02", at: "2026-07-05T09:05:00",
    recvAmt: 94600000, recvCcy: "JPY", trade: 2, settle: 0,
    mintTx: txHash(288),
    attest: { hash: "0x" + hex(9288, 64), tx: txHash(2288), block: 21551904, at: "2026-07-04T23:28:00" }
  });
  /* 代币名称未下发：该列展示合约名称，不自造符号。解押转出已完成，对外是未质押。 */
  TOKENS.push({
    no: "TK20260818000361", name: "", holder: 4, buyer: 4,
    qty: 2040000, val: 2040000, ts: "valid",
    pl: { hold: "out", review: "approved", project: PROJECTS[1] },
    from: "2026-08-18", to: "2026-10-17", at: "2026-08-18T16:40:00",
    recvAmt: 2040000, recvCcy: "USD", trade: 0, settle: 1,
    mintTx: txHash(361),
    attest: { hash: "0x" + hex(9361, 64), tx: txHash(2361), block: 21648073, at: "2026-08-17T15:09:00" }
  });
  /* 已同步的链上存证缺项：该区块按字段显示“—”，不隐藏整块。质押上链失败，对外是未质押。 */
  TOKENS.push({
    no: "TK20260416000203", name: "HC-AR-2604", holder: 5, buyer: 0,
    qty: 640000, val: 640000, ts: "valid",
    pl: { hold: "failed", review: null, project: PROJECTS[1] },
    from: "2026-04-16", to: "2026-10-14", at: "2026-04-16T13:52:00",
    recvAmt: 512000, recvCcy: "EUR", trade: 1, settle: 2,
    mintTx: txHash(203),
    attest: { hash: "0x" + hex(9203, 64), tx: "", block: null, at: "" }
  });

  /* —— 按同一形状补足到 52 条，只为演示每批 20 条的连续追加，全部仍是演示数据 —— */
  (function () {
    for (var i = 0; i < 44; i++) {
      var mo = (i % 9) + 1, day = (i % 26) + 2, seq = 500 + i * 7;
      var ds = "2026-" + pad(mo, 2) + "-" + pad(day, 2);
      var de = "2026-" + pad(Math.min(12, mo + 3), 2) + "-" + pad(day, 2);
      var qty = 180 + (i % 17) * 95;
      var pl = i % 3 === 0
        ? { hold: "in", review: i % 6 === 3 ? "pending" : "approved", project: PROJECTS[i % 2] }
        : (i % 7 === 2 ? { hold: "out", review: "approved", project: PROJECTS[1] }
                       : { hold: "none", review: null, project: null });
      var ccy = ["USD", "EUR", "USD", "JPY"][i % 4];
      TOKENS.push({
        no: "TK2026" + pad(mo, 2) + pad(day, 2) + pad(seq, 6),
        name: "HC-AR-26" + pad(mo, 2) + "-" + pad(i + 1, 2),
        holder: i % AM.HOLDERS.length, buyer: i % BUYERS.length,
        qty: qty * 1000, val: qty * 1000,
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

  // 独立编写的单地址虚构响应，只在评审工具选择时展示；不是铸造收币快照。
  // 不从总量推导地址份额，不模拟未经裁定的分份、多地址或多当前项目。
  // 在质押合约内的代币，当前地址就是该项目的质押合约地址。
  var PLEDGE_CONTRACT = {
    "S-FP-26090107": "0x9c07d41b6a5f2e8043bd17c9e0aa3f55d2618b07",
    "S-FP-26082804": "0x4e82a6d0917cb35fe2d84071aa9c6b3e50f71d28",
    "S-FP-26091502": "0x2b6f0ac5d34719e8ba05c7d61f4e93028ad5c614"
  };
  /* 持有事实与本平台质押事实是两个来源，按同一代币业务编号核对；核对不上走不可用。
     样例里两者一致，冲突场景由评审工具制造，不在数据里预置一份对不上的资料。 */
  AM.HOLDING_SAMPLES = {};
  (function () {
    TOKENS.forEach(function (t, i) {
      var inContract = AM.inPledgeContract(t);
      AM.HOLDING_SAMPLES[t.no] = { complete: true, rows: [{
        address: inContract ? PLEDGE_CONTRACT[t.pl.project.id] : "0x" + hex(4100 + i * 13, 40),
        qty: t.qty, value: t.val,
        pledged: inContract,
        project: inContract ? t.pl.project : null
      }] };
    });
  })();

  /* 评审工具里可直接打开的几张代币：覆盖已质押、草稿项目、审核驳回未解押、
     自助解押转出中和未质押五种落点，其余代币从列表进入。 */
  AM.SHOWCASE = [
    "TK20260612000147", "TK20260903000415", "TK20260728000534",
    "TK20260509000276", "TK20260818000361"
  ];

  AM.PROJECTS = PROJECTS;
  AM.TOKENS = TOKENS;
  AM.BUYERS = BUYERS;
  AM.TRADES = TRADES;
  AM.SETTLES = SETTLES;
})(window.CF = window.CF || {});
