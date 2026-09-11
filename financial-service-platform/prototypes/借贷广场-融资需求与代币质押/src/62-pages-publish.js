/* ================================================================
   62-pages-publish.js —— P-LS-03 建池与发布（两段式）
   ① 建池与质押 → ② 填写金额并发布；顶部两步进度条常驻，可中断可续做。
   两段之间项目已持久化：关页面、断网、换设备后从"我的融资项目"回来直接进第二段，
   任何一步都不要求重新质押或重新付一次 gas（AC-LS-54）。
   第二段的发布校验失败不回滚已完成的质押（AC-LS-55）。
   ================================================================ */

function stepsBar(step, p){
  var d = p ? derive(p) : null;
  var s1done = !!p, s2done = !!(p && !p.draft);
  function cell(no, title, sub, cls, sv, click){
    return '<' + (click ? 'button' : 'div') + ' class="st ' + cls + (click ? ' clickable' : '') + '"' +
      (click ? ' onclick="' + click + '"' : '') + '>' +
      '<span class="no">' + (cls.indexOf('done') >= 0 ? '✓' : no) + '</span>' +
      '<span class="tx"><b>' + title + '</b><span>' + sub + '</span></span>' +
      (sv ? '<span class="sv">' + sv + '</span>' : '') +
      '</' + (click ? 'button' : 'div') + '>';
  }
  return '<div class="steps">' +
    cell(1, '建池与质押', s1done ? '已完成 · 项目已持久化' : '填项目名 + 勾选至少一张可质押代币',
         s1done ? (step === 1 ? 'now' : 'done') : (step === 1 ? 'now' : ''),
         p ? (p.tokens.length + ' 张 · ' + amt(derive(p).total) + ' ' + CCY) : '',
         (s1done && step !== 1) ? 'go(\'publish\',{id:\'' + p.id + '\',step:1})' : null) +
    cell(2, '填写金额并发布', s2done ? '已发布 · 当前为质押与需求管理' : '填融资需求金额，发布即占用额度',
         step === 2 ? 'now' : (s2done ? 'done' : ''),
         d ? ('可融金额 ' + amt(d.free) + ' ' + CCY) : '',
         (s1done && step !== 2) ? 'go(\'publish\',{id:\'' + p.id + '\',step:2})' : null) +
  '</div>';
}

/* ---- 第一段：建池与质押 ---- */
/* 第一段回看：项目已建，只读呈现当时的建池结果 + 进入第二段 */
function stepOneReview(p){
  var d = derive(p);
  return '<div class="two"><div>' +
    '<div class="card"><div class="ch"><h2>基本信息</h2><p>第一段已完成 · 项目已持久化</p></div><div class="cb">' +
      '<div class="kv c2"><div><div class="k">项目名称</div><div class="v txt">' + esc(p.name) + '</div></div>' +
      '<div><div class="k">项目编号</div><div class="v">' + p.id + '</div></div></div></div></div>' +
    '<div class="card"><div class="ch"><h2>本池已质押代币</h2>' +
      '<p>共 ' + p.tokens.length + ' 张 · 池内资产总额 ' + usd(d.total) + '</p></div><div class="cb tight">' +
      '<div class="tscroll"><table class="dt"><thead><tr><th>代币编号</th><th class="n">美元金额</th><th>底层账期</th>' +
      '<th>买方企业名</th><th>链上状态</th><th>是否计入担保</th></tr></thead><tbody>' +
      (p.tokens.length ? p.tokens.map(function(t){
        return '<tr><td class="n">' + t.id + '</td><td class="n">' + amt(t.amt) + '</td><td class="n">' + t.due + '</td>' +
          '<td>' + esc(t.buyer) + '</td><td>' + tag(CT_STATUS[t.ct].tone, t.ct + ' ' + CT_STATUS[t.ct].t, true) + '</td>' +
          '<td>' + (t.dead ? tag('warn','不计入担保') : t.ct === 'CT-2' ? tag('good','计入担保', true) : tag('mute','处理中不预先计入')) + '</td></tr>';
      }).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--ink-3);padding:26px">本项目暂无有效质押</td></tr>') +
      '</tbody></table></div></div></div>' +
  '</div><aside class="rail"><div class="card"><div class="ch"><h2>继续</h2></div><div class="cb">' +
    trioBlock(d) +
    '<button class="btn primary block lg" style="margin-top:14px" onclick="go(\'publish\',{id:\'' + p.id + '\',step:2})">进入第二段 · 填写金额并发布</button>' +
    '<button class="btn block" style="margin-top:10px" onclick="openPledge(\'' + p.id + '\')">追加质押</button>' +
    '<div class="hint" style="margin-top:12px">第一段与第二段的失败互不牵连：第二段的发布校验失败不会回滚已完成的质押。</div>' +
  '</div></div></aside></div>';
}

