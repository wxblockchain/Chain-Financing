/* Demonstration fixtures only · 融资台账（运营端，只读）。
   本模块自有的一套虚构数据：从融资项目一路串到还款期次，编号互相对应，用于演示两个清单、
   六个详情页签与关联跳转。不读取、不改写其他模块的演示数据，不连接任何链上或业务服务。
   金额、利率、汇率、地址与交易标识均为虚构值。 */
(function(CF){
  'use strict';
  const D=86400000,H=3600000,M=60000;
  const day=t=>{const d=new Date(t);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());};
  const r2=v=>Math.round(v*100)/100;
  const addr=tail=>'0xDEMO'+'0'.repeat(36-String(tail).length)+tail;      // 42 字符，演示地址
  const hash=tail=>'0xDEMO'+'0'.repeat(62-String(tail).length)+tail;      // 66 字符，演示交易标识
  const ymd=t=>new Date(t).toISOString().slice(0,10).replace(/-/g,'');
  const seq=(prefix,t,n)=>prefix+ymd(t)+String(n).padStart(6,'0');

  CF.ledgerSeed=function(){
    const now=Date.now(),today=day(now);
    const TOKEN='ERC-3525-应收账款',TOKEN_B='ERC-3525-演示类型B';
    const SET={[TOKEN]:{pledge:addr('A1P1'),loan:addr('A1L1'),repay:addr('A1R1')},
      [TOKEN_B]:{pledge:addr('B1P1'),loan:addr('B1L1'),repay:addr('B1R1')}};
    const REPAY=['Quarterly interest, principal and interest at maturity','按季付息、到期还本付息'];

    /* ---------------------------------------------------------------- 融资项目 */
    const P=(id,o)=>Object.assign({id,tokenType:TOKEN,network:'eth',ratio:.7,refCcy:'USDT',repayment:REPAY,
      expired:false,closeReason:null,invalid:{value:0,count:0},released:{value:0,count:0},gap:null,inTransit:0,balance:0,available:0,
      contracts:SET[o.tokenType||TOKEN]},o);
    const projects=[
      P('FP-26082804',{key:'1',owner:'A',status:'financing',configuredAt:now-130*D,termStart:today-132*D,termEnd:today+90*D,validUntil:today+90*D,
        effective:1000000,total:1000000,coverage:'sufficient',balance:500000,available:200000}),
      P('FP-26090107',{key:'2',owner:'B',status:'raising',configuredAt:now-46*D,termStart:today-48*D,termEnd:today+135*D,validUntil:today+135*D,
        effective:620000,total:700000,coverage:'sufficient',inTransit:300000,available:134000}),
      P('FP-26091502',{key:'3',owner:'C',status:'locked',tokenType:TOKEN_B,configuredAt:now-31*D,termStart:today-33*D,termEnd:today+150*D,validUntil:today+150*D,
        effective:450000,total:450000,coverage:'sufficient',inTransit:250000,available:42500,ratio:.65}),
      P('FP-26092203',{key:'4',owner:'A',status:'available',configuredAt:now-24*D,termStart:today-26*D,termEnd:today+157*D,validUntil:today+157*D,
        effective:400000,total:460000,coverage:'sufficient',inTransit:120000,available:160000}),
      P('FP-26080512',{key:'5',owner:'B',status:'settled',configuredAt:now-400*D,termStart:today-402*D,termEnd:today+40*D,validUntil:today+40*D,
        effective:0,total:0,coverage:'sufficient',closeReason:['Settled · pool released','项目结清'],released:{value:160000,count:2}}),
      P('FP-26081907',{key:'6',owner:'C',status:'financing',expired:true,configuredAt:now-330*D,termStart:today-332*D,termEnd:today-6*D,validUntil:today-6*D,
        effective:420000,total:520000,coverage:'short',invalid:{value:100000,count:1},gap:{usdt:46000,usd:65714.29},balance:340000,available:0}),
      P('FP-26092908',{key:'7',owner:'A',status:'available',tokenType:TOKEN_B,configuredAt:now-6*D,termStart:today-7*D,termEnd:today+176*D,validUntil:today+176*D,
        effective:0,total:0,coverage:null,ratio:.65}),
      P('FP-26071503',{key:'8',owner:'B',status:'closed',configuredAt:now-96*D,termStart:today-100*D,termEnd:today+82*D,validUntil:today+82*D,
        effective:0,total:0,coverage:'sufficient',closeReason:['Closed by the asset holder','资产方主动关闭']}),
      P('FP-26100106',{key:'9',owner:'C',status:'financing',configuredAt:now-12*D,termStart:today-14*D,termEnd:today+168*D,validUntil:today+168*D,
        effective:900000,total:900000,coverage:'sufficient',balance:600000,available:30000})
    ];

    /* ---------------------------------------------------------------- 质押记录 */
    let pn=0;
    const pledges=[];
    const PL=(project,o)=>{pn++;const at=o.pledgedAt===undefined?now-(o.age||30)*D:o.pledgedAt;
      const rec=Object.assign({id:at?seq('PR',at,pn):null,project,token:'T-'+String(8800+pn),chainTokenId:String(3000+pn),
        tokenContract:addr('T'+String(pn).padStart(3,'0')),holder:addr('H'+project.slice(-2)),qty:1,symbol:'RCV',value:100000,tokenState:'valid',
        dest:'counted',unknown:false,reasons:[],applyType:'first',exec:'success',batch:'PB'+ymd(at||now)+String(400+pn).padStart(6,'0'),
        apply:'PA'+ymd(at||now)+String(700+pn).padStart(6,'0'),pledgedAt:at,startedAt:(at||now)-6*M,releasedAt:null,outAt:null,removal:null,
        proof:at?hash('PL'+pn):null,outProof:null},o);
      delete rec.age;pledges.push(rec);return rec;};
    ['P1-a','P1-b','P1-c','P1-d','P1-e'].forEach((_,i)=>PL('FP-26082804',{age:125-i*4,value:[300000,250000,200000,150000,100000][i],applyType:i?'add':'first',qty:[3,2.5,2,1.5,1][i]}));
    PL('FP-26090107',{age:44,value:320000,qty:3.2});
    PL('FP-26090107',{age:40,value:300000,qty:3,applyType:'add'});
    PL('FP-26091502',{age:30,value:250000,qty:2.5,symbol:'WHR'});
    PL('FP-26091502',{age:29,value:200000,qty:2,symbol:'WHR',applyType:'add'});
    PL('FP-26092203',{age:22,value:180000,qty:1.8});
    PL('FP-26092203',{age:20,value:100000,qty:1,applyType:'add'});
    PL('FP-26092203',{pledgedAt:null,startedAt:now-38*M,value:90000,qty:.9,dest:'processing',exec:'processing',applyType:'add'});
    PL('FP-26092203',{age:18,value:60000,qty:.6,dest:'withdrawing',applyType:'add',exec:'success'});
    PL('FP-26080512',{age:395,value:100000,dest:'released',releasedAt:now-9*D,removal:'settle'});
    PL('FP-26080512',{age:393,value:60000,qty:.6,dest:'released',releasedAt:now-9*D,removal:'settle',applyType:'add'});
    PL('FP-26080512',{age:391,value:40000,qty:.4,dest:'returned',releasedAt:now-9*D,outAt:now-8*D,removal:'settle',applyType:'add',outProof:hash('OUT1')});
    PL('FP-26081907',{age:325,value:220000,qty:2.2});
    PL('FP-26081907',{age:322,value:200000,qty:2,applyType:'add'});
    PL('FP-26081907',{age:318,value:100000,qty:1,tokenState:'invalid',dest:'excluded',reasons:['invalid','recon'],applyType:'add'});
    PL('FP-26081907',{pledgedAt:null,startedAt:now-3*D-2*H,value:50000,qty:.5,dest:'processing',unknown:true,exec:'unknown',applyType:'add',proof:hash('PLU1')});
    const reused=PL('FP-26071503',{age:94,value:120000,qty:1.2,dest:'returned',outAt:now-36*D,removal:'withdraw',outProof:hash('OUT2')});
    PL('FP-26071503',{age:92,value:80000,qty:.8,dest:'returned',releasedAt:now-30*D,outAt:now-29*D,removal:'close',applyType:'add',outProof:hash('OUT3')});
    /* 同一份额解押后再次质押：另成一条新记录，旧记录保留。 */
    PL('FP-26092203',{age:21,value:120000,qty:1.2,token:reused.token,chainTokenId:reused.chainTokenId,tokenContract:reused.tokenContract,applyType:'add'});
    PL('FP-26100106',{age:11,value:500000,qty:5});
    PL('FP-26100106',{age:10,value:400000,qty:4,applyType:'add'});
    PL('FP-26090107',{age:39,value:80000,qty:.8,dest:'excluded',reasons:['withdraw'],applyType:'add'});

    /* ---------------------------------------------------------------- 融资需求 */
    const recv=p=>addr('RX'+p.slice(-2));
    const op=(kind,at,p,t)=>({kind,at,addr:recv(p),tx:hash(t)});
    const demands=[
      {id:'FP-26082804-01',project:'FP-26082804',round:1,amount:400000,status:'ended',endReason:['Withdrawn by the asset holder','资产方撤下'],
        publishedAt:now-120*D,endedAt:now-101*D,ops:[op('publish',now-120*D,'FP-26082804','D11'),op('withdraw',now-101*D,'FP-26082804','D12')]},
      {id:'FP-26082804-02',project:'FP-26082804',round:2,amount:500000,status:'funded',publishedAt:now-100*D,
        ops:[op('publish',now-100*D,'FP-26082804','D21'),op('release',now-95*D,'FP-26082804','D22')]},
      {id:'FP-26090107-01',project:'FP-26090107',round:1,amount:300000,status:'quoted',publishedAt:now-38*D,
        ops:[op('publish',now-38*D,'FP-26090107','D31'),op('resize',now-36*D,'FP-26090107','D32')]},
      {id:'FP-26091502-01',project:'FP-26091502',round:1,amount:250000,status:'lending',publishedAt:now-27*D,
        ops:[op('publish',now-27*D,'FP-26091502','D41')]},
      {id:null,project:'FP-26092203',round:1,amount:120000,status:null,chain:'publishing',publishedAt:null,startedAt:now-22*M,ops:[]},
      {id:'FP-26080512-01',project:'FP-26080512',round:1,amount:160000,status:'funded',publishedAt:now-376*D,
        ops:[op('publish',now-376*D,'FP-26080512','D51'),op('release',now-371*D,'FP-26080512','D52')]},
      {id:'FP-26081907-01',project:'FP-26081907',round:1,amount:380000,status:'ended',endReason:['Auto-expired · pledge level insufficient','自动失效·质押水位不足'],
        publishedAt:now-310*D,endedAt:now-300*D,ops:[op('publish',now-310*D,'FP-26081907','D61'),op('unfreeze',now-300*D,'FP-26081907','D62')]},
      {id:'FP-26081907-02',project:'FP-26081907',round:2,amount:340000,status:'funded',publishedAt:now-292*D,
        ops:[op('publish',now-292*D,'FP-26081907','D71'),op('release',now-288*D,'FP-26081907','D72')]},
      {id:'FP-26071503-01',project:'FP-26071503',round:1,amount:200000,status:'ended',endReason:['Project closed','项目关闭'],
        publishedAt:now-88*D,endedAt:now-30*D,ops:[op('publish',now-88*D,'FP-26071503','D81'),op('unfreeze',now-30*D,'FP-26071503','D82')]},
      {id:'FP-26100106-01',project:'FP-26100106',round:1,amount:600000,status:'funded',publishedAt:now-9*D,
        ops:[op('publish',now-9*D,'FP-26100106','D91'),op('release',now-2*H,'FP-26100106','D92')]}
    ].map(d=>Object.assign({chain:null,chainUnknown:false,endReason:null,endedAt:null,startedAt:d.publishedAt?d.publishedAt-4*M:null,receive:recv(d.project)},d));

    /* ---------------------------------------------------------------- 报价 */
    const FUND={F1:addr('F1L0'),F2:addr('F2L0'),F3:addr('F3L0')};
    let qn=0;
    const Q=(demand,o)=>{qn++;const d=demands.find(x=>x.id===demand),at=o.quotedAt===undefined?now-(o.age||1)*D:o.quotedAt;
      const fx=o.ccy==='USDC'?.9998:1,amount=o.amount||d.amount;
      const q=Object.assign({id:at?seq('FD',at,qn):null,demand,project:d.project,funder:'F1',amount,ccy:'USDT',fx,settle:r2(amount*fx),rate:.08,
        repayType:REPAY,finalDate:day((at||now)+180*D),status:'pending',lending:false,quotedAt:at,signedAt:(at||now)-5*M,lockedUntil:null,
        rejectAt:null,rejectReason:null,expireAt:null,auth:'authorized'},o);
      q.fx=fx;q.settle=r2(amount*fx);q.loanAddr=FUND[q.funder];q.repayAddr=addr(q.funder+'R0');delete q.age;return q;};
    const quotes=[
      Q('FP-26082804-01',{age:115,funder:'F2',rate:.095,status:'rejected',rejectAt:now-112*D,rejectReason:['Rate above our internal budget for this round.','利率高于本轮内部预算。'],auth:'revoked'}),
      Q('FP-26082804-02',{age:99,funder:'F3',rate:.09,status:'rejected',rejectAt:now-97*D,rejectReason:['Settlement currency does not match our treasury plan.','结算币种与资金计划不一致。'],auth:'revoked'}),
      Q('FP-26082804-02',{age:97,funder:'F2',ccy:'USDC',rate:.08,status:'accepted',lockedUntil:now-95*D,finalDate:today+84*D,auth:'used'}),
      Q('FP-26090107-01',{age:30,funder:'F1',rate:.085,status:'pending'}),
      Q('FP-26090107-01',{quotedAt:null,signedAt:now-14*M,funder:'F3',rate:.082,status:'confirming',auth:'processing'}),
      Q('FP-26091502-01',{age:20,funder:'F2',ccy:'USDC',rate:.078,status:'pending',lending:true}),
      Q('FP-26080512-01',{age:372,funder:'F1',rate:.072,status:'accepted',lockedUntil:now-371*D,finalDate:today-9*D,auth:'used'}),
      Q('FP-26081907-01',{age:305,funder:'F3',rate:.088,status:'expired',expireAt:now-300*D,auth:'revoked'}),
      Q('FP-26081907-02',{age:289,funder:'F1',rate:.083,status:'accepted',lockedUntil:now-288*D,finalDate:today-14*D,auth:'used'}),
      Q('FP-26071503-01',{age:70,funder:'F2',rate:.09,status:'rejected',rejectAt:now-66*D,rejectReason:['Quote amount and term no longer needed.','暂不需要该笔融资。'],auth:null}),
      Q('FP-26100106-01',{age:7,funder:'F3',ccy:'USDC',rate:.081,status:'accepted',lockedUntil:now-2*H,auth:'used'}),
      Q('FP-26090107-01',{age:33,funder:'F2',rate:.092,status:'rejected',rejectAt:now-31*D,rejectReason:['Rate is higher than the other quote.','利率高于其他报价。'],auth:'revoked'})
    ];
    quotes.forEach(q=>{if(q.status==='expired')q.expireReason=demands.find(d=>d.id===q.demand).endReason;});

    /* ---------------------------------------------------------------- 放款 */
    let ln=0;
    const loans=quotes.filter(q=>q.status==='accepted').map(q=>{ln++;const at=q.lockedUntil;
      return {id:seq('LN',at,ln),quote:q.id,demand:q.demand,project:q.project,funder:q.funder,amount:q.amount,ccy:q.ccy,disbursed:q.settle,
        fx:q.fx,rate:q.rate,at,valueDate:day(at)+D,finalDate:q.finalDate,
        addrs:{loan:q.loanAddr,receive:addr('AR'+q.project.slice(-2)),repay:q.repayAddr},tx:hash('LN'+ln),
        status:'repaying',overdue:false,outstanding:q.amount,repaid:0,settledAt:null,planReady:true};});
    const loanOf=p=>loans.find(l=>l.project===p);
    loanOf('FP-26100106').planReady=false;loanOf('FP-26100106').valueDate=null;

    /* ---------------------------------------------------------------- 还款期次 */
    const periods=[];let rn=0,rm=0;
    function plan(loan,n,spec){
      let from=loan.valueDate;
      for(let i=1;i<=n;i++){
        rn++;const due=i===n?day(loan.finalDate):from+91*D,days=Math.round((due-from)/D);
        const interest=r2(loan.amount*loan.rate*days/365),principal=i===n?loan.amount:0,sum=r2(principal+interest);
        const s=Object.assign({status:'pending',overdueDays:0,nature:null,settledAt:null,submitAt:null,unknown:false},spec[i-1]||{});
        const p=Object.assign({id:seq('RP',loan.valueDate,rn),loan:loan.id,seq:i,total:n,due,from,to:due,days,principal,interest,sum,
          settle:r2(sum*loan.fx),ccy:loan.ccy,record:null},s);
        if(p.status==='confirming')p.submitTx=hash('RS'+rn);
        if(p.status==='settled'){
          rm++;const at=p.settledAt;
          p.record={id:seq('RM',at,rm),ccy:loan.ccy,amount:p.settle,at:at-4*M,from:addr('PAY'+loan.project.slice(-2)),to:loan.addrs.repay,tx:hash('RM'+rm),authTx:hash('RA'+rm)};
        }
        periods.push(p);from=due;
      }
    }
    /* 期次的日期与状态是演示用的固定组合，用来覆盖待还款、逾期、还款上链确认中与已结清。 */
    const L1=loanOf('FP-26082804'),L2=loanOf('FP-26080512'),L3=loanOf('FP-26081907');
    plan(L1,2,[{status:'confirming',overdueDays:3,submitAt:now-47*M}]);
    plan(L2,4,[{status:'settled',settledAt:today-279*D+2*H,nature:'normal'},{status:'settled',settledAt:today-186*D+5*H,overdueDays:2,nature:'overdue'},
      {status:'settled',settledAt:today-97*D+3*H,nature:'normal'},{status:'settled',settledAt:today-9*D+6*H,nature:'normal'}]);
    plan(L3,3,[{status:'settled',settledAt:today-196*D+4*H,nature:'normal'},{status:'settled',settledAt:today-105*D+1*H,nature:'normal'},{status:'pending',overdueDays:14}]);
    loans.forEach(l=>{
      const own=periods.filter(p=>p.loan===l.id),done=own.filter(p=>p.status==='settled');
      l.repaid=r2(done.reduce((s,p)=>s+p.sum,0));
      l.outstanding=done.some(p=>p.principal>0)?0:l.amount;
      l.overdue=own.some(p=>p.status!=='settled'&&p.overdueDays>0);
      if(own.length&&done.length===own.length){l.status='settled';l.settledAt=own[own.length-1].settledAt;}
    });
    return {now,projects,pledges,demands,quotes,loans,periods,
      owners:{A:['Demo Asset A','示例资产企业 A'],B:['Demo Asset B','示例资产企业 B'],C:['Demo Asset C','示例资产企业 C']},
      funders:{F1:['Demo Funder 1','示例资金机构 甲'],F2:['Demo Funder 2','示例资金机构 乙'],F3:['Demo Funder 3','示例资金机构 丙']},
      tokenTypes:[TOKEN,TOKEN_B]};
  };
})(window.CF=window.CF||{});
