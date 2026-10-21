/* Demonstration fixtures only. No chain, configuration or notification service is contacted.
   链路：资产方创建融资项目并提交审核 → 运营核对创建信息 → 通过时按项目的「代币类型＋区块链网络」
   选定该组合共用的质押、放款、还款三份合约并确认提交 → 平台在链上为本项目执行配置，三份都成功即审核通过。
   配置失败不是结论，项目回到待审核，可再次发起或退回。运营人员不连接钱包、不签名。 */
(function(CF){
  const LIN=['Demo reviewer Lin','示例审核员林'];
  const CHEN=['Demo reviewer Chen','示例审核员陈'];
  const HOLDER=['Asset holder','资产方'],SYSTEM=['System','系统'];
  const addr=tail=>'0xDEMO'+'0'.repeat(32)+tail;          // 42 字符，演示地址
  const proof=tail=>'0xDEMO'+'0'.repeat(58)+tail;         // 66 字符，演示链上凭证
  const TOKEN='ERC-20-应收账款';
  const TOKEN_B='ERC-20-演示类型B';                        // 演示用第二个代币类型，用于缺合约的组合

  /* 共用合约：每个「代币类型＋区块链网络」一套，由开发人员在代码层面维护；运营端只读、只选用。
     组合 B 在代码中只提供了质押合约，放款与还款合约暂无。 */
  const SETS=[
    {id:'SET-A',tokenType:TOKEN,network:'eth',pledge:addr('A0P1'),loan:addr('A0L1'),repay:addr('A0R1')},
    {id:'SET-B',tokenType:TOKEN_B,network:'eth',pledge:addr('B0P1'),loan:null,repay:null}
  ];
  const A=SETS[0];
  const picksA={pledge:A.pledge,loan:A.loan,repay:A.repay};
  const proofs=t=>({pledge:proof(t+'1'),loan:proof(t+'2'),repay:proof(t+'3')});

  const REASON_TERM=['The project term filled in does not match the tenor of the receivables described in the project name. Adjust the project term or the project name so that the two agree, then resubmit.','填写的项目期限与项目名称中描述的底层应收账款账期不一致，请调整项目期限或项目名称后重新提交。'];
  const REASON_CCY=['The preferred settlement currency selected at creation is inconsistent with the currency stated in the project name. Confirm the intended currency and resubmit.','创建时选择的参考结算币种与项目名称中写明的币种不一致，请确认后重新提交。'];
  const REASON_SPV=['The SPV name shown on the project does not match the entity recorded for this asset holder. Verify the entity and resubmit.','项目带出的 SPV 机构名称与该资产方登记的主体不一致，请核实主体后重新提交。'];
  const REASON_NAME=['The project name still does not state the underlying receivable range clearly enough for the review. Complete the project name and resubmit.','项目名称仍未清楚说明底层应收账款的范围，不足以支撑本次核对，请补充完整后重新提交。'];
  const REASON_RATIO=['The project pledge ratio filled in exceeds the maximum pledge ratio configured for this token type at the time of creation. Lower the ratio and resubmit.','填写的项目质押率高于创建时该代币类型的最高质押率，请调低后重新提交。'];
  const FAIL_LOAN=['The configuration transaction for the loan contract was reverted on chain.','放款合约的配置交易在链上执行失败（交易回滚）。'];

  CF.contractSeed=function(){
    const now=Date.now(),MIN=60000,H=3600000,D=24*H;
    const rows=[];
    let eventSeq=0;
    const ev=(at,kind,title,result,actor,extra)=>Object.assign(
      {id:'demo-ev-'+(++eventSeq),at,kind,title,result,actor},extra||{});
    const submit=(at,n)=>ev(at,'submit',['Submitted for review','提交审核'],['Project pending review · submission '+n,'项目待审核 · 第 '+n+' 次提交'],HOLDER);
    const init=(at,actor,tail)=>ev(at,'approve-init',['Approval submitted · configuration initiated','提交通过并发起配置'],['Pending review → Configuration in progress','待审核 → 配置处理中'],actor,
      {picks:picksA,proofs:tail?proofs(tail):null});
    const ok=(at,tail)=>ev(at,'config-ok',['Configuration succeeded (review approved)','配置成功（即审核通过）'],['Configuration in progress → Approved','配置处理中 → 已通过'],SYSTEM,
      {picks:picksA,proofs:proofs(tail),notice:['Project review approved','项目审核通过']});
    const ret=(at,actor,reason)=>ev(at,'return',['Returned','审核退回'],['Pending review → Returned','待审核 → 已退回'],actor,
      {text:reason,notice:['Project review returned','项目审核退回']});
    const resub=(at,n)=>ev(at,'resubmit',['Resubmitted after revision','资产方修改重提'],['Returned → Pending review · submission '+n,'已退回 → 待审核 · 第 '+n+' 次提交'],HOLDER);

    /* termMonths 只用于生成演示到期日；界面按「生效日～到期日」呈现项目期限。 */
    function add(o){
      const n=String(rows.length+1).padStart(3,'0');
      rows.push(Object.assign({
        id:'DEMO-FP-'+n,key:n,owner:'A',entity:'DEMO-ENTITY-A',
        tokenType:TOKEN,network:'eth',ratio:0.65,termMonths:9,settleCcy:'USD',spv:'DEMO-SPV-01',
        createdAt:now-30*D,submittedAt:now-6*H,seq:1,
        review:'pending',exec:'none',closed:false,
        reviewer:null,submitter:null,decisionAt:null,returnReason:'',
        attempt:null,fail:null,events:[]
      },o));
    }

    /* 001 待审核、未发起配置：通过并配置合约 / 退回的主样例。 */
    add({key:'01',submittedAt:now-6*H,createdAt:now-7*H,events:[submit(now-6*H,1)]});

    /* 002 配置失败：一份失败即整体失败，回到待审核，可再次发起或退回，不通知资产方。 */
    add({key:'02',ratio:0.60,termMonths:6,submittedAt:now-30*H,createdAt:now-31*H,
      exec:'failed',submitter:LIN,
      attempt:{set:'SET-A',picks:picksA,startedAt:now-21*H,at:null,proofs:{pledge:proof('0211'),loan:proof('0212'),repay:null}},
      fail:{reason:FAIL_LOAN,at:now-20*H,results:{pledge:'success',loan:'failed',repay:'unknown'}},
      events:[
        submit(now-30*H,1),
        ev(now-21*H,'approve-init',['Approval submitted · configuration initiated','提交通过并发起配置'],['Pending review → Configuration in progress','待审核 → 配置处理中'],LIN,{picks:picksA}),
        ev(now-20*H,'config-fail',['Configuration failed','配置失败'],['Configuration in progress → Pending review','配置处理中 → 待审核'],SYSTEM,
          {picks:picksA,proofs:{pledge:proof('0211'),loan:proof('0212'),repay:null},results:{pledge:'success',loan:'failed',repay:'unknown'},text:FAIL_LOAN})]});

    /* 003 已退回：原因全文保留，资产方可修改重提。 */
    add({key:'03',owner:'B',entity:'DEMO-ENTITY-B',ratio:0.70,termMonths:12,settleCcy:'USDT',
      submittedAt:now-3*D,createdAt:now-3*D-2*H,review:'returned',reviewer:CHEN,decisionAt:now-2*D,
      returnReason:REASON_TERM,events:[submit(now-3*D,1),ret(now-2*D,CHEN,REASON_TERM)]});

    /* 004 退回后重提并配置成功：与 009、011 配置在同一套合约上。结论在近 7 日之外。 */
    add({key:'04',ratio:0.55,termMonths:6,createdAt:now-12*D-3*H,submittedAt:now-9*D,seq:2,
      review:'approved',exec:'success',reviewer:LIN,submitter:LIN,decisionAt:now-8*D,
      attempt:{set:'SET-A',picks:picksA,startedAt:now-8*D-40*MIN,at:now-8*D,proofs:proofs('041')},
      events:[
        submit(now-12*D,1),ret(now-11*D,CHEN,REASON_CCY),resub(now-9*D,2),
        init(now-8*D-40*MIN,LIN),ok(now-8*D,'041')]});

    /* 005 配置处理中：尚无结论，界面不显示已通过，处置入口不可用。 */
    add({key:'05',owner:'B',entity:'DEMO-ENTITY-B',ratio:0.68,termMonths:12,
      createdAt:now-6*H,submittedAt:now-5*H,review:'configuring',exec:'processing',submitter:LIN,
      attempt:{set:'SET-A',picks:picksA,startedAt:now-12*MIN,at:null,proofs:{pledge:proof('0511'),loan:null,repay:null}},
      events:[submit(now-5*H,1),
        ev(now-12*MIN,'approve-init',['Approval submitted · configuration initiated','提交通过并发起配置'],['Pending review → Configuration in progress','待审核 → 配置处理中'],LIN,
          {picks:picksA,proofs:{pledge:proof('0511'),loan:null,repay:null}})]});

    /* 006 结果待核实：不推定成功或失败、不重复发起、不自动改判。 */
    add({key:'06',owner:'C',entity:'DEMO-ENTITY-C',ratio:0.60,termMonths:3,settleCcy:'USDT',
      createdAt:now-4*D-5*H,submittedAt:now-4*D,review:'configuring',exec:'unknown',submitter:CHEN,
      attempt:{set:'SET-A',picks:picksA,startedAt:now-3*D,at:null,proofs:{pledge:proof('0611'),loan:proof('0612'),repay:null}},
      events:[submit(now-4*D,1),init(now-3*D,CHEN),
        ev(now-2*D,'config-unknown',['Configuration result to be verified','结果待核实'],['No confirmed on-chain result','尚无确定的链上结果'],SYSTEM,
          {picks:picksA,proofs:{pledge:proof('0611'),loan:proof('0612'),repay:null}})]});

    /* 007 第 3 次提交，最近一次提交的质押率高于当前配置上限：并列展示差异，不拦截。 */
    add({key:'07',ratio:0.75,termMonths:12,createdAt:now-22*D,submittedAt:now-2*H,seq:3,
      events:[submit(now-22*D,1),ret(now-20*D,LIN,REASON_SPV),resub(now-18*D,2),ret(now-16*D,CHEN,REASON_NAME),resub(now-2*H,3)]});

    /* 008 已退回期间资产方主动关闭：离开默认队列、不可裁定，只读回看。 */
    add({key:'08',owner:'B',entity:'DEMO-ENTITY-B',ratio:0.50,termMonths:3,
      createdAt:now-16*D,submittedAt:now-15*D,review:'returned',closed:true,closeReason:'owner',
      reviewer:LIN,decisionAt:now-14*D,returnReason:REASON_RATIO,
      events:[submit(now-15*D,1),ret(now-14*D,LIN,REASON_RATIO),
        ev(now-13*D,'close',['Project closed by the asset holder','资产方关闭项目'],['Returned · project closed','已退回 · 项目已关闭'],HOLDER)]});

    /* 009 近 7 日内配置成功，另一家企业，共用同一套合约。还款合约凭证未回写，标待核实。 */
    add({key:'09',owner:'C',entity:'DEMO-ENTITY-C',ratio:0.62,termMonths:12,settleCcy:'USDT',
      createdAt:now-3*D-4*H,submittedAt:now-3*D,review:'approved',exec:'success',
      reviewer:CHEN,submitter:CHEN,decisionAt:now-2*D,
      attempt:{set:'SET-A',picks:picksA,startedAt:now-2*D-25*MIN,at:now-2*D,proofs:{...proofs('091'),repay:null}},
      events:[submit(now-3*D,1),init(now-2*D-25*MIN,CHEN),
        Object.assign(ok(now-2*D,'091'),{proofs:{...proofs('091'),repay:null}})]});

    /* 010 资产方稳定主体标识缺失：标待核实、不能通过，可退回。 */
    add({key:'10',owner:'C',entity:null,ratio:0.66,termMonths:6,
      createdAt:now-9*H,submittedAt:now-8*H,events:[submit(now-8*H,1)]});

    /* 011 更早配置成功：台账已配置项目按完成时间倒序时排在末位。 */
    add({key:'11',owner:'B',entity:'DEMO-ENTITY-B',ratio:0.58,termMonths:9,
      createdAt:now-24*D,submittedAt:now-22*D,review:'approved',exec:'success',
      reviewer:LIN,submitter:LIN,decisionAt:now-20*D,
      attempt:{set:'SET-A',picks:picksA,startedAt:now-20*D-35*MIN,at:now-20*D,proofs:proofs('111')},
      events:[submit(now-22*D,1),init(now-20*D-35*MIN,LIN),ok(now-20*D,'111')]});

    /* 012 已退回后未重提，到达有效期至自动关闭。 */
    {const created=now-100*D,exp=(()=>{const d=new Date(created);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+3,d.getUTCDate());})();
    add({key:'12',owner:'A',ratio:0.60,termMonths:3,createdAt:created,submittedAt:created+H,
      review:'returned',closed:true,closeReason:'expired',reviewer:CHEN,decisionAt:created+3*D,returnReason:REASON_NAME,
      events:[submit(created+H,1),ret(created+3*D,CHEN,REASON_NAME),
        ev(exp,'expire-close',['Project closed on expiry','项目到期自动关闭'],['Returned · project closed','已退回 · 项目已关闭'],SYSTEM)]});}

    /* 013 适用组合 B：代码中缺放款合约与还款合约，不能通过，可退回或稍后办理。 */
    add({key:'13',owner:'A',tokenType:TOKEN_B,ratio:0.55,termMonths:6,
      createdAt:now-26*H,submittedAt:now-25*H,events:[submit(now-25*H,1)]});

    return {
      rows,now,sets:SETS,tokenTypes:[TOKEN,TOKEN_B],
      /* 融资参数配置的当前值只读引用，供背景参考；本模块不配置、不调整。 */
      config:{byToken:{[TOKEN]:{maxRatio:0.70,maxTermMonths:12},[TOKEN_B]:{maxRatio:0.60,maxTermMonths:6}},readAt:now-3*MIN,available:true}
    };
  };
})(window.CF=window.CF||{});
