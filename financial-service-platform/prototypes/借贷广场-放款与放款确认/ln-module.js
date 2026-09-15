/* ==========================================================================
   ln-module.js — 借贷广场 · 放款与放款确认（WS-326）原型 v2.0
   PRD 基线：v1.0-借贷广场-放款与放款确认-PRD.md V3.0 + 分册 01（cly-V1.0.0 / eac47e4）
   上游：WS-324 原型 v1.3（详情页三段式、术语表 G、EN 默认 D-LS-15）
         WS-325 原型 v1.3.1（承载单元抽屉 760px、提示走居中弹窗、同一时刻一层）

   v2.0 对 v1.0 的四处结构变化（09-15 裁定）：
     ① 两个承载单元由整页改为详情页操作区内的右侧抽屉 760px，不跳离详情页
     ② 核验区在 760 内左右分栏，同屏不折叠（AC-LN-03 的 760 解法，实测见 README §4）
     ③ 三个处置动作降到底部动作条次级位，原因在抽屉内就地展开（D-LN-55）
     ④ 界面文案默认英文、中文可切换；术语取 WS-324 v1.3 的 G 表 + 分册 7.3 新词，不自造

   本文件只写本模块的页面、文案、演示数据与状态。
   token / 公共组件 / 运行时 / 页面登记一律来自 _shared，不在此重建。
   ========================================================================== */
(function () {
"use strict";

var CF = window.CF, E = CF.esc, q = CF.q, toast = CF.toast, L = CF.L;
var S = null;

/* ================================================================
   Part A —— 术语、口径常量与演示数据
   ================================================================ */

/* ---- 术语表：键名沿用 WS-324 v1.3 的 G 表，新词取分册 7.3 第「中英术语」行 ----
   规则：本模块**不自造英文**。WS-324 已有的词按其 EN 原样引用；
   分册点名的十个新词在此落表，并在 README §3 附对照，供 PRD 回填。 */
var G = {
  /* —— 承接 WS-324 v1.3 —— */
  assetOwner   :['Asset owner','资产方'],
  funder       :['Funder','资金方'],
  guest        :['Guest','游客'],
  demandNo     :['Demand ID','需求编号'],
  project      :['Financing project','融资项目'],
  coverage     :['Pledge coverage status','质押覆盖状态'],
  covSufficient:['Ample','覆盖有余'],
  covUnder     :['Insufficient','覆盖不足'],
  coverageGap  :['Coverage gap','覆盖缺口'],
  cap          :['Borrowing cap','融资上限'],
  outstanding  :['Outstanding financing','项目融资余额'],
  committed    :['Committed demand','项目在途金额'],
  pledgedValue :['Pledged token value','有效质押价值'],
  signIn       :['Sign in','立即登录'],
  status       :['Status','状态'],
  stDemand     :['Financing demand','融资需求'],
  stQuote      :['Quote','融资报价'],
  stConfirm    :['Quote confirmation','报价确认'],
  stDisburse   :['Disbursement','融资放款'],
  /* —— 分册 7.3 点名的本模块新词（EN 以本轮产出为准，PRD 回填）—— */
  disbRecord   :['Disbursement record','放款记录'],
  transferProof:['Transfer receipt','放款凭证'],
  txHashLn     :['Transaction hash','交易哈希'],
  chain        :['Chain','链'],
  confirmReceipt:['Confirm receipt','确认到账'],
  confirmWindow:['Confirmation window','放款确认时限'],
  holdDisb     :['Hold disbursement','暂不放款'],
  askReupload  :['Request re-upload','要求重传盖章件'],
  terminate    :['Terminate deal','终止业务'],
  amountReceived:['Amount received','实收金额'],
  /* —— 本模块自用 —— */
  sealedContract:['Sealed contract','盖章件'],
  termsSummary :['Commercial terms','商务条款摘要'],
  disburse     :['Record disbursement','放款'],
  dealNo       :['Deal ID','融资业务编号'],
  reupload     :['Re-upload sealed contract','重传盖章件']
};
function g(k){ var v = G[k]; return v ? L(v[0], v[1]) : k; }

/* ---- 口径常量（分册 7.3） ---- */
var CCY = 'USD';
var CONFIRM_HOURS = 168;      /* 放款确认时限：168 小时，不可配置、不可延长、无宽限期 */
var NEAR_HOURS    = 24;       /* 临近提醒：提前 24 小时，只发一档 */
var REASON_MAX    = 200;      /* 处置原因 1～200 字 */
var MEMO_MAX      = 200;
var FILE_MAX_MB   = 10, FIAT_MIN_N = 1, FIAT_MAX_N = 5, EXTRA_MAX_N = 5;
var PLEDGE_RATE   = 0.8;
var NOW  = '2026-09-15 15:20';
var TZ   = 'UTC+8';
var MAIL = '{platform-support-mailbox}';   /* Q-LN-01 待业务方提供，占位常量 */
/* 链：本期**只有一条**，不是"默认一条"（D-LN-60，口径主体在主册 5.6）。
   界面上一律只展示、不给任何选择控件；USDT / USDC 本期即 ERC-20。
   区块浏览器取 ETH 固定前缀，不再由链字段推导（D-LN-63）。 */
var CHAIN = 'ETH';
var TOKEN_STD = 'ERC-20';
var EXPLORER_TX = 'https://etherscan.io/tx/';

/* ---- 演示主体：EN / ZH 成对，避免英文视图里漏中文 ---- */
var CO = {
  asset:['Shengyuan Technology (demo)','晟远科技（演示）'],
  fund :['Beian Leasing (demo)','北岸融资租赁（演示）'],
  opAsset:['Shengyuan Technology (demo) · Zhou Min','晟远科技（演示）· 周敏'],
  opFund :['Beian Leasing (demo) · Chen Li','北岸融资租赁（演示）· 陈立']
};
function co(k){ return L(CO[k][0], CO[k][1]); }

/* ---- 融资业务状态：展示名一律用新名「放款确认」，旧展示名全链路作废 ---- */
var FD_ST = {
  'S-FD-3' :[['Awaiting disbursement','待放款'],'info'],
  'S-FD-4' :[['Awaiting disbursement confirmation','待放款确认'],'info'],
  'S-FD-6' :[['Repaying','还款中'],'good'],
  'S-FD-10':[['Terminated','已终止'],'mute']
};
/* 融资需求对外状态：五值引用 WS-324 D-LS-18，本模块只驱动 放款中 → 已放款 */
var DEMAND_ST = {
  disb  :[['Disbursing','放款中'],''],
  funded:[['Disbursed','已放款'],'green'],
  open  :[['Awaiting quotes','待报价'],'amber'],
  ended :[['Void / closed','已失效／已关闭'],'gray']
};
var TONE = { mute:'gray', info:'', good:'green', warn:'amber', crit:'red' };

/* ---- 演示业务：一笔业务的若干切面。全部为演示数据 ---- */
function baseDeal(){
  return {
    fp:'FP-20260812-0031-03', id:'FD-20260908-0061',
    pid:'FP-20260812-0031', pname:['East China electronic components pool','华东电子元件应收账款池'],
    amt:500000, rate:7.20, ccy:'USD',
    quotedAt:'2026-09-08 14:20', acceptedAt:'2026-09-10 09:12',
    fx:{ v:1.0000, at:'2026-09-08 14:20', ver:'FX-20260908-T1420' },
    pool:{ valid:1000000, cap:800000, bal:0, fly:500000, tokens:3 },
    cr:{ limit:1200000, used:300000, fly:500000 },
    payeeFiat:{ name:'Shengyuan Technology Co., Ltd.', acct:'CNY62-4410-8827-0031',
                bank:'China Merchants Bank, Shanghai Branch', swift:'CMBCCNBS021',
                country:['Chinese mainland','中国大陆'] },
    payeeCoin:{ addr:'0x9C41Ab27Ee5d0B3f58Aa41E9d0c7B2Aa45E1c704' },
    /* 资金方登录时绑定的钱包地址（WS-315 D-F43：绑定后不可改）。
       它是**还款收款地址**，与上面那个"放款打给资产方"的地址是两回事。 */
    fundWallet:{ addr:'0x3A77Bc19Fd6e04C82b5D1147Aa90Ee37C1b6D852' },
    seals:[
      { n:['EastChina-financing-contract-sealed.pdf','华东电子元件-融资合同-双方盖章件.pdf'],
        s:'2.4 MB', at:'2026-09-10 09:10', by:'opAsset' },
      { n:['EastChina-financing-contract-sealed-rev2.pdf','华东电子元件-融资合同-盖章件-更正版.pdf'],
        s:'2.6 MB', at:'2026-09-12 11:26', by:'opAsset' }
    ],
    marks:{}, disp:[], st:'S-FD-3', expired:false, ln:null
  };
}
/* 状态 → 这一笔业务的切面。每个状态改的都是同一笔业务的少数几个字段。 */
var VARIANTS = {
  /* —— P-LS-07 放款 —— */
  fiat:      function(d){ return d; },
  coin:      function(d){ d.ccy = 'USDT'; return d; },
  short:     function(d){ d.pool.valid = 550000; d.pool.cap = 440000; return d; },
  reupload:  function(d){
    d.marks.redo = { at:'2026-09-14 17:24', by:'opFund',
      why:['The company seal on page 3 reads "Shengyuan Technology Services (demo)", which is not the asset owner of this deal. Please re-seal and upload again.',
           '盖章件第 3 页的公章为「晟远科技服务（演示）」，与本笔业务的资产方主体不一致，请核对后重新加盖并上传。'] };
    d.disp.push({ k:'redo', at:'2026-09-14 17:24', by:'opFund', why:d.marks.redo.why });
    return d; },
  onhold:    function(d){
    d.expired = true; d.expiresAt = '2026-09-12';
    d.marks.hold = { at:'2026-09-14 15:08', by:'opFund',
      why:['Clause 7 names a different remitting bank from the payout account confirmed on the platform. Under internal review; we will come back within the week.',
           '合同第 7 条的还款账户与贵司在平台上确认的收款账户不是同一个开户行，我方内部复核中，本周内给答复。'] };
    d.disp.push({ k:'hold', at:'2026-09-14 15:08', by:'opFund', why:d.marks.hold.why });
    return d; },
  disbursed: function(d){ return withLn(d, 'S-FD-4'); },
  terminated:function(d){
    d.st = 'S-FD-10';
    d.term = { at:'2026-09-14 16:40', by:'opFund',
      why:['The entity name on the contract does not match the entity registered on the platform, and no corrected copy was provided after two rounds of follow-up.',
           '合同主体名称与贵司在平台登记的企业主体不一致，且两次沟通后未能提供更正件。'] };
    d.disp.push({ k:'stop', at:'2026-09-14 16:40', by:'opFund', why:d.term.why });
    d.cr.fly = 0;
    return d; },
  /* —— P-LS-08 放款确认 —— */
  confirm:   function(d){ return withLn(d, 'S-FD-4'); },
  confirmCoin:function(d){ d.ccy = 'USDT'; return withLn(d, 'S-FD-4'); },
  soon:      function(d){ d = withLn(d, 'S-FD-4'); d.ln.at = '2026-09-09 04:40'; d.ln.given = '2026-09-09 03:10'; return d; },
  overdue:   function(d){ d = withLn(d, 'S-FD-4'); d.ln.at = '2026-09-05 09:00'; d.ln.given = '2026-09-04 16:40'; return d; },
  covDrop:   function(d){ d = withLn(d, 'S-FD-4'); d.pool.valid = 550000; d.pool.cap = 440000; return d; },
  confirmed: function(d){
    d = withLn(d, 'S-FD-6'); d.fd35 = '2026-09-14 10:12';
    d.pool.fly = 0; d.pool.bal = 500000; d.cr.fly = 0; d.cr.used = 800000;
    return d; }
};
function withLn(d, st){
  d.st = st;
  /* 演示口径：提交于 09-11 12:00 → 到期 09-18 12:00，相对演示"当前时刻"剩余 2 天 20 小时 */
  d.ln = { id:'LN20260911000002', at:'2026-09-11 12:00', given:'2026-09-11 10:30',
    files:[{ n:['wire-transfer-advice.pdf','电汇凭证-回单.pdf'], s:'0.7 MB' }],
    extra:[],
    hash:'0x7d41e6b9c2a05f38bd7c1140e9a83f62c5d0b7a41e93f6082cd514b7a6039e18',
    memo:['Remitted through our Shanghai branch. The outward remittance fee of CNY 260 and the cable charge of CNY 150 are borne by you; intermediary-bank deductions will show on credit.',
          '已通过上海分行电汇，汇出行手续费 260 元、电报费 150 元由贵司承担，中转行扣费以入账为准。'] };
  return d;
}
function deal(){
  var v = VARIANTS[S.variant] || VARIANTS.fiat;
  return v(baseDeal());
}

/* ================================================================
   Part B —— 格式化与派生量
   ================================================================ */
function amt(n){
  if(n === null || n === undefined) return '—';
  var neg = n < 0; n = Math.abs(n);
  var p = n.toFixed(2).split('.');
  return (neg ? '-' : '') + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + p[1];
}
function money(n, c){ return amt(n) + ' ' + c; }
function usd(n){ return amt(n) + ' ' + CCY; }
function round2(n){ return Math.round(n * 100) / 100; }
function tmin(s){
  var m = String(s).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000 : 0;
}
function tstr(mins){
  var d = new Date(mins * 60000), p = function(x){ return ('0' + x).slice(-2); };
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) +
         ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
}
function withTz(s){ return s ? s + ' ' + TZ : '—'; }
/* 时长：EN 与 ZH 的量词不同，分开拼，不做字符串拼接式"翻译" */
function dur(mins){
  if(mins <= 0) return L('0 min', '0 分');
  var d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), mi = Math.round(mins % 60);
  if(d > 0) return L(d + 'd ' + h + 'h', d + ' 天 ' + h + ' 小时');
  if(h > 0) return L(h + 'h ' + mi + 'm', h + ' 小时 ' + mi + ' 分');
  return L(mi + 'm', mi + ' 分');
}
function tr(pair){ return Array.isArray(pair) ? L(pair[0], pair[1]) : pair; }

