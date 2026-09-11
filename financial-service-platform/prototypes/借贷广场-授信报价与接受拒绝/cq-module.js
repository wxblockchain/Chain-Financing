/* ==========================================================================
   cq-module.js — 借贷广场 · 授信、报价与接受/拒绝（WS-325）
   PRD 基线：v1.0-借贷广场-授信报价与接受拒绝-PRD.md V4.0 + 分册 01 V4.0
   上游：WS-324 PRD V7.0；上游原型 借贷广场-融资需求与代币质押 v1.2.1

   本文件只写本模块的页面、文案、演示数据与状态。
   token / 公共组件 / 运行时 / 页面登记一律来自 _shared，不在此重建。

   页面：P-LS-04 授信核定（报价前置）· P-LS-05 机构报价 · P-LS-06 接受 / 拒绝
   ========================================================================== */
(function () {
"use strict";

/* ================================================================
   Part A —— 口径常量、枚举与演示数据
   全部业务数据为演示数据：企业名带「（演示）」后缀，编号 / 金额 / 账号均为虚构。
   ================================================================ */

/* ---- 口径常量（分册 7.4 枚举与常量） ---- */
var CCY          = 'USD';   /* 记账本位币：一切额度类的量恒为 USD（D-FIN-13） */
var QUOTE_HOURS  = 168;     /* 报价有效期：常量 168 小时 ＝ 7 个自然日（D-CR-26），不可配置、不可延长 */
var CR_MIN_YEARS = 1;       /* 授信有效期下限：核定日 + 1 年（D-CR-19，08:51 裁定 8） */
var CR_MAX_YEARS = 5;       /* 授信有效期上限：核定日 + 5 年（09:12 裁定，Q-CR-06 已关闭） */
var PLEDGE_RATE  = 0.8;     /* 质押率：常量 80%（D-MC-110），本模块只消费、不展示可调暗示 */
var REASON_MAX   = 200;     /* 拒绝原因 1～200 字，不分类（6.3.5） */
var SEAL_MAX_MB  = 10;      /* 盖章件单文件 ≤ 10 MB，≤ 5 个（沿用 WS-305 第 6 节基线） */
var SEAL_MAX_N   = 5;
var NOW          = '2026-09-11 10:40';   /* 演示"当前时刻"，服务端时间 */
var TZ_LABEL     = 'UTC+8';              /* 平台统一时区标注，口径引用 WS-308『01-国际化基线』第 4 节 */

/* ---- 授信额度状态机（分册 7.0） ---- */
var CR_STATUS = {
  'S-CR-1':{ t:'生效中',  tone:'good' },
  'S-CR-2':{ t:'已到期',  tone:'mute' }   /* 视同无额度，走新建 / 重新核定分支（AC-CR-07），没有"顶一次"的宽限 */
};

/* ---- 融资业务状态（沿用附册 A4.2 唯一一套状态机；本模块只新增终态 S-FD-11） ---- */
var FD_STATUS = {
  'S-FD-1': { t:'待接受',     tone:'info', x:'等待资产方处理，7 天有效期计时中' },
  'S-FD-2': { t:'已拒绝',     tone:'mute', x:'终态 · 资产方的意思表示，有原因、对机构可见' },
  'S-FD-11':{ t:'报价已失效', tone:'mute', x:'终态 · 系统事件，无原因、不计入拒绝率' },
  'S-FD-3': { t:'待放款',     tone:'good', x:'已接受，放款与融资确认在 WS-326' }
};
/* 失效原因（FD-15）：不是评价性标签，对机构不产生任何负面记录（D-CR-31） */
var VOID_REASON = {
  timeout:'有效期届满',
  demand :'所属融资需求失效'
};

/* ---- 融资项目状态（引用 WS-324 D-FIN-28，一处定义两处引用） ---- */
var FP_STATUS = {
  'S-FP-2':{ t:'募集中', tone:'good' },
  'S-FP-3':{ t:'已锁定', tone:'info' },
  'S-FP-4':{ t:'融资中', tone:'info' },
  'S-FP-6':{ t:'已结清', tone:'mute' }
};

/* ---- 接受填写进度（FD-04）：S-FD-1 内部的进度，不是状态（D-FIN-77） ---- */
var STEPS = [
  { k:'account', n:1, t:'填写并确认收款账户', x:'预填可改 · 必须逐笔显式确认（D-FIN-94 / FD-20）' },
  { k:'terms',   n:2, t:'查看商务条款摘要',   x:'可复制 / 可打印，供双方线下拟约（D-FIN-87）' },
  { k:'seal',    n:3, t:'上传盖章件并声明',   x:'PDF / JPG / PNG，单文件 ≤ 10 MB、≤ 5 个（FD-09 / FD-16）' }
];

/* ---- 身份：与 WS-324 同一套演示身份，不另造一套 ---- */
var ACTORS = {
  guest:{ k:'guest', t:'游客',   full:'未登录访客',             entity:null,        short:'游' },
  asset:{ k:'asset', t:'资产方', full:'晟远科技（演示）',       entity:'E-ASSET-01', short:'晟',
          nameEn:'Shengyuan Technology Co., Ltd.' },
  fund: { k:'fund',  t:'资金方', full:'北岸融资租赁（演示）',   entity:'E-FUND-07',  short:'北' }
};
var OTHER_FUND = '环海商业保理（演示）';   /* 另一家机构，用于"已被他人报价"与他方报价的终结态 */

/* ---- 授信额度：机构 × 资产方企业二元组，与任何单个融资项目无关（D-CR-10） ----
   下表全部是「北岸融资租赁（演示）」这一家机构对各资产方的额度。
   授信占用额（CR-08）＝ 未结清业务的未偿本金；在途报价金额（CR-09）由下面的 DEALS 现算，
   两者分开计、在 AC-CR-03 里相加（D-CR-16）—— 合称授信已用额，不是第四个量（D-CR-18）。 */
var CREDITS = [
  { id:'CR-20260302-0011', entity:'E-ASSET-01', party:'晟远科技（演示）',
    limit:1200000, st:'S-CR-1', openedAt:'2026-03-02', until:'2027-03-02', used:300000,
    memo:'核心客户，池内抵押物以三甲医院应收为主；额度按年度授信评审结论录入。',
    log:[{ at:'2026-03-02', k:'首次核定', from:0, to:800000, until:'2027-03-02' },
         { at:'2026-06-18', k:'追加',     from:800000, to:1200000, until:'2027-03-02' }] },
  { id:'CR-20260115-0006', entity:'E-ASSET-09', party:'恒盛供应链（演示）',
    limit:500000, st:'S-CR-1', openedAt:'2026-01-15', until:'2027-01-15', used:260000,
    memo:'首年合作，先给小额试单。',
    log:[{ at:'2026-01-15', k:'首次核定', from:0, to:500000, until:'2027-01-15' }] },
  { id:'CR-20250820-0003', entity:'E-ASSET-03', party:'中垣建材（演示）',
    limit:800000, st:'S-CR-2', openedAt:'2025-08-20', until:'2026-08-20', used:0,
    memo:'上一年度授信，已于 2026-08-20 到期。',
    log:[{ at:'2025-08-20', k:'首次核定', from:0, to:800000, until:'2026-08-20' },
         { at:'2026-08-20', k:'到期',     from:800000, to:800000, until:'2026-08-20' }] },
  { id:'CR-20260630-0014', entity:'E-ASSET-04', party:'明泰家电（演示）',
    limit:900000, st:'S-CR-1', openedAt:'2026-06-30', until:'2027-06-30', used:120000,
    memo:'',
    log:[{ at:'2026-06-30', k:'首次核定', from:0, to:900000, until:'2027-06-30' }] }
  /* E-ASSET-06 瑞和能源装备（演示）：本机构对其无授信记录 —— 走新建分支 */
];

/* ---- 融资项目 ----
   项目编号、名称、资产方、有效期与 WS-324 原型同源；担保侧的四个量按 WS-324 口径给出，
   本模块只读消费，不改写它们（AC-FIN-23：报价不动任何一个项目维度的量）。
   cap ＝ 融资上限（已乘 80% 质押率）、bal ＝ 项目融资余额、fly ＝ 项目在途金额。 */
var PROJECTS = [
  { id:'FP-20260812-0031', name:'华东电子元件应收账款池', owner:'晟远科技（演示）', entity:'E-ASSET-01',
    status:'S-FP-3', expired:false, demand:500000, publishedAt:'2026-08-14', expiresAt:'2027-08-14',
    valid:900000, cap:720000, bal:0, fly:500000, tokens:9, deadTokens:0, assetType:'应收账款类' },
  { id:'FP-20260722-0027', name:'长三角精密零部件应收账款池', owner:'晟远科技（演示）', entity:'E-ASSET-01',
    status:'S-FP-3', expired:false, demand:300000, publishedAt:'2026-07-26', expiresAt:'2027-07-26',
    valid:560000, cap:448000, bal:0, fly:300000, tokens:6, deadTokens:0, assetType:'应收账款类' },
  { id:'FP-20260820-0036', name:'华南汽配应收账款池', owner:'恒盛供应链（演示）', entity:'E-ASSET-09',
    status:'S-FP-2', expired:false, demand:600000, publishedAt:'2026-08-21', expiresAt:'2027-08-21',
    valid:1050000, cap:840000, bal:0, fly:600000, tokens:11, deadTokens:0, assetType:'应收账款类' },
  { id:'FP-20250916-0112', name:'西部能源设备应收账款池', owner:'瑞和能源装备（演示）', entity:'E-ASSET-06',
    status:'S-FP-2', expired:false, demand:200000, publishedAt:'2025-09-16', expiresAt:'2026-09-16',
    valid:400000, cap:320000, bal:0, fly:200000, tokens:4, deadTokens:0, assetType:'应收账款类' },
  { id:'FP-20260628-0044', name:'中部机械应收账款池', owner:'中垣建材（演示）', entity:'E-ASSET-03',
    status:'S-FP-2', expired:false, demand:300000, publishedAt:'2026-06-30', expiresAt:'2027-06-30',
    valid:620000, cap:496000, bal:100000, fly:300000, tokens:7, deadTokens:0, assetType:'应收账款类' },
  { id:'FP-20260705-0018', name:'珠三角家电应收账款池', owner:'明泰家电（演示）', entity:'E-ASSET-04',
    status:'S-FP-2', expired:false, demand:450000, publishedAt:'2026-07-08', expiresAt:'2027-07-08',
    valid:800000, cap:640000, bal:0, fly:450000, tokens:8, deadTokens:0, assetType:'应收账款类' },
  /* 需求已按 AC-FIN-26 自动失效：480,000 − 500,000 − 0 = −20,000 < 200,000（D-CR-45：判据比预警更早触发）。
     项目留在 S-FP-2，但已无在途需求；报价入口按 ⊘ + 原因返回，不隐藏。 */
  { id:'FP-20260416-0007', name:'长三角医疗器械应收账款池', owner:'晟远科技（演示）', entity:'E-ASSET-01',
    status:'S-FP-2', expired:false, demand:null, publishedAt:'2026-04-20', expiresAt:'2027-04-20',
    valid:600000, cap:480000, bal:500000, fly:0, tokens:9, deadTokens:2, assetType:'应收账款类',
    voidedDemand:200000, voidedAt:'2026-08-19 23:40' },
  { id:'FP-20250820-0098', name:'北方建材应收账款池', owner:'中垣建材（演示）', entity:'E-ASSET-03',
    status:'S-FP-4', expired:true, demand:null, publishedAt:'2025-08-20', expiresAt:'2026-08-20',
    valid:700000, cap:560000, bal:400000, fly:0, tokens:8, deadTokens:0, assetType:'应收账款类' }
];

/* ---- 融资业务（＝报价，1:1，D-FIN-03）----
   fx 是汇率快照（QT-04 四项：汇率值 / 生效时间 / 来源说明 / 版本标识），
   报价提交时锁定、此后永不重算（D-FIN-80）；报价终结时按 QT-14 作废。 */
var DEALS = [
  { id:'FD-20260908-0061', pid:'FP-20260812-0031', fund:ACTORS.fund.full, fundEntity:'E-FUND-07',
    party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:500000, rate:7.20, ccy:'USD', at:'2026-09-08 14:20', st:'S-FD-1', prog:'none',
    fx:{ v:1.0000, at:'2026-09-08 14:20', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260908-T1420' },
    payee:{ bank:'Bank of Communications, Shanghai Branch', acct:'310066123456789012',
            name:'北岸融资租赁（演示）', swift:'COMMCNSHSDB', country:'中国大陆' },
    memo:'医疗器械应收，买方集中度可接受。' },

  { id:'FD-20260904-0057', pid:'FP-20260722-0027', fund:OTHER_FUND, fundEntity:'E-FUND-22',
    party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:300000, rate:8.50, ccy:'USDT', at:'2026-09-04 19:05', st:'S-FD-1', prog:'account',
    fx:{ v:0.9994, at:'2026-09-04 19:05', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260904-T1905' },
    payee:{ chain:'Ethereum', addr:'0x7F2c9A41B6ee0D3c58Ab41E9d0c7B2Aa45E1c390' } },

  { id:'FD-20260901-0055', pid:'FP-20260820-0036', fund:ACTORS.fund.full, fundEntity:'E-FUND-07',
    party:'恒盛供应链（演示）', entity:'E-ASSET-09',
    amt:600000, rate:9.80, ccy:'USD', at:'2026-09-01 09:30', st:'S-FD-2',
    endAt:'2026-09-03 16:12',
    reject:'年化 9.80% 高于我方本轮可接受区间（不超过 8.50%），且还款方式与我方现金流不匹配。若贵司可下调至 8.20% 以内，我方愿意重新评估。',
    fx:{ v:1.0000, at:'2026-09-01 09:30', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260901-T0930' } },

  { id:'FD-20260825-0049', pid:'FP-20250916-0112', fund:OTHER_FUND, fundEntity:'E-FUND-22',
    party:'瑞和能源装备（演示）', entity:'E-ASSET-06',
    amt:200000, rate:7.90, ccy:'USD', at:'2026-08-25 11:00', st:'S-FD-11', void:'timeout',
    endAt:'2026-09-01 11:00',
    fx:{ v:1.0000, at:'2026-08-25 11:00', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260825-T1100' } },

  { id:'FD-20260819-0047', pid:'FP-20260416-0007', fund:OTHER_FUND, fundEntity:'E-FUND-22',
    party:'晟远科技（演示）', entity:'E-ASSET-01',
    amt:200000, rate:7.40, ccy:'USD', at:'2026-08-19 10:05', st:'S-FD-11', void:'demand',
    endAt:'2026-08-19 23:40',
    fx:{ v:1.0000, at:'2026-08-19 10:05', src:'WS-318 汇率管理 · 中间价', ver:'FX-20260819-T1005' } }
];

/* ---- 汇率快照池：选中结算币种时即时展示（D-FIN-80）。
   本期融资需求币种恒为 USD 且报价金额只读等于需求金额，故"折 USD"在本期取值上恒等于原值；
   这是本期取值说明，不写进公式本身（D-FIN-82）。 ---- */
var FX = {
  USD :{ v:1.0000, src:'WS-318 汇率管理 · 中间价', ver:'FX-20260911-T1040', at:NOW, x:'本位币，不折算' },
  USDT:{ v:0.9994, src:'WS-318 汇率管理 · 中间价', ver:'FX-20260911-T1040', at:NOW, x:'1 USD ＝ 1.0006 USDT' },
  USDC:{ v:1.0002, src:'WS-318 汇率管理 · 中间价', ver:'FX-20260911-T1040', at:NOW, x:'1 USD ＝ 0.9998 USDC' }
};

/* ---- 该企业主体最近一次成功接受时使用的收款账户（D-FIN-94 预填来源）----
   平台自己就有这份数据，不依赖任何账户设置模块；首次接受时为空白手填。 */
var LAST_PAYEE = {
  name:'Shengyuan Technology Co., Ltd.',
  addr:'No. 1299 Century Avenue, Pudong New Area, Shanghai, China',
  acct:'CNY62-4410-8827-0031',
  bank:'China Merchants Bank, Shanghai Branch',
  bankAddr:'No. 8 Lujiazui Ring Road, Pudong New Area, Shanghai, China',
  swift:'CMBCCNBS021',
  country:'中国大陆',
  imBank:'', imSwift:'', imAcct:''
};
/* 企业主体已登记的名称集合（D-FIN-100 比对口径：法定名称 + 英文名 / 曾用名） */
var ENTITY_NAMES = ['晟远科技（演示）', 'Shengyuan Technology Co., Ltd.', '上海晟远科技有限公司（演示）'];

/* 数币收款地址：企业统一数币地址（WS-313 D-DS-05），本期只读不可改（D-FIN-85） */
var ASSET_WALLET = { chain:'Ethereum', addr:'0x3A91Ee5b2C7d40F18b6AC0937Ee2d5148cB7f204' };


/* ================================================================
   Part B —— 格式化、时间与派生量
   ================================================================ */

function amt(n){
  if(n === null || n === undefined) return '—';
  var neg = n < 0; n = Math.abs(n);
  var s = n.toFixed(2), p = s.split('.');
  return (neg ? '-' : '') + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + p[1];
}
function usd(n){ return n === null || n === undefined ? '—' : amt(n) + ' ' + CCY; }
function money(n, ccy){ return amt(n) + ' ' + ccy; }
function round2(n){ return Math.round(n * 100) / 100; }

/* ---- 时间：演示内一律 'YYYY-MM-DD HH:mm'，按平台统一时区展示并标注（WS-308 第 4 节） ---- */
function tmin(s){
  var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if(!m) return 0;
  return Date.UTC(+m[1], +m[2]-1, +m[3], +(m[4]||0), +(m[5]||0)) / 60000;
}
function tstr(mins){
  var d = new Date(mins * 60000), p = function(n){ return (n<10?'0':'') + n; };
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth()+1) + '-' + p(d.getUTCDate()) +
         ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
}
function withTz(s){ return s ? s + ' ' + TZ_LABEL : '—'; }
function addYears(dateStr, y){
  var p = String(dateStr).slice(0,10).split('-');
  return (+p[0] + y) + '-' + p[1] + '-' + p[2];
}
function dayOnly(s){ return String(s).slice(0,10); }
function daysBetween(a, b){ return Math.floor((tmin(b) - tmin(a)) / 1440); }

/* 时长呈现（QT-13 / FD-13）：精确到小时；不足 24 小时精确到分钟。
   两者相加恒为 168 小时 —— 倒计时条上的两段就是这条恒等式。 */
function fmtDur(mins){
  if(mins <= 0) return '0 分钟';
  var d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), mi = mins % 60;
  if(mins < 1440) return (Math.floor(mins/60) ? Math.floor(mins/60) + ' 小时 ' : '') + mi + ' 分钟';
  return (d ? d + ' 天 ' : '') + h + ' 小时';
}

/* ---- 报价有效期（D-CR-25 / D-CR-26 / QT-12 / QT-13） ---- */
function quoteClock(deal){
  var from = tmin(deal.at), to = from + QUOTE_HOURS * 60, now = tmin(NOW);
  var left = Math.max(0, to - now), held = Math.min(QUOTE_HOURS * 60, Math.max(0, now - from));
  return {
    from:deal.at, to:tstr(to),
    leftMin:left, heldMin:held,
    /* 业务离开 S-FD-1 后计时终止，页面不再显示倒计时（D-CR-28） */
    live:(deal.st === 'S-FD-1'),
    soon:(left > 0 && left < 1440),          /* 不足 24 小时：切分钟精度并加强提示 */
    over:(left <= 0)
  };
}

/* ---- 授信判定：只认生效中的额度，S-CR-2 已到期视同无额度（AC-CR-07） ---- */
function creditOf(entity){
  for(var i = 0; i < CREDITS.length; i++) if(CREDITS[i].entity === entity) return CREDITS[i];
  return null;
}
/* 在途报价金额（CR-09）：该二元组下处于 S-FD-1 / S-FD-3 / S-FD-4 / S-FD-5 的融资业务金额合计。
   由 DEALS 现算，不另存一份 —— 与拒绝 / 失效的释放天然一致（5.4.1）。 */
function pendingQuoteAmt(entity, extra){
  var sum = 0;
  DEALS.forEach(function(d){
    if(d.entity !== entity || d.fundEntity !== ACTORS.fund.entity) return;
    if(d.st === 'S-FD-1' || d.st === 'S-FD-3') sum += d.amt;
  });
  return round2(sum + (extra || 0));
}

/* AC-CR-03（修正式，唯一口径）：
   授信占用额 + 在途报价金额 + 本次报价金额(折 USD) ≤ 授信额度
   前两项之和即授信已用额（CR-10），是合称、不单独存储、不作为第四个量展示（D-CR-18）。 */
function creditCheck(entity, thisAmt){
  var cr = creditOf(entity);
  var alive = !!cr && cr.st === 'S-CR-1';
  var used = alive ? cr.used : 0;
  var fly  = alive ? pendingQuoteAmt(entity) : 0;
  var limit = alive ? cr.limit : 0;
  var avail = Math.max(0, round2(limit - used - fly));     /* 可用授信 CR-11，为负按 0 展示 */
  var need  = round2(thisAmt || 0);
  var r = {
    cr:cr, alive:alive, limit:limit, used:used, fly:fly,
    usedTotal:round2(used + fly),                           /* 授信已用额 CR-10 */
    avail:avail, need:need,
    gap:Math.max(0, round2(need - avail)),
    pass:alive && need <= avail,
    branch:'enough'
  };
  if(!cr)                       r.branch = 'new';       /* ① 无额度 → 新建 */
  else if(cr.st === 'S-CR-2')   r.branch = 'renew';     /* ③ 已到期 → 重新核定 */
  else if(!r.pass)              r.branch = 'topup';     /* ② 额度不足 → 追加 */
  return r;
}

/* AC-FIN-26（定义在 WS-324 V7.0，本模块引用不复述）：
   融资上限 − 项目融资余额 − 更早已保留需求金额合计 < 本笔需求金额 ⇒ 该笔失效。
   累计项本期恒为 0（串行承载一笔，D-FIN-33），但按累计形态实现、不写死成单笔（D-CR-36）。
   "池内资产"取融资上限（已乘 80% 质押率），不是未乘的有效质押价值（D-CR-35）。 */
function guaranteeCheck(p, demandAmt){
  var earlier = 0;                                          /* 更早已保留需求金额合计 */
  var head = round2(p.cap - p.bal - earlier);
  var need = demandAmt === undefined || demandAmt === null ? p.demand : demandAmt;
  return {
    cap:p.cap, bal:p.bal, earlier:earlier, head:head, need:need,
    pass:(need !== null && need !== undefined) ? head >= need : true,
    free:Math.max(0, round2(p.cap - p.bal - p.fly))          /* 可融金额 FP-15，只做展示 */
  };
}

function findProject(id){ for(var i=0;i<PROJECTS.length;i++) if(PROJECTS[i].id===id) return PROJECTS[i]; return null; }
function findDeal(id){ for(var i=0;i<DEALS.length;i++) if(DEALS[i].id===id) return DEALS[i]; return null; }
function liveDealOf(pid){
  for(var i=0;i<DEALS.length;i++) if(DEALS[i].pid===pid && DEALS[i].st==='S-FD-1') return DEALS[i];
  return null;
}
function dealsOf(pid){ return DEALS.filter(function(d){ return d.pid === pid; }); }

/* ================================================================
   available_actions（H-03 / AC-LS-91）
   服务端在每次读取时返回当前可执行动作清单，前端按其渲染、不自行依据状态推断；
   须区分「不可见」（不返回）与「可见不可点 ⊘ + 可区分的原因」（AC-LS-92 / AC-LS-86）。
   原型内由本函数就地模拟同一份契约。
   ================================================================ */
function availableActions(p, role){
  var out = [], own = (role === 'asset' && p.entity === ACTORS.asset.entity);
  var guest = (role === 'guest');
  var deal = liveDealOf(p.id);

  /* --- quote：去报价（含授信前置）。五种 ⊘ 情形文案各异，不存在"暂不可操作"的兜底 --- */
  var q = { key:'quote', label:'立即报价', enabled:false, reason:'', brief:'' };
  if(guest){
    q.reason = '未登录。登录并以资金方企业主体进入后可发起报价；页面信息 L1～L5 不因未登录而隐藏。';
    q.brief  = '需登录';
  } else if(role === 'asset'){
    q.reason = own ? '不能为自己的项目报价。' : '当前企业主体未开通资金方资质，无法发起报价。';
    q.brief  = own ? '本方项目' : '无资金方资质';
  } else if(p.expired){
    q.reason = '该融资项目有效期已于 ' + p.expiresAt + ' 到期，停止接受新报价；存量融资业务照常履约（D-FIN-43 分支②）。';
    q.brief  = '项目已到期';
  } else if(p.voidedDemand){
    q.reason = '该融资需求已失效（池内担保不足）。判据：融资上限 ' + amt(p.cap) + ' − 项目融资余额 ' +
               amt(p.bal) + ' ＝ ' + amt(round2(p.cap - p.bal)) + '，小于该笔需求金额 ' + amt(p.voidedDemand) +
               '。资产方补足担保并重新发布后可再次报价。';
    q.brief  = '需求已失效 · 担保不足';
  } else if(p.status === 'S-FP-3' && deal){
    q.reason = '该需求已被' + (deal.fundEntity === ACTORS.fund.entity ? '本机构' : '其他机构') +
               '报价（' + deal.fund + '，' + withTz(deal.at) + '），同一时刻至多承载一笔在途融资业务（D-FIN-33）。' +
               '剩余有效期 ' + fmtDur(quoteClock(deal).leftMin) + '，届满自动失效、需求自动放开。';
    q.brief  = '已被报价';
  } else if(!p.demand){
    q.reason = '该项目当前无在途融资需求。'; q.brief = '无在途需求';
  } else if(p.status !== 'S-FP-2'){
    q.reason = '当前项目状态为「' + (FP_STATUS[p.status]||{t:p.status}).t + '」，只有「募集中」接受新报价。';
    q.brief  = (FP_STATUS[p.status]||{t:p.status}).t;
  } else {
    q.enabled = true;
    /* 服务端在返回 quote 动作时一并给出授信判定结果与差额（D-LS-15）——
       「去授信」不单独占一个动作值、不单独占一个锚点。 */
    q.credit = creditCheck(p.entity, p.demand);
  }
  out.push(q);

  /* --- respond_quote：去接受 / 拒绝。业务已终结时不返回（不可见，非 ⊘） --- */
  if(deal && (own || guest)){
    var r = { key:'respond', label:'接受 / 拒绝报价', enabled:!guest,
              reason: guest ? '未登录。融资业务的处理动作仅对该项目所属企业主体开放；商务条款与锁定信息本身是公开的。' : '' };
    out.push(r);
  }
  return out;
}
function actionOf(list, key){ for(var i=0;i<list.length;i++) if(list[i].key===key) return list[i]; return null; }


/* ================================================================
   Part C —— 共用片段
   ================================================================ */
var CF = window.CF, E = CF.esc, q = CF.q, pageHead = CF.pageHead, toast = CF.toast;
var S = null;

function pill(tone, t){ return '<span class="pill ' + tone + '">' + E(t) + '</span>'; }
var TONE = { mute:'gray', info:'', good:'green', warn:'amber', crit:'red' };

/* 跨文件入口：WS-324 借贷广场原型与本模块是同级目录，按登记表拼相对地址，不写死路径 */
function lsHref(hash){
  var m = (CF.MODULES || {})['lending-marketplace'];
  if(!m) return '#';
  return '../' + m.dir + '/' + m.file + (hash || '');
}
function backToPlaza(text){
  return '<div class="ls-back"><a class="btn" href="' + lsHref('#/plaza') + '">← ' +
    E(text || '返回融资需求广场') + '</a></div>';
}

/* ---- 招牌件 A：授信尺 —— AC-CR-03 的可视化读数（机构 × 资产方维度）----
   段序与不等式左端同序：授信占用额 → 在途报价金额 → 本次报价 → 可用授信。
   本次报价超出可用授信时，超出部分单列为 over 段，缺口在尺上一眼可见。 */
function creditBar(c, mini){
  var limit = c.limit || 1;
  var fit  = Math.min(c.need, c.avail);                     /* 本次报价中额度装得下的部分 */
  var over = Math.max(0, round2(c.need - c.avail));
  var free = Math.max(0, round2(c.avail - fit));
  var scale = Math.max(limit, round2(c.used + c.fly + c.need)) * 1.03 || 1;
  var pc = function(v){ return (v / scale * 100).toFixed(3); };
  var capPct = (limit / scale * 100);
  var sg = '';
  if(c.used > 0) sg += '<div class="sg used" style="width:' + pc(c.used) + '%"></div>';
  if(c.fly  > 0) sg += '<div class="sg fly"  style="width:' + pc(c.fly)  + '%"></div>';
  if(fit    > 0) sg += '<div class="sg now"  style="width:' + pc(fit)    + '%"></div>';
  if(free   > 0) sg += '<div class="sg free" style="width:' + pc(free)   + '%"></div>';
  if(over   > 0) sg += '<div class="sg over" style="width:' + pc(over)   + '%"></div>';
  var shift = capPct > 78 ? 'transform:translateX(-100%);padding-right:4px' : 'transform:translateX(-50%)';
  return '<div class="cq-crbar' + (mini ? ' mini' : '') + '"><div class="wrap">' +
    '<div class="track" role="img" aria-label="授信尺：授信额度 ' + amt(limit) + ' USD，授信占用额 ' + amt(c.used) +
      ' USD，在途报价金额 ' + amt(c.fly) + ' USD，本次报价金额 ' + amt(c.need) + ' USD，可用授信 ' + amt(c.avail) + ' USD">' +
      sg + '</div>' +
    '<div class="cap" style="left:' + capPct.toFixed(3) + '%"></div>' +
    (mini ? '' : '<div class="caplb" style="left:' + capPct.toFixed(3) + '%;' + shift + '">授信额度 ' + amt(limit) + '</div>') +
    '</div>' + (mini ? '' :
    '<div class="lg"><span><i class="cap"></i>授信额度 <b>' + amt(limit) + '</b></span>' +
    '<span><i class="used"></i>授信占用额 <b>' + amt(c.used) + '</b></span>' +
    '<span><i class="fly"></i>在途报价金额 <b>' + amt(c.fly) + '</b></span>' +
    (c.need > 0 ? '<span><i class="now"></i>本次报价金额 <b>' + amt(c.need) + '</b></span>' : '') +
    '<span><i class="free"></i>可用授信 <b>' + amt(c.avail) + '</b></span>' +
    (over > 0 ? '<span><i class="over"></i>差额 <b>' + amt(over) + '</b></span>' : '') + '</div>') +
  '</div>';
}
/* 不等式一行：把 AC-CR-03 摆成可读的算式，各项与尺上的段同色，结论在行尾 */
function creditEq(c){
  return '<div class="cq-eq">' +
    '<span class="t used">' + amt(c.used) + '</span><span class="op">＋</span>' +
    '<span class="t fly">' + amt(c.fly) + '</span><span class="op">＋</span>' +
    '<span class="t now">' + amt(c.need) + '</span><span class="op">＝</span>' +
    '<span>' + amt(round2(c.used + c.fly + c.need)) + '</span>' +
    '<span class="op">' + (c.pass ? '≤' : '＞') + '</span>' +
    '<span class="t cap">' + amt(c.limit) + '</span>' +
    '<span class="vd ' + (c.pass ? 'pass' : 'fail') + '">' + (c.pass ? '通过' : '不通过 · 差额 ' + amt(c.gap)) + '</span>' +
  '</div>' +
  '<p class="hint">授信占用额（未偿本金）＋ 在途报价金额 ＋ 本次报价金额（折 ' + CCY + '）≤ 授信额度 —— AC-CR-03 修正式。' +
  '前两项之和是<b>授信已用额</b> ' + amt(c.usedTotal) + '，它是两者的合称，不单独存储、不作为第四个量展示。</p>';
}

/* ---- 招牌件 B：两道闸门牌（AC-FIN-07 / AC-CR-22 / D-CR-21）----
   两道相互独立、必须同时通过。失败提示必须能被用户区分开：
   担保不足是资产方要解决的事，授信不足是机构自己要解决的事。 */
function gates(p, c, g){
  function gate(cls, name, num, formula, who){
    return '<div class="cq-gate ' + cls + '"><div class="gh">' + E(name) +
      '<span class="st">' + (cls === 'pass' ? '通过' : cls === 'soft' ? '需先处理' : '不通过') + '</span></div>' +
      '<div class="fm">' + formula + '</div>' +
      '<div class="who">' + who + '</div></div>';
  }
  var gOk = g.pass;
  var cCls = c.pass ? 'pass' : 'soft';    /* 授信不足不是 ⊘、不是报错，进入授信步骤（AC-CR-06） */
  return '<div class="cq-gates">' +
    gate(gOk ? 'pass' : 'fail', '担保闸门 · 项目维度',
      null,
      '判据 <b>融资上限 − 项目融资余额 − 更早已保留需求金额合计 &lt; 本笔需求金额 ⇒ 失效</b><br>' +
      amt(g.cap) + ' − ' + amt(g.bal) + ' − ' + amt(g.earlier) + ' ＝ <b>' + amt(g.head) + '</b>　' +
      (gOk ? '≥' : '&lt;') + '　本笔需求 <b>' + amt(g.need) + '</b>',
      gOk ? '管"这个<b>池子</b>还撑不撑得住这笔需求"。本判据由服务端在提交时刻<b>实时重算</b>，不吃缓存（AC-CR-20）。'
          : '这是<b>资产方</b>要解决的事：补足质押后重新发布。机构做什么都改变不了它。') +
    gate(cCls, '授信闸门 · 机构 × 资产方维度',
      null,
      '判据 <b>授信占用额 ＋ 在途报价金额 ＋ 本次报价金额 ≤ 授信额度</b><br>' +
      amt(c.used) + ' ＋ ' + amt(c.fly) + ' ＋ ' + amt(c.need) + ' ＝ <b>' + amt(round2(c.used + c.fly + c.need)) +
      '</b>　' + (c.pass ? '≤' : '＞') + '　额度 <b>' + amt(c.limit) + '</b>' +
      (c.pass ? '' : '<br>差额 <b>' + amt(c.gap) + '</b>'),
      c.pass ? '管"这家<b>机构</b>还能不能借给这家资产方"。额度是机构自己的风险决策，平台本期不介入。'
             : '这是<b>机构自己</b>能解决的事：在下面的授信步骤里补足额度即可继续，<b>不是报错、不是被拒</b>。') +
  '</div>' +
  '<p class="hint">两道<b>相互独立、必须同时通过</b>（AC-FIN-07 / AC-CR-22）。前端隐藏或置灰不构成校验，' +
  '准入以提交时刻的服务端实时重算为准。</p>';
}

/* ---- 招牌件 C：锁定倒计时（D-LS-13 / AC-LS-85 / FD-13 + QT-13）----
   四件事一个不少：被谁锁定 / 从什么时候开始 / 已锁定多久 / 还剩多久；并给两条出路。
   条上两段相加恒为 168 小时 —— 这条恒等式在屏幕上可以直接核。
   业务离开 S-FD-1 后整块不渲染（D-CR-28：计时终止，不再显示倒计时）。 */
function countdown(deal, forAsset){
  var k = quoteClock(deal);
  if(!k.live) return '';
  var pctHeld = (k.heldMin / (QUOTE_HOURS * 60) * 100).toFixed(2);
  var pctLeft = (100 - pctHeld).toFixed(2);
  return '<div class="cq-cd' + (k.soon ? ' soon' : '') + '">' +
    '<div class="by">被 <b>' + E(deal.fund) + '</b> 锁定，自 <b>' + withTz(deal.at) + '</b> 起，' +
      '已锁定 <b>' + fmtDur(k.heldMin) + '</b>。</div>' +
    '<div class="big"><span class="v">' + fmtDur(k.leftMin) + '</span>' +
      '<span class="u">后自动失效　·　到期时刻 ' + withTz(k.to) + '</span></div>' +
    '<div class="bar" role="img" aria-label="报价有效期 168 小时：已锁定 ' + fmtDur(k.heldMin) +
      '，剩余 ' + fmtDur(k.leftMin) + '">' +
      '<div class="el" style="width:' + pctHeld + '%"></div>' +
      '<div class="rm" style="width:' + pctLeft + '%"></div></div>' +
    '<div class="scale"><span>提交 <b>' + withTz(deal.at) + '</b></span>' +
      '<span>已锁定 <b>' + fmtDur(k.heldMin) + '</b> ＋ 剩余 <b>' + fmtDur(k.leftMin) + '</b> ≡ <b>' +
      QUOTE_HOURS + ' 小时</b></span></div>' +
    (k.soon ? '<p class="hint" style="color:var(--warn)">剩余不足 24 小时，倒计时已切到分钟精度。' +
      '到点即失效，由系统自动执行、不依赖任何人登录；无展期、无宽限期。</p>' : '') +
    '<div class="ways">' +
      (forAsset
        ? '<div class="w"><i>①</i><span>您可以<b>随时拒绝</b>该报价，需求将立即回到可被报价的状态，在途报价金额全额释放。</span></div>' +
          '<div class="w"><i>②</i><span>若 <b>' + fmtDur(k.leftMin) + '</b> 内未处理，该报价将<b>自动失效</b>、需求自动放开，后果与拒绝完全相同（AC-CR-15）。</span></div>'
        : '<div class="w"><i>①</i><span>资产方可<b>随时拒绝</b>，需求随即回到可被报价的状态。</span></div>' +
          '<div class="w"><i>②</i><span>若 <b>' + fmtDur(k.leftMin) + '</b> 内未处理，报价<b>自动失效</b>、需求自动放开，占用的授信全额释放。</span></div>') +
    '</div></div>';
}

/* ---- 三占用对照：5.1 表的页面形态，D-CR-18 命名红线的落点 ----
   本模块最容易翻车的地方：三个量分属两个维度、由不同动作触发。
   高亮那一格是本次动作真正会改变的量。 */
function threeQuantities(p, c, thisAmt){
  function box(on, nm, dim, v, ch){
    return '<div class="q' + (on ? ' on' : '') + '"><div class="nm">' + nm + '</div>' +
      '<div class="dm">' + dim + '</div><div class="v">' + v + '</div><div class="ch">' + ch + '</div></div>';
  }
  return '<div class="cq-three">' +
    box(false, '项目在途金额', '项目维度 · FP-14', amt(p.fly),
      '<b>本次不变。</b>唯一来源是资产方发布需求时的发布占用，报价环节不新增（AC-FIN-23）。') +
    box(true, '在途报价金额', '机构 × 资产方维度 · CR-09', amt(c.fly) + ' → ' + amt(round2(c.fly + thisAmt)),
      '<b>本次 +' + amt(thisAmt) + '。</b>报价提交成功的同一时刻产生，拒绝 / 失效时全额释放。') +
    box(false, '授信占用额', '机构 × 资产方维度 · CR-08', amt(c.used),
      '<b>本次不变。</b>它的定义是未偿本金，报价时钱还没放出去，不存在本金（D-CR-16）。') +
  '</div>' +
  '<p class="hint">把「在途报价金额」和「授信占用额」混为一谈，会在报价环节把同一笔钱扣两次；' +
  '把「在途报价金额」和「项目在途金额」混为一谈，会让可融金额凭空少一半。' +
  '三个量一律用全名，界面不出现无限定词的"占用""在途"。</p>';
}

/* ================================================================
   WS-327 增量：初始还款计划（试算版）与日期重算告知
   PRD 分册 6.6.4：P-LS-06 接受页新增初始还款计划表（D-RP-04）+ 日期重算告知（D-RP-07），
   告知的展示事实与展示时间留痕为 FD-28，**只留痕、不要求勾选**（同 D-FIN-103 的处理）。

   口径全部来自 WS-327，本模块只是把那张表摆在资产方**接受报价之前**能看到的地方：
     基准日 ＝ 预计放款日 ＝ QT-09 报价提交日（D-RP-04）；
     期次边界 ＝ 自基准日起每 3 个自然月一个付息日，严格早于融资到期日的各成一期利息期，
                 末期应还日恒为融资到期日、还该期利息 + 全部本金；
                 最后一个付息日与到期日之间不足 3 个月时该段并入末期（D-RP-13 / D-RP-14）；
     利息 ＝ 融资金额 × 年化利率 × 本期计息天数 ÷ 360，算头不算尾（D-RP-17 ～ D-RP-20）。
   **不落库、不占号、不产生期次对象**（D-RP-05）：它是一张按当前 QT-* 实时算出来的表，
   报价被拒绝、失效或终止时随之消失。真实系统里这张表由服务端算并下发，
   这里就地算一遍只是为了让原型上的每一个数都能被逐项核对。
   ================================================================ */
function rpDMs(x){ var q = String(x).slice(0,10).split('-'); return Date.UTC(+q[0], +q[1]-1, +q[2]); }
function rpDStr(ms){ var x = new Date(ms), z = function(n){ return (n<10?'0':'')+n; };
  return x.getUTCFullYear() + '-' + z(x.getUTCMonth()+1) + '-' + z(x.getUTCDate()); }
function rpAddMonths(x, n){
  var q = String(x).slice(0,10).split('-'), y = +q[0], m = +q[1]-1, d = +q[2], t = m + n;
  var ny = y + Math.floor(t/12), nm = ((t%12)+12)%12;
  var last = new Date(Date.UTC(ny, nm+1, 0)).getUTCDate();
  return rpDStr(Date.UTC(ny, nm, Math.min(d, last)));
}
function rpDays(a, b){ return Math.round((rpDMs(b) - rpDMs(a)) / 86400000); }
function initialPlan(t0, tn, principal, ratePct, fxV){
  var marks = [], k = 1, nx;
  while(true){ nx = rpAddMonths(t0, 3*k); if(rpDMs(nx) < rpDMs(tn)){ marks.push(nx); k++; } else break; }
  if(marks.length && rpDMs(rpAddMonths(marks[marks.length-1], 3)) > rpDMs(tn)) marks.pop();
  var bounds = [t0].concat(marks, [tn]), out = [];
  for(var i = 1; i < bounds.length; i++){
    var from = bounds[i-1], due = bounds[i], n = rpDays(from, due), last = (i === bounds.length-1);
    var interest = round2(principal * (ratePct/100) * n / 360);
    var pri = last ? principal : 0, total = round2(pri + interest);
    out.push({ seq:i, from:from, due:due, days:n, principal:pri, interest:interest,
               total:total, settle:round2(total / fxV), last:last });
  }
  return out;
}
/* 初始还款计划卡：整表带「预计 · 未生效」、日期列名带「预计」、表下常驻重算告知——
   三处缺一不可（D-RP-06）。反向验收 AC-RP-01：本卡内提到这张表与表上的日期时一律带限定词。 */
function initialPlanCard(deal, p){
  var base = String(deal.at).slice(0, 10);          /* 预计放款日 ＝ QT-09 报价提交日 */
  var tn   = p.expiresAt;                            /* 融资到期日取该项目 FP-09 有效期至（D-RP-12）*/
  if(!tn) return '';
  var plan = initialPlan(base, tn, deal.amt, deal.rate, deal.fx.v);
  var sumP = 0, sumI = 0, sumT = 0;
  var rows = plan.map(function(x){
    sumP += x.principal; sumI += x.interest; sumT += x.total;
    return '<tr><td class="mono">第 ' + x.seq + ' 期' +
      (x.last ? '<div class="cell-sub">含本金 · 到期还本付息</div>' : '') + '</td>' +
      '<td class="mono">' + x.due + (x.last ? '<div class="cell-sub">恒等于融资到期日</div>' : '') + '</td>' +
      '<td class="mono">' + x.from + ' ~ ' + x.due + '<div class="cell-sub">' + x.days + ' 天' +
        (x.last && x.days > 92 ? ' · 末期并入不足 3 个月的尾段' : '') + '</div></td>' +
      '<td class="mono num">' + (x.principal ? amt(x.principal) : '0.00') + '</td>' +
      '<td class="mono num">' + amt(x.interest) + '</td>' +
      '<td class="mono num"><b>' + amt(x.total) + '</b></td>' +
      '<td class="mono num">' + amt(x.settle) + ' ' + deal.ccy + '</td>' +
      '<td><span class="pill dash">预计 · 未生效</span></td></tr>';
  }).join('');
  return '<div class="card" style="margin-top:16px">' +
    cardHead('初始还款计划（试算版）',
      '<span class="faint">WS-327 F-LS-60 · 整表预计 · 未生效 · 公开字段</span>') +
    '<div class="card-b">' +
    CF.note('',
      '<b class="ls-b">这张表整表未生效。</b>它按<b class="ls-b">预计放款日 ' + base +
      '</b>（＝ 本次报价提交日）试算：报价提交那一刻商务条款固化、汇率快照锁定，' +
      '用同一时刻做基准，双方看到的是同一套数。' +
      '<p><b class="ls-b">实际还款日将在放款确认后按实际放款日重算并定稿，届时以定稿计划为准；' +
      '每期金额的计算规则不变。</b>变的只有日期，以及由日期派生的天数与利息——' +
      '公式、年化利率、本金、期次边界规则一个都不会变（WS-327 D-RP-06 / D-RP-07）。</p>' +
      '<p>本表<b class="ls-b">不落库、不占号、不产生期次对象</b>：您拒绝报价或报价有效期届满时，' +
      '它随之消失、不留残留期次。</p>', '预计 · 未生效') +
    '<div class="tablewrap" style="margin-top:14px"><table class="tbl wide ls-tbl">' +
    '<thead><tr><th>期次</th><th>预计还款日</th><th>计息区间与天数</th><th>应还本金</th>' +
      '<th>应还利息</th><th>应还合计</th><th>结算金额</th><th>版本</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>' +
    '<div class="rows" style="box-shadow:none;margin-top:14px">' +
      '<div class="row"><div class="row-main"><div class="row-k">计息规则</div>' +
      '<div class="row-v mono" style="font-size:12px;color:var(--muted)">' +
      '年化单利，实际天数 ÷ 360，起息日计息、应还日不计息；起息日 = ' + base + '（预计放款日）' +
      '</div></div></div>' +
      '<div class="row"><div class="row-main"><div class="row-k">还款方式</div>' +
      '<div class="row-v">先息后本 · 到期还本付息，利息每 3 个月一期' +
      '<div class="cell-sub">本期硬编码、只读展示，界面不提供可选项</div></div></div></div>' +
      '<div class="row"><div class="row-main"><div class="row-k">合计（仅 ' + CCY + ' 记账口径）</div>' +
      '<div class="row-v mono">本金 ' + amt(sumP) + '　利息 ' + amt(sumI) + '　合计 ' + amt(sumT) +
      '<div class="cell-sub">结算币种金额不参与任何合计——跨币种不得求和</div></div></div></div>' +
    '</div>' +
    '<p class="hint" style="margin-top:12px"><b>本期不支持提前还款</b>：还本金只发生在融资项目到期之后，' +
    '每期的还款入口在该期应还日前 3 个自然日开启，逐期开窗、不可跨期合并。' +
    '本卡的展示事实与展示时间在您接受报价时<b>留痕（FD-28）</b>，' +
    '<b>只留痕、不要求您勾选确认</b>——它是平台尽到告知义务的证据，' +
    '定稿后若对日期有疑问，这条留痕可以拿出来对账。</p>' +
    '</div></div>';
}

/* ---- 商务条款摘要（D-FIN-87）：九项，与 QT-* / FD-* 的存值逐项一致（AC-LS-88） ---- */
function termsSummary(deal, p, printable){
  var fx = deal.fx, settle = round2(deal.amt / fx.v);
  var rows = [
    ['融资业务编号', deal.id],
    ['资金方企业主体', deal.fund],
    ['资产方企业主体', deal.party],
    ['融资项目编号', p.id + '（' + p.name + '）'],
    ['融资金额', money(deal.amt, CCY)],
    ['结算币种与结算金额', money(settle, deal.ccy)],
    ['所用汇率快照', fx.v.toFixed(4) + '　生效 ' + withTz(fx.at) + '　来源 ' + fx.src + '　版本 ' + fx.ver],
    ['年化利率', deal.rate.toFixed(2) + '%'],
    ['抵押物概况', p.tokens + ' 张' + p.assetType + '代币 · 有效质押价值 ' + usd(p.valid)],
    ['报价提交时间', withTz(deal.at)]
  ];
  return '<div class="cq-sum"><div class="sh">商务条款摘要' +
    '<span class="no">本摘要不是合同，不产生法律效力</span></div>' +
    '<div class="sb">' + rows.map(function(r){
      return '<div class="kk"><s>' + E(r[0]) + '</s><b>' + E(r[1]) + '</b></div>';
    }).join('') +
    '<div class="kk"><s>跨境手续费承担方</s><b>资产方（' + E(deal.party) + '）</b></div>' +
    '<div class="kk"><s>本金计量口径</s><b>按融资金额 ' + amt(deal.amt) + ' ' + CCY + ' 计，不按实收计</b></div>' +
    '</div>' +
    (printable ? '<div class="sf cq-noprint">' +
      '<button class="btn sm" type="button" data-act="cq.copy">复制全文</button>' +
      '<button class="btn sm" type="button" data-act="cq.print">打印 / 存为 PDF</button>' +
      '<p class="hint">它的作用是让线下合同里的数字与平台记录一致，避免放款和还款时两边对不上。' +
      '<b>本期平台不生成融资合同</b>，合同由双方在平台外自行拟定与签署。</p></div>' : '') +
  '</div>';
}

/* ---- 页头（沿用 WS-324 的面客详情页版式） ---- */
function phead(kick, title, sub, tags, amtBlock){
  return '<div class="ls-phead"><div class="tile" aria-hidden="true">◎</div><div class="body">' +
    '<p class="kick">' + kick + '</p>' +
    '<h1>' + E(title) + (sub ? '<em>' + E(sub) + '</em>' : '') + '</h1>' +
    (tags ? '<div class="ls-tags">' + tags + '</div>' : '') +
  '</div>' + (amtBlock || '') + '</div>';
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
    (extra && extra.min ? ' min="' + extra.min + '"' : '') +
    (extra && extra.attr ? ' ' + extra.attr : '') +
    ' data-act="cq.f" data-v="' + key + '">';
}
function ro(text, note){
  return '<div class="ls-ro">' + E(text) + '</div>' + (note ? '<p class="hint">' + note + '</p>' : '');
}
/* 不产生链上操作的常驻页脚（6.1.2 费用提示；避免机构误以为要签名付费） */
function noChainFoot(what){
  return '<p class="hint" style="margin-top:14px">' + E(what) +
    '<b>不产生任何链上操作、不消耗 gas、不需要唤起签名 SDK</b>。' +
    '本模块全部动作都发生在平台内：授信核定、报价、接受与拒绝都只改平台侧的额度与状态，链上动作只发生在质押与提取（WS-324）。</p>';
}
/* 动作按钮：区分「不可见」与「可见不可点 ⊘ + 原因」（H-03） */
function actBtn(a, cls){
  if(a.enabled)
    return '<button class="btn ' + (cls||'') + '" type="button" data-act="cq.do" data-v="' + a.key + '">' + E(a.label) + '</button>';
  return '<button class="btn blocked ' + (cls||'').replace('primary','') + '" type="button" aria-disabled="true" ' +
    'title="' + E(a.reason) + '" data-act="cq.why" data-v="' + a.key + '">⊘ ' + E(a.label) + '</button>' +
    '<div class="ls-why"><span class="sg" aria-hidden="true">⊘</span><span>' + E(a.reason) + '</span></div>';
}
/* 加载 / 失败 / 不存在三态外壳，各页共用（H-02：不报 404、不白屏、不静默跳首页） */
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


/* ================================================================
   Part D —— P-LS-04 授信核定（报价的前置步骤）
   四个分支 ①无额度新建 / ②额度不足追加 / ③已到期重新核定 / ④充足则不出现该步，
   走同一个页面、同一条流程，只有表单模式与文案不同（AC-CR-05）。
   ================================================================ */
var BRANCH = {
  'new'  :{ t:'新建授信',   lb:'授信额度（总额）', verb:'核定',     n:'①' },
  'topup':{ t:'追加额度',   lb:'本次增加额',       verb:'追加',     n:'②' },
  'renew':{ t:'重新核定',   lb:'授信额度（总额）', verb:'重新核定', n:'③' }
};

/* 授信表单当前录入值的解析与校验（字段级口径在分册 7.1 CR-*） */
function creditForm(c, p){
  var b = c.branch;
  var raw = S.cr.amtRaw;
  if(raw === null || raw === undefined){
    /* 默认值：新建 / 重新核定带出刚好覆盖本次报价的整额；追加带出差额。机构可改。 */
    raw = b === 'topup' ? String(c.gap) : String(round2(Math.max(c.need, c.limit)));
  }
  var val = parseFloat(String(raw).replace(/,/g, ''));
  var minDate = addYears(dayOnly(NOW), CR_MIN_YEARS);
  var maxDate = addYears(dayOnly(NOW), CR_MAX_YEARS);
  var until = S.cr.until;
  if(until === null || until === undefined)
    until = b === 'topup' ? (c.cr ? c.cr.until : minDate) : minDate;   /* 默认 = 下限；追加不填则保持原值 */
  var after = b === 'topup' ? round2(c.limit + (val > 0 ? val : 0)) : round2(val > 0 ? val : 0);
  var err = null;
  if(!(val > 0))
    err = '请填写有效的' + BRANCH[b].lb + '：必须大于 ' + usd(0) + '，精度为 ' + CCY + ' 2 位小数。';
  else if(b !== 'topup' && after < c.usedTotal)
    err = '授信额度不得低于已用额。本期额度<b>只增不减</b>（D-CR-12 / X-LS-15）：当前授信已用额 <span class="mono">' +
          usd(c.usedTotal) + '</span>，填写值 <span class="mono">' + usd(after) + '</span> 低于它。';
  /* 有效期下限硬校验，不提供"我知道风险仍要提交"的绕过项（D-CR-19） */
  var dErr = null;
  if(b !== 'topup' && tmin(until) < tmin(minDate))
    dErr = '有效期不得早于 <b>' + minDate + '</b>（核定日 + ' + CR_MIN_YEARS +
           ' 年，需求方 08:51 裁定 8）。这是规则不是建议，<b>没有绕过项</b>；最早可选日期即 ' + minDate + '。';
  else if(tmin(until) > tmin(maxDate))
    dErr = '有效期不得晚于 <b>' + maxDate + '</b>（核定日 + ' + CR_MAX_YEARS + ' 年）。上限的作用是保证' +
           '"机构重新审视这家资产方"的机会一定会到来 —— 本期额度只增不减、无调低无冻结，' +
           '到期后的重新核定是唯一一次重新评估的入口。';
  else if(b === 'topup' && c.cr && tmin(until) < tmin(c.cr.until))
    dErr = '追加时<b>只能往后延，不能提前</b>（D-CR-20）。当前有效期至 <b>' + c.cr.until +
           '</b>，新值不得早于它 —— 提前到期等于变相调低这条额度的存续期，而额度的主动调低本期明确不做，' +
           '且调低不向资产方推送，机构单方面提前会直接砍掉资产方的融资通道而对方毫无感知。';
  return { b:b, raw:raw, val:val, after:after, until:until, minDate:minDate, maxDate:maxDate,
           err:err, dErr:dErr, ok:(!err && !dErr) };
}

function pageCredit(){
  var p = findProject(S.pid);
  if(S.role !== 'fund')
    return failCard('授信核定', '无权访问',
      '授信核定是报价流程内的一步，只对<b>已登录的资金方企业主体</b>开放。当前身份为「' + E(ACTORS[S.role].full) + '」。' +
      '授信额度属于机构的内部风险决策，资产方在自己的控制台只能<b>只读</b>看到各机构对本企业的额度与已用额（WS-328），' +
      '看不到备注，也看不到该企业在其他机构的授信情况。',
      '<a class="btn primary" href="' + lsHref('#/plaza') + '">返回融资需求广场</a>');
  if(!p) return failCard('授信核定', '内容不存在或无权访问',
      '授信步骤由进入时的融资项目决定授信对象，没有独立入口、没有独立锚点（D-LS-15 / D-LS-16）。' +
      '请从广场的「立即报价」进入。',
      '<a class="btn primary" href="' + lsHref('#/plaza') + '">返回融资需求广场</a>');
  if(S.st === 'loading') return skel('授信核定');
  if(S.st === 'error') return failCard('授信核定', '授信信息加载失败',
      '服务端未返回本机构对该资产方的授信额度与已用额。这不影响已生效的额度与在途业务，可重试。');

  /* 授信步骤是报价流程内的一步：报价这件事本身不成立时，这一步也不该出现（AC-CR-06 的前提）。
     落到报价页的说明态，由它逐种给出可区分的原因。 */
  if(!actionOf(availableActions(p, 'fund'), 'quote').enabled){ S.page = 'P-LS-05'; return pageQuote(); }
  var c = creditCheck(p.entity, p.demand);
  var g = guaranteeCheck(p);
  /* 分支④：充足则不出现该步 —— 直接回到报价表单，不做成一个"恭喜通过"页 */
  if(c.branch === 'enough'){ S.page = 'P-LS-05'; CF.syncURL(); return pageQuote(); }
  var f = creditForm(c, p);
  var bm = BRANCH[f.b];

  /* 为什么会走到这里（AC-CR-10）：三种情形各有说明，不得只显示一个空表单 */
  var why;
  if(f.b === 'new'){
    why = '<div class="cq-why"><div class="bd"><b>本机构尚未对该资产方核定授信额度</b>' +
      '<p>授信额度是<b>机构 × 资产方企业二元组</b>上的一条独立记录，与任何单个融资项目无关 —— ' +
      '核定一次之后，您对 ' + E(p.owner) + ' 的<b>所有</b>融资项目都用这一条额度，不必逐个项目重复核定。</p></div>' +
      '<div class="nums"><div class="n"><div class="k">本次报价金额</div><div class="v">' + amt(c.need) + '</div></div>' +
      '<div class="n"><div class="k">当前可用授信</div><div class="v">—</div></div></div></div>';
  } else if(f.b === 'topup'){
    why = '<div class="cq-why"><div class="bd"><b>额度生效中，但不足以覆盖本次报价</b>' +
      '<p>差额必须在您填任何一个报价字段之前就告知（AC-CR-06）—— 点「立即报价」的那一刻服务端已经算得出结论，' +
      '不会让您填完币种、利率、账户再拒绝。可以只追加一部分，但本次报价须在追加后仍然通过 AC-CR-03。</p></div>' +
      '<div class="nums"><div class="n"><div class="k">本次报价金额</div><div class="v">' + amt(c.need) + '</div></div>' +
      '<div class="n"><div class="k">当前可用授信</div><div class="v">' + amt(c.avail) + '</div></div>' +
      '<div class="n gap"><div class="k">差额</div><div class="v">' + amt(c.gap) + '</div></div></div></div>';
  } else {
    why = '<div class="cq-why"><div class="bd"><b>原授信额度已到期，需重新核定</b>' +
      '<p>原额度 <span class="mono">' + amt(c.cr.limit) + ' ' + CCY + '</span>，有效期至 <b>' + c.cr.until +
      '</b>，已于当日转 <b>S-CR-2 已到期</b>。到期额度<b>视同无额度</b>，不存在"再顶一次"的宽限（AC-CR-07）；' +
      '但到期<b>不释放已有占用</b> —— 钱还没还，债务就还在（D-CR-13）。' +
      '重新核定生成新的有效期，下限按<b>重新核定日</b>重算，历史留痕不覆盖。</p></div>' +
      '<div class="nums"><div class="n"><div class="k">本次报价金额</div><div class="v">' + amt(c.need) + '</div></div>' +
      '<div class="n"><div class="k">上一版额度</div><div class="v">' + amt(c.cr.limit) + '</div></div></div></div>';
  }

  var head = backToPlaza() + phead(
    '授信核定 · <span class="mono">P-LS-04</span> · 报价的前置步骤 · ' + bm.n + ' ' + bm.t,
    bm.t, null,
    pill('', '分支 ' + bm.n + ' · ' + bm.t) +
      pill(c.alive ? TONE[CR_STATUS[c.cr.st].tone] : 'gray',
           c.cr ? 'S-CR-' + (c.cr.st === 'S-CR-1' ? '1 生效中' : '2 已到期') : '无授信记录') +
      pill('gray', '提交即生效 · 无审批流') + pill('gray', '本步骤无链上操作'),
    amtBlock('本次报价金额', amt(c.need), CCY,
      '恒等于该需求金额，不可修改（D-FIN-19）')) + CF.pageStates();

  /* 授信对象只读带出，由进入时的项目决定，不可选择、不可修改（CR-03） */
  var form =
    '<div class="card">' + cardHead('授信对象', '<span class="faint">CR-02 / CR-03 · 只读带出</span>') +
    '<div class="card-b">' +
      '<div class="ls-kgrid">' +
        '<div><div class="k">资金方企业主体 · CR-02</div><div class="v" style="font-family:var(--sans)">' +
          E(ACTORS.fund.full) + '</div><div class="x">取当前会话的企业主体标识</div></div>' +
        '<div><div class="k">资产方企业主体 · CR-03</div><div class="v" style="font-family:var(--sans)">' +
          E(p.owner) + '</div><div class="x">由进入时的融资项目决定，不可选择、不可修改</div></div>' +
        '<div><div class="k">触发来源项目</div><div class="v">' + p.id + '</div>' +
          '<div class="x">只作留痕（CR-13），额度本身与该项目无关</div></div>' +
        '<div><div class="k">授信额度编号 · CR-01</div><div class="v">' + (c.cr ? c.cr.id : '提交后生成') +
          '</div><div class="x">首次核定时生成，全局唯一且终身稳定</div></div>' +
      '</div>' +
      '<p class="hint" style="margin-top:12px">一个「资金方 × 资产方」二元组<b>有且只有一条</b>授信额度记录。' +
      '"机构 × 资产方 × 项目"三元组的读法已正式作废 —— 那会让机构对单一资产方的总敞口失去上限，' +
      '而总敞口控制正是授信这个概念存在的目的。</p>' +
    '</div></div>' +

    '<div class="card" style="margin-top:16px">' + cardHead(bm.lb,
      '<span class="faint">CR-05 · ' + (f.b === 'topup' ? '填增加额，不是新总额' : 'USD，> 0，2 位小数') + '</span>') +
    '<div class="card-b">' +
      field(bm.lb, CCY,
        inp('crAmt', f.raw, f.b === 'topup' ? '例如 ' + amt(c.gap) : '例如 ' + amt(c.need), { err:!!f.err }),
        f.b === 'topup'
          ? '追加的输入是<b>增加额</b>而不是新的总额 —— 填"新总额"会让一次手滑就把额度改小，而调低本期根本不该发生。'
          : '本期只允许调高，<b>不允许调低、冻结、解冻</b>；界面没有这三个入口。') +
      (f.err ? '<div class="ls-alert">' + CF.note('red', f.err, '额度校验不通过') + '</div>' : '') +
      '<div class="cq-delta">' +
        '<div class="c"><div class="k">当前额度</div><div class="v">' + amt(c.limit) + '</div></div>' +
        '<div class="ar" aria-hidden="true">→</div>' +
        '<div class="c to"><div class="k">' + (f.b === 'topup' ? '追加后额度' : '核定后额度') + '</div>' +
          '<div class="v">' + amt(f.after) + '</div></div>' +
        '<div class="sp" style="width:1px;height:22px;background:var(--border-strong)"></div>' +
        '<div class="c"><div class="k">授信已用额</div><div class="v">' + amt(c.usedTotal) + '</div></div>' +
        '<div class="c"><div class="k">' + bm.verb + '后可用授信</div><div class="v">' +
          amt(Math.max(0, round2(f.after - c.usedTotal))) + '</div></div>' +
      '</div>' +
      (f.ok && round2(f.after - c.usedTotal) >= c.need
        ? '<p class="hint" style="color:var(--ok);margin-top:10px">' + bm.verb + '后可用授信 ' +
          amt(round2(f.after - c.usedTotal)) + '，已可覆盖本次报价 ' + amt(c.need) + '。' +
          '提交后会自动回到报价表单并<b>重跑两道校验</b>，不需要您手动返回。</p>'
        : f.ok
          ? '<p class="hint" style="color:var(--warn);margin-top:10px">' + bm.verb + '后可用授信 ' +
            amt(round2(f.after - c.usedTotal)) + '，仍不足本次报价 ' + amt(c.need) + '（差 ' +
            amt(round2(c.need - (f.after - c.usedTotal))) + '）。可以只' + bm.verb +
            '一部分并保留额度，但本次报价会在重跑 AC-CR-03 时回到这一步。</p>' : '') +

      field('有效期至', f.b === 'topup' ? '选填 · 不动则保持原值' : '必填 · CR-07',
        inp('crUntil', f.until, '', { type:'date', err:!!f.dErr, attr:'min="' + (f.b === 'topup' && c.cr ? c.cr.until : f.minDate) + '" max="' + f.maxDate + '"' }),
        f.b === 'topup'
          ? '当前有效期至 <b>' + (c.cr ? c.cr.until : '—') + '</b>。追加时可顺带延长，<b>只能往后、不能提前</b>，' +
            '且<b>不受 1 年下限约束</b> —— 下限只约束"设定有效期"的两个动作（首次核定、到期后重新核定）。'
          : '下限 <b>' + f.minDate + '</b>（核定日 + ' + CR_MIN_YEARS + ' 年，默认值即下限）· 上限 <b>' + f.maxDate +
            '</b>（核定日 + ' + CR_MAX_YEARS + ' 年）。默认取下限是因为它是最短也最保守的一档，要更长自己往后调，' +
            '比反过来更不容易出错。') +
      (f.dErr ? '<div class="ls-alert">' + CF.note('red', f.dErr, '有效期校验不通过') + '</div>' : '') +

      field('备注', '选填 · ≤ 200 字 · 仅本机构可见',
        '<textarea class="inp" rows="2" maxlength="200" placeholder="机构内部的风险判断，不对资产方展示" ' +
        'data-act="cq.f" data-v="crMemo">' + E(S.cr.memo || '') + '</textarea>',
        '它是机构的内部风险判断，<b>不对资产方展示</b>（CR-12）。资产方在控制台只看得到额度与已用额。') +

      '<div class="btnbar"><button class="btn primary" type="button" ' + (f.ok ? '' : 'disabled ') +
        'data-act="cq.crSubmit">提交并继续报价</button>' +
        '<a class="btn" href="' + lsHref('#/plaza') + '">放弃本次报价</a></div>' +
      '<p class="hint"><b>提交即生效</b>，无平台审核、无多级风控 —— 授信是机构自己的风险决策，平台本期不介入。' +
      '与报价<b>解耦</b>：授信成功后即便放弃报价，额度照常保留；报价提交失败也不回滚额度。</p>' +
      noChainFoot('授信核定') +
    '</div></div>';

  /* 右栏：授信尺 + 当前额度读数 + 留痕 */
  var rail = '<aside class="portal-rail">' +
    '<div class="card">' + cardHead('授信尺', '<span class="faint">AC-CR-03 · 机构维度</span>') +
    '<div class="card-b">' + creditBar({ limit:Math.max(c.limit, f.after), used:c.used, fly:c.fly,
        avail:Math.max(0, round2(f.after - c.usedTotal)), need:c.need,
        usedTotal:c.usedTotal, gap:Math.max(0, round2(c.need - (f.after - c.usedTotal))),
        pass:round2(f.after - c.usedTotal) >= c.need }) +
      '<p class="hint" style="margin-top:11px">尺长 ＝ ' + bm.verb + '后的授信额度 ' + amt(f.after) +
      '。段序与 AC-CR-03 不等式左端同序。</p></div></div>' +
    (c.cr ? '<div class="card">' + cardHead('额度留痕', '<span class="faint">CR-13</span>') +
      '<div class="card-b"><ul class="tl">' + c.cr.log.map(function(l){
        return '<li><div style="font-size:12px"><b>' + E(l.k) + '</b>' +
          '<span class="faint" style="margin-left:8px">' + l.at + '</span></div>' +
          '<div class="faint" style="font-size:11.5px;margin-top:3px">' + amt(l.from) + ' → ' + amt(l.to) +
          ' ' + CCY + ' · 有效期至 ' + l.until + '</div></li>'; }).join('') + '</ul>' +
      '<p class="hint">每一次核定、追加、重新核定、到期都留痕（动作人、双方主体、变更前后额度、有效期、时间、' +
      '触发来源项目）。这是将来发生额度纠纷时的唯一证据。</p></div></div>' : '') +
    '<div class="card">' + cardHead('两道闸门', '<span class="faint">AC-FIN-07</span>') +
      '<div class="card-b">' +
      '<p class="hint" style="margin:0 0 9px">担保闸门（项目维度）此刻 <b style="color:var(--ok)">通过</b>：' +
      amt(g.head) + ' ≥ 本笔需求 ' + amt(g.need) + '。授信闸门就是您现在在处理的这一道。</p>' +
      '<p class="hint">授信步骤完成后<b>两道一起重跑</b>（AC-CR-04 V3.0 补充）—— 不只是重跑 AC-CR-03。' +
      '理由相同：您填授信额度的这段时间里，代币同样可能失效。</p></div></div>' +
    '<div class="card"><div class="card-b"><p class="hint">深链锚点 <span class="mono">project/' + p.id +
      '?action=quote</span><br>授信步骤<b>不另开锚点</b>：它是报价流程内的一步，是否出现由服务端判定后在页面内插入。</p>' +
    '</div></div></aside>';

  return head + why + '<div class="portal-cols" style="margin-top:18px"><div>' + form + '</div>' + rail + '</div>';
}


/* ================================================================
   Part D2 —— P-LS-05 机构报价
   左区：项目与抵押物摘要 + 本次报价占用后的授信余量；右区：报价表单 → 二次确认。
   ================================================================ */
function quoteForm(p){
  var ccy = S.qt.ccy || 'USD';
  var fx = FX[ccy];
  var rateRaw = S.qt.rate;
  var rate = parseFloat(String(rateRaw === null || rateRaw === undefined ? '' : rateRaw));
  var rateErr = null;
  if(rateRaw !== null && rateRaw !== undefined && String(rateRaw).trim() !== ''){
    if(!(rate > 0 && rate <= 100))
      rateErr = '年化利率须满足 <b>0 &lt; 利率 ≤ 100</b>，2 位小数。计息口径（单复利、计息基数、起息日）由 WS-327 定义，' +
                '本字段只采集数值。';
  }
  var fiat = (ccy === 'USD');
  var a = S.qt.acct || {};
  var need = [];
  if(fiat){
    ['bank','acct','name','swift','country'].forEach(function(k){ if(!String(a[k]||'').trim()) need.push(k); });
    /* 户名须与机构企业主体名称一致，不一致拒绝提交（QT-07） */
    if(a.name && String(a.name).trim() && String(a.name).trim() !== ACTORS.fund.full)
      need.push('nameMismatch');
  } else {
    if(!String(a.chain||'').trim()) need.push('chain');
    if(!/^0x[0-9a-fA-F]{40}$/.test(String(a.addr||'').trim())) need.push('addr');
    if(a.chain && ((ccy === 'USDT' && a.chain === 'Polygon') || (ccy === 'USDC' && a.chain === 'Tron')))
      need.push('chainMismatch');
  }
  var ok = !rateErr && rate > 0 && rate <= 100 && need.length === 0;
  return { ccy:ccy, fx:fx, settle:round2(p.demand / fx.v), rate:rate, rateRaw:rateRaw, rateErr:rateErr,
           fiat:fiat, a:a, need:need, ok:ok };
}

function pageQuote(){
  var p = findProject(S.pid);
  if(S.role !== 'fund')
    return failCard('机构报价', '无权访问',
      '报价页只对<b>已登录的资金方企业主体</b>开放。当前身份为「' + E(ACTORS[S.role].full) + '」。' +
      '游客与资产方在广场与详情页可以看到 L1～L5 的全量信息，包括这笔在途报价的公开商务条款，' +
      '但报价表单属于机构本方数据，按企业主体做服务端归属过滤。',
      '<a class="btn primary" href="' + lsHref('#/plaza') + '">返回融资需求广场</a>');
  if(!p) return failCard('机构报价', '内容不存在或无权访问',
      '该融资项目不存在，或它是尚未发布的草稿 —— 草稿不进广场、不可搜索、不可深链直达。',
      '<a class="btn primary" href="' + lsHref('#/plaza') + '">返回融资需求广场</a>');
  if(S.st === 'loading') return skel('机构报价');
  if(S.st === 'error') return failCard('机构报价', '报价信息加载失败',
      '服务端未返回该项目的担保读数与本机构授信额度。<b>不会退回读缓存值</b>继续渲染 —— 那正是 AC-CR-20 要堵的口子。可重试。');

  var qa = actionOf(availableActions(p, 'fund'), 'quote');
  /* 状态已变 / 不可报价：落说明页而非空表单，原因逐种可区分（AC-LS-92 / AC-LS-93） */
  if(!qa.enabled || S.st === 'gone')
    return backToPlaza() + pageHead('机构报价 · ' + p.name, '') +
      '<div class="card"><div class="tbl-empty"><b>该需求当前不可报价</b>' + E(qa.reason) +
      '<div style="margin-top:14px"><a class="btn primary" href="' + lsHref('#/plaza') + '">返回融资需求广场</a>' +
      '</div></div></div>';

  var c = creditCheck(p.entity, p.demand);
  /* 第五个条件决定进去之后先走哪一步：授信闸门不是 ⊘，不通过时进入授信步骤（AC-CR-06） */
  if(c.branch !== 'enough' && !S.qt.creditDone){ S.page = 'P-LS-04'; CF.syncURL(); return pageCredit(); }
  var g = guaranteeCheck(p);
  var f = quoteForm(p);
  var expireAt = tstr(tmin(NOW) + QUOTE_HOURS * 60);

  var head = backToPlaza() + phead(
    '机构报价 · <span class="mono">P-LS-05</span> · 项目 <span class="mono">' + p.id + '</span> · 时区 ' + TZ_LABEL,
    p.name, p.owner,
    pill('green', FP_STATUS[p.status].t) + pill('gray', p.assetType) +
      pill('gray', '有效期至 ' + p.expiresAt) +
      (S.qt.creditDone ? pill('green', '授信已' + BRANCH[S.qt.creditBranch || 'new'].verb + ' · 两道校验已重跑') : ''),
    amtBlock('报价金额', amt(p.demand), CCY,
      '只读，恒等于需求金额 —— 本期不支持部分融资')) + CF.pageStates() + submitResultCard();

  var afterNote = S.qt.creditDone
    ? '<div class="ls-alert">' + CF.note('green',
      '授信已' + BRANCH[S.qt.creditBranch].verb + '至 <span class="mono">' + usd(c.limit) + '</span>，当前可用授信 <span class="mono">' +
      usd(c.avail) + '</span>。回到报价表单时<b>两道校验已一起重跑</b>并通过（AC-CR-04）。' +
      '<p>授信与报价<b>解耦</b>：此刻放弃报价，额度照常保留；报价提交失败也不回滚额度。</p>',
      '授信步骤已完成') + '</div>' : '';

  /* ---- 左区：项目与抵押物摘要（复用 P-LS-02 L3/L4 的只读呈现）+ 两道闸门 + 授信余量 ---- */
  var left =
    '<div class="card">' + cardHead('两道闸门 · 当前判定', '<span class="faint">准入以提交时刻的服务端实时重算为准</span>') +
    '<div class="card-b">' + gates(p, c, g) + '</div></div>' +

    '<div class="card" style="margin-top:16px">' + cardHead('项目与抵押物摘要',
      '<span class="faint">只读 · 与广场详情同源</span>') +
    '<div class="card-b">' +
      '<div class="ls-kgrid">' +
        '<div><div class="k">有效质押价值</div><div class="v">' + amt(p.valid) + '</div>' +
          '<div class="x">已排除底层失效的代币</div></div>' +
        '<div><div class="k">融资上限</div><div class="v">' + amt(p.cap) + '</div>' +
          '<div class="x">有效质押价值 × 质押率 ' + (PLEDGE_RATE*100) + '%，本期固定</div></div>' +
        '<div><div class="k">项目融资余额</div><div class="v">' + amt(p.bal) + '</div>' +
          '<div class="x">已确认业务的未偿本金合计</div></div>' +
        '<div><div class="k">项目在途金额</div><div class="v">' + amt(p.fly) + '</div>' +
          '<div class="x">唯一来源是发布占用，本次报价不新增</div></div>' +
        '<div><div class="k">可融金额</div><div class="v">' + amt(g.free) + '</div>' +
          '<div class="x">max(0, 融资上限 − 项目融资余额 − 项目在途金额)</div></div>' +
        '<div><div class="k">抵押物</div><div class="v">' + p.tokens + ' 张</div>' +
          '<div class="x">' + p.assetType + '代币，逐张明细见广场详情 L4</div></div>' +
      '</div>' +
      fold('本次报价会改变哪几个量', '三个占用量的对照 · 只有一个会变',
        threeQuantities(p, c, p.demand), true) +
    '</div></div>' +

    '<div class="card" style="margin-top:16px">' + cardHead('本次报价占用后的授信余量',
      '<span class="faint">CR-08 ～ CR-11</span>') +
    '<div class="card-b">' + creditBar(c) + creditEq(c) +
      '<div class="ls-kgrid" style="margin-top:16px">' +
        '<div><div class="k">授信额度 · CR-05</div><div class="v">' + amt(c.limit) + '</div>' +
          '<div class="x">有效期至 ' + (c.cr ? c.cr.until : '—') + '（' + (c.cr ? CR_STATUS[c.cr.st].t : '—') + '）</div></div>' +
        '<div><div class="k">授信占用额 · CR-08</div><div class="v">' + amt(c.used) + '</div>' +
          '<div class="x">未结清业务的未偿本金合计，不含在途报价</div></div>' +
        '<div><div class="k">在途报价金额 · CR-09</div><div class="v">' + amt(c.fly) + '</div>' +
          '<div class="x">已提交、尚未终结、尚未转为未偿本金的业务金额</div></div>' +
        '<div><div class="k">提交后可用授信</div><div class="v">' +
          amt(Math.max(0, round2(c.avail - p.demand))) + '</div>' +
          '<div class="x">本次报价占用 ' + amt(p.demand) + ' 之后的余量</div></div>' +
      '</div></div></div>';

  /* ---- 右区：报价表单 ---- */
  var acct = f.fiat
    ? field('机构还款账户（法币）', 'QT-07 · 必填',
        '<div class="field" style="margin-bottom:9px">' + inp('qtBank', f.a.bank, '开户行名称') + '</div>' +
        '<div class="field" style="margin-bottom:9px">' + inp('qtAcct', f.a.acct, '账号') + '</div>' +
        '<div class="field" style="margin-bottom:9px">' +
          inp('qtName', f.a.name, '户名（须与机构企业主体名称一致）',
              { err:f.need.indexOf('nameMismatch') >= 0 }) + '</div>' +
        '<div class="inp-row" style="margin-bottom:2px">' + inp('qtSwift', f.a.swift, 'SWIFT / BIC') +
          inp('qtCountry', f.a.country, '国别') + '</div>',
        f.need.indexOf('nameMismatch') >= 0
          ? '<b style="color:var(--danger)">户名须与机构企业主体名称一致</b>：本机构登记名称为「' +
            E(ACTORS.fund.full) + '」，不一致将被服务端拒绝提交。'
          : '结算币种为 USD 时必填。这是<b>机构收还款</b>的账户，与资产方的收款账户是两回事 —— ' +
            '后者在资产方接受报价时由资产方自己填。')
    : field('机构还款地址（数币）', 'QT-08 · 必填',
        '<div class="field" style="margin-bottom:9px">' +
          '<select class="inp" data-act="cq.f" data-v="qtChain">' +
          ['', 'Ethereum', 'Tron', 'Polygon'].map(function(ch){
            return '<option value="' + ch + '"' + (f.a.chain === ch ? ' selected' : '') + '>' +
              (ch || '选择链') + '</option>'; }).join('') + '</select></div>' +
        inp('qtAddr', f.a.addr, '0x + 40 位十六进制', { err:f.need.indexOf('addr') >= 0 }),
        f.need.indexOf('chainMismatch') >= 0
          ? '<b style="color:var(--danger)">链与币种不匹配</b>：' + f.ccy + ' 不在所选链上发行，提交会被拒绝。'
          : '地址格式沿用 <span class="mono">0x</span> + 40 位十六进制。本期<b>只做格式校验，不做链上核验</b> —— ' +
            '平台不判断该地址是否存在、是否属于贵司。');

  var right = '<aside class="portal-rail"><div class="card">' +
    cardHead('报价表单', '<span class="faint">QT-02 ～ QT-08</span>') +
    '<div class="card-b">' +
      field('融资金额', 'QT-03 · 只读',
        ro(amt(p.demand) + ' ' + CCY),
        '<b>本期不支持部分融资，金额不可修改</b>，恒等于该需求的融资需求金额（D-FIN-19）。' +
        '授信不足的机构直接出局，没有"报一部分"这条路。') +
      field('融资币种（结算币种）', 'QT-02 · 必填',
        '<select class="inp" data-act="cq.f" data-v="qtCcy">' +
        ['USD','USDT','USDC'].map(function(k){
          return '<option value="' + k + '"' + (f.ccy === k ? ' selected' : '') + '>' + k + '</option>'; }).join('') +
        '</select>',
        '只是<b>结算币种</b>，不改变记账口径 —— 额度类的量一律以 USD 记账。') +
      '<div class="ls-pick" style="margin-bottom:var(--field-gap)">' +
        '<span>结算金额 <span class="n">' + amt(f.settle) + '</span> ' + f.ccy + '</span>' +
        '<span class="sp"></span><span>汇率快照 <span class="n">' + f.fx.v.toFixed(4) + '</span></span>' +
        '<span class="faint" style="font-size:11px;margin-left:auto">' + E(f.fx.src) + ' · ' + f.fx.ver + '</span></div>' +
      '<p class="hint" style="margin-top:-8px;margin-bottom:var(--field-gap)">' + E(f.fx.x) +
      '。快照在<b>提交时锁定，此后永不重算</b>：每一笔在途报价与未偿本金都用它自己那份快照汇率，' +
      '不采用"每次校验实时取汇率"—— 那会让占用变成随行情浮动的数，机构在完全没有新动作的情况下也可能突然超额。</p>' +
      field('融资利率', 'QT-06 · 年化百分比 · 必填',
        inp('qtRate', f.rateRaw, '例如 7.20', { type:'number', err:!!f.rateErr, attr:'step="0.01" min="0.01" max="100"' }),
        f.rateErr || '计息规则以双方签署的融资合同为准。本字段只采集数值，计息口径（单复利、计息基数、起息日）由 WS-327 定义。') +
      acct +
      field('报价有效期', '常量 · 不是输入项',
        ro(QUOTE_HOURS + ' 小时（7 个自然日）'),
        '本报价将于 <b>' + withTz(expireAt) + '</b> 自动失效。' +
        '用"+' + QUOTE_HOURS + ' 小时"而不是"第 7 天 23:59"：后者会让 23:50 提交的报价实际只有 6 天零 10 分钟。' +
        '<b>界面上不存在有效期的输入控件、展期入口或延长入口。</b>') +
      '<div class="btnbar"><button class="btn primary block" type="button" ' + (f.ok ? '' : 'disabled ') +
        'data-act="cq.qtConfirm">提交报价</button></div>' +
      (f.ok ? '' : '<p class="hint">请先补齐：' +
        (f.rateErr ? '年化利率；' : '') +
        (f.need.length ? (f.fiat ? '机构还款账户的必填项' : '链与地址') +
          (f.need.indexOf('nameMismatch') >= 0 ? '（户名与机构主体不一致）' : '') +
          (f.need.indexOf('chainMismatch') >= 0 ? '（链与币种不匹配）' : '') + '。' : '') + '</p>') +
      noChainFoot('提交报价') +
    '</div>' +
    '<div class="card-head" style="border-top:1px solid var(--border)"><b>提交后会发生什么</b></div>' +
    '<div class="card-b"><p class="hint">同一次结算内完成：生成融资业务编号 → 锁定汇率快照 → ' +
      QUOTE_HOURS + ' 小时计时开始 → 在途报价金额 +' + amt(p.demand) + ' → 业务落 <b>S-FD-1 待接受</b> → ' +
      '项目转 <b>S-FP-3 已锁定</b>。<b>项目在途金额不变。</b><br>' +
      '<b>报价一经提交不可修改、不可撤回</b>（X-LS-20）—— 界面上没有这两个入口。' +
      '机构侧唯一的后续动作是等待资产方处理，或等 ' + QUOTE_HOURS + ' 小时自然失效。</p></div></div>' +
    '<div class="card"><div class="card-b"><p class="hint">深链锚点 <span class="mono">project/' + p.id +
      '?action=quote</span> · 已在附册 A0 预留，本模块正式交付。</p></div></div></aside>';

  return head + afterNote + '<div class="portal-cols"><div>' + left + '</div>' + right + '</div>';
}


/* ================================================================
   Part D3 —— P-LS-06 接受 / 拒绝
   顶部：报价摘要 + 锁定信息（含剩余有效期倒计时）+ 担保状态
   中部：三步（填写收款账户 → 查看条款摘要 → 上传盖章件），可中断可续做
   底部：并列「确认接受」与「拒绝报价」
   ================================================================ */

/* 户名一致性校验（D-FIN-99 / D-FIN-100）：比对对象是法定名称及其已登记的英文名 / 曾用名集合；
   忽略大小写、空格、常见公司后缀的标点与缩写差异。不是字符串全等 —— 做成全等，
   上线第一天就会把全部合法汇款拒掉（跨境户名多为英文，主体名称多为中文）。 */
function normName(s){
  return String(s || '').toLowerCase()
    .replace(/[\s,.、， ]/g, '')
    .replace(/co\.?,?ltd\.?/g, 'coltd')
    .replace(/limited/g, 'ltd')
    .replace(/corporation/g, 'corp')
    .replace(/（演示）|\(演示\)/g, '');
}
function nameMatches(v){
  var n = normName(v);
  if(!n) return false;
  for(var i = 0; i < ENTITY_NAMES.length; i++) if(normName(ENTITY_NAMES[i]) === n) return true;
  return false;
}

var FIAT_FIELDS = [
  ['name',     '收款人名称 Beneficiary Name',            '须通过户名一致性校验', true],
  ['addr',     '收款人地址 Beneficiary Address',          '国家/地区 + 城市 + 详址', true],
  ['acct',     '收款账号 / IBAN',                         '按收款行所在国家/地区自行填账号或 IBAN', true],
  ['bank',     '收款行名称 Beneficiary Bank Name',        '', true],
  ['bankAddr', '收款行地址 Beneficiary Bank Address',     '至少到城市与国家/地区', true],
  ['swift',    'SWIFT / BIC',                             '8 位或 11 位，字母数字', true],
  ['country',  '收款行所在国家 / 地区',                   '与 SWIFT 的国家段不一致时提示但不阻断', true]
];

function payeeState(deal){
  var v = S.ac.payee;
  var errs = {}, missing = 0;
  FIAT_FIELDS.forEach(function(f){
    if(f[3] && !String(v[f[0]] || '').trim()){ errs[f[0]] = 'empty'; missing++; }
  });
  if(v.swift && String(v.swift).trim() && !/^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$/.test(String(v.swift).trim()))
    errs.swift = 'format';
  var nameBad = !!(String(v.name || '').trim()) && !nameMatches(v.name);
  if(nameBad) errs.name = 'mismatch';
  var formOk = missing === 0 && !nameBad && errs.swift !== 'format';
  return { v:v, errs:errs, missing:missing, nameBad:nameBad, formOk:formOk,
           confirmed:!!S.ac.acctConfirmed, digital:(deal.ccy !== 'USD') };
}

function progOf(deal){
  /* FD-04 接受填写进度：S-FD-1 内部的进度，不是状态（D-FIN-77）。可中断可续做（AC-LS-90）。 */
  var done = { account:false, terms:false, seal:false };
  if(S.ac.dealId === deal.id){
    done.account = !!S.ac.acctConfirmed;
    done.terms   = !!S.ac.termsSeen;
    done.seal    = (S.ac.files.length > 0 && !!S.ac.declared);
  } else if(deal.prog === 'account'){
    done.account = true;   /* 演示：上次已填到第一步并确认，本次进入保留 */
  }
  return done;
}

function pageRespond(){
  var deal = findDeal(S.did);
  if(S.st === 'loading') return skel('接受 / 拒绝报价');
  if(!deal) return failCard('接受 / 拒绝报价', '内容不存在或无权访问',
      '该融资业务编号不存在。融资业务编号一经生成即<b>全局唯一、终身稳定</b>，被拒或失效后保留但作废、不回收、不复用。',
      '<a class="btn primary" href="' + lsHref('#/plaza') + '">返回融资需求广场</a>');
  var p = findProject(deal.pid);
  if(S.st === 'error') return failCard('接受 / 拒绝报价', '融资业务加载失败',
      '服务端未返回该笔业务的商务条款与剩余有效期。<b>倒计时必须由服务端给出到期时刻、前端只负责渲染</b> —— ' +
      '前端自行按本地时间推算会在跨时区与时钟偏差下与服务端判定不一致。可重试。');

  var own = (S.role === 'asset' && p.entity === ACTORS.asset.entity);
  var k = quoteClock(deal);
  var g = guaranteeCheck(p, deal.amt);
  var fx = deal.fx, settle = round2(deal.amt / fx.v);

  var head = backToPlaza() + phead(
    '融资业务 · <span class="mono">P-LS-06</span> · 编号 <span class="mono">' + deal.id +
      '</span> · 项目 <span class="mono">' + p.id + '</span> · 时区 ' + TZ_LABEL,
    p.name, p.owner,
    pill(TONE[FD_STATUS[deal.st].tone] || 'gray', deal.st + ' ' + FD_STATUS[deal.st].t) +
      (deal.void ? pill('gray', '失效原因 · ' + VOID_REASON[deal.void]) : '') +
      pill('gray', '报价机构 ' + deal.fund) +
      (k.live ? pill(k.soon ? 'amber' : '', '剩余 ' + fmtDur(k.leftMin)) : ''),
    amtBlock('融资金额', amt(deal.amt), CCY,
      '结算 ' + amt(settle) + ' ' + deal.ccy + ' · 年化 ' + deal.rate.toFixed(2) + '%')) +
    CF.pageStates() + submitResultCard();

  /* ---- 报价摘要（判断依据先于动作，6.3.1）---- */
  var terms = '<div class="card">' + cardHead('报价条款',
      '<span class="faint">QT-01 ～ QT-12 · 公开字段</span>') +
    '<div class="card-b"><div class="cq-terms">' +
      '<div><div class="k">报价机构</div><div class="v">' + E(deal.fund) + '</div>' +
        '<div class="x">机构企业主体全称 · 公开字段</div></div>' +
      '<div><div class="k">融资金额 · QT-03</div><div class="v mono">' + amt(deal.amt) + ' ' + CCY + '</div>' +
        '<div class="x">恒等于需求金额，本期不支持部分融资</div></div>' +
      '<div><div class="k">年化利率 · QT-06</div><div class="v mono">' + deal.rate.toFixed(2) + '%</div>' +
        '<div class="x">计息规则以双方签署的融资合同为准</div></div>' +
      '<div><div class="k">结算币种与金额 · QT-02/05</div><div class="v mono">' + amt(settle) + ' ' + deal.ccy + '</div>' +
        '<div class="x">融资金额 ÷ 汇率快照 ' + fx.v.toFixed(4) + '</div></div>' +
      '<div><div class="k">汇率快照 · QT-04</div><div class="v mono">' + fx.v.toFixed(4) + '</div>' +
        '<div class="x">生效 ' + withTz(fx.at) + ' · ' + E(fx.src) + ' · ' + fx.ver + '</div></div>' +
      '<div><div class="k">机构还款账户 · QT-07/08</div><div class="v">' +
        (deal.payee ? (deal.payee.addr ? deal.payee.chain + ' · ' +
          deal.payee.addr.slice(0,10) + '…' + deal.payee.addr.slice(-6) : E(deal.payee.bank || '—')) : '—') +
        '</div><div class="x">还款时汇入该账户</div></div>' +
      '<div><div class="k">报价提交时间 · QT-09</div><div class="v mono">' + withTz(deal.at) + '</div>' +
        '<div class="x">锁定信息的起算点</div></div>' +
      '<div><div class="k">有效期至 · QT-12</div><div class="v mono">' +
        (k.live ? withTz(k.to) : (deal.endAt ? withTz(deal.endAt) : '—')) + '</div>' +
        '<div class="x">' + (k.live ? '提交时刻 + ' + QUOTE_HOURS + ' 小时，只读不可延长'
                                    : '业务已离开 S-FD-1，计时终止') + '</div></div>' +
    '</div></div></div>';

  /* ---- 当前池况与担保状态（6.3.1；不展示报价时的池快照，AC-LS-27 已作废）---- */
  var pool = '<div class="card" style="margin-top:16px">' + cardHead('当前池况',
      '<span class="faint">当前值 · 不是报价时的快照</span>') +
    '<div class="card-b"><div class="ls-kgrid">' +
      '<div><div class="k">有效质押价值</div><div class="v">' + amt(p.valid) + '</div>' +
        '<div class="x">已排除底层失效的代币</div></div>' +
      '<div><div class="k">融资上限</div><div class="v">' + amt(p.cap) + '</div>' +
        '<div class="x">× 质押率 ' + (PLEDGE_RATE*100) + '%，本期固定</div></div>' +
      '<div><div class="k">项目融资余额</div><div class="v">' + amt(p.bal) + '</div>' +
        '<div class="x">已确认业务的未偿本金合计</div></div>' +
      '<div><div class="k">担保状态</div><div class="v" style="font-family:var(--sans)">' +
        (g.pass ? pill('green','正常') : pill('red','担保不足')) + '</div>' +
        '<div class="x">' + amt(g.cap) + ' − ' + amt(g.bal) + ' ＝ ' + amt(g.head) +
        (g.pass ? ' ≥ ' : ' &lt; ') + amt(g.need) + '</div></div>' +
    '</div>' +
    (g.pass ? '<p class="hint" style="margin-top:12px"><b>接受不重跑额度闸门</b>：接受动作不新增任何占用 —— ' +
        '金额早在发布时进了项目在途金额、在报价时进了在途报价金额。闸门管的是"能不能新增占用"，此处无新增。</p>'
      : '<div class="ls-alert" style="margin-top:14px">' + CF.note('red',
        '当前池内担保已低于本笔业务金额，缺口 <span class="mono">' + usd(round2(g.need - g.head)) +
        '</span>，需追加资产价值 <span class="mono">' + usd(round2((g.need - g.head) / PLEDGE_RATE)) + '</span>。' +
        '<p>接受<b>不重跑</b>额度闸门，因此这一步不会被拦死 —— 但<b>随后的放款会被担保闸门挡住</b>。' +
        '您仍然可以接受、也随时可以拒绝，这两条路都开着；追加质押后放款照常。' +
        '<b>拦死会让您既不能接受又无法自救</b>，而拒绝这条路本来就在。机构侧同样看得到这段。</p>',
        '当前担保状态') + '</div>') +
    '</div></div>';

  /* ---- 终结态：已拒绝 / 已失效各有自己的结论与下一步（D-FIN-92）---- */
  if(deal.st !== 'S-FD-1'){
    var end;
    if(deal.st === 'S-FD-2'){
      end = '<div class="cq-end"><div class="eh">' + pill('gray','S-FD-2 已拒绝') +
        '　该报价已于 ' + withTz(deal.endAt) + ' 被拒绝</div>' +
        '<div class="eb"><b>拒绝原因</b>（FD-11，必填，对报价机构可见）<br>' + E(deal.reject) + '</div>' +
        '<div class="eb">五个后果在同一次结算内一致生效：业务落终态、项目回 <b>S-FP-2 募集中</b>、' +
        '在途报价金额<b>全额释放</b>、项目在途金额<b>不变</b>（需求还挂着）、质押<b>不释放</b>（项目还在）。' +
        '不存在"已拒绝但需求仍显示被锁定"或"额度未回"的中间态。<br>' +
        '同一机构可在被拒后<b>立即重新报价</b>，本期不设冷却期与次数上限 —— 那是一笔全新的融资业务：' +
        '新编号、新汇率快照、新的 ' + QUOTE_HOURS + ' 小时计时，不是原报价的续期。</div></div>';
    } else {
      end = '<div class="cq-end"><div class="eh">' + pill('gray','S-FD-11 报价已失效') +
        '　失效原因：' + VOID_REASON[deal.void] + '　·　失效时间 ' + withTz(deal.endAt) + '</div>' +
        '<div class="eb">' + (deal.void === 'timeout'
          ? '<b>' + QUOTE_HOURS + ' 小时有效期届满，资产方未处理</b>，由系统自动执行，不依赖任何人登录。' +
            '失效时间取<b>到期时刻</b>，不取任务实际执行时刻。'
          : '<b>所属融资需求因池内担保不足自动失效</b>，其在途报价一并失效。担保已经撑不起这笔需求，' +
            '保住报价等于保住一份抵押物撑不起的要约，而担保闸门本来就会挡住它的放款 —— ' +
            '留着只会让业务卡在"能接受、不能放款"的死状态。') +
        '</div>' +
        '<div class="eb"><b>失效不是拒绝，机构不吃亏</b>：无原因可填（FD-11 在本状态下恒为空）、' +
        '<b>不计入拒绝率</b>、不产生任何负面记录。额度已释放，' +
        (deal.void === 'timeout' ? '可对同一需求重新报价。' : '可在资产方补足担保并重新发布后再报价。') +
        '汇率快照已按 QT-14 作废，重新报价取新的快照。</div></div>';
    }
    return head + terms + pool + '<div class="card" style="margin-top:16px">' +
      cardHead('本笔业务已终结', '<span class="faint">编号保留但作废，不回收、不复用</span>') +
      '<div class="card-b">' + end +
      '<div class="btnbar"><a class="btn primary" href="' + lsHref('#/plaza') + '">返回融资需求广场</a></div>' +
      '</div></div>';
  }

  /* ---- S-FD-1：可处理 ---- */
  if(!own)
    return head + terms + pool + '<div class="card" style="margin-top:16px">' +
      cardHead('接受 / 拒绝', '<span class="faint">L6 操作区</span>') + '<div class="card-b">' +
      countdown(deal, false) +
      '<div style="margin-top:14px">' + actBtn({ key:'respond', label:'接受 / 拒绝报价', enabled:false,
        reason: S.role === 'guest'
          ? '未登录。融资业务的处理动作仅对该项目所属企业主体开放；上面的商务条款与锁定信息本身是公开信息，不因未登录而隐藏。'
          : '本笔业务的处理动作只属于该项目的资产方企业主体（' + p.owner + '）。当前身份为「' +
            ACTORS[S.role].full + '」。' }, 'block') + '</div>' +
      '<p class="hint" style="margin-top:12px">锁定信息属于<b>公开信息</b>，对游客与全部资金方可见 —— ' +
      '它是在途业务的公开商务条款的一部分。措辞只陈述事实，<b>不做评价性判断</b>。</p>' +
      '</div></div>';

  var ps = payeeState(deal);
  var done = progOf(deal);
  var cur = !done.account ? 'account' : !done.terms ? 'terms' : !done.seal ? 'seal' : 'ready';

  /* ---- 进度轨 ---- */
  var prog = '<div class="cq-prog">' + STEPS.map(function(s){
    return '<div class="p" data-on="' + (cur === s.k ? 1 : 0) + '" data-done="' + (done[s.k] ? 1 : 0) + '">' +
      '<span class="n">' + (done[s.k] ? '✓' : s.n) + '</span>' +
      '<span class="bd"><b>' + E(s.t) + '</b>' + s.x + '</span></div>';
  }).join('') + '</div>' +
  '<p class="hint" style="margin-top:10px">三步<b>可中断可续做</b>：填到第二步离开页面，再次进入时已确认的账户与已完成的步骤保留，' +
  '不要求从头再来。<b>任何一步都不改变融资业务状态</b> —— 这是 S-FD-1 内部的填写进度，不是状态。' +
  '<b>但计时不因中断而暂停</b>。</p>';

  /* ---- 第 ① 步：收款账户 ---- */
  var step1;
  if(ps.digital){
    step1 = CF.note('',
      '本笔结算币种为 <b class="ls-b">' + deal.ccy + '</b>，收款地址默认为贵司的<b class="ls-b">企业统一数币地址</b>，' +
      '<b class="ls-b">本期只读、不可修改</b>。<p>允许填任意地址等于给了一条把融资款打进个人钱包的通道，' +
      '而平台没有任何地址归属核验能力。</p>') +
      '<div class="ls-kgrid" style="margin-top:14px">' +
        '<div><div class="k">链</div><div class="v">' + ASSET_WALLET.chain + '</div></div>' +
        '<div><div class="k">收款地址 · FD-06</div><div class="v" style="font-size:12px">' +
          ASSET_WALLET.addr + '</div></div></div>';
  } else {
    step1 =
      '<p class="lead" style="margin-top:0">下列各项<b>已按贵司最近一次成功接受时使用的账户预填</b>，' +
      '全部<b>可以修改</b>。预填来源是平台自己的这份数据，不依赖任何账户设置模块；' +
      '首次接受时为空白手填。本次填写的账户会自动成为下次的预填值。</p>' +
      FIAT_FIELDS.map(function(f){
        return field(f[1], f[3] ? '必填' : '选填',
          inp('pa_' + f[0], ps.v[f[0]], '', { err:!!ps.errs[f[0]] }),
          ps.errs[f[0]] === 'format' ? '<b style="color:var(--danger)">SWIFT / BIC 须为 8 位或 11 位字母数字。</b>' : f[2]);
      }).join('') +
      (ps.nameBad ? '<div class="ls-alert">' + CF.note('red',
        '<b class="ls-b">收款人名称与本企业主体不一致，提交将被拒绝</b>，且<b class="ls-b">不提供"仍要继续"的绕过项</b>。' +
        '<p>融资款打给第三方是挪用风险，不是一个可以由用户自行承担的选项；' +
        '合同已改线下、平台连正文都没有，<b class="ls-b">资金方的核验是这条链路上唯一的检查点</b>，而户名是它唯一能对上的字段。</p>' +
        '<div class="cq-cmp"><div class="c bad"><div class="k">您填写的收款人名称</div>' +
          '<div class="v">' + E(ps.v.name) + '</div></div>' +
        '<div class="c"><div class="k">本企业主体已登记的名称</div><div class="v">' +
          ENTITY_NAMES.map(function(n){ return E(n); }).join('<i>') + '</i></div></div></div>' +
        '<p>比对<b class="ls-b">不是字符串全等</b>：比对对象是法定名称及其已登记的英文名 / 曾用名集合，' +
        '忽略大小写、空格与常见公司后缀的标点缩写差异（<span class="mono">Co., Ltd.</span> / ' +
        '<span class="mono">Co Ltd</span> / <span class="mono">CO.,LTD</span> 视为同一个）。' +
        '若贵司主体尚未登记英文名，请先<button class="btn-link" type="button" data-act="cq.enName">去主体资料补登英文名</button>' +
        '——在该入口落地前，这类资产方无法完成接受，这是一条已知的开口，如实记录。</p>',
        '户名一致性校验不通过') + '</div>' : '') +
      '<details class="cq-opt"' + (S.ac.imOpen ? ' open' : '') + '><summary>' +
        '<span class="ca" aria-hidden="true">▶</span>中转行信息（选填）</summary><div class="ob">' +
        '<p class="hint" style="margin:0 0 11px">若您的开户行需要通过中转行接收外币汇款，请填写；不确定时请咨询开户行。' +
        '部分走廊缺了中转行汇款会被退回或长期滞留，而<b>退汇手续费照样由资产方承担</b>；' +
        '但主流银行不需要它，强制必填会让大多数用户去向银行索要一个并不存在的号。<br>' +
        '<b>平台不判断是否需要、不校验其正确性</b> —— 平台没有这个能力。</p>' +
        field('中转行 SWIFT', '选填', inp('pa_imSwift', ps.v.imSwift, '')) +
        field('中转行名称', '选填', inp('pa_imBank', ps.v.imBank, '')) +
        field('在中转行的账号', '选填', inp('pa_imAcct', ps.v.imAcct, '')) +
      '</div></details>' +
      CF.note('amber',
        '平台<b class="ls-b">不做银行账户真实性核验、不做账号与户名的银企联验、不判断汇路是否可达</b>。' +
        '本页的校验只到<b class="ls-b">"格式对不对"与"户名一致不一致"</b>为止。' +
        '<p>本页<b class="ls-b">没有账户簿</b>：无多账户列表、无账户管理入口、无"设为默认"开关。' +
        '本期只有"上一次用过的那一个"作为预填；多账户管理属账户设置模块的能力。</p>', '平台的能力边界') +
      '';
  }
  /* 逐笔显式确认对两种币种一视同仁（D-FIN-94）：数币地址虽然只读，确认动作照样一笔一次、
     默认不勾选、不自动带过，单独留痕（FD-20）。 */
  var canConfirm = ps.digital || ps.formOk;
  step1 += '<div class="check" style="margin-top:14px">' +
      '<input type="checkbox" id="acctOk" ' + (ps.confirmed ? 'checked' : '') +
      (canConfirm ? '' : ' disabled') + ' data-act="cq.acctConfirm">' +
      '<label for="acctOk">我确认以上收款' + (ps.digital ? '地址' : '账户') +
      '信息准确无误，本笔融资款' + (ps.digital ? '转入该地址' : '汇入该账户') + '。' +
      '<span class="faint">（FD-20 · 默认不勾选、不自动带过，确认动作单独留痕）</span></label></div>' +
    (canConfirm ? '' : '<p class="hint">补齐必填项并通过户名校验后方可勾选确认。</p>');

  /* ---- 手续费差额告知（D-FIN-103）：位置在确认接受之前，不折叠、不做小字注脚 ---- */
  var fee = '<div class="cq-fee" style="margin-top:16px">' +
    '<div class="c"><div class="k">融资金额</div><div class="v">' + amt(deal.amt) + ' ' + CCY + '</div>' +
      '<div class="x">机构按此金额放款</div></div>' +
    '<div class="op" aria-hidden="true">−</div>' +
    '<div class="c"><div class="k">跨境手续费 · 由您承担</div><div class="v unknown">平台不预估金额</div>' +
      '<div class="x">汇出行手续费、中转行扣费、收款行入账费；中转行扣费通常逐笔发生且事前不告知</div></div>' +
    '<div class="op" aria-hidden="true">→</div>' +
    '<div class="c"><div class="k">您的实收金额</div><div class="v unknown">少于 ' + amt(deal.amt) + '</div>' +
      '<div class="x">平台不预知、不代收、不垫付，也不展示预估金额</div></div>' +
  '</div>' +
  '<p class="hint" style="margin-top:9px"><b style="color:var(--warn)">但您需要偿还的本金仍按融资金额 ' +
    amt(deal.amt) + ' ' + CCY + ' 计算。</b>' +
    '债务本金、授信占用额、项目融资余额、项目在途金额、融资确认时的转移金额、还款计划的本息 —— ' +
    '一律按融资金额计，<b>不按实收计</b>。手续费是您为了把钱拿到手而付出的成本，不是本金的减少；' +
    '按实收计本金会让机构凭空少收一笔债权。<br>' +
    '这条同样写进下一步的商务条款摘要 —— 合同平台看不见，摘要是唯一能把"手续费承担方"与' +
    '"本金按融资金额计"带进线下合同正文的地方。</p>';

  /* ---- 第 ③ 步：盖章件 ---- */
  var files = S.ac.files || [];
  var step3 =
    CF.note('',
      '<b class="ls-b">本期平台不生成融资合同。</b>合同由双方<b class="ls-b">在平台外自行拟定与签署</b>，' +
      '平台只做两件事：提供上一步的商务条款摘要让线下合同与平台记录对得上，以及在这里承接盖章件上传。' +
      '<p>盖章件由<b class="ls-b">资金方</b>在放款前审核 —— 机构是出钱方，它有天然动机检查合同真伪与条款一致性。' +
      '<b class="ls-b">平台不审核、不担保合同的真伪与法律效力</b>：本模块的职责到"收下文件、校验格式与大小、' +
      '置业务为待放款、对机构可见"为止。上传后业务直接进 S-FD-3，<b class="ls-b">不设"待审核"中间态</b>。</p>') +
    '<div class="drop" role="button" tabindex="0" data-act="cq.upload" style="margin-top:14px">' +
      '<div class="ic" aria-hidden="true">↑</div><div><b>点击上传双方盖章件</b>' +
      '<div class="hint" style="margin-top:3px">PDF / JPG / PNG · 单文件 ≤ ' + SEAL_MAX_MB + ' MB · 最多 ' +
      SEAL_MAX_N + ' 个（沿用 WS-305 第 6 节贸易背景材料的既有基线，不另定一套）</div></div></div>' +
    (S.ac.upErr ? '<div class="ls-alert" style="margin-top:12px">' + CF.note('red', S.ac.upErr, '上传未完成') + '</div>' : '') +
    (files.length ? '<div style="margin-top:12px">' + files.map(function(fl, i){
      return '<div class="filecard" style="margin-top:8px"><div class="ic" aria-hidden="true">▤</div>' +
        '<div class="bd"><b>' + E(fl.n) + '</b><span>' + fl.s + ' · 上传于 ' + withTz(fl.at) + '</span></div>' +
        '<div class="act"><button class="btn sm" type="button" data-act="cq.rmFile" data-v="' + i + '">移除</button></div></div>';
    }).join('') + '</div>' : '') +
    '<div class="check" style="margin-top:14px">' +
      '<input type="checkbox" id="declOk" ' + (S.ac.declared ? 'checked' : '') +
      (files.length ? '' : ' disabled') + ' data-act="cq.declare">' +
      '<label for="declOk">我确认所上传合同的商务条款与本页摘要一致。' +
      '<span class="faint">（FD-16 · 未勾选时「确认接受」不可提交）</span></label></div>' +
    '<p class="hint">这是平台侧成本最低、唯一可得的"合同与业务数据相关联"的痕迹 —— 线下合同平台看不见，' +
    '没有这条声明，纠纷时平台连"双方是照着这组数字签的"都举证不出来。<br>' +
    '<b>如实记录</b>：在放款环节承接处置能力之前，上传一份错误的盖章件，系统层面不会有任何人被要求去看它；' +
    '机构可以选择不放款，但平台<b>不提供"打回重传"</b>。这是一条已知的开口。</p>';

  var readyToAccept = done.account && done.terms && done.seal;
  /* WS-327 增量：初始还款计划摆在「接受报价 · 三步」之前——
     资产方接受报价**之前**就该知道这笔钱以后要怎么还、分几次、每次多少（US-34）。 */
  var body = initialPlanCard(deal, p) + '<div class="card" style="margin-top:16px">' +
    cardHead('接受报价 · 三步', '<span class="faint">FD-04 填写进度 · 不是状态</span>') +
    '<div class="card-b">' + prog + '</div>' +

    '<div class="card-head" style="border-top:1px solid var(--border)"><b>① 填写并确认收款账户</b>' +
      '<span style="margin-left:auto" class="faint">' + (done.account ? '已确认' : '待确认') + '</span></div>' +
    '<div class="card-b">' + step1 + '</div>' +

    '<div class="card-head" style="border-top:1px solid var(--border)"><b>② 查看商务条款摘要</b>' +
      '<span style="margin-left:auto" class="faint">' + (done.terms ? '已查看' : '待查看') + '</span></div>' +
    '<div class="card-b">' + termsSummary(deal, p, true) +
      (done.terms ? '' : '<div class="btnbar"><button class="btn" type="button" data-act="cq.termsSeen">' +
        '我已查看并抄录条款</button></div>') + '</div>' +

    '<div class="card-head" style="border-top:1px solid var(--border)"><b>③ 上传盖章件并声明</b>' +
      '<span style="margin-left:auto" class="faint">' + (done.seal ? '已完成' : '待完成') + '</span></div>' +
    '<div class="card-b">' + step3 + '</div>' +

    '<div class="card-b" style="border-top:1px solid var(--border)">' + fee +
      '<div class="btnbar even" style="margin-top:18px">' +
        '<button class="btn primary" type="button" ' + (readyToAccept ? '' : 'disabled ') +
          'data-act="cq.acceptConfirm">确认接受</button>' +
        '<button class="btn danger" type="button" data-act="cq.rejectOpen">拒绝报价</button></div>' +
      (readyToAccept ? '' : '<p class="hint">三步全部完成后方可确认接受：' +
        (done.account ? '' : '① 收款账户尚未逐笔确认；') +
        (done.terms ? '' : '② 商务条款摘要尚未查看；') +
        (done.seal ? '' : '③ 盖章件未上传或条款一致性声明未勾选。') + '</p>') +
      '<p class="hint">拒绝<b>随时可用</b>，服务端不设冷却期、不做理由审核。' +
      '拒绝与 ' + QUOTE_HOURS + ' 小时届满对额度与项目的后果<b>完全相同</b>，' +
      '差别只在状态落点与有没有原因：拒绝是您的意思表示（有原因、对机构可见、计入拒绝率），' +
      '届满是系统事件（无原因、不计入拒绝率）。</p>' +
      noChainFoot('接受与拒绝') +
    '</div></div>';

  var rail = '<aside class="portal-rail">' +
    '<div class="card">' + cardHead('锁定信息', '<span class="faint">D-LS-13 · 公开字段</span>') +
    '<div class="card-b">' + countdown(deal, true) + '</div></div>' +
    '<div class="card">' + cardHead('本期没有的东西', '<span class="faint">AC-LS-89 反向清单</span>') +
    '<div class="card-b"><p class="hint">本页<b>不存在</b>：任何由平台生成或提供合同文件的入口' +
      '（本期平台不生成融资合同，也没有可据以生成的模板）、任何表示平台已核验盖章件的措辞、' +
      '报价有效期的输入或可编辑控件、任何延长有效期的入口、机构侧撤销或改动已提交报价的入口、' +
      '收款账户的自由新建入口与账户簿、数币地址的可编辑控件。<br>' +
      '这些不是"还没做"，是本期明确不做，逐条写在验收清单里。</p></div></div>' +
    '<div class="card"><div class="card-b"><p class="hint">深链锚点 <span class="mono">deal/' + deal.id +
      '?action=respond_quote</span> · 已在附册 A0 预留，本模块正式交付。<br>' +
      '融资业务的公开信息也可从 <span class="mono">deal/' + deal.id + '</span> 直达。</p></div></div></aside>';

  return head + terms + pool + '<div class="portal-cols" style="margin-top:16px"><div>' + body + '</div>' + rail + '</div>';
}


/* ================================================================
   Part E —— 模块装配
   ================================================================ */

/* 提交终检的结果模拟：走通 6.2.5 与 6.5 的各条分支。
   真实系统里这些结论一律由服务端在提交时刻实时重算给出（AC-FIN-06 / AC-CR-20）。 */
var SUBMIT_OUTCOMES = [
  ['ok',      '提交成功（生成编号 · 锁定需求）'],
  ['taken',   'E-CR-03 并发：已被其他机构抢先报价'],
  ['invalid', 'E-CR-17 实时判定：该需求当场失效（池内担保不足）'],
  ['recalc',  'E-CR-18 实时重算超时或失败'],
  ['credit',  'E-CR-02 期间产生新的在途报价，授信重跑不通过']
];

function submitResultCard(){
  var r = S.result;
  if(!r) return '';
  var box;
  if(r.k === 'ok'){
    box = CF.note('green',
      '融资业务编号 <b class="ls-b">' + r.id + '</b> 已生成，汇率快照已锁定，' + QUOTE_HOURS + ' 小时计时已开始 —— ' +
      '本报价将于 <b class="ls-b">' + withTz(r.until) + '</b> 自动失效。' +
      '<p>同一次结算内：在途报价金额 +<span class="mono">' + usd(r.amt) + '</span>、业务落 <b class="ls-b">S-FD-1 待接受</b>、' +
      '项目转 <b class="ls-b">S-FP-3 已锁定</b>；<b class="ls-b">项目在途金额不变</b>。' +
      '报价一经提交不可修改、不可撤回。</p>', '报价提交成功');
  } else if(r.k === 'taken'){
    box = CF.note('amber',
      '该需求已被其他机构报价 —— <b class="ls-b">先到先得</b>，同一时刻至多承载一笔在途融资业务。' +
      '<p>本次提交<b class="ls-b">不产生占用、不生成编号、不改变项目状态</b>：编号只在提交成功的同一时刻生成，不预先占号。' +
      '您的授信额度没有任何变化。</p>', '并发提交，本笔未成功');
  } else if(r.k === 'invalid'){
    box = CF.note('red',
      '<b class="ls-b">该融资需求已失效（池内担保不足）。</b>服务端在提交时刻实时重算了有效质押价值、融资上限与项目融资余额，' +
      '判据成立：' + r.detail + '。' +
      '<p>资产方补足担保并重新发布后可再次报价。本次报价<b class="ls-b">不提交、不生成编号、不产生任何占用</b>；' +
      '该需求上若已有其他在途报价，也一并失效。</p>' +
      '<p>代币失效由上游按日判定、经后台重算回流，从代币实际失效到派生量更新之间存在时间差 —— ' +
      '判据在您提交之前就已成立，提交只是让它被发现。</p>', '需求已失效');
  } else if(r.k === 'recalc'){
    box = CF.note('amber',
      '<b class="ls-b">暂时无法完成担保校验，请稍后重试。</b>实时重算所依赖的代币或汇率数据此刻不可读。' +
      '<p>本次<b class="ls-b">不生成编号、不产生占用，也不会使该需求失效</b>。' +
      '校验失败时<b class="ls-b">既不放行、也不退回读缓存值</b> —— 读缓存正是实时重算这条规则要堵的口子。</p>',
      '校验暂不可用');
  } else {
    box = CF.note('amber',
      '授信重跑不通过：这段时间里本机构在别处产生了新的在途报价，当前可用授信 <span class="mono">' +
      usd(r.avail) + '</span>，本次报价 <span class="mono">' + usd(r.amt) + '</span>，差额 <span class="mono">' +
      usd(r.gap) + '</span>。' +
      '<p>回到授信步骤（追加模式）并展示新的差额，<b class="ls-b">不报错、不把您踢出流程</b>。' +
      '已核定的额度不回滚。</p>', '授信重跑不通过');
  }
  return '<div class="ls-alert">' + box + '</div>';
}

var mod = {
  end:'asset', home:'P-LS-05',
  dict:{ en:{}, zh:{} },
  owns:['P-LS-04','P-LS-05','P-LS-06'],
  topbarPrd:false,
  states:{
    'P-LS-04':[['default','Default','默认'],['loading','Loading','加载中'],['error','Load failed','加载失败']],
    'P-LS-05':[['default','Default','默认'],['loading','Loading','加载中'],
               ['error','Load failed','加载失败'],['gone','Not quotable','不可报价']],
    'P-LS-06':[['default','Default','默认'],['loading','Loading','加载中'],['error','Load failed','加载失败']]
  },
  state:function(){
    return { lang:'zh', role:'fund',
             pid:'FP-20260820-0036',          /* 默认落在「额度不足 → 追加」分支 */
             did:'FD-20260908-0061',          /* 默认落在本方提交、剩余 4 天的那笔 */
             cr:{ amtRaw:null, until:null, memo:'' },
             qt:{ ccy:'USD', rate:null, acct:{}, creditDone:false, creditBranch:null, outcome:'ok' },
             ac:{ dealId:null, payee:{}, acctConfirmed:false, termsSeen:false,
                  files:[], declared:false, imOpen:false, upErr:null, reject:'' },
             result:null, modal:null };
  },
  onBoot:function(st){
    S = st;
    /* 收款账户预填：该企业主体最近一次成功接受时使用的账户（D-FIN-94），可改 */
    S.ac.payee = JSON.parse(JSON.stringify(LAST_PAYEE));
    S.ac.dealId = S.did;
    var d0 = findDeal(S.did);
    if(d0 && d0.prog === 'account') S.ac.acctConfirmed = true;
  },
  /* 身份切换走顶栏上下文操作区（portal 规范 §3「语言/上下文操作分区」）；
     数据状态切换走公共 stateBar。模块不自带底部演示条。 */
  topExtra:function(){
    return '<div class="seg" role="group" aria-label="演示身份">' +
      ['guest','asset','fund'].map(function(k){
        return '<button type="button" data-act="cq.role" data-v="' + k + '" aria-pressed="' + (S.role===k) + '">' +
          ACTORS[k].t + '</button>'; }).join('') + '</div>';
  },
  crumbParts:function(){ return []; },
  /* 提交结果紧跟页头之后呈现（各页 head 末尾的 submitResultCard 槽位）；
     五类结局各有独立页面态与独立出路，不存在只写"操作失败"的兜底。 */
  content:function(){
    return S.page === 'P-LS-04' ? pageCredit() : S.page === 'P-LS-06' ? pageRespond() : pageQuote();
  },
  modals:{
    /* 提交前二次确认：五件事必须讲清（AC-CR-11），必须显式确认才可提交 */
    qtConfirm:function(){
      var p = findProject(S.pid), c = creditCheck(p.entity, p.demand), f = quoteForm(p);
      var until = tstr(tmin(NOW) + QUOTE_HOURS * 60);
      return '<div class="mask" data-act="cq.mclose"><div class="modal wide" role="dialog" aria-modal="true">' +
        '<div class="modal-h"><b>提交报价前，请确认以下五件事</b>' +
        '<button class="modal-x" type="button" data-act="cq.mclose" aria-label="关闭">✕</button></div>' +
        '<div class="modal-b">' +
        '<div class="rows" style="box-shadow:none">' +
        [['① 提交后不可修改、不可撤回',
          '商务条款在提交的同一时刻固化。本期<b>没有</b>撤回与修改入口，机构侧唯一的后续动作是等待资产方处理。'],
         ['② 提交即锁定该需求',
          '项目转 S-FP-3 已锁定，<b>其他机构无法再报价</b>，直至您被拒绝或 ' + QUOTE_HOURS + ' 小时届满。'],
         ['③ 将占用本机构对该资产方 ' + amt(p.demand) + ' ' + CCY + ' 的授信',
          '在途报价金额 ' + amt(c.fly) + ' → ' + amt(round2(c.fly + p.demand)) + '；提交后可用授信 ' +
          amt(Math.max(0, round2(c.avail - p.demand))) + '。<b>授信占用额与项目在途金额都不变。</b>'],
         ['④ ' + QUOTE_HOURS + ' 小时内资产方未处理将自动失效、额度自动释放',
          '到期时刻 <b>' + withTz(until) + '</b>。到点即失效，由系统自动执行，不依赖任何人登录；' +
          '<b>无展期、无宽限期、无续期</b>。'],
         ['⑤ 提前解除只能由资产方拒绝',
          '期间您的授信额度被自己占着，报错了条款也退不掉 —— 这是本期明确接受的代价。']
        ].map(function(r){
          return '<div class="row"><div class="row-main"><div class="row-k">' + E(r[0]) + '</div>' +
            '<div class="row-v" style="color:var(--muted);font-size:12.5px;line-height:1.6">' + r[1] + '</div></div></div>';
        }).join('') + '</div>' +
        '<div class="ls-pick" style="margin-top:14px">' +
          '<span>结算 <span class="n">' + amt(f.settle) + '</span> ' + f.ccy + '</span><span class="sp"></span>' +
          '<span>年化 <span class="n">' + (f.rate ? f.rate.toFixed(2) : '—') + '%</span></span><span class="sp"></span>' +
          '<span>汇率快照 <span class="n">' + f.fx.v.toFixed(4) + '</span> · ' + f.fx.ver + '</span></div>' +
        '<div class="check" style="margin-top:14px"><input type="checkbox" id="qtAck" ' +
          (S.qt.ack ? 'checked' : '') + ' data-act="cq.qtAck">' +
          '<label for="qtAck">我已阅读并理解以上五条，确认提交本次报价。</label></div>' +
        '<p class="hint">原型内的结果模拟：选择服务端终检的返回，用于走通 6.2.5 与 6.5 的各条分支。' +
        '真实系统里这些结论一律由服务端在提交时刻实时重算给出。</p>' +
        '<select class="inp" data-f="submitOut" id="submitOut">' +
          SUBMIT_OUTCOMES.map(function(o){ return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="modal-f"><button class="btn" type="button" data-act="cq.mclose">取消</button>' +
        '<button class="btn primary" type="button" ' + (S.qt.ack ? '' : 'disabled ') +
        'data-act="cq.qtSubmit">确认提交报价</button></div></div></div>';
    },
    /* 接受的最终确认：把不可逆的后果与已固化的条款再列一次 */
    acceptConfirm:function(){
      var deal = findDeal(S.did), p = findProject(deal.pid);
      return '<div class="mask" data-act="cq.mclose"><div class="modal wide" role="dialog" aria-modal="true">' +
        '<div class="modal-h"><b>确认接受该报价</b>' +
        '<button class="modal-x" type="button" data-act="cq.mclose" aria-label="关闭">✕</button></div>' +
        '<div class="modal-b">' +
        '<div class="rows" style="box-shadow:none">' +
        [['融资业务将转 S-FD-3 待放款', '项目转 S-FP-4 融资中，' + QUOTE_HOURS + ' 小时有效期计时<b>终止</b>，此后页面不再显示倒计时。'],
         ['在途报价金额不变', '业务仍在途，尚未成为未偿本金。放款与融资确认完成时才会原子转入授信占用额。'],
         ['本金按融资金额 ' + amt(deal.amt) + ' ' + CCY + ' 计', '跨境手续费由您承担，实收会少于融资金额，<b>但本金不按实收计</b>。'],
         ['盖章件已收下，平台不审核', '由资金方在放款前审核真伪与条款一致性。平台不审核、不担保合同的真伪与法律效力。']
        ].map(function(r){
          return '<div class="row"><div class="row-main"><div class="row-k">' + E(r[0]) + '</div>' +
            '<div class="row-v" style="color:var(--muted);font-size:12.5px;line-height:1.6">' + r[1] + '</div></div></div>';
        }).join('') + '</div>' +
        '<p class="hint">原型内的结果模拟：<span class="mono">E-CR-13</span> 演示"报价到期时刻与您的提交撞在一起"' +
        '—— 以服务端落库时刻为准并串行结算，任何情况下占用只释放一次。</p>' +
        '<select class="inp" data-f="acceptOut" id="acceptOut">' +
          '<option value="ok">接受成功（先落库）</option>' +
          '<option value="expired">E-CR-13：报价已先一步失效</option></select>' +
        '</div>' +
        '<div class="modal-f"><button class="btn" type="button" data-act="cq.mclose">再想想</button>' +
        '<button class="btn primary" type="button" data-act="cq.acceptSubmit">确认接受</button></div></div></div>';
    },
    reject:function(){
      var deal = findDeal(S.did);
      var v = S.ac.reject || '';
      var ok = v.trim().length >= 1 && v.trim().length <= REASON_MAX;
      return '<div class="mask" data-act="cq.mclose"><div class="modal" role="dialog" aria-modal="true">' +
        '<div class="modal-h"><b>拒绝报价</b>' +
        '<button class="modal-x" type="button" data-act="cq.mclose" aria-label="关闭">✕</button></div>' +
        '<div class="modal-b">' +
        '<p class="lead" style="margin-top:0">拒绝 ' + E(deal.fund) + ' 的报价 <span class="mono">' + deal.id +
        '</span>（' + amt(deal.amt) + ' ' + CCY + ' · 年化 ' + deal.rate.toFixed(2) + '%）。</p>' +
        field('拒绝原因', '必填 · 1～' + REASON_MAX + ' 字',
          '<textarea class="inp" rows="4" maxlength="' + REASON_MAX + '" ' +
          'placeholder="例如：年化利率高于我方可接受区间，若可下调至 8.20% 以内愿意重新评估。" ' +
          'data-act="cq.f" data-v="rejectReason">' + E(v) + '</textarea>',
          '自由文本、不设分类，<b>对报价机构可见</b> —— 否则机构不知道为什么被拒，只能盲目重报。' +
          '已填 ' + v.trim().length + ' / ' + REASON_MAX + ' 字。') +
        CF.note('',
          '拒绝后<b class="ls-b">同一次结算内</b>：业务落 S-FD-2 已拒绝（终态）、项目回 S-FP-2 募集中、' +
          '在途报价金额<b class="ls-b">全额释放</b>、项目在途金额<b class="ls-b">不变</b>、质押<b class="ls-b">不释放</b>。' +
          '<p>您<b class="ls-b">随时可以拒绝</b>，服务端不设冷却期、不做理由审核。' +
          '同一机构可在被拒后立即重新报价，本期不设冷却与次数限制。</p>') +
        '</div>' +
        '<div class="modal-f"><button class="btn" type="button" data-act="cq.mclose">取消</button>' +
        '<button class="btn danger" type="button" ' + (ok ? '' : 'disabled ') +
        'data-act="cq.rejectSubmit">确认拒绝</button></div></div></div>';
    }
  },
  hash:{
    build:function(){
      if(S.page === 'P-LS-06') return '#/deal/' + (S.did || '') + '?action=respond_quote';
      if(S.page === 'P-LS-04') return '#/project/' + (S.pid || '') + '?action=quote';
      return '#/project/' + (S.pid || '') + '?action=quote';
    },
    read:function(){
      var h = (location.hash || '').replace(/^#\/?/, ''); if(!h) return false;
      var parts = h.split('?'), seg = parts[0].split('/'), qs = {};
      (parts[1] || '').split('&').forEach(function(kv){
        var i = kv.indexOf('='); if(i > 0) qs[kv.slice(0,i)] = decodeURIComponent(kv.slice(i+1)); });
      if(seg[0] === 'project'){
        var p = findProject(seg[1]);
        /* 不存在 / 状态已变：落说明页而非 404、白屏或静默跳首页（H-02 / AC-LS-93） */
        if(!p){ S.page = 'P-LS-05'; S.pid = seg[1]; S.st = 'gone'; return true; }
        S.pid = seg[1]; S.st = 'default';
        /* 先问 available_actions 能不能报价（前四个条件），再谈第五个条件决定走哪一步。
           顺序反了的话，一个已到期 / 已被他人报价 / 需求已失效的项目，会因为该资产方的
           授信恰好不足而被送进授信表单 —— 机构在一个根本不能报价的需求上先被要求掏额度。 */
        if(!actionOf(availableActions(p, 'fund'), 'quote').enabled){ S.page = 'P-LS-05'; return true; }
        S.page = (creditCheck(p.entity, p.demand).branch === 'enough' || S.qt.creditDone) ? 'P-LS-05' : 'P-LS-04';
        return true;
      }
      if(seg[0] === 'deal'){
        var d = findDeal(seg[1]);
        S.page = 'P-LS-06'; S.did = seg[1]; S.st = 'default';
        if(d){ S.ac.dealId = d.id; S.ac.acctConfirmed = (d.prog === 'account'); }
        return true;
      }
      return false;
    }
  },
  onGo:function(){ S.modal = null; },
  onAct:function(n, a, v){
    if(a.indexOf('cq.') !== 0) return false;
    switch(a){
      case 'cq.role':
        S.role = v; S.result = null; CF.render(); return true;

      case 'cq.why':
        toast('info', '该操作当前不可用', n.getAttribute('title') || ''); return true;

      case 'cq.do':
        if(v === 'respond'){ CF.go('P-LS-06'); return true; }
        CF.go('P-LS-05'); return true;

      /* 表单字段的读写由下面自挂的 input / change 一层负责；点击本身不重绘，
         否则点进输入框的那一下就会把光标位置冲掉。 */
      case 'cq.f': return true;

      /* ---- P-LS-04 授信核定 ---- */
      case 'cq.crSubmit': {
        var p1 = findProject(S.pid), c1 = creditCheck(p1.entity, p1.demand), f1 = creditForm(c1, p1);
        if(!f1.ok) return true;
        var cr = c1.cr;
        if(!cr){
          cr = { id:'CR-' + dayOnly(NOW).replace(/-/g,'') + '-0021', entity:p1.entity, party:p1.owner,
                 limit:0, st:'S-CR-1', openedAt:dayOnly(NOW), until:f1.until, used:0, memo:S.cr.memo || '', log:[] };
          CREDITS.push(cr);
        }
        var from = cr.limit;
        cr.limit = f1.after; cr.st = 'S-CR-1'; cr.until = f1.until;
        if(S.cr.memo) cr.memo = S.cr.memo;
        cr.log.push({ at:dayOnly(NOW), k:BRANCH[f1.b].t, from:from, to:cr.limit, until:cr.until });
        S.qt.creditDone = true; S.qt.creditBranch = f1.b;
        S.cr = { amtRaw:null, until:null, memo:'' };
        toast('success', '授信已' + BRANCH[f1.b].verb + '并生效',
          '额度 ' + usd(from) + ' → ' + usd(cr.limit) + '，有效期至 ' + cr.until +
          '。已自动回到报价表单并重跑两道校验。');
        CF.go('P-LS-05'); return true;
      }

      /* ---- P-LS-05 报价 ---- */
      case 'cq.qtConfirm': S.qt.ack = false; S.result = null; S.modal = { type:'qtConfirm' }; CF.render(); return true;
      case 'cq.qtAck': S.qt.ack = n.checked; CF.render(); return true;
      case 'cq.qtSubmit': {
        var out = (q('#submitOut') || {}).value || 'ok';
        var p2 = findProject(S.pid), c2 = creditCheck(p2.entity, p2.demand);
        S.modal = null; S.qt.ack = false;
        if(out === 'ok'){
          var id = 'FD-' + dayOnly(NOW).replace(/-/g,'') + '-0072';
          var f2 = quoteForm(p2);
          DEALS.push({ id:id, pid:p2.id, fund:ACTORS.fund.full, fundEntity:ACTORS.fund.entity,
            party:p2.owner, entity:p2.entity, amt:p2.demand, rate:f2.rate, ccy:f2.ccy,
            at:NOW, st:'S-FD-1', prog:'none',
            fx:{ v:f2.fx.v, at:NOW, src:f2.fx.src, ver:f2.fx.ver },
            payee:f2.fiat ? { bank:f2.a.bank, acct:f2.a.acct, name:f2.a.name, swift:f2.a.swift, country:f2.a.country }
                          : { chain:f2.a.chain, addr:f2.a.addr } });
          p2.status = 'S-FP-3';
          S.result = { k:'ok', id:id, amt:p2.demand, until:tstr(tmin(NOW) + QUOTE_HOURS * 60) };
          S.did = id; S.ac.dealId = id; S.ac.acctConfirmed = false;
          /* 项目已转 S-FP-3、报价入口按契约随即消失，留在 P-LS-05 只剩一张"不可报价"说明页。
             落到这笔业务自己的页面（deal/{id}），机构在那里看到公开条款与锁定倒计时。 */
          S.modal = null; CF.go('P-LS-06'); window.scrollTo(0, 0); return true;
        } else if(out === 'invalid'){
          var g2 = guaranteeCheck(p2);
          S.result = { k:'invalid',
            detail:amt(g2.cap) + ' − ' + amt(g2.bal) + ' − ' + amt(g2.earlier) + ' ＝ ' + amt(g2.head) +
                   '，小于本笔需求 ' + amt(g2.need) };
        } else if(out === 'credit'){
          S.result = { k:'credit', avail:round2(c2.avail * 0.4), amt:p2.demand,
                       gap:round2(p2.demand - c2.avail * 0.4) };
          S.qt.creditDone = false;
        } else {
          S.result = { k:out };
        }
        CF.render(); window.scrollTo(0, 0); return true;
      }

      /* ---- P-LS-06 接受 / 拒绝 ---- */
      case 'cq.acctConfirm': S.ac.acctConfirmed = n.checked; CF.render(); return true;
      case 'cq.termsSeen': S.ac.termsSeen = true; CF.render(); return true;
      case 'cq.copy':
        toast('info', '已复制商务条款摘要',
          '九项数据与融资业务的存值逐项一致，可直接抄进线下合同。它不是合同，也不产生法律效力。');
        return true;
      case 'cq.print':
        if(window.print) window.print();
        return true;
      case 'cq.enName':
        toast('info', '去主体资料补登英文名',
          '该入口由企业主体资料模块承接，不在本模块范围内。在它落地前，主体未登记英文名的资产方无法完成接受 —— ' +
          '这是一条已知的开口，如实记录，不掩饰。');
        return true;
      case 'cq.upload': {
        var fs = S.ac.files;
        if(fs.length >= SEAL_MAX_N){
          S.ac.upErr = '最多上传 ' + SEAL_MAX_N + ' 个文件，当前已有 ' + fs.length +
            ' 个。已上传的其他文件保留，请先移除不需要的再继续。';
          CF.render(); return true;
        }
        /* 第二个文件演示超限：就地提示具体原因（格式 / 大小 / 数量），不写"上传失败" */
        if(fs.length === 1 && !S.ac.sizeShown){
          S.ac.sizeShown = true;
          S.ac.upErr = '文件「融资合同-盖章件-背面扫描.tiff」未通过：① 格式为 TIFF，本期只接受 PDF / JPG / PNG；' +
            '② 大小 14.2 MB，超过单文件 ' + SEAL_MAX_MB + ' MB 上限。' +
            '<b>已上传的其他文件保留</b>，无需重传。';
          CF.render(); return true;
        }
        S.ac.upErr = null;
        fs.push({ n:'融资合同-双方盖章件-' + (fs.length + 1) + '.pdf',
                  s:(1.8 + fs.length * 0.6).toFixed(1) + ' MB', at:NOW });
        CF.render(); return true;
      }
      case 'cq.rmFile': S.ac.files.splice(+v, 1); if(!S.ac.files.length) S.ac.declared = false; CF.render(); return true;
      case 'cq.declare': S.ac.declared = n.checked; CF.render(); return true;

      case 'cq.acceptConfirm': S.modal = { type:'acceptConfirm' }; CF.render(); return true;
      case 'cq.acceptSubmit': {
        var ao = (q('#acceptOut') || {}).value || 'ok';
        var deal = findDeal(S.did), pr = findProject(deal.pid);
        S.modal = null;
        if(ao === 'expired'){
          deal.st = 'S-FD-11'; deal.void = 'timeout';
          deal.endAt = tstr(tmin(deal.at) + QUOTE_HOURS * 60);
          pr.status = 'S-FP-2';
          toast('info', '该报价已于 ' + withTz(deal.endAt) + ' 失效',
            '失效先落库，串行结算。占用只释放一次，不会重复释放。页面已切到终结态，不报错、不白屏。');
        } else {
          deal.st = 'S-FD-3'; deal.endAt = NOW; pr.status = 'S-FP-4';
          toast('success', '已接受报价',
            '业务转 S-FD-3 待放款，项目转 S-FP-4 融资中，' + QUOTE_HOURS + ' 小时有效期计时已终止。' +
            '在途报价金额不变 —— 业务仍在途，尚未成为未偿本金。放款与融资确认在 WS-326。');
        }
        CF.render(); window.scrollTo(0, 0); return true;
      }
      case 'cq.rejectOpen': S.modal = { type:'reject' }; CF.render(); return true;
      case 'cq.rejectSubmit': {
        var dl = findDeal(S.did), pj = findProject(dl.pid);
        if(!(S.ac.reject || '').trim()) return true;
        dl.st = 'S-FD-2'; dl.reject = S.ac.reject.trim(); dl.endAt = NOW;
        pj.status = 'S-FP-2';
        S.modal = null; S.ac.reject = '';
        toast('success', '已拒绝该报价',
          '业务落 S-FD-2 已拒绝（终态），项目回 S-FP-2 募集中，在途报价金额全额释放；' +
          '项目在途金额不变、质押不释放。拒绝原因对该机构可见。');
        CF.render(); window.scrollTo(0, 0); return true;
      }

      case 'cq.mclose':
        if(n.classList.contains('mask') || n.classList.contains('modal-x') || n.tagName === 'BUTTON'){
          S.modal = null; CF.render();
        }
        return true;
    }
    return false;
  }
};

/* ---- 表单字段回写 ----
   公共壳层在 document 上只挂了 click；它头部注释里提到的 onInput(n,k) 钩子**没有实装**
   （shell.js 全文没有 input / change 的监听）。本模块三页都是表单页，必须拿到这两个事件，
   因此在这里自挂一层——只认本模块的 data-act="cq.f"，不接管公共层的任何分发、不改 _shared。
     input  → 只回写状态，**不重绘**：重绘会把正在输入的那个框的焦点与光标位置冲掉；
     change → 回写并重绘，派生读数（结算金额、校验结论、按钮可用性）在离焦或选择时随之更新。
   这样校验也不会在逐字输入的过程中闪烁报错，而是在离开字段时给一次结论。
   已作为对公共层的修订请求记在模块 README §5。 */
function writeField(v, val){
  if(v === 'crAmt')            S.cr.amtRaw = val;
  else if(v === 'crUntil')     S.cr.until = val;
  else if(v === 'crMemo')      S.cr.memo = val;
  else if(v === 'qtCcy'){      S.qt.ccy = val; S.qt.acct = {}; }
  else if(v === 'qtRate')      S.qt.rate = val;
  else if(v.indexOf('qt') === 0){
    var k = v.slice(2); S.qt.acct[k.charAt(0).toLowerCase() + k.slice(1)] = val;
  }
  else if(v.indexOf('pa_') === 0) S.ac.payee[v.slice(3)] = val;
  else if(v === 'rejectReason')   S.ac.reject = val;
}
function fieldNode(e){
  var n = e.target && e.target.closest ? e.target.closest('[data-act="cq.f"]') : null;
  return (n && n.getAttribute('data-v')) ? n : null;
}
document.addEventListener('input', function(e){
  var n = fieldNode(e); if(!n) return;
  writeField(n.getAttribute('data-v'), n.value);
});
document.addEventListener('change', function(e){
  var n = fieldNode(e); if(!n) return;
  writeField(n.getAttribute('data-v'), n.value);
  CF.render();
});

CF.define(mod);
CF.boot();

})();
