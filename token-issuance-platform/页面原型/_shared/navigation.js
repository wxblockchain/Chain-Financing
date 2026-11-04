/* Repository-only navigation. export.py excludes this file from module attachments.
   Modules are listed one per line in modules.js; each module registers its own routes in
   <module dir>/route.js, so adding a module never edits another module or this file.
   Register only delivered files and existing screens; no business data or permission engine.
   Paths are relative to 页面原型/, resolved from this script, so file:// needs no server. */
(function(TP){
  var root = new URL('../', document.currentScript.src);
  var modules = [], routes = {client:{}, admin:{}};
  TP.previewMode = 'repository';

  TP.registerModule = function(m){
    m.url = new URL(m.file, document.currentScript.src);
    modules.push(m);
    Object.keys(m.routes).forEach(function(key){
      var r = m.routes[key];
      if(routes[m.end][key]) console.warn('Duplicate '+m.end+' route "'+key+'" in '+m.id);
      routes[m.end][key] = {module:m, screens:r.screens || r, bases:r.bases || {}};
    });
  };
  // Parser-inserted scripts run in order before the page's own inline script, without a server.
  TP.loadModules = function(dirs){
    document.write(dirs.map(function(dir){
      return '<script src="'+new URL(dir+'/route.js', root).href+'"><\/script>';
    }).join(''));
  };
  document.write('<script src="'+new URL('_shared/modules.js', root).href+'"><\/script>');

  var page = new URL(location.href), cached;
  function currentModule(){
    if(cached === undefined){
      cached = null;
      modules.some(function(m){ if(m.url.pathname===page.pathname){ cached = m; return true; } return false; });
    }
    return cached;
  }

  function screen(id){
    var el=document.getElementById(id);
    return el && el.hasAttribute('data-screen') ? el : null;
  }
  function validZone(zone){
    if(!zone) return false;
    try{new Intl.DateTimeFormat('en',{timeZone:zone});return true;}catch(e){return false;}
  }

  TP.initNavigation = function(){
    var module = currentModule();
    if(!module) return;
    var params=new URL(location.href).searchParams;
    var lang=params.get('previewLang'), zone=params.get('previewZone');
    if(lang==='en'||lang==='zh') TP.language=lang;
    if(validZone(zone)) TP.zone=zone;
    // Disabled-institution and changed-email examples reuse the same operator / regulator
    // screens. Preserve the notice / changed email when arriving from another module.
    var who=params.get('previewWho');
    if(module.variants && module.variants.indexOf(who)!==-1){
      var sourceWho=who==='opsnew'?'ops':'reg';
      document.querySelectorAll('[data-screen][data-who="'+sourceWho+'"]').forEach(function(el){el.dataset.who=who;});
      TP.NAV_BY[who]=TP.NAV_BY[sourceWho];
      TP.demo.accounts[who]=Object.assign({},TP.demo.accounts[sourceWho]);
      if(who==='regoff') TP.demo.accounts[who].notice='本机构已停用，不再接收新的发行申请；在途业务可以继续办理。';
      if(who==='regnew') TP.demo.accounts[who].email='new-reviewer@reg.example';
      if(who==='opsnew') TP.demo.accounts[who].email='new-ops@example.com';
      Object.keys(TP.routes).forEach(function(key){
        var r=TP.routes[key];if(r && typeof r==='object' && r[sourceWho] && !r[who]) r[who]=r[sourceWho];
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
    if(TP.language) url.searchParams.set('previewLang',TP.language);
    if(TP.zone) url.searchParams.set('previewZone',TP.zone);
    url.searchParams.set('previewWho',who||'none');
    ['previewBase','previewGate'].forEach(function(key){url.searchParams.delete(key);});
    if(base) url.searchParams.set('previewBase',base);
    if(gate) url.searchParams.set('previewGate',gate);
  }
  function routeHref(end,key,who){
    var route=routes[end][key];
    if(!route || !Object.prototype.hasOwnProperty.call(route.screens,who)) return null;
    var target=new URL(route.module.url.href);
    target.hash=route.screens[who];
    putContext(target,who,route.bases[who]);
    return target.href;
  }

  var renderDisplay=TP.renderDisplay;
  if(renderDisplay) TP.renderDisplay=function(){
    renderDisplay();
    var cur=TP.currentScreen;
    if(!cur || !currentModule()) return;
    var url=new URL(location.href);
    putContext(url,cur.who,cur.base,cur.gate);
    if(url.href!==location.href) history.replaceState(history.state,'',url.href);
  };

  // asWho: only a signed-out sign-in screen may name the identity it lands as (data-module-who).
  TP.navigate=function(key,current,asWho){
    var module=currentModule();
    if(!module || !current) return false;
    var who=current.who;
    if(asWho && who==='none') who=asWho;
    else if((who==='none'||who==='guest') && key!=='signIn' && key!=='guestRegister') return false;
    var href=routeHref(module.end,key,who);
    if(!href) return false;
    location.assign(href);
    return true;
  };

  /* —— 端与身份切换：评审工具，只出现在默认关闭的画面目录和 index.html，不进入产品界面 —— */
  var ENTRIES = [
    {end:'client', label:'企业端', items:[
      {who:'none', label:'未登录', key:'signIn'},
      {who:'certified', label:'已认证企业', key:'assets'},
      {who:'uncertified', label:'未认证企业', key:'org'}
    ]},
    {end:'admin', label:'管理端', items:[
      {who:'none', label:'未登录', key:'signIn'},
      {who:'ops', label:'运营', key:'review'},
      {who:'reg', label:'监管机构', key:'review'}
    ]}
  ];
  var BASE_WHO = {opsnew:'ops', regoff:'reg', regnew:'reg', guest:'none'};
  TP.previewHref = routeHref;
  TP.previewEntries = function(){
    return ENTRIES.map(function(g){
      return {end:g.end, label:g.label, items:g.items.filter(function(it){ return routeHref(g.end,it.key,it.who); })};
    }).filter(function(g){ return g.items.length; });
  };
  TP.renderPreviewSwitch = function(){
    var module=currentModule(), cur=TP.currentScreen;
    var who=cur && (BASE_WHO[cur.who] || cur.who);
    return '<div class="demo-switch" role="group" aria-label="端与身份">'+TP.previewEntries().map(function(g){
      return '<div class="demo-g">'+g.label+'</div><div class="demo-chips">'+g.items.map(function(it){
        var on = module && module.end===g.end && who===it.who;
        return '<a class="demo-chip" href="'+routeHref(g.end,it.key,it.who)+'" data-preview-entry="'+g.end+' '+it.key+' '+it.who+'"'+(on?' aria-current="true"':'')+'>'+it.label+'</a>';
      }).join('')+'</div>';
    }).join('')+'</div>';
  };
  // Resolve at click time so the current language and time zone travel with the switch.
  document.addEventListener('click',function(e){
    var link=e.target.closest && e.target.closest('a[data-preview-entry]');
    if(!link) return;
    var p=link.dataset.previewEntry.split(' ');
    link.href=routeHref(p[0],p[1],p[2]);
  },true);

  // Also keep same-document hash links usable after the initial page load.
  window.addEventListener('hashchange',function(){
    var target=screen(location.hash.slice(1));
    if(target && TP.show) TP.show(target.id);
  });
})(window.TP=window.TP||{});
