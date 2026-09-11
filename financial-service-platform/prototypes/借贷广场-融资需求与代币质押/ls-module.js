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
/* 担保状态档位（主册 5.3.1）；PS-3 已作废，编号保留占位不复用 */
var GRADES = [
  { k:'normal',  t:'正常',            x:'INV-FIN-01 成立且可融金额 > 0', tone:'good' },
  { k:'used-up', t:'额度用尽',        x:'已借部分担保足额，但不能再借；不预警', tone:'warn' },
  { k:'short',   t:'担保不足预警',    x:'融资上限 < 项目融资余额', tone:'crit' }
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
        note:'失效部分不计入有效质押价值；融资上限降至 480,000.00 USD，低于项目融资余额 500,000.00 USD，触发担保不足预警（E-9 / 6.4.1）' },
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
        note:'融资上限 500,000.00 = 项目融资余额 500,000.00，可融金额归零，进入「额度用尽」档；INV-FIN-01 仍成立，不预警（D-FIN-55）' },
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
   六个派生量、担保档位、可撤回上限只在这里算一次，
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
  if(mins <= 0) return '0 分钟';
  if(mins < 1440){
    var h = Math.floor(mins/60);
    return (h ? h + ' 小时 ' : '') + (mins % 60) + ' 分钟';
  }
  return Math.floor(mins/1440) + ' 天 ' + Math.floor((mins % 1440)/60) + ' 小时';
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
  if(d < 0)  return { tone:'mute', t:'已到期', x:'到期日 ' + p.expiresAt };
  if(d <= EXPIRY_NEAR[1]) return { tone:'warn', t:'有效期剩余 ' + d + ' 天', x:'到期前 7 天标记' };
  if(d <= EXPIRY_NEAR[0]) return { tone:'warn', t:'有效期剩余 ' + d + ' 天', x:'到期前 30 天标记' };
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
    short:cap < bal          /* 担保不足：融资上限 < 项目融资余额（档③） */
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
    gap:      cur.short ? round2(cur.bal - cur.cap) : 0,             /* 担保缺口 FP-21 */
    need:     cur.short ? round2((cur.bal - cur.cap) / PLEDGE_RATE) : 0, /* 需追加资产价值 = 缺口 ÷ 80% */
    shortFrom:shortFrom(pts),
    /* 可撤回上限 FP-16 = 可融金额 ÷ 质押率（AC-FIN-22，AC-FIN-13 的代数变形） */
    wLimit:round2(cur.free / PLEDGE_RATE),
    deadCount:p.tokens.filter(function(t){ return t.dead; }).length,
    liveCount:p.tokens.filter(function(t){ return !t.dead; }).length
  };
}
/* 担保不足起始日：最后一段连续 short 区间的起点 */
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

  /* --- 报价：资金方动作，广场唯一对外入口 --- */
  var q = { key:'quote', label:'立即报价', anchor:'quote', primary:true, enabled:false, reason:'' };
  if(guest){
    q.reason = '未登录。登录并以资金方企业主体进入后可发起报价；页面信息 L1～L5 不因未登录而隐藏。';
    q.brief = '需登录';
  } else if(role === 'asset'){
    q.reason = own ? '不能为自己的项目报价。' : '当前企业主体未开通资金方资质，无法发起报价。';
    q.brief = own ? '本方项目' : '无资金方资质';
  } else if(p.draft){
    q.reason = '草稿项目不进广场。'; q.brief = '草稿';
  } else if(d.grade === 'short'){
    q.reason = '该项目处于担保不足预警，已暂停接受新报价（AC-LS-39）。当前担保缺口 ' + usd(d.gap) + '。';
    q.brief = '担保不足';
  } else if(p.expired){
    q.reason = '该项目有效期已到期，停止接受新报价；存量融资业务照常履约（D-FIN-43 分支②）。';
    q.brief = '已到期';
  } else if(st === 'S-FP-3'){
    q.reason = '该项目已有在途报价，同一时刻至多承载一笔在途融资业务（D-FIN-33）。';
    q.brief = '已有报价';
  } else if(!p.demand){
    q.reason = '该项目当前无在途融资需求。'; q.brief = '无在途需求';
  } else if(d.free === 0){
    q.reason = '该项目可融金额为 ' + usd(0) + '，不能再新增占用（AC-FIN-12）。';
    q.brief = '额度用尽';
  } else if(st !== 'S-FP-2'){
    q.reason = '当前项目状态为「' + FP_STATUS[st].t + '」，只有「募集中」接受新报价。';
    q.brief = FP_STATUS[st].t;
  } else {
    q.enabled = true;
    /* 报价与它的授信前置由 WS-325 承载，锚点沿用 H-02 既有体系，不新开一套跳转约定 */
    q.href = cqHref('#/project/' + p.id + '?action=quote');
  }
  out.push(q);

  /* --- 以下为资产方对自有项目的动作；非本方登录用户不可见（服务端归属过滤 AC-LS-06） --- */
  var mine = own || guest;   /* 游客：可见不可点 + 引导登录（D-LS-04 L6） */
  if(mine && live){
    var pub = { key:'publish', anchor:'publish', enabled:false, reason:'',
                label: st==='S-FP-1' ? '填写金额并发布' : '再次发布 / 管理需求' };
    if(guest)                 pub.reason = '未登录。项目动作仅对该项目所属企业主体开放。';
    else if(p.emptyPool)      pub.reason = '本项目暂无有效质押，请重新质押后再发布（D-FIN-62）。';
    else if(d.valid <= 0)     pub.reason = '有效质押价值为 ' + usd(0) + '，不满足发布校验（D-FIN-61）。';
    else if(p.expired)        pub.reason = '项目已到期，不允许再次发布（D-FIN-43 分支②）。';
    else if(d.free <= 0)      pub.reason = '可融金额为 ' + usd(0) + '，无可发布额度（AC-FIN-12）。';
    else pub.enabled = true;
    out.push(pub);

    out.push({ key:'pledge', anchor:'pledge', label:'追加质押', enabled:!guest, primary:(d.grade==='short'),
               reason: guest ? '未登录。项目动作仅对该项目所属企业主体开放。' : '' });

    var w = { key:'withdraw', anchor:'withdraw', label:'撤回质押', enabled:false, reason:'' };
    if(guest) w.reason = '未登录。项目动作仅对该项目所属企业主体开放。';
    else if(d.wLimit <= 0 && d.deadCount === 0)
      w.reason = '当前可撤回上限为 ' + usd(0) + '（可融金额 ÷ 80%），池内也没有已失效代币，暂无可撤回的代币。'
               + '入口保留可见，不隐藏（H-03）。';
    else w.enabled = true;
    out.push(w);

    var c = { key:'close', anchor:'close', label:'关闭项目', enabled:false, reason:'' };
    if(guest) c.reason = '未登录。项目动作仅对该项目所属企业主体开放。';
    else if(st==='S-FP-3'||st==='S-FP-4') c.reason = '存在在途或未结清融资业务，项目不可关闭（6.1）。';
    else if(d.fly > 0) c.reason = '存在在途占用 ' + usd(d.fly) + '，请先撤下需求再关闭。';
    else if(d.bal > 0) c.reason = '存在未结清融资业务（项目融资余额 ' + usd(d.bal) + '），项目不可关闭（6.1）。';
    else c.enabled = true;
    out.push(c);
  }

  /* --- 提取：无可提取代币时不返回该动作，页面不得自行判断（AC-LS-71） --- */
  if(own && REDEEMABLE.length > 0){
    out.push({ key:'redeem', anchor:'redeem', label:'提取已释放代币（' + REDEEMABLE.length + ' 张）', enabled:true, reason:'' });
  }

  /* --- WS-325 增量：接受 / 拒绝报价。业务已终结时不返回（不可见，不是 ⊘）。
         需求因担保不足失效时报价一并终结，该动作随之消失（D-CR-30 / AC-LS-91）。 --- */
  /* --- WS-326 增量：放款 / 确认到账 / 重传盖章件（AC-LS-103）。
         可用性一律由服务端返回的 available_actions 决定，前端不自行依据状态推断；
         「不返回」与「返回但 ⊘ + 原因」是两件事：前者不可见，后者可见不可点。 --- */
  if(p.fin){
    var f = p.fin;
    if(f.st === 'S-FD-3' && (role === 'fund' || guest)){
      out.push({ key:'disburse', label:'放款', anchor:'disburse', enabled:!guest,
                 href:lnHref('#/deal/' + f.deal + '?action=disburse'),
                 reason: guest ? '未登录。放款动作仅对该笔业务的资金方企业主体开放；'
                               + '本页的放款公开字段（提交时间、币种与金额）本身不因未登录而隐藏。' : '' });
    }
    if(f.st === 'S-FD-4' && (own || guest)){
      out.push({ key:'confirm', label:'确认到账', anchor:'confirm_disbursement', enabled:!guest, primary:true,
                 href:lnHref('#/deal/' + f.deal + '?action=confirm_disbursement'),
                 reason: guest ? '未登录。融资确认仅对该项目所属企业主体开放；放款的公开字段本身是公开的。' : '' });
    }
    if(f.st === 'S-FD-3' && f.redo && (own || guest)){
      out.push({ key:'reupload', label:'重传盖章件', anchor:'reupload_contract', enabled:!guest,
                 href:lnHref('#/deal/' + f.deal + '?action=reupload_contract'),
                 reason: guest ? '未登录。重传盖章件仅对该项目所属企业主体开放。' : '' });
    }
  }
  /* --- WS-327 增量：去还款 / 确认收到还款（AC-LS-113）。
         两个动作同样由服务端返回的 available_actions 决定，前端不自行依据状态或日期推断。
         repay 在该业务存在 S-RP-1 期次时返回；**未开窗的期次照常返回该动作**，
         由 P-LS-09 上的那一期以 ⊘ + 开启日期呈现（AC-RP-17）。 --- */
  if(p.rep){
    var rp = p.rep;
    if(rp.hasDue && (own || guest)){
      out.push({ key:'repay', label:'去还款', anchor:'repay', enabled:!guest,
                 href:rpHref('#/deal/' + rp.deal + '?action=repay'),
                 reason: guest ? '未登录。还款动作仅对该项目所属企业主体开放；'
                               + '还款计划的公开字段（期次、应还日、本息拆分、期次状态、'
                               + '逾期标记与逾期天数）本身不因未登录而隐藏。' : '' });
    }
    if(rp.awaitConfirm && (role === 'fund' || guest)){
      out.push({ key:'confirm_repayment', label:'确认收到还款', anchor:'confirm_repayment', enabled:!guest,
                 href:rpHref('#/schedule/' + rp.awaitConfirm + '?action=confirm_repayment'),
                 reason: guest ? '未登录。还款确认仅对该笔业务的资金方企业主体开放；'
                               + '还款记录的提交时间与币种金额本身是公开的。' : '' });
    }
  }
  if(p.quote && st === 'S-FP-3' && (own || guest)){
    out.push({ key:'respond', label:'接受 / 拒绝报价',
               anchor:'respond_quote', enabled:!guest,
               href:cqHref('#/deal/' + p.quote.deal + '?action=respond_quote'),
               reason: guest ? '未登录。融资业务的处理动作仅对该项目所属企业主体开放；'
                             + '上面的在途报价条款与锁定信息本身是公开的，不因未登录而隐藏。' : '' });
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
   四个量口径互不混用；担保不足（融资上限 < 项目融资余额）在图 2 上有独立区间。
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

  /* 有效质押价值（底层，计入担保） */
  s += '<path d="' + stepFwd(pts, function(p){ return p.valid; }, X, Y) + stepBack(pts, zero, X, Y) +
       'Z" fill="var(--accent-soft)"></path>';
  /* 失效代币价值（上层，不计入担保）—— 中性灰 + 斜纹，双通道编码 */
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
         '底层资产失效 ' + firstDead.d + '</text>';
  }

  var labels = [{ y:Y(cur.valid), sw:'var(--accent)', name:'有效质押价值', val:cur.valid }];
  if(cur.dead > 0) labels.push({ y:Y(cur.total), sw:'var(--faint)', name:'池内资产总额', val:cur.total });
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

  /* 担保不足区间：融资上限 < 项目融资余额 的连续区段 —— 先铺底，图形压在上面 */
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

  /* 跨线点：担保不足起点 */
  bands.forEach(function(b){
    var bx = X(b[0].x);
    s += '<circle cx="' + bx.toFixed(1) + '" cy="' + Y(b[0].cap).toFixed(1) +
         '" r="5" fill="var(--card)" stroke="var(--danger)" stroke-width="2.4"></circle>' +
         '<text x="' + (bx + 9).toFixed(1) + '" y="' + (CH_M.t + 11) + '" font-size="10" fill="var(--danger)" font-weight="700">' +
         '担保不足区间 · 自 ' + b[0].d + ' 起</text>' +
         '<text x="' + (bx + 9).toFixed(1) + '" y="' + (CH_M.t + 24) + '" font-size="10" fill="var(--muted)">' +
         '融资上限跌破项目融资余额</text>';
  });

  /* 可融金额：末端的上限线与占用顶之间的竖向标注 */
  if(cur.free > 0){
    var fx = X(x1) - 14, yTop = Y(cur.cap), yBot = Y(cur.bal + cur.fly);
    s += '<line x1="' + fx.toFixed(1) + '" y1="' + yTop.toFixed(1) + '" x2="' + fx.toFixed(1) + '" y2="' + yBot.toFixed(1) +
         '" stroke="var(--faint)" stroke-width="1"></line>' +
         '<line x1="' + (fx-4).toFixed(1) + '" y1="' + yTop.toFixed(1) + '" x2="' + (fx+4).toFixed(1) + '" y2="' + yTop.toFixed(1) + '" stroke="var(--faint)" stroke-width="1"></line>' +
         '<line x1="' + (fx-4).toFixed(1) + '" y1="' + yBot.toFixed(1) + '" x2="' + (fx+4).toFixed(1) + '" y2="' + yBot.toFixed(1) + '" stroke="var(--faint)" stroke-width="1"></line>' +
         '<text x="' + (fx-7).toFixed(1) + '" y="' + ((yTop+yBot)/2).toFixed(1) + '" dy="3.5" text-anchor="end" font-size="10" fill="var(--muted)">可融</text>';
  }

  var labels = [{ y:Y(cur.cap), sw:'var(--accent)', name:'融资上限', val:cur.cap },
                { y:Y(cur.bal), sw:'var(--warn)', name:'项目融资余额', val:cur.bal }];
  if(cur.fly > 0) labels.push({ y:Y(cur.bal + cur.fly), sw:'var(--pos)', name:'项目在途金额', val:cur.fly });
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
      rows = [['var(--accent)','有效质押价值', p.valid], ['var(--faint)','失效代币价值（不计入担保）', p.dead], [null,'池内资产总额', p.total]];
    } else {
      rows = [['var(--accent)','融资上限', p.cap], ['var(--warn)','项目融资余额', p.bal], ['var(--pos)','项目在途金额', p.fly], [null,'可融金额', p.free]];
    }
    tip.innerHTML = '<div class="dt">' + p.d + ' · ' + TZ_LABEL + '</div>' +
      rows.map(function(r){
        return '<div class="r"><span class="lf">' + (r[0] ? '<i style="background:' + r[0] + '"></i>' : '<i style="background:transparent"></i>') +
          esc(r[1]) + '</span><b>' + amt(r[2]) + '</b></div>';
      }).join('') +
      (kind === 'fin' && p.short ? '<div class="ev" style="color:var(--danger)">担保不足：融资上限 < 项目融资余额，缺口 ' + amt(p.bal - p.cap) + ' ' + CCY + '</div>' : '') +
      (p.ev ? '<div class="ev"><b>' + esc(p.ev.t) + '</b>' + (p.ev.note ? '<br>' + esc(p.ev.note) : '') + '</div>' : '');
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
var mountedCharts = [];
function drawCharts(){
  mountedCharts.forEach(function(m){
    var wrap = document.getElementById('wrap-' + m.uid);
    if(!wrap) return;
    var W = Math.max(560, wrap.clientWidth);
    var built = (m.kind === 'pool') ? chartPool(m.uid, m.pts, W) : chartFin(m.uid, m.pts, W);
    var tip = wrap.querySelector('.ls-tip');
    wrap.innerHTML = '<svg class="ls-svg" width="' + W + '" height="' + CHART_H + '" role="img" aria-label="' +
      (m.kind === 'pool' ? '池内资产变动阶梯面积图' : '融资变动图') + '，精确数值见同卡片的数据表">' + built.svg +
      '<g class="cross" style="display:none"><line x1="0" y1="' + CH_M.t + '" x2="0" y2="' + (CHART_H - CH_M.b) +
      '" stroke="var(--faint)" stroke-width="1" stroke-dasharray="3 3"></line></g></svg>';
    wrap.appendChild(tip);
    attachHover('wrap-' + m.uid, m.pts, built, m.kind);
  });
}
function registerChart(p, kind){
  mountedCharts.push({ uid:kind + '-' + p.id.replace(/[^A-Za-z0-9]/g,''), pts:derive(p).pts, kind:kind });
}
/* ================================================================
   Part B —— 页面层：接入 _shared 的公共组件与运行时
   继承端别：面客端 asset　继承 shell：portal（4.3 顶栏母版，首个落库实现是
   金融服务端登录）　继承 archetype：公开列表页 / 公开详情页 / 认证后分步页
   本页增量：三数等式、额度尺、融资进度轨、折叠层、两张阶梯图。
   token / 按钮 / 卡片 / 表格 / pill / note / 弹层 / Toast / 导航全部来自 _shared，
   本层不重定义、不覆盖、不自建菜单。
   ================================================================ */
