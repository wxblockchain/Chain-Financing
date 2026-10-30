/* ==========================================================================
   frame.js — 代币发行平台原型壳层运行时（面客端、管理端）
   只做三件事：渲染壳层（侧栏、顶栏、账户入口）、按画面切换、画面目录。
   不实现业务规则、校验、状态机或演示时钟；规则以 PRD 为准。

   模块页面约定：
   <section data-screen id="…" data-no="A1" data-group="数币账户" data-name="列表"
            data-layout="app|focus" data-who="certified|uncertified|noent|guest|none"
            data-nav="accounts" data-crumb="用户中心/企业账户"
            [data-overlay data-base="返回画面 id" [data-inline 在内容区内呈现确认]] [data-next="主流程下一屏 id"]
            [data-dd 展开账户入口] [data-show-toast="进入画面时的结果提示"]>
   任意元素 data-go="画面 id" 跳转；弹窗内 data-close 回到底层画面；data-toast="文字" 弹出提示；data-copy 复制完整值。
   模块在 TP.routes 中登记菜单与账户入口对应的画面。
   管理端模块另设 TP.NAV_BY[身份] 按角色给出菜单，TP.demo.accounts[身份] 给出账号入口
   （账号名称、登录邮箱、角色、所属机构）；未设置时沿用面客端菜单与钱包地址入口。
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
    check:'<path d="M5 12l5 5 9-10"/>',
    doc:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    search:'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    shield:'<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>',
    ledger:'<path d="M5 4h14v16H5z"/><path d="M9 4v16M12 9h4M12 13h4"/>',
    back:'<path d="M15 6l-6 6 6 6"/>',
    download:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'
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
      {key:'accounts', label:'企业账户', icon:'wallet', biz:true, desc:'管理本企业用于接收代币的数币账户。'},
      {key:'org',      label:'企业信息', icon:'org'},
      {key:'me',       label:'用户信息', icon:'user'}
    ]}
  ];
  TP.routes = TP.routes || {};
  TP.demo = TP.demo || {};

  var $ = function(s,r){ return (r||document).querySelector(s); };
  var $$ = function(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };
  var esc = function(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };
  var current = null, gateKey = null, order = [], returnFocus = null;

  function short(a){ return a ? a.slice(0,6)+'…'+a.slice(-4) : '我的账户'; }
  function locked(who){ return who==='uncertified' || who==='noent'; }

  function toast(t){
    var box = $('#toasts'); if(!box) return;
    var el = document.createElement('div'); el.className='toast'; el.textContent=t; box.appendChild(el); TP.localize(el);
    setTimeout(function(){ el.remove(); }, 2400);
  }
  TP.toast = toast;

  function navList(who){ return (TP.NAV_BY && TP.NAV_BY[who]) || TP.NAV; }
  function renderNav(sec){
    var who = sec.dataset.who, active = gateKey || sec.dataset.nav;
    if(who==='none' || who==='guest'){ $('#nav').innerHTML=''; return; }
    $('#nav').innerHTML = navList(who).map(function(g){
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
    var targets = (sec.dataset.crumbTargets||'').split('/');
    if(gateKey){ var it = findNav(gateKey); parts = [groupOf(gateKey), it.label]; }
    $('#crumb').innerHTML = parts.map(function(p,i){
      var target = targets[i];
      return (i?'<span class="sep" aria-hidden="true">/</span>':'') + (i===parts.length-1?'<b aria-current="page">'+esc(p)+'</b>':
        target && document.getElementById(target)?'<a href="#'+esc(target)+'" data-go="'+esc(target)+'">'+esc(p)+'</a>':'<span>'+esc(p)+'</span>');
    }).join('');
  }

  function adminEntry(acc, open){
    var menu = '<div class="dd-list admin" role="menu"'+(open?'':' hidden')+'>'+
      '<div class="dd-who"><div class="cell-main">'+esc(acc.name)+'</div><div class="cell-sub">'+esc(acc.email)+'</div>'+
      '<div class="dd-role"><span class="tag accent">'+esc(acc.role)+'</span>'+(acc.org?'<span class="cell-sub">'+esc(acc.org)+'</span>':'')+'</div></div>'+
      '<button type="button" class="dd-item" role="menuitem" data-acct="settings">'+TP.icon('user')+'账户设置</button>'+
      '<button type="button" class="dd-item" role="menuitem" data-acct="logout">'+TP.icon('out')+'退出登录</button></div>';
    return '<div class="dd" id="acct"><button type="button" class="dd-btn" aria-haspopup="menu" aria-expanded="'+(open?'true':'false')+'" aria-label="账号：'+esc(acc.name)+'">'+
      TP.icon('user')+'<span>'+esc(acc.name)+'</span>'+TP.icon('chev')+'</button>'+menu+'</div>';
  }

  function accountEntry(who, open){
    if(who==='none') return '';
    if(TP.demo.accounts && TP.demo.accounts[who]) return adminEntry(TP.demo.accounts[who], open);
    var a = TP.demo.address;
    var menu = '<div class="dd-list" role="menu"'+(open?'':' hidden')+'>'+
      '<div class="dd-who"><div class="addr"><span class="addr-pill" title="'+esc(a)+'">'+esc(short(a))+'</span>'+
      '<button type="button" class="btn icon" data-copy aria-label="复制登录地址">'+TP.icon('copy')+'</button></div></div>'+
      '<button type="button" class="dd-item" role="menuitem" data-acct="logout">'+TP.icon('out')+'退出登录</button></div>';
    return '<div class="dd" id="acct"><button type="button" class="dd-btn" aria-haspopup="menu" aria-expanded="'+(open?'true':'false')+'" aria-label="账户：'+esc(a)+'">'+
      '<span class="mono">'+esc(short(a))+'</span>'+TP.icon('chev')+'</button>'+menu+'</div>';
  }

  /* 界面语言：所有访问者、所有页面可切换 */
  function langEntry(){
    var en = TP.language==='en';
    return '<div class="dd lang-switch"><button type="button" class="dd-btn" aria-haspopup="menu" aria-expanded="false" aria-label="界面语言">'+TP.icon('globe')+'<span>'+(en?'English':'简体中文')+'</span>'+TP.icon('chev')+'</button>'+
      '<div class="dd-list narrow" role="menu" hidden><div class="dd-caption">语言</div>'+
      '<button type="button" class="dd-item" role="menuitemradio" aria-checked="'+en+'" data-lang="en">'+(en?TP.icon('check'):'')+'English</button>'+
      '<button type="button" class="dd-item" role="menuitemradio" aria-checked="'+!en+'" data-lang="zh">'+(!en?TP.icon('check'):'')+'简体中文</button></div></div>';
  }

  function renderTools(sec, open){
    var who = sec.dataset.who;
    var bell = (who==='guest'||who==='none') ? '' :
      '<button type="button" class="bell" data-acct="msg" aria-label="消息通知，3 条未读">'+TP.icon('bell')+'<span class="badge" aria-hidden="true">3</span></button>';
    var focus = sec.dataset.layout === 'focus';
    $('#tools').innerHTML = focus ? '' : langEntry() + bell + accountEntry(who, open);
    $('#focusTools').innerHTML = focus ? langEntry() + accountEntry(who, open) : '';
    // Keep the language switch reachable while a form is open, without rebuilding inputs.
    $$('.modal-h').forEach(function(header){
      var title=$('.modal-title',header);
      if(!title){
        title=document.createElement('span');title.className='modal-title';
        Array.from(header.childNodes).filter(function(n){return n.nodeType===3;}).forEach(function(n){title.appendChild(n);});
        if(header.id){title.id=header.id;header.removeAttribute('id');}
        header.prepend(title);
      }
      var language=$('.modal-language',header);
      if(!language){language=document.createElement('div');language.className='modal-language';header.insertBefore(language,$('[data-close]',header));}
      language.innerHTML=langEntry();
    });
  }

  var renderWho = null;
  function curNav(){ return navList(renderWho || (current && current.who)); }
  function findNav(k){ var r=null; curNav().forEach(function(g){ g.items.forEach(function(i){ if(i.key===k) r=i; }); }); return r; }
  function groupOf(k){ var r=''; curNav().forEach(function(g){ g.items.forEach(function(i){ if(i.key===k) r=g.group; }); }); return r; }

  function show(id, opts){
    var sec = document.getElementById(id); if(!sec || !sec.hasAttribute('data-screen')) return;
    gateKey = (opts && opts.gate) || null;
    var base = sec.hasAttribute('data-overlay') ? document.getElementById((opts&&opts.base) || sec.dataset.base) : null;
    var inline = sec.hasAttribute('data-inline');
    var previous = current;
    if(base && (!previous || !previous.base)) returnFocus = document.activeElement;
    var shown = base || sec;
    $$('[data-screen]').forEach(function(s){ s.hidden = !(s===sec || (s===base && !inline)); });
    var focus = shown.dataset.layout === 'focus';
    $('#app').hidden = focus; $('#focus').hidden = !focus;
    var host = focus ? $('#focusMain') : $('#content');
    if(shown.parentNode !== host) host.appendChild(shown);
    if(base){ var destination=inline?host:document.body; if(sec.parentNode!==destination)destination.appendChild(sec); }
    renderWho = shown.dataset.who;
    var gi = findNav(gateKey || shown.dataset.nav);
    $$('[data-slot]', shown).forEach(function(el){ if(gi) el.innerHTML = esc(el.dataset.slot==='gate-title' ? gi.label : gi.desc).replace(/Ethereum/g, '<span class="asset-label">'+TP.assetIcon('ETH')+'Ethereum</span>'); });
    renderNav(shown); renderCrumb(shown); renderTools(shown, sec.hasAttribute('data-dd'));
    if(sec.dataset.showToast) toast(sec.dataset.showToast);
    current = {id:id, base: base ? base.id : null, who: shown.dataset.who};
    if(location.hash.slice(1) !== id) history.replaceState(null,'','#'+id);
    if(!sec.hasAttribute('data-overlay') || inline) window.scrollTo(0,0);
    var f = inline ? $('.btn.primary',sec) : sec.hasAttribute('data-overlay') ? ($('.modal [autofocus]', sec) || $('.modal .btn.primary:not([aria-disabled]), .modal .btn.danger', sec) || $('.modal .modal-f [data-close]',sec)) : null;
    if(f){ if(inline)f.focus({preventScroll:true}); else f.focus(); }
    else if(previous && sec.classList.contains('login-screen')){
      var entry=$('.btn.primary,button[data-go]',sec);if(entry)entry.focus({preventScroll:true});
    }
    if(previous && previous.base && !base && returnFocus && returnFocus.getClientRects().length) returnFocus.focus();
    renderDemo();
    TP.renderDisplay();
    if(inline) window.scrollTo(0,0);
    if(TP.refreshDetailNav) TP.refreshDetailNav();
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
    if(key==='settings'){ toast('账户设置属于管理端登录与权限模块，本原型不展开'); return; }
    if(key==='logout'){ if(TP.routes.logout) show(TP.routes.logout); toast('已退出登录'); return; }
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

  function copyFullValue(button){
    var address=button.closest('.addr'), email=button.closest('.ident');
    var value=address ? $('[title]',address).getAttribute('title') : email ? $('.cell-sub',email).textContent.trim() : '';
    if(!value){ toast('复制失败，请重试。'); return; }
    function fallback(){
      var field=document.createElement('textarea'), previous=document.activeElement;
      field.className='sr-only';field.value=value;document.body.appendChild(field);field.select();
      var copied=false;try{copied=document.execCommand('copy');}catch(e){}
      field.remove();if(previous)previous.focus();toast(copied?'已复制':'复制失败，请重试。');
    }
    if(navigator.clipboard && navigator.clipboard.writeText){navigator.clipboard.writeText(value).then(function(){toast('已复制');},fallback);}
    else fallback();
  }

  document.addEventListener('click', function(e){
    var t = e.target.closest('.dd-item,[data-go],[data-close],[data-nav-key],[data-acct],[data-copy],[data-toast],[data-demo-go],#demoBtn,.dd-btn');
    var own = t && t.matches('.dd-btn') ? t.parentNode : null;
    closeMenus(own);
    if(!t) return;
    if(t.matches('.dd-btn')){ var l = t.nextElementSibling; l.hidden = !l.hidden; t.setAttribute('aria-expanded', l.hidden?'false':'true'); return; }
    if(t.id==='demoBtn'){ demoOpen = !demoOpen; renderDemo(); TP.localize($('#demoPanel')); return; }
    if(t.dataset.lang){ TP.setLanguage(t.dataset.lang); renderTools(document.getElementById(current.base || current.id), false); TP.renderDisplay(); return; }
    if(t.dataset.demoGo){ show(t.dataset.demoGo); return; }
    if(t.hasAttribute('data-copy')){ copyFullValue(t); return; }
    if(t.dataset.toast){ toast(t.dataset.toast); }
    if(t.matches('.dd-item') && !t.dataset.acct){ closeMenus(null); return; }
    if(t.hasAttribute('data-close') && current && current.base){ show(current.base, {gate:gateKey}); return; }
    if(t.dataset.navKey){ go(t.dataset.navKey); return; }
    if(t.dataset.acct){ go(t.dataset.acct); return; }
    if(t.dataset.go){
      if(t.tagName==='A') e.preventDefault();
      var target = document.getElementById(t.dataset.go);
      var base = target && target.hasAttribute('data-overlay') && current ? (current.base || current.id) : null;
      show(t.dataset.go, {base: base, gate: base ? gateKey : null});
    }
  });
  document.addEventListener('keydown', function(e){
    if(e.key==='Tab' && current && current.base){
      var modal=$('#'+current.id+' .modal');
      if(modal){
        var focusable=$$('button,input,select,textarea,a[href],[tabindex]',modal).filter(function(el){return !el.disabled && el.tabIndex>=0 && el.getClientRects().length;});
        var first=focusable[0], last=focusable[focusable.length-1];
        if(first && (!modal.contains(document.activeElement) || (e.shiftKey && document.activeElement===first))){e.preventDefault();(e.shiftKey?last:first).focus();}
        else if(last && !e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
      }
    }
    if(e.key!=='Escape') return;
    var menuTrigger=$('.dd-btn[aria-expanded="true"]');
    if(closeMenus(null)){ if(menuTrigger)menuTrigger.focus(); return; }
    if(current && current.base){ var x = $('#'+current.id+' [data-close]'); if(x) x.click(); }
  });

  TP.refreshLanguageTools = function(){ if(current) renderTools(document.getElementById(current.base || current.id),false); };

  TP.boot = function(first){
    TP.initDisplay();
    // Sticky detail sections follow the actual header height at narrow widths.
    if(window.ResizeObserver){
      new ResizeObserver(function(entries){
        var height=entries[0].target.getBoundingClientRect().height;
        if(height)document.documentElement.style.setProperty('--app-header-h',height+'px');
      }).observe($('#tools').closest('.topbar'));
    }
    $$('i[data-asset]').forEach(function(i){ i.outerHTML = TP.assetIcon(i.dataset.asset); });
    $$('i[data-ico]').forEach(function(i){ i.outerHTML = TP.icon(i.dataset.ico); });
    order = $$('[data-screen]');
    $$('.login-screen').forEach(function(sec){ $('#focusMain').appendChild(sec); });
    $('#demoBtn').textContent = '画面目录 · 演示数据';
    document.body.classList.add('ready');
    var h = location.hash.slice(1);
    show(document.getElementById(h) && document.getElementById(h).hasAttribute('data-screen') ? h : first);
    // 初次按 hash 打开长页面时，等浏览器完成片段定位后恢复页头可见。
    window.addEventListener('load', function(){
      requestAnimationFrame(function(){ if(current && !current.base) window.scrollTo(0,0); });
    }, {once:true});
  };
})();
