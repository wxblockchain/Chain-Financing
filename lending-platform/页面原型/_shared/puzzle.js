/* Opt-in slider verification. The host owns the layer and the action that follows a pass.
 * 视觉口径取自 管理端/账户与登录 已交付的拼图验证；运营端沿用自有副本，待 WS-380 收敛到本组件。 */
(function(CF){
  'use strict';
  const L=CF.L,$=id=>document.getElementById(id);
  const SHAPE='M0 0H14C8 -14 32 -14 26 0H40V14C54 8 54 32 40 26V40H26C32 26 8 26 14 40H0Z';
  let P=null,version=0,serial=0,dragging=false,passed=null,errors=0,until=0,failLoad=false;

  function load(failed){
    const n=++version,x=++serial;
    P={status:'loading',failed:!!failed,target:110+(x*37%113),y:50+(x*13%38),variant:x%4,pos:0};
    setTimeout(()=>{
      if(n!==version||!P)return;
      P.status=failLoad?'load-error':'ready';failLoad=false;
      CF.render();queueMicrotask(()=>$('cf-puzzle')?.focus({preventScroll:true}));
    },300);
  }
  function wait(){return until?Math.max(0,Math.ceil((until-Date.now())/1000)):0;}
  function copy(){
    const left=wait();
    if(left)return L('Try again in '+left+'s',left+' 秒后重试');
    return ({loading:L('Loading the puzzle…','正在加载拼图…'),checking:L('Verifying…','正在验证…'),passed:L('Verified','验证通过'),
      failed:L('Verification failed. Please try again.','验证失败，请重试。'),
      'load-error':L('The puzzle could not load. Select refresh to try again.','拼图加载失败，请点击刷新重试。')}[P.status])
      ||L('Drag the piece into the gap, then release','拖动拼图对齐缺口，松手完成验证');
  }
  function scene(){
    return `<svg class="cf-puzzle-scene" viewBox="0 0 320 156" role="img" aria-label="${L('Move the puzzle piece into the matching gap.','将拼图移至对应缺口。')}">`+
      `<defs><path id="cf-puzzle-shape" d="${SHAPE}"/><clipPath id="cf-puzzle-clip"><use href="#cf-puzzle-shape"/></clipPath>`+
      `<g id="cf-puzzle-scene"><path fill="var(--card-2)" d="M0 0H320V156H0Z"/><circle cx="${62+P.variant*34}" cy="35" r="21" fill="var(--accent-border)"/>`+
      `<path fill="var(--border-strong)" d="M0 133L${70+P.variant*17} 28L188 139L252 55L320 108V156H0Z"/>`+
      `<path fill="var(--accent)" opacity=".7" d="M0 153L117 57L213 141L282 84L320 111V156H0Z"/>`+
      `<path fill="var(--accent-strong)" d="M0 145Q105 111 209 148T320 125V156H0Z"/></g></defs>`+
      `<use href="#cf-puzzle-scene"/><use href="#cf-puzzle-shape" transform="translate(${P.target+8} ${P.y})" fill="var(--overlay)" stroke="var(--on-accent)" stroke-width="2"/>`+
      `<g id="cf-puzzle-piece" transform="translate(${P.pos+8} ${P.y})"><g clip-path="url(#cf-puzzle-clip)">`+
      `<use href="#cf-puzzle-scene" transform="translate(${-P.target-8} ${-P.y})"/></g>`+
      `<use href="#cf-puzzle-shape" fill="none" stroke="var(--accent-strong)" stroke-width="2"/></g></svg>`;
  }
  function verify(){
    if(!P||P.status!=='ready'||wait())return;
    const n=version,position=P.pos;
    P.status='checking';CF.render();
    setTimeout(()=>{
      if(n!==version||!P)return;
      if(Math.abs(position-P.target)>3){
        errors++;until=errors>=5?Date.now()+60000:0;P.status='failed';P.pos=0;CF.render();
        setTimeout(()=>{if(n===version&&P)load(true);},650);return;
      }
      errors=0;until=0;P.status='passed';CF.render();
      const done=passed;
      setTimeout(()=>{if(n===version&&P){P=null;version++;passed=null;if(done)done();}},700);
    },400);
  }

  CF.puzzle={
    /* 每次发起都要求一次新的验证，上一次通过不能复用。 */
    start(onPass){version++;passed=onPass;load(false);},
    stop(){version++;P=null;passed=null;},
    active(){return !!P;},
    body(){
      if(!P)return '';
      const cool=wait(),blocked=cool||P.status!=='ready';
      return `<div class="cf-puzzle" data-status="${cool?'cooldown':P.status}">`+
        `<div class="cf-puzzle-head"><label for="cf-puzzle">${L('Align the piece with the gap','请将拼图对齐缺口')}</label>`+
        `<button type="button" class="btn ghost sm" data-act="cf-puzzle-refresh" aria-label="${L('New puzzle','换一张拼图')}" ${cool||['checking','passed','loading'].includes(P.status)?'disabled':''}>↻</button></div>`+
        (['loading','load-error'].includes(P.status)
          ? `<div class="cf-puzzle-placeholder">${P.status==='loading'?`<span class="spinner" aria-hidden="true"></span>`:`<button type="button" class="btn" data-act="cf-puzzle-refresh">${L('Failed to load. Select to retry.','加载失败，点击重试。')}</button>`}</div>`
          : scene())+
        `<div class="cf-puzzle-track"><input id="cf-puzzle" class="cf-puzzle-slider" type="range" min="0" max="260" step="1" value="${P.pos}" `+
        `aria-label="${L('Puzzle position','拼图位置')}" aria-describedby="cf-puzzle-status cf-puzzle-keys" ${blocked?'disabled':''}></div>`+
        `<p id="cf-puzzle-status" class="cf-puzzle-status" role="status" aria-live="polite">${copy()}</p>`+
        `<p class="login-caption" id="cf-puzzle-keys">${L('Keyboard: arrow keys to move, Enter to check.','键盘操作：方向键移动，Enter 校验。')}</p></div>`;
    },
    act(action){
      if(action!=='cf-puzzle-refresh')return false;
      if(P&&!wait()&&!['checking','passed','loading'].includes(P.status))load(false);
      return true;
    },
    /* 演示工具：模拟一次拼图加载失败。 */
    failNextLoad(){failLoad=true;}
  };

  document.addEventListener('input',e=>{
    if(e.target.id!=='cf-puzzle'||!P)return;
    P.pos=Number(e.target.value)||0;P.failed=false;
    $('cf-puzzle-piece')?.setAttribute('transform','translate('+(P.pos+8)+' '+P.y+')');
  });
  document.addEventListener('pointerdown',e=>{dragging=e.target.id==='cf-puzzle';});
  document.addEventListener('pointerup',()=>{if(!dragging)return;dragging=false;if($('cf-puzzle'))verify();});
  document.addEventListener('pointercancel',()=>{if(!dragging)return;dragging=false;if(P){P.pos=0;CF.render();}});
  document.addEventListener('keydown',e=>{if(e.target.id==='cf-puzzle'&&e.key==='Enter'){e.preventDefault();verify();}});
})(window.CF=window.CF||{});
