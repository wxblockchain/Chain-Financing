/* ================================================================
   61-pages-detail.js —— P-LS-02 融资需求详情
   信息分三层，一个字段都不删（游客 L1～L5 全量可见是红线 D-LS-09）：

   【第一层 · 主视图】决策必需，不折叠
     摘要头（需求金额 44px）→ 担保状态提示 → 融资进度 → 三数等式 + 额度尺
     → 操作区 → 池内资产变动 / 融资变动两张图
     判准：资金方决定"要不要报价"、资产方决定"要不要追加 / 撤回"时**必须看到**的。

   【第二层 · 折叠可展开】就地展开，默认收起
     额度明细六个派生量 + 担保三档判据 + 预警线与准入闸门的区别 + 图表数据表
     判准：不影响"做不做"，只影响"我要不要核一遍账"。

   【第三层 · 次级视图】页面底部 tab 切换
     抵押物明细（全量逐张、不脱敏）/ 历史融资记录（列表）/ 商务条款与对外契约
     判准：属于这个项目的档案，不是这次决策的输入；全量可达。
   ================================================================ */

function pageProject(){
  var p = findProject(state.id);
  if(!p || (p.draft && !(state.role === 'asset' && p.entity === ACTORS.asset.entity))){
    return blankState('⊘', '内容不存在或无权访问',
      '该地址对应的融资需求不存在，或您当前的身份没有访问权限。草稿项目不进入广场、不可搜索、不可深链直达（AC-LS-05 / D-FIN-64）。',
      '<button class="btn primary" onclick="go(\'plaza\')">返回融资需求广场</button>');
  }
  if(p.draft) return pagePublish();

  var d = derive(p), acts = availableActions(p, state.role);
  var own = (state.role === 'asset' && p.entity === ACTORS.asset.entity);
  mountedCharts = [];
  registerChart(p, 'pool'); registerChart(p, 'fin');

  var crumb = '<div class="crumb"><button onclick="go(\'plaza\')">融资需求广场</button><i>/</i><span>' +
    esc(p.name) + '</span>' +
    (state.from === 'console'
      ? '<span style="margin-left:auto"><button class="btn sm ghost" onclick="backToConsole()">← 返回我的控制台</button></span>' : '') +
    '</div>';

  /* ---- 第一层 · 摘要头（L2） ---- */
  var head = '<div class="dhead"><div class="top"><div>' +
    '<div class="kick">融资项目 · 发布于 <span class="n">' + (p.publishedAt || '—') + '</span>' +
      ' · 编号 <span class="n">' + p.id + '</span> · 时区 ' + TZ_LABEL + '</div>' +
    '<h1>' + esc(p.name) + '<em>' + esc(p.owner) + '</em></h1>' +
    '<div class="tags">' + statusTags(p) + '</div>' +
    '</div><div class="dm"><div class="lb">融资需求金额</div>' +
      (p.demand ? '<div class="big">' + amt(p.demand) + '<span class="ccy">' + CCY + '</span></div>'
                : '<div class="big" style="color:var(--ink-4)">—</div>') +
      '<div class="lb" style="margin-top:6px">' + (p.demand ? '有效期至 ' + p.expiresAt + '（首次发布日 + ' + TERM_YEARS + ' 年，只读）'
                                                            : '当前无在途融资需求') + '</div>' +
    '</div></div></div>';

  /* ---- 第一层 · 三数等式 + 额度尺（裸露在底色上，全页视觉顶点） ---- */
  var detail = '<div class="kv c3" style="margin-top:4px">' +
      kvCell('池内资产总额', amt(d.total), 'FP-10', '含失效代币，仅展示，不参与任何校验') +
      kvCell('失效代币价值 / 张数', amt(d.dead) + ' / ' + d.deadCount + ' 张', 'FP-19', '因底层应收账款失效，不计入担保') +
      kvCell('项目融资余额', amt(d.bal), 'FP-13', '已确认（还款中）/ 已到期 / 逾期的未偿本金合计') +
      kvCell('项目在途金额', amt(d.fly), 'FP-14', '唯一来源为发布占用，报价环节不新增') +
      kvCell('可融金额', amt(d.free), 'FP-15', 'max(0, 融资上限 − 项目融资余额 − 项目在途金额)') +
      kvCell('可撤回上限', amt(d.wLimit), 'FP-16', '可融金额 ÷ ' + (PLEDGE_RATE*100) + '%，仅约束未失效代币') +
      (d.gap ? kvCell('担保缺口 / 需追加资产价值', amt(d.gap) + ' / ' + amt(d.need), 'FP-21',
                      '需追加资产价值 ＝ 缺口 ÷ ' + (PLEDGE_RATE*100) + '%', true)
             : kvCell('已收到报价数', p.quotes + ' 笔', 'FP-22', '累计报价笔数，含已拒绝 / 已失效')) +
    '</div>' +
    '<div style="height:24px"></div>' +
    '<div style="font-size:var(--fs-sm);color:var(--ink-2);font-weight:650;margin-bottom:12px">担保状态档位判据（FP-20）</div>' +
    gradesBlock(d) +
    '<div class="note quiet" style="margin-top:16px"><span class="ic">≠</span><div class="bd">' +
      '<b>预警线与准入闸门不是同一条线。</b>闸门比较「项目融资余额 + 项目在途金额」，管"还能不能借"；' +
      '预警只比较「项目融资余额」，管"已借的还保得住吗"。两者受众与处置动作都不同，分别呈现。' +
    '</div></div>';

  var strip = '<div class="strip">' + trioBlock(d) + meterBlock(d) +
    '<div style="height:18px"></div>' +
    fold('额度明细与判定口径', '六个派生量 · 担保三档 · 判据', detail) +
  '</div>';

  /* ---- 第一层 · 融资进度（环节名取自 PRD 状态机） ---- */
  var flow = '<div class="card"><div class="ch"><h2>融资进度</h2>' +
    '<span class="note-r">环节取自融资项目状态机 S-FP-1 ～ S-FP-6</span></div>' +
    '<div class="cb">' + flowRail(p) + '</div></div>';

  /* ---- 第一层 · 操作区（主操作唯一；减少担保的操作单独降级） ---- */
  var lead, second = [], risky = actionOf(acts, 'withdraw');
  if(own){
    lead = (d.grade === 'short' && actionOf(acts,'pledge')) ? actionOf(acts,'pledge') : actionOf(acts, 'publish');
  } else {
    lead = actionOf(acts, 'quote');
  }
  acts.forEach(function(a){
    if(a === lead || a.key === 'withdraw') return;
    second.push(a);
  });
  /* 同一条原因重复 4 遍只是噪声：全部被同一理由挡住时，只写一次（入口仍逐个可见可聚焦） */
  var sameWhy = second.length > 1 && second.every(function(a){ return !a.enabled && a.reason === second[0].reason; });
  var rail = '<div class="card"><div class="ch"><h2>操作区</h2>' +
    '<span class="note-r lvl">L6</span></div><div class="cb acts">' +
    (lead ? '<div class="lead">' + actionBtn(lead, actionHandler(p, lead), 'primary lg block') + '</div>' : '') +
    (second.length ? '<div class="second">' + second.map(function(a){
        return '<div>' + actionBtn(a, actionHandler(p, a), 'ghost block', sameWhy) + '</div>'; }).join('') +
        (sameWhy ? whyLine(second[0].reason) : '') + '</div>' : '') +
    (risky ? '<div class="risky"><div class="rl">以下操作会减少池内担保，请先确认额度</div>' +
        actionBtn(risky, actionHandler(p, risky), 'danger block') + '</div>' : '') +
    '<div class="note quiet" style="margin-top:16px"><span class="ic">⊘</span><div class="bd">' +
      '置灰不构成校验。可执行动作清单由服务端每次读取时返回（available_actions），未登录或越权直接调用写接口一律在服务端拒绝。' +
    '</div></div>' +
    '<div style="margin-top:14px;font-size:var(--fs-xs);color:var(--ink-4);line-height:1.7">' +
      '深链锚点 <span class="n">project/' + p.id + '</span><br>' +
      '动作锚点 <span class="n">?action=pledge / withdraw / publish / redeem</span>' +
    '</div>' +
  '</div></div>';

  /* ---- 第三层 · 次级视图 ---- */
  var tab = state.tab || 'collateral';
  var tabsBar = '<div class="tabs" role="tablist">' +
    [['collateral','抵押物明细', p.tokens.length + ' 张'],
     ['history','历史融资记录', (p.events.length + p.deals.length) + ' 条'],
     ['terms','商务条款与公开范围', '']].map(function(t){
      return '<button role="tab" aria-selected="' + (tab === t[0]) + '" onclick="setTab(\'' + t[0] + '\')">' +
        t[1] + (t[2] ? '<span class="cnt">' + t[2] + '</span>' : '') + '</button>';
    }).join('') + '</div>';

  var tabBody = tab === 'history' ? tabHistory(p) : tab === 'terms' ? tabTerms(p) : tabCollateral(p, d);

  return crumb + head +
    shortAlert(p, d, own) + usedUpNote(d) + (own ? redeemBanner() : '') +
    strip +
    '<div style="height:26px"></div>' +
    '<div class="sec-grid"><div>' + flow + chartPairCard(p) + '</div>' +
    '<aside class="rail">' + rail + '</aside></div>' +
    '<div style="height:20px"></div>' +
    '<div class="card">' + tabsBar + tabBody + '</div>';
}

