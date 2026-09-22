/* WS-355 V1.3. Enterprise token snapshot and read-only project navigation. */
(function(CF){
 'use strict';
 const S=CF.S,D=CF.LS,Q=CF.CQ,L=CF.L,E=CF.esc,old=CF.LSView,H=3600000,DAY=24*H;
 const kinds=['tokens','projects','credits','loans','repayments','quotes'];
 const names={tokens:['Tokens','代币列表'],projects:['Financing projects','融资项目'],credits:['Credit facilities','授信明细'],loans:['Disbursements','融资放款信息'],repayments:['Repayments','还款信息'],quotes:['My quotes','我的报价']};
 const titles={tokens:['Token details','代币详情'],projects:['Project details','融资项目详情'],credits:['Credit details','授信详情'],loans:['Disbursement details','融资放款详情'],repayments:['Repayment details','还款业务详情'],quotes:['Quote details','报价详情']};
 const labels={valid:['Valid','有效'],void:['Void','失效'],pledged:['Pledged','已质押'],unpledged:['Not pledged','未质押'],draft:['Draft','草稿'],raising:['Fundraising','募集中'],locked:['Locked','已锁定'],financing:['Financing','融资中'],closed:['Closed','已关闭'],settled:['Settled','已结清'],surplus:['Coverage surplus','覆盖有余'],balanced:['Coverage balanced','覆盖持平'],short:['Coverage shortfall','覆盖不足'],effective:['Effective','生效中'],expired:['Expired','已到期'],pending:['Pending disbursement','待放款'],confirming:['Awaiting receipt','待放款确认'],repaying:['Repaying','还款中'],terminated:['Terminated','已终止'],waiting:['Awaiting acceptance','待接受'],rejected:['Rejected','已拒绝'],quoteExpired:['Quote expired','报价已失效'],due:['Pending repayment','待还款'],repayConfirming:['Awaiting repayment confirmation','待还款确认'],initial:['Initial plan','初始版'],final:['Final plan','定稿版'],generating:['Plan generating','计划生成中'],open:['Awaiting quotes','待报价'],quoted:['Awaiting quote confirmation','已报价待确认'],funding:['Funding','放款中'],funded:['Disbursed','已放款'],ended:['Invalidated / closed','已失效／已关闭']};
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
 const copy=v=>v==null||v===''?'—':'<span class="mono">'+E(v)+'</span> '+link('copy',L('Copy','复制'),v);
 const tabs=()=>S.role==='fund'?['quotes','credits','loans','repayments']:['tokens','projects','credits','loans','repayments'];
 const allowed=()=>['asset','fund'].includes(S.role);
 const path=()=>location.hash.slice(1).split('?')[0];
 const params=()=>new URLSearchParams(location.hash.split('?')[1]||'');
 const now=()=>CF.L8?.now||CF.L7?.now()||D.now();
 const party=q=>Q.related(q);
 const fund=id=>id==='fund-b'?L('Demo Capital B','演示资金机构 B'):L('Demo Capital A','演示资金机构 A');
 const owner=id=>id==='entity-demo-a'?L('Demo Asset Company A','演示资产企业 A'):L('Demo Asset Company B','演示资产企业 B');
 const counter=q=>S.role==='asset'?fund(q.fund):owner(q.owner);
 let detailState='normal',planError=false,statsError=false,tokenError=false,associationError=false,focusAfter='',lastHash='',lastRole=S.role,restoring=false,copyValue='',returnNotice=false;
 CF.PAGES['P-MC-01'].retainList=true;
 const dict={en:{},zh:{}};
 kinds.forEach((k,i)=>{const id='P-MC-0'+(i+2),key='mcDetail'+i;CF.PAGES[id]={end:'asset',layout:'portal',parent:'P-MC-01',crumbKey:key,auth:true,retainList:true};CF.ENTRY[id]='/console/'+k;dict.en[key]=titles[k][0];dict.zh[key]=titles[k][1];});
 function safeRoute(raw,detail=true){
   if(!raw||raw.length>12000||!/^#\/console(?:\?|$|\/(tokens|projects|credits|loans|repayments|quotes)\?)/.test(raw))return '';
   const p=raw.slice(1).split('?')[0];if(p!=='/console'&&(!detail||!kinds.some(k=>p==='/console/'+k)))return '';
   const q=new URLSearchParams(raw.split('?')[1]||'');if(p!=='/console'&&!q.get('id'))return '';
   const clean=new URLSearchParams();['tab','filter','secondary','project','sort','size','page','y','scroll','focus','id','period','application','query','periodState','confirmLate','targetProject'].forEach(k=>{if(q.has(k))clean.set(k,q.get(k).slice(0,160));});
   if(detail&&q.has('list')){const list=safeRoute(q.get('list'),false);if(list)clean.set('list',list);}
   return '#'+p+(clean.size?'?'+clean:'');
 }
 function view(){const q=params(),tab=tabs().includes(q.get('tab'))?q.get('tab'):tabs()[0];return {tab,filter:q.get('filter')||'',secondary:q.get('secondary')||'',project:q.get('project')||'',query:q.get('query')||'',periodState:q.get('periodState')||'',confirmLate:q.get('confirmLate')||'',sort:q.get('sort')||(tab==='credits'?'available-asc':'newest'),size:[20,50,100].includes(+q.get('size'))?+q.get('size'):20,page:Math.min(100000,Math.max(1,parseInt(q.get('page'))||1))};}
 function listRoute(k){return safeRoute(params().get('list'),false)||'#/console?tab='+k;}
 function detailHref(k,id){return '#/console/'+k+'?'+new URLSearchParams({id,list:path()==='/console'?location.hash:listRoute(k)});}
 function snapshot(){
   const q=params();q.set('y',Math.round(window.scrollY));q.set('scroll',Math.round(document.getElementById('mc-list')?.scrollTop||0));
   const f=document.activeElement?.closest('[data-id]')?.dataset.id;if(f)q.set('focus',f);
   const hash='#'+path()+'?'+q;try{history.replaceState(null,'',hash);}catch(_){}return hash;
 }
 function navigate(hash){S.layer=null;S.st='default';detailState='normal';location.hash=hash;}
 function goDetail(k,id){let list=path()==='/console'?snapshot():listRoute(k);if(path()==='/console'){const q=new URLSearchParams(list.split('?')[1]||'');q.set('focus',id);list='#/console?'+q;}navigate('#/console/'+k+'?'+new URLSearchParams({id,list}));}
 function setView(patch){const v={...view(),...patch};focusAfter=Object.keys(patch)[0];navigate('#/console?'+new URLSearchParams(v));}
 function normalized(k){
   if(!allowed())return [];
   if(CF.L7)void CF.L7.deals;
   const related=Q.data().quotes.filter(party),ownProjects=D.projects.filter(p=>p.owner==='entity-demo-a');
   if(k==='tokens')return tokenSnapshot();
   if(k==='projects')return S.role==='asset'?ownProjects.map(p=>({...p,project:p.id,status:p.state,n:D.numbers(p),amount:D.current(p)?.amount||0,at:p.created||p.published})):[];
   if(k==='credits')return Q.data().credits.filter(c=>S.role==='asset'?c.owner==='entity-demo-a':party(c)).map(c=>{const transit=Q.data().quotes.filter(q=>q.owner===c.owner&&q.fund===c.fund&&['waiting','funding'].includes(q.state)).reduce((n,q)=>n+q.amount,0),expired=Date.parse(c.expires+'T23:59:59Z')<now();return {...c,status:expired?'expired':'effective',transit,available:expired?0:Math.max(0,c.total-c.principal-transit),used:c.principal+transit,at:c.first};});
   if(k==='repayments')return related.filter(q=>q.l7?.record&&['confirmed','settled'].includes(q.l7.state)).map(q=>{
     const deal=q.l7,plan=q.l8,periods=(plan?.periods||[]).map(p=>({...p,status:p.state==='pending'?'repayConfirming':p.state==='settled'?'settled':'due',overdue:p.record?p.record.overdue:Math.max(0,Math.floor((Date.parse(new Date(now()).toISOString().slice(0,10))-Date.parse(p.due))/DAY)),deadline:p.state==='pending'&&p.record?Date.parse(p.record.at)+168*H:null}));
     const current=periods.filter(p=>p.state==='due').sort((a,b)=>a.due.localeCompare(b.due)||a.seq-b.seq)[0]||null,pending=periods.filter(p=>p.state==='pending');
     return {id:q.id,business:q.id,project:q.project,request:q.demand,q,deal,plan,periods,current,pending,status:plan?.settledAt?'settled':'repaying',planState:plan?'final':'generating',due:current?.due,at:deal.confirmedAt,overdue:periods.some(p=>p.state==='due'&&p.overdue>0),confirmLate:pending.some(p=>p.deadline<=now()),amount:q.amount};
   });
   return related.filter(q=>k==='quotes'||q.l7).map(q=>{const x=q.l7;return {...q,q,deal:x,status:x?({pending:'pending',waiting:'confirming',confirmed:q.l8?.settledAt?'settled':'repaying',settled:'settled',terminated:'terminated'}[x.state]):({waiting:'waiting',rejected:'rejected',expired:'quoteExpired',terminated:'terminated'}[q.state]||q.state),request:q.demand,acceptedAt:q.done||null,at:k==='loans'?q.done:q.at,deadline:x?.state==='waiting'?Date.parse(x.record.at)+168*H:q.state==='waiting'?q.end:null};});
 }
 function matches(r,v){
   const repayment=v.tab==='repayments';
   return (!v.filter||(v.filter==='generating'?r.planState==='generating':r.status===v.filter))&&
     (!v.project||r.project===v.project)&&
     (!v.query||[r.id,r.request,r.deal?.record?.id].includes(v.query.trim()))&&
     (!v.periodState||repayment&&r.periods.some(p=>p.status===v.periodState))&&
     (!v.confirmLate||repayment&&(r.confirmLate?'yes':'no')===v.confirmLate)&&
     (!v.secondary||(v.tab==='tokens'?(r.pledged?'pledged':'unpledged'):v.tab==='projects'?r.n.grade:repayment?(r.overdue?'yes':'no'):(r.status==='confirming'&&r.deadline<=now()?'yes':'no'))===v.secondary);
 }
 function filtered(){const v=view();let rows=S.st==='empty'?[]:normalized(v.tab);rows=rows.filter(r=>matches(r,v));
   if(S.st==='noresult')return [];
   const value=r=>v.sort.startsWith('value')?r.value:v.sort.startsWith('available')?r.available:v.sort.startsWith('due')?(r.due?Date.parse(r.due):Infinity):v.sort==='remaining'?r.deadline??Infinity:Date.parse(r.at)||Number(r.at)||0;
   rows.sort((a,b)=>{const x=value(a),y=value(b);return (x===y?0:(x-y)*(v.sort==='newest'||v.sort.endsWith('desc')?-1:1))||a.id.localeCompare(b.id);});return rows;
 }
 function find(k,id){return normalized(k).find(r=>r.id===id||(k==='repayments'&&r.periods.some(p=>p.id===id)));}
 function selectedPeriod(r){const id=params().get('period')||(params().get('id')!==r.id?params().get('id'):'');return id?r.periods.find(p=>p.id===id):null;}
 function countdown(r,quote=false){if(!r.deadline)return '—';const left=r.deadline-now();if(left<=0)return '<strong class="mc-warning">'+L(quote?'Quote expired':'Confirmation overdue',quote?'报价已过期':'确认已超期')+'</strong>';return Math.ceil(left/H)+L(' hours left',' 小时内到期');}
 function destinations(k,r){
   if(associationError)return {projects:[],reason:L('Project associations unavailable. Reload this URL in your browser.','关联项目暂不可用，请使用浏览器刷新当前网址。')};
   const ids=[...new Set(k==='credits'?Q.data().quotes.filter(q=>q.owner===r.owner&&q.fund===r.fund&&party(q)).map(q=>q.project):[k==='projects'?r.id:r.project].filter(Boolean))];
   const projects=ids.map(id=>D.project(id)).filter(p=>p&&(p.state!=='draft'||D.mine(p)||Q.hasHistory(p)));
   return {projects,reason:!ids.length?L('No associated financing project','暂无关联融资项目'):!projects.length?L('No accessible associated project','暂无可访问关联项目'):''};
 }
 function destination(k,r){const d=destinations(k,r);return d.projects.length===1?d.projects[0]:d.projects.find(p=>p.id===params().get('targetProject'));}
 function jump(k,id){
   const r=find(k,id),p=r&&destination(k,r);if(!p){CF.toast(L('Select an accessible associated project.','请选择可访问的关联项目。'));CF.render();return;}
   navigate('#/project/'+encodeURIComponent(p.id)+'?'+new URLSearchParams({mcReturn:snapshot()}));
 }
 function controls(k,r){const d=destinations(k,r),target=destination(k,r);
   return (d.projects.length>1?select('targetProject',L('Associated financing project','关联融资项目'),[['',L('Select a project','请选择项目')],...d.projects.map(p=>[p.id,text(p.name)+' · '+p.id])],target?.id||''):'')+
     b('jump',L('Go to lending marketplace','前往借贷广场'),k+'|'+r.id,true,!target)+(d.reason?'<p class="mc-small" role="status">'+E(d.reason)+'</p>':'');
 }
 const reloadHint=()=>L('Reload this URL in your browser to try again.','请使用浏览器刷新当前网址重试。');
 function tokenSnapshot(){
   if(S.role!=='asset')return [];
   const seen=new Set();
   return (Array.isArray(D.tokens)?D.tokens:[]).filter(t=>{
     if(t.owner!=='entity-demo-a'||!t.id||seen.has(t.id)||typeof t.valid!=='boolean'||!Number.isFinite(t.units)||!Number.isFinite(t.value)||!/^0x[0-9a-f]{64}$/i.test(t.tx||'')||!t.issued||!Number.isFinite(Date.parse(t.issued)))return false;
     seen.add(t.id);return true;
   }).map(t=>({...t,status:t.valid?'valid':'void',pledged:t.pledge==='pledged',project:t.pool||null,amount:t.value,at:t.issued}));
 }
 function stat(title,value,note=''){return '<div class="stat"><div class="k">'+E(title)+'</div><div class="v">'+value+'</div>'+(note?'<div class="n">'+note+'</div>':'')+'</div>';}
 function summary(){
   if(S.st==='loading')return CF.skelTable(2);
   const empty=S.st==='empty',tokens=empty?[]:normalized('tokens'),credits=empty?[]:normalized('credits'),sum=(rs,k)=>rs.reduce((n,r)=>n+(+r[k]||0),0),pledged=tokens.filter(r=>r.pledged),voids=pledged.filter(r=>!r.valid);
   let html=S.role==='asset'?'<section class="card mc-assets"><div>'+L('All tokens','全部代币')+'<b>'+tokens.length+L(' tokens',' 张')+'</b><span class="mono">'+money(sum(tokens,'value'))+'</span></div><div>'+L('Of which pledged','其中已质押')+'<b>'+pledged.length+L(' tokens',' 张')+'</b><span class="mono">'+money(sum(pledged,'value'))+'</span>'+small(L('Of which void: ','其中已失效：')+voids.length+L(' tokens',' 张')+' · '+money(sum(voids,'value'))+' · '+L('Excluded from coverage','不计入覆盖'))+'</div></section>':'';
   if(S.role==='asset'&&(tokenError||!Array.isArray(D.tokens)))html='<section class="card mc-assets">'+CF.empty(L('Token summary unavailable','代币统计暂不可用'),reloadHint(),'')+'</section>';
   return html+'<div class="stat-row mc-summary">'+(statsError?stat(L('Total credit','总授信额度'),'—',E(reloadHint())):stat(L('Total credit','总授信额度'),money(sum(credits,'total'))))+stat(L('Financed balance','已融额度'),money(sum(credits,'principal')))+stat(L('Available credit','剩余可用授信'),money(sum(credits,'available')),'<span>'+L('Subject to assessment when publishing a request.','实际可融金额以发布需求时核定结果为准。')+'</span>')+'</div>';
 }
 const filterOptions={tokens:['valid','void'],projects:['draft','raising','locked','financing','closed','settled'],credits:['effective','expired'],loans:['pending','confirming','repaying','settled','terminated'],repayments:['repaying','settled','generating'],quotes:['waiting','rejected','quoteExpired','pending','confirming','repaying','settled','terminated']};
 function select(key,title,options,value){return '<div class="field"><label for="mc-'+key+'">'+E(title)+'</label><select class="inp" id="mc-'+key+'">'+options.map(([v,t])=>'<option value="'+E(v)+'"'+(v===value?' selected':'')+'>'+E(t)+'</option>').join('')+'</select></div>';}
 function filters(){const v=view(),all=['',L('All','全部')];let h=select('filter',v.tab==='tokens'?L('Token status','代币状态'):v.tab==='projects'?L('Project status','项目状态'):L('Status','状态'),[all,...filterOptions[v.tab].map(k=>[k,status(k)])],v.filter);
   const sec=v.tab==='tokens'?['pledged','unpledged']:v.tab==='projects'?['surplus','balanced','short']:['loans','repayments'].includes(v.tab)?['yes','no']:[];
   if(sec.length)h+=select('secondary',v.tab==='tokens'?L('Pledge status','质押状态'):v.tab==='projects'?L('Coverage','质押覆盖状态'):v.tab==='loans'?L('Confirmation overdue','确认是否超期'):L('Repayment overdue','还款是否逾期'),[all,...sec.map(k=>[k,k==='yes'?L('Yes','是'):k==='no'?L('No','否'):status(k)])],v.secondary);
   if(v.tab==='tokens')h+=select('project',L('Project','所属融资项目'),[all,...normalized('projects').map(p=>[p.id,text(p.name)])],v.project);
   const sorts=v.tab==='tokens'?[['newest',L('Issued · newest first','签发时间倒序')],['value-asc',L('Value · ascending','价值升序')],['value-desc',L('Value · descending','价值降序')],['due-asc',L('Due · earliest','到期日升序')]]:v.tab==='credits'?[['available-asc',L('Available credit · ascending','可用授信升序')],['available-desc',L('Available credit · descending','可用授信降序')]]:v.tab==='repayments'?[['newest',L('Receipt confirmed · newest first','到账确认时间倒序')],['due-asc',L('Current due date · earliest','本期应还日升序')]]:[['newest',L('Newest first','时间倒序')],['oldest',L('Oldest first','时间升序')],['remaining',L('Time remaining · shortest','剩余时限升序')]];
   if(v.tab==='repayments')h+=select('periodState',L('Contains instalments','包含期次状态'),[all,...['due','repayConfirming','settled'].map(k=>[k,status(k)])],v.periodState)+select('confirmLate',L('Confirmation overdue','含确认超期期次'),[all,['yes',L('Yes','是')],['no',L('No','否')]],v.confirmLate);
   if(['loans','repayments'].includes(v.tab))h+='<div class="field mc-search"><label for="mc-query">'+L('Exact reference number','完整编号检索')+'</label><input class="inp" id="mc-query" value="'+E(v.query)+'" placeholder="'+L('Application / business / disbursement','融资申请 / 业务 / 放款编号')+'"></div>';
   return '<div class="filters">'+h+select('sort',L('Sort','排序'),sorts,v.sort)+'<div class="acts">'+(['loans','repayments'].includes(v.tab)?b('search',L('Search','查询')):'')+b('clear',L('Reset filters','清空筛选'))+'</div></div>'+(Object.keys(v).some(k=>['filter','secondary','project','query','periodState','confirmLate'].includes(k)&&v[k])?'<div class="mc-filter-note" role="status">'+L('Filtered by: ','已按以下条件过滤：')+E([v.filter&&status(v.filter),v.secondary&&(v.secondary==='yes'?L('Overdue','逾期'):v.secondary==='no'?L('Not overdue','未逾期'):status(v.secondary)),v.periodState&&status(v.periodState),v.confirmLate&&L('Confirmation deadline','确认时限'),v.query,v.project].filter(Boolean).join(' · '))+'</div>':'');
 }
 function columns(k){return {
   tokens:[[L('Token','代币编号'),'id'],[L('Quantity','数量'),'num'],[L('Value (USD)','价值（USD）'),'num'],[L('Token status','代币状态'),''],[L('Pledge status','质押状态'),''],[L('Receivable due','应收账款到期日'),''],[L('Project','所属项目'),'']],
   projects:[[L('Project','融资项目'),'id'],[L('Status','项目状态'),''],[L('Requested (USD)','融资需求（USD）'),'num'],[L('Balance (USD)','已融资余额（USD）'),'num'],[L('Coverage','覆盖状态'),''],[L('Project deadline','项目截止日'),'']],
   credits:[[L('Facility / counterparty','授信编号／对方企业'),'id'],[L('Credit limit (USD)','授信额度（USD）'),'num'],[L('Used (USD)','已用授信（USD）'),'num'],[L('Available (USD)','可用授信（USD）'),'num'],[L('Status','额度状态'),''],[L('Valid until','有效期至'),'']],
   loans:[[L('Application / business','融资申请／业务'),'id'],[L('Counterparty','对方企业'),''],[L('Financing (USD)','融资金额（USD）'),'num'],[L('Disbursement amount','放款金额'),'num'],[L('Status / actor','业务状态／处理方'),''],[L('Accepted at','接受时间'),'']],
   quotes:[[L('Business / application','融资业务／融资申请编号'),'id'],[L('Project','所属项目'),''],[L('Asset holder','资产方'),''],[L('Amount (USD)','融资金额（USD）'),'num'],[L('Status','业务状态'),''],[L('Quote window','报价有效期'),'']],
   repayments:[[L('Application / funder','融资申请／出资机构'),'id'],[L('Current instalment','本期应还'),'num'],[L('Due date','应还日'),''],[L('Business / plan','业务／计划'),''],[L('Pending confirmations','待确认情况'),''],[L('Receipt confirmed','到账确认时间'),'']]
 }[k];}
 function rowValues(k,r){const object=t=>'<a class="mc-object" href="'+E(detailHref(k,r.id))+'" data-act="mc-detail" data-v="'+k+'|'+E(r.id)+'">'+E(t)+'</a>';
   if(k==='tokens')return [object(r.id),CF.fmtAmt(r.units),CF.fmtAmt(r.value),badge(r.status)+(!r.valid?small(L('Excluded from coverage','不计入覆盖')):''),badge(r.pledged?'pledged':'unpledged'),date(r.due),r.project?E(text(D.project(r.project)?.name)):'—'];
   if(k==='projects')return [object(text(r.name))+small(E(r.id)),badge(r.status),CF.fmtAmt(r.amount)+(D.current(r)?small(status(D.current(r).state)):small(L('No current application','暂无当前申请'))),CF.fmtAmt(r.balance),badge(r.n.grade)+(r.n.gap?'<span class="mc-indicator">'+L('Gap ','缺口 ')+money(r.n.gap)+'</span>':r.demands.some(d=>d.state==='quoted')?'<span class="mc-indicator">'+L('Quote awaiting review','有待确认报价')+'</span>':''),date(r.expires)];
   if(k==='credits')return [object(r.id)+small(E(counter(r))),CF.fmtAmt(r.total),CF.fmtAmt(r.used),CF.fmtAmt(r.available),badge(r.status),date(r.expires)];
   if(k==='repayments')return [object(r.request)+small(E(fund(r.q.fund))),r.current?'<strong>'+money(r.current.settlement,r.q.ccy)+'</strong>'+small(L('Instalment ','第 ')+r.current.seq+L('',' 期')):r.plan?L('No instalments awaiting repayment','暂无待还期次'):'—',r.current?date(r.current.due)+(r.current.overdue?small(L('Overdue ','逾期 ')+r.current.overdue+L(' days',' 天')):now()<r.current.open?small(L('Opens ','开启于 ')+date(r.current.open)):''):'—',badge(r.status)+small(status(r.planState)),r.pending.length?'<span class="mc-warning">'+L('Awaiting confirmation','待还款确认')+'</span>'+small(r.pending.map(p=>L('Instalment ','第 ')+p.seq+L('',' 期')+(p.deadline<=now()?L(' · overdue',' · 确认超期'):'')).join(' / ')):L('No pending confirmations','暂无待确认'),time(r.at)];
   const state=badge(r.status)+(r.deal?.redo?'<span class="mc-indicator">'+L('Contract re-upload requested','待重传盖章件')+'</span>':'')+(r.deal?.hold?'<span class="mc-indicator">'+L('Disbursement deferred','已暂缓放款')+'</span>':'');
   if(k==='quotes')return [object(r.id)+small(E(r.request)),E(text(D.project(r.project)?.name)),E(owner(r.owner)),CF.fmtAmt(r.amount),state,r.status==='waiting'?countdown(r,true):'—'];
   return [object(r.request)+small(E(r.id)),E(counter(r)),CF.fmtAmt(r.amount),money(r.settlement,r.ccy)+small(r.deal?.record?L('Submitted','已登记'):L('Agreed amount','约定金额')),state+small(r.status==='pending'?r.deal?.redo?L('Asset holder · re-upload','资产方 · 重传'):L('Funder','资金方'):r.status==='confirming'?L('Asset holder','资产方'):L('No current action','无当前办理'))+(r.status==='confirming'?small(countdown(r)):''),time(r.acceptedAt)];
 }
 function table(){const v=view(),all=filtered(),count=Math.max(1,Math.ceil(all.length/v.size));if(v.page>count&&S.st!=='error'&&S.st!=='loading'&&!tokenError){v.page=count;const q=params();q.set('page',count);history.replaceState(null,'','#'+path()+'?'+q);}const rs=all.slice((v.page-1)*v.size,v.page*v.size),cols=columns(v.tab);
   if(S.st==='error'||v.tab==='tokens'&&(tokenError||!Array.isArray(D.tokens)))return CF.empty(L('List could not be loaded','列表加载失败'),L('Your filters have been preserved. ','已保留当前筛选条件。')+reloadHint(),'');
   if(!all.length&&S.st!=='loading'&&S.st!=='noresult'&&!['filter','secondary','project','query','periodState','confirmLate'].some(k=>v[k]))return CF.empty(v.tab==='tokens'?L('No displayable tokens for this company','本企业暂无可展示的代币'):v.tab==='projects'?L('No financing projects yet','尚未创建融资项目'):L('No records yet','暂无记录'),'','');
   let body=S.st==='loading'?'<div role="status" aria-label="'+L('Loading','加载中')+'">'+CF.skelTable(5)+'</div>':(S.st==='error'||v.tab==='tokens'&&(tokenError||!Array.isArray(D.tokens)))?CF.empty(L('List could not be loaded','列表加载失败'),L('Your filters have been preserved. ','已保留当前筛选条件。')+reloadHint(),''):!rs.length?CF.empty(L(S.st==='empty'?'No records yet':'No matching records',S.st==='empty'?'暂无记录':'暂无符合条件的记录'),returnNotice?L('The latest record no longer matches these filters.','最新记录已不符合当前筛选条件。'):L('Try another filter or return later.','可调整筛选条件或稍后再查看。'),b('clear',L('Clear filters','清空筛选'))):'<div class="listbox" id="mc-list" tabindex="0" aria-label="'+E(nm(v.tab))+'"><table class="tbl mc-table"><thead><tr>'+[...cols,[L('Actions','操作'),'']].map(([t])=>'<th scope="col">'+E(t)+'</th>').join('')+'</tr></thead><tbody>'+rs.map(r=>'<tr data-id="'+E(r.id)+'" data-kind="'+v.tab+'" tabindex="0" aria-label="'+E(text(titles[v.tab])+' '+r.id)+'">'+rowValues(v.tab,r).map((c,i)=>'<td data-label="'+E(cols[i][0])+'" class="'+cols[i][1]+'"><div>'+c+'</div></td>').join('')+'<td data-label="'+L('Actions','操作')+'" class="mc-actions"><div>'+link('detail',L('View details','查看详情'),v.tab+'|'+r.id)+'</div></td></tr>').join('')+'</tbody></table></div>';
   const moved=returnNotice&&params().get('focus')&&!all.some(r=>r.id===params().get('focus'));
   return (moved?CF.note('',L('The updated record no longer matches these filters.','记录已更新，不再符合当前筛选条件。')+' '+b('clear',L('Clear filters','清空筛选'))):'')+'<div class="mc-caption"><span>'+E(nm(v.tab))+' · '+all.length+L(' records',' 条')+'</span><span>'+L('All amounts are in USD unless marked otherwise.','金额单位为 USD，其他币种另行标注。')+'</span></div>'+body+'<div class="pager"><span class="total">'+all.length+L(' records',' 条记录')+'</span><label for="mc-size">'+L('Rows per page','每页')+'</label><select class="inp" id="mc-size">'+[20,50,100].map(n=>'<option'+(n===v.size?' selected':'')+'>'+n+'</option>').join('')+'</select>'+b('page',L('Previous','上一页'),v.page-1,false,v.page<=1)+'<span>'+v.page+' / '+count+'</span>'+b('page',L('Next','下一页'),v.page+1,false,v.page>=count)+'</div>';
 }
 function gate(){return '<div class="mc-error">'+CF.empty(L(S.role==='limited'?'Complete account setup':'Sign in to view your console',S.role==='limited'?'请先完成账户必办事项':'登录后查看我的控制台'),L('Your company information is available after sign-in.','登录后可查看本企业数据。'),'<button class="btn primary" data-act="signin">'+L('Sign in','登录')+'</button>')+'</div>';}
 function listing(){if(!allowed())return gate();if(S.st==='denied')return unavailable();const v=view();return '<div class="mc-root"><div class="page-head"><div><h1 class="page-title">'+L('My console','我的控制台')+'</h1><p class="page-desc">'+L('Balances, financing activity and repayment progress.','查看资金概览、融资进展与还款情况。')+'</p></div><div class="page-actions">'+'</div></div>'+summary()+'<section class="card mc-ledger"><div class="mc-tabs" role="tablist" aria-label="'+L('Console records','控制台信息')+'">'+tabs().map(k=>'<button role="tab" aria-selected="'+(k===v.tab)+'" tabindex="'+(k===v.tab?0:-1)+'" data-act="mc-tab" data-v="'+k+'">'+E(nm(k))+'</button>').join('')+'</div><div role="tabpanel" aria-label="'+E(nm(v.tab))+'">'+filters()+table()+'</div></section></div>';}
 function unavailable(){return '<div class="mc-root mc-error">'+CF.empty(L('Content unavailable','内容不存在或无权访问'),L('Return to your console to view available records.','请返回控制台查看可访问的记录。'),b('list',L('Back to console','返回我的控制台'),'#/console'))+'</div>';}
 function section(id,title,body){return {id,title,html:'<section class="card detail-section" id="'+id+'" tabindex="-1"><div class="card-head"><h2>'+E(title)+'</h2></div><div class="card-body">'+body+'</div></section>'};}
 function refs(r){return dl([[L('Business ID','融资业务编号'),copy(r.business||r.id)],[L('Application ID','融资申请编号'),copy(r.request||r.demand)],[L('Project','所属融资项目'),E(text(D.project(r.project)?.name))+'<br>'+copy(r.project)],[L('Asset holder','资产方'),E(owner(r.owner||r.q.owner))],[L('Funder','资金方'),E(fund(r.fund||r.q.fund))]]);}
 function terms(q){return dl([[L('Financing amount','融资金额'),money(q.amount)],[L('Agreed disbursement amount','约定放款金额'),money(q.settlement,q.ccy)],[L('Annual interest rate','年化利率'),E(q.rate)+'%'],[L('Repayment deadline','还款截止日'),date(q.repay)],[L('Exchange rate','汇率'),'1 '+E(q.ccy)+' = '+E(q.fx.value)+' USD'],[L('Rate source','汇率来源'),E(text(q.fx.source))],[L('Rate snapshot','汇率快照时间'),time(q.fx.at)],[L('Snapshot version','汇率版本'),E(q.fx.version)]]);}
 function account(f,ccy){
   if(!f)return '<p class="mc-small">'+L('Awaiting submission by the funder','待资金方提交')+'</p>';
   if(ccy!=='USD')return dl([[L('Repayment address','还款收款地址'),f.repayWallet?E(f.repayWallet.slice(0,6)+'…'+f.repayWallet.slice(-4)):'—'],[L('Network','链'),'ETH · ERC-20']]);
   return dl([['repayName',L('Account name','户名')],['repayNumber',L('Account number','账号')],['repaySwift','SWIFT / BIC'],['repayBank',L('Bank','开户行')],['repayIntermediary',L('Intermediary bank','中转行')]].map(([k,t])=>[t,k==='repayNumber'&&f[k]?L('Hidden · verify in marketplace','已隐藏 · 请到广场核对'):E(f[k]||'—')]));
 }
 function assetAccount(r){const a=r.deal?.account||r.q?.progress?.account||r.progress?.account;
   if(r.ccy!=='USD')return dl([[L('Disbursement receiving address','放款收款地址'),a?.wallet?E(a.wallet.slice(0,6)+'…'+a.wallet.slice(-4)):'—'],[L('Network','链'),'ETH · ERC-20']]);
   return dl([['name',L('Account name','户名')],['iban',L('Account number','账号')],['bank',L('Bank','开户行')],['swift','SWIFT / BIC'],['country',L('Country / region','国家／地区')]].map(([k,t])=>[t,k==='iban'&&a?.[k]?L('Hidden · verify in marketplace','已隐藏 · 请到广场核对'):E(a?.[k]||'—')]));
 }
 function evidence(record,ccy){if(!record)return '';const f=record.form||record,files=f.files||[];
   return dl([[L('Supporting files','凭证／补充材料'),files.length?files.length+L(' files · view in marketplace',' 份 · 到广场查看'):L('No files provided','未提供文件')],ccy!=='USD'&&[L('Transaction hash','交易哈希'),f.hash?'<span class="mono">'+E(f.hash.slice(0,10)+'…'+f.hash.slice(-8))+'</span> '+link('copy',L('Copy full hash','复制完整哈希'),f.hash):'—'],ccy!=='USD'&&[L('Network','链'),'ETH · ERC-20']]);
 }
 function periodFacts(r,p){return dl([[L('Instalment ID','期次编号'),copy(p.id)],[L('Principal due','应还本金'),money(p.principal)],[L('Interest due','应还利息'),money(p.interest)],[L('Total due','应还合计'),money(p.total)],[L('Settlement amount','结算金额'),money(p.settlement,r.q.ccy)],[L('Accrual period','计息区间'),date(p.from)+' → '+date(p.due)],[L('Accrual days','计息天数'),p.days],[L('Payment window opens','还款入口开启时间'),time(p.open)],[L('Overdue days','逾期天数'),p.overdue+(p.record?L(' · frozen at submission',' · 提交后冻结'):'')],p.record&&[L('Record ID','还款记录编号'),copy(p.record.id)],p.record&&[L('Repaid at','还款时间'),time(p.record.paidAt)],p.record&&[L('Submitted at','提交时间'),time(p.record.at)],p.deadline&&[L('Confirmation deadline','还款确认截止'),time(p.deadline)],p.deadline&&[L('Time remaining','确认剩余时限'),countdown(p)],p.record&&[L('Confirmed at','还款确认时间'),time(p.record.confirmedAt)],p.record&&[L('Repayment nature','还款性质'),p.record.overdue?L('Overdue repayment','逾期还款'):L('Normal repayment','正常还款')],p.record&&[L('Note','备注'),E(p.record.note||'—')]])+evidence(p.record,r.q.ccy);}
 function repaymentSections(r){
   const out=[],add=(id,title,body)=>out.push(section(id,title,body)),selected=selectedPeriod(r),source=new URLSearchParams((params().get('list')||'').split('?')[1]||''),match=source.get('periodState');
   add('mc-basic',L('Business overview','业务概况'),refs(r)+dl([[L('Disbursement ID','放款编号'),copy(r.deal.record.id)],[L('Receipt confirmed','到账确认时间'),time(r.at)],[L('Business status','业务状态'),badge(r.status)],[L('Plan','计划情况'),badge(r.planState)],[L('Outstanding principal','未偿本金'),money(r.deal.principalBalance)],[L('Principal repaid','累计已还本金'),r.plan?money(r.periods.filter(p=>p.state==='settled').reduce((n,p)=>n+p.principal,0)):'—'],[L('Interest repaid','累计已还利息'),r.plan?money(r.periods.filter(p=>p.state==='settled').reduce((n,p)=>n+p.interest,0)):'—'],r.plan?.settledAt&&[L('Settled at','结清时间'),time(r.plan.settledAt)]]));
   if(planError){add('mc-plan',L('Repayment schedule','还款计划'),CF.empty(L('Repayment schedule unavailable','还款计划暂不可用'),L('Receipt confirmation is preserved. ','到账确认结果已保留。')+reloadHint(),''));}
   else if(!r.plan){add('mc-plan',L('Repayment schedule','还款计划'),CF.note('',L('Receipt is confirmed. The repayment schedule is being generated.','已确认到账，还款计划生成中。')));}
   else{
     add('mc-current',L('Current instalment','本期应还'),r.plan.settledAt?CF.note('ok',L('All instalments are settled.','本笔全部期次已结清。')):r.current?'<div class="mc-current-amount"><div><span>'+L('Instalment ','第 ')+r.current.seq+L('',' 期')+'</span><strong class="mono">'+money(r.current.settlement,r.q.ccy)+'</strong></div><div>'+L('Due ','应还日 ')+date(r.current.due)+(r.current.overdue?small(L('Overdue ','逾期 ')+r.current.overdue+L(' days',' 天')):'')+'</div></div>':CF.note('',L('No instalments awaiting repayment.','暂无待还期次。')));
     add('mc-pending',L('Awaiting confirmation','待还款确认'),r.pending.length?r.pending.map(p=>'<article class="mc-record"><div class="mc-record-head"><b>'+L('Instalment ','第 ')+p.seq+L('',' 期')+'</b>'+badge(p.status)+'</div>'+dl([[L('Instalment / record','期次／还款记录'),copy(p.id)+'<br>'+copy(p.record.id)],[L('Submitted at','提交时间'),time(p.record.at)],[L('Confirmation deadline','确认截止时间'),time(p.deadline)],[L('Time remaining','剩余时限'),countdown(p)],[L('Settlement amount','结算金额'),money(p.settlement,r.q.ccy)]])+'</article>').join(''):CF.empty(L('No pending confirmations','暂无待确认记录'),''));
     add('mc-plan',L('Final repayment schedule','定稿还款计划'),dl([[L('Finalized at','计划定稿时间'),time(r.plan.at)],[L('Interest starts','起息日'),date(r.plan.start)],[L('Final repayment date','最终还款日'),date(r.plan.end)],[L('Repayment type','还款类型'),L('Quarterly interest, principal at maturity','按季付息，到期还本')],[L('Annual rate','年化利率'),E(r.q.rate)+'% · ACT/360']])+'<p class="mc-small">'+L('Expand an instalment to view principal, interest and its records.','展开期次可查看本金、利息与还款记录。')+'</p><div class="mc-plan">'+r.periods.map(p=>'<details class="mc-period" id="mc-period-'+E(p.id)+'"'+(selected?.id===p.id?' open':'')+'><summary data-period="'+E(p.id)+'"><span><b>'+L('Instalment ','第 ')+p.seq+L('',' 期')+'</b>'+small(date(p.due))+'</span><span><span class="mc-small">'+L('Total due (USD)','应还合计（USD）')+'</span><strong class="mono">'+CF.fmtAmt(p.total)+'</strong></span><span><span class="mc-small">'+L('Settlement amount','结算金额')+'</span><strong class="mono">'+money(p.settlement,r.q.ccy)+'</strong></span><span>'+badge(p.status)+(p.principal?small(L('Includes principal','含本金')):'')+(p.overdue?small(L('Overdue ','逾期 ')+p.overdue+L(' days',' 天')+(p.record?L(' · frozen',' · 已冻结'):'')):'')+(match===p.status?small(L('Matches current filter','匹配当前筛选')):'')+'</span><span aria-hidden="true" class="mc-expand">＋</span></summary><div class="mc-period-body">'+periodFacts(r,p)+'</div></details>').join('')+'</div>');
   }
   add('mc-account',L('Funder’s repayment receiving account','资金方还款收款账户'),account(r.deal.record.form,r.q.ccy));
   return out;
 }
 function details(k,r){
   const out=[],add=(id,t,body)=>out.push(section(id,t,body));
   if(k==='tokens'){
     add('mc-basic',L('Token information','代币信息'),dl([[L('Token ID','代币编号'),copy(r.id)],[L('Quantity','代币数量'),CF.fmtAmt(r.units)],[L('Token value','代币价值'),money(r.value)],[L('Buyer','买方企业'),E(text(r.buyer))],[L('Receivable period','底层应收账款账期'),date(r.from)+' → '+date(r.due)],[L('Issued at','签发时间'),time(r.issued)],[L('Token status','代币状态'),badge(r.status)],[L('Pledge status','质押状态'),badge(r.pledged?'pledged':'unpledged')]]));
     add('mc-project',L('Associated project','关联融资项目'),destinations(k,r).projects.length?dl([[L('Project','融资项目'),E(text(D.project(r.project)?.name))],[L('Project ID','项目编号'),copy(r.project)]])+'<p>'+link('detail',L('View console project details','查看控制台项目详情'),'projects|'+r.project)+'</p>':CF.empty(destinations(k,r).reason,''));
   }else if(k==='projects'){
     const n=r.n;
     add('mc-basic',L('Project overview','项目概况'),dl([[L('Project ID','融资项目编号'),copy(r.id)],[L('Project name','融资项目名称'),E(text(r.name))],[L('Token type','代币类型'),L('Receivables','应收账款')],[L('Project status','项目状态'),badge(r.status)],[L('Project deadline','项目有效截止日'),date(r.expires)],[L('Created at','创建时间'),time(r.created)],[L('First published','首次发布时间'),time(r.published)]]));
     add('mc-coverage',L('Collateral and coverage','质押与覆盖'),dl([[L('Pledged tokens','质押代币张数'),n.pool.length],[L('Effective token value','有效代币价值'),money(n.value)],[L('Pledge ratio','质押率'),'80%'],[L('Financing requested','融资需求'),money(r.amount)],[L('Outstanding principal','已融资余额'),money(r.balance)],[L('Coverage status','质押覆盖状态'),badge(n.grade)],[L('Coverage shortfall','覆盖缺口'),money(n.gap)],[L('Additional asset value needed','需追加资产价值'),money(n.gap/0.8)],[L('Void pledged tokens','已质押失效代币'),n.pool.filter(t=>!t.valid).length],[L('Withdrawable token value','可提取代币价值'),r.l8ReleasePending?L('Release result pending','释放结果待取得'):money(D.tokens.filter(t=>t.releasedFrom===r.id&&t.pledge==='released').reduce((n,t)=>n+t.value,0)+n.withdraw)]]));
     add('mc-rounds',L('Financing applications','融资申请信息'),r.demands.length?[...r.demands].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).map(d=>{
       const quotes=Q.data().quotes.filter(q=>q.demand===d.id&&q.project===r.id&&party(q)).sort((a,b)=>b.at-a.at),current=quotes.find(q=>['waiting','funding','funded'].includes(q.state)),history=quotes.filter(q=>q!==current),credit=current&&normalized('credits').find(c=>c.owner===current.owner&&c.fund===current.fund);
       const quoteRow=q=>'<article class="mc-record"><div class="mc-record-head"><b>'+E(fund(q.fund))+'</b>'+badge(({expired:'quoteExpired',funding:'pending',funded:'repaying'})[q.state]||q.state)+'</div>'+dl([[L('Business ID','融资业务编号'),copy(q.id)],[L('Annual rate','年化利率'),E(q.rate)+'%'],[L('Quoted at','报价时间'),time(q.at)],[L('Reason','终结原因'),E(q.reason||'—')]])+link('detail',L('View quote details','查看报价详情'),'quotes|'+q.id)+(q.l7?link('detail',L('View disbursement details','查看放款详情'),'loans|'+q.id):'')+'</article>';
       return '<article class="mc-record" id="mc-application-'+E(d.id)+'"><div class="mc-record-head"><b>'+copy(d.id)+'</b>'+badge(d.state)+'</div>'+dl([[L('Application amount','申请金额'),money(d.amount)],[L('Published at','本轮发布时间'),time(d.at)],[L('End reason','终结原因'),E(d.reason||'—')]])+'<h3>'+L('Current / accepted quote','当前有效／已接受报价')+'</h3>'+(current?quoteRow(current)+(credit?dl([[L('Credit limit','总授信'),money(credit.total)],[L('Total credit used','已用授信'),money(credit.used)]]):''):CF.note('',L('No current valid quote','暂无有效报价')))+(history.length?'<details class="mc-history"><summary>'+L('Historical quotes','历史报价')+'</summary>'+history.map(quoteRow).join('')+'</details>':'')+'</article>';
     }).join(''):CF.empty(L('No financing applications','暂无融资申请'),''));
   }else if(k==='credits'){
     add('mc-basic',L('Credit facility','授信信息'),dl([[L('Credit ID','授信编号'),copy(r.id)],[L('Counterparty','对方企业'),E(counter(r))],[L('Status','额度状态'),badge(r.status)],[L('First established','首次核定时间'),time(r.first)],[L('Valid until','有效期至'),date(r.expires)]]));
     add('mc-credit',L('Credit usage','授信使用情况'),dl([[L('Credit limit','授信额度'),money(r.total)],[L('Principal occupied','授信占用额'),money(r.principal)],[L('Quotes in transit','在途报价金额'),money(r.transit)],[L('Total used','授信已用额合计'),money(r.used)],[L('Available credit','可用授信'),money(r.available)]]));
     if(S.role==='fund')add('mc-note',L('Internal remark','内部备注'),'<p>'+E(r.history?.at(-1)?.remark||L('No internal remark','暂无内部备注'))+'</p>');
   }else if(k==='loans'||k==='quotes'){
     add('mc-basic',L('Business identity','业务信息'),refs(r)+(k==='loans'?dl([[L('Accepted at','接受报价时间'),time(r.acceptedAt)],[L('Disbursement ID','放款编号'),r.deal?.record?copy(r.deal.record.id):L('No disbursement record yet','尚无放款记录')],[L('Submitted at','放款提交时间'),r.deal?.record?time(r.deal.record.at):L('Not submitted','未提交')],[L('Receipt confirmed','到账确认时间'),r.deal?.confirmedAt?time(r.deal.confirmedAt):L('Not confirmed','未确认')]]):''));add('mc-terms',L('Commercial terms','商务条款'),terms(r));
     if(k==='quotes')add('mc-quote',L('Quote and lock','报价与锁定'),dl([[L('Business status','业务状态'),badge(r.status)],[L('Quote submitted','报价提交时间'),time(r.at)],[L('Lock starts','锁定开始时间'),time(r.at)],[L('Locked by','锁定机构'),E(fund(r.fund))],[L('Time locked','已锁定时长'),(Math.max(0,Math.floor(((r.status==='waiting'?now():r.done||r.end)-r.at)/H)))+' '+L('hours','小时')],[L('Quote expiry','报价到期时间'),time(r.end)],[L('Remaining time','剩余时限'),r.status==='waiting'?countdown(r,true):'—'],[L('Project coverage','当前项目覆盖'),badge(D.numbers(D.project(r.project)).grade)],[L('Termination reason','终止或失效原因'),E(r.deal?.reason||r.reason||'—')]]));
     const x=r.deal;
     if(x){add('mc-contract',L('Contract and disposition','合同与处置'),dl([[L('Contract versions','合同版本数'),x.versions.length],[L('Latest version submitted','最新版本上传时间'),time(x.versions.at(-1)?.at)],[L('Disbursement deferred','暂缓放款原因'),E(x.hold?.text||'—')],[L('Stamped contract re-upload','盖章件重传要求'),E(x.redo?.text||'—')],[L('Terminated at','终止时间'),time(x.terminatedAt)],[L('Termination reason','终止原因'),E(x.reason||'—')]]));
       add('mc-record',L('Disbursement record','放款记录'),x.record?dl([[L('Record ID','放款记录编号'),copy(x.record.id)],[L('Disbursement amount','放款金额'),money(x.settlement,x.ccy)],[L('Disbursed at','发放时间'),time(x.record.form.paidAt)],[L('Submitted at','提交时间'),time(x.record.at)],[L('Confirmed at','确认时间'),time(x.confirmedAt)],[L('Received amount','实收金额'),x.record.received?money(x.record.received,x.ccy):'—'],[L('Confirmation deadline','放款确认截止'),time(Date.parse(x.record.at)+168*H)],[L('Confirmation window','放款确认剩余时限'),r.status==='confirming'?countdown(r):'—'],[L('Note','放款备注'),E(x.record.form.note||'—')]]):CF.empty(L('No disbursement record yet','暂无放款记录'),L('The funder has not submitted a record.','资金方尚未提交放款记录。')));
       add('mc-asset-account',L('Asset holder’s disbursement receiving account','资产方放款收款账户'),assetAccount(r));
       add('mc-account',L('Funder’s repayment receiving account','资金方还款收款账户'),account(x.record?.form,x.ccy));
       if(x.record)add('mc-evidence',L('Payment evidence','放款凭证摘要'),evidence(x.record,x.ccy));
       if(['confirmed','settled'].includes(x.state))add('mc-related',L('Related repayment','关联还款业务'),link('detail',L('View repayment business','查看同笔还款业务'),'repayments|'+r.id));
     }
   }else{return repaymentSections(r);}

   return out;
 }
 function detail(k){
   if(!allowed())return gate();
   if(k==='tokens'&&(tokenError||!Array.isArray(D.tokens)))return '<div class="mc-root mc-error">'+CF.empty(L('Token details unavailable','代币详情暂不可用'),reloadHint(),'')+'</div>';
   const r=find(k,params().get('id'));if(!r||!tabs().includes(k)&&!(k==='quotes'&&S.role==='asset')||S.st==='denied')return unavailable();
   if(k==='repayments'&&params().get('period')&&!r.periods.some(p=>p.id===params().get('period')))return unavailable();
   if(['loading','error'].includes(detailState))return '<div class="mc-root mc-error">'+(detailState==='loading'?'<div role="status">'+CF.skelTable(6)+'</div>':CF.empty(L('Details could not be loaded','详情加载失败'),reloadHint(),''))+'</div>';
   const sections=details(k,r),amount=k==='tokens'?r.value:k==='projects'?r.balance:k==='credits'?r.available:k==='repayments'?r.deal.principalBalance:r.amount;
   const metric=k==='tokens'?L('Token value','代币价值'):k==='projects'?L('Financed balance','已融资余额'):k==='credits'?L('Available credit','可用授信'):k==='repayments'?L('Outstanding principal','未偿本金'):L('Financing amount','融资金额');
   const second=k==='repayments'?stat(L('Disbursed amount','放款金额'),money(r.deal.settlement,r.q.ccy)):k==='projects'?stat(L('Effective collateral value','有效质押价值'),money(r.n.value)):k==='credits'?stat(L('Credit limit','授信额度'),money(r.total)):k==='tokens'?stat(L('Receivable due','应收账款到期日'),date(r.due)):stat(r.deal?.record?L('Disbursed amount','放款金额'):L('Agreed disbursement amount','约定放款金额'),money(r.settlement,r.ccy));
   return '<div class="mc-root mc-detail"><div class="page-head"><div><h1 class="page-title" tabindex="-1">'+E(text(titles[k]))+'</h1><div class="mc-detail-meta">'+copy(k==='repayments'?r.request:r.id)+badge(r.status)+'</div></div><div class="mc-quick-actions" aria-label="'+L('Project navigation','项目导航')+'">'+controls(k,r)+'</div></div>'+(detailState==='stale'?CF.note('warn',L('The business state changed. The previous action is no longer available.','业务状态已变化，原操作已不可用。')):'')+'<div class="stat-row mc-detail-metrics">'+stat(metric,money(amount))+second+'</div><nav class="mc-chapters" aria-label="'+L('On this page','本页章节')+'">'+sections.map((x,i)=>'<button type="button" data-act="mc-section" data-v="'+x.id+'"'+(!i?' aria-current="location"':'')+'>'+E(x.title)+'</button>').join('')+'</nav><div class="detail-stack">'+sections.map(x=>x.html).join('')+'</div></div>';
 }
 function backBanner(){const back=safeRoute(params().get('mcReturn'));return back&&allowed()?'<div class="mc-return"><span>'+L('Opened from My console','来自我的控制台')+'</span>'+b('return',back.split('?')[0]==='#/console'?L('Return to console list','返回控制台列表'):L('Return to console details','返回控制台详情'),back)+'</div>':'';}
 function reviewTools(){return '<div class="grp"><h5>'+L('Console review states','控制台核验状态')+'</h5>'+[['normal','Normal','正常'],['loading','Detail loading','详情加载中'],['error','Detail error','详情加载失败'],['stale','Action expired','动作失效'],['stats','Summary error','单项统计失败'],['tokens-error','Token snapshot error','代币读取失败'],['association-error','Association error','关联读取失败'],['plan-error','Plan unavailable','还款计划加载失败'],['session','Session expired','登录失效']].map(([v,en,zh])=>b('scenario',L(en,zh),v)).join('')+'<p class="hint">'+L('Fixtures are shared with the marketplace; no real payment is made.','演示数据与广场共用；不发起真实付款。')+'</p></div>';}

 CF.review.register('P-MC-01',{group:['My console','我的控制台'],route:'/console',
   states:()=>allowed()?['default','loading','empty','noresult','error','denied']:['default'],
   reset(){S.st='default';statsError=tokenError=associationError=planError=false;}});
 kinds.forEach((k,i)=>CF.review.register('P-MC-0'+(i+2),{
   group:['My console · details','我的控制台 · 详情'],visible:()=>tabs().includes(k),
   states:()=>allowed()?['default','loading','error','denied']:['default'],
   route:()=>{const r=normalized(k)[0];return r?detailHref(k,r.id):null;},
   get:()=>S.st==='denied'?'denied':detailState==='normal'?'default':detailState,
   set(value){S.st=value==='denied'?'denied':'default';detailState=['loading','error'].includes(value)?value:'normal';},
   reset(){S.st='default';detailState='normal';statsError=tokenError=associationError=planError=false;}
 }));

 const mod={...old,id:'my-console-v13',pages:['P-MC-01',...kinds.map((_,i)=>'P-MC-0'+(i+2))],dict,
   content(id){if(id==='P-MC-01')return listing();const i=kinds.findIndex((_,i)=>id==='P-MC-0'+(i+2));return detail(kinds[i]);},
   breadcrumbRoute(id){return id==='P-MC-01'?listRoute(path().split('/')[2]||tabs()[0]).slice(1):old.breadcrumbRoute?.(id);},
   beforeRender(){old.beforeRender?.();if(lastRole!==S.role){S.layer=null;lastRole=S.role;detailState='normal';if(!allowed())copyValue='';}},
   afterRender(){old.afterRender?.();requestAnimationFrame(syncChapters);const current=location.hash;if(current!==lastHash){lastHash=current;if(path().startsWith('/console')){const q=params();restoring=true;setTimeout(()=>{window.scrollTo(0,Math.max(0,+q.get('y')||0));const box=document.getElementById('mc-list');if(box)box.scrollTop=Math.max(0,+q.get('scroll')||0);const id=q.get('focus');if(id)document.querySelector('[data-id="'+CSS.escape(id)+'"]')?.focus({preventScroll:true});else document.querySelector('.mc-root .page-title')?.focus({preventScroll:true});if(!q.has('y')){const k=path().split('/')[2],r=k==='repayments'&&find(k,q.get('id')),p=r&&selectedPeriod(r);const el=p?document.getElementById('mc-period-'+p.id):q.get('application')?document.getElementById('mc-application-'+q.get('application')):null;el?.scrollIntoView({block:'start'});}restoring=false;syncChapters();},0);}}
     if(focusAfter){const key=focusAfter;focusAfter='';setTimeout(()=>document.getElementById('mc-'+key)?.focus({preventScroll:true}),0);}
   },
   demo(){return (old.demo?.()||'')+reviewTools();},
   onAct(a,v,e){if(!a.startsWith('mc-'))return old.onAct?.(a,v,e)||false;
     const key=a.slice(3);
     if(key==='detail'){const [k,id]=v.split('|');goDetail(k,id);}
     if(key==='jump'){const [k,id]=v.split('|');jump(k,id);}
     if(key==='tab'){returnNotice=false;setView({tab:v,filter:'',secondary:'',project:'',query:'',periodState:'',confirmLate:'',sort:v==='credits'?'available-asc':'newest',page:1});}
     if(key==='clear'){S.st='default';returnNotice=false;setView({filter:'',secondary:'',project:'',query:'',periodState:'',confirmLate:'',page:1});}
     if(key==='search')setView({query:document.getElementById('mc-query').value.trim(),page:1});

     if(key==='page')setView({page:Math.max(1,+v)});


     if(key==='list'||key==='return'){returnNotice=key==='return';navigate(safeRoute(v)||'#/console');}
     if(key==='section'){chapterTarget=v;const el=document.getElementById(v);el?.focus({preventScroll:true});el?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
     if(key==='copy'){copyValue=v;const fallback=()=>CF.openLayer('modal','mc-copy');try{navigator.clipboard?.writeText(v).then(()=>CF.toast(L('Copied','已复制')),fallback)||fallback();}catch(_){fallback();}}
     if(key==='scenario'){planError=v==='plan-error';statsError=v==='stats';tokenError=v==='tokens-error';associationError=v==='association-error';detailState=['loading','error','stale'].includes(v)?v:'normal';if(v==='session'){S.role='guest';S.layer=null;S.demo=false;}CF.render();}
     return true;
   },
   layers:{...old.layers,'mc-copy':()=>({title:L('Copy reference','复制编号'),html:'<input class="inp mc-copy-value" readonly value="'+E(copyValue)+'" aria-label="'+L('Reference number','完整编号')+'"><p>'+L('Select the text and copy it.','请选择文本后复制。')+'</p>',foot:'<button class="btn" data-act="closelayer">'+L('Close','关闭')+'</button>'})}
 };
 CF.define(CF.LSView=mod);
 const composed=mod.content;mod.content=id=>(id==='P-LS-01'||id==='P-LS-02'?backBanner():'')+composed(id);
 document.addEventListener('change',e=>{if(e.target.id==='mc-targetProject'&&path().startsWith('/console/')){const q=params();q.set('targetProject',e.target.value);history.replaceState(null,'','#'+path()+'?'+q);CF.render();document.getElementById('mc-targetProject')?.focus();return;}if(path()!=='/console'||!e.target.id.startsWith('mc-'))return;const k=e.target.id.slice(3);if(['filter','secondary','project','sort','size','periodState','confirmLate'].includes(k))setView({[k]:k==='size'?+e.target.value:e.target.value,page:1});});
 document.addEventListener('click',e=>{
   const chapter=e.target.closest('[data-act=mc-section]');if(chapter){e.preventDefault();e.stopImmediatePropagation();mod.onAct('mc-section',chapter.dataset.v,e);syncChapters();return;}
   if(e.target.closest('a[data-act=mc-detail]')&&(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)){e.stopImmediatePropagation();return;}
   const nav=e.target.closest('#nav a,.brand');if(nav&&['#/assets','#/marketplace','#/console','#/'].includes(nav.getAttribute('href'))){e.preventDefault();e.stopImmediatePropagation();navigate(nav.getAttribute('href')==='#/'?'#/assets':nav.getAttribute('href'));return;}
   const period=e.target.closest('.mc-period summary');if(period){const u=params();u.set('period',period.dataset.period);history.replaceState(null,'','#'+path()+'?'+u);}
   const row=e.target.closest('.mc-table tr[data-id]');if(row&&!e.target.closest('button,a,input,select'))goDetail(row.dataset.kind,row.dataset.id);
 },true);
 document.addEventListener('keydown',e=>{if(e.target.id==='mc-query'&&e.key==='Enter'){e.preventDefault();setView({query:e.target.value.trim(),page:1});}
if(e.target.matches('.mc-table tr[data-id]')&&['Enter',' '].includes(e.key)){e.preventDefault();goDetail(e.target.dataset.kind,e.target.dataset.id);}
   if(e.target.matches('.mc-tabs [role=tab]')&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const ts=[...document.querySelectorAll('.mc-tabs button')],i=ts.indexOf(e.target),n=e.key==='Home'?0:e.key==='End'?ts.length-1:(i+(e.key==='ArrowRight'?1:ts.length-1))%ts.length;ts[n].click();setTimeout(()=>document.querySelector('.mc-tabs [aria-selected=true]')?.focus(),0);}
 });
 window.addEventListener('hashchange',()=>{if(!restoring&&path().startsWith('/console'))detailState='normal';});

 let chapterFrame=0,chapterTarget='';
 function syncChapters(){
   const root=document.querySelector('.mc-detail'),nav=root?.querySelector('.mc-chapters');if(!nav)return;
   const header=document.querySelector('.portal-head');root.style.setProperty('--mc-head',Math.ceil(header?.getBoundingClientRect().height||0)+'px');root.style.setProperty('--mc-chapters-height',Math.ceil(nav.getBoundingClientRect().height)+'px');
   const sections=[...root.querySelectorAll('.detail-section')],threshold=(header?.getBoundingClientRect().height||0)+nav.getBoundingClientRect().height+24;
   let active=sections[0];for(const section of sections)if(section.getBoundingClientRect().top<=threshold)active=section;
   if(window.scrollY+innerHeight>=document.documentElement.scrollHeight-3)active=sections.at(-1);
   if(chapterTarget)active=sections.find(s=>s.id===chapterTarget)||active;
   nav.querySelectorAll('button').forEach(b=>{if(b.dataset.v===active?.id)b.setAttribute('aria-current','location');else b.removeAttribute('aria-current');});
 }
 function scheduleChapters(){if(chapterFrame)return;chapterFrame=requestAnimationFrame(()=>{chapterFrame=0;syncChapters();});}
 window.addEventListener('scroll',scheduleChapters,{passive:true});window.addEventListener('resize',()=>{chapterTarget='';scheduleChapters();});
 window.addEventListener('wheel',()=>{chapterTarget='';},{passive:true});window.addEventListener('touchmove',()=>{chapterTarget='';},{passive:true});
 window.addEventListener('pointerdown',e=>{if(e.target===document.documentElement||e.target===document.body)chapterTarget='';});
 window.addEventListener('keydown',e=>{if(['PageDown','PageUp','ArrowDown','ArrowUp','Home','End',' '].includes(e.key)&&!e.target.closest('.mc-chapters'))chapterTarget='';});
 window.addEventListener('hashchange',()=>{chapterTarget='';planError=false;});
 const headerObserver=new ResizeObserver(scheduleChapters);headerObserver.observe(document.querySelector('.portal-head'));
 CF.MC={normalized,find,destinations,safeRoute,get state(){return detailState;},attach(){const previous=mod.demo;mod.demo=()=>previous()+reviewTools();CF.MCSeedPeriods?.();CF.render();}};
})(window.CF);
