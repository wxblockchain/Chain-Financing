/* 仓库联看（仅仓库使用，export.py 导出附件时排除）。
   基线：代币发行平台 _shared/navigation.js。本平台改动：两端为企业端（client）与运营端（ops）；
   身份按业务角色（债权人 / 债务人 / 两者 / 暂无角色 / 入驻中）；模块 variants 写成“展示身份 → 沿用的画面身份”。
   模块清单在 modules.js 每行一个；各模块在自己目录的 route.js 登记路由，新增模块不改其他模块或本文件。
   只登记已交付文件与已有画面；不含业务数据或权限引擎。路径相对 页面原型/，由本脚本位置解析，file:// 无需服务。 */
(function(TP){
  var root = new URL('../', document.currentScript.src);
  var modules = [], routes = {client:{}, ops:{}};
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
  // 解析阶段插入的脚本按顺序执行，早于模块自己的内联脚本，无需服务。
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
    // 展示身份沿用本模块另一身份的画面（如“债权人与债务人”进入只画了债权人的 M7a）：
    // 把这些画面标成当前身份，菜单与账号入口随之按当前身份渲染；不改画面内容。
    var who=params.get('previewWho'), sources=module.variants && module.variants[who];
    if(sources){
      sources.forEach(function(sourceWho){
        document.querySelectorAll('[data-screen][data-who="'+sourceWho+'"]').forEach(function(el){el.dataset.who=who;});
        Object.keys(TP.routes).forEach(function(key){
          var r=TP.routes[key];if(r && typeof r==='object' && r[sourceWho] && !r[who]) r[who]=r[sourceWho];
        });
      });
    }
    // 路由目标可写成“画面 id~分区名”，打开后定位到画面内 data-section 对应的分区。
    TP.initialSection=params.get('previewSection')||null;
    var target=screen(location.hash.slice(1)), base=screen(params.get('previewBase'));
    TP.initialNavigationOptions={};
    if(target && target.hasAttribute('data-overlay') && base && !base.hasAttribute('data-overlay')){
      TP.initialNavigationOptions.base=base.id;
    }
  };

  // 只传展示偏好与画面已有身份；不保存登录、账号、业务记录或权限判断。
  function putContext(url,who,base){
    if(TP.language) url.searchParams.set('previewLang',TP.language);
    if(TP.zone) url.searchParams.set('previewZone',TP.zone);
    url.searchParams.set('previewWho',who||'none');
    ['previewBase','previewSection'].forEach(function(key){url.searchParams.delete(key);});
    if(base) url.searchParams.set('previewBase',base);
  }
  function routeHref(end,key,who){
    var route=routes[end][key];
    if(!route || !Object.prototype.hasOwnProperty.call(route.screens,who)) return null;
    var target=new URL(route.module.url.href), parts=String(route.screens[who]).split('~');
    target.hash=parts[0];
    putContext(target,who,route.bases[who]);
    if(parts[1]) target.searchParams.set('previewSection',parts[1]);
    return target.href;
  }

  var renderDisplay=TP.renderDisplay;
  if(renderDisplay) TP.renderDisplay=function(){
    renderDisplay();
    var cur=TP.currentScreen;
    if(!cur || !currentModule()) return;
    var url=new URL(location.href);
    putContext(url,cur.who,cur.base);
    if(url.href!==location.href){
      try{ history.replaceState(history.state,'',url.href); }catch(error){ if(error.name!=='SecurityError') throw error; }
    }
  };

  // asWho：只有未登录画面可以指定登录后的身份（data-module-who）。
  TP.navigate=function(key,current,asWho){
    var module=currentModule();
    if(!module || !current) return false;
    var who=current.who;
    if(asWho && who==='none') who=asWho;
    else if(who==='none' && key!=='signIn') return false;
    var href=routeHref(module.end,key,who);
    if(!href) return false;
    location.assign(href);
    return true;
  };

  /* —— 端与身份切换：评审工具，只出现在默认关闭的画面目录和 index.html，不进入产品界面 —— */
  var ENTRIES = [
    {end:'client', label:'企业端', items:[
      {who:'none',       label:'未登录',         key:'signIn'},
      {who:'onboarding', label:'入驻准备中',     key:'onboard'},
      {who:'creditor',   label:'债权人',         key:'receivables'},
      {who:'debtor',     label:'债务人',         key:'confirmations'},
      {who:'both',       label:'债权人与债务人', key:'receivables'},
      {who:'norole',     label:'暂无业务角色',   key:'account'}
    ]},
    {end:'ops', label:'运营端', items:[
      {who:'none', label:'未登录',     key:'signIn'},
      {who:'ops',  label:'运营管理员', key:'ents'}
    ]}
  ];
  TP.previewHref = routeHref;
  TP.previewEntries = function(){
    return ENTRIES.map(function(g){
      return {end:g.end, label:g.label, items:g.items.filter(function(it){ return routeHref(g.end,it.key,it.who); })};
    }).filter(function(g){ return g.items.length; });
  };
  TP.renderPreviewSwitch = function(){
    var module=currentModule(), cur=TP.currentScreen;
    var who=cur && (cur.who==='opsinit' ? 'ops' : cur.who);
    return '<div class="demo-switch" role="group" aria-label="端与身份">'+TP.previewEntries().map(function(g){
      return '<div class="demo-g">'+g.label+'</div><div class="demo-chips">'+g.items.map(function(it){
        var on = module && module.end===g.end && who===it.who;
        return '<a class="demo-chip" href="'+routeHref(g.end,it.key,it.who)+'" data-preview-entry="'+g.end+' '+it.key+' '+it.who+'"'+(on?' aria-current="true"':'')+'>'+it.label+'</a>';
      }).join('')+'</div>';
    }).join('')+'</div>';
  };
  // 点击时再解析，让当前语言与时区随切换带过去。
  document.addEventListener('click',function(e){
    var link=e.target.closest && e.target.closest('a[data-preview-entry]');
    if(!link) return;
    var p=link.dataset.previewEntry.split(' ');
    link.href=routeHref(p[0],p[1],p[2]);
  },true);

  // 页面加载后，同文档的 hash 链接仍可切换画面。
  window.addEventListener('hashchange',function(){
    var target=screen(location.hash.slice(1));
    if(target && TP.show) TP.show(target.id);
  });
})(window.TP=window.TP||{});
