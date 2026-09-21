/* WS-355 V1.1. Read-only console, six independent object pages and L5–L8 links. */
(function(CF){
 'use strict';
 const S=CF.S,D=CF.LS,Q=CF.CQ,L=CF.L,E=CF.esc,old=CF.LSView,H=3600000,DAY=24*H;
 const kinds=['tokens','projects','credits','loans','repayments','quotes'];
 const names={tokens:['Tokens','代币列表'],projects:['Financing projects','融资项目'],credits:['Credit facilities','授信明细'],loans:['Disbursements','融资放款信息'],repayments:['Repayments','还款信息'],quotes:['My quotes','我的报价']};
 const titles={tokens:['Token details','代币详情'],projects:['Project details','融资项目详情'],credits:['Credit details','授信详情'],loans:['Disbursement details','融资放款详情'],repayments:['Repayment instalment','还款期次详情'],quotes:['Quote details','报价详情']};
 const labels={valid:['Valid','有效'],void:['Void','失效'],pledged:['Pledged','已质押'],unpledged:['Not pledged','未质押'],draft:['Draft','草稿'],raising:['Fundraising','募集中'],locked:['Locked','已锁定'],financing:['Financing','融资中'],closed:['Closed','已关闭'],settled:['Settled','已结清'],surplus:['Coverage surplus','覆盖有余'],balanced:['Coverage balanced','覆盖持平'],short:['Coverage shortfall','覆盖不足'],effective:['Effective','生效中'],expired:['Expired','已到期'],pending:['Pending disbursement','待放款'],confirming:['Awaiting receipt','待放款确认'],repaying:['Repaying','还款中'],terminated:['Terminated','已终止'],waiting:['Awaiting acceptance','待接受'],rejected:['Rejected','已拒绝'],quoteExpired:['Quote expired','报价已失效'],due:['Pending repayment','待还款'],repayConfirming:['Awaiting repayment confirmation','待还款确认'],initial:['Initial plan','初始版'],final:['Final plan','确认版'],open:['Awaiting quotes','待报价'],quoted:['Awaiting quote confirmation','已报价待确认'],funding:['Funding','放款中'],funded:['Disbursed','已放款'],ended:['Invalidated / closed','已失效／已关闭']};
 const text=a=>Array.isArray(a)?L(...a):a||'—';
 const nm=k=>k==='credits'&&S.role==='fund'?L('Credit summary','授信汇总'):text(names[k]);
 const status=k=>text(labels[k]||[k,k]);
 const badge=k=>CF.tag(['valid','settled','effective','surplus'].includes(k)?'ok':['short','confirming','repayConfirming','waiting'].includes(k)?'warn':'',status(k));
 const money=(n,c='USD')=>n==null?'—':CF.fmtAmt(n)+' '+E(c);
 const time=n=>n==null||!Number.isFinite(new Date(n).getTime())?'—':CF.fmtTime(new Date(n).toISOString());
 const date=n=>n?CF.fmtDate(typeof n==='number'?new Date(n).toISOString():n):'—';
 const small=s=>'<div class="mc-small">'+s+'</div>';
 const b=(a,t,v='',primary=false,off=false)=>'<button type="button" class="btn'+(primary?' primary':'')+'" data-act="mc-'+a+'" data-v="'+E(v)+'"'+(off?' disabled':'')+'>'+E(t)+'</button>';
 const link=(a,t,v='',extra='')=>a==='detail'&&!extra.includes('disabled')?'<a class="actlink" href="'+E(detailHref(...v.split('|')))+'" data-act="mc-detail" data-v="'+E(v)+'" '+extra+'>'+E(t)+'</a>':'<button type="button" class="actlink" data-act="mc-'+a+'" data-v="'+E(v)+'" '+extra+'>'+E(t)+'</button>';
 const dl=rows=>'<dl class="dl">'+rows.filter(Boolean).map(([k,v])=>'<dt>'+E(k)+'</dt><dd>'+v+'</dd>').join('')+'</dl>';
 const copy=v=>'<span class="mono">'+E(v)+'</span> '+link('copy',L('Copy','复制'),v);
 const tabs=()=>S.role==='fund'?['quotes','credits','loans','repayments']:['tokens','projects','credits','loans','repayments'];
 const allowed=()=>['asset','fund'].includes(S.role);
 const path=()=>location.hash.slice(1).split('?')[0];
 const params=()=>new URLSearchParams(location.hash.split('?')[1]||'');
 const now=()=>CF.L8?.now||CF.L7?.now()||D.now();
 const party=q=>Q.related(q);
 const fund=id=>id==='fund-b'?L('Demo Capital B','演示资金机构 B'):L('Demo Capital A','演示资金机构 A');
 const owner=id=>id==='entity-demo-a'?L('Demo Asset Company A','演示资产企业 A'):L('Demo Asset Company B','演示资产企业 B');
 const counter=q=>S.role==='asset'?fund(q.fund):owner(q.owner);
 let detailState='normal',statsError=false,focusAfter='',lastHash='',lastRole=S.role,restoring=false,copyValue='',returnNotice=false;
 CF.PAGES['P-MC-01'].retainList=true;
 const dict={en:{},zh:{}};
 kinds.forEach((k,i)=>{const id='P-MC-0'+(i+2),key='mcDetail'+i;CF.PAGES[id]={end:'asset',layout:'portal',parent:'P-MC-01',crumbKey:key,auth:true,retainList:true};CF.ENTRY[id]='/console/'+k;dict.en[key]=titles[k][0];dict.zh[key]=titles[k][1];});
 function safeRoute(raw,detail=true){
   if(!raw||raw.length>12000||!/^#\/console(?:\?|$|\/(tokens|projects|credits|loans|repayments|quotes)\?)/.test(raw))return '';
   const p=raw.slice(1).split('?')[0];if(p!=='/console'&&(!detail||!kinds.some(k=>p==='/console/'+k)))return '';
   const q=new URLSearchParams(raw.split('?')[1]||'');if(p!=='/console'&&!q.get('id'))return '';
   const clean=new URLSearchParams();['tab','filter','secondary','project','sort','size','page','y','scroll','focus','id'].forEach(k=>{if(q.has(k))clean.set(k,q.get(k).slice(0,160));});
   if(detail&&q.has('list')){const list=safeRoute(q.get('list'),false);if(list)clean.set('list',list);}
   return '#'+p+(clean.size?'?'+clean:'');
 }
 function view(){const q=params(),tab=tabs().includes(q.get('tab'))?q.get('tab'):tabs()[0];return {tab,filter:q.get('filter')||'',secondary:q.get('secondary')||'',project:q.get('project')||'',sort:q.get('sort')||(tab==='credits'?'available-asc':tab==='repayments'?'sequence':'newest'),size:[20,50,100].includes(+q.get('size'))?+q.get('size'):20,page:Math.min(100000,Math.max(1,parseInt(q.get('page'))||1))};}
 function listRoute(k){return safeRoute(params().get('list'),false)||'#/console?tab='+k;}
 function detailHref(k,id){return '#/console/'+k+'?'+new URLSearchParams({id,list:path()==='/console'?location.hash:listRoute(k)});}
 function snapshot(){
   const q=params();q.set('y',Math.round(window.scrollY));q.set('scroll',Math.round(document.getElementById('mc-list')?.scrollTop||0));
   const f=document.activeElement?.closest('[data-id]')?.dataset.id;if(f)q.set('focus',f);
   const hash='#'+path()+'?'+q;try{history.replaceState(null,'',hash);}catch(_){}return hash;
 }
 function navigate(hash){S.layer=null;S.st='default';detailState='normal';location.hash=hash;}
 function goDetail(k,id){const list=path()==='/console'?snapshot():listRoute(k);navigate('#/console/'+k+'?'+new URLSearchParams({id,list}));}
 function setView(patch){const v={...view(),...patch};focusAfter=Object.keys(patch)[0];navigate('#/console?'+new URLSearchParams(v));}
 function normalized(k){
   if(!allowed())return [];
   const related=Q.data().quotes.filter(party),ownProjects=D.projects.filter(p=>p.owner==='entity-demo-a');
   if(k==='tokens')return S.role==='asset'?D.tokens.filter(t=>t.owner==='entity-demo-a').map(t=>({...t,status:t.valid?'valid':'void',pledged:t.pledge==='pledged',project:t.pool||null,amount:t.value,at:t.issued||t.from})):[];
   if(k==='projects')return S.role==='asset'?ownProjects.map(p=>({...p,project:p.id,status:p.state,n:D.numbers(p),amount:D.current(p)?.amount||0,at:p.created||p.published})):[];
   if(k==='credits')return Q.data().credits.filter(c=>S.role==='asset'?c.owner==='entity-demo-a':party(c)).map(c=>{const transit=Q.data().quotes.filter(q=>q.owner===c.owner&&q.fund===c.fund&&['waiting','funding'].includes(q.state)).reduce((n,q)=>n+q.amount,0),expired=Date.parse(c.expires+'T23:59:59Z')<now();return {...c,status:expired?'expired':'effective',transit,available:expired?0:Math.max(0,c.total-c.principal-transit),used:c.principal+transit,at:c.first};});
   if(k==='repayments')return related.flatMap(q=>{
     const deal=q.l7,plan=q.l8,initial=!plan&&['waiting','funding'].includes(q.state);
     const ps=plan?.periods||(initial&&CF.L8?CF.L8.build(new Date(q.at).toISOString().slice(0,10),q.repay.slice(0,10),q.amount,q.rate,q.fx.value):[]);
     return ps.map(p=>({...p,id:p.id||'INITIAL-'+q.id+'-'+p.seq,project:q.project,business:q.id,request:q.demand,q,deal,plan,version:initial?'initial':'final',status:p.state==='pending'?'repayConfirming':p.state==='settled'?'settled':'due',overdue:initial?0:p.record?p.record.overdue:Math.max(0,Math.floor((Date.parse(new Date(now()).toISOString().slice(0,10))-Date.parse(p.due))/DAY)),deadline:p.state==='pending'?Date.parse(p.record.at)+168*H:null,at:q.at}));
   });
   return related.filter(q=>k==='quotes'||q.l7).map(q=>{const x=q.l7;return {...q,q,deal:x,status:x?({pending:'pending',waiting:'confirming',confirmed:q.l8?.settledAt?'settled':'repaying',terminated:'terminated'}[x.state]):({waiting:'waiting',rejected:'rejected',expired:'quoteExpired',terminated:'terminated'}[q.state]||q.state),request:q.demand,deadline:x?.state==='waiting'?Date.parse(x.record.at)+168*H:q.state==='waiting'?q.end:null};});
 }
 function filtered(){const v=view();let rows=S.st==='empty'?[]:normalized(v.tab);rows=rows.filter(r=>(!v.filter||r.status===v.filter)&&(!v.project||r.project===v.project)&&(!v.secondary||(v.tab==='tokens'?(r.pledged?'pledged':'unpledged'):v.tab==='projects'?r.n.grade:v.tab==='repayments'?(r.overdue?'yes':'no'):(r.status==='confirming'&&r.deadline<=now()?'yes':'no'))===v.secondary));
   if(S.st==='noresult')return [];
   const value=r=>v.sort.startsWith('value')?r.value:v.sort.startsWith('available')?r.available:v.sort.startsWith('due')?Date.parse(r.due):v.sort==='remaining'?r.deadline??Infinity:v.sort==='sequence'?r.seq:Date.parse(r.at)||Number(r.at)||0;
   rows.sort((a,b)=>{if(v.sort==='sequence'&&a.business!==b.business)return a.business.localeCompare(b.business);return (value(a)-value(b)||a.id.localeCompare(b.id))*(v.sort==='newest'||v.sort.endsWith('desc')?-1:1);});return rows;
 }
 function find(k,id){return normalized(k).find(r=>r.id===id);}
 function countdown(r,quote=false){if(!r.deadline)return '—';const left=r.deadline-now();if(left<=0)return '<strong class="mc-warning">'+L(quote?'Quote expired':'Confirmation overdue',quote?'报价已过期':'确认已超期')+'</strong>';return Math.ceil(left/H)+L(' hours left',' 小时内到期');}
 function shortcuts(k,r){
   const items=[];const add=(key,en,zh,enabled=true,reason='')=>items.push({key,title:L(en,zh),enabled,reason});
   if(detailState==='stale')return [];
   if(k==='tokens'){if(r.project)add('view','View project in marketplace','到借贷广场查看项目');else if(r.valid)add('market','Go to lending marketplace','前往借贷广场');}
   if(k==='projects'){
     const a=D.actions(D.project(r.id));if(a.pledge)add('pledge','Add collateral','去追加质押');
     if(a.publish)add('publish','Publish request','去发布融资需求');
     if(a.withdraw)add('withdraw','Withdraw collateral','去提取代币');
     if(r.demands.some(d=>d.state==='quoted'))add('quote_confirm','Review quote','去接受／拒绝报价');
   }
   if(k==='credits')add('market','Manage credit in marketplace','前往借贷广场查看授信');
   if(k==='loans'||k==='quotes'){
     if(r.status==='pending'&&S.role==='fund')add('pay','Record disbursement','去放款');
     if(r.status==='pending'&&S.role==='asset'&&r.deal.redo)add('reupload','Upload stamped contract','去重传盖章件');
     if(r.status==='confirming'&&S.role==='asset')add('confirm','Confirm funds received','去确认到账');
     if(r.deal?.record)add('record','View disbursement record','到广场查看放款记录');
     if(r.status==='waiting'&&S.role==='asset')add('quote_confirm','Review quote','去接受／拒绝报价');
   }
   if(k==='repayments'&&r.version==='final'){
     if(r.status==='due'&&S.role==='asset')add('repay','Record repayment','去还款',now()>=r.open,L('Opens ','开启时间：')+time(r.open));
     if(r.status==='repayConfirming'&&S.role==='fund')add('repay-confirm','Confirm repayment','去确认收到还款');
     if(r.record)add('repay-record','View repayment record','到广场查看还款记录');
     add('plan','View complete schedule','到广场查看还款计划');
   }
   if(r.project&&!items.some(x=>x.key==='view'))add('view','View project in marketplace','到借贷广场查看项目');
   return items;
 }
 function jump(k,id,action){
   const r=find(k,id),a=r&&shortcuts(k,r).find(a=>a.key===action);if(!a||!a.enabled){CF.toast(L('The action is no longer available. Review the latest details.','操作已不可用，请查看最新详情。'));CF.render();return;}
   const back=snapshot(),q=new URLSearchParams({mcReturn:back});
   if(action==='market'){navigate('#/marketplace?'+q);return;}
   if(['loans','quotes'].includes(k))q.set('business',r.id);
   if(k==='repayments'){q.set('business',r.business);q.set('instalment',r.id);if(action!=='view')q.set('repayment',{'repay':'pay','repay-confirm':'confirm','repay-record':'record',plan:'plan'}[action]);}
   else if(action!=='view')q.set('action',action);
   navigate('#/project/'+encodeURIComponent(r.project)+'?'+q);
 }
 function controls(k,r,full=false){const as=shortcuts(k,r);return as.slice(0,full?as.length:1).map((a,i)=>(full?b('jump',a.title,k+'|'+r.id+'|'+a.key,i===0,a.enabled===false):link('jump',a.title,k+'|'+r.id+'|'+a.key,a.enabled?'':'disabled'))+(!a.enabled?small(E(a.reason)):'')).join('');}
 function stat(title,value,note=''){return '<div class="stat"><div class="k">'+E(title)+'</div><div class="v">'+value+'</div>'+(note?'<div class="n">'+note+'</div>':'')+'</div>';}
 function summary(){
   if(S.st==='loading')return CF.skelTable(2);
   const empty=S.st==='empty',tokens=empty?[]:normalized('tokens'),credits=empty?[]:normalized('credits'),sum=(rs,k)=>rs.reduce((n,r)=>n+(+r[k]||0),0),pledged=tokens.filter(r=>r.pledged),voids=pledged.filter(r=>!r.valid);
   let html=S.role==='asset'?'<section class="card mc-assets"><div>'+L('All tokens','全部代币')+'<b>'+tokens.length+L(' tokens',' 张')+'</b><span class="mono">'+money(sum(tokens,'value'))+'</span></div><div>'+L('Of which pledged','其中已质押')+'<b>'+pledged.length+L(' tokens',' 张')+'</b><span class="mono">'+money(sum(pledged,'value'))+'</span>'+small(L('Of which void: ','其中已失效：')+voids.length+L(' tokens',' 张')+' · '+money(sum(voids,'value')))+'</div><p class="mc-small">'+L('USD values use the issuance exchange-rate snapshots.','USD 价值按签发时汇率快照折算。')+'</p></section>':'';
   return html+'<div class="stat-row mc-summary">'+(statsError?stat(L('Total credit','总授信额度'),'—',b('stats-retry',L('Retry','重新加载'))):stat(L('Total credit','总授信额度'),money(sum(credits,'total'))))+stat(L('Financed balance','已融额度'),money(sum(credits,'principal')))+stat(L('Available credit','剩余可用授信'),money(sum(credits,'available')),'<span>'+L('Subject to assessment when publishing a request.','实际可融金额以发布需求时核定结果为准。')+'</span>')+'</div>';
 }
 const filterOptions={tokens:['valid','void'],projects:['draft','raising','locked','financing','closed','settled'],credits:['effective','expired'],loans:['pending','confirming','repaying','settled','terminated'],repayments:['due','repayConfirming','settled'],quotes:['waiting','rejected','quoteExpired','pending','confirming','repaying','settled','terminated']};
 function select(key,title,options,value){return '<div class="field"><label for="mc-'+key+'">'+E(title)+'</label><select class="inp" id="mc-'+key+'">'+options.map(([v,t])=>'<option value="'+E(v)+'"'+(v===value?' selected':'')+'>'+E(t)+'</option>').join('')+'</select></div>';}
 function filters(){const v=view(),all=['',L('All','全部')];let h=select('filter',v.tab==='tokens'?L('Token status','代币状态'):v.tab==='projects'?L('Project status','项目状态'):L('Status','状态'),[all,...filterOptions[v.tab].map(k=>[k,status(k)])],v.filter);
   const sec=v.tab==='tokens'?['pledged','unpledged']:v.tab==='projects'?['surplus','balanced','short']:['loans','repayments'].includes(v.tab)?['yes','no']:[];
   if(sec.length)h+=select('secondary',v.tab==='tokens'?L('Pledge status','质押状态'):v.tab==='projects'?L('Coverage','质押覆盖状态'):v.tab==='loans'?L('Confirmation overdue','确认是否超期'):L('Repayment overdue','还款是否逾期'),[all,...sec.map(k=>[k,k==='yes'?L('Yes','是'):k==='no'?L('No','否'):status(k)])],v.secondary);
   if(v.tab==='tokens')h+=select('project',L('Project','所属融资项目'),[all,...normalized('projects').map(p=>[p.id,text(p.name)])],v.project);
   const sorts=v.tab==='tokens'?[['newest',L('Issued · newest first','签发时间倒序')],['value-asc',L('Value · ascending','价值升序')],['value-desc',L('Value · descending','价值降序')],['due-asc',L('Due · earliest','到期日升序')]]:v.tab==='credits'?[['available-asc',L('Available credit · ascending','可用授信升序')],['available-desc',L('Available credit · descending','可用授信降序')]]:v.tab==='repayments'?[['sequence',L('Business / instalment','业务及期次顺序')],['due-asc',L('Due · earliest','应还日升序')],['remaining',L('Time remaining · shortest','剩余时限升序')]]:[['newest',L('Newest first','时间倒序')],['oldest',L('Oldest first','时间升序')],['remaining',L('Time remaining · shortest','剩余时限升序')]];
   return '<div class="filters">'+h+select('sort',L('Sort','排序'),sorts,v.sort)+'<div class="acts">'+b('clear',L('Reset filters','清空筛选'))+'</div></div>';
 }
 function columns(k){return {
   tokens:[[L('Token','代币编号'),'id'],[L('Quantity','数量'),'num'],[L('Value (USD)','价值（USD）'),'num'],[L('Token status','代币状态'),''],[L('Pledge status','质押状态'),''],[L('Receivable due','应收账款到期日'),''],[L('Project','所属项目'),'']],
   projects:[[L('Project','融资项目'),'id'],[L('Status','项目状态'),''],[L('Requested (USD)','融资需求（USD）'),'num'],[L('Balance (USD)','已融资余额（USD）'),'num'],[L('Coverage','覆盖状态'),''],[L('Project deadline','项目截止日'),'']],
   credits:[[L('Facility / counterparty','授信编号／对方企业'),'id'],[L('Credit limit (USD)','授信额度（USD）'),'num'],[L('Available (USD)','可用授信（USD）'),'num'],[L('Status','额度状态'),''],[L('Valid until','有效期至'),'']],
   loans:[[L('Business / counterparty','融资业务／对方企业'),'id'],[L('Amount (USD)','融资金额（USD）'),'num'],[L('Currency','结算币种'),''],[L('Status','业务状态'),''],[L('Confirmation window','确认时限'),'']],
   quotes:[[L('Business / request','融资业务／需求编号'),'id'],[L('Project','所属项目'),''],[L('Asset holder','资产方'),''],[L('Amount (USD)','融资金额（USD）'),'num'],[L('Status','业务状态'),''],[L('Quote window','报价有效期'),'']],
   repayments:[[L('Business / instalment','融资业务／期次'),'id'],[L('Due date','应还日'),''],[L('Principal (USD)','本金（USD）'),'num'],[L('Interest (USD)','利息（USD）'),'num'],[L('Total (USD)','合计（USD）'),'num'],[L('Status','期次状态'),''],[L('Window','办理时限'),'']]
 }[k];}
 function rowValues(k,r){const object=t=>'<a class="mc-object" href="'+E(detailHref(k,r.id))+'" data-act="mc-detail" data-v="'+k+'|'+E(r.id)+'">'+E(t)+'</a>';
   if(k==='tokens')return [object(r.id),CF.fmtAmt(r.units),CF.fmtAmt(r.value),badge(r.status),badge(r.pledged?'pledged':'unpledged'),date(r.due),r.project?E(text(D.project(r.project)?.name)):'—'];
   if(k==='projects')return [object(text(r.name))+small(E(r.id)),badge(r.status),CF.fmtAmt(r.amount),CF.fmtAmt(r.balance),badge(r.n.grade)+(r.n.gap?'<span class="mc-indicator">'+L('Gap ','缺口 ')+money(r.n.gap)+'</span>':r.demands.some(d=>d.state==='quoted')?'<span class="mc-indicator">'+L('Quote awaiting review','有待确认报价')+'</span>':''),date(r.expires)];
   if(k==='credits')return [object(r.id)+small(E(counter(r))),CF.fmtAmt(r.total),CF.fmtAmt(r.available),badge(r.status),date(r.expires)];
   if(k==='repayments')return [object(r.business)+small(L('Instalment ','第 ')+r.seq+L('',' 期')+' · '+E(r.request)),date(r.due)+(r.version==='initial'?small(status('initial')):''),CF.fmtAmt(r.principal),CF.fmtAmt(r.interest),'<strong>'+CF.fmtAmt(r.total)+'</strong>',badge(r.status)+(r.overdue?'<span class="mc-indicator">'+L('Overdue ','逾期 ')+r.overdue+L(' days',' 天')+'</span>':''),r.version==='initial'?L('Not effective','未生效'):r.deadline?countdown(r):r.status==='due'?now()>=r.open?L('Repayment open','可还款'):L('Opens ','开启日 ')+date(r.open):'—'];
   const state=badge(r.status)+(r.deal?.redo?'<span class="mc-indicator">'+L('Contract re-upload requested','待重传盖章件')+'</span>':'')+(r.deal?.hold?'<span class="mc-indicator">'+L('Disbursement deferred','已暂缓放款')+'</span>':'');
   if(k==='quotes')return [object(r.id)+small(E(r.request)),E(text(D.project(r.project)?.name)),E(owner(r.owner)),CF.fmtAmt(r.amount),state,r.status==='waiting'?countdown(r,true):'—'];
   return [object(r.id)+small(E(counter(r))),CF.fmtAmt(r.amount),E(r.ccy),state,r.status==='confirming'?countdown(r):'—'];
 }
 function table(){const v=view(),all=filtered(),count=Math.max(1,Math.ceil(all.length/v.size));v.page=Math.min(v.page,count);const rs=all.slice((v.page-1)*v.size,v.page*v.size),cols=columns(v.tab);
   let body=S.st==='loading'?'<div role="status" aria-label="'+L('Loading','加载中')+'">'+CF.skelTable(5)+'</div>':S.st==='error'?CF.empty(L('List could not be loaded','列表加载失败'),L('Your filters have been preserved.','已保留当前筛选条件。'),b('retry',L('Retry','重试'))):!rs.length?CF.empty(L(S.st==='empty'?'No records yet':'No matching records',S.st==='empty'?'暂无记录':'暂无符合条件的记录'),returnNotice?L('The latest record no longer matches these filters.','最新记录已不符合当前筛选条件。'):L('Try another filter or return later.','可调整筛选条件或稍后再查看。'),b('clear',L('Clear filters','清空筛选'))):'<div class="listbox" id="mc-list" tabindex="0" aria-label="'+E(nm(v.tab))+'"><table class="tbl mc-table"><thead><tr>'+[...cols,[L('Actions','操作'),'']].map(([t])=>'<th scope="col">'+E(t)+'</th>').join('')+'</tr></thead><tbody>'+rs.map(r=>'<tr data-id="'+E(r.id)+'" data-kind="'+v.tab+'" tabindex="0" aria-label="'+E(text(titles[v.tab])+' '+r.id)+'">'+rowValues(v.tab,r).map((c,i)=>'<td data-label="'+E(cols[i][0])+'" class="'+cols[i][1]+'"><div>'+c+'</div></td>').join('')+'<td data-label="'+L('Actions','操作')+'" class="mc-actions"><div>'+link('detail',L('View details','查看详情'),v.tab+'|'+r.id)+controls(v.tab,r)+'</div></td></tr>').join('')+'</tbody></table></div>';
   return '<div class="mc-caption"><span>'+E(nm(v.tab))+' · '+all.length+L(' records',' 条')+'</span><span>'+L('All amounts are in USD unless marked otherwise.','金额单位为 USD，其他币种另行标注。')+'</span></div>'+body+'<div class="pager"><span class="total">'+all.length+L(' records',' 条记录')+'</span><label for="mc-size">'+L('Rows per page','每页')+'</label><select class="inp" id="mc-size">'+[20,50,100].map(n=>'<option'+(n===v.size?' selected':'')+'>'+n+'</option>').join('')+'</select>'+b('page',L('Previous','上一页'),v.page-1,false,v.page<=1)+'<span>'+v.page+' / '+count+'</span>'+b('page',L('Next','下一页'),v.page+1,false,v.page>=count)+'</div>';
 }
 function gate(){return '<div class="mc-error">'+CF.empty(L(S.role==='limited'?'Complete account setup':'Sign in to view your console',S.role==='limited'?'请先完成账户必办事项':'登录后查看我的控制台'),L('Your company information is available after sign-in.','登录后可查看本企业数据。'),'<button class="btn primary" data-act="signin">'+L('Sign in','登录')+'</button>')+'</div>';}
 function listing(){if(!allowed())return gate();if(S.st==='denied')return unavailable();const v=view();return '<div class="mc-root"><div class="page-head"><div><h1 class="page-title">'+L('My console','我的控制台')+'</h1><p class="page-desc">'+L('Balances, financing activity and upcoming actions.','查看资金概览、融资进展与待办事项。')+'</p></div><div class="page-actions">'+b('refresh',L('Refresh','刷新'))+'</div></div>'+summary()+'<section class="card mc-ledger"><div class="mc-tabs" role="tablist" aria-label="'+L('Console records','控制台信息')+'">'+tabs().map(k=>'<button role="tab" aria-selected="'+(k===v.tab)+'" tabindex="'+(k===v.tab?0:-1)+'" data-act="mc-tab" data-v="'+k+'">'+E(nm(k))+'</button>').join('')+'</div><div role="tabpanel" aria-label="'+E(nm(v.tab))+'">'+filters()+table()+'</div></section></div>';}
 function unavailable(){return '<div class="mc-root mc-error">'+CF.empty(L('Content unavailable','内容不存在或无权访问'),L('Return to your console to view available records.','请返回控制台查看可访问的记录。'),b('list',L('Back to console','返回我的控制台'),'#/console'))+'</div>';}
 function section(id,title,body){return {id,title,html:'<section class="card detail-section" id="'+id+'"><div class="card-head"><h2>'+E(title)+'</h2></div><div class="card-body">'+body+'</div></section>'};}
 function refs(r){return dl([[L('Business ID','融资业务编号'),copy(r.business||r.id)],[L('Request ID','融资需求编号'),copy(r.request||r.demand)],[L('Project','所属融资项目'),E(text(D.project(r.project)?.name))+'<br>'+copy(r.project)],[L('Asset holder','资产方'),E(owner(r.owner||r.q.owner))],[L('Funder','资金方'),E(fund(r.fund||r.q.fund))]]);}
 function terms(q){return dl([[L('Financing amount','融资金额'),money(q.amount)],[L('Settlement amount','结算金额'),money(q.settlement,q.ccy)],[L('Annual interest rate','年化利率'),E(q.rate)+'%'],[L('Repayment deadline','还款截止日'),date(q.repay)],[L('Exchange rate','汇率'),'1 '+E(q.ccy)+' = '+E(q.fx.value)+' USD'],[L('Rate source','汇率来源'),E(text(q.fx.source))],[L('Rate snapshot','汇率快照时间'),time(q.fx.at)],[L('Snapshot version','汇率版本'),E(q.fx.version)]]);}
 function account(f,ccy){if(ccy!=='USD')return dl([[L('Repayment address','还款收款地址'),copy(f?.repayWallet||'0x2222222222222222222222222222222222222222')],[L('Network','链'),'ETH · ERC-20']]);return dl([['repayName',L('Account name','户名')],['repayNumber',L('Account number','账号')],['repaySwift','SWIFT / BIC'],['repayBank',L('Bank','开户行')],['repayIntermediary',L('Intermediary bank','中转行')]].map(([k,t])=>[t,E(f?.[k]||'—')]));}
 function details(k,r){
   const out=[],add=(id,t,body)=>out.push(section(id,t,body));
   if(k==='tokens'){
     add('mc-basic',L('Token information','代币信息'),dl([[L('Token ID','代币编号'),copy(r.id)],[L('Quantity','代币数量'),CF.fmtAmt(r.units)],[L('Token value','代币价值'),money(r.value)],[L('Buyer','买方企业'),E(text(r.buyer))],[L('Receivable period','底层应收账款账期'),date(r.from)+' → '+date(r.due)],[L('Issued at','签发时间'),time(r.issued)],[L('Token status','代币状态'),badge(r.status)],[L('Pledge status','质押状态'),badge(r.pledged?'pledged':'unpledged')]]));
     add('mc-project',L('Associated project','关联融资项目'),r.project?dl([[L('Project','融资项目'),E(text(D.project(r.project)?.name))],[L('Project ID','项目编号'),copy(r.project)]])+'<p>'+link('detail',L('View console project details','查看控制台项目详情'),'projects|'+r.project)+'</p>':CF.empty(L('No pledged project','当前未质押至融资项目'),''));
   }else if(k==='projects'){
     const n=r.n;
     add('mc-basic',L('Project overview','项目概况'),dl([[L('Project ID','融资项目编号'),copy(r.id)],[L('Project name','融资项目名称'),E(text(r.name))],[L('Token type','代币类型'),L('Receivables','应收账款')],[L('Project status','项目状态'),badge(r.status)],[L('Project deadline','项目有效截止日'),date(r.expires)],[L('Created at','创建时间'),time(r.created)],[L('First published','首次发布时间'),time(r.published)]]));
     add('mc-coverage',L('Collateral and coverage','质押与覆盖'),dl([[L('Pledged tokens','质押代币张数'),n.pool.length],[L('Effective token value','有效代币价值'),money(n.value)],[L('Pledge ratio','质押率'),'80%'],[L('Financing limit','最大可融金额'),money(n.limit)],[L('Outstanding principal','已融资余额'),money(r.balance)],[L('In-transit requests','在途需求金额'),money(n.fly)],[L('Available financing','可追加融资金额'),money(n.free)],[L('Coverage status','质押覆盖状态'),badge(n.grade)],[L('Coverage shortfall','覆盖缺口'),money(n.gap)],[L('Additional asset value needed','需追加资产价值'),money(n.gap/0.8)],[L('Void pledged tokens','已质押失效代币'),n.pool.filter(t=>!t.valid).length],[L('Withdrawable token value','可提取代币价值'),r.l8ReleasePending?L('Release result pending','释放结果待取得'):money(D.tokens.filter(t=>t.releasedFrom===r.id&&t.pledge==='released').reduce((n,t)=>n+t.value,0)+n.withdraw)]]));
     add('mc-rounds',L('Financing rounds','融资轮次'),r.demands.length?r.demands.map(d=>{const quotes=Q.data().quotes.filter(q=>q.demand===d.id&&q.project===r.id&&party(q));return '<article class="mc-record"><div class="mc-record-head"><b class="mono">'+E(d.id)+'</b>'+badge(d.state)+'</div>'+dl([[L('Requested amount','需求金额'),money(d.amount)],[L('Published at','发布时间'),time(d.at)],[L('Quote submitted at','报价提交时间'),time(d.quoteAt)],[L('Reason','结束原因'),E(d.reason||'—')]])+quotes.map(q=>'<p>'+link('detail',L('View financing business ','查看融资业务 ')+q.id,(q.l7?'loans':'quotes')+'|'+q.id)+'</p>').join('')+(d.state==='quoted'?b('jump',L('Review this quote','去处理本轮报价'),'projects|'+r.id+'|quote_confirm'):d.state==='open'?b('jump',L('View this request','查看本轮需求'),'projects|'+r.id+'|view'):'')+'</article>';}).join(''):CF.empty(L('No financing rounds','暂无融资轮次'),''));
   }else if(k==='credits'){
     add('mc-basic',L('Credit facility','授信信息'),dl([[L('Credit ID','授信编号'),copy(r.id)],[L('Counterparty','对方企业'),E(counter(r))],[L('Status','额度状态'),badge(r.status)],[L('First established','首次核定时间'),time(r.first)],[L('Valid until','有效期至'),date(r.expires)]]));
     add('mc-credit',L('Credit usage','授信使用情况'),dl([[L('Credit limit','授信额度'),money(r.total)],[L('Principal occupied','授信占用额'),money(r.principal)],[L('Quotes in transit','在途报价金额'),money(r.transit)],[L('Total used','授信已用额合计'),money(r.used)],[L('Available credit','可用授信'),money(r.available)]]));
     if(S.role==='fund')add('mc-note',L('Internal remark','内部备注'),'<p>'+E(r.history?.at(-1)?.remark||L('No internal remark','暂无内部备注'))+'</p>');
   }else if(k==='loans'||k==='quotes'){
     add('mc-basic',L('Business identity','业务信息'),refs(r));add('mc-terms',L('Commercial terms','商务条款'),terms(r));
     if(k==='quotes')add('mc-quote',L('Quote and lock','报价与锁定'),dl([[L('Business status','业务状态'),badge(r.status)],[L('Quote submitted','报价提交时间'),time(r.at)],[L('Lock starts','锁定开始时间'),time(r.at)],[L('Lock duration','锁定时长'),'168 '+L('hours','小时')],[L('Quote expiry','报价到期时间'),time(r.end)],[L('Remaining time','剩余时限'),r.status==='waiting'?countdown(r,true):'—'],[L('Project coverage','当前项目覆盖'),badge(D.numbers(D.project(r.project)).grade)],[L('Termination reason','终止或失效原因'),E(r.deal?.reason||r.reason||'—')]]));
     const x=r.deal;
     if(x){add('mc-contract',L('Contract and disposition','合同与处置'),dl([[L('Contract versions','合同版本数'),x.versions.length],[L('Latest version submitted','最新版本上传时间'),time(x.versions.at(-1)?.at)],[L('Disbursement deferred','暂缓放款原因'),E(x.hold?.text||'—')],[L('Stamped contract re-upload','盖章件重传要求'),E(x.redo?.text||'—')],[L('Terminated at','终止时间'),time(x.terminatedAt)],[L('Termination reason','终止原因'),E(x.reason||'—')]])+b('jump',L('View project and contract','到广场查看项目及合同'),k+'|'+r.id+'|view'));
       add('mc-record',L('Disbursement record','放款记录'),x.record?dl([[L('Record ID','放款记录编号'),copy(x.record.id)],[L('Disbursement amount','放款金额'),money(x.settlement,x.ccy)],[L('Disbursed at','发放时间'),time(x.record.form.paidAt)],[L('Submitted at','提交时间'),time(x.record.at)],[L('Confirmed at','确认时间'),time(x.confirmedAt)],[L('Received amount','实收金额'),x.record.received?money(x.record.received,x.ccy):'—'],[L('Confirmation deadline','放款确认截止'),time(Date.parse(x.record.at)+168*H)],[L('Confirmation window','放款确认剩余时限'),r.status==='confirming'?countdown(r):'—'],[L('Note','放款备注'),E(x.record.form.note||'—')]]):CF.empty(L('No disbursement record yet','暂无放款记录'),L('The funder has not submitted a record.','资金方尚未提交放款记录。')));
       if(x.record)add('mc-account',L('Repayment receiving account','还款收款账户'),account(x.record.form,x.ccy));
     }
   }else{
     add('mc-basic',L('Instalment identity','期次信息'),dl([[L('Plan ID','还款计划编号'),copy(r.id)],[L('Instalment','期次'),r.seq+' / '+(r.plan?.periods.length||CF.L8.build(new Date(r.q.at).toISOString().slice(0,10),r.q.repay.slice(0,10),r.q.amount,r.q.rate,r.q.fx.value).length)],[L('Plan version','计划版本'),badge(r.version)],[L('Business ID','融资业务编号'),copy(r.business)],[L('Request ID','需求编号'),copy(r.request)],[L('Disbursement ID','放款编号'),r.deal?.record?copy(r.deal.record.id):'—'],[L('Project','所属项目'),E(text(D.project(r.project)?.name))],[L('Counterparty','对方企业'),E(counter(r.q))]]));
     add('mc-schedule',L('Amounts and schedule','金额与计息'),dl([[L('Principal due','应还本金'),money(r.principal)],[L('Interest due','应还利息'),money(r.interest)],[L('Total due','应还合计'),money(r.total)],[L('Settlement amount','结算金额'),money(r.settlement,r.q.ccy)],[L('Accrual period','计息区间'),date(r.from)+' → '+date(r.due)],[L('Interest days','计息天数'),r.days],[L('Annual rate','年化利率'),E(r.q.rate)+'% · ACT/360'],[L('Due date','应还日'),date(r.due)],r.version==='final'&&[L('Payment window opens','还款入口开启时间'),time(r.open)],r.version==='final'&&[L('Overdue days','逾期天数'),r.overdue+(r.record?L(' · Frozen at submission',' · 提交后已冻结'):'')],r.plan&&[L('Finalized at','定稿时间'),time(r.plan.at)],r.deadline&&[L('Confirmation deadline','还款确认截止'),time(r.deadline)],r.deadline&&[L('Remaining time','剩余时限'),countdown(r)]]));
     add('mc-record',L('Repayment record','还款记录'),r.record?dl([[L('Record ID','还款记录编号'),copy(r.record.id)],[L('Repaid at','还款时间'),time(r.record.paidAt)],[L('Submitted at','提交时间'),time(r.record.at)],[L('Confirmed at','确认时间'),time(r.record.confirmedAt)],[L('Repayment nature','还款性质'),r.record.overdue?L('Overdue repayment','逾期还款'):L('Normal repayment','正常还款')],[L('Note','备注'),E(r.record.note||'—')]]):CF.empty(L('No repayment record yet','暂无还款记录'),r.version==='initial'?L('This initial plan is not effective.','初始计划尚未生效。'):''));
     if(r.deal?.record)add('mc-account',L('Funder receiving account','资金方收款账户'),account(r.record?.account||r.deal.record.form,r.q.ccy));
     if(r.version==='final')add('mc-plan',L('Other instalments','其他期次'),'<div class="mc-plan-links">'+normalized('repayments').filter(p=>p.business===r.business).map(p=>'<p>'+link('detail',L('Instalment ','第 ')+p.seq+L('',' 期')+' · '+date(p.due)+' · '+status(p.status),'repayments|'+p.id,p.id===r.id?'disabled aria-current="page"':'')+'</p>').join('')+'</div>');
   }
   return out;
 }
 function detail(k){
   if(!allowed())return gate();
   const r=find(k,params().get('id'));if(!r||!tabs().includes(k)&&!(k==='quotes'&&S.role==='asset')||S.st==='denied')return unavailable();
   if(['loading','error'].includes(detailState))return '<div class="mc-root mc-error">'+(detailState==='loading'?'<div role="status">'+CF.skelTable(6)+'</div>':CF.empty(L('Details could not be loaded','详情加载失败'),L('Retry to load this record.','可重试加载当前记录。'),b('detail-retry',L('Retry','重试'))))+'</div>';
   const sections=details(k,r),amount=k==='tokens'?r.value:k==='projects'?r.balance:k==='credits'?r.available:k==='repayments'?r.total:r.amount;
   const metric=k==='tokens'?L('Token value','代币价值'):k==='projects'?L('Financed balance','已融资余额'):k==='credits'?L('Available credit','可用授信'):k==='repayments'?L('Total due','应还合计'):L('Financing amount','融资金额');
   return '<div class="mc-root"><div class="page-head"><div><h1 class="page-title" tabindex="-1">'+E(text(titles[k]))+'</h1><div class="mc-detail-meta">'+copy(r.id)+badge(r.version==='initial'?'initial':r.status)+(k==='repayments'?'<span>'+L('Instalment ','第 ')+r.seq+L('',' 期')+'</span>':'')+'</div></div><div class="page-actions">'+b('refresh',L('Refresh','刷新'))+'</div></div>'+(r.version==='initial'?CF.note('',L('Estimated schedule. It becomes effective after funds are confirmed received.','预计还款安排，确认到账后以定稿计划为准。')):'')+(detailState==='stale'?CF.note('warn',L('The business state changed. The previous action is no longer available.','业务状态已变化，原操作已不可用。')):'')+'<div class="stat-row mc-detail-metrics">'+stat(metric,money(amount))+(k==='repayments'?stat(L('Settlement amount','结算金额'),money(r.settlement,r.q.ccy)):k==='projects'?stat(L('Available financing','可追加融资金额'),money(r.n.free)):k==='credits'?stat(L('Credit limit','授信额度'),money(r.total)):k==='tokens'?stat(L('Receivable due','应收账款到期日'),date(r.due)):stat(L('Settlement amount','结算金额'),money(r.settlement,r.ccy)))+'</div><div class="detail-layout"><div class="detail-stack">'+sections.map(s=>s.html).join('')+'</div><aside class="detail-rail"><section class="card"><div class="card-head"><h2>'+L('Quick links','快捷操作')+'</h2></div><div class="card-b detail-actions">'+(controls(k,r,true)||'<p class="mc-small">'+L('No available action','当前无可用操作')+'</p>')+'</div></section><nav class="card detail-index" aria-label="'+L('On this page','本页内容')+'"><div class="card-b">'+sections.map(s=>link('section',s.title,s.id)).join('')+'</div></nav></aside></div></div>';
 }
 function backBanner(){const back=safeRoute(params().get('mcReturn'));return back&&allowed()?'<div class="mc-return"><span>'+L('Opened from My console','来自我的控制台')+'</span>'+b('return',back.split('?')[0]==='#/console'?L('Return to console list','返回控制台列表'):L('Return to console details','返回控制台详情'),back)+'</div>':'';}
 function reviewTools(){return '<div class="grp"><h5>'+L('Console review states','控制台核验状态')+'</h5>'+[['normal','Normal','正常'],['loading','Detail loading','详情加载中'],['error','Detail error','详情加载失败'],['stale','Action expired','动作失效'],['stats','Summary error','单项统计失败'],['session','Session expired','登录失效']].map(([v,en,zh])=>b('scenario',L(en,zh),v)).join('')+'<p class="hint">'+L('Fixtures are shared with the marketplace; no real payment is made.','演示数据与广场共用；不发起真实付款。')+'</p></div>';}
 const mod={...old,id:'my-console-v11',pages:['P-MC-01',...kinds.map((_,i)=>'P-MC-0'+(i+2))],dict,
   content(id){if(id==='P-MC-01')return listing();const i=kinds.findIndex((_,i)=>id==='P-MC-0'+(i+2));return detail(kinds[i]);},
   breadcrumbRoute(id){return id==='P-MC-01'?listRoute(path().split('/')[2]||tabs()[0]).slice(1):old.breadcrumbRoute?.(id);},
   beforeRender(){old.beforeRender?.();if(lastRole!==S.role){S.layer=null;lastRole=S.role;detailState='normal';if(!allowed())copyValue='';}},
   afterRender(){old.afterRender?.();const current=location.hash;if(current!==lastHash){lastHash=current;if(path().startsWith('/console')){const q=params();restoring=true;setTimeout(()=>{window.scrollTo(0,Math.max(0,+q.get('y')||0));const box=document.getElementById('mc-list');if(box)box.scrollTop=Math.max(0,+q.get('scroll')||0);const id=q.get('focus');if(id)document.querySelector('[data-id="'+CSS.escape(id)+'"]')?.focus({preventScroll:true});else document.querySelector('.mc-root .page-title')?.focus({preventScroll:true});restoring=false;},0);}}
     if(focusAfter){const key=focusAfter;focusAfter='';setTimeout(()=>document.getElementById('mc-'+key)?.focus({preventScroll:true}),0);}
   },
   demo(){return (old.demo?.()||'')+reviewTools();},
   onAct(a,v,e){if(!a.startsWith('mc-'))return old.onAct?.(a,v,e)||false;
     const key=a.slice(3);
     if(key==='detail'){const [k,id]=v.split('|');goDetail(k,id);}
     if(key==='jump'){const [k,id,act]=v.split('|');jump(k,id,act);}
     if(key==='tab'){returnNotice=false;setView({tab:v,filter:'',secondary:'',project:'',sort:v==='credits'?'available-asc':v==='repayments'?'sequence':'newest',page:1});}
     if(key==='clear'){S.st='default';returnNotice=false;setView({filter:'',secondary:'',project:'',page:1});}
     if(key==='page')setView({page:Math.max(1,+v)});
     if(['retry','refresh','detail-retry'].includes(key)){S.st='default';detailState='normal';CF.L8?.ensure();CF.render();}
     if(key==='stats-retry'){statsError=false;CF.render();}
     if(key==='list'||key==='return'){returnNotice=key==='return';navigate(safeRoute(v)||'#/console');}
     if(key==='section'){document.getElementById(v)?.scrollIntoView({block:'start'});}
     if(key==='copy'){copyValue=v;const fallback=()=>CF.openLayer('modal','mc-copy');try{navigator.clipboard?.writeText(v).then(()=>CF.toast(L('Copied','已复制')),fallback)||fallback();}catch(_){fallback();}}
     if(key==='scenario'){statsError=v==='stats';detailState=['loading','error','stale'].includes(v)?v:'normal';if(v==='session'){S.role='guest';S.layer=null;S.demo=false;}CF.render();}
     return true;
   },
   layers:{...old.layers,'mc-copy':()=>({title:L('Copy reference','复制编号'),html:'<input class="inp mc-copy-value" readonly value="'+E(copyValue)+'" aria-label="'+L('Reference number','完整编号')+'"><p>'+L('Select the text and copy it.','请选择文本后复制。')+'</p>',foot:'<button class="btn" data-act="closelayer">'+L('Close','关闭')+'</button>'})}
 };
 CF.define(CF.LSView=mod);
 const composed=mod.content;mod.content=id=>(id==='P-LS-01'||id==='P-LS-02'?backBanner():'')+composed(id);
 document.addEventListener('change',e=>{if(path()!=='/console'||!e.target.id.startsWith('mc-'))return;const k=e.target.id.slice(3);if(['filter','secondary','project','sort','size'].includes(k))setView({[k]:k==='size'?+e.target.value:e.target.value,page:1});});
 document.addEventListener('click',e=>{
   if(e.target.closest('a[data-act=mc-detail]')&&(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)){e.stopImmediatePropagation();return;}
   const nav=e.target.closest('#nav a,.brand');if(nav&&['#/assets','#/marketplace','#/console','#/'].includes(nav.getAttribute('href'))){e.preventDefault();e.stopImmediatePropagation();navigate(nav.getAttribute('href')==='#/'?'#/assets':nav.getAttribute('href'));return;}
   const row=e.target.closest('.mc-table tr[data-id]');if(row&&!e.target.closest('button,a,input,select'))goDetail(row.dataset.kind,row.dataset.id);
 },true);
 document.addEventListener('keydown',e=>{if(e.target.matches('.mc-table tr[data-id]')&&['Enter',' '].includes(e.key)){e.preventDefault();goDetail(e.target.dataset.kind,e.target.dataset.id);}
   if(e.target.matches('.mc-tabs [role=tab]')&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const ts=[...document.querySelectorAll('.mc-tabs button')],i=ts.indexOf(e.target),n=e.key==='Home'?0:e.key==='End'?ts.length-1:(i+(e.key==='ArrowRight'?1:ts.length-1))%ts.length;ts[n].click();setTimeout(()=>document.querySelector('.mc-tabs [aria-selected=true]')?.focus(),0);}
 });
 window.addEventListener('hashchange',()=>{if(!restoring&&path().startsWith('/console'))detailState='normal';});
 CF.MC={normalized,find,shortcuts,safeRoute,get state(){return detailState;},attach(){const previous=mod.demo;mod.demo=()=>previous()+reviewTools();CF.MCSeedPeriods?.();CF.render();}};
})(window.CF);
