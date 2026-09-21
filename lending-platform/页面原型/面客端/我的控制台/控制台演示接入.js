/* WS-355: additive local fixtures consumed by the existing L5–L8 adapters.
 * No API, permissions, live exchange-rate or cross-platform release assertion. */
(function(CF){
  'use strict';
  const D=CF.LS,Q=CF.CQ,db=Q.data(),DAY=86400000,H=3600000;
  if(db.consoleExamples===12)return;
  const now=D.now(),iso=n=>new Date(n).toISOString();
  D.tokens.filter(t=>t.owner==='entity-demo-a'&&!t.issued).forEach((t,i)=>{t.issued=iso(now-(i+3)*DAY);});
  const account={name:'Demo Asset Company A',iban:'DEMO-ACCOUNT-001',bank:'Demo Bank',swift:'DEMOXXXX',country:'Singapore',addressCountry:'Singapore',addressCity:'Singapore',addressLine:'18 Example Avenue',bankCity:'Singapore'};
  const repay={repayName:'Demo Capital A',repayNumber:'DEMO-ACCOUNT-002',repaySwift:'DEMOXXXX',repayBank:'Demo Bank',repayIntermediary:'—'};
  const samples=[['pending','USD'],['waiting','USD'],['confirmed','USD'],['confirmed','USDT'],['terminated','USD'],['confirmed','USD'],['confirmed','USD']];
  samples.forEach(([state,ccy],i)=>{
    const id='FP-MC-'+String(i+1).padStart(3,'0'),business='FB-MC-'+String(i+1).padStart(4,'0'),request=id+'-01';
    if(D.project(id))return;
    const confirmed=state==='confirmed',amount=240000,start=now-(i===2?280:i===6?500:confirmed?92:state==='waiting'?8:2)*DAY,end=start+370*DAY;
    const p={id,name:[['Trade receivables','Export settlement','Quarterly working capital','Cross-border inventory','Completed negotiation','Confirmed receipt','Completed financing'][i],['贸易应收账款','出口结算融资','季度营运资金','跨境备货融资','历史协商项目','到账待生成计划','历史结清融资'][i]],owner:'entity-demo-a',state:confirmed?'financing':state==='terminated'?'raising':'locked',balance:confirmed?amount:0,published:iso(start),created:iso(start-DAY),expires:iso(end),demands:[{id:request,amount,state:confirmed?'funded':state==='terminated'?'open':'funding',at:iso(start),tenorDays:370,rate:'6.40',institution:['Demo Capital A','演示资金机构 A'],quoteAt:iso(start)}]};
    D.projects.push(p);
    for(let j=1;j<=3;j++)D.tokens.push({id:'TK-MC-'+(i+1)+'-'+j,owner:p.owner,kind:'ar',units:1,symbol:'AR-DEMO',value:150000,valid:true,pool:id,pledge:'pledged',buyer:['Demo Buyer '+j,'演示买方 '+j],due:iso(end+30*DAY).slice(0,10),from:iso(start-DAY).slice(0,10),issued:iso(start-DAY)});
    const q={id:business,project:id,owner:p.owner,demand:request,amount,ccy,rate:'6.40',settlement:amount,fx:{value:1,version:'FX-MC-001',at:start,source:['Demonstration snapshot','演示汇率快照']},at:start,end:start+168*H,state:confirmed?'funded':state==='terminated'?'terminated':'funding',fund:'fund-a',repay:iso(end),done:start+H,progress:{account:{...account},step:3,confirmed:true,viewed:true,declared:true,uploads:[]}};
    const record=['waiting','confirmed'].includes(state)?{id:'LN-MC-'+(i+1),at:iso(confirmed?start+2*H:now-6*DAY),form:{...repay,paidAt:iso(confirmed?start+1.5*H:now-6*DAY-H),hash:ccy==='USD'?'':'0x'+'a'.repeat(64),files:[],note:''}}:null;
    q.l7={id:business,project:id,owner:p.owner,fund:'fund-a',request,ccy,amount,settlement:amount,rate:q.rate,fx:q.fx,at:start,account:{...account},state,hold:i===0?{text:'Waiting for internal payment approval',at:iso(now-H)}:null,redo:i===0?{text:'请补全盖章页 / Please complete the stamped page',at:iso(now-H)}:null,history:[],versions:[{name:'demonstration-contract.pdf',at:iso(start+H),by:['Demo employee A','演示员工 A'],files:[]}],record,confirmedAt:confirmed?iso(start+3*H):null,reason:state==='terminated'?'双方协商终止 / Terminated by agreement':'',terminatedAt:state==='terminated'?iso(now-DAY):null,plan:'handoff',principalBalance:confirmed?amount:0,projectTransit:confirmed||state==='terminated'?0:amount,quoteTransit:confirmed||state==='terminated'?0:amount,creditUsed:confirmed?amount:0};
    db.quotes.push(q);
    if(i===5)q.l7.plan='waiting';
    if(i===4){p.demands[0].state='ended';p.demands[0].reason='协商终止 / Terminated by agreement';p.demands.push({id:id+'-02',amount:180000,state:'open',at:iso(now-DAY),tenorDays:180});}
    if(i===0){const past=structuredClone(q);past.id='FB-MC-HISTORY-01';past.state='rejected';past.reason='双方未达成条款一致 / Terms not agreed';past.at=start-H;past.done=start-H/2;delete past.l7;db.quotes.push(past);}
  });
  const own=db.credits.find(c=>c.owner==='entity-demo-a'&&c.fund==='fund-a');
  if(own)own.principal+=720000;
  db.consoleExamples=12;Q.save();
  CF.MCSeedPeriods=function(){
    if(db.consolePeriods===12)return;
    CF.L8.ensure();
    const q=db.quotes.find(q=>q.id==='FB-MC-0003');
    q?.l8?.periods.slice(0,2).forEach((p,i)=>{const at=now-(i?1:9)*DAY;p.state='pending';p.record={id:'RM-MC-00'+(i+1),paidAt:iso(at-H),at:iso(at),overdue:Math.max(0,Math.floor((at-Date.parse(p.due))/DAY)),confirmedAt:null,by:'Demo employee A · Demo Asset Company A',note:'',hash:'',files:[],account:{...repay}};});
    const settled=db.quotes.find(q=>q.id==='FB-MC-0007');
    if(settled?.l8){settled.l8.periods.forEach((p,i)=>{p.state='settled';p.record={id:'RM-MC-SETTLED-'+i,paidAt:iso(Date.parse(p.due)),at:iso(Date.parse(p.due)),confirmedAt:iso(Date.parse(p.due)+H),overdue:0,files:[],account:{...repay}};});settled.l8.settledAt=settled.l8.periods.at(-1).record.confirmedAt;settled.l7.principalBalance=settled.l7.creditUsed=0;const project=D.project(settled.project);project.balance=0;project.state='settled';}
    db.consolePeriods=12;Q.save();
  };
})(window.CF);

