/* Demonstration fixtures only. No issuance platform, asset registry, chain or file service is contacted.
   链路：代币发行平台推送一笔已铸造的 ERC-3525 代币 → 形成准入记录（待审核）→ 运营核对三组信息 →
   通过（终态，随后在面客端展示）或退回（原因回传，发行平台修改后重新推送）。
   企业、平台、编号、地址、哈希与金额均为虚构演示值。 */
(function(CF){
  const H=3600000,D=24*H,MIN=60000;
  const LIN=['Demo reviewer Lin','示例审核员林'],CHEN=['Demo reviewer Chen','示例审核员陈'];
  const SYSTEM=['System','系统'];
  const PLATFORMS={A:['Demo issuance platform A','示例发行平台 A'],B:['Demo issuance platform B','示例发行平台 B']};
  const COMPANIES={
    c1:{name:['Demo Company Jia','示例企业甲'],entity:'DEMO-ENTITY-0001',region:['Singapore','新加坡']},
    c2:{name:['Demo Company Yi','示例企业乙'],entity:'DEMO-ENTITY-0002',region:['Germany','德国']},
    c3:{name:['Demo Company Bing','示例企业丙'],entity:'DEMO-ENTITY-0003',region:['Hong Kong, China','中国香港']},
    c4:{name:['Demo Company Ding','示例企业丁'],entity:'DEMO-ENTITY-0004',region:['United Arab Emirates','阿联酋']},
    spv:{name:['Demo SPV 01','示例 SPV 01'],entity:'DEMO-ENTITY-SPV1',region:['Singapore','新加坡']}
  };
  const hex=(seed,len)=>{let s='';let x=seed*2654435761%4294967296;while(s.length<len){x=(x*1103515245+12345)%2147483648;s+=x.toString(16).padStart(8,'0');}return s.slice(0,len);};
  const addr=seed=>'0xDE00'+hex(seed,36);              // 42 字符，演示地址
  const hash=seed=>'0xDE00'+hex(seed+7,60);            // 66 字符，演示交易 / 文件哈希
  const platformActor=p=>[['Issuance platform · ',PLATFORMS[p][0]].join(''),'来源发行平台 · '+PLATFORMS[p][1]];

  /* 法律协议文件类别：按 RWA 代币化发行的通行做法暂定，均不设必备。 */
  const DOC_CATS=[
    ['assign',['Receivables assignment agreement','应收账款转让协议']],
    ['notice',['Notice of assignment and debtor acknowledgement','债权转让通知及债务人确认']],
    ['prospectus',['Token offering memorandum','代币发行说明书']],
    ['rights',['Token holder rights terms','代币持有人权益条款']],
    ['opinion',['Legal opinion','法律意见书']],
    ['incorp',['Issuer constitutional documents','发行主体设立文件']],
    ['servicing',['Servicing and collection agreement','资产服务与回款归集协议']],
    ['custody',['Custody agreement','托管协议']],
    ['credit',['Guarantee or credit enhancement','担保或增信文件']],
    ['dd',['Due diligence report','尽职调查报告']],
    ['audit',['Smart contract audit report','智能合约审计报告']],
    ['risk',['Risk disclosure statement','风险揭示书']],
    ['declare',['No double financing declaration','重复融资声明']],
    ['other',['Other documents','其他文件']]
  ];
  const PROOF_CATS=[
    ['contract',['Underlying trade contract','基础贸易合同']],
    ['invoice',['Invoice','发票']],
    ['delivery',['Logistics or performance evidence','物流或履约凭证']],
    ['confirm',['Confirmation evidence','确权凭证']]
  ];

  CF.tokenAdmissionSeed=function(){
    const now=Date.now();
    let fileSeq=0,eventSeq=0;
    const ev=(at,kind,title,result,actor,extra)=>Object.assign({id:'demo-ta-ev-'+(++eventSeq),at,kind,title,result,actor},extra||{});
    const day=t=>new Date(t).toISOString().slice(0,10);
    function doc(cat,name,o){
      return Object.assign({id:'f'+(++fileSeq),cat,name,signer:['Demo Company Jia; Demo SPV 01','示例企业甲；示例 SPV 01'],
        signDate:'2026-09-28',from:'2026-09-28',to:null,hash:hash(900+fileSeq),seq:1},o||{});
    }
    function proof(cat,name,o){return Object.assign({id:'p'+(++fileSeq),cat,name,hash:hash(700+fileSeq),seq:1},o||{});}

    /* 一笔代币的完整推送资料；各样例只覆盖与主样例不同的部分。 */
    function base(n,o){
      const k=String(n).padStart(2,'0'),s=n*17;
      const r={
        id:'TA-'+String(n).padStart(3,'0'),key:k,platform:'A',
        tokenNo:'TK20261019'+String(n).padStart(6,'0'),
        name:['Demo receivable token '+k,'示例应收账款代币 '+k],symbol:'DRT'+k,icon:true,
        standard:'ERC-3525',type:'ERC-3525-应收账款',slot:String(1000+n),tokenId:String(n),decimals:'18',
        qty:'1000000.00',value:'1000000.00',
        rate:{pair:'USD/USD',value:'1.000000',at:now-6*D,source:['Issuance-time snapshot · demo rate source','签发时快照 · 示例汇率来源']},
        chain:['Ethereum','以太坊'],chainId:'1',contract:{name:'DemoReceivableToken3525',address:addr(1)},
        mintTx:hash(s+1),mintAt:now-6*D,initial:addr(s+2),
        holders:[{addr:addr(s+2),qty:'600000.00'},{addr:addr(s+3),qty:'400000.00'}],
        tokenState:'valid',
        audit:{done:['Audited','已审计'],firm:['Demo audit firm','示例审计机构'],date:'2026-09-20'},
        issuer:COMPANIES.c1,sameAsSeller:true,
        asset:{type:['Accounts receivable','应收账款'],no:'AR-DEMO-2026'+String(n).padStart(4,'0'),
          seller:COMPANIES.c1,buyer:COMPANIES.c2,amount:'1000000.00',ccy:'USD',start:'2026-10-01',due:'2027-03-31',
          contracts:['DEMO-CT-2026-'+k],invoices:['DEMO-INV-'+k+'01','DEMO-INV-'+k+'02'],
          trade:['Trade in goods','货物贸易'],settle:['Telegraphic transfer (T/T)','电汇（T/T）'],
          terms:['Payment 180 days after invoice date','发票日后 180 天付款'],recourse:['With recourse','有追索'],
          confirm:{party:COMPANIES.c2.name,result:['Confirmed','已确认'],at:now-9*D},
          evidence:{hash:hash(s+4),tx:hash(s+5),block:String(21030000+n*37),chain:['Ethereum','以太坊'],at:now-8*D},
          transfer:{done:['Registered','已登记'],org:['Demo registry','示例登记机构'],no:'DEMO-REG-'+k},
          declare:['Provided','已提供']},
        proofs:[
          proof('contract','DEMO-CT-2026-'+k+'.pdf'),proof('invoice','DEMO-INV-'+k+'01.pdf'),proof('invoice','DEMO-INV-'+k+'02.pdf'),
          proof('delivery','Bill-of-lading-'+k+'.pdf'),proof('confirm','Debtor-confirmation-'+k+'.pdf')],
        docs:[
          doc('assign','Receivables-assignment-agreement-'+k+'.pdf'),
          doc('notice','Notice-and-acknowledgement-'+k+'.pdf',{signer:['Demo SPV 01; Demo Company Yi','示例 SPV 01；示例企业乙']}),
          doc('prospectus','Token-offering-memorandum-'+k+'.pdf',{signer:['Demo SPV 01','示例 SPV 01']}),
          doc('rights','Token-holder-rights-'+k+'.pdf',{signer:['Demo SPV 01','示例 SPV 01']}),
          doc('opinion','Legal-opinion-'+k+'.pdf',{signer:['Demo law firm','示例律师事务所'],signDate:'2026-09-30',from:'2026-09-30'}),
          doc('incorp','SPV-certificate-of-incorporation.pdf',{signer:['Demo SPV 01','示例 SPV 01'],signDate:'2025-12-01',from:'2025-12-01'}),
          doc('incorp','SPV-articles.pdf',{signer:['Demo SPV 01','示例 SPV 01'],signDate:'2025-12-01',from:'2025-12-01'}),
          doc('servicing','Servicing-and-collection-'+k+'.pdf',{to:'2027-06-30'}),
          doc('audit','Contract-audit-report.pdf',{signer:['Demo audit firm','示例审计机构'],signDate:'2026-09-20',from:'2026-09-20'}),
          doc('risk','Risk-disclosure-'+k+'.pdf',{signer:['Demo SPV 01','示例 SPV 01']}),
          doc('declare','No-double-financing-declaration-'+k+'.pdf',{signer:['Demo Company Jia','示例企业甲']})],
        status:'pending',seq:1,submittedAt:now-6*H,updatedAt:null,
        decisions:[],dupes:[],changed:false,events:[]
      };
      Object.assign(r,o||{});
      if(!r.events.length)r.events=[submitEvent(r,r.submittedAt,1)];
      return r;
    }
    function submitEvent(r,at,seq){
      return ev(at,'submit',['Admission request submitted','提交准入申请'],[`Pending review · submission ${seq}`,`待审核 · 第 ${seq} 次提交`],platformActor(r.platform));
    }
    const returnEvent=(at,reason,actor)=>ev(at,'return',['Returned','审核退回'],['Pending review → Returned','待审核 → 已退回'],actor,{text:reason});
    const approveEvent=(at,actor)=>ev(at,'approve',['Approved','审核通过'],['Pending review → Approved','待审核 → 已通过'],actor);
    const resubmitEvent=(r,at,seq)=>ev(at,'resubmit',['Resubmitted after revision','重新提交'],[`Returned → Pending review · submission ${seq}`,`已退回 → 待审核 · 第 ${seq} 次提交`],platformActor(r.platform));

    const R_OPINION=['The legal opinion is missing its signature page. Provide the complete signed version and submit again.','法律意见书缺少签署页，请补充完整签署版本后重新提交。'];
    const R_INVOICE=['The invoice numbers do not match the invoice files provided. Check the invoices and submit again.','发票号与所附发票文件不一致，请核对发票后重新提交。'];
    const R_DUP=['The token number is also used by another token on a different contract. Confirm the correct token number and submit again.','该代币编号同时被另一合约上的代币使用，请确认正确的代币编号后重新提交。'];

    const rows=[];
    /* 01 待审核 · 有效 · 资料齐全：通过与退回两条办理路径的主样例。 */
    rows.push(base(1,{submittedAt:now-26*H,holders:[{addr:addr(30),qty:'600000.00'},{addr:addr(31),qty:'250000.00'},{addr:addr(32),qty:'150000.00'}]}));
    /* 02 第 2 次提交：上一次因法律意见书缺签署页被退回，原因保留在操作记录。 */
    {const r=base(2,{platform:'A',seq:2,submittedAt:now-5*H,issuer:COMPANIES.c3,
      asset:{...base(2).asset,seller:COMPANIES.c3,buyer:COMPANIES.c4,amount:'920000.00',ccy:'EUR',due:'2027-02-28'},
      qty:'1000040.00',value:'1000040.00',rate:{pair:'EUR/USD',value:'1.087000',at:now-9*D,source:['Issuance-time snapshot · demo rate source','签发时快照 · 示例汇率来源']}});
     r.decisions=[{result:'returned',at:now-3*D,reviewer:CHEN,reason:R_OPINION}];
     r.events=[submitEvent(r,now-4*D,1),returnEvent(now-3*D,R_OPINION,CHEN),resubmitEvent(r,now-5*H,2)];rows.push(r);}
    /* 03 待审核期间应收账款到期，代币失效：通过不可用，退回可用。 */
    {const r=base(3,{platform:'B',submittedAt:now-9*D,tokenState:'expired',
      asset:{...base(3).asset,start:'2026-04-10',due:day(now-2*D)}});
     r.events=[submitEvent(r,now-9*D,1),ev(now-2*D,'expire',['Token became invalid','代币变为失效'],['Valid → Invalid','有效 → 失效'],platformActor('B'),
       {text:['The underlying receivable reached its due date.','对应应收账款已到期。']})];rows.push(r);}
    /* 04 部分字段与文件上游没有提供：空值展示，不提示缺失，不影响通过。 */
    {const b=base(4);rows.push(base(4,{platform:'B',submittedAt:now-30*H,icon:false,symbol:null,tokenId:null,holders:null,audit:{done:null,firm:null,date:null},
      issuer:COMPANIES.c4,
      asset:{...b.asset,seller:COMPANIES.c4,invoices:null,terms:null,transfer:{done:null,org:null,no:null},
        evidence:{...b.asset.evidence,block:null}},
      proofs:b.proofs.filter(p=>p.cat!=='delivery'),
      docs:b.docs.filter(d=>['assign','prospectus','opinion'].includes(d.cat))}));}

    /* 05 / 06 链上代币重复：链 ID、合约地址、slot 相同，代币编号与来源平台不同；05 已通过，06 只能退回。 */
    {const a=base(5,{platform:'A',status:'approved',slot:'2051',contract:{name:'DemoReceivableToken3525',address:addr(5)},submittedAt:now-12*D});
     a.decisions=[{result:'approved',at:now-11*D,reviewer:LIN}];a.events=[submitEvent(a,now-12*D,1),approveEvent(now-11*D,LIN)];
     const c=base(6,{platform:'B',slot:'2051',contract:{name:'DemoReceivableToken3525',address:addr(5).toUpperCase().replace('0XDE00','0xDE00')},submittedAt:now-3*D,issuer:COMPANIES.c1});
     a.dupes=[{kind:'chain',other:c.id}];c.dupes=[{kind:'chain',other:a.id}];rows.push(a,c);}
    /* 07 / 08 代币编号重复：同一代币编号，链上三项不同；只提醒，不影响通过。 */
    {const a=base(7,{platform:'A',tokenNo:'TK20261017000777',slot:'3070',submittedAt:now-50*H});
     const c=base(8,{platform:'B',tokenNo:'TK20261017000777',slot:'3080',contract:{name:'DemoReceivableNote3525',address:addr(8)},status:'returned',submittedAt:now-5*D,issuer:COMPANIES.c3});
     c.decisions=[{result:'returned',at:now-4*D,reviewer:LIN,reason:R_DUP}];c.events=[submitEvent(c,now-5*D,1),returnEvent(now-4*D,R_DUP,LIN)];
     a.dupes=[{kind:'number',other:c.id}];c.dupes=[{kind:'number',other:a.id}];rows.push(a,c);}
    /* 09 已通过后发行平台推送资料变更：保持已通过，只标记提醒，可确认已知悉。 */
    {const r=base(9,{status:'approved',submittedAt:now-20*D,changed:true,
      asset:{...base(9).asset,terms:['Payment 150 days after invoice date','发票日后 150 天付款']}});
     r.docs=r.docs.map(d=>d.cat==='servicing'?{...d,name:'Servicing-and-collection-09-v2.pdf',hash:hash(1999),seq:1,changedAt:now-2*D}:d);
     r.decisions=[{result:'approved',at:now-19*D,reviewer:CHEN}];
     r.events=[submitEvent(r,now-20*D,1),approveEvent(now-19*D,CHEN),
       ev(now-2*D,'change',['Materials changed after approval','通过后资料变更'],['Approved · unchanged','已通过 · 准入状态不变'],platformActor('A'),
         {diff:[[['Payment terms','付款条件'],['Payment 180 days after invoice date','发票日后 180 天付款'],['Payment 150 days after invoice date','发票日后 150 天付款']],
           [['Servicing and collection agreement','资产服务与回款归集协议'],['Servicing-and-collection-09.pdf'],['Servicing-and-collection-09-v2.pdf']]]})];
     rows.push(r);}
    /* 10 近 7 日内通过，之后代币失效：准入结论不变，按上游事实标失效。 */
    {const r=base(10,{status:'approved',submittedAt:now-4*D,tokenState:'expired',platform:'B',
      asset:{...base(10).asset,start:'2026-07-01',due:day(now-1*D)}});
     r.decisions=[{result:'approved',at:now-3*D,reviewer:LIN}];
     r.events=[submitEvent(r,now-4*D,1),approveEvent(now-3*D,LIN),ev(now-1*D,'expire',['Token became invalid','代币变为失效'],['Valid → Invalid','有效 → 失效'],platformActor('B'),
       {text:['The underlying receivable reached its due date.','对应应收账款已到期。']})];
     rows.push(r);}
    /* 11 近 7 日内退回，审核结果回传失败：结论照常生效，并在操作记录标出。 */
    {const r=base(11,{status:'returned',submittedAt:now-2*D,issuer:COMPANIES.c3});
     r.decisions=[{result:'returned',at:now-40*H,reviewer:CHEN,reason:R_INVOICE}];
     r.events=[submitEvent(r,now-2*D,1),returnEvent(now-40*H,R_INVOICE,CHEN),
       ev(now-40*H+2*MIN,'callback-fail',['Result could not be sent back','审核结果回传失败'],['Decision stays in effect','结论照常生效'],SYSTEM,
         {text:['The issuance platform did not accept the result.','来源发行平台未能接收审核结果。']})];
     rows.push(r);}
    /* 12 较早通过（近 7 日之外）；发行方为 SPV，与底层资产卖方并列展示。 */
    {const r=base(12,{status:'approved',submittedAt:now-30*D,issuer:COMPANIES.spv,sameAsSeller:false});
     r.decisions=[{result:'approved',at:now-29*D,reviewer:LIN}];r.events=[submitEvent(r,now-30*D,1),approveEvent(now-29*D,LIN)];rows.push(r);}
    /* 13 待审核期间发行平台推送资料更新：不增加提交序次，详情展示最新资料。 */
    {const r=base(13,{submittedAt:now-3*D,updatedAt:now-7*H});
     r.events=[submitEvent(r,now-3*D,1),ev(now-7*H,'update',['Materials updated','资料更新'],['Pending review · submission 1','待审核 · 第 1 次提交'],platformActor('A'),
       {diff:[[['Invoice numbers','发票号'],['DEMO-INV-1301'],['DEMO-INV-1301, DEMO-INV-1302']],[['Invoice','发票'],['—'],['DEMO-INV-1302.pdf']]]})];
     rows.push(r);}
    /* 14 / 15 链上代币重复且都待审核：先生效的通过成立，另一条随即只能退回。 */
    {const a=base(14,{platform:'A',slot:'4140',contract:{name:'DemoReceivableToken3525',address:addr(14)},submittedAt:now-20*H,issuer:COMPANIES.c3});
     const c=base(15,{platform:'B',slot:'4140',contract:{name:'DemoReceivableToken3525',address:addr(14)},submittedAt:now-18*H,issuer:COMPANIES.c3,tokenNo:'TK20261020000915'});
     a.dupes=[{kind:'chain',other:c.id}];c.dupes=[{kind:'chain',other:a.id}];rows.push(a,c);}
    /* 16～27 待审核的普通样例，使待审核清单超过一页。 */
    for(let n=16;n<=27;n++){
      const amt=String(200000+n*25000)+'.00';
      rows.push(base(n,{platform:n%3?'A':'B',issuer:[COMPANIES.c1,COMPANIES.c3,COMPANIES.c4][n%3],
        submittedAt:now-(n-14)*7*H,qty:amt,value:amt,holders:[{addr:addr(n*5),qty:amt}],
        asset:{...base(n).asset,amount:amt,due:'2027-0'+(1+n%9)+'-15'}}));
    }
    /* 平台代币标识：形成准入记录时生成，PT + 当天 UTC 日期 + 当日 6 位序号；之后的推送与状态变化都不改变它。 */
    const formed=r=>Math.min(...r.events.filter(e=>e.kind==='submit').map(e=>e.at));
    const perDay={};
    [...rows].sort((a,b)=>formed(a)-formed(b)||a.id.localeCompare(b.id)).forEach(r=>{
      const d=new Date(formed(r)).toISOString().slice(0,10).replace(/-/g,'');
      perDay[d]=(perDay[d]||0)+1;r.ptid='PT'+d+String(perDay[d]).padStart(6,'0');
    });
    return {rows,now,platforms:PLATFORMS,docCats:DOC_CATS,proofCats:PROOF_CATS,reviewers:{LIN,CHEN},hash,addr};
  };
})(window.CF=window.CF||{});
