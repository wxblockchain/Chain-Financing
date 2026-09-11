/* ================================================================
   40-ui.js —— 共用组件层
   两个招牌件：三数等式（AC-LS-53）与额度尺（INV-FIN-01 的可视化读数）。
   本版的原则：层级靠字号与留白建立，颜色只用在"必须一眼看到"的地方。
   后续模块新增页面时复用本层，不要各自造一套。
   ================================================================ */

/* ---- 徽标 ---- */
function tag(tone, t, dot){
  return '<span class="tag ' + tone + '">' + (dot ? '<i class="dot"></i>' : '') + esc(t) + '</span>';
}
/* 主视图只挂"改变判断"的标记；解释性文字下沉到折叠层 */
function statusTags(p, compact){
  var d = derive(p), s = FP_STATUS[p.status], g = gradeMeta(d.grade), out = [];
  out.push(tag(s.tone, s.t, true));
  if(d.grade !== 'normal') out.push(tag(g.tone, g.t, true));
  if(p.expired) out.push(tag('plain', '已到期 · 存量融资业务照常履约中'));
  var ef = expiryFlag(p);
  if(ef && !p.expired) out.push(tag(ef.tone, ef.t));
  if(p.emptyPool) out.push(tag('warn', '空池草稿 · 暂无有效质押'));
  if(!compact && p.quotes) out.push(tag('plain', '已收到报价 ' + p.quotes + ' 笔'));
  return out.join('');
}

/* ---- 三数等式：① 有效质押价值 × ② 质押率 = ③ 融资上限 ----
   ③ 是资金方与资产方都要先读到的那个数，给它 44px 与唯一的一处主色。 */
function trioBlock(d){
  return '' +
  '<div class="trio">' +
    '<div class="cell">' +
      '<div class="idx">① 参与计算</div>' +
      '<div class="lb">有效质押价值</div>' +
      '<div class="amt">' + amt(d.valid) + '</div>' +
      '<div class="fixed">' + CCY + ' · 已排除失效、未上链、对账差异</div>' +
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
      '<div class="lb">融资上限</div>' +
      '<div class="amt">' + amt(d.cap) + '</div>' +
      '<div class="fixed">' + CCY + ' · 一切担保充足性判断的比较对象</div>' +
    '</div>' +
  '</div>' +
  '<div class="trio-sub">池内资产总额 <span class="n">' + usd(d.total) + '</span>，其中 <span class="n">' + usd(d.dead) +
    '</span>（' + d.deadCount + ' 张）因底层资产失效不计入担保。账面总额不参与任何校验。</div>';
}

/* ---- 额度尺 ----
   完整版（详情 / 发布页）：余额 · 在途 · 可融 · 缺口 四段 + 上限刻度。
   迷你版（列表行）：合并为「已占用 / 可融」两段 + 缺口 —— 列表要回答的是
   "还有没有空间"，余额与在途的切分是详情页的问题，塞进 8px 高的条里只会变噪声。 */
function meterBlock(d, mini){
  var used = d.bal + d.fly;
  var scale = Math.max(d.cap, used) * 1.03 || 1;
  var pct = function(v){ return (v / scale * 100); };
  var balOver = Math.max(0, d.bal - d.cap);
  var capPct = pct(d.cap);
  var segs = '';
  if(mini){
    var usedIn = Math.min(used, d.cap);
    if(usedIn > 0)  segs += '<div class="seg bal"  style="width:' + pct(usedIn).toFixed(3) + '%"></div>';
    if(used > d.cap)segs += '<div class="seg gap"  style="width:' + pct(used - d.cap).toFixed(3) + '%"></div>';
    if(d.free > 0)  segs += '<div class="seg free" style="width:' + pct(d.free).toFixed(3) + '%"></div>';
  } else {
    var balIn = Math.min(d.bal, d.cap);
    if(balIn > 0)   segs += '<div class="seg bal"  style="width:' + pct(balIn).toFixed(3) + '%"></div>';
    if(balOver > 0) segs += '<div class="seg gap"  style="width:' + pct(balOver).toFixed(3) + '%"></div>';
    if(d.fly > 0)   segs += '<div class="seg fly"  style="width:' + pct(d.fly).toFixed(3) + '%"></div>';
    if(d.free > 0)  segs += '<div class="seg free" style="width:' + pct(d.free).toFixed(3) + '%"></div>';
  }
  var lbShift = capPct > 78 ? 'transform:translateX(-100%);padding-right:4px' : 'transform:translateX(-50%)';
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
    '</div>' + (mini ? '' : '<div class="legend">' + legend + '</div>') +
  '</div>';
}

