/* WS-432 / WS-493: read-only demonstration snapshot for the homepage overview, illustration cards and verifier.
   Never used by marketplace business logic. Verifier records are copied from the asset marketplace demo data
   (03-资产广场/演示数据.js) so every example token number can also be found in the marketplace. */
window.CF.HomeData = {
  /* 业务概览：代币化资产总值与代币总量同一范围（全部已准入代币，含失效），签发时 1 USD 对应 1 枚；
     链上存证笔数按代币笔数计；累计融资额为 USDT、USDC 各按 1:1 折算后的 USD 合计。 */
  "totals": {
    "value": 46435001.50,
    "qty": 46435001.50,
    "fin": 1350000,
    "active": 8,
    "inst": 3,
    "att": 53
  },
  /* 首屏示意卡片的固定示例，不读取实时数据。项目质押率为资产方自填示例值。 */
  "hero": {
    "tokenNo": "TK20260612000147",
    "qty": 1250000.25,
    "pledgeValue": 500000,
    "ratio": 0.7
  },
  /* 存证校验的演示登记记录：资产广场展示范围内的代币（含失效）。同号的两笔资产槽位不同，逐笔返回；
     TK20260416000203 缺少链上存证交易哈希、区块高度与存证时间，用于演示缺项显示“—”。 */
  "tokens": [
    {"no":"TK20260612000147","slot":"260101","hash":"0x0d9d8f0067a813407bede2000b256a00213a52404864b500000741007ee4dd39","tx":"0x211f760074596e005d9806004f8ebe0051ab16006a8c8e00051ca6004bc6de40","block":21486312,"chain":"Ethereum","at":"2026-06-11 22:14 UTC"},
    {"no":"TK20260220000092","slot":"260104","hash":"0x681fd40000257400314a94395300aa806a3bc800226458004789a80056ccb800","tx":"0x7ba1bb000cd6cf00048853401ae922802cc6e0c03da862005a8dea0047b8d200","block":20874155,"chain":"Ethereum","at":"2026-02-19 20:02 UTC"},
    {"no":"TK20260903000415","slot":"260107","hash":"0x28ec3f0021c90300738077005bf4db0023fb6f0047e073006f9b270074f1cb00","tx":"0x7e34748052d4ca00562632007d7f7a00227322000b61aa00166192401f9af580","block":21702880,"chain":"Ethereum","at":"2026-09-02 19:41 UTC"},
    {"no":"TK20260509000276","slot":"260113","hash":"0x08c031002ec30d40569654002399f40048e514004da1b4000ab1d400344f7440","tx":"0x5e0866805fced40047a874000e119400509434402085ef0001d8f3005569a738","block":21322509,"chain":"Ethereum","at":"2026-05-08 21:17 UTC"},
    {"no":"TK20260705000288","slot":"260116","hash":"0x5a87b600293cae001fda46003543fe00595756002a63ce004942e60077901e00","tx":"0x2fcfeb805a48758065a738000b43080067fa9840219683007afff700663e5b00","block":21551904,"chain":"Ethereum","at":"2026-07-04 23:28 UTC"},
    {"no":"TK20260818000361","slot":"260119","hash":"0x19cd910044b4ed4020d2b400648ed4004d68740000d194002c54343823137c00","tx":"0x6f15c60012997e0023bed6405308e90047c965000b86310031110d4015cc5400","block":21648073,"chain":"Ethereum","at":"2026-08-17 15:09 UTC"},
    {"no":"TK20260416000203","slot":"260122","hash":"0x497a570059993b0078384f00720bd3005b530700187c2b0003f87f401313de80","tx":null,"block":null,"chain":"Ethereum","at":null},
    {"no":"TK20260705000288","slot":"260125","hash":"0x37a2cc684b08e8807ca22e000f11c60078e57e404bae710045b44d002b3af900","tx":"0x4b24b3001f2a67005a700b00270edf002347230043f4170017effb0071a80f40","block":21553117,"chain":"Ethereum","at":"2026-07-05 03:10 UTC"},
    {"no":"TK20260102000500","slot":"260128","hash":"0x39f99f0037bae3003dbcd7001ce9bb00287ecf406ca3ee0048508600771d3e00","tx":"0x0f41d400059f744023d02f806b1d69802aab1c0075631c0055bb1c002b331c00","block":21018500,"chain":"Ethereum","at":"2026-01-02 00:10 UTC"}
  ],
  /* 融资动态播报：只有融资需求（USDT）与放款（USDT 或 USDC）两类，按发生时间从近到远。
     每条只有事件类型与金额（带币种）。 */
  "activity": [
    ["Financing request", "融资需求", "300,000.00 USDT"],
    ["Disbursement", "放款", "150,000.00 USDC"],
    ["Financing request", "融资需求", "120,000.00 USDT"],
    ["Disbursement", "放款", "200,000.00 USDT"],
    ["Disbursement", "放款", "240,000.00 USDC"],
    ["Financing request", "融资需求", "450,000.00 USDT"],
    ["Disbursement", "放款", "180,000.00 USDT"],
    ["Financing request", "融资需求", "90,000.00 USDT"]
  ]
};