/* 放款确认时限（FD-37 / FD-38 / FD-36）：起点恒取放款记录提交成功的服务端时间 LN-06 */
function clock(d){
  if(!d.ln) return { has:false };
  var from = tmin(d.ln.at), to = from + CONFIRM_HOURS * 60, now = tmin(NOW);
  var left = to - now;
  return { has:true, from:d.ln.at, to:tstr(to),
    heldMin:Math.min(now - from, CONFIRM_HOURS * 60),
    leftMin:Math.max(0, left), over:left <= 0, overMin:Math.max(0, -left),
    overDays:Math.floor(Math.max(0, -left) / 1440),
    soon:left > 0 && left <= NEAR_HOURS * 60 };
}
/* 质押覆盖闸门 INV-FIN-01：融资上限 ≥ 项目融资余额 + 项目在途金额（AC-FIN-12 放款前实时重算） */
function coverage(d){
  var p = d.pool, need = round2(p.bal + p.fly), gap = round2(need - p.cap);
  return { pass:gap <= 0, cap:p.cap, bal:p.bal, fly:p.fly, need:need,
           gap:Math.max(0, gap), addAsset:round2(Math.max(0, gap) / PLEDGE_RATE) };
}
function isFiat(d){ return d.ccy === CCY; }
function settle(d){ return isFiat(d) ? d.amt : round2(d.amt / 0.9994); }
function hashOk(v){ return /^0x[0-9a-fA-F]{64}$/.test(String(v || '').trim()); }

/* ================================================================
   available_actions（H-03 / AC-LS-128）
   服务端每次读取时返回可执行动作清单，前端按其渲染、不自行依据状态推断。
   未登录时操作区只出「立即登录」，不再逐动作 ⊘ + 独立原因（D-LN-47）。
   ================================================================ */
function actions(d){
  var out = [], role = S.role;
  if(role === 'guest') return out;                   /* 未登录：调用方只渲染 Sign in */
  var isFund  = (role === 'fund');
  var isAsset = (role === 'asset');
  var other   = (role === 'other');                  /* 登录但非本笔业务当事方：服务端不返回动作 */
  if(other) return out;
  var cv = coverage(d);
  if(d.st === 'S-FD-3' && isFund){
    var a = { key:'disburse', label:g('disburse'), enabled:cv.pass, reason:'' };
    if(!cv.pass) a.reason = L(
      'Pledge coverage is insufficient, so disbursement is on hold. Borrowing cap ' + amt(cv.cap) +
        ' is below outstanding financing ' + amt(cv.bal) + ' plus committed demand ' + amt(cv.fly) +
        ' = ' + amt(cv.need) + '. Coverage gap ' + usd(cv.gap) + '; the asset owner needs to add ' +
        usd(cv.addAsset) + ' of asset value. Disbursement reopens by itself once they do.',
      '该项目质押覆盖不足，暂不可放款：融资上限 ' + amt(cv.cap) + ' 低于项目融资余额 ' + amt(cv.bal) +
        ' ＋ 项目在途金额 ' + amt(cv.fly) + ' ＝ ' + amt(cv.need) + '，覆盖缺口 ' + usd(cv.gap) +
        '，需资产方追加资产价值 ' + usd(cv.addAsset) + '。补足后放款入口自动恢复，不要求您重新进入。');
    out.push(a);
    ['hold', 'redo', 'stop'].forEach(function(k){
      out.push({ key:k, enabled:true, label:g(k === 'hold' ? 'holdDisb' : k === 'redo' ? 'askReupload' : 'terminate') });
    });
  }
  if(d.st === 'S-FD-3' && isAsset && d.marks.redo)
    out.push({ key:'reupload', label:g('reupload'), enabled:true });
  if(d.st === 'S-FD-4' && isAsset)
    out.push({ key:'confirm', label:g('confirmReceipt'), enabled:true });
  return out;
}
function actionOf(list, k){ for(var i = 0; i < list.length; i++) if(list[i].key === k) return list[i]; return null; }


/* ================================================================
   Part C —— 共用片段
   ================================================================ */
function pill(tone, t){ return '<span class="pill ' + tone + '">' + E(t) + '</span>'; }
function stPill(d){ var m = FD_ST[d.st]; return pill(TONE[m[1]] || 'gray', L(m[0][0], m[0][1])); }
function why(title, body){
  return '<details class="why"><summary><span class="ca" aria-hidden="true">▶</span>' + E(title) +
    '</summary><div class="wb">' + body + '</div></details>';
}
function sec(title, cap, body, tint){
  return '<section class="u-sec' + (tint ? ' tint' : '') + '"><div class="sh"><b>' + E(title) + '</b>' +
    (cap ? '<span class="c">' + cap + '</span>' : '') + '</div>' + body + '</section>';
}
function field(label, opt, body, hint){
  return '<div class="field"><label>' + E(label) + (opt ? '<span class="opt">' + E(opt) + '</span>' : '') + '</label>' +
    body + (hint ? '<p class="hint">' + hint + '</p>' : '') + '</div>';
}
function ro(text){
  return '<div style="min-height:var(--ctrl-h);display:flex;align-items:center;padding:0 12px;' +
    'border:1px dashed var(--border-strong);border-radius:var(--radius-sm);background:var(--card-2);' +
    'font-family:var(--mono);color:var(--muted);font-size:12.5px">' + E(text) + '</div>';
}
function mark(tag, body){
  return '<div class="mark"><span class="tg">' + E(tag) + '</span><div class="bd">' + body + '</div></div>';
}
function maskAcct(s){ s = String(s || ''); return s.length <= 8 ? s : s.slice(0, 4) + '••••••' + s.slice(-4); }
function maskAddr(s){ s = String(s || ''); return s.length <= 16 ? s : s.slice(0, 10) + '…' + s.slice(-6); }
function lsHref(hash){
  var m = (CF.MODULES || {})['lending-marketplace'];
  return m ? '../' + m.dir + '/' + m.file + (hash || '') : '#';
}

/* ---- 商务条款摘要九项 + 需求编号（D-FIN-87 / D-LN-49）---- */
function termRows(d){
  return [
    [g('dealNo'), d.id, 1],
    [g('demandNo'), d.fp, 1],
    [L('Funder entity','资金方企业主体'), co('fund'), 1],
    [L('Asset owner entity','资产方企业主体'), co('asset'), 1],
    [L('Financing amount','融资金额'), money(d.amt, CCY), 0],
    [L('Settlement currency and amount','结算币种与金额'), money(settle(d), d.ccy), 0],
    [L('Annual rate','年化利率'), d.rate.toFixed(2) + '%', 0],
    [L('FX snapshot','汇率快照'), d.fx.v.toFixed(4) + ' · ' + d.fx.ver, 0],
    [L('Collateral','抵押物概况'), L(d.pool.tokens + ' receivables tokens · pledged value ' + usd(d.pool.valid),
        d.pool.tokens + ' 张应收账款类代币 · 有效质押价值 ' + usd(d.pool.valid)), 1],
    [L('Quote submitted at','报价提交时间'), withTz(d.quotedAt), 0],
    [L('Terms-consistency declaration','条款一致性声明'),
      L('Declared by the asset owner at ' + withTz(d.acceptedAt), '资产方已于 ' + withTz(d.acceptedAt) + ' 勾选'), 1]
  ];
}

/* ================================================================
   Part D —— 宿主：融资需求详情页（P-LS-02）
   抽屉开在这一层之上。本页按 WS-324 v1.3 详情页的结构承载本模块要用到的部分：
   页头 + 融资信息清单 + 质押与覆盖 + 三段式操作区（第 ② 段四环节）。
   ⚠️ 真实系统里这一层就是 WS-324 的 P-LS-02，本文件只是把同一页在本模块内可运行地重绘，
      以便抽屉有真实的"下面那一层"；WS-324 的 P-LS-01 / P-LS-02 增量已在其模块文件内落地。
   ================================================================ */
