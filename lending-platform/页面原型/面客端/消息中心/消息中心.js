(function(CF){
  'use strict';
  const S=CF.S,N=CF.notifications,D=CF.NCData,L=CF.L,E=CF.esc;
  const LIST='P-F-MC-01',DETAIL='P-F-MC-02';
  /* 进度四态封闭，来源给出未知或非法值时降级为普通消息，不假装成功。 */
  const stateNames={active:['In progress','进行中'],pending:['Action required','待用户处理'],complete:['Completed','已完成'],failed:['Failed','已失败']};
  const stateColors={active:'accent',pending:'warn',complete:'ok',failed:'danger'};
  let view=null,previousRole=null,restore=false,renderedDetail=null,preflight=null,preflightTimer=null;
  let frame=null,positioning=false,detailTop=true,returnFocus=false;
  const defaultScrollRestoration=history.scrollRestoration;
  let busy=false,moreError=false,failMore=false,failRead=false,readError=false,refreshFail=false,readTimer=null;
  let timer=null,refreshes=0,detailFailure=false,landingDenied=false;
  const storageKey='hc-ws379-read-v1';
  let snapshotData=null,pool=null,poolReady=false;
  /* 演示池由 CF.LS / CF.CQ / CF.L7 / CF.L8 的现行事实派生，首次读取时才播种。 */
  Object.defineProperty(N,'rows',{configurable:true,
    get(){if(!poolReady){poolReady=true;D.ensure();loadRead();pool=D.rows;}return pool;},
    set(value){poolReady=true;pool=value;}});
  /* 双语取值兼容 {en,zh} 与既有模块的 [en,zh] 两种写法。 */
  const tr=v=>Array.isArray(v)?String(S.lang==='en'?v[0]:v[1]||v[0]||'')
    :(v&&typeof v==='object'?String(v[S.lang]||v.en||v.zh||''):(v==null?'':String(v)));
  /* 时刻按展示时区标注，业务日期按 UTC 日期显示；切换语言重算格式，事实值不变。 */
  const STAMP=/(_at|_time|_as_of)$/,DATEKEY=/_date$/;
  function varText(key,value){
    const raw=typeof value==='string'?value:'';
    if(STAMP.test(key)&&/^\d{4}-\d\d-\d\dT/.test(raw))return CF.fmtTime(raw);
    if(DATEKEY.test(key)&&/^\d{4}-\d\d-\d\d/.test(raw))return CF.fmtDate(raw);
    return tr(value);
  }
  const btn=(act,text,value='',extra='')=>'<button type="button" class="btn'+(['nc-jump','nc-confirm'].includes(act)?' primary':'')+'" data-act="'+act+'" data-v="'+E(value)+'" '+extra+'>'+text+'</button>';
  const path=()=>location.hash.slice(1).split('?')[0];
  const query=()=>new URLSearchParams(location.hash.split('?')[1]||'');
  const kindOf=biz=>String(biz||'').split('@')[0];
  function category(r){return D.categories[r.category]?r.category:'other';}
  function catName(key){return key==='other'?L('Other','其他'):tr(D.categories[key]);}
  function template(r,part){
    if(r.missing)return part==='title'?L('Notification','通知'):'';
    if(part==='body'&&r.literal)return r.literal;
    const set=D.templates[r.biz]||D.templates[kindOf(r.biz)],pair=set&&set[part];
    let raw=r.onlyZh&&pair?pair.zh:tr(pair);
    if(!raw)return part==='title'?L('Notification','通知'):'';
    return raw.replace(/\{([a-z0-9_]+)\}/g,(_,key)=>{
      const value=r.vars&&r.vars[key];
      return value==null?'':varText(key,value);
    }).replace(/[^\S\n]{2,}/g,' ').trim();
  }
  function businessInfo(r){
    const b=r.business;if(!b)return '';
    const st=stateNames[b.state],number=b.number?String(b.number):'';
    const step=b.step!=null&&b.total!=null&&b.step>0&&b.total>0&&b.step<=b.total;
    return '<section class="nc-progress" aria-labelledby="nc-business-name"><div class="nc-business-head"><h2 id="nc-business-name">'+E(tr(b.name))+'</h2>'+
      (st?CF.tag(stateColors[b.state],L(...st)):'')+'</div>'+
      (number?'<div class="nc-reference"><span>'+L('Reference','业务编号')+'</span><span class="mono">'+E(number)+'</span>'+
        CF.copyBtn('nc-copy',number,L('Copy reference','复制业务编号'))+'</div>':'')+
      '<dl class="nc-stage"><div><dt>'+L('Current step','当前环节')+'</dt><dd>'+E(tr(b.node))+'</dd></div>'+
      (step?'<div><dt>'+L('Progress','办理进度')+'</dt><dd>'+L('Step '+b.step+' of '+b.total,'第 '+b.step+' / '+b.total+' 步')+'</dd></div>':'')+'</dl></section>';
  }
  /* 逐期对照在同一封消息内完整给出，两侧缺项按来源留空，不截断、不拆成多封。 */
  function comparison(r){
    const set=r.installments;if(!set||!set.actual)return '';
    const rows=new Map();
    (set.planned||[]).forEach(p=>rows.set(p.seq,{seq:p.seq,planned:p}));
    set.actual.forEach(p=>rows.set(p.seq,Object.assign(rows.get(p.seq)||{seq:p.seq},{actual:p})));
    const cell=p=>p?'<span class="nc-cell-date">'+CF.fmtDate(p.due)+'</span><span class="nc-cell-amt mono">'+CF.fmtAmt(p.total,'USD')+
      (set.ccy&&set.ccy!=='USD'?'<span class="nc-cell-sub">'+CF.fmtAmt(p.settlement,set.ccy)+'</span>':'')+'</span>':'<span class="nc-cell-none">—</span>';
    return '<section class="nc-compare"><h2>'+L('Installment comparison','逐期对照')+'</h2>'+
      '<div class="nc-compare-grid" role="table" aria-label="'+L('Estimated and finalized installments','预计与定稿逐期对照')+'">'+
      '<div class="nc-compare-row nc-compare-head" role="row"><span role="columnheader">'+L('Installment','期次')+'</span>'+
      '<span role="columnheader">'+L('Estimated','预计')+'</span><span role="columnheader">'+L('Finalized','定稿')+'</span></div>'+
      [...rows.values()].sort((a,b)=>a.seq-b.seq).map(row=>'<div class="nc-compare-row" role="row">'+
        '<span role="rowheader">'+L('No. '+row.seq,'第 '+row.seq+' 期')+'</span>'+
        '<span role="cell">'+cell(row.planned)+'</span><span role="cell">'+cell(row.actual)+'</span></div>').join('')+
      '</div></section>';
  }
  function readLabel(r){return r.read?L('Read','已读'):L('Unread','未读');}
  function readBadge(r){return '<span class="nc-read-state '+(r.read?'is-read':'is-unread')+'">'+readLabel(r)+'</span>';}
  function meta(r){return '<div class="nc-meta">'+readBadge(r)+'<span>'+E(catName(category(r)))+'</span>'+ (N.expired(r)?'<span>'+L('Expired','已过期')+'</span>':'')+'</div>';}
  function summary(r){
    const body=template(r,'body');
    if(body)return E(body.split('\n').map(s=>s.trim()).filter(Boolean)[0]||'');
    const b=r.business;if(!b)return '';
    const st=stateNames[b.state];
    return [tr(b.node),st?L(...st):''].filter(Boolean).map(E).join(' · ');
  }
  N.preview=r=>'<span class="nc-preview-heading"><span class="nc-preview-title">'+E(template(r,'title'))+'</span>'+readBadge(r)+'</span><span class="nc-preview-summary">'+summary(r)+'</span><span class="nc-meta">'+E(catName(category(r)))+(N.expired(r)?' · '+L('Expired','已过期'):'')+'</span><time class="nc-time" datetime="'+r.at+'">'+CF.fmtTime(r.at)+'</time>';
  function saveRead(ids){
    try{
      const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');
      N.visible().forEach(r=>{if(ids.includes(r.id))saved[r.id]=true;});
      localStorage.setItem(storageKey,JSON.stringify(saved));
    }catch(e){/* file:// 或禁用存储时本页会话仍可操作。 */}
  }
  N.onRead=saveRead;
  function loadRead(){try{const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');D.rows.forEach(r=>{if(saved[r.id])r.read=true;});}catch(e){}}
  function filters(){const q=query();return {cat:q.get('category')||'',status:['unread','read'].includes(q.get('status'))?q.get('status'):''};}
  function matches(r,f){return (!f.cat||category(r)===f.cat)&&(!f.status||(f.status==='read')===r.read);}
  function ensureView(){
    const f=filters(),key=S.role+'|'+f.cat+'|'+f.status;
    if(!view||view.key!==key)view={key,f,ids:N.visible().filter(r=>matches(r,f)).map(r=>r.id),shown:20,window:0,anchor:null,focus:null,hash:location.hash};
    return view;
  }
  function snapshot(){
    if(!view||positioning||path()!=='/notifications')return;
    const box=document.getElementById('nc-list');if(!box)return;
    view.window=window.scrollY;
    const header=document.querySelector('.portal-head'),toolbar=document.querySelector('.nc-filters');
    const edge=(header?.offsetHeight||0)+(window.innerWidth>900?(toolbar?.offsetHeight||0):0);
    const row=[...box.querySelectorAll('.nc-row')].find(el=>el.getBoundingClientRect().bottom>edge);
    view.anchor=row&&view.window>0?{id:row.dataset.id,top:row.getBoundingClientRect().top}:null;
  }
  function headerOffset(){document.querySelector('.nc-layout')?.style.setProperty('--nc-header-height',(document.querySelector('.portal-head')?.offsetHeight||68)+'px');}
  function restorePosition(top=false){
    cancelAnimationFrame(frame);positioning=true;
    const current=view,focus=returnFocus;returnFocus=false;
    frame=requestAnimationFrame(()=>{
      headerOffset();
      if(top)window.scrollTo(0,0);
      else if(current){
        const row=current.anchor&&[...document.querySelectorAll('.nc-row')].find(el=>el.dataset.id===current.anchor.id);
        window.scrollTo(0,row?window.scrollY+row.getBoundingClientRect().top-current.anchor.top:current.window);
        if(focus&&current.focus)[...document.querySelectorAll('.nc-row')].find(el=>el.dataset.id===current.focus)?.querySelector('.nc-title')?.focus({preventScroll:true});
      }
      positioning=false;snapshot();
    });
  }
  function resetView(){view=null;moreError=false;readError=false;S.toTop=true;}
  function newMessages(){
    if(!view)return;
    const ids=new Set(view.ids),fresh=N.visible().filter(r=>!ids.has(r.id)&&matches(r,view.f));
    if(fresh.length){view.ids=fresh.map(r=>r.id).concat(view.ids);view.shown+=fresh.length;}
  }
  function rowsInView(){const v=ensureView(),map=new Map(N.visible().map(r=>[r.id,r]));return v.ids.map(id=>map.get(id)).filter(Boolean);}
  function stateSurface(){
    if(S.st==='loading')return '<div class="nc-skeleton" role="status" aria-label="'+L('Loading messages','正在加载消息')+'">'+Array.from({length:4},()=>'<div class="nc-skeleton-row" aria-hidden="true"><span class="skel"></span><span class="skel"></span><span class="skel"></span></div>').join('')+'</div>';
    if(S.st==='error')return CF.empty(L('Failed to load. Please try again','加载失败，请重试'),'',btn('retry',L('Retry','重试')));
    return CF.surface({emptyTitle:L('You have no messages yet','还没有任何消息'),emptyDesc:'',skelRows:5});
  }
  function listRow(r){return '<article class="nc-row" data-id="'+E(r.id)+'" data-unread="'+!r.read+'"><a class="nc-title nc-message-link" href="#/notification?id='+encodeURIComponent(r.id)+'">'+
    '<span class="nc-message-heading"><span class="nc-message-title">'+E(template(r,'title'))+'</span>'+readBadge(r)+'</span>'+
    (summary(r)?'<span class="nc-summary">'+summary(r)+'</span>':'')+
    '<span class="nc-message-foot"><span class="nc-message-category">'+E(catName(category(r)))+(N.expired(r)?' · '+L('Expired','已过期'):'')+'</span><time class="nc-time" datetime="'+r.at+'">'+CF.fmtTime(r.at)+'</time></span></a></article>';}
  function renderList(){
    const v=ensureView(),all=N.visible(),rows=rowsInView(),count=all.filter(r=>matches(r,v.f)&&!r.read).length;
    const cats=[...new Set(all.map(category))];
    const opt=(value,label,cur)=>'<option value="'+E(value)+'" '+(value===cur?'selected':'')+'>'+E(label)+'</option>';
    const filter='<div class="nc-filters nc-inbox-filters"><div class="nc-status-options" role="group" aria-label="'+L('Message status','消息状态')+'">'+[['',L('All','全部')],['unread',L('Unread','未读')],['read',L('Read','已读')]].map(o=>'<button type="button" data-act="nc-status" data-v="'+o[0]+'" aria-pressed="'+(v.f.status===o[0])+'">'+o[1]+'</button>').join('')+'</div>'+
      '<div class="nc-category-field"><label for="nc-category">'+L('Category','分类')+'</label><select class="inp" id="nc-category">'+opt('',L('All categories','全部分类'),v.f.cat)+cats.map(c=>opt(c,catName(c),v.f.cat)).join('')+'</select></div>'+btn('nc-all',L('Mark all as read','全部已读'),'',(!count||busy||S.st!=='default')?'disabled':'')+'</div>';
    let body=stateSurface();
    if(!body){
      if(!rows.length)body=v.f.cat||v.f.status?CF.empty(L('No messages match the current filter','当前筛选下没有消息'),'',btn('nc-clear',L('Clear filters','清除筛选'))):CF.empty(L('You have no messages yet','还没有任何消息'),'','');
      else body=rows.slice(0,v.shown).map(listRow).join('')+'<div class="loadmore">'+
        (moreError?'<span role="alert">'+L('Failed to load. Please try again','加载失败，请重试')+'</span>':'')+
        (v.shown<rows.length?btn('nc-more',busy?L('Loading…','加载中…'):L('Load more','加载更多'),'',busy?'disabled':''):'<span>'+L('No more messages','没有更多了')+'</span>')+
        '<span class="tiny" role="status">'+L('Showing '+Math.min(v.shown,rows.length)+' of '+rows.length,'已显示 '+Math.min(v.shown,rows.length)+' / '+rows.length+' 条')+'</span>'+btn('nc-top',L('Back to filters','返回筛选'))+'</div>';
    }
    return '<div class="nc-layout nc-inbox"><div class="nc-head"><h1 class="page-title">'+L('Notifications','消息中心')+'</h1><p class="page-sub">'+L('Account updates and business progress','账户动态与业务进展')+'</p></div>'+filter+'<div class="nc-result-count" role="status">'+L(rows.length+' messages',rows.length+' 条消息')+'</div><section class="nc-feed">'+
      (readError?'<div class="nc-feedback">'+CF.note('red',L('Could not mark as read. Try again.','标为已读失败，请重试。'))+'</div>':'')+
      '<div class="nc-list" id="nc-list" aria-label="'+L('Messages','消息列表')+'">'+body+'</div></section></div>';
  }
  function lookup(){return N.visible().find(r=>r.id===query().get('id'));}
  /* 进入详情才检查业务目标：期次或放款尚未产生时回落到仍可读的原对象，
     不存在或无权统一给同一不可用说明，不泄露其存在性。 */
  function resolve(r){
    const type=!N.expired(r)&&D.types[kindOf(r.biz)];
    if(!type||type.mode==='none')return null;
    if(type.mode==='page')return {mode:'page',target:type.target,status:'ok'};
    /* 来源没有给出原对象时按无跳转处理：保留正文，不提供伪业务入口。 */
    if(!r.objectKind||!r.objectId)return null;
    if(r.objectKind==='project')
      return {mode:'object',kind:'project',id:r.objectId,status:CF.LS?.project?.(r.objectId)?'ok':'gone'};
    const quote=CF.CQ?.data?.().quotes.find(x=>x.id===r.objectId);
    if(!quote)return {mode:'object',kind:r.objectKind,id:r.objectId,status:'gone'};
    const chain=['project','quote','loan','repayment'];
    const has={project:!!CF.LS?.project?.(r.objectProject||quote.project),quote:true,loan:!!quote.l7,
      repayment:!!(quote.l8&&(!r.period||quote.l8.periods.some(p=>p.id===r.period)))};
    const base={mode:'object',id:quote.id,project:r.objectProject||quote.project,period:r.period};
    if(has[r.objectKind])return {...base,kind:r.objectKind,status:'ok'};
    const fallback=chain.slice(0,chain.indexOf(r.objectKind)).reverse().find(k=>has[k]);
    return fallback?{...base,kind:fallback,period:null,status:'changed'}:{...base,kind:r.objectKind,status:'gone'};
  }
  function startPreflight(r){
    if(preflight&&preflight.id===r.id)return;
    clearTimeout(preflightTimer);
    const target=resolve(r);
    preflight={id:r.id,status:target&&target.mode==='object'?'pending':'ok',target};
    if(preflight.status==='pending'){
      const owner=S.role,id=r.id,slow=r.check==='timeout';
      preflightTimer=setTimeout(()=>{
        if(!N.allowed()||owner!==S.role||path()!=='/notification'||query().get('id')!==id)return;
        /* 检查超时不判定结论：仍允许尝试前往，由目标页重新判权。 */
        preflight.status=slow?'ok':r.check==='denied'?'gone':target.status;preflight.target=target;CF.render();
      },slow?3000:450);
    }
  }
  function renderDetail(){
    const r=lookup();renderedDetail=null;
    if(S.st==='loading')return CF.skelTable(4);
    if(S.st==='error'||detailFailure)return CF.empty(L('Failed to load. Please try again','加载失败，请重试'),'',btn('nc-detail-retry',L('Retry','重试')));
    if(!r)return CF.empty(L('The related content is unavailable','相关内容暂不可访问'),'','');
    startPreflight(r);
    const target=resolve(r),check=preflight.status;
    const gone=check==='gone',changed=check==='changed';
    const reason=gone?L('The related content is unavailable','相关内容暂不可访问')
      :changed?L('This action is no longer available. View the original record','该操作已不适用，可查看原记录'):'';
    const title=E(template(r,'title')),body=E(template(r,'body'));
    renderedDetail=r.id;
    const label=check==='pending'?L('Checking…','正在检查…'):changed?L('View original record','查看原记录'):L('View related item','查看相关内容');
    return '<div class="nc-detail nc-reading"><article class="card"><div class="card-b"><h1>'+title+'</h1><div class="nc-reading-meta">'+meta(r)+'<time class="nc-time" datetime="'+r.at+'">'+CF.fmtTime(r.at)+'</time></div>'+
      (readError?'<div class="nc-read-feedback" role="alert"><span>'+L('Could not mark as read. Try again.','标为已读失败，请重试。')+'</span>'+btn('nc-read',L('Retry','重试'),r.id,busy?'disabled':'')+'</div>':'')+
      (body?'<div class="nc-body">'+body+'</div>':'')+comparison(r)+businessInfo(r)+
      (target?'<footer class="nc-actions">'+(reason?'<p id="nc-reason" tabindex="0">'+reason+'</p>':'')+
        btn('nc-jump',label,r.id,gone?'aria-disabled="true" aria-describedby="nc-reason"':check==='pending'?'disabled':changed?'aria-describedby="nc-reason"':'')+'</footer>':'')+
      '</div></article></div>';
  }
  function mark(ids){
    if(busy||!N.allowed())return;
    busy=true;readError=false;const owner=S.role;
    readTimer=setTimeout(()=>{
      busy=false;if(!N.allowed()||S.role!==owner)return;
      if(failRead){failRead=false;readError=true;CF.render();return;}
      N.markRead(ids);if(S.layer)CF.closeLayer();else CF.render();CF.toast(L('Marked as read','已标为已读'));
    },450);
  }
  function refresh(){
    if(!N.allowed()||document.hidden)return;
    refreshes++;
    if(refreshFail)return;
    loadRead();newMessages();CF.render();
  }
  function schedule(){clearInterval(timer);timer=null;if(N.allowed()&&!document.hidden)timer=setInterval(refresh,60000);}
  function demo(){
    const action=(k,en,zh)=>btn('nc-demo',L(en,zh),k);
    return '<div class="grp"><h5>'+L('Message scenarios','消息演示场景')+'</h5><div class="seg">'+
      action('reset','Reset demo','重置演示')+action('new','Add a new business type','追加新业务类型')+action('empty','Empty inbox','空消息池')+
      action('many','99+ unread','99+ 未读')+action('panel-loading','Panel loading','面板加载中')+action('panel-error','Panel failure','面板失败')+
      action('more-fail','Next load fails','下次加载更多失败')+action('read-fail','Next read fails','下次已读操作失败')+action('refresh-fail','Refresh fails','刷新失败保留角标')+
      action('refresh','Refresh now','立即刷新')+action('expire','Expire session','会话失效')+action('detail-fail','Detail request fails','详情请求失败')+
      action('normal','Valid deep link','正常深链')+action('plan','Schedule comparison','逐期对照消息')+action('degraded','Degraded content','内容降级消息')+
      action('unavailable','Unavailable target','目标不可访问')+action('superseded','Action no longer applies','原动作已不适用')+
      action('guest','Signed-out deep link','未登录深链')+action('denied','Restricted deep link','无权限深链')+action('unknown','Unknown deep link','未知深链')+
      action('landing','Deny next landing','下次落地重判权失败')+'</div><p class="tiny">'+L('Local demonstration data. Refresh attempts: ','本地演示数据。刷新次数：')+refreshes+'</p></div>';
  }
  function firstRow(match,owner='asset'){const rows=D.rows.filter(r=>r.owner===owner&&r.platform==='lending');return (rows.find(match)||rows[0]||{}).id;}

  [LIST,DETAIL].forEach(id=>CF.review.register(id,{
    group:['Notifications','消息中心'],
    states:()=>!N.allowed()?['default']:id===LIST?['default','loading','empty','noresult','error','denied']:['default','loading','error','denied'],
    route:()=>id===LIST?'/notifications':N.visible()[0]?'/notification?id='+encodeURIComponent(N.visible()[0].id):null,
    set(value){resetView();detailFailure=readError=false;S.st=value;},
    reset(){detailFailure=readError=failRead=failMore=refreshFail=landingDenied=false;S.st='default';}
  }));

  CF.define(CF.NCView={id:'portal-notifications',pages:[LIST,DETAIL],
    dict:{en:{navNotifications:'Notifications',navNotification:'Message details'},zh:{navNotifications:'消息中心',navNotification:'消息详情'}},demo,
    breadcrumbRoute(id){return id===LIST&&view?view.hash.slice(1):null;},
    beforeRender(){
      snapshot();renderedDetail=null;
      if(!snapshotData)snapshotData=JSON.stringify({rows:N.rows,categories:D.categories,types:D.types,templates:D.templates});
      if(previousRole!==S.role){resetView();preflight=null;clearTimeout(preflightTimer);clearTimeout(readTimer);busy=false;S.layer=null;previousRole=S.role;schedule();}
      if(!N.allowed()){clearTimeout(preflightTimer);clearTimeout(readTimer);preflight=null;renderedDetail=null;busy=false;clearInterval(timer);timer=null;}
    },
    afterRender(){
      if(N.allowed()&&S.page===DETAIL&&renderedDetail){
        const r=lookup();if(r&&!r.read&&!readError){if(failRead){failRead=false;readError=true;queueMicrotask(()=>CF.render());}else{N.markRead([r.id]);document.querySelectorAll('.nc-detail .nc-meta').forEach((node,i)=>{if(i===0)node.outerHTML=meta(r);});}}
      }
      if(S.page===LIST||S.page===DETAIL)history.scrollRestoration='manual';
      else history.scrollRestoration=defaultScrollRestoration;
      if(S.page===LIST&&view){headerOffset();const top=S.toTop&&!restore;S.toTop=false;restorePosition(top);restore=false;}
      if(S.page===DETAIL&&detailTop){S.toTop=false;detailTop=false;restorePosition(true);}
      if(CF.renderFooter&&(S.page===LIST||S.page===DETAIL))CF.renderFooter();
    },
    onRoute(from,to){if(from===DETAIL&&to===LIST){restore=true;returnFocus=true;}if(to===DETAIL)detailTop=true;if(to!==DETAIL){clearTimeout(preflightTimer);preflight=null;}},
    content(page){const guard=CF.authSurface();if(guard)return '<div class="card nc-layout">'+guard+'</div>';if(S.st==='denied')return CF.empty(L('Complete your account setup','请先完成账户必办事项'),L('Complete the required steps to continue.','完成必办事项后即可继续。'),btn('prerequisite',L('Continue setup','继续完善')));return page===LIST?renderList():renderDetail();},
    layers:{'nc-confirm':()=>{const data=S.layer.data;return {title:L('Mark all as read?','确认全部已读？'),html:'<p>'+L('Mark '+data.ids.length+' unread message(s) under the current filter as read.','将把当前筛选下的 '+data.ids.length+' 条未读消息标为已读。')+'</p><p>'+L('Category: ','分类：')+E(data.cat)+'；'+L('Status: ','状态：')+E(data.status)+'</p>'+(readError?CF.note('red',L('Could not mark as read. Try again.','标为已读失败，请重试。')):''),foot:btn('closelayer',L('Cancel','取消'),'',busy?'disabled':'')+btn('nc-confirm',busy?L('Saving…','正在处理…'):L('Confirm','确认'),'',busy?'disabled':'')};}},
    onBeforeAct(act){if(act==='closelayer'&&busy)return true;if(act==='clearfilter'&&(S.page===LIST||S.page===DETAIL)){resetView();S.st='default';location.hash='#/notifications';return true;}if(act==='st'){detailFailure=false;readError=false;resetView();}return false;},
    onAct(act,v){
      if(act==='nc-status'){if(filters().status===v)return true;const q=query();if(v)q.set('status',v);else q.delete('status');resetView();location.hash='#/notifications'+(q.size?'?'+q:'');return true;}
      if(act==='nc-top'){window.scrollTo(0,0);document.getElementById('nc-category')?.focus({preventScroll:true});snapshot();return true;}
      if(act==='nc-clear'){resetView();S.st='default';location.hash='#/notifications';return true;}
      if(act==='nc-more'){if(busy)return true;busy=true;moreError=false;const owner=S.role,key=view.key;setTimeout(()=>{busy=false;if(owner!==S.role||!view||view.key!==key)return;if(failMore){failMore=false;moreError=true;}else view.shown+=20;CF.render();},450);return true;}
      if(act==='nc-read'){mark([v]);return true;}
      if(act==='nc-all'){const f=ensureView().f;readError=false;CF.openLayer('modal','nc-confirm',{ids:N.visible().filter(r=>matches(r,f)&&!r.read).map(r=>r.id),cat:f.cat?catName(f.cat):L('All','全部'),status:f.status==='unread'?L('Unread','未读'):f.status==='read'?L('Read','已读'):L('All','全部')});return true;}
      if(act==='nc-confirm'){mark(S.layer.data.ids);return true;}
      if(act==='nc-detail-retry'){detailFailure=false;S.st='default';readError=false;return true;}
      if(act==='nc-copy'){if(navigator.clipboard)navigator.clipboard.writeText(v).then(()=>CF.toast(L('Copied','已复制'))).catch(()=>CF.toast(L('Select the reference to copy it.','请选中编号后复制。')));else CF.toast(L('Select the reference to copy it.','请选中编号后复制。'));return true;}
      if(act==='nc-jump'){
        const r=lookup(),t=r&&preflight&&preflight.id===r.id?preflight.target:r&&resolve(r);
        if(!t||preflight.status==='pending'||preflight.status==='gone')return true;
        if(landingDenied){landingDenied=false;S.role='limited';return true;}
        if(CF.openNotificationTarget)CF.openNotificationTarget(t,r);
        else CF.enterPage(t.mode==='page'?t.target:'lending:P-LS-01',null);
        return true;
      }
      if(act==='nc-demo'){
        if(v==='reset'){Object.assign(D,JSON.parse(snapshotData));N.rows=D.rows;try{localStorage.removeItem(storageKey);}catch(e){}resetView();S.role='asset';S.st='default';N.panelState='default';refreshFail=failRead=failMore=detailFailure=readError=landingDenied=false;location.hash='#/notifications';}
        if(v==='new'){D.addType();N.rows=D.rows;newMessages();}
        if(v==='empty'){N.rows=[];resetView();S.st='default';location.hash='#/notifications';}
        if(v==='many'){N.rows=D.rows;N.visible().forEach(r=>r.read=false);resetView();S.st='default';location.hash='#/notifications';}
        if(v==='panel-loading'||v==='panel-error'){N.panelState=v==='panel-loading'?'loading':'error';S.menu='notifications';}
        if(v==='more-fail'){failMore=true;CF.toast(L('Next load will fail — demo.','下一次加载更多将失败 —— 演示。'));}
        if(v==='read-fail'){failRead=true;CF.toast(L('Next read will fail — demo.','下一次已读操作将失败 —— 演示。'));}
        if(v==='refresh-fail'){refreshFail=true;refresh();}
        if(v==='refresh'){refreshFail=false;refresh();}
        if(v==='expire'){S.role='guest';S.menu=null;S.layer=null;S.st='default';}
        if(v==='detail-fail'){detailFailure=true;CF.enterPage('lending:'+DETAIL,{id:firstRow(r=>!!r.business)});}
        if(['normal','guest','denied'].includes(v)){S.role=v==='guest'?'guest':v==='denied'?'limited':'asset';S.st='default';detailFailure=false;preflight=null;CF.enterPage('lending:'+DETAIL,{id:firstRow(r=>!!r.business)});}
        if(['plan','degraded','unavailable','superseded'].includes(v)){
          const pick={plan:r=>!!r.installments,degraded:r=>r.id==='nc-fixture-missing-template',
            unavailable:r=>r.id==='nc-fixture-denied-target',
            superseded:r=>r.objectKind==='repayment'&&!CF.CQ.data().quotes.find(x=>x.id===r.objectId)?.l8}[v];
          const owner=v==='superseded'?'fund':'asset';
          S.role=owner;S.st='default';detailFailure=false;preflight=null;
          CF.enterPage('lending:'+DETAIL,{id:firstRow(pick,owner)});
        }
        if(v==='unknown')CF.enterPage('unknown:missing');
        if(v==='landing'){landingDenied=true;CF.toast(L('Next landing will require account setup — demo.','下次落地将进入必办事项引导 —— 演示。'));}
        return true;
      }
      return false;
    }
  });
  window.addEventListener('scroll',snapshot,{passive:true});
  window.addEventListener('resize',headerOffset);
  document.addEventListener('click',e=>{const link=e.target.closest('.nc-title');if(link&&view){snapshot();view.focus=link.closest('.nc-row').dataset.id;}},true);
  document.addEventListener('change',e=>{
    if(e.target.id!=='nc-category')return;
    const cat=e.target.value,status=filters().status,q=new URLSearchParams();
    if(cat)q.set('category',cat);if(status)q.set('status',status);resetView();location.hash='#/notifications'+(q.size?'?'+q:'');
  });
  window.addEventListener('storage',e=>{if(e.key===storageKey&&N.allowed()){loadRead();CF.render();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();schedule();});
  window.addEventListener('pagehide',()=>{clearInterval(timer);clearTimeout(preflightTimer);clearTimeout(readTimer);});
  if(CF.notificationLanding){if(!location.hash)location.hash='#/assets';S.role='asset';}
  if(!CF.portalConnected)CF.boot();
})(window.CF);
