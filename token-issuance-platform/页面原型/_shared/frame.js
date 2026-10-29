/* ==========================================================================
   frame.js — 代币发行平台原型壳层运行时（面客端）
   只做三件事：渲染壳层（侧栏、顶栏、账户入口）、按画面切换、画面目录。
   不实现业务规则、校验、状态机或演示时钟；规则以 PRD 为准。

   模块页面约定：
   <section data-screen id="…" data-no="A1" data-group="数币账户" data-name="列表"
            data-layout="app|focus" data-who="certified|uncertified|noent|guest|none"
            data-nav="accounts" data-crumb="企业账户/数币账户"
            [data-overlay data-base="底层画面 id"] [data-next="主流程下一屏 id"]
            [data-dd 展开账户入口] [data-show-toast="进入画面时的结果提示"]>
   任意元素 data-go="画面 id" 跳转；弹窗内 data-close 回到底层画面；data-toast="文字" 弹出提示；data-copy 复制提示。
   模块在 TP.routes 中登记菜单与账户入口对应的画面。
   ========================================================================== */
(function(){
  var TP = window.TP = window.TP || {};
  var ICON = {
    asset:'<path d="M4 7h16v12H4z"/><path d="M8 7V5h8v2"/><path d="M4 12h16"/>',
    issue:'<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
    token:'<circle cx="9" cy="12" r="5"/><path d="M14 7.5a5 5 0 1 1 0 9"/>',
    burn:'<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
    wallet:'<path d="M4 7h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4z"/><path d="M4 7V6a2 2 0 0 1 2-2h10"/><circle cx="16" cy="13" r="1"/>',
    org:'<path d="M4 20V6l8-3 8 3v14"/><path d="M9 20v-5h6v5M8 9h2M14 9h2"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    chev:'<path d="M6 9l6 6 6-6"/>',
    copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    out:'<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    msg:'<path d="M4 5h16v11H8l-4 4z"/>',
    alert:'<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.01"/>',
    x:'<path d="M6 6l12 12M18 6L6 18"/>',
    globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/>',
    check:'<path d="M5 12l5 5 9-10"/>'
  };
  TP.icon = function(n){ return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">'+(ICON[n]||'')+'</svg>'; };

  /* 面客端菜单：与简报 4.1 的功能分组一致；未登记 route 的菜单属于其他模块 */
  TP.NAV = [
    {group:'业务', items:[
      {key:'assets', label:'可信资产', icon:'asset', biz:true, desc:'查看本企业已确权的应收账款，从可发行的资产发起代币发行。'},
      {key:'issue',  label:'代币发行', icon:'issue', biz:true, desc:'提交代币发行申请，查看审核进度与铸造结果。'},
      {key:'tokens', label:'我的代币', icon:'token', biz:true, desc:'查看已铸造的代币，满足条件时发起销毁。'},
      {key:'burn',   label:'销毁申请', icon:'burn',  biz:true, desc:'查看销毁申请的审核进度与解除质押进度。'}
    ]},
    {group:'用户中心', items:[
      {key:'accounts', label:'数币账户', icon:'wallet', biz:true, desc:'用于接收代币的以太坊地址。发起代币发行申请时，从这里选择接收账户。'},
      {key:'org',      label:'企业信息', icon:'org'},
      {key:'me',       label:'用户信息', icon:'user'}
    ]}
  ];
  TP.routes = TP.routes || {};
  TP.demo = TP.demo || {};

  var $ = function(s,r){ return (r||document).querySelector(s); };
  var $$ = function(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };
  var esc = function(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };
  var current = null, gateKey = null, order = [];

  function short(a){ return a ? a.slice(0,6)+'…'+a.slice(-4) : '我的账户'; }
  function locked(who){ return who==='uncertified' || who==='noent'; }

  function toast(t){
    var box = $('#toasts'); if(!box) return;
    var el = document.createElement('div'); el.className='toast'; el.textContent=t; box.appendChild(el);
    setTimeout(function(){ el.remove(); }, 2400);
  }
  TP.toast = toast;

  function renderNav(sec){
    var who = sec.dataset.who, active = gateKey || sec.dataset.nav;
    $('#nav').innerHTML = TP.NAV.map(function(g){
      return '<div class="nav-group">'+g.group+'</div>' + g.items.map(function(it){
        var lk = it.biz && locked(who);
        return '<button type="button" class="nav-item" data-nav-key="'+it.key+'"'+(active===it.key?' aria-current="page"':'')+'>'+
          TP.icon(it.icon)+'<span>'+it.label+'</span>'+(lk?'<span class="lock" title="需先完成认证">'+TP.icon('lock')+'<span class="sr-only">需先完成认证</span></span>':'')+'</button>';
      }).join('');
    }).join('');
  }

  function renderCrumb(sec){
    $('#crumb').hidden = sec.dataset.layout === 'focus';
    var parts = (sec.dataset.crumb||'').split('/').filter(Boolean);
    if(gateKey){ var it = findNav(gateKey); parts = [groupOf(gateKey), it.label]; }
    $('#crumb').innerHTML = parts.map(function(p,i){
      return (i?'<span class="sep">/</span>':'') + (i===parts.length-1?'<b>'+esc(p)+'</b>':'<span>'+esc(p)+'</span>');
    }).join('');
  }

  function accountEntry(who, open){
    if(who==='none') return '';
    var a = TP.demo.address, guest = who==='guest';
    var menu = '<div class="dd-list" role="menu"'+(open?'':' hidden')+'>'+
      '<div class="dd-who">'+(guest?'':'<div class="v">'+esc(who==='noent'?'未关联企业':TP.demo.enterprise)+'</div>')+
      '<div class="k">登录地址</div><div class="addr"><span class="addr-pill" title="'+esc(a)+'">'+esc(short(a))+'</span>'+
      '<button type="button" class="btn icon" data-copy aria-label="复制登录地址">'+TP.icon('copy')+'</button></div></div>'+
      '<button type="button" class="dd-item" role="menuitem" data-acct="logout">'+TP.icon('out')+'退出登录</button></div>';
    return '<div class="dd" id="acct"><button type="button" class="dd-btn" aria-haspopup="menu" aria-expanded="'+(open?'true':'false')+'" aria-label="账户：'+esc(a)+'">'+
      '<span class="mono">'+esc(short(a))+'</span>'+TP.icon('chev')+'</button>'+menu+'</div>';
  }

  /* 界面语言：所有访问者、所有页面可切换 */
  function langEntry(){
    return '<div class="dd"><button type="button" class="dd-btn" aria-haspopup="menu" aria-expanded="false" aria-label="界面语言：简体中文">'+TP.icon('globe')+'<span>简体中文</span>'+TP.icon('chev')+'</button>'+
      '<div class="dd-list narrow" role="menu" hidden>'+
      '<button type="button" class="dd-item" role="menuitemradio" aria-checked="true">'+TP.icon('check')+'简体中文</button>'+
      '<button type="button" class="dd-item" role="menuitemradio" aria-checked="false" data-toast="演示：界面切换为 English">English</button></div></div>';
  }

  function renderTools(sec, open){
    var who = sec.dataset.who;
    var bell = (who==='guest'||who==='none') ? '' :
      '<button type="button" class="bell" data-acct="msg" aria-label="消息通知，3 条未读">'+TP.icon('bell')+'<span class="badge" aria-hidden="true">3</span></button>';
    var focus = sec.dataset.layout === 'focus';
    $('#tools').innerHTML = focus ? '' : langEntry() + bell + accountEntry(who, open);
    $('#focusTools').innerHTML = focus ? langEntry() + accountEntry(who, open) : '';
  }

  function findNav(k){ var r=null; TP.NAV.forEach(function(g){ g.items.forEach(function(i){ if(i.key===k) r=i; }); }); return r; }
  function groupOf(k){ var r=''; TP.NAV.forEach(function(g){ g.items.forEach(function(i){ if(i.key===k) r=g.group; }); }); return r; }

  function show(id, opts){
    var sec = document.getElementById(id); if(!sec || !sec.hasAttribute('data-screen')) return;
    gateKey = (opts && opts.gate) || null;
    var base = sec.hasAttribute('data-overlay') ? document.getElementById((opts&&opts.base) || sec.dataset.base) : null;
    var shown = base || sec;
    $$('[data-screen]').forEach(function(s){ s.hidden = !(s===sec || s===base); });
    var focus = shown.dataset.layout === 'focus';
    $('#app').hidden = focus; $('#focus').hidden = !focus;
    var host = focus ? $('#focusMain') : $('#content');
    if(shown.parentNode !== host) host.appendChild(shown);
    if(base && sec.parentNode !== document.body) document.body.appendChild(sec);
    var gi = findNav(gateKey || shown.dataset.nav);
    $$('[data-slot]', shown).forEach(function(el){ if(gi) el.textContent = el.dataset.slot==='gate-title' ? gi.label : gi.desc; });
    renderNav(shown); renderCrumb(shown); renderTools(shown, sec.hasAttribute('data-dd'));
    if(sec.dataset.showToast) setTimeout(function(){ toast(sec.dataset.showToast); }, 60);
    current = {id:id, base: base ? base.id : null, who: shown.dataset.who};
    if(location.hash.slice(1) !== id) history.replaceState(null,'','#'+id);
    if(!sec.hasAttribute('data-overlay')) window.scrollTo(0,0);
    var f = sec.hasAttribute('data-overlay') ? ($('.modal [autofocus]', sec) || $('.modal .btn.primary:not([aria-disabled]), .modal .btn.danger', sec)) : null;
    if(f) f.focus();
    renderDemo();
  }
  TP.show = show;

  function routeFor(key){
    var who = current && current.who, r = TP.routes[key], it = findNav(key);
    if(it && it.biz && locked(who)) return {id:TP.routes.gate, gate:key};
    if(!r) return null;
    if(typeof r === 'string') return {id:r};
    return {id: r[who] || r.certified};
  }

  function go(key){
    if(key==='msg'){ toast('消息通知属于 M7 消息通知模块，本原型不展开'); return; }
    if(key==='logout'){ show(TP.routes.logout); toast('已退出登录'); return; }
    var r = routeFor(key);
    if(!r){ toast('「'+findNav(key).label+'」属于其他模块，本原型不展开'); return; }
    show(r.id, {gate:r.gate});
  }

  /* —— 画面目录（默认关闭）—— */
  var demoOpen = false;
  function renderDemo(){
    var p = $('#demoPanel'); if(!p) return;
    p.hidden = !demoOpen; $('#demoBtn').setAttribute('aria-expanded', demoOpen?'true':'false');
    if(!demoOpen) return;
    var groups = [], by = {};
    order.forEach(function(s){
      var g = s.dataset.group; if(!by[g]){ by[g]=[]; groups.push(g); } by[g].push(s);
    });
    var cur = current ? document.getElementById(current.id) : null;
    var next = cur && cur.dataset.next;
    p.innerHTML = '<div class="demo-top"><b>画面目录</b><span>评审工具 · 演示数据</span></div>'+
      (next?'<div class="demo-flow"><button type="button" class="btn sm primary" data-demo-go="'+next+'">主流程下一屏：'+esc(document.getElementById(next).dataset.name)+'</button></div>':'')+
      groups.map(function(g){
        return '<div class="demo-g">'+esc(g)+'</div>'+by[g].map(function(s){
          return '<button type="button" class="demo-s" data-demo-go="'+s.id+'"'+(current&&current.id===s.id?' aria-current="true"':'')+'><span class="no">'+esc(s.dataset.no)+'</span><span>'+esc(s.dataset.name)+'</span></button>';
        }).join('');
      }).join('');
  }

  function closeMenus(except){
    var n = 0;
    $$('.dd').forEach(function(d){
      var l = $('.dd-list', d); if(d===except || l.hidden) return;
      l.hidden = true; $('.dd-btn', d).setAttribute('aria-expanded','false'); n++;
    });
    return n;
  }

  document.addEventListener('click', function(e){
    var t = e.target.closest('.dd-item,[data-go],[data-close],[data-nav-key],[data-acct],[data-copy],[data-toast],[data-demo-go],#demoBtn,.dd-btn');
    var own = t && t.matches('.dd-btn') ? t.parentNode : null;
    closeMenus(own);
    if(!t) return;
    if(t.matches('.dd-btn')){ var l = t.nextElementSibling; l.hidden = !l.hidden; t.setAttribute('aria-expanded', l.hidden?'false':'true'); return; }
    if(t.id==='demoBtn'){ demoOpen = !demoOpen; renderDemo(); return; }
    if(t.dataset.demoGo){ show(t.dataset.demoGo); return; }
    if(t.hasAttribute('data-copy')){ toast('已复制'); return; }
    if(t.dataset.toast){ toast(t.dataset.toast); }
    if(t.matches('.dd-item') && !t.dataset.acct){ closeMenus(null); return; }
    if(t.hasAttribute('data-close') && current && current.base){ show(current.base, {gate:gateKey}); return; }
    if(t.dataset.navKey){ go(t.dataset.navKey); return; }
    if(t.dataset.acct){ go(t.dataset.acct); return; }
    if(t.dataset.go){
      var target = document.getElementById(t.dataset.go);
      var base = target && target.hasAttribute('data-overlay') && current ? (current.base || current.id) : null;
      show(t.dataset.go, {base: base, gate: base ? gateKey : null});
    }
  });
  document.addEventListener('keydown', function(e){
    if(e.key!=='Escape') return;
    if(closeMenus(null)) return;
    if(current && current.base){ var x = $('#'+current.id+' [data-close]'); if(x) x.click(); }
  });

  TP.boot = function(first){
    $$('i[data-ico]').forEach(function(i){ i.outerHTML = TP.icon(i.dataset.ico); });
    order = $$('[data-screen]');
    $('#demoBtn').textContent = '画面目录 · 演示数据';
    document.body.classList.add('ready');
    var h = location.hash.slice(1);
    show(document.getElementById(h) && document.getElementById(h).hasAttribute('data-screen') ? h : first);
  };
})();
