/* WS-351: isolated, labelled demonstration service. No API, wallet or chain calls.
 * Token snapshots and lending facts remain separate. UI consumes action decisions
 * from this adapter; production must replace it with authenticated server responses.
 */
(function (CF) {
  'use strict';
  const KEY = CF.LSStorageKey || 'hc-ws351-demo-v3', DAY = 86400000;
  /* 演示数据结构变化时提升版本号：旧存档改为重新播种，避免恢复出互相对不上的记录。 */
  const SCHEMA = 'ws446-3';
  const D = CF.LS = { projects: [], tokens: [], applications: [], executions: [], events: [], approvals: [], offset: 0, serial: 100 };
  /* 代币类型：代币标准与底层资产类型合并成一个字段。id 沿用旧值，控制台等模块按它引用。 */
  D.TYPES = [{id:'erc20-ar',label:['ERC-3525-Receivables','ERC-3525-应收账款']}];
  D.type = id => D.TYPES.find(x=>x.id===id) || D.TYPES[0];
  /* 组合 = 区块链网络 + 代币类型：融资参数与一套共用合约（质押、放款、还款各一份）都按组合给出。 */
  D.PLEDGE_CHAIN = 'ETH';
  D.COMBOS = [{network:'ETH',kind:'erc20-ar',maxRate:0.8,maxTerm:12,pledge:'0x7d3E91a04c5B28f6A0e17C9d42b85F3a6c01E9b4'}];
  D.combo = (kind, network) => D.COMBOS.find(c=>c.kind===kind&&c.network===(network||D.PLEDGE_CHAIN)) || null;
  D.REPAY = ['Quarterly interest, principal at maturity','按季付息、到期还本付息'];
  D.SETTLE = [['USDT','USDT'],['USDC','USDC']];
  /* 一笔质押或释放交易可容纳的份数由研发按链上能力确定；演示取 8 份。 */
  D.BATCH_MAX = 8;
  /* 平台执行钱包（演示）：执行发布与改额的冻结、撤下与业务终结时的解冻，gas 由该钱包承担。 */
  D.EXEC_WALLET = '0x9F3a6C21e04B7d58A1c3E92b0D6f47C8a51E3B60';
  /* 演示登录钱包：发布与改额用它签名确认。 */
  D.LOGIN_WALLET = '0x1111111111111111111111111111111111111111';
  /* 演示交易哈希：交易发出、平台取得即有值；处理中、未成功与待核实的一笔同样带已取得的哈希。 */
  D.txHash = seed => { let h=2166136261>>>0; for(const c of String(seed)+(++D.serial)) h=Math.imul(h^c.charCodeAt(0),16777619)>>>0; return '0x'+Array.from({length:64},()=>(h=Math.imul(h^(h>>>13),1597334677)>>>0,(h>>>27).toString(16))).join(''); };
  /* 代币发行合约（演示）：授权记录在发行合约上，按“持有地址 + 质押合约”给出。 */
  D.ISSUERS = ['0x51a0E3c7B94d28F6e1c05A7b3D9f82e4C6a1B07d','0x6c2F9b18D47e05A3c9B1f62E8d0a7C45b3E9d218','0x8e47C1a9F03b6D25e8A4c7B19f0D3e62A5c8b941'];
  D.issuerOf = t => t ? (t.issuer || D.ISSUERS[0]) : '';
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
    const cap=project?project.termCap:D.combo(kindId)?.maxTerm;
    if(!cap)return {start,none:true};
    const min=[D.addMonths(start,3),D.addDays(D.today(),1)].sort().at(-1),max=D.addMonths(start,Math.min(cap,12));
    return {start,cap,min,max,empty:min>max};
  };
  D.endOf = day => new Date(Date.parse(day+'T00:00:00Z')+DAY).toISOString();
  /* 外部演示接入的项目可能缺少本模块字段：按同一口径补齐，页面不出现 undefined。 */
  D.fill = p => {
    if(!p)return p;
    if(!p.kind||p.kind==='ar')p.kind='erc20-ar';
    delete p.spv;
    const combo=D.combo(p.kind,p.network);
    if(!p.rate)p.rate=combo?combo.maxRate:0.8;
    p.settle=(p.settle||[]).filter(c=>c!=='USD');if(!p.settle.length)p.settle=['USDT'];
    if(!p.created)p.created=p.published||D.iso();
    if(!p.termCap)p.termCap=combo?combo.maxTerm:12;
    if(!p.attempts)p.attempts=[];
    if(!p.expiry){p.expiry=p.expires?p.expires.slice(0,10):D.addMonths(p.created.slice(0,10),p.term||12);p.expires=D.endOf(p.expiry);}
    if(p.contract&&!p.deployedAt)p.deployedAt=p.created;
    if(!p.contract)p.deployedAt=null;
    return p;
  };
  D.save = () => { try { localStorage.setItem(KEY, JSON.stringify({schema:SCHEMA,projects:D.projects,tokens:D.tokens,applications:D.applications,executions:D.executions,events:D.events,approvals:D.approvals,offset:D.offset,serial:D.serial})); } catch (_) {} };
  D.project = id => D.fill(D.projects.find(p => p.id === id));
  D.token = id => D.tokens.find(t => t.id === id);
  /* 当前演示身份代表的资产方企业；演示视角可切换到另一家企业查看同一项目。 */
  D.me = () => (CF.S.party && CF.S.party.asset) || 'entity-demo-a';
  D.mine = p => CF.S.role === 'asset' && p && p.owner === D.me();
  D.terminal = p => ['closed','settled'].includes(p.state);
  D.log = (p, key, ref) => {
    const a=D.applications.find(a=>a.id===ref), e=D.executions.find(e=>e.id===ref);
    const application=a?.id||e?.application||null, token=a?.tokens[0]||e?.token||null;
    if(application&&D.events.some(x=>x.key===key&&x.ref===ref))return;
    D.events.unshift({project:p.id,key,ref:ref||'',application,token,at:D.iso()});
  };
  D.latest = (p,id) => [...D.applications].reverse().find(a=>a.project===p.id&&a.tokens.includes(id)&&a.state==='pledged') || [...D.applications].reverse().find(a=>a.project===p.id&&a.tokens.includes(id));
  D.quoteFee = id => { const t=D.token(id);return {amount:t.feeEstimate??0.0004,currency:t.feeCurrency||'ETH'}; };
  D.normalize = () => {
    D.projects.forEach(p=>{
      D.fill(p);
      if(p.state==='draft')p.state='available';
    });
    D.tokens.forEach(t=>{if(t.kind==='ar')t.kind='erc20-ar';});
    /* 逐张质押记录：一份份额一次上链成功一条。质押不经审核，旧存档的审核态一律视为已质押成功。 */
    D.applications=D.applications.flatMap(a=>a.tokens.map((id,i)=>{
      const row={...a,id:a.tokens.length>1?a.id+'-'+(i+1):a.id,batch:a.batch||a.id,tokens:[id]};
      if(['review','approved','rejected'].includes(row.state))row.state='pledged';
      delete row.reviewState;delete row.reviewer;delete row.agreement;delete row.approvedAt;delete row.decided;delete row.reason;delete row.reasonText;delete row.source;delete row.authorizing;
      const t=D.token(id);if(t?.application===a.id)t.application=row.id;
      D.executions.filter(e=>e.application===a.id&&e.token===id).forEach(e=>e.application=row.id);
      return row;
    }));
    /* 每张在合约内的代币都有一条质押成功记录：播种数据按已质押补齐。 */
    D.projects.forEach(pr=>{
      D.tokens.filter(t=>t.pool===pr.id&&t.pledge==='pledged').forEach(t=>{
        if(D.applications.some(a=>a.project===pr.id&&a.tokens.includes(t.id)&&a.state==='pledged'))return;
        const at=pr.published||pr.created||D.iso();
        const a={id:'PA-SEED-'+t.id,batch:'PB-SEED-'+pr.id.slice(-3),type:'first',project:pr.id,tokens:[t.id],state:'pledged',submitted:at};
        D.applications.push(a);t.application=a.id;
      });
    });
  };
  /* 代币在合约内 = 已质押 = 质押成功；有效且无对账差异、未撤回预扣时计入有效质押额。 */
  D.appOf = (p,t) => D.applications.filter(a=>a.project===p.id&&a.tokens.includes(t.id)&&a.state==='pledged').at(-1);
  D.numbers = p => {
    const rate = p.rate || 0.8;
    const pool = D.tokens.filter(t => t.pool === p.id && t.pledge === 'pledged');
    const total = pool.reduce((v,t) => v+t.value,0);
    const valid = pool.filter(t => t.valid && !t.frozen && !t.pending);
    const value = valid.reduce((v,t) => v+t.value,0);
    /* 在途含发布或改额冻结处理中的预占：发布按本次金额，改额按新金额。 */
    const fly = p.demands.filter(d => ['open','quoted','funding'].includes(d.state)).reduce((v,d) => v+(d.edit&&d.edit.state==='processing'?d.edit.amount:d.amount),0)
      + (p.attempts||[]).filter(x=>x.state==='processing').reduce((v,x)=>v+x.amount,0);
    const limit = value*rate, free = Math.max(0,limit-p.balance-fly);
    return {rate,pool,total,valid,value,fly,limit,free,withdraw:free/rate,
      gap:Math.max(0,p.balance-limit),grade:limit<p.balance?'short':free>0?'surplus':'balanced'};
  };
  /* 质押水位：有效质押额 < 项目融资余额 + 项目在途金额即为不安全，恰好相等仍算安全；项目终态后不再判断。 */
  D.waterLocked = p => {if(D.terminal(p))return false;const n=D.numbers(p);return n.limit < p.balance + n.fly;};
  /* 质押份额：本企业一个持有地址上持有的某笔代币的全部数量，是质押、解押与提取的最小单位。
     D.tokens 的每条记录即一份份额；no 为代币编号，holder 为持有地址，units 为持有数量，value 为份额价值。 */
  D.HOLDERS = {'entity-demo-a':['0x2a71c0d4e9b38f15a6c27d90e4b1f83c5d6a9e21','0x2b84f1a3c6d90e27b5a48c13f9e06d72a1c5b384'],'entity-demo-b':['0x3c95e2b4d7a01f38c6b59d24a0f17e83b2d6c495']};
  D.tokenNo = t => t ? (t.no || t.id) : '';
  D.holderOf = t => t ? (t.holder || (D.HOLDERS[t.owner] || [''])[0]) : '';
  D.shareValue = (units, tokenUnits, tokenValue) => Math.round(units * tokenValue / tokenUnits * 100) / 100;
  D.current = p => p.demands.find(d => ['open','quoted','funding'].includes(d.state));
  /* 发布或改额的冻结处理中：发布尚未成立，不能再次发布、改额或撤下。 */
  D.freezing = p => (p.attempts||[]).some(x=>x.state==='processing') || p.demands.some(d=>d.edit&&d.edit.state==='processing'||d.withdraw&&d.withdraw.state==='processing');
  /* 本轮冻结：冻结质押价值 = 需求金额 ÷ 项目质押率；未成交终结即解除，成交后保留到该笔结清。 */
  D.freezeOf = (p,d) => {
    if(!d)return null;
    if(!d.freeze)d.freeze={value:d.amount/p.rate,state:'frozen',at:d.at,done:d.at,tx:'0x'+(parseInt(String(d.id).replace(/\D/g,''),10)||7).toString(16).padStart(64,'f').slice(-64),log:[]};
    if(d.state==='ended'&&d.freeze.state==='frozen'||D.terminal(p)&&d.freeze.state==='frozen'){d.freeze.state='released';d.freeze.releasedAt=d.endedAt||D.iso();d.freeze.releasedBy=d.freeze.releasedBy||D.EXEC_WALLET;d.freeze.releaseTx='0x'+String(d.freeze.tx).slice(4)+'e1';}
    return d.freeze;
  };
  D.frozenValue = p => p.demands.map(d=>D.freezeOf(p,d)).filter(f=>f&&f.state==='frozen').reduce((v,f)=>v+f.value,0);
  D.actions = p => {
    const n=D.numbers(p), current=D.current(p), mine=D.mine(p), terminal=D.terminal(p), freezing=D.freezing(p);
    /* 可撤回上限只约束有效抵押物；水位不安全时合约内的代币（含已失效）一律不能转出，已释放待提取照常可办理。 */
    const releasable=D.tokens.filter(t => {if((t.pool!==p.id&&t.releasedFrom!==p.id)||t.pending||t.frozen)return false;if(t.pledge==='released')return true;if(t.pledge!=='pledged')return false;if(D.waterLocked(p))return false;return !t.valid||t.value<=n.withdraw;});
    const live=!terminal&&!['review','returned'].includes(p.state);
    return {mine,review:p.state==='review',returned:p.state==='returned',live,
      pledge:mine&&live,publish:mine&&live&&!p.expired&&!current&&!freezing&&n.value>0&&n.free>0,freezing,
      edit:mine&&current&&current.state==='open'&&!p.expired&&!freezing,withdraw:mine&&releasable.length>0,
      close:mine&&!terminal&&!p.expired,canClose:mine&&!terminal&&!p.expired&&!p.deploying&&!D.unfinished(p).length,
      quote:CF.S.role==='fund'&&current&&current.state==='open'&&!terminal&&!p.expired&&n.grade==='surplus'};
  };
  /* 只有通过代币准入审核的代币进入本模块；待审核、已退回的在任何地方都不出现。 */
  D.admitted = t => !!t && !['pending','returned'].includes(t.admission);
  /* 创建时的代币类型候选：本企业在所选网络上持有该类型的已准入代币；组合是否已配置参数另行判断。 */
  D.kinds = (network) => D.TYPES.filter(x=>D.tokens.some(t=>t.owner===D.me()&&D.admitted(t)&&t.kind===x.id)).map(x=>x.id);
  D.selectable = (t,p) => t && t.owner===D.me()&&D.admitted(t)&&t.valid&&t.kind===(p?.kind||'erc20-ar')&&t.pledge==='free'&&!t.pending&&!t.application&&!t.frozen;
  /* 授权按“持有地址 + 质押合约”给出，链上记录在各代币发行合约上：所选份额来自几个未授权的发行合约，就要授权几次。 */
  D.approvalOf = (holder, contract, issuer) => [...D.approvals].reverse().find(a=>a.holder===holder&&a.contract===contract&&a.issuer===issuer);
  D.approvalNeeds = (p, ids) => {
    const tokens=ids.map(D.token).filter(Boolean),out=[];
    tokens.forEach(t=>{const holder=D.holderOf(t),issuer=D.issuerOf(t);let row=out.find(x=>x.holder===holder&&x.issuer===issuer);if(!row){row={holder,issuer,count:0,record:D.approvalOf(holder,p.contract,issuer)};out.push(row);}row.count++;});
    return out;
  };
  D.approvalsReady = (p, ids) => D.approvalNeeds(p, ids).every(x=>x.record&&x.record.state==='success');
  D.APPROVE_FEE = 0.00021;
  D.approve = (p, holder, issuer) => {
    if(!D.mine(p))throw Error('permission');
    const prior=D.approvalOf(holder,p.contract,issuer);if(prior&&['processing','success'].includes(prior.state))throw Error('approvalChanged');
    const rec={id:'AP-DEMO-'+(++D.serial),holder,contract:p.contract,issuer,state:'processing',at:D.iso(),fee:null,feeCurrency:'ETH',tx:D.txHash('approve'+issuer)};
    D.approvals.push(rec);D.save();return rec;
  };
  D.approvalResult = (rec, result) => {
    if(!rec||rec.state!=='processing')return;
    rec.state=result==='success'?'success':'failure';rec.done=D.iso();rec.fee=result==='noFee'?0:D.APPROVE_FEE;
    D.save();
  };
  D.releaseApplication = a => a.tokens.forEach(id => { const t=D.token(id);if(t.application===a.id)t.application=null; });
  D.recompute = p => {
    let n=D.numbers(p);
    [...p.demands].reverse().forEach(d => {
      if (['open','quoted'].includes(d.state) && n.limit < p.balance+n.fly) {
        d.state='ended';d.reason='coverage';d.endedAt=D.iso();d.quoteState='ended';D.freezeOf(p,d);D.log(p,'demandVoided',d.id);n=D.numbers(p);
      }
    });
    if(!D.terminal(p)&&!D.current(p)&&!['review','returned'].includes(p.state))p.state=p.balance||CF.L8?.hasUnsettled?.(p)||p.demands.some(d=>d.state==='funding')?'financing':'available';
    if(n.grade!==p.grade){ if(n.grade==='short'||p.grade==='short')D.log(p,n.grade==='short'?'coverageShort':'coverageRestored'); p.grade=n.grade;p.coverageAt=D.iso(); }
  };
  /* 未处理完成的业务：待确认的报价、待放款 / 待放款确认、未结清（含逾期）、处理中的链上操作。任一存在时不能关闭、不转已结清、不整池释放。 */
  D.unfinished = p => {
    const out=[];
    if(p.demands.some(d=>d.state==='quoted'))out.push('quoted');
    if(p.demands.some(d=>d.state==='funding'))out.push('funding');
    if(p.balance>0||CF.L8?.hasUnsettled?.(p))out.push('unsettled');
    if(D.executions.some(e=>e.project===p.id&&e.state==='processing')||D.tokens.some(t=>(t.pool===p.id||t.releasedFrom===p.id)&&t.pending)||D.freezing(p))out.push('processing');
    return out;
  };
  /* 到期自动终结（Q-LS-22）：到期且没有未处理完成的业务时终结——有过成交的转已结清，从未成交的转已关闭（有效期到期）；两者都整池释放。
     到期时仍有业务的，最后一项处理完成时按同一规则终结。未到期时全部结清只回到可用。 */
  D.hadDeal = p => p.demands.some(d=>['funding','funded'].includes(d.state))||(CF.CQ?.data?.().quotes||[]).some(q=>q.project===p.id&&['funding','funded'].includes(q.state));
  D.autoEnd = p => {
    /* D-LS-72：待审核或已退回到期自动关闭（有效期到期）；合约配置进行中跨过有效期至的，等回写后再处理。 */
    if(p&&p.expired&&['review','returned'].includes(p.state)){
      if(p.deploying)return false;
      p.state='closed';p.closeReason='expiry';D.releasePool(p);D.log(p,'closed');return true;
    }
    if(!p||!p.expired||D.terminal(p)||['review','returned'].includes(p.state)||D.unfinished(p).length)return false;
    if(D.hadDeal(p))p.state='settled';else{p.state='closed';p.closeReason='expiry';}
    D.releasePool(p);D.log(p,p.state==='settled'?'settled':'closed');return true;
  };
  /* 终态整池释放：池内全部质押代币转为已释放待提取，由资产方签名提取。 */
  D.releasePool = p => {
    D.tokens.filter(t=>t.pool===p.id&&t.pledge==='pledged'&&!t.pending).forEach(t=>{t.pool=null;t.pledge='released';t.releasedFrom=p.id;});
    D.applications.filter(a=>a.project===p.id&&a.state==='pledged').forEach(a=>{a.state='void';a.reason='closed';a.finished=D.iso();D.releaseApplication(a);});
    D.log(p,'businessRelease');
  };
  D.sweep = () => {
    let changed=false;
    /* 本模块没有任何倒计时类时限：项目审核与报价都不因等待自动改变结论。 */
    D.projects.forEach(p=>{if(p.expires&&!p.expired&&D.now()>=Date.parse(p.expires)){p.expired=true;const d=D.current(p);if(d&&['open','quoted'].includes(d.state)){d.state='ended';d.reason='expiry';d.endedAt=D.iso();d.quoteState='ended';D.freezeOf(p,d);D.log(p,'demandExpired',d.id);}if(!D.terminal(p))D.recompute(p);D.log(p,'projectExpired');changed=true;}if(D.autoEnd(p))changed=true;});
    if(changed)D.save();return changed;
  };
  /* 创建即提交审核：不勾代币、不上链、不签名、不收费。 */
  D.createProject = (form, project) => {
    if(CF.S.role!=='asset')throw Error('permission');
    const title=(form.name||'').trim();
    if(!title||[...title].length>60)throw Error('name');
    if(!D.kinds().includes(form.kind))throw Error('kind');
    const cfg=D.combo(form.kind);if(!cfg)throw Error('comboClosed');
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
    const p={id:'FP-DEMO-'+(++D.serial),name:[title,title],owner:D.me(),kind:form.kind,rate:rate/100,termCap:cfg.maxTerm,
      network:D.PLEDGE_CHAIN,settle:[...form.settle],repay:D.REPAY,contract:null,deployedAt:null,state:'review',balance:0,demands:[],attempts:[],
      created,published:null,expiry:form.expiry,expires:D.endOf(form.expiry)};
    D.projects.unshift(p);D.log(p,'created');D.save();return p;
  };
  /* 审核与合约配置是同一步：运营选定本组合的共用合约，平台在链上配置成功即审核通过。deploying 表示配置处理中。 */
  /* 配置进行中（含结果待核实）：资产方看到的仍是待审核，但暂不可关闭；回写后按结果处理。 */
  D.decideProject = (p, outcome, reason) => {
    if(p.state!=='review')throw Error('reviewChanged');
    if(outcome==='submit'){if(p.deploying)throw Error('reviewChanged');if(p.expired)throw Error('projectExpired');p.deploying=true;D.save();return true;}
    if(outcome==='approve'&&p.expired&&!p.deploying)throw Error('projectExpired');
    if(outcome==='return'&&p.deploying)throw Error('reviewChanged');
    p.deploying=false;
    if(outcome==='approve'){
      p.state='available';p.reviewReason=null;
      p.contract=(D.combo(p.kind,p.network)||D.COMBOS[0]).pledge;p.deployedAt=D.iso();
      D.log(p,'projectApproved');
    } else if(outcome==='deployFailed'){ D.log(p,'deployFailed'); }
    else { p.state='returned';p.reviewReason=reason||['The submitted project details need a correction.','提交的创建信息需要修正后再提交。'];D.log(p,'projectReturned'); }
    /* 配置进行中跨过有效期至：成功即通过、随后按可用状态到期终结；失败随即关闭。 */
    D.autoEnd(p);
    D.save();return true;
  };

  D.execute = (p, kind, ids, appId) => {
    if(!D.mine(p))throw Error('permission');
    if(ids.length>D.BATCH_MAX)throw Error('batchLimit');
    if(kind==='deposit'){
      if(!D.actions(p).pledge)throw Error('closed');
      if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!D.selectable(D.token(id),p)))throw Error('selectionChanged');
      if(!D.approvalsReady(p,ids))throw Error('approvalRequired');
    }
    else {
      const n=D.numbers(p);if(!ids.length||ids.some(id=>{const t=D.token(id);return !t||t.owner!==p.owner||t.frozen||t.pending||!(t.pool===p.id&&t.pledge==='pledged'||t.releasedFrom===p.id&&t.pledge==='released');}))throw Error('selectionChanged');
      const amount=ids.map(D.token).filter(t=>t.pledge==='pledged'&&t.valid).reduce((v,t)=>v+t.value,0);if(amount>n.withdraw)throw Error('withdrawLimit');
    }
    /* 一次签名一个提交批次编号；同批逐张各自回写。 */
    const batch='PB-'+String(++D.serial).padStart(6,'0'),batchTx=D.txHash(batch);
    ids.forEach(id=>{const t=D.token(id);const actualKind=kind==='deposit'?'deposit':t.pledge==='released'?'redeem':'withdraw';const e={id:'EX-DEMO-'+(++D.serial),project:p.id,token:id,application:kind==='deposit'?null:D.appOf(p,t)?.id||null,kind:actualKind,batch,state:'processing',at:D.iso(),fee:null,feeCurrency:D.quoteFee(id).currency,holder:D.holderOf(t),tx:batchTx};D.executions.push(e);t.pending=e.id;D.log(p,'executionStarted',e.id);});D.save();
  };
  D.result = (e, result) => {
    const t=D.token(e.token),p=D.project(e.project);
    if(e.state!=='processing'&&result==='late'){t.frozen=true;e.late=true;e.conflictAt=D.iso();D.log(p,'reconciliation',e.id);D.recompute(p);D.save();return;}
    if(e.state!=='processing'||!['success','failure','noFee','contract'].includes(result))return;
    /* 质押合约判断不允许转出：交易执行失败，代币仍在合约内，已产生的 gas 不退。 */
    if(result==='contract'){e.reason='contract';result='failure';}
    const a=D.applications.find(a=>a.id===e.application);
    if(e.kind==='deposit'&&D.terminal(p)){e.observedResult=result;e.observedAt=D.iso();e.fee=result==='noFee'?0:D.quoteFee(e.token).amount;e.boundary=true;D.save();return;}
    e.state=result;e.done=D.iso();e.fee=result==='noFee'?0:D.quoteFee(e.token).amount;
    t.pending=null;
    if(e.kind==='deposit'){
      if(result==='success'){
        t.pledge='pledged';t.pool=p.id;t.tx=e.tx;
        /* 上链成功即质押成功：代币有效且无对账差异时立即计入有效质押额；不发站内信。 */
        /* 申请类型按上链成功时本项目是否已有有效质押派生，只用于展示与检索。 */
        const type=D.numbers(p).value>0?'additional':'first';
        const a2={id:'PA-DEMO-'+(++D.serial),batch:e.batch||e.id,type,project:p.id,tokens:[t.id],state:'pledged',submitted:D.iso(),tx:e.tx};
        D.applications.push(a2);t.application=a2.id;D.log(p,'onChain',a2.id);
      }
      else {t.pledge='free';t.pool=null;}
    }else if(result==='success'){const a3=D.appOf(p,t);if(a3){a3.state='withdrawn';a3.finished=D.iso();}t.pledge='free';t.pool=null;t.releasedFrom=null;t.application=null;}
    /* 终态时转出失败：关闭时因处理中未随整池释放的份额补记为已释放待提取。 */
    else if(D.terminal(p)&&t.pledge==='pledged'){t.pledge='released';t.pool=null;t.releasedFrom=p.id;}
    D.log(p,result==='success'?'executionSuccess':'executionFailed',e.id);D.recompute(p);D.save();
  };
  /* 发布与改额：资产方用登录钱包签名确认（不上链、无 gas），平台核验后由平台执行钱包发起冻结交易；冻结上链成功才算发布或改额成功。 */
  D.publishStart = (p, amount, edit, payee, signer) => {
    D.sweep();const a=D.actions(p),n=D.numbers(p),current=D.current(p);
    if(!D.mine(p))throw Error('permission');if(edit?!a.edit:!a.publish)throw Error('publishChanged');
    const max=n.free+(edit?current.amount:0);if(!Number.isFinite(amount)||amount<=0||Math.abs(Math.round(amount*100)-amount*100)>1e-6||amount>max)throw Error('amount');
    const value=amount/p.rate,at=D.iso();
    if(edit){current.edit={amount,value,from:current.amount,fromValue:D.freezeOf(p,current).value,at,state:'processing',signer,tx:D.txHash('edit'+current.id)};}
    else{if(!payee||payee.chain!=='ETH'||!payee.address)throw Error('payee');
      p.attempts.push({id:'AT-DEMO-'+(++D.serial),amount,value,payee,signer,at,state:'processing',tx:D.txHash('publish'+p.id)});}
    D.log(p,edit?'editSigned':'publishSigned');D.save();
  };
  /* 冻结结果回写：成功即发布（生成融资申请编号、待报价、借贷广场可见）或改额生效；失败不生成需求、预占释放，改额保持原值。 */
  D.freezeResult = (p, result) => {
    if(result==='wait')return false;
    let changed=false;const ok=result==='success',tx=()=>'0x'+String(++D.serial).padStart(64,'c');
    (p.attempts||[]).filter(x=>x.state==='processing').forEach(x=>{changed=true;
      if(!ok){x.state='failed';x.done=D.iso();D.log(p,'freezeFailed',x.id);return;}
      const at=D.iso(),hash=x.tx||tx();
      p.demands.push({id:p.id+'-'+String(p.demands.length+1).padStart(2,'0'),amount:x.amount,state:'open',at,payee:x.payee,signer:x.signer,signedAt:x.at,
        freeze:{value:x.value,state:'frozen',at:x.at,done:at,tx:hash,log:[]}});
      p.attempts=p.attempts.filter(y=>y!==x);p.state='raising';if(!p.published)p.published=at;D.log(p,'published');});
    p.demands.filter(d=>d.edit&&d.edit.state==='processing').forEach(d=>{changed=true;const f=D.freezeOf(p,d),e=d.edit;
      f.log.push({kind:'edit',from:e.from,to:e.amount,fromValue:e.fromValue,toValue:e.value,at:e.at,done:D.iso(),state:ok?'success':'failed',tx:e.tx||tx(),signer:e.signer});
      if(ok){d.amount=e.amount;f.value=e.value;D.log(p,'amountEdited',d.id);}else D.log(p,'freezeFailed',d.id);
      delete d.edit;});
    if(changed){D.recompute(p);D.save();}
    return changed;
  };
  /* 撤下：用质押时签名的地址（本项目合约内份额的原持有地址之一）签名，平台执行钱包执行解冻；解冻上链成功即撤下成功。 */
  D.pledgeSigners = p => [...new Set(D.tokens.filter(t=>t.pool===p.id&&t.pledge==='pledged').map(D.holderOf).filter(Boolean))];
  D.withdrawStart = (p, signer) => {
    const a=D.actions(p);if(!D.mine(p))throw Error('permission');if(!a.edit)throw Error('demandChanged');
    if(!D.pledgeSigners(p).includes(signer))throw Error('withdrawSigner');
    const d=D.current(p);d.withdraw={state:'processing',at:D.iso(),signer,tx:D.txHash('withdraw'+d.id)};D.log(p,'withdrawSigned',d.id);D.save();
  };
  D.withdrawResult = (p, result) => {
    const d=p.demands.find(x=>x.withdraw&&x.withdraw.state==='processing');if(!d||result==='wait')return false;
    const w=d.withdraw;delete d.withdraw;
    if(result==='success'){const f=D.freezeOf(p,d);d.state='ended';d.reason='withdrawn';d.endedAt=D.iso();
      Object.assign(f,{state:'released',releasedAt:d.endedAt,releasedBy:w.signer,releaseKind:'withdraw',releaseTx:w.tx});
      D.recompute(p);D.log(p,'demandWithdrawn',d.id);}
    else {D.freezeOf(p,d).log.push({kind:'withdraw',at:w.at,done:D.iso(),state:'failed',tx:w.tx,signer:w.signer});D.log(p,'freezeFailed',d.id);}
    D.save();return true;
  };
  D.endDemand = p => {const a=D.actions(p);if(!a.edit)throw Error('demandChanged');const d=D.current(p);d.state='ended';d.reason='withdrawn';d.endedAt=D.iso();D.freezeOf(p,d);D.recompute(p);D.log(p,'demandWithdrawn',d.id);D.save();};
  D.close = p => {if(p.deploying)throw Error('deploying');if(!D.actions(p).canClose)throw Error('cannotClose');
    /* 尚未收到报价的需求随项目关闭一并终结。 */
    p.demands.filter(d=>d.state==='open').forEach(d=>{d.state='ended';d.reason='closed';d.endedAt=D.iso();d.quoteState='ended';D.freezeOf(p,d);D.log(p,'demandWithdrawn',d.id);});
    p.state='closed';p.closeReason='owner';D.releasePool(p);D.log(p,'closed');D.save();};
  D.seed = () => {
    D.projects=[];D.tokens=[];D.applications=[];D.executions=[];D.events=[];D.approvals=[];D.offset=0;D.serial=100;
    /* 融资收款地址快照（演示）：取本企业在企业账户登记的以太坊数币账户，发布成功后随本轮固定。 */
    const PAYEE={'entity-demo-a':{id:'EA-DEMO-C02',kind:'crypto',chain:'ETH',label:['Collection wallet','收款钱包'],address:'0x00000000000000000000000000000000000000a2'},
      'entity-demo-b':{id:'EA-DEMO-C31',kind:'crypto',chain:'ETH',label:['Main wallet','主钱包'],address:'0x00000000000000000000000000000000000000c1'}};
    const POOL=D.COMBOS[0].pledge;
    for(let i=1;i<=24;i++){
      const created=new Date(D.now()-(i+2)*DAY).toISOString(),expiry=D.addMonths(created.slice(0,10),[12,9,6][i%3]);
      const p={id:'FP-DEMO-'+String(i).padStart(3,'0'),name:['Receivables pool '+String(i).padStart(2,'0'),'应收账款资产池 '+String(i).padStart(2,'0')],owner:i<=7?'entity-demo-a':'entity-demo-b',kind:'erc20-ar',network:'ETH',rate:0.8,termCap:12,settle:i%2?['USDT','USDC']:['USDT'],repay:D.REPAY,contract:POOL,deployedAt:new Date(Date.parse(created)+3*3600000).toISOString(),attempts:[],state:i===3?'locked':i===4?'financing':i===5?'settled':i===6?'closed':'raising',balance:i===4?500000:0,demands:[],created,published:new Date(D.now()-i*DAY).toISOString(),expiry,expires:D.endOf(expiry),quotes:i===3?1:0};
      if(i!==5&&i!==6)p.demands.push({id:p.id+'-01',amount:i===4?500000:300000,state:i===4?'funded':i===3?'quoted':'open',at:p.published,payee:PAYEE[p.owner],signer:D.LOGIN_WALLET,signedAt:p.published,tenorDays:i===3?90:i===4?120:null,rate:i===3?'6.40':i===4?'6.80':null,institution:i===3?['Demo Capital','演示资金机构']:null,quoteAt:i===3?p.published:null});
      /* 已结清示例按 Q-LS-22 是到期后自动终结的项目。 */
      if(i===5){p.expiry=D.addDays(D.today(),-1);p.expires=D.endOf(p.expiry);p.expired=true;
        /* 项目期限须在 3 个月～1 年内（D-LS-66）：创建日取到期日前 6 个月，发布与部署时间随之落在期限内。 */
        p.created=D.addMonths(p.expiry,-6)+'T02:00:00.000Z';p.deployedAt=new Date(Date.parse(p.created)+3*3600000).toISOString();}
      if(i===6)p.closeReason='owner';
      D.projects.push(p);
      for(let j=1;j<=7;j++){const released=[5,6].includes(i);const value=j===7?100000:150000;
        D.tokens.push({id:'TK-DEMO-'+i+'-'+j,owner:p.owner,kind:'erc20-ar',issuer:D.ISSUERS[0],slot:String(1000+i*10+j),units:1,symbol:'AR-DEMO',value,valid:i===4?j<=3:j!==7,pool:released?null:p.id,releasedFrom:released?p.id:null,pledge:released?'released':'pledged',buyer:['Demo Buyer '+j,'演示买方 '+j],due:'2027-01-20',from:'2026-07-20',tx:'0x'+(i*10+j).toString(16).padStart(64,'0')});}
      p.grade=D.numbers(p).grade;p.coverageAt=p.published;
    }
    /* 多持有方演示：两笔代币各由本企业两个地址与另一企业分持；份额价值 = 持有数量 × 代币价值 ÷ 代币数量。 */
    const A=D.HOLDERS['entity-demo-a'],B=D.HOLDERS['entity-demo-b'][0];
    [['TK-MH-2610-01',1000000,1200000,[[A[0],'entity-demo-a',400000,'FP-DEMO-001'],[A[1],'entity-demo-a',350000,'FP-DEMO-002'],[B,'entity-demo-b',250000,'FP-DEMO-008']]],
     ['TK-MH-2610-02',600000,600000,[[A[0],'entity-demo-a',300000,null],[A[1],'entity-demo-a',200000,null],[B,'entity-demo-b',100000,null]]]].forEach(([no,total,worth,shares],k)=>{
      shares.forEach(([holder,owner,units,pool],j)=>D.tokens.push({id:no+'#'+(j+1),no,holder,owner,kind:'erc20-ar',issuer:D.ISSUERS[k?2:0],slot:String(2610+k),units,tokenUnits:total,tokenValue:worth,symbol:'AR-DEMO',value:D.shareValue(units,total,worth),valid:true,
        pool,pledge:pool?'pledged':'free',buyer:['Demo Buyer '+(k+3),'演示买方 '+(k+3)],due:'2027-04-20',from:'2026-10-02',tx:pool?'0x'+(900+k*10+j).toString(16).padStart(64,'0'):undefined}));
    });
    /* 可质押演示：1～6 号来自已对本质押合约授权的发行合约，7～10 号来自尚未授权的另一发行合约；11、12 号仍在代币准入审核中，不出现。 */
    for(let i=1;i<=12;i++)D.tokens.push({id:'TK-FREE-'+String(i).padStart(2,'0'),owner:'entity-demo-a',kind:'erc20-ar',issuer:D.ISSUERS[i<=6?0:1],slot:String(3000+i),admission:i>10?'pending':'approved',units:1,symbol:'AR-DEMO',value:[300000,300000,400000][(i-1)%3],valid:true,pool:null,pledge:'free',buyer:['Demo Buyer '+i,'演示买方 '+i],due:'2027-03-18',from:'2026-09-18'});
    D.normalize();
    /* 多持有方份额按一次追加签名入池：同一提交批次，申请类型为追加。 */
    D.applications.filter(x=>x.tokens.some(id=>id.startsWith('TK-MH-'))).forEach(x=>{x.batch='PB-SEED-MH-'+x.project.slice(-3);x.type='additional';});
    /* 多持有方份额最近上链，排在质押代币清单前面，便于查看。 */
    D.applications.filter(x=>x.tokens.some(id=>id.startsWith('TK-MH-'))).forEach(x=>{x.submitted=new Date(D.now()-6*3600000).toISOString();});
    /* 水位演示：FP-DEMO-004 质押不足；FP-DEMO-007 质押持平但水位不安全（有效质押额覆盖融资余额，却低于融资余额 + 一笔已接受待放款的在途）。 */
    {const p7=D.project('FP-DEMO-007');if(p7){p7.balance=400000;p7.state='financing';const d=p7.demands[0];if(d)Object.assign(d,{amount:200000,state:'funding',tenorDays:90,rate:'6.20',institution:['Demo Capital','演示资金机构'],quoteAt:d.at});p7.grade=D.numbers(p7).grade;}}
    /* 本企业两个持有地址此前已对共用质押合约授权首个发行合约。 */
    A.forEach(holder=>D.approvals.push({id:'AP-SEED-'+holder.slice(-4),holder,contract:POOL,issuer:D.ISSUERS[0],state:'success',at:D.projects[0].deployedAt,done:D.projects[0].deployedAt,fee:D.APPROVE_FEE,feeCurrency:'ETH',tx:'0x'+'ab'.repeat(32)}));
    D.projects.forEach(p=>p.demands.forEach(d=>D.freezeOf(p,d)));
    D.applications.forEach(a=>D.log(D.project(a.project),'onChain',a.id));D.save();
  };
  try{
    const saved=JSON.parse(localStorage.getItem(KEY));
    if(saved&&saved.schema===SCHEMA&&Array.isArray(saved.projects)&&saved.projects.length){Object.assign(D,saved);delete D.schema;}
    else {CF.LSReseeded=true;D.seed();}
  }catch(_){CF.LSReseeded=true;D.seed();}
  D.normalize();D.sweep();
})(window.CF);
