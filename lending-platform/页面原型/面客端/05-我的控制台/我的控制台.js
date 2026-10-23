/* WS-450. Read-only console on the on-chain flow: offer pending on-chain, accept = on-chain disbursement, on-chain repayment.
 * Two writes only: modify credit and revoke an on-chain approval. No business deadline anywhere. */
(function(CF){
 'use strict';
 const S=CF.S,D=CF.LS,Q=CF.CQ,L=CF.L,E=CF.esc,old=CF.LSView,H=3600000,DAY=24*H;
 const kinds=['tokens','projects','credits','repayments','quotes','approvals'];
 const chainOnly=new Set(['offerPending','disbursing','repayPending','granting','revoking']);
 const listFilter=(raw,tab)=>tab==='approvals'?'':String(raw||'').split(',').filter(k=>k&&!chainOnly.has(k)&&!(tab==='repayments'&&k==='generating')).join(',');
 const pageIds={tokens:'P-MC-02',projects:'P-MC-03',credits:'P-MC-04',loans:'P-MC-05',repayments:'P-MC-06',quotes:'P-MC-07',approvals:'P-MC-08'};
 const names={tokens:['Tokens','代币列表'],projects:['Financing projects','融资项目'],credits:['Credit facilities','授信明细'],repayments:['Repayments','还款信息'],quotes:['My loan offers','我的报价'],approvals:['Approvals','链上授权']};
 const titles={tokens:['Token details','代币详情'],projects:['Project details','融资项目详情'],credits:['Credit details','授信详情'],loans:['Repayment details','还款业务详情'],repayments:['Repayment details','还款业务详情'],quotes:['Loan offer details','报价详情'],approvals:['Approval details','链上授权详情']};
 const labels={review:['Pending review','待审核'],returned:['Returned','已退回'],available:['Available','可用'],valid:['Valid','有效'],void:['Void','失效'],pledged:['Pledged','已质押'],unpledged:['Not pledged','未质押'],draft:['Draft','草稿'],raising:['Fundraising','募集中'],locked:['Locked','已锁定'],financing:['Financing','融资中'],closed:['Closed','已关闭'],settled:['Settled','已结清'],surplus:['Pledge surplus','质押充足'],balanced:['Pledge balanced','质押持平'],short:['Pledge shortfall','质押不足'],effective:['Effective','生效中'],expired:['Expired','已到期'],repaying:['Repaying','还款中'],waiting:['Awaiting acceptance','待接受'],offerPending:['Offer pending on-chain','报价上链确认中'],disbursing:['Disbursement processing on chain','链上放款处理中'],accepted:['Accepted','已接受'],rejected:['Rejected','已拒绝'],quoteEnded:['Quote invalidated','报价已失效'],due:['Awaiting repayment','待还款'],repayPending:['Repayment pending on-chain','还款上链确认中'],generating:['Plan generating','计划生成中'],open:['Awaiting quotes','待报价'],quoted:['Awaiting quote confirmation','已报价待确认'],funding:['Funding','放款中'],funded:['Disbursed','已放款'],ended:['Invalidated / closed','已失效／已关闭'],granting:['Approval processing','授权处理中'],granted:['Approved','已授权'],revoking:['Revoking','撤销处理中'],revoked:['Revoked','已撤销'],used:['Used','已使用'],unreadable:['Status unavailable','状态暂不可用']};
 const kindNames={tokens:['Token','代币'],projects:['Financing project','融资项目'],credits:['Credit facility','授信'],repayments:['Repayment','还款'],quotes:['Loan offer','报价'],approvals:['Approval','链上授权']};
 const text=a=>Array.isArray(a)?L(...a):a||'—';
 const nm=k=>k==='credits'&&S.role==='fund'?L('Credit summary','授信汇总'):text(names[k]);
 const status=k=>text(labels[k]||[k,k]);
 const badge=k=>CF.tag(['valid','settled','effective','surplus'].includes(k)?'ok':['short','unreadable'].includes(k)?'warn':['waiting','offerPending','disbursing','repayPending','generating','granting','revoking'].includes(k)?'accent':'',status(k));
 const money=(n,c='USD',icon=false)=>n==null?'—':'<span class="mc-money'+(icon?' mc-stat-money':'')+'">'+(icon?CF.assetIcon(c):'')+'<span class="mc-number">'+CF.fmtAmt(n)+'</span> <span class="mc-unit">'+E(c)+'</span></span>';
 const statMoney=(n,c='USD')=>money(n,c,true);
 /* 企业概览的统计金额缩写为 K / M / B，点开下拉读取完整金额；明细金额不缩写。 */
 function compactMoney(n,c='USD',icon=true){
   if(n==null||!Number.isFinite(+n))return '—';
   const unit=[[1e9,'B'],[1e6,'M'],[1e3,'K']].find(([v])=>Math.abs(n)>=v);
   if(!unit)return money(n,c,icon);
   const short=(n/unit[0]).toFixed(2)+unit[1],full=CF.fmtAmt(n)+' '+c;
   return '<details class="mc-money-peek"><summary title="'+E(full)+'" aria-label="'+E(full+' · '+L('Show full amount','查看完整金额'))+'"><span class="mc-money'+(icon?' mc-stat-money':'')+'">'+(icon?CF.assetIcon(c):'')+'<span class="mc-number">'+E(short)+'</span> <span class="mc-unit">'+E(c)+'</span></span></summary><div class="mc-money-exact"><span>'+L('Full amount','完整金额')+'</span>'+money(n,c)+'</div></details>';
 }
 const time=n=>n==null||!Number.isFinite(new Date(n).getTime())?'—':CF.fmtTime(new Date(n).toISOString());
 const stamp=n=>n==null||!Number.isFinite(new Date(n).getTime())?'—':'<time datetime="'+E(new Date(n).toISOString())+'" title="'+E(time(n))+'">'+E(CF.fmtStamp(new Date(n).toISOString()))+'</time>';
 const date=n=>n?CF.fmtDate(typeof n==='number'?new Date(n).toISOString():n):'—';
 const small=s=>'<div class="mc-small">'+s+'</div>';
 /* Match asset-market artwork by exact token number; never infer a brand from its symbol. */
 const tokenMarks=['<circle cx="12" cy="12" r="6.5"/>','<path d="M12 4.5 19.5 18h-15L12 4.5Z"/>','<rect x="6" y="6" width="12" height="12" rx="2.5" transform="rotate(45 12 12)"/>','<path d="M6 6h5.2v5.2H6zM12.8 6H18v5.2h-5.2zM6 12.8h5.2V18H6zM12.8 12.8H18V18h-5.2z"/>'];
 function tokenIdentity(r){
   const source=CF.AM?.TOKENS?.find(t=>t.no===r.id),name=text(r.name||source?.name||(source?CF.AM.CONTRACT.name:null)),logo=r.logo||source?.logo;
   const mark=logo&&tokenMarks[logo.shape]?'<span class="tok-mark mc-token-logo" data-hue="'+E(logo.hue)+'" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor">'+tokenMarks[logo.shape]+'</svg></span>':'<span class="mc-token-logo mc-logo-empty" role="img" aria-label="'+L('No token logo supplied','未提供代币图标')+'">—</span>';
   return '<span class="mc-token-identity">'+mark+'<span>'+E(name)+'</span></span>';
 }
 const tokenNetwork=r=>CF.market.network(r.network||r.chain||(CF.AM?.TOKENS?.some(t=>t.no===r.id)?CF.AM.CHAIN:D.PLEDGE_CHAIN));
 const approvalNetwork=r=>CF.market.network(r.rec?.network||(r.type==='loan'?D.project(r.project)?.network:D.PLEDGE_CHAIN)||D.PLEDGE_CHAIN);
 const projectIdentity=p=>p?E(text(p.name))+'<span class="mc-small mc-project-id mono">'+E(p.id)+'</span>':'—';
 function relatedProjects(ps){
   if(ps.length<2)return projectIdentity(ps[0]);
   return '<details class="mc-related-projects"><summary aria-label="'+E(text(ps[0].name)+' · '+ps[0].id+' · '+L('Expand associated projects','展开关联项目'))+'"><span>'+projectIdentity(ps[0])+'</span></summary><ul>'+ps.slice(1).map(p=>'<li>'+projectIdentity(p)+'</li>').join('')+'</ul></details>';
 }
 /* 控制台没有任何业务时限：等待只如实累计已过去的时长，不做截止时点、剩余时长、倒计时或超期表达。 */
 const elapsed=ms=>{const v=Math.max(0,+ms||0),d=Math.floor(v/DAY),h=Math.floor(v/H);return d>=1?d+L(d>1?' days':' day',' 天'):h>=1?h+L(h>1?' hours':' hour',' 小时'):L('under an hour','不足 1 小时');};
 const since=ms=>ms==null?'—':elapsed(ms);
 const b=(a,t,v='',primary=false,off=false,extra='')=>'<button type="button" class="btn'+(primary?' primary':'')+'" data-act="mc-'+a+'" data-v="'+E(v)+'"'+(off?' disabled':'')+extra+'>'+E(t)+'</button>';
 const link=(a,t,v='',extra='')=>a==='detail'&&!extra.includes('disabled')?'<a class="actlink" href="'+E(detailHref(...v.split('|')))+'" data-act="mc-detail" data-v="'+E(v)+'" '+extra+'>'+E(t)+'</a>':'<button type="button" class="actlink" data-act="mc-'+a+'" data-v="'+E(v)+'" '+extra+'>'+E(t)+'</button>';
 const dl=rows=>'<dl class="dl mc-facts">'+rows.filter(Boolean).map(([k,v])=>'<div class="mc-fact"><dt>'+E(k)+'</dt><dd>'+v+'</dd></div>').join('')+'</dl>';
 const copy=v=>v==null||v===''?'—':'<span class="copy-pair"><span class="mono">'+E(v)+'</span>'+CF.copyBtn('mc-copy',v,L('Copy','复制'))+'</span>';
 /* 地址前 6 后 4、交易标识前 10 后 8；复制给出完整值。 */
 const maskAddr=a=>a?a.slice(0,6)+'…'+a.slice(-4):'—';
 const maskTx=h=>h?h.slice(0,10)+'…'+h.slice(-8):'—';
 const copyMasked=(v,mask,label)=>v?'<span class="copy-pair"><span class="mono" title="'+E(v)+'">'+E(mask(v))+'</span>'+CF.copyBtn('mc-copy',v,label||L('Copy full value','复制完整值'))+'</span>':'—';
 const tabs=()=>S.role==='fund'?['quotes','credits','repayments','approvals']:['tokens','projects','credits','repayments','approvals'];
 const allowed=()=>['asset','fund'].includes(S.role);
 const path=()=>location.hash.slice(1).split('?')[0];
 const params=()=>new URLSearchParams(location.hash.split('?')[1]||'');
 const now=()=>CF.L8?.now||CF.L7?.now()||D.now();
 const party=q=>Q.related(q);
 const fund=id=>id==='fund-b'?L('Demo Capital B','演示资金机构 B'):L('Demo Capital A','演示资金机构 A');
 const owner=id=>id==='entity-demo-a'?L('Demo Asset Company A','演示资产企业 A'):L('Demo Asset Company B','演示资产企业 B');
 const counter=q=>S.role==='asset'?fund(q.fund):owner(q.owner);
 /* 放款合约按组合共用；地址为演示取值。预估 gas 同为演示值，以钱包实际估算为准。 */
 const LOAN_CONTRACT='0x3B6dA2c94E07f1a85D2c6E40b9F17a3C8e05D2a7',REVOKE_GAS='0.000046';
 const SUPPORT=()=>L('On-chain result to be verified. Please contact platform support.','链上结果待核实，请联系平台客服人员。');
 let sourceOpened='',sourceFault='',associationScene='normal';
 let pendingError=false,usageError=false,usagePage=1,saveFailOnce=false,modify={},detailState='normal',planError=false,statsError=false,tokenError=false,associationError=false,approvalError=false,focusAfter='',lastHash='',lastRole=S.role+'|'+JSON.stringify(S.party),restoring=false,copyValue='',returnNotice=false;
 let revokeScene='success',revokeBusy='',revokeTarget='',revokeNotes={};
 CF.PAGES['P-MC-01'].retainList=true;
 const dict={en:{},zh:{}};
 [...kinds,'loans'].forEach(k=>{const id=pageIds[k],key='mcDetail'+k;CF.PAGES[id]={end:'asset',layout:'portal',parent:'P-MC-01',crumbKey:key,auth:true,retainList:true};CF.ENTRY[id]='/console/'+k;dict.en[key]=titles[k][0];dict.zh[key]=titles[k][1];});
 function safeRoute(raw,detail=true){
   if(!raw||raw.length>12000||!/^#\/console(?:\?|$|\/(tokens|projects|credits|repayments|quotes|approvals)\?)/.test(raw))return '';
   const p=raw.slice(1).split('?')[0];if(p!=='/console'&&(!detail||!kinds.some(k=>p==='/console/'+k)))return '';
   const q=new URLSearchParams(raw.split('?')[1]||'');if(p!=='/console'&&!q.get('id'))return '';
   const clean=new URLSearchParams();['tab','pending','filter','secondary','project','address','sort','size','page','y','scroll','focus','id','period','application','query','periodState','targetProject','tokenType'].forEach(k=>{if(q.has(k))clean.set(k,q.get(k).slice(0,160));});
   if(detail&&q.has('list')){const list=safeRoute(q.get('list'),false);if(list)clean.set('list',list);}
   return '#'+p+(clean.size?'?'+clean:'');
 }
 function view(){const q=params(),tab=tabs().includes(q.get('tab'))?q.get('tab'):tabs()[0];return {tab,pending:pendingTabs().includes(tab)&&q.get('pending')==='1'?'1':'',filter:listFilter(q.get('filter'),tab),secondary:q.get('secondary')||'',project:q.get('project')||'',address:q.get('address')||'',tokenType:q.get('tokenType')||'',query:q.get('query')||'',periodState:listFilter(q.get('periodState'),'repayments'),sort:q.get('sort')||(tab==='credits'?'available-asc':'newest'),size:[20,50,100].includes(+q.get('size'))?+q.get('size'):20,page:Math.min(100000,Math.max(1,parseInt(q.get('page'))||1))};}
 function listRoute(k){return safeRoute(params().get('list'),false)||'#/console?tab='+k;}
 function detailHref(k,id){if(k==='projects'){const r=find(k,id),p=r&&D.project(r.id);if(p)return sourceHref(k,r,p,{back:location.hash});}return '#/console/'+k+'?'+new URLSearchParams({id,list:path()==='/console'?location.hash:listRoute(k)});}
 function snapshot(){
   const q=params();q.set('y',Math.round(window.scrollY));q.set('scroll',Math.round(document.getElementById('mc-list')?.scrollTop||0));
   const f=document.activeElement?.closest('[data-id]')?.dataset.id;if(f)q.set('focus',f);
   const hash='#'+path()+'?'+q;try{history.replaceState(null,'',hash);}catch(_){}return hash;
 }
 function navigate(hash){S.layer=null;S.st='default';detailState='normal';location.hash=hash;}
 function goDetail(k,id){
   /* 融资项目的详情就是借贷广场项目详情；资产方的在途报价使用记录到借贷广场原申请。 */
   if(k==='projects')return openSource('projects',id);
   if(k==='quotes-source')return openSource('quotes',id);
   let list=path()==='/console'?snapshot():listRoute(k);if(path()==='/console'){const q=new URLSearchParams(list.split('?')[1]||'');q.set('focus',id);list='#/console?'+q;}navigate('#/console/'+k+'?'+new URLSearchParams({id,list}));}
 function setView(patch){const v={...view(),...patch};focusAfter=Object.keys(patch)[0];navigate('#/console?'+new URLSearchParams(v));}

 /* ---------- 业务事实：报价、链上放款、还款与链上授权都取借贷广场同一份演示数据，不另算口径 ---------- */
 const holding=x=>['processing','unknown'].includes(x?.state);
 const offers=()=>(Q.data().pending||[]).filter(x=>holding(x)&&party(x));
 const chainOf=q=>['processing','unknown'].includes(q?.chain?.state)?q.chain.state:'';
 function quoteStatus(q){
   if(q.offer)return 'offerPending';
   if(q.state==='waiting'||q.state==='funding')return chainOf(q)||q.state==='funding'?'disbursing':'waiting';
   if(q.state==='funded'||q.state==='terminated'||q.l7)return q.l8?.settledAt||q.l7?.state==='settled'?'settled':'repaying';
   return {rejected:'rejected',expired:'quoteEnded'}[q.state]||q.state;
 }
 /* 本笔链上授权状态：撤销上链成功（含平台外撤销）为已撤销；撤销处理中不能重复发起；放款成功即已使用。 */
 function grantStatus(rec,used=false){
   if(!rec)return '';
   if(rec.revoked||rec.revoke?.state==='success')return 'revoked';
   if(rec.revoke?.state==='processing')return 'revoking';
   if(used)return 'used';
   return 'granted';
 }
 const offerRow=x=>({...x,offer:true,id:x.id,q:x,request:x.demand,business:null,status:'offerPending',signedAt:x.at,at:x.at,waited:now()-x.at,unknown:x.state==='unknown',approval:'granting',refs:[x.demand]});
 function quoteRow(q){
   const st=quoteStatus(q),c=chainOf(q),end=st==='waiting'||st==='disbursing'?now():(q.done||now());
   return {...q,q,deal:q.l7,request:q.demand,business:q.id,status:st,chainState:c,locked:Math.max(0,end-q.at),waited:c&&q.chain?.at?now()-q.chain.at:null,lastFail:q.state==='waiting'&&q.chain?.state==='failed',approval:q.lender?grantStatus(q.auth,st==='repaying'||st==='settled'||q.auth?.used):'',refs:[q.demand,q.id]};
 }
 function quoteRows(){return [...offers().map(offerRow),...Q.data().quotes.filter(party).map(quoteRow)];}
 function lateDays(p){return Math.max(0,Math.floor((Date.parse(new Date(now()).toISOString().slice(0,10))-Date.parse(p.due))/DAY));}
 function repaymentRow(q){
   const deal=q.l7,plan=q.l8,periods=(plan?.periods||[]).map(p=>{const chain=p.chain||(p.state==='pending'?p.record:null);return {...p,status:p.state==='pending'?'repayPending':p.state==='settled'?'settled':'due',chain,unknown:chain?.state==='unknown',overdue:p.state==='settled'?(p.record?.overdue||0):p.state==='pending'?(chain?.overdue??lateDays(p)):lateDays(p),waiting:p.state==='pending'&&chain?now()-Date.parse(chain.at):null};});
   const current=periods.filter(p=>p.state==='due').sort((a,b)=>a.due.localeCompare(b.due)||a.seq-b.seq)[0]||null,pending=periods.filter(p=>p.state==='pending');
   const loan={id:deal.record.id,amount:deal.settlement,ccy:deal.ccy,at:deal.confirmedAt||deal.record.at,fund:q.fund};
   return {id:q.id,business:q.id,project:q.project,request:q.demand,q,deal,plan,periods,current,pending,loan,status:plan?.settledAt||deal.state==='settled'?'settled':'repaying',planState:plan?'final':'generating',due:current?.due,at:loan.at,overdue:periods.some(p=>p.state!=='settled'&&p.overdue>0),amount:q.amount,refs:[q.demand,q.id,deal.record.id]};
 }
 function approvalRows(){
   if(S.role==='fund'){
     const fromQuotes=Q.data().quotes.filter(q=>q.fund===Q.fund()&&q.lender&&q.auth).map(q=>{const r=quoteRow(q);return {id:q.id,type:'loan',q,address:q.lender.address,addressLabel:q.lender.label,contract:LOAN_CONTRACT,ccy:q.ccy,amount:q.settlement,project:q.project,request:q.demand,business:q.id,quote:r.status,status:r.approval,rec:q.auth,at:q.auth.at,signedAt:q.auth.at,refs:[q.demand,q.id]};});
     const fromOffers=offers().filter(x=>x.fund===Q.fund()&&x.lender).map(x=>({id:x.id,type:'loan',q:x,offer:true,address:x.lender.address,addressLabel:x.lender.label,contract:LOAN_CONTRACT,ccy:x.ccy,amount:x.settlement,project:x.project,request:x.demand,business:null,quote:'offerPending',status:'granting',rec:null,at:x.at,signedAt:x.at,unknown:x.state==='unknown',refs:[x.demand]}));
     return [...fromOffers,...fromQuotes];
   }
   if(S.role!=='asset')return [];
   /* 质押授权：持有地址 × 发行合约 × 质押合约一条；授权上链失败的没有授权，不列入；已撤销的记录保留供追溯。 */
   const holders=D.HOLDERS[D.me()]||[];
   return D.approvals.filter(a=>holders.includes(a.holder)&&['processing','success'].includes(a.state)).map(a=>({id:a.id,type:'pledge',address:a.holder,addressLabel:accountLabel(D.me(),a.holder),contract:a.contract,issuer:a.issuer,kind:D.type('erc20-ar').label,projects:D.projects.filter(p=>p.owner===D.me()&&p.contract===a.contract),status:a.state==='processing'?'granting':grantStatus(a),rec:a,at:a.done||a.at,signedAt:a.at,refs:[]}));
 }
 function accountLabel(who,address){const a=(Q.accounts(who,'crypto')||[]).find(x=>(x.address||'').toLowerCase()===String(address).toLowerCase());return a?Q.accountName?.(a)||a.label||'':'';}
 const addrName=r=>r.addressLabel?(Array.isArray(r.addressLabel)?L(...r.addressLabel):r.addressLabel):'';
 /* 能否撤销按最新事实判断：放款授权只有报价已拒绝或已失效可撤销；质押授权在该地址没有涉及该发行合约的质押上链处理中时可撤销。 */
 function revocable(r){
   if(approvalError)return {ok:false,reason:L('Approval status is temporarily unavailable, so it cannot be revoked now. Reload this URL in your browser to try again.','授权状态暂不可用，暂不能撤销。请使用浏览器刷新当前网址重试。')};
   if(r.status==='revoking')return {ok:false,reason:L('A revocation is processing. It cannot be started again.','撤销处理中，不能重复发起。')};
   if(r.status==='revoked')return {ok:false,reason:L('This approval has been revoked.','该授权已撤销。')};
   if(r.status==='granting')return {ok:false,reason:L('Waiting for the approval result on chain.','等待授权上链结果。'),short:L('Awaiting approval result','等待授权上链结果')};
   if(r.type==='loan'){
     if(r.status==='used')return {ok:false,reason:L('The approval has been used for this disbursement.','授权已按本笔放款使用。'),short:L('Used for this disbursement','已按本笔放款使用')};
     if(r.quote==='disbursing')return {ok:false,reason:L('The disbursement is being executed.','放款正在执行。'),short:L('Disbursement executing · not revocable','放款执行中，不能撤销')};
     if(r.quote==='waiting')return {ok:false,reason:L('An offer awaiting acceptance cannot have its approval revoked. You can revoke it once the offer is rejected or its request is invalidated.','待接受的报价不能撤销放款授权，报价被拒绝或所属需求失效后才能撤销。'),short:L('Awaiting acceptance · not revocable yet','待接受，暂不能撤销')};
     return ['rejected','quoteEnded'].includes(r.quote)?{ok:true}:{ok:false,reason:L('Not revocable for the current offer stage.','本笔报价当前阶段不能撤销。')};
   }
   const busy=D.tokens.some(t=>t.pending&&D.holderOf(t)===r.address&&D.issuerOf(t)===r.issuer&&(D.project(t.pool||t.releasedFrom)?.contract===r.contract));
   return busy?{ok:false,reason:L('A pledge from this address under this issuing contract is processing on chain. Wait for the pledge result.','该地址有涉及该发行合约的质押上链处理中，请等待质押结果。'),short:L('Pledge processing · not revocable yet','质押上链处理中，暂不能撤销')}:{ok:true};
 }
 function normalized(k){
   if(!allowed())return [];
   if(CF.L7)void CF.L7.deals;
   const related=Q.data().quotes.filter(party),ownProjects=D.projects.filter(p=>D.mine(p));
   if(k==='tokens')return tokenSnapshot();
   if(k==='projects')return S.role==='asset'?ownProjects.map(p=>({...p,project:p.id,status:p.state,n:D.numbers(p),amount:D.current(p)?.amount??null,at:p.created||p.published})):[];
   if(k==='credits')return Q.data().credits.filter(c=>S.role==='asset'?c.owner===D.me():c.fund===Q.fund()).map(c=>{
     /* 在途报价金额含报价上链确认中的预占。 */
     const transit=Q.data().quotes.filter(q=>q.owner===c.owner&&q.fund===c.fund&&['waiting','funding'].includes(q.state)).reduce((n,q)=>n+q.amount,0)+(Q.data().pending||[]).filter(x=>x.owner===c.owner&&x.fund===c.fund&&holding(x)).reduce((n,x)=>n+x.amount,0),expired=Date.parse(c.expires+'T23:59:59Z')<now();
     return {...c,status:expired?'expired':'effective',transit,available:Math.max(0,c.total-c.principal-transit),used:c.principal+transit,at:c.first};});
   if(k==='repayments')return related.filter(q=>q.l7?.record&&['confirmed','settled'].includes(q.l7.state)).map(repaymentRow);
   if(k==='quotes')return quoteRows();
   if(k==='approvals')return approvalRows();
   return [];
 }
 /* 每个筛选项可多选，取值按逗号串保存；空串代表不限。 */
 const picks=value=>String(value||'').split(',').filter(Boolean);
 const within=(value,candidate)=>{const l=picks(value);return !l.length||l.includes(String(candidate));};
 const searchable=k=>['repayments','quotes'].includes(k)||k==='approvals'&&S.role==='fund';
 function matches(r,v){
   const repayment=v.tab==='repayments';
   if(v.tokenType&&!within(v.tokenType,r.kind))return false;
   if(v.tab==='approvals'&&!within(v.address,r.address))return false;
   return (!v.filter||picks(v.filter).some(f=>f==='generating'?r.planState==='generating':(v.tab==='approvals'&&approvalError?'unreadable':r.status)===f))&&
     (v.tab==='tokens'?!picks(v.project).length||picks(v.project).some(id=>r.projects.includes(id)):v.tab==='approvals'||within(v.project,r.project))&&
     (!v.query||(r.refs||[r.id]).includes(v.query.trim()))&&
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
   if(associationScene==='none'&&k==='tokens')return {projects:[],reason:L('No associated financing project','暂无关联融资项目')};
   if(associationScene==='denied'&&k==='tokens')return {projects:[],reason:L('No accessible associated project','暂无可访问关联项目')};
   if(associationError)return {projects:[],reason:L('Project associations unavailable. Reload this URL in your browser.','关联项目暂不可用，请使用浏览器刷新当前网址。')};
   const ids=[...new Set(k==='tokens'?r.projects:k==='approvals'?(r.projects||[]).map(p=>p.id).concat(r.project?[r.project]:[]):[k==='projects'?r.id:r.project].filter(Boolean))];
   const projects=ids.map(id=>D.project(id)).filter(p=>p&&(D.mine(p)||!!p.published));
   return {projects,reason:!ids.length?L('No associated financing project','暂无关联融资项目'):!projects.length?L('No accessible associated project','暂无可访问关联项目'):''};
 }
 function destination(k,r){const d=destinations(k,r);return d.projects.length===1?d.projects[0]:d.projects.find(p=>p.id===params().get('targetProject'));}
 function sourceHref(k,r,p,o={}){
   const q=new URLSearchParams({mcReturn:o.back||location.hash,mcKind:k,mcObject:r.id});
   if(associationScene==='unsupported')q.set('mcFallback','1');
   const application=k==='projects'?o.application:k==='approvals'?'':r.request;
   if(application)q.set('mcApplication',application);
   if(k==='repayments'&&o.period){q.set('mcPeriod',o.period.id);if(o.period.record)q.set('mcRecord',o.period.record.id);}
   return '#/project/'+encodeURIComponent(p.id)+'?'+q;
 }
 function jump(k,id){
   const r=find(k,id),p=r&&destination(k,r);if(!p){CF.toast(L('Select an accessible associated project.','请选择可访问的关联项目。'));CF.render();return;}
   navigate(sourceHref(k,r,p,{back:snapshot(),application:params().get('application'),period:selectedPeriod(r)}));
 }
 /* 待处理、融资项目记录与授信使用记录的去向由记录本身确定，不需要再选项目。 */
 function openSource(k,id,o={}){
   const r=find(k,id),p=r&&D.project(k==='projects'?r.id:r.project);
   if(!r||!p||!destinations(k,r).projects.some(x=>x.id===p.id)){CF.toast(L('Content unavailable','内容不存在或无权访问'));return;}
   navigate(sourceHref(k,r,p,{back:o.back||snapshot(),application:o.application,period:o.period&&r.periods?.find(x=>x.id===o.period)}));
 }
 function controls(k,r){const d=destinations(k,r),target=destination(k,r);
   return (d.projects.length>1?'<div class="mc-project-field"><label for="mc-targetProject">'+L('Associated financing project','关联融资项目')+'</label>'+select('targetProject',L('Associated financing project','关联融资项目'),[['',L('Select a project','请选择项目')],...d.projects.map(p=>[p.id,text(p.name)+' · '+p.id])],target?.id||'')+'</div>':'')+
     b('jump',k==='approvals'?L('Open project in lending marketplace','查看关联项目'):L('Go to lending marketplace','前往借贷广场'),k+'|'+r.id,k!=='approvals',!target)+(d.reason?'<p class="mc-small" role="status">'+E(d.reason)+'</p>':'');
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
 const reasonText=v=>{if(!v)return '—';if(reasonNames[v])return L(...reasonNames[v]);const parts=String(v).split(' / ');return parts.length===2?L(parts[1],parts[0]):String(v);};
 function stat(title,value,note='',tone=''){return '<div class="s"'+(tone?' data-tone="'+tone+'"':'')+'><div class="k">'+E(title)+'</div><div class="v">'+value+'</div>'+(note?'<div class="n">'+note+'</div>':'')+'</div>';}
 function summary(){
   if(S.st==='loading')return CF.skelTable(2);
   const empty=S.st==='empty',tokens=empty?[]:normalized('tokens'),credits=empty?[]:normalized('credits'),sum=(rs,k)=>rs.reduce((n,r)=>n+(+r[k]||0),0),pledged=tokens.filter(r=>r.pledged);
   let assets='';
   if(S.role==='asset'&&(tokenError||!Array.isArray(D.tokens)))assets='<section class="card mc-assets">'+CF.empty(L('Token summary unavailable','代币统计暂不可用'),reloadHint(),'')+'</section>';
   let holdings='';
   if(S.role==='asset'&&!assets){
     holdings=stat(L('All tokens','全部代币'),tokens.length+'<span class="mc-count-unit">'+L(' tokens',' 张')+'</span>',compactMoney(sum(tokens,'value'),'USD'),'accent')+
       stat(L('Of which pledged','其中已质押'),pledged.length+'<span class="mc-count-unit">'+L(' tokens',' 张')+'</span>',compactMoney(sum(pledged,'value'),'USD'),'info');
   }
   return assets+'<div class="stat-strip mc-summary'+(holdings?' mc-summary--asset':'')+'">'+holdings+(statsError?stat(L('Total credit','总授信额度'),'—',E(reloadHint())):stat(L('Total credit','总授信额度'),compactMoney(sum(credits,'total'),'USDT'),credits.length+L(' facilities',' 笔授信'),'accent'))+stat(L('Financed balance','已融额度'),compactMoney(empty?0:S.role==='asset'?sum(normalized('projects'),'balance'):sum(credits,'principal'),'USDT'),(empty?0:normalized('repayments').filter(r=>r.status!=='settled').length)+L(' unsettled businesses',' 笔未结清业务'),'info')+stat(L('Available credit','剩余可用授信'),compactMoney(sum(credits,'available'),'USDT'),'','pos')+'</div>'+(S.role==='asset'?'<p class="mc-small mc-scope">'+L('Whole-token totals do not represent available holdings or financing capacity.','整笔代币统计不代表可用份额或可融额度。')+'</p>':'');
 }
 const filterOptions={tokens:['valid','void'],projects:['review','returned','available','raising','locked','financing','closed','settled'],credits:['effective','expired'],repayments:['repaying','settled'],quotes:['waiting','rejected','quoteEnded','repaying','settled']};

 function select(key,title,options,value){return CF.filterSelect('mc-'+key,title,options,value,'');}
 function pick(key,title,options,value){return CF.filterMenu('mc-'+key,title,options.filter(o=>o[0]!==''),picks(value));}
 function filters(){const v=view(),all=['',L('All','全部')];
   let h=v.tab==='approvals'?'':pick('filter',v.tab==='tokens'?L('Token status','代币状态'):v.tab==='projects'?L('Project status','项目状态'):v.tab==='approvals'?L('Approval status','链上授权状态'):v.tab==='repayments'?L('Business status','业务状态'):L('Status','状态'),[all,...(filterOptions[v.tab]||[]).map(k=>[k,status(k)])],v.filter);
   const sec=v.tab==='tokens'?['pledged','unpledged']:v.tab==='projects'?['surplus','balanced','short']:v.tab==='repayments'?['yes','no']:[];
   if(sec.length)h+=pick('secondary',v.tab==='tokens'?L('Pledge status','质押状态'):v.tab==='projects'?L('Pledge sufficiency','质押情况'):L('Repayment overdue','还款是否逾期'),[all,...sec.map(k=>[k,k==='yes'?L('Yes','是'):k==='no'?L('No','否'):status(k)])],v.secondary);
   if(['tokens','projects'].includes(v.tab))h+=pick('tokenType',L('Token type','代币类型'),[['erc20-ar',text(D.type('erc20-ar').label)]],v.tokenType);
   if(v.tab==='tokens')h+=pick('project',L('Project','所属融资项目'),[all,...normalized('projects').map(p=>[p.id,text(p.name)])],v.project);
   if(v.tab==='repayments')h+=pick('periodState',L('Contains instalments','包含期次状态'),[all,...['due','settled'].map(k=>[k,status(k)])],v.periodState);
   if(v.tab==='approvals'){const seen=new Map();normalized('approvals').forEach(r=>{if(!seen.has(r.address))seen.set(r.address,(addrName(r)?addrName(r)+' · ':'')+maskAddr(r.address));});h+=pick('address',L('Approval address','授权地址'),[...seen].map(([k,t])=>[k,t]),v.address);}
   if(searchable(v.tab))h+=CF.filterSearch('mc-query',L('Reference number','完整编号'),v.query,v.tab==='repayments'?L('Application, business or disbursement number','融资申请 / 业务 / 放款编号'):L('Application or business number','融资申请 / 融资业务编号'));
   const sorts=v.tab==='tokens'?[['newest',L('Newest issuance','签发时间倒序')],['value-asc',L('Value: low to high','价值升序')],['value-desc',L('Value: high to low','价值降序')],['due-asc',L('Due date: earliest','到期日升序')],['due-desc',L('Due date: latest','到期日降序')]]:v.tab==='repayments'?[['newest',L('Newest disbursement','放款成功时间倒序')],['due-asc',L('Due date: earliest','应还日升序')],['due-desc',L('Due date: latest','应还日降序')]]:v.tab==='credits'?[['available-asc',L('Available credit: low to high','可用授信升序')],['available-desc',L('Available credit: high to low','可用授信降序')]]:v.tab==='approvals'?[['newest',L('Newest approval','授权时间倒序')]]:v.tab==='quotes'?[['newest',L('Newest offer','报价时间倒序')]]:[['newest',L('Newest first','时间倒序')]];
   h+=select('sort',L('Sort','排序'),sorts,v.sort);
   const describe=[v.pending&&!pendingError?L('Awaiting your action only','只看待处理'):'',v.tokenType?text(D.type('erc20-ar').label):'',picks(v.filter).map(status).join(' / '),picks(v.secondary).map(k=>k==='yes'?L('Overdue','逾期'):k==='no'?L('Not overdue','未逾期'):status(k)).join(' / '),picks(v.periodState).map(status).join(' / '),v.query,picks(v.project).join(' / '),picks(v.address).map(maskAddr).join(' / ')].filter(Boolean).join(' · ');
   return '<div class="filterbar mc-filters">'+h+'<div class="fb-acts">'+pendingToggle(v)+(searchable(v.tab)?b('search',L('Search','查询'),'',true):'')+b('clear',L('Reset filters','清空筛选'))+'</div></div>'+(pendingError&&pendingTabs().includes(v.tab)?'<div class="mc-filter-note" role="status">'+L('Records awaiting your action are temporarily unavailable. ','待处理情况暂不可用，')+reloadHint()+'</div>':'')+(Object.keys(v).some(k=>FILTERS.includes(k)&&v[k]&&!(k==='pending'&&pendingError))?'<div class="mc-filter-note" role="status">'+L('Filtered by: ','已按以下条件过滤：')+E(describe)+'</div>':'');
 }
 function columns(k){return {
   tokens:[[L('Token','代币编号'),'id'],[L('Blockchain network','区块链网络'),''],[L('Token name','代币名称'),''],[L('Quantity','数量'),'num'],[L('Value (USD)','价值（USD）'),'num'],[L('Token status','代币状态'),''],[L('Pledge status','质押状态'),''],[L('Receivable due','应收账款到期日'),''],[L('Project','所属项目'),'']],
   projects:[[L('Project','融资项目'),'id'],[L('Status','项目状态'),''],[L('Current request','当前融资需求'),'num'],[L('Request status','需求状态'),''],[L('Financed balance','已融资余额'),'num'],[L('Pledge sufficiency','质押情况'),''],[L('Project deadline','项目截止日'),'']],
   credits:[[L('Facility / counterparty','授信编号／对方企业'),'id'],[L('Credit limit (USDT)','授信额度（USDT）'),'num'],[L('Used (USDT)','已用授信（USDT）'),'num'],[L('Available (USDT)','可用授信（USDT）'),'num'],[L('Status','额度状态'),''],[L('Valid until','有效期至'),'']],
   quotes:[[L('Project / application','项目／融资申请'),'id'],[L('Asset holder','资产方'),''],[L('Requested (USDT)','融资需求（USDT）'),'num'],[L('Result / stage','报价结果／业务阶段'),''],[L('Offered at (','报价时间（')+(S.tz||'UTC')+L(')','）'),'']],
   repayments:[[L('Project / application','项目／融资申请'),'id'],[S.role==='asset'?L('Lending institution','放款机构'):L('Financing company','融资企业'),''],[L('Disbursed amount','放款金额'),'num'],[L('Disbursed on / ID','放款时间／编号'),''],[L('Current instalment','本期应还'),'num'],[L('Due date (UTC)','应还日（UTC）'),''],[L('Repayment status','还款状态'),'']],
   approvals:[[L('Approval address','授权地址'),'id'],[L('Blockchain network','区块链网络'),''],[L('Approved contract','被授权合约'),''],[L('Scope','授权范围'),S.role==='fund'?'num':''],[L('Related business','关联业务'),'']]
 }[k];}
 /* 项目当前轮的链上处理中：只给事实与已等待时长，不是新的需求状态，期间不标待处理。 */
 function roundChain(p,d){
   const busy=(p.attempts||[]).find(x=>x.state==='processing'),offer=d&&(Q.data().pending||[]).find(x=>x.project===p.id&&x.demand===d.id&&holding(x)),q=d&&Q.data().quotes.find(x=>x.project===p.id&&x.demand===d.id&&chainOf(x));
   const x=busy?[L('Publishing on chain','发布处理中'),busy.at]:d?.edit?.state==='processing'?[L('Amount change freezing on chain','改额冻结处理中'),d.edit.at]:d?.withdraw?.state==='processing'?[L('Withdrawal processing on chain','撤下处理中'),d.withdraw.at]:offer?[L('Institution offer pending on-chain','机构报价上链确认中'),offer.at,offer.state==='unknown']:q?[L('On-chain disbursement processing','链上放款处理中'),q.chain.at,q.chain.state==='unknown']:null;
   if(!x)return '';
   return '<span class="mc-chain">'+E(x[0])+(x[1]?' · '+L('waited ','已等待 ')+elapsed(now()-Date.parse(new Date(x[1]).toISOString())):'')+'</span>'+(x[2]?small(E(SUPPORT())):'');
 }
 function rowValues(k,r){const object=t=>'<a class="mc-object" href="'+E(detailHref(k,r.id))+'" data-act="mc-detail" data-v="'+k+'|'+E(r.id)+'">'+E(t)+'</a>';
   if(k==='tokens')return [object(r.id),tokenNetwork(r),tokenIdentity(r),CF.fmtAmt(r.units),CF.fmtAmt(r.value),badge(r.status),badge(r.pledged?'pledged':'unpledged'),date(r.due),destinations(k,r).projects.length?destinations(k,r).projects.map(p=>E(text(p.name))).join('<br>'):'<span class="mc-muted">'+E(destinations(k,r).reason||L('No associated financing project','暂无关联融资项目'))+'</span>'];
   if(k==='projects'){
     const d=D.current(r),busy=(r.attempts||[]).find(x=>x.state==='processing');
     const request=d?money(r.amount,'USDT')+small('<span class="mono">'+E(d.id)+'</span>'):busy?money(busy.amount,'USDT')+small(L('No application number yet','尚无融资申请编号')):'<span class="mc-muted">'+L('No current request','暂无当前需求')+'</span>';
     const demandState=d?CF.tag(d.state==='open'?'':'accent',status(d.state)):'';
     return [object(text(r.name))+small(E(r.id)),badge(r.status),request,demandState||'—',money(r.balance,'USDT'),badge(r.n.grade),date(r.expires)];
   }
   if(k==='credits')return [object(r.id)+small(E(counter(r))),CF.fmtAmt(r.total),CF.fmtAmt(r.used),CF.fmtAmt(r.available),badge(r.status),date(r.expires)];
   if(k==='repayments'){
     const c=r.current;
     return [object(text(D.project(r.project)?.name))+small('<span class="mono">'+E(r.request)+'</span>'),E(counter(r.q)),
       money(r.loan.amount,r.loan.ccy),
       '<span title="'+E(time(r.loan.at))+'">'+date(r.loan.at)+'</span>'+small('<span class="mono">'+E(r.loan.id)+'</span>'),
       c?'<strong>'+money(c.settlement,r.q.ccy)+'</strong>':r.plan?L('No instalments awaiting repayment','暂无待还期次'):'—',
       c?date(c.due)+(now()<c.open?small('<span title="'+E(time(c.open))+'">'+L('Not open yet','尚未开放')+'</span>'):''):'—',
       repaymentState(r)];
   }
   if(k==='quotes'){
     return [object(text(D.project(r.project)?.name))+small('<span class="mono">'+E(r.request)+'</span>'),E(owner(r.owner)),money(r.amount,'USDT')+small(E(r.ccy)+' · '+E(r.rate)+'%'),chainOnly.has(r.status)?'—':badge(r.status),r.offer?'—':stamp(r.at)];
   }
   if(k==='approvals'){
     const addr='<span class="mono">'+E(maskAddr(r.address))+'</span>';
     const head=(addrName(r)?object(addrName(r))+small(addr):object(maskAddr(r.address)));
     if(r.type==='loan')return [head,approvalNetwork(r),'<span class="mono">'+E(maskAddr(r.contract))+'</span>'+small(L('Lending contract','放款合约')),money(r.amount,r.ccy),projectIdentity(D.project(r.project))];
     return [head,approvalNetwork(r),'<span class="mono">'+E(maskAddr(r.contract))+'</span>'+small(E(text(r.kind))),'<span class="mono">'+E(maskAddr(r.issuer))+'</span>'+small(L('Issuing contract · all tokens','发行合约 · 全部代币')),relatedProjects(r.projects)];
   }
   return [];
 }
 /* Period status and business status stay distinct; neither is a to-do state. */
 function repaymentState(r){
   if(r.status==='settled')return badge('settled');
   // 计划生成进度只在详情展示；清单仍保留这笔还款中的业务。
   if(!r.plan)return badge('repaying');
   const c=r.current;
   return c?(c.overdue?CF.tag('warn',L('Overdue','逾期')):badge('due')):badge('repaying');
 }
 function pendingAction(item,r){return '<button type="button" class="actlink mc-pending-action" data-act="mc-pending" data-v="'+E(item.id)+'" aria-label="'+E(item.action+' · '+r.id)+'">'+E(item.name)+'</button>';}
 const emptyText=k=>({tokens:['No displayable tokens for this company','本企业暂无可展示的代币'],projects:['No financing projects yet','尚未创建融资项目'],credits:S.role==='fund'?['No credit granted yet','尚未授信']:['No credit from institutions yet','暂无机构授信'],repayments:['No business has been disbursed on chain yet','尚无链上放款成功的业务'],quotes:['No loan offers yet','尚未提交报价'],approvals:['No on-chain approvals','暂无链上授权']}[k]||['No records yet','暂无记录']);
 function table(){const v=view(),all=filtered(),count=Math.max(1,Math.ceil(all.length/v.size));if(v.page>count&&S.st!=='error'&&S.st!=='loading'&&!tokenError){v.page=count;const q=params();q.set('page',count);history.replaceState(null,'','#'+path()+'?'+q);}const rs=all.slice((v.page-1)*v.size,v.page*v.size),cols=columns(v.tab);
   if(S.st==='error'||v.tab==='tokens'&&(tokenError||!Array.isArray(D.tokens)))return CF.empty(L('List could not be loaded','列表加载失败'),L('Your filters have been preserved. ','已保留当前筛选条件。')+reloadHint(),'');
   if(!all.length&&S.st!=='loading'&&S.st!=='noresult'&&!FILTERS.some(k=>v[k]))return CF.empty(L(...emptyText(v.tab)),'','');
   const actions=r=>{const items=pendingError?[]:pendingItems(v.tab,r),chk=v.tab==='approvals'?revocable(r):null;return (items.length?pendingAction(items[0],r):'')+(chk?.ok?'<button type="button" class="actlink mc-pending-action" data-act="mc-revoke-open" data-v="'+E(r.id)+'" aria-label="'+E(L('Revoke approval · ','撤销授权 · ')+maskAddr(r.address))+'">'+L('Revoke approval','撤销授权')+'</button>':'')+link('detail',L('View details','查看详情'),v.tab+'|'+r.id);};
   let body=S.st==='loading'?'<div role="status" aria-label="'+L('Loading','加载中')+'">'+CF.skelTable(5)+'</div>':!rs.length&&v.pending&&!pendingError&&!FILTERS.some(k=>k!=='pending'&&v[k])&&S.st!=='empty'?CF.empty(L('No records awaiting your action','当前没有待处理记录'),returnNotice?L('The latest record no longer needs your action.','记录已更新，已无需我方处理。'):'',b('clear',L('Show all records','查看全部记录'))):!rs.length?CF.empty(L(S.st==='empty'?'No records yet':'No matching records',S.st==='empty'?'暂无记录':'暂无符合条件的记录'),returnNotice?L('The latest record no longer matches these filters.','最新记录已不符合当前筛选条件。'):L('Try another filter or return later.','可调整筛选条件或稍后再查看。'),b('clear',L('Clear filters','清空筛选'))):'<div class="listbox" id="mc-list" tabindex="0" aria-label="'+E(nm(v.tab))+'"><table class="tbl mc-table" data-kind="'+v.tab+'" data-role="'+E(S.role)+'"><thead><tr>'+[...cols,[L('Actions','操作'),'']].map(([t,kind])=>'<th scope="col" class="'+(kind||'')+'">'+E(t)+'</th>').join('')+'</tr></thead><tbody>'+rs.map(r=>{const items=pendingError?[]:pendingItems(v.tab,r);return '<tr data-id="'+E(r.id)+'" data-kind="'+v.tab+'"'+(items.length?' data-pending="true"':'')+' tabindex="0" aria-label="'+E(text(titles[v.tab])+' '+(v.tab==='approvals'?maskAddr(r.address):r.id)+(items.length?' · '+L('Awaiting your action','待我方处理'):''))+'">'+rowValues(v.tab,r).map((c,i)=>'<td data-label="'+E(cols[i][0])+'" class="'+cols[i][1]+'"><div>'+c+'</div></td>').join('')+'<td data-label="'+L('Actions','操作')+'" class="mc-actions"><div>'+actions(r)+'</div></td></tr>';}).join('')+'</tbody></table></div>';
   const focus=params().get('focus')||'',moved=focus&&all.length&&!all.some(r=>r.id===focus);
   return (moved?CF.note('',L('The updated record no longer matches these filters.','记录已更新，不再符合当前筛选条件。')+' '+b('clear',L('Clear filters','清空筛选'))):'')+(v.tab==='approvals'&&approvalError?CF.note('warn',L('Approval status is temporarily unavailable. Revocation is paused. ','授权状态暂不可用，暂不能撤销。')+reloadHint()):'')+body+'<div class="pager"><span class="total">'+all.length+L(' records',' 条记录')+'</span><label for="mc-size">'+L('Rows per page','每页')+'</label><select class="inp" id="mc-size">'+[20,50,100].map(n=>'<option'+(n===v.size?' selected':'')+'>'+n+'</option>').join('')+'</select>'+b('page',L('Previous','上一页'),v.page-1,false,v.page<=1)+'<span>'+v.page+' / '+count+'</span>'+b('page',L('Next','下一页'),v.page+1,false,v.page>=count)+'</div>';
 }
 function gate(){if(S.role==='signed')return '<div class="mc-error">'+CF.empty(L('This page is not available for your current role','该页面不适用于当前身份'),L('You can continue exploring public information.','你可以继续浏览公开信息。'),'<button class="btn primary" data-act="go" data-v="/assets">'+L('Back to assets','返回资产广场')+'</button>')+'</div>';
  return '<div class="mc-error">'+CF.empty(L(S.role==='limited'?'Complete account setup':'Sign in to view your console',S.role==='limited'?'请先完成账户必办事项':'登录后查看我的控制台'),L('Your company information is available after sign-in.','登录后可查看本企业数据。'),'<button class="btn primary" data-act="signin">'+L('Connect wallet','连接钱包')+'</button>')+'</div>';}
 /* 待处理：资产方现在就能在借贷广场办理的事项，各归入唯一一条清单记录；由业务事实即时得出，没有独立待办、手动完成、忽略或催办。
    资金方当前没有待处理事项；等待对方、等待链上结果与撤销授权都不是待处理。 */
 const FILTERS=['pending','filter','secondary','project','address','query','periodState','tokenType'];
 const at=v=>typeof v==='number'?v:Date.parse(v)||0;
 const seq=p=>L('Instalment ','第 ')+p.seq+L('',' 期');
 function pendingTabs(){return S.role==='asset'?['projects','repayments']:[];}
 function pendingItems(k,r){
   if(!allowed()||S.st==='empty'||!pendingTabs().includes(k))return [];
   const out=[],t=now(),add=(id,name,fact,when,go,extra={})=>out.push({id,name,action:extra.action||name,fact,at:at(when),go,overdue:extra.overdue||0});
   if(k==='projects'){
     const n=r.n,released=D.tokens.filter(x=>x.releasedFrom===r.id&&x.pledge==='released');
     Q.data().quotes.filter(q=>q.state==='waiting'&&q.project===r.id&&!chainOf(q)).forEach(q=>add('quote-'+q.id,L('Respond to offer','处理报价'),L('Locked for ','已锁定 ')+elapsed(t-q.at),q.at,['quotes',q.id]));
     if(n.grade==='short')add('pledge-'+r.id,L('Add collateral','追加质押'),L('Pledge gap ','质押缺口 ')+money(n.gap,'USDT'),r.created,['projects',r.id]);
     if(released.length)add('extract-'+r.id,L('Withdraw tokens','提取代币'),released.length+L(' tokens · ',' 张 · ')+money(released.reduce((a,x)=>a+x.value,0)),r.created,['projects',r.id]);
     if(r.status==='returned')add('resubmit-'+r.id,L('Revise and resubmit project','修改并重新提交项目'),'',r.created,['projects',r.id]);
   }else if(!r.pending.length){
     /* 指向本笔第一条已开放、尚未提交的待还款期次；本笔有期次还款上链确认中时不标待处理。 */
     const p=r.periods.filter(p=>p.state==='due'&&t>=at(p.open)).sort((a,b)=>a.due.localeCompare(b.due)||a.seq-b.seq)[0];
     if(p)add('repay-'+r.id,L('Repay','还款'),seq(p)+L(' · due ',' · 应还日 ')+date(p.due)+(p.overdue>0?L(' · overdue ',' · 已逾期 ')+p.overdue+L(' days',' 天'):''),p.open,['repayments',r.id,p.id],{overdue:p.overdue,action:L('Repay · ','还款·')+seq(p)});
   }
   /* 已逾期在前、按天数从多到少；其余按事项发生时间从早到晚。 */
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
 function pendingSection(k,r){
   const items=pendingError?[]:pendingItems(k,r);if(!items.length)return '';
   return '<section class="mc-pending-detail" aria-labelledby="mc-pending-title"><h2 id="mc-pending-title">'+L('Awaiting your action','待我方处理')+(items.length>1?L(' · '+items.length+' items',' · 共 '+items.length+' 项'):'')+'</h2><ul>'+items.map(y=>'<li'+(y.overdue>0?' data-overdue="true"':'')+'><b>'+E(y.name)+'</b>'+(y.fact?'<span>'+y.fact+'</span>':'')+'</li>').join('')+'</ul><p class="mc-small">'+L('Handle it from the project’s actions in the lending marketplace.','请在借贷广场该项目的办理入口处理。')+'</p></section>';
 }
 function overview(){return '<section class="card mc-overview" aria-labelledby="mc-capital-title"><div class="mc-overview-head"><h2 id="mc-capital-title">'+L('Company overview','企业概览')+'</h2><details class="mc-stat-note"><summary>'+L('About these figures','统计口径')+'</summary><div class="mc-stat-note-body"><p>'+L('Records are shared by company; unread messages are personal.','业务记录按企业共享，消息未读数按个人统计。')+'</p>'+(S.role==='asset'?'<p>'+L('Token values are summed at each token\'s issuance value. Whole-token totals do not represent available holdings or financing capacity.','代币价值按各笔签发价值计；整笔代币统计不代表可用份额或可融额度。')+'</p>':'')+'<p>'+L('Available financing is assessed when you publish a request.','实际可融金额以发布需求时核定结果为准。')+'</p></div></details></div>'+summary()+'</section>';}
 function listing(){if(!allowed())return gate();if(S.st==='denied')return unavailable();const v=view();return '<div class="mc-root"><div class="page-head"><div><h1 class="page-title">'+L('My console','我的控制台')+'</h1></div></div>'+overview()+'<section class="card mc-ledger"><div class="mc-tabs" role="tablist" aria-label="'+L('Console records','控制台信息')+'">'+tabs().map(k=>'<button role="tab" aria-selected="'+(k===v.tab)+'" tabindex="'+(k===v.tab?0:-1)+'" data-act="mc-tab" data-v="'+k+'">'+E(nm(k))+pendingBadge(k)+'</button>').join('')+'</div><div role="tabpanel" aria-label="'+E(nm(v.tab))+'">'+filters()+table()+'</div></section></div>';}
 function unavailable(){const kind=path().split('/')[2],back=tabs().includes(kind)?'#/console?tab='+kind:'#/console';return '<div class="mc-root mc-error">'+CF.empty(L('Content unavailable','内容不存在或无权访问'),L('Return to your console to view available records.','请返回控制台查看可访问的记录。'),b('list',L('Back to console','返回我的控制台'),back))+'</div>';}
 function section(id,title,body){return {id,title,html:'<section class="card detail-section" id="'+id+'" tabindex="-1"><div class="card-head"><h2>'+E(title)+'</h2></div><div class="card-body">'+body+'</div></section>'};}

 /* ---------- 还款详情：本期应还、还款上链确认中、当前未结清逾期与指定期次都可发现；完整计划在借贷广场原笔阅读 ---------- */
 function periodFacts(r,p,compact=false){
   const open=p.state==='due'&&now()<at(p.open),usdc=r.q.ccy!=='USDT';
   return dl([
     !compact&&[L('Due date (UTC)','应还日（UTC）'),date(p.due)],
     !(compact&&!usdc)&&[L('Total due','应还合计'),money(p.total,'USDT')],
     usdc&&[L('Settlement amount','应还结算金额'),money(p.settlement,r.q.ccy)],
     compact&&[L('Instalment status','期次状态'),badge(p.status)],
     open&&[L('Repayment opens','还款开放时点'),time(p.open)],
     p.overdue>0&&[L(p.state==='settled'?'Historical overdue days':p.chain?'Overdue days (frozen)':'Overdue days',p.state==='settled'?'历史逾期天数':p.chain?'逾期天数（已冻结）':'逾期天数'),p.overdue+L(' days',' 天')],
     p.chain&&[L('Submitted at','提交时间'),time(p.chain.at)],
     p.chain&&!p.unknown&&[L('Waited','已等待'),elapsed(p.waiting)],
     p.state==='settled'&&p.record&&[L('Repayment record','还款记录编号'),copy(p.record.id)],
     p.state==='settled'&&p.record?.confirmedAt&&[L('Settled at','结清时间'),time(p.record.confirmedAt)]
   ])+(p.principal?'<p class="mc-small">'+L('Final instalment includes principal.','末期含本金。')+'</p>':'');
 }
 function periodRecord(r,p,selected,match,compact=false){
   return '<article class="mc-record" data-selected="'+(selected?.id===p.id)+'" id="mc-period-'+E(p.id)+'">'+(compact?'':'<div class="mc-record-head"><b>'+L('Instalment ','第 ')+p.seq+L(' of ',' / ')+r.periods.length+L('',' 期')+'</b>'+badge(p.status)+'</div>'+(p.state==='pending'?'<p class="mc-small mc-record-note">'+(p.unknown?E(SUPPORT()):L('Signed and submitted, confirming on chain, not yet settled','已签名提交、链上确认中、仍未结清'))+'</p>':''))+periodFacts(r,p,compact)+(match&&within(match,p.status)?'<p class="mc-small">'+L('Matches the list filter','匹配列表期次筛选')+'</p>':'')+(compact?'':b('period',selected?.id===p.id?L('Selected for reading','已选定阅读'):L('Select this instalment','选择此期阅读'),p.id,false,selected?.id===p.id))+'</article>';
 }
 function repaymentSections(r){
   const out=[],add=(id,title,body)=>out.push(section(id,title,body)),selected=selectedPeriod(r),match=new URLSearchParams((params().get('list')||'').split('?')[1]||'').get('periodState');
   const settled=r.periods.filter(p=>p.state==='settled');
   if(planError)add('mc-current',L('Current instalment','本期应还'),CF.empty(L('Repayment information unavailable','还款信息暂不可用'),L('The disbursement result is kept. ','放款结果已保留。')+reloadHint(),''));
   else if(!r.plan)add('mc-current',L('Current instalment','本期应还'),CF.note('',L('Disbursed on chain. The repayment schedule is being generated.','链上放款已成功，还款计划生成中。')));
   else{
     add('mc-current',L('Current instalment','本期应还'),r.plan.settledAt?CF.note('ok',L('All instalments are settled.','本笔全部期次已结清。')):r.current?'<div class="mc-current-amount"><div><span>'+L('Instalment ','第 ')+r.current.seq+L(' of ',' / ')+r.periods.length+L('',' 期')+'</span><strong>'+statMoney(r.current.settlement,r.q.ccy)+'</strong></div><div class="mc-current-date"><span>'+L('Due date (UTC)','应还日（UTC）')+'</span><div>'+date(r.current.due)+'</div></div></div>'+periodRecord(r,r.current,selected,match,true):CF.note('',L('No instalments awaiting repayment.','暂无待还期次。')));
     /* 还款上链确认中、本期以外的未结清逾期及指定期次逐条可见，不被下一期取代。 */
     if(r.pending.length)add('mc-chain',L('Repayment pending on-chain','还款上链确认中'),(r.pending.some(p=>p.overdue>0)?CF.note('',L('Overdue days stay frozen while the result is confirmed on chain. You do not need to submit again.','链上确认期间逾期天数保持冻结，无需重复提交。')):'')+r.pending.map(p=>periodRecord(r,p,selected,match)).join(''));
     const overdue=r.periods.filter(p=>p.id!==r.current?.id&&p.state==='due'&&p.overdue>0);
     if(overdue.length)add('mc-overdue',L('Unsettled overdue instalments','当前未结清逾期期次'),overdue.map(p=>periodRecord(r,p,selected,match)).join(''));
     if(selected&&selected.id!==r.current?.id&&!r.pending.some(p=>p.id===selected.id)&&!overdue.some(p=>p.id===selected.id))add('mc-selected',L('Selected instalment','指定期次'),periodRecord(r,selected,selected,match));
   }
   add('mc-progress',L('Repayment progress','还款进度'),dl([
     [L('Settled instalments','已结清期数'),r.plan?settled.length+' / '+r.periods.length:'—'],
     [L('Outstanding principal','未偿本金'),money(r.deal.principalBalance,'USDT')],
     [L('Principal repaid','累计已还本金'),r.plan?money(settled.reduce((n,p)=>n+p.principal,0),'USDT'):'—'],
     [L('Interest repaid','累计已还利息'),r.plan?money(settled.reduce((n,p)=>n+p.interest,0),'USDT'):'—'],
     [L('Final repayment date','最终还款日'),r.plan?date(r.plan.end):'—'],
     r.plan?.settledAt&&[L('Settled at','结清时间'),time(r.plan.settledAt)]
   ]));
   add('mc-loan',L('Disbursement and references','放款信息与编号'),dl([[L('Lending institution','放款机构'),E(fund(r.loan.fund))],[L('Disbursement amount','放款金额'),money(r.loan.amount,r.loan.ccy)],[L('Disbursed at','放款时间'),time(r.loan.at)],[L('Disbursement ID','放款编号'),copy(r.loan.id)],[L('Application ID','融资申请编号'),copy(r.request)],[L('Business ID','融资业务编号'),copy(r.id)]]));
   return out;
 }
 /* ---------- 授信使用记录：一笔一条，只列仍在使用这份授信的在途报价（含报价上链确认中）与授信占用 ---------- */
 function usage(c){
   const own=x=>x.owner===c.owner&&x.fund===c.fund&&party(x);
   const rows=[...(Q.data().pending||[]).filter(x=>holding(x)&&own(x)).map(x=>({q:x,id:x.id,ref:x.demand,offer:true,kind:'transit',amount:x.amount,stage:'offerPending',at:x.at})),
     ...Q.data().quotes.filter(own).flatMap(q=>{const x=q.l7;
       if(q.state==='waiting'||q.state==='funding')return [{q,id:q.id,ref:q.id,kind:'transit',amount:q.amount,stage:chainOf(q)||q.state==='funding'?'disbursing':'waiting',at:q.at}];
       if(x?.state==='confirmed'&&x.principalBalance>0)return [{q,id:q.id,ref:q.id,kind:'occupied',amount:x.principalBalance,stage:'repaying',at:q.at}];
       return [];})].sort((a,b)=>at(b.at)-at(a.at)||a.id.localeCompare(b.id));
   const sum=k=>rows.filter(x=>x.kind===k).reduce((n,x)=>n+x.amount,0);
   return {rows,consistent:Math.abs(sum('transit')-c.transit)<0.005&&Math.abs(sum('occupied')-c.principal)<0.005};
 }
 function usageMeter(r){
   const parts=[['occupied',r.principal,L('Principal occupied','授信占用额')],['transit',r.transit,L('Offers in transit','在途报价金额')],['available',r.available,L('Available credit','可用授信')]];
   const whole=Math.max(r.total,parts.reduce((n,x)=>n+x[1],0)),pct=v=>whole?(Math.round(v/whole*1000)/10)+'%':'—';
   return '<div class="mc-usage"><div class="mc-usage-total"><div><span>'+L('Credit limit','授信额度')+'</span><strong>'+statMoney(r.total,'USDT')+'</strong></div><div><span>'+L('Used = occupied + in transit','已用额 = 占用额 + 在途报价金额')+'</span><strong>'+statMoney(r.used,'USDT')+' <small>'+pct(r.used)+'</small></strong></div></div>'+
     '<div class="mc-meter" role="img" aria-label="'+E(parts.map(x=>x[2]+' '+CF.fmtAmt(x[1])+' USDT').join(' · '))+'">'+parts.filter(x=>x[1]>0).map(x=>'<span class="mc-meter-seg" data-part="'+x[0]+'" style="flex-grow:'+x[1]+'" title="'+E(x[2]+' · '+CF.fmtAmt(x[1])+' USDT · '+pct(x[1]))+'"></span>').join('')+'</div>'+
     '<ul class="mc-usage-legend">'+parts.map(x=>'<li><span class="mc-key" data-part="'+x[0]+'" aria-hidden="true"></span><span>'+E(x[2])+'</span><strong>'+statMoney(x[1],'USDT')+'</strong><small>'+pct(x[1])+'</small></li>').join('')+'</ul></div>'+
     (r.status==='expired'?CF.note('',L('Expired · existing business continues. Renew the credit before quoting again.','已到期·存量业务照常履约，如需再次报价请先重新授信')):'');
 }
 function usageList(r){
   if(usageError)return CF.empty(L('Usage records unavailable','使用记录暂不可用'),reloadHint(),'');
   const u=usage(r);
   if(!u.consistent)return CF.empty(L('Usage records unavailable','使用记录暂不可用'),L('The usage figures above are current. ','上方使用情况为当前结果。')+reloadHint(),'');
   if(!u.rows.length)return '<p class="mc-small">'+L('No business is currently in transit or occupying this credit.','当前没有在途或占用中的业务')+'</p>';
   const size=10,pages=Math.ceil(u.rows.length/size),page=Math.min(usagePage,pages),rows=u.rows.slice((page-1)*size,page*size);
   const target=x=>x.stage==='repaying'?'repayments':S.role==='fund'?'quotes':'quotes-source';
   return '<div class="listbox"><table class="tbl mc-table mc-usage-table" data-kind="usage"><thead><tr>'+[[L('Project','项目名称'),''],[L('Business ID','融资业务编号'),''],[L('Usage type','使用类型'),''],[L('Amount (USDT)','使用金额（USDT）'),'num'],[L('Business stage','当前业务阶段'),''],[L('Actions','操作'),'']].map(([t,c])=>'<th scope="col" class="'+c+'">'+E(t)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(x=>{const k=target(x),label=k==='quotes-source'?L('View in marketplace','到借贷广场查看'):L('View details','查看详情');
     return '<tr data-id="'+E(x.id)+'" data-kind="'+k+'" tabindex="0" aria-label="'+E(x.ref)+'"><td data-label="'+L('Project','项目名称')+'"><div>'+E(text(D.project(x.q.project)?.name))+'</div></td><td data-label="'+L('Business ID','融资业务编号')+'"><div class="mono">'+E(x.ref)+(x.offer?small(L('Application ID · no business number yet','融资申请编号 · 尚无融资业务编号')):'')+'</div></td><td data-label="'+L('Usage type','使用类型')+'"><div>'+(x.kind==='occupied'?L('Credit occupied','授信占用'):L('Offer in transit','在途报价'))+'</div></td><td data-label="'+L('Amount (USDT)','使用金额（USDT）')+'" class="num"><div>'+CF.fmtAmt(x.amount)+'</div></td><td data-label="'+L('Business stage','当前业务阶段')+'"><div>'+badge(x.stage)+'</div></td><td data-label="'+L('Actions','操作')+'" class="mc-actions"><div><button type="button" class="actlink" data-act="mc-usage-open" data-v="'+k+'|'+E(x.id)+'">'+label+'</button></div></td></tr>';}).join('')+'</tbody></table></div>'+
     (pages>1?'<div class="pager"><span class="total">'+u.rows.length+L(' records',' 条记录')+'</span>'+b('usage-page',L('Previous','上一页'),page-1,false,page<=1)+'<span>'+page+' / '+pages+'</span>'+b('usage-page',L('Next','下一页'),page+1,false,page>=pages)+'</div>':'');
 }
 const certifiedFunder=()=>S.role==='fund'&&(CF.portalEligible?CF.portalEligible().verified!==false:true);

 /* ---------- 撤销授权：控制台第二类写入。授权地址签名，钱包内签名即最终确认，不另设确认弹窗或勾选 ---------- */
 const approvalTarget=r=>r.type==='loan'?Q.data().quotes.find(q=>q.id===r.id)?.auth:D.approvals.find(a=>a.id===r.id);
 const saveApprovals=r=>{if(r.type==='loan')Q.save();else D.save();};
 function revokePanel(r,inModal=false){
   const chk=revocable(r),note=revokeNotes[r.id],rv=r.rec?.revoke,busy=revokeBusy===r.id;
   let h='';
   if(r.status==='revoking'&&!approvalError){const waited=now()-Date.parse(rv.at),long=waited>=DAY;h+=CF.note('accent',L('Revocation processing · waited ','撤销处理中 · 已等待 ')+elapsed(waited)+L(' · gas: to be verified',' · gas：待核实')+(long?'<br>'+E(SUPPORT()):''));}
   if(r.status==='revoked')h+=CF.note('ok',rv?.external?L('Revoked outside the platform; shown as recorded on chain.','已在平台外撤销，按链上事实显示。'):L('Revoked','已撤销')+(rv?.done?L(' · completed ',' · 完成时间 ')+time(rv.done):'')+(rv?.tx?L(' · transaction ',' · 链上凭证 ')+'<span class="mono">'+E(maskTx(rv.tx))+'</span>':'')+(rv?.gas?L(' · actual gas ',' · 实际 gas ')+E(rv.gas)+' ETH':''));
   if(r.status==='granted'&&rv?.state==='failed')h+=CF.note('warn',L('The last revocation failed: ','上次撤销未成功：')+E(text(rv.reason))+L(' Gas incurred: ',' 已产生 gas：')+E(rv.gas||'0')+' ETH'+L('. You can revoke again.','，可以重新撤销。'));
   if(chk.ok){
     const gas=[L('Estimated gas','本次预估 gas'),'<span class="mono">'+REVOKE_GAS+' ETH</span>'+small(L('Paid by your company from the approval address','由本企业从授权地址支付'))];
     h+=(inModal?dl([[L('Approval address','授权地址'),copyMasked(r.address,maskAddr,L('Copy full address','复制完整地址'))+(addrName(r)?small(E(addrName(r))):'')],[L(r.type==='loan'?'Lending contract':'Pledge contract',r.type==='loan'?'被授权合约（放款合约）':'被授权合约（质押合约）'),copyMasked(r.contract,maskAddr,L('Copy full address','复制完整地址'))],[L('Scope','授权范围'),r.type==='loan'?money(r.amount,r.ccy):copyMasked(r.issuer,maskAddr,L('Copy full address','复制完整地址'))+small(L('All tokens of this address under this issuing contract','该地址在这个发行合约下的全部代币'))],gas]):'')+
       CF.note('',r.type==='loan'?L('After revoking, the lending contract can no longer take funds from this address under this offer\'s approval.','撤销后放款合约不能再按本笔授权调取该地址的款项。')+(sameLender(r)?' '+L('Approvals still needed by your other offers awaiting acceptance from this address are kept.','同一放款地址其他待接受报价所需的授权额度保留。'):''):L('After revoking, this pledge contract can no longer take tokens of this address under this issuing contract. Tokens already in the contract are not affected, and release and withdrawal continue as usual. Pledging tokens of this issuing contract from this address later requires a new approval, including for other projects using this pledge contract.','撤销后这份质押合约不能再调取该地址在该发行合约下的代币；已在合约内的代币不受影响，解押与提取照常；以后从该地址质押该发行合约的代币时须重新授权，使用这份质押合约的其他项目同样如此。'))+
       (inModal?'<p class="mc-small">'+L('Sign in your wallet with the approval address. The signature is the final confirmation and does not change your sign-in.','在钱包中用授权地址签名，签名即最终确认，不影响登录状态。')+'</p>':'<div class="mc-revoke-act">'+b('revoke',busy?L('Waiting for wallet signature…','等待钱包签名…'):L('Revoke approval','撤销授权'),r.id,true,busy||!!revokeBusy)+'<span class="mc-small">'+L('Sign in your wallet with the approval address. The signature is the final confirmation and does not change your sign-in.','在钱包中用授权地址签名，签名即最终确认，不影响登录状态。')+'</span></div>');
   }else if(!['revoking','revoked'].includes(r.status)||approvalError)h+='<p class="mc-small" role="status">'+E(chk.reason)+'</p>';
   if(note)h+=CF.note(note.tone,E(note.text));
   return h;
 }
 const sameLender=r=>r.type==='loan'&&Q.data().quotes.some(q=>q.id!==r.id&&q.state==='waiting'&&q.lender?.address===r.address&&q.ccy===r.ccy);
 function revoke(id){
   if(revokeBusy)return;
   const r=normalized('approvals').find(x=>x.id===id);if(!r){CF.render();return;}
   const chk=revocable(r);
   /* 提交前按最新事实复核；不满足时不唤起钱包，就地说明当前结果。 */
   if(!chk.ok){revokeNotes[id]={tone:'',text:chk.reason};CF.render();return;}
   const rec=approvalTarget(r);if(!rec){CF.render();return;}
   if(revokeScene==='stale'){rec.revoke={state:'success',external:true,done:D.iso()};if(r.type==='loan')rec.revoked=true;saveApprovals(r);revokeNotes[id]={tone:'',text:L('This approval was already revoked on chain. Your wallet was not opened.','该授权已在链上撤销，未唤起钱包。')};CF.render();return;}
   if(revokeScene==='wrongWallet'){revokeNotes[id]={tone:'warn',text:L('Your wallet is not on the approval address '+maskAddr(r.address)+'. Switch to it in your wallet and revoke again. Nothing was sent on chain.','钱包当前不是授权地址 '+maskAddr(r.address)+'，请在钱包中切换到该地址后再撤销。本次未发生链上操作。')};CF.render();return;}
   revokeBusy=id;delete revokeNotes[id];CF.render();
   setTimeout(()=>{
     revokeBusy='';
     if(['cancelled','unavailable'].includes(revokeScene)){revokeNotes[id]={tone:'',text:revokeScene==='cancelled'?L('Not signed. Nothing was revoked, nothing was sent on chain and no gas was incurred.','未签名，本次未撤销，未发生链上操作、未产生 gas。'):L('Wallet unavailable. Nothing was revoked, nothing was sent on chain and no gas was incurred.','钱包不可用，本次未撤销，未发生链上操作、未产生 gas。')};CF.render();return;}
     /* 同一次撤销只发出一笔交易；处理中不能重复发起。 */
     rec.revoke={state:'processing',at:new Date(revokeScene==='unknown'?now()-26*H:now()).toISOString(),gas:null};saveApprovals(r);CF.render();
     if(revokeScene==='unknown')return;
     setTimeout(()=>{
       if(rec.revoke?.state!=='processing')return;
       if(revokeScene==='failed'){rec.revoke={state:'failed',at:rec.revoke.at,done:D.iso(),gas:'0.000031',reason:['The revoke transaction failed on chain; the approval is unchanged.','撤销交易上链失败，授权保持不变。']};}
       else{rec.revoke={...rec.revoke,state:'success',done:D.iso(),tx:'0x'+Array.from({length:64},(_,i)=>'0123456789abcdef'[(i*11+id.length)%16]).join(''),gas:REVOKE_GAS};
         if(r.type==='loan'){rec.revoked=true;const k=r.address+'|'+r.ccy,a=Q.data().allowances;if(a&&a[k]!=null)a[k]=Math.max(0,a[k]-r.amount);}}
       saveApprovals(r);CF.render();
     },1600);
   },700);
 }
 function approvalSections(r){
   const out=[],add=(id,t,body)=>out.push(section(id,t,body)),rec=r.rec,rv=rec?.revoke,st=approvalError?'unreadable':r.status;
   /* 授权地址、被授权合约、授权范围、预估 gas 与后果说明和“撤销授权”在同一分区内同时可见。 */
   add('mc-basic',L('Approval','授权信息'),dl([
     [L('Approval address','授权地址'),copyMasked(r.address,maskAddr,L('Copy full address','复制完整地址'))+(addrName(r)?small(E(addrName(r))):'')],
     [L('Blockchain network','区块链网络'),approvalNetwork(r)],
     [L('Approved contract','被授权合约'),copyMasked(r.contract,maskAddr,L('Copy full address','复制完整地址'))+small(r.type==='loan'?L('Lending contract','放款合约'):L('Pledge contract · Ethereum · ','质押合约 · Ethereum · ')+E(r.type==='loan'?'':text(r.kind)))],
     [L('Scope','授权范围'),r.type==='loan'?money(r.amount,r.ccy):copyMasked(r.issuer,maskAddr,L('Copy full address','复制完整地址'))+small(L('Issuing contract · all tokens of this address under it','代币发行合约 · 该地址在这个发行合约下的全部代币'))],
     [L('Approved at','授权时间'),r.status==='granting'?L('Signed ','签名发出 ')+time(r.signedAt):time(r.at)],
     [L('Status','链上授权状态'),badge(st)],
     revocable(r).ok&&[L('Estimated gas to revoke','撤销预估 gas'),'<span class="mono">'+REVOKE_GAS+' ETH</span>'+small(L('Paid by your company from the approval address','由本企业从授权地址支付'))]
   ])+'<div class="mc-revoke-block" id="mc-revoke">'+revokePanel(r)+'</div>');
   if(r.type==='loan')add('mc-related',L('Related business','关联业务'),dl([[L('Project','项目名称'),E(text(D.project(r.project)?.name))],[L('Project ID','融资项目编号'),copy(r.project)],[L('Application ID','融资申请编号'),copy(r.request)],[L('Business ID','融资业务编号'),r.business?copy(r.business):L('Not yet generated','尚未生成')],[L('Offer stage','本笔报价当前阶段'),badge(r.quote)]])+'<p class="mc-links">'+link('detail',L('View loan offer','查看本笔报价详情'),'quotes|'+r.id)+'</p>');
   else{const d=destinations('approvals',r);add('mc-related',L('Projects using this pledge contract','使用这份质押合约的项目'),d.projects.length?'<ul class="mc-project-list">'+d.projects.map(p=>'<li><div><b>'+E(text(p.name))+'</b>'+small('<span class="mono">'+E(p.id)+'</span>')+'</div>'+b('open-project',L('View project','查看项目'),r.id+'|'+p.id,false,false,' aria-label="'+E(L('View project ','查看项目 ')+text(p.name))+'"')+'</li>').join('')+'</ul>':CF.empty(d.reason||L('No projects of your company use this pledge contract','本企业暂无使用这份质押合约的项目'),''));}
   add('mc-chain',L('On-chain records','链上记录'),dl([
     [L('Approval transaction','授权交易标识'),rec?.tx?copyMasked(rec.tx,maskTx,L('Copy transaction ID','复制交易标识')):r.status==='granting'?L('Processing','处理中'):'—'],
     [L('Approval gas','授权实际 gas'),rec?.gas?E(rec.gas)+' ETH':rec?.fee!=null?E(String(rec.fee))+' ETH':'—'],
     [L('Approval completed at','授权完成时间'),rec&&r.status!=='granting'?time(rec.done||rec.at):'—'],
     rv&&!rv.external&&[L('Revocation transaction','撤销交易标识'),rv.tx?copyMasked(rv.tx,maskTx,L('Copy transaction ID','复制交易标识')):rv.state==='processing'?L('Processing','处理中'):'—'],
     rv&&!rv.external&&[L('Revocation gas','撤销实际 gas'),rv.gas?E(rv.gas)+' ETH':rv.state==='processing'?L('To be verified','待核实'):'—'],
     rv&&[L('Revocation completed at','撤销完成时间'),rv.done?time(rv.done):'—']
   ]));
   return out;
 }
 function quoteResultRows(r){
   if(r.status==='offerPending')return [[L('Signed at','签名发出时间'),time(r.signedAt)],[L('Waited','已等待'),elapsed(r.waited)]];
   if(r.status==='waiting')return [[L('Lock started','锁定起点'),time(r.at)],[L('Time locked','已锁定时长'),elapsed(r.locked)]];
   if(r.status==='disbursing')return [[L('Waited','已等待'),r.chainState==='unknown'?'—':elapsed(r.waited)],[L('Lock started','锁定起点'),time(r.at)]];
   if(['rejected','quoteEnded'].includes(r.status))return [[r.status==='rejected'?L('Rejected at','拒绝时间'):L('Invalidated at','失效时间'),time(r.done)],r.reason&&[L('Reason','原因'),E(reasonText(r.reason))],[L('Lock started','锁定起点'),time(r.at)],[L('Time locked','已锁定时长'),elapsed(r.locked)]];
   const loan=r.deal?.record;
   return [[L('Result','结果'),badge('accepted')],[L('Disbursed at','放款成功时间'),time(r.deal?.confirmedAt)],[L('Disbursement ID','放款编号'),loan?copy(loan.id):'—'],[L('Currency / amount','放款币种与金额'),money(r.deal?.settlement,r.deal?.ccy)],[L('Current business stage','当前业务阶段'),badge(r.status)]];
 }
 function details(k,r){
   const out=[],add=(id,t,body)=>out.push(section(id,t,body));
   if(k==='tokens'){
     add('mc-basic',L('Token information','代币信息'),dl([[L('Blockchain network','区块链网络'),tokenNetwork(r)],[L('Token name','代币名称'),tokenIdentity(r)],[L('Token type','代币类型'),E(text(D.type(r.kind).label))],[L('Quantity','代币数量'),CF.fmtAmt(r.units)],[L('Buyer','买方企业'),E(text(r.buyer))],[L('Receivable period','底层应收账款账期'),date(r.from)+' → '+date(r.due)],[L('Issued at','签发时间'),time(r.issued)]])+(!r.valid?CF.note('',L('This token is void and does not contribute to eligible pledged value.','该代币已失效，不计入有效质押。')):''));
     const reach=destinations(k,r).projects;
     add('mc-project',L('Associated project','关联融资项目'),reach.length?'<ul class="mc-project-list">'+reach.map(p=>'<li><div><b>'+E(text(p.name))+'</b>'+small('<span class="mono">'+E(p.id)+'</span>')+'</div></li>').join('')+'</ul>':CF.empty(destinations(k,r).reason,''));
   }else if(k==='credits'){
     add('mc-credit',L('Credit usage','授信使用情况'),usageMeter(r));
     add('mc-usage',L('Current usage','当前使用记录'),usageList(r));
     add('mc-basic',L('Credit term','授信期限'),dl([[L('First granted','首次授信时间'),time(r.first)],[L('Valid until','授信有效期至'),date(r.expires)],S.role==='fund'&&[L('Internal remark','备注'),E(r.history?.at(-1)?.remark||'—')]]));
   }else if(k==='quotes'){
     /* 报价详情回答四件事：客户要多少、本机构怎么报、结果如何、本笔链上授权现在怎样。 */
     add('mc-quote',L('Request and your offer','融资需求与本机构报价'),'<div class="mc-pair"><div><h3>'+L('Client financing request','客户融资需求')+'</h3>'+dl([[L('Requested amount','融资需求金额'),money(r.amount,'USDT')],[L('Application ID','融资申请编号'),copy(r.request)]])+'</div><div><h3>'+L('Your offer','本机构报价')+'</h3>'+dl([[L('Settlement currency','结算币种'),E(r.ccy)],[L('Annual rate','年化融资利率'),E(r.rate)+'%'],[L('Offered at','报价时间'),r.offer?L('Not yet generated','尚未生成'):time(r.at)],[L('Business ID','融资业务编号'),r.offer?L('Not yet generated','尚未生成'):copy(r.id)]])+'</div></div>');
     add('mc-result',L('Offer result','报价结果'),dl(quoteResultRows(r))+
       ((r.unknown||r.chainState==='unknown')?CF.note('warn',E(SUPPORT())):r.status==='disbursing'?'<p class="mc-small">'+L('Accepted by the asset holder.','资产方已接受。')+'</p>':r.lastFail?'<p class="mc-small">'+L('The last on-chain disbursement did not complete. The offer is still awaiting acceptance.','上次链上放款未完成，本笔仍待接受。')+'</p>':'')+
       (['repaying','settled'].includes(r.status)&&find('repayments',r.id)?'<p class="mc-links">'+link('detail',L('View repayment','查看同笔还款'),'repayments|'+r.id)+'</p>':''));
     if(S.role==='fund'&&r.approval)add('mc-approval',L('On-chain approval for this offer','本笔链上授权'),'<div class="mc-inline-fact"><span>'+L('Status','链上授权状态')+'</span>'+badge(approvalError?'unreadable':r.approval)+(()=>{const x=find('approvals',r.id),c=x&&revocable(x);return c?'<span class="mc-small">'+E(c.ok?L('Revocable in the approval record','可在链上授权记录中撤销'):(c.short||c.reason))+'</span>':'';})()+link('detail',L('View approval record','查看链上授权记录'),'approvals|'+r.id)+'</div>');
   }else if(k==='approvals')return approvalSections(r);
   else return repaymentSections(r);
   return out;
 }
 /* 详情标题直接写对象识别：代币看编号，报价看项目，授信、还款看对方名称，链上授权看授权地址；类型由上方小标题区分。 */
 function head(k,r){
   const cls='<span class="mc-meta-text">',end='</span>';
   if(k==='tokens')return {title:r.id,meta:badge(r.status)+badge(r.pledged?'pledged':'unpledged')+CF.copyBtn('mc-copy',r.id,L('Copy token ID','复制代币编号')),actions:controls(k,r)};
   if(k==='credits')return {title:counter(r),meta:badge(r.status)+copy(r.id),actions:modifyEntry(r)};
   if(k==='repayments')return {title:counter(r.q),meta:badge(r.status)+(r.overdue?CF.tag('warn',L('Currently overdue','当前逾期')):'')+cls+E(text(D.project(r.project)?.name))+end,actions:controls(k,r)};
   if(k==='approvals')return {title:addrName(r)||maskAddr(r.address),meta:cls+(r.type==='loan'?L('Funding approval','放款授权'):L('Pledge approval','质押授权'))+' · '+L('contract ','被授权合约 ')+'<span class="mono">'+E(maskAddr(r.contract))+'</span>'+end+badge(approvalError?'unreadable':r.status),actions:''};
   return {title:text(D.project(r.project)?.name),meta:cls+E(owner(r.owner))+end+badge(r.status),actions:controls(k,r)};
 }
 function modifyEntry(r){
   if(S.role!=='fund')return '';
   if(!certifiedFunder())return '<p class="mc-small">'+L('Credit can be modified after your institution is verified.','机构认证通过后可修改授信。')+'</p>';
   return b('modify',r.status==='expired'?L('Renew credit','重新授信'):L('Modify credit','修改授信'),r.id,true);
 }
 function detail(k){
   if(!allowed())return gate();
   /* 已取消的融资放款详情：同一笔业务改由还款详情承接，不存在时统一不可访问。 */
   if(k==='loans'){const r=find('repayments',params().get('id'));if(r){const q=params();setTimeout(()=>{if(path()==='/console/loans')location.replace(location.href.split('#')[0]+'#/console/repayments?'+q);},0);return '<div class="mc-root mc-error" role="status">'+CF.skelTable(3)+'</div>';}return unavailable();}
   if(k==='tokens'&&(tokenError||!Array.isArray(D.tokens)))return '<div class="mc-root mc-error">'+CF.empty(L('Token details unavailable','代币详情暂不可用'),reloadHint(),'')+'</div>';
   const r=find(k,params().get('id'));if(!r||!tabs().includes(k)||S.st==='denied')return unavailable();
   if(k==='repayments'&&params().get('period')&&!r.periods.some(p=>p.id===params().get('period')))return unavailable();
   if(k==='projects'&&params().get('application')&&!r.demands.some(d=>d.id===params().get('application')))return unavailable();
   if(['loading','error'].includes(detailState))return '<div class="mc-root mc-error">'+(detailState==='loading'?'<div role="status">'+CF.skelTable(6)+'</div>':CF.empty(L('Details could not be loaded','详情加载失败'),reloadHint(),''))+'</div>';
   /* 旧的控制台项目详情地址：改到借贷广场项目详情，已指定的原申请继续定位。 */
   if(k==='projects'){const p=D.project(r.id),back=listRoute('projects');setTimeout(()=>{if(path()==='/console/projects'&&params().get('id')===r.id)location.replace(location.href.split('#')[0]+sourceHref(k,r,p,{back,application:params().get('application')}));},0);return '<div class="mc-root mc-error" role="status">'+CF.skelTable(3)+'</div>';}
   const sections=details(k,r),h=head(k,r),chapters=sections.length>3;
   return '<div class="mc-root mc-detail"><div class="page-head"><div><p class="mc-eyebrow">'+E(k==='credits'?nm('credits'):text(kindNames[k]))+'</p><h1 class="page-title" tabindex="-1">'+E(h.title)+'</h1><div class="mc-detail-meta">'+h.meta+'</div></div>'+(h.actions?'<div class="mc-quick-actions" aria-label="'+(k==='credits'?L('Credit actions','授信操作'):L('Project navigation','项目导航'))+'">'+h.actions+'</div>':'')+'</div>'+(detailState==='stale'?CF.note('warn',L('The business state changed. The previous action is no longer available.','业务状态已变化，原操作已不可用。')):'')+pendingSection(k,r)+(k==='tokens'?'<div class="stat-strip mc-detail-metrics">'+stat(L('Token value','代币价值'),statMoney(r.value),'','accent')+stat(L('Receivable due','应收账款到期日'),date(r.due))+'</div>':'')+(chapters?'<nav class="mc-chapters" aria-label="'+L('On this page','本页章节')+'">'+sections.map((x,i)=>'<button type="button" data-act="mc-section" data-v="'+x.id+'"'+(!i?' aria-current="location"':'')+'>'+E(x.title)+'</button>').join('')+'</nav>':'')+'<div class="detail-stack">'+sections.map(x=>x.html).join('')+'</div></div>';
 }
 /* 修改授信：资金方在授信详情办理。生效中可追加额度或后延有效期至；已到期为重新授信。规则沿授信报价模块，不调低、冻结或删除。 */
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
   if(!amount.test(total)||+total<=0||+total<r.used)return modifyFail('total','Enter a limit above 0, with up to 2 decimals, and not below the used amount of '+CF.fmtAmt(r.used)+' USDT.','授信额度须大于 0、最多两位小数，且不低于当前已用额 '+CF.fmtAmt(r.used)+' USDT。');
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
     field('total',L('Credit limit (USDT) *','授信额度（USDT）*'),'<input class="inp" id="mc-cm-total" inputmode="decimal" value="'+E(modify.total)+'"'+bad('total')+off+'>',L('Previous limit ','上一版额度 ')+CF.fmtAmt(c.total)+' USDT · '+L('not below the used amount ','不低于当前已用额 ')+CF.fmtAmt(r.used)+' USDT')+
     field('expires',L('Credit valid until *','授信有效期至 *'),'<select class="inp" id="mc-cm-expires"'+bad('expires')+off+'>'+years.map(([d,y])=>'<option value="'+d+'"'+(d===modify.expires?' selected':'')+'>'+date(d)+L(' · '+y+(y>1?' years':' year'),' · '+y+' 年')+'</option>').join('')+'</select>')
     :field('add',L('Increase limit by (USDT)','增加额度（USDT）'),'<input class="inp" id="mc-cm-add" inputmode="decimal" placeholder="'+L('Leave empty to keep the limit','不增加可留空')+'" value="'+E(modify.add)+'"'+bad('add')+off+'>',L('Adjusted limit: ','调整后额度：')+'<span id="mc-cm-after" class="mono">'+CF.fmtAmt(c.total+(/^\d+(\.\d{1,2})?$/.test(modify.add.trim())?+modify.add:0))+'</span> USDT')+
     field('expires',L('Credit valid until *','授信有效期至 *'),'<input class="inp" id="mc-cm-expires" type="date" value="'+E(modify.expires)+'" min="'+E(c.expires)+'"'+(cap?' max="'+E(cap)+'"':'')+bad('expires')+off+'>',cap?L('Keep or extend, up to ','可保持或后延，最晚 ')+date(cap):L('The extension limit cannot be verified now; only the limit can be increased.','暂时无法确认延期上限，本次仅可增加额度。'));
   const files='<div class="field"><label for="mc-cm-files">'+L('Credit agreements (optional)','本次授信协议（选填）')+'</label><input class="inp" id="mc-cm-files" type="file" multiple accept=".pdf,.jpg,.jpeg,.png"'+bad('files')+(busy||modify.files.length>=10?' disabled':'')+'>'+err('files')+'<p class="hint">'+L('PDF, JPG or PNG, up to 10 MB each, 10 files at most. Earlier agreements are kept.','PDF / JPG / PNG，单份不超过 10 MB，最多 10 份；历史协议保留。')+'</p>'+(modify.files.length?'<ul class="mc-cm-files">'+modify.files.map(f=>'<li><span>'+E(f.name)+'</span><span class="mc-small">'+(f.size/1048576).toFixed(2)+' MB</span>'+b('cm-remove',L('Remove','移除'),f.id,false,busy)+'</li>').join('')+'</ul>':'')+'</div>';
   return {title:renew?L('Renew credit','重新授信'):L('Modify credit','修改授信'),dismiss:true,
     html:'<div class="mc-cm">'+(!modify.invalid?err(''):'')+(renew?CF.note('',L('This credit expired on ','本授信已于 ')+date(c.expires)+L('. Renewal takes effect immediately; existing business continues.',' 到期。重新授信保存后立即生效，存量业务照常履约。')):'')+
       dl([[L('Credited company','被授信企业'),E(counter(r))],[L('Credit ID','授信编号'),'<span class="mono">'+E(r.id)+'</span>'],[L('Current limit','当前授信额度'),money(r.total,'USDT')],[L('Used','授信已用额'),money(r.used,'USDT')],[L('Valid until','当前有效期至'),date(c.expires)]])+
       '<div class="mc-cm-form">'+terms+field('remark',L('Remark (optional)','备注（选填）'),'<input class="inp" id="mc-cm-remark" maxlength="200" value="'+E(modify.remark)+'"'+off+'>')+files+'</div>'+
       '<p class="mc-small">'+L('Saving takes effect immediately without approval. It does not create an offer or change existing business.','保存后立即生效，无需审批；不生成报价，也不改变已有业务。')+'</p></div>',
     foot:b('cm-cancel',L('Cancel','取消'),'',false,busy)+b('cm-save',busy?L('Saving…','保存中…'):renew?L('Renew credit','确认重新授信'):L('Save changes','保存修改'),'',true,busy)};
 }
 function revokeLayer(){
   const r=normalized('approvals').find(x=>x.id===revokeTarget);if(!r)return {title:L('Revoke approval','撤销授权'),html:CF.empty(L('Content unavailable','内容不存在或无权访问'),''),foot:'<button class="btn" data-act="closelayer">'+L('Close','关闭')+'</button>'};
   const chk=revocable(r),busy=revokeBusy===r.id;
   return {title:L('Revoke approval','撤销授权'),dismiss:!busy,html:'<div class="mc-revoke">'+revokePanel(r,true)+'</div>',
     foot:'<button class="btn" data-act="closelayer"'+(busy?' disabled':'')+'>'+(chk.ok?L('Cancel','取消'):L('Close','关闭'))+'</button>'+(chk.ok?b('revoke',busy?L('Waiting for wallet signature…','等待钱包签名…'):L('Revoke approval','撤销授权'),r.id,true,busy||!!revokeBusy):'')};
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
   if(['repayments','quotes'].includes(k)&&app&&r.request!==app)return {invalid:true};
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
       if(Q.openRequest)Q.openRequest(app||r.request,{selected:k==='quotes'&&!r.offer?r.id:undefined});
       else sourceFault='fallback';
     }else if(k==='repayments'){
       if(CF.L8?.openDetail)CF.L8.openDetail(r.id,{period});else sourceFault='fallback';
     }
     if(sourceFault)CF.render();
   },60);
 }
 function backBanner(){
   const q=params(),back=safeRoute(q.get('mcReturn'));if(!back||!allowed())return '';
   const ids=[q.get('mcApplication'),q.get('mcObject'),q.get('mcPeriod'),q.get('mcRecord')].filter(Boolean);
   const target=sourceTarget(),r=target&&!target.invalid&&target.k==='projects'?target.r:null;
   const voids=r?D.tokens.filter(t=>t.pool===r.id&&t.pledge==='pledged'&&!t.valid):[];
   const progress=r?roundChain(r,D.current(r))+(r.status==='closed'&&r.closeReason&&r.closeReason!=='expiry'?small(E(reasonText(r.closeReason))):'')+(voids.length?small(L('Void pledged tokens: ','已失效质押代币：')+voids.length+L(' tokens · ',' 张 · ')+money(voids.reduce((n,t)=>n+t.value,0))):''):'';
   return '<div class="mc-return"><div><span>'+L('Opened from My console','来自我的控制台')+'</span>'+(progress?'<div class="mc-source-progress">'+progress+'</div>':'')+(sourceFault==='invalid'?'<p>'+L('Content does not exist or is not accessible.','内容不存在或无权访问。')+'</p>':sourceFault==='fallback'?'<p>'+L('Only this project could be opened. The original record has not been located.','当前仅到达同一项目，尚未定位原记录。')+'</p><div class="mc-small">'+E(ids.join(' · '))+'</div>':'<p class="mc-small">'+L('Read the original record here. To handle business, close the record and use the project’s existing actions.','在此阅读原记录；如需办理，请关闭记录并从项目既有入口选择。')+'</p>')+'</div>'+b('return',/^#\/console(\?|$)/.test(back)?L('Return to My console','返回我的控制台'):L('Return to console details','返回控制台详情'),back)+'</div>';
 }
 function reviewTools(){return '<div class="grp"><h5>'+L('Console partial faults','控制台局部故障')+'</h5>'+[['stats','Summary error','单项统计失败'],['tokens-error','Token snapshot error','代币读取失败'],['association-error','Association error','关联读取失败'],['association-none','No project association','无关联项目'],['association-denied','No accessible project','无可访问关联项目'],['association-unsupported','Project-only fallback','仅同项目定位降级'],['plan-error','Plan unavailable','还款计划加载失败'],['pending-error','Pending marks unavailable','待处理读取失败'],['usage-error','Credit usage records unavailable','授信使用记录读取失败'],['approval-error','Approval status unavailable','授权状态读取失败'],['credit-save-fail','Next credit save fails','下次修改授信保存失败'],['session','Session expired','登录失效']].map(([v,en,zh])=>b('scenario',L(en,zh),v)).join('')+
   '<label for="mc-revoke-scene">'+L('Revoke result','撤销授权结果')+'</label><select class="inp" id="mc-revoke-scene">'+[['success','On chain','上链成功'],['failed','Failed · gas charged','明确失败 · 已产生 gas'],['cancelled','Not signed','未签名'],['unavailable','Wallet unavailable','钱包不可用'],['unknown','Result unknown','结果长期未知'],['wrongWallet','Wallet on another address','钱包不是授权地址'],['stale','Already revoked before submitting','提交前已在链上撤销']].map(([v,en,zh])=>'<option value="'+v+'"'+(v===revokeScene?' selected':'')+'>'+L(en,zh)+'</option>').join('')+'</select>'+
   '<p class="hint">'+L('Fixtures are shared with the marketplace; no real payment, signature or transaction is made.','演示数据与广场共用；不发起真实付款、签名或交易。')+'</p></div>';}

 CF.review.register('P-MC-01',{group:['My console','我的控制台'],route:'/console',parties:true,
   scenarios:()=>allowed()?tabs().map(k=>({id:k,label:names[k],route:'/console?tab='+k,description:['Open this record category','定位此类业务清单']})):[],
   states:()=>allowed()?['default','loading','empty','noresult','error','denied']:['default'],
   reset(){S.st='default';statsError=tokenError=associationError=planError=pendingError=usageError=approvalError=false;associationScene='normal';}});
 kinds.forEach(k=>CF.review.register(pageIds[k],{
   group:['My console · details','我的控制台 · 详情'],parties:true,visible:()=>k!=='projects'&&tabs().includes(k),
   scenarios:()=>allowed()?[...new Set(normalized(k).map(r=>r.status))].map(st=>{const r=normalized(k).find(r=>r.status===st);return {id:st,label:labels[st]||[st,st],route:r?detailHref(k,r.id):null,available:!!r,description:[text(titles[k])+' · '+r.id,text(titles[k])+' · '+r.id]};}):[],
   states:()=>allowed()?['default','loading','error',{id:'stale',label:['Action expired','动作失效'],group:'business'},'denied']:['default'],
   route:()=>{const r=normalized(k)[0];return r?detailHref(k,r.id):null;},
   get:()=>S.st==='denied'?'denied':detailState==='normal'?'default':detailState,
   set(value){S.st=value==='denied'?'denied':'default';detailState=['loading','error','stale'].includes(value)?value:'normal';},
   reset(){S.st='default';detailState='normal';statsError=tokenError=associationError=planError=pendingError=usageError=approvalError=false;associationScene='normal';}
 }));
 CF.review.register(pageIds.loans,{group:['My console · details','我的控制台 · 详情'],parties:true,visible:()=>false,scenarios:()=>[],states:()=>['default'],route:()=>null,reset(){}});

 const detailPages=[...kinds,'loans'].map(k=>pageIds[k]);
 const mod={...old,id:'my-console-v15',pages:['P-MC-01',...detailPages],dict,
   content(id){if(id==='P-MC-01')return listing();const k=Object.keys(pageIds).find(k=>pageIds[k]===id);return detail(k);},
   breadcrumbRoute(id){return id==='P-MC-01'?listRoute(path().split('/')[2]||tabs()[0]).slice(1):old.breadcrumbRoute?.(id);},
   beforeRender(){old.beforeRender?.();if(lastRole!==S.role+'|'+JSON.stringify(S.party)){S.layer=null;lastRole=S.role+'|'+JSON.stringify(S.party);detailState='normal';copyValue='';sourceOpened='';revokeNotes={};}},
   // Measure before the first target scroll: a wrapped portal header is taller on narrow screens.
   afterRender(){old.afterRender?.();queueSourceReading();syncCrumb();requestAnimationFrame(()=>{syncConsoleNav();syncChapters();});const current=location.hash;if(current!==lastHash){lastHash=current;if(path().startsWith('/console')){const q=params();restoring=true;setTimeout(()=>{syncChapters();window.scrollTo(0,Math.max(0,+q.get('y')||0));const box=document.getElementById('mc-list');if(box)box.scrollTop=Math.max(0,+q.get('scroll')||0);const id=q.get('focus');if(id)document.querySelector('[data-id="'+CSS.escape(id)+'"]')?.focus({preventScroll:true});else document.querySelector('.mc-root .page-title')?.focus({preventScroll:true});if(!q.has('y')){const k=path().split('/')[2],r=k==='repayments'&&find(k,q.get('id')),p=r&&selectedPeriod(r);const el=p?document.getElementById('mc-period-'+p.id):q.get('application')?document.getElementById('mc-application-'+q.get('application')):null;el?.scrollIntoView({block:'start'});}restoring=false;syncChapters();},0);}}
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
     if(key==='revoke-open'){revokeTarget=v;delete revokeNotes[v];CF.openLayer('modal','mc-revoke');}
     if(key==='revoke')revoke(v);
     if(key==='open-project'){const [id,pid]=v.split('|'),r=find('approvals',id),p=r&&destinations('approvals',r).projects.find(x=>x.id===pid);if(p)navigate(sourceHref('approvals',r,p,{back:snapshot()}));else CF.toast(L('Content unavailable','内容不存在或无权访问'));}
     if(key==='tab'){returnNotice=false;setView({tab:v,pending:'',filter:'',secondary:'',project:'',address:'',tokenType:'',query:'',periodState:'',sort:v==='credits'?'available-asc':'newest',page:1});}
     if(key==='clear'){S.st='default';returnNotice=false;S.menu=null;setView({pending:'',filter:'',secondary:'',project:'',address:'',tokenType:'',query:'',periodState:'',page:1});}
     if(key==='search')setView({query:document.getElementById('mc-query').value.trim(),page:1});
     if(key==='page')setView({page:Math.max(1,+v)});
     if(key==='list'||key==='return'){returnNotice=key==='return';navigate(safeRoute(v)||'#/console');}
     if(key==='section'){chapterTarget=v;const el=document.getElementById(v);el?.focus({preventScroll:true});el?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
     if(key==='copy'){copyValue=v;const fallback=()=>CF.openLayer('modal','mc-copy');try{navigator.clipboard?.writeText(v).then(()=>CF.toast(L('Copied','已复制')),fallback)||fallback();}catch(_){fallback();}}
     if(key==='scenario'){pendingError=v==='pending-error';usageError=v==='usage-error';approvalError=v==='approval-error';saveFailOnce=v==='credit-save-fail'||saveFailOnce&&v!=='session';planError=v==='plan-error';statsError=v==='stats';tokenError=v==='tokens-error';associationError=v==='association-error';detailState=['loading','error','stale'].includes(v)?v:'normal';if(v.startsWith('association-'))associationScene=v.slice(12);else associationScene='normal';if(v==='session'){S.role='guest';S.layer=null;S.demo=false;}CF.render();}
     return true;
   },
   layers:{...old.layers,'mc-credit-modify':()=>modifyLayer(),'mc-revoke':()=>revokeLayer(),'mc-source-unavailable':()=>({title:L('Content unavailable','内容不存在或无权访问'),html:'<p>'+L('Return to your console to view accessible records.','请返回控制台查看可访问记录。')+'</p>',foot:b('return',L('Return to console details','返回控制台详情'),safeRoute(params().get('mcReturn'))||'#/console')}),'mc-copy':()=>({title:L('Copy reference','复制编号'),html:'<input class="inp mc-copy-value" readonly value="'+E(copyValue)+'" aria-label="'+L('Reference number','完整编号')+'"><p>'+L('Select the text and copy it.','请选择文本后复制。')+'</p>',foot:'<button class="btn" data-act="closelayer">'+L('Close','关闭')+'</button>'})}
 };
 CF.define(CF.LSView=mod);
 /* 借贷广场的放款、还款演示脚本在本模块之后载入并接管 demo；控制台页面只给控制台自己的演示工具，借贷广场页面照旧。 */
 let inheritedDemo=mod.demo;
 Object.defineProperty(mod,'demo',{configurable:true,enumerable:true,
   get(){const f=inheritedDemo;return ()=>path().startsWith('/console')?(old.demo?.()||'')+reviewTools():f();},
   set(fn){inheritedDemo=fn;}});
 const composed=mod.content;mod.content=id=>(id==='P-LS-01'||id==='P-LS-02'?backBanner():'')+composed(id);
 document.addEventListener('change',e=>{
   if(e.target.id==='mc-revoke-scene'){revokeScene=e.target.value;return;}
   if(e.target.id==='mc-pending'&&path()==='/console'){returnNotice=false;setView({pending:e.target.checked?'1':'',page:1});return;}
   const group=e.target.dataset.filter;
   if(group&&group.startsWith('mc-')&&path()==='/console'){
     const key=group.slice(3);
     setView({[key]:Array.from(document.querySelectorAll('[data-filter="'+group+'"]')).filter(b=>b.checked).map(b=>b.value).join(','),page:1});
     return;
   }
   if(e.target.id==='mc-targetProject'&&path().startsWith('/console/')){const q=params();q.set('targetProject',e.target.value);history.replaceState(null,'','#'+path()+'?'+q);CF.render();document.getElementById('mc-targetProject')?.focus();return;}if(path()!=='/console'||!e.target.id.startsWith('mc-'))return;const k=e.target.id.slice(3);if(['filter','secondary','project','sort','size','periodState','tokenType'].includes(k))setView({[k]:k==='size'?+e.target.value:e.target.value,page:1});});
 document.addEventListener('click',e=>{
   const note=document.querySelector('.mc-stat-note[open]');if(note&&!note.contains(e.target))note.open=false;
   const chapter=e.target.closest('[data-act=mc-section]');if(chapter){e.preventDefault();e.stopImmediatePropagation();mod.onAct('mc-section',chapter.dataset.v,e);syncChapters();return;}
   if(e.target.closest('a[data-act=mc-detail]')&&(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)){e.stopImmediatePropagation();return;}
   const nav=e.target.closest('#nav a,.brand');if(nav&&['#/assets','#/marketplace','#/console','#/'].includes(nav.getAttribute('href'))){e.preventDefault();e.stopImmediatePropagation();navigate(nav.getAttribute('href')==='#/'?'#/assets':nav.getAttribute('href'));return;}
   const period=e.target.closest('.mc-period summary');if(period){const u=params();u.set('period',period.dataset.period);history.replaceState(null,'','#'+path()+'?'+u);}
   const row=e.target.closest('.mc-table tr[data-id]');if(row&&!e.target.closest('button,a,input,select,summary,details'))goDetail(row.dataset.kind,row.dataset.id);
 },true);
 document.addEventListener('keydown',e=>{if(e.target.id==='mc-query'&&e.key==='Enter'){e.preventDefault();setView({query:e.target.value.trim(),page:1});}
   if(e.key==='Escape'){const note=document.querySelector('.mc-stat-note[open]');if(note){note.open=false;note.querySelector('summary').focus();}}
if(e.target.matches('.mc-table tr[data-id]')&&['Enter',' '].includes(e.key)){e.preventDefault();goDetail(e.target.dataset.kind,e.target.dataset.id);}
   if(e.target.matches('.mc-tabs [role=tab]')&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const ts=[...document.querySelectorAll('.mc-tabs button')],i=ts.indexOf(e.target),n=e.key==='Home'?0:e.key==='End'?ts.length-1:(i+(e.key==='ArrowRight'?1:ts.length-1))%ts.length;ts[n].click();setTimeout(()=>document.querySelector('.mc-tabs [aria-selected=true]')?.focus(),0);}
 });
 window.addEventListener('hashchange',()=>{if(!restoring&&path().startsWith('/console'))detailState='normal';});

 let chapterFrame=0,chapterTarget='';
 // Keep the console entry visible when the shared header uses a horizontal nav.
 /* 面包屑跟随页面层级：我的控制台 › 列表分类 › 当前对象；分类返回原列表视图。 */
 function syncCrumb(){
   const k=path().split('/')[2],kind=k==='loans'?'repayments':k,crumb=document.getElementById('crumb');
   if(!path().startsWith('/console/')||!kinds.includes(kind)||kind==='projects'||!crumb||!allowed())return;
   const listed=safeRoute(params().get('list'),false),back=listed&&new URLSearchParams(listed.split('?')[1]||'').get('tab')===kind?listed:'#/console?tab='+kind;
   const title=document.querySelector('.mc-detail .page-title')?.textContent||text(titles[kind]);
   const item=(t,h,i)=>'<li class="crumb-item'+(h?'':' is-current')+'">'+(i?'<span class="crumb-sep" aria-hidden="true">›</span>':'')+(h?'<a class="crumb-link" href="'+E(h)+'">'+E(t)+'</a>':'<span class="crumb-cur" aria-current="page">'+E(t)+'</span>')+'</li>';
   crumb.innerHTML='<nav class="breadcrumb" aria-label="'+L('Breadcrumb','面包屑导航')+'"><ol class="crumb-list">'+item(L('My console','我的控制台'),'#/console',0)+item(nm(kind),back,1)+item(title,'',2)+'</ol></nav>';
   const wrap=document.getElementById('subwrap');if(wrap)wrap.hidden=false;
 }
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
