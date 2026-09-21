/* WS-349: funds-side extension of the shared login module.
 * All provider, email, institution-template and review responses are local simulations.
 * No signature, account, message, upload or server security operation is performed. */
(function(CF){
  'use strict';
  const S=CF.S,L=CF.L,esc=CF.esc,$=id=>document.getElementById(id);
  const address='0x1111111111111111111111111111111111111111',other='0x2222222222222222222222222222222222222222';
  const pages={
    'P-L20':['focus','/funder/sign','Confirm and sign','确认并签名'],
    'P-L21':['portal','/funder/register','Institution registration','机构注册'],
    'P-L22':['portal','/funder/status','Registration status','注册状态'],
    'P-L23':['portal','/funder/account','Account settings','账户设置'],
    'DEMO-F-GATE':['portal','/demo/funder/action','Funding access · demo','出资权限 · 演示页']
  };
  const dict={en:{},zh:{}};
  Object.entries(pages).forEach(([id,p])=>{CF.PAGES[id]={end:'asset',layout:p[0],navKey:id,auth:['P-L21','P-L22','P-L23'].includes(id)};CF.ENTRY[id]=p[1];dict.en[id]=p[2];dict.zh[id]=p[3];});
  const blank=()=>({exists:false,address,created:null,email:'',status:'draft',disabled:false,step:1,form:{name:'',country:'',identifierType:'',identifier:'',institutionType:'',registeredAddress:'',regulator:'',license:'',contact:'',file:'',fileSize:0,fileStatus:''},submitted:null,reviewed:null,history:[],version:0});
  const F={account:blank(),accounts:{},connected:'',signState:'A',consent:false,submitConsent:false,change:false,
    busy:'',error:null,entryError:null,fieldErrors:{},otp:null,emailInput:'',codeInput:'',reauthUntil:0,
    emailStage:'auth',connectionOrigin:'entry',signPurpose:'login',signatureResult:'success',connectionResult:'success',
    saveResult:'success',emailResult:'success',template:'ready',load:'ready',upload:'idle',providerMode:'single',
    sessionUntil:0,returnTo:'',replayed:0,gate:'idle',contract:null,signatureStarted:0,challenge:0,historyVersion:0,
    uploadVersion:0,preferenceState:'',savedPreferences:null,storageFailed:false,downgrade:false,latestCode:'123456',sends:{},pendingSubmission:false,emailFlow:false,first:false,notes:[],generation:0,layerOpen:false,focusBack:null};
  function read(){try{F.accounts=JSON.parse(localStorage.getItem('hc_funder_demo')||'{}');S.lang=localStorage.getItem('hc_funder_language')||S.lang;}catch(e){F.accounts={};}}
  function persist(){F.account.notes=F.notes;try{F.accounts[F.account.address]=F.account;localStorage.setItem('hc_funder_demo',JSON.stringify(F.accounts));F.storageFailed=false;return true;}catch(e){F.storageFailed=true;return false;}}
  function hydrate(a){F.account=F.accounts[a]?JSON.parse(JSON.stringify(F.accounts[a])):blank();F.account.form={...blank().form,...F.account.form};F.account.address=a;F.notes=F.account.notes||[];F.pendingSubmission=!!F.account.pending;F.downgrade=!!F.account.reviewPending;F.change=false;F.submitConsent=false;F.emailFlow=false;F.otp=null;F.fieldErrors={};F.emailInput=F.account.email;F.upload=F.account.form.file?(F.account.form.fileStatus||'done'):'idle';if(F.upload==='loading'){F.upload='failed';F.account.form.fileStatus='failed';}}
  function response(){F.contract={session_state:S.role==='fund'&&!F.account.disabled?'authenticated':'guest',identity_type:'funder',completeness_level:S.role!=='fund'||F.account.disabled?'L0':({draft:'L0',submitted:'L1',rejected:'L2',verified:'L3'}[F.account.status]),account_id:F.account.exists?'DEMO-FUNDER':''};}
  function btn(en,zh,act,v='',kind='',disabled=false){return `<button type="button" class="btn ${kind}" data-act="f-${act}" data-v="${esc(v)}" ${disabled?'disabled':''}>${L(en,zh)}</button>`;}
  function link(en,zh,act,v=''){return `<button type="button" class="btn-link" data-act="f-${act}" data-v="${esc(v)}">${L(en,zh)}</button>`;}
  function go(path){if(path==='/')path='/assets';if(F.emailFlow){F.generation++;F.emailFlow=false;F.otp=null;F.busy='';}S.menu=null;S.layer=null;F.error=null;F.load='ready';if(location.hash==='#'+path){if(CF.ENTRY[S.page]===path)CF.render();}else location.hash='#'+path;}
  function open(key,data){if(!S.layer&&!F.layerOpen){const el=document.activeElement;F.focusBack=el?{id:el.id,act:el.dataset.act,value:el.dataset.v}:null;}CF.openLayer('modal','f-'+key,data);queueMicrotask(afterRender);}
  function error(){return F.error?`<p class="note red" role="alert">${L(...F.error)}</p>`:'';}
  function stamp(){return `<p class="funder-stamp">${L('Demonstration data','演示数据')}</p>`;}
  function time(t){return t?CF.fmtTime(t):'—';}
  function status(s=F.account.status){return L(...({draft:['Registration not submitted','未提交注册'],submitted:['Under review','审核中'],rejected:['Rejected','已驳回'],verified:['Verified','已认证']}[s]));}
  function tag(s=F.account.status){return CF.tag(s==='verified'?'ok':s==='rejected'?'danger':'warn',status(s));}
  const walletCare=()=>L("This wallet is your only way to sign in, and it can't be changed after linking. Make sure you'll keep long-term access to it.",'该钱包是你唯一的登录方式，绑定后不可更换，请确保长期可访问。');
  const emailCare=()=>L('Use a long-lived company mailbox. Avoid personal addresses or accounts tied to one employee — this is your only contact channel.','请使用长期有效的企业邮箱，避免使用个人邮箱或离职风险高的个人账号——它是你唯一的联系通道。');
  function wallet(a=F.account.address,explorer=false){return `<div class="funder-line"><span class="hash" title="${esc(a)}">${esc(a.slice(0,6)+'…'+a.slice(-4))}</span>${link('Copy address','复制地址','copy',a)}${explorer?link('Block explorer ↗','区块浏览器 ↗','explorer',a):''}</div>`;}
  function head(en,zh,desc=''){return `<div class="page-head"><div><h1 class="page-title">${L(en,zh)}</h1>${desc?`<p class="page-desc">${desc}</p>`:''}</div>${S.role==='fund'?tag():''}</div>`;}
  function later(fn,delay=650){const generation=F.generation;setTimeout(()=>{if(generation===F.generation){fn();CF.render();queueMicrotask(afterRender);}},delay);}
  function connect(origin='entry'){
    F.connectionOrigin=origin;F.error=null;F.consent=false;F.busy='';F.entryError=null;
    if(['missing','sdk'].includes(F.connectionResult)){
      F.entryError=F.connectionResult==='missing'?['No wallet detected. Install or enable a compatible wallet, or use a mobile wallet.','未检测到钱包。请安装或启用兼容钱包，或使用移动端钱包。']:['Wallet connection is temporarily unavailable. Please retry.','钱包连接暂时不可用，请重试。'];
      if(origin!=='entry'){F.signState='B';F.error=F.entryError;go('/funder/sign');}else CF.render();return;
    }
    open('connect');
  }
  function connectionDone(cancel=false){
    S.layer=null;
    if(cancel||['cancel','locked'].includes(F.connectionResult)){
      F.connected='';F.busy='';F.error=F.connectionResult==='locked'?['Your wallet is locked. Unlock it, then connect again.','你的钱包处于锁定状态，请解锁后重新连接。']:['You cancelled the connection request. Connect again to continue.','你取消了连接请求，重新连接即可继续。'];
      if(F.connectionOrigin==='entry'){F.entryError=F.error;CF.render();}else if(F.connectionOrigin==='auth'){open('email');}else{F.signState='B';location.hash='#/funder/sign';CF.render();}return;
    }
    F.connected=F.connected===other?other:address;
    if(F.connectionOrigin==='auth'){open('email');return;}
    F.signState=F.connectionResult==='network'?'C':'A';F.consent=false;F.error=null;go('/funder/sign');
  }
  function signPage(){
    const states={A:['Confirm and sign','确认并签名'],B:['Wallet not connected','钱包未连接'],C:['Unsupported network','当前网络不受支持'],D:['This wallet is already in use','该钱包地址已被占用'],E:['Account disabled','账号已停用']};
    let body='';
    if(F.signState==='A')body=`<p>${L("Signing creates your account automatically if you're new — no password needed.",'若你是新用户，签名即自动创建账号，无需密码。')}</p><div class="funder-summary"><span class="login-caption">${L('Connected wallet','当前钱包')}</span>${wallet(F.connected||address)}${link('Reconnect wallet','重新连接钱包','reconnect')}</div><p>${L('Signing this message proves you own this wallet. It does not send a transaction, does not cost gas, and does not move or approve any assets.','签署这条消息只用于证明你拥有该钱包。它不会发起交易、不消耗 gas，也不会转移或授权任何资产。')}</p>${CF.note('warn',walletCare())}${agreementCheck('f-consent',F.consent)}${error()}<div class="login-actions funder-sign-actions">${btn(F.busy==='sign'?'Waiting for signature…':'Sign & continue',F.busy==='sign'?'等待钱包签名…':'签名并继续','sign','','primary',!F.consent||!!F.busy)}${F.busy==='sign'?btn('Cancel','取消','cancel-sign'):''}${F.signatureResult==='changed'&&F.error?btn('Sign in with this address','用该地址重新登录','new-address'):''}</div>`;
    else {
      const messages={B:['Connect your wallet to continue.','请连接钱包后继续。'],C:['Switch your wallet to a supported EVM network, then try again.','请在钱包中切换到受支持的 EVM 网络后重试。'],D:['This address is already linked to another funder account. Use a different wallet, or contact support.','该地址已绑定到另一个资金方账号。请更换钱包，或联系客服。'],E:['This account has been disabled. Contact support to restore it.','该账号已被停用，请联系客服恢复。']};
      body=`<p>${L(...messages[F.signState])}</p>${error()}<div class="login-actions">${F.signState==='C'?btn('Network changed — retry','已切换，重试','network','','primary'):''}${F.signState!=='E'?btn(F.signState==='D'?'Connect a different wallet':'Reconnect wallet',F.signState==='D'?'换一个钱包地址重新连接':'重新连接钱包','reconnect','','primary'):btn('Keep browsing as a guest','以游客身份继续浏览','guest','','primary')}${['D','E'].includes(F.signState)?link('Contact support','联系客服','support'):''}</div>`;
    }
    return `<div class="login-flow"><h1 class="page-title">${L(...states[F.signState])}</h1>${body}<div class="login-bottom">${link('Not a funder? Choose a different role','不是资金方？重新选择用户类型','back-role')}</div>${stamp()}</div>`;
  }
  function requestSign(purpose){
    if(F.busy)return;
    if(purpose==='login'&&!F.consent)return;
    F.error=null;F.signPurpose=purpose;
    if(purpose==='email'&&F.connected!==F.account.address){F.error=F.connected?['The connected wallet differs from your signed-in account. Switch back before signing.','当前钱包与登录账号不一致，请切回登录钱包后签名。']:['Connect your wallet before signing.','请先连接钱包后签名。'];open('email');return;}
    F.signatureStarted=Date.now();F.challenge++;F.busy='sign';open('signature');
  }
  function signatureDone(cancel=false){
    if(F.busy!=='sign')return;
    const purpose=F.signPurpose,r=cancel?'cancel':F.signatureResult;
    S.layer=null;
    if(r==='slow'&&!cancel){CF.render();return;}
    F.busy='';
    if(r==='expired'||Date.now()-F.signatureStarted>300000){F.challenge++;F.error=['The signature request expired. A new request is ready; sign again.','签名请求已过期，已重新获取，请再次签名。'];}
    else if(r==='cancel')F.error=['Signing was cancelled. You can try again.','已取消签名，你可以重新尝试。'];
    else if(r==='failed')F.error=['The signature could not be verified. Please try again.','签名验证失败，请重试。'];
    else if(r==='changed'){F.connected=other;F.error=['Your wallet address changed. This signature was stopped.','钱包地址已变化，本次签名已中止。'];}
    else if(r==='conflict'&&purpose==='login'){S.role='guest';F.signState='D';response();}
    else if(r==='disabled'&&purpose==='login'){hydrate(F.connected);F.account.disabled=true;persist();S.role='guest';F.signState='E';response();}
    else if(purpose==='email'){F.reauthUntil=Date.now()+600000;F.emailStage='edit';F.error=null;open('email');return;}
    else {
      hydrate(F.connected);if(F.account.disabled){F.signState='E';S.role='guest';response();CF.render();return;}
      if(F.savedPreferences){S.lang=F.savedPreferences.lang;S.tz=F.savedPreferences.tz;}else if(F.account.tz)S.tz=F.account.tz;F.first=!F.account.exists;F.account.exists=true;if(!F.account.created)F.account.created=new Date().toISOString();
      S.role='fund';F.sessionUntil=Date.now()+4*3600000;F.reauthUntil=0;F.error=null;persist();response();
      if(F.first){F.notes.push(['Your account has been created.','你的账号已创建。']);persist();}
      if(F.returnTo==='valid'){go('/demo/funder/action');later(gate,30);}
      else if(F.returnTo==='invalid'){go('/');CF.toast(L('We have returned you to the asset marketplace.','已为你回到资产广场。'));}
      else go(F.first?'/funder/register':'/');return;
    }
    if(purpose==='email')open('email');else CF.render();
  }
  function agreementCheck(id,checked){return `<div class="funder-consent"><input id="${id}" type="checkbox" ${checked?'checked':''} aria-label="${L('I have read and agree to the Platform Agreement','我已阅读并同意《平台协议》')}"><div><label for="${id}">${L('I have read and agree to ','我已阅读并同意')}</label><button type="button" class="btn-link" data-act="f-agreements">${L('the Platform Agreement','《平台协议》')}</button></div></div>`;}
  function fields(){const f=F.account.form;return [['Institution name','机构名称',f.name],['Country or region','注册国家或地区',f.country],['Identifier type','标识类型',f.identifierType||'—'],['Institution identifier','机构唯一标识',f.identifier],['Institution type','机构类型',f.institutionType||'—'],['Registered address','注册地址',f.registeredAddress||'—'],['Regulator','监管机构',f.regulator||'—'],['Financial licence number','金融牌照编号',f.license||'—'],['Business contact email','业务联系人邮箱',f.contact||'—'],['Institution document','机构证明材料',f.file||'—']].filter(x=>F.activeTemplate!=='DEMO-2'||x[0]!=='Business contact email');}
  function fileSize(size){return size>=1048576?(size/1048576).toFixed(1)+' MB':Math.max(1,Math.ceil(size/1024))+' KB';}
  function uploadArea(){const f=F.account.form;return `<div class="field"><span class="funder-field-label">${L('Institution document *','机构证明材料 *')}</span><div class="funder-upload" id="f-material" tabindex="-1" ${F.fieldErrors.file?'aria-describedby="f-err-file"':''}><input id="f-file" type="file" hidden aria-label="${L('Select institution document','选择机构证明材料')}">${f.file?`<div class="funder-file-row"><span class="funder-file-icon" aria-hidden="true">↑</span><div class="funder-file-meta"><strong>${esc(f.file)}</strong><span>${f.fileSize?fileSize(f.fileSize):L('Size unavailable','大小未记录')}</span><span role="status" class="${F.upload==='failed'?'funder-error':''}">${F.upload==='loading'?L('Uploading…','正在上传…'):F.upload==='failed'?L('Upload failed. Retry or replace the file.','上传失败，请重试或替换文件。'):L('Uploaded','上传成功')}</span></div></div><div class="funder-file-actions">${F.upload==='failed'?btn('Retry upload','重试上传','upload','','primary'):''}${btn('Replace file','替换文件','pick-file')}${link('Delete','删除','remove-file')}</div>`:`<div class="funder-upload-empty"><span class="funder-file-icon" aria-hidden="true">↑</span><div><strong>${L('Upload institution document','上传机构证明材料')}</strong><p class="login-caption">${L('Choose a file from your computer.','从电脑选择需要提交的文件。')}</p></div>${btn('Choose file','选择文件','pick-file')}</div>`}${F.fieldErrors.file?`<p id="f-err-file" class="err-msg" role="alert">${L(...F.fieldErrors.file)}</p>`:''}</div></div>`;}
  function startUpload(file){if(F.account.status==='submitted'||F.pendingSubmission)return;delete F.fieldErrors.file;const version=++F.uploadVersion;if(file){F.account.form.file=file.name;F.account.form.fileSize=file.size;}F.upload='loading';F.account.form.fileStatus='loading';persist();later(()=>{if(version!==F.uploadVersion)return;F.upload=F.saveResult==='failed'?'failed':'done';F.account.form.fileStatus=F.upload;persist();});}
  function preferenceFeedback(){return F.preferenceState?`<p class="${F.preferenceState==='failed'?'funder-error':'login-caption'}" role="${F.preferenceState==='failed'?'alert':'status'}">${F.preferenceState==='failed'?L('Could not save. Your previous preference is restored. Please select again to retry.','保存失败，已恢复原偏好，请重新选择后重试。'):L('Preferences saved','偏好已保存')}</p>`:'';}
  function savePreference(key,value){
    const next={lang:S.lang,tz:S.tz,[key]:value};
    try{if(F.saveResult==='failed')throw new Error('simulated');localStorage.setItem('hc_funder_preferences',JSON.stringify(next));F.savedPreferences=next;S.lang=next.lang;S.tz=next.tz;F.preferenceState='saved';$('toasts').innerHTML='';CF.toast(L('Preferences saved','偏好已保存'));}
    catch(e){F.preferenceState='failed';CF.toast(L('Preferences could not be saved. Please retry.','偏好保存失败，请重试。'));}
  }
  function details(items,grid=false){return `<dl class="login-fields ${grid?'funder-detail-grid':''}">${items.map(r=>`<div ${grid&&r[0]==='Registered address'?'class="funder-field-wide"':''}><dt>${L(r[0],r[1])}</dt><dd>${esc(String(r[2]))}</dd></div>`).join('')}</dl>`;}
  function input(key,en,zh,value,options=''){return `<div class="field"><label for="f-${key}">${L(en,zh)}</label><input class="inp" id="f-${key}" value="${esc(value||'')}" ${en.endsWith('*')?'aria-required="true"':''} ${options} ${F.fieldErrors[key]?'aria-invalid="true" aria-describedby="f-err-'+key+'"':''}>${F.fieldErrors[key]?`<span class="err-msg" id="f-err-${key}" role="alert">${L(...F.fieldErrors[key])}</span>`:''}</div>`;}
  function codeForm(){return `<div class="funder-form">${input('email','Contact email','联系邮箱',F.emailInput,'type="email" maxlength="254" autocomplete="email" '+(F.busy?'disabled':''))}<div class="funder-code">${input('code','Verification code','验证码',F.codeInput,'inputmode="numeric" maxlength="6" autocomplete="one-time-code" '+(F.busy?'disabled':''))}<button type="button" class="btn" data-act="f-send" ${F.busy==='send'||remaining()>0?'disabled':''} id="f-send">${sendLabel()}</button></div>${F.otp?`<p class="login-caption">${L('Code sent to','验证码已发送至')} ${esc(F.otp.email)} · ${L('Valid for 10 minutes','10 分钟内有效')}</p>`:''}${error()}${btn(F.busy==='verify'?'Verifying…':'Verify email',F.busy==='verify'?'正在验证…':'验证邮箱','verify','','primary',!!F.busy)}</div>`;}
  function remaining(){return F.otp?Math.max(0,Math.ceil((F.otp.sent+60000-Date.now())/1000)):0;}
  function sendLabel(){return remaining()>0?L(`Resend in ${remaining()}s`,`${remaining()} 秒后重发`):F.busy==='send'?L('Sending…','正在发送…'):L(F.otp?'Resend code':'Send code',F.otp?'重新发送':'发送验证码');}
  function emailStep(){return `<h2>${L('Contact email','联系邮箱')}</h2><p class="login-caption">${emailCare()}</p>${F.account.email?`${CF.note('accent',L('Email verified','邮箱已验证'))}${details([['Contact email','联系邮箱',F.account.email]])}${link('Manage contact email','管理联系邮箱','account')}`:codeForm()}`;}
  function institution(){
    if(F.template==='error')return CF.empty(L('Institution details are unavailable','机构资料暂不可填写'),L('Please retry. Your saved details are retained.','请重试，已保存内容会保留。'),btn('Retry','重试','template-retry','','primary'));
    if(F.template==='loading')return CF.skelTable(4);
    const f=F.account.form;
    return `<h2>${L('Financial institution details','金融机构资料')}</h2>${F.account.status==='rejected'?CF.note('warn',issuesHTML(F.account,true)):''}<div class="funder-form"><div class="funder-field-grid">${input('name','Institution name *','机构名称 *',f.name)}${input('country','Country or region *','注册国家或地区 *',f.country)}<div class="field"><label for="f-identifierType">${L('Identifier type *','标识类型 *')}</label><select class="inp" id="f-identifierType" aria-required="true" aria-invalid="${!!F.fieldErrors.identifierType}" ${F.fieldErrors.identifierType?'aria-describedby="f-err-identifierType"':''}><option value="">${L('Select identifier type','请选择标识类型')}</option>${[['USCC','USCC · Mainland China','统一社会信用代码 · 中国境内'],['LEI','LEI · if available','LEI · 境外优先'],['REG_NO','Country + registration number','注册国家 + 商业登记号']].map(o=>`<option value="${o[0]}" ${f.identifierType===o[0]?'selected':''}>${L(o[1],o[2])}</option>`).join('')}</select>${F.fieldErrors.identifierType?`<span class="err-msg" id="f-err-identifierType" role="alert">${L(...F.fieldErrors.identifierType)}</span>`:''}</div>${input('identifier','Institution identifier *','机构唯一标识 *',f.identifier)}${input('institutionType','Institution type *','机构类型 *',f.institutionType)}<div class="funder-field-wide">${input('registeredAddress','Registered address *','注册地址 *',f.registeredAddress)}</div>${input('regulator',F.activeTemplate==='DEMO-2'?'Regulator *':'Regulator (optional)',F.activeTemplate==='DEMO-2'?'监管机构 *':'监管机构（选填）',f.regulator)}${input('license','Financial licence number (optional)','金融牌照编号（选填）',f.license)}${F.activeTemplate==='DEMO-2'?'':`<div class="funder-field-wide">${input('contact','Business contact email (optional)','业务联系人邮箱（选填）',f.contact,'type="email"')}</div>`}</div>${uploadArea()}</div>`;
  }

  const fieldNames={name:['Institution name','机构名称'],country:['Country or region','注册国家或地区'],identifierType:['Identifier type','标识类型'],identifier:['Institution identifier','机构唯一标识'],institutionType:['Institution type','机构类型'],registeredAddress:['Registered address','注册地址'],regulator:['Regulator','监管机构'],contact:['Business contact email','业务联系人邮箱'],file:['Institution document','机构证明材料'],template:['Institution form','机构资料表']};
  function institutionErrors(){
    const f=F.account.form,errors={};
    ['name','country','identifierType','identifier','institutionType','registeredAddress',...(F.activeTemplate==='DEMO-2'?['regulator']:[])].forEach(k=>{if(!String(f[k]||'').trim())errors[k]=['Complete this field.','请填写此项。'];});
    if(F.activeTemplate!=='DEMO-2'&&f.contact&&!emailValid(f.contact.trim()))errors.contact=['Enter a valid email.','请输入有效邮箱。'];
    if(!f.file)errors.file=['Upload the institution document.','请上传机构证明材料。'];
    else if(F.upload!=='done')errors.file=F.upload==='loading'?['Wait for the upload to finish.','请等待材料上传完成。']:['The upload failed. Retry or replace the file.','材料上传失败，请重试或替换文件。'];
    if(F.template!=='ready')errors.template=['Load the institution form before submitting.','请先重新加载机构资料表。'];
    return errors;
  }
  function validationSummary(){const keys=Object.keys(F.fieldErrors).filter(k=>fieldNames[k]);return keys.length?`<section class="note red funder-validation" role="alert" tabindex="-1" id="f-validation"><b>${L('Check the following before submitting','提交前请检查以下项目')}</b><ul>${keys.map(k=>`<li>${link(...fieldNames[k],'issue-field',k)}<span>${L(...F.fieldErrors[k])}</span></li>`).join('')}</ul></section>`:'';}
  function pendingPage(){
    const p=F.account.pending;
    return `<div class="funder-wrap">${head('Confirming submission','确认提交结果',L('Your registration status stays unchanged until the result is confirmed.','提交结果确认前，当前注册状态保持不变。'))}<section class="card"><div class="card-b">${CF.note('warn',L('The submission result is not confirmed. Check its status before editing or submitting again.','提交结果尚未确认，请先查询结果，再继续编辑或提交。'))}${error()}<div class="login-actions">${btn(F.busy==='query'?'Checking…':'Check current status',F.busy==='query'?'正在查询…':'查询当前状态','resolve-submit','','primary',!!F.busy)}${link('Continue browsing','继续浏览','browse')}</div>${F.storageFailed?CF.note('warn',L('This device could not save the pending submission. Keep this page open while checking the result.','当前设备无法保存待确认提交，请保留此页并查询结果。')):''}${p?`<h2 class="funder-detail-heading">${L('Submitted details','本次提交资料')}</h2>${details([['Contact email at submission','提交时联系邮箱',p.email],...p.fields],true)}`:''}</div></section>${stamp()}</div>`;
  }

  function registration(){
    const a=F.account;
    if(F.pendingSubmission)return pendingPage();
    if(a.status==='submitted'){queueMicrotask(()=>go('/funder/status'));return '';}
    if(a.status==='verified'&&!F.change){queueMicrotask(()=>go('/funder/status'));return '';}
    let body=a.step===1?emailStep():a.step===2?institution():`<h2>${L('Review and submit','核对并提交')}</h2>${details([['Contact email','联系邮箱',a.email||L('Not verified','未验证')],...fields()],true)}${!a.email?CF.note('red',L('Verify your contact email before submitting.','提交前请先验证联系邮箱。'))+link('Go to contact email','前往联系邮箱','step','1'):''}${validationSummary()}${agreementCheck('f-submit-consent',F.submitConsent)}${error()}`;
    return `<div class="funder-wrap">${head(F.change?'Update institution details':'Institution registration',F.change?'变更机构资料':'机构注册',L('Complete your registration to unlock funding actions.','完成机构认证后即可使用出资功能。'))}<div class="funder-grid"><section class="card"><div class="card-b"><ol class="funder-steps">${[['Contact email','联系邮箱'],['Institution','机构资料'],['Review','确认提交']].map((x,i)=>`<li><button data-act="f-step" data-v="${i+1}" ${a.step===i+1?'aria-current="step"':''}><span class="step-num">${(i===0&&a.email)||(i===1&&!Object.keys(institutionErrors()).length)?'✓':i+1}</span>${L(...x)}</button></li>`).join('')}</ol>${body}<div class="funder-actions">${a.step>1?btn('Back','上一步','step',String(a.step-1)):link('Continue browsing','稍后完成，继续浏览','browse')}${a.step<3?btn('Continue','下一步','step',String(a.step+1),a.step===1&&!a.email?'':'primary'):btn(F.busy==='submit'?'Submitting…':'Submit registration',F.busy==='submit'?'正在提交…':'提交注册','submit','','primary',!F.submitConsent||!!F.busy)}</div><p class="login-caption" role="status">${F.storageFailed?L('Draft could not be saved on this device. Keep this page open.','当前设备无法保存草稿，请暂勿关闭页面。'):L('Draft saved on this device','草稿已保存在当前设备')}</p></div></section><aside class="funder-summary"><h2>${F.first?L('Your account is ready','账号已创建'):L('Your account','你的账号')}</h2>${wallet()}${details([['Created','创建时间',time(a.created)]])}<p>${walletCare()}</p>${F.change?CF.note('warn',L('After submission, your institution will be reviewed again. Funding actions will be unavailable during review.','提交后将重新进入审核，期间恢复为未认证权限。')):''}${link('Account settings','账户设置','account')}${stamp()}</aside></div></div>`;
  }

  const demoIssues=()=>[{key:'identifier',label:['Institution identifier','机构唯一标识'],en:'The submitted number does not match the document. Check and correct the full number.',zh:'提交编号与证明材料不一致，请核对并填写完整编号。'}];
  function issuesHTML(view,locate=false){
    const issues=view.issues||[];
    if(!issues.length&&!view.additional)return L('Review details are unavailable. Please contact support.','审核原因暂不可用，请联系客服。');
    return issues.map(i=>`<p><b>${esc(L(...i.label))}</b> · ${esc(L(i.en,i.zh))}${locate?(F.activeTemplate==='DEMO-2'&&i.key==='contact'?L(' · This field has changed',' · 该字段已调整'):link('Go to field','定位字段','issue-field',i.key)):''}</p>`).join('')+(view.additional?`<p class="funder-reason-text">${esc(view.additional)}</p>`:'');
  }
  function statusPage(){
    const a=F.account;
    if(a.status==='draft')return `<div class="funder-wrap">${head('Registration status','注册状态')}${CF.empty(L('No registration submitted','尚未提交注册'),L('Complete your email and institution details to send your registration for review.','完成邮箱验证并填写机构资料后，即可提交审核。'),btn('Go to registration','去完成注册','register','','primary'))}</div>`;
    const hist=F.historyVersion?a.history.find(x=>x.version===F.historyVersion):null;
    const view=hist||{...a,fields:a.submittedFields};
    const current=a.status;
    const reason=issuesHTML(view);
    const feedback=view.status==='rejected'
      ? `<section class="card funder-status-action"><div class="card-b"><h2>${L('Your registration needs changes','注册资料需要修改')}</h2>${CF.note('red',reason)}${!hist&&current==='rejected'?`<div class="login-actions">${btn('Edit and resubmit','修改并重新提交','register','','primary')}${link('Contact support','联系客服','support')}</div>`:''}</div></section>`
      : view.status==='submitted'?CF.note('accent',`<b>${L('Under review','审核中')}</b><p>${L('Institution details are locked until a review decision is available.','机构资料在审核结论出具前不可修改。')}</p>${!hist?link('Refresh status','刷新状态','refresh'):''}`):'';
    return `<div class="funder-wrap"><div class="page-head"><div><h1 class="page-title">${L('Registration status','注册状态')}</h1><p class="page-desc">${hist?L('Historical submission — read only','历史提交 · 只读'):L('View your institution details and verification status.','查看机构资料及认证状态。')}</p></div>${tag(view.status)}</div>
      ${F.downgrade&&!hist?CF.note('warn',L('Your details are being reviewed again. Funding actions are unavailable until approval.','机构资料正在重新审核，审核通过前暂不可发起出资等操作。')):''}
      <div class="funder-status-stack">${feedback}
        <section class="card" id="f-submission-summary"><div class="card-b"><h2>${L('Submission information','提交信息')}</h2>${details([['Application','申请编号','DEMO-REG-001'],['Submission version','提交版本',String(view.version)],['Template','资料模版',view.template||'DEMO-1'],['Submitted','提交时间',time(view.submitted)],['Review decision','审核结论时间',time(view.reviewed)],['Contact email at submission','提交时联系邮箱',view.snapshotEmail||a.email]],true)}${a.history.length?`<details class="funder-history"><summary>${L('Submission history','历史提交')} · ${a.history.length}</summary><div class="funder-line">${a.history.map(h=>link('Version '+h.version+' · '+status(h.status),'版本 '+h.version+' · '+status(h.status),'history',String(h.version))).join('')}</div></details>`:''}${hist?`<div class="login-actions">${btn('Return to current version','返回当前版本','history','0')}</div>`:''}</div></section>
        <section class="card" id="f-institution-summary"><div class="card-b"><h2>${L('Institution details','机构资料')}</h2>${details((view.fields||fields()),true)}${!hist&&current==='verified'?`<div class="login-actions">${btn('Update institution details','变更机构资料','change','','primary')}</div>`:''}</div></section>
        ${stamp()}
      </div></div>`;
  }

  function accountPage(){
    const zones=Array.from(new Set([S.tz||'UTC','UTC','Asia/Shanghai','Asia/Hong_Kong','Asia/Singapore','Europe/London','America/New_York']));
    return `<div class="funder-wrap">${head('Account settings','账户设置',L('Manage your contact details and preferences.','管理联系方式与偏好设置。'))}<nav class="funder-tabs" aria-label="${L('Account sections','账户分区')}"><a href="#account-information" data-act="f-anchor" data-v="account-information">${L('Account information','账号信息')}</a><a href="#account-preferences" data-act="f-anchor" data-v="account-preferences">${L('Preferences','偏好信息')}</a></nav><section class="card funder-section" id="account-information"><div class="card-b"><h2>${L('Account information','账号信息')}</h2><dl class="login-fields"><div><dt>${L('Wallet address','钱包地址')}</dt><dd>${wallet(F.account.address,true)}<p class="login-caption">${walletCare()}</p></dd></div><div><dt>${L('Contact email','联系邮箱')}</dt><dd><div class="funder-line"><b>${esc(F.account.email)||L('Not set','未填写')}</b>${link('Change','修改','change-email')}</div><p class="login-caption">${emailCare()}</p></dd></div><div><dt>${L('Account status','账号状态')}</dt><dd>${CF.tag('ok',L('Active','正常'))}</dd></div><div><dt>${L('Registration status','注册状态')}</dt><dd class="funder-line">${tag()}${link('View progress','查看进度','status')}</dd></div></dl></div></section><section class="card funder-section" id="account-preferences"><div class="card-b funder-form"><h2>${L('Preferences','偏好信息')}</h2><div class="field"><label for="f-language">${L('Language','语言')}</label><select class="inp" id="f-language"><option value="en" ${S.lang==='en'?'selected':''}>English</option><option value="zh" ${S.lang==='zh'?'selected':''}>简体中文</option></select></div><div class="field"><label for="f-timezone">${L('Time zone','时区')}</label><select class="inp" id="f-timezone">${zones.map(z=>`<option ${z===S.tz?'selected':''}>${esc(z)}</option>`).join('')}</select></div>${preferenceFeedback()}</div></section>${stamp()}</div>`;
  }
  function gate(){response();F.replayed++;if(F.contract.session_state!=='authenticated'){F.returnTo='valid';go('/login');return;}if(F.contract.completeness_level!=='L3'){F.gate='blocked';open('gate');return;}F.gate='pending';CF.render();later(()=>{response();if(F.contract.session_state!=='authenticated'||F.contract.completeness_level!=='L3'){F.gate='blocked';open('gate');return;}F.gate=F.saveResult==='failed'?'failed':'ready';});}
  function gatePage(){return `<div class="funder-wrap">${head('Funding access','出资权限',L('Demonstration data','演示数据'))}<section class="card"><div class="card-b"><h2>${L('Continue to funding','继续出资')}</h2><p>${L('Your registration must be approved before you can take funding actions.','机构注册审核通过后，即可发起出资等操作。')}</p>${btn(F.gate==='pending'?'Checking…':'Continue to funding',F.gate==='pending'?'正在确认…':'继续出资','gate','','primary',F.gate==='pending')}${F.gate==='ready'?CF.note('accent',L('Registration eligibility confirmed. Continue in the funding workflow.','机构认证资格已确认，可继续进入出资流程。')):''}${F.gate==='failed'?CF.note('red',L('Eligibility could not be confirmed. Please retry.','资格确认失败，请重试。')):''}</div></section></div>`;}
  function content(id){
    // 公共 boot 会推断时区；在首次内容渲染时恢复已保存的用户选择。
    if(F.savedPreferences&&!F.preferencesRestored){S.lang=F.savedPreferences.lang;S.tz=F.savedPreferences.tz;F.preferencesRestored=true;}
    if(!pages[id])return undefined;
    if(['P-L21','P-L22','P-L23'].includes(id)&&S.role!=='fund')return `<div class="funder-wrap">${CF.empty(L('Sign in to view your account','登录后查看账户'),L('You can still browse public information.','你仍可浏览公开信息。'),btn('Sign in','登录','login','','primary')+btn('Back to assets','返回资产广场','browse'))}</div>`;
    notices();
    if(F.load==='loading')return `<div class="funder-wrap" role="status">${CF.skelTable(5)}</div>`;
    if(F.load==='error')return CF.empty(L('Unable to load account information','账户信息加载失败'),L('Your saved information is retained.','已保存信息会保留。'),btn('Retry','重试','load-retry','','primary')+(id==='P-L22'?link('Contact support','联系客服','support'):''));
    return ({'P-L20':signPage,'P-L21':registration,'P-L22':statusPage,'P-L23':accountPage,'DEMO-F-GATE':gatePage}[id])();
  }
  function notices(){
    if(S.role!=='fund'){CF.setCompletion([]);return;}
    const s=F.account.status;
    const text={draft:['Complete your institution registration to unlock funding actions.','完成机构注册并通过审核后即可出资。'],submitted:['Your registration is under review.','你的机构注册正在审核中。'],rejected:['Your registration needs changes. Review the reason and submit again.','你的注册需要修改，请查看原因并重新提交。']};
    const items=F.pendingSubmission?[{priority:2,text:L('Your submission result needs confirmation.','你的提交结果待确认。'),label:L('Check status','查询结果'),act:'f-register'}]:s==='verified'?[]:[{priority:2,text:L(...text[s]),label:s==='draft'?L('Apply to join','申请入驻'):L('View progress','查看进度'),act:s==='draft'?'f-register':'f-status'}];
    if(F.connected!==F.account.address)items.unshift({priority:1,text:F.connected?L('The connected wallet differs from your signed-in account.','当前钱包地址与登录账号不一致。'):L('Wallet disconnected. You remain signed in.','钱包已断开，你仍处于登录状态。'),label:F.connected?L('Sign in with this address','用该地址重新登录'):L('Connect wallet','连接钱包'),act:F.connected?'f-new-address':'f-connect-auth'});
    CF.setCompletion(items);
  }
  function logout(expired=false){F.generation++;F.busy='';F.otp=null;F.reauthUntil=0;F.sessionUntil=0;F.emailFlow=false;F.emailInput=F.account.email;F.codeInput='';F.returnTo='';F.gate='idle';persist();S.role='guest';CF.resetCompletion();response();go('/');CF.toast(expired?L('Your sign-in expired. Unsaved changes were discarded; your registration draft is saved.','登录已过期，未保存的修改已丢弃，注册草稿已保留。'):L('Signed out.','已退出登录。'));}
  function emailValid(v){return v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);}
  function emailTaken(value){return Object.values(F.accounts).some(a=>a.address!==F.account.address&&a.email?.trim().toLowerCase()===value);}
  function emailAuthorized(){if(!F.emailFlow||Date.now()<F.reauthUntil)return true;F.emailStage='auth';F.error=['Your confirmation expired. Sign again to continue.','身份确认已过期，请重新签名后继续。'];open('email');return false;}
  function send(){
    if(S.role!=='fund'||F.busy||!emailAuthorized())return;
    const value=F.emailInput.trim().toLowerCase();F.emailInput=value;F.error=null;F.fieldErrors={};
    if(!emailValid(value)){F.fieldErrors.email=['Enter a valid email address (up to 254 characters).','请输入有效邮箱，最多 254 个字符。'];return;}
    if(value===F.account.email){F.error=['This is already your contact email.','这已经是你当前的联系邮箱。'];return;}
    if(F.emailResult==='conflict'||value==='taken@example.test'||emailTaken(value)){F.error=["This email address isn't available. Please use another one.",'该邮箱不可用，请更换。'];return;}
    if(remaining()>0){F.error=['Wait before requesting another code.','请在倒计时结束后重新获取。'];return;}
    if(F.otp&&F.otp.resends>=5){F.error=["You've requested too many codes. Close this flow and try again later.",'获取验证码次数过多，请关闭后稍后再试。'];return;}
    const sends=(F.sends[value]||[]).filter(t=>Date.now()-t<86400000);
    if(sends.length>=10){F.error=['Too many codes requested for this email. Try again later.','该邮箱验证码发送次数已达上限，请稍后再试。'];return;}
    F.busy='send';later(()=>{
      F.busy='';if(F.emailResult==='failed'){F.error=['The code could not be sent. Please retry.','验证码发送失败，请重试。'];return;}
      F.latestCode=String(123456+(F.otp?F.otp.resends+1:0));
      F.otp={email:value,code:F.latestCode,sent:Date.now(),expires:Date.now()+600000,errors:0,resends:F.otp?F.otp.resends+1:0,valid:true};F.sends[value]=[...sends,Date.now()];F.codeInput='';
    });
  }
  function verify(){
    if(S.role!=='fund'||F.busy||!emailAuthorized())return;F.error=null;F.fieldErrors={};
    const code=F.otp;
    if(!/^\d{6}$/.test(F.codeInput)){F.fieldErrors.code=['Enter the 6-digit code.','请输入 6 位数字验证码。'];return;}
    if(!code||!code.valid||Date.now()>code.expires){F.error=['This code is no longer valid. Please request a new one.','该验证码已失效，请重新获取。'];return;}
    if(F.emailInput.trim().toLowerCase()!==code.email){F.error=['Email changed. Send a new code to this address.','邮箱已变更，请向该地址重新发送验证码。'];return;}
    if(F.codeInput!==code.code){code.errors++;if(code.errors>=5)code.valid=false;F.error=code.valid?["That code isn't correct.",'验证码不正确。']:['This code is no longer valid. Please request a new one.','该验证码已失效，请重新获取。'];return;}
    F.busy='verify';later(()=>{
      F.busy='';if(!emailAuthorized())return;if(F.otp!==code||!code.valid||Date.now()>code.expires||F.emailInput.trim().toLowerCase()!==code.email){F.error=['The code or email changed. Please request a new code.','验证码或邮箱已变化，请重新获取验证码。'];return;}if(F.emailResult==='race'||emailTaken(code.email)){F.error=["This email address isn't available. Please use another one.",'该邮箱不可用，请更换。'];return;}
      if(F.emailResult==='failed'){F.error=['Email could not be saved. Please retry.','邮箱保存失败，请重试。'];return;}
      const oldEmail=F.account.email,oldVerified=F.account.emailVerified;F.account.email=code.email;F.account.emailVerified=new Date().toISOString();if(!persist()){F.account.email=oldEmail;F.account.emailVerified=oldVerified;F.error=['Email could not be saved. Your previous email is unchanged. Please retry.','邮箱保存失败，原邮箱未变，请重试。'];return;}F.notes.push(oldEmail?['Your contact email has been updated.','联系邮箱已更新。']:['Your contact email has been verified.','联系邮箱已验证。']);F.emailFlow=false;code.valid=false;F.otp=null;F.codeInput='';persist();S.layer=null;CF.toast(L('Your contact email has been updated.','联系邮箱已更新。'));
    });
  }
  function canSubmit(){
    F.fieldErrors={};if(CF.funder.review.beforeSubmit){const message=CF.funder.review.beforeSubmit(F.account);if(message){F.error=message;return false;}}if(!F.account.email){F.error=['Verify your contact email first.','请先验证联系邮箱。'];return false;}
    F.fieldErrors=institutionErrors();
    if(Object.keys(F.fieldErrors).length){queueMicrotask(()=>$('f-validation')?.focus());return false;}
    return F.submitConsent;
  }
  function submit(){if(F.pendingSubmission){open('unknown');return;}if(F.account.status==='submitted'||F.busy||!canSubmit())return;open('submit');}
  function commitSubmit(){
    if(F.busy||F.account.status==='submitted'||!canSubmit())return;F.busy='submit';F.error=null;F.account.pending={email:F.account.email,form:JSON.parse(JSON.stringify(F.account.form)),fields:fields(),template:F.activeTemplate||'DEMO-1',submitted:new Date().toISOString()};F.pendingSubmission=true;persist();
    later(()=>{F.busy='';S.layer=null;if(F.saveResult==='failed'){F.pendingSubmission=false;delete F.account.pending;persist();F.error=['Registration could not be submitted. Your draft is saved. Please retry.','注册提交失败，草稿已保留，请重试。'];return;}
      if(F.saveResult==='unknown'){F.pendingSubmission=true;F.error=['Submission result is not yet confirmed. Check your application status.','提交结果暂未确认，请查询当前申请状态。'];open('unknown');return;}
      completeSubmit();
    });
  }
  function completeSubmit(){
    const a=F.account;if(a.status==='submitted')return;const pending=a.pending;F.notes.push(['Your registration has been submitted.','注册资料已提交。']);
    if(a.version)a.history.push({version:a.version,status:a.status,submitted:a.submitted,reviewed:a.reviewed,snapshotEmail:a.snapshotEmail,fields:a.submittedFields,form:a.submittedForm,issues:a.issues,additional:a.additional,reviewer:a.reviewer,template:a.template||'DEMO-1'});
    F.downgrade=a.status==='verified';a.reviewPending=F.downgrade;if(F.downgrade)F.notes.push(['Your institution details need review again. Funding actions are unavailable until approval.','机构资料需要重新审核，通过前暂不可发起出资操作。']);a.version++;a.status='submitted';a.submitted=pending?.submitted||new Date().toISOString();a.reviewed=null;a.snapshotEmail=pending?.email||a.email;a.submittedFields=pending?.fields||fields();a.submittedForm=pending?.form||JSON.parse(JSON.stringify(a.form));a.form=JSON.parse(JSON.stringify(a.submittedForm));delete a.pending;a.issues=[];a.additional='';a.reviewer='';a.template=pending?.template||F.activeTemplate||'DEMO-1';a.successTimes=[...(a.successTimes||[]),Date.now()];F.change=false;F.pendingSubmission=false;F.historyVersion=0;F.submitConsent=false;persist();response();go('/funder/status');CF.toast(L('Registration submitted.','注册已提交。'));
  }
  function resolveSubmission(){if(!F.pendingSubmission||F.busy)return;F.busy='query';F.error=null;later(()=>{F.busy='';if(F.queryResult==='failed'){F.error=['Unable to confirm the result. Please retry.','暂时无法确认结果，请重试。'];return;}if(F.queryResult==='absent'){F.pendingSubmission=false;delete F.account.pending;F.account.step=3;persist();go('/funder/register');F.error=['No submission was received. Your details are retained; you can submit again.','尚未收到本次提交，资料已保留，可重新提交。'];return;}completeSubmit();});}
  function changeEmail(){F.emailFlow=true;F.error=null;F.fieldErrors={};F.otp=null;F.emailInput='';F.codeInput='';F.emailStage=Date.now()<F.reauthUntil?'edit':'auth';open('email');}
  function fixture(s){
    F.generation++;F.busy='';F.error=null;F.otp=null;F.connected=address;hydrate(address);const a=F.account;a.exists=true;a.created=a.created||new Date().toISOString();a.disabled=false;delete a.pending;F.pendingSubmission=false;a.reviewPending=false;F.downgrade=false;F.reauthUntil=0;
    if(s!=='draft'){a.email=a.email||'finance@example.test';a.emailVerified=a.emailVerified||new Date().toISOString();a.form={name:'Demo Institution',country:'Demo jurisdiction',identifierType:'REG_NO',identifier:'DEMO-REG-100',institutionType:'Demo financial institution',registeredAddress:'Demo registered address',regulator:'',license:'',fileSize:204800,fileStatus:'done',contact:'contact@example.test',file:'institution-demo.pdf'};F.upload='done';a.submitted=a.submitted||new Date().toISOString();a.version=Math.max(1,a.version);a.snapshotEmail=a.email;a.submittedFields=fields();a.submittedForm=JSON.parse(JSON.stringify(a.form));a.template=F.activeTemplate||'DEMO-1';}
    a.status=s;a.issues=s==='rejected'?demoIssues():[];a.additional='';a.reviewed=['verified','rejected'].includes(s)?new Date().toISOString():null;S.role='fund';F.sessionUntil=Date.now()+4*3600000;F.load='ready';F.historyVersion=0;persist();response();S.demo=false;go(s==='draft'?'/funder/register':'/funder/status');
  }
  function demo(){return `<section class="funder-demo"><h5>${L('Funder review tools','资金方评审工具')}</h5><p class="login-caption">${L('Local simulation only. No wallet, email or backend is contacted. Field definitions follow the current institution form. Material acceptance criteria and upload limits remain unspecified.','仅本地模拟，不调用钱包、邮件或后端。字段沿用当前机构资料表；证明材料判据及上传阈值尚未确定。')}</p>${select('connection',L('Next connection result','下次连接结果'),[['success','Connected','成功'],['cancel','Cancelled','取消'],['missing','Wallet missing','无钱包'],['sdk','SDK unavailable','SDK 不可用'],['locked','Wallet locked','钱包锁定'],['network','Unsupported network','网络不支持']],F.connectionResult)}${select('provider',L('Wallet environment','钱包环境'),[['single','Single wallet','单钱包'],['multiple','Multiple wallets','多钱包选择'],['mobile','Mobile wallet','移动钱包']],F.providerMode)}${select('signature',L('Next signature result','下次签名结果'),[['success','Success','成功'],['cancel','Rejected','拒签'],['failed','Verification failed','验签失败'],['expired','Expired challenge','挑战过期'],['changed','Address changed','签名中切换地址'],['conflict','Address conflict','地址冲突'],['disabled','Disabled account','账号停用'],['slow','Wait for hardware wallet','硬件钱包等待']],F.signatureResult)}${F.busy==='sign'?btn('Complete pending signature','完成待定签名','demo','complete-sign'):''}${select('email-result',L('Email response','邮箱响应'),[['success','Success','成功'],['conflict','Already used','已占用'],['race','Conflict at verification','验证时并发占用'],['failed','Temporary failure','暂时失败']],F.emailResult)}<p class="login-caption">${L('Latest demo code','最新演示验证码')}: <b class="mono" id="f-demo-code">${F.latestCode}</b></p><div class="seg">${btn('Pass 60 seconds','推进 60 秒','demo','cooldown')}${btn('Expire code','验证码过期','demo','expire-code')}${btn('5 resend limit','重发达 5 次','demo','resend-limit')}${btn('10 daily limit','日发送达 10 次','demo','daily-limit')}</div>${select('query-result',L('Submission status response','提交查询响应'),[['success','Received','已收到'],['failed','Query failed','查询失败'],['absent','Not received','未收到']],F.queryResult||'success')}${select('save-result',L('Submit / save response','提交 / 保存响应'),[['success','Success','成功'],['failed','Failed','失败'],['unknown','Submission unknown','提交结果未知']],F.saveResult)}<div class="grp"><h5>${L('Account fixtures','账户样例')}</h5><div class="seg">${['draft','submitted','rejected','verified'].map(s=>btn(...({draft:['Draft','草稿'],submitted:['Under review','审核中'],rejected:['Rejected','已驳回'],verified:['Verified','已认证']}[s]),'fixture',s)).join('')}</div></div><div class="seg">${btn('Review: approve','审核返回：通过','demo','approve')}${btn('Review: reject','审核返回：驳回','demo','reject')}${btn('Session expired','会话到期','demo','expire')}${btn('Disable account','账号停用','demo','disable')}${btn('Restore account','恢复账号','demo','restore')}${btn('Disconnect provider','断开钱包','demo','disconnect')}${btn('Switch provider address','钱包切换地址','demo','switch-address')}</div><div class="seg">${btn('Account settings','账户设置','account')}${btn('Access and return demo','权限与回跳演示','demo','gate')}${btn('Invalid return','无效回跳','demo','invalid-return')}${btn('Loading','加载中','demo','loading')}${btn('Load failure','加载失败','demo','error')}${btn('Load ready','加载完成','demo','ready')}${btn('Template unavailable','模版不可用','demo','template-error')}${btn('Template loading','模版加载中','demo','template-loading')}${btn('Template ready','模版就绪','demo','template-ready')}${btn('Upload failure','上传失败','demo','upload-error')}${btn('Reset demo account','重置演示账户','demo','reset')}</div><p class="login-caption">${L('Replay attempts','原动作重执行次数')}: ${F.replayed}</p></section>`;}
  function select(key,title,values,value){return `<label for="f-demo-${key}">${title}</label><select id="f-demo-${key}" class="inp">${values.map(x=>`<option value="${x[0]}" ${x[0]===value?'selected':''}>${L(x[1],x[2])}</option>`).join('')}</select>`;}
  const layers={
    'f-connect':()=>({title:L('Wallet connection · simulation','钱包连接 · 演示'),html:`<p>${L('Simulate the response from your wallet.','模拟钱包返回的连接结果。')}</p>${F.providerMode==='multiple'?`<div class="funder-form">${btn('Demo wallet A','演示钱包 A','connect-done')}${btn('Demo wallet B','演示钱包 B','connect-other')}</div>`:F.providerMode==='mobile'?`<p>${L('Mobile wallet handoff (WalletConnect / deep link).','移动钱包连接交接（WalletConnect / 深链）。')}</p>`:''}`,foot:btn('Cancel','取消','cancel-connect')+(F.providerMode!=='multiple'?btn('Simulate connection','模拟连接成功','connect-done','','primary'):'')}),
    'f-signature':()=>({title:L('Wallet signature · simulation','钱包签名 · 演示'),html:`<p>${F.signPurpose==='email'?L('Confirm contact email change with the signed-in wallet.','请使用当前登录钱包确认修改联系邮箱。'):L('Waiting for the wallet signature.','等待钱包签名。')}</p>${wallet(F.connected)}<p class="login-caption">${L('This message does not send a transaction or authorize assets.','本次签名不会发起交易或授权资产。')}</p>`,foot:btn('Cancel signature','取消签名','cancel-sign')+btn('Simulate signature response','模拟签名返回','signature-done','','primary')}),
    'f-email':()=>({title:L('Change contact email','修改联系邮箱'),html:F.emailStage==='auth'?`<p>${L('Sign with your wallet to confirm it’s you.','请用钱包签名确认是你本人操作。')}</p>${wallet()}${error()}${F.connected!==F.account.address?btn('Reconnect wallet','重新连接钱包','connect-auth'):''}`:`<p class="login-caption">${L("We'll send a verification code to the new address. Your current email stays in use until the new one is verified.",'验证码将发送到新邮箱。在新邮箱验证通过之前，当前邮箱仍然有效。')}</p>${codeForm()}`,foot:btn('Cancel','取消','close-email')+(F.emailStage==='auth'?btn('Sign to confirm','签名确认','reauth','','primary',!!F.busy):'')}),
    'f-submit':()=>({title:L('Submit institution registration?','确认提交机构注册？'),html:`<p>${L('Institution details cannot be edited until a review decision is issued. Confirm that the information is correct before submitting.','提交后，机构资料在审核结论出具前不可修改。请确认信息准确后提交。')}</p>${F.change?CF.note('warn',L('After submission, funding actions will be unavailable until the new review is approved.','提交后将重新进入审核，期间恢复为未认证权限。')):''}`,foot:btn('Keep editing','继续编辑','close')+btn(F.busy==='submit'?'Submitting…':'Confirm submission',F.busy==='submit'?'正在提交…':'确认提交','confirm-submit','','primary',!!F.busy)}),
    'f-unknown':()=>({title:L('Confirming submission','确认提交结果'),html:CF.note('warn',L('Check the result before editing or submitting again.','请先查询结果，再继续编辑或提交。'))+error(),foot:btn('Check current status','查询当前状态','resolve-submit','','primary')}),
    'f-gate':()=>({title:L(...({draft:['Complete your institution registration first','请先完成机构注册'],submitted:['Your registration is under review','你的注册正在审核中'],rejected:['Your registration needs changes','你的注册需要修改']}[F.account.status]||['Check your registration','查看注册状态'])),html:`<p>${L(...({draft:['Funding actions are available once your institution is verified. It takes one form and a review.','完成机构认证后即可发起出资等操作，只需填一次表并等待审核。'],submitted:["We'll email you as soon as there's a result. Funding actions unlock after approval.",'有结果会第一时间邮件通知你。审核通过后即可发起出资等操作。'],rejected:['Check the reason, update your information, and submit again.','查看驳回原因，修改后重新提交即可。']}[F.account.status]||['','']))}</p>`,foot:btn('Back','返回','close')+btn(F.account.status==='draft'?'Go to registration':'View progress',F.account.status==='draft'?'去完成注册':'查看进度','gate-next','','primary')}),
    'f-support':()=>({title:L('Contact support','联系客服'),html:`<p>${L('Support is temporarily unavailable. Please try again later.','客服渠道暂不可用，请稍后再试。')}</p>`,foot:btn('Close','关闭','close')}),
    'f-copy':a=>({title:L('Wallet address','钱包地址'),html:`<p class="mono" style="overflow-wrap:anywhere">${esc(a)}</p><p>${L('Automatic copy is unavailable. Select the address to copy it.','自动复制不可用，请选中地址手动复制。')}</p>`,foot:btn('Close','关闭','close')}),
    'f-explorer':a=>({title:L('Open block explorer','打开区块浏览器'),html:`<p>${L('Ethereum · demonstration address','Ethereum · 演示地址')}</p><p class="mono" style="overflow-wrap:anywhere">${esc(a)}</p>`,foot:btn('Cancel','取消','close')+`<a class="btn primary" href="https://etherscan.io/address/${esc(a)}" target="_blank" rel="noopener noreferrer">${L('Open explorer ↗','打开浏览器 ↗')}</a>`}),
    'f-change':()=>({title:L('Update institution details','变更机构资料'),html:`<p>${L('Your current verification remains valid while editing. After submission, the details will be reviewed again and funding actions will be unavailable during review.','编辑期间保留当前认证。提交后将重新进入审核，期间恢复为未认证权限。')}</p>`,foot:btn('Cancel','取消','close')+btn('Continue editing','继续编辑','change-start','','primary')})
  };
  function action(act,v){
    if(!act.startsWith('f-'))return false;
    const key=act.slice(2);
    if(['send','verify','change-email','reauth','submit','confirm-submit','resolve-submit','upload','remove-file','save-prefs','step','change','change-start'].includes(key)&&(S.role!=='fund'||F.account.disabled||Date.now()>F.sessionUntil)){if(S.role==='fund')logout(true);else go('/login');return true;}
    if(F.pendingSubmission&&['step','issue-field','change','change-start','upload','remove-file','confirm-submit'].includes(key)){go('/funder/register');return true;}
    switch(key){
      case 'back-role':F.generation++;F.connected='';F.consent=false;F.busy='';F.signState='A';S.role='guest';go('/login');break;
      case 'guest':S.role='guest';go('/');break;
      case 'browse':persist();go('/');break;
      case 'login':go('/login');break;
      case 'reconnect':connect('reconnect');break;
      case 'connect-auth':connect('auth');break;
      case 'connect-done':connectionDone();break;
      case 'connect-other':F.connected=other;connectionDone();break;
      case 'cancel-connect':connectionDone(true);break;
      case 'network':F.connectionResult='success';F.signState='A';F.error=null;break;
      case 'sign':requestSign('login');break;
      case 'signature-done':signatureDone();break;
      case 'cancel-sign':signatureDone(true);break;
      case 'new-address':F.generation++;S.role='guest';F.consent=false;F.busy='';F.signState='A';F.signatureResult='success';F.connected=F.connected||other;go('/funder/sign');break;
      case 'agreements':CF.openLayer('modal','agreement','0');break;
      case 'account':go('/funder/account');break;
      case 'status':F.historyVersion=0;go('/funder/status');break;
      case 'register':F.historyVersion=0;F.submitConsent=false;F.change=false;if(F.account.status==='rejected')F.account.step=F.account.email?2:1;go('/funder/register');break;
      case 'step':if(F.account.status==='submitted'){go('/funder/status');break;}if(Number(v)===3&&!F.account.email){F.account.step=1;F.error=['Verify your contact email before reviewing your submission.','请先验证联系邮箱，再确认提交。'];break;}F.account.step=Number(v);F.error=null;persist();break;
      case 'send':send();break;
      case 'verify':verify();break;
      case 'submit':submit();break;
      case 'confirm-submit':commitSubmit();break;
      case 'resolve-submit':S.layer=null;resolveSubmission();break;
      case 'refresh':F.load='loading';later(()=>{F.load='ready';response();CF.toast(L('Status refreshed.','状态已刷新。'));});break;
      case 'load-retry':F.load='loading';later(()=>{F.load='ready';});break;
      case 'template-retry':F.template='loading';later(()=>{F.template='ready';});break;
      case 'change-email':changeEmail();break;
      case 'reauth':requestSign('email');break;
      case 'close-email':F.emailFlow=false;F.generation++;F.otp=null;F.busy='';F.error=null;F.emailInput=F.account.email;F.codeInput='';CF.closeLayer();break;
      case 'close':if(F.busy==='submit')break;CF.closeLayer();break;
      case 'logout':logout();break;
      case 'support':open('support');break;
      case 'copy':if(navigator.clipboard?.writeText)navigator.clipboard.writeText(v).then(()=>CF.toast(L('Address copied','地址已复制'))).catch(()=>open('copy',v));else open('copy',v);break;
      case 'explorer':open('explorer',v);break;
      case 'change':open('change');break;
      case 'change-start':F.change=true;F.account.step=2;F.submitConsent=false;go('/funder/register');break;
      case 'history':F.historyVersion=Number(v);break;
      case 'issue-field':F.account.step=2;go('/funder/register');setTimeout(()=>{const target=v==='file'?$('f-material'):v==='template'?$('f-name'):$('f-'+v);target?.scrollIntoView({block:'center'});target?.focus();},50);break;
      case 'gate':gate();break;
      case 'gate-next':F.returnTo='valid';go(F.account.status==='draft'?'/funder/register':'/funder/status');break;
      case 'pick-file':$('f-file')?.click();break;
      case 'upload':startUpload();break;
      case 'remove-file':if(F.account.status==='submitted'){CF.toast(L('Institution details are locked during review.','审核中机构资料不可修改。'));break;}F.uploadVersion++;F.account.form.file='';F.account.form.fileSize=0;F.account.form.fileStatus='';F.upload='idle';persist();CF.toast(L('File deleted','文件已删除'));break;
      case 'anchor':queueMicrotask(()=>$(v)?.scrollIntoView({block:'start'}));break;
      case 'fixture':fixture(v);break;
      case 'demo':demoAction(v);break;
      default:return false;
    }
    return true;
  }
  function demoAction(v){
    switch(v){
      case 'cooldown':if(F.otp)F.otp.sent-=60000;break;
      case 'expire-code':if(F.otp)F.otp.expires=0;break;
      case 'resend-limit':if(F.otp){F.otp.resends=5;F.otp.sent=0;}break;
      case 'daily-limit':F.sends[F.emailInput.trim().toLowerCase()]=Array(10).fill(Date.now());if(F.otp)F.otp.sent=0;break;
      case 'complete-sign':F.signatureResult='success';signatureDone();break;
      case 'approve':case 'reject':
        if(F.account.status!=='submitted'){CF.toast(L('Only a submitted application can receive a review result.','仅已提交申请可接收审核结果。'));break;}
        F.account.status=v==='approve'?'verified':'rejected';F.account.issues=v==='reject'?demoIssues():[];F.account.additional='';F.account.reviewed=new Date().toISOString();F.account.reviewPending=false;F.downgrade=false;F.notes.push(v==='approve'?['Your institution is verified.','机构审核已通过。']:['Your registration needs changes.','机构注册需要修改。']);persist();response();S.demo=false;
        if(v==='approve'&&F.returnTo==='valid'){go('/demo/funder/action');later(gate,30);}else go('/funder/status');break;
      case 'expire':S.demo=false;logout(true);break;
      case 'disable':F.account.disabled=true;persist();logout();CF.toast(L('Your account has been disabled.','你的账号已停用。'));break;
      case 'restore':F.account.disabled=false;F.signatureResult='success';persist();break;
      case 'disconnect':F.connected='';break;
      case 'switch-address':F.connected=other;break;
      case 'gate':S.demo=false;go('/demo/funder/action');break;
      case 'invalid-return':F.returnTo='invalid';break;
      case 'loading':F.load='loading';S.demo=false;break;
      case 'error':F.load='error';S.demo=false;break;
      case 'ready':F.load='ready';break;
      case 'template-error':F.template='error';F.account.step=2;go('/funder/register');S.demo=false;break;
      case 'template-loading':F.template='loading';F.account.step=2;go('/funder/register');S.demo=false;break;
      case 'template-ready':F.template='ready';break;
      case 'upload-error':F.upload='failed';break;
      case 'reset':F.generation++;F.accounts={};F.account=blank();F.connected='';F.busy='';F.error=null;F.entryError=null;F.otp=null;F.sends={};F.returnTo='';F.replayed=0;F.template='ready';F.load='ready';F.signatureResult='success';F.connectionResult='success';F.emailResult='success';F.saveResult='success';F.queryResult='success';F.notes=[];F.pendingSubmission=false;F.downgrade=false;F.reauthUntil=0;F.change=false;F.emailFlow=false;F.fieldErrors={};try{localStorage.removeItem('hc_funder_demo');}catch(e){}S.role='guest';S.demo=false;go('/login');break;
    }
  }
  function afterRender(){
    const panel=$('demoPanel');if(S.demo&&!panel.querySelector('.funder-demo'))panel.insertAdjacentHTML('afterbegin',demo());
    if(S.page==='P-L01'&&F.entryError&&!$('f-entry-error'))$('focusContent').insertAdjacentHTML('beforeend',`<p id="f-entry-error" class="note red" role="alert">${L(...F.entryError)}</p>`);
    if(S.role==='fund'){
      document.querySelectorAll('[data-v="inst"]').forEach(e=>{e.hidden=false;e.dataset.act=F.account.status==='draft'?'f-register':'f-status';e.textContent=L('User information','用户信息');});
      document.querySelectorAll('[data-act="login-notifications"]').forEach(e=>e.dataset.act='f-notifications');
    }
    const dialog=document.querySelector('#layers [role="dialog"]');if(dialog){if(S.layer?.key.startsWith('f-'))F.layerOpen=true;['portal','focus','demoPanel','demoBtn'].forEach(id=>$(id).inert=true);}
    else {['portal','focus','demoPanel','demoBtn'].forEach(id=>$(id).inert=false);if(F.layerOpen){const back=F.focusBack;F.layerOpen=false;F.focusBack=null;queueMicrotask(()=>{const target=back&&(back.id?$(back.id):Array.from(document.querySelectorAll('[data-act]')).find(el=>el.dataset.act===back.act&&(el.dataset.v||'')===(back.value||'')&&el.getClientRects().length));target?.focus({preventScroll:true});});}}
  }
  document.addEventListener('input',e=>{
    const id=e.target.id;
    if(['f-name','f-country','f-identifier','f-institutionType','f-registeredAddress','f-regulator','f-license','f-contact'].includes(id)&&(F.account.status==='submitted'||F.pendingSubmission)){CF.toast(L('Institution details are locked during review.','审核中机构资料不可修改。'));return;}
    if(id==='f-email'){F.emailInput=e.target.value;delete F.fieldErrors.email;}
    else if(id==='f-code'){F.codeInput=e.target.value;delete F.fieldErrors.code;}
    else if(['f-name','f-country','f-identifier','f-institutionType','f-registeredAddress','f-regulator','f-license','f-contact'].includes(id)){F.account.form[id.slice(2)]=e.target.value;delete F.fieldErrors[id.slice(2)];persist();}
  });
  document.addEventListener('change',e=>{
    const id=e.target.id,v=e.target.value;
    if(id==='f-consent')F.consent=e.target.checked;
    else if(id==='f-submit-consent')F.submitConsent=e.target.checked;
    else if(id==='f-identifierType'){if(F.account.status==='submitted'||F.pendingSubmission)return;F.account.form.identifierType=v;persist();}
    else if(id==='f-language')savePreference('lang',v);
    else if(id==='f-timezone')savePreference('tz',v);
    else if(id==='f-file'){if(F.account.status==='submitted'||F.pendingSubmission)return;const file=e.target.files[0];if(file)startUpload(file);else return;}
    else if(id.startsWith('f-demo-')){const key={'connection':'connectionResult','provider':'providerMode','signature':'signatureResult','email-result':'emailResult','save-result':'saveResult','query-result':'queryResult'}[id.slice(7)];if(key)F[key]=v;}
    else return;
    CF.render();queueMicrotask(()=>{$(id)?.focus({preventScroll:true});afterRender();});
  });
  // Closing any transient response by Escape/backdrop has the same cancellation semantics.
  document.addEventListener('click',e=>{
    const a=e.target.closest('[data-act]');if(!a)return;
    // 文件选择器返回前保留原 input，避免公共点击重绘丢失 change 事件。
    if(a.dataset.act==='f-pick-file'){e.preventDefault();e.stopImmediatePropagation();$('f-file')?.click();return;}
    const key=S.layer?.key;
    if(a.dataset.act==='closelayer'&&key?.startsWith('f-')&&!(a.classList.contains('modal-mask')&&e.target.closest('.modal'))){e.preventDefault();e.stopImmediatePropagation();cancelLayer(key);return;}
    if(a.dataset.act==='lang'){$('toasts').innerHTML='';try{localStorage.setItem('hc_funder_language',a.dataset.v);}catch(e){}}
    if(a.dataset.act==='f-notifications'){e.preventDefault();e.stopImmediatePropagation();CF.openLayer('modal','f-notices');queueMicrotask(afterRender);}
  },true);
  function cancelLayer(key){if(key==='f-connect')connectionDone(true);else if(key==='f-signature')signatureDone(true);else if(key==='f-email'){action('f-close-email');}else if(key==='f-submit'&&F.busy==='submit'){CF.toast(L('Submission is in progress. Please wait.','正在提交，请稍候。'));}else CF.closeLayer();}
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.layer?.key.startsWith('f-')){e.preventDefault();e.stopImmediatePropagation();cancelLayer(S.layer.key);}},true);
  layers['f-notices']=()=>({title:L('Account notifications','账户通知'),html:F.notes.length?F.notes.map(n=>`<div class="login-agreement-row">${esc(L(...n))}${link('View registration','查看注册状态','status')}</div>`).join(''):CF.empty(L('No new notifications','暂无新通知'),'',''),foot:btn('Close','关闭','close')});
  window.addEventListener('hashchange',()=>{if(F.emailFlow){F.generation++;F.emailFlow=false;F.busy='';F.otp=null;}if(F.busy==='sign'&&!location.hash.startsWith('#/funder/sign')&&F.signPurpose==='login'){F.generation++;F.busy='';}});
  setInterval(()=>{
    const sendButton=$('f-send');if(sendButton){sendButton.textContent=sendLabel();sendButton.disabled=remaining()>0||F.busy==='send';}
    if(S.role==='fund'&&F.sessionUntil&&Date.now()>F.sessionUntil)logout(true);
    if(F.busy==='sign'&&Date.now()-F.signatureStarted>300000){F.signatureResult='expired';signatureDone();}
  },1000);
  read();
  try{const prefs=JSON.parse(localStorage.getItem('hc_funder_preferences')||'null');if(prefs&&['en','zh'].includes(prefs.lang)&&typeof prefs.tz==='string'){new Intl.DateTimeFormat('en',{timeZone:prefs.tz});F.savedPreferences=prefs;S.lang=prefs.lang;}}catch(e){}
  CF.funder={dict,layers,content,action,connect,notices,afterRender,logout};
  CF.funder.review={
    get account(){return F.account;}, get state(){return F;}, persist,
    seed:fixture, fields, response,
    activate(){S.role='fund';F.connected=F.account.address;F.sessionUntil=Date.now()+4*3600000;response();},
    decide(version,status,issues,additional){
      const a=F.account;if(a.version!==version||a.status!=='submitted')return false;
      a.status=status;a.reviewed=new Date().toISOString();a.issues=issues||[];a.additional=additional||'';a.reviewer='DEMO-OP-01';
      F.notes.push(status==='verified'?['Your institution is verified. View your registration result.','机构认证已通过，可查看认证结果。']:['Registration rejected. View all reasons and update your details.','机构认证已驳回，请查看全部原因并修改资料。']);
      F.downgrade=false;a.reviewPending=false;persist();response();return true;
    }
  };
})(window.CF);
