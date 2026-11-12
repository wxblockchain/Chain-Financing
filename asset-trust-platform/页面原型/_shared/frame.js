/* ==========================================================================
   frame.js — 资产可信平台原型壳层运行时（企业端；运营端后续沿用）
   基线：代币发行平台 frame.js（组件规范 v1.96）。本平台改动：账号入口显示姓名与登录邮箱并提供“账户信息”；
   入驻准备与首登改密的 focus 画面（data-restricted）只给出登录邮箱与退出；本期无消息入口与认证锁定菜单。
   只做三件事：渲染壳层（侧栏、顶栏、账号入口）、按画面切换、画面目录。
   不实现业务规则、校验、状态机或演示时钟；规则以 PRD 为准。

   模块页面约定：
   <section data-screen id="…" data-no="A1" data-group="账户信息" data-name="默认"
            data-layout="app|focus" data-who="none|onboarding|debtor|creditor|both|norole"
            data-nav="account" data-crumb="账户/账户信息"
            [data-overlay data-base="返回画面 id" [data-inline 在内容区内呈现确认]] [data-next="主流程下一屏 id"]
            [data-dd 展开账号入口] [data-show-toast="进入画面时的结果提示"] [data-restricted 受限登录，仅语言与退出]>
   入驻未完成的身份（TP.demo.accounts[身份].locked）：侧栏全部菜单可见，带锁形标记、不可点击（aria-disabled）。
   任意元素 data-go="画面 id" 跳转；弹窗内 data-close 回到底层画面；data-toast="文字" 弹出提示；data-copy 复制完整值。
   模块在 TP.routes 中登记菜单与账号入口对应的画面。
   data-password-toggle="输入框 id" 只切换密码显隐，不校验密码。
   菜单与演示账号只在 _shared/menu.client.js（企业端）与 menu.ops.js（运营端）维护（TP.NAV_BY[身份]、TP.demo.accounts[身份]），模块不复制。
   账号入口菜单项默认“账户信息”，账号可用 settingsLabel 指定（运营端为“账户设置”）。
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
    eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off':'<path d="M3 3l18 18M10.6 5.1A13 13 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 4M6.1 6.1A19 19 0 0 0 2 12s3.5 7 10 7a13 13 0 0 0 5.9-1.4M10 10a3 3 0 0 0 4 4"/>',
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
    download:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    receivable:'<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6M9 18h3"/>',
    confirm:'<path d="M6 3h9l3 3v15H6z"/><path d="M9 13l2 2 4-4"/>',
    cart:'<path d="M3 4h2l2.4 11h10.2L20 8H6.2"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
    truck:'<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
    database:'<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
    send:'<path d="M4 12l16-8-6 16-3-7z"/><path d="M11 13l9-9"/>'
  };
  TP.icon = function(n){ return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">'+(ICON[n]||'')+'</svg>'; };
  TP.refreshPasswordToggles = function(){
    document.querySelectorAll('[data-password-toggle]').forEach(function(button){
      var input=document.getElementById(button.dataset.passwordToggle);if(!input)return;
      var visible=input.type==='text', en=TP.language==='en';
      var label=visible?(en?'Hide password':'隐藏密码'):(en?'Show password':'显示密码');
      button.innerHTML=TP.icon(visible?'eye-off':'eye');
      button.setAttribute('aria-pressed',String(visible));
      button.setAttribute('aria-label',label);button.setAttribute('title',label);
    });
  };

  /* 菜单由 menu.client.js（企业端 TP.NAV）或 menu.admin.js（管理端 TP.NAV_BY）提供 */
  TP.NAV = TP.NAV || [];
  TP.routes = TP.routes || {};
  TP.demo = TP.demo || {};

  var $ = function(s,r){ return (r||document).querySelector(s); };
  var $$ = function(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };
  var esc = function(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };
  var current = null, gateKey = null, order = [], returnFocus = null;

  function short(a){ return a ? a.slice(0,6)+'…'+a.slice(-4) : '我的账户'; }
  /* 入驻未完成（账号 locked:true）时全部菜单可见、带锁形标记且不可点击；与代币发行平台同一锁形标记。 */
  function locked(who){ var a = TP.demo.accounts && TP.demo.accounts[who]; return !!(a && a.locked); }

  function toast(t){
    var box = $('#toasts'); if(!box) return;
    var el = document.createElement('div'); el.className='toast'; el.textContent=t; box.appendChild(el); TP.localize(el);
    setTimeout(function(){ el.remove(); }, 2400);
  }
  TP.toast = toast;
  /* 跨模块入口没有目标画面时的统一范围提示：附件说明到完整原型打开，仓库联看说明尚未纳入 */
  var SCOPE_FILE = '此入口在单模块附件中不展开，请在完整原型的 index.html 中打开。', SCOPE_REPO = '该入口尚未纳入原型。';
  // 本平台尚无仓库联看入口（index.html）：未交付模块的入口统一提示“尚未纳入原型”。
  function scope(){ return SCOPE_REPO; }

  function navList(who){ return (TP.NAV_BY && TP.NAV_BY[who]) || TP.NAV; }
  function renderNav(sec){
    var who = sec.dataset.who, active = gateKey || sec.dataset.nav;
    if(who==='none' || who==='guest'){ $('#nav').innerHTML=''; return; }
    $('#nav').innerHTML = navList(who).map(function(g){
      return '<div class="nav-group">'+g.group+'</div>' + g.items.map(function(it){
        var lk = locked(who);
        // 数量由所属模块按当前用户提供；这里只呈现，不计算待办或改变菜单权限。
        var count = it.pendingCount, badge = '';
        if(!lk && Number.isSafeInteger(count) && count > 0){
          var label = count + ' 项待办';
          badge = '<span class="nav-pending-count" title="'+label+'"><span aria-hidden="true">'+(count > 99 ? '99+' : count)+'</span><span class="sr-only">'+label+'</span></span>';
        }
        return '<button type="button" class="nav-item" data-nav-key="'+it.key+'"'+(lk?' aria-disabled="true" title="完成入驻后可用"':(active===it.key?' aria-current="page"':''))+'>'+
          TP.icon(it.icon)+'<span class="nav-label">'+it.label+'</span>'+badge+(lk?'<span class="lock">'+TP.icon('lock')+'<span class="sr-only">完成入驻后可用</span></span>':'')+'</button>';
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

  /* 账号入口：胶囊显示姓名；展开为姓名、登录邮箱、业务角色，再是账户信息与退出登录。
     受限登录（首登改密、入驻准备）尚无姓名与业务，只显示登录邮箱与退出登录。 */
  function adminEntry(acc, open){
    var label = acc.restricted ? acc.email : acc.name;
    var roles = (acc.roles||[]).map(function(r){ return '<span class="tag accent">'+esc(r)+'</span>'; }).join('');
    var menu = '<div class="dd-list admin" role="menu"'+(open?'':' hidden')+'>'+
      '<div class="dd-who">'+(acc.restricted?'<div class="cell-sub">'+esc(acc.email)+'</div>':
        '<div class="cell-main">'+esc(acc.name)+'</div><div class="cell-sub">'+esc(acc.email)+'</div>'+(roles?'<div class="dd-role">'+roles+'</div>':''))+'</div>'+
      (acc.restricted?'':'<button type="button" class="dd-item" role="menuitem" data-acct="settings">'+TP.icon('user')+esc(acc.settingsLabel||'账户信息')+'</button>')+
      '<button type="button" class="dd-item" role="menuitem" data-acct="logout">'+TP.icon('out')+'退出登录</button></div>';
    return '<div class="dd" id="acct"><button type="button" class="dd-btn" aria-haspopup="menu" aria-expanded="'+(open?'true':'false')+'" aria-label="账号：'+esc(label)+'">'+
      TP.icon('user')+'<span>'+esc(label)+'</span>'+TP.icon('chev')+'</button>'+menu+'</div>';
  }

  var screenAddr = ''; /* 画面可用 data-address 指定本屏的登录地址（如登录地址变更后） */
  function accountEntry(who, open){
    if(who==='none') return '';
    if(TP.demo.accounts && TP.demo.accounts[who]) return adminEntry(TP.demo.accounts[who], open);
    var a = screenAddr || TP.demo.address;
    var menu = '<div class="dd-list" role="menu"'+(open?'':' hidden')+'>'+
      '<div class="dd-who"><div class="addr"><span class="addr-pill" title="'+esc(a)+'">'+esc(short(a))+'</span>'+
      '<button type="button" class="btn icon" data-copy aria-label="复制本次钱包地址">'+TP.icon('copy')+'</button></div></div>'+
      '<button type="button" class="dd-item" role="menuitem" data-acct="logout">'+TP.icon('out')+'退出登录</button></div>';
    return '<div class="dd" id="acct"><button type="button" class="dd-btn" aria-haspopup="menu" aria-expanded="'+(open?'true':'false')+'" aria-label="账户：'+esc(a)+'">'+
      '<span class="mono">'+esc(short(a))+'</span>'+TP.icon('chev')+'</button>'+menu+'</div>';
  }

  /* 界面语言：所有访问者、所有页面可切换 */
  function langEntry(){
    var en = TP.language==='en';
    return '<div class="dd lang-switch"><button type="button" class="dd-btn" aria-haspopup="menu" aria-expanded="false" aria-label="界面语言">'+TP.icon('globe')+'<span>'+(en?'EN':'中文')+'</span>'+TP.icon('chev')+'</button>'+
      '<div class="dd-list narrow" role="menu" hidden><div class="dd-caption">语言</div>'+
      '<button type="button" class="dd-item" role="menuitemradio" aria-checked="'+en+'" data-lang="en">'+(en?TP.icon('check'):'')+'English</button>'+
      '<button type="button" class="dd-item" role="menuitemradio" aria-checked="'+!en+'" data-lang="zh">'+(!en?TP.icon('check'):'')+'简体中文</button></div></div>';
  }

  function renderTools(sec, open, screen){
    screenAddr = sec.dataset.address || '';
    var who = sec.dataset.who;
    var focus = sec.dataset.layout === 'focus';
    // 本期没有消息入口（消息中心另行交付）；顶栏只有界面语言与账号入口。
    $('#tools').innerHTML = focus ? '' : langEntry() + accountEntry(who, open);
    $('#focusTools').innerHTML = focus ? langEntry() + accountEntry(who, open) : '';
    // 语言切换只放在平台顶栏；弹窗内不设语言入口。
    $$('.modal-h').forEach(function(header){
      var title=$('.modal-title',header);
      if(!title){
        title=document.createElement('span');title.className='modal-title';
        Array.from(header.childNodes).filter(function(n){return n.nodeType===3;}).forEach(function(n){title.appendChild(n);});
        if(header.id){title.id=header.id;header.removeAttribute('id');}
        header.prepend(title);
      }
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
    renderNav(shown); renderCrumb(shown); renderTools(shown, sec.hasAttribute('data-dd'), sec);
    if(sec.dataset.showToast) toast(sec.dataset.showToast);
    current = {id:id, base: base ? base.id : null, who: shown.dataset.who, gate:gateKey};
    TP.currentScreen = current;
    if(location.hash.slice(1) !== id){
      try{ history.replaceState(null,'','#'+id); }
      catch(error){
        // 附件的 srcdoc 预览可能禁止改写地址；仍须继续渲染时间、语言与焦点。
        if(error.name!=='SecurityError') throw error;
      }
    }
    if(!sec.hasAttribute('data-overlay') || inline) window.scrollTo(0,0);
    var f = inline ? $('.btn.primary',sec) : sec.hasAttribute('data-overlay') ? ($('.modal [autofocus]', sec) || $('.modal .btn.primary:not([aria-disabled]), .modal .btn.danger', sec) || $('.modal .modal-f [data-close]',sec)) : null;
    if(f){ if(inline)f.focus({preventScroll:true}); else f.focus(); }
    else if(previous && sec.classList.contains('login-screen')){
      var entry=$('.btn.primary,button[data-go]',sec);if(entry)entry.focus({preventScroll:true});
    }
    if(previous && previous.base && !base && returnFocus && returnFocus.getClientRects().length) returnFocus.focus();
    if(sec.dataset.inbox){ var first=$('#tools .inbox-panel .msg-item, #tools .inbox-panel .btn'); if(first) first.focus({preventScroll:true}); }
    renderDemo();
    TP.renderDisplay();
    if(inline) window.scrollTo(0,0);
    syncStickyHead();
    if(TP.refreshDetailNav) TP.refreshDetailNav();
  }
  TP.show = show;

  function routeFor(key){
    var who = current && current.who, r = TP.routes[key], it = findNav(key);
    if(it && it.biz && locked(who)) return {id:(TP.routes.gateByWho && TP.routes.gateByWho[who]) || TP.routes.gate, gate:key};
    // Optional static view-set routes keep a demonstration variant on its own screens.
    var sec = current && document.getElementById(current.base || current.id);
    var preset = sec && TP.previewSets && TP.previewSets[sec.dataset.previewSet];
    if(preset){
      if(preset.routes[key]) return {id:preset.routes[key]};
      if(preset.localOnly) return {scope:true};
    }
    if(!r) return null;
    if(typeof r === 'string') return {id:r};
    return {id: r[who] || r.certified};
  }

  function go(key){
    if(key==='settings' && !TP.routes.settings){ if(TP.navigate && TP.navigate(key,current)) return; toast(scope()); return; }
    if(key==='logout'){ if(TP.routes.logout) show(TP.routes.logout); else if(TP.navigate && TP.navigate(key,current)) return; toast('已退出登录'); return; }
    var r = routeFor(key);
    if(r && r.scope){toast(scope()); return;}
    if(!r || !r.id){ if(TP.navigate && TP.navigate(key,current)) return; toast(scope()); return; }
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
    // 端与身份切换只在仓库联看提供；单模块附件不含其他模块，只说明打开方式。
    var ends = TP.renderPreviewSwitch ? TP.renderPreviewSwitch() :
      TP.previewMode==='module' ? '<p class="demo-note">单模块附件。切换企业端、管理端请在仓库中打开 index.html。</p>' : '';
    p.innerHTML = '<div class="demo-top"><b>画面目录</b><span>评审工具 · 演示数据</span></div>'+ends+
      (ends?'<div class="demo-g demo-sep">本模块画面</div>':'')+
      (next?'<div class="demo-flow"><button type="button" class="btn sm primary" data-demo-go="'+next+'">主流程下一屏：'+esc(document.getElementById(next).dataset.name)+'</button></div>':'')+
      groups.map(function(g){
        return '<div class="demo-g">'+esc(g)+'</div>'+by[g].map(function(s){
          return '<button type="button" class="demo-s" data-demo-go="'+s.id+'"'+(current&&current.id===s.id?' aria-current="true"':'')+'><span class="no">'+esc(s.dataset.no)+'</span><span>'+esc(s.dataset.name)+'</span></button>';
        }).join('');
      }).join('');
  }

  /* 预览画面（data-inbox）收起预览即回到底层页面。 */
  function leaveInboxScreen(){
    var sec = current && document.getElementById(current.id);
    if(!sec || !sec.dataset.inbox || !current.base) return false;
    show(current.base); var bell = $('#tools .bell'); if(bell) bell.focus(); return true;
  }
  function closeMenus(except){
    var n = 0, inbox = false;
    $$('.dd').forEach(function(d){
      var l = $('.dd-list', d); if(d===except || l.hidden) return;
      l.hidden = true; $('.dd-btn', d).setAttribute('aria-expanded','false'); n++;
      if(d.classList.contains('inbox')) inbox = true;
    });
    if(inbox) leaveInboxScreen();
    return n;
  }

  // 完整金额浮层：固定定位于图标下方右对齐，靠近视口边缘时翻到上方或内收；页面或表格滚动时跟随图标，图标移出视口即收起。
  function placeValuePop(button, list){
    var r=button.getBoundingClientRect(), w=list.offsetWidth, h=list.offsetHeight, gap=6, edge=8;
    var top=r.bottom+gap; if(top+h>window.innerHeight-edge) top=Math.max(edge, r.top-h-gap);
    list.style.top=top+'px'; list.style.left=Math.max(edge, Math.min(r.right-w, window.innerWidth-w-edge))+'px';
  }
  function followValuePops(){
    $$('.value-pop>.dd-btn[aria-expanded="true"]').forEach(function(b){
      var r=b.getBoundingClientRect(), l=b.nextElementSibling;
      if(r.bottom<0 || r.top>window.innerHeight || !r.width){ l.hidden=true; b.setAttribute('aria-expanded','false'); }
      else placeValuePop(b, l);
    });
  }
  window.addEventListener('scroll', followValuePops, true);
  window.addEventListener('resize', followValuePops);

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
    var t = e.target.closest('.dd-item,[data-go],[data-close],[data-nav-key],[data-acct],[data-copy],[data-toast],[data-demo-go],[data-password-toggle],#demoBtn,.dd-btn');
    if(!t && e.target.closest('.inbox-panel')) return; // 预览内的空白处不收起预览
    if(!t && e.target.closest('.value-pop>.dd-list')) return; // 完整金额浮层内可选中复制
    var own = t && t.matches('.dd-btn') ? t.parentNode : null;
    closeMenus(own);
    if(!t) return;
    // 入驻期间的锁定菜单：不进入，只说明完成入驻后可用。
    if(t.matches('.nav-item[aria-disabled="true"]')){ toast('完成入驻后可用'); return; }
    if(t.disabled || t.getAttribute('aria-disabled')==='true') return;
    if(t.hasAttribute('data-password-toggle')){
      var input=document.getElementById(t.dataset.passwordToggle);
      if(input){input.type=input.type==='password'?'text':'password';TP.refreshPasswordToggles();}
      return;
    }
    if(t.matches('.dd-btn')){ var l = t.nextElementSibling; l.hidden = !l.hidden; t.setAttribute('aria-expanded', l.hidden?'false':'true'); if(l.hidden && t.classList.contains('bell')) leaveInboxScreen(); if(!l.hidden && own.classList.contains('value-pop')) placeValuePop(t, l); return; }
    if(t.id==='demoBtn'){ demoOpen = !demoOpen; renderDemo(); TP.localize($('#demoPanel')); return; }
    if(t.dataset.lang){ TP.setLanguage(t.dataset.lang); renderTools(document.getElementById(current.base || current.id), false, document.getElementById(current.id)); TP.renderDisplay(); syncStickyHead(); return; }
    if(t.dataset.demoGo){ show(t.dataset.demoGo); return; }
    if(t.hasAttribute('data-copy')){ copyFullValue(t); return; }
    if(t.dataset.moduleKey && TP.navigate && TP.navigate(t.dataset.moduleKey,current,t.dataset.moduleWho)) return;
    if(t.dataset.toast){ toast(t.dataset.toast===SCOPE_FILE ? scope() : t.dataset.toast); }
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

  // Static screen forms never submit to a server or reload a file preview.
  document.addEventListener('submit',function(e){
    if(e.target.matches('form[data-static-form]'))e.preventDefault();
  });

  TP.refreshLanguageTools = function(){ if(current) renderTools(document.getElementById(current.base || current.id),false,document.getElementById(current.id)); };

  /* 列表进入的详情页（三级及以上面包屑）：标题行滚动时吸附在顶栏下方，编号与操作按钮始终可见。
     --sticky-head-h 供详情分区导航与锚点偏移使用；吸附后加底线区分滚动内容。 */
  var stickyHead = null;
  /* 列表分页（PRD M2 §5.8 业务列表通用规则）：卡片加 data-pager 即在表格下方生成分页条；
     data-pager 的值为符合条件的总数（缺省为本页行数），每页 10 条。只展示第 1 页，不实现翻页。 */
  var PAGE_TOAST = '演示数据只提供第 1 页。';
  TP.buildPager = function(count, label){
    var pager = document.createElement('nav'); pager.className = 'asset-pagination'; pager.setAttribute('aria-label', label || '分页');
    var pages = Math.max(1, Math.ceil(count/10)), later = pages>1 ? ' data-toast="'+PAGE_TOAST+'"' : ' disabled', buttons = '';
    for(var n=2; n<=pages; n++) buttons += '<button class="btn sm ghost" type="button" aria-label="第 '+n+' 页" data-toast="'+PAGE_TOAST+'">'+n+'</button>';
    pager.innerHTML = '<span class="pagination-total"><span>共</span> '+count+' <span>条</span></span><div class="pagination-controls">'+
      '<button class="btn sm ghost" type="button" disabled aria-label="上一页">'+TP.icon('back')+'</button>'+
      '<button class="btn sm page-current" type="button" aria-current="page" aria-label="第 1 页">1</button>'+buttons+
      '<button class="btn sm ghost" type="button"'+later+' aria-label="下一页">'+TP.icon('chev')+'</button></div>';
    return pager;
  };
  function fillPagers(){
    $$('[data-pager]').forEach(function(card){
      if(card.querySelector(':scope > .asset-pagination')) return;
      var rows = card.querySelectorAll('table tbody tr').length;
      card.appendChild(TP.buildPager(Number(card.dataset.pager) || rows));
    });
  }
  if(TP.addCopy) TP.addCopy({'分页':'Pages','共':'Total','条':'records','上一页':'Previous page','下一页':'Next page','第 1 页':'Page 1','第 2 页':'Page 2','第 3 页':'Page 3',
    '演示数据只提供第 1 页。':'This demo includes page 1 only.'});

  function markStickyHeads(){
    order.forEach(function(sec){
      if(sec.dataset.layout!=='app' || (sec.hasAttribute('data-overlay') && !sec.hasAttribute('data-inline'))) return;
      if((sec.dataset.crumb||'').split('/').filter(Boolean).length<3) return;
      var head = $('.content-in > .page-head', sec) || $('.page-head', sec);
      if(head) head.setAttribute('data-sticky','');
    });
  }
  function syncStickyHead(){
    var topbar = $('#tools').closest('.topbar');
    if(!$('#app').hidden) document.documentElement.style.setProperty('--inbox-top', Math.max(0,topbar.getBoundingClientRect().bottom)+'px');
    var head = $('#content [data-screen]:not([hidden]) .page-head[data-sticky]');
    if(stickyHead && stickyHead!==head) stickyHead.classList.remove('is-stuck');
    stickyHead = head;
    document.documentElement.style.setProperty('--sticky-head-h', head ? head.offsetHeight+'px' : '0px');
    if(head) head.classList.toggle('is-stuck', window.scrollY>0 && head.getBoundingClientRect().top <= (parseFloat(getComputedStyle(head).top)||0)+1);
  }
  TP.syncStickyHead = syncStickyHead;
  var stickyPending = false;
  window.addEventListener('scroll', function(){
    if(stickyPending) return; stickyPending = true;
    requestAnimationFrame(function(){ stickyPending = false; syncStickyHead(); });
  }, {passive:true});
  window.addEventListener('resize', syncStickyHead);

  TP.boot = function(first){
    TP.initDisplay();
    if(TP.initNavigation) TP.initNavigation();
    // Sticky detail sections follow the actual header height at narrow widths.
    if(window.ResizeObserver){
      new ResizeObserver(function(entries){
        var height=entries[0].target.getBoundingClientRect().height;
        if(height)document.documentElement.style.setProperty('--app-header-h',height+'px');
      }).observe($('#tools').closest('.topbar'));
      var onboardObserver=new ResizeObserver(function(entries){
        entries.forEach(function(entry){
          var height=entry.target.getBoundingClientRect().height;
          if(height)entry.target.closest('.onboard-screen').style.setProperty('--onboard-head-h',height+'px');
        });
      });
      $$('.onboard-head').forEach(function(head){onboardObserver.observe(head);});
    }
    $$('i[data-asset]').forEach(function(i){ i.outerHTML = TP.assetIcon(i.dataset.asset); });
    $$('i[data-ico]').forEach(function(i){ i.outerHTML = TP.icon(i.dataset.ico); });
    order = $$('[data-screen]');
    fillPagers();
    markStickyHeads();
    $$('.login-screen').forEach(function(sec){ $('#focusMain').appendChild(sec); });
    $('#demoBtn').textContent = '画面目录 · 演示数据';
    document.body.classList.add('ready');
    var h = location.hash.slice(1);
    show(document.getElementById(h) && document.getElementById(h).hasAttribute('data-screen') ? h : first, TP.initialNavigationOptions);
    // 初次按 hash 打开长页面时，等浏览器完成片段定位后恢复页头可见。
    window.addEventListener('load', function(){
      requestAnimationFrame(function(){
        if(current && !current.base) window.scrollTo(0,0);
        // 跨模块路由指定了分区时（navigation.js 的 previewSection），定位到当前画面内的该分区。
        var key=TP.initialSection, sec=key && document.getElementById(current && current.id);
        var part=sec && sec.querySelector('[data-section="'+key+'"]');
        if(part){ part.scrollIntoView({block:'start',behavior:'instant'}); part.focus({preventScroll:true}); if(TP.refreshDetailNav) TP.refreshDetailNav(); }
      });
    }, {once:true});
  };
})();