function stepOne(p){
  if(p) return stepOneReview(p);
  var editable = true;                           /* 新建模式才可勾选钱包代币 */
  var sel = state.wiz.sel, selList = WALLET.filter(function(t){ return sel[t.id]; });
  var selSum = selList.reduce(function(a,t){ return a + t.amt; }, 0);
  var nameOk = state.wiz.name.trim().length >= 1 && state.wiz.name.trim().length <= 60;
  var canSubmit = editable && nameOk && selList.length > 0 && !state.wiz.busy;

  var filterNote = '<div class="note" style="margin-bottom:14px"><span class="ic">⌕</span><div class="bd">' +
    '<b>下列代币已按可质押条件筛选</b>：① 签发状态为「已签发」；② 归属当前企业主体；③ 当前未被任何有效质押占用、且不在质押合约内' +
    '（含"已释放待提取"的代币，须先提取才能再质押）；④ 底层应收账款未失效；⑤ 代币类型为应收账款类（本期能力边界）；' +
    '⑥ 与本项目已质押代币为同一类型（长期规则，同一池内不混合类型）。' +
    '<p>本期不支持按数量拆分，<b>一张代币整张质押</b>，以"张"为单位勾选，没有数量输入框。</p></div></div>';

  var tbl = '<div class="sub-h"><span>可质押代币 · ' + WALLET.length + ' 张</span>' +
    (editable ? '<span class="x"><label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">' +
      '<input type="checkbox" ' + (selList.length === WALLET.length ? 'checked' : '') + ' onchange="wizAll(this.checked)">批量勾选全部（把 N 笔合成 1 笔是最有效的降费手段）</label></span>' : '') +
    '</div><div class="sub-b"><div class="tscroll"><table class="dt"><thead><tr>' +
    (editable ? '<th class="sel"></th>' : '') +
    '<th>代币编号</th><th class="n">美元金额</th><th>底层账期</th><th>买方企业名</th><th>合同号 / 发票号</th><th>代币类型</th></tr></thead><tbody>' +
    WALLET.map(function(t){
      return '<tr class="' + (sel[t.id] ? 'picked' : '') + '">' +
        (editable ? '<td class="sel"><input type="checkbox" ' + (sel[t.id] ? 'checked' : '') +
          ' onchange="wizTok(\'' + t.id + '\')" aria-label="勾选 ' + t.id + '"></td>' : '') +
        '<td class="n">' + t.id + '</td><td class="n">' + amt(t.amt) + '</td><td class="n">' + t.due + '</td>' +
        '<td>' + esc(t.buyer) + '</td><td class="n">' + t.contract + ' / ' + t.invoice + '</td><td>' + esc('应收账款类') + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';

  var preview = '<div class="pick-sum" style="margin-top:14px">' +
    '<span>已勾选 <span class="n">' + selList.length + '</span> 张</span><span class="sp"></span>' +
    '<span>合计 <span class="n">' + amt(selSum) + '</span> ' + CCY + '</span><span class="sp"></span>' +
    '<span>提交成功后融资上限将增加 <span class="n">' + amt(round2(selSum * PLEDGE_RATE)) + '</span> ' + CCY + '</span>' +
    '<span style="margin-left:auto;font-size:12px;color:var(--ink-3)">前端即时预览；提交时由服务端权威重算并校验，不一致以服务端为准</span></div>';

  var gas = gasEstimate(Math.max(1, selList.length));
  var rail = '<div class="card"><div class="ch"><h2>费用与签名</h2><p>链上转入质押合约</p></div><div class="cb">' +
    '<div class="cost">' +
      '<div class="row"><span class="k">本次链上操作笔数</span><span class="v">' + Math.max(0, selList.length) + ' 笔（合并为一次提交）</span></div>' +
      '<div class="row"><span class="k">预估 gas</span><span class="v">' + gas + ' ETH</span></div>' +
      '<div class="row"><span class="k">承担方</span><span class="v txt">' + esc(ACTORS.asset.full) + '（本企业）</span></div>' +
      '<div class="foot">gas 由区块链收取，<b>平台不代付、不垫付，也不对质押 / 撤回 / 提取收取任何服务费</b>。' +
      '链上失败也可能已经产生费用。签名与付费由本页<b>唤起外部 SDK 服务</b>完成，平台不自建钱包连接组件。</div>' +
    '</div>' +
    '<button class="btn primary block lg" style="margin-top:14px" ' + (canSubmit ? '' : 'disabled') + ' onclick="submitCreate()">' +
      (state.wiz.busy ? '提交中…' : '创建项目并发起质押') + '</button>' +
    (editable && !canSubmit && !state.wiz.busy
      ? '<div class="hint">' + (!nameOk ? '请先填写项目名称（1～60 字符）。' : '未勾选任何一张代币时不可提交——创建项目时必须至少质押一笔。') + '</div>' : '') +
    '</div></div>' +
    '<div class="card"><div class="ch"><h2>本段规则</h2></div><div class="cb" style="font-size:12.5px;color:var(--ink-2);line-height:1.75">' +
      '<p>· 创建校验的对象是<b>质押申请已提交</b>（链上「处理中」或「成功」均算通过），不要求等待链上确认完成。</p>' +
      '<p>· 提交后项目落<b>草稿（已建池 · 未发布）</b>，对外完全不可见：不进广场、不可搜索、他人深链直达返回"内容不存在或无权访问"。</p>' +
      '<p>· 第一段成功后项目即已持久化，可随时离开、随后从"我的融资项目"续做第二段，<b>不会要求重新质押或重新付一次 gas</b>。</p>' +
      '<p>· 发布校验的对象才是链上事实：有效质押价值 &gt; 0 且融资需求金额 ≤ 可融金额。</p>' +
    '</div></div>';

  return '<div class="two"><div>' +
    (state.wiz.result ? resultPanel() : '') +
    '<div class="card"><div class="ch"><h2>基本信息</h2></div><div class="cb">' +
      '<label class="fl" for="pname">项目名称 <b>*</b></label>' +
      '<input id="pname" type="text" maxlength="60" placeholder="例如：华东电子元件应收账款池" ' +
        (editable ? '' : 'disabled ') + 'value="' + esc(p ? p.name : state.wiz.name) + '" oninput="wizName(this.value)" class="' +
        (state.wiz.name && !nameOk ? 'bad' : '') + '">' +
      '<div class="hint">1～60 字符；同一企业内不要求唯一。项目名称在发布后仍可修改。</div>' +
    '</div></div>' +
    '<div class="card"><div class="ch"><h2>代币质押</h2><p>创建项目时必须至少质押一笔代币，"空池草稿"不能由创建动作产生</p></div>' +
      '<div class="cb">' + filterNote + tbl + preview + '</div></div>' +
  '</div><aside class="rail">' + rail + '</aside></div>';
}

/* ---- 链上结果面板：五类失败 / 等待各有独立页面态 ---- */
function resultPanel(){
  var r = state.wiz.result, o = CHAIN_OUTCOMES[r.k];
  if(r.k === 'ok')
    return '<div class="note good" style="margin-bottom:16px"><span class="ic">✓</span><div class="bd">' +
      '<b>链上转入成功</b>（CT-2）：' + r.n + ' 张代币已入池并计入有效质押价值。' +
      '<p>实际 gas ' + r.gas + ' ETH，同一次操作只记一次。可继续第二段：填写融资需求金额并发布。</p></div></div>';
  if(r.k === 'partial')
    return '<div class="note warn" style="margin-bottom:16px"><span class="ic">!</span><div class="bd">' +
      '<b>部分成功 · 按张独立结算</b>：' + r.ok + ' 张入池成功（CT-2），' + r.bad + ' 张链上执行失败（CT-3）已退回可质押。' +
      '<p>失败原因：质押合约执行被回退。失败那 ' + r.bad + ' 张的 gas 已产生、不可退回；重试将发起新交易并再次产生 gas。' +
      '发布校验以实际成功入池后的服务端重算结果为准。</p>' +
      '<p style="margin-top:8px"><button class="btn sm" onclick="go(\'publish\',{id:\'' + state.wiz.pid + '\',step:1})">重新质押失败的 ' + r.bad + ' 张（将产生新的 gas）</button></p></div></div>';
  if(r.k === 'timeout')
    return '<div class="note warn" style="margin-bottom:16px"><span class="ic">⧗</span><div class="bd">' +
      '<b>' + esc(o.head) + '</b><p>' + esc(o.body) + '</p>' +
      '<p>费用：' + esc(o.fee) + ' 该 ' + r.n + ' 张代币保持「处理中」，期间不接受新动作。' +
      '超过阈值后转为失败并生成运营待办。</p>' +
      '<p style="margin-top:8px"><button class="btn sm" onclick="queryChain()">查询链上状态</button>' +
      '<span style="margin-left:10px;font-size:12px;color:var(--ink-3)">本状态下不提供重试按钮——查得未上链后，重试入口才会出现。</span></p></div></div>';
  return '<div class="note ' + (o.tone === 'mute' ? '' : o.tone) + '" style="margin-bottom:16px"><span class="ic">' +
    (o.k === 'cancel' ? '○' : '!') + '</span><div class="bd"><b>' + esc(o.head) + '</b>' +
    '<p>' + esc(o.body) + '</p><p>费用：' + esc(o.fee) + '</p>' +
    '<p style="margin-top:8px"><button class="btn sm" onclick="retryChain()">' + esc(o.retry) + '</button></p></div></div>';
}
function retryChain(){ state.wiz.result = null; render(); }

/* ---- 第二段：填写金额并发布 + 质押管理 ---- */
function stepTwo(p){
  var d = derive(p), published = !p.draft;
  var amtVal = state.wiz.amount, err = state.wiz.amtErr;

  var empty = p.emptyPool
    ? '<div class="note crit" style="margin-bottom:16px"><span class="ic">!</span><div class="bd">' +
      '<b>本项目暂无有效质押，请重新质押后再发布。</b>' +
      '<p>创建时那笔质押最终链上执行失败，项目与项目名称等准备工作已为您保留；空池只能由这条路径产生，不能由用户直接建出。</p>' +
      '<p style="margin-top:8px"><button class="btn sm primary" onclick="openPledge(\'' + p.id + '\')">重新质押</button>' +
      '<button class="btn sm" style="margin-left:8px" onclick="closeProject(\'' + p.id + '\')">关闭项目</button></p></div></div>' : '';

  /* --- 需求金额 --- */
  var pubAct = actionOf(availableActions(p, 'asset'), 'publish') || { enabled:false, reason:'' };
  var amountCard = '<div class="card"><div class="ch"><h2>' + (published ? '融资需求' : '填写融资需求金额') + '</h2>' +
    '<p>' + (published ? '已发布；在「募集中」且该需求尚未被报价时可修改金额或撤下需求' : '发布成功后按需求金额产生在途占用，这是项目在途金额的唯一来源') + '</p></div><div class="cb">' +
    '<div style="display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:16px;align-items:start">' +
      '<div><label class="fl" for="damt">融资需求金额（' + CCY + '） <b>*</b></label>' +
      '<input id="damt" type="text" inputmode="decimal" placeholder="0.00" value="' + esc(amtVal) + '" ' +
        (p.emptyPool ? 'disabled ' : '') + 'oninput="wizAmount(this.value)" class="' + (err ? 'bad' : '') + '">' +
      '<div class="hint">必填，大于 0 且不超过可融金额 ' + usd(d.free) + '。金额精度为 ' + CCY + ' 2 位小数。</div>' +
      (err ? '<div class="err"><span>!</span><div><b>' + esc(err.head) + '</b><br>' + err.body + '</div></div>' : '') +
      '</div>' +
      '<div><label class="fl">有效期至</label>' +
      /* 只读：不提供输入框、日期选择器或"修改有效期"入口（AC-LS-02 / D-FIN-37） */
      '<div style="height:38px;display:flex;align-items:center;padding:0 12px;border:1px dashed var(--line-strong);' +
        'border-radius:var(--r-s);background:var(--sunken);font-family:var(--num);color:var(--ink-2)">' +
        (p.expiresAt || addYears(TODAY, TERM_YEARS)) + '</div>' +
      '<div class="hint">系统按首次发布日 + ' + TERM_YEARS + ' 年生成，只读、不可编辑、不可延期；再次发布不重置。</div></div>' +
    '</div>' +
    '<div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">' +
      (pubAct.enabled
        ? '<button class="btn primary lg" onclick="submitPublish(\'' + p.id + '\')">' + (published ? '再次发布剩余额度' : '发布融资需求') + '</button>'
        : '<button class="btn blocked lg" aria-disabled="true" onclick="toast(' + JSON.stringify(pubAct.reason).replace(/"/g,'&quot;') + ')"><span class="sig" aria-hidden="true">⊘</span>发布融资需求</button>') +
      (published && p.demand && p.quotes === 0
        ? '<button class="btn lg" onclick="toast(\'撤下需求将释放对应的在途占用 ' + amt(p.demand) + ' USD，项目回到「已建池未发布」的草稿语义。演示原型不改动演示数据。\')">撤下需求</button>' : '') +
    '</div>' +
    (pubAct.enabled ? '' : '<div class="why"><span class="sig" aria-hidden="true">⊘</span><span>' + esc(pubAct.reason) + '</span></div>') +
  '</div></div>';

  /* --- 已质押清单 + 撤回（分两区） --- */
  var dead = p.tokens.filter(function(t){ return t.dead; });
  var live = p.tokens.filter(function(t){ return !t.dead; });
  var wsel = state.wiz.wsel;
  var wLive = live.filter(function(t){ return wsel[t.id]; }).reduce(function(a,t){ return a + t.amt; }, 0);
  var wDead = dead.filter(function(t){ return wsel[t.id]; }).reduce(function(a,t){ return a + t.amt; }, 0);
  var over = wLive > d.wLimit;

  function wRow(t, limited){
    return '<tr class="' + (wsel[t.id] ? 'picked' : '') + '">' +
      '<td class="sel"><input type="checkbox" ' + (wsel[t.id] ? 'checked' : '') + ' onchange="wTok(\'' + t.id + '\')" aria-label="勾选 ' + t.id + '"></td>' +
      '<td class="n">' + t.id + '</td><td class="n">' + amt(t.amt) + '</td><td class="n">' + t.due + '</td>' +
      '<td>' + esc(t.buyer) + '</td>' +
      '<td>' + tag(CT_STATUS[t.ct].tone, t.ct + ' ' + CT_STATUS[t.ct].t, true) + '</td>' +
      '<td>' + (limited ? tag('good','计入担保', true) : tag('warn','不计入担保 · ' + (t.deadAt||'') + ' 失效')) + '</td></tr>';
  }
  var head5 = '<thead><tr><th class="sel"></th><th>代币编号</th><th class="n">美元金额</th><th>底层账期</th><th>买方企业名</th><th>链上状态</th><th>是否计入担保</th></tr></thead>';

  var pledgeCard = '<div class="card"><div class="ch"><h2>已质押清单与撤回</h2>' +
    '<p>两区分开：失效代币的撤回不做任何额度判定，有效抵押物受额度限制</p></div><div class="cb">' +
    (dead.length ?
      '<div class="sub-h"><span>已失效 · 可随时撤回（不计入担保）· ' + dead.length + ' 张</span>' +
        '<span class="x">这些代币本来就不顶担保，移出它们不会削弱担保，因此不做额度判定、直接放行</span></div>' +
      '<div class="sub-b"><div class="tscroll"><table class="dt">' + head5 + '<tbody>' +
      dead.map(function(t){ return wRow(t, false); }).join('') + '</tbody></table></div></div><div style="height:18px"></div>' : '') +
    '<div class="sub-h"><span>有效抵押物 · 受额度限制 · ' + live.length + ' 张</span>' +
      '<span class="x">当前最多可撤回 <b class="n">' + usd(d.wLimit) + '</b>（＝可融金额 ÷ ' + (PLEDGE_RATE*100) + '%）</span></div>' +
    '<div class="sub-b"><div class="tscroll"><table class="dt">' + head5 + '<tbody>' +
      (live.length ? live.map(function(t){ return wRow(t, true); }).join('')
                   : '<tr><td colspan="7" style="text-align:center;color:var(--ink-3);padding:24px">池内暂无有效抵押物</td></tr>') +
    '</tbody></table></div></div>' +
    '<div class="pick-sum" style="margin-top:14px;' + (over ? 'background:var(--st-crit-wash);border-color:var(--st-crit-line)' : '') + '">' +
      '<span>拟撤回（有效抵押物）<span class="n">' + amt(wLive) + '</span></span><span class="sp"></span>' +
      '<span>可撤回上限 <span class="n">' + amt(d.wLimit) + '</span></span><span class="sp"></span>' +
      '<span>差额 <span class="n">' + amt(Math.abs(d.wLimit - wLive)) + '</span>' + (over ? '（超出）' : '（尚余）') + '</span>' +
      (wDead ? '<span class="sp"></span><span>另含失效代币 <span class="n">' + amt(wDead) + '</span>（不受限制）</span>' : '') +
    '</div>' +
    (over ? '<div class="err" style="margin-top:10px"><span>!</span><div><b>拟撤回价值超出可撤回上限，本次撤回不予放行。</b><br>' +
      '拟撤回价值 <span class="n">' + usd(wLive) + '</span>；当前可撤回上限 <span class="n">' + usd(d.wLimit) + '</span>；差额 <span class="n">' + usd(wLive - d.wLimit) + '</span>。<br>' +
      '两条出路：① 减少勾选，把拟撤回价值压到 ' + usd(d.wLimit) + ' 以内；② 等待还款降低项目融资余额，可撤回上限会随之抬高。</div></div>' : '') +
    '<div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">' +
      '<button class="btn primary" ' + ((wLive + wDead) === 0 || over ? 'disabled' : '') + ' onclick="submitWithdraw(\'' + p.id + '\')">撤回勾选的代币</button>' +
      '<button class="btn" onclick="openPledge(\'' + p.id + '\')">追加质押</button>' +
    '</div>' +
    '<div class="note" style="margin-top:14px;font-size:12.5px"><span class="ic">i</span><div class="bd">' +
      '撤回一进入链上「处理中」即<b>预扣</b>该部分价值（宁可低估不可高估），失败回滚才恢复；' +
      '撤回不得先置「已释放」再回滚。撤回与提取<b>不设硬性阻断</b>：24 小时内提交超过 5 次会提示"频繁链上操作会产生较多 gas"，但不阻断。' +
    '</div></div>' +
  '</div></div>';

  /* --- 追加质押面板 --- */
  var addSel = state.wiz.sel, addList = WALLET.filter(function(t){ return addSel[t.id]; });
  var addSum = addList.reduce(function(a,t){ return a + t.amt; }, 0);
  var addCard = (state.panel === 'pledge') ? '<div class="card" id="panel-pledge"><div class="ch"><h2>追加质押</h2>' +
    '<p>任何项目状态下都允许，池内资产只增不减地增强担保</p></div><div class="cb">' +
    '<div class="sub-h"><span>可质押代币 · ' + WALLET.length + ' 张</span>' +
      '<span class="x"><label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">' +
      '<input type="checkbox" ' + (addList.length === WALLET.length ? 'checked' : '') + ' onchange="wizAll(this.checked)">批量勾选全部</label></span></div>' +
    '<div class="sub-b"><div class="tscroll"><table class="dt"><thead><tr><th class="sel"></th><th>代币编号</th>' +
      '<th class="n">美元金额</th><th>底层账期</th><th>买方企业名</th><th>合同号 / 发票号</th></tr></thead><tbody>' +
      WALLET.map(function(t){
        return '<tr class="' + (addSel[t.id] ? 'picked' : '') + '"><td class="sel"><input type="checkbox" ' +
          (addSel[t.id] ? 'checked' : '') + ' onchange="wizTok(\'' + t.id + '\')" aria-label="勾选 ' + t.id + '"></td>' +
          '<td class="n">' + t.id + '</td><td class="n">' + amt(t.amt) + '</td><td class="n">' + t.due + '</td>' +
          '<td>' + esc(t.buyer) + '</td><td class="n">' + t.contract + ' / ' + t.invoice + '</td></tr>';
      }).join('') + '</tbody></table></div></div>' +
    '<div class="pick-sum" style="margin-top:14px"><span>已勾选 <span class="n">' + addList.length + '</span> 张</span>' +
      '<span class="sp"></span><span>合计 <span class="n">' + amt(addSum) + '</span> ' + CCY + '</span>' +
      '<span class="sp"></span><span>融资上限将增加 <span class="n">' + amt(round2(addSum * PLEDGE_RATE)) + '</span> ' + CCY +
      (d.gap ? '，本次追加后担保缺口 ' + (addSum * PLEDGE_RATE >= d.gap ? '可解除' : '仍有 ' + amt(d.gap - addSum * PLEDGE_RATE)) : '') + '</span></div>' +
    '<div style="margin-top:14px"><button class="btn primary" ' + (addList.length ? '' : 'disabled') +
      ' onclick="submitPledge(\'' + p.id + '\')">确认追加并发起质押</button>' +
      '<button class="btn" style="margin-left:10px" onclick="state.panel=null;render()">收起</button></div>' +
  '</div></div>' : '';

  /* --- 可提取区 --- */
  var redSum = REDEEMABLE.reduce(function(a,t){ return a + t.amt; }, 0);
  var redeemCard = REDEEMABLE.length ? '<div class="card"><div class="ch"><h2>可提取代币</h2>' +
    '<p>业务已释放，链上仍在质押合约内 · 待提取</p></div><div class="cb">' +
    '<div class="note info" style="margin-bottom:14px"><span class="ic">↧</span><div class="bd">' +
      '您有 <b>' + REDEEMABLE.length + ' 张</b>代币（合计 <span class="n">' + usd(redSum) + '</span>）可提取，需自付 gas，可批量一次提完，无时间限制、不过期。' +
      '<p>释放分两段：<b>第一段业务释放</b>在项目关闭 / 结清的同一时刻完成，即时、无链上动作、无费用；' +
      '<b>第二段链上提取</b>由您自助发起。未提取前代币不属于任何池、不计入任何质押价值，也不能被再次质押。</p></div></div>' +
    '<div class="sub-b"><div class="tscroll"><table class="dt"><thead><tr><th>代币编号</th><th class="n">美元金额</th>' +
      '<th>底层账期</th><th>来源项目</th><th>移出触发原因</th><th>质押状态</th></tr></thead><tbody>' +
      REDEEMABLE.map(function(t){
        return '<tr><td class="n">' + t.id + '</td><td class="n">' + amt(t.amt) + '</td><td class="n">' + t.due + '</td>' +
          '<td class="n">' + t.from + '</td><td>' + esc(t.reason) + '</td><td>' + tag('mute','PS-4 已释放 · 待提取') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>' +
    '<div style="margin-top:14px"><button class="btn primary" onclick="openRedeem()">批量提取全部 ' + REDEEMABLE.length + ' 张</button></div>' +
  '</div></div>' : '';

  var rail = '<div class="card"><div class="ch"><h2>当前派生量</h2><p>与广场、控制台同源</p></div><div class="cb">' +
    '<div class="kv c2" style="grid-template-columns:1fr 1fr">' +
      '<div><div class="k">有效质押价值</div><div class="v">' + amt(d.valid) + '</div></div>' +
      '<div><div class="k">融资上限</div><div class="v">' + amt(d.cap) + '</div></div>' +
      '<div><div class="k">项目融资余额</div><div class="v">' + amt(d.bal) + '</div></div>' +
      '<div><div class="k">项目在途金额</div><div class="v">' + amt(d.fly) + '</div></div>' +
      '<div><div class="k">可融金额</div><div class="v">' + amt(d.free) + '</div></div>' +
      '<div><div class="k">可撤回上限</div><div class="v">' + amt(d.wLimit) + '</div></div>' +
    '</div>' +
    '<div style="height:14px"></div>' + meterBlock(d, true) +
  '</div></div>';

  return empty + shortAlert(p, d, true) + usedUpNote(d) +
    '<div class="two"><div>' +
      (state.wiz.result ? resultPanel() : '') +
      '<div class="card"><div class="ch"><h2>池内资产与额度</h2>' +
        '<p>三个数在页面上必须乘得平：① × ② = ③</p></div><div class="cb">' + trioBlock(d) + '</div></div>' +
      amountCard + addCard + pledgeCard + redeemCard +
    '</div><aside class="rail">' + rail + '</aside></div>';
}

function pagePublish(){
  var p = state.id ? findProject(state.id) : null;
  if(state.role !== 'asset')
    return blankState('⊘', '无权访问',
      '建池与发布页只对资产方企业主体开放。当前身份为「' + esc(ACTORS[state.role].full) + '」。' +
      '游客与资金方在广场与详情页可以看到 L1～L5 的全量信息，但本页属于本方数据，按企业主体做服务端归属过滤。',
      '<button class="btn primary" onclick="go(\'plaza\')">返回融资需求广场</button>');
  if(p && p.entity !== ACTORS.asset.entity)
    return blankState('⊘', '内容不存在或无权访问', '该项目不属于当前企业主体。',
      '<button class="btn primary" onclick="go(\'plaza\')">返回融资需求广场</button>');

  var step = state.step || (p ? 2 : 1);
  var head = '<div class="crumb">' +
    '<button onclick="go(\'mine\')">我的融资项目</button><i>/</i><span>' + (p ? esc(p.name) : '创建融资项目') + '</span></div>' +
    '<div class="page-head"><div><h1>' + (p ? esc(p.name) : '创建融资项目') + '</h1>' +
    '<div class="sub">' + (p ? '项目编号 ' + p.id + ' · ' + FP_STATUS[p.status].t + '（' + FP_STATUS[p.status].x + '）'
                              : '两段式：先建池与质押，金额想好了再填再发布；中途可离开，随时回来续做。') + '</div></div></div>';

  return head + stepsBar(step, p) + (step === 1 || !p ? stepOne(p) : stepTwo(p));
}

/* ---- 我的融资项目：两段式的续做入口（AC-LS-54）。我的控制台 M-5 本期不做 ---- */
function pageMine(){
  if(state.role !== 'asset')
    return blankState('⊘', '无权访问', '本页只对资产方企业主体开放。',
      '<button class="btn primary" onclick="go(\'plaza\')">返回融资需求广场</button>');
  var list = myProjects();
  return '<div class="page-head"><div><h1>我的融资项目</h1>' +
    '<div class="sub">' + esc(ACTORS.asset.full) + ' 名下的资产池。草稿项目只有本企业可见，不进广场、不可搜索、不可被深链直达。</div></div>' +
    '<button class="btn primary" onclick="go(\'publish\',{id:null})">创建融资项目</button></div>' +
    redeemBanner() +
    '<div class="note" style="margin-bottom:16px"><span class="ic">i</span><div class="bd">' +
      '我的控制台（M-5）不在本模块范围内。本页只承担两段式所必需的<b>续做入口</b>：第一段完成后项目即已持久化，' +
      '关页面、断网、换设备都能从这里回到第二段，不会要求重新质押或重新付一次 gas。' +
    '</div></div>' +
    '<div class="card"><div class="cb tight"><div class="tscroll"><table class="dt"><thead><tr>' +
      '<th>项目名称</th><th>项目编号</th><th>状态 / 进度</th><th class="n">有效质押价值</th><th class="n">融资上限</th>' +
      '<th class="n">可融金额</th><th>担保状态</th><th>有效期至</th><th style="width:200px">操作</th></tr></thead><tbody>' +
      list.map(function(p){
        var d = derive(p), g = gradeMeta(d.grade);
        return '<tr><td><button class="btn link" onclick="go(\'' + (p.draft ? 'publish' : 'project') + '\',{id:\'' + p.id + '\'})">' +
            esc(p.name) + '</button></td>' +
          '<td class="n">' + p.id + '</td>' +
          '<td>' + tag(FP_STATUS[p.status].tone, FP_STATUS[p.status].t, true) +
            (p.draft ? '<div style="font-size:11.5px;color:var(--ink-3);margin-top:4px">' +
              (p.emptyPool ? '第 ① 段链上失败 · 空池草稿' : '第 ① 段已完成 · 待填金额') + '</div>' : '') +
            (p.expired ? '<div style="font-size:11.5px;color:var(--ink-3);margin-top:4px">已到期 · 存量履约中</div>' : '') + '</td>' +
          '<td class="n">' + amt(d.valid) + '</td><td class="n">' + amt(d.cap) + '</td><td class="n">' + amt(d.free) + '</td>' +
          '<td>' + tag(g.tone, g.t, true) + '</td><td class="n">' + (p.expiresAt || '—') + '</td>' +
          '<td><div style="display:flex;gap:6px;flex-wrap:wrap">' +
            (p.draft ? '<button class="btn sm primary" onclick="go(\'publish\',{id:\'' + p.id + '\',step:2})">继续发布</button>'
                     : '<button class="btn sm" onclick="go(\'project\',{id:\'' + p.id + '\'})">详情</button>') +
            '<button class="btn sm" onclick="openPledge(\'' + p.id + '\')">追加质押</button>' +
          '</div></td></tr>';
      }).join('') + '</tbody></table></div></div></div>';
}
