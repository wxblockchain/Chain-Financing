/* ================================================================
   40-ui.js —— 共用组件层
   两个招牌件：三数等式（AC-LS-53）与额度尺（INV-FIN-01 的可视化读数）。
   后续模块新增页面时复用本层，不要各自造一套。
   ================================================================ */

/* ---- 徽标 ---- */
function tag(tone, t, dot){
  return '<span class="tag ' + tone + '">' + (dot ? '<i class="dot"></i>' : '') + esc(t) + '</span>';
}
function statusTags(p){
  var d = derive(p), s = FP_STATUS[p.status], g = gradeMeta(d.grade), out = [];
  out.push(tag(s.tone, s.t, true));
  /* 到期分支②按正常状态呈现：中性样式，不做告警（D-FIN-47） */
  if(p.expired) out.push(tag('plain', '已到期 · 存量融资业务照常履约中'));
  var ef = expiryFlag(p);
  if(ef && !p.expired) out.push(tag(ef.tone, ef.t));
  out.push(tag(g.tone, '担保状态：' + g.t, true));
  if(p.emptyPool) out.push(tag('warn', '空池草稿 · 暂无有效质押'));
  return out.join('');
}

/* ---- 三数等式：① 有效质押价值 × ② 质押率 = ③ 融资上限 ---- */
function trioBlock(d){
  return '' +
  '<div class="trio">' +
    '<div class="cell">' +
      '<div class="idx">① 参与计算</div>' +
      '<div class="lb">有效质押价值<span class="tag plain">FP-11</span></div>' +
      '<div class="amt">' + amt(d.valid) + '</div>' +
      '<div class="fixed">' + CCY + ' · 已排除失效、未上链、对账差异部分</div>' +
    '</div>' +
    '<div class="op" aria-hidden="true">×</div>' +
    '<div class="cell">' +
      '<div class="idx">② 质押率</div>' +
      '<div class="lb">质押率</div>' +
      /* 纯文本展示：无输入框 / 下拉 / 滑块 / 步进器，无焦点态（AC-LS-56 / D-MC-110 / D-MC-111） */
      '<div class="rate">' + (PLEDGE_RATE*100) + '%</div>' +
      '<div class="fixed">本期固定，不可调整</div>' +
    '</div>' +
    '<div class="op" aria-hidden="true">=</div>' +
    '<div class="cell out">' +
      '<div class="idx">③ ＝ ① × ②</div>' +
      '<div class="lb">融资上限<span class="tag plain">FP-12</span></div>' +
      '<div class="amt">' + amt(d.cap) + '</div>' +
      '<div class="fixed">' + CCY + ' · 一切担保充足性判断的比较对象</div>' +
    '</div>' +
  '</div>' +
  '<div class="trio-sub">池内资产总额 <span class="n">' + usd(d.total) + '</span>，其中 <span class="n">' + usd(d.dead) +
    '</span>（' + d.deadCount + ' 张）因底层资产失效不计入担保。账面总额不参与任何校验。</div>';
}

/* ---- 额度尺：一条尺上读出 融资上限 / 余额 / 在途 / 可融 / 担保缺口 ---- */
function meterBlock(d, mini){
  var used = d.bal + d.fly;
  var scale = Math.max(d.cap, used) * 1.03 || 1;
  var pct = function(v){ return (v / scale * 100); };
  var balIn  = Math.min(d.bal, d.cap);
  var balOver= Math.max(0, d.bal - d.cap);
  var capPct = pct(d.cap);
  var segs = '';
  if(balIn > 0)   segs += '<div class="seg bal"  style="width:' + pct(balIn).toFixed(3) + '%"></div>';
  if(balOver > 0) segs += '<div class="seg gap"  style="width:' + pct(balOver).toFixed(3) + '%"></div>';
  if(d.fly > 0)   segs += '<div class="seg fly"  style="width:' + pct(d.fly).toFixed(3) + '%"></div>';
  if(d.free > 0)  segs += '<div class="seg free" style="width:' + pct(d.free).toFixed(3) + '%"></div>';
  var lbShift = capPct > 80 ? 'transform:translateX(-100%);padding-right:4px' : 'transform:translateX(-50%)';

  var legend =
    '<span><i class="cap"></i>融资上限 <b>' + amt(d.cap) + '</b></span>' +
    '<span><i class="bal"></i>项目融资余额 <b>' + amt(d.bal) + '</b></span>' +
    '<span><i class="fly"></i>项目在途金额 <b>' + amt(d.fly) + '</b></span>' +
    '<span><i class="free"></i>可融金额 <b>' + amt(d.free) + '</b></span>' +
    (d.gap > 0 ? '<span><i class="gap"></i>担保缺口 <b>' + amt(d.gap) + '</b></span>' : '');

  return '<div class="meter' + (mini?' mini':'') + '"><div class="mwrap">' +
    '<div class="track" role="img" aria-label="额度尺：融资上限 ' + amt(d.cap) + ' USD，项目融资余额 ' + amt(d.bal) +
      ' USD，项目在途金额 ' + amt(d.fly) + ' USD，可融金额 ' + amt(d.free) + ' USD">' + segs + '</div>' +
    '<div class="capline" style="left:' + capPct.toFixed(3) + '%"></div>' +
    (mini ? '' : '<div class="caplb" style="left:' + capPct.toFixed(3) + '%;' + lbShift + '">融资上限 ' + amt(d.cap) + '</div>') +
    '</div><div class="legend">' + legend + '</div>' +
  '</div>';
}

