/* Repository-only navigation. export.py excludes this file from module attachments.
   Register only delivered files and existing screens; no business data or permission engine.
   Paths are relative to 页面原型/, resolved from this script, so file:// needs no server. */
(function(TP){
  var root = new URL('../', document.currentScript.src);
  var files = {
    account:{end:'client', path:'面客端/01-企业登录与企业账户/企业登录与企业账户.html'},
    clientAssets:{end:'client', path:'面客端/02-可信资产/可信资产.html'},
    adminAccount:{end:'admin', path:'管理端/01-管理端登录与权限/管理端账号与监管机构管理.html'},
    adminAssets:{end:'admin', path:'管理端/02-可信资产/可信资产.html'}
  };
  // Every destination names the exact role-specific screen, never another role's fallback.
  var routes = {
    client:{
      assets:{file:'clientAssets', screens:{certified:'list'}},
      accounts:{file:'account', screens:{certified:'acc'}},
      org:{file:'account', screens:{certified:'org',uncertified:'org-uncert',noent:'org-noent'}},
      me:{file:'account', screens:{certified:'me'}},
      logout:{file:'account', screens:{certified:'login',uncertified:'login',noent:'login'}},
      certify:{file:'account', screens:{uncertified:'leave',noent:'leave'}, bases:{uncertified:'org-uncert',noent:'org-noent'}}
    },
    admin:{
      assets:{file:'adminAssets', screens:{ops:'o-list',opsnew:'o-list',reg:'r-list',regoff:'r-list',regnew:'r-list'}},
      ents:{file:'adminAssets', screens:{ops:'e-list',opsnew:'e-list'}},
      regs:{file:'adminAccount', screens:{ops:'rg-list',opsnew:'rg-list'}},
      settings:{file:'adminAccount', screens:{ops:'o-settings',opsnew:'o-settings-new',reg:'r-settings',regoff:'r-off',regnew:'r-settings-new'}},
      logout:{file:'adminAccount', screens:{ops:'login-out',opsnew:'login-out',reg:'login-out',regoff:'login-out',regnew:'login-out'}}
    }
  };
  var page = new URL(location.href), module = null;
  Object.keys(files).some(function(key){
    if(new URL(files[key].path,root).pathname===page.pathname){module=files[key];return true;}
    return false;
  });
  if(!module) return;
  TP.previewMode = 'repository';

  function screen(id){
    var el=document.getElementById(id);
    return el && el.hasAttribute('data-screen') ? el : null;
  }
  function validZone(zone){
    if(!zone) return false;
    try{new Intl.DateTimeFormat('en',{timeZone:zone});return true;}catch(e){return false;}
  }

  TP.initNavigation = function(){
    var params=new URL(location.href).searchParams;
    var lang=params.get('previewLang'), zone=params.get('previewZone');
    if(lang==='en'||lang==='zh') TP.language=lang;
    if(validZone(zone)) TP.zone=zone;
    // M2 uses the same regulator screens for these display variants. Preserve the
    // disabled-institution notice / changed email when returning from M5.
    var who=params.get('previewWho');
    if(module===files.adminAssets && (who==='regoff'||who==='regnew'||who==='opsnew')){
      var sourceWho=who==='opsnew'?'ops':'reg';
      document.querySelectorAll('[data-screen][data-who="'+sourceWho+'"]').forEach(function(el){el.dataset.who=who;});
      TP.NAV_BY[who]=TP.NAV_BY[sourceWho];
      TP.demo.accounts[who]=Object.assign({},TP.demo.accounts[sourceWho]);
      if(who==='regoff') TP.demo.accounts[who].notice='本机构已停用，不再接收新的发行申请；在途业务可以继续办理。';
      if(who==='regnew') TP.demo.accounts[who].email='new-reviewer@reg.example';
      if(who==='opsnew') TP.demo.accounts[who].email='new-ops@example.com';
      Object.keys(TP.routes).forEach(function(key){
        var r=TP.routes[key];if(r && typeof r==='object' && r[sourceWho]) r[who]=r[sourceWho];
      });
    }
    var target=screen(location.hash.slice(1)), base=screen(params.get('previewBase'));
    TP.initialNavigationOptions={};
    if(target && target.hasAttribute('data-overlay') && base && !base.hasAttribute('data-overlay')){
      TP.initialNavigationOptions.base=base.id;
    }
    var gate=params.get('previewGate');
    if(target && (target.id===TP.routes.gate || (base && base.id===TP.routes.gate)) &&
       TP.NAV.some(function(g){return g.items.some(function(it){return it.key===gate;});})) TP.initialNavigationOptions.gate=gate;
  };

  // Pass only display preferences / a screen's existing identity. Nothing is
  // persisted as a login, account, business record or permission decision.
  function putContext(url,who,base,gate){
    url.searchParams.set('previewLang',TP.language);
    url.searchParams.set('previewZone',TP.zone);
    url.searchParams.set('previewWho',who||'none');
    ['previewBase','previewGate'].forEach(function(key){url.searchParams.delete(key);});
    if(base) url.searchParams.set('previewBase',base);
    if(gate) url.searchParams.set('previewGate',gate);
  }
  var renderDisplay=TP.renderDisplay;
  TP.renderDisplay=function(){
    renderDisplay();
    var cur=TP.currentScreen;
    if(!cur) return;
    var url=new URL(location.href);
    putContext(url,cur.who,cur.base,cur.gate);
    if(url.href!==location.href) history.replaceState(history.state,'',url.href);
  };

  TP.navigate=function(key,current){
    if(!current || current.who==='none' || current.who==='guest') return false;
    var route=routes[module.end][key], who=current.who;
    if(!route || !Object.prototype.hasOwnProperty.call(route.screens,who)) return false;
    var target=new URL(files[route.file].path,root);
    target.hash=route.screens[who];
    putContext(target,who,route.bases && route.bases[who]);
    location.assign(target.href);
    return true;
  };

  // Also keep same-document hash links usable after the initial page load.
  window.addEventListener('hashchange',function(){
    var target=screen(location.hash.slice(1));
    if(target) TP.show(target.id);
  });
})(window.TP=window.TP||{});
