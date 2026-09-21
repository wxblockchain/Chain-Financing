/* Shared operations message state and header. All records are fictional local fixtures. */
(function(CF){
  'use strict';
  const D=CF.opsMessageDemo, S=CF.S, L=CF.L, E=CF.esc;
  const DATA='hc.ops.message-pool.v1', READ='hc.ops.messages.v1.';
  const memory=new Map();
  let provider={},panel='closed',request=0,preview=[],currentReader='',refreshTimer=null;
  const read=key=>{try{return localStorage.getItem(key)}catch(_){return memory.get(key)||null}};
  const write=(key,value)=>{memory.set(key,value);try{localStorage.setItem(key,value)}catch(_){}};
  function load(){try{const saved=JSON.parse(read(DATA));if(Array.isArray(saved?.rows)){Object.assign(D.categories,saved.categories);return saved.rows}}catch(_){}const rows=D.seed();write(DATA,JSON.stringify({rows,categories:D.categories}));return rows}
  let records=load();
  const identity=()=>CF.AdminMenu.identity().email;
  const allowed=()=>CF.AdminMenu.can(12)&&!N.blocked;
  const expired=r=>!!r.expires&&Date.parse(r.expires)<=Date.now();
  const visible=()=>allowed()?(provider.visible?provider.visible():records.filter(r=>r.platform==='lending'&&r.end==='admin'&&(!r.owner||r.owner===identity())).sort((a,b)=>b.at.localeCompare(a.at)||b.id.localeCompare(a.id))):[];
  const isRead=r=>r.initialRead||Date.parse(r.at)<Date.parse('2026-09-18T02:00:00Z')||read(READ+identity()+'.'+r.id)==='read';
  const unread=()=>visible().filter(r=>!expired(r)&&!isRead(r));
  const text=o=>o?(o[S.lang]||o.en||''):'';
  function absolute(at){try{return new Intl.DateTimeFormat(S.lang==='en'?'en-US':'zh-CN',{timeZone:S.tz,year:'numeric',month:S.lang==='en'?'short':'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(at))+' ('+S.tz+')'}catch(_){return new Date(at).toISOString()+' (UTC)'}}
  function relative(at){const m=Math.max(0,Math.floor((Date.now()-Date.parse(at))/60000)),h=Math.floor(m/60);return m<1?L('Just now','刚刚'):m<60?L(m+(m===1?' minute ago':' minutes ago'),m+' 分钟前'):m<1440?L(h+(h===1?' hour ago':' hours ago'),h+' 小时前'):absolute(at)}
  function refresh(){CF.refreshAdminTools?.()}
  function closePanel(focus=false){request++;panel='closed';preview=[];refresh();if(focus)document.getElementById('om-bell')?.focus({preventScroll:true})}
  function label(r){return `<span class="nc-read-state ${isRead(r)?'is-read':'is-unread'}">${isRead(r)?L('Read','已读'):L('Unread','未读')}</span>`}
  function row(r){
    const title=text(r.title)||L('Notification','消息');
    const target=CF.AdminMenu.messageLink(r.id,provider.from?.()||'');
    return `<a class="nc-preview" id="om-preview-${E(r.id)}" href="${E(target.href)}" data-admin-destination="messages" data-admin-route="${E(target.route)}"><div class="nc-message-heading"><span class="nc-message-title" title="${E(title)}">${E(title)}</span>${label(r)}</div><p class="nc-summary">${E(text(r.title)?text(r.summary):'')}</p><div class="nc-message-foot"><span>${E(text(D.categories[r.category])||L('Other','其他'))}${expired(r)?' · '+L('Expired','已过期'):''}</span><time title="${E(absolute(r.at))}">${E(relative(r.at))}</time></div></a>`;
  }
  function empty(){return CF.empty(L('No notifications yet','暂无消息'),L('New notifications will appear here.','收到的新消息会显示在这里。'),'')}
  function loading(){return `<div role="status" aria-label="${L('Loading messages','正在加载消息')}">${Array.from({length:4},()=>'<div class="nc-skeleton-row"><span class="skel"></span><span class="skel"></span><span class="skel"></span></div>').join('')}</div>`}
  function bell(){
    if(!allowed()){request++;panel='closed';preview=[];return ''}
    const reader=identity();if(reader!==currentReader){request++;panel='closed';preview=[];currentReader=reader}
    const n=unread().length;
    return `<div class="dd nc-bell-wrap admin-notifications"><button id="om-bell" class="bell" data-act="shared-message-bell" aria-label="${L('Notifications','消息中心')}" aria-expanded="${panel!=='closed'}" aria-controls="om-panel">${CF.ICON.bell}<span class="badge" id="om-badge" ${!n?'hidden':''}>${n>99?'99+':n}</span></button><span class="sr-only" id="om-unread-live" role="status" aria-live="polite">${L(n>99?'More than 99 unread messages':n+' unread messages',n>99?'超过 99 条未读消息':n+' 条未读消息')}</span>${panel==='closed'?'':`<section class="nc-panel" id="om-panel" role="dialog" aria-modal="true" aria-label="${L('Recent messages','最近消息')}"><div class="nc-panel-head om-panel-head"><b>${L('Recent messages','最近消息')}</b><button class="btn" data-act="shared-message-close">${L('Close','关闭')}</button></div><div class="nc-preview-list">${panel==='loading'?loading():panel==='error'?CF.empty(L('Messages could not be loaded','消息加载失败'),L('Please try again.','请重试。'),`<button class="btn" data-act="shared-message-retry">${L('Retry','重试')}</button>`):preview.length?preview.map(row).join(''):empty()}</div><a class="nc-panel-foot" href="${E(CF.AdminMenu.destination('messages').href)}" data-admin-destination="messages">${L('View all notifications','查看全部消息')}</a></section>`}</div>`;
  }
  function openPanel(){
    if(!allowed()||S.layer)return;
    CF.AdminMenu.closeAccount();S.menu=null;
    const token=++request,reader=identity();panel='loading';preview=[];currentReader=reader;
    const failed=provider.failPanel?.();refresh();document.querySelector('#om-panel button')?.focus();
    setTimeout(()=>{if(token!==request||reader!==identity()||!allowed()||panel==='closed')return;panel=failed?'error':'ready';preview=visible().slice(0,10);refresh();document.querySelector('#om-panel button')?.focus()},300);
  }
  const N=CF.opsNotifications={
    get rows(){return records},get blocked(){return provider.blocked?.()||false},
    configure(value){provider=value},identity,visible,expired,isRead,unread,label,absolute,relative,
    getRead:key=>read(READ+key),setRead:(key,value)=>write(READ+key,value),
    replaceRows(rows){records=rows;write(DATA,JSON.stringify({rows,categories:D.categories}));refresh()},
    mark(ids){if(!allowed())return;const valid=new Set(visible().map(r=>r.id));ids.forEach(id=>{if(valid.has(id))write(READ+identity()+'.'+id,'read')});refresh()},
    bell,openPanel,closePanel,refresh,
    open(){CF.AdminMenu.beforeLeave(()=>CF.AdminMenu.go('messages'))}
  };
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-act^="shared-message-"]');
    if(button){event.preventDefault();event.stopImmediatePropagation();if(button.dataset.act==='shared-message-bell'){panel==='closed'?openPanel():closePanel(true)}else if(button.dataset.act==='shared-message-close')closePanel(true);else openPanel();return}
    if(panel!=='closed'&&!event.target.closest('.admin-notifications'))closePanel(true);
  },true);
  document.addEventListener('keydown',event=>{
    if(panel==='closed')return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closePanel(true)}
    if(event.key==='Tab'){const nodes=[...document.querySelectorAll('#om-panel button:not(:disabled),#om-panel a')],first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}
  },true);
  window.addEventListener('hashchange',()=>{request++;panel='closed';preview=[];refresh()});
  window.addEventListener('storage',event=>{if(event.key===DATA){records=load();provider.onRows?.(records)}if(event.key===DATA||event.key?.startsWith(READ)||event.key==='hc.ops.header-profile.v1')refresh()});
  function clock(){clearInterval(refreshTimer);if(!document.hidden){refresh();refreshTimer=setInterval(refresh,60000)}}
  document.addEventListener('visibilitychange',clock);
  // First render is owned by the module boot; do not render an unconfigured shell.
  setTimeout(clock,0);
})(window.CF);