var CF = window.CF, L = CF.L, E = CF.esc, q = CF.q, pageHead = CF.pageHead, toast = CF.toast;
var S = null;

function T(zh){ return zh; }          /* 本模块正文为中文单语，见交付说明 §i18n */
function pill(tone, t){ return '<span class="pill ' + tone + '">' + E(t) + '</span>'; }
var TONE = { mute:'gray', info:'', good:'green', warn:'amber', crit:'red' };
function gTone(k){ return k === 'short' ? 'red' : k === 'used-up' ? 'amber' : 'green'; }

function statusPills(p){
  var d = derive(p), out = [];
  out.push(pill(TONE[FP_STATUS[p.status].tone] || 'gray', FP_STATUS[p.status].t));
  if(d.grade !== 'normal') out.push(pill(gTone(d.grade), gradeMeta(d.grade).t));
  if(p.expired) out.push(pill('gray', '已到期 · 存量融资业务照常履约中'));
  var ef = expiryFlag(p);
  if(ef && !p.expired) out.push(pill('amber', ef.t));
  if(p.emptyPool) out.push(pill('amber', '空池草稿 · 暂无有效质押'));
  if(p.quotes) out.push(pill('gray', '已收到报价 ' + p.quotes + ' 笔'));
  return out.join('');
}

/* ---- 三数等式：① 有效质押价值 × ② 质押率 = ③ 融资上限（AC-LS-53） ---- */
function trio(d){
  function cell(ix, lb, v, x, out){
    return '<div class="c' + (out ? ' out' : '') + '"><div class="ix">' + ix + '</div>' +
      '<div class="lb">' + lb + '</div><div class="v">' + v + '</div><div class="x">' + x + '</div></div>';
  }
  return '<div class="ls-trio">' +
    cell('① 参与计算', '有效质押价值', amt(d.valid), CCY + ' · 已排除失效、未上链、对账差异') +
    '<div class="op" aria-hidden="true">×</div>' +
    /* 质押率：纯文本，无输入框 / 下拉 / 滑块 / 步进器，无焦点态（AC-LS-56 / D-MC-110 / D-MC-111） */
    cell('② 质押率', '质押率', (PLEDGE_RATE*100) + '%', '本期固定，不可调整') +
    '<div class="op" aria-hidden="true">=</div>' +
    cell('③ ＝ ① × ②', '融资上限', amt(d.cap), CCY + ' · 一切担保充足性判断的比较对象', true) +
  '</div>' +
  '<div class="ls-sub">池内资产总额 <span class="mono">' + usd(d.total) + '</span>，其中 <span class="mono">' +
    usd(d.dead) + '</span>（' + d.deadCount + ' 张）因底层资产失效不计入担保。账面总额不参与任何校验。</div>';
}

/* ---- 额度尺：INV-FIN-01 的可视化读数 ---- */
function meter(d, mini){
  var used = d.bal + d.fly, scale = Math.max(d.cap, used) * 1.03 || 1;
  var pc = function(v){ return (v / scale * 100).toFixed(3); }, capPct = (d.cap / scale * 100);
  var sg = '';
  if(mini){
    var ui = Math.min(used, d.cap);
    if(ui > 0)        sg += '<div class="sg bal" style="width:' + pc(ui) + '%"></div>';
    if(used > d.cap)  sg += '<div class="sg gap" style="width:' + pc(used - d.cap) + '%"></div>';
    if(d.free > 0)    sg += '<div class="sg free" style="width:' + pc(d.free) + '%"></div>';
  } else {
    var bi = Math.min(d.bal, d.cap), bo = Math.max(0, d.bal - d.cap);
    if(bi > 0)     sg += '<div class="sg bal" style="width:' + pc(bi) + '%"></div>';
    if(bo > 0)     sg += '<div class="sg gap" style="width:' + pc(bo) + '%"></div>';
    if(d.fly > 0)  sg += '<div class="sg fly" style="width:' + pc(d.fly) + '%"></div>';
    if(d.free > 0) sg += '<div class="sg free" style="width:' + pc(d.free) + '%"></div>';
  }
  var shift = capPct > 78 ? 'transform:translateX(-100%);padding-right:4px' : 'transform:translateX(-50%)';
  return '<div class="ls-meter' + (mini ? ' mini' : '') + '"><div class="wrap">' +
    '<div class="track" role="img" aria-label="额度尺：融资上限 ' + amt(d.cap) + ' USD，项目融资余额 ' + amt(d.bal) +
      ' USD，项目在途金额 ' + amt(d.fly) + ' USD，可融金额 ' + amt(d.free) + ' USD">' + sg + '</div>' +
    '<div class="cap" style="left:' + capPct.toFixed(3) + '%"></div>' +
    (mini ? '' : '<div class="caplb" style="left:' + capPct.toFixed(3) + '%;' + shift + '">融资上限 ' + amt(d.cap) + '</div>') +
    '</div>' + (mini ? '' :
    '<div class="lg"><span><i class="cap"></i>融资上限 <b>' + amt(d.cap) + '</b></span>' +
    '<span><i class="bal"></i>项目融资余额 <b>' + amt(d.bal) + '</b></span>' +
    '<span><i class="fly"></i>项目在途金额 <b>' + amt(d.fly) + '</b></span>' +
    '<span><i class="free"></i>可融金额 <b>' + amt(d.free) + '</b></span>' +
    (d.gap > 0 ? '<span><i class="gap"></i>担保缺口 <b>' + amt(d.gap) + '</b></span>' : '') + '</div>') +
  '</div>';
}

/* ---- 融资进度轨：环节名取自 PRD 状态机 S-FP-*；后段标注为后续环节 ---- */
var FLOW = [
  { id:'S-FP-1', t:'草稿',   x:'已建池 · 未发布',           mine:true },
  { id:'S-FP-2', t:'募集中', x:'需求已发布 · 公开接受报价',  mine:true },
  { id:'S-FP-3', t:'已锁定', x:'已被报价 · 暂不接受新报价',  mine:true },
  { id:'S-FP-4', t:'融资中', x:'接受报价 → 放款 → 融资确认', mine:false, who:'WS-325 ～ WS-326' },
  { id:'S-FP-6', t:'已结清', x:'还款结清 → 释放全部质押',    mine:false, who:'WS-327' }
];
function flowRail(p){
  var order = ['S-FP-1','S-FP-2','S-FP-3','S-FP-4','S-FP-6'];
  var ci = order.indexOf(p.status === 'S-FP-5' ? 'S-FP-1' : p.status); if(ci < 0) ci = 0;
  var out = '';
  FLOW.forEach(function(f, i){
    if(i === 3) out += '<div class="sep" aria-hidden="true"><span>本模块边界</span></div>';
    var cls = (i < ci ? 'done' : i === ci ? 'now' : 'next') + (f.mine ? '' : ' later');
    out += '<div class="fs ' + cls + '"><div class="id">' + f.id + (f.mine ? '' : ' · 后续环节') + '</div>' +
      '<div class="t">' + f.t + (i === ci ? '（当前）' : '') + '</div>' +
      '<div class="x">' + E(f.x) + (f.who ? '<br>由 ' + f.who + ' 实现' : '') + '</div></div>';
  });
  return '<div class="ls-flow">' + out + '</div>' +
    '<p class="hint" style="margin-top:11px">本模块只承载到 <b>S-FP-3 已锁定</b>：建池、质押、发布需求，以及"已被报价"这个状态落点。' +
    '虚线段为后续环节、<b>此刻不可操作</b>——报价与接受在 WS-325，放款与融资确认在 WS-326，还款结清在 WS-327。' +
    (p.expired ? '<br>本项目有效期已到期，并行标记「已到期 · 存量处理中」：停止接受新报价、不允许再次发布，存量融资业务照常履约。' : '') + '</p>';
}

/* ---- WS-325 增量：锁定信息（D-LS-13 / AC-LS-85）----
   S-FP-3 期间必须展示四件事：被谁锁定 / 从什么时候开始 / 已锁定多久 / 还剩多久，
   并给两条出路。倒计时是本期唯一对外解释锁定的手段，不得省略、不得只显示"已锁定 N 天"。
   锁定信息属于公开信息，对游客与全部资金方可见；只陈述事实，不做评价性措辞（D-LS-14）。 */
function lockLine(p){
  if(!p.quote) return '';
  var k = quoteClock(p.quote);
  return '<div class="ls-lockmini' + (k.soon ? ' soon' : '') + '">' +
    '<span>被 ' + E(p.quote.fund) + ' 锁定</span>' +
    '<span>已 ' + fmtDur(k.heldMin) + '</span>' +
    '<b>剩余 ' + fmtDur(k.leftMin) + '</b></div>';
}
function lockCard(p, own){
  if(!p.quote) return '';
  var q = p.quote, k = quoteClock(q);
  var held = (k.heldMin / (QUOTE_HOURS * 60) * 100).toFixed(2);
  return '<div class="ls-lock' + (k.soon ? ' soon' : '') + '">' +
    '<div class="by">被 <b>' + E(q.fund) + '</b> 锁定，自 <b>' + q.at + ' ' + TZ_LABEL +
      '</b> 起，已锁定 <b>' + fmtDur(k.heldMin) + '</b>。</div>' +
    '<div class="big"><span class="v">' + fmtDur(k.leftMin) + '</span>' +
      '<span class="u">后自动失效　·　到期时刻 ' + k.to + ' ' + TZ_LABEL + '</span></div>' +
    '<div class="bar" role="img" aria-label="报价有效期 ' + QUOTE_HOURS + ' 小时：已锁定 ' +
      fmtDur(k.heldMin) + '，剩余 ' + fmtDur(k.leftMin) + '">' +
      '<div class="el" style="width:' + held + '%"></div>' +
      '<div class="rm" style="width:' + (100 - held).toFixed(2) + '%"></div></div>' +
    '<div class="scale"><span>提交 <b>' + q.at + '</b></span>' +
      '<span>已锁定 <b>' + fmtDur(k.heldMin) + '</b> ＋ 剩余 <b>' + fmtDur(k.leftMin) + '</b> ≡ <b>' +
      QUOTE_HOURS + ' 小时</b></span></div>' +
    (k.soon ? '<p class="hint" style="color:var(--warn)">剩余不足 24 小时，倒计时已切到分钟精度。' +
      '到点即失效，由系统自动执行、不依赖任何人登录；无宽限期。</p>' : '') +
    '<div class="ways">' +
      (own
        ? '<div class="w"><i>①</i><span>您可以<b>随时拒绝</b>该报价，需求将立即回到可被报价的状态。</span></div>' +
          '<div class="w"><i>②</i><span>若 <b>' + fmtDur(k.leftMin) +
            '</b> 内未处理，该报价将<b>自动失效</b>、需求自动放开。</span></div>'
        : '<div class="w"><i>①</i><span>资产方可<b>随时拒绝</b>，需求随即回到可被报价的状态。</span></div>' +
          '<div class="w"><i>②</i><span>若 <b>' + fmtDur(k.leftMin) +
            '</b> 内未处理，报价<b>自动失效</b>、需求自动放开。</span></div>') +
    '</div></div>';
}

function fold(title, cnt, body, open){
  return '<details class="ls-fold"' + (open ? ' open' : '') + '><summary>' +
    '<span class="ca" aria-hidden="true">▶</span>' + E(title) +
    (cnt ? '<span class="n">' + E(cnt) + '</span>' : '') + '</summary><div class="fb">' + body + '</div></details>';
}

/* 跨文件入口：WS-325 原型与本模块是同级目录，按登记表拼相对地址，不写死路径 */
function cqHref(hash){
  var m = (CF.MODULES || {})['lending-credit-quote'];
  return m ? '../' + m.dir + '/' + m.file + (hash || '') : '#';
}
/* WS-326 增量：放款与融资确认在另一个模块文件里，同样按登记表拼地址 */
function lnHref(hash){
  var m = (CF.MODULES || {})['lending-disbursement'];
  return m ? '../' + m.dir + '/' + m.file + (hash || '') : '#';
}
/* WS-327 增量：还款计划与还款确认在第四个模块文件里，同样按登记表拼地址 */
function rpHref(hash){
  var m = (CF.MODULES || {})['lending-repayment'];
  return m ? '../' + m.dir + '/' + m.file + (hash || '') : '#';
}
/* WS-326 增量：在途业务的公开进度（FD-20260902-0054 这一类），只读引用 WS-326 的输出。
   P-LS-01 只给进度、**不给确认时限倒计时**——广场的读者是潜在报价方，
   他关心的是这个项目能不能报价，不是别人那笔业务还剩几天（WS-326 分册 6.5.3）。 */
var FIN_ST = { 'S-FD-3':'待放款', 'S-FD-4':'待融资确认', 'S-FD-6':'还款中', 'S-FD-8':'已结清' };
/* WS-327 增量：还款进度（已还 X / 共 N 期）与逾期标记进 P-LS-01 卡片。
   **不给还款确认时限的剩余时间**——广场首页的读者是潜在报价方，他关心的是这个项目还能不能报价，
   不是别人那笔业务的哪一期还剩几小时（分册 6.6.4）。
   rep 是 WS-327 权威产出的公开进度，本页**只读引用、不自行计算**：
   AC-LS-115 明确要求下游不得自行重算利息或逾期天数。 */
