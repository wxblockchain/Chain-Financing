/* ==========================================================================
   借贷广场 · 融资需求与代币质押 —— 模块脚本
   本文件只写本模块的页面、文案、演示数据与状态；token / 公共组件 / 运行时
   全部来自 asset-platform/prototypes/_shared/。页面 ID 在 ../_shared/registry.js
   登记，模块不自造、不自建菜单。规则条文与编号追溯放在同目录 README.md。
   ========================================================================== */
(function(){
'use strict';
/* ===== 以下三段（演示数据 / 派生量 / 图表几何）与 v1.1 逐行同源，
   只把颜色引用从自建 token 换成 _shared/tokens.css 的系统 token。
   业务口径零变更。 ===== */

/* ================================================================
   20-data.js —— 常量与演示数据
   全部业务数据为演示数据（虚构企业、编号、金额、哈希），
   仅用于走通界面与交互，不代表任何真实主体或交易。
   ================================================================ */

/* ---- 口径常量（分册 7.3 枚举与常量） ---- */
var PLEDGE_RATE   = 0.8;   /* 质押率：硬编码常量 80%，非配置项、非数据对象（D-MC-110 / D-MC-111 / AC-LS-56） */
var TERM_YEARS    = 1;     /* 融资项目有效期：常量 1 年（D-FIN-37） */
var CCY           = 'USD'; /* 记账本位币（D-FIN-13） */
var CHAIN_TIMEOUT = 30;    /* 链上超时阈值：30 分钟（假设值，待开发按真实链况确认，D-FIN-70） */
var PAGE_SIZE     = 20;    /* P-LS-01 单页 20 条 */
var EXPIRY_NEAR   = [30, 7]; /* 到期提醒标记：到期前 30 天 / 7 天（AC-LS-03） */
var TODAY         = '2026-09-11';
var TZ_LABEL      = 'UTC+8'; /* 平台统一时区标注，口径引用 WS-308『01-国际化基线』 */
/* ---- WS-325 增量：报价有效期与锁定信息（D-CR-26 / D-LS-13）----
   口径主体在 WS-325，本模块只消费它回流的两个数（到期时刻、剩余有效期）并负责展示。
   倒计时必须由服务端给出到期时刻、前端只负责渲染（AC-LS-94）。 */
var NOW           = '2026-09-11 10:40'; /* 演示"当前时刻"，服务端时间 */
var QUOTE_HOURS   = 168;   /* 报价有效期常量 168 小时 ＝ 7 个自然日，不可配置、不可延长 */

/* ---- 状态枚举：一处定义，多处引用（AC-MC-14 / D-FIN-28） ---- */
var FP_STATUS = {
  'S-FP-1': { t:'草稿', x:'已建池 · 未发布', tone:'mute' },
  'S-FP-2': { t:'募集中', x:'公开接受报价',   tone:'info' },
  'S-FP-3': { t:'已锁定', x:'已有在途报价',   tone:'info' },
  'S-FP-4': { t:'融资中', x:'存在未结清融资业务', tone:'info' },
  'S-FP-5': { t:'已关闭', x:'质押已全部释放', tone:'mute' },
  'S-FP-6': { t:'已结清', x:'质押已全部释放', tone:'mute' }
};
var CT_STATUS = {
  'CT-0': { t:'未发起', tone:'mute' },
  'CT-1': { t:'处理中', tone:'warn' },
  'CT-2': { t:'成功',   tone:'good' },
  'CT-3': { t:'失败',   tone:'crit' }
};
var PS_STATUS = {
  'PS-1': '可质押',
  'PS-2': '已质押',
  'PS-4': '已释放'
};
/* 质押覆盖状态三档（主册 5.3.1，D-LS-17 已在 PRD V9.0 定稿）；PS-3 已作废，编号保留占位不复用 */
var GRADES = [
  { k:'normal',  t:'覆盖有余', x:'INV-FIN-01 成立且可融金额 > 0', tone:'good' },
  { k:'used-up', t:'覆盖持平', x:'已借的被池子完全覆盖，但不能再借；不提醒', tone:'warn' },
  { k:'short',   t:'覆盖不足', x:'融资上限 < 项目融资余额', tone:'crit' }
];

/* ---- 链上失败与等待的五类文案（分册 6.7.2，D-FIN-69 / D-FIN-70） ---- */
var CHAIN_OUTCOMES = {
  ok:      { k:'ok',      t:'全部成功' },
  partial: { k:'partial', t:'部分成功（按张独立结算 E-2）' },
  offchain:{ k:'offchain',t:'未上链失败 · 未扣费',
             head:'提交失败，本次未产生链上费用，可直接重试',
             body:'原因：节点返回 nonce 校验失败，交易未广播到链上。',
             fee:'本次未产生任何链上费用。', retry:'直接重试', tone:'crit' },
  onchain: { k:'onchain', t:'已上链失败 · 已扣费',
             head:'链上执行失败，本次 gas 已产生、不可退回',
             body:'原因：质押合约执行被回退（代币已被其他有效质押占用）。',
             fee:'本次 gas 已产生、不可退回；重试将发起一笔新交易并再次产生 gas。', retry:'重试（将产生新的 gas）', tone:'crit' },
  timeout: { k:'timeout', t:'超时未决',
             head:'等待链上结果超过 ' + CHAIN_TIMEOUT + ' 分钟，当前结果未知',
             body:'请先查询链上状态，确认未上链后再重试——直接重试可能造成重复转移与重复扣费。',
             fee:'是否已产生费用取决于交易是否已上链，需先查询确认。', retry:null, tone:'warn' },
  cancel:  { k:'cancel',  t:'在外部 SDK 内取消签名',
             head:'您取消了签名，本次未产生任何费用',
             body:'已回到本页，未产生任何记录变更。',
             fee:'本次未产生任何链上费用。', retry:'重新发起', tone:'mute' },
  nogas:   { k:'nogas',   t:'gas 不足',
             head:'钱包余额不足以支付本次链上费用',
             body:'请充值后重试。本次交易未发出，未产生费用。',
             fee:'本次未产生任何链上费用。', retry:'充值后重试', tone:'crit' }
};

/* ---- 身份（角色是同一份产物上的可切换视图） ---- */
var ACTORS = {
  guest: { k:'guest', t:'游客', full:'未登录访客', entity:null,  short:'游' },
  asset: { k:'asset', t:'资产方', full:'晟远科技（演示）', entity:'E-ASSET-01', short:'晟' },
  fund:  { k:'fund',  t:'资金方', full:'北岸融资租赁（演示）', entity:'E-FUND-07', short:'北' }
};

/* ---- 演示用买方企业与合同号池 ---- */
var BUYERS = ['北方制造集团（演示）','东海重工（演示）','南岭电力设备（演示）','中垣建材（演示）','明泰家电（演示）','瑞和能源装备（演示）','恒盛供应链（演示）'];

function seq(n){ var a=[],i; for(i=0;i<n;i++){a.push(i);} return a; }

/* 把总额确定性地切成 n 张，金额落在 4 万～20 万之间，便于阅读 */
function splitAmount(total, n, seed){
  var w=[], i, s=0;
  for(i=0;i<n;i++){ var x = 60 + ((seed*37 + i*53) % 90); w.push(x); s += x; }
  var out=[], acc=0;
  for(i=0;i<n-1;i++){ var v = Math.round(total*w[i]/s/1000)*1000; out.push(v); acc+=v; }
  out.push(total-acc);
  return out;
}

var tokenSeq = 0;
function mkTokens(cfg){
  /* cfg: {total, n, seed, voidTotal, voidN, due, ct} */
  var amounts = splitAmount(cfg.total - (cfg.voidTotal||0), cfg.n - (cfg.voidN||0), cfg.seed);
  var list = [], i;
  for(i=0;i<amounts.length;i++){
    tokenSeq++;
    list.push({
      id:'TI-2026-' + String(4100 + tokenSeq),
      amt:amounts[i],
      due:cfg.due[i % cfg.due.length],
      buyer:BUYERS[(cfg.seed + i) % BUYERS.length],
      contract:'HT-2026-' + String(700 + tokenSeq),
      invoice:'FP' + String(93100 + tokenSeq * 7),
      ct: cfg.ct || 'CT-2',
      dead:false,
      hash:'0x' + (cfg.seed*7+i).toString(16).padStart(2,'0') + 'b4e9c1a7f2038d5e6041c98a2b7d3e5f10496c8adb3f72e5104c9b8a3f6d2e' + String(10+i)
    });
  }
  if(cfg.voidN){
    var vAmounts = splitAmount(cfg.voidTotal, cfg.voidN, cfg.seed+5);
    for(i=0;i<vAmounts.length;i++){
      tokenSeq++;
      list.push({
        id:'TI-2026-' + String(4100 + tokenSeq),
        amt:vAmounts[i],
        due:cfg.voidDue ? cfg.voidDue[i % cfg.voidDue.length] : '2026-08-15',
        buyer:BUYERS[(cfg.seed + i + 2) % BUYERS.length],
        contract:'HT-2026-' + String(700 + tokenSeq),
        invoice:'FP' + String(93100 + tokenSeq * 7),
        ct:'CT-2',
        dead:true,
        deadAt:cfg.deadAt || '2026-08-19',
        hash:'0x' + (cfg.seed*9+i).toString(16).padStart(2,'0') + 'c72fa5e30bd1497c2a8e6f05d3b91746ea0c28df53961bb47ce02a8f6d15b3' + String(20+i)
      });
    }
  }
  return list;
}

/* ================================================================
   融资项目（＝资产池＝广场上的一条融资需求，D-LS-11：同一个对象）
   events[] 同时驱动两张图与历史时间线，保证口径一处产生、多处消费
   ================================================================ */
var PROJECTS = [
  {
    id:'FP-20260416-0007', name:'长三角医疗器械应收账款池',
    owner:'晟远科技（演示）', entity:'E-ASSET-01',
    /* 2026-07-10 再次发布剩余额度后由 S-FP-4 回到 S-FP-2（主册 6.1 / 4.3 状态机） */
    status:'S-FP-2', expired:false,
    publishedAt:'2026-04-20', expiresAt:'2027-04-20',
    demand:200000,               /* 当前在途需求，发布于 2026-07-10 */
    quotes:2, assetType:'应收账款类',
    tokens:mkTokens({ total:900000, n:9, seed:1, voidTotal:300000, voidN:2,
                      due:['2026-11-20','2026-12-05','2027-01-18','2026-10-30'],
                      voidDue:['2026-08-10','2026-08-18'], deadAt:'2026-08-19' }),
    events:[
      { d:'2026-04-16', k:'pledge',   t:'创建资产池 · 首笔质押 10 张',            dTotal:1000000, note:'链上转入成功（CT-2）后才计入有效质押价值（D-FIN-40 / AC-LS-28）' },
      { d:'2026-04-20', k:'publish',  t:'发布融资需求 500,000.00 USD',            dFly:500000,    note:'发布即产生在途占用，唯一来源（AC-FIN-23）' },
      { d:'2026-05-06', k:'quote',    t:'收到机构报价 500,000.00 USD',                            note:'报价不新增占用，项目在途金额保持不变（AC-FIN-23）' },
      { d:'2026-05-12', k:'fund',     t:'放款并完成融资确认',                      dFly:-500000, dBal:500000, note:'额度原子转移：项目在途金额 → 项目融资余额，无空档（AC-FIN-25）' },
      { d:'2026-06-12', k:'topup',    t:'追加质押 2 张 · 200,000.00 USD',          dTotal:200000,  note:'追加在 S-FP-1～S-FP-4 任何状态下都允许，只增不减（D-FIN-48）' },
      { d:'2026-07-03', k:'withdraw', t:'撤回质押 3 张 · 300,000.00 USD',          dTotal:-300000, note:'撤回时可撤回上限 575,000.00 USD，本次通过额度判定（AC-FIN-13 / AC-FIN-22）' },
      { d:'2026-07-10', k:'publish',  t:'再次发布融资需求 200,000.00 USD',          dFly:200000,    note:'S-FP-4 且可融金额 220,000.00 USD > 0，可再次发布剩余额度（6.1）' },
      { d:'2026-08-19', k:'invalid',  t:'池内 2 张代币底层应收账款失效 · 300,000.00 USD', dVoid:300000,
        note:'失效部分不计入有效质押价值；融资上限降至 480,000.00 USD，低于项目融资余额 500,000.00 USD，触发覆盖不足提醒（E-9 / 6.4.1）' },
      /* WS-327 增量：FD-20260512-0044 的还款计划与第 1 期还款。事件续接同一张公开时间线。 */
      { d:'2026-05-12', k:'plan',   t:'还款计划定稿 · 3 期 · 起息日 2026-05-12',
        note:'融资确认完成的同一次结算内定稿，起息日取实际放款日；到期日 2027-04-20 取项目有效期至（WS-327 D-RP-10 / D-RP-11 / D-RP-12）' },
      { d:'2026-08-12', k:'repay',  t:'第 1 期利息 8,688.89 USD 已提交还款记录 · 期次转 S-RP-2',
        note:'提交时刻即停止该期计息与逾期累加（D-FIN-11）；两个额度量一个都不动——钱有没有到只有机构知道（D-RP-37）' }
    ],
    /* WS-327 增量：公开的还款进度。本页**只读引用、不自行重算利息或逾期天数**（AC-LS-115）。
       第 1 期正常还款（应还日当天提交，无逾期标记），机构至今未确认——
       还款确认时限已届满，但期次状态、额度、权限一个都没变（D-RP-53 / D-RP-54）。 */
    rep:{ deal:'FD-20260512-0044', n:3, done:0, t0:'2026-05-12', tn:'2027-04-20',
          nextDue:'2026-11-12', nextTotal:8688.89, unpaidPri:500000,
          overdueDays:0, overdueSeq:null, overdueDue:null,
          hasDue:true, awaitConfirm:'RP20260512000001', rules:'年化单利，实际天数 ÷ 360，起息日计息、应还日不计息；起息日 = 2026-05-12' },
    terms:{ rate:'年化 6.80%（演示）', term:'180 天', repay:'到期一次性还本付息', use:'补充经营性流动资金' },
    deals:[
      { id:'FD-20260512-0044', amt:500000, st:'还款中', at:'2026-05-12', x:'放款并完成融资确认，计入项目融资余额' }
    ]
  },
  {
    id:'FP-20260812-0031', name:'华东电子元件应收账款池',
    owner:'晟远科技（演示）', entity:'E-ASSET-01',
    status:'S-FP-3', expired:false,
    publishedAt:'2026-08-14', expiresAt:'2027-08-14',
    demand:500000, quotes:1, assetType:'应收账款类',
    /* WS-325 增量：在途报价的公开商务条款 + 锁定信息（D-LS-13 / D-LS-14）。
       这四个公开字段由 WS-325 权威产出，本模块只读引用、不自行计算、不另存一份（AC-LS-94）。 */
    quote:{ deal:'FD-20260908-0061', fund:'北岸融资租赁（演示）', at:'2026-09-08 14:20',
            amt:500000, rate:7.20, ccy:'USD', settle:500000 },
    tokens:mkTokens({ total:1000000, n:3, seed:2, due:['2026-12-10','2027-01-25','2027-02-08'] }),
    events:[
      { d:'2026-08-12', k:'pledge',  t:'创建资产池 · 首笔质押 3 张', dTotal:1000000, note:'链上转入成功（CT-2）' },
      { d:'2026-08-14', k:'publish', t:'发布融资需求 500,000.00 USD', dFly:500000,  note:'项目在途金额 = 500,000.00 USD，可融金额 = 800,000 − 0 − 500,000 = 300,000.00 USD' },
      /* WS-326 增量：8 月那笔业务被资金方终止后需求回到广场，9 月被重新报价。
         终止的公开字段（时间 + 中性表述的原因）进时间线（D-LN-06 / FD-22 / FD-23）。 */
      { d:'2026-08-15', k:'quote',     t:'收到机构报价 500,000.00 USD（FD-20260815-0041）',
        note:'报价不新增占用（AC-FIN-23）' },
      { d:'2026-08-16', k:'accept',    t:'资产方接受报价 · 业务转 S-FD-3 待放款',
        note:'项目转 S-FP-4 融资中；在途报价金额不变——业务仍在途，尚未成为未偿本金（WS-325）' },
      { d:'2026-08-18', k:'terminate', t:'资金方终止业务 FD-20260815-0041',
        note:'终止原因（FD-22，对资产方可见、公开时中性表述）：合同主体名称与平台登记的企业主体不一致，两次沟通后未能提供更正件。' +
             '五个后果同一次结算内生效：在途报价金额全额释放且不进授信占用额、项目在途金额不变（需求还挂着）、' +
             '项目回 S-FP-2 募集中、质押不释放、编号保留但作废（WS-326 D-LN-24）' },
      { d:'2026-09-08', k:'quote',   t:'收到机构报价 500,000.00 USD', note:'项目转 S-FP-3 已锁定；报价不新增占用，项目在途金额不变（AC-FIN-23）' }
    ],
    terms:{ rate:'年化 7.20%（演示）', term:'150 天', repay:'到期一次性还本付息', use:'原材料采购' },
    deals:[]
  },
  {
    id:'FP-20260820-0036', name:'华南汽配应收账款池',
    owner:'恒盛供应链（演示）', entity:'E-ASSET-09',
    status:'S-FP-3', expired:false,
    publishedAt:'2026-08-21', expiresAt:'2027-08-21',
    demand:600000, quotes:2, assetType:'应收账款类',
    quote:{ deal:'FD-20260906-0059', fund:'环海商业保理（演示）', at:'2026-09-06 08:15',
            amt:600000, rate:9.20, ccy:'USD', settle:600000 },
    /* 历史报价进入时间线，按终结方式分别标注（分册 6.4.1） */
    pastQuotes:[
      { deal:'FD-20260901-0055', fund:'北岸融资租赁（演示）', at:'2026-09-01 09:30', amt:600000, rate:9.80,
        st:'S-FD-2', endAt:'2026-09-03 16:12',
        why:'年化 9.80% 高于我方本轮可接受区间（不超过 8.50%），且还款方式与我方现金流不匹配。' }
    ],
    tokens:mkTokens({ total:1200000, n:4, seed:3, due:['2026-11-28','2027-01-09','2027-02-20','2026-12-19'] }),
    events:[
      { d:'2026-08-20', k:'pledge',  t:'创建资产池 · 首笔质押 4 张', dTotal:1200000 },
      { d:'2026-08-21', k:'publish', t:'发布融资需求 600,000.00 USD', dFly:600000 },
      { d:'2026-09-02', k:'quote',   t:'收到机构报价 600,000.00 USD', note:'项目转 S-FP-3 已锁定；在途占用不变（AC-FIN-23）' }
    ],
    terms:{ rate:'年化 6.95%（演示）', term:'180 天', repay:'到期一次性还本付息', use:'供应商货款结算' },
    deals:[]
  },
  {
    id:'FP-20260705-0018', name:'珠三角家电应收账款池',
    owner:'明泰家电（演示）', entity:'E-ASSET-04',
    status:'S-FP-4', expired:false,
    publishedAt:'2026-07-08', expiresAt:'2027-07-08',
    demand:null, quotes:1, assetType:'应收账款类',
    tokens:mkTokens({ total:625000, n:5, seed:4, due:['2026-12-01','2027-01-15','2026-11-11','2027-03-02','2026-12-22'] }),
    events:[
      { d:'2026-07-05', k:'pledge',  t:'创建资产池 · 首笔质押 5 张', dTotal:625000 },
      { d:'2026-07-08', k:'publish', t:'发布融资需求 500,000.00 USD', dFly:500000 },
      { d:'2026-07-20', k:'quote',   t:'收到机构报价 500,000.00 USD', note:'在途占用不变（AC-FIN-23）' },
      { d:'2026-07-26', k:'fund',    t:'放款并完成融资确认', dFly:-500000, dBal:500000,
        note:'融资上限 500,000.00 = 项目融资余额 500,000.00，可融金额归零，进入「覆盖持平」档；INV-FIN-01 仍成立，不触发覆盖不足提醒（D-FIN-55）' },
      /* WS-327 增量：同一次结算内还款计划定稿，首期尚未到应还日。 */
      { d:'2026-07-26', k:'plan',    t:'还款计划定稿 · 3 期 · 起息日 2026-07-26',
        note:'首期应还日 2026-10-26，还款入口于应还日前 3 个自然日开启；本期不支持提前还款（WS-327 D-RP-26 / X-LS-40）' }
    ],
    /* WS-327 增量：尚无任何期次到期，因此没有逾期标记、没有待确认。 */
    rep:{ deal:'FD-20260726-0061', n:3, done:0, t0:'2026-07-26', tn:'2027-07-08',
          nextDue:'2026-10-26', nextTotal:9008.33, unpaidPri:500000,
          overdueDays:0, overdueSeq:null, overdueDue:null,
          hasDue:true, awaitConfirm:null, rules:'年化单利，实际天数 ÷ 360，起息日计息、应还日不计息；起息日 = 2026-07-26' },
    terms:{ rate:'年化 7.05%（演示）', term:'120 天', repay:'到期一次性还本付息', use:'渠道铺货' },
    deals:[ { id:'FD-20260726-0061', amt:500000, st:'还款中', at:'2026-07-26', x:'放款并完成融资确认' } ]
  },
  {
    id:'FP-20250916-0112', name:'西部能源设备应收账款池',
    owner:'瑞和能源装备（演示）', entity:'E-ASSET-06',
    status:'S-FP-2', expired:false,
    publishedAt:'2025-09-16', expiresAt:'2026-09-16',
    demand:200000, quotes:1, assetType:'应收账款类',
    pastQuotes:[
      { deal:'FD-20260825-0049', fund:'环海商业保理（演示）', at:'2026-08-25 11:00', amt:200000, rate:7.90,
        st:'S-FD-11', endAt:'2026-09-01 11:00', void:'有效期届满' }
    ],
    tokens:mkTokens({ total:400000, n:2, seed:5, due:['2026-11-05','2026-12-16'] }),
    events:[
      { d:'2025-09-14', k:'pledge',  t:'创建资产池 · 首笔质押 2 张', dTotal:400000 },
      { d:'2025-09-16', k:'publish', t:'发布融资需求 200,000.00 USD', dFly:200000 }
    ],
    terms:{ rate:'年化 7.40%（演示）', term:'90 天', repay:'到期一次性还本付息', use:'设备维保备件采购' },
    deals:[]
  },
  {
    id:'FP-20250820-0098', name:'北方建材应收账款池',
    owner:'中垣建材（演示）', entity:'E-ASSET-03',
    status:'S-FP-4', expired:true,
    publishedAt:'2025-08-20', expiresAt:'2026-08-20',
    demand:250000, quotes:3, assetType:'应收账款类',
    /* WS-326 增量：存量业务走到「待放款」。项目已到期只是并行标记，
       停止的是「接受新报价 / 再次发布」，存量业务照常走完（D-FIN-43 分支② / D-FIN-47）。
       fin 是 WS-326 权威产出的公开进度，本页只读引用、不自行计算（AC-LS-105）。 */
    fin:{ deal:'FD-20260903-0056', st:'S-FD-3', fund:'北岸融资租赁（演示）',
          amt:250000, ccy:'USD', settle:250000, rate:8.80, acceptedAt:'2026-08-05 11:20' },
    tokens:mkTokens({ total:1500000, n:5, seed:6, due:['2026-11-30','2027-01-07','2026-12-12','2027-02-14','2026-10-28'] }),
    events:[
      { d:'2025-08-18', k:'pledge',  t:'创建资产池 · 首笔质押 5 张', dTotal:1500000 },
      { d:'2025-08-20', k:'publish', t:'发布融资需求 900,000.00 USD', dFly:900000 },
      { d:'2025-09-02', k:'quote',   t:'收到机构报价 900,000.00 USD' },
      { d:'2025-09-10', k:'fund',    t:'放款并完成融资确认', dFly:-900000, dBal:900000 },
      { d:'2026-07-15', k:'publish', t:'再次发布融资需求 250,000.00 USD', dFly:250000,
        note:'可融金额 1,200,000 − 900,000 − 0 ＝ 300,000.00 USD > 0，可再次发布剩余额度（6.1）' },
      { d:'2026-08-02', k:'quote',   t:'收到机构报价 250,000.00 USD（FD-20260903-0056）' },
      { d:'2026-08-05', k:'accept',  t:'资产方接受报价 · 业务转 S-FD-3 待放款',
        note:'项目到期不终结在途业务：机构照常放款、资产方照常确认（WS-326 D-LN-15）' },
      { d:'2026-08-20', k:'expire',  t:'有效期到期 · 存在未结清融资业务，项目不关闭',
        note:'转「已到期 · 存量处理中」并行标记：停止接受新报价、不允许再次发布，存量走完后转 S-FP-6 并释放质押（D-FIN-43 分支②，按正常状态呈现 D-FIN-47）' },
      /* WS-327 增量：这一笔的三期还款。**利息期结清不递减任何额度**——
         项目融资余额与授信占用额都是未偿本金的合计，利息不在其中（D-RP-36），
         因此这两条 repay/rconf 事件不带 dBal / dFly。 */
      { d:'2025-09-10', k:'plan',   t:'还款计划定稿 · 3 期 · 起息日 2025-09-10',
        note:'末期应还日 2026-08-20 恒等于融资到期日（＝项目有效期至）；末期含全部本金 900,000.00 USD（WS-327 D-RP-13）' },
      { d:'2025-12-12', k:'rconf',  t:'第 1 期利息 15,015.00 USD 已结清',
        note:'利息期结清：项目融资余额与授信占用额**一动不动**——它们是未偿本金的合计（WS-327 D-RP-36）' },
      { d:'2026-03-12', k:'rconf',  t:'第 2 期利息 14,850.00 USD 已结清',
        note:'同上，利息不递减任何额度' },
      { d:'2026-08-21', k:'odue',   t:'第 3 期（含本金）逾期 · 应还日 2026-08-20',
        note:'应还日次日 00:00 起打逾期标记、逾期天数每日 +1，不设宽限期；业务打 S-FD-9 并行标记，**状态仍是 S-FD-6 还款中**。平台不计罚息、不触发任何质押处置（WS-327 D-RP-34 / D-RP-35 / X-LS-45 / X-LS-46）' }
    ],
    /* WS-327 增量：末期（含本金）已逾期 22 天且尚未提交。逾期期次的还款入口**保持开启**——
       关掉就等于不让人还钱（D-RP-35）。项目「已到期 · 存量处理中」与逾期是两个独立的并行标记。 */
    rep:{ deal:'FD-20250910-0012', n:3, done:2, t0:'2025-09-10', tn:'2026-08-20',
          nextDue:'2026-08-20', nextTotal:926895.00, unpaidPri:900000,
          overdueDays:22, overdueSeq:3, overdueDue:'2026-08-20',
          hasDue:true, awaitConfirm:null, rules:'年化单利，实际天数 ÷ 360，起息日计息、应还日不计息；起息日 = 2025-09-10' },
    terms:{ rate:'年化 6.60%（演示）', term:'360 天', repay:'到期一次性还本付息', use:'工程项目垫资' },
    deals:[ { id:'FD-20250910-0012', amt:900000, st:'已到期（存量履约中）', at:'2025-09-10', x:'本期无提前还款，还本发生在项目到期后（X-LS-06）' } ]
  },
  /* WS-326 增量：本方（晟远科技）名下一笔已放款、待融资确认的业务。
     加它是因为原有六个项目里没有一笔「本方 + S-FD-4」的业务，
     L6 的「确认到账」入口就只能停在 ⊘ 上，验收不到可用态（AC-LS-103）。
     放款与确认的权威数据在 WS-326，本页只读引用（AC-LS-105）。 */
  {
    id:'FP-20260624-0021', name:'华北仪器仪表应收账款池',
    owner:'晟远科技（演示）', entity:'E-ASSET-01',
    status:'S-FP-4', expired:false,
    publishedAt:'2026-06-24', expiresAt:'2027-06-24',
    demand:300000, quotes:1, assetType:'应收账款类',
    fin:{ deal:'FD-20260902-0054', st:'S-FD-4', fund:'北岸融资租赁（演示）',
          amt:300000, ccy:'USD', settle:300000, rate:8.35, acceptedAt:'2026-09-04 13:15',
          lnId:'LN20260905000001', lnAt:'2026-09-05 02:10', confirmTo:'2026-09-12 02:10' },
    tokens:mkTokens({ total:620000, n:7, seed:11,
                      due:['2026-11-18','2026-12-26','2027-01-30','2026-10-22','2027-02-11','2026-12-04','2027-03-15'] }),
    events:[
      { d:'2026-06-22', k:'pledge',  t:'创建资产池 · 首笔质押 7 张', dTotal:620000 },
      { d:'2026-06-24', k:'publish', t:'发布融资需求 300,000.00 USD', dFly:300000,
        note:'可融金额 ＝ 496,000 − 0 − 300,000 ＝ 196,000.00 USD' },
      { d:'2026-09-02', k:'quote',   t:'收到机构报价 300,000.00 USD（FD-20260902-0054）' },
      { d:'2026-09-04', k:'accept',  t:'资产方接受报价 · 业务转 S-FD-3 待放款' },
      { d:'2026-09-05', k:'disb',    t:'资金方提交放款记录 LN20260905000001 · 业务转 S-FD-4 待融资确认',
        note:'放款时四个量一个都不动：金额要到融资确认完成才从项目在途金额转入项目融资余额（WS-326 AC-FIN-25 / D-LN-07）。' +
             '融资确认时限自提交成功的服务端时间起算 168 小时（D-LN-31 / D-LN-32）' }
    ],
    terms:{ rate:'年化 8.35%（演示）', term:'150 天', repay:'到期一次性还本付息', use:'精密仪器采购' },
    deals:[]
  },
  /* ---- 终态样本（v1.5 新增）：已结清项目 ----
     REDEEMABLE 里那 3 张「项目结清释放」的代币本来就写着 from:'FP-20251103-0021'，
     但这个项目此前没有在 PROJECTS 里出现过，导致**终态下的全局操作区无从评审**。
     补上它，用来验证：终态下追加质押与关闭项目置为不可用并给原因，
     而「解除质押」入口仍然可用——D-FIN-57 的第二段由资产方自助发起、不设时限。
     池内 tokens 为空（业务释放已在结清同刻完成），代币现在躺在 REDEEMABLE 里等提取。 */
  {
    id:'FP-20251103-0021', name:'华中冷链应收账款池',
    owner:'晟远科技（演示）', entity:'E-ASSET-01',
    status:'S-FP-6', expired:false,
    publishedAt:'2025-11-05', expiresAt:'2026-11-05',
    demand:null, quotes:1, assetType:'应收账款类',
    tokens:[],
    events:[
      { d:'2025-11-03', k:'pledge',  t:'创建资产池 · 首笔质押 3 张', dTotal:350000 },
      { d:'2025-11-05', k:'publish', t:'发布融资需求 280,000.00 USD', dFly:280000 },
      { d:'2025-11-18', k:'quote',   t:'收到机构报价 280,000.00 USD' },
      { d:'2025-11-26', k:'fund',    t:'放款并完成融资确认', dFly:-280000, dBal:280000 },
      { d:'2025-11-26', k:'plan',    t:'还款计划定稿 · 2 期 · 起息日 2025-11-26' },
      { d:'2026-05-26', k:'rconf',   t:'第 1 期利息 9,660.00 USD 已结清' },
      { d:'2026-08-26', k:'settle',  t:'末期本息已结清 · 业务转 S-FD-8 已结清', dBal:-280000,
        note:'业务结清的同一时刻，项目转 S-FP-6 已结清、池内质押全额业务释放（即时、无链上动作、无费用）' },
      { d:'2026-08-26', k:'withdraw',t:'项目结清释放 3 张 · 280,000.00 USD 置「已释放 · 待提取」', dTotal:-350000,
        note:'第二段链上提取由资产方自助发起、无时间限制；未提取前不属于任何资产池、不计入任何质押价值（D-FIN-57）' }
    ],
    terms:{ rate:'年化 6.90%（演示）', term:'270 天', repay:'到期一次性还本付息', use:'冷链仓储运营' },
    deals:[ { id:'FD-20251126-0012', amt:280000, st:'已结清', at:'2025-11-26', x:'放款并完成融资确认' } ]
  },
  /* ---- 以下两条为草稿，不进广场（D-FIN-64 / AC-LS-05），仅本企业可见 ---- */
  {
    id:'FP-20260910-0051', name:'华北纺织应收账款池',
    owner:'晟远科技（演示）', entity:'E-ASSET-01',
    status:'S-FP-1', expired:false, draft:true,
    publishedAt:null, expiresAt:null,
    demand:null, quotes:0, assetType:'应收账款类',
    tokens:mkTokens({ total:600000, n:2, seed:7, due:['2026-12-28','2027-01-30'] }),
    events:[ { d:'2026-09-10', k:'pledge', t:'创建资产池 · 首笔质押 2 张', dTotal:600000,
               note:'第一段完成，项目已持久化；可离开页面后再回来续做第二段（AC-LS-54）' } ],
    terms:null, deals:[]
  },
  {
    id:'FP-20260911-0053', name:'西南物流应收账款池',
    owner:'晟远科技（演示）', entity:'E-ASSET-01',
    status:'S-FP-1', expired:false, draft:true, emptyPool:true,
    publishedAt:null, expiresAt:null,
    demand:null, quotes:0, assetType:'应收账款类',
    tokens:[],
    events:[ { d:'2026-09-11', k:'fail', t:'创建资产池 · 首笔质押 2 张 · 链上执行失败',
               note:'创建时那唯一一笔质押最终链上失败，项目保留为空池草稿（E-12 / D-FIN-62 / FP-25）' } ],
    terms:null, deals:[]
  }
];

/* ---- WS-327 增量：events[] 按日期升序归一化 ----
   两张图（seriesOf）与 P-LS-02 的公开时间线都假定 events[] 是升序的：
   seriesOf 按数组顺序逐条累加并把 e.d 当作 x 坐标，乱序会让折线往回跳。
   而逐轮追加增量的自然写法是**按主题成组追加**（WS-326 的放款一组、WS-327 的还款一组），
   不是按日期插队。在这里统一排一次序，比要求每个增量作者手工插到正确位置更不容易出错。
   稳定排序：同一天的多条事件保持各自的书写顺序。 */
PROJECTS.forEach(function(p){
  if(!p.events) return;
  p.events = p.events.map(function(e, i){ return [e, i]; })
    .sort(function(a, b){ return a[0].d === b[0].d ? a[1] - b[1] : (a[0].d < b[0].d ? -1 : 1); })
    .map(function(x){ return x[0]; });
});

/* ---- 资产方钱包：可质押代币（已按 6.3.1 六条筛选后的结果） ---- */
var WALLET = mkTokens({ total:555000, n:6, seed:8,
  due:['2026-12-04','2027-01-22','2026-11-19','2027-02-27','2026-12-30','2027-03-15'] });
WALLET.forEach(function(t){ t.ct='CT-0'; t.ps='PS-1'; });

/* ---- 已释放 · 待提取代币（PS-4 + PL-18，来自已结清项目 FP-20251103-0021） ---- */
var REDEEMABLE = mkTokens({ total:280000, n:3, seed:9, due:['2026-10-08','2026-11-02','2026-12-13'] });
REDEEMABLE.forEach(function(t){ t.ps='PS-4'; t.pending=true; t.from='FP-20251103-0021'; t.reason='项目结清释放'; });


/* ================================================================
   30-calc.js —— 派生量的唯一实现
   六个派生量、质押覆盖档位、可撤回上限只在这里算一次，
   卡片 / 详情 / 发布页 / 两张图全部消费同一份结果（AC-FIN-15 / H-04）。
   原型内为前端即时预览；真实系统提交时一律由服务端权威重算（AC-FIN-06）。
   ================================================================ */

/* ---- 格式化：USD 保留 2 位小数，界面标注币种（AC-FIN-14 / AC-FIN-18） ---- */
function amt(n){
  if(n===null||n===undefined) return '—';
  var neg = n<0; n = Math.abs(n);
  var s = n.toFixed(2), p = s.split('.');
  return (neg?'−':'') + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + p[1];
}
function usd(n){ return n===null||n===undefined ? '—' : amt(n) + ' ' + CCY; }
/* 坐标轴刻度：压缩取整，仅为可读性；精确值见悬浮提示、数据表与键值区 */
function axisAmt(n){
  if(n>=1000000) return '$' + (n/1000000).toFixed(n%1000000===0?0:1) + 'M';
  if(n>=1000)    return '$' + Math.round(n/1000) + 'K';
  return '$' + Math.round(n);
}
function intn(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function shortHash(h){ return h.slice(0,10) + '…' + h.slice(-6); }

/* ---- 日期 ---- */
function dnum(s){ var p=s.split('-'); return Date.UTC(+p[0], +p[1]-1, +p[2]) / 86400000; }
function dstr(n){ var d=new Date(n*86400000);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth()+1).padStart(2,'0') + '-' + String(d.getUTCDate()).padStart(2,'0'); }
function addYears(s, y){ var p=s.split('-'); return (+p[0]+y) + '-' + p[1] + '-' + p[2]; }
function daysTo(s){ return dnum(s) - dnum(TODAY); }
function mdLabel(s){ var p=s.split('-'); return p[1] + '/' + p[2]; }

/* ---- WS-325 增量：分钟级时间与时长（锁定信息 FD-13 / QT-13 用） ---- */
function tmin(s){
  var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  return m ? Date.UTC(+m[1], +m[2]-1, +m[3], +(m[4]||0), +(m[5]||0)) / 60000 : 0;
}
function tstr(mins){
  var d = new Date(mins * 60000), z = function(n){ return (n<10?'0':'') + n; };
  return d.getUTCFullYear() + '-' + z(d.getUTCMonth()+1) + '-' + z(d.getUTCDate()) +
         ' ' + z(d.getUTCHours()) + ':' + z(d.getUTCMinutes());
}
/* 精确到小时；不足 24 小时精确到分钟并加强提示（QT-13）。
   已锁定时长与剩余有效期相加恒为 168 小时 —— 条上的两段就是这条恒等式。 */
function fmtDur(mins){
  if(mins <= 0) return L('0 min','0 分钟');
  if(mins < 1440){
    var h = Math.floor(mins/60);
    return L((h ? h + ' h ' : '') + (mins % 60) + ' min',
             (h ? h + ' 小时 ' : '') + (mins % 60) + ' 分钟');
  }
  var d = Math.floor(mins/1440), hh = Math.floor((mins % 1440)/60);
  return L(d + (d === 1 ? ' day ' : ' days ') + hh + ' h', d + ' 天 ' + hh + ' 小时');
}
function quoteClock(q){
  var from = tmin(q.at), to = from + QUOTE_HOURS * 60, now = tmin(NOW);
  var left = Math.max(0, to - now);
  return { from:q.at, to:tstr(to), leftMin:left,
           heldMin:Math.min(QUOTE_HOURS * 60, Math.max(0, now - from)),
           soon:(left > 0 && left < 1440) };
}

/* ---- 到期提醒标记（AC-LS-03；触达依赖消息中心，本期只做页面标记） ---- */
function expiryFlag(p){
  if(!p.expiresAt) return null;
  var d = daysTo(p.expiresAt);
  if(d < 0)  return { tone:'mute', d:d, t:L('Expired','已到期'), x:L('Expiry date ' + p.expiresAt, '到期日 ' + p.expiresAt) };
  if(d <= EXPIRY_NEAR[1]) return { tone:'warn', d:d, t:L(d + ' days of term left', '有效期剩余 ' + d + ' 天'), x:L('7-day expiry flag','到期前 7 天标记') };
  if(d <= EXPIRY_NEAR[0]) return { tone:'warn', d:d, t:L(d + ' days of term left', '有效期剩余 ' + d + ' 天'), x:L('30-day expiry flag','到期前 30 天标记') };
  return null;
}

/* ================================================================
   事件流 → 时点序列。两张图、时间线、当前派生量同源。
   ================================================================ */
function seriesOf(p){
  var total=0, dead=0, bal=0, fly=0, pts=[], i;
  for(i=0;i<p.events.length;i++){
    var e = p.events[i];
    total += e.dTotal || 0;
    dead  += e.dVoid  || 0;
    bal   += e.dBal   || 0;
    fly   += e.dFly   || 0;
    pts.push(snap(e.d, total, dead, bal, fly, e));
  }
  /* 末点补到今天，让"当前处于哪一档"在图上有横向宽度可读 */
  var last = pts[pts.length-1];
  if(last && last.d !== TODAY) pts.push(snap(TODAY, total, dead, bal, fly, null));
  return pts;
}
function snap(d, total, dead, bal, fly, ev){
  var valid = total - dead;
  var cap   = round2(valid * PLEDGE_RATE);
  return {
    d:d, x:dnum(d), ev:ev,
    total:total,            /* 池内资产总额 FP-10（含失效，不参与校验） */
    dead:dead,              /* 失效代币价值 FP-19 */
    valid:valid,            /* 有效质押价值 FP-11 —— 一切校验只认这个数 */
    cap:cap,                /* 融资上限 FP-12 = FP-11 × 80% */
    bal:bal,                /* 项目融资余额 FP-13 */
    fly:fly,                /* 项目在途金额 FP-14（唯一来源为发布占用） */
    free:Math.max(0, round2(cap - bal - fly)),   /* 可融金额 FP-15 */
    short:cap < bal          /* 覆盖不足：融资上限 < 项目融资余额（档③） */
  };
}
function round2(n){ return Math.round(n*100)/100; }

/* ---- 当前派生量 ---- */
function derive(p){
  var pts = seriesOf(p), cur = pts[pts.length-1];
  var g = cur.short ? 'short' : (cur.free === 0 ? 'used-up' : 'normal');
  return {
    pts:pts,
    total:cur.total, dead:cur.dead, valid:cur.valid,
    cap:cur.cap, bal:cur.bal, fly:cur.fly, free:cur.free,
    grade:g,
    gap:      cur.short ? round2(cur.bal - cur.cap) : 0,             /* 覆盖缺口 FP-21 */
    need:     cur.short ? round2((cur.bal - cur.cap) / PLEDGE_RATE) : 0, /* 需追加资产价值 = 缺口 ÷ 80% */
    shortFrom:shortFrom(pts),
    /* 可撤回上限 FP-16 = 可融金额 ÷ 质押率（AC-FIN-22，AC-FIN-13 的代数变形） */
    wLimit:round2(cur.free / PLEDGE_RATE),
    deadCount:p.tokens.filter(function(t){ return t.dead; }).length,
    liveCount:p.tokens.filter(function(t){ return !t.dead; }).length
  };
}
/* 覆盖不足起始日：最后一段连续 short 区间的起点 */
function shortFrom(pts){
  var i, from=null;
  for(i=0;i<pts.length;i++){
    if(pts[i].short){ if(from===null) from = pts[i].d; }
    else from = null;
  }
  return from;
}
function gradeOf(p){ return derive(p).grade; }
function gradeMeta(k){ for(var i=0;i<GRADES.length;i++){ if(GRADES[i].k===k) return GRADES[i]; } return GRADES[0]; }

/* ---- 演示用 gas 预估（虚构值，仅用于走通费用区与二次确认） ---- */
function gasEstimate(n){ return (0.00042 * n + 0.00018).toFixed(5); }

/* ================================================================
   available_actions（H-03）
   服务端在每次读取时返回当前可执行动作清单，前端按其渲染、
   不自行依据状态推断；须区分「不可见」与「可见不可点 ⊘」，后者附原因。
   原型内由本函数就地模拟同一份契约。
   ================================================================ */
function availableActions(p, role){
  var d = derive(p), own = (role === 'asset' && p.entity === ACTORS.asset.entity), out = [];
  var guest = (role === 'guest');
  var st = p.status;
  var live = (st==='S-FP-1'||st==='S-FP-2'||st==='S-FP-3'||st==='S-FP-4');
  var stT = fpStatus(p);

  /* --- 报价：资金方动作，广场唯一对外入口 --- */
  var q = { key:'quote', label:L('Submit quote','立即报价'), anchor:'quote', primary:true, enabled:false, reason:'' };
  if(guest){
    q.reason = L('Not signed in. Sign in as a funder entity to quote; L1–L5 information is not hidden from signed-out visitors.',
                 '未登录。登录并以资金方企业主体进入后可发起报价；页面信息 L1～L5 不因未登录而隐藏。');
    q.brief = L('Sign-in required','需登录');
  } else if(role === 'asset'){
    q.reason = own ? L('You cannot quote on your own project.','不能为自己的项目报价。')
                   : L('This entity is not qualified as a funder and cannot quote.','当前企业主体未开通资金方资质，无法发起报价。');
    q.brief = own ? L('Your project','本方项目') : L('No funder licence','无资金方资质');
  } else if(p.draft){
    q.reason = L('Draft projects are not listed on the marketplace.','草稿项目不进广场。'); q.brief = L('Draft','草稿');
  } else if(d.grade === 'short'){
    q.reason = L('This project is undercollateralised and has stopped accepting new quotes (AC-LS-39). Shortfall ' + usd(d.gap) + '.',
                 '该项目质押覆盖不足，已暂停接受新报价（AC-LS-39）。当前覆盖缺口 ' + usd(d.gap) + '。');
    q.brief = g('covUnder');
  } else if(p.expired){
    q.reason = L('The project term has expired; no new quotes are accepted. Existing deals keep performing (D-FIN-43 branch 2).',
                 '该项目有效期已到期，停止接受新报价；存量融资业务照常履约（D-FIN-43 分支②）。');
    q.brief = L('Expired','已到期');
  } else if(st === 'S-FP-3'){
    q.reason = L('This project already has an open quote; at most one deal can be in flight at a time (D-FIN-33).',
                 '该项目已有在途报价，同一时刻至多承载一笔在途融资业务（D-FIN-33）。');
    q.brief = L('Already quoted','已有报价');
  } else if(!p.demand){
    q.reason = L('This project has no open financing demand.','该项目当前无在途融资需求。');
    q.brief = L('No open demand','无在途需求');
  } else if(d.free === 0){
    q.reason = L('Available to borrow is ' + usd(0) + '; no further commitment is possible (AC-FIN-12).',
                 '该项目可融金额为 ' + usd(0) + '，不能再新增占用（AC-FIN-12）。');
    q.brief = g('covFullyDrawn');
  } else if(st !== 'S-FP-2'){
    /* 对外只说需求的对外状态，不把内部 S-FP-* 的档位名搬到界面上（AC-LS-93） */
    var cdq = curDemand(p), cdt = cdq ? L(DST[cdq.st].t[0], DST[cdq.st].t[1]) : fpStatus(p);
    q.reason = L('This demand is "' + cdt + '"; only a demand awaiting quotes accepts new quotes.',
                 '该需求当前是「' + cdt + '」，只有「待报价」的需求接受新报价。');
    q.brief = cdt;
  } else {
    q.enabled = true;
    /* 报价与它的授信前置由 WS-325 承载，锚点沿用 H-02 既有体系，不新开一套跳转约定 */
    q.href = cqHref('#/project/' + p.id + '?action=quote');
  }
  out.push(q);

  /* --- 以下为资产方对自有项目的动作；非本方登录用户不可见（服务端归属过滤 AC-LS-06） --- */
  /* v1.3：游客不再逐动作返回 ⊘ + 各自原因，操作区收敛为单个「立即登录」（D-LS-14）。
     服务端动作鉴权与跨主体隔离一条不减（AC-LS-86），这里只是不再把它们画成按钮。 */
  /* v1.5：**全局三件事对本方资产方一律常驻**（需求方 09-14「全局操作按钮是常在的」）。
     它们从来不是按环节开关的——PRD 给的是量化判定：
       · 追加质押   D-FIN-48「S-FP-1～S-FP-4 任何状态下都允许，只增不减」
       · 解除质押   AC-FIN-13 视角 C 的可撤回上限 = 可融金额 ÷ 质押率（INV-FIN-01）
       · 关闭项目   6.1 的在途占用 / 未偿余额判定
     所以这一版把「按环节隐藏入口」改成「入口常在 + 提交时权威判定 + 拒绝时给出具体原因与数值」。
     判定条款一条未改，改的只是入口可见性与拒绝时的反馈形态。 */
  var NOAUTH = L('Not signed in. Project actions are limited to the owning entity.',
                 '未登录。项目动作仅对该项目所属企业主体开放。');
  var mine = own || guest;
  /* 终态：已关闭 / 已结清。池内质押已在同一时刻全部业务释放，不能再追加、也无从再关闭；
     但**提取已释放代币恰恰是这之后的主场**——D-FIN-57 的第二段由资产方自助发起、不设时限，
     未提取的代币仍在质押合约内。所以终态下「解除质押」入口必须保留可用。 */
  var terminal = (st === 'S-FP-5' || st === 'S-FP-6');
  if(mine){
    /* 发布是融资流程环节①的动作，不属于全局常驻三件；只在项目还活着时返回 */
    if(live){
      var pub = { key:'publish', anchor:'publish', enabled:false, reason:'',
                  label: st==='S-FP-1' ? g('publishDemand') : L('Republish / manage demand','再次发布 / 管理需求') };
      if(guest)                 pub.reason = NOAUTH;
      else if(p.emptyPool)      pub.reason = L('This project has no valid collateral; pledge again before publishing (D-FIN-62).',
                                               '本项目暂无有效质押，请重新质押后再发布（D-FIN-62）。');
      else if(d.valid <= 0)     pub.reason = L('Pledged token value is ' + usd(0) + ', which fails the publish check (D-FIN-61).',
                                               '有效质押价值为 ' + usd(0) + '，不满足发布校验（D-FIN-61）。');
      else if(p.expired)        pub.reason = L('The project term has expired; republishing is not allowed (D-FIN-43 branch 2).',
                                               '项目已到期，不允许再次发布（D-FIN-43 分支②）。');
      else if(d.free <= 0)      pub.reason = L('Available to borrow is ' + usd(0) + '; there is no headroom to publish (AC-FIN-12).',
                                               '可融金额为 ' + usd(0) + '，无可发布额度（AC-FIN-12）。');
      else pub.enabled = true;
      out.push(pub);
    }

    /* 追加质押：D-FIN-48 —— S-FP-1～S-FP-4 任何状态下都允许，只增不减地增强覆盖。
       报价中、放款中、还款中一律可点；只有终态不行。 */
    var pg = { key:'pledge', anchor:'pledge', label:g('addPledge'),
               enabled:(!guest && !terminal), primary:(d.grade === 'short'), reason:'' };
    if(guest) pg.reason = NOAUTH;
    else if(terminal) pg.reason = L('The project is in a terminal state (' + fpStatus(p) + '); its collateral has already been released, so nothing can be added.',
                                    '项目已是终态（' + fpStatus(p) + '），池内质押已全部释放，不能再追加。');
    out.push(pg);

    /* D-FIN-78：撤回质押与提取已释放代币合并为一个入口「解除质押」。
       入口**一律可点**（含终态）：两类代币各走各的判定——池内的受可撤回上限约束，
       合约里待提取的不做任何额度判定（D-FIN-57 第二段）。
       可撤回上限为 0 时不藏入口，而是在弹窗里给出上限数值与两条出路（AC-LS-37）。 */
    var w = { key:'release', anchor:'withdraw', label:g('releasePledge'), enabled:!guest, reason:(guest ? NOAUTH : ''),
              wLimit: d.wLimit,
              redeemable: (own ? REDEEMABLE.length : 0),
              redeemValue: (own ? REDEEMABLE.reduce(function(a,t){ return a + t.amt; }, 0) : 0) };
    out.push(w);

    /* 关闭项目：入口常在，**拦截发生在提交时**（弹窗内），不靠隐藏按钮。
       block 里带的是拒绝原因与数值，由 modalClose 呈现。 */
    var c = { key:'close', anchor:'close', label:g('closeProject'), enabled:(!guest && !terminal), reason:'', block:'' };
    if(guest) c.reason = NOAUTH;
    else if(terminal) c.reason = L('The project is already in a terminal state (' + fpStatus(p) + ').',
                                   '项目已是终态（' + fpStatus(p) + '）。');
    else if(st === 'S-FP-3' || st === 'S-FP-4')
      c.block = L('An open or unsettled financing deal exists on this project, so it cannot be closed (6.1). The deal must reach a terminal state first.',
                  '本项目存在在途或未结清的融资业务，不可关闭（6.1）。需先让该业务走到终态。');
    else if(d.fly > 0)
      c.block = L('Committed demand of ' + usd(d.fly) + ' is still outstanding. Withdraw the demand first, then close.',
                  '存在在途占用 ' + usd(d.fly) + '。请先撤下融资需求，再关闭项目。');
    else if(d.bal > 0)
      c.block = L('An unsettled deal exists (outstanding financing ' + usd(d.bal) + '), so the project cannot be closed (6.1).',
                  '存在未结清融资业务（项目融资余额 ' + usd(d.bal) + '），项目不可关闭（6.1）。');
    out.push(c);
  }

  /* --- WS-325 增量：接受 / 拒绝报价。业务已终结时不返回（不可见，不是 ⊘）。
         需求因覆盖不足失效时报价一并终结，该动作随之消失（D-CR-30 / AC-LS-91）。 --- */
  /* --- WS-326 增量：放款 / 确认到账 / 重传盖章件（AC-LS-103）。
         可用性一律由服务端返回的 available_actions 决定，前端不自行依据状态推断；
         「不返回」与「返回但 ⊘ + 原因」是两件事：前者不可见，后者可见不可点。 --- */
  if(p.fin){
    var f = p.fin;
    if(f.st === 'S-FD-3' && (role === 'fund' || guest)){
      out.push({ key:'disburse', label:L('Disburse','放款'), anchor:'disburse', enabled:!guest,
                 href:lnHref('#/deal/' + f.deal + '?action=disburse'),
                 reason: guest ? L('Not signed in. Disbursement is limited to the funder entity on this deal; the public disbursement fields on this page are not hidden from signed-out visitors.',
                                   '未登录。放款动作仅对该笔业务的资金方企业主体开放；本页的放款公开字段（提交时间、币种与金额）本身不因未登录而隐藏。') : '' });
    }
    if(f.st === 'S-FD-4' && (own || guest)){
      out.push({ key:'confirm', label:L('Confirm receipt','确认到账'), anchor:'confirm_disbursement', enabled:!guest, primary:true,
                 href:lnHref('#/deal/' + f.deal + '?action=confirm_disbursement'),
                 reason: guest ? L('Not signed in. Financing confirmation is limited to the owning entity; the public disbursement fields themselves stay public.',
                                   '未登录。融资确认仅对该项目所属企业主体开放；放款的公开字段本身是公开的。') : '' });
    }
    if(f.st === 'S-FD-3' && f.redo && (own || guest)){
      out.push({ key:'reupload', label:L('Re-upload signed contract','重传盖章件'), anchor:'reupload_contract', enabled:!guest,
                 href:lnHref('#/deal/' + f.deal + '?action=reupload_contract'),
                 reason: guest ? NOAUTH : '' });
    }
  }
  /* --- WS-327 增量：去还款 / 确认收到还款（AC-LS-113）。
         两个动作同样由服务端返回的 available_actions 决定，前端不自行依据状态或日期推断。
         repay 在该业务存在 S-RP-1 期次时返回；**未开窗的期次照常返回该动作**，
         由 P-LS-09 上的那一期以 ⊘ + 开启日期呈现（AC-RP-17）。 --- */
  if(p.rep){
    var rp = p.rep;
    if(rp.hasDue && (own || guest)){
      out.push({ key:'repay', label:g('repayNow'), anchor:'repay', enabled:!guest,
                 href:rpHref('#/deal/' + rp.deal + '?action=repay'),
                 reason: guest ? L('Not signed in. Repayment is limited to the owning entity; the public repayment-schedule fields are not hidden from signed-out visitors.',
                                   '未登录。还款动作仅对该项目所属企业主体开放；还款计划的公开字段（期次、应还日、本息拆分、期次状态、逾期标记与逾期天数）本身不因未登录而隐藏。') : '' });
    }
    if(rp.awaitConfirm && (role === 'fund' || guest)){
      out.push({ key:'confirm_repayment', label:L('Confirm repayment received','确认收到还款'), anchor:'confirm_repayment', enabled:!guest,
                 href:rpHref('#/schedule/' + rp.awaitConfirm + '?action=confirm_repayment'),
                 reason: guest ? L('Not signed in. Repayment confirmation is limited to the funder entity on this deal; the submission time and amount of the repayment record stay public.',
                                   '未登录。还款确认仅对该笔业务的资金方企业主体开放；还款记录的提交时间与币种金额本身是公开的。') : '' });
    }
  }
  if(p.quote && st === 'S-FP-3' && (own || guest)){
    out.push({ key:'respond', label:L('Accept / Reject quote','接受 / 拒绝报价'),
               anchor:'respond_quote', enabled:!guest,
               href:cqHref('#/deal/' + p.quote.deal + '?action=respond_quote'),
               reason: guest ? L('Not signed in. Deal actions are limited to the owning entity; the open quote terms and lock information above stay public.',
                                 '未登录。融资业务的处理动作仅对该项目所属企业主体开放；上面的在途报价条款与锁定信息本身是公开的，不因未登录而隐藏。') : '' });
  }
  return out;
}
function actionOf(list, key){ for(var i=0;i<list.length;i++){ if(list[i].key===key) return list[i]; } return null; }

/* ---- 可见项目集：草稿不进广场（D-FIN-64 / AC-LS-05） ---- */
function plazaProjects(){ return PROJECTS.filter(function(p){ return !p.draft; }); }
function myProjects(){ return PROJECTS.filter(function(p){ return p.entity === ACTORS.asset.entity; }); }
function findProject(id){ for(var i=0;i<PROJECTS.length;i++){ if(PROJECTS[i].id===id) return PROJECTS[i]; } return null; }

/* ================================================================
   50-charts.js —— P-LS-02 详情页两张图
   图 1 池内资产变动：有效质押价值 + 失效代币价值 = 池内资产总额（堆叠阶梯面积）
   图 2 融资变动：融资上限（线）vs 项目融资余额 + 项目在途金额（堆叠阶梯面积）
   四个量口径互不混用；覆盖不足（融资上限 < 项目融资余额）在图 2 上有独立区间。
   两图共用 30-calc.js 的同一份 seriesOf()，与页面数字同源。
   数值为阶梯：一次事件改变一次取值，事件之间保持不变——这就是业务的真实形状。
   ================================================================ */

var CHART_H = 208, CH_M = { l:72, r:116, t:16, b:38 };

function niceTicks(max, n){
  var raw = max / n, mag = Math.pow(10, Math.floor(Math.log(raw)/Math.LN10)), norm = raw / mag;
  var step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 4 ? 4 : norm <= 5 ? 5 : 10) * mag;
  var out = [], v = 0;
  while(v <= max + 1e-6){ out.push(v); v = round2(v + step); }
  return out;
}
function monthTicks(x0, x1){
  var out = [], d = new Date(x0 * 86400000);
  d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  while(d.getTime()/86400000 <= x1){
    var v = d.getTime()/86400000;
    if(v >= x0) out.push(v);
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 1));
  }
  if(out.length > 8) out = out.filter(function(_,i){ return i % 2 === 0; });
  return out;
}

