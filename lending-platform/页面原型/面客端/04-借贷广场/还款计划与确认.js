/* WS-449 / L8 链上还款. Reuses accepted quotes and their on-chain disbursement; signing, chain results and balances are local demonstration. */
(function(CF){
  'use strict';
  ['P-LS-09','P-LS-91'].forEach(id=>CF.PAGES[id]={end:'asset',layout:'portal',parent:'P-LS-02',presentation:'drawer'});
  const S=CF.S,L=CF.L,E=CF.esc,D=CF.LS,Q=CF.CQ,V=CF.LSView,DAY=86400000,H=3600000;
  const b=(act,text,v='',primary=false,off=false)=>'<button type="button" class="btn'+(primary?' primary':'')+'" data-act="rp-'+act+'" data-v="'+E(v)+'"'+(off?' disabled':'')+'>'+text+'</button>';
  const dl=rows=>'<dl class="dl">'+rows.map(([k,v])=>'<div class="rp-fact"><dt>'+k+'</dt><dd>'+v+'</dd></div>').join('')+'</dl>';
  const section=(title,body,id='')=>'<section class="rp-section"'+(id?' id="'+id+'" tabindex="-1"':'')+'><h3>'+title+'</h3>'+body+'</section>';
  const amount=(n,c='USDT')=>CF.fmtAmt(n)+' '+c;
  const iso=n=>new Date(n).toISOString(),day=n=>iso(n).slice(0,10),date=s=>CF.fmtDate(s),time=s=>s?CF.fmtTime(s):'—';
  const round=n=>Math.round((n+Number.EPSILON)*100)/100;
  /* 查验入口为演示取值；正式入口由研发确定，不可用时只保留复制。 */
  const explorer=h=>'https://etherscan.io/tx/'+h;
  const SUPPORT_EMAIL='support@harbourcredit.example';
  /* 演示开关：收款地址读取、出账账户读取、余额、还款合约与签名结果。 */
  let explorerReady=true,accountRead='ready',fromScene='ready',balanceScene='enough',contractRead='ready',signScene='success',load='ready',walletScene='ready',approvalRead='ready';
  let selected='',seq=1,form={from:''},errors={},busy=false,checking=false,epoch=0,origin=null,back=null,returnUI=null,errorFocus='',lastRole=S.role,lastHash=location.hash,clockOverride=Number(Q.data().repaymentClock)||0;
  let serial=0,savedUI=null,externalReturn=null,accountsTrip=null,justSettled=null;
  const listViews=new Map(),openRows=new Map();
  let events=Q.data().repaymentEvents||(Q.data().repaymentEvents=[]);
  const now=()=>clockOverride||D.now();
  const quote=id=>Q.data().quotes.find(q=>q.id===id),deal=id=>Q.disbursements().find(x=>x.id===(id||selected)),plan=()=>quote(selected)?.l8,period=()=>plan()?.periods.find(p=>p.seq===seq);
  const party=x=>!!x&&!!quote(x.id)&&Q.related(quote(x.id));
  const visible=x=>!!x&&(party(x)||S.role==='fund');
  const projectVisible=p=>!!p&&(S.role==='fund'||S.role==='asset'&&D.mine(p));
  const businessOverdue=x=>(quote(x.id)?.l8?.periods||[]).filter(p=>p.state!=='settled'&&overdue(p)>0);
  const overdueBadge=x=>businessOverdue(x).length?CF.tag('',L('Overdue · unsettled','逾期 · 未结清')):'';
  const deniedView=()=>({title:L('Repayment unavailable','还款业务不可用'),html:CF.note('',L('This repayment target is unavailable for your account. Return to the project to continue.','当前账号无法查看此还款目标，请返回项目继续。')),foot:b('back',L('Back to project','返回项目'))});
  /* RP-15 还款开放为应还日 00:00 UTC；应还临近提醒提前三个自然日，只帮助准备余额、不开放还款。 */
  const openAt=p=>Date.parse(p.due),remindAt=p=>Date.parse(p.due)-3*DAY;
  /* RP-14 资金方还款收款地址：报价时选定的 QT-18 快照，随链上放款记录交来，本模块只读承接。 */
  const payee=x=>(x||deal())?.record?.account||null;
  const funder=x=>x.fund==='fund-b'?L('Demo Capital B','演示资金机构 B'):L('Demo Capital A','演示资金机构 A');
  /* 仅还款交易发出才提交；授权阶段保持待还款，不冻结逾期。 */
  const sub=p=>p?.chain||(p?.state==='pending'?p.record:null);
  const unknown=p=>p?.state==='pending'&&sub(p)?.state==='unknown';
  const status=p=>unknown(p)?L('On-chain result to be verified','链上结果待核实'):L(...{due:['Awaiting repayment','待还款'],pending:['Repayment pending on-chain','还款上链确认中'],settled:['Settled','已结清']}[p.state]);
  const badge=p=>CF.tag(p.state==='settled'?'ok':p.state==='pending'?(unknown(p)?'warn':'accent'):'',status(p));
  const lateNow=p=>Math.max(0,Math.floor((Date.parse(day(now()))-Date.parse(p.due))/DAY));
  /* 签名提交即冻结；链上未成功的回到待还款，按应到时点连续计算。 */
  const overdue=p=>p.state==='settled'?(p.record?.overdue||0):p.state==='pending'?(sub(p)?.overdue??lateNow(p)):lateNow(p);
  const confirmed=x=>!!x&&['confirmed','settled'].includes(x.state)&&x.record;
  const available=p=>Q.disbursements().filter(x=>x.project===p.id&&confirmed(x));
  const processingOf=x=>(quote(x.id)?.l8?.periods||[]).find(p=>p.state==='pending');
  const approvalOf=x=>(quote(x.id)?.l8?.periods||[]).find(p=>p.state==='due'&&p.approval);
  const activeOf=x=>processingOf(x)||approvalOf(x);
  /* 原型未接合约服务，使用明确的本地演示还款合约，不能沿用质押合约地址。 */
  const repaymentContract=()=>D.project(deal().project).repaymentContract||'0x8b47C1a9F03b6D25e8A4c7B19f0D3e62A5c8b941';
  const rateText=x=>x.ccy==='USDT'?'1 USDT = 1 USDT':'1 USDT = '+(x.fx?.value??'—')+' '+E(x.ccy);
  const waited=t=>{const ms=Math.max(0,now()-Date.parse(t)),d=Math.floor(ms/DAY),h=Math.floor(ms/H),m=Math.max(1,Math.round(ms/60000));return d>=1?d+L(d>1?' days':' day',' 天'):h>=1?h+L(h>1?' hours':' hour',' 小时'):m+L(' min',' 分钟');};
  function addMonths(s,n){const [y,m,d]=s.split('-').map(Number),first=new Date(Date.UTC(y,m-1+n,1)),last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();return day(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),Math.min(d,last)));}
  /* 结算金额 = 应还合计 × 本笔汇率（1 USDT 折合的结算币种数量）。 */
  function build(start,end,principal,rate,fx){
    if(!start||!end||end<=start||!Number.isFinite(+fx)||+fx<=0)return [];
    const marks=[];for(let k=1;k<500;k++){const t=addMonths(start,3*k);if(t>=end)break;marks.push(t);}
    if(marks.length&&addMonths(marks.at(-1),3)>end)marks.pop();
    const bounds=[start,...marks,end];return bounds.slice(1).map((due,i)=>{const days=(Date.parse(due)-Date.parse(bounds[i]))/DAY,interest=round(principal*(+rate/100)*days/360),capital=i===bounds.length-2?principal:0;return {seq:i+1,from:bounds[i],due,days,principal:capital,interest,total:round(capital+interest),settlement:round((capital+interest)*fx),open:Date.parse(due),state:'due',record:null};});
  }
  function event(kind,x,p,owners){owners.forEach(owner=>{const id=[kind,x.id,p?.id||'',owner].join('|');if(events.some(e=>e.id===id))return;events.push({id,kind,deal:x.id,seq:p?.seq,owner,at:iso(now())});Q.save();});}
  /* 定稿取放款成功时间：起息日为其 UTC 日期，计划定稿时间为该时点。 */
  function ensure(){events=Q.data().repaymentEvents||(Q.data().repaymentEvents=[]);let changed=false;
    Q.data().quotes.forEach(q=>(q.l8?.periods||[]).forEach(p=>{if(p.open!==openAt(p)){p.open=openAt(p);changed=true;}}));Q.disbursements().filter(confirmed).forEach(x=>{const q=quote(x.id);if(!q.l8&&x.plan!=='waiting'){
    const start=day(Date.parse(x.confirmedAt||x.record.at)),end=day(Date.parse(q.repay));const periods=build(start,end,x.amount,x.rate,x.fx?.value);
    if(!periods.length)return;
    periods.forEach(p=>p.id='RP'+day(Date.parse(x.confirmedAt)).replaceAll('-','')+String(++serial).padStart(6,'0'));
    q.l8={start,end,at:x.confirmedAt,periods,settledAt:null};event('final',x,null,['asset']);changed=true;
  }});if(changed)Q.save();}
  function nearest(x){const ps=[...(quote(x.id)?.l8?.periods||[])].sort((a,b)=>a.due.localeCompare(b.due)||a.seq-b.seq);return ps.find(p=>['due','pending'].includes(p.state))||ps.at(-1);}
  const firstDue=p8=>p8?.periods.filter(p=>p.state==='due').sort((a,b)=>a.due.localeCompare(b.due)||a.seq-b.seq)[0];
  function choose(id,n){const x=deal(id);if(!x||!confirmed(x))return false;selected=id;seq=n||nearest(x)?.seq||1;return true;}
  /* 授权并还款：本笔资产方、本期待还款且已开放，本笔没有其他期次还款处理中。 */
  function can(){const x=deal(),p=period(),active=x&&activeOf(x);return !!(x&&p&&party(x)&&S.role==='asset'&&p.state==='due'&&now()>=openAt(p)&&(!active||active===p)&&(!p.approval||p.approval.state==='approved'));}
  function denied(){CF.toast(L('This action is not available for your account.','当前账号无权办理此操作。'));}
  function ids(p=period()){return deal().request+' · '+selected+' · '+(p?.id||'');}
  function support(compact=false){const body='<p class="rp-support-line">'+L('Support email: ','客服邮箱：')+'<span class="mono">'+SUPPORT_EMAIL+'</span>'+CF.copyBtn('rp-copy',SUPPORT_EMAIL,L('Copy support email','复制客服邮箱'))+'</p><p>'+L('Include the application, business and instalment references in your email.','邮件请注明融资申请编号、融资业务编号与还款期次编号。')+'</p><p class="rp-support-line"><span class="mono">'+E(ids())+'</span>'+CF.copyBtn('rp-copy',ids(),L('Copy reference numbers','复制业务编号'))+'</p>';
    return compact?'<details class="rp-help ls-history"><summary>'+L('Need help? Contact support','需要帮助？联系客服')+'</summary><div class="rp-support">'+body+'</div></details>':'<div class="rp-support"><b>'+L('Need help?','需要帮助？')+'</b>'+body+'</div>';}
  function settlementResult(x){const project=D.project(x.project);return '<p class="hint">'+(D.terminal(project)?L('The project has ended. View collateral status in the project; released tokens still need to be collected.','项目已终结，请在项目查看质押状态；已释放代币仍需提取。'):!project.expired&&!D.unfinished(project).length?L('All businesses are settled. The project is available again; collateral remains pledged until the project ends.','全部业务已结清，项目回到可用；项目终结前质押保持。'):L('Other project business remains unfinished. Collateral stays pledged.','项目仍有其他未完成业务，质押保持。'))+'</p>';}
  /* 非当事资金方：只读非隐私履约信息。 */
  function performance(){const p8=plan();return section(L('Repayment performance','还款履约'),!p8?CF.note('',L('Repayment schedule is being generated.','还款计划生成中。')):(p8.settledAt?dl([[L('Business settled at','业务结清时间'),time(p8.settledAt)]]):'')+ledger('detail'));}
  /* 地址只读卡片：备注名、网络与完整地址；办理与记录内可复制完整值。 */
  const addrName=a=>a?.label?(Array.isArray(a.label)?L(...a.label):a.label):'';
  const addrCard=a=>a?'<div class="cq-address rp-address">'+(addrName(a)?'<b>'+E(addrName(a))+'</b>':'')+'<span class="hint">Ethereum</span><span class="rp-address-line">'+(a.address?CF.addrFull(a.address):'—')+'</span></div>':'—';
  const addrInline=a=>a?.address?'<span class="rp-address-line">'+CF.addrFull(a.address)+'</span>'+(addrName(a)?'<div class="hint">'+E(addrName(a))+' · Ethereum</div>':''):'—';
  const tail=a=>a?.address?a.address.slice(0,6)+'…'+a.address.slice(-4):'';
  /* 交易哈希：与 WS-446 同一组件——缩写展示，点击复制完整值，另可新窗口打开区块链浏览器；入口不可用时不给死链接。未取得不显示占位。 */
  const hashChip=h=>h?'<span class="ls-hash rp-hash"><button type="button" class="ls-hash-copy mono" data-act="rp-copy" data-v="'+E(h)+'" title="'+E(h)+'" aria-label="'+L('Copy transaction hash ','复制交易哈希 ')+E(h)+'">'+E(h.slice(0,6)+'…'+h.slice(-4))+'</button>'+(explorerReady?CF.linkOut(explorer(h),L('Open the transaction in a blockchain explorer (new window)','在区块链浏览器打开该交易（新窗口）')):'')+'</span>':'';
  const netChip=()=>CF.market?.network?CF.market.network('ETH').replace(/<span>[^<]*<\/span><\/span>$/,'<span>Ethereum</span></span>'):'Ethereum';
  /* 签名旁核对的还款合约：名称、网络、完整地址，可复制、可在区块链浏览器打开；读取失败不能签名，可重试。 */
  function contractCheck(contract){
    if(contractRead!=='ready')return '<div class="ls-inline-fail rp-contract-fail" role="alert"><span>'+L('The repayment contract is temporarily unavailable, so you cannot sign right now.','还款合约信息暂时不可用，暂不能签名。')+'</span>'+b('contract-retry',L('Retry','重试'))+'</div>';
    return '<dl class="ls-signing-facts"><div class="ls-signing-contract"><dt><span class="ls-signing-label">'+L('Repayment contract','还款合约')+netChip()+'</span><span class="ls-signing-tools">'+CF.copyBtn('rp-copy',contract,L('Copy repayment contract address','复制还款合约地址'))+(explorerReady?CF.linkOut('https://etherscan.io/address/'+encodeURIComponent(contract),L('Open the contract in a blockchain explorer (new window)','在区块链浏览器打开该合约（新窗口）')):'')+'</span></dt><dd><span class="mono ls-signing-address">'+E(contract)+'</span></dd></div></dl>';
  }
  /* 逐期台账：一期一行；展开看本期拆分、处理中事实与链上还款记录。非当事方只得非隐私列。mode：detail 只读详情 / plan 计划抽屉 / inline 办理内计划。 */
  function ledger(mode){const x=deal(),p8=plan(),own=party(x),n=p8.periods.length,current=period(),requested=new URLSearchParams(location.hash.split('?')[1]||'').get('mcPeriod'),original=mode==='detail'&&requested&&current?.id===requested?current:null;
    const focus=mode==='detail'?[...p8.periods.filter(p=>p.state==='pending'),original].filter(Boolean):[];
    const heads=[L('Instalment','期次'),L('Due date (UTC)','应还日（UTC）'),...(own?[L('Total due (USDT)','应还合计（USDT）'),L('Settlement amount','结算金额')]:[]),L('Status','期次状态'),L('Overdue days','逾期天数')];
    const cell=(i,v,num=false)=>'<span class="rp-inst-cell'+(num?' rp-num':'')+'"><span class="rp-inst-k">'+heads[i]+'</span><span class="rp-inst-v">'+v+'</span></span>';
    const row=p=>{const key=selected+'|'+mode+'|'+p.seq,open=openRows.has(key)?openRows.get(key):focus.includes(p),late=overdue(p);
      const summary=cell(0,'<b>'+p.seq+' / '+n+'</b>'+(p===current?'<span class="sr-only">'+L(' · current',' · 本期')+'</span>':''))+cell(1,date(p.due))+(own?cell(2,CF.fmtAmt(p.total),true)+cell(3,amount(p.settlement,x.ccy),true):'')+cell(own?4:2,badge(p))+cell(own?5:3,late+(p.state!=='due'&&late?L(' · frozen',' · 已冻结'):''));
      const facts=own?[[L('Instalment reference','还款期次编号'),E(p.id)],[L('Principal / interest (USDT)','本金 / 利息（USDT）'),CF.fmtAmt(p.principal)+' / '+CF.fmtAmt(p.interest)],[L('Accrual period','计息区间'),date(p.from)+' → '+date(p.due)+' · '+p.days+L(' days',' 天')]]
        :[[L('Instalment reference','还款期次编号'),E(p.id)],...(p.state==='settled'?[[L('Repaid at','还款成功时间'),time(p.record?.confirmedAt)]]:[])];
      const extra=own&&mode==='detail'?(p.state==='settled'&&p.record?recordView(p):p.state==='pending'?chainFacts(p):''):'';
      const body=dl(facts)+extra+(own&&p.principal?'<p class="hint">'+L('Final instalment includes principal','末期含本金')+(p.days>93?L(' and the merged final period.','及合并尾段。'):'')+'</p>':'');
      return '<details class="rp-inst" data-key="'+E(key)+'"'+(original===p?' id="rp-original"':'')+(open?' open':'')+(p===current?' aria-current="true"':'')+'><summary>'+summary+'</summary><div class="rp-inst-body">'+body+'</div></details>';};
    const sum=k=>p8.periods.reduce((n,p)=>n+p[k],0),totals=own&&mode!=='inline'?'<p class="rp-ledger-total"><span>'+L('Total (USDT)','合计（USDT）')+'</span><span>'+L('Principal ','本金 ')+'<b class="mono">'+CF.fmtAmt(x.amount)+'</b></span><span>'+L('Interest ','利息 ')+'<b class="mono">'+CF.fmtAmt(sum('interest'))+'</b></span><span>'+L('Total due ','应还合计 ')+'<b class="mono">'+CF.fmtAmt(sum('total'))+'</b></span></p>':'';
    return '<div class="rp-ledger" data-private="'+own+'"><div class="rp-ledger-head" aria-hidden="true">'+heads.map((h,i)=>'<span'+(own&&(i===2||i===3)?' class="rp-num"':'')+'>'+h+'</span>').join('')+'</div>'+p8.periods.map(row).join('')+'</div>'+totals;}
  const basis=()=>L('Simple interest · actual days ÷ 360 · start included, due date excluded','年化单利 · 实际天数 ÷ 360 · 算头不算尾');
  function planFacts(withTitle){const x=deal(),p8=plan();
    return (withTitle?'<div class="rp-plan-title"><b>'+E(x.request)+' · '+E(funder(x))+'</b><p class="mono hint">'+E(x.id)+' · '+E(x.record.id)+'</p></div>':'')+'<div class="rp-plan-facts">'+dl([[L('Settlement currency · rate','结算币种 · 汇率'),E(x.ccy)+' · '+rateText(x)],[L('Annual financing rate','年化融资利率'),x.rate+'% · ACT/360'],[L('Interest starts (UTC)','起息日（UTC）'),date(p8.start)],[L('Finalized at','定稿时间'),time(p8.at)],[L('Interest basis','计息规则'),basis()]])+'</div>';}
  /* 处理中进度：只给提交时间与已等待；出账地址、交易哈希与 gas 只在操作记录出现一次。 */
  function chainFacts(p){const c=sub(p);if(!c)return '';return dl([[L('Submitted at','提交时间'),time(c.at)],[L('Waiting','已等待'),waited(c.at)]]);}
  /* 链上还款记录：只给业务结果；交易哈希与 gas 见同一期在操作记录中的两条。 */
  function recordView(p){const r=p.record;return '<section class="rp-section"><h3>'+L('On-chain repayment record','链上还款记录')+'</h3>'+dl([[L('Record ID','还款记录编号'),E(r.id||'—')],[L('Repaid at','还款成功时间'),time(r.confirmedAt)],[L('Currency / amount','还款币种与金额'),'<span class="mono">'+amount(r.amount??p.settlement,r.ccy||deal().ccy)+'</span>'],[L('Repayment nature','还款性质'),r.overdue?L('Overdue repayment','逾期还款'):L('Normal repayment','正常还款')],[L('Submitted at','提交时间'),time(r.at)],[L('Network','网络'),'Ethereum · ERC-20'],[L('Paying address','出账地址'),addrInline(r.from)],[L('Repayment address','收款地址'),addrInline(r.account)]])+'<p class="hint rp-record-ref">'+L('Transaction hashes and gas: see instalment '+p.seq+' in Operation records below.','交易哈希与 gas 见下方操作记录中第 '+p.seq+' 期的两条。')+'</p></section>';}
  /* 操作记录：一笔融资业务一份，本笔全部已发出的授权交易与还款交易，详情中交易哈希唯一的展示位置。
     每笔一条：时间、操作（第 N 期还款授权 / 第 N 期链上还款）、出账地址、交易哈希、实际 gas；尚未成功的标明状态。本笔双方可见。 */
  /* 本期已结束的办理（失败或主动结束）逐次保留；旧本地数据只有最近一次时按一次读取。 */
  const attempts=p=>p.attempts||(p.lastAttempt?[p.lastAttempt]:[]);
  const archive=(p,t)=>{p.lastAttempt=t;p.attempts=[...attempts(p).filter(o=>o!==t),t];};
  function operations(x){
    const rows=[],gas=v=>v?E(v)+' ETH':L('To be verified','待核实');
    const add=(p,kind,at,from,hash,state,fee)=>{if(hash)rows.push({seq:p.seq,kind,at,from,hash,state,fee});};
    (quote(x.id)?.l8?.periods||[]).forEach(p=>{
      /* 已结束的办理：仅授权（授权失败或授权后结束）只有授权一条；还款交易已发出的另有还款一条。 */
      attempts(p).forEach(t=>{if(!t.authHash){add(p,'auth',t.at,t.from,t.hash,t.state==='failed'?'failed':'',t.gas);return;}add(p,'auth',t.authAt||t.at,t.from,t.authHash,'',t.authGas);add(p,'repay',t.at,t.from,t.hash,'failed',t.repayGas);});
      const a=p.approval;if(a)add(p,'auth',a.at,a.from,a.hash,a.state==='approved'?'':a.state,a.gas);
      const c=p.chain;if(c){add(p,'auth',c.authAt||c.at,c.from,c.authHash,'',c.authGas);add(p,'repay',c.at,c.from,c.hash,c.state,null);}
      const r=p.record;if(r){add(p,'auth',r.authAt||r.at,r.from,r.authHash,'',r.authGas||r.gas);add(p,'repay',r.at,r.from,r.hash,'',r.repayGas);}
    });
    rows.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||b.seq-a.seq||(a.kind==='repay'?-1:1));
    if(!rows.length)return '<p class="hint">'+L('No on-chain transactions yet.','暂无链上交易。')+'</p>';
    const op=r=>r.kind==='auth'?L('Instalment '+r.seq+' · repayment approval','第 '+r.seq+' 期还款授权'):L('Instalment '+r.seq+' · on-chain repayment','第 '+r.seq+' 期链上还款');
    const st=s=>s==='processing'?CF.tag('warn',L('Processing','处理中')):s==='unknown'?CF.tag('warn',L('To be verified','待核实')):s==='failed'?CF.tag('danger',L('Not completed','未成功')):'';
    const tz=E(S.tz||'UTC'),heads=[L('Time','时间')+' ('+tz+')',L('Operation','操作'),L('Address','地址'),L('Transaction hash','交易哈希'),L('Actual gas','实际 gas')];
    const td=(i,html)=>'<td data-label="'+E(heads[i])+'">'+html+'</td>';
    return '<div class="tablewrap"><table class="tbl resp ls-token-ops ls-token-ops-owner rp-ops"><thead><tr>'+heads.map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'
      +rows.map(r=>'<tr>'+td(0,'<time class="mono" datetime="'+E(r.at)+'" title="'+E(time(r.at))+'">'+E(CF.fmtStamp(r.at))+'</time>')+td(1,'<span class="ls-op-name">'+op(r)+'</span>'+(st(r.state)?'<span class="ls-op-state">'+st(r.state)+'</span>':''))+td(2,r.from?.address?CF.addrCopy(r.from.address):'—')+td(3,hashChip(r.hash))+td(4,'<span class="mono">'+gas(r.fee)+'</span>')+'</tr>').join('')+'</tbody></table></div>';
  }
  /* 处理中 / 待核实 / 上次未完成：当事方都能看到本期的链上进展，资金方没有办理动作。 */
  function chainNote(p){if(!p||p.state!=='pending')return '';const c=sub(p);
    if(unknown(p))return CF.note('warn',L('On-chain result to be verified. Please contact platform support; do not start this repayment again.','链上结果待核实，请联系平台客服人员，不要重复发起。'));
    return CF.note('',(S.role==='fund'?L('The asset holder has signed instalment '+p.seq+'. It is pending on-chain','资产方已签名提交第 '+p.seq+' 期还款，上链确认中'):L('Instalment '+p.seq+' is pending on-chain','第 '+p.seq+' 期还款上链确认中'))+(c?.at?L(' · waited ',' · 已等待 ')+waited(c.at):'')+L('. It settles once the repayment is on chain; no funder confirmation is needed. Overdue days are frozen.','。链上还款成功即本期结清，无需资金方确认；逾期天数已冻结。'));}
  function failNote(p){const f=p?.lastFail;if(!f||p.state!=='due'||S.role!=='asset'||!party(deal()))return '';
    return CF.note('warn','<p>'+L('Your last repayment was not completed on chain: ','上次还款未在链上完成：')+L(...f.reason)+L(' This instalment is still awaiting repayment and the amount is unchanged.','本期仍为待还款，金额不变。')+(f.authGas?L(' Approval gas incurred: '+f.authGas+' ETH.','已产生授权 gas '+f.authGas+' ETH。')+(f.repayGas?L(' Repayment gas incurred: '+f.repayGas+' ETH.','已产生还款 gas '+f.repayGas+' ETH。'):'')+L(' Gas incurred is not refunded.','已产生的费用不退。'):f.gas?L(' Gas incurred: '+f.gas+' ETH, not refunded.','已产生 gas '+f.gas+' ETH，不退回。'):'')+L(' You can approve and repay again.','可以重新授权并还款。')+'</p>'+(f.auth?'<p>'+L('The approval is still on chain. You can revoke it in your wallet if needed.','授权仍在链上，需要时可在钱包中自行撤销。')+'</p>':''));}
  function periodInfo(p){const x=deal(),late=overdue(p);return '<div class="rp-period"><div class="rp-row"><b>'+L('Instalment ','第 ')+p.seq+' / '+plan().periods.length+L('',' 期')+'</b>'+badge(p)+'</div><p class="hint rp-period-date">'+L('Due (UTC) ','应还日（UTC） ')+date(p.due)+'</p><div class="rp-amount mono"><span class="rp-amount-label">'+L('Settlement amount','本期结算金额')+'</span>'+amount(p.settlement,x.ccy)+'</div><div class="rp-period-total">'+L('Total due ','应还合计 ')+'<b class="mono">'+amount(p.total)+'</b></div>'+(late?'<p class="rp-overdue">'+L('Overdue ','逾期 ')+late+L(' days',' 天')+(p.state!=='due'?L(' · Frozen',' · 已冻结'):L(' · Frozen when the repayment transaction is sent',' · 还款交易发出即冻结'))+'</p>':'')+'</div>';}
  function panel(p){ensure();if(!projectVisible(p))return {body:'',primary:'',secondary:''};const list=repaymentChoices(p).filter(party),done=justSettled&&available(p).find(x=>x.id===justSettled.deal&&quote(x.id)?.l8?.settledAt);
    /* 本次还款使本笔结清：停留在原处给出结清结果。 */
    if(!list.length&&done)return {body:'<section id="repayment" class="rp-panel"><h3>'+L('Repayment','还款流程')+'</h3>'+CF.note('ok',L('Instalment '+justSettled.seq+' repaid on chain. This financing business is settled.','第 '+justSettled.seq+' 期链上还款成功，本笔融资业务已结清。'))+settlementResult(done)+'</section>',primary:'',secondary:b('detail',L('View repayment details','查看还款详情'),done.id)};
    if(!list.length)return {body:CF.empty(L('No repayments yet','暂无还款信息'),available(p).length?L('No instalments need action. Plans and settled records are in the repayment list.','暂无需要办理的期次，计划生成情况及已结清记录见还款列表。'):L('Repayment schedules and actions become available after a disbursement succeeds.','放款成功后可查看还款计划和办理还款。')),primary:S.role==='guest'?'<button class="btn primary" data-act="signin">'+L('Connect wallet','连接钱包')+'</button>':'',secondary:''};if(!list.some(x=>x.id===selected)){if(S.layer?.key.startsWith('rp-'))return {body:CF.note('',L('View the current business in the open details.','请在已打开的详情中查看本笔业务。')),primary:'',secondary:''};choose(list[0].id);}const x=deal(),p8=plan(),r=activeOf(x)||nearest(x);
    /* 原生下拉：办理区是滚动容器，自绘下拉会被裁切；选项与选中结果都给出出资机构、应还日与放款编号。 */
    const choice=item=>funder(item)+' · '+date(nearest(item).due)+' · '+item.record.id;
    const selection=list.length===1?'':'<div class="field"><label for="rp-business">'+L('Repayment business','还款业务')+'</label><select id="rp-business" class="inp" aria-describedby="rp-business-current">'+list.map(item=>'<option value="'+E(item.id)+'"'+(item.id===selected?' selected':'')+'>'+E(choice(item))+'</option>').join('')+'</select><p class="hint rp-business-current" id="rp-business-current">'+L('Due ','应还日 ')+date(nearest(x).due)+'</p></div>';
    const body='<section id="repayment" class="rp-panel"><h3>'+L('Repayment','还款流程')+'</h3>'+selection+(justSettled?.deal===x.id&&!p8?.settledAt?CF.note('ok',L('Instalment '+justSettled.seq+' repaid on chain and settled.','第 '+justSettled.seq+' 期链上还款成功，已结清。')):'')+(!p8?CF.note('',L('Repayment plan is being generated.','还款计划生成中。')):p8.settledAt?CF.note('ok',L('This financing business is settled.','本笔融资业务已结清。'))+(dl([[L('Settled at','结清时间'),time(p8.settledAt)],[L('Principal repaid','累计已还本金'),amount(x.amount)],[L('Interest repaid','累计已还利息'),amount(p8.periods.reduce((n,p)=>n+p.interest,0))]])):r?periodInfo(r)+approvalNote(r)+chainNote(r)+failNote(r):'')+(p8?.settledAt?settlementResult(x):'')+'</section>';
    let primary='';if(S.role==='guest')primary='<button class="btn primary" data-act="signin">'+L('Connect wallet','连接钱包')+'</button>';else if(p8&&party(x)&&S.role==='asset'&&!processingOf(x)&&p8.periods.some(p=>p.state==='due'&&now()>=openAt(p)))primary=b('open',approvalOf(x)?L('Continue repayment','继续还款'):L('Repay','立即还款'),'pay',true);
    const reason=!primary&&r&&r.state==='due'?(now()<openAt(r)?L('Repayment opens at ','还款开放于 ')+time(iso(openAt(r))):S.role==='fund'?L('Awaiting asset holder repayment. No action is needed from you.','等待资产方还款，你无需操作。'):''):'';return {body:body+(reason?CF.note('',reason):''),primary,secondary:b('detail',L('View repayment details','查看还款详情'),x.id)};
  }
  function repaymentChoices(p){return available(p).filter(x=>quote(x.id)?.l8?.periods.some(r=>['due','pending'].includes(r.state))).sort((a,b)=>(nearest(a)?.due||'9999').localeCompare(nearest(b)?.due||'9999')||Date.parse(a.confirmedAt)-Date.parse(b.confirmedAt)||a.id.localeCompare(b.id));}

  /* 清单仅展示业务状态；计划生成进度留在详情，未生成计划的业务仍为还款中。 */
  const stateOf=x=>quote(x.id)?.l8?.settledAt?'settled':'repaying';
  function repaymentState(x){return stateOf(x)==='settled'?CF.tag('ok',L('Settled','已结清')):CF.tag('accent',L('Repaying','还款中'));}
  function recordTable(project){
    ensure();if(!projectVisible(project))return '';
    const privateColumns=available(project).some(party);
    if(!listViews.has(project.id))listViews.set(project.id,{query:'',state:'',overdue:'',page:1});
    const view=listViews.get(project.id),all=available(project).filter(x=>(!view.state||stateOf(x)===view.state)&&(!view.overdue||(businessOverdue(x).length?'yes':'no')===view.overdue)&&[x.request,x.id,x.record?.id,funder(x)].some(v=>String(v||'').toLowerCase().includes(view.query.toLowerCase()))).sort((a,b)=>Date.parse(b.confirmedAt)-Date.parse(a.confirmedAt)||b.id.localeCompare(a.id)),pages=Math.max(1,Math.ceil(all.length/5));
    view.page=Math.min(view.page,pages);
    const rows=all.slice((view.page-1)*5,view.page*5),heads=[[L('Application / business','融资申请 / 业务'),'rp-col-request'],[L('Disbursement no.','放款编号'),'rp-col-loan'],[L('Funder','出资机构'),'rp-col-funder'],...(privateColumns?[[L('Repayment date (UTC)','还款时间（UTC）'),'rp-col-time'],[L('Current instalment','本期应还'),'rp-col-amount rp-num']]:[]),[L('Status','状态'),'rp-col-status'],[L('Overdue','逾期'),'rp-col-overdue']];
    const cell=(i,html)=>'<td data-label="'+E(heads[i][0])+'" class="'+heads[i][1]+'"><div class="rp-cell-value">'+html+'</div></td>';
    /* 一笔一行、一列一项：还款时间只展示本期应还日，本期应还只展示金额，状态只给业务状态，逾期单独一列；期次、开放时刻与上链确认中等进度都在详情。 */
    const overdueCell=(x,late)=>businessOverdue(x).length?CF.tag('warn',party(x)&&late?L('Overdue '+late+(late>1?' days':' day'),'逾期 '+late+' 天'):L('Overdue','逾期')):'<span class="hint">'+L('Not overdue','未逾期')+'</span>';
    const privateEmpty=(x,p8,p)=>!party(x)?L('Parties only','仅本笔双方可见'):!p8?'—':!p?L('No instalments awaiting repayment','暂无待还期次'):'';
    const current=(x,p8,p)=>{const empty=privateEmpty(x,p8,p);return empty?'<span class="hint">'+empty+'</span>':'<b class="mono">'+amount(p.settlement,x.ccy)+'</b>'+(x.ccy==='USDT'?'':'<div class="hint">'+L('Total ','应还合计 ')+amount(p.total)+'</div>');};
    const repaymentTime=(x,p8,p)=>{const empty=privateEmpty(x,p8,p);return empty?'<span class="hint">'+empty+'</span>':'<span>'+date(p.due)+'</span>';};
    const content=rows.map(x=>{
      const p8=quote(x.id)?.l8,p=firstDue(p8),pending=processingOf(x),late=p&&overdue(p)||pending&&overdue(pending)||0;
      return '<tr data-act="rp-detail" data-v="'+E(x.id)+'" tabindex="0" role="button" aria-label="'+L('View repayment ','查看还款 ')+E(x.request)+'">'
        +cell(0,'<strong>'+E(x.request)+'</strong><div class="hint mono">'+E(x.id)+'</div>')
        +cell(1,'<span class="mono">'+E(x.record.id)+'</span>')
        +cell(2,E(funder(x)))
        +(privateColumns?cell(3,repaymentTime(x,p8,p))+cell(4,current(x,p8,p)):'')
        +cell(heads.length-2,repaymentState(x))+cell(heads.length-1,overdueCell(x,late))+'</tr>';
    }).join('');
    /* 筛选与项目内代币清单同构：条件下拉即时生效，编号搜索回车或离开输入框后生效，重置为轻操作。 */
    const filtered=!!(view.query||view.state||view.overdue);
    return '<div class="filterbar ls-token-filters rp-list-filters" role="search" data-rp-project="'+E(project.id)+'" aria-label="'+L('Filter repayments','筛选还款业务')+'">'+CF.filterSelect('rp-tf-state',L('Business status','业务状态'),[['',L('All','全部')],['repaying',L('Repaying','还款中')],['settled',L('Settled','已结清')]],view.state)+CF.filterSelect('rp-tf-overdue',L('Overdue','逾期'),[['',L('All','全部')],['yes',L('Overdue · unsettled','逾期 · 未结清')],['no',L('Not overdue','无逾期')]],view.overdue)+CF.filterSearch('rp-tf-keyword',L('Application / business / disbursement no.','申请 / 业务 / 放款编号'),view.query,L('Search application, business or disbursement number','搜索融资申请、业务或放款编号'))+'<div class="fb-acts">'+b('table-reset',L('Reset','重置'),project.id)+'</div></div>'
      +'<div class="rp-record-scroll"><table class="tbl rp-record-table" data-private="'+privateColumns+'"><thead><tr>'+heads.map(([label,cls])=>'<th scope="col" class="'+cls+'">'+label+'</th>').join('')+'</tr></thead><tbody>'+content+'</tbody></table></div>'
      +(!rows.length?CF.empty(L('No repayment information','暂无还款信息'),filtered?L('No repayments match these filters. Adjust or reset them.','没有符合条件的还款业务，请调整或重置筛选。'):L('Repayment schedules and actions become available after a disbursement succeeds.','放款成功后可查看还款计划和办理还款。')):'')
      +'<div class="rp-pagination"><span class="hint">'+all.length+L(' businesses',' 笔业务')+' · '+L('5 per page','每页 5 条')+'</span><div>'+b('table-page',L('Previous','上一页'),project.id+'|'+(view.page-1),false,view.page===1)+' <span>'+view.page+' / '+pages+'</span> '+b('table-page',L('Next','下一页'),project.id+'|'+(view.page+1),false,view.page===pages)+'</div></div>';
  }
  /* 详情：本期应还（含期次、开放时刻与处理中进展）→ 业务信息 → 还款计划（逐期台账与还款记录）→ 资金方还款收款地址 → 操作记录（交易哈希唯一位置）→ 需要帮助（页面最下方）。 */
  function summary(x,p8){const n=p8.periods.length,sum=k=>p8.periods.reduce((t,p)=>t+p[k],0);
    if(p8.settledAt)return '<section class="rp-summary"><div class="rp-summary-head"><div><span class="hint">'+L('Repayment','还款')+'</span><div class="rp-summary-amount">'+L('All instalments settled','全部期次已结清')+'</div></div>'+CF.tag('ok',L('Settled','已结清'))+'</div>'+dl([[L('Settled at','结清时间'),time(p8.settledAt)],[L('Principal repaid (USDT)','累计已还本金（USDT）'),'<span class="mono">'+CF.fmtAmt(x.amount)+'</span>'],[L('Interest repaid (USDT)','累计已还利息（USDT）'),'<span class="mono">'+CF.fmtAmt(sum('interest'))+'</span>']])+settlementResult(x)+'</section>';
    const pending=processingOf(x),p=pending||(period()?.state==='due'?period():firstDue(p8)||nearest(x)),late=overdue(p),next=pending?firstDue(p8):null;
    const note=p.state==='pending'?chainNote(p):now()<openAt(p)?'<p class="hint">'+L('Repayment opens ','还款开放时间：')+time(iso(openAt(p)))+'</p>':failNote(p)||(late?'<p class="rp-overdue">'+L('Overdue days freeze when the repayment transaction is sent.','还款交易发出即冻结逾期天数。')+'</p>':'');
    return '<section class="rp-summary" aria-label="'+L('Current instalment','本期应还')+'"><div class="rp-summary-head"><div><span class="hint">'+(p.state==='pending'?L('Pending on-chain · instalment ','上链确认中 · 第 '):L('Current instalment · ','本期应还 · 第 '))+p.seq+' / '+n+L('',' 期')+'</span><div class="rp-summary-amount mono">'+amount(p.settlement,x.ccy)+'</div><p class="hint">'+L('Due (UTC) ','应还日（UTC）')+date(p.due)+' · '+L('Total due ','应还合计 ')+amount(p.total)+' · '+L('Overdue ','逾期 ')+late+L(' days',' 天')+(p.state!=='due'&&late?L(' (frozen)','（已冻结）'):'')+'</p></div>'+badge(p)+'</div>'+note+(p.state==='pending'?chainFacts(p):'')
      +(next?'<p class="rp-summary-next">'+L('Next: instalment ','下一期：第 ')+next.seq+' / '+n+L('',' 期')+' · '+date(next.due)+' · <span class="mono">'+amount(next.settlement,x.ccy)+'</span> · '+status(next)+'</p>':'')+'</section>';}
  function businessFacts(x,p8){return section(L('Business information','业务信息'),'<div class="rp-facts-3">'+dl([[L('Application no.','融资申请编号'),E(x.request)],[L('Business no.','融资业务编号'),E(x.id)],[L('Disbursement no.','放款编号'),E(x.record.id)],[L('Funder','出资机构'),E(funder(x))],[L('Business status','业务状态'),repaymentState(x)+overdueBadge(x)],...(party(x)?[[L('Disbursed at','放款成功时间'),time(x.confirmedAt)],...(p8?[[L('Annual financing rate','年化融资利率'),x.rate+'% · ACT/360'],[L('Interest basis','计息规则'),basis()],[L('Interest starts (UTC)','起息日（UTC）'),date(p8.start)],[L('Finalized at','定稿时间'),time(p8.at)]]:[[L('Financing amount','融资金额'),amount(x.amount)]])]:[])])+'</div>');}
  function detail(){const x=deal(),p8=plan();if(!x)return {title:L('Repayment unavailable','还款业务不可用'),html:CF.empty(L('Business not found','未找到业务'),''),foot:b('back',L('Close','关闭'))};if(!visible(x))return deniedView();
    const foot=b('back',externalReturn?L('Back','返回'):L('Close','关闭')),title=L('Repayment details · ','还款详情 · ')+E(x.request);let body='';
    if(load==='loading')body+='<p role="status">'+L('Loading repayment information…','正在加载还款信息…')+'</p>';else if(load==='error')body+=CF.empty(L('Unable to load repayment information','还款信息加载失败'),'',b('retry',L('Retry','重试')));
    else if(!party(x))body+=businessFacts(x,p8)+performance();
    else if(!p8)body+=CF.note('',L('The disbursement succeeded. The repayment schedule is being generated.','放款已成功，还款计划生成中。'))+businessFacts(x,p8)+payeeSection()+support();
    else body+=approvalNote(activeOf(x))+summary(x,p8)+businessFacts(x,p8)+section(L('Repayment schedule','还款计划'),ledger('detail'))+payeeSection()+section(L('Operation records','操作记录'),'<p class="hint rp-section-lead">'+L('Every approval and repayment transaction sent for this business, newest first.','本笔各期已发出的授权交易与还款交易，按时间倒序。')+'</p>'+operations(x),'rp-operations')+support();
    return {title,html:'<div class="rp-drawer" data-kind="detail">'+body+'</div>',foot};
  }
  function schedule(readOnly=false){const x=deal();if(!visible(x))return deniedView().html;if(!party(x))return performance();return planFacts(true)+ledger(readOnly?'inline':'plan');}
  /* 资金方还款收款地址：只读快照，本模块不另填、不改选。 */
  function payeeBody(){if(!party(deal()))return '';if(accountRead==='loading')return '<p role="status">'+L('Loading repayment address…','正在读取还款收款地址…')+'</p>';if(accountRead==='error')return CF.note('',L('The repayment address cannot be read right now. Retry before repaying.','还款收款地址暂时无法读取，请重试后再还款。'))+b('account-retry',L('Retry','重试'));const a=payee();if(accountRead==='missing'||!a?.address)return CF.note('warn',L('The repayment address for this business is incomplete. Contact platform support before repaying.','本笔还款收款地址资料不完整，请联系平台客服人员后再还款。'));return addrCard(a);}
  const payeeSection=()=>section(L('Funder’s repayment address','资金方还款收款地址'),'<p class="hint rp-section-lead">'+L('Receives repayments for this business.','用于接收本笔还款。')+'</p>'+payeeBody(),'rp-payee');
  /* 出账地址：只能从本企业已登记的 Ethereum 数币账户中选；每期都不预选、不能手输。 */
  const fromAccounts=()=>fromScene==='empty'?[]:(CF.EA?.accounts(deal().owner,'crypto')||[]).filter(a=>a.chain==='ETH');
  const fromPick=()=>fromAccounts().find(a=>a.id===form.from&&!Q.accountMissing(a).length);
  const need=()=>period()?.settlement||0;
  /* 余额为演示值：充足时为所需的 2.4 倍，不足时只够六成。 */
  const balanceOf=()=>balanceScene==='short'?round(need()*0.6):round(need()*2.4);
  function balanceView(){const ccy=deal().ccy;
    if(checking)return '<p class="hint" role="status">'+L('Checking balance…','正在查询余额…')+'</p>';
    if(balanceScene==='error')return '<div class="cq-balance-fail" role="alert"><span>'+L('The balance cannot be checked right now.','暂时无法查询余额。')+'</span>'+b('balance-retry',L('Retry','重新查询'))+'</div>';
    const have=balanceOf(),want=need(),ok=have>=want,money=n=>'<span class="mono">'+amount(n,ccy)+'</span>';
    if(ok)return '<p class="rp-check-ok" role="status">'+L('Balance check passed','余额校验通过')+'</p>';
    return '<dl class="cq-balance" data-state="'+(ok?'ok':'short')+'"><div><dt>'+L('Balance','当前余额')+'</dt><dd>'+money(have)+'</dd></div><div><dt>'+L('Required','所需金额')+'</dt><dd>'+money(want)+'</dd></div><div><dt>'+(ok?L('Check','校验结果'):L('Shortfall','差额'))+'</dt><dd>'+(ok?CF.tag('ok',L('Sufficient','余额充足')):money(round(want-have)))+'</dd></div></dl>'+(ok?'':'<div class="cq-balance-fail"><span>'+L('Top up this address or choose another one, then check again.','请补足该地址余额或更换出账地址后重新查询。')+'</span>'+b('balance-retry',L('Check again','重新查询'))+'</div>');}
  function fromBody(){
    const auth=period()?.approval;
    if(auth)return compactAddress(auth.from);
    if(fromScene==='loading')return '<p role="status">'+L('Loading your company accounts…','正在读取本企业账户…')+'</p>';
    if(fromScene==='error')return CF.note('warn',L('Your company accounts cannot be read right now.','本企业账户暂时无法读取。'))+b('from-retry',L('Retry','重试'));
    const list=fromAccounts();
    if(!list.length)return CF.note('warn',L('Your company has not added an Ethereum crypto account yet. Add one, then come back; this repayment stays as it is.','本企业尚未登记 Ethereum 网络的数币账户。登记后回到本次还款，已选内容保留。'))+b('accounts-module',L('Go to company accounts','前往企业账户'));
    const picked=fromPick(),option=a=>{const miss=Q.accountMissing(a).length;return '<option value="'+E(a.id)+'" data-label="'+E(tail(a))+'" data-detail="Ethereum" data-reason="'+E(miss?L('Missing wallet address','缺少数币地址'):'')+'" data-icons="ETH"'+(picked?.id===a.id?' selected':'')+(miss?' disabled':'')+'>'+E(CF.EA.plainName(a))+' · Ethereum · '+E(a.address||'')+(miss?L(' (missing wallet address)','（缺少数币地址）'):'')+'</option>';};
    return '<div class="field"><label for="rp-from">'+CF.fieldLabel(L('Paying address *','出账地址 *'))+'</label><select id="rp-from" class="inp" aria-required="true" aria-describedby="rp-from-error" data-icon-select'+(errors.from?' aria-invalid="true"':'')+'><option value="">'+L('Choose a paying address','请选择出账地址')+'</option>'+list.map(option).join('')+'</select><span id="rp-from-error" class="err-msg" role="alert">'+E(errors.from||'')+'</span></div>'
      +(list.some(a=>Q.accountMissing(a).length)?'<p class="hint">'+L('Incomplete accounts cannot be chosen; complete them in Company accounts.','信息不完整的账户不能选，请到企业账户补齐。')+'</p>':'')
      +(picked?compactAddress(picked)+'<div id="rp-balance" tabindex="-1">'+balanceView()+'</div>':'');}
  const compactAddress=a=>a?.address?'<span class="rp-address-line"><span class="mono cq-break">'+E(a.address)+'</span>'+CF.copyBtn('rp-copy',a.address,L('Copy address','复制地址'))+'</span>':'—';
  function choosePeriod(){const ps=plan().periods,choices=ps.filter(p=>p.state==='due');/* 只有一期可选时不再重复下拉，期次已在下方摘要写明。 */if(choices.filter(p=>now()>=openAt(p)).length<2&&choices.some(p=>p.seq===seq))return '';return '<div class="field"><label for="rp-period">'+L('Instalment','期次')+'</label><select class="inp" id="rp-period">'+choices.map(p=>'<option value="'+p.seq+'"'+(p.seq===seq?' selected':'')+(now()<openAt(p)?' disabled':'')+'>'+p.seq+' / '+ps.length+' · '+date(p.due)+(now()<openAt(p)?L(' · opens ',' · 开放于 ')+date(p.due):'')+'</option>').join('')+'</select></div>';}
  /* 精简办理面：仅本期、资金方、双方地址、实际授权与最终交易。 */
  function approvalAmount(from){
    if(!from)return need();
    return round(need()+Q.disbursements().filter(confirmed).reduce((sum,x)=>sum+(quote(x.id)?.l8?.periods||[]).reduce((n,p)=>{
      const a=p.state==='pending'?sub(p):p.approval;
      return n+(p!==period()&&a?.from?.address===from.address&&a.ccy===deal().ccy&&a.contract===repaymentContract()?(a.amount||0):0);
    },0),0));
  }
  /* 本次签名用途：一两句说明这次签名做什么，并合入原有后果说明；有并发占用时写实际授权金额与其中本期所需。 */
  function signPurpose(p,allowance){const x=deal(),money=n=>'<b class="mono">'+amount(n,x.ccy)+'</b>';
    if(p.approval?.state==='approved')return L('Sends this instalment’s repayment from the paying address: under this approval, the repayment contract above transfers '+money(p.settlement)+' to the funder’s repayment address. Sending it submits the repayment and freezes overdue days; it cannot be withdrawn. It settles once on chain, with no funder confirmation. This is an on-chain transaction: gas is paid by your company and is not refunded if it fails. It is unrelated to sign-in.','用本次出账地址发送本期还款交易：上述还款合约按本次授权，把 '+money(p.settlement)+' 转入资金方收款地址。交易发出即提交本期还款并冻结逾期天数，不能撤回；上链成功即本期结清，无需资金方确认。这是一笔链上交易，gas 由本企业承担，失败已产生的不退；与登录无关。');
    return L('Allows the repayment contract above to draw '+(allowance>p.settlement?money(allowance)+', including '+money(p.settlement)+' for this instalment,':money(p.settlement)+' for this instalment')+' from the paying address. Approval alone moves no funds and does not submit the repayment; a repayment signature follows once it succeeds. This is an on-chain transaction: gas is paid by your company and is not refunded if it fails. It is unrelated to sign-in.','用本次出账地址授权上述还款合约调取'+(allowance>p.settlement?' '+money(allowance)+'，其中本期所需 '+money(p.settlement):'本期结算金额 '+money(p.settlement))+'。授权本身不转出资金、不提交本期还款，成功后还需交易签名。这是一笔链上交易，gas 由本企业承担，失败已产生的不退；与登录无关。');
  }
  /* 签名前核对放在当前这一步内、紧邻签名主动作：所交互的还款合约 + 本次签名用途。 */
  const signCheck=(p,contract,allowance)=>'<div class="ls-sign-check rp-sign-check">'+contractCheck(contract)+(contractRead==='ready'?'<p class="ls-sign-purpose">'+signPurpose(p,allowance)+'</p>':'')+'</div>';
  function approvalNote(p,inPay=false){const a=p?.approval;if(!a)return '';
    if(S.role==='fund')return CF.note('',a.state==='approved'?L('The asset holder has completed approval and has not yet sent the repayment.','资产方已完成授权，尚未发送还款交易。'):a.state==='unknown'?L('The asset holder’s approval result is being verified; repayment has not been submitted.','资产方授权结果待核实，尚未提交还款。'):L('The asset holder’s approval is pending on-chain; repayment has not been submitted.','资产方授权上链确认中，尚未提交还款。'));
    const text=a.state==='processing'?L('Approval pending on-chain. No repayment has been submitted.','授权上链确认中，尚未提交还款。')
      :a.state==='unknown'?L('Approval result to be verified. Do not retry; contact support. Overdue days continue to accrue.','授权结果待核实，请勿重复发起，请联系客服；逾期照常计算。')
      :L('Approval complete. Sign the repayment to continue; closing will not send it.','授权已完成，请继续交易签名；关闭不会自动还款。');
    return CF.note(a.state==='unknown'?'warn':'',text+(inPay&&a.state==='approved'?'<div class="rp-attempt-actions">'+b('end-attempt',L('End this attempt','结束本次办理'))+'</div>':''));
  }
  /* 两步签名：每步给出本步要签的金额、进度与当次已取得的交易哈希（当次反馈；离开办理后在详情的操作记录查看）。 */
  function paySteps(p,allowance,contract){const x=deal(),check=can()?signCheck(p,contract,allowance):'',a=p.approval,c=sub(p),r=p.record,sent=p.state!=='due';
    const s1=sent||a?.state==='approved'?'done':a?.state||'current',s2=p.state==='settled'?'done':p.state==='pending'?(unknown(p)?'unknown':'processing'):a?.state==='approved'?'current':'next';
    const label={current:L('To sign','待签名'),next:L('After approval','授权完成后进行'),processing:L('Pending on-chain','上链确认中'),unknown:L('To be verified','待核实'),done:L('Done','已完成')};
    const state=s=>s==='done'?CF.tag('ok',label[s]):s==='processing'?CF.tag('accent',label[s]):s==='unknown'?CF.tag('warn',label[s]):'<span class="rp-step-state">'+label[s]+'</span>';
    const tx=(name,h,gas)=>h?'<div class="rp-step-tx"><span class="rp-step-k">'+name+'</span>'+hashChip(h)+'<span class="rp-step-gas">gas '+(gas?'<span class="mono">'+E(gas)+' ETH</span>':L('to be verified','待核实'))+L(' · paid by your company',' · 本企业承担')+'</span></div>':'';
    const step=(n,s,title,body)=>'<li class="rp-step" data-state="'+s+'"'+(['current','processing','unknown'].includes(s)?' aria-current="step"':'')+'><span class="rp-step-n" aria-hidden="true">'+(s==='done'?'✓':n)+'</span><div class="rp-step-b"><div class="rp-step-h"><b>'+title+'</b>'+state(s)+'</div>'+body+'</div></li>';
    return '<ol class="rp-steps" aria-label="'+L('Signing steps','签名步骤')+'" aria-live="polite">'
      +step(1,s1,L('Approval signature','授权签名'),'<p class="rp-step-line">'+L('Approval amount','本次授权金额')+' <b class="mono">'+amount(allowance,x.ccy)+'</b></p>'+(allowance>p.settlement?'<p class="hint">'+L('Includes approvals for other unfinished repayments; this instalment needs ','含其他未完成还款的授权，本期所需 ')+amount(p.settlement,x.ccy)+'</p>':'')+tx(L('Approval tx hash','授权交易哈希'),a?.hash||c?.authHash||r?.authHash,a?.gas||c?.authGas||r?.authGas)+(s1==='current'?check:''))
      +step(2,s2,L('Repayment signature','交易签名'),'<p class="rp-step-line">'+L('Transfer to the funder’s repayment address','向资金方收款地址转出')+' <b class="mono">'+amount(p.settlement,x.ccy)+'</b></p>'+(s2==='next'?'<p class="hint">'+L('Executed by the same repayment contract after approval.','授权成功后，由同一份还款合约执行。')+'</p>':'')+tx(L('Repayment tx hash','还款交易哈希'),c?.hash||r?.hash,r?.repayGas)+(s2==='current'?check:''))
      +'</ol>';
  }
  function payView(){const x=deal(),p=period();if(!visible(x))return deniedView();if(!x||!plan())return {title:L('Repay','立即还款'),html:CF.note('',L('The plan is not available yet.','还款计划暂不可用。')),foot:b('back',L('Close','关闭'))};
    if(!party(x)||S.role!=='asset')return deniedView();
    let body='',foot=b('back',L('Close','关闭'));
    if(load==='loading')body='<div role="status">'+L('Loading repayment information…','正在加载还款信息…')+'</div>';else if(load==='error')body=CF.empty(L('Unable to load repayment information','还款信息加载失败'),'',b('retry',L('Retry','重试')));
    else{const a=p.approval,c=sub(p),sent=p.state!=='due',from=a?.from||c?.from||p.record?.from||fromPick(),to=a?.to||c?.to||p.record?.account||payee(),contract=a?.contract||c?.contract||p.record?.contract||repaymentContract();
      const opened=now()>=openAt(p),late=overdue(p),allowance=a?.allowance||approvalAmount(from);
      body=(p.state==='settled'?CF.note('ok',L('This instalment is settled on-chain.','本期链上还款成功，已结清。')):p.state==='pending'?chainNote(p):approvalNote(p,true)||failNote(p));
      body+=(!a&&!sent?choosePeriod():'')+'<div class="rp-pay-amount"><div class="rp-row"><span>'+L('Current amount due','本期应还')+' · '+L('Instalment ','第 ')+p.seq+' / '+plan().periods.length+L('',' 期')+'</span>'+badge(p)+'</div><div class="rp-amount">'+amount(p.settlement,x.ccy)+'</div><p class="hint">'+L('Due (UTC) ','应还日（UTC） ')+date(p.due)+(x.ccy!=='USDT'?' · '+L('Total due ','应还合计 ')+amount(p.total):'')+(late?' · '+L('Overdue ','逾期 ')+late+L(' days',' 天'):'')+'</p></div>';
      body+='<div class="rp-pay-facts">'+dl([[L('Funder','资金方'),E(funder(x))],[L('Funder’s repayment address','资金方收款地址'),'<div id="rp-payee" tabindex="-1">'+(accountRead==='ready'?compactAddress(to):CF.note('warn',L('Repayment address unavailable. Retry before signing.','暂时无法读取收款地址，请重试后签名。'))+b('account-retry',L('Retry','重试')))+'</div>']])
        +'<section id="rp-from-section" class="rp-pay-from" tabindex="-1">'+(sent?'<span class="rp-field-label">'+L('Paying address','本次出账地址')+'</span>'+compactAddress(from):(a?'<span class="rp-field-label">'+L('Paying address','本次出账地址')+'</span>':'')+fromBody())+'</section>'
        +'</div>'+paySteps(p,allowance,contract);
      if(!opened)body+=CF.note('',L('Repayment opens at ','还款开放于 ')+time(iso(openAt(p))));
      if(errors.submit)body+='<div class="rp-sign-error" id="rp-submit-error" role="alert" tabindex="-1">'+CF.note('warn',E(errors.submit))+'</div>';
      if(a?.state==='unknown'||unknown(p))body+=support();
      if(!busy)foot+=b('inspect',L('View details','查看还款详情'));
      if(can())foot+=b('sign',busy?L('Waiting for wallet signature…','等待钱包签名…'):a?L('Sign repayment','交易签名并还款'):L('Sign approval','授权签名'),'',true,busy||checking||contractRead!=='ready');
    }
    return {title:L('Approve & repay','授权并还款'),html:'<div class="rp-drawer rp-pay" data-kind="pay">'+body+'</div>',foot};
  }
  function drawer(kind){if(kind==='detail')return detail();if(kind==='pay')return payView();const x=deal();if(!visible(x))return deniedView();if(!x||!plan())return {title:L('Repayment schedule','还款计划'),html:CF.note('',L('The plan is not available yet.','还款计划暂不可用。')),foot:b('back',L('Close','关闭'))};
    const body=load==='loading'?'<div role="status">'+L('Loading repayment information…','正在加载还款信息…')+'</div>':load==='error'?CF.empty(L('Unable to load repayment information','还款信息加载失败'),'',b('retry',L('Retry','重试'))):schedule();
    return {title:L('Repayment schedule','还款计划'),html:'<div class="rp-drawer" data-kind="plan">'+body+'</div>',foot:b('back',back?L('Back','返回'):L('Close','关闭'))};}
  function remember(){const a=document.activeElement;return {back,seq,selected,pageTop:window.scrollY,layer:S.layer?{...S.layer}:null,top:document.querySelector('#layers [role=dialog]:not([inert]) .drawer-b')?.scrollTop||document.querySelector('#layers .modal-b')?.scrollTop||0,focus:{id:a?.id,act:a?.dataset.act,v:a?.dataset.v}};}
  function restore(ctx){if(ctx?.selected)selected=ctx.selected;if(ctx?.seq)seq=ctx.seq;returnUI=ctx;S.layer=ctx?.layer||null;CF.render();if(!ctx?.layer){setTimeout(()=>{window.scrollTo(0,ctx?.pageTop||0);const f=ctx?.focus;const el=f?.id?document.getElementById(f.id):[...document.querySelectorAll('[data-act]')].find(e=>e.dataset.act===f?.act&&e.dataset.v===f?.v);el?.focus({preventScroll:true});returnUI=null;},0);}}
  function freshForm(){form={from:period()?.approval?.from?.id||period()?.draftFrom||''};errors={};checking=false;}
  function openDetail(id,options={}){ensure();const target=options.period&&quote(id)?.l8?.periods.find(p=>p.id===options.period);if(options.period&&!target||!choose(id,target?.seq||(selected===id?seq:undefined))||!visible(deal())){CF.toast(L('This repayment business is unavailable.','本笔还款业务不可用。'));return;}openRows.clear();origin=remember();origin.layer=null;externalReturn=typeof options==='function'?options:options.onReturn||null;back=null;freshForm();CF.openLayer('drawer','rp-detail');}
  function open(kind,id,n){ensure();if(id&&!choose(id,n))return;const x=deal();if(!visible(x)){denied();return;}if(kind==='pay'&&(!party(x)||S.role!=='asset'))kind='detail';if(!S.layer?.key.startsWith('rp-')){openRows.clear();origin=remember();origin.layer=null;externalReturn=null;back=null;}else back=remember();if(n)seq=n;else if(plan())seq=(activeOf(x)||plan().periods.find(p=>p.seq===seq&&p.draftFrom&&p.state==='due')||plan().periods.filter(p=>p.state==='due'&&now()>=openAt(p)).sort((a,b)=>a.due.localeCompare(b.due)||a.seq-b.seq)[0]||nearest(x))?.seq||1;freshForm();if(!plan())kind='detail';CF.openLayer(kind==='pay'?'modal':'drawer','rp-'+kind);}
  function exitDetail(){epoch++;busy=false;back=null;const prev=origin;origin=null;const callback=externalReturn;externalReturn=null;freshForm();if(callback)callback();else restore(prev);}
  /* 签名前关闭直接结束本次办理，不产生任何记录；钱包签名中不可关闭。 */
  function close(all=false){if(busy)return;if(all){exitDetail();return;}epoch++;if(back){const prev=back;back=prev.back;seq=prev.seq;errors={};restore(prev);}else exitDetail();}
  const fail=(msg,focus)=>{errors.submit=L(...msg);errorFocus=focus||'submit';CF.render();return false;};
  /* 两次签名前分别校验；授权快照不随账户编辑或页面重开改变。 */
  function precheck(){errors={};const x=deal(),p=period(),a=p?.approval;
    if(!can())return fail(['This instalment or your permissions have changed. Review the current details.','期次状态或权限已变化，请查看当前详情。']);
    if(signScene==='race'){signScene='success';return fail(['Another session is handling this instalment. Review its current progress before continuing.','该期已由其他会话办理，请先查看当前进度。']);}
    if(!(x.fx?.value>0)||!(p.settlement>0))return fail(['The business terms cannot be checked right now. Retry later.','暂时无法核对本笔条款，请稍后重试。']);
    if(contractRead!=='ready')return fail(['The repayment contract is unavailable. Retry later.','还款合约暂时不可用，请稍后重试。']);
    if(accountRead!=='ready'||!payee()?.address)return fail(['The repayment address is unavailable. Retry first.','还款收款地址暂时无法读取，请先重试。'],'payee');
    if(a&&(a.contract!==repaymentContract()||a.to.address!==payee().address||a.amount!==p.settlement||a.ccy!==x.ccy))return fail(['The transaction details changed after approval. End this attempt, then approve the new details.','授权后交易信息已变化，请结束本次办理，再按新信息重新授权。']);
    const from=a?.from||fromPick();
    if(!from||!a&&(fromScene!=='ready'||!fromPick())){errors.from=L('Choose the paying address.','请选择出账地址。');errorFocus='from';CF.render();return false;}
    if(balanceScene==='error')return fail(['The balance cannot be checked. Retry first.','暂时无法查询余额，请先重试。'],'balance');
    const have=balanceOf(),want=need();if(have<want)return fail(['Insufficient balance: '+amount(have,x.ccy)+' available, '+amount(want,x.ccy)+' required, '+amount(round(want-have),x.ccy)+' short. Top up, then retry.','余额不足：当前 '+amount(have,x.ccy)+'，所需 '+amount(want,x.ccy)+'，差额 '+amount(round(want-have),x.ccy)+'。请补足后重试。'],'balance');
    if(walletScene!=='ready')return fail(({wrongAddress:['Switch your wallet to the paying address above. Your sign-in session stays unchanged.','请在钱包切换到上述出账地址，登录状态不变。'],wrongNetwork:['Switch your wallet network to Ethereum.','请将钱包网络切换到 Ethereum。'],unavailable:['Your wallet is unavailable. Reconnect and retry; no transaction was sent.','钱包暂不可用，请连接后重试；本次未发送交易。'],gas:['Insufficient gas balance at this paying address. Top up ETH and retry.','本次出账地址 gas 余额不足，请补足 ETH 后重试。']})[walletScene]);
    if(a&&(approvalRead!=='ready'||a.allowance<approvalAmount(from)))return fail(['The approval is revoked or insufficient. End this attempt and sign a new approval; the existing approval gas is retained.','授权已撤销或额度不足，请结束本次办理并重新授权；已产生的授权 gas 保留。']);
    return true;
  }
  /* 演示哈希：按种子散列，授权与还款两笔的缩写可区分。 */
  const demoHash=s=>{let h=2166136261>>>0;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return '0x'+Array.from({length:64},()=>(h=Math.imul(h^(h>>>13),1597334677)>>>0,(h>>>28).toString(16))).join('');};
  function stillCurrent(x,p){return quote(x.id)?.l8?.periods.includes(p);}
  function authResult(x,p){const a=p.approval;if(!stillCurrent(x,p)||!a||a.state!=='processing')return;
    if(a.outcome==='authUnknown'){a.state='unknown';Q.save();CF.render();return;}
    a.gas=a.outcome==='authFailed'?'0.000420':'0.000910';
    if(a.outcome==='authFailed'){p.lastFail={at:iso(now()),auth:false,gas:a.gas,authGas:a.gas,reason:['Approval failed on-chain. Repayment was not submitted.','链上授权失败，尚未提交还款。']};archive(p,{...a,state:'failed'});p.approval=null;event('failed',x,p,['asset']);}
    else{a.state='approved';a.confirmedAt=iso(now());}
    Q.save();CF.render();
  }
  function sign(){if(busy||checking||!precheck())return;const x=deal(),p=period(),a=p.approval,stamp=epoch,from=a?.from||Q.accountSnapshot(fromPick()),to=a?.to||{...payee()},outcome=signScene;busy=true;CF.render();
    setTimeout(()=>{busy=false;if(stamp!==epoch||S.layer?.key!=='rp-pay'||deal()!==x||period()!==p||!stillCurrent(x,p)){CF.render();return;}
      if(outcome==='cancelled'||outcome==='authCancelled'&&!a||outcome==='txCancelled'&&a){fail(a?['Repayment signature cancelled. No repayment was submitted or repayment gas incurred. Approval and its gas remain; you can continue this attempt.','已取消交易签名，未提交还款、未产生还款 gas。授权及已产生的授权 gas 保留，可继续本次办理。']:['Approval signature cancelled. Nothing was sent on-chain and no gas was incurred.','已取消授权签名，未发送链上交易、未产生 gas。']);return;}
      // Recheck the target and balance after wallet interaction, before broadcasting.
      if(!precheck())return;
      justSettled=null;const at=iso(now());
      if(!a){p.lastFail=null;p.approval={at,from,to,contract:repaymentContract(),amount:p.settlement,allowance:approvalAmount(from),ccy:x.ccy,hash:demoHash(p.id+at+'a'),state:'processing',gas:null,outcome,readyAt:Date.now()+1200};Q.save();CF.render();setTimeout(()=>authResult(x,p),1200);return;}
      p.state='pending';p.chain={at,authAt:a.at,from,to,contract:a.contract,amount:p.settlement,ccy:x.ccy,authHash:a.hash,authGas:a.gas,hash:demoHash(p.id+at+'r'),overdue:lateNow(p),state:'processing',by:x.owner==='entity-demo-b'?'Demo employee B · Demo Asset Company B':'Demo employee A · Demo Asset Company A',outcome,readyAt:Date.now()+1800};p.approval=null;Q.save();CF.render();setTimeout(()=>settle(x,p,outcome),1800);
    },600);
  }
  /* 两笔已发出的交易分别记录结果与 gas；授权成功不能自动还款。 */
  function settle(x,p,outcome){if(!stillCurrent(x,p)||p.state!=='pending'||!p.chain||p.chain.state!=='processing')return;const mine=S.role==='asset'&&party(x);
    if(outcome==='unknown'){p.chain.state='unknown';Q.save();CF.render();return;}
    if(outcome==='repayFailed'){const c=p.chain;p.lastFail={at:iso(now()),auth:true,gas:'0.000860',authGas:c.authGas,repayGas:'0.000860',reason:['Repayment failed on-chain. The approval remains; restart with a new approval or revoke it in your wallet.','链上还款失败。授权仍保留，可重新授权办理，或在钱包自行撤销。']};archive(p,{...c,state:'failed',repayGas:'0.000860'});p.chain=null;p.state='due';event('failed',x,p,['asset']);sweep();Q.save();CF.render();return;}
    const c=p.chain,at=iso(now());p.record={id:'RM'+day(now()).replaceAll('-','')+String(++serial).padStart(6,'0'),at:c.at,confirmedAt:at,amount:c.amount,ccy:c.ccy,from:c.from,account:c.to,contract:c.contract,hash:c.hash,authHash:c.authHash,authAt:c.authAt,gas:c.authGas,authGas:c.authGas,repayGas:'0.001420',overdue:c.overdue,by:c.by};p.chain=null;p.state='settled';p.draftFrom='';
    const project=D.project(x.project),credit=Q.data().credits.find(r=>r.owner===x.owner&&r.fund===x.fund);project.balance=round(Math.max(0,project.balance-p.principal));if(credit)credit.principal=round(Math.max(0,credit.principal-p.principal));x.principalBalance=round(Math.max(0,(x.principalBalance??x.amount)-p.principal));x.creditUsed=round(Math.max(0,(x.creditUsed??x.amount)-p.principal));
    if(quote(x.id).l8.periods.every(r=>r.state==='settled')){quote(x.id).l8.settledAt=at;x.state='settled';event('settled',x,p,['asset','fund']);}else{event('done',x,p,['asset']);event('arrived',x,p,['fund']);}
    justSettled={deal:x.id,seq:p.seq};
    // L5 owns project terminal decisions. Do not equate zero principal with all instalments settled.
    D.recompute(project);D.autoEnd(project);Q.save();if(mine)CF.toast(L('Repayment completed on chain. Instalment '+p.seq+' is settled.','链上还款成功，第 '+p.seq+' 期已结清。'));CF.render();}
  function sweep(){ensure();Q.disbursements().filter(confirmed).forEach(x=>(quote(x.id).l8?.periods||[]).forEach(p=>{if(p.state!=='due')return;if(overdue(p))event('overdue',x,p,['asset','fund']);else if(now()>=remindAt(p))event('due',x,p,['asset']);}));}
  const names={final:['Repayment schedule finalized','还款计划已定稿'],due:['Repayment due soon','应还临近提醒'],overdue:['Repayment overdue','本期还款逾期'],done:['Instalment repaid','本期还款已完成'],arrived:['Instalment repayment received','本期还款已到账'],failed:['Instalment repayment not completed','本期还款未完成'],settled:['Financing business settled','本笔融资业务已结清']};
  function eventBody(){return events.filter(e=>e.owner===S.role&&names[e.kind]&&party(deal(e.deal))).map(e=>{const x=deal(e.deal),p8=quote(x.id).l8,p=p8?.periods.find(p=>p.seq===e.seq);return section(L(...names[e.kind]),'<p class="mono">'+E(x.request)+' · '+E(x.id)+(p?' · '+E(p.id):'')+'</p><p>'+time(e.at)+'</p>'+(e.kind==='final'&&p8?comparison(x):'')+b('event',L('View business','查看业务'),e.id));}).join('')||CF.empty(L('No notification events','暂无通知事件'),'');}
  function comparison(x){const p8=quote(x.id).l8,initial=build(day(x.at),p8.end,x.amount,x.rate,x.fx.value);return '<p>'+L('Expected / actual interest start: ','预计 / 实际起息日：')+date(day(x.at))+' / '+date(p8.start)+'</p><p>'+L('Expected / final instalments: ','预计 / 定稿期数：')+initial.length+' / '+p8.periods.length+'</p><div class="rp-plan-scroll"><table class="tbl"><thead><tr><th>'+L('Instalment','期次')+'</th><th>'+L('Expected date / USDT','预计日期 / USDT')+'</th><th>'+L('Final date / USDT','定稿日期 / USDT')+'</th></tr></thead><tbody>'+Array.from({length:Math.max(initial.length,p8.periods.length)},(_,i)=>'<tr><td>'+(i+1)+'</td><td>'+(initial[i]?date(initial[i].due)+' / '+CF.fmtAmt(initial[i].total):'—')+'</td><td>'+(p8.periods[i]?date(p8.periods[i].due)+' / '+CF.fmtAmt(p8.periods[i].total):'—')+'</td></tr>').join('')+'</tbody></table></div>';}
  function initial(q){if(!Q.related(q)||!['waiting','funding'].includes(q.state))return '';const ps=build(day(q.at),day(Date.parse(q.repay)),q.amount,q.rate,q.fx.value);return '<details class="ls-history"><summary>'+L('Estimated repayment schedule · not effective','预计还款计划 · 预计·未生效')+'</summary><p class="hint">'+L('Dates will be recalculated from the actual disbursement date once the disbursement succeeds.','放款成功后将按实际放款日重新计算。')+'</p><div class="rp-plan-scroll"><table class="tbl"><thead><tr><th>'+L('Instalment','期次')+'</th><th>'+L('Expected repayment date','预计还款日')+'</th><th>'+L('Total (USDT)','应还合计（USDT）')+'</th></tr></thead><tbody>'+ps.map(p=>'<tr><td>'+p.seq+'</td><td>'+date(p.due)+'</td><td>'+CF.fmtAmt(p.total)+'</td></tr>').join('')+'</tbody></table></div></details>';}
  const sel=(id,label,value,opts)=>'<label for="'+id+'">'+label+'</label><select class="inp" id="'+id+'">'+opts.map(([v,en,zh])=>'<option value="'+v+'"'+(value===v?' selected':'')+'>'+L(en,zh)+'</option>').join('')+'</select>';
  function tools(){return '<div class="rp-demo"><div class="rp-demo-actions"><h4>'+L('Try a repayment','演示还款操作')+'</h4><p class="hint">'+L('Resets the local example, switches to the asset holder and opens an instalment due now. Choose a paying address, sign approval, then sign repayment to see the on-chain result. No real transaction is sent.','重置本地示例，切为资产方，打开已到应还日的期次。选择出账地址，先授权签名、再交易签名，演示上链结果；不发起真实交易。')+'</p>'+b('walkthrough',L('Start repayment demo','开始还款演示'),'USDT|success',true)+'<div class="rp-demo-options">'+[['USDC|success','Repay in USDC','USDC 还款'],['finalLive|success','Repay final principal','末期还本并结清'],['USDT|repayFailed','Simulate repayment failure','模拟链上还款失败'],['failed|success','Retry a failed repayment','失败后重新还款'],['USDT|unknown','Repayment result to be verified','还款结果待核实'],['USDT|txCancelled','Cancel repayment signature','授权后取消交易签名'],['USDT|authUnknown','Approval result to be verified','授权结果待核实']].map(([v,en,zh])=>b('walkthrough',L(en,zh),v)).join('')+'</div></div><h5>'+L('5 · Repayment scenarios','5 · 还款场景')+'</h5><p class="hint">'+L('Scenario buttons reset the local example. Dates use UTC; balances, signatures and chain results are simulated.','场景按钮重置本地示例。日期按 UTC；余额、签名与链上结果均为本地模拟。')+'</p>'+[['notopen','Not yet open','尚未开放'],['USDT','USDT repayment','USDT 还款'],['USDC','USDC repayment','USDC 还款'],['multi','Multiple businesses','多笔业务'],['waiting','Plan generating','计划生成中'],['overdue','Repayment overdue','还款逾期'],['processing','Pending on-chain','还款上链确认中'],['unknown','Result to be verified','链上结果待核实'],['failed','Last repayment failed','上次还款未完成'],['final','Final principal · expired project','末期本金 · 已到期项目'],['finalLive','Final principal · active project','末期本金 · 未到期项目'],['outoforder','Final principal settled first','末期先结清，仍有未还利息']].map(([v,en,zh])=>b('scenario',L(en,zh),v)).join('')+b('ready',L('Complete plan generation','完成计划生成'))+b('advance',L('Advance 30 days','推进 30 天'))
    +sel('rp-sign-scene',L('Approve & repay result','授权并还款结果'),signScene,[['success','On chain','上链成功'],['authFailed','Approval failed','授权失败'],['repayFailed','Repayment failed after approval','授权成功、链上还款失败'],['authCancelled','Approval signature cancelled','取消授权签名'],['txCancelled','Repayment signature cancelled','取消交易签名'],['authUnknown','Approval result unknown','授权结果待核实'],['unknown','Result unknown','结果长期未知'],['race','Already pending (other session)','他处已提交本期']])
    +sel('rp-from-scene',L('Company accounts','本企业账户'),fromScene,[['ready','Ready','正常'],['empty','None registered','未登记'],['loading','Loading','读取中'],['error','Read failed','读取失败']])
    +sel('rp-balance-scene',L('Paying address balance','出账地址余额'),balanceScene,[['enough','Sufficient','充足'],['short','Insufficient','不足'],['error','Query failed','查询失败']])
    +sel('rp-wallet-scene',L('Signing wallet','签名钱包'),walletScene,[['ready','Ready','正常'],['wrongAddress','Wrong address','地址不符'],['wrongNetwork','Wrong network','网络不符'],['unavailable','Unavailable','钱包不可用'],['gas','Insufficient gas','gas 不足']])
    +sel('rp-approval-read',L('Approval recheck','授权复核'),approvalRead,[['ready','Valid','有效'],['revoked','Revoked / insufficient','已撤销 / 不足']])
    +sel('rp-contract-scene',L('Repayment contract','还款合约'),contractRead,[['ready','Available','可用'],['error','Unavailable','不可用']])
    +sel('rp-account-read',L('Repayment address','还款收款地址'),accountRead,[['ready','Ready','正常'],['loading','Loading','读取中'],['error','Read failed','读取失败'],['missing','Incomplete','资料缺失']])
    +sel('rp-load',L('Drawer state','抽屉状态'),load,[['ready','Ready','正常'],['loading','Loading','加载中'],['error','Load failed','加载失败']])
    +'<label><input type="checkbox" id="rp-explorer"'+(!explorerReady?' checked':'')+'> '+L('Explorer unavailable','查验入口不可用')+'</label>'+b('events',L('Notification event preview','通知事件预览'))+b('denied-write',L('Attempt unauthorized action','尝试越权办理'))+'</div>';}
  function demoRecord(p,x,at=now()){const to=payee(x),from=CF.EA?.accounts(x.owner,'crypto').find(a=>a.chain==='ETH'&&!Q.accountMissing(a).length);return {id:'RM-DEMO-'+p.seq,authAt:iso(at-H-20*60000),at:iso(at-H),confirmedAt:iso(at),amount:p.settlement,ccy:x.ccy,from:from?Q.accountSnapshot(from):null,account:to?{...to}:null,hash:demoHash('r'+p.id),authHash:demoHash('a'+p.id),gas:'0.000910',authGas:'0.000910',repayGas:'0.001420',overdue:0,by:'Demo employee A · Demo Asset Company A'};}
  function scenario(kind,{pay=false,result='success'}={}){epoch++;openRows.clear();busy=false;clockOverride=0;load='ready';explorerReady=true;accountRead='ready';fromScene='ready';balanceScene='enough';contractRead='ready';signScene='success';walletScene='ready';approvalRead='ready';form={from:''};events.length=0;justSettled=null;const x=Q.demoDisbursement(),q=quote(x.id);selected=x.id;location.hash='#/project/'+x.project;delete q.l8;events=Q.data().repaymentEvents=[];x.plan=kind==='waiting'?'waiting':'handoff';
    /* 还款收款地址取报价时选定的 Ethereum 地址；结算币种只有 USDT、USDC，汇率快照默认 1。 */
    const ccy=kind==='USDC'?'USDC':'USDT',to=q.repayTo||Q.accounts(x.fund,'crypto').find(a=>a.chain==='ETH'&&!Q.accountMissing(a).length);
    x.ccy=q.ccy=ccy;x.fx=q.fx={...(q.fx||{}),value:1};x.settlement=q.settlement=x.amount;if(to)x.record.account=to.kind?Q.accountSnapshot(to):{...to};
    ensure();const p8=q.l8;if(p8){seq=1;clockOverride=Date.parse(p8.periods[0].due)+(kind==='overdue'?5*DAY:kind==='notopen'?-DAY:kind==='processing'||kind==='unknown'?2*H:0);if(kind==='multi'){const second=JSON.parse(JSON.stringify(q));second.id=q.id+'-B';second.demand=q.demand+'-B';second.fund='fund-b';second.l7.id=second.id;second.l7.fund='fund-b';second.l7.request=second.demand;second.l7.record.id+='B';const b2=Q.accounts('fund-b','crypto').find(a=>a.chain==='ETH');if(b2)second.l7.record.account=Q.accountSnapshot(b2);delete second.l8;Q.data().quotes.push(second);D.project(x.project).demands.push({...D.project(x.project).demands.find(d=>d.id===q.demand),id:second.demand});D.project(x.project).balance+=x.amount;ensure();}
      if(['final','finalLive'].includes(kind)){p8.periods.slice(0,-1).forEach(p=>{p.state='settled';p.record=demoRecord(p,x,Date.parse(p.due)+H);});seq=p8.periods.length;clockOverride=Date.parse(p8.periods.at(-1).due);}
      if(kind==='processing'||kind==='unknown'){const p=p8.periods[0],from=CF.EA?.accounts(x.owner,'crypto').find(a=>a.chain==='ETH');p.state='pending';p.chain={at:iso(clockOverride-(kind==='unknown'?26*H:40*60000)),authAt:iso(clockOverride-(kind==='unknown'?26*H:40*60000)-12*60000),authGas:'0.000910',hash:demoHash('r'+p.id),from:from?Q.accountSnapshot(from):null,to:{...payee(x)},amount:p.settlement,ccy:x.ccy,authHash:demoHash('a'+p.id),overdue:0,state:kind==='unknown'?'unknown':'processing',by:'Demo employee A · Demo Asset Company A'};if(kind==='unknown')clockOverride+=DAY;}
      if(kind==='failed'){const p=p8.periods[0],from=CF.EA?.accounts(x.owner,'crypto').find(a=>a.chain==='ETH');archive(p,{at:iso(clockOverride-H),authAt:iso(clockOverride-H-15*60000),from:from?Q.accountSnapshot(from):null,authHash:demoHash('fa'+p.id),hash:demoHash('fr'+p.id),authGas:'0.000910',repayGas:'0.000860',state:'failed'});p.lastFail={at:iso(clockOverride),auth:true,gas:'0.000860',authGas:'0.000910',repayGas:'0.000860',reason:['The approval is on chain, but the on-chain repayment failed because the paying address balance was no longer sufficient.','授权已上链，但链上还款失败：出账地址余额已不足。']};}
      if(kind==='outoforder'){const last=p8.periods.at(-1);last.state='settled';last.record=demoRecord(last,x,Date.parse(last.due)+H);x.principalBalance=x.creditUsed=0;D.project(x.project).balance=0;const credit=Q.data().credits.find(c=>c.owner===x.owner&&c.fund===x.fund);if(credit)credit.principal=Math.max(0,credit.principal-x.amount);clockOverride=Date.parse(last.due)+DAY;}
      }if(kind==='finalLive'){const project=D.project(x.project);project.expired=false;project.expiry=day(clockOverride+30*DAY);project.expires=iso(clockOverride+31*DAY-1);}if(['final','outoforder'].includes(kind))D.project(x.project).expired=true;S.role='asset';S.party.asset=x.owner;CF.review.prepareIdentity?.('asset');S.st='default';S.layer=null;S.demo=false;origin=back=returnUI=savedUI=null;listViews.clear();signScene=result;Q.data().repaymentClock=clockOverride;Q.save();
    setTimeout(()=>{if(document.getElementById('ls-tab-repay')?.getAttribute('aria-expanded')!=='true')V.onAct('ls-tab','repay');CF.render();if(pay)open('pay',x.id,seq);},60);}
  function resetContext(){epoch++;busy=false;freshForm();origin=back=null;lastRole=S.role;lastHash=location.hash;}
  function deepLink(){if(!location.hash.startsWith('#/project/'))return;const u=new URLSearchParams(location.hash.split('?')[1]||''),id=u.get('business'),n=u.get('instalment'),action=u.get('repayment')||(n?'detail':null);if(!action)return;ensure();const x=deal(id),project=location.hash.split('?')[0].split('/')[2];if(!x||!visible(x)||x.project!==project||!confirmed(x)||(n&&!quote(x.id).l8?.periods.some(p=>p.seq===+n||p.id===n))){CF.toast(L('The repayment target is unavailable.','指定还款业务或期次不可用。'));return;}choose(id,n?quote(id).l8.periods.find(p=>p.seq===+n||p.id===n).seq:undefined);V.onAct('ls-tab','repay');CF.render();const target=period();
    /* 办理目标已变化时落到只读详情并说明当前结果，不静默改办另一期。 */
    if(action==='pay'&&(target?.state!=='due'||processingOf(x))){CF.toast(target?.state==='settled'?L('This instalment is already settled.','本期已结清。'):L('This instalment cannot be repaid now. Showing its current result.','本期当前不能还款，已为你打开当前结果。'));open('detail',id,seq);return;}
    open(['detail','plan','pay'].includes(action)?action:'detail',id,seq);}
  /* 从企业账户登记完出账地址后回到本次还款：业务与期次保留，出账地址仍须显式选定。 */
  function resumeAccounts(){const trip=accountsTrip;accountsTrip=null;if(!trip)return;ensure();if(!choose(trip.deal,trip.seq)){CF.toast(L('That repayment is no longer available.','原还款已不可用。'));return;}V.onAct('ls-tab','repay');open('pay',trip.deal,trip.seq);CF.render();}
  function act(a,v){if(!a.startsWith('rp-'))return false;if(busy&&a!=='rp-copy')return true;const k=a.slice(3);
    if(k==='detail')openDetail(v);
    else if(k==='table-page'){const [id,n]=v.split('|');const f=listViews.get(id);if(f)f.page=+n;}
    else if(k==='table-reset')listViews.set(v,{query:'',state:'',overdue:'',page:1});
    else if(k==='open')open(v);
    else if(k==='back')close();
    else if(k==='sign'){sign();return true;}
    else if(k==='inspect'){const id=selected,n=seq;S.layer=null;openDetail(id,{period:plan()?.periods.find(p=>p.seq===n)?.id});}
    else if(k==='end-attempt'){const p=period();if(S.role==='asset'&&party(deal())&&p?.state==='due'&&p.approval?.state==='approved'){archive(p,{...p.approval,state:'ended'});p.approval=null;freshForm();Q.save();CF.toast(L('Attempt ended. The on-chain approval and its gas remain; a new attempt requires a new approval.','本次办理已结束，链上授权及已产生的 gas 保留；重新办理需再次授权。'));}}
    else if(k==='retry')load='ready';
    else if(k==='account-retry')accountRead='ready';
    else if(k==='contract-retry'){contractRead='ready';errors={};}
    else if(k==='from-retry')fromScene='ready';
    else if(k==='balance-retry'){if(balanceScene==='error')balanceScene='enough';errors={};checking=true;const stamp=epoch;setTimeout(()=>{if(stamp!==epoch)return;checking=false;CF.render();document.getElementById('rp-balance')?.focus({preventScroll:true});},400);}
    else if(k==='accounts-module'){const backTo=location.hash.replace(/^#/,'')||'/marketplace';accountsTrip={deal:selected,seq};S.layer=null;origin=back=null;location.hash='#'+CF.ENTRY['P-F-EA-01']+'?'+new URLSearchParams({return:backTo,from:'repay',business:selected});return true;}
    else if(k==='denied-write')denied();
    else if(k==='scenario'){scenario(v);return true;}
    else if(k==='walkthrough'){const [kind,result]=v.split('|');scenario(kind,{pay:true,result});return true;}
    else if(k==='ready'){if(deal()){deal().plan='handoff';ensure();Q.save();}}
    else if(k==='advance'){clockOverride=now()+30*DAY;Q.data().repaymentClock=clockOverride;sweep();Q.save();}
    else if(k==='events')CF.openLayer('modal','rp-events');
    else if(k==='copy'){const fallback=()=>{const text=document.createElement('textarea');text.value=v;text.setAttribute('aria-label',L('Copy value','复制内容'));document.body.append(text);text.select();const copied=document.execCommand('copy');text.remove();CF.toast(copied?L('Copied','已复制'):L('Copy failed. Copy it manually: ','复制失败，请手动复制：')+v);};if(navigator.clipboard?.writeText)navigator.clipboard.writeText(v).then(()=>CF.toast(L('Copied','已复制')),fallback);else fallback();return true;}
    else if(k==='event'){const e=events.find(e=>e.id===v&&e.owner===S.role&&party(deal(e.deal)));if(e){S.layer=null;choose(e.deal,e.seq);V.onAct('ls-tab','repay');const p=period();open(['due','overdue','failed'].includes(e.kind)&&S.role==='asset'&&p?.state==='due'&&!processingOf(deal())?'pay':'detail',e.deal,e.seq);}}
    CF.render();return true;
  }
  const oldAct=V.onAct,oldBefore=V.beforeRender,oldGuard=V.onBeforeAct,oldDemo=V.demo,organize=Q.organizeTools;
  V.onAct=(a,v,e)=>act(a,v)||oldAct(a,v,e);
  V.beforeRender=()=>{if(S.layer?.key.startsWith('rp-'))savedUI=remember();oldBefore?.();if(S.role!==lastRole||location.hash!==lastHash){if(S.layer?.key.startsWith('rp-'))S.layer=null;resetContext();}sweep();};
  V.demo=()=>oldDemo()+tools();Q.organizeTools=()=>{const node=document.querySelector('#demoPanel .rp-demo');if(document.querySelector('#demoPanel .cq-guide'))return;organize();if(node){const root=document.querySelector('#demoPanel .cq-guide');if(root){const group=document.createElement('details');group.className='cq-demo-group';group.innerHTML='<summary>'+L('5 · On-chain repayment states and errors','5 · 链上还款状态与异常')+'</summary>';const entry=node.querySelector('.rp-demo-actions');if(entry)root.querySelector('.cq-demo-current')?.after(entry);group.append(node);root.append(group);}}};
  V.onBeforeAct=(a,v,e)=>{if(S.layer?.key.startsWith('rp-')&&a==='closelayer'){if(e.type==='click'&&e.target.closest('[data-stop]')&&e.target.closest('[data-act]')?.classList.contains('modal-mask'))return false;if(busy)return true;close(true);return true;}if(busy&&['role','signout'].includes(a))return true;return oldGuard?.(a,v,e)||false;};
  Object.assign(V.layers,{'rp-detail':()=>drawer('detail'),'rp-plan':()=>drawer('plan'),'rp-pay':()=>drawer('pay'),'rp-events':()=>({title:L('Notification event preview','通知事件预览'),html:eventBody(),foot:b('back',L('Close','关闭'))})});
  /* 只记用户展开 / 收起的行；默认展开随状态计算，重绘与新开详情不沿用旧场景。 */
  document.addEventListener('click',e=>{const row=e.target.closest?.('.rp-inst>summary')?.parentElement;if(row)openRows.set(row.dataset.key,!row.open);});
  document.addEventListener('change',e=>{const el=e.target;if(['rp-tf-state','rp-tf-overdue','rp-tf-keyword'].includes(el.id)){const view=listViews.get(el.closest('[data-rp-project]')?.dataset.rpProject);if(view){view[{'rp-tf-state':'state','rp-tf-overdue':'overdue','rp-tf-keyword':'query'}[el.id]]=el.value.trim();view.page=1;const id=el.id;CF.render();document.getElementById(id)?.focus({preventScroll:true});}return;}
    if(el.id==='rp-business'){justSettled=null;choose(el.value);freshForm();CF.render();document.getElementById('rp-business')?.focus({preventScroll:true});return;}
    if(el.id==='rp-period'){if(activeOf(deal())){CF.render();return;}seq=+el.value;freshForm();CF.render();document.getElementById('rp-period')?.focus({preventScroll:true});return;}
    /* 选定或更换出账地址即重新查询余额。 */
    if(el.id==='rp-from'){if(period()?.approval){CF.render();return;}form.from=el.value;if(period())period().draftFrom=el.value;Q.save();errors={};checking=!!el.value;const stamp=epoch;CF.render();(document.getElementById('rp-from-btn')||document.getElementById('rp-from'))?.focus({preventScroll:true});if(el.value)setTimeout(()=>{if(stamp!==epoch)return;checking=false;CF.render();},400);return;}
    const scenes={'rp-sign-scene':v=>signScene=v,'rp-from-scene':v=>fromScene=v,'rp-balance-scene':v=>balanceScene=v,'rp-contract-scene':v=>contractRead=v,'rp-wallet-scene':v=>walletScene=v,'rp-approval-read':v=>approvalRead=v,'rp-account-read':v=>accountRead=v,'rp-load':v=>load=v};
    if(scenes[el.id])scenes[el.id](el.value);if(el.id==='rp-explorer')explorerReady=!el.checked;if(scenes[el.id]||el.id==='rp-explorer'){if(el.id==='rp-from-scene'&&!fromPick())form.from='';CF.render();}
  });
  let previousLayer='';new MutationObserver(()=>{if(!S.layer?.key.startsWith('rp-')){previousLayer='';return;}const dialogs=[...document.querySelectorAll('#layers [role=dialog]')],dialog=dialogs.find(d=>!d.closest('[inert]'));if(!dialog)return;dialog.classList.add('wide');const body=dialog.querySelector('.drawer-b,.modal-b');if(previousLayer!==S.layer.key){const heading=dialog.querySelector('.drawer-h b,.modal-h');heading.tabIndex=-1;heading.focus({preventScroll:true});if(S.layer.key==='rp-plan')dialog.querySelector('.rp-inst[aria-current]')?.scrollIntoView({block:'nearest'});if(S.layer.key==='rp-detail')dialog.querySelector('#rp-original')?.scrollIntoView({block:'nearest'});}previousLayer=S.layer.key;const context=returnUI?.layer?.key===S.layer.key?returnUI:savedUI?.layer?.key===S.layer.key?savedUI:null;if(context){const c=context;if(c===returnUI)returnUI=null;body.scrollTop=c.top;/* 图标下拉在共享增强器的下一帧才生成，余额回写重绘后也须恢复可见控件。 */if(!errorFocus){const stamp=epoch;requestAnimationFrame(()=>{if(stamp!==epoch||S.layer?.key!==c.layer?.key)return;const el=c.focus.id?document.getElementById(c.focus.id):[...document.querySelectorAll('#layers [data-act]')].find(e=>e.dataset.act===c.focus.act&&e.dataset.v===c.focus.v);el?.focus({preventScroll:true});});}}
    if(errorFocus){const target={from:'rp-from-btn',payee:'rp-payee',balance:'rp-balance',submit:'rp-submit-error'}[errorFocus];errorFocus='';/* 图标下拉在本轮渲染后才生成可见按钮，延后一拍再聚焦。 */setTimeout(()=>{const el=document.getElementById(target)||document.getElementById('rp-submit-error');el?.focus();el?.scrollIntoView({block:'nearest'});},0);}if(busy)dialog.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=true);}).observe(document.getElementById('layers'),{childList:true});
  document.addEventListener('keydown',e=>{const row=e.target.closest?.('.rp-record-table tr[data-act]');if(row&&['Enter',' '].includes(e.key)){e.preventDefault();row.click();}});
  document.addEventListener('keydown',e=>{if(e.key!=='Tab'||!S.layer?.key.startsWith('rp-'))return;const nodes=[...document.querySelectorAll('#layers button:not(:disabled),#layers a[href],#layers input:not(:disabled),#layers select,#layers textarea,#layers [tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.closest('[inert]'));if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();e.stopImmediatePropagation();nodes.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();e.stopImmediatePropagation();nodes[0]?.focus();}},true);
  const actions=D.actions;D.actions=p=>{const a=actions(p);if(available(p).some(x=>!quote(x.id).l8?.settledAt))a.canClose=false;return a;};
  Q.data().quotes.forEach(q=>q.l8?.periods.forEach(p=>{serial=Math.max(serial,Number(p.id?.slice(-6))||0,Number(p.record?.id?.slice(-6))||0);}));
  CF.L8={build,initial,panel,available,recordTable,openDetail,resumeAccounts,hasUnsettled:p=>available(p).some(x=>!quote(x.id).l8?.settledAt),ensure,scenario,startDemo:(kind='USDT',result='success')=>scenario(kind,{pay:true,result}),get selected(){return selected;},get seq(){return seq;},get now(){return now();},get events(){return events;},open};
  Q.disbursements().filter(confirmed).forEach(x=>(quote(x.id)?.l8?.periods||[]).forEach(p=>{const a=p.approval,c=p.chain;if(a?.state==='processing'&&a.readyAt)setTimeout(()=>authResult(x,p),Math.max(0,a.readyAt-Date.now()));if(c?.state==='processing'&&c.readyAt)setTimeout(()=>settle(x,p,c.outcome),Math.max(0,c.readyAt-Date.now()));}));
  window.addEventListener('hashchange',()=>setTimeout(deepLink,30));ensure();if(!CF.portalConnected)CF.render();setTimeout(deepLink,40);
})(window.CF);
