/* WS-388 · 融资参数配置（运营端）：融资参数列表、代币类型参数详情、参数维护。
   会话与功能权限只读运营端账户与登录一处登记（CF.opsAuth）：
   PM-AL-19 融资参数查询、PM-AL-20 融资参数维护（须配套 PM-AL-19）。
   业务数据与异步反馈均为本地演示，不连接真实配置服务，也不投递任何站内信。 */
(function(CF){
  'use strict';
  const S=CF.S,L=CF.L,E=CF.esc,OPS=CF.opsAccountModule,$=id=>document.getElementById(id);
  const LIST='P-O-FC-01',DETAIL='P-O-FC-02',EDIT='P-O-FC-03';
  const ROOT='/ops/financing-parameters',R_DETAIL=ROOT+'/detail',R_EDIT=ROOT+'/edit';
  const OPS_PAGES=['P-O-AL-01','P-O-AL-03','P-O-AL-04','P-O-AL-05','P-O-AL-06','P-O-AL-07'];
  const PAGES=[LIST,DETAIL,EDIT];
  const SIZES=[20,50,100];
  /* 最长项目期限的 3 个月～1 年由面客侧项目期限规则确认，配置值不得越出该区间。 */
  const TERM={min:3,max:12};

  const fDefault=()=>({q:'',status:''});
  const seed=CF.parameterSeed();
  const A={rows:seed.rows,bounds:CF.parameterBounds[0],
    filter:fDefault(),edit:fDefault(),sort:'name',dir:1,page:1,size:SIZES[0],
    selected:null,draft:null,busy:false,error:'',errorAction:'',fieldErrors:{},validated:{},
    view:'default',logState:'default',logShown:CF.PAGE_SIZE,response:'success',epoch:0};
  let lastHash='',returnHash='',onModule=false,wasSigned=false,restoreContext=false,pendingRoute;
  const positions=new Map();

  const txt=x=>Array.isArray(x)?L(x[0],x[1]):x;
  const time=t=>t?CF.fmtTime(t):'—';
  const ratioText=v=>v==null?'—':String(v)+'%';
  const termText=v=>v==null?'—':v+' '+L(v===1?'month':'months','个月');
  const person=v=>v||'—';
  const configured=r=>!!r&&r.maxRatio!=null&&r.maxTermMonths!=null;
  const rowOf=id=>A.rows.find(r=>r.id===id);
  const row=()=>rowOf(A.selected);
  const live=()=>A.rows.filter(r=>!r.removed);
  const statusTag=r=>configured(r)?CF.tag('ok',L('Configured','已配置')):CF.tag('warn',L('Not configured','未配置'));

  const boundsText=()=>{const b=A.bounds;
    return L(b.min+'% – '+b.max+'%, '+(b.decimals?'up to '+b.decimals+' decimal place'+(b.decimals>1?'s':''):'whole numbers'),
      b.min+'% ～ '+b.max+'%，'+(b.decimals?'最多 '+b.decimals+' 位小数':'整数'));};
  const termBoundsText=()=>L(TERM.min+' – '+TERM.max+' whole months',TERM.min+' ～ '+TERM.max+' 的整数月');

  const b=(en,zh,act,value='',cls='',disabled=false,title='')=>`<button type="button" class="btn ${cls}" data-act="fc-${act}" data-v="${E(value)}" ${title?`title="${E(title)}"`:''} ${disabled?'disabled':''}>${L(en,zh)}</button>`;
  const field=(label,html,extra='')=>`<div class="field"><label for="${(html.match(/id="([^"]+)/)||[])[1]||''}">${label}</label>${html}${extra}</div>`;
  const input=(id,v,type='text',attrs='')=>`<input class="inp" id="${id}" type="${type}" value="${E(v)}" ${attrs}>`;
  const select=(id,value,options)=>`<select class="inp" id="${id}">${options.map(([v,label])=>`<option value="${E(v)}" ${String(v)===String(value)?'selected':''}>${E(label)}</option>`).join('')}</select>`;
  const kv=items=>`<dl class="fc-kv">${items.map(([label,value,cls])=>`<div${cls==='wide'?' class="fc-wide"':''}><dt>${label}</dt><dd${cls==='strong'?' class="fc-strong"':''}>${value==null?'—':value}</dd></div>`).join('')}</dl>`;
  const section=(en,zh,html,head='')=>`<section class="card fc-section"><div class="fc-section-head"><h2 class="fc-h2">${L(en,zh)}</h2>${head}</div>${html}</section>`;
  const error=()=>A.error?`<p class="fc-error" role="alert">${E(txt(A.error))}${A.errorAction==='reload'?' ':''}</p>${A.errorAction==='reload'?b('Reload the current values','重新取数','reload'):''}${A.errorAction==='back'?b('Back to the parameter list','返回融资参数列表','back'):''}`:'';

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
    A.error=['This action is unavailable with the current account, permissions or token type.','当前账号、权限或代币类型不允许此操作。'];
    A.errorAction='';A.busy=false;S.layer=null;CF.render();CF.toast(txt(A.error));
  }
  function openLayer(key){CF.openLayer('modal','fc-'+key);}

  /* ------------------------------------------------------------ 路由 */
  function listParams(){
    const p=new URLSearchParams({...A.filter,page:String(A.page),size:String(A.size),sort:A.sort,dir:String(A.dir)});
    [...p].forEach(([k,v])=>{if(!v)p.delete(k);});
    return p;
  }
  function listRoute(){const q=listParams().toString();return ROOT+(q?'?'+q:'');}
  function tokenRoute(base,id){const p=listParams();p.set('token',id||'');return base+'?'+p;}
  const detailRoute=id=>tokenRoute(R_DETAIL,id);
  const editRoute=id=>tokenRoute(R_EDIT,id);
  function remember(){const el=document.activeElement;positions.set(location.hash,{y:window.scrollY,act:el?.dataset.act,value:el?.dataset.v});}
  function syncContext(){
    if(!PAGES.includes(S.page))return;
    if(!restoreContext)return;
    restoreContext=false;
    const p=new URLSearchParams(location.hash.split('?')[1]||'');
    const f=fDefault();
    ['q','status'].forEach(k=>{if(p.get(k)!=null)f[k]=p.get(k);});
    A.filter=f;A.edit={...f};
    A.sort=p.get('sort')==='updatedAt'?'updatedAt':'name';
    A.dir=p.get('dir')==='-1'?-1:1;
    A.page=Math.max(1,Number(p.get('page'))||1);
    A.size=SIZES.includes(Number(p.get('size')))?Number(p.get('size')):SIZES[0];
    const token=p.get('token');
    if(token&&rowOf(token))A.selected=token;
  }
  function saveContext(){
    const next=S.page===EDIT?editRoute(A.selected):S.page===DETAIL?detailRoute(A.selected):listRoute();
    if(location.hash!=='#'+next)try{history.replaceState(null,'','#'+next);}catch(error){}
  }
  function navigateRoute(route){
    if(location.hash==='#'+route)CF.render();else location.hash='#'+route;
  }
  function leave(target){
    if(dirty()){pendingRoute=target;openLayer('discard');return;}
    A.draft=null;remember();navigateRoute(target);
  }
  function restoreView(){
    requestAnimationFrame(()=>{
      const saved=positions.get(location.hash);
      if(saved){
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
    return live().filter(r=>(!q||r.name.toLowerCase().includes(q))
      &&(!f.status||(f.status==='set'?configured(r):!configured(r))));
  }
  function sortRows(rows){
    return rows.slice().sort((a,c)=>{
      if(A.sort==='updatedAt')return ((a.updatedAt||0)-(c.updatedAt||0))*A.dir||a.name.localeCompare(c.name);
      return a.name.localeCompare(c.name)*A.dir;
    });
  }
  /* 可排序列头复用公共 .sortable：整格可点，方向箭头由公共样式显隐。 */
  function sortHead(key,en,zh){
    const on=A.sort===key,aria=on?(A.dir===1?'ascending':'descending'):'none';
    return `<th scope="col" class="sortable" aria-sort="${aria}"><button type="button" data-act="fc-sort" data-v="${key}">${L(en,zh)}<span class="ar" aria-hidden="true">${A.dir===1?'↑':'↓'}</span></button></th>`;
  }
  function filters(){
    const f=A.edit,applied=A.filter;
    const statuses=[['',L('All','全部')],['set',L('Configured','已配置')],['unset',L('Not configured','未配置')]];
    const tags=[];
    if(applied.q)tags.push(CF.tag('gray',L('Keyword','关键词')+': '+applied.q));
    if(applied.status)tags.push(CF.tag('gray',L('Configuration status','配置状态')+': '+(applied.status==='set'?L('Configured','已配置'):L('Not configured','未配置'))));
    return `<form id="fc-filter-form" class="fc-filter-wrap"><div class="fc-filter-bar">${
      field(L('Search token types','搜索代币类型'),`<input class="inp" id="fc-f-q" value="${E(f.q)}" placeholder="${L('Token type name','代币类型名称')}">`)}${
      field(L('Configuration status','配置状态'),select('fc-f-status',f.status,statuses))}<div class="fc-actions">${
      b('Reset','重置','reset')}<button type="submit" class="btn primary">${L('Search','查询')}</button></div></div>${
      tags.length?`<div class="fc-applied" aria-label="${L('Applied filters','已应用筛选')}">${tags.join('')}</div>`:''}</form>`;
  }
  function pager(total){
    const pages=Math.max(1,Math.ceil(total/A.size));
    return `<div class="pager"><span class="total">${L('Total','共')} ${total} ${L(total===1?'token type':'token types','个代币类型')}</span>${
      b('Previous','上一页','page',String(A.page-1),'sm',A.page===1)}<span>${A.page} / ${pages}</span>${
      b('Next','下一页','page',String(A.page+1),'sm',A.page===pages)}</div>`;
  }
  function listPage(){
    const blocked=gate();
    const head=title(L('Financing parameters','融资参数配置'),
      L('One row is one token type. Token types are supplied upstream by token issuance and synchronisation; a token type that is not configured cannot be used to create a financing project.','一行对应一个代币类型。代币类型由代币发行与同步提供；未配置的代币类型暂不可用于创建融资项目。'));
    if(blocked)return head+blocked;
    const state=A.view==='default'?null:surface({
      emptyTitle:L('No token types yet','暂无代币类型'),
      emptyDesc:L('Token types are provided by token issuance and synchronisation. They appear here once the upstream supplies them.','代币类型由代币发行与同步提供，上游供给后将出现在此。')});
    const found=sortRows(scope());
    const pages=Math.max(1,Math.ceil(found.length/A.size));
    if(A.page>pages)A.page=pages;
    const rows=found.slice((A.page-1)*A.size,A.page*A.size);
    /* 上游暂无代币类型与筛选无匹配是两种结果，分别表达。 */
    const table=state||(!live().length
      ?CF.empty(L('No token types yet','暂无代币类型'),
        L('Token types are provided by token issuance and synchronisation. They appear here once the upstream supplies them.','代币类型由代币发行与同步提供，上游供给后将出现在此。'),'')
      :!found.length
      ?CF.empty(L('No token types match these filters','没有符合条件的代币类型'),
        L('Change the keyword or the configuration status, or clear the filters.','请调整关键词或配置状态，或清空筛选条件。'),
        b('Reset filters','重置筛选','reset'))
      :`<div class="tablewrap"><table class="tbl fc-table fc-list-table"><thead><tr>`
        +sortHead('name','Token type','代币类型')
        +`<th scope="col">${L('Maximum pledge ratio','最高质押率')}</th><th scope="col">${L('Maximum project term','最长项目期限')}</th>`
        +`<th scope="col">${L('Configuration status','配置状态')}</th>`
        +sortHead('updatedAt','Last updated','最近更新时间')
        +`<th scope="col">${L('Updated by','最近更新人')}</th><th scope="col" class="col-act">${L('Action','操作')}</th></tr></thead><tbody>`
        +rows.map(r=>`<tr><td><strong class="mono">${E(r.name)}</strong></td><td>${E(ratioText(r.maxRatio))}</td><td>${E(termText(r.maxTermMonths))}</td><td>${statusTag(r)}</td><td>${time(r.updatedAt)}</td><td>${E(person(r.updatedBy))}</td><td class="col-act"><a class="actlink" href="#${E(detailRoute(r.id))}" data-act="fc-view" data-v="${E(r.id)}">${L('View','查看')}</a></td></tr>`).join('')
        +`</tbody></table></div>${pager(found.length)}`);
    return head+`<section class="card">${filters()}<div class="fc-list-tools">${
      field(L('Per page','每页条数'),select('fc-size',A.size,SIZES.map(n=>[n,String(n)])))}</div>${table}</section>`;
  }

  /* ------------------------------------------------------------ 参数变更记录 */
  /* 变更前后同值时只给一个取值并标注未变，避免「70% → 70%」读成改过一次。 */
  const change=(before,after)=>before===after
    ?`<strong>${E(after)}</strong><span class="fc-meta">${L('unchanged','未变')}</span>`
    :`${E(before)} → <strong>${E(after)}</strong>`;
  function changeLog(r){
    const heading=`<h2 class="fc-h2" id="fc-log-title">${L('Parameter change history','参数变更记录')}</h2>`;
    const intro=`<p class="fc-meta">${L('Every successful save of this token type, newest first. All operations accounts see the same records.','本代币类型每一次保存成功的记录，按发生时间倒序；不按本人经办过滤。')}</p>`;
    let body;
    if(A.logState==='loading')body=`<p role="status">${L('Loading the change history…','正在加载参数变更记录…')}</p>`;
    else if(A.logState==='error')body=`<p class="fc-error" role="alert">${L('The change history could not be loaded.','参数变更记录读取失败。')}</p>${b('Retry','重试','log-retry')}`;
    else if(A.logState==='expired')body=`<p class="fc-error" role="alert">${L('Your session ended while the change history was loading.','读取参数变更记录时登录已失效。')}</p>${b('Sign in again','重新登录','sign-in','','primary')}`;
    else{
      const records=A.logState==='empty'?[]:r.records;
      const shown=records.slice(0,A.logShown);
      body=!records.length
        ?`<p class="fc-meta">${L('No parameter changes recorded yet.','尚无参数变更记录。')}</p>`
        :`<div class="tablewrap"><table class="tbl fc-table fc-log-table"><thead><tr><th scope="col">${L('Occurred at','发生时间')}</th><th scope="col">${L('Operator','操作人')}</th><th scope="col">${L('Maximum pledge ratio','最高质押率')}</th><th scope="col">${L('Maximum project term','最长项目期限')}</th><th scope="col">${L('Result','本次结果')}</th></tr></thead><tbody>${
          shown.map(x=>`<tr><td>${time(x.at)}</td><td>${E(x.by)}</td><td>${change(ratioText(x.before.ratio),ratioText(x.after.ratio))}</td><td>${change(termText(x.before.term),termText(x.after.term))}</td><td>${CF.tag('ok',L('Saved','保存成功'))}</td></tr>`).join('')
          }</tbody></table></div>`
          +(records.length>shown.length
            ?`<div class="loadmore">${b('Load more','加载更多','log-more')}<span class="tiny" role="status">${L('Showing '+shown.length+' of '+records.length,'已显示 '+shown.length+' / '+records.length+' 条')}</span></div>`
            :`<div class="loadmore done">${L('End of list','已到末尾')} · ${L(records.length+(records.length===1?' record':' records'),'共 '+records.length+' 条')}</div>`);
    }
    return `<section class="card fc-section" id="fc-log" tabindex="-1" aria-labelledby="fc-log-title">${heading}${intro}${body}</section>`;
  }

  /* ------------------------------------------------------------ 参数详情 */
  function detailPage(){
    const blocked=gate();
    if(blocked)return title(L('Token type parameters','代币类型参数详情'),'')+blocked;
    const r=row();
    if(!r)return title(L('Token type parameters','代币类型参数详情'),'')
      +CF.empty(L('Token type unavailable','代币类型不可用'),L('Open a token type from the parameter list.','请从融资参数列表中选择一个代币类型。'),b('Back to the parameter list','返回融资参数列表','back'));
    if(A.view!=='default')return title(E(r.name),'')+surface({});
    const retired=r.removed
      ?CF.note('warn',L('This token type is no longer supplied upstream. It is not offered when a financing project is created and its parameters can no longer be maintained. The change history below stays readable.','该代币类型已不在上游供给的有效取值内：不再供给创建融资项目，参数也不能再维护。以下参数变更记录保留可追溯。'))
      :'';
    const maintain=!canMaintain()
      ?`<span class="fc-meta">${L('View access only. This account does not hold the financing parameter maintenance permission.','当前仅有融资参数查询权限，不能维护参数。')}</span>`
      :r.removed
        ?`<span class="fc-meta">${L('Maintenance is unavailable for a token type that is no longer supplied upstream.','该代币类型已被上游移出，不提供参数维护。')}</span>`
        :`<a class="btn primary" href="#${E(editRoute(r.id))}" data-act="fc-edit" data-v="${E(r.id)}">${L('Maintain parameters','维护参数')}</a>`;
    const current=section('Current parameters','当前参数',kv([
      [L('Token type','代币类型'),`<strong class="mono">${E(r.name)}</strong><small>${L('Supplied upstream and read-only here.','由上游供给，本模块只读。')}</small>`],
      [L('Maximum pledge ratio','最高质押率'),E(ratioText(r.maxRatio)),'strong'],
      [L('Maximum project term','最长项目期限'),E(termText(r.maxTermMonths)),'strong'],
      [L('Configuration status','配置状态'),statusTag(r)],
      [L('Last updated','最近更新时间'),time(r.updatedAt)],
      [L('Updated by','最近更新人'),E(person(r.updatedBy))]
    ]),maintain);
    return title(E(r.name),r.removed
      ?L('No longer supplied upstream. The parameters below are kept for reference only.','已不在上游供给的有效取值内，以下内容仅供追溯。')
      :configured(r)
      ?L('These values cap what an asset holder can fill in when a financing project is created after the last save.','以下取值是保存成功之后创建融资项目时的自填上限。')
      :L('Not configured yet. This token type cannot be used to create a financing project until both parameters are saved.','尚未配置。两项参数保存前，该代币类型不可用于创建融资项目。'))
      +(A.error?`<div class="card fc-section">${error()}</div>`:'')+retired
      +`<div class="detail-stack fc-stack">${current}${changeLog(r)}</div>`;
  }

  /* ------------------------------------------------------------ 参数维护 */
  const dirty=()=>!!A.draft&&(A.draft.ratio!==A.draft.loadedRatio||A.draft.term!==A.draft.loadedTerm);
  function loadDraft(r){
    A.draft={id:r.id,
      ratio:r.maxRatio==null?'':String(r.maxRatio),term:r.maxTermMonths==null?'':String(r.maxTermMonths),
      loadedRatio:r.maxRatio==null?'':String(r.maxRatio),loadedTerm:r.maxTermMonths==null?'':String(r.maxTermMonths),
      wasConfigured:configured(r)};
    A.fieldErrors={};A.error='';A.errorAction='';
  }
  function parseRatio(raw){
    const s=String(raw==null?'':raw).trim().replace(/%$/,'').trim();
    if(!s)return {code:'required'};
    if(!/^\d+(\.\d+)?$/.test(s))return {code:'format'};
    const value=Number(s);
    if(value<A.bounds.min||value>A.bounds.max)return {code:'range'};
    if((s.split('.')[1]||'').length>A.bounds.decimals)return {code:'decimals'};
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
  function ratioMessage(code){
    const range=L('Allowed range: ','当前允许范围：')+boundsText();
    if(code==='required')return L('Enter the maximum pledge ratio. ','请填写最高质押率。')+range;
    if(code==='format')return L('The maximum pledge ratio must be a number. ','最高质押率须填写数字。')+range;
    if(code==='decimals')return (A.bounds.decimals
      ?L('The maximum pledge ratio takes at most '+A.bounds.decimals+' decimal place'+(A.bounds.decimals>1?'s':'')+'. ','最高质押率最多保留 '+A.bounds.decimals+' 位小数。')
      :L('The maximum pledge ratio must be a whole number. ','最高质押率须为整数。'))+range;
    return L('The maximum pledge ratio is outside the allowed range. ','最高质押率超出允许取值范围。')+range;
  }
  function termMessage(code){
    const range=L('Allowed range: ','允许取值范围：')+termBoundsText();
    if(code==='required')return L('Enter the maximum project term. ','请填写最长项目期限。')+range;
    if(code==='format')return L('The maximum project term must be a whole number of months. ','最长项目期限须为整数月。')+range;
    return L('The maximum project term is outside the allowed range. ','最长项目期限超出允许取值范围。')+range;
  }
  function validate(){
    const ratio=parseRatio(A.draft.ratio),term=parseTerm(A.draft.term);
    A.fieldErrors={};A.validated={ratio:A.draft.ratio,term:A.draft.term};
    if(ratio.code)A.fieldErrors.ratio=ratioMessage(ratio.code);
    if(term.code)A.fieldErrors.term=termMessage(term.code);
    return A.fieldErrors.ratio||A.fieldErrors.term?null:{ratio:ratio.value,term:term.value};
  }
  function fieldError(key){
    return A.fieldErrors[key]?`<p class="fc-error" id="fc-${key}-error" role="alert">${E(A.fieldErrors[key])}</p>`:`<p class="fc-error" id="fc-${key}-error"></p>`;
  }
  function editPage(){
    const blocked=gate();
    if(blocked)return title(L('Maintain parameters','参数维护'),'')+blocked;
    const r=row();
    if(!r||r.removed)return title(L('Maintain parameters','参数维护'),'')
      +(A.error?`<div class="card fc-section">${error()}</div>`:'')
      +CF.empty(L('Token type unavailable','代币类型不可用'),
        L('This token type is no longer supplied upstream, so its parameters cannot be maintained.','该代币类型已不在上游供给的有效取值内，不能维护其参数。'),
        b('Back to the parameter list','返回融资参数列表','back'));
    if(!canMaintain())return title(L('Maintain parameters','参数维护'),'')
      +CF.empty(maintainOnly()?L('Parameter access is incomplete','参数权限配置不完整'):L('No maintenance permission','无维护权限'),
        maintainOnly()
          ?L('This account can maintain financing parameters but cannot query them, so the action is refused. Ask your platform provider to correct the delivered configuration.','该账号可维护融资参数，但未开通配套的融资参数查询，本次动作已拒绝。请联系平台建设方修正交付配置。')
          :L('This account holds the financing parameter query permission only.','该账号仅开通了融资参数查询权限。'),
        b('Back to the parameters','返回参数详情','back'));
    if(!A.draft||A.draft.id!==r.id)loadDraft(r);
    const d=A.draft;
    const target=`<div class="fc-readonly"><span class="fc-meta">${L('Editing','办理对象')}</span><strong>${E(r.name)}</strong><span class="fc-meta">${statusTag(r)} · ${L('Last updated','最近更新时间')} ${time(r.updatedAt)} · ${L('Updated by','最近更新人')} ${E(person(r.updatedBy))}</span></div>`;
    const form=`<form id="fc-form" class="fc-form">${target}<fieldset ${A.busy?'disabled':''}>${
      field(L('Maximum pledge ratio','最高质押率'),
        input('fc-ratio',d.ratio,'text','inputmode="decimal" autocomplete="off" aria-describedby="fc-ratio-hint fc-ratio-error" aria-invalid="'+(!!A.fieldErrors.ratio)+'"'),
        `<span class="fc-meta" id="fc-ratio-hint">${L('Per cent. Allowed range: ','百分比。当前允许范围：')}${boundsText()}${L(' · Current value: ',' · 当前取值：')}${E(ratioText(r.maxRatio))}</span>`+fieldError('ratio'))}${
      field(L('Maximum project term','最长项目期限'),
        input('fc-term',d.term,'text','inputmode="numeric" autocomplete="off" aria-describedby="fc-term-hint fc-term-error" aria-invalid="'+(!!A.fieldErrors.term)+'"'),
        `<span class="fc-meta" id="fc-term-hint">${L('Whole months. Allowed range: ','整数月。允许取值范围：')}${termBoundsText()}${L(' · Current value: ',' · 当前取值：')}${E(termText(r.maxTermMonths))}</span>`+fieldError('term'))}
      </fieldset><div class="fc-formfoot">${
        `<button type="submit" class="btn primary" ${A.busy||!dirty()?'disabled':''} ${dirty()?'':`title="${E(txt(['Change at least one parameter before saving.','两项参数均未改动，无需保存。']))}"`}>${L('Save','保存')}</button>`}${
        b('Cancel','取消','cancel','','',A.busy)}${
        b('Reload the current values','重新取数','reload','','',A.busy)}${
        A.busy?`<span role="status">${L('Submitting…','正在提交…')}</span>`:''}</div>
      <div class="fc-wide">${error()}</div></form>`;
    return title(L('Maintain parameters','参数维护'),L('One token type at a time. Saving takes effect immediately and applies only to financing projects created after the save.','一次维护一个代币类型。保存即时生效，只作用于此后创建的融资项目。'))
      +`<div class="detail-stack fc-stack">${section('Parameters','参数取值',form)}</div>`;
  }

  /* ------------------------------------------------------------ 保存确认与提交 */
  function diffRow(label,before,after){
    return `<div class="fc-diff-row"><b>${label}</b><div class="fc-diff-vals"><span class="fc-before"><span class="sr-only">${L('Before this save: ','变更前：')}</span>${E(before)}</span><span class="fc-arrow" aria-hidden="true">→</span><strong><span class="sr-only">${L('After this save: ','本次保存后：')}</span>${E(after)}</strong></div></div>`;
  }
  const layers={
    'fc-confirm':()=>{
      const r=row(),d=A.draft,next=d&&d.pending;
      if(!r||!next)return {title:L('Confirm the save','确认保存'),html:'',foot:b('Close','关闭','cancel')};
      return {title:L('Confirm the save','确认保存'),
        html:`<div class="fc-readonly"><span class="fc-meta">${L('Token type','代币类型')}</span><strong>${E(r.name)}</strong></div>
          <div class="fc-diff">${diffRow(L('Maximum pledge ratio','最高质押率'),ratioText(r.maxRatio),ratioText(next.ratio))}${diffRow(L('Maximum project term','最长项目期限'),termText(r.maxTermMonths),termText(next.term))}</div>
          <p class="fc-meta">${L('The new values take effect immediately and apply only to financing projects created after this save. Projects already created keep the values locked at creation and are not changed, re-checked or reopened.','新取值保存后立即生效，仅对此后新建的融资项目生效；已创建项目沿用其创建时锁定的取值，不被改写、不需整改。')}</p>
          ${A.busy?`<p role="status">${L('Submitting…','正在提交…')}</p>`:''}`,
        foot:b('Back','返回修改','edit','','',A.busy)+b('Confirm the save','确认保存','submit','','primary',A.busy)};
    },
    'fc-discard':()=>({title:L('Discard unsaved input?','放弃未提交内容？'),
      html:CF.note('',L('The parameters you typed have not been saved. Leaving now discards them; the saved parameters do not change.','填写的参数尚未保存。现在离开将放弃本次输入，已保存的参数不变。')),
      foot:b('Keep editing','继续编辑','keep')+b('Discard','放弃内容','discard','','primary')}),
    'fc-discard-reload':()=>({title:L('Reload and discard your input?','重新取数并放弃输入？'),
      html:CF.note('',L('Reloading replaces the form with the parameters currently saved for this token type and discards what you typed.','重新取数将用该代币类型当前已保存的参数替换表单内容，本次输入将被放弃。')),
      foot:b('Keep editing','继续编辑','keep')+b('Reload','重新取数','confirm-reload','','primary')})
  };
  function startSave(){
    const r=row();
    if(!canMaintain()||!r||r.removed)return deny();
    const next=validate();
    if(!next){CF.render();$(A.fieldErrors.ratio?'fc-ratio':'fc-term')?.focus();return;}
    if(!dirty())return;
    A.draft.pending=next;A.error='';A.errorAction='';
    openLayer('confirm');
  }
  function record(r,before,after){
    r.records.unshift({id:'fc-'+Date.now(),at:Date.now(),by:CF.opsAuth.getIdentity().email.replace(/^(.{2}).*(@.*)$/,'$1***$2'),
      before,after,result:'success'});
    r.updatedAt=Date.now();r.updatedBy=r.records[0].by;
  }
  function submit(){
    const r=row(),d=A.draft;
    if(A.busy)return;
    if(!d||!d.pending||!r)return deny();
    if(!canMaintain()||r.removed)return deny();
    A.busy=true;A.error='';A.errorAction='';CF.render();
    const epoch=A.epoch,response=A.response,next=d.pending;
    setTimeout(()=>{
      if(epoch!==A.epoch||A.draft!==d)return;
      A.busy=false;
      if(!canMaintain())return deny();
      if(response==='fail'){
        S.layer=null;
        A.error=['The save did not complete. Both parameters keep their current values and your input has been kept.','保存未完成，两项参数均保持原值，已保留输入，可重试。'];
        A.errorAction='';CF.render();return;
      }
      if(response==='unknown'){
        S.layer=null;
        A.error=['The result of this submission is unknown. Reload the current values to check before submitting again.','本次提交结果未知，请先重新取数核对当前值，确认前不要重复提交。'];
        A.errorAction='reload';CF.render();return;
      }
      if(response==='concurrent'){
        /* 他人先行修改：本次基于旧值的提交被拒，对方的保存正常留痕。 */
        const before={ratio:r.maxRatio,term:r.maxTermMonths};
        r.maxRatio=A.bounds.decimals?Math.min(A.bounds.max,A.bounds.min+9.5):Math.min(A.bounds.max,A.bounds.min+63);
        r.maxTermMonths=r.maxTermMonths===TERM.max?TERM.max-3:TERM.max;
        r.records.unshift({id:'fc-other-'+Date.now(),at:Date.now(),by:'ch***@example.invalid',
          before,after:{ratio:r.maxRatio,term:r.maxTermMonths},result:'success'});
        r.updatedAt=Date.now();r.updatedBy='ch***@example.invalid';
        S.layer=null;
        A.error=['Another operator saved this token type first, so your submission was based on outdated values and has been refused. Reload the current values before editing again.','该代币类型的参数已被他人先行修改，本次提交基于旧值，已被拒绝。请重新取数后再修改。'];
        A.errorAction='reload';CF.render();return;
      }
      if(response==='removed'){
        r.removed=true;S.layer=null;A.draft=null;
        A.error=['This token type was removed from the upstream values while you were editing. Nothing was saved.','该代币类型在办理期间已被上游移出有效取值，本次未写入任何参数。'];
        A.errorAction='back';CF.render();return;
      }
      /* 保存成功：两项参数整体采用新值，并留下一条变更记录。 */
      const before={ratio:r.maxRatio,term:r.maxTermMonths};
      r.maxRatio=next.ratio;r.maxTermMonths=next.term;
      record(r,before,{ratio:next.ratio,term:next.term});
      A.draft=null;S.layer=null;A.logShown=CF.PAGE_SIZE;
      navigateRoute(detailRoute(r.id));
      CF.toast(L('Parameters saved. They apply to financing projects created from now on.','参数已保存，自此后创建的融资项目起生效。'));
    },650);
  }

  /* ------------------------------------------------------------ 演示工具 */
  function grant(mode){
    if(!CF.opsAuth)return;
    CF.opsAuth.seedDemo(mode==='admin'?'admin':'specialist');
    if(mode==='query')OPS.onAct('ops-grant','19');
    if(mode==='maintain')OPS.onAct('ops-grant','20');
    if(mode==='full'){OPS.onAct('ops-grant','19');OPS.onAct('ops-grant','20');}
    A.epoch++;A.draft=null;A.busy=false;A.error='';A.errorAction='';S.layer=null;
  }
  function demo(){
    if(OPS_PAGES.includes(S.page))return OPS.demo();
    const extra=A.rows.find(r=>r.id===CF.parameterTokenNames.trc);
    const removals=A.rows.filter(r=>!r.removed);
    return `<h3>${L('Financing parameters · demo tools','融资参数配置 · 演示工具')}</h3><p class="fc-meta">${L('Local demonstration only. No configuration service is contacted and this module sends no message of any kind.','仅本地演示：不连接真实配置服务；本模块不产生任何站内信、邮件或推送。')}</p>
      <h4>${L('Delivered account configuration','交付的账号配置')}</h4><div class="fc-demo-actions">${b('Administrator','运营管理员','grant','admin')}${b('Specialist · no access','运营专员 · 未开通本模块','grant','none')}${b('Specialist · query only','运营专员 · 仅开通参数查询','grant','query')}${b('Specialist · maintenance only','运营专员 · 仅开通参数维护','grant','maintain')}${b('Specialist · query + maintenance','运营专员 · 查询＋维护','grant','full')}</div>
      <div class="fc-demo">${field(L('Page state','页面状态'),select('fc-view',A.view,[['default',L('Default','默认')],['loading',L('Loading','加载中')],['empty',L('Empty · no token types','空数据 · 暂无代币类型')],['error',L('Load failed','读取失败')]]))}${
        field(L('Change history state','参数变更记录状态'),select('fc-log-state',A.logState,[['default',L('Default','默认')],['loading',L('Loading','加载中')],['empty',L('No records','尚无记录')],['error',L('Load failed','读取失败')],['expired',L('Session expired','登录失效')]]))}${
        field(L('Save response','保存反馈'),select('fc-response',A.response,[['success',L('Success','成功')],['fail',L('Failure','失败')],['unknown',L('Result unknown','结果未知')],['concurrent',L('Another operator saved first','已被他人先行修改')],['removed',L('Token type removed upstream','代币类型已被上游移出')]]))}</div>
      <h4>${L('Upstream token type supply','上游代币类型供给')}</h4><p class="fc-meta">${L('This release supplies one token type. Operations cannot add, rename, merge or delete a token type in the product; the buttons below simulate the upstream changing what it supplies.','本期上游只供给一个代币类型。产品内没有新增、改名、合并或删除入口；以下按钮模拟上游供给本身发生变化。')}</p>
      <div class="fc-demo-actions">${b('Upstream adds a token type','上游新增一个代币类型','add-token','','',!!extra)}${
        removals.map(r=>b('Upstream removes '+r.name,'上游移出「'+r.name+'」','remove-token',r.id)).join('')}${
        b('Restore the default supply','恢复默认供给','restore-tokens')}</div>
      <h4>${L('Pledge ratio bounds · not yet decided','最高质押率取值边界 · 尚未裁定')}</h4><p class="fc-meta">${L('The upper and lower bounds and the number of decimal places have not been decided. The options below are placeholders used to demonstrate the out-of-range refusal and the allowed-range message; none of them is a delivery commitment.','取值上下限与小数位数尚未裁定。以下选项只是占位取值，用于演示越界拒绝与允许范围提示，都不构成上线口径。')}</p>
      <div class="fc-demo">${field(L('Placeholder bounds','占位取值边界'),select('fc-bounds',A.bounds.key,CF.parameterBounds.map(x=>[x.key,x.min+'% ～ '+x.max+'%, '+(x.decimals?x.decimals+(S.lang==='en'?' dp':' 位小数'):(S.lang==='en'?'integer':'整数'))])))}</div>
      <h4>${L('Session','会话')}</h4><div class="fc-demo-actions">${b('Expire the operations session','运营登录失效','expire-session')}${b('Reset demonstration','重置演示','restart')}</div>`;
  }

  /* ------------------------------------------------------------ 动作 */
  function resetFilter(){
    A.filter=fDefault();A.edit=fDefault();A.page=1;A.error='';A.errorAction='';A.view='default';
    if(S.page===LIST)saveContext();
    CF.render();
  }
  function reload(){
    const r=row();
    if(!r)return;
    loadDraft(r);CF.render();CF.toast(L('The current values have been reloaded.','已重新取数。'));
  }
  function onAct(act,v,e){
    if(e&&(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)&&['fc-view','fc-edit'].includes(act))return false;
    if(!act.startsWith('fc-')){
      if(act==='retry'){A.view='default';A.error='';A.errorAction='';CF.render();return true;}
      if(act==='clearfilter'){resetFilter();return true;}
      return false;
    }
    act=act.slice(3);
    if(A.busy&&act!=='cancel')return true;
    if(act==='view'){A.selected=v;leave(detailRoute(v));}
    else if(act==='edit'){A.selected=v;leave(editRoute(v));}
    else if(act==='back')leave(S.page===EDIT?detailRoute(A.selected):listRoute());
    else if(act==='sign-in'){S.layer=null;location.hash='#/ops/login';}
    else if(act==='page'){A.page=Math.max(1,Number(v));saveContext();CF.render();window.scrollTo(0,0);}
    else if(act==='search'){A.filter={...A.edit};A.page=1;A.error='';A.view='default';saveContext();CF.render();}
    else if(act==='reset')resetFilter();
    else if(act==='sort'){A.dir=A.sort===v?-A.dir:1;A.sort=v;A.page=1;saveContext();CF.render();}
    else if(act==='log-more'){A.logShown+=CF.PAGE_SIZE;CF.render();}
    else if(act==='log-retry'){A.logState='default';CF.render();$('fc-log')?.focus({preventScroll:true});}
    else if(act==='save')startSave();
    else if(act==='submit')submit();
    else if(act==='edit-back'||act==='keep')CF.closeLayer();
    else if(act==='cancel'){
      if(S.layer){CF.closeLayer();return true;}
      leave(detailRoute(A.selected));
    }
    else if(act==='reload'){if(dirty())openLayer('discard-reload');else reload();}
    else if(act==='confirm-reload'){S.layer=null;reload();}
    else if(act==='discard'){
      A.draft=null;A.error='';A.errorAction='';A.fieldErrors={};
      const target=pendingRoute;pendingRoute=undefined;
      if(target!==undefined){S.layer=null;navigateRoute(target);}else CF.closeLayer();
    }
    else if(act==='grant'){grant(v);S.demo=false;window.scrollTo(0,0);navigateRoute(S.page===LIST?listRoute():detailRoute(A.selected));}
    else if(act==='expire-session'){A.draft=null;A.busy=false;S.layer=null;S.demo=false;OPS.onAct('ops-session-expire');CF.render();}
    else if(act==='add-token'){
      if(!A.rows.some(r=>r.id===CF.parameterTokenNames.trc))A.rows.push(CF.parameterNewToken());
      CF.render();
    }
    else if(act==='remove-token'){
      const r=rowOf(v);
      if(r){r.removed=true;if(A.draft&&A.draft.id===v)A.draft=null;}
      CF.render();
    }
    else if(act==='restart'||act==='restore-tokens'){
      const fresh=CF.parameterSeed();
      A.epoch++;A.rows=fresh.rows;A.draft=null;A.busy=false;A.error='';A.errorAction='';A.fieldErrors={};
      A.logShown=CF.PAGE_SIZE;A.logState='default';A.view='default';
      if(act==='restart'){A.response='success';A.bounds=CF.parameterBounds[0];grant('admin');}
      A.selected=A.rows[0].id;resetFilter();navigateRoute(listRoute());
    }
    else return false;
    return true;
  }
  /* 错误只在取值真的被改动后就地清除：提交时输入框仍持有焦点，
     重绘会让浏览器对已移除的输入补发一次 change，不能把刚给出的校验结果抹掉。 */
  function clearFieldError(key,value){
    if(!A.fieldErrors[key]||value===A.validated[key])return;
    delete A.fieldErrors[key];
    $('fc-'+key)?.setAttribute('aria-invalid','false');
    const slot=$('fc-'+key+'-error');
    if(slot)slot.textContent='';
  }
  function onInput(e){
    if(A.busy||!A.draft)return;
    const id=e.target.id,value=e.target.value;
    if(id==='fc-ratio'){A.draft.ratio=value;clearFieldError('ratio',value);}
    else if(id==='fc-term'){A.draft.term=value;clearFieldError('term',value);}
    else return;
    const save=document.querySelector('#fc-form button[type="submit"]');
    if(save)save.disabled=!dirty();
  }
  document.addEventListener('submit',e=>{
    if(e.target.id==='fc-filter-form'){e.preventDefault();onAct('fc-search','');}
    if(e.target.id==='fc-form'){e.preventDefault();onAct('fc-save','');}
  });
  document.addEventListener('input',e=>{
    if(e.target.id==='fc-f-q')A.edit.q=e.target.value;
    onInput(e);
  });
  document.addEventListener('change',e=>{
    const id=e.target.id,value=e.target.value;
    if(id==='fc-f-status'){A.edit.status=value;return;}
    if(id==='fc-size'){A.size=Number(value);A.page=1;saveContext();CF.render();return;}
    if(id==='fc-view'){A.view=value;A.error='';CF.render();return;}
    if(id==='fc-log-state'){A.logState=value;A.logShown=CF.PAGE_SIZE;CF.render();return;}
    if(id==='fc-response'){A.response=value;return;}
    if(id==='fc-bounds'){A.bounds=CF.parameterBounds.find(x=>x.key===value)||A.bounds;A.fieldErrors={};CF.render();return;}
    onInput(e);
  });
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href^="#"]');
    if(!a||a.hasAttribute('data-act')||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
    if(dirty()){e.preventDefault();pendingRoute=a.hash.slice(1);openLayer('discard');return;}
    remember();
  },true);

  /* ------------------------------------------------------------ 评审目录 */
  const DENIED={id:'denied',label:['No access','无权限'],group:'business'};
  const UNSET={id:'unset',label:['Not configured','未配置'],group:'business'};
  [[LIST,['Financing parameter list','融资参数列表'],['default','loading','empty','noresult','error',DENIED]],
   [DETAIL,['Token type parameters','代币类型参数详情'],['default','loading','error',UNSET,DENIED]],
   [EDIT,['Maintain parameters','参数维护'],['default',UNSET,DENIED]]].forEach(([id,label,states])=>{
    CF.review.register(id,{
      group:['Financing parameters','融资参数配置'],label,states,
      route:()=>{
        const target=A.selected&&rowOf(A.selected)&&!rowOf(A.selected).removed?A.selected:(live()[0]||{}).id;
        if(id===LIST)return ROOT;
        if(!target)return null;
        A.selected=target;
        return id===DETAIL?detailRoute(target):editRoute(target);
      },
      get:()=>!canQuery()?'denied':(id!==LIST&&!configured(row())?'unset':A.view),
      set(value){
        if(value==='denied'){grant('none');A.view='default';S.st='default';return;}
        if(!canQuery())grant(id===EDIT?'full':'admin');
        if(value==='unset'){
          if(!A.rows.some(r=>r.id===CF.parameterTokenNames.trc))A.rows.push(CF.parameterNewToken());
          A.selected=CF.parameterTokenNames.trc;A.draft=null;A.view='default';S.st='default';
          navigateRoute(id===EDIT?editRoute(A.selected):detailRoute(A.selected));
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
    en:{...OPS.dict.en,navFinancingParameters:'Financing parameters',
      navParameterDetail:'Token type parameters',navParameterEdit:'Maintain parameters'},
    zh:{...OPS.dict.zh,navFinancingParameters:'融资参数配置',
      navParameterDetail:'代币类型参数详情',navParameterEdit:'参数维护'}
  };
  CF.define({...OPS,id:'financing-parameters',demoOnly:true,reviewToolsInLayer:false,dict,demo,
    content:page=>{
      if(OPS_PAGES.includes(page))return OPS.content(page);
      return page===EDIT?editPage():page===DETAIL?detailPage():listPage();
    },
    layers:{...OPS.layers,...layers},
    onAct:(act,v,e)=>onAct(act,v,e)||OPS.onAct(act,v,e),
    beforeAdminNavigate(proceed){
      if(A.busy){CF.toast(L('Wait for the current submission to finish.','请等待本次提交完成。'));return;}
      if(dirty()){CF.toast(L('Finish or cancel the parameter maintenance first.','请先完成或取消当前参数维护。'));return;}
      remember();proceed();
    },
    allowNav:id=>PAGES.includes(id)?allowed():OPS_PAGES.includes(id),
    breadcrumbRoute:id=>id===LIST?listRoute():id===DETAIL?detailRoute(A.selected):null,
    onBeforeAct(act,v,e){
      if(act==='retry'||act==='clearfilter'){onAct(act,v);return true;}
      if(act==='closelayer'&&A.busy)return true;
      if(act==='closelayer'&&S.layer?.key==='fc-confirm'){CF.closeLayer();return true;}
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
      if(!allowed()&&S.layer?.key.startsWith('fc-')){S.layer=null;A.draft=null;A.busy=false;}
    },
    afterRender(){OPS.afterRender();restoreView();},
    onRoute(prev,id){
      A.epoch++;A.busy=false;A.error='';A.errorAction='';A.fieldErrors={};A.view='default';
      A.logShown=CF.PAGE_SIZE;restoreContext=true;
      if(id!==EDIT)A.draft=null;
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