function stepFwd(pts, get, X, Y){
  var d = '', i;
  for(i=0;i<pts.length;i++){
    var y = Y(get(pts[i])).toFixed(1), x = X(pts[i].x).toFixed(1);
    d += (i===0 ? 'M' : 'L') + x + ',' + y;
    if(i < pts.length-1) d += 'L' + X(pts[i+1].x).toFixed(1) + ',' + y;
  }
  return d;
}
function stepBack(pts, get, X, Y){
  var d = '', i, n = pts.length;
  d += 'L' + X(pts[n-1].x).toFixed(1) + ',' + Y(get(pts[n-1])).toFixed(1);
  for(i=n-2;i>=0;i--){
    d += 'L' + X(pts[i+1].x).toFixed(1) + ',' + Y(get(pts[i])).toFixed(1);
    d += 'L' + X(pts[i].x).toFixed(1)   + ',' + Y(get(pts[i])).toFixed(1);
  }
  return d;
}
var zero = function(){ return 0; };

/* 端点直标：色块携带身份，文字一律用墨色 token；同栏标签自动避让，不叠字 */
function endLabels(x, items){
  var minY = CH_M.t + 10, maxY = CHART_H - CH_M.b - 6, gap = 30, i;
  items = items.slice().sort(function(a,b){ return a.y - b.y; });
  for(i=0;i<items.length;i++){
    items[i].ly = Math.max(minY, items[i].y);
    if(i > 0 && items[i].ly - items[i-1].ly < gap) items[i].ly = items[i-1].ly + gap;
  }
  for(i=items.length-1;i>=0;i--){
    if(items[i].ly > maxY) items[i].ly = maxY;
    if(i < items.length-1 && items[i+1].ly - items[i].ly < gap) items[i].ly = items[i+1].ly - gap;
  }
  return items.map(function(it){
    var lead = (Math.abs(it.ly - it.y) > 3)
      ? '<path d="M' + (x+1).toFixed(1) + ',' + it.y.toFixed(1) + 'L' + (x+6).toFixed(1) + ',' + it.ly.toFixed(1) +
        '" stroke="var(--border-strong)" stroke-width="1" fill="none"></path>' : '';
    return lead + '<g transform="translate(' + (x+9).toFixed(1) + ',' + it.ly.toFixed(1) + ')">' +
      '<rect x="0" y="-8" width="9" height="9" rx="2" fill="' + it.sw + '"></rect>' +
      '<text x="13" y="0" font-size="10.5" fill="var(--text)" font-weight="600" font-family="var(--num)">' + axisAmt(it.val) + '</text>' +
      '<text x="0"  y="13" font-size="10" fill="var(--faint)">' + esc(it.name) + '</text></g>';
  }).join('');
}

function chartFrame(uid, W, yTicks, yMax, xTicks, X, Y){
  var g = '', i;
  for(i=0;i<yTicks.length;i++){
    var y = Y(yTicks[i]).toFixed(1);
    g += '<line x1="' + CH_M.l + '" y1="' + y + '" x2="' + (W - CH_M.r) + '" y2="' + y +
         '" stroke="var(--border)" stroke-width="1"></line>' +
         '<text x="' + (CH_M.l - 9) + '" y="' + y + '" dy="3.5" text-anchor="end" font-size="10" ' +
         'fill="var(--faint)" font-family="var(--num)">' + axisAmt(yTicks[i]) + '</text>';
  }
  for(i=0;i<xTicks.length;i++){
    var x = X(xTicks[i]).toFixed(1);
    g += '<text x="' + x + '" y="' + (CHART_H - CH_M.b + 18) + '" text-anchor="middle" font-size="10" ' +
         'fill="var(--faint)" font-family="var(--num)">' + mdLabel(dstr(xTicks[i])) + '</text>';
  }
  g += '<line x1="' + CH_M.l + '" y1="' + Y(0) + '" x2="' + (W - CH_M.r) + '" y2="' + Y(0) +
       '" stroke="var(--border-strong)" stroke-width="1"></line>';
  return g;
}

/* ---- 图 1：池内资产变动 ---- */
function chartPool(uid, pts, W){
  var x0 = pts[0].x, x1 = pts[pts.length-1].x;
  if(x1 <= x0) x1 = x0 + 30;
  var PW = W - CH_M.l - CH_M.r, PH = CHART_H - CH_M.t - CH_M.b;
  var yMax = Math.max.apply(null, pts.map(function(p){ return p.total; })) * 1.14 || 1;
  var X = function(v){ return CH_M.l + (v - x0) / (x1 - x0) * PW; };
  var Y = function(v){ return CH_M.t + PH - v / yMax * PH; };
  var cur = pts[pts.length-1];
  var s = '';

  s += '<defs><pattern id="hatchVoid' + uid + '" width="7" height="7" patternTransform="rotate(135)" patternUnits="userSpaceOnUse">' +
       '<rect width="7" height="7" fill="rgba(139,148,166,.16)"></rect>' +
       '<line x1="0" y1="0" x2="0" y2="7" stroke="var(--faint)" stroke-width="1.4" opacity=".55"></line></pattern></defs>';
  s += chartFrame(uid, W, niceTicks(yMax, 4), yMax, monthTicks(x0, x1), X, Y);

  /* 事件竖线 */
  pts.forEach(function(p){
    if(!p.ev) return;
    s += '<line x1="' + X(p.x).toFixed(1) + '" y1="' + CH_M.t + '" x2="' + X(p.x).toFixed(1) + '" y2="' + Y(0) +
         '" stroke="var(--border)" stroke-width="1" stroke-dasharray="2 3"></line>';
  });

  /* 有效质押价值（底层，计入覆盖） */
  s += '<path d="' + stepFwd(pts, function(p){ return p.valid; }, X, Y) + stepBack(pts, zero, X, Y) +
       'Z" fill="var(--accent-soft)"></path>';
  /* 失效代币价值（上层，不计入覆盖）—— 中性灰 + 斜纹，双通道编码 */
  s += '<path d="' + stepFwd(pts, function(p){ return p.total; }, X, Y) +
       stepBack(pts, function(p){ return p.valid; }, X, Y) + 'Z" fill="url(#hatchVoid' + uid + ')"></path>';
  /* 池内资产总额：堆叠顶缘，虚线。先画它，失效为 0 的区段由下面的实线盖住，避免蓝线看起来是虚的 */
  s += '<path d="' + stepFwd(pts, function(p){ return p.total; }, X, Y) +
       '" fill="none" stroke="var(--faint)" stroke-width="1.5" stroke-dasharray="5 3"></path>';
  /* 堆叠分界：先铺 3px 底色留缝，再描 1.9px 系列线 */
  s += '<path d="' + stepFwd(pts, function(p){ return p.valid; }, X, Y) + '" fill="none" stroke="var(--card)" stroke-width="3.4"></path>';
  s += '<path d="' + stepFwd(pts, function(p){ return p.valid; }, X, Y) + '" fill="none" stroke="var(--accent)" stroke-width="1.9" stroke-linejoin="round"></path>';

  /* 事件点 */
  pts.forEach(function(p){
    if(!p.ev) return;
    s += '<circle cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.total).toFixed(1) +
         '" r="3.6" fill="var(--card)" stroke="var(--faint)" stroke-width="1.8"></circle>';
  });

  /* 失效起点标注 */
  var firstDead = null;
  pts.forEach(function(p){ if(firstDead === null && p.dead > 0) firstDead = p; });
  if(firstDead){
    s += '<line x1="' + X(firstDead.x).toFixed(1) + '" y1="' + (CH_M.t - 2) + '" x2="' + X(firstDead.x).toFixed(1) +
         '" y2="' + Y(0) + '" stroke="var(--faint)" stroke-width="1.2" stroke-dasharray="3 3"></line>' +
         '<text x="' + (X(firstDead.x) + 6).toFixed(1) + '" y="' + (CH_M.t + 10) + '" font-size="10" fill="var(--muted)">' +
         L('underlying asset invalidated ' + firstDead.d, '底层资产失效 ' + firstDead.d) + '</text>';
  }

  var labels = [{ y:Y(cur.valid), sw:'var(--accent)', name:g('pledgedValue'), val:cur.valid }];
  if(cur.dead > 0) labels.push({ y:Y(cur.total), sw:'var(--faint)', name:L('Total pool value','池内资产总额'), val:cur.total });
  s += endLabels(X(x1), labels);

  return { svg:s, W:W, X:X, Y:Y, x0:x0, x1:x1 };
}