var FLOW4 = [
  ['stDemand',   ['The asset owner publishes the demand. Publishing is the only thing that creates committed demand.',
                  '资产方发布融资需求。发布即产生在途占用，这是项目在途金额的唯一来源。']],
  ['stQuote',    ['A funder submits a quote; the quote locks this demand for 168 hours.',
                  '资金方提交报价，报价将该需求锁定 168 小时。']],
  ['stConfirm',  ['The asset owner accepts or rejects the quote. Rejecting returns the demand to the quote stage.',
                  '资产方接受或拒绝报价。拒绝后需求退回融资报价环节。']],
  ['stDisburse', ['The funder checks the sealed contract and disburses; the asset owner confirms receipt. This ends the flow.',
                  '资金方核验盖章件后放款，资产方确认到账，本流程结束。']]
];
function demandState(d){
  if(d.st === 'S-FD-6') return DEMAND_ST.funded;
  if(d.st === 'S-FD-10') return DEMAND_ST.open;      /* 终止 → 需求退回待报价（D-LN-45 建议口径） */
  return DEMAND_ST.disb;
}
function hostPage(){
  var d = deal(), cv = coverage(d), acts = actions(d), ds = demandState(d);
  var head = '<div class="ls-phead"><div class="tile" aria-hidden="true">◎</div><div class="body">' +
    '<p class="kick">' + g('demandNo') + ' <span class="mono">' + d.fp + '</span> · ' +
      g('project') + ' <span class="mono">' + d.pid + '</span> · ' + L('Time zone','时区') + ' ' + TZ + '</p>' +
    '<h1>' + E(tr(d.pname)) + '<em>' + E(co('asset')) + '</em></h1>' +
    '<div class="ls-tags">' + pill(ds[1], L(ds[0][0], ds[0][1])) + stPill(d) +
      pill('gray', g('funder') + ' · ' + co('fund')) +
      pill('gray', g('dealNo') + ' ' + d.id) +
      (d.marks.redo ? pill('gray', L('Awaiting re-upload','待资产方重传盖章件')) : '') +
      (d.marks.hold ? pill('gray', L('Disbursement on hold','已暂缓放款')) : '') +
      (d.expired ? pill('gray', L('Matured · performing','已到期 · 存量处理中')) : '') +
    '</div></div>' +
    '<div class="amt"><div class="k">' + L('Financing amount','融资金额') + '</div>' +
    '<div class="v">' + amt(d.amt) + '<span class="cy">' + CCY + '</span></div>' +
    '<div class="x">' + L('APR','年化') + ' ' + d.rate.toFixed(2) + '% · ' +
      L('accepted ','接受于 ') + d.acceptedAt + '</div></div></div>';

  var listCard = '<div class="card"><div class="card-head"><b>' +
    L('Financing demands','融资信息清单') + '</b><span style="margin-left:auto" class="faint">' +
    L('one row = one demand','一行 = 一笔融资需求') + '</span></div>' +
    '<div class="card-b"><div class="tablewrap" style="box-shadow:none"><table class="tbl"><thead><tr>' +
    '<th>' + g('demandNo') + '</th><th class="num">' + L('Amount','需求金额') + '</th>' +
    '<th>' + g('status') + '</th><th>' + g('funder') + '</th><th class="num">' + L('Published','发布时间') + '</th>' +
    '</tr></thead><tbody>' +
    '<tr><td class="mono">' + d.fp + '</td><td class="num">' + amt(d.amt) + '</td>' +
    '<td>' + pill(ds[1], L(ds[0][0], ds[0][1])) +
      (d.st === 'S-FD-10' ? '<div class="cell-sub">' + L('back on the marketplace after termination','业务终止后重回广场') + '</div>' : '') +
      '</td><td>' + (d.st === 'S-FD-10' ? '<span class="faint">—</span>' : E(co('fund'))) +
      '</td><td class="num">2026-09-05</td></tr>' +
    '<tr><td class="mono">FP-20260812-0031-02</td><td class="num">300,000.00</td>' +
    '<td>' + pill('gray', L(DEMAND_ST.ended[0][0], DEMAND_ST.ended[0][1])) +
    '<div class="cell-sub">' + L('auto-voided · insufficient coverage','自动失效 · 覆盖不足') + '</div></td>' +
    '<td class="faint">—</td><td class="num">2026-07-18</td></tr>' +
    '</tbody></table></div></div></div>';

  var poolCard = '<div class="card" style="margin-top:16px"><div class="card-head"><b>' +
    L('Pledge and coverage','质押与覆盖') + '</b><span style="margin-left:auto" class="faint">' +
    L('current values','当前值') + '</span></div><div class="card-b"><div class="ls-kgrid">' +
    '<div><div class="k">' + g('pledgedValue') + '</div><div class="v">' + amt(d.pool.valid) + '</div>' +
      '<div class="x">' + L('tokens whose underlying receivable has lapsed are excluded','已排除底层失效的代币') + '</div></div>' +
    '<div><div class="k">' + g('cap') + '</div><div class="v">' + amt(d.pool.cap) + '</div>' +
      '<div class="x">× ' + L('pledge rate','质押率') + ' 80%</div></div>' +
    '<div><div class="k">' + g('committed') + '</div><div class="v">' + amt(d.pool.fly) + '</div>' +
      '<div class="x">' + (d.st === 'S-FD-6'
        ? L('moved to outstanding financing on confirmation','已随确认转入项目融资余额')
        : L('moves to outstanding financing once this deal is confirmed','本笔业务确认完成后转出')) + '</div></div>' +
    '<div><div class="k">' + g('outstanding') + '</div><div class="v">' + amt(d.pool.bal) + '</div>' +
      '<div class="x">' + (d.st === 'S-FD-6' ? L('recognised at confirmation','确认完成时计入')
        : L('recognised only at confirmation','确认完成后才计入')) + '</div></div>' +
    '<div><div class="k">' + g('coverage') + '</div><div class="v txt">' +
      (cv.pass ? pill('green', g('covSufficient')) : pill('red', g('covUnder'))) + '</div>' +
      '<div class="x">' + amt(cv.cap) + (cv.pass ? ' ≥ ' : ' &lt; ') + amt(cv.need) +
      (cv.pass ? '' : ' · ' + g('coverageGap') + ' ' + amt(cv.gap)) + '</div></div>' +
    '</div></div></div>';

  /* ---- 三段式操作区的第 ② 段：融资流程四环节。只有当前环节出按钮（D-LN-50） ---- */
  var stage = 3;
  var flow = FLOW4.map(function(f, i){
    var cls = i < stage ? 'done' : i === stage ? 'now' : 'next';
    var btn = '';
    if(i === stage) btn = stageActions(d, acts);
    return '<div class="fs ' + cls + '"><div class="t"><span class="no">' + (i + 1) + '</span>' + g(f[0]) +
      (i === stage ? ' · ' + L('current','当前') : '') + '</div>' +
      '<div class="x">' + E(L(f[1][0], f[1][1])) + '</div>' + btn + '</div>';
  }).join('');

  var rail = '<aside class="portal-rail"><div class="card">' +
    '<div class="card-head"><b>' + L('Actions','操作区') + '</b>' +
    '<span style="margin-left:auto" class="faint">' + L('financing flow · 4 stages','融资流程四环节') + '</span></div>' +
    '<div class="card-b"><div class="ls-flow4">' + flow + '</div></div>' +
    (S.role === 'guest' ? '' :
      '<div class="card-b" style="border-top:1px solid var(--border)">' + notifBlock(d) + '</div>') +
    '<div class="card-b" style="border-top:1px solid var(--border)"><p class="hint">' +
      L('Deep links land on this page and open the matching drawer; closing the drawer keeps you here.',
        '深链落到本页并打开对应抽屉；关掉抽屉就停在这一页，不返回、不跳走。') +
      '<br><span class="mono">deal/' + d.id + '?action=disburse</span>' +
      '<br><span class="mono">deal/' + d.id + '?action=confirm_disbursement</span>' +
      '<br><span class="mono">deal/' + d.id + '?action=reupload_contract</span></p></div></div></aside>';

  return CF.pageStates() + head + '<div class="portal-cols"><div>' + listCard + poolCard + '</div>' + rail + '</div>';
}
/* 当前环节的按钮：未登录只出「立即登录」（D-LN-47）；非当事方按 available_actions 不返回动作 */
function stageActions(d, acts){
  if(S.role === 'guest')
    return '<div class="fa"><button class="btn sm primary" type="button" data-act="ln.signin">' +
      g('signIn') + '</button><p class="hint" style="margin:6px 0 0">' +
      L('Public terms stay visible without signing in; only the actions need an account.',
        '公开商务条款不登录也看得到；需要账号的只是操作。') + '</p></div>';
  if(!acts.length)
    return '<div class="fa"><p class="hint" style="margin:0">' +
      (S.role === 'other'
        ? L('This deal belongs to another asset owner and funder. No action is returned for your entity, and the counterparty-only fields are filtered server-side.',
            '本笔业务属于另一对资产方与资金方。服务端不为当前主体返回任何动作，仅双方可见的字段也不在响应里。')
        : d.st === 'S-FD-6'
          ? L('This deal has been confirmed; the repayment schedule is generated by the repayment module.',
              '本笔业务已确认到账，还款计划由还款模块生成。')
          : d.st === 'S-FD-10'
            ? L('This deal was terminated. The demand is back on the marketplace and any funder may quote again.',
                '本笔业务已终止。该需求已退回广场，可被任何机构重新报价。')
            : L('This stage is taken by the other party; your current role cannot act here.',
                '该环节由对方操作，当前身份不能在此动作。')) + '</p></div>';
  var main = actionOf(acts, 'disburse') || actionOf(acts, 'confirm') || actionOf(acts, 'reupload');
  if(!main) return '';
  var key = main.key === 'disburse' ? 'disb' : main.key === 'confirm' ? 'confirm' : 'redo';
  if(main.enabled)
    return '<div class="fa"><button class="btn sm primary" type="button" data-act="ln.open" data-v="' + key + '">' +
      E(main.label) + '</button></div>';
  /* 覆盖不足：主按钮 ⊘ + 原因内联在原位，但抽屉照常可开——三个处置动作在里面（AC-LN-08） */
  return '<div class="fa"><button class="btn sm blocked" type="button" aria-disabled="true" ' +
    'data-act="ln.why" data-v="cov">⊘ ' + E(main.label) + '</button>' +
    '<button class="btn sm" type="button" data-act="ln.open" data-v="disb">' +
    L('Open disbursement drawer','打开放款抽屉') + '</button>' +
    '<div class="ls-why"><span class="sg" aria-hidden="true">⊘</span><span>' + E(main.reason) + '</span></div></div>';
}
/* 本模块产生的触达（分册 10.4 的六条，按收件人视角写，不印 biz_type） */
function notifBlock(d){
  var rows = [
    ['asset', L('Funds have been sent','款项已汇出'),
      L('Sent to you when the funder submits the disbursement record; the ' + CONFIRM_HOURS + '-hour confirmation window starts at that moment.',
        '资金方提交放款记录时发给您；' + CONFIRM_HOURS + ' 小时确认时限从那一刻开始计时。')],
    ['asset', L('Confirmation window closing','确认时限临近'),
      L('One reminder, ' + NEAR_HOURS + ' hours before the window closes. One reminder only.',
        '到期前 ' + NEAR_HOURS + ' 小时发一条，只发一档。')],
    ['both', L('Confirmation window elapsed','确认时限已过'),
      L('Both sides get one notice. Nothing changes state — it carries the support mailbox and both IDs.',
        '双方各收到一条。它不改变任何状态，正文带客服邮箱与两个编号。')],
    ['fund', L('Receipt confirmed','已确认到账'),
      L('Sent to the funder once the asset owner confirms; the repayment schedule is then generated.',
        '资产方确认后发给资金方；还款计划随即生成。')],
    ['asset', L('Re-upload requested','要求重传盖章件'),
      L('Sent each time the funder asks for a re-upload, with the reason.',
        '机构每要求一次重传就发一条，带原因。')],
    ['asset', L('Deal terminated','业务已终止'),
      L('Carries the termination reason; the demand returns to the marketplace.',
        '带终止原因；需求退回广场。')]
  ];
  return '<div class="notif"><div class="card-head" style="padding:0 0 9px 0"><b style="font-size:13px">' +
    L('Notifications this deal triggers','本笔业务会触发的通知') + '</b></div>' +
    rows.map(function(r){
      var who = r[0] === 'asset' ? g('assetOwner') : r[0] === 'fund' ? g('funder') : L('Both sides','双方');
      return '<div class="n"><span class="who">' + E(who) + '</span><div class="bd"><b>' + E(r[1]) + '</b>' + r[2] + '</div></div>';
    }).join('') +
    '<p class="hint" style="margin-top:9px">' +
    L('Nothing else is pushed. A hold on disbursement is not pushed at all — the reason sits on this page instead.',
      '除此之外不推送。「暂不放款」完全不推——原因常驻在本页上，推送只会制造一个对方无法处置的焦虑。') + '</p></div>';
}


/* ================================================================
   Part E —— 承载单元一：放款抽屉 P-LS-07（资金方）
   760px 内三件事：核验（左右分栏同屏）、填放款记录、三个处置动作（底部次级位）。
   ================================================================ */
/* 盖章件占位：按真实 PDF 的比例排版再整体缩放。三档缩放 × 两档配比，
   两栏各自滚动、都不折叠——AC-LN-03 在 760 内的解法。 */
function paper(d){
  var z = { fit:0.44, '100':1, '150':1.5 }[S.zoom] || 0.44;
  var wide = (S.split === 'doc');
  var scale = wide ? z * 1.22 : z;
  return '<div class="paper" style="zoom:' + scale.toFixed(3) + '"><div class="pp">' +
    '<h4>' + L('FINANCING CONTRACT','融资合同') + '</h4>' +
    [[L('Contract no.','合同编号'), 'HT-2026-0912-031'],
     [L('Lender (funder)','出借方（资金方）'), co('fund')],
     [L('Borrower (asset owner)','借款方（资产方）'), co('asset')],
     [L('Financing amount','融资金额'), 'USD 500,000.00'],
     [L('Annual rate','年化利率'), '7.20%'],
     [L('Settlement currency','结算币种'), isFiat(d) ? 'USD' : 'USDT (' + TOKEN_STD + ')'],
     [L('Term','融资期限'), L('150 days','150 天')]
    ].map(function(r){ return '<div class="row"><span>' + E(r[0]) + '</span><b>' + E(r[1]) + '</b></div>'; }).join('') +
    '<p>' + L('Clause 7 — Disbursement: the lender shall remit the financing amount to the account designated by the borrower after this contract is signed and sealed by both parties. Intermediary-bank charges and receiving-bank fees arising from the cross-border remittance are borne by the borrower.',
      '第七条　放款：出借方应在本合同签署并经双方盖章确认后，按上述融资金额向借款方指定账户汇出款项；跨境汇款产生的中间行手续费、收款行入账费由借款方承担。') + '</p>' +
    '<p>' + L('Clause 9 — Repayment: the borrower shall repay principal and interest calculated on the financing amount in a single payment after the financing project matures.',
      '第九条　还款：借款方应按融资金额计算的本金与利息，于融资项目到期后一次性偿还。') + '</p>' +
    '<div class="seal"><div class="st">' + L('Shengyuan<br>contract seal','晟远科技<br>合同专用章') + '</div>' +
    '<div class="st">' + L('Beian Leasing<br>contract seal','北岸融资租赁<br>合同专用章') + '</div></div>' +
    '<div class="ph">— ' + L('page 1 of 6','第 1 页 / 共 6 页') + ' — ' +
    L('typeset placeholder; the real system embeds the PDF here (paging, zoom, download)',
      '原型内为排版占位，真实系统在此内嵌 PDF（可翻页、可缩放、可下载）') + '</div>' +
    '</div></div>';
}
function verifyPane(d){
  var vs = d.seals, i = Math.min(S.sealIdx, vs.length - 1), f = vs[i];
  var doc = '<div class="vf-doc"><div class="dh">' +
    '<span class="nm">' + E(tr(f.n)) + '</span>' +
    '<div class="seg-mini" role="group" aria-label="' + L('Zoom','缩放') + '">' +
      [['fit', L('Fit','适宽')], ['100', '100%'], ['150', '150%']].map(function(z){
        return '<button type="button" data-act="ln.zoom" data-v="' + z[0] + '" aria-pressed="' +
          (S.zoom === z[0]) + '">' + E(z[1]) + '</button>'; }).join('') + '</div>' +
    '<div class="seg-mini" role="group" aria-label="' + L('Split','分栏配比') + '">' +
      [['even', L('Even','均分')], ['doc', L('Favour contract','侧重合同')]].map(function(s){
        return '<button type="button" data-act="ln.split" data-v="' + s[0] + '" aria-pressed="' +
          (S.split === s[0]) + '">' + E(s[1]) + '</button>'; }).join('') + '</div>' +
    '</div><div class="stage">' + paper(d) + '</div>' +
    '<div class="vers" role="group" aria-label="' + L('Versions','历史版本') + '">' +
      vs.map(function(v, n){
        return '<button type="button" data-act="ln.seal" data-v="' + n + '" aria-pressed="' + (n === i) + '">' +
          L('v' + (n + 1), '第 ' + (n + 1) + ' 版') + ' · ' + v.at.slice(5, 10) +
          (n === vs.length - 1 ? L(' (latest)', '（最新）') : '') + '</button>'; }).join('') +
      '<button type="button" data-act="ln.dl">' + L('Download','下载本版') + '</button></div></div>';
  var list = '<div class="vf-list">' + termRows(d).map(function(t){
    return '<div class="it"><span class="k">' + E(t[0]) + '</span>' +
      '<span class="v' + (t[2] ? ' txt' : '') + '">' + E(t[1]) + '</span></div>';
  }).join('') + '</div>';
  return '<div class="vf' + (S.split === 'doc' ? ' doc' : '') + '">' + doc + list + '</div>' +
    '<p class="vf-foot"><b>' +
    L('The platform does not vet the authenticity or legal effect of the contract. Please check it yourself.',
      '平台不审核合同真伪与法律效力，请自行核验。') + '</b> ' +
    L('Left is what the other side sealed and sent back; right is what the platform has on record. Nothing is compared automatically.',
      '左边是对方盖章后回传的合同，右边是平台记录的商务条款，平台不做自动比对。') +
    why(L('Why there is no "verified" button','为什么没有「核验通过」按钮'),
      L('A "verified" button would read as a platform-side review state, and the platform does not review. It would also turn "marked verified but not disbursed" into a fourth in-between state. What you actually do expresses your decision: disbursing means you accept this contract.',
        '多一个"通过"会像一个平台侧的审核态，而平台并不审核；而且"点了通过但没放款"会变成第四种中间态。您的意思表示由您实际做的那个动作表达——直接放款即视为您接受了这份合同。')) + '</p>';
}

/* 还款收款账户（法币）的五项。⚠️ 比资产方侧的收款账户多一个**中转行**：
   资产方是收放款、机构是收还款，链路与经手行不同，两侧规格**有意不同**，
   不得为了"两侧视觉对齐"把中转行删掉（D-LN-64 / AC-LN-26 的反向断言）。 */
