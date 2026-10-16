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
  /* 最高质押率已裁定（2026-10-09）：大于 0、不超过 100%、最多两位小数；超出两位如实拒绝，不替用户取整。 */
  const RATIO={max:100,decimals:2};

  const fDefault=()=>({q:'',status:''});
  const seed=CF.parameterSeed();
  const A={rows:seed.rows,justSaved:null,domainNew:false,
    filter:fDefault(),edit:fDefault(),sort:'name',dir:1,page:1,size:SIZES[0],
    selected:null,draft:null,busy:false,error:'',errorAction:'',fieldErrors:{},validated:{},
    view:'default',logState:'default',logShown:CF.PAGE_SIZE,response:'success',epoch:0};
  let lastHash='',returnHash='',onModule=false,wasSigned=false,restoreContext=false,pendingRoute;
  const positions=new Map();

  const txt=x=>Array.isArray(x)?L(x[0],x[1]):x;
  const time=t=>t?CF.fmtTime(t):'—';
  const ratioText=v=>v==null?'—':Number(v).toFixed(RATIO.decimals)+'%';
  const termText=v=>v==null?'—':v+' '+L(v===1?'month':'months','个月');
  const person=v=>v||'—';
  const configured=r=>!!r&&r.maxRatio!=null&&r.maxTermMonths!=null;
  const rowOf=id=>A.rows.find(r=>r.id===id);
  const row=()=>rowOf(A.selected);
  const live=()=>A.rows.filter(r=>!r.removed);
  const statusTag=r=>configured(r)?CF.tag('ok',L('Configured','已配置')):CF.tag('warn',L('Not configured','未配置'));

  const boundsText=()=>L('over 0%, up to 100%, at most 2 decimal places','大于 0，最高 100%，最多两位小数');
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
    return `<div class="pager"><span class="total">${L('Total','共')} ${total} ${L(total===1?'token type':'token types','个代币类型')}</span><span class="fc-size">${field(L('Per page','每页'),select('fc-size',A.size,SIZES.map(n=>[n,String(n)])))}</span>${
      b('Previous','上一页','page',String(A.page-1),'sm',A.page===1)}<span>${A.page} / ${pages}</span>${
      b('Next','下一页','page',String(A.page+1),'sm',A.page===pages)}</div>`;
  }
  function listPage(){
    const blocked=gate();
    const head=title(L('Financing parameters','融资参数配置'),
      L('Caps on the pledge ratio and project term an asset holder can fill in, by token type. Token types are added and removed by developers on the backend; this page only maintains their parameters.','按代币类型维护资产方创建融资项目时可填的质押率与期限上限。代币类型由开发在后端新增或移除，此处只维护参数。'));
    if(blocked)return head+blocked;
    const state=A.view==='default'?null:surface({
      emptyTitle:L('No token types yet','暂无代币类型'),
      emptyDesc:L('Token types are added by developers on the backend. A newly added token type appears here as not configured. Contact your developers if one is missing.','代币类型由开发在后端新增，新增后以「未配置」出现在这里。如缺少代币类型，请联系开发。')});
    const found=sortRows(scope());
    const pages=Math.max(1,Math.ceil(found.length/A.size));
    if(A.page>pages)A.page=pages;
    const rows=found.slice((A.page-1)*A.size,A.page*A.size);
    /* 未配置的代币类型须让运营一眼察觉：列表上方给出数量并可一键只看未配置。 */
    const unset=live().filter(r=>!configured(r)).length;
    const cue=!state&&unset&&A.filter.status!=='unset'
      ?`<div class="fc-cue" role="status">${CF.tag('warn',L('Not configured','未配置'))}<span>${L(unset+' token type'+(unset>1?'s are':' is')+' not configured yet and cannot be used to create a financing project.','有 '+unset+' 个代币类型尚未配置，暂不可用于创建融资项目。')}</span>${b('Show not configured only','只看未配置','only-unset','','sm')}</div>`:'';
    const actions=r=>`<a class="actlink" href="#${E(detailRoute(r.id))}" data-act="fc-view" data-v="${E(r.id)}" aria-label="${E(L('View ','查看')+r.name)}">${L('View','查看')}</a>`
      +(canMaintain()?`<a class="actlink" href="#${E(editRoute(r.id))}" data-act="fc-edit" data-v="${E(r.id)}" aria-label="${E((configured(r)?L('Maintain ','维护'):L('Configure ','配置'))+r.name)}">${configured(r)?L('Maintain','维护'):L('Configure','配置')}</a>`:'');
    /* 开发尚未新增任何代币类型与筛选无匹配是两种结果，分别表达；两处都不提供新增入口。 */
    const table=state||(!live().length
      ?CF.empty(L('No token types yet','暂无代币类型'),
        L('Token types are added by developers on the backend. A newly added token type appears here as not configured. Contact your developers if one is missing.','代币类型由开发在后端新增，新增后以「未配置」出现在这里。如缺少代币类型，请联系开发。'),'')
      :!found.length
      ?CF.empty(L('No token types match these filters','没有符合条件的代币类型'),
        L('Change the keyword or the configuration status, or clear the filters.','请调整关键词或配置状态，或清空筛选条件。'),
        b('Reset filters','重置筛选','reset'))
      :`<div class="tablewrap"><table class="tbl fc-table fc-list-table"><thead><tr>`
        +sortHead('name','Token type','代币类型')
        +`<th scope="col" class="fc-number">${L('Maximum pledge ratio','最高质押率')}</th><th scope="col" class="fc-number">${L('Maximum project term','最长项目期限')}</th>`
        +`<th scope="col">${L('Configuration status','配置状态')}</th>`
        +sortHead('updatedAt','Last updated','最近更新时间')
        +`<th scope="col">${L('Updated by','最近更新人')}</th><th scope="col" class="col-act">${L('Action','操作')}</th></tr></thead><tbody>`
        +rows.map(r=>`<tr${configured(r)?'':' class="fc-row-unset"'}><td><strong class="cell-main">${E(r.name)}</strong></td><td class="fc-number">${E(ratioText(r.maxRatio))}</td><td class="fc-number">${E(termText(r.maxTermMonths))}</td><td>${statusTag(r)}</td><td>${time(r.updatedAt)}</td><td>${E(person(r.updatedBy))}</td><td class="col-act">${actions(r)}</td></tr>`).join('')
        +`</tbody></table></div>${pager(found.length)}`);
    return head+`<section class="card">${filters()}${cue}${table}</section>`;
  }

  /* ------------------------------------------------------------ 参数变更记录 */
  /* 变更前后同值时只给一个取值并标注未变，避免「70% → 70%」读成改过一次。 */
  const change=(before,after)=>before===after
    ?`<strong>${E(after)}</strong><span class="fc-meta">${L('unchanged','未变')}</span>`
    :`<span class="fc-change-before">${E(before)} → </span><strong>${E(after)}</strong>`;
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
        :`<div class="tablewrap"><table class="tbl fc-table fc-log-table"><thead><tr><th scope="col">${L('Occurred at','发生时间')}</th><th scope="col">${L('Operator','操作人')}</th><th scope="col" class="fc-number">${L('Maximum pledge ratio','最高质押率')}</th><th scope="col" class="fc-number">${L('Maximum project term','最长项目期限')}</th><th scope="col">${L('Result','本次结果')}</th></tr></thead><tbody>${
          shown.map(x=>`<tr${x.id===A.justSaved?' class="fc-row-new"':''}><td>${time(x.at)}${x.id===A.justSaved?CF.tag('accent',L('Just saved','本次保存')):''}</td><td>${E(x.by)}</td><td class="fc-number">${change(ratioText(x.before.ratio),ratioText(x.after.ratio))}</td><td class="fc-number">${change(termText(x.before.term),termText(x.after.term))}</td><td>${CF.tag('ok',L('Saved','保存成功'))}</td></tr>`).join('')
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
      ?CF.note('warn',L('Developers have removed this token type on the backend. It can no longer be used to create a financing project and its parameters can no longer be maintained. Projects already created keep their locked values, and the change history below stays readable.','该代币类型已由开发在后端移除：不再用于创建融资项目，参数也不能再维护。已创建的项目仍按其锁定值运行，不受影响；以下参数变更记录保留可查。'))
      :'';
    const maintain=!canMaintain()
      ?`<span class="fc-meta">${L('View access only. This account does not hold the financing parameter maintenance permission.','当前仅有融资参数查询权限，不能维护参数。')}</span>`
      :r.removed
        ?`<span class="fc-meta">${L('This token type has been removed, so its parameters cannot be maintained.','该代币类型已移除，不提供参数维护。')}</span>`
        :`<a class="btn primary" href="#${E(editRoute(r.id))}" data-act="fc-edit" data-v="${E(r.id)}">${configured(r)?L('Maintain parameters','维护参数'):L('Configure parameters','配置参数')}</a>`;
    const current=section('Current parameters','当前参数',kv([
      [L('Token type','代币类型'),`<strong class="mono">${E(r.name)}</strong><small>${L('Added by developers on the backend; read-only here.','由开发在后端新增，此处不可修改。')}</small>`],
      [L('Maximum pledge ratio','最高质押率'),E(ratioText(r.maxRatio)),'strong'],
      [L('Maximum project term','最长项目期限'),E(termText(r.maxTermMonths)),'strong'],
      [L('Configuration status','配置状态'),statusTag(r)],
      [L('Last updated','最近更新时间'),time(r.updatedAt)],
      [L('Updated by','最近更新人'),E(person(r.updatedBy))]
    ]),maintain);
    return title(E(r.name),r.removed
      ?L('Removed by developers. The details below are kept for reference only.','已由开发移除，以下内容仅供查阅。')
      :configured(r)
      ?L('These values cap what an asset holder can fill in when a financing project is created after the last save.','以下取值是保存成功之后创建融资项目时的自填上限。')
      :L('Not configured yet. This token type cannot be used to create a financing project until both parameters are saved.','尚未配置。两项参数保存前，该代币类型不可用于创建融资项目。'))
      +(A.error?`<div class="card fc-section">${error()}</div>`:'')+retired
      +`<div class="detail-stack fc-stack">${current}${changeLog(r)}</div>`;
  }

  /* ------------------------------------------------------------ 参数维护 */
  /* 改动按取值比较：把 70 改写成 70.00 不算改动，避免为同一个值走一次确认。 */
  const sameRatio=(a,b)=>{const x=parseRatio(a),y=parseRatio(b);return x.code||y.code?String(a).trim()===String(b).trim():x.value===y.value;};
  const changed=key=>!!A.draft&&(key==='ratio'?!sameRatio(A.draft.ratio,A.draft.loadedRatio):A.draft.term!==A.draft.loadedTerm);
  const dirty=()=>changed('ratio')||changed('term');
  function loadDraft(r){
    const ratio=r.maxRatio==null?'':Number(r.maxRatio).toFixed(RATIO.decimals),term=r.maxTermMonths==null?'':String(r.maxTermMonths);
    A.draft={id:r.id,ratio,term,loadedRatio:ratio,loadedTerm:term,wasConfigured:configured(r)};
    A.fieldErrors={};A.validated={};A.error='';A.errorAction='';
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
  /* 四类拒绝各有自己的说明，并都给出当前允许范围。 */
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
    return L('The maximum project term is outside the allowed range.','最长项目期限超出允许取值范围。')+range;
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
    return A.fieldErrors[key]?`<p class="fc-error" id="fc-${key}-error" role="alert">${E(A.fieldErrors[key])}</p>`:`<p class="fc-error" id="fc-${key}-error"></p>`;
  }
  /* 失焦即校验并就地更新该项，不重绘整页，避免打断键盘焦点。 */
  function paintField(key){
    const el=$('fc-'+key),slot=$('fc-'+key+'-error'),mark=$('fc-'+key+'-changed');
    if(el)el.setAttribute('aria-invalid',String(!!A.fieldErrors[key]));
    if(slot){slot.textContent=A.fieldErrors[key]||'';slot.setAttribute('role',A.fieldErrors[key]?'alert':'none');}
    if(mark)mark.hidden=!changed(key);
    const save=document.querySelector('#fc-form button[type="submit"]');
    if(save){save.disabled=A.busy||!dirty();save.title=dirty()?'':txt(['Change at least one parameter before saving.','两项参数均未改动，无需保存。']);}
  }
  function editPage(){
    const blocked=gate();
    if(blocked)return title(L('Maintain parameters','参数维护'),'')+blocked;
    const r=row();
    if(!r||r.removed)return title(L('Maintain parameters','参数维护'),'')
      +(A.error?`<div class="card fc-section">${error()}</div>`:'')
      +CF.empty(L('Token type unavailable','代币类型不可用'),
        L('Developers have removed this token type on the backend, so its parameters cannot be maintained. Projects already created are not affected.','该代币类型已由开发在后端移除，不能再维护其参数；已创建的项目不受影响。'),
        b('Back to the parameter list','返回融资参数列表','back'));
    if(!canMaintain())return title(L('Maintain parameters','参数维护'),'')
      +CF.empty(maintainOnly()?L('Parameter access is incomplete','参数权限配置不完整'):L('No maintenance permission','无维护权限'),
        maintainOnly()
          ?L('This account can maintain financing parameters but cannot query them, so the action is refused. Ask your platform provider to correct the delivered configuration.','该账号可维护融资参数，但未开通配套的融资参数查询，本次动作已拒绝。请联系平台建设方修正交付配置。')
          :L('This account holds the financing parameter query permission only.','该账号仅开通了融资参数查询权限。'),
        b('Back to the parameters','返回参数详情','back'));
    if(!A.draft||A.draft.id!==r.id)loadDraft(r);
    const d=A.draft;
    const mark=key=>`<span class="tag accent fc-changed" id="fc-${key}-changed" ${changed(key)?'':'hidden'}><span class="dot"></span>${L('Changed','已修改')}</span>`;
    const current=(v)=>`<span class="fc-current">${L('Current: ','当前：')}${E(v)}</span>`;
    const terms=[['',L('Choose…','请选择')],...Array.from({length:TERM.max-TERM.min+1},(_,i)=>{const n=TERM.min+i;return [String(n),termText(n)];})];
    const form=`<form id="fc-form" class="fc-form" novalidate><fieldset ${A.busy?'disabled':''}>
        <div class="field"><div class="fc-label"><label for="fc-ratio">${L('Maximum pledge ratio','最高质押率')}</label>${mark('ratio')}</div>
          <div class="fc-affix"><input class="inp" id="fc-ratio" type="text" value="${E(d.ratio)}" inputmode="decimal" autocomplete="off" placeholder="${L('e.g. 70.00','如 70.00')}" aria-describedby="fc-ratio-hint fc-ratio-error" aria-invalid="${!!A.fieldErrors.ratio}"><span aria-hidden="true">%</span></div>
          <span class="fc-meta" id="fc-ratio-hint">${boundsText()}${r.maxRatio!=null?' '+current(ratioText(r.maxRatio)):''}</span>${fieldError('ratio')}</div>
        <div class="field"><div class="fc-label"><label for="fc-term">${L('Maximum project term','最长项目期限')}</label>${mark('term')}</div>
          ${select('fc-term',d.term,terms).replace('<select class="inp"','<select class="inp" aria-describedby="fc-term-hint fc-term-error" aria-invalid="'+(!!A.fieldErrors.term)+'"')}
          <span class="fc-meta" id="fc-term-hint">${termBoundsText()}${r.maxTermMonths!=null?' '+current(termText(r.maxTermMonths)):''}</span>${fieldError('term')}</div>
      </fieldset>
      <div class="fc-wide">${error()}</div>
      <div class="fc-formfoot"><button type="submit" class="btn primary" ${A.busy||!dirty()?'disabled':''} title="${dirty()?'':E(txt(['Change at least one parameter before saving.','两项参数均未改动，无需保存。']))}">${L('Save','保存')}</button>${
        b('Cancel','取消','cancel','','',A.busy)}${
        A.busy?`<span role="status">${L('Submitting…','正在提交…')}</span>`:`<span class="fc-meta fc-foot-note">${L('Takes effect on save, for financing projects created afterwards only.','保存即生效，仅作用于此后创建的融资项目。')}</span>`}</div></form>`;
    const head=`<div class="fc-section-head"><h2 class="fc-h2">${configured(r)?L('Maintain parameters','维护参数'):L('Configure parameters','配置参数')}</h2>${statusTag(r)}</div>`;
    return title(E(r.name),L('One token type at a time. Fill in both parameters; the token type itself cannot be changed here.','一次维护一个代币类型，两项参数需同时填写；代币类型不可在此修改。'))
      +`<div class="detail-stack fc-stack"><section class="card fc-section fc-editing">${head}${form}</section>${changeLog(r)}</div>`;
  }

  /* ------------------------------------------------------------ 保存确认与提交 */
  function diffRow(label,before,after){
    if(before===after)return `<div class="fc-diff-row fc-diff-same"><b>${label}</b><div class="fc-diff-vals"><strong>${E(after)}</strong><span class="fc-meta">${L('unchanged','未变')}</span></div></div>`;
    return `<div class="fc-diff-row"><b>${label}</b><div class="fc-diff-vals"><span class="fc-before"><span class="sr-only">${L('Before this save: ','变更前：')}</span>${E(before)}</span><span class="fc-arrow" aria-hidden="true">→</span><strong><span class="sr-only">${L('After this save: ','本次保存后：')}</span>${E(after)}</strong></div></div>`;
  }
  const layers={
    'fc-confirm':()=>{
      const r=row(),d=A.draft,next=d&&d.pending;
      if(!r||!next)return {title:L('Confirm the save','确认保存'),html:'',foot:b('Close','关闭','cancel')};
      return {title:L('Confirm the save','确认保存'),
        html:`<div class="fc-readonly"><span class="fc-meta">${L('Token type','代币类型')}</span><strong>${E(r.name)}</strong>${d.wasConfigured?'':`<span class="fc-meta">${L('First configuration: once saved, this token type can be used to create financing projects.','首次配置：保存后该代币类型即可用于创建融资项目。')}</span>`}</div>
          <div class="fc-diff">${diffRow(L('Maximum pledge ratio','最高质押率'),ratioText(r.maxRatio),ratioText(next.ratio))}${diffRow(L('Maximum project term','最长项目期限'),termText(r.maxTermMonths),termText(next.term))}</div>
          <p class="fc-meta">${L('The new values take effect immediately and apply only to financing projects created after this save. Projects already created keep the values locked at creation and are not changed, re-checked or reopened.','新取值保存后立即生效，仅对此后新建的融资项目生效；已创建项目沿用其创建时锁定的取值，不被改写、不需整改。')}</p>
          ${A.busy?`<p role="status">${L('Submitting…','正在提交…')}</p>`:''}`,
        foot:b('Back','返回修改','edit-back','','',A.busy)+b('Confirm the save','确认保存','submit','','primary',A.busy)};
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
        r.maxRatio=r.maxRatio===68.5?66:68.5;
        r.maxTermMonths=r.maxTermMonths===TERM.max?TERM.max-3:TERM.max;
        r.records.unshift({id:'fc-other-'+Date.now(),at:Date.now(),by:'ch***@example.com',
          before,after:{ratio:r.maxRatio,term:r.maxTermMonths},result:'success'});
        r.updatedAt=Date.now();r.updatedBy='ch***@example.com';
        S.layer=null;
        A.error=['Another operator saved this token type first, so your submission was based on outdated values and has been refused. Reload the current values before editing again.','该代币类型的参数已被他人先行修改，本次提交基于旧值，已被拒绝。请重新取数后再修改。'];
        A.errorAction='reload';CF.render();return;
      }
      if(response==='removed'){
        r.removed=true;S.layer=null;A.draft=null;
        A.error=['Developers removed this token type on the backend while you were editing. Nothing was saved; projects already created are not affected.','该代币类型在办理期间已由开发在后端移除，本次未保存任何参数；已创建的项目不受影响。'];
        A.errorAction='back';CF.render();return;
      }
      /* 保存成功：两项参数整体采用新值，并留下一条变更记录。 */
      const before={ratio:r.maxRatio,term:r.maxTermMonths};
      r.maxRatio=next.ratio;r.maxTermMonths=next.term;
      record(r,before,{ratio:next.ratio,term:next.term});
      A.justSaved=r.records[0].id;
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
      <h4>${L('Delivered account configuration','交付的账号配置')}</h4><div class="fc-demo-actions">${b('Administrator','运营管理员','grant','admin')}${b('Later role · no access','后期角色 · 未开通本模块','grant','none')}${b('Later role · query only','后期角色 · 仅开通参数查询','grant','query')}${b('Later role · maintenance only','后期角色 · 仅开通参数维护','grant','maintain')}${b('Later role · query + maintenance','后期角色 · 查询＋维护','grant','full')}</div>
      <div class="fc-demo">${field(L('Page state','页面状态'),select('fc-view',A.view,[['default',L('Default','默认')],['loading',L('Loading','加载中')],['empty',L('Empty · no token types','空数据 · 暂无代币类型')],['error',L('Load failed','读取失败')]]))}${
        field(L('Change history state','参数变更记录状态'),select('fc-log-state',A.logState,[['default',L('Default','默认')],['loading',L('Loading','加载中')],['empty',L('No records','尚无记录')],['error',L('Load failed','读取失败')],['expired',L('Session expired','登录失效')]]))}${
        field(L('Save response','保存反馈'),select('fc-response',A.response,[['success',L('Success','成功')],['fail',L('Failure','失败')],['unknown',L('Result unknown','结果未知')],['concurrent',L('Another operator saved first','已被他人先行修改')],['removed',L('Removed by developers meanwhile','办理期间被开发移除')]]))}</div>
      <h4>${L('Token type entries · backend operations','代币类型条目 · 开发后端操作')}</h4><p class="fc-meta">${L('Token type entries are added and removed only by developers on the backend; issuing and syncing a token never adds one. Operations has no add or delete entry. The buttons below only simulate the results.','代币类型条目只由开发在后端新增或移除；代币发行与同步不会自动新增。运营端没有新增或删除入口，以下按钮只模拟结果。')}</p>
      <p class="fc-meta">${L('Token types in the token domain: ','代币域中的代币类型：')}${E([CF.parameterTokenNames.erc].concat(A.domainNew?[CF.parameterTokenNames.trc]:[]).join(L(', ','、')))}<br>${L('Entries in the parameter list: ','融资参数列表中的条目：')}${E(removals.map(r=>r.name).join(L(', ','、'))||L('none','无'))}</p>
      <div class="fc-demo-actions">${b('Token sync brings a new type','代币同步出现新类型','sync-token','','',A.domainNew||(!!extra&&!extra.removed))}${
        b('Developers add '+CF.parameterTokenNames.trc,'开发新增「'+CF.parameterTokenNames.trc+'」','add-token','','',!!extra&&!extra.removed)}${
        removals.map(r=>b('Developers remove '+r.name,'开发移除「'+r.name+'」','remove-token',r.id)).join('')}${
        b('Restore the default entries','恢复默认条目','restore-tokens')}</div>
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
    else if(act==='only-unset'){A.filter={...A.filter,status:'unset'};A.edit={...A.filter};A.page=1;saveContext();CF.render();}
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
    else if(act==='sync-token'){
      /* 代币域出现新类型不会带出融资参数条目：列表保持不变，直到开发在后端新增。 */
      A.domainNew=true;CF.render();
      CF.toast(L(CF.parameterTokenNames.trc+' now exists in the token domain. Developers have not added it, so the parameter list is unchanged.',CF.parameterTokenNames.trc+' 已出现在代币域；开发尚未新增，融资参数列表不变。'));
    }
    else if(act==='add-token'){
      /* 开发新增的条目两项参数为空、以未配置出现；同名条目被移除后再新增，按新的未配置条目处理，不恢复旧值，旧记录保留。 */
      const old=rowOf(CF.parameterTokenNames.trc);
      if(!old)A.rows.push(CF.parameterNewToken());
      else if(old.removed)Object.assign(old,{removed:false,maxRatio:null,maxTermMonths:null,updatedAt:null,updatedBy:null});
      A.domainNew=true;CF.render();
    }
    else if(act==='remove-token'){
      const r=rowOf(v);
      if(r){r.removed=true;if(A.draft&&A.draft.id===v)A.draft=null;
        CF.toast(L('Developers removed '+r.name+'. Projects already created are not affected; its change history is kept.','开发已移除「'+r.name+'」；已创建的项目不受影响，变更记录保留。'));}
      CF.render();
    }
    else if(act==='restart'||act==='restore-tokens'){
      const fresh=CF.parameterSeed();
      A.epoch++;A.rows=fresh.rows;A.draft=null;A.busy=false;A.error='';A.errorAction='';A.fieldErrors={};
      A.logShown=CF.PAGE_SIZE;A.logState='default';A.view='default';A.domainNew=false;
      if(act==='restart'){A.response='success';A.justSaved=null;grant('admin');}
      A.selected=A.rows[0].id;resetFilter();navigateRoute(listRoute());
    }
    else return false;
    return true;
  }
  /* 输入中只清除过期的错误，失焦或选定后再按该项重新校验；
     提交时浏览器会对被重绘移除的输入补发 change，取值未变时不抹掉刚给出的校验结果。 */
  function onInput(e,settle){
    if(A.busy||!A.draft)return;
    const id=e.target.id,key=id==='fc-ratio'?'ratio':id==='fc-term'?'term':null;
    if(!key)return;
    A.draft[key]=e.target.value;
    if(settle){if(A.draft[key]!==A.validated[key]&&(A.draft[key].trim()||A.fieldErrors[key]))checkField(key);}
    else if(A.fieldErrors[key]&&A.draft[key]!==A.validated[key])delete A.fieldErrors[key];
    paintField(key);
  }
  document.addEventListener('submit',e=>{
    if(e.target.id==='fc-filter-form'){e.preventDefault();onAct('fc-search','');}
    if(e.target.id==='fc-form'){e.preventDefault();onAct('fc-save','');}
  });
  document.addEventListener('input',e=>{
    if(e.target.id==='fc-f-q')A.edit.q=e.target.value;
    if(e.target.id==='fc-ratio')onInput(e,false);
  });
  document.addEventListener('focusout',e=>{if(e.target.id==='fc-ratio'&&e.target.isConnected)onInput(e,true);});
  document.addEventListener('change',e=>{
    const id=e.target.id,value=e.target.value;
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
      if(prev===DETAIL&&id!==DETAIL)A.justSaved=null;
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