/* ---- 图 2：融资变动 ---- */
function chartFin(uid, pts, W){
  var x0 = pts[0].x, x1 = pts[pts.length-1].x;
  if(x1 <= x0) x1 = x0 + 30;
  var PW = W - CH_M.l - CH_M.r, PH = CHART_H - CH_M.t - CH_M.b;
  var yMax = Math.max.apply(null, pts.map(function(p){ return Math.max(p.cap, p.bal + p.fly); })) * 1.18 || 1;
  var X = function(v){ return CH_M.l + (v - x0) / (x1 - x0) * PW; };
  var Y = function(v){ return CH_M.t + PH - v / yMax * PH; };
  var cur = pts[pts.length-1];
  var s = '';

  s += '<defs><pattern id="hatchGap' + uid + '" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">' +
       '<rect width="7" height="7" fill="var(--danger-bg)"></rect>' +
       '<line x1="0" y1="0" x2="0" y2="7" stroke="var(--danger)" stroke-width="1.4" opacity=".45"></line></pattern></defs>';
  s += chartFrame(uid, W, niceTicks(yMax, 4), yMax, monthTicks(x0, x1), X, Y);

  /* 覆盖不足区间：融资上限 < 项目融资余额 的连续区段 —— 先铺底，图形压在上面 */
  var bands = [], i, open = null;
  for(i=0;i<pts.length;i++){
    if(pts[i].short && open === null) open = pts[i];
    if(!pts[i].short && open !== null){ bands.push([open, pts[i]]); open = null; }
  }
  if(open !== null) bands.push([open, pts[pts.length-1]]);
  bands.forEach(function(b){
    var bx = X(b[0].x), bw = Math.max(2, X(b[1].x) - bx);
    s += '<rect x="' + bx.toFixed(1) + '" y="' + CH_M.t + '" width="' + bw.toFixed(1) + '" height="' + PH +
         '" fill="url(#hatchGap' + uid + ')"></rect>' +
         '<line x1="' + bx.toFixed(1) + '" y1="' + CH_M.t + '" x2="' + bx.toFixed(1) + '" y2="' + Y(0) +
         '" stroke="var(--danger)" stroke-width="1.4"></line>';
  });

  pts.forEach(function(p){
    if(!p.ev) return;
    s += '<line x1="' + X(p.x).toFixed(1) + '" y1="' + CH_M.t + '" x2="' + X(p.x).toFixed(1) + '" y2="' + Y(0) +
         '" stroke="var(--border)" stroke-width="1" stroke-dasharray="2 3"></line>';
  });

  /* 项目融资余额（底层） */
  s += '<path d="' + stepFwd(pts, function(p){ return p.bal; }, X, Y) + stepBack(pts, zero, X, Y) +
       'Z" fill="rgba(181,71,8,.16)"></path>';
  /* 项目在途金额（堆在余额之上，两条线因此可分辨） */
  s += '<path d="' + stepFwd(pts, function(p){ return p.bal + p.fly; }, X, Y) +
       stepBack(pts, function(p){ return p.bal; }, X, Y) + 'Z" fill="rgba(11,138,118,.14)"></path>';
  s += '<path d="' + stepFwd(pts, function(p){ return p.bal; }, X, Y) + '" fill="none" stroke="var(--card)" stroke-width="3.4"></path>';
  s += '<path d="' + stepFwd(pts, function(p){ return p.bal; }, X, Y) + '" fill="none" stroke="var(--warn)" stroke-width="1.9" stroke-linejoin="round"></path>';
  s += '<path d="' + stepFwd(pts, function(p){ return p.bal + p.fly; }, X, Y) + '" fill="none" stroke="var(--pos)" stroke-width="1.9" stroke-linejoin="round"></path>';
  /* 融资上限：主线，比两条面积更重 */
  s += '<path d="' + stepFwd(pts, function(p){ return p.cap; }, X, Y) +
       '" fill="none" stroke="var(--card)" stroke-width="4"></path>';
  s += '<path d="' + stepFwd(pts, function(p){ return p.cap; }, X, Y) +
       '" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linejoin="round"></path>';

  /* 跨线点：覆盖不足起点 */
  bands.forEach(function(b){
    var bx = X(b[0].x);
    s += '<circle cx="' + bx.toFixed(1) + '" cy="' + Y(b[0].cap).toFixed(1) +
         '" r="5" fill="var(--card)" stroke="var(--danger)" stroke-width="2.4"></circle>' +
         '<text x="' + (bx + 9).toFixed(1) + '" y="' + (CH_M.t + 11) + '" font-size="10" fill="var(--danger)" font-weight="700">' +
         L('Insufficient coverage from ' + b[0].d, '覆盖不足区间 · 自 ' + b[0].d + ' 起') + '</text>' +
         '<text x="' + (bx + 9).toFixed(1) + '" y="' + (CH_M.t + 24) + '" font-size="10" fill="var(--muted)">' +
         L('borrowing cap fell below outstanding financing', '融资上限跌破项目融资余额') + '</text>';
  });

  /* 可融金额：末端的上限线与占用顶之间的竖向标注 */
  if(cur.free > 0){
    var fx = X(x1) - 14, yTop = Y(cur.cap), yBot = Y(cur.bal + cur.fly);
    s += '<line x1="' + fx.toFixed(1) + '" y1="' + yTop.toFixed(1) + '" x2="' + fx.toFixed(1) + '" y2="' + yBot.toFixed(1) +
         '" stroke="var(--faint)" stroke-width="1"></line>' +
         '<line x1="' + (fx-4).toFixed(1) + '" y1="' + yTop.toFixed(1) + '" x2="' + (fx+4).toFixed(1) + '" y2="' + yTop.toFixed(1) + '" stroke="var(--faint)" stroke-width="1"></line>' +
         '<line x1="' + (fx-4).toFixed(1) + '" y1="' + yBot.toFixed(1) + '" x2="' + (fx+4).toFixed(1) + '" y2="' + yBot.toFixed(1) + '" stroke="var(--faint)" stroke-width="1"></line>' +
         '<text x="' + (fx-7).toFixed(1) + '" y="' + ((yTop+yBot)/2).toFixed(1) + '" dy="3.5" text-anchor="end" font-size="10" fill="var(--muted)">' + L('free','可融') + '</text>';
  }

  var labels = [{ y:Y(cur.cap), sw:'var(--accent)', name:g('cap'), val:cur.cap },
                { y:Y(cur.bal), sw:'var(--warn)', name:g('outstanding'), val:cur.bal }];
  if(cur.fly > 0) labels.push({ y:Y(cur.bal + cur.fly), sw:'var(--pos)', name:g('committed'), val:cur.fly });
  s += endLabels(X(x1), labels);

  return { svg:s, W:W, X:X, Y:Y, x0:x0, x1:x1 };
}

/* ---- 悬浮层：十字线 + 全序列读数（线/面积图默认带交互） ---- */
function attachHover(wrapId, pts, built, kind){
  var wrap = document.getElementById(wrapId);
  if(!wrap) return;
  var svg = wrap.querySelector('svg'), tip = wrap.querySelector('.ls-tip');
  var cross = svg.querySelector('.cross');
  function idxAt(px){
    var i, last = 0;
    for(i=0;i<pts.length;i++){ if(built.X(pts[i].x) <= px + 0.5) last = i; }
    return last;
  }
  function move(e){
    var r = svg.getBoundingClientRect(), px = e.clientX - r.left;
    if(px < CH_M.l || px > built.W - CH_M.r){ leave(); return; }
    var i = idxAt(px), p = pts[i], cx = built.X(p.x);
    cross.setAttribute('transform', 'translate(' + cx.toFixed(1) + ',0)');
    cross.style.display = '';
    var rows;
    if(kind === 'pool'){
      rows = [['var(--accent)', g('pledgedValue'), p.valid],
              ['var(--faint)', L('Invalidated token value (excluded)','失效代币价值（不计入覆盖）'), p.dead],
              [null, L('Total pool value','池内资产总额'), p.total]];
    } else {
      rows = [['var(--accent)', g('cap'), p.cap], ['var(--warn)', g('outstanding'), p.bal],
              ['var(--pos)', g('committed'), p.fly], [null, g('available'), p.free]];
    }
    tip.innerHTML = '<div class="dt">' + p.d + ' · ' + TZ_LABEL + '</div>' +
      rows.map(function(r){
        return '<div class="r"><span class="lf">' + (r[0] ? '<i style="background:' + r[0] + '"></i>' : '<i style="background:transparent"></i>') +
          esc(r[1]) + '</span><b>' + amt(r[2]) + '</b></div>';
      }).join('') +
      (kind === 'fin' && p.short ? '<div class="ev" style="color:var(--danger)">' + L('Insufficient coverage: borrowing cap < outstanding financing, gap ', '覆盖不足：融资上限 < 项目融资余额，覆盖缺口 ') + amt(p.bal - p.cap) + ' ' + CCY + '</div>' : '') +
      (p.ev ? '<div class="ev"><b>' + esc(dtr(p.ev.t)) + '</b>' + (p.ev.note ? '<br>' + esc(dtr(p.ev.note)) : '') + '</div>' : '');
    var tw = tip.offsetWidth || 240;
    var left = cx + 14; if(left + tw > built.W - 6) left = cx - tw - 14;
    tip.style.left = Math.max(6, left) + 'px';
    tip.style.top  = (CH_M.t + 6) + 'px';
    tip.classList.add('on');
  }
  function leave(){ tip.classList.remove('on'); if(cross) cross.style.display = 'none'; }
  svg.addEventListener('mousemove', move);
  svg.addEventListener('mouseleave', leave);
}

/* ---- 挂载 / 重绘（宽度变化时重算像素，不做缩放变形） ---- */
/* ================================================================
   Part B —— 页面层：接入 _shared 的公共组件与运行时
   继承端别：面客端 asset　继承 shell：portal（4.3 顶栏母版）
   继承 archetype：公开列表页 / 公开详情页 / 认证后创建页
   v1.3 本页增量：一排 5 个统计区、两张定页清单、三段式操作区、四环节流程骨架、
   EN／中文对照表（G）、默认英文。
   token / 按钮 / 卡片 / 表格 / pill / note / 弹层 / Toast / 导航全部来自 _shared，
   本层不重定义、不覆盖、不自建菜单。
   ================================================================ */
var CF = window.CF, L = CF.L, E = CF.esc, q = CF.q, pageHead = CF.pageHead, toast = CF.toast;
var S = null;

/* ---------------- EN／中文术语对照表（唯一来源，分册 7.6 引用本表） ----------------
   页面只通过 g('key') 取词，改词改一处；WS-325～329 一律照此表做。
   中文一侧一律用 PRD 的红线术语全称，界面展示名与文档术语不同时以注释标出（D-LS-16）。 */
var G = {
  marketplace  :['Lending Marketplace','借贷广场'],
  myProjects   :['My financing projects','我的融资项目'],
  project      :['Financing project','融资项目'],
  pool         :['Collateral pool','资产池'],
  assetOwner   :['Asset owner','资产方'],
  funder       :['Funder','资金方'],
  guest        :['Guest','游客'],
  demand       :['Financing demand','融资需求'],
  demandNo     :['Demand ID','需求编号'],
  demandAmt    :['Financing demand amount','融资需求金额'],
  pledgedCount :['Pledged tokens','质押代币数量'],
  pledgedValue :['Pledged token value','质押代币价值'],
  outstanding  :['Outstanding financing','已融资余额'],   /* 文档术语：项目融资余额（D-FIN-06） */
  pledgeRate   :['Pledge rate','质押率'],
  cap          :['Borrowing cap','融资上限'],
  committed    :['Committed demand','项目在途金额'],
  available    :['Available to borrow','可融金额'],
  /* D-LS-17 已由 PRD V9.0 定稿，这四条是 PRD 术语，设计师按 PRD 的标签走（分册 7.6） */
  coverage     :['Pledge coverage status','质押覆盖状态'],
  covSufficient:['Ample','覆盖有余'],
  covFullyDrawn:['At Capacity','覆盖持平'],
  covUnder     :['Insufficient','覆盖不足'],
  coverageGap  :['Coverage gap','覆盖缺口'],
  covNotice    :['Insufficient-coverage notice','覆盖不足提醒'],
  tokenId      :['Token ID','代币编号'],
  tokenQty     :['Quantity / Currency','代币数量 / 币种'],
  tokenValue   :['Token value','代币价值'],
  tokenState   :['Token status','代币状态'],
  valid        :['Valid','有效'],
  invalid      :['Invalid','已失效'],
  dueDate      :['Underlying due date','底层应收账款账期'],
  buyer        :['Buyer','买方企业名'],
  onchain      :['On-chain status','链上状态'],
  txHash       :['Deposit tx hash','入池交易哈希'],
  tokenType    :['Token type','代币类型'],
  receivable   :['Receivables','应收账款'],
  addPledge    :['Add collateral','追加质押'],
  releasePledge:['Release collateral','解除质押'],
  closeProject :['Close project','关闭项目'],
  signIn       :['Sign in','立即登录'],
  publishDemand:['Publish demand','发布融资需求'],
  stDemand     :['Financing demand','融资需求'],
  stQuote      :['Quote','融资报价'],
  stConfirm    :['Confirmation','融资确认'],
  stDisburse   :['Disbursement','融资放款'],
  repayNow     :['Repay now','立即还款'],
  createProject:['Create financing project','创建融资项目'],
  status       :['Status','状态'],
  actions      :['Actions','操作'],
  validityTo   :['Valid until','有效期至'],
  funderName   :['Funder / quoted at','机构名称 / 报价时间'],
  globalOps    :['Global actions','全局操作'],
  financingFlow:['Financing flow','融资流程'],
  repayFlow    :['Repayment flow','还款流程']
};
function g(k){ var v = G[k]; return v ? L(v[0], v[1]) : k; }

/* 代币符号缩写：取值来自 WS-318 的代币符号配置，本期该配置仍为「待确认」。
   分册 7.5.1 明确要求此处**不自造** ticker，所以原型照实显示占位。 */
var TOKEN_SYM = ['[TBC]','［待确认］'];

/* 演示数据里的中文短语在英文视图下的渲染翻译；只作用于展示层，不改数据 */
var DEMO_TR = {
  '还款中':'Repaying','已到期（存量履约中）':'Matured · performing','应收账款类':'Receivables',
  '到期一次性还本付息':'Bullet repayment at maturity','补充经营性流动资金':'Working capital',
  '原材料采购':'Raw material purchase','供应商货款结算':'Supplier settlement','渠道铺货':'Channel stocking',
  '设备维保备件采购':'Spare parts procurement','工程项目垫资':'Project pre-financing',
  '有效期届满':'validity window elapsed',
  '长三角医疗器械应收账款池':'Yangtze Delta medical device receivables pool',
  '华东电子元件应收账款池':'East China electronic component receivables pool',
  '华南汽配应收账款池':'South China auto parts receivables pool',
  '珠三角家电应收账款池':'Pearl River Delta home appliance receivables pool',
  '西部能源设备应收账款池':'Western energy equipment receivables pool',
  '北方建材应收账款池':'Northern building materials receivables pool',
  '华北仪器仪表应收账款池':'North China instrumentation receivables pool',
  '华北纺织应收账款池':'North China textile receivables pool',
  '西南物流应收账款池':'Southwest logistics receivables pool',
  '项目结清释放':'Released on settlement','资产方撤回':'Withdrawn by asset owner',
  '失效代币清出':'Invalidated token cleared','项目关闭释放':'Released on project closure'
};
/* 演示事件流的英文视图：只做展示层翻译，PROJECTS 里的数据一字未改。
   键是中文原串，值是英文；新增演示事件时在此补一条即可。 */
var EV_TR = {
  "创建资产池 · 首笔质押 3 张": "Pool created · first pledge of 3 tokens",
  "发布融资需求 280,000.00 USD": "Financing demand published · 280,000.00 USD",
  "收到机构报价 280,000.00 USD": "Quote received · 280,000.00 USD",
  "还款计划定稿 · 2 期 · 起息日 2025-11-26": "Repayment schedule finalised · 2 instalments · interest start date 2025-11-26",
  "第 1 期利息 9,660.00 USD 已结清": "Instalment 1 interest 9,660.00 USD settled",
  "末期本息已结清 · 业务转 S-FD-8 已结清": "Final principal and interest settled · deal moves to S-FD-8 Settled",
  "业务结清的同一时刻，项目转 S-FP-6 已结清、池内质押全额业务释放（即时、无链上动作、无费用）": "In the same instant the deal settles, the project moves to S-FP-6 Settled and the entire pool is released in business terms - immediate, no on-chain action, no cost",
  "项目结清释放 3 张 · 280,000.00 USD 置「已释放 · 待提取」": "3 tokens worth 280,000.00 USD released on settlement, set to 'released, awaiting withdrawal'",
  "第二段链上提取由资产方自助发起、无时间限制；未提取前不属于任何资产池、不计入任何质押价值（D-FIN-57）": "The second stage, the on-chain withdrawal, is initiated by the asset owner with no time limit; until withdrawn the tokens belong to no pool and count towards no pledged value (D-FIN-57)",
  "冷链仓储运营": "Cold-chain warehousing",
  "华中冷链应收账款池": "Central China cold-chain receivables pool",
  "270 天": "270 days",
  "已结清": "Settled",
  "创建资产池 · 首笔质押 10 张": "Pool created · first pledge of 10 tokens",
  "链上转入成功（CT-2）后才计入有效质押价值（D-FIN-40 / AC-LS-28）": "Only a confirmed on-chain transfer (CT-2) counts towards pledged token value (D-FIN-40 / AC-LS-28)",
  "发布融资需求 500,000.00 USD": "Financing demand published · 500,000.00 USD",
  "发布即产生在途占用，唯一来源（AC-FIN-23）": "Publishing creates committed demand — the only source of it (AC-FIN-23)",
  "收到机构报价 500,000.00 USD": "Quote received · 500,000.00 USD",
  "报价不新增占用，项目在途金额保持不变（AC-FIN-23）": "A quote adds no commitment; committed demand is unchanged (AC-FIN-23)",
  "放款并完成融资确认": "Disbursed and financing confirmed",
  "额度原子转移：项目在途金额 → 项目融资余额，无空档（AC-FIN-25）": "Credit transferred atomically: committed demand → outstanding financing, with no gap (AC-FIN-25)",
  "追加质押 2 张 · 200,000.00 USD": "Collateral added · 2 tokens · 200,000.00 USD",
  "追加在 S-FP-1～S-FP-4 任何状态下都允许，只增不减（D-FIN-48）": "Adding is allowed in any status from S-FP-1 to S-FP-4 and only ever increases the pool (D-FIN-48)",
  "撤回质押 3 张 · 300,000.00 USD": "Collateral withdrawn · 3 tokens · 300,000.00 USD",
  "撤回时可撤回上限 575,000.00 USD，本次通过额度判定（AC-FIN-13 / AC-FIN-22）": "The release limit at the time was 575,000.00 USD, so this withdrawal passed the credit test (AC-FIN-13 / AC-FIN-22)",
  "再次发布融资需求 200,000.00 USD": "Financing demand republished · 200,000.00 USD",
  "S-FP-4 且可融金额 220,000.00 USD > 0，可再次发布剩余额度（6.1）": "In S-FP-4 with 220,000.00 USD still available to borrow, the remaining headroom can be republished (6.1)",
  "池内 2 张代币底层应收账款失效 · 300,000.00 USD": "Underlying receivables behind 2 tokens in the pool were invalidated · 300,000.00 USD",
  "失效部分不计入有效质押价值；融资上限降至 480,000.00 USD，低于项目融资余额 500,000.00 USD，触发覆盖不足提醒（E-9 / 6.4.1）": "The invalidated part stops counting towards pledged token value; the borrowing cap fell to 480,000.00 USD, below outstanding financing of 500,000.00 USD, so pledge coverage became insufficient (E-9 / 6.4.1)",
  "还款计划定稿 · 3 期 · 起息日 2026-05-12": "Repayment schedule finalised · 3 instalments · interest start date 2026-05-12",
  "融资确认完成的同一次结算内定稿，起息日取实际放款日；到期日 2027-04-20 取项目有效期至（WS-327 D-RP-10 / D-RP-11 / D-RP-12）": "Finalised in the same settlement as the financing confirmation. The interest start date is the actual disbursement date; the maturity date 2027-04-20 is the project validity date (WS-327 D-RP-10 / D-RP-11 / D-RP-12)",
  "第 1 期利息 8,688.89 USD 已提交还款记录 · 期次转 S-RP-2": "Instalment 1 interest 8,688.89 USD submitted · instalment moves to S-RP-2",
  "提交时刻即停止该期计息与逾期累加（D-FIN-11）；两个额度量一个都不动——钱有没有到只有机构知道（D-RP-37）": "Submission stops interest accrual and the overdue counter for that instalment at that moment (D-FIN-11); neither credit figure moves — only the institution knows whether the money arrived (D-RP-37)",
  "年化单利，实际天数 ÷ 360，起息日计息、应还日不计息；起息日 = 2026-05-12": "Simple annual interest, actual days ÷ 360, interest accrues from the start date and not on the due date; start date = 2026-05-12",
  "放款并完成融资确认，计入项目融资余额": "Disbursed and financing confirmed; counted into outstanding financing",
  "创建资产池 · 首笔质押 3 张": "Pool created · first pledge of 3 tokens",
  "链上转入成功（CT-2）": "Transfer confirmed on chain (CT-2)",
  "项目在途金额 = 500,000.00 USD，可融金额 = 800,000 − 0 − 500,000 = 300,000.00 USD": "Committed demand = 500,000.00 USD; available to borrow = 800,000 − 0 − 500,000 = 300,000.00 USD",
  "收到机构报价 500,000.00 USD（FD-20260815-0041）": "Quote received · 500,000.00 USD (FD-20260815-0041)",
  "报价不新增占用（AC-FIN-23）": "A quote adds no commitment (AC-FIN-23)",
  "资产方接受报价 · 业务转 S-FD-3 待放款": "Quote accepted by the asset owner · deal moves to S-FD-3 awaiting disbursement",
  "项目转 S-FP-4 融资中；在途报价金额不变——业务仍在途，尚未成为未偿本金（WS-325）": "The project moves to S-FP-4 Financing; the quoted amount is unchanged — the deal is still in flight and has not become unpaid principal yet (WS-325)",
  "资金方终止业务 FD-20260815-0041": "Deal FD-20260815-0041 terminated by the funder",
  "终止原因（FD-22，对资产方可见、公开时中性表述）：合同主体名称与平台登记的企业主体不一致，两次沟通后未能提供更正件。五个后果同一次结算内生效：在途报价金额全额释放且不进授信占用额、项目在途金额不变（需求还挂着）、项目回 S-FP-2 募集中、质押不释放、编号保留但作废（WS-326 D-LN-24）": "Termination reason (FD-22, visible to the asset owner and neutrally worded when public): the contracting party name did not match the entity registered on the platform, and no corrected document was provided after two exchanges. Five consequences take effect in the same settlement: the quoted amount is released in full and never enters credit utilisation; committed demand is unchanged (the demand is still live); the project returns to S-FP-2 Open for quotes; collateral is not released; the deal ID is retained but voided (WS-326 D-LN-24)",
  "项目转 S-FP-3 已锁定；报价不新增占用，项目在途金额不变（AC-FIN-23）": "The project moves to S-FP-3 Locked; a quote adds no commitment, so committed demand is unchanged (AC-FIN-23)",
  "年化 9.80% 高于我方本轮可接受区间（不超过 8.50%），且还款方式与我方现金流不匹配。": "An APR of 9.80% is above the range we can accept this round (8.50% ceiling), and the repayment structure does not match our cash flow.",
  "创建资产池 · 首笔质押 4 张": "Pool created · first pledge of 4 tokens",
  "发布融资需求 600,000.00 USD": "Financing demand published · 600,000.00 USD",
  "收到机构报价 600,000.00 USD": "Quote received · 600,000.00 USD",
  "项目转 S-FP-3 已锁定；在途占用不变（AC-FIN-23）": "The project moves to S-FP-3 Locked; committed demand is unchanged (AC-FIN-23)",
  "创建资产池 · 首笔质押 5 张": "Pool created · first pledge of 5 tokens",
  "在途占用不变（AC-FIN-23）": "Committed demand unchanged (AC-FIN-23)",
  "融资上限 500,000.00 = 项目融资余额 500,000.00，可融金额归零，进入「覆盖持平」档；INV-FIN-01 仍成立，不触发覆盖不足提醒（D-FIN-55）": "Borrowing cap 500,000.00 = outstanding financing 500,000.00, so available to borrow is zero and coverage is at capacity; INV-FIN-01 still holds, so no insufficient-coverage notice is raised (D-FIN-55)",
  "还款计划定稿 · 3 期 · 起息日 2026-07-26": "Repayment schedule finalised · 3 instalments · interest start date 2026-07-26",
  "首期应还日 2026-10-26，还款入口于应还日前 3 个自然日开启；本期不支持提前还款（WS-327 D-RP-26 / X-LS-40）": "The first instalment is due 2026-10-26 and the repayment entry opens 3 calendar days before the due date; early repayment is not supported this release (WS-327 D-RP-26 / X-LS-40)",
  "年化单利，实际天数 ÷ 360，起息日计息、应还日不计息；起息日 = 2026-07-26": "Simple annual interest, actual days ÷ 360, interest accrues from the start date and not on the due date; start date = 2026-07-26",
  "创建资产池 · 首笔质押 2 张": "Pool created · first pledge of 2 tokens",
  "发布融资需求 200,000.00 USD": "Financing demand published · 200,000.00 USD",
  "发布融资需求 900,000.00 USD": "Financing demand published · 900,000.00 USD",
  "收到机构报价 900,000.00 USD": "Quote received · 900,000.00 USD",
  "再次发布融资需求 250,000.00 USD": "Financing demand republished · 250,000.00 USD",
  "可融金额 1,200,000 − 900,000 − 0 ＝ 300,000.00 USD > 0，可再次发布剩余额度（6.1）": "Available to borrow 1,200,000 − 900,000 − 0 = 300,000.00 USD > 0, so the remaining headroom can be republished (6.1)",
  "收到机构报价 250,000.00 USD（FD-20260903-0056）": "Quote received · 250,000.00 USD (FD-20260903-0056)",
  "项目到期不终结在途业务：机构照常放款、资产方照常确认（WS-326 D-LN-15）": "Project expiry does not terminate deals in flight: the institution disburses and the asset owner confirms as normal (WS-326 D-LN-15)",
  "有效期到期 · 存在未结清融资业务，项目不关闭": "Project term expired · an unsettled deal exists, so the project is not closed",
  "转「已到期 · 存量处理中」并行标记：停止接受新报价、不允许再次发布，存量走完后转 S-FP-6 并释放质押（D-FIN-43 分支②，按正常状态呈现 D-FIN-47）": "The parallel flag 'matured · in run-off' is applied: no new quotes are accepted and republishing is not allowed; once the existing deals finish, the project moves to S-FP-6 and the collateral is released (D-FIN-43 branch 2, presented as a normal state per D-FIN-47)",
  "还款计划定稿 · 3 期 · 起息日 2025-09-10": "Repayment schedule finalised · 3 instalments · interest start date 2025-09-10",
  "末期应还日 2026-08-20 恒等于融资到期日（＝项目有效期至）；末期含全部本金 900,000.00 USD（WS-327 D-RP-13）": "The final due date 2026-08-20 is identical to the financing maturity date (= the project validity date); the final instalment carries the entire principal of 900,000.00 USD (WS-327 D-RP-13)",
  "第 1 期利息 15,015.00 USD 已结清": "Instalment 1 interest 15,015.00 USD settled",
  "利息期结清：项目融资余额与授信占用额**一动不动**——它们是未偿本金的合计（WS-327 D-RP-36）": "Settling an interest instalment moves neither outstanding financing nor credit utilisation — both are sums of unpaid principal (WS-327 D-RP-36)",
  "第 2 期利息 14,850.00 USD 已结清": "Instalment 2 interest 14,850.00 USD settled",
  "同上，利息不递减任何额度": "Same as above: interest never decrements any credit figure",
  "第 3 期（含本金）逾期 · 应还日 2026-08-20": "Instalment 3 (including principal) overdue · due 2026-08-20",
  "应还日次日 00:00 起打逾期标记、逾期天数每日 +1，不设宽限期；业务打 S-FD-9 并行标记，**状态仍是 S-FD-6 还款中**。平台不计罚息、不触发任何质押处置（WS-327 D-RP-34 / D-RP-35 / X-LS-45 / X-LS-46）": "The overdue flag is applied from 00:00 on the day after the due date and the overdue count rises by 1 each day, with no grace period; the deal carries the parallel flag S-FD-9 while its status stays S-FD-6 Repaying. The platform charges no penalty interest and triggers no disposal of collateral (WS-327 D-RP-34 / D-RP-35 / X-LS-45 / X-LS-46)",
  "年化单利，实际天数 ÷ 360，起息日计息、应还日不计息；起息日 = 2025-09-10": "Simple annual interest, actual days ÷ 360, interest accrues from the start date and not on the due date; start date = 2025-09-10",
  "本期无提前还款，还本发生在项目到期后（X-LS-06）": "Early repayment is not supported this release; principal is repaid after the project term ends (X-LS-06)",
  "创建资产池 · 首笔质押 7 张": "Pool created · first pledge of 7 tokens",
  "发布融资需求 300,000.00 USD": "Financing demand published · 300,000.00 USD",
  "可融金额 ＝ 496,000 − 0 − 300,000 ＝ 196,000.00 USD": "Available to borrow = 496,000 − 0 − 300,000 = 196,000.00 USD",
  "收到机构报价 300,000.00 USD（FD-20260902-0054）": "Quote received · 300,000.00 USD (FD-20260902-0054)",
  "资金方提交放款记录 LN20260905000001 · 业务转 S-FD-4 待融资确认": "Disbursement record LN20260905000001 submitted by the funder · deal moves to S-FD-4 awaiting financing confirmation",
  "放款时四个量一个都不动：金额要到融资确认完成才从项目在途金额转入项目融资余额（WS-326 AC-FIN-25 / D-LN-07）。融资确认时限自提交成功的服务端时间起算 168 小时（D-LN-31 / D-LN-32）": "None of the four figures moves at disbursement: the amount only shifts from committed demand to outstanding financing once the financing confirmation completes (WS-326 AC-FIN-25 / D-LN-07). The 168-hour confirmation window starts from the server time of a successful submission (D-LN-31 / D-LN-32)",
  "第一段完成，项目已持久化；可离开页面后再回来续做第二段（AC-LS-54）": "Step one complete and the project is persisted; you can leave the page and come back to finish later (AC-LS-54)",
  "创建资产池 · 首笔质押 2 张 · 链上执行失败": "Pool created · first pledge of 2 tokens · on-chain execution failed",
  "创建时那唯一一笔质押最终链上失败，项目保留为空池草稿（E-12 / D-FIN-62 / FP-25）": "The single pledge submitted at creation ultimately failed on chain, so the project is kept as an empty-pool draft (E-12 / D-FIN-62 / FP-25)"
};

