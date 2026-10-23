/* 运营端协议管理。会话与功能权限只读运营端账户与登录一处登记（CF.opsAuth）：
   PM-AL-09 协议当前内容与工作版本查询、PM-AL-10 协议内容与版本维护、PM-AL-11 协议版本发布、
   PM-AL-15 协议历史版本读取、PM-AL-16 协议操作记录查看（不以 09 为前提）。
   本期只有运营管理员，正常交付的五项权限全部开通；异常配置仅在演示工具中注入。
   业务数据、文件与异步反馈均为本地演示。 */
(function (CF) {
'use strict';
const translations=new Map();
const OPS=CF.opsAccountModule;
const OPS_PAGES=['P-O-AL-01','P-O-AL-03','P-O-AL-04','P-O-AL-05','P-O-AL-06','P-O-AL-07'];
const S=CF.S, L=(en,zh)=>{translations.set(en,[en,zh]);translations.set(zh,[en,zh]);return CF.L(en,zh);}, esc=CF.esc, $=id=>document.getElementById(id), clone=x=>JSON.parse(JSON.stringify(x));
const E=value=>translations.has(value)?CF.L(...translations.get(value)):value;
const STORE='hc-operations-agreements-v15', VIEW=STORE+'-view';
const P={list:'P-O-AG-01',detail:'P-O-AG-02',edit:'P-O-AG-03',version:'P-O-AG-04'};
/* 生效日界按推荐取 UTC 24:00（Q-O-AG-12）：上传当天结束的那一刻；展示按本人时区换算。 */
const boundary=(t=Date.now())=>{const d=new Date(t);return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)).toISOString();};
const now=()=>new Date().toISOString(), txt=x=>Array.isArray(x)?L(x[0],x[1]):(x||''), time=x=>x?esc(CF.fmtTime(x)).replace(/(\([^()]+\))$/, '<span class="ag-zone">$1</span>'):'—';
const labels={active:['Active','已生效'],scheduled:['Scheduled','待生效'],archived:['Archived','已归档'],cancelled:['Cancelled','已取消'],offline:['Offline','已下线'],unpublished:['Unpublished','未发布']};
const tag=s=>CF.tag(({active:'ok',scheduled:'warn',cancelled:'gray',offline:'danger'})[s]||'',txt(labels[s]));
/* 协议列表与操作进度均固定每页 20 条，无条数切换（Q-O-AG-11 裁定）。 */
const PAGE_SIZE=20;
let filters={q:'',states:[],page:1},inputFilters=clone(filters);
try{filters=Object.assign(filters,JSON.parse(sessionStorage.getItem(VIEW)||'{}'));inputFilters=clone(filters);}catch(e){}
let db,work=null,dirty=false,busy=false,uploading=false,errors={},failure='',downloadFails=false,pending=null,oldHash='',viewHash='';
let bulk=false,returnHash='',lastHash='',onModule=false,wasSigned=false;
try{bulk=sessionStorage.getItem(STORE+'-bulk')==='true';}catch(e){}
/* 操作类型、状态变化与时间线色调集中登记；记录本身只存发生的事实。 */
const KINDS={
 upload:{label:['Upload','上传'],change:['New → Scheduled','新建 → 待生效'],tone:'accent'},
 overwrite:{label:['Overwrite upload','覆盖上传'],change:['Version status unchanged','版本状态不变'],tone:'accent'},
 revoke:{label:['Cancel scheduled version','撤销待生效'],change:['Scheduled → Removed','待生效 → 已移除'],tone:'gray'},
 activate:{label:['System activation','系统生效'],change:['Scheduled → Active','待生效 → 已生效'],tone:'ok'},
 archive:{label:['System archive','系统归档'],change:['Active → Archived','已生效 → 已归档'],tone:'gray'},
 fail:{label:['Activation failed','到点生效失败'],change:['Version status unchanged (Scheduled)','版本状态不变（待生效）'],tone:'danger'},
 offline:{label:['Agreement taken offline','协议下线'],change:['Online → Offline','已上线 → 已下线'],tone:'warn'},
 cancel:{label:['Related cancellation','关联取消'],change:['Scheduled → Cancelled','待生效 → 已取消'],tone:'gray'}
};
const IDENTITY=['Demo operator · op***@example.invalid','演示运营人员 · op***@example.invalid'];
let logSeq=0;
const record=(at,kind,n,summary,actor,extra={})=>Object.assign({id:'log-'+(++logSeq)+'-'+Date.now().toString(36),at,kind,n,summary,actor,identity:actor==='system'?null:IDENTITY,result:'success',region:actor==='system'?null:['Shanghai','上海']},extra);
function seed(){
 /* 演示时刻：已生效、已归档版本取固定历史时点；待生效版本按当前时刻取最近的 UTC 24:00。 */
 const day=Date.parse(boundary())-86400000,at='2026-09-18T02:00:00Z';
 const vers=(n,state,file,extra={},t=state==='archived'?'2026-09-11T02:00:00Z':at)=>Object.assign({n,state,file:Object.assign(clone(AG_FILES[file]),{uploaded:t}),note:['Updated agreement content','更新协议内容'],plan:state==='scheduled'?boundary():null,at:t,effective:state==='active'?'2026-09-19T00:00:00Z':state==='archived'?'2026-09-12T00:00:00Z':null,archived:state==='archived'?'2026-09-19T00:00:00Z':null,revision:1,failed:false},extra);
 const pendingAt=new Date(Math.max(Date.now()-3600000,day)).toISOString(),failedAt=new Date(day-3*3600000).toISOString();
 const a=(id,name,type,uses,versions,extra={})=>Object.assign({id,name,type,uses,formats:['PDF'],maxMB:5,online:true,description:['Terms used in the indicated customer journeys.','用于以下业务环节的条款。'],versions,next:Math.max(0,...versions.map(v=>v.n))+1,updated:'2026-09-18T02:00:00Z',logs:[]},extra);
 return {agreements:[
 a('DEMO-SERVICE',['Service agreement','服务协议'],'service',['registration','financing','pledge','repayment'],[vers(1,'archived','demo-1'),vers(2,'active','demo-2'),vers(3,'scheduled','demo-3',{at:failedAt,failed:true,file:Object.assign(clone(AG_FILES['demo-3']),{uploaded:failedAt}),failedAt:new Date(day).toISOString()})]),
 a('DEMO-PRIVACY',['Privacy policy','隐私政策'],'policy',['registration'],[vers(1,'active','demo-1')]),
 a('DEMO-FIRST',['First release agreement','首版协议'],'service',['financing'],[vers(1,'scheduled','demo-3',{at:pendingAt,file:Object.assign(clone(AG_FILES['demo-3']),{uploaded:pendingAt})})]),
 a('DEMO-TEMPLATE',['Application template','申请模板'],'template',['financing'],[],{formats:['PDF','TXT'],maxMB:2,description:null}),
 a('DEMO-NOTICE',['Disclosure notice','告知书'],'policy',['pledge'],[vers(1,'active','demo-1'),vers(2,'scheduled','demo-5',{at:pendingAt,file:Object.assign(clone(AG_FILES['demo-5']),{uploaded:pendingAt})})]),
 a('DEMO-OFFLINE',['Legacy service agreement','历史服务协议'],'service',['repayment'],[vers(1,'archived','demo-1'),vers(2,'cancelled','demo-4',{cancelledAt:'2026-09-20T02:00:00Z',cancelReason:['Agreement taken offline','协议下线'],plan:'2026-09-21T00:00:00Z'},'2026-09-20T01:00:00Z')],{online:false})
 ].map((a,i)=>{a.order=(i+1)*10;
 a.versions.forEach(v=>{
  a.logs.push(record(v.at,'upload',v.n,[v.file.name+'; takes effect',v.file.name+'，生效时间'],'operator',{when:v.failedAt||v.plan||v.effective,note:v.note}));
  if(v.effective)a.logs.push(record(v.effective,'activate',v.n,['Took effect as scheduled','按计划生效'],'system'));
  if(v.archived&&a.online)a.logs.push(record(v.archived,'archive',v.n,['Replaced by v'+(v.n+1),'由 v'+(v.n+1)+' 替换'],'system'));
  if(v.failed)a.logs.push(record(v.failedAt,'fail',v.n,['v2 remains effective; retries at','v2 仍在生效，将再次生效于'],'system',{result:'failed',when:v.plan,reason:['Activation did not complete at the 24:00 boundary','24:00 生效处理未完成']}));
 });
 /* 下线由建设方执行：自动归档与取消记为“系统”，无版本的定义下线关联版本取“—”。 */
 if(!a.online)a.logs.push(
  record('2026-09-20T02:00:00Z','offline',null,['Agreement taken offline; content no longer provided','协议已下线，停止对外提供当前内容'],'system',{reason:['Agreement taken offline','协议下线']}),
  record('2026-09-20T02:00:00Z','cancel',2,['Pending version cancelled on offline; originally scheduled for','下线取消待生效版本，原生效时间'],'system',{when:'2026-09-21T00:00:00Z',reason:['Agreement taken offline','协议下线']}),
  record('2026-09-20T02:00:00Z','archive',1,['Archived on offline; effective time and file retained','下线归档，保留原实际生效时间与文件'],'system'));
 a.updated=a.logs.reduce((m,r)=>r.at>m?r.at:m,a.updated);
 return a;})};
}
try{db=JSON.parse(localStorage.getItem(STORE));}catch(e){}
if(!db||!db.agreements)db=seed();
function persist(){try{localStorage.setItem(STORE,JSON.stringify(db));}catch(e){CF.toast(L('Changes remain available in this session; local storage is full.','本地存储不可用，改动仅保留在当前页面。'));}}
const params=()=>new URLSearchParams(location.hash.split('?')[1]||'');
const current=()=>params().has('id')?db.agreements.find(a=>a.id===params().get('id')):(S.page===P.list?db.agreements[0]:null);
const operator=()=>L('Demo operator · op***@example.invalid','演示运营人员 · op***@example.invalid');
const scheduled=a=>a?.versions.find(v=>v.state==='scheduled');
const active=a=>a?.versions.find(v=>v.state==='active');
const state=a=>!a.online?'offline':active(a)?'active':scheduled(a)?'scheduled':'unpublished';
/* 已归档与已取消属于历史内容，读取须 PM-AL-15；当前与工作版本按 PM-AL-09。 */
const historyOnly=v=>['archived','cancelled'].includes(v.state);
/* 三档目标判权互不替代：内容与工作版本 09、历史版本 15、操作记录 16。 */
const can=n=>!!CF.opsAuth&&CF.opsAuth.can(n);
const held=n=>!!CF.opsAuth&&CF.opsAuth.held(n);
const signedIn=()=>can(14);
const canQuery=()=>can(9);
const canEdit=()=>can(10);
const canPublish=()=>can(11);
/* 上传即排定生效，相当于更新内容并发布：须维护与发布俱全；撤销待生效只需发布。 */
const canUpload=()=>canEdit()&&canPublish();
const canHistory=()=>can(15);
const canRecords=()=>can(16);
const recordsOnly=()=>!canQuery()&&canRecords();
const reachable=()=>canQuery();
/* 已开通维护或发布、但缺配套的查询权限：拒绝并说明由建设方修正交付配置，不静默通过、不自动补授权。 */
const missingQuery=()=>!canQuery()&&(held(10)||held(11));
const MODULE_PAGES=()=>[P.list,P.detail,P.edit,P.version];
function deny(kind,a=current()) {if(!a||!canQuery()||!a.online||(kind==='upload'&&!canUpload())||(kind==='publish'&&!canPublish())){CF.toast(a&&!a.online?L('This agreement is offline. Content changes are unavailable.','协议已下线，无法维护内容。'):L('You do not have permission for this action.','你没有执行此操作的权限。'));return true;}return false;}
function B(act,en,zh,value='',primary=false,disabled=false,reason='',tone=''){return `<span title="${esc(reason)}"><button type="button" class="btn${primary?' primary':''}${tone?' '+tone:''}" data-act="ag-${act}" data-v="${esc(value)}"${disabled?' disabled':''}>${L(en,zh)}</button></span>`;}
function link(act,en,zh,value='',off=false,reason='',rowKey=value){if(act==='detail'&&!off)return `<a class="actlink" id="ag-row-${esc(rowKey)}" href="${esc(route(P.detail,{id:value}))}">${L(en,zh)}</a>`;return `<button type="button" class="actlink${off?' off':''}" data-act="ag-${act}" data-v="${esc(value)}"${off?' disabled':''} title="${esc(reason)}">${L(en,zh)}</button>`;}
const kv=(key,value)=>`<dt>${key}</dt><dd>${value}</dd>`;
const fact=(key,value,wide=false)=>`<div${wide?' class="ops-fact-wide"':''}>${kv(key,value)}</div>`;
const size=f=>f?(f.size>=1048576?(f.size/1048576).toFixed(2)+' MB':(f.size/1024).toFixed(1)+' KB'):'—';
const typeNames={service:['Service','服务类'],policy:['Policy','政策类'],template:['Template','模板类']};
const useNames={registration:['Registration','注册'],financing:['Financing request','融资申请'],pledge:['Token pledge','代币质押'],repayment:['Repayment','还款']};
function log(a,kind,n,summary,actor='operator',extra={}){a.logs.unshift(record(now(),kind,n,summary,actor,extra));a.updated=now();}
function heading(title,desc,actions=''){return `<div class="page-head ag-heading"><div><h1 class="page-title">${esc(title)}</h1>${desc?`<p class="page-desc">${desc}</p>`:''}</div><div class="page-actions">${CF.tag('gray',L('Demo data','演示数据'))}${actions}</div></div>`;}
// Route state is browse-only: identifiers never grant query or write permission.
const defaults=()=>({q:'',states:[],page:1});
function cleanView(value){
 const v=value&&typeof value==='object'?value:{},d=defaults();
 d.q=typeof v.q==='string'?v.q:'';
 d.states=Array.isArray(v.states)?v.states.filter(x=>['active','scheduled','unpublished','offline'].includes(x)):[];
 d.page=Number.isSafeInteger(Number(v.page))?Math.max(1,Number(v.page)):1;return d;
}
filters=cleanView(filters);inputFilters=clone(filters);
function readView(raw){try{return cleanView(JSON.parse(raw));}catch(e){return defaults();}}
function listHash(){return '#'+CF.ENTRY[P.list]+'?view='+encodeURIComponent(JSON.stringify(filters));}
function route(page,extra={}){return '#'+CF.ENTRY[page]+'?'+new URLSearchParams(Object.assign({id:params().get('id')||current()?.id||'',view:JSON.stringify(filters)},extra));}
function navigate(page,a=current(),extra={}){location.hash=page===P.list?(viewHash||listHash()):route(page,Object.assign({id:a?.id||''},extra));}
function saveView(){filters=cleanView(filters);try{sessionStorage.setItem(VIEW,JSON.stringify(filters));}catch(e){}viewHash=listHash();if(S.page===P.list&&location.hash!==viewHash)location.hash=viewHash;}
let routeChanged=true;
const positions=new Map();
function remember(hash=oldHash){if(!hash)return;const active=document.activeElement;const item={y:window.scrollY,focus:active?.id||''};positions.set(hash,item);try{sessionStorage.setItem(VIEW+'-position:'+hash,JSON.stringify(item));}catch(e){}}
function position(hash){try{return positions.get(hash)||JSON.parse(sessionStorage.getItem(VIEW+'-position:'+hash)||'null');}catch(e){return null;}}
function resetFilter(){filters=defaults();inputFilters=clone(filters);S.st='default';saveView();}
/* 拒绝访问与业务空结果分开；拒绝内容读取时不探测或披露目标对象。 */
function noAccess(){
 const back=B('accessBack','Back to account','返回账户');
 return missingQuery()
  ?CF.empty(L('Agreement access is incomplete','协议权限配置不完整'),
    L('This account can maintain or publish agreement versions but has no agreement content query permission, so the request is refused. Ask your platform provider to correct the delivered configuration.','该账号已开通协议内容维护或版本发布，但未开通协议当前内容与工作版本查询，本次访问已拒绝。请联系平台建设方修正交付配置。'),back)
  :CF.empty(L('Access denied','访问被拒绝'),
    L('This account cannot open this page. Return to your account or contact your platform provider.','当前账号无法访问此页面。请返回账户或联系平台建设方。'),back);
}
function stateSurface(){if(!canQuery()||S.st==='denied')return noAccess();return CF.surface({skelRows:5,emptyTitle:L('No agreements yet','暂无协议'),emptyDesc:L('Agreements are preset by the system.','协议由系统预置。')});}
// Keep the existing checkbox menu beside its trigger while allowing compact wrapping.
function fitFilterOptions(){
 document.querySelectorAll('.ag-filter details[open] .ag-options').forEach(panel=>{
  panel.style.left='0px';const rect=panel.getBoundingClientRect();
  panel.style.left=Math.max(16-rect.left,Math.min(0,innerWidth-16-rect.right))+'px';
 });
}
window.addEventListener('resize',fitFilterOptions);
document.fonts?.ready.then(fitFilterOptions);
function multiselect(key,label,options,compact=false){let values=inputFilters[key]||[];return `<div class="field"><label id="ag-label-${key}"${compact?' class="sr-only"':''}>${label}</label><details><summary class="inp" data-on="${values.length?1:0}" aria-labelledby="ag-label-${key} ag-value-${key}">${compact?`<span aria-hidden="true">${label}</span>`:''}<span id="ag-value-${key}">${values.length?L(values.length+' selected','已选 '+values.length+' 项'):L('All','全部')}</span></summary><div class="ag-options">${Object.keys(options).map(k=>`<label><input type="checkbox" data-filter="${key}" value="${k}"${values.includes(k)?' checked':''}>${esc(txt(options[k]))}</label>`).join('')}</div></details></div>`;}
function appliedFilters(){
 const values=[];
 if(filters.q)values.push(L('Search','搜索')+' · '+filters.q);
 if(filters.states.length)values.push(L('Status','协议状态')+' · '+filters.states.map(k=>txt(labels[k])).join(' / '));
 return values.length?`<div class="ag-applied"><span>${L('Applied filters','已应用筛选')}</span>${values.map(v=>CF.tag('gray',esc(v))).join('')}</div>`:'';
}
function matches(a){let q=filters.q.trim().toLowerCase();return (!q||[...a.name,a.id].some(t=>t.toLowerCase().includes(q)))&&(!filters.states.length||filters.states.includes(state(a)));}
function listPage(){
 const head=heading(L('Agreements','协议管理'),L('Manage content and versions of system-preset agreements.','维护系统预置协议的内容与版本。'));
 if(!canQuery()||S.st==='denied')return head+stateSurface();
 const fs=`<div class="ag-filter"><div class="filterbar ops-filterbar ag-toolbar"><div class="ag-status">${multiselect('states',L('Agreement status','协议状态'),Object.fromEntries(['active','scheduled','unpublished','offline'].map(k=>[k,labels[k]])),true)}</div><div class="fb-q ops-filter-query"><label class="sr-only" for="ag-q">${L('Agreement name or code','协议名称或标识')}</label><input class="inp" id="ag-q" type="search" data-filter="q" placeholder="${L('Search name or code','搜索协议名称或标识')}" value="${esc(inputFilters.q)}"></div><div class="fb-acts">${B('reset','Reset','重置')}${B('query','Search','查询','',true)}</div></div></div>${appliedFilters()}`;
 /* 固定顺序：默认排序值，再按最近更新从新到旧；不提供排序切换。 */
 let rows=(bulk?Array.from({length:47},(_,i)=>{let a=clone(db.agreements[i%db.agreements.length]);a.id+='-'+(i+1);a.baseId=db.agreements[i%db.agreements.length].id;return a;}):db.agreements).filter(matches);
 rows.sort((a,b)=>(a.order||0)-(b.order||0)||new Date(b.updated)-new Date(a.updated));
 let total=['empty','noresult'].includes(S.st)?0:rows.length,maxPage=Math.max(1,Math.ceil(total/PAGE_SIZE));filters.page=Math.min(filters.page,maxPage);
 let surf=stateSurface()||(!rows.length?CF.empty(L('No agreements match these filters','没有符合条件的协议'),L('Try different filters.','请调整筛选条件。'),B('reset','Reset filters','重置筛选')):null);
 const versionCell=(v,at,extra='')=>v?`<span class="mono">v${v.n}</span><span class="ag-sub">${time(at)}</span>${extra}`:'—';
 const table=`<div class="tablewrap" tabindex="0" role="region" aria-label="${L('Agreement ledger','协议台账')}"><table class="tbl ag-table"><colgroup><col style="width:22%"><col style="width:9%"><col style="width:17%"><col style="width:18%"><col style="width:11%"><col style="width:16%"><col style="width:7%"></colgroup><thead><tr><th>${L('Agreement name / code','协议名称 / 标识')}</th><th>${L('Agreement type','协议类型')}</th><th>${L('Current version / effective at','当前生效版本 / 生效时间')}</th><th>${L('Pending version / takes effect','待生效版本 / 生效时间')}</th><th>${L('Agreement status','协议状态')}</th><th>${L('Updated','最近更新')}</th><th class="col-act">${L('Action','操作')}</th></tr></thead><tbody>${rows.slice((filters.page-1)*PAGE_SIZE,filters.page*PAGE_SIZE).map(a=>{let v=active(a),s=scheduled(a);return `<tr><td><span class="cell-main">${esc(txt(a.name))}</span><span class="ag-sub mono">${esc(a.id)}</span></td><td>${esc(txt(typeNames[a.type]))}</td><td>${versionCell(v,v?.effective)}</td><td>${versionCell(s,s?.plan,s?.failed?`<span class="ag-error">${L('Last activation failed','上次生效失败')}</span>`:'')}</td><td>${tag(state(a))}</td><td>${time(a.updated)}</td><td class="col-act">${link('detail','View','查看',a.baseId||a.id,false,'',a.id)}</td></tr>`;}).join('')}</tbody></table></div>`;
 return head+`<div class="card">${fs}${surf||table}<div class="pager"><span class="total">${L(total+' agreements','共 '+total+' 份协议')}</span>${B('page','Previous','上一页',filters.page-1,false,filters.page===1)}<span>${filters.page} / ${maxPage}</span>${B('page','Next','下一页',filters.page+1,false,filters.page===maxPage)}</div></div>`;
}
/* 版本历史：按版本此刻的状态判权，只列记录并提供下载；当前生效版本以状态与行底色辨认。 */
let historyState='default';
function versionHistory(a){
 const head=`<div class="card-head"><h2>${L('Version history','版本历史')}</h2></div>`;
 let body;
 if(historyState==='loading')body=`<div class="card-b" role="status">${L('Loading versions…','正在加载版本历史…')}</div>`;
 else if(historyState==='error')body=CF.empty(L('Version history could not be loaded','版本历史加载失败'),L('Try again.','请重试。'),B('historyRetry','Retry','重试'));
 else {
  const rows=(historyState==='empty'?[]:a.versions).filter(v=>canHistory()||!historyOnly(v)).sort((x,y)=>y.n-x.n);
  const ref=Number(params().get('v'))||0,refV=ref&&a.versions.find(v=>v.n===ref);
  /* 从消息进入时，说明所指版本此后的变化；不改取其他版本。 */
  const refNote=!ref||historyState!=='default'?''
   :!refV?CF.note('warn',L('v'+ref+' no longer exists and is not listed.','v'+ref+' 已不存在，不在版本历史中列出。'))
   :historyOnly(refV)&&!canHistory()?CF.note('warn',L('v'+ref+' is now a historical version. Reading it requires version-history permission.','v'+ref+' 现为历史版本，需协议历史版本读取权限。'))
   :refV.state==='archived'?CF.note('gray',L('v'+ref+' has since been replaced and is now archived.','v'+ref+' 此后已被新版本替换，现为已归档。'))
   :refV.state==='cancelled'?CF.note('gray',L('v'+ref+' was cancelled when the agreement was taken offline.','v'+ref+' 已因协议下线取消。')):'';
  const restricted=canHistory()?'':`<p class="ag-hint ag-history-hint">${L('Archived and cancelled versions require version-history permission.','已归档与已取消版本需协议历史版本读取权限。')}</p>`;
  const when=v=>v.state==='scheduled'?`<span class="ag-sub ag-plan">${L('Scheduled','计划')}</span>${time(v.plan)}`:v.state==='cancelled'?'—':time(v.effective);
  const dl=v=>`<button type="button" class="actlink" data-act="ag-download" data-v="${v.n}" aria-label="${esc(L('Download v'+v.n+' · '+v.file.name,'下载 v'+v.n+' · '+v.file.name))}">${L('Download','下载')}</button>${errors.download===v.n?`<span class="ag-error" role="alert">${L('Download failed. Try again.','下载失败，请重试。')}</span>`:''}`;
  body=(refNote?`<div class="ag-history-note">${refNote}</div>`:'')+(rows.length?`<div class="tablewrap" tabindex="0" role="region" aria-label="${L('Version history','版本历史')}"><table class="tbl ag-versions"><colgroup><col style="width:80px"><col style="width:132px"><col style="width:23%"><col style="width:23%"><col><col style="width:104px"></colgroup><thead><tr><th>${L('Version','版本号')}</th><th>${L('Status','状态')}</th><th>${L('Effective at','生效时间')}</th><th>${L('File','协议文件')}</th><th>${L('Change note','变更说明')}</th><th class="col-act">${L('Action','操作')}</th></tr></thead><tbody>${rows.map(v=>`<tr class="${v.state==='active'?'ag-active':''}${v.n===ref?' ag-ref':''}"><td class="mono">v${v.n}</td><td>${tag(v.state)}${v.state==='scheduled'&&v.failed?`<span class="ag-error">${L('Activation failed','生效失败')}</span>`:''}</td><td>${when(v)}</td><td class="ag-wrap"><span class="ag-filename">${esc(v.file.name)}</span></td><td class="ag-wrap">${esc(txt(v.note))||'—'}</td><td class="col-act">${dl(v)}</td></tr>`).join('')}</tbody></table></div>`:CF.empty(L('No versions yet','暂无版本'),'',''))+restricted;
 }
 return `<section class="card" id="ag-history">${head}${body}</section>`;
}
/* 覆盖上传的留痕只记文件名与说明的变化；不含文件内容指纹或可取文件的入口。 */
function changeRows(before,after){
 const rows=[['File','文件',before.file||'—',after.file||'—',true],['Change note','变更说明',txt(before.note)||'—',txt(after.note)||'—']].filter(r=>r[4]||r[2]!==r[3]);
 return `<div class="tablewrap"><table class="tbl ag-changes"><thead><tr><th>${L('Change','变更项')}</th><th>${L('Before','覆盖前')}</th><th>${L('After','覆盖后')}</th></tr></thead><tbody>${rows.map(r=>`<tr><th>${L(r[0],r[1])}</th><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join('')}</tbody></table></div>`;
}
/* 操作进度与代币准入审核统一：名称、主体与时间、结果、直接可读的明细。 */
let activityState='default',activityPage=1;
/* 异常记录样本仅供评审：缺操作人、缺发生时间与重复到达各一条。 */
function anomalies(a){
 const n=(scheduled(a)||active(a)||{n:1}).n,base={id:'demo-anomaly-1',at:'2026-09-17T06:00:00Z',kind:'overwrite',n,summary:['demo-agreement-1.pdf → demo-agreement-2.pdf','demo-agreement-1.pdf → demo-agreement-2.pdf'],actor:'operator',identity:null,result:'success',region:null,note:''};
 return [base,clone(base),Object.assign(clone(base),{id:'demo-anomaly-2',at:null,kind:'upload',identity:IDENTITY,summary:['demo-agreement-1.pdf; takes effect','demo-agreement-1.pdf，生效时间'],region:['Shanghai','上海']})];
}
function activity(a){
 let body='';
 if(!canRecords())body=CF.empty(L('No access to activity records','无权查看操作记录'),L('The delivered configuration does not give this account agreement activity records permission.','当前交付配置未为该账号开通协议操作记录查看权限。'),'');
 else if(activityState==='error')body=CF.empty(L('Activity could not be loaded','操作进度加载失败'),L('Try again. Agreement information is still available.','请重试，协议其他信息仍可查看。'),B('activityRetry','Retry','重试'));
 else if(activityState==='loading')body=`<div class="card-b" role="status">${L('Loading activity…','正在加载操作进度…')}</div>`;
 else {
  const seen=new Set();
  const records=(activityState==='empty'?[]:a.logs.concat(activityState==='anomaly'?anomalies(a):[]))
   .filter(r=>{if(seen.has(r.id))return false;seen.add(r.id);return true;})
   .map((r,i)=>Object.assign({},r,{order:i})).sort((x,y)=>(y.at?Date.parse(y.at):0)-(x.at?Date.parse(x.at):0)||x.order-y.order);
  const pages=Math.max(1,Math.ceil(records.length/PAGE_SIZE));activityPage=Math.min(activityPage,pages);
  const item=r=>{
   const k=KINDS[r.kind]||KINDS.upload,key=a.id+':'+r.id;
   const actor=r.actor==='system'?L('System','系统'):r.identity?esc(txt(r.identity)):L('Operator: to be verified','操作人：待核实');
   const at=r.at?`<time datetime="${esc(r.at)}">${time(r.at)}</time>`:`<span>${L('Time: to be verified','操作时间：待核实')}</span>`;
   const detail=`<dl class="ag-kv">${kv(L('Summary','变更摘要'),esc(txt(r.summary))+(r.when?' '+time(r.when):''))}${kv(L('Status change','状态变化'),esc(txt(k.change)))}${['upload','overwrite'].includes(r.kind)?kv(L('Change note','变更说明'),esc(txt(r.note))||'—'):''}${r.result==='failed'?kv(L('Failure reason','失败原因'),esc(txt(r.reason))||L('None yet','暂无')):''}${r.reason&&r.result!=='failed'?kv(L('Reason','原因'),esc(txt(r.reason))):''}${r.region?kv(L('Region','来源地区'),esc(txt(r.region))):''}</dl>${r.before?changeRows(r.before,r.after):''}`;
   return `<li class="ag-event" data-log="${esc(key)}" data-tone="${k.tone}"><h3>${esc(txt(k.label))}</h3><div class="ag-event-meta"><span>${actor}</span>${at}<span>${L('Version','关联版本')} <span class="mono">${r.n?'v'+r.n:'—'}</span></span></div><p class="ag-event-result">${r.result==='failed'?L('Failed','失败'):L('Success','成功')}</p><div class="ag-event-detail">${detail}</div></li>`;
  };
  body=records.length?`<div class="card-b"><ol class="ag-timeline" aria-label="${L('Agreement activity, newest first','本协议操作进度，最新在前')}">${records.slice((activityPage-1)*PAGE_SIZE,activityPage*PAGE_SIZE).map(item).join('')}</ol></div>${records.length>PAGE_SIZE?`<div class="pager"><span class="total">${L(records.length+' records','共 '+records.length+' 条记录')}</span>${B('activityPage','Previous','上一页',activityPage-1,false,activityPage===1)}<span>${activityPage} / ${pages}</span>${B('activityPage','Next','下一页',activityPage+1,false,activityPage===pages)}</div>`:''}`:CF.empty(L('No activity yet','暂无操作记录'),'','');
 }
 return `<section class="card" id="ag-activity"><div class="ag-activity-head"><h2>${L('Activity','操作进度')}</h2></div>${body}</section>`;
}
/* 基本信息只有四项定义字段，全部只读；版本信息在版本历史中辨认。 */
function basicInfo(a){
 return `<section class="card"><div class="card-head"><h2>${L('Basic information','基本信息')}</h2></div><div class="card-b ops-facts-body"><div class="ops-facts-region"><dl class="dl ops-facts ag-basic">${fact(L('Agreement name','协议名称'),esc(txt(a.name)))}${fact(L('Agreement type','协议类型'),esc(txt(typeNames[a.type])))}${fact(L('Applicable business touchpoints','适用业务环节'),a.uses.map(u=>esc(txt(useNames[u]))).join(' · '),true)}${fact(L('Agreement purpose note','协议用途说明'),esc(txt(a.description))||'—',true)}</dl></div></div></section>`;
}
function detailPage(){
 const a=current();if(!a)return CF.empty(L('Agreement unavailable','协议不可用'),' ',B('list','Back to agreements','返回协议列表'));
 const p=scheduled(a);
 const actions=!a.online?'':(p&&canPublish()?B('cancel','Cancel scheduled version','撤销待生效',p.n):'')+(canUpload()?B('edit','Update agreement','更新协议','',true):'');
 const head=heading(txt(a.name),'',actions);
 const alt=stateSurface();if(alt)return head+`<div class="card">${alt}</div>`;
 return head+(!a.online?CF.note('warn',L('This agreement is offline. It can no longer be updated; earlier versions remain available to download.','协议已下线，无法更新或撤销；历史版本仍可下载。')):'')+`<div class="ag-stack">${basicInfo(a)}${versionHistory(a)}${activity(a)}</div>`;
}
/* 更新协议：上传弹窗只采集协议文件与变更说明，并给出本协议的格式与大小要求。 */
function startEdit(){
 const a=current();if(!a||deny('upload',a))return;
 work={a:a.id,file:null,note:''};dirty=false;errors={};CF.openLayer('modal','agUpload');
}
function syncDirty(){dirty=!!work&&(!!work.file||work.note!=='');}
function uploadLayer(){
 const a=db.agreements.find(x=>x.id===work?.a);if(!a||!work)return null;
 const w=work,locked=busy||uploading,formats=a.formats.join(' / ');
 const req=`<p class="ag-hint" id="ag-file-req">${L(formats+' · one file up to '+a.maxMB+' MB','支持 '+formats+' 格式，单个文件不超过 '+a.maxMB+' MB')}</p>`;
 const input=`<input type="file" id="ag-file" class="sr-only" tabindex="-1" accept="${a.formats.map(f=>'.'+f.toLowerCase()).join(',')}"${locked?' disabled':''}>`;
 const zone=w.file
  ?`<div id="ag-upload" class="ag-upload has-file">${CF.fileRow({key:'agreement-new',name:w.file.name,state:busy?'uploading':'ready',meta:size(w.file)+' · '+w.file.format,status:busy?L('Uploading…','正在上传…'):L('Not uploaded yet','尚未上传'),replace:{act:'ag-chooseFile'},remove:{act:'ag-removeFile'},disabled:locked})}${req}${input}</div>`
  :`<div id="ag-upload" class="ag-upload" tabindex="0" role="group" aria-labelledby="ag-file-label" aria-describedby="ag-file-req ag-file-error"><b>${L('Drop a file here','将文件拖放到此处')}</b> <label class="btn sm" for="ag-file">${L('Choose file','选择文件')}</label>${req}${input}${uploading?`<p role="status">${L('Checking file…','正在检查文件…')}</p>`:''}</div>`;
 const html=`<div class="ag-upload-form"><div class="field"><span class="field-label" id="ag-file-label">${CF.fieldLabel(L('Agreement file','协议文件'),true)}</span>${zone}<div id="ag-file-error" class="ag-error" role="alert">${esc(E(errors.file)||'')}</div></div><div class="field"><label for="ag-note">${L('Change note (optional)','变更说明（选填）')}</label><textarea id="ag-note" class="inp" aria-invalid="${!!errors.note}" aria-describedby="ag-count ag-note-error"${locked?' disabled':''}>${esc(w.note)}</textarea><span class="ag-sub ag-count" id="ag-count">${Array.from(w.note).length} / 500</span><span class="ag-error" id="ag-note-error">${esc(E(errors.note)||'')}</span></div><div class="ag-error" id="ag-submit-error" role="alert" tabindex="-1">${esc(E(errors.submit)||'')}</div></div>`;
 const foot=B('uploadCancel','Cancel','取消','',false,locked)+B('upload',busy?'Uploading…':'Upload',busy?'上传中…':'上传','',true,!w.file||locked,!w.file?L('Choose a file first','请先选择文件'):'');
 return {title:L('Update agreement','更新协议'),dismiss:true,html,foot};
}
/* 弹层每次重绘都会把焦点交给第一个控件；重绘后放回当前操作的位置。 */
function renderUpload(focus){CF.render();const el=typeof focus==='function'?focus():$(focus);if(el)el.focus({preventScroll:true});}
function focusError(){renderUpload(()=>errors.file?($('ag-upload')?.querySelector('button')||$('ag-upload')):errors.note?$('ag-note'):$('ag-submit-error'));}
/* 关闭更新协议：有未提交的文件或说明时先确认，确认后才放弃。 */
function closeUpload(target){
 if(dirty){pending={kind:'leave',a:work.a,fromUpload:true,target};CF.openLayer('modal','agConfirm',null,{type:'modal',key:'agUpload'});return;}
 discardUpload();
}
function discardUpload(){work=null;dirty=false;errors={};pending=null;CF.closeLayer();document.querySelector('[data-act="ag-edit"]')?.focus({preventScroll:true});}
function backToUpload(){pending=null;errors.modal='';CF.openLayer('modal','agUpload');}
function delayed(fn){busy=true;CF.render();setTimeout(()=>{busy=false;fn();CF.render();},550);}
/* 上传直接提交：没有待生效版本时新建下一编号，生效时间为当天 UTC 24:00；已有时覆盖其文件，版本号与生效时间不变。
   提交时按当时的协议状态判定，先后两次上传以后成功的为准。 */
function submitUpload(){
 const a=db.agreements.find(x=>x.id===work?.a);if(S.layer?.key!=='agUpload'||busy||uploading||!work||deny('upload',a))return;
 errors={};
 if(!work.file)errors.file=L('Choose an agreement file to upload.','请选择要上传的协议文件。');
 if(Array.from(work.note).length>500)errors.note=L('Use no more than 500 characters.','变更说明不得超过 500 字符。');
 if(Object.keys(errors).length){focusError();return;}
 const w=clone(work);
 delayed(()=>{
  if(!a.online){errors.submit=L('This agreement is offline. Uploads are no longer available.','协议已下线，无法上传。');setTimeout(focusError);return;}
  if(failure==='submit'){failure='';errors.submit=L('Upload failed. Nothing changed. Your file and note are kept; try again.','上传失败，协议版本未改变，已选文件与说明已保留，请重试。');setTimeout(focusError);return;}
  const file=Object.assign({},w.file,{uploaded:now()}),p=scheduled(a);let v;
  if(p){
   const before={file:p.file.name,note:clone(p.note)};
   Object.assign(p,{file,note:w.note,at:now()});p.revision++;v=p;
   log(a,'overwrite',p.n,[before.file+' → '+file.name,before.file+' → '+file.name],'operator',{note:w.note,before,after:{file:file.name,note:w.note}});
  }else{
   v={n:a.next++,state:'scheduled',file,note:w.note,plan:boundary(),at:now(),effective:null,archived:null,revision:1,failed:false};a.versions.push(v);
   log(a,'upload',v.n,[file.name+'; takes effect',file.name+'，生效时间'],'operator',{when:v.plan,note:w.note});
  }
  persist();activityPage=1;activityState='default';historyState='default';discardUpload();
  CF.toast(p?L('v'+v.n+' file replaced; still takes effect '+CF.fmtTime(v.plan),'已覆盖 v'+v.n+' 的文件，仍于 '+CF.fmtTime(v.plan)+' 生效'):L('v'+v.n+' uploaded; takes effect '+CF.fmtTime(v.plan),'v'+v.n+' 已上传，将于 '+CF.fmtTime(v.plan)+' 生效'));
 });
}
function openConfirm(kind,n){errors.modal='';pending={kind,n:Number(n),a:current().id};CF.openLayer('modal','agConfirm');}
function confirmLayer(){
 const a=db.agreements.find(a=>a.id===pending?.a);if(!a)return null;const p=pending;let title='',html='',foot='',cancel=B('close','Cancel','取消','',false,busy);
 if(p.kind==='cancel'){
  const v=a.versions.find(v=>v.n===p.n),live=active(a);title=L('Cancel scheduled version?','撤销待生效版本？');
  html=`<dl class="dl">${kv(L('Agreement','协议名称'),esc(txt(a.name)))}${kv(L('Version','版本号'),'v'+p.n)}${kv(L('Scheduled to take effect','原生效时间'),time(v?.plan))}</dl>${CF.note('warn',live?L('This version and its file will be removed. The effective version v'+live.n+' stays in effect.','该版本及其文件将被移除，当前生效版本 v'+live.n+' 不变。'):L('This version and its file will be removed. The agreement returns to Unpublished.','该版本及其文件将被移除，协议回到“未发布”。'))}`;
  foot=cancel+B('confirm',busy?'Submitting…':'Cancel scheduled version',busy?'提交中…':'确认撤销','',true,busy,'','danger');
 }else if(p.kind==='leave'){
  title=L('Discard this update?','放弃本次更新？');html='<p>'+L('The selected file and note will not be uploaded. Agreement versions stay unchanged.','已选择的文件与填写的说明不会上传，协议版本保持不变。')+'</p>';foot=B('close','Keep editing','继续编辑')+B('confirm','Discard','放弃','',true,false,'','danger');
 }
 return {title,html:'<div class="ag-confirm">'+html+(errors.modal?CF.note('red',esc(E(errors.modal))):'')+'</div>',foot};
}
function confirmAction(){
 if(busy||!pending)return;const p=pending,a=db.agreements.find(x=>x.id===p.a);
 if(p.kind==='leave'){discardUpload();if(p.navigate)p.navigate();else if(p.target)location.hash=p.target;return;}
 if(deny('publish',a)){CF.closeLayer();return;}
 const allowed=()=>{const v=scheduled(a);if(!v||v.n!==p.n){errors.modal=L('This version has already taken effect or been removed.','该版本已生效或已移除。');return false;}return true;};
 if(!allowed()){CF.render();return;}
 delayed(()=>{
  if(!allowed())return;
  if(failure==='submit'){failure='';errors.modal=L('The request failed. Nothing changed; try again.','提交失败，未发生任何变化，请重试。');return;}
  const v=scheduled(a);a.versions=a.versions.filter(x=>x!==v);
  log(a,'revoke',v.n,['Pending version and its file removed','待生效版本及文件已移除']);
  persist();errors={};pending=null;activityPage=1;activityState='default';historyState='default';CF.closeLayer();
  document.querySelector('[data-act="ag-edit"]')?.focus({preventScroll:true});
  CF.toast(L('v'+v.n+' cancelled and removed','已撤销 v'+v.n+'，该版本已移除'));
 });
}
/* 选择文件只在弹窗内检查与读取，点“上传”才提交；检查失败不影响已有版本。 */
async function upload(files){const a=db.agreements.find(x=>x.id===work?.a);if(uploading||busy||!work||deny('upload',a))return;errors.file='';errors.submit='';if(files.length!==1){errors.file=L('Choose exactly one file.','一次只能选择一个文件。');focusError();return;}const f=files[0],format=f.name.split('.').pop().toUpperCase(),limit=a.maxMB*1048576;
 if(!a.formats.includes(format)||!f.size||f.size>limit){errors.file=L('Use one non-empty '+a.formats.join('/')+' file, up to '+a.maxMB+' MB.','请选择非空 '+a.formats.join('/')+' 文件，大小不超过 '+a.maxMB+' MB。');focusError();return;}
 uploading=true;CF.render();try{const bytes=new Uint8Array(await f.arrayBuffer()),prefix=new TextDecoder().decode(bytes.slice(0,8));if(format==='PDF'&&!prefix.startsWith('%PDF-'))throw Error(L('The file is not a valid PDF. Renaming its extension is not supported.','文件并非有效 PDF，不能通过修改扩展名上传。'));if(format==='TXT'){try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch(e){throw Error(L('Choose a UTF-8 text file.','请选择 UTF-8 文本文件。'));}}
 const data=await new Promise((resolve,reject)=>{let r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f);});work.file={name:f.name,size:f.size,format,data};syncDirty();
 }catch(e){errors.file=e.message||L('The file could not be read. Choose it again.','文件读取失败，请重新选择。');}finally{uploading=false;const input=$('ag-file');if(input)input.value='';errors.file?focusError():renderUpload(()=>document.querySelector('[data-act="ag-upload"]'));}}
/* 下载按版本此刻的状态判权；版本已不存在时说明不可下载，不改取其他版本。 */
function download(a,n){
 const v=a?.versions.find(x=>x.n===n);
 if(!v){CF.toast(L('This version no longer exists and cannot be downloaded.','该版本已不存在，无法下载。'));return;}
 if(!canQuery()||(historyOnly(v)&&!canHistory())){CF.toast(L('You do not have permission to download this version.','你没有下载该版本的权限。'));return;}
 if(downloadFails){downloadFails=false;errors.download=n;return;}
 errors.download=null;const link=document.createElement('a');link.href=v.file.data;link.download=v.file.name;link.click();CF.toast(L('Download started','已开始下载'));
}
/* 到达生效日界：成功则待生效版本生效、原生效版本归档；失败则保留待生效版本，顺延到下一个 24:00。 */
function settle(a,fail){let v=scheduled(a);if(!v||!a.online)return;v.revision++;if(fail){v.failed=true;v.plan=boundary(Math.max(Date.now(),Date.parse(v.plan)||0));const live=active(a);log(a,'fail',v.n,live?['v'+live.n+' remains effective; retries at','v'+live.n+' 仍在生效，将再次生效于']:['No effective version yet; retries at','暂无生效版本，将再次生效于'],'system',{result:'failed',when:v.plan,reason:['Activation did not complete at the 24:00 boundary','24:00 生效处理未完成']});}else{let old=active(a);if(old){old.state='archived';old.archived=now();log(a,'archive',old.n,['Replaced by v'+v.n,'由 v'+v.n+' 替换'],'system');}v.state='active';v.effective=now();v.failed=false;log(a,'activate',v.n,['Took effect as scheduled','按计划生效'],'system');}persist();}
const PERMS=[[9,'Agreement content query','协议当前内容与工作版本查询'],[10,'Agreement maintenance','协议内容与版本维护'],[11,'Agreement publishing','协议版本发布'],[15,'Version history read','协议历史版本读取'],[16,'Activity records','协议操作记录查看']];
function demo(){if(OPS_PAGES.includes(S.page))return OPS.demo();
 const choices=(act,opts,value)=>`<div class="seg">${opts.map(x=>`<button data-act="ag-${act}" data-v="${x[0]}" aria-pressed="${value===x[0]}">${L(x[1],x[2])}</button>`).join('')}</div>`;
 return `<div class="grp"><h5>${L('Operations administrator','运营管理员')}</h5><p class="why">${L('All five agreement permissions are granted in this release. Controls below simulate delivery configuration faults without changing the account role.','本期五项协议权限全部开通。以下开关仅模拟交付配置异常，不改变账号角色。')}</p><h5>${L('Delivery configuration checks','交付配置核验')}</h5><div class="ops-demo-actions">${PERMS.map(([n,en,zh])=>B('grant',en+' · '+(held(n)?'on':'off'),zh+' · '+(held(n)?'已开通':'未开通'),String(n))).join('')}</div>${B('restoreGrants','Restore delivered configuration','恢复正常交付配置')}${B('missingQuery','Missing required query permission','模拟缺配套查询')}${B('expire','Expire session','会话失效')}${B('attempt','Attempt restricted write','尝试越权写入')}</div><div class="grp"><h5>${L('Version history state','版本历史状态')}</h5>${choices('historyState',[['default','Default','默认'],['loading','Loading','加载中'],['empty','Empty','暂无版本'],['error','Load error','加载失败']],historyState)}</div><div class="grp"><h5>${L('Activity state','操作进度状态')}</h5>${choices('activityState',[['default','Default','默认'],['loading','Loading','加载中'],['empty','Empty','无记录'],['error','Load error','加载失败'],['anomaly','Incomplete records','异常记录样本']],activityState)}</div><div class="grp"><h5>${L('Next operation','下次操作')}</h5>${choices('failure',[['','Normal','正常'],['submit','Submit failure','提交失败']],failure)}${B('downloadFail','Next download fails','下次下载失败')}${B('otherUpload','Another operator uploads first','模拟他人先上传')}</div><div class="grp"><h5>${L('Daily activation at 24:00','每日 24:00 生效')}</h5>${B('settle','24:00 reached · succeeds','模拟 24:00 生效成功')}${B('settleFail','24:00 reached · fails','模拟 24:00 生效失败')}</div><div class="grp">${B('bulk',bulk?'Use standard fixtures':'47-row pagination sample',bulk?'恢复标准数据':'47 条分页样本')}${B('resetData','Reset all demo data','重置全部演示数据')}</div><p class="why">${L('Demonstration data only. Changes are local to this browser. Reset clears local changes.','仅使用演示数据。改动只保存在本浏览器，重置将清除本地改动。')}</p>`;}
/* 异常配置下记录读取仍独立按 PM-AL-16 判断；不提供绕过列表查询的专用台账。 */
function recordsNote(){
 return missingQuery()
  ?CF.note('red',L('This account can maintain or publish agreement versions but has no agreement content query permission, so agreement content is refused. Ask your platform provider to correct the delivered configuration.','该账号已开通协议内容维护或版本发布，但未开通协议当前内容与工作版本查询，协议内容访问已拒绝。请联系平台建设方修正交付配置。'))
  :CF.note('warn',L('This account holds agreement activity records only. Basic information and version history are not available.','当前账号仅开通协议操作记录查看，不提供基本信息与版本历史。'));
}
function recordsDetail(){
 const a=current();
 const head=heading(txt(a.name),'')+recordsNote();
 if(S.st==='denied')return head+`<div class="card">${noAccess()}</div>`;
 return head+`<div class="ag-stack">${activity(a)}</div><div>${B('accessBack','Back to account','返回账户')}</div>`;
}
function renderContent(page){
 if(OPS_PAGES.includes(page))return OPS.content(page);
 if(!signedIn())return '';
 if(S.st==='denied'||(!canQuery()&&!(page===P.detail&&canRecords())))return heading(L('Agreements','协议管理'),'')+noAccess();
 if(page!==P.list&&!current())return CF.empty(L('Agreement unavailable','协议不可用'),L('The agreement no longer exists.','协议已不存在。'),B('list','Back to agreements','返回协议列表'));
 if(recordsOnly()&&page===P.detail)return recordsDetail();
 if(!canQuery()||S.st==='denied')return heading(L('Agreements','协议管理'),'')+stateSurface();
 if(page===P.list)return listPage();
 return detailPage();
}
/* 原“更新协议”“版本详情”地址（含共享消息目标）统一落到协议详情：更新协议改为弹窗，版本详情已取消。 */
function canonical(hash){
 const [path,query='']=hash.replace(/^#/,'').split('?'),q=new URLSearchParams(query),keep=new URLSearchParams();
 if(path!==CF.ENTRY[P.edit]&&path!==CF.ENTRY[P.version])return null;
 if(q.get('id'))keep.set('id',q.get('id'));if(q.get('view'))keep.set('view',q.get('view'));
 if(path===CF.ENTRY[P.edit])keep.set('open','upload');else if(q.get('v'))keep.set('v',q.get('v'));
 return '#'+CF.ENTRY[P.detail]+'?'+keep;
}
function beforeRender(){
 const signed=signedIn();
 if(signed&&MODULE_PAGES().includes(S.page))lastHash=location.hash;
 /* 登录失效进入共享运营登录页；重新登录后回到原页。 */
 if(!signed&&wasSigned){work=null;dirty=false;busy=false;uploading=false;errors={};pending=null;S.layer=null;if(onModule)returnHash=lastHash;}
 OPS.beforeRender();
 if(signed&&!wasSigned&&returnHash){location.hash=returnHash;returnHash='';}
 wasSigned=signed;onModule=MODULE_PAGES().includes(S.page);
 if(!signed){const c=$('acontent'),t=$('atools');if(c)c.innerHTML='';if(t)t.innerHTML='';}
 const raw=params().get('view');
 if(routeChanged&&raw!==null){filters=readView(raw);inputFilters=clone(filters);}
 viewHash=listHash();
}
function afterRender(){
 OPS.afterRender();
 if(routeChanged){routeChanged=false;const hash=location.hash,at=position(hash);requestAnimationFrame(()=>{if(location.hash!==hash)return;S.toTop=false;window.scrollTo(0,at?.y||0);const ref=Number(params().get('v'));if(S.page===P.detail&&ref){$('ag-history')?.scrollIntoView({block:'start'});return;}const el=at?.focus?$(at.focus):null;if(el)el.focus({preventScroll:true});else if(S.page===P.list&&at)$('ag-q')?.focus({preventScroll:true});});}
 /* 直接打开“更新协议”地址时，在协议详情上打开上传弹窗，并从地址中去掉一次性参数。 */
 if(S.page===P.detail&&params().get('open')==='upload'&&signedIn()){const q=params();q.delete('open');history.replaceState(null,'','#'+CF.ENTRY[P.detail]+'?'+q);oldHash=location.hash;setTimeout(()=>{if(!S.layer&&current()?.online&&canUpload())startEdit();});}
 document.querySelectorAll('.ag-filter details').forEach(el=>{el.addEventListener('toggle',()=>{if(el.open){document.querySelectorAll('.ag-filter details').forEach(other=>{if(other!==el)other.open=false;});fitFilterOptions();}});el.addEventListener('keydown',e=>{if(e.key==='Escape'){el.open=false;el.querySelector('summary').focus();e.stopPropagation();}});});
 document.querySelectorAll('[data-filter]').forEach(el=>el.addEventListener('change',()=>{let key=el.dataset.filter;if(el.type==='checkbox'){inputFilters[key]=Array.from(document.querySelectorAll(`[data-filter="${key}"]:checked`)).map(x=>x.value);const count=inputFilters[key].length;$('ag-value-'+key).textContent=count?L(count+' selected','已选 '+count+' 项'):L('All','全部');$('ag-value-'+key).closest('summary').dataset.on=count?'1':'0';}else inputFilters[key]=el.value;}));
 $('ag-q')?.addEventListener('input',e=>inputFilters.q=e.target.value);
 $('ag-q')?.addEventListener('keydown',e=>{if(e.key==='Enter'){act('ag-query');CF.render();}});
}
/* 弹窗内容在页面渲染之后才插入，表单事件统一委托在 document 上。 */
document.addEventListener('change',e=>{if(e.target.id==='ag-file')upload(e.target.files);});
document.addEventListener('input',e=>{if(e.target.id!=='ag-note'||!work)return;work.note=e.target.value;syncDirty();$('ag-count').textContent=Array.from(work.note).length+' / 500';if(errors.note&&Array.from(work.note).length<=500){errors.note='';$('ag-note-error').textContent='';e.target.setAttribute('aria-invalid','false');}});
document.addEventListener('focusout',e=>{if(e.target.id!=='ag-note'||!work)return;if(Array.from(work.note).length>500){errors.note=L('Use no more than 500 characters.','变更说明不得超过 500 字符。');$('ag-note-error').textContent=errors.note;e.target.setAttribute('aria-invalid','true');}});
document.addEventListener('dragover',e=>{if(e.target.closest?.('#ag-upload'))e.preventDefault();});
document.addEventListener('drop',e=>{if(!e.target.closest?.('#ag-upload'))return;e.preventDefault();upload(e.dataTransfer.files);});
document.addEventListener('keydown',e=>{if(e.target.id==='ag-upload'&&(e.key==='Enter'||e.key===' ')){e.preventDefault();$('ag-file')?.click();}});
function beforeAct(action,value,e){
 if(busy||uploading){if(action==='closelayer'||action.startsWith('ag-')||action==='lang'||action==='menu')return true;}
 if(action==='closelayer'){
  /* 点击弹窗内部不算关闭；Esc、关闭按钮与遮罩才算。 */
  if(e?.type==='click'&&e.target.closest('[data-stop]')&&!e.target.closest('button'))return false;
  if(S.layer?.key==='agUpload'){closeUpload();return true;}
  if(S.layer?.key==='agConfirm'&&pending?.fromUpload){backToUpload();return true;}
  pending=null;errors.modal='';
 }
 if(action==='retry'){S.st='default';return true;}if(action==='clearfilter'){resetFilter();return true;}
 return false;}
function act(action,v,e){if(!action.startsWith('ag-'))return false;let a=current();let kind=action.slice(3);
 switch(kind){
 case 'query':filters=Object.assign(clone(inputFilters),{page:1});S.st='default';saveView();break;
 case 'reset':resetFilter();break;
 case 'page':filters.page=Number(v);saveView();break;
 case 'list':navigate(P.list);break;
 case 'edit':startEdit();break;
 case 'upload':submitUpload();break;
 case 'uploadCancel':closeUpload();break;
 case 'cancel':if(S.page===P.detail&&scheduled(a)&&!deny('publish',a))openConfirm('cancel',scheduled(a).n);break;
 case 'confirm':confirmAction();break;
 case 'close':if(pending?.fromUpload){backToUpload();break;}errors.modal='';pending=null;CF.closeLayer();break;
 case 'download':download(a,Number(v));break;
 case 'chooseFile':if(work)$('ag-file')?.click();break;
 case 'removeFile':if(work){work.file=null;errors.file='';syncDirty();renderUpload(()=>$('ag-upload'));}break;
 case 'accessBack':navigate('P-O-AL-06');break;
 case 'restoreGrants':OPS.onAct('ops-preview','all');S.st='default';break;
 case 'missingQuery':OPS.onAct('ops-preview','all');OPS.onAct('ops-grant','9');S.st='default';work=null;dirty=false;errors={};break;
 case 'grant':OPS.onAct('ops-grant',v);S.st='default';work=null;dirty=false;errors={};break;
 case 'expire':OPS.onAct('ops-session-expire');break;
 case 'activityPage':activityPage=Number(v);break;
 case 'activityRetry':activityState='default';break;
 case 'activityState':activityState=v;activityPage=1;S.demo=false;break;
 case 'historyRetry':historyState='default';break;
 case 'historyState':historyState=v;S.demo=false;break;
 case 'attempt':if(!deny('upload',a))CF.toast(L('Upload permission is granted.','当前具有上传权限。'));break;
 case 'state':S.st=v;S.demo=false;break;
 case 'failure':failure=v;CF.toast(L('Next-operation setting updated','已设置下次操作结果'));break;
 case 'downloadFail':downloadFails=true;CF.toast(L('The next download will fail.','下次下载将失败。'));break;
 case 'otherUpload':if(!a||!a.online){CF.toast(L('Open an online agreement first.','请先打开已上线的协议。'));break;}{const p=scheduled(a),file=Object.assign(clone(AG_FILES['demo-4']),{uploaded:now()}),identity=['Demo operator B · ob***@example.invalid','演示运营人员 B · ob***@example.invalid'];if(p){const before={file:p.file.name,note:clone(p.note)};p.file=file;p.note='';p.revision++;log(a,'overwrite',p.n,[before.file+' → '+file.name,before.file+' → '+file.name],'operator',{identity,note:'',before,after:{file:file.name,note:''}});}else{const nv={n:a.next++,state:'scheduled',file,note:'',plan:boundary(),at:now(),effective:null,archived:null,revision:1,failed:false};a.versions.push(nv);log(a,'upload',nv.n,[file.name+'; takes effect',file.name+'，生效时间'],'operator',{identity,when:nv.plan,note:''});}persist();CF.toast(L('Another operator uploaded a file to this agreement.','已模拟其他运营人员先上传。'));}break;
 case 'settle':case 'settleFail':if(!scheduled(a))CF.toast(L('Open an agreement with a pending version.','请先打开有待生效版本的协议。'));else {settle(a,kind==='settleFail');CF.toast(L('Scheduled result updated','已更新定时处理结果'));}break;
 case 'bulk':bulk=!bulk;try{sessionStorage.setItem(STORE+'-bulk',String(bulk));}catch(e){}filters.page=1;saveView();break;
 case 'resetData':db=seed();persist();work=null;dirty=false;errors={};failure='';downloadFails=false;bulk=false;CF.opsAuth.seedDemo('admin');try{sessionStorage.removeItem(STORE+'-bulk');}catch(e){}S.st='default';activityState='default';historyState='default';activityPage=1;resetFilter();navigate(P.list);CF.toast(L('Demo data reset','演示数据已重置'));break;
 default:return false;
 }return true;
}

[P.list,P.detail].forEach(id=>CF.review.register(id,{
  group:['Agreements','协议管理'],states:id===P.list?['default','loading','empty','noresult','error','denied']:['default','loading','error','denied'],
  set(value){if(value==='denied'){OPS.onAct('ops-preview','all');[9,10,11,15,16].forEach(n=>OPS.onAct('ops-grant',String(n)));}S.st=value;},
  scenarios:()=>{if(id!==P.detail)return [];
   const find=fn=>db.agreements.find(fn);
   const upload=find(a=>a.online&&scheduled(a))||find(a=>a.online);
   return [{id:'upload',label:['Update agreement dialog','更新协议弹窗'],available:canUpload()&&!!upload,route:upload?route(P.detail,{id:upload.id,open:'upload'}):null,description:canUpload()?['Open the upload dialog on an agreement','在协议详情上打开上传弹窗']:['Upload permission required','当前账号缺少上传权限']}]
    .concat([['active',['Effective version','生效版本']],['scheduled',['Pending version','待生效版本']],['archived',['Archived version','已归档版本']],['cancelled',['Cancelled version','已取消版本']]].map(([st,label])=>{const a=find(a=>a.versions.some(v=>v.state===st)),hist=['archived','cancelled'].includes(st);return {id:st,label,available:(!hist||canHistory())&&!!a,route:a?route(P.detail,{id:a.id}):null,description:!hist||canHistory()?['Open this agreement’s version history','定位此协议的版本历史']:['Version-history permission required','当前账号缺少版本历史读取权限']};}));},
  route:()=>{if(id===P.list)return '/ops/agreements';const a=current()||db.agreements[0];return a?route(id,{id:a.id}):null;},
  reset(){if(S.st==='denied')OPS.onAct('ops-preview','all');S.st='default';failure='';downloadFails=false;activityState='default';historyState='default';},
  beforeChange(proceed){CF.AdminMenu.beforeLeave(proceed);}
}));

CF.define({...OPS,id:'operations-agreements',demoOnly:true,reviewToolsInLayer:false,
 beforeAdminNavigate(proceed){if(busy||uploading){CF.toast(L('Wait for the current operation to finish.','请等待当前操作完成。'));return}if(dirty&&S.layer?.key==='agUpload'){pending={kind:'leave',a:work.a,fromUpload:true,navigate:proceed};CF.openLayer('modal','agConfirm',null,{type:'modal',key:'agUpload'});return}remember();proceed()},
 dict:{en:{...OPS.dict.en,navAgreements:'Agreements',navGroupOps:'Operations',navAgreementDetail:'Agreement details',navAgreementEdit:'Update agreement',navAgreementVersion:'Agreement details'},zh:{...OPS.dict.zh,navAgreements:'协议管理',navGroupOps:'运营管理',navAgreementDetail:'协议详情',navAgreementEdit:'更新协议',navAgreementVersion:'协议详情'}},
 breadcrumbRoute:id=>id===P.list?(viewHash||listHash()).replace(/^#/,''):id===P.detail?route(P.detail).slice(1):null,
 allowNav:id=>MODULE_PAGES().includes(id)?reachable():OPS_PAGES.includes(id),
 demo,content:renderContent,beforeRender,afterRender,
 onBeforeAct:(action,v,e)=>beforeAct(action,v,e)||OPS.onBeforeAct(action,v,e),
 onAct:(action,v,e)=>act(action,v,e)||OPS.onAct(action,v,e),
 layers:{...OPS.layers,agUpload:uploadLayer,agConfirm:confirmLayer},
 onRoute:(prev,next)=>{work=null;dirty=false;errors={};pending=null;routeChanged=true;oldHash=location.hash;if(OPS_PAGES.includes(prev)||OPS_PAGES.includes(next))OPS.onRoute(prev,next);}});
// Guard before the shared router renders a destination, including browser Back.
window.addEventListener('hashchange',e=>{
 const legacy=canonical(location.hash);if(legacy)history.replaceState(null,'',legacy);
 const target=location.hash;
 if(target===oldHash)return;
 if(!signedIn())return;
 if(busy||uploading||(S.layer?.key==='agUpload'&&dirty)){
  e.stopImmediatePropagation();history.replaceState(null,'',oldHash);
  if(busy||uploading){CF.toast(L('Wait for the current operation to finish.','请等待当前操作完成。'));return;}
  pending={kind:'leave',a:work.a,fromUpload:true,target};CF.openLayer('modal','agConfirm',null,{type:'modal',key:'agUpload'});return;
 }
 remember(oldHash);
});
document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(a)remember();},true);
window.addEventListener('pagehide',()=>remember());

S.end='admin';S.role='ops';CF.opsAuth.seedDemo('admin');
{const legacy=canonical(location.hash);if(legacy)history.replaceState(null,'',legacy);}
if(!location.hash||location.hash==='#/')location.hash=viewHash||listHash();oldHash=location.hash;
CF.boot();
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
setInterval(()=>{let changed=false;db.agreements.forEach(a=>{let v=scheduled(a);if(a.online&&v&&!v.failed&&new Date(v.plan)<=new Date()){settle(a,false);changed=true;}});if(changed&&!busy&&!S.layer)CF.render();},1000);
})(window.CF);