function kvCell(k, v, code, x, crit){
  return '<div><div class="k">' + esc(k) + '<span class="tag plain">' + code + '</span></div>' +
    '<div class="v"' + (crit ? ' style="color:var(--st-crit)"' : '') + '>' + v + '</div>' +
    '<div class="x">' + esc(x) + '</div></div>';
}
function setTab(t){ state.tab = t; render(); }

/* ---- 次级视图 1：抵押物明细（L4，全量、不脱敏、不区间化、不限行数） ---- */
function tabCollateral(p, d){
  return '<div class="cb tight"><div class="tscroll"><table class="dt"><thead><tr>' +
    '<th>代币编号</th><th class="n">美元金额</th><th>底层账期</th><th>买方企业名</th><th>合同号 / 发票号</th>' +
    '<th>质押状态</th><th>是否计入担保</th><th>链上状态</th><th>入池交易哈希</th></tr></thead><tbody>' +
    (p.tokens.length ? p.tokens.map(function(t){
      return '<tr><td class="n">' + t.id + '</td><td class="n">' + amt(t.amt) + '</td><td class="n">' + t.due + '</td>' +
        '<td>' + esc(t.buyer) + '</td><td class="n">' + t.contract + ' / ' + t.invoice + '</td>' +
        '<td>' + tag('mute','PS-2 已质押') + '</td>' +
        '<td>' + (t.dead ? tag('warn','不计入 · ' + (t.deadAt||'') + ' 失效') : tag('good','计入担保', true)) + '</td>' +
        '<td>' + tag(CT_STATUS[t.ct].tone, t.ct + ' ' + CT_STATUS[t.ct].t, true) + '</td>' +
        '<td class="n" style="color:var(--ink-4)">' + shortHash(t.hash) + '</td></tr>';
    }).join('') : '<tr><td colspan="9" style="text-align:center;color:var(--ink-3);padding:30px">本项目暂无有效质押</td></tr>') +
  '</tbody></table></div></div>' +
  '<div class="cb t0"><div class="note quiet"><span class="ic">i</span><div class="bd">' +
    '全量公开的范围是广场上展示的融资需求与融资业务信息；<b>不含</b>授信额度、他人控制台数据、运营端诊断字段、附件影像件与联系人联系方式。' +
    '<p>客观记录：买方企业名、合同号、发票号与精确金额对公网访客完全公开，涉及第三方权益，而确权流程目前没有"同意公开"授权环节。' +
    '按需求方裁定执行，配套的接口速率限制与异常抓取识别见分册第 8 章。</p></div></div></div>';
}

