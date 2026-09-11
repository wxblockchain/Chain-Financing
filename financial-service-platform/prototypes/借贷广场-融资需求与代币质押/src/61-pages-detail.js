/* ================================================================
   61-pages-detail.js —— P-LS-02 融资需求详情
   分区顺序按资金方决策路径：先看要融多少 → 再看池子值多少、够不够
   → 再看抵押物逐张明细 → 最后看条款与历史。
   L1～L5 对游客全量可见、不脱敏、不区间化、不限行数；只有 L6 操作区按 ⊘ 收敛。
   ================================================================ */

function pageProject(){
  var p = findProject(state.id);
  /* 草稿项目不进广场：他人与游客深链直达一律返回"内容不存在或无权访问"，不暴露其是否存在 */
  if(!p || (p.draft && !(state.role === 'asset' && p.entity === ACTORS.asset.entity))){
    return blankState('⊘', '内容不存在或无权访问',
      '该地址对应的融资需求不存在，或您当前的身份没有访问权限。草稿项目不进入广场、不可搜索、不可深链直达（AC-LS-05 / D-FIN-64）。',
      '<button class="btn primary" onclick="go(\'plaza\')">返回融资需求广场</button>');
  }
  if(p.draft) return pagePublish();   /* 本方草稿直接进入 P-LS-03 续做 */

  var d = derive(p), acts = availableActions(p, state.role);
  mountedCharts = [];
  registerChart(p, 'pool'); registerChart(p, 'fin');

  var crumb = '<div class="crumb"><button onclick="go(\'plaza\')">融资需求广场</button><i>/</i><span>' +
    esc(p.name) + '</span>' +
    (state.from === 'console'
      /* H-05：深链来源时提供返回入口；非深链来源不展示 */
      ? '<span style="margin-left:auto"><button class="btn sm" onclick="backToConsole()">← 返回我的控制台</button></span>' : '') +
    '</div>';

  /* ---- L2 融资需求摘要 ---- */
  var hero = '<section class="hero"><div class="l1"><div>' +
    '<h1>' + esc(p.name) + '</h1>' +
    '<div class="meta"><span>资产方 <b>' + esc(p.owner) + '</b></span>' +
      '<span>项目编号 <b class="n">' + p.id + '</b></span>' +
      '<span>发布时间 <b class="n">' + (p.publishedAt || '—') + '</b></span>' +
      '<span>有效期至 <b class="n">' + (p.expiresAt || '—') + '</b>（系统按首次发布日 + ' + TERM_YEARS + ' 年生成，只读）</span>' +
      '<span>时区 <b>' + TZ_LABEL + '</b></span></div>' +
    '<div class="tags">' + statusTags(p) + (p.quotes ? tag('plain','已收到报价 ' + p.quotes + ' 笔') : '') + '</div>' +
    '</div><div class="demand"><div class="lb">融资需求金额</div>' +
      (p.demand ? '<div class="big">' + amt(p.demand) + '<span class="ccy">' + CCY + '</span></div>'
                : '<div class="big">—</div><div class="lb" style="margin-top:4px">当前无在途融资需求</div>') +
    '</div></div></section>';

  /* ---- L3 池内资产与额度总览（含两张图） ---- */
  var l3 = '<div class="card"><div class="ch"><h2><span class="lvl">L3</span>池内资产与额度总览</h2>' +
    '<div style="font-size:12.5px;color:var(--ink-3)">派生量由服务端权威重算，控制台与广场读到的是同一个数</div></div>' +
    '<div class="cb">' +
      trioBlock(d) +
      '<div style="height:26px"></div>' +
      meterBlock(d) +
      '<div style="height:18px"></div>' +
      '<div class="kv c4">' +
        '<div><div class="k">池内资产总额 <span class="tag plain">FP-10</span></div><div class="v">' + amt(d.total) + '</div><div class="x">含失效代币，仅展示，不参与任何校验</div></div>' +
        '<div><div class="k">失效代币价值 / 张数 <span class="tag plain">FP-19</span></div><div class="v">' + amt(d.dead) + ' / ' + d.deadCount + ' 张</div><div class="x">因底层应收账款失效，不计入担保</div></div>' +
        '<div><div class="k">项目融资余额 <span class="tag plain">FP-13</span></div><div class="v">' + amt(d.bal) + '</div><div class="x">已确认（还款中）/ 已到期 / 逾期的未偿本金合计</div></div>' +
        '<div><div class="k">项目在途金额 <span class="tag plain">FP-14</span></div><div class="v">' + amt(d.fly) + '</div><div class="x">唯一来源为发布占用，报价不新增</div></div>' +
        '<div><div class="k">可融金额 <span class="tag plain">FP-15</span></div><div class="v">' + amt(d.free) + '</div><div class="x">max(0, 融资上限 − 项目融资余额 − 项目在途金额)</div></div>' +
        '<div><div class="k">可撤回上限 <span class="tag plain">FP-16</span></div><div class="v">' + amt(d.wLimit) + '</div><div class="x">可融金额 ÷ ' + (PLEDGE_RATE*100) + '%，仅约束未失效代币</div></div>' +
        '<div><div class="k">担保状态档位 <span class="tag plain">FP-20</span></div><div class="v txt">' + gradeMeta(d.grade).t + '</div><div class="x">' + esc(gradeMeta(d.grade).x) + '</div></div>' +
        (d.gap
          ? '<div><div class="k">担保缺口 / 需追加资产价值 <span class="tag plain">FP-21</span></div><div class="v" style="color:var(--st-crit)">' + amt(d.gap) + ' / ' + amt(d.need) + '</div><div class="x">需追加资产价值 ＝ 缺口 ÷ ' + (PLEDGE_RATE*100) + '%</div></div>'
          : '<div><div class="k">已收到报价数 <span class="tag plain">FP-22</span></div><div class="v">' + p.quotes + ' 笔</div><div class="x">累计报价笔数，含已拒绝 / 已失效</div></div>') +
      '</div>' +
      gradesBlock(d) +
      '<div class="note" style="margin-top:14px"><span class="ic">≠</span><div class="bd">' +
        '<b>预警线与准入闸门不是同一条线。</b>闸门比较 <span class="n">项目融资余额 + 项目在途金额</span>，管"还能不能借"；' +
        '预警只比较 <span class="n">项目融资余额</span>，管"已借的还保得住吗"。两者受众与处置动作都不同，分别呈现。' +
      '</div></div>' +
    '</div></div>' +
    chartCard(p, 'pool') +
    chartCard(p, 'fin');

  /* ---- L4 抵押物明细 ---- */
  var l4 = '<div class="card"><div class="ch"><h2><span class="lvl">L4</span>抵押物明细</h2>' +
    '<div style="font-size:12.5px;color:var(--ink-3)">共 ' + p.tokens.length + ' 张 · 全量展示，不脱敏、不区间化、不限行数</div></div>' +
    '<div class="cb tight"><div class="tscroll"><table class="dt"><thead><tr>' +
      '<th>代币编号</th><th class="n">美元金额</th><th>底层账期</th><th>买方企业名</th><th>合同号 / 发票号</th>' +
      '<th>质押状态</th><th>是否计入担保</th><th>链上状态</th><th>入池交易哈希</th></tr></thead><tbody>' +
      (p.tokens.length ? p.tokens.map(function(t){
        return '<tr><td class="n">' + t.id + '</td><td class="n">' + amt(t.amt) + '</td><td class="n">' + t.due + '</td>' +
          '<td>' + esc(t.buyer) + '</td><td class="n">' + t.contract + ' / ' + t.invoice + '</td>' +
          '<td>' + tag('mute','PS-2 已质押') + '</td>' +
          '<td>' + (t.dead ? tag('warn','不计入担保 · ' + (t.deadAt||'') + ' 失效') : tag('good','计入担保', true)) + '</td>' +
          '<td>' + tag(CT_STATUS[t.ct].tone, t.ct + ' ' + CT_STATUS[t.ct].t, true) + '</td>' +
          '<td class="n" style="color:var(--ink-3)">' + shortHash(t.hash) + '</td></tr>';
      }).join('') : '<tr><td colspan="9" style="text-align:center;color:var(--ink-3);padding:28px">本项目暂无有效质押</td></tr>') +
    '</tbody></table></div></div>' +
    '<div class="cb" style="padding-top:14px"><div class="note"><span class="ic">i</span><div class="bd">' +
      '全量公开的范围是广场上展示的融资需求与融资业务信息；<b>不含</b>授信额度、他人控制台数据、运营端诊断字段、附件影像件与联系人联系方式。' +
      '<p>客观记录：买方企业名、合同号、发票号与精确金额对公网访客完全公开，涉及第三方权益，而确权流程目前没有"同意公开"授权环节。' +
      '按需求方裁定执行，配套的接口速率限制与异常抓取识别见分册第 8 章。</p>' +
    '</div></div></div></div>';

  /* ---- L5 商务条款与历史融资记录 ---- */
  var snap = p.snapshot ? '<div class="card"><div class="ch"><h2>报价时的池快照</h2>' +
      '<p>' + p.snapshot.at + ' · ' + TZ_LABEL + '</p></div><div class="cb">' +
      '<div class="kv c2">' +
        '<div><div class="k">快照时抵押物</div><div class="v">' + p.snapshot.tokens + ' 张</div></div>' +
        '<div><div class="k">快照时有效质押价值</div><div class="v">' + amt(p.snapshot.valid) + '</div></div>' +
        '<div><div class="k">快照时融资上限</div><div class="v">' + amt(p.snapshot.cap) + '</div></div>' +
        '<div><div class="k">快照时可融金额</div><div class="v">' + amt(p.snapshot.free) + '</div></div>' +
      '</div>' +
      '<div class="note" style="margin-top:12px"><span class="ic">⇄</span><div class="bd">' +
        '与<b>实时池况</b>并列：当前有效质押价值 <span class="n">' + amt(d.valid) + '</span>、融资上限 <span class="n">' + amt(d.cap) + '</span>。' +
        '池子既可增也可减，机构必须能看到"我报价时池子是什么样"；池值下降到触发预警时会同时通知在途报价机构。' +
      '</div></div></div></div>' : '';

  var l5 = '<div class="card"><div class="ch"><h2><span class="lvl">L5</span>商务条款与历史融资记录</h2></div><div class="cb">' +
    (p.terms ? '<div class="kv c4">' +
      '<div><div class="k">报价利率</div><div class="v txt">' + esc(p.terms.rate) + '</div></div>' +
      '<div><div class="k">融资期限</div><div class="v txt">' + esc(p.terms.term) + '</div></div>' +
      '<div><div class="k">还款方式</div><div class="v txt">' + esc(p.terms.repay) + '</div></div>' +
      '<div><div class="k">资金用途</div><div class="v txt">' + esc(p.terms.use) + '</div></div>' +
    '</div>' : '<div class="note"><span class="ic">○</span><div class="bd">该项目当前无公开的在途业务商务条款。</div></div>') +
    '<div style="height:20px"></div>' +
    '<h3 style="font-size:13.5px;font-weight:650;margin-bottom:12px">历史时间线</h3>' +
    '<div class="tl">' + d.pts.filter(function(q){ return q.ev; }).slice().reverse().map(function(q, i){
      return '<div class="it' + (i===0?' on':'') + '"><div class="d">' + q.d + '</div><div class="t">' + esc(q.ev.t) + '</div>' +
        (q.ev.note ? '<div class="x">' + esc(q.ev.note) + '</div>' : '') + '</div>';
    }).join('') + '</div>' +
    (p.deals.length ? '<div style="height:20px"></div><h3 style="font-size:13.5px;font-weight:650;margin-bottom:10px">融资业务（本模块只读引用，写在 WS-325 及之后）</h3>' +
      '<div class="tscroll"><table class="dt"><thead><tr><th>融资业务编号</th><th class="n">金额</th><th>状态</th><th class="n">发生日</th><th>说明</th></tr></thead><tbody>' +
      p.deals.map(function(x){
        return '<tr><td class="n">' + x.id + '</td><td class="n">' + amt(x.amt) + '</td><td>' + tag('plain', x.st) + '</td>' +
          '<td class="n">' + x.at + '</td><td style="color:var(--ink-2)">' + esc(x.x) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '') +
  '</div></div>';

  /* ---- L6 操作区：按 available_actions 渲染，不自行依据状态推断 ---- */
  var rail = '<div class="card"><div class="ch"><h2><span class="lvl">L6</span>操作区</h2>' +
    '<p>当前身份：' + esc(ACTORS[state.role].full) + '</p></div><div class="cb">' +
    '<div style="display:flex;flex-direction:column;gap:12px">' +
      acts.map(function(a){
        return '<div>' + actionBtn(a, actionHandler(p, a) , 'block') + '</div>';
      }).join('') +
    '</div>' +
    '<div class="note" style="margin-top:16px;font-size:12.5px"><span class="ic">⊘</span><div class="bd">' +
      '置灰不构成校验。可执行动作清单由服务端每次读取时返回，未登录或越权直接调用写接口一律在服务端拒绝。' +
    '</div></div>' +
    '<div style="margin-top:14px;font-size:11.5px;color:var(--ink-3);line-height:1.7;border-top:1px solid var(--line);padding-top:12px">' +
      '本页深链锚点：<span class="n">project/' + p.id + '</span><br>' +
      '动作锚点：<span class="n">?action=pledge / withdraw / publish / redeem</span>' +
    '</div>' +
  '</div></div>';

  return crumb + hero + shortAlert(p, d, state.role === 'asset' && p.entity === ACTORS.asset.entity) + usedUpNote(d) +
    (state.role === 'asset' && p.entity === ACTORS.asset.entity ? redeemBanner() : '') +
    '<div class="sec-grid"><div>' + l3 + l4 + l5 + '</div><aside class="rail">' + rail + snap + '</aside></div>';
}

function actionHandler(p, a){
  switch(a.key){
    case 'quote':    return 'doQuote(\'' + p.id + '\')';
    case 'publish':  return 'go(\'publish\',{id:\'' + p.id + '\',action:\'publish\'})';
    case 'pledge':   return 'openPledge(\'' + p.id + '\')';
    case 'withdraw': return 'go(\'publish\',{id:\'' + p.id + '\',action:\'withdraw\'})';
    case 'redeem':   return 'openRedeem()';
    case 'close':    return 'closeProject(\'' + p.id + '\')';
  }
  return 'void 0';
}
function backToConsole(){
  toast('我的控制台（M-5）不在本模块范围内（X-LS-02）。来源上下文由服务端暂存，动作完成后回控制台对应 tab 与锚点。');
}
function closeProject(id){
  var p = findProject(id);
  openScrim('<div class="modal"><div class="mh"><h2>关闭融资项目</h2><p>' + esc(p.name) + ' · ' + p.id + '</p></div>' +
    '<div class="mb"><div class="note warn"><span class="ic">!</span><div class="bd">' +
    '关闭后项目转「已关闭」，平台在同一时刻解除该池全部占用与担保关系，池内 ' + p.tokens.length + ' 张代币置「已释放 · 待提取」。' +
    '<p>业务释放<b>即时、无链上动作、无费用</b>；代币仍停留在质押合约内，需您自行发起提取并自付 gas，' +
    '<b>不会自动回到钱包</b>。未提取前不属于任何池、不计入任何质押价值、也不能被再次质押。</p>' +
    '</div></div></div>' +
    '<div class="mf"><button class="btn" onclick="closeScrim()">取消</button>' +
    '<button class="btn primary" data-autofocus onclick="closeScrim();toast(\'演示原型：此处不真正改动演示数据。\')">确认关闭</button></div></div>');
}
