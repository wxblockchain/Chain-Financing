/* ================================================================
   80-router.js —— 壳层与路由
   路由即深链锚点（H-02）：project/new · project/{id} · project/{id}?action=…
   新增模块（WS-325～WS-329）只需在 ROUTES 里补一条，并在 PAGES 里注册渲染函数，
   壳层、导航、角色切换、状态切换都不用动。
   ================================================================ */

var state = {
  role:'guest', page:'plaza', id:null, action:null, step:null, from:null, panel:null,
  feed:'ok', sort:'pub', pageNo:1, tab:'collateral',
  filters:JSON.parse(JSON.stringify(F_DEFAULT)),
  wiz:{ pid:null, name:'', sel:{}, amount:'', amtErr:null, result:null, wsel:{}, busy:false }
};

/* ---- 路由表：模块 · 页面编号 · 深链锚点 · 可见角色 ---- */
var ROUTES = [
  { key:'plaza',   mod:'M-1', page:'P-LS-01', nav:'融资需求广场', hash:'plaza',       roles:['guest','asset','fund'], render:pagePlaza },
  { key:'mine',    mod:'M-1', page:'—',       nav:'我的融资项目', hash:'mine',        roles:['asset'],                render:pageMine },
  { key:'project', mod:'M-1', page:'P-LS-02', nav:null,           hash:'project/:id', roles:['guest','asset','fund'], render:pageProject },
  { key:'publish', mod:'M-1', page:'P-LS-03', nav:'创建融资项目', hash:'project/new', roles:['asset'],                render:pagePublish }
  /* ---- 模块注册区：WS-325～WS-329 在此追加，例如
  { key:'quote',  mod:'M-2', page:'P-QT-01', nav:'我的报价', hash:'quote', roles:['fund'], render:pageQuote }
  ---- */
];
function routeOf(k){ for(var i=0;i<ROUTES.length;i++){ if(ROUTES[i].key===k) return ROUTES[i]; } return ROUTES[0]; }

function go(page, params){
  params = params || {};
  state.page  = page;
  state.id    = ('id' in params) ? params.id : null;
  state.action= params.action || null;
  state.step  = params.step || null;
  state.from  = params.from || null;
  state.panel = (params.action === 'pledge') ? 'pledge' : null;
  if(!('tab' in params)) state.tab = 'collateral';
  if(page === 'publish' && !state.id) resetWiz();
  if(page !== 'publish'){ state.wiz.result = null; state.wiz.amtErr = null; }
  syncHash(); render(); window.scrollTo(0, 0);
  if(state.action){
    setTimeout(function(){
      var el = document.getElementById('panel-' + state.action);
      if(el) el.scrollIntoView({ behavior:'smooth', block:'start' });
    }, 40);
  }
}