/* ---- 次级视图 2：历史融资记录（列表，不用时间线） ---- */
function tabHistory(p){
  var d = derive(p);
  var evRows = d.pts.filter(function(q){ return q.ev; }).slice().reverse().map(function(q){
    return '<tr><td class="n">' + q.d + '</td><td style="font-weight:550">' + esc(q.ev.t) + '</td>' +
      '<td class="n">' + amt(q.valid) + '</td><td class="n">' + amt(q.cap) + '</td>' +
      '<td class="n">' + amt(q.bal) + '</td><td class="n">' + amt(q.fly) + '</td>' +
      '<td class="wrap2" style="color:var(--ink-3);font-size:var(--fs-sm);max-width:360px">' +
        (q.ev.note ? esc(q.ev.note) : '—') + '</td></tr>';
  }).join('');
  var dealRows = p.deals.length ? p.deals.map(function(x){
    return '<tr><td class="n">' + x.id + '</td><td class="n">' + amt(x.amt) + '</td><td>' + tag('plain', x.st) + '</td>' +
      '<td class="n">' + x.at + '</td><td class="wrap2" style="color:var(--ink-3);font-size:var(--fs-sm)">' + esc(x.x) + '</td></tr>';
  }).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--ink-3);padding:26px">本项目暂无融资业务记录</td></tr>';

  return '<div class="cb"><div style="font-size:var(--fs-sm);color:var(--ink-2);font-weight:650;margin-bottom:10px">' +
      '融资业务<span style="font-weight:400;color:var(--ink-3);margin-left:8px">本模块只读引用，写在 WS-325 及之后</span></div></div>' +
    '<div class="cb tight"><div class="tscroll"><table class="dt"><thead><tr>' +
      '<th>融资业务编号</th><th class="n">金额</th><th>状态</th><th class="n">发生日</th><th>说明</th>' +
    '</tr></thead><tbody>' + dealRows + '</tbody></table></div></div>' +
    '<div class="cb" style="padding-top:26px"><div style="font-size:var(--fs-sm);color:var(--ink-2);font-weight:650;margin-bottom:10px">' +
      '项目事件与派生量变化<span style="font-weight:400;color:var(--ink-3);margin-left:8px">每一行就是两张图上的一级台阶</span></div></div>' +
    '<div class="cb tight"><div class="tscroll"><table class="dt"><thead><tr>' +
      '<th>日期</th><th>事件</th><th class="n">有效质押价值</th><th class="n">融资上限</th>' +
      '<th class="n">项目融资余额</th><th class="n">项目在途金额</th><th>依据</th>' +
    '</tr></thead><tbody>' + evRows + '</tbody></table></div></div>';
}