function dtr(v){
  if(v == null) return v;
  if(S && S.lang === 'zh') return String(v);
  var t = String(v);
  if(DEMO_TR[t]) return DEMO_TR[t];
  if(EV_TR[t])   return EV_TR[t];
  var m1 = t.match(/^年化 ([\d.]+)%（演示）$/);      if(m1) return 'APR ' + m1[1] + '% (demo)';
  var m2 = t.match(/^(\d+) 天$/);                    if(m2) return m2[1] + ' days';
  return t.replace(/（演示）/g, ' (demo)');
}

/* 质押覆盖状态三档（D-LS-17，PRD V9.0 定稿）。判据一字未动，只换标签。 */
function covMeta(k){
  return k === 'short'   ? { tone:'red',   t:g('covUnder') }
       : k === 'used-up' ? { tone:'amber', t:g('covFullyDrawn') }
                         : { tone:'green', t:g('covSufficient') };
}
var FP_EN = { '草稿':'Draft','募集中':'Open for quotes','已锁定':'Locked','融资中':'Financing',
              '已关闭':'Closed','已结清':'Settled' };
var FPX_EN = { '已建池 · 未发布':'Pool created · not published','公开接受报价':'Accepting quotes',
               '已有在途报价':'One quote in flight','存在未结清融资业务':'Unsettled deal in progress',
               '质押已全部释放':'All collateral released' };
function fpStatus(p){ var t = FP_STATUS[p.status].t; return L(FP_EN[t] || t, t); }
function fpHint(p){ var x = FP_STATUS[p.status].x; return L(FPX_EN[x] || x, x); }
var CT_EN = { '未发起':'Not submitted','处理中':'Pending','成功':'Confirmed','失败':'Failed' };
function ctStatus(k){ var t = CT_STATUS[k].t; return k + ' ' + L(CT_EN[t] || t, t); }
function actorT(k){ return L({ guest:'Guest', asset:'Asset owner', fund:'Funder' }[k], ACTORS[k].t); }
function actorFull(k){ return dtr(ACTORS[k].full); }

/* ---------------- 分页：两张清单固定每页 5 条，不提供每页条数切换（AC-LS-90） ---------------- */
var PAGE_N = 5;
function paged(list, key){
  var n = Math.max(1, Math.ceil(list.length / PAGE_N)), pg = Math.min(S[key] || 1, n);
  return { rows:list.slice((pg-1)*PAGE_N, pg*PAGE_N), pg:pg, n:n, total:list.length };
}
function pgBar(pp, key){
  if(pp.total <= PAGE_N) return '';
  return '<div class="pager"><span class="faint">' +
    L(pp.total + ' items · page ' + pp.pg + ' / ' + pp.n + ' · 5 per page',
      '共 ' + pp.total + ' 条 · 第 ' + pp.pg + ' / ' + pp.n + ' 页 · 每页 5 条') +
    '</span><span class="right">' +
    '<button class="pgbtn" type="button" ' + (pp.pg<=1?'disabled ':'') + 'data-act="ls.pg" data-v="' + key + ':' + (pp.pg-1) +
      '" aria-label="' + L('Previous page','上一页') + '">‹</button>' +
    '<button class="pgbtn" type="button" ' + (pp.pg>=pp.n?'disabled ':'') + 'data-act="ls.pg" data-v="' + key + ':' + (pp.pg+1) +
      '" aria-label="' + L('Next page','下一页') + '">›</button>' +
    '</span></div>';
}

function pill(tone, t){ return '<span class="pill ' + tone + '">' + E(t) + '</span>'; }
/* info 档在本模块落到 .pill.info（accent-soft，模块样式里定义）——
   公共 .pill 不带 tone 时是透明的「无强调」变体，放进状态列会让半列变成裸文字。 */
var TONE = { mute:'gray', info:'info', good:'green', warn:'amber', crit:'red' };
function gTone(k){ return covMeta(k).tone; }
function cardHead(t, note){
  return '<div class="card-head"><b>' + E(t) + '</b>' + (note ? '<span style="margin-left:auto">' + note + '</span>' : '') + '</div>';
}
function faint(t){ return '<span class="faint">' + E(t) + '</span>'; }

function statusPills(p){
  var d = derive(p), out = [];
  out.push(pill(TONE[FP_STATUS[p.status].tone] || 'gray', fpStatus(p)));
  if(d.grade !== 'normal') out.push(pill(gTone(d.grade), covMeta(d.grade).t));
  if(p.expired) out.push(pill('gray', L('Term expired · existing deals keep performing','已到期 · 存量融资业务照常履约中')));
  var ef = expiryFlag(p);
  if(ef && !p.expired) out.push(pill('amber', ef.t));
  if(p.emptyPool) out.push(pill('amber', L('Empty pool draft · no valid collateral','空池草稿 · 暂无有效质押')));
  if(p.quotes) out.push(pill('gray', L(p.quotes + ' quote(s) received', '已收到报价 ' + p.quotes + ' 笔')));
  return out.join('');
}

/* ---------------- 统计区：一排 5 个（6.5.4 / AC-LS-53 / AC-LS-84） ----------------
   取代 v1.2 的三数等式区、额度尺与「额度明细与判定口径」折叠区。
   融资上限 / 可融金额 / 项目在途金额三个中间量不再常驻展示——
   它们只在发布与改额弹窗里由服务端当场重算后给出（AC-LS-09）。
   **不展示 ≠ 不校验**：INV-FIN-01 与 AC-FIN-12 视角 B 一条不减。 */
function cy(){ return '<span class="cy">' + CCY + '</span>'; }
function statRow(p){
  var d = derive(p), liveCount = p.tokens.length - d.deadCount;
  var cells = [
    { k:g('pledgedCount'), v:liveCount + ' ' + L(liveCount === 1 ? 'token' : 'tokens','张'),
      x:p.tokens.length === 0
          ? L('The pool holds no tokens','池内已无代币')
          : d.deadCount ? L(d.deadCount + ' more invalidated, excluded', '另有 ' + d.deadCount + ' 张已失效、不计入')
                        : L('All tokens in this pool are valid','池内代币全部有效') },
    { k:g('pledgedValue'), v:amt(d.valid) + cy(), lead:true,
      x:L('Valid tokens only — invalidated, unconfirmed and reconciliation-flagged excluded',
          '只取有效部分 —— 已排除失效、未上链、对账差异') },
    { k:g('demand'), v:p.demand ? amt(p.demand) + cy() : '—',
      x:p.demand ? L('Published · occupying the borrowing cap','已发布 · 占用额度')
                 : L('No open demand on this project','当前无在途融资需求') },
    { k:g('outstanding'), v:amt(d.bal) + cy(),
      x:L('Unpaid principal on confirmed, matured or overdue deals','已确认 / 已到期 / 逾期业务的未偿本金合计') },
    { k:g('pledgeRate'), v:(PLEDGE_RATE*100) + '%',
      x:L('Fixed constant this release — not editable, not configurable','本期固定常量，不可编辑、不可配置') }
  ];
  return '<div class="ls-stats">' + cells.map(function(c){
    return '<div class="s' + (c.lead ? ' lead' : '') + '"><div class="k">' + E(c.k) + '</div>' +
      '<div class="v">' + c.v + '</div><div class="x">' + E(c.x) + '</div></div>';
  }).join('') + '</div>';
}

function fold(title, cnt, body, open){
  return '<details class="ls-fold"' + (open ? ' open' : '') + '><summary>' +
    '<span class="ca" aria-hidden="true">▶</span>' + E(title) +
    (cnt ? '<span class="n">' + E(cnt) + '</span>' : '') + '</summary><div class="fb">' + body + '</div></details>';
}

/* 跨文件入口：WS-325/326/327 原型与本模块是同级目录，按登记表拼相对地址，不写死路径 */
function cqHref(hash){ var m = (CF.MODULES || {})['lending-credit-quote'];  return m ? '../' + m.dir + '/' + m.file + (hash || '') : '#'; }
function lnHref(hash){ var m = (CF.MODULES || {})['lending-disbursement'];  return m ? '../' + m.dir + '/' + m.file + (hash || '') : '#'; }
function rpHref(hash){ var m = (CF.MODULES || {})['lending-repayment'];     return m ? '../' + m.dir + '/' + m.file + (hash || '') : '#'; }

/* ---- WS-325 增量：锁定信息（D-LS-13 / AC-LS-85）----
   S-FP-3 期间必须展示四件事：被谁锁定 / 从什么时候开始 / 已锁定多久 / 还剩多久，并给两条出路。
   锁定信息属于公开信息，对游客与全部资金方可见；只陈述事实，不做评价性措辞（D-LS-14）。 */
/* v1.4 移除：lockLine()（列表页的锁定倒计时，WS-325 D-LS-20 / AC-LS-97 曾要求列表页也给）
   与 finLine()（WS-326 的业务进度、WS-327 的还款进度与逾期天数）。
   需求方 09-14 第 1 条要求列表页只留状态本身，细节去详情页看。
   **详情页四项齐全的要求没有放松**——锁定信息整块搬到了左栏第一张卡（见 lockCard）。
   与 WS-325 AC-LS-97「三处都能看到」的偏离已登记进交付说明。 */
function lockCard(p, own, wide){
  if(!p.quote) return '';
  var qq = p.quote, k = quoteClock(qq);
  var held = (k.heldMin / (QUOTE_HOURS * 60) * 100).toFixed(2);
  /* 四件事一件不少（WS-325 D-LS-20 / AC-LS-97）：
     ① 被谁锁定 ② 从什么时候起 ③ 已锁定多久 ④ 还剩多久（小时级，不足 24 小时切分钟）。
     左列是①②③的事实，右列是④的倒计时与两条出路——宽栏下并排，窄栏下自动堆叠。 */
  return '<div class="ls-lock' + (k.soon ? ' soon' : '') + (wide ? ' wide' : '') + '">' +
    '<div class="cA">' +
      '<div class="lb">' + L('This demand is locked by a quote','该需求已被一笔报价锁定') + '</div>' +
      '<div class="rows" style="box-shadow:none;margin-top:7px">' +
        [[L('Locked by','被谁锁定'), E(dtr(qq.fund))],
         [L('Locked since','锁定起算'), qq.at + ' ' + TZ_LABEL],
         [L('Held for','已锁定'), fmtDur(k.heldMin)],
         [L('Expires at','到期时刻'), k.to + ' ' + TZ_LABEL]].map(function(r){
          return '<div class="row"><div class="row-main"><div class="row-k">' + r[0] + '</div>' +
            '<div class="row-v mono">' + r[1] + '</div></div></div>'; }).join('') +
      '</div>' +
    '</div>' +
    '<div class="cB">' +
      '<div class="lb">' + L('Time left before the quote expires automatically','距报价自动失效还剩') + '</div>' +
      '<div class="big"><span class="v">' + fmtDur(k.leftMin) + '</span></div>' +
      '<div class="bar" role="img" aria-label="' + L('Quote validity ' + QUOTE_HOURS + ' hours: ' + fmtDur(k.heldMin) + ' held, ' + fmtDur(k.leftMin) + ' left',
          '报价有效期 ' + QUOTE_HOURS + ' 小时：已锁定 ' + fmtDur(k.heldMin) + '，剩余 ' + fmtDur(k.leftMin)) + '">' +
        '<div class="el" style="width:' + held + '%"></div>' +
        '<div class="rm" style="width:' + (100 - held).toFixed(2) + '%"></div></div>' +
      '<div class="scale"><span>' + L('submitted <b>' + qq.at + '</b>', '提交 <b>' + qq.at + '</b>') + '</span>' +
        '<span>' + L('held <b>' + fmtDur(k.heldMin) + '</b> ＋ left <b>' + fmtDur(k.leftMin) + '</b> ≡ <b>' + QUOTE_HOURS + ' hours</b>',
                     '已锁定 <b>' + fmtDur(k.heldMin) + '</b> ＋ 剩余 <b>' + fmtDur(k.leftMin) + '</b> ≡ <b>' + QUOTE_HOURS + ' 小时</b>') + '</span></div>' +
      (k.soon ? '<p class="hint" style="color:var(--warn)">' + L(
          'Less than 24 hours left, so the countdown has switched to minute precision. Expiry is executed by the system at the exact moment and does not depend on anyone being signed in. There is no grace period.',
          '剩余不足 24 小时，倒计时已切到分钟精度。到点即失效，由系统自动执行、不依赖任何人登录；无宽限期。') + '</p>' : '') +
      '<div class="ways">' +
        (own
          ? '<div class="w"><i>①</i><span>' + L('You may <b>reject at any time</b>; the demand returns to quotable immediately.',
                '您可以<b>随时拒绝</b>该报价，需求将立即回到可被报价的状态。') + '</span></div>' +
            '<div class="w"><i>②</i><span>' + L('If nothing is done within <b>' + fmtDur(k.leftMin) + '</b>, the quote <b>expires automatically</b> and the demand reopens.',
                '若 <b>' + fmtDur(k.leftMin) + '</b> 内未处理，该报价将<b>自动失效</b>、需求自动放开。') + '</span></div>'
          : '<div class="w"><i>①</i><span>' + L('The asset owner may <b>reject at any time</b>; the demand then returns to quotable.',
                '资产方可<b>随时拒绝</b>，需求随即回到可被报价的状态。') + '</span></div>' +
            '<div class="w"><i>②</i><span>' + L('If nothing is done within <b>' + fmtDur(k.leftMin) + '</b>, the quote <b>expires automatically</b> and the demand reopens.',
                '若 <b>' + fmtDur(k.leftMin) + '</b> 内未处理，报价<b>自动失效</b>、需求自动放开。') + '</span></div>') +
      '</div>' +
    '</div></div>';
}

/* WS-326 / WS-327 的业务状态文案。v1.4 起只在详情页用——
   列表页的业务进度与还款进度副行已按需求方第 1 条移除。 */
var FIN_ST = { 'S-FD-3':['Awaiting disbursement','待放款'], 'S-FD-4':['Awaiting financing confirmation','待融资确认'],
               'S-FD-6':['Repaying','还款中'], 'S-FD-8':['Settled','已结清'] };
function finSt(k){ var v = FIN_ST[k]; return v ? L(v[0], v[1]) : k; }
/* ---- 动作按钮：区分「不可见」与「可见不可点 ⊘」（H-03）----
   v1.3：游客态不再走这条路径，操作区收敛为单个「立即登录」（D-LS-14）。 */
function actBtn(a, cls, noWhy){
  var lb = E(a.label) + (a.badge ? '<span class="ls-badge">' + a.badge + '</span>' : '');
  if(a.enabled){
    /* 落在别的模块文件里的动作用链接，公共层的跨文件边界提示才拦得住（见 _shared/export.py） */
    if(a.href) return '<a class="btn ' + (cls || '') + '" href="' + a.href + '">' + lb + '</a>';
    return '<button class="btn ' + (cls || '') + '" type="button" data-act="ls.do" data-v="' + a.key + '">' + lb + '</button>';
  }
  return '<button class="btn blocked ' + (cls || '').replace('primary','') + '" type="button" aria-disabled="true" ' +
    'title="' + E(a.reason) + '" data-act="ls.why" data-v="' + a.key + '">⊘ ' + lb + '</button>' +
    (noWhy ? '' : whyLine(a.reason));
}
function whyLine(reason){
  return '<div class="ls-why"><span class="sg" aria-hidden="true">⊘</span><span>' + E(reason) + '</span></div>';
}

/* ---- 提示块：只有覆盖不足保留填色（D-FIN-56 中性事实文案） ---- */
function shortAlert(p, d, own){
  if(d.grade !== 'short') return '';
  return '<div class="ls-alert">' + CF.note('red', L(
    'Coverage gap <span class="mono">' + usd(d.gap) + '</span>; collateral value to add <span class="mono">' + usd(d.need) +
      '</span> (= coverage gap ÷ ' + (PLEDGE_RATE*100) + '%), since ' + (d.shortFrom || '—') + '. ' +
      'Cause: the underlying receivables behind ' + d.deadCount + ' token(s) in this pool have been invalidated (' + usd(d.dead) +
      ' in total), so they no longer count towards pledged token value. Adding collateral raises the borrowing cap and repayment lowers outstanding financing; the flag clears automatically once the condition reverses.',
    '覆盖缺口 <span class="mono">' + usd(d.gap) + '</span>，需追加资产价值 <span class="mono">' + usd(d.need) +
      '</span>（＝覆盖缺口 ÷ ' + (PLEDGE_RATE*100) + '%），自 ' + (d.shortFrom || '—') + ' 起。' +
      '诱因：池内 ' + d.deadCount + ' 张代币底层应收账款已失效（合计 ' + usd(d.dead) + '），不计入有效质押价值；' +
      '追加质押抬高融资上限或还款降低项目融资余额，条件反转即自动解除。'),
    L('Insufficient pledge coverage: pledged token value has fallen below outstanding financing',
      '质押覆盖不足：池内有效质押价值低于项目融资余额')) + '</div>';
}
function usedUpNote(d, p){
  if(d.grade !== 'used-up') return '';
  /* v1.5：终态项目（已关闭 / 已结清）池子已空，这段提示的建议——"追加质押可抬高融资上限
     并重新打开额度"——在终态根本做不到，留着只会误导。**判据与 pill 一个都没动**，
     只是这段建议不再渲染。终态下三档的呈现口径 PRD 没写，已登记进交付说明。 */
  if(p && (p.status === 'S-FP-5' || p.status === 'S-FP-6')) return '';
  return CF.note('amber', L(
    'There is <span class="mono">' + usd(0) + '</span> left to borrow, so no new commitment can be taken on.' +
      '<p>Existing debt is still fully covered (borrowing cap ' + usd(d.cap) + ' ≥ outstanding financing ' + usd(d.bal) +
      '), so <strong class="ls-b">this is not an insufficient-coverage notice</strong>. Adding collateral raises the borrowing cap and reopens headroom.</p>',
    '可融金额为 <span class="mono">' + usd(0) + '</span>，暂不能新增占用。' +
      '<p>已发生的债务仍被池内价值足额覆盖（融资上限 ' + usd(d.cap) + ' ≥ 项目融资余额 ' + usd(d.bal) +
      '），<strong class="ls-b">这不是覆盖不足</strong>。追加质押可抬高融资上限并重新打开额度。</p>'),
    g('covFullyDrawn'));
}

/* ================================================================
   P-LS-01 借贷广场（公开列表页）
   ================================================================ */
var F0 = { type:'', pool:'', demand:'', dstate:'', expiry:'', grade:'', sort:'pub' };
function matchFilter(p){
  var d = derive(p), f = S.flt;
  if(f.type && p.assetType !== f.type) return false;
  if(f.pool){ var r = f.pool.split('-'); if(d.valid < +r[0] || (r[1] !== 'x' && d.valid > +r[1])) return false; }
  if(f.demand){ var gg = f.demand.split('-'); if(!p.demand) return false;
    if(p.demand < +gg[0] || (gg[1] !== 'x' && p.demand > +gg[1])) return false; }
  /* 只按对外状态五值过滤（D-LS-18）。v1.3 里那两个「项目状态 S-FP-*」与
     「是否可报价」筛选已删除——它们是自建的第二套展示状态，WS-325 分册 6.4.1 ③
     与 WS-324 AC-LS-93 都明令不许有。 */
  if(f.dstate){ var cd = curDemand(p); if(!cd || cd.st !== f.dstate) return false; }
  if(f.grade && d.grade !== f.grade) return false;
  if(f.expiry){ var dd = p.expiresAt ? daysTo(p.expiresAt) : 99999;
    if(f.expiry === 'x' && dd >= 0) return false;
    if(f.expiry === '7' && (dd < 0 || dd > 7)) return false;
    if(f.expiry === '30' && (dd < 0 || dd > 30)) return false; }
  return true;
}
function filterBar(){
  function sel(k, lb, opts){
    return '<label class="fl"><span>' + E(lb) + '</span><select class="inp" data-act="ls.flt" data-v="' + k + '">' +
      opts.map(function(o){ return '<option value="' + o[0] + '"' + (S.flt[k] === o[0] ? ' selected' : '') + '>' + E(o[1]) + '</option>'; }).join('') +
      '</select></label>';
  }
  var any = L('All','全部'), no = L('Any','不限');
  return '<div class="filters">' +
    sel('type', g('tokenType'), [['', any], ['应收账款类', g('receivable')]]) +
    sel('pool', g('pledgedValue'), [['', no],['0-500000', L('under 500K','50 万以下')],
        ['500000-1000000', L('500K – 1M','50–100 万')],['1000000-x', L('over 1M','100 万以上')]]) +
    sel('demand', g('demand'), [['', no],['0-300000', L('under 300K','30 万以下')],
        ['300000-600000', L('300K – 600K','30–60 万')],['600000-x', L('over 600K','60 万以上')]]) +
    sel('dstate', L('Demand status','融资需求状态'), [['', any]].concat(
        ['open','quoted','disb','funded','ended'].map(function(k){ return [k, L(DST[k].t[0], DST[k].t[1])]; }))) +
    sel('expiry', L('Term ending','有效期临近'), [['', no],['7', L('within 7 days','7 天内到期')],
        ['30', L('within 30 days','30 天内到期')],['x', L('already expired','已到期')]]) +
    sel('grade', g('coverage'), [['', any]].concat(GRADES.map(function(x){ return [x.k, covMeta(x.k).t]; }))) +
    '<div style="flex:1"></div>' +
    sel('sort', L('Sort','排序'), [['pub', L('Newest first','发布时间倒序')],
        ['demand', L('By demand amount','按需求金额')],['pool', L('By pledged token value','按质押代币价值')]]) +
  '</div>';
}
function plazaRow(p){
  var d = derive(p), qa = actionOf(availableActions(p, S.role), 'quote'), ef = expiryFlag(p);
  var cd = curDemand(p);
  return '<tr class="rowlink" data-act="ls.open" data-v="' + p.id + '">' +
    '<td><div class="cell-main">' + E(dtr(p.name)) + '</div>' +
      '<div class="cell-sub">' + E(dtr(p.owner)) + ' · ' + p.id + '</div></td>' +
    '<td class="num">' + (p.demand ? '<span style="font-size:15px;font-weight:680">' + amt(p.demand) + '</span>' +
        '<div class="cell-sub">' + CCY + '</div>'
      : '<span class="faint">—</span><div class="cell-sub">' + L('No open demand','无在途需求') + '</div>') + '</td>' +
    /* v1.4：状态列只留状态本身。锁定倒计时、业务进度、还款进度、逾期天数四类副行
       全部移到详情页（需求方 09-14 第 1 条）。
       状态取**融资需求对外状态五值**而不是内部 S-FP-*（D-LS-18 / AC-LS-93）。
       「已到期」是项目级并行标记，L2 要求必须有，作为并列 pill 保留、不是副行。
       「已失效／已关闭」下方那行终结原因是 AC-LS-95 的硬要求，不能省。 */
    '<td><div class="ls-pills">' +
      (cd ? demandPill(cd) : pill('gray', L('No demand published','尚未发布需求'))) +
      (p.expired ? pill('gray', L('Term expired','已到期')) : '') + '</div></td>' +
    '<td>' + pill(gTone(d.grade), covMeta(d.grade).t) +
      (d.gap ? '<div class="cell-sub">' + L('shortfall ','缺口 ') + amt(d.gap) + '</div>' : '') + '</td>' +
    '<td class="num">' + amt(d.valid) + '<div class="cell-sub">' +
      L((p.tokens.length - d.deadCount) + ' valid' + (d.deadCount ? ' · ' + d.deadCount + ' invalidated' : ''),
        (p.tokens.length - d.deadCount) + ' 张有效' + (d.deadCount ? ' · 含失效 ' + d.deadCount + ' 张' : '')) + '</div></td>' +
    '<td class="num">' + (p.expiresAt || '—') +
      (ef && !p.expired ? '<div class="cell-note">' + E(ef.t) + '</div>' : '') + '</td>' +
    /* 未登录时卡片上只出「立即登录」，不再逐动作 ⊘（WS-325 D-LS-21，与详情页操作区同口径）。
       已登录的四种不可点情形仍各给各的原因（AC-LS-98）。 */
    '<td class="col-act" style="text-align:right">' +
      (S.role === 'guest'
        ? '<button class="btn sm" type="button" data-act="ls.signin">' + g('signIn') + '</button>'
        : qa.enabled
          ? '<a class="btn sm primary" href="' + qa.href + '" data-act="ls.cross">' + E(qa.label) + '</a>'
          : '<button class="btn sm blocked" type="button" aria-disabled="true" title="' + E(qa.reason) +
            '" data-act="ls.whyq" data-v="' + p.id + '">⊘ ' + g('stQuote') + '</button>' +
            '<div class="cell-sub" style="margin-top:4px">' + E(qa.brief || '') + '</div>') +
    '</td></tr>';
}
function pagePlaza(){
  var all = plazaProjects();
  var sv = all.reduce(function(a,p){ return a + derive(p).valid; }, 0);
  var sd = all.reduce(function(a,p){ return a + (p.demand || 0); }, 0);
  var head = pageHead(g('marketplace'),
    L('Every financing project created by an onboarded asset owner on this platform. One project is one collateral pool. Information layers L1–L5 are fully visible to everyone, signed in or not; only action entries narrow by sign-in state and permission.',
      '平台上全部入驻资产方创建的融资项目，一个项目就是一个资产池。信息 L1～L5 对所有人全量可见，不登录也能看完；只有操作入口按登录态与权限收敛。'),
    S.role === 'asset' ? '<button class="btn primary" type="button" data-act="ls.newProject">' + g('createProject') + '</button>' : '');
  var strip = '<div class="stat-row" style="margin-bottom:16px">' +
    '<div class="stat"><div class="lbl">' + L('Listed financing projects','在架融资项目') + '</div><div class="val">' +
      L(all.length + '', all.length + ' 个') + '</div></div>' +
    '<div class="stat"><div class="lbl">' + L('Total pledged token value','质押代币价值合计') + '</div><div class="val">' + usd(sv) + '</div></div>' +
    '<div class="stat"><div class="lbl">' + L('Total open demand','在途融资需求合计') + '</div><div class="val">' + usd(sd) + '</div></div>' +
  '</div>';

  if(S.st === 'loading'){
    var sk = ''; for(var i=0;i<8;i++) sk += '<div class="skel-row"><div class="skel" style="width:100%"></div></div>';
    return head + strip + '<div class="card"><div class="card-b">' + sk + '</div></div>';
  }
  if(S.st === 'error')
    return head + strip + '<div class="card"><div class="tbl-empty"><b>' + L('Could not load the marketplace','借贷广场加载失败') + '</b>' +
      L('The server did not return the list. This does not affect the on-chain or credit state of published projects — you can retry.',
        '服务端未返回列表数据。这不影响已发布项目的链上与额度状态，可重试。') +
      '<div style="margin-top:14px"><button class="btn primary" type="button" data-act="st" data-v="default">' +
      L('Reload','重新加载') + '</button></div></div></div>';
  if(S.st === 'empty')
    return head + strip + '<div class="card"><div class="tbl-empty"><b>' + L('No financing demands yet','暂无融资需求') + '</b>' +
      L('Once an asset owner has had receivables verified on the asset platform and tokens issued by operations, they can create a collateral pool here and publish a financing demand.',
        '资产方在资产平台完成应收账款确权、由运营端签发代币后，即可在此创建资产池并发布融资需求。') + '</div></div>';

  var list = all.filter(matchFilter).sort(function(a,b){
    if(S.flt.sort === 'demand') return (b.demand||0) - (a.demand||0);
    if(S.flt.sort === 'pool') return derive(b).valid - derive(a).valid;
    return dnum(b.publishedAt || TODAY) - dnum(a.publishedAt || TODAY);
  });
  if(S.st === 'noresult' || !list.length)
    return head + strip + '<div class="card">' + filterBar() +
      '<div class="tbl-empty"><b>' + L('No projects match these filters','没有符合筛选条件的融资需求') + '</b>' +
      L('No collateral pool matches the current filter combination. Widen the pledged-value range or the project status, or clear the filters to see all ' + all.length + '.',
        '当前筛选组合下没有匹配的资产池。可放宽质押代币价值区间或项目状态，也可以清空筛选查看全部 ' + all.length + ' 条。') +
      '<div style="margin-top:14px"><button class="btn" type="button" data-act="ls.reset">' + L('Clear filters','清空筛选') + '</button></div></div></div>';

  return head + strip + '<div class="card">' + filterBar() +
    '<div class="tablewrap" style="border:0;box-shadow:none;border-radius:0"><table class="tbl ls-tbl"><thead><tr>' +
      '<th>' + g('project') + ' / ' + g('assetOwner') + '</th><th class="num">' + g('demandAmt') + '</th>' +
      '<th>' + L('Demand status','融资需求状态') + '</th><th>' + g('coverage') + '</th>' +
      '<th class="num">' + g('pledgedValue') + '</th><th class="num">' + g('validityTo') + '</th>' +
      '<th class="col-act" style="text-align:right">' + g('actions') + '</th>' +
    '</tr></thead><tbody>' + list.map(plazaRow).join('') + '</tbody></table></div>' +
    '<div class="pager"><span class="faint">' +
      L(list.length + ' items · ' + PAGE_SIZE + ' per page · click any row for the detail page',
        '共 ' + list.length + ' 条 · 单页 ' + PAGE_SIZE + ' 条 · 点击任意一行进入详情') + '</span></div>' +
  '</div>';
}

/* ================================================================
   P-LS-02 融资需求详情（公开详情页）
   v1.3 版式：统计区（一排 5 个）→ 左右两栏（左：两张定页清单 + 下游模块只读引用卡；
   右：三段式操作区）→ 页面最下方两张图。
   ================================================================ */
/* 需求编号 FP-28 = 项目编号 + 两位轮次序号（D-LS-13）。
   它是**派生编号，不是新对象、不另开号段**——守住 D-LS-11：
   同一个项目对象的第 N 轮要约，不产生第二套状态机、第二个深链锚点。 */
var DST = {
  open     :{ tone:'amber', t:['Awaiting quotes','待报价'] },
  quoted   :{ tone:'info',  t:['Quoted · awaiting response','已报价待确认'] },
  disb     :{ tone:'info',  t:['Disbursing','放款中'] },
  funded   :{ tone:'green', t:['Disbursed','已放款'] },
  ended    :{ tone:'gray',  t:['Void / closed','已失效／已关闭'] }
};
/* FP-27 本轮需求终结原因。D-LS-19 把「已失效／已关闭」合并成一个展示取值，
   但 AC-LS-95 要求终结原因必须在标签旁与详情页看得到——所以标签下面永远带一行原因。 */
var FP27 = {
  autovoid :['Auto-voided · insufficient coverage','自动失效 · 覆盖不足'],
  withdrawn:['Withdrawn by the asset owner','资产方撤下'],
  closed   :['Project closed','项目关闭'],
  terminated:['Deal terminated','业务终止']
};
function demandPill(r){
  var m = DST[r.st] || DST.open;
  return pill(m.tone, L(m.t[0], m.t[1])) +
    (r.st === 'ended' && r.why ? '<div class="cell-sub">' + E(L(FP27[r.why][0], FP27[r.why][1])) + '</div>' : '');
}
/* 对外状态由服务端派生下发，前端不得用 S-FP / S-FD 的内部状态自行拼装（AC-LS-93）。
   原型没有服务端，这里按分册 6.9.1 的映射表从事件流推导，仅为演示。 */
function demandRecords(p){
  var rows = [], seq = 0, pending = null, dealIdx = 0;
  p.events.forEach(function(e){
    if(e.k === 'publish'){
      seq++;
      pending = { no:p.id + '-' + String(seq).padStart(2,'0'), seq:seq, at:e.d,
                  amt:e.dFly || 0, st:'open', why:null, deal:'', fund:'', qat:'' };
      rows.push(pending);
    } else if(!pending){
      return;
    } else if(e.k === 'quote'){
      pending.st = 'quoted'; pending.qat = e.d;
    } else if(e.k === 'accept' || e.k === 'disb'){
      pending.st = 'disb';
    } else if(e.k === 'fund'){
      var dl = p.deals[dealIdx++];
      pending.st = 'funded'; pending.deal = dl ? dl.id : '—';
      pending = null;                       /* 已放款不再退出（分册 6.9.1） */
    } else if(e.k === 'terminate'){
      /* ⚠️ 分册 6.9.1 把 S-FD-10 已终止映射到「已失效／已关闭」，
         而 WS-326 D-LN-24 明确"需求还挂着、项目回 S-FP-2 募集中"。
         演示数据按 WS-326 的那条走（需求重回待报价），不一致已登记进交付说明。 */
      pending.st = 'open'; pending.qat = ''; pending.deal = '';
    } else if(e.k === 'settle'){
      pending.st = 'funded'; pending = null;
    }
  });
  /* 需求因覆盖不足即时失效（AC-LS-39 / D-FIN-76），原因取 FP-27 */
  if(pending && derive(p).grade === 'short'){ pending.st = 'ended'; pending.why = 'autovoid'; }
  if(p.status === 'S-FP-5' && pending){ pending.st = 'ended'; pending.why = 'closed'; }
  rows.forEach(function(r){
    if((r.st === 'disb' || r.st === 'funded') && p.fin){ r.fund = p.fin.fund; r.deal = r.deal || p.fin.deal; }
    if((r.st === 'quoted' || r.st === 'ended') && p.quote){ r.fund = p.quote.fund; r.qat = p.quote.at; }
  });
  return rows.reverse();
}

