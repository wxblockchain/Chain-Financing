(function(CF){
  'use strict';
  const S=CF.S,N=CF.notifications,D=CF.NCData,L=CF.L,E=CF.esc;
  const LIST='P-F-MC-01',DETAIL='P-F-MC-02';
  const stateNames={active:['In progress','进行中'],pending:['Action required','待处理'],complete:['Completed','已完成'],failed:['Failed','已失败']};
  const stateColors={active:'accent',pending:'warn',complete:'ok',failed:'danger'};
  let view=null,previousRole=null,restore=false,renderedDetail=null,preflight=null,preflightTimer=null;
  let frame=null,positioning=false,detailTop=true,returnFocus=false;
  const defaultScrollRestoration=history.scrollRestoration;
  let busy=false,moreError=false,failMore=false,failRead=false,readError=false,refreshFail=false,readTimer=null;
  let timer=null,refreshes=0,detailFailure=false,landingDenied=false;
  const storageKey='harbour-notification-demo-v1';
  const initialData=JSON.stringify({rows:D.rows,categories:D.categories,types:D.types,templates:D.templates});
  const tr=p=>p ? p[S.lang]||p.en||p.zh||'' : '';
  const btn=(act,text,value='',extra='')=>'<button type="button" class="btn'+(['nc-jump','nc-confirm'].includes(act)?' primary':'')+'" data-act="'+act+'" data-v="'+E(value)+'" '+extra+'>'+text+'</button>';
  const path=()=>location.hash.slice(1).split('?')[0];
  const query=()=>new URLSearchParams(location.hash.split('?')[1]||'');
  function category(r){return D.categories[r.category]?r.category:'other';}
  function catName(key){return key==='other'?L('Other','其他'):tr(D.categories[key]);}
  function template(r,part){
    if(r.missing)return part==='title'?L('Notification','通知'):'';
    if(part==='body'&&r.literal)return r.literal;
    const pair=D.templates[r.biz]&&D.templates[r.biz][part];
    let raw=r.onlyZh&&pair?pair.zh:tr(pair);
    if(!raw)return part==='title'?L('Notification','通知'):'';
    return raw.replace(/\{([a-z_]+)\}/g,(_,k)=>r.vars&&r.vars[k]!=null?r.vars[k]:'').replace(/[^\S\n]{2,}/g,' ').trim();
  }
  function progress(r,detail=false){
    const p=r.progress;if(!p)return '';
    const st=stateNames[p.state];
    let line='<div class="nc-progress-line"><span>'+E(tr(p.node))+'</span>'+(st?CF.tag(stateColors[p.state],L(...st)):'')+
      (p.step!=null&&p.total!=null?'<span class="tiny">'+L('Step '+p.step+'/'+p.total,'第 '+p.step+'/'+p.total+' 步')+'</span>':'')+'</div>';
    if(!detail)return line;
    return '<section class="nc-progress"><h2>'+E(tr(p.name))+'</h2>'+(p.number?'<div class="nc-meta"><span class="mono">'+E(p.number)+'</span>'+btn('nc-copy',L('Copy','复制'),p.number)+'</div>':'')+line+'</section>';
  }
  function readLabel(r){return r.read?L('Read','已读'):L('Unread','未读');}
  function meta(r){return '<div class="nc-meta">'+(!r.read?'<span class="nc-dot" aria-hidden="true"></span>':'')+'<span>'+readLabel(r)+'</span><span aria-hidden="true">·</span><span>'+E(catName(category(r)))+'</span>'+ (N.expired(r)?CF.tag('gray',L('Expired','已过期')):'')+'</div>';}
  N.rows=D.rows;
  N.preview=r=>meta(r)+'<span class="nc-preview-title">'+E(template(r,'title'))+'</span>'+progress(r)+'<time class="nc-time" datetime="'+r.at+'">'+CF.fmtTime(r.at)+'</time>';
  function saveRead(ids){
    try{
      const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');
      N.visible().forEach(r=>{if(ids.includes(r.id))saved[r.id]=true;});
      localStorage.setItem(storageKey,JSON.stringify(saved));
    }catch(e){/* file:// 或禁用存储时本页会话仍可操作。 */}
  }
  N.onRead=saveRead;
  function loadRead(){try{const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');N.rows.forEach(r=>{if(saved[r.id])r.read=true;});}catch(e){}}
  loadRead();
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
    return CF.surface({emptyTitle:L('You have no messages yet','还没有任何消息'),emptyDesc:'',skelRows:5});
  }
  function listRow(r){return '<article class="nc-row" data-id="'+E(r.id)+'" data-unread="'+!r.read+'"><div class="nc-row-main">'+meta(r)+
    '<a class="nc-title" href="#/notification?id='+encodeURIComponent(r.id)+'">'+E(template(r,'title'))+'</a>'+
    (r.progress?progress(r):'<p class="nc-summary">'+E(template(r,'body'))+'</p>')+'</div><div class="nc-row-aside"><time class="nc-time" datetime="'+r.at+'">'+CF.fmtTime(r.at)+'</time>'+
    (!r.read?btn('nc-read',L('Mark as read','标为已读'),r.id,busy?'disabled':''):'<span class="tiny nc-read-label">'+L('Read','已读')+'</span>')+'</div></article>';}
  function renderList(){
    const v=ensureView(),all=N.visible(),rows=rowsInView(),count=all.filter(r=>matches(r,v.f)&&!r.read).length;
    const cats=[...new Set(all.map(category))];
    const opt=(value,label,cur)=>'<option value="'+E(value)+'" '+(value===cur?'selected':'')+'>'+E(label)+'</option>';
    const filter='<div class="nc-filters"><div class="field"><label for="nc-category">'+L('Category','分类')+'</label><select class="inp" id="nc-category">'+opt('',L('All','全部'),v.f.cat)+cats.map(c=>opt(c,catName(c),v.f.cat)).join('')+'</select></div>'+
      '<div class="field"><label for="nc-status">'+L('Status','状态')+'</label><select class="inp" id="nc-status">'+[['',L('All','全部')],['unread',L('Unread','未读')],['read',L('Read','已读')]].map(o=>opt(o[0],o[1],v.f.status)).join('')+'</select></div><span class="nc-count">'+L(rows.length+' messages',rows.length+' 条消息')+'</span>'+btn('nc-all',L('Mark all as read','全部已读'),'',(!count||busy||S.st!=='default')?'disabled':'')+'</div>';
    let body=stateSurface();
    if(!body){
      if(!rows.length)body=v.f.cat||v.f.status?CF.empty(L('No messages match the current filter','当前筛选下没有消息'),'',btn('nc-clear',L('Clear filters','清除筛选'))):CF.empty(L('You have no messages yet','还没有任何消息'),'','');
      else body=rows.slice(0,v.shown).map(listRow).join('')+'<div class="loadmore">'+
        (moreError?'<span role="alert">'+L('Failed to load. Please try again','加载失败，请重试')+'</span>':'')+
        (v.shown<rows.length?btn('nc-more',busy?L('Loading…','加载中…'):L('Load more','加载更多'),'',busy?'disabled':''):'<span>'+L('No more messages','没有更多了')+'</span>')+
        '<span class="tiny" role="status">'+L('Showing '+Math.min(v.shown,rows.length)+' of '+rows.length,'已显示 '+Math.min(v.shown,rows.length)+' / '+rows.length+' 条')+'</span>'+btn('nc-top',L('Back to filters','返回筛选'))+'</div>';
    }
    return '<div class="nc-layout"><div class="nc-head"><div><h1 class="page-title">'+L('Notifications','消息中心')+'</h1><p class="page-sub">'+L('Your updates, in one place.','在这里查看与你有关的最新动态。')+'</p></div></div>'+filter+'<section class="nc-feed">'+
      (readError?'<div class="nc-feedback">'+CF.note('red',L('Could not mark as read. Try again.','标为已读失败，请重试。'))+'</div>':'')+
      '<div class="nc-list" id="nc-list" aria-label="'+L('Messages','消息列表')+'">'+body+'</div></section></div>';
  }
  function lookup(){return N.visible().find(r=>r.id===query().get('id'));}
  function backLink(){return '<a class="btn-link nc-back" href="'+E(view?view.hash:'#/notifications')+'">← '+L('Back to list','返回列表')+'</a>';}
  function targetOf(r){return !N.expired(r)&&D.types[r.biz]&&D.types[r.biz].mode!=='none'?D.types[r.biz]:null;}
  function startPreflight(r){
    if(preflight&&preflight.id===r.id)return;
    clearTimeout(preflightTimer);
    const type=targetOf(r);
    preflight={id:r.id,status:type&&type.mode==='object'&&type.preflight!==false?'pending':'ok'};
    if(preflight.status==='pending'){
      const owner=S.role,id=r.id;
      preflightTimer=setTimeout(()=>{
        if(!N.allowed()||owner!==S.role||path()!=='/notification'||query().get('id')!==id)return;
        preflight.status=r.check==='timeout'?'ok':r.check||'ok';CF.render();
      },r.check==='timeout'?3000:450);
    }
  }
  function renderDetail(){
    const back=backLink(),r=lookup();renderedDetail=null;
    if(S.st==='loading')return back+CF.skelTable(4);
    if(S.st==='error'||detailFailure)return back+CF.empty(L('Failed to load. Please try again','加载失败，请重试'),'',btn('nc-detail-retry',L('Retry','重试')));
    if(!r)return back+CF.empty(L('Message not found','消息不存在'),'','');
    startPreflight(r);
    const target=targetOf(r),check=preflight.status;
    const reason={deleted:L('The related item has been deleted','相关内容已被删除'),changed:L('The status of the related item has changed','相关内容的状态已变化'),denied:L('You do not have permission to view this item','你当前没有查看该内容的权限')}[check];
    const title=E(template(r,'title')),body=E(template(r,'body'));
    renderedDetail=r.id;
    return '<div class="nc-detail">'+back+'<article class="card"><div class="card-b">'+meta(r)+'<h1>'+title+'</h1><time class="nc-time" datetime="'+r.at+'">'+CF.fmtTime(r.at)+'</time>'+progress(r,true)+'<div class="nc-body">'+body+'</div>'+
      (reason?'<div id="nc-reason" tabindex="0">'+CF.note('warn',reason)+'</div>':'')+
      (readError?CF.note('red',L('Could not mark as read. Try again.','标为已读失败，请重试。'))+btn('nc-read',L('Retry','重试'),r.id):'')+
      '<div class="nc-actions">'+(target?btn('nc-jump',check==='pending'?L('Checking…','正在检查…'):L('View related item','查看相关内容'),r.id,(reason?'aria-disabled="true" aria-describedby="nc-reason"':check==='pending'?'disabled':'')):'')+
      '<a class="btn" href="'+E(view?view.hash:'#/notifications')+'">'+L('Back to list','返回列表')+'</a></div></div></article></div>';
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
      action('normal','Valid deep link','正常深链')+action('guest','Signed-out deep link','未登录深链')+action('denied','Restricted deep link','无权限深链')+action('unknown','Unknown deep link','未知深链')+
      action('landing','Deny next landing','下次落地重判权失败')+'</div><p class="tiny">'+L('Local demonstration data. Refresh attempts: ','本地演示数据。刷新次数：')+refreshes+'</p></div>';
  }
  CF.define({id:'portal-notifications',pages:[LIST,DETAIL],
    dict:{en:{navNotifications:'Notifications',navNotification:'Message details'},zh:{navNotifications:'消息中心',navNotification:'消息详情'}},demo,
    beforeRender(){
      snapshot();renderedDetail=null;
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
    layers:{'nc-confirm':()=>{const data=S.layer.data;return {title:L('Mark all as read?','确认全部已读？'),html:'<p>'+L(data.ids.length+' message(s) under the current filter will be marked as read.','将把当前筛选下的 '+data.ids.length+' 条消息标为已读。')+'</p><p><b>'+L('Category: ','分类：')+'</b>'+E(data.cat)+'<br><b>'+L('Status: ','状态：')+'</b>'+E(data.status)+'</p>'+(readError?CF.note('red',L('Could not mark as read. Try again.','标为已读失败，请重试。')):''),foot:btn('closelayer',L('Cancel','取消'),'',busy?'disabled':'')+btn('nc-confirm',busy?L('Saving…','正在处理…'):L('Confirm','确认'),'',busy?'disabled':'')};}},
    onBeforeAct(act){if(act==='closelayer'&&busy)return true;if(act==='clearfilter'&&(S.page===LIST||S.page===DETAIL)){resetView();S.st='default';location.hash='#/notifications';return true;}if(act==='st'){detailFailure=false;readError=false;resetView();}return false;},
    onAct(act,v){
      if(act==='nc-top'){window.scrollTo(0,0);document.getElementById('nc-category')?.focus({preventScroll:true});snapshot();return true;}
      if(act==='nc-clear'){resetView();S.st='default';location.hash='#/notifications';return true;}
      if(act==='nc-more'){if(busy)return true;busy=true;moreError=false;const owner=S.role,key=view.key;setTimeout(()=>{busy=false;if(owner!==S.role||!view||view.key!==key)return;if(failMore){failMore=false;moreError=true;}else view.shown+=20;CF.render();},450);return true;}
      if(act==='nc-read'){mark([v]);return true;}
      if(act==='nc-all'){const f=ensureView().f;readError=false;CF.openLayer('modal','nc-confirm',{ids:N.visible().filter(r=>matches(r,f)&&!r.read).map(r=>r.id),cat:f.cat?catName(f.cat):L('All','全部'),status:f.status==='unread'?L('Unread','未读'):f.status==='read'?L('Read','已读'):L('All','全部')});return true;}
      if(act==='nc-confirm'){mark(S.layer.data.ids);return true;}
      if(act==='nc-detail-retry'){detailFailure=false;S.st='default';readError=false;return true;}
      if(act==='nc-copy'){if(navigator.clipboard)navigator.clipboard.writeText(v).then(()=>CF.toast(L('Copied','已复制'))).catch(()=>CF.toast(L('Select the reference to copy it.','请选中编号后复制。')));else CF.toast(L('Select the reference to copy it.','请选中编号后复制。'));return true;}
      if(act==='nc-jump'){const r=lookup(),t=r&&targetOf(r);if(!t||preflight.status==='pending')return true;if(landingDenied){landingDenied=false;S.role='limited';return true;}CF.enterPage(t.target,t.mode==='object'?{object:r.objectId,panel:t.panel||''}:null);return true;}
      if(act==='nc-demo'){
        const first=D.rows.find(r=>r.owner==='asset'&&r.progress).id;
        if(v==='reset'){Object.assign(D,JSON.parse(initialData));N.rows=D.rows;try{localStorage.removeItem(storageKey);}catch(e){}resetView();S.role='asset';S.st='default';N.panelState='default';refreshFail=failRead=failMore=detailFailure=readError=landingDenied=false;location.hash='#/notifications';}
        if(v==='new'){D.addType();N.rows=D.rows;newMessages();}
        if(v==='empty'){N.rows=[];resetView();S.st='default';location.hash='#/notifications';}
        if(v==='many'){N.rows=D.rows;N.visible().forEach(r=>r.read=false);resetView();S.st='default';location.hash='#/notifications';}
        if(v==='panel-loading'||v==='panel-error'){N.panelState=v==='panel-loading'?'loading':'error';S.menu='notifications';}
        if(v==='more-fail'){failMore=true;CF.toast(L('Next load will fail — demo.','下一次加载更多将失败 —— 演示。'));}
        if(v==='read-fail'){failRead=true;CF.toast(L('Next read will fail — demo.','下一次已读操作将失败 —— 演示。'));}
        if(v==='refresh-fail'){refreshFail=true;refresh();}
        if(v==='refresh'){refreshFail=false;refresh();}
        if(v==='expire'){S.role='guest';S.menu=null;S.layer=null;S.st='default';}
        if(v==='detail-fail'){detailFailure=true;CF.enterPage('lending:'+DETAIL,{id:first});}
        if(['normal','guest','denied'].includes(v)){S.role=v==='guest'?'guest':v==='denied'?'limited':'asset';S.st='default';detailFailure=false;CF.enterPage('lending:'+DETAIL,{id:first});}
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
    if(!['nc-category','nc-status'].includes(e.target.id))return;
    const cat=document.getElementById('nc-category').value,status=document.getElementById('nc-status').value,q=new URLSearchParams();
    if(cat)q.set('category',cat);if(status)q.set('status',status);resetView();location.hash='#/notifications'+(q.size?'?'+q:'');
  });
  window.addEventListener('storage',e=>{if(e.key===storageKey&&N.allowed()){loadRead();CF.render();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();schedule();});
  window.addEventListener('pagehide',()=>{clearInterval(timer);clearTimeout(preflightTimer);clearTimeout(readTimer);});
  if(CF.notificationLanding){if(!location.hash)location.hash='#/notifications';S.role='asset';}
  CF.boot();
})(window.CF);
