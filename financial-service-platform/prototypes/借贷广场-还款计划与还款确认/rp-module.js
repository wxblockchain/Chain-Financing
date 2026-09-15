/* ==========================================================================
   rp-module.js — 借贷广场 · 还款计划与还款确认（WS-327）· v2.0
   PRD 基线：financial-service-platform/prd/v1.0-借贷广场-还款计划与还款确认/
             主册 V3.2 + 分册 V3.2（已入库 cly-V1.0.0 · 0b36462）
   上游：WS-324 V9.1 / WS-325 V7.1 / WS-326 V3.2；承载与英文基线继承 WS-326 原型 v2.0（7ca5cdb）

   v2.0 的五处变化（v1.0 → v2.0，逐条对应 PRD V3.0～V3.2）：
     ① 承载：P-LS-09 / P-LS-10 / 还款计划查看三者由**整页**改为详情页操作区第③段内的
        **右侧抽屉 760px**；两处二次确认走**居中弹窗 560px**；⊘ 原因与状态提示内联 / Toast、
        不开层；**同一时刻只有一层**（D-RP-71 / D-RP-72 / D-RP-76）
     ② 打款目标改锚 WS-326 放款时登记的 LN-15（法币，含中转行）/ LN-16（数币，绑定钱包），
        原锚点 QT-07 / QT-08 已于 09-15 作废（D-FIN-24 红线本身一个字没松）
     ③ 链降为常量 ETH：只展示、不录入、界面不给任何选择控件；E-RP-05 按本期不可达登记（RM-09）
     ④ 还款类型引用 WS-325 QT-15「按季付息；到期还本付息」，并补最终还款日 QT-16
     ⑤ 界面默认英文、中文可切换；旧词根改为「质押覆盖」（WS-324 D-LS-17）

   本文件只写本模块的承载单元、文案、演示数据与状态。
   token / 公共组件 / 运行时 / 页面登记一律来自 _shared，不在此重建。
   ========================================================================== */
