/* 滑块（拼图）人机校验：两端唯一实现，模块不再自持第二份。
 * 宿主负责承载弹层、取消出口，以及通过之后要做的事；本组件只负责题目、对齐校验、失败换题与冷却。
 * 视觉取自 _shared/base.css 的 .cf-puzzle；题形、答案与判定仅用于本地演示，不具备真实防自动化能力。 */
(function(CF){
  'use strict';
  const L=CF.L,$=id=>document.getElementById(id);
  const SHAPE='M0 0H14C8 -14 32 -14 26 0H40V14C54 8 54 32 40 26V40H26C32 26 8 26 14 40H0Z';
  const BASE={store:'',hintAfter:0,coolAfter:5,coolMs:60000,help:null,guard:null};
  let C={...BASE};
  let P=null,version=0,serial=0,dragging=false,passed=null,errors=0,until=0,failLoad=false,helpOpen=false,timer=0;

  /* 冷却与连续失败次数按绝对时间保存：刷新、换入口或另开标签页都不能绕过。 */
  function readGate(){if(!C.store)return;try{const g=JSON.parse(localStorage.getItem(C.store))||{};errors=g.errors||0;until=g.until||0;}catch(e){}}
  function writeGate(){if(!C.store)return;try{localStorage.setItem(C.store,JSON.stringify({errors,until}));}catch(e){}}
  function wait(){return until?Math.max(0,Math.ceil((until-Date.now())/1000)):0;}
  function alive(n){return n===version&&!!P&&(!C.guard||C.guard());}

  function clock(on){
    if(!on){if(timer)clearInterval(timer);timer=0;return;}
    if(timer)return;
    timer=setInterval(()=>{
      if(!P){clock(false);return;}
      if(until&&until<=Date.now()){until=0;errors=0;writeGate();if(P.status==='cooldown')load(false);CF.render();return;}
      const el=$('cf-puzzle-status');if(el&&wait())el.textContent=copy();
    },1000);
  }

  function load(failed){
    const n=++version;readGate();
    if(wait()){P={status:'cooldown',failed:false,target:170,y:62,variant:0,pos:0};clock(true);return;}
    if(until){until=0;errors=0;writeGate();}
    const x=++serial;
    P={status:'loading',failed:!!failed,target:110+(x*37%113),y:50+(x*13%38),variant:x%4,pos:0};
    clock(true);
    setTimeout(()=>{
      if(!alive(n))return;
      P.status=failLoad?'load-error':'ready';failLoad=false;
      CF.render();queueMicrotask(()=>$('cf-puzzle')?.focus({preventScroll:true}));
    },300);
  }

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
      `<path fill="none" stroke="var(--on-accent)" stroke-width="3" d="M0 ${115+P.variant*6}Q90 60 179 118T320 103"/>`+
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
      if(!alive(n))return;
      if(Math.abs(position-P.target)>3){
        errors++;if(errors>=C.coolAfter)until=Date.now()+C.coolMs;
        writeGate();P.status='failed';P.pos=0;CF.render();
        setTimeout(()=>{if(alive(n)){load(true);CF.render();}},650);return;
      }
      errors=0;until=0;writeGate();
      P.status='passed';CF.render();
      const done=passed;
      setTimeout(()=>{
        if(!alive(n))return;
        P=null;version++;passed=null;clock(false);
        if(done)done();
      },700);
    },450);
  }

  CF.puzzle={
    /* 宿主按自己的业务参数接入：store 为冷却存储键（省略即仅存内存），hintAfter 为提示可换题的连续失败次数，
       coolAfter / coolMs 为进入冷却的次数与时长，help 为求助文案，guard 判断宿主承载是否仍在。 */
    configure(opts){C={...BASE,...(opts||{})};readGate();},
    /* 每次发起都要求一次新的验证，上一次通过不能复用。 */
    start(onPass){version++;passed=onPass;helpOpen=false;readGate();load(false);},
    stop(){version++;P=null;passed=null;helpOpen=false;clock(false);},
    active(){return !!P;},
    status(){return P?(wait()?'cooldown':P.status):'';},
    wait,
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
        (C.hintAfter&&errors>=C.hintAfter&&!cool?`<p class="hint">${L('Having trouble? Select refresh for a new puzzle.','遇到困难？点击刷新换一张。')}</p>`:'')+
        `<p class="hint" id="cf-puzzle-keys">${L('Keyboard: arrow keys to move, Enter to check.','键盘操作：方向键移动，Enter 校验。')}</p>`+
        (C.help?`<button type="button" class="btn-link" data-act="cf-puzzle-help" aria-expanded="${helpOpen}">${L('Need help?','需要帮助？')}</button>`+
          (helpOpen?`<p class="hint" role="status">${CF.esc(L(C.help[0],C.help[1]))}</p>`:''):'')+
        `</div>`;
    },
    /* 演示工具：模拟一次拼图加载失败，以及清空本演示环境的失败次数与冷却。 */
    failNextLoad(){failLoad=true;},
    reset(){errors=0;until=0;failLoad=false;writeGate();}
  };

  /* 换题与求助由组件自理，宿主不必接线，两端行为一致。 */
  document.addEventListener('click',e=>{
    const action=e.target.closest('[data-act^="cf-puzzle"]')?.dataset.act;
    if(!action||!P)return;
    if(action==='cf-puzzle-refresh'&&!wait()&&!['checking','passed','loading'].includes(P.status)){load(false);CF.render();}
    if(action==='cf-puzzle-help'&&C.help){helpOpen=!helpOpen;CF.render();}
  });
  document.addEventListener('input',e=>{
    if(e.target.id!=='cf-puzzle'||!P)return;
    P.pos=Number(e.target.value)||0;P.failed=false;
    $('cf-puzzle-piece')?.setAttribute('transform','translate('+(P.pos+8)+' '+P.y+')');
  });
  document.addEventListener('pointerdown',e=>{dragging=e.target.id==='cf-puzzle';});
  document.addEventListener('pointerup',()=>{if(!dragging)return;dragging=false;if($('cf-puzzle'))verify();});
  document.addEventListener('pointercancel',()=>{if(!dragging)return;dragging=false;if(P){P.pos=0;CF.render();}});
  document.addEventListener('keydown',e=>{if(e.target.id==='cf-puzzle'&&e.key==='Enter'){e.preventDefault();verify();}});
  /* 同一浏览器的其他标签页进入冷却时，本页立即跟随，不能靠另开一页继续校验。 */
  window.addEventListener('storage',e=>{
    if(!C.store||e.key!==C.store)return;
    readGate();
    if(P&&wait()&&P.status!=='cooldown'){version++;P={status:'cooldown',failed:false,target:170,y:62,variant:0,pos:0};CF.render();}
  });
})(window.CF=window.CF||{});
