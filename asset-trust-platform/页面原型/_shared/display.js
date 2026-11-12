/* 资产可信平台原型展示层：中英文文案与 IANA 时区格式化（基线：代币发行平台 display.js，组件规范 v1.96）。
   不实现钱包、鉴权、校验、账户持久化或请求模拟；浏览器只记住访客的界面语言，账户偏好需接口接入。
   这里只放壳层与评审工具的通用文案，模块文案由模块用 TP.addCopy 追加。 */
(function(TP){
  'use strict';
  var EN = {
    '资产可信平台':'Asset Trust Platform','企业端':'Enterprise portal','主导航':'Main navigation','当前位置':'Current location',
    '业务':'Business','账户':'Account','应收账款':'Receivables','确权申请':'Confirmation requests','账户信息':'Account information',
    '界面语言':'Interface language','语言':'Language','退出登录':'Sign out','已退出登录':'Signed out','关闭':'Close','取消':'Cancel',
    '复制失败，请重试。':'Could not copy. Please try again.','已复制':'Copied','该入口尚未纳入原型。':'This destination is not included in the prototype.',
    '此入口在单模块附件中不展开，请在完整原型的 index.html 中打开。':'This entry is not included in the single-module file. Open it from index.html in the full prototype.',
    '演示仅提供部分应收账款的详情画面。':'This demo includes detail screens for selected receivables only.',
    '演示仅提供部分应收账款的追溯画面。':'This demo includes tracing screens for selected receivables only.',
    '演示仅提供部分车辆的详情画面。':'This demo includes details for some vehicles only.',
    '演示仅提供部分预警的详情画面。':'This demo includes details for some alerts only.',
    '演示仅提供部分申请的详情画面。':'This demo includes details for some requests only.',
    '端与身份':'Portal and identity','运营端':'Operations','未登录':'Signed out','入驻准备中':'Onboarding',
    '债权人':'Creditor','债务人':'Debtor','债权人与债务人':'Creditor and debtor','暂无业务角色':'No business role','运营管理员':'Operations administrator',
    '本模块画面':'Screens in this module',
    '画面目录 · 演示数据':'Screen catalog · Sample data','画面目录':'Screen catalog','评审工具 · 演示数据':'Review tool · Sample data',
    '画面目录（评审工具）':'Screen catalog (review tool)','主流程下一屏：':'Next screen: ',
    '显示密码':'Show password','隐藏密码':'Hide password','预览偏好已更新。':'Preview preference updated.',
    '分页':'Pages','共':'Total','条':'records','上一页':'Previous page','下一页':'Next page','第 1 页':'Page 1','演示数据只提供第 1 页。':'This demo includes page 1 only.'
  };
  /* 模块追加本模块文案的英文；页面标题取 TP.pageTitle（中文原文），英文同样查本表。 */
  TP.addCopy=function(map){Object.keys(map).forEach(function(k){EN[k]=map[k];});};
  var originalText=new WeakMap(), originalAttrs=new WeakMap();
  TP.language='en'; TP.zone='UTC';
  function translated(value){
    var key=value.trim(), result=EN[key];
    var pending=key.match(/^(\d+) 项待办$/);
    if(result===undefined && pending)result=pending[1]+(pending[1]==='1'?' pending task':' pending tasks');
    if(result===undefined && key.indexOf('主流程下一屏：')===0){var next=key.slice('主流程下一屏：'.length);result='Next screen: '+(EN[next]||next);}
    if(result===undefined && (key.indexOf('账户：')===0 || key.indexOf('账号：')===0)) result='Account: '+key.slice(3);
    return result===undefined ? value : value.replace(key,result);
  }
  TP.localize=function(root){
    root=root||document.body;
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT), node;
    while((node=walker.nextNode())){
      if(node.parentElement.closest('script,style,textarea,[data-instant],[data-zone],[data-upstream]'))continue;
      if(!originalText.has(node))originalText.set(node,node.nodeValue);
      // data-en 给同字异义的元素（如“启用”操作与“启用”状态）指定本元素英文。
      var text=originalText.get(node), own=node.parentElement.getAttribute('data-en');
      node.nodeValue=TP.language!=='en'?text:(own!==null&&text.trim()?text.replace(text.trim(),own):translated(text));
    }
    [root].concat(Array.from(root.querySelectorAll('*'))).forEach(function(el){
      if(!el.getAttribute || el.closest("[data-upstream]"))return;
      var attrs=originalAttrs.get(el)||{};
      ['aria-label','placeholder','title'].forEach(function(attr){
        if(el.hasAttribute(attr)){
          if(attrs[attr]===undefined)attrs[attr]=el.getAttribute(attr);
          el.setAttribute(attr,TP.language==='en'?translated(attrs[attr]):attrs[attr]);
        }
      });originalAttrs.set(el,attrs);
    });
    document.documentElement.lang=TP.language==='en'?'en':'zh-CN';
    var title=TP.pageTitle||'资产可信平台';
    document.title=TP.language==='en'?(EN[title]||title):title;
  };
  TP.renderDisplay=function(){
    document.querySelectorAll('[data-language]').forEach(function(el){el.value=TP.language;});
    document.querySelectorAll('[data-timezone]').forEach(function(el){
      if(!Array.from(el.options).some(function(o){return o.value===TP.zone;}))el.add(new Option(TP.zone,TP.zone));
      el.value=TP.zone;
    });
    document.querySelectorAll('[data-zone]').forEach(function(el){el.textContent=TP.zone;});
    var fmt=new Intl.DateTimeFormat('en-CA',{timeZone:TP.zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
    document.querySelectorAll('[data-instant]').forEach(function(el){
      var parts={};fmt.formatToParts(new Date(el.dataset.instant)).forEach(function(p){parts[p.type]=p.value;});
      var day=parts.year+'-'+parts.month+'-'+parts.day, clock=parts.hour+':'+parts.minute;
      // data-day 只展示换算后的日期；data-compact 日期 + 副文本时间（加 data-seconds 时副文本到秒）；data-minute 日期 + 时分；默认完整日期时间。
      el.replaceChildren(document.createTextNode(day+(el.hasAttribute('data-compact')||el.hasAttribute('data-day')?'':el.hasAttribute('data-minute')?' '+clock:' '+clock+':'+parts.second)));
      if(el.hasAttribute('data-compact')){var sub=document.createElement('span');sub.className='cell-sub';sub.textContent=clock+(el.hasAttribute('data-seconds')?':'+parts.second:'');el.appendChild(sub);}
    });
    TP.localize();
    if(TP.refreshPasswordToggles)TP.refreshPasswordToggles();
  };
  TP.setLanguage=function(value){
    if(value!=='en'&&value!=='zh')return;
    TP.language=value;
    try{localStorage.setItem('atp-visitor-language',value);}catch(e){/* Preview can still switch when storage is unavailable. */}
    TP.renderDisplay();
  };
  TP.initDisplay=function(){
    try{var saved=localStorage.getItem('atp-visitor-language');if(saved==='en'||saved==='zh')TP.language=saved;}catch(e){}
    try{TP.zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';}catch(e){TP.zone='UTC';}
  };
  document.addEventListener('change',function(e){
    if(e.target.matches('[data-language]')){
      if(e.target.value===TP.language)return;
      TP.setLanguage(e.target.value);TP.refreshLanguageTools();TP.renderDisplay();
    }else if(e.target.matches('[data-timezone]')){
      if(e.target.value===TP.zone)return;
      try{new Intl.DateTimeFormat('en',{timeZone:e.target.value});}catch(err){e.target.value=TP.zone;return;}
      TP.zone=e.target.value;TP.renderDisplay();
    }else return;
    var row=e.target.closest('.preferences'), feedback=row&&row.querySelector('.preference-feedback');
    if(feedback){feedback.textContent='预览偏好已更新。';TP.localize(feedback);}
  });
})(window.TP=window.TP||{});