var REPAY_FIELDS = [
  ['rName',  ['Account name','户名'],        ['Legal name of the account holder','账户的法定名称']],
  ['rAcct',  ['Account number','账号'],      ['IBAN or account number','IBAN 或银行账号']],
  ['rSwift', ['SWIFT / BIC','SWIFT / BIC'],  ['8 or 11 characters','8 位或 11 位']],
  ['rBank',  ['Bank','开户行'],              ['Bank name and branch','开户行名称与分行']],
  ['rCorr',  ['Correspondent bank','中转行'],['Required — a cross-border repayment will not land without it',
                                              '必填——跨境收款没有中转行到不了账']]
];
function repayFiatFields(){
  return REPAY_FIELDS.map(function(f){
    return field(L(f[1][0], f[1][1]), L('required','必填'),
      '<input class="inp" type="text" value="' + E(S.f[f[0]] || '') + '" data-act="ln.f" data-v="' + f[0] +
      '" placeholder="' + E(L(f[2][0], f[2][1])) + '">',
      (S.f[f[0]] || '').trim() ? '' : L(f[2][0], f[2][1]));
  }).join('') +
  '<p class="hint">' +
  L('All five are required as a group — the correspondent bank included. This set is deliberately fuller than the one the asset owner gives for receiving the disbursement: they are receiving a payout, you are being repaid, and the two routes go through different banks.',
    '五项<b>整组必填</b>，中转行也在内。这套比资产方给的收款账户更全是<b>有意的</b>：他们收的是放款、您收的是还款，两条链路经手的银行不同。') + '</p>';
}
function repayOk(d){
  if(!isFiat(d)) return true;                    /* 数币取绑定钱包，没有录入项 */
  return REPAY_FIELDS.every(function(f){ return (S.f[f[0]] || '').trim().length > 0; });
}
function repayMissing(d){
  if(!isFiat(d)) return [];
  return REPAY_FIELDS.filter(function(f){ return !(S.f[f[0]] || '').trim(); })
    .map(function(f){ return L(f[1][0], f[1][1]); });
}

function formState(d){
  var f = S.f, fiat = isFiat(d);
  var given = (f.given || '').trim(), gErr = '';
  if(!given) gErr = 'empty';
  else if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(given)) gErr = 'format';
  else if(tmin(given) > tmin(NOW)) gErr = 'future';          /* E-LN-07：可以填过去，不能填未来 */
  var hash = (f.hash || '').trim(), hErr = '';
  if(!fiat){ if(!hash) hErr = 'empty'; else if(!hashOk(hash)) hErr = 'format'; }
  var filesOk = fiat ? (f.files.length >= FIAT_MIN_N && f.files.length <= FIAT_MAX_N) : true;
  var rOk = repayOk(d);
  return { fiat:fiat, given:given, gErr:gErr, hash:hash, hErr:hErr, filesOk:filesOk, repayOk:rOk,
           ok:!gErr && !hErr && filesOk && rOk };
}
function disbForm(d){
  var f = S.f, v = formState(d), fiat = v.fiat;
  var body =
    field(L('Disbursement currency','放款币种'), L('read-only · equals the quoted currency','只读 · 等于报价时确定的币种'),
      ro(fiat ? L('USD (fiat)','USD（法币）') : L('USDT (stablecoin)','USDT（数币）')),
      L('Changing the currency would change the commercial terms, and those were fixed when the quote was submitted.',
        '换币种等于改商务条款，而条款在报价提交时已固化。')) +
    field(L('Disbursement amount','放款金额'), L('read-only · equals the quoted amount','只读 · 等于报价金额'),
      ro(fiat ? money(d.amt, CCY) : money(settle(d), d.ccy) + L('  (= ' + money(d.amt, CCY) + ' ÷ FX 0.9994)',
        '　（＝ ' + money(d.amt, CCY) + ' ÷ 汇率快照 0.9994）')),
      L('Partial disbursement and rounding differences are out of scope this release.',
        '本期不支持部分放款与尾差。')) +
    field(L('Value date','发放时间'), L('required · may be in the past, never later than submission','必填 · 可填过去，不得晚于提交时刻'),
      '<input class="inp' + (v.gErr === 'future' || v.gErr === 'format' ? ' err' : '') + '" type="text" value="' +
        E(f.given) + '" data-act="ln.f" data-v="given" placeholder="2026-09-15 14:00" inputmode="numeric">',
      v.gErr === 'future'
        ? '<b style="color:var(--danger)">' + L('Later than the current submission time (' + withTz(NOW) + '); submission will be rejected.',
            '发放时间晚于当前提交时刻（' + withTz(NOW) + '），提交会被拒绝。') + '</b> ' +
          L('A value date in the future means the money has not left yet, and then this record should not be submitted.',
            '未来的发放时间意味着钱还没打，那就不该提交放款记录。')
        : v.gErr === 'format'
          ? '<b style="color:var(--danger)">' + L('Format must be YYYY-MM-DD HH:MM.','格式须为 YYYY-MM-DD HH:MM。') + '</b>'
          : L('For reconciliation only. The confirmation window and any interest accrual run on the server time of a successful submission, never on this field.',
              '仅作对账参考。确认时限与计息一律以提交成功的服务端时间为准，不用这个字段。'));

  if(fiat){
    body += field(L('Payout account','收款账户'), L('read-only · confirmed by the asset owner when accepting the quote','只读带出 · 资产方接受报价时逐笔确认过'),
      '<div class="ls-kgrid" style="margin-top:2px">' +
      '<div><div class="k">' + L('Account name','收款人名称') + '</div><div class="v txt">' + E(d.payeeFiat.name) + '</div></div>' +
      '<div><div class="k">' + L('Account number','账号') + '</div><div class="v">' + E(maskAcct(d.payeeFiat.acct)) + '</div></div>' +
      '<div><div class="k">' + L('Bank','开户行') + '</div><div class="v txt" style="font-size:12px">' + E(d.payeeFiat.bank) + '</div></div>' +
      '<div><div class="k">SWIFT / BIC</div><div class="v">' + E(d.payeeFiat.swift) + '</div></div>' +
      '<div><div class="k">' + L('Country / region','国别 / 地区') + '</div><div class="v txt">' + E(tr(d.payeeFiat.country)) + '</div></div></div>',
      L('The funder cannot edit it here. An editable payout account would be a way to send the money elsewhere and still claim it was disbursed.',
        '机构不得在此修改或另填——可改就等于给了把钱打去别处再声称已放款的口子。')) +
    field(g('transferProof'), L('required · ' + FIAT_MIN_N + '–' + FIAT_MAX_N + ' files · PDF / JPG / PNG · ≤ ' + FILE_MAX_MB + ' MB each',
        '必传 · ' + FIAT_MIN_N + '～' + FIAT_MAX_N + ' 个 · PDF / JPG / PNG · 单文件 ≤ ' + FILE_MAX_MB + ' MB'),
      '<div class="drop' + (S.f.upErr ? ' err' : '') + '" role="button" tabindex="0" data-act="ln.up" data-v="proof">' +
      '<div class="ic" aria-hidden="true">↑</div><div><b>' + L('Click to upload the transfer receipt','点击上传转账凭证') + '</b>' +
      '<div class="hint" style="margin-top:3px">' +
      (f.files.length ? L(f.files.length + ' uploaded', '已传 ' + f.files.length + ' 个') : L('nothing uploaded yet','尚未上传')) +
      '</div></div></div>' +
      (S.f.upErr ? '<div style="margin-top:11px">' + CF.note('red', S.f.upErr, L('Upload not accepted','上传未通过')) + '</div>' : '') +
      (f.files.length ? '<div style="margin-top:10px">' + f.files.map(function(fl, i){
        return '<div class="filecard"><div class="ic" aria-hidden="true">▤</div><div class="bd"><b>' + E(tr(fl.n)) +
          '</b><span>' + E(fl.s) + '</span></div><div class="act">' +
          '<button class="btn sm" type="button" data-act="ln.rm" data-v="' + i + '">' + L('Remove','移除') + '</button></div></div>';
      }).join('') + '</div>' : ''),
      L('The platform does not vet whether a receipt is genuine; it only checks format, size and count. Receipts are visible to the two parties of this deal only.',
        '平台不审核凭证真伪，只校验格式、大小与数量；凭证只对该笔业务双方可见。'));
  } else {
    body += field(L('Payout address','收款地址'), L('read-only · the asset owner’s registered address','只读带出 · 资产方登记的企业统一数币地址'),
      ro(maskAddr(d.payeeCoin.addr))) +
    field(g('chain'), L('read-only · one chain this release','只读 · 本期只有这一条链'),
      ro(CHAIN),
      L('This release supports <b>' + CHAIN + ' only</b> — one chain, not a default one. USDT and USDC are ' + TOKEN_STD +
        ' this release, so there is nothing to pick and no way to pick the wrong chain.',
        '本期<b>只支持 ' + CHAIN + '</b>——是"只有一条"，不是"默认一条"。USDT 与 USDC 本期即 ' + TOKEN_STD +
        '，没有可选项，也就不存在"选错链"。')) +
    field(g('txHashLn'), L('required · format check only','必填 · 只做格式校验'),
      '<input class="inp' + (v.hErr === 'format' ? ' err' : '') + '" type="text" value="' + E(f.hash) +
        '" data-act="ln.f" data-v="hash" placeholder="0x…">',
      v.hErr === 'format'
        ? '<b style="color:var(--danger)">' + L('Invalid format: expected 0x followed by 64 hex characters.',
            '格式不合法：须为 0x + 64 位十六进制。') + '</b> ' +
          L('Currently ' + v.hash.length + ' characters. The check stops at format — the platform cannot tell whether a transaction exists on chain, so it says nothing about that.',
            '当前 ' + v.hash.length + ' 个字符。提示只到"格式对不对"为止：平台无法判断这笔交易在链上存不存在，因此不给出任何与交易是否存在有关的结论。')
        : L('Format check only, no on-chain verification. Whether the transaction is real is judged by the asset owner at the confirmation step.',
            '只做格式校验、不做链上核验。这笔交易是否真实存在，由资产方在确认环节自行查验。')) +
    field(L('Supporting files','补充材料'), L('optional · ≤ ' + EXTRA_MAX_N + ' files','选填 · ≤ ' + EXTRA_MAX_N + ' 个'),
      '<div class="drop" role="button" tabindex="0" data-act="ln.up" data-v="extra">' +
      '<div class="ic" aria-hidden="true">↑</div><div><b>' + L('Click to upload (e.g. a wallet screenshot)','点击上传（如钱包转账截图）') + '</b>' +
      '<div class="hint" style="margin-top:3px">' +
      (f.extra.length ? L(f.extra.length + ' uploaded', '已传 ' + f.extra.length + ' 个') : L('optional','选填')) + '</div></div></div>' +
      (f.extra.length ? '<div style="margin-top:10px">' + f.extra.map(function(fl, i){
        return '<div class="filecard"><div class="ic" aria-hidden="true">▤</div><div class="bd"><b>' + E(tr(fl.n)) +
          '</b><span>' + E(fl.s) + '</span></div><div class="act">' +
          '<button class="btn sm" type="button" data-act="ln.rmx" data-v="' + i + '">' + L('Remove','移除') + '</button></div></div>';
      }).join('') + '</div>' : ''));
  }
  /* 第三区之二：还款收款账户（V3.2 · D-LN-64 ～ D-LN-68）。
     法币五项整组必填（比资产方侧多一个中转行，两侧有意不同，不得为"对齐"删减）；
     数币取绑定钱包只读。与出账账户无关、不做一致性校验；放款后不可改，因此没有"修改账户"入口。 */
  body += '<div style="border-top:1px solid var(--border);margin:16px 0 14px;padding-top:14px">' +
    '<div style="font-size:12.5px;font-weight:680">' + L('Account for receiving repayments','还款收款账户') + '</div>' +
    '<p class="hint" style="margin:5px 0 12px">' +
    L('This is where <b>you</b> will be repaid. It is registered together with this disbursement record, and the repayment module pays into it. ' +
      'It has nothing to do with the account you are paying out from, and the platform does not compare the two. ' +
      '<b>It cannot be changed after you submit</b>, so check it now.',
      '这是<b>您将来收还款</b>的账户，随本条放款记录一并登记，还款模块按它打款。' +
      '它与本次出账的账户<b>无关</b>，平台也不做两者的一致性校验。' +
      '<b>提交后本期不可修改</b>，请现在核对。') + '</p>' +
    (isFiat(d)
      ? repayFiatFields()
      : field(L('Repayment address','还款收款地址'), L('read-only · your bound wallet','只读 · 您登录时绑定的钱包地址'),
          ro(maskAddr(d.fundWallet.addr)) +
          '<div style="margin-top:10px">' +
          field(g('chain'), L('read-only · one chain this release','只读 · 本期只有这一条链'), ro(CHAIN)) + '</div>',
          L('Taken from the wallet bound to your account. That binding cannot be changed once made, so the platform does not keep a second, editable copy of it here.',
            '取自您账号绑定的钱包地址。该绑定一经建立不可更改，平台不在此另存一份可编辑的副本。'))) +
    '</div>';

  body += field(L('Note to the asset owner','放款备注'), L('optional · ≤ ' + MEMO_MAX + ' characters','选填 · ≤ ' + MEMO_MAX + ' 字'),
    '<textarea class="inp" rows="2" maxlength="' + MEMO_MAX + '" data-act="ln.f" data-v="memo" placeholder="' +
    L('e.g. remitted through our Shanghai branch; outward remittance and cable charges are borne by you.',
      '例如：已通过上海分行电汇，汇出行手续费与电报费由贵司承担。') + '">' + E(S.f.memo) + '</textarea>',
    L('Visible to the asset owner. The record cannot be edited or withdrawn after submission, so put what you need to say here.',
      '对资产方可见。提交后放款记录不可修改、不可撤回，要写的说明请在这里写清。'));
  return body;
}

