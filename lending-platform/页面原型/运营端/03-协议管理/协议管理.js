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
const STORE='hc-operations-agreements-v14', VIEW=STORE+'-view';
const P={list:'P-O-AG-01',detail:'P-O-AG-02',edit:'P-O-AG-03',version:'P-O-AG-04'};
/* 生效日界按推荐取 UTC 24:00（Q-O-AG-12）：上传当天结束的那一刻；展示按本人时区换算。 */
const boundary=(t=Date.now())=>{const d=new Date(t);return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)).toISOString();};
const now=()=>new Date().toISOString(), txt=x=>Array.isArray(x)?L(x[0],x[1]):(x||''), time=x=>x?esc(CF.fmtTime(x)).replace(/(\([^()]+\))$/, '<span class="ag-zone">$1</span>'):'—';
const labels={active:['Active','已生效'],scheduled:['Scheduled','待生效'],archived:['Archived','已归档'],cancelled:['Cancelled','已取消'],offline:['Offline','已下线'],unpublished:['Unpublished','未发布']};
const tag=s=>CF.tag(({active:'ok',scheduled:'warn',cancelled:'gray',offline:'danger'})[s]||'',txt(labels[s]));
let db,work=null,dirty=false,busy=false,uploading=false,errors={},failure='',previewFailed=false,tab='basic',pending=null,oldHash='',viewHash='';
let bulk=false,returnHash='',lastHash='',onModule=false,wasSigned=false;
try{bulk=sessionStorage.getItem(STORE+'-bulk')==='true';}catch(e){}
/* 协议列表与操作进度均固定每页 20 条，无条数切换（Q-O-AG-11 裁定）。 */
const PAGE_SIZE=20;
let filters={q:'',states:[],page:1},inputFilters=clone(filters);
try{filters=Object.assign(filters,JSON.parse(sessionStorage.getItem(VIEW)||'{}'));inputFilters=clone(filters);}catch(e){}
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
 a('DEMO-TEMPLATE',['Application template','申请模板'],'template',['financing'],[],{formats:['PDF','TXT'],maxMB:2}),
 a('DEMO-NOTICE',['Disclosure notice','告知书'],'policy',['pledge'],[vers(1,'active','demo-1'),vers(2,'scheduled','demo-5',{at:pendingAt,file:Object.assign(clone(AG_FILES['demo-5']),{uploaded:pendingAt})})]),
 a('DEMO-OFFLINE',['Legacy service agreement','历史服务协议'],'service',['repayment'],[vers(1,'archived','demo-1'),vers(2,'cancelled','demo-4',{cancelledAt:'2026-09-20T02:00:00Z',cancelReason:['Agreement taken offline','协议下线'],plan:'2026-09-21T00:00:00Z'},'2026-09-20T01:00:00Z')],{online:false})
 ].map((a,i)=>{a.order=(i+1)*10;
 const entry=(at,action,n,summary,actor,extra={})=>Object.assign({at,action,n,summary,actor,identity:actor==='system'?null:['Demo operator · op***@example.invalid','演示运营人员 · op***@example.invalid'],result:'success',region:actor==='system'?null:['Shanghai','上海']},extra);
 a.versions.forEach(v=>{
  a.logs.push(entry(v.at,['Upload','上传'],v.n,[v.file.name+'; takes effect',v.file.name+'，生效时间'],'operator',{when:v.failedAt||v.plan||v.effective}));
  if(v.effective)a.logs.push(entry(v.effective,['System activation','系统生效'],v.n,['Took effect as scheduled','按计划生效'],'system'));
  if(v.archived&&a.online)a.logs.push(entry(v.archived,['System archive','系统归档'],v.n,['Replaced by v'+(v.n+1),'由 v'+(v.n+1)+' 替换'],'system'));
  if(v.failed)a.logs.push(entry(v.failedAt,['Activation failed','到点生效失败'],v.n,['v2 remains effective; retries at','v2 仍在生效，将再次生效于'],'system',{result:'failed',when:v.plan}));
 });
 /* 下线由建设方执行：自动归档与取消记为“系统”，无版本的定义下线关联版本取“—”。 */
 if(!a.online)a.logs.push(
  entry('2026-09-20T02:00:00Z',['Agreement taken offline','协议下线'],null,['Agreement taken offline; content no longer provided','协议已下线，停止对外提供当前内容'],'system',{reason:['Agreement taken offline','协议下线']}),
  entry('2026-09-20T02:00:00Z',['Related cancellation','关联取消'],2,['Pending version cancelled on offline; kept read-only','下线取消待生效版本，该版本只读留存为已取消'],'system',{reason:['Agreement taken offline','协议下线']}),
  entry('2026-09-20T02:00:00Z',['System archive','系统归档'],1,['Archived on offline; effective time and file retained','下线归档，保留原实际生效时间与文件'],'system'));
 a.updated=a.logs.reduce((m,r)=>r.at>m?r.at:m,a.updated);
 return a;})};
}
try{db=JSON.parse(localStorage.getItem(STORE));}catch(e){}
if(!db||!db.agreements)db=seed();
function persist(){try{localStorage.setItem(STORE,JSON.stringify(db));}catch(e){CF.toast(L('Changes remain available in this session; local storage is full.','本地存储不可用，改动仅保留在当前页面。'));}}
const params=()=>new URLSearchParams(location.hash.split('?')[1]||'');
const current=()=>params().has('id')?db.agreements.find(a=>a.id===params().get('id')):(S.page===P.list?db.agreements[0]:null);
const target=a=>scheduled(a);
const operator=()=>L('Demo operator · op***@example.invalid','演示运营人员 · op***@example.invalid');
let activityState='default',activityPage=1,expandedLog=null;
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
function link(act,en,zh,value='',off=false,reason='',rowKey=value){if(act==='detail'&&!off)return `<a class="actlink" id="ag-row-${esc(rowKey)}" href="${esc(route(P.detail,{id:value,tab:'basic'}))}">${L(en,zh)}</a>`;return `<button type="button" class="actlink${off?' off':''}" data-act="ag-${act}" data-v="${esc(value)}"${off?' disabled':''} title="${esc(reason)}">${L(en,zh)}</button>`;}
const kv=(key,value)=>`<dt>${key}</dt><dd>${value}</dd>`;
const fact=(key,value,wide=false)=>`<div${wide?' class="ops-fact-wide"':''}>${kv(key,value)}</div>`;
const size=f=>f?(f.size>=1048576?(f.size/1048576).toFixed(2)+' MB':(f.size/1024).toFixed(1)+' KB'):'—';
const typeNames={service:['Service','服务类'],policy:['Policy','政策类'],template:['Template','模板类']};
const useNames={registration:['Registration','注册'],financing:['Financing request','融资申请'],pledge:['Token pledge','代币质押'],repayment:['Repayment','还款']};
function log(a,action,n,summary,actor='operator',extra={}){a.logs.unshift(Object.assign({at:now(),action,n,summary,actor,identity:actor==='system'?null:['Demo operator · op***@example.invalid','演示运营人员 · op***@example.invalid'],result:'success',region:actor==='system'?null:['Shanghai','上海']},extra));a.updated=now();}
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
function route(page,extra={}){return '#'+CF.ENTRY[page]+'?'+new URLSearchParams(Object.assign({id:params().get('id')||current()?.id||'',tab,view:JSON.stringify(filters)},extra));}
function navigate(page,a=current(),extra={}){location.hash=page===P.list?(viewHash||listHash()):route(page,Object.assign({id:a?.id||''},extra));}
function saveView(){filters=cleanView(filters);try{sessionStorage.setItem(VIEW,JSON.stringify(filters));}catch(e){}viewHash=listHash();if(S.page===P.list&&location.hash!==viewHash)location.hash=viewHash;}
let routeChanged=true,tabFocus=false,toActivity=false;
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
function noHistory(){
 return CF.empty(L('No access to version history','无权读取历史版本'),
  L('Version history is limited to operations administrators. Current and working versions remain available.','历史版本仅运营管理员可读，当前内容与工作版本仍可查看。'),'');
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
function versionActions(a,v){return `<a class="actlink" id="ag-version-${v.n}" href="${esc(route(P.version,{v:v.n,tab:'history'}))}">${L('View','查看')}</a>`+link('download','Download agreement','下载协议',v.n);}
/* 当前生效版本与待生效版本的只读查询入口，不另立信息域；历史版本入口只在版本历史内。 */
function workingVersions(a){
 const rows=[[active(a),L('Current effective version','当前生效版本')],[scheduled(a),L('Pending version','待生效版本')]].filter(([v])=>v);
 if(!rows.length)return '';
 return `<div class="ops-facts-region ag-working"><dl class="dl ops-facts">${rows.map(([v,label])=>fact(esc(label),`<span class="mono">v${v.n}</span> <a class="actlink" href="${esc(route(P.version,{v:v.n,tab:'basic'}))}">${L('View','查看')}</a>${v.state==='scheduled'?`<span class="ag-sub">${L('Takes effect','生效时间')} ${time(v.plan)}</span>${v.failed?`<span class="ag-error">${L('Last activation failed','上次生效失败')}</span>`:''}`:''}`)).join('')}</dl></div>`;
}
/* 覆盖上传的留痕只记文件名与说明的变化；不含文件内容指纹或可取文件的入口。 */
function changeRows(before,after){
 const rows=[['File','文件',before.file||'—',after.file||'—',true],['Change note','变更说明',txt(before.note)||'—',txt(after.note)||'—']].filter(r=>r[4]||r[2]!==r[3]);
 return `<div class="tablewrap"><table class="tbl ag-changes"><thead><tr><th>${L('Change','变更项')}</th><th>${L('Before','覆盖前')}</th><th>${L('After','覆盖后')}</th></tr></thead><tbody>${rows.map(r=>`<tr><th>${L(r[0],r[1])}</th><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join('')}</tbody></table></div>`;
}
function activity(a){
 let body='';
 if(!canRecords())body=CF.empty(L('No access to activity records','无权查看操作记录'),L('The delivered configuration does not give this account agreement activity records permission.','当前交付配置未为该账号开通协议操作记录查看权限。'),'');
 else if(activityState==='error')body=CF.empty(L('Activity could not be loaded','操作进度加载失败'),L('Try again. Agreement information is still available.','请重试，协议定义仍可查看。'),B('activityRetry','Retry','重试'));
 else if(activityState==='loading')body=`<div class="card-b" role="status">${L('Loading activity…','正在加载操作进度…')}</div>`;
 else {
 const records=activityState==='empty'?[]:a.logs.slice().sort((x,y)=>new Date(y.at)-new Date(x.at));const pages=Math.max(1,Math.ceil(records.length/PAGE_SIZE));activityPage=Math.min(activityPage,pages);
 body=records.length?`<div class="tablewrap"><table class="tbl ag-activity"><colgroup><col style="width:16%"><col style="width:9%"><col style="width:19%"><col style="width:18%"><col style="width:11%"><col style="width:27%"></colgroup><thead><tr>${[['Activity type','操作类型'],['Related version','关联版本'],['Operator','操作人'],['Time','操作时间'],['Result','结果'],['Summary','变更摘要']].map(x=>`<th>${L(...x)}</th>`).join('')}</tr></thead><tbody>${records.slice((activityPage-1)*PAGE_SIZE,activityPage*PAGE_SIZE).map(r=>`<tr><td>${esc(txt(r.action))}</td><td class="mono">${r.n?'v'+r.n:'—'}</td><td>${r.actor==='system'?L('System','系统'):esc(txt(r.identity)||operator())}</td><td>${time(r.at)}</td><td>${CF.tag(r.result==='failed'?'danger':'ok',r.result==='failed'?L('Failed','失败'):L('Success','成功'))}</td><td><button class="actlink ag-log-summary" id="ag-log-${a.logs.indexOf(r)}" data-act="ag-logToggle" data-v="${a.logs.indexOf(r)}" aria-expanded="${expandedLog===a.id+':'+a.logs.indexOf(r)}">${esc(txt(r.summary))}${r.when?' '+time(r.when):''}</button></td></tr>${expandedLog===a.id+':'+a.logs.indexOf(r)?`<tr><td colspan="6"><div class="ag-log-detail">${r.region?`<p>${L('Region','地区')} · ${esc(txt(r.region))}</p>`:''}${r.reason?`<p>${L('Reason','原因')} · ${esc(txt(r.reason))}</p>`:''}${r.before?changeRows(r.before,r.after):''}</div></td></tr>`:''}`).join('')}</tbody></table></div><div class="pager"><span class="total">${L(records.length+' records','共 '+records.length+' 条记录')}</span>${B('activityPage','Previous','上一页',activityPage-1,false,activityPage===1)}<span>${activityPage} / ${pages}</span>${B('activityPage','Next','下一页',activityPage+1,false,activityPage===pages)}</div>`:CF.empty(L('No activity yet','暂无操作记录'),'','');
 }
 return `<section class="card" id="ag-activity"><div class="card-head">${L('Activity','操作进度')}</div>${body}</section>`;
}
function detailPage(){
 const a=current();if(!a)return CF.empty(L('Agreement unavailable','协议不可用'),' ',B('list','Back to agreements','返回协议列表'));
 const head=heading(txt(a.name),`<span class="mono">${esc(a.id)}</span> · ${tag(state(a))}`,a.online&&(canUpload()||(canPublish()&&scheduled(a)))?B('edit','Update agreement','更新协议','',true):'');
 const alt=stateSurface();if(alt)return head+`<div class="card">${alt}</div>`;
 /* 版本历史独立按 PM-AL-15 判定，本期正常运营管理员均可进入。 */
 const sections=[['basic','Basic information','基本信息']].concat(canHistory()?[['history','Version history','版本历史']]:[]);
 const tabs=sections.length<2?'':`<nav class="ag-tabs" role="tablist" aria-label="${L('Agreement sections','协议详情分区')}">${sections.map(x=>`<button id="ag-tab-${x[0]}" role="tab" aria-controls="ag-panel" aria-selected="${tab===x[0]}" tabindex="${tab===x[0]?0:-1}" data-act="ag-tab" data-v="${x[0]}">${L(x[1],x[2])}</button>`).join('')}</nav>`;
 const definition=`<section class="card"><div class="card-head ag-section-head"><h2>${L('Agreement definition','协议定义')}</h2><span class="ag-sub">${L('System preset · Read-only','系统预置 · 只读')}</span></div><div class="card-b"><div class="ops-facts-region"><dl class="dl ag-definition ops-facts">${fact(L('Agreement code','协议标识'),esc(a.id))}${fact(L('Agreement name (EN)','协议名称（英）'),esc(a.name[0]))}${fact(L('Agreement name (ZH)','协议名称（中）'),esc(a.name[1]))}${fact(L('Agreement type code','协议类型编码'),esc(a.type.toUpperCase()))}${fact(L('Agreement type name','协议类型名称'),esc(typeNames[a.type].join(' / ')))}${fact(L('Applicable business touchpoints','适用业务环节'),a.uses.map(u=>esc(txt(useNames[u]))+' <span class="mono ag-dim">('+esc(u.toUpperCase())+')</span>').join(' · '))}${fact(L('Agreement purpose note','协议用途说明'),esc(txt(a.description)))}${fact(L('Permitted file formats','允许上传格式'),a.formats.join(', '))}${fact(L('Maximum file size','单文件大小上限'),a.maxMB+' MB')}${fact(L('Agreement availability status','协议上线状态'),a.online?L('Online','已上线'):L('Offline','已下线'))}${fact(L('Default sort order','默认排序值'),a.order||'—')}</dl></div>${workingVersions(a)}</div></section>`;
 const history=`<section class="card">${a.versions.length?`<div class="tablewrap"><table class="tbl ag-versions"><thead><tr><th>${L('Version','版本号')}</th><th>${L('Status','状态')}</th><th>${L('Effective at','生效时间')}</th><th>${L('Actions','操作')}</th></tr></thead><tbody>${a.versions.slice().sort((x,y)=>y.n-x.n).map(v=>`<tr class="${v.state==='active'?'ag-active':''}"><td class="mono">v${v.n}</td><td>${tag(v.state)}${v.failed?`<span class="ag-error">${L('Activation failed','生效失败')}</span>`:''}</td><td>${v.state==='scheduled'?`<span class="ag-sub">${L('Scheduled','计划')}</span>`:''}${time(v.state==='scheduled'?v.plan:v.effective)}</td><td><div class="ag-row">${versionActions(a,v)}</div></td></tr>`).join('')}</tbody></table></div>`:CF.empty(L('No versions yet','暂无版本'),'','')}</section>`;
 return head+(!a.online?CF.note('warn',L('This agreement is offline. Historical versions remain available to view.','协议已下线，可继续查看历史版本。')):'')+tabs+`<section id="ag-panel" role="tabpanel"${tabs?` aria-labelledby="ag-tab-${tab}"`:` aria-label="${L('Basic information','基本信息')}"`} tabindex="0">${tab==='history'&&canHistory()?history:`<div class="ag-stack">${definition}${activity(a)}</div>`}</section>`;
}
function startEdit(){
 const a=current();if(!a||!canQuery()||!a.online||!(canUpload()||(canPublish()&&scheduled(a)))){deny('upload',a);return;}
 work=null;dirty=false;errors={};navigate(P.edit,a,{v:''});
}
/* 本次办理只保存在页面内：所选文件与可选的变更说明；提交前不改变任何版本。 */
function freshWork(a){const p=scheduled(a);return {a:a.id,file:null,note:p?txt(p.note):''};}
/* 只有已选文件或改过说明才算未提交内容；移除文件后若无其他改动，可直接离开。 */
function syncDirty(){const a=current();if(!work||!a){dirty=false;return;}const f=freshWork(a);dirty=!!work.file||work.note!==f.note;}
function editor(){
 const a=current(),back=B('detail','Back to agreement','返回协议',a?.id);
 if(!canQuery()||S.st!=='default')return heading(L('Update agreement','更新协议'),'')+stateSurface();
 if(!a.online)return heading(L('Update agreement','更新协议'),esc(txt(a.name)))+`<section class="card">${CF.empty(L('This agreement is offline','协议已下线'),L('Uploads and cancellation are no longer available.','无法再上传或撤销。'),back)}</section>`;
 const p=scheduled(a),up=canUpload(),revoke=canPublish()&&!!p;
 if(!up&&!revoke)return heading(L('Update unavailable','无法更新协议'),esc(txt(a.name)),back);
 if(!work||work.a!==a.id){work=freshWork(a);dirty=false;}
 const w=work,live=active(a),at=p?p.plan:boundary(),locked=!up||busy||uploading,desc=esc(txt(a.name))+' · '+tag(state(a));
 const notice=p?CF.note('warn',p.failed
  ?L('v'+p.n+' did not take effect as scheduled and will try again at '+CF.fmtTime(p.plan)+'. Uploading a new file replaces its file.','v'+p.n+' 未能按计划生效，将于 '+CF.fmtTime(p.plan)+' 再次生效。上传新文件将覆盖它的文件。')
  :L('v'+p.n+' takes effect at '+CF.fmtTime(p.plan)+'. Uploading a new file replaces its file; the version and effective time stay the same.','v'+p.n+' 将于 '+CF.fmtTime(p.plan)+' 生效。上传新文件将覆盖它的文件，版本号与生效时间不变。')):'';
 const pendingFile=p?`<div class="ag-pending"><p class="ag-sub ag-file-caption">${L('Pending file','待生效文件')} · v${p.n}</p>${CF.fileRow({key:'agreement-pending',name:p.file.name,state:'ready',meta:size(p.file)+' · '+p.file.format,status:L('Uploaded ','上传于 ')+CF.fmtTime(p.file.uploaded),previewable:!!Object.values(AG_FILES).find(f=>f.hash===p.file.hash),preview:{act:'ag-previewPending'},download:{act:'ag-download',value:p.n}})}</div>`:'';
 const zone=up?`${p?`<p class="ag-sub ag-file-caption">${L('New file','新文件')}</p>`:''}<div id="ag-upload" class="ag-upload${w.file?' has-file':''}" tabindex="0" role="group" aria-label="${L('Choose agreement file','选择协议文件')}" aria-describedby="ag-file-error">${w.file?CF.fileRow({key:'agreement-new',name:w.file.name,state:busy?'uploading':'ready',meta:size(w.file)+' · '+w.file.format,status:busy?L('Uploading…','正在上传…'):L('Not uploaded yet','尚未上传'),replace:{act:'ag-chooseFile'},remove:{act:'ag-removeFile'},disabled:busy||uploading}):'<b>'+L('Drop a file here','将文件拖放到此处')+'</b>'}<p>${L('One file','单个文件')} · ${a.formats.join(' / ')} · ${L('Up to ','不超过 ')}${a.maxMB} MB</p><input type="file" id="ag-file" class="sr-only" accept="${a.formats.map(f=>'.'+f.toLowerCase()).join(',')}"${locked?' disabled':''}>${!w.file?`<label class="btn" for="ag-file">${L('Choose file','选择文件')}</label>`:''}${uploading?`<p role="status">${L('Checking file…','正在检查文件…')}</p>`:''}</div>`:'';
 return `<div class="ag-editor">${heading(L('Update agreement','更新协议'),desc)}${notice}<div class="ag-form"><section class="card"><div class="card-head"><h2>${CF.fieldLabel(L('Agreement file','协议文件'),up)}</h2></div><div class="card-b">${pendingFile}${zone}<div id="ag-file-error" class="ag-error" role="alert">${esc(E(errors.file)||'')}</div></div></section><section class="card"><div class="card-head"><h2>${L('Release settings','发布设置')}</h2></div><div class="card-b"><div class="ops-facts-region ag-release-region"><dl class="dl ops-facts ops-facts-single">${fact(L('Version','版本号'),`<span class="mono">v${p?p.n:a.next}</span> · ${p?L('Overwrites the pending version','覆盖待生效版本'):L('New version','新版本')}`)}${fact(L('Takes effect','生效时间'),`${time(at)}<span class="ag-sub">${L('Daily at 24:00 UTC','每天 UTC 24:00 生效')}</span>`)}${fact(L('Current effective version','当前生效版本'),`<span class="mono">${live?'v'+live.n:'—'}</span>`)}</dl></div><div class="field"><label for="ag-note">${L('Change note (optional)','变更说明（选填）')}</label><textarea id="ag-note" class="inp" aria-invalid="${!!errors.note}" aria-describedby="ag-count ag-note-error"${locked?' disabled':''}>${esc(w.note)}</textarea><span class="ag-sub" id="ag-count">${Array.from(w.note).length} / 500</span><span class="ag-error" id="ag-note-error">${esc(E(errors.note)||'')}</span></div></div></section></div><div class="ag-error" id="ag-submit-error" role="alert">${esc(E(errors.submit)||'')}</div><div class="ag-actions">${B('back','Cancel editing','取消编辑','',false,busy||uploading)}${p?B('cancel','Cancel scheduled version','撤销待生效',p.n,false,!revoke||busy||uploading):''}${B('upload',busy?'Uploading…':'Upload',busy?'上传中…':'上传','',true,!up||!w.file||busy||uploading,up&&!w.file?L('Choose a file first','请先选择文件'):'')}</div></div>`;
}
function focusError(){setTimeout(()=>{let id=errors.file?'ag-upload':errors.note?'ag-note':'ag-submit-error';$(id)?.focus();},0);}
function delayed(fn){busy=true;CF.render();setTimeout(()=>{busy=false;fn();CF.render();},550);}
/* 上传直接提交：没有待生效版本时新建下一编号，生效时间为当天 UTC 24:00；已有时覆盖其文件，版本号与生效时间不变。
   提交时按当时的协议状态判定，先后两次上传以后成功的为准。 */
function submitUpload(){
 const a=current();if(S.page!==P.edit||busy||uploading||deny('upload',a)||!work)return;
 errors={};
 if(!work.file)errors.file=L('Choose an agreement file to upload.','请选择要上传的协议文件。');
 if(Array.from(work.note).length>500)errors.note=L('Use no more than 500 characters.','变更说明不得超过 500 字符。');
 if(Object.keys(errors).length){CF.render();focusError();return;}
 const w=clone(work);
 delayed(()=>{
  if(!a.online){errors.submit=L('This agreement is offline. Uploads are no longer available.','协议已下线，无法上传。');return;}
  if(failure==='submit'){failure='';errors.submit=L('Upload failed. The pending and effective versions are unchanged. Your file is retained; try again.','上传失败，待生效版本与当前生效版本均未改变，已选文件保留，请重试。');focusError();return;}
  const file=Object.assign({},w.file,{uploaded:now()}),p=scheduled(a);let v;
  if(p){
   const before={file:p.file.name,note:clone(p.note)};
   Object.assign(p,{file,note:w.note,at:now()});p.revision++;v=p;
   log(a,['Overwrite upload','覆盖上传'],p.n,[before.file+' → '+file.name,before.file+' → '+file.name],'operator',{before,after:{file:file.name,note:w.note}});
  }else{
   v={n:a.next++,state:'scheduled',file,note:w.note,plan:boundary(),at:now(),effective:null,archived:null,revision:1,failed:false};a.versions.push(v);
   log(a,['Upload','上传'],v.n,[file.name+'; takes effect',file.name+'，生效时间'],'operator',{when:v.plan});
  }
  persist();work=null;dirty=false;errors={};tab='basic';activityPage=1;activityState='default';navigate(P.detail,a,{tab:'basic',v:''});
  CF.toast(p?L('v'+v.n+' file replaced; still takes effect '+CF.fmtTime(v.plan),'已覆盖 v'+v.n+' 的文件，仍于 '+CF.fmtTime(v.plan)+' 生效'):L('v'+v.n+' uploaded; takes effect '+CF.fmtTime(v.plan),'v'+v.n+' 已上传，将于 '+CF.fmtTime(v.plan)+' 生效'));
 });
}
function openConfirm(kind,n){errors.modal='';pending={kind,n:Number(n),a:current().id};CF.openLayer('modal','agConfirm');}
function confirmLayer(){
 const a=db.agreements.find(a=>a.id===pending?.a);if(!a)return null;const p=pending;let title='',html='',foot='',cancel=B('close','Cancel','取消','',false,busy);
 if(p.kind==='cancel'){
  const v=a.versions.find(v=>v.n===p.n),live=active(a);title=L('Cancel scheduled version?','撤销待生效版本？');
  html=`<dl class="dl">${kv(L('Agreement','协议'),esc(txt(a.name)))}${kv(L('Version','版本'),'v'+p.n)}${kv(L('Scheduled to take effect','原生效时间'),time(v?.plan))}</dl>${CF.note('warn',live?L('This version and its file will be removed. The effective version v'+live.n+' stays in effect.','该版本及其文件将被移除，当前生效版本 v'+live.n+' 不变。'):L('This version and its file will be removed. The agreement returns to Unpublished.','该版本及其文件将被移除，协议回到“未发布”。'))}${dirty?`<p class="ag-sub">${L('Your unsubmitted selection will be discarded.','本次未提交的选择不会保留。')}</p>`:''}`;
  foot=cancel+B('confirm',busy?'Submitting…':'Cancel scheduled version',busy?'提交中…':'确认撤销','',true,busy,'','danger');
 }else if(p.kind==='leave'){
  title=L('Discard unsubmitted changes?','放弃未提交的内容？');html='<p>'+L('The file you selected will not be uploaded. Agreement versions and effective times stay unchanged.','已选择的文件不会上传，协议版本与生效时间保持不变。')+'</p>';foot=cancel+B('confirm','Leave page','确认离开','',true,false,'','danger');
 }
 return {title,html:'<div class="ag-confirm">'+html+(errors.modal?CF.note('red',esc(E(errors.modal))):'')+'</div>',foot};
}
function confirmAction(){
 if(busy||!pending)return;const p=pending,a=db.agreements.find(x=>x.id===p.a);
 if(p.kind==='leave'){work=null;dirty=false;pending=null;CF.closeLayer();if(p.navigate)p.navigate();else if(p.target)location.hash=p.target;else navigate(P.detail);return;}
 if(deny('publish',a)){CF.closeLayer();return;}
 const allowed=()=>{const v=scheduled(a);if(!v||v.n!==p.n){errors.modal=L('This version has already taken effect or been removed. Return to the agreement to continue.','该版本已生效或已移除，请返回协议详情后继续。');return false;}return true;};
 if(!allowed()){CF.render();return;}
 delayed(()=>{
  if(!allowed())return;
  if(failure==='submit'){failure='';errors.modal=L('The request failed. Nothing changed; try again.','提交失败，未发生任何变化，请重试。');return;}
  const v=scheduled(a);a.versions=a.versions.filter(x=>x!==v);
  log(a,['Cancel scheduled version','撤销待生效'],v.n,['Pending version and its file removed','待生效版本及文件已移除']);
  persist();dirty=false;work=null;errors={};pending=null;tab='basic';activityPage=1;activityState='default';CF.closeLayer();navigate(P.detail,a,{tab:'basic',v:''});
  CF.toast(L('v'+v.n+' cancelled and removed','已撤销 v'+v.n+'，该版本已移除'));
 });
}
function filePreview(file){
 if(!file)return CF.empty(L('No file uploaded','尚未上传文件'),'','');
 if(previewFailed)return CF.empty(L('Preview failed','预览失败'),L('Retry or download the file.','请重试或下载文件。'),B('retryPreview','Retry preview','重试预览'));
 const sample=Object.values(AG_FILES).find(f=>f.hash===file.hash);
 return sample&&file.format==='PDF'?`<section class="ag-preview ag-paper" aria-label="${L('File text preview','文件文本预览')}"><span class="ag-sub">${L('Text preview · 1 page','文本预览 · 1 页')}</span><h3>Demonstration agreement file</h3><p>${esc(sample.name.replace(/\.pdf$/, ''))}</p><p>Sample content only. Not a legal document.</p></section>`:CF.empty(L('Download to view this file','请下载查看此文件'),L('Online preview is unavailable for this file.','此文件暂不支持在线预览。'),'');
}
function versionPage(){
 const a=current(),v=a.versions.find(v=>v.n===Number(params().get('v')));
 const fromHistory=params().get('tab')==='history'&&canHistory();
 const back=fromHistory
  ?`<a class="actlink" href="${esc(route(P.detail,{tab:'history'}))}">${L('Back to version history','返回版本历史')}</a>`
  :`<a class="actlink" href="${esc(route(P.detail,{tab:'basic'}))}">${L('Back to agreement','返回协议详情')}</a>`;
 if(!v)return heading(L('Version unavailable','版本不可用'),L('This version does not exist or was cancelled before it took effect.','该版本不存在，或已在生效前被撤销。'))+back;
 if(historyOnly(v)&&!canHistory())return heading(L('Version details','版本详情')+' · v'+v.n,esc(txt(a.name)))+`<section class="card">${noHistory()}</section>`+back;
 const head=heading(L('Version details','版本详情')+' · v'+v.n,`${esc(txt(a.name))} · ${tag(v.state)}`,B('download','Download agreement','下载协议',v.n,true));
 if(S.st!=='default')return head+`<section class="card">${stateSurface()}</section>`+back;
 const cancelled=v.state==='cancelled',isScheduled=v.state==='scheduled';
 const when=isScheduled?fact(L('Scheduled to take effect','计划生效时间'),time(v.plan)+(v.failed?`<span class="ag-error">${L('Last activation failed','上次生效失败')}</span>`:''))
  :cancelled?fact(L('Originally scheduled for','原计划生效时间'),time(v.plan))
  :fact(L('Effective at','实际生效时间'),time(v.effective));
 return head+`<div class="ag-stack"><section class="card"><div class="card-head ag-section-head"><h2>${L('Version information','版本信息')}</h2>${canRecords()?link('toActivity','Who uploaded, overwrote or cancelled it: see Activity','上传、覆盖与撤销的人员及时间见操作进度'):''}</div><div class="card-b"><div class="ops-facts-region"><dl class="dl ops-facts">${fact(L('Agreement','所属协议'),esc(txt(a.name)))}${fact(L('Agreement code','协议标识'),esc(a.id))}${fact(L('Version ID','版本标识'),esc(a.id)+'-v'+v.n)}${fact(L('File','文件名称'),esc(v.file.name))}${fact(L('Format / size','格式 / 大小'),v.file.format+' · '+size(v.file))}${fact(L('Uploaded','上传时间'),time(v.file.uploaded))}${when}${fact(L('Archived at','归档时间'),time(v.archived))}${cancelled?fact(L('Cancelled at','取消时间'),time(v.cancelledAt))+fact(L('Cancellation reason','取消原因'),esc(txt(v.cancelReason))||'—'):''}${fact(L('Change note','变更说明'),esc(txt(v.note))||'—')}${fact(L('Content fingerprint','文件内容指纹'),`<span class="hash">${esc(v.file.hash)}</span>${link('copy','Copy','复制',v.file.hash)}<span class="ag-sub">${isScheduled?L('Not yet effective; can be overwritten before it takes effect.','尚未生效，生效前可被覆盖。'):L('Fixed once effective.','生效后固定。')}</span>`,true)}</dl></div></div></section><section class="card"><div class="card-head"><h2>${L('Agreement file','协议文件')}</h2></div><div class="card-b">${CF.fileRow({key:a.id+'-v'+v.n,name:v.file.name,state:'ready',meta:v.file.format+' · '+size(v.file),status:txt(labels[v.state]),download:{act:'ag-download',value:v.n}})}${filePreview(v.file)}</div></section><div>${back}</div></div>`;
}
function workPreviewLayer(){const p=scheduled(current());return {title:L('Agreement file preview','协议文件预览'),html:canQuery()?filePreview(p?.file):CF.empty(L('Access denied','无权限'),'',''),foot:B('close','Close','关闭')};}
/* 选择文件只在本页检查与读取，点“上传”才提交；检查失败不影响已有版本。 */
async function upload(files){let a=current();if(uploading||busy||deny('upload',a)||!work)return;errors.file='';errors.submit='';if(files.length!==1){errors.file=L('Choose exactly one file.','一次只能选择一个文件。');CF.render();return;}const f=files[0],format=f.name.split('.').pop().toUpperCase(),limit=a.maxMB*1048576;
 if(!a.formats.includes(format)||!f.size||f.size>limit){errors.file=L('Use one non-empty '+a.formats.join('/')+' file, up to '+a.maxMB+' MB.','请选择非空 '+a.formats.join('/')+' 文件，大小不超过 '+a.maxMB+' MB。');CF.render();return;}
 uploading=true;CF.render();try{const bytes=new Uint8Array(await f.arrayBuffer()),prefix=new TextDecoder().decode(bytes.slice(0,8));if(format==='PDF'&&!prefix.startsWith('%PDF-'))throw Error(L('The file is not a valid PDF. Renaming its extension is not supported.','文件并非有效 PDF，不能通过修改扩展名上传。'));if(format==='TXT'){try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch(e){throw Error(L('Choose a UTF-8 text file.','请选择 UTF-8 文本文件。'));}}
 const data=await new Promise((resolve,reject)=>{let r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f);});const digest=await crypto.subtle.digest('SHA-256',bytes);work.file={name:f.name,size:f.size,format,data,hash:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')};dirty=true;
 }catch(e){errors.file=e.message||L('The file could not be read. Choose it again.','文件读取失败，请重新选择。');}finally{uploading=false;const input=$('ag-file');if(input)input.value='';CF.render();}}
function download(file){if(!canQuery()||!file)return;let a=document.createElement('a');a.href=file.data;a.download=file.name;a.click();CF.toast(L('Download started','已开始下载'));}
/* 到达生效日界：成功则待生效版本生效、原生效版本归档；失败则保留待生效版本，顺延到下一个 24:00。 */
function settle(a,fail){let v=scheduled(a);if(!v||!a.online)return;v.revision++;if(fail){v.failed=true;v.plan=boundary(Math.max(Date.now(),Date.parse(v.plan)||0));const live=active(a);log(a,['Activation failed','到点生效失败'],v.n,live?['v'+live.n+' remains effective; retries at','v'+live.n+' 仍在生效，将再次生效于']:['No effective version yet; retries at','暂无生效版本，将再次生效于'],'system',{result:'failed',when:v.plan});}else{let old=active(a);if(old){old.state='archived';old.archived=now();log(a,['System archive','系统归档'],old.n,['Replaced by v'+v.n,'由 v'+v.n+' 替换'],'system');}v.state='active';v.effective=now();v.failed=false;log(a,['System activation','系统生效'],v.n,['Took effect as scheduled','按计划生效'],'system');}persist();}
const PERMS=[[9,'Agreement content query','协议当前内容与工作版本查询'],[10,'Agreement maintenance','协议内容与版本维护'],[11,'Agreement publishing','协议版本发布'],[15,'Version history read','协议历史版本读取'],[16,'Activity records','协议操作记录查看']];
function demo(){if(OPS_PAGES.includes(S.page))return OPS.demo();
 const choices=(act,opts,value)=>`<div class="seg">${opts.map(x=>`<button data-act="ag-${act}" data-v="${x[0]}" aria-pressed="${value===x[0]}">${L(x[1],x[2])}</button>`).join('')}</div>`;
 return `<div class="grp"><h5>${L('Operations administrator','运营管理员')}</h5><p class="why">${L('All five agreement permissions are granted in this release. Controls below simulate delivery configuration faults without changing the account role.','本期五项协议权限全部开通。以下开关仅模拟交付配置异常，不改变账号角色。')}</p><h5>${L('Delivery configuration checks','交付配置核验')}</h5><div class="ops-demo-actions">${PERMS.map(([n,en,zh])=>B('grant',en+' · '+(held(n)?'on':'off'),zh+' · '+(held(n)?'已开通':'未开通'),String(n))).join('')}</div>${B('restoreGrants','Restore delivered configuration','恢复正常交付配置')}${B('missingQuery','Missing required query permission','模拟缺配套查询')}${B('expire','Expire session','会话失效')}${B('attempt','Attempt restricted write','尝试越权写入')}</div><div class="grp"><h5>${L('Activity state','操作进度状态')}</h5>${choices('activityState',[['default','Default','默认'],['loading','Loading','加载中'],['empty','Empty','无记录'],['error','Load error','加载失败']],activityState)}</div><div class="grp"><h5>${L('Next submission','下次提交')}</h5>${choices('failure',[['','Normal','正常'],['submit','Submit failure','提交失败']],failure)}${B('otherUpload','Another operator uploads first','模拟他人先上传')}${B('previewFail','Preview failure','预览失败')}</div><div class="grp"><h5>${L('Daily activation at 24:00','每日 24:00 生效')}</h5>${B('settle','24:00 reached · succeeds','模拟 24:00 生效成功')}${B('settleFail','24:00 reached · fails','模拟 24:00 生效失败')}</div><div class="grp">${B('bulk',bulk?'Use standard fixtures':'47-row pagination sample',bulk?'恢复标准数据':'47 条分页样本')}${B('resetData','Reset all demo data','重置全部演示数据')}</div><p class="why">${L('Demonstration data only. Changes are local to this browser. Reset clears local changes.','仅使用演示数据。改动只保存在本浏览器，重置将清除本地改动。')}</p>`;}
/* 异常配置下记录读取仍独立按 PM-AL-16 判断；不提供绕过列表查询的专用台账。 */
function recordsNote(){
 return missingQuery()
  ?CF.note('red',L('This account can maintain or publish agreement versions but has no agreement content query permission, so agreement content is refused. Ask your platform provider to correct the delivered configuration.','该账号已开通协议内容维护或版本发布，但未开通协议当前内容与工作版本查询，协议内容访问已拒绝。请联系平台建设方修正交付配置。'))
  :CF.note('warn',L('This account holds agreement activity records only. Agreement definitions, content and version history are not available.','当前账号仅开通协议操作记录查看，不提供协议定义、正文与版本历史。'));
}
function recordsDetail(){
 const a=current();
 const head=heading(txt(a.name),`<span class="mono">${esc(a.id)}</span> · ${a.online?L('Online','已上线'):L('Offline','已下线')}`)+recordsNote();
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
 if(page===P.edit)return editor();
 if(page===P.version)return versionPage();
 return detailPage();
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
 if(S.page===P.detail||S.page===P.edit||S.page===P.version){const requested=params().get('tab');tab=['basic','history'].includes(requested)?requested:'basic';}
 if(tab==='history'&&!canHistory())tab='basic';
}
function afterRender(){
 OPS.afterRender();
 if(routeChanged){routeChanged=false;const hash=location.hash,at=position(hash),focusTab=tabFocus;tabFocus=false;requestAnimationFrame(()=>{if(location.hash!==hash)return;S.toTop=false;window.scrollTo(0,at?.y||0);if(toActivity){toActivity=false;const log=$('ag-activity');if(log){const topbar=document.querySelector('#app .topbar');log.style.scrollMarginTop=((topbar?.getBoundingClientRect().height||0)+parseFloat(getComputedStyle(log).getPropertyValue('--sp-4')))+'px';log.scrollIntoView({block:'start'});log.querySelector('.card-head')?.setAttribute('tabindex','-1');log.querySelector('.card-head')?.focus({preventScroll:true});return;}}const el=focusTab?$('ag-tab-'+tab):(at?.focus?$(at.focus):null);if(el)el.focus({preventScroll:true});else if(S.page===P.list&&at)$('ag-q')?.focus({preventScroll:true});});}
 document.querySelectorAll('[role="tab"]').forEach(el=>el.addEventListener('keydown',e=>{const tabs=[...document.querySelectorAll('[role="tab"]')],i=tabs.indexOf(el);let n;if(e.key==='ArrowRight')n=(i+1)%tabs.length;else if(e.key==='ArrowLeft')n=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=tabs.length-1;else return;e.preventDefault();act('ag-tab',tabs[n].dataset.v);CF.render();}));
 document.querySelectorAll('.ag-filter details').forEach(el=>{el.addEventListener('toggle',()=>{if(el.open){document.querySelectorAll('.ag-filter details').forEach(other=>{if(other!==el)other.open=false;});fitFilterOptions();}});el.addEventListener('keydown',e=>{if(e.key==='Escape'){el.open=false;el.querySelector('summary').focus();e.stopPropagation();}});});
 document.querySelectorAll('[data-filter]').forEach(el=>el.addEventListener('change',()=>{let key=el.dataset.filter;if(el.type==='checkbox'){inputFilters[key]=Array.from(document.querySelectorAll(`[data-filter="${key}"]:checked`)).map(x=>x.value);const count=inputFilters[key].length;$('ag-value-'+key).textContent=count?L(count+' selected','已选 '+count+' 项'):L('All','全部');$('ag-value-'+key).closest('summary').dataset.on=count?'1':'0';}else inputFilters[key]=el.value;}));
 $('ag-q')?.addEventListener('input',e=>inputFilters.q=e.target.value);
 $('ag-q')?.addEventListener('keydown',e=>{if(e.key==='Enter'){act('ag-query');CF.render();}});
 $('ag-file')?.addEventListener('change',e=>upload(e.target.files));
 const drop=$('ag-upload');if(drop){drop.addEventListener('dragover',e=>e.preventDefault());drop.addEventListener('drop',e=>{e.preventDefault();upload(e.dataTransfer.files);});drop.addEventListener('keydown',e=>{if(e.target===drop&&(e.key==='Enter'||e.key===' ')){e.preventDefault();$('ag-file').click();}});}
 $('ag-note')?.addEventListener('input',e=>{work.note=e.target.value;syncDirty();$('ag-count').textContent=Array.from(work.note).length+' / 500';if(errors.note&&Array.from(work.note).length<=500){errors.note='';$('ag-note-error').textContent='';$('ag-note').setAttribute('aria-invalid','false');}});
 $('ag-note')?.addEventListener('blur',()=>{if(Array.from(work.note).length>500){errors.note=L('Use no more than 500 characters.','变更说明不得超过 500 字符。');$('ag-note-error').textContent=errors.note;$('ag-note').setAttribute('aria-invalid','true');}});
}
function beforeAct(action,value,e){if(busy||uploading){if(action==='closelayer'||action==='ag-close'||action.startsWith('ag-')||action==='lang'||action==='menu'){return true;}}
 if(action==='closelayer'&&e?.target.closest('[data-stop]')&&!e.target.closest('button'))return false;
  if(action==='closelayer'){pending=null;errors.modal='';}
 if(action==='retry'){S.st='default';return true;}if(action==='clearfilter'){resetFilter();return true;}
 return false;}
function act(action,v,e){if(!action.startsWith('ag-'))return false;let a=current();let kind=action.slice(3);
 switch(kind){
 case 'query':filters=Object.assign(clone(inputFilters),{page:1});S.st='default';saveView();break;
 case 'reset':resetFilter();break;
 case 'page':filters.page=Number(v);saveView();break;
 case 'list':if(dirty){pending={kind:'leave',a:a.id,target:viewHash||listHash()};CF.openLayer('modal','agConfirm');}else navigate(P.list);break;
 case 'detail':if(dirty){pending={kind:'leave',a:a.id,target:route(P.detail,{tab:'basic',v:''})};CF.openLayer('modal','agConfirm');}else{tab='basic';work=null;errors={};navigate(P.detail,db.agreements.find(x=>x.id===v)||a,{tab:'basic',v:''});}break;
 case 'back':if(dirty){openConfirm('leave');}else{work=null;navigate(P.detail,a,{v:''});}break;
 case 'tab':tab=v;tabFocus=true;navigate(P.detail,a,{tab:v});break;
 case 'toActivity':remember();toActivity=true;tab='basic';navigate(P.detail,a,{tab:'basic',v:''});break;
 case 'edit':startEdit();break;


 case 'upload':submitUpload();break;
 case 'cancel':if(S.page===P.edit&&scheduled(a)&&!deny('publish',a))openConfirm('cancel',scheduled(a).n);break;
 case 'confirm':confirmAction();break;
 case 'close':errors.modal='';pending=null;CF.closeLayer();break;
 case 'version':remember();navigate(P.version,a,{v:Number(v),tab:'history'});break;
 case 'download':download(a.versions.find(x=>x.n===Number(v))?.file);break;
 case 'chooseFile':if(canUpload()&&work)$('ag-file')?.click();break;
 case 'removeFile':if(work){work.file=null;errors.file='';syncDirty();}break;
 case 'previewPending':if(canQuery()&&scheduled(a))CF.openLayer('drawer','agWorkPreview');break;
 case 'copy':{if(!canQuery())break;let t=document.createElement('textarea');t.value=v;t.style.position='fixed';t.style.opacity='0';$('layers').appendChild(t);t.select();let ok=document.execCommand('copy');t.remove();CF.toast(ok?L('Copied','已复制'):L('Copy unavailable; select the credential to copy.','复制不可用，请选中凭据复制。'));break;}
 case 'accessBack':navigate('P-O-AL-06');break;
 case 'restoreGrants':OPS.onAct('ops-preview','all');S.st='default';break;
 case 'missingQuery':OPS.onAct('ops-preview','all');OPS.onAct('ops-grant','9');S.st='default';work=null;dirty=false;errors={};break;
 case 'grant':OPS.onAct('ops-grant',v);S.st='default';work=null;dirty=false;errors={};if(tab==='history'&&!canHistory())tab='basic';break;
 case 'expire':OPS.onAct('ops-session-expire');break;
 case 'logToggle':{const key=a.id+':'+Number(v);expandedLog=expandedLog===key?null:key;}break;
 case 'activityPage':activityPage=Number(v);break;
 case 'activityRetry':activityState='default';break;
 case 'activityState':activityState=v;S.demo=false;break;
 case 'attempt':if(!deny('upload',a))CF.toast(L('Upload permission is granted.','当前具有上传权限。'));break;
 case 'state':S.st=v;S.demo=false;break;
 case 'failure':failure=v;CF.toast(L('Next-operation setting updated','已设置下次操作结果'));break;
 case 'otherUpload':if(!a||!a.online){CF.toast(L('Open an online agreement first.','请先打开已上线的协议。'));break;}{const p=scheduled(a),file=Object.assign(clone(AG_FILES['demo-4']),{uploaded:now()}),identity=['Demo operator B · ob***@example.invalid','演示运营人员 B · ob***@example.invalid'];if(p){const before={file:p.file.name,note:clone(p.note)};p.file=file;p.revision++;log(a,['Overwrite upload','覆盖上传'],p.n,[before.file+' → '+file.name,before.file+' → '+file.name],'operator',{identity,before,after:{file:file.name,note:p.note}});}else{const nv={n:a.next++,state:'scheduled',file,note:'',plan:boundary(),at:now(),effective:null,archived:null,revision:1,failed:false};a.versions.push(nv);log(a,['Upload','上传'],nv.n,[file.name+'; takes effect',file.name+'，生效时间'],'operator',{identity,when:nv.plan});}persist();CF.toast(L('Another operator uploaded a file to this agreement.','已模拟其他运营人员先上传。'));}break;
 case 'previewFail':previewFailed=true;CF.toast(L('The next preview will fail.','下次预览将显示失败。'));break;
 case 'retryPreview':previewFailed=false;break;
 case 'settle':case 'settleFail':if(!scheduled(a))CF.toast(L('Open an agreement with a pending version.','请先打开有待生效版本的协议。'));else {settle(a,kind==='settleFail');CF.toast(L('Scheduled result updated','已更新定时处理结果'));}break;
 case 'bulk':bulk=!bulk;try{sessionStorage.setItem(STORE+'-bulk',String(bulk));}catch(e){}filters.page=1;saveView();break;
 case 'resetData':db=seed();persist();work=null;dirty=false;errors={};failure='';bulk=false;CF.opsAuth.seedDemo('admin');try{sessionStorage.removeItem(STORE+'-bulk');}catch(e){}S.st='default';previewFailed=false;tab='basic';activityState='default';activityPage=1;resetFilter();navigate(P.list);CF.toast(L('Demo data reset','演示数据已重置'));break;
 default:return false;
 }return true;
}

Object.values(P).forEach(id=>CF.review.register(id,{
  group:['Agreements','协议管理'],states:id===P.list?['default','loading','empty','noresult','error','denied']:['default','loading','error','denied'],
  set(value){if(value==='denied'){OPS.onAct('ops-preview','all');[9,10,11,15,16].forEach(n=>OPS.onAct('ops-grant',String(n)));}S.st=value;},
  scenarios:()=>id!==P.detail?[]:[['active',['Effective version','生效版本']],['scheduled',['Pending version','待生效版本']],['archived',['Archived version','已归档版本']],['cancelled',['Cancelled version','已取消版本']]].map(([st,label])=>{const a=db.agreements.find(a=>a.versions.some(v=>v.state===st));return {id:st,label,available:canHistory()&&!!a,route:a?route(P.detail,{id:a.id,tab:'history'}):null,description:canHistory()?['Locate this agreement in version history','定位此协议的版本历史']:['Version-history permission required','当前账号缺少版本历史读取权限']};}),
  route:()=>{if(id===P.list)return '/ops/agreements';const a=id===P.edit?(target(current())?current():db.agreements.find(a=>target(a))):(current()||db.agreements[0]);if(!a)return null;const v=id===P.edit?target(a):a.versions[0];return route(id,{id:a.id,v:v?.n});},
  reset(){if(S.st==='denied')OPS.onAct('ops-preview','all');S.st='default';failure='';previewFailed=false;activityState='default';},
  beforeChange(proceed){CF.AdminMenu.beforeLeave(proceed);}
}));

CF.define({...OPS,id:'operations-agreements',demoOnly:true,reviewToolsInLayer:false,
 beforeAdminNavigate(proceed){if(busy||uploading){CF.toast(L('Wait for the current operation to finish.','请等待当前操作完成。'));return}if(dirty){pending={kind:'leave',a:current()?.id,navigate:proceed};CF.openLayer('modal','agConfirm');return}remember();proceed()},
 dict:{en:{...OPS.dict.en,navAgreements:'Agreements',navGroupOps:'Operations',navAgreementDetail:'Agreement details',navAgreementEdit:'Update agreement',navAgreementVersion:'Version details'},zh:{...OPS.dict.zh,navAgreements:'协议管理',navGroupOps:'运营管理',navAgreementDetail:'协议详情',navAgreementEdit:'更新协议',navAgreementVersion:'版本详情'}},
 breadcrumbRoute:id=>id===P.list?(viewHash||listHash()).replace(/^#/,''):id===P.detail?route(P.detail,{tab}).slice(1):null,
 allowNav:id=>MODULE_PAGES().includes(id)?reachable():OPS_PAGES.includes(id),
 demo,content:renderContent,beforeRender,afterRender,
 onBeforeAct:(action,v,e)=>beforeAct(action,v,e)||OPS.onBeforeAct(action,v,e),
 onAct:(action,v,e)=>act(action,v,e)||OPS.onAct(action,v,e),
 layers:{...OPS.layers,agWorkPreview:workPreviewLayer,agConfirm:confirmLayer},
 onRoute:(prev,next)=>{if(prev===P.edit&&next!==P.edit){work=null;errors={};}routeChanged=true;oldHash=location.hash;if(OPS_PAGES.includes(prev)||OPS_PAGES.includes(next))OPS.onRoute(prev,next);}});
// Guard before the shared router renders a destination, including browser Back.
window.addEventListener('hashchange',e=>{
 const target=location.hash;
 if(target===oldHash)return;
 if(!signedIn())return;
 if(busy||uploading||(S.page===P.edit&&dirty)){
  e.stopImmediatePropagation();history.replaceState(null,'',oldHash);
  if(busy||uploading){CF.toast(L('Wait for the current operation to finish.','请等待当前操作完成。'));return;}
  pending={kind:'leave',a:current()?.id,target};CF.openLayer('modal','agConfirm');return;
 }
 remember(oldHash);
});
document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(a)remember();},true);
window.addEventListener('pagehide',()=>remember());

S.end='admin';S.role='ops';CF.opsAuth.seedDemo('admin');
if(!location.hash||location.hash==='#/')location.hash=viewHash||listHash();oldHash=location.hash;
CF.boot();
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
setInterval(()=>{let changed=false;db.agreements.forEach(a=>{let v=scheduled(a);if(a.online&&v&&!v.failed&&new Date(v.plan)<=new Date()){settle(a,false);changed=true;}});if(changed&&!busy&&!S.layer)CF.render();},1000);
})(window.CF);
