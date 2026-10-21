/* WS-378. Read-only console on the current volumes: no business deadline anywhere, two-step disbursement,
 * company-account receiving snapshots and per-chain transaction identifiers. */
(function(CF){
 'use strict';
 const S=CF.S,D=CF.LS,Q=CF.CQ,L=CF.L,E=CF.esc,old=CF.LSView,H=3600000,DAY=24*H;
 const kinds=['tokens','projects','credits','loans','repayments','quotes'];
 const names={tokens:['Tokens','代币列表'],projects:['Financing projects','融资项目'],credits:['Credit facilities','授信明细'],loans:['Disbursements','融资放款信息'],repayments:['Repayments','还款信息'],quotes:['My quotes','我的报价']};
 const titles={tokens:['Token details','代币详情'],projects:['Project details','融资项目详情'],credits:['Credit details','授信详情'],loans:['Disbursement details','融资放款详情'],repayments:['Repayment details','还款业务详情'],quotes:['Quote details','报价详情']};
 const labels={review:['Pending review','待审核'],returned:['Returned','已退回'],available:['Available','可用'],valid:['Valid','有效'],void:['Void','失效'],pledged:['Pledged','已质押'],unpledged:['Not pledged','未质押'],draft:['Draft','草稿'],raising:['Fundraising','募集中'],locked:['Locked','已锁定'],financing:['Financing','融资中'],closed:['Closed','已关闭'],settled:['Settled','已结清'],surplus:['Pledge surplus','质押充足'],balanced:['Pledge balanced','质押持平'],short:['Pledge shortfall','质押不足'],effective:['Effective','生效中'],expired:['Expired','已到期'],pending:['Awaiting disbursement','待放款'],confirming:['Awaiting receipt confirmation','待放款确认'],repaying:['Repaying','还款中'],waiting:['Awaiting acceptance','待接受'],accepted:['Accepted','已接受'],rejected:['Rejected','已拒绝'],quoteEnded:['Quote invalidated','报价已失效'],due:['Pending repayment','待还款'],repayConfirming:['Awaiting repayment confirmation','待还款确认'],initial:['Initial plan','初始版'],final:['Final plan','定稿版'],generating:['Plan generating','计划生成中'],open:['Awaiting quotes','待报价'],quoted:['Awaiting quote confirmation','已报价待确认'],funding:['Funding','放款中'],funded:['Disbursed','已放款'],ended:['Invalidated / closed','已失效／已关闭']};
 const kindNames={tokens:['Token','代币'],projects:['Financing project','融资项目'],credits:['Credit facility','授信'],loans:['Disbursement','融资放款'],repayments:['Repayment','还款'],quotes:['Quote','报价']};
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
 let pendingError=false,usageError=false,usagePage=1,saveFailOnce=false,modify={},detailState='normal',planError=false,statsError=false,tokenError=false,associationError=false,focusAfter='',lastHash='',lastRole=S.role+'|'+JSON.stringify(S.party),restoring=false,copyValue='',returnNotice=false;
 CF.PAGES['P-MC-01'].retainList=true;
 const dict={en:{},zh:{}};
 kinds.forEach((k,i)=>{const id='P-MC-0'+(i+2),key='mcDetail'+i;CF.PAGES[id]={end:'asset',layout:'portal',parent:'P-MC-01',crumbKey:key,auth:true,retainList:true};CF.ENTRY[id]='/console/'+k;dict.en[key]=titles[k][0];dict.zh[key]=titles[k][1];});
 function safeRoute(raw,detail=true){
   if(!raw||raw.length>12000||!/^#\/console(?:\?|$|\/(tokens|projects|credits|loans|repayments|quotes)\?)/.test(raw))return '';
   const p=raw.slice(1).split('?')[0];if(p!=='/console'&&(!detail||!kinds.some(k=>p==='/console/'+k)))return '';
   const q=new URLSearchParams(raw.split('?')[1]||'');if(p!=='/console'&&!q.get('id'))return '';
   const clean=new URLSearchParams();['tab','pending','filter','secondary','project','sort','size','page','y','scroll','focus','id','period','application','query','periodState','targetProject','tokenType'].forEach(k=>{if(q.has(k))clean.set(k,q.get(k).slice(0,160));});
   if(detail&&q.has('list')){const list=safeRoute(q.get('list'),false);if(list)clean.set('list',list);}
   return '#'+p+(clean.size?'?'+clean:'');
 }
 function view(){const q=params(),tab=tabs().includes(q.get('tab'))?q.get('tab'):tabs()[0];return {tab,pending:pendingTabs().includes(tab)&&q.get('pending')==='1'?'1':'',filter:q.get('filter')||'',secondary:q.get('secondary')||'',project:q.get('project')||'',tokenType:q.get('tokenType')||'',query:q.get('query')||'',periodState:q.get('periodState')||'',sort:q.get('sort')||(tab==='credits'?'available-asc':'newest'),size:[20,50,100].includes(+q.get('size'))?+q.get('size'):20,page:Math.min(100000,Math.max(1,parseInt(q.get('page'))||1))};}
 function listRoute(k){return safeRoute(params().get('list'),false)||'#/console?tab='+k;}
 function detailHref(k,id){if(k==='projects'){const r=find(k,id),p=r&&D.project(r.id);if(p)return sourceHref(k,r,p,{back:location.hash});}return '#/console/'+k+'?'+new URLSearchParams({id,list:path()==='/console'?location.hash:listRoute(k)});}
 function snapshot(){
   const q=params();q.set('y',Math.round(window.scrollY));q.set('scroll',Math.round(document.getElementById('mc-list')?.scrollTop||0));
   const f=document.activeElement?.closest('[data-id]')?.dataset.id;if(f)q.set('focus',f);
   const hash='#'+path()+'?'+q;try{history.replaceState(null,'',hash);}catch(_){}return hash;
 }
 function navigate(hash){S.layer=null;S.st='default';detailState='normal';location.hash=hash;}
 function goDetail(k,id){
   /* 融资项目的详情就是借贷广场项目详情；资产方待接受的使用记录到借贷广场原申请。 */
   if(k==='projects')return openSource('projects',id);
   if(k==='quotes-source')return openSource('quotes',id);
   let list=path()==='/console'?snapshot():listRoute(k);if(path()==='/console'){const q=new URLSearchParams(list.split('?')[1]||'');q.set('focus',id);list='#/console?'+q;}navigate('#/console/'+k+'?'+new URLSearchParams({id,list}));}
 function setView(patch){const v={...view(),...patch};focusAfter=Object.keys(patch)[0];navigate('#/console?'+new URLSearchParams(v));}
 function normalized(k){
   if(!allowed())return [];
   if(CF.L7)void CF.L7.deals;
   const related=Q.data().quotes.filter(party),ownProjects=D.projects.filter(p=>D.mine(p));
   if(k==='tokens')return tokenSnapshot();
   if(k==='projects')return S.role==='asset'?ownProjects.map(p=>({...p,project:p.id,status:p.state,n:D.numbers(p),amount:D.current(p)?.amount??null,at:p.created||p.published})):[];
   if(k==='credits')return Q.data().credits.filter(c=>S.role==='asset'?c.owner===D.me():c.fund===Q.fund()).map(c=>{const transit=Q.data().quotes.filter(q=>q.owner===c.owner&&q.fund===c.fund&&['waiting','funding'].includes(q.state)).reduce((n,q)=>n+q.amount,0),expired=Date.parse(c.expires+'T23:59:59Z')<now();return {...c,status:expired?'expired':'effective',transit,available:Math.max(0,c.total-c.principal-transit),used:c.principal+transit,at:c.first};});
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
 function filtered(){const v=view();let rows=S.st==='empty'?[]:normalized(v.tab);rows=rows.filter(r=>matches(r,v)&&(!v.pending||pendingError||pendingItems(v.tab,r).length));
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
 function sourceHref(k,r,p,o={}){
   const q=new URLSearchParams({mcReturn:o.back||location.hash,mcKind:k,mcObject:r.id});
   if(associationScene==='unsupported')q.set('mcFallback','1');
   const application=k==='projects'?o.application:r.request;
   if(application)q.set('mcApplication',application);
   if(k==='repayments'&&o.period){q.set('mcPeriod',o.period.id);if(o.period.record)q.set('mcRecord',o.period.record.id);}
   if(k==='loans'&&r.deal?.record)q.set('mcRecord',r.deal.record.id);
   return '#/project/'+encodeURIComponent(p.id)+'?'+q;
 }
 function jump(k,id){
   const r=find(k,id),p=r&&destination(k,r);if(!p){CF.toast(L('Select an accessible associated project.','请选择可访问的关联项目。'));CF.render();return;}
   navigate(sourceHref(k,r,p,{back:snapshot(),application:params().get('application'),period:selectedPeriod(r)}));
 }
 /* 待办、融资项目记录与授信使用记录的去向由记录本身确定，不需要再选项目。 */
 function openSource(k,id,o={}){
   const r=find(k,id),p=r&&D.project(k==='projects'?r.id:r.project);
   if(!r||!p||!destinations(k,r).projects.some(x=>x.id===p.id)){CF.toast(L('Content unavailable','内容不存在或无权访问'));return;}
   navigate(sourceHref(k,r,p,{back:o.back||snapshot(),application:o.application,period:o.period&&r.periods?.find(x=>x.id===o.period)}));
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
   return '<div class="filterbar mc-filters">'+h+'<div class="fb-acts">'+pendingToggle(v)+(['loans','repayments'].includes(v.tab)?b('search',L('Search','查询'),'',true):'')+b('clear',L('Reset filters','清空筛选'))+'</div></div>'+(pendingError&&pendingTabs().includes(v.tab)?'<div class="mc-filter-note" role="status">'+L('Records awaiting your action are temporarily unavailable. ','待处理情况暂不可用，')+reloadHint()+'</div>':'')+(Object.keys(v).some(k=>FILTERS.includes(k)&&v[k]&&!(k==='pending'&&pendingError))?'<div class="mc-filter-note" role="status">'+L('Filtered by: ','已按以下条件过滤：')+E([v.pending&&!pendingError?L('Awaiting your action only','只看待处理'):'',v.tokenType?text(D.type('erc20-ar').label):'',picks(v.filter).map(status).join(' / '),picks(v.secondary).map(k=>k==='yes'?L('Overdue','逾期'):k==='no'?L('Not overdue','未逾期'):status(k)).join(' / '),picks(v.periodState).map(status).join(' / '),v.query,picks(v.project).join(' / ')].filter(Boolean).join(' · '))+'</div>':'');
 }
 function columns(k){return {
   tokens:[[L('Token','代币编号'),'id'],[L('Quantity','数量'),'num'],[L('Value (USD)','价值（USD）'),'num'],[L('Token status','代币状态'),''],[L('Pledge status','质押状态'),''],[L('Receivable due','应收账款到期日'),''],[L('Project','所属项目'),'']],
   projects:[[L('Project','融资项目'),'id'],[L('Status','项目状态'),''],[L('Requested (USD)','融资需求（USD）'),'num'],[L('Balance (USD)','已融资余额（USD）'),'num'],[L('Pledge sufficiency','质押情况'),''],[L('Project deadline','项目截止日'),'']],
   credits:[[L('Facility / counterparty','授信编号／对方企业'),'id'],[L('Credit limit (USD)','授信额度（USD）'),'num'],[L('Used (USD)','已用授信（USD）'),'num'],[L('Available (USD)','可用授信（USD）'),'num'],[L('Status','额度状态'),''],[L('Valid until','有效期至'),'']],
   loans:[[L('Application / business','融资申请／业务'),'id'],[L('Counterparty','对方企业'),''],[L('Project','所属项目'),''],[L('Disbursement amount','放款金额'),'num'],[L('Status / actor','业务状态／处理方'),''],[L('Accepted at','接受时间'),'']],
   quotes:[[L('Business / application','融资业务／融资申请编号'),'id'],[L('Project','所属项目'),''],[L('Asset holder','资产方'),''],[L('Amount (USD)','融资金额（USD）'),'num'],[L('Status','业务状态'),''],[L('Time locked','已锁定时长'),'']],
   repayments:[[L('Application / funder','融资申请／出资机构'),'id'],[L('Current instalment','本期应还'),'num'],[L('Due date','应还日'),''],[L('Business / plan','业务／计划'),''],[L('Pending confirmations','待确认情况'),''],[L('Receipt confirmed','到账确认时间'),'']]
 }[k];}
 function rowValues(k,r){const object=t=>'<a class="mc-object" href="'+E(detailHref(k,r.id))+'" data-act="mc-detail" data-v="'+k+'|'+E(r.id)+'">'+E(t)+'</a>';
   if(k==='tokens')return [object(r.id),CF.fmtAmt(r.units),CF.fmtAmt(r.value),badge(r.status)+(!r.valid?small(L('Not counted toward eligible pledged value','不计入有效质押')):''),badge(r.pledged?'pledged':'unpledged'),date(r.due),destinations(k,r).projects.length?destinations(k,r).projects.map(p=>E(text(p.name))).join('<br>'):L('No accessible project','暂无可访问项目')];
   if(k==='projects')return [object(text(r.name))+small(E(r.id)),badge(r.status),(D.current(r)?CF.fmtAmt(r.amount)+small(E(D.current(r).id))+small(status(D.current(r).state))+(Q.currentQuote(r,D.current(r).id)?.state==='waiting'?small(L('Locked for ','已锁定 ')+elapsed(now()-Q.currentQuote(r,D.current(r).id).at)):''):'—'+small(L('No current application','暂无当前申请'))),CF.fmtAmt(r.balance),badge(r.n.grade)+(r.n.gap?'<span class="mc-indicator">'+L('Gap ','缺口 ')+money(r.n.gap)+small(L('Additional asset value ','需追加资产价值 ')+money(r.n.rate?r.n.gap/r.n.rate:null))+'</span>':r.demands.some(d=>d.state==='quoted')?'<span class="mc-indicator">'+L('Quote awaiting review','有待确认报价')+'</span>':''),date(r.expires)];
   if(k==='credits')return [object(r.id)+small(E(counter(r))),CF.fmtAmt(r.total),CF.fmtAmt(r.used),CF.fmtAmt(r.available),badge(r.status),date(r.expires)];
   if(k==='repayments')return [object(r.request)+small(E(r.id)+' · '+E(r.deal.record.id))+small(E(counter(r.q))+' · '+E(text(D.project(r.project)?.name))),r.current?'<strong>'+money(r.current.settlement,r.q.ccy)+'</strong>'+small(L('Instalment ','第 ')+r.current.seq+L('',' 期')):r.plan?L('No instalments awaiting repayment','暂无待还期次'):'—',r.current?date(r.current.due)+(r.current.overdue?small(L('Overdue ','逾期 ')+r.current.overdue+L(' days',' 天')):now()<r.current.open?small(L('Opens ','开启于 ')+date(r.current.open)):''):'—',badge(r.status)+small(status(r.planState))+(r.overdue?small(L('Overdue · unsettled','逾期 · 未结清')):''),r.pending.length?badge('repayConfirming')+small(r.pending.map(p=>L('Instalment ','第 ')+p.seq+L('',' 期')+L(' · submitted ',' · 已提交 ')+elapsed(p.waiting)+(p.overdue?L(' · overdue frozen ',' · 逾期冻结 ')+p.overdue+L(' days',' 天'):'')).join(' / ')):L('No pending confirmations','暂无待确认'),time(r.at)];
   const state=badge(k==='loans'?r.fdState:r.status);
   if(k==='quotes')return [object(r.id)+small(E(r.request)),E(text(D.project(r.project)?.name)),E(owner(r.owner)),money(r.amount)+small(E(r.ccy)+' · '+E(r.rate)+'%'),state+small(r.status==='waiting'||r.status==='confirming'?L('Asset holder','资产方'):r.status==='pending'?L('Funder','资金方'):r.status==='repaying'?L('See repayment progress','见还款进展'):L('No current quote action','无当前报价办理')),elapsed(r.locked)+small(r.status==='waiting'?L('Still awaiting the asset holder','仍在等待资产方处理'):L('Stopped when the quote was handled','处理后停止累计'))];
   return [object(r.request)+small(E(r.id))+(r.deal?.record?small(E(r.deal.record.id)):small(L('No disbursement record yet','尚无放款记录'))),E(counter(r)),E(text(D.project(r.project)?.name)),money(r.settlement,r.ccy)+small(r.deal?.record?L('Submitted','已登记'):L('Agreed amount','约定金额')),state+small(r.fdState==='pending'?L('Funder','资金方'):r.fdState==='confirming'?L('Asset holder','资产方'):L('No current action','无当前办理'))+(r.fdState==='confirming'?small(L('Submitted ','已提交 ')+elapsed(r.waiting)):''),time(r.acceptedAt)];
 }
 function table(){const v=view(),all=filtered(),count=Math.max(1,Math.ceil(all.length/v.size));if(v.page>count&&S.st!=='error'&&S.st!=='loading'&&!tokenError){v.page=count;const q=params();q.set('page',count);history.replaceState(null,'','#'+path()+'?'+q);}const rs=all.slice((v.page-1)*v.size,v.page*v.size),cols=columns(v.tab);
   if(S.st==='error'||v.tab==='tokens'&&(tokenError||!Array.isArray(D.tokens)))return CF.empty(L('List could not be loaded','列表加载失败'),L('Your filters have been preserved. ','已保留当前筛选条件。')+reloadHint(),'');
   if(!all.length&&S.st!=='loading'&&S.st!=='noresult'&&!FILTERS.some(k=>v[k]))return CF.empty(v.tab==='tokens'?L('No displayable tokens for this company','本企业暂无可展示的代币'):v.tab==='projects'?L('No financing projects yet','尚未创建融资项目'):L('No records yet','暂无记录'),'','');
   let body=S.st==='loading'?'<div role="status" aria-label="'+L('Loading','加载中')+'">'+CF.skelTable(5)+'</div>':(S.st==='error'||v.tab==='tokens'&&(tokenError||!Array.isArray(D.tokens)))?CF.empty(L('List could not be loaded','列表加载失败'),L('Your filters have been preserved. ','已保留当前筛选条件。')+reloadHint(),''):!rs.length&&v.pending&&!pendingError&&!FILTERS.some(k=>k!=='pending'&&v[k])&&S.st!=='empty'?CF.empty(L('No records awaiting your action','当前没有待处理记录'),returnNotice?L('The latest record no longer needs your action.','记录已更新，已无需我方处理。'):'',b('clear',L('Show all records','查看全部记录'))):!rs.length?CF.empty(L(S.st==='empty'?'No records yet':'No matching records',S.st==='empty'?'暂无记录':'暂无符合条件的记录'),returnNotice?L('The latest record no longer matches these filters.','最新记录已不符合当前筛选条件。'):L('Try another filter or return later.','可调整筛选条件或稍后再查看。'),b('clear',L('Clear filters','清空筛选'))):'<div class="listbox" id="mc-list" tabindex="0" aria-label="'+E(nm(v.tab))+'"><table class="tbl mc-table" data-kind="'+v.tab+'"><thead><tr>'+[...cols,[L('Actions','操作'),'']].map(([t,kind])=>'<th scope="col" class="'+(kind||'')+'">'+E(t)+'</th>').join('')+'</tr></thead><tbody>'+rs.map(r=>{const items=pendingError?[]:pendingItems(v.tab,r);return '<tr data-id="'+E(r.id)+'" data-kind="'+v.tab+'"'+(items.length?' data-pending="true"':'')+' tabindex="0" aria-label="'+E(text(titles[v.tab])+' '+r.id+(items.length?' · '+L('Awaiting your action','待我方处理'):''))+'">'+rowValues(v.tab,r).map((c,i)=>'<td data-label="'+E(cols[i][0])+'" class="'+cols[i][1]+'"><div>'+c+(i===0?pendingCue(items):'')+'</div></td>').join('')+'<td data-label="'+L('Actions','操作')+'" class="mc-actions"><div>'+(items.length?'<button type="button" class="btn mc-pending-action" data-act="mc-pending" data-v="'+E(items[0].id)+'" aria-label="'+E(items[0].action+' · '+r.id)+'">'+E(items[0].action)+'</button>':'')+link('detail',L('View details','查看详情'),v.tab+'|'+r.id)+'</div></td></tr>';}).join('')+'</tbody></table></div>';
   const focus=params().get('focus')||'',moved=focus&&all.length&&!all.some(r=>r.id===focus);
   return (moved?CF.note('',L('The updated record no longer matches these filters.','记录已更新，不再符合当前筛选条件。')+' '+b('clear',L('Clear filters','清空筛选'))):'')+'<div class="mc-caption"><span>'+E(nm(v.tab))+' · '+all.length+L(' records',' 条')+'</span><span>'+L('All amounts are in USD unless marked otherwise.','金额单位为 USD，其他币种另行标注。')+'</span></div>'+body+'<div class="pager"><span class="total">'+all.length+L(' records',' 条记录')+'</span><label for="mc-size">'+L('Rows per page','每页')+'</label><select class="inp" id="mc-size">'+[20,50,100].map(n=>'<option'+(n===v.size?' selected':'')+'>'+n+'</option>').join('')+'</select>'+b('page',L('Previous','上一页'),v.page-1,false,v.page<=1)+'<span>'+v.page+' / '+count+'</span>'+b('page',L('Next','下一页'),v.page+1,false,v.page>=count)+'</div>';
 }
 function gate(){if(S.role==='signed')return '<div class="mc-error">'+CF.empty(L('This page is not available for your current role','该页面不适用于当前身份'),L('You can continue exploring public information.','你可以继续浏览公开信息。'),'<button class="btn primary" data-act="go" data-v="/assets">'+L('Back to assets','返回资产广场')+'</button>')+'</div>';
  return '<div class="mc-error">'+CF.empty(L(S.role==='limited'?'Complete account setup':'Sign in to view your console',S.role==='limited'?'请先完成账户必办事项':'登录后查看我的控制台'),L('Your company information is available after sign-in.','登录后可查看本企业数据。'),'<button class="btn primary" data-act="signin">'+L('Sign in','登录')+'</button>')+'</div>';}
 /* 待处理：本企业现在就能在借贷广场办理的事项，各归入唯一一条清单记录；由业务事实即时得出，没有独立待办、手动完成、忽略或催办。 */
 const FILTERS=['pending','filter','secondary','project','query','periodState','tokenType'];
 const at=v=>typeof v==='number'?v:Date.parse(v)||0;
 const seq=p=>L('Instalment ','第 ')+p.seq+L('',' 期');
 function pendingTabs(){return S.role==='asset'?['projects','loans','repayments']:S.role==='fund'?['loans','repayments']:[];}
 function pendingItems(k,r){
   if(!allowed()||S.st==='empty'||!pendingTabs().includes(k))return [];
   const out=[],t=now(),add=(id,name,fact,when,go,extra={})=>out.push({id,name,action:extra.action||name,fact,at:at(when),go,overdue:extra.overdue||0});
   if(k==='projects'){
     const n=r.n,released=D.tokens.filter(x=>x.releasedFrom===r.id&&x.pledge==='released');
     Q.data().quotes.filter(q=>q.state==='waiting'&&q.project===r.id).forEach(q=>add('quote-'+q.id,L('Confirm quote','确认报价'),L('Locked for ','已锁定 ')+elapsed(t-q.at),q.at,['quotes',q.id]));
     if(n.grade==='short')add('pledge-'+r.id,L('Add collateral','追加质押'),L('Pledge gap ','质押缺口 ')+money(n.gap),r.created,['projects',r.id]);
     if(released.length)add('extract-'+r.id,L('Withdraw tokens','提取代币'),released.length+L(' tokens · ',' 张 · ')+money(released.reduce((a,x)=>a+x.value,0)),r.created,['projects',r.id]);
     if(r.status==='returned')add('resubmit-'+r.id,L('Revise and resubmit project','修改并重新提交项目'),'',r.created,['projects',r.id]);
   }else if(k==='loans'){
     if(S.role==='asset'&&r.fdState==='confirming')add('receipt-'+r.id,L('Confirm receipt','确认到账'),L('Waiting for ','已等待 ')+since(r.waiting),r.deal.record?.at,['loans',r.id]);
     if(S.role==='fund'&&r.fdState==='pending')add('disburse-'+r.id,L('Register disbursement','登记放款'),L('Waiting for ','已等待 ')+since(r.acceptedAt?t-r.acceptedAt:null),r.acceptedAt,['loans',r.id]);
   }else if(S.role==='asset'){
     /* 指向本笔第一条已开放、尚未提交的待还款期次。 */
     const p=r.periods.filter(p=>p.state==='due'&&t>=at(p.open)).sort((a,b)=>a.due.localeCompare(b.due)||a.seq-b.seq)[0];
     if(p)add('repay-'+r.id,L('Repay','还款'),seq(p)+L(' · due ',' · 应还日 ')+date(p.due)+(p.overdue>0?L(' · overdue ',' · 已逾期 ')+p.overdue+L(' days',' 天'):''),p.open,['repayments',r.id,p.id],{overdue:p.overdue,action:L('Repay · ','还款·')+seq(p)});
   }else r.pending.forEach(p=>add('confirm-'+p.id,L('Confirm repayment received','确认收到还款'),seq(p)+L(' · submitted ',' · 提交于 ')+time(p.record.at)+(p.overdue>0?L(' · overdue frozen at ',' · 逾期冻结 ')+p.overdue+L(' days',' 天'):''),p.record.at,['repayments',r.id,p.id],{overdue:p.overdue,action:L('Confirm repayment received · ','确认收到还款·')+seq(p)}));
   /* 已逾期（含提交后冻结的逾期）在前、按天数从多到少；其余按事项发生时间从早到晚。 */
   return out.sort((a,b)=>(b.overdue>0)-(a.overdue>0)||b.overdue-a.overdue||a.at-b.at||a.id.localeCompare(b.id));
 }
 /* 分类标签上的数量是有待处理事项的记录数，按该分类全部记录计算，不随筛选、检索或分页变化。 */
 function pendingCount(k){return pendingError?null:normalized(k).filter(r=>pendingItems(k,r).length).length;}
 function pendingBadge(k){const n=pendingTabs().includes(k)?pendingCount(k):0;return n?'<span class="mc-pending-count">'+n+'<span class="sr-only">'+L(n>1?' records awaiting your action':' record awaiting your action',' 条待我方处理记录')+'</span></span>':'';}
 function pendingToggle(v){
   if(!pendingTabs().includes(v.tab))return '';
   const n=pendingCount(v.tab);
   return '<label class="mc-pending-toggle"'+(pendingError?' aria-disabled="true"':'')+'><input type="checkbox" id="mc-pending"'+(v.pending&&!pendingError?' checked':'')+(pendingError?' disabled':'')+'><span>'+L('Awaiting your action only','只看待处理')+'</span>'+(n==null?'':'<span class="mc-toggle-count">'+n+'<span class="sr-only">'+L(n>1?' records awaiting your action':' record awaiting your action',' 条待我方处理记录')+'</span></span>')+'</label>';
 }
 function pendingCue(items){
   if(!items.length)return '';
   const x=items[0];
   return '<div class="mc-pending-cue"'+(x.overdue>0?' data-overdue="true"':'')+'><b><span aria-hidden="true"></span>'+L('Awaiting your action','待我方处理')+' · '+E(x.name)+'</b>'+(x.fact?'<span>'+x.fact+'</span>':'')+
     (items.length>1?'<details class="mc-pending-more"><summary>'+L(items.length+' items','共 '+items.length+' 项')+'</summary><ul>'+items.map(y=>'<li'+(y.overdue>0?' data-overdue="true"':'')+'><b>'+E(y.name)+'</b>'+(y.fact?'<span>'+y.fact+'</span>':'')+'</li>').join('')+'</ul></details>':'')+'</div>';
 }
 function pendingSection(k,r){
   const items=pendingError?[]:pendingItems(k,r);if(!items.length)return '';
   return '<section class="mc-pending-detail" aria-labelledby="mc-pending-title"><h2 id="mc-pending-title">'+L('Awaiting your action','待我方处理')+(items.length>1?L(' · '+items.length+' items',' · 共 '+items.length+' 项'):'')+'</h2><ul>'+items.map(y=>'<li'+(y.overdue>0?' data-overdue="true"':'')+'><b>'+E(y.name)+'</b>'+(y.fact?'<span>'+y.fact+'</span>':'')+'</li>').join('')+'</ul><p class="mc-small">'+L('Handle it from the project’s actions in the lending marketplace.','请在借贷广场该项目的办理入口处理。')+'</p></section>';
 }
 function overview(){return '<section class="card mc-overview" aria-labelledby="mc-capital-title"><h2 id="mc-capital-title">'+L('Company overview','企业概览')+'</h2>'+summary()+'</section>';}
 function listing(){if(!allowed())return gate();if(S.st==='denied')return unavailable();const v=view();return '<div class="mc-root"><div class="page-head"><div><h1 class="page-title">'+L('My console','我的控制台')+'</h1><p class="page-desc">'+L('Records awaiting your action are marked in the lists. Records are shared by company; unread messages are personal.','清单中标出待我方处理的记录。业务记录按企业共享，消息未读数按个人统计。')+'</p></div><div class="page-actions">'+'</div></div>'+overview()+'<section class="card mc-ledger"><div class="mc-tabs" role="tablist" aria-label="'+L('Console records','控制台信息')+'">'+tabs().map(k=>'<button role="tab" aria-selected="'+(k===v.tab)+'" tabindex="'+(k===v.tab?0:-1)+'" data-act="mc-tab" data-v="'+k+'">'+E(nm(k))+pendingBadge(k)+'</button>').join('')+'</div><div role="tabpanel" aria-label="'+E(nm(v.tab))+'">'+filters()+table()+'</div></section></div>';}
 function unavailable(){const kind=path().split('/')[2],back=tabs().includes(kind)?'#/console?tab='+kind:'#/console';return '<div class="mc-root mc-error">'+CF.empty(L('Content unavailable','内容不存在或无权访问'),L('Return to your console to view available records.','请返回控制台查看可访问的记录。'),b('list',L('Back to console','返回我的控制台'),back))+'</div>';}
 function section(id,title,body){return {id,title,html:'<section class="card detail-section" id="'+id+'" tabindex="-1"><div class="card-head"><h2>'+E(title)+'</h2></div><div class="card-body">'+body+'</div></section>'};}
 /* 期次只给当前阅读需要的事实；完整计划、本息拆分、凭证与收款账户在借贷广场原笔阅读。 */
 function periodFacts(r,p,compact=false){
   const open=p.state==='due'&&now()<at(p.open),usd=r.q.ccy==='USD';
   return dl([
     !compact&&[L('Due date','应还日'),date(p.due)],
     !(compact&&usd)&&[L(usd?'Amount due':'Total due',usd?'应还金额':'应还合计'),money(p.total)],
     !usd&&[L('Settlement amount','结算金额'),money(p.settlement,r.q.ccy)],
     compact&&[L('Instalment status','期次状态'),badge(p.status)],
     open&&[L('Repayment entry opens','还款录入开放'),time(p.open)],
     p.overdue>0&&[L(p.state==='settled'?'Historical overdue days':p.record?'Overdue days (frozen)':'Overdue days',p.state==='settled'?'历史逾期天数':p.record?'逾期天数（已冻结）':'逾期天数'),p.overdue+L(' days',' 天')],
     p.record&&[L('Repayment record','还款记录编号'),copy(p.record.id)],
     p.record&&[L('Submitted at','提交时间'),time(p.record.at)],
     p.record?.confirmedAt&&[L('Settled at','结清时间'),time(p.record.confirmedAt)]
   ])+(p.principal?'<p class="mc-small">'+L('Final instalment includes principal.','末期含本金。')+'</p>':'');
 }
 function periodRecord(r,p,selected,match,compact=false){
   return '<article class="mc-record" data-selected="'+(selected?.id===p.id)+'" id="mc-period-'+E(p.id)+'">'+(compact?'':'<div class="mc-record-head"><b>'+L('Instalment ','第 ')+p.seq+L(' of ',' / ')+r.periods.length+L('',' 期')+'</b>'+badge(p.status)+'</div>'+(p.state==='pending'?'<p class="mc-small mc-record-note">'+L('Submitted, awaiting the funder, not yet settled','已提交、待资金方确认、仍未结清')+'</p>':''))+periodFacts(r,p,compact)+(match&&within(match,p.status)?'<p class="mc-small">'+L('Matches the list filter','匹配列表期次筛选')+'</p>':'')+b('period',selected?.id===p.id?L('Selected for reading','已选定阅读'):L('Select this instalment','选择此期阅读'),p.id,false,selected?.id===p.id)+'</article>';
 }
 function repaymentSections(r){
   const out=[],add=(id,title,body)=>out.push(section(id,title,body)),selected=selectedPeriod(r),match=new URLSearchParams((params().get('list')||'').split('?')[1]||'').get('periodState');
   const settled=r.periods.filter(p=>p.state==='settled');
   if(planError)add('mc-current',L('Current instalment','本期应还'),CF.empty(L('Repayment information unavailable','还款信息暂不可用'),L('Receipt confirmation is preserved. ','到账确认结果已保留。')+reloadHint(),''));
   else if(!r.plan)add('mc-current',L('Current instalment','本期应还'),CF.note('',L('Receipt is confirmed. The repayment schedule is being generated.','已确认到账，还款计划生成中。')));
   else{
     add('mc-current',L('Current instalment','本期应还'),r.plan.settledAt?CF.note('ok',L('All instalments are settled.','本笔全部期次已结清。')):r.current?'<div class="mc-current-amount"><div><span>'+L('Instalment ','第 ')+r.current.seq+L(' of ',' / ')+r.periods.length+L('',' 期')+'</span><strong>'+statMoney(r.current.settlement,r.q.ccy)+'</strong></div><div class="mc-current-date"><span>'+L('Due date','应还日')+'</span><div>'+date(r.current.due)+'</div></div></div>'+periodRecord(r,r.current,selected,match,true):CF.note('',L('No instalments awaiting repayment.','暂无待还期次。')));
     /* 待确认、本期以外的未结清逾期及指定期次逐条可见，不被下一期取代。 */
     const others=r.periods.filter(p=>p.id!==r.current?.id&&(p.state==='pending'||p.state!=='settled'&&p.overdue>0||p.id===selected?.id));
     if(others.length)add('mc-periods',L('Pending confirmation and overdue','待确认与逾期期次'),(r.overdue?CF.note('warn',L('Overdue instalments remain unsettled. Submitted instalments await the funder; their overdue days stay frozen.','存在尚未结清的逾期期次；已提交期次待资金方确认，逾期天数保持冻结。')):'')+(selected&&selected.id!==r.current?.id?CF.note('',L('Reading selected instalment: ','当前选定原期次：')+E(selected.id)):'')+others.map(p=>periodRecord(r,p,selected,match)).join(''));
   }
   add('mc-progress',L('Repayment progress','还款进度'),dl([
     [L('Settled instalments','已结清期数'),r.plan?settled.length+' / '+r.periods.length:'—'],
     [L('Outstanding principal','未偿本金'),money(r.deal.principalBalance)],
     [L('Principal repaid','累计已还本金'),r.plan?money(settled.reduce((n,p)=>n+p.principal,0)):'—'],
     [L('Interest repaid','累计已还利息'),r.plan?money(settled.reduce((n,p)=>n+p.interest,0)):'—'],
     [L('Final repayment date','最终还款日'),r.plan?date(r.plan.end):'—'],
     r.plan?.settledAt&&[L('Settled at','结清时间'),time(r.plan.settledAt)]
   ]));
   add('mc-refs',L('References','编号'),dl([[L('Application ID','融资申请编号'),copy(r.request)],[L('Business ID','融资业务编号'),copy(r.id)],[L('Disbursement ID','放款编号'),copy(r.deal.record.id)]]));
   return out;
 }
 /* 授信使用记录：一笔融资业务一条，只列仍在使用这份授信的在途报价与授信占用。 */
 function usage(c){
   const rows=Q.data().quotes.filter(q=>q.owner===c.owner&&q.fund===c.fund&&party(q)).flatMap(q=>{const x=q.l7;
     if(q.state==='waiting')return [{q,kind:'transit',amount:q.amount,stage:'waiting'}];
     if(q.state==='funding')return [{q,kind:'transit',amount:q.amount,stage:x?.state==='waiting'?'confirming':'pending'}];
     if(x?.state==='confirmed'&&x.principalBalance>0)return [{q,kind:'occupied',amount:x.principalBalance,stage:'repaying'}];
     return [];}).sort((a,b)=>at(b.q.at)-at(a.q.at)||a.q.id.localeCompare(b.q.id));
   const sum=k=>rows.filter(x=>x.kind===k).reduce((n,x)=>n+x.amount,0);
   return {rows,consistent:Math.abs(sum('transit')-c.transit)<0.005&&Math.abs(sum('occupied')-c.principal)<0.005};
 }
 function usageMeter(r){
   const parts=[['occupied',r.principal,L('Principal occupied','授信占用额')],['transit',r.transit,L('Quotes in transit','在途报价金额')],['available',r.available,L('Available credit','可用授信')]];
   const whole=Math.max(r.total,parts.reduce((n,x)=>n+x[1],0)),pct=v=>whole?(Math.round(v/whole*1000)/10)+'%':'—';
   return '<div class="mc-usage"><div class="mc-usage-total"><div><span>'+L('Credit limit','授信额度')+'</span><strong>'+statMoney(r.total)+'</strong></div><div><span>'+L('Used = occupied + in transit','已用额 = 占用额 + 在途报价金额')+'</span><strong>'+statMoney(r.used)+' <small>'+pct(r.used)+'</small></strong></div></div>'+
     '<div class="mc-meter" role="img" aria-label="'+E(parts.map(x=>x[2]+' '+CF.fmtAmt(x[1])+' USD').join(' · '))+'">'+parts.filter(x=>x[1]>0).map(x=>'<span class="mc-meter-seg" data-part="'+x[0]+'" style="flex-grow:'+x[1]+'" title="'+E(x[2]+' · '+CF.fmtAmt(x[1])+' USD · '+pct(x[1]))+'"></span>').join('')+'</div>'+
     '<ul class="mc-usage-legend">'+parts.map(x=>'<li><span class="mc-key" data-part="'+x[0]+'" aria-hidden="true"></span><span>'+E(x[2])+'</span><strong>'+statMoney(x[1])+'</strong><small>'+pct(x[1])+'</small></li>').join('')+'</ul></div>'+
     (r.status==='expired'?CF.note('',L('Expired · existing business continues. Renew the credit before quoting again.','已到期·存量业务照常履约，如需再次报价请先重新授信')):'');
 }
 function usageList(r){
   if(usageError)return CF.empty(L('Usage records unavailable','使用记录暂不可用'),reloadHint(),'');
   const u=usage(r);
   if(!u.consistent)return CF.empty(L('Usage records unavailable','使用记录暂不可用'),L('The usage figures above are current. ','上方使用情况为当前结果。')+reloadHint(),'');
   if(!u.rows.length)return '<p class="mc-small">'+L('No business is currently in transit or occupying this credit.','当前没有在途或占用中的业务')+'</p>';
   const size=10,pages=Math.ceil(u.rows.length/size),page=Math.min(usagePage,pages),rows=u.rows.slice((page-1)*size,page*size);
   const target=x=>x.stage==='waiting'?(S.role==='fund'?'quotes':'quotes-source'):x.stage==='repaying'?'repayments':'loans';
   return '<div class="listbox"><table class="tbl mc-table mc-usage-table" data-kind="usage"><thead><tr>'+[[L('Project','项目名称'),''],[L('Business ID','融资业务编号'),''],[L('Usage type','使用类型'),''],[L('Amount (USD)','使用金额（USD）'),'num'],[L('Business stage','当前业务阶段'),''],[L('Actions','操作'),'']].map(([t,c])=>'<th scope="col" class="'+c+'">'+E(t)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(x=>{const k=target(x),label=k==='quotes-source'?L('View in marketplace','到借贷广场查看'):L('View details','查看详情');
     return '<tr data-id="'+E(x.q.id)+'" data-kind="'+k+'" tabindex="0" aria-label="'+E(x.q.id)+'"><td data-label="'+L('Project','项目名称')+'"><div>'+E(text(D.project(x.q.project)?.name))+'</div></td><td data-label="'+L('Business ID','融资业务编号')+'"><div class="mono">'+E(x.q.id)+'</div></td><td data-label="'+L('Usage type','使用类型')+'"><div>'+(x.kind==='occupied'?L('Credit occupied','授信占用'):L('Quote in transit','在途报价'))+'</div></td><td data-label="'+L('Amount (USD)','使用金额（USD）')+'" class="num"><div>'+CF.fmtAmt(x.amount)+'</div></td><td data-label="'+L('Business stage','当前业务阶段')+'"><div>'+badge(x.stage)+'</div></td><td data-label="'+L('Actions','操作')+'" class="mc-actions"><div><button type="button" class="actlink" data-act="mc-usage-open" data-v="'+k+'|'+E(x.q.id)+'">'+label+'</button></div></td></tr>';}).join('')+'</tbody></table></div>'+
     (pages>1?'<div class="pager"><span class="total">'+u.rows.length+L(' records',' 条记录')+'</span>'+b('usage-page',L('Previous','上一页'),page-1,false,page<=1)+'<span>'+page+' / '+pages+'</span>'+b('usage-page',L('Next','下一页'),page+1,false,page>=pages)+'</div>':'');
 }
 const certifiedFunder=()=>S.role==='fund'&&(CF.portalEligible?CF.portalEligible().verified!==false:true);
 function details(k,r){
   const out=[],add=(id,t,body)=>out.push(section(id,t,body));
   if(k==='tokens'){
     add('mc-basic',L('Token information','代币信息'),dl([[L('Token ID','代币编号'),copy(r.id)],[L('Token type','代币类型'),E(text(D.type(r.kind).label))],[L('Quantity','代币数量'),CF.fmtAmt(r.units)],[L('Token value','代币价值'),money(r.value)],[L('Buyer','买方企业'),E(text(r.buyer))],[L('Receivable period','底层应收账款账期'),date(r.from)+' → '+date(r.due)],[L('Issued at','签发时间'),time(r.issued)],[L('Token status','代币状态'),badge(r.status)],[L('Pledge status','质押状态'),badge(r.pledged?'pledged':'unpledged')]])+(!r.valid?CF.note('',L('This token is void and does not contribute to eligible pledged value.','该代币已失效，不计入有效质押。')):''));
     const reach=destinations(k,r).projects;
     add('mc-project',L('Associated project','关联融资项目'),reach.length?reach.map(p=>dl([[L('Project','融资项目'),E(text(p.name))],[L('Project ID','项目编号'),copy(p.id)]])).join(''):CF.empty(destinations(k,r).reason,''));
   }else if(k==='credits'){
     add('mc-credit',L('Credit usage','授信使用情况'),usageMeter(r));
     add('mc-usage',L('Current usage','当前使用记录'),usageList(r));
     add('mc-basic',L('Credit term','授信期限'),dl([[L('First granted','首次授信时间'),time(r.first)],[L('Valid until','授信有效期至'),date(r.expires)],S.role==='fund'&&[L('Internal remark','备注'),E(r.history?.at(-1)?.remark||'—')]]));
   }else if(k==='quotes'){
     /* 报价详情只回答三件事：客户要多少、本机构怎么报、结果如何。 */
     add('mc-demand',L('Client financing request','客户融资需求'),dl([[L('Requested amount','融资需求金额'),money(r.amount)],[L('Application ID','融资申请编号'),copy(r.request)]]));
     add('mc-quote',L('Your quote','本机构报价'),dl([[L('Settlement currency','结算币种'),E(r.ccy)],[L('Annual rate','年化融资利率'),E(r.rate)+'%'],[L('Quoted at','报价时间'),time(r.at)],[L('Business ID','融资业务编号'),copy(r.id)]]));
     const result=quoteResult(r);
     add('mc-result',L('Quote result','报价结果'),dl(result==='waiting'?[[L('Result','结果'),badge('waiting')],[L('Lock started','锁定起点'),time(r.at)],[L('Time locked','已锁定时长'),elapsed(r.locked)]]:result==='accepted'?[[L('Result','结果'),badge('accepted')],[L('Accepted at','接受时间'),time(r.done)],[L('Current business stage','当前业务阶段'),badge(r.status)]]:result==='rejected'?[[L('Result','结果'),badge('rejected')],[L('Rejected at','拒绝时间'),time(r.done)],r.reason&&[L('Reason','原因'),E(reasonText(r.reason))]]:[[L('Result','结果'),badge('quoteEnded')],[L('Invalidated at','失效时间'),time(r.endedAt||r.done)],r.reason&&[L('Reason','原因'),E(reasonText(r.reason))]])+
       (result==='accepted'?'<p class="mc-links">'+link('detail',L('View disbursement','查看同笔放款'),'loans|'+r.id)+(['repaying','settled'].includes(r.status)&&r.deal?.record&&['confirmed','settled'].includes(r.deal.state)?link('detail',L('View repayment','查看同笔还款'),'repayments|'+r.id):'')+'</p>':''));
   }else if(k==='loans'){
     const x=r.deal;
     add('mc-progress',L('Disbursement progress','放款进展'),dl([[x.record?L('Disbursement amount','放款金额'):L('Agreed disbursement amount','约定放款金额'),money(r.settlement,r.ccy)]])+
       '<ol class="mc-steps"><li data-done="'+!!x.record+'"><b>'+L('Funder registers disbursement','资金方登记放款')+'</b><span>'+(x.record?time(x.record.at):L('Not submitted','未提交'))+'</span></li><li data-done="'+!!x.confirmedAt+'"><b>'+L('Asset holder confirms receipt','资产方确认到账')+'</b><span>'+(x.confirmedAt?time(x.confirmedAt):L('Not confirmed','未确认'))+'</span></li></ol>'+
       (['confirmed','settled'].includes(x.state)?'<p class="mc-links"><span class="mc-small">'+L('Repayment progress is in Repayments.','还款进展在还款信息查看。')+'</span>'+link('detail',L('View repayment','查看同笔还款'),'repayments|'+r.id)+'</p>':''));
     add('mc-refs',L('Project and references','关联与编号'),dl([[L('Project','所属融资项目'),E(text(D.project(r.project)?.name))],[L('Application ID','融资申请编号'),copy(r.request)],[L('Business ID','融资业务编号'),copy(r.id)],[L('Disbursement ID','放款编号'),x.record?copy(x.record.id):L('No disbursement record yet','尚无放款记录')]]));
   }else return repaymentSections(r);
   return out;
 }
 const quoteResult=r=>r.state==='waiting'?'waiting':r.state==='rejected'?'rejected':r.state==='expired'?'quoteEnded':'accepted';
 const handler=r=>r.fdState==='pending'?L('Funder','资金方'):r.fdState==='confirming'?L('Asset holder','资产方'):L('No current action','无当前办理');
 /* 详情标题直接写对象识别：代币看编号，报价看项目，授信、放款、还款看对方名称；类型由上方小标题区分。 */
 function head(k,r){
   const cls='<span class="mc-meta-text">',end='</span>';
   if(k==='tokens')return {title:r.id,meta:badge(r.status)+badge(r.pledged?'pledged':'unpledged')+CF.copyBtn('mc-copy',r.id,L('Copy token ID','复制代币编号')),actions:controls(k,r)};
   if(k==='credits')return {title:counter(r),meta:badge(r.status)+cls+L('Valid until ','有效期至 ')+date(r.expires)+end+copy(r.id),actions:modifyEntry(r)};
   if(k==='loans')return {title:counter(r),meta:badge(r.fdState)+cls+L('Current handler: ','当前处理方：')+handler(r)+end,actions:controls(k,r)};
   if(k==='repayments')return {title:counter(r.q),meta:badge(r.status)+(r.overdue?CF.tag('warn',L('Currently overdue','当前逾期')):'')+cls+E(text(D.project(r.project)?.name))+end,actions:controls(k,r)};
   return {title:text(D.project(r.project)?.name),meta:cls+E(owner(r.owner))+end+badge(quoteResult(r)),actions:controls(k,r)};
 }
 function modifyEntry(r){
   if(S.role!=='fund')return '';
   if(!certifiedFunder())return '<p class="mc-small">'+L('Credit can be modified after your institution is verified.','机构认证通过后可修改授信。')+'</p>';
   return b('modify',r.status==='expired'?L('Renew credit','重新授信'):L('Modify credit','修改授信'),r.id,true);
 }
 function detail(k){
   if(!allowed())return gate();
   if(k==='tokens'&&(tokenError||!Array.isArray(D.tokens)))return '<div class="mc-root mc-error">'+CF.empty(L('Token details unavailable','代币详情暂不可用'),reloadHint(),'')+'</div>';
   const r=find(k,params().get('id'));if(!r||!tabs().includes(k)&&!(k==='quotes'&&S.role==='asset')||S.st==='denied')return unavailable();
   if(k==='repayments'&&params().get('period')&&!r.periods.some(p=>p.id===params().get('period')))return unavailable();
   if(k==='projects'&&params().get('application')&&!r.demands.some(d=>d.id===params().get('application')))return unavailable();
   if(['loading','error'].includes(detailState))return '<div class="mc-root mc-error">'+(detailState==='loading'?'<div role="status">'+CF.skelTable(6)+'</div>':CF.empty(L('Details could not be loaded','详情加载失败'),reloadHint(),''))+'</div>';
   /* 旧的控制台项目详情地址：改到借贷广场项目详情，已指定的原申请继续定位。 */
   if(k==='projects'){const p=D.project(r.id),back=listRoute('projects');setTimeout(()=>{if(path()==='/console/projects'&&params().get('id')===r.id)location.replace(location.href.split('#')[0]+sourceHref(k,r,p,{back,application:params().get('application')}));},0);return '<div class="mc-root mc-error" role="status">'+CF.skelTable(3)+'</div>';}
   const sections=details(k,r),h=head(k,r),chapters=sections.length>3;
   return '<div class="mc-root mc-detail"><div class="page-head"><div><p class="mc-eyebrow">'+E(k==='credits'?nm('credits'):text(kindNames[k]))+'</p><h1 class="page-title" tabindex="-1">'+E(h.title)+'</h1><div class="mc-detail-meta">'+h.meta+'</div></div>'+(h.actions?'<div class="mc-quick-actions" aria-label="'+(k==='credits'?L('Credit actions','授信操作'):L('Project navigation','项目导航'))+'">'+h.actions+'</div>':'')+'</div>'+(detailState==='stale'?CF.note('warn',L('The business state changed. The previous action is no longer available.','业务状态已变化，原操作已不可用。')):'')+pendingSection(k,r)+(k==='tokens'?'<div class="stat-strip mc-detail-metrics">'+stat(L('Token value','代币价值'),statMoney(r.value),'','accent')+stat(L('Receivable due','应收账款到期日'),date(r.due))+'</div>':'')+(chapters?'<nav class="mc-chapters" aria-label="'+L('On this page','本页章节')+'">'+sections.map((x,i)=>'<button type="button" data-act="mc-section" data-v="'+x.id+'"'+(!i?' aria-current="location"':'')+'>'+E(x.title)+'</button>').join('')+'</nav>':'')+'<div class="detail-stack">'+sections.map(x=>x.html).join('')+'</div></div>';
 }
 /* 修改授信：控制台唯一写入。生效中可追加额度或后延有效期至；已到期为重新授信。规则沿授信报价模块，不调低、冻结或删除。 */
 const today=()=>new Date(now()).toISOString().slice(0,10);
 const addYears=(d,y)=>{const [Y,M,Dd]=d.split('-').map(Number),last=new Date(Date.UTC(Y+y,M,0)).getUTCDate();return (Y+y)+'-'+String(M).padStart(2,'0')+'-'+String(Math.min(Dd,last)).padStart(2,'0');};
 const rawCredit=id=>Q.data().credits.find(c=>c.id===id);
 /* 五年上限自首次授信日或最近一次重新授信日起算；追加不重置起点。起点不可得时不放行延期。 */
 function creditCap(c){const start=[...(c.history||[])].reverse().find(h=>['new','renew'].includes(h.mode))?.at||c.first;return start&&Number.isFinite(Date.parse(start))?addYears(String(start).slice(0,10),5):'';}
 function startModify(id){
   const r=normalized('credits').find(c=>c.id===id);if(!r||S.role!=='fund'||!certifiedFunder())return;
   const renew=r.status==='expired';
   modify={id,mode:renew?'renew':'increase',add:'',total:renew?String(r.total):'',expires:renew?addYears(today(),1):r.expires,remark:r.history?.at(-1)?.remark||'',files:[],invalid:'',error:'',busy:false};
   CF.openLayer('modal','mc-credit-modify');
 }
 function captureModify(){
   const v=id=>document.getElementById('mc-cm-'+id)?.value;
   if(v('add')!=null)modify.add=v('add');if(v('total')!=null)modify.total=v('total');if(v('expires')!=null)modify.expires=v('expires');if(v('remark')!=null)modify.remark=v('remark');
 }
 function modifyFail(field,en,zh){modify.invalid=field;modify.error=L(en,zh);modify.busy=false;CF.render();setTimeout(()=>document.getElementById('mc-cm-'+field)?.focus(),0);return false;}
 function checkModify(r,c){
   const amount=/^\d+(\.\d{1,2})?$/,cap=creditCap(c);
   if(modify.mode==='increase'){
     const add=modify.add.trim();
     if(add&&(!amount.test(add)||+add<=0))return modifyFail('add','Enter an increase above 0 with up to 2 decimal places.','请输入大于 0、最多两位小数的增加额度。');
     if(!/^\d{4}-\d{2}-\d{2}$/.test(modify.expires))return modifyFail('expires','Choose the credit expiry date.','请选择授信有效期至。');
     if(modify.expires<c.expires)return modifyFail('expires','The expiry date cannot be earlier than '+c.expires+'.','授信有效期至不能早于当前的 '+date(c.expires)+'。');
     if(modify.expires>c.expires&&!cap)return modifyFail('expires','The extension limit cannot be verified now. Keep the current date or try later.','暂时无法确认延期上限，请保持当前有效期至或稍后再试。');
     if(cap&&modify.expires>cap)return modifyFail('expires','The latest expiry date is '+cap+'.','授信有效期至最晚为 '+date(cap)+'。');
     if(!add&&modify.expires===c.expires)return modifyFail('add','Increase the limit or extend the expiry date.','请增加授信额度或后延有效期至，至少修改一项。');
     return {total:Math.round((c.total+(+add||0))*100)/100,expires:modify.expires};
   }
   const total=modify.total.trim();
   if(!amount.test(total)||+total<=0||+total<r.used)return modifyFail('total','Enter a limit above 0, with up to 2 decimals, and not below the used amount of '+CF.fmtAmt(r.used)+' USD.','授信额度须大于 0、最多两位小数，且不低于当前已用额 '+CF.fmtAmt(r.used)+' USD。');
   const t=today();if(!(modify.expires>=addYears(t,1)&&modify.expires<=addYears(t,5)))return modifyFail('expires','Choose an expiry date within one to five years.','请选择一年至五年内的授信有效期至。');
   return {total:+total,expires:modify.expires};
 }
 function saveModify(){
   if(modify.busy)return;captureModify();modify.invalid='';modify.error='';
   const c=rawCredit(modify.id),r=normalized('credits').find(x=>x.id===modify.id);if(!c||!r){CF.closeLayer();CF.render();return;}
   if((r.status==='expired')!==(modify.mode==='renew')){const id=modify.id;startModify(id);modify.error=L('The credit status changed. Review the fields for its current status.','授信状态已变化，请按最新状态重新填写。');CF.render();return;}
   const next=checkModify(r,c);if(!next)return;
   modify.busy=true;CF.render();
   setTimeout(()=>{
     if(!S.layer||S.layer.key!=='mc-credit-modify')return;
     if(saveFailOnce){saveFailOnce=false;modify.busy=false;modify.error=L('Saving failed. The credit was not changed and your entries are kept.','保存失败，授信未修改；已保留填写内容，可再次保存。');CF.render();return;}
     /* 提交时按最新状态与已用额重新校验，校验通过才写入；重复点击不会重复增加额度。 */
     const latest=normalized('credits').find(x=>x.id===modify.id);
     if(!latest||(latest.status==='expired')!==(modify.mode==='renew')||next.total<latest.used){modify.busy=false;modify.error=L('The credit changed before saving. Nothing was saved; review the latest figures.','授信在保存前已变化，本次未保存，请核对最新数据。');CF.render();return;}
     c.history=c.history||[];
     c.history.push({at:D.iso(),mode:modify.mode,total:next.total,expires:next.expires,remark:modify.remark.trim(),agreements:modify.files.map(({id,name,size})=>({id,name,size})),source:'console'});
     c.total=next.total;c.expires=next.expires;Q.save();
     const renewed=modify.mode==='renew';modify={};CF.closeLayer();CF.render();
     CF.toast(renewed?L('Credit renewed. It is effective now.','已重新授信，立即生效。'):L('Credit updated. It is effective now.','授信已修改，立即生效。'));
   },600);
 }
 function pickFiles(list){
   captureModify();modify.invalid='';modify.error='';const rejected=[];
   [...list].forEach(f=>{
     if(modify.files.length>=10)rejected.push(f.name+L(' (over 10 files)','（超过 10 份）'));
     else if(!/\.(pdf|jpe?g|png)$/i.test(f.name))rejected.push(f.name+L(' (unsupported format)','（格式不支持）'));
     else if(!f.size||f.size>10*1048576)rejected.push(f.name+(f.size?L(' (over 10 MB)','（超过 10 MB）'):L(' (empty file)','（空文件）')));
     else modify.files.push({id:'mc-credit-file-'+Date.now()+'-'+modify.files.length,name:f.name,size:f.size});
   });
   if(rejected.length){modify.invalid='files';modify.error=L('Not added: ','未添加：')+rejected.join(L('; ','；'));}
   CF.render();document.getElementById('mc-cm-files')?.focus();
 }
 function modifyLayer(){
   const c=rawCredit(modify.id),r=normalized('credits').find(x=>x.id===modify.id);if(!c||!r)return null;
   const renew=modify.mode==='renew',cap=creditCap(c),busy=modify.busy,off=busy?' disabled':'',bad=f=>modify.invalid===f?' aria-invalid="true" aria-describedby="mc-cm-error"':'';
   const err=f=>modify.error&&modify.invalid===f?'<p class="mc-cm-error" id="mc-cm-error" role="alert">'+E(modify.error)+'</p>':'';
   const field=(id,label,control,hint='')=>'<div class="field"><label for="mc-cm-'+id+'">'+CF.fieldLabel(label)+'</label>'+control+err(id)+(hint?'<p class="hint">'+hint+'</p>':'')+'</div>';
   const years=[1,2,3,4,5].map(y=>[addYears(today(),y),y]);
   const terms=renew?
     field('total',L('Credit limit (USD) *','授信额度（USD）*'),'<input class="inp" id="mc-cm-total" inputmode="decimal" value="'+E(modify.total)+'"'+bad('total')+off+'>',L('Previous limit ','上一版额度 ')+CF.fmtAmt(c.total)+' USD · '+L('not below the used amount ','不低于当前已用额 ')+CF.fmtAmt(r.used)+' USD')+
     field('expires',L('Credit valid until *','授信有效期至 *'),'<select class="inp" id="mc-cm-expires"'+bad('expires')+off+'>'+years.map(([d,y])=>'<option value="'+d+'"'+(d===modify.expires?' selected':'')+'>'+date(d)+L(' · '+y+(y>1?' years':' year'),' · '+y+' 年')+'</option>').join('')+'</select>')
     :field('add',L('Increase limit by (USD)','增加额度（USD）'),'<input class="inp" id="mc-cm-add" inputmode="decimal" placeholder="'+L('Leave empty to keep the limit','不增加可留空')+'" value="'+E(modify.add)+'"'+bad('add')+off+'>',L('Adjusted limit: ','调整后额度：')+'<span id="mc-cm-after" class="mono">'+CF.fmtAmt(c.total+(/^\d+(\.\d{1,2})?$/.test(modify.add.trim())?+modify.add:0))+'</span> USD')+
     field('expires',L('Credit valid until *','授信有效期至 *'),'<input class="inp" id="mc-cm-expires" type="date" value="'+E(modify.expires)+'" min="'+E(c.expires)+'"'+(cap?' max="'+E(cap)+'"':'')+bad('expires')+off+'>',cap?L('Keep or extend, up to ','可保持或后延，最晚 ')+date(cap):L('The extension limit cannot be verified now; only the limit can be increased.','暂时无法确认延期上限，本次仅可增加额度。'));
   const files='<div class="field"><label for="mc-cm-files">'+L('Credit agreements (optional)','本次授信协议（选填）')+'</label><input class="inp" id="mc-cm-files" type="file" multiple accept=".pdf,.jpg,.jpeg,.png"'+bad('files')+(busy||modify.files.length>=10?' disabled':'')+'>'+err('files')+'<p class="hint">'+L('PDF, JPG or PNG, up to 10 MB each, 10 files at most. Earlier agreements are kept.','PDF / JPG / PNG，单份不超过 10 MB，最多 10 份；历史协议保留。')+'</p>'+(modify.files.length?'<ul class="mc-cm-files">'+modify.files.map(f=>'<li><span>'+E(f.name)+'</span><span class="mc-small">'+(f.size/1048576).toFixed(2)+' MB</span>'+b('cm-remove',L('Remove','移除'),f.id,false,busy)+'</li>').join('')+'</ul>':'')+'</div>';
   return {title:renew?L('Renew credit','重新授信'):L('Modify credit','修改授信'),dismiss:true,
     html:'<div class="mc-cm">'+(!modify.invalid?err(''):'')+(renew?CF.note('',L('This credit expired on ','本授信已于 ')+date(c.expires)+L('. Renewal takes effect immediately; existing business continues.',' 到期。重新授信保存后立即生效，存量业务照常履约。')):'')+
       dl([[L('Credited company','被授信企业'),E(counter(r))],[L('Credit ID','授信编号'),'<span class="mono">'+E(r.id)+'</span>'],[L('Current limit','当前授信额度'),money(r.total)],[L('Used','授信已用额'),money(r.used)],[L('Valid until','当前有效期至'),date(c.expires)]])+
       '<div class="mc-cm-form">'+terms+field('remark',L('Remark (optional)','备注（选填）'),'<input class="inp" id="mc-cm-remark" maxlength="200" value="'+E(modify.remark)+'"'+off+'>')+files+'</div>'+
       '<p class="mc-small">'+L('Saving takes effect immediately without approval. It does not create a quote or change existing business.','保存后立即生效，无需审批；不生成报价，也不改变已有业务。')+'</p></div>',
     foot:b('cm-cancel',L('Cancel','取消'),'',false,busy)+b('cm-save',busy?L('Saving…','保存中…'):renew?L('Renew credit','确认重新授信'):L('Save changes','保存修改'),'',true,busy)};
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
   return '<div class="mc-return"><div><span>'+L('Opened from My console','来自我的控制台')+'</span>'+(sourceFault==='invalid'?'<p>'+L('Content does not exist or is not accessible.','内容不存在或无权访问。')+'</p>':sourceFault==='fallback'?'<p>'+L('Only this project could be opened. The original record has not been located.','当前仅到达同一项目，尚未定位原记录。')+'</p><div class="mc-small">'+E(ids.join(' · '))+'</div>':'<p class="mc-small">'+L('Read the original record here. To handle business, close the record and use the project’s existing actions.','在此阅读原记录；如需办理，请关闭记录并从项目既有入口选择。')+'</p>')+'</div>'+b('return',/^#\/console(\?|$)/.test(back)?L('Return to My console','返回我的控制台'):L('Return to console details','返回控制台详情'),back)+'</div>';
 }
 function reviewTools(){return '<div class="grp"><h5>'+L('Console partial faults','控制台局部故障')+'</h5>'+[['stats','Summary error','单项统计失败'],['tokens-error','Token snapshot error','代币读取失败'],['association-error','Association error','关联读取失败'],['association-none','No project association','无关联项目'],['association-denied','No accessible project','无可访问关联项目'],['association-unsupported','Project-only fallback','仅同项目定位降级'],['plan-error','Plan unavailable','还款计划加载失败'],['pending-error','Pending marks unavailable','待处理读取失败'],['usage-error','Credit usage records unavailable','授信使用记录读取失败'],['credit-save-fail','Next credit save fails','下次修改授信保存失败'],['session','Session expired','登录失效']].map(([v,en,zh])=>b('scenario',L(en,zh),v)).join('')+'<p class="hint">'+L('Fixtures are shared with the marketplace; no real payment is made.','演示数据与广场共用；不发起真实付款。')+'</p></div>';}

 CF.review.register('P-MC-01',{group:['My console','我的控制台'],route:'/console',parties:true,
   scenarios:()=>allowed()?tabs().map(k=>({id:k,label:names[k],route:'/console?tab='+k,description:['Open this record category','定位此类业务清单']})):[],
   states:()=>allowed()?['default','loading','empty','noresult','error','denied']:['default'],
   reset(){S.st='default';statsError=tokenError=associationError=planError=pendingError=usageError=false;associationScene='normal';}});
 kinds.forEach((k,i)=>CF.review.register('P-MC-0'+(i+2),{
   group:['My console · details','我的控制台 · 详情'],parties:true,visible:()=>k!=='projects'&&tabs().includes(k),
   scenarios:()=>allowed()?[...new Set(normalized(k).map(r=>r.status))].map(st=>{const r=normalized(k).find(r=>r.status===st);return {id:st,label:labels[st]||[st,st],route:r?detailHref(k,r.id):null,available:!!r,description:[text(titles[k])+' · '+r.id,text(titles[k])+' · '+r.id]};}):[],
   states:()=>allowed()?['default','loading','error',{id:'stale',label:['Action expired','动作失效'],group:'business'},'denied']:['default'],
   route:()=>{const r=normalized(k)[0];return r?detailHref(k,r.id):null;},
   get:()=>S.st==='denied'?'denied':detailState==='normal'?'default':detailState,
   set(value){S.st=value==='denied'?'denied':'default';detailState=['loading','error','stale'].includes(value)?value:'normal';},
   reset(){S.st='default';detailState='normal';statsError=tokenError=associationError=planError=pendingError=usageError=false;associationScene='normal';}
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
     if(key==='pending'){const k=view().tab,x=normalized(k).flatMap(r=>pendingItems(k,r)).find(x=>x.id===v);if(x)openSource(x.go[0],x.go[1],{period:x.go[2]});else CF.render();}
     if(key==='usage-open'){const [k,id]=v.split('|');goDetail(k,id);}
     if(key==='usage-page'){usagePage=Math.max(1,+v);CF.render();document.getElementById('mc-usage')?.focus({preventScroll:true});}
     if(key==='modify')startModify(v);
     if(key==='cm-save')saveModify();
     if(key==='cm-cancel'){modify={};CF.closeLayer();}
     if(key==='cm-remove'){captureModify();modify.files=modify.files.filter(f=>f.id!==v);CF.render();document.getElementById('mc-cm-files')?.focus();}
     if(key==='tab'){returnNotice=false;setView({tab:v,pending:'',filter:'',secondary:'',project:'',tokenType:'',query:'',periodState:'',sort:v==='credits'?'available-asc':'newest',page:1});}
     if(key==='clear'){S.st='default';returnNotice=false;S.menu=null;setView({pending:'',filter:'',secondary:'',project:'',tokenType:'',query:'',periodState:'',page:1});}
     if(key==='search')setView({query:document.getElementById('mc-query').value.trim(),page:1});

     if(key==='page')setView({page:Math.max(1,+v)});


     if(key==='list'||key==='return'){returnNotice=key==='return';navigate(safeRoute(v)||'#/console');}
     if(key==='section'){chapterTarget=v;const el=document.getElementById(v);el?.focus({preventScroll:true});el?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
     if(key==='copy'){copyValue=v;const fallback=()=>CF.openLayer('modal','mc-copy');try{navigator.clipboard?.writeText(v).then(()=>CF.toast(L('Copied','已复制')),fallback)||fallback();}catch(_){fallback();}}
     if(key==='scenario'){pendingError=v==='pending-error';usageError=v==='usage-error';saveFailOnce=v==='credit-save-fail'||saveFailOnce&&v!=='session';planError=v==='plan-error';statsError=v==='stats';tokenError=v==='tokens-error';associationError=v==='association-error';detailState=['loading','error','stale'].includes(v)?v:'normal';if(v.startsWith('association-'))associationScene=v.slice(12);else associationScene='normal';if(v==='session'){S.role='guest';S.layer=null;S.demo=false;}CF.render();}
     return true;
   },
   layers:{...old.layers,'mc-credit-modify':()=>modifyLayer(),'mc-source-unavailable':()=>({title:L('Content unavailable','内容不存在或无权访问'),html:'<p>'+L('Return to your console to view accessible records.','请返回控制台查看可访问记录。')+'</p>',foot:b('return',L('Return to console details','返回控制台详情'),safeRoute(params().get('mcReturn'))||'#/console')}),'mc-copy':()=>({title:L('Copy reference','复制编号'),html:'<input class="inp mc-copy-value" readonly value="'+E(copyValue)+'" aria-label="'+L('Reference number','完整编号')+'"><p>'+L('Select the text and copy it.','请选择文本后复制。')+'</p>',foot:'<button class="btn" data-act="closelayer">'+L('Close','关闭')+'</button>'})}
 };
 CF.define(CF.LSView=mod);
 const composed=mod.content;mod.content=id=>(id==='P-LS-01'||id==='P-LS-02'?backBanner():'')+composed(id);
 document.addEventListener('change',e=>{
   if(e.target.id==='mc-pending'&&path()==='/console'){returnNotice=false;setView({pending:e.target.checked?'1':'',page:1});return;}
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
   const row=e.target.closest('.mc-table tr[data-id]');if(row&&!e.target.closest('button,a,input,select,summary,details'))goDetail(row.dataset.kind,row.dataset.id);
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
 window.addEventListener('hashchange',()=>{chapterTarget='';planError=false;usagePage=1;});
 document.addEventListener('input',e=>{if(e.target.id!=='mc-cm-add')return;const c=rawCredit(modify.id),v=e.target.value.trim(),out=document.getElementById('mc-cm-after');if(c&&out)out.textContent=CF.fmtAmt(c.total+(/^\d+(\.\d{1,2})?$/.test(v)?+v:0));});
 document.addEventListener('change',e=>{if(e.target.id==='mc-cm-files'&&e.target.files?.length)pickFiles(e.target.files);});
 const headerObserver=new ResizeObserver(scheduleChapters);headerObserver.observe(document.querySelector('.portal-head'));
 CF.MC={normalized,find,destinations,safeRoute,get state(){return detailState;},attach(){CF.MCSeedPeriods?.();CF.render();}};
})(window.CF);