/* ---- 次级视图 3：商务条款与公开范围（L5） ---- */
function tabTerms(p){
  return '<div class="cb">' +
    (p.terms ? '<div class="kv c4">' +
      '<div><div class="k">报价利率</div><div class="v txt">' + esc(p.terms.rate) + '</div></div>' +
      '<div><div class="k">融资期限</div><div class="v txt">' + esc(p.terms.term) + '</div></div>' +
      '<div><div class="k">还款方式</div><div class="v txt">' + esc(p.terms.repay) + '</div></div>' +
      '<div><div class="k">资金用途</div><div class="v txt">' + esc(p.terms.use) + '</div></div>' +
    '</div>' : '<div class="note quiet"><span class="ic">○</span><div class="bd">该项目当前无公开的在途业务商务条款。</div></div>') +
    '<div style="height:24px"></div>' +
    '<div class="kv c2">' +
      '<div><div class="k">融资需求币种</div><div class="v txt">' + CCY + '<span style="font-weight:400;color:var(--ink-3);font-size:var(--fs-sm)"> · 本期固定，只读；结算币种在报价环节确定</span></div></div>' +
      '<div><div class="k">有效期</div><div class="v txt">' + (p.expiresAt || '—') +
        '<span style="font-weight:400;color:var(--ink-3);font-size:var(--fs-sm)"> · 首次发布日 + ' + TERM_YEARS + ' 年，只读、不可编辑、不可延期</span></div></div>' +
    '</div>' +
    '<div style="height:24px"></div>' +
    '<div class="note quiet"><span class="ic">↗</span><div class="bd">' +
      '<b>对外契约（H-01 ～ H-05）</b>：项目编号即广场上这条融资需求的编号，全局唯一、终身稳定，不另发号；' +
      '本页锚点 <span class="n">project/' + p.id + '</span>，动作锚点 <span class="n">?action=pledge / withdraw / publish / redeem</span>；' +
      '可执行动作清单由服务端返回，前端不自行依据状态推断；六个派生量、担保状态档位、质押四态与链上转移状态均由本模块权威输出，控制台只读引用。' +
    '</div></div>' +
  '</div>';
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
