/* WS-351: isolated, labelled demonstration service. No API, wallet or chain calls.
 * Token snapshots and lending facts remain separate. UI consumes action decisions
 * from this adapter; production must replace it with authenticated server responses.
 */
(function (CF) {
  'use strict';
  const KEY = CF.LSStorageKey || 'hc-ws351-demo-v3', DAY = 86400000;
  /* 演示数据结构变化时提升版本号：旧存档改为重新播种，避免恢复出互相对不上的记录。 */
  const SCHEMA = 'ws397-6';
  const D = CF.LS = { projects: [], tokens: [], applications: [], executions: [], events: [], offset: 0, serial: 100 };
  /* SPV 机构名称是代码层面维护的平台默认值，随版本发布；平台内没有维护、配置或切换入口。 */
  D.SPV = ['Chain Financing SPV I', '链融平台 SPV 壹号'];
  /* 平台统一钱包同样在代码层面维护；部署 gas 由运营端承担，资产方不签名不付费。 */
  D.WALLET = '0xA17C4f1b0d9E2a7C5b83Df6e21904aB7cD35e082';
  /* 运营配置的代币类型：代币标准与底层资产类型合并成一个字段，本期只有一行。 */
  D.TYPES = [{id:'erc20-ar',label:['ERC-20-Receivables','ERC-20-应收账款'],maxRate:0.8,maxTerm:12}];
  D.type = id => D.TYPES.find(x=>x.id===id) || D.TYPES[0];
  D.REPAY = ['Quarterly interest, principal at maturity','按季付息、到期还本付息'];
  D.SETTLE = [['USD','USD'],['USDT','USDT'],['USDC','USDC']];
  D.PLEDGE_CHAIN = 'ETH';
  D.now = () => Date.now() + D.offset;
  D.iso = () => new Date(D.now()).toISOString();
  /* 项目期限按 UTC 业务日期选到期日：加 N 个月取目标月同日，目标月没有该日取月末。 */
  D.today = () => D.iso().slice(0,10);
  D.addDays = (day, n) => new Date(Date.parse(day+'T00:00:00Z')+n*DAY).toISOString().slice(0,10);
  D.addMonths = (day, n) => {
    const [y,m,d]=day.split('-').map(Number),first=new Date(Date.UTC(y,m-1+n,1));
    const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
    return new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),Math.min(d,last))).toISOString().slice(0,10);
  };
  /* 可选到期日：创建日 + 3 个月 ～ 创建日 + 最长项目期限（≤ 12 个月），且晚于当天。退回重提沿用原创建日与创建时锁定的上限。 */
  D.termRange = (kindId, project) => {
    const start=project?project.created.slice(0,10):D.today();
    const cap=project?project.termCap:D.type(kindId).maxTerm;
    if(!cap)return {start,none:true};
    const min=[D.addMonths(start,3),D.addDays(D.today(),1)].sort().at(-1),max=D.addMonths(start,Math.min(cap,12));
    return {start,cap,min,max,empty:min>max};
  };
  D.endOf = day => new Date(Date.parse(day+'T00:00:00Z')+DAY).toISOString();
  /* 外部演示接入的项目可能缺少本模块字段：按同一口径补齐，页面不出现 undefined。 */
  D.fill = p => {
    if(!p)return p;
    if(!p.kind||p.kind==='ar')p.kind='erc20-ar';
    if(!p.spv)p.spv=D.SPV;
    if(!p.rate)p.rate=D.type(p.kind).maxRate;
    if(!p.settle)p.settle=['USD'];
    if(!p.created)p.created=p.published||D.iso();
    if(!p.termCap)p.termCap=D.type(p.kind).maxTerm;
    if(!p.expiry){p.expiry=p.expires?p.expires.slice(0,10):D.addMonths(p.created.slice(0,10),p.term||12);p.expires=D.endOf(p.expiry);}
    if(p.contract&&!p.deployedAt)p.deployedAt=p.created;
    if(!p.contract)p.deployedAt=null;
    return p;
  };
  D.save = () => { try { localStorage.setItem(KEY, JSON.stringify({schema:SCHEMA,projects:D.projects,tokens:D.tokens,applications:D.applications,executions:D.executions,events:D.events,offset:D.offset,serial:D.serial})); } catch (_) {} };
  D.project = id => D.fill(D.projects.find(p => p.id === id));
  D.token = id => D.tokens.find(t => t.id === id);
  D.mine = p => CF.S.role === 'asset' && p && p.owner === 'entity-demo-a';
  D.terminal = p => ['closed','settled'].includes(p.state);
  D.log = (p, key, ref) => {
    const a=D.applications.find(a=>a.id===ref), e=D.executions.find(e=>e.id===ref);
    const application=a?.id||e?.application||null, token=a?.tokens[0]||e?.token||null;
    if(application&&D.events.some(x=>x.key===key&&x.ref===ref))return;
    D.events.unshift({project:p.id,key,ref:ref||'',application,token,at:D.iso()});
  };
  D.latest = (p,id) => [...D.applications].reverse().find(a=>a.project===p.id&&a.tokens.includes(id)&&['review','approved','rejected'].includes(a.state)) || [...D.applications].reverse().find(a=>a.project===p.id&&a.tokens.includes(id));
  D.quoteFee = id => { const t=D.token(id);return {amount:t.feeEstimate??0.0004,currency:t.feeCurrency||'ETH'}; };
  D.agreement = a => ({id:'AGR-'+a.id,name:['Pledge agreement · '+a.id,'质押协议 · '+a.id]});
  D.normalize = () => {
    D.projects.forEach(p=>{
      D.fill(p);
      if(p.state==='draft')p.state='available';
    });
    D.tokens.forEach(t=>{if(t.kind==='ar')t.kind='erc20-ar';});
    D.applications=D.applications.flatMap(a=>a.tokens.map((id,i)=>{
      const row={...a,id:a.tokens.length>1?a.id+'-'+(i+1):a.id,batch:a.batch||a.id,tokens:[id]};
      row.reviewState=a.reviewState||a.state;
      if(row.reviewState==='approved'){row.approvedAt=a.approvedAt||a.decided;row.reviewer=a.reviewer||['Demo reviewer '+(i+1),'演示审核员 '+(i+1)];row.agreement=a.agreement||D.agreement(row);}
      if(row.reviewState==='rejected')row.reviewer=a.reviewer||['Demo reviewer','演示审核员'];
      const t=D.token(id);if(t?.application===a.id)t.application=row.id;
      D.executions.filter(e=>e.application===a.id&&e.token===id).forEach(e=>e.application=row.id);
      return row;
    }));
    /* 每张在合约内的代币都要有一条逐笔审核记录：老档与播种数据按已通过补齐。 */
    D.projects.forEach(pr=>{
      D.tokens.filter(t=>t.pool===pr.id&&t.pledge==='pledged').forEach(t=>{
        if(D.applications.some(a=>a.project===pr.id&&a.tokens.includes(t.id)&&['review','approved','rejected'].includes(a.state)))return;
        const at=pr.published||pr.created||D.iso();
        const a={id:'RV-SEED-'+t.id,batch:'PA-SEED-'+pr.id,project:pr.id,tokens:[t.id],state:'approved',reviewState:'approved',
          submitted:at,decided:at,approvedAt:at,reviewer:['Demo reviewer','演示审核员']};
        a.agreement=D.agreement(a);D.applications.push(a);t.application=a.id;
      });
    });
  };
  /* 代币在合约内 = 已质押；是否计入有效质押额另看逐笔审核结论。 */
  D.appOf = (p,t) => D.applications.filter(a=>a.project===p.id&&a.tokens.includes(t.id)&&['review','approved','rejected'].includes(a.state)).at(-1);
  D.numbers = p => {
    const rate = p.rate || 0.8;
    const pool = D.tokens.filter(t => t.pool === p.id && t.pledge === 'pledged');
    const total = pool.reduce((v,t) => v+t.value,0);
    const valid = pool.filter(t => D.appOf(p,t)?.state==='approved' && t.valid && !t.frozen && !t.pending);
    const waiting = pool.filter(t => ['review','rejected'].includes(D.appOf(p,t)?.state));
    const value = valid.reduce((v,t) => v+t.value,0);
    const pendingValue = waiting.reduce((v,t) => v+t.value,0);
    const fly = p.demands.filter(d => ['open','quoted','funding'].includes(d.state)).reduce((v,d) => v+d.amount,0);
    const limit = value*rate, free = Math.max(0,limit-p.balance-fly);
    return {rate,pool,total,valid,value,waiting,pendingValue,fly,limit,free,withdraw:free/rate,
      gap:Math.max(0,p.balance-limit),grade:limit<p.balance?'short':free>0?'surplus':'balanced'};
  };
  /* 质押水位：有效质押额 < 项目融资余额 + 项目在途金额即为不安全，恰好相等仍算安全；项目终态后不再判断。 */
  D.waterLocked = p => {if(D.terminal(p))return false;const n=D.numbers(p);return n.limit < p.balance + n.fly;};
  /* 质押份额：本企业一个持有地址上持有的某笔代币的全部数量，是质押、审核、解押与提取的最小单位。
     D.tokens 的每条记录即一份份额；no 为代币编号，holder 为持有地址，units 为持有数量，value 为份额价值。 */
  D.HOLDERS = {'entity-demo-a':['0x2a71c0d4e9b38f15a6c27d90e4b1f83c5d6a9e21','0x2b84f1a3c6d90e27b5a48c13f9e06d72a1c5b384'],'entity-demo-b':['0x3c95e2b4d7a01f38c6b59d24a0f17e83b2d6c495']};
  D.tokenNo = t => t ? (t.no || t.id) : '';
  D.holderOf = t => t ? (t.holder || (D.HOLDERS[t.owner] || [''])[0]) : '';
  D.shareValue = (units, tokenUnits, tokenValue) => Math.round(units * tokenValue / tokenUnits * 100) / 100;
  D.current = p => p.demands.find(d => ['open','quoted','funding'].includes(d.state));
  D.actions = p => {
    const n=D.numbers(p), current=D.current(p), mine=D.mine(p), terminal=D.terminal(p);
    /* 可撤回上限只约束已通过审核的有效抵押物；水位不安全时已通过审核的代币（含已失效）一律不能转出，待审、已驳回、待提取照常可办理。 */
    const releasable=D.tokens.filter(t => {if((t.pool!==p.id&&t.releasedFrom!==p.id)||t.pending||t.frozen)return false;if(t.pledge==='released')return true;if(t.pledge!=='pledged')return false;const approved=D.appOf(p,t)?.state==='approved';if(approved&&D.waterLocked(p))return false;return !(approved&&t.valid)||t.value<=n.withdraw;});
    const live=!terminal&&!['review','returned'].includes(p.state);
    return {mine,review:p.state==='review',returned:p.state==='returned',live,
      pledge:mine&&live,publish:mine&&live&&!p.expired&&!current&&n.value>0&&n.free>0,
      edit:mine&&current&&current.state==='open'&&!p.expired,withdraw:mine&&releasable.length>0,
      close:mine&&!terminal,canClose:mine&&!terminal&&!p.deploying&&!D.unfinished(p).length,
      quote:CF.S.role==='fund'&&current&&current.state==='open'&&!terminal&&!p.expired&&n.grade==='surplus'};
  };
  D.kinds = () => D.TYPES.filter(x=>D.tokens.some(t=>t.owner==='entity-demo-a'&&t.kind===x.id)).map(x=>x.id);
  D.candidates = p => D.tokens.filter(t => t.owner==='entity-demo-a'&&t.kind===(p?.kind||'erc20-ar')&&t.valid&&t.pledge==='free'&&!t.frozen);
  D.selectable = (t,p) => t && t.owner==='entity-demo-a'&&t.valid&&t.kind===(p?.kind||'erc20-ar')&&t.pledge==='free'&&!t.pending&&!t.application&&!t.frozen;
  D.releaseApplication = a => a.tokens.forEach(id => { const t=D.token(id);if(t.application===a.id)t.application=null; });
  D.recompute = p => {
    let n=D.numbers(p);
    [...p.demands].reverse().forEach(d => {
      if (['open','quoted'].includes(d.state) && n.limit < p.balance+n.fly) {
        d.state='ended';d.reason='coverage';d.endedAt=D.iso();d.quoteState='ended';D.log(p,'demandVoided',d.id);n=D.numbers(p);
      }
    });
    if(!D.terminal(p)&&!D.current(p)&&!['review','returned'].includes(p.state))p.state=p.balance?'financing':'available';
    if(n.grade!==p.grade){ if(n.grade==='short'||p.grade==='short')D.log(p,n.grade==='short'?'coverageShort':'coverageRestored'); p.grade=n.grade;p.coverageAt=D.iso(); }
  };
  /* 未处理完成的业务：待确认的报价、待放款 / 待放款确认、未结清（含逾期）、处理中的链上操作。任一存在时不能关闭、不转已结清、不整池释放。 */
  D.unfinished = p => {
    const out=[];
    if(p.demands.some(d=>d.state==='quoted'))out.push('quoted');
    if(p.demands.some(d=>d.state==='funding'))out.push('funding');
    if(p.balance>0||CF.L8?.hasUnsettled?.(p))out.push('unsettled');
    if(D.executions.some(e=>e.project===p.id&&e.state==='processing')||D.tokens.some(t=>(t.pool===p.id||t.releasedFrom===p.id)&&t.pending))out.push('processing');
    return out;
  };
  /* 终态整池释放：已通过审核的份额转为已释放待提取；仍待审核的按默认不通过处理，留在合约内由资产方自助解押。 */
  D.releasePool = p => {
    D.applications.filter(a=>a.project===p.id&&a.state==='review').forEach(a=>{a.state=a.reviewState='rejected';a.reason='projectEnded';a.decided=D.iso();});
    D.tokens.filter(t=>t.pool===p.id&&t.pledge==='pledged'&&!t.pending&&D.appOf(p,t)?.state!=='rejected').forEach(t=>{t.pool=null;t.pledge='released';t.releasedFrom=p.id;});
    D.applications.filter(a=>a.project===p.id&&a.state==='approved').forEach(a=>{a.state='void';a.reason='closed';a.finished=D.iso();D.releaseApplication(a);});
    D.log(p,'businessRelease');
  };
  D.sweep = () => {
    let changed=false;
    /* 本模块不再有任何倒计时类时限：审核不因等待自动改变结论。 */
    D.projects.forEach(p=>{if(p.expires&&!p.expired&&D.now()>=Date.parse(p.expires)){p.expired=true;const d=D.current(p);if(d&&['open','quoted'].includes(d.state)){d.state='ended';d.reason='expiry';d.endedAt=D.iso();d.quoteState='ended';D.log(p,'demandVoided',d.id);}if(!D.unfinished(p).length){p.state='closed';p.closeReason='expiry';D.releasePool(p);}D.log(p,'projectExpired');changed=true;}});
    if(changed)D.save();return changed;
  };
  /* 创建即提交审核：不勾代币、不上链、不签名、不收费。 */
  D.createProject = (form, project) => {
    if(CF.S.role!=='asset')throw Error('permission');
    const title=(form.name||'').trim();
    if(!title||[...title].length>60)throw Error('name');
    if(!D.kinds().includes(form.kind))throw Error('kind');
    const cfg=D.type(form.kind);
    const rate=Number(form.rate);
    if(!/^\d+(\.\d{1,2})?$/.test(String(form.rate).trim())||!(rate>0&&rate<=cfg.maxRate*100))throw Error('rate');
    /* 提交时按当刻条件复核到期日：范围外一律拒绝。 */
    const range=D.termRange(form.kind,project);
    if(range.none)throw Error('termCap');
    if(!form.expiry||range.empty||form.expiry<range.min||form.expiry>range.max)throw Error('expiry');
    if(!form.settle||!form.settle.length)throw Error('settle');
    if(project){
      if(project.state!=='returned')throw Error('reviewChanged');
      Object.assign(project,{name:[title,title],kind:form.kind,rate:rate/100,expiry:form.expiry,expires:D.endOf(form.expiry),settle:[...form.settle],state:'review',reviewReason:null});
      D.log(project,'projectSubmitted');D.save();return project;
    }
    const created=D.iso();
    const p={id:'FP-DEMO-'+(++D.serial),name:[title,title],owner:'entity-demo-a',kind:form.kind,rate:rate/100,termCap:cfg.maxTerm,
      network:D.PLEDGE_CHAIN,settle:[...form.settle],spv:D.SPV,repay:D.REPAY,contract:null,deployedAt:null,state:'review',balance:0,demands:[],
      created,published:null,expiry:form.expiry,expires:D.endOf(form.expiry)};
    D.projects.unshift(p);D.log(p,'created');D.save();return p;
  };
  /* 审核与部署是同一步：部署成功即通过，同时产生合约地址。 */
  /* 运营提交通过后合约部署进行中（含结果待核实）：资产方看到的仍是待审核，但暂不可关闭；回写后按结果处理。 */
  D.decideProject = (p, outcome, reason) => {
    if(p.state!=='review')throw Error('reviewChanged');
    if(outcome==='submit'){if(p.deploying)throw Error('reviewChanged');p.deploying=true;D.save();return true;}
    if(outcome==='return'&&p.deploying)throw Error('reviewChanged');
    p.deploying=false;
    if(outcome==='approve'){
      p.state='available';p.reviewReason=null;
      p.contract='0x'+(D.serial+7).toString(16).padStart(40,'0');p.deployedAt=D.iso();
      D.log(p,'projectApproved');
    } else if(outcome==='deployFailed'){ D.log(p,'deployFailed'); }
    else { p.state='returned';p.reviewReason=reason||['The submitted project details need a correction.','提交的创建信息需要修正后再提交。'];D.log(p,'projectReturned'); }
    D.save();return true;
  };

  D.review = (p, outcome, id) => {
    const a=id?D.applications.find(a=>a.id===id&&a.project===p.id):[...D.applications].reverse().find(a=>a.project===p.id&&a.state==='review');
    if(!a||a.state!=='review')return false;
    a.state=outcome==='approve'?'approved':'rejected';a.reviewState=a.state;a.decided=D.iso();
    a.reviewer=['Demo reviewer '+(++D.serial),'演示审核员 '+D.serial];
    if(a.state==='approved'){a.approvedAt=a.decided;a.agreement=D.agreement(a);}
    else a.reason='rejected';
    D.log(p,a.state,a.id);D.recompute(p);D.save();return true;
  };
  D.cancelApplication = a => {if(!D.mine(D.project(a.project))||a.state!=='review')throw Error('reviewChanged');a.state='withdrawn';a.reviewState='withdrawn';a.finished=D.iso();D.log(D.project(a.project),'applicationWithdrawn',a.id);D.save();};
  D.execute = (p, kind, ids, appId) => {
    if(!D.mine(p))throw Error('permission');
    if(kind==='deposit'){
      if(!D.actions(p).pledge)throw Error('closed');
      if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!D.selectable(D.token(id),p)))throw Error('selectionChanged');
    }
    else {
      const n=D.numbers(p);if(!ids.length||ids.some(id=>{const t=D.token(id);return !t||t.owner!==p.owner||t.frozen||t.pending||!(t.pool===p.id&&t.pledge==='pledged'||t.releasedFrom===p.id&&t.pledge==='released');}))throw Error('selectionChanged');
      const amount=ids.map(D.token).filter(t=>t.pledge==='pledged'&&t.valid&&D.appOf(p,t)?.state==='approved').reduce((v,t)=>v+t.value,0);if(amount>n.withdraw)throw Error('withdrawLimit');
    }
    ids.forEach(id=>{const t=D.token(id);const actualKind=kind==='deposit'?'deposit':t.pledge==='released'?'redeem':'withdraw';const e={id:'EX-DEMO-'+(++D.serial),project:p.id,token:id,application:kind==='deposit'?null:D.appOf(p,t)?.id||null,kind:actualKind,state:'processing',at:D.iso(),fee:null,feeCurrency:D.quoteFee(id).currency};D.executions.push(e);t.pending=e.id;D.log(p,'executionStarted',e.id);});D.save();
  };
  D.result = (e, result) => {
    const t=D.token(e.token),p=D.project(e.project);
    if(e.state!=='processing'&&result==='late'){t.frozen=true;e.late=true;e.conflictAt=D.iso();D.log(p,'reconciliation',e.id);D.recompute(p);D.save();return;}
    if(e.state!=='processing'||!['success','failure','noFee'].includes(result))return;
    const a=D.applications.find(a=>a.id===e.application);
    if(e.kind==='deposit'&&D.terminal(p)){e.observedResult=result;e.observedAt=D.iso();e.fee=result==='noFee'?0:D.quoteFee(e.token).amount;e.boundary=true;D.save();return;}
    e.state=result;e.done=D.iso();e.fee=result==='noFee'?0:D.quoteFee(e.token).amount;
    t.pending=null;
    if(e.kind==='deposit'){
      if(result==='success'){
        t.pledge='pledged';t.pool=p.id;t.tx='0x'+String(D.serial+1).padStart(64,'0');
        /* 进入合约即计入待审质押额，等逐笔审核裁定后才转入有效质押额。 */
        const a2={id:'RV-DEMO-'+(++D.serial),batch:'PA-DEMO-'+p.id,project:p.id,tokens:[t.id],
          state:'review',reviewState:'review',submitted:D.iso(),decided:null};
        D.applications.push(a2);t.application=a2.id;D.log(p,'onChain',a2.id);
      }
      else {t.pledge='free';t.pool=null;}
    }else if(result==='success'){const a3=D.appOf(p,t);if(a3&&['review','rejected'].includes(a3.state)){a3.state='withdrawn';a3.reviewState='withdrawn';a3.finished=D.iso();}t.pledge='free';t.pool=null;t.releasedFrom=null;t.application=null;}
    else if(D.terminal(p)){t.pledge='released';t.pool=null;t.releasedFrom=p.id;}
    D.log(p,result==='success'?'executionSuccess':'executionFailed',e.id);D.recompute(p);D.save();
  };
  D.publish = (p, amount, edit, referenceCurrencies) => {
    D.sweep();const a=D.actions(p),n=D.numbers(p),current=D.current(p);
    if(!D.mine(p))throw Error('permission');if(edit?!a.edit:!a.publish)throw Error('publishChanged');
    const max=n.free+(edit?current.amount:0);if(!Number.isFinite(amount)||amount<=0||Math.abs(Math.round(amount*100)-amount*100)>1e-6||amount>max)throw Error('amount');
    if(!Array.isArray(referenceCurrencies)||!referenceCurrencies.length||referenceCurrencies.some(c=>!['USD','USDT','USDC'].includes(c)))throw Error('referenceCurrencies');
    const preferences=[...new Set(referenceCurrencies)];
    if(edit){current.amount=amount;current.referenceCurrencies=preferences;}
    else{const at=D.iso();p.demands.push({id:p.id+'-'+String(p.demands.length+1).padStart(2,'0'),amount,referenceCurrencies:preferences,state:'open',at});p.state='raising';if(!p.published)p.published=at;}
    D.log(p,edit?'amountEdited':'published');D.save();
  };
  D.endDemand = p => {const a=D.actions(p);if(!a.edit)throw Error('demandChanged');const d=D.current(p);d.state='ended';d.reason='withdrawn';d.endedAt=D.iso();D.recompute(p);D.log(p,'demandWithdrawn',d.id);D.save();};
  D.close = p => {if(p.deploying)throw Error('deploying');if(!D.actions(p).canClose)throw Error('cannotClose');
    /* 尚未收到报价的需求随项目关闭一并终结。 */
    p.demands.filter(d=>d.state==='open').forEach(d=>{d.state='ended';d.reason='closed';d.endedAt=D.iso();d.quoteState='ended';D.log(p,'demandWithdrawn',d.id);});
    p.state='closed';p.closeReason='owner';D.releasePool(p);D.log(p,'closed');D.save();};
  D.seed = () => {
    D.projects=[];D.tokens=[];D.applications=[];D.executions=[];D.events=[];D.offset=0;D.serial=100;
    for(let i=1;i<=24;i++){
      const created=new Date(D.now()-(i+2)*DAY).toISOString(),expiry=D.addMonths(created.slice(0,10),[12,9,6][i%3]);
      const p={id:'FP-DEMO-'+String(i).padStart(3,'0'),name:['Receivables pool '+String(i).padStart(2,'0'),'应收账款资产池 '+String(i).padStart(2,'0')],owner:i<=7?'entity-demo-a':'entity-demo-b',kind:'erc20-ar',rate:0.8,termCap:12,settle:['USD'],repay:D.REPAY,contract:'0x'+(i*31+7).toString(16).padStart(40,'0'),deployedAt:new Date(Date.parse(created)+3*3600000).toISOString(),spv:D.SPV,state:i===3?'locked':i===4?'financing':i===5?'settled':i===6?'closed':'raising',balance:i===4?500000:0,demands:[],created,published:new Date(D.now()-i*DAY).toISOString(),expiry,expires:D.endOf(expiry),quotes:i===3?1:0};
      if(i!==5&&i!==6)p.demands.push({id:p.id+'-01',amount:i===4?500000:300000,state:i===4?'funded':i===3?'quoted':'open',at:p.published,tenorDays:i===3?90:i===4?120:null,rate:i===3?'6.40':i===4?'6.80':null,institution:i===3?['Demo Capital','演示资金机构']:null,quoteAt:i===3?p.published:null});
      D.projects.push(p);
      for(let j=1;j<=7;j++){const released=[5,6].includes(i);const value=j===7?100000:150000;
        D.tokens.push({id:'TK-DEMO-'+i+'-'+j,owner:p.owner,kind:'erc20-ar',units:1,symbol:'AR-DEMO',value,valid:i===4?j<=3:j!==7,pool:released?null:p.id,releasedFrom:released?p.id:null,pledge:released?'released':'pledged',buyer:['Demo Buyer '+j,'演示买方 '+j],due:'2027-01-20',from:'2026-07-20',tx:'0x'+(i*10+j).toString(16).padStart(64,'0')});}
      p.grade=D.numbers(p).grade;p.coverageAt=p.published;
    }
    /* 多持有方演示：两笔代币各由本企业两个地址与另一企业分持；份额价值 = 持有数量 × 代币价值 ÷ 代币数量。 */
    const A=D.HOLDERS['entity-demo-a'],B=D.HOLDERS['entity-demo-b'][0];
    [['TK-MH-2610-01',1000000,1200000,[[A[0],'entity-demo-a',400000,'FP-DEMO-001'],[A[1],'entity-demo-a',350000,'FP-DEMO-002'],[B,'entity-demo-b',250000,'FP-DEMO-008']]],
     ['TK-MH-2610-02',600000,600000,[[A[0],'entity-demo-a',300000,null],[A[1],'entity-demo-a',200000,null],[B,'entity-demo-b',100000,null]]]].forEach(([no,total,worth,shares],k)=>{
      shares.forEach(([holder,owner,units,pool],j)=>D.tokens.push({id:no+'#'+(j+1),no,holder,owner,kind:'erc20-ar',units,tokenUnits:total,tokenValue:worth,symbol:'AR-DEMO',value:D.shareValue(units,total,worth),valid:true,
        pool,pledge:pool?'pledged':'free',buyer:['Demo Buyer '+(k+3),'演示买方 '+(k+3)],due:'2027-04-20',from:'2026-10-02',tx:pool?'0x'+(900+k*10+j).toString(16).padStart(64,'0'):undefined}));
    });
    for(let i=1;i<=12;i++)D.tokens.push({id:'TK-FREE-'+String(i).padStart(2,'0'),owner:'entity-demo-a',kind:'erc20-ar',units:1,symbol:'AR-DEMO',value:[300000,300000,400000][(i-1)%3],valid:true,pool:null,pledge:'free',buyer:['Demo Buyer '+i,'演示买方 '+i],due:'2027-03-18',from:'2026-09-18'});
    const a={id:'PA-DEMO-001',project:D.projects[0].id,type:'additional',tokens:D.tokens.filter(t=>t.id.startsWith('TK-FREE')).slice(0,3).map(t=>t.id),state:'approved',submitted:new Date(D.now()-DAY).toISOString(),decided:new Date(D.now()-3600000).toISOString()};D.applications.push(a);a.tokens.forEach(id=>D.token(id).application=a.id);D.normalize();
    D.applications[1].batch='PA-DEMO-002';D.applications[1].approvedAt=new Date(D.now()-1800000).toISOString();D.applications[1].decided=D.applications[1].approvedAt;
    const pending=D.applications[2];pending.state=pending.reviewState='review';pending.decided=pending.approvedAt=pending.deadline=pending.agreement=pending.reviewer=null;
    /* 多持有方份额最近上链，排在质押代币清单前面，便于查看。 */
    D.applications.filter(x=>x.tokens.some(id=>id.startsWith('TK-MH-'))).forEach(x=>{const at=new Date(D.now()-6*3600000).toISOString();x.submitted=at;x.decided=at;x.approvedAt=at;});
    /* 水位演示，两个项目合约内都有有效抵押物、已失效、待审、已驳回四类代币：
       FP-DEMO-004 质押不足；FP-DEMO-007 质押持平但水位不安全（有效质押额覆盖融资余额，却低于融资余额 + 一笔已接受待放款的在途）。 */
    [['FP-DEMO-004','TK-DEMO-4-5','review'],['FP-DEMO-004','TK-DEMO-4-6','rejected'],['FP-DEMO-007','TK-DEMO-7-5','review'],['FP-DEMO-007','TK-DEMO-7-6','rejected']].forEach(([pid,id,st])=>{const t=D.token(id),x=D.applications.find(r=>r.project===pid&&r.tokens[0]===id);if(!t||!x)return;t.valid=true;
      x.state=x.reviewState=st;x.approvedAt=null;x.agreement=null;if(st==='review'){x.decided=null;x.reviewer=null;}else x.reason='rejected';});
    {const p7=D.project('FP-DEMO-007');if(p7){p7.balance=400000;p7.state='locked';const d=p7.demands[0];if(d)Object.assign(d,{amount:200000,state:'funding',tenorDays:90,rate:'6.20',institution:['Demo Capital','演示资金机构'],quoteAt:d.at});p7.grade=D.numbers(p7).grade;}}
    D.applications.forEach(a=>D.log(D.project(a.project),a.state==='approved'?'approved':'submitted',a.id));D.save();
  };
  try{
    const saved=JSON.parse(localStorage.getItem(KEY));
    if(saved&&saved.schema===SCHEMA&&Array.isArray(saved.projects)&&saved.projects.length){Object.assign(D,saved);delete D.schema;}
    else {CF.LSReseeded=true;D.seed();}
  }catch(_){CF.LSReseeded=true;D.seed();}
  D.normalize();D.sweep();
})(window.CF);