function finLine(p){
  var out = '';
  if(p.fin) out += '<div class="cell-sub">业务进度 · ' + (FIN_ST[p.fin.st] || p.fin.st) + '</div>';
  if(p.rep){
    out += '<div class="cell-sub">还款进度 · 已还 ' + p.rep.done + ' / 共 ' + p.rep.n + ' 期' +
      (p.rep.overdueDays ? '　<span class="pill gray">已逾期 ' + p.rep.overdueDays + ' 天</span>' : '') +
      '</div>';
  }
  return out;
}

/* ---- 动作按钮：区分「不可见」与「可见不可点 ⊘」（H-03） ---- */
function actBtn(a, cls, noWhy){
  if(a.enabled){
    /* 落在别的模块文件里的动作用链接，公共层的跨文件边界提示才拦得住（见 _shared/export.py） */
    if(a.href) return '<a class="btn ' + (cls || '') + '" href="' + a.href + '">' + E(a.label) + '</a>';
    return '<button class="btn ' + (cls || '') + '" type="button" data-act="ls.do" data-v="' + a.key + '">' + E(a.label) + '</button>';
  }
  return '<button class="btn blocked ' + (cls || '').replace('primary','') + '" type="button" aria-disabled="true" ' +
    'title="' + E(a.reason) + '" data-act="ls.why" data-v="' + a.key + '">⊘ ' + E(a.label) + '</button>' +
    (noWhy ? '' : whyLine(a.reason));
}
function whyLine(reason){
  return '<div class="ls-why"><span class="sg" aria-hidden="true">⊘</span><span>' + E(reason) +
    (S.role === 'guest' ? ' <button class="btn-link" type="button" data-act="ls.signin">登录 / 注册</button>' : '') + '</span></div>';
}

/* ---- 提示块：只有担保不足保留填色（D-FIN-56 中性事实文案） ---- */
function shortAlert(p, d, own){
  if(d.grade !== 'short') return '';
  return '<div class="ls-alert">' + CF.note('red',
    '缺口 <span class="mono">' + usd(d.gap) + '</span>，需追加资产价值 <span class="mono">' + usd(d.need) +
    '</span>（＝缺口 ÷ ' + (PLEDGE_RATE*100) + '%），自 ' + (d.shortFrom || '—') + ' 起。' +
    '诱因：池内 ' + d.deadCount + ' 张代币底层应收账款已失效（合计 ' + usd(d.dead) + '），不计入有效质押价值；' +
    '追加质押抬高融资上限或还款降低项目融资余额，条件反转即自动解除。',
    '担保不足：池内有效质押价值低于项目融资余额') + '</div>';
}
function usedUpNote(d){
  if(d.grade !== 'used-up') return '';
  return CF.note('amber',
    '可融金额为 <span class="mono">' + usd(0) + '</span>，暂不能新增占用。' +
    '<p>已发生的债务仍有足额担保（融资上限 ' + usd(d.cap) + ' ≥ 项目融资余额 ' + usd(d.bal) +
    '），<strong class="ls-b">这不是担保不足预警</strong>。追加质押可抬高融资上限并重新打开额度。</p>', '额度用尽');
}
function redeemBanner(){
  if(S.role !== 'asset' || !REDEEMABLE.length) return '';
  var sum = REDEEMABLE.reduce(function(a,t){ return a + t.amt; }, 0);
  return CF.note('', '您有 <strong class="ls-b">' + REDEEMABLE.length + ' 张</strong>代币（合计 <span class="mono">' + usd(sum) + '</span>）可提取。' +
    '<p>业务上已释放，链上仍停留在质押合约内，<strong class="ls-b">不会自动回到钱包</strong>；需您自行发起提取并自付 gas，支持批量一次提完，无时间限制、不过期。' +
    '未提取前不属于任何资产池、不计入任何质押价值，也不能被再次质押。' +
    '<button class="btn-link" type="button" data-act="ls.do" data-v="redeem" style="margin-left:8px">批量提取</button></p>', '可提取代币');
}

/* ================================================================
   P-LS-01 融资需求广场（公开列表页）
   ================================================================ */
