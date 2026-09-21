/* WS-348 · 页面原型。所有身份与服务端结果均为演示数据，不发网络请求。
   维护源：公共 shell / token + 本模块组合。流程页按登记表约定在模块内追加。
   不实现服务端句柄、授权校验、钱包连接、真实会话、实时复核或审计。 */
(function (CF) {
  'use strict';
  const S = CF.S, L = CF.L, esc = CF.esc;
  const pages = {
    'P-L01':['focus','/login','Choose your role','选择你的身份'],
    'P-L02':['portal','/login/guest','Browse Harbour Credit','浏览借贷平台'],
    'P-L03':['focus','/login/switch','Switching role','切换身份'],
    'P-L04':['focus','/login/unavailable','Unable to continue','暂时无法继续'],
    'P-L10':['focus','/auth/return','Completing sign-in','正在完成登录'],
    'P-L11':['focus','/auth/agreements','Review agreements','确认协议'],
    'P-L12':['portal','/account','Account settings','账户设置'],
    'P-L13':['focus','/auth/retry','Account setup interrupted','账户建立未完成'],
    // 本模块内的演示落点，绝不占用 P-MC-01 或登记成正式业务页。
    'DEMO-L-GATE':['portal','/demo/login/financing','Financing entry · demo','融资入口 · 演示页']
  };
  const dict = {en:{navAssets:'Asset marketplace',navPlaza:'Lending marketplace',navConsole:'My console'},
    zh:{navAssets:'资产广场',navPlaza:'借贷广场',navConsole:'我的控制台'}};
  Object.entries(pages).forEach(([id,p])=>{
    CF.PAGES[id]={end:'asset',layout:p[0],navKey:id,auth:id==='P-L12',parent:p[0]==='portal'?'P-F-AM-01':undefined};
    CF.ENTRY[id]=p[1];dict.en[id]=p[2];dict.zh[id]=p[3];
  });
  const D = {
    level:'L0', restricted:false, agreed:false, accepted:false, submit:'idle', preferences:'idle',
    notification:true, savedNotification:true, preferredLang:'en', savedLang:'en',
    entryError:'', handoff:'', missing:false, rejected:false, downgraded:false,
    extraNotices:false, accountState:'default', ssoResult:'first', returnResult:'fallback',
    verificationResult:'verified', submitResult:'success', source:'B', replay:false,
    origin:'/assets', originAction:'', accountChanged:false, pending:false, gateState:'idle',
    sessionMessage:'', timer:0, timerVersion:0, reviewMessage:'', focusBack:null,
    lastRole:null, memoryDisabled:false, switchScheduled:false
  };
  const $=id=>document.getElementById(id);
  const assetWallet='0x1111111111111111111111111111111111111111';
  CF.portalAccount=()=>({walletAddress:S.role==='fund' ? CF.funder?.review.account.address||'' : S.role==='asset'&&!D.missing ? assetWallet : ''});
  function btn(en,zh,act,value='',kind='') {
    return `<button type="button" class="btn ${kind}" data-act="${act}" data-v="${esc(value)}">${L(en,zh)}</button>`;
  }
  function link(en,zh,act,value='') {return `<button type="button" class="btn-link" data-act="${act}" data-v="${esc(value)}">${L(en,zh)}</button>`;}
  function go(route) {if(route==='/')route='/assets';S.menu=null;S.layer=null;if(location.hash==='#'+route)CF.render();else location.hash='#'+route;}
  function later(fn,ms=950){clearTimeout(D.timer);const version=++D.timerVersion;D.timerRoute=location.hash;D.timer=setTimeout(()=>{if(version===D.timerVersion&&D.timerRoute===location.hash)fn();},ms);}
  function cancelPending(){clearTimeout(D.timer);D.timerVersion++;D.timerRoute=null;D.pending=false;D.switchScheduled=false;if(D.gateState==='pending')D.gateState='idle';if(D.preferences==='pending')D.preferences='idle';}
  function clearMemory(){D.lastRole=null;try{localStorage.removeItem('lp_last_role');localStorage.removeItem('lp_last_role_at');}catch(e){}}
  function readMemory(){
    try{
      const role=localStorage.getItem('lp_last_role'), at=Number(localStorage.getItem('lp_last_role_at'));
      if(!['asset_party','funder'].includes(role)||!at||Date.now()-at>=90*86400000||at>Date.now()){clearMemory();return;}
      D.lastRole=role;
    }catch(e){D.lastRole=null;}
  }
  function remember(role){
    D.lastRole=null;if(D.memoryDisabled)return;
    try{localStorage.setItem('lp_last_role',role);localStorage.setItem('lp_last_role_at',String(Date.now()));D.lastRole=role;}catch(e){}
  }
  function resetSession(){
    cancelPending();S.role='guest';S.layer=null;S.menu=null;D.restricted=false;D.accepted=false;
    D.submit='idle';D.gateState='idle';D.downgraded=false;D.extraNotices=false;D.originAction='';
    D.replay=false;D.sessionMessage='';D.notification=D.savedNotification;D.preferredLang=D.savedLang;
    CF.resetCompletion();
  }
  function endSession(kind){
    const dirty=D.notification!==D.savedNotification||D.preferredLang!==D.savedLang;
    resetSession();D.sessionMessage=kind==='upstream'?L('You signed out on the asset trust platform. Your sign-in here has also ended.','你已在资产可信平台登出，本平台登录同时结束。'):'';
    CF.render();
    const text={logout:L('Signed out.','已退出登录。'),expiry:L('Your sign-in has expired. You can sign in again to continue.','登录已过期，可重新登录继续。'),
      blocked:L('This account is currently unavailable. Contact support on the asset trust platform. Reference: HC-204.','账户暂不可用，请联系资产可信平台客服。参考码：HC-204。')};
    if(text[kind])CF.toast(text[kind]);
    if(kind==='blocked')supportLink();
    if(dirty)CF.toast(L('Your changes were not saved.','内容未保存。'));
  }
  function supportLink(){const toast=$('toasts').lastElementChild;if(toast)toast.insertAdjacentHTML('beforeend',link('Contact support','联系客服','login-support'));}
  function demoStamp(){return `<p class="login-demo-stamp">${L('Demonstration data','演示数据')}</p>`;}
  function choices(){
    const iconA='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 21V3h10l4 4v14H5Z M15 3v5h4 M8 12h8 M8 16h6"/></svg>';
    const iconF='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 8h18 M15 12h6v5h-6z"/></svg>';
    return `<div class="login-choices">
      <section class="login-choice"><span class="login-choice-icon">${iconA}</span><h2>${L('Asset party','资产方')}</h2>
      <p>${L("I hold assets and want to raise financing. You'll sign in on the asset trust platform.",'我持有资产，想发起融资。将前往资产可信平台登录。')}</p>
      ${btn('Authorize with asset trust platform','第三方授权（资产方）','login-choose','asset_party','primary')}</section>
      <section class="login-choice"><span class="login-choice-icon">${iconF}</span><h2>${L('Funder','资金方')}</h2>
      <p>${L('I provide capital and want to invest. Connect your wallet and sign to get started.','我提供资金，想参与出资。连接钱包并签名即可开始。')}</p>
      ${btn('Connect wallet','连接钱包（资金方）','login-choose','funder','primary')}</section></div>`;
  }
  function rolePage(){
    const role=D.lastRole==='asset_party'?L('Asset party','资产方'):L('Funder','资金方');
    return `<div class="login-heading"><h1>${L('Choose your role','选择你的身份')}</h1><p>${L('So we can show you the right features and flows','为你展示对应的功能与流程')}</p></div>
      ${choices()}${D.entryError?`<p class="note red" role="alert">${entryError()}</p>`:''}
      <div class="login-bottom">${D.lastRole?`<div class="login-memory"><span>${L(`Last time you chose "${role}"`,`上次你选择了「${role}」`)}</span>${link('Continue as '+role,'直接继续','login-choose',D.lastRole)}</div>`:''}
      ${link('Keep browsing as a guest','以游客身份继续浏览','login-guest')}</div>`;
  }
  function entryError(){
    return D.entryError==='wallet'?L('No wallet is available. Install or enable a compatible browser wallet, then try again.','未检测到可用钱包。请安装或启用兼容的浏览器钱包后重试。'):
      L('The asset trust platform is unavailable. Try again later or keep browsing.','资产可信平台暂时无法连接，请稍后重试或继续浏览。');
  }
  function choose(role){
    D.entryError='';D.sessionMessage='';remember(role);
    if(role==='asset_party')open('leave','login');
    else if(CF.funder){CF.funder.connect('entry');}
    else {
      S.layer=null;go('/login');D.handoff='wallet';D.reviewMessage=L('Wallet connection requested. Use the controls below to simulate the external result. No wallet is contacted.','已到钱包连接边界。下方可模拟外部结果；不会连接真实钱包。');S.demo=true;
    }
  }
  function open(key,data){
    if(!S.layer){const a=document.activeElement;D.focusBack=a&&a.getAttribute?{act:a.getAttribute('data-act'),value:a.getAttribute('data-v'),id:a.id}:null;}
    const under=key==='leave'&&['role','guide'].includes(S.layer?.key)?S.layer:null;
    const opener=document.activeElement;
    CF.openLayer('modal',key,data,under);
    if(under)S.layer.returnFocus={act:opener?.dataset.act,value:opener?.dataset.v};
  }
  function returnToGuide(){
    if(S.layer?.key!=='leave'||!S.layer.under)return false;
    const focus=S.layer.returnFocus;S.layer=S.layer.under;CF.render();
    queueMicrotask(()=>Array.from(document.querySelectorAll('#layers [data-act]')).find(x=>x.dataset.act===focus?.act&&x.dataset.v===focus?.value)?.focus({preventScroll:true}));
    return true;
  }
  function notices(){
    if(S.role==='fund'&&CF.funder){CF.funder.notices();return;}
    if(S.role!=='asset'||D.restricted){CF.setCompletion([]);return;}
    const items=[];
    if(D.level!=='L3')items.push({priority:2,text:L('Complete identity verification on the asset trust platform to unlock financing.','在资产可信平台完成实名认证后即可使用融资功能。'),label:L('Complete now','立即前往'),act:'login-leave',value:'verify'});
    if(D.downgraded)items.push({priority:4,text:L('Your verification status has changed; financing features are temporarily unavailable.','你的实名认证状态已变更，融资相关功能暂时不可用。'),label:L('View status','查看状态'),act:'login-account'});
    // 纯组件样例队列，不借此定义资金方流程或文案。
    if(D.extraNotices){
      [1,2,3,4].forEach(n=>items.push({priority:n,text:L(`Component demo: pending item ${n}`,`组件演示：待完成事项 ${n}`),label:L('Resolve demo item','完成演示项'),act:'login-resolve',value:String(n)}));
      D.resolved?.forEach(n=>{const i=items.findIndex(x=>x.value===n&&x.act==='login-resolve');if(i>=0)items.splice(i,1);});
    }
    CF.setCompletion(items);
  }
  function unavailable(){return (D.sessionMessage?CF.note('warn',L('You signed out on the asset trust platform. Your sign-in here has also ended.','你已在资产可信平台登出，本平台登录同时结束。')):'')+CF.empty(L('This page is not available to guests','当前身份无法查看此页面'),L('You can continue exploring public information.','你可以继续浏览公开信息。'),btn('Back to assets','返回资产广场','login-home'));}
  function agreementPage(){
    let content;
    if(D.submit==='loading-list')content=CF.skelTable(2)+btn('Exit and keep browsing','退出并继续浏览','login-exit');
    else if(D.submit==='list-error')content=CF.note('red',L('Agreements could not be loaded. Try again.','协议加载失败，请重试。'))+btn('Retry','重试','login-load-agreements')+btn('Exit and keep browsing','退出并继续浏览','login-exit','','ghost');
    else content=`<p>${L('Review the current agreements before continuing.','继续前，请阅读并同意当前协议。')}</p>
      ${agreements.map((a,i)=>`<div class="login-agreement-row"><div><b>${L(...a.name)}</b><div class="login-caption">${L('Example version','示例版本')} ${a.version}</div></div><div>${link('Read','阅读','login-agreement',String(i))}${link('Download','下载','login-download',String(i))}</div></div>`).join('')}
      <p class="login-caption">${L('Demonstration agreements — not legal terms.','协议为演示内容，不构成法律条款。')}</p>
      <label class="login-check"><input type="checkbox" id="login-consent" ${D.accepted?'checked':''} ${D.submit==='pending'?'disabled':''}>${L('I have read and agree to all agreements above.','我已阅读并同意以上全部协议。')}</label>
      ${D.submit==='failed'?CF.note('red',L('Could not save your consent. Please try again.','同意记录保存失败，请重试。')):''}
      <div class="login-actions"><button type="button" class="btn primary" data-act="login-accept" ${!D.accepted||D.submit==='pending'?'disabled':''} ${D.submit==='pending'?'aria-busy="true"':''}>${D.submit==='pending'?L('Saving…','正在保存…'):L('Agree and continue','同意并继续')}</button></div>
      <div class="login-bottom">${link('Exit and keep browsing as a guest','退出并以游客身份继续浏览','login-exit')}</div>`;
    return `<div class="login-flow"><h1 class="page-title">${L('Before you continue','继续前确认协议')}</h1>${content}</div>`;
  }
  const agreements=[
    {name:['Platform agreement · example','平台服务协议 · 示例'],version:'DEMO-1',text:['This is a demonstration document for reviewing the agreement interaction. It does not grant rights or create obligations.','本内容仅用于评审协议交互，不授予权利，不产生义务。']},
    {name:['Privacy notice · example','隐私告知 · 示例'],version:'DEMO-1',text:['This prototype does not submit personal information. The production agreement collection is supplied by agreement management.','本原型不提交个人信息。正式协议集合由协议管理提供。']}
  ];
  function accountPage(){
    if(S.role==='guest')return unavailable();
    const state=D.accountState;
    let identity;
    if(state==='loading')identity=CF.skelTable(4);
    else if(state==='error')identity=CF.empty(L('Account information could not load','账户信息加载失败'),L('Try loading it again.','请重新加载。'),btn('Retry','重试','login-account-retry'));
    else {
      const fields=[['User ID','用户 ID','DEMO-USER-001'],...(!D.missing?[['Company ID','企业 ID','DEMO-ORG-001'],['Wallet address','钱包地址',assetWallet],['Email','邮箱','demo@example.test']]:[])];
      identity=`<dl class="login-fields login-identity-fields">${fields.map(f=>`<div><dt>${L(f[0],f[1])}</dt><dd class="mono">${esc(f[2])}</dd></div>`).join('')}</dl>`;
    }
    return `<div class="login-account"><div class="page-head"><div><h1 class="page-title">${L('Account settings','账户设置')}</h1><p class="page-desc">${L('Manage your preferences and view your identity information.','管理偏好设置，查看身份信息。')}</p></div></div>
      <div class="detail-stack"><section class="card detail-section"><div class="card-head"><h2>${L('Identity information','身份信息')}</h2></div><div class="card-b">
      <p class="login-caption">${L('From the asset trust platform. These details are maintained there.','来自资产可信平台。这些信息由资产可信平台维护。')}</p>${identity}
      <div class="login-agreement-row"><span>${L('Verification','实名认证')}</span><div class="detail-actions login-verification">${CF.tag(D.level==='L3'?'ok':'warn',D.level==='L3'?L('Verified','已认证'):L('Not verified','未认证'))}${D.level!=='L3'?link('Complete verification ↗','前往完成认证 ↗','login-leave','verify'):''}</div></div>
      <div class="detail-actions">${link('Manage on asset trust platform ↗','前往资产可信平台修改 ↗','login-leave','account')}</div></div></section>
      <section class="card detail-section"><div class="card-head"><h2>${L('Preferences','偏好设置')}</h2></div><div class="card-b login-stack">
      <div class="field login-preference-field"><label for="login-language">${L('Language preference','语言偏好')}</label><select class="inp" id="login-language" ${D.preferences==='pending'?'disabled':''}><option value="en" ${D.preferredLang==='en'?'selected':''}>English</option><option value="zh" ${D.preferredLang==='zh'?'selected':''}>简体中文</option></select></div>
      <label class="login-check"><input id="login-notify" type="checkbox" ${D.notification?'checked':''} ${D.preferences==='pending'?'disabled':''}>${L('Receive account notifications','接收账户通知')}</label>
      ${D.preferences==='failed'?CF.note('red',L('Preferences could not be saved. Try again.','偏好设置保存失败，请重试。')):''}
      <div><button class="btn primary" data-act="login-save-prefs" type="button" ${D.preferences==='pending'?'disabled aria-busy="true"':''}>${D.preferences==='pending'?L('Saving…','正在保存…'):L('Save preferences','保存偏好')}</button></div></div></section>
      <section class="card detail-section"><div class="card-b login-session"><div><h2>${L('Sign-in','登录状态')}</h2><p class="login-caption">${L('Signing out here keeps you signed in on the asset trust platform.','退出本平台不会退出资产可信平台。')}</p></div>${btn('Sign out','退出登录','login-signout')}</div></section></div>${demoStamp()}</div>`;
  }
  function gatePage(){
    const allowed=S.role==='asset'&&D.level==='L3';
    return `<div class="login-public"><div class="page-head"><div><h1 class="page-title">${L('Financing entry','融资入口')}</h1><p class="page-desc">${L('Demonstration page · sample data','演示页 · 演示数据')}</p></div>${CF.tag(allowed?'ok':'gray',S.role==='guest'?L('Guest','游客'):allowed?L('Verified','已认证'):L('Not verified','未认证'))}</div>
      <section class="card"><div class="card-b"><h2 class="page-title">${L('Start a financing request','发起融资申请')}</h2>
      <p class="muted">${L('Use your receivables to apply for financing.','以应收账款申请融资。')}</p>
      ${allowed?`<button type="button" class="btn primary" data-act="login-gate" ${D.gateState==='pending'?'disabled aria-busy="true"':''}>${D.gateState==='pending'?L('Checking eligibility…','正在确认资格…'):L('Start financing request','发起融资申请')}</button>`:
      `<button type="button" class="login-limit" data-act="login-gate" aria-disabled="true" aria-describedby="login-gate-reason"><span aria-hidden="true">⊘</span>${L('Start financing request','发起融资申请')}</button><p id="login-gate-reason" class="login-caption">${S.role==='guest'?L('Choose your role to continue.','选择身份后继续。'):L('Complete identity verification to use financing.','完成实名认证后可使用融资功能。')}</p>`}
      ${D.gateState==='failed'?CF.note('red',L('Could not confirm eligibility. No request was started. Please retry.','暂时无法确认资格，尚未发起申请，请重试。')):''}
      ${D.gateState==='ready'?CF.note('accent',L('Eligibility confirmed. You can continue with your financing request.','资格已确认，可继续填写融资申请。')):''}
      </div></section>${D.sessionMessage?CF.note('warn',L('You signed out on the asset trust platform. Your sign-in here has also ended.','你已在资产可信平台登出，本平台登录同时结束。')):''}</div>`;
  }
  function content(id){
    if(id==='P-L12'&&S.role==='fund'){queueMicrotask(()=>go('/funder/account'));return '';}
    if(CF.funder){const own=CF.funder.content(id);if(own!==undefined){queueMicrotask(postRender);return own;}}
    // 受限会话只有协议、协议正文与退出可达。路由守卫不依赖画不画入口。
    if(D.restricted&&id!=='P-L11'){queueMicrotask(()=>go('/auth/agreements'));return '';}
    notices();queueMicrotask(postRender);
    switch(id){
      case 'P-L01':return rolePage();
      case 'P-L03':
        if(!D.switchScheduled){D.switchScheduled=true;later(()=>{D.switchScheduled=false;go('/login');},800);}
        return `<div class="login-flow login-center" role="status"><h1 class="page-title">${L('Returning to role selection…','正在返回身份选择…')}</h1>${link('Choose a role','选择身份','login-select')}</div>`;
      case 'P-L04':return `<div class="login-flow"><div class="login-status-icon" aria-hidden="true">!</div><h1 class="page-title">${L('Unable to continue right now','暂时无法继续')}</h1><p>${L('Please try again or keep browsing. Reference: HC-100.','请重试或继续浏览。参考码：HC-100。')}</p><div class="login-actions">${btn('Try again','重试','login-select','','primary')}${btn('Keep browsing','继续浏览','login-guest')}</div></div>`;
      case 'P-L10':return `<div class="login-flow login-center"><div class="login-status-icon" aria-hidden="true">↻</div><h1 class="page-title">${L('Completing your sign-in','正在完成登录')}</h1><p role="status" aria-live="polite">${L('Please wait while we prepare your account.','正在准备你的账户，请稍候。')}</p>${CF.skelTable(2)}<div class="login-bottom">${link('Cancel and keep browsing','取消并继续浏览','login-exit')}</div></div>`;
      case 'P-L11':return agreementPage();
      case 'P-L12':return accountPage();
      case 'P-L13':return `<div class="login-flow"><div class="login-status-icon" aria-hidden="true">!</div><h1 class="page-title">${L('Account setup was interrupted','账户建立未完成')}</h1><p>${L('Your identity was confirmed, but we could not finish setting up your account. Please retry.','身份已确认，但账户暂未建立完成，请重试。')}</p><p class="mono">HC-241</p><div class="login-actions">${btn('Retry','重试','login-sso-retry','','primary')}${btn('Keep browsing as a guest','以游客身份继续浏览','login-exit')}</div></div>`;
      case 'DEMO-L-GATE':return gatePage();
      case 'P-L02':queueMicrotask(()=>go('/assets'));return '';
      default:return unavailable();
    }
  }
  function finishLanding(){
    D.pending=false;D.restricted=false;D.submit='idle';
    if(D.returnResult==='valid'&&D.originAction==='financing'){
      D.replay=true;go('/demo/login/financing');queueMicrotask(()=>gate());
    }else{
      if(!CF.resumePortalTarget?.()){
        go('/');
        if(D.returnResult!=='none')CF.toast(L('We have returned you to the asset marketplace.','已为你回到资产广场。'));
      }
    }
    if(D.accountChanged){CF.toast(L('You are now signed in with the returning account.','已切换为本次授权返回的账户。'));D.accountChanged=false;}
  }
  function sso(){
    D.handoff='';D.entryError='';D.sessionMessage='';D.pending=true;D.accepted=false;D.submit='idle';D.restricted=false;S.layer=null;S.demo=false;
    go('/auth/return');later(()=>{
      D.pending=false;
      if(['failure','locked','disabled','timeout'].includes(D.ssoResult)){
        const origin=D.origin;resetSession();go(origin.startsWith('/auth')||origin.startsWith('/login')?'/':origin);
        CF.toast(['locked','disabled'].includes(D.ssoResult)?L('Account unavailable. Contact support on the asset trust platform. Reference: HC-204.','账户暂不可用，请联系资产可信平台客服。参考码：HC-204。'):
          L('Sign-in could not be completed. Please try again later. Reference: HC-201.','登录未完成，请稍后重试。参考码：HC-201。'));if(['locked','disabled'].includes(D.ssoResult))supportLink();return;
      }
      if(D.ssoResult==='shadow'){S.role='guest';go('/auth/retry');return;}
      D.accountChanged=S.role==='asset';S.role='asset';D.level=D.ssoResult==='verified'?'L3':'L0';
      D.missing=D.ssoResult==='missing';
      if(D.ssoResult==='first'){
        D.restricted=true;D.agreed=false;go('/auth/agreements');
      }else{D.agreed=true;finishLanding();}
    });
  }
  function gate(){
    D.origin='/demo/login/financing';D.originAction='financing';
    if(S.role==='guest'){open('role');return;}
    if(S.role!=='asset'){D.reviewMessage=L('Funder actions are handed over to WS-349.','资金方操作交接至 WS-349。');S.demo=true;CF.render();return;}
    if(D.level!=='L3'){open('guide');return;}
    D.gateState='pending';CF.render();later(()=>{
      if(S.role!=='asset'||D.restricted){D.gateState='idle';CF.render();return;}
      if(D.level!=='L3'){D.gateState='idle';open('guide');return;}
      if(D.verificationResult==='failed')D.gateState='failed';
      else if(D.verificationResult==='unverified'){D.level='L0';D.downgraded=true;D.gateState='idle';open('guide');}
      else D.gateState='ready';
      CF.render();
    });
  }
  const layers={
    role:()=>({title:L('Choose your role','选择你的身份'),html:`<p>${L('Choose how you want to continue with this financing request.','请选择继续发起融资申请的身份。')}</p>${choices()}`,foot:btn('Cancel','返回','closelayer','','ghost')}),
    leave:(purpose)=>({title:L('You are leaving the lending platform','即将离开借贷平台'),
      html:`<p>${L('You will be redirected to the asset trust platform to continue.','我们将带你前往「资产可信平台」继续操作。')}</p><p><b>${L('Asset trust platform','资产可信平台')}</b></p>`,
      foot:(purpose==='login'&&S.role==='guest'?link('Switch role','切换身份','login-switch'):'')+btn('Cancel','返回','closelayer','','ghost')+
        btn(purpose==='login'?'Sign in on asset trust platform':'Continue',purpose==='login'?'前往资产可信平台登录':'继续前往','login-depart',purpose,'primary')}),
    guide:()=>({title:L('Complete identity verification','完成实名认证'),html:`<p>${D.rejected?L('Your verification was not approved. Review the reasons on the asset trust platform and resubmit.','你的实名认证未通过，请前往资产可信平台查看原因并重新提交。'):L('Complete identity verification on the asset trust platform to submit a financing request.','在资产可信平台完成实名认证后即可发起融资申请。')}</p>`,foot:btn('Cancel','返回','closelayer','','ghost')+btn('Go to asset trust platform','前往资产可信平台','login-leave','verify','primary')}),
    agreement:(index)=>({title:L(...agreements[Number(index)].name),html:`<p>${esc(L(...agreements[Number(index)].text))}</p><p class="mono">${agreements[Number(index)].version}</p>`,foot:btn('Download','下载','login-download',String(index))+btn('Back','返回','closelayer','','primary')}),
    notification:()=>({title:L('Account notification','账户通知'),html:`<p>${D.downgraded?L('Your verification status has changed; financing features are temporarily unavailable.','你的实名认证状态已变更，融资相关功能暂时不可用。'):L('No new notifications.','暂无新通知。')}</p>${demoStamp()}`,foot:btn('Close','关闭','closelayer')}),
    support:()=>({title:L('Asset trust platform support','资产可信平台客服'),html:`<p>${L('Please contact support through the asset trust platform and provide reference HC-204.','请通过资产可信平台联系客服，并提供参考码 HC-204。')}</p>`,foot:btn('Close','关闭','closelayer')})
  };
  function action(act,v){
    if(CF.funder&&CF.funder.action(act,v))return true;
    if(!act.startsWith('login-'))return false;
    switch(act){
      case 'login-choose':choose(v);break;
      case 'login-select':cancelPending();go('/login');break;
      case 'login-home':go('/');break;
      case 'login-guest':resetSession();go(D.origin.startsWith('/auth')||D.origin.startsWith('/login')?'/':D.origin);break;
      case 'login-exit':resetSession();go(D.origin.startsWith('/auth')||D.origin.startsWith('/login')?'/':D.origin);break;
      case 'login-switch':clearMemory();D.entryError='';D.handoff='';go('/login/switch');break;
      case 'login-leave':open('leave',v||'verify');break;
      case 'login-depart':
        S.layer=null;D.handoff='asset';S.demo=true;D.reviewMessage=L('External handoff: asset trust platform. The destination is not configured; use a simulated return below.','已到资产可信平台离站边界；目标域名尚未登记，可在下方模拟返回。');break;
      case 'login-gate':gate();break;
      case 'login-sso-retry':sso();break;
      case 'login-account':go(S.role==='fund'?'/funder/account':'/account');break;
      case 'login-signout':endSession('logout');break;
      case 'login-account-retry':D.accountState='loading';later(()=>{D.accountState='default';CF.render();});break;
      case 'login-support':open('support');break;
      case 'login-agreement':open('agreement',v);break;
      case 'login-download':{
        const a=agreements[Number(v)], blob=new Blob([L(...a.name)+'\n'+a.version+'\n\n'+L(...a.text)],{type:'text/plain;charset=utf-8'});
        const url=URL.createObjectURL(blob),el=document.createElement('a');el.href=url;el.download='demonstration-agreement-'+(Number(v)+1)+'.txt';el.click();setTimeout(()=>URL.revokeObjectURL(url),1000);break;
      }
      case 'login-accept':
        if(!D.accepted||D.submit==='pending')break;
        D.submit='pending';later(()=>{if(D.submitResult==='failed'){D.submit='failed';CF.render();}else{D.agreed=true;finishLanding();}});break;
      case 'login-load-agreements':D.submit='loading-list';later(()=>{D.submit='idle';CF.render();});break;
      case 'login-save-prefs':{
        if(S.role!=='asset'||D.restricted||D.preferences==='pending')break;
        const notification=D.notification,language=D.preferredLang;
        D.preferences='pending';later(()=>{if(D.submitResult==='failed'){D.preferences='failed';CF.render();}else{
          D.savedNotification=notification;D.savedLang=language;S.lang=language;D.preferences='idle';CF.render();CF.toast(L('Preferences saved.','偏好设置已保存。'));
        }});break;}
      case 'login-resolve':(D.resolved||(D.resolved=[])).push(v);break;
      case 'login-handoff':
        D.reviewMessage=L('This destination belongs to the '+v+' module; its pages are outside this delivery.','此入口交接至 '+v+' 模块，页面不在本次交付范围内。');S.demo=true;break;
      case 'login-demo':demoAction(v);break;
      default:return false;
    }
    return true;
  }
  function demoAction(v){
    D.reviewMessage='';
    switch(v){
      case 'guest':resetSession();D.sessionMessage='';break;
      case 'asset':cancelPending();D.sessionMessage='';S.role='asset';D.restricted=false;D.agreed=true;break;
      case 'L0':D.level='L0';break;
      case 'L3':D.level='L3';D.downgraded=false;break;
      case 'gate':go('/demo/login/financing');S.demo=false;break;
      case 'sso':if(!/^#\/(login|auth)(?:[/?]|$)/.test(location.hash)){D.origin=CF.ENTRY[S.page]||'/';if(CF.portalConnected)CF.portalLoginReturn=location.hash;}sso();break;
      case 'return':sso();break;
      case 'wallet-cancel':D.handoff='';D.entryError='';S.demo=false;go('/login');break;
      case 'wallet-missing':D.handoff='';D.entryError='wallet';S.demo=false;go('/login');break;
      case 'wallet-connected':D.handoff='';D.reviewMessage=L('Connection success only. No signature requested and no account/session created. Signature confirmation belongs to WS-349.','仅模拟连接成功，未请求签名、未建号或建会话。签名确认交接至 WS-349。');break;
      case 'asset-unavailable':D.handoff='';D.entryError='asset';S.demo=false;go('/login');break;
      case 'asset-cancel':D.handoff='';D.entryError='';S.demo=false;resetSession();go(D.origin==='/demo/login/financing'?D.origin:'/login');break;
      case 'fallback':D.returnResult='fallback';finishLanding();S.demo=false;break;
      case 'main-failure':resetSession();S.demo=false;go('/login/unavailable');break;
      case 'expiry':S.demo=false;endSession('expiry');break;
      case 'upstream':S.demo=false;endSession('upstream');break;
      case 'blocked':S.demo=false;endSession('blocked');break;
      case 'downgrade':S.role='asset';D.level='L0';D.downgraded=true;S.demo=false;break;
      case 'refresh':S.role='asset';D.level='L3';D.downgraded=false;S.demo=false;break;
      case 'invalid-status':S.role='asset';D.level='L0';D.reviewMessage=L('An unknown upstream status is conservatively shown as not verified.','未知上游状态按未认证保守展示。');break;
      case 'rejected':D.rejected=!D.rejected;break;
      case 'missing':D.missing=!D.missing;break;
      case 'notice-queue':S.role='asset';D.extraNotices=!D.extraNotices;D.resolved=[];break;
      case 'account-loading':D.accountState='loading';go('/account');break;
      case 'account-error':D.accountState='error';go('/account');break;
      case 'account-ready':D.accountState='default';go('/account');break;
      case 'agreement-error':S.role='asset';D.restricted=true;D.submit='list-error';go('/auth/agreements');S.demo=false;break;
      case 'memory-off':D.memoryDisabled=!D.memoryDisabled;D.lastRole=null;break;
      case 'memory-expired':clearMemory();break;
    }
  }
  function options(id,title,values,selected){return `<div class="field"><label for="${id}">${title}</label><select class="inp" id="${id}">${values.map(a=>`<option value="${a[0]}" ${selected===a[0]?'selected':''}>${L(a[1],a[2])}</option>`).join('')}</select></div>`;}
  function demoPanel(){
    if(!S.demo)return;
    $('demoPanel').innerHTML=`<div class="grp"><h5>${L('Review tools · simulation only','评审工具 · 仅模拟')}</h5><p class="login-caption">${L('No real authorization, wallet, backend session or security enforcement. External pages are not reproduced.','不执行真实授权、钱包、服务端会话或安全校验，不复刻外部页面。')}</p>
      ${D.reviewMessage?CF.note('accent',esc(D.reviewMessage)):''}
      ${D.handoff==='wallet'?`<div class="seg">${btn('Cancel wallet request','钱包取消','login-demo','wallet-cancel')}${btn('No wallet available','钱包不可用','login-demo','wallet-missing')}${btn('Connection succeeded','连接成功','login-demo','wallet-connected')}</div>`:''}
      ${D.handoff==='asset'?`<div class="seg">${btn('Simulate return','模拟返回','login-demo','return')}${btn('Platform unreachable','授权中心不可达','login-demo','asset-unavailable')}${btn('Abandon and return','放弃并返回','login-demo','asset-cancel')}</div>`:''}</div>
      <div class="grp"><h5>${L('Session and completeness','会话与完备度')}</h5><div class="seg">${btn('Guest','游客','login-demo','guest')}${btn('Asset party','资产方','login-demo','asset')}${btn('Not verified','未认证','login-demo','L0')}${btn('Verified','已认证','login-demo','L3')}</div><p class="login-caption">${L('Current','当前')}：${S.role} / ${D.level}</p>${btn('Open financing entry demo','打开融资硬卡点演示','login-demo','gate')}</div>
      ${options('demo-sso',L('Authorization result','授权结果'),[['first','First sign-in · agreement required','首次登录 · 需同意协议'],['verified','Success · verified','成功 · 已认证'],['unverified','Success · not verified','成功 · 未认证'],['missing','Success · optional fields absent','成功 · 可选字段缺失'],['shadow','Account creation failed','影子账号建立失败'],['failure','Authorization rejected','授权校验失败'],['timeout','Authorization timed out','授权超时'],['locked','Upstream account locked','上游账户锁定'],['disabled','Upstream account disabled','上游账户停用']],D.ssoResult)}
      ${options('demo-return',L('Return result','回跳结果'),[['fallback','Current baseline · cross-platform fallback','当前基线 · 跨平台兜底'],['none','No original action · assets','无原操作 · 资产广场'],['valid','Valid local return · replay action','有效站内回跳 · 重执行操作']],D.returnResult)}
      ${options('demo-source',L('Entry source','入口来源'),[['A','Asset trust platform (A)','资产可信平台发起（A）'],['B','Lending platform (B)','借贷平台发起（B）']],D.source)}
      ${btn('Run simulated SSO return','运行模拟 SSO 回调','login-demo','sso')}
      ${options('demo-verify',L('Live eligibility result','实时资格复核结果'),[['verified','Verified','已认证'],['unverified','No longer verified','认证已失效'],['failed','Temporarily unavailable','暂时无法复核']],D.verificationResult)}
      ${options('demo-submit',L('Save result','保存结果'),[['success','Success','成功'],['failed','Failure · allow retry','失败 · 可重试']],D.submitResult)}
      <div class="grp"><h5>${L('Session invalidation','会话失效')}</h5><div class="seg">${btn('Expired','到期','login-demo','expiry')}${btn('Upstream logout','上游登出','login-demo','upstream')}${btn('Account unavailable','主体不可用','login-demo','blocked')}</div></div>
      <div class="grp"><h5>${L('Verification and reminders','认证与提示条')}</h5><div class="seg">${btn('Downgrade','认证降级','login-demo','downgrade')}${btn('Refresh: verified','刷新为已认证','login-demo','refresh')}${btn('Unknown status','未知状态','login-demo','invalid-status')}${btn('Toggle rejected copy','切换驳回文案','login-demo','rejected')}${btn('Reminder queue','提示条队列','login-demo','notice-queue')}</div></div>
      <div class="grp"><h5>${L('Account and agreement states','账户与协议状态')}</h5><div class="seg">${btn('Account loading','账户加载中','login-demo','account-loading')}${btn('Account load failed','账户加载失败','login-demo','account-error')}${btn('Account ready','账户正常','login-demo','account-ready')}${btn('Toggle missing fields','切换字段缺失','login-demo','missing')}${btn('Agreement load failed','协议加载失败','login-demo','agreement-error')}</div></div>
      <div class="grp"><h5>${L('Entry and fallback','入口与兜底')}</h5><div class="seg">${btn('Main flow unavailable','主干不可继续','login-demo','main-failure')}${btn('Return fallback','回跳兜底','login-demo','fallback')}${btn('Storage unavailable','存储不可用','login-demo','memory-off')}${btn('Memory expired','身份记忆到期','login-demo','memory-expired')}</div></div>`;
  }
  let priorLayer=false, renderedPage=null;
  function postRender(){
    if(renderedPage!==S.page){if(pages[S.page]||/^P-L2|^DEMO-F-/.test(S.page))window.scrollTo(0,0);renderedPage=S.page;}
    const foot=$('foot');if(pages[S.page]||/^P-L2|^DEMO-F-/.test(S.page))foot.innerHTML=`<div class="ft-in"><div class="ft-mark">Harbour Credit</div><p class="ft-tag">${L('Receivables and financing, connected.','连接应收账款与融资需求。')}</p><div class="ft-links">${link('About','平台介绍','login-handoff','about')}${link('FAQ','常见问题','login-handoff','faq')}${link('Agreements','协议','login-handoff','agreement')}</div><div class="ft-meta">${L('Lending platform','借贷平台')}</div></div>`;
    if(D.sessionMessage&&!pages[S.page]&&!$('login-session-notice'))$('content').insertAdjacentHTML('afterbegin',`<div id="login-session-notice">${CF.note('warn',L('You signed out on the asset trust platform. Your sign-in here has also ended.','你已在资产可信平台登出，本平台登录同时结束。'))}</div>`);
    const focusfoot=document.querySelector('.focus-foot');focusfoot.textContent=L('Harbour Credit · Lending platform','Harbour Credit · 借贷平台');
    // 对底座既有入口补上本模块动作，仍由公共层渲染导航、语言及账户下拉。
    document.querySelectorAll('[data-act="signin"]').forEach(x=>x.dataset.act='login-start');
    document.querySelectorAll('[data-act="toast"]').forEach(x=>{
      const v=x.dataset.v;if(v==='apply')x.dataset.act='login-start';
      else if(v==='acct')x.dataset.act='login-account';
      else if(v==='notify')x.dataset.act='login-notifications';
      else if(v==='inst')x.hidden=true;
    });
    const badge=document.querySelector('#tools .badge');if(badge&&!CF.portalConnected){if(D.downgraded)badge.textContent='1';else badge.remove();}
    if(D.restricted){document.querySelector('#focus .brand').removeAttribute('href');}
    else document.querySelector('#focus .brand').setAttribute('href','#/assets');
    if(!CF.portalConnected||pages[S.page]||/^P-L2|^DEMO-F-/.test(S.page))demoPanel();
    if(CF.funder)CF.funder.afterRender();
    const dialog=document.querySelector('#layers > .modal-mask [role="dialog"], #layers > [role="dialog"]');
    if(dialog){
      if(S.layer.key==='role')dialog.classList.add('login-role-dialog');
      ['portal','focus','demoPanel','demoBtn'].forEach(id=>$(id).inert=true);
    }else{
      ['portal','focus','demoPanel','demoBtn'].forEach(id=>$(id).inert=false);
      if(priorLayer&&D.focusBack){
        const f=D.focusBack;let target=f.id?$(f.id):Array.from(document.querySelectorAll('[data-act]')).find(x=>x.dataset.act===f.act&&(x.dataset.v||'')===(f.value||'')&&x.getClientRects().length);
        if(target)target.focus({preventScroll:true});
      }
    }
    priorLayer=!!dialog;
  }
  if(CF.funder){Object.assign(dict.en,CF.funder.dict.en);Object.assign(dict.zh,CF.funder.dict.zh);Object.assign(layers,CF.funder.layers);}
  CF.define(CF.AccountView={id:'login-account',dict,content,layers,onAct:action,
    // 组合只承接已有页面：资产广场及其既有项目链接保持单一实现。
    ...(CF.AM ? {pages:[...Object.keys(pages),'P-L20','P-L21','P-L22','P-L23','DEMO-F-GATE',...(!CF.MC?['P-MC-01']:[])],
      beforeRender(){
        if(D.restricted&&S.page!=='P-L11'){S.page='P-L11';go('/auth/agreements');}
        notices();queueMicrotask(postRender);
        CF.LSView?.beforeRender?.();
      },
      afterRender(){CF.LSView?.afterRender?.();},
      onBeforeAct(act,v,e){return CF.LSView?.onBeforeAct?.(act,v,e);}
    }: {})});
  // 登录域优先接管底座的样例登录/退出动作；路由与浮层仍使用 CF。
  document.addEventListener('click',e=>{
    const el=e.target.closest('[data-act]');
    if(el){const a=el.dataset.act;
      // 受限融资按钮只打开身份/补全引导，不执行业务；先于公共禁用动作守卫处理。
      if(a==='login-gate'&&el.getAttribute('aria-disabled')==='true'){
        e.preventDefault();e.stopImmediatePropagation();gate();CF.render();return;
      }
      if(a==='login-start'||a==='signin'||(CF.AM&&a==='deeplink'&&el.dataset.v==='cta'&&S.role==='guest')){
        e.preventDefault();e.stopImmediatePropagation();D.origin=CF.ENTRY[S.page]||'/';if(CF.portalConnected)CF.portalLoginReturn=location.hash;D.originAction='';D.returnResult='none';D.entryError='';go('/login');return;
      }
      if(a==='signout'){e.preventDefault();e.stopImmediatePropagation();if(S.role==='fund'&&CF.funder)CF.funder.logout();else endSession('logout');return;}
      if(a==='login-notifications'){e.preventDefault();e.stopImmediatePropagation();if(CF.portalConnected)go('/notifications');else open('notification');return;}
      // 防止点击对话框非按钮区域被底座解释为遮罩关闭。
      if(a==='closelayer'&&el.classList.contains('modal-mask')&&e.target.closest('.modal')){e.stopImmediatePropagation();return;}
      if(a==='closelayer'&&returnToGuide()){e.preventDefault();e.stopImmediatePropagation();return;}
    }
    const nav=e.target.closest('#nav a, .crumb-link');
    if(nav&&!CF.MC&&(CF.AM?['#/console']:['#/assets','#/marketplace','#/console']).includes(nav.getAttribute('href'))){
      e.preventDefault();e.stopImmediatePropagation();D.reviewMessage=L('This business page is delivered by its owning module.','此业务页由对应模块交付。');S.demo=true;CF.render();
    }
  },true);
  document.addEventListener('change',e=>{
    const id=e.target.id,v=e.target.value;
    if(id==='login-consent')D.accepted=e.target.checked;
    else if(id==='login-language')D.preferredLang=v;
    else if(id==='login-notify')D.notification=e.target.checked;
    else if(id==='demo-sso')D.ssoResult=v;
    else if(id==='demo-return')D.returnResult=v;
    else if(id==='demo-source')D.source=v;
    else if(id==='demo-verify')D.verificationResult=v;
    else if(id==='demo-submit')D.submitResult=v;
    else return;
    CF.render();queueMicrotask(()=>$(id)?.focus({preventScroll:true}));
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&returnToGuide()){e.preventDefault();e.stopImmediatePropagation();return;}
    const dialog=document.querySelector('#layers > .modal-mask [role="dialog"], #layers > [role="dialog"]');
    if(dialog&&e.key==='Tab'){
      const nodes=Array.from(dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select')).filter(x=>x.getClientRects().length);
      if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  },true);
  window.addEventListener('hashchange',()=>{
    if(D.restricted&&location.hash!=='#/auth/agreements'){location.hash='#/auth/agreements';}
    if(D.timerRoute&&D.timerRoute!==location.hash)cancelPending();
  });
  readMemory();
  // 双击默认为游客壳；登录只有主动点击或受限操作才出现。
  if(!location.hash&&!CF.deferBoot)location.hash='#/assets';
  if(!CF.deferBoot)CF.boot();
})(window.CF);
