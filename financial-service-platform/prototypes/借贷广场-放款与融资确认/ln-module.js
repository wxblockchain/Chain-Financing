/* ==========================================================================
   ln-module.js — 借贷广场 · 放款与融资确认（WS-326）
   PRD 基线：v1.0-借贷广场-放款与融资确认-PRD.md V1.0 + 分册 01-数据字典与对外契约 V1.0
             （两份**只在 issue 附件上、尚未入库**，见模块 README §1）
   上游：WS-324 PRD V7.0 / 原型 v1.2.2；WS-325 PRD V4.0 / 原型 v1.0（commit 64398ad）

   本文件只写本模块的页面、文案、演示数据与状态。
   token / 公共组件 / 运行时 / 页面登记一律来自 _shared，不在此重建。

   页面：P-LS-07 放款录入（含盖章件核验区与三个处置动作）· P-LS-08 融资确认
   ========================================================================== */
(function () {
"use strict";

/* ================================================================
   Part A —— 口径常量、枚举与演示数据
   全部业务数据为演示数据：企业名带「（演示）」后缀，编号 / 金额 / 账号 / 哈希均为虚构。
   ================================================================ */

/* ---- 口径常量（分册 7.3 枚举与常量） ---- */
var CCY           = 'USD';   /* 记账本位币：转移金额恒取 QT-03（D-FIN-13 / D-LN-09） */
var CONFIRM_HOURS = 168;     /* 融资确认时限：常量 168 小时 ＝ 7 个自然日（D-LN-32），不可配置、不可延长、无宽限期 */
var NEAR_HOURS    = 24;      /* 临近提醒提前量：24 小时，只发一档 */
var PLEDGE_RATE   = 0.8;     /* 质押率：常量 80%，本模块只消费、不展示可调暗示 */
var REASON_MAX    = 200;     /* 处置原因 1～200 字，自由文本不分类 */
var MEMO_MAX      = 200;     /* LN-11 放款备注 ≤ 200 字 */
var FILE_MAX_MB   = 10;      /* 单文件 ≤ 10 MB（沿用 WS-305 第 6 节基线，不另定一套） */
var FIAT_MIN_N    = 1;       /* LN-07 转账凭证 1～5 个，法币必传 */
var FIAT_MAX_N    = 5;
var EXTRA_MAX_N   = 5;       /* LN-12 补充材料 ≤ 5 个，数币分支选填 */
var NOW           = '2026-09-11 10:40';   /* 演示"当前时刻"，服务端时间 */
var TZ_LABEL      = 'UTC+8';              /* 平台统一时区标注，口径引用 WS-308『01-国际化基线』第 4 节 */
/* Q-LN-01 待确认：客服邮箱地址由业务方提供，页面与文案按 F-LS-49 做完，地址留占位常量 */
var SUPPORT_MAIL  = '{平台客服邮箱}';

/* ---- 融资业务状态（承接附册 A4.2 唯一一套状态机；本模块新增状态数 = 0，D-LN-01） ---- */
var FD_STATUS = {
  'S-FD-3' :{ t:'待放款',       tone:'info', x:'已接受报价，等待资金方核验盖章件并放款' },
  'S-FD-4' :{ t:'待融资确认',   tone:'info', x:'放款记录已提交，融资确认时限计时中' },
  'S-FD-6' :{ t:'还款中',       tone:'good', x:'融资确认完成，四个量已原子转移，还款计划由 WS-327 生成' },
  'S-FD-10':{ t:'已终止',       tone:'mute', x:'终态 · 资金方在 S-FD-3 段的终止动作，编号保留但作废' }
};
/* S-FD-5 放款异议处理中：本期不可达（X-LS-28 / X-LS-29 / D-LN-02）。
   条文保留、枚举保留，但界面不为它准备文案与筛选项，避免出现一个永远为空的 tab。
   它只出现在「本期没有的东西」反向清单里，不作为可切换的页面态。 */

/* ---- 处置动作三值（FD-19，缺一不可，DEP-14） ---- */
var DISPOSALS = {
  hold  :{ t:'暂不放款',       tag:'已暂缓放款',       tone:'' },
  redo  :{ t:'要求重传盖章件', tag:'待资产方重传盖章件', tone:'' },
  stop  :{ t:'终止业务',       tag:'已终止',           tone:'mute' }
};

/* ---- 身份：与 WS-324 / WS-325 同一套演示身份，不另造一套 ---- */
var ACTORS = {
  guest:{ k:'guest', t:'游客',   full:'未登录访客',           entity:null },
  asset:{ k:'asset', t:'资产方', full:'晟远科技（演示）',     entity:'E-ASSET-01' },
  fund: { k:'fund',  t:'资金方', full:'北岸融资租赁（演示）', entity:'E-FUND-07' }
};

/* ---- 区块浏览器（LN-13 由 LN-09 链 + LN-08 哈希拼出）----
   拼 URL 是本模块唯一与链有关的动作，**它只是拼一个字符串**：不发请求、不读链、不核验。 */
var EXPLORER = {
  'Ethereum':{ name:'Etherscan',  base:'https://etherscan.io/tx/' },
  'Tron'    :{ name:'Tronscan',   base:'https://tronscan.org/#/transaction/' },
  'Polygon' :{ name:'Polygonscan',base:'https://polygonscan.com/tx/' }
};

/* ---- 演示用收款账户（LN-10 收款账户快照：提交时刻从 FD-05 / FD-06 只读带出并固化）---- */
var PAYEE_FIAT = {
  name:'Shengyuan Technology Co., Ltd.', acct:'CNY62-4410-8827-0031',
  bank:'China Merchants Bank, Shanghai Branch', swift:'CMBCCNBS021', country:'中国大陆'
};
var PAYEE_COIN = { chain:'Ethereum', addr:'0x9C41Ab27Ee5d0B3f58Aa41E9d0c7B2Aa45E1c704' };

/* ---- 融资业务演示数据 ----
   pool 是项目维度的四个量（WS-324 口径，本模块只读消费）：
     valid 有效质押价值 · cap 融资上限（= valid × 80%）· bal 项目融资余额 · fly 项目在途金额
   cr 是机构 × 资产方维度（WS-325 口径）：limit 授信额度 · used 授信占用额 · fly 在途报价金额
   ln 是本模块产出的放款记录（LN-01 ～ LN-14），业务进入 S-FD-4 之后才存在。 */
function pool(valid, bal, fly, tokens){
  return { valid:valid, cap:Math.round(valid * PLEDGE_RATE * 100) / 100, bal:bal, fly:fly,
           tokens:tokens, assetType:'应收账款类' };
}
/* 项目编号的两类来源（**演示数据**）：
     · ws324 未标记的，取 WS-324 原型已有的项目（晟远科技名下 FP-20260812-0031 / FP-20260722-0027 /
       FP-20260416-0007，以及中垣建材名下 FP-20250820-0098）。跨文件「回到融资需求详情」可直达。
     · ws324:false 的，是本模块为走通各页面态新造的演示项目，**WS-324 原型的项目表里没有它们**，
       跨文件链接因此落到广场而不是一个不存在的详情页（不制造死链）。
   同一项目名下可以同时存在多笔在途业务：一个项目可以先后发布多笔融资需求（WS-324 的担保判据里
   「更早已保留需求金额合计」正是为此），每一笔需求至多承载一笔在途融资业务（D-FIN-33）。 */
var DEALS = [
  /* ① P-LS-07 默认：法币 USD · 担保正常 · 无任何标记 */
  { id:'FD-20260908-0061', pid:'FP-20260812-0031', pname:'华东电子元件应收账款池',
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:500000, rate:7.20, ccy:'USD', st:'S-FD-3', expired:false,
    quotedAt:'2026-09-08 14:20', acceptedAt:'2026-09-10 09:12',
    fx:{ v:1.0000, at:'2026-09-08 14:20', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260908-T1420' },
    payee:JSON.parse(JSON.stringify(PAYEE_FIAT)),
    pool:pool(1000000, 0, 500000, 3), cr:{ limit:1200000, used:300000, fly:500000 },
    seals:[{ n:'华东电子元件-融资合同-双方盖章件.pdf', s:'2.4 MB', at:'2026-09-10 09:10', by:'晟远科技（演示）· 周敏' }],
    marks:{}, disp:[] },

  /* ② P-LS-07 数币分支：USDT · Ethereum · 担保正常 */
  { id:'FD-20260907-0060', pid:'FP-20260712-0026', pname:'华南消费电子应收账款池', ws324:false,
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'明泰家电（演示）', entity:'E-ASSET-04',
    amt:450000, rate:8.10, ccy:'USDT', st:'S-FD-3', expired:false,
    quotedAt:'2026-09-07 11:05', acceptedAt:'2026-09-09 16:40',
    fx:{ v:0.9994, at:'2026-09-07 11:05', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260907-T1105' },
    payee:{ chain:'Ethereum', addr:PAYEE_COIN.addr },
    pool:pool(800000, 0, 450000, 5), cr:{ limit:900000, used:120000, fly:450000 },
    seals:[{ n:'华南消费电子-融资合同-双方盖章件.pdf', s:'3.1 MB', at:'2026-09-09 16:35', by:'明泰家电（演示）· 李岩' }],
    marks:{}, disp:[] },

  /* ③ P-LS-07 担保不足：放款 ⊘ + 缺口与追加指引；三个处置动作照常可用（AC-LN-08） */
  { id:'FD-20260905-0058', pid:'FP-20260722-0027', pname:'长三角精密零部件应收账款池',
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:300000, rate:7.60, ccy:'USD', st:'S-FD-3', expired:false,
    quotedAt:'2026-09-05 10:15', acceptedAt:'2026-09-06 14:02',
    fx:{ v:1.0000, at:'2026-09-05 10:15', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260905-T1015' },
    payee:JSON.parse(JSON.stringify(PAYEE_FIAT)),
    /* 池内 2 张代币底层应收账款于 2026-09-10 失效：有效质押价值 560,000 → 310,000，
       融资上限 248,000 < 项目融资余额 0 + 项目在途金额 300,000 ⇒ INV-FIN-01 不成立 */
    pool:pool(310000, 0, 300000, 6), cr:{ limit:1200000, used:300000, fly:300000 },
    seals:[{ n:'长三角精密零部件-融资合同-双方盖章件.pdf', s:'1.9 MB', at:'2026-09-06 13:58', by:'晟远科技（演示）· 周敏' }],
    marks:{}, disp:[] },

  /* ④ P-LS-07 待重传标记：机构已要求重传，资产方尚未重传；历史版本保留（D-LN-23） */
  { id:'FD-20260906-0063', pid:'FP-20260805-0029', pname:'华东包装材料应收账款池', ws324:false,
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:600000, rate:9.20, ccy:'USD', st:'S-FD-3', expired:false,
    quotedAt:'2026-09-06 08:15', acceptedAt:'2026-09-08 10:30',
    fx:{ v:1.0000, at:'2026-09-06 08:15', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260906-T0815' },
    payee:JSON.parse(JSON.stringify(PAYEE_FIAT)),
    pool:pool(1050000, 0, 600000, 11), cr:{ limit:1200000, used:300000, fly:600000 },
    seals:[{ n:'华东包装材料-融资合同-双方盖章件.pdf', s:'2.2 MB', at:'2026-09-08 10:26', by:'晟远科技（演示）· 周敏' }],
    marks:{ redo:{ at:'2026-09-10 17:24', by:'北岸融资租赁（演示）· 陈立',
                   why:'盖章件第 3 页的公章为「晟远科技服务（演示）」，与本笔业务的资产方主体「晟远科技（演示）」不一致，请核对后重新加盖并上传。' } },
    disp:[{ k:'redo', at:'2026-09-10 17:24', by:'北岸融资租赁（演示）· 陈立',
            why:'盖章件第 3 页的公章与本笔业务的资产方主体不一致，请核对后重新加盖并上传。' }] },

  /* ⑤ P-LS-07 已暂缓放款标记 + 项目「已到期 · 存量处理中」并行标记（中性呈现，D-FIN-47） */
  { id:'FD-20260903-0056', pid:'FP-20250820-0098', pname:'北方建材应收账款池',
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'中垣建材（演示）', entity:'E-ASSET-03',
    amt:250000, rate:8.80, ccy:'USD', st:'S-FD-3', expired:true, expiresAt:'2026-08-20',
    quotedAt:'2026-08-02 09:40', acceptedAt:'2026-08-05 11:20',
    fx:{ v:1.0000, at:'2026-08-02 09:40', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260802-T0940' },
    payee:JSON.parse(JSON.stringify(PAYEE_FIAT)),
    pool:pool(1500000, 900000, 250000, 5), cr:{ limit:800000, used:0, fly:250000 },
    seals:[{ n:'北方建材-融资合同-双方盖章件.pdf', s:'2.7 MB', at:'2026-08-05 11:12', by:'中垣建材（演示）· 何静' }],
    marks:{ hold:{ at:'2026-09-10 15:08', by:'北岸融资租赁（演示）· 陈立',
                   why:'合同第 7 条的还款账户与贵司在平台上确认的收款账户不是同一个开户行，我方内部复核中，本周内给答复。' } },
    disp:[{ k:'hold', at:'2026-09-10 15:08', by:'北岸融资租赁（演示）· 陈立',
            why:'合同第 7 条的还款账户与平台上确认的收款账户不是同一个开户行，我方内部复核中。' }] },

  /* ⑥ P-LS-08 默认：法币 · 已放款 · 剩余融资确认时限 4 天余 */
  { id:'FD-20260904-0062', pid:'FP-20260416-0007', pname:'长三角医疗器械应收账款池',
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:200000, rate:7.40, ccy:'USD', st:'S-FD-4', expired:false,
    quotedAt:'2026-09-04 10:05', acceptedAt:'2026-09-07 09:50',
    fx:{ v:1.0000, at:'2026-09-04 10:05', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260904-T1005' },
    payee:JSON.parse(JSON.stringify(PAYEE_FIAT)),
    pool:pool(600000, 0, 200000, 9), cr:{ limit:1200000, used:300000, fly:200000 },
    seals:[{ n:'长三角医疗器械-融资合同-双方盖章件.pdf', s:'2.0 MB', at:'2026-09-07 09:44', by:'晟远科技（演示）· 周敏' }],
    marks:{}, disp:[],
    ln:{ id:'LN20260908000003', at:'2026-09-08 16:20', given:'2026-09-08 14:55',
         files:[{ n:'电汇凭证-回单.pdf', s:'0.7 MB' }],
         memo:'已通过上海分行电汇，汇出行手续费 260 元、电报费 150 元由贵司承担，中转行扣费以入账为准。' } },

  /* ⑦ P-LS-08 不足 24 小时：加强提示、倒计时切分钟精度 */
  { id:'FD-20260902-0054', pid:'FP-20260624-0021', pname:'华北仪器仪表应收账款池',
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:300000, rate:8.35, ccy:'USD', st:'S-FD-4', expired:false,
    quotedAt:'2026-09-02 08:20', acceptedAt:'2026-09-04 13:15',
    fx:{ v:1.0000, at:'2026-09-02 08:20', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260902-T0820' },
    payee:JSON.parse(JSON.stringify(PAYEE_FIAT)),
    pool:pool(620000, 0, 300000, 7), cr:{ limit:1200000, used:300000, fly:300000 },
    seals:[{ n:'华北仪器仪表-融资合同-双方盖章件.pdf', s:'1.6 MB', at:'2026-09-04 13:10', by:'晟远科技（演示）· 周敏' }],
    marks:{}, disp:[],
    ln:{ id:'LN20260905000001', at:'2026-09-05 02:10', given:'2026-09-04 17:30',
         files:[{ n:'跨境汇款回单-华北仪器仪表.pdf', s:'0.9 MB' }], memo:'' } },

  /* ⑧ P-LS-08 数币分支：USDT · Ethereum · 哈希 + 链 + 区块浏览器链接（平台未核验） */
  { id:'FD-20260901-0053', pid:'FP-20260710-0024', pname:'华中医药流通应收账款池', ws324:false,
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:250000, rate:8.90, ccy:'USDT', st:'S-FD-4', expired:false,
    quotedAt:'2026-09-01 09:05', acceptedAt:'2026-09-06 10:44',
    fx:{ v:0.9994, at:'2026-09-01 09:05', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260901-T0905' },
    payee:{ chain:'Ethereum', addr:PAYEE_COIN.addr },
    pool:pool(1050000, 0, 250000, 11), cr:{ limit:1200000, used:300000, fly:250000 },
    seals:[{ n:'华中医药流通-数币放款-融资合同盖章件.pdf', s:'2.1 MB', at:'2026-09-06 10:40', by:'晟远科技（演示）· 周敏' }],
    marks:{}, disp:[],
    ln:{ id:'LN20260909000002', at:'2026-09-09 20:18', given:'2026-09-09 20:02',
         hash:'0x7d41e6b9c2a05f38bd7c1140e9a83f62c5d0b7a41e93f6082cd514b7a6039e18',
         chain:'Ethereum', files:[],
         extra:[{ n:'钱包转账截图.png', s:'0.4 MB' }],
         memo:'链上手续费由我方承担，与跨境手续费无关。' } },

  /* ⑨ P-LS-08 已超期：中性标记「已超过确认时限 N 天」+ 客服邮箱出口（D-LN-33 / AC-LN-12） */
  { id:'FD-20260826-0050', pid:'FP-20260518-0015', pname:'西北矿业设备应收账款池', ws324:false,
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:200000, rate:7.90, ccy:'USD', st:'S-FD-4', expired:true, expiresAt:'2026-09-08',
    quotedAt:'2026-08-26 11:00', acceptedAt:'2026-08-27 15:30',
    fx:{ v:1.0000, at:'2026-08-26 11:00', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260826-T1100' },
    payee:JSON.parse(JSON.stringify(PAYEE_FIAT)),
    pool:pool(400000, 0, 200000, 4), cr:{ limit:1200000, used:300000, fly:200000 },
    seals:[{ n:'西北矿业设备-融资合同-双方盖章件.pdf', s:'2.9 MB', at:'2026-08-27 15:22', by:'晟远科技（演示）· 周敏' }],
    marks:{}, disp:[],
    ln:{ id:'LN20260828000001', at:'2026-08-28 09:00', given:'2026-08-27 16:40',
         files:[{ n:'电汇凭证-西北矿业设备.pdf', s:'0.8 MB' }],
         memo:'汇出行为交通银行上海分行，已扣汇出手续费。' } },

  /* ⑩ P-LS-08 放款后担保跌破：确认照常可以完成（D-LN-08），不加担保校验 */
  { id:'FD-20260828-0051', pid:'FP-20260630-0039', pname:'西南医疗耗材应收账款池', ws324:false,
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:150000, rate:8.00, ccy:'USD', st:'S-FD-4', expired:false,
    quotedAt:'2026-08-28 10:20', acceptedAt:'2026-09-05 09:15',
    fx:{ v:1.0000, at:'2026-08-28 10:20', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260828-T1020' },
    payee:JSON.parse(JSON.stringify(PAYEE_FIAT)),
    pool:pool(160000, 0, 150000, 3), cr:{ limit:1200000, used:300000, fly:150000 },
    seals:[{ n:'西南医疗耗材-融资合同-双方盖章件.pdf', s:'1.4 MB', at:'2026-09-05 09:10', by:'晟远科技（演示）· 周敏' }],
    marks:{}, disp:[],
    ln:{ id:'LN20260906000001', at:'2026-09-06 09:30', given:'2026-09-05 18:10',
         files:[{ n:'电汇凭证-西南医疗耗材.pdf', s:'0.6 MB' }], memo:'' } },

  /* ⑪ 已确认：S-FD-6 还款中，四个量已完成原子转移（AC-FIN-25 / AC-FIN-30 的结果态） */
  { id:'FD-20260820-0046', pid:'FP-20260416-0007', pname:'长三角医疗器械应收账款池',
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:500000, rate:6.80, ccy:'USD', st:'S-FD-6', expired:false,
    quotedAt:'2026-08-20 09:30', acceptedAt:'2026-08-21 10:10',
    fx:{ v:1.0000, at:'2026-08-20 09:30', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260820-T0930' },
    payee:JSON.parse(JSON.stringify(PAYEE_FIAT)),
    pool:pool(600000, 500000, 0, 9), cr:{ limit:1200000, used:300000, fly:0 },
    seals:[{ n:'长三角医疗器械-2026-融资合同-双方盖章件.pdf', s:'2.3 MB', at:'2026-08-21 10:05', by:'晟远科技（演示）· 周敏' }],
    marks:{}, disp:[], fd24:'2026-08-24 10:12',
    ln:{ id:'LN20260822000001', at:'2026-08-22 14:26', given:'2026-08-22 11:40',
         files:[{ n:'电汇凭证-长三角医疗器械.pdf', s:'0.8 MB' }], memo:'' } },

  /* ⑫ 已终止：S-FD-10 终态，五个后果（D-LN-24） */
  { id:'FD-20260815-0041', pid:'FP-20260812-0031', pname:'华东电子元件应收账款池',
    fund:ACTORS.fund.full, fundEntity:'E-FUND-07', party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:500000, rate:7.50, ccy:'USD', st:'S-FD-10', expired:false,
    quotedAt:'2026-08-15 10:00', acceptedAt:'2026-08-16 09:20',
    fx:{ v:1.0000, at:'2026-08-15 10:00', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260815-T1000' },
    payee:JSON.parse(JSON.stringify(PAYEE_FIAT)),
    pool:pool(1000000, 0, 500000, 3), cr:{ limit:1200000, used:300000, fly:0 },
    seals:[{ n:'华东电子元件-融资合同-盖章件-作废版.pdf', s:'2.1 MB', at:'2026-08-16 09:15', by:'晟远科技（演示）· 周敏' }],
    marks:{}, terminated:{ at:'2026-08-18 16:40', by:'北岸融资租赁（演示）· 陈立',
      why:'合同主体名称与贵司在平台登记的企业主体不一致，且两次沟通后未能提供更正件，本笔业务我方不再继续。' },
    disp:[{ k:'stop', at:'2026-08-18 16:40', by:'北岸融资租赁（演示）· 陈立',
            why:'合同主体名称与平台登记的企业主体不一致，两次沟通后未能提供更正件。' }] }
];

/* ---- 页面态 → 演示业务的映射。每个必达状态都能在原型里点到，不靠文字描述 ---- */
var ST_DEAL = {
  'P-LS-07':{ 'default':'FD-20260908-0061', 'digital':'FD-20260907-0060', 'guard':'FD-20260905-0058',
              'reupload':'FD-20260906-0063', 'onhold':'FD-20260903-0056', 'gone':'FD-20260904-0062',
              'terminated':'FD-20260815-0041' },
  'P-LS-08':{ 'default':'FD-20260904-0062', 'soon':'FD-20260902-0054', 'digital':'FD-20260901-0053',
              'overdue':'FD-20260826-0050', 'guard':'FD-20260828-0051', 'done':'FD-20260820-0046' }
};

/* ================================================================
   Part B —— 格式化、时间与派生量
   ================================================================ */
/* 千分位与两位小数沿用 WS-324 / WS-325 的同一实现，不另造一套数字格式 */
function amt(n){
  if(n === null || n === undefined) return '—';
  var neg = n < 0; n = Math.abs(n);
  var s = n.toFixed(2), p = s.split('.');
  return (neg ? '-' : '') + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + p[1];
}
function money(n, ccy){ return amt(n) + ' ' + ccy; }
function usd(n){ return amt(n) + ' ' + CCY; }
function round2(n){ return Math.round(n * 100) / 100; }
function tmin(s){
  var m = String(s).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if(!m) return 0;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000;
}
function tstr(mins){
  var d = new Date(mins * 60000), p = function(x){ return ('0' + x).slice(-2); };
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) +
         ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
}
function withTz(s){ return s ? s + ' ' + TZ_LABEL : '—'; }
function dayOnly(s){ return String(s).slice(0, 10); }
/* 时长口径与 WS-325 一致：≥ 24 小时给「N 天 M 小时」，不足 24 小时切到「N 小时 M 分」（FD-27） */
function fmtDur(mins){
  if(mins <= 0) return '0 分';
  var d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), mi = Math.round(mins % 60);
  if(d > 0) return d + ' 天 ' + h + ' 小时';
  if(h > 0) return h + ' 小时 ' + mi + ' 分';
  return mi + ' 分';
}

/* ---- 融资确认时限（FD-26 / FD-27 / FD-25）----
   起算点恒取放款记录提交成功的服务端时间 LN-06，不用提交方填写的发放时间（D-FIN-21 / D-LN-31）。
   到期只产生一个展示标记与一次通知：状态、额度、权限一个不动（D-LN-03 / D-LN-33）。
   **倒计时在真实系统里由服务端给出到期时刻、前端只负责渲染**（AC-LS-101）。 */
function confirmClock(deal){
  if(!deal.ln) return { has:false };
  var from = tmin(deal.ln.at), to = from + CONFIRM_HOURS * 60, now = tmin(NOW);
  var leftMin = to - now, overMin = now - to;
  return {
    has:true, from:deal.ln.at, to:tstr(to),
    heldMin:Math.min(now - from, CONFIRM_HOURS * 60),
    leftMin:Math.max(0, leftMin),
    over:leftMin <= 0, overMin:Math.max(0, overMin),
    overDays:Math.floor(Math.max(0, overMin) / 1440),
    soon:leftMin > 0 && leftMin <= NEAR_HOURS * 60
  };
}
/* ---- 担保闸门 INV-FIN-01（AC-FIN-12 视角 B：放款前实时重算，不吃缓存）----
   判据 融资上限 ≥ 项目融资余额 + 项目在途金额。缺口按质押率折回需追加的资产价值。 */
function guaranteeCheck(deal){
  var p = deal.pool, need = round2(p.bal + p.fly), gap = round2(need - p.cap);
  return { pass:gap <= 0, cap:p.cap, bal:p.bal, fly:p.fly, need:need,
           gap:Math.max(0, gap), addAsset:round2(Math.max(0, gap) / PLEDGE_RATE), valid:p.valid };
}
function findDeal(id){ for(var i = 0; i < DEALS.length; i++) if(DEALS[i].id === id) return DEALS[i]; return null; }
function isFiat(deal){ return deal.ccy === CCY; }
function settleAmt(deal){ return isFiat(deal) ? deal.amt : round2(deal.amt / deal.fx.v); }
function explorerUrl(chain, hash){
  var e = EXPLORER[chain]; return e ? e.base + hash : '';
}
/* 交易哈希只做格式校验：0x + 64 位十六进制（沿用 WS-318 D-TI-06）。
   **不做链上核验**（D-FIN-22 / D-LN-10）：格式对就收下，平台没有判断这笔交易存不存在的能力。 */
function hashFormatOk(v){ return /^0x[0-9a-fA-F]{64}$/.test(String(v || '').trim()); }

/* ================================================================
   available_actions（H-03 / AC-LS-103）
   服务端在每次读取时返回当前可执行动作清单，前端按其渲染、不自行依据状态推断；
   须区分「不可见」（不返回）与「可见不可点 ⊘ + 可区分的原因」（AC-LN-09）。
   原型内由本函数就地模拟同一份契约。
   四个新增取值：disburse / confirm_disbursement / reupload_contract，
   以及三个处置动作 —— 它们**不各占一个锚点**（D-LN-39），随 disburse 一并返回。
   ================================================================ */
function availableActions(deal, role){
  var out = [];
  var isFund  = (role === 'fund'  && deal.fundEntity === ACTORS.fund.entity);
  var isAsset = (role === 'asset' && deal.entity === ACTORS.asset.entity);
  var guest   = (role === 'guest');
  var g = guaranteeCheck(deal);

  /* --- disburse：提交放款记录。⊘ 的四种原因各不相同，不存在"暂不可操作"的兜底（AC-LN-09） --- */
  var d = { key:'disburse', label:'提交放款记录', enabled:false, reason:'', brief:'' };
  if(guest){
    d.reason = '未登录。放款动作仅对该笔业务的资金方企业主体开放；本页 L1～L5 的公开商务字段不因未登录而隐藏。';
    d.brief  = '需登录';
  } else if(!isFund){
    d.reason = '本笔业务的放款动作只属于该笔业务的报价机构（' + deal.fund + '）。当前身份为「' +
               ACTORS[role].full + '」，非本笔业务的机构无权提交放款记录。';
    d.brief  = '非本笔业务的机构';
  } else if(deal.st !== 'S-FD-3'){
    d.reason = '该业务当前状态为「' + deal.st + ' ' + (FD_STATUS[deal.st] || {}).t + '」，' +
               (deal.st === 'S-FD-10' ? '已终止的业务不可放款。'
                : '放款入口只在 S-FD-3 待放款下可用；一笔融资业务至多一条有效放款记录（D-LN-29）。');
    d.brief  = (FD_STATUS[deal.st] || {}).t;
  } else if(!g.pass){
    d.reason = '该项目当前担保不足，暂不可放款。判据 INV-FIN-01：融资上限 ' + amt(g.cap) +
               ' ＜ 项目融资余额 ' + amt(g.bal) + ' ＋ 项目在途金额 ' + amt(g.fly) + ' ＝ ' + amt(g.need) +
               '，缺口 ' + usd(g.gap) + '，需资产方追加资产价值 ' + usd(g.addAsset) +
               '。资产方补足后放款入口自动恢复，不要求您重新进入页面。';
    d.brief  = '担保不足 · 缺口 ' + amt(g.gap);
  } else {
    d.enabled = true;
  }
  out.push(d);

  /* --- 三个处置动作：S-FD-3 下恒可用，担保闸门只挡放款、不挡处置（AC-LN-08 / AC-LN-07） --- */
  if(deal.st === 'S-FD-3' && (isFund || guest)){
    ['hold','redo','stop'].forEach(function(k){
      out.push({ key:k, label:DISPOSALS[k].t, enabled:!guest,
                 reason: guest ? '未登录。盖章件核验的三个处置动作仅对该笔业务的资金方企业主体开放。' : '' });
    });
  }

  /* --- confirm_disbursement：去确认到账。超期后照常返回（D-LN-33） --- */
  if(deal.st === 'S-FD-4'){
    var c = { key:'confirm', label:'确认到账', enabled:false, reason:'' };
    if(guest)        c.reason = '未登录。融资确认仅对该项目的资产方企业主体开放；放款的公开字段本身是公开的。';
    else if(!isAsset)c.reason = '融资确认只属于该项目的资产方企业主体（' + deal.party + '）。当前身份为「' +
                                ACTORS[role].full + '」。资金方在 S-FD-4 段没有任何写动作。';
    else c.enabled = true;
    out.push(c);
  }

  /* --- reupload_contract：资产方重传盖章件，FD-20 为真时才返回（标记为假时不可见，不是 ⊘） --- */
  if(deal.st === 'S-FD-3' && deal.marks && deal.marks.redo && (isAsset || guest)){
    out.push({ key:'reupload', label:'重传盖章件', enabled:!guest,
               reason: guest ? '未登录。重传盖章件仅对该项目的资产方企业主体开放。' : '' });
  }
  return out;
}
function actionOf(list, key){ for(var i = 0; i < list.length; i++) if(list[i].key === key) return list[i]; return null; }


/* ================================================================
   Part C —— 共用片段
   ================================================================ */
var CF = window.CF, E = CF.esc, q = CF.q, pageHead = CF.pageHead, toast = CF.toast;
var S = null;

function pill(tone, t){ return '<span class="pill ' + tone + '">' + E(t) + '</span>'; }
var TONE = { mute:'gray', info:'', good:'green', warn:'amber', crit:'red' };

/* 跨文件入口：WS-324 / WS-325 原型与本模块是同级目录，按登记表拼相对地址，不写死路径 */
function modHref(key, hash){
  var m = (CF.MODULES || {})[key];
  return m ? '../' + m.dir + '/' + m.file + (hash || '') : '#';
}
function lsHref(hash){ return modHref('lending-marketplace', hash); }
function cqHref(hash){ return modHref('lending-credit-quote', hash); }
/* 本模块演示项目不在 WS-324 的项目表里，链接落广场而不是一个不存在的详情页 */
function projHref(deal){
  return deal.ws324 === false ? lsHref('#/plaza') : lsHref('#/project/' + deal.pid);
}
function backToPlaza(text){
  return '<div class="ls-back"><a class="btn" href="' + lsHref('#/plaza') + '">← ' +
    E(text || '返回融资需求广场') + '</a></div>';
}

/* ---- 页头（沿用 WS-324 / WS-325 的面客详情页版式，类名一字不改）---- */
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
    ' data-act="ln.f" data-v="' + key + '">';
}
function ro(text, note){
  return '<div class="ls-ro">' + E(text) + '</div>' + (note ? '<p class="hint">' + note + '</p>' : '');
}
/* 动作按钮：区分「不可见」与「可见不可点 ⊘ + 可区分的原因」（H-03 / AC-LN-09） */
function actBtn(a, cls){
  if(a.enabled)
    return '<button class="btn ' + (cls || '') + '" type="button" data-act="ln.do" data-v="' + a.key + '">' +
      E(a.label) + '</button>';
  return '<button class="btn blocked ' + (cls || '').replace('primary', '') + '" type="button" aria-disabled="true" ' +
    'title="' + E(a.reason) + '" data-act="ln.why" data-v="' + a.key + '">⊘ ' + E(a.label) + '</button>' +
    '<div class="ls-why"><span class="sg" aria-hidden="true">⊘</span><span>' + E(a.reason) + '</span></div>';
}
/* 加载 / 失败 / 不存在三态外壳，两页共用（H-02：不报 404、不白屏、不静默跳首页） */
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

/* ---- 业务页头：两页共用，状态 / 标记 / 金额一处产生 ---- */
function dealHead(deal, pageId, title) {
  var st = FD_STATUS[deal.st] || { t:deal.st, tone:'mute' };
  var k = confirmClock(deal);
  var tags = pill(TONE[st.tone] || 'gray', deal.st + ' ' + st.t) +
    pill('gray', '资金方 ' + deal.fund) +
    pill('gray', '资产方 ' + deal.party) +
    (deal.marks && deal.marks.hold ? pill('gray', '已暂缓放款') : '') +
    (deal.marks && deal.marks.redo ? pill('gray', '待资产方重传盖章件') : '') +
    (deal.st === 'S-FD-4' && k.has && k.over ? pill('gray', '已超过确认时限 ' + k.overDays + ' 天') : '') +
    (deal.st === 'S-FD-4' && k.has && !k.over ? pill(k.soon ? 'amber' : '', '融资确认时限剩余 ' + fmtDur(k.leftMin)) : '') +
    (deal.expired ? pill('gray', '项目已到期 · 存量处理中') : '');
  return backToPlaza() + phead(
    '融资业务 · <span class="mono">' + pageId + '</span> · 编号 <span class="mono">' + deal.id +
      '</span> · 项目 <span class="mono">' + deal.pid + '</span> · 时区 ' + TZ_LABEL,
    title, deal.pname, tags,
    amtBlock('融资金额', amt(deal.amt), CCY,
      '结算 ' + amt(settleAmt(deal)) + ' ' + deal.ccy + ' · 年化 ' + deal.rate.toFixed(2) + '%')) +
    CF.pageStates() + resultCard();
}

/* ---- 招牌件 E：中性标记条（FD-20 / FD-21 / FD-25 / D-FIN-47）----
   四个标记一律中性灰：它们是状态说明，不是告警。AC-LN-13 逐条验收这件事。 */
function markRow(tag, body, meta){
  return '<div class="ln-mark"><span class="tg">' + E(tag) + '</span><div class="bd">' + body +
    (meta ? '<div class="mt">' + meta + '</div>' : '') + '</div></div>';
}
function marksBlock(deal, forAsset){
  var out = '', k = confirmClock(deal);
  if(deal.expired)
    out += markRow('已到期 · 存量处理中',
      '融资项目 <b>' + deal.pid + '</b> 的有效期已于 ' + (deal.expiresAt || '—') + ' 届满：停止接受新报价、不允许再次发布，' +
      '<b>存量融资业务照常履约</b> —— 本笔业务的放款与融资确认不受影响，照常走完。',
      '这是常态路径而不是异常：本期无提前还款，还本发生在项目到期之后，凡成交项目几乎都会经过这一段（D-FIN-47）。');
  if(deal.marks && deal.marks.hold)
    out += markRow('已暂缓放款',
      '<b>' + E(deal.marks.hold.by) + '</b> 于 ' + withTz(deal.marks.hold.at) + ' 登记了暂缓放款，原因：' +
      E(deal.marks.hold.why) +
      (forAsset ? '<br>业务<b>仍在 S-FD-3 待放款</b>，状态没有变化、四个量一个不动；机构想清楚后可随时直接放款。'
                : '<br>这是标记不是状态（D-LN-21）。您<b>随时可以直接提交放款</b>，提交时该标记自动清除，不需要先点一次"恢复"。'),
      '可重复登记，以最新一条为准，历史进留痕（FD-19 / FD-21）。原因对资产方可见。');
  if(deal.marks && deal.marks.redo)
    out += markRow('待资产方重传盖章件',
      '<b>' + E(deal.marks.redo.by) + '</b> 于 ' + withTz(deal.marks.redo.at) + ' 要求重传盖章件，原因：' +
      E(deal.marks.redo.why) +
      (forAsset ? '<br>请在下方重传盖章件。<b>重传成功即自动清除该标记</b>，机构无需再点一次"通过"。'
                : '<br>业务<b>仍在 S-FD-3</b>。资产方重传成功后标记自动清除、核验区立即出现新版本；' +
                  '<b>重传期间您的放款入口照常可用</b>（D-LN-23 ②）。'),
      '历史盖章件保留、不覆盖，每次重传产生新版本（D-LN-23 ①）；重传次数不设上限、不设冷却。');
  if(deal.st === 'S-FD-4' && k.has && k.over)
    out += markRow('已超过确认时限 ' + k.overDays + ' 天',
      '融资确认时限已于 ' + withTz(k.to) + ' 届满。<b>平台不会自动确认，也不会自动作废这笔业务</b>：' +
      '业务仍是 <b>S-FD-4 待融资确认</b>，四个量与届满前完全一致，确认入口照常可用，权限一点没变。',
      '超期只产生这一个展示标记与一次通知（D-LN-03 / D-LN-33）。超期的效力以到期时刻为准，不以判定任务的实际执行时刻为准（E-LN-12）。');
  return out ? '<div class="ls-alert">' + out + '</div>' : '';
}

/* ---- 商务条款摘要九项（D-FIN-87）：核验区右半与确认页第二区共用 ---- */
function termsSummary(deal){
  var rows = [
    ['融资业务编号', deal.id],
    ['资金方企业主体', deal.fund],
    ['资产方企业主体', deal.party],
    ['融资项目编号', deal.pid + '（' + deal.pname + '）'],
    ['融资金额', money(deal.amt, CCY)],
    ['结算币种与结算金额', money(settleAmt(deal), deal.ccy)],
    ['所用汇率快照', deal.fx.v.toFixed(4) + '　生效 ' + withTz(deal.fx.at) + '　来源 ' + deal.fx.src + '　版本 ' + deal.fx.ver],
    ['年化利率', deal.rate.toFixed(2) + '%'],
    ['抵押物概况', deal.pool.tokens + ' 张' + deal.pool.assetType + '代币 · 有效质押价值 ' + usd(deal.pool.valid)],
    ['报价提交时间', withTz(deal.quotedAt)]
  ];
  return '<div class="cq-sum"><div class="sh">商务条款摘要 · 九项' +
    '<span class="no">本摘要不是合同，不产生法律效力</span></div>' +
    '<div class="sb">' + rows.map(function(r){
      return '<div class="kk"><s>' + E(r[0]) + '</s><b>' + E(r[1]) + '</b></div>';
    }).join('') +
    '<div class="kk"><s>条款一致性声明</s><b>资产方已于 ' + withTz(deal.acceptedAt) + ' 勾选</b></div>' +
    '<div class="kk"><s>跨境手续费承担方</s><b>资产方（' + E(deal.party) + '）</b></div>' +
    '<div class="kk"><s>本金计量口径</s><b>按融资金额 ' + amt(deal.amt) + ' ' + CCY + ' 计，不按实收计</b></div>' +
    '</div></div>';
}

/* ---- 招牌件 B：四量转移牌（AC-FIN-25 / AC-FIN-30 / D-LN-07 / D-LN-24）----
   mode = 'disburse' 放款时刻：四个量一个都不动，右列刻意与左列同值
        = 'confirm'  确认时刻：两个维度同一次结算内各做一次原子转移
        = 'done'     已确认：转移的结果
        = 'stop'     终止：在途报价金额全额释放且不进授信占用额；项目在途金额不变 */
function xferCard(deal, mode){
  var a = deal.amt, p = deal.pool, c = deal.cr, still = (mode === 'disburse');
  function qbox(cls, nm, before, after, x){
    var v = (before === after)
      ? '<span>' + amt(after) + '</span>'
      : '<s>' + amt(before) + '</s>' + amt(after);
    return '<div class="q ' + cls + '"><div class="nm">' + nm + '</div><div class="v">' + v + '</div>' +
      '<div class="x">' + x + '</div></div>';
  }
  var head, foot, rows;
  if(mode === 'disburse'){
    head = '放款提交的这一刻，四个量一个都不动';
    rows = [
      ['项目维度 · 项目在途金额 / 项目融资余额',
        qbox('out', '项目在途金额', p.fly, p.fly, '<b>不变。</b>它从资产方发布需求时就在，直到融资确认完成才转出'),
        qbox('out', '项目融资余额', p.bal, p.bal, '<b>不变。</b>钱虽然打出去了，但资产方还没确认收到')],
      ['机构 × 资产方维度 · 在途报价金额 / 授信占用额',
        qbox('out', '在途报价金额', c.fly, c.fly, '<b>不变。</b>业务仍在途，尚未成为未偿本金'),
        qbox('out', '授信占用额', c.used, c.used, '<b>不变。</b>它的定义是未偿本金，确认之前债务尚未成立')]
    ];
    foot = '<b>反例（D-LN-07）</b>：若按"放款即释放"实现，项目在途金额此刻归 0 而余额尚未计入，' +
      '可融金额 ＝ 融资上限 ' + amt(p.cap) + ' − 0 − 0 ＝ ' + amt(p.cap) + '，' +
      '资产方可以在这 ' + CONFIRM_HOURS + ' 小时里拿同一份质押再发一笔需求，而这笔钱已经打出去了。' +
      '正确实现下放款后可融金额仍为 <b>' + usd(Math.max(0, round2(p.cap - p.bal - p.fly))) + '</b>，与放款前一致。';
  } else if(mode === 'stop'){
    head = '终止业务的同一次结算内，五个后果一致生效';
    rows = [
      ['项目维度 · 项目在途金额不变（D-LN-25）',
        qbox('out', '项目在途金额', p.fly, p.fly, '<b>不变。</b>需求从没被撤下，它还挂在广场上等下一家报价'),
        qbox('out', '项目融资余额', p.bal, p.bal, '<b>不变。</b>这笔业务没有成交，不产生任何余额')],
      ['机构 × 资产方维度 · 只出不进（AC-FIN-27）',
        qbox('out', '在途报价金额', c.fly, 0, '<b>全额释放。</b>本机构对该资产方的可用授信恢复原值'),
        qbox('out', '授信占用额', c.used, c.used, '<b>不进。</b>释放的额度不转入授信占用额，未偿本金没有产生')]
    ];
    foot = '另外三个后果：业务落 <b>S-FD-10 已终止</b>（终态，编号保留但作废、不回收不复用）；' +
      '项目由 <b>S-FP-4 融资中</b> 回到 <b>S-FP-2 募集中</b>，该需求重新可被任何机构报价（包括本机构自己重新报价，那是一笔全新业务）；' +
      '<b>质押不释放</b>（项目还在，D-FIN-49）。';
  } else {
    var done = (mode === 'done');
    head = done ? '融资确认已完成，四个量在同一次结算内完成了转移' : '确认到账的同一刻，四个量同时变化';
    var fly0 = done ? round2(p.fly + a) : p.fly, bal0 = done ? round2(p.bal - a) : p.bal;
    var cf0  = done ? round2(c.fly + a) : c.fly, cu0 = done ? round2(c.used - a) : c.used;
    rows = [
      ['项目维度 · AC-FIN-25',
        qbox('out', '项目在途金额', fly0, round2(fly0 - a), '−' + amt(a) + '　这笔金额从在途移出'),
        qbox('in',  '项目融资余额', bal0, round2(bal0 + a), '+' + amt(a) + '　同一时刻计入余额')],
      ['机构 × 资产方维度 · AC-FIN-30',
        qbox('out', '在途报价金额', cf0, round2(cf0 - a), '−' + amt(a) + '　业务不再在途'),
        qbox('in',  '授信占用额',   cu0, round2(cu0 + a), '+' + amt(a) + '　成为未偿本金，随还款递减')]
    ];
    foot = '<b>原子、无空档</b>：任何时刻一笔钱只能被计入其中一个，不得两边都不计、也不得两边都计。' +
      '分两次提交会出现「机构侧已转入未偿本金、项目侧还挂在在途」的窗口，该窗口内 AC-MC-10 的恒等式不成立。' +
      '转移金额恒等于 <b>QT-03 融资金额 ' + usd(a) + '</b>，不取放款记录里的数、也不重新取汇率（D-LN-09）。';
  }
  return '<div class="ln-xfer' + (still ? ' still' : '') + '">' +
    '<div class="xh">' + E(head) +
      '<span class="at">' + (mode === 'disburse' ? 'LN-06 提交时刻' : mode === 'stop' ? 'FD-23 终止时刻' : 'FD-24 确认时刻') + '</span></div>' +
    rows.map(function(r){
      return '<div class="dim"><div class="dn">' + r[0] + '</div>' +
        '<div class="qr">' + r[1] + '<div class="ar" aria-hidden="true">＋</div>' + r[2] + '</div></div>';
    }).join('') +
    '<div class="xf">' + foot + '</div></div>';
}

/* ---- 招牌件 A：融资确认时限条（FD-26 / FD-27 / D-LN-03）----
   与 WS-325 的报价有效期条同形，**口径与文案刻意不同**：到点只提醒、不改状态、不释放额度。
   超期态走中性灰，不走 warn —— 它不是告警（AC-LN-13）。 */
function confirmCountdown(deal, forAsset){
  var k = confirmClock(deal);
  if(!k.has) return '';
  var total = CONFIRM_HOURS * 60;
  var pctHeld = Math.min(100, k.heldMin / total * 100).toFixed(2);
  var cls = k.over ? ' over' : k.soon ? ' soon' : '';
  var big = k.over
    ? '<span class="v">已超过 ' + fmtDur(k.overMin) + '</span>' +
      '<span class="u">　·　到期时刻 ' + withTz(k.to) + '　·　状态不变，仍是 S-FD-4 待融资确认</span>'
    : '<span class="v">' + fmtDur(k.leftMin) + '</span>' +
      '<span class="u">后到期　·　到期时刻 ' + withTz(k.to) + '　·　到期不会自动确认</span>';
  return '<div class="ln-cd' + cls + '">' +
    '<div class="by"><b>融资确认时限</b>（FD-26）自放款记录<b>提交成功的服务端时间</b> ' + withTz(k.from) +
      ' 起算，共 <b>' + CONFIRM_HOURS + ' 小时</b>，精确到秒。<b>不是</b>从提交方填写的发放时间起算（D-FIN-21）。</div>' +
    '<div class="big">' + big + '</div>' +
    '<div class="bar" role="img" aria-label="融资确认时限 ' + CONFIRM_HOURS + ' 小时：已过 ' + fmtDur(k.heldMin) +
      (k.over ? '，已超期 ' + fmtDur(k.overMin) : '，剩余 ' + fmtDur(k.leftMin)) + '">' +
      '<div class="el" style="width:' + pctHeld + '%"></div>' +
      '<div class="rm" style="width:' + (100 - pctHeld).toFixed(2) + '%"></div></div>' +
    '<div class="scale"><span>提交 <b>' + withTz(k.from) + '</b></span>' +
      '<span>已过 <b>' + fmtDur(k.heldMin) + '</b>' + (k.over ? '' : ' ＋ 剩余 <b>' + fmtDur(k.leftMin) +
      '</b> ≡ <b>' + CONFIRM_HOURS + ' 小时</b>') + '</span></div>' +
    (k.soon ? '<p class="hint" style="color:var(--warn)">剩余不足 ' + NEAR_HOURS +
      ' 小时，倒计时已切到分钟精度，临近提醒已发出（只发一档）。' +
      '<b>到点不会自动确认、不会自动作废</b>，只是会多一个中性的超期标记。</p>' : '') +
    '<div class="ways">' +
      (k.over
        ? '<div class="w"><i>①</i><span><b>确认入口照常可用</b>：现在点「确认到账」，结算结果与第 1 天确认完全相同（AC-LN-12）。</span></div>' +
          '<div class="w"><i>②</i><span>钱没到或金额不符，请走右侧<b>客服邮箱</b>线下核实。<b>确认不可撤销，不要"先确认再说"</b>（E-LN-15）。</span></div>'
        : forAsset
          ? '<div class="w"><i>①</i><span>核对无误后点「确认到账」，还款义务随即成立、还款计划将生成。</span></div>' +
            '<div class="w"><i>②</i><span>到期<b>只会收到一条提醒</b>：状态不变、额度不动、入口还在。这笔业务<b>不会因为您没点而作废</b>。</span></div>'
          : '<div class="w"><i>①</i><span>等待资产方确认。<b>S-FD-4 段您没有任何写动作</b>：放款记录不可修改、不可撤回，也不能终止业务。</span></div>' +
            '<div class="w"><i>②</i><span>到期只发通知，业务不会自动推进。届时双方各收到一条超期通知，可走客服邮箱线下沟通。</span></div>') +
    '</div></div>';
}

/* ---- 两个 168 小时对照（D-LN-19 / AC-LN-16 / R-LS-35）----
   同一笔业务上先后出现两个 168 小时。混称会让资产方以为不确认也会像报价那样自动作废。 */
function twoClocks(deal){
  function card(on, nm, rows){
    return '<div class="c' + (on ? ' now' : '') + '"><div class="nm">' + nm + '</div><div class="rows2">' +
      rows.map(function(r){ return '<div><s>' + r[0] + '</s><span>' + r[1] + '</span></div>'; }).join('') +
    '</div></div>';
  }
  return '<div class="ln-two">' +
    card(false, '报价有效期（WS-325 · D-CR-26）', [
      ['约束谁', '资产方<b>处理报价</b>'],
      ['起算点', '报价提交成功的服务端时间 QT-09'],
      ['长度', '168 小时 · 自然日 · 精确到秒'],
      ['到期后果', '<b>自动失效</b>，报价终结、额度释放'],
      ['本笔取值', '已于 ' + withTz(deal.acceptedAt) + ' 因资产方接受而<b>终止计时</b>']]) +
    card(true, '融资确认时限（本模块 · D-LN-17）', [
      ['约束谁', '资产方<b>确认到账</b>'],
      ['起算点', '放款记录提交成功的服务端时间 LN-06'],
      ['长度', '168 小时 · 自然日 · 精确到秒（同口径）'],
      ['到期后果', '<b>只发通知</b>，状态不变、额度不动'],
      ['为什么不同', '报价是一份<b>要约</b>，无人响应即自动收敛；确认是对<b>钱是否到账</b>的事实陈述，平台无权代为陈述']]) +
  '</div>' +
  '<p class="hint" style="margin-top:10px">两个时限的<b>时间口径完全一致</b>，只有到期动作不同（D-LN-18）。' +
  '因此界面、字段与文案里<b>不出现无限定词的"7 天""有效期""倒计时"</b>，一律写全称。</p>';
}

/* ---- 客服邮箱卡（D-LN-34 / D-LN-35 / F-LS-49）----
   本期异议的唯一入口，因此它是一个功能点而不是一句提示：三处出现、可一键复制、附业务编号。 */
function mailCard(deal, where){
  return '<div class="ln-mail"><div class="mh">钱没到账，或金额与凭证对不上？</div>' +
    '<p>本期平台上<b>没有「提出异议」按钮</b>（X-LS-28）。您唯一的动作是<b>先不点确认</b>，' +
    '然后把情况发到客服邮箱走线下核实。请勿"先确认再说"——<b>确认不可撤销</b>，' +
    '一经确认债务即成立、还款计划随即生成。</p>' +
    '<div class="ad"><span class="em">' + E(SUPPORT_MAIL) + '</span>' +
      '<button class="btn sm" type="button" data-act="ln.copyMail">复制邮箱与业务编号</button></div>' +
    '<p>请在邮件中注明<b>融资业务编号 ' + E(deal.id) + '</b>' +
    (deal.ln ? '与<b>放款记录编号 ' + E(deal.ln.id) + '</b>' : '') + '。' +
    '<b>平台不承诺处理时效、不承诺处理结果</b>：它通向的是线下人工沟通，不是一个有 SLA 的工单系统（本期没有工单系统）。' +
    '线下达成一致后，仍由您自己回到本页点「确认到账」——<b>平台没有任何后台动作能替您推动这个状态</b>。</p>' +
    '<p class="hint" style="margin-top:9px">出现位置（' + E(where) + '）：本页、业务详情页的放款区块、超期通知，' +
    '共三处，各处均可一键复制（D-LN-34）。</p></div>';
}

/* ---- 交易哈希 + 链 + 区块浏览器（LN-08 / LN-09 / LN-13 / D-LN-11 / AC-LN-02）---- */
function hashBlock(ln, compact){
  var url = explorerUrl(ln.chain, ln.hash), ex = EXPLORER[ln.chain] || { name:'区块浏览器' };
  return '<div class="ln-hash"><div class="hv">' + E(compact ? shortHash(ln.hash) : ln.hash) + '</div>' +
    '<div class="meta"><span>链 · LN-09　<b>' + E(ln.chain) + '</b></span>' +
      '<span>格式校验　<b>0x + 64 位十六进制</b>　通过</span></div>' +
    '<div class="lk"><a class="btn sm" href="' + E(url) + '" target="_blank" rel="noopener noreferrer">' +
      '在 ' + E(ex.name) + ' 打开该交易</a>' +
      '<span class="nv">平台未核验该交易，链接仅供自行查验</span></div>' +
    '<p class="hint" style="margin-top:10px">本期<b>只做格式校验、不做链上核验</b>（D-FIN-22 / D-LN-10）：' +
    '平台不接索引服务，既不做阻断式核验（校验不过不让提交），也不做告警式核验（提交后异步核验、异常推运营）。' +
    '这意味着<b>机构可以填一个格式正确但不存在的哈希</b>——这个风险由您在本页的人工判断兜底，' +
    '这正是确认环节存在的意义。链接由链与哈希拼出，平台<b>不读链、不发请求、不判断这笔交易的有效性</b>。</p></div>';
}

/* ---- 发放时间 / 提交时间并列（LN-05 vs LN-06，D-FIN-21）---- */
function timesPair(ln){
  return '<div class="ln-pair">' +
    '<div class="t"><div class="k">发放时间 · LN-05</div><div class="v">' + withTz(ln.given) + '</div>' +
      '<div class="src">来源：<b>提交方填写</b>。可以是过去的时间，不得晚于提交时刻。' +
      '<b>仅作业务参考与对账依据</b>，任何时效与计息都不使用它。</div></div>' +
    '<div class="t auth"><div class="k">提交时间 · LN-06</div><div class="v">' + withTz(ln.at) + '</div>' +
      '<div class="src">来源：<b>服务端记录</b>。本模块的权威时间：融资确认时限的起算点，' +
      '也是 WS-327 可选的两个计息基准之一（另一个是 FD-24 确认完成时间）。</div></div>' +
  '</div>';
}

/* ---- 收款账户只读（LN-10，提交时刻从 FD-05 / FD-06 固化）---- */
function payeeRo(deal){
  var p = deal.payee;
  if(p.addr)
    return '<div class="ln-rec">' +
      '<div><div class="k">链</div><div class="v">' + E(p.chain) + '</div>' +
        '<div class="x">等于报价时 QT-08 的链，不可更换</div></div>' +
      '<div><div class="k">收款地址 · FD-06</div><div class="v mono">' + E(maskAddr(p.addr)) + '</div>' +
        '<div class="x">企业统一数币地址 · 展示按脱敏基线</div></div></div>';
  return '<div class="ln-rec">' +
    '<div><div class="k">收款人名称</div><div class="v">' + E(p.name) + '</div></div>' +
    '<div><div class="k">账号 · FD-05</div><div class="v mono">' + E(maskAcct(p.acct)) + '</div>' +
      '<div class="x">展示按 WS-308 脱敏基线</div></div>' +
    '<div><div class="k">开户行</div><div class="v">' + E(p.bank) + '</div></div>' +
    '<div><div class="k">SWIFT / BIC</div><div class="v mono">' + E(p.swift) + '</div></div>' +
    '<div><div class="k">国别 / 地区</div><div class="v">' + E(p.country) + '</div></div></div>';
}

/* ---- 本步骤不触达链上（承接 D-FIN-67）----
   五类链上失败在本模块**没有触发条件**：放款的转账发生在平台之外（机构自己的钱包或银行），
   平台只收下哈希与链的文本记录，不发起任何链上调用、不消耗 gas、不唤起签名。
   因此这里不造五个页面态；链上失败的完整五态在 WS-324 的质押与提取里。 */
function noChainFoot(what){
  return '<p class="hint" style="margin-top:14px">' + E(what) +
    '<b>不产生任何链上操作、不消耗 gas、不需要唤起签名 SDK</b>。' +
    '数币放款的转账发生在<b>平台之外</b>（机构自己的钱包或交易所），平台只收下哈希与链的文本记录；' +
    '因此本模块<b>没有链上失败的触发条件</b>，链上执行失败的五种页面态在 WS-324 的质押与提取环节，' +
    '本模块不重复、也不假造。</p>';
}


/* ================================================================
   Part D —— P-LS-07 放款录入（资金方，含核验区与三个处置动作）
   三区一脚：① 盖章件核验　② 三个处置动作　③ 放款表单　页脚：不触达链上
   进入条件（6.1）：该笔业务的报价机构 + 登录态 + 业务处于 S-FD-3。
   核验区与三个处置动作在 S-FD-3 下**恒可用**；只有「提交放款」另受担保闸门约束。
   ================================================================ */

/* 提交终检的结果模拟：走通分册 6.6 的各条异常分支。
   真实系统里这些结论一律由服务端在提交时刻实时重算给出（AC-FIN-12）。 */
var SUBMIT_OUTCOMES = [
  ['ok',      '提交成功（生成放款记录编号 · 业务转 S-FD-4 · 确认时限开始计时）'],
  ['guard',   'E-LN-01 提交瞬间担保跌破 INV-FIN-01，服务端终检拒绝'],
  ['race',    'E-LN-02 并发：同事刚刚提交过同一笔业务的放款'],
  ['moved',   'E-LN-03 提交时业务已不在 S-FD-3（同事刚终止了它）'],
  ['chain',   'E-LN-05 填写的链与报价时 QT-08 的链不一致'],
  ['upload',  'E-LN-06 转账凭证上传失败 / 超出格式或大小限制']
];

/* ---- 盖章件核验区左半：在线预览 + 下载 + 历史版本切换（D-LN-23 / FD-09 增量）---- */
function sealDoc(deal){
  var vs = deal.seals, i = Math.min(S.sealIdx || 0, vs.length - 1), f = vs[i];
  return '<div class="ln-doc"><div class="dh">盖章件 · FD-09' +
      '<span class="v">第 ' + (i + 1) + ' / ' + vs.length + ' 版</span></div>' +
    (vs.length > 1 ? '<div class="ln-vers" role="group" aria-label="盖章件历史版本">' +
      vs.map(function(v, n){
        return '<button type="button" data-act="ln.seal" data-v="' + n + '" aria-pressed="' + (n === i) + '">' +
          '第 ' + (n + 1) + ' 版 · ' + dayOnly(v.at) + (n === vs.length - 1 ? '（最新）' : '') + '</button>';
      }).join('') + '</div>' : '') +
    '<div class="pv"><div><div class="ic" aria-hidden="true">▤</div>' +
      '<b>' + E(f.n) + '</b>' +
      '<span>' + E(f.s) + ' · 上传于 ' + withTz(f.at) + '<br>上传人 ' + E(f.by) + '</span>' +
      '<span>原型内为占位：真实系统在此内嵌 PDF / 图片预览，浏览器不支持时降级为「下载后查看」并保留下载入口。</span>' +
    '</div></div>' +
    '<div class="df"><button class="btn sm" type="button" data-act="ln.download">下载该版本</button>' +
      '<span class="hint" style="margin:0">历史版本<b>保留不覆盖</b>，纠纷时这是唯一能还原"改了什么"的痕迹。</span></div>' +
  '</div>';
}

/* ---- 担保闸门与处置动作的关系（AC-LN-08）：闸门只挡放款、不挡处置 ---- */
function gateCards(deal){
  var g = guaranteeCheck(deal);
  function gate(cls, name, st, formula, who){
    return '<div class="cq-gate ' + cls + '"><div class="gh">' + E(name) +
      '<span class="st">' + E(st) + '</span></div>' +
      '<div class="fm">' + formula + '</div><div class="who">' + who + '</div></div>';
  }
  return '<div class="cq-gates">' +
    gate(g.pass ? 'pass' : 'fail', '担保闸门 · 项目维度', g.pass ? '通过' : '不通过',
      '判据 <b>INV-FIN-01：融资上限 ≥ 项目融资余额 ＋ 项目在途金额</b><br>' +
      amt(g.cap) + '　' + (g.pass ? '≥' : '&lt;') + '　' + amt(g.bal) + ' ＋ ' + amt(g.fly) + ' ＝ <b>' + amt(g.need) + '</b>' +
      (g.pass ? '' : '<br>缺口 <b>' + amt(g.gap) + '</b>　需追加资产价值 <b>' + amt(g.addAsset) + '</b>（÷ 质押率 ' +
        (PLEDGE_RATE * 100) + '%）'),
      g.pass ? '本判据由服务端在<b>提交时刻实时重算</b>、不吃缓存（AC-FIN-12 视角 B）。' +
               '从接受到放款之间可能隔着好几天，池内代币可能已经失效，<b>前端展示的数只是预览</b>。'
             : '这是<b>资产方</b>要解决的事：追加质押使判据重新成立后，<b>您的放款入口自动恢复</b>，不要求您重新进入页面。') +
    gate('pass', '三个处置动作 · 不受闸门约束', '照常可用',
      '暂不放款　·　要求重传盖章件　·　终止业务<br><b>担保闸门只挡放款，不挡处置</b>（AC-LN-08）',
      '把三个动作和放款一起置灰会制造<b>死局</b>：机构既放不了款也退不出来。' +
      '担保不足时您有两条出路：<b>「暂不放款」等资产方追加质押</b>，或<b>「终止业务」</b>。') +
  '</div>';
}

/* ---- 放款表单的校验（AC-LN-01）---- */
function formState(deal){
  var f = S.f, fiat = isFiat(deal);
  var given = (f.given || '').trim();
  var givenErr = '';
  if(!given) givenErr = 'empty';
  else if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(given)) givenErr = 'format';
  else if(tmin(given) > tmin(NOW)) givenErr = 'future';         /* E-LN-07：时间可以填过去，不能填未来 */
  var hash = (f.hash || '').trim(), hashErr = '';
  if(!fiat){
    if(!hash) hashErr = 'empty';
    else if(!hashFormatOk(hash)) hashErr = 'format';            /* E-LN-04：只提示格式，不提示"该交易不存在" */
  }
  var filesOk = fiat ? (f.files.length >= FIAT_MIN_N && f.files.length <= FIAT_MAX_N) : true;
  return { fiat:fiat, given:given, givenErr:givenErr, hash:hash, hashErr:hashErr, filesOk:filesOk,
           ok:!givenErr && !hashErr && filesOk };
}

function disburseForm(deal){
  var f = S.f, v = formState(deal), fiat = v.fiat;
  var settle = settleAmt(deal);
  var body =
    field('放款币种 · LN-03', '只读 · 恒等于 QT-02',
      ro(deal.ccy + (fiat ? '（法币）' : '（数币）'),
        '<b>不可临时更换</b>：换币种等于改商务条款，而商务条款在报价提交时已固化（D-CR-24）。')) +
    field('放款金额 · LN-04', '只读 · 本期必须等于报价金额',
      ro(amt(fiat ? deal.amt : settle) + ' ' + deal.ccy +
         (fiat ? '' : '　（＝ 融资金额 ' + amt(deal.amt) + ' ' + CCY + ' ÷ 汇率快照 ' + deal.fx.v.toFixed(4) + '）'),
        '本期<b>不支持部分放款与尾差</b>（X-LS-31 / Q-FIN-16 结论）。数币金额按报价时锁定的汇率快照 ' +
        deal.fx.ver + ' 折算，<b>放款与确认都不重新取汇率</b>（D-FIN-80）。')) +
    field('发放时间 · LN-05', '必填 · 可填过去，不得晚于提交时刻',
      inp('given', f.given, '2026-09-11 10:00',
          { err:v.givenErr === 'future' || v.givenErr === 'format', attr:'inputmode="numeric"' }),
      v.givenErr === 'future'
        ? '<b style="color:var(--danger)">发放时间晚于当前提交时刻（' + withTz(NOW) + '），提交会被拒绝（E-LN-07）。</b>' +
          '未来的发放时间意味着钱还没打，那就不该提交放款记录。'
        : v.givenErr === 'format'
        ? '<b style="color:var(--danger)">格式须为 YYYY-MM-DD HH:MM。</b>'
        : '格式 YYYY-MM-DD HH:MM（' + TZ_LABEL + '）。<b>仅作对账参考，时效与计息不使用该时间</b>——' +
          '融资确认时限与 WS-327 的计息基准一律取<b>提交成功的服务端时间</b>（D-FIN-21）。') +
    field('收款账户 · LN-10', '只读带出 · 提交时刻固化', payeeRo(deal),
      '来自资产方在接受环节<b>逐笔显式确认</b>过的账户（D-FIN-83）。<b>机构不得在本页修改或另填</b>——' +
      '可改就等于给了把钱打去别处再声称已放款的口子。');

  if(fiat){
    body += field('转账凭证 · LN-07', '必传 · ' + FIAT_MIN_N + '～' + FIAT_MAX_N + ' 个',
      '<div class="drop' + (S.f.upErr ? ' err' : '') + '" role="button" tabindex="0" data-act="ln.upload" data-v="proof">' +
        '<div class="ic" aria-hidden="true">↑</div><div><b>点击上传转账凭证</b>' +
        '<div class="hint" style="margin-top:3px">PDF / JPG / PNG · 单文件 ≤ ' + FILE_MAX_MB + ' MB · ' +
        FIAT_MIN_N + '～' + FIAT_MAX_N + ' 个（沿用 WS-305 第 6 节基线，不另定一套）</div></div></div>' +
      (S.f.upErr ? '<div class="ls-alert" style="margin-top:12px">' + CF.note('red', S.f.upErr, '上传未完成') + '</div>' : '') +
      (f.files.length ? '<div style="margin-top:12px">' + f.files.map(function(fl, i){
        return '<div class="filecard" style="margin-top:8px"><div class="ic" aria-hidden="true">▤</div>' +
          '<div class="bd"><b>' + E(fl.n) + '</b><span>' + E(fl.s) + ' · 上传于 ' + withTz(NOW) + '</span></div>' +
          '<div class="act"><button class="btn sm" type="button" data-act="ln.rmFile" data-v="' + i + '">移除</button></div></div>';
      }).join('') + '</div>' : ''),
      '<b>平台不审核凭证真伪</b>（与 D-FIN-90 对盖章件的处理同理）：本页只校验格式、大小与数量。' +
      '凭证<b>只对该笔业务双方可见</b>，不进广场公开字段（D-LN-06）。');
  } else {
    body += field('交易哈希 · LN-08', '必填 · 只做格式校验',
      inp('hash', f.hash, '0x 开头的 64 位十六进制', { err:!!v.hashErr }),
      v.hashErr === 'format'
        ? '<b style="color:var(--danger)">哈希格式不合法：须为 <span class="mono">0x</span> + 64 位十六进制（E-LN-04）。</b>' +
          '当前 ' + (v.hash.length) + ' 个字符。<b>提示只到"格式对不对"为止：平台无法判断这笔交易在链上存不存在，' +
          '因此不会给出任何与交易是否存在有关的结论</b>（E-LN-04）。'
        : '格式 <span class="mono">0x</span> + 64 位十六进制（沿用 WS-318 D-TI-06）。' +
          '<b>本期只做格式校验、不做链上核验</b>（D-FIN-22）：格式对就收下，' +
          '这笔交易到底存不存在由资产方在确认环节自行查验。') +
      field('链 · LN-09', '必填 · 只读带出，等于报价时 QT-08 的链',
        ro(deal.payee.chain,
          '<b>本模块新增的必填字段</b>（D-LN-28）：没有链就拼不出区块浏览器 URL，而自行查验是本期唯一的核验手段。' +
          '取值<b>必须等于报价时约定的链</b>，不一致拒绝提交，<b>不提供"仍要继续"</b>（E-LN-05）——' +
          'USDT / USDC 是多链资产，链不同就是两笔完全不同的转账。')) +
      field('补充材料 · LN-12', '选填 · ≤ ' + EXTRA_MAX_N + ' 个',
        '<div class="drop" role="button" tabindex="0" data-act="ln.upload" data-v="extra">' +
          '<div class="ic" aria-hidden="true">↑</div><div><b>点击上传补充材料（如钱包转账截图）</b>' +
          '<div class="hint" style="margin-top:3px">格式与大小同转账凭证 · 数币分支专用，法币分支不使用本字段</div></div></div>' +
        (f.extra.length ? '<div style="margin-top:12px">' + f.extra.map(function(fl, i){
          return '<div class="filecard" style="margin-top:8px"><div class="ic" aria-hidden="true">▤</div>' +
            '<div class="bd"><b>' + E(fl.n) + '</b><span>' + E(fl.s) + '</span></div>' +
            '<div class="act"><button class="btn sm" type="button" data-act="ln.rmExtra" data-v="' + i + '">移除</button></div></div>';
        }).join('') + '</div>' : ''));
  }

  body += field('放款备注 · LN-11', '选填 · ≤ ' + MEMO_MAX + ' 字',
    '<textarea class="inp" rows="3" maxlength="' + MEMO_MAX + '" data-act="ln.f" data-v="memo" ' +
    'placeholder="例如：已通过上海分行电汇，汇出行手续费与电报费由贵司承担，中转行扣费以入账为准。">' +
    E(f.memo || '') + '</textarea>',
    '<b>对资产方可见</b>——它常常是解释手续费、分行与到账时间的唯一位置。' +
    '已填 ' + (f.memo || '').trim().length + ' / ' + MEMO_MAX + ' 字。' +
    '提交后放款记录<b>不可修改、不可撤回</b>，备注要写就在这里写清（R-LS-30）。');
  return body;
}

function pageDisburse(){
  var deal = dealOf('P-LS-07');
  if(S.st === 'loading') return skel('放款与放款凭证上传');
  if(!deal) return failCard('放款与放款凭证上传', '内容不存在或无权访问',
      '该融资业务编号不存在。融资业务编号一经生成即<b>全局唯一、终身稳定</b>，进入终态后保留但作废、不回收、不复用。',
      '<a class="btn primary" href="' + lsHref('#/plaza') + '">返回融资需求广场</a>');
  if(S.st === 'error') return failCard('放款与放款凭证上传', '业务与核验材料加载失败',
      '服务端未返回本笔业务的盖章件、商务条款摘要与当前担保档位。' +
      '<b>放款前的担保判据必须由服务端在提交时刻实时重算</b>，页面不会用缓存值放行（AC-FIN-12）。可重试。');

  var acts = availableActions(deal, S.role);
  var isFund = (S.role === 'fund' && deal.fundEntity === ACTORS.fund.entity);
  var isAsset = (S.role === 'asset' && deal.entity === ACTORS.asset.entity);
  var head = dealHead(deal, 'P-LS-07', '放款与放款凭证上传');

  /* ---- 业务已离开 S-FD-3：落说明页 + Toast，不报 404、不白屏、不静默跳首页（E-LN-03 / AC-LS-104）---- */
  if(deal.st !== 'S-FD-3'){
    var why = deal.st === 'S-FD-10'
      ? '该业务已于 ' + withTz(deal.terminated ? deal.terminated.at : '') + ' 由资金方终止（S-FD-10 已终止，终态）。'
      : '该业务已提交放款记录（' + (deal.ln ? deal.ln.id + '，' + withTz(deal.ln.at) : '') +
        '），当前状态 ' + deal.st + ' ' + (FD_STATUS[deal.st] || {}).t + '。';
    return head + marksBlock(deal, !isFund) + '<div class="card">' +
      cardHead('放款入口已关闭', '<span class="faint">按提交时刻的权威状态结算</span>') +
      '<div class="card-b">' + CF.note('',
        why + '<p>一笔融资业务<b class="ls-b">至多一条有效放款记录</b>（D-LN-29），' +
        '并发提交只有一笔成功、后到者不产生第二条记录。放款记录提交后<b class="ls-b">不可修改、不可撤回</b>（X-LS-32）：' +
        '它是机构对"我已经付款"的事实陈述，资产方正是据此判断要不要确认，允许改就等于允许在对方核对的过程中换一份陈述。</p>',
        '该业务已不在 S-FD-3 待放款') +
      '<div class="btnbar" style="margin-top:16px">' +
        (deal.st === 'S-FD-4'
          ? '<button class="btn primary" type="button" data-act="ln.toConfirm" data-v="' + deal.id + '">查看融资确认页 P-LS-08</button>'
          : '') +
        '<a class="btn" href="' + projHref(deal) + '">回到融资需求详情</a></div>' +
      (deal.st === 'S-FD-10' && deal.terminated
        ? '<div style="margin-top:18px">' + xferCard(deal, 'stop') + '</div>' +
          '<p class="hint" style="margin-top:12px"><b>终止原因</b>（FD-22，必填，对资产方可见）：' + E(deal.terminated.why) + '<br>' +
          '动作人 ' + E(deal.terminated.by) + ' · ' + withTz(deal.terminated.at) +
          '　<b>S-FD-4 起不可终止</b>（D-LN-26）：钱已经打出去了，此时作废业务等于让资产方收了钱却不欠债。</p>'
        : '') +
      '</div></div>';
  }

  /* ---- 非资金方视角：公开字段照常可见，操作入口 ⊘；不公开字段由服务端过滤（AC-LN-17 / AC-LS-100）---- */
  if(!isFund){
    var reupload = actionOf(acts, 'reupload');
    return head + marksBlock(deal, true) +
      '<div class="card">' + cardHead('本笔业务的公开商务条款',
        '<span class="faint">L1 ～ L5 · 游客与非当事方同样可见</span>') +
      '<div class="card-b"><div class="ln-rec">' +
        '<div><div class="k">融资业务编号</div><div class="v mono">' + deal.id + '</div></div>' +
        '<div><div class="k">当前状态</div><div class="v">' + deal.st + ' 待放款</div>' +
          '<div class="x">已接受报价，等待资金方放款</div></div>' +
        '<div><div class="k">融资金额</div><div class="v mono">' + usd(deal.amt) + '</div></div>' +
        '<div><div class="k">结算币种与金额</div><div class="v mono">' + money(settleAmt(deal), deal.ccy) + '</div></div>' +
        '<div><div class="k">年化利率</div><div class="v mono">' + deal.rate.toFixed(2) + '%</div></div>' +
        '<div><div class="k">接受时间</div><div class="v mono">' + withTz(deal.acceptedAt) + '</div></div>' +
      '</div>' +
      CF.note('',
        '本页的<b class="ls-b">放款录入与三个处置动作只属于该笔业务的资金方</b>（' + E(deal.fund) + '）。' +
        '<p><b class="ls-b">服务端过滤而不是前端隐藏</b>（AC-LN-17）：收款账户、转账凭证文件、交易哈希与链、' +
        '盖章件及其历史版本、暂缓放款原因与要求重传原因，' + (isAsset ? '只对本笔业务双方返回' : '在本次接口响应里根本不存在') +
        '。它们要么是账户与凭证类敏感信息，要么是双方之间的商务沟通。</p>', '可见度隔离') +
      '<div class="btnbar" style="margin-top:16px">' + actBtn(actionOf(acts, 'disburse'), 'block') + '</div>' +
      (isAsset
        ? '<div style="margin-top:18px">' +
          (reupload
            ? CF.note('',
                '机构要求您重传盖章件。这是 <b class="ls-b">S-FD-3 段资产方唯一的写动作</b>' +
                '（锚点 <span class="mono">deal/' + deal.id + '?action=reupload_contract</span>）。' +
                '<p><b class="ls-b">重传成功即自动清除标记、自动回到可放款</b>，不需要机构再点一次"通过"——' +
                '平台不做审核态（D-LN-20 / D-LN-22）。历史盖章件<b class="ls-b">保留、不覆盖</b>。</p>', '待您重传盖章件') +
              '<div class="btnbar" style="margin-top:14px">' + actBtn(reupload, 'primary') + '</div>'
            : '<p class="hint">当前没有待您处理的动作。<b>本期没有催办能力</b>（X-LS-36）：' +
              '您不能催机构放款，平台也不代为催办——本期没有催办对象与催办通道，' +
              '主动触达只有放款提交、确认临近、确认超期、确认完成、要求重传、业务终止这六条固定事件。</p>') +
          '</div>'
        : '') +
      '</div></div>';
  }

  /* ---- 资金方视角：三区一脚 ---- */
  var g = guaranteeCheck(deal);
  var v = formState(deal);
  var dis = actionOf(acts, 'disburse');

  var verify = '<div class="card">' + cardHead('① 盖章件核验',
      '<span class="faint">F-LS-40 · 放款前 · 承接方是资金方，平台不设审核态</span>') +
    '<div class="card-b"><div class="ln-verify">' + sealDoc(deal) + termsSummary(deal) + '</div>' +
    CF.note('amber',
      '<b class="ls-b">平台不审核合同真伪与法律效力，请自行核验。</b>' +
      '合同由双方在平台外拟定与签署，平台手里<b class="ls-b">连正文都没有</b>；本页能做的只有一件事——' +
      '把判断所需的东西放在一起，让您<b class="ls-b">同屏比对</b>，不必下载后自行对照（AC-LN-03）。' +
      '<p>本区<b class="ls-b">没有「核验通过」按钮</b>（D-LN-20）：多一个"通过"会产生两个后果——' +
      '它像一个平台侧审核态（D-FIN-91 明确不设），而且会让"点了通过但没放款"变成第四种中间态。' +
      '<b class="ls-b">您的意思表示由您实际做的那个动作表达</b>：直接放款即视为您接受了这份合同。</p>',
      '平台的能力边界') +
    '<p class="hint" style="margin-top:12px">摘要九项与 <span class="mono">QT-*</span> / ' +
    '<span class="mono">FD-*</span> 的存值<b>逐项一致</b>（AC-LN-03），供您与盖章件正文逐条比对：' +
    '主体全称、金额、币种与结算金额、汇率快照及其生效时间与来源、年化利率、抵押物概况。</p>' +
    '</div></div>';

  var disp = '<div class="card" style="margin-top:16px">' + cardHead('② 三个处置动作',
      '<span class="faint">F-LS-41 ～ F-LS-43 · DEP-14 的落地 · 三个动作缺一不可</span>') +
    '<div class="card-b">' +
    (S.role === 'fund' ? '' : '') +
    '<div class="ln-disp">' +
      '<div class="d"><div class="dt">暂不放款</div>' +
        '<div class="dx">对合同有疑虑但还没决定时用它。业务<b>留在 S-FD-3</b>、不迁移、不打终态；' +
        '打「已暂缓放款」标记并记最新一条原因、动作人与时间，<b>原因对资产方可见</b>——' +
        '否则他只能干等，而本期他没有催办能力。</div>' +
        '<div class="back">能回到放款吗：<b>能，随时。</b>直接提交放款即自动清除该标记，不需要先点一次"恢复"。</div>' +
        actBtn(actionOf(acts, 'hold'), 'block') + '</div>' +
      '<div class="d"><div class="dt">要求重传盖章件</div>' +
        '<div class="dx">合同传错、盖错章时用它。业务<b>留在 S-FD-3</b>，打「待资产方重传盖章件」标记，' +
        '资产方获得重传入口。<b>历史盖章件保留、不覆盖</b>，核验区可切换查看每一版及其上传时间与动作人。</div>' +
        '<div class="back">能回到放款吗：<b>能。</b>重传成功即自动清除标记，<b>无需您再点一次"通过"</b>；' +
        '而且<b>重传期间您的放款入口照常可用</b>。</div>' +
        actBtn(actionOf(acts, 'redo'), 'block') + '</div>' +
      '<div class="d end"><div class="dt">终止业务</div>' +
        '<div class="dx">判定这份合同不可用且不打算继续时用它。必填原因 + 二次确认。' +
        '业务落 <b>S-FD-10 已终止</b>（终态）、<b>在途报价金额全额释放</b>、' +
        '<b>项目在途金额不变</b>（需求还挂着）、项目回 S-FP-2 募集中、质押不释放。</div>' +
        '<div class="back">能回到放款吗：<b>不能，终态不可逆。</b>但同一需求您可以立即重新报价——' +
        '那是一笔全新的融资业务（新编号、新汇率快照、新的报价有效期）。</div>' +
        actBtn(actionOf(acts, 'stop'), 'danger block') + '</div>' +
    '</div>' +
    '<p class="hint" style="margin-top:14px"><b>三个动作同时存在且各自可独立执行</b>（AC-LN-07）：' +
    '本页<b>不存在"要么放款要么放弃"的二选一版本</b>。WS-325 把合同核验的承接方定成了资金方、时点定在放款前，' +
    '平台不审核真伪、不设平台侧审核态——这意味着这三个动作<b>没有任何人会替它兜底，缺一个链路就断</b>（DEP-14）。</p>' +
    (deal.disp && deal.disp.length
      ? fold('核验处置记录 · FD-19（只增不改）', deal.disp.length + ' 条',
          '<ul class="tl">' + deal.disp.map(function(r){
            return '<li><div style="font-size:12.5px">' + pill('gray', DISPOSALS[r.k].t) +
              '<span class="mono" style="margin-left:8px">' + withTz(r.at) + '</span></div>' +
              '<div class="faint" style="font-size:11.5px;margin-top:4px;line-height:1.6">动作人 ' + E(r.by) +
              '<br>原因：' + E(r.why) + '</div></li>';
          }).join('') + '</ul>' +
          '<p class="hint">每次处置一条：动作、原因、动作人、企业主体、时间，<b>只增不改</b>——' +
          '它是纠纷时还原过程的唯一痕迹。除终止原因外<b>不公开</b>（D-LN-06 / FD-22）。</p>', true)
      : '') +
    '</div></div>';

  var form = '<div class="card" style="margin-top:16px">' + cardHead('③ 放款记录',
      '<span class="faint">F-LS-44 · LN-01 ～ LN-14 · ' + (v.fiat ? '法币分支' : '数币分支') + '</span>') +
    '<div class="card-b">' + gateCards(deal) + '</div>' +
    (g.pass ? '' : '<div class="card-b" style="border-top:1px solid var(--border)">' + CF.note('red',
      '当前项目担保不足，<b class="ls-b">提交放款不可用</b>：缺口 <span class="mono">' + usd(g.gap) +
      '</span>，需资产方追加资产价值 <span class="mono">' + usd(g.addAsset) + '</span>。' +
      '<p>表单其余部分<b class="ls-b">照常可见可填</b>，<b class="ls-b">三个处置动作照常可用</b>。' +
      '资产方补足担保使判据重新成立后，<b class="ls-b">放款入口自动恢复</b>，不要求您重新进入页面（AC-LN-08）。</p>',
      '担保闸门未通过') + '</div>') +
    '<div class="card-b" style="border-top:1px solid var(--border)">' + disburseForm(deal) +
      '<div class="btnbar" style="margin-top:18px">' + actBtn(dis, 'primary') + '</div>' +
      (dis.enabled && !v.ok
        ? '<p class="hint">补齐必填项后方可提交：' +
          (v.givenErr ? '发放时间' + (v.givenErr === 'future' ? '晚于提交时刻' : '未填写或格式不符') + '；' : '') +
          (v.hashErr ? '交易哈希' + (v.hashErr === 'format' ? '格式不合法' : '未填写') + '；' : '') +
          (!v.filesOk ? '法币分支须上传 ' + FIAT_MIN_N + '～' + FIAT_MAX_N + ' 个转账凭证；' : '') + '</p>'
        : '') +
      noChainFoot('本步骤') +
    '</div></div>';

  var rail = '<aside class="portal-rail">' +
    '<div class="card">' + cardHead('提交后额度怎么走', '<span class="faint">AC-FIN-25 · D-LN-07</span>') +
    '<div class="card-b">' + xferCard(deal, 'disburse') + '</div></div>' +
    '<div class="card ln-annot">' + cardHead('本期没有的东西（原型注解）', '<span class="faint">AC-LN-14 反向清单</span>') +
    '<div class="card-b"><p class="hint">本页<b>不存在</b>：「核验通过」按钮、平台侧的盖章件审核态、' +
      '放款记录的修改与撤回入口、部分放款与尾差、分次放款、币种或金额的可编辑控件、' +
      '收款账户的修改或另填入口、任何表示平台已核验转账或已审核合同的措辞、' +
      '「驳回放款」「平台介入中」等本期不存在的状态字样。<br>' +
      '这些不是"还没做"，是本期明确不做，逐条写在验收清单里。</p></div></div>' +
    '<div class="card"><div class="card-b"><p class="hint">深链锚点 <span class="mono">deal/' + deal.id +
      '?action=disburse</span> —— <b>三个处置动作不各占一个锚点</b>（D-LN-39）：它们是放款流程内的分支，' +
      '服务端在返回 <span class="mono">disburse</span> 时一并给出两个标记与担保闸门结论，页面据此渲染。<br>' +
      '也<b>不新增</b> <span class="mono">disbursement/{id}</span> 这一层锚点（D-LN-40）：' +
      '放款记录没有需要被深链直达的独立页面，它永远在融资业务详情里呈现。</p></div></div></aside>';

  return head + marksBlock(deal, false) +
    '<div class="portal-cols"><div>' + verify + disp + form + '</div>' + rail + '</div>';
}


/* ================================================================
   Part D2 —— P-LS-08 融资确认（资产方）
   顶部确认时限 → 放款记录全文 → 商务条款摘要 → 手续费差额 → 只有「确认到账」一个动作
   进入条件（6.1）：该项目的资产方 + 登录态 + 业务处于 S-FD-4。**超期后照常可用**（D-LN-33）。
   ================================================================ */

/* ---- 放款记录全文（AC-LN-01 / 6.4.2 确认前必须看到什么）---- */
function recordBlock(deal, full){
  var ln = deal.ln, fiat = isFiat(deal);
  var body = '<div class="ln-rec">' +
    '<div><div class="k">放款记录编号 · LN-01</div><div class="v mono">' + E(ln.id) + '</div>' +
      '<div class="x">提交成功的同一时刻生成，不预先占号；全局唯一、终身稳定</div></div>' +
    '<div><div class="k">放款币种 · LN-03</div><div class="v">' + E(deal.ccy) +
      (fiat ? '（法币）' : '（数币）') + '</div><div class="x">恒等于报价时的 QT-02，公开字段</div></div>' +
    '<div><div class="k">放款金额 · LN-04</div><div class="v mono">' + money(fiat ? deal.amt : settleAmt(deal), deal.ccy) +
      '</div><div class="x">' + (fiat ? '恒等于融资金额' : '按汇率快照 ' + deal.fx.v.toFixed(4) + ' 折算，不重新取汇率') +
      '，公开字段</div></div>' +
    '<div><div class="k">所属融资业务 · LN-02</div><div class="v mono">' + E(deal.id) + '</div>' +
      '<div class="x">一笔业务至多一条有效放款记录</div></div>' +
  '</div>' +
  '<div style="margin-top:16px">' + timesPair(ln) + '</div>';

  if(!full){
    return body + '<p class="hint" style="margin-top:14px"><b>收款账户、凭证文件、交易哈希与链' +
      '由服务端按归属过滤</b>，不属于广场公开字段（D-LN-06 / AC-LN-17）。</p>';
  }
  body += '<div style="margin-top:18px"><div class="card-head" style="padding-left:0;padding-right:0">' +
    '<b>收款账户 · LN-10</b><span style="margin-left:auto" class="faint">提交时刻固化的快照</span></div>' +
    payeeRo(deal) + '</div>';
  if(fiat){
    body += '<div style="margin-top:18px"><div class="card-head" style="padding-left:0;padding-right:0">' +
      '<b>转账凭证 · LN-07</b><span style="margin-left:auto" class="faint">在线预览 + 下载 · 仅双方可见</span></div>' +
      (ln.files || []).map(function(f){
        return '<div class="filecard" style="margin-top:8px"><div class="ic" aria-hidden="true">▤</div>' +
          '<div class="bd"><b>' + E(f.n) + '</b><span>' + E(f.s) + ' · 随放款记录于 ' + withTz(ln.at) + ' 提交</span></div>' +
          '<div class="act"><button class="btn sm" type="button" data-act="ln.download">预览 / 下载</button></div></div>';
      }).join('') +
      '<p class="hint" style="margin-top:10px">原型内为占位：真实系统在此内嵌 PDF / 图片预览，' +
      '浏览器不支持时降级为「下载后查看」并保留下载入口。文件下载须鉴权，<b>不使用可猜测的公开直链</b>。' +
      '<b>平台不审核凭证真伪</b>——请对照您的银行流水自行核对。</p></div>';
  } else {
    body += '<div style="margin-top:18px"><div class="card-head" style="padding-left:0;padding-right:0">' +
      '<b>交易哈希与链 · LN-08 / LN-09</b><span style="margin-left:auto" class="faint">LN-13 区块浏览器链接</span></div>' +
      hashBlock(ln) +
      ((ln.extra && ln.extra.length) ? '<div style="margin-top:12px">' + ln.extra.map(function(f){
        return '<div class="filecard"><div class="ic" aria-hidden="true">▤</div>' +
          '<div class="bd"><b>' + E(f.n) + '</b><span>' + E(f.s) + ' · 补充材料 LN-12（选填）</span></div>' +
          '<div class="act"><button class="btn sm" type="button" data-act="ln.download">预览 / 下载</button></div></div>';
      }).join('') + '</div>' : '') + '</div>';
  }
  if(ln.memo)
    body += '<div style="margin-top:18px">' + CF.note('',
      E(ln.memo) + '<p>放款备注 <span class="mono">LN-11</span> 由资金方在提交时填写，对您可见。' +
      '本期<b class="ls-b">没有"补充说明"入口</b>：放款记录提交后不可修改、不可撤回，' +
      '机构在您确认前没有任何补救动作（R-LS-30）。</p>', '资金方备注') + '</div>';
  return body;
}

/* ---- 手续费差额（D-FIN-103 承接 / R-LS-29 / E-LN-15）----
   WS-325 在接受之前已经用同一个三格形状告知过一次，本页接住它：
   **到账金额对不上融资金额是预期内的**，不是放款不足，更不是不能确认的理由。 */
function feeBlock(deal){
  return '<div class="cq-fee">' +
    '<div class="c"><div class="k">融资金额 · 机构按此放款</div><div class="v">' + amt(deal.amt) + ' ' + CCY + '</div>' +
      '<div class="x">放款记录上的金额只读、恒等于报价金额</div></div>' +
    '<div class="op" aria-hidden="true">−</div>' +
    '<div class="c"><div class="k">跨境手续费 · 由您承担</div><div class="v unknown">平台不预估金额</div>' +
      '<div class="x">汇出行手续费、中转行扣费、收款行入账费；中转行扣费通常逐笔发生且事前不告知</div></div>' +
    '<div class="op" aria-hidden="true">→</div>' +
    '<div class="c"><div class="k">您银行账上的实收</div><div class="v unknown">少于 ' + amt(deal.amt) + '</div>' +
      '<div class="x">平台不预知、不代收、不垫付，也不展示预估金额</div></div>' +
  '</div>' +
  '<p class="hint" style="margin-top:10px"><b style="color:var(--warn)">实收少于融资金额是预期内的，' +
  '不是放款不足，也不影响您确认。</b>本页<b>不要求您填写实收金额</b>、<b>没有"实收 ≠ 应收"的校验</b>、' +
  '<b>不会因为差额而拦住确认</b>——跨境电汇的中间行手续费真实存在，由您承担，这在接受报价时已经告知过一次' +
  '（WS-325 的同一张三格对照）。<br>' +
  '<b>但您要偿还的本金仍按融资金额 ' + usd(deal.amt) + ' 计。</b>债务本金、授信占用额、项目融资余额、' +
  '本次转移金额与还款计划的本息，一律按融资金额计，<b>不按实收计</b>：' +
  '手续费是您为了把钱拿到手而付出的成本，不是本金的减少。<br>' +
  '若差额大到您认为不像手续费（例如少了几万而不是几百），<b>先别确认</b>，走右侧客服邮箱线下核实（E-LN-15）。</p>';
}

function pageConfirm(){
  var deal = dealOf('P-LS-08');
  if(S.st === 'loading') return skel('确认到账');
  if(!deal) return failCard('确认到账', '内容不存在或无权访问',
      '该融资业务编号不存在。编号一经生成即全局唯一、终身稳定，进入终态后保留但作废、不回收、不复用。',
      '<a class="btn primary" href="' + lsHref('#/plaza') + '">返回融资需求广场</a>');
  if(S.st === 'error') return failCard('确认到账', '放款记录与确认时限加载失败',
      '服务端未返回本笔放款记录与融资确认时限的到期时刻。' +
      '<b>倒计时必须由服务端给出到期时刻、前端只负责渲染</b>（AC-LS-101）——' +
      '前端按本地时间推算会在跨时区与时钟偏差下与服务端判定不一致。可重试。');

  var isAsset = (S.role === 'asset' && deal.entity === ACTORS.asset.entity);
  var isFund  = (S.role === 'fund'  && deal.fundEntity === ACTORS.fund.entity);
  var acts = availableActions(deal, S.role);
  var head = dealHead(deal, 'P-LS-08', '确认到账');
  var k = confirmClock(deal);

  /* ---- 已确认：S-FD-6 还款中。展示转移结果与对 WS-327 的交接 ---- */
  if(deal.st === 'S-FD-6'){
    return head + '<div class="card">' + cardHead('融资确认已完成',
        '<span class="faint">FD-24 · 四个量已在同一次结算内转移</span>') +
      '<div class="card-b">' + CF.note('green',
        '资产方于 <b class="ls-b">' + withTz(deal.fd24) + '</b> 确认到账，业务转 <b class="ls-b">S-FD-6 还款中</b>。' +
        '<p>同一次结算内五件事一致生效（AC-LN-10）：业务状态、项目维度两个量、机构维度两个量、' +
        '还款计划的生成触发、FD-24 落库。<b class="ls-b">整体成功或整体不发生</b>，' +
        '不存在"已确认但额度未转"或"额度已转但还款计划没生成"的中间态。</p>' +
        '<p>项目<b class="ls-b">保持 S-FP-4 融资中</b>。确认<b class="ls-b">不可撤销</b>——' +
        '它是对"钱已到账"的事实陈述，撤销等于允许对已成立的债务反悔。</p>', '本流程到此结束') +
      '<div style="margin-top:18px">' + xferCard(deal, 'done') + '</div>' +
      '<div style="margin-top:18px">' + CF.note('',
        '还款计划的<b class="ls-b">生成触发点 = 融资确认完成的同一次结算</b>（D-LN-16），' +
        '本金口径取 <span class="mono">QT-03</span> 融资金额 ' + usd(deal.amt) + '（USD）。' +
        '<p>期数、计息口径、还款方式与逾期规则<b class="ls-b">由 WS-327 定义，本模块不自定</b>；' +
        '利息起算日可用的权威时间只有两个、都是服务端时间：' +
        '<span class="mono">LN-06</span> 放款提交时间 ' + withTz(deal.ln.at) + ' 与 ' +
        '<span class="mono">FD-24</span> 确认完成时间 ' + withTz(deal.fd24) + '——' +
        '<b class="ls-b">提交方填写的发放时间不得作为计息基准</b>（D-LN-17 / D-FIN-21）。</p>' +
        '<p>若 WS-327 尚未就绪导致还款计划生成失败，<b class="ls-b">额度转移与状态迁移不回滚</b>' +
        '（钱已到账、债务已成立是事实），详情页在计划就绪前展示"还款计划生成中"、<b class="ls-b">不展示错误</b>（E-LN-13）。</p>',
        '交接 WS-327 · 还款计划') + '</div>' +
      '<div class="btnbar" style="margin-top:18px">' +
        '<a class="btn" href="' + projHref(deal) + '">回到融资需求详情</a></div>' +
      '</div></div>';
  }

  if(deal.st !== 'S-FD-4')
    return head + '<div class="card">' + cardHead('确认入口未开放', '<span class="faint">按权威状态呈现</span>') +
      '<div class="card-b">' + CF.note('',
        '该业务当前状态为 <b class="ls-b">' + deal.st + ' ' + (FD_STATUS[deal.st] || {}).t +
        '</b>，融资确认只在 <b class="ls-b">S-FD-4 待融资确认</b> 下可用。' +
        (deal.st === 'S-FD-3' ? '<p>资金方尚未提交放款记录。提交成功后您会收到通知，' +
          '融资确认时限自<b class="ls-b">提交成功的服务端时间</b>起算 ' + CONFIRM_HOURS + ' 小时。</p>' : ''),
        '本页暂无可处理的内容') +
      '<div class="btnbar" style="margin-top:16px"><a class="btn" href="' + projHref(deal) +
      '">回到融资需求详情</a></div></div></div>';

  /* ---- 非资产方视角 ---- */
  if(!isAsset){
    return head + marksBlock(deal, false) +
      '<div class="card">' + cardHead('放款已提交，等待资产方确认',
        '<span class="faint">L1 ～ L5 公开字段 · 收款账户与凭证不公开</span>') +
      '<div class="card-b">' + recordBlock(deal, false) +
      '<div style="margin-top:18px">' + confirmCountdown(deal, false) + '</div>' +
      '<div class="btnbar" style="margin-top:16px">' + actBtn(actionOf(acts, 'confirm'), 'block') + '</div>' +
      (isFund
        ? '<div style="margin-top:16px">' + CF.note('',
            'S-FD-4 段<b class="ls-b">您没有任何写动作</b>：放款记录不可修改、不可撤回（X-LS-32），' +
            '业务也<b class="ls-b">不可终止</b>（D-LN-26：钱已经打出去了）。' +
            '<p>资产方始终不确认时，<b class="ls-b">平台没有任何后台能推动这个状态</b>：业务永久停在 S-FD-4、' +
            '还款计划不生成、您拿不到任何应收安排，<b class="ls-b">在途报价金额与项目在途金额双双被占住</b>、' +
            '质押不释放、项目即使到期也不关闭（D-LN-37）。到期时双方各收到一条超期通知，' +
            '之后<b class="ls-b">不再周期推送</b>——重复推送不携带新信息（D-LN-36）。</p>' +
            '<p>这条路只能靠<b class="ls-b">线下沟通</b>走通：客服邮箱 ' + E(SUPPORT_MAIL) +
            '，请注明融资业务编号 ' + E(deal.id) + '。' +
            '<b class="ls-b">本期没有"平台强制终止"这个能力，也不提供</b>（E-LN-14）——' +
            '平台不会单方面作废一笔已放款的业务。</p>', '您现在能做什么') + '</div>'
        : '') +
      '</div></div>';
  }

  /* ---- 资产方视角：可确认 ---- */
  var body = '<div class="card">' + cardHead('① 融资确认时限',
      '<span class="faint">F-LS-48 · FD-26 / FD-27 · 到期只提醒，不改状态</span>') +
    '<div class="card-b">' + confirmCountdown(deal, true) +
    '<div style="margin-top:16px">' + twoClocks(deal) + '</div></div></div>' +

    '<div class="card" style="margin-top:16px">' + cardHead('② 放款记录全文',
      '<span class="faint">LN-01 ～ LN-14 · 确认前必须看到的全部内容</span>') +
    '<div class="card-b">' + recordBlock(deal, true) + '</div></div>' +

    '<div class="card" style="margin-top:16px">' + cardHead('③ 商务条款摘要',
      '<span class="faint">D-FIN-87 九项 · 只读 · 供核对金额与账户是否与合同一致</span>') +
    '<div class="card-b">' + termsSummary(deal) +
    '<p class="hint" style="margin-top:12px">请对照您手上的<b>线下合同</b>与<b>银行流水 / 链上记录</b>逐项核对：' +
    '金额、币种、收款账户是不是这一笔。合同是双方在平台外签的，<b>平台看不到正文</b>，' +
    '这份摘要是平台侧唯一能与合同对齐的东西。</p></div></div>' +

    '<div class="card" style="margin-top:16px">' + cardHead('④ 到账金额与融资金额对不上？',
      '<span class="faint">D-FIN-103 承接 · 预期内，不影响确认</span>') +
    '<div class="card-b">' + feeBlock(deal) + '</div></div>' +

    '<div class="card" style="margin-top:16px">' + cardHead('⑤ 确认到账',
      '<span class="faint">F-LS-47 · 只有一个动作 · 确认后不可撤销</span>') +
    '<div class="card-b">' +
      CF.note('',
        '<b class="ls-b">确认即表示您已核实该笔款项确已到账。</b>平台不核验转账真伪：' +
        (isFiat(deal) ? '平台看不到您的银行流水' : '平台<b class="ls-b">不做链上核验</b>，交易哈希只做过格式校验') +
        '，这一步的判断只能由您来做——<b class="ls-b">这正是确认环节存在的意义</b>。' +
        '<p>确认完成的同一时刻：业务转 <b class="ls-b">S-FD-6 还款中</b>、四个量在两个维度各做一次原子转移、' +
        '还款计划由 WS-327 生成、FD-24 落库。<b class="ls-b">确认后不可撤销</b>。</p>', '确认之前请先读这一段') +
      '<div class="btnbar" style="margin-top:18px">' + actBtn(actionOf(acts, 'confirm'), 'primary') + '</div>' +
      '<p class="hint" style="margin-top:12px">本页<b>只有「确认到账」一个动作</b>（X-LS-28）：' +
      '没有「提出异议」、没有「申诉」、没有「驳回放款」。这是本期明确的能力边界，' +
      '不是入口藏起来了——异议走线下客服邮箱（见右栏）。</p>' +
      noChainFoot('确认到账') +
    '</div></div>';

  var rail = '<aside class="portal-rail">' +
    '<div class="card"><div class="card-b">' + mailCard(deal, '本页 · 三处之一') + '</div></div>' +
    '<div class="card">' + cardHead('确认完成的那一刻', '<span class="faint">AC-FIN-25 / AC-FIN-30</span>') +
    '<div class="card-b">' + xferCard(deal, 'confirm') + '</div></div>' +
    '<div class="card ln-annot">' + cardHead('本期没有的东西（原型注解）', '<span class="faint">AC-LN-14 / AC-LN-11 反向清单</span>') +
    '<div class="card-b"><p class="hint">本页<b>不存在</b>：「提出异议」「申诉」「驳回放款」「撤销确认」' +
      '「延长确认时限」「部分确认」等入口；「平台介入中」「逾期视为确认」「平台将在 X 个工作日内处理」等字样；' +
      '任何表示平台已核验转账、已审核合同或交易哈希"已上链确认"的标识；' +
      '倒计时归零后状态自动变化的表现；实收金额输入框与"实收 ≠ 应收"的校验。<br>' +
      '<b>S-FD-5 放款异议处理中本期不产生</b>（D-LN-02）：产生它的唯一入口是「提出异议」，而本期没有这个入口。' +
      '状态机条文保留、枚举保留，但界面不为它准备文案与筛选项，避免出现一个永远为空的 tab。</p></div></div>' +
    '<div class="card"><div class="card-b"><p class="hint">深链锚点 <span class="mono">deal/' + deal.id +
      '?action=confirm_disbursement</span> · 由服务端在 <span class="mono">available_actions</span> 中返回，' +
      '前端<b>不自行依据状态推断</b>是否显示确认入口（AC-LS-103）。<br>' +
      '超期后该动作<b>照常返回</b>（D-LN-33）——超期不改变任何权限。</p></div></div></aside>';

  return head + marksBlock(deal, true) +
    '<div class="portal-cols"><div>' + body + '</div>' + rail + '</div>';
}


/* ================================================================
   Part E —— 模块装配
   ================================================================ */

/* ---- 演示业务的取用：页面态决定落在哪一笔，深链 did 优先 ---- */
function dealOf(page){
  var map = ST_DEAL[page] || {};
  var id = (S.didPage === page && S.did) ? S.did : (map[S.st] || map['default']);
  return findDeal(id);
}

/* ---- 提交 / 确认 / 处置的结果卡：紧跟页头之后。
   每一类结局各有独立呈现与独立出路，不存在只写"操作失败"的兜底文案。 ---- */
function resultCard(){
  var r = S.result;
  if(!r) return '';
  var box;
  switch(r.k){
    case 'submitted':
      box = CF.note('green',
        '放款记录编号 <b class="ls-b">' + r.id + '</b> 已生成，业务转 <b class="ls-b">S-FD-4 待融资确认</b>，' +
        '<b class="ls-b">融资确认时限已开始计时</b>：起点 ' + withTz(r.at) + '（提交成功的服务端时间），' +
        '到期时刻 <b class="ls-b">' + withTz(r.to) + '</b>。' +
        '<p>同一次结算内：生成编号 → 业务转 S-FD-4 → 计时开始 → 清除「已暂缓放款」「待重传」标记 → 通知资产方。' +
        '<b class="ls-b">四个量一个都不动</b>（D-LN-07）。放款记录<b class="ls-b">不可修改、不可撤回</b>。</p>' +
        '<p>到期<b class="ls-b">不会自动视为确认</b>：届时只发一条通知、状态不变。' +
        '资产方始终不确认时，这笔业务会停在 S-FD-4，还款计划不生成——出路是客服邮箱线下沟通后由他自己来点确认。</p>',
        '放款记录已提交');
      break;
    case 'guard':
      box = CF.note('red',
        '<b class="ls-b">提交被服务端终检拒绝：担保闸门 INV-FIN-01 在提交时刻不成立。</b>' +
        r.detail + '，缺口 <span class="mono">' + usd(r.gap) + '</span>，需资产方追加资产价值 <span class="mono">' +
        usd(r.add) + '</span>。' +
        '<p><b class="ls-b">不产生放款记录、不改变状态、不动任何额度</b>。担保判据由服务端在提交时刻实时重算、' +
        '不吃缓存——从您打开页面到点击提交之间，池内代币可能已经失效（E-LN-01）。</p>' +
        '<p>您有两条出路：<b class="ls-b">「暂不放款」</b>等资产方追加质押（补足后放款入口自动恢复），' +
        '或<b class="ls-b">「终止业务」</b>。两者此刻都可用。</p>', '担保不足，本次未提交');
      break;
    case 'race':
      box = CF.note('amber',
        '该业务<b class="ls-b">已提交过放款记录</b>（' + r.id + '，' + withTz(r.at) + '），本次提交未落库。' +
        '<p>并发提交<b class="ls-b">串行结算、先落库者成功</b>，后到者不产生第二条记录（E-LN-02 / D-LN-29）。' +
        '编号只在提交成功的同一时刻生成，本次<b class="ls-b">不占号</b>。</p>', '同一笔业务已有放款记录');
      break;
    case 'moved':
      box = CF.note('amber',
        '提交时该业务<b class="ls-b">已不在 S-FD-3 待放款</b>：' + E(r.detail) +
        '。按<b class="ls-b">提交时刻的权威状态</b>结算并拒绝本次提交。' +
        '<p>页面已落到业务详情，<b class="ls-b">不报 404、不白屏、不静默跳首页</b>（E-LN-03 / AC-LS-104）。</p>',
        '业务状态已变更');
      break;
    case 'chain':
      box = CF.note('red',
        '<b class="ls-b">链须与报价时约定的一致。</b>本笔业务在报价时约定的链是 <b class="ls-b">' + E(r.chain) +
        '</b>（QT-08），提交的链与之不一致，服务端拒绝提交，<b class="ls-b">不提供"仍要继续"</b>（E-LN-05）。' +
        '<p>钱打到另一条链不是这笔业务约定的交付方式：USDT / USDC 是多链资产，链不同就是两笔完全不同的转账。</p>',
        '链不一致，本次未提交');
      break;
    case 'upload':
      box = CF.note('red', r.detail + '<p><b class="ls-b">已上传的其他文件保留</b>，无需重传（E-LN-06）。</p>',
        '凭证未通过');
      break;
    case 'hold':
      box = CF.note('',
        '已登记<b class="ls-b">暂不放款</b>。业务<b class="ls-b">仍是 S-FD-3 待放款</b>——不迁移、不打终态；' +
        '<b class="ls-b">四个量一个不变</b>（AC-LN-04）。原因已对资产方可见，页面上常驻。' +
        '<p><b class="ls-b">随时可以回到放款</b>：直接提交放款即自动清除该标记，不需要先点一次"恢复"。' +
        '可重复登记，以最新一条为准，历史进 FD-19 留痕。</p>' +
        '<p>本期<b class="ls-b">不为「暂不放款」推送通知</b>（D-LN-43）：它是过程性商务决定，随时可能在几分钟后变成放款，' +
        '推一条"对方暂缓了"只会让资产方产生一个他无法处置的焦虑——他既不能催，也没有可做的动作。' +
        '原因在他的页面上常驻可见。</p>', '已暂缓放款');
      break;
    case 'redo':
      box = CF.note('',
        '已要求<b class="ls-b">重传盖章件</b>。业务<b class="ls-b">仍是 S-FD-3</b>，已打「待资产方重传盖章件」标记，' +
        '资产方获得重传入口，并收到一条通知（<span class="mono">financing.contract.reupload_required</span>，' +
        '每一次要求重传是一条独立通知，带 seq）。' +
        '<p><b class="ls-b">重传成功即自动清除标记、自动回到可放款</b>，不需要您再点一次"通过"（D-LN-22）。' +
        '<b class="ls-b">重传期间您的放款入口照常可用</b>——挡住会制造"自己要求重传后反而放不了款"的死结。</p>' +
        '<p>历史盖章件<b class="ls-b">保留、不覆盖</b>；重传次数不设上限、不设冷却，反复重传的观测口是 M-LS-36。</p>',
        '已要求重传盖章件');
      break;
    case 'stopped':
      box = CF.note('amber',
        '业务已终止，落 <b class="ls-b">S-FD-10 已终止</b>（终态，编号保留但作废、不回收不复用）。' +
        '<p>同一次结算内五个后果一致生效：<b class="ls-b">在途报价金额 ' + usd(r.amt) + ' 全额释放且不进授信占用额</b>、' +
        '<b class="ls-b">项目在途金额不变</b>（需求还挂着）、项目回 <b class="ls-b">S-FP-2 募集中</b>、质押不释放。</p>' +
        '<p>该需求<b class="ls-b">重新可被任何机构报价</b>，包括本机构自己重新报价——那是一笔全新的融资业务：' +
        '新编号、新汇率快照、新的报价有效期，不是原业务的续期。终止原因已通知资产方。</p>', '业务已终止');
      break;
    case 'reuploaded':
      box = CF.note('green',
        '盖章件已重传，当前为<b class="ls-b">第 ' + r.n + ' 版</b>。' +
        '「待资产方重传盖章件」标记<b class="ls-b">已自动清除</b>，机构侧核验区立即出现新版本、放款入口可用——' +
        '<b class="ls-b">无需机构再点一次"通过"</b>（AC-LN-05）。' +
        '<p><b class="ls-b">历史版本一份不少</b>：每一版都带上传时间与上传人，核验区可逐版切换查看。</p>',
        '重传成功');
      break;
    case 'confirmed':
      box = CF.note('green',
        '已确认到账。业务转 <b class="ls-b">S-FD-6 还款中</b>，确认时间 <b class="ls-b">' + withTz(r.at) + '</b>（FD-24）。' +
        '<p>同一次结算内：项目在途金额 −<span class="mono">' + amt(r.amt) + '</span> / 项目融资余额 +<span class="mono">' +
        amt(r.amt) + '</span>（AC-FIN-25）；在途报价金额 −<span class="mono">' + amt(r.amt) +
        '</span> / 授信占用额 +<span class="mono">' + amt(r.amt) + '</span>（AC-FIN-30）。' +
        '四个量<b class="ls-b">同时生效、原子、无空档</b>。</p>' +
        '<p>还款计划已触发生成（WS-327），项目保持 S-FP-4 融资中。' +
        '确认<b class="ls-b">不可撤销</b>：它是对事实的陈述，不是一个可以反悔的选项。</p>', '融资确认完成');
      break;
    case 'settle':
      box = CF.note('amber',
        '<b class="ls-b">结算未完成，业务保持 S-FD-4 待融资确认。</b>' +
        '该结算必须<b class="ls-b">整体成功或整体不发生</b>：状态、项目维度两个量、机构维度两个量、' +
        '还款计划触发、FD-24 落库，五件事缺一不可（E-LN-11 / AC-LN-10）。' +
        '<p>本次已整体回滚，<b class="ls-b">没有出现"已确认但额度未转"的中间态</b>；重试期间对外仍按未确认呈现。' +
        '请稍后重试确认。</p>', '结算整体回滚，可重试');
      break;
    case 'plan':
      box = CF.note('green',
        '确认已完成、四个量已转移（FD-24 ' + withTz(r.at) + '），但 <b class="ls-b">WS-327 尚未就绪，还款计划生成失败</b>。' +
        '<p><b class="ls-b">额度转移与状态迁移不会因此回滚</b>——钱已到账、债务已成立是事实（E-LN-13）。' +
        '还款计划改为可重试的后续动作，业务详情页在计划就绪前展示「还款计划生成中」，<b class="ls-b">不展示错误</b>。' +
        '该缺口登记为 DEP-30。</p>', '已确认，还款计划生成中');
      break;
    default:
      box = CF.note('', '—');
  }
  return '<div class="ls-alert">' + box + '</div>';
}

/* ---- 处置动作弹窗的共用外壳：必填原因 1～200 字，自由文本不分类 ---- */
function reasonModal(kind, deal){
  var meta = DISPOSALS[kind], v = S.reason || '';
  var len = v.trim().length, ok = len >= 1 && len <= REASON_MAX;
  var isStop = (kind === 'stop');
  var ack = !!S.ack;
  var intro, after;
  if(kind === 'hold'){
    intro = '登记「暂不放款」不改变业务状态：它仍是 <b>S-FD-3 待放款</b>，四个量一个不变。';
    after = CF.note('',
      '提交后：打「已暂缓放款」标记，记最新一条原因、动作人与时间；<b class="ls-b">原因对资产方可见</b>。' +
      '<p>您<b class="ls-b">随时可以直接放款</b>，提交放款时该标记自动清除。本期不为这个动作推送通知——' +
      '它是过程性商务决定，原因在资产方的页面上常驻可见。</p>');
  } else if(kind === 'redo'){
    intro = '要求资产方重传盖章件，业务<b>留在 S-FD-3</b>。';
    after = CF.note('',
      '提交后：打「待资产方重传盖章件」标记（FD-20），资产方获得重传入口并收到一条通知。' +
      '<p><b class="ls-b">重传成功即自动清除标记</b>，您<b class="ls-b">无需再点一次"通过"</b>；' +
      '历史盖章件保留、不覆盖；<b class="ls-b">重传期间您的放款入口照常可用</b>。</p>');
  } else {
    intro = '终止这笔融资业务。<b>这是终态，不可逆、不可恢复。</b>';
    after = '<div class="rows" style="box-shadow:none;margin-top:14px">' +
      [['① 终止不可逆、不可恢复',
        '业务落 <b>S-FD-10 已终止</b>，编号保留但作废、不回收不复用。' +
        '<b>S-FD-4 起不可终止</b>——钱打出去之后平台无权也无力作废一笔业务（D-LN-26）。'],
       ['② 本机构对该资产方的 ' + usd(deal.amt) + ' 在途报价占用将被释放',
        '在途报价金额 ' + amt(deal.cr.fly) + ' → ' + amt(round2(deal.cr.fly - deal.amt)) +
        '，且<b>不进授信占用额</b>（只出不进）。可用授信恢复原值。'],
       ['③ 该需求将重新回到广场，可被其他机构报价',
        '项目在途金额<b>不变</b>（需求还挂着），项目回 S-FP-2 募集中，质押不释放。' +
        '<b>包括本机构自己重新报价</b>——那是一笔全新的业务：新编号、新汇率快照。']
      ].map(function(r){
        return '<div class="row"><div class="row-main"><div class="row-k">' + E(r[0]) + '</div>' +
          '<div class="row-v" style="color:var(--muted);font-size:12.5px;line-height:1.6">' + r[1] + '</div></div></div>';
      }).join('') + '</div>' +
      '<div class="check" style="margin-top:14px"><input type="checkbox" id="stopAck" ' + (ack ? 'checked' : '') +
      ' data-act="ln.ack"><label for="stopAck">我已阅读并理解以上三条，确认终止本笔融资业务。</label></div>';
  }
  return '<div class="mask" data-act="ln.mclose"><div class="modal' + (isStop ? ' wide' : '') + '" role="dialog" aria-modal="true">' +
    '<div class="modal-h"><b>' + E(meta.t) + '</b>' +
    '<button class="modal-x" type="button" data-act="ln.mclose" aria-label="关闭">✕</button></div>' +
    '<div class="modal-b">' +
    '<p class="lead" style="margin-top:0">' + intro + '　融资业务 <span class="mono">' + deal.id +
      '</span>（' + E(deal.party) + ' · ' + usd(deal.amt) + '）</p>' +
    field('原因', '必填 · 1～' + REASON_MAX + ' 字 · 自由文本不分类',
      '<textarea class="inp" rows="4" maxlength="' + REASON_MAX + '" data-act="ln.f" data-v="reason" placeholder="' +
      (kind === 'hold' ? '例如：合同第 7 条的还款账户与平台上确认的收款账户不是同一个开户行，我方内部复核中。'
       : kind === 'redo' ? '例如：盖章件第 3 页的公章与本笔业务的资产方主体不一致，请核对后重新加盖并上传。'
       : '例如：合同主体名称与贵司在平台登记的企业主体不一致，且两次沟通后未能提供更正件。') +
      '">' + E(v) + '</textarea>',
      '<b>原因对资产方可见</b>，并进 FD-19 核验处置记录（只增不改）。已填 ' + len + ' / ' + REASON_MAX + ' 字。' +
      (isStop ? '终止原因同时进 FD-22，并以中性表述进入 P-LS-02 的公开时间线。' : '')) +
    after + '</div>' +
    '<div class="modal-f"><button class="btn" type="button" data-act="ln.mclose">取消</button>' +
    '<button class="btn ' + (isStop ? 'danger' : 'primary') + '" type="button" ' +
      ((ok && (!isStop || ack)) ? '' : 'disabled ') + 'data-act="ln.dispSubmit" data-v="' + kind + '">' +
      (isStop ? '确认终止业务' : '确认' + meta.t) + '</button></div></div></div>';
}

var mod = {
  id:'lending-disbursement', end:'asset', home:'P-LS-07',
  dict:{ en:{}, zh:{} },
  owns:['P-LS-07','P-LS-08'],
  topbarPrd:false,
  /* 每个必达状态在原型里都点得到：加载 / 失败可重试 / 无权限（身份切换）/ 异常分支各一个入口。 */
  states:{
    'P-LS-07':[['default','Fiat · default','法币 · 默认'],
               ['digital','Digital currency','数币 USDT · 哈希与链'],
               ['guard','Guarantee gate blocks','担保不足 · 放款 ⊘'],
               ['reupload','Awaiting re-upload','待资产方重传盖章件'],
               ['onhold','On hold + project expired','已暂缓放款 + 项目已到期'],
               ['gone','Already disbursed','已提交放款 · 入口关闭'],
               ['terminated','Terminated','已终止 S-FD-10'],
               ['loading','Loading','加载中'],
               ['error','Load failed','加载失败']],
    'P-LS-08':[['default','Fiat · 4 days left','法币 · 剩余 4 天'],
               ['soon','Under 24 hours','不足 24 小时 · 加强提示'],
               ['digital','Digital currency','数币 · 哈希与区块浏览器'],
               ['overdue','Overdue','已超过确认时限'],
               ['guard','Guarantee dropped after disbursement','放款后担保跌破 · 确认照常'],
               ['done','Confirmed','已确认 S-FD-6'],
               ['loading','Loading','加载中'],
               ['error','Load failed','加载失败']]
  },
  state:function(){
    return { lang:'zh', role:'fund', did:null, didPage:null, sealIdx:0,
             f:{ given:'', hash:'', memo:'', files:[], extra:[], upErr:null, sizeShown:false },
             reason:'', ack:false, out:'ok', cout:'ok', result:null, modal:null };
  },
  onBoot:function(st){ S = st; },
  /* 身份切换走顶栏上下文操作区（portal 规范 §3）；数据状态切换走公共 stateBar。
     模块不自带底部演示条、不自建菜单。 */
  topExtra:function(){
    return '<div class="seg" role="group" aria-label="演示身份">' +
      ['guest','asset','fund'].map(function(k){
        return '<button type="button" data-act="ln.role" data-v="' + k + '" aria-pressed="' + (S.role === k) + '">' +
          ACTORS[k].t + '</button>'; }).join('') + '</div>';
  },
  crumbParts:function(){ return []; },
  content:function(){ return S.page === 'P-LS-08' ? pageConfirm() : pageDisburse(); },
  modals:{
    hold:function(){ return reasonModal('hold', dealOf('P-LS-07')); },
    redo:function(){ return reasonModal('redo', dealOf('P-LS-07')); },
    stop:function(){ return reasonModal('stop', dealOf('P-LS-07')); },
    /* 提交放款前的二次确认：三件事必须讲清（6.3.1），必须显式确认才可提交 */
    disburse:function(){
      var deal = dealOf('P-LS-07'), v = formState(deal);
      var to = tstr(tmin(NOW) + CONFIRM_HOURS * 60);
      return '<div class="mask" data-act="ln.mclose"><div class="modal wide" role="dialog" aria-modal="true">' +
        '<div class="modal-h"><b>提交放款记录前，请确认以下三件事</b>' +
        '<button class="modal-x" type="button" data-act="ln.mclose" aria-label="关闭">✕</button></div>' +
        '<div class="modal-b"><div class="rows" style="box-shadow:none">' +
        [['① 提交后不可修改、不可撤回',
          '放款记录是您对"我已经付款"的<b>事实陈述</b>，资产方正是据此判断要不要确认。' +
          '本期<b>没有</b>修改、撤回与补充说明入口（X-LS-32 / R-LS-30）——填错了（例如哈希抄错一位）只能线下沟通。' +
          '要写的说明请现在写进备注 LN-11。'],
         ['② 资产方将在 ' + CONFIRM_HOURS + ' 小时内确认，到期不会自动视为确认',
          '到期时刻 <b>' + withTz(to) + '</b>（＝ 提交成功的服务端时间 + ' + CONFIRM_HOURS + ' 小时，精确到秒）。' +
          '<b>到期只发一条通知，状态不变、额度不动</b>：平台不会替资产方承认"钱已收到"。' +
          '他始终不确认时，业务会停在 S-FD-4，您拿不到还款计划，双边额度被占住。'],
         ['③ 平台不核验转账真伪',
          (v.fiat ? '平台看不到银行流水，凭证只校验格式、大小与数量，<b>不审核真伪</b>。'
                  : '交易哈希<b>只做格式校验、不做链上核验</b>（D-FIN-22）：平台不接索引服务，' +
                    '既不做阻断式也不做告警式核验。') +
          '判断权在资产方手里——这正是确认环节存在的意义。']
        ].map(function(r){
          return '<div class="row"><div class="row-main"><div class="row-k">' + E(r[0]) + '</div>' +
            '<div class="row-v" style="color:var(--muted);font-size:12.5px;line-height:1.6">' + r[1] + '</div></div></div>';
        }).join('') + '</div>' +
        '<div class="ls-pick" style="margin-top:14px">' +
          '<span>' + (v.fiat ? '放款' : '结算') + ' <span class="n">' +
            amt(v.fiat ? deal.amt : settleAmt(deal)) + '</span> ' + deal.ccy + '</span><span class="sp"></span>' +
          '<span>发放时间 <span class="n">' + E(v.given) + '</span></span><span class="sp"></span>' +
          '<span>' + (v.fiat ? '凭证 <span class="n">' + S.f.files.length + '</span> 个'
                             : '哈希 <span class="n">' + shortHash(v.hash) + '</span> · ' + E(deal.payee.chain)) + '</span></div>' +
        '<div class="check" style="margin-top:14px"><input type="checkbox" id="lnAck" ' + (S.ack ? 'checked' : '') +
          ' data-act="ln.ack"><label for="lnAck">我已阅读并理解以上三条，确认提交本笔放款记录。</label></div>' +
        '<p class="hint">原型内的结果模拟：选择服务端终检的返回，用于走通分册 6.6 的各条分支。' +
        '真实系统里这些结论一律由服务端在提交时刻实时重算给出。</p>' +
        '<select class="inp" data-act="ln.f" data-v="submitOut" id="submitOut">' +
          SUBMIT_OUTCOMES.map(function(o){
            return '<option value="' + o[0] + '"' + (S.out === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="modal-f"><button class="btn" type="button" data-act="ln.mclose">取消</button>' +
        '<button class="btn primary" type="button" ' + (S.ack ? '' : 'disabled ') +
        'data-act="ln.disburseSubmit">确认提交放款记录</button></div></div></div>';
    },
    /* 确认到账的二次确认：两件事必须讲清（6.4.2） */
    confirm:function(){
      var deal = dealOf('P-LS-08');
      return '<div class="mask" data-act="ln.mclose"><div class="modal wide" role="dialog" aria-modal="true">' +
        '<div class="modal-h"><b>确认到账</b>' +
        '<button class="modal-x" type="button" data-act="ln.mclose" aria-label="关闭">✕</button></div>' +
        '<div class="modal-b"><div class="rows" style="box-shadow:none">' +
        [['① 确认即表示您已核实该笔款项确已到账',
          '平台<b>不核验转账真伪</b>' + (isFiat(deal) ? '——平台看不到您的银行流水' :
            '——交易哈希只做过格式校验，<b>没有做链上核验</b>') + '。' +
          '请先对照' + (isFiat(deal) ? '银行流水' : '链上记录与您的钱包余额') + '确认这笔钱确实到了、是这个金额、进的是这个账户。' +
          '<b>实收少于融资金额是预期内的</b>（跨境手续费由您承担），不影响确认。'],
         ['② 确认后不可撤销，还款义务随即成立',
          '同一次结算内：业务转 <b>S-FD-6 还款中</b>；项目在途金额 −' + amt(deal.amt) + ' / 项目融资余额 +' + amt(deal.amt) +
          '；在途报价金额 −' + amt(deal.amt) + ' / 授信占用额 +' + amt(deal.amt) + '；' +
          '<b>还款计划由 WS-327 生成</b>，本金按融资金额 ' + usd(deal.amt) + ' 计。' +
          '本期<b>不提供撤销</b>（R-LS-31）。']
        ].map(function(r){
          return '<div class="row"><div class="row-main"><div class="row-k">' + E(r[0]) + '</div>' +
            '<div class="row-v" style="color:var(--muted);font-size:12.5px;line-height:1.6">' + r[1] + '</div></div></div>';
        }).join('') + '</div>' +
        '<div class="check" style="margin-top:14px"><input type="checkbox" id="cfAck" ' + (S.ack ? 'checked' : '') +
          ' data-act="ln.ack"><label for="cfAck">我已核实该笔款项确已到账，确认并知悉确认后不可撤销。</label></div>' +
        '<p class="hint">原型内的结果模拟：走通分册 6.6 与非功能第 ③ 条的一致性要求。</p>' +
        '<select class="inp" data-act="ln.f" data-v="confirmOut" id="confirmOut">' +
          [['ok','确认成功（四个量原子转移 + 还款计划触发）'],
           ['settle','E-LN-11 结算部分失败 → 整体回滚，保持 S-FD-4'],
           ['plan','E-LN-13 WS-327 未就绪 → 转移不回滚，计划生成中']].map(function(o){
            return '<option value="' + o[0] + '"' + (S.cout === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="modal-f"><button class="btn" type="button" data-act="ln.mclose">再想想</button>' +
        '<button class="btn primary" type="button" ' + (S.ack ? '' : 'disabled ') +
        'data-act="ln.confirmSubmit">确认到账</button></div></div></div>';
    },
    /* 资产方重传盖章件（reupload_contract）：S-FD-3 段资产方唯一的写动作 */
    reupload:function(){
      var deal = dealOf('P-LS-07');
      return '<div class="mask" data-act="ln.mclose"><div class="modal" role="dialog" aria-modal="true">' +
        '<div class="modal-h"><b>重传盖章件</b>' +
        '<button class="modal-x" type="button" data-act="ln.mclose" aria-label="关闭">✕</button></div>' +
        '<div class="modal-b">' +
        '<p class="lead" style="margin-top:0">' + E(deal.fund) + ' 要求重传，原因：' +
          E(deal.marks.redo ? deal.marks.redo.why : '') + '</p>' +
        '<div class="drop" role="button" tabindex="0" data-act="ln.pickSeal">' +
          '<div class="ic" aria-hidden="true">↑</div><div><b>点击上传新版盖章件</b>' +
          '<div class="hint" style="margin-top:3px">PDF / JPG / PNG · 单文件 ≤ ' + FILE_MAX_MB +
          ' MB · 最多 ' + FIAT_MAX_N + ' 个（沿用 WS-305 第 6 节基线）</div></div></div>' +
        (S.newSeal ? '<div class="filecard" style="margin-top:12px"><div class="ic" aria-hidden="true">▤</div>' +
          '<div class="bd"><b>' + E(S.newSeal.n) + '</b><span>' + E(S.newSeal.s) + '</span></div></div>' : '') +
        CF.note('',
          '<b class="ls-b">历史版本保留、不覆盖</b>：本次上传产生第 ' + (deal.seals.length + 1) +
          ' 版，此前各版及其上传时间与上传人在核验区可逐版切换查看（D-LN-23）。' +
          '<p>重传成功后标记<b class="ls-b">自动清除</b>，机构侧放款入口随即可用，' +
          '<b class="ls-b">不需要机构再点一次"通过"</b>——平台不做审核态。' +
          '重传次数<b class="ls-b">不设上限、不设冷却</b>；重复上传只在第一次成功时清除标记，不产生第二条通知（E-LN-08）。</p>') +
        '</div>' +
        '<div class="modal-f"><button class="btn" type="button" data-act="ln.mclose">取消</button>' +
        '<button class="btn primary" type="button" ' + (S.newSeal ? '' : 'disabled ') +
        'data-act="ln.reuploadSubmit">确认重传</button></div></div></div>';
    }
  },
  hash:{
    build:function(){
      var deal = dealOf(S.page);
      var id = deal ? deal.id : '';
      if(S.page === 'P-LS-08') return '#/deal/' + id + '?action=confirm_disbursement';
      if(S.role === 'asset' && deal && deal.marks && deal.marks.redo)
        return '#/deal/' + id + '?action=reupload_contract';
      return '#/deal/' + id + '?action=disburse';
    },
    read:function(){
      var h = (location.hash || '').replace(/^#\/?/, ''); if(!h) return false;
      var parts = h.split('?'), seg = parts[0].split('/'), qs = {};
      (parts[1] || '').split('&').forEach(function(kv){
        var i = kv.indexOf('='); if(i > 0) qs[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); });
      if(seg[0] !== 'deal') return false;
      var d = findDeal(seg[1]);
      var act = qs.action || 'disburse';
      S.page = act === 'confirm_disbursement' ? 'P-LS-08' : 'P-LS-07';
      S.st = 'default'; S.did = seg[1]; S.didPage = S.page;
      /* 锚点自带身份：三个锚点各自只对一方开放（分册 6.7.1），
         从 WS-324 的 L6 点过来时直接落在该方的视角，不让人先猜一次身份。
         身份仍可在顶栏切换，⊘ 与服务端过滤的表现照常可验。 */
      if(act === 'confirm_disbursement') S.role = 'asset';
      else if(act === 'reupload_contract') S.role = 'asset';
      else S.role = 'fund';
      /* 不存在 / 状态已变：由页面落说明页而不是 404、白屏或静默跳首页（H-02 / AC-LS-104） */
      if(!d) S.did = seg[1];
      return true;
    }
  },
  onGo:function(){ S.modal = null; S.ack = false; },
  onSetState:function(){ S.did = null; S.didPage = null; S.result = null; S.sealIdx = 0;
                         S.f = { given:'', hash:'', memo:'', files:[], extra:[], upErr:null, sizeShown:false }; },
  onAct:function(n, a, v){
    if(a.indexOf('ln.') !== 0) return false;
    var deal;
    switch(a){
      case 'ln.role': S.role = v; S.result = null; CF.render(); return true;
      case 'ln.why':  toast('info', '该操作当前不可用', n.getAttribute('title') || ''); return true;
      case 'ln.f':    return true;   /* 字段回写由下面自挂的 input / change 一层负责，点击本身不重绘 */
      case 'ln.seal': S.sealIdx = +v; CF.render(); return true;
      case 'ln.ack':  S.ack = n.checked; CF.render(); return true;

      case 'ln.do':
        if(v === 'hold' || v === 'redo' || v === 'stop'){ S.reason = ''; S.ack = false; S.modal = { type:v }; }
        else if(v === 'disburse'){ S.ack = false; S.out = 'ok'; S.result = null; S.modal = { type:'disburse' }; }
        else if(v === 'confirm'){ S.ack = false; S.cout = 'ok'; S.result = null; S.modal = { type:'confirm' }; }
        else if(v === 'reupload'){ S.newSeal = null; S.modal = { type:'reupload' }; }
        CF.render(); return true;

      case 'ln.toConfirm':
        S.did = v; S.didPage = 'P-LS-08'; S.result = null; CF.go('P-LS-08'); return true;

      case 'ln.download':
        toast('info', '原型内不提供真实文件',
          '真实系统在此内嵌预览并提供鉴权下载；文件仅该笔业务双方可访问，服务端过滤而非前端隐藏，' +
          '且不使用可猜测的公开直链。');
        return true;

      case 'ln.copyMail':
        deal = dealOf('P-LS-08');
        toast('info', '已复制客服邮箱与业务编号',
          SUPPORT_MAIL + '　融资业务编号 ' + (deal ? deal.id : '') +
          '　·　邮箱地址为占位常量（Q-LN-01 待业务方提供），拿到后替换一个常量即可，不触及流程与页面结构。');
        return true;

      /* ---- 上传：法币凭证与数币补充材料共用，第二次演示超限（E-LN-06）---- */
      case 'ln.upload': {
        var list = v === 'extra' ? S.f.extra : S.f.files;
        var cap  = v === 'extra' ? EXTRA_MAX_N : FIAT_MAX_N;
        if(list.length >= cap){
          S.f.upErr = '最多上传 ' + cap + ' 个文件，当前已有 ' + list.length +
            ' 个。已上传的其他文件保留，请先移除不需要的再继续。';
          CF.render(); return true;
        }
        if(v !== 'extra' && list.length === 1 && !S.f.sizeShown){
          S.f.sizeShown = true;
          S.f.upErr = '文件「电汇凭证-扫描件-背面.tiff」未通过：① 格式为 TIFF，本期只接受 PDF / JPG / PNG；' +
            '② 大小 12.6 MB，超过单文件 ' + FILE_MAX_MB + ' MB 上限。<b class="ls-b">已上传的其他文件保留</b>，无需重传。';
          CF.render(); return true;
        }
        S.f.upErr = null;
        list.push(v === 'extra'
          ? { n:'钱包转账截图-' + (list.length + 1) + '.png', s:(0.3 + list.length * 0.2).toFixed(1) + ' MB' }
          : { n:'电汇凭证-回单-' + (list.length + 1) + '.pdf', s:(0.7 + list.length * 0.3).toFixed(1) + ' MB' });
        CF.render(); return true;
      }
      case 'ln.rmFile':  S.f.files.splice(+v, 1); S.f.upErr = null; CF.render(); return true;
      case 'ln.rmExtra': S.f.extra.splice(+v, 1); CF.render(); return true;

      /* ---- 三个处置动作的提交 ---- */
      case 'ln.dispSubmit': {
        deal = dealOf('P-LS-07');
        var why = (S.reason || '').trim();
        if(!why || why.length > REASON_MAX) return true;
        var by = ACTORS.fund.full + ' · 陈立';
        deal.disp = deal.disp || [];
        deal.disp.push({ k:v, at:NOW, by:by, why:why });
        S.modal = null; S.ack = false;
        if(v === 'hold'){
          deal.marks.hold = { at:NOW, by:by, why:why };
          S.result = { k:'hold' };
          toast('success', '已登记暂不放款', '业务仍是 S-FD-3 待放款，四个量一个不变；原因对资产方可见。');
        } else if(v === 'redo'){
          deal.marks.redo = { at:NOW, by:by, why:why };
          S.result = { k:'redo' };
          toast('success', '已要求重传盖章件', '业务仍是 S-FD-3；资产方获得重传入口，重传成功后标记自动清除。');
        } else {
          deal.st = 'S-FD-10';
          deal.terminated = { at:NOW, by:by, why:why };
          var released = deal.cr.fly;
          deal.cr.fly = round2(deal.cr.fly - deal.amt);
          S.result = { k:'stopped', amt:deal.amt, released:released };
          toast('success', '业务已终止',
            '落 S-FD-10 已终止（终态）；在途报价金额全额释放且不进授信占用额，项目在途金额不变，项目回 S-FP-2 募集中。');
        }
        S.reason = ''; CF.render(); window.scrollTo(0, 0); return true;
      }

      /* ---- 放款提交 ---- */
      case 'ln.disburseSubmit': {
        deal = dealOf('P-LS-07');
        var out = (q('#submitOut') || {}).value || S.out || 'ok';
        var fv = formState(deal);
        S.modal = null; S.ack = false;
        if(out === 'ok'){
          if(!fv.ok){
            S.result = { k:'moved', detail:'表单尚未通过前端校验，服务端不会收到本次提交' };
            CF.render(); return true;
          }
          var id = 'LN' + dayOnly(NOW).replace(/-/g, '') + '000004';
          deal.ln = { id:id, at:NOW, given:fv.given,
                      files:S.f.files.slice(), extra:S.f.extra.slice(),
                      hash:fv.fiat ? null : fv.hash, chain:fv.fiat ? null : deal.payee.chain,
                      memo:(S.f.memo || '').trim() };
          deal.st = 'S-FD-4';
          deal.marks = {};                         /* 提交放款自动清除「已暂缓放款」「待重传」标记 */
          S.result = { k:'submitted', id:id, at:NOW, to:tstr(tmin(NOW) + CONFIRM_HOURS * 60) };
          S.did = deal.id; S.didPage = 'P-LS-08';
          toast('success', '放款记录已提交',
            '业务转 S-FD-4 待融资确认，融资确认时限开始计时（起点为提交成功的服务端时间）。四个量一个都不动。');
          CF.go('P-LS-08'); return true;
        }
        if(out === 'guard'){
          var g = guaranteeCheck(deal);
          S.result = { k:'guard', gap:Math.max(g.gap, 20000), add:round2(Math.max(g.gap, 20000) / PLEDGE_RATE),
            detail:'融资上限 ' + amt(g.cap) + ' ＜ 项目融资余额 ' + amt(g.bal) + ' ＋ 项目在途金额 ' + amt(g.fly) +
                   ' ＝ ' + amt(g.need) };
        } else if(out === 'race'){
          S.result = { k:'race', id:'LN' + dayOnly(NOW).replace(/-/g, '') + '000002', at:NOW };
        } else if(out === 'moved'){
          S.result = { k:'moved', detail:'同事已于 ' + withTz(NOW) + ' 终止了这笔业务（S-FD-10 已终止）' };
        } else if(out === 'chain'){
          S.result = { k:'chain', chain:deal.payee.chain || 'Ethereum' };
        } else {
          S.result = { k:'upload',
            detail:'文件「电汇凭证-扫描件-背面.tiff」未通过：① 格式为 TIFF，本期只接受 PDF / JPG / PNG；' +
                   '② 大小 12.6 MB，超过单文件 ' + FILE_MAX_MB + ' MB 上限。' };
        }
        CF.render(); window.scrollTo(0, 0); return true;
      }

      /* ---- 融资确认 ---- */
      case 'ln.confirmSubmit': {
        deal = dealOf('P-LS-08');
        var co = (q('#confirmOut') || {}).value || S.cout || 'ok';
        S.modal = null; S.ack = false;
        if(co === 'settle'){
          S.result = { k:'settle' };
          toast('info', '结算未完成，已整体回滚', '业务保持 S-FD-4 待融资确认，四个量与确认前完全一致。可重试。');
        } else {
          deal.st = 'S-FD-6'; deal.fd24 = NOW;
          deal.pool.fly = round2(deal.pool.fly - deal.amt);
          deal.pool.bal = round2(deal.pool.bal + deal.amt);
          deal.cr.fly   = round2(deal.cr.fly - deal.amt);
          deal.cr.used  = round2(deal.cr.used + deal.amt);
          S.result = co === 'plan' ? { k:'plan', at:NOW } : { k:'confirmed', at:NOW, amt:deal.amt };
          toast('success', '已确认到账',
            '业务转 S-FD-6 还款中；项目在途金额 → 项目融资余额、在途报价金额 → 授信占用额，四个量同时生效。');
        }
        CF.render(); window.scrollTo(0, 0); return true;
      }

      /* ---- 资产方重传盖章件 ---- */
      case 'ln.pickSeal':
        S.newSeal = { n:'融资合同-双方盖章件-更正版.pdf', s:'2.6 MB' };
        CF.render(); return true;
      case 'ln.reuploadSubmit': {
        deal = dealOf('P-LS-07');
        if(!S.newSeal) return true;
        deal.seals.push({ n:S.newSeal.n, s:S.newSeal.s, at:NOW, by:ACTORS.asset.full + ' · 周敏' });
        deal.marks.redo = null; delete deal.marks.redo;   /* 重传成功即自动清除标记，无需机构二次动作 */
        S.sealIdx = deal.seals.length - 1;
        S.modal = null; S.newSeal = null;
        S.result = { k:'reuploaded', n:deal.seals.length };
        toast('success', '盖章件已重传',
          '标记已自动清除，机构侧核验区立即出现新版本、放款入口可用；历史版本一份不少。');
        CF.render(); window.scrollTo(0, 0); return true;
      }

      case 'ln.mclose':
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
   （shell.js 全文没有 input / change 监听）。本模块两页都有表单，必须拿到这两个事件，
   因此在这里自挂一层——只认本模块的 data-act="ln.f"，不接管公共层的任何分发、不改 _shared。
     input  → 只回写状态，**不重绘**：重绘会把正在输入的那个框的焦点与光标位置冲掉；
     change → 回写并重绘，派生读数（校验结论、按钮可用性、字数）在离焦或选择时随之更新。
   与 WS-325 同一处理，同一条对公共层的修订请求记在模块 README §5.2。 */
function writeField(k, val){
  if(k === 'given')       S.f.given = val;
  else if(k === 'hash')   S.f.hash = val;
  else if(k === 'memo')   S.f.memo = val;
  else if(k === 'reason') S.reason = val;
  else if(k === 'submitOut') S.out = val;      /* 结果模拟的选择也进状态：重绘不把已选项冲掉 */
  else if(k === 'confirmOut') S.cout = val;
}
function fieldNode(e){
  var n = e.target && e.target.closest ? e.target.closest('[data-act="ln.f"]') : null;
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
     并可能把紧随其后的那一次点击一起吞掉。已作为对公共层的修订请求记在 README §5.2。 */
  setTimeout(function(){ CF.render(); }, 0);
});

CF.define(mod);
CF.boot();
})();
