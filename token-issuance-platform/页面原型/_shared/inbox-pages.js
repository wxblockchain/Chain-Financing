/* ==========================================================================
   inbox-pages.js — M7 消息通知页面：消息列表卡片与逐条消息详情画面，由 inbox.js 的演示消息生成。
   只被两份 M7 模块 HTML 引用（面客端、管理端），须在 TP.boot 之前调用 TP.inboxPages.build。
   列表每屏用 data-* 声明展示哪些消息、哪些为已读、当前筛选和各控件去向；不做筛选匹配、计数运算或已读保存。

   <div class="card" data-inbox-view data-role="ops" data-items="o01..o20" [data-read="all|o03 o05"]
        data-seg="all|unread|read" data-cat="" data-seg-go="all:o-list unread:… read:…" data-cat-go=":o-list review:…"
        data-more="more|end|error" [data-more-go="…"] data-markall="确认画面 id|none" [data-state="never|filtered|error"]>
   ========================================================================== */
(function(TP){
  'use strict';
  var IB = TP.inbox, esc = IB.esc;
  var SCOPE = '此入口在单模块附件中不展开，请在完整原型的 index.html 中打开。', UNDRAWN = '该入口尚未纳入原型。';

  function ids(spec){
    var out = [];
    (spec||'').split(/\s+/).filter(Boolean).forEach(function(part){
      var r = part.split('..');
      if(r.length===1){ out.push(part); return; }
      var pre = r[0].replace(/\d+$/,''), a = +r[0].slice(pre.length), b = +r[1].slice(pre.length), w = r[0].length-pre.length;
      for(var i=a;i<=b;i++){ var n=String(i); while(n.length<w) n='0'+n; out.push(pre+n); }
    });
    return out;
  }
  function map(spec){
    var o = {}; (spec||'').split(/\s+/).filter(Boolean).forEach(function(p){ var i=p.indexOf(':'); o[p.slice(0,i)] = p.slice(i+1); }); return o;
  }
  function go(id){ return id ? ' data-go="'+id+'"' : ' data-toast="'+UNDRAWN+'"'; }

  var SEG = [['all','全部'],['unread','未读'],['read','已读']];
  function cats(role){
    var seen = {}; IB.DATA[role].forEach(function(m){ seen[m.cat] = true; });
    return Object.keys(IB.CATS).filter(function(k){ return seen[k]; });
  }

  /* 筛选条：已读状态（分段，改选即生效）+ 分类（下拉，“全部”加本人实际有消息的分类）+ 全部已读 */
  function toolbar(el, role){
    var segGo = map(el.dataset.segGo), catGo = map(el.dataset.catGo), seg = el.dataset.seg||'all', cat = el.dataset.cat||'';
    var mark = el.dataset.markall, off = !mark || mark==='none';
    var hintId = el.closest('[data-screen]').id+'-mark-hint';
    return '<div class="asset-filters inbox-filters"><div class="filter-toolbar">'+
      '<div class="seg" role="radiogroup" aria-label="已读状态">'+SEG.map(function(s){
        return '<button type="button" role="radio" aria-checked="'+(s[0]===seg)+'"'+(s[0]===seg?'':go(segGo[s[0]]))+'>'+s[1]+'</button>';
      }).join('')+'</div>'+
      '<span class="filter-select"><select class="inp" aria-label="分类" data-inbox-cat>'+
        '<option value=""'+(cat?'':' selected')+(catGo['']?' data-go="'+catGo['']+'"':'')+'>分类 · 全部</option>'+
        cats(role).map(function(k){
          return '<option value="'+k+'"'+(k===cat?' selected':'')+(catGo[k]?' data-go="'+catGo[k]+'"':'')+'>分类 · '+IB.CATS[k]+'</option>';
        }).join('')+'</select></span>'+
      '<div class="inbox-actions">'+(off?'<span class="footer-hint" id="'+hintId+'">当前筛选下没有未读消息</span>':'')+
        '<button type="button" class="btn sm"'+(off?' aria-disabled="true" aria-describedby="'+hintId+'"':go(document.getElementById(mark)?mark:null))+'>'+TP.icon('check')+'全部已读</button></div>'+
      '</div></div>';
  }

  function view(el){
    var role = el.dataset.role, state = el.dataset.state, list = ids(el.dataset.items);
    var readAll = el.dataset.read==='all', readIds = readAll ? [] : ids(el.dataset.read);
    var html = state==='never' ? '' : toolbar(el, role);
    if(state==='never'){
      html += '<div class="state" role="status"><span class="state-ico">'+TP.icon('bell')+'</span><h3>还没有消息</h3><p>业务有新的进展时，会在这里通知你。</p></div>';
    }else if(state==='error'){
      html += '<div class="state err" role="alert"><span class="state-ico">'+TP.icon('alert')+'</span><h3>消息读取失败</h3><p>暂时无法读取，请稍后重试。</p><button type="button" class="btn"'+go(el.dataset.retryGo)+'>重试</button></div>';
    }else if(state==='filtered'){
      html += '<div class="state" role="status"><span class="state-ico">'+TP.icon('search')+'</span><h3>当前筛选下没有消息</h3><p>更换已读状态或分类后再看看。</p><button type="button" class="btn"'+go(el.dataset.clearGo)+'>清除筛选</button></div>';
    }else{
      html += '<ul class="msg-list">'+list.map(function(id){
        var m = IB.find(role, id); return IB.item(role, m, {read: readAll || readIds.indexOf(id)!==-1 || m.read, screen:(el.dataset.prefix||'m-')+id});
      }).join('')+'</ul>';
      var more = el.dataset.more;
      if(more==='more') html += '<div class="msg-more"><button type="button" class="btn sm"'+go(el.dataset.moreGo)+'>加载更多</button></div>';
      else if(more==='error') html += '<div class="msg-more err" role="alert">'+TP.icon('alert')+'<span>更多消息加载失败，已加载的消息保留。</span><button type="button" class="btn sm"'+go(el.dataset.moreGo)+'>重试</button></div>';
      else html += '<div class="msg-more">没有更多消息了</div>';
    }
    el.innerHTML = html;
  }

  var STATE = {act:'可前往原业务', done:'原动作已办完', page:'前往固定页面', denied:'相关内容不可访问', none:'不跳转', undrawn:'原业务未纳入原型'};
  var STATE_EN = {act:'record available', done:'action already completed', page:'opens a fixed page', denied:'content unavailable', none:'no destination', undrawn:'record not in prototype'};
  function stateOf(m){
    if(m.denied) return 'denied';
    if(!m.go) return m.ref ? 'undrawn' : 'none';
    if(m.go.page) return 'page';
    return m.done ? 'done' : 'act';
  }

  /* 相关业务：原业务识别信息；可前往时点编号进入（与平台“编号即入口”一致），固定页面用文字按钮。 */
  function related(m){
    var st = stateOf(m), out = '';
    if(m.ref){
      out += '<div class="card-sec msg-related"><h2 class="sub-h">相关业务</h2><div class="facts-region"><dl class="facts">'+m.ref.map(function(r,i){
        var linked = i===0 && (st==='act' || st==='done');
        return '<div><dt>'+r[0]+'</dt><dd>'+(linked?'<button type="button" class="btn-link mono" data-module-key="'+m.go.key+'" data-toast="'+SCOPE+'">'+esc(r[1])+'</button>':'<span class="mono">'+esc(r[1])+'</span>')+'</dd></div>';
      }).join('')+(m.extra||[]).map(function(x){ return '<div><dt>'+x[0]+'</dt><dd><span class="tag warn">'+esc(x[1])+'</span></dd></div>'; }).join('')+'</dl></div>'+
      (st==='denied'?'<div class="msg-go"><p class="note">'+TP.icon('info')+'<span>相关内容暂不可访问。</span></p></div>':'')+'</div>';
    }
    if(st==='page') out += '<div class="msg-go"><button type="button" class="btn" data-module-key="'+m.go.key+'" data-toast="'+SCOPE+'">'+m.go.page+'</button></div>';
    return out;
  }

  /* 消息详情的页面内容；opts.unsaved 为已读保存失败（正文照常可读，仍为未读）。 */
  function detail(m, opts){
    opts = opts || {};
    return '<div class="content-in"><div class="page-head"><div>'+
      '<div class="page-title-row"><h1 class="page-title">'+IB.title(m)+'</h1><span class="tag">'+IB.CATS[m.cat]+'</span></div>'+
      '<p class="page-desc"><time data-instant="'+m.at+'"></time><span class="faint"> · </span><span>时区</span> <span data-zone></span></p></div></div>'+
      (opts.unsaved?'<div class="note warn banner" role="alert">'+TP.icon('alert')+'<span class="grow">未能标为已读，这条消息仍为未读。</span><button type="button" class="btn sm"'+go(opts.retryGo)+'>重试</button></div>':'')+
      '<div class="card msg-detail"><div class="card-b"><p class="msg-body">'+IB.body(m)+'</p></div>'+related(m)+'</div></div>';
  }

  /* 逐条详情画面：每条消息一屏，打开即对本人已读（data-unread 为打开后的未读数）。 */
  function sections(o){
    var base = IB.unread(o.role), copy = {}, html = '';
    IB.DATA[o.role].forEach(function(m, i){
      var st = stateOf(m), no = o.no + String(i+1).padStart(2,'0'), ref = m.ref ? ' · '+m.ref[0][1] : '';
      var name = m.t[0]+ref+' · '+STATE[st];
      copy[name] = m.t[1]+ref+' · '+STATE_EN[st];
      var id = o.prefix + m.id;
      html += '<section data-screen id="'+id+'" data-no="'+no+'" data-group="'+o.group+'" data-name="'+esc(name)+'" data-layout="app" data-who="'+o.who+'" data-nav=""'+
        ' data-crumb="消息通知/消息详情" data-crumb-targets="'+o.list+'/"'+(o.next && o.next[m.id]?' data-next="'+o.next[m.id]+'"':'')+
        ' data-unread="'+(base-(m.read?0:1))+'">'+detail(m)+'</section>';
    });
    TP.addCopy(copy);
    return html;
  }

  TP.inboxPages = {
    detail: detail, find: IB.find,
    /* details: [{role, who, prefix, no, group, list, next}]；先生成逐条详情，再填充各屏列表 */
    build: function(details){
      var host = document.getElementById('inboxScreens');
      (details||[]).forEach(function(o){ host.insertAdjacentHTML('beforeend', sections(o)); });
      document.querySelectorAll('[data-inbox-detail]').forEach(function(el){
        var m = IB.find(el.dataset.role, el.dataset.inboxDetail);
        el.innerHTML = detail(m, {unsaved: el.hasAttribute('data-unsaved'), retryGo: el.dataset.retryGo});
      });
      document.querySelectorAll('[data-inbox-view]').forEach(view);
    }
  };

  /* 分类下拉改选即切到该筛选的画面；未单独出屏的组合给范围提示。 */
  document.addEventListener('change', function(e){
    if(!e.target.matches('[data-inbox-cat]')) return;
    var opt = e.target.selectedOptions[0];
    if(opt && opt.dataset.go) TP.show(opt.dataset.go); else { TP.toast(UNDRAWN); }
  });

  TP.addCopy({
    '全部':'All','已读状态':'Read status','分类':'Category','分类 · 全部':'Category · All',
    '分类 · 业务办理进度':'Category · Business progress','分类 · 业务提醒':'Category · Business reminders',
    '分类 · 认证与合规':'Category · Verification & compliance','分类 · 账户安全':'Category · Account security',
    '分类 · 审核任务':'Category · Review tasks','分类 · 运营告警':'Category · Operations alerts','分类 · 其他':'Category · Other',
    '全部已读':'Mark all as read','当前筛选下没有未读消息':'No unread messages in the current filter',
    '消息读取失败':'Could not load messages','当前筛选下没有消息':'No messages match the current filter',
    '更换已读状态或分类后再看看。':'Try a different read status or category.','清除筛选':'Clear filters',
    '加载更多':'Load more','没有更多消息了':'No more messages','更多消息加载失败，已加载的消息保留。':'Could not load more messages. Loaded messages are kept.',
    '相关业务':'Related record','相关内容暂不可访问。':'This content is currently unavailable.',
    '未能标为已读，这条消息仍为未读。':'Could not mark as read. This message is still unread.',
    '时区':'Time zone','消息通知':'Notifications','消息详情':'Message details','该入口尚未纳入原型。':'This entry is not yet included in the prototype.'
  });
})(window.TP = window.TP || {});
