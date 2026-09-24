/* 运营端协议管理。会话与功能权限只读运营端账户与登录一处登记（CF.opsAuth）：
   PM-AL-09 协议当前内容与工作版本查询、PM-AL-10 协议内容与版本维护、PM-AL-11 协议版本发布、
   PM-AL-15 协议历史版本读取（仅管理员）、PM-AL-16 协议操作记录查看（管理员与专员固定可用，不以 09 为前提）。
   业务数据、文件与异步反馈均为本地演示。 */
(function (CF) {
'use strict';
const translations=new Map();
const OPS=CF.opsAccountModule;
const OPS_PAGES=['P-O-AL-01','P-O-AL-03','P-O-AL-04','P-O-AL-05','P-O-AL-06','P-O-AL-07'];
const S=CF.S, L=(en,zh)=>{translations.set(en,[en,zh]);translations.set(zh,[en,zh]);return CF.L(en,zh);}, esc=CF.esc, $=id=>document.getElementById(id), clone=x=>JSON.parse(JSON.stringify(x));
const E=value=>translations.has(value)?CF.L(...translations.get(value)):value;
const STORE='hc-operations-agreements-v12', VIEW=STORE+'-view';
const P={list:'P-O-AG-01',detail:'P-O-AG-02',edit:'P-O-AG-03',version:'P-O-AG-04'};
const now=()=>new Date().toISOString(), txt=x=>Array.isArray(x)?L(x[0],x[1]):(x||''), time=x=>x?esc(CF.fmtTime(x)).replace(/(\([^()]+\))$/, '<span class="ag-zone">$1</span>'):'—';
const labels={active:['Active','已生效'],scheduled:['Scheduled','待生效'],draft:['Draft','草稿'],archived:['Archived','已归档'],cancelled:['Cancelled','已取消'],offline:['Offline','已下线'],unpublished:['Unpublished','未发布']};
const tag=s=>CF.tag(({active:'ok',scheduled:'warn',draft:'accent',cancelled:'gray',offline:'danger'})[s]||'',txt(labels[s]));
let db,work=null,dirty=false,busy=false,uploading=false,errors={},failure='',previewFailed=false,tab='basic',pending=null,oldHash='',viewHash='';
let bulk=false,returnHash='',lastHash='',onModule=false,wasSigned=false;
try{bulk=sessionStorage.getItem(STORE+'-bulk')==='true';}catch(e){}
let filters={q:'',types:[],uses:[],states:[],from:'',to:'',sort:'default',dir:'desc',page:1,size:20},inputFilters=clone(filters);
try{filters=Object.assign(filters,JSON.parse(sessionStorage.getItem(VIEW)||'{}'));inputFilters=clone(filters);}catch(e){}
function seed(){
 const vers=(n,state,file,extra={})=>Object.assign({n,state,file:clone(AG_FILES[file]),note:['Updated agreement content','更新协议内容'],source:null,reagree:false,mode:state==='scheduled'?'scheduled':'immediate',plan:state==='scheduled'?new Date(Date.now()+3600000).toISOString():null,at:state==='draft'?null:'2026-09-18T02:00:00Z',effective:state==='active'||state==='archived'?'2026-09-18T02:00:00Z':null,archived:state==='archived'?'2026-09-19T02:00:00Z':null,revision:1,saved:'2026-09-18T02:00:00Z',credential:state==='draft'?null:AG_FILES[file].hash,failed:false},extra);
 const a=(id,name,type,uses,versions,extra={})=>Object.assign({id,name,type,uses,formats:['PDF'],maxMB:5,online:true,description:['Terms used in the indicated customer journeys.','用于以下业务环节的条款。'],versions,next:Math.max(0,...versions.map(v=>v.n))+1,updated:'2026-09-18T02:00:00Z',logs:[]},extra);
 return {agreements:[
 a('DEMO-SERVICE',['Service agreement','服务协议'],'service',['registration','financing','pledge','repayment'],[vers(1,'archived','demo-1'),vers(2,'active','demo-2'),vers(3,'scheduled','demo-3')]),
 a('DEMO-PRIVACY',['Privacy policy','隐私政策'],'policy',['registration'],[vers(1,'active','demo-1')]),
 a('DEMO-FIRST',['First release agreement','首版协议'],'service',['financing'],[vers(1,'scheduled','demo-3')]),
 a('DEMO-TEMPLATE',['Application template','申请模板'],'template',['financing'],[],{formats:['PDF','TXT'],maxMB:2}),
 a('DEMO-DRAFT',['Disclosure notice','告知书'],'policy',['pledge'],[vers(1,'draft','demo-5',{file:null,note:'',credential:null})]),
 a('DEMO-OFFLINE',['Legacy service agreement','历史服务协议'],'service',['repayment'],[vers(1,'archived','demo-1'),vers(2,'cancelled','demo-4',{was:'scheduled',cancelledAt:'2026-09-20T02:00:00Z',cancelReason:['Agreement taken offline','协议下线'],plan:'2026-09-21T02:00:00Z',mode:'scheduled',effective:null,archived:null})],{online:false})
 ].map((a,i)=>{a.order=(i+1)*10;a.logs=a.versions.slice().reverse().map(v=>({at:v.at||v.saved,action:v.state==='draft'?['Draft saved','保存草稿']:['Version published','发布版本'],n:v.n,summary:v.state==='scheduled'?['Scheduled release confirmed','已确认定时生效']:['Agreement file saved','已保存协议文件'],actor:'operator',identity:['Demo operator · op***@example.invalid','演示运营人员 · op***@example.invalid'],result:'success',region:['Shanghai','上海']}));
 /* 下线由建设方执行：自动归档与计划取消记为“系统”，无版本的定义下线关联版本取“—”。 */
 if(!a.online)a.logs.unshift(
  {at:'2026-09-20T02:00:00Z',action:['Agreement taken offline','协议下线'],n:null,summary:['Agreement taken offline; content no longer provided','协议已下线，停止对外提供当前内容'],actor:'system',identity:null,result:'success',region:null,reason:['Agreement taken offline','协议下线']},
  {at:'2026-09-20T02:00:00Z',action:['Scheduled plan cancelled','关联计划取消'],n:2,summary:['Plan cancelled on offline; version kept read-only as cancelled','下线取消原计划，该版本只读留存为已取消'],actor:'system',identity:null,result:'success',region:null,reason:['Agreement taken offline','协议下线']},
  {at:'2026-09-20T02:00:00Z',action:['Version archived','版本归档'],n:1,summary:['Archived on offline; effective time and file retained','下线归档，保留原实际生效时间与文件'],actor:'system',identity:null,result:'success',region:null});
 return a;})};
}
try{db=JSON.parse(localStorage.getItem(STORE));}catch(e){}
if(!db||!db.agreements)db=seed();
function persist(){try{localStorage.setItem(STORE,JSON.stringify(db));}catch(e){CF.toast(L('Changes remain available in this session; local storage is full.','本地存储不可用，改动仅保留在当前页面。'));}}
const params=()=>new URLSearchParams(location.hash.split('?')[1]||'');
const current=()=>params().has('id')?db.agreements.find(a=>a.id===params().get('id')):(S.page===P.list?db.agreements[0]:null);
const target=a=>scheduled(a)||draft(a);
const operator=()=>L('Demo operator · op***@example.invalid','演示运营人员 · op***@example.invalid');
let activityState='default',activityPage=1,activitySize=20,expandedLog=null;
const draft=a=>a?.versions.find(v=>v.state==='draft');
const scheduled=a=>a?.versions.find(v=>v.state==='scheduled');
const active=a=>a?.versions.find(v=>v.state==='active');
const state=a=>!a.online?'offline':active(a)?'active':scheduled(a)?'scheduled':draft(a)?'draft':'unpublished';
/* 已归档与已取消属于历史内容，读取须 PM-AL-15；当前与工作版本按 PM-AL-09。 */
const historyOnly=v=>['archived','cancelled'].includes(v.state);
/* 三档目标判权互不替代：内容与工作版本 09、历史版本 15、操作记录 16。 */
const can=n=>!!CF.opsAuth&&CF.opsAuth.can(n);
const held=n=>!!CF.opsAuth&&CF.opsAuth.held(n);
const signedIn=()=>can(14);
const canQuery=()=>can(9);
const canEdit=()=>can(10);
const canPublish=()=>can(11);
const canHistory=()=>can(15);
const canRecords=()=>can(16);
const recordsOnly=()=>!canQuery()&&canRecords();
const reachable=()=>canQuery()||canRecords();
/* 已开通维护或发布、但缺配套的查询权限：拒绝并说明由建设方修正交付配置，不静默通过、不自动补授权。 */
const missingQuery=()=>!canQuery()&&(held(10)||held(11));
const MODULE_PAGES=()=>[P.list,P.detail,P.edit,P.version];
function deny(kind,a=current()) {if(!a||!canQuery()||!a.online||(kind==='edit'&&!canEdit())||(kind==='publish'&&!canPublish())){CF.toast(a&&!a.online?L('This agreement is offline. Content changes are unavailable.','协议已下线，无法维护内容。'):L('You do not have permission for this action.','你没有执行此操作的权限。'));return true;}return false;}
function B(act,en,zh,value='',primary=false,disabled=false,reason=''){return `<span title="${esc(reason)}"><button type="button" class="btn${primary?' primary':''}" data-act="ag-${act}" data-v="${esc(value)}"${disabled?' disabled':''}>${L(en,zh)}</button></span>`;}
function link(act,en,zh,value='',off=false,reason='',rowKey=value){if(act==='detail'&&!off)return `<a class="actlink" id="ag-row-${esc(rowKey)}" href="${esc(route(P.detail,{id:value,tab:'basic'}))}">${L(en,zh)}</a>`;return `<button type="button" class="actlink${off?' off':''}" data-act="ag-${act}" data-v="${esc(value)}"${off?' disabled':''} title="${esc(reason)}">${L(en,zh)}</button>`;}
const kv=(key,value)=>`<dt>${key}</dt><dd>${value}</dd>`;
const size=f=>f?(f.size>=1048576?(f.size/1048576).toFixed(2)+' MB':(f.size/1024).toFixed(1)+' KB'):'—';
const typeNames={service:['Service','服务类'],policy:['Policy','政策类'],template:['Template','模板类']};
const useNames={registration:['Registration','注册'],financing:['Financing request','融资申请'],pledge:['Token pledge','代币质押'],repayment:['Repayment','还款']};
function log(a,action,n,summary,actor='operator',extra={}){a.logs.unshift(Object.assign({at:now(),action,n,summary,actor,identity:actor==='system'?null:['Demo operator · op***@example.invalid','演示运营人员 · op***@example.invalid'],result:'success',region:actor==='system'?null:['Shanghai','上海']},extra));a.updated=now();}
function heading(title,desc,actions=''){return `<div class="page-head"><div><h1 class="page-title">${esc(title)}</h1><p class="page-desc">${desc}</p></div><div class="page-actions">${actions}</div></div>`;}
// Route state is browse-only: identifiers never grant query or write permission.
const defaults=()=>({q:'',types:[],uses:[],states:[],from:'',to:'',sort:'default',dir:'desc',page:1,size:20});
function cleanView(value){
 const v=value&&typeof value==='object'?value:{},d=defaults();
 d.q=typeof v.q==='string'?v.q:'';
 for(const [k,allowed] of Object.entries({types:Object.keys(typeNames),uses:Object.keys(useNames),states:['active','scheduled','draft','unpublished','offline']}))d[k]=Array.isArray(v[k])?v[k].filter(x=>allowed.includes(x)):[];
 for(const k of ['from','to'])d[k]=typeof v[k]==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v[k])?v[k]:'';
 d.sort=['default','versions','effective'].includes(v.sort)?v.sort:'default';d.dir=v.dir==='asc'?'asc':'desc';
 d.page=Number.isSafeInteger(Number(v.page))?Math.max(1,Number(v.page)):1;d.size=[20,50,100].includes(Number(v.size))?Number(v.size):20;return d;
}
filters=cleanView(filters);inputFilters=clone(filters);
function readView(raw){try{return cleanView(JSON.parse(raw));}catch(e){return defaults();}}
function listHash(){return '#'+CF.ENTRY[P.list]+'?view='+encodeURIComponent(JSON.stringify(filters));}
function route(page,extra={}){return '#'+CF.ENTRY[page]+'?'+new URLSearchParams(Object.assign({id:params().get('id')||current()?.id||'',tab,view:JSON.stringify(filters)},extra));}
function navigate(page,a=current(),extra={}){location.hash=page===P.list?(viewHash||listHash()):route(page,Object.assign({id:a?.id||''},extra));}
function saveView(){filters=cleanView(filters);try{sessionStorage.setItem(VIEW,JSON.stringify(filters));}catch(e){}viewHash=listHash();if(S.page===P.list&&location.hash!==viewHash)location.hash=viewHash;}
let routeChanged=true,tabFocus=false;
const positions=new Map();
function remember(hash=oldHash){if(!hash)return;const active=document.activeElement;const item={y:window.scrollY,focus:active?.id||''};positions.set(hash,item);try{sessionStorage.setItem(VIEW+'-position:'+hash,JSON.stringify(item));}catch(e){}}
function position(hash){try{return positions.get(hash)||JSON.parse(sessionStorage.getItem(VIEW+'-position:'+hash)||'null');}catch(e){return null;}}
function resetFilter(){filters={q:'',types:[],uses:[],states:[],from:'',to:'',sort:'default',dir:'desc',page:1,size:20};inputFilters=clone(filters);S.st='default';saveView();}
/* 无权限与「缺配套查询权限」分别给出空态与拒绝说明。 */
function noAccess(){
 return missingQuery()
  ?CF.empty(L('Agreement access is incomplete','协议权限配置不完整'),
    L('This account can maintain or publish agreement versions but has no agreement content query permission, so the request is refused. Ask your platform provider to correct the delivered configuration.','该账号已开通协议内容维护或版本发布，但未开通协议当前内容与工作版本查询，本次访问已拒绝。请联系平台建设方修正交付配置。'),'')
  :CF.empty(L('No access to agreement content','无权查看协议内容'),
    L('The delivered configuration does not give this account agreement content query permission.','当前交付配置未为该账号开通协议当前内容与工作版本查询权限。'),'');
}
function noHistory(){
 return CF.empty(L('No access to version history','无权读取历史版本'),
  L('Version history is limited to operations administrators. Current and working versions remain available.','历史版本仅运营管理员可读，当前内容与工作版本仍可查看。'),'');
}
function stateSurface(){if(!canQuery()||S.st==='denied')return noAccess();return CF.surface({skelRows:5,emptyTitle:L('No agreements yet','暂无协议'),emptyDesc:L('Agreements are preset by the system.','协议由系统预置。')});}
function multiselect(key,label,options){let values=inputFilters[key]||[];return `<div class="field"><label id="ag-label-${key}">${label}</label><details><summary class="inp" aria-labelledby="ag-label-${key} ag-value-${key}"><span id="ag-value-${key}">${values.length?L(values.length+' selected','已选 '+values.length+' 项'):L('All','全部')}</span></summary><div class="ag-options">${Object.keys(options).map(k=>`<label><input type="checkbox" data-filter="${key}" value="${k}"${values.includes(k)?' checked':''}>${esc(txt(options[k]))}</label>`).join('')}</div></details></div>`;}
function matches(a){let q=filters.q.trim().toLowerCase();return (!q||[...a.name,a.id].some(t=>t.toLowerCase().includes(q)))&&(!filters.types.length||filters.types.includes(a.type))&&(!filters.uses.length||a.uses.some(u=>filters.uses.includes(u)))&&(!filters.states.length||filters.states.includes(state(a)))&&(!filters.from||new Date(a.updated)>=new Date(filters.from+'T00:00:00'))&&(!filters.to||new Date(a.updated)<=new Date(filters.to+'T23:59:59.999'));}
function listPage(){
 const head=heading(L('Agreements','协议管理'),L('Manage content and versions of system-preset agreements.','维护系统预置协议的内容与版本。'));
 if(!canQuery()||S.st==='denied')return head+stateSurface();
 const fs=`<div class="filters ag-filter"><div class="field"><label for="ag-q">${L('Agreement name or code','协议名称或标识')}</label><input class="inp" id="ag-q" type="search" data-filter="q" value="${esc(inputFilters.q)}"></div>${multiselect('types',L('Agreement type','协议类型'),typeNames)}${multiselect('uses',L('Applicable business touchpoints','适用业务环节'),useNames)}${multiselect('states',L('Agreement status','协议状态'),Object.fromEntries(['active','scheduled','draft','unpublished','offline'].map(k=>[k,labels[k]])))}<div class="ag-dates"><div class="field"><label for="ag-from">${L('Updated from','更新开始日期')} (${esc(S.tz)})</label><input class="inp" type="date" id="ag-from" data-filter="from" value="${esc(inputFilters.from)}"></div><div class="field"><label for="ag-to">${L('Updated through','更新结束日期')}</label><input class="inp" type="date" id="ag-to" data-filter="to" value="${esc(inputFilters.to)}"></div></div><div class="acts">${B('reset','Reset','重置')}${B('query','Search','查询','',true)}</div></div>`;
 let rows=(bulk?Array.from({length:47},(_,i)=>{let a=clone(db.agreements[i%db.agreements.length]);a.id+='-'+(i+1);a.baseId=db.agreements[i%db.agreements.length].id;return a;}):db.agreements).filter(matches);
 if(filters.sort!=='default')rows.sort((a,b)=>{let x=filters.sort==='versions'?a.versions.filter(v=>v.state!=='draft').length:new Date(active(a)?.effective||0).getTime(),y=filters.sort==='versions'?b.versions.filter(v=>v.state!=='draft').length:new Date(active(b)?.effective||0).getTime();return (x-y)*(filters.dir==='asc'?1:-1);});
 if(filters.sort==='default')rows.sort((a,b)=>(a.order||0)-(b.order||0)||new Date(b.updated)-new Date(a.updated));
 let total=['empty','noresult'].includes(S.st)?0:rows.length,maxPage=Math.max(1,Math.ceil(total/filters.size));filters.page=Math.min(filters.page,maxPage);
 let surf=stateSurface()||(!rows.length?CF.empty(L('No agreements match these filters','没有符合条件的协议'),L('Try different filters.','请调整筛选条件。'),B('reset','Reset filters','重置筛选')):null);
 const sortHeader=(key,en,zh)=>`<th aria-sort="${filters.sort===key?(filters.dir==='asc'?'ascending':'descending'):'none'}"><button data-act="ag-sort" data-v="${key}">${L(en,zh)} ${filters.sort===key?(filters.dir==='asc'?'↑':'↓'):'↕'}</button></th>`;
 const table=`<div class="tablewrap"><table class="tbl ag-table"><colgroup><col style="width:16%"><col style="width:8%"><col style="width:12%"><col style="width:13%"><col style="width:11%"><col style="width:8%"><col style="width:13%"><col style="width:12%"><col style="width:7%"></colgroup><thead><tr><th>${L('Agreement name / code','协议名称 / 标识')}</th><th>${L('Agreement type','协议类型')}</th><th>${L('Applicable business touchpoints','适用业务环节')}</th><th>${L('Current version','当前生效版本')}</th>${sortHeader('effective','Effective at','生效时间')}${sortHeader('versions','Versions','版本数')}<th>${L('Agreement status','协议状态')}</th><th>${L('Updated','最近更新')}</th><th class="col-act">${L('Action','操作')}</th></tr></thead><tbody>${rows.slice((filters.page-1)*filters.size,filters.page*filters.size).map(a=>{let v=active(a),s=scheduled(a);return `<tr><td><span class="cell-main">${esc(txt(a.name))}</span><span class="ag-sub mono">${esc(a.id)}</span></td><td>${esc(txt(typeNames[a.type]))}</td><td>${a.uses.slice(0,3).map(u=>esc(txt(useNames[u]))).join('<br>')}${a.uses.length>3?`<details><summary class="actlink">+${a.uses.length-3}</summary>${a.uses.slice(3).map(u=>esc(txt(useNames[u]))).join('<br>')}</details>`:''}</td><td>${v?'v'+v.n:'—'}${s?`<span class="ag-sub">${L('Scheduled','待生效')} v${s.n}<br>${time(s.plan)}</span>`:''}</td><td>${time(v?.effective)}</td><td class="num">${a.versions.filter(v=>v.state!=='draft').length}</td><td>${tag(state(a))}</td><td>${time(a.updated)}</td><td class="col-act">${link('detail','View','查看',a.baseId||a.id,false,'',a.id)}</td></tr>`;}).join('')}</tbody></table></div>`;
 return head+`<div class="card">${fs}${surf||table}<div class="pager"><span class="total">${L(total+' agreements','共 '+total+' 份协议')}</span><label for="ag-size">${L('Rows','每页')}</label><select class="inp" id="ag-size" style="width:80px">${[20,50,100].map(n=>`<option${n===filters.size?' selected':''}>${n}</option>`).join('')}</select>${B('page','Previous','上一页',filters.page-1,false,filters.page===1)}<span>${filters.page} / ${maxPage}</span>${B('page','Next','下一页',filters.page+1,false,filters.page===maxPage)}</div></div>`;
}
function versionActions(a,v){return `<a class="actlink" id="ag-version-${v.n}" href="${esc(route(P.version,{v:v.n,tab:'history'}))}">${L('View','查看')}</a>`+link('download','Download agreement','下载协议',v.n,!v.file,L('No file uploaded','尚未上传文件'));}
/* 当前生效版本与工作版本的只读查询入口，不另立信息域；历史版本入口只在版本历史内。 */
function workingVersions(a){
 const rows=[[active(a),L('Current effective version','当前生效版本')],[scheduled(a),L('Pending version','待生效版本')],[draft(a),L('Draft','草稿')]]
  .filter(([v])=>v&&!historyOnly(v));
 if(!rows.length)return '';
 return `<div class="ag-row ag-definition">${rows.map(([v,label])=>`<span>${esc(label)} <span class="mono">v${v.n}</span>${v.state==='scheduled'&&v.plan?` <span class="ag-sub">${time(v.plan)}</span>`:''} <a class="actlink" href="${esc(route(P.version,{v:v.n,tab:'basic'}))}">${L('View','查看')}</a></span>`).join('')}</div>`;
}
/* 旧文件的文件内容指纹属于历史内容，仅管理员（PM-AL-15）可见；其余人核对文件名、计划与说明。 */
function changeRows(before,after,all=false,fingerprint=true){
 const rows=[['File','文件',before.file?.name||'—',after.file?.name||'—'],['Content fingerprint','文件内容指纹',before.file?.hash||'—',after.file?.hash||'—'],['Effective mode','生效方式',txt(before.mode==='scheduled'?['Scheduled','定时生效']:['Immediately','立即生效']),txt(after.mode==='scheduled'?['Scheduled','定时生效']:['Immediately','立即生效'])],['Scheduled time','计划时间',before.mode==='scheduled'?CF.fmtTime(before.plan):'—',after.mode==='scheduled'?CF.fmtTime(after.plan):'—'],['Change note','变更说明',txt(before.note)||'—',(sameNote(before.note,after.note)?txt(before.note):txt(after.note))||'—'],['Re-consent flag','需重新同意标记',txt(before.reagree?['Yes','是']:['No','否']),txt(after.reagree?['Yes','是']:['No','否'])]].filter(r=>(fingerprint||r[0]!=='Content fingerprint')&&(all||r[2]!==r[3]));
 return `<div class="tablewrap"><table class="tbl ag-changes"><thead><tr><th>${L('Change','变更项')}</th><th>${L('Before','调整前')}</th><th>${L('After','调整后')}</th></tr></thead><tbody>${rows.map(r=>`<tr><th>${L(r[0],r[1])}</th><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join('')}</tbody></table></div>`;
}
function activity(a){
 let body='';
 if(!canRecords())body=CF.empty(L('No access to activity records','无权查看操作记录'),L('The delivered configuration does not give this account agreement activity records permission.','当前交付配置未为该账号开通协议操作记录查看权限。'),'');
 else if(activityState==='error')body=CF.empty(L('Activity could not be loaded','操作进度加载失败'),L('Try again. Agreement information is still available.','请重试，协议定义仍可查看。'),B('activityRetry','Retry','重试'));
 else if(activityState==='loading')body=`<div class="card-b" role="status">${L('Loading activity…','正在加载操作进度…')}</div>`;
 else {
 const records=activityState==='empty'?[]:a.logs.slice().sort((x,y)=>new Date(y.at)-new Date(x.at));const pages=Math.max(1,Math.ceil(records.length/activitySize));activityPage=Math.min(activityPage,pages);
 body=records.length?`<div class="tablewrap"><table class="tbl ag-activity"><colgroup><col style="width:16%"><col style="width:7%"><col style="width:19%"><col style="width:18%"><col style="width:9%"><col style="width:31%"></colgroup><thead><tr>${[['Activity type','操作类型'],['Related version','关联版本'],['Operator','操作人'],['Time','操作时间'],['Result','结果'],['Summary','变更摘要']].map(x=>`<th>${L(...x)}</th>`).join('')}</tr></thead><tbody>${records.slice((activityPage-1)*activitySize,activityPage*activitySize).map(r=>`<tr><td>${esc(txt(r.action))}</td><td class="mono">${r.n?'v'+r.n:'—'}</td><td>${r.actor==='system'?L('System','系统'):esc(txt(r.identity)||operator())}</td><td>${time(r.at)}</td><td>${CF.tag(r.result==='failed'?'danger':'ok',r.result==='failed'?L('Failed','失败'):L('Success','成功'))}</td><td><button class="actlink ag-log-summary" id="ag-log-${a.logs.indexOf(r)}" data-act="ag-logToggle" data-v="${a.logs.indexOf(r)}" aria-expanded="${expandedLog===a.logs.indexOf(r)}">${esc(txt(r.summary))}</button></td></tr>${expandedLog===a.logs.indexOf(r)?`<tr><td colspan="6"><div class="ag-log-detail">${r.region?`<p>${L('Region','地区')} · ${esc(txt(r.region))}</p>`:''}${r.reason?`<p>${L('Reason','原因')} · ${esc(txt(r.reason))}</p>`:''}${r.before?changeRows(r.before,r.after,true,canHistory())+(canHistory()?`<p>${L('Confirmed snapshots · Not effective agreement files','确认时的文件记录 · 非生效协议文件')}</p><div class="ag-row">${B('auditFile','View previous file','查看调整前文件',a.logs.indexOf(r)+':before')}${B('auditDownload','Download previous file','下载调整前文件',a.logs.indexOf(r)+':before')}${B('auditFile','View confirmed file','查看确认后文件',a.logs.indexOf(r)+':after')}${B('auditDownload','Download confirmed file','下载确认后文件',a.logs.indexOf(r)+':after')}</div>`:`<p class="ag-sub">${L('Replaced files are historical content; reading them requires agreement version history permission.','被替换的文件属于历史内容，读取需协议历史版本读取权限。')}</p>`):''}</div></td></tr>`:''}`).join('')}</tbody></table></div><div class="pager"><span class="total">${L(records.length+' records','共 '+records.length+' 条记录')}</span><label for="ag-activity-size">${L('Rows','每页')}</label><select class="inp" id="ag-activity-size" style="width:80px">${[20,50,100].map(n=>`<option${n===activitySize?' selected':''}>${n}</option>`).join('')}</select>${B('activityPage','Previous','上一页',activityPage-1,false,activityPage===1)}<span>${activityPage} / ${pages}</span>${B('activityPage','Next','下一页',activityPage+1,false,activityPage===pages)}</div>`:CF.empty(L('No activity yet','暂无操作记录'),'','');
 }
 return `<section class="card" id="ag-activity"><div class="card-head">${L('Activity','操作进度')}</div>${body}</section>`;
}
function detailPage(){
 const a=current();if(!a)return CF.empty(L('Agreement unavailable','协议不可用'),' ',B('list','Back to agreements','返回协议列表'));
 const head=heading(txt(a.name),`<span class="mono">${esc(a.id)}</span> · ${tag(state(a))}`,a.online&&(canEdit()||canPublish())?B('edit','Update agreement','更新协议','',true):'');
 const alt=stateSurface();if(alt)return head+`<div class="card">${alt}</div>`;
 /* 版本历史仅运营管理员（PM-AL-15）可进入，专员不出现该入口。 */
 const sections=[['basic','Basic information','基本信息']].concat(canHistory()?[['history','Version history','版本历史']]:[]);
 const tabs=sections.length<2?'':`<nav class="ag-tabs" role="tablist" aria-label="${L('Agreement sections','协议详情分区')}">${sections.map(x=>`<button id="ag-tab-${x[0]}" role="tab" aria-controls="ag-panel" aria-selected="${tab===x[0]}" tabindex="${tab===x[0]?0:-1}" data-act="ag-tab" data-v="${x[0]}">${L(x[1],x[2])}</button>`).join('')}</nav>`;
 const definition=`<section class="card"><div class="card-head">${L('Agreement definition','协议定义')}</div><div class="card-b"><p class="muted">${L('System preset · Read-only','系统预置 · 只读')}</p><dl class="dl ag-definition">${kv(L('Agreement code','协议标识'),esc(a.id))}${kv(L('Agreement name (EN)','协议名称（英）'),esc(a.name[0]))}${kv(L('Agreement name (ZH)','协议名称（中）'),esc(a.name[1]))}${kv(L('Agreement type code','协议类型编码'),esc(a.type.toUpperCase()))}${kv(L('Agreement type name','协议类型名称'),esc(typeNames[a.type].join(' / ')))}${kv(L('Applicable business touchpoints','适用业务环节'),a.uses.map(u=>esc(txt(useNames[u]))+' <span class="mono ag-dim">('+esc(u.toUpperCase())+')</span>').join(' · '))}${kv(L('Agreement purpose note','协议用途说明'),esc(txt(a.description)))}${kv(L('Permitted file formats','允许上传格式'),a.formats.join(', '))}${kv(L('Maximum file size','单文件大小上限'),a.maxMB+' MB')}${kv(L('Agreement availability status','协议上线状态'),a.online?L('Online','已上线'):L('Offline','已下线'))}${kv(L('Default sort order','默认排序值'),a.order||'—')}</dl>${workingVersions(a)}</div></section>`;
 const history=`<section class="card">${a.versions.length?`<div class="tablewrap"><table class="tbl ag-versions"><thead><tr><th>${L('Version','版本号')}</th><th>${L('Status','状态')}</th><th>${L('Effective at','生效时间')}</th><th>${L('Actions','操作')}</th></tr></thead><tbody>${a.versions.slice().sort((x,y)=>y.n-x.n).map(v=>`<tr class="${v.state==='active'?'ag-active':''}"><td class="mono">v${v.n}</td><td>${tag(v.state)}${v.failed?`<span class="ag-error">${L('Activation failed','生效失败')}</span>`:''}</td><td>${v.state==='scheduled'?`<span class="ag-sub">${L('Scheduled','计划')}</span>`:''}${time(v.state==='scheduled'?v.plan:v.effective)}</td><td><div class="ag-row">${versionActions(a,v)}</div>${!v.file?`<span class="ag-sub">${L('No file uploaded','尚未上传文件')}</span>`:''}</td></tr>`).join('')}</tbody></table></div>`:CF.empty(L('No versions yet','暂无版本'),'','')}</section>`;
 return head+(!a.online?CF.note('yellow',L('This agreement is offline. Historical versions remain available to view.','协议已下线，可继续查看历史版本。')):'')+tabs+`<section id="ag-panel" role="tabpanel"${tabs?` aria-labelledby="ag-tab-${tab}"`:` aria-label="${L('Basic information','基本信息')}"`} tabindex="0">${tab==='history'&&canHistory()?history:`<div class="ag-stack">${definition}${activity(a)}</div>`}</section>`;
}
function startEdit(){
 const a=current();if(!a||!canQuery()||!a.online||(!canEdit()&&!canPublish())){deny('edit',a);return;}
 let d=target(a);if(!d){if(!canEdit()){CF.toast(L('No content is available to publish.','暂无可发布内容。'));return;}
 const src=active(a);d={n:a.next++,state:'draft',file:src?clone(src.file):null,note:'',source:null,mode:'immediate',plan:null,reagree:false,revision:1,saved:null,at:null,effective:null,archived:null,credential:null};a.versions.push(d);log(a,['Draft created','创建草稿'],d.n,['New draft','新草稿']);persist();}
 work=clone(d);work.note=txt(work.note);dirty=false;errors={};navigate(P.edit,a,{v:d.n});
}
function formDate(iso){if(!iso)return '';const d=new Date(iso);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
function editor(){let a=current(),d=target(a);if(!canEdit()&&!canPublish())return heading(L('Update unavailable','无法更新协议'),L('Content maintenance or publishing permission is required.','需要维护或发布权限。'),B('detail','Back to agreement','返回协议',a?.id));if(!canQuery()||S.st!=='default')return heading(L('Update agreement','更新协议'),'')+stateSurface();
 if(!work){const requested=params().get('v');if(requested&&(!d||d.n!==Number(requested)))return heading(L('Version is no longer editable','该版本已不可编辑'),L('Return to the agreement and choose Update agreement.','请返回协议详情后更新协议。'),B('detail','Back to agreement','返回协议',a.id));if(d){work=clone(d);work.note=txt(work.note);dirty=false;}}
 if(!work)return heading(L('No content available','暂无可处置内容'),L('Return to the agreement to update it.','请返回协议详情更新协议。'),B('detail','Back to agreement','返回协议',a.id));
 let w=work,stale=!a.versions.some(v=>v.n===w.n&&v.state===w.state),isScheduled=w.state==='scheduled',readonly=!canEdit()||!a.online||stale,desc=tag(w.state)+' <span class="mono">v'+w.n+'</span> · '+esc(txt(a.name));

 return `<div class="ag-editor">${heading(L('Update agreement','更新协议'),desc)}${stale?CF.note('red',L('This version is now effective or unavailable. Return to the agreement to update it. Your input is retained for reference.','该版本已生效或不可用，请返回协议详情后更新协议。当前输入保留供核对。')):''}${isScheduled?CF.note('yellow',L('The confirmed file and schedule remain in effect until this update succeeds. Cancelling edits does not cancel activation.','更新成功前，已确认的文件与计划继续有效；取消编辑不会撤销生效计划。')):''}${isScheduled&&canEdit()&&!canPublish()?CF.note('yellow',L('You can prepare changes, but publishing permission is required to confirm this update.','可以准备调整内容，但需具备发布权限才能确认更新。')):''}${readonly?`<div class="ag-access">${L('Content is read-only with your current permissions.','当前权限下内容只读。')}</div>`:''}<div class="ag-form"><section class="card"><div class="card-head">${L('Agreement file','协议文件')}</div><div class="card-b"><div id="ag-upload" class="ag-upload" tabindex="0" role="group" aria-label="${L('Upload agreement file','上传协议文件')}" aria-describedby="ag-file-error">${w.file?CF.fileRow({key:'agreement-work',name:w.file.name,state:uploading?'uploading':'ready',meta:size(w.file)+' · '+w.file.format,status:uploading?L('Uploading…','正在上传…'):CF.fmtTime(w.file.uploaded),previewable:!!Object.values(AG_FILES).find(f=>f.hash===w.file.hash),preview:{act:'ag-previewWork'},download:{act:'ag-downloadWork'},replace:readonly?null:{act:'ag-chooseFile'},disabled:busy||uploading}):'<b>'+L('Drop a file here','将文件拖放到此处')+'</b>'}<p>${L('One file','单个文件')} · ${a.formats.join(' / ')} · ${L('Up to ','不超过 ')}${a.maxMB} MB</p><input type="file" id="ag-file" class="sr-only" accept="${a.formats.map(f=>'.'+f.toLowerCase()).join(',')}"${readonly||uploading?' disabled':''}>${!w.file?`<label class="btn" for="ag-file"${readonly?' aria-disabled="true"':''}>${L('Choose file','选择文件')}</label>`:''}${uploading&&!w.file?`<p role="status">${L('Uploading…','正在上传…')}</p><progress class="ag-progress"></progress>`:''}</div><div id="ag-file-error" class="ag-error" role="alert">${esc(E(errors.file)||'')}</div>${w.source?`<p>${link('version','Based on v'+w.source,'基于 v'+w.source,w.source)}</p>`:''}</div></section><section class="card"><div class="card-head">${L('Release settings','发布设置')}</div><div class="card-b"><div class="field"><label>${L('Version','版本号')}</label><span class="mono">v${w.n}</span></div><div class="field"><label for="ag-mode">${L('Effective mode','生效方式')}</label><select class="inp" id="ag-mode"${readonly?' disabled':''}><option value="immediate"${w.mode==='immediate'?' selected':''}>${L('Immediately','立即生效')}</option><option value="scheduled"${w.mode==='scheduled'?' selected':''}>${L('Scheduled','定时生效')}</option></select></div>${w.mode==='scheduled'?`<div class="field"><label for="ag-plan">${L('Scheduled time','计划生效时间')} (${esc(S.tz)})</label><input id="ag-plan" class="inp" type="datetime-local" value="${formDate(w.plan)}"${readonly?' disabled':''} aria-invalid="${!!errors.plan}" aria-describedby="ag-plan-error"><span class="ag-sub">${L('At least 5 minutes from confirmation.','确认发布时至少晚于当前时间 5 分钟。')}</span><span class="ag-error" id="ag-plan-error">${esc(E(errors.plan)||'')}</span></div>`:''}<div class="field"><label for="ag-note">${L('Change note','变更说明')}</label><textarea id="ag-note" class="inp" aria-invalid="${!!errors.note}" aria-describedby="ag-note-error"${readonly?' disabled':''}>${esc(w.note)}</textarea><span class="ag-sub" id="ag-count">${Array.from(w.note).length} / 500</span><span class="ag-error" id="ag-note-error">${esc(E(errors.note)||'')}</span></div><label class="ag-row"><input id="ag-reagree" type="checkbox"${w.reagree?' checked':''}${readonly?' disabled':''}>${L('Re-consent flag','需重新同意标记')}</label><p class="ag-sub">${L('Stores the flag only. No user prompt or notification is sent.','仅保留标记，不触发用户弹窗或通知。')}</p></div></section></div><div class="ag-error" id="ag-submit-error" role="alert">${esc(E(errors.submit)||'')}${errors.conflict?' '+B('refreshDraft','Reload version','刷新版本'):''}</div><div class="ag-actions">${B('back','Cancel editing','取消编辑','',false,busy||uploading)}${isScheduled?B('cancel','Cancel schedule','撤销待生效',w.n,false,!canPublish()||!a.online||stale||busy||uploading):B('discard','Discard draft','丢弃草稿',w.n,false,readonly||busy||uploading)}${!isScheduled?B('save',busy?'Saving…':'Save draft',busy?'保存中…':'保存草稿','',false,readonly||busy||uploading):''}${B('publish',busy?'Submitting…':isScheduled?'Confirm update':'Publish',busy?'提交中…':isScheduled?'确认更新':'发布',w.n,true,!canPublish()||!a.online||stale||busy||uploading||(isScheduled&&(!canEdit()||!hasChanges(a,w))),L('Publishing permission is required; scheduled updates also require maintenance permission and changes.','需要发布权限；待生效调整还需维护权限且有内容变化。'))}</div></div>`;
}
function validate(w,publish){errors={};if(Array.from(txt(w.note)).length>500)errors.note=L('Use no more than 500 characters.','变更说明不得超过 500 字符。');if(publish){if(!w.file)errors.file=L('Upload an agreement file before publishing.','请先上传协议文件。');if(!txt(w.note).trim())errors.note=L('Enter a change note before publishing.','发布前请填写变更说明。');if(w.mode==='scheduled'&&(!w.plan||new Date(w.plan).getTime()-Date.now()<300000))errors.plan=L('Choose a time at least 5 minutes from now.','计划时间须至少晚于当前时间 5 分钟。');}return !Object.keys(errors).length;}
function focusError(){setTimeout(()=>{let id=errors.file?'ag-upload':errors.note?'ag-note':errors.plan?'ag-plan':'ag-submit-error';$(id)?.focus();},0);}
const sameNote=(a,b)=>Array.isArray(a)?a.includes(txt(b)):Array.isArray(b)?b.includes(txt(a)):a===b;
function hasChanges(a,w){const old=a.versions.find(v=>v.n===w.n);return !!old&&(old.file?.hash!==w.file?.hash||old.file?.name!==w.file?.name||!sameNote(old.note,w.note)||old.mode!==w.mode||old.plan!==w.plan||old.reagree!==w.reagree);}
function revisionOkay(a,w){
 const d=a.versions.find(v=>v.n===w.n);
 if(!d||!['draft','scheduled'].includes(d.state)||d.state!==w.state){errors.submit=L('This version is now effective or unavailable. Return to the agreement to update it.','该版本已生效或不可用，请返回协议详情后更新协议。');errors.conflict=false;return false;}
 if(d.revision!==w.revision){errors.submit=L('This version was updated by another operator. Reload it and try again.','版本已被其他运营人员更新，请刷新后重试。');errors.conflict=true;return false;}
 if(w.state==='draft'&&scheduled(a)){errors.submit=L('A scheduled version already exists. Return to the agreement to update that version.','已有待生效版本，请返回协议详情调整该版本。');return false;}return true;
}
function commitWork(a,w){let old=a.versions.find(v=>v.n===w.n),copy=clone(w);if(sameNote(old.note,copy.note))copy.note=clone(old.note);copy.revision++;if(copy.state==='draft'){copy.saved=now();copy.savedBy=['Demo operator · op***@example.invalid','演示运营人员 · op***@example.invalid'];if(old?.file?.hash!==copy.file?.hash||old?.file?.name!==copy.file?.name)log(a,['File uploaded / replaced','上传 / 替换文件'],copy.n,[(old?.file?.name||'—')+' → '+(copy.file?.name||'—'),(old?.file?.name||'—')+' → '+(copy.file?.name||'—')]);}a.versions[a.versions.indexOf(old)]=copy;return copy;}

function delayed(fn){busy=true;CF.render();setTimeout(()=>{busy=false;fn();CF.render();},550);}
function saveDraft(){let a=current();if(busy||uploading||deny('edit',a)||work?.state!=='draft')return;if(!validate(work,false)||!revisionOkay(a,work)){CF.render();focusError();return;}delayed(()=>{if(!revisionOkay(a,work))return;if(failure==='submit'){failure='';errors.submit=L('Save failed. Your file and inputs are retained. Try again.','保存失败，文件与输入已保留，请重试。');return;}let v=commitWork(a,work);log(a,['Draft saved','保存草稿'],v.n,['Draft content saved','已保存草稿内容']);persist();work=clone(v);work.note=txt(work.note);dirty=false;CF.toast(L('Draft saved','草稿已保存'));});}
function publishStart(n){
 const a=current(),w=work;if(S.page!==P.edit||busy||uploading||deny('publish',a)||!w||w.n!==Number(n))return;
 if(w.state==='scheduled'&&(!canEdit()||!hasChanges(a,w)))return;
 if(hasChanges(a,w)&&!canEdit()){CF.toast(L('Maintenance permission is required to change content.','修改内容需要维护权限。'));return;}
 if(!validate(w,true)||!revisionOkay(a,w)){CF.render();focusError();return;}
 errors.modal='';pending={kind:'publish',w:clone(w),before:clone(a.versions.find(v=>v.n===w.n)),a:a.id};CF.openLayer('modal','agConfirm');
}
function openConfirm(kind,n){errors.modal='';pending={kind,n:Number(n),a:current().id,revision:current().versions.find(v=>v.n===Number(n))?.revision};CF.openLayer('modal','agConfirm');}
function confirmLayer(){
 const a=db.agreements.find(a=>a.id===pending?.a);if(!a)return null;const p=pending;let title='',html='',foot='',cancel=B('close','Cancel','取消','',false,busy);
 if(p.kind==='publish'){
 const w=p.w,isScheduled=w.state==='scheduled';title=isScheduled?L('Confirm update','确认更新'):L('Confirm publication','确认发布');
 html=`<dl class="dl">${kv(L('Agreement','协议'),esc(txt(a.name)))}${kv(L('Version','版本'),'v'+w.n)}${kv(L('File','文件'),esc(w.file.name)+' · '+size(w.file))}${kv(L('Effective mode','生效方式'),w.mode==='scheduled'?L('Scheduled','定时生效'):L('Immediately','立即生效'))}${kv(L('Effective time','生效时间'),w.mode==='scheduled'?time(w.plan):L('Upon confirmation','确认后立即'))}${kv(L('Re-consent flag','需重新同意标记'),w.reagree?L('Yes','是'):L('No','否'))}</dl><p>${L('The flag does not trigger a user prompt or notification.','重新同意标记不触发用户弹窗或通知。')}</p>${isScheduled?changeRows(p.before,w):''}${w.mode==='immediate'?CF.note('yellow',L('This version will become effective immediately'+(active(a)?', replacing v'+active(a).n:'.'), '本版本将立即生效'+(active(a)?'，替换当前生效 v'+active(a).n+'。':'。'))):''}`;
 foot=cancel+B('confirm',busy?'Submitting…':isScheduled?'Confirm update':'Confirm publish',busy?'提交中…':isScheduled?'确认更新':'确认发布','',true,busy);
 }else if(p.kind==='cancel'){
 title=L('Cancel scheduled activation?','撤销待生效计划？');const v=a.versions.find(v=>v.n===p.n);html=`<p>v${p.n} · ${time(v?.plan)}</p><p>${L('This version returns to draft with its confirmed file. Its schedule is cancelled; the active version is unchanged. Unsaved edits will not be included.','该版本将保留已确认文件并退回草稿，计划取消，当前生效版本不变。本次未提交的编辑不会保存。')}</p>`;
 if(draft(a))html+=CF.note('red',L('Another draft exists. Resolve the draft conflict before cancelling this schedule. No file will be overwritten.','已有其他草稿，请先处理草稿冲突后再撤销，不会覆盖任何文件。'));
 foot=cancel+B('confirm',busy?'Submitting…':'Cancel schedule',busy?'提交中…':'确认撤销','',true,busy||!!draft(a));
 }else if(p.kind==='discard'){
 title=L('Discard draft v'+p.n+'?','丢弃草稿 v'+p.n+'？');html='<p>'+L('The draft and its file will be removed. Published versions and previous activity remain unchanged.','草稿及文件将移除，已发布版本与既有操作记录保持不变。')+'</p>';foot=cancel+B('confirm','Discard draft','确认丢弃','',true,busy);
 }else if(p.kind==='leave'||p.kind==='reload'){
 title=L('Discard unsubmitted changes?','放弃未提交的改动？');html='<p>'+L('Your unsubmitted input will be lost. Any confirmed activation schedule continues unchanged.','本次未提交的输入将丢失，已确认的生效计划继续执行。')+'</p>';foot=cancel+B('confirm',p.kind==='reload'?'Discard and reload':'Leave page',p.kind==='reload'?'放弃并刷新':'确认离开','',true);
 }
 return {title,html:html+(errors.modal?CF.note('red',esc(E(errors.modal))):''),foot};
}
function reloadWork(){const a=current(),d=target(a);if(!d){dirty=false;work=null;errors={};navigate(P.detail,a,{tab:'basic'});return;}work=clone(d);work.note=txt(work.note);dirty=false;errors={};}
function updateSummary(before,after){
 const file=(before.file?.name||'—')+' → '+(after.file?.name||'—');
 const arrangement=v=>v.mode==='scheduled'?CF.fmtTime(v.plan):L('Immediately','立即生效');
 const en=[],zh=[];
 if(before.file?.hash!==after.file?.hash||before.file?.name!==after.file?.name){en.push('File: '+file);zh.push('文件：'+file);}
 if(before.mode!==after.mode||before.plan!==after.plan){const value=arrangement(before)+' → '+arrangement(after);en.push('Activation: '+value);zh.push('生效安排：'+value);}
 if(!sameNote(before.note,after.note)){en.push('Change note updated');zh.push('变更说明已调整');}
 if(before.reagree!==after.reagree){en.push('Re-consent flag updated');zh.push('重新同意标记已调整');}
 return [en.join('; '),zh.join('；')];
}
function confirmAction(){
 if(busy||!pending)return;const p=pending,a=db.agreements.find(x=>x.id===p.a);
 if(p.kind==='reload'){CF.closeLayer();reloadWork();return;}
 if(p.kind==='leave'){work=null;dirty=false;CF.closeLayer();if(p.navigate)p.navigate();else if(p.target)location.hash=p.target;else navigate(P.detail);return;}
 if(deny(p.kind==='discard'?'edit':'publish',a)){CF.closeLayer();return;}
 const allowed=()=>{
 if(p.kind==='publish'){
 if((p.w.state==='scheduled'&&!canEdit())||(hasChanges(a,p.w)&&!canEdit())){errors.modal=L('Maintenance permission is required.','需要维护权限。');return false;}
 if(!revisionOkay(a,p.w)||!validate(p.w,true)){errors.modal=errors.plan||errors.note||errors.file||errors.submit;return false;}
 }else {const v=a.versions.find(v=>v.n===p.n),expected=p.kind==='cancel'?'scheduled':'draft';if(!v||v.state!==expected||v.revision!==p.revision){errors.modal=L('The version changed or became effective. Return to the agreement to continue.','版本已变化或已生效，请返回协议详情后继续。');return false;}
 if(p.kind==='cancel'&&draft(a)){errors.modal=L('Another draft exists. Resolve the conflict first.','已有其他草稿，请先处理冲突。');return false;}}
 return true;};
 if(!allowed()){CF.render();return;}
 delayed(()=>{
 if(!allowed())return;
 if(failure==='submit'){failure='';errors.modal=L('The request failed. The confirmed file and schedule are unchanged. Your input is retained; retry.','提交失败，已确认文件与计划未变，当前输入已保留，请重试。');return;}
 if(p.kind==='publish'){
 const adjusting=p.w.state==='scheduled',before=clone(a.versions.find(v=>v.n===p.w.n));let v=commitWork(a,p.w);
 if(!v.at){v.at=now();v.publishedBy=['Demo operator · op***@example.invalid','演示运营人员 · op***@example.invalid'];}
 if(adjusting){v.adjusted=now();v.adjustedBy=['Demo operator · op***@example.invalid','演示运营人员 · op***@example.invalid'];}
 v.credential=v.file.hash;v.failed=false;
 if(v.mode==='scheduled'){v.state='scheduled';v.effective=null;}else{let old=active(a);if(old&&old!==v){old.state='archived';old.archived=now();log(a,['Version archived','版本归档'],old.n,['Replaced by v'+v.n,'由 v'+v.n+' 替换'],'system');}v.state='active';v.effective=now();v.plan=null;}
 log(a,adjusting?['Scheduled update confirmed','确认待生效调整']:['Version published','发布版本'],v.n,adjusting?updateSummary(before,v):[v.mode==='scheduled'?'Scheduled activation confirmed':'Effective immediately',v.mode==='scheduled'?'已确认定时生效':'立即生效'],'operator',adjusting?{before,after:clone(v)}:{});
 }else if(p.kind==='cancel'){
 const v=scheduled(a),oldPlan=v.plan;v.state='draft';v.mode='immediate';v.plan=null;v.failed=false;v.revision++;
 log(a,['Schedule cancelled','主动撤销定时'],v.n,['Plan '+CF.fmtTime(oldPlan)+' cancelled; returned to draft with confirmed file','计划 '+CF.fmtTime(oldPlan)+' 已撤销，保留已确认文件退回草稿']);
 }else if(p.kind==='discard'){a.versions=a.versions.filter(v=>!(v.state==='draft'&&v.n===p.n));log(a,['Draft discarded','丢弃草稿'],p.n,['Published versions unchanged','已发布版本不变']);}
 persist();dirty=false;work=null;errors={};tab='basic';activityPage=1;activityState='default';CF.closeLayer();navigate(P.detail,a,{tab:'basic',v:''});CF.toast(L('Changes saved','操作成功'));
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
 if(!v)return heading(L('Version unavailable','版本不可用'),L('The version does not exist or was discarded.','版本不存在或草稿已丢弃。'))+back;
 if(historyOnly(v)&&!canHistory())return heading(L('Version details','版本详情')+' · v'+v.n,esc(txt(a.name)))+`<section class="card">${noHistory()}</section>`+back;
 const head=heading(L('Version details','版本详情')+' · v'+v.n,`${esc(txt(a.name))} · ${tag(v.state)}`,v.file?B('download','Download agreement','下载协议',v.n,true):'');
 if(S.st!=='default')return head+`<section class="card">${stateSurface()}</section>`+back;
 const person=(at,identity)=>at?esc(txt(identity)||operator()):'—';
 const cancelled=v.state==='cancelled';
 return head+`<div class="ag-stack"><section class="card"><div class="card-head">${L('Version information','版本信息')}</div><div class="card-b"><dl class="dl">${kv(L('Agreement','所属协议'),esc(txt(a.name)))}${kv(L('Agreement code','协议标识'),esc(a.id))}${kv(L('Version ID','版本标识'),esc(a.id)+'-v'+v.n)}${kv(L('File','文件名称'),esc(v.file?.name||'—'))}${kv(L('Format / size','格式 / 大小'),v.file?v.file.format+' · '+size(v.file):'—')}${kv(L('Uploaded','上传时间'),time(v.file?.uploaded))}${kv(L('Effective mode','生效方式'),v.mode==='scheduled'?L('Scheduled','定时生效'):L('Immediately','立即生效'))}${kv(L('Scheduled at','计划生效时间'),time(v.plan))}${kv(L('Effective at','实际生效时间'),time(v.effective))}${kv(L('Archived at','归档时间'),time(v.archived))}${cancelled?kv(L('Cancelled at','取消时间'),time(v.cancelledAt))+kv(L('State before cancellation','取消前状态'),txt(labels[v.was])||'—')+kv(L('Cancellation reason','取消原因'),esc(txt(v.cancelReason))||'—'):''}${kv(L('Last draft save','最近草稿保存'),time(v.saved))}${kv(L('Saved by','保存人'),person(v.saved,v.savedBy))}${kv(L('First published','首次发布时间'),time(v.at))}${kv(L('Published by','首次发布人'),person(v.at,v.publishedBy))}${kv(L('Last confirmed update','最近确认调整'),time(v.adjusted))}${kv(L('Updated by','调整操作人'),person(v.adjusted,v.adjustedBy))}${kv(L('Change note','变更说明'),esc(txt(v.note))||'—')}${v.source?kv(L('Source version','来源版本'),link('version','View v'+v.source,'查看 v'+v.source,v.source)):''}${kv(L('Re-consent flag','需重新同意标记'),v.reagree?L('Yes','是'):L('No','否'))}${kv(L('Content fingerprint','文件内容指纹'),v.file?`<span class="hash">${esc(v.file.hash)}</span>${link('copy','Copy','复制',v.file.hash)}<span class="ag-sub">${v.state==='scheduled'?L('Not yet effective; may change after confirmation.','尚未生效，仍可经确认调整。'):v.state==='draft'?L('Draft file; not frozen.','草稿文件，尚未冻结。'):L('Fixed for effective and archived content.','已生效与已归档内容固定。')}</span>`:'—')}</dl></div></section><section class="card"><div class="card-head">${L('Agreement file','协议文件')}</div><div class="card-b">${v.file?CF.fileRow({key:a.id+'-v'+v.n,name:v.file.name,state:'ready',meta:v.file.format+' · '+size(v.file),status:txt(labels[v.state]),download:{act:'ag-download',value:v.n}}):''}${filePreview(v.file)}</div></section><div>${back}</div></div>`;
}
function workPreviewLayer(){return {title:L('Agreement file preview','协议文件预览'),html:canQuery()?filePreview(work?.file):CF.empty(L('Access denied','无权限'),'',''),foot:B('close','Close','关闭')};}
function auditLayer(data){
 const a=current();if(!canHistory())return {title:L('Access denied','无权限'),html:noHistory(),foot:B('close','Close','关闭')};
 const [index,side]=String(data).split(':'),snapshot=a.logs[Number(index)]?.[side];
 if(!snapshot)return {title:L('File unavailable','文件不可用'),html:'',foot:B('close','Close','关闭')};
 return {title:L('Confirmed file snapshot','确认时的文件记录'),html:`<p>${L('This is an adjustment record, not the currently effective agreement.','此文件为调整记录，并非当前生效协议。')}</p><p>${esc(snapshot.file?.name||'—')}</p>${filePreview(snapshot.file)}`,foot:B('close','Close','关闭')+B('auditDownload','Download file','下载文件',data)};
}
async function upload(files){let a=current();if(uploading||busy||deny('edit',a)||!work||!revisionOkay(a,work))return;errors.file='';if(files.length!==1){errors.file=L('Choose exactly one file.','一次只能选择一个文件。');CF.render();return;}const f=files[0],format=f.name.split('.').pop().toUpperCase(),limit=a.maxMB*1048576;
 if(!a.formats.includes(format)||!f.size||f.size>limit){errors.file=L('Use one non-empty '+a.formats.join('/')+' file, up to '+a.maxMB+' MB.','请选择非空 '+a.formats.join('/')+' 文件，大小不超过 '+a.maxMB+' MB。');CF.render();return;}
 uploading=true;CF.render();try{const bytes=new Uint8Array(await f.arrayBuffer()),prefix=new TextDecoder().decode(bytes.slice(0,8));if(format==='PDF'&&!prefix.startsWith('%PDF-'))throw Error(L('The file is not a valid PDF. Renaming its extension is not supported.','文件并非有效 PDF，不能通过修改扩展名上传。'));if(format==='TXT'){try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch(e){throw Error(L('Choose a UTF-8 text file.','请选择 UTF-8 文本文件。'));}}
 await new Promise(r=>setTimeout(r,500));if(failure==='upload'){failure='';throw Error(L('Upload failed. The previous file is retained. Choose the file to retry.','上传失败，原文件已保留，请重新选择文件重试。'));}
 const data=await new Promise((resolve,reject)=>{let r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f);});const digest=await crypto.subtle.digest('SHA-256',bytes);work.file={name:f.name,size:f.size,format,data,hash:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''),uploaded:now()};dirty=true;
 }catch(e){errors.file=e.message||L('Upload failed. Retry.','上传失败，请重试。');}finally{uploading=false;CF.render();}}
function download(file){if(!canQuery()||!file)return;let a=document.createElement('a');a.href=file.data;a.download=file.name;a.click();CF.toast(L('Download started','已开始下载'));}
function settle(a,fail){let v=scheduled(a);if(!v||!a.online)return;v.failed=fail;v.revision++;if(fail){log(a,['Scheduled activation failed','定时生效失败'],v.n,['Active version remains unchanged','当前生效版本保持不变'],'system',{result:'failed'});}else{let old=active(a);if(old){old.state='archived';old.archived=now();log(a,['Version archived','版本归档'],old.n,['Replaced by v'+v.n,'由 v'+v.n+' 替换'],'system');}v.state='active';v.effective=now();log(a,['Scheduled version activated','定时版本生效'],v.n,['Activated as scheduled','按计划生效'],'system');}persist();}
const PERMS=[[9,'Agreement content query','协议当前内容与工作版本查询'],[10,'Agreement maintenance','协议内容与版本维护'],[11,'Agreement publishing','协议版本发布'],[15,'Version history read','协议历史版本读取'],[16,'Activity records','协议操作记录查看']];
function demo(){if(OPS_PAGES.includes(S.page))return OPS.demo();
 const choices=(act,opts,value)=>`<div class="seg">${opts.map(x=>`<button data-act="ag-${act}" data-v="${x[0]}" aria-pressed="${value===x[0]}">${L(x[1],x[2])}</button>`).join('')}</div>`;
 const role=CF.opsAuth.getIdentity().role;
 return `<div class="grp"><h5>${L('Demo account','演示账号')}</h5>${choices('role',[['admin','Operations administrator','运营管理员'],['specialist','Operations specialist','运营专员']],role)}<h5>${L('Delivered permission items','交付的功能权限项')}</h5><div class="ops-demo-actions">${PERMS.map(([n,en,zh])=>B('grant',en+' · '+(can(n)?'on':'off'),zh+' · '+(can(n)?'已开通':'未开通'),String(n))).join('')}</div><p class="why">${L('Permission items are registered once in operations accounts and sign-in; fixed items cannot be switched off here. An administrator holds every item; a specialist never holds version history.','功能权限项只在运营端账户与登录一处登记，固定开通项在此不可关闭；管理员固定具备全部项，专员不授予历史版本读取。')}</p>${B('expire','Expire session','会话失效')}${B('attempt','Attempt restricted write','尝试越权写入')}</div><div class="grp"><h5>${L('Page state','页面状态')}</h5>${choices('state',[['default','Default','默认'],['loading','Loading','加载中'],['empty','Empty','无数据'],['noresult','No results','无结果'],['error','Load error','加载失败'],['denied','No access','无权限']],S.st)}</div><div class="grp"><h5>${L('Activity state','操作进度状态')}</h5>${choices('activityState',[['default','Default','默认'],['loading','Loading','加载中'],['empty','Empty','无记录'],['error','Load error','加载失败']],activityState)}</div><div class="grp"><h5>${L('Next operation','下次操作')}</h5>${choices('failure',[['','Normal','正常'],['upload','Upload failure','上传失败'],['submit','Submit failure','提交失败']],failure)}${B('conflict','Concurrent update','模拟并发更新')}${B('previewFail','Preview failure','预览失败')}</div><div class="grp"><h5>${L('Scheduled release','定时计划')}</h5>${B('settle','Activate now','模拟到点成功')}${B('settleFail','Activation failure','模拟到点失败')}${B('dualDraft','Conflicting draft','模拟已有草稿冲突')}</div><div class="grp">${B('bulk',bulk?'Use standard fixtures':'47-row pagination sample',bulk?'恢复标准数据':'47 条分页样本')}${B('resetData','Reset all demo data','重置全部演示数据')}</div><p class="why">${L('Demonstration data only. Changes are local to this browser. Reset clears local changes.','仅使用演示数据。改动只保存在本浏览器，重置将清除本地改动。')}</p>`;}
/* 只有 PM-AL-16 的账号：入口仍可达，只提供识别原协议所需的名称、标识、下线情况与操作记录。 */
function recordsHead(){return heading(L('Agreements','协议管理'),L('Activity records of the agreements on this platform.','本平台协议的操作记录。'))+recordsNote();}
function recordsNote(){
 return missingQuery()
  ?CF.note('red',L('This account can maintain or publish agreement versions but has no agreement content query permission, so agreement content is refused. Ask your platform provider to correct the delivered configuration.','该账号已开通协议内容维护或版本发布，但未开通协议当前内容与工作版本查询，协议内容访问已拒绝。请联系平台建设方修正交付配置。'))
  :CF.note('yellow',L('This account holds agreement activity records only. Agreement definitions, content and version history are not available.','当前账号仅开通协议操作记录查看，不提供协议定义、正文与版本历史。'));
}
function recordsList(){
 const head=recordsHead();
 if(S.st==='denied')return head+`<div class="card">${noAccess()}</div>`;
 const fs=`<div class="filters"><div class="field"><label for="ag-q">${L('Agreement name or code','协议名称或标识')}</label><input class="inp" id="ag-q" type="search" data-filter="q" value="${esc(inputFilters.q)}"></div><div class="acts">${B('reset','Reset','重置')}${B('query','Search','查询','',true)}</div></div>`;
 const q=filters.q.trim().toLowerCase();
 const rows=db.agreements.filter(a=>!q||[...a.name,a.id].some(t=>t.toLowerCase().includes(q)));
 const total=['empty','noresult'].includes(S.st)?0:rows.length,maxPage=Math.max(1,Math.ceil(total/filters.size));
 filters.page=Math.min(filters.page,maxPage);
 const surf=CF.surface({skelRows:5,emptyTitle:L('No agreements yet','暂无协议'),emptyDesc:L('Agreements are preset by the system.','协议由系统预置。')})
  ||(!rows.length?CF.empty(L('No agreements match these filters','没有符合条件的协议'),L('Try different filters.','请调整筛选条件。'),B('reset','Reset filters','重置筛选')):null);
 const table=`<div class="tablewrap"><table class="tbl ag-table"><colgroup><col style="width:44%"><col style="width:26%"><col style="width:20%"><col style="width:10%"></colgroup><thead><tr><th>${L('Agreement name','协议名称')}</th><th>${L('Agreement code','协议标识')}</th><th>${L('Agreement availability status','协议上线状态')}</th><th class="col-act">${L('Action','操作')}</th></tr></thead><tbody>${rows.slice((filters.page-1)*filters.size,filters.page*filters.size).map(a=>`<tr><td><span class="cell-main">${esc(txt(a.name))}</span></td><td class="mono">${esc(a.id)}</td><td>${a.online?L('Online','已上线'):L('Offline','已下线')}</td><td class="col-act">${link('detail','Activity','操作记录',a.id,false,'',a.id)}</td></tr>`).join('')}</tbody></table></div>`;
 return head+`<div class="card">${fs}${surf||table}<div class="pager"><span class="total">${L(total+' agreements','共 '+total+' 份协议')}</span><label for="ag-size">${L('Rows','每页')}</label><select class="inp" id="ag-size" style="width:80px">${[20,50,100].map(n=>`<option${n===filters.size?' selected':''}>${n}</option>`).join('')}</select>${B('page','Previous','上一页',filters.page-1,false,filters.page===1)}<span>${filters.page} / ${maxPage}</span>${B('page','Next','下一页',filters.page+1,false,filters.page===maxPage)}</div></div>`;
}
function recordsDetail(){
 const a=current();
 const head=heading(txt(a.name),`<span class="mono">${esc(a.id)}</span> · ${a.online?L('Online','已上线'):L('Offline','已下线')}`)+recordsNote();
 if(S.st==='denied')return head+`<div class="card">${noAccess()}</div>`;
 return head+`<div class="ag-stack">${activity(a)}</div><div>${B('list','Back to agreements','返回协议列表')}</div>`;
}
function renderContent(page){
 if(OPS_PAGES.includes(page))return OPS.content(page);
 if(!signedIn())return '';
 if(!reachable())return heading(L('Agreements','协议管理'),'')+noAccess();
 if(page!==P.list&&!current())return CF.empty(L('Agreement unavailable','协议不可用'),L('The agreement no longer exists.','协议已不存在。'),B('list','Back to agreements','返回协议列表'));
 if(recordsOnly())return page===P.list?recordsList():page===P.detail?recordsDetail():recordsHead()+`<div class="card">${noAccess()}</div>`+B('list','Back to agreements','返回协议列表');
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
function updateSubmit(){const b=document.querySelector('[data-act=ag-publish]');if(b&&work?.state==='scheduled')b.disabled=!canPublish()||!canEdit()||busy||uploading||!hasChanges(current(),work)||!current().versions.some(v=>v.n===work.n&&v.state===work.state);}
function afterRender(){
 OPS.afterRender();
 if(routeChanged){routeChanged=false;const hash=location.hash,at=position(hash),focusTab=tabFocus;tabFocus=false;requestAnimationFrame(()=>{if(location.hash!==hash)return;S.toTop=false;window.scrollTo(0,at?.y||0);const el=focusTab?$('ag-tab-'+tab):(at?.focus?$(at.focus):null);if(el)el.focus({preventScroll:true});else if(S.page===P.list&&at)$('ag-q')?.focus({preventScroll:true});});}
 document.querySelectorAll('[role="tab"]').forEach(el=>el.addEventListener('keydown',e=>{const tabs=[...document.querySelectorAll('[role="tab"]')],i=tabs.indexOf(el);let n;if(e.key==='ArrowRight')n=(i+1)%tabs.length;else if(e.key==='ArrowLeft')n=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=tabs.length-1;else return;e.preventDefault();act('ag-tab',tabs[n].dataset.v);CF.render();}));
 document.querySelectorAll('.ag-filter details').forEach(el=>{el.addEventListener('toggle',()=>{if(el.open)document.querySelectorAll('.ag-filter details').forEach(other=>{if(other!==el)other.open=false;});});el.addEventListener('keydown',e=>{if(e.key==='Escape'){el.open=false;el.querySelector('summary').focus();e.stopPropagation();}});});
 document.querySelectorAll('[data-filter]').forEach(el=>el.addEventListener('change',()=>{let key=el.dataset.filter;if(el.type==='checkbox')inputFilters[key]=Array.from(document.querySelectorAll(`[data-filter="${key}"]:checked`)).map(x=>x.value);else inputFilters[key]=el.value;}));
 $('ag-q')?.addEventListener('input',e=>inputFilters.q=e.target.value);
 $('ag-q')?.addEventListener('keydown',e=>{if(e.key==='Enter'){act('ag-query');CF.render();}});
 $('ag-activity-size')?.addEventListener('change',e=>{activitySize=Number(e.target.value);activityPage=1;CF.render();});
 $('ag-size')?.addEventListener('change',e=>{filters.size=Number(e.target.value);filters.page=1;saveView();CF.render();});
 $('ag-file')?.addEventListener('change',e=>upload(e.target.files));
 const drop=$('ag-upload');if(drop){drop.addEventListener('dragover',e=>e.preventDefault());drop.addEventListener('drop',e=>{e.preventDefault();upload(e.dataTransfer.files);});drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('ag-file').click();}});}
 $('ag-note')?.addEventListener('input',e=>{work.note=e.target.value;dirty=true;updateSubmit();$('ag-count').textContent=Array.from(work.note).length+' / 500';if(errors.note&&Array.from(work.note).length<=500){errors.note='';$('ag-note-error').textContent='';$('ag-note').setAttribute('aria-invalid','false');}});
 $('ag-note')?.addEventListener('blur',()=>{if(Array.from(work.note).length>500){errors.note=L('Use no more than 500 characters.','变更说明不得超过 500 字符。');$('ag-note-error').textContent=errors.note;$('ag-note').setAttribute('aria-invalid','true');}});
 $('ag-mode')?.addEventListener('change',e=>{work.mode=e.target.value;dirty=true;CF.render();});
 $('ag-plan')?.addEventListener('change',e=>{work.plan=e.target.value?new Date(e.target.value).toISOString():null;dirty=true;updateSubmit();});
 $('ag-reagree')?.addEventListener('change',e=>{work.reagree=e.target.checked;dirty=true;updateSubmit();});
}
function beforeAct(action,value,e){if(busy||uploading){if(action==='closelayer'||action==='ag-close'||action.startsWith('ag-')||action==='lang'||action==='menu'){return true;}}
 if(action==='closelayer'&&e?.target.closest('[data-stop]')&&!e.target.closest('button'))return false;
  if(action==='closelayer'){pending=null;errors.modal='';}
 if(action==='retry'){S.st='default';return true;}if(action==='clearfilter'){resetFilter();return true;}
 return false;}
function act(action,v,e){if(!action.startsWith('ag-'))return false;let a=current();let kind=action.slice(3);
 switch(kind){
 case 'query':if(inputFilters.from&&inputFilters.to&&inputFilters.from>inputFilters.to){CF.toast(L('End date must be on or after start date.','结束日期不能早于开始日期。'));break;}filters=Object.assign(clone(inputFilters),{page:1});S.st='default';saveView();break;
 case 'reset':resetFilter();break;
 case 'sort':filters.dir=filters.sort===v&&filters.dir==='desc'?'asc':'desc';filters.sort=v;saveView();break;
 case 'page':filters.page=Number(v);saveView();break;
 case 'list':if(dirty){pending={kind:'leave',a:a.id,target:viewHash||listHash()};CF.openLayer('modal','agConfirm');}else navigate(P.list);break;
 case 'detail':if(dirty){pending={kind:'leave',a:a.id,target:route(P.detail,{tab:'basic',v:''})};CF.openLayer('modal','agConfirm');}else{tab='basic';work=null;errors={};navigate(P.detail,db.agreements.find(x=>x.id===v)||a,{tab:'basic',v:''});}break;
 case 'back':if(dirty){openConfirm('leave');}else{work=null;navigate(P.detail,a,{v:''});}break;
 case 'tab':tab=v;tabFocus=true;navigate(P.detail,a,{tab:v});break;
 case 'edit':startEdit();break;


 case 'save':saveDraft();break;
 case 'publish':publishStart(v);break;
 case 'discard':if(S.page===P.edit&&work?.state==='draft'&&!deny('edit',a))openConfirm('discard',v);break;
 case 'cancel':if(S.page===P.edit&&work?.state==='scheduled'&&!deny('publish',a))openConfirm('cancel',v);break;
 case 'confirm':confirmAction();break;
 case 'close':errors.modal='';pending=null;CF.closeLayer();break;
 case 'version':remember();navigate(P.version,a,{v:Number(v),tab:'history'});break;
 case 'download':download(a.versions.find(x=>x.n===Number(v))?.file);break;
 case 'chooseFile':if(canEdit()&&work&&revisionOkay(a,work))$('ag-file')?.click();break;
 case 'previewWork':if(canQuery()&&work)CF.openLayer('drawer','agWorkPreview');break;
 case 'auditFile':if(canHistory())CF.openLayer('drawer','agAuditFile',v);break;
 case 'auditDownload':if(canHistory()){const [index,side]=String(v).split(':');download(a.logs[Number(index)]?.[side]?.file);}break;
 case 'downloadWork':download(work?.file);break;
 case 'copy':{if(!canQuery())break;let t=document.createElement('textarea');t.value=v;t.style.position='fixed';t.style.opacity='0';$('layers').appendChild(t);t.select();let ok=document.execCommand('copy');t.remove();CF.toast(ok?L('Copied','已复制'):L('Copy unavailable; select the credential to copy.','复制不可用，请选中凭据复制。'));break;}
 case 'refreshDraft':if(dirty)openConfirm('reload');else reloadWork();break;
 case 'role':CF.opsAuth.seedDemo(v);S.layer=null;S.demo=false;S.st='default';work=null;dirty=false;errors={};tab='basic';navigate(P.list);break;
 case 'grant':OPS.onAct('ops-grant',v);S.st='default';work=null;dirty=false;errors={};if(tab==='history'&&!canHistory())tab='basic';break;
 case 'expire':OPS.onAct('ops-session-expire');break;
 case 'logToggle':expandedLog=expandedLog===Number(v)?null:Number(v);break;
 case 'activityPage':activityPage=Number(v);break;
 case 'activityRetry':activityState='default';break;
 case 'activityState':activityState=v;S.demo=false;break;
 case 'dualDraft':if(a&&scheduled(a)&&!draft(a)){const d=clone(scheduled(a));d.n=a.next++;d.state='draft';d.revision=1;a.versions.push(d);persist();CF.toast(L('Conflicting draft added','已添加草稿冲突样本'));}break;
 case 'attempt':if(!deny('edit',a))CF.toast(L('Maintenance permission is granted.','当前具有维护权限。'));break;
 case 'state':S.st=v;S.demo=false;break;
 case 'failure':failure=v;CF.toast(L('Next-operation setting updated','已设置下次操作结果'));break;
 case 'conflict':if(target(a)){target(a).revision++;persist();CF.toast(L('Another operator has updated this version.','已模拟其他运营人员更新版本。'));}break;
 case 'previewFail':previewFailed=true;CF.toast(L('The next preview will fail.','下次预览将显示失败。'));break;
 case 'retryPreview':previewFailed=false;break;
 case 'settle':case 'settleFail':if(!scheduled(a))CF.toast(L('Open an agreement with a scheduled version.','请先打开有待生效版本的协议。'));else {settle(a,kind==='settleFail');CF.toast(L('Scheduled result updated','已更新定时处理结果'));}break;
 case 'bulk':bulk=!bulk;try{sessionStorage.setItem(STORE+'-bulk',String(bulk));}catch(e){}filters.page=1;saveView();break;
 case 'resetData':db=seed();persist();work=null;dirty=false;errors={};failure='';bulk=false;CF.opsAuth.seedDemo('admin');try{sessionStorage.removeItem(STORE+'-bulk');}catch(e){}S.st='default';previewFailed=false;tab='basic';activityState='default';activityPage=1;activitySize=20;resetFilter();navigate(P.list);CF.toast(L('Demo data reset','演示数据已重置'));break;
 default:return false;
 }return true;
}

Object.values(P).forEach(id=>CF.review.register(id,{
  group:['Agreements','协议管理'],states:id===P.list?['default','loading','empty','noresult','error','denied']:['default','loading','error','denied'],
  route:()=>{if(id===P.list)return '/ops/agreements';const a=id===P.edit?(target(current())?current():db.agreements.find(a=>target(a))):(current()||db.agreements[0]);if(!a)return null;const v=id===P.edit?target(a):a.versions[0];return route(id,{id:a.id,v:v?.n});},
  reset(){S.st='default';failure='';previewFailed=false;activityState='default';},
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
 layers:{...OPS.layers,agWorkPreview:workPreviewLayer,agAuditFile:auditLayer,agConfirm:confirmLayer},
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
