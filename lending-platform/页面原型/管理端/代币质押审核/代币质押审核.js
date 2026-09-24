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
  const flags={verify:['Release result to be verified','解押结果待核实'],difference:['Reconciliation discrepancy','对账差异']};
  const holdFilters={held:['Held in contract','占用中'],releasing:['Release in progress','解押处理中'],
    released:['Released','已退回'],verify:['Release result to be verified','解押结果待核实'],
    difference:['Reconciliation discrepancy','对账差异']};
  const categories=[['Ownership or entity in question','代币归属或主体存疑'],['Underlying receivable issue','底层应收账款存在问题'],
    ['Token does not match project','代币与目标项目不匹配'],['Incomplete or inconsistent materials','申请材料不完整或不一致'],
    ['Other','其他']];
  const fDefault=()=>({status:'pending',owner:'',project:'',type:'',from:'',to:'',q:'',hold:''});
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
  const owner=r=>L('Demo Asset '+r.owner,'示例资产企业 '+r.owner);
  const project=r=>L('Demo project '+r.project,'示例融资项目 '+r.project);
  const projectOf=r=>A.projects[r.project];
  const b=(en,zh,act,value='',cls='',disabled=false)=>`<button type="button" class="btn ${cls}" data-act="pr-${act}" data-v="${E(value)}" ${disabled?'disabled':''}>${L(en,zh)}</button>`;
  const link=(en,zh,act,value)=>act==='view'?`<a class="actlink" href="#${E(detailRoute(value,'overview',S.page===D?A.selected:''))}" data-act="pr-view" data-v="${E(value)}">${L(en,zh)}</a>`:`<button type="button" class="actlink" data-act="pr-${act}" data-v="${E(value)}">${L(en,zh)}</button>`;
  const badge=r=>CF.tag(status[r.status][2],txt(status[r.status]));
  const holdTone=r=>r.follow==='effective'?'ok':r.follow==='released'?'gray':r.follow==='awaiting-release'?'warn':r.follow==='releasing'?'accent':'gray';
  const holdBadge=r=>CF.tag(holdTone(r),txt(follows[r.follow]))+(r.flag?CF.tag('warn',txt(flags[r.flag])):'');
  const field=(label,html)=>`<div class="field"><label for="${(html.match(/id="([^"]+)/)||[])[1]||''}">${label}</label>${html}</div>`;
  const input=(id,v,type='text')=>`<input class="inp" id="${id}" type="${type}" value="${E(v)}">`;
  const select=(id,value,options)=>`<select class="inp" id="${id}">${options.map(([v,label])=>`<option value="${E(v)}" ${v===value?'selected':''}>${E(label)}</option>`).join('')}</select>`;
  const note=(s,type='')=>CF.note(type,s);
  const error=()=>A.error?`<p class="pr-error" role="alert">${E(txt(A.error))}</p>`:'';
  const kv=items=>`<dl class="pr-kv">${items.map(([label,value,wide])=>`<div ${wide?'class="pr-wide"':''}><dt>${label}</dt><dd>${value??'—'}</dd></div>`).join('')}</dl>`;
  const section=(en,zh,html)=>`<section class="card pr-section"><h2 class="pr-h2">${L(en,zh)}</h2>${html}</section>`;
  const row=()=>A.rows.find(r=>r.id===A.selected);

  /* 功能权限只在运营端账户与登录一处登记；本册按正文区分查询岗与处置岗。 */
  const signedIn=()=>!!CF.opsAuth&&CF.opsAuth.can(14);
  const canQuery=()=>!!CF.opsAuth&&CF.opsAuth.can(7);
  const canDecide=()=>!!CF.opsAuth&&CF.opsAuth.can(7)&&CF.opsAuth.can(8);
  const decideOnly=()=>!!CF.opsAuth&&!CF.opsAuth.can(7)&&CF.opsAuth.can(8);
  const allowed=()=>S.end==='admin'&&signedIn()&&canQuery();
  const canWrite=r=>allowed()&&canDecide()&&r?.status==='pending'&&A.uncertain?.id!==r.id;
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
    if(f.hold&&!holdFilters[f.hold])f.hold='';
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
  function matchHold(r,key){
    if(key==='held')return ['pending','effective','awaiting-release'].includes(r.follow);
    if(key==='releasing')return r.follow==='releasing';
    if(key==='released')return r.follow==='released';
    return r.flag===key;
  }
  function filtered(ignoreState=false){
    const f=A.filter;
    return A.rows.filter(r=>(!f.owner||r.owner===f.owner)&&(!f.project||r.project===f.project)&&(!f.type||r.type===f.type)
      &&(!f.from||inDay(r.onchainAt,f.from))&&(!f.to||inDay(r.onchainAt,f.to,true))
      &&(!f.q||[r.id,r.batch,r.token,owner(r)].join(' ').toLowerCase().includes(f.q.trim().toLowerCase()))
      &&(ignoreState||((!f.status||r.status===f.status)&&(!f.hold||matchHold(r,f.hold)))));
  }
  function utcDayStart(t,back=0){const d=new Date(t);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-back);}
  function filters(){
    const f=A.editFilter,applied=A.filter;
    const extra=['owner','project','type','from','to','hold'],count=extra.filter(k=>applied[k]).length;
    const labels={owner:L('Asset holder','资产方'),project:L('Project','目标项目'),type:L('Application type','申请类型'),
      from:L('On-chain from','上链开始日期'),to:L('On-chain through','上链结束日期'),hold:L('Holding','留存情况')};
    const values={owner:applied.owner?owner({owner:applied.owner}):'',project:applied.project?project({project:applied.project}):'',
      type:applied.type==='first'?L('Initial pledge','首笔质押'):L('Additional pledge','追加质押'),
      hold:applied.hold?txt(holdFilters[applied.hold]):''};
    return `<form id="pr-filter-form" class="pr-filter-wrap"><div class="pr-filter-bar">${field(L('Search applications','搜索申请'),`<input class="inp" id="pr-f-q" value="${E(f.q)}" placeholder="${L('Application, token, batch or company','单笔标识、代币编号、批次编号或企业名')}">`)}${field(L('Review status','审核状态'),select('pr-f-status',f.status,[['',L('All','全部')],...Object.entries(status).map(([k,v])=>[k,txt(v)])]))}<div class="pr-actions"><button type="button" class="btn" data-act="pr-filters" aria-expanded="${A.filtersOpen}" aria-controls="pr-advanced">${L('Filters','筛选条件')}${count?' ('+count+')':''} <span aria-hidden="true">${A.filtersOpen?'⌃':'⌄'}</span></button>${b('Reset','重置','reset')}<button type="submit" class="btn primary">${L('Search','查询')}</button></div></div>
      <div id="pr-advanced" class="pr-filters" ${A.filtersOpen?'':'hidden'}>${field(labels.owner,select('pr-f-owner',f.owner,[['',L('All','全部')],['A',L('Demo Asset A','示例资产企业 A')],['B',L('Demo Asset B','示例资产企业 B')]]))}${field(labels.project,select('pr-f-project',f.project,[['',L('All','全部')],['01',L('Demo project 01','示例融资项目 01')],['02',L('Demo project 02','示例融资项目 02')]]))}${field(labels.type,select('pr-f-type',f.type,[['',L('All','全部')],['first',L('Initial pledge','首笔质押')],['add',L('Additional pledge','追加质押')]]))}${field(labels.from,input('pr-f-from',f.from,'date'))}${field(labels.to,input('pr-f-to',f.to,'date'))}${field(labels.hold,select('pr-f-hold',f.hold,[['',L('All','全部')],...Object.entries(holdFilters).map(([k,v])=>[k,txt(v)])]))}</div>
      <p class="pr-meta">${L('On-chain dates are filtered by UTC calendar day.','上链时间区间按 UTC 自然日判定。')}</p>
      ${count?`<div class="pr-applied" aria-label="${L('Applied filters','已应用筛选')}">${extra.filter(k=>applied[k]).map(k=>CF.tag('gray',E(labels[k]+': '+(values[k]||applied[k])))).join('')}</div>`:''}</form>`;
  }
  function sortButton(k,en,zh){return `<button data-act="pr-sort" data-v="${k}">${L(en,zh)} ${A.sort===k?(A.dir===1?'↑':'↓'):'↕'}</button>`;}
  function queue(){
    const blocked=gate();
    if(blocked)return title(L('Pledge reviews','代币质押审核'),'')+blocked;
    const scope=filtered(true),start=utcDayStart(now(),6);
    const counts=[scope.filter(r=>r.status==='pending').length,
      scope.filter(r=>r.status==='rejected'&&r.follow!=='released').length,
      scope.filter(r=>['approved','rejected'].includes(r.status)&&r.decisionAt>=start).length];
    const metrics=`<div class="pr-metrics">${[['Pending review','待审核'],['Rejected · awaiting release','已驳回待解押'],['Decided · last 7 UTC days','近 7 个自然日人工审结']].map((x,i)=>`<div class="card pr-metric"><span>${txt(x)}</span><strong>${['loading','error'].includes(A.view)?'—':A.view==='empty'?0:counts[i]}</strong><span class="pr-meta">${L('applications','笔')}</span></div>`).join('')}</div><p class="pr-meta">${L('Summary uses the asset holder, project, type, on-chain dates and keyword filters. Review status and holding filters do not change it.','统计应用资产方、目标项目、申请类型、上链时间及关键词条件，不受审核状态与留存情况筛选影响。')}</p>`;
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
      :`<div class="tablewrap"><table class="tbl pr-table pr-queue-table"><thead><tr><th>${L('Application / token / batch','单笔 / 代币 / 批次')}</th><th>${L('Asset holder / project','资产方 / 目标项目')}</th><th>${L('Type','申请类型')}</th><th aria-sort="${A.sort==='value'?(A.dir===1?'ascending':'descending'):'none'}">${sortButton('value','Token value (USD)','代币价值（USD）')}</th><th aria-sort="${A.sort==='onchainAt'?(A.dir===1?'ascending':'descending'):'none'}">${sortButton('onchainAt','On-chain time','上链时间')}</th><th>${L('Review status','审核状态')}</th><th>${L('Holding','留存情况')}</th><th class="col-act">${L('Action','操作')}</th></tr></thead><tbody>${found.slice((A.page-1)*CF.PAGE_SIZE,A.page*CF.PAGE_SIZE).map(r=>`<tr><td><strong class="mono">${r.id}</strong><span class="pr-meta mono">${r.token}</span><span class="pr-meta mono">${r.batch}</span></td><td>${E(owner(r))}<span class="pr-meta">${E(project(r))}</span></td><td>${r.type==='first'?L('Initial pledge','首笔质押'):L('Additional pledge','追加质押')}</td><td class="pr-num mono">${r.value==null?unknown():CF.fmtAmt(r.value)}</td><td>${time(r.onchainAt)}<span class="pr-meta">${L('Waiting','已等待')} ${duration(waited(r))}</span></td><td>${badge(r)}</td><td>${holdBadge(r)}</td><td class="col-act">${link('View','查看','view',r.id)}</td></tr>`).join('')}</tbody></table></div><div class="pager"><span class="total">${L('Total','共')} ${found.length} ${L(found.length===1?'application':'applications','笔')} · ${CF.PAGE_SIZE} ${L('per page','笔／页')}</span>${b('Previous','上一页','page',A.page-1,'sm',A.page===1)}<span>${A.page} / ${pages}</span>${b('Next','下一页','page',A.page+1,'sm',A.page===pages)}</div>`);
    return title(L('Pledge reviews','代币质押审核'),L('One record is one token pledge application that has been transferred on chain.','一条记录对应一笔已上链成功的代币质押申请。'))
      +metrics+`<section class="card">${filters()}<div class="pr-list-tools">${field(L('Sort by','排序'),select('pr-order',A.sort+':'+A.dir,[['onchainAt:1',L('On-chain time · oldest first','上链时间 · 最早优先')],['onchainAt:-1',L('On-chain time · newest first','上链时间 · 最新优先')],['waiting:-1',L('Waiting · longest first','已等待时长 · 最长优先')],['waiting:1',L('Waiting · shortest first','已等待时长 · 最短优先')],['value:-1',L('Token value · highest first','代币价值 · 从高到低')],['value:1',L('Token value · lowest first','代币价值 · 从低到高')]]))}</div><div class="pr-section" ${A.error?'':'hidden'}>${error()}</div>${table}</section>`;
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
    ?r.files.map((f,i)=>uploadedFile(f,'record:'+i,L('Linked to this decision','已关联本笔结论'),false)).join('')
    :note(L('No formal agreement for this application.','本笔暂无正式协议。'));}

  /* ---------------------------------------------------------------- 链上与额度事实 */
  function proofValue(value,label){
    if(!value)return unknown();
    const short=value.slice(0,10)+'…'+value.slice(-8);
    return `<span class="mono" title="${E(value)}">${E(short)}</span>${CF.copyBtn('pr-copy',value,L('Copy '+label,'复制'+label))}`;
  }
  function gasValue(gas,ccy){return gas==null?L('Gas to be verified','gas 待核实'):E(gas+' '+(ccy||''));}
  function quotaLine(r){
    if(r.follow==='released')return L('This token has left the total pledged value and the pledged pending review.','该张已退出总质押额与待审质押额。');
    if(r.status==='approved')return r.effective
      ?L('Counted in the eligible pledged value; the eligible borrowing limit is recalculated with the project pledge ratio.','已计入有效质押价值，有效质押额按项目质押率重算。')
      :L('Moved out of the pledged pending review. The lending platform has not counted it in the eligible pledged value.','已从待审质押额转出；借贷平台未将其计入有效质押价值。');
    if(r.status==='rejected')return L('Counted in the total pledged value and in the rejected-not-released part of the pledged pending review.','计入总质押额，以及待审质押额的已驳回未解押分项。');
    if(r.status==='withdrawn')return L('No decision was made; the token has left both amounts after the release.','无人工结论；解押后已退出两项额度。');
    return L('Counted in the total pledged value and in the undecided part of the pledged pending review. Not yet counted in the eligible borrowing limit.','计入总质押额，以及待审质押额的待裁定分项；尚未计入有效质押额。');
  }
  function supportNote(r){
    if(r.flag==='difference')return note(L('A later on-chain result conflicts with the record. The original facts are kept and further actions on this token are paused. Contact platform support.','迟到的链上结果与原记录冲突，原事实保留，该张后续动作暂停，请联系平台客服人员。'),'warn');
    if(r.flag==='verify')return note(L('No confirmed release result yet. The result is not assumed to be a failure. Contact platform support.','本次解押尚无确认结果，不推定为失败，请联系平台客服人员。'),'warn');
    return '';
  }

  /* ---------------------------------------------------------------- 操作记录 */
  function activity(r){
    const heading=`<h2 class="pr-h2" id="pr-activity-title">${L('Activity','操作记录')}</h2><p class="pr-meta">${L('The only source of this application’s events and later progress, newest first.','本笔全部事件与后续进度的唯一来源，按发生时间倒序。')}</p>`;
    let body;
    if(A.activityState==='loading')body=`<p role="status">${L('Loading activity…','正在加载操作记录…')}</p>`;
    else if(A.activityState==='error')body=`<p role="alert">${L('Activity could not be loaded.','操作记录读取失败。')}</p>${b('Retry','重试','activity-retry')}`;
    else {
      const seen=new Set();
      const events=A.activityState==='empty'?[]:r.events
        .filter(e=>{const id=e.id||JSON.stringify([e.at,e.title,e.actor]);if(seen.has(id))return false;seen.add(id);return true;})
        .map((e,i)=>({...e,order:i})).sort((a,c)=>(c.at||0)-(a.at||0)||a.order-c.order);
      body=!events.length?`<p class="pr-meta">${L('No activity yet.','暂无操作记录。')}</p>`
        :`<ol class="pr-timeline" aria-label="${L('Application activity, newest first','本笔操作记录，最新在前')}">${events.map(e=>{
        const fields=[];
        if(e.chain){
          fields.push([L('Gas','gas'),gasValue(e.gas,e.gasCcy)]);
          fields.push([L('Pledge chain evidence','质押链上凭证'),e.proof?proofValue(e.proof,L('evidence','凭证')):L('None yet','暂无')]);
        }
        const files=e.files?.length?e.files.map(f=>E(f.name)).join('<br>')+'<br>'+link('View agreement files','查看协议文件','evidence',''):'';
        if(files)fields.push([L('Agreements','协议凭据'),files,true]);
        const tone=({'Approved':'ok','Release succeeded':'ok','Rejected':'danger','Release failed':'danger',
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
    const holdSummary=[['awaiting-release',follows['awaiting-release']],['releasing',follows.releasing],['released',follows.released]]
      .map(([k,label])=>txt(label)+' '+batch.filter(x=>x.follow===k).length).join(' · ');

    const overview=section('Application overview','申请概览',kv([
        [L('Asset holder','资产方'),E(owner(r))+`<span class="pr-meta mono">DEMO-ENTITY-${r.owner}</span>`],
        [L('Target project','目标项目'),E(project(r))+`<span class="pr-meta mono">${E(p.id)}</span>`],
        [L('Project status','项目状态'),L('Open · reviewed and deployed','可用 · 已通过审核并完成合约部署')],
        [L('Application type','申请类型'),r.type==='first'?L('Initial pledge','首笔质押'):L('Additional pledge','追加质押')],
        [L('Submission batch','提交批次编号'),`<span class="mono">${E(r.batch)}</span>`],
        [L('On-chain time','上链时间'),time(r.onchainAt)],
        [L(endedAt(r)?'Waited until the decision':'Waiting so far',endedAt(r)?'审结前等待时长':'已等待时长'),duration(waited(r))],
        [L('Amount attribution','额度归属'),quotaLine(r),true]
      ]))
      +section('Project parameters','项目参数',kv([
        [L('Project pledge ratio','项目质押率'),(p.ratio*100).toFixed(0)+'%'],
        [L('Project term','项目期限'),p.termMonths+' '+L('months','个月')],
        [L('Term starts','期限起算点'),time(p.createdAt)],
        [L('Valid until','有效期至'),time(p.createdAt+p.termMonths*30*86400000)]
      ])+`<p class="pr-meta">${L('Locked when the project was created; this module does not configure or adjust them.','项目创建时锁定的只读事实，本模块不配置、不调整。')}</p>`)
      +section('Token facts','本张代币事实',kv([
        [L('Token identifier','代币编号'),`<span class="mono">${E(r.token)}</span>`],
        [L('Quantity / currency','数量 / 币种'),r.amount==null?unknown():CF.fmtAmt(r.amount)+' '+r.tokenCcy],
        [L('Token value','代币价值'),money(r.value)],
        [L('Underlying tenor','底层账期'),r.term+' '+L('days','天')],
        [L('Buyer','买方企业'),r.buyer?E(r.buyer):unknown()],
        [L('Validity','有效性'),r.valid?L('Valid','有效'):L('Invalid','已失效')]
      ]))
      +section('Pledge chain facts','质押链上事实',kv([
        [L('Pledge chain','质押链'),'ETH'],
        [L('Current position','本笔当前去向'),holdBadge(r)],
        [L('Pledge contract address','质押合约地址'),proofValue(r.contract,L('address','地址')),true],
        [L('Holding address before the pledge','代币质押前原持有地址'),proofValue(r.holder,L('address','地址')),true],
        [L('On-chain time','上链时点'),time(r.onchainAt)],
        [L('Gas for this transfer','本次上链 gas'),gasValue(r.gas,r.gasCcy)],
        [L('Pledge chain evidence','质押链上凭证'),proofValue(r.proof,L('evidence','凭证')),true]
      ])+`<p class="pr-meta">${L('Read-only facts. Operations do not sign, pay gas, or initiate or cancel any on-chain action; the platform does not verify them on chain.','只读事实。运营人员不签名、不代付 gas、不发起或撤销任何链上动作；平台不做链上核验。')}</p>`+supportNote(r))
      +decisionCard(r)+activity(r);

    const batchTab=section('Batch context','批次上下文',
      `<div class="pr-row"><b class="mono">${E(r.batch)}</b>${CF.tag('gray',pendingInBatch===batch.length?L('Pending review','待审核'):pendingInBatch?L('Review in progress','审核进行中'):L('Review ended','审核已结束'))}</div><p class="pr-meta">${summary} · ${L('total','合计')} ${batch.length}</p><p class="pr-meta">${L('Holding summary: ','留存摘要：')}${holdSummary}</p><div class="tablewrap"><table class="tbl pr-table"><thead><tr><th>${L('Token / application','代币 / 单笔')}</th><th>${L('Review','审核')}</th><th>${L('Holding','留存情况')}</th><th>${L('Reviewer / time','审核人 / 时间')}</th><th class="col-act">${L('Action','操作')}</th></tr></thead><tbody>${batch.map(x=>`<tr><td>${E(x.token)}<span class="pr-meta mono">${E(x.id)}</span></td><td>${badge(x)}</td><td>${holdBadge(x)}</td><td>${x.operator?txt(x.operator):'—'}<span class="pr-meta">${time(endedAt(x))}</span></td><td class="col-act">${x.id===r.id?L('Current','当前'):link('View','查看','view',x.id)}</td></tr>`).join('')}</tbody></table></div>`)
      +section('Related applications','相关申请',
      `<p class="pr-meta">${L('Same project and asset holder, other batches.','同项目、同资产方的其他批次申请。')}</p>${related.length?`<div class="tablewrap"><table class="tbl pr-table"><thead><tr><th>${L('Application / token','单笔 / 代币')}</th><th>${L('Batch / on-chain time','批次 / 上链时间')}</th><th>${L('Review status','审核状态')}</th><th class="col-act">${L('Action','操作')}</th></tr></thead><tbody>${related.map(x=>`<tr><td><strong class="mono">${E(x.id)}</strong><span class="pr-meta mono">${E(x.token)}</span>${x.previous?`<span class="pr-meta">${L('Pledged again after ','解押后重新质押自 ')}${E(x.previous)}</span>`:''}</td><td>${E(x.batch)}<span class="pr-meta">${time(x.onchainAt)}</span></td><td>${badge(x)}</td><td class="col-act">${link('View','查看','view',x.id)}</td></tr>`).join('')}</tbody></table></div>`:note(L('No related applications.','暂无相关申请。'))}`);

    const tabs=[['overview',L('Overview','概览')],['related',L('Linked applications','关联申请')]];
    return (A.source?`<div class="pr-origin"><a class="actlink" href="#${E(detailRoute(A.source,'related'))}" data-act="pr-origin">${L('Return to ','返回来源申请 ')}${E(A.source)}</a></div>`:'')
      +title(E(r.id),E(r.token))+(A.draft?'':error())
      +`<div class="card pr-detail-summary"><div><span class="pr-meta">${L('Review status','审核状态')}</span>${badge(r)}</div><div><span class="pr-meta">${L('Token value','代币价值')}</span><strong class="pr-value mono">${money(r.value)}</strong></div><div><span class="pr-meta">${L('Current position','本笔当前去向')}</span>${holdBadge(r)}</div></div>`
      +`<div class="pr-grid"><div class="pr-detail-main"><div class="pr-tabs" role="tablist" aria-label="${L('Application sections','申请详情分区')}">${tabs.map(([k,label])=>`<button type="button" role="tab" id="pr-tab-${k}" aria-selected="${A.tab===k}" aria-controls="pr-detail-panel" tabindex="${A.tab===k?0:-1}" data-act="pr-tab" data-v="${k}">${label}</button>`).join('')}</div><div id="pr-detail-panel" role="tabpanel" tabindex="0" aria-labelledby="pr-tab-${A.tab}" class="detail-stack pr-stack">${A.tab==='overview'?overview:batchTab}</div></div>
      <aside class="pr-stack pr-rail">${reviewCard(r)}</aside></div>`;
  }
  function decisionCard(r){
    if(!['approved','rejected'].includes(r.status))return '';
    return section('Decision and evidence','审核结论与凭据',kv([
        [L('Decision','结论'),txt(status[r.status])],
        [L('Reviewer','审核人'),txt(r.operator)],
        [L('Decision time','结论时间'),time(r.decisionAt)],
        [L('Decision record','结论记录编号'),`<span class="mono">${E(r.reviewId||'')}</span>`],
        [L('Token value at the decision','结论时代币价值'),money(r.snapshot)],
        ...(r.status==='rejected'?[[L('Category','原因归类'),r.category!==''?txt(categories[+r.category]):'—'],
          [L('Rejection reason','驳回原因'),`<div class="pr-confirm">${E(r.reason)}</div>`,true]]:[]),
        ...(r.remark?[[L('Internal note','内部备注'),E(r.remark),true]]:[])
      ])+(r.status==='approved'?`<div class="pr-evidence" id="pr-evidence" tabindex="-1"><h3>${L('Pledge agreements','质押协议')}</h3>${fileList(r)}</div>`:''));
  }
  function reviewCard(r){
    const writable=canWrite(r);
    const permission=!canDecide()
      ?L('View access only. This account does not hold the pledge decision permission.','当前仅有代币质押申请查询权限，不能处置。')
      :r.status!=='pending'?L('This review has ended. The record is read-only.','本笔审核已结束，记录只读。')
      :L('Record your offline decision for this token.','请维护本笔线下审核结论。');
    const waiting=`<div class="pr-rail-time"><span class="pr-meta">${L(endedAt(r)?'Waited until the decision':'Waiting so far',endedAt(r)?'审结前等待时长':'已等待时长')}</span><strong>${duration(waited(r))}</strong><span class="pr-meta">${L('A statement of fact, not a deadline: the review has no time limit.','事实陈述，不是期限：审核不设时效。')}</span></div>`;
    const actions=canDecide()?`<div class="pr-stack">${b('Approve this application','通过本笔申请','approve','','primary',!writable)}${b('Reject this application','驳回本笔申请','reject','','',!writable)}</div>`:'';
    const hint=r.status==='pending'
      ?`<p class="pr-meta pr-disclosure">${L('Approval does not trigger any on-chain action and charges no platform fee.','通过不触发任何链上动作，也不产生平台费用。')}</p>`
      :r.status==='rejected'&&r.follow!=='released'
        ?`<p class="pr-meta pr-disclosure">${L('The token stays in the pledge contract until the asset holder releases it; operations have no release entry.','代币在资产方自助解押成功前持续留在质押合约内，运营端没有解押入口。')}</p>`:'';
    return section('Review actions','审核处理',`<p class="pr-meta">${permission}</p>${waiting}${actions}${hint}`);
  }

  /* ---------------------------------------------------------------- 办理 */
  function identity(r){return `<div class="pr-confirm">${E(r.id)} · ${E(r.token)}<span class="pr-meta">${E(r.batch)} · ${E(project(r))}</span></div>`;}
  function start(mode){
    if(!canWrite(row()))return deny();
    A.draft={id:row().id,mode,files:[],reason:'',category:'',remark:'',ack:false};A.error='';open('edit');
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
    r.decisionAt=now();r.operator=other?['Demo operator Chen','示例审核员陈']:['Demo operator Lin','示例审核员林'];
    r.reviewId=r.id.replace('PR','RV');r.snapshot=r.value;
    r.reason=d.mode==='reject'?d.reason.trim():'';r.category=d.category;r.remark=d.remark;
    r.files=d.mode==='approve'?d.files.map(f=>({...f})):[];
    r.effective=d.mode==='approve'?r.valid:r.effective;
    r.follow=d.mode==='approve'?'effective':'awaiting-release';
    event(r,d.mode==='approve'?['Approved','审核通过']:['Rejected','审核驳回'],
      d.mode==='approve'?['Pending review → Approved','待审核 → 通过']:['Pending review → Rejected','待审核 → 驳回'],
      {actor:r.operator,files:r.files.map(f=>({name:f.name})),
       text:d.mode==='approve'
         ?(r.valid?['Moved out of the pledged pending review and counted in the eligible pledged value; the eligible borrowing limit has been recalculated. No platform fee, no on-chain action.','已从待审质押额转出并计入有效质押价值，有效质押额随之重算。未产生平台费用，未触发链上动作。']
           :['Moved out of the pledged pending review. The underlying asset is invalid, so the token is not counted in the eligible pledged value; the approval stands.','已从待审质押额转出。底层资产已失效，该张未计入有效质押价值，审核结论仍为通过。'])
         :r.reason,
       next:d.mode==='reject'?['The token stays in the pledge contract. The asset holder releases it and bears the gas.','代币仍在质押合约内，由资产方自助解押，gas 自担。']:null});
    A.events.push({id:r.id,event:r.status});
    return true;
  }
  function submit(){
    const d=A.draft,r=row();
    if(A.busy)return;
    if(!d||d.id!==r?.id||!canWrite(r))return deny();
    if(!validate()){open('edit');return;}
    A.busy=true;A.error='';CF.render();
    const epoch=A.epoch,response=A.response;
    setTimeout(()=>{
      if(epoch!==A.epoch||A.draft!==d)return;
      A.busy=false;
      if(!canWrite(r))return deny();
      if(response==='fail'){A.error=['Could not save the decision. Your inputs are preserved.','结论保存失败，已保留输入，请重试。'];open('edit');return;}
      if(response==='withdraw'){
        r.status='withdrawn';r.follow='released';
        r.release={startedAt:now()-600000,completedAt:now(),gas:0.0017,gasCcy:'ETH',proof:null,result:'success'};
        event(r,['Release succeeded','解押成功'],['Pending review → Withdrawn · hold released','待审核 → 已撤回 · 占用解除'],
          {actor:['Asset holder','资产方'],chain:true,gas:0.0017,gasCcy:'ETH',
           text:['The asset holder released the token while it was still pending, so no decision was saved.','资产方在待审期间自助解押成功，本次未保存审核结论。']});
        A.draft=null;S.layer=null;
        A.error=['The asset holder withdrew this application. No decision was saved.','资产方已撤回本笔，未保存审核结论。'];
        CF.render();return;
      }
      if(response==='concurrent'){
        applyDecision(r,{mode:'reject',reason:L('Materials require further verification by the asset holder.','申请材料尚需资产方进一步核实后重新发起。'),category:'3',remark:'',files:[]},true);
        A.draft=null;S.layer=null;
        A.error=['Another reviewer has decided this application. The current result is shown.','本笔已由其他审核员处理，已显示当前结论、审核人及时间。'];
        CF.render();return;
      }
      if(response==='unknown'){
        A.uncertain={id:r.id,d:{...d}};A.draft=null;S.layer=null;
        A.error=['Decision result is being confirmed. Check the current result before proceeding.','结论结果待确认，请查询当前结果后再操作。'];
        CF.render();return;
      }
      applyDecision(r,d);A.tab='overview';saveContext();A.draft=null;S.layer=null;A.response='success';
      CF.render();CF.toast(L('Decision saved for this application.','本笔审核结论已保存。'));
    },650);
  }
  function editLayer(){
    const d=A.draft,r=row();
    if(!d||!r)return {title:L('Unavailable','不可用'),html:'',foot:b('Close','关闭','cancel')};
    const facts=kv([[L('Token value','代币价值'),money(r.value)],[L('On-chain time','上链时间'),time(r.onchainAt)],
      [L('Current position','本笔当前去向'),holdBadge(r)],[L('Pledge chain evidence','质押链上凭证'),proofValue(r.proof,L('evidence','凭证')),true]]);
    const docs=d.files.map((f,i)=>uploadedFile(f,'draft:'+i,f.state==='ready'?L('Ready','已就绪'):f.state==='uploading'?L('Uploading…','上传中…'):L('Upload failed — remove and retry','上传失败，请移除后重试'),true)).join('');
    const body=d.mode==='approve'
      ?`${facts}${field(L('Pledge agreements','质押协议'),`<label class="btn pr-upload" for="pr-upload">${L('Upload agreements','上传协议')}<input class="sr-only" id="pr-upload" type="file" accept="application/pdf,image/jpeg,image/png" multiple></label>`)}<span class="pr-meta">${L('PDF / JPG / PNG · 1–5 files · up to 10 MB each','PDF / JPG / PNG · 1～5 个 · 每个不超过 10 MB')}</span>${docs}${field(L('Internal note (optional)','内部备注（选填）'),`<textarea class="inp" id="pr-remark" aria-invalid="${!!A.error&&Array.from(d.remark).length>200}">${E(d.remark)}</textarea><span class="pr-meta">${Array.from(d.remark).length} / 200</span>`)}<label><input id="pr-ack" type="checkbox" ${d.ack?'checked':''}> ${L('I understand: this token moves out of the pledged pending review, the lending platform decides whether it counts in the eligible pledged value, no platform fee arises and no on-chain action is triggered.','我已知悉：该张将从待审质押额转出，是否计入有效质押价值由借贷平台按有效性判定；本次不产生平台费用，也不触发任何链上动作。')}</label>`
      :`${facts}${field(L('Category (optional)','归类（选填）'),select('pr-category',d.category,[['',L('Not selected','未选择')],...categories.map((x,i)=>[String(i),txt(x)])]))}${field(L('Reason shown to the asset holder','向资产方展示的原因'),`<textarea class="inp" id="pr-reason" aria-invalid="${!!A.error}" aria-describedby="pr-form-error">${E(d.reason)}</textarea><span class="pr-meta">${Array.from(d.reason.trim()).length} / 500 · ${L('Minimum 10 characters','至少 10 字')}</span>`)}`;
    return {title:d.mode==='approve'?L('Approve this application','通过本笔申请'):L('Reject this application','驳回本笔申请'),
      html:`<div class="pr-form">${identity(r)}<fieldset ${A.busy?'disabled':''}>${body}</fieldset><div id="pr-form-error">${error()}</div>${A.busy?'<p role="status">'+L('Saving decision…','正在保存结论…')+'</p>':''}</div>`,
      foot:b('Cancel','取消','cancel','','',A.busy)+(d.mode==='approve'
        ?b('Approve this application','通过本笔申请','submit','','primary',A.busy)
        :b('Review decision','核对结论','confirm','','primary',A.busy))};
  }
  const layers={
    'pr-edit':editLayer,
    'pr-confirm':()=>({title:L('Confirm rejection','确认驳回'),
      html:identity(row())+`<div class="pr-section"><b>${L('Reject this application only','仅驳回本笔申请')}</b><div class="pr-confirm">${E(A.draft?.reason.trim())}</div><p class="pr-meta">${L('The reason above is shown in full to the asset holder. Other applications are unchanged. The token stays in the pledge contract until the asset holder releases it and bears the gas.','以上原因将全文展示给资产方，其他笔不受影响。代币仍留在质押合约内，需由资产方自助解押，gas 自担。')}</p>${A.busy?'<p role="status">'+L('Saving decision…','正在保存结论…')+'</p>':''}</div>`,
      foot:b('Back','返回修改','edit','','',A.busy)+b('Confirm rejection','确认驳回','submit','','primary',A.busy)}),
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
    if(f.sample)return `<div class="pr-confirm"><h3>${L('Demonstration agreement','演示协议')}</h3><p>${E(row().batch)} · ${E(row().token)}</p><p>${L('This demonstration document covers the DEMO token of this application.','此演示材料对应本笔的 DEMO 代币。')}</p></div>`;
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
    return `<h3>${L('Pledge review · demo tools','代币质押审核 · 演示工具')}</h3><p class="pr-meta">${L('Local demonstration only. No signature, transfer, file service or notification is contacted.','仅本地演示：不签名、不转移代币，也不连接真实文件或消息服务。')}</p>
      <h4>${L('Delivered account configuration','交付的账号配置')}</h4><div class="pr-demo-actions">${b('Administrator','运营管理员','grant','admin')}${b('Specialist · no pledge access','运营专员 · 未开通本模块','grant','none')}${b('Specialist · query only','运营专员 · 仅开通申请查询','grant','query')}${b('Specialist · decision only','运营专员 · 仅开通审核处置','grant','decide')}${b('Specialist · query + decision','运营专员 · 查询＋处置','grant','full')}</div>
      <div class="pr-demo">${field(L('Page state','页面状态'),select('pr-view',A.view,[['default',L('Default','默认')],['loading',L('Loading','加载中')],['empty',L('Empty','空数据')],['noresult',L('No results','筛选无结果')],['error',L('Load failed','读取失败')]]))}${field(L('Submit response','提交反馈'),select('pr-response',A.response,[['success',L('Success','成功')],['fail',L('Failure','失败')],['unknown',L('Uncertain result','结果待确认')],['concurrent',L('Another reviewer wins','同笔已被他人裁定')],['withdraw',L('Withdrawn before save','提交前资产方已撤回')]]))}${field(L('Upload response','上传反馈'),select('pr-upload-state',A.upload,[['success',L('Success','成功')],['fail',L('Failure','失败')]]))}${field(L('Attachment response','附件反馈'),select('pr-preview-state',A.preview,[['success',L('Success','成功')],['fail',L('Preview fails','预览失败')],['missing',L('File unavailable','文件不可得')],['unsupported',L('Preview unsupported','不支持预览')],['downloadfail',L('Download fails','下载失败')]]))}${field(L('Activity state','操作记录状态'),select('pr-activity-state',A.activityState,[['default',L('Default','默认')],['loading',L('Loading','加载中')],['empty',L('Empty','暂无记录')],['error',L('Load failed','加载失败')]]))}</div>
      <h4>${L('On-chain events for this application','本笔链上事件')}</h4><div class="pr-demo-actions">${b('Asset holder initiates the release','资产方发起自助解押','release-start','','',!r||!['awaiting-release'].includes(r.follow))}${b('Release succeeds','解押成功回写','release-success','','',!r||r.follow!=='releasing'||r.flag==='difference')}${b('Release fails','解押失败回写','release-fail','','',!r||r.follow!=='releasing'||r.flag==='difference')}${b('Delayed conflicting result','接收迟到冲突结果','late-conflict','','',!r||r.flag!=='verify')}${b('Expire operations session','运营登录失效','expire-session')}${b('Replay latest event','重放最新事件','replay-event','','',!r)}${b('Reset demonstration','重置演示','restart')}</div>
      <h4>${L('Outcome events','结果事件')}</h4><p class="pr-meta">${A.events.map(e=>E(e.id+' · '+e.event)).join('<br>')||L('None','暂无')}</p>`;
  }

  /* ---------------------------------------------------------------- 动作 */
  function onAct(act,v,e){
    if(e&&(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)&&['pr-view','pr-origin'].includes(act))return false;
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
        if(ok){r.follow='released';if(r.status==='pending')r.status='withdrawn';r.flag='';}
        event(r,ok?['Release succeeded','解押成功']:['Release failed','解押失败'],
          ok?['Token returned to the holding address before the pledge','代币已转回质押前原持有地址']:['Token still held in the pledge contract','代币仍在质押合约内'],
          {chain:true,gas:r.release.gas,gasCcy:'ETH',proof:r.release.proof,
           text:ok?['The token has left the total pledged value and the pledged pending review.','该张已退出总质押额与待审质押额。']
             :['The pledge contract returned a failure. The gas is consumed and not refunded; the asset holder can initiate the release again.','质押合约返回失败，gas 已消耗且不退，资产方可再次发起解押。']});
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
    if(id.startsWith('pr-f-')){A.editFilter[id.slice(5)]=el.value;return;}
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
      if(files.length+d.files.length>5){A.error=['At most 5 files per application.','每笔最多 5 个文件。'];CF.render();return;}
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
    layers:{...OPS.layers,...layers},
    onAct:(act,v,e)=>onAct(act,v,e)||OPS.onAct(act,v,e),
    beforeAdminNavigate(proceed){if(A.busy||A.draft){CF.toast(L('Finish or cancel the current review first.','请先完成或取消当前审核。'));return;}remember();proceed();},
    allowNav:id=>[Q,D].includes(id)?allowed():OPS_PAGES.includes(id),
    breadcrumbRoute:id=>id===Q?queueRoute():null,
    onBeforeAct(act,v,e){
      if(act==='retry'||act==='clearfilter'){onAct(act,v);return true;}
      if(act==='closelayer'&&e?.type==='click'&&e.target.closest('[data-stop]'))return false;
      if(act==='closelayer'&&A.busy)return true;
      if(act==='closelayer'&&S.layer?.key==='pr-preview'){closePreview();return true;}
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
