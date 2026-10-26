/* WS-450: additive local fixtures for My console on the current on-chain flow — offer pending on-chain,
 * accept = on-chain disbursement, on-chain repayment, funding and pledge approvals.
 * Demonstration data only: no API, wallet, chain, permission or live exchange-rate assertion. */
(function(CF){
  'use strict';
  const D=CF.LS,Q=CF.CQ,DAY=86400000,H=3600000,iso=n=>new Date(n).toISOString(),VERSION=17;
  let db=Q.data(),now=D.now();
  const POOL=D.COMBOS[0].pledge,HOLDER=D.HOLDERS['entity-demo-a'];
  /* 放款地址、还款收款地址与融资收款地址都取企业账户目录里的 Ethereum 演示账户快照，本文件不另建账户字段。 */
  const wallet=(owner,n=0)=>{const list=Q.accounts(owner,'crypto').filter(a=>a.chain==='ETH'&&!Q.accountMissing(a).length);const a=list[n]||list[0];return a?Q.accountSnapshot(a):null;};
  const hash=seed=>{let h=2166136261;for(const c of String(seed))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return '0x'+Array.from({length:64},()=>(h=Math.imul(h^(h>>>13),1597334677)>>>0,(h>>>28).toString(16))).join('');};
  const FXSRC=['Operations · Exchange rate management','运营端汇率管理'];
  const today=()=>iso(D.now()).slice(0,10);
  /* 期次由还款模块按放款成功日按季生成。按“第 N 期应还日距今天数”倒推放款成功时间。 */
  const disbursedFor=(dueOffset,period=1)=>Date.parse(D.addMonths(D.addDays(today(),dueOffset),-3*period)+'T08:00:00.000Z');
  /* 样例：键为结局，start 为报价时间（成交样例即放款成功时间），fx 为 USDC 快照。 */
  const samples=[
    {key:'waiting',name:['Trade receivables','贸易应收账款'],start:()=>now-2*DAY},
    {key:'disbursing',name:['Export settlement','出口结算融资'],start:()=>now-3*DAY},
    {key:'repayPending',name:['Quarterly working capital','季度营运资金'],start:()=>disbursedFor(-2,2)},
    {key:'repayDue',name:['Cross-border inventory','跨境备货融资'],ccy:'USDC',fx:0.9998,start:()=>disbursedFor(0)},
    {key:'rejected',name:['Completed negotiation','历史协商项目'],start:()=>now-12*DAY},
    {key:'generating',name:['Plan in preparation','计划生成中项目'],start:()=>now-2*H},
    {key:'settled',name:['Completed financing','历史结清融资'],start:()=>now-500*DAY},
    {key:'repayUnknown',name:['Digital settlement financing','数币结算融资'],ccy:'USDC',fx:1.0002,start:()=>disbursedFor(-3)},
    {key:'expiredRevoking',name:['Stablecoin supplier payments','稳定币供应商付款'],start:()=>now-20*DAY},
    {key:'offerPending',name:['Stablecoin export financing','稳定币出口融资'],start:()=>now-35*60000},
    {key:'rejectedRevoked',name:['Coastal freight receivables','沿海运费应收'],start:()=>now-30*DAY},
    {key:'retry',name:['Inventory financing','备货融资'],start:()=>now-4*DAY},
    {key:'repayOverdue',name:['Seasonal purchase financing','季节采购融资'],start:()=>disbursedFor(-5)}
  ];
  /* 授信占用额与逐笔未偿本金同源：演示授信的占用额取本授信下已放款、未结清业务的未偿本金合计，使用记录与汇总一致。 */
  function reconcile(){
    const own=Q.data().credits.find(c=>c.owner==='entity-demo-a'&&c.fund==='fund-a');if(!own)return false;
    const v=Math.round(Q.data().quotes.filter(q=>q.owner===own.owner&&q.fund===own.fund&&q.l7?.state==='confirmed').reduce((n,q)=>n+(+q.l7.principalBalance||0),0)*100)/100;
    if(own.principal===v)return false;own.principal=v;return true;
  }
  /* 旧版样例（待放款、待放款确认、USD / TRON 结算）整体移除后按当前流程重建。 */
  function purge(){
    D.projects.splice(0,D.projects.length,...D.projects.filter(p=>!/^FP-MC-/.test(p.id)));
    D.tokens.splice(0,D.tokens.length,...D.tokens.filter(t=>!/^TK-MC-\d/.test(t.id)));
    D.approvals.splice(0,D.approvals.length,...D.approvals.filter(a=>!/^AP-MC-/.test(a.id)));
    db.quotes=db.quotes.filter(q=>!/^FB-MC-/.test(q.id));db.pending=(db.pending||[]).filter(x=>!/^PO-MC-/.test(x.id));
  }
  function build(s,i){
    const n=i+1,id='FP-MC-'+String(n).padStart(3,'0'),business='FB-MC-'+String(n).padStart(4,'0'),request=id+'-01',start=s.start(),amount=240000,ccy=s.ccy||'USDT',fx=s.fx||1;
    const funded=['repayPending','repayDue','generating','settled','repayUnknown','repayOverdue'].includes(s.key);
    /* 项目期限取创建日 + 12 个月（上限，含端点）；到期即最终还款日。项目质押率由资产方创建时自填，演示数据刻意不统一。 */
    const created=start-DAY,end=Date.parse(D.addMonths(iso(created).slice(0,10),12)+'T12:00:00.000Z');
    const rate=[0.8,0.75,0.8,0.7,0.8,0.8,0.8,0.8,0.8,0.75,0.8,0.7,0.8][i];
    const payee=wallet('entity-demo-a'),lender=wallet('fund-a',i%2),settlement=Math.round(amount*fx*100)/100;
    const demand={id:request,amount,state:'open',at:iso(start-2*H),tenorDays:370,payee};
    const p={id,name:s.name,owner:'entity-demo-a',kind:'erc20-ar',network:'ETH',rate,termCap:12,term:12,settle:['USDT','USDC'],repay:D.REPAY,contract:POOL,deployedAt:iso(created+3*H),attempts:[],state:'raising',balance:0,published:demand.at,created:iso(created),expires:iso(end),demands:[demand]};
    const quoted=()=>{demand.state='quoted';demand.rate='6.40';demand.currency=ccy;demand.institution=['Demo Capital A','演示资金机构 A'];demand.quoteAt=iso(start);p.state='locked';};
    D.projects.push(p);
    /* 每个项目三份已质押代币，持有地址与发行合约用于归集质押授权；第 4 号另有一份正在质押上链，该地址在该发行合约下的质押授权暂不能撤销。 */
    if(n===4)D.tokens.push({id:'TK-MC-4-4',owner:p.owner,holder:HOLDER[0],kind:'erc20-ar',issuer:D.ISSUERS[1],units:1,symbol:'AR-DEMO',value:120000,valid:true,pool:id,pledge:'free',pending:true,buyer:['Demo Buyer 4','演示买方 4'],due:iso(end+30*DAY).slice(0,10),from:iso(created).slice(0,10),issued:iso(created)});
    for(let j=1;j<=3;j++)D.tokens.push({id:'TK-MC-'+n+'-'+j,owner:p.owner,holder:HOLDER[j===3&&n%2?1:0],kind:'erc20-ar',issuer:D.ISSUERS[n===4&&j===3?1:0],units:1,symbol:'AR-DEMO',value:150000,valid:true,pool:id,pledge:'pledged',buyer:['Demo Buyer '+j,'演示买方 '+j],due:iso(end+30*DAY).slice(0,10),from:iso(created).slice(0,10),issued:iso(created)});
    const fxSnap={value:fx,version:'FX-MC-001',at:start-3*DAY,source:FXSRC};
    if(s.key==='offerPending'){
      /* 报价上链确认中：只有融资申请编号与签名发出时间，没有融资业务编号；本轮需求与在途报价金额已预占。 */
      db.pending.push({id:'PO-MC-'+String(n).padStart(3,'0'),project:id,owner:p.owner,demand:request,amount,ccy,settlement,fx:fxSnap,fund:'fund-a',lender,repayTo:lender,rate:'6.80',repay:iso(end),at:start,state:'processing'});
      return;
    }
    const q={id:business,project:id,owner:p.owner,demand:request,amount,ccy,rate:'6.40',settlement,fx:fxSnap,at:start,state:'waiting',fund:'fund-a',repay:iso(end),lender,repayTo:lender,auth:{at:start,tx:hash(business+'-auth'),gas:'0.002100'},chain:null,progress:{}};
    db.quotes.push(q);
    if(['waiting','disbursing','retry'].includes(s.key)){
      quoted();
      if(s.key==='disbursing'){q.chain={state:'processing',at:now-40*60000};demand.state='funding';}
      if(s.key==='retry')q.chain={state:'failed',at:now-5*H,reason:['The funder\'s authorization or balance no longer covers this settlement amount.','资金方放款地址的授权或余额已不足以支付本笔结算金额。']};
    }
    if(s.key==='rejected'||s.key==='rejectedRevoked'){q.state='rejected';q.done=start+6*H;q.reason='融资条款不符合当前需求 / Terms do not match current needs';}
    if(s.key==='rejectedRevoked')q.auth={...q.auth,revoked:true,revoke:{state:'success',at:iso(start+2*DAY),done:iso(start+2*DAY+4*60000),tx:hash(business+'-revoke'),gas:'0.000046'}};
    if(s.key==='expiredRevoking'){
      q.state='expired';q.reason='coverage';q.done=start+5*DAY;demand.state='ended';demand.reason='coverage';demand.endedAt=iso(q.done);p.state='available';
      q.auth={...q.auth,revoke:{state:'processing',at:iso(now-25*60000),gas:null}};
    }
    if(funded){
      /* 链上放款成功：接受成功、放款完成，生成放款记录并交还款，同一时刻完成。 */
      const at=iso(start);q.state='funded';q.done=start;q.auth={...q.auth,used:true};demand.state='funded';demand.rate='6.40';demand.currency=ccy;demand.institution=['Demo Capital A','演示资金机构 A'];demand.quoteAt=iso(start-DAY);p.state='financing';p.balance=amount;
      q.at=start-DAY;q.auth.at=q.at;q.progress={account:payee?{kind:'crypto',chain:'ETH',...payee}:null};
      q.l7={id:business,project:id,owner:p.owner,fund:'fund-a',request,ccy,amount,settlement,rate:q.rate,fx:fxSnap,at:q.at,acceptedAt:start,account:payee?{kind:'crypto',chain:'ETH',...payee}:{},state:'confirmed',confirmedAt:at,short:false,gap:0,expired:false,history:[],plan:s.key==='generating'?'waiting':'handoff',principalBalance:amount,
        record:{id:'LN'+at.slice(0,10).replaceAll('-','')+String(500+n).padStart(6,'0'),at,account:lender?{...lender}:null,form:{hash:hash(business+'-loan'),paidAt:at,files:[]}}};
    }
    if(n===1&&!db.quotes.some(x=>x.id==='FB-MC-HISTORY-01')){
      /* 同一申请此前一笔已拒绝的报价，其放款授权已在平台外撤销，按链上事实显示。 */
      const past=structuredClone(q);past.id='FB-MC-HISTORY-01';past.state='rejected';past.reason='双方未达成条款一致 / Terms not agreed';past.at=start-DAY;past.done=start-DAY/2;past.chain=null;
      past.auth={at:past.at,tx:hash('FB-MC-HISTORY-01-auth'),gas:'0.002100',revoked:true,revoke:{state:'success',external:true,done:iso(start-DAY/4)}};db.quotes.push(past);
    }
  }
  function restore(){
    db=Q.data();now=D.now();
    if(db.consoleExamples===VERSION&&D.project('FP-MC-001')){if(reconcile())Q.save();return;}
    purge();samples.forEach(build);
    /* 质押授权每笔带明确数量；另有一条授权处理中、一条已撤销的历史记录。 */
    const at=iso(now-40*DAY);
    if(!D.approvalOf(HOLDER[0],POOL,D.ISSUERS[1]))D.approvals.push({id:'AP-MC-ISSUER2',holder:HOLDER[0],contract:POOL,issuer:D.ISSUERS[1],quantity:'1',symbol:'AR-DEMO',usedQuantity:'0',state:'success',at,done:iso(now-40*DAY+6*60000),fee:D.APPROVE_FEE,feeCurrency:'ETH',tx:hash('AP-MC-ISSUER2')});
    D.approvals.push({id:'AP-MC-PENDING',holder:HOLDER[1],contract:POOL,issuer:D.ISSUERS[2],quantity:'100',symbol:'AR-DEMO',usedQuantity:'0',state:'processing',at:iso(now-20*60000),fee:null,feeCurrency:'ETH'});
    D.approvals.push({id:'AP-MC-REVOKED',holder:HOLDER[1],contract:POOL,issuer:D.ISSUERS[1],quantity:'50',symbol:'AR-DEMO',usedQuantity:'0',state:'success',at:iso(now-90*DAY),done:iso(now-90*DAY+5*60000),fee:D.APPROVE_FEE,feeCurrency:'ETH',tx:hash('AP-MC-REVOKED'),revoke:{state:'success',at:iso(now-60*DAY),done:iso(now-60*DAY+3*60000),tx:hash('AP-MC-REVOKED-r'),gas:'0.000044'}});
    const own=db.credits.find(c=>c.owner==='entity-demo-a'&&c.fund==='fund-a');
    reconcile();
    /* 在途报价金额含报价上链确认中的预占；总额始终留出余量，不出现可用授信为负的假数据。 */
    if(own){const fly=db.quotes.filter(q=>q.owner===own.owner&&q.fund===own.fund&&q.state==='waiting').reduce((n,q)=>n+q.amount,0)+db.pending.filter(x=>x.owner===own.owner&&x.fund===own.fund&&['processing','unknown'].includes(x.state)).reduce((n,x)=>n+x.amount,0);own.total=Math.max(own.total,own.principal+fly+1000000);}
    D.normalize();D.save();
    db.consoleExamples=VERSION;delete db.consolePeriods;Q.save();
  }
  restore();
  /* 演示条与流程演示会整体重新播种借贷数据；播种后立即补回这些样例，不必刷新页面。 */
  const seed=D.seed;D.seed=()=>{seed();Q.data().consoleExamples=0;restore();CF.MCSeedPeriods?.();};
  CF.MCRestore=restore;
  CF.MCSeedPeriods=function(){
    db=Q.data();now=D.now();if(db.consolePeriods===VERSION){if(reconcile())Q.save();return;}
    CF.L8.ensure();
    const quote=id=>db.quotes.find(q=>q.id===id),from=wallet('entity-demo-a'),by='Demo employee A · Demo Asset Company A';
    const lateAt=(p,t)=>Math.max(0,Math.floor((Date.parse(iso(t).slice(0,10))-Date.parse(p.due))/DAY));
    const settle=(q,p,t)=>{p.state='settled';p.chain=null;p.record={id:'RM-MC-'+q.id.slice(-4)+'-'+p.seq,at:iso(t-H),confirmedAt:iso(t),amount:p.settlement,ccy:q.ccy,from,account:q.repayTo?{...q.repayTo}:null,hash:hash(p.id+'r'),authHash:hash(p.id+'a'),gas:'0.000910',overdue:0,by};};
    const submit=(q,p,t,state='processing')=>{p.state='pending';p.lastFail=null;p.chain={at:iso(t),from,to:q.repayTo?{...q.repayTo}:null,amount:p.settlement,ccy:q.ccy,authHash:hash(p.id+'a'),overdue:lateAt(p,t),state,by};};
    /* 第 3 号：已过应还日的前几期已结清，最近一期逾期后签名提交、还款上链确认中（冻结逾期），下一期未到期。 */
    const a=quote('FB-MC-0003');if(a?.l8){const due=a.l8.periods.filter(p=>Date.parse(p.due)<now);due.slice(0,-1).forEach(p=>settle(a,p,Date.parse(p.due)+6*H));const last=due.at(-1);if(last)submit(a,last,now-5*H);}
    /* 第 8 号：签名提交后链上结果长期未知。 */
    const u=quote('FB-MC-0008'),up=u?.l8?.periods[0];if(up)submit(u,up,now-50*H,'unknown');
    /* 第 7 号：全部期次链上还款成功，本笔已结清。 */
    const s=quote('FB-MC-0007');
    if(s?.l8){s.l8.periods.forEach(p=>settle(s,p,Date.parse(p.due)+4*H));s.l8.settledAt=s.l8.periods.at(-1).record.confirmedAt;s.l7.state='settled';s.l7.principalBalance=0;const project=D.project(s.project);project.balance=0;project.state='settled';}
    db.consolePeriods=VERSION;reconcile();Q.save();D.save();
  };
})(window.CF);