/* 项目当前这一轮需求的对外状态。广场列表、融资信息清单、我的融资项目三处
   都从这里取，保证同一笔需求三处读到的对外状态一致（AC-LS-93）。 */
function curDemand(p){ var r = demandRecords(p); return r.length ? r[0] : null; }

/* ---------------- 操作区段 ②：融资流程四环节（6.5.5 / 分册 6.9） ----------------
   本模块只承载环节展示与映射；报价、接受/拒绝、放款、确认的业务规则分属 WS-325／326，
   **本原型不替它们发明规则**——环节按钮打开的是弹窗壳，壳里只放已经权威公开的信息，
   真正的操作跳到对应模块页面完成。
   ⚠️ 需求方四环节里的「融资确认」＝资产方接受/拒绝报价（放款之前），
      与附册／WS-326 里的「融资确认」＝资产方确认收到放款（放款之后）同名不同义。
      本页按分册 6.9 的映射表承载，冲突已登记进分册 10.5。 */
var FLOW4 = [
  { k:'demand',   g:'stDemand',   act:'publish',  who:'asset',
    x:['The asset owner publishes the demand. Publishing is the only thing that creates committed demand.',
       '资产方发布融资需求。发布即产生在途占用，这是项目在途金额的唯一来源。'] },
  { k:'quote',    g:'stQuote',    act:'quote',    who:'fund',
    x:['A funder submits a quote; the quote locks this demand for 168 hours. Rules live in WS-325.',
       '资金方提交报价，报价将该需求锁定 168 小时。规则属 WS-325。'] },
  { k:'confirm',  g:'stConfirm',  act:'respond',  who:'asset',
    x:['The asset owner accepts or rejects. Rejecting returns the demand to the Quote stage and other funders may quote again. Rules live in WS-325.',
       '资产方接受或拒绝报价。拒绝后退回融资报价环节，其他机构可继续报价。规则属 WS-325。'] },
  { k:'disburse', g:'stDisburse', act:'disburse', who:'fund',
    x:['The funder disburses, then the asset owner confirms receipt and the deal moves to repayment. Rules live in WS-326.',
       '资金方放款，资产方确认到账后业务转入还款。规则属 WS-326。'] }
];
/* 当前环节由项目与业务状态推导；真实实现应取服务端返回的当前环节与 available_actions（AC-LS-87）。 */
function flowStage(p){
  if(p.fin && (p.fin.st === 'S-FD-3' || p.fin.st === 'S-FD-4')) return 3;
  if(p.status === 'S-FP-3') return 2;
  if(!p.demand) return 0;
  if(p.status === 'S-FP-2') return 1;
  return 3;
}
/* 本轮要约是否走完：没有在途需求，且业务已进入还款或结清。
   只看 p.rep 是不对的——一个项目可以「上一笔在还款」同时「这一笔刚发布等报价」。 */
function flowDone(p){
  /* 终态项目（已关闭 / 已结清）没有在跑的融资流程，四环节一律按走完呈现，
     否则会在一个已结清的项目上把「融资需求」标成"当前环节"并挂一个 ⊘ 发布按钮。 */
  if(p.status === 'S-FP-5' || p.status === 'S-FP-6') return true;
  return !p.demand && !!(p.rep || (p.fin && (p.fin.st === 'S-FD-6' || p.fin.st === 'S-FD-8')));
}
function flowBlock(p, acts){
  var cur = flowStage(p), done = flowDone(p);
  var body = FLOW4.map(function(f, i){
    var cls = done ? 'done' : (i < cur ? 'done' : i === cur ? 'now' : 'next');
    var btn = '';
    if(i === cur && !done){
      /* 环节按钮只在当前环节出现（AC-LS-85）。第 4 环节有放款与确认到账两个动作，
         哪一个可用由 available_actions 决定，前端不自行按状态推断。 */
      var keys = (f.act === 'disburse') ? ['disburse','confirm'] : [f.act];
      keys.forEach(function(k){
        var a = actionOf(acts, k);
        if(a) btn += '<div class="fa">' + stageBtn(a, k) + '</div>';
      });
      if(!btn){
        var whoT = f.who === 'fund' ? g('funder') : g('assetOwner');
        btn = '<div class="fa"><button class="btn sm blocked" type="button" aria-disabled="true" data-act="ls.stageWhy" data-v="' + f.k + '">⊘ ' +
          E(stageLabel(f)) + '</button><p class="ls-subcap">' +
          L('This step is taken by the ' + whoT.toLowerCase() + '. Your current role cannot act here.',
            '该环节由' + whoT + '操作，当前身份不能在此动作。') + '</p></div>';
      }
    }
    return '<div class="fs ' + cls + '"><div class="t"><span class="no">' + (i+1) + '</span>' + g(f.g) +
      (i === cur && !done ? ' · ' + L('current','当前') : '') + '</div>' +
      '<div class="x">' + E(L(f.x[0], f.x[1])) + '</div>' + btn + '</div>';
  }).join('');
  return '<div class="ls-flow4">' + body + '</div>' +
    '<p class="hint" style="margin-top:11px">' + L(
      'Quote, accept/reject and disbursement are delivered by WS-325 / WS-326. This module carries the stage display and mapping only; each stage dialog shows the public facts and hands off to the owning module.',
      '报价、接受/拒绝与放款由 WS-325 / WS-326 交付。本模块只承载环节展示与映射；环节弹窗给出已公开的事实，真正的操作交回对应模块完成。') + '</p>';
}
function stageLabel(f){
  return { publish:g('publishDemand'), quote:L('Submit quote','提交报价'),
           respond:L('Accept / Reject quote','接受 / 拒绝报价'), disburse:L('Disburse','放款') }[f.act];
}
/* 环节操作一律走弹窗、不跳离详情页（AC-LS-85）。发布是本模块自己的动作，弹窗内完成；
   报价 / 接受拒绝 / 放款 / 确认到账属下游模块，弹窗是壳，壳里给出口。 */
function stageBtn(a, k){
  if(!a.enabled) return '<button class="btn sm blocked" type="button" aria-disabled="true" title="' + E(a.reason) +
    '" data-act="ls.why" data-v="' + a.key + '">⊘ ' + E(a.label) + '</button>' + whyLine(a.reason);
  return '<button class="btn sm primary" type="button" data-act="ls.stage" data-v="' + k + '">' + E(a.label) + '</button>';
}

/* ---------------- 操作区段 ③：还款流程（6.5.5 / 分册 6.9） ----------------
   展示最近一笔还款的核心信息，可按需求编号切换；规则属 WS-327，本模块只承载展示，
   **不自行重算利息或逾期天数**（AC-LS-115）。 */
function repayBlock(p, acts){
  var rec = demandRecords(p).filter(function(r){ return r.st === 'funded'; });
  if(!p.rep || !rec.length)
    return '<p class="hint">' + (rec.length
      ? L('The financing on this project has been settled; there is nothing left to repay.',
          '本项目的融资业务已结清，没有待还款事项。')
      : L('No disbursed financing on this project yet, so there is nothing to repay.',
          '本项目暂无已放款的融资业务，当前没有还款事项。')) + '</p>';
  var sel = rec.filter(function(r){ return r.no === S.repayNo; })[0] || rec[0];
  var rp = p.rep;
  var rows = [
    [g('demandNo'), sel.no],
    [L('Financing deal','融资业务编号'), rp.deal],
    [L('Settled / total instalments','已结清 / 总期数'), rp.done + ' / ' + rp.n],
    [L('Next instalment due','最近一笔应还'), rp.nextDue || '—'],
    [L('Amount due','应还合计'), rp.nextDue ? usd(rp.nextTotal) : '—'],
    [L('Unpaid principal','未偿本金'), usd(rp.unpaidPri)]
  ];
  if(rp.overdueDays) rows.push([L('Overdue flag','逾期标记'),
    L(rp.overdueDays + ' days · instalment ' + rp.overdueSeq, '已逾期 ' + rp.overdueDays + ' 天 · 第 ' + rp.overdueSeq + ' 期')]);
  var repay = actionOf(acts, 'repay');
  return (rec.length > 1 ? '<label class="fl" style="margin-bottom:12px;width:100%"><span>' + g('demandNo') + '</span>' +
      '<select class="inp" data-act="ls.repaySel">' + rec.map(function(r){
        return '<option value="' + r.no + '"' + (r.no === sel.no ? ' selected' : '') + '>' + r.no + '</option>'; }).join('') +
      '</select></label>' : '') +
    '<div class="rows" style="box-shadow:none">' + rows.map(function(r){
      return '<div class="row"><div class="row-main"><div class="row-k">' + E(r[0]) + '</div>' +
        '<div class="row-v mono">' + E(String(r[1])) + '</div></div></div>'; }).join('') + '</div>' +
    (repay ? '<div style="margin-top:12px">' +
       (repay.enabled ? '<button class="btn block" type="button" data-act="ls.stage" data-v="repay">' + g('repayNow') + '</button>'
                      : '<button class="btn blocked block" type="button" aria-disabled="true" data-act="ls.why" data-v="repay">⊘ ' +
                        g('repayNow') + '</button>' + whyLine(repay.reason)) + '</div>' : '') +
    '<p class="hint" style="margin-top:11px">' + L(
      'Instalment amounts, interest and overdue days are produced by WS-327 and read here without recalculation (AC-LS-115). The overdue flag runs in parallel with the deal status — a deal can be both repaying and overdue.',
      '期次金额、利息与逾期天数由 WS-327 权威产出，本页只读引用、不自行重算（AC-LS-115）。逾期是并行标记而非状态——一笔业务可以同时「还款中」且「逾期」。') + '</p>';
}

/* ---------------- 操作区段 ①：全局操作（6.5.5 / D-FIN-78） ---------------- */
function globalBlock(p, acts, own){
  var out = '', st = p.status, terminal = (st === 'S-FP-5' || st === 'S-FP-6');
  /* 非本方企业主体：本方数据按企业主体在服务端过滤（AC-LS-06），所以这里本就没有全局动作。
     v1.4 那句"当前身份对本项目没有可用的全局操作"会让人以为是按环节禁掉了，改成讲清归属。 */
  if(!own)
    return '<p class="hint">' + L(
      'This project belongs to another entity (' + E(dtr(p.owner)) + '). Own-entity actions — adding collateral, releasing collateral, closing the project — are filtered by entity on the server (AC-LS-06), so they are not available here. Everything on this page that is public stays fully visible.',
      '本项目属于另一个企业主体（' + E(dtr(p.owner)) + '）。追加质押、解除质押、关闭项目属于本方数据，按企业主体在服务端过滤（AC-LS-06），因此这里没有这些入口。本页的公开信息一条不少。') + '</p>';

  /* 草稿态时「发布融资需求」也在这一段出现（6.5.5 段①），
     因为此时页面上没有第 ② 段可点的环节按钮，用户第一件事就是发布。 */
  if(p.draft){
    var pub = actionOf(acts, 'publish');
    if(pub) out += actBtn(pub, 'primary block');
  }
  /* 三件全局操作对本方资产方常驻——报价中、放款中、还款中都在，不按环节消失。
     终态下追加与关闭置为不可用并给原因，**解除质押仍然可用**（D-FIN-57）。 */
  var pl = actionOf(acts, 'pledge');
  if(pl) out += actBtn(pl, (p.draft || terminal ? '' : 'primary ') + 'block', true);
  var rel = actionOf(acts, 'release');
  if(rel){
    /* D-FIN-78：可提取代币不再单独做提示块（AC-LS-38 改写），
       改为在合并后的「解除质押」入口上以角标 + 副文案提示数量与金额。 */
    if(rel.redeemable) rel.badge = rel.redeemable;
    out += actBtn(rel, (terminal ? 'primary ' : '') + 'block', true);
    /* 待提取代币是**企业主体级**的（合约里躺着的那批），不是本项目池内的，
       所以副文案要说清来源项目，否则在每个项目下都写「其中 N 张」会让人以为是本项目的。 */
    if(rel.redeemable){
      var srcs = [], i;
      for(i=0;i<REDEEMABLE.length;i++) if(srcs.indexOf(REDEEMABLE[i].from) < 0) srcs.push(REDEEMABLE[i].from);
      out += '<p class="ls-subcap">' + L(
        'The pledge contract still holds ' + rel.redeemable + ' released token(s) worth ' + usd(rel.redeemValue) +
        ' from ' + srcs.join(' / ') + '. They can be withdrawn from this same entry, with no time limit.',
        '质押合约内还有 ' + rel.redeemable + ' 张已释放代币（合计 ' + usd(rel.redeemValue) + '，来自 ' + srcs.join(' / ') +
        '）待提取，可在本入口一并提取，无时间限制。') + '</p>';
    }
    if(!terminal) out += '<p class="ls-subcap">' + L(
      'Release headroom on this pool right now: ' + usd(rel.wLimit) + ' (available to borrow ÷ ' + (PLEDGE_RATE*100) +
      '%). Invalidated tokens are not subject to it.',
      '本池当前可撤回上限 ' + usd(rel.wLimit) + '（＝可融金额 ÷ ' + (PLEDGE_RATE*100) + '%）。已失效代币不受此限制。') + '</p>';
  }
  var cl = actionOf(acts, 'close');
  if(cl) out += actBtn(cl, 'block', true);
  /* ⊘ 的原因不再逐个挂在按钮下面（三个按钮会堆出三段小字）：
     终态由段末那一整段说明承载，其余情形才逐条给原因。 */
  if(!terminal)
    [pl, rel, cl].forEach(function(a){ if(a && !a.enabled && a.reason) out += whyLine(a.reason); });
  if(terminal) out += '<p class="hint" style="margin-top:12px">' + L(
    'The project is in a terminal state, so adding collateral and closing are no longer available. <b>Releasing collateral stays open</b>: the business-side release happened at the moment of closure / settlement, but the tokens are still inside the pledge contract — you withdraw them yourself, pay the gas, and there is <b>no deadline and no expiry</b> (D-FIN-57).',
    '项目已是终态，追加质押与关闭项目不再可用。<b>解除质押仍然可用</b>：业务释放在关闭 / 结清的同一时刻已完成，但代币仍停留在质押合约内，需您自行发起提取并自付 gas，<b>无时间限制、不过期</b>（D-FIN-57）。') + '</p>';
  return out;
}

function seg(title, note, body){
  return '<div class="ls-seg"><div class="sh">' + E(title) + (note ? '<span class="n">' + note + '</span>' : '') + '</div>' + body + '</div>';
}

/* 非登录态：操作区只呈现一个「立即登录」按钮（D-LS-14）。
   信息 L1～L5 一条不少（D-LS-04 / D-LS-09 不变）；
   服务端动作鉴权与跨主体隔离也一条不减（AC-LS-86）——少几个按钮不构成校验上的放松。 */
function guestActs(){
  return '<div class="card-b ls-guest"><p class="lead">' + L(
    'Everything on this page is public. Sign in to act on it.',
    '本页信息全量公开，登录后即可操作。') + '</p>' +
    '<button class="btn primary block" type="button" data-act="ls.signin">' + g('signIn') + '</button>' +
    '<p class="hint" style="margin-top:12px">' + L(
      'Action authorisation lives on the server. Calling any write endpoint while signed out — or as a different entity — is rejected there and the response carries no business data. Removing the greyed-out buttons changes nothing about that check (AC-LS-86).',
      '动作鉴权在服务端。未登录或越权主体直接调用任何写接口一律被拒绝，且响应不含业务数据。前端少了几个置灰按钮，不构成任何校验上的放松（AC-LS-86）。') + '</p></div>';
}