/* ---- 担保档位三档（D-FIN-55：预警线与准入闸门分别定义、分别呈现） ---- */
function gradesBlock(d){
  return '<div class="grades">' + GRADES.map(function(g){
    var on = (g.k === d.grade);
    return '<div class="g' + (on ? ' on ' + g.tone : '') + '">' +
      '<b>' + (on ? '● ' : '○ ') + g.t + '</b>' + esc(g.x) + '</div>';
  }).join('') + '</div>';
}

/* ---- 担保不足预警条：中性事实文案，不用评价性措辞（D-FIN-56） ---- */
function shortAlert(p, d, withAction){
  if(d.grade !== 'short') return '';
  return '<div class="note crit" style="margin-bottom:14px">' +
    '<span class="ic">!</span><div class="bd">' +
    '<b>担保不足</b>：当前池内有效质押价值低于项目融资余额，缺口 <span class="n">' + usd(d.gap) + '</span>，自 ' +
    (d.shortFrom || '—') + ' 起。' +
    '<p>需追加资产价值 <span class="n">' + usd(d.need) + '</span>（＝担保缺口 ÷ ' + (PLEDGE_RATE*100) + '%）。' +
    '只按缺口追加不足以解除——追加的是资产，参与计算的是资产的 ' + (PLEDGE_RATE*100) + '%。' +
    '条件反转（追加质押抬高融资上限，或还款降低项目融资余额）即自动解除，无需人工确认。</p>' +
    '<p>诱因：池内 ' + d.deadCount + ' 张代币底层应收账款已失效，价值合计 ' + usd(d.dead) + '，自失效之日起不计入有效质押价值。</p>' +
    '</div>' + (withAction ? '<div class="act"><button class="btn sm" onclick="openPledge(\'' + p.id + '\')">追加质押</button></div>' : '') +
  '</div>';
}

/* ---- 额度用尽档：成立但不预警，必须与档③分开说（D-FIN-55） ---- */
function usedUpNote(d){
  if(d.grade !== 'used-up') return '';
  return '<div class="note warn" style="margin-bottom:14px"><span class="ic">i</span><div class="bd">' +
    '<b>额度用尽</b>：可融金额为 <span class="n">' + usd(0) + '</span>，暂不能新增占用。' +
    '<p>已发生的债务仍有足额担保（融资上限 ' + usd(d.cap) + ' ≥ 项目融资余额 ' + usd(d.bal) + '），' +
    '<b>这不是担保不足预警</b>。此档下可撤回上限同为 ' + usd(0) + '；追加质押可抬高融资上限并重新打开额度。</p>' +
    '</div></div>';
}

/* ---- 可提取常驻提示（AC-LS-38）：不得让资产方以为代币会自动回到钱包 ---- */
function redeemBanner(){
  if(state.role !== 'asset' || REDEEMABLE.length === 0) return '';
  var sum = REDEEMABLE.reduce(function(a,t){ return a + t.amt; }, 0);
  return '<div class="note info" style="margin-bottom:14px"><span class="ic">↧</span><div class="bd">' +
    '您有 <b>' + REDEEMABLE.length + ' 张</b>代币（合计 <span class="n">' + usd(sum) + '</span>）可提取。' +
    '<p>业务上已释放，链上仍停留在质押合约内，<b>不会自动回到钱包</b>；需您自行发起提取并自付 gas，支持批量一次提完，无时间限制、不过期。' +
    '未提取前不属于任何资产池、不计入任何质押价值，也不能被再次质押。</p>' +
    '</div><div class="act"><button class="btn sm primary" onclick="openRedeem()">批量提取</button></div></div>';
}