/* Complete the known demo snapshot, including tokens never linked to a project.
 * This fixture migration is not a fallback for missing production data. */
(function(CF){
  const D=CF.LS,DAY=86400000,iso=n=>new Date(n).toISOString();
  if(!D.token('TK-MC-UNLINKED-VOID')){
    ['free','pending','failed','released'].forEach((pledge,i)=>D.tokens.push({
      id:i?'TK-MC-UNLINKED-'+pledge.toUpperCase():'TK-MC-UNLINKED-VOID',owner:'entity-demo-a',
      kind:'erc20-ar',units:2+i,symbol:'AR-DEMO',value:80000+i*10000,valid:i!==0,pool:null,pledge,
      buyer:['Demo Buyer A','演示买方 A'],from:'2026-07-01',due:'2027-06-30',issued:iso(D.now()-(i+1)*DAY)
    }));
  }
  D.tokens.filter(t=>t.owner==='entity-demo-a'&&/^TK-(DEMO-|FREE-|MC-|MH-)/.test(t.id)).forEach((t,i)=>{
    if(!t.issued)t.issued=iso(D.now()-(i+3)*DAY);
    // Known console fixtures only: illustrative identity, never a production-data fallback.
    if(!t.name)t.name=['Demo receivables token','演示应收账款代币'];
    if(!t.logo)t.logo={shape:0,hue:1};
    if(!t.network)t.network=D.PLEDGE_CHAIN;
    if(!t.tx)t.tx='0x'+Array.from(t.no||t.id).map(c=>c.charCodeAt(0).toString(16)).join('').padStart(64,'0').slice(-64);
  });
  D.save();
})(window.CF);