/* ---- 担保三档：下沉到折叠层，改为紧凑三行，不再是三个色块 ---- */
function gradesBlock(d){
  return '<div style="display:flex;flex-direction:column;gap:10px">' + GRADES.map(function(g){
    var on = (g.k === d.grade);
    return '<div style="display:flex;gap:11px;align-items:baseline;font-size:var(--fs-sm);' +
      (on ? 'color:var(--ink)' : 'color:var(--ink-3)') + '">' +
      '<span style="font-family:var(--num);width:14px;flex:none' + (on ? ';color:var(--st-' + (g.tone) + ')' : '') + '">' +
        (on ? '●' : '○') + '</span>' +
      '<b style="font-weight:' + (on ? '650' : '500') + ';width:104px;flex:none">' + g.t + '</b>' +
      '<span>' + esc(g.x) + '</span></div>';
  }).join('') + '</div>';
}

/* ---- 担保不足预警：主视图唯一保留填色的提示块（D-FIN-56 中性事实文案） ---- */
function shortAlert(p, d, withAction){
  if(d.grade !== 'short') return '';
  return '<div class="note crit" style="margin-bottom:22px">' +
    '<span class="ic">!</span><div class="bd">' +
    '<b>担保不足</b>：池内有效质押价值低于项目融资余额，缺口 <span class="n">' + usd(d.gap) +
    '</span>，需追加资产价值 <span class="n">' + usd(d.need) + '</span>（＝缺口 ÷ ' + (PLEDGE_RATE*100) + '%），自 ' +
    (d.shortFrom || '—') + ' 起。' +
    '<p>诱因：池内 ' + d.deadCount + ' 张代币底层应收账款已失效（合计 ' + usd(d.dead) + '），不计入有效质押价值。' +
    '追加质押抬高融资上限或还款降低项目融资余额，条件反转即自动解除，无需人工确认。</p>' +
    '</div>' + (withAction ? '<div class="act"><button class="btn sm" onclick="openPledge(\'' + p.id + '\')">追加质押</button></div>' : '') +
  '</div>';
}

function usedUpNote(d){
  if(d.grade !== 'used-up') return '';
  return '<div class="note warn" style="margin-bottom:22px"><span class="ic">i</span><div class="bd">' +
    '<b>额度用尽</b>：可融金额为 <span class="n">' + usd(0) + '</span>，暂不能新增占用。' +
    '<p>已发生的债务仍有足额担保（融资上限 ' + usd(d.cap) + ' ≥ 项目融资余额 ' + usd(d.bal) + '），' +
    '<b>这不是担保不足预警</b>。追加质押可抬高融资上限并重新打开额度。</p>' +
    '</div></div>';
}

/* ---- 可提取常驻提示（AC-LS-38） ---- */
function redeemBanner(){
  if(state.role !== 'asset' || REDEEMABLE.length === 0) return '';
  var sum = REDEEMABLE.reduce(function(a,t){ return a + t.amt; }, 0);
  return '<div class="note info" style="margin-bottom:22px"><span class="ic">↧</span><div class="bd">' +
    '您有 <b>' + REDEEMABLE.length + ' 张</b>代币（合计 <span class="n">' + usd(sum) + '</span>）可提取。' +
    '<p>业务上已释放，链上仍停留在质押合约内，<b>不会自动回到钱包</b>；需您自行发起提取并自付 gas，支持批量一次提完，无时间限制、不过期。' +
    '未提取前不属于任何资产池、不计入任何质押价值，也不能被再次质押。</p>' +
    '</div><div class="act"><button class="btn sm" onclick="openRedeem()">批量提取</button></div></div>';
}

/* ---- 折叠层：第二层信息（验算与核对用，默认收起，信息仍然可达） ---- */
function fold(title, count, body, open){
  return '<details class="fold"' + (open ? ' open' : '') + '>' +
    '<summary><span class="caret" aria-hidden="true">▶</span>' + esc(title) +
    (count ? '<span class="cnt">' + esc(count) + '</span>' : '') + '</summary>' +
    '<div class="fb">' + body + '</div></details>';
}