function pageProject(){
  var p = findProject(S.pid);
  var own = p ? (S.role === 'asset' && p.entity === ACTORS.asset.entity) : false;
  if(!p || (p.draft && !own) || S.st === 'gone')
    return pageHead(L('Not found or not accessible','内容不存在或无权访问'), '') +
      '<div class="card"><div class="tbl-empty"><b>' + L('Not found or not accessible','内容不存在或无权访问') + '</b>' +
      L('Draft projects are not listed on the marketplace, are not searchable, and cannot be reached by deep link (AC-LS-05 / D-FIN-64).',
        '草稿项目不进入广场、不可搜索、不可深链直达（AC-LS-05 / D-FIN-64）。') +
      '<div style="margin-top:14px"><button class="btn primary" type="button" data-act="go" data-v="P-LS-01">' +
      L('← Back to the marketplace','← 返回借贷广场') + '</button></div></div></div>';

  var d = derive(p), acts = availableActions(p, S.role);
  var terminalP = (p.status === 'S-FP-5' || p.status === 'S-FP-6');
  chartQueue = [];

  if(S.st === 'loading')
    return pageHead(dtr(p.name), '') + '<div class="card"><div class="card-b">' +
      '<div class="skel" style="height:60px"></div><div class="skel" style="height:200px;margin-top:16px"></div></div></div>';
  if(S.st === 'error')
    return pageHead(dtr(p.name), '') + '<div class="card"><div class="tbl-empty"><b>' + L('Could not load this project','详情加载失败') + '</b>' +
      L('The server did not return data for this project. You can retry.','服务端未返回该项目数据，可重试。') + '<div style="margin-top:14px">' +
      '<button class="btn primary" type="button" data-act="st" data-v="default">' + L('Reload','重新加载') + '</button></div></div></div>';

  /* ---- 页头：返回按钮 + 图标块 + 超大标题 + 大号标签行 ---- */
  /* v1.4：页头右上角那块「融资需求金额 + 有效期至」整块删除——金额与统计区第 3 格
     是同一个数（需求方 09-14 第 5 条）。
     **有效期的绝对日期没有跟着一起丢**：它是 L2 融资需求摘要的必备字段，
     且 D-FIN-37 要求「首次发布日 + 1 年、只读、不可延期」这条口径看得见，
     所以挪进 kick 行与发布日并列。pill 行上的「有效期剩余 N 天」是相对倒计时，
     两者并存才既有绝对日期又有紧迫感（AC-LS-02 的"无输入框、无日期选择器"不受影响）。 */
  var head =
    '<div class="ls-back"><button class="btn" type="button" data-act="go" data-v="P-LS-01">' +
      L('← Back to the marketplace','← 返回借贷广场') + '</button></div>' +
    '<div class="ls-phead"><div class="tile" aria-hidden="true">◧</div><div class="body">' +
      '<p class="kick">' + g('project') + ' · ' +
        L('published ','发布于 ') + '<span class="mono">' + (p.publishedAt || '—') + '</span> · ' +
        g('validityTo') + ' <span class="mono">' + (p.expiresAt || '—') + '</span> ' +
        '<span class="ro">' + (p.expiresAt
          ? L('first publish + ' + TERM_YEARS + ' year · read-only', '首次发布日 + ' + TERM_YEARS + ' 年 · 只读')
          : L('generated at first publish','首次发布时生成')) + '</span> · ' +
        L('ID ','编号 ') + '<span class="mono">' + p.id + '</span> · ' + TZ_LABEL + '</p>' +
      '<h1>' + E(dtr(p.name)) + '<em>' + E(dtr(p.owner)) + '</em></h1>' +
      '<div class="ls-tags">' + statusPills(p) + '</div>' +
    '</div></div>' + CF.pageStates();

  /* ---- 左栏 1（v1.4 新位置）：锁定信息 ----
     原来在右栏顶部，需求方 09-14 第 2 条要求右栏只放操作项，所以整块搬到质押代币清单上方。
     **内容一项没减**：被谁锁定 / 从什么时候起 / 已锁定多久 / 还剩多久，外加两条出路，
     四项齐全（WS-325 D-LS-20 / AC-LS-97）。搬到宽栏后改用 .ls-lock.wide 的两列排布，
     左列讲"被谁锁、从何时起"，右列是倒计时与两条出路。 */
  var lockBlock = p.quote
    ? '<div class="card" style="margin-bottom:16px">' +
        cardHead(L('Lock information','锁定信息'),
          faint(L('public field · countdown produced by WS-325','公开字段 · 倒计时口径由 WS-325 权威产出'))) +
        '<div class="card-b">' + lockCard(p, own, true) + '</div></div>'
    : '';

  /* ---- 左栏 2：质押代币清单（L4 全量逐张，不脱敏、不区间化；固定每页 5 条 AC-LS-90） ---- */
  var tp = paged(p.tokens, 'tokPage');
  var pledgeCard = '<div class="card">' + cardHead(L('Pledged token list','质押代币清单'),
      faint(L(p.tokens.length + ' tokens · every token listed individually, not masked, not bucketed',
              '共 ' + p.tokens.length + ' 张 · 全量逐张展示，不脱敏、不区间化'))) +
    '<div class="tablewrap" style="border:0;box-shadow:none;border-radius:0"><table class="tbl ls-wide"><thead><tr>' +
      '<th>' + g('tokenId') + '</th><th class="num">' + g('tokenQty') + '</th><th class="num">' + g('tokenValue') + '</th>' +
      '<th class="num">' + g('dueDate') + '</th><th>' + g('buyer') + '</th>' +
      '<th>' + g('tokenState') + '</th><th>' + g('onchain') + '</th></tr></thead><tbody>' +
      (tp.rows.length ? tp.rows.map(function(t){
        return '<tr><td class="mono">' + t.id +
            '<div class="cell-sub"><span class="hash"><span class="val">' + shortHash(t.hash) + '</span></span></div></td>' +
          '<td class="num">1 · <span class="faint">' + L(TOKEN_SYM[0], TOKEN_SYM[1]) + '</span></td>' +
          '<td class="num">' + amt(t.amt) + ' <span class="faint">' + CCY + '</span></td>' +
          '<td class="num">' + t.due + '</td><td>' + E(dtr(t.buyer)) + '</td>' +
          '<td>' + (t.dead ? pill('amber', L('Invalid · excluded from coverage since ' + (t.deadAt||''),
                                             '已失效 · 不计入覆盖 · ' + (t.deadAt||'')))
                           : pill('green', g('valid'))) + '</td>' +
          '<td>' + pill(TONE[CT_STATUS[t.ct].tone] || 'gray', ctStatus(t.ct)) + '</td></tr>';
      }).join('') : '<tr><td colspan="7" class="tbl-empty"><b>' +
        (terminalP
          ? L('The pool is empty','本池已空') + '</b>' +
            L('The collateral was released in business terms at the moment the project closed or settled. Tokens still awaiting on-chain withdrawal are listed in the "Release collateral" dialog (D-FIN-57).',
              '质押在项目关闭 / 结清的同一时刻已全额业务释放。仍待链上提取的代币在「解除质押」弹窗内列出（D-FIN-57）。')
          : L('No valid collateral in this pool','本项目暂无有效质押') + '</b>' +
            L('The pledge submitted at creation ultimately failed on chain. Pledge again before publishing.',
              '创建时那笔质押最终链上失败，可重新质押后再发布。')) + '</td></tr>') +
    '</tbody></table></div>' + pgBar(tp, 'tokPage') +
    '<div class="card-b" style="padding-top:12px">' + CF.note('', L(
      'What is fully public is the financing demand and deal information shown on the marketplace. It does <strong class="ls-b">not</strong> include credit lines, other parties’ console data, operations-side diagnostic fields, scanned attachments or contact details.' +
      '<p>Since V8.0 the contract number and invoice number of the underlying receivable are <strong class="ls-b">no longer public either</strong> (D-LS-10 as revised). Buyer name, exact amount and due date remain public; the rate limiting and scraping detection that go with that are in appendix chapter 8.</p>',
      '全量公开的范围是广场上展示的融资需求与融资业务信息；<strong class="ls-b">不含</strong>授信额度、他人控制台数据、运营端诊断字段、附件影像件与联系人联系方式。' +
      '<p>V8.0 起<strong class="ls-b">底层应收账款的合同号与发票号也不再公开</strong>（D-LS-10 修订）。买方企业名、精确金额与账期仍然公开，配套的接口速率限制与异常抓取识别见分册第 8 章。</p>')) +
    '</div></div>';

  /* ---- 左栏 2：融资信息清单（一行 = 一笔需求，按需求编号 FP-28 逐笔；固定每页 5 条） ---- */
  var recs = demandRecords(p), rp2 = paged(recs, 'demPage');
  var demandCard = '<div class="card" style="margin-top:16px">' + cardHead(L('Financing demand list','融资信息清单'),
      faint(L('one row per demand · ' + recs.length + ' in total', '一行 = 一笔融资需求 · 共 ' + recs.length + ' 笔'))) +
    '<div class="tablewrap" style="border:0;box-shadow:none;border-radius:0"><table class="tbl"><thead><tr>' +
      '<th>' + g('demandNo') + '</th><th class="num">' + g('demandAmt') + '</th><th>' + g('status') + '</th>' +
      '<th>' + g('funderName') + '</th></tr></thead><tbody>' +
      (rp2.rows.length ? rp2.rows.map(function(r){
        return '<tr><td class="mono">' + r.no +
            '<div class="cell-sub">' + L('published ','发布于 ') + r.at + (r.deal ? ' · ' + r.deal : '') + '</div></td>' +
          '<td class="num">' + amt(r.amt) + ' <span class="faint">' + CCY + '</span></td>' +
          '<td>' + demandPill(r) + '</td>' +
          '<td>' + (r.fund ? E(dtr(r.fund)) + (r.qat ? '<div class="cell-sub">' + r.qat + '</div>' : '')
                           : '<span class="faint">—</span>') + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="tbl-empty"><b>' + L('No demand has been published on this project yet','本项目尚未发布过融资需求') + '</b>' +
        L('Once the pool holds valid collateral, publish a demand from the actions panel.',
          '池内有有效质押后，在右侧操作区发布融资需求即可。') + '</td></tr>') +
    '</tbody></table></div>' + pgBar(rp2, 'demPage') +
    '<div class="card-b" style="padding-top:12px">' + CF.note('', L(
      'A demand ID is <strong class="ls-b">project ID + a two-digit round number</strong> (D-LS-13). It is a derived identifier, not a second object: no second state machine, no second deep-link anchor — it is still round N of the same project (D-LS-11 / H-01).' +
      '<p>Commercial terms: ' + (p.terms ? 'rate ' + E(dtr(p.terms.rate)) + ' · term ' + E(dtr(p.terms.term)) + ' · ' + E(dtr(p.terms.repay)) + ' · use of funds ' + E(dtr(p.terms.use))
        : 'this project currently has no public commercial terms.') + '</p>',
      '需求编号 ＝ <strong class="ls-b">项目编号 + 两位轮次序号</strong>（D-LS-13）。它是派生编号、不是第二个对象：不产生第二套状态机、第二个深链锚点——仍然是同一个项目的第 N 轮要约（D-LS-11 / H-01）。' +
      '<p>商务条款：' + (p.terms ? '报价利率 ' + E(dtr(p.terms.rate)) + ' · 融资期限 ' + E(dtr(p.terms.term)) + ' · ' + E(dtr(p.terms.repay)) + ' · 资金用途 ' + E(dtr(p.terms.use))
        : '该项目当前无公开的在途业务商务条款。') + '</p>')) + '</div></div>';

  /* ---- 左栏（v1.4 新位置：融资信息清单下方）：在途报价与报价历史 ----
     需求方 09-14 第 3 条要求改列表展示。一行 = 一笔报价，在途与历史同表、用状态列区分，
     与「融资信息清单」是同一套表格语言。
     公开字段：机构名称、报价金额、年化利率、结算币种与金额、报价提交时间、终结方式与原因。
     **不展示报价时的池快照**（AC-LS-27 已作废）；锁定倒计时不在这张表里重复，
     它整块在左栏第一张「锁定信息」卡上（四项齐全）。
     口径由 WS-325 权威产出，本页只读引用、不自行计算（AC-LS-94）。 */
  var past = p.pastQuotes || [];
  var qRows = [];
  if(p.quote) qRows.push({ q:p.quote, live:true });
  past.forEach(function(qq){ qRows.push({ q:qq, live:false }); });
  function quoteState(r){
    if(r.live){
      var k = quoteClock(r.q);
      return pill(k.soon ? 'amber' : 'info', L('Live · ' + fmtDur(k.leftMin) + ' left', '在途 · 剩余 ' + fmtDur(k.leftMin))) +
        '<div class="cell-sub">' + L('expires ' + k.to, '到期时刻 ' + k.to) + '</div>';
    }
    if(r.q.st === 'S-FD-2')
      return pill('gray', L('S-FD-2 Rejected','S-FD-2 已拒绝')) +
        '<div class="cell-sub" style="white-space:normal">' +
        L('Rejection reason (visible to the quoting institution): ','拒绝原因（对报价机构可见）：') +
        E(dtr(r.q.why || '')) + '</div>';
    return pill('gray', L('S-FD-11 Quote expired','S-FD-11 报价已失效')) +
      '<div class="cell-sub" style="white-space:normal">' + E(dtr(r.q.void || '')) + ' · ' +
      L('system event, no reason to record','系统事件，无原因可填') + '</div>';
  }
  var quoteCard = !qRows.length ? '' :
    '<div class="card" style="margin-top:16px">' + cardHead(L('Quotes on this project','在途报价与报价历史'),
      faint(L('one row per quote · ' + qRows.length + ' in total · produced by WS-325, read-only here',
              '一行 = 一笔报价 · 共 ' + qRows.length + ' 笔 · 口径由 WS-325 权威产出，本页只读引用'))) +
    '<div class="tablewrap" style="border:0;box-shadow:none;border-radius:0"><table class="tbl ls-qtbl"><thead><tr>' +
      '<th>' + L('Financing deal ID','融资业务编号') + '</th>' +
      '<th>' + L('Quoting institution','报价机构') + '</th>' +
      '<th class="num">' + L('Quoted amount','报价金额') + '</th>' +
      '<th class="num">' + L('Annual rate','年化利率') + '</th>' +
      '<th class="num">' + L('Settlement','结算币种与金额') + '</th>' +
      '<th class="num">' + L('Submitted at','报价提交时间') + '</th>' +
      '<th>' + g('status') + '</th></tr></thead><tbody>' +
      qRows.map(function(r){
        return '<tr><td class="mono">' + r.q.deal + '</td>' +
          '<td>' + E(dtr(r.q.fund)) + '</td>' +
          '<td class="num">' + amt(r.q.amt) + ' <span class="faint">' + CCY + '</span></td>' +
          '<td class="num">' + r.q.rate.toFixed(2) + '%</td>' +
          '<td class="num">' + (r.q.settle ? amt(r.q.settle) + ' ' + (r.q.ccy || CCY) : '—') + '</td>' +
          '<td class="num">' + r.q.at + '<div class="cell-sub">' + TZ_LABEL +
            (r.q.endAt ? ' · ' + L('ended ','终结 ') + r.q.endAt : '') + '</div></td>' +
          '<td>' + quoteState(r) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
    '<div class="card-b" style="padding-top:12px">' + CF.note('', L(
      'Rejected and expired are <b class="ls-b">two different terminal states</b>: a rejection is the asset owner’s decision (has a reason, visible to the institution); an expiry is a system event (no reason, not counted towards a rejection rate). The consequences for the credit line and the project are identical — only the landing state and the presence of a reason differ. The deal ID is retained but voided; it is never recycled or reused.' +
      '<p>The quoted amount is always equal to the demand amount; the settlement figure uses the FX snapshot locked at submission. Interest accrual follows the signed financing contract, not this table.</p>',
      '已拒绝与已失效是<b class="ls-b">两个不同的终态</b>：拒绝是资产方的意思表示（有原因、对机构可见）；失效是系统事件（无原因、不计入拒绝率）。两者对额度与项目的后果完全相同，差别只在状态落点与有没有原因。编号保留但作废，不回收、不复用。' +
      '<p>报价金额恒等于需求金额；结算金额按报价提交时锁定的汇率快照折算。计息规则以双方签署的融资合同为准，不以本表为准。</p>')) +
    '</div></div>';

  /* ---- 左栏 4（WS-326 增量）：放款与融资确认的公开进度 ----
     公开字段：放款提交时间、放款币种与金额、确认时间、终止时间与原因（D-LN-06）。
     **不公开**：收款账户、凭证文件、交易哈希与链、盖章件、暂缓与重传原因——
     它们由服务端按归属过滤，不是前端隐藏（AC-LN-17 / AC-LS-100）。 */
  var fin = p.fin;
  var FIN_EV = {
    accept   :{ t:['Quote accepted · awaiting disbursement','已接受报价 · 待放款'], tone:'' },
    disb     :{ t:['Disbursed · awaiting financing confirmation','已放款 · 待融资确认'], tone:'' },
    fund     :{ t:['Receipt confirmed · credit transferred atomically','已确认到账 · 额度已原子转移'], tone:'green' },
    terminate:{ t:['Deal terminated · demand back on the marketplace','业务已终止 · 需求重回广场'], tone:'gray' },
    plan     :{ t:['Repayment schedule finalised','还款计划已定稿'], tone:'' },
    repay    :{ t:['Repayment record submitted · awaiting confirmation','已提交还款记录 · 待还款确认'], tone:'' },
    rconf    :{ t:['Instalment settled','该期已结清'], tone:'green' },
    odue     :{ t:['Overdue flag (parallel marker, not a status)','逾期标记（并行标记，非状态）'], tone:'gray' },
    settle   :{ t:['Deal settled · terminal','业务已结清 · 终态'], tone:'green' }
  };
  var finEv = (p.events || []).filter(function(e){ return FIN_EV[e.k]; });
  var finCard = (!fin && !finEv.length) ? '' :
    '<div class="card" style="margin-top:16px">' + cardHead(L('Disbursement and financing confirmation','放款与融资确认'),
      faint(L('public fields · produced by WS-326, read-only here','公开字段 · 口径由 WS-326 权威产出，本页只读引用'))) +
    (!fin ? '' : '<div class="card-b"><div class="ls-kgrid">' +
      kcell(L('Financing deal ID','融资业务编号'), fin.deal, L('Generated when the quote is accepted; stable for life','接受报价时生成，终身稳定')) +
      kcell(L('Deal status','业务状态'), pill('info', fin.st + ' ' + finSt(fin.st)),
        fin.st === 'S-FD-3'
          ? L('Waiting for the funder to verify the signed contract and disburse; verification and handling are actions, not statuses (D-LN-01)',
              '等待资金方核验盖章件并放款；核验与处置动作不是状态（D-LN-01）')
          : L('The disbursement record has been submitted; waiting for the asset owner to confirm receipt',
              '放款记录已提交，等待资产方确认到账'), true) +
      kcell(g('funder'), E(dtr(fin.fund)), L('Full legal entity name · public field','机构企业主体全称 · 公开字段'), true) +
      kcell(L('Financing amount','融资金额'), amt(fin.amt),
        CCY + L(' · principal follows this figure, not the amount actually received',' · 债务本金按此计，不按实收计')) +
      kcell(L('Settlement currency and amount','结算币种与金额'), amt(fin.settle) + ' ' + fin.ccy,
        L('Converted at the FX snapshot locked when the quote was submitted','按报价时锁定的汇率快照折算')) +
      kcell(L('Accepted at','接受时间'), fin.acceptedAt + ' ' + TZ_LABEL,
        L('The quote validity clock stops here','报价有效期计时自此终止')) +
      (fin.st === 'S-FD-4' ?
        kcell(L('Disbursement submitted at · LN-06','放款提交时间 · LN-06'), fin.lnAt + ' ' + TZ_LABEL,
          L('Server time; start of the financing-confirmation window','服务端时间，融资确认时限的起算点')) +
        kcell(L('Disbursement record ID · LN-01','放款记录编号 · LN-01'), fin.lnId,
          L('Generated at the moment of successful submission','提交成功的同一时刻生成')) +
        kcell(L('Confirmation window until · FD-26','融资确认时限至 · FD-26'), fin.confirmTo + ' ' + TZ_LABEL,
          L('= disbursement time + 168 hours; read-only, cannot be extended','＝ 放款提交时间 + 168 小时，只读、不可延长')) : '') +
    '</div>' +
    (fin.st === 'S-FD-4'
      ? CF.note('', L(
          '<b class="ls-b">When the financing-confirmation window expires, nothing is auto-confirmed, nothing is voided</b> and no credit moves: expiry only sends a notification, the deal stays at S-FD-4 and the confirm entry keeps working (WS-326 D-LN-03).' +
          '<p>This is <b class="ls-b">not the same clock</b> as the 168-hour quote validity above: a quote <b class="ls-b">expires automatically</b>, a financing-confirmation window <b class="ls-b">only reminds</b>. The two are worded differently and do not share the phrase "validity" (D-LN-19).</p>' +
          (own ? '<p>Money missing or the amount wrong? There is <b class="ls-b">no "raise a dispute" entry</b> on the platform. Do not confirm; email <b class="ls-b">{platform support mailbox}</b> quoting deal ID ' + fin.deal +
                 ' and settle it offline (WS-326 D-LN-34; this page is one of the three places that entry appears).</p>' : ''),
          '<b class="ls-b">融资确认时限届满不会自动确认、不会自动作废这笔业务</b>，也不会自动转移任何额度：到期只发一条通知，业务仍是 S-FD-4，确认入口照常可用（WS-326 D-LN-03）。' +
          '<p>这与上面「在途报价」的 168 小时<b class="ls-b">不是同一个时限</b>：报价有效期到点<b class="ls-b">自动失效</b>，融资确认时限到点<b class="ls-b">只提醒</b>。两者措辞不同、不共用"有效期"三个字（D-LN-19）。</p>' +
          (own ? '<p>钱没到账或金额对不上？平台上<b class="ls-b">没有「提出异议」入口</b>，请先不要点确认，发邮件到 <b class="ls-b">{平台客服邮箱}</b> 并注明融资业务编号 ' + fin.deal +
                 '，走线下核实（WS-326 D-LN-34，本页是该入口的三处之一）。</p>' : '')),
          L('About the financing-confirmation window','关于融资确认时限'))
      : CF.note('', L(
          'The signed contract is <b class="ls-b">verified by the funder before disbursing</b>. The platform does not vet its authenticity or legal effect and has no platform-side review state. The institution may <b class="ls-b">hold off disbursing / ask for a re-upload / terminate the deal</b> (the three handling actions in WS-326 DEP-14).' +
          '<p><b class="ls-b">Hold and re-upload reasons are visible to the asset owner but are not marketplace-public fields</b> — they are commercial communication between two parties, and publishing them would broadcast one side’s commercial judgement to the whole market (D-LN-06).</p>',
          '盖章件由<b class="ls-b">资金方在放款前核验</b>，平台不审核真伪与法律效力、不设平台侧审核态。机构可以<b class="ls-b">暂不放款 / 要求重传盖章件 / 终止业务</b>（WS-326 DEP-14 的三个处置动作）。' +
          '<p><b class="ls-b">暂缓与重传的原因对资产方可见，但不进广场公开字段</b>——它们是双方之间的商务沟通，公开等于把一方的商业判断对全市场广播（D-LN-06）。</p>'),
          L('Who is doing what at this step','当前这一步由谁在做什么'))) +
    '<p class="hint" style="margin-top:12px"><b>' + L('Non-public fields','不公开字段') + '</b>' + L(
      ' (filtered on the server, not hidden in the front end): payee account, transfer receipt files, transaction hash and chain, the signed contract and its version history, hold-disbursement reasons, re-upload requests. For guests and third-party funders arriving by deep link these fields simply do not exist in the API response (AC-LN-17).',
      '（服务端过滤，不是前端隐藏）：收款账户、转账凭证文件、交易哈希与链、盖章件及其历史版本、暂缓放款原因、要求重传原因。游客与第三方资金方深链直达时，这些字段在接口响应里根本不存在（AC-LN-17）。') + '</p>' +
    '</div>') +
    (finEv.length ? '<div class="card-b"' + (fin ? ' style="border-top:1px solid var(--border)"' : '') + '>' +
      '<h3 class="sec-title" style="font-size:12.5px;margin-bottom:10px">' +
      L('Disbursement and confirmation timeline · public fields','放款与确认时间线 · 公开字段') + '</h3>' +
      '<ul class="tl">' + finEv.slice().reverse().map(function(e){
        var m = FIN_EV[e.k];
        return '<li><div style="font-size:12.5px">' + pill(m.tone, L(m.t[0], m.t[1])) +
          '<span class="mono" style="margin-left:8px">' + e.d + '</span></div>' +
          '<div class="faint" style="font-size:11.5px;margin-top:4px;line-height:1.6">' + E(dtr(e.t)) +
          (e.note ? '<br>' + E(dtr(e.note)) : '') + '</div></li>';
      }).join('') + '</ul>' +
      '<p class="hint">' + L(
        'Only public fields make it onto this timeline: <b>disbursement time, disbursement currency and amount, confirmation time, termination time and a neutrally worded reason</b>. Payee account, receipt files, transaction hash and the signed contract are not among them (D-LN-06).',
        '进时间线的只有公开字段：<b>放款提交时间、放款币种与金额、确认时间、终止时间与原因</b>（中性表述）。收款账户、凭证文件、交易哈希与盖章件不在其中（D-LN-06）。') +
      '</p></div>' : '') +
    '</div>';

  /* ---- 左栏 5（WS-327 增量）：还款计划与还款进度的公开进度 ----
     公开字段：期次数与已结清期数、每期应还日、每期应还本息与合计（USD）、期次状态、
     逾期标记与逾期天数、结清时间、还款记录的提交时间与币种金额（D-RP-41）。
     **不公开**：还款凭证文件、交易哈希与链、机构收款账户快照、还款备注与补充材料、确认备注。 */
  var rep = p.rep;
  var repCard = !rep ? '' :
    '<div class="card" style="margin-top:16px">' + cardHead(L('Repayment schedule and progress','还款计划与还款进度'),
      faint(L('public fields · produced by WS-327, read-only here','公开字段 · 口径由 WS-327 权威产出，本页只读引用'))) +
    '<div class="card-b"><div class="ls-kgrid">' +
      kcell(L('Financing deal ID','融资业务编号'), rep.deal,
        L('The schedule is finalised in the same settlement as the financing confirmation','还款计划在融资确认完成的同一次结算内定稿')) +
      kcell(L('Settled / total instalments','已结清 / 总期数'), rep.done + ' / ' + rep.n,
        L('Interest first, principal at maturity · interest every 3 months','先息后本 · 到期还本付息，利息每 3 个月一期')) +
      kcell(L('Interest start date','起息日'), rep.t0,
        L('= actual disbursement date (date part of the disbursement submission time)','＝ 实际放款日（放款记录提交时间的日期部分）')) +
      kcell(L('Financing maturity date','融资到期日'), rep.tn,
        L('The final instalment due date is identical to this and is frozen at finalisation','末期应还日恒等于本项，定稿时固化')) +
      kcell(L('Next instalment due','最近一笔应还'), rep.nextDue || '—',
        rep.nextDue ? L('Total due ' + amt(rep.nextTotal) + ' ' + CCY, '应还合计 ' + amt(rep.nextTotal) + ' ' + CCY)
                    : L('No instalment outstanding','无待还期次')) +
      kcell(L('Unpaid principal','未偿本金'), amt(rep.unpaidPri),
        CCY + L(' · this is the addend behind outstanding financing and credit utilisation',' · 它就是 项目融资余额 与 授信占用额 的被加数')) +
      (rep.overdueDays
        ? kcell(L('Overdue flag and days','逾期标记与逾期天数'),
            L(rep.overdueDays + ' days overdue', '已逾期 ' + rep.overdueDays + ' 天'),
            L('Instalment ' + rep.overdueSeq + ' (due ' + rep.overdueDue + ') · +1 each day, frozen on submission',
              '第 ' + rep.overdueSeq + ' 期（应还日 ' + rep.overdueDue + '）· 每日 +1，提交即冻结'))
        : kcell(L('Overdue flag','逾期标记'), L('None','无'),
            L('No instalment on this deal currently carries an overdue flag','该业务当前没有带逾期标记的期次'), true)) +
    '</div>' +
    '<div class="rows" style="box-shadow:none;margin-top:16px"><div class="row"><div class="row-main">' +
      '<div class="row-k">' + L('Interest rule','计息规则') + '</div>' +
      '<div class="row-v mono" style="font-size:12px;color:var(--muted)">' + E(dtr(rep.rules)) + '</div></div></div></div>' +
    (rep.overdueDays ? CF.note('', L(
      '<b class="ls-b">Overdue is a parallel flag, not a status.</b> The deal is still <b class="ls-b">S-FD-6 Repaying</b> — one deal can be both repaying and overdue at the same time: instalment 1 is overdue while instalment 3 is not yet due. Making them mutually exclusive would put the status at odds with the facts (D-FIN-09 / D-RP-35).' +
      '<p>An overdue instalment <b class="ls-b">accrues days only, no penalty interest</b>, and <b class="ls-b">triggers no automatic enforcement</b>: no disposal of pledged tokens, no forced liquidation, no subrogation, no acceleration (X-LS-45 / X-LS-46). <b class="ls-b">Principal repayment happens after the project term ends by design</b> (X-LS-06), so "matured · in run-off" is a normal path, not an anomaly.</p>',
      '<b class="ls-b">逾期是并行标记，不是状态。</b>该业务状态仍是 <b class="ls-b">S-FD-6 还款中</b>——一笔业务可以同时「还款中」且「逾期」：三期里第一期逾期、第三期还没到期，做成互斥状态会让状态与事实不符（D-FIN-09 / D-RP-35）。' +
      '<p>本期<b class="ls-b">只记逾期天数、不算罚息</b>，逾期<b class="ls-b">不触发任何自动处置</b>：不处置质押代币、不强制平仓、不代偿、不提前到期（X-LS-45 / X-LS-46）。<b class="ls-b">还本金本来就发生在融资项目到期之后</b>（X-LS-06），项目「已到期 · 存量处理中」是常态路径，不是异常。</p>'),
      L('About this overdue flag','关于这个逾期标记')) : '') +
    (rep.awaitConfirm ? CF.note('', L(
      'One instalment has a <b class="ls-b">repayment record submitted and is waiting for the funder to confirm</b> (schedule ID ' + rep.awaitConfirm + '). When the <b class="ls-b">repayment-confirmation window</b> expires it <b class="ls-b">does not auto-confirm, does not change any status and does not decrement any credit</b>: expiry only sends a notification (WS-327 D-RP-53).' +
      '<p><b class="ls-b">The asset owner’s overdue-day count froze at the moment of submission</b> and <b class="ls-b">does not keep growing because the institution is slow to confirm</b> (D-FIN-11). There is <b class="ls-b">no "raise a dispute" entry</b> here either: if the amount does not match or the money has not arrived, do not confirm — email <b class="ls-b">{platform support mailbox}</b> quoting deal ID ' + rep.deal + ' and schedule ID ' + rep.awaitConfirm + ' (D-RP-55; this page is one of three).</p>',
      '有一期<b class="ls-b">已提交还款记录、等待资金方确认</b>（还款计划编号 ' + rep.awaitConfirm + '）。<b class="ls-b">还款确认时限</b>届满<b class="ls-b">不会自动确认、不会自动改状态、不会自动递减任何额度</b>：到期只发一条通知（WS-327 D-RP-53）。' +
      '<p><b class="ls-b">资产方的逾期天数已在提交那一刻冻结</b>，<b class="ls-b">不因机构迟迟不确认而继续增加</b>（D-FIN-11）。本期<b class="ls-b">没有「提出异议」入口</b>：金额不符或款没到时，请先不要点确认，发邮件到 <b class="ls-b">{平台客服邮箱}</b> 并注明融资业务编号 ' + rep.deal + ' 与还款计划编号 ' + rep.awaitConfirm + '，走线下核实——本页是该入口的三处之一（D-RP-55）。</p>'),
      L('One instalment is awaiting repayment confirmation','有一期正在等待还款确认')) : '') +
    '<p class="hint" style="margin-top:12px"><b>' + L('Non-public fields','不公开字段') + '</b>' + L(
      ' (filtered on the server, not hidden in the front end): repayment receipt files, transaction hash and chain, the institution’s payee-account snapshot, repayment notes and supporting materials, confirmation notes. For guests and third parties arriving by deep link these fields do not exist in the API response (AC-LS-110).',
      '（服务端过滤，不是前端隐藏）：还款凭证文件、交易哈希与链、机构收款账户快照、还款备注与补充材料、确认备注。游客与第三方深链直达时，这些字段在接口响应里根本不存在（AC-LS-110）。') + '</p>' +
    '</div></div>';

  /* ---- 右栏：三段式操作区（6.5.5）---- */
  /* v1.4：右栏只放操作项（需求方 09-14 第 2 条）。原来顶部那张「锁定信息」卡已搬到左栏第一张。 */
  var rail = '<aside class="portal-rail">' +
    '<div class="card">' + cardHead(g('actions'), faint('L6')) +
    (S.role === 'guest' ? guestActs() :
      '<div class="card-b">' +
        seg(g('globalOps'), '', globalBlock(p, acts, own)) +
        seg(g('financingFlow'), faint(flowDone(p)
            ? L('all four stages complete','四个环节已走完')
            : L('stage ' + (flowStage(p)+1) + ' of 4', '第 ' + (flowStage(p)+1) + ' / 4 环节')),
            flowBlock(p, acts)) +
        seg(g('repayFlow'), '', repayBlock(p, acts)) +
      '</div>') +
    '<div class="card-b" style="border-top:1px solid var(--border);padding-top:12px">' +
      '<p class="hint">' + L('Deep link ','深链锚点 ') + '<span class="mono">project/' + p.id + '</span><br>' +
      L('Action anchors ','动作锚点 ') + '<span class="mono">?action=publish / pledge / withdraw / redeem</span><br>' +
      L('Quote and accept/reject are carried by WS-325: ','报价与接受 / 拒绝由 WS-325 承载：') +
      '<span class="mono">project/' + p.id + '?action=quote</span></p></div>' +
  '</div></aside>';

  /* ---- 两张图：两栏之下，页面最下方 ---- */
  var charts = '<div class="card" style="margin-top:16px">' + cardHead(L('Pool and financing movement','池内资产与融资变动'),
      faint(L('same source as the figures above · ' + CCY, '口径与上方读数同源 · 单位 ' + CCY))) +
    '<div class="card-b">' + chartBlock(p,'pool') + chartBlock(p,'fin') + '</div></div>';

  return head + shortAlert(p, d, own) + usedUpNote(d, p) + statRow(p) +
    '<div class="portal-cols"><div>' + lockBlock + pledgeCard + finCard + repCard + demandCard + quoteCard +
    '</div>' + rail + '</div>' + charts;
}
function kcell(k, v, x, sans){
  return '<div><div class="k">' + E(k) + '</div><div class="v"' + (sans ? ' style="font-family:var(--sans)"' : '') + '>' + v + '</div>' +
    '<div class="x">' + E(x) + '</div></div>';
}

/* ---- 图表外壳（几何与口径来自 Part A，逐行同源） ---- */
var chartQueue = [];
function chartBlock(p, kind){
  var d = derive(p), pts = d.pts, uid = kind + '-' + p.id.replace(/[^A-Za-z0-9]/g,'');
  chartQueue.push({ uid:uid, pts:pts, kind:kind });
  var isPool = kind === 'pool';
  var lg = isPool
    ? '<span><i class="s1"></i>' + L('Pledged token value (counts towards coverage)','有效质押价值（计入覆盖）') + '</span>' +
      '<span><i class="void"></i>' + L('Invalidated token value (excluded)','失效代币价值（不计入覆盖）') + '</span>' +
      '<span><i class="dash"></i>' + L('Total pool value','池内资产总额') + '</span>'
    : '<span><i class="ln"></i>' + L('Borrowing cap (= pledged token value × ' + (PLEDGE_RATE*100) + '%)',
        '融资上限（＝有效质押价值 × ' + (PLEDGE_RATE*100) + '%）') + '</span>' +
      '<span><i class="s2"></i>' + g('outstanding') + '</span>' +
      '<span><i class="s3"></i>' + g('committed') + '</span>' +
      '<span><i class="gap"></i>' + L('Insufficient-coverage interval','覆盖不足区间') + '</span>';
  var rd = isPool
    ? L('Blue is the part that <b>counts</b>; the grey hatching is the part <b>excluded because the underlying receivable was invalidated</b>. The two together are the book value of the pool.',
        '蓝色是<b>参与计算</b>的部分，灰斜纹是<b>因底层应收账款失效而不计入覆盖</b>的部分，两者之和才是账面的池内资产总额。')
    : L('The gap between the top of the area and the blue line is <b>available to borrow</b>; <b>where the orange area rises above the blue line the project is undercollateralised</b> — that test compares outstanding financing only, committed demand is not included.',
        '面积顶到蓝线之间的空隙就是<b>可融金额</b>；<b>橙色面积高过蓝线的那一段就是覆盖不足</b>——判据只比项目融资余额，不含在途。');
  var tbl = '<div class="tablewrap" style="box-shadow:none"><table class="tbl"><thead><tr><th>' + L('Date','日期') + '</th>' +
    (isPool ? '<th class="num">' + g('pledgedValue') + '</th><th class="num">' + L('Invalidated token value','失效代币价值') +
              '</th><th class="num">' + L('Total pool value','池内资产总额') + '</th>'
            : '<th class="num">' + g('cap') + '</th><th class="num">' + g('outstanding') + '</th><th class="num">' +
              g('committed') + '</th><th class="num">' + g('available') + '</th>') +
    '<th>' + L('Event','事件') + '</th></tr></thead><tbody>' + pts.map(function(x){
      return '<tr><td class="num">' + x.d + '</td>' +
        (isPool ? '<td class="num">' + amt(x.valid) + '</td><td class="num">' + amt(x.dead) + '</td><td class="num">' + amt(x.total) + '</td>'
                : '<td class="num">' + amt(x.cap) + '</td><td class="num">' + amt(x.bal) + '</td><td class="num">' + amt(x.fly) + '</td><td class="num">' + amt(x.free) + '</td>') +
        '<td style="white-space:normal">' + (x.ev ? E(dtr(x.ev.t)) : L('now (' + TODAY + ')', '当前（' + TODAY + '）')) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  return '<div class="ls-chart"><h3>' + (isPool ? L('Pool movement','池内资产变动') : L('Financing movement','融资变动')) + '</h3>' +
    '<p class="cd">' + (isPool ? L('How much is in the pool and how much of it still counts','池子里有多少钱、其中多少还顶用')
                               : L('What consumes the cap, how much is left, and when it was crossed','额度被什么消耗、还剩多少、什么时候跨过覆盖线')) +
    L('. Axis values are rounded; exact figures are in the hover readout and the data table.',
      '。刻度为压缩取整，精确值见悬浮读数与数据表。') + '</p>' +
    '<div class="lg">' + lg + '</div>' +
    '<div class="ls-cw" id="wrap-' + uid + '"><div class="ls-tip"></div></div>' +
    '<p class="rd">' + L('How to read: ','读法：') + rd + '</p>' +
    fold(L('Data table · ' + (isPool ? 'pool' : 'financing') + ' values at each point',
           '数据表 · ' + (isPool ? '池内资产' : '融资') + '逐时点数值'), pts.length + L(' rows',' 行'), tbl) + '</div>';
}
function drawAll(){
  chartQueue.forEach(function(m){
    var w = q('#wrap-' + m.uid); if(!w) return;
    var W = Math.max(520, w.clientWidth);
    var built = (m.kind === 'pool') ? chartPool(m.uid, m.pts, W) : chartFin(m.uid, m.pts, W);
    var tip = w.querySelector('.ls-tip');
    w.innerHTML = '<svg class="ls-svg" width="' + W + '" height="' + CHART_H + '" role="img" aria-label="' +
      L(m.kind === 'pool' ? 'Stepped area chart of pool movement' : 'Financing movement chart',
        m.kind === 'pool' ? '池内资产变动阶梯面积图' : '融资变动图') +
      L('; exact values are in the data table in the same card', '，精确数值见同卡片的数据表') + '">' + built.svg +
      '<g class="cross" style="display:none"><line x1="0" y1="' + CH_M.t + '" x2="0" y2="' + (CHART_H - CH_M.b) +
      '" stroke="var(--faint)" stroke-width="1" stroke-dasharray="3 3"></line></g></svg>';
    w.appendChild(tip);
    attachHover('wrap-' + m.uid, m.pts, built, m.kind);
  });
}

/* ================================================================
   P-LS-03 创建融资项目（6.5.3，V8.0）
   两步进度条与独立融资需求发布页已作废：创建成功后直达详情页，
   发布改由详情页操作区的全局操作段承载（D-FIN-61 校验一条不减）。
   ================================================================ */
function pageCreate(){
  if(S.role !== 'asset')
    return pageHead(g('createProject'), '') + '<div class="card"><div class="tbl-empty"><b>' +
      L('Not accessible','无权访问') + '</b>' +
      L('Creating a financing project is open to asset-owner entities only. Your current role is "' + actorFull(S.role) + '". Guests and funders can read L1–L5 in full on the marketplace and detail pages, but this page holds own-entity data and is filtered by entity on the server.',
        '创建融资项目只对资产方企业主体开放。当前身份为「' + actorFull(S.role) + '」。游客与资金方在广场与详情页可以看到 L1～L5 的全量信息，但本页属于本方数据，按企业主体做服务端归属过滤。') +
      '<div style="margin-top:14px"><button class="btn primary" type="button" data-act="go" data-v="P-LS-01">' +
      L('← Back to the marketplace','← 返回借贷广场') + '</button></div></div></div>';

  var picked = WALLET.filter(function(t){ return S.sel[t.id]; });
  var sum = picked.reduce(function(a,t){ return a + t.amt; }, 0);
  var nameOk = (S.pname || '').trim().length >= 1 && (S.pname || '').trim().length <= 60;
  var gas = gasEstimate(Math.max(1, picked.length));
  /* D-FIN-77：代币类型由创建时显式选择，不再是可质押清单里的隐式过滤条件。
     本期取值仅「应收账款」，其余类型是能力边界外的占位、不可选。 */
  var TYPES = [['应收账款类', g('receivable'), true], ['__other', L('Other token types','其他代币类型'), false]];
  var wl = WALLET.filter(function(t){ return S.ptype === '应收账款类'; });
  var wp = paged(wl, 'walPage');

  return pageHead(g('createProject'),
      L('Name the pool, choose the token type, and pledge at least one token. The project is persisted as soon as the pledge is submitted; you publish the demand afterwards from the project detail page.',
        '填项目名、选代币类型、至少质押一张代币。质押申请提交后项目即已持久化，融资需求随后在项目详情页的操作区发布。')) +
    (S.chain ? chainResult() : '') +
    '<div class="portal-cols"><div>' +
      '<div class="card">' + cardHead(L('Basic information','基本信息')) + '<div class="card-b">' +
        '<div class="field"><label>' + L('Project name','项目名称') + ' ' +
          faint(L('1–60 characters; does not have to be unique within your entity','1～60 字符；同一企业内不要求唯一')) + '</label>' +
        '<input class="inp" type="text" maxlength="60" placeholder="' +
          L('e.g. East China electronics receivables pool','例如：华东电子元件应收账款池') + '" value="' + E(S.pname || '') +
        '" data-f="pname" data-act="ls.name"></div>' +
        '<div class="field" style="margin-top:16px"><label>' + g('tokenType') + ' ' +
          faint(L('required · a pool can only ever hold one token type','必选 · 一个池只能装一种代币类型')) + '</label>' +
        '<div class="ls-types">' + TYPES.map(function(t){
          return '<label' + (t[2] ? ' data-on="' + (S.ptype === t[0] ? 1 : 0) + '"' : ' class="off"') + '>' +
            '<input type="radio" name="ptype" ' + (t[2] ? '' : 'disabled ') + (S.ptype === t[0] ? 'checked ' : '') +
            'data-act="ls.ptype" data-v="' + t[0] + '">' + E(t[1]) +
            (t[2] ? '' : ' <span class="faint">' + L('(outside this release)','（本期能力边界外）') + '</span>') + '</label>';
        }).join('') + '</div>' +
        '<p class="hint">' + L(
          'Choosing the type here turns what used to be an invisible filter into a visible decision (D-FIN-77): you know from the start what this pool holds, and later top-ups can only add tokens of the same type.',
          '把原来"可质押清单的隐式过滤"升格为创建时的显式选择（D-FIN-77）：建池那一刻就知道这个池装什么，后续追加质押只能追加同类型代币。') + '</p></div>' +
      '</div></div>' +

      '<div class="card" style="margin-top:16px">' + cardHead(L('Pledge tokens','代币质押'),
        faint(L('at least one token is required at creation — an empty-pool draft cannot be produced by this action',
                '创建项目时必须至少质押一笔代币，"空池草稿"不能由创建动作产生'))) +
      '<div class="card-b" style="padding-bottom:12px">' + CF.note('', L(
        '<strong class="ls-b">The tokens below have already been filtered</strong>: issued; owned by your entity; not currently pledged and not sitting in the pledge contract (tokens "released, awaiting withdrawal" must be withdrawn before they can be pledged again); underlying receivable not invalidated; and matching the token type selected above.' +
        '<p>Splitting by quantity is not supported this release: <strong class="ls-b">a token is pledged whole</strong>, selected by the piece, with no quantity input.</p>',
        '<strong class="ls-b">下列代币已按可质押条件筛选</strong>：签发状态为「已签发」；归属当前企业主体；当前未被任何有效质押占用、且不在质押合约内（含"已释放待提取"的代币，须先提取才能再质押）；底层应收账款未失效；且与上方所选代币类型一致。' +
        '<p>本期不支持按数量拆分，<strong class="ls-b">一张代币整张质押</strong>，以"张"为单位勾选，没有数量输入框。</p>')) + '</div>' +
      '<div class="tablewrap" style="border:0;box-shadow:none;border-radius:0"><table class="tbl"><thead><tr>' +
        '<th style="width:40px"><input type="checkbox" ' + (picked.length && picked.length === wl.length ? 'checked' : '') +
        ' data-act="ls.selAll" aria-label="' + L('Select all','批量勾选全部') + '"></th>' +
        '<th>' + g('tokenId') + '</th><th class="num">' + g('tokenQty') + '</th><th class="num">' + g('tokenValue') + '</th>' +
        '<th class="num">' + g('dueDate') + '</th><th>' + g('buyer') + '</th><th>' + g('tokenType') + '</th></tr></thead><tbody>' +
        (wp.rows.length ? wp.rows.map(function(t){
          return '<tr><td><input type="checkbox" ' + (S.sel[t.id] ? 'checked' : '') + ' data-act="ls.sel" data-v="' + t.id +
            '" aria-label="' + t.id + '"></td><td class="mono">' + t.id + '</td>' +
            '<td class="num">1 · <span class="faint">' + L(TOKEN_SYM[0], TOKEN_SYM[1]) + '</span></td>' +
            '<td class="num">' + amt(t.amt) + ' <span class="faint">' + CCY + '</span></td>' +
            '<td class="num">' + t.due + '</td><td>' + E(dtr(t.buyer)) + '</td><td>' + g('receivable') + '</td></tr>';
        }).join('') : '<tr><td colspan="7" class="tbl-empty"><b>' + L('No pledgeable tokens','暂无可质押代币') + '</b>' +
          L('Released tokens must be withdrawn back to your own address before they can be pledged again.',
            '已释放的代币需先提取回自己地址才能再质押。') + '</td></tr>') +
        '</tbody></table></div>' + pgBar(wp, 'walPage') +
      '<div class="card-b"><div class="ls-pick"><span>' +
        L('<span class="n">' + picked.length + '</span> selected', '已勾选 <span class="n">' + picked.length + '</span> 张') + '</span>' +
        '<span class="sp"></span><span>' + L('total <span class="n">' + amt(sum) + '</span> ' + CCY,
          '合计 <span class="n">' + amt(sum) + '</span> ' + CCY) + '</span>' +
        '<span class="faint" style="margin-left:auto;font-size:11px">' + L(
          'Front-end preview only; the server recomputes authoritatively on submit and its result prevails.',
          '前端即时预览；提交时由服务端权威重算并校验，不一致以服务端为准') + '</span></div></div>' +
      '</div></div>' +

      '<aside class="portal-rail"><div class="card">' + cardHead(L('Fees and signing','费用与签名'),
        faint(L('on-chain transfer into the pledge contract','链上转入质押合约'))) +
        '<div class="card-b">' +
          '<div class="rows" style="box-shadow:none">' +
          '<div class="row"><div class="row-main"><div class="row-k">' + L('On-chain items in this batch','本次链上操作笔数') + '</div>' +
          '<div class="row-v mono">' + L(picked.length + ' (merged into one submission)', picked.length + ' 笔（合并为一次提交）') + '</div></div></div>' +
          '<div class="row"><div class="row-main"><div class="row-k">' + L('Estimated gas','预估 gas') + '</div><div class="row-v mono">' + gas + ' ETH</div></div></div>' +
          '<div class="row"><div class="row-main"><div class="row-k">' + L('Paid by','承担方') + '</div><div class="row-v">' +
            E(actorFull('asset')) + L(' (your entity)','（本企业）') + '</div></div></div></div>' +
          '<p class="hint" style="margin-top:10px">' + L(
            'Gas is charged by the blockchain. <strong class="ls-b">The platform does not pay it for you, does not advance it, and charges no service fee on pledging, withdrawal or redemption</strong>. A failed transaction may still have cost gas. Signing and payment happen in an <b>external SDK service</b>; the platform does not build its own wallet-connect component.',
            'gas 由区块链收取，<strong class="ls-b">平台不代付、不垫付，也不对质押 / 撤回 / 提取收取任何服务费</strong>。链上失败也可能已经产生费用。签名与付费由本页<b>唤起外部 SDK 服务</b>完成，平台不自建钱包连接组件。') + '</p>' +
          '<button class="btn primary block" type="button" style="margin-top:14px" ' +
            (nameOk && picked.length ? '' : 'disabled ') + 'data-act="ls.create">' +
            L('Create project and pledge','创建项目并发起质押') + '</button>' +
          (nameOk && picked.length ? '' : '<p class="hint">' + (!nameOk
            ? L('Enter a project name first (1–60 characters).','请先填写项目名称（1～60 字符）。')
            : L('At least one token must be pledged at creation, so submission is disabled with nothing selected.',
                '未勾选任何一张代币时不可提交——创建项目时必须至少质押一笔。')) + '</p>') +
        '</div></div>' +
        '<div class="card" style="margin-top:16px">' + cardHead(L('Rules for this step','本段规则')) + '<div class="card-b"><p class="hint">' +
          L('· The creation check tests that the <b>pledge has been submitted</b> (on-chain "pending" or "confirmed" both pass); it does not wait for on-chain confirmation.<br>' +
            '· After submission the project sits in <b>Draft (pool created · not published)</b> and is entirely invisible externally: not on the marketplace, not searchable, and a deep link from anyone else returns "not found or not accessible".<br>' +
            '· <b>On success you land straight on the project detail page</b> — the two-step progress bar and the separate publish page are gone (V8.0). You can publish now or much later; <b>neither path ever asks you to pledge again or pay gas twice</b>.<br>' +
            '· The publish check is the one that tests on-chain facts: pledged token value &gt; 0 and demand amount ≤ available to borrow.',
            '· 创建校验的对象是<b>质押申请已提交</b>（链上「处理中」或「成功」均算通过），不要求等待链上确认完成。<br>' +
            '· 提交后项目落<b>草稿（已建池 · 未发布）</b>，对外完全不可见：不进广场、不可搜索、他人深链直达返回"内容不存在或无权访问"。<br>' +
            '· <b>创建成功后直接进入项目详情页</b>——两步进度条与独立发布页已作废（V8.0）。可以马上发布，也可以隔很久再发布，<b>任何一步都不会要求重新质押或重新付一次 gas</b>。<br>' +
            '· 发布校验的对象才是链上事实：有效质押价值 &gt; 0 且融资需求金额 ≤ 可融金额。') +
        '</p></div></div>' +
    '</aside></div>';
}

/* ================================================================
   P-LS-90 我的融资项目
   编号取 P-LS-90 而不是 P-LS-04：WS-325 的 PRD 已把 P-LS-04/05/06 定义为
   授信核定 / 机构报价 / 接受拒绝，不与之相撞。
   ================================================================ */
function pageMine(){
  if(S.role !== 'asset')
    return pageHead(g('myProjects'),'') + '<div class="card"><div class="tbl-empty"><b>' +
      L('Not accessible','无权访问') + '</b>' + L('This page is open to asset-owner entities only.','本页只对资产方企业主体开放。') + '</div></div>';
  var list = myProjects();
  return pageHead(g('myProjects'),
    L('Collateral pools held by ' + actorFull('asset') + '. Draft projects are visible to your entity only: not on the marketplace, not searchable, not reachable by deep link.',
      actorFull('asset') + ' 名下的资产池。草稿项目只有本企业可见，不进广场、不可搜索、不可被深链直达。'),
    '<button class="btn primary" type="button" data-act="ls.newProject">' + g('createProject') + '</button>') +
    '<div class="card" style="margin-top:16px">' + cardHead(g('project'), faint(L(list.length + ' in total', '共 ' + list.length + ' 个'))) +
    '<div class="tablewrap" style="border:0;box-shadow:none;border-radius:0"><table class="tbl"><thead><tr>' +
      '<th>' + L('Project name','项目名称') + '</th><th>' + L('Project ID','项目编号') + '</th>' +
      '<th>' + g('status') + '</th><th class="num">' + g('pledgedValue') + '</th>' +
      '<th class="num">' + g('demandAmt') + '</th><th class="num">' + g('outstanding') + '</th>' +
      '<th>' + g('coverage') + '</th><th class="num">' + g('validityTo') + '</th>' +
      '<th class="col-act" style="text-align:right">' + g('actions') + '</th>' +
    '</tr></thead><tbody>' + list.map(function(p){
      var d = derive(p);
      return '<tr><td class="cell-main">' + E(dtr(p.name)) + '</td><td class="mono">' + p.id + '</td>' +
        '<td>' + pill(TONE[FP_STATUS[p.status].tone]||'gray', fpStatus(p)) +
          (p.draft ? '<div class="cell-sub">' + (p.emptyPool
            ? L('pledge failed on chain · empty pool','首笔质押链上失败 · 空池')
            : L('pool created · demand not published yet','已建池 · 尚未发布需求')) + '</div>' : '') +
          (p.expired ? '<div class="cell-sub">' + L('expired · existing deals performing','已到期 · 存量履约中') + '</div>' : '') + '</td>' +
        '<td class="num">' + amt(d.valid) + '</td><td class="num">' + (p.demand ? amt(p.demand) : '—') + '</td>' +
        '<td class="num">' + amt(d.bal) + '</td>' +
        '<td>' + pill(gTone(d.grade), covMeta(d.grade).t) + '</td><td class="num">' + (p.expiresAt || '—') + '</td>' +
        '<td class="col-act" style="text-align:right">' +
          '<button class="btn sm' + (p.draft ? ' primary' : '') + '" type="button" data-act="ls.open" data-v="' + p.id + '">' +
          (p.draft ? L('Continue','继续') : L('Open','详情')) + '</button></td></tr>';
    }).join('') + '</tbody></table></div></div>';
}

/* ================================================================
   链上结果页面态（分册 6.7.2 五类，不允许只写"操作失败"）
   ================================================================ */
var CO_TR = {
  offchain:{ head:['Submission failed — no on-chain fee was incurred, you can retry directly','提交失败，本次未产生链上费用，可直接重试'],
             body:['Reason: the node rejected the nonce check, so the transaction was never broadcast.','原因：节点返回 nonce 校验失败，交易未广播到链上。'],
             fee:['No on-chain fee was incurred.','本次未产生任何链上费用。'], retry:['Retry','直接重试'] },
  onchain :{ head:['On-chain execution failed — the gas for this attempt has been spent and cannot be refunded','链上执行失败，本次 gas 已产生、不可退回'],
             body:['Reason: the pledge contract reverted (the token is already held by another active pledge).','原因：质押合约执行被回退（代币已被其他有效质押占用）。'],
             fee:['The gas for this attempt has been spent and cannot be refunded; a retry is a new transaction and incurs gas again.','本次 gas 已产生、不可退回；重试将发起一笔新交易并再次产生 gas。'],
             retry:['Retry (incurs new gas)','重试（将产生新的 gas）'] },
  timeout :{ head:['No on-chain result after ' + CHAIN_TIMEOUT + ' minutes — the outcome is currently unknown','等待链上结果超过 ' + CHAIN_TIMEOUT + ' 分钟，当前结果未知'],
             body:['Query the on-chain status first and retry only once you have confirmed it never landed — retrying blind can cause a duplicate transfer and a duplicate charge.','请先查询链上状态，确认未上链后再重试——直接重试可能造成重复转移与重复扣费。'],
             fee:['Whether a fee was incurred depends on whether the transaction landed; query first.','是否已产生费用取决于交易是否已上链，需先查询确认。'], retry:[null,null] },
  cancel  :{ head:['You cancelled the signature — nothing was charged','您取消了签名，本次未产生任何费用'],
             body:['You are back on this page and no record was changed.','已回到本页，未产生任何记录变更。'],
             fee:['No on-chain fee was incurred.','本次未产生任何链上费用。'], retry:['Start again','重新发起'] },
  nogas   :{ head:['Wallet balance is not enough to cover the on-chain fee','钱包余额不足以支付本次链上费用'],
             body:['Top up and retry. The transaction was never sent, so nothing was charged.','请充值后重试。本次交易未发出，未产生费用。'],
             fee:['No on-chain fee was incurred.','本次未产生任何链上费用。'], retry:['Top up and retry','充值后重试'] }
};
function co(k, f){ var m = CO_TR[k]; return m ? L(m[f][0], m[f][1]) : ''; }
function chainResult(){
  var r = S.chain, o = CHAIN_OUTCOMES[r.k], ttl = L('On-chain result','链上结果');
  if(r.k === 'ok') return CF.note('green', L(
    '<strong class="ls-b">Transfer confirmed on chain</strong> (CT-2): ' + r.n + ' token(s) are in the pool and count towards pledged token value.' +
    '<p>Actual gas ' + r.gas + ' ETH, charged once for the batch.</p>',
    '<strong class="ls-b">链上转入成功</strong>（CT-2）：' + r.n + ' 张代币已入池并计入有效质押价值。' +
    '<p>实际 gas ' + r.gas + ' ETH，同一次操作只记一次。</p>'), ttl);
  if(r.k === 'partial') return CF.note('amber', L(
    '<strong class="ls-b">Partial success · settled token by token</strong>: ' + r.ok + ' token(s) entered the pool (CT-2), ' + r.bad + ' failed on chain (CT-3) and are back to pledgeable.' +
    '<p>Reason: the pledge contract reverted. The gas for those ' + r.bad + ' has been spent and cannot be refunded; a retry is a new transaction and incurs gas again. The publish check uses the server’s recomputation after the tokens that actually landed.</p>',
    '<strong class="ls-b">部分成功 · 按张独立结算</strong>：' + r.ok + ' 张入池成功（CT-2），' + r.bad + ' 张链上执行失败（CT-3）已退回可质押。' +
    '<p>失败原因：质押合约执行被回退。失败那 ' + r.bad + ' 张的 gas 已产生、不可退回；重试将发起新交易并再次产生 gas。发布校验以实际成功入池后的服务端重算结果为准。</p>'), ttl);
  if(r.k === 'timeout') return CF.note('amber',
    '<strong class="ls-b">' + co('timeout','head') + '</strong><p>' + co('timeout','body') + '</p>' +
    '<p>' + L('Fee: ','费用：') + co('timeout','fee') + ' ' +
    L('Those ' + r.n + ' token(s) stay "pending" and accept no new action meanwhile.',
      '该 ' + r.n + ' 张代币保持「处理中」，期间不接受新动作。') + '</p>' +
    '<p style="margin-top:8px"><button class="btn sm" type="button" data-act="ls.query">' + L('Query on-chain status','查询链上状态') + '</button>' +
    '<span class="faint" style="margin-left:10px">' + L('No retry button in this state — it appears only once you have confirmed the transaction never landed.',
      '本状态下不提供重试按钮——查得未上链后，重试入口才会出现。') + '</span></p>',
    L('Waiting for the on-chain result','等待链上结果'));
  return CF.note(o.tone === 'mute' ? '' : o.tone === 'warn' ? 'amber' : 'red',
    '<strong class="ls-b">' + co(r.k,'head') + '</strong><p>' + co(r.k,'body') + '</p>' +
    '<p>' + L('Fee: ','费用：') + co(r.k,'fee') + '</p>' +
    '<p style="margin-top:8px"><button class="btn sm" type="button" data-act="ls.retry">' + co(r.k,'retry') + '</button></p>', ttl);
}

/* ================================================================
   动作层：链上调用只发生在入池 / 撤回 / 提取三处（D-FIN-67）
   v1.3：全局操作与环节操作一律走弹窗、不跳离详情页（AC-LS-85）
   ================================================================ */
function doAction(key){
  var p = findProject(S.pid);
  if(key === 'publish'){ S.modal = { type:'publish', id:p.id }; S.amt = p.demand ? String(p.demand) : ''; S.amtErr = null; return CF.render(); }
  if(key === 'pledge'){  S.modal = { type:'pledge',  id:p.id }; S.sel = {};  S.walPage = 1; return CF.render(); }
  if(key === 'release'){ S.modal = { type:'release', id:p.id }; S.wsel = {}; S.rsel = {}; return CF.render(); }
  if(key === 'close')    { S.modal = { type:'close', id:p.id }; return CF.render(); }
}
function mHead(t){
  return '<div class="modal-h"><b>' + E(t) + '</b><button class="modal-x" type="button" data-act="ls.mclose" aria-label="' +
    L('Close','关闭') + '">✕</button></div>';
}
function mWrap(t, body, foot, wide){
  return '<div class="mask" data-act="ls.mclose"><div class="modal"' + (wide ? ' style="max-width:720px"' : '') +
    ' role="dialog" aria-modal="true">' + mHead(t) + '<div class="modal-b">' + body + '</div>' +
    '<div class="modal-f">' + foot + '</div></div></div>';
}
function btnCancel(){ return '<button class="btn" type="button" data-act="ls.mclose">' + L('Cancel','取消') + '</button>'; }

/* ---- 弹窗：发布 / 修改融资需求金额（本模块自己的动作，规则在这里） ---- */
function modalPublish(){
  var p = findProject(S.modal.id), d = derive(p);
  var body =
    '<p class="lead" style="margin-top:0">' + L(
      'Publishing is the only thing that creates committed demand on this project. The amount is checked against available to borrow, recomputed by the server at this moment (AC-LS-09).',
      '发布是本项目产生在途占用的唯一来源。金额按服务端此刻重算的可融金额校验（AC-LS-09）。') + '</p>' +
    '<div class="rows" style="box-shadow:none;margin-bottom:14px">' +
      '<div class="row"><div class="row-main"><div class="row-k">' + g('available') + '</div>' +
        '<div class="row-v mono">' + usd(d.free) + '</div></div></div>' +
      '<div class="row"><div class="row-main"><div class="row-k">' + g('validityTo') + '</div>' +
        '<div class="row-v mono">' + (p.expiresAt || addYears(TODAY, TERM_YEARS)) + '</div></div></div></div>' +
    '<div class="field"><label>' + g('demandAmt') + '（' + CCY + '）</label>' +
      '<input class="inp" type="text" inputmode="decimal" placeholder="0.00" value="' + E(S.amt || '') +
      '" data-f="damt" data-act="ls.amt"' + (p.emptyPool ? ' disabled' : '') + '>' +
      '<p class="hint">' + L('Required, greater than 0 and no more than available to borrow ' + usd(d.free) + '. Precision is 2 decimal places in ' + CCY + '.',
        '必填，大于 0 且不超过可融金额 ' + usd(d.free) + '。金额精度为 ' + CCY + ' 2 位小数。') + '</p>' +
      (S.amtErr ? '<p class="err-msg"><span>!</span><span>' + S.amtErr + '</span></p>' : '') + '</div>' +
    '<p class="hint">' + L(
      'The validity date is generated by the system as first publish date + ' + TERM_YEARS + ' year. It is read-only, cannot be edited or extended, and republishing does not reset it.',
      '有效期由系统按首次发布日 + ' + TERM_YEARS + ' 年生成，只读、不可编辑、不可延期；再次发布不重置。') + '</p>';
  return mWrap(p.draft ? g('publishDemand') : L('Republish / amend demand','再次发布 / 修改需求'), body,
    btnCancel() + '<button class="btn primary" type="button" data-act="ls.publish">' +
      (p.draft ? g('publishDemand') : L('Publish','发布')) + '</button>');
}

/* ---- 弹窗：追加质押 ---- */
function modalPledge(){
  var p = findProject(S.modal.id), d = derive(p);
  var wl = WALLET.filter(function(t){ return p.assetType ? true : true; });
  var wp = paged(wl, 'walPage');
  var picked = WALLET.filter(function(t){ return S.sel[t.id]; });
  var sum = picked.reduce(function(a,t){ return a+t.amt; },0);
  var body =
    '<p class="lead" style="margin-top:0">' + L(
      'Allowed in any project status — the pool only ever grows this way, so collateral can only improve (D-FIN-48). Only tokens of this pool’s type are listed (D-FIN-77).',
      '任何项目状态下都允许，池内资产只增不减地增强覆盖（D-FIN-48）。清单只列与本池同类型的代币（D-FIN-77）。') + '</p>' +
    '<div class="tablewrap"><table class="tbl"><thead><tr><th style="width:36px"></th><th>' + g('tokenId') + '</th>' +
      '<th class="num">' + g('tokenValue') + '</th><th class="num">' + g('dueDate') + '</th><th>' + g('buyer') + '</th></tr></thead><tbody>' +
      (wp.rows.length ? wp.rows.map(function(t){
        return '<tr><td><input type="checkbox" ' + (S.sel[t.id]?'checked':'') + ' data-act="ls.sel" data-v="' + t.id + '"></td>' +
          '<td class="mono">' + t.id + '</td><td class="num">' + amt(t.amt) + '</td><td class="num">' + t.due + '</td><td>' + E(dtr(t.buyer)) + '</td></tr>';
      }).join('') : '<tr><td colspan="5" class="tbl-empty"><b>' + L('No pledgeable tokens','暂无可质押代币') + '</b>' +
        L('Released tokens must be withdrawn back to your own address before they can be pledged again.',
          '已释放的代币需先提取回自己地址才能再质押。') + '</td></tr>') +
      '</tbody></table></div>' + pgBar(wp, 'walPage') +
    '<div class="ls-pick" style="margin-top:12px"><span>' +
      L('<span class="n">' + picked.length + '</span> selected','已勾选 <span class="n">' + picked.length + '</span> 张') + '</span>' +
      '<span class="sp"></span><span>' + L('total <span class="n">' + amt(sum) + '</span> ' + CCY,
        '合计 <span class="n">' + amt(sum) + '</span> ' + CCY) + '</span>' +
      (d.gap ? '<span class="sp"></span><span>' + (sum * PLEDGE_RATE >= d.gap
        ? L('clears the shortfall','可解除覆盖不足')
        : L('shortfall would still be ' + amt(d.gap - sum*PLEDGE_RATE), '仍有缺口 ' + amt(d.gap - sum*PLEDGE_RATE))) + '</span>' : '') + '</div>';
  return mWrap(g('addPledge'), body,
    btnCancel() + '<button class="btn primary" type="button" ' + (picked.length?'':'disabled ') +
    'data-act="ls.addPledge">' + L('Confirm and sign','确认追加并发起质押') + '</button>', true);
}

/* ---- 弹窗：解除质押（D-FIN-78：撤回与提取的合并入口）----
   合并的是**入口**，不是判定：池内代币受可撤回上限约束（AC-FIN-13 视角 C），
   合约里待提取的代币是两段式释放的第二段（D-FIN-57），不做任何额度判定。
   用户不需要先知道自己的代币此刻在哪一边。 */
function modalRelease(){
  var p = findProject(S.modal.id), d = derive(p);
  var dead = p.tokens.filter(function(t){ return t.dead; }), live = p.tokens.filter(function(t){ return !t.dead; });
  var wLive = live.filter(function(t){ return S.wsel[t.id]; }).reduce(function(a,t){ return a+t.amt; },0);
  var wDead = dead.filter(function(t){ return S.wsel[t.id]; }).reduce(function(a,t){ return a+t.amt; },0);
  var rPick = REDEEMABLE.filter(function(t){ return S.rsel[t.id]; });
  var rSum  = rPick.reduce(function(a,t){ return a+t.amt; },0);
  var over  = wLive > d.wLimit;
  var n     = live.filter(function(t){ return S.wsel[t.id]; }).length +
              dead.filter(function(t){ return S.wsel[t.id]; }).length + rPick.length;
  function row(t, kind, tag){
    var on = (kind === 'pool' ? S.wsel : S.rsel)[t.id];
    return '<tr><td><input type="checkbox" ' + (on?'checked':'') + ' data-act="' + (kind==='pool'?'ls.wsel':'ls.rsel') +
      '" data-v="' + t.id + '"></td><td class="mono">' + t.id + '</td><td class="num">' + amt(t.amt) + '</td>' +
      '<td class="num">' + t.due + '</td><td>' + tag + '</td></tr>';
  }
  var H = '<thead><tr><th style="width:36px"></th><th>' + g('tokenId') + '</th><th class="num">' + g('tokenValue') +
          '</th><th class="num">' + g('dueDate') + '</th><th>' + g('tokenState') + '</th></tr></thead>';
  /* 池内那一侧没得撤时，把上限数值与两条出路摆出来——不是把入口藏起来（AC-LS-37）。
     合约里待提取的那一侧不受可撤回上限约束，单独说明。 */
  var poolEmpty   = !p.tokens.length;
  var poolNothing = (!poolEmpty && d.wLimit <= 0 && !dead.length);
  var body =
    '<p class="lead" style="margin-top:0">' + L(
      'One entry for both cases: tokens still in the pool are withdrawn (subject to the release limit), and tokens already released in business terms are withdrawn from the pledge contract back to your address. You do not need to know which side a token is on.',
      '一个入口涵盖两种情形：还在池里的代币走撤回（受可撤回上限约束），业务上已释放、链上仍在合约里的代币走提取。您不需要先分清自己的代币在哪一边。') + '</p>' +
    /* 池子已空（关闭 / 结清后质押已在同一时刻全额业务释放）——此时讲"可撤回上限"没有意义，
       该讲的是代币现在在哪、怎么拿回来（D-FIN-57 第二段）。 */
    (poolEmpty ? CF.note('', L(
      'This pool is empty: the collateral was released in business terms at the moment the project closed or settled — immediate, no on-chain action, no cost.' +
      (REDEEMABLE.length
        ? '<p>The ' + REDEEMABLE.length + ' token(s) worth ' + usd(REDEEMABLE.reduce(function(a,t){ return a + t.amt; }, 0)) +
          ' listed below are <b class="ls-b">still inside the pledge contract</b>. Withdrawing them is the second stage, initiated by you and paid for by you, with <b class="ls-b">no deadline and no expiry</b>. Until withdrawn they belong to no pool, count towards no pledged value, and cannot be pledged again.</p>'
        : '<p>There is nothing awaiting withdrawal in the contract either.</p>'),
      '本池已空：质押在项目关闭 / 结清的同一时刻已全额业务释放——即时、无链上动作、无费用。' +
      (REDEEMABLE.length
        ? '<p>下面列出的 ' + REDEEMABLE.length + ' 张（合计 ' + usd(REDEEMABLE.reduce(function(a,t){ return a + t.amt; }, 0)) +
          '）<b class="ls-b">仍在质押合约内</b>。提取是第二段，由您自行发起、自付 gas，<b class="ls-b">无时间限制、不过期</b>。未提取前不属于任何资产池、不计入任何质押价值，也不能被再次质押。</p>'
        : '<p>合约里也没有待提取的代币。</p>')),
      L('The pool is empty — what is left is the withdrawal','本池已空，剩下的是提取这一步')) : '') +
    /* 池内有代币但可撤回上限为 0：不把入口藏起来，把数值与两条出路讲清（AC-LS-37） */
    (poolNothing ? CF.note('amber', L(
      'Release headroom is <span class="mono">' + usd(0) + '</span> right now — it is <b class="ls-b">available to borrow ÷ ' + (PLEDGE_RATE*100) +
      '%</b>, and available to borrow is ' + usd(d.free) + ' because the pool is carrying outstanding financing of ' + usd(d.bal) +
      ' and committed demand of ' + usd(d.fly) + '. There are no invalidated tokens in this pool either (they would not be subject to the limit).' +
      '<p>Two ways forward: ① repayment lowers outstanding financing, which raises the release limit; ② withdrawing the open demand frees the committed part. This is a quantified test (INV-FIN-01 / AC-FIN-13 view C), not a stage lock — the entry stays open and is re-evaluated by the server on every submission.</p>' +
      (REDEEMABLE.length ? '<p>The ' + REDEEMABLE.length + ' released token(s) sitting in the pledge contract are <b class="ls-b">not subject to this limit</b> and can be withdrawn right now (D-FIN-57).</p>' : ''),
      '当前可撤回上限为 <span class="mono">' + usd(0) + '</span>——它<b class="ls-b">＝ 可融金额 ÷ ' + (PLEDGE_RATE*100) +
      '%</b>，而可融金额是 ' + usd(d.free) + '，因为池子正扛着项目融资余额 ' + usd(d.bal) + ' 与项目在途金额 ' + usd(d.fly) +
      '。池内也没有已失效代币（失效代币本来就不受这个上限约束）。' +
      '<p>两条出路：① 还款降低项目融资余额，可撤回上限随之抬高；② 撤下在途需求，释放被占用的那部分。这是量化判定（INV-FIN-01 / AC-FIN-13 视角 C），不是按环节上锁——入口照常开着，每次提交都由服务端重新判定。</p>' +
      (REDEEMABLE.length ? '<p>质押合约内那 ' + REDEEMABLE.length + ' 张已释放代币<b class="ls-b">不受本上限约束</b>，现在就可以提取（D-FIN-57）。</p>' : '')),
      L('Nothing in this pool can be withdrawn right now','本池此刻没有可撤回的代币')) : '') +
    (dead.length ? '<h3 class="sec-title" style="font-size:12.5px;margin:14px 0 6px">' +
      L('Invalidated · withdrawable at any time, no credit test · ' + dead.length,
        '已失效 · 可随时撤回、不做额度判定 · ' + dead.length + ' 张') + '</h3>' +
      '<div class="tablewrap"><table class="tbl">' + H + '<tbody>' + dead.map(function(t){
        return row(t, 'pool', pill('amber', L('Invalid · ' + (t.deadAt||''), '已失效 · ' + (t.deadAt||'')))); }).join('') +
      '</tbody></table></div>' : '') +
    '<h3 class="sec-title" style="font-size:12.5px;margin:14px 0 6px">' +
      L('Active collateral · subject to the release limit · ' + live.length, '有效抵押物 · 受额度限制 · ' + live.length + ' 张') +
      '<span class="faint" style="font-weight:400;margin-left:8px">' +
      L('release limit now <b class="mono">' + usd(d.wLimit) + '</b>', '当前最多可撤回 <b class="mono">' + usd(d.wLimit) + '</b>') + '</span></h3>' +
    '<div class="tablewrap"><table class="tbl">' + H + '<tbody>' +
      (live.length ? live.map(function(t){ return row(t, 'pool', pill('green', g('valid'))); }).join('')
        : '<tr><td colspan="5" class="tbl-empty"><b>' + L('No active collateral in this pool','池内暂无有效抵押物') + '</b></td></tr>') +
      '</tbody></table></div>' +
    (REDEEMABLE.length ? '<h3 class="sec-title" style="font-size:12.5px;margin:14px 0 6px">' +
      L('Released in business terms · awaiting on-chain withdrawal · ' + REDEEMABLE.length,
        '业务上已释放 · 等待链上提取 · ' + REDEEMABLE.length + ' 张') + '</h3>' +
      '<div class="tablewrap"><table class="tbl">' + H + '<tbody>' + REDEEMABLE.map(function(t){
        return row(t, 'redeem', pill('gray', L('PS-4 Released · awaiting withdrawal','PS-4 已释放 · 待提取'))); }).join('') +
      '</tbody></table></div>' : '') +
    '<div class="ls-pick' + (over ? ' bad' : '') + '" style="margin-top:12px"><span>' +
      L('from the pool <span class="n">' + amt(wLive) + '</span>','池内有效抵押物 <span class="n">' + amt(wLive) + '</span>') + '</span>' +
      '<span class="sp"></span><span>' + L('release limit <span class="n">' + amt(d.wLimit) + '</span>',
        '可撤回上限 <span class="n">' + amt(d.wLimit) + '</span>') + '</span>' +
      (wDead ? '<span class="sp"></span><span>' + L('invalidated <span class="n">' + amt(wDead) + '</span> (unrestricted)',
        '失效代币 <span class="n">' + amt(wDead) + '</span>（不受限制）') + '</span>' : '') +
      (rSum ? '<span class="sp"></span><span>' + L('awaiting withdrawal <span class="n">' + amt(rSum) + '</span>',
        '待提取 <span class="n">' + amt(rSum) + '</span>') + '</span>' : '') + '</div>' +
    (over ? '<p class="err-msg" style="margin-top:10px"><span>!</span><span><b>' + L(
      'The value selected from the pool exceeds the release limit, so this release will not go through.',
      '拟撤回价值超出可撤回上限，本次撤回不予放行。') + '</b><br>' + L(
      'Selected <span class="mono">' + usd(wLive) + '</span>; release limit <span class="mono">' + usd(d.wLimit) +
      '</span>; difference <span class="mono">' + usd(wLive - d.wLimit) + '</span>.<br>Two ways out: ① deselect until the value is within ' + usd(d.wLimit) +
      '; ② wait for repayment to lower outstanding financing, which raises the release limit.',
      '拟撤回价值 <span class="mono">' + usd(wLive) + '</span>；当前可撤回上限 <span class="mono">' + usd(d.wLimit) +
      '</span>；差额 <span class="mono">' + usd(wLive - d.wLimit) + '</span>。<br>两条出路：① 减少勾选，把拟撤回价值压到 ' + usd(d.wLimit) +
      ' 以内；② 等待还款降低项目融资余额，可撤回上限会随之抬高。') + '</span></p>' : '') +
    '<p class="hint" style="margin-top:12px">' + L(
      'A withdrawal <b>provisionally deducts</b> the value as soon as it enters "pending" on chain (understate rather than overstate); only a failure rolls it back. It never marks tokens "released" first and rolls back afterwards. Withdrawal and redemption are <b>never hard-blocked</b>: more than 5 submissions in 24 hours shows a note about gas cost, but does not block.',
      '撤回一进入链上「处理中」即<b>预扣</b>该部分价值（宁可低估不可高估），失败回滚才恢复；撤回不得先置「已释放」再回滚。撤回与提取<b>不设硬性阻断</b>：24 小时内提交超过 5 次会提示"频繁链上操作会产生较多 gas"，但不阻断。') + '</p>';
  return mWrap(g('releasePledge'), body,
    btnCancel() + '<button class="btn danger" type="button" ' + (n === 0 || over ? 'disabled ' : '') +
    'data-act="ls.release">' + L('Release ' + n + ' token(s)', '解除勾选的 ' + n + ' 张') + '</button>', true);
}

/* ---- 弹窗壳：下游模块承载的四个环节动作（AC-LS-85）----
   本模块**只做壳**：壳里只放已经权威公开的事实与该环节需要提交的内容清单，
   规则、校验与提交都在 WS-325 / WS-326 / WS-327 的页面里完成，本页给出口。
   这里不替下游模块发明任何业务规则。 */
var STAGE_DLG = {
  quote:{ t:['Submit a quote','提交报价'], owner:'WS-325',
    need:[['Quoted amount','报价金额'],['Annual rate','年化利率'],['Settlement currency','结算币种'],['Validity: fixed 168 hours','有效期：固定 168 小时']],
    note:['A quote locks this demand for 168 hours and no other institution can quote meanwhile. Quoting does not create new committed demand. The quote form, its credit prerequisites and all validation belong to WS-325.',
          '报价将该需求锁定 168 小时，期间其他机构不能报价；报价不新增在途占用。报价表单、授信前置与全部校验属 WS-325。'],
    href:function(p){ return cqHref('#/project/' + p.id + '?action=quote'); } },
  respond:{ t:['Accept or reject the quote','接受 / 拒绝报价'], owner:'WS-325',
    need:[['Payee account','收款账户'],['Signed financing contract','盖章融资合同'],['Rejection reason (when rejecting)','拒绝原因（拒绝时）']],
    note:['Accepting moves the deal to "awaiting disbursement" and the project to Financing. Rejecting returns the demand to the Quote stage and other institutions may quote again (D-FIN-79). The rules belong to WS-325.',
          '接受后业务转「待放款」、项目转融资中；拒绝后需求退回融资报价环节，其他机构可继续报价（D-FIN-79）。规则属 WS-325。'],
    href:function(p){ return cqHref('#/deal/' + (p.quote ? p.quote.deal : '') + '?action=respond_quote'); } },
  disburse:{ t:['Disburse','放款'], owner:'WS-326',
    need:[['Transfer receipt','转账凭证'],['Disbursement currency and amount','放款币种与金额'],['Verification of the signed contract','盖章件核验结论']],
    note:['The funder verifies the signed contract before disbursing; the platform does not vet it and has no platform-side review state. The rules belong to WS-326.',
          '资金方在放款前核验盖章件，平台不审核、不设平台侧审核态。规则属 WS-326。'],
    href:function(p){ return lnHref('#/deal/' + (p.fin ? p.fin.deal : '') + '?action=disburse'); } },
  confirm:{ t:['Confirm receipt of the disbursement','确认到账'], owner:'WS-326',
    need:[['Confirmation that the money arrived','到账确认'],['Nothing to upload','无需上传材料']],
    note:['Confirming transfers the credit atomically from committed demand to outstanding financing and finalises the repayment schedule in the same settlement. There is no "raise a dispute" entry — if the money has not arrived, do not confirm. The rules belong to WS-326.',
          '确认后额度在同一次结算内从项目在途金额原子转移到项目融资余额，并同刻定稿还款计划。平台没有「提出异议」入口——钱没到就先别确认。规则属 WS-326。'],
    href:function(p){ return lnHref('#/deal/' + (p.fin ? p.fin.deal : '') + '?action=confirm_disbursement'); } },
  repay:{ t:['Repay','立即还款'], owner:'WS-327',
    need:[['Repayment receipt','还款凭证'],['Repayment currency and amount','还款币种与金额'],['Notes (optional)','还款备注（可选）']],
    note:['Submitting a repayment record freezes the interest accrual and the overdue-day count for that instalment at that moment; the funder then confirms. The rules belong to WS-327.',
          '提交还款记录的那一刻即冻结该期计息与逾期天数累加，随后由资金方确认。规则属 WS-327。'],
    href:function(p){ return rpHref('#/deal/' + (p.rep ? p.rep.deal : '') + '?action=repay'); } }
};
function modalStage(){
  var p = findProject(S.modal.id), k = S.modal.stage, m = STAGE_DLG[k];
  if(!m) return '';
  var body =
    '<p class="lead" style="margin-top:0">' + L(
      'This step is delivered by ' + m.owner + '. WS-324 carries the stage display and this dialog; the operation itself is completed in that module so its rules stay in one place.',
      '该环节由 ' + m.owner + ' 交付。WS-324 承载环节展示与本弹窗，操作本身在那个模块里完成，规则只有一处。') + '</p>' +
    '<h3 class="sec-title" style="font-size:12.5px;margin:0 0 8px">' + L('What this step submits','该环节需要提交的内容') + '</h3>' +
    '<div class="rows" style="box-shadow:none">' + m.need.map(function(r){
      return '<div class="row"><div class="row-main"><div class="row-k">' + E(L(r[0], r[1])) + '</div>' +
        '<div class="row-v faint">' + L('collected in ' + m.owner, '在 ' + m.owner + ' 内填写') + '</div></div></div>'; }).join('') + '</div>' +
    CF.note('', E(L(m.note[0], m.note[1])), L('Why this dialog is a shell','为什么这里只是一层壳'));
  return mWrap(L(m.t[0], m.t[1]), body,
    btnCancel() + '<a class="btn primary" href="' + m.href(p) + '">' +
      L('Continue in ' + m.owner, '前往 ' + m.owner + ' 完成') + '</a>');
}

/* ---- 弹窗：关闭项目 ---- */
function modalClose(){
  var p = findProject(S.modal.id), d = derive(p);
  var c = actionOf(availableActions(p, S.role), 'close') || {};
  /* 入口常在、拦截在提交时（v1.5）：有存量融资业务时不是把按钮藏起来，
     而是在这里给出**具体原因 + 当前的量**，并让「确认关闭」不可提交。 */
  if(c.block){
    var rows = [
      [g('committed'), usd(d.fly)],
      [g('outstanding'), usd(d.bal)],
      [L('Project status','项目状态'), fpStatus(p)]
    ];
    return mWrap(g('closeProject'),
      CF.note('red', E(c.block) +
        '<p>' + L('The check runs on the server every time and uses freshly recomputed figures (6.1 / AC-FIN-12). Nothing about this project has been changed by opening this dialog.',
                  '该校验每次提交都由服务端用当场重算的数值执行（6.1 / AC-FIN-12）。打开本弹窗不会改变项目的任何状态。') + '</p>',
        L('This project cannot be closed right now','当前不能关闭本项目')) +
      '<div class="rows" style="box-shadow:none;margin-top:14px">' + rows.map(function(r){
        return '<div class="row"><div class="row-main"><div class="row-k">' + E(r[0]) + '</div>' +
          '<div class="row-v mono">' + E(String(r[1])) + '</div></div></div>'; }).join('') + '</div>' +
      '<p class="hint" style="margin-top:12px">' + L(
        'Two ways forward: ① withdraw the open demand, so committed demand returns to ' + usd(0) +
        '; ② wait for the deal to settle, so outstanding financing returns to ' + usd(0) + '. Closing becomes available the moment both are zero.',
        '两条出路：① 撤下在途需求，让项目在途金额回到 ' + usd(0) + '；② 等业务结清，让项目融资余额回到 ' + usd(0) +
        '。两个量都归零的那一刻，关闭入口即可提交。') + '</p>',
      btnCancel() + '<button class="btn primary" type="button" disabled>' + L('Confirm close','确认关闭') + '</button>');
  }
  return mWrap(g('closeProject'), CF.note('amber', L(
    'Closing moves the project to Closed. In the same instant the platform releases every commitment and collateral relationship on this pool, and the ' + p.tokens.length + ' token(s) in it become "released · awaiting withdrawal".' +
    '<p>The business-side release is <strong class="ls-b">immediate, involves no on-chain action and costs nothing</strong>. The tokens stay inside the pledge contract: you withdraw them yourself and pay the gas, and they <strong class="ls-b">never return to your wallet automatically</strong>. The "Release collateral" entry stays available after closing, with no deadline (D-FIN-57).</p>',
    '关闭后项目转「已关闭」，平台在同一时刻解除该池全部占用与覆盖关系，池内 ' + p.tokens.length + ' 张代币置「已释放 · 待提取」。' +
    '<p>业务释放<strong class="ls-b">即时、无链上动作、无费用</strong>；代币仍停留在质押合约内，需您自行发起提取并自付 gas，<strong class="ls-b">不会自动回到钱包</strong>。关闭之后「解除质押」入口照常可用，<strong class="ls-b">无时间限制</strong>（D-FIN-57）。</p>')),
    btnCancel() + '<button class="btn primary" type="button" data-act="ls.closeOk">' + L('Confirm close','确认关闭') + '</button>');
}

/* ---- 弹窗：链上费用二次确认 + 外部签名 SDK（AC-LS-32 / D-FIN-71） ---- */
function modalChain(){
  var m = S.modal;
  return mWrap(m.title,
    '<p class="lead" style="margin-top:0">' + L(
      'Before the external signing SDK is invoked, confirm what this on-chain operation does and what it costs.',
      '唤起外部签名 SDK 前，请先确认本次链上操作的内容与费用。') + '</p>' +
    '<div class="rows" style="box-shadow:none">' +
    m.rows.concat([[L('On-chain items in this batch','本次链上操作笔数'), m.n],
                   [L('Estimated gas','预估 gas'), m.gas + ' ETH'],
                   [L('Paid by','承担方'), actorFull('asset') + L(' (your entity)','（本企业）')]]).map(function(r){
      return '<div class="row"><div class="row-main"><div class="row-k">' + E(r[0]) + '</div>' +
        '<div class="row-v">' + E(String(r[1])) + '</div></div></div>'; }).join('') + '</div>' +
    '<p class="hint">' + L(
      'Gas is charged by the blockchain. <strong class="ls-b">The platform does not pay it for you, does not advance it, and charges no service fee on pledging, withdrawal or redemption</strong>. A failed transaction may still have cost gas. Batching is the single most effective way to reduce cost: these ' + m.n + ' items have been merged into one submission.',
      'gas 由区块链收取，<strong class="ls-b">平台不代付、不垫付，也不对质押 / 撤回 / 提取收取任何服务费</strong>。链上失败也可能已经产生费用。批量一次提交是最有效的降费手段：' + m.n + ' 笔已合并为一次提交。') + '</p>',
    btnCancel() + '<button class="btn primary" type="button" data-act="ls.sdk">' + L('Confirm and sign','确认并唤起签名') + '</button>');
}
function modalSdk(){
  var m = S.modal;
  return '<div class="mask"><div class="ls-sdk" role="dialog" aria-modal="true" aria-label="' +
    L('External signing SDK','外部签名 SDK') + '">' +
    '<div class="h"><span>◈</span><b>' + L('External signing SDK','外部签名 SDK 服务') + '</b><span>' +
      L('third-party surface · not a platform page','第三方界面 · 非平台页面') + '</span></div>' +
    '<div class="b">' + m.rows.map(function(r){
      return '<div class="kk"><s>' + E(r[0]) + '</s><b>' + E(String(r[1])) + '</b></div>'; }).join('') +
      '<div class="kk"><s>' + L('Estimated gas','预估 gas') + '</s><b>' + m.gas + ' ETH</b></div>' +
      '<div class="kk"><s>' + L('Paid by','承担方') + '</s><b>' + E(actorFull('asset')) + '</b></div></div>' +
    '<div class="sim">' + L('Prototype outcome simulator: pick what the chain returns, to walk the five failure and waiting states in appendix 6.7.2',
      '原型内的结果模拟：选择本次链上返回，用于走通分册 6.7.2 的五类失败与等待页面态') +
    '<select data-f="sdkOut" id="sdkOut">' +
      '<option value="ok">' + L('All confirmed (CT-2)','全部成功（CT-2）') + '</option>' +
      '<option value="partial">' + L('Partial success · settled token by token (E-2)','部分成功 · 按张独立结算（E-2）') + '</option>' +
      '<option value="offchain">' + L('Off-chain failure · no fee','未上链失败 · 未扣费') + '</option>' +
      '<option value="onchain">' + L('On-chain failure · fee charged','已上链失败 · 已扣费') + '</option>' +
      '<option value="timeout">' + L('Timed out (&gt; ' + CHAIN_TIMEOUT + ' min)','超时未决（&gt; ' + CHAIN_TIMEOUT + ' 分钟）') + '</option>' +
      '<option value="nogas">' + L('Insufficient gas','gas 不足') + '</option>' +
    '</select></div>' +
    '<div class="f"><button class="btn" type="button" data-act="ls.sdkCancel">' + L('Cancel','取消') + '</button>' +
    '<button class="btn primary" type="button" data-act="ls.sdkSign">' + L('Sign and pay','签名并支付') + '</button></div></div></div>';
}

function finishChain(kind, outcome){
  var p = findProject(S.pid);
  if(kind === 'create'){
    var sel = WALLET.filter(function(t){ return S.sel[t.id]; });
    if(outcome === 'cancel' || outcome === 'nogas'){ S.chain = { k:outcome }; return; }
    var okT = [], bad = 0, ct = 'CT-2';
    if(outcome === 'ok') okT = sel.slice();
    else if(outcome === 'partial'){ var c = Math.max(1, Math.ceil(sel.length/2)); okT = sel.slice(0,c); bad = sel.length-c; }
    else if(outcome === 'timeout'){ okT = sel.slice(); ct = 'CT-1'; }
    else { okT = []; bad = sel.length; }
    okT.forEach(function(t){ t.ct = ct; t.ps = 'PS-2'; });
    var tot = okT.reduce(function(a,t){ return a+t.amt; },0);
    var id = 'FP-' + TODAY.replace(/-/g,'') + '-' + String(PROJECTS.length + 55).padStart(4,'0');
    var np = { id:id, name:(S.pname||'').trim(), owner:ACTORS.asset.full, entity:ACTORS.asset.entity,
      status:'S-FP-1', expired:false, draft:true, emptyPool:(okT.length === 0 || ct === 'CT-1'),
      publishedAt:null, expiresAt:null, demand:null, quotes:0, assetType:(S.ptype || '应收账款类'), tokens:okT,
      events:[{ d:TODAY, k:(okT.length?'pledge':'fail'),
        t:'创建资产池 · 质押 ' + sel.length + ' 张' + (bad ? '（' + bad + ' 张链上失败）' : ''),
        dTotal:(ct === 'CT-2' ? tot : 0),
        note:(ct === 'CT-1' ? '链上结果未返回，处理中不预先计入有效质押价值（D-FIN-54 ①）'
             : okT.length ? '链上转入成功（CT-2），计入有效质押价值'
                          : '首笔质押链上失败，项目保留为空池草稿（E-12 / D-FIN-62）') }],
      terms:null, deals:[] };
    PROJECTS.push(np);
    var ids = okT.map(function(t){ return t.id; });
    for(var i=WALLET.length-1;i>=0;i--) if(ids.indexOf(WALLET[i].id) >= 0) WALLET.splice(i,1);
    S.chain = { k:outcome, n:okT.length, ok:okT.length, bad:bad, gas:gasEstimate(sel.length) };
    S.sel = {};
    /* V8.0 第 8 条：创建成功后直达详情页，不再有第二段独立页面 */
    S.pid = id; S.chainKeep = true; CF.go('P-LS-02');
    return;
  }
  if(kind === 'pledge'){
    var ps = WALLET.filter(function(t){ return S.sel[t.id]; });
    if(outcome === 'cancel' || outcome === 'nogas'){ S.chain = { k:outcome }; return; }
    if(outcome === 'ok' || outcome === 'partial'){
      var take = outcome === 'ok' ? ps : ps.slice(0, Math.max(1, Math.ceil(ps.length/2)));
      take.forEach(function(t){ t.ct = 'CT-2'; t.ps = 'PS-2'; });
      p.tokens = p.tokens.concat(take); p.emptyPool = false;
      var s2 = take.reduce(function(a,t){ return a+t.amt; },0);
      p.events.push({ d:TODAY, k:'topup', t:'追加质押 ' + take.length + ' 张 · ' + usd(s2), dTotal:s2,
        note:'池内资产只增不减地增强覆盖（D-FIN-48）' });
      var ids2 = take.map(function(t){ return t.id; });
      for(var j=WALLET.length-1;j>=0;j--) if(ids2.indexOf(WALLET[j].id) >= 0) WALLET.splice(j,1);
      S.chain = { k:outcome, n:take.length, ok:take.length, bad:ps.length-take.length, gas:gasEstimate(ps.length) };
    } else S.chain = { k:outcome, n:ps.length, gas:gasEstimate(ps.length) };
    S.sel = {};
    return;
  }
  /* D-FIN-78：合并入口，一次提交可能同时含「池内撤回」与「合约内提取」两类代币。
     两类的判定各走各的，链上是一笔合并交易。 */
  if(kind === 'release'){
    var inPool = p.tokens.filter(function(t){ return S.wsel[t.id]; });
    var toRedeem = REDEEMABLE.filter(function(t){ return S.rsel[t.id]; });
    var total = inPool.length + toRedeem.length;
    if(outcome === 'cancel' || outcome === 'nogas'){ S.chain = { k:outcome }; return; }
    if(outcome === 'ok'){
      if(inPool.length){
        var deadN = inPool.filter(function(t){ return t.dead; });
        var ids3 = inPool.map(function(t){ return t.id; });
        p.tokens = p.tokens.filter(function(t){ return ids3.indexOf(t.id) < 0; });
        p.events.push({ d:TODAY, k:'withdraw',
          t:'撤回质押 ' + inPool.length + ' 张 · ' + usd(inPool.reduce(function(a,t){ return a+t.amt; },0)),
          dTotal:-inPool.reduce(function(a,t){ return a+t.amt; },0),
          dVoid:-deadN.reduce(function(a,t){ return a+t.amt; },0),
          note:(deadN.length ? '其中 ' + deadN.length + ' 张为已失效代币，不做额度判定直接放行（D-FIN-59）；' : '') +
               '链上转出成功后代币移出池、派生量重算、回到可质押' });
        inPool.filter(function(t){ return !t.dead; }).forEach(function(t){ t.ct='CT-0'; t.ps='PS-1'; WALLET.push(t); });
      }
      if(toRedeem.length){
        var rid = toRedeem.map(function(t){ return t.id; });
        for(var r=REDEEMABLE.length-1;r>=0;r--) if(rid.indexOf(REDEEMABLE[r].id) >= 0) REDEEMABLE.splice(r,1);
        toRedeem.forEach(function(t){ t.ct='CT-0'; t.ps='PS-1'; t.pending=false; WALLET.push(t); });
      }
      S.chain = { k:'ok', n:total, gas:gasEstimate(total) };
    } else S.chain = { k:outcome, n:total, gas:gasEstimate(total) };
    S.wsel = {}; S.rsel = {};
    return;
  }
}

/* ================================================================
   模块装配
   ================================================================ */
var mod = {
  end:'asset', home:'P-LS-01',
  dict:{ en:{ navPlaza:'Marketplace', navMyProjects:'My projects' },
         zh:{ navPlaza:'借贷广场', navMyProjects:'我的融资项目' } },
  owns:['P-LS-01','P-LS-02','P-LS-03','P-LS-90'],
  topbarPrd:false,
  states:{
    'P-LS-01':[['default','Default','默认'],['loading','Loading','加载中'],['empty','Empty','空数据'],
               ['noresult','No match','筛选无结果'],['error','Load failed','加载失败']],
    'P-LS-02':[['default','Default','默认'],['loading','Loading','加载中'],
               ['error','Load failed','加载失败'],['gone','Not found','不存在或无权访问']],
    'P-LS-03':[['default','Default','默认']],
    'P-LS-90':[['default','Default','默认']]
  },
  /* D-LS-15：面客端默认英文；中英切换沿用 WS-308『01-国际化基线』，本模块不另定义机制 */
  state:function(){
    return { lang:'en', role:'guest', pid:'FP-20260416-0007', panel:null,
             flt:JSON.parse(JSON.stringify(F0)), sel:{}, wsel:{}, rsel:{},
             pname:'', ptype:'应收账款类', amt:'', amtErr:null, chain:null, chainKeep:false,
             tokPage:1, demPage:1, walPage:1, repayNo:null };
  },
  onBoot:function(st){ S = st; S.flt.sort = 'pub'; },
  /* 身份切换走顶栏上下文操作区（portal 规范 §3「语言/上下文操作分区」） */
  topExtra:function(){
    return '<div class="seg" role="group" aria-label="' + L('Demo role','演示身份') + '">' +
      ['guest','asset','fund'].map(function(k){
        return '<button type="button" data-act="ls.role" data-v="' + k + '" aria-pressed="' + (S.role===k) + '">' +
          E(actorT(k)) + '</button>'; }).join('') + '</div>';
  },
  content:function(){
    if(S.page === 'P-LS-02') return pageProject();
    if(S.page === 'P-LS-03') return pageCreate();
    if(S.page === 'P-LS-90') return pageMine();
    return pagePlaza();
  },
  modals:{
    publish:modalPublish, pledge:modalPledge, release:modalRelease,
    close:modalClose, stage:modalStage, chain:modalChain, sdk:modalSdk
  },
  hash:{
    build:function(){
      if(S.page === 'P-LS-02') return '#/project/' + (S.pid || '');
      if(S.page === 'P-LS-03') return '#/project/new';
      if(S.page === 'P-LS-90') return '#/my-projects';
      return '#/marketplace';
    },
    read:function(){
      var h = (location.hash || '').replace(/^#\/?/, ''); if(!h) return false;
      var parts = h.split('?'), seg = parts[0].split('/'), qs = {};
      (parts[1] || '').split('&').forEach(function(kv){ var i = kv.indexOf('='); if(i>0) qs[kv.slice(0,i)] = decodeURIComponent(kv.slice(i+1)); });
      S.tokPage = S.demPage = S.walPage = 1; S.modal = null;
      if(seg[0] === 'marketplace' || seg[0] === 'plaza'){ S.page = 'P-LS-01'; S.st = 'default'; return true; }
      if(seg[0] === 'my-projects'){ S.page = 'P-LS-90'; S.st = 'default'; return true; }
      if(seg[0] === 'project'){
        if(seg[1] === 'new'){ S.page = 'P-LS-03'; S.st = 'default'; return true; }
        var p = findProject(seg[1]);
        /* 状态已变或不存在：落详情页 + 说明，不报 404、不白屏、不静默跳首页（H-02） */
        if(!p){ S.page = 'P-LS-02'; S.pid = seg[1]; S.st = 'gone'; return true; }
        S.page = 'P-LS-02'; S.pid = seg[1]; S.st = 'default';
        /* 动作锚点深链：直接把对应弹窗打开在详情页上（AC-LS-85，不跳离本页） */
        if(qs.action === 'publish' || qs.action === 'pledge') doAction(qs.action);
        else if(qs.action === 'withdraw' || qs.action === 'redeem') doAction('release');
        return true;
      }
      return false;
    }
  },
  onGo:function(){ if(S.chainKeep) S.chainKeep = false; else S.chain = null;
                   S.amtErr = null; S.modal = null; S.tokPage = S.demPage = S.walPage = 1; },
  afterRender:function(){ drawAll(); },
  onAct:function(n, a, v, e){
    if(a.indexOf('ls.') !== 0) return false;
    var p = findProject(S.pid);
    switch(a){
      case 'ls.role': S.role = v;
        if((S.page === 'P-LS-03' || S.page === 'P-LS-90') && v !== 'asset') CF.go('P-LS-01'); else CF.render();
        return true;
      /* 下拉与输入框由本文件末尾的 input/change 委托驱动；
         点击事件只认领、不处理——在原生下拉展开的瞬间重渲会把它关掉 */
      case 'ls.flt':  if(e && e.type === 'click') return true; S.flt[v] = n.value; CF.render(); return true;
      case 'ls.reset': S.flt = JSON.parse(JSON.stringify(F0)); CF.setState('default'); return true;
      case 'ls.open': S.pid = v; CF.go('P-LS-02'); return true;
      /* 跨文件链接：认领这次点击，好让它不再冒泡成整行的"进详情"（链接自己照常跳） */
      case 'ls.cross': return true;
      case 'ls.newProject': S.sel = {}; S.pname = ''; S.walPage = 1; CF.go('P-LS-03'); return true;
      case 'ls.pg': { var pr = v.split(':'); S[pr[0]] = +pr[1]; CF.render(); return true; }
      case 'ls.whyq': toast('info', L('Not quotable right now','暂不可报价'),
        actionOf(availableActions(findProject(v), S.role),'quote').reason); return true;
      case 'ls.why':  toast('info', L('This action is not available right now','该操作当前不可用'),
        (actionOf(availableActions(p, S.role), v) || {}).reason || ''); return true;
      case 'ls.stageWhy': toast('info', L('Not your step','该环节不由当前身份操作'),
        L('Switch the demo role in the top bar to act on this step.','用顶栏右上角的身份切换换一个身份即可在此环节操作。')); return true;
      case 'ls.signin': toast('info', g('signIn'),
        L('Sign-in is out of scope for this module; this prototype uses the role switch in the top bar instead.',
          '登录流程不在本模块范围内（本原型用顶栏右上角的身份切换演示）。')); return true;
      case 'ls.do': doAction(v); return true;
      case 'ls.stage': S.modal = { type:'stage', id:S.pid, stage:v }; CF.render(); return true;
      case 'ls.repaySel': if(e && e.type === 'click') return true; S.repayNo = n.value; CF.render(); return true;
      case 'ls.name': if(e && e.type === 'click') return true; S.pname = n.value; CF.render(); return true;
      case 'ls.ptype': S.ptype = v; S.sel = {}; S.walPage = 1; CF.render(); return true;
      case 'ls.amt':  if(e && e.type === 'click') return true; S.amt = n.value; S.amtErr = null; CF.render(); return true;
      case 'ls.sel':  S.sel[v] = !S.sel[v]; CF.render(); return true;
      case 'ls.selAll': WALLET.forEach(function(t){ S.sel[t.id] = n.checked; }); CF.render(); return true;
      case 'ls.wsel': S.wsel[v] = !S.wsel[v]; CF.render(); return true;
      case 'ls.rsel': S.rsel[v] = !S.rsel[v]; CF.render(); return true;
      case 'ls.query': toast('info', L('Query on-chain status','查询链上状态'),
        L('The retry entry appears only after you have confirmed the transaction never landed — carried over from the WS-318 S-TI-5 red line: a timed-out state must not retry directly.',
          '确认未上链后，重试入口才会出现——沿用 WS-318 S-TI-5 红线，超时态不得直接重试。')); return true;
      case 'ls.retry': S.chain = null; CF.render(); return true;
      case 'ls.mclose': if(n.classList.contains('mask') || n.classList.contains('modal-x') || n.tagName === 'BUTTON'){ S.modal = null; CF.render(); } return true;
      case 'ls.closeOk': S.modal = null; toast('info', L('Demo prototype','演示原型'),
        L('This prototype does not actually mutate the demo data here.','此处不真正改动演示数据。')); return true;
      case 'ls.create': {
        var sel = WALLET.filter(function(t){ return S.sel[t.id]; });
        if(!sel.length || !(S.pname||'').trim()) return true;
        S.modal = { type:'chain', kind:'create', title:L('Create the project and pledge','创建融资项目并发起首笔质押'),
          rows:[[L('What happens','操作内容'), L('Transfer ' + sel.length + ' token(s) into the pledge contract',
                                                '将 ' + sel.length + ' 张代币转入质押合约')],
                [L('Project name','项目名称'), (S.pname||'').trim()],
                [g('tokenType'), g('receivable')],
                [L('Total pledged value','质押价值合计'), usd(sel.reduce(function(a,t){ return a+t.amt; },0))]],
          n:sel.length, gas:gasEstimate(sel.length) };
        CF.render(); return true;
      }
      case 'ls.addPledge': {
        var ps = WALLET.filter(function(t){ return S.sel[t.id]; });
        if(!ps.length) return true;
        var s2 = ps.reduce(function(a,t){ return a+t.amt; },0);
        S.modal = { type:'chain', kind:'pledge', title:g('addPledge'),
          rows:[[L('What happens','操作内容'), L('Transfer ' + ps.length + ' token(s) into the pledge contract',
                                                '将 ' + ps.length + ' 张代币转入质押合约')],
                [L('Target pool','目标资产池'), dtr(p.name) + ' · ' + p.id],
                [L('Added value','追加价值合计'), usd(s2)],
                [L('Borrowing cap increases by','融资上限将增加'), usd(round2(s2 * PLEDGE_RATE))]],
          n:ps.length, gas:gasEstimate(ps.length) };
        CF.render(); return true;
      }
      case 'ls.release': {
        var inPool = p.tokens.filter(function(t){ return S.wsel[t.id]; });
        var toRed  = REDEEMABLE.filter(function(t){ return S.rsel[t.id]; });
        var total  = inPool.length + toRed.length;
        if(!total) return true;
        var liveSel = inPool.filter(function(t){ return !t.dead; });
        var liveSum = liveSel.reduce(function(a,t){ return a+t.amt; },0);
        if(liveSum > derive(p).wLimit){ CF.render(); return true; }
        var deadSel = inPool.filter(function(t){ return t.dead; });
        S.modal = { type:'chain', kind:'release', title:g('releasePledge'),
          rows:[[L('What happens','操作内容'), L('Transfer ' + total + ' token(s) from the pledge contract back to the original holding address',
                                                '将 ' + total + ' 张代币从质押合约转回原持有地址')],
                [L('Active collateral from the pool','池内有效抵押物'), liveSel.length + ' · ' + usd(liveSum)],
                [L('Invalidated tokens (no credit test)','池内已失效代币（不做额度判定）'),
                 deadSel.length + ' · ' + usd(deadSel.reduce(function(a,t){ return a+t.amt; },0))],
                [L('Already released, awaiting withdrawal','已释放 · 待提取'),
                 toRed.length + ' · ' + usd(toRed.reduce(function(a,t){ return a+t.amt; },0))],
                [L('Destination','目的地址'), L('the holding address the tokens came from (cannot be specified manually)',
                                               '质押前的原持有地址（不接受人工指定）')]],
          n:total, gas:gasEstimate(total) };
        CF.render(); return true;
      }
      case 'ls.publish': {
        var d2 = derive(p), val = parseFloat(String(S.amt).replace(/,/g,''));
        if(!(val > 0)){
          S.amtErr = L('Enter a valid demand amount: greater than ' + usd(0) + ', with 2 decimal places in ' + CCY + '.',
                       '请填写有效的融资需求金额：必须大于 ' + usd(0) + '，精度为 ' + CCY + ' 2 位小数。');
          CF.render(); return true;
        }
        val = round2(val);
        if(val > d2.free){
          var diff = round2(val - d2.free);
          S.amtErr = L(
            '<b>The demand amount exceeds available to borrow, so the publish check fails.</b><br>Entered <span class="mono">' + usd(val) +
            '</span>; available to borrow <span class="mono">' + usd(d2.free) + '</span>; difference <span class="mono">' + usd(diff) + '</span>.<br>' +
            'Two ways out: ① lower the amount to within ' + usd(d2.free) + '; ② add collateral to raise the borrowing cap — the collateral value to add is <span class="mono">' +
            usd(round2(diff / PLEDGE_RATE)) + '</span> (= difference ÷ ' + (PLEDGE_RATE*100) + '%).<br>' +
            'A failed publish check never rolls back pledges you already made; those tokens stay in the pool and keep counting.',
            '<b>融资需求金额超出可融金额，发布校验不通过。</b><br>本次填写 <span class="mono">' + usd(val) +
            '</span>；当前可融金额 <span class="mono">' + usd(d2.free) + '</span>；差额 <span class="mono">' + usd(diff) + '</span>。<br>' +
            '两条出路：① 把需求金额下调到 ' + usd(d2.free) + ' 以内；② 追加质押抬高融资上限——需追加资产价值 <span class="mono">' +
            usd(round2(diff / PLEDGE_RATE)) + '</span>（＝差额 ÷ ' + (PLEDGE_RATE*100) + '%）。<br>' +
            '已完成的质押不会因为本次发布校验失败而回滚，代币照常在池、照常计入价值。');
          CF.render(); return true;
        }
        var first = !p.publishedAt;
        p.demand = val; p.status = 'S-FP-2'; p.draft = false;
        if(first){ p.publishedAt = TODAY; p.expiresAt = addYears(TODAY, TERM_YEARS); }
        p.events.push({ d:TODAY, k:'publish', t:(first?'发布':'再次发布') + '融资需求 ' + usd(val), dFly:val,
          note:'发布即产生在途占用，这是项目在途金额的唯一来源；报价环节不再新增占用（AC-FIN-23）' });
        S.amt = ''; S.amtErr = null; S.modal = null;
        toast('success', L('Published','发布成功'),
          L('The project is now Open for quotes and ' + usd(val) + ' has been added to committed demand' +
            (first ? ', valid until ' + p.expiresAt + ' (first publish date + 1 year, read-only).' : ' (the validity date is not reset).'),
            '项目转「募集中」，需求金额 ' + usd(val) + ' 已计入项目在途金额' +
            (first ? '，有效期至 ' + p.expiresAt + '（首次发布日 + 1 年，只读）。' : '（有效期不重置）。')));
        CF.render(); return true;
      }
      case 'ls.sdk': { S.modal = { type:'sdk', kind:S.modal.kind, rows:S.modal.rows, n:S.modal.n, gas:S.modal.gas }; CF.render(); return true; }
      case 'ls.sdkCancel': { var k1 = S.modal.kind; S.modal = null; finishChain(k1, 'cancel'); CF.render(); return true; }
      case 'ls.sdkSign': {
        var out = (q('#sdkOut') || {}).value || 'ok', k2 = S.modal.kind;
        S.modal = null; finishChain(k2, out);
        if(k2 !== 'create'){ CF.render(); window.scrollTo(0,0); }
        return true;
      }
    }
    return false;
  }
};
/* ---- 表单控件的事件委托 ----
   公共 shell.js 的 data-act 委托只挂在 click 上（见 _shared/shell.js wire()），
   下拉与输入框的取值必须自己补 input / change，否则点下拉读到的是改之前的旧值。
   WS-325 / 326 / 327 三个模块各自补了同样一段，这里保持同样的写法。
   勾选框与单选框不走这里：它们的 click 已由公共层送进 onAct，再接一次 change 会来回翻两次。 */
function fieldNode(e){
  var n = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
  if(!n) return null;
  var a = n.getAttribute('data-act') || '';
  if(a.indexOf('ls.') !== 0) return null;
  var t = n.tagName, ty = (n.type || '').toLowerCase();
  if(t === 'SELECT') return n;
  if(t === 'INPUT' && ty !== 'checkbox' && ty !== 'radio') return n;
  return null;
}
function fieldDispatch(e){
  var n = fieldNode(e); if(!n) return;
  mod.onAct(n, n.getAttribute('data-act'), n.getAttribute('data-v'), e);
}
/* 只挂 input：下拉与文本框都会派发它。再挂一个 change 的话，
   按钮点击引起的 blur 会在同一拍里触发第二次重渲，把正在处理的节点换掉。 */
document.addEventListener('input', fieldDispatch);

CF.define(mod);
CF.boot();

})();
