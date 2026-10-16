/* WS-382 · 代币质押审核（运营端）。会话与功能权限读运营端账户与登录一处登记（CF.opsAuth）：
   PM-AL-07 代币质押申请查询、PM-AL-08 代币质押审核处置。业务数据、文件与异步反馈均为本地演示。 */
(function(CF){
  'use strict';
  const S=CF.S,L=CF.L,E=CF.esc,OPS=CF.opsAccountModule,$=id=>document.getElementById(id);
  const Q='P-O-PR-01',D='P-O-PR-02',ROOT='/ops/pledge-reviews';
  const OPS_PAGES=['P-O-AL-01','P-O-AL-03','P-O-AL-04','P-O-AL-05','P-O-AL-06','P-O-AL-07'];
  /* 单笔审核轴 RV-20：四类，默认待审核；不因时间流逝自动改变。 */
  const status={pending:['Pending review','待审核','warn'],approved:['Approved','通过','ok'],
    rejected:['Rejected','驳回','danger'],withdrawn:['Withdrawn','已撤回','gray']};
  /* 本笔当前去向 PA-15：只读消费面客取值，与审核轴是两条独立的轴。 */
  const follows={pending:['Pending review','待审核'],effective:['Counted in the eligible borrowing limit','已计入有效质押额'],
    'awaiting-release':['Awaiting self-service release','待自助解押'],releasing:['Release in progress','解押处理中'],
    released:['Released to the holding address','已解押退回']};
  /* 已通过但不计入有效质押（代币失效或有对账差异）：不显示成“已计入有效质押额”，并说明原因。 */
  const EXCLUDED=['Approved · not counted in the eligible pledge','已通过 · 不计入有效质押'];
  const flags={verify:['Result to be verified','结果待核实'],difference:['Reconciliation discrepancy','对账差异']};
  const sources={manual:['Manual','人工'],terminal:['Project closure default','项目终态默认']};
  const categories=[['Ownership or entity in question','代币归属或主体存疑'],['Underlying receivable issue','底层应收账款存在问题'],
    ['Token does not match project','代币与目标项目不匹配'],['Incomplete or inconsistent materials','申请材料不完整或不一致'],
    ['Other','其他']];
  const fDefault=()=>({status:'pending',source:'',follow:'',verify:'',diff:'',owner:'',project:'',type:'',from:'',to:'',q:''});
  let seed=CF.pledgeSeed();
  const A={rows:seed.rows,projects:seed.projects,now:seed.now,clock:Date.now(),
    filter:fDefault(),editFilter:fDefault(),page:1,sort:'onchainAt',dir:1,filtersOpen:false,tab:'overview',
    view:'default',response:'success',upload:'success',preview:'success',activityState:'default',
    draft:null,busy:false,error:'',selected:null,uncertain:null,events:[],epoch:0};
  let routeKey=null,restoreContext=false,returnHash='',lastHash='',onModule=false,wasSigned=false;
  const positions=new Map();
  const now=()=>A.now+(Date.now()-A.clock),txt=x=>Array.isArray(x)?L(x[0],x[1]):x;
  const time=t=>t?CF.fmtTime(t):'—';
  const unknown=()=>L('To be verified','待核实');
  const money=v=>v==null?unknown():CF.fmtAmt(v)+' USD';
  const short=v=>v?v.slice(0,8)+'…'+v.slice(-4):'—';
  const owner=r=>L('Demo Asset '+r.owner,'示例资产企业 '+r.owner);
  const project=r=>L('Demo project '+r.project,'示例融资项目 '+r.project);
  const projectOf=r=>A.projects[r.project];
  const b=(en,zh,act,value='',cls='',disabled=false)=>`<button type="button" class="btn ${cls}" data-act="pr-${act}" data-v="${E(value)}" ${disabled?'disabled':''}>${L(en,zh)}</button>`;
  const link=(en,zh,act,value)=>act==='view'?`<a class="actlink" href="#${E(detailRoute(value,'overview',S.page===D?A.selected:''))}" data-act="pr-view" data-v="${E(value)}">${L(en,zh)}</a>`:`<button type="button" class="actlink" data-act="pr-${act}" data-v="${E(value)}">${L(en,zh)}</button>`;
  const badge=r=>CF.tag(status[r.status][2],txt(status[r.status]));
  /* 通过的链上执行（解冻）：运营连接平台统一钱包签名提交，链上执行成功即审核通过。不单独展示解冻授权状态，
     进展只通过审核状态与操作记录表达——通过处理中、通过结果待核实时本张仍待审核、暂不可裁定。 */
  const authOf=r=>r?.auth||'none';
  const authBusy=r=>['processing','unknown'].includes(authOf(r));
  /* 撤回解押中暂不可裁定（D-PR-40）：资产方已发起待审撤回、解押尚无结果，仍是待审核。 */
  const withdrawing=r=>r?.status==='pending'&&r.follow==='releasing';
  const terminalProject=r=>['closed','settled'].includes(A.projects[r?.project]?.status);
  const progressTag=r=>r?.status!=='pending'?'':withdrawing(r)?CF.tag('accent',L('Withdrawal in progress · cannot be decided','撤回解押处理中 · 暂不可裁定')):authOf(r)==='processing'?CF.tag('accent',L('Approval in progress','通过处理中')):authOf(r)==='unknown'?CF.tag('warn',L('Result to be verified','结果待核实')):'';
  const sourceText=r=>r?.source&&['approved','rejected'].includes(r.status)?txt(sources[r.source]):'';
  const ME=['Demo Operator','演示操作员'];
  const holdTone=r=>r.follow==='effective'?'ok':r.follow==='released'?'gray':r.follow==='awaiting-release'?'warn':r.follow==='releasing'?'accent':'gray';
  const holdBadge=r=>(r.follow==='excluded'?CF.tag('gray',txt(EXCLUDED)):CF.tag(holdTone(r),txt(follows[r.follow])))+(r.flag?CF.tag('warn',txt(flags[r.flag])):'');
  /* 必填标识按共享规范 §4.2 显式传入：字段名前的红色星号，只标当前必须填写或选择的项。 */
  const field=(label,html,required)=>`<div class="field"><label for="${(html.match(/id="([^"]+)/)||[])[1]||''}">${CF.fieldLabel(label,required)}</label>${html}</div>`;
  const input=(id,v,type='text')=>`<input class="inp" id="${id}" type="${type}" value="${E(v)}">`;
  const select=(id,value,options)=>`<select class="inp" id="${id}">${options.map(([v,label])=>`<option value="${E(v)}" ${v===value?'selected':''}>${E(label)}</option>`).join('')}</select>`;
  const note=(s,type='')=>CF.note(type,s);
  const error=()=>A.error?`<p class="pr-error" role="alert">${E(txt(A.error))}</p>`:'';
  const kv=(items,detail=false)=>`${detail?'<div class="ops-facts-region">':''}<dl class="pr-kv ${detail?'ops-facts':''}">${items.map(([label,value,wide])=>`<div${wide?` class="pr-wide${detail?' ops-fact-wide':''}"`:''}><dt>${label}</dt><dd>${value??'—'}</dd></div>`).join('')}</dl>${detail?'</div>':''}`;
  const facts=items=>kv(items,true);
  const section=(en,zh,html)=>`<section class="card pr-section"><h2 class="pr-h2">${L(en,zh)}</h2>${html}</section>`;
  const row=()=>A.rows.find(r=>r.id===A.selected);

  /* 功能权限只在运营端账户与登录一处登记；本册按正文区分查询岗与处置岗。 */
  const signedIn=()=>!!CF.opsAuth&&CF.opsAuth.can(14);
  const canQuery=()=>!!CF.opsAuth&&CF.opsAuth.can(7);
  const canDecide=()=>!!CF.opsAuth&&CF.opsAuth.can(7)&&CF.opsAuth.can(8);
  const decideOnly=()=>!!CF.opsAuth&&!CF.opsAuth.can(7)&&CF.opsAuth.can(8);
  const allowed=()=>S.end==='admin'&&signedIn()&&canQuery();
  const canWrite=r=>allowed()&&canDecide()&&r?.status==='pending'&&!authBusy(r)&&!withdrawing(r)&&!terminalProject(r)&&A.uncertain?.id!==r.id;
  /* 不可裁定时给出就地原因；办理已打开时提交被拒，已填内容保留。 */
  function blockReason(r){
    if(!r)return null;
    if(r.status==='rejected'&&r.source==='terminal')return ['The project has reached a final state, so this application was rejected by default and cannot be decided.','所属项目已进入终态，本张已默认不通过，不能再裁定。'];
    if(r.status!=='pending')return ['This application already has a result and cannot be decided again.','本张已有结果，不能再裁定。'];
    if(withdrawing(r))return ['The asset holder’s withdrawal is in progress, so this application cannot be decided for now.','资产方撤回处理中，暂不可裁定。'];
    if(authOf(r)==='processing')return ['The approval is in progress, so this application cannot be decided for now.','通过处理中，暂不可裁定。'];
    if(authOf(r)==='unknown')return ['The approval result is to be verified, so this application cannot be decided for now.','通过结果待核实，暂不可裁定。'];
    return null;
  }
  /* 已等待时长（N-PR-02）：事实陈述，不是期限；人工结论或撤回生效即停止计时。 */
  const endedAt=r=>r.decisionAt||(r.status==='withdrawn'?r.release?.completedAt:null);
  const waited=r=>(endedAt(r)||now())-r.onchainAt;
  function duration(ms){
    const m=Math.max(0,Math.floor(ms/60000));
    return m<60?`${m} ${L('min','分钟')}`:m<1440?`${Math.floor(m/60)} ${L('h','小时')}`
      :`${Math.floor(m/1440)} ${L('d','天')} ${Math.floor(m%1440/60)} ${L('h','小时')}`;
  }
  function event(r,title,result,extra){r.events.unshift(Object.assign({id:crypto.randomUUID(),at:now(),title,result,actor:['System','系统']},extra||{}));}

  /* ---------------------------------------------------------------- 路由 */
  function params(){return new URLSearchParams({...A.filter,page:String(A.page),sort:A.sort,dir:String(A.dir)});}
  function queueRoute(){return ROOT+'?'+params();}
  function detailRoute(id,tab='overview',source=''){
    const p=params();p.set('id',id);p.set('tab',tab);if(source&&source!==id)p.set('source',source);return ROOT+'/detail?'+p;
  }
  function remember(){const el=document.activeElement;positions.set(location.hash,{y:window.scrollY,act:el?.dataset.act,value:el?.dataset.v});}
  function syncContext(){
    if(routeKey===location.hash)return;
    routeKey=location.hash;const p=new URLSearchParams(location.hash.split('?')[1]||'');
    const f=fDefault();for(const k of Object.keys(f))if(p.has(k))f[k]=p.get(k);
    if(f.status&&!status[f.status])f.status='pending';
    if(f.follow&&!follows[f.follow])f.follow='';
    if(f.source&&!sources[f.source])f.source='';
    for(const k of ['verify','diff'])f[k]=f[k]==='1'?'1':'';
    for(const k of ['from','to'])if(!/^\d{4}-\d{2}-\d{2}$/.test(f[k]))f[k]='';
    A.filter=f;A.editFilter={...f};A.page=Math.max(1,parseInt(p.get('page'),10)||1);
    A.sort=['onchainAt','waiting','value'].includes(p.get('sort'))?p.get('sort'):'onchainAt';A.dir=p.get('dir')==='-1'?-1:1;
    A.selected=p.get('id');A.tab=p.get('tab')==='related'?'related':'overview';
    A.jumpActivity=p.get('tab')==='activity'||p.get('section')==='activity';
    if(p.get('tab')==='activity'){p.set('tab','overview');p.set('section','activity');history.replaceState(null,'','#'+ROOT+'/detail?'+p);routeKey=location.hash;}
    A.source=p.get('source');if(!A.rows.some(r=>r.id===A.source)||A.source===A.selected)A.source='';
  }
  function saveContext(){
    const next=S.page===D?detailRoute(A.selected,A.tab,A.source):queueRoute();
    history.replaceState(null,'','#'+next);routeKey=location.hash;
  }
  function navigateRoute(route){remember();A.epoch++;A.busy=false;A.draft=null;A.error='';S.layer=null;A.view='default';location.hash='#'+route;}
  function visit(id){
    const target=id?detailRoute(id,'overview',S.page===D?A.selected:''):queueRoute();
    if(A.draft&&(A.draft.files.length||A.draft.reason||A.draft.remark)){A.next=target;open('discard');return;}
    navigateRoute(target);
  }
  function restoreView(){
    if(A.jumpActivity&&S.page===D&&A.tab==='overview'){A.jumpActivity=false;requestAnimationFrame(()=>{const el=$('pr-activity');el?.scrollIntoView({block:'start'});el?.focus({preventScroll:true});});restoreContext=false;return;}
    if(!restoreContext)return;restoreContext=false;
    requestAnimationFrame(()=>{
      if(S.layer)return;
      const saved=positions.get(location.hash);
      if(saved){window.scrollTo(0,saved.y);const target=[...document.querySelectorAll('[data-act]')].find(el=>el.dataset.act===saved.act&&el.dataset.v===saved.value);if(target)target.focus({preventScroll:true});else $('pr-f-q')?.focus({preventScroll:true});}
      else window.scrollTo(0,0);
    });
  }
  function open(key){CF.openLayer('modal','pr-'+key);}
  function deny(){A.error=['This action is unavailable with the current account, permissions or record status.','当前账号、权限或记录状态不允许此操作。'];A.busy=false;A.draft=null;S.layer=null;CF.render();CF.toast(txt(A.error));}

  /* ---------------------------------------------------------------- 权限空态 */
  function signedOut(){return CF.empty(L('Sign in to continue','请先完成运营登录'),
    L('Your session has ended. Sign in again to open the pledge review queue.','登录已失效，请重新登录后查看代币质押审核队列。'),
    b('Sign in again','重新登录','sign-in','','primary'));}
  function noAccess(){return decideOnly()
    ?CF.empty(L('Review access is incomplete','审核权限配置不完整'),
      L('This account can decide pledge applications but cannot query them, so the review is refused. Ask your platform provider to correct the delivered configuration.','该账号可作出代币质押审核处置，但未开通代币质押申请查询，本次访问已拒绝。请联系平台建设方修正交付配置。'),'')
    :CF.empty(L('No access to pledge reviews','无权访问代币质押审核'),
      L('The delivered configuration does not give this account the token pledge permissions.','当前交付配置未为该账号开通代币质押相关权限。'),'');}
  function gate(){return !signedIn()?signedOut():!canQuery()?noAccess():'';}

  /* ---------------------------------------------------------------- 队列 */
  function inDay(t,day,end){const d=new Date(day+'T00:00:00Z').getTime();return end?t<d+86400000:t>=d;}
  /* 去向筛选取 PA-15 的五个值；“结果待核实”“对账差异”是可叠加的并列提示。 */
  function matchFollow(r,key){return r.follow===key;}
  function matchVerify(r){return r.flag==='verify'||(r.status==='pending'&&authOf(r)==='unknown');}
  function filtered(ignoreState=false){
    const f=A.filter,q=f.q.trim().toLowerCase();
    return A.rows.filter(r=>(!f.owner||r.owner===f.owner)&&(!f.project||r.project===f.project)&&(!f.type||r.type===f.type)
      &&(!f.from||inDay(r.onchainAt,f.from))&&(!f.to||inDay(r.onchainAt,f.to,true))
      &&(!q||[r.id,r.batch,r.token,r.holder,owner(r)].join(' ').toLowerCase().includes(q))
      &&(ignoreState||((!f.status||r.status===f.status)
        &&(!f.source||(['approved','rejected'].includes(r.status)&&r.source===f.source))
        &&(!f.follow||matchFollow(r,f.follow))&&(!f.verify||matchVerify(r))&&(!f.diff||r.flag==='difference'))));
  }
  function utcDayStart(t,back=0){const d=new Date(t);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-back);}
  /* 筛选统一在一处：关键词、审核状态与排序常驻，其余条件展开后同区呈现。 */
  function filters(){
    const f=A.editFilter,applied=A.filter;
    const extra=['source','follow','verify','diff','owner','project','type','from','to'],count=extra.filter(k=>applied[k]).length;
    const labels={source:L('Decision source','结论来源'),follow:L('Current position','本笔当前去向'),verify:L('Result to be verified','结果待核实'),
      diff:L('Reconciliation discrepancy','对账差异'),owner:L('Asset holder','资产方'),project:L('Project','目标项目'),
      type:L('Application type','申请类型'),from:L('Submitted from','提交开始日期'),to:L('Submitted through','提交结束日期')};
    const values={source:applied.source?txt(sources[applied.source]):'',follow:applied.follow?txt(follows[applied.follow]):'',verify:' ',diff:' ',
      owner:applied.owner?owner({owner:applied.owner}):'',project:applied.project?project({project:applied.project}):'',
      type:applied.type==='first'?L('Initial pledge','首笔质押'):L('Additional pledge','追加质押')};
    const tagText=k=>['verify','diff'].includes(k)?labels[k]:labels[k]+': '+(values[k]||applied[k]);
    const check=(id,key)=>`<label class="pr-check"><input type="checkbox" id="pr-f-${id}" ${f[key]?'checked':''}> ${labels[key]}</label>`;
    const order=select('pr-order',A.sort+':'+A.dir,[['onchainAt:1',L('Submitted · oldest first','提交时间 · 最早优先')],['onchainAt:-1',L('Submitted · newest first','提交时间 · 最新优先')],['waiting:-1',L('Waiting · longest first','已等待时长 · 最长优先')],['waiting:1',L('Waiting · shortest first','已等待时长 · 最短优先')],['value:-1',L('Share value · highest first','份额价值 · 从高到低')],['value:1',L('Share value · lowest first','份额价值 · 从低到高')]]);
    return `<form id="pr-filter-form" class="pr-filter-wrap"><div class="pr-filter-bar">${field(L('Search applications','搜索申请'),`<input class="inp" id="pr-f-q" value="${E(f.q)}" placeholder="${L('Application, token, batch, holding address or company','单笔标识、代币、批次、持有地址或企业名称')}">`)}${field(L('Review status','审核状态'),select('pr-f-status',f.status,[['',L('All','全部')],...Object.entries(status).map(([k,v])=>[k,txt(v)])]))}${field(L('Sort by','排序'),order)}<div class="pr-actions"><button type="button" class="btn" data-act="pr-filters" aria-expanded="${A.filtersOpen}" aria-controls="pr-advanced">${L('Filters','筛选条件')}${count?' ('+count+')':''} <span aria-hidden="true">${A.filtersOpen?'⌃':'⌄'}</span></button>${b('Reset','重置','reset')}<button type="submit" class="btn primary">${L('Search','查询')}</button></div></div>
      <div id="pr-advanced" class="pr-filters" ${A.filtersOpen?'':'hidden'}>${field(labels.source,select('pr-f-source',f.source,[['',L('All','全部')],...Object.entries(sources).map(([k,v])=>[k,txt(v)])]))}${field(labels.follow,select('pr-f-follow',f.follow,[['',L('All','全部')],...Object.entries(follows).map(([k,v])=>[k,txt(v)])]))}<fieldset class="pr-checks"><legend>${L('Notices','并列提示')}</legend>${check('verify','verify')}${check('diff','diff')}</fieldset>${field(labels.owner,select('pr-f-owner',f.owner,[['',L('All','全部')],['A',L('Demo Asset A','示例资产企业 A')],['B',L('Demo Asset B','示例资产企业 B')]]))}${field(labels.project,select('pr-f-project',f.project,[['',L('All','全部')],['01',L('Demo project 01','示例融资项目 01')],['02',L('Demo project 02','示例融资项目 02')],['03',L('Demo project 03','示例融资项目 03')]]))}${field(labels.type,select('pr-f-type',f.type,[['',L('All','全部')],['first',L('Initial pledge','首笔质押')],['add',L('Additional pledge','追加质押')]]))}<div class="pr-dates">${field(labels.from,input('pr-f-from',f.from,'date'))}${field(labels.to,input('pr-f-to',f.to,'date'))}<p class="pr-meta">${L('Dates are UTC calendar days, inclusive.','按 UTC 自然日，起止均含当天。')}</p></div></div>
      ${count?`<div class="pr-applied" aria-label="${L('Applied filters','已应用筛选')}">${extra.filter(k=>applied[k]).map(k=>CF.tag('gray',E(tagText(k)))).join('')}</div>`:''}</form>`;
  }
  function sortButton(k,en,zh){return `<button data-act="pr-sort" data-v="${k}">${L(en,zh)} ${A.sort===k?(A.dir===1?'↑':'↓'):'↕'}</button>`;}
  function queue(){
    const blocked=gate();
    if(blocked)return title(L('Pledge reviews','代币质押审核'),'')+blocked;
    const scope=filtered(true),start=utcDayStart(now(),6);
    const counts=[scope.filter(r=>r.status==='pending').length,
      scope.filter(r=>r.status==='rejected'&&r.follow==='awaiting-release').length,
      scope.filter(r=>['approved','rejected'].includes(r.status)&&r.source!=='terminal'&&r.decisionAt>=start).length];
    const metrics=`<div class="pr-metrics">${[[['Pending review','待审核'],['Includes withdrawals and approvals in progress','含撤回解押处理中、通过处理中与结果待核实']],[['Rejected · awaiting release','已驳回待解押'],['Includes project closure defaults','含项目终态默认不通过']],[['Decided manually · last 7 UTC days','近 7 个自然日人工审结'],['Manual approvals and rejections','人工通过与驳回']]].map(([x,scopeNote],i)=>`<div class="card pr-metric"><span>${txt(x)}</span><strong>${['loading','error'].includes(A.view)?'—':A.view==='empty'?0:counts[i]}</strong><span class="pr-meta">${L('applications','张')} · ${txt(scopeNote)}</span></div>`).join('')}</div><p class="pr-meta">${L('Counts apply the asset holder, project, type, submission date and keyword filters, not the review status, decision source or position filters.','统计应用资产方、目标项目、申请类型、提交时间与关键词条件，不受审核状态、结论来源与去向筛选影响。')}</p>`;
    const state=A.view==='default'?null:surface();
    let found=filtered();
    found.sort((a,c)=>{
      const value=r=>A.sort==='waiting'?waited(r):A.sort==='value'?r.value:r.onchainAt;
      const av=value(a),cv=value(c);
      return av==null?1:cv==null?-1:(av-cv)*A.dir||a.id.localeCompare(c.id);
    });
    const pages=Math.max(1,Math.ceil(found.length/CF.PAGE_SIZE));
    if(A.page>pages){A.page=pages;A.error=['The previous page is empty; showing the last available page.','原页已无记录，已返回最后有效页。'];}
    const table=state||(!found.length
      ?CF.empty(L('No applications found','暂无符合条件的申请'),L('Change the filters or return to pending reviews.','调整筛选条件，或返回待审核队列。'),b('Reset filters','重置筛选','reset'))
      :`<div class="tablewrap"><table class="tbl pr-table pr-queue-table"><thead><tr><th>${L('Application / token / batch','单笔 / 代币 / 批次')}</th><th>${L('Asset holder / project','资产方 / 目标项目')}</th><th>${L('Type','申请类型')}</th><th aria-sort="${A.sort==='value'?(A.dir===1?'ascending':'descending'):'none'}">${sortButton('value','Share value (USD)','份额价值（USD）')}</th><th aria-sort="${A.sort==='onchainAt'?(A.dir===1?'ascending':'descending'):'none'}">${sortButton('onchainAt','Submitted','提交时间')}</th><th>${L('Review status','审核状态')}</th><th>${L('Current position','本笔当前去向')}</th><th class="col-act">${L('Action','操作')}</th></tr></thead><tbody>${found.slice((A.page-1)*CF.PAGE_SIZE,A.page*CF.PAGE_SIZE).map(r=>`<tr><td><strong class="mono">${r.id}</strong><span class="pr-meta mono">${r.token} · ${r.batch}</span><span class="pr-meta mono" title="${E(r.holder)}">${E(short(r.holder))}</span></td><td>${E(owner(r))}<span class="pr-meta">${E(project(r))}</span></td><td>${r.type==='first'?L('Initial pledge','首笔质押'):L('Additional pledge','追加质押')}</td><td class="pr-num mono">${r.value==null?unknown():CF.fmtAmt(r.value)}</td><td>${time(r.onchainAt)}<span class="pr-meta">${L('Waiting','已等待')} ${duration(waited(r))}</span></td><td>${badge(r)}${progressTag(r)?`<span class="pr-meta">${progressTag(r)}</span>`:''}${sourceText(r)?`<span class="pr-meta">${sourceText(r)}</span>`:''}</td><td>${holdBadge(r)}</td><td class="col-act">${link('View','查看','view',r.id)}</td></tr>`).join('')}</tbody></table></div><div class="pager"><span class="total">${L('Total','共')} ${found.length} ${L(found.length===1?'application':'applications','张')} · ${CF.PAGE_SIZE} ${L('per page','张／页')}</span>${b('Previous','上一页','page',A.page-1,'sm',A.page===1)}<span>${A.page} / ${pages}</span>${b('Next','下一页','page',A.page+1,'sm',A.page===pages)}</div>`);
    return title(L('Pledge reviews','代币质押审核'),L('One record is one pledged share whose transfer succeeded on chain.','一条记录对应一张已上链成功的质押申请。'))
      +metrics+`<section class="card">${filters()}<div class="pr-section" ${A.error?'':'hidden'}>${error()}</div>${table}</section>`;
  }
  function title(t,sub){return `<div class="pr-title"><div><h1>${t}</h1>${sub?`<span class="pr-meta">${sub}</span>`:''}</div>${CF.tag('gray',L('Demonstration data','演示数据'))}</div>`;}
  function surface(){S.st=A.view;return CF.surface({emptyTitle:L('No applications yet','暂无待审申请'),
    emptyDesc:L('Applications appear here once a pledge transfer succeeds on chain.','代币质押上链成功后，申请将出现在此。'),
    deniedDesc:L('Contact the platform provider to check the delivered configuration.','请联系平台建设方核对交付配置。'),
    backTo:ROOT,backLabel:L('Back to queue','返回队列'),skelRows:5});}

  /* ---------------------------------------------------------------- 文件 */
  function getFile(key){const [scope,index]=String(key).split(':');return (scope==='draft'?A.draft?.files:row()?.files)?.[+index];}
  function supportsPreview(f){return A.preview!=='unsupported'&&f.previewable!==false&&(f.sample||/^(application\/pdf|image\/(jpeg|png))$/.test(f.type||''));}
  function uploadedFile(f,key,description,remove){return CF.fileRow({key,name:f.name,state:f.state,status:description,previewable:supportsPreview(f),disabled:A.busy,
    preview:{act:'pr-preview',value:key},download:{act:'pr-download',value:key},error:f.error?txt(f.error):'',
    retry:{act:'pr-file-retry',value:key},remove:remove?{act:'pr-remove',value:key.split(':')[1]}:null});}
  function fileList(r){return r.files.length
    ?r.files.map((f,i)=>uploadedFile(f,'record:'+i,L('Linked to this decision','已关联本张结论'),false)).join('')
    :note(L('No formal agreement for this application.','本张暂无正式协议。'));}

  /* ---------------------------------------------------------------- 链上与额度事实 */
  function proofValue(value,label){
    if(!value)return unknown();
    const short=value.slice(0,10)+'…'+value.slice(-8);
    return `<span class="mono" title="${E(value)}">${E(short)}</span>${CF.copyBtn('pr-copy',value,L('Copy '+label,'复制'+label))}`;
  }
  function gasValue(gas,ccy){return gas==null?L('Gas to be verified','gas 待核实'):E(gas+' '+(ccy||''));}
  function quotaLine(r){
    if(r.follow==='released')return L('This share has left the total pledged value and the pledged pending review.','本张已退出总质押额与待审质押额。');
    if(r.status==='approved')return r.effective
      ?L('Counted in the eligible pledged value; the eligible borrowing limit is recalculated with the project pledge ratio.','已计入有效质押价值，有效质押额按项目质押率重算。')
      :L('Moved out of the pledged pending review but not counted in the eligible pledged value. Reason: ','已从待审质押额转出，但不计入有效质押价值。原因：')+E(txt(r.excluded||['To be verified','待核实']));
    if(r.status==='rejected')return L('Counted in the total pledged value and in the rejected part of the pledged pending review; not counted in the eligible borrowing limit.','计入总质押额，以及待审质押额的已驳回部分；不计入有效质押额。');
    if(r.status==='withdrawn')return L('No decision was made; the share has left both amounts after the release.','无审核结论；解押后已退出两项额度。');
    return L('Counted in the total pledged value and in the pending part of the pledged pending review. Not yet counted in the eligible borrowing limit.','计入总质押额，以及待审质押额的待审核部分；尚未计入有效质押额。');
  }
  function supportNote(r){
    if(r.flag==='difference')return note(L('A later on-chain result conflicts with the record. The original facts are kept and further actions on this token are paused. Contact platform support.','迟到的链上结果与原记录冲突，原事实保留，该张后续动作暂停，请联系平台客服人员。'),'warn');
    if(r.flag==='verify')return note(L('No confirmed release result yet. The result is not assumed to be a failure. Contact platform support.','本次解押尚无确认结果，不推定为失败，请联系平台客服人员。'),'warn');
    return '';
  }

  /* ---------------------------------------------------------------- 操作记录 */
  function activity(r){
    const heading=`<h2 class="pr-h2" id="pr-activity-title">${L('Activity','操作记录')}</h2><p class="pr-meta">${L('The only source of this application’s events and later progress, newest first.','本张全部事件与后续进度的唯一来源，按发生时间倒序。')}</p>`;
    let body;
    if(A.activityState==='loading')body=`<p role="status">${L('Loading activity…','正在加载操作记录…')}</p>`;
    else if(A.activityState==='error')body=`<p role="alert">${L('Activity could not be loaded.','操作记录读取失败。')}</p>${b('Retry','重试','activity-retry')}`;
    else {
      const seen=new Set();
      const events=A.activityState==='empty'?[]:r.events
        .filter(e=>{const id=e.id||JSON.stringify([e.at,e.title,e.actor]);if(seen.has(id))return false;seen.add(id);return true;})
        .map((e,i)=>({...e,order:i})).sort((a,c)=>(c.at||0)-(a.at||0)||a.order-c.order);
      body=!events.length?`<p class="pr-meta">${L('No activity yet.','暂无操作记录。')}</p>`
        :`<ol class="pr-timeline" aria-label="${L('Application activity, newest first','本张操作记录，最新在前')}">${events.map(e=>{
        const fields=[];
        if(e.chain){
          fields.push([L('Gas','gas'),gasValue(e.gas,e.gasCcy)]);
          fields.push([e.auth?L('On-chain execution evidence','链上执行凭证'):L('Pledge chain evidence','质押链上凭证'),e.proof?proofValue(e.proof,L('evidence','凭证')):L('None yet','暂无')]);
        }
        if(e.signer)fields.push([L('Signed with','签名钱包'),proofValue(e.signer,L('address','地址'))+`<span class="pr-meta">${L('Platform wallet','平台统一钱包')}</span>`,true]);
        const files=e.files?.length?e.files.map(f=>E(f.name)).join('<br>')+'<br>'+link('View agreement files','查看协议文件','evidence',''):'';
        if(files)fields.push([L('Agreements','协议凭据'),files,true]);
        const tone=({'Approved':'ok','Approval not completed':'danger','Approval result to be verified':'warn','Release succeeded':'ok','Rejected':'danger','Rejected by default at project end':'danger','Release failed':'danger',
          'Reconciliation discrepancy':'warn','Release result to be verified':'warn'})[e.title[0]]||'neutral';
        const occurred=e.at?`<time datetime="${E(new Date(e.at).toISOString())}">${time(e.at)}</time>`:`<span>${L('Time: to be verified','发生时间：待核实')}</span>`;
        const extra=e.text||e.next||fields.length;
        return `<li class="pr-event" data-event-id="${E(e.id||e.order)}" data-tone="${tone}"><h3>${E(txt(e.title))}</h3><div class="pr-event-meta"><span>${e.actor?E(txt(e.actor)):L('Actor: to be verified','操作主体：待核实')}</span>${occurred}</div><p class="pr-event-result">${E(txt(e.result||['Recorded','已记录']))}</p>${extra?`<details><summary aria-label="${E(L('View details: ','查看详情：')+txt(e.title))}">${L('View details','查看详情')}</summary><div class="pr-event-detail">${e.text?`<p>${E(txt(e.text))}</p>`:''}${e.next?`<p>${E(txt(e.next))}</p>`:''}${fields.length?kv(fields):''}</div></details>`:`<span class="pr-meta">${L('Evidence: none','凭据：无')}</span>`}</li>`;
      }).join('')}</ol>`;
    }
    return `<section class="card pr-section pr-activity" id="pr-activity" tabindex="-1" aria-labelledby="pr-activity-title">${heading}${body}</section>`;
  }

  /* ---------------------------------------------------------------- 详情 */
  function detail(){
    const blocked=gate();
    if(blocked)return title(L('Application details','单笔审核详情'),'')+blocked;
    const r=row();
    if(!r)return CF.empty(L('Application unavailable','申请不可用'),L('Return to the review queue.','请返回审核队列。'),b('Back to queue','返回队列','back'));
    if(A.view!=='default')return title(E(r.id),'')+surface();
    const p=projectOf(r),batch=A.rows.filter(x=>x.batch===r.batch);
    const pendingInBatch=batch.filter(x=>x.status==='pending').length;
    const related=A.rows.filter(x=>x.owner===r.owner&&x.project===r.project&&x.batch!==r.batch).sort((a,c)=>c.onchainAt-a.onchainAt);
    const summary=Object.entries(status).map(([k,v])=>`${txt(v)} ${batch.filter(x=>x.status===k).length}`).join(' · ');
    const followSummary=[['awaiting-release',follows['awaiting-release']],['releasing',follows.releasing],['released',follows.released]]
      .map(([k,label])=>txt(label)+' '+batch.filter(x=>x.follow===k).length).join(' · ');

    const overview=section('Application overview','申请概览',facts([
        [L('Asset holder','资产方'),E(owner(r))+`<span class="pr-meta mono">DEMO-ENTITY-${r.owner}</span>`],
        [L('Target project','目标项目'),E(project(r))+`<span class="pr-meta mono">${E(p.id)}</span>`],
        [L('Project status','项目状态'),p.status==='settled'?L('Settled','已结清')+`<span class="pr-meta">${time(p.closedAt)}</span>`:p.status==='closed'?L('Closed','已关闭')+`<span class="pr-meta">${L('Closure reason: ','关闭原因：')}${E(txt(p.closeReason))} · ${time(p.closedAt)}</span>`:L('Open · reviewed and deployed','可用 · 已通过审核并完成合约部署')],
        [L('Application type','申请类型'),r.type==='first'?L('Initial pledge','首笔质押'):L('Additional pledge','追加质押')],
        [L('Submission batch','提交批次编号'),`<span class="mono">${E(r.batch)}</span>`],
        [L('Submitted','提交时间'),time(r.onchainAt)],
        [L(endedAt(r)?'Waited until the result':'Waiting so far',endedAt(r)?'终结前等待时长':'已等待时长'),duration(waited(r))],
        [L('Amount attribution','额度归属'),quotaLine(r),true]
      ]))
      +section('Project parameters','项目参数',facts([
        [L('Project pledge ratio','项目质押率'),(p.ratio*100).toFixed(0)+'%'],
        [L('Project term','项目期限'),p.termMonths+' '+L('months','个月')],
        [L('Project valid until','项目有效期至'),time(p.createdAt+p.termMonths*30*86400000)]
      ])+`<p class="pr-meta">${L('Locked and read-only; not configured or adjusted here.','均已锁定、只读，本模块不配置、不调整。')}</p>`)
      +section('Share facts','本张份额事实',facts([
        [L('Token identifier','代币编号'),`<span class="mono">${E(r.token)}</span>`],
        [L('Holding address','持有地址'),proofValue(r.holder,L('address','地址')),true],
        [L('Quantity held / token symbol','持有数量 / 代币符号'),r.amount==null?unknown():CF.fmtAmt(r.amount)+' '+r.tokenCcy],
        [L('Share value','份额价值'),money(r.value)],
        [L('Underlying receivable tenor','底层应收账款账期'),r.term+' '+L('days','天')],
        [L('Buyer','买方企业'),r.buyer?E(r.buyer):unknown()],
        [L('Validity','有效性'),r.valid?L('Valid','有效'):L('Invalid','已失效')]
      ]))
      +section('Pledge chain facts','质押链上事实',facts([
        [L('Pledge chain','质押链'),L('Ethereum (ETH)','以太坊（ETH）')],
        [L('Current position','本笔当前去向'),holdBadge(r)],
        [L('Pledge contract address','质押合约地址'),proofValue(r.contract,L('address','地址')),true],
        [L('On-chain time','上链时点'),time(r.onchainAt)],
        [L('Gas paid by the asset holder','资产方承担的 gas'),gasValue(r.gas,r.gasCcy)],
        [L('Pledge chain evidence','质押链上凭证'),proofValue(r.proof,L('evidence','凭证')),true]
      ])+`<p class="pr-meta">${L('Read-only facts. The only on-chain action on the operations side is the approval itself, signed with the platform wallet and executed on chain to unfreeze the share; operations never sign for the asset holder or pay their gas. The platform does not verify these facts on chain.','只读事实。运营端唯一的链上动作是通过本身：连接平台统一钱包签名提交，由链上执行解除本份冻结；不代资产方签名、不代付其 gas。平台不做链上核验。')}</p>`+supportNote(r))
      +decisionCard(r)+activity(r);

    const batchTab=section('Batch context','批次上下文',
      `<div class="pr-row"><b class="mono">${E(r.batch)}</b>${CF.tag('gray',pendingInBatch===batch.length?L('Pending review','待审核'):pendingInBatch?L('Review in progress','审核进行中'):L('Review ended','审核已结束'))}</div><span class="pr-meta mono" title="${E(r.holder)}">${L('Holding address ','持有地址 ')}${E(short(r.holder))}</span><p class="pr-meta">${summary} · ${L('total','合计')} ${batch.length}</p><p class="pr-meta">${L('Position summary: ','去向摘要：')}${followSummary}</p><div class="tablewrap"><table class="tbl pr-table"><thead><tr><th>${L('Token / application','代币 / 单笔')}</th><th>${L('Review','审核')}</th><th>${L('Current position','本笔当前去向')}</th><th>${L('Reviewer / time','审核人 / 时间')}</th><th class="col-act">${L('Action','操作')}</th></tr></thead><tbody>${batch.map(x=>`<tr><td>${E(x.token)}<span class="pr-meta mono">${E(x.id)}</span></td><td>${badge(x)}${sourceText(x)?`<span class="pr-meta">${sourceText(x)}</span>`:''}</td><td>${holdBadge(x)}</td><td>${x.operator?txt(x.operator):'—'}<span class="pr-meta">${time(endedAt(x))}</span></td><td class="col-act">${x.id===r.id?L('Current','当前'):link('View','查看','view',x.id)}</td></tr>`).join('')}</tbody></table></div>`)
      +section('Related applications','相关申请',
      `<p class="pr-meta">${L('Same project and asset holder, other batches.','同项目、同资产方的其他批次申请。')}</p>${related.length?`<div class="tablewrap"><table class="tbl pr-table"><thead><tr><th>${L('Application / token','单笔 / 代币')}</th><th>${L('Batch / submitted','批次 / 提交时间')}</th><th>${L('Review status','审核状态')}</th><th class="col-act">${L('Action','操作')}</th></tr></thead><tbody>${related.map(x=>`<tr><td><strong class="mono">${E(x.id)}</strong><span class="pr-meta mono">${E(x.token)}</span>${x.previous?`<span class="pr-meta">${L('Pledged again after ','解押后重新质押自 ')}${E(x.previous)}</span>`:''}</td><td>${E(x.batch)}<span class="pr-meta">${time(x.onchainAt)}</span></td><td>${badge(x)}</td><td class="col-act">${link('View','查看','view',x.id)}</td></tr>`).join('')}</tbody></table></div>`:note(L('No related applications.','暂无相关申请。'))}`);

    const tabs=[['overview',L('Overview','概览')],['related',L('Linked applications','关联申请')]];
    return (A.source?`<div class="pr-origin"><a class="actlink" href="#${E(detailRoute(A.source,'related'))}" data-act="pr-origin">${L('Return to ','返回来源申请 ')}${E(A.source)}</a></div>`:'')
      +title(E(r.id),E(r.token))+(A.draft?'':error())
      +`<div class="card pr-detail-summary"><div><span class="pr-meta">${L('Review status','审核状态')}</span>${badge(r)}${progressTag(r)?`<span class="pr-meta">${progressTag(r)}</span>`:''}${sourceText(r)?`<span class="pr-meta">${L('Decision source: ','结论来源：')}${sourceText(r)}</span>`:''}</div><div><span class="pr-meta">${L('Share value','份额价值')}</span><strong class="pr-value mono">${money(r.value)}</strong></div><div><span class="pr-meta">${L('Current position','本笔当前去向')}</span>${holdBadge(r)}</div></div>`
      +`<div class="pr-grid"><div class="pr-detail-main"><div class="pr-tabs" role="tablist" aria-label="${L('Application sections','申请详情分区')}">${tabs.map(([k,label])=>`<button type="button" role="tab" id="pr-tab-${k}" aria-selected="${A.tab===k}" aria-controls="pr-detail-panel" tabindex="${A.tab===k?0:-1}" data-act="pr-tab" data-v="${k}">${label}</button>`).join('')}</div><div id="pr-detail-panel" role="tabpanel" tabindex="0" aria-labelledby="pr-tab-${A.tab}" class="detail-stack pr-stack">${A.tab==='overview'?overview:batchTab}</div></div>
      <aside class="pr-stack pr-rail">${reviewCard(r)}</aside></div>`;
  }
  function decisionCard(r){
    if(!['approved','rejected'].includes(r.status))return '';
    const terminal=r.source==='terminal';
    return section('Decision and evidence','审核结论与凭据',facts([
        [L('Decision','结论'),txt(status[r.status])],
        [L('Decision source','结论来源'),txt(sources[r.source||'manual'])],
        [L(terminal?'Decided by':'Reviewer',terminal?'审核主体':'审核人'),txt(r.operator)],
        [L('Decision time','结论时间'),time(r.decisionAt)],
        [L('Decision record','结论记录编号'),`<span class="mono">${E(r.reviewId||'')}</span>`],
        ...(terminal?[]:[[L('Share value at the decision','结论时份额价值'),money(r.snapshot)]]),
        ...(r.status==='rejected'&&!terminal?[[L('Category','原因归类'),r.category!==''?txt(categories[+r.category]):'—']]:[]),
        ...(r.status==='rejected'?[[L('Rejection reason','驳回原因'),`<div class="pr-confirm">${E(txt(r.reason))}</div>`,true]]:[]),
        ...(r.remark?[[L('Internal note','内部备注'),E(r.remark),true]]:[])
      ])+(r.status==='approved'?`<div class="pr-evidence" id="pr-evidence" tabindex="-1"><h3>${L('Pledge agreements','质押协议')}</h3>${fileList(r)}</div>`:''));
  }
  function reviewCard(r){
    const writable=canWrite(r);
    const permission=!canDecide()
      ?L('View access only. This account does not hold the pledge decision permission.','当前仅有代币质押申请查询权限，不能处置。')
      :r.status==='rejected'&&r.source==='terminal'?L('The project reached a final state, so the system rejected this application by default. It is read-only and cannot be decided again.','所属项目已进入终态，系统已默认不通过；记录只读，不能补裁定或改判。')
      :r.status!=='pending'?L('This review has ended. The record is read-only.','本张审核已结束，记录只读。')
      :withdrawing(r)?L('The asset holder’s withdrawal is in progress, so this application cannot be decided. It becomes withdrawn if the release succeeds, and decidable again if the release fails.','资产方撤回处理中，暂不可裁定：解押成功转为已撤回，解押失败恢复为可裁定。')
      :authOf(r)==='processing'?L('Approval in progress. It stands only once it is executed on chain; this application cannot be decided meanwhile, and the asset holder cannot withdraw it.','通过处理中：链上执行成功才算通过，本张暂不可裁定；资产方此时也不能撤回。')
      :authOf(r)==='unknown'?L('Approval result to be verified. It is not assumed to be a success or a failure and cannot be submitted again; it is handled by the real result once written back. Contact platform support if needed.','通过结果待核实：不推定成功或失败，不能重复提交；真实结果回写后按结果处理，如需核实请联系平台客服人员。')
      :L('The facts here support your offline decision; record the decision you have reached offline.','本处信息供线下判定参考，结论由审核人线下作出后在此维护。');
    const waiting=`<div class="pr-rail-time"><span class="pr-meta">${L(endedAt(r)?'Waited until the result':'Waiting so far',endedAt(r)?'终结前等待时长':'已等待时长')}</span><strong>${duration(waited(r))}</strong>${r.status==='pending'?`<span class="pr-meta">${L('A statement of fact, not a deadline: the review has no time limit.','事实陈述，不是期限：审核不设时效。')}</span>`:''}</div>`;
    const actions=canDecide()&&r.status==='pending'?`<div class="pr-stack">${b('Approve this application','通过本张申请','approve','','primary',!writable)}${b('Reject this application','驳回本张申请','reject','','',!writable)}</div>`:'';
    const hint=r.status==='pending'
      ?`<p class="pr-meta pr-disclosure">${L('Approval is signed with the platform wallet and stands only once it is executed on chain, which unfreezes the share. The gas is borne by the platform wallet; no platform fee is charged.','通过需连接平台统一钱包签名提交，链上执行成功（即解冻成功）才算通过；gas 由平台统一钱包承担，不向资产方收取平台费用。')}</p>`
      :r.status==='rejected'&&r.follow!=='released'
        ?`<p class="pr-meta pr-disclosure">${L('The share stays in the pledge contract until the asset holder releases it; operations have no release entry.','份额在资产方自助解押成功前持续留在质押合约内，运营端没有解押入口。')}</p>`:'';
    return section('Review actions','审核处理',`<p class="pr-meta">${permission}</p>${waiting}${actions}${hint}`);
  }

  /* ---------------------------------------------------------------- 办理 */
  function identity(r){return `<div class="pr-confirm">${E(r.id)} · ${E(r.token)}<span class="pr-meta">${E(r.batch)} · ${E(project(r))}</span></div>`;}
  function start(mode){
    const why=blockReason(row());
    if(why){A.error=why;CF.render();CF.toast(txt(why));return;}
    if(!canWrite(row()))return deny();
    const kept=mode==='approve'&&row().authDraft;
    A.draft={id:row().id,mode,files:kept?kept.files.map(f=>({...f})):[],reason:'',category:'',remark:kept?kept.remark:'',ack:false};A.error='';open('edit');
  }
  function validate(){
    const d=A.draft;if(!d)return false;A.error='';
    if(d.mode==='approve'){
      if(d.files.length<1||d.files.length>5)A.error=['Choose 1–5 agreement files.','请选择 1～5 个协议文件。'];
      else if(d.files.some(f=>f.state!=='ready'))A.error=['Wait for all uploads to finish, or remove and replace failed files.','请等待所有文件上传完成，或移除并替换失败文件。'];
      else if(Array.from(d.remark).length>200)A.error=['Internal note must not exceed 200 characters.','内部备注不能超过 200 字。'];
      else if(!d.ack)A.error=['Confirm that you understand the business effect of this decision.','请确认知悉本次结论的业务后果。'];
    }else{
      const s=d.reason.trim(),n=Array.from(s).length;
      if(n<10||n>500||!/[\p{L}\p{N}]/u.test(s))A.error=['Enter a reason of 10–500 characters; punctuation alone is not valid.','原因需为 10～500 字，不能仅填标点。'];
    }
    return !A.error;
  }
  function applyDecision(r,d,other=false){
    if(r.status!=='pending')return false;
    r.status=d.mode==='approve'?'approved':'rejected';
    r.decisionAt=now();r.operator=other?['Demo operator Chen','示例审核员陈']:(d.mode==='approve'?(r.authSigner||ME):ME);
    r.reviewId=r.id.replace('PR','RV');r.snapshot=r.value;r.source='manual';
    r.reason=d.mode==='reject'?d.reason.trim():'';r.category=d.category;r.remark=d.remark;
    r.files=d.mode==='approve'?d.files.map(f=>({...f})):[];
    r.effective=d.mode==='approve'?r.valid:r.effective;
    r.follow=d.mode==='approve'?'effective':'awaiting-release';
    if(d.mode==='approve')r.auth='success';
    event(r,d.mode==='approve'?['Approved','审核通过']:['Rejected','审核驳回'],
      d.mode==='approve'?['Pending review → Approved','待审核 → 通过']:['Pending review → Rejected','待审核 → 驳回'],
      {actor:d.mode==='approve'?['System','系统']:r.operator,files:r.files.map(f=>({name:f.name})),auth:d.mode==='approve',chain:d.mode==='approve',gas:d.mode==='approve'?0.0011:undefined,gasCcy:'ETH',proof:d.mode==='approve'?r.authProof:undefined,
       text:d.mode==='approve'
         ?(r.valid?['Executed on chain, so the share is unfrozen. Moved out of the pledged pending review and counted in the eligible pledged value; the eligible borrowing limit has been recalculated. No platform fee.','链上执行成功（即解冻成功），已从待审质押额转出并计入有效质押价值，有效质押额随之重算；未产生平台费用。']
           :['Moved out of the pledged pending review. The underlying asset is invalid, so the token is not counted in the eligible pledged value; the approval stands.','已从待审质押额转出。底层资产已失效，该张未计入有效质押价值，审核结论仍为通过。'])
         :r.reason,
       next:d.mode==='reject'?['The token stays in the pledge contract. The asset holder releases it and bears the gas.','份额仍在质押合约内，由资产方自助解押，gas 自担。']:['Approval notice sent to the asset holder.','已向资产方发送通过通知。']});
    A.events.push({id:r.id,event:d.mode==='approve'?L('approved · approval notice sent','通过 · 已发送通过通知'):L('rejected · rejection notice sent','驳回 · 已发送驳回通知')});
    return true;
  }
  function submit(){
    const d=A.draft,r=row();
    if(A.busy)return;
    if(!d||d.id!==r?.id||!canWrite(r))return deny();
    if(d.mode==='approve'&&!d.signed)return deny();
    if(!validate()){open('edit');return;}
    A.busy=true;A.error='';CF.render();
    const epoch=A.epoch,response=A.response;
    setTimeout(()=>{
      if(epoch!==A.epoch||A.draft!==d)return;
      A.busy=false;
      /* 办理打开期间本张进入撤回解押处理中，或所属项目进入终态被默认不通过：提交被拒，已填内容保留。 */
      if(response==='withdraw'&&r.status==='pending'&&!authBusy(r))startWithdrawal(r);
      if(response==='terminal'&&r.status==='pending')enterTerminal(r.project,true);
      const why=blockReason(r);
      if(why){d.signed=false;A.response='success';A.error=why;open('edit');return;}
      if(!canWrite(r))return deny();
      if(response==='fail'){d.signed=false;A.error=['Could not save the decision. Your inputs are preserved.','结论保存失败，已保留输入，请重试。'];open('edit');return;}
      if(response==='concurrent'){
        applyDecision(r,{mode:'reject',reason:L('Materials require further verification by the asset holder.','申请材料尚需资产方进一步核实后重新发起。'),category:'3',remark:'',files:[]},true);
        A.draft=null;S.layer=null;
        A.error=['Another reviewer has decided this application. The current result is shown.','本张已由其他审核员处理，已显示当前结论、审核人及时间。'];
        CF.render();return;
      }
      if(response==='unknown'){
        A.uncertain={id:r.id,d:{...d}};A.draft=null;S.layer=null;
        A.error=['Decision result is being confirmed. Check the current result before proceeding.','结论结果待确认，请查询当前结果后再操作。'];
        CF.render();return;
      }
      if(d.mode==='approve'){
        beginAuth(r,d);A.tab='overview';saveContext();A.draft=null;S.layer=null;A.response='success';
        CF.render();CF.toast(L('Signed and submitted. The approval is in progress.','已签名提交，通过处理中。'));return;
      }
      applyDecision(r,d);A.tab='overview';saveContext();A.draft=null;S.layer=null;A.response='success';
      CF.render();CF.toast(L('Decision saved for this application.','本张审核结论已保存。'));
    },650);
  }
  /* 签名提交后为通过处理中：仍是待审核，不计入有效质押额、不发通知，暂不可裁定。 */
  function beginAuth(r,d){
    r.auth='processing';r.authSigner=ME;r.authFail=null;r.authProof='0xDEMO'+'0'.repeat(58)+'A1';
    r.authDraft={files:d.files.map(f=>({...f})),remark:d.remark};
    event(r,['Approval submitted','提交通过'],['Pending review · approval in progress','待审核 · 通过处理中'],
      {actor:ME,signer:CF.opsWallet.platform,auth:true,chain:true,gas:null,gasCcy:'ETH',proof:r.authProof,
       text:['Signed with the platform wallet. The approval stands only once it is executed on chain; the token is not yet counted in the eligible pledged value and no notice is sent.','已用平台统一钱包签名提交。链上执行成功才算通过；本张暂不计入有效质押额，也不发送通知。']});
  }
  /* 资产方发起待审撤回：去向转为解押处理中，本张仍是待审核、暂不可裁定。 */
  function startWithdrawal(r){
    r.follow='releasing';
    r.release={kind:'withdraw',startedAt:now(),completedAt:null,gas:0.0014,gasCcy:'ETH',proof:null,result:'processing'};
    event(r,['Withdrawal initiated','待审撤回发起'],['Pending review · withdrawal in progress','待审核 · 撤回解押处理中'],
      {actor:['Asset holder','资产方'],chain:true,gas:0.0014,gasCcy:'ETH',
       text:['The asset holder is releasing this share while it is still pending. It cannot be decided until the release has a result.','资产方在待审期间自助解押取回本张；解押有结果前暂不可裁定。']});
  }
  /* 所属项目进入终态（D-PR-41）：仍待审核的张由系统默认不通过，发送驳回通知，份额仍须资产方自助解押。
     通过处理中或通过结果待核实时项目不会进入终态。 */
  /* 终态与系统原因：已关闭（带出关闭原因：资产方主动关闭 / 有效期到期）或已结清。 */
  const TERMINAL={
    owner:{status:'closed',closeReason:['Closed by the asset holder','资产方主动关闭'],
      reason:['The project has been closed, so this unreviewed pledge is rejected by default. Project closure reason: closed by the asset holder.','所属项目已关闭，未审核的质押默认不通过。项目关闭原因：资产方主动关闭。']},
    expiry:{status:'closed',closeReason:['Valid-until date reached','有效期到期'],
      reason:['The project has been closed, so this unreviewed pledge is rejected by default. Project closure reason: valid-until date reached.','所属项目已关闭，未审核的质押默认不通过。项目关闭原因：有效期到期。']},
    settled:{status:'settled',closeReason:null,
      reason:['The project has been settled, so this unreviewed pledge is rejected by default.','所属项目已结清，未审核的质押默认不通过。']}
  };
  function enterTerminal(key,quiet,kind='owner'){
    const p=A.projects[key],T=TERMINAL[kind]||TERMINAL.owner;
    if(!p||['closed','settled'].includes(p.status))return false;
    const open=A.rows.filter(x=>x.project===key&&x.status==='pending');
    if(open.some(authBusy)){if(!quiet)CF.toast(L('This project still has an approval being executed on chain, so it cannot reach a final state yet.','本项目仍有通过处理中或结果待核实的链上操作，暂不会进入终态。'));return false;}
    p.status=T.status;p.closedAt=now();p.closeReason=T.closeReason;
    const reason=T.reason;
    open.forEach(x=>{
      x.status='rejected';x.source='terminal';x.decisionAt=p.closedAt;x.operator=['System','系统'];x.reviewId=x.id.replace('PR','RV');
      x.reason=reason;x.category='';x.remark='';x.files=[];
      if(x.follow!=='releasing')x.follow='awaiting-release';
      event(x,['Rejected by default at project end','项目终态默认不通过'],['Pending review → Rejected','待审核 → 驳回'],
        {actor:['System','系统'],text:reason,
         next:['The rejection notice was sent to the asset holder with this reason. The share stays in the pledge contract until the asset holder releases it.','已向资产方发送质押审核驳回通知，原因同上。份额仍在合约内，由资产方自助解押取回。']});
      A.events.push({id:x.id,event:L('rejected by default · rejection notice sent','项目终态默认不通过 · 已发送驳回通知')});
    });
    return true;
  }
  /* 通过的链上执行结果回写：成功即通过；失败为“通过未成功”，回到可裁定的待审核；长期无结果标结果待核实。 */
  function authResult(kind){
    const r=row();if(!r||!authBusy(r)||r.status!=='pending')return;
    if(kind==='success'){
      const kept=r.authDraft||{files:[],remark:''};
      applyDecision(r,{mode:'approve',files:kept.files,remark:kept.remark,reason:'',category:''});
      CF.toast(L('Executed on chain. The application is approved and the notice was sent.','链上执行成功，本张已通过并发送通知。'));
    }else if(kind==='failed'){
      r.auth='failed';
      r.authFail={at:now(),gas:0.0008,gasCcy:'ETH',proof:r.authProof,reason:['The approval transaction was rejected on chain: the platform wallet did not have enough balance for the gas.','通过的链上执行被拒绝：平台统一钱包余额不足以支付 gas。']};
      event(r,['Approval not completed','通过未成功'],['Approval in progress → Pending review','通过处理中 → 待审核'],
        {auth:true,chain:true,gas:r.authFail.gas,gasCcy:'ETH',proof:r.authProof,text:r.authFail.reason,
         next:['Not approved and the asset holder is not notified. The agreements and note are kept; submit the approval again or reject instead.','不算通过，不通知资产方；协议与备注已保留，可再次提交通过或改为驳回。']});
    }else{
      r.auth='unknown';
      event(r,['Approval result to be verified','通过结果待核实'],['No confirmed on-chain result','尚无确定的链上结果'],
        {auth:true,chain:true,gas:null,gasCcy:'ETH',proof:r.authProof,
         text:['No confirmed result yet. It is not counted as approved, not assumed to have failed, and cannot be submitted again. Contact platform support if needed.','尚无确定结果：不算通过，不推定失败，也不能重复提交；如需核实请联系平台客服人员。']});
    }
    CF.render();
  }
  function editLayer(){
    const d=A.draft,r=row();
    if(!d||!r)return {title:L('Unavailable','不可用'),html:'',foot:b('Close','关闭','cancel')};
    const facts=kv([[L('Share value','份额价值'),money(r.value)],[L('Submitted','提交时间'),time(r.onchainAt)],
      [L('Holding address','持有地址'),proofValue(r.holder,L('address','地址')),true],
      [L('Current position','本笔当前去向'),holdBadge(r)],[L('Pledge chain evidence','质押链上凭证'),proofValue(r.proof,L('evidence','凭证')),true]]);
    const blocked=!!blockReason(r);
    const docs=d.files.map((f,i)=>uploadedFile(f,'draft:'+i,f.state==='ready'?L('Ready','已就绪'):f.state==='uploading'?L('Uploading…','上传中…'):L('Upload failed — remove and retry','上传失败，请移除后重试'),true)).join('');
    const body=d.mode==='approve'
      ?`${facts}${field(L('Pledge agreements','质押协议'),`<label class="btn pr-upload" for="pr-upload">${L('Upload agreements','上传协议')}<input class="sr-only" id="pr-upload" aria-required="true" type="file" accept="application/pdf,image/jpeg,image/png" multiple></label>`,true)}<span class="pr-meta">${L('PDF / JPG / PNG · 1–5 files · up to 10 MB each','PDF / JPG / PNG · 1～5 个 · 每个不超过 10 MB')}</span>${docs}${field(L('Internal note (optional)','内部备注（选填）'),`<textarea class="inp" id="pr-remark" aria-invalid="${!!A.error&&Array.from(d.remark).length>200}">${E(d.remark)}</textarea><span class="pr-meta">${Array.from(d.remark).length} / 200</span>`,false)}<label><input id="pr-ack" aria-required="true" type="checkbox" ${d.ack?'checked':''}> ${CF.fieldLabel('',true)}${L('I understand: once the approval is executed on chain (which unfreezes the share), this token moves out of the pledged pending review and the lending platform decides whether it counts in the eligible pledged value. The decision cannot be changed and no platform fee is charged.','我已知悉：通过在链上执行成功（即解冻成功）后，该张从待审质押额转出，是否计入有效质押价值由借贷平台按有效性判定；结论不可修改，不向资产方收取平台费用。')}</label><p class="pr-meta">${L('Next, connect the platform wallet to sign and submit the approval. Only the platform wallet address can sign; its gas is borne by the platform wallet.','下一步连接平台统一钱包签名提交通过；只有平台统一钱包地址可以签名，gas 由平台统一钱包承担。')}</p>`
      :`${facts}${field(L('Category (optional)','归类（选填）'),select('pr-category',d.category,[['',L('Not selected','未选择')],...categories.map((x,i)=>[String(i),txt(x)])]),false)}${field(L('Reason shown to the asset holder','向资产方展示的原因'),`<textarea class="inp" id="pr-reason" aria-required="true" aria-invalid="${!!A.error}" aria-describedby="pr-form-error">${E(d.reason)}</textarea><span class="pr-meta">${Array.from(d.reason.trim()).length} / 500 · ${L('Minimum 10 characters','至少 10 字')}</span>`,true)}`;
    return {title:d.mode==='approve'?L('Approve this application','通过本张申请'):L('Reject this application','驳回本张申请'),
      html:`<div class="pr-form">${identity(r)}<fieldset ${A.busy?'disabled':''}>${body}</fieldset><div id="pr-form-error">${error()}</div>${A.busy?'<p role="status">'+L('Saving decision…','正在保存结论…')+'</p>':''}</div>`,
      foot:b('Cancel','取消','cancel','','',A.busy)+(d.mode==='approve'
        ?b('Connect wallet, sign and approve','连接平台统一钱包，签名并提交通过','sign','','primary',A.busy||blocked)
        :b('Review decision','核对结论','confirm','','primary',A.busy||blocked))};
  }
  const layers={
    'pr-edit':editLayer,
    'pr-confirm':()=>({title:L('Confirm rejection','确认驳回'),
      html:identity(row())+`<div class="pr-section"><b>${L('Reject this application only','仅驳回本张申请')}</b><div class="pr-confirm">${E(A.draft?.reason.trim())}</div><p class="pr-meta">${L('The reason above is shown in full to the asset holder. Other applications are unchanged. The share stays in the pledge contract until the asset holder releases it and bears the gas.','以上原因将全文展示给资产方，其他张不受影响。份额仍留在质押合约内，需由资产方自助解押，gas 自担。')}</p>${A.busy?'<p role="status">'+L('Saving decision…','正在保存结论…')+'</p>':''}</div>`,
      foot:b('Back','返回修改','edit','','',A.busy)+b('Confirm rejection','确认驳回','submit','','primary',A.busy||!!blockReason(row()))}),
    'pr-discard':()=>({title:L('Discard unsaved inputs?','放弃未提交内容？'),
      html:note(L('Files, notes and reasons will not be carried to another application.','未提交文件、备注及原因不会带入其他申请。')),
      foot:b('Keep editing','继续编辑','keep')+b('Discard','放弃内容','discard','','primary')}),
    'pr-preview':()=>({title:L('Agreement preview','协议预览'),html:previewHTML(),
      foot:b('Close','关闭','close')+b('Download','下载','download',A.previewKey,'primary')})
  };

  /* ---------------------------------------------------------------- 文件读取 */
  function sampleURL(){
    const stream='BT /F1 18 Tf 40 150 Td (DEMONSTRATION AGREEMENT) Tj 0 -30 Td (Covers the DEMO tokens in the linked applications.) Tj ET';
    const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 220] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
    let pdf='%PDF-1.4\n',offsets=[0];
    objs.forEach((o,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});
    const x=pdf.length;
    pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
    return URL.createObjectURL(new Blob([pdf],{type:'application/pdf'}));
  }
  let sample;
  function fileURL(f){if(f.sample)return sample||(sample=sampleURL());return f.url;}
  function previewHTML(){
    if(!allowed())return note(L('Access denied.','无权查看。'));
    const f=getFile(A.previewKey);
    if(!f)return note(L('File unavailable.','文件不可用。'));
    if(A.preview==='missing')return note(L('File could not be retrieved. Retry later.','文件暂时不可得，请稍后重试。'))+b('Retry','重试','preview-retry');
    if(A.preview==='fail')return note(L('Preview failed. Download the file to view it.','预览失败，请下载后查看。'))+b('Retry preview','重试预览','preview-retry');
    if(f.error)return note(E(txt(f.error)))+b('Retry download','重试下载','file-retry',A.previewKey);
    if(f.sample)return `<div class="pr-confirm"><h3>${L('Demonstration agreement','演示协议')}</h3><p>${E(row().batch)} · ${E(row().token)}</p><p>${L('This demonstration document covers the DEMO token of this application.','此演示材料对应本张的 DEMO 代币。')}</p></div>`;
    return /image/.test(f.type)?`<img class="pr-preview" src="${E(fileURL(f))}" alt="${E(f.name)}">`:`<object class="pr-preview" type="application/pdf" data="${E(fileURL(f))}">${L('Download the PDF to view it.','请下载 PDF 查看。')}</object>`;
  }
  function closePreview(){
    const saved=A.previewReturn;A.previewReturn=null;
    if(saved?.draft&&A.draft)open('edit');else CF.closeLayer();
    requestAnimationFrame(()=>{if(saved){window.scrollTo(0,saved.y);const body=document.querySelector('.modal-b');if(body)body.scrollTop=saved.scroll;const target=[...document.querySelectorAll('[data-act="pr-preview"]')].find(el=>el.dataset.v===saved.key);target?.focus({preventScroll:true});}});
  }
  function download(key){
    if(!allowed())return deny();
    const f=getFile(key);if(!f||f.state!=='ready')return;
    if(['missing','downloadfail'].includes(A.preview)){
      f.error=A.preview==='missing'?['File unavailable. Retry later.','文件暂时不可得，请稍后重试。']:['Download failed. Please retry.','下载失败，请重试。'];
      CF.render();CF.toast(txt(f.error));return;
    }
    f.error=null;const a=document.createElement('a');a.href=fileURL(f);a.download=f.name;a.click();
  }

  /* ---------------------------------------------------------------- 演示工具 */
  function grant(mode){
    if(!CF.opsAuth)return;
    CF.opsAuth.seedDemo(mode==='admin'?'admin':'specialist');
    if(mode==='query'){OPS.onAct('ops-grant','7');}
    if(mode==='decide'){OPS.onAct('ops-grant','8');}
    if(mode==='full'){OPS.onAct('ops-grant','7');OPS.onAct('ops-grant','8');}
    A.epoch++;A.draft=null;A.busy=false;A.error='';S.layer=null;
  }
  function demo(){
    if(OPS_PAGES.includes(S.page))return OPS.demo();
    const r=row();
    return `<h3>${L('Pledge review · demo tools','代币质押审核 · 演示工具')}</h3><p class="pr-meta">${L('Local demonstration only. Wallet connection and signing, transfers, files and notifications are all simulated.','仅本地演示：钱包连接与签名、代币转移、文件与消息服务均为模拟。')}</p>
      <h4>${L('Delivered account configuration','交付的账号配置')}</h4><div class="pr-demo-actions">${b('Administrator','运营管理员','grant','admin')}${b('Later role · no pledge access','后期角色 · 未开通本模块','grant','none')}${b('Later role · query only','后期角色 · 仅开通申请查询','grant','query')}${b('Later role · decision only','后期角色 · 仅开通审核处置','grant','decide')}${b('Later role · query + decision','后期角色 · 查询＋处置','grant','full')}</div>
      <div class="pr-demo">${field(L('Page state','页面状态'),select('pr-view',A.view,[['default',L('Default','默认')],['loading',L('Loading','加载中')],['empty',L('Empty','空数据')],['noresult',L('No results','筛选无结果')],['error',L('Load failed','读取失败')]]))}${field(L('Submit response','提交反馈'),select('pr-response',A.response,[['success',L('Success','成功')],['fail',L('Failure','失败')],['unknown',L('Uncertain result','结果待确认')],['concurrent',L('Another reviewer wins','同张已被他人裁定')],['withdraw',L('Asset holder’s withdrawal takes effect first','资产方撤回先于本次提交生效')],['terminal',L('Project reaches a final state first','所属项目先进入终态')]]))}${field(L('Upload response','上传反馈'),select('pr-upload-state',A.upload,[['success',L('Success','成功')],['fail',L('Failure','失败')]]))}${field(L('Attachment response','附件反馈'),select('pr-preview-state',A.preview,[['success',L('Success','成功')],['fail',L('Preview fails','预览失败')],['missing',L('File unavailable','文件不可得')],['unsupported',L('Preview unsupported','不支持预览')],['downloadfail',L('Download fails','下载失败')]]))}${field(L('Activity state','操作记录状态'),select('pr-activity-state',A.activityState,[['default',L('Default','默认')],['loading',L('Loading','加载中')],['empty',L('Empty','暂无记录')],['error',L('Load failed','加载失败')]]))}</div>
      <h4>${L('Approval on-chain write-back','通过的链上执行回写')}</h4><div class="pr-demo-actions">${b('Execution succeeds','链上执行成功','auth-success','','',!r||!authBusy(r))}${b('Execution fails','链上执行失败','auth-failed','','',!r||!authBusy(r))}${b('Result to be verified','结果待核实','auth-unknown','','',!r||authOf(r)!=='processing')}${b('Asset holder withdraws','资产方发起撤回','holder-withdraw','','',!r||r.status!=='pending'||withdrawing(r))}</div>
      <h4>${L('Project state','所属项目状态')}</h4><div class="pr-demo-actions">${b('Closed by the asset holder','所属项目已关闭 · 资产方主动关闭','project-terminal','owner','',!r||terminalProject(r))+b('Closed on expiry','所属项目已关闭 · 有效期到期','project-terminal','expiry','',!r||terminalProject(r))+b('Project settled','所属项目已结清','project-terminal','settled','',!r||terminalProject(r))}</div>
      <h4>${L('On-chain events for this application','本张链上事件')}</h4><div class="pr-demo-actions">${b('Asset holder initiates the release','资产方发起自助解押','release-start','','',!r||!['awaiting-release'].includes(r.follow))}${b('Release succeeds','解押成功回写','release-success','','',!r||r.follow!=='releasing'||r.flag==='difference')}${b('Release fails','解押失败回写','release-fail','','',!r||r.follow!=='releasing'||r.flag==='difference')}${b('Release result unknown','解押结果待核实','release-unknown','','',!r||r.follow!=='releasing'||!!r.flag)}${b('Delayed conflicting result','接收迟到冲突结果','late-conflict','','',!r||r.flag!=='verify')}${b('Expire operations session','运营登录失效','expire-session')}${b('Replay latest event','重放最新事件','replay-event','','',!r)}${b('Reset demonstration','重置演示','restart')}</div>
      <h4>${L('Outcome events','结果事件')}</h4><p class="pr-meta">${A.events.map(e=>E(e.id+' · '+e.event)).join('<br>')||L('None','暂无')}</p>`;
  }

  /* ---------------------------------------------------------------- 动作 */
  function onAct(act,v,e){
    if(e&&(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)&&['pr-view','pr-origin'].includes(act))return false;
    if(act.startsWith('ow-'))return CF.opsWallet.onAct(act,v);
    if(!act.startsWith('pr-')){
      if(act==='retry'){A.view='default';A.error='';CF.render();return true;}
      if(act==='clearfilter'){resetFilter();return true;}
      return false;
    }
    act=act.slice(3);
    if(A.busy&&!['cancel'].includes(act))return true;
    if(act==='origin')navigateRoute(detailRoute(A.source,'related'));
    else if(act==='view')visit(v);
    else if(act==='back')visit(null);
    else if(act==='sign-in'){S.layer=null;location.hash='#/ops/login';}
    else if(act==='page'){A.page=+v;saveContext();CF.render();window.scrollTo(0,0);}
    else if(act==='search'){
      const f={...A.editFilter};
      if(f.from&&f.to&&f.from>f.to){A.filtersOpen=true;A.error=['Start date must not be later than end date.','开始日期不得晚于结束日期。'];CF.render();return true;}
      A.error='';A.filtersOpen=false;A.filter=f;A.page=1;A.view='default';saveContext();CF.render();
    }
    else if(act==='filters'){A.filtersOpen=!A.filtersOpen;CF.render();document.querySelector('[data-act=pr-filters]')?.focus();}
    else if(act==='tab'){A.tab=v;saveContext();CF.render();$('pr-tab-'+v)?.focus();}
    else if(act==='reset')resetFilter();
    else if(act==='sort'){A.dir=A.sort===v?-A.dir:1;A.sort=v;saveContext();CF.render();}
    else if(act==='approve'||act==='reject'){
      if(A.uncertain?.id===row()?.id){CF.toast(L('Check the pending result first.','请先查询待确认结果。'));return true;}
      start(act);
    }
    else if(act==='sign'){
      /* 连接平台统一钱包 → 核对地址 → 签名提交通过；取消、地址不符、钱包不可用、拒签或签名失败都不产生结论，已填材料保留。 */
      const d=A.draft,r=row();
      if(!d||d.id!==r?.id||!canWrite(r)){deny();return true;}
      if(!validate()){open('edit');return true;}
      A.error='';
      CF.opsWallet.start({
        purpose:['Sign and submit the approval of '+r.id+' ('+r.token+'). It is executed on chain to unfreeze the share.','签名提交通过：'+r.id+'（'+r.token+'），由链上执行解除本份冻结。'],
        detail:['The approval stands only once it is executed on chain.','链上执行成功才算通过。'],
        onSigned:()=>{d.signed=true;open('edit');submit();},
        onAbort:k=>{d.signed=false;A.error=CF.opsWallet.abortText(k);open('edit');}
      });
    }
    else if(act==='auth-success')authResult('success');
    else if(act==='auth-failed')authResult('failed');
    else if(act==='auth-unknown')authResult('unknown');
    else if(act==='holder-withdraw'){
      /* 资产方发起待审撤回：通过处理中或通过结果待核实时被拒；否则进入撤回解押处理中，暂不可裁定。 */
      const r=row();
      if(!r||r.status!=='pending')return true;
      if(authBusy(r)){CF.toast(L('The asset holder’s withdrawal was refused: the approval is in progress. Nothing changed.','资产方撤回被拒：本张通过处理中，暂不可撤回，审核状态与本张均未变化。'));return true;}
      startWithdrawal(r);CF.render();
    }
    else if(act==='project-terminal'){const r=row();if(r&&enterTerminal(r.project,false,v||'owner'))CF.render();}
    else if(act==='confirm'){
      if(!canWrite(row()))deny();
      else if(validate()){if(A.draft.mode==='approve')submit();else open('confirm');}
      else{CF.render();$(A.draft.mode==='reject'?'pr-reason':'pr-upload')?.focus();}
    }
    else if(act==='edit')open('edit');
    else if(act==='submit')submit();
    else if(act==='remove'){A.draft.files.splice(+v,1);A.error='';CF.render();}
    else if(act==='cancel'){A.next=undefined;if(A.draft&&(A.draft.files.length||A.draft.reason||A.draft.remark))open('discard');else{A.draft=null;CF.closeLayer();}}
    else if(act==='keep')open('edit');
    else if(act==='discard'){A.draft=null;A.error='';if(A.next!==undefined){const target=A.next;A.next=undefined;navigateRoute(target);}else CF.closeLayer();}
    else if(act==='close')closePreview();
    else if(act==='preview'){
      if(!allowed())deny();
      else{const f=getFile(v);if(!f||f.state!=='ready'||!supportsPreview(f))return true;
        A.previewKey=v;A.previewReturn={draft:!!A.draft,key:v,y:window.scrollY,scroll:document.querySelector('.modal-b')?.scrollTop||0};open('preview');}
    }
    else if(act==='download')download(v);
    else if(act==='file-retry'){const f=getFile(v);if(f){f.error=null;A.preview='success';download(v);CF.render();}}
    else if(act==='evidence'){$('pr-evidence')?.scrollIntoView({block:'center'});$('pr-evidence')?.focus({preventScroll:true});}
    else if(act==='preview-retry'){A.preview='success';const f=getFile(A.previewKey);if(f)f.error=null;CF.render();}
    else if(act==='activity-retry'){A.activityState='default';CF.render();$('pr-activity')?.focus({preventScroll:true});}
    else if(act==='copy'){navigator.clipboard?.writeText(v).then(()=>CF.toast(L('Copied','已复制'))).catch(()=>CF.toast(L('Copy the visible value manually.','请手动复制显示值。')));}
    else if(act==='grant'){grant(v);S.demo=false;window.scrollTo(0,0);navigateRoute(S.page===D&&A.selected?detailRoute(A.selected):queueRoute());}
    else if(act==='expire-session'){A.draft=null;A.busy=false;S.layer=null;S.demo=false;OPS.onAct('ops-session-expire');CF.render();}
    else if(act==='resolve'){
      const u=A.uncertain,r=A.rows.find(x=>x.id===u?.id);
      if(!allowed())deny();
      else{if(r?.status==='pending')applyDecision(r,u.d);A.uncertain=null;A.error='';CF.render();CF.toast(L('Current result retrieved.','已获取当前结果。'));}
    }
    else if(act==='release-start'){
      const r=row();
      if(r&&r.follow==='awaiting-release'){
        r.follow='releasing';r.release={startedAt:now(),completedAt:null,gas:0.0016,gasCcy:'ETH',proof:null,result:'processing'};
        event(r,['Self-service release initiated','自助解押已发起'],['Release in progress','解押处理中'],
          {actor:['Asset holder','资产方'],chain:true,gas:0.0016,gasCcy:'ETH',
           text:['Initiated by the asset holder with the holding address. Operations cannot initiate, retry or cancel it.','由资产方以持有地址签名发起，运营端无发起、重试或撤销入口。']});
        CF.render();
      }
    }
    else if(act==='release-success'||act==='release-fail'){
      const r=row(),ok=act==='release-success';
      if(r&&r.follow==='releasing'){
        r.release=Object.assign(r.release||{},{completedAt:now(),result:ok?'success':'failed',gas:r.release?.gas??0.0016,gasCcy:'ETH',proof:ok?'0xDEMO'+'0'.repeat(58)+'99':null});
        /* 待审撤回：成功转为已撤回，失败恢复为可裁定的待审核；驳回后的解押失败回到待自助解押。 */
        const pendingWithdrawal=r.status==='pending';
        if(ok){r.follow='released';if(pendingWithdrawal)r.status='withdrawn';r.flag='';}
        else r.follow=pendingWithdrawal?'pending':'awaiting-release';
        event(r,ok?['Release succeeded','解押成功']:['Release failed','解押失败'],
          ok?(pendingWithdrawal?['Pending review → Withdrawn · hold released','待审核 → 已撤回 · 占用解除']:['Share returned to the holding address','份额已转回原持有地址'])
            :(pendingWithdrawal?['Withdrawal not completed · decidable again','撤回未成功 · 恢复为可裁定的待审核']:['Share still held in the pledge contract','份额仍在质押合约内']),
          {chain:true,gas:r.release.gas,gasCcy:'ETH',proof:r.release.proof,
           text:ok?['The token has left the total pledged value and the pledged pending review.','该张已退出总质押额与待审质押额。']
             :['The pledge contract returned a failure. The gas is consumed and not refunded; the asset holder can initiate the release again.','质押合约返回失败，gas 已消耗且不退，资产方可再次发起解押。']});
        CF.render();
      }
    }
    else if(act==='release-unknown'){
      const r=row();
      if(r&&r.follow==='releasing'&&!r.flag){
        r.flag='verify';if(r.release)r.release.result='unknown';
        event(r,['Release result to be verified','解押结果待核实'],['No confirmed result yet','尚无确认结果'],
          {actor:null,chain:true,gas:null,gasCcy:'ETH',proof:null,
           text:['No confirmed result has been received for this release. It is not assumed to have failed; contact platform support.','本次解押尚未收到确认结果，不推定失败，请联系平台客服人员。']});
        CF.render();
      }
    }
    else if(act==='late-conflict'){
      const r=row();
      if(r&&r.flag==='verify'){
        r.flag='difference';
        event(r,['Reconciliation discrepancy','对账差异'],['Result to be verified → Conflicting result received','结果待核实 → 收到冲突结果'],
          {chain:true,gas:r.release?.gas??null,gasCcy:'ETH',proof:'0xDEMO'+'0'.repeat(58)+'98',
           text:['A later result conflicts with the record. The original facts are kept, further actions on this token are paused, and the review decision is unchanged.','迟到结果与原记录冲突，原事实保留，该张后续动作暂停，审核结论不变。']});
        CF.render();
      }
    }
    else if(act==='replay-event'){const r=row();if(r&&r.events.length){r.events.push({...r.events[0]});CF.render();}}
    else if(act==='restart'){
      A.epoch++;seed=CF.pledgeSeed();A.rows=seed.rows;A.projects=seed.projects;A.now=seed.now;A.clock=Date.now();
      A.draft=null;A.uncertain=null;A.busy=false;A.response='success';A.upload='success';A.preview='success';
      A.activityState='default';A.events=[];grant('admin');resetFilter();navigateRoute(queueRoute());
    }
    else return false;
    return true;
  }
  function resetFilter(){
    A.filter=fDefault();A.editFilter=fDefault();A.filtersOpen=false;A.page=1;A.sort='onchainAt';A.dir=1;A.error='';A.view='default';
    if(S.page===Q)saveContext();CF.render();
  }
  function onInput(e){
    if(A.busy)return;
    const el=e.target,id=el.id;
    if(id.startsWith('pr-f-')){A.editFilter[id.slice(5)]=el.type==='checkbox'?(el.checked?'1':''):el.value;return;}
    if(A.draft){
      if(id==='pr-reason')A.draft.reason=el.value;
      if(id==='pr-remark')A.draft.remark=el.value;
      if(id==='pr-category')A.draft.category=el.value;
      if(id==='pr-ack')A.draft.ack=el.checked;
      if(id==='pr-reason'||id==='pr-remark'){
        const count=el.parentElement.querySelector('.pr-meta');
        if(count)count.textContent=Array.from(el.value.trim()).length+' / '+(id==='pr-reason'?'500':'200');
        el.setAttribute('aria-invalid','false');
      }
    }
  }
  document.addEventListener('submit',e=>{if(e.target.id==='pr-filter-form'){e.preventDefault();onAct('pr-search','');}});
  document.addEventListener('keydown',e=>{
    if(e.target.matches('[role=tab][data-act=pr-tab]')&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
      e.preventDefault();const tabs=['overview','related'],i=tabs.indexOf(A.tab);
      onAct('pr-tab',tabs[e.key==='Home'?0:e.key==='End'?1:(i+1)%2]);
    }
  });
  document.addEventListener('input',onInput);
  document.addEventListener('change',e=>{
    onInput(e);const el=e.target,id=el.id;
    if(id==='pr-order'){const [sort,dir]=el.value.split(':');A.sort=sort;A.dir=+dir;saveContext();CF.render();}
    if(['pr-view','pr-response','pr-upload-state','pr-preview-state','pr-activity-state'].includes(id)){
      const key={'pr-view':'view','pr-response':'response','pr-upload-state':'upload','pr-preview-state':'preview','pr-activity-state':'activityState'}[id];
      A[key]=el.value;A.error='';CF.render();
    }
    if(id==='pr-upload'&&A.draft&&!A.busy){
      const d=A.draft,files=Array.from(el.files);A.error='';
      if(files.length+d.files.length>5){A.error=['At most 5 files per application.','每张最多 5 个文件。'];CF.render();return;}
      files.forEach(f=>{
        const typeOK=['application/pdf','image/jpeg','image/png'].includes(f.type),extOK=/\.(pdf|jpe?g|png)$/i.test(f.name);
        if(!typeOK||!extOK||f.size>10*1024*1024||!f.size){A.error=[f.name+': use a non-empty PDF/JPG/PNG up to 10 MB.',f.name+'：请选择非空 PDF/JPG/PNG，单个不超过 10 MB。'];return;}
        const file={id:crypto.randomUUID(),name:f.name,type:f.type,size:f.size,state:'uploading',url:URL.createObjectURL(f)};
        d.files.push(file);
        setTimeout(()=>{file.state=A.upload==='fail'?'failed':'ready';if(A.draft===d)CF.render();},550);
      });
      CF.render();
    }
  });
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href^="#"]');
    if(!a||a.hasAttribute('data-act')||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
    if(A.draft){e.preventDefault();A.next=a.hash.slice(1);open('discard');return;}
    remember();
  },true);

  const DENIED={id:'denied',label:['No access','无权限'],group:'business'};
  [Q,D].forEach(id=>CF.review.register(id,{
    group:['Pledge reviews','代币质押审核'],
    scenarios:()=>{
      if(id!==D)return [];
      const pick=(key,label,test)=>{const r=A.rows.find(test);return {id:key,label,available:canQuery()&&!!r,route:r?detailRoute(r.id):null,description:r?['Existing application · '+r.id,'已有申请 · '+r.id]:['No matching application','暂无对应申请']};};
      return [...Object.keys(status).map(st=>pick(st,status[st].slice(0,2),r=>r.status===st&&r.source!=='terminal'&&!withdrawing(r)&&!authBusy(r))),
        pick('withdrawing',['Withdrawal in progress','撤回解押处理中'],withdrawing),
        pick('approving',['Approval in progress','通过处理中'],r=>r.status==='pending'&&authOf(r)==='processing'),
        pick('terminal',['Project closure default','项目终态默认不通过'],r=>r.source==='terminal'),
        pick('excluded',['Approved · not counted','已通过 · 不计入有效质押'],r=>r.follow==='excluded')];
    },
    states:id===Q?['default','loading','empty','noresult','error',DENIED]:['default','loading','error',DENIED],
    route:()=>id===Q?ROOT:detailRoute(A.rows[0].id),
    get:()=>canQuery()?A.view:'denied',
    set(value){
      if(value==='denied'){grant('none');A.view='default';S.st='default';return;}
      if(!canQuery())grant('admin');
      A.view=value;S.st=value;
    },
    reset(){if(!canQuery())grant('admin');A.view='default';S.st='default';A.response=A.upload=A.preview='success';A.activityState='default';},
    beforeChange(proceed){CF.AdminMenu.beforeLeave(proceed);}
  }));

  const dict={
    en:{...OPS.dict.en,navGroupOps:'Operations',navPledgeReviews:'Pledge reviews',navPledgeReviewDetail:'Application detail'},
    zh:{...OPS.dict.zh,navGroupOps:'运营管理',navPledgeReviews:'代币质押审核',navPledgeReviewDetail:'单笔审核详情'}
  };
  CF.define({...OPS,id:'pledge-review',demoOnly:true,reviewToolsInLayer:false,dict,demo,
    content:page=>{
      if(OPS_PAGES.includes(page))return OPS.content(page);
      const out=page===D?detail():queue();
      return A.uncertain&&allowed()
        ?note(L('A submitted decision is awaiting confirmation. Do not submit another decision.','已提交结论的结果待确认，请勿重复裁定。')+' '+b('Check current result','查询当前结果','resolve'))+out
        :out;
    },
    layers:{...OPS.layers,...layers,...CF.opsWallet.layers},
    onAct:(act,v,e)=>onAct(act,v,e)||OPS.onAct(act,v,e),
    beforeAdminNavigate(proceed){if(A.busy||A.draft){CF.toast(L('Finish or cancel the current review first.','请先完成或取消当前审核。'));return;}remember();proceed();},
    allowNav:id=>[Q,D].includes(id)?allowed():OPS_PAGES.includes(id),
    breadcrumbRoute:id=>id===Q?queueRoute():null,
    onBeforeAct(act,v,e){
      if(act==='retry'||act==='clearfilter'){onAct(act,v);return true;}
      if(act==='closelayer'&&e?.type==='click'&&e.target.closest('[data-stop]'))return false;
      if(act==='closelayer'&&A.busy)return true;
      if(act==='closelayer'&&S.layer?.key==='pr-preview'){closePreview();return true;}
      if(act==='closelayer'&&CF.opsWallet.closing())return true;
      if(act==='closelayer'&&A.draft){onAct('pr-cancel','');return true;}
      return OPS.onBeforeAct(act,v,e);
    },
    beforeRender(){
      S.toTop=false;syncContext();
      const signed=signedIn();
      if(signed&&[Q,D].includes(S.page))lastHash=location.hash;
      /* 登录失效后重新登录，回到原来的队列或详情。 */
      if(!signed&&wasSigned){A.draft=null;A.busy=false;S.layer=null;if(onModule)returnHash=lastHash;}
      OPS.beforeRender();
      if(signed&&!wasSigned&&returnHash){location.hash=returnHash;returnHash='';}
      wasSigned=signed;onModule=[Q,D].includes(S.page);
      if(!allowed()&&S.layer?.key.startsWith('pr-')){S.layer=null;A.draft=null;A.busy=false;}
    },
    afterRender(){OPS.afterRender();restoreView();},
    onRoute(prev,id){
      A.epoch++;A.busy=false;A.draft=null;A.error='';A.view='default';restoreContext=true;
      if(OPS_PAGES.includes(id)||OPS_PAGES.includes(prev))OPS.onRoute(prev,id);
    }
  });
  S.end='admin';S.role='ops';
  CF.opsAuth.seedDemo('admin');
  if(!location.hash.startsWith('#'+ROOT))history.replaceState(null,'','#'+ROOT);
  CF.boot();
})(window.CF);