/* 处置动作的抽屉内二级区：不另开层（D-LN-55） */
var DISP = {
  hold:{ g:'holdDisb',
    h:['Put this disbursement on hold','登记暂不放款'],
    x:['The deal stays at <b>awaiting disbursement</b>: nothing about the state or the four amounts changes. The reason is visible to the asset owner. You can disburse at any time afterwards — submitting the disbursement clears this mark by itself, no "resume" step.',
       '业务<b>留在待放款</b>，状态与四个量一个不动；原因对资产方可见。之后您随时可以直接放款，提交放款时该标记自动清除，不需要先点一次"恢复"。'],
    ph:['e.g. clause 7 names a different remitting bank from the payout account confirmed here; under internal review.',
        '例如：合同第 7 条的还款账户与平台上确认的收款账户不是同一个开户行，我方内部复核中。'] },
  redo:{ g:'askReupload',
    h:['Ask the asset owner to upload the sealed contract again','要求资产方重传盖章件'],
    x:['The deal stays at <b>awaiting disbursement</b>. The asset owner gets an upload entry and one notification. <b>A successful re-upload clears the mark by itself</b> — you do not confirm it again. Your disbursement entry stays available meanwhile, and every earlier version is kept.',
       '业务<b>留在待放款</b>。资产方获得重传入口并收到一条通知。<b>重传成功即自动清除标记</b>，您无需再点一次"通过"；重传期间您的放款入口照常可用，历史版本一份不少。'],
    ph:['e.g. the company seal on page 3 is not the asset owner of this deal; please re-seal and upload again.',
        '例如：盖章件第 3 页的公章与本笔业务的资产方主体不一致，请核对后重新加盖并上传。'] },
  stop:{ g:'terminate',
    h:['Terminate this financing deal','终止这笔融资业务'],
    x:['<b>Terminal and irreversible.</b> The committed quote amount is released in full and does <b>not</b> move into used credit; committed demand is unchanged because the demand itself was never withdrawn. The demand returns to <b>awaiting quotes</b> and any funder may quote again, including you.',
       '<b>终态、不可逆。</b>在途报价占用全额释放且<b>不进</b>授信占用额；项目在途金额不变——需求本身没有被撤下。该需求退回<b>待报价</b>，可被任何机构重新报价，包括贵司自己。'],
    ph:['e.g. the entity name on the contract does not match the entity registered on the platform.',
        '例如：合同主体名称与贵司在平台登记的企业主体不一致。'] }
};
function dispPanel(){
  var k = S.disp, m = DISP[k], v = (S.reason || '').trim();
  var ok = v.length >= 1 && v.length <= REASON_MAX;
  return '<div class="u-2nd' + (k === 'stop' ? ' stop' : '') + '"><div class="h">' + E(L(m.h[0], m.h[1])) + '</div>' +
    '<div class="x">' + L(m.x[0], m.x[1]) + '</div>' +
    '<textarea class="inp" rows="3" maxlength="' + REASON_MAX + '" data-act="ln.f" data-v="reason" placeholder="' +
    E(L(m.ph[0], m.ph[1])) + '">' + E(S.reason || '') + '</textarea>' +
    '<p class="hint" style="margin-top:6px">' +
    L('Reason required, 1–' + REASON_MAX + ' characters, free text with no categories. <b>Visible to the asset owner</b> and appended to the append-only check record. ' + v.length + ' / ' + REASON_MAX + ' used.',
      '原因必填，1～' + REASON_MAX + ' 字，自由文本不分类。<b>对资产方可见</b>，并进核验处置记录（只增不改）。已填 ' + v.length + ' / ' + REASON_MAX + ' 字。') + '</p>' +
    '<div class="bar">' +
    '<button class="btn ' + (k === 'stop' ? 'danger' : 'primary') + '" type="button" ' + (ok ? '' : 'disabled ') +
      'data-act="ln.dispGo" data-v="' + k + '">' +
      (k === 'stop' ? L('Next: confirm termination','下一步：确认终止') : L('Confirm','确认') + E(g(m.g))) + '</button>' +
    '<button class="btn" type="button" data-act="ln.dispCancel">' + L('Cancel','取消') + '</button></div></div>';
}

function drawerDisb(){
  var d = deal(), cv = coverage(d), v = formState(d), acts = actions(d);
  var marks = '';
  if(d.marks.redo) marks += mark(L('Awaiting re-upload','待资产方重传盖章件'),
    L('You asked for a re-upload on ' + d.marks.redo.at + ' ' + TZ + '. Reason: ', '您于 ' + d.marks.redo.at + ' ' + TZ + ' 要求重传，原因：') +
    E(tr(d.marks.redo.why)) + ' <b>' +
    L('Your disbursement entry stays available meanwhile.','重传期间您的放款入口照常可用。') + '</b>');
  if(d.marks.hold) marks += mark(L('Disbursement on hold','已暂缓放款'),
    L('Logged on ' + d.marks.hold.at + ' ' + TZ + '. Reason: ', '登记于 ' + d.marks.hold.at + ' ' + TZ + '，原因：') +
    E(tr(d.marks.hold.why)) + ' <b>' +
    L('Submitting a disbursement clears this mark by itself.','直接提交放款即自动清除该标记。') + '</b>');
  if(d.expired) marks += mark(L('Matured · performing','已到期 · 存量处理中'),
    L('The financing project matured on ' + d.expiresAt + '. It stops taking new quotes, but <b>deals already running go through as usual</b> — this disbursement is not affected.',
      '融资项目已于 ' + d.expiresAt + ' 到期：停止接受新报价，但<b>存量业务照常走完</b>——本笔放款不受影响。'));

  var body =
    (marks ? sec(L('Current marks','当前标记'), '', marks, true) : '') +
    sec(L('1 · Check the sealed contract against the terms','① 核验盖章件与商务条款'),
      L('left: what they sealed · right: what the platform recorded','左：对方回传的合同　右：平台记录的条款'),
      verifyPane(d)) +
    sec(L('2 · Fill in the disbursement record','② 填写放款记录'),
      (v.fiat ? L('fiat branch','法币分支') : L('stablecoin branch','数币分支')) + ' · ' +
      L('cannot be edited after submission','提交后不可修改'),
      (!cv.pass ? '<div style="margin-bottom:13px">' + CF.note('red',
        L('Pledge coverage is insufficient, so <b class="ls-b">submitting a disbursement is unavailable</b>: coverage gap <span class="mono">' +
            usd(cv.gap) + '</span>, the asset owner needs to add <span class="mono">' + usd(cv.addAsset) + '</span> of asset value.' +
            '<p>The rest of the form stays visible and fillable, and <b class="ls-b">all three handling actions below stay available</b>. The entry reopens by itself once coverage is restored.</p>',
          '该项目质押覆盖不足，<b class="ls-b">提交放款不可用</b>：覆盖缺口 <span class="mono">' + usd(cv.gap) +
            '</span>，需资产方追加资产价值 <span class="mono">' + usd(cv.addAsset) + '</span>。' +
            '<p>表单其余部分照常可见可填，<b class="ls-b">下面三个处置动作照常可用</b>。覆盖补足后放款入口自动恢复。</p>'),
        L('Coverage gate not passed','覆盖闸门未通过')) + '</div>' : '') +
      disbForm(d) +
      (S.disp ? dispPanel() : '') +
      '<p class="hint" style="margin-top:12px">' +
      L('This step performs <b>no on-chain operation and consumes no gas</b>: a stablecoin transfer happens outside the platform, and the platform only takes down the hash and the chain as text.',
        '本步骤<b>不产生任何链上操作、不消耗 gas</b>：数币转账发生在平台之外，平台只收下哈希与链的文本记录。') + '</p>');

  var dis = actionOf(acts, 'disburse');
  var foot = '<div class="u-foot"><div class="side">' +
    ['hold', 'redo', 'stop'].map(function(k){
      var a = actionOf(acts, k);
      if(!a) return '';
      return '<button class="btn link' + (k === 'stop' ? ' danger' : '') + '" type="button" data-act="ln.disp" data-v="' +
        k + '">' + E(a.label) + '</button>';
    }).join('') + '</div><div class="sp"></div>' +
    '<button class="btn" type="button" data-act="ln.close">' + L('Cancel','取消') + '</button>' +
    (dis && dis.enabled
      ? '<button class="btn primary" type="button" ' + (v.ok ? '' : 'disabled ') + 'data-act="ln.submitAsk">' +
        L('Submit disbursement record','提交放款记录') + '</button>' +
        (v.ok ? '' : '<p class="note">' + L('Still needed: ','还缺：') +
          [v.gErr ? L('a valid value date','有效的发放时间') : '',
           v.hErr ? L('a well-formed transaction hash','格式正确的交易哈希') : '',
           !v.filesOk ? L('at least one transfer receipt','至少一个转账凭证') : ''
          ].concat(repayMissing(d).map(function(x){
            return L('repayment account — ','还款收款账户 — ') + x; }))
           .filter(Boolean).join(L(' · ', '、')) + '</p>')
      : '<button class="btn blocked" type="button" aria-disabled="true" data-act="ln.why" data-v="cov">⊘ ' +
        L('Submit disbursement record','提交放款记录') + '</button>') +
    '<p class="note">' +
    L('The three handling actions are always available — including when coverage is short. They are reversible, so they sit in the secondary position rather than competing with the main action.',
      '三个处置动作常驻可用，覆盖不足时也一样；它们是可逆的，所以放在次级位，不和主操作抢视线。') + '</p></div>';

  return '<aside class="drawer u" role="dialog" aria-modal="true" aria-label="' + L('Record disbursement','放款') + '">' +
    '<div class="drawer-h"><b>' + g('disburse') + '<span class="sb">' + d.fp + ' · ' + d.id + '</span></b>' +
    '<button class="modal-x" type="button" data-act="ln.close" aria-label="' + L('Close','关闭') + '">✕</button></div>' +
    '<div class="drawer-b">' + body + '</div>' + foot + '</aside>';
}


/* ================================================================
   Part F —— 承载单元二：确认到账抽屉 P-LS-08（资产方）
   ================================================================ */
