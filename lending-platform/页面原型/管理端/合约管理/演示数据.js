/* Demonstration fixtures only. No wallet, signature, deployment or notification service is contacted.
   链路：资产方在面客端创建融资项目并提交审核 → 运营核对创建信息 → 通过即由平台统一钱包发起
   质押合约部署 → 部署成功就是审核通过。签名或部署失败不是结论，项目回到待审核由管理人员再次发起。 */
(function(CF){
  const LIN=['Demo reviewer Lin','示例审核员林'];
  const CHEN=['Demo reviewer Chen','示例审核员陈'];
  const HOLDER=['Asset holder','资产方'],SYSTEM=['System','系统'];
  const addr=tail=>'0xDEMO'+'0'.repeat(32)+tail;          // 42 字符，演示地址
  const proof=tail=>'0xDEMO'+'0'.repeat(58)+tail;         // 66 字符，演示链上凭证
  /* 平台统一钱包：取值在代码层面维护、随版本发布，平台内没有维护、配置或切换入口。 */
  const WALLET=addr('W001');
  const TOKEN='ERC-20-应收账款';                            // 代币类型本期只有一个取值

  const REASON_TERM=['The project term filled in does not match the tenor of the receivables described in the project name. Adjust the project term or the project name so that the two agree, then resubmit.','填写的项目期限与项目名称中描述的底层应收账款账期不一致，请调整项目期限或项目名称后重新提交。'];
  const REASON_CCY=['The preferred settlement currency selected at creation is inconsistent with the currency stated in the project name. Confirm the intended currency and resubmit.','创建时选择的参考结算币种与项目名称中写明的币种不一致，请确认后重新提交。'];
  const REASON_SPV=['The SPV name shown on the project does not match the entity recorded for this asset holder. Verify the entity and resubmit.','项目带出的 SPV 机构名称与该资产方登记的主体不一致，请核实主体后重新提交。'];
  const REASON_NAME=['The project name still does not state the underlying receivable range clearly enough for the review. Complete the project name and resubmit.','项目名称仍未清楚说明底层应收账款的范围，不足以支撑本次核对，请补充完整后重新提交。'];
  const REASON_RATIO=['The project pledge ratio filled in exceeds the maximum pledge ratio configured for this token type at the time of creation. Lower the ratio and resubmit.','填写的项目质押率高于创建时该代币类型的最高质押率，请调低后重新提交。'];
  const FAIL_GAS=['The deployment transaction was rejected on chain: the gas fee carried by this transaction is below what the current network conditions require.','部署交易在链上被拒绝：本次交易携带的 gas 费用低于当前网络条件的要求。'];

  CF.contractSeed=function(){
    const now=Date.now(),MIN=60000,H=3600000,D=24*H;
    const rows=[];
    let eventSeq=0;
    const ev=(at,kind,title,result,actor,extra)=>Object.assign(
      {id:'demo-ev-'+(++eventSeq),at,kind,title,result,actor},extra||{});

    function add(o){
      const n=String(rows.length+1).padStart(3,'0');
      rows.push(Object.assign({
        id:'DEMO-FP-'+n,key:n,owner:'A',entity:'DEMO-ENTITY-A',
        tokenType:TOKEN,ratio:0.65,termMonths:9,settleCcy:'USD',spv:'DEMO-SPV-01',
        createdAt:now-30*D,submittedAt:now-6*H,seq:1,
        review:'pending',deploy:'none',closed:false,
        reviewer:null,decisionAt:null,returnReason:'',
        contract:null,fail:null,events:[]
      },o));
    }

    /* 001 待审核、尚未发起部署：通过并部署 / 退回两条办理路径的主样例。 */
    add({key:'01',submittedAt:now-6*H,createdAt:now-7*H,
      events:[ev(now-6*H,'submit',['Submitted for review','提交审核'],['Project pending review · submission 1','项目待审核 · 第 1 次提交'],HOLDER,
        {text:['The asset holder created the project and submitted it for review. No fee and no on-chain action at this point.','资产方创建融资项目并提交审核，本阶段零费用、无链上动作。']})]});

    /* 002 部署失败：审核轴回到待审核，由有处置权限的管理人员再次发起，不通知资产方。 */
    add({key:'02',ratio:0.60,termMonths:6,submittedAt:now-30*H,createdAt:now-31*H,
      deploy:'failed',fail:{reason:FAIL_GAS,at:now-20*H,gas:0.0132,gasCcy:'ETH'},
      contract:{address:null,startedAt:now-21*H,at:null,proof:proof('021'),gas:0.0132,gasCcy:'ETH',from:WALLET},
      events:[
        ev(now-30*H,'submit',['Submitted for review','提交审核'],['Project pending review · submission 1','项目待审核 · 第 1 次提交'],HOLDER),
        ev(now-21*H,'approve-init',['Approved · deployment initiated','审核通过 · 已发起部署'],['Pending review → Deployment in progress','待审核 → 部署处理中'],LIN,
          {text:['Submitted by the reviewer. The platform wallet initiates the deployment and the operations side bears the gas.','审核人提交通过，由平台统一钱包发起部署，gas 由管理端承担。']}),
        ev(now-20*H,'deploy-fail',['Deployment failed','部署失败'],['Deployment in progress → Pending review','部署处理中 → 待审核'],SYSTEM,
          {chain:true,gas:0.0132,gasCcy:'ETH',proof:proof('021'),text:FAIL_GAS,
           next:['No conclusion was formed. The asset holder is not notified and still sees the project as pending review.','未形成结论，不通知资产方，面客侧仍显示项目待审核。']})]});

    /* 003 已退回：面客可读原因全文保留，资产方可修改后重新提交。 */
    add({key:'03',owner:'B',entity:'DEMO-ENTITY-B',ratio:0.70,termMonths:12,settleCcy:'USDT',
      submittedAt:now-3*D,createdAt:now-3*D-2*H,review:'returned',reviewer:CHEN,decisionAt:now-2*D,
      returnReason:REASON_TERM,
      events:[
        ev(now-3*D,'submit',['Submitted for review','提交审核'],['Project pending review · submission 1','项目待审核 · 第 1 次提交'],HOLDER),
        ev(now-2*D,'return',['Returned for revision','审核退回'],['Pending review → Returned','待审核 → 已退回'],CHEN,
          {text:REASON_TERM,notice:['Project review returned','项目审核退回'],
           next:['No contract was deployed and no gas was spent. The project term is not restarted when the asset holder resubmits.','未部署合约、未消耗 gas；资产方重新提交时项目期限不重新起算。']})]});

    /* 004 退回后重提并最终通过：审核历史累积，既往退回原因不被覆盖。结论在近 7 日之外。 */
    add({key:'04',ratio:0.55,termMonths:6,createdAt:now-12*D-3*H,submittedAt:now-9*D,seq:2,
      review:'approved',deploy:'success',reviewer:LIN,decisionAt:now-8*D,
      contract:{address:addr('C004'),startedAt:now-8*D-40*MIN,at:now-8*D,proof:proof('041'),gas:0.0186,gasCcy:'ETH',from:WALLET},
      events:[
        ev(now-12*D,'submit',['Submitted for review','提交审核'],['Project pending review · submission 1','项目待审核 · 第 1 次提交'],HOLDER),
        ev(now-11*D,'return',['Returned for revision','审核退回'],['Pending review → Returned','待审核 → 已退回'],CHEN,
          {text:REASON_CCY,notice:['Project review returned','项目审核退回']}),
        ev(now-9*D,'resubmit',['Resubmitted after revision','资产方修改后重新提交'],['Returned → Pending review · submission 2','已退回 → 待审核 · 第 2 次提交'],HOLDER,
          {text:['Same project number and the same project term start date; resubmission does not create a second project.','项目编号不变、项目期限起算点不变，重新提交不产生第二个项目。']}),
        ev(now-8*D-40*MIN,'approve-init',['Approved · deployment initiated','审核通过 · 已发起部署'],['Pending review → Deployment in progress','待审核 → 部署处理中'],LIN),
        ev(now-8*D,'deploy-ok',['Deployment succeeded · review approved','部署成功 · 审核通过'],['Deployment in progress → Approved','部署处理中 → 已通过'],SYSTEM,
          {chain:true,gas:0.0186,gasCcy:'ETH',proof:proof('041'),address:addr('C004'),
           text:['The pledge contract for this project was deployed. The project is now open and the asset holder can pledge tokens.','本项目质押合约已部署，项目转为可用，资产方可发起代币质押。'],
           notice:['Project review approved','项目审核通过']})]});

    /* 005 部署处理中：尚未形成结论，界面不显示已通过，处置入口不可用。 */
    add({key:'05',owner:'B',entity:'DEMO-ENTITY-B',ratio:0.68,termMonths:12,
      createdAt:now-6*H,submittedAt:now-5*H,review:'deploying',deploy:'processing',
      contract:{address:null,startedAt:now-12*MIN,at:null,proof:proof('051'),gas:null,gasCcy:'ETH',from:WALLET},
      events:[
        ev(now-5*H,'submit',['Submitted for review','提交审核'],['Project pending review · submission 1','项目待审核 · 第 1 次提交'],HOLDER),
        ev(now-12*MIN,'approve-init',['Approved · deployment initiated','审核通过 · 已发起部署'],['Pending review → Deployment in progress','待审核 → 部署处理中'],LIN,
          {chain:true,gas:null,gasCcy:'ETH',proof:proof('051'),
           text:['Awaiting the real on-chain result. No conclusion has been formed and the asset holder has not been notified.','等待真实链上结果。尚未形成结论，也未向资产方发送任何消息。']})]});

    /* 006 结果待核实：不推定成功或失败、不重复发起、不自动改判。 */
    add({key:'06',owner:'C',entity:'DEMO-ENTITY-C',ratio:0.60,termMonths:3,settleCcy:'USDT',
      createdAt:now-4*D-5*H,submittedAt:now-4*D,review:'deploying',deploy:'unknown',
      contract:{address:null,startedAt:now-3*D,at:null,proof:proof('061'),gas:null,gasCcy:'ETH',from:WALLET},
      events:[
        ev(now-4*D,'submit',['Submitted for review','提交审核'],['Project pending review · submission 1','项目待审核 · 第 1 次提交'],HOLDER),
        ev(now-3*D,'approve-init',['Approved · deployment initiated','审核通过 · 已发起部署'],['Pending review → Deployment in progress','待审核 → 部署处理中'],CHEN),
        ev(now-2*D,'deploy-unknown',['Deployment result to be verified','部署结果待核实'],['No confirmed on-chain result','尚无确定的链上结果'],SYSTEM,
          {chain:true,gas:null,gasCcy:'ETH',proof:proof('061'),
           text:['No confirmed result has been received for this deployment. The known evidence is kept as is; the result is not assumed to be a success or a failure.','本次部署尚未收到确定结果，已知链上凭证原样保留，不推定为成功或失败。'],
           next:['Contact the platform provider to check the chain and the configuration. The platform does not retry, re-judge or roll back on its own.','请联系平台建设方核实链上与配置；平台不自动重试、不自动改判、不自动回滚。']})]});

    /* 007 第 3 次提交，创建时锁定的质押率高于当前配置上限：并列展示差异，不自动拦截、不自动退回。 */
    add({key:'07',ratio:0.75,termMonths:12,createdAt:now-22*D,submittedAt:now-2*H,seq:3,
      events:[
        ev(now-22*D,'submit',['Submitted for review','提交审核'],['Project pending review · submission 1','项目待审核 · 第 1 次提交'],HOLDER),
        ev(now-20*D,'return',['Returned for revision','审核退回'],['Pending review → Returned','待审核 → 已退回'],LIN,
          {text:REASON_SPV,notice:['Project review returned','项目审核退回']}),
        ev(now-18*D,'resubmit',['Resubmitted after revision','资产方修改后重新提交'],['Returned → Pending review · submission 2','已退回 → 待审核 · 第 2 次提交'],HOLDER),
        ev(now-16*D,'return',['Returned for revision','审核退回'],['Pending review → Returned','待审核 → 已退回'],CHEN,
          {text:REASON_NAME,notice:['Project review returned','项目审核退回']}),
        ev(now-2*H,'resubmit',['Resubmitted after revision','资产方修改后重新提交'],['Returned → Pending review · submission 3','已退回 → 待审核 · 第 3 次提交'],HOLDER,
          {text:['The project term start date is unchanged; the time spent in review counts towards the project validity.','项目期限起算点不变，审核耗时计入项目有效期。']})]});

    /* 008 资产方在已退回期间主动关闭项目：离开待审队列、不可裁定，历史仍只读可查。 */
    add({key:'08',owner:'B',entity:'DEMO-ENTITY-B',ratio:0.50,termMonths:3,
      createdAt:now-16*D,submittedAt:now-15*D,review:'returned',closed:true,
      reviewer:LIN,decisionAt:now-14*D,returnReason:REASON_RATIO,
      events:[
        ev(now-15*D,'submit',['Submitted for review','提交审核'],['Project pending review · submission 1','项目待审核 · 第 1 次提交'],HOLDER),
        ev(now-14*D,'return',['Returned for revision','审核退回'],['Pending review → Returned','待审核 → 已退回'],LIN,
          {text:REASON_RATIO,notice:['Project review returned','项目审核退回']}),
        ev(now-13*D,'close',['Project closed by the asset holder','资产方关闭项目'],['Returned → Closed','已退回 → 已关闭'],HOLDER,
          {text:['The asset holder closed the project. Operations has no entry to close or reopen a project.','资产方主动关闭项目；运营端没有关闭与恢复入口。']})]});

    /* 009 近 7 日内通过：部署 gas 未提供，标待核实、不填 0。 */
    add({key:'09',owner:'C',entity:'DEMO-ENTITY-C',ratio:0.62,termMonths:12,settleCcy:'USDT',
      createdAt:now-3*D-4*H,submittedAt:now-3*D,review:'approved',deploy:'success',
      reviewer:CHEN,decisionAt:now-2*D,
      contract:{address:addr('C009'),startedAt:now-2*D-25*MIN,at:now-2*D,proof:proof('091'),gas:null,gasCcy:'ETH',from:WALLET},
      events:[
        ev(now-3*D,'submit',['Submitted for review','提交审核'],['Project pending review · submission 1','项目待审核 · 第 1 次提交'],HOLDER),
        ev(now-2*D-25*MIN,'approve-init',['Approved · deployment initiated','审核通过 · 已发起部署'],['Pending review → Deployment in progress','待审核 → 部署处理中'],CHEN),
        ev(now-2*D,'deploy-ok',['Deployment succeeded · review approved','部署成功 · 审核通过'],['Deployment in progress → Approved','部署处理中 → 已通过'],SYSTEM,
          {chain:true,gas:null,gasCcy:'ETH',proof:proof('091'),address:addr('C009'),
           text:['The pledge contract for this project was deployed. The actual gas has not been reported back yet.','本项目质押合约已部署，实际 gas 尚未回写。'],
           notice:['Project review approved','项目审核通过']})]});

    /* 010 资产方稳定主体标识缺失：标待核实、不放行，不以企业名称替代归属判定。 */
    add({key:'10',owner:'C',entity:null,ratio:0.66,termMonths:6,
      createdAt:now-9*H,submittedAt:now-8*H,
      events:[ev(now-8*H,'submit',['Submitted for review','提交审核'],['Project pending review · submission 1','项目待审核 · 第 1 次提交'],HOLDER)]});

    /* 011 更早通过的项目：台账按部署时点倒序时排在末位。 */
    add({key:'11',owner:'B',entity:'DEMO-ENTITY-B',ratio:0.58,termMonths:9,
      createdAt:now-24*D,submittedAt:now-22*D,review:'approved',deploy:'success',
      reviewer:LIN,decisionAt:now-20*D,
      contract:{address:addr('C011'),startedAt:now-20*D-35*MIN,at:now-20*D,proof:proof('111'),gas:0.0207,gasCcy:'ETH',from:WALLET},
      events:[
        ev(now-22*D,'submit',['Submitted for review','提交审核'],['Project pending review · submission 1','项目待审核 · 第 1 次提交'],HOLDER),
        ev(now-20*D-35*MIN,'approve-init',['Approved · deployment initiated','审核通过 · 已发起部署'],['Pending review → Deployment in progress','待审核 → 部署处理中'],LIN),
        ev(now-20*D,'deploy-ok',['Deployment succeeded · review approved','部署成功 · 审核通过'],['Deployment in progress → Approved','部署处理中 → 已通过'],SYSTEM,
          {chain:true,gas:0.0207,gasCcy:'ETH',proof:proof('111'),address:addr('C011'),
           notice:['Project review approved','项目审核通过']})]});

    return {
      rows,now,wallet:WALLET,tokenType:TOKEN,
      /* 融资参数配置的当前值只读引用，供背景参考；本模块不配置、不调整。 */
      config:{tokenType:TOKEN,maxRatio:0.70,maxTermMonths:12,readAt:now-3*MIN,available:true}
    };
  };
})(window.CF=window.CF||{});
