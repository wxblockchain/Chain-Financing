/* WS-403: common visual primitives. Domain decisions stay in the modules. */
(function (CF) {
  'use strict';
  const E = CF.esc, L = CF.L;
  // Approved WS-403 defaults. Explicit export overrides remain available.
  const documentRoot = document.documentElement;
  if (!documentRoot.hasAttribute('data-market-tone')) documentRoot.dataset.marketTone = 'blue';
  if (!documentRoot.hasAttribute('data-market-type')) documentRoot.dataset.marketType = 'refined';
  const shapes = {
    USD: '<path d="M15 7.5c-1-1-2.1-1.5-3.8-1.5-2 0-3.5 1.1-3.5 2.8 0 4 8 1.8 8 6 0 1.8-1.7 3.2-4 3.2-1.8 0-3.3-.6-4.7-2M12 4v16"/>',
    EUR: '<path d="M17 6.3a6.6 6.6 0 1 0 0 11.4M5 10h10M5 14h9"/>',
    JPY: '<path d="m6 5 6 7 6-7M12 12v8M7 12h10M7 16h10"/>',
    CNY: '<path d="m6 5 6 7 6-7M12 12v8M7 12h10M7 16h10"/>',
    GBP: '<path d="M17 7a4 4 0 0 0-8 0v7c0 2-1 3-3 4h12M6 12h9"/>',
    USDT: '<path d="M5 5h14v3h-5v11h-4V8H5Z" fill="currentColor" stroke="none"/><ellipse cx="12" cy="10.5" rx="8" ry="2"/>',
    USDC: '<path d="M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13M14.8 8c-.9-.8-1.8-1-2.9-1-1.7 0-3 1-3 2.5 0 3.3 6.2 1.5 6.2 5 0 1.5-1.3 2.5-3.1 2.5-1.2 0-2.4-.4-3.2-1.3M12 5v2M12 17v2"/>',
    ETH: '<path d="m12 2-6 10 6 3.6 6-3.6L12 2Zm0 15.1L6 13.6l6 8.4 6-8.4-6 3.5Z" fill="currentColor" stroke="none"/>',
    TRON: '<path d="m4 3 16 4-10 14L4 3Zm0 0 10 8 6-4M10 21l4-10L4 3"/>'
  };
  function currency(code) {
    code = String(code).toUpperCase();
    if (!shapes[code]) return E(code);
    return '<span class="mk-currency" data-currency="'+E(code)+'"><span class="mk-coin" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+shapes[code]+'</svg></span><span>'+E(code)+'</span></span>';
  }
  const oldChip = CF.icoChip;
  CF.icoChip = function (label, opts) {
    return shapes[label] ? currency(label) : oldChip(label, opts);
  };
  function icon(name) {
    const paths = {
      grid:'<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/>',
      list:'<path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"/>',
      arrow:'<path d="M5 19 19 5M5 5h14v14"/>',
      asset:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
      chart:'<path d="M4 4v16h16M8 15l4-6 4 3 4-7"/>',
      clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      chain:'<path d="m10 13 4-4M8 15l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 9l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
      shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6"/>'
    };
    return '<svg class="mk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.asset)+'</svg>';
  }
  function views(view, action) {
    return '<div class="mk-views" role="group" aria-label="'+L('Result layout','结果布局')+'">'+[['cards','grid','Cards','卡片'],['table','list','Table','表格']].map(x=>'<button type="button" data-act="'+action+'" data-v="'+x[0]+'" aria-pressed="'+(view===x[0])+'" title="'+L(x[2],x[3])+'" aria-label="'+L(x[2],x[3])+'">'+icon(x[1])+'</button>').join('')+'</div>';
  }
  function distribution(title, parts, action, selected, suffix) {
    const total = parts.reduce((n,p)=>n+p.value,0);
    const summary = parts.map(p=>p.label+': '+CF.fmtAmt(p.value)+' '+(suffix||'')).join('; ');
    return '<section class="mk-distribution"><div class="mk-chart-head"><h2>'+icon('chart')+E(title)+'</h2><span>'+L('Current results','当前结果')+'</span></div><div class="mk-stackbar" role="img" aria-label="'+E(title+'. '+summary)+'">'+parts.map(p=>'<span data-tone="'+p.tone+'" style="flex-grow:'+Math.max(0,p.value)+'" title="'+E(p.label)+': '+(total?(p.value/total*100).toFixed(1):'0.0')+'%"></span>').join('')+'</div><div class="mk-legend">'+parts.map(p=>'<button type="button" data-act="'+action+'" data-v="'+p.key+'" aria-pressed="'+(selected===p.key)+'" aria-label="'+E(L('Filter: ','筛选：')+p.label)+'"><i data-tone="'+p.tone+'" aria-hidden="true"></i><span>'+E(p.label)+'</span><b class="mono">'+(total?(p.value/total*100).toFixed(1):'0.0')+'%</b></button>').join('')+'</div></section>';
  }
  CF.market = {currency, icon, views, distribution};

  // Currency decoration is restricted to the rebuilt pages and their dialogs.
  // It only adds presentation to text, never changes input values or formatting.
  let queued=false;
  const pattern=/\b(USD|EUR|JPY|CNY|GBP|USDT|USDC|ETH|TRON)\b/g;
  function decorate() {
    queued=false;
    const active=/^#\/(assets|marketplace|project)(?:\/|\?|$)/.test(location.hash);
    document.documentElement.toggleAttribute('data-market-redesign',active);
    if (!active) return;
    observer.disconnect();
    ['content','layers'].forEach(id=>{
      const root=document.getElementById(id);
      if(!root)return;
      root.querySelectorAll('select').forEach(select=>{
        const code=select.value;
        if(!shapes[code]&&!select.closest('.mk-select-wrap'))return;
        let wrap=select.closest('.mk-select-wrap');
        if(!wrap){wrap=document.createElement('span');wrap.className='mk-select-wrap';select.replaceWith(wrap);wrap.append(select);}
        const prior=wrap.querySelector('.mk-select-mark');if(prior)prior.remove();
        if(shapes[code]){
          const mark=document.createElement('span');mark.className='mk-select-mark';mark.setAttribute('aria-hidden','true');
          mark.innerHTML=currency(code);mark.querySelector('.mk-currency>span:last-child').remove();wrap.prepend(mark);
        }
        wrap.classList.toggle('has-currency',!!shapes[code]);
      });
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      const nodes=[];
      while(walker.nextNode()) {
        const n=walker.currentNode, parent=n.parentElement;
        if(!parent||parent.closest('.mk-currency,.ico-chip,svg,script,style,textarea,select,option,.hash,.sr-only,[contenteditable],.mk-coin'))continue;
        pattern.lastIndex=0;
        if(pattern.test(n.nodeValue))nodes.push(n);
      }
      nodes.forEach(n=>{
        const text=n.nodeValue,fragment=document.createDocumentFragment();let start=0;
        pattern.lastIndex=0;
        for(const m of text.matchAll(pattern)){
          fragment.append(document.createTextNode(text.slice(start,m.index)));
          const holder=document.createElement('template');holder.innerHTML=currency(m[0]);
          fragment.append(holder.content);start=m.index+m[0].length;
        }
        fragment.append(document.createTextNode(text.slice(start)));n.replaceWith(fragment);
      });
    });
    observe();
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(decorate);}}
  const observer=new MutationObserver(schedule);
  function observe(){['content','layers'].forEach(id=>{const node=document.getElementById(id);if(node)observer.observe(node,{childList:true,subtree:true});});}
  observe();schedule();window.addEventListener('hashchange',schedule);
  document.addEventListener('change',e=>{if(e.target.matches('select'))schedule();});
})(window.CF);
