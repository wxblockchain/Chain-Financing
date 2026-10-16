/* Demonstration fixtures only. No requests, signatures, transfers or real business data.
   链路：资产方以持有地址签名把代币转入质押合约 → 上链成功才形成一笔待审申请 →
   运营逐张审核（无时效）→ 驳回或待审撤回后由资产方自助解押。
   一张＝本企业一个持有地址上某笔代币的全部数量（质押份额）；同一提交批次的份额来自同一持有地址。 */
(function(CF){
  const OPERATOR_LIN=['Demo operator Lin','示例审核员林'];
  const OPERATOR_CHEN=['Demo operator Chen','示例审核员陈'];
  const HOLDER=['Asset holder','资产方'],SYSTEM=['System','系统'];
  const addr=tail=>'0xDEMO'+'0'.repeat(32)+tail;              // 42 字符，演示地址
  const proof=tail=>'0xDEMO'+'0'.repeat(58)+tail;             // 66 字符，演示链上凭证

  const WALLET='0xDEMO'+'0'.repeat(32)+'W001';   // 平台统一钱包（代码层面写死，演示取值）
  CF.pledgeSeed=function(){
    const now=Date.now(),H=3600000,D=24*H;
    const rows=[];
    /* 每笔＝一张代币的一次质押申请。follow 为本笔当前去向（PA-15），flag 为并列事实标记。 */
    function add(o){
      const n=String(rows.length+1).padStart(3,'0');
      rows.push(Object.assign({
        id:'DEMO-PR-'+n,token:'DEMO-TK-'+n,batch:'PA-DEMO-001',owner:'A',project:'01',type:'first',
        value:180000,tokenCcy:'DEMOTK',term:90,buyer:'DEMO-BUYER-1',valid:true,
        chain:'ETH',contract:addr('C001'),holder:null,proof:proof(n+'1'),gas:0.0021,gasCcy:'ETH',
        onchainAt:now-6*H,status:'pending',follow:'pending',flag:'',
        decisionAt:null,operator:null,reviewId:null,reason:'',category:'',remark:'',files:[],snapshot:null,
        effective:true,excluded:null,source:null,release:null,previous:null
      },o));
      return rows[rows.length-1];
    }
    const agreement=()=>[{id:'demo-agreement',name:'Demo-pledge-agreement.pdf',sample:true,state:'ready'}];

    /* 同一批次的 A / B / C：通过、驳回、待审三种结论并存（AC-PR-55）。 */
    add({token:'DEMO-TK-001',onchainAt:now-30*H,status:'approved',follow:'effective',decisionAt:now-4*H,
      operator:OPERATOR_LIN,files:agreement(),snapshot:180000,proof:proof('011')});
    add({token:'DEMO-TK-002',onchainAt:now-30*H,status:'rejected',follow:'awaiting-release',decisionAt:now-3*H,
      operator:OPERATOR_CHEN,category:'3',value:96000,snapshot:96000,proof:proof('021'),
      reason:'本笔代币对应的应收账款缺少买方确认件，与申请材料记载的账期不一致，请补齐后重新发起质押。'});
    add({token:'DEMO-TK-003',onchainAt:now-12*D,value:240000,proof:proof('031')});

    /* 待审期间资产方自行撤回并解押成功 → 已撤回，无人工结论。 */
    add({token:'DEMO-TK-004',batch:'PA-DEMO-002',type:'add',onchainAt:now-5*D,status:'withdrawn',follow:'released',
      value:150000,proof:proof('041'),
      release:{kind:'withdraw',startedAt:now-4*D,completedAt:now-4*D+900000,gas:0.0018,gasCcy:'ETH',proof:proof('042'),result:'success'}});

    /* 通过但底层资产已失效：审核通过是计入有效质押价值的必要条件而非充分条件（D-PR-15）。 */
    add({token:'DEMO-TK-005',batch:'PA-DEMO-003',owner:'B',project:'02',onchainAt:now-2*D,status:'approved',
      follow:'effective',decisionAt:now-26*H,operator:OPERATOR_LIN,files:agreement(),snapshot:210000,
      value:210000,buyer:'DEMO-BUYER-2',valid:false,effective:false,follow:'excluded',
      excluded:['The token is invalid','代币已失效'],proof:proof('051')});
    /* 驳回后资产方已发起自助解押，尚无结果。 */
    add({token:'DEMO-TK-006',batch:'PA-DEMO-003',owner:'B',project:'02',onchainAt:now-2*D,status:'rejected',
      follow:'releasing',decisionAt:now-25*H,operator:OPERATOR_LIN,category:'0',value:88000,
      snapshot:88000,buyer:'DEMO-BUYER-2',proof:proof('061'),
      reason:'代币持有地址与申请企业的主体归属无法对应，请核实归属后再行发起质押。',
      release:{startedAt:now-2*H,completedAt:null,gas:0.0016,gasCcy:'ETH',proof:null,result:'processing'}});
    /* 驳回后已解押退回，代币已按记录转回质押前原持有地址。 */
    add({token:'DEMO-TK-007',batch:'PA-DEMO-003',owner:'B',project:'02',onchainAt:now-2*D,status:'rejected',
      follow:'released',decisionAt:now-24*H,operator:OPERATOR_CHEN,category:'1',value:132000,
      snapshot:132000,buyer:'DEMO-BUYER-2',proof:proof('071'),
      reason:'底层应收账款的到期日晚于本项目期限，本笔不符合入池条件。',
      release:{startedAt:now-20*H,completedAt:now-19*H,gas:0.0019,gasCcy:'ETH',proof:proof('072'),result:'success'}});
    /* 解押成功后按当前资格重新发起质押：同一张代币、新批次、新单笔标识（D-PR-24）。 */
    add({token:'DEMO-TK-007',batch:'PA-DEMO-010',owner:'B',project:'02',type:'add',onchainAt:now-90*60000,
      value:132000,buyer:'DEMO-BUYER-2',proof:proof('081'),previous:'DEMO-PR-007'});
    /* 解押长期无结果：只保留事实与客服指引，gas 未提供不填 0（D-PR-38）。 */
    add({token:'DEMO-TK-009',batch:'PA-DEMO-004',owner:'B',project:'02',type:'add',onchainAt:now-6*D,
      status:'rejected',follow:'releasing',flag:'verify',decisionAt:now-5*D,operator:OPERATOR_CHEN,category:'3',
      value:175000,snapshot:175000,buyer:'DEMO-BUYER-3',proof:proof('091'),
      reason:'申请材料中的代币编号与本次上链的代币不一致，请核对后重新发起。',
      release:{startedAt:now-4*D,completedAt:null,gas:null,gasCcy:'ETH',proof:null,result:'unknown'}});
    /* 迟到结果与原记录冲突：保留原事实并标记差异，相关张暂停新动作。 */
    add({token:'DEMO-TK-010',batch:'PA-DEMO-004',owner:'B',project:'02',type:'add',onchainAt:now-6*D,
      status:'rejected',follow:'releasing',flag:'difference',decisionAt:now-5*D,operator:OPERATOR_CHEN,
      category:'4',value:119000,snapshot:119000,buyer:'DEMO-BUYER-3',proof:proof('101'),
      reason:'本笔与同项目已质押代币重复，按线下核对结果不予通过。',
      release:{startedAt:now-3*D,completedAt:now-2*D,gas:0.0015,gasCcy:'ETH',proof:proof('102'),result:'failed',
        conflictAt:now-6*H,conflictProof:proof('103')}});
    /* 缺失事实不猜测：代币价值、买方与 gas 标待核实，有效性为已失效。 */
    add({token:'DEMO-TK-011',batch:'PA-DEMO-005',project:'02',type:'add',onchainAt:now-3*D,
      value:null,buyer:null,valid:false,gas:null,proof:proof('111')});

    /* 其余为筛选、排序与分页用的待审与已审样例。 */
    for(let i=12;i<=36;i++){
      const group=Math.floor((i-12)/3)+6,owner=i%2?'B':'A',project=i%3?'01':'02';
      const decided=i%7===0;
      add({token:'DEMO-TK-'+String(i).padStart(3,'0'),batch:'PA-DEMO-'+String(group).padStart(3,'0'),
        owner,project,type:i%4?'add':'first',value:95000+i*4500,
        term:[60,90,120][i%3],buyer:'DEMO-BUYER-'+(i%3+1),onchainAt:now-(2+i)*H,proof:proof(String(i)+'1'),
        status:decided?'approved':'pending',follow:decided?'effective':'pending',
        decisionAt:decided?now-(1+i%5)*H:null,operator:decided?OPERATOR_LIN:null,
        files:decided?agreement():[],snapshot:decided?95000+i*4500:null});
    }

    /* 通过的链上执行（用户 2026-10-16 裁定）：运营连接平台统一钱包签名提交，链上执行成功即审核通过（即解冻成功）。
       一张上次通过未成功、回到可裁定的待审核；一张通过处理中、暂不可裁定，资产方也不能撤回。 */
    add({token:'DEMO-TK-037',batch:'PA-DEMO-020',owner:'A',project:'01',type:'add',onchainAt:now-30*H,value:142000,proof:proof('371'),
      auth:'failed',authDraft:{files:agreement(),remark:''},
      authFail:{at:now-3*H,signedAt:now-4*H,gas:0.0009,gasCcy:'ETH',proof:proof('372'),
        reason:['The approval transaction was rejected on chain: it ran out of gas before it completed.','通过的链上执行被拒绝：交易在完成前 gas 耗尽。']}});
    add({token:'DEMO-TK-038',batch:'PA-DEMO-020',owner:'A',project:'01',type:'add',onchainAt:now-30*H,value:118000,proof:proof('381'),
      auth:'processing',authDraft:{files:agreement(),remark:''},authSignedAt:now-25*60000,authProof:proof('382')});

    /* 同一笔代币在两个持有地址上各算一张，互不合并。 */
    add({token:'DEMO-TK-012',batch:'PA-DEMO-021',owner:'A',project:'02',type:'add',onchainAt:now-8*H,value:61000,
      holder:addr('B021'),proof:proof('391')});
    /* 待审撤回已发起、解押尚无结果：仍是待审核，暂不可裁定（D-PR-40）。 */
    add({token:'DEMO-TK-040',batch:'PA-DEMO-022',owner:'A',project:'01',type:'add',onchainAt:now-20*H,value:99000,
      follow:'releasing',proof:proof('401'),
      release:{kind:'withdraw',startedAt:now-40*60000,completedAt:null,gas:0.0014,gasCcy:'ETH',proof:null,result:'processing'}});
    /* 所属项目 03 已进入终态：仍待审核的张由系统默认不通过（D-PR-41），份额仍须资产方自助解押。 */
    const closedAt=now-2*D;
    const terminalReason=['The project has been closed, so this unreviewed pledge is rejected by default. Project closure reason: closed by the asset holder.',
      '所属项目已关闭，未审核的质押默认不通过。项目关闭原因：资产方主动关闭。'];
    add({token:'DEMO-TK-041',batch:'PA-DEMO-023',owner:'B',project:'03',type:'first',onchainAt:now-9*D,value:128000,
      status:'approved',follow:'effective',decisionAt:now-8*D,operator:OPERATOR_LIN,files:agreement(),snapshot:128000,proof:proof('411')});
    add({token:'DEMO-TK-042',batch:'PA-DEMO-023',owner:'B',project:'03',type:'first',onchainAt:now-9*D,value:87000,
      status:'rejected',source:'terminal',follow:'awaiting-release',decisionAt:closedAt,operator:SYSTEM,reason:terminalReason,proof:proof('421')});
    add({token:'DEMO-TK-043',batch:'PA-DEMO-023',owner:'B',project:'03',type:'first',onchainAt:now-9*D,value:93000,
      status:'rejected',source:'terminal',follow:'releasing',decisionAt:closedAt,operator:SYSTEM,reason:terminalReason,proof:proof('431'),
      release:{kind:'withdraw',startedAt:closedAt-3*H,completedAt:null,gas:0.0013,gasCcy:'ETH',proof:null,result:'processing'}});

    const batchHolder={};
    rows.forEach(r=>{
      /* 同一批次共用一个持有地址；单独指定的保留。 */
      if(!r.holder)r.holder=batchHolder[r.batch]||(batchHolder[r.batch]=addr('H'+r.batch.slice(-3)));
      if(r.decisionAt&&!r.source)r.source='manual';
      /* 数量按代币符号计，与 USD 代币价值是两个量，不互相顶替。 */
      r.amount=r.value==null?null:Math.round(r.value/75);
      if(r.decisionAt)r.reviewId=r.id.replace('PR','RV');
      r.events=[];
      const push=(key,at,title,result,extra)=>r.events.push(Object.assign(
        {id:r.id+':'+key,at,title,result,actor:SYSTEM},extra||{}));

      push('onchain',r.onchainAt,['Pledge on-chain transfer succeeded','质押上链成功'],
        ['Token held in the pledge contract · pending review','代币已在质押合约内 · 待审核'],
        {actor:HOLDER,chain:true,gas:r.gas,gasCcy:r.gasCcy,proof:r.proof,
         text:['The token is counted in the total pledged value and in the pledged pending review, and is not yet counted in the eligible borrowing limit.','该张已计入总质押额与待审质押额，尚未计入有效质押额。']});
      if(r.auth==='failed'){
        push('auth-sign',r.authFail.signedAt,['Approval submitted','提交通过'],['Pending review · approval in progress','待审核 · 通过处理中'],
          {auth:true,actor:OPERATOR_LIN,signer:WALLET,text:['Signed with the platform wallet. The approval stands only once it is executed on chain.','已用平台统一钱包签名提交，链上执行成功才算通过。']});
        push('auth-fail',r.authFail.at,['Approval not completed','通过未成功'],['Approval in progress → Pending review','通过处理中 → 待审核'],
          {auth:true,chain:true,gas:r.authFail.gas,gasCcy:r.authFail.gasCcy,proof:r.authFail.proof,text:r.authFail.reason,
           next:['Not approved and the asset holder is not notified. The agreements and note are kept; submit the approval again or reject instead.','不算通过，不通知资产方；协议与备注已保留，可再次提交通过或改为驳回。']});
      }
      if(r.auth==='processing')push('auth-sign',r.authSignedAt,['Approval submitted','提交通过'],['Pending review · approval in progress','待审核 · 通过处理中'],
        {auth:true,actor:OPERATOR_LIN,signer:WALLET,chain:true,gas:null,gasCcy:'ETH',proof:r.authProof,
         text:['Signed with the platform wallet. The approval stands only once it is executed on chain; the token is not yet counted in the eligible pledged value and no notice is sent.','已用平台统一钱包签名提交。链上执行成功才算通过；本张暂不计入有效质押额，也不发送通知。']});

      if(r.status==='approved')push('review',r.decisionAt,['Approved','审核通过'],
        ['Pending review → Approved','待审核 → 通过'],
        {actor:r.operator,files:r.files.map(f=>({name:f.name})),
         text:r.effective
           ?['Executed on chain, so the share is unfrozen. Moved out of the pledged pending review and counted in the eligible pledged value; the eligible borrowing limit has been recalculated. No platform fee.','链上执行成功（即解冻成功），已从待审质押额转出并计入有效质押价值，有效质押额随之重算；未产生平台费用。']
           :['Moved out of the pledged pending review. The lending platform found the underlying asset invalid, so the token is not counted in the eligible pledged value; the approval stands.','已从待审质押额转出。借贷平台判定底层资产已失效，该张未计入有效质押价值，审核结论仍为通过。']});

      if(r.status==='rejected'&&r.source==='terminal')push('terminal',r.decisionAt,['Rejected by default at project end','项目终态默认不通过'],
        ['Pending review → Rejected','待审核 → 驳回'],
        {actor:SYSTEM,text:r.reason,
         next:['The rejection notice was sent to the asset holder with this reason. The share stays in the pledge contract until the asset holder releases it.','已向资产方发送质押审核驳回通知，原因同上。份额仍在合约内，由资产方自助解押取回。']});
      if(r.status==='rejected'&&r.source!=='terminal')push('review',r.decisionAt,['Rejected','审核驳回'],
        ['Pending review → Rejected','待审核 → 驳回'],
        {actor:r.operator,text:r.reason,
         next:['The token stays in the pledge contract and is counted in the released-pending part of the pledged pending review. The asset holder releases it and bears the gas.','代币仍在质押合约内，计入待审质押额的已驳回分项；由资产方自助解押，gas 自担。']});

      const rel=r.release;
      if(rel){
        if(rel.kind==='withdraw')push('release-start',rel.startedAt,['Withdrawal initiated','待审撤回发起'],
          ['Pending review · withdrawal in progress','待审核 · 撤回解押处理中'],{actor:HOLDER,chain:true,gas:rel.gas,gasCcy:rel.gasCcy,proof:null,
           text:['The asset holder is releasing this share while it is still pending. It cannot be decided until the release has a result.','资产方在待审期间自助解押取回本张；解押有结果前暂不可裁定。']});
        else push('release-start',rel.startedAt,['Self-service release initiated','自助解押已发起'],
          ['Release in progress','解押处理中'],{actor:HOLDER,chain:true,gas:rel.gas,gasCcy:rel.gasCcy,proof:null,
           text:['Initiated by the asset holder with the holding address. Operations cannot initiate, retry or cancel it.','由资产方以持有地址签名发起，运营端无发起、重试或撤销入口。']});
        if(rel.result==='success')push('release-done',rel.completedAt,['Release succeeded','解押成功'],
          r.status==='withdrawn'
            ?['Pending review → Withdrawn · hold released','待审核 → 已撤回 · 占用解除']
            :['Token returned to the holding address before the pledge','代币已转回质押前原持有地址'],
          {chain:true,gas:rel.gas,gasCcy:rel.gasCcy,proof:rel.proof,
           text:['The token has left the total pledged value and the pledged pending review. It can be pledged again subject to current eligibility.','该张已退出总质押额与待审质押额，按当前资格可重新发起质押。']});
        if(rel.result==='failed')push('release-fail',rel.completedAt,['Release failed','解押失败'],
          ['Token still held in the pledge contract','代币仍在质押合约内'],
          {chain:true,gas:rel.gas,gasCcy:rel.gasCcy,proof:rel.proof,
           text:['The pledge contract returned a failure. The gas is consumed and not refunded; the asset holder can initiate the release again.','质押合约返回失败，gas 已消耗且不退，资产方可再次发起解押。']});
        if(rel.result==='unknown')push('release-wait',null,['Release result to be verified','解押结果待核实'],
          ['No confirmed result yet','尚无确认结果'],
          {actor:null,chain:true,gas:null,gasCcy:rel.gasCcy,proof:null,
           text:['No confirmed result has been received for this release. Do not initiate it again; contact platform support.','本次解押尚未收到确认结果，请勿重复发起，可联系平台客服人员。']});
        if(rel.conflictAt)push('release-conflict',rel.conflictAt,['Reconciliation discrepancy','对账差异'],
          ['Reported failed → Conflicting success received','已报失败 → 收到冲突成功结果'],
          {chain:true,gas:rel.gas,gasCcy:rel.gasCcy,proof:rel.conflictProof,
           text:['A later success conflicts with the recorded failure. The original record is kept, further actions on this token are paused, and the review decision is unchanged.','迟到的成功结果与原失败记录冲突，原记录保留，该张后续动作暂停，审核结论不变。']});
      }
    });

    const projects={
      '01':{id:'DEMO-PJ-01',ratio:0.7,termMonths:9,createdAt:now-60*D,status:'open'},
      '02':{id:'DEMO-PJ-02',ratio:0.65,termMonths:12,createdAt:now-120*D,status:'open'},
      '03':{id:'DEMO-PJ-03',ratio:0.6,termMonths:6,createdAt:now-90*D,status:'closed',closedAt,
        closeReason:['Closed by the asset holder','资产方主动关闭']}
    };
    return {now,rows,projects};
  };
})(window.CF=window.CF||{});
