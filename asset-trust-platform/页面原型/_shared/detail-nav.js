/* ==========================================================================
   detail-nav.js — 详情页无框分区导航（代币发行平台组件规范 v1.96 §4.16「无框分区导航」）
   基线：代币发行平台 asset-detail.js 中的分区导航部分，去掉业务演示数据后的通用实现。
   用法：详情画面加 data-detail-layout；摘要卡加 data-detail-summary（不进入导航）；
   其余 .card（含 .detail-group 内的卡片）各成一个分区，导航文字取 data-nav-label 或卡片标题。
   在 TP.boot 之前调用 TP.initDetailNav()。只做定位与高亮，不改变画面路由或业务数据。
   ========================================================================== */
(function(TP){
  'use strict';
  function initDetailNavigation(){
    document.querySelectorAll('[data-screen]').forEach(function(screen){
      if(!screen.hasAttribute('data-detail-layout'))return;
      var content=screen.querySelector('.content-in');
      if(content.querySelector('[data-detail-nav]'))return;
      var overview=content.querySelector(':scope > .card[data-detail-summary]');
      var sections=Array.from(content.querySelectorAll(':scope > .card, :scope > .detail-group > .card')).filter(function(section){return section!==overview;});
      var nav=document.createElement('nav'), lastGroup=null;
      nav.className='detail-nav';nav.dataset.detailNav='';nav.setAttribute('aria-label','详情信息导航');
      sections.forEach(function(section,index){
        var heading=section.querySelector('.card-head :is(h2,h3)');
        var label=section.dataset.navLabel || (heading ? heading.textContent : '');
        // Extra space separates related records, core and supplementary groups.
        var group=section.closest('.detail-group');
        if(index>0 && group!==lastGroup){var sep=document.createElement('span');sep.className='detail-nav-sep';sep.setAttribute('aria-hidden','true');nav.appendChild(sep);}
        lastGroup=group;
        section.id=screen.id+'-section-'+index;
        section.dataset.detailSection='';section.tabIndex=-1;
        if(heading){heading.id=section.id+'-heading';section.setAttribute('aria-labelledby',heading.id);}
        else section.setAttribute('aria-label',label);
        var link=document.createElement('a');link.href='#'+section.id;link.textContent=label;
        link.dataset.detailTarget=section.id;
        if(index===0)link.setAttribute('aria-current','location');
        nav.appendChild(link);
      });
      // 分区导航放在摘要及页面级提示之后、第一个分区之前。
      if(sections[0])(sections[0].closest('.detail-group')||sections[0]).before(nav);
      else if(overview)overview.after(nav);
    });
  }

  // Navigation only: keep the screen route and business data unchanged.
  var selectedTarget=null, selectedY=null;
  TP.refreshDetailNav=function(){
    var nav=document.querySelector('[data-screen]:not([hidden]) [data-detail-nav]');
    if(!nav)return;
    var links=Array.from(nav.querySelectorAll('a')), active=links[0];
    var edge=nav.getBoundingClientRect().bottom+24;
    links.forEach(function(link){
      if(document.getElementById(link.dataset.detailTarget).getBoundingClientRect().top<=edge)active=link;
    });
    if(window.scrollY>0 && window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-2)active=links[links.length-1];
    // Several sections can fit at the page bottom. Keep the clicked section
    // selected until the user scrolls away, without adding blank space.
    if(selectedTarget && Math.abs(window.scrollY-selectedY)<2 && links.indexOf(selectedTarget)!==-1)active=selectedTarget;
    else selectedTarget=null;
    links.forEach(function(link){
      if(link===active)link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    });
  };
  document.addEventListener('click',function(event){
    var link=event.target.closest('[data-detail-target]');if(!link)return;
    event.preventDefault();
    var target=document.getElementById(link.dataset.detailTarget);
    // A file-batch destination exposes the existing files and receives keyboard focus.
    var batch=target.matches('.material-batch') ? target : null;
    if(batch)batch.open=true;
    // Keep the parent heading visible when entering the first card in a group.
    var group=target.closest('.detail-group');
    var position=group && group.querySelector('.card')===target ? group : target;
    position.scrollIntoView({block:'start',behavior:'instant'});
    (batch ? batch.querySelector('summary') : target).focus({preventScroll:true});
    selectedTarget=link;selectedY=window.scrollY;
    TP.refreshDetailNav();
  });
  var scrollPending=false;
  window.addEventListener('scroll',function(){
    if(scrollPending)return;scrollPending=true;
    requestAnimationFrame(function(){scrollPending=false;TP.refreshDetailNav();});
  },{passive:true});
  window.addEventListener('resize',TP.refreshDetailNav);

  TP.initDetailNav=initDetailNavigation;
  TP.addCopy({'详情信息导航':'Detail sections'});
})(window.TP=window.TP||{});