/* ---- 动作按钮：区分「不可见」与「可见不可点 ⊘」（H-03） ---- */
function actionBtn(a, handler, size){
  var cls = 'btn' + (size ? ' ' + size : '') + (a.primary && a.enabled ? ' primary' : '');
  if(a.enabled){
    return '<button class="' + cls + '" onclick="' + handler + '">' + esc(a.label) + '</button>';
  }
  return '<button class="btn blocked' + (size ? ' ' + size : '') + '" aria-disabled="true" ' +
         'onclick="toast(' + JSON.stringify(a.reason).replace(/"/g,'&quot;') + ')">' +
         '<span class="sig" aria-hidden="true">⊘</span>' + esc(a.label) + '</button>' +
         '<div class="why"><span class="sig" aria-hidden="true">⊘</span><span>' + esc(a.reason) +
         (state.role === 'guest' ? ' <button class="btn link" onclick="signIn()">登录 / 注册</button>' : '') +
         '</span></div>';
}

/* ---- 通用状态：加载中 / 空 / 筛选无结果 / 加载失败 ---- */
function skeletonCards(n){
  var h = '', i;
  for(i=0;i<(n||3);i++){
    h += '<div class="pcard"><div class="top">' +
      '<div class="pool"><div class="sk" style="height:13px;width:70px"></div><div class="sk" style="height:19px;width:64%;margin-top:12px"></div>' +
      '<div class="sk" style="height:13px;width:40%;margin-top:9px"></div><div class="sk" style="height:44px;margin-top:14px"></div></div>' +
      '<div class="fin"><div class="sk" style="height:13px;width:70px"></div><div class="sk" style="height:30px;width:46%;margin-top:12px"></div>' +
      '<div class="sk" style="height:22px;width:72%;margin-top:12px"></div><div class="sk" style="height:44px;margin-top:14px"></div></div>' +
      '</div><div class="bot"><div class="sk" style="height:16px;flex:1"></div></div></div>';
  }
  return '<div class="plist" aria-busy="true">' + h + '</div>';
}
function blankState(ic, title, body, btn){
  return '<div class="card"><div class="blank"><div class="ic">' + ic + '</div><h3>' + esc(title) + '</h3><p>' + body + '</p>' +
    (btn || '') + '</div></div>';
}

/* ---- 弹层 ---- */
function openScrim(html){
  document.getElementById('scrimBody').innerHTML = html;
  var s = document.getElementById('scrim'); s.classList.add('on');
  var f = s.querySelector('[data-autofocus]'); if(f) f.focus();
}
function closeScrim(){ document.getElementById('scrim').classList.remove('on'); }
document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeScrim(); });
document.getElementById('scrim').addEventListener('mousedown', function(e){ if(e.target === this) closeScrim(); });

function toast(msg){
  var box = document.getElementById('toast');
  var el = document.createElement('div'); el.className = 't'; el.textContent = msg;
  box.appendChild(el);
  setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 4200);
}
function signIn(){
  toast('登录 / 注册流程不在本模块范围内（本原型直接用底部演示条切换身份）。');
}

