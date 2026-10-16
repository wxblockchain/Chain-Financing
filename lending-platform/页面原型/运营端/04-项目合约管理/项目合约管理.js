/* WS-387 · 项目合约管理（运营端）：项目审核队列、项目审核详情、质押合约台账。
   会话与功能权限读运营端账户与登录一处登记（CF.opsAuth）：
   PM-AL-17 融资项目审核查询、PM-AL-18 融资项目审核与合约部署处置。
   业务数据、钱包签名、部署结果与站内信投递均为本地演示，不连接真实钱包、链上或消息服务。 */
(function(CF){
  'use strict';
  const S=CF.S,L=CF.L,E=CF.esc,OPS=CF.opsAccountModule,$=id=>document.getElementById(id);
  const Q='P-O-CM-01',DT='P-O-CM-02',LG='P-O-CM-03';
  const ROOT='/ops/contract-reviews',LEDGER='/ops/contract-ledger';
  const OPS_PAGES=['P-O-AL-01','P-O-AL-03','P-O-AL-04','P-O-AL-05','P-O-AL-06','P-O-AL-07'];

  /* 审核轴：四类，默认待审核；部署处理中不是结论，不因时间流逝自动改变。 */
  const REVIEW={pending:['Pending review','待审核','warn'],deploying:['Deployment in progress','部署处理中','accent'],
    approved:['Approved','已通过','ok'],returned:['Returned','已退回','danger']};
  /* 合约部署执行状态：链上执行事实，与审核轴是两条独立的轴。 */
  const DEPLOY={none:['Not initiated','未发起','gray'],processing:['Deployment in progress','部署处理中','accent'],
    success:['Deployed','部署成功','ok'],failed:['Deployment failed','部署失败','danger'],
    unknown:['Result to be verified','结果待核实','warn']};
  const OWNERS=[['A',['Demo Asset A','示例资产企业 A']],['B',['Demo Asset B','示例资产企业 B']],['C',['Demo Asset C','示例资产企业 C']]];
  const REPAYMENT=['Quarterly interest, principal and interest at maturity','按季付息、到期还本付息'];

  const qDefault=()=>({review:'pending',deploy:'',owner:'',token:'',from:'',to:'',q:''});
  const lDefault=()=>({owner:'',token:'',from:'',to:'',q:''});

  let seed=CF.contractSeed();
  const A={rows:seed.rows,config:{...seed.config},wallet:seed.wallet,tokenType:seed.tokenType,
    now:seed.now,clock:Date.now(),
    queue:{filter:qDefault(),edit:qDefault(),page:1,sort:'submittedAt',dir:1,open:false},
    ledger:{filter:lDefault(),edit:lDefault(),page:1,sort:'deployedAt',dir:-1,open:false},
    view:'default',response:'success',activityState:'default',
    draft:null,busy:false,error:'',selected:null,src:'queue',notices:[],epoch:0};
  let routeKey=null,restoreContext=false,returnHash='',lastHash='',onModule=false,wasSigned=false;
  const positions=new Map();

  const now=()=>A.now+(Date.now()-A.clock);
  const txt=x=>Array.isArray(x)?L(x[0],x[1]):x;
  const time=t=>t?CF.fmtTime(t):'—';
  const unknown=()=>L('To be verified','待核实');
  const pct=v=>(v*100).toFixed(0)+'%';
  /* 项目期限：生效日（即创建日）～资产方选定的到期日，UTC 业务日期。 */
  const addMonths=(t,n)=>{const d=new Date(t),y=d.getUTCFullYear(),m=d.getUTCMonth()+n,day=d.getUTCDate();
    const last=new Date(Date.UTC(y,m+1,0)).getUTCDate();return Date.UTC(y,m,Math.min(day,last));};
  const utcDay=t=>CF.fmtDate(new Date(t).toISOString().slice(0,10)+'T12:00:00Z');
  const expiry=r=>addMonths(r.createdAt,r.termMonths);
  const termRange=r=>utcDay(r.createdAt)+' ～ '+utcDay(expiry(r))+' (UTC)';
  const isExpired=r=>now()>=expiry(r);
  const months=n=>n+' '+L(n===1?'month':'months','个月');
  const submission=n=>L('Submission '+n,'第 '+n+' 次提交');
  const ownerName=r=>{const o=OWNERS.find(x=>x[0]===r.owner);return o?txt(o[1]):r.owner;};
  const projectName=r=>L('Demo financing project '+r.key,'示例融资项目 '+r.key);
  const tokenLabel=()=>A.tokenType;
  const row=()=>A.rows.find(r=>r.id===A.selected);
  const list=()=>S.page===LG?A.ledger:A.queue;

  const b=(en,zh,act,value='',cls='',disabled=false,title='')=>`<button type="button" class="btn ${cls}" data-act="cm-${act}" data-v="${E(value)}" ${title?`title="${E(title)}"`:''} ${disabled?'disabled':''}>${L(en,zh)}</button>`;
  const viewLink=(id,src)=>`<a class="actlink" href="#${E(detailRoute(id,src))}" data-act="cm-view" data-v="${E(id)}">${L('View','查看')}</a>`;
  const field=(label,html)=>`<div class="field"><label for="${(html.match(/id="([^"]+)/)||[])[1]||''}">${CF.fieldLabel(label)}</label>${html}</div>`;
  const input=(id,v,type='text')=>`<input class="inp" id="${id}" type="${type}" value="${E(v)}">`;
  const select=(id,value,options)=>`<select class="inp" id="${id}">${options.map(([v,label])=>`<option value="${E(v)}" ${v===value?'selected':''}>${E(label)}</option>`).join('')}</select>`;
  const note=(s,type='')=>CF.note(type,s);
  const error=()=>A.error?`<p class="cm-error" role="alert">${E(txt(A.error))}</p>`:'';
  const kv=(items,detail=false)=>`${detail?'<div class="ops-facts-region">':''}<dl class="cm-kv ${detail?'ops-facts':''}">${items.map(([label,value,wide])=>`<div${wide?` class="cm-wide${detail?' ops-fact-wide':''}"`:''}><dt>${label}</dt><dd>${value==null?'—':value}</dd></div>`).join('')}</dl>${detail?'</div>':''}`;
  const facts=items=>kv(items,true);
  const section=(en,zh,html,extra='')=>`<section class="card cm-section"${extra}><h2 class="cm-h2">${L(en,zh)}</h2>${html}</section>`;
  /* 项目已关闭是叠加标记，同时展示关闭原因：资产方主动关闭或有效期到期。 */
  const CLOSE_REASON={owner:['closed by the asset holder','资产方主动关闭'],expired:['valid-until date reached','有效期到期']};
  const closeReason=r=>txt(CLOSE_REASON[r.closeReason||'owner']);
  const closedTag=r=>CF.tag('gray',L('Project closed · ','项目已关闭 · ')+closeReason(r));
  const reviewBadge=r=>CF.tag(REVIEW[r.review][2],txt(REVIEW[r.review]))+(r.closed?closedTag(r):'');
  const deployBadge=r=>CF.tag(DEPLOY[r.deploy][2],txt(DEPLOY[r.deploy]));

  /* 功能权限只在运营端账户与登录一处登记；本册按正文分查询岗与处置岗。 */
  const signedIn=()=>!!CF.opsAuth&&CF.opsAuth.can(14);
  const canQuery=()=>!!CF.opsAuth&&CF.opsAuth.can(17);
  const canDecide=()=>!!CF.opsAuth&&CF.opsAuth.can(17)&&CF.opsAuth.can(18);
  /* held 区分「未开通」与「已开通处置但缺配套查询」；只读，不改授权。 */
  const decideOnly=()=>!!CF.opsAuth&&!CF.opsAuth.held(17)&&CF.opsAuth.held(18);
  const allowed=()=>S.end==='admin'&&signedIn()&&canQuery();
  /* 项目仍待审核、没有部署处理中、也不是结果待核实时才可处置；审核无截止条件。 */
  const openForAction=r=>!!r&&!r.closed&&r.review==='pending'&&!['processing','unknown'].includes(r.deploy);
  const canAct=r=>allowed()&&canDecide()&&openForAction(r);
  const canApprove=r=>canAct(r)&&!!r.entity;

  /* 已等待时长：事实陈述，不是期限；结论生效或项目关闭即停止计时。 */
  const endedAt=r=>r.closed?r.events.find(e=>['close','expire-close'].includes(e.kind))?.at:(['approved','returned'].includes(r.review)?r.decisionAt:null);
  const waited=r=>(endedAt(r)||now())-r.submittedAt;
  function duration(ms){
    const m=Math.max(0,Math.floor(ms/60000));
    return m<60?`${m} ${L('min','分钟')}`:m<1440?`${Math.floor(m/60)} ${L('h','小时')}`
      :`${Math.floor(m/1440)} ${L('d','天')} ${Math.floor(m%1440/60)} ${L('h','小时')}`;
  }
  function event(r,kind,title,result,extra){
    r.events.unshift(Object.assign({id:crypto.randomUUID(),at:now(),kind,title,result,actor:['System','系统']},extra||{}));
  }
  const deployedAt=r=>r.contract?.at||null;
  const lastDecision=r=>{const e=r.events.find(x=>['return','deploy-ok'].includes(x.kind));return e?e.at:null;};

  /* ---------------------------------------------------------------- 路由 */
  function listParams(which){
    const st=which==='ledger'?A.ledger:A.queue;
    const p=new URLSearchParams({...st.filter,page:String(st.page),sort:st.sort,dir:String(st.dir)});
    return p;
  }
  function queueRoute(){return ROOT+'?'+listParams('queue');}
  function ledgerRoute(){return LEDGER+'?'+listParams('ledger');}
  function backRoute(){return A.src==='ledger'?ledgerRoute():queueRoute();}
  function detailRoute(id,src){
    const p=listParams(src||'queue');p.set('id',id);p.set('src',src||'queue');
    return ROOT+'/detail?'+p;
  }
  function remember(){const el=document.activeElement;positions.set(location.hash,{y:window.scrollY,act:el?.dataset.act,value:el?.dataset.v});}
  function readFilter(p,defaults,extra){
    const f=defaults();
    for(const k of Object.keys(f))if(p.has(k))f[k]=p.get(k);
    for(const k of ['from','to'])if(!/^\d{4}-\d{2}-\d{2}$/.test(f[k]))f[k]='';
    if(f.token&&f.token!==A.tokenType)f.token='';
    if(f.owner&&!OWNERS.some(o=>o[0]===f.owner))f.owner='';
    if(extra)extra(f);
    return f;
  }
  function syncContext(){
    if(routeKey===location.hash)return;
    routeKey=location.hash;
    const p=new URLSearchParams(location.hash.split('?')[1]||'');
    /* 以地址本身判断落在哪个视图：动作触发的重绘可能早于 hashchange 更新 S.page。 */
    const route=location.hash.replace(/^#/,'').split('?')[0];
    const onDetail=route===ROOT+'/detail';
    const src=p.get('src')==='ledger'?'ledger':'queue';
    const which=onDetail?src:(route===LEDGER?'ledger':'queue');
    if(which==='ledger'){
      A.ledger.filter=readFilter(p,lDefault);A.ledger.edit={...A.ledger.filter};
      A.ledger.page=Math.max(1,parseInt(p.get('page'),10)||1);
      A.ledger.sort='deployedAt';A.ledger.dir=p.get('dir')==='1'?1:-1;
    }else{
      A.queue.filter=readFilter(p,qDefault,f=>{
        if(f.review&&!REVIEW[f.review])f.review='pending';
        if(f.deploy&&!DEPLOY[f.deploy])f.deploy='';
      });
      A.queue.edit={...A.queue.filter};
      A.queue.page=Math.max(1,parseInt(p.get('page'),10)||1);
      A.queue.sort=['submittedAt','waiting'].includes(p.get('sort'))?p.get('sort'):'submittedAt';
      A.queue.dir=p.get('dir')==='-1'?-1:1;
    }
    A.selected=onDetail?p.get('id'):null;
    A.src=src;
  }
  function saveContext(){
    const next=S.page===DT?detailRoute(A.selected,A.src):S.page===LG?ledgerRoute():queueRoute();
    try{history.replaceState(null,'','#'+next);routeKey=location.hash;}catch(error){}
  }
  function navigateRoute(route){
    remember();A.epoch++;A.busy=false;A.draft=null;A.error='';S.layer=null;A.view='default';
    location.hash='#'+route;
  }
  function leave(target){
    if(A.draft&&(A.draft.reason||'').trim()){A.next=target;open('discard');return;}
    navigateRoute(target);
  }
  function restoreView(){
    if(!restoreContext)return;restoreContext=false;
    requestAnimationFrame(()=>{
      if(S.layer)return;
      const saved=positions.get(location.hash);
      if(saved){
        window.scrollTo(0,saved.y);
        const target=[...document.querySelectorAll('[data-act]')].find(el=>el.dataset.act===saved.act&&el.dataset.v===saved.value);
        if(target)target.focus({preventScroll:true});else $('cm-f-q')?.focus({preventScroll:true});
      }else window.scrollTo(0,0);
    });
  }
  function open(key){CF.openLayer('modal','cm-'+key);}
  function deny(){
    A.error=['This action is unavailable with the current account, permissions or project status.','当前账号、权限或项目状态不允许此操作。'];
    A.busy=false;A.draft=null;S.layer=null;CF.render();CF.toast(txt(A.error));
  }

  /* ---------------------------------------------------------------- 权限空态 */
  function signedOut(){return CF.empty(L('Sign in to continue','请先完成运营登录'),
    L('Your session has ended. Sign in again to open project contracts.','登录已失效，请重新登录后查看项目合约管理。'),
    b('Sign in again','重新登录','sign-in','','primary'));}
  function noAccess(){return decideOnly()
    ?CF.empty(L('Review access is incomplete','审核权限配置不完整'),
      L('This account can decide project reviews but cannot query them, so the review is refused. Ask your platform provider to correct the delivered configuration.','该账号可作出融资项目审核与合约部署处置，但未开通融资项目审核查询，本次访问已拒绝。请联系平台建设方修正交付配置。'),'')
    :CF.empty(L('No access to project contracts','无权访问项目合约管理'),
      L('The delivered configuration does not give this account the financing project review permissions.','当前交付配置未为该账号开通融资项目审核相关权限。'),'');}
  function gate(){return !signedIn()?signedOut():!canQuery()?noAccess():'';}

  /* ---------------------------------------------------------------- 列表公用 */
  function title(t,sub){
    return `<div class="cm-title"><div><h1>${t}</h1>${sub?`<span class="cm-meta">${sub}</span>`:''}</div>${CF.tag('gray',L('Demonstration data','演示数据'))}</div>`;
  }
  function views(current){
    const item=(key,route,en,zh)=>`<a class="cm-view" href="#${E(route)}" data-act="cm-go" data-v="${key}" ${current===key?'aria-current="page"':''}>${L(en,zh)}</a>`;
    return `<nav class="cm-views" aria-label="${L('Project contracts views','项目合约管理视图')}">${item('queue',queueRoute(),'Project reviews','项目审核队列')}${item('ledger',ledgerRoute(),'Pledge contract ledger','质押合约台账')}</nav>`;
  }
  function surface(opts){S.st=A.view;return CF.surface(Object.assign({
    deniedDesc:L('Contact the platform provider to check the delivered configuration.','请联系平台建设方核对交付配置。'),
    backTo:ROOT,backLabel:L('Back to the review queue','返回项目审核队列'),skelRows:5},opts));}
  function inDay(t,day,end){const d=new Date(day+'T00:00:00Z').getTime();return end?t<d+86400000:t>=d;}
  function utcDayStart(t,back=0){const d=new Date(t);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-back);}
  function ownerOptions(){return [['',L('All','全部')],...OWNERS.map(([k,label])=>[k,txt(label)])];}
  function tokenOptions(){return [['',L('All','全部')],[A.tokenType,A.tokenType]];}
  function pager(total,st){
    const pages=Math.max(1,Math.ceil(total/CF.PAGE_SIZE));
    return `<div class="pager"><span class="total">${L('Total','共')} ${total} ${L(total===1?'project':'projects','个项目')} · ${CF.PAGE_SIZE} ${L('per page','个／页')}</span>${b('Previous','上一页','page',String(st.page-1),'sm',st.page===1)}<span>${st.page} / ${pages}</span>${b('Next','下一页','page',String(st.page+1),'sm',st.page===pages)}</div>`;
  }
  function appliedTags(labels,values,applied,keys){
    const on=keys.filter(k=>applied[k]);
    return on.length?`<div class="cm-applied" aria-label="${L('Applied filters','已应用筛选')}">${on.map(k=>CF.tag('gray',labels[k]+': '+(values[k]||applied[k]))).join('')}</div>`:'';
  }
  function addressValue(value,label){
    if(!value)return unknown();
    const short=value.slice(0,10)+'…'+value.slice(-8);
    return `<span class="mono" title="${E(value)}">${E(short)}</span>${CF.copyBtn('cm-copy',value,L('Copy the full '+label,'复制完整'+label))}`;
  }
  function gasValue(gas,ccy){return gas==null?unknown():E(gas+' '+(ccy||''));}

  /* ---------------------------------------------------------------- 项目审核队列 */
  function queueScope(ignoreState){
    const f=A.queue.filter;
    return A.rows.filter(r=>(!f.owner||r.owner===f.owner)&&(!f.token||r.tokenType===f.token)
      &&(!f.from||inDay(r.submittedAt,f.from))&&(!f.to||inDay(r.submittedAt,f.to,true))
      &&(!f.q||[r.id,projectName(r),ownerName(r),r.contract?.address||''].join(' ').toLowerCase().includes(f.q.trim().toLowerCase()))
      &&(ignoreState||((!f.review||r.review===f.review)&&(!f.deploy||r.deploy===f.deploy)
        &&!(r.closed&&f.review==='pending'))));
  }
  function queueFilters(){
    const f=A.queue.edit,applied=A.queue.filter;
    const extra=['deploy','owner','token','from','to'],count=extra.filter(k=>applied[k]).length;
    const labels={deploy:L('Deployment','部署情况'),owner:L('Project publisher','项目发布方'),token:L('Token type','代币类型'),
      from:L('Submitted from','提交开始日期'),to:L('Submitted through','提交结束日期')};
    const values={deploy:applied.deploy?txt(DEPLOY[applied.deploy]):'',owner:applied.owner?ownerName({owner:applied.owner}):'',token:applied.token};
    return `<form id="cm-filter-form" class="cm-filter-wrap"><div class="cm-filter-bar">${field(L('Search projects','搜索项目'),`<input class="inp" id="cm-f-q" value="${E(f.q)}" placeholder="${L('Project number, project name, company or contract address','项目编号、项目名称、企业名称或质押合约地址')}">`)}${field(L('Review status','审核轴'),select('cm-f-review',f.review,[['',L('All','全部')],...Object.entries(REVIEW).map(([k,v])=>[k,txt(v)])]))}<div class="cm-actions"><button type="button" class="btn" data-act="cm-filters" aria-expanded="${A.queue.open}" aria-controls="cm-advanced">${L('Filters','筛选条件')}${count?' ('+count+')':''} <span aria-hidden="true">${A.queue.open?'⌃':'⌄'}</span></button>${b('Reset','重置','reset')}<button type="submit" class="btn primary">${L('Search','查询')}</button></div></div>
      <div id="cm-advanced" class="cm-filters" ${A.queue.open?'':'hidden'}>${field(labels.deploy,select('cm-f-deploy',f.deploy,[['',L('All','全部')],...Object.entries(DEPLOY).map(([k,v])=>[k,txt(v)])]))}${field(labels.owner,select('cm-f-owner',f.owner,ownerOptions()))}${field(labels.token,select('cm-f-token',f.token,tokenOptions()))}${field(labels.from,input('cm-f-from',f.from,'date'))}${field(labels.to,input('cm-f-to',f.to,'date'))}</div>
      <p class="cm-meta">${L('Submission dates are filtered by UTC calendar day.','提交时间区间按 UTC 自然日判定。')}</p>
      ${appliedTags(labels,values,applied,extra)}</form>`;
  }
  function sortButton(k,en,zh){
    const st=A.queue;
    return `<button data-act="cm-sort" data-v="${k}">${L(en,zh)} ${st.sort===k?(st.dir===1?'↑':'↓'):'↕'}</button>`;
  }
  function queue(){
    const blocked=gate();
    if(blocked)return title(L('Project reviews','项目审核队列'),'')+blocked;
    const scope=queueScope(true),start=utcDayStart(now(),6);
    const pending=scope.filter(r=>r.review==='pending'&&!r.closed);
    const counts=[pending.length,pending.filter(r=>r.deploy==='failed').length,
      scope.filter(r=>{const at=lastDecision(r);return at!=null&&at>=start;}).length];
    const shown=i=>['loading','error'].includes(A.view)?'—':A.view==='empty'?0:counts[i];
    const metrics=`<div class="cm-metrics"><div class="card cm-metric"><span>${L('Pending review','待审核')}</span><strong>${shown(0)}</strong><span class="cm-meta">${L('projects','个项目')}</span><div class="cm-metric-sub"><span>${L('Of which: deployment failed, awaiting a new attempt','其中：部署失败待再次发起')}</span><b class="mono">${shown(1)}</b></div></div><div class="card cm-metric"><span>${L('Decided · last 7 UTC days','近 7 个自然日人工审结')}</span><strong>${shown(2)}</strong><span class="cm-meta">${L('projects','个项目')}</span></div></div><p class="cm-meta">${L('Summary uses the asset holder, token type, submission dates and keyword filters. The review status and deployment filters do not change it; a failed deployment is not a manual decision.','统计应用资产方、代币类型、提交时间及关键词条件，不受审核轴与部署情况筛选影响；部署失败不计入人工审结。')}</p>`;
    const state=A.view==='default'?null:surface({emptyTitle:L('No projects awaiting review','暂无待审核项目'),
      emptyDesc:L('Projects appear here once an asset holder submits one for review.','资产方提交审核后，项目将出现在此。')});
    let found=queueScope(false);
    found.sort((a,c)=>{
      const value=r=>A.queue.sort==='waiting'?waited(r):r.submittedAt;
      return (value(a)-value(c))*A.queue.dir||a.id.localeCompare(c.id);
    });
    const pages=Math.max(1,Math.ceil(found.length/CF.PAGE_SIZE));
    if(A.queue.page>pages){A.queue.page=pages;A.error=['The previous page is empty; showing the last available page.','原页已无记录，已返回最后有效页。'];}
    const rows=found.slice((A.queue.page-1)*CF.PAGE_SIZE,A.queue.page*CF.PAGE_SIZE);
    const table=state||(!found.length
      ?CF.empty(L('No projects found','暂无符合条件的项目'),L('Change the filters or return to the pending reviews.','调整筛选条件，或返回待审核队列。'),b('Reset filters','重置筛选','reset'))
      :`<div class="tablewrap"><table class="tbl cm-table cm-queue-table"><thead><tr><th>${L('Project number / name','项目编号 / 项目名称')}</th><th>${L('Project publisher / token type','项目发布方 / 代币类型')}</th><th>${L('Pledge ratio / term','项目质押率 / 项目期限')}</th><th aria-sort="${A.queue.sort==='submittedAt'?(A.queue.dir===1?'ascending':'descending'):'none'}">${sortButton('submittedAt','Submitted','本次提交时间')}</th><th aria-sort="${A.queue.sort==='waiting'?(A.queue.dir===1?'ascending':'descending'):'none'}">${sortButton('waiting','Waiting','已等待时长')}</th><th>${L('Review status','审核轴')}</th><th>${L('Deployment / contract address','部署执行状态 / 质押合约地址')}</th><th class="col-act">${L('Action','操作')}</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong class="mono">${E(r.id)}</strong><span class="cm-meta">${E(projectName(r))}</span></td><td>${E(ownerName(r))}<span class="cm-meta">${E(r.tokenType)}</span></td><td>${pct(r.ratio)}<span class="cm-meta">${E(utcDay(r.createdAt))} ～<br>${E(utcDay(expiry(r)))} (UTC)</span></td><td>${time(r.submittedAt)}<span class="cm-meta">${E(submission(r.seq))}</span></td><td>${duration(waited(r))}</td><td>${reviewBadge(r)}</td><td>${deployBadge(r)}${r.contract?.address?`<span class="cm-meta mono">${E(r.contract.address.slice(0,10))}…${E(r.contract.address.slice(-8))}</span>`:''}</td><td class="col-act">${viewLink(r.id,'queue')}</td></tr>`).join('')}</tbody></table></div>${pager(found.length,A.queue)}`);
    return title(L('Project reviews','项目审核队列'),L('One record is one financing project; a resubmission after a return stays on the same record.','一条记录对应一个融资项目；退回后重新提交仍是同一条记录。'))
      +views('queue')+metrics
      +`<section class="card">${queueFilters()}<div class="cm-list-tools">${field(L('Sort by','排序'),select('cm-order',A.queue.sort+':'+A.queue.dir,[['submittedAt:1',L('Submitted · oldest first','本次提交时间 · 最早优先')],['submittedAt:-1',L('Submitted · newest first','本次提交时间 · 最新优先')],['waiting:-1',L('Waiting · longest first','已等待时长 · 最长优先')],['waiting:1',L('Waiting · shortest first','已等待时长 · 最短优先')]]))}</div><div class="cm-section" ${A.error?'':'hidden'}>${error()}</div>${table}</section>`;
  }

  /* ---------------------------------------------------------------- 质押合约台账 */
  function ledgerScope(){
    const f=A.ledger.filter;
    return A.rows.filter(r=>r.deploy==='success'&&r.contract?.address)
      .filter(r=>(!f.owner||r.owner===f.owner)&&(!f.token||r.tokenType===f.token)
        &&(!f.from||inDay(deployedAt(r),f.from))&&(!f.to||inDay(deployedAt(r),f.to,true))
        &&(!f.q||[r.id,projectName(r),r.contract.address].join(' ').toLowerCase().includes(f.q.trim().toLowerCase())));
  }
  function ledgerFilters(){
    const f=A.ledger.edit,applied=A.ledger.filter;
    const extra=['owner','token','from','to'],count=extra.filter(k=>applied[k]).length;
    const labels={owner:L('Project publisher','项目发布方'),token:L('Token type','代币类型'),
      from:L('Deployment completed from','合约部署完成开始日期'),to:L('Deployment completed through','合约部署完成结束日期')};
    const values={owner:applied.owner?ownerName({owner:applied.owner}):'',token:applied.token};
    return `<form id="cm-filter-form" class="cm-filter-wrap"><div class="cm-filter-bar">${field(L('Search contracts','搜索合约'),`<input class="inp" id="cm-f-q" value="${E(f.q)}" placeholder="${L('Project number, project name or contract address','项目编号、项目名称或质押合约地址')}">`)}${field(labels.owner,select('cm-f-owner',f.owner,ownerOptions()))}<div class="cm-actions"><button type="button" class="btn" data-act="cm-filters" aria-expanded="${A.ledger.open}" aria-controls="cm-advanced">${L('Filters','筛选条件')}${count?' ('+count+')':''} <span aria-hidden="true">${A.ledger.open?'⌃':'⌄'}</span></button>${b('Reset','重置','reset')}<button type="submit" class="btn primary">${L('Search','查询')}</button></div></div>
      <div id="cm-advanced" class="cm-filters" ${A.ledger.open?'':'hidden'}>${field(labels.token,select('cm-f-token',f.token,tokenOptions()))}${field(labels.from,input('cm-f-from',f.from,'date'))}${field(labels.to,input('cm-f-to',f.to,'date'))}</div>
      <p class="cm-meta">${L('Deployment completion dates are filtered by UTC calendar day.','合约部署完成时间区间按 UTC 自然日判定。')}</p>
      ${appliedTags(labels,values,applied,extra)}</form>`;
  }
  function projectState(r){
    return r.closed?CF.tag('gray',L('Closed · ','已关闭 · ')+closeReason(r))
      :r.review==='approved'?CF.tag('ok',L('Open · empty pool','可用 · 空池'))
      :r.review==='returned'?CF.tag('danger',L('Returned','已退回')):CF.tag('warn',L('Pending review','待审核'));
  }
  function ledger(){
    const blocked=gate();
    if(blocked)return title(L('Pledge contract ledger','质押合约台账'),'')+blocked;
    const state=A.view==='default'?null:surface({emptyTitle:L('No deployed contracts yet','暂无已部署的质押合约'),
      emptyDesc:L('A project appears here once its pledge contract has been deployed.','项目的质押合约部署成功后将出现在此。'),
      backTo:LEDGER,backLabel:L('Back to the ledger','返回台账')});
    const found=ledgerScope().sort((a,c)=>(deployedAt(a)-deployedAt(c))*A.ledger.dir||a.id.localeCompare(c.id));
    const pages=Math.max(1,Math.ceil(found.length/CF.PAGE_SIZE));
    if(A.ledger.page>pages)A.ledger.page=pages;
    const rows=found.slice((A.ledger.page-1)*CF.PAGE_SIZE,A.ledger.page*CF.PAGE_SIZE);
    const table=state||(!found.length
      ?CF.empty(L('No contracts found','暂无符合条件的合约'),L('Change the filters or clear them to see every deployed contract.','调整或清空筛选条件，查看全部已部署合约。'),b('Reset filters','重置筛选','reset'))
      :`<div class="tablewrap"><table class="tbl cm-table cm-ledger-table"><thead><tr><th>${L('Project number / name','项目编号 / 项目名称')}</th><th>${L('Project publisher / token type','项目发布方 / 代币类型')}</th><th>${L('Pledge contract address / blockchain network','质押合约地址 / 区块链网络')}</th><th aria-sort="${A.ledger.dir===1?'ascending':'descending'}"><button data-act="cm-sort" data-v="deployedAt">${L('Contract deployment completed at','合约部署完成时间')} ${A.ledger.dir===1?'↑':'↓'}</button></th><th>${L('Reviewer','审核人')}</th><th>${L('Project status','项目当前状态')}</th><th class="col-act">${L('Action','操作')}</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong class="mono">${E(r.id)}</strong><span class="cm-meta">${E(projectName(r))}</span></td><td>${E(ownerName(r))}<span class="cm-meta">${E(r.tokenType)}</span></td><td>${addressValue(r.contract.address,L('address','地址'))}<span class="cm-meta">${L('Ethereum','以太坊')}</span></td><td>${time(deployedAt(r))}</td><td>${r.reviewer?E(txt(r.reviewer)):unknown()}</td><td>${projectState(r)}</td><td class="col-act">${viewLink(r.id,'ledger')}</td></tr>`).join('')}</tbody></table></div>${pager(found.length,A.ledger)}`);
    return title(L('Pledge contract ledger','质押合约台账'),L('One project, one deployed pledge contract. Read-only: the platform does not verify the address on chain.','一个项目对应一份已部署的质押合约；只读，平台不做链上核验。'))
      +views('ledger')+`<section class="card">${ledgerFilters()}${table}</section>`;
  }

  /* ---------------------------------------------------------------- 操作记录 */
  const TONE={'deploy-ok':'ok','return':'danger','deploy-fail':'danger','deploy-unknown':'warn','close':'gray','expire-close':'gray'};
  function activity(r){
    const heading=`<h2 class="cm-h2" id="cm-activity-title">${L('Activity','操作记录')}</h2><p class="cm-meta">${L('The only source of this project’s submissions, decisions and deployment attempts, newest first.','本项目全部提交、结论与部署尝试的唯一来源，按发生时间倒序。')}</p>`;
    let body;
    if(A.activityState==='loading')body=`<p role="status">${L('Loading activity…','正在加载操作记录…')}</p>`;
    else if(A.activityState==='error')body=`<p role="alert">${L('Activity could not be loaded.','操作记录读取失败。')}</p>${b('Retry','重试','activity-retry')}`;
    else{
      const seen=new Set();
      const events=A.activityState==='empty'?[]:r.events
        .filter(e=>{const id=e.id||JSON.stringify([e.at,e.kind]);if(seen.has(id))return false;seen.add(id);return true;})
        .map((e,i)=>({...e,order:i})).sort((a,c)=>(c.at||0)-(a.at||0)||a.order-c.order);
      body=!events.length?`<p class="cm-meta">${L('No activity yet.','暂无操作记录。')}</p>`
        :`<ol class="cm-timeline" aria-label="${L('Project activity, newest first','本项目操作记录，最新在前')}">${events.map(e=>{
          const fields=[];
          if(e.chain){
            fields.push([L('Deployment gas','部署实际 gas'),gasValue(e.gas,e.gasCcy)]);
            fields.push([L('Deployment transaction evidence','部署交易凭证'),e.proof?addressValue(e.proof,L('evidence','凭证')):L('None yet','暂无')]);
            if(e.address)fields.push([L('Pledge contract address','质押合约地址'),addressValue(e.address,L('address','地址')),true]);
          }
          if(e.signer)fields.push([L('Signed with','签名钱包'),addressValue(e.signer,L('address','地址'))+`<span class="cm-meta">${L('Platform wallet','平台统一钱包')}</span>`,true]);
          if(e.notice)fields.push([L('Message sent to the asset holder','已向资产方发送站内信'),E(txt(e.notice)),true]);
          const occurred=e.at?`<time datetime="${E(new Date(e.at).toISOString())}">${time(e.at)}</time>`:`<span>${L('Time: to be verified','发生时间：待核实')}</span>`;
          const extra=e.text||e.next||fields.length;
          return `<li class="cm-event" data-tone="${TONE[e.kind]||'neutral'}"><h3>${E(txt(e.title))}</h3><div class="cm-event-meta"><span>${e.actor?E(txt(e.actor)):L('Actor: to be verified','操作主体：待核实')}</span>${occurred}</div><p class="cm-event-result">${E(txt(e.result||['Recorded','已记录']))}</p>${extra?`<details><summary aria-label="${E(L('View details: ','查看详情：')+txt(e.title))}">${L('View details','查看详情')}</summary><div class="cm-event-detail">${e.text?`<p>${E(txt(e.text))}</p>`:''}${e.next?`<p>${E(txt(e.next))}</p>`:''}${fields.length?kv(fields):''}</div></details>`:`<span class="cm-meta">${L('No further detail.','暂无更多明细。')}</span>`}</li>`;
        }).join('')}</ol>`;
    }
    return `<section class="card cm-section cm-activity" id="cm-activity" tabindex="-1" aria-labelledby="cm-activity-title">${heading}${body}</section>`;
  }

  /* ---------------------------------------------------------------- 审核详情 */
  function createdInfo(r){
    return section('Project details under review','创建信息核对',facts([
      [L('Blockchain network','区块链网络'),L('Ethereum','以太坊')+`<span class="cm-meta">${L('Fixed for this release; locked at creation.','本期固定，创建时锁定。')}</span>`],
      [L('Project name','项目名称'),E(projectName(r))],
      [L('Token type','代币类型'),E(r.tokenType)],
      [L('Project pledge ratio','项目质押率'),pct(r.ratio)],
      [L('Project term','项目期限'),E(termRange(r))],
      [L('Preferred settlement currency','参考结算币种'),E(r.settleCcy)+`<span class="cm-meta">${L('For reference only; it does not limit the currency a funder quotes in.','只供参考，不限制资金方实际报价币种。')}</span>`],
      [L('Repayment method','还款方式'),txt(REPAYMENT)+`<span class="cm-meta">${L('Platform default value, carried over at creation.','平台定值，创建时带出。')}</span>`],
      [L('SPV name','SPV机构名称'),`<span class="mono">${E(r.spv)}</span>`]
    ])+`<p class="cm-meta">${L('Read-only. Operations cannot edit the project details, resubmit on behalf of the asset holder, or close the project.','只读。运营端不能修改创建信息、代资产方重新提交或关闭项目。')}</p>`);
  }
  function contextCard(r){
    const c=A.config;
    const ratioGap=c.available&&r.ratio>c.maxRatio;
    const termGap=c.available&&expiry(r)>addMonths(r.createdAt,c.maxTermMonths);
    const current=v=>c.available?v:unknown();
    const gap=CF.tag('warn',L('Differs from the locked value','与锁定值不一致'));
    return section('Project publisher and parameter context','项目发布方与参数上下文',facts([
      [L('Project publisher','项目发布方'),E(ownerName(r))+`<span class="cm-meta">${L('The asset holder company that created this project.','创建本项目的资产方企业。')}</span>`],
      [L('Stable entity identifier','稳定主体标识'),r.entity?`<span class="mono">${E(r.entity)}</span>`:CF.tag('warn',unknown())],
      [L('Pledge ratio · latest submission','项目质押率 · 最近一次提交'),pct(r.ratio)],
      [L('Maximum pledge ratio · current configuration','最高质押率 · 当前配置'),current(pct(c.maxRatio))+(ratioGap?gap:'')],
      [L('Project term · latest submission','项目期限 · 最近一次提交'),E(termRange(r))],
      [L('Maximum project term · current configuration','最长项目期限 · 当前配置'),current(months(c.maxTermMonths))+(termGap?gap:'')],
      [L('Configuration read at','配置取数时点'),c.available?time(c.readAt):unknown(),true]
    ])+`<p class="cm-meta">${L('The review is checked against the snapshot of the latest submission. On resubmission after a return the pledge ratio is re-checked against the maximum at that time; both values are locked once the contract is deployed. The current configuration is background reference only.','核对基准是最近一次提交的快照；退回重提时项目质押率按当时的最高质押率重新校验，合约部署后锁定。当前配置仅作背景参考。')}</p>`
      +(r.entity?'':note(L('The stable entity identifier for this asset holder is not available, so the ownership cannot be confirmed. Approval is unavailable until it is verified; the project can still be returned.','该资产方的稳定主体标识暂不可得，归属无法确认。核实前不能提交通过，仍可提交退回。'),'warn'))
      +((ratioGap||termGap)?note(L('The locked values stay unchanged and stay valid. A lower current limit does not make this project non-compliant, does not block the submission and does not create any remediation task.','锁定值保持不变且继续有效。当前上限调低不使该项目违规，不拦截提交，也不产生整改待办。'),'accent'):'')
      +(c.available?'':note(L('The current financing parameter configuration could not be read. It is marked to be verified and does not block the review.','当前融资参数配置暂不可读，已标为待核实，不阻断本次审核。'),'warn')));
  }
  /* 待审核或已退回到达有效期至时自动关闭；部署处理中跨过有效期至的，等回写后按结果处理。 */
  function closeOnExpiry(r){
    if(r.closed)return;
    const before=REVIEW[r.review];
    r.closed=true;r.closeReason='expired';r.expiryPassed=false;
    event(r,'expire-close',['Project closed on expiry','项目到期自动关闭'],[before[0]+' · project closed',before[1]+' · 项目已关闭'],
      {text:r.review==='approved'
        ?['The project had reached its valid-until date with no business, so it ended right after the approval.','项目已到达有效期至且没有存续业务，审核通过后随即自动终结为已关闭。']
        :['The project reached its valid-until date without a conclusion. It can no longer be decided or deployed.','项目到达有效期至仍未得出结论，已自动关闭，不能再裁定或部署。']});
  }
  function deployCard(r){
    const c=r.contract;
    const started=r.deploy!=='none';
    const items=[
      [L('Blockchain network','区块链网络'),L('Ethereum','以太坊')],
      [L('Deployment execution status','部署执行状态'),deployBadge(r)],
      ...(started?[
        [L('Pledge contract address','质押合约地址'),c?.address?addressValue(c.address,L('address','地址')):L('Not produced yet','尚未产生'),true],
        [L('Contract deployment completed at','合约部署完成时间'),c?.at?time(c.at):'—'],
        [L('Deployment gas','部署实际 gas'),gasValue(c?.gas,c?.gasCcy)],
        [L('Deployment transaction evidence','部署交易凭证'),c?.proof?addressValue(c.proof,L('evidence','凭证')):unknown(),true]
      ]:[]),
      [L('Deployment initiated by','部署发起地址'),addressValue(A.wallet,L('address','地址')),true]
    ];
    const fail=r.fail?facts([
      [L('Failure reason','部署失败原因'),`<div class="cm-quote">${E(txt(r.fail.reason))}</div>`,true],
      [L('Failed at','失败时点'),time(r.fail.at)],
      [L('Gas already spent','已消耗 gas'),gasValue(r.fail.gas,r.fail.gasCcy)]
    ]):'';
    return section('Pledge contract and deployment facts','质押合约与部署事实',facts(items)
      +(started?'':`<p class="cm-meta">${L('The deployment has not been initiated. A successful deployment produces this project’s single pledge contract address.','尚未发起部署；部署成功后将产生本项目唯一的质押合约地址。')}</p>`)
      +`<p class="cm-meta">${L('Read-only on-chain facts written back with the real result. Deployments are signed by an operator with the platform wallet, which also bears the gas; operations cannot maintain the platform wallet or edit the contract address.','随真实结果回写的只读链上事实。部署由运营人员连接平台统一钱包签名发起，gas 由平台统一钱包承担；运营端不能维护平台钱包，也不可编辑合约地址。')}</p>`
      +(r.deploy==='failed'?`<div class="cm-failure"><h3>${L('Last deployment attempt','最近一次部署尝试')}</h3>${fail}${note(L('A failed deployment is not a review conclusion. The project is back to pending review, the asset holder is not notified and the project term is not restarted.','部署失败不是审核结论：项目已回到待审核，未通知资产方，项目期限起算点不变。'),'warn')}</div>`:'')
      +(r.deploy==='unknown'?note(L('No confirmed on-chain result for this deployment. The known facts are kept, the result is not assumed, no new attempt is started and no decision is changed; the asset holder cannot close the project until the result is written back. Contact the platform provider to check the chain and the configuration.','本次部署尚无确定的链上结果。已发生事实原样保留，不推定结果、不重复发起、不自动改判，资产方在结果回写前也不能关闭项目；请联系平台建设方核实链上与配置。'),'warn'):'')
      +(r.expiryPassed&&!r.closed?note(L('The valid-until date has passed during deployment. The project is handled by the result once it is written back.','部署处理中已跨过有效期至，部署结果回写后按结果处理。'),'warn'):'')
      +(r.deploy==='processing'?note(L('The deployment is in progress and no conclusion has been formed yet. The asset holder still sees the project as pending review and can neither pledge tokens nor close the project.','部署处理中，尚未形成结论。资产方仍看到项目待审核，暂不能发起代币质押，也不能关闭项目。'),'accent'):''));
  }
  function actionCard(r){
    const permission=!canDecide()
      ?L('View access only. This account does not hold the project review and contract deployment permission.','当前仅有融资项目审核查询权限，不能处置。')
      :r.closed?(r.closeReason==='expired'?L('The project reached its valid-until date and was closed automatically. It can no longer be decided or deployed; the record stays readable.','项目已到达有效期至并自动关闭，不能再裁定或部署，记录仍可只读回看。'):L('The asset holder closed this project. It can no longer be decided; the record stays readable.','资产方已关闭该项目，不可再裁定，记录仍可只读回看。'))
      :r.review==='approved'?L('The deployment succeeded and the review is approved. The conclusion is final: it cannot be withdrawn, re-judged or deployed a second time.','部署成功、审核已通过。结论终态：不可撤销、不可改判、不再部署第二份合约。')
      :r.review==='returned'?L('This project was returned. The asset holder can revise the details and resubmit.','本项目已退回，由资产方修改创建信息后重新提交。')
      :r.deploy==='processing'?L('A deployment is in progress. No second submission is accepted until the real on-chain result arrives.','本项目正在部署处理中，真实链上结果返回前不接受第二次提交。')
      :r.deploy==='unknown'?L('The deployment result is being verified. Decisions are unavailable until the real result is written back.','本次部署结果待核实，真实结果回写前不可处置。')
      :r.deploy==='failed'?L('The last deployment failed. Start a new deployment attempt, or return the project to the asset holder.','最近一次部署失败，可再次发起部署，或将项目退回资产方。')
      :L('Record your offline decision for this project.','请维护本项目的线下审核结论。');
    const waiting=`<div class="cm-rail-time"><span class="cm-meta">${L(endedAt(r)?'Waited until the decision':'Waiting so far',endedAt(r)?'审结前等待时长':'已等待时长')}</span><strong>${duration(waited(r))}</strong><span class="cm-meta">${L('A statement of fact, not a deadline: the project review has no time limit.','事实陈述，不是期限：项目审核不设时效。')}</span></div>`;
    let actions='';
    if(canDecide()){
      actions=r.deploy==='failed'
        ?`<div class="cm-stack">${b('Start the deployment again','再次发起部署','redeploy','','primary',!canApprove(r),canApprove(r)?'':txt(['Unavailable with the current project status or entity information.','当前项目状态或主体信息不允许此操作。']))}${b('Return to the asset holder','退回资产方','return','','',!canAct(r))}</div>`
        :`<div class="cm-stack">${b('Approve and deploy the contract','通过并部署合约','approve','','primary',!canApprove(r),canApprove(r)?'':txt(['Unavailable with the current project status or entity information.','当前项目状态或主体信息不允许此操作。']))}${b('Return to the asset holder','退回资产方','return','','',!canAct(r))}</div>`;
    }
    const hint=openForAction(r)
      ?`<p class="cm-meta cm-disclosure">${L('Approving needs a signature with the platform wallet to deploy the contract. The gas is borne by the platform wallet; you pay nothing personally.','通过需连接平台统一钱包签名部署合约；gas 由平台统一钱包承担，运营人员个人不付费。')}</p>`:'';
    return section('Review actions','审核处理',`<p class="cm-meta">${permission}</p>${waiting}${actions}${hint}`);
  }
  /* 每次结论的审核人与结论时间；通过的结论时间即合约部署完成时间。 */
  function conclusion(r){
    if(!['approved','returned'].includes(r.review)||!r.decisionAt)return '';
    return `<span class="cm-meta">${r.reviewer?E(txt(r.reviewer)):unknown()} · ${time(r.decisionAt)}</span>`;
  }
  function detail(){
    const blocked=gate();
    if(blocked)return title(L('Project review','项目审核详情'),'')+blocked;
    const r=row();
    if(!r)return CF.empty(L('Project unavailable','项目不可用'),L('Return to the review queue.','请返回项目审核队列。'),b('Back','返回','back'));
    if(A.view!=='default')return title(E(r.id),'')+surface({});
    const summary=`<div class="card cm-detail-summary"><div><span class="cm-meta">${L('Review status','审核轴')}</span>${reviewBadge(r)}${conclusion(r)}</div><div><span class="cm-meta">${L('Deployment execution status','部署执行状态')}</span>${deployBadge(r)}</div><div><span class="cm-meta">${L('This submission','本次提交')}</span><strong class="cm-value">${E(submission(r.seq))}</strong><span class="cm-meta">${time(r.submittedAt)}</span></div><div><span class="cm-meta">${L('Project status for the asset holder','面客项目状态')}</span>${projectState(r)}</div></div>`;
    return title(E(r.id),E(projectName(r)))+(A.draft?'':error())+summary
      +`<div class="cm-grid"><div class="cm-detail-main"><div class="detail-stack cm-stack">${createdInfo(r)}${contextCard(r)}${deployCard(r)}${activity(r)}</div></div><aside class="cm-stack cm-rail">${actionCard(r)}</aside></div>`;
  }

  /* ---------------------------------------------------------------- 办理 */
  function identity(r){
    return `<div class="cm-quote">${E(r.id)} · ${E(projectName(r))}<span class="cm-meta">${E(ownerName(r))} · ${E(submission(r.seq))}</span></div>`;
  }
  function start(mode){
    const r=row();
    if(mode==='approve'||mode==='redeploy'?!canApprove(r):!canAct(r))return deny();
    A.draft={id:r.id,mode,reason:'',ack:false};A.error='';
    open(mode==='return'?'return':'approve');
  }
  function validate(){
    const d=A.draft;if(!d)return false;A.error='';
    if(d.mode==='return'){
      const s=d.reason.trim(),n=Array.from(s).length;
      if(n<10||n>500||!/[\p{L}\p{N}]/u.test(s))A.error=['Enter a reason of 10–500 characters; punctuation alone is not valid.','原因需为 10～500 字，不能仅填标点。'];
    }else if(!d.ack)A.error=['Confirm that you understand the business effect of this decision.','请确认知悉本次结论的业务后果。'];
    return !A.error;
  }
  function beginDeploy(r,again){
    r.review='deploying';r.deploy='processing';
    r.contract={address:null,startedAt:now(),at:null,proof:'0xDEMO'+'0'.repeat(58)+'77',gas:null,gasCcy:'ETH',from:A.wallet};
    r.signedBy=['Demo Operator','演示操作员'];
    event(r,again?'redeploy':'approve-init',
      again?['Deployment started again','再次发起部署']:['Approval submitted · deployment initiated','提交通过并发起部署'],
      ['Pending review → Deployment in progress','待审核 → 部署处理中'],
      {actor:r.signedBy,signer:A.wallet,chain:true,gas:null,gasCcy:'ETH',
       text:again
         ?['A new deployment attempt reuses the same project number and the same review record. Earlier attempts stay in the activity.','新的部署尝试复用同一项目编号与同一条审核记录，历次尝试保留在操作记录中。']
         :['Signed with the platform wallet and submitted. No conclusion has been formed yet and the asset holder has not been notified.','已用平台统一钱包签名并提交。尚未形成结论，也未向资产方发送任何消息。']});
  }
  function applyReturn(r,reason,other){
    r.review='returned';r.deploy='none';r.decisionAt=now();
    r.reviewer=other?['Demo reviewer Chen','示例审核员陈']:['Demo reviewer Lin','示例审核员林'];
    r.returnReason=reason;r.contract=null;r.fail=null;
    event(r,'return',['Returned for revision','审核退回'],['Pending review → Returned','待审核 → 已退回'],
      {actor:r.reviewer,text:reason,notice:['Project review returned','项目审核退回'],
       next:['No contract was deployed and no gas was spent. The asset holder can revise the project details and resubmit; the project term is not restarted and no new project number is created.','未部署合约、未消耗 gas。资产方可修改创建信息后重新提交，项目期限不重新起算，也不产生新的项目编号。']});
    A.notices.push({id:r.id,kind:['Project review returned','项目审核退回']});
  }
  function submit(){
    const d=A.draft,r=row();
    if(A.busy)return;
    if(!d||d.id!==r?.id)return deny();
    if(d.mode!=='return'&&!d.signed)return deny();
    if(d.mode==='return'?!canAct(r):!canApprove(r))return deny();
    if(!validate()){open(d.mode==='return'?'return':'approve');return;}
    A.busy=true;A.error='';CF.render();
    const epoch=A.epoch,response=A.response;
    setTimeout(()=>{
      if(epoch!==A.epoch||A.draft!==d)return;
      A.busy=false;
      if(d.mode==='return'?!canAct(r):!canApprove(r))return deny();
      if(response==='fail'){
        d.signed=false;
        A.error=['The submission could not be saved. Your input is preserved.','提交未能保存，已保留输入，请重试。'];
        open(d.mode==='return'?'return':'approve');return;
      }
      if(response==='concurrent'){
        applyReturn(r,['Another reviewer returned this project: the project details need further confirmation by the asset holder before a contract can be deployed.','另一名审核员已退回本项目：创建信息尚需资产方进一步确认后才能部署合约。'],true);
        A.draft=null;S.layer=null;
        A.error=['Another reviewer has decided this project. The current conclusion is shown.','本项目已由其他审核员裁定，已显示当前结论、审核人及时间。'];
        CF.render();return;
      }
      if(response==='expired'||isExpired(r)){
        /* 提交时项目已到期：就地拒绝，不形成结论、不发起部署。 */
        closeOnExpiry(r);
        A.error=['Project expired: it reached its valid-until date and was closed automatically. This submission did not stand and no deployment was started.','项目已到期：已到达有效期至并自动关闭，本次提交未成立，未发起部署。'];
        open(d.mode==='return'?'return':'approve');return;
      }
      if(response==='closed'){
        /* 与资产方关闭同时发生、关闭先生效：本次办理就地拒绝，不形成结论、不发起部署。 */
        r.closed=true;r.closeReason='owner';
        event(r,'close',['Project closed by the asset holder','资产方关闭项目'],[REVIEW[r.review][0]+' · project closed',REVIEW[r.review][1]+' · 项目已关闭'],
          {actor:['Asset holder','资产方'],
           text:['The close took effect before this submission, so the approval did not stand and no deployment was started.','资产方的关闭先于本次提交生效，本次通过未成立，未发起部署。']});
        A.error=['Project closed: the asset holder’s close took effect first. This approval did not stand and no deployment was started.','项目已关闭：资产方的关闭先生效，本次通过未成立，未发起部署。'];
        open(d.mode==='return'?'return':'approve');return;
      }
      if(d.mode==='return'){
        applyReturn(r,[A.draft.reason.trim(),A.draft.reason.trim()]);
        A.draft=null;S.layer=null;saveContext();CF.render();
        CF.toast(L('The project has been returned to the asset holder.','已退回该项目。'));return;
      }
      beginDeploy(r,d.mode==='redeploy');
      A.draft=null;S.layer=null;saveContext();CF.render();
      CF.toast(L('Submitted. The platform wallet is deploying the contract.','已提交，平台统一钱包正在部署合约。'));
    },650);
  }
  /* 链上回写：成功即审核通过，失败视为审核未完成，长期无结果标待核实。 */
  function writeBack(kind){
    const r=row();
    if(!r||r.deploy!=='processing')return;
    if(kind==='success'){
      const address='0xDEMO'+'0'.repeat(32)+'C0'+r.key;
      r.deploy='success';r.review='approved';r.decisionAt=now();
      r.reviewer=r.signedBy||r.reviewer||['Demo Operator','演示操作员'];
      r.contract=Object.assign(r.contract||{},{address,at:now(),gas:0.0193,gasCcy:'ETH'});
      r.fail=null;
      event(r,'deploy-ok',['Deployment succeeded (review approved)','部署成功（即审核通过）'],['Deployment in progress → Approved','部署处理中 → 已通过'],
        {chain:true,gas:0.0193,gasCcy:'ETH',proof:r.contract.proof,address,
         text:['The pledge contract for this project was deployed. The project is now open and the asset holder can pledge tokens; pledging requires the holder’s signature and the gas is payable by the holder.','本项目质押合约已部署，项目转为可用，资产方可发起代币质押；质押需其本人签名，gas 自担。'],
         notice:['Project review approved','项目审核通过']});
      A.notices.push({id:r.id,kind:['Project review approved','项目审核通过']});
      if(r.expiryPassed)closeOnExpiry(r);
    }else if(kind==='failed'){
      const reason=['The deployment transaction was rejected on chain: the platform wallet did not have enough balance to cover the gas for this transaction.','部署交易在链上被拒绝：平台统一钱包余额不足以支付本次交易的 gas。'];
      r.deploy='failed';r.review='pending';
      r.fail={reason,at:now(),gas:0.0041,gasCcy:'ETH'};
      r.contract=Object.assign(r.contract||{},{gas:0.0041,at:null});
      event(r,'deploy-fail',['Deployment failed','部署失败'],['Deployment in progress → Pending review','部署处理中 → 待审核'],
        {chain:true,gas:0.0041,gasCcy:'ETH',proof:r.contract.proof,text:reason,
         next:['No conclusion was formed. The asset holder is not notified and still sees the project as pending review. A manager with the decision permission can start the deployment again.','未形成结论，不通知资产方，面客侧仍显示项目待审核；由有处置权限的管理人员再次发起部署。']});
      if(r.expiryPassed)closeOnExpiry(r);
    }else{
      r.deploy='unknown';
      event(r,'deploy-unknown',['Deployment result to be verified','部署结果待核实'],['No confirmed on-chain result','尚无确定的链上结果'],
        {chain:true,gas:null,gasCcy:'ETH',proof:r.contract?.proof,
         text:['No confirmed result has been received. The known evidence is kept as is; the result is not assumed to be a success or a failure.','尚未收到确定结果，已知链上凭证原样保留，不推定为成功或失败。'],
         next:['Contact the platform provider to check the chain and the configuration.','请联系平台建设方核实链上与配置。']});
    }
    CF.render();
  }

  /* ---------------------------------------------------------------- 弹层 */
  function approveLayer(){
    const d=A.draft,r=row();
    if(!d||!r)return {title:L('Unavailable','不可用'),html:'',foot:b('Close','关闭','cancel')};
    const again=d.mode==='redeploy';
    const facts=kv([
      [L('Token type','代币类型'),E(r.tokenType)],
      [L('Project pledge ratio','项目质押率'),pct(r.ratio)],
      [L('Project term','项目期限'),E(termRange(r))],
      [L('Preferred settlement currency','参考结算币种'),E(r.settleCcy)],
      [L('Repayment method','还款方式'),txt(REPAYMENT)],
      [L('SPV name','SPV机构名称'),`<span class="mono">${E(r.spv)}</span>`],
      [L('Project publisher / entity','项目发布方 / 稳定主体标识'),E(ownerName(r))+' · '+(r.entity?`<span class="mono">${E(r.entity)}</span>`:unknown()),true],
      [L('Maximum pledge ratio · current configuration','最高质押率 · 当前配置'),A.config.available?pct(A.config.maxRatio):unknown()],
      [L('Maximum project term · current configuration','最长项目期限 · 当前配置'),A.config.available?months(A.config.maxTermMonths):unknown()]
    ]);
    const failure=again&&r.fail?note(L('The last attempt failed: ','最近一次部署失败：')+txt(r.fail.reason),'warn'):'';
    const ack=L('I understand: signing deploys this project’s pledge contract with the platform wallet. A successful deployment is the approval itself, the project and the contract match one to one, and the conclusion cannot be withdrawn.','我已知悉：签名后将以平台统一钱包部署本项目质押合约，部署成功即审核通过，项目与合约一一对应且不可撤销。');
    return {title:again?L('Start the deployment again','再次发起部署'):L('Approve and deploy the contract','通过并部署合约'),
      html:`<div class="cm-form">${identity(r)}<fieldset ${A.busy?'disabled':''}>${failure}${facts}<label class="cm-ack"><input id="cm-ack" aria-required="true" type="checkbox" ${d.ack?'checked':''}> ${CF.fieldLabel(ack,true)}</label><p class="cm-meta">${L('Next, connect the platform wallet and sign. Only the platform wallet address can sign; its gas is borne by the platform wallet.','下一步连接平台统一钱包签名；只有平台统一钱包地址可以签名，gas 由平台统一钱包承担。')}</p></fieldset><div id="cm-form-error">${error()}</div>${A.busy?'<p role="status">'+L('Submitting…','正在提交…')+'</p>':''}</div>`,
      foot:b('Cancel','取消','cancel','','',A.busy)+b(again?'Connect wallet and sign the redeployment':'Connect wallet and sign the deployment',again?'连接平台统一钱包，签名再次部署':'连接平台统一钱包，签名部署','sign','','primary',A.busy||r.closed)};
  }
  function returnLayer(){
    const d=A.draft,r=row();
    if(!d||!r)return {title:L('Unavailable','不可用'),html:'',foot:b('Close','关闭','cancel')};
    return {title:L('Return to the asset holder','退回资产方'),
      html:`<div class="cm-form">${identity(r)}<fieldset ${A.busy?'disabled':''}>${field(L('Reason shown to the asset holder *','向资产方展示的原因 *'),`<textarea class="inp" id="cm-reason" aria-required="true" aria-invalid="${!!A.error}" aria-describedby="cm-form-error">${E(d.reason)}</textarea><span class="cm-meta">${Array.from(d.reason.trim()).length} / 500 · ${L('Minimum 10 characters','至少 10 字')}</span>`)}</fieldset><div id="cm-form-error">${error()}</div></div>`,
      foot:b('Cancel','取消','cancel','','',A.busy)+b('Review the reason','核对原因','confirm','','primary',A.busy||r.closed)};
  }
  const layers={
    'cm-approve':approveLayer,
    'cm-return':returnLayer,
    'cm-return-confirm':()=>({title:L('Confirm the return','确认退回'),
      html:identity(row())+`<div class="cm-section"><div class="cm-quote">${E((A.draft?.reason||'').trim())}</div><p class="cm-meta">${L('The reason above is sent to the asset holder in full. No contract is deployed and no gas is spent. The asset holder can revise the project details and resubmit; the project term is not restarted and no new project number is created.','以上原因将全文发送给资产方。本次不部署合约、不消耗 gas；资产方可修改创建信息后重新提交，项目期限不重新起算，也不产生新的项目编号。')}</p>${A.busy?'<p role="status">'+L('Submitting…','正在提交…')+'</p>':''}</div>`,
      foot:b('Back','返回修改','edit','','',A.busy)+b('Confirm the return','确认退回','submit','','primary',A.busy)}),
    'cm-discard':()=>({title:L('Discard unsaved inputs?','放弃未提交内容？'),
      html:note(L('The reason you typed will not be carried to another project.','未提交的原因不会带入其他项目。')),
      foot:b('Keep editing','继续编辑','keep')+b('Discard','放弃内容','discard','','primary')})
  };

  /* ---------------------------------------------------------------- 演示工具 */
  function grant(mode){
    if(!CF.opsAuth)return;
    CF.opsAuth.seedDemo(mode==='admin'?'admin':'specialist');
    if(mode==='query')OPS.onAct('ops-grant','17');
    if(mode==='decide')OPS.onAct('ops-grant','18');
    if(mode==='full'){OPS.onAct('ops-grant','17');OPS.onAct('ops-grant','18');}
    A.epoch++;A.draft=null;A.busy=false;A.error='';S.layer=null;
  }
  function demo(){
    if(OPS_PAGES.includes(S.page))return OPS.demo();
    const r=row(),processing=r?.deploy==='processing';
    return `<h3>${L('Project contracts · demo tools','项目合约管理 · 演示工具')}</h3><p class="cm-meta">${L('Local demonstration only. Wallet connection and signing, deployment, chain write-back and messages are all simulated.','仅本地演示：钱包连接与签名、部署、链上回写与站内信均为模拟。')}</p>
      <h4>${L('Account configuration · later-role preview','账号配置 · 后期角色预演')}</h4><p class="cm-meta">${L('This release has one role: the operations administrator holds both permissions.','本期只有运营管理员一个角色，固定具备两项权限。')}</p><div class="cm-demo-actions">${b('Administrator','运营管理员','grant','admin')}${b('Later role · no access','后期角色 · 未开通本模块','grant','none')}${b('Later role · query only','后期角色 · 仅开通审核查询','grant','query')}${b('Later role · decision only','后期角色 · 仅开通审核处置','grant','decide')}${b('Later role · query + decision','后期角色 · 查询＋处置','grant','full')}</div>
      <div class="cm-demo">${field(L('Page state','页面状态'),select('cm-view',A.view,[['default',L('Default','默认')],['loading',L('Loading','加载中')],['empty',L('Empty','空数据')],['noresult',L('No results','筛选无结果')],['error',L('Load failed','读取失败')]]))}${field(L('Submit response','提交反馈'),select('cm-response',A.response,[['success',L('Success','成功')],['fail',L('Failure','失败')],['concurrent',L('Another reviewer wins','已被他人裁定')],['closed',L('Asset holder’s close takes effect first','资产方关闭先于本次提交生效')],['expired',L('Project has expired at submission','提交时项目已到期')]]))}${field(L('Activity state','操作记录状态'),select('cm-activity-state',A.activityState,[['default',L('Default','默认')],['loading',L('Loading','加载中')],['empty',L('Empty','暂无记录')],['error',L('Load failed','加载失败')]]))}${field(L('Parameter configuration','融资参数配置'),select('cm-config',A.config.available?'on':'off',[['on',L('Readable','可读')],['off',L('Unavailable · to be verified','不可读 · 标待核实')]]))}</div>
      <h4>${L('On-chain write-back for this project','本项目的链上回写')}</h4><div class="cm-demo-actions">${b('Deployment succeeds','部署成功回写','chain-success','','',!processing)}${b('Deployment fails','部署失败回写','chain-failed','','',!processing)}${b('Result to be verified','结果待核实','chain-unknown','','',!processing)}${b('Replay the latest event','重放最新事件','replay','','',!r)}</div>
      <h4>${L('Valid-until date','项目有效期')}</h4><div class="cm-demo-actions">${b('Reach the valid-until date','到达有效期至','expire','','',!r||r.closed||r.expiryPassed||!['pending','deploying','returned'].includes(r.review))}</div>${r?.expiryPassed?`<p class="cm-meta">${L('The valid-until date has passed during deployment. Write back a result to see how it is handled.','部署处理中已跨过有效期至，回写部署结果即可看到按结果处理。')}</p>`:''}
      <h4>${L('Asset holder actions','资产方动作')}</h4><div class="cm-demo-actions">${b('Revise and resubmit','修改后重新提交','resubmit','','',!r||r.review!=='returned'||r.closed)}${b('Close the project','关闭项目','close','','',!r||r.closed||!['pending','deploying','returned'].includes(r.review))}${b('Expire operations session','运营登录失效','expire-session')}${b('Reset demonstration','重置演示','restart')}</div>
      <h4>${L('Messages sent to asset holders','已发送的面客站内信')}</h4><p class="cm-meta">${A.notices.map(n=>E(n.id+' · '+txt(n.kind))).join('<br>')||L('None','暂无')}</p>
      <p class="cm-meta">${L('Signature or deployment failure, a new attempt and a result to be verified send no message at all.','签名或部署失败、再次发起与结果待核实都不发送任何消息。')}</p>`;
  }

  /* ---------------------------------------------------------------- 动作 */
  function resetFilter(){
    const st=list();
    if(S.page===LG){st.filter=lDefault();st.edit=lDefault();st.dir=-1;}
    else{st.filter=qDefault();st.edit=qDefault();st.sort='submittedAt';st.dir=1;}
    st.open=false;st.page=1;A.error='';A.view='default';
    if(S.page!==DT)saveContext();
    CF.render();
  }
  function onAct(act,v,e){
    if(e&&(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)&&['cm-view','cm-go'].includes(act))return false;
    if(act.startsWith('ow-'))return CF.opsWallet.onAct(act,v);
    if(!act.startsWith('cm-')){
      if(act==='retry'){A.view='default';A.error='';CF.render();return true;}
      if(act==='clearfilter'){resetFilter();return true;}
      return false;
    }
    act=act.slice(3);
    if(A.busy&&act!=='cancel')return true;
    if(act==='go')leave(v==='ledger'?ledgerRoute():queueRoute());
    else if(act==='view'){A.src=S.page===LG?'ledger':'queue';leave(detailRoute(v,A.src));}
    else if(act==='back')leave(backRoute());
    else if(act==='sign-in'){S.layer=null;location.hash='#/ops/login';}
    else if(act==='page'){list().page=+v;saveContext();CF.render();window.scrollTo(0,0);}
    else if(act==='search'){
      const st=list(),f={...st.edit};
      if(f.from&&f.to&&f.from>f.to){st.open=true;A.error=['The start date must not be later than the end date.','开始日期不得晚于结束日期。'];CF.render();return true;}
      A.error='';st.open=false;st.filter=f;st.page=1;A.view='default';saveContext();CF.render();
    }
    else if(act==='filters'){const st=list();st.open=!st.open;CF.render();document.querySelector('[data-act=cm-filters]')?.focus();}
    else if(act==='reset')resetFilter();
    else if(act==='sort'){
      const st=list();
      if(S.page===LG)st.dir=-st.dir;else{st.dir=st.sort===v?-st.dir:1;st.sort=v;}
      saveContext();CF.render();
    }
    else if(act==='approve'||act==='return'||act==='redeploy')start(act);
    else if(act==='sign'){
      /* 连接平台统一钱包 → 核对地址 → 签名部署；取消、地址不符、钱包不可用、拒签或签名失败都不产生结论。 */
      const d=A.draft,r=row();
      if(!d||d.id!==r?.id||!canApprove(r))return deny(),true;
      if(!validate()){open('approve');$('cm-ack')?.focus();return true;}
      const again=d.mode==='redeploy';
      A.error='';
      CF.opsWallet.start({
        purpose:again?['Sign the redeployment of the pledge contract for '+r.id+'.','签名再次部署 '+r.id+' 的质押合约。']:['Sign the deployment of the pledge contract for '+r.id+'.','签名部署 '+r.id+' 的质押合约。'],
        detail:['Signing submits the approval. The review is approved only when the deployment succeeds.','签名即提交通过；部署成功才形成审核通过。'],
        onSigned:()=>{d.signed=true;open('approve');submit();},
        onAbort:k=>{d.signed=false;A.error=CF.opsWallet.abortText(k);open('approve');}
      });
    }
    else if(act==='confirm'){
      if(!canAct(row()))deny();
      else if(validate())open('return-confirm');
      else{CF.render();$('cm-reason')?.focus();}
    }
    else if(act==='edit')open('return');
    else if(act==='submit')submit();
    else if(act==='cancel'){
      A.next=undefined;
      if(A.draft&&(A.draft.reason||'').trim())open('discard');
      else{A.draft=null;CF.closeLayer();}
    }
    else if(act==='keep')open(A.draft?.mode==='return'?'return':'approve');
    else if(act==='discard'){
      A.draft=null;A.error='';
      if(A.next!==undefined){const target=A.next;A.next=undefined;navigateRoute(target);}else CF.closeLayer();
    }
    else if(act==='activity-retry'){A.activityState='default';CF.render();$('cm-activity')?.focus({preventScroll:true});}
    else if(act==='copy')navigator.clipboard?.writeText(v).then(()=>CF.toast(L('Copied','已复制'))).catch(()=>CF.toast(L('Copy the visible value manually.','请手动复制显示值。')));
    else if(act==='grant'){grant(v);S.demo=false;window.scrollTo(0,0);navigateRoute(S.page===DT&&A.selected?detailRoute(A.selected,A.src):S.page===LG?ledgerRoute():queueRoute());}
    else if(act==='expire-session'){A.draft=null;A.busy=false;S.layer=null;S.demo=false;OPS.onAct('ops-session-expire');CF.render();}
    else if(act==='chain-success')writeBack('success');
    else if(act==='chain-failed')writeBack('failed');
    else if(act==='chain-unknown')writeBack('unknown');
    else if(act==='replay'){const r=row();if(r&&r.events.length){r.events.push({...r.events[0]});CF.render();}}
    else if(act==='resubmit'){
      const r=row();
      if(r&&r.review==='returned'&&!r.closed){
        r.review='pending';r.seq+=1;r.submittedAt=now();r.decisionAt=null;r.reviewer=null;
        event(r,'resubmit',['Resubmitted after revision','资产方修改后重新提交'],
          [`Returned → Pending review · submission ${r.seq}`,`已退回 → 待审核 · 第 ${r.seq} 次提交`],
          {actor:['Asset holder','资产方'],
           text:['Same project number and the same project term start date; earlier return reasons stay in the activity.','项目编号不变、项目期限起算点不变；既往退回原因保留在操作记录中。']});
        CF.render();
      }
    }
    else if(act==='expire'){
      const r=row();
      if(r&&!r.closed){
        if(r.review==='deploying'){r.expiryPassed=true;CF.toast(L('The valid-until date passed during deployment. The project stays as it is until the result is written back.','部署处理中跨过有效期至：项目暂不关闭，等部署结果回写后按结果处理。'));}
        else if(['pending','returned'].includes(r.review))closeOnExpiry(r);
        CF.render();
      }
    }
    else if(act==='close'){
      const r=row();
      /* 部署处理中（含结果待核实）资产方不能关闭：关闭被拒，审核轴与项目都不变。 */
      if(r&&!r.closed&&r.review==='deploying'){
        CF.toast(L('The asset holder’s close request was refused: the contract is being deployed. Nothing changed.','资产方关闭被拒：合约正在部署，暂不可关闭，审核轴与项目均未变化。'));
        return true;
      }
      if(r&&!r.closed&&['pending','returned'].includes(r.review)){
        r.closed=true;r.closeReason='owner';
        event(r,'close',['Project closed by the asset holder','资产方关闭项目'],[REVIEW[r.review][0]+' · project closed',REVIEW[r.review][1]+' · 项目已关闭'],
          {actor:['Asset holder','资产方'],
           text:['Operations has no entry to close or reopen a project. The record stays readable with the query permission.','运营端没有关闭与恢复入口；有查询权限时记录仍可只读回看。']});
        CF.render();
      }
    }
    else if(act==='restart'){
      A.epoch++;seed=CF.contractSeed();
      A.rows=seed.rows;A.config={...seed.config};A.wallet=seed.wallet;A.tokenType=seed.tokenType;
      A.now=seed.now;A.clock=Date.now();A.draft=null;A.busy=false;A.response='success';
      A.activityState='default';A.notices=[];grant('admin');resetFilter();navigateRoute(queueRoute());
    }
    else return false;
    return true;
  }
  function onInput(e){
    if(A.busy)return;
    const el=e.target,id=el.id;
    if(id.startsWith('cm-f-')){list().edit[id.slice(5)]=el.value;return;}
    if(A.draft){
      if(id==='cm-reason'){
        A.draft.reason=el.value;
        const count=el.parentElement.querySelector('.cm-meta');
        if(count)count.textContent=Array.from(el.value.trim()).length+' / 500 · '+L('Minimum 10 characters','至少 10 字');
        el.setAttribute('aria-invalid','false');
      }
      if(id==='cm-ack')A.draft.ack=el.checked;
    }
  }
  document.addEventListener('submit',e=>{if(e.target.id==='cm-filter-form'){e.preventDefault();onAct('cm-search','');}});
  document.addEventListener('input',onInput);
  document.addEventListener('change',e=>{
    onInput(e);
    const el=e.target,id=el.id;
    if(id==='cm-order'){const [sort,dir]=el.value.split(':');A.queue.sort=sort;A.queue.dir=+dir;saveContext();CF.render();}
    if(['cm-view','cm-response','cm-activity-state'].includes(id)){
      const key={'cm-view':'view','cm-response':'response','cm-activity-state':'activityState'}[id];
      A[key]=el.value;A.error='';CF.render();
    }
    if(id==='cm-config'){A.config.available=el.value==='on';CF.render();}
  });
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href^="#"]');
    if(!a||a.hasAttribute('data-act')||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
    if(A.draft&&(A.draft.reason||'').trim()){e.preventDefault();A.next=a.hash.slice(1);open('discard');return;}
    remember();
  },true);

  const DENIED={id:'denied',label:['No access','无权限'],group:'business'};
  [[Q,['Project reviews','项目审核队列'],['default','loading','empty','noresult','error',DENIED]],
   [LG,['Pledge contract ledger','质押合约台账'],['default','loading','empty','noresult','error',DENIED]],
   [DT,['Project review detail','项目审核详情'],['default','loading','error',DENIED]]].forEach(([id,label,states])=>{
    CF.review.register(id,{
      group:['Project contracts','项目合约管理'],label,states,
      scenarios:()=>id!==DT?[]:[
        ...Object.keys(REVIEW).map(st=>({id:'review-'+st,label:REVIEW[st].slice(0,2),row:A.rows.find(r=>r.review===st)})),
        ...['failed','unknown','success'].map(st=>({id:'deploy-'+st,label:DEPLOY[st].slice(0,2),row:A.rows.find(r=>r.deploy===st)}))
      ].map(s=>({id:s.id,label:s.label,available:canQuery()&&!!s.row,route:s.row?detailRoute(s.row.id,'queue'):null,description:s.row?['Existing project · '+s.row.id,'已有项目 · '+s.row.id]:['No matching project','暂无对应项目']})),
      route:()=>id===Q?ROOT:id===LG?LEDGER:detailRoute(A.rows[0].id,'queue'),
      get:()=>canQuery()?A.view:'denied',
      set(value){
        if(value==='denied'){grant('none');A.view='default';S.st='default';return;}
        if(!canQuery())grant('admin');
        A.view=value;S.st=value;
      },
      reset(){if(!canQuery())grant('admin');A.view='default';S.st='default';A.response='success';A.activityState='default';},
      beforeChange(proceed){CF.AdminMenu.beforeLeave(proceed);}
    });
  });

  const dict={
    en:{...OPS.dict.en,navContracts:'Project contracts',navContractQueue:'Project reviews',
      navContractDetail:'Project review detail',navContractLedger:'Pledge contract ledger'},
    zh:{...OPS.dict.zh,navContracts:'项目合约管理',navContractQueue:'项目审核队列',
      navContractDetail:'项目审核详情',navContractLedger:'质押合约台账'}
  };
  CF.define({...OPS,id:'contract-management',demoOnly:true,reviewToolsInLayer:false,dict,demo,
    content:page=>{
      if(OPS_PAGES.includes(page))return OPS.content(page);
      return page===DT?detail():page===LG?ledger():queue();
    },
    layers:{...OPS.layers,...layers,...CF.opsWallet.layers},
    onAct:(act,v,e)=>onAct(act,v,e)||OPS.onAct(act,v,e),
    beforeAdminNavigate(proceed){
      if(A.busy||(A.draft&&(A.draft.reason||'').trim())){CF.toast(L('Finish or cancel the current review first.','请先完成或取消当前审核办理。'));return;}
      remember();proceed();
    },
    allowNav:id=>[Q,DT,LG].includes(id)?allowed():OPS_PAGES.includes(id),
    breadcrumbRoute:id=>id===Q?queueRoute():id===LG?ledgerRoute():null,
    onBeforeAct(act,v,e){
      if(act==='retry'||act==='clearfilter'){onAct(act,v);return true;}
      if(act==='closelayer'&&e?.type==='click'&&e.target.closest('[data-stop]'))return false;
      if(act==='closelayer'&&A.busy)return true;
      if(act==='closelayer'&&CF.opsWallet.closing())return true;
      if(act==='closelayer'&&A.draft){onAct('cm-cancel','');return true;}
      return OPS.onBeforeAct(act,v,e);
    },
    beforeRender(){
      S.toTop=false;syncContext();
      /* 详情的父级随来源列表变化，面包屑回到真正的来源入口。 */
      CF.PAGES[DT].parent=A.src==='ledger'?LG:Q;
      const signed=signedIn();
      if(signed&&[Q,DT,LG].includes(S.page))lastHash=location.hash;
      if(!signed&&wasSigned){A.draft=null;A.busy=false;S.layer=null;if(onModule)returnHash=lastHash;}
      OPS.beforeRender();
      if(signed&&!wasSigned&&returnHash){location.hash=returnHash;returnHash='';}
      wasSigned=signed;onModule=[Q,DT,LG].includes(S.page);
      if(!allowed()&&S.layer?.key.startsWith('cm-')){S.layer=null;A.draft=null;A.busy=false;}
    },
    afterRender(){OPS.afterRender();restoreView();},
    onRoute(prev,id){
      A.epoch++;A.busy=false;A.draft=null;A.error='';A.view='default';restoreContext=true;
      if(OPS_PAGES.includes(id)||OPS_PAGES.includes(prev))OPS.onRoute(prev,id);
    }
  });
  S.end='admin';S.role='ops';
  CF.opsAuth.seedDemo('admin');
  if(!location.hash.startsWith('#'+ROOT)&&!location.hash.startsWith('#'+LEDGER)){
    try{history.replaceState(null,'','#'+ROOT);}catch(error){location.hash='#'+ROOT;}
  }
  CF.boot();
})(window.CF);
