/* Display only. Full names use the existing shared popover, localization and Escape handling. */
(function(TP){
  'use strict';
  TP.initReceivablePresentation=function(){
    document.querySelectorAll('.rcv-overview-list .party-line>[data-upstream]').forEach(function(value){
      var full=value.textContent,cut=Math.max(1,full.length-8),pop=document.createElement('span');
      pop.className='value-pop dd party-name';
      var button=document.createElement('button');
      button.type='button';button.className='dd-btn name-clip';button.title=full;
      button.setAttribute('aria-expanded','false');button.setAttribute('aria-label',full);
      var prefix=value.cloneNode(false),suffix=value.cloneNode(false);
      prefix.className='name-prefix';prefix.textContent=full.slice(0,cut);
      suffix.className='name-suffix';suffix.textContent=full.slice(cut);
      button.append(prefix,suffix);
      var list=document.createElement('span');list.className='dd-list';list.hidden=true;
      value.replaceWith(pop);list.append(value);pop.append(button,list);
    });
  };
})(window.TP=window.TP||{});
