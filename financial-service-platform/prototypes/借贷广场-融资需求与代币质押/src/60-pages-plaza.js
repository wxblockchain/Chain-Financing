/* ================================================================
   60-pages-plaza.js —— P-LS-01 融资需求列表（广场首页）
   ================================================================ */

var F_DEFAULT = { type:'', pool:'', demand:'', status:'', quotable:'', expiry:'', grade:'' };

function matchFilter(p){
  var d = derive(p), f = state.filters;
  if(f.type   && p.assetType !== f.type) return false;
  if(f.pool){
    var r = f.pool.split('-');
    if(d.valid < +r[0] || (r[1] !== 'x' && d.valid > +r[1])) return false;
  }
  if(f.demand){
    var q = f.demand.split('-');
    if(!p.demand) return false;
    if(p.demand < +q[0] || (q[1] !== 'x' && p.demand > +q[1])) return false;
  }
  if(f.status && p.status !== f.status) return false;
  if(f.grade  && d.grade !== f.grade) return false;
  if(f.quotable === 'y' && !actionOf(availableActions(p, 'fund'), 'quote').enabled) return false;
  if(f.quotable === 'n' &&  actionOf(availableActions(p, 'fund'), 'quote').enabled) return false;
  if(f.expiry){
    var dd = p.expiresAt ? daysTo(p.expiresAt) : 99999;
    if(f.expiry === 'x'  && dd >= 0) return false;
    if(f.expiry === '7'  && (dd < 0 || dd > 7)) return false;
    if(f.expiry === '30' && (dd < 0 || dd > 30)) return false;
  }
  return true;
}
function sortList(list){
  var s = state.sort;
  return list.slice().sort(function(a,b){
    if(s === 'demand') return (b.demand||0) - (a.demand||0);
    if(s === 'pool')   return derive(b).valid - derive(a).valid;
    return dnum(b.publishedAt || TODAY) - dnum(a.publishedAt || TODAY);
  });
}

