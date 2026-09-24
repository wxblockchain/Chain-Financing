/* WS-360: local UI simulation. Auth, routing, overlays and account UI use the shared host. */
(function(CF){
'use strict';
const S=CF.S,L=CF.L,E=CF.esc,A=CF.opsAccountModule,D=CF.opsMessageDemo,N=CF.opsNotifications;
const LIST='/ops/notifications',DETAIL='/ops/notification',P='P-O20',PD='P-O21',STORE='hc.ops.messages.v1.';
const $=id=>document.getElementById(id),text=o=>o?(o[S.lang]||o.en||''):'';
let rows=N.rows,revoked=false,scene='default',fault='',batch=null,batchBusy=false,batchError=false,pageBusy=false,pageError=false,pendingPage=1,detailState='',detailKey='',detailMode='',epoch=0,wasSigned=true,returnHash='',listCache=null,view={category:'',status:'all',page:1,size:20},backHash='#'+LIST,backY=0,backId='',restore=false,readRetry=new Set(),activeListHash='',skipRestore=false;
const get=N.getRead,put=N.setRead;
/* 消息准入只看运营端消息查看；业务目标由目标模块的功能权限项分别判定。 */
const canTarget=n=>!!CF.opsAuth&&CF.opsAuth.can(n);
const REACH_MS=3000;
let reach='idle',reachTimer=null;
const identity=()=>CF.opsAuth.getIdentity().email,allowed=()=>CF.opsAuth.can(12)&&!revoked;
const expired=r=>!!r.expires&&Date.parse(r.expires)<=Date.now();
const visible=()=>allowed()&&scene!=='empty'?rows.filter(r=>r.platform==='lending'&&r.end==='admin'&&(!r.owner||r.owner===identity())).sort((a,b)=>b.at.localeCompare(a.at)||b.id.localeCompare(a.id)):[];
const isRead=N.isRead;
const unread=()=>visible().filter(r=>!isRead(r)&&!expired(r));
const categories=()=>Array.from(new Set(visible().map(r=>r.category).filter(Boolean)));
const cat=k=>text(D.categories[k])||L('Other','其他');
const statusName=k=>({all:L('All messages','全部消息'),unread:L('Unread','未读'),read:L('Read','已读')})[k];
function params(){return new URLSearchParams(location.hash.split('?')[1]||'')}
function hash(v=view){const q=new URLSearchParams();if(v.category)q.set('category',v.category);if(v.status!=='all')q.set('status',v.status);if(v.page!==1)q.set('page',v.page);if(v.size!==20)q.set('size',v.size);return '#'+LIST+(q.size?'?'+q:'')}
function readView(){const q=params();return {category:categories().includes(q.get('category'))?q.get('category'):'',status:['all','read','unread'].includes(q.get('status'))?q.get('status'):'all',page:Math.max(1,Number(q.get('page'))||1),size:[20,50,100].includes(Number(q.get('size')))?Number(q.get('size')):20}}
// Return paths are local message routes only; they never grant access to a record.
function safeList(raw){if(typeof raw!=='string'||raw.split('?')[0]!=='#'+LIST)return '#'+LIST;const q=new URLSearchParams(raw.split('?')[1]||'');return hash({category:categories().includes(q.get('category'))?q.get('category'):'',status:['all','read','unread'].includes(q.get('status'))?q.get('status'):'all',page:Math.max(1,Math.floor(Number(q.get('page'))||1)),size:[20,50,100].includes(+q.get('size'))?+q.get('size'):20})}
function detailURL(id,from=hash()){return '#'+DETAIL+'?'+new URLSearchParams({id,from:safeList(from)})}
function safeMessage(raw){if(typeof raw!=='string'||raw.split('?')[0]!=='#'+DETAIL)return '';const q=new URLSearchParams(raw.split('?')[1]||'');return q.get('id')?detailURL(q.get('id'),q.get('from')):''}
function saveContext(){if(!allowed())return;const key=hash();backHash=key;backY=window.scrollY;try{sessionStorage.setItem(STORE+'context.'+identity()+'.'+key,JSON.stringify({ids:listCache,y:backY,id:backId}))}catch(e){}}
function restoreContext(key){let saved;try{saved=JSON.parse(sessionStorage.getItem(STORE+'context.'+identity()+'.'+key)||'null')}catch(e){}if(!saved)return false;listCache=Array.isArray(saved.ids)?saved.ids.filter(id=>typeof id==='string'):null;backY=Math.max(0,Number(saved.y)||0);backId=typeof saved.id==='string'?saved.id:'';return true}
const matching=()=>visible().filter(r=>(!view.category||r.category===view.category)&&(view.status==='all'||(view.status==='unread'?!isRead(r)&&!expired(r):isRead(r))));
const batchRows=()=>matching().filter(r=>!isRead(r)&&!expired(r));
function mark(ids){N.mark(ids)}
const absolute=N.absolute,relative=N.relative;
function B(act,en,zh,v='',primary=false,disabled=false){return `<button class="btn${primary?' primary':''}" type="button" data-act="om-${act}" data-v="${E(v)}" ${disabled?'disabled':''}>${L(en,zh)}</button>`}
const label=N.label;
const back=()=>`<a class="nc-back" href="${E(backHash)}">← ${L('Back to messages','返回消息列表')}</a>`;
function skeleton(){return `<div role="status" aria-label="${L('Loading messages','正在加载消息')}">${Array.from({length:5},()=>'<div class="nc-skeleton-row"><span class="skel"></span><span class="skel"></span><span class="skel"></span></div>').join('')}</div>`}
function empty(kind){return CF.empty(kind==='noresult'?L('No messages match these filters','没有符合筛选条件的消息'):L('No notifications yet','暂无消息'),kind==='noresult'?L('Try a different category or reading status.','试试其他分类或阅读状态。'):L('New notifications will appear here.','收到的新消息会显示在这里。'),kind==='noresult'?B('clear','Clear filters','清除筛选'):'')}
function row(r){const title=text(r.title)||L('Notification','消息');return `<article class="nc-row" data-unread="${!isRead(r)}" data-id="${E(r.id)}"><a class="nc-message-link${expired(r)?' om-expired':''}" id="om-row-${E(r.id)}" aria-label="${E((isRead(r)?L('Read: ','已读：'):L('Unread: ','未读：'))+title)}" href="${E(detailURL(r.id,S.page===P?hash():backHash))}"><div class="nc-message-heading"><span class="nc-message-title" title="${E(title)}">${E(title)}</span>${label(r)}</div><p class="nc-summary">${E(text(r.title)?text(r.summary):'')}</p><div class="nc-message-foot"><span>${E(cat(r.category))}${expired(r)?' · '+L('Expired','已过期'):''}</span><time datetime="${r.at}" title="${E(absolute(r.at))}">${E(relative(r.at))}</time></div></a></article>`}
function pager(total){let pages=Math.max(1,Math.ceil(total/view.size)),items=[];for(let i=1;i<=pages;i++){if(i===1||i===pages||Math.abs(i-view.page)<=1)items.push(`<button class="btn sm" data-act="om-page" data-v="${i}" ${pageBusy?'disabled':''} ${i===view.page?'aria-current="page"':''}>${i}</button>`);else if(items.at(-1)!=='<span>…</span>')items.push('<span>…</span>')}
return `<div class="om-pagination"><span role="status">${L(total+' notifications','共 '+total+' 条消息')}${pageBusy?' · '+L('Loading…','加载中…'):''}</span><nav aria-label="${L('Pagination','分页')}">${B('page','Previous','上一页',Math.max(1,view.page-1),false,pageBusy||view.page===1)}${items.join('')}${B('page','Next','下一页',Math.min(pages,view.page+1),false,pageBusy||view.page===pages)}</nav><label>${L('Per page','每页条数')} <select class="inp" id="om-size" ${pageBusy?'disabled':''}>${[20,50,100].map(n=>`<option ${n===view.size?'selected':''}>${n}</option>`).join('')}</select></label></div>`}
function list(){if(!allowed())return CF.empty(L('You do not have access to messages','你没有消息查看权限'),L('Contact your administrator to request access.','请联系管理员申请访问权限。'),'');
let ids=listCache||(listCache=matching().map(r=>r.id)),data=ids.map(id=>visible().find(r=>r.id===id)).filter(Boolean),count=batchRows().length;
let body=scene==='loading'?skeleton():scene==='error'?CF.empty(L('Messages could not be loaded','消息加载失败'),L('Check your connection and try again.','请检查连接后重试。'),B('retry','Retry','重试')):scene==='empty'?empty('empty'):scene==='noresult'?empty('noresult'):!data.length?empty(view.category||view.status!=='all'?'noresult':'empty'):data.slice((view.page-1)*view.size,view.page*view.size).map(r=>row(r)).join('');
return `<section class="nc-inbox om-inbox"><header class="page-head nc-head"><div><h1 class="page-title">${L('Notifications','消息中心')}</h1><p class="page-desc">${L('Updates for your operations, all in one place.','查看运营动态与账户通知。')}</p></div><div class="om-head-action">${B('batch','Mark all as read','全部已读','',false,!count||scene!=='default')}${!count?`<span class="tiny">${L('No unread messages in this view','当前筛选下无未读消息')}</span>`:''}</div></header><div class="nc-feed"><div class="om-filter"><div class="nc-status-options" role="group" aria-label="${L('Read status','阅读状态')}">${['all','unread','read'].map(k=>`<button data-act="om-filter" data-v="${k}" aria-pressed="${view.status===k}" ${pageBusy?'disabled':''}>${statusName(k)}</button>`).join('')}</div><div class="nc-category-field"><label for="om-category">${L('Category','分类')}</label><select id="om-category" class="inp" ${pageBusy?'disabled':''}><option value="">${L('All categories','全部分类')}</option>${categories().map(c=>`<option value="${E(c)}" ${view.category===c?'selected':''}>${E(cat(c))}</option>`).join('')}</select></div>${B('refresh','Refresh','刷新','',false,pageBusy)}</div>${pageError?`<div class="nc-feedback" role="alert">${L('Could not load the page. Your current page is unchanged.','翻页失败，当前页内容已保留。')} ${B('page','Retry','重试',pendingPage)}</div>`:''}<div class="nc-list" aria-busy="${pageBusy}">${body}</div>${scene==='default'?pager(data.length):''}</div><p class="ops-sample">${L('Demonstration data','演示数据')}</p></section>`}
function targetName(t){if(t.to==='settings')return L('Account settings','账户设置');
if(t.to==='institution')return L('Open review record','查看审核记录');
return t.route.includes('/version')?L('Open agreement version','查看协议版本'):L('Open agreement','查看协议');}
/* 四种情形分开判断：原动作失效但原对象可读、原对象已不存在、存在但无查看权限、目标未登记。 */
function targetPlan(r){
 const t=r.target;if(!t)return null;
 if(detailMode==='missing')return {state:'unregistered'};
 const mode=expired(r)?'invalid':detailMode;
 const plan={...t,name:targetName(t),permitted:canTarget(t.permission)};
 /* 从消息进入本人账户设置时带上返回原消息的途径，不丢失原列表上下文。 */
 if(t.to==='settings')plan.route=t.route+'?'+new URLSearchParams({from:safeMessage(location.hash)});
 plan.state=mode==='deleted'?'gone':mode==='denied'||!plan.permitted?'denied':mode==='handled'?'readonly':mode==='invalid'?'invalid':'open';
 return plan;
}
function targetNote(plan){return {
 denied:L('You do not have access to this record. The notification itself stays available.','你当前无权查看该记录，消息内容不受影响。'),
 gone:L('The related record is no longer available.','相关记录已不存在，暂时无法打开。'),
 readonly:L('This submission has already been decided. The original record stays available to read, and it cannot be reviewed again.','该次提交的结论已生效，原审核动作不再可用，原记录可只读查看。'),
 invalid:L('This notification is no longer valid, so the original action is unavailable.','该消息已失效，原办理动作不再可用。'),
 unregistered:L('No business record is linked to this notification yet.','该消息暂未登记可打开的业务记录。')
}[plan.state]||''}
function targetLink(plan,primary,label){const d=CF.AdminMenu.destination(plan.to,plan.route);
 return `<a class="btn${primary?' primary':''}" href="${E(d.href)}" data-admin-destination="${E(plan.to)}" data-admin-route="${E(d.route)}">${label}</a>`}
function relation(r){if(!Array.isArray(r.relation)||!r.relation.length)return '';
 return `<section class="om-relation"><h2>${L('Related record','原业务关联')}</h2><dl class="om-record">${r.relation.map(([en,zh,v])=>`<dt>${L(en,zh)}</dt><dd>${E(typeof v==='string'?v:text(v))}</dd>`).join('')}</dl></section>`}
function targetBlock(r){
 const plan=targetPlan(r);if(!plan)return {actions:'',note:''};
 const note=targetNote(plan),records=plan.records&&canTarget(plan.records.permission);
 let actions='';
 if(plan.state==='open'||plan.state==='readonly'){
  const checking=!plan.page&&reach==='checking';
  actions=checking
   ? `<span class="btn primary" aria-disabled="true" role="status">${L('Checking availability…','正在确认目标状态…')}</span>`
   : targetLink(plan,true,plan.state==='readonly'?L('View record (read-only)','只读查看原记录'):plan.name);
 }
 if(records)actions+=targetLink({...plan.records,to:plan.to},false,L('Open activity record','查看协议操作记录'));
 return {actions,note,unconfirmed:!plan.page&&reach==='unconfirmed'&&(plan.state==='open'||plan.state==='readonly')};
}
function detail(){if(!allowed())return list();let r=visible().find(r=>r.id===params().get('id'));if(!r)return back()+CF.empty(L('Notification not found','消息不存在'),L('Return to your messages to continue.','返回消息中心继续查看。'),'');
if(detailState==='loading')return back()+`<div class="nc-feed">${skeleton()}</div>`;
if(detailState==='error')return back()+CF.empty(L('Could not load this notification','消息加载失败'),L('It has not been marked as read.','本条消息未被标记为已读。'),B('detail-retry','Retry','重试'));
const validity=expired(r)?L('This notification has expired.','该消息已过期。'):'';
const t=targetBlock(r),hints=[t.note,t.unconfirmed?L('The availability check did not complete. You can still try to open the record.','未能确认目标当前状态，仍可尝试打开原记录。'):''].filter(Boolean);
return `<section class="om-reading nc-reading"><article class="card"><div class="card-b"><h1 tabindex="-1" id="om-detail-title">${E(text(r.title)||L('Notification','消息'))}</h1><div class="nc-reading-meta"><div class="nc-meta"><span>${E(cat(r.category))}</span><span>·</span><time>${E(absolute(r.at))}</time>${expired(r)?'<span>'+L('Expired','已过期')+'</span>':''}</div>${label(r)}</div>${validity?`<div class="note om-validity">ⓘ ${validity}</div>`:''}<div class="nc-body">${E(text(r.body))}</div>${relation(r)}${hints.length?`<p class="om-target-note" id="om-reason">${hints.map(E).join(' ')}</p>`:''}<div class="nc-actions">${t.actions}<a class="btn" href="${E(backHash)}">${L('Back to list','返回列表')}</a></div></div></article><p class="ops-sample">${L('Demonstration data','演示数据')}</p></section>`}
/* N-O05：进入详情时对原业务对象做辅助可达性判断，最长 3 秒；超时后仍可尝试进入，目标自身的权限与状态限制照常生效。 */
function startReach(id){clearTimeout(reachTimer);const r=visible().find(r=>r.id===id),plan=r?targetPlan(r):null;
 if(!plan||plan.page||!['open','readonly'].includes(plan.state)){reach='idle';return}
 const token=epoch,slow=fault==='reach';if(slow)fault='';reach='checking';
 reachTimer=setTimeout(()=>{if(token!==epoch||S.page!==PD||params().get('id')!==id)return;reach=slow?'unconfirmed':'ready';CF.render()},slow?REACH_MS:500);}
function startDetail(){const token=++epoch,reader=identity(),id=params().get('id'),requestedFault=fault;detailMode=visible().find(r=>r.id===id)?.demoMode||'';detailState='loading';reach='idle';clearTimeout(reachTimer);setTimeout(()=>{if(token!==epoch||reader!==identity()||!allowed()||S.page!==PD||params().get('id')!==id)return;detailState=requestedFault==='detail'?'error':'ready';if(requestedFault==='detail')fault='';const r=visible().find(r=>r.id===params().get('id'));CF.render();if(r&&detailState==='ready'){if(requestedFault==='read'){fault='';readRetry.add(r.id)}else mark([r.id]);startReach(id);CF.render();$('om-detail-title')?.focus({preventScroll:true})}},350)}
function updateCount(){N.refresh()}
function batchLayer(){const n=batch?.length||0;return {title:L('Mark '+n+' notifications as read?','将 '+n+' 条消息标为已读？'),html:`<p>${L('Filter: ','当前筛选：')}${E(view.category?cat(view.category):L('All categories','全部分类'))} · ${statusName(view.status)}</p><p>${L('Includes matching messages on every page. Only your own read status changes. This cannot be undone.','包含所有分页中匹配的消息，仅修改本人的已读状态。此操作不可撤销。')}</p>${batchError?CF.note('red',L('Could not update messages. Nothing has changed; please retry.','操作失败，消息状态未改变，请重试。')):''}`,foot:B('cancel','Cancel','取消','',false,batchBusy)+B('confirm',batchBusy?'Updating…':batchError?'Retry':'Confirm',batchBusy?'处理中…':batchError?'重试':'确认','',true,batchBusy)}}
function changeView(patch){skipRestore=true;activeListHash='';listCache=null;scene='default';pageError=false;view={...view,...patch};backY=0;const h=hash();if(location.hash===h){CF.render();window.scrollTo(0,0)}else location.hash=h}
function pageTo(n){if(pageBusy||!allowed())return;pendingPage=n;pageError=false;pageBusy=true;CF.render();const token=epoch;setTimeout(()=>{if(token!==epoch||S.page!==P||!allowed())return;pageBusy=false;if(fault==='page'){fault='';pageError=true;CF.render()}else{skipRestore=true;location.hash=hash({...view,page:n});window.scrollTo(0,0)}},450)}
function beforeRender(){const signed=CF.opsAuth.can(14);if(!signed&&[P,PD].includes(S.page))returnHash=location.hash;
A.beforeRender();if(!signed&&wasSigned){epoch++;readRetry.clear();listCache=null;batch=null;batchBusy=false;pageBusy=false;detailKey='';}if(signed&&!wasSigned&&returnHash){location.hash=returnHash;returnHash=''}wasSigned=signed;
if(S.page===P&&allowed()&&location.hash.split('?')[0]==='#'+LIST){const next=readView(),key=hash(next);if(key!==activeListHash){const sameScope=next.category===view.category&&next.status===view.status&&next.size===view.size;view=next;restore=!skipRestore&&restoreContext(key);if(!restore){if(!sameScope)listCache=null;backY=0;backId=''}activeListHash=key;skipRestore=false}const count=(listCache||matching()).length;view.page=Math.min(Math.max(1,Math.ceil(count/view.size)),Math.floor(view.page));if(location.hash!==hash())history.replaceState(null,'',hash());backHash=hash();S.toTop=false}
if(S.page===PD&&allowed()){S.toTop=false;backHash=safeList(params().get('from'));const key=params().get('id')||'';if(detailKey!==key){restoreContext(backHash);detailKey=key;startDetail()}}
if(!allowed()){listCache=null}
if(!signed){$('acontent').innerHTML='';$('atools').innerHTML=''}
}
function afterRender(){A.afterRender();document.body.classList.toggle('om-list-active',S.page===P);if(S.page===PD){const crumb=document.querySelector('#acrumb .crumb-cur'),r=visible().find(r=>r.id===params().get('id'));if(crumb&&r)crumb.textContent=text(r.title)||L('Notification','消息')}
if(restore&&S.page===P){restore=false;requestAnimationFrame(()=>{window.scrollTo(0,backY);$('om-row-'+backId)?.focus({preventScroll:true})})}
}
function demo(){let button=(v,en,zh,act='scene')=>B(act,en,zh,v);return `<h5>${L('Demo tools · fictional data','演示工具 · 虚构数据')}</h5><div class="ops-demo-actions">${button('admin','Administrator','运营管理员','identity')}${button('specialist','Specialist','运营专员','identity')}${button('none','No message access','无消息权限','identity')}${button('','Expire session','会话失效','expire')}</div><h5>${L('Page state','页面状态')}</h5><div class="ops-demo-actions">${[['default','Default','默认'],['loading','Loading','加载中'],['empty','Empty','无消息'],['noresult','No results','筛选无结果'],['error','Error','加载失败']].map(x=>button(...x)).join('')}</div><h5>${L('Next request','下次请求')}</h5><div class="ops-demo-actions">${[['page','Page fails','翻页失败'],['panel','Preview fails','面板失败'],['detail','Detail fails','详情失败'],['batch','Batch fails','全部已读失败'],['read','Read update fails','已读标记失败'],['reach','Availability check times out','目标检查超时']].map(x=>button(...x,'fault')).join('')}</div><h5>${L('Detail scenarios','详情场景')}</h5><div class="ops-demo-actions">${[['valid','Pending application','待审核申请'],['agreement','Agreement alert','协议告警'],['history','Historical version target','目标为历史版本'],['deleted','Deleted target','资源已删除'],['handled','Already decided','结论已生效'],['denied','Target denied','目标无权限'],['expired','Expired','已失效'],['missing','Unregistered target','目标未登记'],['none','No target','无跳转'],['malformed','Malformed content','内容异常'],['unsafe','Plain text','纯文本安全'],['foreign','Foreign message','越权深链']].map(x=>button(...x,'detail-demo')).join('')}</div><h5>${L('Target permissions','目标功能权限')}</h5><div class="ops-demo-actions">${[[5,'Funder certification query','资金方机构认证申请查询'],[9,'Agreement content query','协议当前内容查询'],[16,'Agreement activity records','协议操作记录查看']].map(([n,en,zh])=>B('grant',en+' · '+(canTarget(n)?'on':'off'),zh+' · '+(canTarget(n)?'已开通':'未开通'),String(n))).join('')}</div><p class="hint">${L('Message access stays on operations message viewing alone; each target is judged by its own permission item. Fixed items cannot be switched off here.','消息准入只看运营端消息查看，目标另按各自的功能权限项判定；固定开通的权限项在此不可关闭。')}</p><div class="ops-demo-actions">${B('new','Unregistered category','分类未登记')}${B('incoming','Receive a message','接收新消息')}${B('overflow','Over 99 unread','超过 99 条未读')}${B('batch','Try marking as read','尝试全部已读')}${B('reset','Reset demo','重置演示')}</div><p class="hint">${L('Local simulation. No real service is connected.','本地模拟，未连接真实服务。')}</p>`}
function act(act,v){if(!act.startsWith('om-'))return false;const k=act.slice(3);
if(['batch','confirm','page'].includes(k)&&!allowed()){CF.toast(L('You do not have permission.','你没有操作权限。'));return true}
if(k==='refresh'||k==='clear'){changeView(k==='clear'?{category:'',status:'all',page:1}:{page:1});return true}
if(k==='filter'){changeView({status:v,page:1});return true}if(k==='page'){pageTo(Number(v));return true}
if(k==='retry'){scene='default';listCache=null;return true}if(k==='detail-retry'){startDetail();return true}
if(k==='batch'){batch=batchRows().map(r=>r.id);batchError=false;CF.openLayer('modal','om-batch');return true}
if(k==='cancel'){if(!batchBusy)CF.closeLayer();return true}
if(k==='confirm'){if(batchBusy)return true;batchBusy=true;batchError=false;batch=batchRows().map(r=>r.id);const token=epoch,reader=identity(),ids=batch.slice();setTimeout(()=>{if(token!==epoch||reader!==identity()||!allowed())return;batchBusy=false;if(fault==='batch'){fault='';batchError=true;CF.render();return}mark(ids);const n=ids.length;CF.closeLayer();CF.toast(L(n+' notifications marked as read.','已将 '+n+' 条消息标为已读。'));CF.render()},550);return true}
if(k==='identity'){epoch++;readRetry.clear();revoked=v==='none';CF.opsAuth.seedDemo(v==='specialist'||v==='none'?'specialist':'admin');scene='default';listCache=null;detailKey='';S.demo=false;S.layer=null;batchBusy=false;pageBusy=false;changeView({category:'',status:'all',page:1});return true}
if(k==='expire'){returnHash=location.hash;A.onAct('ops-session-expire');return true}
if(k==='scene'){scene=v;S.demo=false;if(S.page!==P)location.hash=backHash;return true}
if(k==='fault'){fault=v;CF.toast(L('Next request configured.','已设置下次请求结果。'));return true}
if(k==='grant'){A.onAct('ops-grant',v);detailKey='';return true}
if(k==='detail-demo'){detailMode=['deleted','handled','denied','missing'].includes(v)?v:'';detailKey='';if(v==='foreign'){location.hash='#'+DETAIL+'?id=other-person'}else {const r=structuredClone(D.seed()[v==='history'?6:v==='agreement'?4:0]);r.id='scenario-'+v;r.demoMode=detailMode;r.expires=v==='expired'?new Date(Date.now()-1000).toISOString():null;if(v==='none'){delete r.target;delete r.relation}if(v==='malformed'){r.title={};r.summary={};r.body={}}if(v==='unsafe')r.body={en:'<img src=x onerror=alert(1)>\nThis is plain text.',zh:'<img src=x onerror=alert(1)>\n以上内容按纯文本展示。'};rows=rows.filter(x=>x.id!==r.id);rows.push(r);location.hash=detailURL(r.id,backHash)}S.demo=false;return true}
if(k==='overflow'){for(let i=0;i<110;i++){const r=structuredClone(D.seed()[0]);r.id='overflow-'+i;r.at=new Date().toISOString();rows.unshift(r)}return true}
if(k==='incoming'||k==='new'){const r=structuredClone(D.seed()[k==='new'?4:0]);r.id='new-'+Date.now();r.at=new Date().toISOString();
 /* 分类映射尚未登记时回落到“其他”，合法消息不得因此消失。 */
 if(k==='new')r.category='pending-registry-'+Date.now().toString(36);
 rows.unshift(r);CF.toast(L('A new message is available. Refresh the list to view it.','收到新消息，刷新列表后查看。'));return true}
if(k==='reset'){rows=D.seed();for(const r of rows)put(identity()+'.'+r.id,'');fault='';scene='default';detailMode='';detailKey='';listCache=null;revoked=false;CF.opsAuth.seedDemo();changeView({category:'',status:'all',size:20,page:1});S.demo=false;return true}
return false;
}
N.configure({blocked:()=>revoked,visible,from:()=>S.page===P?hash():backHash,failPanel(){const failed=fault==='panel';if(failed)fault='';return failed},onRows(value){rows=value}});

CF.review.register(P,{group:['Notifications','消息中心'],route:LIST,states:()=>allowed()?['default','loading','empty','noresult','error']:['default'],
  get:()=>scene,set(value){scene=value;listCache=null;},reset(){scene='default';fault='';pageError=false;listCache=null;}
});
CF.review.register(PD,{group:['Notifications','消息中心'],route:()=>visible()[0]?detailURL(visible()[0].id):null,
  states:()=>allowed()?['default','loading','error']:['default'],get:()=>detailState==='ready'?'default':detailState,
  set(value){epoch++;detailState=value==='default'?'ready':value;},reset(){epoch++;detailState='ready';fault='';}
});

const module={...A,id:'ops-messages',reviewToolsInLayer:false,dict:{en:{...A.dict.en,navOpsMessages:'Notifications',navOpsMessageDetail:'Notification details'},zh:{...A.dict.zh,navOpsMessages:'消息中心',navOpsMessageDetail:'消息详情'}},demo,breadcrumbRoute:id=>id===P?backHash.slice(1):null,content:id=>id===P?list():id===PD?detail():(id==='P-O-AL-06'&&allowed()&&safeMessage(params().get('from'))?`<a class="nc-back" id="om-source" href="${E(safeMessage(params().get('from')))}">← ${L('Return to notification','返回原消息')}</a>`:'')+A.content(id),beforeRender,afterRender,layers:{...A.layers,'om-batch':batchLayer},onBeforeAct(act,v,e){if(batchBusy)return true;if(act==='ops-notifications'&&revoked)return true;return A.onBeforeAct(act,v,e)},onAct:(a,v,e)=>{const handled=act(a,v,e);if(handled&&['om-detail-demo','om-overflow','om-incoming','om-new','om-reset'].includes(a))N.replaceRows(rows);return handled||A.onAct(a,v,e)},onRoute(prev,next){if(prev===P)saveContext();epoch++;batchBusy=false;batch=null;pageBusy=false;detailKey='';detailState='';if(next===P){activeListHash='';restore=false}if(next===PD)requestAnimationFrame(()=>window.scrollTo(0,0));A.onRoute(prev,next)}};
CF.define(module);CF.opsAuth.seedDemo();S.end='admin';S.role='ops';
if(!location.hash||location.hash==='#/')location.hash='#'+LIST;
document.addEventListener('change',e=>{if(e.target.id==='om-category')changeView({category:e.target.value,page:1});if(e.target.id==='om-size')changeView({size:Number(e.target.value),page:1})});
document.addEventListener('click',e=>{const r=e.target.closest('.nc-row[data-id]');if(r&&S.page===P){backId=r.dataset.id;saveContext()}},true);
window.addEventListener('beforeunload',()=>{if(S.page===P)saveContext()});
window.addEventListener('storage',e=>{if(e.key?.startsWith(STORE)&&allowed())CF.render()});
let interval=null;function sync(){if(!allowed())return;if(readRetry.size){mark([...readRetry]);readRetry.clear();CF.render()}else updateCount()}
function clock(){clearInterval(interval);if(!document.hidden){sync();interval=setInterval(sync,60000)}}
document.addEventListener('visibilitychange',clock);CF.boot();clock();
})(window.CF);
