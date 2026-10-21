/* WS-378: additive local fixtures consumed by the existing L5–L8 adapters.
 * No API, permissions, live exchange-rate or cross-platform release assertion. */
(function(CF){
  'use strict';
  const D=CF.LS,Q=CF.CQ,DAY=86400000,H=3600000,iso=n=>new Date(n).toISOString();
  let db=Q.data(),now=D.now();
  /* 两侧收款账户都取企业账户目录里的演示账户快照，本文件不另建账户字段。 */
  const pick=(owner,kind,chain)=>{const list=Q.accounts(owner,kind).filter(a=>!Q.accountMissing(a).length);
    return Q.accountSnapshot(list.find(a=>!chain||a.chain===chain)||list[0]);};
  const payee=(ccy,chain)=>pick('fund-a',ccy==='USD'?'fiat':'crypto',chain);
  const digits=n=>Array.from({length:n},(_,i)=>'0123456789abcdef'[(i*7+3)%16]).join('');
  const txFor=a=>a?.kind==='crypto'?(a.chain==='TRON'?digits(64):'0x'+digits(64)):'';
  /* 报价一经提交不可撤回；放款段只有“资金方提交放款 → 资产方确认到账”两步，没有终止、暂缓或重传样例。
     样例逐笔补齐：项目或报价任一缺失（演示条重置、流程演示重新播种、旧本地存档）都按原样例恢复，已存在的不动。 */
  /* 法币放款凭证没有真实文件，标记为演示文件，由放款模块在打开时生成演示 PDF。 */
  const demoReceipt=()=>[{name:'demonstration-transfer-receipt.pdf',type:'application/pdf',demo:true}];
  /* 授信占用额与逐笔未偿本金同源：演示授信的占用额取本授信下已到账、未结清业务的未偿本金合计，使用记录与汇总一致。 */
  function reconcile(){
    const own=Q.data().credits.find(c=>c.owner==='entity-demo-a'&&c.fund==='fund-a');if(!own)return false;
    const v=Math.round(Q.data().quotes.filter(q=>q.owner===own.owner&&q.fund===own.fund&&q.l7?.state==='confirmed').reduce((n,q)=>n+(+q.l7.principalBalance||0),0)*100)/100;
    if(own.principal===v)return false;own.principal=v;return true;
  }
  function restore(){
  db=Q.data();now=D.now();
  const fresh=db.consoleExamples!==16;
  D.tokens.filter(t=>t.owner==='entity-demo-a'&&!t.issued).forEach((t,i)=>{t.issued=iso(now-(i+3)*DAY);});
  let occupied=0,changed=false;
  /* 9～12 号是数币的待放款 / 待放款确认样例（ETH、TRON 各一套），供演示条按结算方式切换。
     13 号首期已到应还日且未提交，用于资产方“还款”待办与已逾期排序。 */
  const samples=[['pending','USD'],['waiting','USD'],['confirmed','USD'],['confirmed','USDT','TRON'],['rejected','USD'],['confirmed','USD'],['confirmed','USD'],['confirmed','USDC','ETH'],['pending','USDT','ETH'],['pending','USDT','TRON'],['waiting','USDC','ETH'],['waiting','USDT','TRON'],['confirmed','USD']];
  samples.forEach(([state,ccy,chain],i)=>{
    const id='FP-MC-'+String(i+1).padStart(3,'0'),business='FB-MC-'+String(i+1).padStart(4,'0'),request=id+'-01';
    if(D.project(id)&&db.quotes.some(q=>q.id===business))return;
    changed=true;const old=D.project(id);if(old)D.projects.splice(D.projects.indexOf(old),1);
    const confirmed=state==='confirmed',amount=240000,start=now-(i===2?280:i===6?500:i===12?95:confirmed?92:state==='waiting'?8:2)*DAY;
    /* 项目期限取创建日 + 12 个月（D-LS-66 上限，含端点）；到期即还款日。 */
    const end=Date.parse(D.addMonths(iso(start-DAY).slice(0,10),12)+'T12:00:00.000Z');
    /* 项目质押率由资产方创建时自填并终身锁定，演示数据刻意不统一成 80%。 */
    const rate=[0.8,0.75,0.8,0.7,0.8,0.8,0.8,0.8,0.8,0.75,0.8,0.7,0.8][i];
    const p={id,name:[['Trade receivables','Export settlement','Quarterly working capital','Cross-border inventory','Completed negotiation','Confirmed receipt','Completed financing','Digital settlement financing','Stablecoin supplier payments','TRON trade settlement','Stablecoin export financing','TRON inventory financing','Coastal freight receivables'][i],['贸易应收账款','出口结算融资','季度营运资金','跨境备货融资','历史协商项目','到账待生成计划','历史结清融资','数币结算融资','稳定币供应商付款','TRON 贸易结算','稳定币出口融资','TRON 备货融资','沿海运费应收'][i]],owner:'entity-demo-a',kind:'erc20-ar',rate,term:12,settle:[ccy],repay:D.REPAY,spv:D.SPV,contract:'0x'+String(i+1).padStart(40,'0'),state:state==='rejected'?'raising':'financing',balance:confirmed?amount:0,published:iso(start),created:iso(start-DAY),expires:iso(end),demands:[{id:request,amount,state:confirmed?'funded':state==='rejected'?'open':'funding',at:iso(start),tenorDays:370,rate:'6.40',institution:['Demo Capital A','演示资金机构 A'],quoteAt:iso(start)}]};
    D.projects.push(p);
    if(confirmed)occupied+=amount;
    for(let j=1;j<=3;j++)if(!D.token('TK-MC-'+(i+1)+'-'+j))D.tokens.push({id:'TK-MC-'+(i+1)+'-'+j,owner:p.owner,kind:'erc20-ar',units:1,symbol:'AR-DEMO',value:150000,valid:true,pool:id,pledge:'pledged',buyer:['Demo Buyer '+j,'演示买方 '+j],due:iso(end+30*DAY).slice(0,10),from:iso(start-DAY).slice(0,10),issued:iso(start-DAY)});
    const holder=pick(p.owner,ccy==='USD'?'fiat':'crypto',chain);
    const q={id:business,project:id,owner:p.owner,demand:request,amount,ccy,rate:'6.40',settlement:amount,fx:{value:1,version:'FX-MC-001',at:start,source:['Demonstration snapshot','演示汇率快照']},at:start,state:confirmed?'funded':state==='rejected'?'rejected':'funding',fund:'fund-a',repay:iso(end),done:state==='rejected'?start+2*H:start+H,progress:{selected:holder.id,account:holder,step:2,confirmed:true,viewed:true}};
    if(state==='rejected'){q.reason='融资条款不符合当前需求 / Terms do not match current needs';q.progress={selected:'',account:null,step:1,confirmed:false,viewed:false};}
    const fundAccount=payee(ccy,chain);
    const record=['waiting','confirmed'].includes(state)?{id:'LN-MC-'+(i+1),at:iso(confirmed?start+2*H:now-6*DAY),account:fundAccount,form:{paidAt:iso(confirmed?start+1.5*H:now-6*DAY-H),hash:txFor(holder),files:ccy==='USD'?demoReceipt():[],note:''}}:null;
    db.quotes.push(q);
    if(state!=='rejected')q.l7={id:business,project:id,owner:p.owner,fund:'fund-a',request,ccy,amount,settlement:amount,rate:q.rate,fx:q.fx,at:start,acceptedAt:q.done,account:holder,state,history:[],record,confirmedAt:confirmed?iso(start+3*H):null,plan:'handoff',principalBalance:confirmed?amount:0,projectTransit:confirmed?0:amount,quoteTransit:confirmed?0:amount,creditUsed:confirmed?amount:0};
    if(i===5)q.l7.plan='waiting';
    if(i===4){p.demands[0].state='ended';p.demands[0].reason='资产方拒绝报价 / Quote rejected by the asset holder';p.demands.push({id:id+'-02',amount:180000,state:'open',at:iso(now-DAY),tenorDays:180});}
    if(i===0&&!db.quotes.some(q=>q.id==='FB-MC-HISTORY-01')){const past=structuredClone(q);past.id='FB-MC-HISTORY-01';past.state='rejected';past.reason='双方未达成条款一致 / Terms not agreed';past.at=start-H;past.done=start-H/2;delete past.l7;db.quotes.push(past);}
  });
  /* 已确认到账的演示业务占用同一条授信；额度随占用同步放宽，避免出现已用额超过总额的假数据。 */
  const own=db.credits.find(c=>c.owner==='entity-demo-a'&&c.fund==='fund-a');
  if(own&&fresh)own.principal+=occupied;
  /* 待放款 / 待放款确认样例同样占用在途报价金额；总额始终留出余量，不出现可用授信为负的假数据。 */
  if(own&&(fresh||changed)){const fly=db.quotes.filter(q=>q.owner===own.owner&&q.fund===own.fund&&['waiting','funding'].includes(q.state)).reduce((n,q)=>n+q.amount,0);own.total=Math.max(own.total,own.principal+fly+1000000);}
  if(!changed&&!fresh){if(reconcile())Q.save();return;}
  /* 新增项目的合约内代币按“质押成功”补齐逐张记录，否则有效质押额要等下一次载入才成立。 */
  D.normalize();D.save();
  db.consoleExamples=16;delete db.consolePeriods;reconcile();Q.save();
  }
  restore();
  /* 演示条与流程演示会整体重新播种借贷数据；播种后立即补回这些样例，不必刷新页面。 */
  const seed=D.seed;D.seed=()=>{seed();restore();CF.MCSeedPeriods?.();};
  CF.MCRestore=restore;
  CF.MCSeedPeriods=function(){
    db=Q.data();now=D.now();if(db.consolePeriods===16){if(reconcile())Q.save();return;}
    CF.L8.ensure();
    const q=db.quotes.find(q=>q.id==='FB-MC-0003');
    q?.l8?.periods.slice(0,2).forEach((p,i)=>{const at=now-(i?1:9)*DAY;p.state='pending';p.record={id:'RM-MC-00'+(i+1),paidAt:iso(at-H),at:iso(at),overdue:Math.max(0,Math.floor((at-Date.parse(p.due))/DAY)),confirmedAt:null,by:'Demo employee A · Demo Asset Company A',note:'',hash:txFor(q.l7.record.account),files:[],account:q.l7.record.account};});
    /* 数币（TRON）还款记录：演示交易标识与无区块浏览器入口的表达。 */
    const crypto=db.quotes.find(q=>q.id==='FB-MC-0004'),cp=crypto?.l8?.periods[0];
    if(cp&&cp.state==='due'){const at=now-2*H;cp.state='pending';cp.record={id:'RM-MC-TRON-1',paidAt:iso(at-H),at:iso(at),overdue:Math.max(0,Math.floor((at-Date.parse(cp.due))/DAY)),confirmedAt:null,by:'Demo employee A · Demo Asset Company A',note:'',hash:txFor(crypto.l7.record.account),files:[],account:crypto.l7.record.account};}
    /* 数币（ETH）还款记录：同一字段在有区块浏览器入口时的表达。 */
    const eth=db.quotes.find(q=>q.id==='FB-MC-0008'),ep=eth?.l8?.periods[0];
    if(ep&&ep.state==='due'){const at=now-3*H;ep.state='pending';ep.record={id:'RM-MC-ETH-1',paidAt:iso(at-H),at:iso(at),overdue:Math.max(0,Math.floor((at-Date.parse(ep.due))/DAY)),confirmedAt:null,by:'Demo employee A · Demo Asset Company A',note:'',hash:txFor(eth.l7.record.account),files:[],account:eth.l7.record.account};}
    const settled=db.quotes.find(q=>q.id==='FB-MC-0007');
    if(settled?.l8){settled.l8.periods.forEach((p,i)=>{p.state='settled';p.record={id:'RM-MC-SETTLED-'+i,paidAt:iso(Date.parse(p.due)),at:iso(Date.parse(p.due)),confirmedAt:iso(Date.parse(p.due)+H),overdue:0,hash:txFor(settled.l7.record.account),files:[],account:settled.l7.record.account};});settled.l8.settledAt=settled.l8.periods.at(-1).record.confirmedAt;settled.l7.state='settled';settled.l7.principalBalance=settled.l7.creditUsed=0;const project=D.project(settled.project);project.balance=0;project.state='settled';}
    db.consolePeriods=16;reconcile();Q.save();
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
    if(!t.tx)t.tx='0x'+Array.from(t.no||t.id).map(c=>c.charCodeAt(0).toString(16)).join('').padStart(64,'0').slice(-64);
  });
  D.save();
})(window.CF);