/* Complete the known demo snapshot, including tokens never linked to a project.
 * This fixture migration is not a fallback for missing production data. */
(function(CF){
  const D=CF.LS,DAY=86400000,iso=n=>new Date(n).toISOString();
  if(!D.token('TK-MC-UNLINKED-VOID')){
    ['free','pending','failed','released'].forEach((pledge,i)=>D.tokens.push({
      id:i?'TK-MC-UNLINKED-'+pledge.toUpperCase():'TK-MC-UNLINKED-VOID',owner:'entity-demo-a',
      kind:'ar',units:2+i,symbol:'AR-DEMO',value:80000+i*10000,valid:i!==0,pool:null,pledge,
      buyer:['Demo Buyer A','演示买方 A'],from:'2026-07-01',due:'2027-06-30',issued:iso(D.now()-(i+1)*DAY)
    }));
  }
  D.tokens.filter(t=>t.owner==='entity-demo-a'&&/^TK-(DEMO-|FREE-|MC-)/.test(t.id)).forEach((t,i)=>{
    if(!t.issued)t.issued=iso(D.now()-(i+3)*DAY);
    if(!t.tx)t.tx='0x'+Array.from(t.id).map(c=>c.charCodeAt(0).toString(16)).join('').padStart(64,'0');
  });
  D.save();
})(window.CF);
