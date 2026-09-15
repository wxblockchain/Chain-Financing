/* ==========================================================================
   mc-module.js — 金融服务端 · 我的控制台（WS-328）原型 v1.0
   PRD 基线：v1.0-我的控制台-PRD.md V2.0 + 分册 01 / 02（附件版，未入库）
   上游指针：WS-324 V9.2 / WS-325 V7.2 / WS-326 V3.2 / WS-327 V3.3（cly-V1.0.0 / 75aadef）

   本模块是登录后的个人数据聚合页，**零业务写操作**：页面上每一个动作按钮都是
   跳借贷广场的深链（落详情页 + 右侧抽屉 760px），控制台自己不提交任何业务。

   本文件只写本模块的页面、文案、演示数据与状态；
   token / 公共组件 / 运行时 / 页面登记一律来自 _shared，不在此重建。

   界面上不出现任何条款编号与验收编号（PRD 的界面红线）——编号只出现在
   顶栏「PRD」抽屉里，那是给实现方看的面板，不属于产品界面。
   ========================================================================== */
(function () {
"use strict";

var CF = window.CF, E = CF.esc, L = CF.L, q = CF.q, toast = CF.toast;
var S = null;

/* ================================================================
   Part A —— 术语、常量与演示数据
   全部业务数据为演示数据（虚构企业、编号、金额、哈希），
   仅用于走通界面与交互，不代表任何真实主体或交易。
   ================================================================ */

/* ---- 术语表：中英对照的唯一事实源是 WS-324 分册 7.6（D-LS-21）。
       V9.3 已把本模块产出的词原样收录，本轮反向同步该表统一的两处：
       ① 数值一律 Coverage gap，Coverage shortfall alert 只留给「覆盖不足提醒」这条消息；
       ② 对外状态「已报价待确认」= Awaiting quote confirmation（内部态 待接受
          Awaiting response 不再当对外词用）。本模块不自造英文。 ---- */
var G = {
  console       : ['My Console','我的控制台'],
  assetOwner    : ['Asset owner','资产方'],
  funder        : ['Funder','资金方'],
  project       : ['Financing project','融资项目'],
  demandNo      : ['Demand ID','需求编号'],
  dealNo        : ['Deal ID','融资业务编号'],
  coverage      : ['Pledge coverage status','质押覆盖状态'],
  covAmple      : ['Ample','覆盖有余'],
  covAt         : ['At capacity','覆盖持平'],
  covUnder      : ['Insufficient','覆盖不足'],
  coverageGap   : ['Coverage gap','覆盖缺口'],
  topUpNeeded   : ['Asset value to add','需追加资产价值'],
  pledgedValue  : ['Pledged token value','质押代币价值'],
  outstanding   : ['Outstanding financing','已融资余额'],
  pledgeRate    : ['Pledge rate','质押率'],
  demandAmt     : ['Financing demand','融资需求'],
  quoteConfirm  : ['Quote confirmation','报价确认'],
  disbConfirm   : ['Disbursement confirmation','放款确认'],
  repayConfirm  : ['Repayment confirmation','还款确认'],
  quoteWindow   : ['Quote validity window','报价有效期'],
  disbWindow    : ['Disbursement confirmation window','放款确认时限'],
  repayWindow   : ['Repayment confirmation window','还款确认时限'],
  repayType     : ['Repayment type','还款类型'],
  repayNature   : ['Repayment nature','还款性质'],
  finalDueDate  : ['Final repayment date','最终还款日'],
  creditLine    : ['Credit line','授信额度'],
  crUsedDeal    : ['Credit committed to deals','授信占用额'],
  crUsedQuote   : ['Credit committed to quotes','在途报价金额'],
  crUsedTotal   : ['Credit used (total)','授信已用额'],
  crAvail       : ['Available credit','可用授信'],
  tokens        : ['Token list','代币列表'],
  chain         : ['Chain','链']
};
function g(k) { var v = G[k]; return v ? L(v[0], v[1]) : k; }

var CCY = 'USD';
var NOW = '2026-09-15 15:20';            /* 演示"此刻"，所有倒计时都由它与服务端到期时刻算差 */
var TZ  = 'UTC+8';
var PLEDGE_RATE = 0.8;                   /* 质押率常量 80%：只展示，界面不得暗示可调 */
var CHAIN = 'ETH';                       /* 本期只有一条链，是常量不是选项 */
var TOKEN_STD = 'ERC-20';
var EXPLORER = 'https://etherscan.io/tx/';
var MAIL = 'support@chain-financing.example';   /* 客服邮箱占位，待业务方提供 */
var PAGE_SIZES = [20, 50, 100];

/* ---- 演示主体 ---- */
var CO = {
  'E-ASSET-01': ['Shengyuan Technology (demo)','晟远科技（演示）'],
  'E-ASSET-09': ['Hengsheng Supply Chain (demo)','恒盛供应链（演示）'],
  'E-ASSET-04': ['Mingtai Home Appliances (demo)','明泰家电（演示）'],
  'E-ASSET-07': ['Zhongyuan Building Materials (demo)','中垣建材（演示）'],
  'E-FUND-01' : ['Beian Leasing (demo)','北岸融资租赁（演示）'],
  'E-FUND-02' : ['Huanhai Commercial Factoring (demo)','环海商业保理（演示）'],
  'E-FUND-03' : ['Yunqi Commercial Factoring (demo)','云启商业保理（演示）']
};
function co(id) { var v = CO[id]; return v ? L(v[0], v[1]) : id; }
var ME = { asset: 'E-ASSET-01', fund: 'E-FUND-01' };
function me() { return ME[S.role]; }

var OPERATOR = {
  asset: ['Zhou Min','周敏'],
  fund : ['Chen Li','陈立']
};

var BUYERS = ['E-ASSET-09','E-ASSET-04','E-ASSET-07'];
var BUYER_NAMES = [
  ['Northern Manufacturing Group (demo)','北方制造集团（演示）'],
  ['Donghai Heavy Industry (demo)','东海重工（演示）'],
  ['Nanling Power Equipment (demo)','南岭电力设备（演示）'],
  ['Zhongyuan Building Materials (demo)','中垣建材（演示）'],
  ['Mingtai Home Appliances (demo)','明泰家电（演示）'],
  ['Ruihe Energy Equipment (demo)','瑞和能源装备（演示）']
];
function buyer(i) { var v = BUYER_NAMES[i % BUYER_NAMES.length]; return L(v[0], v[1]); }

/* ---- 枚举：一律引用上游取值，控制台不自造展示态 ---- */
var FP_ST = {
  'S-FP-1': [['Draft','草稿'], 'gray'],
  'S-FP-2': [['Open for quotes','募集中'], 'info'],
  'S-FP-3': [['Locked','已锁定'], 'info'],
  'S-FP-4': [['Financing','融资中'], 'info'],
  'S-FP-5': [['Closed','已关闭'], 'gray'],
  'S-FP-6': [['Settled','已结清'], 'gray']
};
/* 融资需求对外状态：五值，服务端派生下发；只作状态列展示、不做筛选标签 */
var DEMAND_ST = {
  open  : [['Awaiting quotes','待报价'], 'amber'],
  quoted: [['Awaiting quote confirmation','已报价待确认'], 'info'],
  disb  : [['Disbursing','放款中'], 'info'],
  funded: [['Disbursed','已放款'], 'green'],
  ended : [['Void / closed','已失效／已关闭'], 'gray']
};
var FD_ST = {
  'S-FD-1' : [['Awaiting response','待接受'], 'info'],
  'S-FD-2' : [['Declined','已拒绝'], 'gray'],
  'S-FD-11': [['Quote expired','报价已失效'], 'gray'],
  'S-FD-3' : [['Awaiting disbursement','待放款'], 'info'],
  'S-FD-4' : [['Awaiting disbursement confirmation','待放款确认'], 'info'],
  'S-FD-6' : [['Repaying','还款中'], 'green'],
  'S-FD-8' : [['Settled','已结清'], 'gray'],
  'S-FD-10': [['Terminated','已终止'], 'gray']
};
var RP_ST = {
  'S-RP-1': [['Awaiting repayment','待还款'], 'amber'],
  'S-RP-2': [['Awaiting repayment confirmation','待还款确认'], 'info'],
  'S-RP-3': [['Settled','已结清'], 'green']
};
var CR_ST = {
  'S-CR-1': [['Effective','生效中'], 'green'],
  'S-CR-2': [['Expired','已到期'], 'gray']
};
var COV = {
  ample: [['Ample','覆盖有余'], 'green'],
  at   : [['At capacity','覆盖持平'], 'gray'],
  under: [['Insufficient','覆盖不足'], 'amber']
};
var TOKEN_ST = {
  'TS-1': [['Valid','有效'], 'green'],
  'TS-2': [['Void','失效'], 'gray']
};
var PLEDGE_ST = {
  none    : [['Not pledged','未质押'], 'gray'],
  pledged : [['Pledged','已质押'], 'info'],
  released: [['Released · ready to withdraw','已释放 · 待提取'], 'amber']
};
var FP27 = {
  taken : ['Deal closed','成交'],
  pulled: ['Withdrawn by asset owner','资产方撤下'],
  closed: ['Project closed','项目关闭'],
  auto  : ['Auto-void · insufficient coverage','自动失效 · 覆盖不足']
};
/* 还款类型：单值定值，只读文本、不做下拉 */
var REPAY_TYPE = ['Quarterly interest; principal and interest at maturity','按季付息；到期还本付息'];

/* ---- 融资项目（资产方本主体名下） ---- */
var PROJECTS = [
  { id:'FP-20260416-0007', name:['Yangtze Delta medical device receivables pool','长三角医疗器械应收账款池'],
    owner:'E-ASSET-01', st:'S-FP-2', createdAt:'2026-04-16', expiresAt:'2027-04-20',
    tokenN:9, pledged:900000, valid:600000, voidN:2, voidAmt:300000,
    demand:200000, balance:500000, quotes:2, cov:'under', gap:20000,
    covSince:'2026-08-19',
    rounds:[
      { no:'FP-20260416-0007-01', amt:500000, st:'funded', end:'taken',
        fund:'E-FUND-01', at:'2026-05-06 10:12', deal:'FD-20260512-0044' },
      { no:'FP-20260416-0007-02', amt:200000, st:'ended', end:'auto', endAt:'2026-08-19 11:04' }
    ] },
  { id:'FP-20260812-0031', name:['East China electronic components receivables pool','华东电子元件应收账款池'],
    owner:'E-ASSET-01', st:'S-FP-3', createdAt:'2026-08-12', expiresAt:'2027-08-14',
    tokenN:3, pledged:1000000, valid:1000000, voidN:0, voidAmt:0,
    demand:500000, balance:0, quotes:1, cov:'ample',
    rounds:[
      { no:'FP-20260812-0031-01', amt:500000, st:'quoted', fund:'E-FUND-01',
        at:'2026-09-09 09:40', deal:'FD-20260908-0061', lockFrom:'2026-09-09 09:40',
        lockTo:'2026-09-16 09:40' }
    ] },
  { id:'FP-20260828-0042', name:['North China precision parts receivables pool','华北精密件应收账款池'],
    owner:'E-ASSET-01', st:'S-FP-3', createdAt:'2026-08-28', expiresAt:'2027-08-28',
    tokenN:4, pledged:500000, valid:500000, voidN:0, voidAmt:0,
    demand:300000, balance:0, quotes:1, cov:'ample',
    rounds:[
      { no:'FP-20260828-0042-01', amt:300000, st:'disb', fund:'E-FUND-01',
        at:'2026-09-10 14:05', deal:'FD-20260910-0067' }
    ] },
  { id:'FP-20260620-0015', name:['Southwest cold chain receivables pool','西南冷链应收账款池'],
    owner:'E-ASSET-01', st:'S-FP-3', createdAt:'2026-06-20', expiresAt:'2027-06-20',
    tokenN:4, pledged:420000, valid:420000, voidN:0, voidAmt:0,
    demand:300000, balance:0, quotes:1, cov:'ample',
    rounds:[
      { no:'FP-20260620-0015-01', amt:300000, st:'disb', fund:'E-FUND-02',
        at:'2026-08-28 16:30', deal:'FD-20260901-0052' }
    ] },
  { id:'FP-20260705-0026', name:['Pearl River Delta mould receivables pool','珠三角模具应收账款池'],
    owner:'E-ASSET-01', st:'S-FP-4', createdAt:'2026-06-05', expiresAt:'2027-06-05',
    tokenN:5, pledged:625000, valid:625000, voidN:0, voidAmt:0,
    demand:null, balance:500000, quotes:1, cov:'at',
    rounds:[
      { no:'FP-20260705-0026-01', amt:500000, st:'funded', end:'taken',
        fund:'E-FUND-02', at:'2026-06-10 11:25', deal:'FD-20260618-0027' }
    ] },
  { id:'FP-20260825-0039', name:['East China fine chemicals receivables pool','华东精化应收账款池'],
    owner:'E-ASSET-01', st:'S-FP-3', createdAt:'2026-08-25', expiresAt:'2027-08-25',
    tokenN:3, pledged:380000, valid:380000, voidN:0, voidAmt:0,
    demand:300000, balance:0, quotes:1, cov:'ample',
    rounds:[
      { no:'FP-20260825-0039-01', amt:300000, st:'disb', fund:'E-FUND-02',
        at:'2026-09-02 09:15', deal:'FD-20260902-0057' }
    ] },
  { id:'FP-20260901-0048', name:['Northwest energy equipment receivables pool','西北能源设备应收账款池'],
    owner:'E-ASSET-01', st:'S-FP-1', createdAt:'2026-09-01', expiresAt:'2027-09-01',
    tokenN:0, pledged:0, valid:0, voidN:0, voidAmt:0,
    demand:null, balance:0, quotes:0, cov:'ample', emptyPool:true, rounds:[] },
  { id:'FP-20260512-0009', name:['Central China packaging receivables pool','华中包装材料应收账款池'],
    owner:'E-ASSET-01', st:'S-FP-6', createdAt:'2026-03-01', expiresAt:'2027-03-01',
    tokenN:3, pledged:0, valid:0, voidN:0, voidAmt:0,
    demand:null, balance:0, quotes:1, cov:'ample', settledAt:'2026-09-05 10:40',
    redeemN:3, redeemAmt:260000,
    rounds:[
      { no:'FP-20260512-0009-01', amt:260000, st:'funded', end:'taken',
        fund:'E-FUND-03', at:'2026-03-04 15:10', deal:'FD-20260305-0018' }
    ] }
];
function proj(id) {
  for (var i = 0; i < PROJECTS.length; i++) if (PROJECTS[i].id === id) return PROJECTS[i];
  return null;
}
function projName(id) { var p = proj(id); return p ? L(p.name[0], p.name[1]) : id; }

/* ---- 代币（资产方本主体名下） ---- */
var TOKENS = (function () {
  var out = [], seq = 4100, i;
  var spec = [
    { pid:'FP-20260416-0007', pl:'pledged', n:7, amts:[92000,86000,75000,110000,64000,98000,75000], st:'TS-1' },
    { pid:'FP-20260416-0007', pl:'pledged', n:2, amts:[160000,140000], st:'TS-2' },
    { pid:'FP-20260812-0031', pl:'pledged', n:3, amts:[380000,330000,290000], st:'TS-1' },
    { pid:'FP-20260828-0042', pl:'pledged', n:4, amts:[150000,120000,130000,100000], st:'TS-1' },
    { pid:'FP-20260620-0015', pl:'pledged', n:4, amts:[120000,95000,105000,100000], st:'TS-1' },
    { pid:'FP-20260705-0026', pl:'pledged', n:5, amts:[145000,130000,120000,115000,115000], st:'TS-1' },
    { pid:'FP-20260825-0039', pl:'pledged', n:3, amts:[140000,125000,115000], st:'TS-1' },
    { pid:'FP-20260512-0009', pl:'released', n:3, amts:[95000,85000,80000], st:'TS-1' },
    { pid:null,               pl:'none',     n:6, amts:[105000,92000,88000,96000,84000,75000], st:'TS-1' }
  ];
  var dues = ['2026-11-20','2026-12-05','2027-01-18','2026-10-30','2026-11-11','2027-02-08','2026-12-19'];
  var issued = ['2026-09-08','2026-08-30','2026-08-21','2026-08-12','2026-07-28','2026-07-05',
                '2026-06-18','2026-05-22','2026-04-16','2026-03-02'];
  for (i = 0; i < spec.length; i++) {
    for (var k = 0; k < spec[i].n; k++) {
      seq++;
      out.push({
        id: 'TI-2026-' + (seq),
        amt: spec[i].amts[k],
        qty: 1,
        buyerIx: (i + k) % BUYER_NAMES.length,
        dueFrom: '2026-0' + (3 + (k % 5)) + '-0' + (1 + (k % 8)),
        dueTo: dues[(i + k) % dues.length],
        issuedAt: issued[(i * 2 + k) % issued.length],
        st: spec[i].st,
        pl: spec[i].pl,
        pid: spec[i].pid,
        releasedAt: spec[i].pl === 'released' ? '2026-09-05 10:40' : null
      });
    }
  }
  return out;
})();

/* ---- 授信额度：按「机构 × 资产方」企业二元组组织，不按项目拆 ---- */
var CREDITS = [
  { id:'CR-20260420-0011', asset:'E-ASSET-01', fund:'E-FUND-01', st:'S-CR-1',
    line:2000000, from:'2026-04-20', to:'2027-04-20', deal:500000, quote:800000, avail:700000,
    memo:['Reviewed with the 2026 H1 audited statements; next review before the maturity date.',
          '按 2026 上半年审计报表核定，到期前复核一次。'] },
  { id:'CR-20260702-0023', asset:'E-ASSET-01', fund:'E-FUND-02', st:'S-CR-1',
    line:1200000, from:'2026-07-02', to:'2027-07-02', deal:500000, quote:600000, avail:100000,
    memo:['Concentration on cold-chain receivables; watch the available balance.',
          '冷链类应收集中度偏高，关注可用授信余额。'] },
  { id:'CR-20251210-0002', asset:'E-ASSET-01', fund:'E-FUND-03', st:'S-CR-2',
    line:600000, from:'2025-12-10', to:'2026-09-10', deal:0, quote:0, avail:600000, memo:null },
  { id:'CR-20260215-0006', asset:'E-ASSET-09', fund:'E-FUND-01', st:'S-CR-1',
    line:1000000, from:'2026-02-15', to:'2027-02-15', deal:400000, quote:0, avail:600000,
    memo:['Buyer concentration acceptable; renewed in February.','买方集中度可接受，2 月已续做。'] },
  { id:'CR-20260428-0017', asset:'E-ASSET-04', fund:'E-FUND-01', st:'S-CR-1',
    line:800000, from:'2026-04-28', to:'2027-04-28', deal:500000, quote:0, avail:300000, memo:null },
  { id:'CR-20260610-0020', asset:'E-ASSET-07', fund:'E-FUND-01', st:'S-CR-1',
    line:500000, from:'2026-06-10', to:'2027-06-10', deal:0, quote:260000, avail:240000, memo:null }
];

/* ---- 融资业务：一处定义、两端各按归属过滤后消费（跨模块同源） ---- */
var DEALS = [
  { id:'FD-20260512-0044', pid:'FP-20260416-0007', round:'FP-20260416-0007-01',
    asset:'E-ASSET-01', fund:'E-FUND-01', st:'S-FD-6', amt:500000, rate:6.80,
    fx:1, settle:500000, quoteAt:'2026-05-06 10:12', demandSt:'funded',
    ln:{ at:'2026-05-12 10:20', submitAt:'2026-05-12 10:24', amt:500000,
         hash:'0x7c41b9e2a5d38f06c17b4e9a20d58f3612ca07be49d15f8a3c62047be91d5a08',
         proofN:2, memo:['Paid from the settlement account registered on the platform.','自平台登记的结算账户出账。'] },
    confirmAt:'2026-05-12 16:02', seal:{ has:true, at:'2026-05-08 11:30', versions:2 },
    finalDue:'2027-04-20', startDate:'2026-05-12' },
  { id:'FD-20260618-0027', pid:'FP-20260705-0026', round:'FP-20260705-0026-01',
    asset:'E-ASSET-01', fund:'E-FUND-02', st:'S-FD-6', amt:500000, rate:6.95,
    fx:1, settle:500000, quoteAt:'2026-06-10 11:25', demandSt:'funded',
    ln:{ at:'2026-06-18 09:40', submitAt:'2026-06-18 09:46', amt:500000,
         hash:'0x2b6ad048f1c95e73a04d18b6f2907cc3e5148ab7d930f62e58ac137409bd6e21',
         proofN:1, memo:null },
    confirmAt:'2026-06-18 15:12', seal:{ has:true, at:'2026-06-15 10:05', versions:1 },
    finalDue:'2027-06-05', startDate:'2026-06-18' },
  { id:'FD-20260901-0052', pid:'FP-20260620-0015', round:'FP-20260620-0015-01',
    asset:'E-ASSET-01', fund:'E-FUND-02', st:'S-FD-4', amt:300000, rate:7.40,
    fx:1, settle:300000, quoteAt:'2026-08-28 16:30', demandSt:'disb',
    ln:{ at:'2026-09-05 08:55', submitAt:'2026-09-05 09:00', amt:300000,
         hash:'0x9e13c7b5024af86d31097be2c4f5083a6dd142e97b30c85f1ae6209437bd05c6',
         proofN:1, memo:null },
    windowTo:'2026-09-12 09:00', overdue:true,
    seal:{ has:true, at:'2026-08-30 14:20', versions:1 },
    finalDue:'2027-06-20', startDate:null },
  { id:'FD-20260902-0057', pid:'FP-20260825-0039', round:'FP-20260825-0039-01',
    asset:'E-ASSET-01', fund:'E-FUND-02', st:'S-FD-3', amt:300000, rate:7.10,
    fx:1, settle:300000, quoteAt:'2026-09-02 09:15', demandSt:'disb',
    reupload:{ need:true, at:'2026-09-12 10:30',
               why:['The stamped copy is missing page 3 of the annex; please upload the complete file.',
                    '盖章件缺附件第 3 页，请重新上传完整件。'] },
    seal:{ has:true, at:'2026-09-10 17:05', versions:1 },
    finalDue:'2027-08-25', startDate:null },
  { id:'FD-20260910-0067', pid:'FP-20260828-0042', round:'FP-20260828-0042-01',
    asset:'E-ASSET-01', fund:'E-FUND-01', st:'S-FD-3', amt:300000, rate:6.90,
    fx:1, settle:300000, quoteAt:'2026-09-10 14:05', demandSt:'disb',
    seal:{ has:true, at:'2026-09-11 09:22', versions:1 },
    finalDue:'2027-08-28', startDate:null },
  { id:'FD-20260908-0061', pid:'FP-20260812-0031', round:'FP-20260812-0031-01',
    asset:'E-ASSET-01', fund:'E-FUND-01', st:'S-FD-1', amt:500000, rate:7.20,
    fx:1, settle:500000, quoteAt:'2026-09-09 09:40', demandSt:'quoted',
    lockTo:'2026-09-16 09:40', finalDue:'2027-08-14', startDate:null },
  { id:'FD-20260305-0018', pid:'FP-20260512-0009', round:'FP-20260512-0009-01',
    asset:'E-ASSET-01', fund:'E-FUND-03', st:'S-FD-8', amt:260000, rate:7.60,
    fx:1, settle:260000, quoteAt:'2026-03-04 15:10', demandSt:'funded',
    ln:{ at:'2026-03-05 10:00', submitAt:'2026-03-05 10:06', amt:260000,
         hash:'0x51ef37ac9b2048d6157cf3e0b8a4192d76ce0538ba17f4092dc6e831475ab2f0',
         proofN:1, memo:null },
    confirmAt:'2026-03-05 16:40', settledAt:'2026-09-05 10:40',
    seal:{ has:true, at:'2026-03-04 18:20', versions:1 },
    finalDue:'2027-03-01', startDate:'2026-03-05' },
  /* —— 以下三笔属于资金方视角（本机构对其他资产方） —— */
  { id:'FD-20260215-0009', pid:null, projName:['South China hardware receivables pool','华南五金应收账款池'],
    round:'FP-20260210-0003-01', asset:'E-ASSET-09', fund:'E-FUND-01', st:'S-FD-6',
    amt:400000, rate:7.10, fx:1, settle:400000, quoteAt:'2026-02-12 10:30', demandSt:'funded',
    ln:{ at:'2026-02-15 11:00', submitAt:'2026-02-15 11:06', amt:400000,
         hash:'0x3af92d5c7108be46029d1f7b5c308ea41db27f9063ce58147ab0925d63ef714c',
         proofN:1, memo:null },
    confirmAt:'2026-02-15 17:40', seal:{ has:true, at:'2026-02-13 09:40', versions:1 },
    finalDue:'2027-02-10', startDate:'2026-02-15' },
  { id:'FD-20260430-0025', pid:null, projName:['Pearl River Delta home appliance receivables pool','珠三角家电应收账款池'],
    round:'FP-20260705-0018-01', asset:'E-ASSET-04', fund:'E-FUND-01', st:'S-FD-6',
    amt:500000, rate:6.60, fx:1, settle:500000, quoteAt:'2026-04-26 09:10', demandSt:'funded',
    ln:{ at:'2026-04-30 10:10', submitAt:'2026-04-30 10:15', amt:500000,
         hash:'0x84c0e9b71fd2035a6c48917be230df5a19cb604e8735af12d0e6493cb85a7f23',
         proofN:2, memo:null },
    confirmAt:'2026-04-30 15:25', seal:{ has:true, at:'2026-04-28 16:00', versions:1 },
    finalDue:'2027-04-25', startDate:'2026-04-30' },
  { id:'FD-20260620-0031', pid:null, projName:['Central China building materials receivables pool','华中建材应收账款池'],
    round:'FP-20260610-0012-01', asset:'E-ASSET-07', fund:'E-FUND-01', st:'S-FD-4',
    amt:260000, rate:7.30, fx:1, settle:260000, quoteAt:'2026-09-08 10:40', demandSt:'disb',
    ln:{ at:'2026-09-11 14:30', submitAt:'2026-09-11 14:36', amt:260000,
         hash:'0xd41a9e07c5382b6f109ad4e72c58b310697fe24da05c8317bf94206e5138a7b2',
         proofN:1, memo:null },
    windowTo:'2026-09-18 14:36', overdue:false,
    seal:{ has:true, at:'2026-09-09 11:15', versions:1 },
    finalDue:'2027-06-10', startDate:null },
  { id:'FD-20260820-0045', pid:null, projName:['South China hardware receivables pool','华南五金应收账款池'],
    round:'FP-20260210-0003-02', asset:'E-ASSET-09', fund:'E-FUND-01', st:'S-FD-2',
    amt:350000, rate:8.10, fx:1, settle:350000, quoteAt:'2026-08-20 14:05', demandSt:'open',
    endAt:'2026-08-22 09:30',
    why:['The quoted rate is above the range we can accept this round.','本轮报价利率高于我方可接受区间。'],
    finalDue:'2027-02-10', startDate:null },
  { id:'FD-20260701-0033', pid:null, projName:['Pearl River Delta home appliance receivables pool','珠三角家电应收账款池'],
    round:'FP-20260705-0018-02', asset:'E-ASSET-04', fund:'E-FUND-01', st:'S-FD-11',
    amt:300000, rate:7.90, fx:1, settle:300000, quoteAt:'2026-07-01 11:20', demandSt:'open',
    endAt:'2026-07-08 11:20',
    why:['No response within the quote validity window; the quote lapsed automatically and the credit was released.',
         '报价有效期内未获处理，自动失效，额度即时释放。'],
    finalDue:'2027-04-25', startDate:null }
];
function deal(id) {
  for (var i = 0; i < DEALS.length; i++) if (DEALS[i].id === id) return DEALS[i];
  return null;
}
function dealProjName(d) {
  return d.pid ? projName(d.pid) : L(d.projName[0], d.projName[1]);
}

/* ---- 还款计划与还款记录：按 业务 → 需求编号 → 期次 三层 ---- */
var PLANS = [
  { deal:'FD-20260512-0044', planAt:'2026-05-12 16:05', startDate:'2026-05-12',
    finalDue:'2027-04-20', paidPri:0, paidInt:0, unpaid:500000, version:2,
    rows:[
      { seq:1, due:'2026-08-12', from:'2026-05-12', to:'2026-08-12', days:92,
        pri:0, int:8688.89, st:'S-RP-1', overdue:34, window:'2026-08-09 00:00', nature:null },
      { seq:2, due:'2026-11-12', from:'2026-08-12', to:'2026-11-12', days:92,
        pri:0, int:8688.89, st:'S-RP-1', overdue:0, window:'2026-11-09 00:00', nature:null },
      { seq:3, due:'2027-04-20', from:'2026-11-12', to:'2027-04-20', days:159,
        pri:500000, int:15016.67, st:'S-RP-1', overdue:0, window:'2027-04-17 00:00',
        last:true, nature:null }
    ] },
  { deal:'FD-20260618-0027', planAt:'2026-06-18 15:15', startDate:'2026-06-18',
    finalDue:'2027-06-05', paidPri:0, paidInt:0, unpaid:500000, version:1,
    rows:[
      { seq:1, due:'2026-09-18', from:'2026-06-18', to:'2026-09-18', days:92,
        pri:0, int:8880.56, st:'S-RP-1', overdue:0, window:'2026-09-15 00:00', nature:null },
      { seq:2, due:'2026-12-18', from:'2026-09-18', to:'2026-12-18', days:91,
        pri:0, int:8784.03, st:'S-RP-1', overdue:0, window:'2026-12-15 00:00', nature:null },
      { seq:3, due:'2027-06-05', from:'2026-12-18', to:'2027-06-05', days:169,
        pri:500000, int:16309.03, st:'S-RP-1', overdue:0, window:'2027-06-02 00:00',
        last:true, nature:null }
    ] },
  { deal:'FD-20260305-0018', planAt:'2026-03-05 16:45', startDate:'2026-03-05',
    finalDue:'2027-03-01', paidPri:260000, paidInt:9240.11, unpaid:0, version:1,
    settledAt:'2026-09-05 10:40',
    rows:[
      { seq:1, due:'2026-06-05', from:'2026-03-05', to:'2026-06-05', days:92,
        pri:0, int:5049.78, st:'S-RP-3', overdue:0, window:'2026-06-02 00:00',
        nature:'normal', paidAt:'2026-06-04 10:20', settledAt:'2026-06-04 16:30' },
      { seq:2, due:'2026-09-05', from:'2026-06-05', to:'2026-09-05', days:92,
        pri:260000, int:4190.33, st:'S-RP-3', overdue:0, window:'2026-09-02 00:00',
        last:true, nature:'normal', paidAt:'2026-09-05 09:20', settledAt:'2026-09-05 10:40' }
    ] },
  { deal:'FD-20260215-0009', planAt:'2026-02-15 17:45', startDate:'2026-02-15',
    finalDue:'2027-02-10', paidPri:0, paidInt:7040.56, unpaid:400000, version:1,
    rows:[
      { seq:1, due:'2026-05-15', from:'2026-02-15', to:'2026-05-15', days:89,
        pri:0, int:7018.06, st:'S-RP-3', overdue:0, window:'2026-05-12 00:00',
        nature:'normal', paidAt:'2026-05-14 11:05', settledAt:'2026-05-15 09:10' },
      { seq:2, due:'2026-08-15', from:'2026-05-15', to:'2026-08-15', days:92,
        pri:0, int:7255.56, st:'S-RP-2', overdue:21, window:'2026-08-12 00:00',
        nature:'overdue', paidAt:'2026-09-05 11:20', confirmTo:'2026-09-12 11:20',
        confirmOverdue:true },
      { seq:3, due:'2027-02-10', from:'2026-08-15', to:'2027-02-10', days:179,
        pri:400000, int:14118.06, st:'S-RP-1', overdue:0, window:'2027-02-07 00:00',
        last:true, nature:null }
    ] },
  { deal:'FD-20260430-0025', planAt:'2026-04-30 15:30', startDate:'2026-04-30',
    finalDue:'2027-04-25', paidPri:0, paidInt:8433.33, unpaid:500000, version:1,
    rows:[
      { seq:1, due:'2026-07-30', from:'2026-04-30', to:'2026-07-30', days:91,
        pri:0, int:8341.67, st:'S-RP-3', overdue:0, window:'2026-07-27 00:00',
        nature:'normal', paidAt:'2026-07-29 14:10', settledAt:'2026-07-30 09:05' },
      { seq:2, due:'2026-10-30', from:'2026-07-30', to:'2026-10-30', days:92,
        pri:0, int:8433.33, st:'S-RP-2', overdue:0, window:'2026-10-27 00:00',
        nature:'normal', paidAt:'2026-09-13 16:40', confirmTo:'2026-09-20 16:40',
        confirmOverdue:false },
      { seq:3, due:'2027-04-25', from:'2026-10-30', to:'2027-04-25', days:177,
        pri:500000, int:16225.00, st:'S-RP-1', overdue:0, window:'2027-04-22 00:00',
        last:true, nature:null }
    ] }
];
function planOf(dealId) {
  for (var i = 0; i < PLANS.length; i++) if (PLANS[i].deal === dealId) return PLANS[i];
  return null;
}

/* ---- 还款收款账户：放款时由资金方登记，只读脱敏，无修改入口 ---- */
var PAY_ACCOUNTS = {
  'E-FUND-01': { kind:'fiat', name:['Beian Leasing (demo)','北岸融资租赁（演示）'],
    acct:'**** **** **** 4417', swift:'BEIACNS****', bank:['Bank of East Harbour (demo) · Shanghai','东岸银行（演示）· 上海分行'],
    inter:['Intermediary Bank (demo) · Hong Kong','中转行（演示）· 香港'] },
  'E-FUND-02': { kind:'crypto', name:['Huanhai Commercial Factoring (demo)','环海商业保理（演示）'],
    wallet:'0x9F4c****************************a8D2' },
  'E-FUND-03': { kind:'fiat', name:['Yunqi Commercial Factoring (demo)','云启商业保理（演示）'],
    acct:'**** **** **** 8830', swift:'YUNQCNB****', bank:['Southbank Commercial Bank (demo) · Shenzhen','南岸商业银行（演示）· 深圳分行'],
    inter:['Intermediary Bank (demo) · Singapore','中转行（演示）· 新加坡'] }
};

/* ================================================================
   Part B —— 时间、金额与派生量
   一切倒计时都由服务端下发的绝对到期时刻与"此刻"求差，前端不自行推算口径。
   ================================================================ */
function ts(s) { return Date.parse(String(s).replace(' ', 'T') + ':00Z'); }
function nowTs() { return ts(NOW); }
function num(n, dec) {
  if (n == null) return '—';
  var d = dec == null ? 2 : dec;
  var s = Math.abs(n).toFixed(d).split('.');
  s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-' : '') + s.join(d ? '.' : '');
}
function usd(n) { return num(n) + ' ' + CCY; }
function dt(s) { return s ? String(s) : '—'; }

/* 剩余时限：> 0 返回 {d,h,m}；<= 0 返回 {over:true, days:N} */
function left(iso) {
  var ms = ts(iso) - nowTs();
  if (ms <= 0) return { over: true, days: Math.max(1, Math.floor(-ms / 86400000)) };
  return { over: false, d: Math.floor(ms / 86400000),
           h: Math.floor(ms % 86400000 / 3600000),
           m: Math.floor(ms % 3600000 / 60000), ms: ms };
}
function leftText(iso) {
  var r = left(iso);
  if (r.over) return L(r.days + (r.days === 1 ? ' day past' : ' days past'), '已超期 ' + r.days + ' 天');
  if (r.d > 0) return L(r.d + 'd ' + r.h + 'h remaining', '剩余 ' + r.d + ' 天 ' + r.h + ' 小时');
  return L(r.h + 'h ' + r.m + 'm remaining', '剩余 ' + r.h + ' 小时 ' + r.m + ' 分');
}
function urgent(iso) { var r = left(iso); return !r.over && r.ms < 86400000; }
function windowOpen(iso) { return nowTs() >= ts(iso); }

/* 项目派生量：融资上限 = 有效质押价值 × 80%（服务端下发，此处只为演示数据自洽） */
function cap(p) { return Math.round(p.valid * PLEDGE_RATE * 100) / 100; }
function gapOf(p) { return p.cov === 'under' ? (p.balance - cap(p)) : 0; }
function topUpOf(p) { return gapOf(p) / PLEDGE_RATE; }

/* ================================================================
   Part C —— 归属过滤（服务端按主体过滤，前端不做归属判断；
   演示数据在这里按同样口径切一刀，让两端看到的是同一批对象的两个视角）
   ================================================================ */
function myProjects() { return PROJECTS.filter(function (p) { return p.owner === me(); }); }
function myTokens()   { return S.role === 'asset' ? TOKENS : []; }
function myCredits()  {
  return CREDITS.filter(function (c) {
    return S.role === 'asset' ? c.asset === me() : c.fund === me();
  });
}
function myDeals() {
  return DEALS.filter(function (d) {
    return S.role === 'asset' ? d.asset === me() : d.fund === me();
  });
}
function disbDeals() {
  return myDeals().filter(function (d) {
    return ['S-FD-3','S-FD-4','S-FD-6','S-FD-8','S-FD-10'].indexOf(d.st) >= 0;
  });
}
function quoteDeals() { return myDeals(); }
/* 还款 tab 的行 = 期次；每行带上它所属的融资业务与需求编号 */
function repayRows() {
  var out = [];
  myDeals().forEach(function (d) {
    var pl = planOf(d.id); if (!pl) return;
    pl.rows.forEach(function (r) { out.push({ d: d, pl: pl, r: r }); });
  });
  return out;
}

/* ================================================================
   Part D —— 深链：控制台不新增任何动作取值与锚点，一律消费已登记的取值
   语义统一是「落详情页 + 打开右侧抽屉」，关掉抽屉仍停在详情页。
   ================================================================ */
var ANCHOR_PAGE = {
  publish:'P-LS-01', pledge:'P-LS-01', withdraw:'P-LS-01', redeem:'P-LS-01',
  project:'P-LS-02', newProject:'P-LS-03',
  quote:'P-LS-05', respond_quote:'P-LS-06',
  disburse:'P-LS-07', confirm_disbursement:'P-LS-08', reupload_contract:'P-LS-07',
  repay:'P-LS-09', confirm_repayment:'P-LS-10', view_schedule:'P-LS-91',
  deal:'P-LS-02'
};
function xfile(pageId) {
  var m = CF.MODULES[CF.OWNER[pageId]];
  return m ? '../' + m.dir + '/' + m.file : null;
}
function href(action, path) {
  var f = xfile(ANCHOR_PAGE[action] || 'P-LS-02');
  if (!f) return null;
  return f + '#/' + path;
}
function hProject(pid) { return href('project', 'project/' + pid); }
function hDeal(id) { return href('deal', 'deal/' + id); }
function hAction(action, path) { return href(action, path + '?action=' + action); }
function hInstitution() {
  var f = xfile('P-F30');
  return f ? f + (CF.ENTRY['P-F30'] || '#/account/institution/apply') : null;
}
function hMarketplace() { var f = xfile('P-LS-01'); return f ? f + '#/marketplace' : null; }
function hNewProject() { var f = xfile('P-LS-03'); return f ? f + '#/project/new' : null; }

/* 快捷按钮三态：服务端不返回该动作 → 不渲染；返回且可用 → 可点；
   返回但不可用 → 可见不可点 + 展示服务端给的原因。前端不按状态或日期推断。 */
function actBtn(a) {
  if (!a || a.show === false) return '';
  var cls = 'btn sm' + (a.primary ? ' primary' : '');
  if (a.blocked) {
    return '<span class="' + cls + ' blocked" role="button" aria-disabled="true" tabindex="0">'
      + E(a.label) + ' <span aria-hidden="true">&#8856;</span></span>'
      + (a.reason ? '<span class="mc-why">' + E(a.reason) + '</span>' : '');
  }
  if (!a.href) {
    return '<button class="' + cls + '" type="button" data-act="' + (a.act || 'mc.noop') + '"'
      + (a.v ? ' data-v="' + E(a.v) + '"' : '') + '>' + E(a.label) + '</button>';
  }
  return '<a class="' + cls + '" href="' + E(a.href) + '">' + E(a.label) + '</a>';
}
function actCell(list) {
  var html = (list || []).filter(Boolean).map(function (a) { return actBtn(a); }).join('');
  return html || '<span class="faint">—</span>';
}

/* ================================================================
   Part E —— 通用展示件
   ================================================================ */
function pill(tone, text, title) {
  return '<span class="pill ' + tone + '"' + (title ? ' title="' + E(title) + '"' : '') + '>' + E(text) + '</span>';
}
function enumPill(table, key) {
  var v = table[key]; if (!v) return '<span class="faint">—</span>';
  return pill(v[1], L(v[0][0], v[0][1]));
}
function enumText(table, key) { var v = table[key]; return v ? L(v[0][0], v[0][1]) : '—'; }
function kv(k, v, sub) {
  return '<div><dt>' + E(k) + '</dt><dd>' + v + (sub ? '<div class="tiny">' + sub + '</div>' : '') + '</dd></div>';
}
function dl(items) { return '<dl class="dl">' + items.filter(Boolean).join('') + '</dl>'; }
function mono(x) { return '<span class="mono">' + E(x) + '</span>'; }
function sub(x) { return '<div class="cell-sub">' + E(x) + '</div>'; }
function main(x) { return '<div class="cell-main">' + E(x) + '</div>'; }

/* 未核验声明常驻在每一个区块浏览器链接旁边 */
function txLink(hash) {
  return '<div class="mc-hash"><div class="hv mono">' + E(hash) + '</div>'
    + '<div class="lk"><a class="btn-link" href="' + E(EXPLORER + hash) + '" target="_blank" rel="noopener">'
    + L('View on block explorer','在区块浏览器查看') + '</a>'
    + '<span class="nv">' + L('The platform has not verified this transaction; the link is for your own check.',
        '平台未核验该交易，链接仅供自行查验。') + '</span>'
    + '<span class="tag ro">' + g('chain') + ' ' + CHAIN + '</span></div></div>';
}
function mailBlock(idsLabel) {
  return '<div class="mc-mail"><div class="h">' + L('Past the window? Contact support','已超过时限？请联系客服') + '</div>'
    + '<div class="ad"><span class="em mono">' + E(MAIL) + '</span>'
    + '<button class="btn sm" type="button" data-act="mc.copy" data-v="' + E(MAIL) + '">'
    + L('Copy','复制') + '</button></div>'
    + '<p>' + L('Please quote ','请注明') + '<b>' + E(idsLabel) + '</b>'
    + L('. The platform does not confirm on either party&#39;s behalf and does not commit to a turnaround time. The action stays available — being past the window changes no status, permission or amount.',
        '。平台不代为确认、不承诺处理时效；确认入口照常可用，超期不改变状态、权限与任何金额。') + '</p></div>';
}

/* ---- 骨架屏 / 空态 / 失败态：分块降级，一块坏了其余照常 ---- */
function skelRows(n) {
  var out = '';
  for (var i = 0; i < (n || 4); i++) {
    out += '<div class="skel-row"><div class="skel m"></div><div class="skel"></div>'
      + '<div class="skel s"></div><div class="skel s"></div></div>';
  }
  return '<div class="card" role="status" aria-live="polite" aria-label="' + L('Loading','加载中') + '">' + out + '</div>';
}
function blockError(key, what) {
  return '<div class="card"><div class="card-b shell" role="alert">'
    + '<b>' + L('Could not load ' + what.en, what.zh + '加载失败') + '</b>'
    + '<p>' + L('The upstream service did not respond in time. Everything else on this page is unaffected.',
        '上游服务未在预期时间内返回。本页其余内容不受影响。') + '</p>'
    + '<button class="btn" type="button" data-act="mc.retry" data-v="' + key + '">'
    + L('Retry','重试') + '</button></div></div>';
}
function emptyBox(title, body, cta) {
  return '<div class="card"><div class="tbl-empty"><b>' + E(title) + '</b>'
    + '<div>' + E(body) + '</div>'
    + (cta ? '<div style="margin-top:14px">' + actBtn(cta) + '</div>' : '') + '</div></div>';
}

/* ---- 分页器：单页 20 条起步，每页条数 20 / 50 / 100 可切换 ---- */
function pageState(key) {
  if (!S.pg[key]) S.pg[key] = { p: 1, size: 20 };
  return S.pg[key];
}
function paged(list, key) {
  var st = pageState(key);
  var n = Math.max(1, Math.ceil(list.length / st.size));
  if (st.p > n) st.p = n;
  return { rows: list.slice((st.p - 1) * st.size, st.p * st.size), p: st.p, n: n,
           size: st.size, total: list.length, key: key };
}
function pgNums(p, n) {
  var out = [], i, from = Math.max(1, Math.min(p - 2, n - 4)), to = Math.min(n, from + 4);
  for (i = from; i <= to; i++) out.push(i);
  return out;
}
function pager(pp) {
  var st = pageState(pp.key);
  var sizes = PAGE_SIZES.map(function (x) {
    return '<option value="' + x + '"' + (x === st.size ? ' selected' : '') + '>' + x + '</option>';
  }).join('');
  var nums = pgNums(pp.p, pp.n).map(function (i) {
    return '<button class="pgbtn" type="button" data-act="mc.page" data-v="' + pp.key + ':' + i + '"'
      + (i === pp.p ? ' aria-current="true"' : '') + '>' + i + '</button>';
  }).join('');
  return '<div class="pager"><span>'
    + L(pp.total + ' items · page ' + pp.p + ' / ' + pp.n,
        '共 ' + pp.total + ' 条 · 第 ' + pp.p + ' / ' + pp.n + ' 页') + '</span>'
    + '<div class="right">'
    + '<label class="mc-size">' + L('Per page','每页')
    + '<select class="inp" data-act="mc.size" data-v="' + pp.key + '" aria-label="'
    + L('Rows per page','每页条数') + '">' + sizes + '</select></label>'
    + '<button class="pgbtn" type="button" data-act="mc.page" data-v="' + pp.key + ':' + (pp.p - 1) + '"'
    + (pp.p <= 1 ? ' disabled' : '') + ' aria-label="' + L('Previous page','上一页') + '">&lsaquo;</button>'
    + nums
    + '<button class="pgbtn" type="button" data-act="mc.page" data-v="' + pp.key + ':' + (pp.p + 1) + '"'
    + (pp.p >= pp.n ? ' disabled' : '') + ' aria-label="' + L('Next page','下一页') + '">&rsaquo;</button>'
    + '</div></div>';
}

/* ---- 排序表头：控制台看的是本人数据，提供精确值排序 ---- */
function sortState(key) {
  if (!S.sort[key]) S.sort[key] = { by: null, dir: 'desc' };
  return S.sort[key];
}
function sortTh(key, by, label, cls) {
  var st = sortState(key), on = st.by === by;
  return '<th class="' + (cls || '') + '"><button class="mc-sort" type="button" data-act="mc.sort" data-v="'
    + key + ':' + by + '" aria-pressed="' + on + '">' + E(label)
    + '<span class="ar" aria-hidden="true">' + (on ? (st.dir === 'asc' ? '&#9652;' : '&#9662;') : '&#8693;')
    + '</span></button></th>';
}
function applySort(list, key, getters, dflt) {
  var st = sortState(key);
  var by = st.by || dflt.by, dir = st.by ? st.dir : dflt.dir;
  var f = getters[by];
  if (!f) return list;
  return list.slice().sort(function (a, b) {
    var x = f(a), y = f(b);
    if (x == null) x = -Infinity; if (y == null) y = -Infinity;
    if (x === y) return 0;
    return (x < y ? -1 : 1) * (dir === 'asc' ? 1 : -1);
  });
}

/* ---- 筛选条带：带过滤的跳转必须说明"已按什么过滤"并给一键清除 ---- */
function filterStrip() {
  if (!S.strip) return '';
  return '<div class="mc-strip"><span class="ico" aria-hidden="true">&#9656;</span>'
    + '<span>' + L('Filtered by ','已按 ') + '<b>' + E(L(S.strip[0], S.strip[1])) + '</b>'
    + L('','过滤') + '</span>'
    + '<button class="btn sm" type="button" data-act="mc.clearStrip">' + L('Clear','清除') + '</button></div>';
}
function selField(label, key, opts) {
  var cur = S.filters[key] || 'all';
  var body = opts.map(function (o) {
    return '<option value="' + E(o[0]) + '"' + (cur === o[0] ? ' selected' : '') + '>' + E(o[1]) + '</option>';
  }).join('');
  return '<label class="fl"><span>' + E(label) + '</span>'
    + '<select class="inp" data-act="mc.filter" data-v="' + key + '">' + body + '</select></label>';
}
function filterBar(fields, reset) {
  return '<div class="filters">' + fields.join('')
    + '<div class="fl-act"><button class="btn sm" type="button" data-act="mc.reset" data-v="' + reset + '">'
    + L('Clear filters','清空筛选') + '</button></div></div>';
}
function noResult(total) {
  return '<div class="tbl-empty"><b>' + L('No rows match these filters','没有符合筛选条件的记录') + '</b>'
    + '<div>' + L('Widen or clear the filters to see all ' + total + ' rows.',
        '放宽或清空筛选条件可查看全部 ' + total + ' 条。') + '</div>'
    + '<div style="margin-top:14px"><button class="btn" type="button" data-act="mc.reset" data-v="'
    + S.tab + '">' + L('Clear filters','清空筛选') + '</button></div></div>';
}
function caret(id) {
  var on = !!S.open[id];
  return '<button class="mc-caret" type="button" data-act="mc.toggle" data-v="' + E(id) + '"'
    + ' aria-expanded="' + on + '" aria-label="' + L('Show details','展开明细') + '">'
    + '<span aria-hidden="true">' + (on ? '&#9662;' : '&#9656;') + '</span></button>';
}
function detailRow(id, cols, body) {
  if (!S.open[id]) return '';
  return '<tr class="mc-detail"><td colspan="' + cols + '">' + body + '</td></tr>';
}

/* ================================================================
   Part F —— ① 统计区
   ================================================================ */
function statAsset() {
  var toks = TOKENS;
  var all = toks.reduce(function (s, t) { return s + t.amt; }, 0);
  var pledged = toks.filter(function (t) { return t.pl === 'pledged'; });
  var pAmt = pledged.reduce(function (s, t) { return s + t.amt; }, 0);
  var dead = pledged.filter(function (t) { return t.st === 'TS-2'; });
  var dAmt = dead.reduce(function (s, t) { return s + t.amt; }, 0);
  return { n: toks.length, amt: all, pn: pledged.length, pAmt: pAmt, dn: dead.length, dAmt: dAmt };
}
function statCredit() {
  var cs = myCredits();
  var line = cs.reduce(function (s, c) { return s + c.line; }, 0);
  var used = cs.reduce(function (s, c) { return s + c.deal; }, 0);
  var avail = cs.reduce(function (s, c) { return s + c.avail; }, 0);
  var openDeals = myDeals().filter(function (d) {
    return ['S-FD-1','S-FD-3','S-FD-4','S-FD-6'].indexOf(d.st) >= 0;
  }).length;
  return { line: line, n: cs.length, used: used, deals: openDeals, avail: avail };
}
function statBlock() {
  if (S.blocks.stat === 'loading') {
    return '<div class="mc-stats">' + [0,1,2,3].map(function () {
      return '<div class="stat"><div class="skel s" style="width:88px"></div>'
        + '<div class="skel" style="margin-top:12px;height:18px"></div></div>';
    }).join('') + '</div>';
  }
  var c = statCredit(), out = [];
  if (S.role === 'asset') {
    var t = statAsset();
    out.push('<div class="stat mc-stat-nest">'
      + '<div class="lbl">' + L('All tokens','全部代币') + '</div>'
      + '<div class="val">' + num(t.n, 0) + ' <span class="u">' + L('tokens','张') + '</span></div>'
      + '<div class="amt">' + usd(t.amt) + '</div>'
      + '<div class="nest"><div class="nk">' + L('of which pledged','其中 已质押代币') + '</div>'
      + '<div class="nv">' + num(t.pn, 0) + ' <span class="u">' + L('tokens','张') + '</span> · ' + usd(t.pAmt) + '</div>'
      + '<div class="nx">' + L('of which void: ','其中已失效：') + num(t.dn, 0) + L(' tokens',' 张') + ' · '
      + usd(t.dAmt) + ' · <b>' + L('not counted towards coverage','不计入覆盖') + '</b></div></div>'
      + '<div class="x">' + L('Book figure on the token ledger, void tokens included. The project pages show the pledged token value, which excludes them.',
          '代币台账的账面口径，含失效代币；项目侧的「质押代币价值」已排除失效，两者本就不是同一个数。') + '</div>'
      + '</div>');
  }
  if (S.blocks.credit === 'error') {
    out.push('<div class="stat mc-stat-err" role="alert"><div class="lbl">' + L('Total credit granted','总授信')
      + '</div><div class="val">' + L('Temporarily unavailable','暂时取不到') + '</div>'
      + '<div class="x">' + L('This figure could not be loaded. It is not shown as zero.',
          '该指标未取到，此处不以 0 代替。') + '</div>'
      + '<button class="btn sm" type="button" data-act="mc.retry" data-v="credit" style="margin-top:10px">'
      + L('Retry','重试') + '</button></div>');
  } else {
    out.push('<div class="stat"><div class="lbl">' + L('Total credit granted','总授信') + '</div>'
      + '<div class="val">' + usd(c.line) + '</div>'
      + '<div class="x">' + num(c.n, 0) + L(' credit line(s)',' 笔授信记录') + '</div></div>');
  }
  out.push('<div class="stat"><div class="lbl">' + L('Financing drawn','已融额度') + '</div>'
    + '<div class="val">' + usd(c.used) + '</div>'
    + '<div class="x">' + num(c.deals, 0) + L(' open deal(s)',' 笔未结清融资业务') + '</div></div>');
  out.push('<div class="stat mc-stat-avail"><div class="lbl">' + L('Available credit remaining','剩余可用授信') + '</div>'
    + '<div class="val">' + usd(c.avail) + '</div>'
    + '<div class="x">' + L('The amount you can actually raise is recalculated by the server at the moment you publish a demand.',
        '实际可融金额以发布需求时服务端当场重算的结果为准。') + '</div></div>');
  return '<div class="mc-stats">' + out.join('') + '</div>';
}

/* ================================================================
   Part G —— ② 待办提示带
   待办由业务状态派生、不落库：没有已读、没有归档、没有"标记已办"。
   分三组：去广场办 / 等待中 / 去其他模块；组内按时限紧迫度排序。
   ================================================================ */
function todoList() {
  var out = [];
  var role = S.role;
  myDeals().forEach(function (d) {
    var pl = planOf(d.id);
    if (role === 'asset') {
      if (d.st === 'S-FD-1' && d.lockTo) {
        out.push({ id:'t1-' + d.id, grp:'plaza', urgent: urgent(d.lockTo), due: d.lockTo,
          title: L('A quote is waiting for you to accept or decline','有报价待我接受 / 拒绝'),
          tag: g('quoteConfirm'),
          lines: [ g('demandNo') + ' ' + d.round,
                   co(d.fund) + ' · ' + usd(d.amt),
                   g('quoteWindow') + ' · ' + leftText(d.lockTo)
                     + L(' (expires ' + d.lockTo + ' ' + TZ + ')', '（到期时刻 ' + d.lockTo + ' ' + TZ + '）') ],
          foot: L('A quote left unhandled for seven days lapses automatically.','7 天未处理将自动失效。'),
          act: { label: L('Accept or decline','去接受 / 拒绝报价'), primary:true,
                 href: hAction('respond_quote', 'deal/' + d.id) } });
      }
      if (d.st === 'S-FD-3' && d.reupload && d.reupload.need) {
        out.push({ id:'t2-' + d.id, grp:'plaza', urgent:false, due:null,
          title: L('A stamped contract is waiting for you to re-upload','有盖章件待我重传'),
          lines: [ g('demandNo') + ' ' + d.round, g('dealNo') + ' ' + d.id,
                   L('Reason given: ','机构给的原因：') + L(d.reupload.why[0], d.reupload.why[1]) ],
          act: { label: L('Re-upload the stamped contract','去重传盖章件'), primary:true,
                 href: hAction('reupload_contract', 'deal/' + d.id) } });
      }
      if (d.st === 'S-FD-4' && !d.overdue) {
        out.push({ id:'t3-' + d.id, grp:'plaza', urgent: urgent(d.windowTo), due: d.windowTo,
          title: L('Waiting for you to confirm the disbursement','待我确认收到放款'),
          tag: g('disbConfirm'),
          lines: [ g('demandNo') + ' ' + d.round,
                   usd(d.ln.amt) + ' · ' + CCY,
                   g('disbWindow') + ' · ' + leftText(d.windowTo)
                     + L(' (due ' + d.windowTo + ' ' + TZ + ')', '（到期时刻 ' + d.windowTo + ' ' + TZ + '）') ],
          foot: L('Reaching the end of the window does not count as confirmed — it only sends one reminder.',
                  '到期不会自动视为已确认，只会发一次提醒。'),
          act: { label: L('Confirm the disbursement','去确认收到放款'), primary:true,
                 href: hAction('confirm_disbursement', 'deal/' + d.id) } });
      }
      if (d.st === 'S-FD-4' && d.overdue) {
        out.push({ id:'t4-' + d.id, grp:'plaza', urgent:true, due:d.windowTo, over:true,
          title: L('Past the disbursement confirmation window — still waiting for your confirmation',
                   '已超过放款确认时限，待我确认收到放款'),
          tag: g('disbConfirm'),
          lines: [ g('demandNo') + ' ' + d.round, g('dealNo') + ' ' + d.id,
                   L('Past the window by ' + left(d.windowTo).days + ' day(s)',
                     '已超过放款确认时限 ' + left(d.windowTo).days + ' 天') ],
          mail: g('demandNo') + ' ' + d.round + ' / ' + g('dealNo') + ' ' + d.id,
          act: { label: L('Confirm the disbursement','去确认收到放款'), primary:true,
                 href: hAction('confirm_disbursement', 'deal/' + d.id) } });
      }
      if (pl) {
        pl.rows.forEach(function (r) {
          if (r.st !== 'S-RP-1') return;
          if (r.overdue > 0) {
            out.push({ id:'t6-' + d.id + '-' + r.seq, grp:'plaza', urgent:true, due:r.due, over:true,
              title: L('Overdue — waiting for your repayment','已逾期待我还款'),
              lines: [ g('demandNo') + ' ' + d.round,
                       L('Instalment ' + r.seq, '第 ' + r.seq + ' 期') + ' · ' + L('due ','应还日 ') + r.due,
                       L('Overdue by ' + r.overdue + ' day(s)','已逾期 ' + r.overdue + ' 天') + ' · '
                         + usd(r.pri + r.int) ],
              foot: L('Submitting the repayment record stops interest and the overdue count for this instalment.',
                      '提交还款记录即停止该期计息与逾期累加。'),
              act: { label: L('Repay','去还款'), primary:true,
                     href: hAction('repay', 'schedule/' + d.id + '-' + r.seq) } });
          } else if (windowOpen(r.window)) {
            out.push({ id:'t5-' + d.id + '-' + r.seq, grp:'plaza', urgent:false, due:r.due,
              title: L('Waiting for your repayment','待我还款'),
              lines: [ g('demandNo') + ' ' + d.round,
                       L('Instalment ' + r.seq, '第 ' + r.seq + ' 期') + ' · ' + L('due ','应还日 ') + r.due,
                       L('Total due ','应还合计 ') + usd(r.pri + r.int) ],
              act: { label: L('Repay','去还款'), primary:true,
                     href: hAction('repay', 'schedule/' + d.id + '-' + r.seq) } });
          }
        });
      }
    } else {
      if (d.st === 'S-FD-3') {
        out.push({ id:'t7-' + d.id, grp:'plaza', urgent:false, due:null,
          title: L('Waiting for you to disburse','待我放款'),
          lines: [ g('demandNo') + ' ' + d.round,
                   co(d.asset) + ' · ' + usd(d.amt) ],
          act: { label: L('Record the disbursement','去放款'), primary:true,
                 href: hAction('disburse', 'deal/' + d.id) } });
      }
      if (d.st === 'S-FD-1' && d.lockTo) {
        out.push({ id:'t11-' + d.id, grp:'wait', urgent:false, due:d.lockTo,
          title: L('Your quote is waiting for the other party','我的报价待对方处理'),
          lines: [ co(d.asset) + ' · ' + usd(d.amt),
                   g('quoteWindow') + ' · ' + leftText(d.lockTo) ],
          foot: L('Nothing to do here. Quotes cannot be withdrawn or amended this release; after seven days the quote lapses and the credit is released immediately.',
                  '等待对方处理，本期不支持撤回或修改报价；7 天未处理将自动失效、额度即时释放。'),
          stay: true });
      }
      if (pl) {
        pl.rows.forEach(function (r) {
          if (r.st !== 'S-RP-2') return;
          if (r.confirmOverdue) {
            out.push({ id:'t9-' + d.id + '-' + r.seq, grp:'plaza', urgent:true, due:r.confirmTo, over:true,
              title: L('Past the repayment confirmation window — still waiting for your confirmation',
                       '已超过还款确认时限，待我确认收到还款'),
              tag: g('repayConfirm'),
              lines: [ g('demandNo') + ' ' + d.round,
                       L('Instalment ' + r.seq, '第 ' + r.seq + ' 期') + ' · ' + usd(r.pri + r.int),
                       L('Past the window by ' + left(r.confirmTo).days + ' day(s)',
                         '已超过还款确认时限 ' + left(r.confirmTo).days + ' 天') ],
              mail: g('demandNo') + ' ' + d.round + ' / ' + L('instalment ','期次 ') + r.seq,
              foot: L('The other party&#39;s overdue day count was frozen when they submitted; it does not grow with how late this confirmation is.',
                      '资产方的逾期天数已在其提交时冻结，与本次确认早晚无关。'),
              act: { label: L('Confirm the repayment','去确认收到还款'), primary:true,
                     href: hAction('confirm_repayment', 'schedule/' + d.id + '-' + r.seq) } });
          } else {
            out.push({ id:'t8-' + d.id + '-' + r.seq, grp:'plaza', urgent: urgent(r.confirmTo), due:r.confirmTo,
              title: L('Waiting for you to confirm the repayment','待我确认收到还款'),
              tag: g('repayConfirm'),
              lines: [ g('demandNo') + ' ' + d.round,
                       L('Instalment ' + r.seq, '第 ' + r.seq + ' 期') + ' · ' + usd(r.pri + r.int),
                       g('repayWindow') + ' · ' + leftText(r.confirmTo) ],
              act: { label: L('Confirm the repayment','去确认收到还款'), primary:true,
                     href: hAction('confirm_repayment', 'schedule/' + d.id + '-' + r.seq) } });
          }
        });
      }
    }
  });
  if (S.role === 'fund') {
    out.push({ id:'t10', grp:'plaza', urgent:false, due:null,
      title: L('New financing demands are open for quotes','有新的融资需求可报价'),
      lines: [ L('4 demands are currently awaiting quotes','当前有 4 条需求处于待报价') ],
      foot: L('Browse and pick them in the marketplace; this page does not list them.',
              '去广场挑选，控制台不列出需求明细。'),
      act: { label: L('Browse the marketplace','去广场挑选'), href: hMarketplace() } });
  }
  if (S.role === 'asset') {
    out.push({ id:'t12', grp:'other', urgent:false, due:null,
      title: L('Identity verification is not complete','实名认证未完成'),
      lines: [ L('Complete it on the asset platform before publishing a financing demand.',
                 '在资产平台完成后方可发布融资需求。') ],
      act: { label: L('Go to the asset platform','去资产平台'), act:'mc.leave', v:'verify' } });
    out.push({ id:'t13', grp:'other', urgent:false, due:null,
      title: L('A receivable was rejected and needs resubmitting','应收账款被驳回，待重提'),
      lines: [ L('1 receivable is waiting for you on the asset platform.','资产平台上有 1 笔待重提。') ],
      act: { label: L('Go to the asset platform','去资产平台'), act:'mc.leave', v:'receivable' } });
  } else {
    out.push({ id:'t14', grp:'other', urgent:false, due:null,
      title: L('Institution profile has not been submitted','机构资料未提交'),
      lines: [ L('Some pages stay read-only until the profile is approved.','资料通过审核前部分页面保持只读。') ],
      act: { label: L('Submit the institution profile','去提交机构资料'), href: hInstitution() } });
  }
  return out;
}
/* 组内排序：带超期标记的最前、其次剩余时限最短、再次无时限 */
function todoSort(list) {
  return list.slice().sort(function (a, b) {
    var ao = a.over ? 0 : 1, bo = b.over ? 0 : 1;
    if (ao !== bo) return ao - bo;
    var ad = a.due ? ts(a.due) : Infinity, bd = b.due ? ts(b.due) : Infinity;
    return ad - bd;
  });
}
/* 同一类命中多笔时行内聚合计数并可展开，不拆成多行 */
function todoGroupBy(list) {
  var map = {}, order = [];
  list.forEach(function (x) {
    var k = x.title;
    if (!map[k]) { map[k] = []; order.push(k); }
    map[k].push(x);
  });
  return order.map(function (k) { return map[k]; });
}
function todoCard(items) {
  var head = items[0], n = items.length;
  var id = 'todo-' + head.id;
  var open = !!S.open[id];
  var body = (n > 1 && !open ? [head] : items).map(function (x, ix) {
    return '<div class="ti' + (n > 1 ? ' multi' : '') + '">'
      + (n > 1 ? '<div class="ix">' + (ix + 1) + '</div>' : '')
      + '<div class="tb">' + x.lines.map(function (l) { return '<div class="l">' + E(l) + '</div>'; }).join('')
      + (x.foot ? '<div class="f">' + x.foot + '</div>' : '')
      + (x.mail ? mailBlock(x.mail) : '')
      + '</div>'
      + '<div class="ta">' + (x.act ? actBtn(x.act) : (x.stay
          ? '<span class="pill dash">' + L('Waiting','等待中') + '</span>' : '')) + '</div></div>';
  }).join('');
  return '<article class="mc-todo' + (head.over ? ' over' : (head.urgent ? ' soon' : '')) + '">'
    + '<header><span class="tt">' + E(head.title) + '</span>'
    + (head.tag ? '<span class="tag">' + E(head.tag) + '</span>' : '')
    + (n > 1 ? '<span class="cnt mono">' + n + L(' items',' 笔') + '</span>' : '')
    + (n > 1 ? '<button class="btn sm" type="button" data-act="mc.toggle" data-v="' + id + '"'
        + ' aria-expanded="' + open + '">'
        + (open ? L('Collapse','收起') : L('Show all','展开全部')) + '</button>' : '')
    + '</header>' + body + '</article>';
}
function todoBlock() {
  if (S.blocks.todo === 'loading') {
    return '<section class="mc-band"><div class="bh"><b>' + L('To-dos','待办') + '</b></div>'
      + '<div class="bb">' + skelRows(2) + '</div></section>';
  }
  var all = S.scene === 'empty' ? [] : todoList();
  var groups = { plaza: [], wait: [], other: [] };
  all.forEach(function (x) { groups[x.grp].push(x); });
  var label = {
    plaza: L('Handle in the marketplace','去广场办'),
    wait : L('Waiting on the other party','等待中'),
    other: L('Handle in another module','去其他模块')
  };
  var body = '';
  ['plaza','wait','other'].forEach(function (k) {
    if (!groups[k].length) return;
    body += '<div class="grp"><div class="gh">' + label[k]
      + '<span class="cnt mono">' + groups[k].length + '</span></div>'
      + todoGroupBy(todoSort(groups[k])).map(todoCard).join('') + '</div>';
  });
  if (!all.length) {
    body = '<div class="none">' + L('Nothing needs your action right now.','当前没有待办事项。') + '</div>';
  }
  var explain = 'mc-b5';
  return '<section class="mc-band" aria-label="' + L('To-dos','待办') + '">'
    + '<div class="bh"><b>' + L('To-dos','待办') + '</b>'
    + '<span class="n mono">' + all.length + '</span>'
    + '<button class="mc-explain" type="button" data-act="mc.toggle" data-v="' + explain + '"'
    + ' aria-expanded="' + (!!S.open[explain]) + '">'
    + L('Who sees these?','谁能看到这些？') + '</button></div>'
    + (S.open[explain] ? '<div class="bx">'
        + L('To-dos are shown per company: anyone signed in under this company sees the same list. Notifications are sent only to the person who performed the action, so the bell can read zero while a to-do is still listed here. The two counts are deliberately separate.',
            '待办按企业展示，同企业任一员工都看得到；消息只发给发起操作的那个人，所以铃铛可能是 0 而这里仍有待办——两个计数分开，不合并。')
        + '</div>' : '')
    + '<div class="bb">' + body + '</div></section>';
}

/* ================================================================
   Part H —— ③ tab 容器与六个 tab
   ================================================================ */
function tabsFor() {
  return S.role === 'asset'
    ? [['tokens',  L('Token list','代币列表')],
       ['projects',L('Financing projects','融资项目')],
       ['credit',  L('Credit lines','授信明细')],
       ['disb',    L('Disbursements','融资放款信息')],
       ['repay',   L('Repayments','还款信息')]]
    : [['quotes',  L('My quotes','我的报价')],
       ['credit',  L('Credit summary','授信汇总')],
       ['disb',    L('Disbursements','融资放款信息')],
       ['repay',   L('Repayments','还款信息')]];
}
function tabCount(k) {
  if (S.scene === 'empty') return 0;
  if (k === 'tokens')   return myTokens().length;
  if (k === 'projects') return myProjects().length;
  if (k === 'credit')   return myCredits().length;
  if (k === 'disb')     return disbDeals().length;
  if (k === 'repay')    return repayRows().length;
  if (k === 'quotes')   return quoteDeals().length;
  return 0;
}
function tabBar() {
  return '<div class="tabs mc-tabs" role="tablist">' + tabsFor().map(function (x) {
    var on = S.tab === x[0];
    return '<button class="tab" type="button" role="tab" aria-selected="' + on + '"'
      + ' data-act="mc.tab" data-v="' + x[0] + '">' + E(x[1])
      + '<span class="cnt">' + tabCount(x[0]) + '</span></button>';
  }).join('') + '</div>';
}

/* ---------------- 代币列表 ---------------- */
function tabTokens() {
  var all = myTokens();
  if (!all.length || S.scene === 'empty') {
    return emptyBox(L('You have no issued tokens yet','您还没有已签发的代币'),
      L('Tokens are issued on the asset platform once a receivable has been confirmed.',
        '代币在资产平台完成应收账款确权后签发。'),
      { label: L('Go to the asset platform','去资产平台'), act:'mc.leave', v:'verify' });
  }
  var f = S.filters;
  var list = all.filter(function (t) {
    if (f.tkSt && f.tkSt !== 'all' && t.st !== f.tkSt) return false;
    if (f.tkPl && f.tkPl !== 'all' && t.pl !== f.tkPl) return false;
    if (f.tkPj && f.tkPj !== 'all' && t.pid !== f.tkPj) return false;
    return true;
  });
  list = applySort(list, 'tokens', {
    issued: function (t) { return ts(t.issuedAt + ' 00:00'); },
    amt   : function (t) { return t.amt; },
    due   : function (t) { return ts(t.dueTo + ' 00:00'); }
  }, { by:'issued', dir:'desc' });
  var pp = paged(list, 'tokens');

  var redeem = all.filter(function (t) { return t.pl === 'released'; });
  var rAmt = redeem.reduce(function (s, t) { return s + t.amt; }, 0);
  var head = redeem.length
    ? '<div class="mc-remind"><div class="rb"><b>'
      + L('You have ' + redeem.length + ' token(s) (' + usd(rAmt) + ') ready to withdraw',
          '您有 ' + redeem.length + ' 张（合计 ' + usd(rAmt) + '）可提取')
      + '</b><p>' + L('Withdrawing costs gas, paid by you. They can be withdrawn in one batch. Tokens stay in the pool until you withdraw them.',
          '提取需自付 gas，可批量一次提完。在您提取之前，代币会一直留在池内。') + '</p></div>'
      + '<div class="ra">' + actBtn({ label: L('Release pledge','去解除质押'), primary:true,
          href: hAction('redeem', 'project/' + redeem[0].pid) }) + '</div></div>'
    : '';

  var rows = pp.rows.map(function (t) {
    var id = 'tk-' + t.id;
    var acts = [];
    if (t.pl === 'none') acts.push({ label: L('Add pledge','去追加质押'),
      href: hAction('pledge', 'project/' + (myProjects()[0] || {}).id) });
    if (t.pl === 'released') acts.push({ label: L('Release pledge','去解除质押'),
      href: hAction('redeem', 'project/' + t.pid) });
    if (t.pl === 'pledged' && t.st === 'TS-1') acts.push({ label: L('Release pledge','去解除质押'),
      blocked: t.pid === 'FP-20260416-0007',
      reason: t.pid === 'FP-20260416-0007'
        ? L('Withdrawable limit is 0.00 USD while coverage is insufficient.',
            '覆盖不足期间可撤回上限为 0.00 USD。') : null,
      href: hAction('withdraw', 'project/' + t.pid) });
    return '<tr>'
      + '<td>' + main(t.id) + sub(buyer(t.buyerIx)) + '</td>'
      + '<td class="num">' + num(t.qty, 0) + ' <span class="faint">'
        + L('token','张') + '</span>' + sub(L('Ticker pending upstream configuration','代币符号待上游配置')) + '</td>'
      + '<td class="num">' + num(t.amt) + '</td>'
      + '<td class="c-time">' + t.dueFrom + '<div class="t2">' + t.dueTo + '</div></td>'
      + '<td>' + enumPill(TOKEN_ST, t.st)
        + (t.st === 'TS-2' && t.pl === 'pledged'
            ? '<div class="cell-note">' + L('Not counted towards coverage','不计入覆盖') + '</div>' : '') + '</td>'
      + '<td>' + enumPill(PLEDGE_ST, t.pl)
        + (t.releasedAt ? sub(L('Released ','释放于 ') + t.releasedAt) : '') + '</td>'
      + '<td>' + (t.pid
          ? '<a class="btn-link" href="' + E(hProject(t.pid)) + '">' + E(projName(t.pid)) + '</a>'
            + sub(t.pid)
          : '<span class="faint">—</span>') + '</td>'
      + '<td class="col-act">' + actCell(acts) + '</td>'
      + '</tr>';
  }).join('');

  return head + '<div class="card">'
    + filterBar([
        selField(L('Token status','代币状态'), 'tkSt', [['all', L('All','全部')],
          ['TS-1', enumText(TOKEN_ST,'TS-1')], ['TS-2', enumText(TOKEN_ST,'TS-2')]]),
        selField(L('Pledge status','融资质押状态'), 'tkPl', [['all', L('All','全部')],
          ['none', enumText(PLEDGE_ST,'none')], ['pledged', enumText(PLEDGE_ST,'pledged')],
          ['released', enumText(PLEDGE_ST,'released')]]),
        selField(L('Financing project','所属融资项目'), 'tkPj',
          [['all', L('All','全部')]].concat(myProjects().map(function (p) { return [p.id, L(p.name[0], p.name[1])]; })))
      ], 'tokens')
    + (list.length ? '<div class="tablewrap mc-wrap"><table class="tbl wide"><thead><tr>'
        + '<th>' + L('Token ID','代币编号') + ' / ' + L('Buyer','买方企业') + '</th>'
        + '<th class="num">' + L('Quantity','数量') + '</th>'
        + sortTh('tokens','amt', L('Token value (USD)','代币价值（USD）'), 'num')
        + sortTh('tokens','due', L('Receivable term','账期'), 'c-time')
        + '<th>' + L('Token status','代币状态') + '</th>'
        + '<th>' + L('Pledge status','融资质押状态') + '</th>'
        + '<th>' + L('Financing project','所属融资项目') + '</th>'
        + '<th class="col-act">' + L('Actions','操作') + '</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>' + pager(pp)
      : noResult(all.length))
    + '</div>';
}

/* ---------------- 融资项目 ---------------- */
function roundRow(p, r) {
  var tone = DEMAND_ST[r.st];
  return '<tr>'
    + '<td>' + mono(r.no) + '</td>'
    + '<td class="num">' + (r.amt ? num(r.amt) + ' ' + CCY : '—') + '</td>'
    + '<td>' + pill(tone[1], L(tone[0][0], tone[0][1]))
      + (r.end ? '<div class="cell-sub">' + E(L(FP27[r.end][0], FP27[r.end][1]))
          + (r.endAt ? ' · ' + E(r.endAt) : '') + '</div>' : '') + '</td>'
    + '<td>' + (r.fund ? E(co(r.fund)) + sub(L('quoted ','报价时间 ') + r.at) : '<span class="faint">—</span>') + '</td>'
    + '<td>' + (r.lockTo
        ? '<span class="' + (urgent(r.lockTo) ? 'mc-soon' : '') + '">' + E(leftText(r.lockTo)) + '</span>'
          + sub(L('locked since ','锁定起 ') + r.lockFrom + ' · ' + L('expires ','到期 ') + r.lockTo)
        : '<span class="faint">—</span>') + '</td>'
    + '<td class="col-act">' + actCell([
        r.st === 'quoted' ? { label: L('Accept or decline','去接受 / 拒绝报价'), primary:true,
          href: hAction('respond_quote', 'deal/' + r.deal) } : null,
        r.deal ? { label: L('Open the deal','查看融资业务'), href: hDeal(r.deal) } : null
      ]) + '</td></tr>';
}
function projectDetail(p) {
  var five = '<div class="mc-five">'
    + '<div><div class="k">' + L('Pledged tokens','质押代币数量') + '</div><div class="v">'
      + num(p.tokenN, 0) + '</div></div>'
    + '<div><div class="k">' + g('pledgedValue') + '</div><div class="v">' + num(p.valid) + '</div>'
      + (p.voidN ? '<div class="x">' + L('void excluded: ','已排除失效：') + num(p.voidN, 0)
          + L(' token(s)',' 张') + ' · ' + num(p.voidAmt) + '</div>' : '') + '</div>'
    + '<div><div class="k">' + g('demandAmt') + '</div><div class="v">'
      + (p.demand ? num(p.demand) : '—') + '</div></div>'
    + '<div><div class="k">' + g('outstanding') + '</div><div class="v">' + num(p.balance) + '</div></div>'
    + '<div><div class="k">' + g('pledgeRate') + '</div><div class="v txt">80%</div>'
      + '<div class="x">' + L('Platform constant','平台常量') + '</div></div>'
    + '</div>';
  var alert = '';
  if (p.cov === 'under') {
    alert = '<div class="mc-alert"><div class="h">' + L('Coverage shortfall alert','覆盖不足提醒') + '</div>'
      + '<p>' + L('The valid pledged value in this pool is below the outstanding financing. ',
                  '当前池内有效质押价值低于项目融资余额，')
      + '<b>' + g('coverageGap') + ' ' + usd(gapOf(p)) + '</b>' + L('; ','，')
      + '<b>' + g('topUpNeeded') + ' ' + usd(topUpOf(p)) + '</b>'
      + L('. In this state since ' + p.covSince + '.', '，自 ' + p.covSince + ' 起。') + '</p>'
      + '<p class="x">' + L('Adding collateral restores the coverage of the money already disbursed. It cannot bring back a demand that has already lapsed — and a lapsed demand is not a penalty: you can publish again right away, with no cooling-off period.',
          '追加质押可以把已放款债务的覆盖补回来；它救不回已经失效的那笔需求。失效不是惩罚，可立即重新发布、不设冷却。') + '</p>'
      + '<div class="a">' + actBtn({ label: L('Add pledge','去追加质押'), primary:true,
          href: hAction('pledge', 'project/' + p.id) })
      + actBtn({ label: L('View void tokens','查看失效代币清单'), act:'mc.voidList', v:p.id }) + '</div></div>';
  }
  var rounds = p.rounds.length
    ? '<div class="mc-sub"><div class="sh">' + L('Demands by round','逐轮需求') + '</div>'
      + '<div class="tablewrap mc-wrap"><table class="tbl"><thead><tr>'
      + '<th>' + g('demandNo') + '</th><th class="num">' + L('Amount','金额') + '</th>'
      + '<th>' + L('Demand status','需求对外状态') + '</th><th>' + L('Institution','机构') + '</th>'
      + '<th>' + g('quoteWindow') + '</th><th class="col-act">' + L('Actions','操作') + '</th>'
      + '</tr></thead><tbody>' + p.rounds.map(function (r) { return roundRow(p, r); }).join('')
      + '</tbody></table></div></div>'
    : '<div class="mc-sub"><div class="sh">' + L('Demands by round','逐轮需求') + '</div>'
      + '<p class="tiny">' + L('This project has never been published.','该项目尚未发布过融资需求。') + '</p></div>';
  var meta = dl([
    kv(L('Project ID','项目编号'), mono(p.id)),
    kv(L('Asset type','代币类型'), E(L('Receivables','应收账款类'))),
    kv(L('Created','创建时间'), E(p.createdAt)),
    kv(L('Valid until','有效期至'), E(p.expiresAt)),
    kv(L('Quotes received','已收到报价数'), num(p.quotes, 0)),
    p.settledAt ? kv(L('Settled at','结清时间'), E(p.settledAt)) : null
  ]);
  return alert + five + meta + rounds;
}
function tabProjects() {
  var all = myProjects();
  if (!all.length || S.scene === 'empty') {
    return emptyBox(L('You have not created a financing project yet','您还没有创建融资项目'),
      L('A financing project is the collateral pool you publish a demand from.','融资项目就是您发布融资需求所用的资产池。'),
      { label: L('Create a financing project','去创建融资项目'), primary:true, href: hNewProject() });
  }
  var f = S.filters;
  var list = all.filter(function (p) {
    if (f.pjSt && f.pjSt !== 'all' && p.st !== f.pjSt) return false;
    if (f.pjCov && f.pjCov !== 'all' && p.cov !== f.pjCov) return false;
    return true;
  });
  list = applySort(list, 'projects', {
    created: function (p) { return ts(p.createdAt + ' 00:00'); },
    valid  : function (p) { return p.valid; },
    balance: function (p) { return p.balance; },
    expires: function (p) { return ts(p.expiresAt + ' 00:00'); }
  }, { by:'created', dir:'desc' });
  var pp = paged(list, 'projects');
  var cols = 8;
  var rows = pp.rows.map(function (p) {
    var id = 'pj-' + p.id;
    var acts = [];
    if (p.st === 'S-FP-1') acts.push({ label: L('Publish a demand','发布融资需求'), primary:true,
      blocked: !!p.emptyPool,
      reason: p.emptyPool ? L('The pool holds no valid collateral yet.','池内暂无有效质押。') : null,
      href: hAction('publish', 'project/' + p.id) });
    acts.push({ label: L('Add pledge','去追加质押'), href: hAction('pledge', 'project/' + p.id) });
    if (p.redeemN) acts.push({ label: L('Release pledge','去解除质押'),
      href: hAction('redeem', 'project/' + p.id) });
    acts.push({ label: L('Open the project','查看项目详情'), href: hProject(p.id) });
    return '<tr class="' + (S.open[id] ? 'is-open' : '') + '">'
      + '<td>' + caret(id) + '</td>'
      + '<td>' + main(L(p.name[0], p.name[1])) + sub(p.id) + '</td>'
      + '<td>' + enumPill(FP_ST, p.st)
        + (p.emptyPool ? '<div class="cell-note">' + L('Empty pool','空池') + '</div>' : '') + '</td>'
      + '<td>' + enumPill(COV, p.cov)
        + (p.cov === 'under' ? '<div class="cell-note">' + E(g('coverageGap') + ' ' + usd(gapOf(p))) + '</div>' : '') + '</td>'
      + '<td class="num">' + num(p.tokenN, 0) + '</td>'
      + '<td class="num">' + num(p.valid) + '</td>'
      + '<td class="num">' + num(p.balance) + '</td>'
      + '<td class="c-time">' + p.expiresAt + '</td>'
      + '<td class="col-act">' + actCell(acts) + '</td>'
      + '</tr>' + detailRow(id, cols + 1, projectDetail(p));
  }).join('');
  return '<div class="card">'
    + filterBar([
        selField(L('Project status','项目状态'), 'pjSt', [['all', L('All','全部')]].concat(
          Object.keys(FP_ST).map(function (k) { return [k, enumText(FP_ST, k)]; }))),
        selField(g('coverage'), 'pjCov', [['all', L('All','全部')]].concat(
          Object.keys(COV).map(function (k) { return [k, enumText(COV, k)]; })))
      ], 'projects')
    + (list.length ? '<div class="tablewrap mc-wrap"><table class="tbl wide"><thead><tr>'
        + '<th class="mc-cw"></th>'
        + '<th>' + g('project') + '</th>'
        + '<th>' + L('Project status','项目状态') + '</th>'
        + '<th>' + g('coverage') + '</th>'
        + '<th class="num">' + L('Pledged tokens','质押代币数量') + '</th>'
        + sortTh('projects','valid', g('pledgedValue'), 'num')
        + sortTh('projects','balance', g('outstanding'), 'num')
        + sortTh('projects','expires', L('Valid until','有效期至'), 'c-time')
        + '<th class="col-act">' + L('Actions','操作') + '</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>' + pager(pp)
      : noResult(all.length))
    + '</div>';
}

/* ---------------- 授信明细 / 授信汇总 ---------------- */
function tabCredit() {
  var all = myCredits();
  if (!all.length || S.scene === 'empty') {
    return S.role === 'asset'
      ? emptyBox(L('No institution has set a credit line for you yet','还没有机构对您核定授信额度'),
          L('Institutions run the credit assessment inside the quoting flow, so a line appears once someone quotes.',
            '机构在报价时会先完成授信核定，核定后这里就会出现记录。'), null)
      : emptyBox(L('You have not set a credit line for any asset owner yet','您还没有对任何资产方核定授信额度'),
          L('Credit assessment is a step inside the quoting flow in the marketplace.','授信核定是广场报价流程内的一步。'),
          { label: L('Browse the marketplace','去借贷广场看看'), href: hMarketplace() });
  }
  var f = S.filters;
  var list = all.filter(function (c) { return !f.crSt || f.crSt === 'all' || c.st === f.crSt; });
  list = applySort(list, 'credit', {
    avail: function (c) { return c.avail; },
    line : function (c) { return c.line; },
    to   : function (c) { return ts(c.to + ' 00:00'); }
  }, { by:'avail', dir:'asc' });
  var pp = paged(list, 'credit');
  var cols = 10;
  var rows = pp.rows.map(function (c) {
    var id = 'cr-' + c.id;
    var other = S.role === 'asset' ? c.fund : c.asset;
    return '<tr class="' + (S.open[id] ? 'is-open' : '') + '">'
      + '<td>' + caret(id) + '</td>'
      + '<td>' + main(co(other)) + sub(c.id) + '</td>'
      + '<td>' + enumPill(CR_ST, c.st)
        + (c.st === 'S-CR-2' ? '<div class="cell-sub">'
            + E(L('Existing deals keep performing; a new quote re-runs the assessment.',
                  '存量业务照常履约中，如需再次报价请在报价流程内重新核定。')) + '</div>' : '') + '</td>'
      + '<td class="num">' + num(c.line) + '</td>'
      + '<td class="num">' + num(c.deal) + '</td>'
      + '<td class="num">' + num(c.quote) + '</td>'
      + '<td class="num mc-total">' + num(c.deal + c.quote) + '</td>'
      + '<td class="num">' + num(c.avail) + '</td>'
      + '<td class="c-time">' + c.to + '</td>'
      + '</tr>' + detailRow(id, cols, dl([
          kv(L('First assessed','首次核定时间'), E(c.from)),
          kv(L('Valid until','有效期至'), E(c.to)),
          kv(g('crUsedTotal'), usd(c.deal + c.quote),
             L('= committed to deals + committed to quotes','＝ 授信占用额 + 在途报价金额')),
          S.role === 'fund' && c.memo ? kv(L('Institution note','机构备注'), E(L(c.memo[0], c.memo[1])),
             L('Visible to your institution only','仅本机构可见')) : null
        ]));
  }).join('');
  return '<div class="card">'
    + '<div class="card-head"><b>' + (S.role === 'asset' ? L('Credit lines','授信明细') : L('Credit summary','授信汇总'))
    + '</b><span>' + L('Organised by institution × asset owner, not by project. Read-only on both sides.',
        '按「机构 × 资产方」企业二元组组织，不按项目拆；两侧都是只读。') + '</span></div>'
    + filterBar([
        selField(L('Line status','额度状态'), 'crSt', [['all', L('All','全部')]].concat(
          Object.keys(CR_ST).map(function (k) { return [k, enumText(CR_ST, k)]; })))
      ], 'credit')
    + (list.length ? '<div class="tablewrap mc-wrap"><table class="tbl wide"><thead><tr>'
        + '<th class="mc-cw"></th>'
        + '<th>' + (S.role === 'asset' ? L('Institution','授信机构') : L('Asset owner','资产方')) + '</th>'
        + '<th>' + L('Line status','额度状态') + '</th>'
        + sortTh('credit','line', g('creditLine'), 'num')
        + '<th class="num">' + g('crUsedDeal') + '</th>'
        + '<th class="num">' + g('crUsedQuote') + '</th>'
        + '<th class="num">' + g('crUsedTotal') + '</th>'
        + sortTh('credit','avail', g('crAvail'), 'num')
        + sortTh('credit','to', L('Valid until','有效期至'), 'c-time')
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>' + pager(pp)
      : noResult(all.length))
    + '</div>';
}

/* ---------------- 融资放款信息 ---------------- */
function payAcctBlock(fundId) {
  var a = PAY_ACCOUNTS[fundId]; if (!a) return '';
  var body = a.kind === 'fiat'
    ? dl([ kv(L('Account name','户名'), E(L(a.name[0], a.name[1]))),
           kv(L('Account number','账号'), mono(a.acct)),
           kv('SWIFT', mono(a.swift)),
           kv(L('Bank','开户行'), E(L(a.bank[0], a.bank[1]))),
           kv(L('Intermediary bank','中转行'), E(L(a.inter[0], a.inter[1]))) ])
    : dl([ kv(L('Wallet address','钱包地址'), mono(a.wallet)),
           kv(g('chain'), CHAIN + ' · ' + TOKEN_STD) ]);
  return '<div class="mc-sub"><div class="sh">' + L('Repayment collection account','还款收款账户') + '</div>'
    + '<p class="tiny">' + L('This is the account the funder will receive repayments in. It is not the account this disbursement was paid from. Read-only after disbursement.',
        '这是资金方将来收还款的账户，与本次出账账户无关；放款后本期不可修改。') + '</p>'
    + body + '</div>';
}
function disbDetail(d) {
  var terms = '<div class="mc-sub"><div class="sh">' + L('Commercial terms','商务条款') + '</div>'
    + dl([
        kv(L('Settlement currency','结算币种'), CCY),
        kv(L('Financing amount','融资金额'), usd(d.amt)),
        kv(L('FX snapshot','汇率快照'), '1.0000', L('Taken at quote time, never recalculated','报价时快照，永不重算')),
        kv(L('Settlement amount','结算金额'), usd(d.settle)),
        kv(L('Interest rate','利率'), num(d.rate) + '% ' + L('p.a.','年化')),
        kv(g('repayType'), E(L(REPAY_TYPE[0], REPAY_TYPE[1]))),
        kv(g('finalDueDate'), E(d.finalDue), L('Follows the project end date','跟随项目截止日'))
      ]) + '</div>';
  var rec = d.ln
    ? '<div class="mc-sub"><div class="sh">' + L('Disbursement record','放款记录') + '</div>'
      + dl([
          kv(L('Amount','放款金额'), usd(d.ln.amt)),
          kv(L('Paid at','发放时间'), E(d.ln.at),
             L('For reconciliation only — no deadline or interest uses it','仅作业务参考与对账依据，任何时效与计息都不使用它')),
          kv(L('Submitted at','提交时间'), E(d.ln.submitAt)),
          kv(L('Transfer receipt','放款凭证'), d.ln.proofN
             ? L('Provided · ' + d.ln.proofN + ' file(s)','有 · ' + d.ln.proofN + ' 份') : L('None','无')),
          kv(L('Paying account','出账收款账户快照'), mono('**** **** **** 6902'))
        ])
      + txLink(d.ln.hash)
      + (d.ln.memo ? '<p class="tiny">' + L('Note: ','放款备注：') + E(L(d.ln.memo[0], d.ln.memo[1])) + '</p>' : '')
      + '</div>'
    : '';
  var seal = d.seal
    ? '<div class="mc-sub"><div class="sh">' + L('Stamped contract','盖章件') + '</div>'
      + dl([ kv(L('File','文件'), d.seal.has ? L('Provided','有') : L('None','无')),
             kv(L('Uploaded at','上传时间'), E(d.seal.at)),
             kv(L('Versions','版本数'), num(d.seal.versions, 0)) ])
      + '<p class="tiny">' + L('The file itself is opened in the marketplace.','正文查看在借贷广场进行。') + '</p></div>'
    : '';
  var win = '';
  if (d.st === 'S-FD-4' && d.windowTo) {
    var r = left(d.windowTo);
    win = '<div class="mc-cd ' + (r.over ? 'over' : (urgent(d.windowTo) ? 'soon' : '')) + '">'
      + '<div class="by">' + g('disbWindow') + ' · ' + L('due ','到期时刻 ') + d.windowTo + ' ' + TZ + '</div>'
      + '<div class="big"><span class="v">' + E(r.over
          ? L('Past by ' + r.days + ' day(s)','已超过 ' + r.days + ' 天')
          : leftText(d.windowTo)) + '</span></div>'
      + (r.over ? mailBlock(g('demandNo') + ' ' + d.round + ' / ' + g('dealNo') + ' ' + d.id) : '')
      + '</div>';
  }
  return win + terms + rec + payAcctBlock(d.fund) + seal;
}
function tabDisb() {
  var all = disbDeals();
  if (!all.length || S.scene === 'empty') {
    return emptyBox(L('No deal has reached the disbursement stage yet','还没有进入放款环节的业务'),
      L('Deals appear here once a quote has been accepted in the marketplace.','报价在广场被接受后，业务会出现在这里。'),
      { label: L('Browse the marketplace','去借贷广场'), href: hMarketplace() });
  }
  if (S.blocks.disb === 'error') return blockError('disb', { en:'disbursements', zh:'融资放款信息' });
  var f = S.filters;
  var list = all.filter(function (d) {
    if (f.dbSt && f.dbSt !== 'all' && d.st !== f.dbSt) return false;
    if (f.dbOv === 'over' && !d.overdue) return false;
    if (f.dbOv === 'in' && d.overdue) return false;
    return true;
  });
  list = applySort(list, 'disb', {
    submit: function (d) { return d.ln ? ts(d.ln.submitAt) : 0; },
    amt   : function (d) { return d.amt; },
    win   : function (d) { return d.windowTo ? ts(d.windowTo) : Infinity; }
  }, { by:'submit', dir:'desc' });
  var pp = paged(list, 'disb');
  var cols = 8;
  var rows = pp.rows.map(function (d) {
    var id = 'db-' + d.id;
    var acts = [];
    if (S.role === 'asset' && d.st === 'S-FD-4') acts.push({ label: L('Confirm receipt','去确认收到放款'),
      primary:true, href: hAction('confirm_disbursement', 'deal/' + d.id) });
    if (S.role === 'asset' && d.reupload && d.reupload.need) acts.push({ label: L('Re-upload','去重传盖章件'),
      href: hAction('reupload_contract', 'deal/' + d.id) });
    if (S.role === 'fund' && d.st === 'S-FD-3') acts.push({ label: L('Record disbursement','去放款'),
      primary:true, href: hAction('disburse', 'deal/' + d.id) });
    acts.push({ label: L('Open the deal','查看融资业务'), href: hDeal(d.id) });
    var marks = '';
    if (d.reupload && d.reupload.need) marks += '<div class="cell-note">'
      + L('Stamped contract to re-upload','待重传盖章件') + '</div>';
    if (d.hold) marks += '<div class="cell-note">' + L('Disbursement on hold','已暂缓放款') + '</div>';
    if (d.overdue) marks += '<div class="cell-note">'
      + L('Past the disbursement confirmation window','已超过放款确认时限') + '</div>';
    return '<tr class="' + (S.open[id] ? 'is-open' : '') + '">'
      + '<td>' + caret(id) + '</td>'
      + '<td>' + main(d.id) + sub(g('demandNo') + ' ' + d.round) + '</td>'
      + '<td>' + E(dealProjName(d)) + sub(S.role === 'asset' ? co(d.fund) : co(d.asset)) + '</td>'
      + '<td>' + enumPill(FD_ST, d.st) + marks + '</td>'
      + '<td class="num">' + num(d.ln ? d.ln.amt : d.amt) + '</td>'
      + '<td class="c-time">' + (d.ln ? d.ln.submitAt : '—') + '</td>'
      + '<td>' + (d.st === 'S-FD-4' && d.windowTo
          ? '<span class="' + (d.overdue ? 'mc-over' : (urgent(d.windowTo) ? 'mc-soon' : '')) + '">'
            + E(d.overdue ? L('Past by ' + left(d.windowTo).days + ' day(s)',
                              '已超期 ' + left(d.windowTo).days + ' 天') : leftText(d.windowTo))
            + '</span>' + sub(L('due ','到期 ') + d.windowTo)
          : '<span class="faint">—</span>') + '</td>'
      + '<td class="col-act">' + actCell(acts) + '</td>'
      + '</tr>' + detailRow(id, cols + 1, disbDetail(d));
  }).join('');
  return '<div class="card">'
    + filterBar([
        selField(L('Deal status','业务状态'), 'dbSt', [['all', L('All','全部')]].concat(
          ['S-FD-3','S-FD-4','S-FD-6','S-FD-8','S-FD-10'].map(function (k) { return [k, enumText(FD_ST, k)]; }))),
        selField(L('Confirmation window','放款确认时限'), 'dbOv', [['all', L('All','全部')],
          ['over', L('Past the window','已超过时限')], ['in', L('Within the window','未超过时限')]])
      ], 'disb')
    + (list.length ? '<div class="tablewrap mc-wrap"><table class="tbl wide"><thead><tr>'
        + '<th class="mc-cw"></th>'
        + '<th>' + g('dealNo') + '</th>'
        + '<th>' + g('project') + ' / ' + (S.role === 'asset' ? L('Institution','机构') : L('Asset owner','资产方')) + '</th>'
        + '<th>' + L('Deal status','业务状态') + '</th>'
        + sortTh('disb','amt', L('Disbursed amount','放款金额'), 'num')
        + sortTh('disb','submit', L('Submitted at','提交时间'), 'c-time')
        + sortTh('disb','win', g('disbWindow'))
        + '<th class="col-act">' + L('Actions','操作') + '</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>' + pager(pp)
      : noResult(all.length))
    + '</div>';
}

/* ---------------- 还款信息 ---------------- */
function repayDetail(x) {
  var d = x.d, pl = x.pl, r = x.r;
  var biz = '<div class="mc-sub"><div class="sh">' + L('Deal level','业务级') + '</div>'
    + dl([
        kv(L('Plan finalised','计划定稿时间'), E(pl.planAt)),
        kv(L('Interest start date','起息日'), E(pl.startDate)),
        kv(g('finalDueDate'), E(pl.finalDue), L('Follows the project end date, not snapshotted','跟随项目截止日，不快照')),
        kv(L('Principal repaid to date','累计已还本金'), usd(pl.paidPri)),
        kv(L('Interest repaid to date','累计已还利息'), usd(pl.paidInt)),
        kv(L('Outstanding principal','未偿本金'), usd(pl.unpaid)),
        kv(L('Plan version','计划版本'), 'v' + pl.version),
        pl.settledAt ? kv(L('Settled at','结清时间'), E(pl.settledAt)) : null
      ]) + '</div>';
  var inst = '<div class="mc-sub"><div class="sh">' + L('Instalment','期次') + '</div>'
    + dl([
        kv(L('Interest period','计息区间'), E(r.from + ' → ' + r.to),
           L(r.days + ' day(s)', r.days + ' 天')),
        kv(L('Principal due','应还本金'), usd(r.pri)),
        kv(L('Interest due','应还利息'), usd(r.int)),
        kv(L('Total due','应还合计'), usd(r.pri + r.int)),
        kv(g('repayType'), E(L(REPAY_TYPE[0], REPAY_TYPE[1]))),
        kv(g('repayNature'), r.nature
          ? (r.nature === 'normal' ? L('On-time repayment','正常还款') : L('Overdue repayment','逾期还款'))
          : '<span class="faint">—</span>'),
        kv(L('Repayment window opens','还款入口开启时间'), E(r.window + ' ' + TZ)),
        kv(L('Interest rule','计息规则'), E(L(
          'Simple interest, ACT/360, interest accrues from the start date and stops on the due date. Start date ' + pl.startDate + '.',
          '年化单利，实际天数 ÷ 360，起息日计息、应还日不计息；起息日 ' + pl.startDate + '。')))
      ])
    + (r.last ? '<p class="tiny"><b>' + L('Final instalment · principal and interest at maturity',
        '末期 · 含本金 · 到期还本付息') + '</b></p>' : '') + '</div>';
  var rm = '';
  if (r.paidAt) {
    var over = r.confirmOverdue;
    rm = '<div class="mc-sub"><div class="sh">' + L('Repayment record','还款记录') + '</div>'
      + dl([
          kv(L('Amount','还款金额'), usd(r.pri + r.int)),
          kv(L('Submitted at','提交时间'), E(r.paidAt)),
          kv(g('chain'), CHAIN + ' · ' + TOKEN_STD),
          kv(L('Collection account','收款账户快照'), PAY_ACCOUNTS[d.fund] && PAY_ACCOUNTS[d.fund].kind === 'fiat'
             ? mono(PAY_ACCOUNTS[d.fund].acct) : mono((PAY_ACCOUNTS[d.fund] || {}).wallet || '—')),
          r.settledAt ? kv(L('Confirmed at','确认时间'), E(r.settledAt)) : null,
          r.confirmTo ? kv(g('repayWindow'), E(r.confirmTo + ' ' + TZ),
            over ? L('Past by ' + left(r.confirmTo).days + ' day(s)','已超期 ' + left(r.confirmTo).days + ' 天')
                 : leftText(r.confirmTo)) : null
        ])
      + txLink('0x' + (d.id.slice(-4)) + 'ad41f907c5382b6f109ad4e72c58b310697fe24da05c8317bf94206e5138a7')
      + (over ? mailBlock(g('demandNo') + ' ' + d.round + ' / ' + L('instalment ','期次 ') + r.seq) : '')
      + '</div>';
  }
  return biz + inst + rm;
}
function tabRepay() {
  var all = S.scene === 'empty' ? [] : repayRows();
  if (!all.length) {
    return emptyBox(L('No deal has reached the repayment stage yet','还没有进入还款环节的业务'),
      L('A repayment plan is finalised in the same settlement as the disbursement confirmation.',
        '还款计划在放款确认完成的同一次结算内定稿。'),
      { label: L('Browse the marketplace','去借贷广场'), href: hMarketplace() });
  }
  if (S.blocks.repay === 'error') return blockError('repay', { en:'repayments', zh:'还款信息' });
  var f = S.filters;
  var list = all.filter(function (x) {
    if (f.rpSt && f.rpSt !== 'all' && x.r.st !== f.rpSt) return false;
    if (f.rpOv === 'yes' && !x.r.overdue) return false;
    if (f.rpOv === 'no' && x.r.overdue) return false;
    return true;
  });
  list = applySort(list, 'repay', {
    due  : function (x) { return ts(x.r.due + ' 00:00'); },
    total: function (x) { return x.r.pri + x.r.int; }
  }, { by:'server', dir:'asc' });
  var pp = paged(list, 'repay');
  var cols = 9;
  var rows = pp.rows.map(function (x) {
    var d = x.d, r = x.r, id = 'rp-' + d.id + '-' + r.seq;
    var open = windowOpen(r.window);
    var acts = [];
    if (S.role === 'asset' && r.st === 'S-RP-1') acts.push({
      label: L('Repay','去还款'), primary:true,
      blocked: !open && !r.overdue,
      reason: (!open && !r.overdue)
        ? L('Opens on ' + r.window.slice(0, 10) + '.', '将于 ' + r.window.slice(0, 10) + ' 开启。') : null,
      href: hAction('repay', 'schedule/' + d.id + '-' + r.seq) });
    if (S.role === 'fund' && r.st === 'S-RP-2') acts.push({
      label: L('Confirm receipt','去确认收到还款'), primary:true,
      href: hAction('confirm_repayment', 'schedule/' + d.id + '-' + r.seq) });
    acts.push({ label: L('Open the deal','查看融资业务'), href: hDeal(d.id) });
    return '<tr class="' + (S.open[id] ? 'is-open' : '') + '">'
      + '<td>' + caret(id) + '</td>'
      + '<td>' + main(d.id) + sub(g('demandNo') + ' ' + d.round) + '</td>'
      + '<td class="num">' + L('No. ','第 ') + r.seq + L('','期')
        + (r.last ? '<div class="cell-note">' + L('Final · principal included','末期 · 含本金') + '</div>' : '') + '</td>'
      + '<td class="c-time">' + r.due + '</td>'
      + '<td class="c-time">' + r.from + '<div class="t2">' + r.to + '</div></td>'
      + '<td class="num">' + num(r.pri + r.int)
        + '<div class="cell-sub">' + L('principal ','本金 ') + num(r.pri) + ' · '
        + L('interest ','利息 ') + num(r.int) + '</div></td>'
      + '<td>' + enumPill(RP_ST, r.st)
        + (r.overdue ? '<div class="cell-note">' + L('Overdue ' + r.overdue + ' day(s)',
            '已逾期 ' + r.overdue + ' 天') + '</div>' : '')
        + (r.confirmOverdue ? '<div class="cell-note">'
            + L('Past the repayment confirmation window','已超过还款确认时限') + '</div>' : '') + '</td>'
      + '<td>' + (r.nature
          ? (r.nature === 'normal' ? L('On-time repayment','正常还款') : L('Overdue repayment','逾期还款'))
          : '<span class="faint">—</span>') + '</td>'
      + '<td class="col-act">' + actCell(acts) + '</td>'
      + '</tr>' + detailRow(id, cols + 1, repayDetail(x));
  }).join('');
  var head = '<div class="card-head"><b>' + L('Repayments','还款信息') + '</b>'
    + '<span>' + L('Grouped deal → demand → instalment. Rows are returned in the server&#39;s order.',
        '按「融资业务 → 需求编号 → 期次」三层展示，排序取服务端下发顺序。') + '</span>'
    + '<span class="right">' + actBtn({ label: L('View repayment schedule','查看还款计划'),
        href: hAction('view_schedule', 'deal/' + pp.rows[0].d.id) }) + '</span></div>';
  return '<div class="card">' + head
    + filterBar([
        selField(L('Instalment status','期次状态'), 'rpSt', [['all', L('All','全部')]].concat(
          Object.keys(RP_ST).map(function (k) { return [k, enumText(RP_ST, k)]; }))),
        selField(L('Overdue','是否逾期'), 'rpOv', [['all', L('All','全部')],
          ['yes', L('Overdue','已逾期')], ['no', L('Not overdue','未逾期')]])
      ], 'repay')
    + (list.length ? '<div class="tablewrap mc-wrap"><table class="tbl wide"><thead><tr>'
        + '<th class="mc-cw"></th>'
        + '<th>' + g('dealNo') + '</th>'
        + '<th class="num">' + L('Instalment','期次') + '</th>'
        + sortTh('repay','due', L('Due date','应还日'), 'c-time')
        + '<th class="c-time">' + L('Interest period','计息区间') + '</th>'
        + sortTh('repay','total', L('Total due','应还合计'), 'num')
        + '<th>' + L('Instalment status','期次状态') + '</th>'
        + '<th>' + g('repayNature') + '</th>'
        + '<th class="col-act">' + L('Actions','操作') + '</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>' + pager(pp)
      : noResult(all.length))
    + '</div>';
}

/* ---------------- 我的报价（资金方） ---------------- */
function quoteDetail(d) {
  var p = d.pid ? proj(d.pid) : null;
  return '<div class="mc-sub"><div class="sh">' + L('Commercial terms','商务条款') + '</div>'
    + dl([
        kv(L('Settlement currency','结算币种'), CCY),
        kv(L('Quoted amount','报价金额'), usd(d.amt)),
        kv(L('FX snapshot','汇率快照'), '1.0000'),
        kv(L('Settlement amount','结算金额'), usd(d.settle)),
        kv(L('Interest rate','利率'), num(d.rate) + '% ' + L('p.a.','年化')),
        kv(g('repayType'), E(L(REPAY_TYPE[0], REPAY_TYPE[1]))),
        kv(g('finalDueDate'), E(d.finalDue))
      ]) + '</div>'
    + '<div class="mc-sub"><div class="sh">' + L('Lock information','锁定信息') + '</div>'
    + dl([
        kv(L('Quoted at','报价时间'), E(d.quoteAt)),
        kv(L('Locked for','已锁定时长'), E(d.lockTo
          ? L(Math.round((nowTs() - ts(d.quoteAt)) / 3600000) + ' h',
              Math.round((nowTs() - ts(d.quoteAt)) / 3600000) + ' 小时')
          : '—')),
        kv(g('quoteWindow'), d.lockTo ? E(leftText(d.lockTo)) : '<span class="faint">—</span>',
          d.lockTo ? L('expires ' + d.lockTo + ' ' + TZ, '到期时刻 ' + d.lockTo + ' ' + TZ) : null),
        d.endAt ? kv(L('Ended at','终结时间'), E(d.endAt)) : null,
        d.why ? kv(d.st === 'S-FD-2' ? L('Decline reason','拒绝原因') : L('Lapse reason','失效原因'),
          E(L(d.why[0], d.why[1]))) : null,
        p ? kv(g('coverage'), enumPill(COV, p.cov)) : null
      ]) + '</div>';
}
function tabQuotes() {
  var all = S.scene === 'empty' ? [] : quoteDeals();
  if (!all.length) {
    return emptyBox(L('You have not submitted any quote yet','您还没有提交过报价'),
      L('Quotes are submitted from a financing demand in the marketplace.','报价在广场的融资需求上提交。'),
      { label: L('Browse the marketplace','去借贷广场'), href: hMarketplace() });
  }
  var f = S.filters;
  var list = all.filter(function (d) { return !f.qtSt || f.qtSt === 'all' || d.st === f.qtSt; });
  list = applySort(list, 'quotes', {
    at  : function (d) { return ts(d.quoteAt); },
    amt : function (d) { return d.amt; },
    rate: function (d) { return d.rate; }
  }, { by:'at', dir:'desc' });
  var pp = paged(list, 'quotes');
  var cols = 8;
  var rows = pp.rows.map(function (d) {
    var id = 'qt-' + d.id;
    var p = d.pid ? proj(d.pid) : null;
    var acts = [];
    if (d.st === 'S-FD-3') acts.push({ label: L('Record disbursement','去放款'), primary:true,
      href: hAction('disburse', 'deal/' + d.id) });
    acts.push({ label: L('Open the deal','查看融资业务'), href: hDeal(d.id) });
    return '<tr class="' + (S.open[id] ? 'is-open' : '') + '">'
      + '<td>' + caret(id) + '</td>'
      + '<td>' + main(d.id) + sub(g('demandNo') + ' ' + d.round) + '</td>'
      + '<td>' + E(co(d.asset)) + sub(dealProjName(d)) + '</td>'
      + '<td class="num">' + num(d.amt) + '</td>'
      + '<td class="num">' + num(d.rate) + '%</td>'
      + '<td>' + enumPill(FD_ST, d.st) + '</td>'
      + '<td>' + (d.lockTo && d.st === 'S-FD-1'
          ? '<span class="' + (urgent(d.lockTo) ? 'mc-soon' : '') + '">' + E(leftText(d.lockTo)) + '</span>'
            + sub(L('expires ','到期 ') + d.lockTo)
          : '<span class="faint">—</span>') + '</td>'
      + '<td>' + (p ? enumPill(COV, p.cov) : '<span class="faint">—</span>') + '</td>'
      + '<td class="col-act">' + actCell(acts) + '</td>'
      + '</tr>' + detailRow(id, cols + 2, quoteDetail(d));
  }).join('');
  return '<div class="card">'
    + filterBar([
        selField(L('Deal status','业务状态'), 'qtSt', [['all', L('All','全部')]].concat(
          ['S-FD-1','S-FD-2','S-FD-11','S-FD-3','S-FD-4','S-FD-6','S-FD-8'].map(function (k) {
            return [k, enumText(FD_ST, k)]; })))
      ], 'quotes')
    + (list.length ? '<div class="tablewrap mc-wrap"><table class="tbl wide"><thead><tr>'
        + '<th class="mc-cw"></th>'
        + '<th>' + g('dealNo') + '</th>'
        + '<th>' + g('assetOwner') + ' / ' + g('project') + '</th>'
        + sortTh('quotes','amt', L('Quoted amount','报价金额'), 'num')
        + sortTh('quotes','rate', L('Rate','利率'), 'num')
        + '<th>' + L('Deal status','业务状态') + '</th>'
        + '<th>' + g('quoteWindow') + '</th>'
        + '<th>' + g('coverage') + '</th>'
        + '<th class="col-act">' + L('Actions','操作') + '</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>' + pager(pp)
      : noResult(all.length))
    + '</div>';
}

function tabBody() {
  if (S.blocks.tab === 'loading') return skelRows(6);
  if (S.tab === 'tokens')   return tabTokens();
  if (S.tab === 'projects') return tabProjects();
  if (S.tab === 'credit')   return tabCredit();
  if (S.tab === 'disb')     return tabDisb();
  if (S.tab === 'repay')    return tabRepay();
  return tabQuotes();
}

/* ================================================================
   Part I —— 整页组装、游客态与空主体态
   ================================================================ */
function demoBar() {
  return '<div class="demobar"><b>' + L('Demonstration data','演示数据') + '</b>'
    + '<span>' + L('Companies, IDs, amounts, accounts and hashes on this page are fictional and exist only to walk the interface. "Now" is fixed at ' + NOW + ' ' + TZ + ' so every countdown is reproducible.',
        '本页企业、编号、金额、账户与哈希均为虚构演示数据，仅用于走通界面；演示"此刻"固定为 ' + NOW + ' ' + TZ + '，倒计时可复现。') + '</span>'
    + '<span class="right"><span class="pill dash">' + L('Read-only page','只读页面') + '</span></span></div>';
}
function guestView() {
  return '<div class="mc-guest"><div class="card"><div class="card-b shell">'
    + '<span class="pill dash">' + L('Session ended','会话已结束') + '</span>'
    + '<h1 class="page-title" style="margin-top:8px">' + g('console') + '</h1>'
    + '<p>' + L('Your session has ended, so everything on this page has been removed — the figures, the to-dos and every list. Nothing is left behind a dialog.',
        '会话已失效，本页的统计数字、待办与全部列表已从页面上移除，不是被弹层盖住。') + '</p>'
    + '<p class="tiny">' + L('Sessions last four hours. There is no "remember me", and nothing you were viewing is kept as a draft.',
        '会话有效期 4 小时，无「记住我」；页面不暂存任何草稿。') + '</p>'
    + '<div style="margin-top:16px">' + actBtn({ label: L('Sign in','立即登录'), primary:true,
        act:'mc.signin' }) + '</div>'
    + '</div></div></div>';
}
function noEntityView() {
  return '<div class="card"><div class="card-b shell">'
    + '<h1 class="page-title">' + g('console') + '</h1>'
    + '<p>' + L('Your institution profile has not been submitted yet, so there is nothing to aggregate here — no figures, no lists.',
        '您的机构资料尚未提交，控制台暂无可聚合的数据——不展示统计数字，也不列出任何清单。') + '</p>'
    + '<p class="tiny">' + L('This is not an error. Submit the profile and this page fills itself in on the next load.',
        '这不是错误页；提交资料后，下一次进入控制台即按新主体取数。') + '</p>'
    + '<div style="margin-top:16px">' + actBtn({ label: L('Submit the institution profile','去提交机构资料'),
        primary:true, href: hInstitution() }) + '</div>'
    + '</div></div>';
}
function pageConsole() {
  /* 状态切换条是原型评审脚手架，任何场景下都要留着，否则进了游客态就出不来 */
  if (S.scene === 'expired') return CF.pageStates() + guestView();
  if (S.scene === 'l0') return demoBar() + CF.pageStates() + noEntityView();
  var who = S.role === 'asset' ? g('assetOwner') : g('funder');
  var head = '<div class="mc-head"><div class="hb">'
    + '<h1 class="page-title">' + g('console') + '</h1>'
    + '<p class="page-desc">' + L('Everything that belongs to you, in one place: the figures, what needs doing, and the way back to the marketplace to do it. This page records nothing itself — every action button opens the marketplace.',
        '把属于您的数据聚合到一页：把数聚起来、把待办列出来、把您送回广场去办。本页不产生任何新事实，每一个动作按钮都是跳借贷广场。') + '</p>'
    + '</div><div class="hm">'
    + '<span class="pill gray">' + E(who) + '</span>'
    + '<span class="tiny">' + E(co(me())) + '</span>'
    + '<span class="tiny">' + L('Data refreshes when you open this page, when you come back from the marketplace, or when you refresh.',
        '数据在进入页面、从广场返回、手动刷新时更新。') + '</span>'
    + '</div></div>';
  return demoBar() + CF.pageStates() + head + statBlock() + todoBlock()
    + '<section class="mc-tabsec">' + tabBar() + filterStrip()
    + '<div class="mc-tabbody">' + tabBody() + '</div></section>';
}

/* ================================================================
   Part J —— 弹层：离站告知、失效代币清单
   ================================================================ */
function modalLeave() {
  var to = S.modal.to;
  var what = to === 'verify'
    ? L('identity verification','实名认证')
    : L('the rejected receivable','被驳回的应收账款');
  return '<div class="mask" data-act="closeModal"><div class="modal wide" role="dialog" aria-modal="true"'
    + ' aria-label="' + L('Leaving the platform','离站告知') + '" onclick="event.stopPropagation()">'
    + '<div class="modal-h"><b>' + L('You are about to leave this platform','即将离开本平台') + '</b>'
    + '<button class="modal-x" type="button" data-act="closeModal" aria-label="' + L('Close','关闭') + '">✕</button></div>'
    + '<div class="modal-b">'
    + '<p>' + L('This to-do is handled on the asset platform, a different site. ','这条待办在资产平台处理，属于另一个站点。')
    + L('You will continue with ','将前往办理：') + '<b>' + E(what) + '</b>.' + '</p>'
    + '<p class="tiny">' + L('If the destination is unavailable, come back and try again later — you will not be left on a blank page.',
        '若落地页暂时不可达，可稍后再试，不会把您留在空白页上。') + '</p>'
    + '</div>'
    + '<div class="modal-f"><button class="btn" type="button" data-act="closeModal">'
    + L('Stay here','留在本页') + '</button>'
    + '<button class="btn primary" type="button" data-act="mc.leaveGo">'
    + L('Continue to the asset platform','继续前往资产平台') + '</button></div>'
    + '</div></div>';
}
function modalVoid() {
  var p = proj(S.modal.pid);
  var list = TOKENS.filter(function (t) { return t.pid === p.id && t.st === 'TS-2'; });
  return '<div class="mask" data-act="closeModal"><div class="modal wide" role="dialog" aria-modal="true"'
    + ' aria-label="' + L('Void tokens','失效代币清单') + '" onclick="event.stopPropagation()">'
    + '<div class="modal-h"><b>' + L('Void tokens in this pool','本池内的失效代币') + '</b>'
    + '<button class="modal-x" type="button" data-act="closeModal" aria-label="' + L('Close','关闭') + '">✕</button></div>'
    + '<div class="modal-b"><table class="tbl"><thead><tr><th>' + L('Token ID','代币编号') + '</th>'
    + '<th class="num">' + L('Token value (USD)','代币价值（USD）') + '</th>'
    + '<th>' + L('Buyer','买方企业') + '</th></tr></thead><tbody>'
    + list.map(function (t) {
        return '<tr><td>' + mono(t.id) + '</td><td class="num">' + num(t.amt) + '</td><td>'
          + E(buyer(t.buyerIx)) + '</td></tr>';
      }).join('')
    + '</tbody></table>'
    + '<p class="tiny" style="margin-top:12px">' + L('Void tokens stay in the pool but are excluded from the pledged token value.',
        '失效代币仍留在池内，但不计入质押代币价值。') + '</p></div>'
    + '<div class="modal-f"><button class="btn" type="button" data-act="closeModal">'
    + L('Close','关闭') + '</button></div></div></div>';
}

/* ================================================================
   Part K —— PRD 摘录（给实现方的面板，不属于产品界面）
   ================================================================ */
var PRD_MC = {
  title: '我的控制台（只读）',
  src: 'v1.0-我的控制台-PRD.md V2.0 + 分册 01 / 02 ｜ 上游 WS-324 V9.2 / WS-325 V7.2 / WS-326 V3.2 / WS-327 V3.3',
  fields: [
    ['C-MC-01', '统计区', '四组指标 + 剩余可用授信；①与②是包含关系，②下必须给失效副行（`D-MC-47`/`D-MC-126`）；资金方不渲染①②'],
    ['C-MC-02', '待办提示带', '14 类判据、终点 10 跳广场 / 1 留控制台 / 3 跳其他模块；按终点分三组，组内按时限紧迫度排序（`D-MC-154`～`D-MC-158`）'],
    ['C-MC-03', 'tab 容器', '资产方五个、资金方四个，不渲染空 tab（`D-MC-124`）；默认落地资产方=代币列表、资金方=我的报价（`D-MC-125`）'],
    ['C-MC-04', '过滤条带', '带过滤的跳转必须显示「已按 X 过滤 / 清除」（`D-MC-148`）'],
    ['C-MC-05', '快捷按钮组', '三态由 `available_actions` 决定（`AC-MC-32`）：不返回→不渲染；可用→可点；⊘→可见不可点 + 服务端原因'],
    ['FP-11 / FP-13 / FP-20 / FP-21', '项目五个数与覆盖', '质押代币价值 / 已融资余额 / 质押覆盖状态 / 覆盖缺口；缺口与需追加资产价值成对给（`D-MC-134`）'],
    ['CR-08～CR-11', '授信四量', '只读消费、不自算；`CR-10` 呈现为"合计"，不作第四个并列量（`D-MC-119`/`D-MC-92`）'],
    ['FD-36～FD-38 / RM-15～RM-17 / QT-12 / QT-13 / RP-15', '时限与开窗', '一律取服务端绝对时刻，前端只渲染（`D-MC-120`）'],
    ['QT-15 / QT-16 / RP-12 / RP-13', '还款类型与还款性质', '`QT-15` 定值只读；`QT-16` 派生跟随 `FP-09` 不快照；`RP-13` 一律称「还款性质」（`D-MC-170`）'],
    ['LN-15 / LN-16', '还款收款账户', '法币五项含中转行 / 数币绑定钱包；只读脱敏、无修改入口（`D-MC-169`）；不是已作废的 `QT-07`/`QT-08`']
  ],
  rules: [
    ['AC-MC-11 零业务写操作', '页面上不存在任何业务提交入口；每个动作按钮都是跳广场的深链，**无任何例外**'],
    ['D-MC-115 深链承载', '`P-LS-04`～`P-LS-10` 是详情页操作区内的承载单元；控制台的全部深链目标都是做事类 → **右侧抽屉 760px**；控制台不深链到任何提示类 560px 弹窗（`D-MC-171`）'],
    ['D-MC-121 三个 168 小时分别命名', '报价有效期 / 放款确认时限 / 还款确认时限；界面不得出现无限定词的"7 天""有效期""倒计时"'],
    ['D-MC-122 环节名', '只用「报价确认」与「放款确认」；旧展示名全链路零残留；界面与消息标题不得出现无限定词的单字「确认」'],
    ['D-MC-135 档位与失效是两条线', '覆盖不足提醒挂项目行、失效结果挂逐轮需求行，两处分开呈现、文案互不引用，不写成因果句'],
    ['D-MC-134 覆盖不足提醒四条硬约束', '两个数成对给；中性事实描述；不得出现倒计时、进度条或"还来得及追加"的暗示；资金方同样可见'],
    ['D-MC-126 统计区②≠有效质押价值', '②是跨项目账面口径（含失效），必须给失效副行并标注「不计入覆盖」'],
    ['D-MC-127 剩余可用授信', '常驻一句"实际可融金额以发布需求时服务端当场重算的结果为准"，不得给出"你还能融 X"的数字'],
    ['6.2.1 四个中间量不展示', '融资上限 / 可融金额 / 项目在途金额 / 可撤回上限不在控制台任何位置展示，也不做额度尺与进度条'],
    ['D-MC-162 待办按企业、消息按人', '待办带常驻一句可展开说明；不得把待办按 `account_id` 过滤，也不得把未读数按企业聚合'],
    ['D-MC-167 界面不呈现平台内部规则', '不出现判据公式与任何条款/验收编号；但覆盖缺口两个数、三个倒计时、差额与出路、客服邮箱一个都不许删'],
    ['D-MC-168 链是常量', '本期只支持 ETH：只读展示、无选择控件；USDT/USDC 标注 ERC-20；浏览器链接取 ETH 固定前缀并常驻"平台未核验该交易"'],
    ['D-MC-68 精确值排序', '`X-2`（游客排序只能按区间）不适用于控制台：控制台对游客完全不可见，看的是本人本企业的完整口径数据'],
    ['D-MC-147～D-MC-149 URL 视图状态', 'tab / 筛选 / 排序 / 页码写入 URL；不得出现 `redirect`/`return_to`/`next`/`target` 参数'],
    ['D-MC-132 可提取代币提醒', '给出张数与金额、需自付 gas、可批量提取；不暗示代币自动回钱包；不设时限、不做倒计时'],
    ['D-MC-140 / D-MC-143 超期表述', '一律「已超过放款/还款确认时限 N 天」+ 可复制客服邮箱与编号指引；不得写"已失效""已逾期"；超期不改变状态、权限与金额']
  ],
  states: [
    ['加载中', '统计区、待办带、各 tab 各自独立骨架屏，互不阻塞'],
    ['分块降级', '某块取数失败就地给可重试错误态与原因，其余块照常可用；统计区某组取不到给"暂时取不到"占位，**不展示 0**'],
    ['空态', '六种空态各有自己的文案与 CTA；CTA 一律指向借贷广场或资产平台，控制台自己没有可执行动作（`D-MC-145`）'],
    ['entity_id 为 null', '资金方 L0 走整页空态，CTA 指向机构资料，不报错、不渲染一排 0（`D-MC-116`）'],
    ['会话失效', '回落游客态并把已渲染的个人数据从 DOM 清除，不是弹层遮挡（`D-MC-11` 红线）；不弹登录框、不进错误页'],
    ['深链带过滤落地', '按 URL 视图状态接住并显示过滤条带（`D-MC-165`）'],
    ['筛选无结果', '与空态区分：给"没有符合筛选条件的记录"与一键清空筛选'],
    ['状态已变', '控制台不预判、不提前拦截；落广场详情页 + Toast，返回后重取，过期待办自动消失（`E-MC-03`）']
  ],
  copy: [
    ['质押覆盖状态', 'Pledge coverage status', '覆盖有余 / 覆盖持平 / 覆盖不足'],
    ['三个 168 小时', 'Quote validity window / Disbursement confirmation window / Repayment confirmation window',
     '报价有效期 / 放款确认时限 / 还款确认时限'],
    ['三个确认环节', 'Quote confirmation / Disbursement confirmation / Repayment confirmation',
     '报价确认 / 放款确认 / 还款确认（英文下三者不得共用同一个词）'],
    ['还款类型 vs 还款性质', 'Repayment type (fixed value) / Repayment nature (on-time · overdue)',
     '还款类型（定值）/ 还款性质（正常还款 · 逾期还款）'],
    ['超期表述', 'Past the disbursement confirmation window by N day(s)', '已超过放款确认时限 N 天'],
    ['统计区五项', 'All tokens / Pledged tokens / Total credit granted / Financing drawn / Available credit remaining',
     '全部代币 / 已质押代币 / 总授信 / 已融额度 / 剩余可用授信'],
    ['过滤条带', 'Filtered by X · Clear', '已按 X 过滤 · 清除']
  ]
};

/* ================================================================
   Part L —— 模块装配
   ================================================================ */
var SCENES = [
  ['default',  'Default','默认'],
  ['loading',  'Loading','加载中'],
  ['blockfail','Block failure','分块降级'],
  ['empty',    'Empty','空态'],
  ['filtered', 'Deep link with filter','深链带过滤'],
  ['l0',       'Funder · no entity','资金方 · 无主体'],
  ['expired',  'Session expired','会话失效']
];
function applyScene(k) {
  S.scene = k;
  S.blocks = { stat:'ready', credit:'ready', todo:'ready', tab:'ready', disb:'ready', repay:'ready' };
  S.strip = null;
  if (k === 'loading') S.blocks = { stat:'loading', credit:'ready', todo:'loading', tab:'loading',
                                    disb:'ready', repay:'ready' };
  if (k === 'blockfail') { S.blocks.credit = 'error'; S.blocks.repay = 'error'; S.blocks.disb = 'ready'; }
  if (k === 'l0') { S.role = 'fund'; }
  if (k === 'filtered') {
    S.role = 'asset'; S.tab = 'disb';
    S.filters.dbOv = 'over';
    S.strip = ['Past the disbursement confirmation window','已超过放款确认时限'];
    pageState('disb').p = 1;
  }
  if (k === 'default' || k === 'empty' || k === 'blockfail') {
    if (S.tab === 'quotes' && S.role === 'asset') S.tab = 'tokens';
  }
}
function defaultTab() { return S.role === 'asset' ? 'tokens' : 'quotes'; }

var mod = {
  id: 'my-console',
  end: 'asset',
  home: 'P-MC-01',
  owns: ['P-MC-01'],
  dict: {
    en: { navMyConsole:'My Console', navPortalHome:'Home', navPlaza:'Marketplace',
          navMyProjects:'My projects', signOut:'Sign out' },
    zh: { navMyConsole:'我的控制台', navPortalHome:'首页', navPlaza:'借贷广场',
          navMyProjects:'我的融资项目', signOut:'退出登录' }
  },
  states: { 'P-MC-01': SCENES.map(function (x) { return [x[0], x[1], x[2]]; }) },
  prd: { 'P-MC-01': PRD_MC },
  state: function () {
    return { lang:'en', role:'asset', tab:'tokens', scene:'default',
             blocks:{ stat:'ready', credit:'ready', todo:'ready', tab:'ready', disb:'ready', repay:'ready' },
             filters:{}, sort:{}, pg:{}, open:{}, strip:null };
  },
  onBoot: function (s) { S = s; CF.S = s; },
  account: function () {
    if (S.scene === 'expired') {
      return { avatar:'—', ident:L('Not signed in','未登录'), ok:false,
               badText:L('Guest','游客') };
    }
    var op = OPERATOR[S.role];
    return { avatar: S.role === 'asset' ? 'ZM' : 'CL',
             ident: co(me()) + ' · ' + L(op[0], op[1]),
             ok: true, okText: L('Verified','已认证'),
             settings: S.role === 'asset' ? 'P-F04' : 'P-F24' };
  },
  topExtra: function () {
    if (S.scene === 'expired') return '';
    return '<div class="seg" role="group" aria-label="' + L('Demo role','演示身份') + '">'
      + [['asset', g('assetOwner')], ['fund', g('funder')]].map(function (x) {
          return '<button type="button" data-act="mc.role" data-v="' + x[0] + '" aria-pressed="'
            + (S.role === x[0]) + '">' + E(x[1]) + '</button>';
        }).join('') + '</div>';
  },
  crumbParts: function () { return []; },
  prdFoot: function () {
    return '口径以 <b>v1.0-我的控制台-PRD.md V2.0</b> 与分册 01 / 02 为准；'
      + '上游锚点与 available_actions 取值由 WS-324～327 登记，本模块只消费、不新增。'
      + '界面上不出现任何条款与验收编号，本面板是给实现方看的，不属于产品界面。';
  },
  content: function () { return pageConsole(); },
  modals: { leave: modalLeave, voidList: modalVoid },
  hash: {
    build: function () {
      var st = pageState(S.tab), so = sortState(S.tab);
      var qs = ['tab=' + S.tab];
      if (S.scene !== 'default') qs.push('st=' + S.scene);
      if (S.role !== 'asset') qs.push('role=' + S.role);
      var fs = [];
      for (var k in S.filters) if (S.filters[k] && S.filters[k] !== 'all') fs.push(k + ':' + S.filters[k]);
      if (fs.length) qs.push('filter=' + encodeURIComponent(fs.join(',')));
      if (so.by) qs.push('sort=' + so.by + '.' + so.dir);
      if (st.p > 1) qs.push('page=' + st.p);
      if (st.size !== 20) qs.push('size=' + st.size);
      return '#/console?' + qs.join('&');
    },
    read: function () {
      var h = location.hash || ''; if (h.indexOf('#/console') !== 0) return false;
      var qs = {}, parts = h.split('?');
      (parts[1] || '').split('&').forEach(function (kv) {
        if (!kv) return; var i = kv.indexOf('='); qs[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1));
      });
      S.page = 'P-MC-01';
      if (qs.role === 'fund' || qs.role === 'asset') S.role = qs.role;
      S.st = qs.st && SCENES.some(function (x) { return x[0] === qs.st; }) ? qs.st : 'default';
      applyScene(S.st);
      if (qs.tab && tabsFor().some(function (x) { return x[0] === qs.tab; })) S.tab = qs.tab;
      else S.tab = defaultTab();
      if (qs.filter) qs.filter.split(',').forEach(function (kv) {
        var p = kv.split(':'); if (p.length === 2) S.filters[p[0]] = p[1];
      });
      if (qs.sort) { var sp = qs.sort.split('.'); S.sort[S.tab] = { by: sp[0], dir: sp[1] || 'desc' }; }
      if (qs.page) pageState(S.tab).p = parseInt(qs.page, 10) || 1;
      if (qs.size) pageState(S.tab).size = parseInt(qs.size, 10) || 20;
      return true;
    }
  },
  onSetState: function (k) { applyScene(k); },
  afterRender: function () {
    /* 会话失效：菜单不渲染。这不是把菜单藏起来，是页面上不再有它。 */
    if (S.scene === 'expired') {
      var nav = q('#nav'); if (nav) nav.innerHTML = '';
    }
  },
  onAct: function (n, a, v) {
    if (a === 'mc.role') {
      S.role = v; S.tab = defaultTab(); S.open = {}; S.filters = {}; S.pg = {}; S.sort = {};
      if (S.scene === 'l0' && v === 'asset') { S.st = 'default'; applyScene('default'); }
      CF.render(); CF.syncURL(); return true;
    }
    if (a === 'mc.tab') { S.tab = v; S.open = {}; CF.render(); CF.syncURL(); return true; }
    if (a === 'mc.toggle') { S.open[v] = !S.open[v]; CF.render(); return true; }
    if (a === 'mc.page') {
      var p = v.split(':'); pageState(p[0]).p = Math.max(1, parseInt(p[1], 10) || 1);
      CF.render(); CF.syncURL(); return true;
    }
    if (a === 'mc.size') {
      pageState(v).size = parseInt(n.value, 10) || 20; pageState(v).p = 1;
      CF.render(); CF.syncURL(); return true;
    }
    if (a === 'mc.sort') {
      var s = v.split(':'), st = sortState(s[0]);
      if (st.by === s[1]) st.dir = st.dir === 'asc' ? 'desc' : 'asc';
      else { st.by = s[1]; st.dir = 'desc'; }
      CF.render(); CF.syncURL(); return true;
    }
    if (a === 'mc.filter') {
      S.filters[v] = n.value; pageState(S.tab).p = 1; CF.render(); CF.syncURL(); return true;
    }
    if (a === 'mc.reset') {
      S.filters = {}; S.strip = null; pageState(v).p = 1; CF.render(); CF.syncURL(); return true;
    }
    if (a === 'mc.clearStrip') {
      S.strip = null; S.filters = {}; pageState(S.tab).p = 1; CF.render(); CF.syncURL(); return true;
    }
    if (a === 'mc.retry') {
      S.blocks[v] = 'ready';
      toast('success', L('Reloaded','已重新取数'),
        L('Only this block was re-fetched.','只重取了这一块，其余内容未受影响。'));
      CF.render(); return true;
    }
    if (a === 'mc.leave') { S.modal = { type:'leave', to:v }; CF.render(); return true; }
    if (a === 'mc.leaveGo') {
      S.modal = null;
      toast('info', L('Cross-site destination','跨站落地页'),
        L('The asset platform is a separate prototype; this demo stops at the notice.',
          '资产平台是另一套原型，本演示到离站告知为止。'));
      CF.render(); return true;
    }
    if (a === 'mc.voidList') { S.modal = { type:'voidList', pid:v }; CF.render(); return true; }
    if (a === 'mc.signin') {
      toast('info', L('Sign-in is delivered by another module','登录由其他模块交付'),
        L('Signing in lands you back on this page with the same view state.',
          '登录后按原路返回本页，视图状态保持不变。'));
      return true;
    }
    if (a === 'mc.copy') {
      if (navigator.clipboard) navigator.clipboard.writeText(v);
      toast('success', L('Copied','已复制'), v);
      return true;
    }
    if (a === 'mc.noop') { return true; }
    return false;
  }
};

/* 下拉与文本框的 change/input 走这里，与其余四个模块同一写法 */
function fieldNode(e) {
  var n = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
  if (!n) return null;
  var a = n.getAttribute('data-act') || '';
  if (a.indexOf('mc.') !== 0) return null;
  var t = n.tagName, ty = (n.type || '').toLowerCase();
  if (t === 'SELECT') return n;
  if (t === 'INPUT' && ty !== 'checkbox' && ty !== 'radio') return n;
  return null;
}
document.addEventListener('input', function (e) {
  var n = fieldNode(e); if (!n) return;
  mod.onAct(n, n.getAttribute('data-act'), n.getAttribute('data-v'), e);
});

CF.define(mod);
CF.boot();

})();
