/* WS-464 · 融资台账（运营端，只读）：一个菜单、两个清单（融资项目、融资需求），详情以 tab 承载。
   项目详情：项目基本信息 / 代币质押 / 融资需求；需求详情：需求信息 / 报价放款 / 还款。
   清单只显示业务状态；链上处理中、待核实与原因说明只在详情中展示。
   合约地址只在项目基本信息展示；交易哈希只在操作记录展示（质押记录一份、融资需求一份），缩写、点击复制、可跳转区块链浏览器。
   会话与功能权限读运营端账户与登录一处登记（CF.opsAuth）：
   PM-LG-01 融资台账查询（原型内部键 24）；PM-AL-17 融资项目审核查询（17）只决定项目审核详情入口。
   台账不办理、不改写任何业务状态；数据为本模块自有的演示数据，读取状态由演示工具模拟。 */
(function(CF){
  'use strict';
  const S=CF.S,L=CF.L,E=CF.esc,OPS=CF.opsAccountModule,$=id=>document.getElementById(id);
  const LIST='P-O-LG-01',DT='P-O-LG-02',ROOT='/ops/financing-ledger',DETAIL=ROOT+'/detail';
  const OPS_PAGES=['P-O-AL-01','P-O-AL-03','P-O-AL-04','P-O-AL-05','P-O-AL-06','P-O-AL-07'];
  const PERM=24,REVIEW_PERM=17;
  const TRAIL='hc.ops.ledger.trail.v2',VIEWS='hc.ops.ledger.views.v2';

  /* ---------------------------------------------------------------- 词表 */
  const TABS=['projects','demands'];
  const TAB={projects:['Financing projects','融资项目清单'],demands:['Financing demands','融资需求清单']};
  const TYPE={projects:'project',demands:'demand'};
  const TAB_OF={project:'projects',demand:'demands'};
  const KIND={project:['Financing project','融资项目'],demand:['Financing demand','融资需求']};
  const DTABS={project:[['info',['Project','项目基本信息']],['pledges',['Token pledges','代币质押']],['demands',['Financing demands','融资需求']]],
    demand:[['info',['Demand','需求信息']],['quotes',['Quotes and loans','报价放款']],['repay',['Repayment','还款']],['ops',['Operation records','操作记录']]]};
  const EMPTY={projects:['No financing projects yet','暂无融资项目'],demands:['No financing demands yet','暂无融资需求']};
  const PROJECT={available:['Available','可用','gray'],raising:['Raising','募集中','accent'],locked:['Locked','已锁定','violet'],
    financing:['Financing','融资中','ok'],closed:['Closed','已关闭','gray'],settled:['Settled','已结清','gray']};
  const COVER={sufficient:['Sufficient','质押充足','ok'],even:['Even','质押持平','warn'],short:['Insufficient','质押不足','danger']};
  const DEST={processing:['Pledge on-chain in progress','质押上链处理中','accent'],counted:['Counted in effective pledge','已计入有效质押额','ok'],
    excluded:['Pledged · not counted','已质押·不计入有效质押','warn'],withdrawing:['Withdrawal in progress','解押处理中','accent'],
    returned:['Withdrawn and returned','已解押退回','gray'],released:['Released, awaiting withdrawal','已释放待提取','violet']};
  const REASON={invalid:['Underlying asset invalid','底层资产失效'],recon:['Reconciliation difference','对账差异'],withdraw:['Withdrawal pre-deduction','撤回预扣']};
  const REMOVAL={withdraw:['Withdrawn by the asset holder','资产方撤回'],invalidOut:['Invalid token cleared','失效代币清出'],
    close:['Released on project closure','项目关闭释放'],settle:['Released on project settlement','项目结清释放']};
  const EXEC={success:['Succeeded','成功','ok'],processing:['In progress','处理中','accent'],unknown:['To be verified','待核实','warn']};
  const TOKEN_STATE={valid:['Valid','有效','ok'],invalid:['Invalid','失效','danger']};
  const APPLY={first:['First pledge','首笔质押'],add:['Additional pledge','追加质押']};
  const DEMAND={awaiting:['Awaiting quotes','待报价','accent'],quoted:['Quoted, awaiting confirmation','已报价待确认','accent'],
    lending:['Disbursing','放款中','accent'],funded:['Disbursed','已放款','ok'],ended:['Expired / closed','已失效／已关闭','gray']};
  const CHAIN={publishing:['Publish freeze in progress','发布冻结处理中'],resizing:['Amount-change freeze in progress','改额冻结处理中'],
    withdrawing:['Withdrawal in progress','撤下处理中'],lending:['On-chain disbursement in progress','链上放款处理中']};
  /* 操作记录的操作名：需求一份（发布至还款），质押记录一份（质押至提取）。 */
  const OPKIND={publish:['Publish · freeze','发布冻结'],resize:['Amount change · freeze adjustment','修改金额 · 冻结调整'],
    withdraw:['Withdraw · unfreeze','撤下 · 解冻'],release:['Platform freeze release','平台解除冻结'],unfreeze:['Platform freeze release','平台解除冻结'],
    quoteAuth:['Quote authorisation','报价授权'],disburse:['On-chain disbursement','链上放款'],
    repayAuth:[n=>`Period ${n} repayment authorisation`,n=>`第 ${n} 期还款授权`],repay:[n=>`Period ${n} on-chain repayment`,n=>`第 ${n} 期链上还款`]};
  const PLOP={pledge:['Pledge','质押'],unpledge:['Unpledge','解押'],withdraw:['Withdraw','撤回'],redeem:['Collect','提取']};
  const OPSTATE={processing:['In progress','处理中','accent'],failed:['Not completed','未成功','danger'],unknown:['To be verified','待核实','warn']};
  /* 交易类别对应的交易哈希称谓，用于复制与跳转的可访问名。 */
  const TXKIND={publish:['freeze','冻结'],resize:['freeze','冻结'],withdraw:['freeze','冻结'],release:['freeze','冻结'],unfreeze:['freeze','冻结'],
    quoteAuth:['authorisation','授权'],disburse:['disbursement','放款'],repayAuth:['authorisation','授权'],repay:['repayment','还款'],
    pledge:['pledge','质押'],unpledge:['transfer-out','转出'],redeem:['transfer-out','转出']};
  const QUOTE={confirming:['Quote confirming on-chain','报价上链确认中','accent'],pending:['Awaiting acceptance','待接受','accent'],
    accepted:['Accepted','已接受','ok'],rejected:['Rejected','已拒绝','gray'],expired:['Quote expired','报价已失效','gray']};
  const AUTH={processing:['Authorisation in progress','授权处理中','accent'],authorized:['Authorised','已授权','ok'],
    revoking:['Revocation in progress','撤销处理中','accent'],revoked:['Revoked','已撤销','gray'],used:['Used','已使用','gray']};
  const LOAN={repaying:['Repaying','还款中','accent'],settled:['Settled','已结清','gray']};
  const REPAY={repaying:['Repaying','还款中','accent'],overdue:['Overdue','逾期','danger'],settled:['Settled','已结清','gray']};
  const PERIOD={pending:['Awaiting repayment','待还款','accent'],confirming:['Repayment confirming on-chain','还款上链确认中','accent'],settled:['Settled','已结清','gray']};
  const NATURE={normal:['Normal repayment','正常还款'],overdue:['Overdue repayment','逾期还款']};

  /* ---------------------------------------------------------------- 数据 */
  const A={data:null,tab:'projects',views:{},listView:'default',totalsView:'default',detailView:'default',explorer:true,
    ref:null,type:null,dtab:null,hl:'',kw:'',inner:null,notice:null,stale:false,pageNote:false};
  let routeKey=null,restoreContext=false,returnHash='',lastHash='',onModule=false,wasSigned=false;
  const positions=new Map();
  function load(){
    const d=CF.ledgerSeed();let n=0;
    ['projects','pledges','demands','quotes','loans','periods'].forEach(k=>d[k].forEach(r=>{r.ref=r.id||(k+'-pending-'+(++n));}));
    d.byProject=Object.fromEntries(d.projects.map(p=>[p.id,p]));
    /* 一轮需求最多成交一笔：放款与还款挂在所属需求下。 */
    d.demands.forEach(x=>{x.loan=x.id?d.loans.find(l=>l.demand===x.id)||null:null;x.quotes=x.id?d.quotes.filter(q=>q.demand===x.id):[];});
    A.data=d;
  }
  load();
  const txt=x=>Array.isArray(x)?L(x[0],x[1]):x;
  const project=id=>A.data.byProject[id];
  const projectName=p=>L('Demo financing project '+p.key,'示例融资项目 '+p.key);
  const owner=k=>txt(A.data.owners[k]);
  const funder=k=>txt(A.data.funders[k]);
  const ownerOf=r=>owner(project(r.project).owner);
  const periodsOf=id=>A.data.periods.filter(p=>p.loan===id).sort((a,z)=>a.seq-z.seq);
  const find=(type,ref)=>(A.data[TAB_OF[type]]||[]).find(r=>r.ref===ref)||null;
  const repayStatus=d=>!d.loan?null:d.loan.status==='settled'?'settled':d.loan.overdue?'overdue':'repaying';
  const nextDue=d=>{if(!d.loan||!d.loan.planReady)return null;const p=periodsOf(d.loan.id).find(x=>x.status==='pending');return p?p.due:null;};
  const outstanding=d=>d.loan?d.loan.outstanding:null;
  const quoteLending=d=>d.quotes.some(q=>q.lending);

  /* ---------------------------------------------------------------- 展示 */
  const now=()=>Date.now();
  const num=v=>v==null?'—':Number(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  const amt=(v,ccy)=>v==null?'—':`<span class="num">${num(v)}</span> <span class="lg-unit">${ccy}</span>`;
  const cents=v=>Math.round(Number(v||0)*100);
  const sum=(rows,f)=>rows.reduce((s,r)=>s+cents(f(r)),0)/100;
  const pct=v=>(v*100).toFixed(2).replace(/\.?0+$/,'')+'%';
  const iso=t=>new Date(t).toISOString().slice(0,10);
  const bizDate=t=>t==null?'—':`${E(CF.fmtDate(iso(t)+'T12:00:00Z'))} <span class="lg-zone">UTC</span>`;
  const listDate=t=>t==null?'—':`<span class="lg-stamp">${iso(t)}</span>`;
  const time=t=>t==null?'—':E(CF.fmtTime(new Date(t).toISOString()));
  /* 清单里的时刻分两行：日期在上、时分在下，时区写在表头。 */
  const listTime=t=>{if(t==null)return '—';const v=new Date(t).toISOString(),[d,m]=CF.fmtStamp(v).split(' ');
    return `<time class="lg-stamp" datetime="${E(v)}" title="${E(CF.fmtTime(v))}">${E(d)}<span class="lg-meta">${E(m)}</span></time>`;};
  const zone=()=>`<span class="lg-th-meta">${E(S.tz||'UTC')}</span>`;
  const utc=()=>`<span class="lg-th-meta">UTC</span>`;
  const unit=u=>`<span class="lg-th-meta">${u}</span>`;
  const span=(a,b)=>{const m=Math.max(0,Math.floor((b-a)/60000)),h=Math.floor(m/60),d=Math.floor(h/24);
    return d?L(`${d} d ${h%24} h`,`${d} 天 ${h%24} 小时`):h?L(`${h} h ${m%60} min`,`${h} 小时 ${m%60} 分钟`):L(`${m} min`,`${m} 分钟`);};
  const waited=from=>L('Waiting ','已等待 ')+span(from,now());
  const tag=(map,k)=>map[k]?CF.tag(map[k][2]||'gray',txt(map[k])):'—';
  const unknownTag=()=>CF.tag('warn',L('On-chain result to be verified','链上结果待核实'));
  const chainTag=k=>CF.tag('accent',txt(CHAIN[k]));
  const overdueTag=n=>CF.tag('danger',n?L(`Overdue ${n} d`,`逾期 ${n} 天`):L('Overdue','逾期'));
  const expiredTag=()=>CF.tag('warn',L('Expired','已到期'));
  const unavailable=()=>`<span class="lg-unavailable">${L('Temporarily unavailable','暂不可用')}</span>`;
  const pending=()=>`<span class="lg-pending">${L('Not generated yet','尚未生成')}</span>`;
  const meta=s=>`<span class="lg-meta">${s}</span>`;
  const network=()=>`<span class="lg-network">${CF.assetIcon('ETH')}<span>Ethereum</span></span>`;
  const shortAddr=v=>v?v.slice(0,6)+'…'+v.slice(-4):'—';
  const addrShort=v=>v?`<span class="mono lg-short" title="${E(v)}">${E(shortAddr(v))}</span>`:'—';
  const addrFull=(v,label,tools='')=>v?`<span class="lg-addr"><span class="mono">${E(v)}</span><span class="lg-addr-tools">${CF.copyBtn('lg-copy',v,L('Copy the full '+label,'复制完整'+label))}${tools}</span></span>`:'—';
  const netAddr=(v,label)=>v?`<span class="lg-netaddr">${network()}${addrFull(v,label)}</span>`:'—';
  const ADDR=()=>L('address','地址');
  /* 区块链浏览器：新窗口打开，原页面不动；入口不可用时不给链接，仍可复制。复制与跳转都用完整值。 */
  const explorer=(kind,v,label)=>A.explorer?CF.linkOut('https://etherscan.io/'+kind+'/'+encodeURIComponent(v),label):'';
  /* 合约地址只在项目基本信息出现：网络、完整地址、复制、区块链浏览器，并注明归属范围。 */
  const contract=(v,scope)=>v?`<span class="lg-netaddr lg-contract"><span class="lg-contract-top">${network()}<span class="lg-contract-scope">${scope}</span></span>${addrFull(v,L('contract address','合约地址'),explorer('address',v,L('Open the contract in a blockchain explorer (new window)','在区块链浏览器打开该合约（新窗口）')))}</span>`:'—';
  /* 交易哈希：保留开头 6 位与结尾 4 位；点击复制完整值。平台未取得时显示“—”，不给占位值。 */
  const hashChip=(h,kind)=>{if(!h)return '<span class="lg-pending">—</span>';const name=L(kind[0]+' transaction hash',kind[1]+'交易哈希');
    return `<span class="lg-hash"><button type="button" class="lg-hash-copy" data-act="lg-copy" data-v="${E(h)}" title="${E(h)}" aria-label="${E(L('Copy ','复制')+name+' '+h)}">${E(h.slice(0,6)+'…'+h.slice(-4))}</button>${explorer('tx',h,L('Open the '+name+' in a blockchain explorer (new window)','在区块链浏览器打开该笔交易（新窗口）'))}</span>`;};
  const b=(en,zh,act,value='',cls='',disabled=false)=>`<button type="button" class="btn ${cls}" data-act="lg-${act}" data-v="${E(value)}" ${disabled?'disabled':''}>${L(en,zh)}</button>`;
  const openLink=(type,ref,label,cls='',opts={})=>`<a class="lg-link ${cls}" href="#${E(detailRoute(type,ref,opts))}" data-act="lg-open" data-v="${E(JSON.stringify({type,ref,...opts}))}">${label}</a>`;
  function facts(items){
    return `<div class="ops-facts-region ops-facts-body"><dl class="ops-facts">${items.filter(Boolean).map(([label,value,wide])=>`<div${wide?' class="ops-fact-wide"':''}><dt>${label}</dt><dd>${value==null||value===''?'—':value}</dd></div>`).join('')}</dl></div>`;
  }
  function section(title,body,note=''){
    return `<section class="card lg-section"><header class="lg-section-head"><h2>${title}</h2>${note?`<span class="lg-section-note">${note}</span>`:''}</header>${body}</section>`;
  }
  /* 操作记录：按时间倒序，每笔已发出的链上交易一条；未成功、处理中、待核实在操作旁就地标明。 */
  function opsTable(rows,cls=''){
    if(!rows.length)return `<p class="lg-empty-line">${L('No on-chain transactions yet','暂无链上交易')}</p>`;
    const list=rows.slice().sort((a,z)=>z.at-a.at);
    const cell=(k,v)=>`<td data-label="${E(k)}">${v}</td>`;
    const heads=[L('Time','时间')+zone(),L('Operation','操作'),L('Address','地址'),L('Transaction hash','交易哈希')];
    return `<div class="lg-ops ${cls}"><table class="tbl lg-ops-table"><thead><tr>${heads.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${list.map(o=>{
      const pl=cls==='lg-ops-pledge',name=(pl?PLOP:OPKIND)[o.kind];
      const label=typeof name[0]==='function'?L(name[0](o.seq),name[1](o.seq)):txt(name);
      /* 质押记录里的撤回是转出交易；需求里的撤下是解冻交易。 */
      const kind=pl&&o.kind==='withdraw'?['transfer-out','转出']:TXKIND[o.kind];
      return `<tr>${cell(L('Time','时间'),listTime(o.at))}${cell(L('Operation','操作'),`<span class="lg-op-name">${E(label)}</span>${o.state?`<span class="lg-op-state">${tag(OPSTATE,o.state)}</span>`:''}${o.ref?meta(`<span class="mono">${E(o.ref)}</span>`):''}`)}${cell(L('Address','地址'),addrFull(o.addr,ADDR()))}${cell(L('Transaction hash','交易哈希'),hashChip(o.tx,kind))}</tr>`;}).join('')}</tbody></table></div>`;
  }
  /* 报价放款、还款只写业务结果；需要核对交易时指向本轮唯一的操作记录。 */
  const opsPointer=what=>`<p class="lg-expand-note lg-ops-pointer">${what}${L(' are in this round’s ','在本轮')}<a class="lg-link" href="#${E(detailRoute(A.type,A.ref,{tab:'ops',kw:A.kw}))}" data-act="lg-dtab" data-v="ops">${L('operation records','操作记录')}</a>${L('.','中')}</p>`;
  const partError=key=>`<div class="lg-part-error" role="status">${unavailable()}${b('Retry','重试','part-retry',key,'sm')}</div>`;

  /* ---------------------------------------------------------------- 权限 */
  const signedIn=()=>!!CF.opsAuth&&CF.opsAuth.can(14);
  const canLedger=()=>!!CF.opsAuth&&CF.opsAuth.can(PERM);
  const canReview=()=>!!CF.opsAuth&&CF.opsAuth.can(REVIEW_PERM);
  const allowed=()=>S.end==='admin'&&signedIn()&&canLedger();
  function signedOut(){return CF.empty(L('Sign in to continue','请先完成运营登录'),
    L('Your session has ended. Sign in again to open the financing ledger.','登录已失效，请重新登录后查看融资台账。'),
    b('Sign in again','重新登录','sign-in','','primary'));}
  /* 清单与详情统一提示，不透露记录是否存在。 */
  function noAccess(){return CF.empty(L('Content does not exist or you do not have access','内容不存在或无权访问'),
    L('This account cannot open the financing ledger. Contact your platform provider to check the delivered configuration.','当前账号无法查看融资台账，请联系平台建设方核对交付配置。'),'');}
  function gate(){return !signedIn()?signedOut():!canLedger()?noAccess():'';}

  /* ---------------------------------------------------------------- 清单定义 */
  const all=()=>['',L('All','全部')];
  const yesNo=()=>[all(),['yes',L('Yes','是')],['no',L('No','否')]];
  const opts=map=>[all(),...Object.entries(map).map(([k,v])=>[k,txt(v)])];
  const ownerOpts=()=>[all(),...Object.keys(A.data.owners).map(k=>[k,owner(k)])];
  const funderOpts=()=>[all(),...Object.keys(A.data.funders).map(k=>[k,funder(k)])];
  const projectOpts=()=>[all(),...A.data.projects.map(p=>[p.id,p.id+' · '+projectName(p)])];
  const yn=(v,test)=>!v||(v==='yes')===!!test;
  const eq=(a,q)=>!!a&&String(a).toLowerCase()===q;
  const has=(a,q)=>!!a&&String(a).toLowerCase().includes(q);
  /* 项目清单按代币编号或原持有地址检索：命中的是本项目的质押记录。 */
  const pledgeHit=(p,q)=>A.data.pledges.some(r=>r.project===p.id&&(eq(r.token,q)||eq(r.holder,q)));
  /* 需求清单按融资业务、放款或还款期次编号检索：命中所属的一轮。 */
  function demandHit(d,q){
    const quote=d.quotes.find(x=>eq(x.id,q));
    if(quote)return {tab:'quotes',hl:quote.id};
    if(d.loan&&eq(d.loan.id,q))return {tab:'quotes',hl:d.loan.quote};
    const p=d.loan&&periodsOf(d.loan.id).find(x=>eq(x.id,q));
    return p?{tab:'repay',hl:p.id}:null;
  }

  const LISTS={
    projects:{
      rows:()=>A.data.projects,
      primary:{key:'status',label:['Project status','项目状态'],options:()=>opts(PROJECT),test:(r,v)=>r.status===v},
      more:[
        {key:'expired',label:['Expired','已到期'],options:yesNo,test:(r,v)=>yn(v,r.expired)},
        {key:'coverage',label:['Pledge coverage','质押情况'],options:()=>[...opts(COVER),['unknown',L('Unavailable','暂不可用')]],test:(r,v)=>v==='unknown'?!r.coverage:r.coverage===v},
        {key:'token',label:['Token type','代币类型'],options:()=>[all(),...A.data.tokenTypes.map(t=>[t,t])],test:(r,v)=>r.tokenType===v},
        {key:'owner',label:['Project publisher','项目发布方'],options:ownerOpts,test:(r,v)=>r.owner===v}],
      search:['Project number, name, publisher, pledge contract, token number or holder address','项目编号、项目名称、项目发布方、质押合约地址、代币编号或原持有地址'],
      match:(r,q)=>eq(r.id,q)||has(projectName(r),q)||has(owner(r.owner),q)||eq(r.contracts.pledge,q)||pledgeHit(r,q),
      sorts:[['configuredAt',-1,['Configuration completed · latest first','合约配置完成时间 · 从晚到早']],['configuredAt',1,['Configuration completed · earliest first','合约配置完成时间 · 从早到晚']],
        ['validUntil',1,['Valid until · earliest first','有效期至 · 从早到晚']],['validUntil',-1,['Valid until · latest first','有效期至 · 从晚到早']],
        ['effective',-1,['Effective pledge · high to low','有效质押额 · 从高到低']],['effective',1,['Effective pledge · low to high','有效质押额 · 从低到高']],
        ['inTransit',-1,['In-transit amount · high to low','项目在途金额 · 从高到低']],['inTransit',1,['In-transit amount · low to high','项目在途金额 · 从低到高']],
        ['balance',-1,['Financing balance · high to low','项目融资余额 · 从高到低']],['balance',1,['Financing balance · low to high','项目融资余额 · 从低到高']]],
      value:(r,k)=>r[k]==null?-Infinity:r[k],
      totals:rows=>[[L('Projects','项目数'),`<span class="num">${rows.length}</span>`],[L('In-transit amount','项目在途金额合计'),amt(sum(rows,r=>r.inTransit),'USDT')],[L('Financing balance','项目融资余额合计'),amt(sum(rows,r=>r.balance),'USDT')]],
      /* 按代币编号或原持有地址命中时，进入项目详情的代币质押 tab 并带上同一关键词。 */
      open:(r,q,raw)=>q&&pledgeHit(r,q)&&!eq(r.id,q)&&!eq(r.contracts.pledge,q)?{tab:'pledges',kw:raw}:{},
      get cols(){return [
        [L('Blockchain network','区块链网络'),()=>network(),'lg-c-net'],
        [L('Project number / name','项目编号 / 项目名称'),r=>`<strong class="mono">${E(r.id)}</strong>${meta(E(projectName(r)))}`],
        [L('Publisher / token type','项目发布方 / 代币类型'),r=>`${E(owner(r.owner))}${meta(E(r.tokenType))}`],
        [L('Project status','项目状态'),r=>tag(PROJECT,r.status)],
        [L('Valid until','有效期至')+utc(),r=>listDate(r.validUntil),'lg-c-date'],
        [L('Effective pledge','有效质押额')+unit('USD'),r=>r.effective==null?unavailable():`<span class="num">${num(r.effective)}</span>`,'lg-num'],
        [L('Pledge coverage','质押情况'),r=>r.coverage?tag(COVER,r.coverage):unavailable()],
        [L('In transit / balance','在途金额 / 融资余额')+unit('USDT'),r=>`<span class="lg-paired"><span><span class="lg-paired-label">${L('In transit','在途')}</span><span class="num">${num(r.inTransit)}</span></span><span><span class="lg-paired-label">${L('Balance','余额')}</span><span class="num">${num(r.balance)}</span></span></span>`,'lg-num']];}
    },
    demands:{
      rows:()=>A.data.demands,
      primary:{key:'status',label:['Application status','申请状态'],options:()=>opts(DEMAND),test:(r,v)=>r.status===v},
      more:[
        {key:'repay',label:['Repayment status','还款状态'],options:()=>opts(REPAY),test:(r,v)=>repayStatus(r)===v},
        {key:'endReason',label:['End reason','终结原因'],options:()=>[all(),...[...new Map(A.data.demands.filter(d=>d.endReason).map(d=>[d.endReason[1],d.endReason])).values()].map(x=>[x[1],txt(x)])],test:(r,v)=>!!r.endReason&&r.endReason[1]===v},
        {key:'funder',label:['Lending funder','放款机构'],options:funderOpts,test:(r,v)=>!!r.loan&&r.loan.funder===v},
        {key:'ccy',label:['Disbursement currency','放款币种'],options:()=>[all(),['USDT','USDT'],['USDC','USDC']],test:(r,v)=>!!r.loan&&r.loan.ccy===v},
        {key:'owner',label:['Project publisher','项目发布方'],options:ownerOpts,test:(r,v)=>project(r.project).owner===v},
        {key:'project',label:['Project','所属项目'],options:projectOpts,test:(r,v)=>r.project===v}],
      range:{label:['Published','本轮发布日期'],field:r=>r.publishedAt},
      search:['Application, business, loan, period or project number; project name','融资申请编号、融资业务编号、放款编号、还款期次编号、项目编号或项目名称'],
      match:(r,q)=>eq(r.id,q)||eq(r.project,q)||has(projectName(project(r.project)),q)||!!demandHit(r,q),
      sorts:[['publishedAt',-1,['Published · latest first','本轮发布时间 · 从晚到早']],['publishedAt',1,['Published · earliest first','本轮发布时间 · 从早到晚']],
        ['amount',-1,['Demand amount · high to low','需求金额 · 从高到低']],['amount',1,['Demand amount · low to high','需求金额 · 从低到高']],
        ['outstanding',-1,['Outstanding principal · high to low','未偿本金 · 从高到低']],['outstanding',1,['Outstanding principal · low to high','未偿本金 · 从低到高']],
        ['nextDue',1,['Next due date · earliest first','本期应还日 · 从早到晚']],['nextDue',-1,['Next due date · latest first','本期应还日 · 从晚到早']]],
      value:(r,k)=>k==='publishedAt'?(r.publishedAt||r.startedAt):k==='outstanding'?outstanding(r):k==='nextDue'?nextDue(r):r[k],
      /* 未偿本金与本期应还日为“—”的排在最后。 */
      last:['outstanding','nextDue'],
      totals:rows=>{const loans=rows.map(r=>r.loan).filter(Boolean);return [[L('Records','记录数'),`<span class="num">${rows.length}</span>`],[L('Demand amount','需求金额合计'),amt(sum(rows,r=>r.amount),'USDT')],
        [L('Outstanding principal','未偿本金合计'),amt(sum(loans,l=>l.outstanding),'USDT')],
        [L('Disbursed · USDT','放款金额合计 · USDT'),amt(sum(loans.filter(l=>l.ccy==='USDT'),l=>l.disbursed),'USDT')],
        [L('Disbursed · USDC','放款金额合计 · USDC'),amt(sum(loans.filter(l=>l.ccy==='USDC'),l=>l.disbursed),'USDC')]];},
      totalsNote:['Demand amount includes ended rounds; it is not the projects’ in-transit amount.','需求金额合计含已终结各轮，不等于项目在途金额'],
      open:(r,q)=>q?demandHit(r,q)||{}:{},
      get cols(){return [
        [L('Application number','融资申请编号'),r=>r.id?`<strong class="mono">${E(r.id)}</strong>`:pending()],
        [L('Project / publisher','所属项目 / 项目发布方'),r=>`<span class="mono">${E(r.project)}</span>${meta(E(ownerOf(r)))}`],
        [L('Demand amount','需求金额')+unit('USDT'),r=>`<span class="num">${num(r.amount)}</span>`,'lg-num'],
        [L('Application status','申请状态'),r=>r.status?tag(DEMAND,r.status):'—'],
        [L('Lending funder / disbursed','放款机构 / 放款金额'),r=>r.loan?`${E(funder(r.loan.funder))}${meta(amt(r.loan.disbursed,r.loan.ccy))}`:'—'],
        [L('Outstanding','未偿本金')+unit('USDT'),r=>r.loan?`<span class="num">${num(r.loan.outstanding)}</span>`:'—','lg-num'],
        [L('Repayment / next due','还款状态 / 本期应还日'),r=>r.loan?`${tag(REPAY,repayStatus(r))}${meta(nextDue(r)?`${iso(nextDue(r))} UTC`:'—')}`:'—'],
        [L('Published at','本轮发布时间')+zone(),r=>r.publishedAt?listTime(r.publishedAt):'—','lg-c-date']];}
    }
  };

  /* ---------------------------------------------------------------- 视图条件 */
  function blank(tab){
    const c=LISTS[tab],f={q:''};
    f[c.primary.key]='';c.more.forEach(x=>f[x.key]='');if(c.range){f.from='';f.to='';}
    return {filter:f,edit:{...f},page:1,sort:c.sorts[0][0],dir:c.sorts[0][1],open:false,error:''};
  }
  function view(tab){return A.views[tab]||(A.views[tab]=blank(tab));}
  function loadViews(){try{const saved=JSON.parse(sessionStorage.getItem(VIEWS)||'{}');TABS.forEach(t=>{if(saved[t]){const v=blank(t);Object.assign(v.filter,saved[t].filter||{});v.edit={...v.filter};v.page=saved[t].page||1;
    const s=LISTS[t].sorts.find(x=>x[0]===saved[t].sort&&x[1]===saved[t].dir);if(s){v.sort=s[0];v.dir=s[1];}A.views[t]=v;}});}catch(_){}}
  function storeViews(){try{const out={};TABS.forEach(t=>{const v=view(t);out[t]={filter:v.filter,page:v.page,sort:v.sort,dir:v.dir};});sessionStorage.setItem(VIEWS,JSON.stringify(out));}catch(_){}}
  loadViews();
  function params(tab){
    const v=view(tab),p=new URLSearchParams({tab});
    Object.entries(v.filter).forEach(([k,x])=>{if(x)p.set(k,x);});
    p.set('sort',v.sort);p.set('dir',String(v.dir));p.set('page',String(v.page));
    return p;
  }
  const listRoute=(tab=A.tab)=>ROOT+'?'+params(tab);
  function detailRoute(type,ref,o={}){
    const p=new URLSearchParams({type,id:ref});
    if(o.tab)p.set('tab',o.tab);if(o.hl)p.set('hl',o.hl);if(o.kw)p.set('kw',o.kw);
    return DETAIL+'?'+p;
  }
  function readList(p){
    const tab=TABS.includes(p.get('tab'))?p.get('tab'):'projects',c=LISTS[tab],v=blank(tab);
    const valid=(def,x)=>def.options().some(o=>o[0]===x);
    [c.primary,...c.more].forEach(def=>{const x=p.get(def.key);if(x&&valid(def,x))v.filter[def.key]=x;});
    if(c.range)['from','to'].forEach(k=>{const x=p.get(k);if(x&&/^\d{4}-\d{2}-\d{2}$/.test(x))v.filter[k]=x;});
    if(c.range&&v.filter.from&&v.filter.to&&v.filter.from>v.filter.to){v.filter.from='';v.filter.to='';}
    v.filter.q=(p.get('q')||'').trim();
    const s=c.sorts.find(x=>x[0]===p.get('sort')&&String(x[1])===p.get('dir'));if(s){v.sort=s[0];v.dir=s[1];}
    v.page=Math.max(1,parseInt(p.get('page'),10)||1);v.edit={...v.filter};
    A.views[tab]=v;A.tab=tab;storeViews();
  }
  /* 详情内 tab 的筛选、页码与展开只在本次查看该详情时保留。 */
  function inner(){
    const key=A.type+'|'+A.ref+'|'+A.kw+'|'+A.hl;
    if(!A.inner||A.inner.key!==key)A.inner={key,pl:{filter:{dest:'',tokenState:'',q:A.kw||''},edit:{dest:'',tokenState:'',q:A.kw||''},page:1},dm:{page:1},open:new Set(A.hl?[A.hl]:[])};
    return A.inner;
  }
  function syncContext(){
    if(routeKey===location.hash)return;
    routeKey=location.hash;
    const [route,query]=location.hash.replace(/^#/,'').split('?'),p=new URLSearchParams(query||'');
    if(route===DETAIL){
      A.type=KIND[p.get('type')]?p.get('type'):null;A.ref=p.get('id');
      const tabs=A.type?DTABS[A.type].map(x=>x[0]):[];
      A.dtab=tabs.includes(p.get('tab'))?p.get('tab'):'info';A.kw=p.get('kw')||'';
      /* 高亮按记录 ref 展开（期次、报价放款）。 */
      A.hl=p.get('hl')||'';
      if(A.type)A.tab=TAB_OF[A.type];
    }else if(route===ROOT){
      /* 从菜单进入（地址不带清单参数）是一次新的进入，清空返回链。 */
      if(!p.has('tab'))setTrail([]);
      readList(p);A.type=null;A.ref=null;
    }
  }
  function replaceRoute(route){try{history.replaceState(null,'','#'+route);routeKey=location.hash;}catch(_){}}
  function saveContext(){if(S.page!==LIST)return;storeViews();replaceRoute(listRoute());}
  /* 返回链：只记录台账内的来源，返回时回到来源清单或来源详情（含原 tab）。 */
  const trail=()=>{try{return JSON.parse(sessionStorage.getItem(TRAIL)||'[]')}catch(_){return []}};
  const setTrail=t=>{try{sessionStorage.setItem(TRAIL,JSON.stringify(t.slice(-20)))}catch(_){}};
  function remember(){const el=document.activeElement,box=document.querySelector('.lg-table-region');
    positions.set(location.hash,{y:window.scrollY,box:box?box.scrollTop:0,act:el?.dataset?.act,value:el?.dataset?.v});}
  function go(route){
    remember();setTrail([...trail(),location.hash]);
    A.listView='default';A.totalsView='default';A.detailView='default';A.notice=null;
    location.hash='#'+route;
  }
  function back(){
    const t=trail(),prev=t.pop();setTrail(t);
    const target=prev||('#'+listRoute(TAB_OF[A.type]||A.tab));
    if(A.stale&&target.startsWith('#'+ROOT+'?'))A.notice='stale';
    A.stale=false;A.detailView='default';
    location.hash=target;
  }
  function restoreView(){
    if(!restoreContext)return;restoreContext=false;
    requestAnimationFrame(()=>{
      const saved=positions.get(location.hash);
      if(saved){
        window.scrollTo(0,saved.y);const box=document.querySelector('.lg-table-region');if(box)box.scrollTop=saved.box||0;
        const target=[...document.querySelectorAll('[data-act]')].find(el=>el.dataset.act===saved.act&&el.dataset.v===saved.value);
        if(target)target.focus({preventScroll:true});
      }else{
        const hl=document.querySelector('.lg-hl');
        if(hl)hl.scrollIntoView({block:'center'});else window.scrollTo(0,0);
      }
    });
  }

  /* ---------------------------------------------------------------- 清单 */
  function inRange(t,v){
    if(!v.from&&!v.to)return true;if(t==null)return false;
    const d=iso(t);return (!v.from||d>=v.from)&&(!v.to||d<=v.to);
  }
  function scope(tab){
    const c=LISTS[tab],f=view(tab).filter,q=f.q.trim().toLowerCase();
    return c.rows().filter(r=>[c.primary,...c.more].every(def=>!f[def.key]||def.test(r,f[def.key]))
      &&(!c.range||inRange(c.range.field(r),f))&&(!q||c.match(r,q)));
  }
  function sorted(tab,rows){
    const c=LISTS[tab],v=view(tab),last=(c.last||[]).includes(v.sort);
    return rows.slice().sort((a,z)=>{const x=c.value(a,v.sort),y=c.value(z,v.sort);
      if(last&&(x==null)!==(y==null))return x==null?1:-1;
      return (x===y?0:(x<y?-1:1))*v.dir||String(a.id||'~'+a.ref).localeCompare(String(z.id||'~'+z.ref));});
  }
  function conditions(tab){
    const c=LISTS[tab],f=view(tab).filter,out=[];
    [c.primary,...c.more].forEach(def=>{if(f[def.key]){const o=def.options().find(x=>x[0]===f[def.key]);out.push(txt(def.label)+'：'+(o?o[1]:f[def.key]));}});
    if(c.range&&(f.from||f.to))out.push(txt(c.range.label)+' (UTC)：'+(f.from||'…')+' ～ '+(f.to||'…'));
    if(f.q)out.push(L('Keyword','关键词')+'：'+f.q);
    return out;
  }
  function tabs(){
    return `<div class="card-tabs lg-tabs" role="tablist" aria-label="${L('Ledger lists','台账清单')}">${TABS.map(t=>`<a role="tab" id="lg-tab-${t}" href="#${E(listRoute(t))}" data-act="lg-tab" data-v="${t}" aria-selected="${A.tab===t}" aria-controls="lg-panel" ${A.tab===t?'tabindex="0"':'tabindex="-1"'}>${txt(TAB[t])}</a>`).join('')}</div>`;
  }
  const sortIcon='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4.6 2.8v10.4M2.4 10.8l2.2 2.4 2.2-2.4M11.4 13.2V2.8M9.2 5.2l2.2-2.4 2.2 2.4"/></svg>';
  function filters(){
    const tab=A.tab,c=LISTS[tab],v=view(tab),f=v.edit,count=c.more.filter(d=>v.filter[d.key]).length+(c.range&&(v.filter.from||v.filter.to)?1:0);
    const sel=def=>`<div class="field"><label for="lg-f-${def.key}">${txt(def.label)}</label><select class="inp" id="lg-f-${def.key}">${def.options().map(([k,l])=>`<option value="${E(k)}" ${k===f[def.key]?'selected':''}>${E(l)}</option>`).join('')}</select></div>`;
    const sortSel=`<span class="fb lg-sort">${sortIcon}<select class="inp" id="lg-order" aria-label="${L('Sort by','排序')}">${c.sorts.map(([k,d,label])=>`<option value="${k}:${d}" ${k===v.sort&&d===v.dir?'selected':''}>${E(txt(label))}</option>`).join('')}</select></span>`;
    const range=c.range?`<div class="field lg-range${v.error?' lg-invalid':''}"><label for="lg-f-from">${txt(c.range.label)} (UTC)</label><input class="inp" id="lg-f-from" type="date" value="${E(f.from)}" aria-invalid="${!!v.error}" ${v.error?'aria-describedby="lg-range-error"':''}><span aria-hidden="true">～</span><input class="inp" id="lg-f-to" type="date" value="${E(f.to)}" aria-label="${txt(c.range.label)} ${L('end','结束')} (UTC)" aria-invalid="${!!v.error}"></div>${v.error?`<p class="lg-field-error" id="lg-range-error" role="alert">${E(txt(v.error))}</p>`:''}`:'';
    const applied=conditions(tab);
    return `<form id="lg-filter-form" class="lg-filter-wrap" novalidate><div class="filterbar ops-filterbar">
      ${CF.opsFilterSelect('lg-f-'+c.primary.key,txt(c.primary.label),c.primary.options(),f[c.primary.key])}
      ${sortSel}
      <button type="button" class="btn" data-act="lg-filters" aria-expanded="${v.open}" aria-controls="lg-advanced">${L('More filters','更多筛选')}${count?' ('+count+')':''} <span aria-hidden="true">${v.open?'⌃':'⌄'}</span></button>
      ${CF.filterSearch('lg-f-q',L('Search','搜索'),f.q,txt(c.search),'ops-filter-query')}
      <div class="fb-acts">${b('Reset','重置','reset')}<button type="submit" class="btn primary">${L('Search','查询')}</button></div></div>
      <div id="lg-advanced" class="ops-filter-fields" ${v.open?'':'hidden'}>${c.more.map(sel).join('')}${range}</div>
      ${applied.length?`<div class="lg-applied" aria-label="${L('Applied conditions','已生效条件')}">${applied.map(label=>CF.tag('gray',label)).join('')}<button type="button" class="btn sm lg-clear" data-act="lg-clear">${L('Clear all conditions','清除全部条件')}</button></div>`:''}</form>`;
  }
  function totalsBar(items,note,label=L('Filtered totals','筛选结果合计')){
    let body;
    if(A.listView==='loading'&&S.page===LIST)body=`<span class="lg-total-skel skel" aria-hidden="true"></span><span class="sr-only">${L('Loading','加载中')}</span>`;
    else if(A.totalsView==='error'&&S.page===LIST)body=`${unavailable()}${b('Retry','重试','totals-retry','','sm')}`;
    else body=items.map(([k,v])=>`<span class="lg-total"><span class="lg-total-k">${k}</span><span class="lg-total-v">${v}</span></span>`).join('');
    const showNote=note&&!(S.page===LIST&&(A.totalsView==='error'||A.listView==='loading'));
    return `<div class="lg-totals" aria-live="polite"><span class="lg-totals-label">${label}</span><div class="lg-total-items">${body}</div>${showNote?`<p class="lg-total-note">${txt(note)}</p>`:''}</div>`;
  }
  function table(cols,rows,cls,opts={}){
    const head=cols.map(([h,,c])=>`<th scope="col" class="${c||''}">${h}</th>`).join('');
    const body=rows.map(r=>{
      const open=!!opts.expand&&inner().open.has(r.ref),hl=!!opts.hl&&opts.hl(r);
      const main=`<tr class="${hl?'lg-hl':''}${open?' lg-open':''}">${cols.map(([,cell,c])=>`<td class="${c||''}">${cell(r)}</td>`).join('')}<td class="col-act">${opts.action(r,open)}</td></tr>`;
      return main+(open?`<tr class="lg-expand-row"><td colspan="${cols.length+1}" id="lg-x-${E(r.ref)}">${opts.expand(r)}</td></tr>`:'');
    }).join('');
    return `<div class="tablewrap ${opts.box===false?'':'listbox '}lg-table-region" tabindex="0" role="region" aria-label="${E(opts.label||'')}"><table class="tbl lg-table ${cls}"><thead><tr>${head}<th scope="col" class="col-act">${opts.actionHead||L('Action','操作')}</th></tr></thead><tbody>${body}</tbody></table></div>`;
  }
  const expandBtn=(r,open)=>`<button type="button" class="actlink lg-expand" data-act="lg-expand" data-v="${E(r.ref)}" aria-label="${E((open?L('Hide details for ','收起详情：'):L('Show details for ','展开详情：'))+(r.id||r.ref))}" aria-expanded="${open}" ${open?`aria-controls="lg-x-${E(r.ref)}"`:''}>${open?L('Hide','收起'):L('Show','展开')}<span class="lg-expand-icon" aria-hidden="true">${CF.ICON.caret}</span></button>`;
  function pager(total,page,act='page'){
    const pages=Math.max(1,Math.ceil(total/CF.PAGE_SIZE));
    return `<div class="pager"><span class="total">${L('Total','共')} ${total} ${L('records','条')} · ${CF.PAGE_SIZE} ${L('per page','条／页')}</span>${b('Previous','上一页',act,String(page-1),'sm',page<=1)}<span>${page} / ${pages}</span>${b('Next','下一页',act,String(page+1),'sm',page>=pages)}</div>`;
  }
  function list(){
    const from=trail().slice(-1)[0]||'',fromDetail=from.startsWith('#'+DETAIL+'?');
    const head=`<div class="page-head lg-head"><div><h1 class="page-title">${L('Financing ledger','融资台账')}</h1></div><div class="lg-detail-tools">${CF.tag('gray',L('Demonstration data','演示数据'))}${fromDetail?b('Back to the source record','返回来源记录','back','','sm'):''}</div></div>`;
    const blocked=gate();
    if(blocked)return head+`<section class="card">${blocked}</section>`;
    const tab=A.tab,c=LISTS[tab],v=view(tab),found=sorted(tab,scope(tab)),q=v.filter.q.trim().toLowerCase();
    const pages=Math.max(1,Math.ceil(found.length/CF.PAGE_SIZE));
    if(v.page>pages){v.page=pages;A.pageNote=true;saveContext();}
    const rows=found.slice((v.page-1)*CF.PAGE_SIZE,v.page*CF.PAGE_SIZE);
    let bodyHtml;
    if(A.listView==='loading')bodyHtml=CF.skelTable(6);
    else if(A.listView==='error')bodyHtml=CF.empty(L('Could not load this list','清单读取失败'),L('The list is temporarily unavailable. Other information on this page is not affected.','清单暂不可用，不影响本页其他信息。'),b('Retry','重试','list-retry','','primary'));
    else if(A.listView==='empty'||!A.data[tab].length)bodyHtml=CF.empty(txt(EMPTY[tab]),L('Switch to the other list to keep reviewing.','可切换另一个清单继续查看。'));
    else if(!found.length)bodyHtml=CF.empty(L('No records match the current conditions','没有符合当前条件的记录'),L('The current filters did not match any record.','当前筛选条件未匹配到记录。'),b('Clear filters','清除筛选','clear'));
    else bodyHtml=table(c.cols,rows,'lg-t-'+tab,{label:txt(TAB[tab]),action:r=>openLink(TYPE[tab],r.ref,L('View','查看'),'actlink',c.open(r,q,v.filter.q.trim()))})+pager(found.length,v.page);
    const notes=[A.notice==='stale'?CF.note('accent',`<span>${L('The record you just viewed has been updated and no longer matches the current conditions.','刚才查看的记录已更新，不再满足当前筛选条件。')}</span>${b('Clear filters','清除筛选','clear','','sm')}`):'',
      A.pageNote?CF.note('accent',`<span>${L('The previous page no longer has records; showing the last page with records.','原页已无记录，已回到最后一个有内容的页。')}</span>`):''].filter(Boolean).join('');
    const shown=A.listView==='empty'?[]:found;
    return head+`<section class="card lg-card">${tabs()}<div id="lg-panel" role="tabpanel" aria-labelledby="lg-tab-${tab}">${filters()}${notes?`<div class="lg-notes">${notes}</div>`:''}${totalsBar(c.totals(shown),c.totalsNote)}${bodyHtml}</div></section>`;
  }

  /* ---------------------------------------------------------------- 详情公共 */
  function dtabs(type,counts){
    return `<div class="card-tabs lg-dtabs" role="tablist" aria-label="${L('Detail sections','详情分区')}">${DTABS[type].map(([k,label])=>`<a role="tab" id="lg-dtab-${k}" href="#${E(detailRoute(type,A.ref,{tab:k,kw:A.kw}))}" data-act="lg-dtab" data-v="${k}" aria-selected="${A.dtab===k}" aria-controls="lg-dpanel" ${A.dtab===k?'tabindex="0"':'tabindex="-1"'}>${txt(label)}${counts[k]!=null?`<span class="lg-count">${counts[k]}</span>`:''}</a>`).join('')}</div>`;
  }
  function summary(items){return `<dl class="lg-summary">${items.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;}
  function heading(type,title,sub,tags,tools=''){
    return `<header class="lg-detail-head"><div class="lg-detail-title"><span class="lg-kind">${txt(KIND[type])}</span><h1>${title}</h1>${sub?`<p class="lg-title-sub">${sub}</p>`:''}<div class="lg-tags">${tags}</div></div><div class="lg-detail-tools">${tools}${CF.tag('gray',L('Demonstration data','演示数据'))}${b('Back','返回','back','','sm')}</div></header>`;
  }
  const panel=html=>`<div id="lg-dpanel" role="tabpanel" aria-labelledby="lg-dtab-${A.dtab}" class="lg-dpanel">${html}</div>`;

  /* ---------------------------------------------------------------- 项目详情 */
  function projectInfo(p){
    const quotesReceived=A.data.quotes.filter(q=>q.project===p.id&&q.id).length;
    return `<div class="detail-stack lg-stack">`
      +section(L('Project and terms','项目与条款'),facts([
        [L('Blockchain network','区块链网络'),network()],[L('Project number','项目编号'),`<span class="mono">${E(p.id)}</span>`],[L('Project name','项目名称'),E(projectName(p))],
        [L('Project publisher','项目发布方'),E(owner(p.owner))],[L('Token type','代币类型'),E(p.tokenType)],[L('Project status','项目状态'),`<span class="lg-tags">${tag(PROJECT,p.status)}${p.expired?expiredTag():''}</span>`],
        [L('Valid until','有效期至'),bizDate(p.validUntil)],[L('Project term','项目期限'),`${bizDate(p.termStart)} ～ ${bizDate(p.termEnd)}`],
        [L('Pledge ratio','项目质押率'),pct(p.ratio)],[L('Reference settlement currency','参考结算币种'),E(p.refCcy)],[L('Repayment method','还款方式'),E(txt(p.repayment))],
        [L('Configuration completed','合约配置完成时间'),time(p.configuredAt)],
        p.closeReason?[L('Close reason','关闭原因'),E(txt(p.closeReason))]:null]))
      +section(L('Pledge and financing capacity','质押与融资额度'),facts([
        [L('Effective pledge','有效质押额'),p.effective==null?unavailable():amt(p.effective,'USD')],[L('Total pledge','总质押额'),p.total==null?unavailable():amt(p.total,'USD')],
        [L('Invalid tokens','失效代币价值与张数'),`${amt(p.invalid.value,'USD')} · ${L(p.invalid.count+' tokens',p.invalid.count+' 张')}`],
        [L('Released, awaiting withdrawal','已释放待提取'),`${L(p.released.count+' shares',p.released.count+' 份')} · ${amt(p.released.value,'USD')}`],
        [L('Pledge coverage','质押情况'),p.coverage?tag(COVER,p.coverage):unavailable()],
        p.gap?[L('Pledge gap','质押缺口'),amt(p.gap.usdt,'USDT')]:null,p.gap?[L('Asset value to add','需追加资产价值'),amt(p.gap.usd,'USD')]:null,
        [L('In-transit amount','项目在途金额'),amt(p.inTransit,'USDT')],[L('Financing balance','项目融资余额'),amt(p.balance,'USDT')],
        [L('Available to finance','可融金额'),amt(p.available,'USDT')],[L('Quotes received','已收到报价数'),`<span class="num">${quotesReceived}</span>`]]))
      +section(L('Configured contracts','所配置的合约'),A.detailView==='partial'?partError('contracts'):facts([
        [L('Pledge contract','质押合约'),contract(p.contracts.pledge,L('May be shared with other projects','可能与其他项目共用')),true],
        [L('Loan contract','放款合约'),contract(p.contracts.loan,L('This project only','仅属于本项目')),true],
        [L('Repayment contract','还款合约'),contract(p.contracts.repay,L('This project only','仅属于本项目')),true]]))
      +`</div>`;
  }
  function pledgeExpand(r){
    return facts([
      [L('Single application ID','单笔申请标识'),`<span class="mono">${E(r.apply)}</span>`],[L('Submission batch','提交批次编号'),`<span class="mono">${E(r.batch)}</span>`],
      [L('Application type','申请类型'),E(txt(APPLY[r.applyType]))],[L('On-chain execution','链上执行状态'),`<span class="lg-tags">${tag(EXEC,r.exec)}${r.unknown?unknownTag():''}</span>`],
      r.pledgedAt?[L('Pledged at','质押时间'),time(r.pledgedAt)]:[L('Initiated at','发起时间'),`${time(r.startedAt)}${meta(E(waited(r.startedAt)))}`],
      r.dest==='excluded'?[L('Not counted because','不计入有效质押的原因'),r.reasons.map(k=>E(txt(REASON[k]))).join('、')]:null,
      [L('Removal reason','移出原因'),r.removal?E(txt(REMOVAL[r.removal])):'—'],
      [L('Business release time','业务释放时间'),time(r.releasedAt)],[L('Transfer-out time','转出时间'),time(r.outAt)],
      [L('On-chain token ID','链上代币 ID'),`<span class="mono">${E(r.chainTokenId)}</span>`],
      [L('Original holder','原持有地址'),netAddr(r.holder,ADDR()),true],[L('Token issuing contract','代币发行合约地址'),netAddr(r.tokenContract,ADDR()),true]])
      +`<h3 class="lg-expand-h">${L('Operation records','操作记录')}</h3>${opsTable(r.ops,'lg-ops-pledge')}`;
  }
  function projectPledges(p){
    const st=inner().pl,f=st.filter,q=f.q.trim().toLowerCase();
    const own=A.data.pledges.filter(r=>r.project===p.id);
    const found=own.filter(r=>(!f.dest||r.dest===f.dest)&&(!f.tokenState||r.tokenState===f.tokenState)
      &&(!q||eq(r.id,q)||eq(r.token,q)||eq(r.holder,q)||eq(r.batch,q))).sort((a,z)=>((z.pledgedAt||z.startedAt)-(a.pledgedAt||a.startedAt))||String(a.ref).localeCompare(z.ref));
    const pages=Math.max(1,Math.ceil(found.length/CF.PAGE_SIZE));if(st.page>pages)st.page=pages;
    const rows=found.slice((st.page-1)*CF.PAGE_SIZE,st.page*CF.PAGE_SIZE);
    const active=[f.dest?txt(DEST[f.dest]):'',f.tokenState?txt(TOKEN_STATE[f.tokenState]):'',f.q?L('Keyword','关键词')+'：'+f.q:''].filter(Boolean);
    const bar=`<form id="lg-pl-form" class="lg-filter-wrap" novalidate><div class="filterbar ops-filterbar">${CF.opsFilterSelect('lg-pl-dest',L('Current destination','当前去向'),opts(DEST),st.edit.dest)}${CF.opsFilterSelect('lg-pl-tokenState',L('Token status','代币状态'),opts(TOKEN_STATE),st.edit.tokenState)}
      ${CF.filterSearch('lg-pl-q',L('Search','搜索'),st.edit.q,L('Pledge record, token number, holder address or batch','质押记录编号、代币编号、原持有地址或提交批次编号'),'ops-filter-query')}
      <div class="fb-acts">${b('Reset','重置','pl-reset')}<button type="submit" class="btn primary">${L('Search','查询')}</button></div></div>
      ${active.length?`<div class="lg-applied">${active.map(x=>CF.tag('gray',x)).join('')}<button type="button" class="btn sm lg-clear" data-act="lg-pl-reset">${L('Clear all conditions','清除全部条件')}</button></div>`:''}</form>`;
    const cols=[
      [L('Pledge record','质押记录编号'),r=>r.id?`<strong class="mono">${E(r.id)}</strong>`:`${pending()}${meta(`<span class="mono">${E(r.apply)}</span>`)}`],
      [L('Token number','代币编号'),r=>`<span class="mono">${E(r.token)}</span>`],
      [L('Original holder','原持有地址'),r=>addrShort(r.holder)],
      [L('Quantity','质押数量'),r=>E(r.qty+' '+r.symbol)],
      [L('Share value','份额价值')+unit('USD'),r=>`<span class="num">${num(r.value)}</span>`,'lg-num'],
      [L('Token status','代币状态'),r=>tag(TOKEN_STATE,r.tokenState)],
      [L('Current destination','当前去向'),r=>`<span class="lg-tags">${tag(DEST,r.dest)}${r.unknown?unknownTag():''}</span>`],
      [L('Pledged at','质押时间')+zone(),r=>r.pledgedAt?listTime(r.pledgedAt):`—${meta(E(waited(r.startedAt)))}`,'lg-c-date']];
    const body=!own.length?CF.empty(L('This project has no pledge records yet','本项目暂无质押记录'),'')
      :!found.length?CF.empty(L('No records match the current conditions','没有符合当前条件的记录'),L('The current filters did not match any record.','当前筛选条件未匹配到记录。'),b('Clear filters','清除筛选','pl-reset'))
      :table(cols,rows,'lg-t-pledges',{label:L('Token pledges','代币质押'),box:false,actionHead:L('Details','详情'),action:expandBtn,expand:pledgeExpand,hl:r=>!!q&&(eq(r.token,q)||eq(r.holder,q))})+pager(found.length,st.page,'pl-page');
    return `<section class="card lg-card">${bar}${totalsBar([[L('Records','记录数'),`<span class="num">${found.length}</span>`],[L('Share value','份额价值合计'),amt(sum(found,r=>r.value),'USD')]],
      ['Includes shares not counted and shares already removed; not this project’s total or effective pledge.','含不计入有效质押与已移出的份额，不等于本项目的总质押额或有效质押额'],L('Totals','合计'))}${body}</section>`;
  }
  function projectDemands(p){
    const st=inner().dm,own=A.data.demands.filter(d=>d.project===p.id).sort((a,z)=>(z.publishedAt||z.startedAt)-(a.publishedAt||a.startedAt));
    const pages=Math.max(1,Math.ceil(own.length/CF.PAGE_SIZE));if(st.page>pages)st.page=pages;
    const rows=own.slice((st.page-1)*CF.PAGE_SIZE,st.page*CF.PAGE_SIZE);
    const cols=[
      [L('Application number','融资申请编号'),d=>d.id?`<strong class="mono">${E(d.id)}</strong>`:pending()],
      [L('Demand amount','需求金额')+unit('USDT'),d=>`<span class="num">${num(d.amount)}</span>`,'lg-num'],
      [L('Application status','申请状态'),d=>`<span class="lg-tags">${d.status?tag(DEMAND,d.status):'—'}${d.chain?chainTag(d.chain):''}${quoteLending(d)?chainTag('lending'):''}${d.chainUnknown?unknownTag():''}</span>`],
      [L('Repayment status','还款状态'),d=>d.loan?tag(REPAY,repayStatus(d)):'—'],
      [L('Published at','本轮发布时间')+zone(),d=>d.publishedAt?listTime(d.publishedAt):`—${meta(E(waited(d.startedAt)))}`,'lg-c-date']];
    const body=!own.length?CF.empty(L('This project has no financing demands yet','本项目暂无融资需求'),'')
      :table(cols,rows,'lg-t-pdemands',{label:L('Financing demands','融资需求'),box:false,action:d=>openLink('demand',d.ref,L('View','查看'),'actlink')})+(own.length>CF.PAGE_SIZE?pager(own.length,st.page,'dm-page'):'');
    return `<section class="card lg-card">${body}</section>`;
  }
  function projectDetail(p){
    const review=canReview()?CF.AdminMenu.destination('contracts','/ops/contract-reviews/detail?'+new URLSearchParams({id:p.id,src:'queue'})):null;
    const tool=review?`<a class="btn sm lg-review" href="${E(review.href)}" data-admin-destination="contracts" data-admin-route="${E(review.route)}">${L('Project review detail','项目审核详情')}</a>`:'';
    const content=A.detailView==='partial'&&A.dtab!=='info'?`<section class="card lg-card">${partError('tab')}</section>`
      :A.dtab==='pledges'?projectPledges(p):A.dtab==='demands'?projectDemands(p):projectInfo(p);
    return heading('project',`${E(projectName(p))}<span class="lg-title-id mono">${E(p.id)}</span>`,`${E(owner(p.owner))} · ${E(p.tokenType)}`,`${tag(PROJECT,p.status)}${p.expired?expiredTag():''}`,tool)
      +summary([[L('Effective pledge','有效质押额'),p.effective==null?unavailable():amt(p.effective,'USD')],[L('Pledge coverage','质押情况'),p.coverage?tag(COVER,p.coverage):unavailable()],
        [L('In-transit amount','项目在途金额'),amt(p.inTransit,'USDT')],[L('Financing balance','项目融资余额'),amt(p.balance,'USDT')]])
      +dtabs('project',{pledges:A.data.pledges.filter(r=>r.project===p.id).length,demands:A.data.demands.filter(r=>r.project===p.id).length})+panel(content);
  }

  /* ---------------------------------------------------------------- 需求详情 */
  function demandInfo(d){
    return `<div class="detail-stack lg-stack">`
      +section(L('Demand','需求信息'),facts([
        [L('Application number','融资申请编号'),d.id?`<span class="mono">${E(d.id)}</span>`:pending()],
        [L('Project','所属项目'),openLink('project',d.project,`<span class="mono">${E(d.project)}</span> · ${E(projectName(project(d.project)))}`)],
        [L('Project publisher','项目发布方'),E(ownerOf(d))],[L('Demand amount','需求金额'),amt(d.amount,'USDT')],
        [L('Application status','申请状态'),d.status?tag(DEMAND,d.status):'—'],
        d.chain?[L('On-chain processing','链上处理中'),`<span class="lg-tags">${chainTag(d.chain)}${d.chainUnknown?unknownTag():''}</span>${meta(`${L('Initiated','发起于')} ${time(d.startedAt)} · ${E(waited(d.startedAt))}`)}`]:null,
        d.publishedAt?[L('Published at','本轮发布时间'),time(d.publishedAt)]:[L('Initiated at','发起时间'),`${time(d.startedAt)}${meta(E(waited(d.startedAt)))}`],
        d.endReason?[L('End reason','终结原因'),E(txt(d.endReason))]:null,d.endReason?[L('Ended at','终结时间'),time(d.endedAt)]:null,
        [L('Quotes this round','本轮报价笔数'),`<span class="num">${d.quotes.length}</span>`]]))
      +section(L('Receiving address','融资收款地址'),facts([[L('Financing receiving address','融资收款地址'),netAddr(d.receive,ADDR()),true]]))
      +`</div>`;
  }
  /* 一轮需求一份：本轮及成交后融资业务的全部链上交易，交易哈希在台账中唯一的展示位置。 */
  function demandOps(d){
    return `<section class="card lg-section lg-ops-card"><header class="lg-section-head"><h2>${L('Operation records','操作记录')}</h2><span class="lg-section-note">${L('All on-chain transactions of this round and its financing business · latest first','本轮及成交后融资业务的全部链上交易 · 按时间从晚到早')}</span></header>${opsTable(d.ops,'lg-ops-demand')}</section>`;
  }
  const loanOfQuote=q=>q.status==='accepted'?A.data.loans.find(l=>l.quote===q.id)||null:null;
  function quoteExpand(q){
    const loan=loanOfQuote(q),lockEnd=q.lockedUntil||q.rejectAt||q.expireAt||now();
    return `<div class="lg-expand-grid"><div><h3 class="lg-expand-h">${L('Quote','报价')}</h3>${facts([
        q.quotedAt?[L('Quoted at','报价时间'),time(q.quotedAt)]:[L('Signature sent at','签名发出时间'),`${time(q.signedAt)}${meta(E(waited(q.signedAt)))}`],
        [L('Exchange rate','汇率'),q.id?`1 USDT = <span class="num">${q.fx.toFixed(4)}</span> ${E(q.ccy)}`:'—'],[L('Settlement amount','结算金额'),q.id?amt(q.settle,q.ccy):'—'],
        [L('Repayment type','还款类型'),E(txt(q.repayType))],[L('Final repayment date','最终还款日'),bizDate(q.finalDate)],
        [L('Locked for','已锁定时长'),q.quotedAt?E(span(q.quotedAt,lockEnd)):'—'],
        q.lending?[L('On-chain disbursement','链上放款'),`<span class="lg-tags">${chainTag('lending')}</span>${meta(E(waited(now()-41*60000)))}`]:null,
        q.status==='rejected'?[L('Rejected at','拒绝时间'),time(q.rejectAt)]:null,q.status==='rejected'?[L('Rejection reason','拒绝原因'),q.rejectReason?E(txt(q.rejectReason)):'—',true]:null,
        q.status==='expired'?[L('Expired at','失效时间'),time(q.expireAt)]:null,q.status==='expired'?[L('Demand end reason','所属需求终结原因'),E(txt(q.expireReason))]:null,
        [L('On-chain authorisation','本笔链上授权状态'),q.auth?tag(AUTH,q.auth):unavailable()],
        [L('Disbursement address','放款地址'),netAddr(q.loanAddr,ADDR()),true],[L('Repayment receiving address','还款收款地址'),netAddr(q.repayAddr,ADDR()),true]])}</div>`
      +(loan?`<div><h3 class="lg-expand-h">${L('Loan','放款')}</h3>${facts([
        [L('Loan number','放款编号'),`<span class="mono">${E(loan.id)}</span>`],[L('Disbursed amount','放款金额'),amt(loan.disbursed,loan.ccy)],
        [L('Disbursed at','放款成功时间'),time(loan.at)],[L('Asset holder receiving address','资产方收款地址'),netAddr(loan.addrs.receive,ADDR()),true]])}</div>`:'')+`</div>`
      +opsPointer(loan?L('Authorisation and disbursement transaction hashes','授权交易哈希与放款交易哈希'):L('The authorisation transaction hash','授权交易哈希'));
  }
  function demandQuotes(d){
    const rows=d.quotes.slice().sort((a,z)=>(z.quotedAt||z.signedAt)-(a.quotedAt||a.signedAt));
    const cols=[
      [L('Business number','融资业务编号'),q=>q.id?`<strong class="mono">${E(q.id)}</strong>`:pending()],
      [L('Quoting funder','报价机构'),q=>E(funder(q.funder))],
      [L('Financing amount','融资金额')+unit('USDT'),q=>`<span class="num">${num(q.amount)}</span>`,'lg-num'],
      [L('Settlement','结算币种'),q=>E(q.ccy)],
      [L('Annual rate','年化融资利率'),q=>`<span class="num">${pct(q.rate)}</span>`,'lg-num'],
      [L('Quote status','报价状态'),q=>`<span class="lg-tags">${tag(QUOTE,q.status)}${q.lending?chainTag('lending'):''}</span>`],
      [L('Loan number / amount','放款编号 / 放款金额'),q=>{const l=loanOfQuote(q);return l?`<span class="mono">${E(l.id)}</span>${meta(amt(l.disbursed,l.ccy))}`:'—';}],
      [L('Quoted at','报价时间')+zone(),q=>q.quotedAt?listTime(q.quotedAt):`—${meta(E(waited(q.signedAt)))}`,'lg-c-date']];
    const body=!rows.length?CF.empty(L('No quotes this round','本轮暂无报价'),'')
      :table(cols,rows,'lg-t-quotes',{label:L('Quotes and loans','报价放款'),box:false,actionHead:L('Details','详情'),action:expandBtn,expand:quoteExpand,hl:q=>!!A.hl&&q.ref===A.hl});
    return `<section class="card lg-card">${body}</section>`;
  }
  function periodExpand(p){
    return facts([
      [L('Repayment opens','还款入口开启时间'),`${E(CF.fmtDate(iso(p.due)+'T12:00:00Z'))} 00:00 <span class="lg-zone">UTC</span>`],
      [L('Interest period','计息区间'),`${bizDate(p.from)} ～ ${bizDate(p.to)} · ${L(p.days+' days',p.days+' 天')}`],
      [L('Principal due','应还本金'),amt(p.principal,'USDT')],[L('Interest due','应还利息'),amt(p.interest,'USDT')],
      [L('Repayment nature','还款性质'),p.nature?E(txt(NATURE[p.nature])):'—'],
      p.status==='confirming'?[L('Submitted at','提交时间'),`${time(p.submitAt)}${meta(E(waited(p.submitAt)))}`]:null,
      p.record?[L('Repayment record','还款记录编号'),`<span class="mono">${E(p.record.id)}</span>`]:null,
      p.record?[L('Currency and amount','还款币种与金额'),amt(p.record.amount,p.record.ccy)]:null,
      p.record?[L('Submitted at','提交时间'),time(p.record.at)]:null,
      p.record?[L('Paying address','出账地址'),netAddr(p.record.from,ADDR()),true]:null,
      p.record?[L('Receiving address','收款地址'),netAddr(p.record.to,ADDR()),true]:null,
      ])
      +(p.record||p.status==='confirming'?opsPointer(L('This period’s authorisation and repayment transaction hashes','本期的授权交易哈希与还款交易哈希')):'');
  }
  function demandRepay(d){
    const l=d.loan;
    if(!l)return `<section class="card lg-card">${CF.empty(L('This round has not been disbursed yet','本轮尚未放款'),'')}</section>`;
    const own=periodsOf(l.id),done=own.filter(p=>p.status==='settled'),late=own.filter(p=>p.status!=='settled'&&p.overdueDays>0).sort((a,z)=>a.due-z.due);
    const longest=late.reduce((m,p)=>Math.max(m,p.overdueDays),0);
    const cols=[
      [L('Period number','还款期次编号'),p=>`<strong class="mono">${E(p.id)}</strong>${meta(L(`Period ${p.seq} of ${p.total}`,`第 ${p.seq}／${p.total} 期`))}`],
      [L('Due date','应还日')+utc(),p=>listDate(p.due),'lg-c-date'],
      [L('Amount due','应还合计')+unit('USDT'),p=>`<span class="num">${num(p.sum)}</span>`,'lg-num'],
      [L('Settlement due','应还结算金额'),p=>amt(p.settle,p.ccy),'lg-num'],
      [L('Period status','期次状态'),p=>`<span class="lg-tags">${tag(PERIOD,p.status)}${p.unknown?unknownTag():''}</span>`],
      [L('Overdue','逾期'),p=>p.overdueDays?overdueTag(p.overdueDays):'—'],
      [L('Settled at','期次结清时间')+zone(),p=>listTime(p.settledAt),'lg-c-date']];
    return `<div class="detail-stack lg-stack">`
      +section(L('Repayment summary','还款摘要'),facts([
        [L('Business number','融资业务编号'),`<span class="mono">${E(l.quote)}</span>`],[L('Loan number','放款编号'),`<span class="mono">${E(l.id)}</span>`],
        [L('Business status','业务状态'),`<span class="lg-tags">${tag(LOAN,l.status)}${l.overdue?overdueTag():''}</span>`],
        [L('Earliest overdue period','最早逾期期次'),late[0]?`<span class="mono">${E(late[0].id)}</span>`:'—'],[L('Longest overdue','最长逾期天数'),longest?L(longest+' d',longest+' 天'):'—'],
        [L('Outstanding principal','未偿本金'),amt(l.outstanding,'USDT')],[L('Principal and interest repaid','累计已还本金与利息'),amt(l.repaid,'USDT')],
        [L('Repayment progress','还款进度'),l.planReady?L(`${done.length} of ${own.length} periods settled`,`已结清 ${done.length}／${own.length} 期`):L('Repayment plan being generated','还款计划生成中')],
        [L('Value date','起息日'),bizDate(l.valueDate)],[L('Final repayment date','最终还款日'),bizDate(l.finalDate)],[L('Settled at','业务结清时间'),time(l.settledAt)]]))
      +`<section class="card lg-section"><header class="lg-section-head"><h2>${L('Repayment periods','还款期次')}</h2></header>${!l.planReady?`<p class="lg-empty-line">${L('Repayment plan being generated · no periods yet','还款计划生成中，暂无期次')}</p>`
        :table(cols,own,'lg-t-periods',{label:L('Repayment periods','还款期次'),box:false,actionHead:L('Details','详情'),action:expandBtn,expand:periodExpand,hl:p=>!!A.hl&&p.ref===A.hl})}</section>`
      +`</div>`;
  }
  function demandDetail(d){
    const p=project(d.project),title=d.id?`<span class="mono">${E(d.id)}</span>`:`${L('Number not generated yet','编号尚未生成')}<span class="lg-title-id">${amt(d.amount,'USDT')} · ${L('initiated','发起于')} ${time(d.startedAt)}</span>`;
    const sub=`${L('Project','所属项目')} ${openLink('project',p.id,`<span class="mono">${E(p.id)}</span> · ${E(projectName(p))}`)} · ${E(owner(p.owner))}`;
    const tags=`${d.status?tag(DEMAND,d.status):''}${d.chain?chainTag(d.chain):''}${quoteLending(d)?chainTag('lending'):''}${d.chainUnknown?unknownTag():''}${d.loan?tag(REPAY,repayStatus(d)):''}`;
    const content=A.detailView==='partial'&&A.dtab!=='info'?`<section class="card lg-card">${partError('tab')}</section>`
      :A.dtab==='quotes'?demandQuotes(d):A.dtab==='repay'?demandRepay(d):A.dtab==='ops'?demandOps(d):demandInfo(d);
    return heading('demand',title,sub,tags)
      +summary([[L('Demand amount','需求金额'),amt(d.amount,'USDT')],[L('Disbursed amount','放款金额'),d.loan?amt(d.loan.disbursed,d.loan.ccy):'—'],
        [L('Outstanding principal','未偿本金'),d.loan?amt(d.loan.outstanding,'USDT'):'—'],[L('Next due date','本期应还日'),bizDate(nextDue(d))]])
      +dtabs('demand',{quotes:d.quotes.length,repay:d.loan&&d.loan.planReady?periodsOf(d.loan.id).length:null,ops:d.ops.length})+panel(content);
  }
  function detail(){
    const blocked=gate();
    if(blocked)return `<section class="card">${blocked}</section>`;
    const r=A.type&&A.detailView!=='missing'?find(A.type,A.ref):null;
    if(!r)return `<section class="card">${CF.empty(L('Content does not exist or you do not have access','内容不存在或无权访问'),L('Return to the financing ledger to continue.','请返回融资台账继续查看。'),b('Back to the financing ledger','返回融资台账','back','','primary'))}</section>`;
    if(A.detailView==='loading')return `<section class="card">${CF.skelTable(6)}</section>`;
    return A.type==='project'?projectDetail(r):demandDetail(r);
  }

  /* ---------------------------------------------------------------- 演示工具 */
  function grant(mode){
    if(!CF.opsAuth)return;
    CF.opsAuth.seedDemo('admin');
    if(mode==='noLedger')OPS.onAct('ops-grant',String(PERM));
    if(mode==='noReview')OPS.onAct('ops-grant',String(REVIEW_PERM));
    A.listView='default';A.totalsView='default';A.detailView='default';
  }
  const accountMode=()=>!canLedger()?'noLedger':!canReview()?'noReview':'admin';
  function demo(){
    if(OPS_PAGES.includes(S.page))return OPS.demo();
    const sel=(id,value,options)=>`<select class="inp" id="${id}">${options.map(([v,l])=>`<option value="${v}" ${v===value?'selected':''}>${E(l)}</option>`).join('')}</select>`;
    const field=(label,html)=>`<div class="field"><label for="${(html.match(/id="([^"]+)/)||[])[1]||''}">${label}</label>${html}</div>`;
    const mode=accountMode(),acct=(k,en,zh)=>`<button type="button" class="btn ${mode===k?'primary':''}" data-act="lg-grant" data-v="${k}" aria-pressed="${mode===k}">${L(en,zh)}</button>`;
    return `<h3>${L('Financing ledger · demo tools','融资台账 · 演示工具')}</h3><p class="lg-meta">${L('Local demonstration only. Records are fictional; read states and permissions are simulated.','仅本地演示：记录为虚构数据，读取状态与权限为模拟。')}</p>
      <h4>${L('Account sample','账号样本')}</h4><div class="lg-demo-actions">${acct('admin','Operations administrator','运营管理员')}${acct('noLedger','Without ledger query','缺融资台账查询')}${acct('noReview','Without project review query','缺融资项目审核查询')}</div>
      <h4>${L('Read states','读取状态')}</h4><div class="lg-demo">
        ${S.page===LIST?field(L('List','清单'),sel('lg-demo-list',A.listView,[['default',L('Default','默认')],['loading',L('Loading','读取中')],['empty',L('No records','清单无记录')],['error',L('Load failed','读取失败')]])):''}
        ${S.page===LIST?field(L('Totals','合计'),sel('lg-demo-totals',A.totalsView,[['default',L('Default','正常')],['error',L('Load failed','读取失败')]])):''}
        ${S.page===DT?field(L('Detail','详情'),sel('lg-demo-detail',A.detailView,[['default',L('Default','默认')],['loading',L('Loading','读取中')],['partial',L('Partly unavailable','部分读取失败')],['missing',L('Not found or no access','不存在或无权')]])):''}
        ${S.page===DT?field(L('Blockchain explorer','区块链浏览器入口'),sel('lg-demo-explorer',A.explorer?'on':'off',[['on',L('Available','可用')],['off',L('Unavailable · copy only','暂不可用 · 仅可复制')]])):''}</div>
      <h4>${L('Edge cases','边界情况')}</h4><div class="lg-demo-actions">
        ${S.page===LIST?b('Fewer records · page out of range','记录减少 · 页码超出','overflow'):''}
        ${S.page===DT?b('Source record updated','来源记录已更新','stale','','',!!A.stale):''}
        ${b('Expire operations session','运营登录失效','expire-session')}${b('Reset demonstration','重置演示','restart')}</div>
      ${A.stale?`<p class="lg-meta">${L('On return, the list will report that this record no longer matches its conditions.','返回清单时将提示该记录已不再满足筛选条件。')}</p>`:''}`;
  }

  /* ---------------------------------------------------------------- 动作 */
  /* 复制完整值；剪贴板不可用时弹出完整值供手动复制。 */
  async function copyValue(v){
    const what=v.length===66?L('Transaction hash copied','交易哈希已复制'):v.length===42?L('Address copied','地址已复制'):L('Copied','已复制');
    try{if(!navigator.clipboard)throw Error('clipboard');await navigator.clipboard.writeText(v);CF.toast(what);}
    catch(_){CF.openLayer('modal','lg-copy',v);}
  }
  const layers={...(OPS.layers||{}),'lg-copy':v=>({title:L('Copy manually','手动复制'),
    html:`<p class="lg-meta">${L('Automatic copy is unavailable. Select and copy the full value below.','自动复制不可用，请选中下方完整值手动复制。')}</p><textarea class="inp mono lg-raw" readonly rows="3" aria-label="${L('Full value','完整值')}">${E(v)}</textarea>`,
    foot:`<button type="button" class="btn" data-act="closelayer">${L('Close','关闭')}</button>`})};
  function applyFilter(){
    const v=view(A.tab),f={...v.edit};
    f.q=(f.q||'').trim();
    if(LISTS[A.tab].range&&f.from&&f.to&&f.from>f.to){v.open=true;v.error=['The start date must not be later than the end date.','开始日期不得晚于结束日期。'];CF.render();$('lg-f-from')?.focus();return;}
    v.error='';v.filter=f;v.edit={...f};v.page=1;A.notice=null;saveContext();CF.render();
  }
  function clearAll(){
    const fresh=blank(A.tab),v=view(A.tab);
    v.filter=fresh.filter;v.edit={...fresh.filter};v.page=1;v.error='';A.notice=null;saveContext();CF.render();
    $('lg-f-q')?.focus();
  }
  function onAct(act,value,e){
    if(e&&(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)&&['lg-open','lg-tab','lg-dtab'].includes(act))return false;
    if(!act.startsWith('lg-')){
      if(act==='retry'){A.listView='default';A.totalsView='default';A.detailView='default';CF.render();return true;}
      if(act==='clearfilter'){clearAll();return true;}
      return false;
    }
    act=act.slice(3);
    if(!['copy','grant','overflow','stale','expand'].includes(act))A.pageNote=false;
    if(act==='tab'){
      if(!TABS.includes(value)||value===A.tab)return true;
      A.notice=null;A.listView='default';A.totalsView='default';A.tab=value;location.hash='#'+listRoute(value);
      requestAnimationFrame(()=>$('lg-tab-'+value)?.focus({preventScroll:true}));
    }
    else if(act==='dtab'){
      /* 详情内切换 tab 只改写当前地址，返回链仍指向来源。 */
      A.dtab=value;replaceRoute(detailRoute(A.type,A.ref,{tab:value,kw:A.kw,hl:A.hl}));CF.render();
      requestAnimationFrame(()=>$('lg-dtab-'+value)?.focus({preventScroll:true}));
    }
    else if(act==='open'){const o=JSON.parse(value);go(detailRoute(o.type,o.ref,{tab:o.tab,hl:o.hl,kw:o.kw}));}
    else if(act==='expand'){const s=inner().open;s.has(value)?s.delete(value):s.add(value);CF.render();document.querySelector(`[data-act="lg-expand"][data-v="${CSS.escape(value)}"]`)?.focus({preventScroll:true});}
    else if(act==='back')back();
    else if(act==='page'){view(A.tab).page=Math.max(1,+value);saveContext();CF.render();const box=document.querySelector('.lg-table-region');if(box)box.scrollTop=0;}
    else if(act==='pl-page'){inner().pl.page=Math.max(1,+value);CF.render();}
    else if(act==='dm-page'){inner().dm.page=Math.max(1,+value);CF.render();}
    else if(act==='pl-reset'){const st=inner().pl;st.filter={dest:'',tokenState:'',q:''};st.edit={...st.filter};st.page=1;CF.render();}
    else if(act==='filters'){const v=view(A.tab);v.open=!v.open;CF.render();document.querySelector('[data-act=lg-filters]')?.focus();}
    else if(act==='reset'){const v=view(A.tab),fresh=blank(A.tab);v.edit={...fresh.filter};v.error='';v.open=false;v.filter=fresh.filter;v.page=1;v.sort=fresh.sort;v.dir=fresh.dir;A.notice=null;saveContext();CF.render();}
    else if(act==='clear')clearAll();
    else if(act==='list-retry'){A.listView='default';CF.render();}
    else if(act==='totals-retry'){A.totalsView='default';CF.render();}
    else if(act==='part-retry'){A.detailView='default';CF.render();}
    else if(act==='copy')copyValue(value);
    else if(act==='sign-in'){location.hash='#/ops/login';}
    else if(act==='grant'){grant(value);CF.render();}
    else if(act==='overflow'){view(A.tab).page=99;CF.render();}
    else if(act==='stale'){A.stale=true;CF.render();CF.toast(L('The source record has changed. Return to the list to see the notice.','来源记录已变化，返回清单可看到提示。'));}
    else if(act==='expire-session'){S.demo=false;OPS.onAct('ops-session-expire');CF.render();}
    else if(act==='restart'){
      try{sessionStorage.removeItem(TRAIL);sessionStorage.removeItem(VIEWS);}catch(_){}
      load();A.views={};A.tab='projects';A.inner=null;A.listView='default';A.totalsView='default';A.detailView='default';A.explorer=true;A.notice=null;A.stale=false;
      grant('admin');location.hash='#'+listRoute('projects');CF.render();
    }
    else return false;
    return true;
  }
  function onInput(e){
    const el=e.target,id=el.id||'';
    if(id.startsWith('lg-f-')&&S.page===LIST)view(A.tab).edit[id.slice(5)]=el.value;
    if(id.startsWith('lg-pl-')&&S.page===DT)inner().pl.edit[id.slice(6)]=el.value;
  }
  document.addEventListener('submit',e=>{
    if(e.target.id==='lg-filter-form'){e.preventDefault();applyFilter();}
    if(e.target.id==='lg-pl-form'){e.preventDefault();const st=inner().pl;st.filter={...st.edit,q:(st.edit.q||'').trim()};st.edit={...st.filter};st.page=1;CF.render();}
  });
  document.addEventListener('input',onInput);
  document.addEventListener('change',e=>{
    onInput(e);const id=e.target.id;
    if(id==='lg-order'){const [k,d]=e.target.value.split(':'),v=view(A.tab);v.sort=k;v.dir=+d;v.page=1;saveContext();CF.render();$('lg-order')?.focus();}
    if(id==='lg-demo-list'){A.listView=e.target.value;CF.render();}
    if(id==='lg-demo-totals'){A.totalsView=e.target.value;CF.render();}
    if(id==='lg-demo-detail'){A.detailView=e.target.value;CF.render();}
    if(id==='lg-demo-explorer'){A.explorer=e.target.value==='on';CF.render();}
  });
  /* 标签页键盘：左右键在同一组 tab 间移动焦点，回车或空格切换。 */
  document.addEventListener('keydown',e=>{
    const t=e.target.closest?.('.lg-tabs [role="tab"], .lg-dtabs [role="tab"]');if(!t)return;
    const group=[...t.parentElement.querySelectorAll('[role="tab"]')],i=group.indexOf(t);let n=null;
    if(e.key==='ArrowRight')n=(i+1)%group.length;else if(e.key==='ArrowLeft')n=(i+group.length-1)%group.length;
    else if(e.key==='Home')n=0;else if(e.key==='End')n=group.length-1;
    else if(e.key===' '){e.preventDefault();t.click();return;}
    if(n==null)return;e.preventDefault();group[n].focus();
  });
  window.addEventListener('hashchange',()=>{const t=trail();if(t.length&&t[t.length-1]===location.hash){t.pop();setTrail(t);}});

  /* ---------------------------------------------------------------- 评审目录 */
  const DENIED={id:'denied',label:['No access','无权限'],group:'business'};
  const sample=(type,test,o={})=>{const r=A.data[TAB_OF[type]].find(test);return r?{route:detailRoute(type,r.ref,typeof o==='function'?o(r):o),id:r.id||r.ref}:null;};
  CF.review.register(LIST,{group:['Financing ledger','融资台账'],label:['Ledger lists','台账清单'],
    states:['default','loading','empty','noresult','error',{id:'totals',label:['Totals unavailable','合计读取失败']},DENIED],
    route:()=>listRoute(),
    get:()=>!canLedger()?'denied':A.listView!=='default'?A.listView:A.totalsView==='error'?'totals':scope(A.tab).length||!conditions(A.tab).length?'default':'noresult',
    set(value){
      if(value==='denied'){grant('noLedger');return;}
      if(!canLedger())grant('admin');
      A.listView='default';A.totalsView='default';
      if(value==='totals')A.totalsView='error';
      else if(value==='noresult'){const v=view(A.tab);v.filter={...blank(A.tab).filter,q:'NO-MATCH-0000'};v.edit={...v.filter};v.page=1;saveContext();}
      else if(value!=='default')A.listView=value;
    },
    reset(){if(!canLedger())grant('admin');A.listView='default';A.totalsView='default';},
    beforeChange(proceed){proceed();}});
  CF.review.register(DT,{group:['Financing ledger','融资台账'],label:['Record detail','记录详情'],
    states:['default','loading',{id:'partial',label:['Partly unavailable','部分读取失败']},{id:'missing',label:['Not found or no access','不存在或无权']},DENIED],
    scenarios:()=>[
      ['project-short',['Project · insufficient pledge','项目 · 质押不足'],sample('project',r=>r.coverage==='short')],
      ['project-pledges',['Project · pledge to be verified','项目 · 质押链上结果待核实'],sample('project',r=>A.data.pledges.some(x=>x.project===r.id&&x.unknown),{tab:'pledges'})],
      ['demand-pending',['Demand · number not generated','需求 · 编号尚未生成'],sample('demand',r=>!r.id)],
      ['demand-lending',['Demand · disbursement in progress','需求 · 链上放款处理中'],sample('demand',r=>quoteLending(r),r=>({tab:'quotes',hl:r.quotes.find(q=>q.lending).ref}))],
      ['demand-confirming',['Demand · repayment confirming','需求 · 还款上链确认中'],sample('demand',r=>!!r.loan&&periodsOf(r.loan.id).some(p=>p.status==='confirming'),r=>({tab:'repay',hl:periodsOf(r.loan.id).find(p=>p.status==='confirming').ref}))],
      ['demand-plan',['Demand · plan being generated','需求 · 还款计划生成中'],sample('demand',r=>!!r.loan&&!r.loan.planReady,{tab:'repay'})],
      ['demand-ops',['Demand · operation records','需求 · 操作记录'],sample('demand',r=>r.ops.some(o=>o.state==='failed'),{tab:'ops'})]
    ].map(([id,label,s])=>({id,label,available:canLedger()&&!!s,route:s?s.route:null,description:s?['Demo record · '+s.id,'演示记录 · '+s.id]:['No matching record','暂无对应记录']})),
    route:()=>detailRoute('project',A.data.projects[0].ref),
    get:()=>!canLedger()?'denied':A.detailView,
    set(value){if(value==='denied'){grant('noLedger');return;}if(!canLedger())grant('admin');A.detailView=value;},
    reset(){if(!canLedger())grant('admin');A.detailView='default';},
    beforeChange(proceed){proceed();}});

  /* ---------------------------------------------------------------- 接入 */
  const dict={
    en:{...OPS.dict.en,navLedger:'Financing ledger',navLedgerDetail:'Record detail',navLedger_project:'Financing project detail',navLedger_demand:'Financing demand detail'},
    zh:{...OPS.dict.zh,navLedger:'融资台账',navLedgerDetail:'记录详情',navLedger_project:'融资项目详情',navLedger_demand:'融资需求详情'}
  };
  CF.define({...OPS,id:'financing-ledger',demoOnly:true,reviewToolsInLayer:false,dict,demo,layers,
    content:page=>{
      if(OPS_PAGES.includes(page))return OPS.content(page);
      return page===DT?detail():list();
    },
    onAct:(act,v,e)=>onAct(act,v,e)||OPS.onAct(act,v,e),
    beforeAdminNavigate(proceed){remember();proceed();},
    allowNav:id=>[LIST,DT].includes(id)?allowed():OPS_PAGES.includes(id),
    breadcrumbRoute:id=>id===LIST?listRoute(A.type?TAB_OF[A.type]:A.tab):null,
    onBeforeAct(act,v,e){
      if(act==='retry'||act==='clearfilter'){onAct(act,v,e);return true;}
      return OPS.onBeforeAct(act,v,e);
    },
    beforeRender(){
      S.toTop=false;syncContext();
      CF.PAGES[DT].crumbKey=A.type?'navLedger_'+A.type:'navLedgerDetail';
      const signed=signedIn();
      if(signed&&[LIST,DT].includes(S.page))lastHash=location.hash;
      if(!signed&&wasSigned&&onModule)returnHash=lastHash;
      OPS.beforeRender();
      /* 重新登录后回到原页面并重新读取；权限仍按当前账号判定。 */
      if(signed&&!wasSigned&&returnHash){location.hash=returnHash;returnHash='';}
      wasSigned=signed;onModule=[LIST,DT].includes(S.page);
    },
    afterRender(){OPS.afterRender();restoreView();},
    onRoute(prev,id){
      restoreContext=true;A.pageNote=false;
      if(OPS_PAGES.includes(id)||OPS_PAGES.includes(prev))OPS.onRoute(prev,id);
    }
  });
  S.end='admin';S.role='ops';
  CF.opsAuth.seedDemo('admin');
  if(!location.hash.startsWith('#'+ROOT)){
    try{history.replaceState(null,'','#'+listRoute('projects'));}catch(error){location.hash='#'+listRoute('projects');}
  }
  CF.boot();
})(window.CF);