function countdown(d, forAsset){
  var k = clock(d);
  if(!k.has) return '';
  var total = CONFIRM_HOURS * 60;
  var held = Math.min(100, k.heldMin / total * 100).toFixed(2);
  var cls = k.over ? ' over' : k.soon ? ' soon' : '';
  return '<div class="cd' + cls + '">' +
    '<div class="by">' + L('The <b>confirmation window</b> runs from the <b>server time of a successful submission</b> of the disbursement record, ' +
        withTz(k.from) + ', for <b>' + CONFIRM_HOURS + ' hours</b>. It does not run from the value date the funder typed in.',
      '<b>放款确认时限</b>自放款记录<b>提交成功的服务端时间</b> ' + withTz(k.from) + ' 起算，共 <b>' + CONFIRM_HOURS +
        ' 小时</b>；不是从提交方填写的发放时间起算。') + '</div>' +
    '<div class="big"><span class="v">' +
      (k.over ? L('Elapsed ' + dur(k.overMin) + ' ago', '已超过 ' + dur(k.overMin))
              : L(dur(k.leftMin) + ' left', '剩余 ' + dur(k.leftMin))) + '</span>' +
    '<span class="u">' + L('closes at ','到期时刻 ') + withTz(k.to) + ' · ' +
      (k.over ? L('state unchanged, still awaiting your confirmation','状态不变，仍待您确认')
              : L('nothing is auto-confirmed when it closes','到期不会自动确认')) + '</span></div>' +
    '<div class="bar" role="img" aria-label="' + L('confirmation window','放款确认时限') + '">' +
      '<div class="el" style="width:' + held + '%"></div><div class="rm" style="width:' + (100 - held).toFixed(2) + '%"></div></div>' +
    '<div class="sc"><span>' + L('submitted ','提交 ') + withTz(k.from) + '</span><span>' +
      (k.over ? L('window closed','到期时刻已过')
              : L(dur(k.heldMin) + ' elapsed + ' + dur(k.leftMin) + ' left ≡ ' + CONFIRM_HOURS + ' h',
                  '已过 ' + dur(k.heldMin) + ' ＋ 剩余 ' + dur(k.leftMin) + ' ≡ ' + CONFIRM_HOURS + ' 小时')) + '</span></div>' +
    (k.over ? '<div style="margin-top:10px">' + mark(
        L('Window elapsed ' + k.overDays + ' days ago', '已超过确认时限 ' + k.overDays + ' 天'),
        '<b>' + L('The platform will not confirm for you, and will not void this deal either.',
          '平台不会自动确认，也不会自动作废这笔业务。') + '</b> ' +
        L('The deal is still awaiting your confirmation, every amount is exactly as it was before the window closed, and the entry still works. Confirming now settles exactly as it would have on day one.',
          '业务仍待您确认，四个量与到期前完全一致，入口照常可用。现在确认，结算结果与第 1 天确认完全相同。')) + '</div>' : '') +
    (k.soon ? '<p class="hint" style="color:var(--warn);margin-top:9px">' +
      L('Under ' + NEAR_HOURS + ' hours left; the countdown is now in minutes and the single reminder has gone out. <b>Nothing is auto-confirmed and nothing is auto-voided at the deadline.</b>',
        '剩余不足 ' + NEAR_HOURS + ' 小时，倒计时已切到分钟精度，临近提醒已发出（只发一档）。<b>到点不会自动确认，也不会自动作废。</b>') + '</p>' : '') +
    why(L('This 168 hours is not the quote’s 168 hours','这个 168 小时和报价那个不是一回事'),
      L('The <b>quote validity window</b> expires by itself: the quote ends and the credit is released. The <b>confirmation window</b> only sends a notice: the state does not change, no amount moves, the entry stays. Confirmation is a statement of fact about whether money arrived, and the platform has no standing to make that statement for you.',
        '<b>报价有效期</b>到点<b>自动失效</b>，报价终结、额度释放；<b>放款确认时限</b>到点<b>只发一条通知</b>，状态不变、额度不动、入口还在。确认是对"钱是否到账"的事实陈述，平台无权代您陈述。')) +
    '</div>';
}
function recordBlock(d, full){
  var ln = d.ln, fiat = isFiat(d);
  var head = '<div class="pair"><div class="t"><div class="k">' + L('Value date','发放时间') + '</div>' +
    '<div class="v">' + ln.given + '</div><div class="src">' +
    L('source: <b>typed by the funder</b>, for reconciliation only','来源：<b>资金方填写</b>，仅作对账参考') + '</div></div>' +
    '<div class="t auth"><div class="k">' + L('Submitted at','提交时间') + '</div>' +
    '<div class="v">' + ln.at + '</div><div class="src">' +
    L('source: <b>server record</b>; the confirmation window runs from here','来源：<b>服务端记录</b>，确认时限由它起算') + '</div></div></div>' +
    '<div class="ls-kgrid" style="margin-top:13px">' +
    '<div><div class="k">' + L('Amount disbursed','放款金额') + '</div><div class="v">' +
      money(fiat ? d.amt : settle(d), d.ccy) + '</div></div>' +
    '<div><div class="k">' + (fiat ? L('Payout account','收款账户') : L('Payout address','收款地址')) + '</div>' +
      '<div class="v" style="font-size:12px">' + (fiat ? maskAcct(d.payeeFiat.acct) : maskAddr(d.payeeCoin.addr)) + '</div></div>' +
    '<div><div class="k">' + L('Record ID','放款记录编号') + '</div><div class="v">' + ln.id + '</div></div></div>';
  if(!full) return head + '<p class="hint" style="margin-top:11px">' +
    L('The payout account, the receipt file and the transaction hash are filtered server-side and are not part of the public fields.',
      '收款账户、凭证文件、交易哈希与链由服务端按归属过滤，不属于公开字段。') + '</p>';
  var proof = fiat
    ? '<div class="filecard"><div class="ic" aria-hidden="true">▤</div><div class="bd"><b>' + E(tr(ln.files[0].n)) +
      '</b><span>' + ln.files[0].s + ' · ' + L('submitted with the record','随放款记录提交') + '</span></div>' +
      '<div class="act"><button class="btn sm" type="button" data-act="ln.dl">' + L('Preview / download','预览 / 下载') + '</button></div></div>' +
      '<p class="hint" style="margin-top:9px">' +
      L('The platform does not vet whether the receipt is genuine — please check it against your own bank statement.',
        '平台不审核凭证真伪——请对照您的银行流水核对。') + '</p>'
    : '<div class="hash"><div class="hv">' + E(ln.hash) + '</div>' +
      '<div style="display:flex;gap:var(--sp-4);flex-wrap:wrap;margin-top:8px;font-size:11.5px;color:var(--muted)">' +
      '<span>' + g('chain') + ' · <b>' + CHAIN + '</b></span>' +
      '<span>' + L('Token standard','代币标准') + ' · <b>' + TOKEN_STD + '</b></span>' +
      '<span>' + L('format check','格式校验') + ' · <b>' + L('passed','通过') + '</b></span></div>' +
      '<div class="lk"><a class="btn sm" href="' + EXPLORER_TX + E(ln.hash) +
      '" target="_blank" rel="noopener noreferrer">' + L('Open on Etherscan','在 Etherscan 打开该交易') + '</a>' +
      '<span class="nv">' + L('The platform has not verified this transaction; the link is for your own check.',
        '平台未核验该交易，链接仅供自行查验。') + '</span></div>' +
      '<p class="hint" style="margin-top:9px">' +
      L('The hash passed a <b>format check only — there was no on-chain verification</b>. A funder can submit a well-formed hash that does not exist, so this judgement is yours to make.',
        '这条哈希<b>只校验过格式，没有做链上核验</b>：机构可以填一个格式正确但不存在的哈希，这一步的判断只能由您来做。') + '</p></div>';
  return head + '<div style="margin-top:14px">' + proof + '</div>' +
    (ln.memo ? '<p class="hint" style="margin-top:11px"><b>' + L('Note from the funder','资金方备注') + '</b>：' +
      E(tr(ln.memo)) + '</p>' : '');
}
function feeBlock(d){
  return '<div class="fee">' +
    '<div class="c"><div class="k">' + L('Financing amount · remitted','融资金额 · 机构按此汇出') + '</div>' +
      '<div class="v">' + money(d.amt, CCY) + '</div></div>' +
    '<div class="op" aria-hidden="true">−</div>' +
    '<div class="c"><div class="k">' + L('Cross-border fees · borne by you','跨境手续费 · 由您承担') + '</div>' +
      '<div class="v un">' + L('not estimated by the platform','平台不预估金额') + '</div>' +
      '<div class="x">' + L('outward remittance fee, intermediary-bank deductions, receiving-bank charge',
        '汇出行手续费、中转行扣费、收款行入账费') + '</div></div>' +
    '<div class="op" aria-hidden="true">→</div>' +
    '<div class="c"><div class="k">' + L('What lands in your account','您账上的实收') + '</div>' +
      '<div class="v un">' + L('less than ','少于 ') + amt(d.amt) + '</div>' +
      '<div class="x">' + L('the platform neither knows, collects nor advances it','平台不预知、不代收、不垫付') + '</div></div></div>' +
    '<p class="hint" style="margin-top:9px"><b style="color:var(--warn)">' +
    L('The principal you repay is still ' + money(d.amt, CCY) + '.', '您要偿还的本金仍按融资金额 ' + money(d.amt, CCY) + ' 计。') +
    '</b> ' + L('This page does not ask you for the amount received, does not check "received ≠ expected", and will not block confirmation over the difference.',
      '本页不要求您填实收金额、没有"实收 ≠ 应收"的校验、不会因为差额拦住确认。') +
    why(L('What if the gap is far bigger than a fee?','差额大到不像手续费怎么办'),
      L('<b>Do not confirm yet.</b> Use the support mailbox below to sort it out offline. Confirmation is an irreversible statement of fact, so the platform will never tell you to "confirm first and sort it out later".',
        '<b>先不要点确认</b>，走下面的客服邮箱线下核实。确认是不可撤销的事实陈述，平台不会引导您"先确认再说"。')) + '</p>';
}
function mailBlock(d){
  return '<div class="mail"><div class="h">' +
    L('There is no "raise a dispute" button — that is deliberate','找不到「提出异议」按钮是对的——本期没有这个入口') + '</div>' +
    '<p>' + L('If the money has not arrived or the amount looks wrong, the only thing to do is <b>not confirm yet</b> and email support. The platform will not confirm on your behalf, will not auto-confirm, and will not void this deal.',
      '钱没到或金额对不上，您唯一要做的是<b>先不点确认</b>，把情况发到客服邮箱。平台不会代您确认、不会自动确认，也不会自动作废这笔业务。') + '</p>' +
    '<div class="ad"><span class="em">' + E(MAIL) + '</span>' +
    '<button class="btn sm" type="button" data-act="ln.copy">' + L('Copy address and IDs','复制邮箱与编号') + '</button></div>' +
    '<p>' + L('Quote <b>demand ' + d.fp + '</b> and <b>deal ' + d.id + '</b> in the email. The platform <b>promises no turnaround time and no outcome</b>: this reaches people, not a ticketing system with an SLA.',
      '请在邮件里注明<b>需求编号 ' + d.fp + '</b> 与<b>融资业务编号 ' + d.id + '</b>。平台<b>不承诺处理时效、不承诺处理结果</b>：它通向线下人工沟通，不是有 SLA 的工单系统。') + '</p></div>';
}
function drawerConfirm(){
  var d = deal(), acts = actions(d), isAsset = (S.role === 'asset');
  var body =
    sec(g('confirmWindow'), '', countdown(d, isAsset), true) +
    sec(L('1 · Check this payment','① 核对这笔钱'), L('the record the funder submitted','资金方提交的放款记录'),
      recordBlock(d, isAsset)) +
    (isAsset
      ? sec(L('2 · What lands will be less than the financing amount','② 到账金额会少于融资金额'),
          L('expected, and it does not block confirmation','这是预期内的，不影响确认'),
          feeBlock(d) +
          '<div style="margin-top:13px">' +
          field(g('amountReceived'), L('optional · confirm with or without it','选填 · 填与不填都能确认'),
            '<input class="inp" type="text" value="' + E(S.f.recv) + '" data-act="ln.f" data-v="recv" placeholder="' +
            L('e.g. 499,735.00','例如 499,735.00') + '">',
            L('Kept only as a record for the two of you. <b>Not validated, not compared with the amount disbursed, not used in any calculation.</b>',
              '只用于双方线下对账留痕：<b>不校验、不与放款金额比对、不参与任何计量。</b>')) + '</div>', true) +
        sec(L('3 · If the money has not arrived','③ 钱没到，或金额对不上'), L('disputes go offline this release','本期异议走线下'),
          mailBlock(d))
      : '');
  var foot = isAsset
    ? '<div class="u-foot"><div class="sp"></div>' +
      '<button class="btn" type="button" data-act="ln.close">' + L('Not yet','稍后再说') + '</button>' +
      '<button class="btn primary" type="button" data-act="ln.confirmAsk">' + g('confirmReceipt') + '</button>' +
      '<p class="note">' + L('This drawer has exactly one action. There is no "raise a dispute", no "reject", and no "undo confirmation" — confirming cannot be undone.',
        '本抽屉只有一个动作：没有「提出异议」「驳回」，也没有「撤销确认」——确认后不可撤销。') + '</p></div>'
    : '<div class="u-foot"><div class="sp"></div>' +
      '<button class="btn" type="button" data-act="ln.close">' + L('Close','关闭') + '</button></div>';
  return '<aside class="drawer u" role="dialog" aria-modal="true" aria-label="' + g('confirmReceipt') + '">' +
    '<div class="drawer-h"><b>' + g('confirmReceipt') + '<span class="sb">' + d.fp + ' · ' + d.id + '</span></b>' +
    '<button class="modal-x" type="button" data-act="ln.close" aria-label="' + L('Close','关闭') + '">✕</button></div>' +
    '<div class="drawer-b">' + body + '</div>' + foot + '</aside>';
}

/* ================================================================
   Part G —— 承载单元三：盖章件重传抽屉（资产方，FD-31 为真时）
   ================================================================ */
function drawerRedo(){
  var d = deal();
  var body = sec(L('The funder asked for a re-upload','资金方要求重传'), '',
      mark(L('Re-upload requested','要求重传'),
        E(co('fund')) + ' · ' + (d.marks.redo ? d.marks.redo.at + ' ' + TZ : '') + '<br>' +
        (d.marks.redo ? E(tr(d.marks.redo.why)) : '')), true) +
    sec(L('Upload the corrected sealed contract','上传新版盖章件'),
      L('PDF / JPG / PNG · ≤ ' + FILE_MAX_MB + ' MB each','PDF / JPG / PNG · 单文件 ≤ ' + FILE_MAX_MB + ' MB'),
      '<div class="drop" role="button" tabindex="0" data-act="ln.up" data-v="seal">' +
      '<div class="ic" aria-hidden="true">↑</div><div><b>' + L('Click to upload','点击上传') + '</b>' +
      '<div class="hint" style="margin-top:3px">' +
      (S.f.seal ? E(tr(S.f.seal.n)) : L('this upload becomes version ' + (d.seals.length + 1),
        '本次上传将产生第 ' + (d.seals.length + 1) + ' 版')) + '</div></div></div>' +
      '<p class="hint" style="margin-top:11px"><b>' +
      L('Earlier versions are kept, never overwritten.','历史版本保留、不覆盖。') + '</b> ' +
      L('Every version carries its upload time and uploader, and the funder can switch between them in the check pane. A successful upload <b>clears the mark by itself</b> — the funder does not confirm it again. Uploading more than once is allowed; only the first success clears the mark and sends the notification.',
        '每一版都带上传时间与上传人，机构在核验区可逐版切换。重传成功后标记<b>自动清除</b>，机构无需再点一次"通过"。重复上传是允许的，只有第一次成功会清除标记并发通知。') + '</p>');
  return '<aside class="drawer u" role="dialog" aria-modal="true" aria-label="' + g('reupload') + '">' +
    '<div class="drawer-h"><b>' + g('reupload') + '<span class="sb">' + d.fp + '</span></b>' +
    '<button class="modal-x" type="button" data-act="ln.close" aria-label="' + L('Close','关闭') + '">✕</button></div>' +
    '<div class="drawer-b">' + body + '</div>' +
    '<div class="u-foot"><div class="sp"></div>' +
    '<button class="btn" type="button" data-act="ln.close">' + L('Cancel','取消') + '</button>' +
    '<button class="btn primary" type="button" ' + (S.f.seal ? '' : 'disabled ') + 'data-act="ln.redoGo">' +
    L('Confirm re-upload','确认重传') + '</button></div></aside>';
}

/* ================================================================
   Part H —— 提示类：居中弹窗 560px（零录入、只要一次表态，D-LN-54）
   ================================================================ */
