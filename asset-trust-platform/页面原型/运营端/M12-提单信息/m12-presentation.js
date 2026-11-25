/* Presentation only. Full source values use the shared name/popover components. */
(function(TP){
  'use strict';
  TP.initBillPresentation=function(){
    document.querySelectorAll('.bl-list [data-upstream]').forEach(function(value){
      // Port pairs share one narrow cell; retain a short suffix so CJK text
      // cannot push over the route arrow. The popover always keeps the full value.
      var full=value.textContent,tail=value.closest('.route')?2:6,cut=Math.max(0,full.length-tail);
      var pop=document.createElement('span');pop.className='dd value-pop m12-name';
      var button=document.createElement('button');button.type='button';button.className='dd-btn name-clip';
      button.title=full;button.setAttribute('aria-label',full);button.setAttribute('aria-expanded','false');
      var prefix=value.cloneNode(false),suffix=value.cloneNode(false);
      prefix.className='name-prefix';prefix.textContent=full.slice(0,cut);
      suffix.className='name-suffix';suffix.textContent=full.slice(cut);
      button.append(prefix,suffix);
      var list=document.createElement('span');list.className='dd-list';list.hidden=true;
      value.replaceWith(pop);list.append(value);pop.append(button,list);
    });
  };
})(window.TP=window.TP||{});
