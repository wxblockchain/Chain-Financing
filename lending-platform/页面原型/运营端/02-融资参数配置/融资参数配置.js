/* 融资参数配置（运营端）：融资参数列表、参数详情与变更记录，参数维护以弹窗办理。
   配置对象是组合：区块链网络 + 代币类型；组合只随代币准入审核通过产生。
   会话与功能权限只读运营端账户与登录一处登记（CF.opsAuth）：
   PM-AL-19 融资参数查询、PM-AL-20 融资参数维护（须配套 PM-AL-19）。
   业务数据与异步反馈均为本地演示，不连接真实配置服务，也不投递任何站内信。 */
(function(CF){
  'use strict';
  const S=CF.S,L=CF.L,E=CF.esc,OPS=CF.opsAccountModule,$=id=>document.getElementById(id);
  const LIST='P-O-FC-01',DETAIL='P-O-FC-02';
  const ROOT='/ops/financing-parameters',R_DETAIL=ROOT+'/detail';
  const OPS_PAGES=['P-O-AL-01','P-O-AL-03','P-O-AL-04','P-O-AL-05','P-O-AL-06','P-O-AL-07'];
  const PAGES=[LIST,DETAIL];
  const SIZES=[20,50,100];
  /* 最长项目期限 3～12 整月；最高质押率大于 0、不超过 100%、最多两位小数，超出两位如实拒绝，不替用户取整。 */
  const TERM={min:3,max:12};
  const RATIO={max:100,decimals:2};

  const fDefault=()=>({q:'',net:'',status:''});
  const seed=CF.parameterSeed();
  const A={rows:seed.rows,justSaved:null,
    filter:fDefault(),edit:fDefault(),sort:'',dir:1,page:1,size:SIZES[0],
    selected:null,draft:null,step:'form',busy:false,error:'',errorAction:'',fieldErrors:{},validated:{},
    view:'default',logState:'default',logShown:CF.PAGE_SIZE,response:'success',epoch:0};
  let lastHash='',returnHash='',onModule=false,wasSigned=false,restoreContext=false;
  const positions=new Map();

  const txt=x=>Array.isArray(x)?L(x[0],x[1]):x;
  const time=t=>t?`<time class="fc-stamp" datetime="${new Date(t).toISOString()}">${E(CF.fmtStamp(t))}</time>`:'—';
  const ratioText=v=>v==null?'—':Number(v).toFixed(RATIO.decimals)+'%';
  const termText=v=>v==null?'—':v+' '+L(v===1?'month':'months','个月');
  const configured=r=>!!r&&r.maxRatio!=null&&r.maxTermMonths!=null;
  const rowOf=id=>A.rows.find(r=>r.id===id);
  const row=()=>rowOf(A.selected);
  const netName=r=>txt(r.network.name);
  const chainText=r=>L('Chain ID ','链 ID ')+r.network.chainId;
  const comboName=r=>netName(r)+' · '+r.tokenType;
  const statusTag=r=>configured(r)?CF.tag('ok',L('Configured','已配置')):CF.tag('warn',L('Not configured','未配置'));
  const networkValue=(r,withChain=false)=>`<span class="fc-network"><span class="fc-network-icon" aria-hidden="true">${CF.assetIconSvg(r.network.icon)||CF.ICON.globe}</span><span>${E(netName(r))}${withChain?`<span class="fc-meta mono">${E(chainText(r))}</span>`:''}</span></span>`;

  const boundsText=()=>L('over 0%, up to 100%, at most 2 decimal places','大于 0，最高 100%，最多两位小数');
  const termBoundsText=()=>L(TERM.min+' – '+TERM.max+' whole months',TERM.min+' ～ '+TERM.max+' 整月');

  const b=(en,zh,act,value='',cls='',disabled=false,title='')=>`<button type="button" class="btn ${cls}" data-act="fc-${act}" data-v="${E(value)}" ${title?`title="${E(title)}"`:''} ${disabled?'disabled':''}>${L(en,zh)}</button>`;
  const field=(label,html,extra='')=>`<div class="field"><label for="${(html.match(/id="([^"]+)/)||[])[1]||''}">${label}</label>${html}${extra}</div>`;
  const select=(id,value,options)=>`<select class="inp" id="${id}">${options.map(([v,label])=>`<option value="${E(v)}" ${String(v)===String(value)?'selected':''}>${E(label)}</option>`).join('')}</select>`;
  const kv=items=>`<div class="ops-facts-region"><dl class="fc-kv ops-facts">${items.map(([label,value])=>`<div><dt>${label}</dt><dd>${value==null?'—':value}</dd></div>`).join('')}</dl></div>`;
  const section=(en,zh,html,head='')=>`<section class="card fc-section"><div class="fc-section-head"><h2 class="fc-h2">${L(en,zh)}</h2>${head}</div>${html}</section>`;
  const error=()=>A.error?`<div class="fc-alert" role="alert"><p>${E(txt(A.error))}</p>${A.errorAction==='reload'?b('Reload the current values','重新取数','reload','','sm'):''}</div>`:'';

  /* ------------------------------------------------------------ 权限 */
  const signedIn=()=>!!CF.opsAuth&&CF.opsAuth.can(14);
  const canQuery=()=>!!CF.opsAuth&&CF.opsAuth.can(19);
  const canMaintain=()=>!!CF.opsAuth&&CF.opsAuth.can(19)&&CF.opsAuth.can(20);
  /* held 区分「未开通」与「已开通维护但缺配套查询」；只读，不改授权。 */
  const maintainOnly=()=>!!CF.opsAuth&&!CF.opsAuth.held(19)&&CF.opsAuth.held(20);
  const allowed=()=>S.end==='admin'&&signedIn()&&canQuery();

  function signedOut(){return CF.empty(L('Sign in to continue','请先完成运营登录'),
    L('Your session has ended. Sign in again to open the financing parameters.','登录已失效，请重新登录后查看融资参数配置。'),
    b('Sign in again','重新登录','sign-in','','primary'));}
  function noAccess(){return maintainOnly()
    ?CF.empty(L('Parameter access is incomplete','参数权限配置不完整'),
      L('This account can maintain financing parameters but cannot query them, so access is refused. Ask your platform provider to correct the delivered configuration.','该账号可维护融资参数，但未开通融资参数查询，本次访问已拒绝。请联系平台建设方修正交付配置。'),'')
    :CF.empty(L('No access to the financing parameters','无权访问融资参数配置'),
      L('The delivered configuration does not give this account the financing parameter permissions.','当前交付配置未为该账号开通融资参数相关权限。'),'');}
  function gate(){return !signedIn()?signedOut():!canQuery()?noAccess():'';}
  function deny(){
    A.error=['This action is unavailable with the current account or permissions.','当前账号或权限不允许此操作。'];
    A.errorAction='';A.busy=false;closeMaintain();CF.toast(txt(A.error));A.error='';
  }

  /* ------------------------------------------------------------ 路由 */
  function listParams(){
    const p=new URLSearchParams({...A.filter,page:String(A.page),size:String(A.size),sort:A.sort,dir:String(A.dir)});
    [...p].forEach(([k,v])=>{if(!v||(k==='dir'&&!A.sort))p.delete(k);});
    return p;
  }
  function listRoute(){const q=listParams().toString();return ROOT+(q?'?'+q:'');}
  function detailRoute(id){const p=listParams();p.set('id',id||'');return R_DETAIL+'?'+p;}
  function remember(){const el=document.activeElement;positions.set(location.hash,{y:window.scrollY,act:el?.dataset.act,value:el?.dataset.v});}
  function syncContext(){
    if(!PAGES.includes(S.page))return;
    if(!restoreContext)return;
    restoreContext=false;
    const p=new URLSearchParams(location.hash.split('?')[1]||'');
    const f=fDefault();
    ['q','net','status'].forEach(k=>{if(p.get(k)!=null)f[k]=p.get(k);});
    A.filter=f;A.edit={...f};
    A.sort=p.get('sort')==='type'?'type':'';
    A.dir=p.get('dir')==='-1'?-1:1;
    A.page=Math.max(1,Number(p.get('page'))||1);
    A.size=SIZES.includes(Number(p.get('size')))?Number(p.get('size')):SIZES[0];
    const id=p.get('id');
    if(id&&rowOf(id))A.selected=id;
  }
  function saveContext(){
    const next=S.page===DETAIL?detailRoute(A.selected):listRoute();
    if(location.hash!=='#'+next)try{history.replaceState(null,'','#'+next);}catch(error){}
  }
  function navigateRoute(route){
    if(location.hash==='#'+route)CF.render();else location.hash='#'+route;
  }
  function restoreView(){
    requestAnimationFrame(()=>{
      const saved=positions.get(location.hash);
      if(saved&&!S.layer){
        window.scrollTo(0,saved.y||0);
        const target=[...document.querySelectorAll('[data-act]')].find(el=>el.dataset.act===saved.act&&el.dataset.v===saved.value);
        if(target)target.focus({preventScroll:true});
      }
    });
  }

  /* ------------------------------------------------------------ 列表 */
  function title(t,sub){
    return `<div class="fc-title"><div><h1>${t}</h1>${sub?`<span class="fc-meta">${sub}</span>`:''}</div>${CF.tag('gray',L('Demonstration data','演示数据'))}</div>`;
  }
  function surface(opts){S.st=A.view;return CF.surface(Object.assign({
    deniedDesc:L('Contact the platform provider to check the delivered configuration.','请联系平台建设方核对交付配置。'),
    backTo:ROOT,backLabel:L('Back to the parameter list','返回融资参数列表'),skelRows:4},opts));}
  function scope(){
    const f=A.filter,q=f.q.trim().toLowerCase();
    return A.rows.filter(r=>(!q||r.tokenType.toLowerCase().includes(q))
      &&(!f.net||r.network.chainId===f.net)
      &&(!f.status||(f.status==='set'?configured(r):!configured(r))));
  }
  /* 默认按区块链网络、再按代币类型升序；点代币类型列头后按代币类型升降序。 */
  const byNetwork=(a,c)=>netName(a).localeCompare(netName(c))||Number(a.network.chainId)-Number(c.network.chainId);
  function sortRows(rows){
    return rows.slice().sort((a,c)=>A.sort==='type'
      ?a.tokenType.localeCompare(c.tokenType)*A.dir||byNetwork(a,c)
      :byNetwork(a,c)||a.tokenType.localeCompare(c.tokenType));
  }
  /* 可排序列头复用公共 .sortable：整格可点，方向箭头由公共样式显隐。 */
  function sortHead(key,en,zh){
    const on=A.sort===key,aria=on?(A.dir===1?'ascending':'descending'):'none';
    return `<th scope="col" class="sortable" aria-sort="${aria}"><button type="button" data-act="fc-sort" data-v="${key}">${L(en,zh)}<span class="ar" aria-hidden="true">${A.dir===1||!on?'↑':'↓'}</span></button></th>`;
  }
  function networks(){
    const seen=new Map();
    A.rows.slice().sort(byNetwork).forEach(r=>{if(!seen.has(r.network.chainId))seen.set(r.network.chainId,netName(r));});
    return [...seen];
  }
  function filters(){
    const f=A.edit;
    const statuses=[['',L('All','全部')],['set',L('Configured','已配置')],['unset',L('Not configured','未配置')]];
    return `<form id="fc-filter-form" class="fc-filter-wrap"><div class="filterbar ops-filterbar fc-filter-bar">${
      CF.opsFilterSelect('fc-f-net',L('Blockchain network','区块链网络'),[['',L('All','全部')],...networks()],f.net)}${
      CF.opsFilterSelect('fc-f-status',L('Configuration status','配置状态'),statuses,f.status)}${
      CF.filterSearch('fc-f-q',L('Search token types','搜索代币类型'),f.q,L('Token type','代币类型'),'ops-filter-query')}
      <div class="fb-acts">${b('Reset','重置','reset')}<button type="submit" class="btn primary">${L('Search','查询')}</button></div></div></form>`;
  }
  function pager(total){
    const pages=Math.max(1,Math.ceil(total/A.size));
    return `<div class="pager fc-pager"><span class="total">${L('Total','共')} ${total} ${L(total===1?'combination':'combinations','个组合')}</span><span class="fc-size">${field(L('Per page','每页'),select('fc-size',A.size,SIZES.map(n=>[n,String(n)])))}</span>${
      b('Previous','上一页','page',String(A.page-1),'sm',A.page===1)}<span>${A.page} / ${pages}</span>${
      b('Next','下一页','page',String(A.page+1),'sm',A.page===pages)}</div>`;
  }
  const noCombos=()=>CF.empty(L('No combinations yet','还没有组合'),
    L('A combination appears once a token passes token admission review.','组合随代币准入审核通过产生。'),'');
  function listPage(){
    const blocked=gate();
    const head=title(L('Financing parameters','融资参数配置'),'');
    if(blocked)return head+blocked;
    const state=A.view==='default'?null:A.view==='empty'?noCombos():surface({});
    const found=sortRows(scope());
    const pages=Math.max(1,Math.ceil(found.length/A.size));
    if(A.page>pages)A.page=pages;
    const rows=found.slice((A.page-1)*A.size,A.page*A.size);
    /* 未配置的组合须让运营一眼察觉：列表上方给出数量并可一键只看未配置。 */
    const unset=A.rows.filter(r=>!configured(r)).length;
    const cue=!state&&unset&&A.filter.status!=='unset'
      ?`<div class="fc-cue" role="status"><span>${L(unset+' combination'+(unset>1?'s are':' is')+' not configured and cannot be used to create a financing project yet.','有 '+unset+' 个组合尚未配置，暂不可用于创建融资项目。')}</span>${b('Show not configured only','只看未配置','only-unset','','sm')}</div>`:'';
    const actions=r=>`<a class="actlink" href="#${E(detailRoute(r.id))}" data-act="fc-view" data-v="${E(r.id)}" aria-label="${E(L('View ','查看')+comboName(r))}">${L('View','查看')}</a>`
      +(canMaintain()?`<button type="button" class="actlink" data-act="fc-edit" data-v="${E(r.id)}" aria-label="${E((configured(r)?L('Maintain ','维护'):L('Configure ','配置'))+comboName(r))}">${configured(r)?L('Maintain','维护'):L('Configure','配置')}</button>`:'');
    /* 还没有组合与筛选无匹配是两种结果，分别表达。 */
    const table=state||(!A.rows.length?noCombos()
      :!found.length
      ?CF.empty(L('No combinations match these filters','没有符合条件的组合'),
        L('Change the filters or reset them.','请调整筛选条件，或重置。'),
        b('Reset filters','重置筛选','reset'))
      :`<div class="tablewrap" tabindex="0" role="region" aria-label="${L('Financing parameter list','融资参数列表')}"><table class="tbl fc-table fc-list-table"><thead><tr>`
        +`<th scope="col">${L('Blockchain network','区块链网络')}</th>`
        +sortHead('type','Token type','代币类型')
        +`<th scope="col" class="fc-num">${L('Maximum pledge ratio','最高质押率')}</th><th scope="col" class="fc-num">${L('Maximum project term','最长项目期限')}</th>`
        +`<th scope="col">${L('Configuration status','配置状态')}</th><th scope="col" class="col-act">${L('Action','操作')}</th></tr></thead><tbody>`
        +rows.map(r=>`<tr class="${[configured(r)?'':'fc-row-unset',A.justSaved&&r.records[0]?.id===A.justSaved?'fc-row-new':''].join(' ').trim()}"><td><span class="fc-name">${networkValue(r)}</span></td><td><span class="fc-name">${E(r.tokenType)}</span></td><td class="fc-num">${E(ratioText(r.maxRatio))}</td><td class="fc-num">${E(termText(r.maxTermMonths))}</td><td>${statusTag(r)}</td><td class="col-act">${actions(r)}</td></tr>`).join('')
        +`</tbody></table></div>${pager(found.length)}`);
    return head+`<section class="card">${filters()}${cue}${table}</section>`;
  }

  /* ------------------------------------------------------------ 参数变更记录 */
  /* 变更前后同值时只给一个取值并标注未变，避免「70% → 70%」读成改过一次。 */
  const change=(before,after)=>before===after
    ?`<strong>${E(after)}</strong><span class="fc-meta">${L('unchanged','未变')}</span>`
    :`${E(before)} → <strong>${E(after)}</strong>`;
  function changeLog(r){
    const heading=`<h2 class="fc-h2" id="fc-log-title">${L('Parameter change history','参数变更记录')}</h2>`;
    let body;
    if(A.logState==='loading')body=`<p role="status">${L('Loading the change history…','正在加载参数变更记录…')}</p>`;
    else if(A.logState==='error')body=`<p class="fc-error" role="alert">${L('The change history could not be loaded.','参数变更记录读取失败。')}</p>${b('Retry','重试','log-retry')}`;
    else if(A.logState==='expired')body=`<p class="fc-error" role="alert">${L('Your session ended while the change history was loading.','读取参数变更记录时登录已失效。')}</p>${b('Sign in again','重新登录','sign-in','','primary')}`;
    else{
      const records=A.logState==='empty'?[]:r.records;
      const shown=records.slice(0,A.logShown);
      body=!records.length
        ?`<p class="fc-meta">${L('No parameter changes recorded yet.','尚无参数变更记录。')}</p>`
        :`<div class="tablewrap" tabindex="0" role="region" aria-label="${L('Parameter change history','参数变更记录')}"><table class="tbl fc-table fc-log-table"><thead><tr><th scope="col">${L('Occurred at','发生时间')}<span class="fc-meta">${E(S.tz||'UTC')}</span></th><th scope="col">${L('Operator','操作人')}</th><th scope="col" class="fc-num">${L('Maximum pledge ratio','最高质押率')}</th><th scope="col" class="fc-num">${L('Maximum project term','最长项目期限')}</th><th scope="col">${L('Result','本次结果')}</th></tr></thead><tbody>${
          shown.map(x=>`<tr${x.id===A.justSaved?' class="fc-row-new"':''}><td>${time(x.at)}${x.id===A.justSaved?CF.tag('accent',L('Just saved','本次保存')):''}</td><td>${E(x.by)}</td><td class="fc-num">${change(ratioText(x.before.ratio),ratioText(x.after.ratio))}</td><td class="fc-num">${change(termText(x.before.term),termText(x.after.term))}</td><td>${CF.tag('ok',L('Saved','保存成功'))}</td></tr>`).join('')
          }</tbody></table></div>`
          +(records.length>shown.length
            ?`<div class="loadmore">${b('Load more','加载更多','log-more')}<span class="tiny" role="status">${L('Showing '+shown.length+' of '+records.length,'已显示 '+shown.length+' / '+records.length+' 条')}</span></div>`
            :`<div class="loadmore done">${L('End of list','已到末尾')} · ${L(records.length+(records.length===1?' record':' records'),'共 '+records.length+' 条')}</div>`);
    }
    return `<section class="card fc-section" id="fc-log" tabindex="-1" aria-labelledby="fc-log-title">${heading}${body}</section>`;
  }

  /* ------------------------------------------------------------ 参数详情 */
  function detailPage(){
    const blocked=gate();
    if(blocked)return title(L('Parameter details','参数详情'),'')+blocked;
    const r=row();
    if(!r)return title(L('Parameter details','参数详情'),'')
      +CF.empty(L('Combination unavailable','组合不可用'),L('Open a combination from the parameter list.','请从融资参数列表中选择一个组合。'),b('Back to the parameter list','返回融资参数列表','back'));
    if(A.view!=='default')return title(E(r.tokenType),E(netName(r)))+surface({});
    const maintain=canMaintain()
      ?`<button type="button" class="btn primary" data-act="fc-edit" data-v="${E(r.id)}">${configured(r)?L('Maintain parameters','维护参数'):L('Configure parameters','配置参数')}</button>`:'';
    const current=section('Current parameters','当前参数',kv([
      [L('Blockchain network','区块链网络'),networkValue(r,true)],
      [L('Token type','代币类型'),`<span class="fc-name">${E(r.tokenType)}</span>`],
      [L('Maximum pledge ratio','最高质押率'),E(ratioText(r.maxRatio))],
      [L('Maximum project term','最长项目期限'),E(termText(r.maxTermMonths))],
      [L('Configuration status','配置状态'),statusTag(r)]
    ]),maintain);
    const unsetNote=configured(r)?'':CF.note('warn',L('Not configured. This combination cannot be used to create a financing project until both parameters are saved.','尚未配置，两项参数保存前该组合不可用于创建融资项目。'));
    return title(E(r.tokenType),`${E(netName(r))} · <span class="mono">${E(chainText(r))}</span>`)
      +`<div class="detail-stack fc-stack">${unsetNote}${current}${changeLog(r)}</div>`;
  }

  /* ------------------------------------------------------------ 参数维护弹窗 */
  /* 改动按取值比较：把 70 改写成 70.00 不算改动，避免为同一个值走一次确认。 */
  const sameRatio=(a,b)=>{const x=parseRatio(a),y=parseRatio(b);return x.code||y.code?String(a).trim()===String(b).trim():x.value===y.value;};
  const changed=key=>!!A.draft&&(key==='ratio'?!sameRatio(A.draft.ratio,A.draft.loadedRatio):A.draft.term!==A.draft.loadedTerm);
  const dirty=()=>changed('ratio')||changed('term');
  const draftRow=()=>A.draft&&rowOf(A.draft.id);
  function loadDraft(r){
    const ratio=r.maxRatio==null?'':Number(r.maxRatio).toFixed(RATIO.decimals),term=r.maxTermMonths==null?'':String(r.maxTermMonths);
    A.draft={id:r.id,ratio,term,loadedRatio:ratio,loadedTerm:term,wasConfigured:configured(r)};
    A.step='form';A.fieldErrors={};A.validated={};A.error='';A.errorAction='';
  }
  function openMaintain(id){
    const r=rowOf(id);
    if(!r||!canMaintain())return deny();
    loadDraft(r);CF.openLayer('modal','fc-maintain');
  }
  function closeMaintain(){
    A.draft=null;A.step='form';A.busy=false;A.fieldErrors={};
    if(S.layer?.key==='fc-maintain')CF.closeLayer();
  }
  /* 关闭弹窗（关闭按钮、Esc、遮罩、取消）：确认页先回到表单；有未提交内容先确认。 */
  function requestClose(){
    if(A.busy)return;
    if(A.step!=='form'){A.step='form';CF.render();return;}
    if(dirty()){A.step='discard';CF.render();return;}
    closeMaintain();
  }
  function parseRatio(raw){
    const s=String(raw==null?'':raw).trim().replace(/\s*%$/,'').trim();
    if(!s)return {code:'required'};
    if(/^-\s*\d+(\.\d+)?$/.test(s))return {code:'positive'};
    if(!/^\d+(\.\d+)?$/.test(s))return {code:'format'};
    const value=Number(s);
    if(value<=0)return {code:'positive'};
    if(value>RATIO.max)return {code:'max'};
    if((s.split('.')[1]||'').length>RATIO.decimals)return {code:'decimals'};
    return {value};
  }
  function parseTerm(raw){
    const s=String(raw==null?'':raw).trim();
    if(!s)return {code:'required'};
    if(!/^\d+$/.test(s))return {code:'format'};
    const value=Number(s);
    if(value<TERM.min||value>TERM.max)return {code:'range'};
    return {value};
  }
  /* 各类拒绝各有自己的说明，并都给出允许范围。 */
  function ratioMessage(code){
    const range=L(' Allowed: ',' 允许范围：')+boundsText()+L('.','。');
    if(code==='required')return L('Enter the maximum pledge ratio.','请填写最高质押率。')+range;
    if(code==='format')return L('Enter a number, for example 70 or 69.50.','请填写数字，例如 70 或 69.50。')+range;
    if(code==='positive')return L('The maximum pledge ratio must be greater than 0.','最高质押率须大于 0。')+range;
    if(code==='max')return L('The maximum pledge ratio cannot exceed 100%.','最高质押率不能超过 100%。')+range;
    return L('Use at most 2 decimal places; the value is not rounded for you.','最多保留两位小数，系统不会替你四舍五入。')+range;
  }
  function termMessage(code){
    const range=L(' Allowed: ',' 允许范围：')+termBoundsText()+L('.','。');
    if(code==='required')return L('Choose the maximum project term.','请选择最长项目期限。')+range;
    if(code==='format')return L('The maximum project term must be a whole number of months.','最长项目期限须为整数月。')+range;
    return L('The maximum project term is outside the allowed range.','最长项目期限超出允许范围。')+range;
  }
  function checkField(key){
    const res=key==='ratio'?parseRatio(A.draft.ratio):parseTerm(A.draft.term);
    A.validated[key]=A.draft[key];
    if(res.code)A.fieldErrors[key]=key==='ratio'?ratioMessage(res.code):termMessage(res.code);else delete A.fieldErrors[key];
    return res;
  }
  function validate(){
    A.fieldErrors={};A.validated={};
    const ratio=checkField('ratio'),term=checkField('term');
    return A.fieldErrors.ratio||A.fieldErrors.term?null:{ratio:ratio.value,term:term.value};
  }
  function fieldError(key){
    return `<p class="fc-error" id="fc-${key}-error"${A.fieldErrors[key]?' role="alert"':''}>${E(A.fieldErrors[key]||'')}</p>`;
  }
  const noChange=()=>txt(['Change at least one parameter before saving.','两项参数均未改动，无需保存。']);
  /* 失焦即校验并就地更新该项，不重绘弹窗，避免打断键盘焦点。 */
  function paintField(key){
    const el=$('fc-'+key),slot=$('fc-'+key+'-error'),mark=$('fc-'+key+'-changed');
    if(el)el.setAttribute('aria-invalid',String(!!A.fieldErrors[key]));
    if(slot){slot.textContent=A.fieldErrors[key]||'';if(A.fieldErrors[key])slot.setAttribute('role','alert');else slot.removeAttribute('role');}
    if(mark)mark.hidden=!changed(key);
    const save=$('fc-save');
    if(save){save.disabled=A.busy||!dirty();save.title=dirty()?'':noChange();}
  }
  const subject=r=>`<dl class="fc-subject"><div><dt>${L('Blockchain network','区块链网络')}</dt><dd>${networkValue(r,true)}</dd></div><div><dt>${L('Token type','代币类型')}</dt><dd class="mono">${E(r.tokenType)}</dd></div></dl>`;
  function formStep(r){
    const d=A.draft;
    const mark=key=>`<span class="tag accent fc-changed" id="fc-${key}-changed" ${changed(key)?'':'hidden'}><span class="dot"></span>${L('Changed','已修改')}</span>`;
    const terms=[['',L('Choose…','请选择')],...Array.from({length:TERM.max-TERM.min+1},(_,i)=>{const n=TERM.min+i;return [String(n),termText(n)];})];
    const html=`<div class="fc-modal">${error()}${subject(r)}<form id="fc-form" class="fc-form" novalidate><fieldset ${A.busy?'disabled':''}>
        <div class="field"><div class="fc-label"><label for="fc-ratio">${CF.fieldLabel(L('Maximum pledge ratio','最高质押率'),true)}</label>${mark('ratio')}</div>
          <div class="fc-affix"><input class="inp" aria-required="true" id="fc-ratio" type="text" value="${E(d.ratio)}" inputmode="decimal" autocomplete="off" placeholder="${L('e.g. 70.00','如 70.00')}" aria-describedby="fc-ratio-hint fc-ratio-error" aria-invalid="${!!A.fieldErrors.ratio}"><span aria-hidden="true">%</span></div>
          <span class="fc-meta" id="fc-ratio-hint">${boundsText()}</span>${fieldError('ratio')}</div>
        <div class="field"><div class="fc-label"><label for="fc-term">${CF.fieldLabel(L('Maximum project term','最长项目期限'),true)}</label>${mark('term')}</div>
          ${select('fc-term',d.term,terms).replace('<select class="inp"','<select class="inp" aria-required="true" aria-describedby="fc-term-hint fc-term-error" aria-invalid="'+(!!A.fieldErrors.term)+'"')}
          <span class="fc-meta" id="fc-term-hint">${termBoundsText()}</span>${fieldError('term')}</div>
      </fieldset></form></div>`;
    return {title:configured(r)?L('Maintain parameters','维护参数'):L('Configure parameters','配置参数'),dismiss:!A.busy,html,
      foot:(A.busy?`<span class="fc-busy" role="status">${L('Submitting…','正在提交…')}</span>`:'')
        +b('Cancel','取消','cancel','','',A.busy)
        +`<button type="submit" form="fc-form" class="btn primary" id="fc-save" ${A.busy||!dirty()?'disabled':''} title="${dirty()?'':E(noChange())}">${L('Save','保存')}</button>`};
  }
  function diffRow(label,before,after){
    if(before===after)return `<div class="fc-diff-row fc-diff-same"><b>${label}</b><div class="fc-diff-vals"><strong>${E(after)}</strong><span class="fc-meta">${L('unchanged','未变')}</span></div></div>`;
    return `<div class="fc-diff-row"><b>${label}</b><div class="fc-diff-vals"><span class="fc-before"><span class="sr-only">${L('Before this save: ','变更前：')}</span>${E(before)}</span><span class="fc-arrow" aria-hidden="true">→</span><strong><span class="sr-only">${L('After this save: ','本次保存后：')}</span>${E(after)}</strong></div></div>`;
  }
  function confirmStep(r){
    const d=A.draft,next=d.pending;
    return {title:L('Confirm the save','确认保存'),
      html:`<div class="fc-modal">${subject(r)}
        <div class="fc-diff">${diffRow(L('Maximum pledge ratio','最高质押率'),ratioText(r.maxRatio),ratioText(next.ratio))}${diffRow(L('Maximum project term','最长项目期限'),termText(r.maxTermMonths),termText(next.term))}</div>
        <ul class="fc-effects"><li>${L('Applies only to financing projects created after this save; existing projects are not changed.','仅对此后新建项目生效，不改变存量项目。')}</li>${
          d.wasConfigured?'':`<li>${L('Once saved, this combination can be used to create financing projects.','保存后即可用于创建融资项目。')}</li>`}</ul></div>`,
      foot:(A.busy?`<span class="fc-busy" role="status">${L('Submitting…','正在提交…')}</span>`:'')
        +b('Back','返回修改','edit-back','','',A.busy)+b('Confirm the save','确认保存','submit','','primary',A.busy)};
  }
  const layers={
    'fc-maintain':()=>{
      const r=draftRow();
      if(!r)return {title:L('Maintain parameters','维护参数'),html:'',foot:b('Close','关闭','close')};
      if(A.step==='confirm'&&A.draft.pending)return confirmStep(r);
      if(A.step==='discard')return {title:L('Discard unsaved input?','放弃未提交内容？'),
        html:`<p>${L('The parameters you typed have not been saved. Closing now discards them; the saved parameters do not change.','填写的参数尚未保存，关闭后将放弃本次输入，已保存的参数不变。')}</p>`,
        foot:b('Keep editing','继续编辑','keep')+b('Discard','放弃内容','discard','','primary')};
      if(A.step==='discard-reload')return {title:L('Reload and discard your input?','重新取数并放弃输入？'),
        html:`<p>${L('Reloading replaces the form with the currently saved parameters and discards what you typed.','重新取数将用当前已保存的参数替换表单内容，本次输入将被放弃。')}</p>`,
        foot:b('Keep editing','继续编辑','keep')+b('Reload','重新取数','confirm-reload','','primary')};
      return formStep(r);
    }
  };
  function startSave(){
    const r=draftRow();
    if(!canMaintain()||!r)return deny();
    const next=validate();
    if(!next){CF.render();$(A.fieldErrors.ratio?'fc-ratio':'fc-term')?.focus();return;}
    if(!dirty())return;
    A.draft.pending=next;A.error='';A.errorAction='';A.step='confirm';
    CF.render();
  }
  function record(r,before,after){
    r.records.unshift({id:'fc-'+Date.now(),at:Date.now(),by:CF.opsAuth.getIdentity().email.replace(/^(.{2}).*(@.*)$/,'$1***$2'),
      before,after,result:'success'});
  }
  function backToForm(message,action){
    A.step='form';A.error=message;A.errorAction=action||'';CF.render();
  }
  function submit(){
    const r=draftRow(),d=A.draft;
    if(A.busy)return;
    if(!d||!d.pending||!r)return deny();
    if(!canMaintain())return deny();
    A.busy=true;A.error='';A.errorAction='';CF.render();
    const epoch=A.epoch,response=A.response,next=d.pending;
    setTimeout(()=>{
      if(epoch!==A.epoch||A.draft!==d)return;
      A.busy=false;
      if(!canMaintain())return deny();
      if(response==='fail')return backToForm(['The save did not complete. Both parameters keep their current values and your input has been kept.','保存未完成，两项参数均保持原值，已保留输入，可重试。']);
      if(response==='unknown')return backToForm(['The result of this submission is unknown. Reload the current values to check before submitting again.','本次提交结果未知，请先重新取数核对当前值，确认前不要重复提交。'],'reload');
      if(response==='concurrent'){
        /* 他人先行修改：本次基于旧值的提交被拒，对方的保存正常留痕。 */
        const before={ratio:r.maxRatio,term:r.maxTermMonths};
        r.maxRatio=r.maxRatio===68.5?66:68.5;
        r.maxTermMonths=r.maxTermMonths===TERM.max?TERM.max-3:TERM.max;
        r.records.unshift({id:'fc-other-'+Date.now(),at:Date.now(),by:'ch***@example.com',
          before,after:{ratio:r.maxRatio,term:r.maxTermMonths},result:'success'});
        return backToForm(['Another operator saved this combination first, so your submission was refused. Reload the current values before editing again.','该组合的参数已被他人先行修改，本次提交已被拒绝。请重新取数后再修改。'],'reload');
      }
      if(response==='expired'){
        /* 提交时登录已失效：拒绝保存，参数不变、不留痕，按账户状态引导。 */
        closeMaintain();OPS.onAct('ops-session-expire');CF.render();return;
      }
      /* 保存成功：两项参数整体采用新值，留下一条变更记录，关闭弹窗回到发起位置。 */
      const before={ratio:r.maxRatio,term:r.maxTermMonths};
      r.maxRatio=next.ratio;r.maxTermMonths=next.term;
      record(r,before,{ratio:next.ratio,term:next.term});
      A.justSaved=r.records[0].id;A.logShown=CF.PAGE_SIZE;
      closeMaintain();
      CF.toast(L('Parameters saved. They apply to financing projects created from now on.','参数已保存，对此后新建的融资项目生效。'));
    },650);
  }

  /* ------------------------------------------------------------ 演示工具 */
  function grant(mode){
    if(!CF.opsAuth)return;
    CF.opsAuth.seedDemo(mode==='admin'?'admin':'specialist');
    if(mode==='query')OPS.onAct('ops-grant','19');
    if(mode==='maintain')OPS.onAct('ops-grant','20');
    A.epoch++;A.draft=null;A.busy=false;A.error='';A.errorAction='';S.layer=null;
  }
  function demo(){
    if(OPS_PAGES.includes(S.page))return OPS.demo();
    const added=!!rowOf(CF.parameterNewComboId);
    return `<h3>${L('Financing parameters · demo tools','融资参数配置 · 演示工具')}</h3><p class="fc-meta">${L('Local demonstration only. No configuration service is contacted and this module sends no message of any kind.','仅本地演示：不连接真实配置服务；本模块不产生任何站内信、邮件或推送。')}</p>
      <h4>${L('Delivered account configuration','交付的账号配置')}</h4><div class="fc-demo-actions">${b('Administrator','运营管理员','grant','admin')}${b('Query only','仅开通参数查询','grant','query')}${b('Misconfigured · maintenance only','配置异常 · 只开通维护','grant','maintain')}${b('Misconfigured · no module permission','配置异常 · 无本模块权限项','grant','none')}</div>
      <div class="fc-demo">${field(L('Page state','页面状态'),select('fc-view',A.view,[['default',L('Default','默认')],['loading',L('Loading','加载中')],['empty',L('Empty · no combinations','空数据 · 还没有组合')],['error',L('Load failed','读取失败')]]))}${
        field(L('Change history state','参数变更记录状态'),select('fc-log-state',A.logState,[['default',L('Default','默认')],['loading',L('Loading','加载中')],['empty',L('No records','尚无记录')],['error',L('Load failed','读取失败')],['expired',L('Session expired','登录失效')]]))}${
        field(L('Save response','保存反馈'),select('fc-response',A.response,[['success',L('Success','成功')],['fail',L('Failure','失败')],['unknown',L('Result unknown','结果未知')],['concurrent',L('Another operator saved first','已被他人先行修改')],['expired',L('Session expired at submit','提交时登录已失效')]]))}</div>
      <h4>${L('Token admission review','代币准入审核')}</h4><div class="fc-demo-actions">${b('A token passes admission · new combination','代币准入通过 · 产生新组合','add-combo','','',added)}${
        b('Restore the default combinations','恢复默认组合','restore-combos')}</div>
      <h4>${L('Session','会话')}</h4><div class="fc-demo-actions">${b('Expire the operations session','运营登录失效','expire-session')}${b('Reset demonstration','重置演示','restart')}</div>`;
  }

  /* ------------------------------------------------------------ 动作 */
  function resetFilter(){
    A.filter=fDefault();A.edit=fDefault();A.page=1;A.error='';A.errorAction='';A.view='default';
    if(S.page===LIST)saveContext();
    CF.render();
  }
  function reload(){
    const r=draftRow();
    if(!r)return;
    loadDraft(r);CF.render();CF.toast(L('The current values have been reloaded.','已重新取数。'));
  }
  function onAct(act,v,e){
    if(e&&(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)&&act==='fc-view')return false;
    if(!act.startsWith('fc-')){
      if(act==='retry'){A.view='default';A.error='';A.errorAction='';CF.render();return true;}
      if(act==='clearfilter'){resetFilter();return true;}
      return false;
    }
    act=act.slice(3);
    if(A.busy)return true;
    if(act==='view'){A.selected=v;remember();navigateRoute(detailRoute(v));}
    else if(act==='edit')openMaintain(v);
    else if(act==='back'){remember();navigateRoute(listRoute());}
    else if(act==='sign-in'){S.layer=null;location.hash='#/ops/login';}
    else if(act==='page'){A.page=Math.max(1,Number(v));saveContext();CF.render();window.scrollTo(0,0);}
    else if(act==='search'){A.filter={...A.edit};A.page=1;A.error='';A.view='default';saveContext();CF.render();}
    else if(act==='reset')resetFilter();
    else if(act==='only-unset'){A.filter={...A.filter,status:'unset'};A.edit={...A.filter};A.page=1;saveContext();CF.render();}
    else if(act==='sort'){A.dir=A.sort===v?-A.dir:1;A.sort=v;A.page=1;saveContext();CF.render();}
    else if(act==='log-more'){A.logShown+=CF.PAGE_SIZE;CF.render();}
    else if(act==='log-retry'){A.logState='default';CF.render();$('fc-log')?.focus({preventScroll:true});}
    else if(act==='save')startSave();
    else if(act==='submit')submit();
    else if(act==='edit-back'||act==='keep'){A.step='form';CF.render();}
    else if(act==='cancel')requestClose();
    else if(act==='close')closeMaintain();
    else if(act==='reload'){if(dirty()){A.step='discard-reload';CF.render();}else reload();}
    else if(act==='confirm-reload')reload();
    else if(act==='discard')closeMaintain();
    else if(act==='grant'){grant(v);S.demo=false;window.scrollTo(0,0);navigateRoute(S.page===LIST?listRoute():detailRoute(A.selected));}
    else if(act==='expire-session'){closeMaintain();S.demo=false;OPS.onAct('ops-session-expire');CF.render();}
    else if(act==='add-combo'){
      if(!rowOf(CF.parameterNewComboId))A.rows.push(CF.parameterNewCombo());
      CF.render();
    }
    else if(act==='restart'||act==='restore-combos'){
      const fresh=CF.parameterSeed();
      A.epoch++;A.rows=fresh.rows;A.draft=null;A.busy=false;A.error='';A.errorAction='';A.fieldErrors={};
      A.logShown=CF.PAGE_SIZE;A.logState='default';A.view='default';A.justSaved=null;
      if(act==='restart'){A.response='success';grant('admin');}
      A.selected=A.rows[0].id;resetFilter();navigateRoute(listRoute());
    }
    else return false;
    return true;
  }
  /* 输入中只清除过期的错误，失焦或选定后再按该项重新校验；
     提交时浏览器会对被重绘移除的输入补发 change，取值未变时不抹掉刚给出的校验结果。 */
  function onInput(e,settle){
    if(A.busy||!A.draft||A.step!=='form')return;
    const id=e.target.id,key=id==='fc-ratio'?'ratio':id==='fc-term'?'term':null;
    if(!key)return;
    A.draft[key]=e.target.value;
    if(settle){if(A.draft[key]!==A.validated[key]&&(A.draft[key].trim()||A.fieldErrors[key]))checkField(key);}
    else if(A.fieldErrors[key]&&A.draft[key]!==A.validated[key])delete A.fieldErrors[key];
    paintField(key);
  }
  document.addEventListener('submit',e=>{
    if(e.target.id==='fc-filter-form'){e.preventDefault();onAct('fc-search','');}
    if(e.target.id==='fc-form'){e.preventDefault();if(!A.busy)onAct('fc-save','');}
  });
  document.addEventListener('input',e=>{
    if(e.target.id==='fc-f-q')A.edit.q=e.target.value;
    if(e.target.id==='fc-ratio')onInput(e,false);
  });
  document.addEventListener('focusout',e=>{if(e.target.id==='fc-ratio'&&e.target.isConnected)onInput(e,true);});
  document.addEventListener('change',e=>{
    const id=e.target.id,value=e.target.value;
    if(id==='fc-f-net'){A.edit.net=value;return;}
    if(id==='fc-f-status'){A.edit.status=value;return;}
    if(id==='fc-size'){A.size=Number(value);A.page=1;saveContext();CF.render();return;}
    if(id==='fc-view'){A.view=value;A.error='';CF.render();return;}
    if(id==='fc-log-state'){A.logState=value;A.logShown=CF.PAGE_SIZE;CF.render();return;}
    if(id==='fc-response'){A.response=value;return;}
    if(id==='fc-term')onInput(e,true);
  });
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href^="#"]');
    if(!a||a.hasAttribute('data-act')||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
    remember();
  },true);

  /* ------------------------------------------------------------ 评审目录 */
  const DENIED={id:'denied',label:['No access','无权限'],group:'business'};
  const UNSET={id:'unset',label:['Not configured','未配置'],group:'business'};
  const MAINTAIN={id:'maintain',label:['Maintenance dialog','维护弹窗'],group:'business'};
  const firstUnset=()=>A.rows.find(r=>!configured(r));
  [[LIST,['Financing parameter list','融资参数列表'],['default','loading','empty','noresult','error',DENIED]],
   [DETAIL,['Parameter details','参数详情'],['default','loading','error',UNSET,MAINTAIN,DENIED]]].forEach(([id,label,states])=>{
    CF.review.register(id,{
      group:['Financing parameters','融资参数配置'],label,states,
      route:()=>{
        if(id===LIST)return ROOT;
        const target=A.selected&&rowOf(A.selected)?A.selected:(A.rows[0]||{}).id;
        if(!target)return null;
        A.selected=target;
        return detailRoute(target);
      },
      get:()=>!canQuery()?'denied':S.layer?.key==='fc-maintain'?'maintain':(id===DETAIL&&!configured(row())?'unset':A.view),
      set(value){
        if(value==='denied'){grant('none');A.view='default';S.st='default';return;}
        if(!canQuery())grant('admin');
        if(value==='unset'){
          if(!firstUnset())A.rows.push(CF.parameterNewCombo());
          A.selected=firstUnset().id;A.view='default';S.st='default';
          navigateRoute(detailRoute(A.selected));
          return;
        }
        if(value==='maintain'){
          A.view='default';S.st='default';S.demo=false;
          if(row())openMaintain(A.selected);
          return;
        }
        A.view=value;S.st=value;
      },
      reset(){
        if(!canQuery())grant('admin');
        A.view='default';S.st='default';A.logState='default';A.response='success';A.error='';A.errorAction='';
      },
      beforeChange(proceed){CF.AdminMenu.beforeLeave(proceed);}
    });
  });

  const dict={
    en:{...OPS.dict.en,navFinancingParameters:'Financing parameters',navParameterDetail:'Parameter details'},
    zh:{...OPS.dict.zh,navFinancingParameters:'融资参数配置',navParameterDetail:'参数详情'}
  };
  CF.define({...OPS,id:'financing-parameters',demoOnly:true,reviewToolsInLayer:false,dict,demo,
    content:page=>{
      if(OPS_PAGES.includes(page))return OPS.content(page);
      return page===DETAIL?detailPage():listPage();
    },
    layers:{...OPS.layers,...layers},
    onAct:(act,v,e)=>onAct(act,v,e)||OPS.onAct(act,v,e),
    beforeAdminNavigate(proceed){
      if(A.busy){CF.toast(L('Wait for the current submission to finish.','请等待本次提交完成。'));return;}
      remember();proceed();
    },
    allowNav:id=>PAGES.includes(id)?allowed():OPS_PAGES.includes(id),
    breadcrumbRoute:id=>id===LIST?listRoute():id===DETAIL?detailRoute(A.selected):null,
    onBeforeAct(act,v,e){
      if(act==='retry'||act==='clearfilter'){onAct(act,v);return true;}
      if(act==='closelayer'&&S.layer?.key==='fc-maintain'){
        /* 点在弹窗内部时冒泡到的是遮罩，交回共享层忽略；真正的关闭按钮、遮罩与 Esc 走关闭确认。 */
        const el=e&&e.target&&e.target.closest?e.target.closest('[data-act]'):null;
        if(e&&e.type==='click'&&el&&el.classList.contains('modal-mask')&&e.target.closest('[data-stop]'))return false;
        requestClose();return true;
      }
      return OPS.onBeforeAct(act,v,e);
    },
    beforeRender(){
      S.toTop=false;syncContext();
      const signed=signedIn();
      if(signed&&PAGES.includes(S.page))lastHash=location.hash;
      if(!signed&&wasSigned){A.draft=null;A.busy=false;S.layer=null;if(onModule)returnHash=lastHash;}
      OPS.beforeRender();
      if(signed&&!wasSigned&&returnHash){location.hash=returnHash;returnHash='';}
      wasSigned=signed;onModule=PAGES.includes(S.page);
      if((!allowed()||!canMaintain())&&S.layer?.key==='fc-maintain'){S.layer=null;A.draft=null;A.busy=false;}
    },
    afterRender(){OPS.afterRender();restoreView();},
    onRoute(prev,id){
      A.epoch++;A.busy=false;A.error='';A.errorAction='';A.fieldErrors={};A.view='default';
      A.logShown=CF.PAGE_SIZE;restoreContext=true;
      if(prev!==id)A.justSaved=null;
      if(S.layer?.key==='fc-maintain'){S.layer=null;A.draft=null;}
      if(OPS_PAGES.includes(id)||OPS_PAGES.includes(prev))OPS.onRoute(prev,id);
    }
  });
  S.end='admin';S.role='ops';
  A.selected=A.rows[0].id;
  CF.opsAuth.seedDemo('admin');
  if(!location.hash.startsWith('#'+ROOT)){
    try{history.replaceState(null,'','#'+ROOT);}catch(error){location.hash='#'+ROOT;}
  }
  CF.boot();
})(window.CF);
