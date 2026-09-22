/* Management navigation contract. Keep destinations and labels here, not in modules.
   Each business prototype retains its own permission fixtures and leave guards. */
(function(CF){
  'use strict';
  const entries = [
    {"key":"account","page":"P-O-AL-07","route":"/ops/account-overview","file":"账户与登录/账户与登录.html","label":["Overview","总览"],"icon":"▤","permission":14,"sidebar":true},
    {"key":"institution","page":"P-L40","route":"/ops/institution-reviews","file":"资金方机构认证审核/资金方机构认证审核.html","label":["Institution review","机构认证审核"],"icon":"▣","permission":5,"sidebar":true},
    {"key":"pledge","page":"P-O-PR-01","route":"/ops/pledge-reviews","file":"代币质押审核/代币质押审核.html","label":["Pledge reviews","代币质押审核"],"icon":"▤","permission":7,"sidebar":true},
    {"key":"agreements","page":"P-O-AG-01","route":"/ops/agreements","file":"协议管理/协议管理.html","label":["Agreements","协议管理"],"icon":"▧","permission":9,"sidebar":true},
    {"key":"messages","page":"P-O20","route":"/ops/notifications","file":"消息通知/消息通知.html","label":["Notifications","消息中心"],"permission":12,"sidebar":false},
    {"key":"settings","page":"P-O-AL-06","route":"/ops/account","file":"账户与登录/账户与登录.html","label":["Account settings","账户设置"],"permission":14,"sidebar":false}
  ];
  const current=()=>document.documentElement.dataset.adminModule;
  const local=e=>e.key===current()||(['account','messages'].includes(current())&&['account','settings'].includes(e.key));
  let module=null,hoverTimer=null;
  const PROFILE='hc.ops.header-profile.v1';
  const fallback={email:'operator@example.com',role:'admin'};
  function readIdentity(){try{return {...fallback,...JSON.parse(localStorage.getItem(PROFILE)||'{}')}}catch(_){return {...fallback}}}
  function identity(){
    const context=module?.adminContext?.()||{};
    const account=CF.opsAuth?.getIdentity();
    const result={...readIdentity(),...(account||{}),...context};
    if(account&&CF.opsAuth.can(14)){try{localStorage.setItem(PROFILE,JSON.stringify({email:account.email,role:account.role}))}catch(_){}}
    return result;
  }
  function can(permission){
    if(CF.S.end!=='admin'||CF.S.role==='guest'||identity().signedIn===false)return false;
    if(CF.opsAuth)return CF.opsAuth.can(permission);
    return permission!==12||!CF.opsNotifications?.blocked;
  }
  function allowed(e){if(!can(e.permission))return false;if(CF.opsAuth)return true;return !local(e)||!module?.allowNav||module.allowNav(e.page)}
  function active(e){let id=CF.S.page;while(id){if(id===e.page)return true;id=CF.PAGES[id]?.parent}return false}
  function href(e,route=e.route){return local(e)||window.AdminPrototypeBundle?'#'+route:'../'+e.file+'#'+route}
  function link(e,cls='',role='',route=e.route){return `<a class="${cls}" href="${CF.esc(href(e,route))}" data-admin-destination="${e.key}" data-admin-route="${CF.esc(route)}" ${role?`role="${role}"`:''}${active(e)?' aria-current="page"':''}>${cls==='nav-item'?`<span class="nav-ico" aria-hidden="true">${e.icon}</span>`:''}${CF.esc(CF.L(...e.label))}</a>`}
  function go(key,route){const e=entries.find(e=>e.key===key);if(!e||!allowed(e))return;route=route||e.route;try{localStorage.setItem('hc.ops.language',CF.S.lang)}catch(_){}if(local(e)){location.hash=route;return}if(window.AdminPrototypeBundle){window.AdminPrototypeBundle.open(e.file,route);return}location.href=href(e,route)}
  function refresh(){CF.refreshAdminTools?.()}
  function close(focus=false){clearTimeout(hoverTimer);if(CF.S.menu==='shared-account'){CF.S.menu=null;refresh()}if(focus)document.getElementById('admin-account-trigger')?.focus({preventScroll:true})}
  function open(focus=false){clearTimeout(hoverTimer);if(CF.S.layer)return;CF.opsNotifications?.closePanel(false);CF.S.menu='shared-account';refresh();if(focus)document.querySelector('#admin-account-menu a, #admin-account-menu button')?.focus()}
  CF.AdminMenu={entries,go,can,identity,readIdentity,context:()=>module?.adminContext?.()||{},closeAccount:close,
    beforeLeave(proceed){if(module?.beforeAdminNavigate)module.beforeAdminNavigate(proceed);else proceed()},
    messageLink(id,from=''){const e=entries.find(e=>e.key==='messages');const q=new URLSearchParams({id});if(from)q.set('from',from);const route='/ops/notification?'+q;return {href:href(e,route),route}},
    destination(key){const e=entries.find(e=>e.key===key);return e?{href:href(e),route:e.route}:null},
    link:key=>{const e=entries.find(e=>e.key===key);return e&&allowed(e)?link(e,'','menuitem'):''},
    render(mod){module=mod;return '<div class="nav-group">'+CF.L('Operations','运营管理')+'</div>'+entries.filter(e=>e.sidebar&&allowed(e)).map(e=>link(e,'nav-item')).join('')},
    tools(mod){if(mod)module=mod;if(!can(14))return '';const user=identity(),expanded=CF.S.menu==='shared-account';return `<div class="dd admin-account"><button id="admin-account-trigger" class="dd-btn" data-act="admin-account" aria-haspopup="menu" aria-controls="admin-account-menu" aria-expanded="${expanded}" title="${CF.esc(user.email)}"><span class="admin-account-email">${CF.esc(user.email)}</span> ${CF.ICON.caret}</button>${expanded?`<div class="dd-list" id="admin-account-menu" role="menu" aria-label="${CF.L('Account menu','账户菜单')}"><div class="admin-account-role">${CF.esc(user.role==='specialist'?CF.L('Operations specialist','运营专员'):CF.L('Administrator','管理员'))}</div>${this.link('messages')}${this.link('settings')}<button role="menuitem" data-act="admin-logout">${CF.L('Sign out','退出登录')}</button></div>`:''}</div>`}
  };
  // Cross-document page entries use the existing navigation and permission guards.
  entries.forEach(e=>CF.review.register(e.page,{
    group:['Operations modules','管理端模块'],label:e.label,visible:()=>allowed(e),
    navigate(){
      // Keep the review tool open across the full-page load into another module file.
      if(window.AdminPrototypeBundle)window.AdminPrototypeBundle.reviewOpen=true;
      else if(!local(e))try{localStorage.setItem(CF.REVIEW_OPEN,'1')}catch(_){}
      go(e.key);
    }
  }));
  CF.NAV.admin=entries.filter(e=>e.sidebar).map(e=>e.page);
  if(CF.S){try{CF.S.lang=localStorage.getItem('hc.ops.language')||CF.S.lang}catch(_){}}
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-act="admin-account"],[data-act="admin-logout"]');
    if(button){event.preventDefault();event.stopImmediatePropagation();if(button.dataset.act==='admin-account'){event.detail===0&&CF.S.menu==='shared-account'?close():open(true)}else CF.AdminMenu.beforeLeave(()=>{close();if(CF.opsAccountModule){CF.opsAccountModule.onAct('ops-logout');CF.render()}else go('settings','/ops/login')});return}
    const a=event.target.closest('[data-admin-destination]');
    if(a&&!event.defaultPrevented&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){const e=entries.find(e=>e.key===a.dataset.adminDestination);if(!e)return;event.preventDefault();event.stopImmediatePropagation();if(!allowed(e))return;const route=a.dataset.adminRoute||e.route;CF.AdminMenu.beforeLeave(()=>{close();CF.opsNotifications?.closePanel(false);go(e.key,route)});return}
    if(CF.S.menu==='shared-account'&&!event.target.closest('.admin-account'))close();
  },true);
  document.addEventListener('pointerover',event=>{if(event.pointerType==='touch')return;const box=event.target.closest('.admin-account');if(!box)return;clearTimeout(hoverTimer);if(!box.contains(event.relatedTarget)&&CF.S.menu!=='shared-account')open()});
  document.addEventListener('pointerout',event=>{const box=event.target.closest('.admin-account');if(box&&!box.contains(event.relatedTarget))hoverTimer=setTimeout(()=>{if(!document.querySelector('.admin-account:hover')&&!document.activeElement?.closest('.admin-account'))close()},160)});
  document.addEventListener('focusout',event=>{if(event.target.closest('.admin-account'))setTimeout(()=>{if(!document.activeElement?.closest('.admin-account')&&!document.querySelector('.admin-account:hover'))close()},0)});
  document.addEventListener('keydown',event=>{if(event.target.id==='admin-account-trigger'&&event.key==='ArrowDown'){event.preventDefault();open(true)}else if(CF.S.menu==='shared-account'&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close(true)}} ,true);
})(window.CF=window.CF||{});
