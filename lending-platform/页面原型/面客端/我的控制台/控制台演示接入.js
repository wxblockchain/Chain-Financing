/* WS-355: additive local fixtures consumed by the existing L5–L8 adapters.
 * No API, permissions, live exchange-rate or cross-platform release assertion. */
(function(CF){
  'use strict';
  const D=CF.LS,Q=CF.CQ,db=Q.data(),DAY=86400000,H=3600000;
  if(db.consoleExamples===11)return;
  const now=D.now(),iso=n=>new Date(n).toISOString();
  D.tokens.filter(t=>t.owner==='entity-demo-a'&&!t.issued).forEach((t,i)=>{t.issued=iso(now-(i+3)*DAY);});
  const account={name:'Demo Asset Company A',iban:'DEMO-ACCOUNT-001',bank:'Demo Bank',swift:'DEMOXXXX',country:'Singapore',addressCountry:'Singapore',addressCity:'Singapore',addressLine:'18 Example Avenue',bankCity:'Singapore'};
  const repay={repayName:'Demo Capital A',repayNumber:'DEMO-ACCOUNT-002',repaySwift:'DEMOXXXX',repayBank:'Demo Bank',repayIntermediary:'—'};
  const samples=[['pending','USD'],['waiting','USD'],['confirmed','USD'],['confirmed','USDT'],['terminated','USD']];
  samples.forEach(([state,ccy],i)=>{
    const id='FP-MC-'+String(i+1).padStart(3,'0'),business='FB-MC-'+String(i+1).padStart(4,'0'),request=id+'-01';
    if(D.project(id))return;
    const confirmed=state==='confirmed',amount=240000,start=now-(confirmed?92:2)*DAY,end=start+370*DAY;
    const p={id,name:[['Trade receivables','Export settlement','Quarterly working capital','Cross-border inventory','Completed negotiation'][i],['贸易应收账款','出口结算融资','季度营运资金','跨境备货融资','历史协商项目'][i]],owner:'entity-demo-a',state:confirmed?'financing':state==='terminated'?'raising':'locked',balance:confirmed?amount:0,published:iso(start),created:iso(start-DAY),expires:iso(end),demands:[{id:request,amount,state:confirmed?'funded':state==='terminated'?'open':'funding',at:iso(start),tenorDays:370,rate:'6.40',institution:['Demo Capital A','演示资金机构 A'],quoteAt:iso(start)}]};
    D.projects.push(p);
    for(let j=1;j<=3;j++)D.tokens.push({id:'TK-MC-'+(i+1)+'-'+j,owner:p.owner,kind:'ar',units:1,symbol:'AR-DEMO',value:150000,valid:true,pool:id,pledge:'pledged',buyer:['Demo Buyer '+j,'演示买方 '+j],due:iso(end+30*DAY).slice(0,10),from:iso(start-DAY).slice(0,10),issued:iso(start-DAY)});
    const q={id:business,project:id,owner:p.owner,demand:request,amount,ccy,rate:'6.40',settlement:amount,fx:{value:1,version:'FX-MC-001',at:start,source:['Demonstration snapshot','演示汇率快照']},at:start,end:start+168*H,state:confirmed?'funded':state==='terminated'?'terminated':'funding',fund:'fund-a',repay:iso(end),done:start+H,progress:{account:{...account},step:3,confirmed:true,viewed:true,declared:true,uploads:[]}};
    const record=['waiting','confirmed'].includes(state)?{id:'LN-MC-'+(i+1),at:iso(confirmed?start:now-6*DAY),form:{...repay,paidAt:iso(confirmed?start-H:now-6*DAY-H),hash:ccy==='USD'?'':'0x'+'a'.repeat(64),files:[],note:''}}:null;
    q.l7={id:business,project:id,owner:p.owner,fund:'fund-a',request,ccy,amount,settlement:amount,rate:q.rate,fx:q.fx,at:start,account:{...account},state,hold:i===0?{text:'Waiting for internal payment approval',at:iso(now-H)}:null,redo:i===0?{text:'请补全盖章页 / Please complete the stamped page',at:iso(now-H)}:null,history:[],versions:[{name:'demonstration-contract.pdf',at:iso(start+H),by:['Demo employee A','演示员工 A'],files:[]}],record,confirmedAt:confirmed?iso(start+2*H):null,reason:state==='terminated'?'双方协商终止 / Terminated by agreement':'',terminatedAt:state==='terminated'?iso(now-DAY):null,plan:'handoff',principalBalance:confirmed?amount:0,projectTransit:confirmed||state==='terminated'?0:amount,quoteTransit:confirmed||state==='terminated'?0:amount,creditUsed:confirmed?amount:0};
    db.quotes.push(q);
  });
  const own=db.credits.find(c=>c.owner==='entity-demo-a'&&c.fund==='fund-a');
  if(own)own.principal+=480000;
  db.consoleExamples=11;Q.save();
  CF.MCSeedPeriods=function(){
    if(db.consolePeriods)return;
    CF.L8.ensure();
    const q=db.quotes.find(q=>q.id==='FB-MC-0003'),p=q?.l8?.periods[0];
    if(p){p.state='pending';p.record={id:'RM-MC-001',paidAt:iso(now-H),at:iso(now),overdue:2,confirmedAt:null,by:'Demo employee A · Demo Asset Company A',note:'',hash:'',files:[],account:{...repay}};}
    db.consolePeriods=true;Q.save();
  };
})(window.CF);
