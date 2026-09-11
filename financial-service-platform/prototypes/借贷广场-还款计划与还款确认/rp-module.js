/* ==========================================================================
   rp-module.js — 借贷广场 · 还款计划与还款确认（WS-327）
   PRD 基线：v1.0-借贷广场-还款计划与还款确认-PRD.md V1.0 + 分册 01-数据字典与对外契约 V1.0
             （两份**只在 issue 附件上、尚未入库**，见模块 README §1）
   上游：WS-324 PRD V7.0 / 原型 v1.2.3；WS-325 PRD V4.0 / 原型 v1.0；
         WS-326 PRD V1.0 / 原型 v1.0（commit aac0aed）

   本文件只写本模块的页面、文案、演示数据与状态。
   token / 公共组件 / 运行时 / 页面登记一律来自 _shared，不在此重建。

   页面：P-LS-91 还款计划（两版对照 + 定稿全表，原型侧内部页）
        · P-LS-09 还款录入（资产方）· P-LS-10 还款确认（资金方）
   ========================================================================== */
(function () {
"use strict";

/* ================================================================
   Part A —— 口径常量、枚举与演示数据
   全部业务数据为演示数据：企业名带「（演示）」后缀，编号 / 金额 / 账号 / 哈希均为虚构。
   ================================================================ */

/* ---- 口径常量（分册 7.4 枚举与常量）---- */
var CCY          = 'USD';   /* 记账本位币（D-FIN-13）。跨币种不得求和（D-RP-40） */
var PERIOD_M     = 3;       /* 期间长度：常量 3 个自然月（需求方 09:39 裁定 1），不可配置（D-RP-15） */
var BASIS        = 360;     /* 计息基数：常量 360（ACT/360）[待裁定 Q-FIN-17]（D-RP-18） */
var OPEN_DAYS    = 3;       /* 还款入口开窗提前量：常量 3 个自然日 [待裁定 Q-RP-03]（D-RP-26） */
var GRACE_DAYS   = 0;       /* 宽限期：常量 0（不设）[待裁定 Q-FIN-29]（D-RP-34） */
var CONFIRM_HOURS= 168;     /* 还款确认时限：常量 168 小时 ＝ 7 个自然日（D-RP-52），不可配置、不可延长 */
var NEAR_HOURS   = 24;      /* 临近提醒提前量：24 小时，只发一档 */
var MEMO_MAX     = 200;     /* RM-11 还款备注 ≤ 200 字 */
var FILE_MAX_MB  = 10;      /* 单文件 ≤ 10 MB（沿用 WS-305 第 6 节基线，与 LN-07 完全一致） */
var FIAT_MIN_N   = 1;       /* RM-07 银行支付凭证 1～5 个，法币必传 */
var FIAT_MAX_N   = 5;
var EXTRA_MAX_N  = 5;       /* RM-12 补充材料 ≤ 5 个，数币分支选填 */
var REPAY_METHOD = '先息后本 · 到期还本付息';  /* RP-12 单值（D-RP-49），只读文本、不做下拉 */

/* 演示"当前时刻"（服务端时间）。**本模块刻意比 WS-326 的 2026-09-11 晚三个月**：
   还款本来就发生在放款之后，同一批业务往前走了一段时间才有期次可还（见 README §5.5）。 */
var NOW      = '2026-12-18 10:40';
var TZ_LABEL = 'UTC+8';     /* 平台统一时区标注，口径引用 WS-308『01-国际化基线』第 4 节 */
/* Q-LN-01 待确认：客服邮箱地址由业务方提供。**本模块不另设一个邮箱**，
   共用 WS-326 登记的同一个占位常量（D-RP-55）。 */
var SUPPORT_MAIL = '{平台客服邮箱}';

/* ---- 融资业务状态（承接附册 A4.2；本模块新增业务状态数 = 0，D-RP-01）---- */
var FD_STATUS = {
  'S-FD-2':{ t:'待资产方处理', tone:'info', x:'报价已提交，资产方尚未接受或拒绝（WS-325）' },
  'S-FD-6':{ t:'还款中',      tone:'good', x:'融资确认完成，还款计划已定稿，按期还款中' },
  'S-FD-8':{ t:'已结清',      tone:'mute', x:'终态 · 全部期次已结清，两个额度量该笔归零' }
};
/* S-FD-9 逾期：**并行标记，不是状态**（D-FIN-09 / D-RP-35）。一笔业务可以同时
   「还款中」且「逾期」——三期里第一期逾期、第三期还没到期，做成互斥状态会让状态与事实不符。
   S-RP-4 还款异议处理中：本期不可达（X-LS-42 / X-LS-43 / D-RP-02）。条文保留、枚举保留，
   但界面**不为它准备文案与筛选项**，避免出现一个永远为空的 tab。 */

/* ---- 期次状态（承接附册 A4.3，一套跨模块共用）---- */
var RP_STATUS = {
  'S-RP-1':{ t:'待还款',      tone:'info' },
  'S-RP-2':{ t:'待还款确认',  tone:'amber' },
  'S-RP-3':{ t:'已结清',      tone:'green' }
};

/* ---- 身份：与 WS-324 / WS-325 / WS-326 同一套演示身份，不另造一套 ---- */
var ACTORS = {
  guest:{ k:'guest', t:'游客',   full:'未登录访客',           entity:null },
  asset:{ k:'asset', t:'资产方', full:'晟远科技（演示）',     entity:'E-ASSET-01' },
  fund: { k:'fund',  t:'资金方', full:'北岸融资租赁（演示）', entity:'E-FUND-07' }
};

/* ---- 区块浏览器（RM-13 由 RM-09 链 + RM-08 哈希拼出）----
   拼 URL 是本模块唯一与链有关的动作，**它只是拼一个字符串**：不发请求、不读链、不核验。 */
var EXPLORER = {
  'Ethereum':{ name:'Etherscan',  base:'https://etherscan.io/tx/' },
  'Tron'    :{ name:'Tronscan',   base:'https://tronscan.org/#/transaction/' },
  'Polygon' :{ name:'Polygonscan',base:'https://polygonscan.com/tx/' }
};

/* ---- 机构收款账户（QT-07 / QT-08 → RP-14 → RM-10）----
   还款时**只读带出报价时的值，不可修改、不可另填**（D-FIN-24 红线）。 */
var PAYEE_FIAT = {
  name:'Northbank Leasing (Demo) Co., Ltd.', acct:'USD88-2201-6734-0192',
  bank:'Bank of Communications, Shanghai Pudong Branch', swift:'COMMCNSHSDB', country:'中国大陆'
};
var PAYEE_COIN = { chain:'Ethereum', addr:'0x4F82Ac19Bb63d7E015aC8b1f2740e93Cc81De206' };

/* ---- 融资业务演示数据 ----
   t0    ＝ FD-35 起息日 ＝ LN-06 放款记录提交时间的**日期部分**（D-RP-11）。
           **不取 LN-05 提交方填写的发放时间**——它由资金方自己填、可以填任意过去日期（D-FIN-21）。
   fd34  ＝ 融资到期日，定稿时从该项目 FP-09 有效期至固化（D-RP-12）[待裁定 Q-RP-01]。
   paid  ＝ 该业务已产生的还款记录（RM-*），按期次序号索引。confirmAt 为空表示 S-RP-2。
   ws324:false 的项目是本模块为走通页面态新造的演示项目，WS-324 的项目表里没有它们，
   跨文件链接因此落到广场而不是一个不存在的详情页（不制造死链）。 */
var DEALS = [
  /* ① P-LS-09 的常规待还：法币 USD，第 1 期应还日 2026-12-20，已开窗（12-17 起）、未逾期 */
  { id:'FD-20260908-0061', pid:'FP-20260812-0031', pname:'华东电子元件应收账款池',
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:500000, rate:7.20, ccy:'USD', st:'S-FD-6', projExpired:false, planReady:true,
    quotedAt:'2026-09-08 14:20', acceptedAt:'2026-09-10 09:12',
    ln06:'2026-09-20 10:12', t0:'2026-09-20', fd24:'2026-09-22 09:30', fd34:'2027-08-14',
    fx:{ v:1.0000, at:'2026-09-08 14:20', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260908-T1420' },
    payee:JSON.parse(JSON.stringify(PAYEE_FIAT)),
    pool:{ bal:500000 }, cr:{ limit:1200000, used:850000 }, paid:{} },

  /* ② 同日两笔的排序演示（D-RP-22 ②）：与 ① 同一天应还（2026-12-20），
        但放款记录提交时间晚（15:40 vs 10:12）→ 排在 ① 之后、默认不选中 */
  { id:'FD-20260918-0067', pid:'FP-20260812-0031', pname:'华东电子元件应收账款池',
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:350000, rate:7.95, ccy:'USD', st:'S-FD-6', projExpired:false, planReady:true,
    quotedAt:'2026-09-18 09:05', acceptedAt:'2026-09-19 14:30',
    ln06:'2026-09-20 15:40', t0:'2026-09-20', fd24:'2026-09-23 11:05', fd34:'2027-08-14',
    fx:{ v:1.0000, at:'2026-09-18 09:05', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260918-T0905' },
    payee:JSON.parse(JSON.stringify(PAYEE_FIAT)),
    pool:{ bal:350000 }, cr:{ limit:1200000, used:850000 }, paid:{} },

  /* ③ 逾期演示：第 1 期应还日 2026-11-22 未提交 → 应还日次日 00:00 起打逾期标记，
        至 NOW 逾期 26 天。入口**保持开启**——关掉就等于不让人还钱（D-RP-35）。
        这也是 WS-326 在 P-LS-08「已确认」态交接过来的那一笔（同编号、同金额、同双方）。 */
  { id:'FD-20260820-0046', pid:'FP-20260416-0007', pname:'长三角医疗器械应收账款池',
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:500000, rate:6.80, ccy:'USD', st:'S-FD-6', projExpired:false, planReady:true,
    quotedAt:'2026-08-20 09:30', acceptedAt:'2026-08-21 10:10',
    ln06:'2026-08-22 14:26', t0:'2026-08-22', fd24:'2026-08-24 10:12', fd34:'2027-04-20',
    fx:{ v:1.0000, at:'2026-08-20 09:30', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260820-T0930' },
    payee:JSON.parse(JSON.stringify(PAYEE_FIAT)),
    pool:{ bal:500000 }, cr:{ limit:1200000, used:850000 }, paid:{} },

  /* ④ 数币分支：USDT · Ethereum。第 1 期应还日恰为 NOW 当日（2026-12-18）——
        当天提交**不算逾期**，逾期判定在应还日次日 00:00（D-RP-34） */
  { id:'FD-20260901-0053', pid:'FP-20260710-0024', pname:'华中医药流通应收账款池', ws324:false,
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:250000, rate:8.90, ccy:'USDT', st:'S-FD-6', projExpired:false, planReady:true,
    quotedAt:'2026-09-01 09:05', acceptedAt:'2026-09-06 10:44',
    ln06:'2026-09-18 20:18', t0:'2026-09-18', fd24:'2026-09-20 10:00', fd34:'2027-07-10',
    fx:{ v:0.9994, at:'2026-09-01 09:05', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260901-T0905' },
    payee:{ chain:'Ethereum', addr:PAYEE_COIN.addr },
    pool:{ bal:250000 }, cr:{ limit:1200000, used:850000 }, paid:{} },

  /* ⑤ P-LS-10 默认 + D-FIN-11 的样板：第 1 期应还日 2026-12-10，逾期 5 天后于 12-15 提交。
        逾期天数**冻结在 5**，机构再拖多久都不变（D-RP-30 ①）。剩余还款确认时限 3 天余。 */
  { id:'FD-20260904-0062', pid:'FP-20260416-0007', pname:'长三角医疗器械应收账款池',
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:200000, rate:7.40, ccy:'USD', st:'S-FD-6', projExpired:false, planReady:true,
    quotedAt:'2026-09-04 10:05', acceptedAt:'2026-09-07 09:50',
    ln06:'2026-09-10 16:20', t0:'2026-09-10', fd24:'2026-09-12 09:00', fd34:'2027-04-20',
    fx:{ v:1.0000, at:'2026-09-04 10:05', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260904-T1005' },
    payee:JSON.parse(JSON.stringify(PAYEE_FIAT)),
    pool:{ bal:200000 }, cr:{ limit:1200000, used:850000 },
    paid:{ 1:{ id:'RM20261215000001', at:'2026-12-15 09:26', given:'2026-12-15 09:05',
               files:[{ n:'银行支付凭证-长三角医疗器械-第1期.pdf', s:'0.8 MB' }],
               memo:'已于 12 月 15 日上午由上海分行汇出，汇出行手续费 260 元与电报费 150 元由我方承担；' +
                    '此前因财务复核延误 5 天，抱歉。', confirmAt:null } } },

  /* ⑥ P-LS-10 不足 24 小时：正常还款（应还日当日提交，不带逾期标记） */
  { id:'FD-20260902-0054', pid:'FP-20260624-0021', pname:'华北仪器仪表应收账款池',
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:300000, rate:8.35, ccy:'USD', st:'S-FD-6', projExpired:false, planReady:true,
    quotedAt:'2026-09-02 08:20', acceptedAt:'2026-09-04 13:15',
    ln06:'2026-09-12 02:10', t0:'2026-09-12', fd24:'2026-09-14 10:00', fd34:'2027-06-24',
    fx:{ v:1.0000, at:'2026-09-02 08:20', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260902-T0820' },
    payee:JSON.parse(JSON.stringify(PAYEE_FIAT)),
    pool:{ bal:300000 }, cr:{ limit:1200000, used:850000 },
    paid:{ 1:{ id:'RM20261212000001', at:'2026-12-12 00:15', given:'2026-12-11 16:30',
               files:[{ n:'银行支付凭证-华北仪器仪表-第1期.pdf', s:'0.6 MB' }],
               memo:'', confirmAt:null } } },

  /* ⑦ P-LS-10 数币确认：哈希 + 链 + 区块浏览器链接，常驻「平台未核验」。
        资产方是明泰家电——**不在 P-LS-09 的候选集合里**，顺带验跨主体隔离（D-FIN-25） */
  { id:'FD-20260907-0060', pid:'FP-20260712-0026', pname:'华南消费电子应收账款池', ws324:false,
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'明泰家电（演示）', entity:'E-ASSET-04',
    amt:450000, rate:8.10, ccy:'USDT', st:'S-FD-6', projExpired:false, planReady:true,
    quotedAt:'2026-09-07 11:05', acceptedAt:'2026-09-09 16:40',
    ln06:'2026-09-14 11:30', t0:'2026-09-14', fd24:'2026-09-16 09:20', fd34:'2027-07-12',
    fx:{ v:0.9994, at:'2026-09-07 11:05', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260907-T1105' },
    payee:{ chain:'Ethereum', addr:PAYEE_COIN.addr },
    pool:{ bal:450000 }, cr:{ limit:900000, used:450000 },
    paid:{ 1:{ id:'RM20261216000002', at:'2026-12-16 18:40', given:'2026-12-16 18:22',
               hash:'0x3b8f14ce7a2d05916be4c8037fd15a2e6c9704b1d83fa2570ce6148b39d0aa72',
               chain:'Ethereum', files:[], extra:[{ n:'钱包转账截图.png', s:'0.4 MB' }],
               memo:'链上手续费由我方承担，与本期应还金额无关。', confirmAt:null } } },

  /* ⑧ P-LS-10 确认已超期：逾期 5 天后提交，机构 8 天不确认。
        期次状态不变、额度不动、权限不变，**逾期天数仍然冻结在 5**（AC-RP-09） */
  { id:'FD-20260826-0050', pid:'FP-20260518-0015', pname:'西北矿业设备应收账款池', ws324:false,
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:200000, rate:7.90, ccy:'USD', st:'S-FD-6', projExpired:false, planReady:true,
    quotedAt:'2026-08-26 11:00', acceptedAt:'2026-08-27 15:30',
    ln06:'2026-08-28 09:00', t0:'2026-08-28', fd24:'2026-08-30 10:00', fd34:'2027-05-18',
    fx:{ v:1.0000, at:'2026-08-26 11:00', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260826-T1100' },
    payee:JSON.parse(JSON.stringify(PAYEE_FIAT)),
    pool:{ bal:200000 }, cr:{ limit:1200000, used:850000 },
    paid:{ 1:{ id:'RM20261203000001', at:'2026-12-03 09:10', given:'2026-12-02 17:40',
               files:[{ n:'银行支付凭证-西北矿业设备-第1期.pdf', s:'0.9 MB' }],
               memo:'12 月 2 日下午已汇出，请查收。', confirmAt:null } } },

  /* ⑨ 末期（含本金）待确认：项目已到期、业务照常履约——**这是常态路径**（D-FIN-47）。
        还本本来就发生在融资项目到期之后（X-LS-06），因此中性呈现、不做告警。 */
  { id:'FD-20260315-0018', pid:'FP-20251215-0088', pname:'华东汽车零部件应收账款池', ws324:false,
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:300000, rate:7.50, ccy:'USD', st:'S-FD-6', projExpired:true, planReady:true,
    quotedAt:'2026-03-12 10:40', acceptedAt:'2026-03-14 09:25',
    ln06:'2026-03-16 10:20', t0:'2026-03-16', fd24:'2026-03-18 09:40', fd34:'2026-12-15',
    fx:{ v:1.0000, at:'2026-03-12 10:40', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260312-T1040' },
    payee:JSON.parse(JSON.stringify(PAYEE_FIAT)),
    pool:{ bal:300000 }, cr:{ limit:1200000, used:850000 },
    paid:{ 1:{ id:'RM20260616000001', at:'2026-06-16 10:02', given:'2026-06-16 09:30',
               files:[{ n:'银行支付凭证-华东汽车零部件-第1期.pdf', s:'0.7 MB' }],
               memo:'', confirmAt:'2026-06-18 14:30' },
           2:{ id:'RM20261216000001', at:'2026-12-16 09:40', given:'2026-12-15 17:10',
               files:[{ n:'银行支付凭证-华东汽车零部件-末期本息.pdf', s:'1.1 MB' }],
               memo:'末期本金与利息一并汇出，汇出行为招商银行上海分行。', confirmAt:null } } },

  /* ⑩ 已结清（S-FD-8 终态）：三期全部 S-RP-3，两个量该笔归零，FD-33 落库。
        质押**不由本模块释放**——本模块只把「该笔已结清」这一事实交给 WS-324（D-RP-39）。 */
  { id:'FD-20251120-0009', pid:'FP-20251103-0021', pname:'北方精密铸造应收账款池', ws324:false,
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:200000, rate:6.50, ccy:'USD', st:'S-FD-8', projExpired:true, planReady:true,
    quotedAt:'2025-11-17 09:50', acceptedAt:'2025-11-18 15:20',
    ln06:'2025-11-20 11:15', t0:'2025-11-20', fd24:'2025-11-22 10:00', fd34:'2026-11-03',
    fd33:'2026-11-10 14:22',
    fx:{ v:1.0000, at:'2025-11-17 09:50', src:'WS-318 汇率管理 · 中间价', ver:'FX-20251117-T0950' },
    payee:JSON.parse(JSON.stringify(PAYEE_FIAT)),
    pool:{ bal:0 }, cr:{ limit:1200000, used:850000 },
    paid:{ 1:{ id:'RM20260220000001', at:'2026-02-20 10:30', given:'2026-02-20 09:40',
               files:[{ n:'银行支付凭证-北方精密铸造-第1期.pdf', s:'0.6 MB' }], memo:'',
               confirmAt:'2026-02-23 09:12' },
           2:{ id:'RM20260520000001', at:'2026-05-20 11:05', given:'2026-05-19 16:20',
               files:[{ n:'银行支付凭证-北方精密铸造-第2期.pdf', s:'0.6 MB' }], memo:'',
               confirmAt:'2026-05-22 10:40' },
           3:{ id:'RM20261103000001', at:'2026-11-03 15:48', given:'2026-11-03 14:10',
               files:[{ n:'银行支付凭证-北方精密铸造-末期本息.pdf', s:'1.0 MB' }],
               memo:'末期本金与利息一并汇出。', confirmAt:'2026-11-10 14:22' } } },

  /* ⑪ 还款计划生成中（E-RP-01 / 承接 WS-326 E-LN-13）：融资确认已完成、四个量已转移，
        计划生成失败或尚未就绪。**不展示错误**，也不回滚上游（D-RP-10） */
  { id:'FD-20260910-0065', pid:'FP-20261105-0061', pname:'华东精密模具应收账款池', ws324:false,
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:400000, rate:7.80, ccy:'USD', st:'S-FD-6', projExpired:false, planReady:false,
    quotedAt:'2026-12-10 09:30', acceptedAt:'2026-12-14 10:15',
    ln06:'2026-12-16 14:05', t0:'2026-12-16', fd24:'2026-12-18 09:55', fd34:'2027-11-05',
    fx:{ v:1.0000, at:'2026-12-10 09:30', src:'WS-318 汇率管理 · 中间价', ver:'FX-20261210-T0930' },
    payee:JSON.parse(JSON.stringify(PAYEE_FIAT)),
    pool:{ bal:400000 }, cr:{ limit:1200000, used:850000 }, paid:{} },

  /* ⑫ 报价期（S-FD-2）：只有**初始计划（试算版）**，不落号、不产生期次对象（D-RP-05）。
        基准日 ＝ QT-09 报价提交日（D-RP-04）。 */
  { id:'FD-20261215-0071', pid:'FP-20260812-0031', pname:'华东电子元件应收账款池',
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:600000, rate:8.40, ccy:'USD', st:'S-FD-2', projExpired:false, planReady:false,
    quotedAt:'2026-12-15 14:20', acceptedAt:null,
    ln06:null, t0:null, fd24:null, fd34:'2027-08-14',
    fx:{ v:1.0000, at:'2026-12-15 14:20', src:'WS-318 汇率管理 · 中间价', ver:'FX-20261215-T1420' },
    payee:JSON.parse(JSON.stringify(PAYEE_FIAT)),
    pool:{ bal:0 }, cr:{ limit:1200000, used:850000 }, paid:{} }
];

/* ---- 页面态 → 演示业务的映射。每个必达状态都能在原型里点到，不靠文字描述 ---- */
var ST_DEAL = {
  'P-LS-91':{ 'default':'FD-20260820-0046', 'initial':'FD-20261215-0071',
              'final':'FD-20260908-0061', 'overdue':'FD-20260820-0046',
              'generating':'FD-20260910-0065' },
  'P-LS-09':{ 'default':'FD-20260820-0046', 'normal':'FD-20260908-0061',
              'digital':'FD-20260901-0053', 'locked':'FD-20260908-0061',
              'submitted':'FD-20260904-0062', 'settled':'FD-20251120-0009',
              'generating':'FD-20260910-0065' },
  'P-LS-10':{ 'default':'FD-20260904-0062', 'soon':'FD-20260902-0054',
              'digital':'FD-20260907-0060', 'overdue':'FD-20260826-0050',
              'last':'FD-20260315-0018', 'done':'FD-20251120-0009' }
};
/* 页面态 → 默认选中的期次序号。缺省走 D-RP-21～D-RP-24 的排序结果（＝真正的「默认定位」）。 */
var ST_SEQ = { 'P-LS-09':{ 'locked':2, 'submitted':1, 'settled':3 },
               'P-LS-10':{ 'last':2, 'done':3 } };


/* ================================================================
   Part B —— 格式化、日期与还款计划的生成
   ================================================================ */
function pad2(n){ return (n < 10 ? '0' : '') + n; }
function amt(n){
  var s = (Math.round(n * 100) / 100).toFixed(2).split('.');
  return s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + s[1];
}
function money(n, ccy){ return amt(n) + ' ' + ccy; }
function usd(n){ return amt(n) + ' ' + CCY; }
function round2(n){ return Math.round(n * 100) / 100; }
function withTz(s){ return s ? s + ' ' + TZ_LABEL : '—'; }
function dayOnly(s){ return String(s || '').slice(0, 10); }

/* ---- 日期（一律按平台统一时区的日期部分运算，不引入本地时区）---- */
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
/* 分钟级时间（还款确认时限用），演示数据一律 'YYYY-MM-DD HH:MM' */
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
  if(mins <= 0) return '0 分钟';
  var d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  if(d > 0) return d + ' 天 ' + h + ' 小时';
  return h + ' 小时 ' + pad2(m) + ' 分钟';
}

/* ================================================================
   还款计划的生成（5.3 期次边界 + 5.4 计息口径）
   一处产生、多处消费：两版计划、还款页、确认页、增量页读的都是这一个函数的结果。
   期次边界（D-RP-13）：
     ① 自 T0 起每 3 个自然月取一个付息日（同日取，遇当月无同日取当月最后一日）；
     ② 凡严格早于 TN 的付息日各成一期利息期，本金为 0；
     ③ 末期的应还日恒为 TN，还该期利息 + 全部本金；
     ④ 计息区间＝上一边界日 → 本期应还日，**算头不算尾**（D-RP-19）；
     ⑤ 期数 N ≥ 1。
   末期并期（D-RP-14）[待裁定 Q-RP-02]：最后一个付息日与 TN 之间不足 3 个月时，该段
   **并入末期**——即那个付息日不单独成期，末期的计息区间因此可能长于 3 个月但不超过 6 个月。
   PRD 5.3 的样例（起息 2026-09-15、到期 2027-03-20 → **2 期**：12-15 付息、03-20 付息并还本）
   正是按这条并期规则得到的，本函数逐字照它实现，可用该样例反查。
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
    /* RP-07 本期应还利息 ＝ QT-03 × QT-06 年化利率 × 本期计息天数 ÷ 360，2 位小数四舍五入 */
    var interest = round2(principal * (ratePct / 100) * n / BASIS);
    var pri = last ? principal : 0, total = round2(pri + interest);
    out.push({ seq:i, from:from, due:due, days:n, principal:pri, interest:interest, total:total,
               /* RP-09 ＝ RP-08 ÷ QT-04 汇率快照，**还款时不得重新取汇率**（D-FIN-80） */
               settle:round2(total / fxV), last:last,
               /* RP-15 还款入口开启时间 ＝ 应还日前 3 个自然日 00:00（服务端下发绝对时刻） */
               openAt:addDays(due, -OPEN_DAYS) });
  }
  return out;
}
/* 定稿计划（RP-16 ＝ 定稿）：基准日取 FD-35 起息日 ＝ LN-06 的日期部分 */
function finalPlan(deal){
  if(!deal || !deal.planReady || !deal.t0) return [];
  return buildPlan(deal.t0, deal.fd34, deal.amt, deal.rate, deal.fx.v);
}
/* 初始计划（RP-16 ＝ 预计）：基准日取**预计放款日 ＝ QT-09 报价提交日**（D-RP-04）。
   派生试算、不落库、不占号、不产生期次对象（D-RP-05）。 */
function initialPlan(deal){
  if(!deal) return [];
  return buildPlan(dayOnly(deal.quotedAt), deal.fd34, deal.amt, deal.rate, deal.fx.v);
}

/* ---- 期次的派生状态：RP-10 状态 + RP-11 逾期标记与逾期天数 ---- */
function periodState(deal, p){
  var rec = (deal.paid || {})[p.seq] || null;
  var st = !rec ? 'S-RP-1' : (rec.confirmAt ? 'S-RP-3' : 'S-RP-2');
  /* D-RP-34：应还日次日 00:00 起未提交即打逾期标记，逾期天数每日 +1，不设宽限期。
     D-FIN-11 / D-RP-58：**提交还款记录即冻结**——此后机构再拖多久都不变。
     结清后逾期天数作为历史事实保留、不清零。 */
  var end = rec ? dayOnly(rec.at) : dayOnly(NOW);
  var od = Math.max(0, dayDiff(p.due, end) - GRACE_DAYS);
  return {
    seq:p.seq, st:st, rec:rec, overdue:od > 0, odDays:od,
    frozen:!!rec,                                   /* 逾期天数是否已冻结 */
    frozenAt:rec ? rec.at : null,                   /* RM-06，冻结时刻 */
    opened:dMs(NOW) >= dMs(p.openAt),               /* RP-15 是否已开窗 */
    /* RM-15 还款确认时限至 ＝ RM-06 + 168 小时，精确到秒；RM-16 剩余，下限 0 */
    limitAt:rec ? tstr(tmin(rec.at) + CONFIRM_HOURS * 60) : null,
    type:(od > 0 ? '逾期还款' : '正常还款')          /* RP-13 系统派生，用户不可选（D-RP-50） */
  };
}
function confirmClock(deal, p){
  var s = periodState(deal, p);
  if(!s.rec) return { has:false };
  var toM = tmin(s.limitAt), nowM = tmin(NOW), left = toM - nowM;
  var over = left <= 0 && !s.rec.confirmAt;
  return { has:true, to:s.limitAt, leftMin:Math.max(0, left),
           soon:left > 0 && left <= NEAR_HOURS * 60, over:over,
           overDays:Math.max(0, dayDiff(dayOnly(s.limitAt), dayOnly(NOW))),
           elapsedMin:Math.min(CONFIRM_HOURS * 60, Math.max(0, nowM - tmin(s.rec.at))) };
}
/* 业务级派生：已结清期数 / 总期数、累计已还（FD-30）、未偿本金（FD-31）、S-FD-9 标记（FD-32） */
function dealProgress(deal){
  var plan = finalPlan(deal), done = 0, paidPri = 0, paidInt = 0, od = null, next = null;
  plan.forEach(function(p){
    var s = periodState(deal, p);
    if(s.st === 'S-RP-3'){ done++; paidPri += p.principal; paidInt += p.interest; }
    if(s.st === 'S-RP-1' && s.overdue && (!od || s.odDays > od.days))
      od = { seq:p.seq, days:s.odDays, due:p.due };
    if(s.st === 'S-RP-1' && !next) next = p;
  });
  return { plan:plan, n:plan.length, done:done, paidPri:round2(paidPri), paidInt:round2(paidInt),
           unpaidPri:round2(deal.amt - paidPri), overdue:od, next:next,
           settled:deal.st === 'S-FD-8' };
}

function findDeal(id){ for(var i = 0; i < DEALS.length; i++) if(DEALS[i].id === id) return DEALS[i]; return null; }
function isFiat(deal){ return deal.ccy === CCY; }
function explorerUrl(chain, hash){
  var e = EXPLORER[chain]; return e ? e.base + hash : '';
}
function hashFormatOk(v){ return /^0x[0-9a-fA-F]{64}$/.test(String(v || '').trim()); }

/* ================================================================
   「最近一笔应还」的候选集合与排序（5.5，D-RP-21 ～ D-RP-24）
   候选 ＝ 当前登录资产方企业主体名下、所有处于 S-RP-1 的期次，**跨融资业务、跨融资项目**。
   排序键按序比较：① 应还日升序 → ② 该期次所属业务的实际放款日（LN-06）升序
                 → ③ 融资业务编号升序 → ④ 期次序号升序。默认选中 ＝ 排序后第一条。
   ⚠️ 反例（必须挡住）：按"距今最近"取绝对值会把明天到期的排在逾期 30 天的前面。
   ================================================================ */
function candidates(entity){
  var out = [];
  DEALS.forEach(function(deal){
    if(deal.entity !== entity || deal.st !== 'S-FD-6' || !deal.planReady) return;
    finalPlan(deal).forEach(function(p){
      var s = periodState(deal, p);
      if(s.st !== 'S-RP-1') return;               /* S-RP-2 / S-RP-3 没有可执行的还款动作 */
      out.push({ deal:deal, p:p, s:s });
    });
  });
  out.sort(function(a, b){
    if(a.p.due !== b.p.due) return a.p.due < b.p.due ? -1 : 1;
    if(a.deal.ln06 !== b.deal.ln06) return a.deal.ln06 < b.deal.ln06 ? -1 : 1;
    if(a.deal.id !== b.deal.id) return a.deal.id < b.deal.id ? -1 : 1;
    return a.p.seq - b.p.seq;
  });
  return out;
}

/* ================================================================
   available_actions（H-03 / AC-LS-113）
   服务端在每次读取时返回当前可执行动作清单，前端按其渲染、**不自行依据状态或日期推断**。
   须区分「不可见」（不返回）与「可见不可点 ⊘ + 可区分的原因」。
   `⊘` 的五种情形文案各异，**不存在只说"暂不可操作"的兜底**（AC-RP-17）。
   两个新增取值：repay / confirm_repayment（分册 6.8.2）。
   ================================================================ */
function repayAction(deal, p, role){
  var s = periodState(deal, p);
  var a = { key:'repay', label:'提交还款记录', enabled:false, reason:'', brief:'' };
  if(role === 'guest'){
    a.reason = '未登录。还款动作仅对该项目的资产方企业主体开放；本页 L1～L5 的公开字段' +
               '（期次、应还日、本息拆分、期次状态、逾期标记与逾期天数）不因未登录而隐藏。';
    a.brief = '需登录';
  } else if(deal.entity !== ACTORS[role].entity){
    a.reason = '该笔还款只属于该项目的资产方企业主体（' + deal.party + '）。当前身份为「' +
               ACTORS[role].full + '」。资金方在还款环节没有任何写入还款计划的权限——' +
               '计划由系统生成，机构不能改期、不能催收加码。';
    a.brief = '非本笔业务的资产方';
  } else if(s.st === 'S-RP-2'){
    a.reason = '该期已提交还款记录（' + s.rec.id + '，' + withTz(s.rec.at) +
               '），正在等待资金方确认。一个期次至多一条有效还款记录（D-RP-44），' +
               '提交后不可修改、不可撤回。';
    a.brief = '该期已提交待确认';
  } else if(s.st === 'S-RP-3'){
    a.reason = '该期已结清（' + withTz(s.rec.confirmAt) + '）。已结清的期次没有可执行的还款动作。';
    a.brief = '该期已结清';
  } else if(!s.opened){
    a.reason = '该期还款入口将于 ' + p.openAt + ' 00:00 ' + TZ_LABEL + ' 开启（应还日 ' + p.due +
               ' 前 ' + OPEN_DAYS + ' 个自然日）；**本期不支持提前还款**。' +
               '还本金只发生在融资项目到期之后，跳期还款、多期合并提交与一次性结清都不可用。';
    a.brief = '未开窗 · ' + p.openAt + ' 开启';
  } else {
    a.enabled = true;
  }
  return a;
}
function confirmAction(deal, p, role){
  var s = periodState(deal, p);
  var a = { key:'confirm_repayment', label:'确认收到还款', enabled:false, reason:'', brief:'' };
  if(s.st !== 'S-RP-2'){
    /* 期次不在 S-RP-2 时服务端**不返回**该动作（不可见，不是 ⊘） */
    a.absent = true;
    return a;
  }
  if(role === 'guest'){
    a.reason = '未登录。还款确认仅对该笔业务的资金方企业主体开放；还款记录的公开字段' +
               '（提交时间、币种与金额）本身是公开的，凭证、哈希与收款账户则一律不公开。';
    a.brief = '需登录';
  } else if(role !== 'fund' || deal.fundEntity !== ACTORS.fund.entity){
    a.reason = '还款确认只属于该笔业务的资金方企业主体（' + deal.fund + '）。当前身份为「' +
               ACTORS[role].full + '」。资产方在 S-RP-2 段没有任何写动作——' +
               '提交之后这笔还款算不算数，由收款的一方来认。';
    a.brief = '非本笔业务的资金方';
  } else {
    a.enabled = true;   /* 超期后照常返回、照常可用（D-RP-54） */
  }
  return a;
}


/* ================================================================
   Part C —— 共用片段
   ================================================================ */
var CF = window.CF, E = CF.esc, q = CF.q, pageHead = CF.pageHead, toast = CF.toast;
var S = null;

function pill(tone, t){ return '<span class="pill ' + tone + '">' + E(t) + '</span>'; }
var TONE = { mute:'gray', info:'', good:'green', warn:'amber', crit:'red' };

/* 跨文件入口：WS-324 / WS-325 / WS-326 原型与本模块是同级目录，按登记表拼相对地址，不写死路径 */
function modHref(key, hash){
  var m = (CF.MODULES || {})[key];
  return m ? '../' + m.dir + '/' + m.file + (hash || '') : '#';
}
function lsHref(hash){ return modHref('lending-marketplace', hash); }
function lnHref(hash){ return modHref('lending-disbursement', hash); }
function cqHref(hash){ return modHref('lending-credit-quote', hash); }
function projHref(deal){
  return deal.ws324 === false ? lsHref('#/plaza') : lsHref('#/project/' + deal.pid);
}
function backToPlaza(text){
  return '<div class="ls-back"><a class="btn" href="' + lsHref('#/plaza') + '">← ' +
    E(text || '返回融资需求广场') + '</a></div>';
}

/* ---- 页头（沿用 WS-324 / WS-325 / WS-326 的面客详情页版式，类名一字不改）---- */
function phead(kick, title, sub, tags, amtB){
  return '<div class="ls-phead"><div class="tile" aria-hidden="true">◎</div><div class="body">' +
    '<p class="kick">' + kick + '</p>' +
    '<h1>' + E(title) + (sub ? '<em>' + E(sub) + '</em>' : '') + '</h1>' +
    (tags ? '<div class="ls-tags">' + tags + '</div>' : '') +
  '</div>' + (amtB || '') + '</div>';
}
function amtBlock(k, v, cy, x){
  return '<div class="amt"><div class="k">' + E(k) + '</div>' +
    '<div class="v">' + v + (cy ? '<span class="cy">' + cy + '</span>' : '') + '</div>' +
    '<div class="x">' + x + '</div></div>';
}
function cardHead(t, note){
  return '<div class="card-head"><b>' + E(t) + '</b>' +
    (note ? '<span style="margin-left:auto">' + note + '</span>' : '') + '</div>';
}
function fold(title, cnt, body, open){
  return '<details class="ls-fold"' + (open ? ' open' : '') + '><summary>' +
    '<span class="ca" aria-hidden="true">▶</span>' + E(title) +
    (cnt ? '<span class="n">' + E(cnt) + '</span>' : '') + '</summary><div class="fb">' + body + '</div></details>';
}
function field(label, opt, body, hint){
  return '<div class="field"><label>' + E(label) + (opt ? '<span class="opt">' + E(opt) + '</span>' : '') + '</label>' +
    body + (hint ? '<p class="hint">' + hint + '</p>' : '') + '</div>';
}
function inp(key, val, ph, extra){
  return '<input class="inp' + (extra && extra.err ? ' err' : '') + '" type="' + ((extra && extra.type) || 'text') +
    '" value="' + E(val || '') + '" placeholder="' + E(ph || '') + '"' +
    (extra && extra.max ? ' maxlength="' + extra.max + '"' : '') +
    (extra && extra.attr ? ' ' + extra.attr : '') +
    ' data-act="rp.f" data-v="' + key + '">';
}
function ro(text, note){
  return '<div class="ls-ro">' + E(text) + '</div>' + (note ? '<p class="hint">' + note + '</p>' : '');
}
/* 动作按钮：区分「不可见」与「可见不可点 ⊘ + 可区分的原因」（H-03 / AC-RP-17）。
   reason 里允许出现 ** ** 强调，这里就地转成 <b>，其余一律转义。 */
function why(reason){
  return E(reason).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}
function actBtn(a, cls){
  if(a.absent) return '';
  if(a.enabled)
    return '<button class="btn ' + (cls || '') + '" type="button" data-act="rp.do" data-v="' + a.key + '">' +
      E(a.label) + '</button>';
  return '<button class="btn blocked ' + (cls || '').replace('primary', '') + '" type="button" aria-disabled="true" ' +
    'title="' + E(a.reason.replace(/\*\*/g, '')) + '" data-act="rp.why" data-v="' + a.key + '">⊘ ' + E(a.label) + '</button>' +
    '<div class="ls-why"><span class="sg" aria-hidden="true">⊘</span><span>' + why(a.reason) + '</span></div>';
}
/* 加载 / 失败三态外壳，三页共用（H-02：不报 404、不白屏、不静默跳首页） */
function skel(title){
  return pageHead(title, '') + '<div class="card"><div class="card-b">' +
    '<div class="skel" style="height:56px"></div><div class="skel" style="height:180px;margin-top:16px"></div>' +
    '<div class="skel" style="height:120px;margin-top:16px"></div></div></div>';
}
function failCard(title, b, body, action){
  return pageHead(title, '') + '<div class="card"><div class="tbl-empty"><b>' + E(b) + '</b>' + body +
    '<div style="margin-top:14px">' + (action ||
      '<button class="btn primary" type="button" data-act="st" data-v="default">重新加载</button>') +
    '</div></div></div>';
}
/* 脱敏按 WS-308『01-国际化基线』第 5/8 节，本模块不另定义一套 */
function maskAcct(s){ s = String(s || ''); return s.length <= 8 ? s : s.slice(0, 4) + '••••••' + s.slice(-4); }
function maskAddr(s){ s = String(s || ''); return s.length <= 16 ? s : s.slice(0, 10) + '…' + s.slice(-6); }
function shortHash(h){ h = String(h || ''); return h.length <= 24 ? h : h.slice(0, 12) + '…' + h.slice(-10); }
function markRow(tag, body, meta){
  return '<div class="ln-mark"><span class="tg">' + E(tag) + '</span><div class="bd">' + body +
    (meta ? '<div class="mt">' + meta + '</div>' : '') + '</div></div>';
}

/* ---- 业务页头：三页共用，状态 / 标记 / 金额一处产生 ---- */
function dealHead(deal, pageId, title, sub) {
  var st = FD_STATUS[deal.st] || { t:deal.st, tone:'mute' };
  var g = deal.planReady ? dealProgress(deal) : null;
  var tags = pill(TONE[st.tone] || 'gray', deal.st + ' ' + st.t) +
    pill('gray', '资产方 ' + deal.party) +
    pill('gray', '资金方 ' + deal.fund) +
    /* FD-32：S-FD-9 逾期是**并行标记不是状态**——业务状态仍是 S-FD-6 还款中 */
    (g && g.overdue ? pill('gray', 'S-FD-9 逾期（并行标记）· 最长 ' + g.overdue.days + ' 天') : '') +
    (g ? pill('gray', '已结清 ' + g.done + ' / ' + g.n + ' 期') : '') +
    (!deal.planReady && deal.st === 'S-FD-6' ? pill('gray', '还款计划生成中') : '') +
    (deal.projExpired ? pill('gray', '项目已到期 · 存量处理中') : '');
  return backToPlaza() + phead(
    '融资业务 · <span class="mono">' + pageId + '</span> · 编号 <span class="mono">' + deal.id +
      '</span> · 项目 <span class="mono">' + deal.pid + '</span> · 时区 ' + TZ_LABEL,
    title, sub, tags,
    amtBlock('融资金额 · QT-03', amt(deal.amt), CCY,
      '年化利率 ' + deal.rate.toFixed(2) + '%　·　结算币种 ' + deal.ccy +
      (isFiat(deal) ? '' : '　·　汇率快照 ' + deal.fx.v.toFixed(4))));
}

/* ---- 计息规则常驻条（RP-18 / AC-RP-04）---- */
function ruleBar(deal, plan, ver){
  var base = ver === 'draft' ? dayOnly(deal.quotedAt) : deal.t0;
  return '<div class="rp-rule"><div class="rt">' +
    '<b>年化</b>单利，实际天数 ÷ ' + BASIS + '（ACT/360），起息日计息、应还日不计息；' +
    '起息日 = <b>' + base + '</b>' + (ver === 'draft' ? '（预计放款日）' : '（实际放款日 · FD-35）') + '。' +
  '</div><div class="rx">' +
    '<div class="i"><div class="k">利率口径</div><div class="v"><b>年化</b> ' + deal.rate.toFixed(2) +
      '%（QT-06）。利率在报价时采集的就是年化百分比，本模块直接消费、不重开口径。</div></div>' +
    '<div class="i"><div class="k">单利 / 复利</div><div class="v"><b>单利</b>。先息后本下每期利息当期结清，' +
      '不存在未付利息滚入本金的情形。<span class="faint">[待裁定 Q-FIN-17]</span></div></div>' +
    '<div class="i"><div class="k">计息基数</div><div class="v"><b>ACT/360</b>。跨境美元融资的通行惯例；' +
      '用 365 会与线下合同算出的数字对不上。<span class="faint">[待裁定 Q-FIN-17]</span></div></div>' +
    '<div class="i"><div class="k">还款方式</div><div class="v"><b>' + REPAY_METHOD +
      '</b>。本期硬编码、只读文本展示，<b>不做下拉</b>（D-RP-49）。</div></div>' +
  '</div>' +
  '<div class="td">ACT/360 让「年化利率 × 整年」实际略高于名义利率（一年约多 1.39%）。' +
    '这是本条规则全文常驻、不折叠、不只给一个百分数的原因——它必须能被资产方自己按天数算一遍。</div></div>';
}

/* ---- 还款计划表（分册 6.6.1，两版共用一套结构）----
   ver: 'draft' 初始（预计 · 未生效）/ 'final' 定稿。
   表尾合计**只给 USD 口径**；结算币种金额只在单期内展示、不参与任何合计（D-RP-40）。 */
function planTable(deal, plan, ver, curSeq){
  var sumP = 0, sumI = 0, sumT = 0;
  var rows = plan.map(function(p){
    var s = ver === 'final' ? periodState(deal, p) : null;
    sumP += p.principal; sumI += p.interest; sumT += p.total;
    var cls = (p.last ? 'last ' : '') + (s && s.overdue && s.st === 'S-RP-1' ? 'odue ' : '') +
              (curSeq === p.seq ? 'cur' : '');
    return '<tr' + (cls.trim() ? ' class="' + cls.trim() + '"' : '') + '>' +
      '<td class="mono">第 ' + p.seq + ' 期' +
        (p.last ? '<div class="sub">含本金 · 到期还本付息</div>' : '') + '</td>' +
      '<td class="mono">' + p.due +
        (p.last ? '<div class="sub">恒等于融资到期日 FD-34</div>'
                : (ver === 'final' ? '<div class="sub">入口开启 ' + p.openAt + '</div>' : '')) + '</td>' +
      '<td class="mono">' + p.from + ' ~ ' + p.due + '<div class="sub">' + p.days + ' 天' +
        (p.last && p.days > 92 ? ' · 末期并入不足 ' + PERIOD_M + ' 个月的尾段（D-RP-14）' : '') + '</div></td>' +
      '<td class="mono num">' + (p.principal ? amt(p.principal) : '0.00') + '</td>' +
      '<td class="mono num">' + amt(p.interest) + '</td>' +
      '<td class="mono num"><b>' + amt(p.total) + '</b></td>' +
      '<td class="mono num">' + amt(p.settle) + ' ' + deal.ccy +
        (isFiat(deal) ? '' : '<div class="sub">按报价时锁定的汇率快照折算</div>') + '</td>' +
      (ver === 'final'
        ? '<td>' + pill(RP_STATUS[s.st].tone, s.st + ' ' + RP_STATUS[s.st].t) +
            (s.overdue ? '<div class="sub">已逾期 <b>' + s.odDays + '</b> 天' +
              (s.frozen ? '（已于 ' + s.frozenAt + ' 冻结）' : '（每日 +1）') + '</div>' : '') + '</td>'
        : '<td><span class="pill dash">预计 · 未生效</span></td>') +
    '</tr>';
  }).join('');
  return '<div class="tablewrap"><table class="tbl wide ls-tbl rp-plan">' +
    '<thead><tr><th>期次</th><th>' + (ver === 'final' ? '应还日 · RP-04' : '预计还款日') +
      '</th><th>计息区间与天数 · RP-05</th><th>应还本金 · RP-06</th><th>应还利息 · RP-07</th>' +
      '<th>应还合计 · RP-08</th><th>结算金额 · RP-09</th><th>' +
      (ver === 'final' ? '期次状态与标记' : '版本') + '</th></tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '<tfoot><tr><td class="lb" colspan="3">合计 · 仅 ' + CCY + ' 记账口径</td>' +
      '<td class="num">' + amt(sumP) + '</td><td class="num">' + amt(sumI) + '</td>' +
      '<td class="num">' + amt(sumT) + '</td>' +
      '<td class="lb" style="font-size:11px;color:var(--faint);font-weight:400">结算币种金额不参与任何合计</td>' +
      '<td></td></tr></tfoot></table></div>' +
    '<p class="hint" style="margin-top:10px">' +
      '合计一律按 <b>' + CCY + '</b> 记账口径给出（D-FIN-13）。' +
      '<b>跨币种不得求和</b>：同一资产方名下多笔业务的结算币种可能不同，把 USDT 与 USD 加在一起是错的，' +
      '界面上不存在这样的合计行（D-RP-40）。</p>';
}

/* ---- 两条轴：计息停止点 vs 还款记录终结点（D-FIN-11 / D-RP-29 / D-RP-30 / AC-RP-09）----
   viewer: 'asset' 资产方视角 / 'fund' 资金方视角 / 'guest'。
   这是本模块最不能被优化掉的一条，因此给它一个独立的、看得见的形状。 */
function freezeCard(deal, p, viewer){
  var s = periodState(deal, p);
  var k = confirmClock(deal, p);
  var submitted = !!s.rec, confirmed = submitted && !!s.rec.confirmAt;
  return '<div class="rp-freeze"><div class="fh">计息停止点与还款记录终结点是两件事' +
    '<span class="at">D-FIN-11 · D-RP-29</span></div>' +

    /* 轴一：时间的停止 —— 停在提交时刻 */
    '<div class="rp-ax"><div class="an"><span class="t">轴一 · 时间的停止</span>' +
      '<span class="s">停在<b>资产方提交成功</b>的那一刻（RM-06 服务端时间）</span></div>' +
      '<div class="track">' +
        '<div class="seg2"><div class="sk">应还日</div><div class="sv">' + p.due + '</div>' +
          '<div class="sx">当日 24:00 前提交即不逾期；不设宽限期（D-RP-34）。</div></div>' +
        '<div class="seg2' + (s.overdue ? ' on' : '') + '"><div class="sk">逾期累加</div>' +
          '<div class="sv">' + (s.overdue ? '已逾期 ' + s.odDays + ' 天' : '未发生') + '</div>' +
          '<div class="sx">' + (s.overdue
            ? '自应还日次日 00:00 起每日 +1' + (submitted ? '，已停止累加。' : '，当前仍在累加。')
            : '该期未触发逾期标记。') + '</div></div>' +
        '<div class="seg2 stop"><div class="sk">停止时刻</div>' +
          '<div class="sv">' + (submitted ? s.rec.at : '尚未提交') + '</div>' +
          '<div class="sx">' + (submitted
            ? '逾期天数<b>冻结在 ' + s.odDays + ' 天</b>，此后不再 +1；该期不再产生任何新的逾期事件与逾期通知。'
            : '提交成功的同一刻停止，与资金方确认与否无关。') + '</div></div>' +
      '</div>' +
      '<div class="mark2"><i aria-hidden="true">■</i><span>停止点由 <b>RM-06 提交时间</b> 决定，' +
        '<b>不是</b>资金方的确认时刻，也<b>不是</b>提交方自己填写的还款时间（RM-05）。</span></div></div>' +

    /* 轴二：状态的终结 —— 停在确认时刻 */
    '<div class="rp-ax"><div class="an"><span class="t">轴二 · 状态的终结</span>' +
      '<span class="s">停在<b>资金方确认收到还款</b>的那一刻（RM-18）</span></div>' +
      '<div class="track">' +
        '<div class="seg2' + (!submitted ? ' on' : '') + '"><div class="sk">S-RP-1 待还款</div>' +
          '<div class="sv">' + (submitted ? '已离开' : '当前') + '</div>' +
          '<div class="sx">还款入口按期次逐个开窗。</div></div>' +
        '<div class="seg2' + (submitted && !confirmed ? ' on' : '') + '"><div class="sk">S-RP-2 待还款确认</div>' +
          '<div class="sv">' + (submitted ? (confirmed ? '已离开' : '当前') : '未到达') + '</div>' +
          '<div class="sx">' + (submitted && !confirmed
            ? '还款确认时限至 ' + s.limitAt + '；' + (k.over
                ? '已超过 ' + k.overDays + ' 天，<b>状态不变、额度不动、权限不变</b>。'
                : '剩余 ' + fmtDur(k.leftMin) + '。到期只发通知，<b>不自动视为确认</b>。')
            : '两个额度量在这一段<b>一个都不动</b>。') + '</div></div>' +
        '<div class="seg2 stop"><div class="sk">S-RP-3 已结清</div>' +
          '<div class="sv">' + (confirmed ? s.rec.confirmAt : '待资金方确认') + '</div>' +
          '<div class="sx">' + (p.principal
            ? '含本金期次：同刻 <b>项目融资余额</b> 与 <b>授信占用额</b> 等额递减。'
            : '利息期结清：两个量<b>一动不动</b>——它们是未偿本金的合计，利息不在其中。') + '</div></div>' +
      '</div>' +
      '<div class="mark2"><i aria-hidden="true">■</i><span>期次结清、额度递减、业务进 S-FD-8 ' +
        '<b>都必须等资金方确认</b>——这一条没有被削弱。</span></div></div>' +

    '<div class="ff">' + (viewer === 'fund'
      ? '一句话：<b>确认决定"这笔还款算不算数"，提交决定"时间停在哪一刻"。</b>' +
        '对方的逾期天数已经在他提交的那一刻定住了，<b>不会因为您暂时不确认而继续增加</b>；' +
        '您也不会因为多花几天核对而让他多背一天逾期。请按实际到账情况决定是否确认，不要为了"赶时间"而确认。'
      : '一句话：<b>确认决定"这笔还款算不算数"，提交决定"时间停在哪一刻"。</b>' +
        '您把钱打了、记录提交了，<b>机构不确认不会让您多付利息、也不会让您继续背逾期</b>。' +
        '本期每期利息在计划定稿时就已固定（D-RP-09），<b>不按日重算</b>——' +
        '"提前几天提交少付利息"或"晚几天提交多付利息"在本期都不存在。') +
    '</div></div>';
}

/* ---- 客服邮箱卡（D-RP-55）：本期还款异议的唯一入口，三处必须出现 ---- */
function mailCard(deal, p, where){
  var s = p ? periodState(deal, p) : null;
  var rpNo = (s && s.rec) ? planNo(deal, p) : (p ? planNo(deal, p) : '—');
  return '<div class="ln-mail"><div class="mh">对这笔还款有异议？走客服邮箱线下核实</div>' +
    '<div class="ad"><span class="em">' + E(SUPPORT_MAIL) + '</span>' +
    '<button class="btn sm" type="button" data-act="rp.copyMail">复制邮箱与两个编号</button></div>' +
    '<p>请在邮件中注明<b>融资业务编号 ' + deal.id + '</b> 与<b>还款计划编号 ' + rpNo + '</b>。' +
    (where === 'confirm'
      ? '金额不符、凭证有问题、款根本没到——<b>平台上没有「提出异议」入口</b>（本期不做），' +
        '您唯一能做的是<b>先不要点确认</b>，并与对方联系。'
      : '如果机构迟迟不确认，<b>先不要重复提交</b>——一个期次至多一条有效还款记录，' +
        '重复提交不会产生第二条，也不会加快确认。') +
    '</p><p><b>平台不会代为确认、不会自动确认，也不会因此判定资产方逾期。</b>' +
    '平台<b>不承诺处理时效、不承诺处理结果</b>——邮箱是把双方接上线的通道，不是一个仲裁入口。</p></div>';
}

/* RP-01 还款计划编号：定稿时刻按期生成，一期一个。**初始计划不占号**（D-RP-05）。
   规则：前缀 RP + 服务端日期 + 当日 6 位序号（Q-FIN-19 结论）。演示值按定稿日派生。 */
function planNo(deal, p){
  if(!deal || !deal.planReady || !p) return '—';
  var n = String(p.seq); while(n.length < 6) n = '0' + n;
  return 'RP' + dayOnly(deal.fd24).replace(/-/g, '') + n;
}

/* ---- 机构收款账户（RP-14 / RM-10 / D-FIN-24 红线）----
   **这里没有输入框，不是置灰的输入框**：可改就等于给了钓鱼的口子。 */
function payeeRo(deal, forParty){
  if(!forParty){
    return '<div class="rp-acct"><div class="lock"><i aria-hidden="true">▤</i><span>' +
      '<b>机构收款账户不对外公开</b>。它只对该笔业务的双方可见，由服务端按归属过滤——' +
      '接口响应里根本不含这些字段，不是前端隐藏（D-RP-41 / AC-LS-110）。</span></div></div>';
  }
  var f = isFiat(deal), pay = deal.payee;
  var g = f
    ? '<div><div class="k">开户行</div><div class="v">' + E(pay.bank) + '</div></div>' +
      '<div><div class="k">账号</div><div class="v">' + E(maskAcct(pay.acct)) + '</div></div>' +
      '<div><div class="k">户名</div><div class="v">' + E(pay.name) + '</div></div>' +
      '<div><div class="k">SWIFT</div><div class="v">' + E(pay.swift) + '</div></div>' +
      '<div><div class="k">国别 / 地区</div><div class="v">' + E(pay.country) + '</div></div>'
    : '<div><div class="k">链</div><div class="v">' + E(pay.chain) + '</div></div>' +
      '<div><div class="k">收款地址</div><div class="v">' + E(maskAddr(pay.addr)) + '</div></div>';
  return '<div class="rp-acct"><div class="ag">' + g + '</div>' +
    '<div class="lock"><i aria-hidden="true">⊘</i><span>' +
    '该账户为<b>机构报价时提供的 ' + (f ? 'QT-07' : 'QT-08') + '</b>，还款时<b>不可修改、不可另填</b>。' +
    '本区<b>没有任何编辑控件</b>——不是置灰的输入框，是不存在输入框。' +
    '可改就等于给了钓鱼的口子（D-FIN-24）。地址与账号按 WS-308 脱敏基线展示。</span></div></div>';
}

/* ---- 交易哈希块（RM-08 / RM-09 / RM-13 / D-RP-43 / AC-RP-10）---- */
function hashBlock(rec, compact){
  var url = explorerUrl(rec.chain, rec.hash), e = EXPLORER[rec.chain] || { name:'区块浏览器' };
  return '<div class="ln-hash"><div class="hv">' + E(compact ? shortHash(rec.hash) : rec.hash) + '</div>' +
    '<div class="meta"><span>链 · RM-09 <b>' + E(rec.chain) + '</b></span>' +
    '<span>格式 <b>0x + 64 位十六进制</b>（沿用 WS-318 D-TI-06）</span></div>' +
    '<div class="lk"><a class="btn sm" href="' + E(url) + '" target="_blank" rel="noopener noreferrer">在 ' +
      E(e.name) + ' 上打开</a>' +
    '<span class="nv">平台未核验该交易，链接仅供自行查验</span></div>' +
    '<p class="hint" style="margin-top:9px">本期<b>只做格式校验、不做链上核验</b>：不接索引服务，' +
    '既不做阻断式也不做告警式（D-RP-42，承接放款侧 D-LN-10）。这意味着提交方可以填一个格式正确但不存在的哈希——' +
    '这个风险由确认环节的人工判断兜底。</p></div>';
}

/* ---- 还款时间 vs 提交时间并列（RM-05 / RM-06 / D-FIN-21）---- */
function timesPair(rec){
  return '<div class="ln-pair">' +
    '<div class="t"><div class="k">还款时间 · RM-05</div><div class="v">' + withTz(rec.given) + '</div>' +
      '<div class="src">来源：<b>提交方填写</b>。可为过去时间、不得晚于提交时刻。' +
      '<b>任何时效与计息都不使用它</b>——它只是业务参考与对账依据（D-FIN-21）。</div></div>' +
    '<div class="t auth"><div class="k">提交时间 · RM-06</div><div class="v">' + withTz(rec.at) + '</div>' +
      '<div class="src">来源：<b>服务端记录</b>。本模块的权威时间：' +
      '<b>停止逾期累加的时点</b>，以及<b>还款确认时限的起算点</b>。</div></div></div>';
}

/* ---- 页脚：本模块不触达链上（承接 D-FIN-67 / X-LS-52）---- */
function noChainFoot(what){
  return '<p class="hint" style="margin-top:14px">本步骤（' + E(what) +
    '）<b>不产生任何链上操作、不消耗 gas</b>：还款的转账发生在<b>平台之外</b>' +
    '（您自己的钱包或银行），平台只收下哈希与链的文本记录。' +
    '本模块<b>不发起任何链上调用</b>，也<b>不释放、不提取任何质押</b>——' +
    '质押的释放与提取由 <a class="btn-link" href="' + lsHref('#/my-projects') +
    '">WS-324 融资需求与代币质押</a> 承接（D-RP-39）。</p>';
}


/* ================================================================
   Part D —— P-LS-91 还款计划（两版对照 + 定稿全表）
   ⚠️ 页号说明：PRD 把还款计划表定义为**一张跨页面共用的表**（分册 6.6.1：报价接受页 /
   还款页 / 业务详情 / 控制台），没有给它一个独立页号。但 F-LS-60 / 62 / 63 / 64 四个
   功能点都落在这张表上，其中 F-LS-63「定稿通知的新旧对比」本身就要求两版同屏。
   因此原型侧给它一个**内部页 P-LS-91**，与 WS-324 的 P-LS-90「我的融资项目」同一处理：
   **取 90 段避让 PRD 连号段位**（P-LS-01/02/03 · 04/05/06 · 07/08 · 09/10 已被占用），
   不自造 PRD 段位的号，也不要据此把它当成 PRD 已定义的页面。
   ================================================================ */

/* 两版对照（D-RP-04 ～ D-RP-08 / AC-RP-02）：差异来源只有一个——实际放款日。 */
function versusCard(deal){
  var dft = initialPlan(deal), fin = finalPlan(deal);
  var baseD = dayOnly(deal.quotedAt), baseF = deal.t0;
  var shift = dayDiff(baseD, baseF);
  var sumI = function(a){ var s = 0; a.forEach(function(p){ s += p.interest; }); return round2(s); };

  function mini(plan, other, ver){
    return '<table class="mini"><thead><tr><th>期次</th>' +
      '<th>' + (ver === 'draft' ? '预计还款日' : '应还日') + '</th><th>天数</th><th>应还合计</th></tr></thead><tbody>' +
      plan.map(function(p, i){
        var o = other[i];
        var dDif = o && o.due !== p.due, nDif = o && o.days !== p.days, tDif = o && o.total !== p.total;
        return '<tr><td>第 ' + p.seq + ' 期' + (p.last ? '<div class="sub" style="font-size:10px;color:var(--faint)">含本金</div>' : '') + '</td>' +
          '<td class="n' + (dDif ? ' dif' : ' same') + '">' + p.due + '</td>' +
          '<td class="n' + (nDif ? ' dif' : ' same') + '">' + p.days + '</td>' +
          '<td class="n' + (tDif ? ' dif' : ' same') + '">' + amt(p.total) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  return '<div class="rp-vs">' +
    '<div class="rp-ver draft"><div class="vh"><span class="tag">预计 · 未生效</span>初始还款计划（试算版）</div>' +
      '<div class="vb"><div class="base"><span class="k">基准日 · 预计放款日</span>' +
        '<span class="v">' + baseD + '</span>' +
        '<span class="src">取 <b>QT-09 报价提交日</b>（D-RP-04）。报价提交那一刻商务条款固化、汇率快照锁定，' +
        '用同一时刻做试算基准，双方在同一张表上看到的是同一套数。' +
        '任何"接受日 + N 天"的口径都要凭空造一个 N，而 S-FD-3 段没有时限、机构什么时候放款不受约束。' +
        '<span class="faint">[待裁定 Q-RP-03 的相邻项：本册取 QT-09]</span></span></div>' +
        mini(dft, fin, 'draft') + '</div>' +
      '<div class="vf"><b>不落库、不占号、不产生期次对象</b>（D-RP-05）。它是一张按当前 QT-* 实时算出来的表；' +
        '报价被拒绝、失效或终止时随之消失，<b>不留残留期次</b>。代价是事后不可回溯，' +
        '缓解手段是接受环节的展示留痕 <b>FD-28</b>。</div></div>' +

    '<div class="rp-ver final"><div class="vh"><span class="tag">已定稿</span>定稿还款计划' +
      '<span style="margin-left:auto;font-size:11px;color:var(--faint)" class="mono">FD-29 ' + deal.fd24 + '</span></div>' +
      '<div class="vb"><div class="base"><span class="k">基准日 · 实际放款日 · FD-35</span>' +
        '<span class="v">' + baseF + '</span>' +
        '<span class="src">取 <b>LN-06 放款记录提交时间</b>的日期部分（D-RP-11）。' +
        '<b>不取 LN-05 提交方填写的发放时间</b>——它由资金方自己填、可以填任意过去日期；' +
        '也<b>不取 FD-24 确认到账时间</b>——那是资产方点确认的时刻，可能比实际打款晚好几天，' +
        '用它等于让资产方通过拖延确认来少付利息。</span></div>' +
        mini(fin, dft, 'final') + '</div>' +
      '<div class="vf"><b>定稿即锁死</b>（D-RP-09）：此后任何人都不能修改期次、日期、金额与计息规则。' +
        '可以叠加在计划之上的只有三样：<b>逾期标记、还款记录、结清事实</b>。' +
        '本期不存在展期、重组与条款变更入口。</div></div></div>' +

    '<div class="rp-why"><div class="wh">两版差在哪、为什么差</div><div class="wg">' +
      '<div class="w"><div class="k">起息日</div><div class="v">' + baseD + ' <span class="ch">→</span> ' + baseF + '</div>' +
        '<div class="x">' + (shift === 0 ? '恰好同日，本笔两版起息日未变。'
          : '实际放款比报价提交<b>晚 ' + shift + ' 天</b>。这是两版之间<b>唯一</b>变动的输入。') + '</div></div>' +
      '<div class="w"><div class="k">期数</div><div class="v">' + dft.length + ' <span class="ch">→</span> ' +
        fin.length + ' 期</div><div class="x">' +
        (dft.length === fin.length ? '未变。期次边界规则（3 个自然月一期、末期并入）两版一致。'
                                   : '因起息日移动跨过了一个 3 个月边界而变化。') + '</div></div>' +
      '<div class="w"><div class="k">末期应还日</div><div class="v">' +
        (dft.length ? dft[dft.length - 1].due : '—') + ' <span class="ch">＝</span> ' +
        (fin.length ? fin[fin.length - 1].due : '—') + '</div>' +
        '<div class="x"><b>不变</b>。末期应还日恒等于融资到期日 FD-34（取该项目 FP-09），' +
        '不随起息日移动。</div></div>' +
      '<div class="w"><div class="k">利息合计</div><div class="v">' + amt(sumI(dft)) +
        ' <span class="ch">→</span> ' + amt(sumI(fin)) + '</div>' +
        '<div class="x">差 <b>' + amt(Math.abs(round2(sumI(fin) - sumI(dft)))) + ' ' + CCY +
        '</b>。起息日后移使总计息天数减少 ' + Math.abs(dayDiff(baseF, baseD)) + ' 天。</div></div>' +
    '</div>' +
    '<p><b>变的是日期，以及由日期派生的天数与利息。公式、年化利率、本金、期次边界规则一个都没变。</b>' +
    '两版之间不存在任何"口径变更"，也不是一次条款变更——' +
    '初始那版从产生的第一刻就标着「预计 · 未生效」，并在表下常驻告知了它会按实际放款日重算并定稿。' +
    '这段告知在您接受报价时的展示事实与展示时间已留痕（<b>FD-28</b>），' +
    '正是为了在这一刻可以拿出来对账。</p></div>';
}

function pageSchedule(){
  var deal = dealOf('P-LS-91');
  if(S.st === 'loading') return skel('还款计划');
  if(S.st === 'error')
    return failCard('还款计划', '还款计划未能加载',
      '<p>服务端未返回该笔业务的还款计划期次。<b>期次、应还日与开窗时刻必须由服务端下发绝对时刻、' +
      '前端只负责渲染</b>——按本地时间推算会在跨时区与时钟偏差下与服务端判定不一致（AC-LS-112）。</p>');
  if(!deal) return failCard('还款计划', '未找到该笔融资业务', '<p>编号可能已变更或不属于当前身份可见范围。</p>');

  var own = (S.role === 'asset' && deal.entity === ACTORS.asset.entity);
  var isFund = (S.role === 'fund' && deal.fundEntity === ACTORS.fund.entity);
  var g = deal.planReady ? dealProgress(deal) : null;

  /* ---- 还款计划生成中（E-RP-01）：中性标记，**不展示错误** ---- */
  if(!deal.planReady && deal.st === 'S-FD-6'){
    return dealHead(deal, 'P-LS-91', '还款计划', '生成中') +
      '<div class="card"><div class="card-b">' +
      markRow('还款计划生成中',
        '融资确认已于 <b>' + withTz(deal.fd24) + '</b> 完成，四个量已原子转移，债务已成立。' +
        '还款计划正在生成，就绪后本页自动显示完整期次。',
        '生成动作可重试且必须幂等——重试不会产生第二套期次（E-RP-01）') +
      CF.note('',
        '<b class="ls-b">这不是一个错误页。</b>还款计划生成失败<b class="ls-b">不回滚</b>上游的额度转移与状态迁移' +
        '（承接 WS-326 E-LN-13）：钱已到账、债务已成立是事实，不能因为平台自己的一个后续动作没做成就退回去。' +
        '<p>因此这里<b class="ls-b">不展示错误、不给重试按钮、不给失败原因</b>——' +
        '重试是平台侧的事，把它摆到资产方面前只会制造一个他无法处置的焦虑：' +
        '他既不能催，也没有可做的动作。</p>' +
        '<p>在计划就绪之前：<b class="ls-b">没有任何期次可还</b>，也<b class="ls-b">不会产生逾期</b>——' +
        '逾期判定的对象是期次，而期次还不存在。</p>', '为什么这里不是"加载失败"') +
      '</div></div>' +
      '<div class="card" style="margin-top:16px">' + cardHead('已经确定的事', '<span class="faint">计划生成后不再变化</span>') +
      '<div class="card-b"><div class="ls-kgrid">' +
        '<div><div class="k">起息日 · FD-35</div><div class="v">' + deal.t0 + '</div>' +
          '<div class="x">＝ LN-06 放款记录提交时间的日期部分</div></div>' +
        '<div><div class="k">融资到期日 · FD-34</div><div class="v">' + deal.fd34 + '</div>' +
          '<div class="x">定稿时从该项目的<b>项目有效期至 · FP-09</b> 固化，此后不随项目对象变化</div></div>' +
        '<div><div class="k">本金 · QT-03</div><div class="v">' + usd(deal.amt) + '</div>' +
          '<div class="x">按融资金额计，不按实收计</div></div>' +
        '<div><div class="k">年化利率 · QT-06</div><div class="v">' + deal.rate.toFixed(2) + '%</div>' +
          '<div class="x">报价时固化</div></div>' +
      '</div>' + noChainFoot('查看还款计划') + '</div></div>';
  }

  /* ---- 报价期：只有初始计划（试算版）---- */
  if(deal.st === 'S-FD-2'){
    var dft = initialPlan(deal);
    return dealHead(deal, 'P-LS-91', '初始还款计划', '试算版') +
      '<div class="ls-alert">' + CF.note('',
        '这张表<b class="ls-b">整表未生效</b>。实际还款日将在放款确认后按<b class="ls-b">实际放款日</b>重算并定稿，' +
        '届时以定稿计划为准；<b class="ls-b">每期金额的计算规则不变</b>。' +
        '<p>本表按<b class="ls-b">预计放款日 ' + dayOnly(deal.quotedAt) +
        '</b>（＝ 报价提交日 QT-09）试算，<b class="ls-b">不落库、不占号、不产生期次对象</b>；' +
        '报价被拒绝、失效或终止时它随之消失，不留残留期次。</p>', '预计 · 未生效') + '</div>' +
      '<div class="card">' + cardHead('初始还款计划（试算版）',
        '<span class="faint">RP-16 ＝ 预计 · 公开字段，与报价的公开商务条款同级</span>') +
      '<div class="card-b">' + planTable(deal, dft, 'draft', null) +
        '<div style="margin-top:16px">' + ruleBar(deal, dft, 'draft') + '</div>' +
        CF.note('',
          '<b class="ls-b">日期列名带「预计」二字。</b>' +
          '整表的「预计 · 未生效」标识、列名里的「预计」、表下这句常驻告知——三处缺一不可（D-RP-06）。' +
          '<p>在计划定稿之前，本页每一处提到这张表与表上的日期时<b class="ls-b">都带「初始」或「预计」限定</b>：' +
          '平台没有资格把一个试算出来的日期说成是确定的（AC-RP-01）。</p>') +
        '<div class="btnbar" style="margin-top:16px">' +
          '<a class="btn" href="' + cqHref('#/deal/' + deal.id + '?action=respond_quote') +
          '">去接受 / 拒绝报价（P-LS-06）</a></div>' +
        noChainFoot('查看初始还款计划') + '</div></div>';
  }

  /* ---- 定稿后：默认两版对照，另可单看定稿全表 ---- */
  var fin = finalPlan(deal);
  var body = '';
  if(S.st === 'final' || S.st === 'overdue'){
    body = '<div class="card">' + cardHead('定稿还款计划',
      '<span class="faint">RP-16 ＝ 定稿 · 定稿时间 FD-29 ' + deal.fd24 + ' ' + TZ_LABEL + '</span>') +
      '<div class="card-b">' + planTable(deal, fin, 'final', null) +
      '<div style="margin-top:16px">' + ruleBar(deal, fin, 'final') + '</div></div></div>';
  } else {
    body = '<div class="card">' + cardHead('两版还款计划对照',
      '<span class="faint">F-LS-63 · 初始（预计）vs 定稿</span>') +
      '<div class="card-b">' + versusCard(deal) + '</div></div>' +
      '<div class="card" style="margin-top:16px">' + cardHead('定稿还款计划 · 全表',
        '<span class="faint">RP-01 ～ RP-18 · 公开字段</span>') +
      '<div class="card-b">' + planTable(deal, fin, 'final', null) +
      '<div style="margin-top:16px">' + ruleBar(deal, fin, 'final') + '</div></div></div>';
  }

  /* 逾期标记：并行标记，中性呈现（D-RP-24 / D-RP-35 / D-RP-46） */
  var marks = '';
  if(g && g.overdue){
    marks += markRow('已逾期',
      '第 ' + g.overdue.seq + ' 期（应还日 ' + g.overdue.due + '）已逾期 <span class="day">' +
      g.overdue.days + '</span> 天，逾期天数每日 +1，<b>提交还款记录即冻结</b>（D-FIN-11）。' +
      '该期还款入口<b>保持开启</b>——关掉就等于不让人还钱。',
      '平台<b>不计算罚息、不展示罚息金额、不把罚息并入任何应还金额</b>（X-LS-45）：' +
      '罚息率是商务条款，报价只采集了年化利率，平台手里没有它。逾期的呈现只有两样：标记与天数。');
    marks += markRow('S-FD-9 逾期 · 并行标记',
      '业务状态<b>仍是 S-FD-6 还款中</b>。一笔业务可以同时「还款中」且「逾期」——' +
      '三期里第一期逾期、第三期还没到期，做成互斥状态会让状态与事实不符（D-FIN-09 / D-RP-35）。',
      '逾期<b>不触发任何自动处置</b>：不处置质押代币、不强制平仓、不代偿、不提前到期（X-LS-46）；' +
      '也<b>不影响该资产方在其他机构的授信</b>（X-LS-47，跨主体隔离继续成立）。');
  }
  if(deal.projExpired)
    marks += markRow('已到期 · 存量处理中',
      '融资项目已于 <b>' + deal.fd34 + '</b> 到期。停止的是「接受新报价 / 再次发布」，' +
      '<b>存量融资业务照常履约中</b>。',
      '这是<b>常态路径</b>，不是异常：还本本来就发生在融资项目到期之后（X-LS-06）。' +
      '本模块的每一笔业务几乎都会在这个标记下走完全程，因此一律中性呈现，' +
      '不用告警色、不写"项目已过期"（D-FIN-47 / AC-RP-18）。');
  if(g && g.settled)
    marks += markRow('已结清',
      '全部 <b>' + g.n + '</b> 期已结清，业务于 <b>' + withTz(deal.fd33) +
      '</b> 进入 S-FD-8 已结清（终态）。项目融资余额与授信占用额该笔已归零，S-FD-9 标记已清除。',
      '业务编号<b>保留但作废</b>、不回收不复用（承接 D-FIN-78）。' +
      '逾期天数作为<b>历史事实保留</b>在 RP-11 里、不清零——它是留痕。');

  var rail = '<aside class="portal-rail">' +
    '<div class="card">' + cardHead('这笔的还款进度', '<span class="faint">公开字段 · L5</span>') +
    '<div class="card-b"><div class="ls-kgrid">' +
      '<div><div class="k">已结清 / 总期数</div><div class="v">' + g.done + ' / ' + g.n + '</div>' +
        '<div class="x">利息期结清不递减任何额度</div></div>' +
      '<div><div class="k">最近一笔应还</div><div class="v">' + (g.next ? g.next.due : '—') + '</div>' +
        '<div class="x">' + (g.next ? '应还合计 ' + usd(g.next.total) : '无待还期次') + '</div></div>' +
      '<div><div class="k">累计已还本金 / 利息 · FD-30</div><div class="v">' +
        amt(g.paidPri) + ' / ' + amt(g.paidInt) + '</div>' +
        '<div class="x">' + CCY + ' · 待确认期次不计入</div></div>' +
      '<div><div class="k">未偿本金 · FD-31</div><div class="v">' + amt(g.unpaidPri) + '</div>' +
        '<div class="x">它就是 项目融资余额 与 授信占用额 的被加数</div></div>' +
    '</div></div></div>' +
    (own || isFund ? '' : '<div class="card"><div class="card-b"><p class="hint">' +
      '<b>当前身份看到的是公开字段</b>：期次数与已结清期数、每期应还日、每期应还本息与合计（USD）、' +
      '期次状态、逾期标记与逾期天数、结清时间、还款记录的提交时间与币种金额。<br>' +
      '<b>不公开</b>：还款凭证文件、交易哈希与链、机构收款账户快照、还款备注与补充材料、确认备注。' +
      '它们由服务端按归属过滤，接口响应里不含这些字段（D-RP-41 / AC-LS-110）。</p></div></div>') +
    '<div class="card ln-annot">' + cardHead('本期没有的东西', '<span class="faint">反向清单 · 原型注解</span>') +
    '<div class="card-b"><p class="hint">本页<b>不存在</b>：修改期次 / 日期 / 金额的入口、展期与重组、' +
      '条款变更、期次调整、提前结清与一次性还清、部分还款、罚息金额、宽限期设置、' +
      '还款方式下拉（本期单值、硬编码）、期间长度可配置的暗示、' +
      '任何"结清后代币将自动回到您的钱包"的表述（AC-RP-19）。<br>' +
      '这些不是"还没做"，是本期明确不做。</p></div></div>' +
    '<div class="card"><div class="card-b"><p class="hint">深链锚点 <span class="mono">deal/' + deal.id +
      '?action=repay</span> 落还款录入并按 D-RP-22 定位最近一笔应还；<span class="mono">schedule/{id}?action=repay</span> 直达指定期次。<br>' +
      '<b>期次是可寻址对象，还款记录不是</b>：还款记录永远在期次里呈现，故不新增 ' +
      '<span class="mono">repayment/{id}</span> 这一层（D-RP-59）。</p></div></div></aside>';

  return dealHead(deal, 'P-LS-91', '还款计划', deal.planReady ? '已定稿' : '') +
    missingBanner() +
    (marks ? '<div class="ls-alert">' + marks + '</div>' : '') +
    '<div class="portal-cols"><div>' + body +
      '<div class="card" style="margin-top:16px">' + cardHead('接下来去哪儿') + '<div class="card-b">' +
      '<div class="btnbar">' +
        (own ? '<button class="btn primary" type="button" data-act="rp.toRepay" data-v="' + deal.id +
               '">去还款（P-LS-09）</button>' : '') +
        '<a class="btn" href="' + projHref(deal) + '">融资需求详情（P-LS-02）</a>' +
        '<a class="btn" href="' + lnHref('#/deal/' + deal.id + '?action=confirm_disbursement') +
          '">放款与融资确认（WS-326）</a>' +
      '</div>' + noChainFoot('查看还款计划') + '</div></div>' +
    '</div>' + rail + '</div>';
}


/* ================================================================
   Part D2 —— P-LS-09 还款录入（资产方）
   ================================================================ */

/* ---- 期次选择器（分册 6.6.2 / D-RP-21 ～ D-RP-26）----
   候选集合是**跨融资业务、跨融资项目**的：资产方在还款页看到的是"我要还的钱"，
   不是"这个项目要还的钱"。排序键写在每一行上，因为 D-RP-22 的排序结果必须可核对。 */
function selector(sel){
  var list = candidates(ACTORS.asset.entity);
  var grpOd = [], grpDue = [], grpLocked = [];
  list.forEach(function(c){
    if(c.s.overdue) grpOd.push(c);
    else if(c.s.opened) grpDue.push(c);
    else grpLocked.push(c);
  });
  /* 当前选中的期次若已不在候选集合里（S-RP-2 / S-RP-3 / 计划未就绪），
     单独列一组说明它为什么没有可执行动作——不隐藏、不报错（AC-LS-114）。 */
  var outside = null;
  if(sel && sel.p){
    var inSet = false;
    list.forEach(function(c){ if(c.deal.id === sel.deal.id && c.p.seq === sel.p.seq) inSet = true; });
    if(!inSet) outside = sel;
  }
  var idx = 0;
  function opt(c, disabled){
    idx++;
    var cur = sel && sel.deal.id === c.deal.id && sel.p.seq === c.p.seq;
    var a = repayAction(c.deal, c.p, 'asset');
    return '<button class="rp-opt" type="button" ' +
      (disabled ? 'aria-disabled="true" data-act="rp.whySeq" data-v="' + c.deal.id + ':' + c.p.seq + '"'
                : 'data-act="rp.sel" data-v="' + c.deal.id + ':' + c.p.seq + '"') +
      ' aria-pressed="' + !!cur + '">' +
      '<span class="ix">' + (disabled ? '⊘' : idx) + '</span>' +
      '<span class="ob"><span class="o1"><span class="dt">' + c.p.due + '</span>' +
        '<span class="dl">第 ' + c.p.seq + ' 期 / 共 ' + finalPlan(c.deal).length + ' 期' +
        (c.p.last ? ' · 含本金' : ' · 利息期') + '</span>' +
        (c.s.overdue ? pill('gray', '已逾期 ' + c.s.odDays + ' 天') : '') +
        (!c.s.opened ? pill('dash', '未开窗') : '') + '</span>' +
        '<span class="o2">' + E(c.deal.pname) + ' · 业务 <span class="key">' + c.deal.id + '</span>' +
        ' · 排序键：应还日 <span class="key">' + c.p.due + '</span> → 实际放款日 <span class="key">' +
        c.deal.ln06 + '</span> → 业务编号 <span class="key">' + c.deal.id + '</span>' +
        (disabled ? '<br>' + E(a.brief) + '：' + E(a.reason.replace(/\*\*/g, '')) : '') + '</span></span>' +
      '<span class="oa">' + amt(c.p.total) + ' ' + CCY +
        '<span class="oc">结算 ' + amt(c.p.settle) + ' ' + c.deal.ccy + '</span></span>' +
      (disabled ? '<span class="blk" aria-hidden="true">⊘</span>' : '') + '</button>';
  }
  function grp(title, arr, note, disabled){
    if(!arr.length) return '';
    return '<div class="rp-grp"><div class="gh">' + E(title) +
      '<span class="n">' + arr.length + ' 期' + (note ? ' · ' + E(note) : '') + '</span></div>' +
      arr.map(function(c){ return opt(c, disabled); }).join('') + '</div>';
  }
  return '<div class="rp-sel">' +
    grp('已逾期', grpOd, '排在最上方分组', false) +
    grp('待还款 · 已开窗', grpDue, '应还日升序', false) +
    grp('待还款 · 未开窗（可见不可选）', grpLocked, '附开启日期', true) +
    (outside ? '<div class="rp-grp"><div class="gh">当前查看 · 无可执行的还款动作' +
        '<span class="n">1 期</span></div>' +
        opt({ deal:outside.deal, p:outside.p, s:outside.s }, true) + '</div>' : '') +
    (!list.length && !outside ? '<div class="tbl-empty"><b>当前没有待还款的期次</b>' +
      '名下所有融资业务的期次都已提交或已结清。</div>' : '') +
    '</div>' +
    '<p class="hint" style="margin-top:10px"><b>默认选中排序后的第一条</b>，您可以改选任何一个<b>已开窗</b>的期次。' +
    '排序键按序比较：① 应还日升序 → ② 该期次所属业务的<b>实际放款日</b>（LN-06 放款记录提交时间）升序 ' +
    '→ ③ 融资业务编号升序 → ④ 期次序号升序。<br>' +
    '<b>逾期的必然排在未到期的前面</b>：逾期期次的应还日必然更早，按应还日升序排它天然在前。' +
    '按"距今最近"取绝对值排序会把明天到期的排在逾期 30 天的前面，资产方就会先还新账、旧账一直滚——' +
    '那正是这条排序要挡住的（D-RP-24）。<br>' +
    '<b>未开窗的可见但不可选，不隐藏</b>：隐藏会让资产方以为计划少了几期。</p>';
}

/* ---- 五个拦截点（6.2.2 / D-RP-25 / AC-RP-07）---- */
function stopCards(sel){
  var next = sel && sel.p ? sel.p : null;
  return '<div class="rp-stop">' +
    '<div class="s"><div class="sn"><i>1</i>入口按期次逐个开窗</div>' +
      '<div class="sx">开启时间 <b>RP-15 ＝ 应还日前 ' + OPEN_DAYS + ' 个自然日 00:00</b>，' +
      '开启后一直保持开启直到该期结清。未开窗的期次在上面的下拉里<b>可见但 ⊘</b>，附原因与开启日期。</div>' +
      '<div class="wh">第 N 期开窗<b>不会</b>让第 N+1 期跟着开。</div></div>' +
    '<div class="s"><div class="sn"><i>2</i>一次只能提交一个期次</div>' +
      '<div class="sx">本页表单<b>绑定单个期次</b>：<b>不存在多选框、不存在"全选"</b>。' +
      '真正被挡住的是跳期还款与多期合并提交。</div>' +
      '<div class="wh">选择器是单选按钮组，不是复选列表。</div></div>' +
    '<div class="s"><div class="sn"><i>3</i>金额只读</div>' +
      '<div class="sx">RM-04 <b>只读等于</b>该期 RP-08 应还合计' +
      (next ? '（<b>' + usd(next.total) + '</b>）' : '') + '，<b>不可编辑</b>。' +
      '这一条同时挡住了<b>部分还款</b>与<b>超额还款</b>。</div>' +
      '<div class="wh">下方金额区没有 input，是只读读值。</div></div>' +
    '<div class="s"><div class="sn"><i>4</i>没有提前结清入口</div>' +
      '<div class="sx">界面上<b>不存在</b>「提前结清」「一次性还清」「提前还本」按钮与文案。' +
      '还本金只发生在融资项目到期之后（X-LS-06）。</div>' +
      '<div class="wh">这是一条反向验收：全文检索这三个词应为 0 处产品文案。</div></div>' +
    '<div class="s"><div class="sn"><i>5</i>服务端终检</div>' +
      '<div class="sx">提交时服务端<b>重新判定</b>该期是否已开窗、是否仍为 S-RP-1、是否为本人名下。' +
      '<b>前端的 ⊘ 与隐藏均不构成校验</b>（E-RP-03）。</div>' +
      '<div class="wh">页面停留过久或绕过前端时，服务端拒绝并返回该期的开启日期。</div></div>' +
    '</div>' +
    '<p class="hint" style="margin-top:11px"><b>为什么提前 ' + OPEN_DAYS + ' 天开窗不构成"提前还款"</b>：' +
    '① 金额一分不少——RM-04 只读等于本期应还合计；' +
    '② 经济上完全等价——每期利息在定稿时已固定、不按日重算，提前 ' + OPEN_DAYS +
    ' 天提交<b>不会少付一分钱利息</b>，资产方没有任何提前的动机；' +
    '③ 动不了别的期——开窗是逐期的。<br>' +
    '<b>为什么不是"到期日当天才开"</b>：跨境电汇到账普遍需要 1～3 个工作日，数币转账也要等区块确认；' +
    '当天才允许发起就等于要求当天完成跨境支付，而逾期判定在次日 00:00，几乎所有法币还款都会被判逾期' +
    '（D-RP-27）。<span class="faint">[待裁定 Q-RP-03：' + OPEN_DAYS + ' 天是本册默认取值，改 N 只改一个常量]</span></p>';
}

/* ---- 还款表单的校验结论（前端就地校验；服务端终检另有一层）---- */
function formState(deal, p){
  var f = S.f, fiat = isFiat(deal);
  var given = (f.given || '').trim();
  var givenOk = !!given && tmin(given) <= tmin(NOW);
  var hashOk = fiat ? true : hashFormatOk(f.hash);
  var filesOk = fiat ? (f.files.length >= FIAT_MIN_N && f.files.length <= FIAT_MAX_N) : true;
  return { fiat:fiat, given:given, givenOk:givenOk, hash:(f.hash || '').trim(), hashOk:hashOk,
           filesOk:filesOk, ok:givenOk && hashOk && filesOk };
}

function repayForm(deal, p, act){
  var v = formState(deal, p), f = S.f;
  var fiat = v.fiat;
  var body =
    field('还款币种 · RM-03', '只读',
      ro(deal.ccy + (fiat ? '（法币）' : '（数字货币）'),
         '恒等于报价时确定的 <b>QT-02</b>，<b>不可临时更换</b>——换币种等于改商务条款。')) +
    field('还款金额 · RM-04', '只读',
      ro(usd(p.total) + '　（结算金额 ' + amt(p.settle) + ' ' + deal.ccy + '）',
         '<b>只读等于该期 RP-08 应还合计</b>：本金 ' + amt(p.principal) + ' + 利息 ' + amt(p.interest) +
         '。结算金额按<b>报价时锁定的汇率快照 ' + deal.fx.v.toFixed(4) +
         '</b> 折算，<b>还款时不重新取汇率</b>（D-FIN-80）。本期不支持部分还款与超额还款。')) +
    field('还款时间 · RM-05', '必填 · 可填过去、不得晚于提交时刻',
      inp('given', f.given, '2026-12-18 09:30',
          { err:!!f.given && !v.givenOk, attr:'inputmode="numeric"' }),
      (!!f.given && !v.givenOk
        ? '<span style="color:var(--danger)">还款时间晚于提交时刻，服务端将拒绝提交（E-RP-07）。' +
          '<b>时间可以填过去，不能填未来</b>——未来的还款时间意味着钱还没打。</span>'
        : '格式 <span class="mono">YYYY-MM-DD HH:MM</span>（' + TZ_LABEL + '）。' +
          '<b>仅作对账参考，时效与计息不使用该时间</b>：逾期冻结点与还款确认时限起点一律取服务端记录的提交时间 RM-06（D-FIN-21）。'));

  if(fiat){
    body += field('银行支付凭证 · RM-07', '必传 · ' + FIAT_MIN_N + '～' + FIAT_MAX_N + ' 个',
      '<div class="drop" role="button" tabindex="0" data-act="rp.upload" data-v="file">' +
        '<div class="ic" aria-hidden="true">↑</div><div><b>点击上传银行支付凭证</b>' +
        '<div class="hint" style="margin-top:3px">PDF / JPG / PNG · 单文件 ≤ ' + FILE_MAX_MB +
        ' MB · ' + FIAT_MIN_N + '～' + FIAT_MAX_N + ' 个（沿用 WS-305 第 6 节基线，' +
        '<b>与放款侧 LN-07 完全一致、不另定一套</b>）</div></div></div>' +
      (S.f.upErr ? '<div class="ls-alert" style="margin-top:12px">' +
        CF.note('red', S.f.upErr, '凭证未通过') + '</div>' : '') +
      (f.files.length ? '<div style="margin-top:12px">' + f.files.map(function(fl, i){
        return '<div class="filecard" style="margin-top:8px"><div class="ic" aria-hidden="true">▤</div>' +
          '<div class="bd"><b>' + E(fl.n) + '</b><span>' + E(fl.s) + '</span></div>' +
          '<div class="act"><button class="btn sm" type="button" data-act="rp.rmFile" data-v="' + i +
          '">移除</button></div></div>';
      }).join('') + '</div>' : ''),
      '<b>平台不审核真伪</b>：只校验格式、大小与数量。凭证<b>不公开</b>，仅该笔业务双方可见（D-RP-41）。');
  } else {
    body += field('交易哈希 · RM-08', '必填 · 只做格式校验',
      inp('hash', f.hash, '0x + 64 位十六进制', { err:!!f.hash && !v.hashOk }),
      (!!f.hash && !v.hashOk
        ? '<span style="color:var(--danger)">格式不合法：须为 <span class="mono">0x</span> + 64 位十六进制' +
          '（沿用 WS-318 D-TI-06）。<b>平台不会提示"该交易不存在"</b>——它没有这个判断能力（E-RP-04）。</span>'
        : '<b>只做格式校验、不做链上核验</b>（D-RP-42）。提交后页面给出区块浏览器链接，' +
          '旁边常驻「平台未核验该交易，链接仅供自行查验」。')) +
    field('链 · RM-09', '只读 · 等于 QT-08 的链',
      ro(deal.payee.chain,
         '链<b>只读带出且必须等于报价时约定的链</b>，不一致拒绝提交、<b>不提供"仍要继续"</b>（E-RP-05）：' +
         'USDT / USDC 是多链资产，链不同就是两笔完全不同的转账。')) +
    field('补充材料 · RM-12', '选填 · ≤ ' + EXTRA_MAX_N + ' 个',
      '<div class="drop" role="button" tabindex="0" data-act="rp.upload" data-v="extra">' +
        '<div class="ic" aria-hidden="true">↑</div><div><b>点击上传补充材料</b>' +
        '<div class="hint" style="margin-top:3px">如钱包转账截图 · PDF / JPG / PNG · 单文件 ≤ ' +
        FILE_MAX_MB + ' MB</div></div></div>' +
      (f.extra.length ? '<div style="margin-top:12px">' + f.extra.map(function(fl, i){
        return '<div class="filecard" style="margin-top:8px"><div class="ic" aria-hidden="true">▤</div>' +
          '<div class="bd"><b>' + E(fl.n) + '</b><span>' + E(fl.s) + '</span></div>' +
          '<div class="act"><button class="btn sm" type="button" data-act="rp.rmExtra" data-v="' + i +
          '">移除</button></div></div>';
      }).join('') + '</div>' : ''), '法币分支不使用本字段（凭证走 RM-07）。');
  }

  body += field('还款备注 · RM-11', '选填 · ≤ ' + MEMO_MAX + ' 字',
    '<textarea class="inp" rows="3" maxlength="' + MEMO_MAX + '" data-act="rp.f" data-v="memo" ' +
    'placeholder="例如：已通过上海分行电汇，汇出行手续费与电报费由我方承担，中转行扣费以入账为准。">' +
    E(f.memo || '') + '</textarea>',
    '<b>对资金方可见</b>——它常常是解释手续费、分行、到账时间的唯一位置。已填 ' +
    (f.memo || '').trim().length + ' / ' + MEMO_MAX + ' 字。备注<b>不公开</b>。');

  return body +
    '<div class="btnbar" style="margin-top:18px">' + actBtn(act, 'primary') + '</div>' +
    (act.enabled && !v.ok
      ? '<p class="hint">补齐必填项后方可提交：' +
        (v.givenOk ? '' : '还款时间未填或晚于提交时刻；') +
        (v.filesOk ? '' : '银行支付凭证需 ' + FIAT_MIN_N + '～' + FIAT_MAX_N + ' 个；') +
        (v.hashOk ? '' : '交易哈希格式不合法。') + '</p>'
      : '');
}

function pageRepay(){
  if(S.st === 'loading') return skel('还款录入');
  if(S.st === 'error')
    return failCard('还款录入', '还款计划与期次未能加载',
      '<p>服务端未返回该资产方名下的待还款期次。<b>开窗时刻 RP-15 与逾期标记必须由服务端下发</b>，' +
      '前端不得自行按日期推算是否已开窗（AC-LS-112 / D-RP-60）。</p>');

  var sel = currentSel();
  if(!sel) return failCard('还款录入', '未找到该期次',
    '<p>该期次可能已结清、已提交，或不属于当前身份可见范围。' +
    '页面落到说明页而不是 404、白屏或静默跳首页（H-02 / AC-LS-114）。</p>');

  var deal = sel.deal, p = sel.p, s = sel.s;
  var own  = (S.role === 'asset' && deal.entity === ACTORS.asset.entity);

  /* 还款计划生成中：本页接住这个中间态，**不让它变成一个错误页**（E-RP-01）。
     这一段必须排在取 available_actions 之前——计划未就绪时期次对象还不存在，
     没有可供判定的对象，动作清单本身也不该被构造出来。 */
  if(!deal.planReady || !p){
    return dealHead(deal, 'P-LS-09', '还款录入', '') +
      '<div class="ls-alert">' + markRow('还款计划生成中',
        '融资确认已于 <b>' + withTz(deal.fd24) + '</b> 完成，还款计划正在生成。' +
        '计划就绪前<b>没有任何期次可还</b>，也<b>不会产生逾期</b>——逾期判定的对象是期次，而期次还不存在。',
        '额度转移与状态迁移<b>不因此回滚</b>（承接 WS-326 E-LN-13）；这里不展示错误、不给重试按钮') + '</div>' +
      '<div class="card"><div class="card-b">' +
      '<div class="btnbar"><button class="btn" type="button" data-act="rp.toSchedule" data-v="' + deal.id +
      '">查看还款计划（P-LS-91）</button><a class="btn" href="' + projHref(deal) + '">融资需求详情</a></div>' +
      noChainFoot('还款录入') + '</div></div>';
  }

  var act = repayAction(deal, p, S.role);
  var g   = dealProgress(deal);
  var marks = '';
  if(s.st === 'S-RP-2')
    marks += markRow('该期已提交待确认',
      '第 ' + p.seq + ' 期已于 <b>' + withTz(s.rec.at) + '</b> 提交还款记录 <b>' + s.rec.id +
      '</b>，正在等待 ' + E(deal.fund) + ' 确认。<b>还款入口已关闭</b>——一个期次至多一条有效还款记录（D-RP-44）。',
      '并发提交<b>串行结算、先落库者成功</b>，后到者提示"该期已提交还款记录"并落详情页，' +
      '不产生第二条记录（E-RP-02）。提交后<b>不可修改、不可撤回</b>（X-LS-49）。');
  if(s.overdue)
    marks += markRow('已逾期',
      '第 ' + p.seq + ' 期（应还日 ' + p.due + '）' +
      (s.frozen ? '逾期 <span class="day">' + s.odDays + '</span> 天，已于 <b>' + s.frozenAt +
                  '</b> 提交时冻结，此后不再 +1。'
                : '已逾期 <span class="day">' + s.odDays + '</span> 天，每日 +1。' +
                  '<b>提交还款记录后逾期天数即冻结</b>（D-FIN-11），机构确认与否不影响这个数。'),
      '本期<b>只记逾期天数、不算罚息</b>：罚息率是商务条款，报价只采集了年化利率，平台手里没有它，' +
      '凭空取一个就是替双方定合同条款（D-RP-46 / X-LS-45）。逾期期次的还款入口<b>保持开启</b>。');
  if(deal.projExpired)
    marks += markRow('已到期 · 存量处理中',
      '融资项目已于 <b>' + deal.fd34 + '</b> 到期，<b>存量融资业务照常履约中</b>。',
      '这是<b>常态路径</b>：还本本来就发生在融资项目到期之后（X-LS-06 / D-FIN-47）。');
  if(g.settled)
    marks += markRow('该笔业务已结清',
      '全部 <b>' + g.n + '</b> 期已结清，业务于 <b>' + withTz(deal.fd33) + '</b> 进入 S-FD-8（终态）。' +
      '本笔已没有可执行的还款动作。',
      '项目融资余额与授信占用额该笔已归零，S-FD-9 标记已清除。');

  /* ---- 第一区：本期计划信息（只读）---- */
  var planInfo = '<div class="ls-kgrid">' +
    '<div><div class="k">融资业务编号 · FD-01</div><div class="v">' + deal.id + '</div>' +
      '<div class="x">' + E(deal.pname) + '</div></div>' +
    '<div><div class="k">还款计划编号 · RP-01</div><div class="v">' + planNo(deal, p) + '</div>' +
      '<div class="x">定稿时刻按期生成，全局唯一、终身稳定</div></div>' +
    '<div><div class="k">期次序号 · RP-03</div><div class="v">第 ' + p.seq + ' 期 / 共 ' + g.n + ' 期</div>' +
      '<div class="x">' + (p.last ? '末期 · 含本金 · 到期还本付息' : '利息期 · 本金为 0') + '</div></div>' +
    '<div><div class="k">应还日 · RP-04</div><div class="v">' + p.due + '</div>' +
      '<div class="x">' + (p.last ? '恒等于融资到期日 FD-34' : '入口开启 ' + p.openAt + ' 00:00') + '</div></div>' +
    '<div><div class="k">计息区间与天数 · RP-05</div><div class="v">' + p.from + ' ~ ' + p.due + '</div>' +
      '<div class="x">' + p.days + ' 天 · 算头不算尾（起息日计息、应还日不计息）</div></div>' +
    '<div><div class="k">本期应还本金 · RP-06</div><div class="v">' + amt(p.principal) + '</div>' +
      '<div class="x">' + (p.last ? '＝ QT-03 融资金额' : '利息期本金为 0（先息后本）') + '</div></div>' +
    '<div><div class="k">本期应还利息 · RP-07</div><div class="v">' + amt(p.interest) + '</div>' +
      '<div class="x">' + amt(deal.amt) + ' × 年化 ' + deal.rate.toFixed(2) + '% × ' + p.days +
      ' ÷ ' + BASIS + '</div></div>' +
    '<div><div class="k">本期应还合计 · RP-08</div><div class="v">' + amt(p.total) + '</div>' +
      '<div class="x">' + CCY + ' · 还款金额 RM-04 只读等于本项</div></div>' +
    '<div><div class="k">本期应还结算金额 · RP-09</div><div class="v">' + amt(p.settle) + ' ' + deal.ccy + '</div>' +
      '<div class="x">÷ 汇率快照 ' + deal.fx.v.toFixed(4) + ' · 只在单期内展示、不参与任何合计</div></div>' +
    '<div><div class="k">期次状态 · RP-10</div><div class="v" style="font-family:var(--sans)">' +
      pill(RP_STATUS[s.st].tone, s.st + ' ' + RP_STATUS[s.st].t) + '</div>' +
      '<div class="x">S-RP-4 还款异议处理中本期不产生</div></div>' +
    '<div><div class="k">还款方式 · RP-12</div><div class="v" style="font-family:var(--sans)">' +
      REPAY_METHOD + '</div><div class="x">单值 · 只读文本、不做下拉</div></div>' +
    '<div><div class="k">还款类型 · RP-13</div><div class="v" style="font-family:var(--sans)">' + s.type + '</div>' +
      '<div class="x">系统派生、用户不可选（带逾期标记则为逾期还款）</div></div>' +
  '</div>' +
  (s.overdue && s.st === 'S-RP-1'
    ? CF.note('', '该期已逾期 <b class="ls-b">' + s.odDays + '</b> 天。' +
      '<b class="ls-b">提交还款记录后逾期天数即冻结</b>，此后不再增加——' +
      '机构什么时候点确认，都不会让这个数继续涨（D-FIN-11）。' +
      '<p>本期逾期<b class="ls-b">不产生任何金额后果</b>：不计罚息、不计复利、应还金额一分不变' +
      '（每期利息在计划定稿时就已固定）。</p>', '关于这 ' + s.odDays + ' 天')
    : '');

  /* ---- 主体 ---- */
  var main = '<div class="card">' + cardHead('选择要还的期次',
      '<span class="faint">D-RP-21 ～ D-RP-24 · 跨融资业务、跨融资项目</span>') +
    '<div class="card-b">' + selector(sel) + '</div></div>' +

    '<div class="card" style="margin-top:16px">' + cardHead('① 本期计划信息',
      '<span class="faint">只读 · 定稿即锁死 D-RP-09</span>') +
    '<div class="card-b">' + planInfo + '</div></div>' +

    '<div class="card" style="margin-top:16px">' + cardHead('② 机构收款账户',
      '<span class="faint">RP-14 · 只读带出报价时的值</span>') +
    '<div class="card-b">' + payeeRo(deal, own || (S.role === 'fund' && deal.fundEntity === ACTORS.fund.entity)) +
    '</div></div>' +

    '<div class="card" style="margin-top:16px">' + cardHead('③ 还款记录',
      '<span class="faint">RM-* · 与放款侧 LN-* 严格对称</span>') +
    '<div class="card-b">' +
      (s.st === 'S-RP-1' && own ? repayForm(deal, p, act)
        : (s.rec
            ? '<div class="ln-rec">' +
                '<div><div class="k">还款记录编号 · RM-01</div><div class="v mono">' + s.rec.id + '</div>' +
                  '<div class="x">提交成功的同一时刻生成，不预先占号</div></div>' +
                '<div><div class="k">还款币种 / 金额 · RM-03 / RM-04</div><div class="v mono">' +
                  usd(p.total) + '</div><div class="x">结算 ' + amt(p.settle) + ' ' + deal.ccy + ' · 只读</div></div>' +
              '</div><div style="margin-top:16px">' + timesPair(s.rec) + '</div>' +
              (own || (S.role === 'fund' && deal.fundEntity === ACTORS.fund.entity)
                ? (isFiat(deal)
                    ? '<div style="margin-top:16px"><div class="ls-kgrid"><div><div class="k">银行支付凭证 · RM-07</div>' +
                      '<div class="v" style="font-family:var(--sans)">' +
                      (s.rec.files || []).map(function(fl){ return E(fl.n) + '（' + E(fl.s) + '）'; }).join('<br>') +
                      '</div><div class="x">不公开，仅双方可见</div></div></div></div>'
                    : '<div style="margin-top:16px">' + hashBlock(s.rec, true) + '</div>')
                : '<p class="hint" style="margin-top:14px">凭证、交易哈希与链、机构收款账户、备注' +
                  '<b>不公开</b>，由服务端按归属过滤（D-RP-41）。</p>') +
              '<div class="btnbar" style="margin-top:16px">' +
                '<button class="btn" type="button" data-act="rp.toConfirm" data-v="' + deal.id + ':' + p.seq +
                '">查看还款确认页（P-LS-10）</button></div>'
            : '<div class="btnbar">' + actBtn(act, 'primary') + '</div>')) +
      noChainFoot('提交还款记录') +
    '</div></div>' +

    '<div class="card" style="margin-top:16px">' + cardHead('计息停止点与还款记录终结点',
      '<span class="faint">本模块唯一的资产方保护 · D-FIN-11</span>') +
    '<div class="card-b">' + freezeCard(deal, p, own ? 'asset' : S.role) + '</div></div>' +

    '<div class="card" style="margin-top:16px">' + cardHead('为什么这里还不了后面几期',
      '<span class="faint">本期不支持提前还款 · 五个拦截点缺一不可</span>') +
    '<div class="card-b">' + stopCards(sel) + '</div></div>';

  var rail = '<aside class="portal-rail">' +
    '<div class="card">' + cardHead('计息规则', '<span class="faint">RP-18 · 定稿时固化</span>') +
    '<div class="card-b">' + ruleBar(deal, g.plan, 'final') + '</div></div>' +
    '<div class="card">' + cardHead('这笔的还款进度') +
    '<div class="card-b"><div class="ls-kgrid">' +
      '<div><div class="k">已结清 / 总期数</div><div class="v">' + g.done + ' / ' + g.n + '</div></div>' +
      '<div><div class="k">未偿本金 · FD-31</div><div class="v">' + amt(g.unpaidPri) + '</div>' +
        '<div class="x">本期还款方式下只有两个取值：' + amt(deal.amt) + ' 或 0</div></div>' +
    '</div>' +
    '<div class="btnbar" style="margin-top:14px">' +
      '<button class="btn" type="button" data-act="rp.toSchedule" data-v="' + deal.id +
      '">查看完整还款计划</button></div></div></div>' +
    '<div class="card"><div class="card-b">' + mailCard(deal, p, 'repay') + '</div></div>' +
    '<div class="card ln-annot">' + cardHead('本期没有的东西', '<span class="faint">反向清单 · 原型注解</span>') +
    '<div class="card-b"><p class="hint">本页<b>不存在</b>：提前结清 / 一次性还清 / 提前还本入口、' +
      '多选与"全选"、可编辑的金额框、可编辑或可另填的机构收款账户、' +
      '修改或撤回已提交还款记录的入口、补充说明入口、' +
      '哈希旁的"已核验 / 已确认上链 / 交易有效"标识、凭证的"平台已审核"字样、' +
      '"逾期将处置您的质押资产"一类没有兑现能力的威慑文案、任何罚息金额。<br>' +
      '这些不是"还没做"，是本期明确不做。</p></div></div>' +
    '<div class="card"><div class="card-b"><p class="hint">深链锚点 <span class="mono">deal/' + deal.id +
      '?action=repay</span>（按 D-RP-22 定位最近一笔应还）与 <span class="mono">schedule/' +
      planNo(deal, p) + '?action=repay</span>（直达指定期次）<b>并存且落到同一页面</b>，' +
      '区别只在默认选中哪个期次（D-RP-60）。</p></div></div></aside>';

  return dealHead(deal, 'P-LS-09', '还款录入', s.st === 'S-RP-1' ? '第 ' + p.seq + ' 期' : '') +
    missingBanner() +
    (marks ? '<div class="ls-alert">' + marks + '</div>' : '') +
    resultCard() +
    '<div class="portal-cols"><div>' + main + '</div>' + rail + '</div>';
}


/* ================================================================
   Part D3 —— P-LS-10 还款确认（资金方）
   ================================================================ */

/* ---- 还款确认时限条（RM-15 / RM-16 / RM-17 / D-RP-51 ～ D-RP-54）----
   与 WS-326 的融资确认时限条同形同口径：到点只提醒，状态、额度、权限、逾期天数一个不动。
   因此超期态走中性灰而不是告警色。文案一律写全称——同一笔业务上已经有三个 168 小时。 */
function confirmBar(deal, p, forFund){
  var s = periodState(deal, p), k = confirmClock(deal, p);
  if(!k.has || s.st === 'S-RP-3'){
    return '<div class="ln-cd"><div class="by">' +
      (s.st === 'S-RP-3'
        ? '该期已于 <b>' + withTz(s.rec.confirmAt) + '</b> 确认结清（RM-18 / RP-17），还款确认时限已终止计时。'
        : '该期尚未提交还款记录，还款确认时限<b>尚未开始计时</b>——起算点是还款记录提交成功的服务端时间（RM-06）。') +
      '</div></div>';
  }
  var total = CONFIRM_HOURS * 60, el = k.elapsedMin, rm = Math.max(0, total - el);
  var cls = k.over ? ' over' : (k.soon ? ' soon' : '');
  return '<div class="ln-cd' + cls + '">' +
    '<div class="by">' + (k.over
      ? '<b>已超过还款确认时限 ' + k.overDays + ' 天。</b>期次状态、两个额度量、双方权限' +
        '<b>一个都没有变</b>；资产方的逾期天数<b>仍然冻结</b>。平台<b>不会自动确认</b>，' +
        '也<b>不会因此判定对方逾期</b>。'
      : '<b>剩余还款确认时限</b>（RM-16）。起算点 ' + withTz(s.rec.at) +
        '（还款记录提交成功的服务端时间 RM-06），到期时刻 <b>' + withTz(k.to) +
        '</b>（＝ 起算点 + ' + CONFIRM_HOURS + ' 小时，精确到秒）。') + '</div>' +
    '<div class="big"><span class="v">' + (k.over ? '已超期 ' + k.overDays + ' 天' : fmtDur(k.leftMin)) + '</span>' +
      '<span class="u">' + (k.over ? '· 入口照常可用' : (k.soon ? '· 不足 ' + NEAR_HOURS + ' 小时，已切分钟精度' : '')) + '</span></div>' +
    '<div class="bar"><span class="el" style="flex:' + el + '"></span>' +
      '<span class="rm" style="flex:' + Math.max(rm, 1) + '"></span></div>' +
    '<div class="scale"><span>已过 <b>' + fmtDur(el) + '</b></span>' +
      '<span>剩余 <b>' + fmtDur(rm) + '</b></span></div>' +
    '<div class="ways">' +
      '<div class="w"><i aria-hidden="true">①</i><span>到期<b>只发一条通知</b>，' +
        '<b>不自动改状态、不自动视为确认、不自动递减任何额度</b>（D-RP-53）。' +
        '自动确认等于平台替您承认"钱已收到"——一旦实际没到账，责任落在平台；' +
        '在还款侧它还会直接递减<b>您的授信占用额</b>，等于平台自行释放了您的额度。</span></div>' +
      '<div class="w"><i aria-hidden="true">②</i><span>超期<b>不改变任何权限与任何数据</b>：' +
        '本页照常可用、确认动作照常可执行、期次仍是 S-RP-2（D-RP-54）。' +
        '超期只产生<b>一个中性展示标记</b>与<b>一次通知</b>，之后不再周期性推送（D-RP-56）。</span></div>' +
      '<div class="w"><i aria-hidden="true">③</i><span>这与同一笔业务上的另外两个 ' + CONFIRM_HOURS +
        ' 小时<b>不是同一件事</b>，三者一律写全称：' +
        '<b>报价有效期</b>约束资产方处理报价，到点<b>自动失效</b>、报价终结、额度释放；' +
        '<b>融资确认时限</b>约束资产方确认到账，到点<b>只提醒</b>；' +
        '本条<b>还款确认时限</b>约束您确认收到还款，到点同样<b>只提醒</b>。' +
        '写成简称会让人以为不确认就会自动作废（D-RP-33）。</span></div>' +
    '</div></div>';
}

/* ---- 两个额度量的递减牌（AC-FIN-32 / D-RP-36 / D-RP-37）----
   与 WS-326 的四量转移牌同形、方向相反：还款侧**只有含本金的期次结清才递减**。 */
function decCard(deal, p, done){
  var interestOnly = !p.principal;
  var g = dealProgress(deal);
  var bal = deal.pool.bal, used = deal.cr.used;
  var balAfter = interestOnly ? bal : round2(bal - p.principal);
  var usedAfter = interestOnly ? used : round2(used - p.principal);
  function qz(nm, before, after, x, changed){
    return '<div class="q ' + (changed ? 'in' : 'out') + '"><div class="nm">' + E(nm) + '</div>' +
      '<div class="v">' + (changed ? '<s>' + amt(before) + '</s>' + amt(after) : amt(after)) + '</div>' +
      '<div class="x">' + x + '</div></div>';
  }
  return '<div class="ln-xfer' + (interestOnly ? ' still' : '') + '">' +
    '<div class="xh">' + (interestOnly ? '利息期结清：两个量一动不动' : '末期（含本金）结清：两个量等额递减') +
      '<span class="at">' + (done ? '已于 ' + withTz(deal.paid[p.seq].confirmAt) + ' 生效' : '确认完成的同一次结算内') + '</span></div>' +
    '<div class="dim"><div class="dn">项目维度 · ' + E(deal.pid) + '</div><div class="qr">' +
      qz('项目融资余额（确认前）', bal, bal, '未偿本金的合计', false) +
      '<div class="ar" aria-hidden="true">' + (interestOnly ? '＝' : '→') + '</div>' +
      qz('项目融资余额（确认后）', bal, balAfter,
         interestOnly ? '<b>不变</b>——利息不是本金' : '−' + amt(p.principal), !interestOnly) +
    '</div></div>' +
    '<div class="dim"><div class="dn">机构 × 资产方维度 · ' + E(deal.fund) + ' × ' + E(deal.party) + '</div><div class="qr">' +
      qz('授信占用额（确认前）', used, used, '未偿本金的合计', false) +
      '<div class="ar" aria-hidden="true">' + (interestOnly ? '＝' : '→') + '</div>' +
      qz('授信占用额（确认后）', used, usedAfter,
         interestOnly ? '<b>不变</b>——利息不是本金' : '−' + amt(p.principal) + ' · 可用授信同额恢复', !interestOnly) +
    '</div></div>' +
    '<div class="xf">' + (interestOnly
      ? '<b>按已偿本金递减，不按已还金额递减。</b>项目融资余额与授信占用额的定义都是<b>未偿本金</b>的合计，' +
        '利息不在其中——因此利息期结清时两个量一动不动（D-RP-36）。' +
        '<b>反例</b>：按应还合计 ' + amt(p.total) + ' 递减，会让每还一期利息就凭空释放一次额度 ' +
        amt(p.interest) + '，资产方可以用同一份质押再融一笔。'
      : '<b>递减与结清在同一次结算内一致生效</b>：期次状态、两个量、FD-30 累计已还、FD-31 未偿本金、' +
        '业务状态（末期时）整体成功或整体不发生。<b>不存在"已确认但额度未减"或' +
        '"额度已减但期次未结清"的中间态</b>（AC-FIN-32 / E-RP-11）。' +
        '<br>资产方提交（S-RP-2）时两个量<b>一个都不动</b>——钱有没有到只有您知道，提交只是一次陈述（D-RP-37）。') +
    '</div></div>';
}

/* ---- 结清后的质押交接（5.7 / D-RP-39 / AC-RP-19 / D-FIN-49 / D-FIN-57）----
   本模块**只输出「该笔业务已结清」这一事实**，不释放任何质押。 */
function pledgeHandoff(deal){
  return CF.note('',
    '<b class="ls-b">本模块不释放质押。</b>它只把「该笔业务已结清」这一事实交给 WS-324，' +
    '由它按 <b class="ls-b">D-FIN-49</b> 判定<b class="ls-b">项目终态</b>、再做两段式释放。' +
    '<p><b class="ls-b">不提供"某笔结清即释放对应代币"的部分释放</b>：' +
    '同一个资产池可能承载多笔融资业务，一笔结清不等于这个池子自由了。</p>' +
    '<p>项目真的进入终态之后，释放分两段：<br>' +
    '<b class="ls-b">① 业务释放</b>——进入终态同刻解除全部占用与担保、代币置「已释放 · 待提取」、' +
    '不再计入任何池。<b class="ls-b">即时、无链上动作、不被链上失败阻塞</b>。<br>' +
    '<b class="ls-b">② 链上提取</b>——由资产方<b class="ls-b">自助发起、自付 gas</b>，可批量、无时限，' +
    '平台不代付不加收。未提取的代币留在合约内、不属于任何池、<b class="ls-b">不能再次质押</b>' +
    '（须先提回自己地址）。<b class="ls-b">这一段有真实的链上失败</b>，五类失败态与 gas 口径' +
    '在 WS-324 的提取环节（<a class="btn-link" href="' + lsHref('#/my-projects') +
    '">我的融资项目 · 可提取代币</a>）承载，本模块不复制一份。</p>' +
    '<p><b class="ls-b">本页不会告诉您"结清后代币将自动回到您的钱包"</b>——它不会自动回来，' +
    '需要您自己去提（AC-RP-19）。</p>', '结清之后，质押怎么办');
}

function recordFull(deal, p, visible){
  var s = periodState(deal, p), rec = s.rec;
  return '<div class="ln-rec">' +
    '<div><div class="k">还款记录编号 · RM-01</div><div class="v mono">' + rec.id + '</div>' +
      '<div class="x">前缀 RM + 服务端日期 + 当日 6 位序号；RP 已被还款计划占用，故另起一个前缀</div></div>' +
    '<div><div class="k">所属还款计划编号 · RM-02</div><div class="v mono">' + planNo(deal, p) + '</div>' +
      '<div class="x">一个期次至多一条有效还款记录</div></div>' +
    '<div><div class="k">还款币种 · RM-03</div><div class="v">' + deal.ccy + '</div>' +
      '<div class="x">只读，恒等于 QT-02</div></div>' +
    '<div><div class="k">还款金额 · RM-04</div><div class="v mono">' + usd(p.total) + '</div>' +
      '<div class="x">结算 ' + amt(p.settle) + ' ' + deal.ccy + ' · 只读等于本期应还合计</div></div>' +
    '<div><div class="k">还款类型 · RP-13</div><div class="v">' + s.type + '</div>' +
      '<div class="x">系统派生，提交时该期带逾期标记则为逾期还款</div></div>' +
    '<div><div class="k">还款确认时限至 · RM-15</div><div class="v mono">' + withTz(s.limitAt) + '</div>' +
      '<div class="x">＝ RM-06 + ' + CONFIRM_HOURS + ' 小时 · 只读、不可编辑、不可延长</div></div>' +
  '</div>' +
  '<div style="margin-top:16px">' + timesPair(rec) + '</div>' +
  (visible
    ? '<div style="margin-top:16px">' +
        (isFiat(deal)
          ? '<div class="card" style="box-shadow:none;border:1px solid var(--border)">' +
            cardHead('银行支付凭证 · RM-07', '<span class="faint">平台不审核真伪</span>') +
            '<div class="card-b">' + (rec.files || []).map(function(fl){
              return '<div class="filecard" style="margin-top:0"><div class="ic" aria-hidden="true">▤</div>' +
                '<div class="bd"><b>' + E(fl.n) + '</b><span>' + E(fl.s) + '</span></div>' +
                '<div class="act"><button class="btn sm" type="button" data-act="rp.download">在线预览</button>' +
                '<button class="btn sm" type="button" data-act="rp.download">下载</button></div></div>';
            }).join('') +
            '<p class="hint" style="margin-top:11px">格式与大小基线<b>与放款侧 LN-07 完全一致</b>：' +
            'PDF / JPG / PNG、单文件 ≤ ' + FILE_MAX_MB + ' MB、' + FIAT_MIN_N + '～' + FIAT_MAX_N +
            ' 个。凭证<b>不公开</b>，仅该笔业务双方可见；下载须鉴权，不使用可猜测的公开直链。</p></div></div>'
          : hashBlock(rec, false) +
            ((rec.extra || []).length ? '<div style="margin-top:12px">' + rec.extra.map(function(fl){
              return '<div class="filecard"><div class="ic" aria-hidden="true">▤</div>' +
                '<div class="bd"><b>' + E(fl.n) + '</b><span>' + E(fl.s) + ' · 补充材料 RM-12</span></div>' +
                '<div class="act"><button class="btn sm" type="button" data-act="rp.download">查看</button></div></div>';
            }).join('') + '</div>' : '')) +
      '</div>' +
      '<div style="margin-top:16px">' + payeeRo(deal, true) + '</div>' +
      (rec.memo ? '<div style="margin-top:16px">' + field('还款备注 · RM-11', '对方填写',
        '<div class="ls-ro" style="min-height:auto;padding:11px 12px;font-family:var(--sans);' +
        'align-items:flex-start;line-height:1.65">' + E(rec.memo) + '</div>',
        '它常常是解释手续费、分行、到账时间的唯一位置。备注<b>不公开</b>。') + '</div>' : '')
    : '<p class="hint" style="margin-top:14px"><b>凭证、交易哈希与链、收款账户快照、还款备注不公开</b>：' +
      '由服务端按归属过滤，接口响应里根本不含这些字段，不是前端隐藏（D-RP-41 / AC-LS-110）。</p>');
}

function pageConfirm(){
  if(S.st === 'loading') return skel('还款确认');
  if(S.st === 'error')
    return failCard('还款确认', '还款记录未能加载',
      '<p>服务端未返回该期次的还款记录与剩余还款确认时限。' +
      '<b>到期时刻 RM-15 由服务端下发绝对时刻、前端只负责渲染</b>：按本地时间推算会在跨时区与' +
      '时钟偏差下与服务端判定不一致（AC-LS-112）。</p>');

  var sel = currentSel();
  if(!sel || !sel.s.rec)
    return failCard('还款确认', '该期次没有待确认的还款记录',
      '<p>该期可能尚未提交还款记录、已结清，或不属于当前身份可见范围。' +
      '页面落到说明页而不是 404、白屏或静默跳首页（H-02 / AC-LS-114）。</p>');

  var deal = sel.deal, p = sel.p, s = sel.s;
  var isFund = (S.role === 'fund' && deal.fundEntity === ACTORS.fund.entity);
  var own = (S.role === 'asset' && deal.entity === ACTORS.asset.entity);
  var act = confirmAction(deal, p, S.role);
  var k = confirmClock(deal, p);
  var g = dealProgress(deal);
  var done = s.st === 'S-RP-3';

  var marks = '';
  if(k.over && !done)
    marks += markRow('已超过还款确认时限',
      '已超过 <span class="day">' + k.overDays + '</span> 天（到期时刻 ' + withTz(s.limitAt) + '）。' +
      '<b>期次状态、两个额度量、双方权限一个都没有变</b>；确认入口照常可用。',
      '<b>资产方的逾期天数仍然冻结在 ' + s.odDays + ' 天</b>，不因您暂时不确认而继续累加（D-FIN-11）。' +
      '本条只驱动展示与一次通知，不改变状态、权限与任何金额。');
  if(s.overdue)
    marks += markRow('对方该期曾逾期',
      '第 ' + p.seq + ' 期应还日 ' + p.due + '，对方于 <b>' + s.rec.at + '</b> 提交还款记录，' +
      '逾期天数 <span class="day">' + s.odDays + '</span> 天<b>已在提交时刻冻结</b>。',
      '这个数<b>不会再涨</b>。平台<b>不计算罚息、不展示罚息金额、不把罚息并入应还金额</b>——' +
      '罚息率是商务条款，平台手里没有它（X-LS-45 / D-RP-46）。逾期的经济后果本期完全由线下合同承担。');
  if(deal.projExpired)
    marks += markRow('已到期 · 存量处理中',
      '融资项目已于 <b>' + deal.fd34 + '</b> 到期，<b>存量融资业务照常履约中</b>。',
      '这是<b>常态路径</b>：末期本金本来就在到期日当天还（X-LS-06 / D-FIN-47）。');
  if(g.settled)
    marks += markRow('该笔业务已结清',
      '全部 <b>' + g.n + '</b> 期已结清，业务于 <b>' + withTz(deal.fd33) + '</b> 进入 S-FD-8 已结清（终态）。',
      '两个额度量该笔已归零，S-FD-9 标记已清除，FD-33 结清时间已落库。');

  var main =
    '<div class="card">' + cardHead('还款确认时限',
      '<span class="faint">RM-15 / RM-16 · 服务端下发绝对时刻</span>') +
    '<div class="card-b">' + confirmBar(deal, p, isFund) + '</div></div>' +

    '<div class="card" style="margin-top:16px">' + cardHead('① 还款记录全文',
      '<span class="faint">RM-01 ～ RM-18 · 与放款侧 LN-* 严格对称</span>') +
    '<div class="card-b">' + recordFull(deal, p, isFund || own) + '</div></div>' +

    '<div class="card" style="margin-top:16px">' + cardHead('② 本期计划信息',
      '<span class="faint">供核对金额是否与合同一致</span>') +
    '<div class="card-b"><div class="ls-kgrid">' +
      '<div><div class="k">期次序号 · RP-03</div><div class="v">第 ' + p.seq + ' 期 / 共 ' + g.n + ' 期</div>' +
        '<div class="x">' + (p.last ? '末期 · 含本金' : '利息期') + '</div></div>' +
      '<div><div class="k">应还日 · RP-04</div><div class="v">' + p.due + '</div></div>' +
      '<div><div class="k">计息区间与天数 · RP-05</div><div class="v">' + p.from + ' ~ ' + p.due + '</div>' +
        '<div class="x">' + p.days + ' 天 · 算头不算尾</div></div>' +
      '<div><div class="k">应还本金 / 利息</div><div class="v">' + amt(p.principal) + ' / ' + amt(p.interest) + '</div>' +
        '<div class="x">' + amt(deal.amt) + ' × 年化 ' + deal.rate.toFixed(2) + '% × ' + p.days + ' ÷ ' + BASIS + '</div></div>' +
      '<div><div class="k">应还合计 · RP-08</div><div class="v">' + amt(p.total) + '</div>' +
        '<div class="x">' + CCY + '</div></div>' +
      (s.overdue
        ? '<div><div class="k">逾期天数 · RP-11</div><div class="v">' + s.odDays + ' 天</div>' +
          '<div class="x">已于 ' + s.frozenAt + ' 冻结，不会再涨</div></div>'
        : '<div><div class="k">逾期天数 · RP-11</div><div class="v">0 天</div>' +
          '<div class="x">该期未触发逾期标记</div></div>') +
    '</div>' +
    '<div style="margin-top:16px">' + ruleBar(deal, g.plan, 'final') + '</div></div></div>' +

    '<div class="card" style="margin-top:16px">' + cardHead('③ 确认这一下会发生什么',
      '<span class="faint">AC-FIN-32 · 原子、无空档</span>') +
    '<div class="card-b">' + decCard(deal, p, done) +
      (p.last ? '<div style="margin-top:16px">' + pledgeHandoff(deal) + '</div>' : '') + '</div></div>' +

    '<div class="card" style="margin-top:16px">' + cardHead('计息停止点与还款记录终结点',
      '<span class="faint">D-FIN-11 · 两件事，分开呈现</span>') +
    '<div class="card-b">' + freezeCard(deal, p, isFund ? 'fund' : S.role) + '</div></div>';

  /* ---- 动作区：只有「确认收到还款」一个，与客服邮箱并排 ---- */
  var actions = '<div class="card" style="margin-top:16px">' + cardHead('④ 您现在能做什么',
      '<span class="faint">X-LS-42 · 本期只有一个动作</span>') +
    '<div class="card-b">' +
    (done
      ? CF.note('green', '该期已于 <b class="ls-b">' + withTz(s.rec.confirmAt) +
          '</b> 确认收到还款（RM-18 / RP-17），期次进入 <b class="ls-b">S-RP-3 已结清</b>。' +
          '<p>确认<b class="ls-b">不可撤销</b>：它是对事实的陈述，不是一个可以反悔的选项。' +
          '发现确认错了只能走线下。</p>', '已结清')
      : '<div class="btnbar">' + actBtn(act, 'primary') + '</div>' +
        CF.note('',
          '<b class="ls-b">本页只有「确认收到还款」一个动作。</b>' +
          '<b class="ls-b">不存在</b>「提出异议」「申诉」「驳回」「部分确认」等入口——本期不做（X-LS-42）。' +
          '<p>金额不符、凭证有问题、款根本没到时，您唯一能做的是<b class="ls-b">不点确认</b>，' +
          '并走右侧客服邮箱与对方线下联系。<b class="ls-b">不要"先确认再说"</b>：' +
          '确认不可撤销，且会立刻' + (p.principal ? '释放您 ' + usd(p.principal) + ' 的授信占用额'
                                                  : '把这一期关掉') + '。</p>' +
          '<p><b class="ls-b">也不要因此认为对方在继续逾期</b>：他的逾期天数在提交那一刻就冻结了，' +
          '您拖多久都不会增加（D-FIN-11）。这条是本期资产方唯一的保护——' +
          '因为他连异议都提不了。</p>', '关于「只有一个动作」')) +
    '<p class="hint" style="margin-top:14px"><b>资产方声称已还、您声称未收到</b>时，' +
    '平台<b>不判定谁对谁错</b>（E-RP-13）：走客服邮箱线下核实。' +
    '<b>跨境手续费导致实收少于应还</b>时同理（E-RP-14）——本期没有差额说明字段，金额只读；' +
    '资产方的逾期天数在两种情形下<b>都保持冻结</b>。</p>' +
    noChainFoot('确认收到还款') + '</div></div>';

  /* ---- 始终不确认的后果：这是一条正常路径，不是风险提示（6.5.3 / D-RP-57）---- */
  var consequences = '<div class="card" style="margin-top:16px">' +
    cardHead('如果一直不确认会怎样', '<span class="faint">D-RP-57 · 后果必须写明</span>') +
    '<div class="card-b"><div class="rows" style="box-shadow:none">' +
    [['没有任何后台能推动这个状态',
      '平台<b>没有任何自动确认、自动判定或运营代确认的能力</b>。期次会<b>永久停在 S-RP-2</b>，' +
      '直到您回到本页点确认为止。'],
     ['这笔业务无法结清',
      '业务进不了 <b>S-FD-8 已结清</b>；<b>项目融资余额</b>与<b>授信占用额</b>双双被占住——' +
      '资产方不能用这份质押再融资，<b>您自己的额度也回不来</b>。'],
     ['质押无法释放',
      '质押的释放要求<b>项目终态</b>（D-FIN-49），而业务不结清项目就到不了终态——' +
      '资产方的代币会一直留在质押合约里。'],
     ['但对方的逾期天数不会继续增加',
      '<b>这一条不因您的不作为而改变</b>（D-FIN-11）。' +
      '还款侧您不确认时，承受后果的主要是对方（业务无法结清、质押无法释放），' +
      '而您只是晚点拿到结清凭证——<b>这条红线正是为了不让这种不对称落到他头上</b>。']
    ].map(function(r){
      return '<div class="row"><div class="row-main"><div class="row-k">' + E(r[0]) + '</div>' +
        '<div class="row-v" style="color:var(--muted);font-size:12.5px;line-height:1.6">' + r[1] + '</div></div></div>';
    }).join('') + '</div>' +
    '<p class="hint" style="margin-top:12px">线下沟通达成一致之后：<b>平台没有任何后台动作</b>，' +
    '由您回到本页点「确认收到还款」，走与没超期时<b>完全一致</b>的结算流程。</p></div></div>';

  var rail = '<aside class="portal-rail">' +
    '<div class="card"><div class="card-b">' + mailCard(deal, p, 'confirm') + '</div></div>' +
    '<div class="card">' + cardHead('这笔的还款进度') +
    '<div class="card-b"><div class="ls-kgrid">' +
      '<div><div class="k">已结清 / 总期数</div><div class="v">' + g.done + ' / ' + g.n + '</div></div>' +
      '<div><div class="k">未偿本金 · FD-31</div><div class="v">' + amt(g.unpaidPri) + '</div></div>' +
      '<div><div class="k">累计已还本金 / 利息 · FD-30</div><div class="v">' +
        amt(g.paidPri) + ' / ' + amt(g.paidInt) + '</div>' +
        '<div class="x">待确认期次不计入</div></div>' +
    '</div>' +
    '<div class="btnbar" style="margin-top:14px">' +
      '<button class="btn" type="button" data-act="rp.toSchedule" data-v="' + deal.id +
      '">查看完整还款计划</button></div></div></div>' +
    '<div class="card ln-annot">' + cardHead('本期没有的东西', '<span class="faint">反向清单 · 原型注解</span>') +
    '<div class="card-b"><p class="hint">本页<b>不存在</b>：提出异议 / 申诉 / 驳回 / 部分确认入口、' +
      '<b>S-RP-4 还款异议处理中</b>状态（本期不可达，也不为它准备文案与筛选项）、' +
      '运营端裁决台、撤销确认、修改或撤回还款记录、延长还款确认时限、' +
      '"平台介入中""平台将在 X 个工作日内处理"一类承诺、' +
      '哈希旁的"已核验 / 已确认上链 / 交易有效"标识、凭证的"平台已审核"字样、' +
      '"逾期视为确认"一类措辞、任何罚息金额与差额说明字段。<br>' +
      '这些不是"还没做"，是本期明确不做。</p></div></div>' +
    '<div class="card"><div class="card-b"><p class="hint">深链锚点 <span class="mono">schedule/' +
      planNo(deal, p) + '?action=confirm_repayment</span>。<br>' +
      '⚠️ 附册 A0 里写的是 <span class="mono">repayment/{id}?action=confirm</span>，' +
      '本册据 D-RP-59 改挂在<b>期次</b>上并向附册提出修订请求：' +
      '还款记录没有需要被深链直达的独立页面，它永远在期次里呈现。</p></div></div></aside>';

  return dealHead(deal, 'P-LS-10', '还款确认', '第 ' + p.seq + ' 期') +
    missingBanner() +
    (marks ? '<div class="ls-alert">' + marks + '</div>' : '') +
    resultCard() +
    '<div class="portal-cols"><div>' + main + actions + consequences + '</div>' + rail + '</div>';
}


/* ================================================================
   Part E —— 模块装配
   ================================================================ */

/* ---- 演示业务的取用：页面态决定落在哪一笔，深链 did 优先 ---- */
function dealOf(page){
  var map = ST_DEAL[page] || {};
  var id = (S.didPage === page && S.did) ? S.did : (map[S.st] || map['default']);
  /* 深链指向的业务不在本模块的演示数据里时**回落到默认落点**，不落 404 / 白屏 / 静默跳首页
     （H-02 / AC-LS-114）。会走到这里是因为上游模块（WS-324 / WS-326）各有自己的演示"当前时刻"：
     WS-324 的 P-LS-02 停在 2026-09-11，本模块停在 2026-12-18，同一笔业务在两个文件里
     处在不同的期次状态，硬塞进来只会让两边的数对不上。落点用横幅说明，不假装那笔业务在这里。 */
  var d = findDeal(id);
  if(!d && id){ S.missingDeal = id; return findDeal(map[S.st] || map['default']); }
  return d;
}
/* 深链业务不在演示集内时的说明横幅 */
function missingBanner(){
  if(!S.missingDeal) return '';
  var id = S.missingDeal;
  return '<div class="ls-alert">' + CF.note('',
    '您从上游页面点进来的融资业务 <b class="ls-b">' + E(id) + '</b> ' +
    '<b class="ls-b">不在本模块的演示数据集内</b>，页面已落到默认落点，' +
    '<b class="ls-b">没有报 404、没有白屏、也没有静默跳首页</b>（H-02 / AC-LS-114）。' +
    '<p><b class="ls-b">这是原型侧的边界，不是产品行为</b>：四个模块各有自己的演示"当前时刻"——' +
    'WS-324 / WS-325 / WS-326 停在 2026-09-11，本模块停在 ' + dayOnly(NOW) +
    '（还款本来就发生在放款之后三个月）。同一笔业务在两边会处在不同的期次状态，' +
    '把它硬塞进来只会让两边的数对不上。真实系统里所有模块共用同一个服务端时间，不存在这个落差。</p>',
    '这笔业务不在本模块的演示集内') + '</div>';
}
/* ---- 当前选中的期次 ----
   ① 用户显式改选或深链直达的期次优先；
   ② 否则按页面态给定的业务 + 期次序号；
   ③ P-LS-09 的默认态走**真正的默认定位**：D-RP-21 ～ D-RP-24 的排序结果第一条。 */
function currentSel(){
  var page = S.page, plan, i;
  if(S.sel){
    var d = findDeal(S.sel.id);
    if(d && d.planReady){
      plan = finalPlan(d);
      for(i = 0; i < plan.length; i++)
        if(plan[i].seq === S.sel.seq) return { deal:d, p:plan[i], s:periodState(d, plan[i]) };
    }
    if(d) return { deal:d, p:null, s:null };
  }
  if(page === 'P-LS-09' && S.st === 'default' && !S.did){
    var c = candidates(ACTORS.asset.entity);
    if(c.length) return c[0];
  }
  var deal = dealOf(page);
  if(!deal) return null;
  if(!deal.planReady) return { deal:deal, p:null, s:null };
  plan = finalPlan(deal);
  var want = (ST_SEQ[page] || {})[S.st];
  if(want){
    for(i = 0; i < plan.length; i++)
      if(plan[i].seq === want) return { deal:deal, p:plan[i], s:periodState(deal, plan[i]) };
  }
  var target = page === 'P-LS-10' ? 'S-RP-2' : 'S-RP-1';
  for(i = 0; i < plan.length; i++){
    var s = periodState(deal, plan[i]);
    if(s.st === target) return { deal:deal, p:plan[i], s:s };
  }
  if(!plan.length) return { deal:deal, p:null, s:null };
  var lastP = plan[plan.length - 1];
  return { deal:deal, p:lastP, s:periodState(deal, lastP) };
}

/* ---- 提交 / 确认的结果卡：紧跟页头之后。
   每一类结局各有独立呈现与独立出路，**不存在只写"操作失败"的兜底文案**。 ---- */
function resultCard(){
  var r = S.result;
  if(!r) return '';
  var box;
  switch(r.k){
    case 'submitted':
      box = CF.note('green',
        '还款记录编号 <b class="ls-b">' + r.id + '</b> 已生成，第 ' + r.seq + ' 期转 ' +
        '<b class="ls-b">S-RP-2 待还款确认</b>。' +
        '<p>同一次结算内：生成编号 → 期次 S-RP-1 → S-RP-2 → <b class="ls-b">冻结该期逾期天数（' +
        r.od + ' 天）</b> → <b class="ls-b">还款确认时限开始计时</b>（起点 ' + withTz(r.at) +
        '，到期 ' + withTz(r.to) + '）→ 通知资金方。' +
        '<b class="ls-b">两个额度量一个都不动</b>——钱有没有到只有机构知道，提交只是一次陈述（D-RP-37）。</p>' +
        '<p>还款记录<b class="ls-b">不可修改、不可撤回</b>。到期<b class="ls-b">不会自动视为确认</b>：' +
        '届时只发一条通知、状态不变。机构始终不确认时，' +
        '<b class="ls-b">您的逾期天数仍然冻结在 ' + r.od + ' 天</b>，出路是客服邮箱线下沟通后由他自己来点确认。</p>',
        '还款记录已提交');
      break;
    case 'notopen':
      box = CF.note('red',
        '<b class="ls-b">提交被服务端终检拒绝：该期尚未开窗。</b>' +
        '第 ' + r.seq + ' 期的还款入口将于 <b class="ls-b">' + r.openAt + ' 00:00 ' + TZ_LABEL +
        '</b> 开启（应还日 ' + r.due + ' 前 ' + OPEN_DAYS + ' 个自然日）。' +
        '<p><b class="ls-b">本期不支持提前还款</b>——还本金只发生在融资项目到期之后。' +
        '本次<b class="ls-b">不产生还款记录、不改变任何状态</b>（E-RP-03）。</p>' +
        '<p>前端的 ⊘ 与隐藏<b class="ls-b">均不构成校验</b>：开窗结论由服务端在提交时刻重新判定。' +
        '页面停留过久、或绕过前端直接提交，都会落到这里。</p>', '该期尚未开窗，本次未提交');
      break;
    case 'race':
      box = CF.note('amber',
        '该期<b class="ls-b">已提交还款记录</b>（' + r.id + '，' + withTz(r.at) + '），本次提交未落库。' +
        '<p>并发提交<b class="ls-b">串行结算、先落库者成功</b>，后到者不产生第二条记录' +
        '（E-RP-02 / D-RP-44）。编号只在提交成功的同一时刻生成，本次<b class="ls-b">不占号</b>。</p>' +
        '<p>同一企业主体下任一登录员工都可以代表企业提交，因此这条路径是真实存在的：' +
        '两位同事同时点了提交，只有一笔成功。</p>', '该期已提交还款记录');
      break;
    case 'moved':
      box = CF.note('amber',
        '提交时该期<b class="ls-b">已不在 S-RP-1 待还款</b>：' + E(r.detail) +
        '。按<b class="ls-b">提交时刻的权威状态</b>结算并拒绝本次提交。' +
        '<p>页面已落到该期次详情，<b class="ls-b">不报 404、不白屏、不静默跳首页</b>（E-RP-08 / AC-LS-114）。</p>',
        '期次状态已变更');
      break;
    case 'chain':
      box = CF.note('red',
        '<b class="ls-b">链须与报价时约定的一致。</b>本笔业务在报价时约定的链是 <b class="ls-b">' + E(r.chain) +
        '</b>（QT-08），提交的链与之不一致，服务端拒绝提交，<b class="ls-b">不提供"仍要继续"</b>（E-RP-05）。' +
        '<p>钱打到另一条链不是这笔业务约定的交付方式：USDT / USDC 是多链资产，' +
        '链不同就是两笔完全不同的转账。</p>', '链不一致，本次未提交');
      break;
    case 'upload':
      box = CF.note('red', r.detail +
        '<p><b class="ls-b">已上传的其他文件保留</b>，无需重传（E-RP-06）。' +
        '格式与大小基线与放款侧 LN-07 完全一致，不另定一套。</p>', '凭证未通过');
      break;
    case 'future':
      box = CF.note('red',
        '<b class="ls-b">还款时间晚于提交时刻，服务端拒绝提交</b>（E-RP-07）。' +
        '<p>还款时间<b class="ls-b">可以填过去，不能填未来</b>——未来的还款时间意味着钱还没打。' +
        '它只是业务参考与对账依据，任何时效与计息都不使用它（D-FIN-21）。</p>', '还款时间不合法');
      break;
    case 'confirmed':
      box = CF.note('green',
        '已确认收到还款。第 ' + r.seq + ' 期转 <b class="ls-b">S-RP-3 已结清</b>，' +
        '确认时间 <b class="ls-b">' + withTz(r.at) + '</b>（RM-18 / RP-17）。' +
        '<p>' + (r.principal
          ? '同一次结算内：<b class="ls-b">项目融资余额 −' + amt(r.principal) + '</b>、' +
            '<b class="ls-b">授信占用额 −' + amt(r.principal) + '</b>、FD-30 累计已还与 FD-31 未偿本金更新。' +
            '两个量<b class="ls-b">等额递减、原子、无空档</b>（AC-FIN-32）。'
          : '这是利息期：<b class="ls-b">项目融资余额与授信占用额一动不动</b>——' +
            '它们是未偿本金的合计，利息不在其中（D-RP-36）。') + '</p>' +
        (r.settled
          ? '<p><b class="ls-b">该业务全部期次已结清</b>：业务 S-FD-6 → <b class="ls-b">S-FD-8 已结清</b>（终态），' +
            '清除 S-FD-9 逾期标记，FD-33 结清时间落库，两个量该笔归零。' +
            '「该笔已结清」这一事实<b class="ls-b">交给 WS-324</b> 判定项目终态与质押两段式释放——' +
            '<b class="ls-b">本模块不释放任何质押</b>（D-RP-39）。</p>'
          : '<p>该业务还有未结清期次，业务仍是 <b class="ls-b">S-FD-6 还款中</b>。</p>') +
        '<p>确认<b class="ls-b">不可撤销</b>：它是对事实的陈述，不是一个可以反悔的选项。</p>',
        '还款确认完成');
      break;
    case 'settle':
      box = CF.note('amber',
        '<b class="ls-b">结算未完成，期次保持 S-RP-2 待还款确认。</b>' +
        '该结算必须<b class="ls-b">整体成功或整体不发生</b>：期次状态、两个额度量、FD-30 / FD-31、' +
        '业务状态（末期时）、结清事实的输出，缺一不可（E-RP-11 / AC-RP-13）。' +
        '<p>本次已整体回滚，<b class="ls-b">没有出现"已确认但额度未减"或"末期已结清但业务仍显示还款中"' +
        '的中间态</b>；重试期间对外仍按未确认呈现。请稍后重试确认。</p>' +
        '<p>资产方的逾期天数在这期间<b class="ls-b">仍然冻结</b>——结算重试不影响 D-FIN-11。</p>',
        '结算整体回滚，可重试');
      break;
    case 'gone':
      box = CF.note('amber',
        '确认的同一时刻该期<b class="ls-b">已不在 S-RP-2</b>。本期<b class="ls-b">不存在合法的并发路径</b>' +
        '（S-RP-2 段只有机构一个写动作），因此这被视为数据异常：' +
        '按权威状态结算、落详情页 + Toast，并<b class="ls-b">生成运营告警</b>（E-RP-09）。',
        '期次状态异常');
      break;
    default:
      box = CF.note('', '—');
  }
  return '<div class="ls-alert">' + box + '</div>';
}

/* ---- 提交结局模拟：走通分册 6.7 的各条分支 ---- */
var SUBMIT_OUTCOMES = [
  ['ok',      '提交成功（生成 RM-01 → S-RP-2 → 冻结逾期天数 → 时限开始计时）'],
  ['notopen', 'E-RP-03 服务端终检：该期尚未开窗 → 拒绝，不产生记录'],
  ['race',    'E-RP-02 并发提交：先落库者成功，后到者不产生第二条'],
  ['moved',   'E-RP-08 期次已不在 S-RP-1 → 按权威状态结算并拒绝'],
  ['chain',   'E-RP-05 链与报价时约定的不一致 → 拒绝，不提供"仍要继续"'],
  ['upload',  'E-RP-06 凭证格式 / 大小 / 数量不合格 → 就地提示，已传文件保留'],
  ['future',  'E-RP-07 还款时间晚于提交时刻 → 拒绝']
];

var mod = {
  id:'lending-repayment', end:'asset', home:'P-LS-09',
  dict:{ en:{}, zh:{} },
  owns:['P-LS-09','P-LS-10','P-LS-91'],
  topbarPrd:false,
  /* 每个必达状态在原型里都点得到：加载 / 失败可重试 / 无权限（身份切换）/ 异常分支各一个入口。 */
  states:{
    'P-LS-91':[['default','Both versions','两版对照'],
               ['initial','Draft only','报价期 · 初始计划'],
               ['final','Final only','定稿全表'],
               ['overdue','With overdue mark','定稿 + 逾期标记'],
               ['generating','Plan generating','还款计划生成中'],
               ['loading','Loading','加载中'],
               ['error','Load failed','加载失败']],
    'P-LS-09':[['default','Default landing','默认定位 · 最近一笔应还'],
               ['normal','Fiat, not overdue','法币 · 未逾期 · 已开窗'],
               ['digital','Digital currency','数币 USDT · 哈希与链'],
               ['locked','Window not open','未开窗 ⊘ · 不支持提前还款'],
               ['submitted','Already submitted','该期已提交待确认'],
               ['settled','Deal settled','业务已结清 S-FD-8'],
               ['generating','Plan generating','还款计划生成中'],
               ['loading','Loading','加载中'],
               ['error','Load failed','加载失败']],
    'P-LS-10':[['default','4 days left · frozen at 5','法币 · 逾期天数冻结在 5'],
               ['soon','Under 24 hours','不足 24 小时 · 正常还款'],
               ['digital','Digital currency','数币 · 哈希与区块浏览器'],
               ['overdue','Confirmation overdue','已超过还款确认时限'],
               ['last','Final period','末期含本金 · 确认即结清'],
               ['done','Settled','已结清 S-RP-3'],
               ['loading','Loading','加载中'],
               ['error','Load failed','加载失败']]
  },
  state:function(){
    return { lang:'zh', role:'asset', did:null, didPage:null, sel:null,
             f:{ given:'', hash:'', memo:'', files:[], extra:[], upErr:null, sizeShown:false },
             ack:false, out:'ok', cout:'ok', result:null, modal:null, missingDeal:null };
  },
  onBoot:function(st){ S = st; },
  /* 身份切换走顶栏上下文操作区（portal 规范 §3）；数据状态切换走公共 stateBar。
     模块不自带底部演示条、不自建菜单。 */
  topExtra:function(){
    return '<div class="seg" role="group" aria-label="演示身份">' +
      ['guest','asset','fund'].map(function(k){
        return '<button type="button" data-act="rp.role" data-v="' + k + '" aria-pressed="' + (S.role === k) + '">' +
          ACTORS[k].t + '</button>'; }).join('') + '</div>';
  },
  crumbParts:function(){ return []; },
  content:function(){
    return S.page === 'P-LS-10' ? pageConfirm() : S.page === 'P-LS-91' ? pageSchedule() : pageRepay();
  },
  modals:{
    /* 提交还款前的二次确认：三件事必须讲清（6.3.1），必须显式确认才可提交。
       第 ② 条是本模块特有的——它是 D-FIN-11 在提交前的告知面。 */
    repay:function(){
      var sel = currentSel(); if(!sel || !sel.p) return '';
      var deal = sel.deal, p = sel.p, s = sel.s, v = formState(deal, p);
      var to = tstr(tmin(NOW) + CONFIRM_HOURS * 60);
      return '<div class="mask" data-act="rp.mclose"><div class="modal wide" role="dialog" aria-modal="true">' +
        '<div class="modal-h"><b>提交还款记录前，请确认以下三件事</b>' +
        '<button class="modal-x" type="button" data-act="rp.mclose" aria-label="关闭">✕</button></div>' +
        '<div class="modal-b"><div class="rows" style="box-shadow:none">' +
        [['① 提交后不可修改、不可撤回',
          '还款记录是您对"我已经付款"的<b>事实陈述</b>，机构正是据此判断要不要确认。' +
          '本期<b>没有</b>修改、撤回与补充说明入口（X-LS-49 / D-RP-45）——' +
          '填错了（例如哈希抄错一位）只能靠线下沟通 + 机构照常确认。要写的说明请现在写进备注 RM-11。'],
         ['② 提交即停止本期逾期累加；机构将在 ' + CONFIRM_HOURS + ' 小时内确认，到期不会自动视为确认',
          '<b>提交成功的那一刻</b>（服务端时间 RM-06）起，该期的逾期天数' +
          (s.overdue ? '<b>冻结在 ' + s.odDays + ' 天</b>' : '<b>停止任何累加</b>') +
          '，此后<b>机构再拖多久都不变</b>（D-FIN-11）。<br>' +
          '还款确认时限到期时刻 <b>' + withTz(to) + '</b>（＝ 提交成功的服务端时间 + ' + CONFIRM_HOURS +
          ' 小时，精确到秒）。<b>到期只发一条通知，状态不变、额度不动</b>：' +
          '平台不会替机构承认"钱已收到"，也不会因此判定您逾期。'],
         ['③ 平台不核验转账真伪',
          (v.fiat ? '平台看不到银行流水，凭证只校验格式、大小与数量，<b>不审核真伪</b>。'
                  : '交易哈希<b>只做格式校验、不做链上核验</b>（D-RP-42）：平台不接索引服务，' +
                    '既不做阻断式也不做告警式核验。') +
          '判断权在机构手里——这正是确认环节存在的意义。']
        ].map(function(r){
          return '<div class="row"><div class="row-main"><div class="row-k">' + E(r[0]) + '</div>' +
            '<div class="row-v" style="color:var(--muted);font-size:12.5px;line-height:1.6">' + r[1] + '</div></div></div>';
        }).join('') + '</div>' +
        '<div class="ls-pick" style="margin-top:14px">' +
          '<span>第 <span class="n">' + p.seq + '</span> 期 · 应还日 <span class="n">' + p.due + '</span></span>' +
          '<span class="sp"></span>' +
          '<span>应还合计 <span class="n">' + amt(p.total) + '</span> ' + CCY + '</span><span class="sp"></span>' +
          '<span>还款时间 <span class="n">' + E(v.given || '—') + '</span></span><span class="sp"></span>' +
          '<span>' + (v.fiat ? '凭证 <span class="n">' + S.f.files.length + '</span> 个'
                             : '哈希 <span class="n">' + shortHash(v.hash) + '</span> · ' + E(deal.payee.chain)) +
          '</span></div>' +
        '<div class="check" style="margin-top:14px"><input type="checkbox" id="rpAck" ' + (S.ack ? 'checked' : '') +
          ' data-act="rp.ack"><label for="rpAck">我已阅读并理解以上三条，确认提交本期还款记录。</label></div>' +
        '<p class="hint">原型内的结果模拟：选择服务端终检的返回，用于走通分册 6.7 的各条分支。' +
        '真实系统里这些结论一律由服务端在提交时刻实时重算给出。</p>' +
        '<select class="inp" data-act="rp.f" data-v="submitOut" id="submitOut">' +
          SUBMIT_OUTCOMES.map(function(o){
            return '<option value="' + o[0] + '"' + (S.out === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="modal-f"><button class="btn" type="button" data-act="rp.mclose">取消</button>' +
        '<button class="btn primary" type="button" ' + (S.ack ? '' : 'disabled ') +
        'data-act="rp.repaySubmit">确认提交还款记录</button></div></div></div>';
    },
    /* 确认收到还款的二次确认：两件事必须讲清；末期另明示结清与授信释放（6.5.2） */
    confirm_repayment:function(){
      var sel = currentSel(); if(!sel || !sel.p) return '';
      var deal = sel.deal, p = sel.p, s = sel.s, g = dealProgress(deal);
      var isLast = p.last, willSettle = isLast && g.done === g.n - 1;
      var rows = [
        ['① 确认即表示您已核实该笔款项确已到账',
         '平台<b>不核验转账真伪</b>' + (isFiat(deal) ? '——平台看不到您的银行流水'
           : '——交易哈希只做过格式校验，<b>没有做链上核验</b>') + '。' +
         '请先对照' + (isFiat(deal) ? '银行流水' : '链上记录与您的钱包余额') +
         '确认这笔钱确实到了、是这个金额、进的是这个账户。<br>' +
         '<b>跨境手续费导致实收少于应还是可能发生的</b>：本期没有差额说明字段，' +
         '平台记录的是"应还金额"。若因此不认，请<b>先不要确认</b>并走客服邮箱——' +
         '对方的逾期天数不会因此继续累加。'],
        ['② 确认后不可撤销',
         '同一次结算内：第 ' + p.seq + ' 期转 <b>S-RP-3 已结清</b>、记 RP-17 结清时间、' +
         (p.principal
           ? '<b>项目融资余额 −' + amt(p.principal) + '</b> 且 <b>授信占用额 −' + amt(p.principal) + '</b>'
           : '<b>两个额度量一个都不动</b>（利息期，利息不是本金）') +
         '、更新 FD-30 与 FD-31。本期<b>不提供撤销</b>——发现确认错了只能走线下。']
      ];
      if(willSettle) rows.push(['③ 本笔融资业务将就此结清',
        '这是最后一个未结清期次。确认完成后业务 S-FD-6 → <b>S-FD-8 已结清</b>（终态），' +
        '清除 S-FD-9 逾期标记，<b>您对该资产方的授信占用额将等额释放 ' + usd(p.principal) + '</b>，' +
        '可用授信同额恢复。<br>' +
        '「该笔已结清」这一事实交给 WS-324 判定项目终态与质押释放，' +
        '<b>本模块不释放任何质押</b>（D-RP-39）。']);
      return '<div class="mask" data-act="rp.mclose"><div class="modal wide" role="dialog" aria-modal="true">' +
        '<div class="modal-h"><b>确认收到还款</b>' +
        '<button class="modal-x" type="button" data-act="rp.mclose" aria-label="关闭">✕</button></div>' +
        '<div class="modal-b"><div class="rows" style="box-shadow:none">' +
        rows.map(function(r){
          return '<div class="row"><div class="row-main"><div class="row-k">' + E(r[0]) + '</div>' +
            '<div class="row-v" style="color:var(--muted);font-size:12.5px;line-height:1.6">' + r[1] + '</div></div></div>';
        }).join('') + '</div>' +
        (s.overdue ? '<div class="ls-pick" style="margin-top:14px">' +
          '<span>对方该期逾期 <span class="n">' + s.odDays + '</span> 天</span><span class="sp"></span>' +
          '<span>已于 <span class="n">' + s.frozenAt + '</span> 冻结</span><span class="sp"></span>' +
          '<span>确认与否不改变这个数</span></div>' : '') +
        '<div class="check" style="margin-top:14px"><input type="checkbox" id="cfAck" ' + (S.ack ? 'checked' : '') +
          ' data-act="rp.ack"><label for="cfAck">我已核实该笔款项确已到账，确认并知悉确认后不可撤销。</label></div>' +
        '<p class="hint">原型内的结果模拟：走通分册 6.7 与 AC-RP-13 的一致性要求。</p>' +
        '<select class="inp" data-act="rp.f" data-v="confirmOut" id="confirmOut">' +
          [['ok','确认成功（期次结清 + 含本金期次两量等额递减）'],
           ['settle','E-RP-11 结算部分失败 → 整体回滚，保持 S-RP-2'],
           ['gone','E-RP-09 期次已不在 S-RP-2 → 按权威状态结算 + 运营告警']].map(function(o){
            return '<option value="' + o[0] + '"' + (S.cout === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="modal-f"><button class="btn" type="button" data-act="rp.mclose">再想想</button>' +
        '<button class="btn primary" type="button" ' + (S.ack ? '' : 'disabled ') +
        'data-act="rp.confirmSubmit">确认收到还款</button></div></div></div>';
    }
  },
  hash:{
    build:function(){
      var sel = currentSel();
      if(!sel) return '#/deal';
      if(S.page === 'P-LS-10') return '#/schedule/' + planNo(sel.deal, sel.p) + '?action=confirm_repayment';
      if(S.page === 'P-LS-91') return '#/deal/' + sel.deal.id + '?action=schedule';
      return S.sel ? '#/schedule/' + planNo(sel.deal, sel.p) + '?action=repay'
                   : '#/deal/' + sel.deal.id + '?action=repay';
    },
    read:function(){
      var h = (location.hash || '').replace(/^#\/?/, ''); if(!h) return false;
      var parts = h.split('?'), seg = parts[0].split('/'), qs = {};
      (parts[1] || '').split('&').forEach(function(kv){
        var i = kv.indexOf('='); if(i > 0) qs[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); });
      var act = qs.action || 'repay';
      if(seg[0] === 'deal'){
        S.page = act === 'schedule' ? 'P-LS-91' : 'P-LS-09';
        S.st = 'default'; S.did = seg[1]; S.didPage = S.page; S.sel = null;
        /* deal/{id}?action=repay 按 D-RP-22 定位该业务下的最近一笔应还 */
        var d = findDeal(seg[1]);
        S.missingDeal = d ? null : seg[1];
        if(d && d.planReady && S.page === 'P-LS-09'){
          var plan = finalPlan(d);
          for(var i = 0; i < plan.length; i++)
            if(periodState(d, plan[i]).st === 'S-RP-1'){ S.sel = { id:d.id, seq:plan[i].seq }; break; }
        }
        S.role = 'asset';
        return true;
      }
      if(seg[0] === 'schedule'){
        /* schedule/{RP-01}?action=repay|confirm_repayment 直达指定期次。
           锚点自带身份：两个锚点各自只对一方开放（分册 6.8.1）。 */
        S.page = act === 'confirm_repayment' ? 'P-LS-10' : 'P-LS-09';
        S.role = act === 'confirm_repayment' ? 'fund' : 'asset';
        S.st = 'default'; S.did = null; S.didPage = null;
        var no = seg[1] || '', seq = parseInt(no.slice(-6), 10);
        for(var j = 0; j < DEALS.length; j++){
          if(DEALS[j].planReady && planNo(DEALS[j], { seq:seq }) === no){
            S.sel = { id:DEALS[j].id, seq:seq }; break;
          }
        }
        return true;
      }
      return false;
    }
  },
  onGo:function(){ S.modal = null; S.ack = false; S.missingDeal = null; },
  onSetState:function(){ S.did = null; S.didPage = null; S.sel = null; S.result = null;
                         S.missingDeal = null;
                         S.f = { given:'', hash:'', memo:'', files:[], extra:[], upErr:null, sizeShown:false }; },
  onAct:function(n, a, v){
    if(a.indexOf('rp.') !== 0) return false;
    var sel, deal, p, s, pair;
    switch(a){
      case 'rp.role': S.role = v; S.result = null; CF.render(); return true;
      case 'rp.why':  toast('info', '该操作当前不可用', n.getAttribute('title') || ''); return true;
      case 'rp.f':    return true;   /* 字段回写由下面自挂的 input / change 一层负责，点击本身不重绘 */
      case 'rp.ack':  S.ack = n.checked; CF.render(); return true;

      case 'rp.sel':
        pair = String(v).split(':');
        S.sel = { id:pair[0], seq:+pair[1] }; S.result = null;
        S.f = { given:'', hash:'', memo:'', files:[], extra:[], upErr:null, sizeShown:false };
        CF.render(); return true;

      case 'rp.whySeq': {
        pair = String(v).split(':');
        deal = findDeal(pair[0]);
        if(!deal) return true;
        var pl = finalPlan(deal), pp = null;
        for(var i = 0; i < pl.length; i++) if(pl[i].seq === +pair[1]) pp = pl[i];
        if(!pp) return true;
        var ra = repayAction(deal, pp, S.role);
        toast('info', '该期次当前不可选：' + ra.brief, ra.reason.replace(/\*\*/g, ''));
        return true;
      }

      case 'rp.do':
        if(v === 'repay'){ S.ack = false; S.out = 'ok'; S.result = null; S.modal = { type:'repay' }; }
        else if(v === 'confirm_repayment'){ S.ack = false; S.cout = 'ok'; S.result = null;
                                            S.modal = { type:'confirm_repayment' }; }
        CF.render(); return true;

      case 'rp.toSchedule':
        S.did = v; S.didPage = 'P-LS-91'; S.result = null; S.sel = null; CF.go('P-LS-91'); return true;
      case 'rp.toRepay':
        S.did = v; S.didPage = 'P-LS-09'; S.result = null; S.sel = null; CF.go('P-LS-09'); return true;
      case 'rp.toConfirm':
        pair = String(v).split(':');
        S.sel = { id:pair[0], seq:+pair[1] }; S.result = null; CF.go('P-LS-10'); return true;

      case 'rp.download':
        toast('info', '原型内不提供真实文件',
          '真实系统在此内嵌预览并提供鉴权下载；文件仅该笔业务双方可访问，服务端过滤而非前端隐藏，' +
          '且不使用可猜测的公开直链。');
        return true;

      case 'rp.copyMail':
        sel = currentSel();
        toast('info', '已复制客服邮箱与两个编号',
          SUPPORT_MAIL + '　融资业务编号 ' + (sel ? sel.deal.id : '') +
          '　还款计划编号 ' + (sel && sel.p ? planNo(sel.deal, sel.p) : '—') +
          '　·　邮箱地址为占位常量（Q-LN-01 待业务方提供，本模块与 WS-326 共用同一个），' +
          '拿到后替换一个常量即可，不触及流程与页面结构。平台不承诺处理时效、不承诺处理结果。');
        return true;

      /* ---- 上传：法币凭证与数币补充材料共用，第二次演示超限（E-RP-06）---- */
      case 'rp.upload': {
        var list = v === 'extra' ? S.f.extra : S.f.files;
        var cap  = v === 'extra' ? EXTRA_MAX_N : FIAT_MAX_N;
        if(list.length >= cap){
          S.f.upErr = '最多上传 ' + cap + ' 个文件，当前已有 ' + list.length +
            ' 个。已上传的其他文件保留，请先移除不需要的再继续。';
          CF.render(); return true;
        }
        if(v !== 'extra' && list.length === 1 && !S.f.sizeShown){
          S.f.sizeShown = true;
          S.f.upErr = '文件「银行支付凭证-扫描件-背面.tiff」未通过：① 格式为 TIFF，本期只接受 PDF / JPG / PNG；' +
            '② 大小 12.6 MB，超过单文件 ' + FILE_MAX_MB + ' MB 上限。<b class="ls-b">已上传的其他文件保留</b>，无需重传。';
          CF.render(); return true;
        }
        S.f.upErr = null;
        list.push(v === 'extra'
          ? { n:'钱包转账截图-' + (list.length + 1) + '.png', s:(0.3 + list.length * 0.2).toFixed(1) + ' MB' }
          : { n:'银行支付凭证-回单-' + (list.length + 1) + '.pdf', s:(0.7 + list.length * 0.3).toFixed(1) + ' MB' });
        CF.render(); return true;
      }
      case 'rp.rmFile':  S.f.files.splice(+v, 1); S.f.upErr = null; CF.render(); return true;
      case 'rp.rmExtra': S.f.extra.splice(+v, 1); CF.render(); return true;

      /* ---- 还款提交 ---- */
      case 'rp.repaySubmit': {
        sel = currentSel(); if(!sel || !sel.p) return true;
        deal = sel.deal; p = sel.p; s = sel.s;
        var out = (q('#submitOut') || {}).value || S.out || 'ok';
        var fv = formState(deal, p);
        S.modal = null; S.ack = false;
        if(out === 'ok'){
          if(!fv.ok){
            S.result = { k:'moved', detail:'表单尚未通过前端校验，服务端不会收到本次提交' };
            CF.render(); return true;
          }
          var id = 'RM' + dayOnly(NOW).replace(/-/g, '') + '000009';
          deal.paid[p.seq] = { id:id, at:NOW, given:fv.given,
                               files:S.f.files.slice(), extra:S.f.extra.slice(),
                               hash:fv.fiat ? null : fv.hash, chain:fv.fiat ? null : deal.payee.chain,
                               memo:(S.f.memo || '').trim(), confirmAt:null };
          S.result = { k:'submitted', id:id, seq:p.seq, at:NOW, od:s.odDays,
                       to:tstr(tmin(NOW) + CONFIRM_HOURS * 60) };
          S.sel = { id:deal.id, seq:p.seq };
          toast('success', '还款记录已提交',
            '第 ' + p.seq + ' 期转 S-RP-2 待还款确认；该期逾期天数已冻结在 ' + s.odDays +
            ' 天，还款确认时限开始计时。两个额度量一个都不动。');
          CF.go('P-LS-10'); return true;
        }
        if(out === 'notopen'){
          S.result = { k:'notopen', seq:p.seq, due:p.due, openAt:p.openAt };
        } else if(out === 'race'){
          S.result = { k:'race', id:'RM' + dayOnly(NOW).replace(/-/g, '') + '000003', at:NOW };
        } else if(out === 'moved'){
          S.result = { k:'moved', detail:'同事已于 ' + withTz(NOW) + ' 为该期提交过还款记录（期次已进 S-RP-2）' };
        } else if(out === 'chain'){
          S.result = { k:'chain', chain:deal.payee.chain || 'Ethereum' };
        } else if(out === 'future'){
          S.result = { k:'future' };
        } else {
          S.result = { k:'upload',
            detail:'文件「银行支付凭证-扫描件-背面.tiff」未通过：① 格式为 TIFF，本期只接受 PDF / JPG / PNG；' +
                   '② 大小 12.6 MB，超过单文件 ' + FILE_MAX_MB + ' MB 上限。' };
        }
        CF.render(); window.scrollTo(0, 0); return true;
      }

      /* ---- 还款确认 ---- */
      case 'rp.confirmSubmit': {
        sel = currentSel(); if(!sel || !sel.p || !sel.s.rec) return true;
        deal = sel.deal; p = sel.p;
        var co = (q('#confirmOut') || {}).value || S.cout || 'ok';
        S.modal = null; S.ack = false;
        if(co === 'settle'){
          S.result = { k:'settle' };
          toast('info', '结算未完成，已整体回滚',
            '期次保持 S-RP-2 待还款确认，两个额度量与确认前完全一致。可重试。');
        } else if(co === 'gone'){
          S.result = { k:'gone' };
          toast('danger', '期次状态异常', '按权威状态结算并生成运营告警（E-RP-09）。');
        } else {
          deal.paid[p.seq].confirmAt = NOW;
          if(p.principal){
            deal.pool.bal = round2(deal.pool.bal - p.principal);
            deal.cr.used  = round2(deal.cr.used - p.principal);
          }
          var g2 = dealProgress(deal), settled = (g2.done === g2.n);
          if(settled){ deal.st = 'S-FD-8'; deal.fd33 = NOW; }
          S.result = { k:'confirmed', seq:p.seq, at:NOW, principal:p.principal, settled:settled };
          toast('success', '已确认收到还款',
            '第 ' + p.seq + ' 期转 S-RP-3 已结清' +
            (p.principal ? '；项目融资余额与授信占用额同刻等额递减 ' + amt(p.principal) : '；利息期，两个量不变') +
            (settled ? '；本笔业务已结清 S-FD-8。' : '。'));
        }
        CF.render(); window.scrollTo(0, 0); return true;
      }

      case 'rp.mclose':
        if(n.classList.contains('mask') || n.classList.contains('modal-x') || n.tagName === 'BUTTON'){
          S.modal = null; S.ack = false; CF.render();
        }
        return true;
    }
    return false;
  }
};

/* ---- 表单字段回写 ----
   公共壳层在 document 上只挂了 click，它头部注释里提到的 onInput(n,k) 钩子**没有实装**
   （shell.js 全文没有 input / change 监听）。本模块三页都有表单或选择器，必须拿到这两个事件，
   因此在这里自挂一层——只认本模块的 data-act="rp.f"，不接管公共层的任何分发、不改 _shared。
     input  → 只回写状态，**不重绘**：重绘会把正在输入的那个框的焦点与光标位置冲掉；
     change → 回写并重绘，派生读数（校验结论、按钮可用性、字数）在离焦或选择时随之更新。
   与 WS-326 同一处理（**不是 WS-325 的旧版本**），同一条对公共层的修订请求记在模块 README §5.3。 */
function writeField(k, val){
  if(k === 'given')            S.f.given = val;
  else if(k === 'hash')        S.f.hash = val;
  else if(k === 'memo')        S.f.memo = val;
  else if(k === 'submitOut')   S.out = val;    /* 结果模拟的选择也进状态：重绘不把已选项冲掉 */
  else if(k === 'confirmOut')  S.cout = val;
}
function fieldNode(e){
  var n = e.target && e.target.closest ? e.target.closest('[data-act="rp.f"]') : null;
  return (n && n.getAttribute('data-v')) ? n : null;
}
document.addEventListener('input', function(e){
  var n = fieldNode(e); if(!n) return;
  writeField(n.getAttribute('data-v'), n.value);
});
document.addEventListener('change', function(e){
  var n = fieldNode(e); if(!n) return;
  writeField(n.getAttribute('data-v'), n.value);
  /* 推迟一拍再重绘：change 常常在 blur 的派发过程中触发，此时同步改写 #content
     会抛 "The node to be removed is no longer a child of this node"，
     并可能把紧随其后的那一次点击一起吞掉（承接 WS-326 的写法）。 */
  setTimeout(function(){ CF.render(); }, 0);
});

CF.define(mod);
CF.boot();
})();
