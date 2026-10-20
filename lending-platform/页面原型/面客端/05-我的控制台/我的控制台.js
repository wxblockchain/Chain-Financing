/* WS-378. Read-only console on the current volumes: no business deadline anywhere, two-step disbursement,
 * company-account receiving snapshots and per-chain transaction identifiers. */
(function(CF){
 'use strict';
 const S=CF.S,D=CF.LS,Q=CF.CQ,L=CF.L,E=CF.esc,old=CF.LSView,H=3600000,DAY=24*H;
 const kinds=['tokens','projects','credits','loans','repayments','quotes'];
 const names={tokens:['Tokens','代币列表'],projects:['Financing projects','融资项目'],credits:['Credit facilities','授信明细'],loans:['Disbursements','融资放款信息'],repayments:['Repayments','还款信息'],quotes:['My quotes','我的报价']};
 const titles={tokens:['Token details','代币详情'],projects:['Project details','融资项目详情'],credits:['Credit details','授信详情'],loans:['Disbursement details','融资放款详情'],repayments:['Repayment details','还款业务详情'],quotes:['Quote details','报价详情']};
 const labels={review:['Pending review','待审核'],returned:['Returned','已退回'],available:['Available','可用'],valid:['Valid','有效'],void:['Void','失效'],pledged:['Pledged','已质押'],unpledged:['Not pledged','未质押'],draft:['Draft','草稿'],raising:['Fundraising','募集中'],locked:['Locked','已锁定'],financing:['Financing','融资中'],closed:['Closed','已关闭'],settled:['Settled','已结清'],surplus:['Pledge surplus','质押充足'],balanced:['Pledge balanced','质押持平'],short:['Pledge shortfall','质押不足'],effective:['Effective','生效中'],expired:['Expired','已到期'],pending:['Awaiting disbursement','待放款'],confirming:['Awaiting receipt confirmation','待放款确认'],repaying:['Repaying','还款中'],waiting:['Awaiting acceptance','待接受'],rejected:['Rejected','已拒绝'],quoteEnded:['Quote invalidated','报价已失效'],due:['Pending repayment','待还款'],repayConfirming:['Awaiting repayment confirmation','待还款确认'],initial:['Initial plan','初始版'],final:['Final plan','定稿版'],generating:['Plan generating','计划生成中'],open:['Awaiting quotes','待报价'],quoted:['Awaiting quote confirmation','已报价待确认'],funding:['Funding','放款中'],funded:['Disbursed','已放款'],ended:['Invalidated / closed','已失效／已关闭']};
 const text=a=>Array.isArray(a)?L(...a):a||'—';
 const nm=k=>k==='credits'&&S.role==='fund'?L('Credit summary','授信汇总'):text(names[k]);
 const status=k=>text(labels[k]||[k,k]);
 const badge=k=>CF.tag(['valid','settled','effective','surplus'].includes(k)?'ok':k==='short'?'warn':['confirming','repayConfirming','waiting','pending','generating'].includes(k)?'accent':'',status(k));
 const money=(n,c='USD',icon=false)=>n==null?'—':'<span class="mc-money'+(icon?' mc-stat-money':'')+'">'+(icon?CF.assetIcon(c):'')+'<span class="mc-number">'+CF.fmtAmt(n)+'</span> <span class="mc-unit">'+E(c)+'</span></span>';
 const statMoney=(n,c='USD')=>money(n,c,true);
 const time=n=>n==null||!Number.isFinite(new Date(n).getTime())?'—':CF.fmtTime(new Date(n).toISOString());
 const date=n=>n?CF.fmtDate(typeof n==='number'?new Date(n).toISOString():n):'—';
 const small=s=>'<div class="mc-small">'+s+'</div>';
 /* 本批起控制台没有任何业务时限：等待只如实累计已过去的时长，不做截止时点、剩余时长、倒计时或超期表达。 */
 const elapsed=ms=>{const v=Math.max(0,+ms||0),d=Math.floor(v/DAY),h=Math.floor(v/H);return d>=1?d+L(d>1?' days':' day',' 天'):h>=1?h+L(h>1?' hours':' hour',' 小时'):L('under an hour','不足 1 小时');};
 const since=ms=>ms==null?'—':elapsed(ms);
 /* 交易标识按本笔结算收款链取值；TRON 区块浏览器入口尚未裁定，只给复制与未核验说明，不放死链接。 */
 const b=(a,t,v='',primary=false,off=false)=>'<button type="button" class="btn'+(primary?' primary':'')+'" data-act="mc-'+a+'" data-v="'+E(v)+'"'+(off?' disabled':'')+'>'+E(t)+'</button>';
 const link=(a,t,v='',extra='')=>a==='detail'&&!extra.includes('disabled')?'<a class="actlink" href="'+E(detailHref(...v.split('|')))+'" data-act="mc-detail" data-v="'+E(v)+'" '+extra+'>'+E(t)+'</a>':'<button type="button" class="actlink" data-act="mc-'+a+'" data-v="'+E(v)+'" '+extra+'>'+E(t)+'</button>';
 const dl=rows=>'<dl class="dl mc-facts">'+rows.filter(Boolean).map(([k,v])=>'<div class="mc-fact"><dt>'+E(k)+'</dt><dd>'+v+'</dd></div>').join('')+'</dl>';
 const copy=v=>v==null||v===''?'—':'<span class="copy-pair"><span class="mono">'+E(v)+'</span>'+CF.copyBtn('mc-copy',v,L('Copy','复制'))+'</span>';
 const tabs=()=>S.role==='fund'?['quotes','credits','loans','repayments']:['tokens','projects','credits','loans','repayments'];
 const allowed=()=>['asset','fund'].includes(S.role);
 const path=()=>location.hash.slice(1).split('?')[0];
 const params=()=>new URLSearchParams(location.hash.split('?')[1]||'');
 const now=()=>CF.L8?.now||CF.L7?.now()||D.now();
 const party=q=>Q.related(q);
 const fund=id=>id==='fund-b'?L('Demo Capital B','演示资金机构 B'):L('Demo Capital A','演示资金机构 A');
 const owner=id=>id==='entity-demo-a'?L('Demo Asset Company A','演示资产企业 A'):L('Demo Asset Company B','演示资产企业 B');
 const counter=q=>S.role==='asset'?fund(q.fund):owner(q.owner);
 let sourceOpened='',sourceFault='',associationScene='normal';
 let detailState='normal',planError=false,statsError=false,tokenError=false,associationError=false,focusAfter='',lastHash='',lastRole=S.role+'|'+JSON.stringify(S.party),restoring=false,copyValue='',returnNotice=false;
 CF.PAGES['P-MC-01'].retainList=true;
 const dict={en:{},zh:{}};
 kinds.forEach((k,i)=>{const id='P-MC-0'+(i+2),key='mcDetail'+i;CF.PAGES[id]={end:'asset',layout:'portal',parent:'P-MC-01',crumbKey:key,auth:true,retainList:true};CF.ENTRY[id]='/console/'+k;dict.en[key]=titles[k][0];dict.zh[key]=titles[k][1];});
 function safeRoute(raw,detail=true){
   if(!raw||raw.length>12000||!/^#\/console(?:\?|$|\/(tokens|projects|credits|loans|repayments|quotes)\?)/.test(raw))return '';
   const p=raw.slice(1).split('?')[0];if(p!=='/console'&&(!detail||!kinds.some(k=>p==='/console/'+k)))return '';
   const q=new URLSearchParams(raw.split('?')[1]||'');if(p!=='/console'&&!q.get('id'))return '';
   const clean=new URLSearchParams();['tab','filter','secondary','project','sort','size','page','y','scroll','focus','id','period','application','query','periodState','targetProject','tokenType'].forEach(k=>{if(q.has(k))clean.set(k,q.get(k).slice(0,160));});
   if(detail&&q.has('list')){const list=safeRoute(q.get('list'),false);if(list)clean.set('list',list);}
   return '#'+p+(clean.size?'?'+clean:'');
 }
 function view(){const q=params(),tab=tabs().includes(q.get('tab'))?q.get('tab'):tabs()[0];return {tab,filter:q.get('filter')||'',secondary:q.get('secondary')||'',project:q.get('project')||'',tokenType:q.get('tokenType')||'',query:q.get('query')||'',periodState:q.get('periodState')||'',sort:q.get('sort')||(tab==='credits'?'available-asc':'newest'),size:[20,50,100].includes(+q.get('size'))?+q.get('size'):20,page:Math.min(100000,Math.max(1,parseInt(q.get('page'))||1))};}
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
   const related=Q.data().quotes.filter(party),ownProjects=D.projects.filter(p=>D.mine(p));
   if(k==='tokens')return tokenSnapshot();
   if(k==='projects')return S.role==='asset'?ownProjects.map(p=>({...p,project:p.id,status:p.state,n:D.numbers(p),amount:D.current(p)?.amount??null,at:p.created||p.published})):[];
   if(k==='credits')return Q.data().credits.filter(c=>S.role==='asset'?c.owner===D.me():c.fund===Q.fund()).map(c=>{const transit=Q.data().quotes.filter(q=>q.owner===c.owner&&q.fund===c.fund&&['waiting','funding'].includes(q.state)).reduce((n,q)=>n+q.amount,0),expired=Date.parse(c.expires+'T23:59:59Z')<now();return {...c,status:expired?'expired':'effective',transit,available:expired?0:Math.max(0,c.total-c.principal-transit),used:c.principal+transit,at:c.first};});
   if(k==='repayments')return related.filter(q=>q.l7?.record&&['confirmed','settled'].includes(q.l7.state)).map(q=>{
     const deal=q.l7,plan=q.l8,periods=(plan?.periods||[]).map(p=>({...p,status:p.state==='pending'?'repayConfirming':p.state==='settled'?'settled':'due',overdue:p.record?p.record.overdue:Math.max(0,Math.floor((Date.parse(new Date(now()).toISOString().slice(0,10))-Date.parse(p.due))/DAY)),waiting:p.state==='pending'&&p.record?now()-Date.parse(p.record.at):null}));
     const current=periods.filter(p=>p.state==='due').sort((a,b)=>a.due.localeCompare(b.due)||a.seq-b.seq)[0]||null,pending=periods.filter(p=>p.state==='pending');
     return {id:q.id,business:q.id,project:q.project,request:q.demand,q,deal,plan,periods,current,pending,status:plan?.settledAt?'settled':'repaying',planState:plan?'final':'generating',due:current?.due,at:deal.confirmedAt,overdue:periods.some(p=>p.state!=='settled'&&p.overdue>0),amount:q.amount};
   });
   return related.filter(q=>k==='quotes'||q.l7).map(q=>{const x=q.l7;return {...q,q,deal:x,status:x?({pending:'pending',waiting:'confirming',confirmed:q.l8?.settledAt?'settled':'repaying',settled:'settled'}[x.state]||'repaying'):({waiting:'waiting',rejected:'rejected',expired:'quoteEnded'}[q.state]||q.state),fdState:x?({pending:'pending',waiting:'confirming'}[x.state]||'funded'):null,request:q.demand,acceptedAt:q.done||null,at:k==='loans'?q.done:q.at,waiting:x?.state==='waiting'&&x.record?now()-Date.parse(x.record.at):null,locked:Math.max(0,(q.state==='waiting'?now():q.done||now())-q.at)};});
 }
 /* 每个筛选项可多选，取值按逗号串保存；空串代表不限。 */
 const picks=value=>String(value||'').split(',').filter(Boolean);
 const within=(value,candidate)=>{const l=picks(value);return !l.length||l.includes(String(candidate));};
 function matches(r,v){
   const repayment=v.tab==='repayments';
   if(v.tokenType&&!within(v.tokenType,r.kind))return false;
   return (!v.filter||picks(v.filter).some(f=>f==='generating'?r.planState==='generating':(v.tab==='loans'?r.fdState:r.status)===f))&&
     (v.tab==='tokens'?!picks(v.project).length||picks(v.project).some(id=>r.projects.includes(id)):within(v.project,r.project))&&
     (!v.query||[r.id,r.request,r.deal?.record?.id].includes(v.query.trim()))&&
     (!v.periodState||repayment&&r.periods.some(p=>within(v.periodState,p.status)))&&
     within(v.secondary,v.tab==='tokens'?(r.pledged?'pledged':'unpledged'):v.tab==='projects'?r.n.grade:repayment?(r.overdue?'yes':'no'):'');
 }
 function filtered(){const v=view();let rows=S.st==='empty'?[]:normalized(v.tab);rows=rows.filter(r=>matches(r,v));
   if(S.st==='noresult')return [];
   const value=r=>v.sort.startsWith('value')?r.value:v.sort.startsWith('available')?r.available:v.sort.startsWith('due')?(r.due?Date.parse(r.due):Infinity):Date.parse(r.at)||Number(r.at)||0;
   rows.sort((a,b)=>{const x=value(a),y=value(b);if(!Number.isFinite(x)||!Number.isFinite(y))return x===y?a.id.localeCompare(b.id):Number.isFinite(x)?-1:1;return (x===y?0:(x-y)*(v.sort==='newest'||v.sort.endsWith('desc')?-1:1))||a.id.localeCompare(b.id);});return rows;
 }
 function find(k,id){return normalized(k).find(r=>r.id===id||(k==='repayments'&&r.periods.some(p=>p.id===id)));}
 function selectedPeriod(r){const id=params().get('period')||(params().get('id')!==r.id?params().get('id'):'');return id?r.periods.find(p=>p.id===id):null;}
 function destinations(k,r){
   if(associationScene==='none')return {projects:[],reason:L('No associated financing project','暂无关联融资项目')};
   if(associationScene==='denied')return {projects:[],reason:L('No accessible associated project','暂无可访问关联项目')};
   if(associationError)return {projects:[],reason:L('Project associations unavailable. Reload this URL in your browser.','关联项目暂不可用，请使用浏览器刷新当前网址。')};
   const ids=[...new Set(k==='credits'?Q.data().quotes.filter(q=>q.owner===r.owner&&q.fund===r.fund&&party(q)).map(q=>q.project):(k==='tokens'?r.projects:[k==='projects'?r.id:r.project]).filter(Boolean))];
   const projects=ids.map(id=>D.project(id)).filter(p=>p&&(D.mine(p)||!!p.published));
   return {projects,reason:!ids.length?L('No associated financing project','暂无关联融资项目'):!projects.length?L('No accessible associated project','暂无可访问关联项目'):''};
 }
 function destination(k,r){const d=destinations(k,r);return d.projects.length===1?d.projects[0]:d.projects.find(p=>p.id===params().get('targetProject'));}
 function jump(k,id){
   const r=find(k,id),p=r&&destination(k,r);if(!p){CF.toast(L('Select an accessible associated project.','请选择可访问的关联项目。'));CF.render();return;}
   const q=new URLSearchParams({mcReturn:snapshot(),mcKind:k,mcObject:r.id});
   if(associationScene==='unsupported')q.set('mcFallback','1');
   const application=k==='projects'?params().get('application'):r.request;
   if(application)q.set('mcApplication',application);
   if(k==='repayments'){const period=selectedPeriod(r);if(period){q.set('mcPeriod',period.id);if(period.record)q.set('mcRecord',period.record.id);}}
   if(k==='loans'&&r.deal?.record)q.set('mcRecord',r.deal.record.id);
   navigate('#/project/'+encodeURIComponent(p.id)+'?'+q);
 }
 function controls(k,r){const d=destinations(k,r),target=destination(k,r);
   return (d.projects.length>1?'<div class="mc-project-field"><label for="mc-targetProject">'+L('Associated financing project','关联融资项目')+'</label>'+select('targetProject',L('Associated financing project','关联融资项目'),[['',L('Select a project','请选择项目')],...d.projects.map(p=>[p.id,text(p.name)+' · '+p.id])],target?.id||'')+'</div>':'')+
     b('jump',L('Go to lending marketplace','前往借贷广场'),k+'|'+r.id,true,!target)+(d.reason?'<p class="mc-small" role="status">'+E(d.reason)+'</p>':'');
 }
 const reloadHint=()=>L('Reload this URL in your browser to try again.','请使用浏览器刷新当前网址重试。');
 function tokenSnapshot(){
   if(S.role!=='asset')return [];
   /* 一笔代币一行，不展示持有地址与份额。质押状态与资产广场持有方清单逐个对照：任一持有方已质押即「已质押」，所属项目列出每个已质押持有方的项目。 */
   const all=Array.isArray(D.tokens)?D.tokens:[],no=t=>t.no||t.id,seen=new Set();
   return all.filter(t=>{
     if(t.owner!==D.me()||!t.id||seen.has(no(t))||typeof t.valid!=='boolean'||!Number.isFinite(t.units)||!Number.isFinite(t.value)||!/^0x[0-9a-f]{64}$/i.test(t.tx||'')||!t.issued||!Number.isFinite(Date.parse(t.issued)))return false;
     seen.add(no(t));return true;
   }).map(t=>{const id=no(t),pledged=all.filter(x=>no(x)===id&&x.pledge==='pledged'),projects=[...new Set(pledged.map(x=>x.pool).filter(Boolean))];
     return {...t,id,units:t.tokenUnits??t.units,value:t.tokenValue??t.value,status:t.valid?'valid':'void',pledged:pledged.length>0,projects,project:projects[0]||null,amount:t.tokenValue??t.value,at:t.issued};});
 }
 /* 需求终结原因与项目关闭原因按借贷广场口径展示；其余为来源原文。 */
 const reasonNames={withdrawn:['Withdrawn by asset holder','资产方撤下'],funded:['Deal concluded','成交'],closed:['Project closed','项目关闭'],expiry:['Project expired','项目到期'],coverage:['Automatically invalidated · pledge water level insufficient','自动失效·质押水位不足'],owner:['Closed by asset holder','资产方主动关闭']};
 const reasonText=v=>!v?'—':reasonNames[v]?L(...reasonNames[v]):String(v);
 const closeReasonText=v=>v==='expiry'?L('Term expired','有效期到期'):reasonText(v);
 function stat(title,value,note='',tone=''){return '<div class="s"'+(tone?' data-tone="'+tone+'"':'')+'><div class="k">'+E(title)+'</div><div class="v">'+value+'</div>'+(note?'<div class="n">'+note+'</div>':'')+'</div>';}
 function summary(){
   if(S.st==='loading')return CF.skelTable(2);
   const empty=S.st==='empty',tokens=empty?[]:normalized('tokens'),credits=empty?[]:normalized('credits'),sum=(rs,k)=>rs.reduce((n,r)=>n+(+r[k]||0),0),pledged=tokens.filter(r=>r.pledged),voids=pledged.filter(r=>!r.valid);
   /* 代币与授信合并成一条统计条：同一层信息不再拆成卡片盒子。 */
   let assets='';
   if(S.role==='asset'&&(tokenError||!Array.isArray(D.tokens)))assets='<section class="card mc-assets">'+CF.empty(L('Token summary unavailable','代币统计暂不可用'),reloadHint(),'')+'</section>';
   let holdings='';
   if(S.role==='asset'&&!assets){
     holdings=stat(L('All tokens','全部代币'),tokens.length+'<span class="mc-count-unit">'+L(' tokens',' 张')+'</span>',statMoney(sum(tokens,'value')),'accent')+
       stat(L('Of which pledged','其中已质押'),pledged.length+'<span class="mc-count-unit">'+L(' tokens',' 张')+'</span>',statMoney(sum(pledged,'value'))+' · '+L('void ','其中已失效 ')+voids.length+L(' tokens',' 张')+' · '+statMoney(sum(voids,'value'))+L(' excluded',' 不计入有效质押'),'info');
   }
   return assets+'<div class="stat-strip mc-summary'+(holdings?' mc-summary--asset':'')+'">'+holdings+(statsError?stat(L('Total credit','总授信额度'),'—',E(reloadHint())):stat(L('Total credit','总授信额度'),statMoney(sum(credits,'total')),credits.length+L(' facilities',' 笔授信'),'accent'))+stat(L('Financed balance','已融额度'),statMoney(empty?0:S.role==='asset'?sum(normalized('projects'),'balance'):sum(credits,'principal')),(empty?0:normalized('repayments').filter(r=>r.status!=='settled').length)+L(' unsettled businesses',' 笔未结清业务'),'info')+stat(L('Available credit','剩余可用授信'),statMoney(sum(credits,'available')),L('Subject to assessment when publishing a request.','实际可融金额以发布需求时核定结果为准。'),'pos')+'</div>'+(S.role==='asset'?'<p class="mc-small mc-scope">'+L('Token values use the exchange rate at issuance. Whole-token figures do not represent your currently available holdings or financing capacity.','代币价值按各笔签发时汇率折算；整笔代币统计不代表本企业当前可用份额或可融额度。')+'</p>':'');
 }
 const filterOptions={tokens:['valid','void'],projects:['review','returned','available','raising','locked','financing','closed','settled'],credits:['effective','expired'],loans:['pending','confirming','funded'],repayments:['repaying','settled','generating'],quotes:['waiting','rejected','quoteEnded','pending','confirming','repaying','settled']};
 function select(key,title,options,value){return CF.filterSelect('mc-'+key,title,options,value,'');}
 function pick(key,title,options,value){return CF.filterMenu('mc-'+key,title,options.filter(o=>o[0]!==''),picks(value));}
 function filters(){const v=view(),all=['',L('All','全部')];let h=pick('filter',v.tab==='tokens'?L('Token status','代币状态'):v.tab==='projects'?L('Project status','项目状态'):L('Status','状态'),[all,...filterOptions[v.tab].map(k=>[k,status(k)])],v.filter);
   const sec=v.tab==='tokens'?['pledged','unpledged']:v.tab==='projects'?['surplus','balanced','short']:v.tab==='repayments'?['yes','no']:[];
   if(sec.length)h+=pick('secondary',v.tab==='tokens'?L('Pledge status','质押状态'):v.tab==='projects'?L('Pledge sufficiency','质押情况'):L('Repayment overdue','还款是否逾期'),[all,...sec.map(k=>[k,k==='yes'?L('Yes','是'):k==='no'?L('No','否'):status(k)])],v.secondary);
   if(['tokens','projects'].includes(v.tab))h+=pick('tokenType',L('Token type','代币类型'),[['erc20-ar',text(D.type('erc20-ar').label)]],v.tokenType);
   if(v.tab==='tokens')h+=pick('project',L('Project','所属融资项目'),[all,...normalized('projects').map(p=>[p.id,text(p.name)])],v.project);
   if(v.tab==='repayments')h+=pick('periodState',L('Contains instalments','包含期次状态'),[all,...['due','repayConfirming','settled'].map(k=>[k,status(k)])],v.periodState);
   if(['loans','repayments'].includes(v.tab))h+=CF.filterSearch('mc-query',L('Reference number','完整编号'),v.query,L('Application, business or disbursement number','融资申请 / 业务 / 放款编号'));
   const sorts=v.tab==='tokens'?[['newest',L('Newest issuance','签发时间倒序')],['value-asc',L('Value: low to high','价值升序')],['value-desc',L('Value: high to low','价值降序')],['due-asc',L('Due date: earliest','到期日升序')],['due-desc',L('Due date: latest','到期日降序')]]:v.tab==='repayments'?[['newest',L('Newest receipt confirmation','到账确认时间倒序')],['due-asc',L('Due date: earliest','应还日升序')],['due-desc',L('Due date: latest','应还日降序')]]:v.tab==='credits'?[['available-asc',L('Available credit: low to high','可用授信升序')],['available-desc',L('Available credit: high to low','可用授信降序')]]:[['newest',L('Newest first','时间倒序')]];
   h+=select('sort',L('Sort','排序'),sorts,v.sort);
   return '<div class="filterbar mc-filters">'+h+'<div class="fb-acts">'+(['loans','repayments'].includes(v.tab)?b('search',L('Search','查询'),'',true):'')+b('clear',L('Reset filters','清空筛选'))+'</div></div>'+(Object.keys(v).some(k=>['filter','secondary','project','query','periodState','tokenType'].includes(k)&&v[k])?'<div class="mc-filter-note" role="status">'+L('Filtered by: ','已按以下条件过滤：')+E([v.tokenType?text(D.type('erc20-ar').label):'',picks(v.filter).map(status).join(' / '),picks(v.secondary).map(k=>k==='yes'?L('Overdue','逾期'):k==='no'?L('Not overdue','未逾期'):status(k)).join(' / '),picks(v.periodState).map(status).join(' / '),v.query,picks(v.project).join(' / ')].filter(Boolean).join(' · '))+'</div>':'');
 }
 function columns(k){return {
   tokens:[[L('Token','代币编号'),'id'],[L('Quantity','数量'),'num'],[L('Value (USD)','价值（USD）'),'num'],[L('Token status','代币状态'),''],[L('Pledge status','质押状态'),''],[L('Receivable due','应收账款到期日'),''],[L('Project','所属项目'),'']],
   projects:[[L('Project','融资项目'),'id'],[L('Status','项目状态'),''],[L('Requested (USD)','融资需求（USD）'),'num'],[L('Balance (USD)','已融资余额（USD）'),'num'],[L('Pledge sufficiency','质押情况'),''],[L('Project deadline','项目截止日'),'']],
   credits:[[L('Facility / counterparty','授信编号／对方企业'),'id'],[L('Credit limit (USD)','授信额度（USD）'),'num'],[L('Used (USD)','已用授信（USD）'),'num'],[L('Available (USD)','可用授信（USD）'),'num'],[L('Status','额度状态'),''],[L('Valid until','有效期至'),'']],
   loans:[[L('Application / business','融资申请／业务'),'id'],[L('Counterparty','对方企业'),''],[L('Financing (USD)','融资金额（USD）'),'num'],[L('Disbursement amount','放款金额'),'num'],[L('Status / actor','业务状态／处理方'),''],[L('Accepted at','接受时间'),'']],
   quotes:[[L('Business / application','融资业务／融资申请编号'),'id'],[L('Project','所属项目'),''],[L('Asset holder','资产方'),''],[L('Amount (USD)','融资金额（USD）'),'num'],[L('Status','业务状态'),''],[L('Time locked','已锁定时长'),'']],
   repayments:[[L('Application / funder','融资申请／出资机构'),'id'],[L('Current instalment','本期应还'),'num'],[L('Due date','应还日'),''],[L('Business / plan','业务／计划'),''],[L('Pending confirmations','待确认情况'),''],[L('Receipt confirmed','到账确认时间'),'']]
 }[k];}
 function rowValues(k,r){const object=t=>'<a class="mc-object" href="'+E(detailHref(k,r.id))+'" data-act="mc-detail" data-v="'+k+'|'+E(r.id)+'">'+E(t)+'</a>';
   if(k==='tokens')return [object(r.id),CF.fmtAmt(r.units),CF.fmtAmt(r.value),badge(r.status)+(!r.valid?small(L('Not counted toward eligible pledged value','不计入有效质押')):''),badge(r.pledged?'pledged':'unpledged'),date(r.due),destinations(k,r).projects.length?destinations(k,r).projects.map(p=>E(text(p.name))).join('<br>'):L('No accessible project','暂无可访问项目')];
   if(k==='projects')return [object(text(r.name))+small(E(r.id)),badge(r.status),(D.current(r)?CF.fmtAmt(r.amount)+small(E(D.current(r).id))+small(status(D.current(r).state))+(Q.currentQuote(r,D.current(r).id)?.state==='waiting'?small(L('Locked for ','已锁定 ')+elapsed(now()-Q.currentQuote(r,D.current(r).id).at)):''):'—'+small(L('No current application','暂无当前申请'))),CF.fmtAmt(r.balance),badge(r.n.grade)+(r.n.pendingValue?small(L('Pending / rejected collateral','待审 / 驳回未解押')+' · '+money(r.n.pendingValue)):'')+(r.n.gap?'<span class="mc-indicator">'+L('Gap ','缺口 ')+money(r.n.gap)+small(L('Additional asset value ','需追加资产价值 ')+money(r.n.rate?r.n.gap/r.n.rate:null))+'</span>':r.demands.some(d=>d.state==='quoted')?'<span class="mc-indicator">'+L('Quote awaiting review','有待确认报价')+'</span>':''),date(r.expires)];
   if(k==='credits')return [object(r.id)+small(E(counter(r))),CF.fmtAmt(r.total),CF.fmtAmt(r.used),CF.fmtAmt(r.available),badge(r.status),date(r.expires)];
   if(k==='repayments')return [object(r.request)+small(E(r.id)+' · '+E(r.deal.record.id))+small(E(counter(r.q))),r.current?'<strong>'+money(r.current.settlement,r.q.ccy)+'</strong>'+small(L('Instalment ','第 ')+r.current.seq+L('',' 期')):r.plan?L('No instalments awaiting repayment','暂无待还期次'):'—',r.current?date(r.current.due)+(r.current.overdue?small(L('Overdue ','逾期 ')+r.current.overdue+L(' days',' 天')):now()<r.current.open?small(L('Opens ','开启于 ')+date(r.current.open)):''):'—',badge(r.status)+small(status(r.planState))+(r.overdue?small(L('Overdue · unsettled','逾期 · 未结清')):''),r.pending.length?badge('repayConfirming')+small(r.pending.map(p=>L('Instalment ','第 ')+p.seq+L('',' 期')+L(' · submitted ',' · 已提交 ')+elapsed(p.waiting)+(p.overdue?L(' · overdue frozen ',' · 逾期冻结 ')+p.overdue+L(' days',' 天'):'')).join(' / ')):L('No pending confirmations','暂无待确认'),time(r.at)];
   const state=badge(k==='loans'?r.fdState:r.status);
   if(k==='quotes')return [object(r.id)+small(E(r.request)),E(text(D.project(r.project)?.name)),E(owner(r.owner)),money(r.amount)+small(money(r.settlement,r.ccy)+' · '+E(r.rate)+'%'),state+small(r.status==='waiting'||r.status==='confirming'?L('Asset holder','资产方'):r.status==='pending'?L('Funder','资金方'):r.status==='repaying'?L('See repayment progress','见还款进展'):L('No current quote action','无当前报价办理')),elapsed(r.locked)+small(r.status==='waiting'?L('Still awaiting the asset holder','仍在等待资产方处理'):L('Stopped when the quote was handled','处理后停止累计'))];
   return [object(r.request)+small(E(r.id))+(r.deal?.record?small(E(r.deal.record.id)):small(L('No disbursement record yet','尚无放款记录'))),E(counter(r)),CF.fmtAmt(r.amount),money(r.settlement,r.ccy)+small(r.deal?.record?L('Submitted','已登记'):L('Agreed amount','约定金额')),state+small(r.fdState==='pending'?L('Funder','资金方'):r.fdState==='confirming'?L('Asset holder','资产方'):L('No current action','无当前办理'))+(r.fdState==='confirming'?small(L('Submitted ','已提交 ')+elapsed(r.waiting)):''),time(r.acceptedAt)];
 }
 function table(){const v=view(),all=filtered(),count=Math.max(1,Math.ceil(all.length/v.size));if(v.page>count&&S.st!=='error'&&S.st!=='loading'&&!tokenError){v.page=count;const q=params();q.set('page',count);history.replaceState(null,'','#'+path()+'?'+q);}const rs=all.slice((v.page-1)*v.size,v.page*v.size),cols=columns(v.tab);
   if(S.st==='error'||v.tab==='tokens'&&(tokenError||!Array.isArray(D.tokens)))return CF.empty(L('List could not be loaded','列表加载失败'),L('Your filters have been preserved. ','已保留当前筛选条件。')+reloadHint(),'');
   if(!all.length&&S.st!=='loading'&&S.st!=='noresult'&&!['filter','secondary','project','query','periodState','tokenType'].some(k=>v[k]))return CF.empty(v.tab==='tokens'?L('No displayable tokens for this company','本企业暂无可展示的代币'):v.tab==='projects'?L('No financing projects yet','尚未创建融资项目'):L('No records yet','暂无记录'),'','');
   let body=S.st==='loading'?'<div role="status" aria-label="'+L('Loading','加载中')+'">'+CF.skelTable(5)+'</div>':(S.st==='error'||v.tab==='tokens'&&(tokenError||!Array.isArray(D.tokens)))?CF.empty(L('List could not be loaded','列表加载失败'),L('Your filters have been preserved. ','已保留当前筛选条件。')+reloadHint(),''):!rs.length?CF.empty(L(S.st==='empty'?'No records yet':'No matching records',S.st==='empty'?'暂无记录':'暂无符合条件的记录'),returnNotice?L('The latest record no longer matches these filters.','最新记录已不符合当前筛选条件。'):L('Try another filter or return later.','可调整筛选条件或稍后再查看。'),b('clear',L('Clear filters','清空筛选'))):'<div class="listbox" id="mc-list" tabindex="0" aria-label="'+E(nm(v.tab))+'"><table class="tbl mc-table" data-kind="'+v.tab+'"><thead><tr>'+[...cols,[L('Actions','操作'),'']].map(([t,kind])=>'<th scope="col" class="'+(kind||'')+'">'+E(t)+'</th>').join('')+'</tr></thead><tbody>'+rs.map(r=>'<tr data-id="'+E(r.id)+'" data-kind="'+v.tab+'" tabindex="0" aria-label="'+E(text(titles[v.tab])+' '+r.id)+'">'+rowValues(v.tab,r).map((c,i)=>'<td data-label="'+E(cols[i][0])+'" class="'+cols[i][1]+'"><div>'+c+'</div></td>').join('')+'<td data-label="'+L('Actions','操作')+'" class="mc-actions"><div>'+link('detail',L('View details','查看详情'),v.tab+'|'+r.id)+'</div></td></tr>').join('')+'</tbody></table></div>';
   const moved=params().get('focus')&&!all.some(r=>r.id===params().get('focus'));
   return (moved?CF.note('',L('The updated record no longer matches these filters.','记录已更新，不再符合当前筛选条件。')+' '+b('clear',L('Clear filters','清空筛选'))):'')+'<div class="mc-caption"><span>'+E(nm(v.tab))+' · '+all.length+L(' records',' 条')+'</span><span>'+L('All amounts are in USD unless marked otherwise.','金额单位为 USD，其他币种另行标注。')+'</span></div>'+body+'<div class="pager"><span class="total">'+all.length+L(' records',' 条记录')+'</span><label for="mc-size">'+L('Rows per page','每页')+'</label><select class="inp" id="mc-size">'+[20,50,100].map(n=>'<option'+(n===v.size?' selected':'')+'>'+n+'</option>').join('')+'</select>'+b('page',L('Previous','上一页'),v.page-1,false,v.page<=1)+'<span>'+v.page+' / '+count+'</span>'+b('page',L('Next','下一页'),v.page+1,false,v.page>=count)+'</div>';
 }
 function gate(){if(S.role==='signed')return '<div class="mc-error">'+CF.empty(L('This page is not available for your current role','该页面不适用于当前身份'),L('You can continue exploring public information.','你可以继续浏览公开信息。'),'<button class="btn primary" data-act="go" data-v="/assets">'+L('Back to assets','返回资产广场')+'</button>')+'</div>';
  return '<div class="mc-error">'+CF.empty(L(S.role==='limited'?'Complete account setup':'Sign in to view your console',S.role==='limited'?'请先完成账户必办事项':'登录后查看我的控制台'),L('Your company information is available after sign-in.','登录后可查看本企业数据。'),'<button class="btn primary" data-act="signin">'+L('Sign in','登录')+'</button>')+'</div>';}
 function listing(){if(!allowed())return gate();if(S.st==='denied')return unavailable();const v=view();return '<div class="mc-root"><div class="page-head"><div><h1 class="page-title">'+L('My console','我的控制台')+'</h1><p class="page-desc">'+L('Balances, financing activity and repayment progress. Business records are shared by company; unread messages are personal.','查看资金概览、融资进展与还款情况。业务记录按企业共享，消息未读数按个人统计。')+'</p></div><div class="page-actions">'+'</div></div>'+summary()+'<section class="card mc-ledger"><div class="mc-tabs" role="tablist" aria-label="'+L('Console records','控制台信息')+'">'+tabs().map(k=>'<button role="tab" aria-selected="'+(k===v.tab)+'" tabindex="'+(k===v.tab?0:-1)+'" data-act="mc-tab" data-v="'+k+'">'+E(nm(k))+'</button>').join('')+'</div><div role="tabpanel" aria-label="'+E(nm(v.tab))+'">'+filters()+table()+'</div></section></div>';}
 function unavailable(){const kind=path().split('/')[2],back=tabs().includes(kind)?'#/console?tab='+kind:'#/console';return '<div class="mc-root mc-error">'+CF.empty(L('Content unavailable','内容不存在或无权访问'),L('Return to your console to view available records.','请返回控制台查看可访问的记录。'),b('list',L('Back to console','返回我的控制台'),back))+'</div>';}
 function section(id,title,body){return {id,title,html:'<section class="card detail-section" id="'+id+'" tabindex="-1"><div class="card-head"><h2>'+E(title)+'</h2></div><div class="card-body">'+body+'</div></section>'};}
 function refs(r){return dl([[L('Business ID','融资业务编号'),copy(r.business||r.id)],[L('Application ID','融资申请编号'),copy(r.request||r.demand)],[L('Project','所属融资项目'),E(text(D.project(r.project)?.name))+'<br>'+copy(r.project)],[L('Asset holder','资产方'),E(owner(r.owner||r.q.owner))],[L('Funder','资金方'),E(fund(r.fund||r.q.fund))]]);}
 function account(a,missing){
   if(!a)return '<p class="mc-small">'+E(missing)+'</p>';
   return '<div class="mc-account-brief">'+Q.accountName(a)+' · '+Q.accountKey(a)+(a.kind==='crypto'?' · USDT / USDC':'')+'</div>';
 }
 /* 授信协议为非必填：有则给份数与提交时间，缺失只说明本笔未提供，不显示待上传或待审核。 */
 function agreements(ownerId,fundId){
   const rows=(Q.data().credits||[]).filter(c=>c.owner===ownerId&&c.fund===fundId).flatMap(c=>(c.history||[]).filter(h=>h.agreements?.length).map(h=>({at:h.at,n:h.agreements.length})));
   if(!rows.length)return '<p class="mc-small">'+L('Not provided for this business.','本笔未提供。')+'</p>';
   return dl([[L('Agreement files','协议文件'),rows.reduce((n,h)=>n+h.n,0)+L(' files · read them in the marketplace',' 份 · 到广场查看')],[L('Latest submitted at','最近提交时间'),time(rows.at(-1).at)]]);
 }
 function periodFacts(r,p){return dl([
   [L('Instalment ID','期次编号'),copy(p.id)],
   [L('Due date','应还日'),date(p.due)],
   [L('Total due','应还合计'),money(p.total)],
   [L('Settlement amount','结算金额'),money(p.settlement,r.q.ccy)],
   [L('Current handler','当前处理方'),p.state==='settled'?L('No current action','无当前办理'):p.state==='pending'?L('Funder · submitted, not yet settled','资金方 · 已提交，仍未结清'):now()<p.open?L('Not yet open','尚未开放'):L('Asset holder','资产方')],
   p.state==='due'&&[L('Payment window opens','还款入口开启时间'),time(p.open)],
   p.overdue>0&&[L(p.state==='settled'?'Historical overdue days':'Overdue days',p.state==='settled'?'历史逾期天数':'逾期天数'),p.overdue+L(' days',' 天')+(p.record?L(' · frozen at submission',' · 提交后冻结'):'')],
   p.record&&[L('Repayment record','还款记录编号'),copy(p.record.id)],
   p.record&&[L('Submitted at','提交时间'),time(p.record.at)],
   p.record?.confirmedAt&&[L('Settled at','结清时间'),time(p.record.confirmedAt)],
   p.record?.account&&[L('Receiving account snapshot','收款账户快照'),account(p.record.account,'')]
 ])+(p.principal?'<p class="mc-small">'+L('Final instalment includes principal.','末期含本金。')+'</p>':'');}
 function repaymentSections(r){
   const out=[],add=(id,title,body)=>out.push(section(id,title,body)),selected=selectedPeriod(r),source=new URLSearchParams((params().get('list')||'').split('?')[1]||''),match=source.get('periodState');
   add('mc-basic',L('Business overview','业务概况'),refs(r)+dl([[L('Disbursement ID','放款编号'),copy(r.deal.record.id)],[L('Receipt confirmed','到账确认时间'),time(r.at)],[L('Business status','业务状态'),badge(r.status)],[L('Plan','计划情况'),badge(r.planState)],[L('Outstanding principal','未偿本金'),money(r.deal.principalBalance)],[L('Principal repaid','累计已还本金'),r.plan?money(r.periods.filter(p=>p.state==='settled').reduce((n,p)=>n+p.principal,0)):'—'],[L('Interest repaid','累计已还利息'),r.plan?money(r.periods.filter(p=>p.state==='settled').reduce((n,p)=>n+p.interest,0)):'—'],r.plan&&[L('Interest start / final repayment date','起息日 / 最终还款日'),date(r.plan.start)+' / '+date(r.plan.end)],r.plan?.settledAt&&[L('Settled at','结清时间'),time(r.plan.settledAt)]]));
   if(planError)add('mc-plan',L('Repayment summary','还款摘要'),CF.empty(L('Repayment information unavailable','还款信息暂不可用'),L('Receipt confirmation is preserved. ','到账确认结果已保留。')+reloadHint(),''));
   else if(!r.plan)add('mc-plan',L('Repayment summary','还款摘要'),CF.note('',L('Receipt is confirmed. The repayment schedule is being generated.','已确认到账，还款计划生成中。')));
   else{
     add('mc-current',L('Current instalment','本期应还'),r.plan.settledAt?CF.note('ok',L('All instalments are settled.','本笔全部期次已结清。')):r.current?'<div class="mc-current-amount"><div><span>'+L('Instalment ','第 ')+r.current.seq+L('',' 期')+'</span><strong>'+money(r.current.settlement,r.q.ccy)+'</strong></div><div class="mc-current-date"><span>'+L('Due date','应还日')+'</span><div>'+date(r.current.due)+'</div></div></div>':CF.note('',L('No instalments awaiting repayment.','暂无待还期次。')));
     const relevant=r.periods.filter(p=>p.id===r.current?.id||p.state==='pending'||p.state!=='settled'&&p.overdue>0||p.id===selected?.id);
     add('mc-periods',L('Instalments to review','相关期次'),(r.overdue?CF.note('warn',L('Overdue instalments remain unsettled. Submitted instalments await the funder; their overdue days stay frozen.','存在尚未结清的逾期期次；已提交期次待资金方确认，逾期天数保持冻结。')):'')+(selected?CF.note('',L('Reading selected instalment: ','当前选定原期次：')+E(selected.id)):'')+relevant.map(p=>'<article class="mc-record" data-selected="'+(selected?.id===p.id)+'" id="mc-period-'+E(p.id)+'"><div class="mc-record-head"><b>'+L('Instalment ','第 ')+p.seq+L('',' 期')+'</b>'+badge(p.status)+'</div>'+periodFacts(r,p)+(within(match,p.status)&&match?'<p class="mc-small">'+L('Matches the list filter','匹配列表期次筛选')+'</p>':'')+b('period',selected?.id===p.id?L('Selected for reading','已选定阅读'):L('Select this instalment','选择此期阅读'),p.id,false,selected?.id===p.id)+'</article>').join('')+(r.pending.length?'<p class="mc-small">'+L('Confirmation has no deadline. Submission does not confirm receipt.','确认没有时限，提交不代表已确认到账。')+'</p>':'')+'<p class="mc-small">'+L('Read the complete schedule and historical records in the lending marketplace.','完整计划及其他未来、历史期次请前往借贷广场阅读。')+'</p>');
   }
   add('mc-account',L('Funder’s receiving account','资金方收款账户'),account(r.deal.record.account,L('Awaiting submission by the funder','待资金方提交')));
   return out;
 }
 function details(k,r){
   const out=[],add=(id,t,body)=>out.push(section(id,t,body));
   if(k==='tokens'){
     add('mc-basic',L('Token information','代币信息'),dl([[L('Token ID','代币编号'),copy(r.id)],[L('Token type','代币类型'),E(text(D.type(r.kind).label))],[L('Quantity','代币数量'),CF.fmtAmt(r.units)],[L('Token value','代币价值'),money(r.value)],[L('Buyer','买方企业'),E(text(r.buyer))],[L('Receivable period','底层应收账款账期'),date(r.from)+' → '+date(r.due)],[L('Issued at','签发时间'),time(r.issued)],[L('Token status','代币状态'),badge(r.status)],[L('Pledge status','质押状态'),badge(r.pledged?'pledged':'unpledged')]])+(!r.valid?CF.note('',L('This token is void and does not contribute to eligible pledged value.','该代币已失效，不计入有效质押。')):''));
     const reach=destinations(k,r).projects,own=new Set(normalized('projects').map(p=>p.id));
     add('mc-project',L('Associated project','关联融资项目'),reach.length?reach.map(p=>dl([[L('Project','融资项目'),E(text(p.name))],[L('Project ID','项目编号'),copy(p.id)]])+(own.has(p.id)?'<p>'+link('detail',L('View console project details','查看控制台项目详情'),'projects|'+p.id)+'</p>':'')).join(''):CF.empty(destinations(k,r).reason,''));
   }else if(k==='projects'){
     const n=r.n;
     add('mc-basic',L('Project overview','项目概况'),dl([[L('Project ID','融资项目编号'),copy(r.id)],[L('Project name','融资项目名称'),E(text(r.name))],[L('Token type','代币类型'),E(text(D.type(r.kind).label))],[L('Project status','项目状态'),badge(r.status)],[L('Project deadline','项目有效截止日'),date(r.expires)],[L('Project term','项目期限'),r.term+L(' months',' 个月')],[L('Created at','创建时间'),time(r.created)],[L('First published','首次发布时间'),time(r.published)],[L('Pledge contract address','质押合约地址'),r.contract?copy(r.contract):'—'],[L('Repayment type','还款方式'),E(text(r.repay))],[L('Reference settlement currency','参考结算币种'),E((r.settle||[]).join(' / '))||'—'],[L('SPV','SPV 机构名称'),E(text(r.spv))],r.closeReason&&[L('Close reason','关闭原因'),E(closeReasonText(r.closeReason))]]));
     add('mc-coverage',L('Collateral and pledge sufficiency','质押与质押情况'),dl([[L('Total pledged value','总质押额'),money(n.total)],[L('Pending review value','待审质押额'),money(n.pendingValue)],[L('Eligible pledge amount','有效质押额'),money(n.limit)],[L('Current request','本轮融资需求'),D.current(r)?money(r.amount):L('No active request','暂无当前需求')],[L('Outstanding financing','已融资余额'),money(r.balance)],[L('Project pledge rate','项目质押率'),Math.round(n.rate*1000)/10+'%'],[L('Eligible collateral value','有效质押价值'),money(n.value)+' · '+n.valid.length+L(' tokens',' 张')],[L('Tokens inside the contract','合约内代币张数'),n.pool.length],[L('Pledge sufficiency','质押情况'),badge(n.grade)],[L('Pledge shortfall','质押缺口'),money(n.gap)],[L('Additional asset value needed','需追加资产价值'),money(n.rate?n.gap/n.rate:0)],[L('Void pledged tokens','已质押失效代币'),n.pool.filter(t=>!t.valid).length],[L('Withdrawable token value','可提取代币价值'),r.l8ReleasePending?L('Release result pending','释放结果待取得'):money(D.tokens.filter(t=>t.releasedFrom===r.id&&t.pledge==='released').reduce((n,t)=>n+t.value,0)+n.withdraw)]]));
     const application=params().get('application'),d=application?r.demands.find(d=>d.id===application):D.current(r);
     const review=n.waiting.filter(t=>D.appOf(r,t)?.state==='review'),rejected=n.waiting.filter(t=>D.appOf(r,t)?.state==='rejected');
     add('mc-review',L('Pledge review summary','质押审核摘要'),dl([[L('Awaiting review','审核尚未裁定'),money(review.reduce((a,t)=>a+t.value,0))],[L('Rejected, still pledged','已驳回未解押'),money(rejected.reduce((a,t)=>a+t.value,0))]])+(r.l8ReleasePending?CF.note('',L('Execution result pending verification. Contact platform support.','执行结果待核实，请联系平台客服人员。')):''));
     add('mc-rounds',application?L('Selected application','选定原融资申请'):L('Current application','当前融资申请'),d?'<article id="mc-application-'+E(d.id)+'">'+dl([[L('Application ID','融资申请编号'),copy(d.id)],[L('Application amount','申请金额'),money(d.amount)],[L('Published at','本轮发布时间'),time(d.at)],[L('Application status','申请状态'),badge(d.state)],[L('Current handler','当前处理方'),d.state==='open'?L('Awaiting an institution quote','等待机构报价'):d.state==='quoted'?L('Asset holder','资产方'):d.state==='funding'?L('Financing parties','融资双方'):L('No current action','无当前办理')],d.reason&&[L('End reason','终结原因'),E(reasonText(d.reason))]])+'</article>':CF.empty(L('No current application','暂无当前需求'),''));
     const current=d&&Q.currentQuote(r,d.id);
     if(current&&party(current))add('mc-quote',L('Current / accepted quote','当前有效 / 已接受报价'),dl([[L('Institution','机构全称'),E(fund(current.fund))],[L('Business ID','融资业务编号'),copy(current.id)],[L('Amount / annual rate','金额 / 年化利率'),money(current.settlement,current.ccy)+' · '+E(current.rate)+'%'],[L('Quoted at','报价时间'),time(current.at)],current.state==='waiting'&&[L('Lock starts / elapsed','锁定起点 / 已锁定时长'),time(current.at)+' / '+elapsed(now()-current.at)]]));
   }else if(k==='credits'){
     add('mc-basic',L('Credit facility','授信信息'),dl([[L('Credit ID','授信编号'),copy(r.id)],[L('Counterparty','对方企业'),E(counter(r))],[L('Status','额度状态'),badge(r.status)],[L('First established','首次核定时间'),time(r.first)],[L('Valid until','有效期至'),date(r.expires)]]));
     add('mc-credit',L('Credit usage','授信使用情况'),dl([[L('Credit limit','授信额度'),money(r.total)],[L('Principal occupied','授信占用额'),money(r.principal)],[L('Quotes in transit','在途报价金额'),money(r.transit)],[L('Total used','授信已用额合计'),money(r.used)],[L('Available credit','可用授信'),money(r.available)]])+CF.note('',L('Shared across this company’s projects. Available credit is not a financing commitment.','本授信由该企业跨项目共用，可用授信不等于可融承诺。'))+(r.status==='expired'?CF.note('',L('Expired. Existing obligations continue; a new quote requires reassessment in its original flow.','已到期，存量业务照常履约；再次报价须在报价流程内重新核定。')):''));
     if(S.role==='fund')add('mc-note',L('Internal remark','内部备注'),'<p>'+E(r.history?.at(-1)?.remark||L('No internal remark','暂无内部备注'))+'</p>');
   }else if(k==='loans'||k==='quotes'){
     const x=r.deal;
     add('mc-basic',L('Business identity','业务信息'),refs(r));
     add('mc-amount',L('Agreed amounts','约定金额'),dl([[L('Financing amount','融资金额'),money(r.amount)],[L('Settlement amount','结算金额'),money(r.settlement,r.ccy)]]));
     if(k==='quotes'){
       add('mc-quote',L('Original quote result','原报价结果'),dl([[L('Annual rate','年化利率'),E(r.rate)+'%'],[L('Repayment type','还款类型'),E(text(D.REPAY))],[L('Repayment date','最终还款日'),date(r.repay)],[L('Locking institution','锁定机构'),E(fund(r.fund))],[L('Lock started','锁定起点'),time(r.at)],[L('Time locked','已锁定时长'),elapsed(r.locked)],[L('Quote submitted','报价提交时间'),time(r.at)],[L('Original quote result','原报价结果'),['waiting','rejected','expired'].includes(r.state)?badge(({expired:'quoteEnded'})[r.state]||r.state):L('Accepted','已接受')],[L('Current business stage','当前业务阶段'),badge(r.status)],[L('Result time','处理时间'),r.done?time(r.done):L('Not handled','尚未处理')],r.reason&&[L('Reason','终结原因'),E(reasonText(r.reason))]]));
       const n=D.numbers(D.project(r.project));add('mc-risk',L('Project pledge summary','项目质押摘要'),dl([[L('Pledge sufficiency','质押情况'),badge(n.grade)],n.gap>0&&[L('Pledge gap / additional asset value','质押缺口 / 需追加资产价值'),money(n.gap)+' / '+money(n.rate?n.gap/n.rate:null)]]));
       if(x)add('mc-related',L('Subsequent business','同笔后续业务'),link('detail',L('View disbursement summary','查看放款摘要'),'loans|'+r.id));
     }else if(x){
       add('mc-progress',L('Disbursement progress','放款进展'),dl([[L('Accepted at','接受报价时间'),time(r.acceptedAt)],[L('Funder registers disbursement','资金方登记放款'),x.record?time(x.record.at):L('Not submitted','未提交')],[L('Asset holder confirms receipt','资产方确认到账'),x.confirmedAt?time(x.confirmedAt):L('Not confirmed','未确认')],[L('Disbursement record','放款记录编号'),x.record?copy(x.record.id):L('No disbursement record yet','尚无放款记录')],[L('Current handler','当前处理方'),r.fdState==='pending'?L('Funder','资金方'):r.fdState==='confirming'?L('Asset holder','资产方'):L('No current disbursement action','无当前放款办理')]]));
       add('mc-agreement',L('Credit agreement','授信协议'),agreements(x.owner,x.fund));
       add('mc-asset-account',L('Asset holder’s disbursement receiving account','资产方放款收款账户'),account(x.account,L('No receiving account on record','暂无收款账户记录')));
       add('mc-account',L('Funder’s receiving account','资金方收款账户'),account(x.record?.account,L('Awaiting submission by the funder','待资金方提交')));
       if(x.state==='waiting')add('mc-waiting',L('Awaiting receipt confirmation','等待到账确认'),CF.note('',L('Confirmation has no deadline. The repayment schedule is not generated, in-flight amounts stay occupied and collateral is not released until receipt is confirmed. If funds have not arrived, leave the business unconfirmed and contact the counterparty or platform support.','确认没有时限。确认前还款计划不生成，在途金额继续占用，质押不释放。尚未到账请保持未确认，并联系对方或平台客服人员。')));
       if(['confirmed','settled'].includes(x.state))add('mc-related',L('Related repayment','关联还款业务'),link('detail',L('View repayment summary','查看同笔还款摘要'),'repayments|'+r.id));
     }
   }else{return repaymentSections(r);}

   return out;
 }
 function detail(k){
   if(!allowed())return gate();
   if(k==='tokens'&&(tokenError||!Array.isArray(D.tokens)))return '<div class="mc-root mc-error">'+CF.empty(L('Token details unavailable','代币详情暂不可用'),reloadHint(),'')+'</div>';
   const r=find(k,params().get('id'));if(!r||!tabs().includes(k)&&!(k==='quotes'&&S.role==='asset')||S.st==='denied')return unavailable();
   if(k==='repayments'&&params().get('period')&&!r.periods.some(p=>p.id===params().get('period')))return unavailable();
   if(k==='projects'&&params().get('application')&&!r.demands.some(d=>d.id===params().get('application')))return unavailable();
   if(['loading','error'].includes(detailState))return '<div class="mc-root mc-error">'+(detailState==='loading'?'<div role="status">'+CF.skelTable(6)+'</div>':CF.empty(L('Details could not be loaded','详情加载失败'),reloadHint(),''))+'</div>';
   const sections=details(k,r),amount=k==='tokens'?r.value:k==='projects'?r.balance:k==='credits'?r.available:k==='repayments'?r.deal.principalBalance:r.amount;
   const metric=k==='tokens'?L('Token value','代币价值'):k==='projects'?L('Financed balance','已融资余额'):k==='credits'?L('Available credit','可用授信'):k==='repayments'?L('Outstanding principal','未偿本金'):L('Financing amount','融资金额');
   const second=k==='repayments'?stat(L('Disbursed amount','放款金额'),statMoney(r.deal.settlement,r.q.ccy),'','info'):k==='projects'?stat(L('Eligible pledge amount','有效质押额'),statMoney(r.n.limit),'','info'):k==='credits'?stat(L('Credit limit','授信额度'),statMoney(r.total),'','info'):k==='tokens'?stat(L('Receivable due','应收账款到期日'),date(r.due)):stat(r.deal?.record?L('Disbursed amount','放款金额'):L('Agreed disbursement amount','约定放款金额'),statMoney(r.settlement,r.ccy),'','info');
   return '<div class="mc-root mc-detail"><div class="page-head"><div><h1 class="page-title" tabindex="-1">'+E(text(titles[k]))+'</h1><div class="mc-detail-meta">'+copy(k==='repayments'?r.request:r.id)+badge(k==='loans'?r.fdState:r.status)+'</div></div><div class="mc-quick-actions" aria-label="'+L('Project navigation','项目导航')+'">'+controls(k,r)+'</div></div>'+(detailState==='stale'?CF.note('warn',L('The business state changed. The previous action is no longer available.','业务状态已变化，原操作已不可用。')):'')+'<div class="stat-strip mc-detail-metrics">'+stat(metric,statMoney(amount),'','accent')+second+'</div><nav class="mc-chapters" aria-label="'+L('On this page','本页章节')+'">'+sections.map((x,i)=>'<button type="button" data-act="mc-section" data-v="'+x.id+'"'+(!i?' aria-current="location"':'')+'>'+E(x.title)+'</button>').join('')+'</nav><div class="detail-stack">'+sections.map(x=>x.html).join('')+'</div></div>';
 }
 // Reading bridge: only original source readers, no action deep links.
 function sourceTarget(){
   const q=params(),k=q.get('mcKind'),id=q.get('mcObject');
   if(!path().startsWith('/project/')||!kinds.includes(k)||!id)return null;
   const r=find(k,id),project=decodeURIComponent(path().slice('/project/'.length));
   if(!r||!destinations(k,r).projects.some(p=>p.id===project))return {invalid:true};
   const app=q.get('mcApplication'),period=q.get('mcPeriod'),record=q.get('mcRecord');
   if(k==='projects'&&app&&!r.demands.some(d=>d.id===app))return {invalid:true};
   if(k==='repayments'&&(period&&!r.periods.some(p=>p.id===period)||record&&!r.periods.some(p=>p.id===period&&p.record?.id===record)))return {invalid:true};
   if(k==='loans'&&record&&r.deal?.record?.id!==record)return {invalid:true};
   if(['loans','repayments','quotes'].includes(k)&&app&&r.request!==app)return {invalid:true};
   return {k,r,app,period};
 }
 function queueSourceReading(){
   if(!path().startsWith('/project/')){sourceOpened='';sourceFault='';return;}
   const key=location.hash+'|'+S.role+'|'+JSON.stringify(S.party);
   if(sourceOpened===key||!params().has('mcKind'))return;
   sourceOpened=key;sourceFault='';
   setTimeout(()=>{
     if(key!==location.hash+'|'+S.role+'|'+JSON.stringify(S.party))return;
     const t=sourceTarget();
     if(!t||t.invalid){sourceFault='invalid';CF.render();CF.openLayer('modal','mc-source-unavailable');return;}
     if(params().get('mcFallback')==='1'){sourceFault='fallback';CF.render();return;}
     const {k,r,app,period}=t;
     if(k==='projects'&&app||k==='quotes'){
       if(Q.openRequest)Q.openRequest(app||r.request,{selected:k==='quotes'?r.id:undefined});
       else sourceFault='fallback';
     }else if(k==='loans'){
       if(CF.L7?.openDetail)CF.L7.openDetail(r.id);else sourceFault='fallback';
     }else if(k==='repayments'){
       if(CF.L8?.openDetail)CF.L8.openDetail(r.id,{period});else sourceFault='fallback';
     }
     if(sourceFault)CF.render();
   },60);
 }
 function backBanner(){
   const q=params(),back=safeRoute(q.get('mcReturn'));if(!back||!allowed())return '';
   const ids=[q.get('mcApplication'),q.get('mcObject'),q.get('mcPeriod'),q.get('mcRecord')].filter(Boolean);
   return '<div class="mc-return"><div><span>'+L('Opened from My console','来自我的控制台')+'</span>'+(sourceFault==='invalid'?'<p>'+L('Content does not exist or is not accessible.','内容不存在或无权访问。')+'</p>':sourceFault==='fallback'?'<p>'+L('Only this project could be opened. The original record has not been located.','当前仅到达同一项目，尚未定位原记录。')+'</p><div class="mc-small">'+E(ids.join(' · '))+'</div>':'<p class="mc-small">'+L('Read the original record here. To handle business, close the record and use the project’s existing actions.','在此阅读原记录；如需办理，请关闭记录并从项目既有入口选择。')+'</p>')+'</div>'+b('return',L('Return to console details','返回控制台详情'),back)+'</div>';
 }
 function reviewTools(){return '<div class="grp"><h5>'+L('Console partial faults','控制台局部故障')+'</h5>'+[['stats','Summary error','单项统计失败'],['tokens-error','Token snapshot error','代币读取失败'],['association-error','Association error','关联读取失败'],['association-none','No project association','无关联项目'],['association-denied','No accessible project','无可访问关联项目'],['association-unsupported','Project-only fallback','仅同项目定位降级'],['plan-error','Plan unavailable','还款计划加载失败'],['session','Session expired','登录失效']].map(([v,en,zh])=>b('scenario',L(en,zh),v)).join('')+'<p class="hint">'+L('Fixtures are shared with the marketplace; no real payment is made.','演示数据与广场共用；不发起真实付款。')+'</p></div>';}

 CF.review.register('P-MC-01',{group:['My console','我的控制台'],route:'/console',parties:true,
   scenarios:()=>allowed()?tabs().map(k=>({id:k,label:names[k],route:'/console?tab='+k,description:['Open this record category','定位此类业务清单']})):[],
   states:()=>allowed()?['default','loading','empty','noresult','error','denied']:['default'],
   reset(){S.st='default';statsError=tokenError=associationError=planError=false;associationScene='normal';}});
 kinds.forEach((k,i)=>CF.review.register('P-MC-0'+(i+2),{
   group:['My console · details','我的控制台 · 详情'],parties:true,visible:()=>tabs().includes(k),
   scenarios:()=>allowed()?[...new Set(normalized(k).map(r=>r.status))].map(st=>{const r=normalized(k).find(r=>r.status===st);return {id:st,label:labels[st]||[st,st],route:r?detailHref(k,r.id):null,available:!!r,description:[text(titles[k])+' · '+r.id,text(titles[k])+' · '+r.id]};}):[],
   states:()=>allowed()?['default','loading','error',{id:'stale',label:['Action expired','动作失效'],group:'business'},'denied']:['default'],
   route:()=>{const r=normalized(k)[0];return r?detailHref(k,r.id):null;},
   get:()=>S.st==='denied'?'denied':detailState==='normal'?'default':detailState,
   set(value){S.st=value==='denied'?'denied':'default';detailState=['loading','error','stale'].includes(value)?value:'normal';},
   reset(){S.st='default';detailState='normal';statsError=tokenError=associationError=planError=false;associationScene='normal';}
 }));

 const mod={...old,id:'my-console-v14',pages:['P-MC-01',...kinds.map((_,i)=>'P-MC-0'+(i+2))],dict,
   content(id){if(id==='P-MC-01')return listing();const i=kinds.findIndex((_,i)=>id==='P-MC-0'+(i+2));return detail(kinds[i]);},
   breadcrumbRoute(id){return id==='P-MC-01'?listRoute(path().split('/')[2]||tabs()[0]).slice(1):old.breadcrumbRoute?.(id);},
   beforeRender(){old.beforeRender?.();if(lastRole!==S.role+'|'+JSON.stringify(S.party)){S.layer=null;lastRole=S.role+'|'+JSON.stringify(S.party);detailState='normal';copyValue='';sourceOpened='';}},
   // Measure before the first target scroll: a wrapped portal header is taller on narrow screens.
   afterRender(){old.afterRender?.();queueSourceReading();requestAnimationFrame(()=>{syncConsoleNav();syncChapters();});const current=location.hash;if(current!==lastHash){lastHash=current;if(path().startsWith('/console')){const q=params();restoring=true;setTimeout(()=>{syncChapters();window.scrollTo(0,Math.max(0,+q.get('y')||0));const box=document.getElementById('mc-list');if(box)box.scrollTop=Math.max(0,+q.get('scroll')||0);const id=q.get('focus');if(id)document.querySelector('[data-id="'+CSS.escape(id)+'"]')?.focus({preventScroll:true});else document.querySelector('.mc-root .page-title')?.focus({preventScroll:true});if(!q.has('y')){const k=path().split('/')[2],r=k==='repayments'&&find(k,q.get('id')),p=r&&selectedPeriod(r);const el=p?document.getElementById('mc-period-'+p.id):q.get('application')?document.getElementById('mc-application-'+q.get('application')):null;el?.scrollIntoView({block:'start'});}restoring=false;syncChapters();},0);}}
     if(focusAfter){const key=focusAfter;focusAfter='';setTimeout(()=>document.getElementById('mc-'+key)?.focus({preventScroll:true}),0);}
   },
   demo(){return (old.demo?.()||'')+reviewTools();},
   onAct(a,v,e){
     if(!a.startsWith('mc-'))return old.onAct?.(a,v,e)||false;
     const key=a.slice(3);
     if(key==='detail'){const [k,id]=v.split('|');goDetail(k,id);}
     if(key==='period'){const q=params();q.set('period',v);q.delete('y');navigate('#'+path()+'?'+q);}
     if(key==='jump'){const [k,id]=v.split('|');jump(k,id);}
     if(key==='tab'){returnNotice=false;setView({tab:v,filter:'',secondary:'',project:'',tokenType:'',query:'',periodState:'',sort:v==='credits'?'available-asc':'newest',page:1});}
     if(key==='clear'){S.st='default';returnNotice=false;S.menu=null;setView({filter:'',secondary:'',project:'',tokenType:'',query:'',periodState:'',page:1});}
     if(key==='search')setView({query:document.getElementById('mc-query').value.trim(),page:1});

     if(key==='page')setView({page:Math.max(1,+v)});


     if(key==='list'||key==='return'){returnNotice=key==='return';navigate(safeRoute(v)||'#/console');}
     if(key==='section'){chapterTarget=v;const el=document.getElementById(v);el?.focus({preventScroll:true});el?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
     if(key==='copy'){copyValue=v;const fallback=()=>CF.openLayer('modal','mc-copy');try{navigator.clipboard?.writeText(v).then(()=>CF.toast(L('Copied','已复制')),fallback)||fallback();}catch(_){fallback();}}
     if(key==='scenario'){planError=v==='plan-error';statsError=v==='stats';tokenError=v==='tokens-error';associationError=v==='association-error';detailState=['loading','error','stale'].includes(v)?v:'normal';if(v.startsWith('association-'))associationScene=v.slice(12);else associationScene='normal';if(v==='session'){S.role='guest';S.layer=null;S.demo=false;}CF.render();}
     return true;
   },
   layers:{...old.layers,'mc-source-unavailable':()=>({title:L('Content unavailable','内容不存在或无权访问'),html:'<p>'+L('Return to your console to view accessible records.','请返回控制台查看可访问记录。')+'</p>',foot:b('return',L('Return to console details','返回控制台详情'),safeRoute(params().get('mcReturn'))||'#/console')}),'mc-copy':()=>({title:L('Copy reference','复制编号'),html:'<input class="inp mc-copy-value" readonly value="'+E(copyValue)+'" aria-label="'+L('Reference number','完整编号')+'"><p>'+L('Select the text and copy it.','请选择文本后复制。')+'</p>',foot:'<button class="btn" data-act="closelayer">'+L('Close','关闭')+'</button>'})}
 };
 CF.define(CF.LSView=mod);
 const composed=mod.content;mod.content=id=>(id==='P-LS-01'||id==='P-LS-02'?backBanner():'')+composed(id);
 document.addEventListener('change',e=>{
   const group=e.target.dataset.filter;
   if(group&&group.startsWith('mc-')&&path()==='/console'){
     const key=group.slice(3);
     setView({[key]:Array.from(document.querySelectorAll('[data-filter="'+group+'"]')).filter(b=>b.checked).map(b=>b.value).join(','),page:1});
     return;
   }
   if(e.target.id==='mc-targetProject'&&path().startsWith('/console/')){const q=params();q.set('targetProject',e.target.value);history.replaceState(null,'','#'+path()+'?'+q);CF.render();document.getElementById('mc-targetProject')?.focus();return;}if(path()!=='/console'||!e.target.id.startsWith('mc-'))return;const k=e.target.id.slice(3);if(['filter','secondary','project','sort','size','periodState','tokenType'].includes(k))setView({[k]:k==='size'?+e.target.value:e.target.value,page:1});});
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
 // Keep the console entry visible when the shared header uses a horizontal nav.
 function syncConsoleNav(){
   if(!document.querySelector('.mc-root'))return;
   const nav=document.querySelector('.portal-nav'),entry=nav?.querySelector('a[href="#/console"]');
   if(!entry||nav.scrollWidth<=nav.clientWidth)return;
   const box=nav.getBoundingClientRect(),item=entry.getBoundingClientRect();
   if(item.right>box.right)nav.scrollLeft+=item.right-box.right;
   else if(item.left<box.left)nav.scrollLeft+=item.left-box.left;
 }
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
 window.addEventListener('scroll',scheduleChapters,{passive:true});window.addEventListener('resize',()=>{chapterTarget='';syncConsoleNav();scheduleChapters();});
 window.addEventListener('wheel',()=>{chapterTarget='';},{passive:true});window.addEventListener('touchmove',()=>{chapterTarget='';},{passive:true});
 window.addEventListener('pointerdown',e=>{if(e.target===document.documentElement||e.target===document.body)chapterTarget='';});
 window.addEventListener('keydown',e=>{if(['PageDown','PageUp','ArrowDown','ArrowUp','Home','End',' '].includes(e.key)&&!e.target.closest('.mc-chapters'))chapterTarget='';});
 window.addEventListener('hashchange',()=>{chapterTarget='';planError=false;});
 const headerObserver=new ResizeObserver(scheduleChapters);headerObserver.observe(document.querySelector('.portal-head'));
 CF.MC={normalized,find,destinations,safeRoute,get state(){return detailState;},attach(){CF.MCSeedPeriods?.();CF.render();}};
})(window.CF);