/* ---- 深链（H-02）：服务端重新判权；状态已变时落详情页 + Toast，不报 404、不白屏、不静默跳首页 ---- */
function syncHash(){
  var h = '#/';
  if(state.page === 'project') h += 'project/' + state.id;
  else if(state.page === 'publish') h += state.id ? ('project/' + state.id + '?action=publish') : 'project/new';
  else h += routeOf(state.page).hash;
  if(state.action && state.page === 'publish' && state.id) h = '#/project/' + state.id + '?action=' + state.action;
  if(state.from) h += (h.indexOf('?') >= 0 ? '&' : '?') + 'from=' + state.from;
  if(location.hash !== h){ suppressHash = true; location.hash = h; }
}
var suppressHash = false;
function readHash(){
  var h = location.hash.replace(/^#\/?/, ''); if(!h) return false;
  var qi = h.indexOf('?'), path = qi >= 0 ? h.slice(0, qi) : h, qs = qi >= 0 ? h.slice(qi+1) : '';
  var q = {}; qs.split('&').forEach(function(kv){ var p = kv.split('='); if(p[0]) q[p[0]] = p[1]; });
  var seg = path.split('/');
  state.step = null; state.panel = null; state.tab = 'collateral'; state.wiz.result = null; state.wiz.amtErr = null;
  if(seg[0] === 'project'){
    if(seg[1] === 'new'){ state.page = 'publish'; state.id = null; resetWiz(); }
    else {
      var p = findProject(seg[1]);
      if(!p){ state.page = 'project'; state.id = seg[1]; }
      else if(q.action && q.action !== 'quote'){ state.page = 'publish'; state.id = seg[1]; state.step = 2; state.panel = (q.action === 'pledge') ? 'pledge' : null; }
      else { state.page = 'project'; state.id = seg[1]; }
    }
    state.action = q.action || null; state.from = q.from || null;
    return true;
  }
  if(seg[0] === 'mine'){ state.page = 'mine'; return true; }
  if(seg[0] === 'plaza'){ state.page = 'plaza'; return true; }
  return false;
}
window.addEventListener('hashchange', function(){
  if(suppressHash){ suppressHash = false; return; }
  if(readHash()) render();
});

/* ---- 壳层渲染 ---- */
function renderNav(){
  var items = ROUTES.filter(function(r){ return r.nav && r.roles.indexOf(state.role) >= 0; });
  document.getElementById('mainnav').innerHTML = items.map(function(r){
    var on = (r.key === state.page) || (r.key === 'publish' && state.page === 'publish');
    return '<button ' + (on ? 'aria-current="page"' : '') + ' onclick="go(\'' + r.key + '\',{id:null})">' + r.nav + '</button>';
  }).join('');

  var a = ACTORS[state.role];
  document.getElementById('who').innerHTML = state.role === 'guest'
    ? '<div class="id"><b>未登录</b><span>L1～L5 全量可见 · 操作入口 ⊘</span></div>' +
      '<button class="btn sm primary" onclick="signIn()">登录 / 注册</button>'
    : '<div class="id"><b>' + esc(a.full) + '</b><span>' + a.t + ' · 企业主体 ' + a.entity + '</span></div>' +
      '<div class="av">' + a.short + '</div>';
}
function renderSwitches(){
  document.getElementById('swRole').innerHTML = ['guest','asset','fund'].map(function(k){
    return '<button class="' + (state.role === k ? 'on' : '') + '" onclick="setRole(\'' + k + '\')">' + ACTORS[k].t + '</button>';
  }).join('');
  document.getElementById('swFeed').innerHTML = [['ok','默认'],['loading','加载中'],['empty','空数据'],
    ['noresult','筛选无结果'],['fail','加载失败']].map(function(o){
    return '<button class="' + (state.feed === o[0] ? 'on' : '') + '" onclick="setFeed(\'' + o[0] + '\')">' + o[1] + '</button>';
  }).join('');
}
function setRole(k){
  state.role = k;
  var r = routeOf(state.page);
  if(r.roles.indexOf(k) < 0) { go('plaza'); return; }
  render();
}
function setFeed(k){ state.feed = k; render(); }

/* renderSoft：只重算依赖输入的按钮态，不重建 DOM，避免输入框失焦 */
function renderSoft(){
  var el = document.getElementById('pname'), el2 = document.getElementById('damt');
  var focus = document.activeElement ? document.activeElement.id : null;
  render();
  if(focus){
    var back = document.getElementById(focus);
    if(back){ back.focus(); if(back.setSelectionRange){ var v = back.value.length; back.setSelectionRange(v, v); } }
  }
}

function render(){
  renderNav(); renderSwitches();
  mountedCharts = [];
  var r = routeOf(state.page);
  document.getElementById('view').innerHTML = r.render();
  drawCharts();
  document.title = (r.nav || (state.page === 'project' ? '融资需求详情' : '借贷广场')) + ' · 借贷广场 · 金融服务端';
}

/* ---- 启动：直接落在模块第一个功能页，不做登录页 / 端选择页 ---- */
if(!readHash()) { state.page = 'plaza'; }
render();
if(!location.hash) syncHash();
