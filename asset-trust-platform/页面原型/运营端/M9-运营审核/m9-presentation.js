/* Presentation only: retain shared navigation, popover, localization and copy behavior. */
(function(TP){
  'use strict';
  TP.initReviewPresentation=function(){
    document.querySelectorAll('.review-detail').forEach(function(screen){
      var seen=new Set(),nav=screen.querySelector('[data-detail-nav]');
      if(!nav)return;
      nav.querySelectorAll('.detail-nav-sep').forEach(function(sep){sep.remove();});
      nav.querySelectorAll('a').forEach(function(link){
        var target=document.getElementById(link.dataset.detailTarget),group=target.closest('.detail-group');
        if(!group)return;
        if(seen.has(group)){link.remove();return;}
        seen.add(group);
        link.textContent=group.querySelector('.detail-group-h h2').textContent;
      });
    });
    document.querySelectorAll('.review-list .party-line>[data-upstream]').forEach(function(value){
      var full=value.textContent,cut=Math.max(1,full.length-8),pop=document.createElement('span');
      pop.className='value-pop dd party-name';
      var button=document.createElement('button');
      button.type='button';button.className='dd-btn name-clip';button.title=full;button.setAttribute('aria-expanded','false');
      var prefix=value.cloneNode(false),suffix=value.cloneNode(false);
      prefix.className='name-prefix';prefix.textContent=full.slice(0,cut);
      suffix.className='name-suffix';suffix.textContent=full.slice(cut);
      button.append(prefix,suffix);
      var list=document.createElement('span');list.className='dd-list';list.hidden=true;
      value.replaceWith(pop);list.append(value);pop.append(button,list);
    });
    document.querySelectorAll('.review-detail .addr-pill[title]').forEach(function(value){
      var full=value.title;
      // Partial demo file fingerprints have no complete upstream value. Never fabricate one.
      if(full.includes('…')||full.includes('...'))return;
      var pop=document.createElement('span');pop.className='value-pop dd';
      var button=document.createElement('button');button.type='button';button.className='dd-btn';
      button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','查看完整值');button.title='查看完整值';
      button.innerHTML=TP.icon('eye');
      var list=document.createElement('span');list.className='dd-list';list.hidden=true;
      var text=document.createElement('span');text.className='mono';text.textContent=full;list.append(text);
      pop.append(button,list);value.after(pop);
    });
  };
  TP.addCopy({'查看完整值':'View full value'});
})(window.TP=window.TP||{});