/* ---- 融资进度：环节名取自 PRD 状态机 S-FP-*，后段明确标注为后续环节 ---- */
var FLOW = [
  { id:'S-FP-1', t:'草稿',   x:'已建池 · 未发布',          mine:true },
  { id:'S-FP-2', t:'募集中', x:'需求已发布 · 公开接受报价', mine:true },
  { id:'S-FP-3', t:'已锁定', x:'已被报价 · 暂不接受新报价', mine:true },
  { id:'S-FP-4', t:'融资中', x:'接受报价 → 放款 → 融资确认', mine:false, who:'WS-325 ～ WS-326' },
  { id:'S-FP-6', t:'已结清', x:'还款结清 → 释放全部质押',   mine:false, who:'WS-327' }
];
function flowRail(p){
  var order = ['S-FP-1','S-FP-2','S-FP-3','S-FP-4','S-FP-6'];
  var cur = p.status === 'S-FP-5' ? 'S-FP-1' : p.status;
  var ci = order.indexOf(cur); if(ci < 0) ci = 0;
  var cells = '';
  FLOW.forEach(function(f, i){
    if(i === 3) cells += '<div class="fsep" aria-hidden="true"><span>本模块边界</span></div>';
    var cls = (i < ci ? 'done' : i === ci ? 'now' : 'next') + (f.mine ? '' : ' later');
    cells += '<div class="fs ' + cls + '">' +
      '<div class="sid">' + f.id + (f.mine ? '' : ' · 后续环节') + '</div>' +
      '<div class="st">' + f.t + (i === ci ? '（当前）' : '') + '</div>' +
      '<div class="sx">' + esc(f.x) + (f.who ? '<br>由 ' + f.who + ' 实现' : '') + '</div>' +
    '</div>';
  });
  var foot = '本模块（WS-324）只承载到 <b>S-FP-3 已锁定</b>：建池、质押、发布需求，以及"已被报价"这个状态落点。' +
    '虚线段为后续环节，<b>此刻不可操作</b>——报价与接受在 WS-325，放款与融资确认在 WS-326，还款结清在 WS-327。' +
    (p.status === 'S-FP-5' ? '<br>本项目已关闭（S-FP-5），未进入后段。' : '') +
    (p.expired ? '<br>本项目有效期已到期，并行标记为「已到期 · 存量处理中」，停止接受新报价、不允许再次发布；存量融资业务照常履约。' : '');
  return '<div class="flow">' + cells + '</div><div class="flow-foot">' + foot + '</div>';
}

/* ---- 动作按钮：区分「不可见」与「可见不可点 ⊘」（H-03） ---- */
function actionBtn(a, handler, cls, noWhy){
  if(a.enabled){
    return '<button class="btn ' + (cls || '') + '" onclick="' + handler + '">' + esc(a.label) + '</button>';
  }
  return '<button class="btn blocked ' + (cls || '').replace('primary','') + '" aria-disabled="true" ' +
         'title="' + esc(a.reason) + '" onclick="toast(' + JSON.stringify(a.reason).replace(/"/g,'&quot;') + ')">' +
         '<span class="sig" aria-hidden="true">⊘</span>' + esc(a.label) + '</button>' +
         (noWhy ? '' : whyLine(a.reason));
}
function whyLine(reason){
  return '<div class="why"><span class="sig" aria-hidden="true">⊘</span><span>' + esc(reason) +
    (state.role === 'guest' ? ' <button class="btn link" onclick="signIn()">登录 / 注册</button>' : '') + '</span></div>';
}

/* ---- 通用状态 ---- */
function skeletonRows(n){
  var h = '', i;
  for(i=0;i<(n||8);i++){
    h += '<tr><td colspan="8" style="padding:0 16px"><div class="sk" style="height:20px;margin:18px 0"></div></td></tr>';
  }
  return '<div class="card tbl" aria-busy="true"><div class="cb tight"><table class="list"><tbody>' + h + '</tbody></table></div></div>';
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
  setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 4600);
}
function signIn(){ toast('登录 / 注册流程不在本模块范围内（本原型直接用底部演示条切换身份）。'); }

/* ---- 外部签名 SDK（D-FIN-71）：平台不自建钱包连接组件 ---- */
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

/* ---- 二次确认 + 费用区（AC-LS-32） ---- */
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
function chainGo(){ var c = pendingChain; openSDK({ rows:c.rows, gas:c.gas, n:c.n, onDone:c.onDone }); }

function queryChain(){
  toast('正在查询链上状态……（原型内为模拟）确认未上链后，重试入口才会出现——沿用 WS-318 S-TI-5 红线，超时态不得直接重试。');
}
