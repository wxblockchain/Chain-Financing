/* WS-360: local UI simulation. Auth, routing, overlays and account UI use the shared host. */
(function(CF){
'use strict';
const S=CF.S,L=CF.L,E=CF.esc,A=CF.opsAccountModule,D=CF.opsMessageDemo,N=CF.opsNotifications;
const BATCH=20,LIST='/ops/notifications',DETAIL='/ops/notification',P='P-O20',PD='P-O21',STORE='hc.ops.messages.v1.';
const $=id=>document.getElementById(id),text=o=>o?(o[S.lang]||o.en||''):'';
let rows=N.rows,revoked=false,scene='default',fault='',batch=null,batchBusy=false,batchError=false,moreBusy=false,moreError=false,shown=BATCH,detailState='',detailKey='',detailMode='',epoch=0,wasSigned=true,returnHash='',listCache=null,view={category:'',status:'all'},backHash='#'+LIST,backY=0,backId='',restore=false,readRetry=new Set(),activeListHash='',skipRestore=false;
const get=N.getRead,put=N.setRead;
/* 消息准入只看运营端消息查看；业务目标由目标模块的功能权限项分别判定。 */
const canTarget=n=>!!CF.opsAuth&&CF.opsAuth.can(n);
const REACH_MS=3000;
let reach='idle',reachTimer=null,readBusy=false;
const identity=()=>CF.opsAuth.getIdentity().email,allowed=()=>CF.opsAuth.can(12)&&!revoked;
const expired=r=>!!r.expires&&Date.parse(r.expires)<=Date.now();
const visible=()=>allowed()&&scene!=='empty'?rows.filter(r=>r.platform==='lending'&&r.end==='admin'&&(!r.owner||r.owner===identity())).sort((a,b)=>(b.created||b.at).localeCompare(a.created||a.at)||b.id.localeCompare(a.id)):[];
const isRead=N.isRead;
const unread=()=>visible().filter(r=>!isRead(r)&&!expired(r));
const categories=()=>Array.from(new Set(visible().map(r=>r.category).filter(Boolean)));
const cat=k=>text(D.categories[k])||L('Other','其他');
const statusName=k=>({all:L('All messages','全部消息'),unread:L('Unread','未读'),read:L('Read','已读')})[k];
function params(){return new URLSearchParams(location.hash.split('?')[1]||'')}
function hash(v=view){const q=new URLSearchParams();if(v.category)q.set('category',v.category);if(v.status!=='all')q.set('status',v.status);return '#'+LIST+(q.size?'?'+q:'')}
function cleanView(q){return {category:categories().includes(q.get('category'))?q.get('category'):'',status:['all','read','unread'].includes(q.get('status'))?q.get('status'):'all'}}
function readView(){return cleanView(params())}
// Return paths are local message routes only; they never grant access to a record.
function safeList(raw){if(typeof raw!=='string'||raw.split('?')[0]!=='#'+LIST)return '#'+LIST;const q=new URLSearchParams(raw.split('?')[1]||'');return hash(cleanView(q))}
function detailURL(id,from=hash()){return '#'+DETAIL+'?'+new URLSearchParams({id,from:safeList(from)})}
function safeMessage(raw){if(typeof raw!=='string'||raw.split('?')[0]!=='#'+DETAIL)return '';const q=new URLSearchParams(raw.split('?')[1]||'');return q.get('id')?detailURL(q.get('id'),q.get('from')):''}
function saveContext(){if(!allowed())return;const key=hash();backHash=key;backY=window.scrollY;try{sessionStorage.setItem(STORE+'context.'+identity()+'.'+key,JSON.stringify({ids:listCache,shown,y:backY,id:backId}))}catch(e){}}
function restoreContext(key){let saved;try{saved=JSON.parse(sessionStorage.getItem(STORE+'context.'+identity()+'.'+key)||'null')}catch(e){}if(!saved)return false;listCache=Array.isArray(saved.ids)?saved.ids.filter(id=>typeof id==='string'):null;shown=Math.max(BATCH,Math.ceil((Number(saved.shown)||BATCH)/BATCH)*BATCH);backY=Math.max(0,Number(saved.y)||0);backId=typeof saved.id==='string'?saved.id:'';return true}
const matching=()=>visible().filter(r=>(!view.category||r.category===view.category)&&(view.status==='all'||(view.status==='unread'?!isRead(r):isRead(r))));
const batchRows=()=>matching().filter(r=>!isRead(r));
function mark(ids){N.mark(ids)}
const absolute=N.absolute,relative=N.relative;
function B(act,en,zh,v='',primary=false,disabled=false){return `<button class="btn${primary?' primary':''}" type="button" data-act="om-${act}" data-v="${E(v)}" ${disabled?'disabled':''}>${L(en,zh)}</button>`}
const label=N.label;
const back=()=>`<a class="nc-back" href="${E(backHash)}">← ${L('Back to messages','返回消息列表')}</a>`;
function skeleton(){return `<div role="status" aria-label="${L('Loading messages','正在加载消息')}">${Array.from({length:5},()=>'<div class="nc-skeleton-row"><span class="skel"></span><span class="skel"></span><span class="skel"></span></div>').join('')}</div>`}
function empty(kind){return CF.empty(kind==='noresult'?L('No messages match these filters','没有符合筛选条件的消息'):L('No notifications yet','暂无消息'),kind==='noresult'?L('Try a different category or reading status.','试试其他分类或阅读状态。'):L('New notifications will appear here.','收到的新消息会显示在这里。'),kind==='noresult'?B('clear','Clear filters','清除筛选'):'')}
function row(r){const title=text(r.title)||L('Notification','通知');return `<article class="nc-row" data-unread="${!isRead(r)}" data-id="${E(r.id)}"><a class="nc-message-link${expired(r)?' om-expired':''}" id="om-row-${E(r.id)}" aria-label="${E((isRead(r)?L('Read: ','已读：'):L('Unread: ','未读：'))+title)}" href="${E(detailURL(r.id,S.page===P?hash():backHash))}"><div class="nc-message-heading"><span class="nc-message-title" title="${E(title)}">${E(title)}</span>${label(r)}</div>${context(r)}<p class="nc-summary">${E(text(r.title)?text(r.summary):'')}</p><div class="nc-message-foot"><span>${E(cat(r.category))}${expired(r)?' · '+L('Expired','已过期'):''}</span><time datetime="${r.at}" title="${E(absolute(r.at))}">${E(CF.relTime(r.at))}</time></div></a></article>`}
/* 原业务名称与编号：与面客端同一行呈现，用来区分同名消息；来源未提供时不显示。 */
function context(r){const b=r.business;if(!b)return '';const name=text(b.name),number=b.number?String(b.number):'';if(!name&&!number)return '';
 return `<span class="nc-context">${name?`<span class="nc-context-name">${E(name)}</span>`:''}${number?`<span class="nc-context-reference">${E(number)}</span>`:''}</span>`}
/* 加载更多：每批 20 条追加在已加载内容之后，不给页码、不显示含已读的总条数。 */
function more(total){if(scene!=='default'||!total)return '';const left=shown<total;
return `<div class="loadmore">${moreError?`<span class="om-more-error" role="alert">${L('Could not load more. What is already loaded is unchanged.','加载失败，已加载的内容保持不变。')}</span>`:''}${left?B('more',moreBusy?'Loading…':moreError?'Retry':'Load more',moreBusy?'加载中…':moreError?'重试':'加载更多','',false,moreBusy):`<span class="om-more-end" role="status">${L('No more messages','没有更多消息了')}</span>`}</div>`}
/* 新消息自动插入列表顶部：只插入符合当前筛选、且比已加载内容更新的消息；不重新筛选已加载的结果，
   “未读”筛选下读过的消息因此保留在原处。插入前记下视口顶端的那一条，插入后把它放回原来的位置。 */
function absorb(){if(S.page!==P||!allowed()||!listCache||scene!=='default')return;
 /* 按创建时间判断新到：到点消息晚到时发生时间较早，仍按创建时间插入顶部。 */
 const made=r=>r.created||r.at,have=new Set(listCache),newest=listCache.reduce((t,id)=>{const r=visible().find(x=>x.id===id);return r&&made(r)>t?made(r):t},'');
 const fresh=matching().filter(r=>!have.has(r.id)&&made(r)>newest).map(r=>r.id);if(!fresh.length)return;
 const anchor=topRow();listCache=fresh.concat(listCache);shown+=fresh.length;CF.render();
 if(anchor){const el=document.querySelector(`.nc-row[data-id="${CSS.escape(anchor.id)}"]`);if(el)window.scrollBy(0,el.getBoundingClientRect().top-anchor.top)}}
function topRow(){if(window.scrollY<=0)return null;const edge=(document.querySelector('.topbar')?.getBoundingClientRect().bottom||0)+(document.querySelector('.om-inbox .nc-filters')?.offsetHeight||0);
 const el=[...document.querySelectorAll('.om-inbox .nc-row')].find(x=>x.getBoundingClientRect().bottom>edge);return el?{id:el.dataset.id,top:el.getBoundingClientRect().top}:null}
function list(){if(!allowed())return CF.empty(L('No access to notifications','无权查看消息'),L('The delivered configuration does not give this account the operations message permission.','当前交付配置未为该账号开通运营端消息查看权限。'),'');
let ids=listCache||(listCache=matching().map(r=>r.id)),data=ids.map(id=>visible().find(r=>r.id===id)).filter(Boolean),count=batchRows().length;
let body=scene==='loading'?skeleton():scene==='error'?CF.empty(L('Messages could not be loaded','消息加载失败'),L('Check your connection and try again.','请检查连接后重试。'),B('retry','Retry','重试')):scene==='empty'?empty('empty'):scene==='noresult'?empty('noresult'):!data.length?empty(view.category||view.status!=='all'?'noresult':'empty'):data.slice(0,shown).map(r=>row(r)).join('');
const opt=(value,name)=>`<option value="${E(value)}" ${view.category===value?'selected':''}>${E(L('Category: ','分类：')+name)}</option>`;
return `<section class="nc-inbox om-inbox"><div class="nc-head"><div><h1 class="page-title">${L('Notifications','消息中心')}</h1><p class="page-sub">${L('Updates for your operations, all in one place.','查看运营动态与账户通知。')}</p></div>${B('batch','Mark all as read','全部已读','',false,!count||scene!=='default')}${!count&&scene==='default'?`<span class="nc-all-hint">${L('No unread messages in this view','当前筛选下没有未读消息')}</span>`:''}</div><section class="nc-feed"><div class="nc-filters nc-inbox-filters"><div class="nc-status-options" role="group" aria-label="${L('Read status','阅读状态')}">${[['all','All','全部'],['unread','Unread','未读'],['read','Read','已读']].map(([k,en,zh])=>`<button type="button" data-act="om-filter" data-v="${k}" aria-pressed="${view.status===k}" ${moreBusy?'disabled':''}>${L(en,zh)}</button>`).join('')}</div><div class="nc-category-field"><label class="sr-only" for="om-category">${L('Category','分类')}</label><select id="om-category" class="inp" ${moreBusy?'disabled':''}>${opt('',L('All categories','全部分类'))}${categories().map(c=>opt(c,cat(c))).join('')}</select></div></div><div class="nc-list" id="om-list" aria-busy="${moreBusy}">${body}${more(data.length)}</div></section><p class="ops-sample">${L('Demonstration data','演示数据')}</p></section>`}
/* 进入详情时按原业务当前情况处理：不存在与无权统一为“暂不可访问”；未登记或不跳转时不给入口也不提示；
   过期只标示、不收回入口；原动作已办完时说明已不适用，入口仍指向这一笔。详情只保留一个前往入口。 */
function targetPlan(r){
 const t=r.target;if(!t||detailMode==='missing')return null;
 const plan={...t,permitted:canTarget(t.permission)};
 /* 从消息进入本人账户设置时带上返回原消息的途径，不丢失原列表上下文。 */
 if(t.to==='settings')plan.route=t.route+'?'+new URLSearchParams({from:safeMessage(location.hash)});
 plan.state=detailMode==='deleted'||detailMode==='denied'||!plan.permitted?'unavailable':detailMode==='handled'?'readonly':'open';
 return plan;
}
function targetNote(plan){return {
 unavailable:L('The related content is unavailable.','相关内容暂不可访问。'),
 readonly:L('This action no longer applies. You can still view the current result.','该操作已不适用，可查看当前结果。')
}[plan.state]||''}
/* 原业务名称与编号：来源提供时展示，编号可复制；不再逐项罗列定位字段。 */
function business(r){const b=r.business;if(!b)return '';const name=text(b.name),number=b.number?String(b.number):'';if(!name&&!number)return '';
 return `<p class="om-business">${name?`<span class="om-business-name">${E(name)}</span>`:''}${number?`<span class="om-reference"><span class="mono">${E(number)}</span>${CF.copyBtn('om-copy',number,L('Copy reference','复制业务编号'))}</span>`:''}</p>`}
function targetBlock(r){
 const plan=targetPlan(r);if(!plan)return '';
 const note=targetNote(plan);
 if(plan.state==='unavailable')return `<footer class="nc-actions om-target"><p id="om-reason">${E(note)}</p></footer>`;
 const checking=!plan.page&&reach==='checking',unconfirmed=!plan.page&&reach==='unconfirmed';
 const hint=[note,unconfirmed?L('We could not confirm the current status. You can still open it.','暂未确认当前状态，仍可前往查看。'):''].filter(Boolean).join(' ');
 const d=CF.AdminMenu.destination(plan.to,plan.route),label=L('View related content','查看相关内容');
 const entry=checking?`<span class="btn primary" aria-disabled="true" role="status">${L('Checking…','正在检查…')}</span>`
  :`<a class="btn primary" href="${E(d.href)}" data-admin-destination="${E(plan.to)}" data-admin-route="${E(d.route)}"${hint?' aria-describedby="om-reason"':''}>${label}</a>`;
 return `<footer class="nc-actions om-target">${hint?`<p id="om-reason">${E(hint)}</p>`:''}${entry}</footer>`;
}
function related(r){const content=business(r)+targetBlock(r);return content?`<div class="om-related">${content}</div>`:''}
function detail(){if(!allowed())return list();let r=visible().find(r=>r.id===params().get('id'));if(!r)return back()+CF.empty(L('Notification not found','消息不存在'),L('Return to your messages to continue.','返回消息中心继续查看。'),'');
if(detailState==='loading')return back()+`<div class="nc-feed">${skeleton()}</div>`;
if(detailState==='error')return back()+CF.empty(L('Could not load this notification','消息加载失败'),L('It has not been marked as read yet.','这条消息尚未标为已读。'),B('detail-retry','Retry','重试')+`<a class="btn" href="${E(backHash)}">${L('Back to list','返回列表')}</a>`);
/* 已读保存失败：消息仍显示未读，正文照常可读；重试只处理已读。 */
const readFail=readRetry.has(r.id)&&!isRead(r)?`<div class="nc-read-feedback" role="alert"><span>${L('Could not mark this message as read.','未能标为已读。')}</span>${B('read-retry','Retry','重试','',false,readBusy)}</div>`:'';
return `<section class="om-reading nc-reading"><article class="card"><div class="card-b"><h1 tabindex="-1" id="om-detail-title">${E(text(r.title)||L('Notification','通知'))}</h1><div class="nc-reading-meta"><div class="nc-meta"><span>${E(cat(r.category))}</span><span>·</span><time datetime="${E(r.at)}">${E(absolute(r.at))}</time>${expired(r)?'<span>·</span><span class="om-expired-label">'+L('Expired','已过期')+'</span>':''}</div>${label(r)}</div>${readFail}<div class="nc-body">${E(text(r.body))}</div>${related(r)}</div></article><p class="ops-sample">${L('Demonstration data','演示数据')}</p></section>`}
/* N-O05：进入详情时对原业务对象做辅助可达性判断，最长 3 秒；超时后仍可尝试进入，目标自身的权限与状态限制照常生效。 */
function startReach(id){clearTimeout(reachTimer);const r=visible().find(r=>r.id===id),plan=r?targetPlan(r):null;
 if(!plan||plan.page||!['open','readonly'].includes(plan.state)){reach='idle';return}
 const token=epoch,slow=fault==='reach';if(slow)fault='';reach='checking';
 reachTimer=setTimeout(()=>{if(token!==epoch||S.page!==PD||params().get('id')!==id)return;reach=slow?'unconfirmed':'ready';CF.render()},slow?REACH_MS:500);}
function startDetail(){const token=++epoch,reader=identity(),id=params().get('id'),requestedFault=fault;detailMode=visible().find(r=>r.id===id)?.demoMode||'';detailState='loading';reach='idle';clearTimeout(reachTimer);setTimeout(()=>{if(token!==epoch||reader!==identity()||!allowed()||S.page!==PD||params().get('id')!==id)return;detailState=requestedFault==='detail'?'error':'ready';if(requestedFault==='detail')fault='';const r=visible().find(r=>r.id===params().get('id'));CF.render();if(r&&detailState==='ready'){if(requestedFault==='read'){fault='';readRetry.add(r.id)}else mark([r.id]);startReach(id);CF.render();$('om-detail-title')?.focus({preventScroll:true})}},350)}
function updateCount(){N.refresh()}
function batchLayer(){const n=batch?.length||0;return {title:L('Mark all as read?','确认全部已读？'),html:`<p>${L('Mark '+n+' unread message(s) under the current filter as read.','将把当前筛选下的 '+n+' 条未读消息标为已读。')}</p><p class="tiny">${L('Category: ','分类：')}${E(view.category?cat(view.category):L('All categories','全部分类'))}${L(' · Status: ','；阅读状态：')}${statusName(view.status)}</p>${batchError?CF.note('red',L('Could not mark as read. Nothing has changed; please retry.','标为已读失败，消息状态未改变，请重试。')):''}`,foot:B('cancel','Cancel','取消','',false,batchBusy)+B('confirm',batchBusy?'Updating…':batchError?'Retry':'Confirm',batchBusy?'处理中…':batchError?'重试':'确认','',true,batchBusy)}}
function changeView(patch){skipRestore=true;activeListHash='';listCache=null;scene='default';moreError=false;shown=BATCH;view={...view,...patch};backY=0;const h=hash();if(location.hash===h){CF.render();window.scrollTo(0,0)}else location.hash=h}
function loadMore(){if(moreBusy||!allowed())return;moreError=false;moreBusy=true;CF.render();const token=epoch;setTimeout(()=>{if(token!==epoch||S.page!==P||!allowed())return;moreBusy=false;if(fault==='page'){fault='';moreError=true}else shown+=BATCH;CF.render()},450)}
function beforeRender(){const signed=CF.opsAuth.can(14);if(!signed&&[P,PD].includes(S.page))returnHash=location.hash;
A.beforeRender();if(!signed&&wasSigned){epoch++;readRetry.clear();listCache=null;batch=null;batchBusy=false;moreBusy=false;detailKey='';}if(signed&&!wasSigned&&returnHash){location.hash=returnHash;returnHash=''}wasSigned=signed;
if(S.page===P&&allowed()&&location.hash.split('?')[0]==='#'+LIST){const next=readView(),key=hash(next);if(key!==activeListHash){const sameScope=next.category===view.category&&next.status===view.status;view=next;restore=!skipRestore&&restoreContext(key);if(!restore){if(!sameScope){listCache=null;shown=BATCH}backY=0;backId=''}activeListHash=key;skipRestore=false}if(location.hash!==hash())history.replaceState(null,'',hash());backHash=hash();S.toTop=false}
if(S.page===PD&&allowed()){S.toTop=false;backHash=safeList(params().get('from'));const key=params().get('id')||'';if(detailKey!==key){restoreContext(backHash);detailKey=key;startDetail()}}
if(!allowed()){listCache=null}
if(!signed){$('acontent').innerHTML='';$('atools').innerHTML=''}
}
function measureReadingChrome(){const content=$('acontent');if(!content)return;content.style.setProperty('--om-topbar-height',(document.querySelector('.topbar')?.offsetHeight||0)+'px');content.style.setProperty('--om-filter-height',(document.querySelector('.om-inbox .nc-filters')?.offsetHeight||0)+'px')}
function afterRender(){A.afterRender();measureReadingChrome();document.body.classList.toggle('om-list-active',S.page===P);if(S.page===PD){const crumb=document.querySelector('#acrumb .crumb-cur'),r=visible().find(r=>r.id===params().get('id'));if(crumb&&r)crumb.textContent=text(r.title)||L('Notification','通知')}
if(restore&&S.page===P){restore=false;requestAnimationFrame(()=>{window.scrollTo(0,backY);$('om-row-'+backId)?.focus({preventScroll:true})})}
}
function demo(){let button=(v,en,zh,act='scene')=>B(act,en,zh,v);return `<h5>${L('Demo tools · fictional data','演示工具 · 虚构数据')}</h5><div class="ops-demo-actions">${button('admin','Administrator','运营管理员','identity')}${button('specialist','Later role','后期角色','identity')}${button('none','No message access','无消息权限','identity')}${button('','Expire session','会话失效','expire')}</div><h5>${L('Page state','页面状态')}</h5><div class="ops-demo-actions">${[['default','Default','默认'],['loading','Loading','加载中'],['empty','Empty','无消息'],['noresult','No results','筛选无结果'],['error','Error','加载失败']].map(x=>button(...x)).join('')}</div><h5>${L('Next request','下次请求')}</h5><div class="ops-demo-actions">${[['page','Load more fails','加载更多失败'],['panel','Preview fails','面板失败'],['detail','Detail fails','详情失败'],['batch','Batch fails','全部已读失败'],['read','Read update fails','已读标记失败'],['reach','Record check times out','原业务检查超时']].map(x=>button(...x,'fault')).join('')}</div><h5>${L('Detail scenarios','详情场景')}</h5><div class="ops-demo-actions">${[['valid','Pending application','待审核申请'],['agreement','Agreement alert','协议告警'],['history','Historical version target','目标为历史版本'],['deleted','Record removed','原业务不存在'],['handled','Action no longer applies','原动作已办完'],['denied','No access to record','无权查看原业务'],['expired','Expired','已过期'],['missing','Type not registered','类型未登记'],['none','No target','无跳转'],['malformed','Malformed content','内容异常'],['unsafe','Plain text','纯文本安全'],['foreign','Foreign message','越权深链']].map(x=>button(...x,'detail-demo')).join('')}</div><h5>${L('Target permissions','目标功能权限')}</h5><div class="ops-demo-actions">${[[5,'Funder certification query','资金方机构认证申请查询'],[9,'Agreement content query','协议当前内容查询'],[15,'Agreement version history','协议历史版本读取']].map(([n,en,zh])=>B('grant',en+' · '+(canTarget(n)?'on':'off'),zh+' · '+(canTarget(n)?'已开通':'未开通'),String(n))).join('')}</div><p class="hint">${L('Message access depends on operations message viewing only; each related record is judged by its own permission item.','消息准入只看运营端消息查看，相关内容另按各自的功能权限项判定。')}</p><div class="ops-demo-actions">${B('new','Unregistered category','分类未登记')}${B('incoming','Receive a message','接收新消息')}${B('late','Late time-triggered message','到点消息晚到')}${B('overflow','Over 99 unread','超过 99 条未读')}${B('batch','Try marking as read','尝试全部已读')}${B('reset','Reset demo','重置演示')}</div><p class="hint">${L('Local simulation. No real service is connected.','本地模拟，未连接真实服务。')}</p>`}
function act(act,v){if(!act.startsWith('om-'))return false;const k=act.slice(3);
if(['batch','confirm','more'].includes(k)&&!allowed()){CF.toast(L('You do not have permission.','你没有操作权限。'));return true}
if(k==='clear'){changeView({category:'',status:'all'});return true}
if(k==='filter'){changeView({status:v});return true}if(k==='more'){loadMore();return true}
if(k==='retry'){scene='default';listCache=null;return true}if(k==='detail-retry'){startDetail();return true}
if(k==='read-retry'){const id=params().get('id');if(readBusy||!readRetry.has(id))return true;readBusy=true;const token=epoch;setTimeout(()=>{if(token!==epoch)return;readBusy=false;mark([id]);readRetry.delete(id);CF.render()},400);return true}
if(k==='copy'){const done=()=>CF.toast(L('Copied','已复制')),manual=()=>CF.toast(L('Select the reference to copy it.','请选中编号后复制。'));if(navigator.clipboard)navigator.clipboard.writeText(v).then(done,manual);else manual();return true}
if(k==='batch'){batch=batchRows().map(r=>r.id);batchError=false;CF.openLayer('modal','om-batch');return true}
if(k==='cancel'){if(!batchBusy)CF.closeLayer();return true}
if(k==='confirm'){if(batchBusy)return true;batchBusy=true;batchError=false;batch=batchRows().map(r=>r.id);const token=epoch,reader=identity(),ids=batch.slice();setTimeout(()=>{if(token!==epoch||reader!==identity()||!allowed())return;batchBusy=false;if(fault==='batch'){fault='';batchError=true;CF.render();return}mark(ids);const n=ids.length;CF.closeLayer();CF.toast(L(n+' notifications marked as read.','已将 '+n+' 条消息标为已读。'));CF.render()},550);return true}
if(k==='identity'){epoch++;readRetry.clear();revoked=v==='none';CF.opsAuth.seedDemo(v==='specialist'||v==='none'?'specialist':'admin');scene='default';listCache=null;detailKey='';S.demo=false;S.layer=null;batchBusy=false;moreBusy=false;changeView({category:'',status:'all'});return true}
if(k==='expire'){returnHash=location.hash;A.onAct('ops-session-expire');return true}
if(k==='scene'){scene=v;S.demo=false;if(S.page!==P)location.hash=backHash;return true}
if(k==='fault'){fault=v;CF.toast(L('Next request configured.','已设置下次请求结果。'));return true}
if(k==='grant'){A.onAct('ops-grant',v);detailKey='';return true}
if(k==='detail-demo'){detailMode=['deleted','handled','denied','missing'].includes(v)?v:'';detailKey='';if(v==='foreign'){location.hash='#'+DETAIL+'?id=other-person'}else {const r=structuredClone(D.seed()[v==='history'?6:v==='agreement'?4:0]);r.id='scenario-'+v;r.demoMode=detailMode;r.expires=v==='expired'?new Date(Date.now()-1000).toISOString():null;if(v==='none'){delete r.target;delete r.business}if(v==='malformed'){r.title={};r.summary={};r.body={}}if(v==='unsafe')r.body={en:'<img src=x onerror=alert(1)>\nThis is plain text.',zh:'<img src=x onerror=alert(1)>\n以上内容按纯文本展示。'};rows=rows.filter(x=>x.id!==r.id);rows.push(r);location.hash=detailURL(r.id,backHash)}S.demo=false;return true}
if(k==='overflow'){for(let i=0;i<110;i++){const r=structuredClone(D.seed()[0]);r.id='overflow-'+i;r.at=new Date().toISOString();rows.unshift(r)}return true}
if(k==='incoming'||k==='new'||k==='late'){const seed=D.seed(),r=structuredClone(k==='late'?seed.find(x=>x.category==='alert')||seed[0]:seed[k==='new'?4:0]);r.id='new-'+Date.now();r.created=new Date().toISOString();
 /* 列表按创建时间排序；到点消息晚到时业务发生时间早于创建时间，仍排在最前并展示发生时间。 */
 r.at=k==='late'?new Date(Date.now()-5*60000).toISOString():r.created;
 /* 分类映射尚未登记时回落到“其他”，合法消息不得因此消失。 */
 if(k==='new')r.category='pending-registry-'+Date.now().toString(36);
 rows.unshift(r);N.replaceRows(rows);absorb();CF.toast(L('A new message has arrived.','新消息已到达。'));return true}
if(k==='reset'){rows=D.seed();for(const r of rows)put(identity()+'.'+r.id,'');fault='';scene='default';detailMode='';detailKey='';listCache=null;revoked=false;CF.opsAuth.seedDemo();changeView({category:'',status:'all'});S.demo=false;return true}
return false;
}
N.configure({blocked:()=>revoked,visible,from:()=>S.page===P?hash():backHash,failPanel(){const failed=fault==='panel';if(failed)fault='';return failed},onRows(value){rows=value;absorb()}});

CF.review.register(P,{group:['Notifications','消息中心'],route:LIST,states:()=>allowed()?['default','loading','empty','noresult','error']:['default'],
  scenarios:()=>allowed()?['unread','read'].map(st=>({id:st,label:st==='unread'?['Unread notifications','未读消息']:['Read notifications','已读消息'],route:LIST+'?status='+st,description:['Filter existing notifications','筛选已有消息']})):[],
  get:()=>scene,set(value){scene=value;listCache=null;},reset(){scene='default';fault='';moreError=false;shown=BATCH;listCache=null;}
});
CF.review.register(PD,{group:['Notifications','消息中心'],route:()=>visible()[0]?detailURL(visible()[0].id):null,
  states:()=>allowed()?['default','loading','error']:['default'],get:()=>detailState==='ready'?'default':detailState,
  set(value){epoch++;detailState=value==='default'?'ready':value;},reset(){epoch++;detailState='ready';fault='';}
});

const module={...A,id:'ops-messages',reviewToolsInLayer:false,dict:{en:{...A.dict.en,navOpsMessages:'Notifications',navOpsMessageDetail:'Notification details'},zh:{...A.dict.zh,navOpsMessages:'消息中心',navOpsMessageDetail:'消息详情'}},demo,breadcrumbRoute:id=>id===P?backHash.slice(1):null,content:id=>id===P?list():id===PD?detail():(id==='P-O-AL-06'&&allowed()&&safeMessage(params().get('from'))?`<a class="nc-back" id="om-source" href="${E(safeMessage(params().get('from')))}">← ${L('Return to notification','返回原消息')}</a>`:'')+A.content(id),beforeRender,afterRender,layers:{...A.layers,'om-batch':batchLayer},onBeforeAct(act,v,e){if(batchBusy)return true;if(act==='ops-notifications'&&revoked)return true;return A.onBeforeAct(act,v,e)},onAct:(a,v,e)=>{const handled=act(a,v,e);if(handled&&['om-detail-demo','om-overflow','om-incoming','om-new','om-reset'].includes(a))N.replaceRows(rows);return handled||A.onAct(a,v,e)},onRoute(prev,next){if(prev===P)saveContext();epoch++;batchBusy=false;batch=null;moreBusy=false;detailKey='';detailState='';if(next===P){activeListHash='';restore=false}if(next===PD)requestAnimationFrame(()=>window.scrollTo(0,0));A.onRoute(prev,next)}};
CF.define(module);CF.opsAuth.seedDemo();S.end='admin';S.role='ops';
if(!location.hash||location.hash==='#/')location.hash='#'+LIST;
document.addEventListener('change',e=>{if(e.target.id==='om-category')changeView({category:e.target.value})});
document.addEventListener('click',e=>{const r=e.target.closest('.nc-row[data-id]');if(r&&S.page===P){backId=r.dataset.id;saveContext()}},true);
window.addEventListener('beforeunload',()=>{if(S.page===P)saveContext()});
window.addEventListener('storage',e=>{if(e.key?.startsWith(STORE)&&allowed())CF.render()});
let interval=null;function sync(){if(!allowed())return;updateCount();absorb()}
function clock(){clearInterval(interval);if(!document.hidden){sync();interval=setInterval(sync,60000)}}
document.addEventListener('visibilitychange',clock);CF.boot();clock();
new ResizeObserver(measureReadingChrome).observe(document.querySelector('.topbar'));
window.addEventListener('resize',measureReadingChrome);
})(window.CF);
