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
  let module=null;
  function allowed(e){if(CF.opsAuth)return CF.opsAuth.can(e.permission);return !local(e)||!module?.allowNav||module.allowNav(e.page)}
  function active(e){let id=CF.S.page;while(id){if(id===e.page)return true;id=CF.PAGES[id]?.parent}return false}
  function href(e){return local(e)||window.AdminPrototypeBundle?'#'+e.route:'../'+e.file+'#'+e.route}
  function link(e,cls='',role=''){return `<a class="${cls}" href="${CF.esc(href(e))}" data-admin-destination="${e.key}" ${role?`role="${role}"`:''}${active(e)?' aria-current="page"':''}>${cls==='nav-item'?`<span class="nav-ico" aria-hidden="true">${e.icon}</span>`:''}${CF.esc(CF.L(...e.label))}</a>`}
  function go(key){const e=entries.find(e=>e.key===key);if(!e||!allowed(e))return;try{localStorage.setItem('hc.ops.language',CF.S.lang)}catch(_){}if(local(e)){location.hash=e.route;return}if(window.AdminPrototypeBundle){window.AdminPrototypeBundle.open(e.file,e.route);return}location.href=href(e)}
  CF.AdminMenu={entries,go,beforeLeave(proceed){if(module?.beforeAdminNavigate)module.beforeAdminNavigate(proceed);else proceed()},link:key=>{const e=entries.find(e=>e.key===key);return e&&allowed(e)?link(e,'','menuitem'):''},
    render(mod){module=mod;return '<div class="nav-group">'+CF.L('Operations','运营管理')+'</div>'+entries.filter(e=>e.sidebar&&allowed(e)).map(e=>link(e,'nav-item')).join('')},
    tools(){return `<div class="dd"><button class="dd-btn" data-act="menu" data-v="shared-account" aria-haspopup="menu" aria-expanded="${CF.S.menu==='shared-account'}">${CF.L('Account','我的账户')} ▾</button>${CF.S.menu==='shared-account'?`<div class="dd-list" role="menu">${this.link('messages')}${this.link('settings')}</div>`:''}</div>`}
  };
  CF.NAV.admin=entries.filter(e=>e.sidebar).map(e=>e.page);
  if(CF.S){try{CF.S.lang=localStorage.getItem('hc.ops.language')||CF.S.lang}catch(_){}}
  document.addEventListener('click',event=>{const a=event.target.closest('[data-admin-destination]');if(!a||event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;const e=entries.find(e=>e.key===a.dataset.adminDestination);if(!e||local(e))return;event.preventDefault();if(!allowed(e))return;CF.AdminMenu.beforeLeave(()=>go(e.key))});
})(window.CF=window.CF||{});