function rows(list){
  return '<div class="rows" style="box-shadow:none">' + list.map(function(r){
    return '<div class="row"><div class="row-main"><div class="row-k">' + E(r[0]) + '</div>' +
      '<div class="row-v" style="color:var(--muted);font-size:12.5px;line-height:1.6">' + r[1] + '</div></div></div>';
  }).join('') + '</div>';
}
var SUBMIT_OUT = [
  ['ok',     ['Submitted successfully','提交成功']],
  ['cov',    ['E-LN-01 · coverage dropped below the invariant at submission','E-LN-01 提交瞬间质押覆盖跌破']],
  ['race',   ['E-LN-02 · a colleague submitted the same disbursement first','E-LN-02 并发：同事先一步提交了同一笔放款']],
  ['moved',  ['E-LN-03 · the deal had already left "awaiting disbursement"','E-LN-03 提交时业务已不在待放款']],
  ['upload', ['E-LN-06 · the receipt failed format / size checks','E-LN-06 凭证格式或大小不合规']]
];
var CONFIRM_OUT = [
  ['ok',     ['Confirmed successfully','确认成功']],
  ['settle', ['E-LN-11 · settlement failed partway, rolled back as a whole','E-LN-11 结算部分失败，整体回滚']],
  ['plan',   ['E-LN-13 · repayment module not ready, schedule pending','E-LN-13 还款模块未就绪，计划生成中']]
];
function outSelect(id, list, cur){
  return '<p class="hint">' + L('Prototype outcome switch: pick what the server returns at submission. In the real system these are decided server-side by a live recheck.',
    '原型内的结果模拟：选择服务端在提交时刻的返回。真实系统里这些结论一律由服务端实时重算给出。') + '</p>' +
    '<select class="inp" data-act="ln.f" data-v="' + id + '" id="' + id + '">' +
    list.map(function(o){
      return '<option value="' + o[0] + '"' + (cur === o[0] ? ' selected' : '') + '>' + E(L(o[1][0], o[1][1])) + '</option>';
    }).join('') + '</select>';
}
var MODALS = {
  submit:function(){
    var d = deal(), v = formState(d);
    var to = tstr(tmin(NOW) + CONFIRM_HOURS * 60);
    return '<div class="mask" data-act="ln.mclose"><div class="modal wide" role="dialog" aria-modal="true">' +
      '<div class="modal-h"><b>' + L('Submit this disbursement record?','提交这条放款记录？') + '</b>' +
      '<button class="modal-x" type="button" data-act="ln.mclose" aria-label="' + L('Close','关闭') + '">✕</button></div>' +
      '<div class="modal-b">' + rows([
        [L('It cannot be edited or withdrawn afterwards','提交后不可修改、不可撤回'),
         L('This record is your statement that you have paid, and the asset owner decides whether to confirm on the strength of it. If something is wrong — a mistyped hash, say — the only route left is talking to them directly.',
           '放款记录是您对"我已经付款"的事实陈述，资产方据此判断要不要确认。填错了（例如哈希抄错一位）只能靠线下沟通。')],
        [L('They have ' + CONFIRM_HOURS + ' hours to confirm, and nothing is auto-confirmed at the deadline',
           '资产方将在 ' + CONFIRM_HOURS + ' 小时内确认，到期不会自动视为确认'),
         L('The window closes at <b>' + withTz(to) + '</b>. When it closes, one notice goes out and nothing else changes. If they never confirm, the deal simply waits and no repayment schedule is generated.',
           '到期时刻 <b>' + withTz(to) + '</b>。到点只发一条通知，其他什么都不变；对方始终不确认，业务就停在那里，还款计划不生成。')],
        [L('The repayment account you just registered is locked after this','刚登记的还款收款账户提交后即锁定'),
         L('The repayment module will pay into it, and <b>this release has no way to change it</b>. Check the account, the SWIFT code and the correspondent bank once more before you submit. The account you paid out from is irrelevant here and is never compared with it.',
           '还款模块按它打款，<b>本期没有修改入口</b>。提交前请再核一遍账号、SWIFT 与中转行。本次出账用的是哪个账户与它无关，平台也不比对两者。')],
        [L('The platform does not verify that the transfer is real','平台不核验转账真伪'),
         v.fiat ? L('It cannot see your bank statement; the receipt is checked for format, size and count only.',
                    '平台看不到银行流水，凭证只校验格式、大小与数量。')
                : L('The transaction hash is checked for format only, with no on-chain verification. The judgement sits with the asset owner.',
                    '交易哈希只做格式校验、不做链上核验，判断权在资产方手里。')]
      ]) + outSelect('submitOut', SUBMIT_OUT, S.out) + '</div>' +
      '<div class="modal-f"><button class="btn" type="button" data-act="ln.mclose">' + L('Check again','再检查一下') + '</button>' +
      '<button class="btn primary" type="button" data-act="ln.submitGo">' + L('Submit','确认提交') + '</button></div></div></div>';
  },
  confirm:function(){
    var d = deal();
    return '<div class="mask" data-act="ln.mclose"><div class="modal wide" role="dialog" aria-modal="true">' +
      '<div class="modal-h"><b>' + L('Confirm that this money has arrived?','确认这笔钱已经到账？') + '</b>' +
      '<button class="modal-x" type="button" data-act="ln.mclose" aria-label="' + L('Close','关闭') + '">✕</button></div>' +
      '<div class="modal-b">' + rows([
        [L('Confirming states that you have verified the money arrived','确认即表示您已核实款项确已到账'),
         (isFiat(d) ? L('The platform cannot see your bank statement.','平台看不到您的银行流水。')
                    : L('The transaction hash was checked for format only, never on chain.','交易哈希只做过格式校验，没有做链上核验。')) +
         ' ' + L('<b>Receiving less than the financing amount is expected</b> and does not affect confirmation.',
                 '<b>实收少于融资金额是预期内的</b>，不影响确认。')],
        [L('It cannot be undone, and the repayment obligation starts','确认后不可撤销，还款义务随即成立'),
         L('In one settlement: the deal moves to repaying; committed demand becomes outstanding financing; the committed quote amount becomes used credit; the repayment schedule starts generating. Principal is the <b>financing amount ' + money(d.amt, CCY) + '</b>.',
           '同一次结算内：业务转还款中；项目在途金额转入项目融资余额；在途报价占用转入授信占用额；还款计划开始生成。本金按<b>融资金额 ' + money(d.amt, CCY) + '</b> 计。')]
      ]) + outSelect('confirmOut', CONFIRM_OUT, S.cout) + '</div>' +
      '<div class="modal-f"><button class="btn" type="button" data-act="ln.mclose">' + L('Check once more','再核对一下') + '</button>' +
      '<button class="btn primary" type="button" data-act="ln.confirmGo">' + g('confirmReceipt') + '</button></div></div></div>';
  },
  stop:function(){
    var d = deal();
    return '<div class="mask" data-act="ln.mclose"><div class="modal wide" role="dialog" aria-modal="true">' +
      '<div class="modal-h"><b>' + L('Terminate this financing deal?','终止这笔融资业务？') + '</b>' +
      '<button class="modal-x" type="button" data-act="ln.mclose" aria-label="' + L('Close','关闭') + '">✕</button></div>' +
      '<div class="modal-b">' + rows([
        [L('Terminal and irreversible','终止不可逆、不可恢复'),
         L('The deal ID is kept but voided, never reused. After disbursement a deal <b>can no longer be terminated</b> — the money has already left.',
           '业务编号保留但作废、不回收不复用。放款之后<b>不能再终止</b>——钱已经打出去了。')],
        [L('Your committed quote amount of ' + money(d.amt, CCY) + ' is released',
           '您对该资产方的 ' + money(d.amt, CCY) + ' 在途报价占用将释放'),
         L('and does <b>not</b> move into used credit; your available credit returns to what it was.',
           '且<b>不进</b>授信占用额，可用授信恢复原值。')],
        [L('The demand returns to "awaiting quotes"','该需求退回「待报价」'),
         L('Committed demand is unchanged because the demand was never withdrawn. Any funder may quote again — <b>including you</b>, as a brand-new deal with a new ID and a new FX snapshot.',
           '项目在途金额不变（需求还挂着）。可被任何机构重新报价，<b>包括贵司自己</b>——那是一笔全新的业务：新编号、新汇率快照。')]
      ]) + '<p class="hint" style="margin-top:11px">' + L('Reason sent to the asset owner: ','终止原因将通知资产方：') +
      E((S.reason || '').trim() || '—') + '</p></div>' +
      '<div class="modal-f"><button class="btn" type="button" data-act="ln.mclose">' + L('Think again','再想想') + '</button>' +
      '<button class="btn danger" type="button" data-act="ln.stopGo">' + L('Terminate','确认终止业务') + '</button></div></div></div>';
  }
};


/* ================================================================
   Part I —— 模块装配
   状态表把「哪一笔切面 + 谁在看 + 开哪个抽屉」三件事绑在一起，
   评审按状态条逐个走即可，不需要先想清楚身份该切到哪一档。
   ================================================================ */
var ST = {
  'P-LS-07':{
    fiat      :{ v:'fiat',       role:'fund',  d:'disb' },
    coin      :{ v:'coin',       role:'fund',  d:'disb' },
    short     :{ v:'short',      role:'fund',  d:'disb' },
    noCorr    :{ v:'fiat',       role:'fund',  d:'disb', repay:'noCorr' },
    reupload  :{ v:'reupload',   role:'fund',  d:'disb' },
    onhold    :{ v:'onhold',     role:'fund',  d:'disb' },
    reupAsset :{ v:'reupload',   role:'asset', d:'redo' },
    disbursed :{ v:'disbursed',  role:'fund',  d:null  },
    terminated:{ v:'terminated', role:'fund',  d:null  },
    guest     :{ v:'fiat',       role:'guest', d:null  },
    other     :{ v:'fiat',       role:'other', d:null  },
    loading   :{ v:'fiat',       role:'fund',  d:null  },
    error     :{ v:'fiat',       role:'fund',  d:null  }
  },
  'P-LS-08':{
    left      :{ v:'confirm',     role:'asset', d:'confirm' },
    soon      :{ v:'soon',        role:'asset', d:'confirm' },
    coin      :{ v:'confirmCoin', role:'asset', d:'confirm' },
    overdue   :{ v:'overdue',     role:'asset', d:'confirm' },
    covDrop   :{ v:'covDrop',     role:'asset', d:'confirm' },
    funder    :{ v:'confirm',     role:'fund',  d:'confirm' },
    confirmed :{ v:'confirmed',   role:'asset', d:null      },
    guest     :{ v:'confirm',     role:'guest', d:null      },
    other     :{ v:'confirm',     role:'other', d:null      },
    loading   :{ v:'confirm',     role:'asset', d:null      },
    error     :{ v:'confirm',     role:'asset', d:null      }
  }
};
function syncState(){
  var m = (ST[S.page] || {})[S.st];
  if(!m) return;
  S.variant = m.v; S.role = m.role; S.drawer = m.d;
  S.disp = null; S.reason = ''; S.modal = null; S.sealIdx = 1; S.zoom = 'fit'; S.split = 'even';
  S.f = { given:'2026-09-15 14:00', hash:'', memo:'', recv:'', files:[], extra:[], seal:null, upErr:null, shown:false,
          rName:'', rAcct:'', rSwift:'', rBank:'', rCorr:'' };
  /* 演示预填：真实系统里由资金方逐项填写，这里预填只是免去评审手打五个字段。
     「缺中转行」那一档刻意留空 rCorr，用来验 AC-LN-26 的"只填四项必须被拦下"。 */
  S.f.rName  = 'Beian Leasing Co., Ltd. (demo)';
  S.f.rAcct  = 'GB29NWBK60161331926819';
  S.f.rSwift = 'NWBKGB2L';
  S.f.rBank  = 'NatWest Bank, London Branch';
  S.f.rCorr  = (m.repay === 'noCorr') ? '' : 'Citibank N.A., New York';
  S.out = 'ok'; S.cout = 'ok';
}
function skel(){
  return CF.pageStates() + '<div class="card"><div class="card-b">' +
    '<div class="skel" style="height:54px"></div><div class="skel" style="height:190px;margin-top:16px"></div>' +
    '<div class="skel" style="height:120px;margin-top:16px"></div></div></div>';
}
function failCard(){
  return CF.pageStates() + '<div class="card"><div class="tbl-empty"><b>' +
    L('This deal could not be loaded','业务加载失败') + '</b>' +
    L('The server did not return the disbursement record or the closing time of the confirmation window. <b>The countdown is rendered from the closing time the server gives</b> — the page never derives it from local time, because a clock offset would put the page and the server on different answers. You can retry.',
      '服务端未返回放款记录与确认时限的到期时刻。<b>倒计时由服务端给出到期时刻、前端只负责渲染</b>——前端按本地时间推算会在跨时区与时钟偏差下与服务端判定不一致。可重试。') +
    '<div style="margin-top:14px"><button class="btn primary" type="button" data-act="st" data-v="' +
    (S.page === 'P-LS-08' ? 'left' : 'fiat') + '">' + L('Reload','重新加载') + '</button></div></div></div>';
}

