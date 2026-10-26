/* WS-464 · 融资台账（运营端，只读）：一个菜单、六个清单，记录详情与关联跳转。
   会话与功能权限读运营端账户与登录一处登记（CF.opsAuth）：
   PM-LG-01 融资台账查询（原型内部键 24）；PM-AL-17 融资项目审核查询（17）只决定项目审核详情入口。
   台账不办理、不改写任何业务状态；数据为本模块自有的演示数据，读取状态由演示工具模拟。 */
(function(CF){
  'use strict';
  const S=CF.S,L=CF.L,E=CF.esc,OPS=CF.opsAccountModule,$=id=>document.getElementById(id);
  const LIST='P-O-LG-01',DT='P-O-LG-02',ROOT='/ops/financing-ledger',DETAIL=ROOT+'/detail';
  const OPS_PAGES=['P-O-AL-01','P-O-AL-03','P-O-AL-04','P-O-AL-05','P-O-AL-06','P-O-AL-07'];
  const PERM=24,REVIEW_PERM=17;
  const TRAIL='hc.ops.ledger.trail.v1',VIEWS='hc.ops.ledger.views.v1';
  const D=86400000;

  /* ---------------------------------------------------------------- 词表 */
  const TABS=['projects','pledges','demands','quotes','loans','periods'];
  const TAB={projects:['Financing projects','融资项目信息'],pledges:['Token pledges','代币质押清单'],demands:['Financing demands','融资需求清单'],
    quotes:['Quotes','报价清单'],loans:['Loans','放款清单'],periods:['Repayments','还款清单']};
  const TYPE={projects:'project',pledges:'pledge',demands:'demand',quotes:'quote',loans:'loan',periods:'period'};
  const TAB_OF=Object.fromEntries(Object.entries(TYPE).map(([k,v])=>[v,k]));
  const KIND={project:['Financing project','融资项目'],pledge:['Pledge record','质押记录'],demand:['Financing demand','融资需求'],
    quote:['Quote','报价'],loan:['Loan','放款'],period:['Repayment period','还款期次']};
  const EMPTY={projects:['No financing projects yet','暂无融资项目'],pledges:['No pledge records yet','暂无质押记录'],demands:['No financing demands yet','暂无融资需求'],
    quotes:['No quotes yet','暂无报价记录'],loans:['No loans yet','暂无放款记录'],periods:['No repayment periods yet','暂无还款期次']};
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
    withdrawing:['Withdrawal in progress','撤下处理中'],quoting:['Quote confirming on-chain','报价上链确认中'],lending:['On-chain disbursement in progress','链上放款处理中']};
  const OPKIND={publish:['Publish · freeze','发布 · 冻结'],resize:['Amount change · freeze adjustment','改额 · 冻结调整'],
    withdraw:['Withdraw · unfreeze','撤下 · 解冻'],release:['Platform freeze release','平台执行的冻结解除'],unfreeze:['Platform freeze release','平台执行的冻结解除']};
  const QUOTE={confirming:['Quote confirming on-chain','报价上链确认中','accent'],pending:['Awaiting acceptance','待接受','accent'],
    accepted:['Accepted','已接受','ok'],rejected:['Rejected','已拒绝','gray'],expired:['Quote expired','报价已失效','gray']};
  const AUTH={processing:['Authorisation in progress','授权处理中','accent'],authorized:['Authorised','已授权','ok'],
    revoking:['Revocation in progress','撤销处理中','accent'],revoked:['Revoked','已撤销','gray'],used:['Used','已使用','gray']};
  const LOAN={repaying:['Repaying','还款中','accent'],settled:['Settled','已结清','gray']};
  const PERIOD={pending:['Awaiting repayment','待还款','accent'],confirming:['Repayment confirming on-chain','还款上链确认中','accent'],settled:['Settled','已结清','gray']};
  const NATURE={normal:['Normal repayment','正常还款'],overdue:['Overdue repayment','逾期还款']};

  /* ---------------------------------------------------------------- 数据 */
  let seed=CF.ledgerSeed();
  const A={data:seed,tab:'projects',views:{},listView:'default',totalsView:'default',detailView:'default',
    ref:null,type:null,notice:null,stale:false,errors:{}};
  let routeKey=null,restoreContext=false,returnHash='',lastHash='',onModule=false,wasSigned=false;
  const positions=new Map();

  function index(){
    const d=A.data;let n=0;
    ['projects','pledges','demands','quotes','loans','periods'].forEach(k=>d[k].forEach(r=>{r.ref=r.id||(TYPE[k]+'-pending-'+(++n));}));
    d.byProject=Object.fromEntries(d.projects.map(p=>[p.id,p]));
  }
  index();
  const txt=x=>Array.isArray(x)?L(x[0],x[1]):x;
  const project=id=>A.data.byProject[id];
  const projectName=p=>L('Demo financing project '+p.key,'示例融资项目 '+p.key);
  const owner=k=>txt(A.data.owners[k]);
  const funder=k=>txt(A.data.funders[k]);
  const ownerOf=r=>owner(project(r.project).owner);
  const quoteOf=id=>A.data.quotes.find(q=>q.id===id);
  const demandOf=id=>A.data.demands.find(d=>d.id===id);
  const loanOf=id=>A.data.loans.find(l=>l.id===id);
  const loanByQuote=id=>A.data.loans.find(l=>l.quote===id);
  const periodsOf=id=>A.data.periods.filter(p=>p.loan===id);
  const find=(type,ref)=>(A.data[TAB_OF[type]]||[]).find(r=>r.ref===ref)||null;

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
  function waited(from){
    const m=Math.max(0,Math.floor((now()-from)/60000)),h=Math.floor(m/60),d=Math.floor(h/24);
    const text=d?L(`${d} d ${h%24} h`,`${d} 天 ${h%24} 小时`):h?L(`${h} h ${m%60} min`,`${h} 小时 ${m%60} 分钟`):L(`${m} min`,`${m} 分钟`);
    return L('Waiting ','已等待 ')+text;
  }
  const span=(a,b)=>{const m=Math.max(0,Math.floor((b-a)/60000)),h=Math.floor(m/60),d=Math.floor(h/24);
    return d?L(`${d} d ${h%24} h`,`${d} 天 ${h%24} 小时`):h?L(`${h} h ${m%60} min`,`${h} 小时 ${m%60} 分钟`):L(`${m} min`,`${m} 分钟`);};
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
  function addrFull(v,label){
    if(!v)return '—';
    return `<span class="lg-addr"><span class="mono">${E(v)}</span>${CF.copyBtn('lg-copy',v,L('Copy the full '+label,'复制完整'+label))}</span>`;
  }
  const netAddr=(v,label)=>v?`<span class="lg-netaddr">${network()}${addrFull(v,label)}</span>`:'—';
  const b=(en,zh,act,value='',cls='',disabled=false)=>`<button type="button" class="btn ${cls}" data-act="lg-${act}" data-v="${E(value)}" ${disabled?'disabled':''}>${L(en,zh)}</button>`;
  const openLink=(type,ref,label,cls='')=>`<a class="lg-link ${cls}" href="#${E(detailRoute(type,ref))}" data-act="lg-open" data-v="${E(type+'|'+ref)}">${label}</a>`;
  const idText=r=>r.id?E(r.id):pending();
  function facts(items){
    return `<div class="ops-facts-region ops-facts-body"><dl class="ops-facts">${items.filter(Boolean).map(([label,value,wide])=>`<div${wide?' class="ops-fact-wide"':''}><dt>${label}</dt><dd>${value==null||value===''?'—':value}</dd></div>`).join('')}</dl></div>`;
  }
  function section(title,body,note='',id=''){
    return `<section class="card lg-section"${id?` id="${id}"`:''}><header class="lg-section-head"><h2>${title}</h2>${note?`<span class="lg-section-note">${note}</span>`:''}</header>${body}</section>`;
  }
  const verifyNote=()=>L('Shown as recorded; the platform has not verified these on-chain.','按记录展示，平台未做链上核验');
  function sectionError(title,key){
    return section(title,`<div class="lg-part-error" role="status">${unavailable()}${b('Retry','重试','part-retry',key,'sm')}</div>`);
  }

  /* ---------------------------------------------------------------- 权限 */
  const signedIn=()=>!!CF.opsAuth&&CF.opsAuth.can(14);
  const canLedger=()=>!!CF.opsAuth&&CF.opsAuth.can(PERM);
  const canReview=()=>!!CF.opsAuth&&CF.opsAuth.can(REVIEW_PERM);
  const allowed=()=>S.end==='admin'&&signedIn()&&canLedger();
  function signedOut(){return CF.empty(L('Sign in to continue','请先完成运营登录'),
    L('Your session has ended. Sign in again to open the financing ledger.','登录已失效，请重新登录后查看融资台账。'),
    b('Sign in again','重新登录','sign-in','','primary'));}
  /* 列表与详情统一提示，不透露记录是否存在。 */
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
  const ccyOpts=()=>[all(),['USDT','USDT'],['USDC','USDC']];
  const yn=(v,test)=>!v||(v==='yes')===!!test;
  const eq=(a,q)=>!!a&&String(a).toLowerCase()===q;
  const has=(a,q)=>!!a&&String(a).toLowerCase().includes(q);
  const projectCells=r=>{const p=project(r.project);return `<strong class="mono">${E(p.id)}</strong>${meta(E(projectName(p)))}`;};

  const LISTS={
    projects:{
      rows:()=>A.data.projects,
      primary:{key:'status',label:['Project status','项目状态'],options:()=>opts(PROJECT),test:(r,v)=>r.status===v},
      more:[
        {key:'expired',label:['Expired','已到期'],options:yesNo,test:(r,v)=>yn(v,r.expired)},
        {key:'coverage',label:['Pledge coverage','质押情况'],options:()=>[...opts(COVER),['unknown',L('Unavailable','暂不可用')]],test:(r,v)=>v==='unknown'?!r.coverage:r.coverage===v},
        {key:'token',label:['Token type','代币类型'],options:()=>[all(),...A.data.tokenTypes.map(t=>[t,t])],test:(r,v)=>r.tokenType===v},
        {key:'owner',label:['Project publisher','项目发布方'],options:ownerOpts,test:(r,v)=>r.owner===v}],
      search:['Project number, name, publisher or pledge contract address','项目编号、项目名称、项目发布方或质押合约地址'],
      match:(r,q)=>eq(r.id,q)||has(projectName(r),q)||has(owner(r.owner),q)||eq(r.contracts.pledge,q),
      sorts:[['configuredAt',-1,['Configuration completed · latest first','合约配置完成时间 · 从晚到早']],['configuredAt',1,['Configuration completed · earliest first','合约配置完成时间 · 从早到晚']],
        ['validUntil',1,['Valid until · earliest first','有效期至 · 从早到晚']],['validUntil',-1,['Valid until · latest first','有效期至 · 从晚到早']],
        ['effective',-1,['Effective pledge · high to low','有效质押额 · 从高到低']],['effective',1,['Effective pledge · low to high','有效质押额 · 从低到高']],
        ['inTransit',-1,['In-transit amount · high to low','项目在途金额 · 从高到低']],['inTransit',1,['In-transit amount · low to high','项目在途金额 · 从低到高']],
        ['balance',-1,['Financing balance · high to low','项目融资余额 · 从高到低']],['balance',1,['Financing balance · low to high','项目融资余额 · 从低到高']]],
      value:(r,k)=>r[k]==null?-Infinity:r[k],
      totals:rows=>[[L('Projects','项目数'),`<span class="num">${rows.length}</span>`],[L('In-transit amount','项目在途金额合计'),amt(sum(rows,r=>r.inTransit),'USDT')],[L('Financing balance','项目融资余额合计'),amt(sum(rows,r=>r.balance),'USDT')]],
      cols:[
        [L('Blockchain network','区块链网络'),()=>network(),'lg-c-net'],
        [L('Project number / name','项目编号 / 项目名称'),r=>`<strong class="mono">${E(r.id)}</strong>${meta(E(projectName(r)))}`],
        [L('Publisher / token type','项目发布方 / 代币类型'),r=>`${E(owner(r.owner))}${meta(E(r.tokenType))}`],
        [L('Project status','项目状态'),r=>`<span class="lg-tags">${tag(PROJECT,r.status)}${r.expired?expiredTag():''}</span>`],
        [L('Valid until','有效期至')+utc(),r=>listDate(r.validUntil),'lg-c-date'],
        [L('Effective pledge','有效质押额')+unit('USD'),r=>r.effective==null?unavailable():`<span class="num">${num(r.effective)}</span>`,'lg-num'],
        [L('Pledge coverage','质押情况'),r=>r.coverage?tag(COVER,r.coverage):unavailable()],
        [L('In transit / balance','在途金额 / 融资余额')+unit('USDT'),r=>`<span class="num">${num(r.inTransit)}</span>${meta(`<span class="num">${num(r.balance)}</span>`)}`,'lg-num']]
    },
    pledges:{
      rows:()=>A.data.pledges,
      primary:{key:'dest',label:['Current destination','当前去向'],options:()=>opts(DEST),test:(r,v)=>r.dest===v},
      more:[
        {key:'tokenState',label:['Token status','代币状态'],options:()=>opts(TOKEN_STATE),test:(r,v)=>r.tokenState===v},
        {key:'counted',label:['Counted in effective pledge','是否计入有效质押'],options:yesNo,test:(r,v)=>yn(v,r.dest==='counted')},
        {key:'owner',label:['Project publisher','项目发布方'],options:ownerOpts,test:(r,v)=>project(r.project).owner===v},
        {key:'project',label:['Project','所属项目'],options:projectOpts,test:(r,v)=>r.project===v}],
      search:['Pledge record, token number, project number, holder address or batch','质押记录编号、代币编号、项目编号、原持有地址或提交批次编号'],
      match:(r,q)=>eq(r.id,q)||eq(r.token,q)||eq(r.project,q)||eq(r.holder,q)||eq(r.batch,q),
      sorts:[['pledgedAt',-1,['Pledged · latest first','质押时间 · 从晚到早']],['pledgedAt',1,['Pledged · earliest first','质押时间 · 从早到晚']],
        ['value',-1,['Share value · high to low','份额价值 · 从高到低']],['value',1,['Share value · low to high','份额价值 · 从低到高']]],
      value:(r,k)=>k==='pledgedAt'?(r.pledgedAt||r.startedAt):r[k],
      totals:rows=>[[L('Records','记录数'),`<span class="num">${rows.length}</span>`],[L('Share value','份额价值合计'),amt(sum(rows,r=>r.value),'USD')]],
      totalsNote:['Includes shares not counted and shares already removed; not a project’s total or effective pledge.','含不计入有效质押与已移出的份额，不等于项目总质押额或有效质押额'],
      cols:[
        [L('Pledge record','质押记录编号'),r=>r.id?`<strong class="mono">${E(r.id)}</strong>`:`${pending()}${meta(E(r.apply))}`],
        [L('Project / publisher','所属项目 / 项目发布方'),r=>`<span class="mono">${E(r.project)}</span>${meta(E(ownerOf(r)))}`],
        [L('Token / quantity','代币编号 / 质押数量'),r=>`<span class="mono">${E(r.token)}</span>${meta(E(r.qty+' '+r.symbol))}`],
        [L('Original holder','原持有地址'),r=>addrShort(r.holder)],
        [L('Share value','份额价值')+unit('USD'),r=>`<span class="num">${num(r.value)}</span>`,'lg-num'],
        [L('Token status','代币状态'),r=>tag(TOKEN_STATE,r.tokenState)],
        [L('Current destination','当前去向'),r=>`<span class="lg-tags">${tag(DEST,r.dest)}${r.unknown?unknownTag():''}</span>`],
        [L('Pledged at','质押时间')+zone(),r=>r.pledgedAt?listTime(r.pledgedAt):`—${meta(E(waited(r.startedAt)))}`,'lg-c-date']]
    },
    demands:{
      rows:()=>A.data.demands,
      primary:{key:'status',label:['Application status','申请状态'],options:()=>opts(DEMAND),test:(r,v)=>r.status===v},
      more:[
        {key:'endReason',label:['End reason','终结原因'],options:()=>[all(),...[...new Map(A.data.demands.filter(d=>d.endReason).map(d=>[d.endReason[1],d.endReason])).values()].map(x=>[x[1],txt(x)])],test:(r,v)=>!!r.endReason&&r.endReason[1]===v},
        {key:'chain',label:['On-chain processing','是否链上处理中'],options:yesNo,test:(r,v)=>yn(v,r.chain)},
        {key:'funder',label:['Quoting funder','报价机构'],options:funderOpts,test:(r,v)=>!!currentQuote(r)&&currentQuote(r).funder===v},
        {key:'owner',label:['Project publisher','项目发布方'],options:ownerOpts,test:(r,v)=>project(r.project).owner===v},
        {key:'project',label:['Project','所属项目'],options:projectOpts,test:(r,v)=>r.project===v}],
      range:{label:['Published','本轮发布日期'],field:r=>r.publishedAt},
      search:['Application number, project number or project name','融资申请编号、项目编号或项目名称'],
      match:(r,q)=>eq(r.id,q)||eq(r.project,q)||has(projectName(project(r.project)),q),
      sorts:[['publishedAt',-1,['Published · latest first','本轮发布时间 · 从晚到早']],['publishedAt',1,['Published · earliest first','本轮发布时间 · 从早到晚']],
        ['amount',-1,['Demand amount · high to low','需求金额 · 从高到低']],['amount',1,['Demand amount · low to high','需求金额 · 从低到高']]],
      value:(r,k)=>k==='publishedAt'?(r.publishedAt||r.startedAt):r[k],
      totals:rows=>[[L('Records','记录数'),`<span class="num">${rows.length}</span>`],[L('Demand amount','需求金额合计'),amt(sum(rows,r=>r.amount),'USDT')]],
      totalsNote:['Includes ended rounds; not the projects’ in-transit amount.','含已终结各轮的金额，不等于项目在途金额'],
      cols:[
        [L('Application number','融资申请编号'),r=>r.id?`<strong class="mono">${E(r.id)}</strong>`:pending()],
        [L('Project / publisher','所属项目 / 项目发布方'),r=>`<span class="mono">${E(r.project)}</span>${meta(E(ownerOf(r)))}`],
        [L('Demand amount','需求金额')+unit('USDT'),r=>`<span class="num">${num(r.amount)}</span>`,'lg-num'],
        [L('Application status','申请状态'),r=>`<span class="lg-tags">${r.status?tag(DEMAND,r.status):'—'}${r.chain?chainTag(r.chain):''}${r.chainUnknown?unknownTag():''}</span>${r.endReason?meta(E(txt(r.endReason))):''}`,'lg-c-status'],
        [L('Quoting funder','报价机构'),r=>{const q=currentQuote(r);return q?E(funder(q.funder)):'—';}],
        [L('Published at','本轮发布时间')+zone(),r=>r.publishedAt?listTime(r.publishedAt):`—${meta(E(waited(r.startedAt)))}`,'lg-c-date']]
    },
    quotes:{
      rows:()=>A.data.quotes,
      primary:{key:'status',label:['Quote status','报价状态'],options:()=>opts(QUOTE),test:(r,v)=>r.status===v},
      more:[
        {key:'lending',label:['On-chain disbursement in progress','是否链上放款处理中'],options:yesNo,test:(r,v)=>yn(v,r.lending)},
        {key:'ccy',label:['Settlement currency','结算币种'],options:ccyOpts,test:(r,v)=>r.ccy===v},
        {key:'funder',label:['Quoting funder','报价机构'],options:funderOpts,test:(r,v)=>r.funder===v},
        {key:'owner',label:['Borrower','融资企业'],options:ownerOpts,test:(r,v)=>project(r.project).owner===v},
        {key:'project',label:['Project','所属项目'],options:projectOpts,test:(r,v)=>r.project===v}],
      range:{label:['Quoted','报价日期'],field:r=>r.quotedAt},
      search:['Business number, application number or project number','融资业务编号、融资申请编号或项目编号'],
      match:(r,q)=>eq(r.id,q)||eq(r.demand,q)||eq(r.project,q),
      sorts:[['quotedAt',-1,['Quoted · latest first','报价时间 · 从晚到早']],['quotedAt',1,['Quoted · earliest first','报价时间 · 从早到晚']],
        ['amount',-1,['Financing amount · high to low','融资金额 · 从高到低']],['amount',1,['Financing amount · low to high','融资金额 · 从低到高']],
        ['rate',-1,['Annual rate · high to low','年化融资利率 · 从高到低']],['rate',1,['Annual rate · low to high','年化融资利率 · 从低到高']]],
      value:(r,k)=>k==='quotedAt'?(r.quotedAt||r.signedAt):r[k],
      totals:rows=>[[L('Records','记录数'),`<span class="num">${rows.length}</span>`],[L('Financing amount','融资金额合计'),amt(sum(rows,r=>r.amount),'USDT')]],
      cols:[
        [L('Business number','融资业务编号'),r=>r.id?`<strong class="mono">${E(r.id)}</strong>`:pending()],
        [L('Application / project','融资申请编号 / 所属项目'),r=>`<span class="mono">${E(r.demand)}</span>${meta(E(projectName(project(r.project))))}`],
        [L('Borrower / funder','融资企业 / 报价机构'),r=>`${E(ownerOf(r))}${meta(E(funder(r.funder)))}`],
        [L('Financing amount','融资金额')+unit('USDT'),r=>`<span class="num">${num(r.amount)}</span>`,'lg-num'],
        [L('Settlement','结算币种'),r=>E(r.ccy),'lg-c-ccy'],
        [L('Annual rate','年化融资利率'),r=>`<span class="num">${pct(r.rate)}</span>`,'lg-num lg-c-rate'],
        [L('Quote status','报价状态'),r=>`<span class="lg-tags">${tag(QUOTE,r.status)}${r.lending?chainTag('lending'):''}</span>`,'lg-c-status'],
        [L('Quoted at','报价时间')+zone(),r=>r.quotedAt?listTime(r.quotedAt):`—${meta(E(waited(r.signedAt)))}`,'lg-c-date']]
    },
    loans:{
      rows:()=>A.data.loans,
      primary:{key:'status',label:['Business status','业务状态'],options:()=>opts(LOAN),test:(r,v)=>r.status===v},
      more:[
        {key:'overdue',label:['Overdue','是否逾期'],options:yesNo,test:(r,v)=>yn(v,r.overdue)},
        {key:'ccy',label:['Disbursement currency','放款币种'],options:ccyOpts,test:(r,v)=>r.ccy===v},
        {key:'funder',label:['Lending funder','放款机构'],options:funderOpts,test:(r,v)=>r.funder===v},
        {key:'owner',label:['Borrower','融资企业'],options:ownerOpts,test:(r,v)=>project(r.project).owner===v},
        {key:'project',label:['Project','所属项目'],options:projectOpts,test:(r,v)=>r.project===v}],
      range:{label:['Disbursed','放款日期'],field:r=>r.at},
      search:['Loan, business, application or project number','放款编号、融资业务编号、融资申请编号或项目编号'],
      match:(r,q)=>eq(r.id,q)||eq(r.quote,q)||eq(r.demand,q)||eq(r.project,q),
      sorts:[['at',-1,['Disbursed · latest first','放款成功时间 · 从晚到早']],['at',1,['Disbursed · earliest first','放款成功时间 · 从早到晚']],
        ['amount',-1,['Financing amount · high to low','融资金额 · 从高到低']],['amount',1,['Financing amount · low to high','融资金额 · 从低到高']],
        ['outstanding',-1,['Outstanding principal · high to low','未偿本金 · 从高到低']],['outstanding',1,['Outstanding principal · low to high','未偿本金 · 从低到高']]],
      value:(r,k)=>r[k],
      totals:rows=>[[L('Loans','笔数'),`<span class="num">${rows.length}</span>`],[L('Financing amount','融资金额合计'),amt(sum(rows,r=>r.amount),'USDT')],
        [L('Outstanding principal','未偿本金合计'),amt(sum(rows,r=>r.outstanding),'USDT')],
        [L('Disbursed · USDT','放款金额合计 · USDT'),amt(sum(rows.filter(r=>r.ccy==='USDT'),r=>r.disbursed),'USDT')],
        [L('Disbursed · USDC','放款金额合计 · USDC'),amt(sum(rows.filter(r=>r.ccy==='USDC'),r=>r.disbursed),'USDC')]],
      cols:[
        [L('Loan / business number','放款编号 / 融资业务编号'),r=>`<strong class="mono">${E(r.id)}</strong>${meta(`<span class="mono">${E(r.quote)}</span>`)}`],
        [L('Project','所属项目'),r=>projectCells(r)],
        [L('Borrower / funder','融资企业 / 放款机构'),r=>`${E(ownerOf(r))}${meta(E(funder(r.funder)))}`],
        [L('Financing amount','融资金额')+unit('USDT'),r=>`<span class="num">${num(r.amount)}</span>`,'lg-num'],
        [L('Disbursed amount','放款金额'),r=>amt(r.disbursed,r.ccy),'lg-num'],
        [L('Outstanding','未偿本金')+unit('USDT'),r=>`<span class="num">${num(r.outstanding)}</span>`,'lg-num'],
        [L('Business status','业务状态'),r=>`<span class="lg-tags">${tag(LOAN,r.status)}${r.overdue?overdueTag():''}</span>`],
        [L('Disbursed at','放款成功时间')+zone(),r=>listTime(r.at),'lg-c-date']]
    },
    periods:{
      rows:()=>A.data.periods,
      primary:{key:'status',label:['Period status','期次状态'],options:()=>opts(PERIOD),test:(r,v)=>r.status===v},
      more:[
        {key:'overdue',label:['Overdue','是否逾期'],options:yesNo,test:(r,v)=>yn(v,r.overdueDays>0)},
        {key:'ccy',label:['Settlement currency','结算币种'],options:ccyOpts,test:(r,v)=>r.ccy===v},
        {key:'funder',label:['Lending funder','放款机构'],options:funderOpts,test:(r,v)=>loanOf(r.loan).funder===v},
        {key:'owner',label:['Borrower','融资企业'],options:ownerOpts,test:(r,v)=>project(loanOf(r.loan).project).owner===v},
        {key:'project',label:['Project','所属项目'],options:projectOpts,test:(r,v)=>loanOf(r.loan).project===v}],
      range:{label:['Due date','应还日期'],field:r=>r.due},
      search:['Period, business, loan, application or project number','还款期次编号、融资业务编号、放款编号、融资申请编号或项目编号'],
      match:(r,q)=>{const l=loanOf(r.loan);return eq(r.id,q)||eq(l.quote,q)||eq(l.id,q)||eq(l.demand,q)||eq(l.project,q);},
      sorts:[['due',-1,['Due date · latest first','应还日 · 从晚到早']],['due',1,['Due date · earliest first','应还日 · 从早到晚']],
        ['sum',-1,['Amount due · high to low','应还合计 · 从高到低']],['sum',1,['Amount due · low to high','应还合计 · 从低到高']]],
      value:(r,k)=>r[k],
      totals:rows=>[[L('Periods','期数'),`<span class="num">${rows.length}</span>`],[L('Amount due','应还合计的合计'),amt(sum(rows,r=>r.sum),'USDT')],
        [L('Settlement due · USDT','应还结算金额合计 · USDT'),amt(sum(rows.filter(r=>r.ccy==='USDT'),r=>r.settle),'USDT')],
        [L('Settlement due · USDC','应还结算金额合计 · USDC'),amt(sum(rows.filter(r=>r.ccy==='USDC'),r=>r.settle),'USDC')]],
      cols:[
        [L('Period number','还款期次编号'),r=>`<strong class="mono">${E(r.id)}</strong>${meta(L(`Period ${r.seq} of ${r.total}`,`第 ${r.seq}／${r.total} 期`))}`],
        [L('Business / project','融资业务编号 / 所属项目'),r=>{const l=loanOf(r.loan);return `<span class="mono">${E(l.quote)}</span>${meta(`<span class="mono">${E(l.project)}</span>`)}`;}],
        [L('Borrower / funder','融资企业 / 放款机构'),r=>{const l=loanOf(r.loan);return `${E(ownerOf(l))}${meta(E(funder(l.funder)))}`;}],
        [L('Due date','应还日')+utc(),r=>listDate(r.due),'lg-c-date'],
        [L('Amount due','应还合计')+unit('USDT'),r=>`<span class="num">${num(r.sum)}</span>${meta(amt(r.settle,r.ccy))}`,'lg-num'],
        [L('Period status / overdue','期次状态 / 逾期'),r=>`<span class="lg-tags">${tag(PERIOD,r.status)}${r.overdueDays?overdueTag(r.overdueDays):''}${r.unknown?unknownTag():''}</span>`,'lg-c-status'],
        [L('Settled at','期次结清时间')+zone(),r=>listTime(r.settledAt),'lg-c-date']]
    }
  };
  function currentQuote(d){
    const own=A.data.quotes.filter(q=>q.demand===d.id&&d.id);
    return own.find(q=>q.status==='accepted')||own.find(q=>['pending','confirming'].includes(q.status))||null;
  }

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
  const detailRoute=(type,ref)=>DETAIL+'?'+new URLSearchParams({type,id:ref});
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
  function syncContext(){
    if(routeKey===location.hash)return;
    routeKey=location.hash;
    const [route,query]=location.hash.replace(/^#/,'').split('?'),p=new URLSearchParams(query||'');
    if(route===DETAIL){A.type=KIND[p.get('type')]?p.get('type'):null;A.ref=p.get('id');if(A.type)A.tab=TAB_OF[A.type];}
    else if(route===ROOT){
      /* 从菜单进入（地址不带清单参数）是一次新的进入，清空返回链。 */
      if(!p.has('tab'))setTrail([]);
      readList(p);A.type=null;A.ref=null;
    }
  }
  function saveContext(){
    if(S.page!==LIST)return;
    storeViews();
    try{history.replaceState(null,'','#'+listRoute());routeKey=location.hash;}catch(_){}
  }
  /* 返回链：只记录台账内的来源，返回时回到来源清单或来源详情。 */
  const trail=()=>{try{return JSON.parse(sessionStorage.getItem(TRAIL)||'[]')}catch(_){return []}};
  const setTrail=t=>{try{sessionStorage.setItem(TRAIL,JSON.stringify(t.slice(-20)))}catch(_){}};
  function remember(){const el=document.activeElement,box=document.querySelector('.lg-table-region');
    positions.set(location.hash,{y:window.scrollY,box:box?box.scrollTop:0,act:el?.dataset?.act,value:el?.dataset?.v});}
  function go(route,push=true){
    remember();if(push)setTrail([...trail(),location.hash]);
    A.listView='default';A.totalsView='default';A.detailView='default';A.errors={};A.notice=null;
    location.hash='#'+route;
  }
  function back(){
    const t=trail(),prev=t.pop();setTrail(t);
    const target=prev||('#'+listRoute(TAB_OF[A.type]||A.tab));
    if(A.stale&&target.startsWith('#'+ROOT+'?'))A.notice='stale';
    A.stale=false;A.detailView='default';A.errors={};
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
      }else window.scrollTo(0,0);
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
    const c=LISTS[tab],v=view(tab);
    return rows.slice().sort((a,z)=>{const x=c.value(a,v.sort),y=c.value(z,v.sort);
      return (x===y?0:(x<y?-1:1))*v.dir||String(a.id||'~'+a.ref).localeCompare(String(z.id||'~'+z.ref));});
  }
  function conditions(tab){
    const c=LISTS[tab],f=view(tab).filter,out=[];
    [c.primary,...c.more].forEach(def=>{if(f[def.key]){const o=def.options().find(x=>x[0]===f[def.key]);out.push([def.key,txt(def.label)+'：'+(o?o[1]:f[def.key])]);}});
    if(c.range&&(f.from||f.to))out.push(['range',txt(c.range.label)+' (UTC)：'+(f.from||'…')+' ～ '+(f.to||'…')]);
    if(f.q)out.push(['q',L('Keyword','关键词')+'：'+f.q]);
    return out;
  }
  function tabs(){
    return `<div class="card-tabs lg-tabs" role="tablist" aria-label="${L('Ledger lists','台账清单')}">${TABS.map(t=>`<a role="tab" id="lg-tab-${t}" href="#${E(listRoute(t))}" data-act="lg-tab" data-v="${t}" aria-selected="${A.tab===t}" aria-controls="lg-panel" ${A.tab===t?'tabindex="0"':'tabindex="-1"'}>${txt(TAB[t])}</a>`).join('')}</div>`;
  }
  function filters(){
    const tab=A.tab,c=LISTS[tab],v=view(tab),f=v.edit,count=c.more.filter(d=>v.filter[d.key]).length+(c.range&&(v.filter.from||v.filter.to)?1:0);
    const sel=(def)=>`<div class="field"><label for="lg-f-${def.key}">${txt(def.label)}</label><select class="inp" id="lg-f-${def.key}">${def.options().map(([k,l])=>`<option value="${E(k)}" ${k===f[def.key]?'selected':''}>${E(l)}</option>`).join('')}</select></div>`;
    const sortSel=`<span class="fb lg-sort"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4.6 2.8v10.4M2.4 10.8l2.2 2.4 2.2-2.4M11.4 13.2V2.8M9.2 5.2l2.2-2.4 2.2 2.4"/></svg><select class="inp" id="lg-order" aria-label="${L('Sort by','排序')}">${c.sorts.map(([k,d,label])=>`<option value="${k}:${d}" ${k===v.sort&&d===v.dir?'selected':''}>${E(txt(label))}</option>`).join('')}</select></span>`;
    const range=c.range?`<div class="field lg-range${v.error?' lg-invalid':''}"><label for="lg-f-from">${txt(c.range.label)} (UTC)</label><input class="inp" id="lg-f-from" type="date" value="${E(f.from)}" aria-invalid="${!!v.error}" ${v.error?'aria-describedby="lg-range-error"':''}><span aria-hidden="true">～</span><input class="inp" id="lg-f-to" type="date" value="${E(f.to)}" aria-label="${txt(c.range.label)} ${L('end','结束')} (UTC)" aria-invalid="${!!v.error}"></div>${v.error?`<p class="lg-field-error" id="lg-range-error" role="alert">${E(txt(v.error))}</p>`:''}`:'';
    const applied=conditions(tab);
    return `<form id="lg-filter-form" class="lg-filter-wrap" novalidate><div class="filterbar ops-filterbar">
      ${CF.opsFilterSelect('lg-f-'+c.primary.key,txt(c.primary.label),c.primary.options(),f[c.primary.key])}
      ${sortSel}
      <button type="button" class="btn" data-act="lg-filters" aria-expanded="${v.open}" aria-controls="lg-advanced">${L('More filters','更多筛选')}${count?' ('+count+')':''} <span aria-hidden="true">${v.open?'⌃':'⌄'}</span></button>
      ${CF.filterSearch('lg-f-q',L('Search','搜索'),f.q,txt(c.search),'ops-filter-query')}
      <div class="fb-acts">${b('Reset','重置','reset')}<button type="submit" class="btn primary">${L('Search','查询')}</button></div></div>
      <div id="lg-advanced" class="ops-filter-fields" ${v.open?'':'hidden'}>${c.more.map(sel).join('')}${range}</div>
      ${applied.length?`<div class="lg-applied" aria-label="${L('Applied conditions','已生效条件')}">${applied.map(([,label])=>CF.tag('gray',label)).join('')}<button type="button" class="btn sm lg-clear" data-act="lg-clear">${L('Clear all conditions','清除全部条件')}</button></div>`:''}</form>`;
  }
  function totalsBar(tab,rows){
    const c=LISTS[tab];
    let body;
    if(A.listView==='loading')body=`<span class="lg-total-skel skel" aria-hidden="true"></span><span class="sr-only">${L('Loading','加载中')}</span>`;
    else if(A.totalsView==='error')body=`${unavailable()}${b('Retry','重试','totals-retry','','sm')}`;
    else{
      const items=A.listView==='empty'?c.totals([]):c.totals(rows);
      body=items.map(([k,v])=>`<span class="lg-total"><span class="lg-total-k">${k}</span><span class="lg-total-v">${v}</span></span>`).join('');
    }
    const note=c.totalsNote&&A.totalsView!=='error'&&A.listView!=='loading'?`<p class="lg-total-note">${txt(c.totalsNote)}</p>`:'';
    return `<div class="lg-totals" aria-live="polite"><span class="lg-totals-label">${L('Filtered totals','筛选结果合计')}</span><div class="lg-total-items">${body}</div>${note}</div>`;
  }
  function table(tab,rows){
    const c=LISTS[tab];
    return `<div class="tablewrap listbox lg-table-region" tabindex="0" role="region" aria-label="${txt(TAB[tab])}"><table class="tbl lg-table lg-t-${tab}"><thead><tr>${c.cols.map(([h,,cls])=>`<th scope="col" class="${cls||''}">${h}</th>`).join('')}<th scope="col" class="col-act">${L('Action','操作')}</th></tr></thead><tbody>${rows.map(r=>`<tr>${c.cols.map(([,cell,cls])=>`<td class="${cls||''}">${cell(r)}</td>`).join('')}<td class="col-act">${openLink(TYPE[tab],r.ref,L('View','查看'),'actlink')}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function pager(total,v){
    const pages=Math.max(1,Math.ceil(total/CF.PAGE_SIZE));
    return `<div class="pager"><span class="total">${L('Total','共')} ${total} ${L('records','条')} · ${CF.PAGE_SIZE} ${L('per page','条／页')}</span>${b('Previous','上一页','page',String(v.page-1),'sm',v.page<=1)}<span>${v.page} / ${pages}</span>${b('Next','下一页','page',String(v.page+1),'sm',v.page>=pages)}</div>`;
  }
  function list(){
    /* 经关联跳转进入的清单，可返回来源记录。 */
    const from=trail().slice(-1)[0]||'',fromDetail=from.startsWith('#'+DETAIL+'?');
    const head=`<div class="page-head lg-head"><div><h1 class="page-title">${L('Financing ledger','融资台账')}</h1></div><div class="lg-detail-tools">${CF.tag('gray',L('Demonstration data','演示数据'))}${fromDetail?b('Back to the source record','返回来源记录','back','','sm'):''}</div></div>`;
    const blocked=gate();
    if(blocked)return head+`<section class="card">${blocked}</section>`;
    const tab=A.tab,v=view(tab),found=sorted(tab,scope(tab));
    const pages=Math.max(1,Math.ceil(found.length/CF.PAGE_SIZE));
    if(v.page>pages){v.page=pages;A.pageNote=true;saveContext();}
    const pageNote=A.pageNote?L('The previous page no longer has records; showing the last page with records.','原页已无记录，已回到最后一个有内容的页。'):'';
    const rows=found.slice((v.page-1)*CF.PAGE_SIZE,v.page*CF.PAGE_SIZE);
    let bodyHtml;
    if(A.listView==='loading')bodyHtml=CF.skelTable(6);
    else if(A.listView==='error')bodyHtml=CF.empty(L('Could not load this list','清单读取失败'),L('The list is temporarily unavailable. Other information on this page is not affected.','清单暂不可用，不影响本页其他信息。'),b('Retry','重试','list-retry','','primary'));
    else if(A.listView==='empty'||!A.data[tab].length)bodyHtml=CF.empty(txt(EMPTY[tab]),L('Switch to another list to keep reviewing.','可切换其他清单继续查看。'));
    else if(!found.length)bodyHtml=CF.empty(L('No records match the current conditions','没有符合当前条件的记录'),L('The current filters did not match any record.','当前筛选条件未匹配到记录。'),b('Clear filters','清除筛选','clear'));
    else bodyHtml=table(tab,rows)+pager(found.length,v);
    const notes=[A.notice==='stale'?CF.note('accent',`<span>${L('The record you just viewed has been updated and no longer matches the current conditions.','刚才查看的记录已更新，不再满足当前筛选条件。')}</span>${b('Clear filters','清除筛选','clear','','sm')}`):'',
      pageNote?CF.note('accent',`<span>${E(pageNote)}</span>`):''].filter(Boolean).join('');
    const shown=A.listView==='empty'?[]:found;
    return head+`<section class="card lg-card">${tabs()}<div id="lg-panel" role="tabpanel" aria-labelledby="lg-tab-${tab}">${filters()}${notes?`<div class="lg-notes">${notes}</div>`:''}${totalsBar(tab,shown)}${bodyHtml}</div></section>`

  }

  /* ---------------------------------------------------------------- 关联记录 */
  function relation(label,items,opts){
    const {tab,key,value,none}=opts;
    let body;
    if(A.detailView==='partial'&&opts.fail)body=unavailable();
    else if(!items.length)body=`<span class="lg-rel-none">${E(txt(none))}</span>`;
    else if(items.length===1)body=openLink(TYPE[tab],items[0].ref,items[0].id?`<span class="mono">${E(items[0].id)}</span>`:pending());
    else body=`<a class="lg-link" href="#${E(ROOT+'?tab='+tab)}" data-act="lg-rel" data-v="${E(tab+'|'+key+'|'+value)}">${L(`${items.length} records · open list`,`${items.length} 条 · 在清单中查看`)}</a>`;
    return `<li class="lg-rel"><span class="lg-rel-k">${txt(label)}</span><span class="lg-rel-v">${body}</span></li>`;
  }
  function rail(rows,extra=''){
    const failed=A.detailView==='partial';
    return `<aside class="lg-rail"><section class="card lg-section"><header class="lg-section-head"><h2>${L('Related records','关联记录')}</h2>${failed?b('Retry','重试','part-retry','rail','sm'):''}</header><ul class="lg-rels">${rows.join('')}</ul>${extra}</section></aside>`;
  }
  const byProject=(tab,id)=>A.data[tab].filter(r=>(tab==='periods'?loanOf(r.loan).project:r.project)===id);
  function projectRels(p){
    return [relation(['Pledge records','质押记录'],byProject('pledges',p.id),{tab:'pledges',key:'project',value:p.id,none:['No pledge records','暂无质押记录'],fail:true}),
      relation(['Financing demands','融资需求'],byProject('demands',p.id),{tab:'demands',key:'project',value:p.id,none:['No financing demands','暂无融资需求'],fail:true}),
      relation(['Quotes','报价'],byProject('quotes',p.id),{tab:'quotes',key:'project',value:p.id,none:['No quotes','暂无报价记录']}),
      relation(['Loans','放款'],byProject('loans',p.id),{tab:'loans',key:'project',value:p.id,none:['No loans','暂无放款记录']}),
      relation(['Repayment periods','还款期次'],byProject('periods',p.id),{tab:'periods',key:'project',value:p.id,none:['No repayment periods','暂无还款期次']})];
  }
  const projectRel=id=>relation(['Project','所属项目'],[project(id)],{tab:'projects',none:['—','—']});

  /* ---------------------------------------------------------------- 记录详情 */
  function summary(items){return `<dl class="lg-summary">${items.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;}
  function heading(type,r,tags){
    const title=type==='project'?`${E(projectName(r))}<span class="lg-title-id mono">${E(r.id)}</span>`:r.id?`<span class="mono">${E(r.id)}</span>`
      :`${L('Number not generated yet','编号尚未生成')}<span class="lg-title-id">${E(r.project)} · ${type==='pledge'?E(r.apply):''}${type!=='pledge'?amt(r.amount,'USDT'):''}</span>`;
    return `<header class="lg-detail-head"><div class="lg-detail-title"><span class="lg-kind">${txt(KIND[type])}</span><h1>${title}</h1><div class="lg-tags">${tags}</div></div><div class="lg-detail-tools">${CF.tag('gray',L('Demonstration data','演示数据'))}${b('Back','返回','back','','sm')}</div></header>`;
  }
  function projectDetail(p){
    /* 当前一轮：本项目最近一轮未终结的需求；项目已关闭或已结清时没有当前一轮，不用历史轮次补位。 */
    const cur=['closed','settled'].includes(p.status)?null:A.data.demands.filter(d=>d.project===p.id&&d.status!=='ended').sort((a,z)=>z.round-a.round)[0]||null;
    const quotesReceived=A.data.quotes.filter(q=>q.project===p.id&&q.id).length;
    const review=canReview()?CF.AdminMenu.destination('contracts','/ops/contract-reviews/detail?'+new URLSearchParams({id:p.id,src:'queue'})):null;
    const extra=review?`<div class="lg-rail-foot"><a class="lg-link" href="${E(review.href)}" data-admin-destination="contracts" data-admin-route="${E(review.route)}">${L('Project review detail','项目审核详情')} <span aria-hidden="true">›</span></a></div>`:'';
    const failed=A.detailView==='partial';
    return heading('project',p,`${tag(PROJECT,p.status)}${p.expired?expiredTag():''}`)
      +summary([[L('Effective pledge','有效质押额'),p.effective==null?unavailable():amt(p.effective,'USD')],[L('Financing balance','项目融资余额'),amt(p.balance,'USDT')],
        [L('In-transit amount','项目在途金额'),amt(p.inTransit,'USDT')],[L('Pledge coverage','质押情况'),p.coverage?tag(COVER,p.coverage):unavailable()]])
      +`<div class="lg-grid"><div class="detail-stack lg-stack">`
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
      +section(L('Current financing demand','当前融资需求'),cur?facts([
        [L('Application number','融资申请编号'),cur.id?openLink('demand',cur.ref,`<span class="mono">${E(cur.id)}</span>`):pending()],
        [L('Demand amount','需求金额'),amt(cur.amount,'USDT')],
        [L('Application status','申请状态'),`<span class="lg-tags">${cur.status?tag(DEMAND,cur.status):'—'}${cur.chain?chainTag(cur.chain):''}</span>`]])
        :`<p class="lg-empty-line">${L('No current demand','暂无当前需求')}</p>`)
      +(failed?sectionError(L('Configured contracts','所配置的合约'),'contracts'):section(L('Configured contracts','所配置的合约'),facts([
        [L('Pledge contract','质押合约'),netAddr(p.contracts.pledge,L('contract address','合约地址')),true],
        [L('Loan contract','放款合约'),netAddr(p.contracts.loan,L('contract address','合约地址')),true],
        [L('Repayment contract','还款合约'),netAddr(p.contracts.repay,L('contract address','合约地址')),true]]),verifyNote()))
      +`</div>${rail(projectRels(p),extra)}</div>`;
  }
  function pledgeDetail(r){
    const p=project(r.project);
    return heading('pledge',r,`${tag(DEST,r.dest)}${r.unknown?unknownTag():''}`)
      +summary([[L('Share value','份额价值'),amt(r.value,'USD')],[L('Token status','代币状态'),tag(TOKEN_STATE,r.tokenState)],
        [L('Pledged at','质押时间'),r.pledgedAt?time(r.pledgedAt):`—${meta(E(waited(r.startedAt)))}`],[L('Application type','申请类型'),E(txt(APPLY[r.applyType]))]])
      +`<div class="lg-grid"><div class="detail-stack lg-stack">`
      +section(L('Share','份额信息'),facts([
        [L('Pledge record','质押记录编号'),r.id?`<span class="mono">${E(r.id)}</span>`:pending()],[L('Project','所属项目'),`<span class="mono">${E(p.id)}</span> · ${E(projectName(p))}`],
        [L('Project publisher','项目发布方'),E(owner(p.owner))],[L('Token number','代币编号'),`<span class="mono">${E(r.token)}</span>`],
        [L('Quantity and symbol','质押数量与代币符号'),E(r.qty+' '+r.symbol)],[L('Share value','份额价值'),amt(r.value,'USD')],
        [L('Token status','代币状态'),tag(TOKEN_STATE,r.tokenState)],[L('Application type','申请类型'),E(txt(APPLY[r.applyType]))]]))
      +(A.detailView==='partial'?sectionError(L('Destination','去向'),'dest'):section(L('Destination','去向'),facts([
        [L('Current destination','当前去向'),`<span class="lg-tags">${tag(DEST,r.dest)}${r.unknown?unknownTag():''}</span>`],
        r.dest==='excluded'?[L('Not counted because','不计入有效质押的原因'),r.reasons.map(k=>E(txt(REASON[k]))).join('、')]:null,
        [L('Removal reason','移出原因'),r.removal?E(txt(REMOVAL[r.removal])):'—'],
        [L('Business release time','业务释放时间'),time(r.releasedAt)],[L('Transfer-out time','转出时间'),time(r.outAt)]])))
      +section(L('On-chain facts','上链事实'),facts([
        [L('Submission batch','提交批次编号'),`<span class="mono">${E(r.batch)}</span>`],[L('Single application ID','单笔申请标识'),`<span class="mono">${E(r.apply)}</span>`],
        [L('On-chain execution','链上执行状态'),tag(EXEC,r.exec)],
        r.pledgedAt?[L('Pledged at','质押时间'),time(r.pledgedAt)]:[L('Initiated at','发起时间'),`${time(r.startedAt)}${meta(E(waited(r.startedAt)))}`],
        [L('Original holder','原持有地址'),netAddr(r.holder,L('address','地址')),true],
        [L('Token issuing contract','代币发行合约地址'),netAddr(r.tokenContract,L('address','地址')),true],
        [L('On-chain token ID','链上代币 ID'),`<span class="mono">${E(r.chainTokenId)}</span>`],
        [L('Pledge contract','质押合约地址'),netAddr(p.contracts.pledge,L('address','地址')),true],
        [L('Pledge transaction','质押链上凭证'),r.proof?addrFull(r.proof,L('transaction ID','交易标识')):'—',true],
        [L('Transfer-out transaction','转出链上凭证'),r.outProof?addrFull(r.outProof,L('transaction ID','交易标识')):'—',true]]),verifyNote())
      +`</div>${rail([projectRel(r.project)])}</div>`;
  }
  function demandDetail(d){
    const q=currentQuote(d),own=A.data.quotes.filter(x=>x.demand===d.id&&d.id),loan=d.id?A.data.loans.find(l=>l.demand===d.id):null;
    return heading('demand',d,`${d.status?tag(DEMAND,d.status):''}${d.chain?chainTag(d.chain):''}${d.chainUnknown?unknownTag():''}`)
      +summary([[L('Demand amount','需求金额'),amt(d.amount,'USDT')],[L('Published at','本轮发布时间'),d.publishedAt?time(d.publishedAt):`—${meta(E(waited(d.startedAt)))}`],
        [L('Quotes this round','本轮报价笔数'),`<span class="num">${own.length}</span>`],[L('Loan','放款编号'),loan?`<span class="mono">${E(loan.id)}</span>`:'—']])
      +`<div class="lg-grid"><div class="detail-stack lg-stack">`
      +section(L('Demand','需求信息'),facts([
        [L('Application number','融资申请编号'),d.id?`<span class="mono">${E(d.id)}</span>`:pending()],[L('Project','所属项目'),`<span class="mono">${E(d.project)}</span> · ${E(projectName(project(d.project)))}`],
        [L('Project publisher','项目发布方'),E(ownerOf(d))],[L('Demand amount','需求金额'),amt(d.amount,'USDT')],
        [L('Application status','申请状态'),`<span class="lg-tags">${d.status?tag(DEMAND,d.status):'—'}${d.chain?chainTag(d.chain):''}</span>`],
        d.publishedAt?[L('Published at','本轮发布时间'),time(d.publishedAt)]:[L('Initiated at','发起时间'),`${time(d.startedAt)}${meta(E(waited(d.startedAt)))}`],
        d.endReason?[L('End reason','终结原因'),E(txt(d.endReason))]:null,d.endReason?[L('Ended at','终结时间'),time(d.endedAt)]:null]))
      +(A.detailView==='partial'?sectionError(L('Quote and loan','报价与放款'),'quote'):section(L('Quote and loan','报价与放款'),facts([
        [L('Current or accepted quote','当前或已接受报价'),q?`${E(funder(q.funder))}${meta(`${q.id?`<span class="mono">${E(q.id)}</span>`:pending()} · ${pct(q.rate)}`)}`:'—'],
        [L('Quotes this round','本轮报价笔数'),`<span class="num">${own.length}</span>`],
        [L('Loan number','放款编号'),loan?`<span class="mono">${E(loan.id)}</span>`:'—'],[L('Disbursed at','放款成功时间'),loan?time(loan.at):'—']])))
      +section(L('Receiving address','融资收款地址'),facts([[L('Financing receiving address','融资收款地址'),netAddr(d.receive,L('address','地址')),true]]),verifyNote())
      +section(L('On-chain operations this round','本轮链上操作记录'),d.ops.length?`<div class="tablewrap"><table class="tbl lg-subtable"><thead><tr><th scope="col">${L('Operation','操作')}</th><th scope="col">${L('Time','时间')}</th><th scope="col">${L('Address','地址')}</th><th scope="col">${L('Transaction hash','交易哈希')}</th></tr></thead><tbody>${d.ops.map(o=>`<tr><td>${E(txt(OPKIND[o.kind]))}</td><td>${time(o.at)}</td><td>${addrFull(o.addr,L('address','地址'))}</td><td>${addrFull(o.tx,L('transaction hash','交易哈希'))}</td></tr>`).join('')}</tbody></table></div>`
        :`<p class="lg-empty-line">${L('No on-chain operation yet','暂无链上操作记录')}</p>`,verifyNote())
      +`</div>${rail([projectRel(d.project),
        relation(['Quotes this round','本轮报价'],own,{tab:'quotes',key:'q',value:d.id,none:['No quotes this round','本轮暂无报价'],fail:true}),
        relation(['Loan this round','本轮放款'],loan?[loan]:[],{tab:'loans',none:['Not disbursed yet','尚未放款']})])}</div>`;
  }
  function quoteDetail(q){
    const loan=q.id?loanByQuote(q.id):null,demand=demandOf(q.demand);
    const lockEnd=q.lockedUntil||q.rejectAt||q.expireAt||now();
    return heading('quote',q,`${tag(QUOTE,q.status)}${q.lending?chainTag('lending'):''}`)
      +summary([[L('Financing amount','融资金额'),amt(q.amount,'USDT')],[L('Settlement amount','结算金额'),amt(q.settle,q.ccy)],
        [L('Annual rate','年化融资利率'),`<span class="num">${pct(q.rate)}</span>`],[L('Quoted at','报价时间'),q.quotedAt?time(q.quotedAt):`—${meta(E(waited(q.signedAt)))}`]])
      +`<div class="lg-grid"><div class="detail-stack lg-stack">`
      +section(L('Quote terms','报价条款'),facts([
        [L('Business number','融资业务编号'),q.id?`<span class="mono">${E(q.id)}</span>`:pending()],[L('Application number','融资申请编号'),`<span class="mono">${E(q.demand)}</span>`],
        [L('Project','所属项目'),`<span class="mono">${E(q.project)}</span> · ${E(projectName(project(q.project)))}`],[L('Borrower','融资企业'),E(ownerOf(q))],
        [L('Quoting funder','报价机构'),E(funder(q.funder))],[L('Financing amount','融资金额'),amt(q.amount,'USDT')],[L('Settlement currency','结算币种'),E(q.ccy)],
        [L('Exchange rate','汇率'),q.id?`1 USDT = <span class="num">${q.fx.toFixed(4)}</span> ${E(q.ccy)}`:'—'],[L('Settlement amount','结算金额'),q.id?amt(q.settle,q.ccy):'—'],
        [L('Annual rate','年化融资利率'),`<span class="num">${pct(q.rate)}</span>`],[L('Repayment type','还款类型'),E(txt(q.repayType))],[L('Final repayment date','最终还款日'),bizDate(q.finalDate)]]))
      +section(L('Quote status','报价状态'),facts([
        [L('Quote status','报价状态'),`<span class="lg-tags">${tag(QUOTE,q.status)}${q.lending?chainTag('lending'):''}</span>`],
        q.quotedAt?[L('Quoted at','报价时间'),time(q.quotedAt)]:[L('Signature sent at','签名发出时间'),`${time(q.signedAt)}${meta(E(waited(q.signedAt)))}`],
        q.quotedAt?[L('Locked for','已锁定时长'),E(span(q.quotedAt,lockEnd))]:null,
        q.status==='rejected'?[L('Rejected at','拒绝时间'),time(q.rejectAt)]:null,q.status==='rejected'?[L('Rejection reason','拒绝原因'),q.rejectReason?E(txt(q.rejectReason)):'—',true]:null,
        q.status==='expired'?[L('Expired at','失效时间'),time(q.expireAt)]:null,q.status==='expired'?[L('Demand end reason','所属需求终结原因'),E(txt(q.expireReason))]:null,
        [L('Loan number','放款编号'),loan?`<span class="mono">${E(loan.id)}</span>`:'—']]))
      +section(L('Addresses and authorisation','地址与授权'),facts([
        [L('Disbursement address','放款地址'),netAddr(q.loanAddr,L('address','地址')),true],[L('Repayment receiving address','还款收款地址'),netAddr(q.repayAddr,L('address','地址')),true],
        [L('On-chain authorisation','本笔链上授权状态'),A.detailView==='partial'||!q.auth?`${unavailable()}${A.detailView==='partial'?b('Retry','重试','part-retry','auth','sm'):''}`:tag(AUTH,q.auth)]]),verifyNote())
      +`</div>${rail([projectRel(q.project),relation(['Financing demand','所属融资需求'],[demand],{tab:'demands',none:['—','—']}),
        relation(['Loan','本笔放款'],loan?[loan]:[],{tab:'loans',none:['Not accepted yet','尚未接受']})])}</div>`;
  }
  function loanDetail(l){
    const own=periodsOf(l.id),done=own.filter(p=>p.status==='settled'),late=own.filter(p=>p.status!=='settled'&&p.overdueDays>0);
    const earliest=late.sort((a,z)=>a.due-z.due)[0],longest=late.reduce((m,p)=>Math.max(m,p.overdueDays),0);
    const q=quoteOf(l.quote),d=demandOf(l.demand);
    return heading('loan',l,`${tag(LOAN,l.status)}${l.overdue?overdueTag():''}`)
      +summary([[L('Disbursed amount','放款金额'),amt(l.disbursed,l.ccy)],[L('Outstanding principal','未偿本金'),amt(l.outstanding,'USDT')],
        [L('Repayment progress','还款进度'),l.planReady?`<span class="num">${done.length} / ${own.length}</span>`:L('Repayment plan being generated','还款计划生成中')],[L('Disbursed at','放款成功时间'),time(l.at)]])
      +`<div class="lg-grid"><div class="detail-stack lg-stack">`
      +section(L('Loan','放款信息'),facts([
        [L('Loan number','放款编号'),`<span class="mono">${E(l.id)}</span>`],[L('Business number','融资业务编号'),`<span class="mono">${E(l.quote)}</span>`],
        [L('Application number','融资申请编号'),`<span class="mono">${E(l.demand)}</span>`],[L('Project','所属项目'),`<span class="mono">${E(l.project)}</span> · ${E(projectName(project(l.project)))}`],
        [L('Borrower','融资企业'),E(ownerOf(l))],[L('Lending funder','放款机构'),E(funder(l.funder))],[L('Financing amount','融资金额'),amt(l.amount,'USDT')],
        [L('Disbursement currency','放款币种'),E(l.ccy)],[L('Disbursed amount','放款金额'),amt(l.disbursed,l.ccy)],
        [L('Exchange rate','汇率'),`1 USDT = <span class="num">${l.fx.toFixed(4)}</span> ${E(l.ccy)}`],[L('Annual rate','年化融资利率'),`<span class="num">${pct(l.rate)}</span>`],
        [L('Disbursed at','放款成功时间'),time(l.at)],[L('Value date','起息日'),bizDate(l.valueDate)],[L('Final repayment date','最终还款日'),bizDate(l.finalDate)]]))
      +(A.detailView==='partial'?sectionError(L('Repayment progress','还款进展'),'progress'):section(L('Repayment progress','还款进展'),facts([
        [L('Business status','业务状态'),`<span class="lg-tags">${tag(LOAN,l.status)}${l.overdue?overdueTag():''}</span>`],
        [L('Earliest overdue period','最早逾期期次'),earliest?`<span class="mono">${E(earliest.id)}</span>`:'—'],[L('Longest overdue','最长逾期天数'),longest?L(longest+' d',longest+' 天'):'—'],
        [L('Outstanding principal','未偿本金'),amt(l.outstanding,'USDT')],[L('Principal and interest repaid','累计已还本金与利息'),amt(l.repaid,'USDT')],
        [L('Repayment progress','还款进度'),l.planReady?L(`${done.length} of ${own.length} periods settled`,`已结清 ${done.length}／${own.length} 期`):L('Repayment plan being generated','还款计划生成中')],
        [L('Settled at','业务结清时间'),time(l.settledAt)]])))
      +section(L('Addresses and transaction','地址与交易'),facts([
        [L('Disbursement address','放款地址'),netAddr(l.addrs.loan,L('address','地址')),true],[L('Asset holder receiving address','资产方收款地址'),netAddr(l.addrs.receive,L('address','地址')),true],
        [L('Repayment receiving address','还款收款地址'),netAddr(l.addrs.repay,L('address','地址')),true],[L('Transaction ID','交易标识'),addrFull(l.tx,L('transaction ID','交易标识')),true]]),verifyNote())
      +`</div>${rail([projectRel(l.project),relation(['Financing demand','所属融资需求'],[d],{tab:'demands',none:['—','—']}),
        relation(['Quote','对应报价'],[q],{tab:'quotes',none:['—','—']}),
        relation(['Repayment periods','本笔还款期次'],own,{tab:'periods',key:'q',value:l.id,none:l.planReady?['No repayment periods','暂无还款期次']:['Plan being generated · no periods yet','还款计划生成中，暂无期次'],fail:true})])}</div>`;
  }
  function periodDetail(p){
    const l=loanOf(p.loan);
    return heading('period',p,`${tag(PERIOD,p.status)}${p.overdueDays?overdueTag(p.overdueDays):''}${p.unknown?unknownTag():''}`)
      +summary([[L('Amount due','应还合计'),amt(p.sum,'USDT')],[L('Settlement due','应还结算金额'),amt(p.settle,p.ccy)],
        [L('Due date','应还日'),bizDate(p.due)],[L('Period','期次'),L(`${p.seq} of ${p.total}`,`第 ${p.seq}／${p.total} 期`)]])
      +`<div class="lg-grid"><div class="detail-stack lg-stack">`
      +section(L('Period and interest','期次与计息'),facts([
        [L('Period number','还款期次编号'),`<span class="mono">${E(p.id)}</span>`],[L('Period','期次序号与总期数'),L(`${p.seq} of ${p.total}`,`第 ${p.seq}／${p.total} 期`)],
        [L('Business number','融资业务编号'),`<span class="mono">${E(l.quote)}</span>`],[L('Loan number','放款编号'),`<span class="mono">${E(l.id)}</span>`],
        [L('Application number','融资申请编号'),`<span class="mono">${E(l.demand)}</span>`],[L('Project','所属项目'),`<span class="mono">${E(l.project)}</span> · ${E(projectName(project(l.project)))}`],
        [L('Borrower','融资企业'),E(ownerOf(l))],[L('Lending funder','放款机构'),E(funder(l.funder))],
        [L('Due date','应还日'),bizDate(p.due)],[L('Repayment opens','还款入口开启时间'),`${E(CF.fmtDate(iso(p.due)+'T12:00:00Z'))} 00:00 <span class="lg-zone">UTC</span>`],
        [L('Interest period','计息区间'),`${bizDate(p.from)} ～ ${bizDate(p.to)} · ${L(p.days+' days',p.days+' 天')}`],
        [L('Principal due','应还本金'),amt(p.principal,'USDT')],[L('Interest due','应还利息'),amt(p.interest,'USDT')],
        [L('Amount due','应还合计'),amt(p.sum,'USDT')],[L('Settlement due','应还结算金额'),amt(p.settle,p.ccy)]]))
      +section(L('Status','状态'),facts([
        [L('Period status','期次状态'),`<span class="lg-tags">${tag(PERIOD,p.status)}${p.unknown?unknownTag():''}</span>`],
        [L('Overdue','逾期标记与天数'),p.overdueDays?overdueTag(p.overdueDays):'—'],[L('Repayment nature','还款性质'),p.nature?E(txt(NATURE[p.nature])):'—'],
        [L('Settled at','期次结清时间'),time(p.settledAt)],
        p.status==='confirming'?[L('Submitted at','提交时间'),`${time(p.submitAt)}${meta(E(waited(p.submitAt)))}`]:null,
        p.status==='confirming'?[L('Transaction ID','交易标识'),addrFull(p.submitTx,L('transaction ID','交易标识')),true]:null]))
      +(p.record?(A.detailView==='partial'?sectionError(L('Repayment record','还款记录'),'record'):section(L('Repayment record','还款记录'),facts([
        [L('Repayment record','还款记录编号'),`<span class="mono">${E(p.record.id)}</span>`],[L('Currency and amount','还款币种与金额'),amt(p.record.amount,p.record.ccy)],
        [L('Submitted at','提交时间'),time(p.record.at)],[L('Paying address','出账地址'),netAddr(p.record.from,L('address','地址')),true],
        [L('Receiving address','收款地址'),netAddr(p.record.to,L('address','地址')),true],
        [L('Repayment transaction','还款交易标识'),addrFull(p.record.tx,L('transaction ID','交易标识')),true],[L('Authorisation transaction','授权交易标识'),addrFull(p.record.authTx,L('transaction ID','交易标识')),true]]),verifyNote())):'')
      +`</div>${rail([projectRel(l.project),relation(['Loan','所属放款'],[l],{tab:'loans',none:['—','—']})])}</div>`;
  }
  function detail(){
    const blocked=gate();
    if(blocked)return `<section class="card">${blocked}</section>`;
    const r=A.type&&A.detailView!=='missing'?find(A.type,A.ref):null;
    if(!r)return `<section class="card">${CF.empty(L('Content does not exist or you do not have access','内容不存在或无权访问'),L('Return to the financing ledger to continue.','请返回融资台账继续查看。'),b('Back to the financing ledger','返回融资台账','back','','primary'))}</section>`;
    if(A.detailView==='loading')return `<section class="card">${CF.skelTable(6)}</section>`;
    return {project:projectDetail,pledge:pledgeDetail,demand:demandDetail,quote:quoteDetail,loan:loanDetail,period:periodDetail}[A.type](r);
  }

  /* ---------------------------------------------------------------- 演示工具 */
  function grant(mode){
    if(!CF.opsAuth)return;
    CF.opsAuth.seedDemo('admin');
    if(mode==='noLedger')OPS.onAct('ops-grant',String(PERM));
    if(mode==='noReview')OPS.onAct('ops-grant',String(REVIEW_PERM));
    A.listView='default';A.totalsView='default';A.detailView='default';
  }
  function accountMode(){return !canLedger()?'noLedger':!canReview()?'noReview':'admin';}
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
        ${S.page===DT?field(L('Detail','详情'),sel('lg-demo-detail',A.detailView,[['default',L('Default','默认')],['loading',L('Loading','读取中')],['partial',L('Partly unavailable','部分读取失败')],['missing',L('Not found or no access','不存在或无权')]])):''}</div>
      <h4>${L('Edge cases','边界情况')}</h4><div class="lg-demo-actions">
        ${S.page===LIST?b('Fewer records · page out of range','记录减少 · 页码超出','overflow'):''}
        ${S.page===DT?b('Source record updated','来源记录已更新','stale','','',!!A.stale):''}
        ${b('Expire operations session','运营登录失效','expire-session')}${b('Reset demonstration','重置演示','restart')}</div>
      ${A.stale?`<p class="lg-meta">${L('On return, the list will report that this record no longer matches its conditions.','返回清单时将提示该记录已不再满足筛选条件。')}</p>`:''}`;
  }

  /* ---------------------------------------------------------------- 动作 */
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
    if(e&&(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)&&['lg-open','lg-tab','lg-rel'].includes(act))return false;
    if(!act.startsWith('lg-')){
      if(act==='retry'){A.listView='default';A.totalsView='default';A.detailView='default';CF.render();return true;}
      if(act==='clearfilter'){clearAll();return true;}
      return false;
    }
    act=act.slice(3);
    if(!['copy','grant','overflow','stale'].includes(act))A.pageNote=false;
    if(act==='tab'){
      if(!TABS.includes(value)||value===A.tab)return true;
      A.notice=null;A.listView='default';A.totalsView='default';A.tab=value;location.hash='#'+listRoute(value);
      requestAnimationFrame(()=>$('lg-tab-'+value)?.focus({preventScroll:true}));
    }
    else if(act==='open'){const [type,ref]=value.split('|');go(detailRoute(type,ref));}
    else if(act==='rel'){
      /* 多条关联：打开对应清单并以关联条件替换原有条件。 */
      const [tab,key,val]=value.split('|'),fresh=blank(tab);fresh.filter[key]=val;fresh.edit={...fresh.filter};A.views[tab]=fresh;storeViews();
      go(ROOT+'?'+params(tab));
    }
    else if(act==='back')back();
    else if(act==='page'){view(A.tab).page=Math.max(1,+value);saveContext();CF.render();const box=document.querySelector('.lg-table-region');if(box)box.scrollTop=0;}
    else if(act==='filters'){const v=view(A.tab);v.open=!v.open;CF.render();document.querySelector('[data-act=lg-filters]')?.focus();}
    else if(act==='reset'){const v=view(A.tab),fresh=blank(A.tab);v.edit={...fresh.filter};v.error='';v.open=false;v.filter=fresh.filter;v.page=1;v.sort=fresh.sort;v.dir=fresh.dir;A.notice=null;saveContext();CF.render();}
    else if(act==='clear')clearAll();
    else if(act==='list-retry'){A.listView='default';CF.render();}
    else if(act==='totals-retry'){A.totalsView='default';CF.render();}
    else if(act==='part-retry'){A.detailView='default';CF.render();}
    else if(act==='copy')navigator.clipboard?.writeText(value).then(()=>CF.toast(L('Copied','已复制'))).catch(()=>CF.toast(L('Copy the visible value manually.','请手动复制显示值。')));
    else if(act==='sign-in'){location.hash='#/ops/login';}
    else if(act==='grant'){grant(value);CF.render();}
    else if(act==='overflow'){view(A.tab).page=99;CF.render();}
    else if(act==='stale'){A.stale=true;CF.render();CF.toast(L('The source record has changed. Return to the list to see the notice.','来源记录已变化，返回清单可看到提示。'));}
    else if(act==='expire-session'){S.demo=false;OPS.onAct('ops-session-expire');CF.render();}
    else if(act==='restart'){
      try{sessionStorage.removeItem(TRAIL);sessionStorage.removeItem(VIEWS);}catch(_){}
      seed=CF.ledgerSeed();A.data=seed;index();A.views={};A.tab='projects';A.listView='default';A.totalsView='default';A.detailView='default';A.notice=null;A.stale=false;
      grant('admin');location.hash='#'+listRoute('projects');CF.render();
    }
    else return false;
    return true;
  }
  function onInput(e){
    const el=e.target,id=el.id||'';
    if(id.startsWith('lg-f-')&&S.page===LIST){view(A.tab).edit[id.slice(5)]=el.value;}
  }
  document.addEventListener('submit',e=>{if(e.target.id==='lg-filter-form'){e.preventDefault();applyFilter();}});
  document.addEventListener('input',onInput);
  document.addEventListener('change',e=>{
    onInput(e);const id=e.target.id;
    if(id==='lg-order'){const [k,d]=e.target.value.split(':'),v=view(A.tab);v.sort=k;v.dir=+d;v.page=1;saveContext();CF.render();$('lg-order')?.focus();}
    if(id==='lg-demo-list'){A.listView=e.target.value;CF.render();}
    if(id==='lg-demo-totals'){A.totalsView=e.target.value;CF.render();}
    if(id==='lg-demo-detail'){A.detailView=e.target.value;CF.render();}
  });
  /* 标签页键盘：左右键在六个清单间移动焦点，回车或空格切换。 */
  document.addEventListener('keydown',e=>{
    const t=e.target.closest?.('.lg-tabs [role="tab"]');if(!t)return;
    const i=TABS.indexOf(t.dataset.v);let n=null;
    if(e.key==='ArrowRight')n=(i+1)%TABS.length;else if(e.key==='ArrowLeft')n=(i+TABS.length-1)%TABS.length;
    else if(e.key==='Home')n=0;else if(e.key==='End')n=TABS.length-1;
    else if(e.key===' '){e.preventDefault();t.click();return;}
    if(n==null)return;e.preventDefault();$('lg-tab-'+TABS[n])?.focus();
  });
  window.addEventListener('hashchange',()=>{const t=trail();if(t.length&&t[t.length-1]===location.hash){t.pop();setTrail(t);}});

  /* ---------------------------------------------------------------- 评审目录 */
  const DENIED={id:'denied',label:['No access','无权限'],group:'business'};
  const sample=(type,test)=>{const r=A.data[TAB_OF[type]].find(test);return r?{route:detailRoute(type,r.ref),id:r.id||r.ref}:null;};
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
      ['pledge-unknown',['Pledge · result to be verified','质押 · 链上结果待核实'],sample('pledge',r=>r.unknown)],
      ['demand-pending',['Demand · number not generated','需求 · 编号尚未生成'],sample('demand',r=>!r.id)],
      ['quote-lending',['Quote · disbursement in progress','报价 · 链上放款处理中'],sample('quote',r=>r.lending)],
      ['loan-plan',['Loan · plan being generated','放款 · 还款计划生成中'],sample('loan',r=>!r.planReady)],
      ['period-confirming',['Period · confirming on-chain','期次 · 还款上链确认中'],sample('period',r=>r.status==='confirming')]
    ].map(([id,label,s])=>({id,label,available:canLedger()&&!!s,route:s?s.route:null,description:s?['Demo record · '+s.id,'演示记录 · '+s.id]:['No matching record','暂无对应记录']})),
    route:()=>detailRoute('quote',A.data.quotes[2].ref),
    get:()=>!canLedger()?'denied':A.detailView,
    set(value){if(value==='denied'){grant('noLedger');return;}if(!canLedger())grant('admin');A.detailView=value;},
    reset(){if(!canLedger())grant('admin');A.detailView='default';},
    beforeChange(proceed){proceed();}});

  /* ---------------------------------------------------------------- 接入 */
  const dict={
    en:{...OPS.dict.en,navLedger:'Financing ledger',navLedgerDetail:'Record detail',
      ...Object.fromEntries(Object.entries(KIND).map(([k,v])=>['navLedger_'+k,v[0]+' detail']))},
    zh:{...OPS.dict.zh,navLedger:'融资台账',navLedgerDetail:'记录详情',
      ...Object.fromEntries(Object.entries(KIND).map(([k,v])=>['navLedger_'+k,v[1]+'详情']))}
  };
  CF.define({...OPS,id:'financing-ledger',demoOnly:true,reviewToolsInLayer:false,dict,demo,
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
