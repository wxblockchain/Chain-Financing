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
        note:'失效部分不计入有效质押价值；融资上限降至 480,000.00 USD，低于项目融资余额 500,000.00 USD，触发担保不足预警（E-9 / 6.4.1）' }
    ],
    terms:{ rate:'年化 6.80%（演示）', term:'180 天', repay:'到期一次性还本付息', use:'补充经营性流动资金' },
    deals:[
      { id:'FD-20260512-0044', amt:500000, st:'还款中', at:'2026-05-12', x:'放款并完成融资确认，计入项目融资余额' }
    ]
  },
  {
    id:'FP-20260812-0031', name:'华东电子元件应收账款池',
    owner:'晟远科技（演示）', entity:'E-ASSET-01',
    status:'S-FP-2', expired:false,
    publishedAt:'2026-08-14', expiresAt:'2027-08-14',
    demand:500000, quotes:0, assetType:'应收账款类',
    tokens:mkTokens({ total:1000000, n:3, seed:2, due:['2026-12-10','2027-01-25','2027-02-08'] }),
    events:[
      { d:'2026-08-12', k:'pledge',  t:'创建资产池 · 首笔质押 3 张', dTotal:1000000, note:'链上转入成功（CT-2）' },
      { d:'2026-08-14', k:'publish', t:'发布融资需求 500,000.00 USD', dFly:500000,  note:'项目在途金额 = 500,000.00 USD，可融金额 = 800,000 − 0 − 500,000 = 300,000.00 USD' }
    ],
    terms:{ rate:'年化 7.20%（演示）', term:'150 天', repay:'到期一次性还本付息', use:'原材料采购' },
    deals:[]
  },
  {
    id:'FP-20260820-0036', name:'华南汽配应收账款池',
    owner:'恒盛供应链（演示）', entity:'E-ASSET-09',
    status:'S-FP-3', expired:false,
    publishedAt:'2026-08-21', expiresAt:'2027-08-21',
    demand:600000, quotes:1, assetType:'应收账款类',
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
        note:'融资上限 500,000.00 = 项目融资余额 500,000.00，可融金额归零，进入「额度用尽」档；INV-FIN-01 仍成立，不预警（D-FIN-55）' }
    ],
    terms:{ rate:'年化 7.05%（演示）', term:'120 天', repay:'到期一次性还本付息', use:'渠道铺货' },
    deals:[ { id:'FD-20260726-0061', amt:500000, st:'还款中', at:'2026-07-26', x:'放款并完成融资确认' } ]
  },
  {
    id:'FP-20250916-0112', name:'西部能源设备应收账款池',
    owner:'瑞和能源装备（演示）', entity:'E-ASSET-06',
    status:'S-FP-2', expired:false,
    publishedAt:'2025-09-16', expiresAt:'2026-09-16',
    demand:200000, quotes:0, assetType:'应收账款类',
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
    demand:null, quotes:3, assetType:'应收账款类',
    tokens:mkTokens({ total:1500000, n:5, seed:6, due:['2026-11-30','2027-01-07','2026-12-12','2027-02-14','2026-10-28'] }),
    events:[
      { d:'2025-08-18', k:'pledge',  t:'创建资产池 · 首笔质押 5 张', dTotal:1500000 },
      { d:'2025-08-20', k:'publish', t:'发布融资需求 900,000.00 USD', dFly:900000 },
      { d:'2025-09-02', k:'quote',   t:'收到机构报价 900,000.00 USD' },
      { d:'2025-09-10', k:'fund',    t:'放款并完成融资确认', dFly:-900000, dBal:900000 },
      { d:'2026-08-20', k:'expire',  t:'有效期到期 · 存在未结清融资业务，项目不关闭',
        note:'转「已到期 · 存量处理中」并行标记：停止接受新报价、不允许再次发布，存量走完后转 S-FP-6 并释放质押（D-FIN-43 分支②，按正常状态呈现 D-FIN-47）' }
    ],
    terms:{ rate:'年化 6.60%（演示）', term:'360 天', repay:'到期一次性还本付息', use:'工程项目垫资' },
    deals:[ { id:'FD-20250910-0012', amt:900000, st:'已到期（存量履约中）', at:'2025-09-10', x:'本期无提前还款，还本发生在项目到期后（X-LS-06）' } ]
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

/* ---- 资产方钱包：可质押代币（已按 6.3.1 六条筛选后的结果） ---- */
var WALLET = mkTokens({ total:555000, n:6, seed:8,
  due:['2026-12-04','2027-01-22','2026-11-19','2027-02-27','2026-12-30','2027-03-15'] });
WALLET.forEach(function(t){ t.ct='CT-0'; t.ps='PS-1'; });

/* ---- 已释放 · 待提取代币（PS-4 + PL-18，来自已结清项目 FP-20251103-0021） ---- */
var REDEEMABLE = mkTokens({ total:280000, n:3, seed:9, due:['2026-10-08','2026-11-02','2026-12-13'] });
REDEEMABLE.forEach(function(t){ t.ps='PS-4'; t.pending=true; t.from='FP-20251103-0021'; t.reason='项目结清释放'; });

