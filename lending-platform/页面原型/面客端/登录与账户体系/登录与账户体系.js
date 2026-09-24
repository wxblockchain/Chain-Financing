/* WS-371 · 页面原型。所有身份、上游同步与服务端结果均为演示数据，不发网络请求。
   维护源：公共 shell / token + 本模块组合。流程页按登记表约定在模块内追加。
   不实现真实钱包、签名验证、上游推送、会话强制、实时复核或审计。 */
(function (CF) {
  'use strict';
  const S = CF.S, L = CF.L, esc = CF.esc;
  const pages = {
    'P-L01':['focus','/login','Sign in with wallet','连接钱包登录'],
    'P-L10':['focus','/auth/return','Matching your account','正在匹配账户'],
    'P-L13':['focus','/auth/retry','Account setup interrupted','账户建立未完成'],
    'P-L04':['focus','/login/unavailable','Unable to continue','暂时无法继续'],
    'P-L12':['portal','/account','Account settings','账户设置'],
    'P-L14':['portal','/account/company','Company information','企业信息'],
    // 本模块内的演示落点，绝不占用 P-MC-01 或登记成正式业务页。
    'DEMO-L-GATE':['portal','/demo/login/actions','Business actions · demo','业务动作 · 演示页']
  };
  const dict = {en:{navAssets:'Asset marketplace',navPlaza:'Lending marketplace',navConsole:'My console'},
    zh:{navAssets:'资产广场',navPlaza:'借贷广场',navConsole:'我的控制台'}};
  Object.entries(pages).forEach(([id,p])=>{
    CF.PAGES[id]={end:'asset',layout:p[0],navKey:id,auth:['P-L12','P-L14'].includes(id)};
    CF.ENTRY[id]=p[1];dict.en[id]=p[2];dict.zh[id]=p[3];
  });
  CF.PAGES['P-L14'].parent='P-F-AM-01';

  /* 演示地址：A 在上游同步数据中已登记，B 未登记。上游登记地址变更后旧地址不再命中。 */
  const registered='0x1111111111111111111111111111111111111111';
  const unregistered='0x2222222222222222222222222222222222222222';
  const renewed='0x3333333333333333333333333333333333333333';

  const D = {
    stage:'', loginError:'', address:'', level:'L0',
    downgraded:false, rejected:false, missing:false,
    accountState:'default', personalState:'idle', companyState:'idle',
    companyCase:'verified', profileVariant:1, profileOptionalMissing:false,
    profileReads:{}, profileReadRoute:'', profileEpoch:0, companyOrigin:'/assets',
    preferredLang:'en', savedLang:'en', preferenceState:{language:'idle'}, preferenceEpoch:0,
    origin:'/assets', originAction:'', returnResult:'fallback',
    walletResult:'ok', signResult:'ok', matchOverride:'auto', verificationResult:'verified',
    submitResult:'success', addressMoved:false, syncedAt:'2026-09-24T02:15:00Z',
    gateState:'idle', sessionMessage:'', landingMessage:'', reviewMessage:'',
    handoff:'', extraNotices:false, resolved:[], focusBack:null, pendingTrigger:'',
    timer:0, timerVersion:0, timerRoute:null, pending:false
  };
  const $=id=>document.getElementById(id);
  const boundAccount=()=>({userId:'DEMO-USER-00'+D.profileVariant,
    companyId:D.missing||D.companyCase==='none'?'':'DEMO-ORG-00'+D.profileVariant,
    email:D.missing?'':'demo'+D.profileVariant+'@example.test'});
  CF.portalAccount=()=>({walletAddress:S.role==='fund'?CF.funder?.review.account.address||'':
    ['asset','signed'].includes(S.role)?D.address||registered:''});

  function btn(en,zh,act,value='',kind='',disabled=false) {
    return `<button type="button" class="btn ${kind}" data-act="${act}" data-v="${esc(value)}" ${disabled?'disabled':''}>${L(en,zh)}</button>`;
  }
  function link(en,zh,act,value='') {return `<button type="button" class="btn-link" data-act="${act}" data-v="${esc(value)}">${L(en,zh)}</button>`;}
  function go(route) {if(route==='/')route='/assets';S.menu=null;S.layer=null;if(location.hash==='#'+route)CF.render();else location.hash='#'+route;}
  function later(fn,ms=950){clearTimeout(D.timer);const version=++D.timerVersion;D.timerRoute=location.hash;D.timer=setTimeout(()=>{if(version===D.timerVersion&&D.timerRoute===location.hash)fn();},ms);}
  function cancelPending(){clearTimeout(D.timer);D.timerVersion++;D.timerRoute=null;D.pending=false;if(D.gateState==='pending')D.gateState='idle';cancelPreferences();cancelProfileReads();}
  function shortAddress(a){return a&&a.length>10?a.slice(0,6)+'…'+a.slice(-4):a;}
  function demoStamp(){return `<p class="login-demo-stamp">${L('Demonstration data','演示数据')}</p>`;}

  /* ---------------------------------------------------------------- 偏好 */
  function cancelPreferences(){D.preferenceEpoch++;D.preferredLang=D.savedLang;D.preferenceState={language:'idle'};}
  function loadPreferences(){
    cancelPreferences();let prefs={};try{prefs=JSON.parse(localStorage.getItem('lp_asset_preferences_'+boundAccount().userId)||'{}')||{};}catch(e){}
    D.savedLang=['en','zh'].includes(prefs.language)?prefs.language:S.lang;D.preferredLang=D.savedLang;S.lang=D.savedLang;
  }
  function savePreference(value){
    if(S.role!=='asset'||S.page!=='P-L12'||D.preferenceState.language==='pending')return;
    if(!['en','zh'].includes(value)||value===D.savedLang)return;
    D.preferredLang=value;D.preferenceState.language='pending';
    const epoch=D.preferenceEpoch,user=boundAccount().userId,route=location.hash;
    setTimeout(()=>{
      if(epoch!==D.preferenceEpoch||S.role!=='asset'||boundAccount().userId!==user||location.hash!==route)return;
      try{
        if(D.submitResult==='failed')throw Error('simulated');
        localStorage.setItem('lp_asset_preferences_'+user,JSON.stringify({language:value}));
        D.savedLang=value;S.lang=value;D.preferenceState.language='saved';
      }catch(e){D.preferredLang=D.savedLang;D.preferenceState.language='failed';}
      CF.render();queueMicrotask(()=>$('login-language')?.focus({preventScroll:true}));
    },650);
  }
  function preferenceFeedback(){
    const state=D.preferenceState.language;
    return `<p class="login-caption" role="${state==='failed'?'alert':'status'}">${state==='pending'?L('Saving…','正在保存…'):
      state==='saved'?L('Preferences saved','偏好设置已保存'):state==='failed'?L('Could not save. Select your preference again','保存失败，请重新选择'):''}</p>`;
  }

  /* ---------------------------------------------------------------- 资料读取 */
  function cancelProfileReads(){D.profileEpoch++;Object.values(D.profileReads).forEach(clearTimeout);D.profileReads={};['accountState','personalState','companyState'].forEach(k=>{if(D[k]==='loading')D[k]='idle';});}
  function profileBody(key,body,emptyText){
    if(D[key]==='idle'){
      D[key]='loading';const epoch=D.profileEpoch,user=boundAccount().userId,route=location.hash;
      D.profileReadRoute=route;
      D.profileReads[key]=setTimeout(()=>{if(epoch!==D.profileEpoch||user!==boundAccount().userId||S.role!=='asset'||route!==location.hash)return;D[key]='default';CF.render();},450);
    }
    if(D[key]==='loading')return `<div role="status" aria-label="${L('Loading information','正在读取资料')}">${CF.skelTable(2)}</div>`;
    if(D[key]==='error')return CF.empty(L(key==='companyState'?'Could not load company information':key==='personalState'?'Could not load personal information':'Could not load account information',
      key==='companyState'?'企业信息加载失败':key==='personalState'?'个人信息加载失败':'账户信息加载失败'),'',btn('Retry','重试','login-profile-retry',key));
    if(D[key]==='empty'||D.missing&&key!=='accountState')return CF.empty(L(...emptyText),'','');
    return body;
  }

  /* ---------------------------------------------------------------- 会话 */
  function resetSession(){
    cancelPending();S.role='guest';S.layer=null;S.menu=null;
    D.stage='';D.address='';D.level='L0';D.gateState='idle';D.downgraded=false;
    D.extraNotices=false;D.originAction='';D.pendingTrigger='';D.landingMessage='';D.preferredLang=D.savedLang;
    CF.resetCompletion();
  }
  const endText={
    logout:['Signed out here. Signing out here does not sign you out of the asset trust platform.','已退出本平台。退出本平台不会退出资产可信平台。'],
    expiry:['Your sign-in has expired. You can sign in again to continue.','登录已过期，可重新登录继续。'],
    blocked:['This account is currently unavailable. Contact support on the asset trust platform. Reference: HC-204.','账户暂不可用，请联系资产可信平台客服。参考码：HC-204。'],
    'wallet-change':['The wallet address registered on the asset trust platform has changed. Please sign in again.','资产可信平台登记的钱包地址已变更，请重新登录。']
  };
  function endSession(kind){
    const dirty=D.preferredLang!==D.savedLang;
    const onProtected=CF.PAGES[S.page]?.auth||S.page==='P-L12'||S.page==='P-L14';
    resetSession();
    D.sessionMessage=['wallet-change','blocked'].includes(kind)?L(...endText[kind]):'';
    if(onProtected)go('/');else CF.render();
    if(endText[kind])CF.toast(L(...endText[kind]));
    if(kind==='blocked')supportLink();
    if(dirty)CF.toast(L('Your changes were not saved.','内容未保存。'));
  }
  function supportLink(){const toast=$('toasts').lastElementChild;if(toast)toast.insertAdjacentHTML('beforeend',link('Contact support','联系客服','login-support'));}

  /* ---------------------------------------------------------------- 登录 */
  function startLogin(originAction){
    cancelPending();D.loginError='';D.stage='';D.sessionMessage='';D.landingMessage='';
    D.originAction=originAction||'';
    go('/login');
  }
  const actionCopy={
    financing:['Start a financing request','发起融资申请'],
    funding:['Submit a funding quote','发起出资 / 授信报价']
  };
  function loginPage(){
    const held=D.originAction?CF.note('accent',L('We kept your action: ','已保留你的操作：')+L(...actionCopy[D.originAction])+L('. It continues after you sign in.','。登录后继续。')):'';
    const errors={
      wallet:['No wallet is available. Install or enable a compatible browser wallet, then try again.','未检测到可用钱包。请安装或启用兼容的浏览器钱包后重试。'],
      cancel:['You cancelled the wallet connection. You can connect again or keep browsing.','你取消了钱包连接，可重新连接或继续浏览。'],
      'sign-rejected':['You declined the signature, so you are not signed in. You can try again or keep browsing.','你拒绝了签名，未建立登录。可重试或继续浏览。'],
      'sign-failed':['The signature could not be verified. You are not signed in. Please try again.','签名验证失败，未建立登录，请重试。']
    };
    return `<div class="login-flow">
      <h1 class="page-title">${L('Sign in with wallet','连接钱包登录')}</h1>
      <p>${L("We'll ask you to connect a wallet and sign one login message. No transfer or spending approval is involved.",'我们会请求连接钱包并进行一次登录签名，不涉及转账或资金授权。')}</p>
      ${held}
      <ol class="login-steps">
        <li${D.stage===''?' aria-current="step"':''}><span class="login-step-num">1</span>${L('Connect your wallet','连接钱包')}</li>
        <li${D.stage==='connect'?' aria-current="step"':''}><span class="login-step-num">2</span>${L('Choose the address to sign in with','选择登录地址')}</li>
        <li${D.stage==='sign'?' aria-current="step"':''}><span class="login-step-num">3</span>${L('Sign the login message','完成消息签名')}</li>
      </ol>
      <p class="login-caption">${L('Ethereum (ETH) wallets only in this release.','本期仅支持以太坊（ETH）链钱包。')}</p>
      ${D.loginError?CF.note('red',L(...errors[D.loginError])):''}
      <div class="login-actions">${btn('Connect wallet','连接钱包','login-connect','','primary')}${link('Keep browsing','继续浏览','login-exit')}</div>
      ${demoStamp()}</div>`;
  }
  function connectWallet(){
    D.loginError='';
    if(D.walletResult==='missing'){D.loginError='wallet';D.stage='';CF.render();return;}
    D.stage='connect';open('connect');
  }
  function addressChosen(address){
    S.layer=null;D.address=address;D.stage='sign';open('signature');
  }
  function signatureDone(result){
    S.layer=null;
    if(result!=='ok'){D.stage='';D.loginError=result==='rejected'?'sign-rejected':'sign-failed';go('/login');return;}
    D.stage='matching';D.pending=true;go('/auth/return');
    later(()=>{D.pending=false;applyMatch();});
  }
  /* 每次登录成功后都以登录地址在上游同步数据中匹配；命中即绑定资产方，未命中为登录未绑定角色。 */
  function applyMatch(){
    const override=D.matchOverride;
    cancelProfileReads();D.accountState='default';D.personalState=D.companyState='idle';
    if(override==='locked'){
      const origin=D.origin;resetSession();go(/^\/(auth|login)/.test(origin)?'/':origin);
      CF.toast(L(...endText.blocked));supportLink();return;
    }
    if(override==='create-failed'){S.role='guest';D.stage='';go('/auth/retry');return;}
    if(override==='multi'){
      S.role='signed';D.level='L0';
      landing(L('We could not complete sign-in for this address right now. Please try again later.','当前无法为该地址完成登录，请稍后重试。'));return;
    }
    // 上游把登记地址改到新地址后，旧地址不再命中，用新地址登录接续原账户与历史。
    const moved=D.addressMoved&&D.address===registered;
    if(override==='moved'||override==='auto'&&moved){
      S.role='signed';D.level='L0';
      landing(L('The registration for this address changed on the asset trust platform. Please sign in with the new address.','该地址在资产可信平台的登记已变更，请使用新地址登录。'));return;
    }
    const hit=override==='hit'||override==='auto'&&!moved&&[registered,renewed].includes(D.address);
    if(hit){
      S.role='asset';D.level=D.verificationResult==='verified'?'L3':'L0';D.downgraded=false;
      loadPreferences();landing('');return;
    }
    S.role='signed';D.level='L0';landing('');
  }
  /* 登录前保留的原页面与原操作：回到原处后重新判断权限，未取得资格按动作归属分流。 */
  function landing(message){
    D.stage='';D.landingMessage=message;
    const pending=D.originAction;
    if(pending){
      // 回到原触发点后再重新判断权限，避免在路由切换前打开引导。
      D.pendingTrigger=pending;D.originAction='';
      go(D.origin&&!/^\/(auth|login)/.test(D.origin)?D.origin:'/demo/login/actions');
      if(message)CF.toast(message);
      return;
    }
    if(!CF.resumePortalTarget?.()){
      go(D.origin&&!/^\/(auth|login)/.test(D.origin)?D.origin:'/');
      if(D.returnResult==='invalid')CF.toast(L('That link is no longer valid. We have returned you to the asset marketplace.','链接已失效，已为你回到资产广场。'));
      else if(D.returnResult==='fallback')CF.toast(L('We have returned you to the asset marketplace.','已为你回到资产广场。'));
    }
    if(message)CF.toast(message);
  }

  /* ---------------------------------------------------------------- 动作归属分流 */
  function triggerAction(kind){
    D.origin=CF.ENTRY[S.page]||'/demo/login/actions';D.originAction=kind;
    if(S.role==='guest'){startLogin(kind);return;}
    if(S.role==='signed'){
      D.originAction='';
      if(kind==='financing')open('upstream');
      else enterFunderOnboarding();
      return;
    }
    D.originAction='';
    if(kind==='funding'){
      if(S.role==='fund'){D.reviewMessage=L('Funding actions continue in the funder account module.','出资与报价动作由资金方账户模块承接。');S.demo=true;CF.render();}
      else open('role-mismatch');
      return;
    }
    if(S.role!=='asset'){open('role-mismatch');return;}
    if(D.level!=='L3'){open('guide');return;}
    runGate();
  }
  /* 资产方唯一硬卡点：发起融资申请前实时确认资格，旧快照不放行。 */
  function runGate(){
    D.gateState='pending';CF.render();
    later(()=>{
      if(S.role!=='asset'){D.gateState='idle';CF.render();return;}
      if(D.level!=='L3'){D.gateState='idle';open('guide');return;}
      if(D.verificationResult==='failed')D.gateState='failed';
      else if(D.verificationResult==='unverified'){D.level='L0';D.downgraded=true;D.gateState='idle';open('guide');}
      else D.gateState='ready';
      CF.render();
    });
  }
  function enterFunderOnboarding(){
    if(CF.funder?.onboard){S.layer=null;CF.funder.onboard(D.address);return;}
    D.reviewMessage=L('Funder onboarding is delivered by the funder account module.','资金方入驻流程由资金方账户模块交付。');S.demo=true;CF.render();
  }

  /* ---------------------------------------------------------------- 常驻提醒 */
  function notices(){
    if(S.role==='fund'&&CF.funder){CF.funder.notices();return;}
    if(S.role!=='asset'){CF.setCompletion([]);return;}
    const items=[];
    if(D.rejected)items.push({priority:1,text:L('Your verification was not approved. Review the reasons on the asset trust platform and resubmit.','你的实名认证未通过，请前往资产可信平台查看原因并重新提交。'),label:L('Complete now','立即前往'),act:'login-leave',value:'verify'});
    else if(D.level!=='L3')items.push({priority:2,text:L('Complete identity verification on the asset trust platform to unlock financing.','在资产可信平台完成实名认证后即可使用融资功能。'),label:L('Complete now','立即前往'),act:'login-leave',value:'verify'});
    if(D.downgraded)items.push({priority:4,text:L('Your verification status has changed; financing features are temporarily unavailable.','你的实名认证状态已变更，融资相关功能暂时不可用。'),label:L('View status','查看状态'),act:'login-account'});
    // 纯组件样例队列，不借此定义业务文案。
    if(D.extraNotices){
      [1,2,3,4].forEach(n=>items.push({priority:n,text:L(`Component demo: pending item ${n}`,`组件演示：待完成事项 ${n}`),label:L('Resolve demo item','完成演示项'),act:'login-resolve',value:String(n)}));
      D.resolved?.forEach(n=>{const i=items.findIndex(x=>x.value===n&&x.act==='login-resolve');if(i>=0)items.splice(i,1);});
    }
    CF.setCompletion(items);
  }

  /* ---------------------------------------------------------------- 账户与企业信息 */
  function identityFields(fields){return `<dl class="login-fields login-identity-fields">${fields.filter(f=>f[2]!==''&&f[2]!=null).map(f=>`<div><dt>${L(f[0],f[1])}</dt><dd>${esc(f[2])}</dd></div>`).join('')}</dl>`;}
  function sourceLink(view=false){return `<div class="detail-actions">${link(view?'View on the asset trust platform ↗':'Update on the asset trust platform ↗',view?'前往资产可信平台查看 ↗':'前往资产可信平台修改 ↗','login-leave',view?'company':'account')}</div>`;}
  function unavailable(){
    return (D.sessionMessage?CF.note('warn',esc(D.sessionMessage)):'')+
      CF.empty(L('This page is not available for your current role','该页面不适用于当前身份'),L('You can continue exploring public information.','你可以继续浏览公开信息。'),btn('Back to assets','返回资产广场','login-home'));
  }
  function personalFields(){return identityFields([
    ['Name','姓名',D.profileVariant===1?'演示用户甲':'演示用户乙'],['English name','英文姓名',D.profileOptionalMissing?'':D.profileVariant===1?'Demo Person A':'Demo Person B'],
    ['Nationality','国籍',L('China','中国')],['Document type','证件类型',L('Passport','护照')]
  ]);}
  function accountPage(){
    if(S.role!=='asset')return unavailable();
    const account=boundAccount(),address=D.address||registered;
    const identity=profileBody('accountState',identityFields([
      ['Wallet address in use','本次登录钱包地址',address],
      ['Wallet binding','钱包地址绑定',L('Linked','已绑定')+' · '+L('Synced','最近同步')+' '+CF.fmtTime(D.syncedAt)],
      ['User ID','用户 ID',account.userId],['Company ID','企业 ID',account.companyId],['Email','邮箱',account.email]
    ]),['No account information available','暂无账户信息']);
    const personal=profileBody('personalState',personalFields(),['No personal verification information available','暂无个人认证信息']);
    return `<div class="login-account"><div class="page-head"><div><h1 class="page-title">${L('Account settings','账户设置')}</h1><p class="page-desc">${L('View your information and manage your preferences.','查看账户资料，管理偏好设置。')}</p></div></div>
      <p class="login-caption">${L('This information is maintained by the asset trust platform.','这些信息由资产可信平台维护。')}</p>
      <div class="detail-stack"><section class="card detail-section"><div class="card-head"><h2>${L('Account information','账户信息')}</h2></div><div class="card-b">${identity}
      <div class="login-row"><span>${L('Verification','实名认证')}</span><div class="detail-actions login-verification">${CF.tag(D.level==='L3'?'ok':D.rejected?'danger':'warn',D.rejected?L('Not approved','认证未通过'):D.level==='L3'?L('Verified','已认证'):L('Not verified','未认证'))}${D.level!=='L3'?link('Complete verification ↗','前往完成认证 ↗','login-leave','verify'):''}</div></div>${sourceLink()}</div></section>
      <section class="card detail-section"><div class="card-head"><h2>${L('Personal information','个人信息')}</h2></div><div class="card-b">${personal}${sourceLink()}</div></section>
      <section class="card detail-section"><div class="card-head"><h2>${L('Preferences','偏好设置')}</h2></div><div class="card-b login-stack">
      <div class="field login-preference-field"><label for="login-language">${L('Language preference','语言偏好')}</label><select class="inp" id="login-language" aria-describedby="login-language-feedback" ${D.preferenceState.language==='pending'?'disabled aria-busy="true"':''}><option value="en" ${D.preferredLang==='en'?'selected':''}>English</option><option value="zh" ${D.preferredLang==='zh'?'selected':''}>简体中文</option></select><div id="login-language-feedback">${preferenceFeedback()}</div></div>
      <p class="login-caption">${L('Critical notifications, including verification changes, are always received.','认证等关键通知始终接收。')}</p>
      </div></section></div>${demoStamp()}</div>`;
  }
  const companyGuidance={
    none:['Complete your company information on the asset trust platform.','请前往资产可信平台完善企业信息。'],
    pending:['Check your verification status on the asset trust platform.','请前往资产可信平台查看认证状态。'],
    verified:['This information is read-only. Update it on the asset trust platform.','资料只读不可修改，如需修改请前往资产可信平台。']
  };
  function companyPage(){
    if(S.role!=='asset')return unavailable();
    const account=boundAccount();
    const info=D.companyCase==='none'?CF.empty(L('No company verification information available','暂无企业认证信息'),'',''):identityFields([
      ['Company ID','企业 ID',account.companyId],
      ['Company name','企业名称',D.profileVariant===1?'演示企业甲':'演示企业乙'],
      ['English company name','企业英文名称',D.profileOptionalMissing?'':D.profileVariant===1?'Demo Company A':'Demo Company B'],
      ['Country or region of incorporation','企业注册地',L('Hong Kong, China','中国香港')],
      ['Registered address','注册地址',L('Demonstration address · Unit A, Demo Building, Hong Kong','演示地址 · 中国香港示例大厦 A 室')],
      ['Company Registration Number (CR)','公司注册编号（CR）','DEMO-CR-'+D.profileVariant+'0001'],
      ['Relationship to the company','与企业的关系',L('Authorised representative','授权代表')]
    ]);
    return `<div class="login-account"><div class="page-head"><div><h1 class="page-title">${L('Company information','企业信息')}</h1><p class="page-desc">${L('This information is maintained by the asset trust platform.','这些信息由资产可信平台维护。')}</p></div></div>
      <section class="card detail-section"><div class="card-head"><h2>${L('Company details','企业基本信息')}</h2></div><div class="card-b">${profileBody('companyState',info,['No company verification information available','暂无企业认证信息'])}
      <p class="login-caption">${L(...companyGuidance[D.companyCase])}</p>
      ${sourceLink(D.companyCase!=='verified')}</div></section>${demoStamp()}</div>`;
  }

  /* ---------------------------------------------------------------- 演示落点 */
  function actionRow(kind,title,desc,allowed,reason){
    const label=L(...actionCopy[kind]);
    return `<div class="login-public-row"><div><h2>${esc(title)}</h2><p>${esc(desc)}</p></div>
      ${allowed?`<button type="button" class="btn primary" data-act="login-action" data-v="${kind}" ${D.gateState==='pending'&&kind==='financing'?'disabled aria-busy="true"':''}>${D.gateState==='pending'&&kind==='financing'?L('Checking eligibility…','正在确认资格…'):esc(label)}</button>`:
      `<div><button type="button" class="login-limit" data-act="login-action" data-v="${kind}" aria-disabled="true" aria-describedby="login-reason-${kind}"><span aria-hidden="true">⊘</span>${esc(label)}</button><p id="login-reason-${kind}" class="login-caption">${esc(reason)}</p></div>`}</div>`;
  }
  function gatePage(){
    const roleTag=S.role==='guest'?L('Guest','游客'):S.role==='signed'?L('Signed in · no role bound','已登录未绑定角色'):
      S.role==='fund'?L('Funder','资金方'):D.level==='L3'?L('Verified asset holder','已认证资产方'):L('Asset holder · not verified','未认证资产方');
    const assetReason=S.role==='guest'?L('Sign in to continue.','登录后继续。'):
      S.role==='signed'?L('This requires registration and verification on the asset trust platform.','该功能需要先在资产可信平台完成注册与认证。'):
      S.role==='fund'?L('This action is for asset holders.','该动作面向资产方。'):
      L('Complete identity verification to use financing.','完成实名认证后可使用融资功能。');
    const fundReason=S.role==='guest'?L('Sign in to continue.','登录后继续。'):
      S.role==='signed'?L('Apply to become a funder to use this feature.','申请成为资金方后即可使用该功能。'):
      S.role==='asset'?L('This action is for funders.','该动作面向资金方。'):L('Your institution registration must be approved first.','机构注册审核通过后可使用。');
    return `<div class="login-public"><div class="page-head"><div><h1 class="page-title">${L('Business actions','业务动作')}</h1><p class="page-desc">${L('Demonstration page · sample data','演示页 · 演示数据')}</p></div>${CF.tag(S.role==='asset'&&D.level==='L3'?'ok':'gray',roleTag)}</div>
      <section class="card"><div class="card-b">
      ${actionRow('financing',L('Financing request','融资申请'),L('Use your receivables to apply for financing.','以应收账款申请融资。'),S.role==='asset'&&D.level==='L3',assetReason)}
      ${actionRow('funding',L('Funding and credit quotes','出资与授信报价'),L('Provide capital against a listed financing request.','对已发布的融资需求出资或报价。'),S.role==='fund',fundReason)}
      ${D.gateState==='failed'?CF.note('red',L('Could not confirm eligibility. No request was started. Please retry.','暂时无法确认资格，尚未发起申请，请重试。')):''}
      ${D.gateState==='ready'?CF.note('accent',L('Eligibility confirmed. You can continue with your financing request.','资格已确认，可继续填写融资申请。')):''}
      </div></section>${D.sessionMessage?CF.note('warn',esc(D.sessionMessage)):''}${demoStamp()}</div>`;
  }

  /* ---------------------------------------------------------------- 页面路由 */
  function content(id){
    syncIdentity();
    if(id==='P-L14'&&S.role==='fund'){queueMicrotask(()=>{go('/assets');CF.toast(L('This page is not available for your current role','该页面不适用于当前身份'));});return '';}
    if(id==='P-L12'&&S.role==='fund'){queueMicrotask(()=>go('/funder/account'));return '';}
    if(CF.funder){const own=CF.funder.content(id);if(own!==undefined){queueMicrotask(postRender);return own;}}
    notices();queueMicrotask(postRender);
    switch(id){
      case 'P-L01':return loginPage();
      case 'P-L04':return `<div class="login-flow"><div class="login-status-icon" aria-hidden="true">!</div><h1 class="page-title">${L('Unable to continue right now','暂时无法继续')}</h1><p>${L('Please try again or keep browsing. Reference: HC-100.','请重试或继续浏览。参考码：HC-100。')}</p><div class="login-actions">${btn('Try again','重试','login-start','','primary')}${btn('Keep browsing','继续浏览','login-exit')}</div></div>`;
      case 'P-L10':return `<div class="login-flow login-center"><div class="login-status-icon" aria-hidden="true">↻</div><h1 class="page-title">${L('Matching your account','正在匹配账户')}</h1><p role="status" aria-live="polite">${L('Signature verified. We are checking this address against the asset trust platform.','签名已验证，正在用该地址与资产可信平台的同步数据匹配。')}</p>${CF.skelTable(2)}<div class="login-bottom">${link('Keep browsing','继续浏览','login-exit')}</div></div>`;
      case 'P-L13':return `<div class="login-flow"><div class="login-status-icon" aria-hidden="true">!</div><h1 class="page-title">${L('Account setup was interrupted','账户建立未完成')}</h1><p>${L('Your address was matched, but we could not finish setting up your account. Please retry.','地址已匹配，但账户暂未建立完成，请重试。')}</p><p class="mono">HC-241</p><div class="login-actions">${btn('Retry','重试','login-retry-account','','primary')}${btn('Keep browsing','继续浏览','login-exit')}</div></div>`;
      case 'P-L12':return accountPage();
      case 'P-L14':return companyPage();
      case 'DEMO-L-GATE':return gatePage();
      default:return unavailable();
    }
  }

  /* ---------------------------------------------------------------- 弹层 */
  function open(key,data){
    if(!S.layer){const a=document.activeElement;D.focusBack=a&&a.getAttribute?{act:a.getAttribute('data-act'),value:a.getAttribute('data-v'),id:a.id}:null;}
    const under=key==='leave'&&['guide','upstream'].includes(S.layer?.key)?S.layer:null;
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
  const layers={
    connect:()=>({title:L('Wallet connection · simulation','钱包连接 · 演示'),
      html:`<p>${L('Choose the address to sign in with. Connecting alone does not sign you in.','请选择本次登录使用的地址；仅连接不等于登录成功。')}</p>
        <div class="login-address-list">
        <button type="button" class="login-address" data-act="login-address" data-v="${registered}"><span class="mono">${esc(registered)}</span><span class="login-caption">${L('Demo address A','演示地址 A')}</span></button>
        <button type="button" class="login-address" data-act="login-address" data-v="${unregistered}"><span class="mono">${esc(unregistered)}</span><span class="login-caption">${L('Demo address B','演示地址 B')}</span></button>
        <button type="button" class="login-address" data-act="login-address" data-v="${renewed}"><span class="mono">${esc(renewed)}</span><span class="login-caption">${L('Demo address C','演示地址 C')}</span></button>
        </div><p class="login-caption">${L('Demonstration addresses. No wallet is contacted.','演示地址，不连接真实钱包。')}</p>`,
      foot:btn('Cancel','取消','login-connect-cancel','','ghost')}),
    signature:()=>({title:L('Wallet signature · simulation','钱包签名 · 演示'),
      html:`<p>${L('Confirm the login signature in your wallet.','请在钱包中确认本次登录签名。')}</p><p class="mono">${esc(shortAddress(D.address))}</p>
        <p class="login-caption">${L('This message does not send a transaction or authorize assets.','本次签名不会发起交易或授权资产。')}</p>`,
      foot:btn('Decline signature','拒绝签名','login-sign','rejected','ghost')+btn('Signature verification fails','签名验证失败','login-sign','failed','ghost')+btn('Confirm signature','确认签名','login-sign','ok','primary')}),
    leave:(purpose)=>({title:L('You are leaving the lending platform','即将离开借贷平台'),
      html:`<p>${L('You will be redirected to the asset trust platform to continue.','我们将带你前往「资产可信平台」继续操作。')}</p><p><b>${L('Asset trust platform','资产可信平台')}</b></p>`,
      foot:btn('Cancel','返回','closelayer','','ghost')+btn('Continue','继续前往','login-depart',purpose,'primary')}),
    upstream:()=>({title:L('Register on the asset trust platform','前往资产可信平台注册'),
      html:`<p>${L('This requires registration and verification on the asset trust platform.','该功能需要先在资产可信平台完成注册与认证。')}</p>`,
      foot:btn('Cancel','返回','closelayer','','ghost')+btn('Go to asset trust platform','前往资产可信平台','login-leave','register','primary')}),
    guide:()=>({title:L('Complete identity verification','完成实名认证'),
      html:`<p>${D.rejected?L('Your verification was not approved. Review the reasons on the asset trust platform and resubmit.','你的实名认证未通过，请前往资产可信平台查看原因并重新提交。'):L('Complete identity verification on the asset trust platform to submit a financing request.','在资产可信平台完成实名认证后即可发起融资申请。')}</p>`,
      foot:btn('Cancel','返回','closelayer','','ghost')+btn('Go to asset trust platform','前往资产可信平台','login-leave','verify','primary')}),
    'role-mismatch':()=>({title:L('Not available for this account','该动作不适用于当前账户'),
      html:`<p>${L('One wallet address is linked to one role. Sign in with the wallet of the other role to use this action.','一个钱包地址只绑定一个角色，请用另一角色的钱包登录后使用该动作。')}</p>`,
      foot:btn('Close','关闭','closelayer','','primary')}),
    notification:()=>({title:L('Account notification','账户通知'),
      html:`<p>${D.downgraded?L('Your verification status has changed; financing features are temporarily unavailable.','你的实名认证状态已变更，融资相关功能暂时不可用。'):L('No new notifications.','暂无新通知。')}</p>${demoStamp()}`,
      foot:btn('Close','关闭','closelayer')}),
    support:()=>({title:L('Asset trust platform support','资产可信平台客服'),
      html:`<p>${L('Please contact support through the asset trust platform and provide reference HC-204.','请通过资产可信平台联系客服，并提供参考码 HC-204。')}</p>`,
      foot:btn('Close','关闭','closelayer')})
  };

  /* ---------------------------------------------------------------- 动作 */
  function action(act,v){
    if(CF.funder&&CF.funder.action(act,v))return true;
    if(!act.startsWith('login-'))return false;
    switch(act){
      case 'login-start':startLogin(D.originAction);break;
      case 'login-connect':connectWallet();break;
      case 'login-connect-cancel':S.layer=null;D.stage='';D.loginError='cancel';go('/login');break;
      case 'login-address':addressChosen(v);break;
      case 'login-sign':signatureDone(v);break;
      case 'login-retry-account':D.matchOverride='auto';D.stage='matching';go('/auth/return');later(()=>applyMatch());break;
      case 'login-home':go('/');break;
      case 'login-exit':{const origin=D.origin;resetSession();go(/^\/(auth|login)/.test(origin)?'/':origin);break;}
      case 'login-leave':open('leave',v||'verify');break;
      case 'login-depart':
        S.layer=null;D.handoff='asset';S.demo=true;
        D.reviewMessage=L('External handoff: asset trust platform. The destination is not configured; simulate the outcome below.','已到资产可信平台离站边界；目标域名尚未登记，可在下方模拟结果。');break;
      case 'login-action':triggerAction(v);break;
      case 'login-account':go(S.role==='fund'?'/funder/account':'/account');break;
      case 'login-signout':endSession('logout');break;
      case 'login-profile-retry':if(['accountState','personalState','companyState'].includes(v))D[v]='idle';break;
      case 'login-company':{const parent=pages[S.page]?'P-F-AM-01':S.page;CF.PAGES['P-L14'].parent=parent;D.companyOrigin=pages[S.page]?'/assets':location.hash.slice(1);D.companyState='idle';go('/account/company');break;}
      case 'login-enterprise-account':
        D.reviewMessage=L('Payout and funding accounts are delivered by the enterprise account module.','收款 / 出资账户由企业账户模块交付。');S.demo=true;S.menu=null;break;
      case 'login-support':open('support');break;
      case 'login-resolve':(D.resolved||(D.resolved=[])).push(v);break;
      case 'login-handoff':
        D.reviewMessage=L('This destination belongs to the '+v+' module; its pages are outside this delivery.','此入口交接至 '+v+' 模块，页面不在本次交付范围内。');S.demo=true;break;
      case 'login-demo':demoAction(v);break;
      default:return false;
    }
    return true;
  }

  /* ---------------------------------------------------------------- 评审工具 */
  function demoAction(v){
    D.reviewMessage='';
    switch(v){
      case 'guest':resetSession();D.sessionMessage='';break;
      case 'signed':cancelPending();S.role='signed';D.address=unregistered;D.level='L0';D.sessionMessage='';break;
      case 'asset':cancelPending();S.role='asset';D.address=registered;D.sessionMessage='';loadPreferences();break;
      case 'L0':D.level='L0';break;
      case 'L3':D.level='L3';D.downgraded=false;D.rejected=false;break;
      case 'gate':go('/demo/login/actions');S.demo=false;break;
      case 'sign-in':startLogin('');S.demo=false;break;
      case 'return-valid':D.returnResult='valid';break;
      case 'address-changed-online':
        if(S.role==='asset'){D.addressMoved=true;S.demo=false;endSession('wallet-change');}
        else CF.toast(L('No asset holder session is active right now.','当前没有资产方登录态可终止。'));break;
      case 'address-changed-offline':D.addressMoved=true;D.matchOverride='moved';CF.toast(L('The next sign-in with demo address A will not match.','下次用演示地址 A 登录将匹配不到。'));break;
      case 'address-restored':D.addressMoved=false;D.matchOverride='auto';break;
      case 'upstream-logout':
        CF.toast(S.role==='guest'?L('You signed out on the asset trust platform.','你已在资产可信平台登出。'):
          L('You signed out on the asset trust platform. Your sign-in here continues.','你已在资产可信平台登出，本平台登录继续有效。'));break;
      case 'expiry':S.demo=false;endSession('expiry');break;
      case 'blocked':S.demo=false;endSession('blocked');break;
      case 'downgrade':if(S.role==='asset'){D.level='L0';D.downgraded=true;}S.demo=false;break;
      case 'refresh':if(S.role==='asset'){D.level='L3';D.downgraded=false;D.rejected=false;}S.demo=false;break;
      case 'invalid-status':if(S.role==='asset'){D.level='L0';D.reviewMessage=L('An unknown upstream status is conservatively shown as not verified.','未知上游状态按未认证保守展示。');}break;
      case 'rejected':D.rejected=!D.rejected;if(D.rejected)D.level='L0';break;
      case 'missing':D.missing=!D.missing;break;
      case 'notice-queue':D.extraNotices=!D.extraNotices;D.resolved=[];break;
      case 'account-loading':D.accountState='loading';go('/account');break;
      case 'account-error':D.accountState='error';go('/account');break;
      case 'account-ready':D.accountState='default';go('/account');break;
      case 'profile-other':cancelPending();D.profileVariant=D.profileVariant===1?2:1;D.missing=false;break;
      case 'profile-optional':D.profileOptionalMissing=!D.profileOptionalMissing;break;
      case 'profile-write':CF.toast(L('This information is read-only. Update it on the asset trust platform.','这些资料为只读，请前往资产可信平台修改。'));break;
      case 'personal-empty':D.personalState='empty';go('/account');break;
      case 'personal-error':D.personalState='error';go('/account');break;
      case 'personal-ready':D.personalState='idle';go('/account');break;
      case 'company-none':D.companyCase='none';D.companyState='idle';go('/account/company');break;
      case 'company-pending':D.companyCase='pending';D.companyState='idle';go('/account/company');break;
      case 'company-verified':D.companyCase='verified';D.companyState='idle';go('/account/company');break;
      case 'company-error':D.companyState='error';go('/account/company');break;
      case 'main-failure':resetSession();S.demo=false;go('/login/unavailable');break;
    }
  }
  function options(id,title,values,selected){return `<div class="field"><label for="${id}">${title}</label><select class="inp" id="${id}">${values.map(a=>`<option value="${a[0]}" ${selected===a[0]?'selected':''}>${L(a[1],a[2])}</option>`).join('')}</select></div>`;}
  function demoPanel(){
    if(!S.demo)return;
    CF.review.setTools(`<div class="grp"><h5>${L('Review tools · simulation only','评审工具 · 仅模拟')}</h5><p class="login-caption">${L('Simulated data only. Upstream profile fields and delivery of pushed changes are provisional; no real wallet, signature or upstream integration.','仅模拟资料。上游基本信息字段与变更推送仍暂定，未接入真实钱包、签名或上游系统。')}</p>
      ${D.reviewMessage?CF.note('accent',esc(D.reviewMessage)):''}
      ${D.handoff==='asset'?`<div class="seg">${btn('Simulate return','模拟返回','login-demo','sign-in')}${btn('Return without changes','原样返回','login-demo','gate')}</div>`:''}</div>
      <div class="grp"><h5>${L('Sign-in state','登录状态')}</h5><div class="seg">${btn('Guest','游客','login-demo','guest')}${btn('Signed in · no role bound','登录未绑定角色','login-demo','signed')}${btn('Asset holder','资产方','login-demo','asset')}${btn('Not verified','未认证','login-demo','L0')}${btn('Verified','已认证','login-demo','L3')}</div>
      <p class="login-caption">${L('Current','当前')}：${S.role}${S.role==='asset'?' / '+D.level:''}</p>
      ${btn('Open the sign-in flow','打开登录流程','login-demo','sign-in')}${btn('Open business action demo','打开业务动作演示页','login-demo','gate')}</div>
      ${options('demo-wallet',L('Wallet availability','钱包可用性'),[['ok','Wallet available','钱包可用'],['missing','No wallet available','无可用钱包']],D.walletResult)}
      ${options('demo-match',L('Match result','匹配结果'),[['auto','Follow the chosen address','按所选地址判定'],['hit','Hit · bind asset holder','命中 · 绑定资产方'],['moved','Registered address changed','上游登记地址已变更'],['locked','Upstream account locked or disabled','上游账户锁定 / 禁用'],['create-failed','Account creation failed','建号失败'],['multi','Data anomaly · multiple accounts','数据异常 · 命中多个账户']],D.matchOverride)}
      ${options('demo-verify',L('Verification conclusion','认证结论'),[['verified','Verified','已认证'],['unverified','Not verified','未认证'],['failed','Temporarily unavailable','暂时无法复核']],D.verificationResult)}
      ${options('demo-return',L('Return result','回跳结果'),[['fallback','Cross-platform fallback','跨平台兜底'],['none','No original action','无原操作'],['invalid','Expired or rejected target','目标失效或被拒']],D.returnResult)}
      ${options('demo-submit',L('Preference save result','偏好保存结果'),[['success','Success','成功'],['failed','Failure · allow retry','失败 · 可重试']],D.submitResult)}
      <div class="grp"><h5>${L('Upstream changes and session','上游变更与会话')}</h5><div class="seg">${btn('Registered address changed (online)','登记地址变更（在线）','login-demo','address-changed-online')}${btn('Registered address changed (offline)','登记地址变更（离线）','login-demo','address-changed-offline')}${btn('Restore registration','恢复登记','login-demo','address-restored')}${btn('Upstream sign-out','上游普通退出','login-demo','upstream-logout')}${btn('Sign-in expired','登录到期','login-demo','expiry')}${btn('Upstream account unavailable','上游账户不可用','login-demo','blocked')}</div></div>
      <div class="grp"><h5>${L('Verification and reminders','认证与提示条')}</h5><div class="seg">${btn('Downgrade','认证降级','login-demo','downgrade')}${btn('Refresh: verified','刷新为已认证','login-demo','refresh')}${btn('Unknown status','未知状态','login-demo','invalid-status')}${btn('Toggle rejected copy','切换驳回文案','login-demo','rejected')}${btn('Reminder queue','提示条队列','login-demo','notice-queue')}</div></div>
      <div class="grp"><h5>${L('Profile states','资料状态')}</h5><div class="seg">${btn('Account loading','账户加载中','login-demo','account-loading')}${btn('Account load failed','账户加载失败','login-demo','account-error')}${btn('Account ready','账户正常','login-demo','account-ready')}${btn('Toggle missing fields','切换字段缺失','login-demo','missing')}${btn('Optional field absent','可选字段缺失','login-demo','profile-optional')}${btn('Another account','另一账户','login-demo','profile-other')}${btn('Read-only rejection','只读拒绝','login-demo','profile-write')}${btn('Personal: empty','个人资料为空','login-demo','personal-empty')}${btn('Personal: error','个人资料失败','login-demo','personal-error')}${btn('Personal: ready','个人资料重新读取','login-demo','personal-ready')}</div></div>
      <div class="grp"><h5>${L('Company information cases','企业信息三种情况')}</h5><div class="seg">${btn('No company linked','无企业归属','login-demo','company-none')}${btn('Verification pending','认证未通过 / 审核中','login-demo','company-pending')}${btn('Verified','已认证','login-demo','company-verified')}${btn('Load failed','读取失败','login-demo','company-error')}</div></div>
      <div class="grp"><h5>${L('Entry and fallback','入口与兜底')}</h5><div class="seg">${btn('Main flow unavailable','主干不可继续','login-demo','main-failure')}</div></div>`);
  }

  /* ---------------------------------------------------------------- 渲染衔接 */
  let priorLayer=false, renderedPage=null, identityKey='';
  function syncIdentity(){
    const key=S.role==='asset'?boundAccount().userId:S.role;
    if(key===identityKey)return;identityKey=key;cancelPending();
    D.accountState='default';D.personalState=D.companyState='idle';
    if(S.role==='asset'){if(!D.address)D.address=registered;loadPreferences();}
    if(S.role==='signed'&&!D.address)D.address=unregistered;
  }
  function postRender(){
    if(D.pendingTrigger&&!S.layer){const kind=D.pendingTrigger;D.pendingTrigger='';setTimeout(()=>triggerAction(kind),0);}
    if(renderedPage!==S.page){if(pages[S.page]||/^P-L2|^DEMO-F-/.test(S.page))window.scrollTo(0,0);renderedPage=S.page;}
    const foot=$('foot');
    if(pages[S.page]||/^P-L2|^DEMO-F-/.test(S.page))foot.innerHTML=`<div class="ft-in"><div class="ft-mark">Harbour Credit</div><p class="ft-tag">${L('Receivables and financing, connected.','连接应收账款与融资需求。')}</p><div class="ft-links">${link('About','平台介绍','login-handoff','about')}${link('FAQ','常见问题','login-handoff','faq')}${link('Agreements','协议','login-handoff','agreement')}</div><div class="ft-meta">${L('Lending platform','借贷平台')}</div></div>`;
    if(D.sessionMessage&&!pages[S.page]&&!$('login-session-notice'))$('content').insertAdjacentHTML('afterbegin',`<div id="login-session-notice">${CF.note('warn',esc(D.sessionMessage))}</div>`);
    const focusfoot=document.querySelector('.focus-foot');focusfoot.textContent=L('Harbour Credit · Lending platform','Harbour Credit · 借贷平台');
    // 对底座既有入口补上本模块动作，仍由公共层渲染导航、语言及账户下拉。
    document.querySelectorAll('[data-act="signin"]').forEach(x=>x.dataset.act='login-start');
    document.querySelectorAll('[data-act="toast"]').forEach(x=>{
      const v=x.dataset.v;if(v==='apply')x.dataset.act='login-start';
      else if(v==='acct')x.dataset.act='login-account';
      else if(v==='notify')x.dataset.act='login-notifications';
      else if(v==='entacct')x.dataset.act='login-enterprise-account';
      else if(v==='inst'&&S.role==='asset')x.dataset.act='login-company';
    });
    const badge=document.querySelector('#tools .badge');if(badge&&!CF.portalConnected){if(D.downgraded)badge.textContent='1';else badge.remove();}
    document.querySelector('#focus .brand')?.setAttribute('href','#/assets');
    if(!CF.portalConnected||pages[S.page]||/^P-L2|^DEMO-F-/.test(S.page))demoPanel();
    if(CF.funder)CF.funder.afterRender();
    const dialog=document.querySelector('#layers > .modal-mask [role="dialog"], #layers > [role="dialog"]');
    if(dialog){
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

  CF.review.register('P-L01',{
    group:['Sign-in and account','登录与账户'],aliases:['P-L04','P-L10','P-L13'],
    states:[{id:'default',label:['Default','默认'],group:'feedback'},
      {id:'wallet',label:['No wallet available','钱包不可用'],group:'feedback'},
      {id:'cancel',label:['Connection cancelled','连接取消'],group:'feedback'},
      {id:'sign-rejected',label:['Signature declined','拒绝签名'],group:'feedback'},
      {id:'sign-failed',label:['Signature verification failed','签名验证失败'],group:'feedback'}],
    get:()=>S.page==='P-L01'?(D.loginError||'default'):'flow',
    set(value){D.loginError=value==='default'?'':value;if(S.page!=='P-L01')go('/login');},
    reset(){D.loginError='';D.handoff='';D.stage='';},route:'/login'
  });
  ['P-L12','P-L14'].forEach(id=>CF.review.register(id,{
    group:['Asset holder account','资产方账户'],
    states:()=>S.role==='asset'?['default','loading','empty','error']:['default'],
    get:()=>id==='P-L12'?(D.accountState==='loading'?'loading':['idle','ready'].includes(D.personalState)?'default':D.personalState):
      (['idle','ready'].includes(D.companyState)?(D.companyCase==='none'?'empty':'default'):D.companyState),
    set(value){cancelPending();
      if(id==='P-L12'){D.accountState=value==='loading'?'loading':'default';D.personalState=value==='default'?'idle':value;}
      else if(value==='empty'){D.companyCase='none';D.companyState='idle';}
      else {if(value==='default')D.companyCase='verified';D.companyState=value==='default'?'idle':value;}},
    reset(){cancelPending();D.accountState='default';D.personalState=D.companyState='idle';}
  }));

  CF.define(CF.AccountView={id:'login-account',dict,content,layers,onAct:action,
    breadcrumbRoute(id){return S.page==='P-L14'&&id===CF.PAGES['P-L14'].parent?D.companyOrigin:null;},
    // 组合只承接已有页面：资产广场及其既有项目链接保持单一实现。
    ...(CF.AM ? {pages:[...Object.keys(pages),'P-L21','P-L22','P-L23','DEMO-F-GATE',...(!CF.MC?['P-MC-01']:[])],
      beforeRender(){
        syncIdentity();notices();queueMicrotask(postRender);
        CF.LSView?.beforeRender?.();
      },
      afterRender(){CF.LSView?.afterRender?.();},
      onBeforeAct(act,v,e){return CF.LSView?.onBeforeAct?.(act,v,e);}
    }: {})});

  // 登录域优先接管底座的样例登录/退出动作；路由与浮层仍使用 CF。
  document.addEventListener('click',e=>{
    const el=e.target.closest('[data-act]');
    if(el){const a=el.dataset.act;
      // 受限动作只打开引导或登录，不执行业务；先于公共禁用动作守卫处理。
      if(a==='login-action'&&el.getAttribute('aria-disabled')==='true'){
        e.preventDefault();e.stopImmediatePropagation();triggerAction(el.dataset.v);CF.render();return;
      }
      if(a==='login-start'||a==='signin'||(CF.AM&&a==='deeplink'&&el.dataset.v==='cta'&&S.role==='guest')){
        e.preventDefault();e.stopImmediatePropagation();
        D.origin=CF.ENTRY[S.page]||'/';if(CF.portalConnected)CF.portalLoginReturn=location.hash;
        D.returnResult='none';startLogin('');return;
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
    if(id==='login-language')savePreference(v);
    else if(id==='demo-wallet')D.walletResult=v;
    else if(id==='demo-match')D.matchOverride=v;
    else if(id==='demo-verify')D.verificationResult=v;
    else if(id==='demo-return')D.returnResult=v;
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
    if(D.timerRoute&&D.timerRoute!==location.hash)cancelPending();
    if(location.hash!=='#/account')cancelPreferences();
    if(D.profileReadRoute!==location.hash)cancelProfileReads();
  });
  try{localStorage.removeItem('lp_last_role');localStorage.removeItem('lp_last_role_at');}catch(e){}
  // 双击默认为游客壳；登录只有主动点击或受限操作才出现。
  if(!location.hash&&!CF.deferBoot)location.hash='#/assets';
  if(!CF.deferBoot)CF.boot();
})(window.CF);