(function () {
"use strict";

var CF = window.CF, E = CF.esc, q = CF.q, L = CF.L, toast = CF.toast;
var S = null;

/* ================================================================
   Part A —— 术语表、口径常量与演示数据
   术语取 WS-324 v1.3 的 G 表 + WS-326 v2.0 已产出的词，**不自造英文**（跨模块项第 ⑥ 条）。
   全部业务数据为演示数据：企业名带「（演示）」后缀，编号 / 金额 / 账号 / 哈希均为虚构。
   ================================================================ */
var G = {
  /* —— 承接 WS-324 v1.3 / WS-326 v2.0，一字不改 —— */
  assetOwner   :['Asset owner','资产方'],
  funder       :['Funder','资金方'],
  demandNo     :['Demand ID','需求编号'],
  dealNo       :['Deal ID','融资业务编号'],
  project      :['Financing project','融资项目'],
  coverage     :['Pledge coverage status','质押覆盖状态'],
  covSufficient:['Ample','覆盖有余'],
  outstanding  :['Outstanding financing','项目融资余额'],
  creditUsed   :['Credit in use','授信占用额'],
  signIn       :['Sign in','立即登录'],
  stDemand     :['Financing demand','融资需求'],
  stQuote      :['Quote','融资报价'],
  stConfirm    :['Quote confirmation','报价确认'],
  stDisburse   :['Disbursement','融资放款'],
  disbConfirm  :['Disbursement confirmation','放款确认'],
  /* —— 本模块的词（EN 以本轮产出为准，PRD 分册第 8 章回填）—— */
  stRepay      :['Repayment','还款流程'],
  repaySchedule:['Repayment schedule','还款计划'],
  planNoLbl    :['Schedule ID','还款计划编号'],
  recordRepay  :['Record a repayment','立即还款'],
  confirmRepay :['Confirm repayment received','确认收到还款'],
  viewSchedule :['View repayment schedule','查看还款计划'],
  repayWindow  :['Repayment confirmation window','还款确认时限'],
  instalment   :['Instalment','期次'],
  dueDate      :['Due date','应还日'],
  accrualSpan  :['Accrual period','计息区间'],
  duePrincipal :['Principal due','应还本金'],
  dueInterest  :['Interest due','应还利息'],
  dueTotal     :['Total due','应还合计'],
  settleAmount :['Settlement amount','结算金额'],
  overdueMark  :['Overdue','逾期'],
  repayType    :['Repayment type','还款类型'],
  repayNature  :['Repayment nature','还款性质'],
  finalDueDate :['Final repayment date','最终还款日'],
  accrualStart :['Interest start date','起息日'],
  payeeAcct    :['Repayment payee account','还款收款账户'],
  proofFiat    :['Bank payment proof','银行支付凭证'],
  txHash       :['Transaction hash','交易哈希'],
  chainLbl     :['Chain','链'],
  repaidAt     :['Repayment time','还款时间'],
  submittedAt  :['Submitted at','提交时间'],
  supportMail  :['Support mailbox','客服邮箱']
};
function g(k){ var v = G[k]; return v ? L(v[0], v[1]) : k; }

/* ---- 口径常量（分册 7.4）---- */
var CCY           = 'USD';  /* 记账本位币（D-FIN-13）。跨币种不得求和（D-RP-40） */
var PERIOD_M      = 3;      /* 期间长度：常量 3 个自然月，不可配置（D-RP-15） */
var BASIS         = 360;    /* 计息基数：ACT/360（D-RP-18）。Q-FIN-17 已于 09-15 按本值定稿 */
var OPEN_DAYS     = 3;      /* 还款入口开窗提前量（D-RP-26）。Q-RP-03 已于 09-15 按本值定稿 */
var GRACE_DAYS    = 0;      /* 宽限期：不设（D-RP-34）。Q-FIN-29 已于 09-15 按本值定稿 */
var CONFIRM_HOURS = 168;    /* 还款确认时限：168 小时，不可配置、不可延长（D-RP-52） */
var NEAR_HOURS    = 24;     /* 临近提醒：提前 24 小时，只发一档 */
var MEMO_MAX      = 200;    /* RM-11 还款备注 ≤ 200 字 */
var FILE_MAX_MB   = 10;     /* 与放款侧 LN-07 完全一致，不另定一套 */
var FIAT_MIN_N = 1, FIAT_MAX_N = 5, EXTRA_MAX_N = 5;
/* RP-12 还款类型：**不在本模块定义**，只读引用 WS-325 QT-15 的唯一取值（D-CR-51 / D-RP-49）。
   枚举位由上游保留供后续扩展，本期不为其他取值预留分支逻辑。 */
var QT15 = ['Quarterly interest; principal and final interest at maturity','按季付息；到期还本付息'];
/* RM-09 链：**本期系统常量 ETH**，只展示、不录入、界面不给任何选择控件（D-LN-60 / D-LN-61）。
   USDT / USDC 即 ERC-20。多链恢复时才回到"必须等于收款地址的链、不一致拒绝"（E-RP-05，本期不可达）。 */
var CHAIN    = 'ETH';
var EXPLORER = { name:'Etherscan', base:'https://etherscan.io/tx/' };

var NOW  = '2026-12-18 10:40';   /* 演示"当前时刻"（服务端时间），见 README §6 第 5 条 */
var TZ   = 'UTC+8';
var MAIL = '{platform-support-mailbox}';   /* Q-LN-01 占位常量，与 WS-326 共用、本模块不另设 */

/* ---- 演示主体：EN / ZH 成对，避免英文视图里漏中文 ---- */
var CO = {
  asset  :['Shengyuan Technology (demo)','晟远科技（演示）'],
  fund   :['Beian Leasing (demo)','北岸融资租赁（演示）'],
  fund2  :['Huanhai Commercial Factoring (demo)','环海商业保理（演示）'],
  other  :['Mingtai Appliance (demo)','明泰家电（演示）'],
  opAsset:['Shengyuan Technology (demo) · Zhou Min','晟远科技（演示）· 周敏'],
  opFund :['Beian Leasing (demo) · Chen Li','北岸融资租赁（演示）· 陈立']
};
function co(k){ return L(CO[k][0], CO[k][1]); }

/* ---- 融资业务状态：展示名一律用新名「放款确认」，旧展示名全链路作废（D-RP-65）---- */
var FD_ST = { 'S-FD-6':[['Repaying','还款中'],'good'], 'S-FD-8':[['Settled','已结清'],'mute'] };
/* 融资需求对外状态：五值引用 WS-324 D-LS-18。**本模块一次跃迁都不驱动**（D-RP-64）：
   结清不转出、逾期不转出、也不做成对外状态的修饰，不新增第六个取值。 */
var DEMAND_ST = [['Disbursed','已放款'],'green'];
var RP_ST = {
  'S-RP-1':[['Due','待还款'],'info'],
  'S-RP-2':[['Awaiting repayment confirmation','待还款确认'],'warn'],
  'S-RP-3':[['Settled','已结清'],'good']
};
/* S-RP-4 还款异议处理中：本期不可达（X-LS-42 / D-RP-02）。枚举保留，
   但界面**不为它准备文案与筛选项**，避免出现一个永远为空的 tab。 */
var TONE = { mute:'gray', info:'', good:'green', warn:'amber', crit:'red' };

/* ---- 还款收款账户（WS-326 放款时登记，D-FIN-24 红线）----
   法币 LN-15：户名 / 账号 / SWIFT / 开户行 / **中转行** 五项整组必填
               ——比资产方侧 FD-05 多中转行，两侧规格**有意不同**，不得为"对齐"删减。
   数币 LN-16：资金方**绑定钱包地址**，只读、无录入控件（WS-315 D-F43 绑定后不可改）。
   两者**放款提交后本期不可改**（X-LS-39），因此本模块把打款目标当**常量**消费——
   不需要"改账户后同步未结清还款计划"这条路径。 */
var PAYEE_FIAT = {
  name:'Beian Leasing (Demo) Co., Ltd.', acct:'USD88-2201-6734-0192',
  swift:'COMMCNSHSDB', bank:'Bank of Communications, Shanghai Pudong Branch',
  corr:'JPMorgan Chase Bank N.A., New York · CHASUS33'   /* 中转行 correspondent bank */
};
var PAYEE_COIN = { addr:'0x4F82Ac19Bb63d7E015aC8b1f2740e93Cc81De206' };

/* ================================================================
   演示业务
   t0    ＝ FD-45 起息日 ＝ LN-06 放款记录提交时间的**日期部分**（D-RP-11）。
           不取 LN-05（提交方填写、可填任意过去日期），也不取 FD-35 放款确认时间
           （资产方点确认的时刻，用它等于让他靠拖延确认少付利息）。
   fd46  ＝ 最终还款日，**恒等于 WS-325 QT-16，而 QT-16 恒等于项目 FP-09 有效期至**。
           V3.0 起改为**跟随、不做定稿快照**（D-RP-12 / D-CR-53）。
   fp    ＝ FP-28 需求编号。第③段按它切换（D-RP-66 / D-RP-74）。
   paid  ＝ 该业务已产生的还款记录（RM-*），按期次序号索引；confirmAt 为空即 S-RP-2。
   ================================================================ */
var DEALS = [
  /* ① 常规待还：法币，第 1 期应还日 2026-12-20，已开窗（12-17 起）、未逾期 */
  { id:'FD-20260908-0061', fp:'FP-20260812-0031-03', pid:'FP-20260812-0031',
    pname:['East China electronic components pool','华东电子元件应收账款池'],
    amt:500000, rate:7.20, ccy:'USD', st:'S-FD-6', matured:false, planReady:true,
    quotedAt:'2026-09-08 14:20', ln06:'2026-09-20 10:12', t0:'2026-09-20',
    fd35:'2026-09-22 09:30', fd46:'2027-08-14',
    fx:{ v:1.0000, at:'2026-09-08 14:20', ver:'FX-20260908-T1420' },
    pool:{ bal:500000 }, cr:{ used:850000 }, paid:{} },

  /* ② 同日两笔的排序演示（D-RP-22 ②）：与 ① 同日应还，但放款记录提交时间晚（15:40 vs 10:12）
        → 排在 ① 之后、默认不选中。同一项目下的**另一轮需求**，第③段按 FP-28 可切过去。 */
  { id:'FD-20260918-0067', fp:'FP-20260812-0031-04', pid:'FP-20260812-0031', funder:'fund2',
    pname:['East China electronic components pool','华东电子元件应收账款池'],
    amt:350000, rate:7.95, ccy:'USD', st:'S-FD-6', matured:false, planReady:true,
    quotedAt:'2026-09-18 09:05', ln06:'2026-09-20 15:40', t0:'2026-09-20',
    fd35:'2026-09-23 11:05', fd46:'2027-08-14',
    fx:{ v:1.0000, at:'2026-09-18 09:05', ver:'FX-20260918-T0905' },
    pool:{ bal:350000 }, cr:{ used:850000 }, paid:{} },

  /* ③ 逾期：第 1 期应还日 2026-11-22 未提交 → 次日 00:00 起打标记，至 NOW 逾期 26 天。
        入口**保持开启**——关掉就等于不让人还钱（D-RP-35）。 */
  { id:'FD-20260820-0046', fp:'FP-20260416-0007-02', pid:'FP-20260416-0007',
    pname:['Yangtze Delta medical devices pool','长三角医疗器械应收账款池'],
    amt:500000, rate:6.80, ccy:'USD', st:'S-FD-6', matured:false, planReady:true,
    quotedAt:'2026-08-20 09:30', ln06:'2026-08-22 14:26', t0:'2026-08-22',
    fd35:'2026-08-24 10:12', fd46:'2027-04-20',
    fx:{ v:1.0000, at:'2026-08-20 09:30', ver:'FX-20260820-T0930' },
    pool:{ bal:500000 }, cr:{ used:850000 }, paid:{} },

  /* ④ 数币分支：USDT / ERC-20（链为常量 ETH）。第 1 期应还日恰为 NOW 当日——
        当天提交**不算逾期**，逾期判定在应还日次日 00:00（D-RP-34）。 */
  { id:'FD-20260901-0053', fp:'FP-20260710-0024-01', pid:'FP-20260710-0024', ws324:false,
    pname:['Central China pharma distribution pool','华中医药流通应收账款池'],
    amt:250000, rate:8.90, ccy:'USDT', st:'S-FD-6', matured:false, planReady:true,
    quotedAt:'2026-09-01 09:05', ln06:'2026-09-18 20:18', t0:'2026-09-18',
    fd35:'2026-09-20 10:00', fd46:'2027-07-10',
    fx:{ v:0.9994, at:'2026-09-01 09:05', ver:'FX-20260901-T0905' },
    pool:{ bal:250000 }, cr:{ used:850000 }, paid:{} },

  /* ⑤ D-FIN-11 的样板：第 1 期应还日 2026-12-10，逾期 5 天后于 12-15 提交。
        逾期天数**冻结在 5**，机构再拖多久都不变（D-RP-30 ①）。剩余确认时限 3 天余。 */
  { id:'FD-20260904-0062', fp:'FP-20260416-0007-03', pid:'FP-20260416-0007',
    pname:['Yangtze Delta medical devices pool','长三角医疗器械应收账款池'],
    amt:200000, rate:7.40, ccy:'USD', st:'S-FD-6', matured:false, planReady:true,
    quotedAt:'2026-09-04 10:05', ln06:'2026-09-10 16:20', t0:'2026-09-10',
    fd35:'2026-09-12 09:00', fd46:'2027-04-20',
    fx:{ v:1.0000, at:'2026-09-04 10:05', ver:'FX-20260904-T1005' },
    pool:{ bal:200000 }, cr:{ used:850000 },
    paid:{ 1:{ id:'RM20261215000001', at:'2026-12-15 09:26', given:'2026-12-15 09:05',
               files:[['Bank payment proof · instalment 1.pdf','银行支付凭证-第1期.pdf','0.8 MB']],
               memo:['Wired on 15 Dec via our Shanghai branch; remitting and cable charges are on us. ' +
                     'Five-day delay on our side, apologies.',
                     '12 月 15 日上午由上海分行汇出，汇出行手续费与电报费由我方承担；' +
                     '此前因财务复核延误 5 天，抱歉。'],
               confirmAt:null } } },

  /* ⑥ 不足 24 小时：正常还款（应还日当日提交，不带逾期标记） */
  { id:'FD-20260902-0054', fp:'FP-20260624-0021-01', pid:'FP-20260624-0021',
    pname:['North China instrumentation pool','华北仪器仪表应收账款池'],
    amt:300000, rate:8.35, ccy:'USD', st:'S-FD-6', matured:false, planReady:true,
    quotedAt:'2026-09-02 08:20', ln06:'2026-09-12 02:10', t0:'2026-09-12',
    fd35:'2026-09-14 10:00', fd46:'2027-06-24',
    fx:{ v:1.0000, at:'2026-09-02 08:20', ver:'FX-20260902-T0820' },
    pool:{ bal:300000 }, cr:{ used:850000 },
    paid:{ 1:{ id:'RM20261212000001', at:'2026-12-12 00:15', given:'2026-12-11 16:30',
               files:[['Bank payment proof · instalment 1.pdf','银行支付凭证-第1期.pdf','0.6 MB']],
               memo:['',''], confirmAt:null } } },

  /* ⑦ 数币确认：哈希 + 区块浏览器，常驻「平台未核验」。
        资产方是明泰家电——**不在本方候选集合里**，顺带验跨主体隔离（D-FIN-25）。 */
  { id:'FD-20260907-0060', fp:'FP-20260712-0026-01', pid:'FP-20260712-0026', ws324:false,
    party:'other',
    pname:['South China consumer electronics pool','华南消费电子应收账款池'],
    amt:450000, rate:8.10, ccy:'USDT', st:'S-FD-6', matured:false, planReady:true,
    quotedAt:'2026-09-07 11:05', ln06:'2026-09-14 11:30', t0:'2026-09-14',
    fd35:'2026-09-16 09:20', fd46:'2027-07-12',
    fx:{ v:0.9994, at:'2026-09-07 11:05', ver:'FX-20260907-T1105' },
    pool:{ bal:450000 }, cr:{ used:450000 },
    paid:{ 1:{ id:'RM20261216000002', at:'2026-12-16 18:40', given:'2026-12-16 18:22',
               hash:'0x3b8f14ce7a2d05916be4c8037fd15a2e6c9704b1d83fa2570ce6148b39d0aa72',
               files:[], extra:[['Wallet transfer screenshot.png','钱包转账截图.png','0.4 MB']],
               memo:['The on-chain fee was paid by us and is unrelated to the amount due.',
                     '链上手续费由我方承担，与本期应还金额无关。'],
               confirmAt:null } } },

  /* ⑧ 确认已超期：逾期 5 天后提交，机构 8 天不确认。期次状态不变、额度不动、权限不变，
        **逾期天数仍然冻结在 5**（AC-RP-09）。 */
  { id:'FD-20260826-0050', fp:'FP-20260518-0015-01', pid:'FP-20260518-0015', ws324:false,
    pname:['Northwest mining equipment pool','西北矿业设备应收账款池'],
    amt:200000, rate:7.90, ccy:'USD', st:'S-FD-6', matured:false, planReady:true,
    quotedAt:'2026-08-26 11:00', ln06:'2026-08-28 09:00', t0:'2026-08-28',
    fd35:'2026-08-30 10:00', fd46:'2027-05-18',
    fx:{ v:1.0000, at:'2026-08-26 11:00', ver:'FX-20260826-T1100' },
    pool:{ bal:200000 }, cr:{ used:850000 },
    paid:{ 1:{ id:'RM20261203000001', at:'2026-12-03 09:10', given:'2026-12-02 17:40',
               files:[['Bank payment proof · instalment 1.pdf','银行支付凭证-第1期.pdf','0.9 MB']],
               memo:['Wired on the afternoon of 2 Dec, please check.','12 月 2 日下午已汇出，请查收。'],
               confirmAt:null } } },

  /* ⑨ 末期（含本金）待确认：项目已到期、业务照常履约——**这是常态路径**（D-FIN-47）。
        还本本来就发生在融资项目到期之后（X-LS-06），因此中性呈现、不做告警。 */
  { id:'FD-20260315-0018', fp:'FP-20251215-0088-01', pid:'FP-20251215-0088', ws324:false,
    pname:['East China auto parts pool','华东汽车零部件应收账款池'],
    amt:300000, rate:7.50, ccy:'USD', st:'S-FD-6', matured:true, planReady:true,
    quotedAt:'2026-03-12 10:40', ln06:'2026-03-16 10:20', t0:'2026-03-16',
    fd35:'2026-03-18 09:40', fd46:'2026-12-15',
    fx:{ v:1.0000, at:'2026-03-12 10:40', ver:'FX-20260312-T1040' },
    pool:{ bal:300000 }, cr:{ used:850000 },
    paid:{ 1:{ id:'RM20260616000001', at:'2026-06-16 10:02', given:'2026-06-16 09:30',
               files:[['Bank payment proof · instalment 1.pdf','银行支付凭证-第1期.pdf','0.7 MB']],
               memo:['',''], confirmAt:'2026-06-18 14:30' },
           2:{ id:'RM20261216000001', at:'2026-12-16 09:40', given:'2026-12-15 17:10',
               files:[['Bank payment proof · final instalment.pdf','银行支付凭证-末期本息.pdf','1.1 MB']],
               memo:['Principal and final interest wired together via China Merchants Bank, Shanghai.',
                     '末期本金与利息一并汇出，汇出行为招商银行上海分行。'],
               confirmAt:null } } },

  /* ⑩ 已结清（S-FD-8 终态）：三期全部 S-RP-3，两个量该笔归零，FD-47 落库。
        质押**不由本模块释放**——本模块只把「该笔业务已结清」交给 WS-324（D-RP-39）。 */
  { id:'FD-20251120-0009', fp:'FP-20251103-0021-01', pid:'FP-20251103-0021', ws324:false,
    pname:['North China precision casting pool','北方精密铸造应收账款池'],
    amt:200000, rate:6.50, ccy:'USD', st:'S-FD-8', matured:true, planReady:true,
    quotedAt:'2025-11-17 09:50', ln06:'2025-11-20 11:15', t0:'2025-11-20',
    fd35:'2025-11-22 10:00', fd46:'2026-11-03', fd47:'2026-11-10 14:22',
    fx:{ v:1.0000, at:'2025-11-17 09:50', ver:'FX-20251117-T0950' },
    pool:{ bal:0 }, cr:{ used:850000 },
    paid:{ 1:{ id:'RM20260220000001', at:'2026-02-20 10:30', given:'2026-02-20 09:40',
               files:[['Bank payment proof · instalment 1.pdf','银行支付凭证-第1期.pdf','0.6 MB']],
               memo:['',''], confirmAt:'2026-02-23 09:12' },
           2:{ id:'RM20260520000001', at:'2026-05-20 11:05', given:'2026-05-19 16:20',
               files:[['Bank payment proof · instalment 2.pdf','银行支付凭证-第2期.pdf','0.6 MB']],
               memo:['',''], confirmAt:'2026-05-22 10:40' },
           3:{ id:'RM20261103000001', at:'2026-11-03 15:48', given:'2026-11-03 14:10',
               files:[['Bank payment proof · final instalment.pdf','银行支付凭证-末期本息.pdf','1.0 MB']],
               memo:['Principal and final interest wired together.','末期本金与利息一并汇出。'],
               confirmAt:'2026-11-10 14:22' } } },

  /* ⑪ 还款计划生成中（E-RP-01 / 承接 WS-326 E-LN-13）：放款确认已完成、四个量已转移，
        计划生成失败或尚未就绪。**不展示错误**，也不回滚上游（D-RP-10）。 */
  { id:'FD-20260910-0065', fp:'FP-20261105-0061-01', pid:'FP-20261105-0061', ws324:false,
    pname:['East China precision mould pool','华东精密模具应收账款池'],
    amt:400000, rate:7.80, ccy:'USD', st:'S-FD-6', matured:false, planReady:false,
    quotedAt:'2026-12-10 09:30', ln06:'2026-12-16 14:05', t0:'2026-12-16',
    fd35:'2026-12-18 09:55', fd46:'2027-11-05',
    fx:{ v:1.0000, at:'2026-12-10 09:30', ver:'FX-20261210-T0930' },
    pool:{ bal:400000 }, cr:{ used:850000 }, paid:{} },

  /* ⑫ 报价期：只有**初始计划（试算版）**，不落号、不产生期次对象（D-RP-05）。
        基准日 ＝ QT-09 报价提交日（D-RP-04）。 */
  { id:'FD-20261215-0071', fp:'FP-20260812-0031-05', pid:'FP-20260812-0031',
    pname:['East China electronic components pool','华东电子元件应收账款池'],
    amt:600000, rate:8.40, ccy:'USD', st:'S-FD-2', matured:false, planReady:false, quoting:true,
    quotedAt:'2026-12-15 14:20', ln06:null, t0:null, fd35:null, fd46:'2027-08-14',
    fx:{ v:1.0000, at:'2026-12-15 14:20', ver:'FX-20261215-T1420' },
    pool:{ bal:0 }, cr:{ used:850000 }, paid:{} }
];

/* ================================================================
   Part B —— 格式化、日期与还款计划的生成
   ================================================================ */
function pad2(n){ return (n < 10 ? '0' : '') + n; }
function amt(n){
  var s = (Math.round(n * 100) / 100).toFixed(2).split('.');
  return s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + s[1];
}
function usd(n){ return amt(n) + ' ' + CCY; }
function round2(n){ return Math.round(n * 100) / 100; }
function withTz(s){ return s ? s + ' ' + TZ : '—'; }
function dayOnly(s){ return String(s || '').slice(0, 10); }
function dMs(s){ var p = dayOnly(s).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
function dStr(ms){ var x = new Date(ms);
  return x.getUTCFullYear() + '-' + pad2(x.getUTCMonth() + 1) + '-' + pad2(x.getUTCDate()); }
/* 加 n 个自然月，**遇当月无同日则取当月最后一日**（D-RP-13 ①） */
function addMonths(s, n){
  var p = dayOnly(s).split('-'), y = +p[0], m = +p[1] - 1, d = +p[2], t = m + n;
  var ny = y + Math.floor(t / 12), nm = ((t % 12) + 12) % 12;
  var last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return dStr(Date.UTC(ny, nm, Math.min(d, last)));
}
function addDays(s, n){ return dStr(dMs(s) + n * 86400000); }
function dayDiff(a, b){ return Math.round((dMs(b) - dMs(a)) / 86400000); }
function tmin(s){
  if(!s) return 0;
  var p = String(s).split(' '), d = p[0].split('-'), t = (p[1] || '00:00').split(':');
  return Math.round(Date.UTC(+d[0], +d[1] - 1, +d[2], +t[0], +t[1]) / 60000);
}
function tstr(mins){
  var x = new Date(mins * 60000);
  return x.getUTCFullYear() + '-' + pad2(x.getUTCMonth() + 1) + '-' + pad2(x.getUTCDate()) + ' ' +
         pad2(x.getUTCHours()) + ':' + pad2(x.getUTCMinutes());
}
function fmtDur(mins){
  if(mins <= 0) return L('0 minutes','0 分钟');
  var d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  if(d > 0) return L(d + 'd ' + h + 'h', d + ' 天 ' + h + ' 小时');
  return L(h + 'h ' + pad2(m) + 'm', h + ' 小时 ' + pad2(m) + ' 分钟');
}
function txt(pair){ return pair ? L(pair[0], pair[1]) : ''; }
function maskAcct(s){ s = String(s || ''); return s.length <= 8 ? s : s.slice(0, 4) + '••••••' + s.slice(-4); }
function maskAddr(s){ s = String(s || ''); return s.length <= 16 ? s : s.slice(0, 10) + '…' + s.slice(-6); }
function shortHash(h){ h = String(h || ''); return h.length <= 24 ? h : h.slice(0, 12) + '…' + h.slice(-10); }
function pill(tone, t){ return '<span class="pill ' + tone + '">' + E(t) + '</span>'; }

/* ================================================================
   还款计划的生成（5.3 期次边界 + 5.4 计息口径）
   一处产生、多处消费：两版计划、还款抽屉、确认抽屉、第③段读的都是这一个函数的结果。
   期次边界（D-RP-13）：① 自 T0 起每 3 个自然月取一个付息日（同日取，遇当月无同日取当月最后一日）；
   ② 凡严格早于最终还款日的付息日各成一期利息期，本金为 0；③ 末期应还日恒为最终还款日，
   还该期利息 + 全部本金；④ 计息区间＝上一边界日 → 本期应还日，**算头不算尾**；⑤ 期数 N ≥ 1。
   末期并期（D-RP-14，Q-RP-02 已于 09-15 按本值定稿）：最后一个付息日与最终还款日之间不足 3 个月时，
   该段**并入末期**——那个付息日不单独成期，末期区间因此可能长于 3 个月但不超过 6 个月。
   ⚠️ PRD 5.3 的样例（起息 2026-09-15、最终还款日 2027-03-20 → **2 期**：12-15 付息、
   03-20 付息并还本）正是按这条并期规则得到的，本函数逐字照它实现，可用该样例反查。
   ================================================================ */
function buildPlan(t0, tn, principal, ratePct, fxV){
  var marks = [], k = 1, nx;
  while(true){
    nx = addMonths(t0, PERIOD_M * k);
    if(dMs(nx) < dMs(tn)){ marks.push(nx); k++; } else break;
  }
  if(marks.length && dMs(addMonths(marks[marks.length - 1], PERIOD_M)) > dMs(tn)) marks.pop();
  var bounds = [t0].concat(marks, [tn]), out = [];
  for(var i = 1; i < bounds.length; i++){
    var from = bounds[i - 1], due = bounds[i], n = dayDiff(from, due), last = (i === bounds.length - 1);
    /* RP-07 ＝ QT-03 × QT-06 年化利率 × 本期计息天数 ÷ 360，2 位小数四舍五入 */
    var interest = round2(principal * (ratePct / 100) * n / BASIS);
    var pri = last ? principal : 0, total = round2(pri + interest);
    out.push({ seq:i, from:from, due:due, days:n, principal:pri, interest:interest, total:total,
               /* RP-09 ＝ RP-08 ÷ QT-04 汇率快照，**还款时不得重新取汇率**（D-FIN-80） */
               settle:round2(total / fxV), last:last,
               /* RP-15 还款入口开启时间（服务端下发绝对时刻，前端不自行推算，AC-LS-133） */
               openAt:addDays(due, -OPEN_DAYS) });
  }
  return out;
}
function finalPlan(d){
  if(!d || !d.planReady || !d.t0) return [];
  return buildPlan(d.t0, d.fd46, d.amt, d.rate, d.fx.v);
}
/* ⚠️ 初始计划（试算版）**已不在本模块**：V3.4 起它只在报价环节呈现
   （报价详情页与 P-LS-06 接受抽屉，见 WS-325 原型里的 initialPlanCard）。
   业务规则未变——报价期仍要拟定、放款确认后仍按实际放款日重算定稿并锁死（D-RP-80）。 */

/* RP-01 还款计划编号：定稿时刻按期生成，一期一个（初始计划不占号）。 */
function planNo(d, p){
  if(!d || !d.planReady || !p) return '—';
  var n = String(p.seq); while(n.length < 6) n = '0' + n;
  return 'RP' + dayOnly(d.fd35).replace(/-/g, '') + n;
}

/* ---- 期次的派生状态：RP-10 状态 + RP-11 逾期标记与逾期天数 ---- */
function pState(d, p){
  var rec = (d.paid || {})[p.seq] || null;
  var st = !rec ? 'S-RP-1' : (rec.confirmAt ? 'S-RP-3' : 'S-RP-2');
  /* D-RP-34：应还日次日 00:00 起未提交即打逾期标记、每日 +1，不设宽限期。
     D-FIN-11 / D-RP-58：**提交还款记录即冻结**——此后机构再拖多久都不变。 */
  var end = rec ? dayOnly(rec.at) : dayOnly(NOW);
  var od = Math.max(0, dayDiff(p.due, end) - GRACE_DAYS);
  return { seq:p.seq, st:st, rec:rec, overdue:od > 0, odDays:od, frozen:!!rec,
           frozenAt:rec ? rec.at : null,
           opened:dMs(NOW) >= dMs(p.openAt),
           limitAt:rec ? tstr(tmin(rec.at) + CONFIRM_HOURS * 60) : null,
           /* RP-13 还款性质（V3.0 更名。⚠️ 不得称「还款类型」——该词已由 QT-15 占用，AC-RP-27） */
           nature:od > 0 ? L('Late repayment','逾期还款') : L('On-time repayment','正常还款') };
}
function clock(d, p){
  var s = pState(d, p);
  if(!s.rec) return { has:false };
  var toM = tmin(s.limitAt), nowM = tmin(NOW), left = toM - nowM;
  return { has:true, to:s.limitAt, leftMin:Math.max(0, left),
           soon:left > 0 && left <= NEAR_HOURS * 60,
           over:left <= 0 && !s.rec.confirmAt,
           overDays:Math.max(0, dayDiff(dayOnly(s.limitAt), dayOnly(NOW))),
           elapsedMin:Math.min(CONFIRM_HOURS * 60, Math.max(0, nowM - tmin(s.rec.at))) };
}
function progress(d){
  var plan = finalPlan(d), done = 0, paidPri = 0, paidInt = 0, od = null, next = null, aw = null;
  plan.forEach(function(p){
    var s = pState(d, p);
    if(s.st === 'S-RP-3'){ done++; paidPri += p.principal; paidInt += p.interest; }
    if(s.st === 'S-RP-2' && !aw) aw = p;
    if(s.st === 'S-RP-1' && s.overdue && (!od || s.odDays > od.days))
      od = { seq:p.seq, days:s.odDays, due:p.due };
    if(s.st === 'S-RP-1' && !next) next = p;
  });
  return { plan:plan, n:plan.length, done:done, paidPri:round2(paidPri), paidInt:round2(paidInt),
           unpaidPri:round2(d.amt - paidPri), overdue:od, next:next, await2:aw,
           settled:d.st === 'S-FD-8' };
}
/* 出资机构名称（QT-10）。同一项目下的多笔业务可能来自不同机构——
   计划视图的标题区必须带它，否则多笔之间分不清这份计划是欠谁的（D-RP-81 ①）。 */
function funderOf(d){ return co(d.funder || 'fund'); }
/* LN-01 放款记录编号。本期 FP-28 → FD-01 → LN-01 恒为 1:1:1（D-RP-78），
   因此它由该笔业务的 LN-06 日期派生，不新造第三个编号（承接 D-LN-49）。 */
function lnNo(d){
  if(!d || !d.ln06) return '—';
  /* 编号规则：前缀 + 服务端日期 + **当日 6 位序号**。同一天可能有多笔放款
     （演示数据里 FP-20260812-0031 下的两笔就同为 2026-09-20），
     因此序号不能写死成 000001——那会让两笔撞号、按编号检索也就失去意义。
     这里用业务编号末四位派生一个稳定的当日序号，保证同日两笔不同号。 */
  var seq = String(d.id).slice(-4);
  return 'LN' + dayOnly(d.ln06).replace(/-/g, '') + '00' + seq;
}
function findDeal(id){ for(var i = 0; i < DEALS.length; i++) if(DEALS[i].id === id) return DEALS[i]; return null; }
function isFiat(d){ return d.ccy === CCY; }
function hashOk(v){ return /^0x[0-9a-fA-F]{64}$/.test(String(v || '').trim()); }

/* ================================================================
   「最近一笔应还」的候选集合与排序（5.5，D-RP-21 ～ D-RP-24）
   候选 ＝ 当前登录资产方企业主体名下、所有处于 S-RP-1 的期次，**跨融资业务、跨融资项目**。
   排序键按序比较：① 应还日升序 → ② 该期次所属业务的实际放款日（LN-06）升序
                 → ③ 融资业务编号升序 → ④ 期次序号升序。默认选中 ＝ 排序后第一条。
   ⚠️ 反例（必须挡住）：按"距今最近"取绝对值会把明天到期的排在逾期 30 天的前面。
   ⚠️ 这与第③段按 FP-28 的切换**不是同一个**（D-RP-74）：那里选"哪一轮需求"，这里选"哪一期"。
   ================================================================ */
function candidates(){
  var out = [];
  DEALS.forEach(function(d){
    if(d.party === 'other' || d.st !== 'S-FD-6' || !d.planReady) return;
    finalPlan(d).forEach(function(p){
      var s = pState(d, p);
      if(s.st !== 'S-RP-1') return;   /* S-RP-2 / S-RP-3 没有可执行的还款动作 */
      out.push({ d:d, p:p, s:s });
    });
  });
  out.sort(function(a, b){
    if(a.p.due !== b.p.due) return a.p.due < b.p.due ? -1 : 1;
    if(a.d.ln06 !== b.d.ln06) return a.d.ln06 < b.d.ln06 ? -1 : 1;
    if(a.d.id !== b.d.id) return a.d.id < b.d.id ? -1 : 1;
    return a.p.seq - b.p.seq;
  });
  return out;
}

/* ================================================================
   available_actions（H-03 / AC-LS-133）
   服务端在每次读取时返回当前可执行动作清单，前端按其渲染、**不自行依据状态或日期推断**。
   `⊘` 的**四种**情形文案各异（AC-RP-17，V2.0 收敛）：期次未开窗（附开启日期）、
   该期已提交待确认、该期已结清、非本笔业务的当事方。
   ⚠️ **「未登录」已从 ⊘ 中移除**——未登录时第③段只出「立即登录」（D-RP-67）。
   ================================================================ */
function repayAction(d, p){
  var s = pState(d, p);
  var a = { key:'repay', label:g('recordRepay'), enabled:false, reason:'', brief:'' };
  if(S.role !== 'asset' || d.party === 'other'){
    a.brief = L('Not your deal','非本笔业务的当事方');
    a.reason = L('Repayment belongs to the asset owner of this deal (' + CO.asset[0] +
                 '). A funder has no write access to the repayment schedule — the schedule is ' +
                 'generated by the platform; the funder cannot reschedule or add charges.',
                 '还款只属于该项目的资产方企业主体（' + CO.asset[1] +
                 '）。资金方在还款环节没有任何写入还款计划的权限——计划由系统生成，' +
                 '机构不能改期、不能催收加码。');
  } else if(s.st === 'S-RP-2'){
    a.brief = L('Already submitted','该期已提交待确认');
    a.reason = L('Instalment ' + p.seq + ' already has a repayment record (' + s.rec.id + ', ' +
                 withTz(s.rec.at) + ') awaiting confirmation. One instalment carries at most one ' +
                 'valid repayment record; a submitted record cannot be edited or withdrawn.',
                 '第 ' + p.seq + ' 期已提交还款记录（' + s.rec.id + '，' + withTz(s.rec.at) +
                 '），正在等待资金方确认。一个期次至多一条有效还款记录（D-RP-44），' +
                 '提交后不可修改、不可撤回。');
  } else if(s.st === 'S-RP-3'){
    a.brief = L('Already settled','该期已结清');
    a.reason = L('Instalment ' + p.seq + ' was settled on ' + withTz(s.rec.confirmAt) +
                 '. A settled instalment has no repayment action left.',
                 '该期已结清（' + withTz(s.rec.confirmAt) + '）。已结清的期次没有可执行的还款动作。');
  } else if(!s.opened){
    a.brief = L('Window opens ' + p.openAt, '未开窗 · ' + p.openAt + ' 开启');
    a.reason = L('The repayment window for instalment ' + p.seq + ' opens on ' + p.openAt +
                 ' 00:00 ' + TZ + ' (' + OPEN_DAYS + ' calendar days before the due date ' + p.due +
                 '). Early repayment is out of scope this round: principal is only repaid after the ' +
                 'financing project matures, and skipping ahead, merging instalments or settling ' +
                 'early are all unavailable.',
                 '该期还款入口将于 ' + p.openAt + ' 00:00 ' + TZ + ' 开启（应还日 ' + p.due +
                 ' 前 ' + OPEN_DAYS + ' 个自然日）；本期不支持提前还款。' +
                 '还本金只发生在融资项目到期之后，跳期还款、多期合并提交与一次性结清都不可用。');
  } else a.enabled = true;
  return a;
}
function confirmAction(d, p){
  var s = pState(d, p);
  var a = { key:'confirm_repayment', label:g('confirmRepay'), enabled:false, reason:'', brief:'' };
  if(s.st !== 'S-RP-2'){ a.absent = true; return a; }
  if(S.role !== 'fund'){
    a.brief = L('Not your deal','非本笔业务的当事方');
    a.reason = L('Repayment confirmation belongs to the funder of this deal (' + CO.fund[0] +
                 '). The asset owner has no write action while the instalment sits in S-RP-2 — ' +
                 'whether the repayment counts is for the receiving side to state.',
                 '还款确认只属于该笔业务的资金方企业主体（' + CO.fund[1] +
                 '）。资产方在 S-RP-2 段没有任何写动作——提交之后这笔还款算不算数，由收款的一方来认。');
  } else a.enabled = true;   /* 超期后照常返回、照常可用（D-RP-54） */
  return a;
}


/* ================================================================
   Part C —— 共用片段
   ================================================================ */
function cardHead(t, note){
  return '<div class="card-head"><b>' + t + '</b>' +
    (note ? '<span style="margin-left:auto" class="faint">' + note + '</span>' : '') + '</div>';
}
function field(label, opt, body, hint){
  return '<div class="field"><label>' + E(label) + (opt ? '<span class="opt">' + E(opt) + '</span>' : '') +
    '</label>' + body + (hint ? '<p class="hint">' + hint + '</p>' : '') + '</div>';
}
function inp(key, val, ph, extra){
  return '<input class="inp' + (extra && extra.err ? ' err' : '') + '" type="text" value="' + E(val || '') +
    '" placeholder="' + E(ph || '') + '"' + (extra && extra.max ? ' maxlength="' + extra.max + '"' : '') +
    ' data-act="rp.f" data-v="' + key + '">';
}
function ro(text, note){
  return '<div class="ls-ro">' + E(text) + '</div>' + (note ? '<p class="hint">' + note + '</p>' : '');
}
function markRow(tag, body, meta){
  return '<div class="ln-mark"><span class="tg">' + E(tag) + '</span><div class="bd">' + body +
    (meta ? '<div class="mt">' + meta + '</div>' : '') + '</div></div>';
}
function annot(body){ return '<div class="ln-annot">' + body + '</div>'; }
function sec(title, count, body, tint){
  return '<div class="u-sec' + (tint ? ' tint' : '') + '">' +
    (title ? '<div class="sh"><b>' + title + '</b>' + (count ? '<span class="c">' + count + '</span>' : '') + '</div>' : '') +
    body + '</div>';
}
/* ⊘ 的落法：**内联在原位 + Toast**，不开层（D-RP-76）。 */
function blockedBtn(a, cls){
  return '<button class="btn ' + (cls || '') + ' blocked" type="button" aria-disabled="true" ' +
    'title="' + E(a.reason) + '" data-act="rp.why" data-v="' + E(a.brief) + '">⊘ ' + E(a.label) + '</button>' +
    '<div class="ls-why"><span class="sg" aria-hidden="true">⊘</span><span>' + E(a.reason) + '</span></div>';
}
/* 本模块不触达链上（承接 D-FIN-67 / X-LS-52） */
function noChain(what){
  return '<p class="hint" style="margin-top:12px">' +
    L('This step performs no on-chain operation and consumes no gas: the repayment transfer happens ' +
      '<b>outside the platform</b> (your own bank or wallet) and the platform only records the hash ' +
      'and the chain as text. This module also <b>does not release or withdraw any pledge</b> — ' +
      'that belongs to the financing-demand module.',
      '本步骤（' + what[1] + '）<b>不产生任何链上操作、不消耗 gas</b>：还款的转账发生在' +
      '<b>平台之外</b>（您自己的钱包或银行），平台只收下哈希与链的文本记录。' +
      '本模块<b>不发起任何链上调用</b>，也<b>不释放、不提取任何质押</b>——' +
      '质押的释放与提取由融资需求与代币质押模块承接（D-RP-39）。') + '</p>';
}

/* ---- 计息规则常驻条（RP-18 / AC-RP-04）。在计划抽屉里它固定在顶部、不随表体滚走 ---- */
function ruleBar(d){
  var base = d.t0;
  return '<div class="rp-rule"><div class="rt">' +
    L('<b>Annual</b> simple interest, actual days ÷ ' + BASIS + ' (ACT/360); interest accrues from the ' +
      'start date and not on the due date. Interest start date = <b>' + base + '</b>',
      '<b>年化</b>单利，实际天数 ÷ ' + BASIS + '（ACT/360），起息日计息、应还日不计息；' +
      '起息日 = <b>' + base + '</b>') +
    L(' (the actual disbursement date).',' （实际放款日）。') +
  '</div><div class="rx">' +
    '<div class="i"><div class="k">' + L('Rate basis','利率口径') + '</div><div class="v">' +
      L('<b>Annual</b> ' + d.rate.toFixed(2) + '% (QT-06). The quote captures an annual percentage; ' +
        'this module consumes it as-is and does not reopen the definition.',
        '<b>年化</b> ' + d.rate.toFixed(2) + '%（QT-06）。利率在报价时采集的就是年化百分比，' +
        '本模块直接消费、不重开口径。') + '</div></div>' +
    '<div class="i"><div class="k">' + L('Simple / compound','单利 / 复利') + '</div><div class="v">' +
      L('<b>Simple.</b> Each instalment settles its own interest, so unpaid interest never rolls into ' +
        'principal.',
        '<b>单利</b>。先息后本下每期利息当期结清，不存在未付利息滚入本金的情形。') + '</div></div>' +
    '<div class="i"><div class="k">' + L('Day-count basis','计息基数') + '</div><div class="v">' +
      L('<b>ACT/360</b>, the market convention for cross-border USD financing. Using 365 would not ' +
        'match the figure in the offline contract.',
        '<b>ACT/360</b>。跨境美元融资的通行惯例；用 365 会与线下合同算出的数字对不上。') + '</div></div>' +
    /* RP-12 还款类型：引用 WS-325 QT-15，本模块不定义、不做下拉 */
    '<div class="i"><div class="k">' + g('repayType') + ' · QT-15</div><div class="v"><b>' + txt(QT15) +
      '</b>' + L('. Referenced read-only from the quote (QT-15); the enum is owned upstream, shown as ' +
                 'text and <b>never as a dropdown</b>.',
                 '。只读引用报价的 QT-15，枚举由上游持有，<b>只读文本展示、不做下拉</b>。') +
      '</div></div>' +
  '</div>' +
  '<div class="td">' +
    L('ACT/360 makes "annual rate × a full year" slightly exceed the nominal rate (about 1.39% more ' +
      'over a year). That is why the rule is spelled out in full here rather than reduced to a single ' +
      'percentage — the asset owner has to be able to recompute it day by day.',
      'ACT/360 让「年化利率 × 整年」实际略高于名义利率（一年约多 1.39%）。' +
      '这是本条规则全文常驻、不折叠、不只给一个百分数的原因——它必须能被资产方自己按天数算一遍。') +
  '</div></div>';
}

/* ---- 还款计划表（分册 6.6.1 · V3.4：**定稿版单版 + 精简为 6 列**）----
   V3.4 取消两版同屏对照，初始版收敛到报价环节（D-RP-80）。因此这里**不再出现**：
   「预计 · 未生效」版本标识、「预计还款日」列名、两版切换 tab、差异行高亮。
   主表 6 列：期次序号 · 应还日 · 应还合计（USD）· 结算币种金额 · 期次状态 · 逾期天数。
   **本息拆分与计息区间收进行内展开**——不是删掉：AC-RP-04 要求资产方能用页面数据自行验算利息，
   这三项是验算的必要输入，只能收起、不能移除。
   表尾合计**只在选定笔内、只给 USD 口径**；跨笔跨币种一律不得求和（D-RP-40 / D-RP-81 ③）。 */
function planTable(d, plan, curSeq){
  var sumP = 0, sumI = 0, sumT = 0;
  var rows = plan.map(function(p){
    var st = pState(d, p);
    sumP += p.principal; sumI += p.interest; sumT += p.total;
    /* 当前应还期次默认高亮——精简之后最该突出的就是这一行（D-RP-72 ③） */
    var isCur = (curSeq === p.seq);
    var cls = (isCur ? 'cur ' : '') + (p.last ? 'last ' : '') +
              (st.overdue && st.st === 'S-RP-1' ? 'odue' : '');
    var open = (S.rowOpen === p.seq);
    return '<tr' + (cls.trim() ? ' class="' + cls.trim() + '"' : '') +
        (isCur ? ' data-cur="1"' : '') + '>' +
      '<td class="mono">#' + p.seq +
        (isCur ? '<div class="sub">' + L('current','当前应还') + '</div>' : '') +
        (p.last ? '<div class="sub">' + L('incl. principal','含本金') + '</div>' : '') + '</td>' +
      '<td class="mono">' + p.due + '</td>' +
      '<td class="mono num"><b>' + amt(p.total) + '</b></td>' +
      '<td class="mono num">' + amt(p.settle) + ' ' + d.ccy + '</td>' +
      '<td>' + pill(TONE[RP_ST[st.st][1]] || 'gray', txt(RP_ST[st.st][0])) + '</td>' +
      '<td class="mono num">' + (st.overdue ? st.odDays + (st.frozen ? L(' · frozen',' · 已冻结') : '') : '—') + '</td>' +
      '<td class="col-x"><button class="btn sm link" type="button" data-act="rp.row" data-v="' + p.seq +
        '" aria-expanded="' + open + '">' + (open ? '−' : '+') + '</button></td>' +
    '</tr>' +
    (open ? '<tr class="xr"><td colspan="7"><div class="xg">' +
      '<div><span class="k">' + g('duePrincipal') + '</span><span class="v">' + amt(p.principal) + '</span></div>' +
      '<div><span class="k">' + g('dueInterest') + '</span><span class="v">' + amt(p.interest) + '</span></div>' +
      '<div><span class="k">' + g('accrualSpan') + '</span><span class="v">' + p.from + ' ~ ' + p.due + '</span></div>' +
      '<div><span class="k">' + L('Days','天数') + '</span><span class="v">' + p.days +
        (p.last && p.days > 92 ? L(' · absorbs the sub-quarter tail',' · 末期并入不足一季的尾段') : '') + '</span></div>' +
      '</div><p class="xn">' +
      L('Check it yourself: ' + amt(d.amt) + ' × ' + d.rate.toFixed(2) + '% × ' + p.days + ' ÷ ' + BASIS +
        ' = ' + amt(p.interest) + '.',
        '可自行验算：' + amt(d.amt) + ' × 年化 ' + d.rate.toFixed(2) + '% × ' + p.days + ' ÷ ' + BASIS +
        ' = ' + amt(p.interest) + '。') + '</p></td></tr>' : '');
  }).join('');
  return '<div class="rp-wrap"><table class="tbl ls-tbl rp-plan">' +
    '<thead><tr><th>' + g('instalment') + '</th><th>' + g('dueDate') + '</th>' +
      '<th>' + g('dueTotal') + '</th><th>' + g('settleAmount') + '</th>' +
      '<th>' + L('Status','期次状态') + '</th><th>' + L('Days overdue','逾期天数') + '</th>' +
      '<th class="col-x"><span class="tiny">' + L('detail','明细') + '</span></th></tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '<tfoot><tr><td class="lb" colspan="2">' + L('Total · this deal only, ' + CCY + ' basis',
      '合计 · 仅本笔、仅 ' + CCY + ' 记账口径') + '</td>' +
      '<td class="num">' + amt(sumT) + '</td>' +
      '<td class="lb" style="font-size:10px;color:var(--faint);font-weight:400">' +
        L('settlement amounts never roll up','结算币种金额不参与任何合计') + '</td>' +
      '<td colspan="3" class="lb" style="font-size:10px;color:var(--faint);font-weight:400">' +
        L('principal ' + amt(sumP) + ' · interest ' + amt(sumI),
          '本金 ' + amt(sumP) + ' · 利息 ' + amt(sumI)) + '</td></tr></tfoot></table></div>' +
    '<p class="hint" style="margin-top:9px">' +
      L('Totals are given <b>within this deal only</b> and on the <b>' + CCY + '</b> ledger basis. ' +
        '<b>Amounts across deals or across currencies are never summed</b>: one project may carry several ' +
        'deals settling in different currencies and funded by different institutions, so a combined total ' +
        'would be wrong — no such view exists anywhere in this module.',
        '合计<b>只在选定笔内</b>、一律按 <b>' + CCY + '</b> 记账口径给出。' +
        '<b>跨笔、跨币种一律不得求和</b>：同一项目可能有多笔业务、结算币种不同、出资机构也不同，' +
        '把它们加在一起是错的——本模块不存在这样的汇总视图（D-RP-40 / D-RP-81 ③）。') + '</p>';
}


/* ---- 两条轴：计息停止点 vs 还款记录终结点（D-FIN-11 / D-RP-29 / D-RP-30 / AC-RP-09）----
   本模块最不能被优化掉的一条，因此给它一个独立的形状而不是一段文字。
   形状与设计意图沿用 v1.0，一个都没动。 */
function freezeCard(d, p){
  var s = pState(d, p), k = clock(d, p);
  var submitted = !!s.rec, confirmed = submitted && !!s.rec.confirmAt;
  return '<div class="rp-freeze"><div class="fh">' +
    L('Two different stops: when the clock stops, and when the record ends',
      '计息停止点与还款记录终结点是两件事') +
    '<span class="at">D-FIN-11 · D-RP-29</span></div>' +

    /* 轴一：时间的停止 —— 停在提交时刻 */
    '<div class="rp-ax"><div class="an"><span class="t">' +
      L('Axis 1 · the clock stops','轴一 · 时间的停止') + '</span><span class="s">' +
      L('stops the moment the <b>asset owner submits</b> (RM-06, server time)',
        '停在<b>资产方提交成功</b>的那一刻（RM-06 服务端时间）') + '</span></div>' +
      '<div class="track">' +
        '<div class="seg2"><div class="sk">' + g('dueDate') + '</div><div class="sv">' + p.due + '</div>' +
          '<div class="sx">' + L('Submitting any time that day is not late. No grace period.',
                                 '当日 24:00 前提交即不逾期；不设宽限期（D-RP-34）。') + '</div></div>' +
        '<div class="seg2' + (s.overdue ? ' on' : '') + '"><div class="sk">' +
          L('Overdue accrual','逾期累加') + '</div><div class="sv">' +
          (s.overdue ? L(s.odDays + ' days overdue', '已逾期 ' + s.odDays + ' 天') : L('not triggered','未发生')) + '</div>' +
          '<div class="sx">' + (s.overdue
            ? L('+1 per day from 00:00 the day after the due date' + (submitted ? '; already stopped.' : '; still counting.'),
                '自应还日次日 00:00 起每日 +1' + (submitted ? '，已停止累加。' : '，当前仍在累加。'))
            : L('This instalment never carried an overdue mark.','该期未触发逾期标记。')) + '</div></div>' +
        '<div class="seg2 stop"><div class="sk">' + L('Stopped at','停止时刻') + '</div>' +
          '<div class="sv">' + (submitted ? s.rec.at : L('not submitted yet','尚未提交')) + '</div>' +
          '<div class="sx">' + (submitted
            ? L('Days overdue <b>frozen at ' + s.odDays + '</b> and never increment again; no further ' +
                'overdue events or notices are produced for this instalment.',
                '逾期天数<b>冻结在 ' + s.odDays + ' 天</b>，此后不再 +1；该期不再产生任何新的逾期事件与逾期通知。')
            : L('Stops the instant the submission succeeds — regardless of whether the funder confirms.',
                '提交成功的同一刻停止，与资金方确认与否无关。')) + '</div></div>' +
      '</div>' +
      '<div class="mark2"><i aria-hidden="true">■</i><span>' +
        L('The stop is set by <b>RM-06 submission time</b> — <b>not</b> by the funder’s confirmation, ' +
          'and <b>not</b> by the repayment time the submitter typed in (RM-05).',
          '停止点由 <b>RM-06 提交时间</b> 决定，<b>不是</b>资金方的确认时刻，' +
          '也<b>不是</b>提交方自己填写的还款时间（RM-05）。') + '</span></div></div>' +

    /* 轴二：状态的终结 —— 停在确认时刻 */
    '<div class="rp-ax"><div class="an"><span class="t">' +
      L('Axis 2 · the record ends','轴二 · 状态的终结') + '</span><span class="s">' +
      L('ends the moment the <b>funder confirms receipt</b> (RM-18)',
        '停在<b>资金方确认收到还款</b>的那一刻（RM-18）') + '</span></div>' +
      '<div class="track">' +
        '<div class="seg2' + (!submitted ? ' on' : '') + '"><div class="sk">S-RP-1 ' + txt(RP_ST['S-RP-1'][0]) +
          '</div><div class="sv">' + (submitted ? L('left','已离开') : L('current','当前')) + '</div>' +
          '<div class="sx">' + L('The repayment window opens per instalment.','还款入口按期次逐个开窗。') + '</div></div>' +
        '<div class="seg2' + (submitted && !confirmed ? ' on' : '') + '"><div class="sk">S-RP-2 ' +
          txt(RP_ST['S-RP-2'][0]) + '</div><div class="sv">' +
          (submitted ? (confirmed ? L('left','已离开') : L('current','当前')) : L('not reached','未到达')) + '</div>' +
          '<div class="sx">' + (submitted && !confirmed
            ? L('Window closes ' + s.limitAt + '; ') + (k.over
                ? L('elapsed ' + k.overDays + ' days ago — <b>status, amounts and permissions all unchanged</b>.',
                    '已超过 ' + k.overDays + ' 天，<b>状态不变、额度不动、权限不变</b>。')
                : L(fmtDur(k.leftMin) + ' remaining. Expiry only sends a notice; it <b>never counts as confirmation</b>.',
                    '剩余 ' + fmtDur(k.leftMin) + '。到期只发通知，<b>不自动视为确认</b>。'))
            : L('Neither credit figure moves during this leg.','两个额度量在这一段<b>一个都不动</b>。')) + '</div></div>' +
        '<div class="seg2 stop"><div class="sk">S-RP-3 ' + txt(RP_ST['S-RP-3'][0]) + '</div>' +
          '<div class="sv">' + (confirmed ? s.rec.confirmAt : L('awaiting the funder','待资金方确认')) + '</div>' +
          '<div class="sx">' + (p.principal
            ? L('Instalment carrying principal: <b>' + G.outstanding[0] + '</b> and <b>' + G.creditUsed[0] +
                '</b> step down by the same amount at this instant.',
                '含本金期次：同刻 <b>项目融资余额</b> 与 <b>授信占用额</b> 等额递减。')
            : L('Interest-only instalment: <b>neither figure moves</b> — both are sums of outstanding ' +
                'principal, and interest is not principal.',
                '利息期结清：两个量<b>一动不动</b>——它们是未偿本金的合计，利息不在其中。')) + '</div></div>' +
      '</div>' +
      '<div class="mark2"><i aria-hidden="true">■</i><span>' +
        L('Settling the instalment, stepping the credit figures down and moving the deal to settled ' +
          '<b>all wait for the funder</b> — that part is not weakened.',
          '期次结清、额度递减、业务进 S-FD-8 <b>都必须等资金方确认</b>——这一条没有被削弱。') +
      '</span></div></div>' +

    '<div class="ff">' + (S.role === 'fund'
      ? L('In one line: <b>confirmation decides whether this repayment counts; submission decides where ' +
          'the clock stopped.</b> The counterparty’s overdue days froze the moment they submitted and ' +
          '<b>will not grow while you take your time</b> — so check the actual receipt properly rather ' +
          'than confirming to beat a deadline.',
          '一句话：<b>确认决定"这笔还款算不算数"，提交决定"时间停在哪一刻"。</b>' +
          '对方的逾期天数已经在他提交的那一刻定住了，<b>不会因为您暂时不确认而继续增加</b>；' +
          '您也不会因为多花几天核对而让他多背一天逾期。请按实际到账情况决定是否确认，不要为了"赶时间"而确认。')
      : L('In one line: <b>confirmation decides whether this repayment counts; submission decides where ' +
          'the clock stopped.</b> Once you have paid and filed the record, <b>the funder not confirming ' +
          'cannot make you pay more interest and cannot keep your overdue days growing</b>. Each ' +
          'instalment’s interest was fixed when the schedule was finalised — it is <b>not</b> recomputed ' +
          'per day, so "submit early and pay less" or "submit late and pay more" simply do not exist here.',
          '一句话：<b>确认决定"这笔还款算不算数"，提交决定"时间停在哪一刻"。</b>' +
          '您把钱打了、记录提交了，<b>机构不确认不会让您多付利息、也不会让您继续背逾期</b>。' +
          '本期每期利息在计划定稿时就已固定（D-RP-09），<b>不按日重算</b>——' +
          '"提前几天提交少付利息"或"晚几天提交多付利息"在本期都不存在。')) +
    '</div></div>';
}

/* ---- 客服邮箱卡（D-RP-55）：本期还款异议的唯一入口 ---- */
function mailCard(d, p, where){
  return '<div class="ln-mail"><div class="mh">' +
    L('Disagree with this repayment? Settle it offline via the support mailbox',
      '对这笔还款有异议？走客服邮箱线下核实') + '</div>' +
    '<div class="ad"><span class="em">' + E(MAIL) + '</span>' +
    '<button class="btn sm" type="button" data-act="rp.copyMail">' +
      L('Copy mailbox and the three IDs','复制邮箱与三个编号') + '</button></div>' +
    '<p>' + L('Quote <b>' + g('demandNo') + ' ' + d.fp + '</b>, <b>' + g('dealNo') + ' ' + d.id +
              '</b> and <b>' + g('planNoLbl') + ' ' + planNo(d, p) + '</b> in your email. ',
              '请在邮件中注明<b>需求编号 ' + d.fp + '</b>、<b>融资业务编号 ' + d.id +
              '</b> 与<b>还款计划编号 ' + planNo(d, p) + '</b>。') +
    (where === 'confirm'
      ? L('Wrong amount, a bad proof, or no money at all — there is <b>no "raise a dispute" entry</b> on ' +
          'the platform this round. The only thing you can do is <b>not confirm</b>, and contact the ' +
          'other side.',
          '金额不符、凭证有问题、款根本没到——<b>平台上没有「提出异议」入口</b>（本期不做），' +
          '您唯一能做的是<b>先不要点确认</b>，并与对方联系。')
      : L('If the funder is slow to confirm, <b>do not submit again</b> — one instalment carries at most ' +
          'one valid repayment record, so a second submission produces nothing and does not speed ' +
          'anything up.',
          '如果机构迟迟不确认，<b>先不要重复提交</b>——一个期次至多一条有效还款记录，' +
          '重复提交不会产生第二条，也不会加快确认。')) +
    '</p><p><b>' + L('The platform will not confirm on anyone’s behalf, will not auto-confirm, and will ' +
      'not mark the asset owner as late because of this.',
      '平台不会代为确认、不会自动确认，也不会因此判定资产方逾期。') + '</b> ' +
    L('It <b>promises neither a turnaround time nor an outcome</b> — the mailbox is a channel that puts ' +
      'the two sides in touch, not an arbitration entry.',
      '平台<b>不承诺处理时效、不承诺处理结果</b>——邮箱是把双方接上线的通道，不是一个仲裁入口。') +
    '</p></div>';
}

/* ---- 机构还款收款账户（RP-14 / RM-10 / D-FIN-24 红线）----
   来源是 **WS-326 放款时登记的 LN-15 / LN-16**（V3.1 改锚；原锚点 QT-07 / QT-08 已作废）。
   这里**没有任何编辑控件**——不是置灰的输入框，是不存在输入框。 */
function payeeRo(d, visible){
  if(!visible){
    return '<div class="rp-acct"><div class="lock"><i aria-hidden="true">▤</i><span>' +
      L('<b>The payee account is not public.</b> It is visible only to the two parties of this deal and ' +
        'is filtered server-side by ownership — the fields are simply absent from the response, not ' +
        'hidden by the front end.',
        '<b>机构还款收款账户不对外公开</b>。它只对该笔业务的双方可见，由服务端按归属过滤——' +
        '接口响应里根本不含这些字段，不是前端隐藏（D-RP-41 / AC-LS-131）。') + '</span></div></div>';
  }
  var f = isFiat(d);
  /* 法币五项整组（含中转行，LN-15）；数币取绑定钱包地址（LN-16），链为常量 ETH */
  var grid = f
    ? '<div><div class="k">' + L('Account name','户名') + '</div><div class="v">' + E(PAYEE_FIAT.name) + '</div></div>' +
      '<div><div class="k">' + L('Account number','账号') + '</div><div class="v">' + E(maskAcct(PAYEE_FIAT.acct)) + '</div></div>' +
      '<div><div class="k">SWIFT</div><div class="v">' + E(PAYEE_FIAT.swift) + '</div></div>' +
      '<div><div class="k">' + L('Bank','开户行') + '</div><div class="v">' + E(PAYEE_FIAT.bank) + '</div></div>' +
      '<div><div class="k">' + L('Correspondent bank','中转行') + '</div><div class="v">' + E(PAYEE_FIAT.corr) + '</div></div>'
    : '<div><div class="k">' + L('Wallet address','收款地址') + '</div><div class="v">' + E(maskAddr(PAYEE_COIN.addr)) + '</div></div>' +
      '<div><div class="k">' + g('chainLbl') + '</div><div class="v">' + CHAIN + '</div></div>';
  return '<div class="rp-acct"><div class="ag">' + grid + '</div>' +
    '<div class="lock"><i aria-hidden="true">⊘</i><span>' +
    L('This is the <b>repayment payee account the funder registered at disbursement</b> (' +
      (f ? 'LN-15' : 'LN-16') + '); it <b>cannot be changed or replaced here</b>. There is <b>no edit ' +
      'control in this block</b> — not a greyed-out input, no input at all. Being able to change it ' +
      'would be exactly the phishing opening this rule exists to close. ' +
      (f ? 'The fiat group is five fields including the <b>correspondent bank</b> — one more than the ' +
           'asset-owner side, deliberately so.'
         : 'The address comes from the funder’s bound wallet and is read-only; the chain is the ' +
           'constant ' + CHAIN + '.') +
      ' Values are masked per the i18n baseline.',
      '该账户为<b>资金方放款时登记的还款收款账户</b>（' + (f ? 'LN-15' : 'LN-16') +
      '），还款时<b>不可修改、不可另填</b>。本区<b>没有任何编辑控件</b>——不是置灰的输入框，' +
      '是不存在输入框。可改就等于给了钓鱼的口子（D-FIN-24）。' +
      (f ? '法币是<b>户名 / 账号 / SWIFT / 开户行 / 中转行</b>五项整组——比资产方侧多一个中转行，' +
           '两侧规格有意不同。'
         : '数币取资金方<b>绑定钱包地址</b>、只读；链是常量 ' + CHAIN + '。') +
      '地址与账号按国际化基线脱敏展示。') + '</span></div></div>';
}

/* ---- 交易哈希块（RM-08 / RM-09 / RM-13 / D-RP-43 / AC-RP-10）----
   链是常量 ETH：只展示、不录入、不给任何选择控件。链接常驻「平台未核验」。 */
function hashBlock(rec, compact){
  return '<div class="ln-hash"><div class="hv">' + E(compact ? shortHash(rec.hash) : rec.hash) + '</div>' +
    '<div class="meta"><span>' + g('chainLbl') + ' · RM-09 <b>' + CHAIN + '</b> ' +
      L('(system constant · USDT / USDC are ERC-20)','（系统常量 · USDT / USDC 即 ERC-20）') + '</span>' +
    '<span>' + L('Format','格式') + ' <b>0x + 64 hex</b></span></div>' +
    '<div class="lk"><a class="btn sm" href="' + E(EXPLORER.base + rec.hash) +
      '" target="_blank" rel="noopener noreferrer">' + L('Open on ','在 ') + EXPLORER.name + L('','上打开') + '</a>' +
    '<span class="nv">' + L('The platform has not verified this transaction; the link is for your own check.',
                            '平台未核验该交易，链接仅供自行查验') + '</span></div>' +
    '<p class="hint" style="margin-top:8px">' +
      L('This round the hash is <b>format-checked only, never verified on chain</b>: no indexer is wired ' +
        'in, neither blocking nor advisory. That means a well-formed but non-existent hash can be ' +
        'submitted — the risk is caught by human judgement at confirmation.',
        '本期<b>只做格式校验、不做链上核验</b>：不接索引服务，既不做阻断式也不做告警式（D-RP-42）。' +
        '这意味着提交方可以填一个格式正确但不存在的哈希——这个风险由确认环节的人工判断兜底。') +
    '</p></div>';
}

/* ---- 还款时间 vs 提交时间并列（RM-05 / RM-06 / D-FIN-21）---- */
function timesPair(rec){
  return '<div class="ln-pair">' +
    '<div class="t"><div class="k">' + g('repaidAt') + ' · RM-05</div><div class="v">' + withTz(rec.given) + '</div>' +
      '<div class="src">' + L('Source: <b>typed in by the submitter</b>. May be in the past, never later ' +
        'than the submission instant. <b>No deadline or interest calculation uses it</b> — it is a ' +
        'reconciliation reference only.',
        '来源：<b>提交方填写</b>。可为过去时间、不得晚于提交时刻。' +
        '<b>任何时效与计息都不使用它</b>——它只是业务参考与对账依据（D-FIN-21）。') + '</div></div>' +
    '<div class="t auth"><div class="k">' + g('submittedAt') + ' · RM-06</div><div class="v">' + withTz(rec.at) + '</div>' +
      '<div class="src">' + L('Source: <b>recorded by the server</b>. This is the authoritative time in ' +
        'this module: <b>the instant overdue accrual stops</b>, and <b>the start of the repayment ' +
        'confirmation window</b>.',
        '来源：<b>服务端记录</b>。本模块的权威时间：<b>停止逾期累加的时点</b>，' +
        '以及<b>还款确认时限的起算点</b>。') + '</div></div></div>';
}


/* ================================================================
   Part D —— 宿主页：融资项目详情页 + 三段式操作区
   WS-324 把详情页操作区定为三段（全局操作 / 融资流程四环节 / 还款流程），
   **只有当前环节出按钮、按角色限定可点、操作不跳离详情页**（D-FIN-79 / AC-LS-85）。
   **第③段「还款流程」就是本模块**——按 FP-28 需求编号切换、展示最近一笔还款的核心信息、
   三个入口一律走右侧抽屉 760px（D-RP-71 / D-RP-73 / AC-RP-24）。
   ================================================================ */

/* 同一项目下的各轮需求（按 FP-28 切换，D-RP-66 / D-RP-74） */
function demandsOfProject(pid){
  var out = [];
  DEALS.forEach(function(d){ if(d.pid === pid && !d.quoting) out.push(d); });
  out.sort(function(a, b){ return a.fp < b.fp ? -1 : 1; });
  return out;
}
function curDeal(){ return findDeal(S.deal) || DEALS[0]; }
/* 抽屉内当前选中的期次。缺省走 D-RP-21 ~ D-RP-24 的排序结果（＝真正的「默认定位」）。 */
function curPeriod(){
  var d = curDeal(), plan = finalPlan(d), i;
  if(S.seq){ for(i = 0; i < plan.length; i++) if(plan[i].seq === S.seq) return plan[i]; }
  if(S.drawer === 'repay'){
    /* 默认定位：跨业务排序的第一条若属于本笔业务就用它，否则退回本笔的第一个 S-RP-1 */
    var c = candidates();
    for(i = 0; i < c.length; i++) if(c[i].d.id === d.id) return c[i].p;
  }
  var target = S.drawer === 'confirm' ? 'S-RP-2' : 'S-RP-1';
  for(i = 0; i < plan.length; i++) if(pState(d, plan[i]).st === target) return plan[i];
  return plan.length ? plan[plan.length - 1] : null;
}

var FLOW4 = [
  ['stDemand',  ['Demand published and pledge locked','需求已发布、质押已锁定']],
  ['stQuote',   ['Quote submitted by the funder','资金方已提交报价']],
  ['stConfirm', ['Quote accepted by the asset owner','资产方已接受报价']],
  ['stDisburse',['Disbursed and confirmed; the schedule is final','已放款并完成放款确认，还款计划已定稿']]
];

function hostPage(){
  var d = curDeal(), gp = progress(d), guest = (S.role === 'guest');
  var demands = demandsOfProject(d.pid);

  var head = '<div class="ls-phead"><div class="tile" aria-hidden="true">◎</div><div class="body">' +
    '<p class="kick">' + g('project') + ' <span class="mono">' + d.pid + '</span> · ' +
      g('demandNo') + ' <span class="mono">' + d.fp + '</span> · ' +
      g('dealNo') + ' <span class="mono">' + d.id + '</span> · ' + TZ + '</p>' +
    '<h1>' + E(txt(d.pname)) + '</h1>' +
    '<div class="ls-tags">' +
      /* 对外状态五值：本模块一次跃迁都不驱动，结清与逾期都不转出、不做成修饰（D-RP-64） */
      pill(DEMAND_ST[1], txt(DEMAND_ST[0])) +
      pill(TONE[(FD_ST[d.st] || FD_ST['S-FD-6'])[1]] || 'gray', d.st + ' ' + txt((FD_ST[d.st] || FD_ST['S-FD-6'])[0])) +
      pill('gray', g('assetOwner') + ' ' + (d.party === 'other' ? co('other') : co('asset'))) +
      pill('gray', g('funder') + ' ' + co('fund')) +
      (d.planReady ? pill('gray', L('Settled ' + gp.done + ' / ' + gp.n + ' instalments',
                                    '已结清 ' + gp.done + ' / ' + gp.n + ' 期')) : '') +
      (gp.overdue ? pill('gray', L('Overdue · longest ' + gp.overdue.days + ' days',
                                   'S-FD-9 逾期（并行标记）· 最长 ' + gp.overdue.days + ' 天')) : '') +
      (d.matured ? pill('gray', L('Matured · run-off in progress','已到期 · 存量处理中')) : '') +
    '</div></div>' +
    '<div class="amt"><div class="k">' + L('Financing amount · QT-03','融资金额 · QT-03') + '</div>' +
    '<div class="v">' + amt(d.amt) + '<span class="cy">' + CCY + '</span></div>' +
    '<div class="x">' + L('Annual rate ','年化利率 ') + d.rate.toFixed(2) + '%　·　' +
      L('settles in ','结算币种 ') + d.ccy +
      (isFiat(d) ? '' : L('　·　FX snapshot ','　·　汇率快照 ') + d.fx.v.toFixed(4)) + '</div></div></div>';

  /* ---- 左栏：还款计划摘要（公开字段）+ 标记 ---- */
  var marks = '';
  if(gp.overdue)
    marks += markRow(g('overdueMark'),
      L('Instalment ' + gp.overdue.seq + ' (due ' + gp.overdue.due + ') is <span class="day">' +
        gp.overdue.days + '</span> days overdue, +1 per day, <b>frozen the moment a repayment record ' +
        'is submitted</b>. The repayment window for an overdue instalment <b>stays open</b> — closing ' +
        'it would mean refusing to let anyone pay.',
        '第 ' + gp.overdue.seq + ' 期（应还日 ' + gp.overdue.due + '）已逾期 <span class="day">' +
        gp.overdue.days + '</span> 天，逾期天数每日 +1，<b>提交还款记录即冻结</b>（D-FIN-11）。' +
        '该期还款入口<b>保持开启</b>——关掉就等于不让人还钱。'),
      L('Overdue is a <b>parallel mark, not a status</b>: the deal is still S-FD-6. The platform ' +
        '<b>computes no penalty interest, shows no penalty amount and rolls nothing into the amount ' +
        'due</b>, and overdue <b>triggers no disposal</b> of the pledge.',
        '逾期是<b>并行标记不是状态</b>：业务状态仍是 S-FD-6 还款中（D-FIN-09 / D-RP-35）。' +
        '平台<b>不计算罚息、不展示罚息金额、不把罚息并入任何应还金额</b>（X-LS-45），' +
        '逾期也<b>不触发任何质押处置</b>（X-LS-46）。'));
  if(d.matured)
    marks += markRow(L('Matured · run-off','已到期 · 存量处理中'),
      L('The financing project matured on <b>' + d.fd46 + '</b>. What stops is accepting new quotes and ' +
        'republishing; <b>existing deals keep performing as normal</b>.',
        '融资项目已于 <b>' + d.fd46 + '</b> 到期。停止的是「接受新报价 / 再次发布」，' +
        '<b>存量融资业务照常履约中</b>。'),
      L('This is the <b>normal path</b>, not an exception: principal is only ever repaid after the ' +
        'project matures. Shown neutrally — no alert colour, no warning icon.',
        '这是<b>常态路径</b>，不是异常：还本本来就发生在融资项目到期之后（X-LS-06 / D-FIN-47）。' +
        '一律中性呈现，不用告警色、不写"项目已过期"（AC-RP-18）。'));
  if(!d.planReady && d.st === 'S-FD-6')
    marks += markRow(L('Schedule being generated','还款计划生成中'),
      L('Disbursement confirmation completed at <b>' + withTz(d.fd35) + '</b>; the repayment schedule ' +
        'is being generated and will appear here once ready.',
        '放款确认已于 <b>' + withTz(d.fd35) + '</b> 完成，还款计划正在生成，就绪后本段自动显示。'),
      L('Credit transfer and status migration <b>are not rolled back</b> for this: the money arrived and ' +
        'the debt exists. <b>No error is shown and no retry button is offered</b> — retrying is the ' +
        'platform’s job. Until the schedule exists there is nothing to repay, and <b>no overdue mark ' +
        'can arise</b> either.',
        '额度转移与状态迁移<b>不因此回滚</b>（承接 E-LN-13）：钱已到账、债务已成立是事实。' +
        '这里<b>不展示错误、不给重试按钮</b>——重试是平台侧的事。' +
        '计划就绪前没有任何期次可还，也<b>不会产生逾期</b>——逾期判定的对象是期次，而期次还不存在。'));
  if(gp.settled)
    marks += markRow(txt(FD_ST['S-FD-8'][0]),
      L('All <b>' + gp.n + '</b> instalments are settled; the deal reached S-FD-8 on <b>' +
        withTz(d.fd47) + '</b>. Both credit figures for this deal are back to zero.',
        '全部 <b>' + gp.n + '</b> 期已结清，业务于 <b>' + withTz(d.fd47) +
        '</b> 进入 S-FD-8 已结清（终态）。项目融资余额与授信占用额该笔已归零。'),
      L('Settlement <b>does not move the public demand status</b> — it stays "Disbursed". That is a ' +
        'deliberate upstream trade-off (D-RP-64): repayment progress is not expressed by the demand status.',
        '结清<b>不驱动对外状态跃迁</b>——需求对外仍是「已放款」。这是上游刻意的取舍（D-RP-64）：' +
        '还款进展不用需求状态表达，要看进展就来第③段或我的控制台。'));

  var planCard = !d.planReady ? '' :
    '<div class="card">' + cardHead(g('repaySchedule'),
      L('public fields · authoritative output of this module','公开字段 · 本模块权威产出')) +
    '<div class="card-b"><div class="ls-kgrid">' +
      '<div><div class="k">' + L('Settled / total instalments','已结清 / 总期数') + '</div>' +
        '<div class="v">' + gp.done + ' / ' + gp.n + '</div>' +
        '<div class="x">' + txt(QT15) + '</div></div>' +
      '<div><div class="k">' + g('accrualStart') + ' · FD-45</div><div class="v">' + d.t0 + '</div>' +
        '<div class="x">' + L('= actual disbursement date (LN-06 date part)','＝ 实际放款日（LN-06 的日期部分）') + '</div></div>' +
      '<div><div class="k">' + g('finalDueDate') + ' · FD-46</div><div class="v">' + d.fd46 + '</div>' +
        '<div class="x">' + L('= QT-16, which follows the project end date; derived, not snapshotted',
                              '＝ QT-16，恒等于项目截止日；派生值、不做定稿快照') + '</div></div>' +
      '<div><div class="k">' + L('Next instalment due','最近一笔应还') + '</div>' +
        '<div class="v">' + (gp.next ? gp.next.due : '—') + '</div>' +
        '<div class="x">' + (gp.next ? g('dueTotal') + ' ' + usd(gp.next.total)
                                     : L('no instalment awaiting payment','无待还期次')) + '</div></div>' +
      '<div><div class="k">' + L('Cumulative principal / interest repaid','累计已还本金 / 利息') + ' · FD-42</div>' +
        '<div class="v">' + amt(gp.paidPri) + ' / ' + amt(gp.paidInt) + '</div>' +
        '<div class="x">' + CCY + L(' · instalments awaiting confirmation are excluded',' · 待确认期次不计入') + '</div></div>' +
      '<div><div class="k">' + L('Outstanding principal','未偿本金') + ' · FD-43</div>' +
        '<div class="v">' + amt(gp.unpaidPri) + '</div>' +
        '<div class="x">' + L('the summand behind both credit figures','它就是 项目融资余额 与 授信占用额 的被加数') + '</div></div>' +
    '</div>' +
    (guest ? '<p class="hint" style="margin-top:12px">' +
      L('<b>Not public</b> (filtered server-side, not hidden by the front end): repayment proof files, ' +
        'transaction hash, the funder’s payee account, repayment and confirmation remarks.',
        '<b>不公开字段</b>（服务端过滤，不是前端隐藏）：还款凭证文件、交易哈希、机构收款账户、' +
        '还款备注与补充材料、确认备注（D-RP-41 / AC-LS-131）。') + '</p>' : '') +
    '</div></div>';

  /* ---- 右栏：三段式操作区 ---- */
  var flow = FLOW4.map(function(f, i){
    return '<div class="fs done"><div class="t"><span class="no">' + (i + 1) + '</span>' + g(f[0]) + '</div>' +
      '<div class="x">' + E(txt(f[1])) + '</div></div>';
  }).join('');

  /* ---- 第③段的出现条件（D-RP-77 ②）：业务进入 S-FD-6 之后才出现；
         未进入时**整段不渲染**——不是渲染成空块或占位。
         空块会被读成"还款流程坏了"，而此刻正确的事实是"还没走到这一步"。 ---- */
  var inRepay = (d.st === 'S-FD-6' || d.st === 'S-FD-8');

  var rail = '<aside class="portal-rail">' +
    /* ①② 两段：容器规范与内容都归上游（WS-324 主册 6.5.5 / WS-325 / WS-326），
       本模块只把它们复刻出来托住自己的第③段，**不重新定义**（D-RP-77）。 */
    '<div class="card"><div class="card-head"><b>' + L('Actions','操作区') + '</b>' +
    '<span style="margin-left:auto" class="faint">' + L('sections 1-2 · owned upstream','①② 段 · 归上游') +
    '</span></div>' +
    '<div class="card-b"><div class="ls-flow4"><div class="fs done">' +
      '<div class="t"><span class="no">1</span>' + L('Global','全局操作') + '</div>' +
      '<div class="x">' + L('Project-level actions belong to the financing-demand module and are not ' +
        'defined here.','项目级动作归融资需求与代币质押模块，本模块不重新定义。') + '</div></div></div></div>' +
    '<div class="card-b" style="border-top:1px solid var(--border)">' +
      '<div class="sec-head" style="margin-bottom:8px"><h2 style="font-size:12px;color:var(--faint);' +
      'text-transform:uppercase;letter-spacing:.05em;margin:0">' + L('2 · Financing flow','② 融资流程四环节') +
      '</h2></div><div class="ls-flow4">' + flow + '</div></div></div>' +

    /* ---- 第③段：**独立成一张卡**，与①②在结构上真分开——自己的区块标题、明确的分隔、
           不与②的环节条混排、不共用②的当前环节高亮态（D-RP-77 ①）。 ---- */
    (inRepay
      ? '<div class="card rp-block"><div class="card-head"><b>' + L('3 · Repayment','③ 还款流程') + '</b>' +
        '<span style="margin-left:auto" class="faint">' + L('owned by this module','本模块') + '</span></div>' +
        '<div class="card-b">' + section3(d, demands, gp) + '</div></div>'
      : '') +

    (inRepay ? '<div class="card"><div class="card-b"><p class="hint">' +
      L('Deep links land on this page, scroll to section 3 and open the matching drawer; closing the ' +
        'drawer keeps you here.',
        '深链落到本页、定位到第③段并打开对应抽屉；关掉抽屉就停在这一页，不返回、不跳走。') +
      '<br><span class="mono">deal/' + d.id + '?action=repay</span>' +
      '<br><span class="mono">deal/' + d.id + '?action=view_schedule</span>' +
      '<br><span class="mono">schedule/{id}?action=confirm_repayment</span></p></div></div>' : '') +
    '</aside>';

  /* ---- 原型说明件：**不属于生产界面**（分册 6.6.2 的"移走"表最后一行）----
     五个拦截点说明与两条轴示意是 PRD 条款（6.2.2 / 5.6）与原型的说明件，不是给终端用户看的
     界面元素，因此从「立即还款」抽屉里移了出来。它们仍然要能被评审看到——规则本身一条没改，
     只是不再摆在资产方面前。界面上保留的是它们的**效果**：未开窗 ⊘ + 原因、金额只读、
     逾期天数那句「提交后即冻结」。 */
  var explain = '';
  if(inRepay && d.planReady){
    var fp2 = gp.next || gp.await2 || gp.plan[0];
    explain = '<div class="card ln-annot-card" style="margin-top:16px">' +
      cardHead(L('Prototype explainers · not part of the production UI','原型说明件 · 不属于生产界面'),
        L('PRD clauses 6.2.2 / 5.6 · moved out of the drawer in V3.4','PRD 6.2.2 / 5.6 条款 · V3.4 起移出抽屉')) +
      '<div class="card-b">' +
      '<p class="hint" style="margin-top:0">' +
        L('These two are how the rules are argued, not what the asset owner is shown. They were in the ' +
          '"Record a repayment" drawer before V3.4; the simplification moved them here. The rules ' +
          'themselves are unchanged — their <b>effects</b> are still enforced in the drawer.',
          '这两件是规则的论证，不是给资产方看的东西。V3.4 之前它们在「立即还款」抽屉里，' +
          '本轮精简把它们移到这里。<b>规则本身一条没改</b>——它们的<b>效果</b>仍然在抽屉里生效。') + '</p>' +
      '<div style="margin-top:14px">' + freezeCard(d, fp2) + '</div>' +
      '<div style="margin-top:16px">' + stopCards(fp2) + '</div>' +
      '</div></div>';
  }

  return CF.pageStates() + head +
    (marks ? '<div style="margin-bottom:16px">' + marks + '</div>' : '') +
    '<div class="portal-cols"><div>' + planCard + resultCard() + explain + '</div>' + rail + '</div>';
}

/* ---- 第③段「还款流程」（分册 6.6.0 · F-LS-77 / D-RP-77 / D-RP-78 / D-RP-73 / D-RP-67）----
   **本模块只拥有第③段**（D-RP-77）：三段式操作区的容器规范属 WS-324 主册 6.5.5，
   ①全局操作归 WS-324、②融资流程四环节跨 WS-325 / WS-326，本模块一律引用、不重新定义。
   本段要做到的三件事：
     ① **独立成块**——自己的区块标题、与②之间有明确分隔，不与②的环节条混排、不共用②的高亮态；
     ② **业务未进 S-FD-6 时整段不渲染**（不是空块、不是占位）——空块会被读成"还款流程坏了"，
        而此刻正确的事实是"还没走到这一步"；
     ③ **一个编号选择器，不是两个切换器**（D-RP-78）——本期 FP-28 → FD-01 → LN-01 恒为 1:1:1，
        两个编号是同一笔业务的两种叫法，做成两级筛选是错的。
   ⚠️ 本段的标签**只出业务名称、不出 RP- 与 LN- 这类内部字段编号**（AC-RP-28 ④）：
   字段号是原型的标注约定，不是界面规格。 */
function section3(d, demands, gp){
  var guest = (S.role === 'guest');

  /* ---- 编号选择器：一个。主标识 FP-28，副行并排 FD-01 与 LN-01，按任一编号可检索 ---- */
  var kw = (S.find || '').trim().toUpperCase();
  var hit = function(x){
    return !kw || x.fp.toUpperCase().indexOf(kw) >= 0 || x.id.toUpperCase().indexOf(kw) >= 0 ||
           lnNo(x).toUpperCase().indexOf(kw) >= 0;
  };
  var shown = demands.filter(hit);
  var picker = '';
  if(demands.length > 1){
    picker =
      '<div class="rp-pick">' +
      '<div class="ph"><span class="lb">' + L('Select by ID','按编号选择') + '</span>' +
        '<input class="inp sm" type="text" value="' + E(S.find || '') + '" data-act="rp.f" data-v="find" ' +
        /* data-f 是公共壳层自带的焦点恢复键：重绘前记下它、重绘后把焦点与光标位置放回去。
           检索要边打边筛，每次输入都会重绘，没有它就会输一个字符跳一次焦点。 */
        'data-f="find" placeholder="' + E(L('demand / deal / disbursement ID','需求 / 业务 / 放款编号')) + '"></div>' +
      (shown.length ? shown.map(function(x){
        return '<button class="rp-po" type="button" data-act="rp.demand" data-v="' + x.id + '" ' +
          'aria-pressed="' + (x.id === d.id) + '">' +
          '<span class="pb"><span class="p1">' + E(x.fp) + '</span>' +
          '<span class="p2">' + E(x.id) + '　·　' + E(lnNo(x)) + '</span>' +
          '<span class="p3">' + E(funderOf(x)) + '</span></span>' +
          '<span class="pa">' + amt(x.amt) + ' ' + x.ccy + '</span></button>';
      }).join('') :
        '<div class="pe">' + L('No financing deal matches that ID.','没有匹配该编号的融资业务。') + '</div>') +
      '<p class="px">' +
        L('One selector, not two filters: a demand carries at most one closed deal, and a deal carries at ' +
          'most one valid disbursement record, so the demand ID, the deal ID and the disbursement ID are ' +
          '<b>one-to-one-to-one</b> here — two of them would be the same thing twice. Searching by any of ' +
          'the three lands on the same option.',
          '一个选择器，不是两级筛选：一条需求至多一笔成交业务、一笔业务至多一条有效放款记录，' +
          '因此需求编号、融资业务编号与放款记录编号在还款段内<b>恒为 1:1:1</b>——' +
          '做成两个切换器等于把同一件事筛两遍。按三个编号中的任意一个检索，命中的都是同一个选项。') +
      '</p></div>';
  } else if(demands.length === 1){
    /* 只有一笔时仍展示编号、但不展示选择控件——没得选就别给控件 */
    picker = '<div class="rp-pick one"><div class="pb"><span class="p1">' + E(d.fp) + '</span>' +
      '<span class="p2">' + E(d.id) + '　·　' + E(lnNo(d)) + '</span>' +
      '<span class="p3">' + E(funderOf(d)) + '</span></div></div>';
  }

  if(guest){
    /* D-RP-67：未登录时本段**只出「立即登录」一个入口**——连编号选择器也不出，
       否则本段就不止一个可点的东西了。服务端鉴权与跨主体隔离一条不减（AC-LS-86）。 */
    return '<div class="rp-seg3">' +
      '<div class="fa" style="margin:0"><button class="btn sm primary" type="button" data-act="rp.signin">' +
      g('signIn') + '</button>' +
      '<p class="hint" style="margin:7px 0 0">' +
      L('The repayment schedule\u2019s public fields stay visible without signing in — instalment count, ' +
        'due dates, amounts due, instalment status, overdue marks and days. Only the actions need an ' +
        'account, so this section shows <b>one</b> entry rather than greying out each action with its own ' +
        'reason.',
        '还款计划的公开字段不登录也看得到——期次数、应还日、应还本息与合计、期次状态、逾期标记与天数。' +
        '需要账号的只是操作，因此本段只出<b>一个</b>入口，不再逐动作 ⊘ + 独立原因（D-RP-67）。') +
      '</p></div></div>';
  }

  /* ---- 最近一笔应还卡片：第③段唯一的数据卡，其余信息进抽屉 ---- */
  var focus = gp.await2 || gp.next || gp.plan[gp.plan.length - 1];
  var core = '';
  if(d.planReady && focus){
    var fs = pState(d, focus);
    core = '<div class="core">' +
      '<div class="r"><s>' + g('instalment') + '</s><b>#' + focus.seq + ' / ' + gp.n + '</b></div>' +
      '<div class="r"><s>' + g('dueDate') + '</s><b>' + focus.due + '</b></div>' +
      '<div class="r"><s>' + g('dueTotal') + '</s><b>' + usd(focus.total) +
        '<span class="sc">' + amt(focus.settle) + ' ' + d.ccy + '</span></b></div>' +
      '<div class="r"><s>' + L('Instalment status','期次状态') + '</s><b class="txt">' +
        pill(TONE[RP_ST[fs.st][1]] || 'gray', txt(RP_ST[fs.st][0])) + '</b></div>' +
      /* 逾期天数：中性样式；标签只出业务名称、不带字段号（AC-RP-28 ④） */
      (fs.overdue ? '<div class="r"><s>' + L('Days overdue','逾期天数') + '</s><b>' + fs.odDays +
        (fs.frozen ? L(' · frozen',' · 已冻结') : '') + '</b></div>' : '') +
    '</div>';
  }

  /* ---- 三个入口。D-RP-73：动作按钮只在 S-FD-6 时出现；进 S-FD-8 后只剩查看 ---- */
  var btns = '';
  if(d.planReady && focus){
    if(!gp.settled){
      if(S.role === 'asset'){
        var ra = repayAction(d, gp.next || focus);
        btns += ra.enabled
          ? '<button class="btn sm primary" type="button" data-act="rp.open" data-v="repay">' +
            E(ra.label) + '</button>'
          : blockedBtn(ra, 'sm');
      }
      if(S.role === 'fund' && gp.await2){
        var ca = confirmAction(d, gp.await2);
        btns += ca.enabled
          ? '<button class="btn sm primary" type="button" data-act="rp.open" data-v="confirm">' +
            E(ca.label) + '</button>'
          : (ca.absent ? '' : blockedBtn(ca, 'sm'));
      }
    }
    btns += '<button class="btn sm" type="button" data-act="rp.open" data-v="schedule">' +
      g('viewSchedule') + '</button>';
  }

  return '<div class="rp-seg3">' + picker + core +
    (btns ? '<div class="fa" style="margin:11px 0 0">' + btns + '</div>' : '') +
    (gp.settled ? '<p class="hint" style="margin:8px 0 0">' +
      L('This deal is settled, so only the read-only schedule view remains in this section — the two ' +
        'action buttons are gone for good.',
        '本笔业务已结清，本段<b>只保留只读的「查看还款计划」</b>，两个动作按钮一律不再出现（D-RP-73）。') +
      '</p>' : '') +
    (!d.planReady ? '<p class="hint" style="margin:8px 0 0">' +
      L('The schedule is still being generated, so this section carries no action yet.',
        '还款计划仍在生成，本段暂不出动作按钮。') + '</p>' : '') +
    '</div>';
}


/* ================================================================
   Part E —— 承载单元①：P-LS-09 还款录入（资产方，右侧抽屉 760px）
   编号保留，语义是「承载单元」而不是页面（D-RP-71）。字段、校验、文案与验收原样成立。
   ================================================================ */

/* 期次选择器（D-RP-21 ~ D-RP-26 / 6.6.2）。候选**跨融资业务、跨融资项目**。
   ⚠️ 换选期次是可逆的、零后果：**就地切换，不为此再开一层**（D-RP-76）。 */
function selector(cur){
  var list = candidates(), od = [], due = [], locked = [];
  list.forEach(function(c){
    if(c.s.overdue) od.push(c); else if(c.s.opened) due.push(c); else locked.push(c);
  });
  var outside = null, inSet = false;
  if(cur){
    list.forEach(function(c){ if(c.d.id === S.deal && c.p.seq === cur.seq) inSet = true; });
    if(!inSet){ var dd = curDeal(); outside = { d:dd, p:cur, s:pState(dd, cur) }; }
  }
  var idx = 0;
  function opt(c, disabled){
    idx++;
    var on = (c.d.id === S.deal && cur && c.p.seq === cur.seq);
    var a = repayAction(c.d, c.p);
    return '<button class="rp-opt" type="button" ' +
      (disabled ? 'aria-disabled="true" data-act="rp.whySeq" data-v="' + c.d.id + ':' + c.p.seq + '"'
                : 'data-act="rp.pick" data-v="' + c.d.id + ':' + c.p.seq + '"') +
      ' aria-pressed="' + !!on + '">' +
      '<span class="ix">' + (disabled ? '⊘' : idx) + '</span>' +
      '<span class="ob"><span class="o1"><span class="dt">' + c.p.due + '</span>' +
        '<span class="dl">#' + c.p.seq + ' / ' + finalPlan(c.d).length +
        (c.p.last ? L(' · incl. principal',' · 含本金') : L(' · interest only',' · 利息期')) + '</span>' +
        (c.s.overdue ? pill('gray', L('overdue ' + c.s.odDays + ' d','已逾期 ' + c.s.odDays + ' 天')) : '') +
        (!c.s.opened ? '<span class="pill dash">' + L('window closed','未开窗') + '</span>' : '') + '</span>' +
        '<span class="o2">' + E(txt(c.d.pname)) + ' · ' + g('demandNo') + ' <span class="key">' + c.d.fp + '</span>' +
        L(' · sort keys: due ',' · 排序键：应还日 ') + '<span class="key">' + c.p.due + '</span>' +
        L(' → disbursed ',' → 实际放款日 ') + '<span class="key">' + c.d.ln06 + '</span>' +
        L(' → deal ',' → 业务编号 ') + '<span class="key">' + c.d.id + '</span>' +
        (disabled ? '<br>' + E(a.brief) + ' — ' + E(a.reason) : '') + '</span></span>' +
      '<span class="oa">' + amt(c.p.total) + ' ' + CCY +
        '<span class="oc">' + amt(c.p.settle) + ' ' + c.d.ccy + '</span></span>' +
      (disabled ? '<span class="blk" aria-hidden="true">⊘</span>' : '') + '</button>';
  }
  function grp(title, arr, note, disabled){
    if(!arr.length) return '';
    return '<div class="rp-grp"><div class="gh">' + E(title) +
      '<span class="n">' + arr.length + L(' instalments',' 期') + (note ? ' · ' + E(note) : '') + '</span></div>' +
      arr.map(function(c){ return opt(c, disabled); }).join('') + '</div>';
  }
  return '<div class="rp-sel">' +
    grp(L('Overdue','已逾期'), od, L('always first','排在最上方分组'), false) +
    grp(L('Due · window open','待还款 · 已开窗'), due, L('due date ascending','应还日升序'), false) +
    grp(L('Due · window not open (visible, not selectable)','待还款 · 未开窗（可见不可选）'),
        locked, L('opening date shown','附开启日期'), true) +
    (outside ? '<div class="rp-grp"><div class="gh">' +
        L('Currently viewing · no repayment action','当前查看 · 无可执行的还款动作') +
        '<span class="n">1</span></div>' + opt(outside, true) + '</div>' : '') +
    (!list.length && !outside ? '<div class="tbl-empty"><b>' +
      L('No instalment is awaiting payment','当前没有待还款的期次') + '</b>' +
      L('Every instalment across your deals has been submitted or settled.',
        '名下所有融资业务的期次都已提交或已结清。') + '</div>' : '') +
    '</div>' +
    '<p class="hint" style="margin-top:9px">' +
      L('<b>The first row after sorting is selected by default</b>; you may switch to any instalment ' +
        'whose window is open. Sort keys compare in order: ① due date ascending → ② the deal’s ' +
        '<b>actual disbursement date</b> (LN-06 submission time) ascending → ③ deal ID ascending → ' +
        '④ instalment number ascending.<br><b>Overdue necessarily sorts above not-yet-due</b>: an overdue ' +
        'instalment has an earlier due date, so ascending order puts it first. Sorting by "closest to ' +
        'today" in absolute terms would put tomorrow’s instalment ahead of one 30 days overdue, and the ' +
        'asset owner would pay the new debt while the old one keeps running — that is exactly what this ' +
        'ordering blocks.<br><b>Instalments whose window has not opened stay visible rather than hidden</b>: ' +
        'hiding them would make the schedule look short a few instalments.',
        '<b>默认选中排序后的第一条</b>，您可以改选任何一个<b>已开窗</b>的期次。' +
        '排序键按序比较：① 应还日升序 → ② 该期次所属业务的<b>实际放款日</b>（LN-06 放款记录提交时间）升序 ' +
        '→ ③ 融资业务编号升序 → ④ 期次序号升序。<br>' +
        '<b>逾期的必然排在未到期的前面</b>：逾期期次的应还日必然更早，按应还日升序排它天然在前。' +
        '按"距今最近"取绝对值排序会把明天到期的排在逾期 30 天的前面，资产方就会先还新账、旧账一直滚——' +
        '那正是这条排序要挡住的（D-RP-24）。<br>' +
        '<b>未开窗的可见但不可选，不隐藏</b>：隐藏会让资产方以为计划少了几期。') + '</p>';
}

/* 五个拦截点（6.2.2 / D-RP-25 / AC-RP-07） */
function stopCards(p){
  var items = [
    ['1', L('The window opens per instalment','入口按期次逐个开窗'),
     L('RP-15 = <b>' + OPEN_DAYS + ' calendar days before the due date, 00:00</b>, and stays open until ' +
       'the instalment settles. Instalments not yet open are <b>visible but ⊘</b> in the selector above, ' +
       'with the reason and the opening date. Opening instalment N does <b>not</b> open N+1.',
       '开启时间 <b>RP-15 ＝ 应还日前 ' + OPEN_DAYS + ' 个自然日 00:00</b>，开启后一直保持开启直到该期结清。' +
       '未开窗的期次在上面的选择器里<b>可见但 ⊘</b>，附原因与开启日期。' +
       '第 N 期开窗<b>不会</b>让第 N+1 期跟着开。')],
    ['2', L('One instalment per submission','一次只能提交一个期次'),
     L('The form binds a single instalment: <b>no multi-select, no "select all"</b>. What this really ' +
       'blocks is skipping ahead and merging instalments.',
       '本表单<b>绑定单个期次</b>：<b>不存在多选框、不存在"全选"</b>。' +
       '真正被挡住的是跳期还款与多期合并提交。')],
    ['3', L('The amount is read-only','金额只读'),
     L('RM-04 is <b>read-only and equal to</b> this instalment’s RP-08 total due' +
       (p ? ' (<b>' + usd(p.total) + '</b>)' : '') + '. The same rule blocks <b>partial</b> and ' +
       '<b>excess</b> repayment. There is no input in the amount block below — it is a read value.',
       'RM-04 <b>只读等于</b>该期 RP-08 应还合计' + (p ? '（<b>' + usd(p.total) + '</b>）' : '') +
       '，<b>不可编辑</b>。这一条同时挡住了<b>部分还款</b>与<b>超额还款</b>。' +
       '下方金额区没有 input，是只读读值。')],
    ['4', L('No early-settlement entry','没有提前结清入口'),
     L('This drawer carries no button or copy offering to settle early, pay off in one go, or repay ' +
       'principal ahead of schedule. Principal is only repaid after the financing project matures.',
       '本抽屉<b>不存在</b>任何提供提前结清、一次性还清或提前还本的按钮与文案。' +
       '还本金只发生在融资项目到期之后（X-LS-06）。')],
    ['5', L('Server-side final check','服务端终检'),
     L('On submit the server <b>re-evaluates</b> whether the window is open, whether the instalment is ' +
       'still S-RP-1, and whether it belongs to you. <b>A front-end ⊘ or a hidden row is not a check</b>.',
       '提交时服务端<b>重新判定</b>该期是否已开窗、是否仍为 S-RP-1、是否为本人名下。' +
       '<b>前端的 ⊘ 与隐藏均不构成校验</b>（E-RP-03）。')]
  ];
  return '<div class="rp-stop">' + items.map(function(x){
    return '<div class="s"><div class="sn"><i>' + x[0] + '</i>' + x[1] + '</div>' +
      '<div class="sx">' + x[2] + '</div></div>';
  }).join('') + '</div>' +
  '<p class="hint" style="margin-top:10px">' +
    L('<b>Why opening ' + OPEN_DAYS + ' days early is not early repayment</b>: ① the amount is unchanged — ' +
      'RM-04 equals the full instalment; ② it is economically identical — each instalment’s interest ' +
      'was fixed when the schedule was finalised and is not recomputed per day, so submitting ' +
      OPEN_DAYS + ' days early <b>saves nothing</b> and the asset owner has no incentive to; ③ it moves ' +
      'no other instalment.<br><b>Why not open only on the due date</b>: a cross-border wire usually takes ' +
      '1–3 business days to land and a stablecoin transfer waits for confirmations; allowing the payment ' +
      'to start only on the due date would demand a same-day cross-border settlement, while the overdue ' +
      'test fires at 00:00 the next day.',
      '<b>为什么提前 ' + OPEN_DAYS + ' 天开窗不构成"提前还款"</b>：' +
      '① 金额一分不少——RM-04 只读等于本期应还合计；' +
      '② 经济上完全等价——每期利息在定稿时已固定、不按日重算，提前 ' + OPEN_DAYS +
      ' 天提交<b>不会少付一分钱利息</b>，资产方没有任何提前的动机；' +
      '③ 动不了别的期——开窗是逐期的。<br>' +
      '<b>为什么不是"到期日当天才开"</b>：跨境电汇到账普遍需要 1～3 个工作日，数币转账也要等区块确认；' +
      '当天才允许发起就等于要求当天完成跨境支付，而逾期判定在次日 00:00（D-RP-27）。' +
      '') +
  '</p>';
}

function formState(d, p){
  var f = S.f, fiat = isFiat(d);
  var given = (f.given || '').trim();
  var givenOk = !!given && tmin(given) <= tmin(NOW);
  var hOk = fiat ? true : hashOk(f.hash);
  var filesOk = fiat ? (f.files.length >= FIAT_MIN_N && f.files.length <= FIAT_MAX_N) : true;
  return { fiat:fiat, given:given, givenOk:givenOk, hash:(f.hash || '').trim(), hashOk:hOk,
           filesOk:filesOk, ok:givenOk && hOk && filesOk };
}

function drawerRepay(){
  var d = curDeal(), p = curPeriod();
  if(!p) return '';
  var s = pState(d, p), a = repayAction(d, p), v = formState(d, p), gp = progress(d);

  /* 本期应还信息（精简）。D-RP-79 的四条下限中的两条在这里：
     ② 本期应还合计与结算金额、③ 期次序号与应还日；④ 逾期时的天数与「提交后即冻结」那句话。
     ⚠️ 标签只出业务名称，不出内部字段编号（AC-RP-28 ④）。 */
  var planInfo = '<div class="ls-kgrid">' +
    '<div><div class="k">' + g('instalment') + '</div><div class="v">#' + p.seq + ' / ' + gp.n + '</div>' +
      '<div class="x">' + (p.last ? L('final · incl. principal','末期 · 含本金') : L('interest only','利息期')) + '</div></div>' +
    '<div><div class="k">' + g('dueDate') + '</div><div class="v">' + p.due + '</div></div>' +
    '<div><div class="k">' + g('dueTotal') + '</div><div class="v">' + amt(p.total) + ' ' + CCY + '</div>' +
      '<div class="x">' + L('settlement ','结算 ') + amt(p.settle) + ' ' + d.ccy + '</div></div>' +
    '<div><div class="k">' + L('Instalment status','期次状态') + '</div>' +
      '<div class="v txt">' + pill(TONE[RP_ST[s.st][1]] || 'gray', txt(RP_ST[s.st][0])) + '</div></div>' +
  '</div>' +
  /* D-RP-79 ④：逾期天数与「提交后即冻结」——D-FIN-11 的界面形态，精简掉等于取消这条保护 */
  (s.overdue && s.st === 'S-RP-1' ? CF.note('',
    L('This instalment is <b class="ls-b">' + s.odDays + '</b> days overdue. <b class="ls-b">Submitting a ' +
      'repayment record freezes that number</b> — it does not grow afterwards, however long the funder ' +
      'takes to confirm. Overdue carries <b class="ls-b">no monetary consequence</b> this round: no ' +
      'penalty interest, and the amount due does not change by a cent.',
      '该期已逾期 <b class="ls-b">' + s.odDays + '</b> 天。<b class="ls-b">提交还款记录后逾期天数即冻结</b>，' +
      '此后不再增加——机构什么时候点确认，都不会让这个数继续涨。' +
      '本期逾期<b class="ls-b">不产生任何金额后果</b>：不计罚息、应还金额一分不变。'),
    L('About those ' + s.odDays + ' days','关于这 ' + s.odDays + ' 天')) : '') +
  /* 移走的那部分，给一个一键可达的去处（D-RP-79：不得只写「不展示」） */
  '<p class="hint" style="margin-top:12px">' +
    L('The full schedule, the accrual-rule text and this instalment\u2019s principal / interest split live ' +
      'in ', '完整还款计划、计息规则全文与本期的本息拆分、计息区间在 ') +
    '<button class="btn-link" type="button" data-act="rp.open" data-v="schedule">' +
    L('View repayment schedule','查看完整还款计划') + '</button>' +
    L('. Opening it closes this drawer (one layer at a time); coming back returns you to this instalment.',
      '。打开它会关掉本抽屉（同一时刻只有一层），返回时回到本期次。') + '</p>';


  /* 还款表单 */
  var form =
    field(g('repayType') === '' ? '' : L('Repayment currency · RM-03','还款币种 · RM-03'), L('read-only','只读'),
      ro(d.ccy + (isFiat(d) ? L(' (fiat)','（法币）') : L(' (stablecoin · ERC-20)','（数字货币 · ERC-20）')),
         L('Always equal to QT-02 fixed at quote time; <b>cannot be swapped</b> — swapping the currency ' +
           'would change the commercial terms.',
           '恒等于报价时确定的 <b>QT-02</b>，<b>不可临时更换</b>——换币种等于改商务条款。'))) +
    field(L('Repayment amount · RM-04','还款金额 · RM-04'), L('read-only','只读'),
      ro(usd(p.total) + '　(' + amt(p.settle) + ' ' + d.ccy + ')',
         L('<b>Read-only and equal to</b> this instalment’s RP-08: principal ' + amt(p.principal) +
           ' + interest ' + amt(p.interest) + '. The settlement amount converts at the <b>FX snapshot ' +
           'locked at quote time (' + d.fx.v.toFixed(4) + ')</b>; <b>the rate is never re-fetched at ' +
           'repayment</b>. Partial and excess repayment are both out of scope.',
           '<b>只读等于该期 RP-08 应还合计</b>：本金 ' + amt(p.principal) + ' + 利息 ' + amt(p.interest) +
           '。结算金额按<b>报价时锁定的汇率快照 ' + d.fx.v.toFixed(4) +
           '</b> 折算，<b>还款时不重新取汇率</b>（D-FIN-80）。本期不支持部分还款与超额还款。'))) +
    field(g('repaidAt') + ' · RM-05', L('required · may be in the past, never in the future','必填 · 可填过去、不得晚于提交时刻'),
      inp('given', S.f.given, '2026-12-18 09:30', { err:!!S.f.given && !v.givenOk }),
      (!!S.f.given && !v.givenOk
        ? '<span style="color:var(--danger)">' +
          L('The repayment time is later than the submission instant; the server will reject it. ' +
            '<b>The past is fine, the future is not</b> — a future repayment time means the money has ' +
            'not left yet.',
            '还款时间晚于提交时刻，服务端将拒绝提交（E-RP-07）。' +
            '<b>时间可以填过去，不能填未来</b>——未来的还款时间意味着钱还没打。') + '</span>'
        : L('Format <span class="mono">YYYY-MM-DD HH:MM</span> (' + TZ + '). <b>For reconciliation only; ' +
            'no deadline or interest calculation uses it</b> — the overdue freeze point and the start of ' +
            'the confirmation window both take the server-recorded submission time RM-06.',
            '格式 <span class="mono">YYYY-MM-DD HH:MM</span>（' + TZ + '）。' +
            '<b>仅作对账参考，时效与计息不使用该时间</b>：逾期冻结点与还款确认时限起点一律取' +
            '服务端记录的提交时间 RM-06（D-FIN-21）。')));

  if(isFiat(d)){
    form += field(g('proofFiat') + ' · RM-07',
      L('required · ' + FIAT_MIN_N + '–' + FIAT_MAX_N + ' files','必传 · ' + FIAT_MIN_N + '～' + FIAT_MAX_N + ' 个'),
      '<div class="drop" role="button" tabindex="0" data-act="rp.upload" data-v="file">' +
        '<div class="ic" aria-hidden="true">↑</div><div><b>' +
        L('Click to upload the bank payment proof','点击上传银行支付凭证') + '</b>' +
        '<div class="hint" style="margin-top:3px">PDF / JPG / PNG · ≤ ' + FILE_MAX_MB + ' MB · ' +
        FIAT_MIN_N + '–' + FIAT_MAX_N + L(' files · identical to the disbursement side, not a second baseline',
                                          ' 个 · 与放款侧 LN-07 完全一致、不另定一套') + '</div></div></div>' +
      (S.f.upErr ? '<div style="margin-top:10px">' + CF.note('red', S.f.upErr,
        L('Proof rejected','凭证未通过')) + '</div>' : '') +
      (S.f.files.length ? '<div style="margin-top:10px">' + S.f.files.map(function(fl, i){
        return '<div class="filecard" style="margin-top:8px"><div class="ic" aria-hidden="true">▤</div>' +
          '<div class="bd"><b>' + E(L(fl[0], fl[1])) + '</b><span>' + E(fl[2]) + '</span></div>' +
          '<div class="act"><button class="btn sm" type="button" data-act="rp.rmFile" data-v="' + i + '">' +
          L('Remove','移除') + '</button></div></div>';
      }).join('') + '</div>' : ''),
      L('<b>The platform does not audit authenticity</b> — only format, size and count are checked. ' +
        'Proof files are <b>not public</b>; only the two parties of this deal can see them.',
        '<b>平台不审核真伪</b>：只校验格式、大小与数量。凭证<b>不公开</b>，仅该笔业务双方可见（D-RP-41）。'));
  } else {
    form += field(g('txHash') + ' · RM-08', L('required · format check only','必填 · 只做格式校验'),
      inp('hash', S.f.hash, '0x + 64 hex', { err:!!S.f.hash && !v.hashOk }),
      (!!S.f.hash && !v.hashOk
        ? '<span style="color:var(--danger)">' +
          L('Invalid format: must be <span class="mono">0x</span> + 64 hexadecimal characters. ' +
            '<b>The platform will never tell you the transaction does not exist</b> — it has no way to know.',
            '格式不合法：须为 <span class="mono">0x</span> + 64 位十六进制。' +
            '<b>平台不会提示"该交易不存在"</b>——它没有这个判断能力（E-RP-04）。') + '</span>'
        : L('<b>Format check only, never verified on chain.</b> After submission the drawer shows a block ' +
            'explorer link with a standing note that the platform has not verified the transaction.',
            '<b>只做格式校验、不做链上核验</b>（D-RP-42）。提交后给出区块浏览器链接，' +
            '旁边常驻「平台未核验该交易，链接仅供自行查验」。'))) +
    /* RM-09：常量 ETH，**只展示、不录入、不给任何选择控件** */
    field(g('chainLbl') + ' · RM-09', L('system constant · display only','系统常量 · 只展示'),
      ro(CHAIN,
         L('The chain is the <b>system constant ' + CHAIN + '</b> this round: <b>display only, never an ' +
           'input, and this drawer offers no chain selector of any kind</b>. USDT / USDC are ERC-20. ' +
           'Should multi-chain return, the rule goes back to "read-only, must equal the payee address’ ' +
           'chain, rejected if different" — <b>that path is unreachable this round</b>.',
           '链是<b>本期系统常量 ' + CHAIN + '</b>：<b>只展示、不录入，本抽屉不给任何选择控件</b>。' +
           'USDT / USDC 即 ERC-20。多链恢复时才回到"只读带出、必须等于机构收款地址的链、不一致拒绝"' +
           '——<b>那条路径本期不可达</b>（E-RP-05）。'))) +
    field(L('Supporting material · RM-12','补充材料 · RM-12'),
      L('optional · ≤ ' + EXTRA_MAX_N + ' files','选填 · ≤ ' + EXTRA_MAX_N + ' 个'),
      '<div class="drop" role="button" tabindex="0" data-act="rp.upload" data-v="extra">' +
        '<div class="ic" aria-hidden="true">↑</div><div><b>' +
        L('Click to upload supporting material','点击上传补充材料') + '</b>' +
        '<div class="hint" style="margin-top:3px">' +
        L('e.g. a wallet transfer screenshot · PDF / JPG / PNG · ≤ ' + FILE_MAX_MB + ' MB',
          '如钱包转账截图 · PDF / JPG / PNG · 单文件 ≤ ' + FILE_MAX_MB + ' MB') + '</div></div></div>' +
      (S.f.extra.length ? '<div style="margin-top:10px">' + S.f.extra.map(function(fl, i){
        return '<div class="filecard" style="margin-top:8px"><div class="ic" aria-hidden="true">▤</div>' +
          '<div class="bd"><b>' + E(L(fl[0], fl[1])) + '</b><span>' + E(fl[2]) + '</span></div>' +
          '<div class="act"><button class="btn sm" type="button" data-act="rp.rmExtra" data-v="' + i + '">' +
          L('Remove','移除') + '</button></div></div>';
      }).join('') + '</div>' : ''),
      L('The fiat branch does not use this field — its proof goes to RM-07.',
        '法币分支不使用本字段（凭证走 RM-07）。'));
  }

  form += field(L('Repayment remark · RM-11','还款备注 · RM-11'),
    L('optional · ≤ ' + MEMO_MAX + ' chars','选填 · ≤ ' + MEMO_MAX + ' 字'),
    '<textarea class="inp" rows="3" maxlength="' + MEMO_MAX + '" data-act="rp.f" data-v="memo" placeholder="' +
    E(L('e.g. wired via the Shanghai branch; remitting and cable charges are on us, intermediary ' +
        'deductions as credited.',
        '例如：已通过上海分行电汇，汇出行手续费与电报费由我方承担，中转行扣费以入账为准。')) + '">' +
    E(S.f.memo || '') + '</textarea>',
    L('<b>Visible to the funder</b> — often the only place to explain fees, the branch used, or when the ' +
      'money should land. ' + (S.f.memo || '').trim().length + ' / ' + MEMO_MAX + ' characters. Remarks ' +
      'are <b>not public</b>.',
      '<b>对资金方可见</b>——它常常是解释手续费、分行、到账时间的唯一位置。已填 ' +
      (S.f.memo || '').trim().length + ' / ' + MEMO_MAX + ' 字。备注<b>不公开</b>。'));

  /* ---- V3.4 精简（分册 6.6.2 / D-RP-79）：只留四类，其余逐项写明去处 ----
     留下的：期次选择器 · 本期应还信息（精简）· 机构收款账户 · 填写项。
     移走的：完整计划表 / 计息规则全文 / 本息拆分与计息区间 → 「查看还款计划」抽屉（文字链一键可达）；
             跨业务期次全集 → 我的控制台；五个拦截点说明与两条轴示意 → **不进生产界面**，
             它们是 PRD 条款与原型说明件，界面上保留的只有它们的效果
             （未开窗 ⊘ + 原因、金额只读、逾期天数那句冻结提示）。
     ⚠️ 精简的是呈现，不是规则：校验与结算一条不少（AC-RP-31 ③）。 ---- */
  var body =
    sec(L('Choose the instalment to repay','选择要还的期次'),
        L('nearest due first · overdue on top','默认最近一笔应还 · 逾期排最前'),
        selector(p)) +
    sec(L('1 · This instalment','① 本期应还信息'), L('read-only','只读'), planInfo, true) +
    sec('2 · ' + g('payeeAcct'), L('registered at disbursement · read-only','放款时登记 · 只读'),
        payeeRo(d, true)) +
    sec(L('3 · What you fill in','③ 填写项'), '',
        (s.st === 'S-RP-1' && a.enabled ? form
          : (s.rec ? recordRead(d, p, true) : '<p class="hint" style="margin:0">' + E(a.reason) + '</p>'))) +
    sec('', '', mailCard(d, p, 'repay'), true) +
    sec('', '', annot(
      L('<b>Prototype note · what moved out and where it went (V3.4 simplification).</b> ' +
        'The full schedule, the accrual-rule text and the principal/interest split moved to the ' +
        '<b>View repayment schedule</b> drawer — reachable from the link above; instalments belonging to ' +
        'your other deals moved to the console. The five interception cards and the two-axis diagram are ' +
        '<b>not production UI at all</b>: they are PRD clauses and prototype explainers, kept on the ' +
        'detail page under "prototype explainers". What stays here is their <i>effect</i> — a window that ' +
        'is not open shows ⊘ with its reason, the amount is read-only, and the overdue line says the count ' +
        'freezes on submission. <b>Nothing was cut without a destination.</b><br>' +
        'This drawer also carries no: early settlement / pay-off-in-one-go / early principal entry; ' +
        'multi-select; editable amount; editable payee account; edit or withdraw of a submitted record; ' +
        '"verified on chain" badge; penalty-interest amount.',
        '<b>原型注解 · V3.4 精简：移走了什么、移到哪儿。</b>' +
        '完整还款计划表、计息规则全文、本息拆分与计息区间 → <b>「查看完整还款计划」抽屉</b>' +
        '（上方文字链一键可达）；其他融资业务的期次全集 → 我的控制台还款信息 tab。' +
        '五个拦截点说明与两条轴示意<b>不进生产界面</b>——它们是 PRD 条款与原型说明件，' +
        '已移到详情页的「原型说明件」区；界面上保留的只有它们的<b>效果</b>：' +
        '未开窗 ⊘ + 原因、金额只读、逾期天数那句「提交后即冻结」。<b>没有只砍不给去处的字段。</b><br>' +
        '本抽屉同样<b>不存在</b>：提前结清 / 一次性还清 / 提前还本入口、多选与"全选"、可编辑的金额框、' +
        '可编辑或可另填的机构收款账户、修改或撤回已提交还款记录的入口、' +
        '哈希旁的"已核验"标识、任何罚息金额。')));


  var canSubmit = (s.st === 'S-RP-1' && a.enabled && v.ok);
  var foot = '<div class="u-foot">' +
    '<button class="btn link" type="button" data-act="rp.open" data-v="schedule">' + g('viewSchedule') + '</button>' +
    '<span class="sp"></span>' +
    '<button class="btn" type="button" data-act="rp.close">' + L('Close','关闭') + '</button>' +
    (s.st === 'S-RP-1' && a.enabled
      ? '<button class="btn primary" type="button"' + (canSubmit ? '' : ' disabled') +
        ' data-act="rp.askSubmit">' + L('Submit repayment record','提交还款记录') + '</button>'
      : '') +
    /* 页脚注脚收为一行浅色（6.6.2）：它防的是「以为平台会代为转账」，成本一行、收益明确 */
    '<p class="note">' + L('This step performs no on-chain operation and consumes no gas — the transfer ' +
      'happens outside the platform.','本步骤不产生任何链上操作、不消耗 gas——转账发生在平台之外。') + '</p>' +
    (s.st === 'S-RP-1' && a.enabled && !v.ok ? '<p class="note">' +
      L('Complete the required fields first: ','补齐必填项后方可提交：') +
      (v.givenOk ? '' : L('repayment time missing or later than now; ','还款时间未填或晚于提交时刻；')) +
      (v.filesOk ? '' : L('bank payment proof needs ' + FIAT_MIN_N + '–' + FIAT_MAX_N + ' files; ',
                          '银行支付凭证需 ' + FIAT_MIN_N + '～' + FIAT_MAX_N + ' 个；')) +
      (v.hashOk ? '' : L('transaction hash format invalid.','交易哈希格式不合法。')) + '</p>' : '') +
  '</div>';

  return '<aside class="drawer u" role="dialog" aria-modal="true" aria-label="' + E(g('recordRepay')) + '">' +
    '<div class="drawer-h"><b>' + g('recordRepay') +
      '<span class="sb">' + d.fp + ' · ' + d.id + ' · #' + p.seq + '</span></b>' +
    '<button class="modal-x" type="button" data-act="rp.close" aria-label="' + L('Close','关闭') + '">✕</button></div>' +
    '<div class="drawer-b u-scroll">' + body + '</div>' + foot + '</aside>';
}

/* 还款记录的只读读值（还款抽屉里已提交时用，确认抽屉里复用） */
function recordRead(d, p, compactProof){
  var s = pState(d, p), rec = s.rec;
  return '<div class="ln-rec">' +
    '<div><div class="k">' + L('Record ID · RM-01','还款记录编号 · RM-01') + '</div>' +
      '<div class="v mono">' + rec.id + '</div></div>' +
    '<div><div class="k">' + L('Amount · RM-03 / RM-04','币种与金额 · RM-03 / RM-04') + '</div>' +
      '<div class="v mono">' + usd(p.total) + '</div>' +
      '<div class="x">' + amt(p.settle) + ' ' + d.ccy + L(' · read-only',' · 只读') + '</div></div>' +
  '</div>' +
  '<div style="margin-top:14px">' + timesPair(rec) + '</div>' +
  (isFiat(d)
    ? '<div style="margin-top:14px">' + (rec.files || []).map(function(fl){
        return '<div class="filecard"><div class="ic" aria-hidden="true">▤</div>' +
          '<div class="bd"><b>' + E(L(fl[0], fl[1])) + '</b><span>' + E(fl[2]) + '</span></div>' +
          '<div class="act"><button class="btn sm" type="button" data-act="rp.download">' +
          L('Preview','在线预览') + '</button></div></div>';
      }).join('') + '</div>'
    : '<div style="margin-top:14px">' + hashBlock(rec, !!compactProof) + '</div>') +
  (rec.memo && txt(rec.memo) ? '<div style="margin-top:14px">' +
    field(L('Repayment remark · RM-11','还款备注 · RM-11'), '',
      '<div class="ls-ro" style="min-height:auto;padding:10px 11px;font-family:var(--sans);' +
      'align-items:flex-start;line-height:1.6">' + E(txt(rec.memo)) + '</div>') + '</div>' : '');
}


/* ================================================================
   Part F —— 承载单元②：P-LS-10 还款确认（资金方，右侧抽屉 760px）
   ================================================================ */

/* 还款确认时限条（RM-15 ~ RM-17 / D-RP-51 ~ D-RP-54）。
   到点只提醒，状态、额度、权限、逾期天数一个不动，因此超期态走中性灰。 */
function windowBar(d, p){
  var s = pState(d, p), k = clock(d, p);
  if(!k.has || s.st === 'S-RP-3'){
    return '<div class="ln-cd"><div class="by">' + (s.st === 'S-RP-3'
      ? L('Settled on <b>' + withTz(s.rec.confirmAt) + '</b> (RM-18 / RP-17); the confirmation window ' +
          'stopped counting then.',
          '该期已于 <b>' + withTz(s.rec.confirmAt) + '</b> 确认结清（RM-18 / RP-17），还款确认时限已终止计时。')
      : L('No repayment record has been submitted yet, so the confirmation window <b>has not started</b> — ' +
          'it starts from the server-recorded submission time (RM-06).',
          '该期尚未提交还款记录，还款确认时限<b>尚未开始计时</b>——起算点是还款记录提交成功的服务端时间（RM-06）。')) +
      '</div></div>';
  }
  var total = CONFIRM_HOURS * 60, el = k.elapsedMin, rm = Math.max(0, total - el);
  return '<div class="ln-cd' + (k.over ? ' over' : (k.soon ? ' soon' : '')) + '">' +
    '<div class="by">' + (k.over
      ? L('<b>The repayment confirmation window elapsed ' + k.overDays + ' days ago.</b> The instalment ' +
          'status, both credit figures and every permission are <b>completely unchanged</b>; the asset ' +
          'owner’s overdue days remain <b>frozen</b>. The platform <b>will not auto-confirm</b> and ' +
          '<b>will not mark them late</b> for this.',
          '<b>已超过还款确认时限 ' + k.overDays + ' 天。</b>期次状态、两个额度量、双方权限' +
          '<b>一个都没有变</b>；资产方的逾期天数<b>仍然冻结</b>。平台<b>不会自动确认</b>，' +
          '也<b>不会因此判定对方逾期</b>。')
      : L('<b>Time left in the repayment confirmation window</b> (RM-16). It started at ' +
          withTz(s.rec.at) + ' (server-recorded submission time RM-06) and closes at <b>' +
          withTz(k.to) + '</b> — start + ' + CONFIRM_HOURS + ' hours, to the second.',
          '<b>剩余还款确认时限</b>（RM-16）。起算点 ' + withTz(s.rec.at) +
          '（还款记录提交成功的服务端时间 RM-06），到期时刻 <b>' + withTz(k.to) +
          '</b>（＝ 起算点 + ' + CONFIRM_HOURS + ' 小时，精确到秒）。')) + '</div>' +
    '<div class="big"><span class="v">' +
      (k.over ? L('elapsed ' + k.overDays + ' d','已超期 ' + k.overDays + ' 天') : fmtDur(k.leftMin)) + '</span>' +
      '<span class="u">' + (k.over ? L('· the action stays available','· 入口照常可用')
        : (k.soon ? L('· under ' + NEAR_HOURS + ' hours, now to the minute',
                      '· 不足 ' + NEAR_HOURS + ' 小时，已切分钟精度') : '')) + '</span></div>' +
    '<div class="bar"><span class="el" style="flex:' + el + '"></span>' +
      '<span class="rm" style="flex:' + Math.max(rm, 1) + '"></span></div>' +
    '<div class="scale"><span>' + L('elapsed ','已过 ') + '<b>' + fmtDur(el) + '</b></span>' +
      '<span>' + L('remaining ','剩余 ') + '<b>' + fmtDur(rm) + '</b></span></div>' +
    '<div class="ways">' +
      '<div class="w"><i aria-hidden="true">①</i><span>' +
        L('Expiry <b>sends one notice only</b>; it <b>does not change the status, does not count as ' +
          'confirmation, and steps no credit figure</b>. Auto-confirming would mean the platform ' +
          'asserting on your behalf that the money arrived — and on the repayment side it would also ' +
          'release <b>your own credit</b>.',
          '到期<b>只发一条通知</b>，<b>不自动改状态、不自动视为确认、不自动递减任何额度</b>（D-RP-53）。' +
          '自动确认等于平台替您承认"钱已收到"；在还款侧它还会直接递减<b>您的授信占用额</b>。') + '</span></div>' +
      '<div class="w"><i aria-hidden="true">②</i><span>' +
        L('Elapsing <b>changes no permission and no data</b>: this drawer stays usable, the action stays ' +
          'executable, the instalment stays in S-RP-2. It produces <b>one neutral mark</b> and <b>one ' +
          'notice</b>, never a recurring push.',
          '超期<b>不改变任何权限与任何数据</b>：本抽屉照常可用、确认动作照常可执行、期次仍是 S-RP-2' +
          '（D-RP-54）。超期只产生<b>一个中性展示标记</b>与<b>一次通知</b>，之后不再周期性推送。') + '</span></div>' +
      '<div class="w"><i aria-hidden="true">③</i><span>' +
        L('Two other ' + CONFIRM_HOURS + '-hour windows exist on this deal and each is named in full: ' +
          'the <b>quote validity period</b> binds the asset owner and <b>lapses automatically</b>; the ' +
          '<b>disbursement confirmation window</b> and this <b>repayment confirmation window</b> both ' +
          '<b>only remind</b>. Short forms would suggest the deal lapses if nobody confirms.',
          '同一笔业务上还有另外两个 ' + CONFIRM_HOURS + ' 小时，三者一律写全称：' +
          '<b>报价有效期</b>约束资产方处理报价，到点<b>自动失效</b>；' +
          '<b>放款确认时限</b>与本条<b>还款确认时限</b>到点<b>只提醒</b>。' +
          '写成简称会让人以为不确认就会自动作废（D-RP-33）。') + '</span></div>' +
    '</div></div>';
}

/* 两个额度量的递减牌（AC-FIN-36 / D-RP-36 / D-RP-37）。
   WS-326 四量转移牌的反向：**只有含本金的期次结清才递减**。 */
function decCard(d, p, done){
  var interestOnly = !p.principal;
  var bal = d.pool.bal, used = d.cr.used;
  var balA = interestOnly ? bal : round2(bal - p.principal);
  var usedA = interestOnly ? used : round2(used - p.principal);
  function qz(nm, before, after, x, changed){
    return '<div class="q ' + (changed ? 'in' : '') + '"><div class="nm">' + nm + '</div>' +
      '<div class="v">' + (changed ? '<s>' + amt(before) + '</s>' + amt(after) : amt(after)) + '</div>' +
      '<div class="x">' + x + '</div></div>';
  }
  return '<div class="ln-xfer' + (interestOnly ? ' still' : '') + '">' +
    '<div class="xh">' + (interestOnly
      ? L('Interest-only instalment: neither figure moves','利息期结清：两个量一动不动')
      : L('Final instalment (with principal): both figures step down equally','末期（含本金）结清：两个量等额递减')) +
      '<span class="at">' + (done ? L('effective ' + withTz(d.paid[p.seq].confirmAt),
                                      '已于 ' + withTz(d.paid[p.seq].confirmAt) + ' 生效')
                                  : L('within the same settlement as confirmation','确认完成的同一次结算内')) +
      '</span></div>' +
    '<div class="dim"><div class="dn">' + L('Project dimension · ','项目维度 · ') + E(d.pid) + '</div><div class="qr">' +
      qz(g('outstanding') + L(' (before)','（确认前）'), bal, bal, L('a sum of outstanding principal','未偿本金的合计'), false) +
      '<div class="ar" aria-hidden="true">' + (interestOnly ? '＝' : '→') + '</div>' +
      qz(g('outstanding') + L(' (after)','（确认后）'), bal, balA,
         interestOnly ? L('<b>unchanged</b> — interest is not principal','<b>不变</b>——利息不是本金')
                      : '−' + amt(p.principal), !interestOnly) +
    '</div></div>' +
    '<div class="dim"><div class="dn">' + L('Funder × asset owner dimension','机构 × 资产方维度') + '</div><div class="qr">' +
      qz(g('creditUsed') + L(' (before)','（确认前）'), used, used, L('a sum of outstanding principal','未偿本金的合计'), false) +
      '<div class="ar" aria-hidden="true">' + (interestOnly ? '＝' : '→') + '</div>' +
      qz(g('creditUsed') + L(' (after)','（确认后）'), used, usedA,
         interestOnly ? L('<b>unchanged</b> — interest is not principal','<b>不变</b>——利息不是本金')
                      : '−' + amt(p.principal) + L(' · available credit restored',' · 可用授信同额恢复'), !interestOnly) +
    '</div></div>' +
    '<div class="xf">' + (interestOnly
      ? L('<b>Stepped down by principal repaid, not by amount repaid.</b> Both figures are defined as sums ' +
          'of <b>outstanding principal</b>; interest is not part of them, so an interest-only instalment ' +
          'moves neither. <b>Counter-example</b>: stepping down by the total due (' + amt(p.total) + ') ' +
          'would release ' + amt(p.interest) + ' of credit out of thin air every time interest is paid, ' +
          'and the same pledge could fund another deal.',
          '<b>按已偿本金递减，不按已还金额递减。</b>项目融资余额与授信占用额的定义都是<b>未偿本金</b>的合计，' +
          '利息不在其中——因此利息期结清时两个量一动不动（D-RP-36）。' +
          '<b>反例</b>：按应还合计 ' + amt(p.total) + ' 递减，会让每还一期利息就凭空释放一次额度 ' +
          amt(p.interest) + '，资产方可以用同一份质押再融一笔。')
      : L('<b>Stepping down and settling take effect within one settlement</b>: instalment status, both ' +
          'figures, cumulative repaid, outstanding principal and (for the final instalment) the deal ' +
          'status either all succeed or none happens. <b>There is no "confirmed but credit not released" ' +
          'and no "credit released but instalment not settled" in between.</b><br>When the asset owner ' +
          'submits (S-RP-2) <b>neither figure moves</b> — only you know whether the money arrived; a ' +
          'submission is just a statement.',
          '<b>递减与结清在同一次结算内一致生效</b>：期次状态、两个量、累计已还、未偿本金、' +
          '业务状态（末期时）整体成功或整体不发生。' +
          '<b>不存在"已确认但额度未减"或"额度已减但期次未结清"的中间态</b>（AC-FIN-36 / E-RP-11）。<br>' +
          '资产方提交（S-RP-2）时两个量<b>一个都不动</b>——钱有没有到只有您知道，提交只是一次陈述（D-RP-37）。')) +
    '</div></div>';
}

/* 结清后的质押交接（5.7 / D-RP-39 / AC-RP-19 / D-FIN-49 / D-FIN-57）。
   ⚠️ 旧词根已按 WS-324 D-LS-17 改名裁定改掉：这里说的是「占用与**质押覆盖**」。 */
function pledgeHandoff(){
  return CF.note('',
    L('<b class="ls-b">This module releases no pledge.</b> It hands the single fact "this deal is ' +
      'settled" to the financing-demand module, which decides the <b class="ls-b">project terminal ' +
      'state</b> and performs the release in two stages.' +
      '<p>There is <b class="ls-b">no partial release</b> keyed to one deal settling: one asset pool may ' +
      'carry several financing deals, and one of them settling does not free the pool.</p>' +
      '<p>Once the project truly reaches its terminal state the release runs in two stages:<br>' +
      '<b class="ls-b">① Business release</b> — at that instant every commitment and pledge-coverage hold ' +
      'is lifted, the tokens move to "released · awaiting withdrawal" and stop counting toward any pool. ' +
      '<b class="ls-b">Immediate, no on-chain action, never blocked by an on-chain failure.</b><br>' +
      '<b class="ls-b">② On-chain withdrawal</b> — initiated by the asset owner, <b class="ls-b">gas paid ' +
      'by them</b>, batchable, no deadline, never fronted or surcharged by the platform. Tokens not yet ' +
      'withdrawn stay in the contract, belong to no pool and <b class="ls-b">cannot be pledged again</b> ' +
      'until withdrawn. <b class="ls-b">That stage has genuine on-chain failures</b>; its five failure ' +
      'states and gas wording live in the financing-demand module’s withdrawal flow, and are not ' +
      'duplicated here.</p>' +
      '<p><b class="ls-b">This drawer will not tell you the tokens return to your wallet automatically</b> ' +
      '— they do not; you have to withdraw them yourself.</p>',
      '<b class="ls-b">本模块不释放质押。</b>它只把「该笔业务已结清」这一事实交给融资需求与代币质押模块，' +
      '由它按 <b class="ls-b">D-FIN-49</b> 判定<b class="ls-b">项目终态</b>、再做两段式释放。' +
      '<p><b class="ls-b">不提供"某笔结清即释放对应代币"的部分释放</b>：' +
      '同一个资产池可能承载多笔融资业务，一笔结清不等于这个池子自由了。</p>' +
      '<p>项目真的进入终态之后，释放分两段：<br>' +
      '<b class="ls-b">① 业务释放</b>——进入终态同刻解除全部占用与<b class="ls-b">质押覆盖</b>、' +
      '代币置「已释放 · 待提取」、不再计入任何池。' +
      '<b class="ls-b">即时、无链上动作、不被链上失败阻塞</b>。<br>' +
      '<b class="ls-b">② 链上提取</b>——由资产方<b class="ls-b">自助发起、自付 gas</b>，可批量、无时限，' +
      '平台不代付不加收。未提取的代币留在合约内、不属于任何池、<b class="ls-b">不能再次质押</b>' +
      '（须先提回自己地址）。<b class="ls-b">这一段有真实的链上失败</b>，五类失败态与 gas 口径' +
      '在融资需求与代币质押模块的提取环节承载，本模块不复制一份。</p>' +
      '<p><b class="ls-b">本抽屉不会告诉您"结清后代币将自动回到您的钱包"</b>——它不会自动回来，' +
      '需要您自己去提（AC-RP-19）。</p>'),
    L('What happens to the pledge after settlement','结清之后，质押怎么办'));
}

function drawerConfirm(){
  var d = curDeal(), p = curPeriod();
  if(!p) return '';
  var s = pState(d, p);
  if(!s.rec) return '';
  var a = confirmAction(d, p), k = clock(d, p), gp = progress(d);
  var visible = (S.role === 'fund' || S.role === 'asset');
  var done = s.st === 'S-RP-3';
  var willSettle = p.last && gp.done === gp.n - 1;

  var marks = '';
  if(k.over && !done)
    marks += markRow(L('Confirmation window elapsed','已超过还款确认时限'),
      L('Elapsed <span class="day">' + k.overDays + '</span> days ago (window closed ' + withTz(s.limitAt) +
        '). <b>Instalment status, both credit figures and all permissions are unchanged</b>; the action ' +
        'stays available.',
        '已超过 <span class="day">' + k.overDays + '</span> 天（到期时刻 ' + withTz(s.limitAt) + '）。' +
        '<b>期次状态、两个额度量、双方权限一个都没有变</b>；确认入口照常可用。'),
      L('<b>The asset owner’s overdue days remain frozen at ' + s.odDays + '</b> and do not accrue ' +
        'because you have not confirmed yet.',
        '<b>资产方的逾期天数仍然冻结在 ' + s.odDays + ' 天</b>，不因您暂时不确认而继续累加（D-FIN-11）。'));
  if(s.overdue)
    marks += markRow(L('This instalment was late','对方该期曾逾期'),
      L('Due ' + p.due + '; the record was submitted at <b>' + s.rec.at + '</b>, so the overdue count ' +
        '<span class="day">' + s.odDays + '</span> <b>froze at submission</b>.',
        '第 ' + p.seq + ' 期应还日 ' + p.due + '，对方于 <b>' + s.rec.at + '</b> 提交还款记录，' +
        '逾期天数 <span class="day">' + s.odDays + '</span> 天<b>已在提交时刻冻结</b>。'),
      L('That number <b>will not grow again</b>. The platform <b>computes no penalty interest, shows no ' +
        'penalty amount and rolls nothing into the amount due</b> — a penalty rate is a commercial term ' +
        'and the platform does not hold it. Late payment’s economic consequence sits entirely in the ' +
        'offline contract this round.',
        '这个数<b>不会再涨</b>。平台<b>不计算罚息、不展示罚息金额、不把罚息并入应还金额</b>——' +
        '罚息率是商务条款，平台手里没有它（X-LS-45 / D-RP-46）。逾期的经济后果本期完全由线下合同承担。'));

  var planInfo = '<div class="ls-kgrid">' +
    '<div><div class="k">' + g('demandNo') + ' · FP-28</div><div class="v">' + d.fp + '</div></div>' +
    '<div><div class="k">' + g('planNoLbl') + ' · RP-01</div><div class="v">' + planNo(d, p) + '</div></div>' +
    '<div><div class="k">' + g('instalment') + '</div><div class="v">#' + p.seq + ' / ' + gp.n + '</div>' +
      '<div class="x">' + (p.last ? L('final · incl. principal','末期 · 含本金') : L('interest only','利息期')) + '</div></div>' +
    '<div><div class="k">' + g('dueDate') + '</div><div class="v">' + p.due + '</div></div>' +
    '<div><div class="k">' + g('accrualSpan') + '</div><div class="v">' + p.from + ' ~ ' + p.due + '</div>' +
      '<div class="x">' + p.days + L(' days · start counts, due date does not',' 天 · 算头不算尾') + '</div></div>' +
    '<div><div class="k">' + g('duePrincipal') + ' / ' + g('dueInterest') + '</div>' +
      '<div class="v">' + amt(p.principal) + ' / ' + amt(p.interest) + '</div>' +
      '<div class="x">' + amt(d.amt) + ' × ' + d.rate.toFixed(2) + '% × ' + p.days + ' ÷ ' + BASIS + '</div></div>' +
    '<div><div class="k">' + g('dueTotal') + '</div><div class="v">' + amt(p.total) + '</div>' +
      '<div class="x">' + CCY + '</div></div>' +
    /* AC-RP-09 的界面侧：逾期天数与冻结时刻**并列展示** */
    '<div><div class="k">' + L('Days overdue','逾期天数') + ' · RP-11</div>' +
      '<div class="v">' + s.odDays + '</div>' +
      '<div class="x">' + (s.overdue ? L('frozen at ' + s.frozenAt + ' · will not grow',
                                         '已于 ' + s.frozenAt + ' 冻结，不会再涨')
                                     : L('no overdue mark on this instalment','该期未触发逾期标记')) + '</div></div>' +
  '</div>';

  var actionArea = done
    ? CF.note('green',
        L('Settled on <b class="ls-b">' + withTz(s.rec.confirmAt) + '</b> (RM-18 / RP-17); the instalment ' +
          'is in S-RP-3.<p>Confirmation is <b class="ls-b">irreversible</b> — it states a fact rather than ' +
          'offering an option to change your mind. If it turns out to be wrong the only route is offline.</p>',
          '该期已于 <b class="ls-b">' + withTz(s.rec.confirmAt) + '</b> 确认收到还款（RM-18 / RP-17），' +
          '期次进入 <b class="ls-b">S-RP-3 已结清</b>。' +
          '<p>确认<b class="ls-b">不可撤销</b>：它是对事实的陈述，不是一个可以反悔的选项。' +
          '发现确认错了只能走线下。</p>'),
        L('Settled','已结清'))
    : (a.enabled
        ? CF.note('',
            L('<b class="ls-b">This drawer has exactly one action.</b> There is <b class="ls-b">no</b> ' +
              '"raise a dispute", "appeal", "reject" or "partial confirmation" — none of them exist this ' +
              'round.<p>If the amount is wrong, the proof is bad or no money arrived, the only thing you ' +
              'can do is <b class="ls-b">not confirm</b>, and use the support mailbox below. ' +
              '<b class="ls-b">Do not "confirm first and sort it out later"</b>: confirmation cannot be ' +
              'undone and it immediately ' + (p.principal ? 'releases ' + usd(p.principal) + ' of your credit'
                                                          : 'closes this instalment') + '.</p>' +
              '<p><b class="ls-b">Nor should you read the delay as the counterparty still running late</b>: ' +
              'their overdue days froze the instant they submitted and do not grow however long you take. ' +
              'That rule is the asset owner’s only protection this round — they cannot even raise a ' +
              'dispute.</p>',
              '<b class="ls-b">本抽屉只有「确认收到还款」一个动作。</b>' +
              '<b class="ls-b">不存在</b>「提出异议」「申诉」「驳回」「部分确认」等入口——本期不做（X-LS-42）。' +
              '<p>金额不符、凭证有问题、款根本没到时，您唯一能做的是<b class="ls-b">不点确认</b>，' +
              '并走下方客服邮箱与对方线下联系。<b class="ls-b">不要"先确认再说"</b>：' +
              '确认不可撤销，且会立刻' + (p.principal ? '释放您 ' + usd(p.principal) + ' 的授信占用额'
                                                      : '把这一期关掉') + '。</p>' +
              '<p><b class="ls-b">也不要因此认为对方在继续逾期</b>：他的逾期天数在提交那一刻就冻结了，' +
              '您拖多久都不会增加（D-FIN-11）。这条是本期资产方唯一的保护——因为他连异议都提不了。</p>'),
            L('About having exactly one action','关于「只有一个动作」'))
        : blockedBtn(a, ''));

  /* 始终不确认的后果：这是一条正常路径，不是风险提示（6.5.3 / D-RP-57） */
  var consequences = '<div class="rows" style="box-shadow:none">' +
    [[L('No backend can move this state','没有任何后台能推动这个状态'),
      L('The platform has <b>no auto-confirm, no auto-adjudication and no operator stand-in</b>. The ' +
        'instalment stays in <b>S-RP-2 indefinitely</b> until you come back and confirm.',
        '平台<b>没有任何自动确认、自动判定或运营代确认的能力</b>。期次会<b>永久停在 S-RP-2</b>，' +
        '直到您回到本抽屉点确认为止。')],
     [L('The deal cannot settle','这笔业务无法结清'),
      L('It cannot reach <b>S-FD-8</b>; <b>' + G.outstanding[0] + '</b> and <b>' + G.creditUsed[0] +
        '</b> are both held — the asset owner cannot refinance against that pledge and <b>your own credit ' +
        'does not come back either</b>.',
        '业务进不了 <b>S-FD-8 已结清</b>；<b>项目融资余额</b>与<b>授信占用额</b>双双被占住——' +
        '资产方不能用这份质押再融资，<b>您自己的额度也回不来</b>。')],
     [L('The pledge cannot be released','质押无法释放'),
      L('Release requires the <b>project terminal state</b>, and the project cannot reach it while a deal ' +
        'is unsettled — the asset owner’s tokens stay in the pledge contract.',
        '质押的释放要求<b>项目终态</b>（D-FIN-49），而业务不结清项目就到不了终态——' +
        '资产方的代币会一直留在质押合约里。')],
     [L('But their overdue days still do not grow','但对方的逾期天数不会继续增加'),
      L('<b>This does not change because of your inaction.</b> On the repayment side, when you do not ' +
        'confirm the party bearing the consequences is mainly the other one — you are merely late ' +
        'receiving a settlement record. <b>This rule exists precisely so that asymmetry does not land on ' +
        'them.</b>',
        '<b>这一条不因您的不作为而改变</b>（D-FIN-11）。还款侧您不确认时，承受后果的主要是对方' +
        '（业务无法结清、质押无法释放），而您只是晚点拿到结清凭证——' +
        '<b>这条红线正是为了不让这种不对称落到他头上</b>。')]
    ].map(function(r){
      return '<div class="row"><div class="row-main"><div class="row-k">' + r[0] + '</div>' +
        '<div class="row-v" style="color:var(--muted);font-size:11.5px;line-height:1.6">' + r[1] + '</div></div></div>';
    }).join('') + '</div>' +
    '<p class="hint" style="margin-top:10px">' +
    L('Once the two of you agree offline: <b>the platform performs no backend action</b>; you come back to ' +
      'this drawer and confirm, and the settlement runs <b>exactly as it would have on day one</b>.',
      '线下沟通达成一致之后：<b>平台没有任何后台动作</b>，由您回到本抽屉点「确认收到还款」，' +
      '走与没超期时<b>完全一致</b>的结算流程。') + '</p>';

  var body =
    sec(g('repayWindow'), L('RM-15 / RM-16 · absolute instant issued by the server','RM-15 / RM-16 · 服务端下发绝对时刻'),
        windowBar(d, p)) +
    (marks ? sec('', '', marks, true) : '') +
    sec(L('1 · The repayment record in full','① 还款记录全文'),
        L('RM-01 – RM-18 · symmetrical with the disbursement side','RM-01 ～ RM-18 · 与放款侧严格对称'),
        recordRead(d, p, false) +
        '<div style="margin-top:14px">' + payeeRo(d, visible) + '</div>') +
    sec(L('2 · Instalment details','② 本期计划信息'),
        L('to check the amount against your contract','供核对金额是否与合同一致'),
        planInfo + '<div style="margin-top:14px">' + ruleBar(d) + '</div>', true) +
    sec(L('3 · What this confirmation does','③ 确认这一下会发生什么'),
        L('AC-FIN-36 · atomic, no gap','AC-FIN-36 · 原子、无空档'),
        decCard(d, p, done) + (p.last ? '<div style="margin-top:14px">' + pledgeHandoff() + '</div>' : '')) +
    sec(L('Where the clock stops, and where the record ends','计息停止点与还款记录终结点'),
        'D-FIN-11 · D-RP-29', freezeCard(d, p), true) +
    sec(L('4 · What you can do now','④ 您现在能做什么'),
        L('X-LS-42 · exactly one action this round','X-LS-42 · 本期只有一个动作'),
        actionArea +
        '<p class="hint" style="margin-top:12px">' +
        L('If the asset owner says they paid and you say nothing arrived, <b>the platform does not judge ' +
          'who is right</b>: take it to the support mailbox. The same applies when cross-border charges ' +
          'make the received amount smaller than the amount due — there is no shortfall field this round ' +
          'and the amount is read-only. <b>In both cases the asset owner’s overdue days stay frozen.</b>',
          '<b>资产方声称已还、您声称未收到</b>时，平台<b>不判定谁对谁错</b>（E-RP-13）：走客服邮箱线下核实。' +
          '<b>跨境手续费导致实收少于应还</b>时同理（E-RP-14）——本期没有差额说明字段，金额只读；' +
          '<b>资产方的逾期天数在两种情形下都保持冻结</b>。') + '</p>' +
        noChain(['confirming a repayment','确认收到还款'])) +
    sec(L('If confirmation never comes','如果一直不确认会怎样'),
        L('D-RP-57 · the consequences must be spelled out','D-RP-57 · 后果必须写明'), consequences) +
    sec('', '', mailCard(d, p, 'confirm'), true) +
    sec('', '', annot(
      L('<b>Prototype note · what does not exist this round.</b> This drawer carries no: raise-a-dispute / ' +
        'appeal / reject / partial-confirmation entry; the S-RP-4 repayment-dispute status (unreachable ' +
        'this round, and no copy or filter is prepared for it); an operations adjudication desk; undo ' +
        'confirmation; edit or withdraw a repayment record; extending the confirmation window; ' +
        '"platform is intervening" or "we will handle it within X business days" promises; a ' +
        '"verified / confirmed on chain / valid transaction" badge; "audited by the platform" wording; ' +
        '"lapsing counts as confirmation" wording; any penalty amount or shortfall field.',
        '<b>原型注解 · 本期没有的东西。</b>本抽屉<b>不存在</b>：提出异议 / 申诉 / 驳回 / 部分确认入口、' +
        '<b>S-RP-4 还款异议处理中</b>状态（本期不可达，也不为它准备文案与筛选项）、运营端裁决台、' +
        '撤销确认、修改或撤回还款记录、延长还款确认时限、' +
        '"平台介入中""平台将在 X 个工作日内处理"一类承诺、' +
        '哈希旁的"已核验 / 已确认上链 / 交易有效"标识、凭证的"平台已审核"字样、' +
        '"逾期视为确认"一类措辞、任何罚息金额与差额说明字段。')));

  var foot = '<div class="u-foot">' +
    '<button class="btn link" type="button" data-act="rp.open" data-v="schedule">' + g('viewSchedule') + '</button>' +
    '<span class="sp"></span>' +
    '<button class="btn" type="button" data-act="rp.close">' + L('Close','关闭') + '</button>' +
    (!done && a.enabled
      ? '<button class="btn primary" type="button" data-act="rp.askConfirm">' + g('confirmRepay') + '</button>'
      : '') +
    (willSettle && !done ? '<p class="note">' +
      L('This is the last unsettled instalment — confirming settles the whole deal and releases ' +
        usd(p.principal) + ' of your credit.',
        '这是最后一个未结清期次——确认完成后本笔业务就此结清，您的授信占用额将等额释放 ' +
        usd(p.principal) + '。') + '</p>' : '') +
  '</div>';

  return '<aside class="drawer u" role="dialog" aria-modal="true" aria-label="' + E(g('confirmRepay')) + '">' +
    '<div class="drawer-h"><b>' + g('confirmRepay') +
      '<span class="sb">' + d.fp + ' · ' + d.id + ' · #' + p.seq + '</span></b>' +
    '<button class="modal-x" type="button" data-act="rp.close" aria-label="' + L('Close','关闭') + '">✕</button></div>' +
    '<div class="drawer-b u-scroll">' + body + '</div>' + foot + '</aside>';
}


/* ================================================================
   Part G —— 承载单元③：还款计划查看（只读，右侧抽屉 760px）
   **V3.4：定稿版单版 + 精简 + 按选定笔收敛**（D-RP-80 / D-RP-81）。
   两版同屏对照已取消，初始版收敛回它本来的位置——**只在报价环节可见**
   （报价详情页与 P-LS-06 接受抽屉，见 WS-325 原型）。业务规则一条未改：
   报价期仍要拟定初始计划、放款确认后仍按实际放款日重算定稿、定稿仍即锁死。

   **承载仍是 760px 抽屉，但理由换了**（D-RP-72，V3.0 的理由已作废）：
   原理由是"两版各 9 列要同屏比出差在哪，560px 装不下"——两版对照取消后这条论证不成立。
   新理由按判据重过一遍：提示类要求"零录入**且**只知悉**一件事**"。定稿计划表零录入没错，
   但它是 N 期 × 6 列的**表格型参考数据**，用户要按行定位"我在还哪一期、下一期什么时候"
   并与还款抽屉里的本期信息对照，属"一边看信息一边逐行核对"那一类；
   560px 弹窗放一张 6 列表，每列都会被压到换行，逐行核对反而更费劲。
   ================================================================ */
function drawerSchedule(){
  var d = curDeal();
  var head = '<aside class="drawer u" role="dialog" aria-modal="true" aria-label="' + E(g('repaySchedule')) + '">' +
    '<div class="drawer-h"><b>' + g('repaySchedule') +
      '<span class="sb">' + d.fp + '</span></b>' +
    '<button class="modal-x" type="button" data-act="rp.close" aria-label="' + L('Close','关闭') + '">✕</button></div>';
  var foot = '<div class="u-foot"><span class="sp"></span>' +
    '<button class="btn" type="button" data-act="rp.close">' + L('Close','关闭') + '</button></div>';

  /* 还款计划生成中：**中间态不是错误页**（E-RP-01） */
  if(!d.planReady){
    return head + '<div class="drawer-b u-scroll">' +
      sec('', '', markRow(L('Schedule being generated','还款计划生成中'),
        L('Disbursement confirmation completed at <b>' + withTz(d.fd35) + '</b>; the four figures moved ' +
          'atomically and the debt exists. The schedule is being generated and the instalment list ' +
          'appears here once ready.',
          '放款确认已于 <b>' + withTz(d.fd35) + '</b> 完成，四个量已原子转移，债务已成立。' +
          '还款计划正在生成，就绪后本抽屉自动显示完整期次。'),
        L('Generation is retryable and must be idempotent — a retry never produces a second set of instalments.',
          '生成动作可重试且必须幂等——重试不会产生第二套期次（E-RP-01）。')) +
        CF.note('',
          L('<b class="ls-b">This is not an error screen.</b> A failed schedule generation <b class="ls-b">' +
            'does not roll back</b> the upstream credit transfer or status migration: the money arrived ' +
            'and the debt exists.<p>So there is <b class="ls-b">no error shown, no retry button and no ' +
            'failure reason</b> here — retrying is the platform\u2019s job. Until the schedule is ready ' +
            'there is <b class="ls-b">nothing to repay</b> and <b class="ls-b">no overdue mark can ' +
            'arise</b> — the object an overdue test applies to is an instalment, and none exists yet.</p>',
            '<b class="ls-b">这不是一个错误页。</b>还款计划生成失败<b class="ls-b">不回滚</b>上游的额度转移' +
            '与状态迁移：钱已到账、债务已成立是事实。' +
            '<p>因此这里<b class="ls-b">不展示错误、不给重试按钮、不给失败原因</b>——重试是平台侧的事。' +
            '在计划就绪之前：<b class="ls-b">没有任何期次可还</b>，也<b class="ls-b">不会产生逾期</b>' +
            '——逾期判定的对象是期次，而期次还不存在。</p>'),
          L('Why this is not "failed to load"','为什么这里不是"加载失败"')), true) +
      '</div>' + foot + '</aside>';
  }

  var plan = finalPlan(d), gp = progress(d);
  var cur = (gp.await2 || gp.next || plan[plan.length - 1]);
  var curSeq = cur ? cur.seq : null;

  var marks = '';
  if(gp.overdue)
    marks = markRow(g('overdueMark'),
      L('Instalment ' + gp.overdue.seq + ' (due ' + gp.overdue.due + ') is <span class="day">' +
        gp.overdue.days + '</span> days overdue. Its repayment window <b>stays open</b>.',
        '第 ' + gp.overdue.seq + ' 期（应还日 ' + gp.overdue.due + '）已逾期 <span class="day">' +
        gp.overdue.days + '</span> 天。该期还款入口<b>保持开启</b>。'),
      L('Overdue is a <b>parallel mark, not a status</b>; the platform computes no penalty interest and ' +
        'triggers no disposal of the pledge.',
        '逾期是<b>并行标记不是状态</b>；平台不计罚息、不触发任何质押处置。'));

  return head + '<div class="drawer-b u-scroll">' +
    /* ---- 标题区（按选定笔收敛，D-RP-81 ①）+ 计息规则条，**固定在抽屉顶部、不随表体滚走**（D-RP-72 ②）---- */
    '<div class="u-fixed">' +
      '<div class="rp-title">' +
        '<div class="t1">' + E(d.fp) + '</div>' +
        '<div class="t2">' + E(funderOf(d)) + '</div>' +
        '<div class="t3">' + E(d.id) + '　·　' + E(lnNo(d)) + '　·　' +
          L('settles in ','结算币种 ') + d.ccy + '</div>' +
      '</div>' +
      '<p class="rp-only">' +
        L('One deal at a time. A project may be financed several times, by different institutions and in ' +
          'different currencies — so this view never merges deals and never shows a project-wide total.',
          '一次只呈现一笔。同一项目可以融资多次、出资机构不同、结算币种也可能不同——' +
          '因此本视图<b>不做跨笔合并</b>，也不给「本项目全部还款计划」的汇总表（D-RP-81 ②）。') + '</p>' +
      ruleBar(d) + '</div>' +
    (marks ? sec('', '', marks, true) : '') +
    sec('', '', planTable(d, plan, curSeq)) +
    sec('', '', annot(
      L('<b>Prototype note.</b> V3.4 keeps <b>only the final version</b> here: the "Expected · not in ' +
        'effect" tag, the "Expected due date" column name, the two-version tabs and the diff highlight are ' +
        'all gone. The initial (indicative) schedule is <b>not deleted</b> — it moved back to where it ' +
        'belongs, the quote stage (quote detail and the accept drawer), because its only job is to show ' +
        'the asset owner how the money will be repaid <b>before</b> they accept. Once the deal is in ' +
        'repayment, only the final version is in force, and showing a second "expected" version would ' +
        'just stop the numbers from reconciling.',
        '<b>原型注解。</b>V3.4 起此处<b>只留定稿版</b>：「预计 · 未生效」标识、「预计还款日」列名、' +
        '两版切换 tab 与差异行高亮都已取消。初始（试算）计划<b>不是被删掉</b>，' +
        '而是收敛回它本来的位置——<b>报价环节</b>（报价详情页与接受抽屉），' +
        '因为它的唯一用途就是让资产方<b>在接受报价之前</b>看到这笔钱以后怎么还。' +
        '业务一旦进入还款段，有效的只有定稿版，再摆一版「预计」只会让人对不上账（D-RP-80）。<br>' +
        '⚠️ <b>取消对照表 ≠ 取消告知</b>：定稿通知里的新旧对比仍然保留，' +
        '它是资产方得知「日期整体后移」的唯一渠道。')), true) +
    '</div>' + foot + '</aside>';
}

/* ================================================================
   Part H —— 提示类：居中弹窗 560px（零录入、只要一次表态，D-RP-76）
   二次确认弹窗是**唯一**会叠在抽屉之上的层：出现时抽屉整体被遮罩且不可交互，
   关闭后回到原处继续。**不新开第三层、不出现抽屉套抽屉、不出现弹窗套弹窗。**
   ================================================================ */
function modalShell(title, rows, ackLabel, ackId, footBtn, extra){
  return '<div class="mask rp-top" data-act="rp.mclose"><div class="modal wide" role="dialog" aria-modal="true">' +
    '<div class="modal-h"><b>' + title + '</b>' +
    '<button class="modal-x" type="button" data-act="rp.mclose" aria-label="' + L('Close','关闭') + '">✕</button></div>' +
    '<div class="modal-b"><div class="rows" style="box-shadow:none">' +
    rows.map(function(r){
      return '<div class="row"><div class="row-main"><div class="row-k">' + r[0] + '</div>' +
        '<div class="row-v" style="color:var(--muted);font-size:12px;line-height:1.6">' + r[1] + '</div></div></div>';
    }).join('') + '</div>' + (extra || '') +
    '<div class="check" style="margin-top:14px"><input type="checkbox" id="' + ackId + '" ' +
      (S.ack ? 'checked' : '') + ' data-act="rp.ack"><label for="' + ackId + '">' + ackLabel + '</label></div>' +
    '</div><div class="modal-f"><button class="btn" type="button" data-act="rp.mclose">' +
    L('Cancel','取消') + '</button>' + footBtn + '</div></div></div>';
}

/* 提交还款前的二次确认：三件事必须讲清（6.3.1）。第 ② 条是本模块特有的 —— D-FIN-11 的告知面。 */
function modalRepay(){
  var d = curDeal(), p = curPeriod(); if(!p) return '';
  var s = pState(d, p), v = formState(d, p);
  var to = tstr(tmin(NOW) + CONFIRM_HOURS * 60);
  var rows = [
    [L('1 · Once submitted it cannot be edited or withdrawn','① 提交后不可修改、不可撤回'),
     L('A repayment record is your <b>statement of fact</b> that you have paid, and the funder decides ' +
       'whether to confirm on exactly that basis. There is <b>no</b> edit, withdraw or supplementary-note ' +
       'entry this round — a typo in the hash can only be sorted out offline. Put anything you need to ' +
       'say into the remark (RM-11) now.',
       '还款记录是您对"我已经付款"的<b>事实陈述</b>，机构正是据此判断要不要确认。' +
       '本期<b>没有</b>修改、撤回与补充说明入口（X-LS-49 / D-RP-45）——' +
       '填错了（例如哈希抄错一位）只能靠线下沟通。要写的说明请现在写进备注 RM-11。')],
    [L('2 · Submitting stops overdue accrual; the funder has ' + CONFIRM_HOURS +
       ' hours, and expiry never counts as confirmation',
       '② 提交即停止本期逾期累加；机构将在 ' + CONFIRM_HOURS + ' 小时内确认，到期不会自动视为确认'),
     L('From the instant the submission succeeds (server time RM-06), this instalment’s overdue count ' +
       (s.overdue ? '<b>freezes at ' + s.odDays + ' days</b>' : '<b>stops accruing altogether</b>') +
       ' and <b>does not move however long the funder takes</b>.<br>The window closes at <b>' +
       withTz(to) + '</b> (submission time + ' + CONFIRM_HOURS + ' hours, to the second). ' +
       '<b>Expiry sends one notice; the status does not change and no credit moves</b> — the platform ' +
       'will not assert receipt on the funder’s behalf, and will not mark you late for it.',
       '<b>提交成功的那一刻</b>（服务端时间 RM-06）起，该期的逾期天数' +
       (s.overdue ? '<b>冻结在 ' + s.odDays + ' 天</b>' : '<b>停止任何累加</b>') +
       '，此后<b>机构再拖多久都不变</b>（D-FIN-11）。<br>' +
       '还款确认时限到期时刻 <b>' + withTz(to) + '</b>（＝ 提交成功的服务端时间 + ' + CONFIRM_HOURS +
       ' 小时，精确到秒）。<b>到期只发一条通知，状态不变、额度不动</b>：' +
       '平台不会替机构承认"钱已收到"，也不会因此判定您逾期。')],
    [L('3 · The platform does not verify the transfer','③ 平台不核验转账真伪'),
     (v.fiat ? L('The platform cannot see your bank statement; the proof is checked for format, size and ' +
                 'count only and is <b>not audited for authenticity</b>.',
                 '平台看不到银行流水，凭证只校验格式、大小与数量，<b>不审核真伪</b>。')
             : L('The transaction hash is <b>format-checked only, never verified on chain</b>: no indexer ' +
                 'is wired in, neither blocking nor advisory.',
                 '交易哈希<b>只做格式校验、不做链上核验</b>（D-RP-42）：平台不接索引服务，' +
                 '既不做阻断式也不做告警式核验。')) +
     L(' Judgement sits with the funder — which is exactly why the confirmation step exists.',
       '判断权在机构手里——这正是确认环节存在的意义。')]
  ];
  var summary = '<div class="rp-acct" style="margin-top:14px"><div class="ag">' +
    '<div><div class="k">' + g('instalment') + '</div><div class="v">#' + p.seq + ' · ' + p.due + '</div></div>' +
    '<div><div class="k">' + g('dueTotal') + '</div><div class="v">' + usd(p.total) + '</div></div>' +
    '<div><div class="k">' + g('repaidAt') + '</div><div class="v">' + E(v.given || '—') + '</div></div>' +
    '<div><div class="k">' + (v.fiat ? g('proofFiat') : g('txHash')) + '</div><div class="v">' +
      (v.fiat ? S.f.files.length + L(' file(s)',' 个') : E(shortHash(v.hash)) + ' · ' + CHAIN) + '</div></div>' +
    '</div></div>' +
    '<p class="hint" style="margin-top:10px">' +
    L('Prototype only — pick the server’s final-check outcome to walk the branches in 6.7. In the real ' +
      'system these are recomputed server-side at submission.',
      '原型内的结果模拟：选择服务端终检的返回，用于走通分册 6.7 的各条分支。' +
      '真实系统里这些结论一律由服务端在提交时刻实时重算给出。') + '</p>' +
    '<select class="inp" data-act="rp.f" data-v="out" id="submitOut">' +
      SUBMIT_OUTCOMES.map(function(o){
        return '<option value="' + o[0] + '"' + (S.out === o[0] ? ' selected' : '') + '>' + txt(o[1]) + '</option>';
      }).join('') + '</select>';
  return modalShell(L('Three things to confirm before submitting','提交还款记录前，请确认以下三件事'),
    rows,
    L('I have read and understood all three, and confirm submitting this repayment record.',
      '我已阅读并理解以上三条，确认提交本期还款记录。'),
    'rpAck',
    '<button class="btn primary" type="button" ' + (S.ack ? '' : 'disabled ') +
      'data-act="rp.submit">' + L('Submit repayment record','确认提交还款记录') + '</button>',
    summary);
}

/* 确认收到还款前的二次确认：两件事；末期另明示结清与授信释放（6.5.2） */
function modalConfirm(){
  var d = curDeal(), p = curPeriod(); if(!p) return '';
  var s = pState(d, p), gp = progress(d);
  var willSettle = p.last && gp.done === gp.n - 1;
  var rows = [
    [L('1 · Confirming means you have verified the money arrived','① 确认即表示您已核实该笔款项确已到账'),
     (isFiat(d) ? L('The platform <b>does not verify the transfer</b> — it cannot see your bank statement.',
                    '平台<b>不核验转账真伪</b>——平台看不到您的银行流水。')
                : L('The platform <b>does not verify the transfer</b> — the hash was format-checked only, ' +
                    '<b>never verified on chain</b>.',
                    '平台<b>不核验转账真伪</b>——交易哈希只做过格式校验，<b>没有做链上核验</b>。')) +
     L(' Check against ' + (isFiat(d) ? 'your bank statement' : 'the chain record and your wallet balance') +
       ' first: that the money really landed, that it is this amount, and that it went to this account.<br>' +
       '<b>Cross-border charges can make the received amount smaller than the amount due</b>: there is no ' +
       'shortfall field this round and the platform records the <b>amount due</b>. If that is why you do ' +
       'not accept it, <b>do not confirm</b> and use the support mailbox — the asset owner’s overdue days ' +
       'will not start accruing again because of it.',
       '请先对照' + (isFiat(d) ? '银行流水' : '链上记录与您的钱包余额') +
       '确认这笔钱确实到了、是这个金额、进的是这个账户。<br>' +
       '<b>跨境手续费导致实收少于应还是可能发生的</b>：本期没有差额说明字段，平台记录的是"应还金额"。' +
       '若因此不认，请<b>先不要确认</b>并走客服邮箱——对方的逾期天数不会因此继续累加。')],
    [L('2 · Confirmation cannot be undone','② 确认后不可撤销'),
     L('Within one settlement: instalment #' + p.seq + ' moves to <b>S-RP-3 Settled</b>, RP-17 records the ' +
       'settlement time, ' + (p.principal
         ? '<b>' + G.outstanding[0] + ' −' + amt(p.principal) + '</b> and <b>' + G.creditUsed[0] + ' −' +
           amt(p.principal) + '</b>'
         : '<b>neither credit figure moves</b> (interest-only instalment; interest is not principal)') +
       ', and the cumulative-repaid and outstanding-principal figures update. There is <b>no undo</b> this ' +
       'round — a mistaken confirmation can only be handled offline.',
       '同一次结算内：第 ' + p.seq + ' 期转 <b>S-RP-3 已结清</b>、记 RP-17 结清时间、' +
       (p.principal
         ? '<b>项目融资余额 −' + amt(p.principal) + '</b> 且 <b>授信占用额 −' + amt(p.principal) + '</b>'
         : '<b>两个额度量一个都不动</b>（利息期，利息不是本金）') +
       '、更新累计已还与未偿本金。本期<b>不提供撤销</b>——发现确认错了只能走线下。')]
  ];
  if(willSettle) rows.push([
    L('3 · This settles the whole financing deal','③ 本笔融资业务将就此结清'),
    L('This is the last unsettled instalment. After confirmation the deal moves S-FD-6 → <b>S-FD-8 ' +
      'Settled</b> (terminal), the overdue mark is cleared, and <b>your credit in use is released by ' +
      usd(p.principal) + '</b>, restoring available credit by the same amount.<br>The fact "this deal is ' +
      'settled" is handed to the financing-demand module, which decides the project terminal state and ' +
      'the pledge release — <b>this module releases no pledge</b>.',
      '这是最后一个未结清期次。确认完成后业务 S-FD-6 → <b>S-FD-8 已结清</b>（终态），' +
      '清除逾期标记，<b>您对该资产方的授信占用额将等额释放 ' + usd(p.principal) + '</b>，可用授信同额恢复。<br>' +
      '「该笔已结清」这一事实交给融资需求与代币质押模块判定项目终态与质押释放，' +
      '<b>本模块不释放任何质押</b>（D-RP-39）。')]);

  var extra = (s.overdue ? '<div class="rp-acct" style="margin-top:14px"><div class="ag">' +
      '<div><div class="k">' + L('Days overdue','逾期天数') + '</div><div class="v">' + s.odDays + '</div></div>' +
      '<div><div class="k">' + L('Frozen at','冻结时刻') + '</div><div class="v">' + s.frozenAt + '</div></div>' +
      '<div><div class="k">' + L('Effect of confirming','确认与否') + '</div><div class="v">' +
        L('does not change it','不改变这个数') + '</div></div></div></div>' : '') +
    '<p class="hint" style="margin-top:10px">' +
    L('Prototype only — pick the settlement outcome to walk 6.7 and AC-RP-13.',
      '原型内的结果模拟：走通分册 6.7 与 AC-RP-13 的一致性要求。') + '</p>' +
    '<select class="inp" data-act="rp.f" data-v="cout" id="confirmOut">' +
      CONFIRM_OUTCOMES.map(function(o){
        return '<option value="' + o[0] + '"' + (S.cout === o[0] ? ' selected' : '') + '>' + txt(o[1]) + '</option>';
      }).join('') + '</select>';

  return modalShell(g('confirmRepay'), rows,
    L('I have verified that this payment has arrived, and I understand the confirmation cannot be undone.',
      '我已核实该笔款项确已到账，确认并知悉确认后不可撤销。'),
    'cfAck',
    '<button class="btn primary" type="button" ' + (S.ack ? '' : 'disabled ') +
      'data-act="rp.confirm">' + g('confirmRepay') + '</button>',
    extra);
}

/* ---- 结局枚举（分册 6.7）。七类提交结局 + 三类确认结局，各有独立呈现与独立出路，
       **不存在只写「操作失败」的兜底文案**。 ---- */
var SUBMIT_OUTCOMES = [
  ['ok',      ['Submitted (RM-01 issued → S-RP-2 → overdue frozen → window starts)',
               '提交成功（生成 RM-01 → S-RP-2 → 冻结逾期天数 → 时限开始计时）']],
  ['notopen', ['E-RP-03 server final check: window not open → rejected, no record created',
               'E-RP-03 服务端终检：该期尚未开窗 → 拒绝，不产生记录']],
  ['race',    ['E-RP-02 concurrent submission: first to land wins, no second record',
               'E-RP-02 并发提交：先落库者成功，后到者不产生第二条']],
  ['moved',   ['E-RP-08 instalment left S-RP-1 → settled against the authoritative state and rejected',
               'E-RP-08 期次已不在 S-RP-1 → 按权威状态结算并拒绝']],
  ['upload',  ['E-RP-06 proof format / size / count invalid → shown in place, other files kept',
               'E-RP-06 凭证格式 / 大小 / 数量不合格 → 就地提示，已传文件保留']],
  ['future',  ['E-RP-07 repayment time later than the submission instant → rejected',
               'E-RP-07 还款时间晚于提交时刻 → 拒绝']]
];
var CONFIRM_OUTCOMES = [
  ['ok',     ['Confirmed (instalment settles; a principal instalment steps both figures down)',
              '确认成功（期次结清 + 含本金期次两量等额递减）']],
  ['settle', ['E-RP-11 partial settlement failure → rolled back as a whole, stays S-RP-2',
              'E-RP-11 结算部分失败 → 整体回滚，保持 S-RP-2']],
  ['gone',   ['E-RP-09 instalment no longer in S-RP-2 → authoritative settlement + ops alert',
              'E-RP-09 期次已不在 S-RP-2 → 按权威状态结算 + 运营告警']]
];

/* ---- 结果卡：紧跟页头之后。每一类结局各有独立呈现与独立出路 ---- */
function resultCard(){
  var r = S.result; if(!r) return '';
  var box;
  switch(r.k){
    case 'submitted':
      box = CF.note('green',
        L('Repayment record <b class="ls-b">' + r.id + '</b> issued; instalment #' + r.seq +
          ' moved to <b class="ls-b">S-RP-2</b>.<p>Within one settlement: ID issued → S-RP-1 → S-RP-2 → ' +
          '<b class="ls-b">this instalment’s overdue count frozen (' + r.od + ' days)</b> → ' +
          '<b class="ls-b">the repayment confirmation window starts</b> (from ' + withTz(r.at) + ', closes ' +
          withTz(r.to) + ') → the funder is notified. <b class="ls-b">Neither credit figure moves</b> — ' +
          'only the funder knows whether the money arrived; a submission is just a statement.</p>' +
          '<p>The record <b class="ls-b">cannot be edited or withdrawn</b>. Expiry <b class="ls-b">never ' +
          'counts as confirmation</b>: one notice, status unchanged. If the funder never confirms, ' +
          '<b class="ls-b">your overdue count stays frozen at ' + r.od + '</b>, and the way out is the ' +
          'support mailbox and an offline conversation.</p>',
          '还款记录编号 <b class="ls-b">' + r.id + '</b> 已生成，第 ' + r.seq +
          ' 期转 <b class="ls-b">S-RP-2 待还款确认</b>。' +
          '<p>同一次结算内：生成编号 → 期次 S-RP-1 → S-RP-2 → <b class="ls-b">冻结该期逾期天数（' +
          r.od + ' 天）</b> → <b class="ls-b">还款确认时限开始计时</b>（起点 ' + withTz(r.at) +
          '，到期 ' + withTz(r.to) + '）→ 通知资金方。' +
          '<b class="ls-b">两个额度量一个都不动</b>——钱有没有到只有机构知道，提交只是一次陈述。</p>' +
          '<p>还款记录<b class="ls-b">不可修改、不可撤回</b>。到期<b class="ls-b">不会自动视为确认</b>：' +
          '届时只发一条通知、状态不变。机构始终不确认时，' +
          '<b class="ls-b">您的逾期天数仍然冻结在 ' + r.od + ' 天</b>，出路是客服邮箱线下沟通。</p>'),
        L('Repayment record submitted','还款记录已提交'));
      break;
    case 'notopen':
      box = CF.note('red',
        L('<b class="ls-b">Rejected by the server final check: the window is not open.</b> Instalment #' +
          r.seq + '’s window opens on <b class="ls-b">' + r.openAt + ' 00:00 ' + TZ + '</b> (' +
          OPEN_DAYS + ' calendar days before the due date ' + r.due + ').<p><b class="ls-b">Early ' +
          'repayment is out of scope this round</b> — principal is only repaid after the financing project ' +
          'matures. <b class="ls-b">No record was created and no status changed.</b></p><p>A front-end ⊘ ' +
          'or a hidden row <b class="ls-b">is not a check</b>: the window verdict is recomputed server-side ' +
          'at submission. Leaving the drawer open too long, or bypassing the front end, lands here.</p>',
          '<b class="ls-b">提交被服务端终检拒绝：该期尚未开窗。</b>第 ' + r.seq + ' 期的还款入口将于 ' +
          '<b class="ls-b">' + r.openAt + ' 00:00 ' + TZ + '</b> 开启（应还日 ' + r.due + ' 前 ' +
          OPEN_DAYS + ' 个自然日）。<p><b class="ls-b">本期不支持提前还款</b>——还本金只发生在融资项目' +
          '到期之后。本次<b class="ls-b">不产生还款记录、不改变任何状态</b>（E-RP-03）。</p>' +
          '<p>前端的 ⊘ 与隐藏<b class="ls-b">均不构成校验</b>：开窗结论由服务端在提交时刻重新判定。' +
          '抽屉停留过久、或绕过前端直接提交，都会落到这里。</p>'),
        L('Window not open — nothing submitted','该期尚未开窗，本次未提交'));
      break;
    case 'race':
      box = CF.note('amber',
        L('This instalment <b class="ls-b">already has a repayment record</b> (' + r.id + ', ' +
          withTz(r.at) + '); the present submission did not land.<p>Concurrent submissions <b class="ls-b">' +
          'settle serially and the first to land wins</b>; the later one produces no second record. The ID ' +
          'is issued only when a submission succeeds, so <b class="ls-b">no number was consumed</b> here.</p>' +
          '<p>Any signed-in employee of the same entity may act for the company, so this path is real: two ' +
          'colleagues hit submit at once and exactly one succeeded.</p>',
          '该期<b class="ls-b">已提交还款记录</b>（' + r.id + '，' + withTz(r.at) + '），本次提交未落库。' +
          '<p>并发提交<b class="ls-b">串行结算、先落库者成功</b>，后到者不产生第二条记录' +
          '（E-RP-02 / D-RP-44）。编号只在提交成功的同一时刻生成，本次<b class="ls-b">不占号</b>。</p>' +
          '<p>同一企业主体下任一登录员工都可以代表企业提交，因此这条路径是真实存在的：' +
          '两位同事同时点了提交，只有一笔成功。</p>'),
        L('This instalment already has a record','该期已提交还款记录'));
      break;
    case 'moved':
      box = CF.note('amber',
        L('At submission the instalment <b class="ls-b">was no longer in S-RP-1</b>: ' + E(r.detail) +
          '. Settled against the <b class="ls-b">authoritative state at that instant</b> and rejected.' +
          '<p>You are back on the deal page with an explanation — <b class="ls-b">no 404, no blank screen, ' +
          'no silent bounce to the home page</b>.</p>',
          '提交时该期<b class="ls-b">已不在 S-RP-1 待还款</b>：' + E(r.detail) +
          '。按<b class="ls-b">提交时刻的权威状态</b>结算并拒绝本次提交。' +
          '<p>页面已落回详情页并给出说明，<b class="ls-b">不报 404、不白屏、不静默跳首页</b>' +
          '（E-RP-08 / AC-LS-134）。</p>'),
        L('Instalment status changed','期次状态已变更'));
      break;
    case 'upload':
      box = CF.note('red', txt(r.detail) +
        L('<p><b class="ls-b">The other uploaded files are kept</b>, nothing needs re-uploading. Format and ' +
          'size limits are identical to the disbursement side — not a second baseline.</p>',
          '<p><b class="ls-b">已上传的其他文件保留</b>，无需重传（E-RP-06）。' +
          '格式与大小基线与放款侧完全一致，不另定一套。</p>'),
        L('Proof rejected','凭证未通过'));
      break;
    case 'future':
      box = CF.note('red',
        L('<b class="ls-b">The repayment time is later than the submission instant; the server rejected ' +
          'it.</b><p>The repayment time <b class="ls-b">may be in the past but never in the future</b> — a ' +
          'future repayment time means the money has not left yet. It is a reconciliation reference only; ' +
          'no deadline or interest calculation uses it.</p>',
          '<b class="ls-b">还款时间晚于提交时刻，服务端拒绝提交</b>（E-RP-07）。' +
          '<p>还款时间<b class="ls-b">可以填过去，不能填未来</b>——未来的还款时间意味着钱还没打。' +
          '它只是业务参考与对账依据，任何时效与计息都不使用它（D-FIN-21）。</p>'),
        L('Invalid repayment time','还款时间不合法'));
      break;
    case 'confirmed':
      box = CF.note('green',
        L('Repayment confirmed. Instalment #' + r.seq + ' moved to <b class="ls-b">S-RP-3 Settled</b> at ' +
          '<b class="ls-b">' + withTz(r.at) + '</b> (RM-18 / RP-17).<p>' + (r.principal
            ? 'Within one settlement: <b class="ls-b">' + G.outstanding[0] + ' −' + amt(r.principal) +
              '</b>, <b class="ls-b">' + G.creditUsed[0] + ' −' + amt(r.principal) + '</b>, and the ' +
              'cumulative-repaid and outstanding-principal figures updated. Both figures step down ' +
              '<b class="ls-b">by the same amount, atomically, with no gap</b>.'
            : 'This is an interest-only instalment: <b class="ls-b">neither credit figure moves</b> — they ' +
              'are sums of outstanding principal and interest is not part of them.') + '</p>' +
          (r.settled
            ? '<p><b class="ls-b">Every instalment on this deal is now settled</b>: S-FD-6 → ' +
              '<b class="ls-b">S-FD-8 Settled</b> (terminal), the overdue mark is cleared, the settlement ' +
              'time is recorded and both figures for this deal are back to zero. The fact is handed to the ' +
              'financing-demand module for the project terminal state and the pledge release — ' +
              '<b class="ls-b">this module releases no pledge</b>.</p>'
            : '<p>The deal still has unsettled instalments and stays <b class="ls-b">S-FD-6</b>.</p>') +
          '<p>Confirmation <b class="ls-b">cannot be undone</b>: it states a fact rather than offering an ' +
          'option to change your mind.</p>',
          '已确认收到还款。第 ' + r.seq + ' 期转 <b class="ls-b">S-RP-3 已结清</b>，' +
          '确认时间 <b class="ls-b">' + withTz(r.at) + '</b>（RM-18 / RP-17）。<p>' + (r.principal
            ? '同一次结算内：<b class="ls-b">项目融资余额 −' + amt(r.principal) + '</b>、' +
              '<b class="ls-b">授信占用额 −' + amt(r.principal) + '</b>、累计已还与未偿本金更新。' +
              '两个量<b class="ls-b">等额递减、原子、无空档</b>（AC-FIN-36）。'
            : '这是利息期：<b class="ls-b">项目融资余额与授信占用额一动不动</b>——' +
              '它们是未偿本金的合计，利息不在其中（D-RP-36）。') + '</p>' +
          (r.settled
            ? '<p><b class="ls-b">该业务全部期次已结清</b>：业务 S-FD-6 → <b class="ls-b">S-FD-8 已结清</b>' +
              '（终态），清除逾期标记，结清时间落库，两个量该笔归零。' +
              '「该笔已结清」这一事实<b class="ls-b">交给融资需求与代币质押模块</b>判定项目终态与' +
              '质押两段式释放——<b class="ls-b">本模块不释放任何质押</b>（D-RP-39）。</p>'
            : '<p>该业务还有未结清期次，业务仍是 <b class="ls-b">S-FD-6 还款中</b>。</p>') +
          '<p>确认<b class="ls-b">不可撤销</b>：它是对事实的陈述，不是一个可以反悔的选项。</p>'),
        L('Repayment confirmed','还款确认完成'));
      break;
    case 'settle':
      box = CF.note('amber',
        L('<b class="ls-b">The settlement did not complete; the instalment stays in S-RP-2.</b> This ' +
          'settlement must <b class="ls-b">succeed as a whole or not happen at all</b>: instalment status, ' +
          'both credit figures, cumulative repaid, outstanding principal, the deal status (final ' +
          'instalment) and the emitted settlement fact — none optional.<p>It has been rolled back in full, ' +
          'so <b class="ls-b">no "confirmed but credit not released" and no "final instalment settled but ' +
          'the deal still shows repaying"</b> appeared; while the retry runs, the outside view stays ' +
          '"not confirmed". Please retry shortly.</p><p>The asset owner’s overdue days <b class="ls-b">' +
          'stay frozen</b> throughout — a settlement retry does not touch that rule.</p>',
          '<b class="ls-b">结算未完成，期次保持 S-RP-2 待还款确认。</b>' +
          '该结算必须<b class="ls-b">整体成功或整体不发生</b>：期次状态、两个额度量、累计已还、' +
          '未偿本金、业务状态（末期时）、结清事实的输出，缺一不可（E-RP-11 / AC-RP-13）。' +
          '<p>本次已整体回滚，<b class="ls-b">没有出现"已确认但额度未减"或"末期已结清但业务仍显示还款中"' +
          '的中间态</b>；重试期间对外仍按未确认呈现。请稍后重试确认。</p>' +
          '<p>资产方的逾期天数在这期间<b class="ls-b">仍然冻结</b>——结算重试不影响 D-FIN-11。</p>'),
        L('Rolled back as a whole; retryable','结算整体回滚，可重试'));
      break;
    case 'gone':
      box = CF.note('amber',
        L('At the instant of confirmation the instalment <b class="ls-b">was no longer in S-RP-2</b>. ' +
          'There is <b class="ls-b">no legitimate concurrent path</b> here this round (only the funder ' +
          'writes during S-RP-2), so this is treated as a data anomaly: settled against the authoritative ' +
          'state, explained on the page, and an <b class="ls-b">operations alert is raised</b>.',
          '确认的同一时刻该期<b class="ls-b">已不在 S-RP-2</b>。本期<b class="ls-b">不存在合法的并发路径</b>' +
          '（S-RP-2 段只有机构一个写动作），因此这被视为数据异常：按权威状态结算、落详情页说明，' +
          '并<b class="ls-b">生成运营告警</b>（E-RP-09）。'),
        L('Instalment status anomaly','期次状态异常'));
      break;
    default: box = CF.note('', '—');
  }
  return '<div style="margin-bottom:16px">' + box + '</div>';
}


/* ================================================================
   Part I —— 模块装配
   每个页面态把「哪一笔业务 / 哪一期 / 什么身份 / 开哪个抽屉」一次配好（同 WS-326 v2.0 的做法）。
   ================================================================ */
var SCENES = {
  /* P-LS-09 还款抽屉 */
  due      :{ deal:'FD-20260908-0061', role:'asset', drawer:'repay', seq:1 },
  overdue  :{ deal:'FD-20260820-0046', role:'asset', drawer:'repay', seq:1 },
  coin     :{ deal:'FD-20260901-0053', role:'asset', drawer:'repay', seq:1 },
  locked   :{ deal:'FD-20260908-0061', role:'asset', drawer:'repay', seq:2 },
  submitted:{ deal:'FD-20260904-0062', role:'asset', drawer:'repay', seq:1 },
  settled  :{ deal:'FD-20251120-0009', role:'asset', drawer:null,    seq:3 },
  pending  :{ deal:'FD-20260910-0065', role:'asset', drawer:'schedule' },
  /* P-LS-10 确认抽屉 */
  left     :{ deal:'FD-20260904-0062', role:'fund',  drawer:'confirm', seq:1 },
  soon     :{ deal:'FD-20260902-0054', role:'fund',  drawer:'confirm', seq:1 },
  coinCf   :{ deal:'FD-20260907-0060', role:'fund',  drawer:'confirm', seq:1 },
  elapsed  :{ deal:'FD-20260826-0050', role:'fund',  drawer:'confirm', seq:1 },
  last     :{ deal:'FD-20260315-0018', role:'fund',  drawer:'confirm', seq:2 },
  doneCf   :{ deal:'FD-20251120-0009', role:'fund',  drawer:'confirm', seq:3 },
  assetWait:{ deal:'FD-20260904-0062', role:'asset', drawer:'confirm', seq:1 },
  /* 还款计划查看抽屉（V3.4：定稿版单版） */
  planMulti:{ deal:'FD-20260908-0061', role:'asset', drawer:'schedule' },
  planOne  :{ deal:'FD-20260826-0050', role:'asset', drawer:'schedule' },
  planOdue :{ deal:'FD-20260820-0046', role:'asset', drawer:'schedule' },
  /* 身份与加载 */
  guest    :{ deal:'FD-20260908-0061', role:'guest', drawer:null },
  other    :{ deal:'FD-20260907-0060', role:'asset', drawer:null },
  /* 业务未进 S-FD-6：第③段**整段不渲染**（D-RP-77 ②） */
  preRepay :{ deal:'FD-20261215-0071', role:'asset', drawer:null },
  loading  :{ deal:'FD-20260908-0061', role:'asset', drawer:null },
  error    :{ deal:'FD-20260908-0061', role:'asset', drawer:null }
};
function syncScene(){
  var sc = SCENES[S.st] || SCENES['due'];
  S.deal = sc.deal; S.role = sc.role; S.drawer = sc.drawer || null;
  S.seq = sc.seq || null; S.find = ''; S.rowOpen = null;
  S.modal = null; S.ack = false; S.result = null;
  S.f = { given:'2026-12-18 09:30', hash:'', memo:'', files:[], extra:[], upErr:null, shown:false };
  /* 数币场景预填一个格式正确的哈希，便于直接走到二次确认 */
  if(S.st === 'coin') S.f.hash = '0x9a2f61c7b03d48e5a71c0f9b3e6d28540bf7c1a93e5d0247b8fa6c31d09e4b75';
}

function skel(){
  return CF.pageStates() + '<div class="card"><div class="card-b">' +
    '<div class="skel" style="height:52px"></div><div class="skel" style="height:170px;margin-top:16px"></div>' +
    '<div class="skel" style="height:110px;margin-top:16px"></div></div></div>';
}
function failCard(){
  return CF.pageStates() + '<div class="card"><div class="tbl-empty"><b>' +
    L('Could not load the repayment schedule','还款计划与期次未能加载') + '</b>' +
    '<p style="max-width:620px;margin:0 auto">' +
    L('The server did not return this deal’s instalments. <b>The window-opening instant (RP-15) and the ' +
      'confirmation deadline (RM-15) are issued by the server as absolute instants and the front end only ' +
      'renders them</b> — deriving them from local time would disagree with the server across time zones ' +
      'and clock drift.',
      '服务端未返回该笔业务的还款计划期次。<b>开窗时刻 RP-15 与到期时刻 RM-15 必须由服务端下发绝对时刻、' +
      '前端只负责渲染</b>——按本地时间推算会在跨时区与时钟偏差下与服务端判定不一致（AC-LS-133）。') +
    '</p><div style="margin-top:14px">' +
    '<button class="btn primary" type="button" data-act="st" data-v="due">' +
    L('Reload','重新加载') + '</button></div></div></div>';
}

var mod = {
  id:'lending-repayment', end:'asset', home:'P-LS-09',
  /* 顶栏导航文案沿用 WS-324 的键，保证四个文件的菜单一字不差 */
  dict:{ en:{ navPlaza:'Marketplace', navMyProjects:'My projects' },
         zh:{ navPlaza:'借贷广场', navMyProjects:'我的融资项目' } },
  owns:['P-LS-09','P-LS-10','P-LS-91'],
  topbarPrd:false,
  states:{
    'P-LS-09':[['due','Fiat · window open','法币 · 已开窗'],
               ['overdue','Overdue 26 days','已逾期 26 天'],
               ['coin','Stablecoin · ERC-20','数币 USDT · ERC-20'],
               ['locked','Window not open ⊘','未开窗 ⊘'],
               ['submitted','Already submitted','该期已提交待确认'],
               ['settled','Deal settled','业务已结清'],
               ['pending','Schedule generating','还款计划生成中'],
               ['guest','Not signed in','未登录'],
               ['other','Third party','非当事方'],
               ['preRepay','Not in repayment yet','未进还款段 · 第③段不渲染'],
               ['loading','Loading','加载中'],
               ['error','Load failed','加载失败']],
    'P-LS-10':[['left','3 days left · frozen at 5','剩余 3 天 · 逾期冻结在 5'],
               ['soon','Under 24 hours','不足 24 小时'],
               ['coinCf','Stablecoin · explorer link','数币 · 区块浏览器'],
               ['elapsed','Window elapsed','已超过还款确认时限'],
               ['last','Final instalment · settles the deal','末期含本金 · 确认即结清'],
               ['doneCf','Settled','已结清'],
               ['assetWait','Asset-owner view','资产方视角 · 等待确认'],
               ['guest','Not signed in','未登录'],
               ['loading','Loading','加载中'],
               ['error','Load failed','加载失败']],
    'P-LS-91':[['planMulti','Final schedule','定稿计划 · 单版'],
               ['planOdue','With an overdue instalment','含逾期期次'],
               ['planOne','Single deal in project','项目下只有一笔'],
               ['pending','Schedule generating','还款计划生成中'],
               ['guest','Not signed in','未登录'],
               ['loading','Loading','加载中'],
               ['error','Load failed','加载失败']]
  },
  state:function(){
    /* 面客端默认英文（WS-324 D-LS-15）；中文由顶栏语言开关切换 */
    return { lang:'en', role:'asset', deal:'FD-20260908-0061', drawer:'repay', seq:1,
             find:'', rowOpen:null, modal:null, ack:false, out:'ok', cout:'ok', result:null,
             f:{ given:'2026-12-18 09:30', hash:'', memo:'', files:[], extra:[], upErr:null, shown:false } };
  },
  onBoot:function(st){ S = st; syncScene(); },
  onSetState:function(){ syncScene(); },
  onGo:function(){ syncScene(); },
  crumbParts:function(){ return []; },
  /* D-RP-72 ③：当前应还期次默认高亮**并滚动到可视区**——精简之后最该突出的就是这一行。
     编号检索框的焦点恢复走公共壳层的 data-f 机制，这里不另造一套。 */
  afterRender:function(){
    var row = document.querySelector('.rp-plan tr[data-cur="1"]');
    if(row && row.scrollIntoView) row.scrollIntoView({ block:'center' });
  },
  content:function(){
    if(S.st === 'loading') return skel();
    if(S.st === 'error') return failCard();
    return hostPage();
  },
  drawers:{ repay:drawerRepay, confirm:drawerConfirm, schedule:drawerSchedule },
  modals:{ repay:modalRepay, confirm:modalConfirm },
  hash:{
    build:function(){
      var d = curDeal(), p = curPeriod();
      if(S.drawer === 'confirm') return '#/schedule/' + planNo(d, p) + '?action=confirm_repayment';
      if(S.drawer === 'schedule') return '#/deal/' + d.id + '?action=view_schedule';
      if(S.drawer === 'repay') return '#/deal/' + d.id + '?action=repay';
      return '#/deal/' + d.id;
    },
    /* 锚点语义：**落详情页 + 定位第③段 + 打开对应抽屉（并选中对应期次）**，
       不是落到一个独立页面（D-RP-71，与 WS-325 D-LS-30 / WS-326 D-LN-48 同一处置）。 */
    read:function(){
      var h = (location.hash || '').replace(/^#\/?/, ''); if(!h) return false;
      var parts = h.split('?'), seg = parts[0].split('/'), qs = {};
      (parts[1] || '').split('&').forEach(function(kv){
        var i = kv.indexOf('='); if(i > 0) qs[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); });
      var act = qs.action || '';
      if(seg[0] === 'deal'){
        S.page = act === 'confirm_repayment' ? 'P-LS-10' : (act === 'view_schedule' ? 'P-LS-91' : 'P-LS-09');
        S.st = act === 'view_schedule' ? 'compare' : 'due';
        syncScene();
        var d = findDeal(seg[1]);
        if(d){ S.deal = d.id; S.seq = null; }
        S.drawer = act === 'view_schedule' ? 'schedule' : (act === 'repay' ? 'repay' : null);
        return true;
      }
      if(seg[0] === 'schedule'){
        S.page = act === 'confirm_repayment' ? 'P-LS-10' : 'P-LS-09';
        S.st = act === 'confirm_repayment' ? 'left' : 'due';
        syncScene();
        /* schedule/{RP-01} 直达指定期次（D-RP-60） */
        var no = seg[1] || '', sq = parseInt(no.slice(-6), 10);
        for(var j = 0; j < DEALS.length; j++){
          if(DEALS[j].planReady && planNo(DEALS[j], { seq:sq }) === no){
            S.deal = DEALS[j].id; S.seq = sq; break;
          }
        }
        S.drawer = act === 'confirm_repayment' ? 'confirm' : 'repay';
        S.role = act === 'confirm_repayment' ? 'fund' : 'asset';
        return true;
      }
      return false;
    }
  },
  onAct:function(n, a, v){
    if(a.indexOf('rp.') !== 0) return false;
    var d, p, s, pair;
    switch(a){
      /* ---- 承载：开 / 关抽屉。同一时刻只有一层（D-RP-76） ---- */
      case 'rp.open':  S.drawer = v; S.result = null; CF.render(); return true;
      case 'rp.close': S.drawer = null; S.modal = null; S.ack = false; CF.render(); return true;
      /* 行内展开本息拆分与计息区间（AC-RP-04 的验算输入，收起不等于移除） */
      case 'rp.row':   S.rowOpen = (S.rowOpen === +v ? null : +v); CF.render(); return true;
      /* 换选期次：可逆、零后果，**就地切换，不为此再开一层** */
      case 'rp.pick':
        pair = String(v).split(':');
        S.deal = pair[0]; S.seq = +pair[1]; S.result = null;
        S.f = { given:'2026-12-18 09:30', hash:'', memo:'', files:[], extra:[], upErr:null, shown:false };
        CF.render(); return true;
      /* 第③段按 FP-28 需求编号切换（与抽屉内期次排序不是同一个，D-RP-74） */
      /* 换选笔：卡片、还款抽屉的默认期次、计划视图三者同步切换（D-RP-81 ④） */
      case 'rp.demand': S.deal = v; S.seq = null; S.rowOpen = null; S.result = null; CF.render(); return true;
      case 'rp.signin':
        toast('info', L('Sign-in is out of scope for this prototype','原型内不实现登录'),
          L('The sign-in flow belongs to the portal sign-in module. Switch the demo identity with the ' +
            'state switcher above to see the signed-in views.',
            '登录流程属于金融服务端登录模块。用上方的状态切换器切到已登录身份即可看到登录后的视图。'));
        return true;
      case 'rp.why':
        toast('info', L('This action is not available: ','该操作当前不可用：') + (v || ''),
          n.getAttribute('title') || '');
        return true;
      case 'rp.whySeq': {
        pair = String(v).split(':');
        d = findDeal(pair[0]); if(!d) return true;
        var pl = finalPlan(d), pp = null;
        for(var i = 0; i < pl.length; i++) if(pl[i].seq === +pair[1]) pp = pl[i];
        if(!pp) return true;
        var ra = repayAction(d, pp);
        toast('info', L('Instalment not selectable: ','该期次当前不可选：') + ra.brief, ra.reason);
        return true;
      }
      case 'rp.f':   return true;   /* 字段回写由下面自挂的 input / change 一层负责 */
      case 'rp.ack': S.ack = n.checked; CF.render(); return true;
      case 'rp.download':
        toast('info', L('No real file in the prototype','原型内不提供真实文件'),
          L('The real system embeds a preview and offers an authenticated download; files are reachable ' +
            'only by the two parties of this deal, filtered server-side rather than hidden by the front ' +
            'end, and never through a guessable public URL.',
            '真实系统在此内嵌预览并提供鉴权下载；文件仅该笔业务双方可访问，服务端过滤而非前端隐藏，' +
            '且不使用可猜测的公开直链。'));
        return true;
      case 'rp.copyMail':
        d = curDeal(); p = curPeriod();
        toast('info', L('Mailbox and the three IDs copied','已复制邮箱与三个编号'),
          MAIL + '　' + g('demandNo') + ' ' + d.fp + '　' + g('dealNo') + ' ' + d.id +
          '　' + g('planNoLbl') + ' ' + planNo(d, p) + '　·　' +
          L('The address is a placeholder constant pending the business owner; swapping it touches one ' +
            'constant, not the flow or the layout. The platform promises neither a turnaround time nor an ' +
            'outcome.',
            '邮箱地址为占位常量（待业务方提供，与放款模块共用同一个），拿到后替换一个常量即可，' +
            '不触及流程与页面结构。平台不承诺处理时效、不承诺处理结果。'));
        return true;

      /* ---- 上传：法币凭证与数币补充材料共用，第二次演示超限（E-RP-06）---- */
      case 'rp.upload': {
        var list = v === 'extra' ? S.f.extra : S.f.files;
        var cap  = v === 'extra' ? EXTRA_MAX_N : FIAT_MAX_N;
        if(list.length >= cap){
          S.f.upErr = L('At most ' + cap + ' files; ' + list.length + ' already uploaded. The others are ' +
                        'kept — remove one you do not need before continuing.',
                        '最多上传 ' + cap + ' 个文件，当前已有 ' + list.length +
                        ' 个。已上传的其他文件保留，请先移除不需要的再继续。');
          CF.render(); return true;
        }
        if(v !== 'extra' && list.length === 1 && !S.f.shown){
          S.f.shown = true;
          S.f.upErr = L('"Bank payment proof · scan · reverse.tiff" was rejected: ① the format is TIFF and ' +
                        'only PDF / JPG / PNG are accepted this round; ② it is 12.6 MB, over the ' +
                        FILE_MAX_MB + ' MB per-file limit. <b class="ls-b">The other uploaded files are ' +
                        'kept</b>, nothing needs re-uploading.',
                        '文件「银行支付凭证-扫描件-背面.tiff」未通过：① 格式为 TIFF，本期只接受 PDF / JPG / PNG；' +
                        '② 大小 12.6 MB，超过单文件 ' + FILE_MAX_MB + ' MB 上限。' +
                        '<b class="ls-b">已上传的其他文件保留</b>，无需重传。');
          CF.render(); return true;
        }
        S.f.upErr = null;
        list.push(v === 'extra'
          ? ['Wallet transfer screenshot-' + (list.length + 1) + '.png',
             '钱包转账截图-' + (list.length + 1) + '.png', (0.3 + list.length * 0.2).toFixed(1) + ' MB']
          : ['Bank payment proof-' + (list.length + 1) + '.pdf',
             '银行支付凭证-回单-' + (list.length + 1) + '.pdf', (0.7 + list.length * 0.3).toFixed(1) + ' MB']);
        CF.render(); return true;
      }
      case 'rp.rmFile':  S.f.files.splice(+v, 1); S.f.upErr = null; CF.render(); return true;
      case 'rp.rmExtra': S.f.extra.splice(+v, 1); CF.render(); return true;

      /* ---- 二次确认：唯一会叠在抽屉之上的层 ---- */
      case 'rp.askSubmit':  S.ack = false; S.out = 'ok'; S.modal = { type:'repay' }; CF.render(); return true;
      case 'rp.askConfirm': S.ack = false; S.cout = 'ok'; S.modal = { type:'confirm' }; CF.render(); return true;
      case 'rp.mclose':
        if(n.classList.contains('mask') || n.classList.contains('modal-x') || n.tagName === 'BUTTON'){
          S.modal = null; S.ack = false; CF.render();
        }
        return true;

      /* ---- 提交还款记录 ---- */
      case 'rp.submit': {
        d = curDeal(); p = curPeriod(); if(!p) return true;
        s = pState(d, p);
        var out = (q('#submitOut') || {}).value || S.out || 'ok';
        var fv = formState(d, p);
        S.modal = null; S.ack = false;
        if(out === 'ok'){
          if(!fv.ok){
            S.result = { k:'moved', detail:L('the form has not passed the front-end checks, so the server ' +
              'never saw this submission','表单尚未通过前端校验，服务端不会收到本次提交') };
            CF.render(); return true;
          }
          var id = 'RM' + dayOnly(NOW).replace(/-/g, '') + '000009';
          d.paid[p.seq] = { id:id, at:NOW, given:fv.given,
                            files:S.f.files.slice(), extra:S.f.extra.slice(),
                            hash:fv.fiat ? null : fv.hash,
                            memo:[S.f.memo || '', S.f.memo || ''], confirmAt:null };
          S.result = { k:'submitted', id:id, seq:p.seq, at:NOW, od:s.odDays,
                       to:tstr(tmin(NOW) + CONFIRM_HOURS * 60) };
          S.drawer = null;
          toast('success', L('Repayment record submitted','还款记录已提交'),
            L('Instalment #' + p.seq + ' moved to S-RP-2; the overdue count froze at ' + s.odDays +
              ' and the confirmation window started. Neither credit figure moved.',
              '第 ' + p.seq + ' 期转 S-RP-2 待还款确认；该期逾期天数已冻结在 ' + s.odDays +
              ' 天，还款确认时限开始计时。两个额度量一个都不动。'));
        } else if(out === 'notopen'){
          S.result = { k:'notopen', seq:p.seq, due:p.due, openAt:p.openAt }; S.drawer = null;
        } else if(out === 'race'){
          S.result = { k:'race', id:'RM' + dayOnly(NOW).replace(/-/g, '') + '000003', at:NOW }; S.drawer = null;
        } else if(out === 'moved'){
          S.result = { k:'moved', detail:L('a colleague submitted a record for this instalment at ' +
            withTz(NOW) + ' (it is already in S-RP-2)',
            '同事已于 ' + withTz(NOW) + ' 为该期提交过还款记录（期次已进 S-RP-2）') }; S.drawer = null;
        } else if(out === 'future'){
          S.result = { k:'future' }; S.drawer = null;
        } else {
          S.result = { k:'upload', detail:[
            '"Bank payment proof · scan · reverse.tiff" was rejected: ① the format is TIFF and only ' +
            'PDF / JPG / PNG are accepted this round; ② it is 12.6 MB, over the ' + FILE_MAX_MB +
            ' MB per-file limit.',
            '文件「银行支付凭证-扫描件-背面.tiff」未通过：① 格式为 TIFF，本期只接受 PDF / JPG / PNG；' +
            '② 大小 12.6 MB，超过单文件 ' + FILE_MAX_MB + ' MB 上限。'] };
          S.drawer = null;
        }
        CF.render(); window.scrollTo(0, 0); return true;
      }

      /* ---- 确认收到还款 ---- */
      case 'rp.confirm': {
        d = curDeal(); p = curPeriod(); if(!p) return true;
        s = pState(d, p); if(!s.rec) return true;
        var co = (q('#confirmOut') || {}).value || S.cout || 'ok';
        S.modal = null; S.ack = false;
        if(co === 'settle'){
          S.result = { k:'settle' }; S.drawer = null;
          toast('info', L('Settlement rolled back as a whole','结算未完成，已整体回滚'),
            L('The instalment stays in S-RP-2 and both credit figures are exactly as before. Retryable.',
              '期次保持 S-RP-2 待还款确认，两个额度量与确认前完全一致。可重试。'));
        } else if(co === 'gone'){
          S.result = { k:'gone' }; S.drawer = null;
          toast('danger', L('Instalment status anomaly','期次状态异常'),
            L('Settled against the authoritative state; an operations alert was raised (E-RP-09).',
              '按权威状态结算并生成运营告警（E-RP-09）。'));
        } else {
          d.paid[p.seq].confirmAt = NOW;
          if(p.principal){
            d.pool.bal = round2(d.pool.bal - p.principal);
            d.cr.used  = round2(d.cr.used - p.principal);
          }
          var g2 = progress(d), settled = (g2.done === g2.n);
          if(settled){ d.st = 'S-FD-8'; d.fd47 = NOW; }
          S.result = { k:'confirmed', seq:p.seq, at:NOW, principal:p.principal, settled:settled };
          S.drawer = null;
          toast('success', L('Repayment confirmed','已确认收到还款'),
            L('Instalment #' + p.seq + ' settled' +
              (p.principal ? '; both credit figures stepped down by ' + amt(p.principal)
                           : '; interest-only, neither figure moved') +
              (settled ? '; the deal is now settled.' : '.'),
              '第 ' + p.seq + ' 期转 S-RP-3 已结清' +
              (p.principal ? '；项目融资余额与授信占用额同刻等额递减 ' + amt(p.principal)
                           : '；利息期，两个量不变') +
              (settled ? '；本笔业务已结清 S-FD-8。' : '。')));
        }
        CF.render(); window.scrollTo(0, 0); return true;
      }
    }
    return false;
  }
};

/* ---- 表单字段回写 ----
   公共壳层在 document 上只挂了 click，它头部注释里提到的 onInput(n,k) 钩子**没有实装**。
   本模块与前三个模块一样自挂一层（只认 data-act="rp.f"），**没有改 _shared**，
   并照 WS-326 的写法把 change 触发的重绘**推迟一拍**（setTimeout(…, 0)）——
   change 常在 blur 的派发过程中触发，同步改写 #content 会抛
   "The node to be removed is no longer a child of this node" 并可能吞掉紧随其后的那次点击。
   这条对公共层的修订请求已第五轮记在 README §6。 */
function writeField(k, val){
  if(k === 'given')      S.f.given = val;
  else if(k === 'hash')  S.f.hash = val;
  else if(k === 'memo')  S.f.memo = val;
  else if(k === 'find')  S.find = val;
  else if(k === 'out')   S.out = val;
  else if(k === 'cout')  S.cout = val;
}
function fieldNode(e){
  var n = e.target && e.target.closest ? e.target.closest('[data-act="rp.f"]') : null;
  return (n && n.getAttribute('data-v')) ? n : null;
}
document.addEventListener('input', function(e){
  var n = fieldNode(e); if(!n) return;
  var k = n.getAttribute('data-v');
  writeField(k, n.value);
  /* 编号检索要边打边筛，所以它是唯一在 input 上就重绘的字段；
     重绘会冲掉焦点，因此置一个标记由 afterRender 把焦点与光标位置放回去。 */
  if(k === 'find') CF.render();
});
document.addEventListener('change', function(e){
  var n = fieldNode(e); if(!n) return;
  writeField(n.getAttribute('data-v'), n.value);
  setTimeout(function(){ CF.render(); }, 0);
});

CF.define(mod);
CF.boot();
})();
