/* WS-439 · 代币准入审核（运营端）：准入审核清单（P-O-TA-01）与审核详情（P-O-TA-02）。
   权限项由本模块定义（PM-TA-01 查询 / PM-TA-02 处置，处置须配套查询），登记在运营端账户宿主 CF.opsAuth
   的同一份清单里，编号 21 / 22 只作原型内部键。推送、回传、文件读取与区块浏览器均为本地演示。 */
(function(CF){
  'use strict';
  const S=CF.S,L=CF.L,E=CF.esc,OPS=CF.opsAccountModule,$=id=>document.getElementById(id);
  const LIST='P-O-TA-01',DT='P-O-TA-02';
  const ROOT='/ops/token-admissions',DETAIL=ROOT+'/detail';
  const OPS_PAGES=['P-O-AL-01','P-O-AL-03','P-O-AL-04','P-O-AL-05','P-O-AL-06','P-O-AL-07'];
  const P_QUERY=21,P_DECIDE=22;

  const STATUS={pending:['Pending review','待审核','warn'],approved:['Approved','已通过','ok'],returned:['Returned','已退回','danger']};
  const TOKEN={valid:['Valid','有效','ok'],expired:['Invalid','失效','gray']};
  const DUP={chain:['Same on-chain token','链上代币重复'],number:['Same token number','代币编号重复']};

  const fDefault=()=>({status:'pending',token:'',platform:'',issuer:'',standard:'',dup:'',changed:'',from:'',to:'',q:''});
  let seed=CF.tokenAdmissionSeed();
  const A={rows:CF.opsOverviewData.restore('tokens',seed.rows),now:seed.now,clock:Date.now(),
    list:{filter:fDefault(),edit:fDefault(),page:1,sort:'submittedAt',dir:1,open:false},
    view:'default',response:'success',callback:'ok',fileState:'ready',activityState:'default',
    drafts:{},draft:null,busy:false,error:'',listNote:'',selected:null,dlError:false,epoch:0};
  let routeKey=null,restoreContext=false,returnHash='',lastHash='',onModule=false,wasSigned=false;
  const positions=new Map();

  const now=()=>A.now+(Date.now()-A.clock);
  const txt=x=>x==null?'':Array.isArray(x)?L(x[0],x[1]):String(x);
  const time=t=>t?CF.fmtTime(t):'—';
  const blank='—';
  const val=x=>x==null||x===''||(Array.isArray(x)&&!x.length)?blank:E(txt(x));
  /* 数量与金额按上游原值：只加千分位，不截断、不四舍五入。 */
  const raw=s=>{if(s==null||s==='')return blank;const [i,d]=String(s).split('.');return E(i.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(d!=null?'.'+d:''));};
  const qty=s=>s==null?blank:raw(s)+' '+L('tokens','枚');
  const usd=s=>s==null?blank:raw(s)+' USD';
  const submission=n=>L('Submission '+n,'第 '+n+' 次提交');
  const platformName=r=>txt(seed.platforms[r.platform]);
  const networkValue=r=>`<span class="ta-network"><span class="ta-network-icon" aria-hidden="true">${String(r.chainId)==='1'?CF.assetIconSvg('ETH'):CF.ICON.globe}</span><span>${val(txt(r.chain))}</span></span>`;
  const row=id=>A.rows.find(r=>r.id===(id||A.selected));
  const decision=r=>r.decisions[r.decisions.length-1]||null;
  const statusTag=r=>CF.tag(STATUS[r.status][2],txt(STATUS[r.status]));
  const tokenTag=r=>CF.tag(TOKEN[r.tokenState][2],txt(TOKEN[r.tokenState]));
  const dupTags=r=>[...new Set(r.dupes.map(d=>d.kind))].map(k=>CF.tag('warn',txt(DUP[k]))).join('');
  const changedTag=r=>r.changed?CF.tag('accent',L('Changed after approval','通过后资料有变更')):'';

  const b=(en,zh,act,value='',cls='',disabled=false,title='')=>`<button type="button" class="btn ${cls}" data-act="ta-${act}" data-v="${E(value)}" ${title?`title="${E(title)}"`:''} ${disabled?'disabled':''}>${L(en,zh)}</button>`;
  const field=(label,html)=>`<div class="field"><label for="${(html.match(/id="([^"]+)/)||[])[1]||''}">${CF.fieldLabel(label)}</label>${html}</div>`;
  const input=(id,v,type='text')=>`<input class="inp" id="${id}" type="${type}" value="${E(v)}">`;
  const select=(id,value,options)=>`<select class="inp" id="${id}">${options.map(([v,label])=>`<option value="${E(v)}" ${v===value?'selected':''}>${E(label)}</option>`).join('')}</select>`;
  const error=()=>A.error?`<p class="ta-error" role="alert">${E(txt(A.error))}</p>`:'';
  const facts=(items,single)=>`<div class="ops-facts-region"><dl class="ta-kv ops-facts${single?' ops-facts-single':''}">${items.map(([label,value,wide])=>`<div${wide?' class="ops-fact-wide"':''}><dt>${label}</dt><dd>${value==null||value===''?blank:value}</dd></div>`).join('')}</dl></div>`;
  const kv=items=>`<dl class="ta-kv">${items.map(([label,value,wide])=>`<div${wide?' class="ta-wide"':''}><dt>${label}</dt><dd>${value==null||value===''?blank:value}</dd></div>`).join('')}</dl>`;
  const group=(en,zh,html)=>`<div class="ta-group"><h3 class="ta-h3">${L(en,zh)}</h3>${html}</div>`;
  const section=(id,en,zh,html,meta='')=>`<section class="card ta-section" id="ta-sec-${id}" tabindex="-1" aria-labelledby="ta-sec-${id}-h"><div class="ta-section-head"><h2 class="ta-h2" id="ta-sec-${id}-h">${L(en,zh)}</h2>${meta}</div>${html}</section>`;

  /* ---------------------------------------------------------------- 权限 */
  const signedIn=()=>!!CF.opsAuth&&CF.opsAuth.can(14);
  const canQuery=()=>!!CF.opsAuth&&CF.opsAuth.can(P_QUERY);
  const canDecide=()=>canQuery()&&CF.opsAuth.can(P_DECIDE);
  const decideOnly=()=>!!CF.opsAuth&&!CF.opsAuth.held(P_QUERY)&&CF.opsAuth.held(P_DECIDE);
  const allowed=()=>S.end==='admin'&&signedIn()&&canQuery();

  /* 同一笔链上代币只能通过一条：链上代币重复的对方已通过时，本条只能退回。 */
  const approvedPeer=r=>r.dupes.filter(d=>d.kind==='chain').map(d=>row(d.other)).find(o=>o&&o.status==='approved');
  const canAct=r=>!!r&&allowed()&&canDecide()&&r.status==='pending';
  const canApprove=r=>canAct(r)&&r.tokenState==='valid'&&!approvedPeer(r);

  /* 已等待时长：详情展示的事实值，不是期限；结论生效即停止计时。 */
  const endedAt=r=>r.status==='pending'?null:decision(r)?.at;
  const waited=r=>(endedAt(r)||now())-r.submittedAt;
  function duration(ms){
    const m=Math.max(0,Math.floor(ms/60000));
    return m<60?`${m} ${L('min','分钟')}`:m<1440?`${Math.floor(m/60)} ${L('h','小时')}`
      :`${Math.floor(m/1440)} ${L('d','天')} ${Math.floor(m%1440/60)} ${L('h','小时')}`;
  }
  function event(r,kind,title,result,extra){
    r.events.unshift(Object.assign({id:'ta-ev-'+Math.random().toString(36).slice(2),at:now(),kind,title,result,actor:['System','系统']},extra||{}));
  }
  const platformActor=r=>['Issuance platform · '+seed.platforms[r.platform][0],'来源发行平台 · '+seed.platforms[r.platform][1]];

  /* ---------------------------------------------------------------- 路由 */
  function listParams(){
    const st=A.list;
    return new URLSearchParams({...st.filter,page:String(st.page),sort:st.sort,dir:String(st.dir)});
  }
  const listRoute=()=>ROOT+'?'+listParams();
  function detailRoute(id){const p=listParams();p.set('id',id);return DETAIL+'?'+p;}
  function remember(){const el=document.activeElement;positions.set(location.hash,{y:window.scrollY,act:el?.dataset.act,value:el?.dataset.v});}
  function readFilter(p){
    const f=fDefault();
    for(const k of Object.keys(f))if(p.has(k))f[k]=p.get(k);
    for(const k of ['from','to'])if(!/^\d{4}-\d{2}-\d{2}$/.test(f[k]))f[k]='';
    if(f.status&&!STATUS[f.status])f.status='pending';
    if(f.token&&!TOKEN[f.token])f.token='';
    if(f.platform&&!seed.platforms[f.platform])f.platform='';
    if(f.dup&&!['chain','number','none'].includes(f.dup))f.dup='';
    if(f.changed&&!['yes','no'].includes(f.changed))f.changed='';
    return f;
  }
  function syncContext(){
    if(routeKey===location.hash)return;
    routeKey=location.hash;
    const p=new URLSearchParams(location.hash.split('?')[1]||'');
    const route=location.hash.replace(/^#/,'').split('?')[0];
    A.list.filter=readFilter(p);A.list.edit={...A.list.filter};
    A.list.page=Math.max(1,parseInt(p.get('page'),10)||1);
    A.list.sort=['submittedAt','waiting','value','due'].includes(p.get('sort'))?p.get('sort'):'submittedAt';
    A.list.dir=p.get('dir')==='-1'?-1:1;
    A.selected=route===DETAIL?p.get('id'):null;
  }
  function saveContext(){
    const next=S.page===DT?detailRoute(A.selected):listRoute();
    try{history.replaceState(null,'','#'+next);routeKey=location.hash;}catch(error){}
  }
  function navigateRoute(route){
    remember();A.epoch++;A.busy=false;A.draft=null;A.error='';S.layer=null;A.view='default';
    location.hash='#'+route;
  }
  const unsaved=()=>Object.values(A.drafts).some(d=>(d.reason||'').trim());
  function leave(target){
    const d=A.drafts[A.selected];
    if(S.page===DT&&d&&(d.reason||'').trim()){A.next=target;open('discard');return;}
    navigateRoute(target);
  }
  function restoreView(){
    if(!restoreContext)return;restoreContext=false;
    requestAnimationFrame(()=>{
      if(S.layer)return;
      const saved=positions.get(location.hash);
      if(saved){
        window.scrollTo(0,saved.y);
        const target=[...document.querySelectorAll('[data-act]')].find(el=>el.dataset.act===saved.act&&el.dataset.v===saved.value);
        if(target)target.focus({preventScroll:true});else $('ta-f-q')?.focus({preventScroll:true});
      }else window.scrollTo(0,0);
    });
  }
  function open(key){CF.openLayer('modal','ta-'+key);queueMicrotask(()=>{if(key==='return')$('ta-reason')?.focus();});}
  function deny(){
    A.error=['This action is unavailable with the current account, permissions or token status.','当前账号、权限或代币状态不允许此操作。'];
    A.busy=false;A.draft=null;S.layer=null;CF.render();CF.toast(txt(A.error));
  }

  /* ---------------------------------------------------------------- 权限空态 */
  function signedOut(){return CF.empty(L('Sign in to continue','请先完成运营登录'),
    L('Your session has ended. Sign in again to open token admission.','登录已失效，请重新登录后查看代币准入审核。'),
    b('Sign in again','重新登录','sign-in','','primary'));}
  function noAccess(){return decideOnly()
    ?CF.empty(L('Review access is incomplete','审核权限配置不完整'),
      L('This account can decide token admission but cannot query it, so access is refused. Ask your platform provider to correct the delivered configuration.','该账号开通了代币准入审核处置，但未开通代币准入审核查询，本次访问已拒绝。请联系平台建设方修正交付配置。'),'')
    :CF.empty(L('No access to token admission','无权访问代币准入审核'),
      L('The delivered configuration does not give this account the token admission permissions.','当前交付配置未为该账号开通代币准入审核相关权限。'),'');}
  function gate(){return !signedIn()?signedOut():!canQuery()?noAccess():'';}
  const demoTag=()=>CF.tag('gray',L('Demonstration data','演示数据'));

  /* ---------------------------------------------------------------- 清单 */
  function inDay(t,day,end){const d=new Date(day+'T00:00:00Z').getTime();return end?t<d+86400000:t>=d;}
  function utcDayStart(t,back=0){const d=new Date(t);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-back);}
  const issuers=()=>{const m=new Map();A.rows.forEach(r=>m.set(r.issuer.entity,r.issuer));return [...m.values()];};
  const standards=()=>[...new Set(A.rows.map(r=>r.standard))];
  function keyword(r,q){
    q=q.trim().toLowerCase();if(!q)return true;
    return [r.ptid,r.tokenNo,txt(r.name),txt(r.issuer.name),r.contract.address,r.asset.no].join(' ').toLowerCase().includes(q);
  }
  /* 统计只跟随来源发行平台、发行方、代币标准、提交时间与关键词。 */
  function scope(){
    const f=A.list.filter;
    return A.rows.filter(r=>(!f.platform||r.platform===f.platform)&&(!f.issuer||r.issuer.entity===f.issuer)
      &&(!f.standard||r.standard===f.standard)&&(!f.from||inDay(r.submittedAt,f.from))&&(!f.to||inDay(r.submittedAt,f.to,true))&&keyword(r,f.q));
  }
  function found(){
    const f=A.list.filter;
    return scope().filter(r=>(!f.status||r.status===f.status)&&(!f.token||r.tokenState===f.token)
      &&(!f.dup||(f.dup==='none'?!r.dupes.length:r.dupes.some(d=>d.kind===f.dup)))
      &&(!f.changed||(f.changed==='yes')===!!r.changed));
  }
  function sortRows(list){
    const st=A.list,value=r=>st.sort==='waiting'?waited(r):st.sort==='value'?Number(r.value):st.sort==='due'?Date.parse(r.asset.due||'9999-12-31'):r.submittedAt;
    return list.sort((a,c)=>(value(a)-value(c))*st.dir||a.id.localeCompare(c.id));
  }
  const SORTS=[['submittedAt',1,'Submitted · oldest first','本次提交时间 · 最早优先'],['submittedAt',-1,'Submitted · newest first','本次提交时间 · 最新优先'],
    ['waiting',-1,'Waiting · longest first','已等待时长 · 最长优先'],['waiting',1,'Waiting · shortest first','已等待时长 · 最短优先'],
    ['value',-1,'Token value · highest first','代币价值 · 从高到低'],['value',1,'Token value · lowest first','代币价值 · 从低到高'],
    ['due',1,'Due date · earliest first','到期日 · 最早优先'],['due',-1,'Due date · latest first','到期日 · 最晚优先']];
  function sortControl(){
    return `<span class="fb"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4.6 2.8v10.4M2.4 10.8l2.2 2.4 2.2-2.4M11.4 13.2V2.8M9.2 5.2l2.2-2.4 2.2 2.4"/></svg><select class="inp" id="ta-order" aria-label="${L('Sort by','排序')}">${SORTS.map(([k,d,en,zh])=>`<option value="${k}:${d}" ${k===A.list.sort&&d===A.list.dir?'selected':''}>${E(L(en,zh))}</option>`).join('')}</select></span>`;
  }
  function sortButton(k,en,zh){
    const st=A.list;
    return `<button data-act="ta-sort" data-v="${k}">${L(en,zh)} ${st.sort===k?(st.dir===1?'↑':'↓'):'↕'}</button>`;
  }
  const ariaSort=k=>A.list.sort===k?(A.list.dir===1?'ascending':'descending'):'none';
  function filters(){
    const f=A.list.edit,applied=A.list.filter,all=['',L('All','全部')];
    const extra=['token','platform','issuer','standard','dup','changed','from','to'],count=extra.filter(k=>applied[k]).length;
    const labels={token:L('Token status','代币状态'),platform:L('Issuance platform','来源发行平台'),issuer:L('Issuer','发行方'),standard:L('Token standard','代币标准'),
      dup:L('Duplicate alert','重复提醒'),changed:L('Changed after approval','通过后资料有变更'),from:L('Submitted from','提交开始日期'),to:L('Submitted through','提交结束日期')};
    const dupOpts=[all,['chain',txt(DUP.chain)],['number',txt(DUP.number)],['none',L('None','无')]];
    const chOpts=[all,['yes',L('Yes','有')],['no',L('No','无')]];
    const values={token:applied.token?txt(TOKEN[applied.token]):'',platform:applied.platform?txt(seed.platforms[applied.platform]):'',
      issuer:applied.issuer?txt(issuers().find(i=>i.entity===applied.issuer)?.name):'',standard:applied.standard,
      dup:applied.dup?dupOpts.find(o=>o[0]===applied.dup)[1]:'',changed:applied.changed?chOpts.find(o=>o[0]===applied.changed)[1]:''};
    const on=extra.filter(k=>applied[k]);
    return `<form id="ta-filter-form" class="ta-filter-wrap" novalidate><div class="filterbar ops-filterbar ta-toolbar">
      ${CF.opsFilterSelect('ta-f-status',L('Admission status','准入状态'),[all,...Object.entries(STATUS).map(([k,v])=>[k,txt(v)])],f.status)}
      ${sortControl()}
      <button type="button" class="btn" data-act="ta-filters" aria-expanded="${A.list.open}" aria-controls="ta-advanced">${L('More filters','更多筛选')}${count?' ('+count+')':''} <span aria-hidden="true">${A.list.open?'⌃':'⌄'}</span></button>
      ${CF.filterSearch('ta-f-q',L('Search tokens','搜索代币'),f.q,L('Platform token ID, token number, token name, issuer, contract address or receivable number','平台代币标识、代币编号、代币名称、发行方、代币发行合约地址或应收账款编号'),'ops-filter-query')}
      <div class="fb-acts">${b('Reset','重置','reset')}<button type="submit" class="btn primary">${L('Search','查询')}</button></div></div>
      <div id="ta-advanced" class="ta-filters ops-filter-fields" ${A.list.open?'':'hidden'}>
        ${field(labels.token,select('ta-f-token',f.token,[all,...Object.entries(TOKEN).map(([k,v])=>[k,txt(v)])]))}
        ${field(labels.platform,select('ta-f-platform',f.platform,[all,...Object.entries(seed.platforms).map(([k,v])=>[k,txt(v)])]))}
        ${field(labels.issuer,select('ta-f-issuer',f.issuer,[all,...issuers().map(i=>[i.entity,txt(i.name)])]))}
        ${field(labels.standard,select('ta-f-standard',f.standard,[all,...standards().map(s=>[s,s])]))}
        ${field(labels.dup,select('ta-f-dup',f.dup,dupOpts))}
        ${field(labels.changed,select('ta-f-changed',f.changed,chOpts))}
        ${field(labels.from+' (UTC)',input('ta-f-from',f.from,'date'))}${field(labels.to+' (UTC)',input('ta-f-to',f.to,'date'))}
      </div>
      ${on.length?`<div class="ta-applied" aria-label="${L('Applied filters','已应用筛选')}">${on.map(k=>CF.tag('gray',labels[k]+': '+(values[k]||applied[k]))).join('')}</div>`:''}</form>`;
  }
  function pager(total){
    const st=A.list,pages=Math.max(1,Math.ceil(total/CF.PAGE_SIZE));
    return `<div class="pager"><span class="total">${L('Total','共')} ${total} ${L(total===1?'token':'tokens','笔代币')} · ${CF.PAGE_SIZE} ${L('per page','笔／页')}</span>${b('Previous','上一页','page',String(st.page-1),'sm',st.page===1)}<span>${st.page} / ${pages}</span>${b('Next','下一页','page',String(st.page+1),'sm',st.page===pages)}</div>`;
  }
  function list(){
    const blocked=gate();
    const heading=`<div class="ta-list-heading"><h1>${L('Token admission','代币准入审核')}</h1>${demoTag()}</div>`;
    if(blocked)return heading+blocked;
    const base=scope(),start=utcDayStart(now(),6);
    const decided=kind=>base.filter(r=>r.status===kind&&decision(r)&&decision(r).at>=start).length;
    const counts=[base.filter(r=>r.status==='pending').length,decided('approved'),decided('returned')];
    const shown=i=>['loading','error'].includes(A.view)?'—':A.view==='empty'?0:counts[i];
    const metrics=`<div class="stat-strip ta-metrics"><div class="s"><div class="k">${L('Pending review','待审核代币数')}</div><div class="v">${shown(0)} <span class="u">${L('tokens','笔')}</span></div></div><div class="s"><div class="k">${L('Decided · last 7 UTC days','近 7 个自然日审结（UTC）')}</div><div class="v">${shown(1)} <span class="u">${L('approved','通过')}</span> ${shown(2)} <span class="u">${L('returned','退回')}</span></div></div></div>`;
    S.st=A.view;
    const state=A.view==='default'?null:CF.surface({emptyTitle:L('No tokens awaiting review','暂无待审核代币'),
      emptyDesc:L('A token appears here once an issuance platform pushes it for admission.','代币发行平台推送准入申请后，代币将出现在此。'),
      deniedDesc:L('Contact the platform provider to check the delivered configuration.','请联系平台建设方核对交付配置。'),backTo:ROOT,backLabel:L('Back to token admission','返回代币准入审核'),skelRows:6});
    const rows=sortRows(found());
    const pages=Math.max(1,Math.ceil(rows.length/CF.PAGE_SIZE));
    let note=A.listNote;A.listNote='';
    if(A.list.page>pages){A.list.page=pages;note=['The previous page has no records now; showing the last page with records.','原页已无记录，已回到最后一个有内容的页。'];saveContext();}
    const page=rows.slice((A.list.page-1)*CF.PAGE_SIZE,A.list.page*CF.PAGE_SIZE);
    const table=state||(!rows.length
      ?CF.empty(L('No tokens found','暂无符合条件的代币'),L('Change the filters or reset to the pending list.','调整筛选条件，或重置回待审核清单。'),b('Reset filters','重置筛选','reset'))
      :`<div class="tablewrap ta-table-region" tabindex="0" role="region" aria-label="${L('Token admission table; scroll horizontally to view all columns','代币准入审核清单，可横向滚动查看全部列')}"><table class="tbl ta-table"><colgroup>
        <col class="ta-col-network"><col class="ta-col-identifiers"><col class="ta-col-name"><col class="ta-col-issuer"><col class="ta-col-standard"><col class="ta-col-value"><col class="ta-col-due"><col class="ta-col-submitted"><col class="ta-col-status"><col class="ta-col-action">
        </colgroup><thead><tr>
        <th scope="col">${L('Blockchain network','区块链网络')}</th><th scope="col">${L('Platform token ID / token number','平台代币标识 / 代币编号')}</th><th scope="col">${L('Token name','代币名称')}</th><th>${L('Issuance platform / issuer','来源发行平台 / 发行方')}</th><th>${L('Token standard','代币标准')}</th>
        <th aria-sort="${ariaSort('value')}">${L('Quantity','代币数量（枚）')} / ${sortButton('value','Value (USD)','代币价值（USD）')}</th>
        <th aria-sort="${ariaSort('due')}">${sortButton('due','Receivable due date','底层应收账款到期日')}</th>
        <th aria-sort="${ariaSort('submittedAt')}">${sortButton('submittedAt','This submission','本次提交时间')}<span class="ta-meta">${E(S.tz||'UTC')}</span></th>
        <th>${L('Admission / token status','准入状态 / 代币状态')}</th><th class="col-act">${L('Action','操作')}</th></tr></thead><tbody>${page.map(r=>`<tr>
        <td>${networkValue(r)}</td>
        <td><strong class="mono ta-record-id">${E(r.ptid)}</strong><span class="ta-meta mono ta-record-id">${E(r.tokenNo)}</span>${r.dupes.length||r.changed?`<span class="ta-flags">${dupTags(r)}${changedTag(r)}</span>`:''}</td>
        <td><span class="ta-list-token"><span class="ta-icon${r.icon?'':' ta-icon-empty'}" ${r.icon?'aria-hidden="true"':`role="img" aria-label="${L('No token logo supplied','未提供代币图标')}"`}>${r.icon?E(r.symbol?r.symbol.slice(0,2):txt(r.name).slice(0,1)):'—'}</span><span class="ta-list-token-name">${val(txt(r.name))}</span></span></td>
        <td>${E(platformName(r))}<span class="ta-meta">${E(txt(r.issuer.name))}</span></td>
        <td>${E(r.standard)}</td>
        <td class="ta-num">${qty(r.qty)}<span class="ta-meta">${usd(r.value)}</span></td>
        <td class="ta-num">${val(r.asset.due)}</td>
        <td class="ta-num">${E(CF.fmtStamp(r.submittedAt))}<span class="ta-meta">${E(submission(r.seq))}</span></td>
        <td><span class="ta-tags">${statusTag(r)}${tokenTag(r)}</span>${r.status==='approved'?`<span class="ta-meta">${L('Approved ','通过于 ')}${E(CF.fmtStamp(decision(r)?.at))}</span>`:''}</td>
        <td class="col-act"><a class="actlink" href="#${E(detailRoute(r.id))}" data-act="ta-view" data-v="${E(r.id)}">${L('View','查看')}</a></td></tr>`).join('')}</tbody></table></div>${pager(rows.length)}`);
    return heading+metrics+`<section class="card">${filters()}${A.error||note?`<div class="ta-list-note">${A.error?error():''}${note?CF.note('accent',E(txt(note))):''}</div>`:''}${table}</section>`;
  }

  /* ---------------------------------------------------------------- 详情公用 */
  function hashValue(value,label,explorer){
    if(!value)return blank;
    const short=value.slice(0,10)+'…'+value.slice(-8);
    return `<span class="ta-hash"><span class="mono" title="${E(value)}">${E(short)}</span>${CF.copyBtn('ta-copy',value,L('Copy the full '+label,'复制完整'+label))}${explorer?CF.linkOut(explorer,L('Open in a block explorer (new window)','在区块浏览器中查看（新窗口）')):''}</span>`;
  }
  function fullAddress(value,label,explorer){
    if(!value)return blank;
    return `<span class="ta-hash"><span class="mono ta-full">${E(value)}</span>${CF.copyBtn('ta-copy',value,L('Copy the full '+label,'复制完整'+label))}${explorer?CF.linkOut(explorer,L('Open in a block explorer (new window)','在区块浏览器中查看（新窗口）')):''}</span>`;
  }
  const scan=(kind,v)=>v?'https://etherscan.io/'+kind+'/'+encodeURIComponent(v):'';
  const entity=c=>c?`${E(txt(c.name))}<span class="ta-meta mono">${E(c.entity||blank)}</span>`:blank;
  const listValue=a=>a&&a.length?a.map(x=>`<span class="mono ta-chip">${E(x)}</span>`).join(''):blank;
  const fileName=f=>E(f.name);
  /* ---------------------------------------------------------------- 审核详情 */
  function overview(r){
    const d=decision(r);
    const items=[
      [L('Platform token ID','平台代币标识'),fullAddress(r.ptid,L('platform token ID','平台代币标识'))],
      [L('Token number','代币编号'),fullAddress(r.tokenNo,L('token number','代币编号'))],
      [L('Issuance platform','来源发行平台'),E(platformName(r))],
      [L('Admission status','准入状态'),statusTag(r)],
      [L('This submission','本次提交'),`${E(submission(r.seq))}<span class="ta-meta">${time(r.submittedAt)}</span>${r.updatedAt&&r.status==='pending'?`<span class="ta-meta">${L('Last updated ','最近更新 ')}${time(r.updatedAt)}</span>`:''}`],
      [L('Waiting','已等待时长'),`<span class="ta-num">${duration(waited(r))}</span>`],
      [L('Token status','代币状态'),tokenTag(r)+(r.tokenState==='expired'?`<span class="ta-meta">${L('Receivable due date ','对应应收账款到期日 ')}${val(r.asset.due)}</span>`:'')],
      [L('Decision','审核结论'),d?`${CF.tag(STATUS[d.result][2],txt(STATUS[d.result]))}<span class="ta-meta">${E(txt(d.reviewer))} · ${time(d.at)}</span>`:blank]
    ];
    if(d&&d.result==='returned'&&r.status==='returned')items.push([L('Return reason','退回原因'),`<div class="ta-quote">${E(txt(d.reason))}</div>`,true]);
    const alerts=r.dupes.map(x=>{
      const o=row(x.other);if(!o)return '';
      return `<div class="ta-alert"><div class="ta-alert-head">${CF.tag('warn',txt(DUP[x.kind]))}<a class="btn-link" href="#${E(detailRoute(o.id))}" data-act="ta-view" data-v="${E(o.id)}">${L('Open the other record','查看对方详情')}</a></div>
        ${kv([[L('Platform token ID','平台代币标识'),`<span class="mono">${E(o.ptid)}</span>`],[L('Issuance platform','来源发行平台'),E(platformName(o))],[L('Admission status','准入状态'),statusTag(o)],[L('Token number','代币编号'),`<span class="mono">${E(o.tokenNo)}</span>`],
          [L('Chain ID','链 ID'),E(o.chainId)],[L('Asset slot','资产槽位（slot）'),E(o.slot)],[L('Token contract address','代币发行合约地址'),`<span class="mono ta-full">${E(o.contract.address)}</span>`,true]])}</div>`;
    }).join('')+(r.changed?`<div class="ta-alert"><div class="ta-alert-head">${CF.tag('accent',L('Changed after approval','通过后资料有变更'))}<button type="button" class="btn-link" data-act="ta-locate-change">${L('View the change in the activity','在操作记录中查看变更')}</button></div></div>`:'');
    return section('overview','Review overview','审核概况',facts(items)+(alerts?`<div class="ta-alerts"><h3 class="ta-h3">${L('Alerts','提醒')}</h3>${alerts}</div>`:''));
  }
  function tokenInfo(r){
    const holders=r.holders&&r.holders.length?`<ul class="ta-holders">${r.holders.map(h=>`<li>${h.addr?CF.addrCopy(h.addr):blank}<span class="ta-num">${qty(h.qty)}</span></li>`).join('')}</ul>`:blank;
    return section('token','Token information','代币基本信息',
      group('Issuance and issuer','发行与发行方',facts([
        [L('Issuer','发行方'),E(txt(r.issuer.name))],
        [L('Issuer entity identifier','发行方主体标识'),`<span class="mono">${val(r.issuer.entity)}</span>`],
        [L('Issuer country or region','发行方注册国家或地区'),val(r.issuer.region)],
        [L('Issuer vs receivable seller','发行方与底层资产卖方的关系'),r.sameAsSeller?L('Same entity','一致'):`${L('Different','不一致')}<span class="ta-meta">${L('Issuer: ','发行方：')}${E(txt(r.issuer.name))} · ${L('Seller: ','卖方：')}${E(txt(r.asset.seller.name))}</span>`]
      ]))
      +group('Token attributes','代币属性',facts([
        [L('Token number','代币编号'),`<span class="mono">${E(r.tokenNo)}</span>`],
        [L('Token name','代币名称'),E(txt(r.name))],
        [L('Token symbol','代币符号'),val(r.symbol)],
        [L('Token logo','代币标识图'),r.icon?`<span class="ta-icon" aria-label="${L('Logo provided','已提供标识图')}">${E(r.symbol?r.symbol.slice(0,2):'')}</span>`:blank],
        [L('Token standard','代币标准'),val(r.standard)],
        [L('Token type','代币类型'),val(r.type)],
        [L('Asset slot','资产槽位（slot）'),`<span class="mono">${val(r.slot)}</span>`],
        [L('Token ID','代币 ID（tokenId）'),`<span class="mono">${val(r.tokenId)}</span>`],
        [L('Decimals','精度'),val(r.decimals)]
      ]))
      +group('Quantity and value','数量与价值',facts([
        [L('Token quantity','代币数量'),`<span class="ta-num">${qty(r.qty)}</span>`],
        [L('Token value at issuance','代币价值'),`<span class="ta-num">${usd(r.value)}</span>`],
        [L('Issuance exchange rate','签发汇率'),r.rate?`<span class="ta-num">${E(r.rate.pair)} ${raw(r.rate.value)}</span><span class="ta-meta">${L('Effective ','生效时间 ')}${time(r.rate.at)} · ${E(txt(r.rate.source))}</span>`:blank,true]
      ]))
      +group('On-chain and issuance facts','链上与发行事实',facts([
        [L('Minting chain','铸造链'),val(r.chain)],
        [L('Chain ID','链 ID'),`<span class="mono">${val(r.chainId)}</span>`],
        [L('Token contract','代币发行合约'),`${val(r.contract.name)}${fullAddress(r.contract.address,L('contract address','合约地址'),scan('address',r.contract.address))}`,true],
        [L('Minting transaction hash','铸造交易哈希'),hashValue(r.mintTx,L('minting transaction hash','铸造交易哈希'),scan('tx',r.mintTx)),true],
        [L('Minted at','铸造时间'),time(r.mintAt)],
        [L('Initial receiving address','初始收币地址'),r.initial?CF.addrFull(r.initial):blank,true],
        [L('Holding addresses','持有地址'),holders,true],
        [L('Token status','代币状态'),tokenTag(r)],
        [L('Smart contract audit','智能合约审计'),r.audit&&r.audit.done?`${val(r.audit.done)}<span class="ta-meta">${val(r.audit.firm)} · ${val(r.audit.date)}</span>`:blank]
      ])));
  }
  function assetInfo(r){
    const a=r.asset,ev=a.evidence||{};
    return section('asset','Underlying asset','底层资产信息',
      group('Receivable','应收账款要素',facts([
        [L('Asset type','资产类型'),val(a.type)],
        [L('Receivable number','应收账款编号'),`<span class="mono">${val(a.no)}</span>`],
        [L('Seller (creditor)','卖方（债权人）'),entity(a.seller)],
        [L('Buyer (debtor)','买方（债务人）'),entity(a.buyer)],
        [L('Buyer country or region','买方注册国家或地区'),val(a.buyer?.region)],
        [L('Receivable amount','应收账款金额与币种'),a.amount?`<span class="ta-num">${raw(a.amount)} ${E(a.ccy)}</span>`:blank],
        [L('Tenor','账期'),a.start||a.due?`${val(a.start)} ～ ${val(a.due)}`:blank],
        [L('Contract numbers','合同号'),listValue(a.contracts)],
        [L('Invoice numbers','发票号'),listValue(a.invoices)],
        [L('Trade type','贸易类型'),val(a.trade)],
        [L('Settlement method','结算方式'),val(a.settle)],
        [L('Payment terms','付款条件'),val(a.terms)],
        [L('Recourse','追索安排'),val(a.recourse)]
      ]))
      +group('Confirmation and evidence','确权与存证',facts([
        [L('Confirmation','确权信息'),a.confirm?`${val(a.confirm.result)}<span class="ta-meta">${L('By ','确权方 ')}${val(a.confirm.party)} · ${time(a.confirm.at)}</span>`:blank],
        [L('Registration of assignment','债权转让登记'),a.transfer&&a.transfer.done?`${val(a.transfer.done)}<span class="ta-meta">${val(a.transfer.org)} · <span class="mono">${val(a.transfer.no)}</span></span>`:blank],
        [L('Evidence hash','存证哈希'),hashValue(ev.hash,L('evidence hash','存证哈希')),true],
        [L('Evidence transaction hash','链上存证交易哈希'),hashValue(ev.tx,L('evidence transaction hash','存证交易哈希'),scan('tx',ev.tx)),true],
        [L('Evidence block height','存证区块高度'),`<span class="mono">${val(ev.block)}</span>`],
        [L('Evidence chain','存证链'),val(ev.chain)],
        [L('Evidence time','存证时间'),time(ev.at)],
        [L('No double financing declaration','重复融资声明'),val(a.declare)]
      ]))
      );
  }
  /* 用户 2026-10-21：附件不再逐份分列，法律协议文件与佐证材料合并为一个下载链接，按需下载。 */
  function attachments(r){
    const bd=r.bundle;
    const link=!bd?blank:A.dlError
      ?`<div class="ta-bundle-error">${CF.note('red',L('Download failed.','下载失败。'))}${b('Retry','重试','download-retry')}</div>`
      :`<div class="ta-bundle">${b('Download all attachments','下载全部附件','download','','',false)}<span class="ta-meta">${E(bd.name)} · ${L('Provided with ','随')}${E(submission(bd.seq))}${L(' · ',' 提供 · ')}${time(bd.at)}</span></div>`;
    return section('docs','Attachment download','附件下载',facts([[L('Legal documents and supporting materials','法律协议文件与佐证材料'),link,true]],true));
  }
  const TONE={approve:'ok',return:'danger','callback-fail':'warn',expire:'gray',change:'accent',ack:'gray',update:'accent'};
  function activity(r){
    let body;
    if(A.activityState==='loading')body=`<p role="status">${L('Loading activity…','正在加载操作记录…')}</p>`;
    else if(A.activityState==='error')body=`<p role="alert">${L('Activity could not be loaded.','操作记录读取失败。')}</p>${b('Retry','重试','activity-retry')}`;
    else{
      const seen=new Set();
      const events=A.activityState==='empty'?[]:r.events.filter(e=>{if(seen.has(e.id))return false;seen.add(e.id);return true;})
        .map((e,i)=>({...e,order:i})).sort((a,c)=>(c.at||0)-(a.at||0)||a.order-c.order);
      body=!events.length?`<p class="ta-meta">${L('No activity yet.','暂无操作记录。')}</p>`
        :`<ol class="ta-timeline" aria-label="${L('Activity, newest first','操作记录，最新在前')}">${events.map(e=>{
          const occurred=e.at?`<time datetime="${E(new Date(e.at).toISOString())}">${time(e.at)}</time>`:`<span>${L('Time: to be verified','发生时间：待核实')}</span>`;
          const diff=e.diff?`<table class="tbl ta-diff"><thead><tr><th>${L('Item','信息项')}</th><th>${L('Before','变更前')}</th><th>${L('After','变更后')}</th></tr></thead><tbody>${e.diff.map(([k,a,c])=>`<tr><td>${E(txt(k))}</td><td>${E(txt(a))}</td><td>${E(txt(c))}</td></tr>`).join('')}</tbody></table>`:'';
          const more=e.text||e.next||diff;
          return `<li class="ta-event" id="${E(e.id)}" data-kind="${E(e.kind)}" data-tone="${TONE[e.kind]||'neutral'}"><h3>${E(txt(e.title))}</h3><div class="ta-event-meta"><span>${e.actor?E(txt(e.actor)):L('Actor: to be verified','操作主体：待核实')}</span>${occurred}</div><p class="ta-event-result">${E(txt(e.result))}</p>${more?`<div class="ta-event-detail">${e.text?`<p>${E(txt(e.text))}</p>`:''}${diff}${e.next?`<p class="ta-meta">${E(txt(e.next))}</p>`:''}</div>`:''}</li>`;
        }).join('')}</ol>`;
    }
    return section('activity','Activity','操作记录',body);
  }
  function rail(r){
    const peer=approvedPeer(r),blockers=[];
    if(r.status==='pending'&&r.tokenState==='expired')blockers.push(L('The token is invalid: the receivable was due on ','代币已失效：对应应收账款到期日 ')+E(r.asset.due||blank)+L('. It cannot be approved; it can still be returned.','，不能通过，可退回。'));
    if(r.status==='pending'&&peer)blockers.push(`${L('The same on-chain token is already approved: ','同一链上代币已有记录通过：')}${E(platformName(peer))} · <span class="mono">${E(peer.ptid)}</span>${L('. This record can only be returned. ','，本条只能退回。')}<a class="btn-link" href="#${E(detailRoute(peer.id))}" data-act="ta-view" data-v="${E(peer.id)}">${L('Open it','查看该记录')}</a>`);
    let actions='';
    const approving=A.busy&&A.draft?.mode==='approve'&&A.draft.id===r.id;
    if(r.status==='pending'&&canDecide())actions=`<div class="ta-actions">${b(approving?'Submitting…':'Approve',approving?'正在提交…':'通过','approve','','primary',approving||!canApprove(r))}${b('Return','退回','return','','ta-return-btn',approving||!canAct(r))}</div>${approving?`<p class="ta-meta" role="status">${L('Submitting the approval…','正在提交通过…')}</p>`:''}`;
    else if(r.status==='approved'&&r.changed&&canDecide())actions=`<div class="ta-actions">${b('Acknowledge the change','确认已知悉变更','ack')}</div>`;
    else if(r.status==='pending')actions=`<p class="ta-meta">${L('View only with this account.','当前账号仅可查看。')}</p>`;
    return `<section class="card ta-section ta-rail-card" aria-labelledby="ta-operation-title">
      <h2 class="ta-h2" id="ta-operation-title">${L('Review actions','审核操作')}</h2>
      <dl class="ta-rail-id"><div><dt>${L('Platform token ID','平台代币标识')}</dt><dd class="mono">${E(r.ptid)}</dd></div><div><dt>${L('Token number','代币编号')}</dt><dd class="mono">${E(r.tokenNo)}</dd></div><div><dd class="ta-tags">${statusTag(r)}<span class="ta-meta ta-inline">${E(submission(r.seq))}</span></dd></div></dl>
      ${blockers.map(x=>`<div class="note warn"><p class="ta-note-text">${x}</p></div>`).join('')}${actions}</section>`;
  }
  function detail(){
    const blocked=gate();
    if(blocked)return `<div class="ta-list-heading"><h1>${L('Review detail','审核详情')}</h1></div>`+blocked;
    const r=row();
    if(!r)return CF.empty(L('Record unavailable','记录不可用'),L('Return to the token admission list.','请返回代币准入审核清单。'),b('Back to the list','返回清单','back'));
    S.st=A.view;
    if(A.view!=='default')return `<header class="ta-detail-heading"><h1 class="mono">${E(r.ptid)}</h1></header>`+(CF.surface({errorTitle:L('Could not load this record','详情读取失败'),skelRows:6,backTo:ROOT,backLabel:L('Back to the list','返回清单')})||'');
    const heading=`<header class="ta-detail-heading"><h1 class="mono">${E(r.ptid)}</h1><p class="ta-detail-name"><span class="ta-name">${r.icon?`<span class="ta-icon" aria-hidden="true">${E(r.symbol?r.symbol.slice(0,2):txt(r.name).slice(0,1))}</span>`:''}${E(txt(r.name))}</span></p>${demoTag()}</header>`;
    return heading+(A.error&&!S.layer?`<div class="ta-page-error">${error()}</div>`:'')
      +`<div class="ta-grid"><div class="ta-detail-main"><div class="detail-stack ta-stack">${overview(r)}${tokenInfo(r)}${assetInfo(r)}${attachments(r)}${activity(r)}</div></div><aside class="ta-rail">${rail(r)}</aside></div>`;
  }

  /* ---------------------------------------------------------------- 办理 */
  function identity(r){
    return `<div class="ta-quote"><strong class="mono">${E(r.ptid)}</strong> · ${E(txt(r.name))}<span class="ta-meta">${L('Token number ','代币编号 ')}<span class="mono">${E(r.tokenNo)}</span> · ${E(platformName(r))} · ${E(submission(r.seq))}</span></div>`;
  }
  const reasonLength=s=>Array.from((s||'').trim()).length;
  function start(mode){
    const r=row();
    if(mode==='approve'?!canApprove(r):!canAct(r))return deny();
    A.drafts[r.id]=A.drafts[r.id]||{reason:''};
    A.draft={id:r.id,mode,version:r.events.length};A.error='';
    /* 用户 2026-10-21：点击通过即提交，不设确认步骤；退回填写原因后直接提交。 */
    if(mode==='approve')submit();else open('return');
  }
  function validate(){
    const d=A.draft;if(!d)return false;A.error='';
    if(d.mode==='return'){const n=reasonLength(A.drafts[d.id].reason);if(n<10||n>500)A.error=['Enter a return reason of 10–500 characters.','退回原因需为 10～500 字。'];}
    return !A.error;
  }
  /* 待审核期间发行平台再次推送：不增加提交序次，详情展示最新资料。 */
  function pushUpdate(r,note){
    const inv=r.asset.invoices||[],next='DEMO-INV-'+r.key+String(inv.length+1).padStart(2,'0');
    const before=inv.length?inv.join(', '):'—';
    r.asset={...r.asset,invoices:[...inv,next]};r.updatedAt=now();
    const oldBundle=r.bundle?.name||'—';r.bundle={name:'Attachments-'+r.id+'-submission-'+r.seq+'-v'+(r.events.filter(e=>e.kind==='update').length+2)+'.zip',seq:r.seq,at:now()};
    event(r,'update',['Materials updated','资料更新'],[`Pending review · submission ${r.seq}`,`待审核 · 第 ${r.seq} 次提交`],
      {actor:platformActor(r),text:note,diff:[[['Invoice numbers','发票号'],before,[...inv,next].join(', ')],[['Attachments','附件'],oldBundle,r.bundle.name]]});
  }
  function finish(r,kind,reason){
    const reviewer=['Demo Operator','演示操作员'];
    r.status=kind;r.decisions.push({result:kind,at:now(),reviewer,reason});
    if(kind==='approved')event(r,'approve',['Approved','审核通过'],['Pending review → Approved','待审核 → 已通过'],
      {actor:reviewer});
    else event(r,'return',['Returned','审核退回'],['Pending review → Returned','待审核 → 已退回'],
      {actor:reviewer,text:reason});
    if(A.callback==='fail')event(r,'callback-fail',['Result could not be sent back','审核结果回传失败'],['Decision stays in effect','结论照常生效'],
      {text:['The issuance platform did not accept the result.','来源发行平台未能接收审核结果。']});
  }
  function refuse(message,keepLayer){
    A.busy=false;A.error=message;
    if(keepLayer&&A.draft?.mode==='return'){open('return');return;}
    A.draft=null;S.layer=null;CF.render();window.scrollTo(0,0);
  }
  function submit(){
    const d=A.draft,r=row();
    if(A.busy)return;
    if(!d||d.id!==r?.id)return deny();
    if(d.mode==='approve'?!canApprove(r):!canAct(r))return deny();
    if(!validate()){open('return');return;}
    A.busy=true;A.error='';CF.render();
    const epoch=A.epoch,response=A.response,reason=(A.drafts[r.id].reason||'').trim();
    setTimeout(()=>{
      if(epoch!==A.epoch||A.draft!==d)return;
      if(!signedIn()||response==='permission')return refuse(['Your account status or permissions changed. This submission did not take effect.','账号状态或权限已变化，本次提交未生效。']);
      if(response==='fail')return refuse(['The submission could not be saved. Your input is kept; try again.','提交未能保存，已保留已填内容，请重试。'],true);
      if(response==='concurrent'){
        const other=d.mode==='approve'?'returned':'approved';
        r.status=other;r.decisions.push({result:other,at:now(),reviewer:seed.reviewers.CHEN,reason:other==='returned'?['The token logo provided does not match the token name. Provide the correct logo and submit again.','提供的代币标识图与代币名称不符，请提供正确的标识图后重新提交。']:null});
        event(r,other==='approved'?'approve':'return',other==='approved'?['Approved','审核通过']:['Returned','审核退回'],other==='approved'?['Pending review → Approved','待审核 → 已通过']:['Pending review → Returned','待审核 → 已退回'],
          {actor:seed.reviewers.CHEN,text:other==='returned'?decision(r).reason:null});
        return refuse(['Another reviewer has already decided this token. The current decision is shown; your submission did not take effect.','该代币已由其他审核人作出结论，已显示当前结论，本次提交未生效。']);
      }
      if(response==='updated'){
        pushUpdate(r,['Pushed by the issuance platform after this page was opened.','发行平台在本页打开后推送了资料更新。']);
        return refuse(['The materials were updated after you opened this page. Review the latest materials, then decide again.','资料已更新：您打开详情后发行平台推送了新资料，请查看最新资料后重新办理。']);
      }
      if(response==='expired'&&d.mode==='approve'){
        r.tokenState='expired';r.asset={...r.asset,due:new Date(now()).toISOString().slice(0,10)};
        event(r,'expire',['Token became invalid','代币变为失效'],['Valid → Invalid','有效 → 失效'],{actor:platformActor(r),text:['The underlying receivable reached its due date.','对应应收账款已到期。']});
        return refuse(['The token has become invalid, so it cannot be approved. It can still be returned.','代币已失效，不能通过；仍可退回。']);
      }
      if(response==='peer'&&d.mode==='approve'){
        const peer=r.dupes.filter(x=>x.kind==='chain').map(x=>row(x.other)).find(o=>o&&o.status==='pending');
        if(peer){
          peer.status='approved';peer.decisions.push({result:'approved',at:now(),reviewer:seed.reviewers.CHEN});
          event(peer,'approve',['Approved','审核通过'],['Pending review → Approved','待审核 → 已通过'],{actor:seed.reviewers.CHEN});
          return refuse(['Another record of the same on-chain token was approved first. This record can now only be returned.','同一链上代币的另一条记录已先通过，本条现在只能退回。']);
        }
      }
      finish(r,d.mode==='approve'?'approved':'returned',d.mode==='return'?[reason,reason]:null);
      if(d.mode==='return')delete A.drafts[r.id];
      A.busy=false;A.draft=null;S.layer=null;saveContext();CF.render();
      CF.toast(d.mode==='approve'?L('Approved. The token is admitted.','已通过，代币已准入。'):L('Returned. The reason was sent to the issuance platform.','已退回，原因已回传来源发行平台。'));
    },650);
  }

  /* ---------------------------------------------------------------- 弹层 */
  function returnLayer(){
    const d=A.draft,r=row();
    if(!d||!r)return {title:L('Unavailable','不可用'),html:'',foot:b('Close','关闭','cancel')};
    const reason=A.drafts[r.id].reason;
    return {title:L('Return','退回'),
      html:`<div class="ta-form">${identity(r)}<fieldset ${A.busy?'disabled':''}>${field(L('Return reason *','退回原因 *'),`<textarea class="inp" id="ta-reason" maxlength="600" aria-required="true" aria-invalid="${!!A.error}" aria-describedby="ta-form-error ta-count">${E(reason)}</textarea><span class="ta-meta" id="ta-count">${reasonLength(reason)} / 500</span>`)}</fieldset><div id="ta-form-error">${error()}</div>${A.busy?'<p role="status">'+L('Submitting…','正在提交…')+'</p>':''}</div>`,
      foot:b('Cancel','取消','cancel','','',A.busy)+b(A.busy?'Submitting…':'Return',A.busy?'正在提交…':'确认退回','submit','','primary',A.busy)};
  }
  const layers={
    'ta-return':returnLayer,
    'ta-ack':()=>({title:L('Acknowledge the change?','确认已知悉变更？'),
      html:`<p>${L('This clears the alert in the list. The token stays approved and the activity keeps who acknowledged it and when.','确认后清除清单中的提醒；准入状态不变，操作记录保留确认人与时间。')}</p>`,
      foot:b('Cancel','取消','cancel')+b('Acknowledge','确认已知悉','ack-confirm','','primary')}),
    'ta-discard':()=>({title:L('Discard the reason?','放弃已填原因？'),
      html:CF.note('accent',L('The reason you typed is not carried to another token.','已填写的原因不会带入其他代币。')),
      foot:b('Keep editing','继续编辑','keep')+b('Discard','放弃','discard','','primary')})
  };

  /* ---------------------------------------------------------------- 演示工具 */
  function grant(mode){
    if(!CF.opsAuth)return;
    CF.opsAuth.seedDemo(mode==='admin'?'admin':'specialist');
    if(mode==='query'||mode==='full')OPS.onAct('ops-grant',String(P_QUERY));
    if(mode==='decide'||mode==='full')OPS.onAct('ops-grant',String(P_DECIDE));
    A.epoch++;A.draft=null;A.busy=false;A.error='';S.layer=null;
  }
  function demo(){
    if(OPS_PAGES.includes(S.page))return OPS.demo();
    const r=S.page===DT?row():null;
    return `<h3>${L('Token admission · demo tools','代币准入审核 · 演示工具')}</h3><p class="ta-meta">${L('Local demonstration only. Pushes from issuance platforms, result call-backs, file reading and block explorers are simulated.','仅本地演示：发行平台推送、结果回传、文件读取与区块浏览器均为模拟。')}</p>
      <h4>${L('Account configuration · later-role preview','账号配置 · 后期角色预演')}</h4><p class="ta-meta">${L('This release has one role: the operations administrator holds both permissions.','本期只有运营管理员一个角色，固定具备两项权限。')}</p>
      <div class="ta-demo-actions">${b('Administrator','运营管理员','grant','admin')}${b('Later role · no access','后期角色 · 未开通本模块','grant','none')}${b('Later role · query only','后期角色 · 仅开通审核查询','grant','query')}${b('Later role · decision only','后期角色 · 仅开通审核处置','grant','decide')}</div>
      <div class="ta-demo">${field(L('Page state','页面状态'),select('ta-d-view',A.view,[['default',L('Default','默认')],['loading',L('Loading','加载中')],['empty',L('Empty','无数据')],['noresult',L('No results','筛选无结果')],['error',L('Load failed','读取失败')]]))}
        ${field(L('Submit response','提交反馈'),select('ta-d-response',A.response,[['success',L('Success','成功')],['fail',L('Save failed','保存失败')],['concurrent',L('Another reviewer decided first','已被他人作出结论')],['updated',L('Materials updated meanwhile','资料已更新')],['expired',L('Token became invalid (approve)','代币已失效（通过时）')],['peer',L('Same on-chain token approved first (approve)','同一链上代币另一条已先通过（通过时）')],['permission',L('Permission or account changed','权限或账号状态变化')]]))}
        ${field(L('Result call-back','审核结果回传'),select('ta-d-callback',A.callback,[['ok',L('Delivered','回传成功')],['fail',L('Fails','回传失败')]]))}
        ${field(L('Attachment download','附件下载'),select('ta-d-file',A.fileState,[['ready',L('Works','正常')],['error',L('Link unavailable','链接不可用')]]))}
        ${field(L('Activity state','操作记录状态'),select('ta-d-activity',A.activityState,[['default',L('Default','默认')],['loading',L('Loading','加载中')],['empty',L('Empty','暂无记录')],['error',L('Load failed','读取失败')]]))}</div>
      <h4>${L('Pushes from the issuance platform','发行平台推送')}${r?' · '+E(r.ptid):''}</h4>
      <div class="ta-demo-actions">${b('Push a materials update','推送资料更新','push-update','','',!r||r.status!=='pending')}${b('Revise and push again','修改后重新推送','push-resubmit','','',!r||r.status!=='returned')}${b('Push a change after approval','推送通过后资料变更','push-change','','',!r||r.status!=='approved')}${b('Token becomes invalid','代币变为失效','push-expire','','',!r||r.tokenState!=='valid')}</div>
      <div class="ta-demo-actions">${b('Push a token missing one identity key','推送缺少识别四项之一的代币','push-incomplete')}${b('Expire operations session','运营登录失效','expire-session')}${b('Reset demonstration','重置演示','restart')}</div>`;
  }

  /* ---------------------------------------------------------------- 动作 */
  function resetFilter(){
    const st=A.list;st.filter=fDefault();st.edit=fDefault();st.sort='submittedAt';st.dir=1;st.open=false;st.page=1;A.error='';A.view='default';
    if(S.page!==DT)saveContext();CF.render();
  }
  function onAct(act,v,e){
    if(e&&(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)&&act==='ta-view')return false;
    if(!act.startsWith('ta-')){
      if(act==='retry'){A.view='default';A.error='';CF.render();return true;}
      if(act==='clearfilter'){resetFilter();return true;}
      return false;
    }
    act=act.slice(3);
    if(A.busy&&!['cancel'].includes(act))return true;
    const r=row();
    if(act==='view')leave(detailRoute(v));
    else if(act==='back')leave(listRoute());
    else if(act==='sign-in'){S.layer=null;location.hash='#/ops/login';}
    else if(act==='page'){A.list.page=+v;saveContext();CF.render();window.scrollTo(0,0);}
    else if(act==='search'){
      const f={...A.list.edit};f.q=f.q.trim();
      if(f.from&&f.to&&f.from>f.to){A.list.open=true;A.error=['The start date must not be later than the end date.','开始日期不得晚于结束日期。'];CF.render();$('ta-f-from')?.focus();return true;}
      A.error='';A.list.open=false;A.list.filter=f;A.list.edit={...f};A.list.page=1;A.view='default';saveContext();CF.render();
    }
    else if(act==='filters'){A.list.open=!A.list.open;CF.render();document.querySelector('[data-act=ta-filters]')?.focus();}
    else if(act==='reset')resetFilter();
    else if(act==='sort'){const st=A.list;st.dir=st.sort===v?-st.dir:(v==='value'||v==='waiting'?-1:1);st.sort=v;st.page=1;saveContext();CF.render();}
    else if(act==='approve'||act==='return')start(act);
    else if(act==='submit')submit();
    else if(act==='cancel'){
      A.next=undefined;
      if(A.draft?.mode==='return'&&(A.drafts[A.draft.id]?.reason||'').trim())open('discard');
      else{A.draft=null;A.error='';CF.closeLayer();}
    }
    else if(act==='keep')open('return');
    else if(act==='discard'){
      if(A.selected)delete A.drafts[A.selected];A.draft=null;A.error='';
      if(A.next!==undefined){const target=A.next;A.next=undefined;navigateRoute(target);}else CF.closeLayer();
    }
    else if(act==='ack'){if(!r||!r.changed||!canDecide())return deny(),true;open('ack');}
    else if(act==='ack-confirm'){
      if(!r||!r.changed||!canDecide())return deny(),true;
      r.changed=false;
      event(r,'ack',['Change acknowledged','确认已知悉变更'],['Approved · alert cleared','已通过 · 提醒已清除'],{actor:['Demo Operator','演示操作员']});
      S.layer=null;CF.render();CF.toast(L('Acknowledged. The alert was cleared.','已确认知悉，提醒已清除。'));
    }
    else if(act==='download'){if(A.fileState==='error'){A.dlError=true;CF.render();}else CF.toast(L('Download started (demonstration).','已开始下载（演示）。'));}
    else if(act==='download-retry'){A.dlError=false;A.fileState='ready';CF.render();CF.toast(L('Download started (demonstration).','已开始下载（演示）。'));}
    /* 公共层在动作后重绘正文，定位放到重绘之后。 */
    else if(act==='locate-change')setTimeout(()=>{
      const el=document.querySelector('.ta-event[data-kind="change"]');
      if(el){el.setAttribute('tabindex','-1');el.scrollIntoView({block:'center'});el.focus({preventScroll:true});}
    });
    else if(act==='activity-retry'){A.activityState='default';CF.render();$('ta-sec-activity')?.focus({preventScroll:true});}
    else if(act==='copy')navigator.clipboard?.writeText(v).then(()=>CF.toast(L('Copied','已复制'))).catch(()=>CF.toast(L('Copy failed. Select the value and copy it manually.','复制失败，请选中后手动复制。')));
    else if(act==='grant'){grant(v);S.demo=false;window.scrollTo(0,0);navigateRoute(S.page===DT&&A.selected?detailRoute(A.selected):listRoute());}
    else if(act==='expire-session'){A.draft=null;A.busy=false;S.layer=null;S.demo=false;OPS.onAct('ops-session-expire');CF.render();}
    else if(act==='push-update'&&r?.status==='pending'){pushUpdate(r,['The issuance platform pushed updated materials for this submission.','发行平台推送了本次提交的资料更新。']);CF.render();CF.toast(L('Materials updated; the submission number is unchanged.','资料已更新，提交序次不变。'));}
    else if(act==='push-resubmit'&&r?.status==='returned'){
      r.status='pending';r.seq+=1;r.submittedAt=now();r.updatedAt=null;
      if(r.bundle)r.bundle={name:'Attachments-'+r.id+'-submission-'+r.seq+'.zip',seq:r.seq,at:now()};
      event(r,'resubmit',['Resubmitted after revision','重新提交'],[`Returned → Pending review · submission ${r.seq}`,`已退回 → 待审核 · 第 ${r.seq} 次提交`],
        {actor:platformActor(r)});
      CF.render();
    }
    else if(act==='push-change'&&r?.status==='approved'){
      const before=txt(r.asset.recourse);r.asset={...r.asset,recourse:['Without recourse','无追索']};r.changed=true;
      event(r,'change',['Materials changed after approval','通过后资料变更'],['Approved · unchanged','已通过 · 准入状态不变'],
        {actor:platformActor(r),diff:[[['Recourse','追索安排'],before,txt(['Without recourse','无追索'])]]});
      CF.render();
    }
    else if(act==='push-expire'&&r?.tokenState==='valid'){
      r.tokenState='expired';r.asset={...r.asset,due:new Date(now()).toISOString().slice(0,10)};
      event(r,'expire',['Token became invalid','代币变为失效'],['Valid → Invalid','有效 → 失效'],{actor:platformActor(r),text:['The underlying receivable reached its due date.','对应应收账款已到期。']});
      CF.render();
    }
    else if(act==='push-incomplete')CF.toast(L('A push missing one of the four identity keys cannot be identified: no admission record and no platform token ID were created.','推送缺少代币识别四项之一，无法识别：未形成准入记录，未生成平台代币标识。'));
    else if(act==='restart'){
      A.epoch++;seed=CF.tokenAdmissionSeed();A.rows=seed.rows;A.now=seed.now;A.clock=Date.now();
      A.drafts={};A.draft=null;A.busy=false;A.response='success';A.callback='ok';A.fileState='ready';A.activityState='default';
      grant('admin');resetFilter();navigateRoute(listRoute());
    }
    else return false;
    return true;
  }
  function onInput(e){
    if(A.busy)return;
    const el=e.target,id=el.id;
    if(id.startsWith('ta-f-')){A.list.edit[id.slice(5)]=el.value;return;}
    if(A.draft){
      if(id==='ta-reason'){
        A.drafts[A.draft.id].reason=el.value;
        const count=$('ta-count');
        if(count)count.textContent=reasonLength(el.value)+' / 500';
        el.setAttribute('aria-invalid','false');
        if(A.error){A.error='';const fe=$('ta-form-error');if(fe)fe.innerHTML='';}
      }
    }
  }
  document.addEventListener('submit',e=>{if(e.target.id==='ta-filter-form'){e.preventDefault();onAct('ta-search','');}});
  document.addEventListener('input',onInput);
  document.addEventListener('change',e=>{
    onInput(e);
    const el=e.target,id=el.id;
    if(id==='ta-order'){const [sort,dir]=el.value.split(':');A.list.sort=sort;A.list.dir=+dir;A.list.page=1;saveContext();CF.render();}
    const demoKeys={'ta-d-view':'view','ta-d-response':'response','ta-d-callback':'callback','ta-d-file':'fileState','ta-d-activity':'activityState'};
    if(demoKeys[id]){A[demoKeys[id]]=el.value;A.error='';A.dlError=false;CF.render();}
  });
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href^="#"]');
    if(!a||a.hasAttribute('data-act')||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
    const d=A.drafts[A.selected];
    if(S.page===DT&&d&&(d.reason||'').trim()){e.preventDefault();A.next=a.hash.slice(1);open('discard');return;}
    remember();
  },true);

  const DENIED={id:'denied',label:['No access','无权限'],group:'business'};
  [[LIST,['Token admission list','准入审核清单'],['default','loading','empty','noresult','error',DENIED]],
   [DT,['Review detail','审核详情'],['default','loading','error',DENIED]]].forEach(([id,label,states])=>{
    CF.review.register(id,{
      group:['Token admission','代币准入审核'],label,states,
      scenarios:()=>id!==DT?[]:[
        ['pending',['Pending review · valid','待审核 · 有效'],r=>r.status==='pending'&&r.tokenState==='valid'&&!r.dupes.length&&!r.updatedAt],
        ['expired',['Pending review · token invalid','待审核 · 代币失效'],r=>r.status==='pending'&&r.tokenState==='expired'],
        ['empty',['Fields not provided','部分字段未提供'],r=>!r.holders&&r.status==='pending'],
        ['resubmitted',['Second submission','第 2 次提交'],r=>r.seq>1&&r.status==='pending'],
        ['chain',['Same on-chain token · other approved','链上代币重复 · 对方已通过'],r=>!!approvedPeer(r)&&r.status==='pending'],
        ['number',['Same token number','代币编号重复'],r=>r.dupes.some(d=>d.kind==='number')&&r.status==='pending'],
        ['changed',['Changed after approval','通过后资料有变更'],r=>r.changed],
        ['returned',['Returned','已退回'],r=>r.status==='returned'],
        ['approved',['Approved · token invalid','已通过 · 代币失效'],r=>r.status==='approved'&&r.tokenState==='expired']
      ].map(([key,label2,test])=>{const r=A.rows.find(test);return {id:key,label:label2,available:canQuery()&&!!r,route:r?detailRoute(r.id):null,description:r?['Record '+r.ptid,'记录 '+r.ptid]:['No matching record','暂无对应记录']};}),
      route:()=>id===LIST?ROOT:detailRoute(A.rows[0].id),
      get:()=>canQuery()?A.view:'denied',
      set(value){if(value==='denied'){grant('none');A.view='default';S.st='default';return;}if(!canQuery())grant('admin');A.view=value;S.st=value;},
      reset(){if(!canQuery())grant('admin');A.view='default';S.st='default';A.response='success';A.callback='ok';A.fileState='ready';A.activityState='default';},
      beforeChange(proceed){CF.AdminMenu.beforeLeave(proceed);}
    });
  });

  const dict={
    en:{...OPS.dict.en,navTokenAdmission:'Token admission',navTokenAdmissionDetail:'Review detail'},
    zh:{...OPS.dict.zh,navTokenAdmission:'代币准入审核',navTokenAdmissionDetail:'审核详情'}
  };
  CF.define({...OPS,id:'token-admission',demoOnly:true,reviewToolsInLayer:false,dict,demo,
    content:page=>OPS_PAGES.includes(page)?OPS.content(page):page===DT?detail():list(),
    layers:{...OPS.layers,...layers},
    onAct:(act,v,e)=>onAct(act,v,e)||OPS.onAct(act,v,e),
    beforeAdminNavigate(proceed){
      if(A.busy||unsaved()&&S.page===DT&&(A.drafts[A.selected]?.reason||'').trim()){CF.toast(L('Finish or cancel the current review first.','请先完成或取消当前审核办理。'));return;}
      remember();proceed();
    },
    allowNav:id=>[LIST,DT].includes(id)?allowed():OPS_PAGES.includes(id),
    breadcrumbRoute:id=>id===LIST?listRoute():null,
    onBeforeAct(act,v,e){
      if(act==='retry'||act==='clearfilter'){onAct(act,v);return true;}
      if(act==='closelayer'&&e?.type==='click'&&e.target.closest('[data-stop]'))return false;
      if(act==='closelayer'&&A.busy)return true;
      if(act==='closelayer'&&A.draft){onAct('ta-cancel','');return true;}
      return OPS.onBeforeAct(act,v,e);
    },
    beforeRender(){
      S.toTop=false;syncContext();
      const signed=signedIn();
      if(signed&&[LIST,DT].includes(S.page))lastHash=location.hash;
      if(!signed&&wasSigned){A.draft=null;A.busy=false;S.layer=null;if(onModule)returnHash=lastHash;}
      OPS.beforeRender();
      if(signed&&!wasSigned&&returnHash){location.hash=returnHash;returnHash='';}
      wasSigned=signed;onModule=[LIST,DT].includes(S.page);
      if(!allowed()&&S.layer?.key.startsWith('ta-')){S.layer=null;A.draft=null;A.busy=false;}
    },
    afterRender(){CF.opsOverviewData.publish('tokens',A.rows);OPS.afterRender();restoreView();},
    onRoute(prev,id){
      A.epoch++;A.busy=false;A.draft=null;A.error='';A.view='default';restoreContext=true;
      if(OPS_PAGES.includes(id)||OPS_PAGES.includes(prev))OPS.onRoute(prev,id);
    }
  });
  S.end='admin';S.role='ops';
  CF.opsAuth.seedDemo('admin');
  if(!location.hash.startsWith('#'+ROOT)){
    try{history.replaceState(null,'','#'+ROOT);}catch(error){location.hash='#'+ROOT;}
  }
  CF.boot();
})(window.CF);