function filterBar(){
  function sel(key, label, opts){
    return '<div class="f"><span>' + label + '</span><select onchange="setFilter(\'' + key + '\',this.value)">' +
      opts.map(function(o){
        return '<option value="' + o[0] + '"' + (state.filters[key] === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></div>';
  }
  return '<div class="filters">' +
    sel('type','资产类型',    [['','全部'],['应收账款类','应收账款类']]) +
    sel('pool','池内资产价值（有效质押价值）', [['','不限'],['0-500000','50 万以下'],['500000-1000000','50–100 万'],['1000000-x','100 万以上']]) +
    sel('demand','融资需求金额', [['','不限'],['0-300000','30 万以下'],['300000-600000','30–60 万'],['600000-x','60 万以上']]) +
    sel('status','项目状态',  [['','全部']].concat(['S-FP-2','S-FP-3','S-FP-4','S-FP-5','S-FP-6'].map(function(k){ return [k, FP_STATUS[k].t]; }))) +
    sel('quotable','是否可报价', [['','不限'],['y','可报价'],['n','暂不可报价']]) +
    sel('expiry','有效期临近',[['','不限'],['7','7 天内到期'],['30','30 天内到期'],['x','已到期']]) +
    sel('grade','担保状态',   [['','全部']].concat(GRADES.map(function(g){ return [g.k, g.t]; }))) +
    '<div class="spacer"></div>' +
    '<div class="f"><span>排序</span><select onchange="setSort(this.value)">' +
      [['pub','发布时间倒序'],['demand','按需求金额'],['pool','按池内资产价值']].map(function(o){
        return '<option value="' + o[0] + '"' + (state.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></div>' +
    (JSON.stringify(state.filters) !== JSON.stringify(F_DEFAULT)
      ? '<div class="rs"><button class="btn sm" onclick="resetFilters()">清空筛选</button></div>' : '') +
  '</div>';
}

function projectCard(p){
  var d = derive(p), acts = availableActions(p, state.role), q = actionOf(acts, 'quote');
  var lastDue = p.tokens.length
    ? p.tokens.map(function(t){ return t.due; }).sort()[0] : '—';
  return '<article class="pcard"><div class="top">' +
    '<div class="pool">' +
      '<div class="zn">池内资产</div>' +
      '<div class="facts">' +
        '<div><div class="k">抵押物张数</div><div class="v">' + p.tokens.length + ' 张' +
          (d.deadCount ? '<span style="font-size:11.5px;color:var(--ink-3);font-family:var(--sans)"> · 含失效 ' + d.deadCount + ' 张</span>' : '') + '</div></div>' +
        '<div><div class="k">有效质押价值</div><div class="v">' + amt(d.valid) + '</div></div>' +
        '<div><div class="k">资产类型</div><div class="v txt">' + esc(p.assetType) + '</div></div>' +
        '<div><div class="k">底层资产最近到期日</div><div class="v">' + lastDue + '</div></div>' +
      '</div>' +
    '</div>' +
    '<div class="fin">' +
      '<div class="zn">融资信息</div>' +
      '<h3><button onclick="go(\'project\',{id:\'' + p.id + '\'})">' + esc(p.name) + '</button></h3>' +
      '<div class="org">' + esc(p.owner) + ' · <span class="id">' + p.id + '</span></div>' +
      '<div class="demand">' +
        (p.demand ? '<span class="big">' + amt(p.demand) + '</span><span class="lb">' + CCY + ' · 融资需求金额</span>'
                  : '<span class="big">—</span><span class="lb">当前无在途融资需求</span>') +
      '</div>' +
      '<div class="tags">' + statusTags(p) + (p.quotes ? tag('plain','已收到报价 ' + p.quotes + ' 笔') : '') + '</div>' +
      '<div class="facts">' +
        '<div><div class="k">融资上限</div><div class="v">' + amt(d.cap) + '</div></div>' +
        '<div><div class="k">可融金额</div><div class="v">' + amt(d.free) + '</div></div>' +
        '<div><div class="k">有效期至</div><div class="v">' + (p.expiresAt || '—') + '</div></div>' +
        (d.gap ? '<div><div class="k">担保缺口</div><div class="v" style="color:var(--st-crit)">' + amt(d.gap) + '</div></div>'
               : '<div><div class="k">项目融资余额</div><div class="v">' + amt(d.bal) + '</div></div>') +
      '</div>' +
    '</div>' +
  '</div>' +
  '<div class="bot">' +
    '<div class="m">' + meterBlock(d, true) + '</div>' +
    '<div class="act">' +
      '<div style="display:flex;gap:8px">' +
        '<button class="btn sm" onclick="go(\'project\',{id:\'' + p.id + '\'})">查看详情</button>' +
        (q.enabled ? '<button class="btn sm primary" onclick="doQuote(\'' + p.id + '\')">立即报价</button>'
                   : '<button class="btn blocked sm" aria-disabled="true" onclick="toast(' + JSON.stringify(q.reason).replace(/"/g,'&quot;') + ')"><span class="sig" aria-hidden="true">⊘</span>立即报价</button>') +
      '</div>' +
      (q.enabled ? '' : '<div class="why"><span class="sig" aria-hidden="true">⊘</span><span>' + esc(q.reason) +
        (state.role === 'guest' ? ' <button class="btn link" onclick="signIn()">登录 / 注册</button>' : '') + '</span></div>') +
    '</div>' +
  '</div></article>';
}

function pagePlaza(){
  var head = '<div class="page-head"><div><h1>融资需求广场</h1>' +
    '<div class="sub">平台上全部入驻资产方创建的融资项目，一个项目就是一个资产池。' +
    '信息 L1～L5 对所有人全量可见，不登录也能看完；只有操作入口按登录态与权限收敛。</div></div>' +
    (state.role === 'asset' ? '<button class="btn primary" onclick="go(\'publish\',{id:null})">创建融资项目</button>' : '') +
    '</div>';

  if(state.feed === 'loading') return head + filterBar() + skeletonCards(3);
  if(state.feed === 'fail')
    return head + filterBar() + blankState('⚠', '融资需求加载失败',
      '服务端未返回列表数据。这不影响已发布项目的链上与额度状态，可重试。',
      '<button class="btn primary" onclick="setFeed(\'ok\')">重新加载</button>');
  if(state.feed === 'empty')
    return head + filterBar() + blankState('○', '暂无融资需求',
      '目前平台上还没有已发布的融资项目。资产方在资产平台完成应收账款确权、由运营端签发代币后，' +
      '即可在此创建资产池并发布融资需求。',
      '<button class="btn" onclick="signIn()">注册为资产方</button>');

  var list = sortList(plazaProjects().filter(matchFilter));
  if(state.feed === 'noresult' || list.length === 0)
    return head + filterBar() + blankState('⌕', '没有符合筛选条件的融资需求',
      '当前筛选组合下没有匹配的资产池。可放宽池内资产价值区间或项目状态，' +
      '也可以清空筛选查看全部 ' + plazaProjects().length + ' 条。',
      '<button class="btn primary" onclick="resetFilters()">清空筛选</button>');

  var total = list.length, start = (state.pageNo-1)*PAGE_SIZE;
  var shown = list.slice(start, start + PAGE_SIZE);
  return head + filterBar() +
    '<div class="plist">' + shown.map(projectCard).join('') + '</div>' +
    '<div class="pager"><span>共 ' + total + ' 条 · 单页 ' + PAGE_SIZE + ' 条 · 第 ' + state.pageNo + ' / ' +
      Math.max(1, Math.ceil(total/PAGE_SIZE)) + ' 页</span>' +
      '<div class="pg"><button class="btn sm" ' + (state.pageNo<=1?'disabled':'') + ' onclick="setPage(' + (state.pageNo-1) + ')">上一页</button>' +
      '<button class="btn sm" ' + (start+PAGE_SIZE>=total?'disabled':'') + ' onclick="setPage(' + (state.pageNo+1) + ')">下一页</button></div></div>';
}

function setFilter(k, v){ state.filters[k] = v; state.pageNo = 1; render(); }
function setSort(v){ state.sort = v; render(); }
function resetFilters(){ state.filters = JSON.parse(JSON.stringify(F_DEFAULT)); state.pageNo = 1; if(state.feed==='noresult') state.feed='ok'; render(); }
function setPage(n){ state.pageNo = n; render(); window.scrollTo(0,0); }

/* 报价流程属 WS-325（M-2），本模块只交付广场侧入口与 ⊘ 口径 */
function doQuote(id){
  var p = findProject(id);
  openScrim('<div class="modal"><div class="mh"><h2>立即报价</h2><p>' + esc(p.name) + ' · ' + p.id + '</p></div>' +
    '<div class="mb"><div class="note info"><span class="ic">i</span><div class="bd">' +
    '<b>报价及之后的环节不在本模块范围内</b>（X-LS-01）。授信核定、报价、接受 / 拒绝报价、放款与融资确认在 WS-325（M-2）及之后实现。' +
    '<p>本模块交付的是广场侧的报价入口与它的准入口径：报价<b>不新增在途占用</b>（AC-FIN-23），' +
    '项目在途金额的唯一来源是发布占用；提交报价时服务端按 <b>可融金额 ≥ 本次金额</b> 校验（AC-FIN-12），' +
    '并保留一份池快照供机构回看（AC-LS-27）。</p></div></div></div>' +
    '<div class="mf"><button class="btn primary" data-autofocus onclick="closeScrim()">知道了</button></div></div>');
}