var mod = {
  id:'lending-disbursement', end:'asset', home:'P-LS-07',
  /* 顶栏导航文案沿用 WS-324 的键，保证两个文件的菜单一字不差 */
  dict:{ en:{ navPlaza:'Marketplace', navMyProjects:'My projects' },
         zh:{ navPlaza:'借贷广场', navMyProjects:'我的融资项目' } },
  owns:['P-LS-07','P-LS-08'],
  topbarPrd:false,
  states:{
    'P-LS-07':[['fiat','Fiat · default','法币 · 默认'],
               ['coin','Stablecoin','数币 USDT'],
               ['short','Coverage short','覆盖不足 · 放款 ⊘'],
               ['noCorr','Repayment account · no correspondent bank','还款账户 · 缺中转行'],
               ['reupload','Re-upload requested','已要求重传（资金方视角）'],
               ['onhold','On hold · project matured','已暂缓 · 项目已到期'],
               ['reupAsset','Re-upload drawer','重传抽屉（资产方视角）'],
               ['disbursed','Already disbursed','已提交放款 · 入口关闭'],
               ['terminated','Terminated','已终止'],
               ['guest','Not signed in','未登录'],
               ['other','Third party','非当事方'],
               ['loading','Loading','加载中'],
               ['error','Load failed','加载失败']],
    'P-LS-08':[['left','2 days left','剩余 2 天'],
               ['soon','Under 24 hours','不足 24 小时'],
               ['coin','Stablecoin','数币 · 哈希与区块浏览器'],
               ['overdue','Window elapsed','已超过确认时限'],
               ['covDrop','Coverage dropped','放款后覆盖跌破 · 确认照常'],
               ['funder','Funder view','资金方视角 · 等待确认'],
               ['confirmed','Confirmed','已确认 · 还款中'],
               ['guest','Not signed in','未登录'],
               ['other','Third party','非当事方'],
               ['loading','Loading','加载中'],
               ['error','Load failed','加载失败']]
  },
  state:function(){
    /* 面客端默认英文（WS-324 D-LS-15）；中文由顶栏语言开关切换 */
    return { lang:'en', role:'fund', variant:'fiat', drawer:'disb', modal:null,
             zoom:'fit', split:'even', sealIdx:1, disp:null, reason:'', out:'ok', cout:'ok',
             f:{ given:'2026-09-15 14:00', hash:'', memo:'', recv:'', files:[], extra:[], seal:null, upErr:null, shown:false,
        rName:'', rAcct:'', rSwift:'', rBank:'', rCorr:'' } };
  },
  onBoot:function(st){ S = st; syncState(); },
  onSetState:function(){ syncState(); },
  onGo:function(){ syncState(); },
  crumbParts:function(){ return []; },
  content:function(){
    if(S.st === 'loading') return skel();
    if(S.st === 'error') return failCard();
    return hostPage();
  },
  drawers:{ disb:drawerDisb, confirm:drawerConfirm, redo:drawerRedo },
  modals:MODALS,
  hash:{
    build:function(){
      var id = 'FD-20260908-0061';
      var act = S.drawer === 'confirm' ? 'confirm_disbursement' : S.drawer === 'redo' ? 'reupload_contract' : 'disburse';
      return '#/deal/' + id + (S.drawer ? '?action=' + act : '');
    },
    read:function(){
      var h = (location.hash || '').replace(/^#\/?/, ''); if(!h) return false;
      var parts = h.split('?'), seg = parts[0].split('/'), qs = {};
      (parts[1] || '').split('&').forEach(function(kv){
        var i = kv.indexOf('='); if(i > 0) qs[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); });
      if(seg[0] !== 'deal') return false;
      var a = qs.action || 'disburse';
      /* 锚点语义：落详情页 + 打开对应抽屉（分册 6.7.1）；三个处置动作不各占锚点 */
      if(a === 'confirm_disbursement'){ S.page = 'P-LS-08'; S.st = 'left'; }
      else if(a === 'reupload_contract'){ S.page = 'P-LS-07'; S.st = 'reupAsset'; }
      else { S.page = 'P-LS-07'; S.st = 'fiat'; }
      syncState();
      return true;
    }
  },
  onAct:function(n, a, v){
    if(a.indexOf('ln.') !== 0) return false;
    var d;
    switch(a){
      case 'ln.open':   S.drawer = v; S.disp = null; CF.render(); return true;
      case 'ln.close':  S.drawer = null; S.disp = null; S.reason = ''; CF.render(); return true;
      case 'ln.zoom':   S.zoom = v; CF.render(); return true;
      case 'ln.split':  S.split = v; CF.render(); return true;
      case 'ln.seal':   S.sealIdx = +v; CF.render(); return true;
      case 'ln.f':      return true;   /* 字段回写走下面自挂的 input / change 一层 */
      case 'ln.disp':   S.disp = v; S.reason = ''; CF.render(); return true;
      case 'ln.dispCancel': S.disp = null; S.reason = ''; CF.render(); return true;
      case 'ln.signin':
        toast('info', L('Sign-in lives in the account module','登录在账户模块'),
          L('Public commercial terms stay visible without an account; only actions need one. Signing in is handled by the sign-in module, not here.',
            '公开商务条款不登录也看得到，需要账号的只是操作。登录由金融服务端登录模块承载，不在本模块内。'));
        return true;
      case 'ln.why':
        d = deal();
        var cv = coverage(d);
        toast('info', L('Disbursement is on hold','该操作当前不可用'),
          L('Pledge coverage is insufficient: coverage gap ' + usd(cv.gap) + ', the asset owner needs to add ' +
            usd(cv.addAsset) + ' of asset value. The three handling actions inside the drawer stay available.',
            '质押覆盖不足：覆盖缺口 ' + usd(cv.gap) + '，需资产方追加资产价值 ' + usd(cv.addAsset) +
            '。抽屉内的三个处置动作照常可用。'));
        return true;
      case 'ln.dl':
        toast('info', L('No real file in the prototype','原型内不提供真实文件'),
          L('The real system embeds a preview and serves an authenticated download; the file is reachable by the two parties of this deal only, never through a guessable public link.',
            '真实系统在此内嵌预览并提供鉴权下载；文件仅该笔业务双方可访问，不使用可猜测的公开直链。'));
        return true;
      case 'ln.copy':
        d = deal();
        toast('info', L('Address and IDs copied','已复制邮箱与编号'),
          MAIL + ' · ' + g('demandNo') + ' ' + d.fp + ' · ' + g('dealNo') + ' ' + d.id);
        return true;
      /* ---- 上传：第二个文件演示格式/大小不合规，已传文件保留（E-LN-06） ---- */
      case 'ln.up': {
        if(v === 'seal'){
          S.f.seal = { n:['sealed-contract-corrected.pdf','融资合同-双方盖章件-更正版.pdf'], s:'2.6 MB' };
          CF.render(); return true;
        }
        var list = v === 'extra' ? S.f.extra : S.f.files;
        var cap = v === 'extra' ? EXTRA_MAX_N : FIAT_MAX_N;
        if(list.length >= cap){
          S.f.upErr = L('At most ' + cap + ' files; ' + list.length + ' already uploaded. The ones already there are kept — remove one first.',
            '最多 ' + cap + ' 个文件，当前已有 ' + list.length + ' 个。已上传的文件保留，请先移除一个再继续。');
          CF.render(); return true;
        }
        if(v !== 'extra' && list.length === 1 && !S.f.shown){
          S.f.shown = true;
          S.f.upErr = L('"wire-advice-back.tiff" was not accepted: (1) TIFF is not among PDF / JPG / PNG; (2) 12.6 MB exceeds the ' +
              FILE_MAX_MB + ' MB per-file limit. <b class="ls-b">The files already uploaded are kept</b>, nothing to re-upload.',
            '文件「电汇凭证-背面.tiff」未通过：① 格式为 TIFF，本期只接受 PDF / JPG / PNG；② 大小 12.6 MB，超过单文件 ' +
              FILE_MAX_MB + ' MB 上限。<b class="ls-b">已上传的其他文件保留</b>，无需重传。');
          CF.render(); return true;
        }
        S.f.upErr = null;
        list.push(v === 'extra'
          ? { n:['wallet-transfer-screenshot.png','钱包转账截图.png'], s:'0.4 MB' }
          : { n:['wire-transfer-advice-' + (list.length + 1) + '.pdf', '电汇凭证-回单-' + (list.length + 1) + '.pdf'],
              s:(0.7 + list.length * 0.3).toFixed(1) + ' MB' });
        CF.render(); return true;
      }
      case 'ln.rm':  S.f.files.splice(+v, 1); S.f.upErr = null; CF.render(); return true;
      case 'ln.rmx': S.f.extra.splice(+v, 1); CF.render(); return true;
      /* ---- 三个处置动作 ---- */
      case 'ln.dispGo': {
        var r = (S.reason || '').trim();
        if(!r || r.length > REASON_MAX) return true;
        if(v === 'stop'){ S.modal = { type:'stop' }; CF.render(); return true; }
        S.disp = null; S.reason = '';
        toast('success',
          v === 'hold' ? L('Disbursement put on hold','已登记暂不放款') : L('Re-upload requested','已要求重传盖章件'),
          v === 'hold'
            ? L('The deal is still awaiting disbursement and no amount moved. The reason is visible to the asset owner, and you can disburse at any time — that clears the mark by itself.',
                '业务仍是待放款，四个量一个不变；原因对资产方可见。您随时可以直接放款，提交时标记自动清除。')
            : L('The asset owner now has an upload entry and one notification. A successful re-upload clears the mark by itself; your disbursement entry stays available meanwhile.',
                '资产方获得重传入口并收到一条通知。重传成功即自动清除标记；重传期间您的放款入口照常可用。'));
        CF.render(); return true;
      }
      case 'ln.stopGo':
        S.modal = null; S.drawer = null; S.disp = null; S.reason = '';
        toast('success', L('Deal terminated','业务已终止'),
          L('The committed quote amount was released in full and did not move into used credit; the demand is back to awaiting quotes and any funder may quote again.',
            '在途报价占用全额释放且不进授信占用额；该需求退回待报价，可被任何机构重新报价。'));
        CF.render(); return true;
      /* ---- 提交放款：六类结局 ---- */
      case 'ln.submitAsk': S.modal = { type:'submit' }; CF.render(); return true;
      case 'ln.submitGo': {
        var out = (q('#submitOut') || {}).value || S.out || 'ok';
        d = deal(); S.modal = null;
        if(out === 'ok'){
          S.drawer = null;
          toast('success', L('Disbursement record submitted','放款记录已提交'),
            L('The deal moves to awaiting disbursement confirmation and the ' + CONFIRM_HOURS +
              '-hour window starts from the server time of this submission. <b>None of the four amounts moves yet.</b>',
              '业务转「待放款确认」，' + CONFIRM_HOURS + ' 小时确认时限从本次提交的服务端时间开始计时。<b>四个量一个都不动。</b>'));
        } else if(out === 'cov'){
          var c2 = coverage(d);
          toast('danger', L('Rejected: coverage insufficient at submission','提交被拒：提交瞬间覆盖不足'),
            L('The server rechecked at submission time and the invariant no longer holds — coverage gap ' +
                usd(Math.max(c2.gap, 60000)) + '. <b>No record was created and nothing changed.</b> You can still hold the disbursement or terminate the deal.',
              '服务端在提交时刻重算，不变式不再成立——覆盖缺口 ' + usd(Math.max(c2.gap, 60000)) +
                '。<b>不产生放款记录、不改状态、不动额度。</b>您仍可改走「暂不放款」或「终止业务」。'));
        } else if(out === 'race'){
          S.drawer = null;
          toast('info', L('This deal already has a disbursement record','该业务已提交放款记录'),
            L('Concurrent submissions settle in series and the first one wins; this one created no second record and reserved no ID. You are back on the deal page.',
              '并发提交串行结算、先落库者成功；本次不产生第二条记录、不占号。页面已落回业务详情。'));
        } else if(out === 'moved'){
          S.drawer = null;
          toast('info', L('The deal had already left "awaiting disbursement"','该业务已不在待放款'),
            L('A colleague terminated it moments ago. The submission is settled against the authoritative state at that instant and rejected — no 404, no blank screen, you simply land back here.',
              '同事刚刚终止了它。按提交时刻的权威状态结算并拒绝——不报 404、不白屏，页面落回详情。'));
        } else {
          S.f.upErr = L('"wire-advice-back.tiff" was not accepted: TIFF is not among PDF / JPG / PNG, and 12.6 MB exceeds the ' +
              FILE_MAX_MB + ' MB per-file limit. <b class="ls-b">The files already uploaded are kept.</b>',
            '文件「电汇凭证-背面.tiff」未通过：格式为 TIFF（只接受 PDF / JPG / PNG），且 12.6 MB 超过单文件 ' +
              FILE_MAX_MB + ' MB 上限。<b class="ls-b">已上传的其他文件保留。</b>');
          toast('danger', L('The receipt was not accepted','凭证未通过'),
            L('The reason is shown in place on the upload field; the other files are untouched.','原因就地显示在上传区，其他文件不受影响。'));
        }
        CF.render(); window.scrollTo(0, 0); return true;
      }
      /* ---- 确认到账：三类结局 ---- */
      case 'ln.confirmAsk': S.modal = { type:'confirm' }; CF.render(); return true;
      case 'ln.confirmGo': {
        var co2 = (q('#confirmOut') || {}).value || S.cout || 'ok';
        d = deal(); S.modal = null;
        if(co2 === 'settle'){
          toast('info', L('Settlement rolled back as a whole','结算整体回滚'),
            L('The deal stays at awaiting disbursement confirmation and every amount is exactly as before. Five things must take effect in one settlement or none at all, so a partial failure rolls the whole thing back. You can retry.',
              '业务保持「待放款确认」，四个量与确认前完全一致。五件事必须在同一次结算内一致生效，部分失败即整体回滚。可重试。'));
        } else if(co2 === 'plan'){
          S.drawer = null;
          toast('success', L('Confirmed · repayment schedule pending','已确认 · 还款计划生成中'),
            L('The amounts moved and the state changed — that part is final, because the money did arrive. Only the schedule is still being generated; the deal page shows "schedule pending" rather than an error.',
              '额度已转移、状态已迁移——这部分不回滚，因为钱确实到了。只有还款计划还在生成中，详情页展示"还款计划生成中"而不是错误。'));
        } else {
          S.drawer = null;
          toast('success', L('Receipt confirmed','已确认到账'),
            L('The deal moves to repaying. Committed demand moved into outstanding financing and the committed quote amount into used credit — all four amounts took effect in the same settlement.',
              '业务转「还款中」。项目在途金额转入项目融资余额、在途报价占用转入授信占用额，四个量同刻生效。'));
        }
        CF.render(); window.scrollTo(0, 0); return true;
      }
      /* ---- 资产方重传 ---- */
      case 'ln.redoGo':
        if(!S.f.seal) return true;
        S.drawer = null; S.f.seal = null;
        toast('success', L('Sealed contract re-uploaded','盖章件已重传'),
          L('The mark cleared by itself, the funder sees the new version in the check pane straight away and their disbursement entry is available. Every earlier version is still there.',
            '标记已自动清除，机构侧核验区立即出现新版本、放款入口可用；历史版本一份不少。'));
        CF.render(); return true;
      case 'ln.mclose':
        if(n.classList.contains('mask') || n.classList.contains('modal-x') || n.tagName === 'BUTTON'){
          S.modal = null; CF.render();
        }
        return true;
    }
    return false;
  }
};

/* ---- 表单回写 ----
   公共壳层头部注释声明了 onInput(n,k) 但全文只挂了 click（仍未实装，README §6 第 6 条）。
   本模块自挂一层，只认 data-act="ln.f"，不接管公共层分发、不改 _shared。
   change 触发的重绘**推迟一拍**：change 常在 blur 的派发过程中触发，
   此时同步改写 #content 会抛 "The node to be removed is no longer a child of this node"，
   并可能把紧随其后的那一次点击一起吞掉。WS-325 仍受这个问题影响。 */
function writeField(k, val){
  if(k === 'given') S.f.given = val;
  else if(k === 'hash') S.f.hash = val;
  else if(k === 'memo') S.f.memo = val;
  else if(k === 'recv') S.f.recv = val;
  else if(k === 'reason') S.reason = val;
  else if(k === 'rName' || k === 'rAcct' || k === 'rSwift' || k === 'rBank' || k === 'rCorr') S.f[k] = val;
  else if(k === 'submitOut') S.out = val;
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
  setTimeout(function(){ CF.render(); }, 0);
});

CF.define(mod);
CF.boot();
})();
