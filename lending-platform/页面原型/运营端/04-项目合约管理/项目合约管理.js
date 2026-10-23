/* WS-387 / WS-455 · 项目合约管理（运营端）：项目审核队列、项目审核详情、共用合约台账。
   会话与功能权限读运营端账户与登录一处登记（CF.opsAuth）：
   PM-AL-17 融资项目审核查询、PM-AL-18 融资项目审核与合约配置处置。
   合约按「代币类型＋区块链网络」共用一套（质押、放款、还款各一份）；通过时选定三份合约并确认，
   由平台在链上执行配置，运营人员不签名。业务数据、配置结果与站内信均为本地演示。 */
(function(CF){
  'use strict';
  const S=CF.S,L=CF.L,E=CF.esc,OPS=CF.opsAccountModule,$=id=>document.getElementById(id);
  const Q='P-O-CM-01',DT='P-O-CM-02',LG='P-O-CM-03';
  const ROOT='/ops/contract-reviews',LEDGER='/ops/contract-ledger';
  const OPS_PAGES=['P-O-AL-01','P-O-AL-03','P-O-AL-04','P-O-AL-05','P-O-AL-06','P-O-AL-07'];

  /* 审核轴：四类，默认待审核；配置处理中不是结论，不因时间流逝自动改变。 */
  const REVIEW={pending:['Pending review','待审核','warn'],configuring:['Configuration in progress','配置处理中','accent'],
    approved:['Approved','已通过','ok'],returned:['Returned','已退回','danger']};
  /* 配置执行状态：链上执行事实，与审核轴是两条独立的轴。 */
  const EXEC={none:['Not initiated','未发起','gray'],processing:['Configuration in progress','配置处理中','accent'],
    success:['Configured','配置成功','ok'],failed:['Configuration failed','配置失败','danger'],
    unknown:['Result to be verified','结果待核实','warn']};
  const RESULT={success:['Succeeded','成功','ok'],failed:['Failed','失败','danger'],
    unknown:['To be verified','待核实','warn'],processing:['In progress','处理中','accent']};
  const KINDS=[['pledge',['Pledge contract','质押合约']],['loan',['Loan contract','放款合约']],['repay',['Repayment contract','还款合约']]];
  const NETWORKS={eth:['Ethereum','以太坊']};
  const OWNERS=[['A',['Demo Asset A','示例资产企业 A']],['B',['Demo Asset B','示例资产企业 B']],['C',['Demo Asset C','示例资产企业 C']]];
  const REPAYMENT=['Quarterly interest, principal and interest at maturity','按季付息、到期还本付息'];
  const OPERATOR=['Demo Operator','演示操作员'];

  const qDefault=()=>({review:'pending',exec:'',owner:'',token:'',network:'',from:'',to:'',q:''});
  const lDefault=()=>({token:'',network:'',q:''});

  let seed=CF.contractSeed();
  const A={rows:seed.rows,sets:seed.sets,tokenTypes:seed.tokenTypes,config:{...seed.config},
    now:seed.now,clock:Date.now(),
    queue:{filter:qDefault(),edit:qDefault(),page:1,sort:'submittedAt',dir:1,open:false},
    ledger:{filter:lDefault(),edit:lDefault(),page:1,dir:-1,set:''},
    view:'default',response:'success',activityState:'default',
    draft:null,busy:false,error:'',selected:null,src:'queue',notices:[],epoch:0};
  let routeKey=null,restoreContext=false,returnHash='',lastHash='',onModule=false,wasSigned=false;
  const positions=new Map();

  const now=()=>A.now+(Date.now()-A.clock);
  const txt=x=>Array.isArray(x)?L(x[0],x[1]):x;
  const time=t=>t?CF.fmtTime(t):'—';
  // Lists share a compact timestamp; the timezone remains visible in the column heading.
  const listTime=t=>t?`<time class="cm-stamp" datetime="${E(new Date(t).toISOString())}" title="${E(CF.fmtTime(t))}">${E(CF.fmtStamp(t))}</time>`:'—';
  const columnZone=()=>`<span class="cm-meta">${E(S.tz||'UTC')}</span>`;
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
  const network=k=>NETWORKS[k]?txt(NETWORKS[k]):k;
  const networkValue=k=>`<span class="cm-network">${k==='eth'?CF.assetIcon('ETH'):''}<span>${E(network(k))}</span></span>`;
  const comboValue=x=>E(x.tokenType)+' · '+networkValue(x.network);
  const row=()=>A.rows.find(r=>r.id===A.selected);
  const list=()=>S.page===LG?A.ledger:A.queue;
  /* 项目的适用组合取自创建信息的代币类型与区块链网络；每个组合同时只有一套在用。 */
  const setOf=r=>A.sets.find(s=>s.tokenType===r.tokenType&&s.network===r.network)||null;
  const setById=id=>A.sets.find(s=>s.id===id)||null;
  const missingKinds=set=>KINDS.filter(([k])=>!set||!set[k]).map(([,label])=>txt(label));
  const configured=set=>A.rows.filter(r=>r.exec==='success'&&r.attempt?.set===set.id);
  const configAt=r=>r.exec==='success'?r.attempt?.at||null:null;
  const tokenConfig=r=>A.config.byToken[r.tokenType]||null;

  const b=(en,zh,act,value='',cls='',disabled=false,title='')=>`<button type="button" class="btn ${cls}" data-act="cm-${act}" data-v="${E(value)}" ${title?`title="${E(title)}"`:''} ${disabled?'disabled':''}>${L(en,zh)}</button>`;
  const viewLink=(id,src)=>`<a class="actlink" href="#${E(detailRoute(id,src))}" data-act="cm-view" data-v="${E(id)}">${L('View','查看')}</a>`;
  const field=(label,html)=>`<div class="field"><label for="${(html.match(/id="([^"]+)/)||[])[1]||''}">${CF.fieldLabel(label)}</label>${html}</div>`;
  const input=(id,v,type='text')=>`<input class="inp" id="${id}" type="${type}" value="${E(v)}">`;
  const select=(id,value,options,attrs='')=>`<select class="inp" id="${id}" ${attrs}>${options.map(([v,label])=>`<option value="${E(v)}" ${v===value?'selected':''}>${E(label)}</option>`).join('')}</select>`;
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
  const execBadge=r=>CF.tag(EXEC[r.exec][2],txt(EXEC[r.exec]));
  const notAvailable=()=>CF.tag('warn',L('Not available','暂无'));

  /* 功能权限只在运营端账户与登录一处登记。 */
  const signedIn=()=>!!CF.opsAuth&&CF.opsAuth.can(14);
  const canQuery=()=>!!CF.opsAuth&&CF.opsAuth.can(17);
  const canDecide=()=>!!CF.opsAuth&&CF.opsAuth.can(17)&&CF.opsAuth.can(18);
  /* held 区分「未开通」与「已开通处置但缺配套查询」；只读，不改授权。 */
  const decideOnly=()=>!!CF.opsAuth&&!CF.opsAuth.held(17)&&CF.opsAuth.held(18);
  const allowed=()=>S.end==='admin'&&signedIn()&&canQuery();
  /* 项目仍待审核、不在配置处理中、也不是结果待核实时才可处置；审核无截止条件。 */
  const openForAction=r=>!!r&&!r.closed&&r.review==='pending'&&!['processing','unknown'].includes(r.exec);
  const canAct=r=>allowed()&&canDecide()&&openForAction(r);
  const canApprove=r=>canAct(r)&&!!r.entity&&!missingKinds(setOf(r)).length;

  function event(r,kind,title,result,extra){
    r.events.unshift(Object.assign({id:crypto.randomUUID(),at:now(),kind,title,result,actor:['System','系统']},extra||{}));
  }
  const lastDecision=r=>{const e=r.events.find(x=>['return','config-ok'].includes(x.kind));return e?e.at:null;};

  /* ---------------------------------------------------------------- 路由 */
  function listParams(which){
    const st=which==='ledger'?A.ledger:A.queue;
    const p=new URLSearchParams({...st.filter,page:String(st.page),dir:String(st.dir)});
    if(which==='ledger'){if(st.set)p.set('set',st.set);}else p.set('sort',st.sort);
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
    if('from' in f)for(const k of ['from','to'])if(!/^\d{4}-\d{2}-\d{2}$/.test(f[k]))f[k]='';
    if(f.token&&!A.tokenTypes.includes(f.token))f.token='';
    if(f.network&&!NETWORKS[f.network])f.network='';
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
      A.ledger.dir=p.get('dir')==='1'?1:-1;
      A.ledger.set=setById(p.get('set'))?p.get('set'):'';
    }else{
      A.queue.filter=readFilter(p,qDefault,f=>{
        if(f.review&&!REVIEW[f.review])f.review='pending';
        if(f.exec&&!EXEC[f.exec])f.exec='';
      });
      A.queue.edit={...A.queue.filter};
      A.queue.page=Math.max(1,parseInt(p.get('page'),10)||1);
      A.queue.sort='submittedAt';
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
      L('This account can decide project reviews but cannot query them, so the review is refused. Ask your platform provider to correct the delivered configuration.','该账号开通了融资项目审核与合约配置处置，但未开通融资项目审核查询，本次访问已拒绝。请联系平台建设方修正交付配置。'),'')
    :CF.empty(L('No access to project contracts','无权访问项目合约管理'),
      L('The delivered configuration does not give this account the financing project review permissions.','当前交付配置未为该账号开通融资项目审核相关权限。'),'');}
  function gate(){return !signedIn()?signedOut():!canQuery()?noAccess():'';}

  /* ---------------------------------------------------------------- 列表公用 */
  function title(t){
    return `<div class="cm-title"><div><h1>${t}</h1></div>${CF.tag('gray',L('Demonstration data','演示数据'))}</div>`;
  }
  function views(current){
    const item=(key,route,en,zh)=>`<a class="cm-view" href="#${E(route)}" data-act="cm-go" data-v="${key}" ${current===key?'aria-current="page"':''}>${L(en,zh)}</a>`;
    return `<nav class="cm-views" aria-label="${L('Project contracts views','项目合约管理视图')}">${item('queue',queueRoute(),'Project reviews','项目审核队列')}${item('ledger',ledgerRoute(),'Shared contract ledger','共用合约台账')}</nav>`;
  }
  function listHeading(current){
    return `<div class="cm-list-heading"><h1>${L('Project contracts','项目合约管理')}</h1>${views(current)}${CF.tag('gray',L('Demonstration data','演示数据'))}</div>`;
  }
  function sortControl(){
    const options=[
      ['submittedAt:1',L('Submitted · oldest first','本次提交时间 · 最早优先')],
      ['submittedAt:-1',L('Submitted · newest first','本次提交时间 · 最新优先')]
    ];
    return `<span class="fb"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4.6 2.8v10.4M2.4 10.8l2.2 2.4 2.2-2.4M11.4 13.2V2.8M9.2 5.2l2.2-2.4 2.2 2.4"/></svg><select class="inp" id="cm-order" aria-label="${L('Sort by','排序')}">${options.map(([v,label])=>`<option value="${v}" ${v===A.queue.sort+':'+A.queue.dir?'selected':''}>${E(label)}</option>`).join('')}</select></span>`;
  }
  function surface(opts){S.st=A.view;return CF.surface(Object.assign({
    deniedDesc:L('Contact the platform provider to check the delivered configuration.','请联系平台建设方核对交付配置。'),
    backTo:ROOT,backLabel:L('Back to the review queue','返回项目审核队列'),skelRows:5},opts));}
  function inDay(t,day,end){const d=new Date(day+'T00:00:00Z').getTime();return end?t<d+86400000:t>=d;}
  function utcDayStart(t,back=0){const d=new Date(t);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-back);}
  const all=()=>['',L('All','全部')];
  function ownerOptions(){return [all(),...OWNERS.map(([k,label])=>[k,txt(label)])];}
  function tokenOptions(){return [all(),...A.tokenTypes.map(t=>[t,t])];}
  function networkOptions(){return [all(),...Object.keys(NETWORKS).map(k=>[k,network(k)])];}
  function pager(total,st,unit){
    const pages=Math.max(1,Math.ceil(total/CF.PAGE_SIZE));
    return `<div class="pager"><span class="total">${L('Total','共')} ${total} ${txt(unit)} · ${CF.PAGE_SIZE} ${L('per page','条／页')}</span>${b('Previous','上一页','page',String(st.page-1),'sm',st.page===1)}<span>${st.page} / ${pages}</span>${b('Next','下一页','page',String(st.page+1),'sm',st.page===pages)}</div>`;
  }
  function appliedTags(labels,values,applied,keys){
    const on=keys.filter(k=>applied[k]);
    return on.length?`<div class="cm-applied" aria-label="${L('Applied filters','已应用筛选')}">${on.map(k=>CF.tag('gray',labels[k]+': '+(values[k]||applied[k]))).join('')}</div>`:'';
  }
  const shortAddr=v=>v.slice(0,10)+'…'+v.slice(-8);
  function addressValue(value,label,empty){
    if(!value)return empty||unknown();
    return `<span class="cm-address"><span class="mono" title="${E(value)}">${E(shortAddr(value))}</span>${CF.copyBtn('cm-copy',value,L('Copy the full '+label,'复制完整'+label))}</span>`;
  }
  /* 三份合约一张小表：类别 / 合约地址，按需带执行结果与交易凭证。 */
  function contractTable(source,opts={}){
    const head=[L('Contract','合约类别'),L('Contract address','合约地址')];
    if(opts.results)head.push(L('Result','执行结果'));
    if(opts.proofs)head.push(L('Configuration transaction','配置交易凭证'));
    const body=KINDS.map(([k,label])=>{
      const cells=[`<th scope="row">${txt(label)}</th>`,`<td>${source[k]?addressValue(source[k],L('address','地址')):notAvailable()}</td>`];
      if(opts.results){const v=RESULT[opts.results[k]||'unknown'];cells.push(`<td>${CF.tag(v[2],txt(v))}</td>`);}
      if(opts.proofs)cells.push(`<td>${addressValue(opts.proofs[k],L('evidence','凭证'),opts.proofEmpty?txt(opts.proofEmpty):'')}</td>`);
      return `<tr>${cells.join('')}</tr>`;
    }).join('');
    return `<div class="cm-ctable-wrap" tabindex="0" role="region" aria-label="${L('Contract addresses and configuration results','合约地址与配置结果')}"><table class="tbl cm-ctable${opts.proofs?' cm-ctable-proofs':''}"><thead><tr>${head.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  /* ---------------------------------------------------------------- 项目审核队列 */
  function queueScope(ignoreState){
    const f=A.queue.filter;
    return A.rows.filter(r=>(!f.owner||r.owner===f.owner)&&(!f.token||r.tokenType===f.token)&&(!f.network||r.network===f.network)
      &&(!f.from||inDay(r.submittedAt,f.from))&&(!f.to||inDay(r.submittedAt,f.to,true))
      &&(!f.q||[r.id,projectName(r),ownerName(r),...(r.exec==='success'?Object.values(r.attempt.picks):[])].join(' ').toLowerCase().includes(f.q.trim().toLowerCase()))
      &&(ignoreState||((!f.review||r.review===f.review)&&(!f.exec||r.exec===f.exec)
        &&!(r.closed&&f.review==='pending'))));
  }
  function queueFilters(){
    const f=A.queue.edit,applied=A.queue.filter;
    const extra=['exec','owner','token','network','from','to'],count=extra.filter(k=>applied[k]).length;
    const labels={exec:L('Configuration status','配置执行状态'),owner:L('Project publisher','项目发布方'),token:L('Token type','代币类型'),
      network:L('Blockchain network','区块链网络'),from:L('Submitted from','提交开始日期'),to:L('Submitted through','提交结束日期')};
    const values={exec:applied.exec?txt(EXEC[applied.exec]):'',owner:applied.owner?ownerName({owner:applied.owner}):'',token:applied.token,network:applied.network?network(applied.network):''};
    return `<form id="cm-filter-form" class="cm-filter-wrap"><div class="filterbar ops-filterbar cm-toolbar">
      ${CF.opsFilterSelect('cm-f-review',L('Review status','审核轴'),[all(),...Object.entries(REVIEW).map(([k,v])=>[k,txt(v)])],f.review)}
      ${sortControl()}
      <button type="button" class="btn" data-act="cm-filters" aria-expanded="${A.queue.open}" aria-controls="cm-advanced">${L('More filters','更多筛选')}${count?' ('+count+')':''} <span aria-hidden="true">${A.queue.open?'⌃':'⌄'}</span></button>
      ${CF.filterSearch('cm-f-q',L('Search projects','搜索项目'),f.q,L('Project number, project name, company or contract address','项目编号、项目名称、企业名称或合约地址'), 'ops-filter-query')}
      <div class="fb-acts">${b('Reset','重置','reset')}<button type="submit" class="btn primary">${L('Search','查询')}</button></div></div>
      <div id="cm-advanced" class="cm-filters ops-filter-fields" ${A.queue.open?'':'hidden'}>${field(labels.exec,select('cm-f-exec',f.exec,[all(),...Object.entries(EXEC).map(([k,v])=>[k,txt(v)])]))}${field(labels.owner,select('cm-f-owner',f.owner,ownerOptions()))}${field(labels.token,select('cm-f-token',f.token,tokenOptions()))}${field(labels.network,select('cm-f-network',f.network,networkOptions()))}${field(labels.from+' (UTC)',input('cm-f-from',f.from,'date'))}${field(labels.to+' (UTC)',input('cm-f-to',f.to,'date'))}</div>
      ${appliedTags(labels,values,applied,extra)}</form>`;
  }
  function sortButton(k,en,zh,st){
    const on=st.sort?st.sort===k:true;
    return `<button data-act="cm-sort" data-v="${k}">${L(en,zh)} ${on?(st.dir===1?'↑':'↓'):'↕'}</button>`;
  }
  const ariaSort=(on,dir)=>on?(dir===1?'ascending':'descending'):'none';
  function queue(){
    const blocked=gate();
    if(blocked)return title(L('Project reviews','项目审核队列'))+blocked;
    const scope=queueScope(true),start=utcDayStart(now(),6);
    const pending=scope.filter(r=>r.review==='pending'&&!r.closed);
    const counts=[pending.length,pending.filter(r=>r.exec==='failed').length,
      scope.filter(r=>{const at=lastDecision(r);return at!=null&&at>=start;}).length];
    const shown=i=>['loading','error'].includes(A.view)?'—':A.view==='empty'?0:counts[i];
    const metrics=`<div class="cm-summary-row"><div class="stat-strip cm-metrics"><div class="s"><div class="k">${L('Pending review','待审核')}</div><div class="v">${shown(0)} <span class="u">${L('projects','个项目')}</span><span class="cm-metric-sub">${L('Of which: configuration failed, awaiting a new attempt','其中：配置失败待再次发起')} <b>${shown(1)}</b></span></div></div><div class="s"><div class="k">${L('Decided · last 7 UTC days','近 7 个自然日人工审结（UTC）')}</div><div class="v">${shown(2)} <span class="u">${L('projects','个项目')}</span></div></div></div><details class="cm-summary-help"><summary>${L('Summary scope','统计口径')}</summary><p>${L('Summary uses the project publisher, token type, blockchain network, submission dates and keyword filters. The review status and configuration status filters do not change it; a failed configuration is not a manual decision.','统计应用项目发布方、代币类型、区块链网络、提交时间及关键词条件，不受审核轴与配置执行状态筛选影响；配置失败不计入人工审结。')}</p></details></div>`;
    const state=A.view==='default'?null:surface({emptyTitle:L('No projects awaiting review','暂无待审核项目'),
      emptyDesc:L('Projects appear here once an asset holder submits one for review.','资产方提交审核后，项目将出现在此。')});
    let found=queueScope(false);
    found.sort((a,c)=>{
      const value=r=>r.submittedAt;
      return (value(a)-value(c))*A.queue.dir||a.id.localeCompare(c.id);
    });
    const pages=Math.max(1,Math.ceil(found.length/CF.PAGE_SIZE));
    if(A.queue.page>pages){A.queue.page=pages;A.error=['The previous page is empty; showing the last available page.','原页已无记录，已返回最后有效页。'];}
    const rows=found.slice((A.queue.page-1)*CF.PAGE_SIZE,A.queue.page*CF.PAGE_SIZE);
    const st=A.queue;
    const table=state||(!found.length
      ?CF.empty(L('No projects found','暂无符合条件的项目'),L('Change the filters or return to the pending reviews.','调整筛选条件，或返回待审核队列。'),b('Reset filters','重置筛选','reset'))
      :`<div class="tablewrap cm-table-region" tabindex="0" role="region" aria-label="${L('Project reviews table','项目审核队列表格')}"><table class="tbl cm-table cm-queue-table"><thead><tr><th>${L('Blockchain network','区块链网络')}</th><th>${L('Project number / name','项目编号 / 项目名称')}</th><th>${L('Project publisher','项目发布方')}</th><th>${L('Token type','代币类型')}</th><th>${L('Pledge ratio / term','项目质押率 / 项目期限')}</th><th aria-sort="${ariaSort(st.sort==='submittedAt',st.dir)}">${sortButton('submittedAt','Submitted','本次提交时间',st)}${columnZone()}</th><th>${L('Review status','审核轴')}</th><th>${L('Configuration / pledge contract','配置执行状态 / 质押合约地址')}</th><th class="col-act">${L('Action','操作')}</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${networkValue(r.network)}</td><td><strong class="mono">${E(r.id)}</strong><span class="cm-meta">${E(projectName(r))}</span></td><td>${E(ownerName(r))}</td><td>${E(r.tokenType)}</td><td>${pct(r.ratio)}<span class="cm-meta">${E(utcDay(r.createdAt))} ～<br>${E(utcDay(expiry(r)))} (UTC)</span></td><td>${listTime(r.submittedAt)}<span class="cm-meta">${E(submission(r.seq))}</span></td><td>${reviewBadge(r)}</td><td>${execBadge(r)}${r.exec==='success'?`<span class="cm-meta mono">${E(shortAddr(r.attempt.picks.pledge))}</span>`:''}</td><td class="col-act">${viewLink(r.id,'queue')}</td></tr>`).join('')}</tbody></table></div>${pager(found.length,A.queue,['projects','个项目'])}`);
    return listHeading('queue')+metrics
      +`<section class="card">${queueFilters()}<div class="cm-section" ${A.error?'':'hidden'}>${error()}</div>${table}</section>`;
  }

  /* ---------------------------------------------------------------- 共用合约台账 */
  function ledgerScope(){
    const f=A.ledger.filter,q=f.q.trim().toLowerCase();
    return A.sets.filter(s=>(!f.token||s.tokenType===f.token)&&(!f.network||s.network===f.network)
        &&(!q||[s.pledge,s.loan,s.repay].filter(Boolean).join(' ').toLowerCase().includes(q)))
      .sort((a,c)=>a.tokenType.localeCompare(c.tokenType)||a.network.localeCompare(c.network));
  }
  function ledgerFilters(){
    const f=A.ledger.edit;
    return `<form id="cm-filter-form" class="cm-filter-wrap"><div class="filterbar ops-filterbar cm-toolbar">
      ${CF.opsFilterSelect('cm-f-token',L('Token type','代币类型'),tokenOptions(),f.token)}
      ${CF.opsFilterSelect('cm-f-network',L('Blockchain network','区块链网络'),networkOptions(),f.network)}
      ${CF.filterSearch('cm-f-q',L('Search contracts','搜索合约'),f.q,L('Any contract address','任一合约地址'), 'ops-filter-query')}
      <div class="fb-acts">${b('Reset','重置','reset')}<button type="submit" class="btn primary">${L('Search','查询')}</button></div></div></form>`;
  }
  function projectState(r){
    return r.closed?CF.tag('gray',L('Closed · ','已关闭 · ')+closeReason(r))
      :r.review==='approved'?CF.tag('ok',L('Open · empty pool','可用 · 空池'))
      :r.review==='returned'?CF.tag('danger',L('Returned','已退回')):CF.tag('warn',L('Pending review','待审核'));
  }
  /* 一套合约上配置成功的项目；配置处理中、失败、待核实的不在其中。 */
  function setProjects(set){
    const st=A.ledger;
    const found=configured(set).sort((a,c)=>(configAt(a)-configAt(c))*st.dir||a.id.localeCompare(c.id));
    const body=!found.length?`<p class="cm-meta">${L('No project is configured on this set yet.','这套合约上暂无已配置项目。')}</p>`
      :`<div class="tablewrap cm-table-region" tabindex="0" role="region" aria-label="${L('Configured projects','已配置项目')}"><table class="tbl cm-table cm-set-table"><thead><tr><th>${L('Project number / name','项目编号 / 项目名称')}</th><th>${L('Project publisher','项目发布方')}</th><th aria-sort="${ariaSort(true,st.dir)}">${sortButton('configuredAt','Configuration completed at','合约配置完成时间',st)}${columnZone()}</th><th>${L('Reviewer','审核人')}</th><th>${L('Project status','项目当前状态')}</th><th class="col-act">${L('Action','操作')}</th></tr></thead><tbody>${found.map(r=>`<tr><td><strong class="mono">${E(r.id)}</strong><span class="cm-meta">${E(projectName(r))}</span></td><td>${E(ownerName(r))}</td><td>${listTime(configAt(r))}</td><td>${r.reviewer?E(txt(r.reviewer)):unknown()}</td><td>${projectState(r)}</td><td class="col-act">${viewLink(r.id,'ledger')}</td></tr>`).join('')}</tbody></table></div>`;
    return `<section class="card cm-section cm-set-panel" id="cm-set-panel" tabindex="-1" aria-labelledby="cm-set-title"><div class="cm-set-head"><h2 class="cm-h2" id="cm-set-title">${comboValue(set)} · ${L('Configured projects','已配置项目')} ${found.length}</h2>${b('Collapse','收起','set','','sm')}</div>${body}</section>`;
  }
  function ledger(){
    const blocked=gate();
    if(blocked)return title(L('Shared contract ledger','共用合约台账'))+blocked;
    const state=A.view==='default'?null:surface({emptyTitle:L('No shared contracts yet','暂无共用合约'),
      emptyDesc:L('Shared contracts appear here once they are released with a platform version.','共用合约随平台版本发布后将出现在此。'),
      backTo:LEDGER,backLabel:L('Back to the ledger','返回台账')});
    const found=ledgerScope();
    const pages=Math.max(1,Math.ceil(found.length/CF.PAGE_SIZE));
    if(A.ledger.page>pages)A.ledger.page=pages;
    const rows=found.slice((A.ledger.page-1)*CF.PAGE_SIZE,A.ledger.page*CF.PAGE_SIZE);
    const cell=(v)=>v?addressValue(v,L('address','地址')):notAvailable();
    const table=state||(!found.length
      ?CF.empty(L('No contracts found','暂无符合条件的合约'),L('Change the filters or clear them to see every shared contract set.','调整或清空筛选条件，查看全部共用合约。'),b('Reset filters','重置筛选','reset'))
      :`<div class="tablewrap cm-table-region" tabindex="0" role="region" aria-label="${L('Shared contract ledger table','共用合约台账表格')}"><table class="tbl cm-table cm-ledger-table"><thead><tr><th>${L('Blockchain network','区块链网络')}</th><th>${L('Token type','代币类型')}</th><th>${L('Pledge contract','质押合约')}</th><th>${L('Loan contract','放款合约')}</th><th>${L('Repayment contract','还款合约')}</th><th>${L('Configured projects','已配置项目数')}</th><th class="col-act">${L('Action','操作')}</th></tr></thead><tbody>${rows.map(s=>{
        const gap=missingKinds(s),on=A.ledger.set===s.id;
        return `<tr${on?' class="cm-row-on"':''}><td>${networkValue(s.network)}</td><td><strong>${E(s.tokenType)}</strong>${gap.length?`<span class="cm-meta cm-warn-text">${L('Projects of this combination cannot be approved yet.','该组合的项目暂不能通过')}</span>`:''}</td><td>${cell(s.pledge)}</td><td>${cell(s.loan)}</td><td>${cell(s.repay)}</td><td class="cm-num">${configured(s).length}</td><td class="col-act"><button type="button" class="actlink" data-act="cm-set" data-v="${E(s.id)}" aria-expanded="${on}" aria-controls="cm-set-panel">${L('Projects','查看项目')}</button></td></tr>`;}).join('')}</tbody></table></div>${pager(found.length,A.ledger,['sets','套'])}`);
    const selected=!state&&A.ledger.set&&found.some(s=>s.id===A.ledger.set)?setProjects(setById(A.ledger.set)):'';
    return listHeading('ledger')
      +`<section class="card">${ledgerFilters()}<div class="cm-section" ${A.error?'':'hidden'}>${error()}</div>${table}</section>${selected}`;
  }

  /* ---------------------------------------------------------------- 操作记录 */
  const TONE={'config-ok':'ok','return':'danger','config-fail':'danger','config-unknown':'warn','close':'gray','expire-close':'gray'};
  function activity(r){
    const heading=`<h2 class="cm-h2" id="cm-activity-title">${L('Activity','操作记录')}</h2>`;
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
          const occurred=e.at?`<time datetime="${E(new Date(e.at).toISOString())}">${time(e.at)}</time>`:`<span>${L('Time: to be verified','发生时间：待核实')}</span>`;
          const detail=(e.text?`<p>${E(txt(e.text))}</p>`:'')
            +(e.picks?contractTable(e.picks,{results:e.results,proofs:e.proofs||{},proofEmpty:['None yet','暂无']}):'')
            +(e.notice?kv([[L('Message sent to the asset holder','已向资产方发送站内信'),E(txt(e.notice))]]):'');
          return `<li class="cm-event" data-tone="${TONE[e.kind]||'neutral'}"><h3>${E(txt(e.title))}</h3><div class="cm-event-meta"><span>${e.actor?E(txt(e.actor)):L('Actor: to be verified','操作主体：待核实')}</span>${occurred}</div><p class="cm-event-result">${E(txt(e.result||['Recorded','已记录']))}</p>${detail?`<details><summary aria-label="${E(L('View details: ','查看详情：')+txt(e.title))}">${L('View details','查看详情')}</summary><div class="cm-event-detail">${detail}</div></details>`:''}</li>`;
        }).join('')}</ol>`;
    }
    return `<section class="card cm-section cm-activity" id="cm-activity" tabindex="-1" aria-labelledby="cm-activity-title">${heading}${body}</section>`;
  }

  /* ---------------------------------------------------------------- 审核详情 */
  function createdInfo(r){
    return section('Project details under review','创建信息核对',facts([
      [L('Blockchain network','区块链网络'),networkValue(r.network)],
      [L('Project name','项目名称'),E(projectName(r))],
      [L('Token type','代币类型'),E(r.tokenType)],
      [L('Project pledge ratio','项目质押率'),pct(r.ratio)],
      [L('Project term','项目期限'),E(termRange(r))],
      [L('Preferred settlement currency','参考结算币种'),E(r.settleCcy)+`<span class="cm-meta">${L('For reference only; it does not limit the currency a funder quotes in.','只供参考，不限制资金方报价币种')}</span>`],
      [L('Repayment method','还款方式'),txt(REPAYMENT)+`<span class="cm-meta">${L('Platform default','平台定值')}</span>`],
      [L('SPV name','SPV机构名称'),`<span class="mono">${E(r.spv)}</span>`]
    ]));
  }
  function contextCard(r){
    const c=tokenConfig(r),ok=A.config.available&&!!c;
    const ratioGap=ok&&r.ratio>c.maxRatio;
    const termGap=ok&&expiry(r)>addMonths(r.createdAt,c.maxTermMonths);
    const current=v=>ok?v:CF.tag('warn',unknown());
    const gap=CF.tag('warn',L('Differs from the locked value','与锁定值不一致'));
    return section('Project publisher and parameter context','项目发布方与参数上下文',facts([
      [L('Project publisher','项目发布方'),E(ownerName(r))],
      [L('Stable entity identifier','稳定主体标识'),r.entity?`<span class="mono">${E(r.entity)}</span>`:CF.tag('warn',unknown())],
      [L('Pledge ratio · latest submission','项目质押率 · 最近一次提交'),pct(r.ratio)],
      [L('Maximum pledge ratio · current configuration','最高质押率 · 当前配置'),current(ok?pct(c.maxRatio):'')+(ratioGap?gap:'')],
      [L('Project term · latest submission','项目期限 · 最近一次提交'),E(termRange(r))],
      [L('Maximum project term · current configuration','最长项目期限 · 当前配置'),current(ok?months(c.maxTermMonths):'')+(termGap?gap:'')],
      [L('Configuration read at','配置取数时点'),ok?time(A.config.readAt):unknown(),true]
    ]));
  }
  /* 待审核或已退回到达有效期至时自动关闭；配置处理中跨过有效期至的，等回写后按结果处理。 */
  function closeOnExpiry(r){
    if(r.closed)return;
    const before=REVIEW[r.review];
    r.closed=true;r.closeReason='expired';r.expiryPassed=false;
    event(r,'expire-close',['Project closed on expiry','项目到期自动关闭'],[before[0]+' · project closed',before[1]+' · 项目已关闭']);
  }
  /* 合约区块：待审核时列出适用的共用合约（配置失败后由最近一次所选合约代替，不重复列出）；成功后为所配置的合约。 */
  function contractCard(r){
    const set=setOf(r),at=r.attempt;
    const pendingOpen=r.review==='pending'&&!r.closed;
    if(!pendingOpen&&!at)return '';
    const sub=(en,zh)=>`<h3 class="cm-h3">${L(en,zh)}</h3>`;
    const ledgerLink=id=>` <a class="cm-inline-link" href="#${E(LEDGER+'?set='+id)}" data-act="cm-ledger-set" data-v="${E(id)}">${L('View in the ledger','在台账中查看')}</a>`;
    let html='';
    if(r.exec==='success'){
      return section('Configured contracts','所配置的合约',
        facts([
          [L('Applicable combination','适用组合'),comboValue(r)+ledgerLink(at.set)],
          [L('Configuration completed at','合约配置完成时间'),time(at.at)]
        ])+contractTable(at.picks,{proofs:at.proofs}));
    }
    if(pendingOpen){
      const gap=missingKinds(set);
      html+=sub('Applicable shared contracts','适用的共用合约')
        +facts([[L('Applicable combination','适用组合'),comboValue(r)+(set?ledgerLink(set.id):'')],
          [L('Configured projects','已配置项目数'),set?String(configured(set).length):'0']])
        +(at?'':contractTable(set||{}))
        +(gap.length?note(L('Missing: ','缺少')+gap.join(L(', ','、'))+L('. This project cannot be approved yet.','，本项目暂不能通过。'),'warn'):'');
    }
    if(at){
      const results=r.exec==='failed'?r.fail?.results||{}
        :{pledge:r.exec,loan:r.exec,repay:r.exec};
      html+=sub('Latest configuration attempt','最近一次配置')
        +contractTable(at.picks,{results:Object.fromEntries(KINDS.map(([k])=>[k,results[k]==='none'?'unknown':results[k]])),proofs:at.proofs,proofEmpty:['None yet','暂无']})
        +(r.exec==='failed'&&r.fail?facts([
          [L('Failure reason','配置失败原因'),`<div class="cm-quote">${E(txt(r.fail.reason))}</div>`,true],
          [L('Failed at','失败时点'),time(r.fail.at)]
        ]):'');
    }
    return section('Contracts','合约配置',html);
  }
  function actionCard(r){
    const gap=missingKinds(setOf(r));
    const status=!canDecide()
      ?L('View access only.','当前仅有查询权限，不能处置。')
      :r.closed?(r.closeReason==='expired'?L('Closed on expiry. It can no longer be decided or configured.','项目已到期自动关闭，不能裁定或发起配置。'):L('Closed by the asset holder. It can no longer be decided.','资产方已关闭该项目，不能裁定。'))
      :r.review==='approved'?L('Approved. The conclusion and the contracts cannot be changed.','已通过，结论与所配置的合约不可更改。')
      :r.review==='returned'?L('Returned. Waiting for the applicant to revise and resubmit.','已退回，等待申请方修改后重新提交。')
      :r.exec==='processing'?(r.expiryPassed?L('Configuration in progress. The valid-until date has passed; the project is handled by the result.','配置处理中，已跨过有效期至，结果回写后按结果处理。'):L('Configuration in progress. Actions are unavailable until the result arrives.','配置处理中，结果回写前不可处置。'))
      :r.exec==='unknown'?L('The configuration result is being verified. Actions are unavailable until it is written back; contact the platform provider to check.','配置结果待核实，回写前不可处置。如需核实，请联系平台建设方。')
      :gap.length?L('Missing ','缺少')+gap.join(L(', ','、'))+L('. Approval is unavailable; you can return it or handle it later.','，暂不能通过，可退回或稍后办理。')
      :!r.entity?L('The stable entity identifier is to be verified. Approval is unavailable; you can return it.','稳定主体标识待核实，暂不能通过，可退回。')
      :r.exec==='failed'?L('The last configuration failed. Start it again or return the application.','最近一次配置失败，可再次发起或退回。')
      :'';
    let actions='';
    if(canDecide()){
      const again=r.exec==='failed';
      actions=`<div class="cm-stack">${b(again?'Start the configuration again':'Approve and configure contracts',again?'再次发起配置':'通过并配置合约',again?'reconfig':'approve','','primary',!canApprove(r))}${b('Return','退回','return','','',!canAct(r))}</div>`;
    }
    return section('Review actions','审核处理',`${status?`<p class="cm-rail-status">${status}</p>`:''}${actions}`);
  }
  /* 每次结论的审核人与结论时间；通过的结论时间即合约配置完成时间。 */
  function conclusion(r){
    if(!['approved','returned'].includes(r.review)||!r.decisionAt)return '';
    return `<span class="cm-meta">${r.reviewer?E(txt(r.reviewer)):unknown()} · ${time(r.decisionAt)}</span>`;
  }
  function detail(){
    const blocked=gate();
    if(blocked)return title(L('Project review','项目审核详情'))+blocked;
    const r=row();
    if(!r)return CF.empty(L('Project unavailable','项目不可用'),L('Return to the review queue.','请返回项目审核队列。'),b('Back','返回','back'));
    if(A.view!=='default')return title(E(r.id))+surface({});
    const heading=`<header class="cm-detail-heading"><h1>${E(r.id)}</h1><p class="cm-detail-name">${E(projectName(r))}</p>${CF.tag('gray',L('Demonstration data','演示数据'))}</header>`;
    const summary=`<dl class="cm-detail-summary"><div><dt>${L('Review status','审核轴')}</dt><dd>${reviewBadge(r)}${conclusion(r)}</dd></div><div><dt>${L('Configuration status','配置执行状态')}</dt><dd>${execBadge(r)}</dd></div><div><dt>${L('This submission','本次提交')}</dt><dd><strong class="cm-value">${E(submission(r.seq))}</strong><span class="cm-meta">${time(r.submittedAt)}</span></dd></div><div><dt>${L('Project status for the asset holder','面客项目状态')}</dt><dd>${projectState(r)}</dd></div></dl>`;
    return heading+(A.draft?'':error())+summary
      +`<div class="cm-grid"><div class="cm-detail-main"><div class="detail-stack cm-stack">${createdInfo(r)}${contextCard(r)}${contractCard(r)}${activity(r)}</div></div><aside class="cm-stack cm-rail">${actionCard(r)}</aside></div>`;
  }

  /* ---------------------------------------------------------------- 办理 */
  function identity(r){
    return `<div class="cm-quote">${E(r.id)} · ${E(projectName(r))}<span class="cm-meta">${E(ownerName(r))} · ${E(submission(r.seq))}</span></div>`;
  }
  function start(mode){
    const r=row();
    if(mode==='return'?!canAct(r):!canApprove(r))return deny();
    A.draft={id:r.id,mode,reason:'',ack:false,picks:{pledge:'',loan:'',repay:''}};A.error='';
    open(mode==='return'?'return':'approve');
  }
  function validate(){
    const d=A.draft;if(!d)return false;A.error='';
    if(d.mode==='return'){
      const s=d.reason.trim(),n=Array.from(s).length;
      if(n<10||n>500||!/[\p{L}\p{N}]/u.test(s))A.error=['Enter a reason of 10–500 characters; punctuation alone is not valid.','原因需为 10～500 字，不能仅填标点。'];
    }else{
      const gap=KINDS.filter(([k])=>!d.picks[k]).map(([,label])=>txt(label));
      if(gap.length)A.error=['Select: '+gap.join(', ')+'.','请选定'+gap.join('、')+'。'];
      else if(!d.ack)A.error=['Confirm that you understand the effect of this approval.','请确认知悉本次通过的后果。'];
    }
    return !A.error;
  }
  function beginConfig(r,again,picks){
    const set=setOf(r);
    r.review='configuring';r.exec='processing';r.submitter=OPERATOR;r.fail=null;
    r.attempt={set:set.id,picks:{...picks},startedAt:now(),at:null,proofs:{pledge:null,loan:null,repay:null}};
    event(r,again?'reconfig':'approve-init',
      again?['Configuration started again','再次发起配置']:['Approval submitted · configuration initiated','提交通过并发起配置'],
      ['Pending review → Configuration in progress','待审核 → 配置处理中'],
      {actor:OPERATOR,picks:{...picks}});
  }
  function applyReturn(r,reason,other){
    r.review='returned';r.exec='none';r.decisionAt=now();
    r.reviewer=other?['Demo reviewer Chen','示例审核员陈']:OPERATOR;
    r.returnReason=reason;r.attempt=null;r.fail=null;
    event(r,'return',['Returned','审核退回'],['Pending review → Returned','待审核 → 已退回'],
      {actor:r.reviewer,text:reason,notice:['Project review returned','项目审核退回']});
    A.notices.push({id:r.id,kind:['Project review returned','项目审核退回']});
  }
  function submit(){
    const d=A.draft,r=row();
    if(A.busy)return;
    if(!d||d.id!==r?.id)return deny();
    if(d.mode==='return'?!canAct(r):!canApprove(r))return deny();
    if(!validate()){open(d.mode==='return'?'return':'approve');return;}
    /* 候选只来自本项目适用组合的那套合约；其他组合的合约不能被选入。 */
    if(d.mode!=='return'){const set=setOf(r);if(KINDS.some(([k])=>d.picks[k]!==set[k]))return deny();}
    A.busy=true;A.error='';CF.render();
    const epoch=A.epoch,response=A.response;
    setTimeout(()=>{
      if(epoch!==A.epoch||A.draft!==d)return;
      A.busy=false;
      if(d.mode==='return'?!canAct(r):!canApprove(r))return deny();
      if(response==='fail'){
        A.error=['The submission could not be saved. Your input is preserved.','提交未能保存，已保留填写内容，请重试。'];
        open(d.mode==='return'?'return':'approve');return;
      }
      if(response==='concurrent'){
        applyReturn(r,['Another reviewer returned this project: the project details need further confirmation by the asset holder.','另一名审核员已退回本项目：创建信息尚需资产方进一步确认。'],true);
        A.draft=null;S.layer=null;
        A.error=['Another reviewer has decided this project. The current conclusion is shown.','本项目已由其他审核员裁定，已显示当前结论。'];
        CF.render();return;
      }
      if(response==='expired'||isExpired(r)){
        closeOnExpiry(r);
        A.error=['The project has expired and was closed automatically. This submission did not stand.','项目已到期并自动关闭，本次提交未成立。'];
        open(d.mode==='return'?'return':'approve');return;
      }
      if(response==='closed'){
        /* 与资产方关闭同时发生、关闭先生效：本次办理就地拒绝，不形成结论、不发起配置。 */
        r.closed=true;r.closeReason='owner';
        event(r,'close',['Project closed by the asset holder','资产方关闭项目'],[REVIEW[r.review][0]+' · project closed',REVIEW[r.review][1]+' · 项目已关闭'],{actor:['Asset holder','资产方']});
        A.error=['The asset holder closed the project first. This submission did not stand.','资产方已先关闭项目，本次提交未成立。'];
        open(d.mode==='return'?'return':'approve');return;
      }
      if(d.mode==='return'){
        applyReturn(r,[d.reason.trim(),d.reason.trim()]);
        A.draft=null;S.layer=null;saveContext();CF.render();
        CF.toast(L('The application has been returned.','已退回该申请。'));return;
      }
      beginConfig(r,d.mode==='reconfig',d.picks);
      A.draft=null;S.layer=null;saveContext();CF.render();
      CF.toast(L('Submitted. The contracts are being configured on chain.','已提交，合约配置处理中。'));
    },650);
  }
  /* 链上回写：三份都成功即审核通过；任一份失败即配置失败，回到待审核；长期无结果标待核实。 */
  function writeBack(kind){
    const r=row();
    if(!r||r.exec!=='processing')return;
    const tail=r.key+String(r.events.length);
    const pf=k=>'0xDEMO'+'0'.repeat(56)+tail.padStart(4,'0').slice(-4)+{pledge:'P',loan:'L',repay:'R'}[k]+'1';
    if(kind==='success'){
      r.exec='success';r.review='approved';r.decisionAt=now();
      r.reviewer=r.submitter||OPERATOR;
      r.attempt.at=now();r.attempt.proofs={pledge:pf('pledge'),loan:pf('loan'),repay:pf('repay')};
      event(r,'config-ok',['Configuration succeeded (review approved)','配置成功（即审核通过）'],['Configuration in progress → Approved','配置处理中 → 已通过'],
        {picks:{...r.attempt.picks},proofs:{...r.attempt.proofs},notice:['Project review approved','项目审核通过']});
      A.notices.push({id:r.id,kind:['Project review approved','项目审核通过']});
      if(r.expiryPassed)closeOnExpiry(r);
    }else if(kind==='failed'){
      const reason=['The configuration transaction for the loan contract was reverted on chain.','放款合约的配置交易在链上执行失败（交易回滚）。'];
      const results={pledge:'success',loan:'failed',repay:'unknown'};
      r.exec='failed';r.review='pending';
      r.attempt.proofs={pledge:pf('pledge'),loan:pf('loan'),repay:null};
      r.fail={reason,at:now(),results};
      event(r,'config-fail',['Configuration failed','配置失败'],['Configuration in progress → Pending review','配置处理中 → 待审核'],
        {picks:{...r.attempt.picks},proofs:{...r.attempt.proofs},results,text:reason});
      if(r.expiryPassed)closeOnExpiry(r);
    }else{
      r.exec='unknown';
      event(r,'config-unknown',['Configuration result to be verified','结果待核实'],['No confirmed on-chain result','尚无确定的链上结果'],
        {picks:{...r.attempt.picks},proofs:{...r.attempt.proofs}});
    }
    CF.render();
  }

  /* ---------------------------------------------------------------- 弹层 */
  function approveLayer(){
    const d=A.draft,r=row();
    if(!d||!r)return {title:L('Unavailable','不可用'),html:'',foot:b('Close','关闭','cancel')};
    const again=d.mode==='reconfig',set=setOf(r)||{};
    const failure=again&&r.fail?note(L('The last configuration failed: ','最近一次配置失败：')+txt(r.fail.reason),'warn'):'';
    const picks=KINDS.map(([k,label])=>field(txt(label)+' *',select('cm-pick-'+k,d.picks[k],[['',L('Select','请选择')],...(set[k]?[[set[k],set[k]]]:[])],'aria-required="true"'))).join('');
    const ack=L('I understand: a successful configuration is the approval itself and cannot be withdrawn.','我已知悉：配置成功即审核通过，不可撤销。');
    return {title:again?L('Start the configuration again','再次发起配置'):L('Approve and configure contracts','通过并配置合约'),
      html:`<div class="cm-form">${identity(r)}<fieldset ${A.busy?'disabled':''}>${failure}${kv([[L('Applicable combination','适用组合'),comboValue(r),true]])}<div class="cm-picks">${picks}</div><label class="cm-ack"><input id="cm-ack" aria-required="true" type="checkbox" ${d.ack?'checked':''}> ${CF.fieldLabel(ack,true)}</label></fieldset><div id="cm-form-error">${error()}</div>${A.busy?'<p role="status">'+L('Submitting…','正在提交…')+'</p>':''}</div>`,
      foot:b('Cancel','取消','cancel','','',A.busy)+b('Confirm and submit','确认提交','submit','','primary',A.busy||r.closed)};
  }
  function returnLayer(){
    const d=A.draft,r=row();
    if(!d||!r)return {title:L('Unavailable','不可用'),html:'',foot:b('Close','关闭','cancel')};
    return {title:L('Return','退回'),
      html:`<div class="cm-form">${identity(r)}<fieldset ${A.busy?'disabled':''}>${field(L('Reason shown to the applicant *','向申请方展示的退回原因 *'),`<textarea class="inp" id="cm-reason" aria-required="true" aria-invalid="${!!A.error}" aria-describedby="cm-form-error">${E(d.reason)}</textarea><span class="cm-meta">${Array.from(d.reason.trim()).length} / 500 · ${L('Minimum 10 characters','至少 10 字')}</span>`)}</fieldset><div id="cm-form-error">${error()}</div></div>`,
      foot:b('Cancel','取消','cancel','','',A.busy)+b('Review the reason','核对原因','confirm','','primary',A.busy||r.closed)};
  }
  const layers={
    'cm-approve':approveLayer,
    'cm-return':returnLayer,
    'cm-return-confirm':()=>({title:L('Confirm the return','确认退回'),
      html:identity(row())+`<div class="cm-section"><div class="cm-quote">${E((A.draft?.reason||'').trim())}</div><p class="cm-meta">${L('The full reason will be sent to the applicant, who can revise and resubmit.','退回原因将全文发送给申请方，可修改后重新提交。')}</p>${A.busy?'<p role="status">'+L('Submitting…','正在提交…')+'</p>':''}</div>`,
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
    const r=row(),processing=r?.exec==='processing';
    return `<h3>${L('Project contracts · demo tools','项目合约管理 · 演示工具')}</h3><p class="cm-meta">${L('Local demonstration only. On-chain configuration, result write-back and messages are simulated.','仅本地演示：链上配置、结果回写与站内信均为模拟。')}</p>
      <h4>${L('Account configuration · later-role preview','账号配置 · 后期角色预演')}</h4><div class="cm-demo-actions">${b('Administrator','运营管理员','grant','admin')}${b('Later role · no access','后期角色 · 未开通本模块','grant','none')}${b('Later role · query only','后期角色 · 仅开通审核查询','grant','query')}${b('Later role · decision only','后期角色 · 仅开通审核处置','grant','decide')}${b('Later role · query + decision','后期角色 · 查询＋处置','grant','full')}</div>
      <div class="cm-demo">${field(L('Page state','页面状态'),select('cm-view',A.view,[['default',L('Default','默认')],['loading',L('Loading','加载中')],['empty',L('Empty','空数据')],['noresult',L('No results','筛选无结果')],['error',L('Load failed','读取失败')]]))}${field(L('Submit response','提交反馈'),select('cm-response',A.response,[['success',L('Success','成功')],['fail',L('Failure','失败')],['concurrent',L('Another reviewer wins','已被他人裁定')],['closed',L('Asset holder’s close takes effect first','资产方关闭先于本次提交生效')],['expired',L('Project has expired at submission','提交时项目已到期')]]))}${field(L('Activity state','操作记录状态'),select('cm-activity-state',A.activityState,[['default',L('Default','默认')],['loading',L('Loading','加载中')],['empty',L('Empty','暂无记录')],['error',L('Load failed','加载失败')]]))}${field(L('Parameter configuration','融资参数配置'),select('cm-config',A.config.available?'on':'off',[['on',L('Readable','可读')],['off',L('Unavailable','不可读')]]))}</div>
      <h4>${L('On-chain write-back for this project','本项目的配置结果回写')}</h4><div class="cm-demo-actions">${b('All three succeed','三份都成功','chain-success','','',!processing)}${b('One contract fails','其中一份失败','chain-failed','','',!processing)}${b('Result to be verified','结果待核实','chain-unknown','','',!processing)}${b('Replay the latest event','重放最新事件','replay','','',!r)}</div>
      <h4>${L('Valid-until date','项目有效期')}</h4><div class="cm-demo-actions">${b('Reach the valid-until date','到达有效期至','expire','','',!r||r.closed||r.expiryPassed||!['pending','configuring','returned'].includes(r.review))}</div>
      <h4>${L('Asset holder actions','资产方动作')}</h4><div class="cm-demo-actions">${b('Revise and resubmit','修改后重新提交','resubmit','','',!r||r.review!=='returned'||r.closed)}${b('Close the project','关闭项目','close','','',!r||r.closed||!['pending','configuring','returned'].includes(r.review))}${b('Expire operations session','运营登录失效','expire-session')}${b('Reset demonstration','重置演示','restart')}</div>
      <h4>${L('Messages sent to asset holders','已发送的面客站内信')}</h4><p class="cm-meta">${A.notices.map(n=>E(n.id+' · '+txt(n.kind))).join('<br>')||L('None','暂无')}</p>`;
  }

  /* ---------------------------------------------------------------- 动作 */
  function resetFilter(){
    const st=list();
    if(S.page===LG){st.filter=lDefault();st.edit=lDefault();}
    else{st.filter=qDefault();st.edit=qDefault();st.sort='submittedAt';st.dir=1;st.open=false;}
    st.page=1;A.error='';A.view='default';
    if(S.page!==DT)saveContext();
    CF.render();
  }
  function onAct(act,v,e){
    if(e&&(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)&&['cm-view','cm-go'].includes(act))return false;
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
    else if(act==='ledger-set'){
      /* 从详情进入台账中的对应一套：台账回到默认条件并展开该套的已配置项目。 */
      e?.preventDefault?.();
      A.ledger.filter=lDefault();A.ledger.edit=lDefault();A.ledger.page=1;A.ledger.dir=-1;A.ledger.set=v;
      leave(ledgerRoute());
    }
    else if(act==='set'){
      A.ledger.set=!v||A.ledger.set===v?'':v;A.ledger.dir=-1;saveContext();CF.render();
      if(A.ledger.set)requestAnimationFrame(()=>{const p=$('cm-set-panel');p?.scrollIntoView({block:'nearest'});p?.focus({preventScroll:true});});
      else document.querySelector(`[data-act="cm-set"][data-v="${CSS.escape(v||'')}"]`)?.focus();
    }
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
    else if(act==='approve'||act==='return'||act==='reconfig')start(act);
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
        event(r,'resubmit',['Resubmitted after revision','资产方修改重提'],
          [`Returned → Pending review · submission ${r.seq}`,`已退回 → 待审核 · 第 ${r.seq} 次提交`],{actor:['Asset holder','资产方']});
        CF.render();
      }
    }
    else if(act==='expire'){
      const r=row();
      if(r&&!r.closed){
        if(r.review==='configuring'){r.expiryPassed=true;CF.toast(L('The valid-until date passed during configuration. The project is handled by the result.','配置处理中跨过有效期至：暂不关闭，结果回写后按结果处理。'));}
        else if(['pending','returned'].includes(r.review))closeOnExpiry(r);
        CF.render();
      }
    }
    else if(act==='close'){
      const r=row();
      /* 配置处理中（含结果待核实）资产方不能关闭：关闭被拒，审核轴与项目都不变。 */
      if(r&&!r.closed&&r.review==='configuring'){
        CF.toast(L('The asset holder’s close request was refused: configuration in progress. Nothing changed.','资产方关闭被拒：合约配置处理中，暂不可关闭，项目未变化。'));
        return true;
      }
      if(r&&!r.closed&&['pending','returned'].includes(r.review)){
        r.closed=true;r.closeReason='owner';
        event(r,'close',['Project closed by the asset holder','资产方关闭项目'],[REVIEW[r.review][0]+' · project closed',REVIEW[r.review][1]+' · 项目已关闭'],{actor:['Asset holder','资产方']});
        CF.render();
      }
    }
    else if(act==='restart'){
      A.epoch++;seed=CF.contractSeed();
      A.rows=seed.rows;A.sets=seed.sets;A.tokenTypes=seed.tokenTypes;A.config={...seed.config};
      A.now=seed.now;A.clock=Date.now();A.draft=null;A.busy=false;A.response='success';
      A.activityState='default';A.notices=[];A.ledger.set='';grant('admin');resetFilter();navigateRoute(queueRoute());
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
      if(id.startsWith('cm-pick-'))A.draft.picks[id.slice(8)]=el.value;
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
   [LG,['Shared contract ledger','共用合约台账'],['default','loading','empty','noresult','error',DENIED]],
   [DT,['Project review detail','项目审核详情'],['default','loading','error',DENIED]]].forEach(([id,label,states])=>{
    CF.review.register(id,{
      group:['Project contracts','项目合约管理'],label,states,
      scenarios:()=>id!==DT?[]:[
        ...Object.keys(REVIEW).map(st=>({id:'review-'+st,label:REVIEW[st].slice(0,2),row:A.rows.find(r=>r.review===st)})),
        ...['failed','unknown','success'].map(st=>({id:'exec-'+st,label:EXEC[st].slice(0,2),row:A.rows.find(r=>r.exec===st)}))
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
      navContractDetail:'Project review detail',navContractLedger:'Shared contract ledger'},
    zh:{...OPS.dict.zh,navContracts:'项目合约管理',navContractQueue:'项目审核队列',
      navContractDetail:'项目审核详情',navContractLedger:'共用合约台账'}
  };
  CF.define({...OPS,id:'contract-management',demoOnly:true,reviewToolsInLayer:false,dict,demo,
    content:page=>{
      if(OPS_PAGES.includes(page))return OPS.content(page);
      return page===DT?detail():page===LG?ledger():queue();
    },
    layers:{...OPS.layers,...layers},
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