var F0 = { type:'', pool:'', demand:'', status:'', quotable:'', expiry:'', grade:'' };
function matchFilter(p){
  var d = derive(p), f = S.flt;
  if(f.type && p.assetType !== f.type) return false;
  if(f.pool){ var r = f.pool.split('-'); if(d.valid < +r[0] || (r[1] !== 'x' && d.valid > +r[1])) return false; }
  if(f.demand){ var g = f.demand.split('-'); if(!p.demand) return false;
    if(p.demand < +g[0] || (g[1] !== 'x' && p.demand > +g[1])) return false; }
  if(f.status && p.status !== f.status) return false;
  if(f.grade && derive(p).grade !== f.grade) return false;
  if(f.quotable === 'y' && !actionOf(availableActions(p,'fund'),'quote').enabled) return false;
  if(f.quotable === 'locked' && p.status !== 'S-FP-3') return false;
  if(f.quotable === 'n' && actionOf(availableActions(p,'fund'),'quote').enabled) return false;
  if(f.expiry){ var dd = p.expiresAt ? daysTo(p.expiresAt) : 99999;
    if(f.expiry === 'x' && dd >= 0) return false;
    if(f.expiry === '7' && (dd < 0 || dd > 7)) return false;
    if(f.expiry === '30' && (dd < 0 || dd > 30)) return false; }
  return true;
}
function filterBar(){
  function sel(k, lb, opts){
    return '<label class="fl"><span>' + lb + '</span><select class="inp" data-act="ls.flt" data-v="' + k + '">' +
      opts.map(function(o){ return '<option value="' + o[0] + '"' + (S.flt[k] === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select></label>';
  }
  return '<div class="filters">' +
    sel('type','资产类型',[['','全部'],['应收账款类','应收账款类']]) +
    sel('pool','池内资产价值',[['','不限'],['0-500000','50 万以下'],['500000-1000000','50–100 万'],['1000000-x','100 万以上']]) +
    sel('demand','需求金额',[['','不限'],['0-300000','30 万以下'],['300000-600000','30–60 万'],['600000-x','60 万以上']]) +
    sel('status','项目状态',[['','全部']].concat(['S-FP-2','S-FP-3','S-FP-4','S-FP-5','S-FP-6'].map(function(k){ return [k, FP_STATUS[k].t]; }))) +
    sel('quotable','是否可报价',[['','不限'],['y','可报价'],['locked','已被锁定'],['n','暂不可报价']]) +
    sel('expiry','有效期临近',[['','不限'],['7','7 天内到期'],['30','30 天内到期'],['x','已到期']]) +
    sel('grade','担保状态',[['','全部']].concat(GRADES.map(function(g){ return [g.k, g.t]; }))) +
    '<div style="flex:1"></div>' +
    sel('sort','排序',[['pub','发布时间倒序'],['demand','按需求金额'],['pool','按池内资产价值']]) +
  '</div>';
}
function plazaRow(p){
  var d = derive(p), qa = actionOf(availableActions(p, S.role), 'quote'), ef = expiryFlag(p);
  var cover = d.cap > 0 ? Math.round((d.bal + d.fly) / d.cap * 100) : 0;
  return '<tr class="rowlink" data-act="ls.open" data-v="' + p.id + '">' +
    '<td><div class="cell-main">' + E(p.name) + '</div>' +
      '<div class="cell-sub">' + E(p.owner) + ' · ' + p.id + '</div></td>' +
    '<td class="num">' + (p.demand ? '<span style="font-size:15px;font-weight:680">' + amt(p.demand) + '</span>' +
        '<div class="cell-sub">' + CCY + '</div>' : '<span class="faint">—</span><div class="cell-sub">无在途需求</div>') + '</td>' +
    '<td>' + pill(TONE[FP_STATUS[p.status].tone] || 'gray', FP_STATUS[p.status].t) +
      (p.expired ? '<div class="cell-sub">已到期 · 存量履约中</div>' : '') +
      lockLine(p) + finLine(p) + '</td>' +
    '<td>' + pill(gTone(d.grade), gradeMeta(d.grade).t) +
      (d.gap ? '<div class="cell-sub">缺口 ' + amt(d.gap) + '</div>' : '') + '</td>' +
    '<td class="num">' + amt(d.valid) + '<div class="cell-sub">' + p.tokens.length + ' 张' +
      (d.deadCount ? ' · 含失效 ' + d.deadCount + ' 张' : '') + '</div></td>' +
    '<td style="width:150px">' + meter(d, true) +
      '<div class="cell-sub" style="margin-top:5px">已占用 ' + cover + '% · 可融 ' + amt(d.free) + '</div></td>' +
    '<td class="num">' + (p.expiresAt || '—') +
      (ef && !p.expired ? '<div class="cell-note">' + E(ef.t) + '</div>' : '') + '</td>' +
    '<td class="col-act" style="text-align:right">' +
      (qa.enabled
        ? '<a class="btn sm primary" href="' + qa.href + '" data-act="ls.cross">立即报价</a>'
        : '<button class="btn sm blocked" type="button" aria-disabled="true" title="' + E(qa.reason) +
          '" data-act="ls.whyq" data-v="' + p.id + '">⊘ 报价</button>' +
          '<div class="cell-sub" style="margin-top:4px">' + E(qa.brief || '') + '</div>') +
    '</td></tr>';
}
function pagePlaza(){
  var all = plazaProjects();
  var sv = all.reduce(function(a,p){ return a + derive(p).valid; }, 0);
  var sd = all.reduce(function(a,p){ return a + (p.demand || 0); }, 0);
  var head = pageHead('融资需求广场',
    '平台上全部入驻资产方创建的融资项目，一个项目就是一个资产池。信息 L1～L5 对所有人全量可见，不登录也能看完；只有操作入口按登录态与权限收敛。',
    S.role === 'asset' ? '<button class="btn primary" type="button" data-act="go" data-v="P-LS-03">创建融资项目</button>' : '');
  var strip = '<div class="stat-row" style="margin-bottom:16px">' +
    '<div class="stat"><div class="lbl">在架融资项目</div><div class="val">' + all.length + ' 个</div></div>' +
    '<div class="stat"><div class="lbl">有效质押价值合计</div><div class="val">' + usd(sv) + '</div></div>' +
    '<div class="stat"><div class="lbl">在途融资需求合计</div><div class="val">' + usd(sd) + '</div></div>' +
  '</div>';

  if(S.st === 'loading'){
    var sk = ''; for(var i=0;i<8;i++) sk += '<div class="skel-row"><div class="skel" style="width:100%"></div></div>';
    return head + strip + '<div class="card"><div class="filters">' + '</div><div class="card-b">' + sk + '</div></div>';
  }
  if(S.st === 'error')
    return head + strip + '<div class="card"><div class="tbl-empty"><b>融资需求加载失败</b>服务端未返回列表数据。这不影响已发布项目的链上与额度状态，可重试。' +
      '<div style="margin-top:14px"><button class="btn primary" type="button" data-act="st" data-v="default">重新加载</button></div></div></div>';
  if(S.st === 'empty')
    return head + strip + '<div class="card"><div class="tbl-empty"><b>暂无融资需求</b>资产方在资产平台完成应收账款确权、由运营端签发代币后，即可在此创建资产池并发布融资需求。</div></div>';

  var list = all.filter(matchFilter).sort(function(a,b){
    if(S.flt.sort === 'demand') return (b.demand||0) - (a.demand||0);
    if(S.flt.sort === 'pool') return derive(b).valid - derive(a).valid;
    return dnum(b.publishedAt || TODAY) - dnum(a.publishedAt || TODAY);
  });
  if(S.st === 'noresult' || !list.length)
    return head + strip + '<div class="card">' + filterBar() +
      '<div class="tbl-empty"><b>没有符合筛选条件的融资需求</b>当前筛选组合下没有匹配的资产池。可放宽池内资产价值区间或项目状态，也可以清空筛选查看全部 ' +
      all.length + ' 条。<div style="margin-top:14px"><button class="btn" type="button" data-act="ls.reset">清空筛选</button></div></div></div>';

  return head + strip + '<div class="card">' + filterBar() +
    '<div class="tablewrap" style="border:0;box-shadow:none;border-radius:0"><table class="tbl ls-tbl"><thead><tr>' +
      '<th>融资项目 / 资产方</th><th class="num">融资需求金额</th><th>项目状态</th><th>担保状态</th>' +
      '<th class="num">有效质押价值</th><th>额度占用</th><th class="num">有效期至</th><th class="col-act" style="text-align:right">操作</th>' +
    '</tr></thead><tbody>' + list.map(plazaRow).join('') + '</tbody></table></div>' +
    '<div class="pager"><span class="faint">共 ' + list.length + ' 条 · 单页 ' + PAGE_SIZE + ' 条 · 点击任意一行进入详情</span></div>' +
  '</div>';
}

/* ================================================================
   P-LS-02 融资需求详情（公开详情页）
   v1.2 版式：左右两栏——左栏「质押代币清单」+「融资信息清单」，
   右栏操作区（融资进度并入），两张图移到两栏之下的页面最下方。
   ================================================================ */
/* 一个融资需求 = 一条申请记录。需求不是独立对象（D-FIN-02 / D-LS-11），
   因此不另发号，用「项目编号 · 第 N 次发布」做显示引用。 */
function demandRecords(p){
  var rows = [], seq = 0, pending = null, dealIdx = 0;
  p.events.forEach(function(e){
    if(e.k === 'publish'){
      seq++;
      pending = { seq:seq, at:e.d, amt:e.dFly || 0, st:'在途', tone:'', deal:'', x:'发布即产生在途占用（AC-FIN-23）' };
      rows.push(pending);
    } else if(e.k === 'fund' && pending){
      var dl = p.deals[dealIdx++];
      pending.st = '已成交 · 转入项目融资余额'; pending.tone = 'green';
      pending.deal = dl ? dl.id : '—';
      pending.x = '放款并完成融资确认，额度原子转移：在途 → 项目融资余额（AC-FIN-25）';
      pending = null;
    } else if(e.k === 'quote' && pending){
      pending.st = '已被报价'; pending.tone = '';
      pending.x = '报价不新增占用，项目在途金额保持不变（AC-FIN-23）';
    /* ---- WS-326 增量：接受 / 放款 / 终止三类事件的进度落点 ---- */
    } else if(e.k === 'accept' && pending){
      pending.st = '已接受 · 待放款'; pending.tone = '';
      pending.x = '接受不新增占用；放款与融资确认在 WS-326';
    } else if(e.k === 'disb' && pending){
      pending.st = '已放款 · 待融资确认'; pending.tone = '';
      pending.x = '放款时四个量一个都不动，确认完成才转入项目融资余额（AC-FIN-25 / D-LN-07）';
    } else if(e.k === 'terminate' && pending){
      pending.st = '业务已终止 · 需求重回募集'; pending.tone = 'gray';
      pending.x = '在途报价金额全额释放，项目在途金额不变——需求还挂着，可被任何机构重新报价（D-LN-24）';
    }
  });
  rows.reverse();
  if(rows.length && p.demand && rows[0].st === '在途') rows[0].st = '募集中 · 在途占用';
  return rows;
}
function cardHead(t, note){
  return '<div class="card-head"><b>' + E(t) + '</b>' + (note ? '<span style="margin-left:auto">' + note + '</span>' : '') + '</div>';
}
function pageProject(){
  var p = findProject(S.pid);
  if(!p || (p.draft && !(S.role === 'asset' && p.entity === ACTORS.asset.entity)) || S.st === 'gone')
    return pageHead('内容不存在或无权访问', '') +
      '<div class="card"><div class="tbl-empty"><b>内容不存在或无权访问</b>' +
      '草稿项目不进入广场、不可搜索、不可深链直达（AC-LS-05 / D-FIN-64）。' +
      '<div style="margin-top:14px"><button class="btn primary" type="button" data-act="go" data-v="P-LS-01">返回融资需求广场</button></div></div></div>';
  if(p.draft){ S.pubStep = 2; return pagePublish(); }

  var d = derive(p), acts = availableActions(p, S.role);
  var own = (S.role === 'asset' && p.entity === ACTORS.asset.entity);
  chartQueue = [];

  if(S.st === 'loading')
    return pageHead(p.name, '') + '<div class="card"><div class="card-b">' +
      '<div class="skel" style="height:60px"></div><div class="skel" style="height:200px;margin-top:16px"></div></div></div>';
  if(S.st === 'error')
    return pageHead(p.name, '') + '<div class="card"><div class="tbl-empty"><b>详情加载失败</b>' +
      '服务端未返回该项目数据，可重试。<div style="margin-top:14px">' +
      '<button class="btn primary" type="button" data-act="st" data-v="default">重新加载</button></div></div></div>';

  /* ---- 页头：复刻参考件——返回按钮 + 图标块 + 超大标题 + 大号标签行 ---- */
  var head =
    '<div class="ls-back"><button class="btn" type="button" data-act="go" data-v="P-LS-01">← 返回融资需求广场</button></div>' +
    '<div class="ls-phead"><div class="tile" aria-hidden="true">◧</div><div class="body">' +
      '<p class="kick">融资项目 · 发布于 <span class="mono">' + (p.publishedAt || '—') +
        '</span> · 编号 <span class="mono">' + p.id + '</span> · 时区 ' + TZ_LABEL + '</p>' +
      '<h1>' + E(p.name) + '<em>' + E(p.owner) + '</em></h1>' +
      '<div class="ls-tags">' + statusPills(p) + '</div>' +
    '</div><div class="amt"><div class="k">融资需求金额</div>' +
      (p.demand ? '<div class="v">' + amt(p.demand) + '<span class="cy">' + CCY + '</span></div>'
                : '<div class="v faint">—</div>') +
      '<div class="x">' + (p.demand
        ? '有效期至 ' + p.expiresAt + '（首次发布日 + ' + TERM_YEARS + ' 年，只读）' : '当前无在途融资需求') + '</div>' +
    '</div></div>' + CF.pageStates();

  /* ---- 三数等式 + 额度尺 + 折叠层（读数带，裸露在页面底色上） ---- */
  var kd = [
    ['池内资产总额','FP-10', amt(d.total), '含失效代币，仅展示，不参与任何校验'],
    ['失效代币价值 / 张数','FP-19', amt(d.dead) + ' / ' + d.deadCount + ' 张', '因底层应收账款失效，不计入担保'],
    ['项目融资余额','FP-13', amt(d.bal), '已确认（还款中）/ 已到期 / 逾期的未偿本金合计'],
    ['项目在途金额','FP-14', amt(d.fly), '唯一来源为发布占用，报价环节不新增'],
    ['可融金额','FP-15', amt(d.free), 'max(0, 融资上限 − 项目融资余额 − 项目在途金额)'],
    ['可撤回上限','FP-16', amt(d.wLimit), '可融金额 ÷ ' + (PLEDGE_RATE*100) + '%，仅约束未失效代币']
  ];
  if(d.gap) kd.push(['担保缺口 / 需追加资产价值','FP-21', amt(d.gap) + ' / ' + amt(d.need), '需追加资产价值 ＝ 缺口 ÷ ' + (PLEDGE_RATE*100) + '%']);
  else kd.push(['已收到报价数','FP-22', p.quotes + ' 笔', '累计报价笔数，含已拒绝 / 已失效']);
  var foldBody = '<div class="ls-kgrid">' + kd.map(function(k){
      return '<div><div class="k">' + E(k[0]) + ' · ' + k[1] + '</div><div class="v">' + k[2] + '</div>' +
        '<div class="x">' + E(k[3]) + '</div></div>'; }).join('') + '</div>' +
    '<h3 class="sec-title" style="margin:20px 0 10px;font-size:12.5px">担保状态档位判据（FP-20）</h3>' +
    '<div class="ls-grades">' + GRADES.map(function(g){
      var on = g.k === d.grade;
      return '<div class="g' + (on ? ' on' : '') + '"><span class="m">' + (on ? '●' : '○') + '</span><b>' + g.t + '</b><span>' + E(g.x) + '</span></div>';
    }).join('') + '</div>' +
    '<p class="hint" style="margin-top:12px"><b>预警线与准入闸门不是同一条线。</b>闸门比较「项目融资余额 + 项目在途金额」，管"还能不能借"；' +
    '预警只比较「项目融资余额」，管"已借的还保得住吗"。两者受众与处置动作都不同，分别呈现。</p>';
  var readout = '<div style="margin:18px 0 22px">' + trio(d) + meter(d) +
    fold('额度明细与判定口径', '六个派生量 · 担保三档 · 判据', foldBody) + '</div>';

  /* ---- 左栏 1：质押代币清单（L4 全量逐张，不脱敏、不区间化、不限行数） ---- */
  var pledgeCard = '<div class="card">' + cardHead('质押代币清单',
      '<span class="faint">共 ' + p.tokens.length + ' 张 · 全量展示，不脱敏、不区间化、不限行数</span>') +
    '<div class="tablewrap" style="border:0;box-shadow:none;border-radius:0"><table class="tbl ls-wide"><thead><tr>' +
      '<th>代币编号</th><th class="num">美元金额</th><th>底层账期</th><th>买方企业名</th><th>合同号 / 发票号</th>' +
      '<th>质押状态</th><th>是否计入担保</th><th>链上状态</th><th>入池交易哈希</th></tr></thead><tbody>' +
      (p.tokens.length ? p.tokens.map(function(t){
        return '<tr><td class="mono">' + t.id + '</td><td class="num">' + amt(t.amt) + '</td><td class="num">' + t.due + '</td>' +
          '<td>' + E(t.buyer) + '</td><td class="mono" style="font-size:11px">' + t.contract + ' / ' + t.invoice + '</td>' +
          '<td>' + pill('gray','PS-2 已质押') + '</td>' +
          '<td>' + (t.dead ? pill('amber','不计入 · ' + (t.deadAt||'') + ' 失效') : pill('green','计入担保')) + '</td>' +
          '<td>' + pill(TONE[CT_STATUS[t.ct].tone] || 'gray', t.ct + ' ' + CT_STATUS[t.ct].t) + '</td>' +
          '<td><span class="hash"><span class="val">' + shortHash(t.hash) + '</span></span></td></tr>';
      }).join('') : '<tr><td colspan="9" class="tbl-empty"><b>本项目暂无有效质押</b>创建时那笔质押最终链上失败，可重新质押后再发布。</td></tr>') +
    '</tbody></table></div>' +
    '<div class="card-b" style="padding-top:12px">' + CF.note('',
      '全量公开的范围是广场上展示的融资需求与融资业务信息；<strong class="ls-b">不含</strong>授信额度、他人控制台数据、运营端诊断字段、附件影像件与联系人联系方式。' +
      '<p>客观记录：买方企业名、合同号、发票号与精确金额对公网访客完全公开，涉及第三方权益，而确权流程目前没有"同意公开"授权环节。' +
      '按需求方裁定执行，配套的接口速率限制与异常抓取识别见分册第 8 章。</p>') + '</div></div>';

  /* ---- 左栏 2：融资信息清单（一行 = 一笔需求，状态列区分进行中与历史） ---- */
  var recs = demandRecords(p);
  var demandCard = '<div class="card" style="margin-top:16px">' + cardHead('融资信息清单',
      '<span class="faint">一行 = 一笔融资需求 · 共 ' + recs.length + ' 笔</span>') +
    '<div class="tablewrap" style="border:0;box-shadow:none;border-radius:0"><table class="tbl"><thead><tr>' +
      '<th>发布批次</th><th class="num">发布日期</th><th class="num">融资需求金额</th><th>状态</th>' +
      '<th>关联融资业务</th><th>说明</th></tr></thead><tbody>' +
      (recs.length ? recs.map(function(r){
        return '<tr><td class="mono">第 ' + r.seq + ' 次发布</td><td class="num">' + r.at + '</td>' +
          '<td class="num">' + amt(r.amt) + '</td>' +
          '<td>' + pill(r.tone || '', r.st) + '</td>' +
          '<td class="mono">' + (r.deal || '—') + '</td>' +
          '<td class="faint" style="font-size:11px;white-space:normal">' + E(r.x) + '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="tbl-empty"><b>本项目尚未发布过融资需求</b>完成建池与质押后，在第二段填写金额即可发布。</td></tr>') +
    '</tbody></table></div>' +
    '<div class="card-b" style="padding-top:12px">' + CF.note('',
      '融资需求不是独立对象——项目编号即广场上这条融资需求的编号，<strong class="ls-b">不另发号</strong>（D-LS-11 / H-01）。' +
      '因此这里用「项目编号 · 第 N 次发布」做显示引用，进行中与历史同表，用状态列区分。' +
      '<p>商务条款：' + (p.terms ? '报价利率 ' + E(p.terms.rate) + ' · 融资期限 ' + E(p.terms.term) + ' · ' + E(p.terms.repay) + ' · 资金用途 ' + E(p.terms.use)
        : '该项目当前无公开的在途业务商务条款。') + '</p>') + '</div></div>';

  /* ---- 左栏 3（WS-325 增量）：在途报价的公开商务条款 + 历史报价时间线 ----
     公开字段：机构名称、报价金额、年化利率、结算币种、报价提交时间、已锁定时长、
     剩余有效期与到期时刻。**不展示报价时的池快照**（AC-LS-27 已作废）——
     当前池况就在本页上方的三数等式与额度尺里，看那一组即可。 */
  var past = p.pastQuotes || [];
  var quoteCard = (p.quote || past.length)
    ? '<div class="card" style="margin-top:16px">' + cardHead('在途报价与报价历史',
        '<span class="faint">公开商务条款 · 口径由 WS-325 权威产出，本页只读引用</span>') +
      (p.quote ? '<div class="card-b">' +
        '<div class="ls-kgrid">' +
          '<div><div class="k">融资业务编号</div><div class="v">' + p.quote.deal + '</div>' +
            '<div class="x">提交成功的同一时刻生成，终身稳定</div></div>' +
          '<div><div class="k">报价机构</div><div class="v" style="font-family:var(--sans)">' +
            E(p.quote.fund) + '</div><div class="x">机构企业主体全称 · 公开字段</div></div>' +
          '<div><div class="k">报价金额</div><div class="v">' + amt(p.quote.amt) + '</div>' +
            '<div class="x">' + CCY + ' · 恒等于需求金额</div></div>' +
          '<div><div class="k">年化利率</div><div class="v">' + p.quote.rate.toFixed(2) + '%</div>' +
            '<div class="x">计息规则以双方签署的融资合同为准</div></div>' +
          '<div><div class="k">结算币种与金额</div><div class="v">' + amt(p.quote.settle) + ' ' + p.quote.ccy +
            '</div><div class="x">按报价提交时锁定的汇率快照折算</div></div>' +
          '<div><div class="k">报价提交时间</div><div class="v">' + p.quote.at + ' ' + TZ_LABEL + '</div>' +
            '<div class="x">锁定信息的起算点</div></div>' +
        '</div>' +
        '<div style="margin-top:16px">' + lockCard(p, own) + '</div></div>' : '') +
      (past.length ? '<div class="card-b"' + (p.quote ? ' style="border-top:1px solid var(--border)"' : '') + '>' +
        '<h3 class="sec-title" style="font-size:12.5px;margin-bottom:10px">报价历史 · 按终结方式标注</h3>' +
        '<ul class="tl">' + past.map(function(qq){
          var tag = qq.st === 'S-FD-2'
            ? pill('gray', 'S-FD-2 已拒绝')
            : pill('gray', 'S-FD-11 报价已失效 · ' + qq.void);
          return '<li><div style="font-size:12.5px">' + tag +
            '<span class="mono" style="margin-left:8px">' + qq.deal + '</span></div>' +
            '<div class="faint" style="font-size:11.5px;margin-top:4px;line-height:1.6">' +
            E(qq.fund) + ' · ' + amt(qq.amt) + ' ' + CCY + ' · 年化 ' + qq.rate.toFixed(2) + '%<br>' +
            '提交 ' + qq.at + ' ' + TZ_LABEL + ' · 终结 ' + qq.endAt + ' ' + TZ_LABEL +
            (qq.why ? '<br><b style="color:var(--muted)">拒绝原因</b>（对报价机构可见）：' + E(qq.why)
                    : '<br>系统事件，<b style="color:var(--muted)">无原因可填</b>，不计入拒绝率、不产生负面记录') +
            '</div></li>'; }).join('') + '</ul>' +
        '<p class="hint">已拒绝与已失效是<b>两个不同的终态</b>：拒绝是资产方的意思表示（有原因、对机构可见）；' +
        '失效是系统事件（无原因、不计入拒绝率）。两者对额度与项目的后果完全相同，' +
        '差别只在状态落点与有没有原因。编号保留但作废，不回收、不复用。</p></div>' : '') +
      '</div>'
    : '';

  /* ---- 左栏 4（WS-326 增量）：放款与融资确认的公开进度 ----
     公开字段：放款提交时间、放款币种与金额、确认时间、终止时间与原因（D-LN-06）。
     **不公开**：收款账户、凭证文件、交易哈希与链、盖章件、暂缓与重传原因——
     它们由服务端按归属过滤，不是前端隐藏（AC-LN-17 / AC-LS-100）。
     口径由 WS-326 权威产出，本页只读引用、不自行计算、不另存一份（AC-LS-105）。 */
  var fin = p.fin;
  /* 放款 / 确认 / 终止三类事件的公开字段进时间线（WS-326 分册 6.5.3）：
     已放款取放款提交时间、已确认取确认时间、已终止取终止时间与中性表述的原因。 */
  var FIN_EV = {
    accept   :{ t:'已接受报价 · 待放款', tone:'' },
    disb     :{ t:'已放款 · 待融资确认', tone:'' },
    fund     :{ t:'已确认到账 · 额度已原子转移', tone:'green' },
    terminate:{ t:'业务已终止 · 需求重回广场', tone:'gray' },
    /* WS-327 增量：还款事件**接着往这张时间线上续**，不另起一张。
       进时间线的只有公开字段（D-RP-41）：期次、应还日、应还本息与合计、期次状态、
       逾期标记与逾期天数、还款记录的提交时间与币种金额、结清时间。
       凭证、交易哈希与链、机构收款账户、还款与确认备注**不在其中**。 */
    plan     :{ t:'还款计划已定稿', tone:'' },
    repay    :{ t:'已提交还款记录 · 待还款确认', tone:'' },
    rconf    :{ t:'该期已结清', tone:'green' },
    odue     :{ t:'逾期标记（并行标记，非状态）', tone:'gray' },
    settle   :{ t:'业务已结清 · 终态', tone:'green' }
  };
  var finEv = (p.events || []).filter(function(e){ return FIN_EV[e.k]; });
  var finCard = (!fin && !finEv.length) ? '' :
    '<div class="card" style="margin-top:16px">' + cardHead('放款与融资确认',
      '<span class="faint">公开字段 · 口径由 WS-326 权威产出，本页只读引用</span>') +
    (!fin ? '' : '<div class="card-b"><div class="ls-kgrid">' +
      '<div><div class="k">融资业务编号</div><div class="v">' + fin.deal + '</div>' +
        '<div class="x">接受报价时生成，终身稳定</div></div>' +
      '<div><div class="k">业务状态</div><div class="v" style="font-family:var(--sans)">' +
        pill('', fin.st + ' ' + (FIN_ST[fin.st] || '')) + '</div>' +
        '<div class="x">' + (fin.st === 'S-FD-3'
          ? '等待资金方核验盖章件并放款；核验与处置动作不是状态（D-LN-01）'
          : '放款记录已提交，等待资产方确认到账') + '</div></div>' +
      '<div><div class="k">资金方</div><div class="v" style="font-family:var(--sans)">' + E(fin.fund) + '</div>' +
        '<div class="x">机构企业主体全称 · 公开字段</div></div>' +
      '<div><div class="k">融资金额</div><div class="v">' + amt(fin.amt) + '</div>' +
        '<div class="x">' + CCY + ' · 债务本金按此计，不按实收计</div></div>' +
      '<div><div class="k">结算币种与金额</div><div class="v">' + amt(fin.settle) + ' ' + fin.ccy + '</div>' +
        '<div class="x">按报价时锁定的汇率快照折算</div></div>' +
      '<div><div class="k">接受时间</div><div class="v">' + fin.acceptedAt + ' ' + TZ_LABEL + '</div>' +
        '<div class="x">报价有效期计时自此终止</div></div>' +
      (fin.st === 'S-FD-4' ?
        '<div><div class="k">放款提交时间 · LN-06</div><div class="v">' + fin.lnAt + ' ' + TZ_LABEL + '</div>' +
          '<div class="x">服务端时间，融资确认时限的起算点</div></div>' +
        '<div><div class="k">放款记录编号 · LN-01</div><div class="v">' + fin.lnId + '</div>' +
          '<div class="x">提交成功的同一时刻生成</div></div>' +
        '<div><div class="k">融资确认时限至 · FD-26</div><div class="v">' + fin.confirmTo + ' ' + TZ_LABEL + '</div>' +
          '<div class="x">＝ 放款提交时间 + 168 小时，只读、不可延长</div></div>' : '') +
    '</div>' +
    (fin.st === 'S-FD-4'
      ? CF.note('',
          '<b class="ls-b">融资确认时限届满不会自动确认、不会自动作废这笔业务</b>，也不会自动转移任何额度：' +
          '到期只发一条通知，业务仍是 S-FD-4，确认入口照常可用（WS-326 D-LN-03）。' +
          '<p>这与上面「在途报价」的 168 小时<b class="ls-b">不是同一个时限</b>：' +
          '报价有效期到点<b class="ls-b">自动失效</b>，融资确认时限到点<b class="ls-b">只提醒</b>。' +
          '两者措辞不同、不共用"有效期"三个字（D-LN-19）。</p>' +
          (own ? '<p>钱没到账或金额对不上？平台上<b class="ls-b">没有「提出异议」入口</b>，' +
                 '请先不要点确认，发邮件到 <b class="ls-b">{平台客服邮箱}</b> 并注明融资业务编号 ' + fin.deal +
                 '，走线下核实（WS-326 D-LN-34，本页是该入口的三处之一）。</p>' : ''),
          '关于融资确认时限')
      : CF.note('',
          '盖章件由<b class="ls-b">资金方在放款前核验</b>，平台不审核真伪与法律效力、不设平台侧审核态。' +
          '机构可以<b class="ls-b">暂不放款 / 要求重传盖章件 / 终止业务</b>（WS-326 DEP-14 的三个处置动作）。' +
          '<p><b class="ls-b">暂缓与重传的原因对资产方可见，但不进广场公开字段</b>——' +
          '它们是双方之间的商务沟通，公开等于把一方的商业判断对全市场广播（D-LN-06）。</p>',
          '当前这一步由谁在做什么')) +
    '<p class="hint" style="margin-top:12px"><b>不公开字段</b>（服务端过滤，不是前端隐藏）：' +
    '收款账户、转账凭证文件、交易哈希与链、盖章件及其历史版本、暂缓放款原因、要求重传原因。' +
    '游客与第三方资金方深链直达时，这些字段在接口响应里根本不存在（AC-LN-17）。</p>' +
    '</div>') +
    (finEv.length ? '<div class="card-b"' + (fin ? ' style="border-top:1px solid var(--border)"' : '') + '>' +
      '<h3 class="sec-title" style="font-size:12.5px;margin-bottom:10px">放款与确认时间线 · 公开字段</h3>' +
      '<ul class="tl">' + finEv.slice().reverse().map(function(e){
        var m = FIN_EV[e.k];
        return '<li><div style="font-size:12.5px">' + pill(m.tone, m.t) +
          '<span class="mono" style="margin-left:8px">' + e.d + '</span></div>' +
          '<div class="faint" style="font-size:11.5px;margin-top:4px;line-height:1.6">' + E(e.t) +
          (e.note ? '<br>' + E(e.note) : '') + '</div></li>';
      }).join('') + '</ul>' +
      '<p class="hint">进时间线的只有公开字段：<b>放款提交时间、放款币种与金额、确认时间、终止时间与原因</b>（中性表述）。' +
      '收款账户、凭证文件、交易哈希与盖章件不在其中（D-LN-06）。</p></div>' : '') +
    '</div>';

  /* ---- 左栏 5（WS-327 增量）：还款计划与还款进度的公开进度 ----
     公开字段：期次数与已结清期数、每期应还日、每期应还本息与合计（USD）、期次状态、
     逾期标记与逾期天数、结清时间、还款记录的提交时间与币种金额（D-RP-41）。
     **不公开**：还款凭证文件、交易哈希与链、机构收款账户快照、还款备注与补充材料、确认备注。
     口径由 WS-327 权威产出，本页只读引用、**不自行重算利息或逾期天数**（AC-LS-115）。 */
  var rep = p.rep;
  var repCard = !rep ? '' :
    '<div class="card" style="margin-top:16px">' + cardHead('还款计划与还款进度',
      '<span class="faint">公开字段 · 口径由 WS-327 权威产出，本页只读引用</span>') +
    '<div class="card-b"><div class="ls-kgrid">' +
      '<div><div class="k">融资业务编号</div><div class="v">' + rep.deal + '</div>' +
        '<div class="x">还款计划在融资确认完成的同一次结算内定稿</div></div>' +
      '<div><div class="k">已结清 / 总期数</div><div class="v">' + rep.done + ' / ' + rep.n + '</div>' +
        '<div class="x">先息后本 · 到期还本付息，利息每 3 个月一期</div></div>' +
      '<div><div class="k">起息日</div><div class="v">' + rep.t0 + '</div>' +
        '<div class="x">＝ 实际放款日（放款记录提交时间的日期部分）</div></div>' +
      '<div><div class="k">融资到期日</div><div class="v">' + rep.tn + '</div>' +
        '<div class="x">末期应还日恒等于本项，定稿时固化</div></div>' +
      '<div><div class="k">最近一笔应还</div><div class="v">' + (rep.nextDue || '—') + '</div>' +
        '<div class="x">' + (rep.nextDue ? '应还合计 ' + amt(rep.nextTotal) + ' ' + CCY : '无待还期次') + '</div></div>' +
      '<div><div class="k">未偿本金</div><div class="v">' + amt(rep.unpaidPri) + '</div>' +
        '<div class="x">' + CCY + ' · 它就是 项目融资余额 与 授信占用额 的被加数</div></div>' +
      (rep.overdueDays
        ? '<div><div class="k">逾期标记与逾期天数</div><div class="v">已逾期 ' + rep.overdueDays + ' 天</div>' +
          '<div class="x">第 ' + rep.overdueSeq + ' 期（应还日 ' + rep.overdueDue + '）· 每日 +1，提交即冻结</div></div>'
        : '<div><div class="k">逾期标记</div><div class="v" style="font-family:var(--sans)">无</div>' +
          '<div class="x">该业务当前没有带逾期标记的期次</div></div>') +
    '</div>' +
    '<div class="rows" style="box-shadow:none;margin-top:16px"><div class="row"><div class="row-main">' +
      '<div class="row-k">计息规则</div><div class="row-v mono" style="font-size:12px;color:var(--muted)">' +
      E(rep.rules) + '</div></div></div></div>' +
    (rep.overdueDays ? CF.note('',
      '<b class="ls-b">逾期是并行标记，不是状态。</b>该业务状态仍是 <b class="ls-b">S-FD-6 还款中</b>——' +
      '一笔业务可以同时「还款中」且「逾期」：三期里第一期逾期、第三期还没到期，' +
      '做成互斥状态会让状态与事实不符（D-FIN-09 / D-RP-35）。' +
      '<p>本期<b class="ls-b">只记逾期天数、不算罚息</b>，逾期<b class="ls-b">不触发任何自动处置</b>：' +
      '不处置质押代币、不强制平仓、不代偿、不提前到期（X-LS-45 / X-LS-46）。' +
      '<b class="ls-b">还本金本来就发生在融资项目到期之后</b>（X-LS-06），' +
      '项目「已到期 · 存量处理中」是常态路径，不是异常。</p>', '关于这个逾期标记') : '') +
    (rep.awaitConfirm ? CF.note('',
      '有一期<b class="ls-b">已提交还款记录、等待资金方确认</b>（还款计划编号 ' + rep.awaitConfirm + '）。' +
      '<b class="ls-b">还款确认时限</b>届满<b class="ls-b">不会自动确认、不会自动改状态、' +
      '不会自动递减任何额度</b>：到期只发一条通知（WS-327 D-RP-53）。' +
      '<p><b class="ls-b">资产方的逾期天数已在提交那一刻冻结</b>，' +
      '<b class="ls-b">不因机构迟迟不确认而继续增加</b>（D-FIN-11）。' +
      '本期<b class="ls-b">没有「提出异议」入口</b>：金额不符或款没到时，' +
      '请先不要点确认，发邮件到 <b class="ls-b">{平台客服邮箱}</b> 并注明融资业务编号 ' + rep.deal +
      ' 与还款计划编号 ' + rep.awaitConfirm + '，走线下核实——' +
      '本页是该入口的三处之一（D-RP-55）。</p>', '有一期正在等待还款确认') : '') +
    '<p class="hint" style="margin-top:12px"><b>不公开字段</b>（服务端过滤，不是前端隐藏）：' +
    '还款凭证文件、交易哈希与链、机构收款账户快照、还款备注与补充材料、确认备注。' +
    '游客与第三方深链直达时，这些字段在接口响应里根本不存在（AC-LS-110）。</p>' +
    '</div></div>';

  /* ---- 右栏：操作区（融资进度并入）---- */
  /* 主操作唯一：有在途报价时，资产方本人最该做的事是处理它（它带着一个会到期的倒计时）；
     担保不足时仍然先追加质押。其余沿用本模块原有的排序。 */
  var respondAct = actionOf(acts, 'respond');
  /* WS-326 增量：本方有一笔待确认到账的业务时，它比"再次发布"更该是主操作——
     它带着一个会到期的时限，而且不确认这笔业务就一直停在 S-FD-4。 */
  var confirmAct = actionOf(acts, 'confirm');
  var lead = own
    ? (d.grade === 'short' && actionOf(acts,'pledge') ? actionOf(acts,'pledge')
       : confirmAct ? confirmAct : respondAct ? respondAct : actionOf(acts,'publish'))
    : (actionOf(acts,'disburse') || actionOf(acts,'quote'));
  var risky = actionOf(acts, 'withdraw'), second = [];
  acts.forEach(function(a){ if(a !== lead && a.key !== 'withdraw') second.push(a); });
  var sameWhy = second.length > 1 && second.every(function(a){ return !a.enabled && a.reason === second[0].reason; });
  var rail = '<aside class="portal-rail">' + (own ? redeemBanner() : '') +
    (p.quote ? '<div class="card">' + cardHead('锁定信息', '<span class="faint">D-LS-13 · 公开字段</span>') +
      '<div class="card-b">' + lockCard(p, own) + '</div></div>' : '') +
    '<div class="card">' + cardHead('操作区', '<span class="faint">L6</span>') +
    '<div class="card-b ls-acts">' +
      (lead ? actBtn(lead, 'primary block') : '') +
      (second.length ? '<div class="sec">' + second.map(function(a){ return actBtn(a, 'block', sameWhy); }).join('') +
        (sameWhy ? whyLine(second[0].reason) : '') + '</div>' : '') +
      (risky ? '<div class="risky"><div class="rl">以下操作会减少池内担保，请先确认额度</div>' + actBtn(risky, 'danger block') + '</div>' : '') +
      '<p class="hint" style="margin-top:14px">置灰不构成校验。可执行动作清单由服务端每次读取时返回（available_actions），未登录或越权直接调用写接口一律在服务端拒绝。</p>' +
    '</div>' +
    '<div class="card-head" style="border-top:1px solid var(--border)"><b>融资进度</b>' +
      '<span style="margin-left:auto" class="faint">环节取自状态机 S-FP-1 ～ S-FP-6</span></div>' +
    '<div class="card-b">' + flowRail(p) + '</div>' +
    '<div class="card-b" style="border-top:1px solid var(--border);padding-top:12px">' +
      '<p class="hint">深链锚点 <span class="mono">project/' + p.id + '</span><br>' +
      '动作锚点 <span class="mono">?action=pledge / withdraw / publish / redeem</span><br>' +
      '报价与接受 / 拒绝由 WS-325 承载：<span class="mono">project/' + p.id + '?action=quote</span>、' +
      '<span class="mono">deal/{id}?action=respond_quote</span></p></div>' +
  '</div></aside>';

  /* ---- 两张图：两栏之下，页面最下方 ---- */
  var charts = '<div class="card" style="margin-top:16px">' + cardHead('池内资产与融资变动',
      '<span class="faint">口径与上方读数同源 · 单位 ' + CCY + '</span>') +
    '<div class="card-b">' + chartBlock(p,'pool') + chartBlock(p,'fin') + '</div></div>';

  return head + shortAlert(p, d, own) + usedUpNote(d) + readout +
    '<div class="portal-cols"><div>' + pledgeCard + quoteCard + finCard + repCard + demandCard + '</div>' + rail + '</div>' + charts;
}

/* ---- 图表外壳（几何与口径来自 Part A，逐行同源） ---- */
var chartQueue = [];
function chartBlock(p, kind){
  var d = derive(p), pts = d.pts, uid = kind + '-' + p.id.replace(/[^A-Za-z0-9]/g,'');
  chartQueue.push({ uid:uid, pts:pts, kind:kind });
  var isPool = kind === 'pool';
  var lg = isPool
    ? '<span><i class="s1"></i>有效质押价值（计入担保）</span><span><i class="void"></i>失效代币价值（不计入担保）</span><span><i class="dash"></i>池内资产总额</span>'
    : '<span><i class="ln"></i>融资上限（＝有效质押价值 × ' + (PLEDGE_RATE*100) + '%）</span><span><i class="s2"></i>项目融资余额</span>' +
      '<span><i class="s3"></i>项目在途金额</span><span><i class="gap"></i>担保不足区间</span>';
  var rd = isPool
    ? '蓝色是<b>参与计算</b>的部分，灰斜纹是<b>因底层应收账款失效而不计入担保</b>的部分，两者之和才是账面的池内资产总额。'
    : '面积顶到蓝线之间的空隙就是<b>可融金额</b>；<b>橙色面积高过蓝线的那一段就是担保不足</b>——判据只比项目融资余额，不含在途。';
  var tbl = '<div class="tablewrap" style="box-shadow:none"><table class="tbl"><thead><tr><th>日期</th>' +
    (isPool ? '<th class="num">有效质押价值</th><th class="num">失效代币价值</th><th class="num">池内资产总额</th>'
            : '<th class="num">融资上限</th><th class="num">项目融资余额</th><th class="num">项目在途金额</th><th class="num">可融金额</th>') +
    '<th>事件</th></tr></thead><tbody>' + pts.map(function(x){
      return '<tr><td class="num">' + x.d + '</td>' +
        (isPool ? '<td class="num">' + amt(x.valid) + '</td><td class="num">' + amt(x.dead) + '</td><td class="num">' + amt(x.total) + '</td>'
                : '<td class="num">' + amt(x.cap) + '</td><td class="num">' + amt(x.bal) + '</td><td class="num">' + amt(x.fly) + '</td><td class="num">' + amt(x.free) + '</td>') +
        '<td style="white-space:normal">' + (x.ev ? E(x.ev.t) : '当前（' + TODAY + '）') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  return '<div class="ls-chart"><h3>' + (isPool ? '池内资产变动' : '融资变动') + '</h3>' +
    '<p class="cd">' + (isPool ? '池子里有多少钱、其中多少还顶用' : '额度被什么消耗、还剩多少、什么时候跨过担保线') +
    '。刻度为压缩取整，精确值见悬浮读数与数据表。</p>' +
    '<div class="lg">' + lg + '</div>' +
    '<div class="ls-cw" id="wrap-' + uid + '"><div class="ls-tip"></div></div>' +
    '<p class="rd">读法：' + rd + '</p>' +
    fold('数据表 · ' + (isPool ? '池内资产' : '融资') + '逐时点数值', pts.length + ' 行', tbl) + '</div>';
}
function drawAll(){
  chartQueue.forEach(function(m){
    var w = q('#wrap-' + m.uid); if(!w) return;
    var W = Math.max(520, w.clientWidth);
    var built = (m.kind === 'pool') ? chartPool(m.uid, m.pts, W) : chartFin(m.uid, m.pts, W);
    var tip = w.querySelector('.ls-tip');
    w.innerHTML = '<svg class="ls-svg" width="' + W + '" height="' + CHART_H + '" role="img" aria-label="' +
      (m.kind === 'pool' ? '池内资产变动阶梯面积图' : '融资变动图') + '，精确数值见同卡片的数据表">' + built.svg +
      '<g class="cross" style="display:none"><line x1="0" y1="' + CH_M.t + '" x2="0" y2="' + (CHART_H - CH_M.b) +
      '" stroke="var(--faint)" stroke-width="1" stroke-dasharray="3 3"></line></g></svg>';
    w.appendChild(tip);
    attachHover('wrap-' + m.uid, m.pts, built, m.kind);
  });
}

/* ================================================================
   P-LS-03 建池与发布（两段式）/ P-LS-90 我的融资项目
   ================================================================ */
function stepsBar(step, p){
  function s(n, t, x, on, done){
    return '<div class="s" data-on="' + (on?1:0) + '" data-done="' + (done?1:0) + '">' +
      '<span class="n">' + (done ? '✓' : n) + '</span><span><b style="color:var(--text)">' + t + '</b>' +
      '<span class="faint" style="margin-left:7px">' + x + '</span></span></div>';
  }
  return '<div class="steps">' +
    s(1, '建池与质押', p ? '已完成 · 项目已持久化' : '填项目名 + 勾选至少一张可质押代币', step===1, !!p) +
    '<div class="ln"></div>' +
    s(2, '填写金额并发布', p && !p.draft ? '已发布' : '填融资需求金额，发布即占用额度', step===2, !!(p && !p.draft)) +
  '</div>';
}
function pagePublish(){
  if(S.role !== 'asset')
    return pageHead('建池与发布', '') + '<div class="card"><div class="tbl-empty"><b>无权访问</b>' +
      '建池与发布页只对资产方企业主体开放。当前身份为「' + E(ACTORS[S.role].full) + '」。' +
      '游客与资金方在广场与详情页可以看到 L1～L5 的全量信息，但本页属于本方数据，按企业主体做服务端归属过滤。' +
      '<div style="margin-top:14px"><button class="btn primary" type="button" data-act="go" data-v="P-LS-01">返回融资需求广场</button></div></div></div>';
  var p = S.pubPid ? findProject(S.pubPid) : null;
  if(p && p.entity !== ACTORS.asset.entity) { p = null; S.pubPid = null; }
  var step = p ? (S.pubStep || 2) : 1;
  var head = pageHead(p ? p.name : '创建融资项目',
    p ? '项目编号 ' + p.id + ' · ' + FP_STATUS[p.status].t + '（' + FP_STATUS[p.status].x + '）'
      : '两段式：先建池与质押，金额想好了再填再发布；中途可离开，随时回来续做。');
  return head + stepsBar(step, p) + (step === 1 || !p ? stepOne(p) : stepTwo(p));
}
function stepOne(p){
  if(p) return stepTwo(p);
  var sel = S.sel, picked = WALLET.filter(function(t){ return sel[t.id]; });
  var sum = picked.reduce(function(a,t){ return a + t.amt; }, 0);
  var nameOk = (S.pname || '').trim().length >= 1 && (S.pname || '').trim().length <= 60;
  var gas = gasEstimate(Math.max(1, picked.length));
  return (S.chain ? chainResult() : '') +
  '<div class="portal-cols"><div>' +
    '<div class="card"><div class="card-b">' +
      '<div class="field"><label>项目名称 <span class="faint">1～60 字符；同一企业内不要求唯一</span></label>' +
      '<input class="inp" type="text" maxlength="60" placeholder="例如：华东电子元件应收账款池" value="' + E(S.pname || '') +
      '" data-f="pname" data-act="ls.name"></div>' +
    '</div></div>' +
    '<div class="card" style="margin-top:16px">' + cardHead('代币质押',
      '<span class="faint">创建项目时必须至少质押一笔代币，"空池草稿"不能由创建动作产生</span>') +
    '<div class="card-b" style="padding-bottom:12px">' + CF.note('',
      '<strong class="ls-b">下列代币已按可质押条件筛选</strong>：① 签发状态为「已签发」；② 归属当前企业主体；③ 当前未被任何有效质押占用、且不在质押合约内（含"已释放待提取"的代币，须先提取才能再质押）；' +
      '④ 底层应收账款未失效；⑤ 代币类型为应收账款类（本期能力边界）；⑥ 与本项目已质押代币为同一类型（长期规则）。' +
      '<p>本期不支持按数量拆分，<strong class="ls-b">一张代币整张质押</strong>，以"张"为单位勾选，没有数量输入框。</p>') + '</div>' +
    '<div class="tablewrap" style="border:0;box-shadow:none;border-radius:0"><table class="tbl"><thead><tr>' +
      '<th style="width:40px"><input type="checkbox" ' + (picked.length === WALLET.length ? 'checked' : '') +
      ' data-act="ls.selAll" aria-label="批量勾选全部"></th><th>代币编号</th><th class="num">美元金额</th>' +
      '<th>底层账期</th><th>买方企业名</th><th>合同号 / 发票号</th><th>代币类型</th></tr></thead><tbody>' +
      WALLET.map(function(t){
        return '<tr><td><input type="checkbox" ' + (sel[t.id] ? 'checked' : '') + ' data-act="ls.sel" data-v="' + t.id +
          '" aria-label="勾选 ' + t.id + '"></td><td class="mono">' + t.id + '</td><td class="num">' + amt(t.amt) + '</td>' +
          '<td class="num">' + t.due + '</td><td>' + E(t.buyer) + '</td>' +
          '<td class="mono" style="font-size:11px">' + t.contract + ' / ' + t.invoice + '</td><td>应收账款类</td></tr>';
      }).join('') + '</tbody></table></div>' +
    '<div class="card-b"><div class="ls-pick"><span>已勾选 <span class="n">' + picked.length + '</span> 张</span>' +
      '<span class="sp"></span><span>合计 <span class="n">' + amt(sum) + '</span> ' + CCY + '</span>' +
      '<span class="sp"></span><span>提交成功后融资上限将增加 <span class="n">' + amt(round2(sum * PLEDGE_RATE)) + '</span> ' + CCY + '</span>' +
      '<span class="faint" style="margin-left:auto;font-size:11px">前端即时预览；提交时由服务端权威重算并校验，不一致以服务端为准</span></div></div>' +
    '</div></div>' +
    '<aside class="portal-rail"><div class="card">' + cardHead('费用与签名', '<span class="faint">链上转入质押合约</span>') +
      '<div class="card-b">' +
        '<div class="rows" style="box-shadow:none"><div class="row"><div class="row-main"><div class="row-k">本次链上操作笔数</div>' +
        '<div class="row-v mono">' + picked.length + ' 笔（合并为一次提交）</div></div></div>' +
        '<div class="row"><div class="row-main"><div class="row-k">预估 gas</div><div class="row-v mono">' + gas + ' ETH</div></div></div>' +
        '<div class="row"><div class="row-main"><div class="row-k">承担方</div><div class="row-v">' + E(ACTORS.asset.full) + '（本企业）</div></div></div></div>' +
        '<p class="hint" style="margin-top:10px">gas 由区块链收取，<strong class="ls-b">平台不代付、不垫付，也不对质押 / 撤回 / 提取收取任何服务费</strong>。' +
        '链上失败也可能已经产生费用。签名与付费由本页<b>唤起外部 SDK 服务</b>完成，平台不自建钱包连接组件。</p>' +
        '<button class="btn primary block" type="button" style="margin-top:14px" ' +
          (nameOk && picked.length ? '' : 'disabled ') + 'data-act="ls.create">创建项目并发起质押</button>' +
        (nameOk && picked.length ? '' : '<p class="hint">' + (!nameOk ? '请先填写项目名称（1～60 字符）。' : '未勾选任何一张代币时不可提交——创建项目时必须至少质押一笔。') + '</p>') +
      '</div></div>' +
      '<div class="card" style="margin-top:16px">' + cardHead('本段规则') + '<div class="card-b"><p class="hint">' +
        '· 创建校验的对象是<b>质押申请已提交</b>（链上「处理中」或「成功」均算通过），不要求等待链上确认完成。<br>' +
        '· 提交后项目落<b>草稿（已建池 · 未发布）</b>，对外完全不可见：不进广场、不可搜索、他人深链直达返回"内容不存在或无权访问"。<br>' +
        '· 第一段成功后项目即已持久化，可随时离开、随后从"我的融资项目"续做第二段，<b>不会要求重新质押或重新付一次 gas</b>。<br>' +
        '· 发布校验的对象才是链上事实：有效质押价值 &gt; 0 且融资需求金额 ≤ 可融金额。</p></div></div>' +
    '</aside></div>';
}
function stepTwo(p){
  var d = derive(p);
  var pub = actionOf(availableActions(p,'asset'), 'publish') || { enabled:false, reason:'' };
  var dead = p.tokens.filter(function(t){ return t.dead; }), live = p.tokens.filter(function(t){ return !t.dead; });
  var wsel = S.wsel, wLive = live.filter(function(t){ return wsel[t.id]; }).reduce(function(a,t){ return a+t.amt; },0);
  var wDead = dead.filter(function(t){ return wsel[t.id]; }).reduce(function(a,t){ return a+t.amt; },0);
  var over = wLive > d.wLimit;
  function wRow(t, limited){
    return '<tr><td><input type="checkbox" ' + (wsel[t.id]?'checked':'') + ' data-act="ls.wsel" data-v="' + t.id +
      '" aria-label="勾选 ' + t.id + '"></td><td class="mono">' + t.id + '</td><td class="num">' + amt(t.amt) + '</td>' +
      '<td class="num">' + t.due + '</td><td>' + E(t.buyer) + '</td>' +
      '<td>' + pill(TONE[CT_STATUS[t.ct].tone]||'gray', t.ct + ' ' + CT_STATUS[t.ct].t) + '</td>' +
      '<td>' + (limited ? pill('green','计入担保') : pill('amber','不计入 · ' + (t.deadAt||'') + ' 失效')) + '</td></tr>';
  }
  var H = '<thead><tr><th style="width:40px"></th><th>代币编号</th><th class="num">美元金额</th><th>底层账期</th>' +
          '<th>买方企业名</th><th>链上状态</th><th>是否计入担保</th></tr></thead>';
  var redSum = REDEEMABLE.reduce(function(a,t){ return a+t.amt; },0);

  return (p.emptyPool ? CF.note('red',
      '创建时那笔质押最终链上执行失败，项目与项目名称等准备工作已为您保留；空池只能由这条路径产生，不能由用户直接建出。' +
      '<p style="margin-top:8px"><button class="btn sm primary" type="button" data-act="ls.do" data-v="pledge">重新质押</button></p>',
      '本项目暂无有效质押，请重新质押后再发布') : '') +
    shortAlert(p, d, true) + usedUpNote(d) + (S.chain ? chainResult() : '') +
    '<div style="margin:18px 0 22px">' + trio(d) + meter(d) + '</div>' +
    '<div class="portal-cols"><div>' +
      '<div class="card">' + cardHead(p.draft ? '填写融资需求金额' : '融资需求',
        '<span class="faint">' + (p.draft ? '发布成功后按需求金额产生在途占用，这是项目在途金额的唯一来源' : '在「募集中」且尚未被报价时可修改金额或撤下需求') + '</span>') +
      '<div class="card-b"><div style="display:grid;grid-template-columns:minmax(0,1fr) 240px;gap:16px;align-items:start">' +
        '<div class="field"><label>融资需求金额（' + CCY + '）</label>' +
        '<input class="inp" type="text" inputmode="decimal" placeholder="0.00" value="' + E(S.amt || '') +
        '" data-f="damt" data-act="ls.amt"' + (p.emptyPool ? ' disabled' : '') + '>' +
        '<p class="hint">必填，大于 0 且不超过可融金额 ' + usd(d.free) + '。金额精度为 ' + CCY + ' 2 位小数。</p>' +
        (S.amtErr ? '<p class="err-msg"><span>!</span><span>' + S.amtErr + '</span></p>' : '') + '</div>' +
        '<div class="field"><label>有效期至</label><div class="ls-ro">' + (p.expiresAt || addYears(TODAY, TERM_YEARS)) + '</div>' +
        '<p class="hint">系统按首次发布日 + ' + TERM_YEARS + ' 年生成，只读、不可编辑、不可延期；再次发布不重置。</p></div>' +
      '</div>' +
      '<div style="margin-top:14px">' + (pub.enabled
        ? '<button class="btn primary" type="button" data-act="ls.publish">' + (p.draft ? '发布融资需求' : '再次发布剩余额度') + '</button>'
        : '<button class="btn blocked" type="button" aria-disabled="true" data-act="ls.why" data-v="publish">⊘ 发布融资需求</button>' + whyLine(pub.reason)) +
      '</div></div></div>' +

      '<div class="card" style="margin-top:16px">' + cardHead('已质押清单与撤回',
        '<span class="faint">两区分开：失效代币的撤回不做任何额度判定，有效抵押物受额度限制</span>') +
      (dead.length ? '<div class="card-b" style="padding-bottom:0"><h3 class="sec-title" style="font-size:12.5px;margin-bottom:0">' +
        '已失效 · 可随时撤回（不计入担保）· ' + dead.length + ' 张</h3></div>' +
        '<div class="tablewrap" style="border:0;box-shadow:none;border-radius:0"><table class="tbl">' + H + '<tbody>' +
        dead.map(function(t){ return wRow(t,false); }).join('') + '</tbody></table></div>' : '') +
      '<div class="card-b" style="padding-bottom:0"><h3 class="sec-title" style="font-size:12.5px;margin-bottom:0">' +
        '有效抵押物 · 受额度限制 · ' + live.length + ' 张<span class="faint" style="font-weight:400;margin-left:8px">' +
        '当前最多可撤回 <b class="mono">' + usd(d.wLimit) + '</b></span></h3></div>' +
      '<div class="tablewrap" style="border:0;box-shadow:none;border-radius:0"><table class="tbl">' + H + '<tbody>' +
        (live.length ? live.map(function(t){ return wRow(t,true); }).join('')
          : '<tr><td colspan="7" class="tbl-empty"><b>池内暂无有效抵押物</b></td></tr>') + '</tbody></table></div>' +
      '<div class="card-b"><div class="ls-pick' + (over ? ' bad' : '') + '">' +
        '<span>拟撤回（有效抵押物）<span class="n">' + amt(wLive) + '</span></span><span class="sp"></span>' +
        '<span>可撤回上限 <span class="n">' + amt(d.wLimit) + '</span></span><span class="sp"></span>' +
        '<span>差额 <span class="n">' + amt(Math.abs(d.wLimit - wLive)) + '</span>' + (over ? '（超出）' : '（尚余）') + '</span>' +
        (wDead ? '<span class="sp"></span><span>另含失效代币 <span class="n">' + amt(wDead) + '</span>（不受限制）</span>' : '') + '</div>' +
        (over ? '<p class="err-msg" style="margin-top:10px"><span>!</span><span><b>拟撤回价值超出可撤回上限，本次撤回不予放行。</b><br>' +
          '拟撤回价值 <span class="mono">' + usd(wLive) + '</span>；当前可撤回上限 <span class="mono">' + usd(d.wLimit) +
          '</span>；差额 <span class="mono">' + usd(wLive - d.wLimit) + '</span>。<br>' +
          '两条出路：① 减少勾选，把拟撤回价值压到 ' + usd(d.wLimit) + ' 以内；② 等待还款降低项目融资余额，可撤回上限会随之抬高。</span></p>' : '') +
        '<div class="btnbar"><button class="btn danger" type="button" ' + ((wLive+wDead)===0||over?'disabled':'') +
          ' data-act="ls.withdraw">撤回勾选的代币</button>' +
        '<button class="btn" type="button" data-act="ls.do" data-v="pledge">追加质押</button></div>' +
        '<p class="hint" style="margin-top:12px">撤回一进入链上「处理中」即<b>预扣</b>该部分价值（宁可低估不可高估），失败回滚才恢复；撤回不得先置「已释放」再回滚。' +
        '撤回与提取<b>不设硬性阻断</b>：24 小时内提交超过 5 次会提示"频繁链上操作会产生较多 gas"，但不阻断。</p>' +
      '</div></div>' +

      (S.panel === 'pledge' ? pledgePanel(p, d) : '') +
      (REDEEMABLE.length ? '<div class="card" style="margin-top:16px">' + cardHead('可提取代币',
        '<span class="faint">业务已释放，链上仍在质押合约内 · 待提取</span>') +
        '<div class="card-b" style="padding-bottom:12px">' + CF.note('',
          '您有 <strong class="ls-b">' + REDEEMABLE.length + ' 张</strong>代币（合计 <span class="mono">' + usd(redSum) + '</span>）可提取，需自付 gas，可批量一次提完，无时间限制、不过期。' +
          '<p>释放分两段：<b>第一段业务释放</b>在项目关闭 / 结清的同一时刻完成，即时、无链上动作、无费用；' +
          '<b>第二段链上提取</b>由您自助发起。未提取前代币不属于任何池、不计入任何质押价值，也不能被再次质押。</p>') + '</div>' +
        '<div class="tablewrap" style="border:0;box-shadow:none;border-radius:0"><table class="tbl"><thead><tr>' +
          '<th>代币编号</th><th class="num">美元金额</th><th>底层账期</th><th>来源项目</th><th>移出触发原因</th><th>质押状态</th>' +
        '</tr></thead><tbody>' + REDEEMABLE.map(function(t){
          return '<tr><td class="mono">' + t.id + '</td><td class="num">' + amt(t.amt) + '</td><td class="num">' + t.due +
            '</td><td class="mono">' + t.from + '</td><td>' + E(t.reason) + '</td><td>' + pill('gray','PS-4 已释放 · 待提取') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="card-b"><button class="btn primary" type="button" data-act="ls.do" data-v="redeem">批量提取全部 ' +
          REDEEMABLE.length + ' 张</button></div></div>' : '') +
    '</div>' +
    '<aside class="portal-rail"><div class="card">' + cardHead('当前派生量', '<span class="faint">与广场同源</span>') +
      '<div class="card-b"><div class="ls-kgrid" style="grid-template-columns:1fr 1fr">' +
      [['有效质押价值',amt(d.valid)],['融资上限',amt(d.cap)],['项目融资余额',amt(d.bal)],
       ['项目在途金额',amt(d.fly)],['可融金额',amt(d.free)],['可撤回上限',amt(d.wLimit)]].map(function(k){
        return '<div><div class="k">' + k[0] + '</div><div class="v">' + k[1] + '</div></div>'; }).join('') +
      '</div><div style="margin-top:14px">' + meter(d, true) + '</div></div></div></aside></div>';
}
function pledgePanel(p, d){
  var sel = S.sel, picked = WALLET.filter(function(t){ return sel[t.id]; });
  var sum = picked.reduce(function(a,t){ return a+t.amt; },0);
  return '<div class="card" style="margin-top:16px" id="panel-pledge">' + cardHead('追加质押',
    '<span class="faint">任何项目状态下都允许，池内资产只增不减地增强担保</span>') +
    '<div class="tablewrap" style="border:0;box-shadow:none;border-radius:0"><table class="tbl"><thead><tr>' +
      '<th style="width:40px"></th><th>代币编号</th><th class="num">美元金额</th><th>底层账期</th><th>买方企业名</th></tr></thead><tbody>' +
      (WALLET.length ? WALLET.map(function(t){
        return '<tr><td><input type="checkbox" ' + (sel[t.id]?'checked':'') + ' data-act="ls.sel" data-v="' + t.id + '"></td>' +
          '<td class="mono">' + t.id + '</td><td class="num">' + amt(t.amt) + '</td><td class="num">' + t.due + '</td><td>' + E(t.buyer) + '</td></tr>';
      }).join('') : '<tr><td colspan="5" class="tbl-empty"><b>暂无可质押代币</b>已释放的代币需先提取回自己地址才能再质押。</td></tr>') +
    '</tbody></table></div>' +
    '<div class="card-b"><div class="ls-pick"><span>已勾选 <span class="n">' + picked.length + '</span> 张</span>' +
      '<span class="sp"></span><span>合计 <span class="n">' + amt(sum) + '</span> ' + CCY + '</span>' +
      '<span class="sp"></span><span>融资上限将增加 <span class="n">' + amt(round2(sum * PLEDGE_RATE)) + '</span> ' + CCY +
      (d.gap ? '，本次追加后担保缺口 ' + (sum * PLEDGE_RATE >= d.gap ? '可解除' : '仍有 ' + amt(d.gap - sum*PLEDGE_RATE)) : '') + '</span></div>' +
      '<div class="btnbar"><button class="btn primary" type="button" ' + (picked.length?'':'disabled') +
      ' data-act="ls.addPledge">确认追加并发起质押</button>' +
      '<button class="btn" type="button" data-act="ls.closePanel">收起</button></div></div></div>';
}
function pageMine(){
  if(S.role !== 'asset')
    return pageHead('我的融资项目','') + '<div class="card"><div class="tbl-empty"><b>无权访问</b>本页只对资产方企业主体开放。</div></div>';
  var list = myProjects();
  return pageHead('我的融资项目',
    E(ACTORS.asset.full) + ' 名下的资产池。草稿项目只有本企业可见，不进广场、不可搜索、不可被深链直达。',
    '<button class="btn primary" type="button" data-act="ls.newProject">创建融资项目</button>') +
    redeemBanner() +
    '<div class="card" style="margin-top:16px">' + cardHead('融资项目', '<span class="faint">共 ' + list.length + ' 个</span>') +
    '<div class="tablewrap" style="border:0;box-shadow:none;border-radius:0"><table class="tbl"><thead><tr>' +
      '<th>项目名称</th><th>项目编号</th><th>状态 / 进度</th><th class="num">有效质押价值</th><th class="num">融资上限</th>' +
      '<th class="num">可融金额</th><th>担保状态</th><th class="num">有效期至</th><th class="col-act" style="text-align:right">操作</th>' +
    '</tr></thead><tbody>' + list.map(function(p){
      var d = derive(p);
      return '<tr><td class="cell-main">' + E(p.name) + '</td><td class="mono">' + p.id + '</td>' +
        '<td>' + pill(TONE[FP_STATUS[p.status].tone]||'gray', FP_STATUS[p.status].t) +
          (p.draft ? '<div class="cell-sub">' + (p.emptyPool ? '第 ① 段链上失败 · 空池草稿' : '第 ① 段已完成 · 待填金额') + '</div>' : '') +
          (p.expired ? '<div class="cell-sub">已到期 · 存量履约中</div>' : '') + '</td>' +
        '<td class="num">' + amt(d.valid) + '</td><td class="num">' + amt(d.cap) + '</td><td class="num">' + amt(d.free) + '</td>' +
        '<td>' + pill(gTone(d.grade), gradeMeta(d.grade).t) + '</td><td class="num">' + (p.expiresAt || '—') + '</td>' +
        '<td class="col-act" style="text-align:right">' +
          (p.draft ? '<button class="btn sm primary" type="button" data-act="ls.resume" data-v="' + p.id + '">继续发布</button>'
                   : '<button class="btn sm" type="button" data-act="ls.open" data-v="' + p.id + '">详情</button>') + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';
}

/* ================================================================
   链上结果页面态（分册 6.7.2 五类，不允许只写"操作失败"）
   ================================================================ */
function chainResult(){
  var r = S.chain, o = CHAIN_OUTCOMES[r.k];
  if(r.k === 'ok') return CF.note('green', '<strong class="ls-b">链上转入成功</strong>（CT-2）：' + r.n + ' 张代币已入池并计入有效质押价值。' +
    '<p>实际 gas ' + r.gas + ' ETH，同一次操作只记一次。</p>', '链上结果');
  if(r.k === 'partial') return CF.note('amber',
    '<strong class="ls-b">部分成功 · 按张独立结算</strong>：' + r.ok + ' 张入池成功（CT-2），' + r.bad + ' 张链上执行失败（CT-3）已退回可质押。' +
    '<p>失败原因：质押合约执行被回退。失败那 ' + r.bad + ' 张的 gas 已产生、不可退回；重试将发起新交易并再次产生 gas。' +
    '发布校验以实际成功入池后的服务端重算结果为准。</p>', '链上结果');
  if(r.k === 'timeout') return CF.note('amber', '<strong class="ls-b">' + o.head + '</strong><p>' + o.body + '</p>' +
    '<p>费用：' + o.fee + ' 该 ' + r.n + ' 张代币保持「处理中」，期间不接受新动作。</p>' +
    '<p style="margin-top:8px"><button class="btn sm" type="button" data-act="ls.query">查询链上状态</button>' +
    '<span class="faint" style="margin-left:10px">本状态下不提供重试按钮——查得未上链后，重试入口才会出现。</span></p>', '等待链上结果');
  return CF.note(o.tone === 'mute' ? '' : o.tone === 'warn' ? 'amber' : 'red',
    '<strong class="ls-b">' + o.head + '</strong><p>' + o.body + '</p><p>费用：' + o.fee + '</p>' +
    '<p style="margin-top:8px"><button class="btn sm" type="button" data-act="ls.retry">' + o.retry + '</button></p>', '链上结果');
}

/* ================================================================
   动作层：链上调用只发生在入池 / 撤回 / 提取三处（D-FIN-67）
   ================================================================ */
function doAction(key){
  var p = findProject(S.pid || S.pubPid);
  /* quote 与 respond 由 available_actions 带 href、以链接直达 WS-325 原型，不走这里 */
  if(key === 'publish'){ S.pubPid = p.id; S.pubStep = 2; S.panel = null; CF.go('P-LS-03'); return; }
  if(key === 'pledge'){  S.pubPid = p.id; S.pubStep = 2; S.panel = 'pledge'; S.sel = {}; CF.go('P-LS-03'); return; }
  if(key === 'withdraw'){S.pubPid = p.id; S.pubStep = 2; S.panel = null; CF.go('P-LS-03'); return; }
  if(key === 'redeem')   return openRedeem();
  if(key === 'close')    return openClose(p);
}
function openRedeem(){
  if(!REDEEMABLE.length) return toast('info', '当前没有可提取的代币。');
  var sum = REDEEMABLE.reduce(function(a,t){ return a+t.amt; },0);
  S.modal = { type:'chain', kind:'redeem', title:'批量提取已释放代币',
    rows:[['操作内容','将 ' + REDEEMABLE.length + ' 张代币从质押合约转回原持有地址'],
          ['合计价值', usd(sum)],
          ['来源','项目结清释放（业务释放已于结清同刻完成，无费用）']],
    n:REDEEMABLE.length, gas:gasEstimate(REDEEMABLE.length) };
  CF.render();
}
function openClose(p){ S.modal = { type:'close', id:p.id }; CF.render(); }

function finishChain(kind, outcome){
  var p = findProject(S.pubPid || S.pid);
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
      publishedAt:null, expiresAt:null, demand:null, quotes:0, assetType:'应收账款类', tokens:okT,
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
    S.sel = {}; S.pubPid = id; S.pubStep = 2;
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
        note:'池内资产只增不减地增强担保（D-FIN-48）' });
      var ids2 = take.map(function(t){ return t.id; });
      for(var j=WALLET.length-1;j>=0;j--) if(ids2.indexOf(WALLET[j].id) >= 0) WALLET.splice(j,1);
      S.chain = { k:outcome, n:take.length, ok:take.length, bad:ps.length-take.length, gas:gasEstimate(ps.length) };
    } else S.chain = { k:outcome, n:ps.length, gas:gasEstimate(ps.length) };
    S.sel = {}; S.panel = null;
    return;
  }
  if(kind === 'withdraw'){
    var sel2 = p.tokens.filter(function(t){ return S.wsel[t.id]; });
    if(outcome === 'cancel' || outcome === 'nogas'){ S.chain = { k:outcome }; return; }
    if(outcome === 'ok'){
      var live = sel2.filter(function(t){ return !t.dead; }), dd = sel2.filter(function(t){ return t.dead; });
      var ids3 = sel2.map(function(t){ return t.id; });
      p.tokens = p.tokens.filter(function(t){ return ids3.indexOf(t.id) < 0; });
      p.events.push({ d:TODAY, k:'withdraw',
        t:'撤回质押 ' + sel2.length + ' 张 · ' + usd(sel2.reduce(function(a,t){ return a+t.amt; },0)),
        dTotal:-sel2.reduce(function(a,t){ return a+t.amt; },0),
        dVoid:-dd.reduce(function(a,t){ return a+t.amt; },0),
        note:(dd.length ? '其中 ' + dd.length + ' 张为已失效代币，不做额度判定直接放行（D-FIN-59）；' : '') +
             '链上转出成功后代币移出池、派生量重算、回到可质押' });
      live.forEach(function(t){ t.ct = 'CT-0'; t.ps = 'PS-1'; WALLET.push(t); });
      S.chain = { k:'ok', n:sel2.length, gas:gasEstimate(sel2.length) };
    } else S.chain = { k:outcome, n:sel2.length, gas:gasEstimate(sel2.length) };
    S.wsel = {};
    return;
  }
  if(kind === 'redeem'){
    if(outcome === 'ok'){
      REDEEMABLE.forEach(function(t){ t.ct='CT-0'; t.ps='PS-1'; t.pending=false; WALLET.push(t); });
      REDEEMABLE.length = 0;
      toast('success', '提取成功', '代币已转回原持有地址，重新成为可质押代币。');
    } else S.chain = { k:outcome, n:REDEEMABLE.length };
  }
}

/* ================================================================
   模块装配
   ================================================================ */
var mod = {
  end:'asset', home:'P-LS-01',
  dict:{ en:{ navPlaza:'Marketplace', navMyProjects:'My projects' },
         zh:{ navPlaza:'融资需求广场', navMyProjects:'我的融资项目' } },
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
  state:function(){
    return { lang:'zh', role:'guest', pid:'FP-20260416-0007', pubPid:null, pubStep:1, panel:null,
             flt:JSON.parse(JSON.stringify(F0)), sel:{}, wsel:{}, pname:'', amt:'', amtErr:null, chain:null };
  },
  onBoot:function(st){ S = st; S.flt.sort = 'pub'; },
  /* 身份切换走顶栏上下文操作区（portal 规范 §3「语言/上下文操作分区」），
     不再自带底部演示条；数据状态切换走公共 stateBar。 */
  topExtra:function(){
    return '<div class="seg" role="group" aria-label="演示身份">' +
      ['guest','asset','fund'].map(function(k){
        return '<button type="button" data-act="ls.role" data-v="' + k + '" aria-pressed="' + (S.role===k) + '">' +
          ACTORS[k].t + '</button>'; }).join('') + '</div>';
  },
  content:function(){
    if(S.page === 'P-LS-02') return pageProject();
    if(S.page === 'P-LS-03') return pagePublish();
    if(S.page === 'P-LS-90') return pageMine();
    return pagePlaza();
  },
  modals:{
    chain:function(){
      var m = S.modal;
      return '<div class="mask" data-act="ls.mclose"><div class="modal" role="dialog" aria-modal="true">' +
        '<div class="modal-h"><b>' + E(m.title) + '</b>' +
        '<button class="modal-x" type="button" data-act="ls.mclose" aria-label="关闭">✕</button></div>' +
        '<div class="modal-b"><p class="lead" style="margin-top:0">唤起外部签名 SDK 前，请先确认本次链上操作的内容与费用。</p>' +
        '<div class="rows" style="box-shadow:none">' +
        m.rows.concat([['本次链上操作笔数', m.n + ' 笔'],['预估 gas', m.gas + ' ETH'],
                       ['承担方', ACTORS.asset.full + '（本企业）']]).map(function(r){
          return '<div class="row"><div class="row-main"><div class="row-k">' + E(r[0]) + '</div>' +
            '<div class="row-v">' + E(r[1]) + '</div></div></div>'; }).join('') + '</div>' +
        '<p class="hint">gas 由区块链收取，<strong class="ls-b">平台不代付、不垫付，也不对质押 / 撤回 / 提取收取任何服务费</strong>。' +
        '链上失败也可能已经产生费用。批量一次提交是最有效的降费手段：' + m.n + ' 笔已合并为一次提交。</p></div>' +
        '<div class="modal-f"><button class="btn" type="button" data-act="ls.mclose">取消</button>' +
        '<button class="btn primary" type="button" data-act="ls.sdk">确认并唤起签名</button></div></div></div>';
    },
    sdk:function(){
      var m = S.modal;
      return '<div class="mask"><div class="ls-sdk" role="dialog" aria-modal="true" aria-label="外部签名 SDK">' +
        '<div class="h"><span>◈</span><b>外部签名 SDK 服务</b><span>第三方界面 · 非平台页面</span></div>' +
        '<div class="b">' + m.rows.map(function(r){
          return '<div class="kk"><s>' + E(r[0]) + '</s><b>' + E(r[1]) + '</b></div>'; }).join('') +
          '<div class="kk"><s>预估 gas</s><b>' + m.gas + ' ETH</b></div>' +
          '<div class="kk"><s>承担方</s><b>' + E(ACTORS.asset.full) + '</b></div></div>' +
        '<div class="sim">原型内的结果模拟：选择本次链上返回，用于走通分册 6.7.2 的五类失败与等待页面态' +
        '<select data-f="sdkOut" id="sdkOut">' +
          '<option value="ok">全部成功（CT-2）</option><option value="partial">部分成功 · 按张独立结算（E-2）</option>' +
          '<option value="offchain">未上链失败 · 未扣费</option><option value="onchain">已上链失败 · 已扣费</option>' +
          '<option value="timeout">超时未决（&gt; ' + CHAIN_TIMEOUT + ' 分钟）</option><option value="nogas">gas 不足</option>' +
        '</select></div>' +
        '<div class="f"><button class="btn" type="button" data-act="ls.sdkCancel">取消</button>' +
        '<button class="btn primary" type="button" data-act="ls.sdkSign">签名并支付</button></div></div></div>';
    },
    close:function(){
      var p = findProject(S.modal.id);
      return '<div class="mask" data-act="ls.mclose"><div class="modal" role="dialog" aria-modal="true">' +
        '<div class="modal-h"><b>关闭融资项目</b><button class="modal-x" type="button" data-act="ls.mclose" aria-label="关闭">✕</button></div>' +
        '<div class="modal-b">' + CF.note('amber',
          '关闭后项目转「已关闭」，平台在同一时刻解除该池全部占用与担保关系，池内 ' + p.tokens.length + ' 张代币置「已释放 · 待提取」。' +
          '<p>业务释放<strong class="ls-b">即时、无链上动作、无费用</strong>；代币仍停留在质押合约内，需您自行发起提取并自付 gas，<strong class="ls-b">不会自动回到钱包</strong>。</p>') +
        '</div><div class="modal-f"><button class="btn" type="button" data-act="ls.mclose">取消</button>' +
        '<button class="btn primary" type="button" data-act="ls.closeOk">确认关闭</button></div></div></div>';
    }
  },
  hash:{
    build:function(){
      if(S.page === 'P-LS-02') return '#/project/' + (S.pid || '');
      if(S.page === 'P-LS-03') return S.pubPid ? '#/project/' + S.pubPid + '?action=' + (S.panel === 'pledge' ? 'pledge' : 'publish') : '#/project/new';
      if(S.page === 'P-LS-90') return '#/my-projects';
      return '#/plaza';
    },
    read:function(){
      var h = (location.hash || '').replace(/^#\/?/, ''); if(!h) return false;
      var parts = h.split('?'), seg = parts[0].split('/'), qs = {};
      (parts[1] || '').split('&').forEach(function(kv){ var i = kv.indexOf('='); if(i>0) qs[kv.slice(0,i)] = decodeURIComponent(kv.slice(i+1)); });
      if(seg[0] === 'plaza'){ S.page = 'P-LS-01'; S.st = 'default'; return true; }
      if(seg[0] === 'my-projects'){ S.page = 'P-LS-90'; S.st = 'default'; return true; }
      if(seg[0] === 'project'){
        if(seg[1] === 'new'){ S.page = 'P-LS-03'; S.pubPid = null; S.pubStep = 1; S.st = 'default'; return true; }
        var p = findProject(seg[1]);
        /* 状态已变或不存在：落详情页 + 说明，不报 404、不白屏、不静默跳首页（H-02） */
        if(!p){ S.page = 'P-LS-02'; S.pid = seg[1]; S.st = 'gone'; return true; }
        if(qs.action && qs.action !== 'quote'){
          S.page = 'P-LS-03'; S.pubPid = seg[1]; S.pubStep = 2;
          S.panel = qs.action === 'pledge' ? 'pledge' : null; S.st = 'default'; return true;
        }
        S.page = 'P-LS-02'; S.pid = seg[1]; S.st = 'default'; return true;
      }
      return false;
    }
  },
  onGo:function(){ S.chain = null; S.amtErr = null; },
  afterRender:function(){ drawAll(); },
  onAct:function(n, a, v){
    if(a.indexOf('ls.') !== 0) return false;
    var p = findProject(S.pid || S.pubPid);
    switch(a){
      case 'ls.role': S.role = v; if(S.page === 'P-LS-03' || S.page === 'P-LS-90'){ if(v !== 'asset') CF.go('P-LS-01'); else CF.render(); } else CF.render(); return true;
      case 'ls.flt':  if(v === 'sort') S.flt.sort = n.value; else S.flt[v] = n.value; CF.render(); return true;
      case 'ls.reset': S.flt = JSON.parse(JSON.stringify(F0)); S.flt.sort = 'pub'; CF.setState('default'); return true;
      case 'ls.open': S.pid = v; CF.go('P-LS-02'); return true;
      /* 跨文件链接：认领这次点击，好让它不再冒泡成整行的"进详情"（链接自己照常跳） */
      case 'ls.cross': return true;
      case 'ls.resume': S.pubPid = v; S.pubStep = 2; S.panel = null; CF.go('P-LS-03'); return true;
      case 'ls.newProject': S.pubPid = null; S.pubStep = 1; S.sel = {}; S.pname = ''; CF.go('P-LS-03'); return true;
      case 'ls.whyq': toast('info', '暂不可报价', actionOf(availableActions(findProject(v), S.role),'quote').reason); return true;
      case 'ls.why':  toast('info', '该操作当前不可用', (actionOf(availableActions(p, S.role), v) || {}).reason || ''); return true;
      case 'ls.signin': toast('info', '登录 / 注册', '登录流程不在本模块范围内（本原型用顶栏右上角的身份切换演示）。'); return true;
      case 'ls.do': doAction(v); return true;
      case 'ls.name': S.pname = n.value; CF.render(); return true;
      case 'ls.amt':  S.amt = n.value; S.amtErr = null; CF.render(); return true;
      case 'ls.sel':  S.sel[v] = !S.sel[v]; CF.render(); return true;
      case 'ls.selAll': WALLET.forEach(function(t){ S.sel[t.id] = n.checked; }); CF.render(); return true;
      case 'ls.wsel': S.wsel[v] = !S.wsel[v]; CF.render(); return true;
      case 'ls.closePanel': S.panel = null; S.sel = {}; CF.render(); return true;
      case 'ls.query': toast('info', '查询链上状态',
        '确认未上链后，重试入口才会出现——沿用 WS-318 S-TI-5 红线，超时态不得直接重试。'); return true;
      case 'ls.retry': S.chain = null; CF.render(); return true;
      case 'ls.mclose': if(n.classList.contains('mask') || n.classList.contains('modal-x') || n.tagName === 'BUTTON'){ S.modal = null; CF.render(); } return true;
      case 'ls.closeOk': S.modal = null; toast('info', '演示原型', '此处不真正改动演示数据。'); return true;
      case 'ls.create': {
        var sel = WALLET.filter(function(t){ return S.sel[t.id]; });
        if(!sel.length || !(S.pname||'').trim()) return true;
        S.modal = { type:'chain', kind:'create', title:'创建融资项目并发起首笔质押',
          rows:[['操作内容','将 ' + sel.length + ' 张代币转入质押合约'],
                ['项目名称', (S.pname||'').trim()],
                ['质押价值合计', usd(sel.reduce(function(a,t){ return a+t.amt; },0))]],
          n:sel.length, gas:gasEstimate(sel.length) };
        CF.render(); return true;
      }
      case 'ls.addPledge': {
        var ps = WALLET.filter(function(t){ return S.sel[t.id]; });
        if(!ps.length) return true;
        var s2 = ps.reduce(function(a,t){ return a+t.amt; },0);
        S.modal = { type:'chain', kind:'pledge', title:'追加质押',
          rows:[['操作内容','将 ' + ps.length + ' 张代币转入质押合约'],
                ['目标资产池', p.name + ' · ' + p.id],
                ['追加价值合计', usd(s2)],
                ['融资上限将增加', usd(round2(s2 * PLEDGE_RATE))]],
          n:ps.length, gas:gasEstimate(ps.length) };
        CF.render(); return true;
      }
      case 'ls.withdraw': {
        var sel3 = p.tokens.filter(function(t){ return S.wsel[t.id]; });
        if(!sel3.length) return true;
        var live = sel3.filter(function(t){ return !t.dead; }), dd = sel3.filter(function(t){ return t.dead; });
        var liveSum = live.reduce(function(a,t){ return a+t.amt; },0);
        if(liveSum > derive(p).wLimit){ CF.render(); return true; }
        S.modal = { type:'chain', kind:'withdraw', title:'撤回质押',
          rows:[['操作内容','将 ' + sel3.length + ' 张代币从质押合约转回原持有地址'],
                ['其中有效抵押物', live.length + ' 张 · ' + usd(liveSum)],
                ['其中已失效代币', dd.length + ' 张 · ' + usd(dd.reduce(function(a,t){ return a+t.amt; },0)) + '（不做额度判定）'],
                ['目的地址','质押前的原持有地址（不接受人工指定）']],
          n:sel3.length, gas:gasEstimate(sel3.length) };
        CF.render(); return true;
      }
      case 'ls.publish': {
        var d2 = derive(p), val = parseFloat(String(S.amt).replace(/,/g,''));
        if(!(val > 0)){ S.amtErr = '请填写有效的融资需求金额：必须大于 ' + usd(0) + '，精度为 ' + CCY + ' 2 位小数。'; CF.render(); return true; }
        val = round2(val);
        if(val > d2.free){
          var diff = round2(val - d2.free);
          S.amtErr = '<b>融资需求金额超出可融金额，发布校验不通过。</b><br>本次填写 <span class="mono">' + usd(val) +
            '</span>；当前可融金额 <span class="mono">' + usd(d2.free) + '</span>；差额 <span class="mono">' + usd(diff) + '</span>。<br>' +
            '两条出路：① 把需求金额下调到 ' + usd(d2.free) + ' 以内；② 追加质押抬高融资上限——需追加资产价值 <span class="mono">' +
            usd(round2(diff / PLEDGE_RATE)) + '</span>（＝差额 ÷ ' + (PLEDGE_RATE*100) + '%）。<br>' +
            '已完成的质押不会因为本次发布校验失败而回滚，代币照常在池、照常计入价值。';
          CF.render(); return true;
        }
        var first = !p.publishedAt;
        p.demand = val; p.status = 'S-FP-2'; p.draft = false;
        if(first){ p.publishedAt = TODAY; p.expiresAt = addYears(TODAY, TERM_YEARS); }
        p.events.push({ d:TODAY, k:'publish', t:(first?'发布':'再次发布') + '融资需求 ' + usd(val), dFly:val,
          note:'发布即产生在途占用，这是项目在途金额的唯一来源；报价环节不再新增占用（AC-FIN-23）' });
        S.amt = ''; S.amtErr = null; S.pid = p.id;
        toast('success', '发布成功',
          '项目转「募集中」，需求金额 ' + usd(val) + ' 已计入项目在途金额' +
          (first ? '，有效期至 ' + p.expiresAt + '（首次发布日 + 1 年，只读）' : '（有效期不重置）') + '。');
        CF.go('P-LS-02'); return true;
      }
      case 'ls.sdk': { S.modal = { type:'sdk', kind:S.modal.kind, rows:S.modal.rows, n:S.modal.n, gas:S.modal.gas }; CF.render(); return true; }
      case 'ls.sdkCancel': { var k1 = S.modal.kind; S.modal = null; finishChain(k1, 'cancel'); CF.render(); return true; }
      case 'ls.sdkSign': {
        var out = (q('#sdkOut') || {}).value || 'ok', k2 = S.modal.kind;
        S.modal = null; finishChain(k2, out); CF.render(); window.scrollTo(0,0); return true;
      }
    }
    return false;
  }
};
CF.define(mod);
CF.boot();

})();