/* ---- 外部签名 SDK（D-FIN-71）：平台不自建钱包连接组件 ---- */
/* cfg: { title, rows:[[k,v]], gas, n, onDone(outcomeKey) } */
var sdkCfg = null;
function openSDK(cfg){
  sdkCfg = cfg;
  openScrim(
    '<div class="sdk" role="dialog" aria-label="外部签名 SDK">' +
      '<div class="sh"><span class="mk">S</span><b>外部签名 SDK 服务</b><span>第三方界面 · 非平台页面</span></div>' +
      '<div class="sb">' +
        cfg.rows.map(function(r){ return '<div class="kk"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>'; }).join('') +
        '<div class="kk"><span>预估 gas</span><b>' + cfg.gas + ' ETH</b></div>' +
        '<div class="kk"><span>承担方</span><b>' + esc(ACTORS.asset.full) + '</b></div>' +
      '</div>' +
      '<div class="sim">原型内的结果模拟：选择本次链上返回，用于走通分册 6.7.2 的五类失败与等待页面态' +
        '<select id="sdkOutcome">' +
          '<option value="ok">全部成功（CT-2）</option>' +
          '<option value="partial">部分成功 · 按张独立结算（E-2）</option>' +
          '<option value="offchain">未上链失败 · 未扣费</option>' +
          '<option value="onchain">已上链失败 · 已扣费</option>' +
          '<option value="timeout">超时未决（&gt; ' + CHAIN_TIMEOUT + ' 分钟）</option>' +
          '<option value="nogas">gas 不足</option>' +
        '</select>' +
      '</div>' +
      '<div class="sf">' +
        '<button class="btn" onclick="sdkCancel()">取消</button>' +
        '<button class="btn primary" data-autofocus onclick="sdkSign()">签名并支付</button>' +
      '</div>' +
    '</div>');
}
function sdkCancel(){ var c = sdkCfg; closeScrim(); if(c) c.onDone('cancel'); }
function sdkSign(){
  var v = document.getElementById('sdkOutcome').value, c = sdkCfg;
  closeScrim(); if(c) c.onDone(v);
}

/* ---- 二次确认 + 费用区（AC-LS-32）：唤起 SDK 前必须先说清操作内容与 gas ---- */
function confirmChain(cfg){
  openScrim(
  '<div class="modal">' +
    '<div class="mh"><h2>' + esc(cfg.title) + '</h2><p>唤起外部签名 SDK 前，请先确认本次链上操作的内容与费用</p></div>' +
    '<div class="mb">' +
      '<div class="cost">' +
        cfg.rows.map(function(r){ return '<div class="row"><span class="k">' + esc(r[0]) + '</span><span class="v' +
          (r[2] ? ' txt' : '') + '">' + esc(r[1]) + '</span></div>'; }).join('') +
        '<div class="row"><span class="k">本次链上操作笔数</span><span class="v">' + cfg.n + ' 笔</span></div>' +
        '<div class="row"><span class="k">预估 gas</span><span class="v">' + cfg.gas + ' ETH</span></div>' +
        '<div class="row"><span class="k">承担方</span><span class="v txt">' + esc(ACTORS.asset.full) + '（本企业）</span></div>' +
        '<div class="foot">gas 由区块链收取，<b>平台不代付、不垫付，也不对质押 / 撤回 / 提取收取任何服务费</b>。' +
        '链上失败也可能已经产生费用。批量一次提交是最有效的降费手段：' + cfg.n + ' 笔已合并为一次提交。</div>' +
      '</div>' +
      (cfg.extra || '') +
    '</div>' +
    '<div class="mf"><button class="btn" onclick="closeScrim()">取消</button>' +
    '<button class="btn primary" data-autofocus onclick="chainGo()">确认并唤起签名</button></div>' +
  '</div>');
  pendingChain = cfg;
}
var pendingChain = null;
function chainGo(){
  var c = pendingChain;
  openSDK({ rows:c.rows, gas:c.gas, n:c.n, onDone:c.onDone });
}

/* ---- 五类失败 / 等待的结果页面态（分册 6.7.2；不允许只写"操作失败"） ---- */
function chainResultCard(o, ctx){
  if(o.k === 'ok' || o.k === 'partial') return '';
  return '<div class="note ' + (o.tone === 'mute' ? '' : o.tone) + '"><span class="ic">' +
    (o.k === 'timeout' ? '⧗' : '!') + '</span><div class="bd"><b>' + esc(o.head) + '</b>' +
    '<p>' + esc(o.body) + '</p><p>费用：' + esc(o.fee) + '</p>' +
    '<p style="margin-top:8px">' +
      (o.k === 'timeout'
        /* 超时态不出现重试按钮，只给「查询链上状态」（AC-LS-74 / D-FIN-70） */
        ? '<button class="btn sm" onclick="queryChain()">查询链上状态</button>'
        : '<button class="btn sm" onclick="' + (ctx.retry || 'closeScrim()') + '">' + esc(o.retry) + '</button>') +
    '</p></div></div>';
}
function queryChain(){
  toast('正在查询链上状态……（原型内为模拟）确认未上链后，重试入口才会出现——沿用 WS-318 S-TI-5 红线，超时态不得直接重试。');
}
