/* 企业账户（面客 · 资产方与资金方双侧）。继承面客端 portal 壳层与公共组件，
   本模块只提供总览页内容、账户维护抽屉与确认弹窗；导航、路由、浮层宿主仍由 _shared/shell.js 提供。
   账户目录在 ./演示数据.js（CF.EA），报价、放款、还款与控制台读取同一份，不另建第二套。
   钱包、签名、服务端校验与投递均为本地演示，不发网络请求。 */
(function(CF){
  'use strict';
  const S=CF.S,L=CF.L,E=CF.esc,EA=CF.EA;
  const PAGE='P-F-EA-01',ROUTE='/account/receiving';
  CF.PAGES[PAGE]={end:'asset',layout:'portal',navKey:'navEnterpriseAccounts',auth:true};
  CF.ENTRY[PAGE]=ROUTE;
  const dict={en:{navEnterpriseAccounts:'Enterprise accounts'},zh:{navEnterpriseAccounts:'企业账户'}};

  /* scene 为整页读取状态；unverified 模拟尚未取得业务资格；sign / save 为下次请求响应。 */
  const V={scene:'ready',unverified:false,flow:null,busy:'',problem:'',pending:null,
    saveResult:'success',copyValue:'',returnTo:'',returnKind:'',returnBiz:'',epoch:0};

  const owner=()=>EA.owner();
  const eligible=()=>{
    const e=CF.portalEligible?CF.portalEligible():{verified:true};
    return V.unverified?Object.assign({},e,{verified:false}):e;
  };
  const b=(act,en,zh,v='',primary=false,off=false)=>'<button type="button" class="btn'+(primary?' primary':'')+
    '" data-act="ea-'+act+'" data-v="'+E(v)+'"'+(off?' disabled':'')+'>'+L(en,zh)+'</button>';
  const sm=(act,en,zh,v='',extra='')=>'<button type="button" class="btn sm" data-act="ea-'+act+'" data-v="'+E(v)+'"'+extra+'>'+L(en,zh)+'</button>';
  const dl=rows=>'<dl class="dl ea-dl">'+rows.map(r=>'<dt>'+r[0]+'</dt><dd>'+r[1]+'</dd>').join('')+'</dl>';
  const time=iso=>iso?E(CF.fmtTime(iso)):'—';
  const copyable=(value,label)=>'<span class="copy-pair"><span class="mono">'+E(value)+'</span>'+
    CF.copyBtn('ea-copy',value,label)+'</span>';

  /* ------------------------------------------------------------------ 总览 */
  function head(){
    return '<div class="page-head"><div><h1 class="page-title">'+L('Enterprise accounts','企业账户')+'</h1>'+
      '<p class="page-desc">'+L('Register the accounts that receive money for your company. Business workflows select from these accounts.',
        '登记本企业的收款账户；办理业务时从这里已登记的账户中选用。')+'</p></div>'+
      '<div class="page-actions">'+CF.tag('',L('Demonstration data','演示数据'))+'</div></div>';
  }
  function guidance(e){
    const act=e.act?'<button type="button" class="btn primary" data-act="'+E(e.act)+'" data-v="'+E(e.value||'')+'">'+
      L(...(e.label||['Complete the requirement','前往完成'])) +'</button>':'';
    return CF.note('warn','<div><p>'+L('Your company can register receiving accounts once this account is verified.',
      '本企业完成认证后即可登记收款账户。')+'</p><p>'+L('Until then this page does not show or return any account.',
      '在此之前，本页不展示也不返回任何账户。')+'</p>'+(act?'<div class="detail-actions">'+act+'</div>':'')+'</div>');
  }
  /* 未登录与登录未绑定角色都取不到本企业账户；这里给本页的引导，不套用消息中心文案。 */
  function accessSurface(){
    if(S.role==='signed')return CF.empty(L('This page is not available for your current role','该页面不适用于当前身份'),
      L('Enterprise accounts belong to an asset holder or funder account.','企业账户属于已绑定角色的资产方或资金方账号。'),
      '<button class="btn primary" type="button" data-act="go" data-v="/assets">'+L('Back to assets','返回资产广场')+'</button>');
    return CF.empty(L('Sign in to view your enterprise accounts','登录后查看本企业收款账户'),
      L('After signing in, you will return to this page.','登录后将返回当前页面。'),
      '<button class="btn primary" type="button" data-act="signin">'+L('Sign in','登录')+'</button>');
  }
  function loadError(){
    return CF.empty(L('Your accounts are temporarily unavailable','暂时无法读取本企业账户'),
      L('This is not a sign that no account is registered. Retry, or come back in a moment.','这不表示尚未登记账户。请重试，或稍后再来。'),
      '<button class="btn primary" type="button" data-act="ea-reload">'+L('Retry','重试')+'</button>');
  }
  function returnBanner(){
    if(!V.returnTo)return '';
    return CF.note('accent','<div><p>'+L('Register the account you need, then go back and select it in that business.',
      '登记需要的账户后，返回原办理继续选用。')+'</p><div class="detail-actions">'+
      b('return','Back to that business','返回原办理','',true)+'</div></div>');
  }
  function list(kind){
    const rows=EA.accounts(owner(),kind);
    const title=kind==='fiat'?L('Fiat receiving accounts','法币收款账户'):L('Digital-currency receiving accounts','数币收款账户');
    const badge=kind==='fiat'?CF.tag('',EA.CURRENCY):CF.tag('',EA.TOKENS);
    const empty=V.scene==='empty'||!rows.length;
    /* 空态里已经有一个明确的新增出路，卡片头不再重复同一个动作。 */
    const add=empty?'':sm('add','Add account','新增账户',kind);
    const body=empty
      ? CF.empty(kind==='fiat'?L('No fiat receiving account yet','尚未登记法币收款账户'):L('No receiving address yet','尚未登记数币收款地址'),
          kind==='fiat'?L('Add one to receive settlement in USD.','登记后即可用于 USD 结算收款。')
            :L('Add an address on the chain you want to receive on.','登记你要用于收款的链上地址。'),
          b('add','Add account','新增账户',kind,true))
      : '<ul class="ea-list">'+rows.map(row).join('')+'</ul>';
    return '<section class="card ea-card"><div class="card-head"><h2 class="ea-card-title">'+title+'</h2>'+badge+
      '<span class="sub">'+(V.scene==='empty'?0:rows.length)+L(' registered',' 个已登记')+'</span>'+add+'</div>'+
      '<div class="card-b">'+body+'</div></section>';
  }
  function row(a){
    const miss=EA.missing(a);
    return '<li class="ea-row"><div class="ea-row-main"><div class="ea-row-title"><b>'+EA.name(a)+'</b>'+
      (a.kind==='crypto'?CF.tag('accent',a.chain):'')+(a.primary?CF.tag('ok',L('Default','默认账户')):'')+'</div>'+
      '<div class="ea-row-key">'+EA.key(a)+'</div>'+
      (miss.length?'<p class="err-msg">'+L('Incomplete: ','信息不完整：')+miss.map(k=>L(...EA.labels[k])).join(L(', ','、'))+
        L(' · complete it before this account can be selected',' · 补齐后才能在业务中选用')+'</p>':'')+'</div>'+
      '<div class="ea-row-meta"><span class="k">'+L('Registered at','登记时间')+'</span><span class="v">'+time(a.at)+'</span></div>'+
      '<div class="ea-row-actions">'+sm('view','View','查看',a.id)+sm('edit','Edit','修改',a.id)+
      (a.primary?sm('undefault','Unset default','取消默认',a.id):sm('default','Set as default','设为默认',a.id))+
      sm('remove','Delete','删除',a.id)+'</div></li>';
  }
  function page(){
    if(!['asset','fund'].includes(S.role))return head()+accessSurface();
    const e=eligible();
    if(!e.verified)return head()+guidance(e);
    if(V.scene==='loading')return head()+CF.skelTable(4);
    if(V.scene==='error')return head()+loadError();
    return head()+returnBanner()+'<div class="ea-stack">'+list('fiat')+list('crypto')+'</div>';
  }

  /* ------------------------------------------------------------------ 表单 */
  const blankFiat=()=>({label:'',addressCountry:'',addressCity:'',addressLine:'',iban:'',bank:'',
    bankCity:'',bankCountry:'',swift:'',interSwift:'',interName:'',interAccount:''});
  const fromAccount=a=>a.kind==='crypto'?{label:EA.name(a),chain:a.chain,address:a.address}
    :Object.assign(blankFiat(),{label:EA.name(a),addressCountry:a.addressCountry||'',addressCity:a.addressCity||'',
      addressLine:a.addressLine||'',iban:a.iban||'',bank:a.bank||'',bankCity:a.bankCity||'',bankCountry:a.bankCountry||'',
      swift:a.swift||'',interSwift:a.interSwift||'',interName:a.interName||'',interAccount:a.interAccount||''});
  const F=()=>V.flow;
  const val=k=>String(F().form[k]||'');
  const err=k=>F().errors[k]||'';

  const required=k=>EA.fiatRequired.includes(k)||k==='address';
  function field(k,type='text',extra=''){
    const id='ea-f-'+k;
    return '<div class="field"><label for="'+id+'">'+L(...EA.labels[k])+'</label>'+
      '<input class="inp" id="'+id+'" data-ea-field="'+k+'" type="'+type+'" value="'+E(val(k))+'"'+
      (required(k)?' aria-required="true"':'')+(err(k)?' aria-invalid="true"':'')+' aria-describedby="'+id+'-err" '+extra+'>'+
      '<span class="err-msg" id="'+id+'-err" role="alert">'+E(err(k))+'</span></div>';
  }
  function regionField(k){
    const id='ea-f-'+k;
    const name=c=>{try{return new Intl.DisplayNames([S.lang==='zh'?'zh-CN':'en'],{type:'region'}).of(c);}catch(_){return c;}};
    const codes=EA.REGIONS.includes(val(k))||!val(k)?EA.REGIONS:EA.REGIONS.concat(val(k));
    return '<div class="field"><label for="'+id+'">'+L(...EA.labels[k])+'</label>'+
      '<select class="inp" id="'+id+'" data-ea-field="'+k+'"'+(required(k)?' aria-required="true"':'')+(err(k)?' aria-invalid="true"':'')+' aria-describedby="'+id+'-err">'+
      '<option value="">'+L('Select…','请选择…')+'</option>'+
      codes.map(c=>'<option value="'+E(c)+'"'+(val(k)===c?' selected':'')+'>'+E(name(c))+'</option>').join('')+'</select>'+
      '<span class="err-msg" id="'+id+'-err" role="alert">'+E(err(k))+'</span></div>';
  }
  const group=(title,html,extra='')=>'<section class="ea-group"><h3>'+title+'</h3>'+(extra||'')+
    '<div class="ea-grid">'+html+'</div></section>';

  function fiatForm(){
    const f=F();
    return '<div class="ea-drawer">'+(f.problem?CF.note('red',E(f.problem)):'')+
      group(L('Account','账户信息'),
        '<div class="ea-full">'+field('label')+'</div>'+
        '<div class="ea-full"><div class="field"><span class="field-label">'+L(...EA.labels.ccy)+'</span>'+
        '<span class="field-static">'+EA.CURRENCY+'</span></div></div>')+
      group(L('Beneficiary','收款人信息'),regionField('addressCountry')+field('addressCity')+
        '<div class="ea-full">'+field('addressLine')+'</div>')+
      group(L('Beneficiary bank','收款行信息'),field('iban')+field('bank')+field('bankCity')+regionField('bankCountry')+
        field('swift','text','maxlength="11" autocapitalize="characters"'))+
      group(L('Intermediary bank (optional)','中转行信息（选填）'),field('interSwift')+field('interName')+
        '<div class="ea-full">'+field('interAccount')+'</div>',
        '<p class="hint">'+L('Optional as a set. If you fill in one field, complete all three. Ask your beneficiary bank whether an intermediary is needed.',
          '整组选填；填写其中一项就要三项齐全。是否需要中转行，请向收款行确认。')+'</p>')+
      (f.conflict?CF.note('warn',L('The bank country / region does not match the country segment of the SWIFT / BIC code. Save it anyway if that is correct.',
        '收款行国家 / 地区与 SWIFT / BIC 的国家段不一致。确认无误可继续保存。')):'')+
      (f.duplicate?CF.note('warn','<div><p>'+L('This account number and SWIFT / BIC are already registered for your company.',
        '本企业已登记过相同账号与 SWIFT / BIC 的账户。')+'</p><div class="detail-actions">'+
        sm('view','View the existing account','查看已登记的那一条',f.duplicate)+'</div></div>'):'')+'</div>';
  }
  function cryptoForm(){
    const f=F();
    if(f.mode==='edit')return '<div class="ea-drawer">'+(f.problem?CF.note('red',E(f.problem)):'')+
      group(L('Account','账户信息'),'<div class="ea-full">'+field('label')+'</div>')+
      dl([[L(...EA.labels.chain),E(f.form.chain)],[L(...EA.labels.address),'<span class="mono">'+E(f.form.address)+'</span>']])+
      '<p class="hint">'+L('The chain and address are fixed once registered, because ownership was proved for that one address. To use another address, add a new account and sign again; this one can then be deleted.',
        '结算收款链与收款地址登记后不可修改——地址所有权是对那一个地址签名的结果。要换地址请新增账户并重新签名，旧账户可另行删除。')+'</p></div>';
    const step=f.step;
    const steps='<ol class="ea-steps">'+[[1,'Chain','选择链'],[2,'Address','填写地址'],[3,'Ownership','地址所有权']]
      .map(s=>'<li data-complete="'+(step>s[0])+'" aria-current="'+(step===s[0]?'step':'false')+'">'+s[0]+'. '+L(s[1],s[2])+'</li>').join('')+'</ol>';
    let body='';
    if(step===1){
      body=CF.note('warn','<div><p>'+L('You can only register an address you can sign with: adding it requires a signature from that address to prove you own it.',
        '只能登记你能签名的地址：添加时需要用这个地址本身签名，以证明它归你所有。')+'</p><p>'+
        L('Exchange deposit addresses, third-party custodial addresses and contract addresses that cannot sign are not supported.',
          '交易所充值地址、第三方托管地址以及无法签名的合约地址都无法登记。')+'</p></div>')+
        '<p class="ea-lead">'+L('Select the chain your address is on, then enter the address. The chain cannot be changed after the account is saved.',
          '请先选择收款地址所在的链，再填写地址。链一经登记不可修改。')+'</p>'+
        '<fieldset class="ea-chains"><legend class="sr-only">'+L(...EA.labels.chain)+'</legend>'+
        EA.CHAINS.map(c=>'<label class="ea-chain"><input type="radio" name="ea-chain" value="'+c+'" data-ea-chain="'+c+'"'+
          (f.form.chain===c?' checked':'')+'><span><b>'+c+'</b><span class="hint">'+
          (c==='ETH'?L('Address starts with 0x','地址以 0x 开头'):L('Address starts with T','地址以 T 开头'))+'</span></span></label>').join('')+
        '</fieldset><span class="err-msg" role="alert">'+E(err('chain'))+'</span>';
    }else if(step===2){
      body='<div class="ea-chosen">'+dl([[L(...EA.labels.chain),E(f.form.chain)],[L('Tokens accepted','可接收代币'),EA.TOKENS]])+'</div>'+
        group(L('Address','地址信息'),'<div class="ea-full">'+field('label')+'</div>'+
          '<div class="ea-full">'+field('address','text','spellcheck="false" autocomplete="off"')+'</div>')+
        (f.duplicate?CF.note('warn','<div><p>'+L('This address is already saved for your company.','这个地址已经在本企业登记过了。')+
          '</p><div class="detail-actions">'+sm('view','View the existing account','查看已登记的那一条',f.duplicate)+'</div></div>'):'');
    }else{
      body=dl([[L(...EA.labels.label),E(f.form.label)],[L(...EA.labels.chain),E(f.form.chain)],
        [L(...EA.labels.address),'<span class="mono">'+E(f.form.address)+'</span>']])+
        '<p class="ea-lead">'+L('Sign with this address to confirm you own it. This signature does not change how you sign in, and it does not switch your login wallet.',
          '请用这个地址签名，确认它归你所有。此次签名不会改变你的登录方式，也不会更换登录钱包。')+'</p>'+
        (f.problem?CF.note('red',E(f.problem)):'');
    }
    return '<div class="ea-drawer">'+steps+body+'</div>';
  }
  function formTitle(){
    const f=F();
    if(f.kind==='fiat')return f.mode==='edit'?L('Edit fiat account','修改法币收款账户'):L('Add fiat account','新增法币收款账户');
    return f.mode==='edit'?L('Edit account name','修改账户备注名'):L('Add receiving address','新增数币收款账户');
  }
  function formFoot(){
    const f=F(),busy=V.busy==='save';
    const cancel=b('close','Cancel','取消','',false,busy);
    if(f.kind==='fiat'||f.mode==='edit')
      return cancel+b('save',busy?'Saving…':f.conflict?'Save anyway':'Save',busy?'正在保存…':f.conflict?'确认并保存':'保存','',true,busy);
    if(f.step===1)return cancel+b('next','Next','下一步','',true);
    if(f.step===2)return cancel+b('back','Back','上一步')+b('next','Next: prove ownership','下一步：证明地址所有权','',true);
    return cancel+b('back','Back','上一步','',false,busy)+b('sign',busy?'Waiting for signature…':'Sign with this address',busy?'等待签名…':'用该地址签名','',true,busy);
  }

  /* ------------------------------------------------------------------ 校验与保存 */
  function validateFiat(){
    const f=F(),e={};
    EA.fiatRequired.forEach(k=>{if(!val(k).trim())e[k]=L('This field is required.','该项为必填。');});
    if(val('swift').trim()&&!EA.swiftValid(val('swift')))
      e.swift=L('Enter 8 or 11 letters or digits.','请输入 8 位或 11 位字母数字。');
    const inter=['interSwift','interName','interAccount'].filter(k=>val(k).trim());
    if(inter.length&&inter.length<3)['interSwift','interName','interAccount'].forEach(k=>{
      if(!val(k).trim())e[k]=L('Complete all three intermediary fields, or clear them all.','中转行三项须齐全，或整组留空。');});
    f.errors=e;
    if(Object.keys(e).length)return false;
    const dup=EA.duplicateFiat(owner(),val('iban'),val('swift'),f.id);
    f.duplicate=dup?dup.id:'';
    if(dup)return false;
    f.conflict=!!(EA.swiftCountry(val('swift'))&&val('bankCountry')&&EA.swiftCountry(val('swift'))!==val('bankCountry'))&&!f.ack;
    if(f.conflict)return false;
    return true;
  }
  function validateAddress(){
    const f=F(),e={};
    if(!val('label').trim())e.label=L('This field is required.','该项为必填。');
    const address=val('address').trim();
    if(!address)e.address=L('This field is required.','该项为必填。');
    else if(!EA.addressValid(f.form.chain,address))
      e.address=f.form.chain==='ETH'?L('That is not a valid ETH address. It should start with 0x followed by 40 hexadecimal characters.',
        '这不是一个有效的 ETH 地址，应以 0x 开头并包含 40 位十六进制字符。')
        :L('That is not a valid TRON address. It should start with T.','这不是一个有效的 TRON 地址，应以 T 开头。');
    f.errors=e;
    if(Object.keys(e).length)return false;
    const dup=EA.duplicateCrypto(owner(),f.form.chain,address);
    f.duplicate=dup?dup.id:'';
    return !dup;
  }
  /* 保存进行中让用户知道处理未完成；失败时账户保持上一次成功状态，不产生半条账户。 */
  function later(run){
    V.busy='save';V.problem='';const token=++V.epoch,f=F();CF.render();
    setTimeout(()=>{
      if(token!==V.epoch||F()!==f)return;
      V.busy='';
      if(V.saveResult==='failed'){f.problem=L('Could not save. Your account is unchanged; please retry.','保存失败，账户保持原状，请重试。');CF.render();return;}
      run();
    },450);
  }
  function commitFiat(){
    const f=F(),form=f.form;
    const patch={label:form.label.trim(),ccy:EA.CURRENCY,addressCountry:form.addressCountry,addressCity:form.addressCity.trim(),
      addressLine:form.addressLine.trim(),iban:form.iban.trim(),bank:form.bank.trim(),bankCity:form.bankCity.trim(),
      bankCountry:form.bankCountry,swift:form.swift.trim().toUpperCase(),interSwift:form.interSwift.trim(),
      interName:form.interName.trim(),interAccount:form.interAccount.trim()};
    if(f.mode==='edit')EA.update(f.id,patch);else EA.add(Object.assign({kind:'fiat'},patch));
    V.flow=null;CF.closeLayer();
    CF.toast(f.mode==='edit'?L('Account saved.','账户已保存。'):L('Account registered.','账户已登记。'));
  }
  function commitAddress(){
    const f=F();
    EA.add({kind:'crypto',chain:f.form.chain,label:f.form.label.trim(),address:f.form.address.trim(),confirmed:'signed'});
    V.flow=null;CF.closeLayer();
    CF.toast(L('Address registered.','收款地址已登记。'));
  }
  /* 钱包对话框是模拟的签名宿主，不是产品页面的一部分：它给出本次签名的结果。 */
  function signature(r){
    const f=F();
    V.busy='save';f.problem='';S.layer=V.pending||S.layer;V.pending=null;
    const token=++V.epoch;CF.render();
    setTimeout(()=>{
      if(token!==V.epoch||F()!==f)return;
      V.busy='';
      if(r==='mismatch')f.problem=L('The signing address does not match the address you are adding. Please sign with that address.',
        '签名的地址和你要登记的地址不是同一个，请用该地址签名。');
      else if(r==='rejected')f.problem=L('The signature was not completed, so the account was not saved. You can try again.',
        '本次没有完成签名，账户尚未登记，你可以重试。');
      else if(r==='unavailable')f.problem=L('Your wallet is unavailable or does not support this chain. Reconnect it and try again.',
        '钱包环境不可用或不支持该链，请重新连接后重试。');
      else {commitAddress();return;}
      CF.render();
    },550);
  }

  /* ------------------------------------------------------------------ 浮层 */
  const layers={
    'ea-form':()=>{setTimeout(restoreForm,0);
      return {title:formTitle(),html:F().kind==='fiat'?fiatForm():cryptoForm(),foot:formFoot()};},
    'ea-view':id=>{const a=EA.byId(id);
      if(!a)return {title:L('Account','账户'),html:CF.note('warn',L('This account is no longer registered.','该账户已不在本企业目录中。')),
        foot:b('close','Close','关闭')};
      const rows=a.kind==='crypto'
        ? [[L(...EA.labels.chain),E(a.chain)],[L(...EA.labels.address),'<span class="copy-pair"><span class="hash">'+E(a.address)+'</span>'+
            CF.copyBtn('ea-copy',a.address,L('Copy address','复制地址'))+'</span>'],
            [L('Tokens accepted','可接收代币'),EA.TOKENS],
            [L('Address ownership','地址所有权'),CF.tag('ok',L('Confirmed by signature','已签名确认'))]]
        : [[L(...EA.labels.ccy),EA.CURRENCY],[L(...EA.labels.iban),copyable(a.iban,L('Copy account number','复制账号'))],
            [L(...EA.labels.bank),E(a.bank)],
            [L('Bank address','收款行地址'),E([a.bankCity,EA.region(a.bankCountry)].filter(Boolean).join(' · '))||'—'],
            [L(...EA.labels.swift),a.swift?copyable(a.swift,L('Copy SWIFT / BIC','复制 SWIFT / BIC')):'—'],
            [L('Beneficiary address','收款人地址'),E([a.addressLine,a.addressCity].filter(Boolean).join(', '))+
              (a.addressCountry?' · '+EA.region(a.addressCountry):'')],
            [L('Intermediary bank','中转行信息'),a.interSwift?E([a.interSwift,a.interName,a.interAccount].filter(Boolean).join(' · ')):L('Not provided','未填写')]];
      rows.push([L(...EA.labels.at),time(a.at)]);
      return {title:EA.name(a),html:'<div class="ea-drawer">'+(a.primary?'<p>'+CF.tag('ok',L('Default','默认账户'))+'</p>':'')+
        dl(rows)+'</div>',foot:b('close','Close','关闭')+b('edit','Edit','修改',a.id,true)};},
    'ea-remove':id=>{const a=EA.byId(id);
      if(!a)return {title:L('Delete account','删除账户'),html:CF.note('warn',L('This account is no longer registered.','该账户已不在本企业目录中。')),foot:b('close','Close','关闭')};
      const peers=EA.accounts(owner(),a.kind).filter(x=>x.id!==a.id&&!EA.missing(x).length&&(a.kind==='fiat'||x.chain===a.chain));
      const scope=a.kind==='fiat'?EA.CURRENCY:a.chain;
      return {title:L('Delete account','删除账户'),
        html:'<div class="ea-confirm"><p><b>'+EA.name(a)+'</b><br><span class="hint">'+EA.key(a)+'</span></p>'+
          CF.note('warn','<div><p>'+L('After deletion this account no longer appears in any selection list. Business records already submitted keep their account snapshot and are unaffected.',
            '删除后该账户不再出现在任何选用列表；已提交的业务记录保留当时的账户快照，不受影响。')+'</p>'+
          (peers.length?'':'<p>'+L('This is your last usable account for ','删除后 ')+E(scope)+
            L('. Businesses settled that way cannot be submitted until you register another one.','暂无可选账户，相关业务办理将无法提交，需要时可重新登记。')+'</p>')+
          (a.primary?'<p>'+L('It is the current default. After deletion this group has no default; no other account is promoted automatically.',
            '它是当前默认账户。删除后该类没有默认，不会自动把其他账户提升为默认。')+'</p>':'')+
          '<p>'+L('Deletion cannot be undone. To use it again you would register it from scratch.','删除不可撤销；需要时请重新登记。')+'</p></div>')+
          (V.problem?CF.note('red',E(V.problem)):'')+'</div>',
        foot:b('close','Cancel','取消','',false,V.busy==='remove')+
          b('remove-confirm',V.busy==='remove'?'Deleting…':'Confirm deletion',V.busy==='remove'?'正在删除…':'确认删除',a.id,true,V.busy==='remove')};},
    'ea-wallet':()=>({title:L('Wallet signature request','钱包签名请求'),
      html:'<div class="ea-wallet"><p>'+L('Sign with this address to confirm you own it.','请用这个地址签名，确认它归你所有。')+'</p>'+
        '<p class="mono">'+E(F()?.form.address||'')+'</p>'+
        '<p class="hint">'+L('This signature does not send a transaction, does not change how you sign in, and does not switch your login wallet.',
          '本次签名不会发起交易，不会改变你的登录方式，也不会更换登录钱包。')+'</p></div>',
      foot:b('wallet','Decline signature','拒绝签名','rejected')+b('wallet','Sign with another address','用其他地址签名','mismatch')+
        b('wallet','Wallet unavailable','钱包不可用','unavailable')+b('wallet','Confirm signature','确认签名','ok',true)}),
    'ea-discard':()=>({title:L('Discard your entries?','放弃填写内容？'),
      html:'<div class="ea-confirm"><p>'+L('This module keeps no draft. If you leave now, what you entered is not saved.',
        '本模块不保存草稿；现在离开，已填写的内容不会保留。')+'</p></div>',
      foot:b('discard-keep','Keep editing','继续编辑')+b('discard-drop','Discard','放弃填写','',true)}),
    'ea-copy':()=>({title:L('Copy value','复制内容'),
      html:'<input class="inp ea-copy-value" readonly value="'+E(V.copyValue)+'" aria-label="'+L('Value','内容')+'">'+
        '<p>'+L('Select the text and copy it.','请选择文本后复制。')+'</p>',
      foot:b('close','Close','关闭')})
  };

  function restoreForm(){
    const f=F();if(!f)return;
    const host=document.querySelector('.drawer:has(.ea-drawer)');if(!host)return;
    const heading=host.querySelector('.drawer-h');if(heading)heading.tabIndex=-1;
    const first=Object.keys(f.errors||{})[0];
    const target=first&&document.getElementById('ea-f-'+first);
    if(target){target.focus({preventScroll:true});target.scrollIntoView({block:'center',behavior:'auto'});return;}
    if(f.focus){const el=document.getElementById(f.focus);f.focus='';if(el){el.focus({preventScroll:true});return;}}
    if(heading)heading.focus({preventScroll:true});
  }

  /* ------------------------------------------------------------------ 动作 */
  function openForm(kind,mode,id){
    const a=id?EA.byId(id):null;
    V.flow={kind,mode,id:id||'',step:kind==='crypto'&&mode==='new'?1:0,
      form:a?fromAccount(a):kind==='fiat'?blankFiat():{chain:'',label:'',address:''},
      errors:{},dirty:false,ack:false,conflict:false,duplicate:'',problem:'',focus:''};
    V.problem='';CF.openLayer('drawer','ea-form');
  }
  const dirty=()=>{const f=F();return !!f&&(f.dirty||f.kind==='crypto'&&f.mode==='new'&&(f.form.chain||f.form.address||f.form.label));};
  function closeForm(){
    if(dirty()){V.pending=S.layer;CF.openLayer('modal','ea-discard',null,V.pending);return;}
    V.flow=null;CF.closeLayer();
  }
  function goBack(){
    const back=V.returnTo,kind=V.returnKind,biz=V.returnBiz;
    V.returnTo='';V.returnKind='';V.returnBiz='';
    location.hash='#'+back;
    setTimeout(()=>{if(kind==='quote')CF.CQ?.resumeSelection?.(biz);else if(kind==='loan')CF.L7?.resumeAccounts?.(biz);},40);
  }
  async function copy(value){
    try{await navigator.clipboard.writeText(value);CF.toast(L('Copied.','已复制。'));}
    catch(_){V.copyValue=value;CF.openLayer('modal','ea-copy');}
  }
  function onAct(act,v){
    if(!act.startsWith('ea-'))return false;
    const key=act.slice(3);
    if(V.busy&&!['discard-keep','discard-drop'].includes(key))return true;
    switch(key){
      case 'reload':V.scene='loading';{const token=++V.epoch;setTimeout(()=>{if(token===V.epoch){V.scene='ready';CF.render();}},600);}break;
      case 'add':openForm(v,'new');break;
      case 'view':if(S.layer?.key==='ea-form'){V.flow=null;}CF.openLayer('drawer','ea-view',v);break;
      case 'edit':{const a=EA.byId(v);if(!a){CF.toast(L('This account is no longer registered.','该账户已不在本企业目录中。'));break;}openForm(a.kind,'edit',v);break;}
      case 'remove':V.problem='';CF.openLayer('modal','ea-remove',v);break;
      case 'remove-confirm':{
        V.busy='remove';const token=++V.epoch;CF.render();
        setTimeout(()=>{if(token!==V.epoch)return;V.busy='';
          if(V.saveResult==='failed'){V.problem=L('Could not delete. The account is unchanged; please retry.','删除失败，账户保持原状，请重试。');CF.render();return;}
          EA.remove(v);CF.closeLayer();CF.toast(L('Account deleted.','账户已删除。'));},450);
        break;}
      case 'default':EA.setDefault(v,true);CF.toast(L('Set as the default account.','已设为默认账户。'));break;
      case 'undefault':EA.setDefault(v,false);CF.toast(L('Default cleared.','已取消默认。'));break;
      case 'close':if(S.layer?.key==='ea-form')closeForm();else{V.flow=null;CF.closeLayer();}break;
      case 'discard-keep':S.layer=V.pending;V.pending=null;break;
      case 'discard-drop':V.flow=null;V.pending=null;CF.closeLayer();break;
      case 'back':{const f=F();f.step=Math.max(1,f.step-1);f.problem='';f.errors={};break;}
      case 'next':{const f=F();
        if(f.step===1){if(!f.form.chain){f.errors={chain:L('Select a chain first.','请先选择结算收款链。')};break;}f.errors={};f.step=2;f.focus='ea-f-label';}
        else if(validateAddress()){f.errors={};f.step=3;}
        break;}
      case 'save':{const f=F();
        if(f.kind==='crypto'){if(!val('label').trim()){f.errors={label:L('This field is required.','该项为必填。')};break;}
          f.errors={};later(()=>{EA.update(f.id,{label:val('label').trim()});V.flow=null;CF.closeLayer();CF.toast(L('Account saved.','账户已保存。'));});break;}
        if(f.conflict&&!f.ack){f.ack=true;}
        if(validateFiat())later(commitFiat);
        break;}
      case 'sign':V.pending=S.layer;CF.openLayer('modal','ea-wallet',null,V.pending);break;
      case 'wallet':signature(v);break;
      case 'copy':copy(v);return true;
      case 'return':goBack();break;
      case 'demo':demoAction(v);break;
      default:return false;
    }
    return true;
  }

  /* ------------------------------------------------------------------ 输入与离页保护 */
  document.addEventListener('input',e=>{
    const el=e.target,k=el.dataset.eaField;if(!k||!F())return;
    F().form[k]=el.value;F().dirty=true;
    if(F().errors[k]){delete F().errors[k];el.removeAttribute('aria-invalid');
      const slot=document.getElementById(el.id+'-err');if(slot)slot.textContent='';}
    if(F().problem){F().problem='';document.querySelector('.ea-drawer .note.red')?.remove();}
  });
  document.addEventListener('change',e=>{
    const el=e.target;
    /* change 在失焦时才到，重绘会吞掉紧接着的那一次点击；这里只更新取值，
       国家段一致性在下一次保存时重新判定。 */
    if(el.dataset.eaField&&F()){F().form[el.dataset.eaField]=el.value;F().dirty=true;
      if(['swift','bankCountry'].includes(el.dataset.eaField)){F().conflict=false;F().ack=false;}return;}
    if(el.dataset.eaChain&&F()){F().form.chain=el.dataset.eaChain;F().dirty=true;F().errors={};CF.render();return;}
    if(el.id==='ea-save-result'){V.saveResult=el.value;return;}
  });
  /* 本模块自己的离页保护：编辑未保存时先确认；钱包与放弃确认关闭后回到原抽屉。 */
  function guardClose(){
    const key=S.layer?.key;
    if(key==='ea-wallet'||key==='ea-discard'){S.layer=V.pending||null;V.pending=null;return true;}
    if(key==='ea-form'&&dirty()){closeForm();return true;}
    return false;
  }
  document.addEventListener('click',e=>{
    const el=e.target.closest('[data-act]');
    if(!el||el.dataset.act!=='closelayer')return;
    if(el.hasAttribute('data-stop')||el.classList.contains('modal-mask')&&e.target.closest('[data-stop]'))return;
    if(!guardClose())return;
    e.preventDefault();e.stopImmediatePropagation();CF.render();
  });
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape'||V.busy)return;
    if(!guardClose())return;
    e.preventDefault();e.stopImmediatePropagation();CF.render();
  });
  /* 离开本页即丢弃未提交内容：本模块不设草稿。 */
  window.addEventListener('hashchange',()=>{
    if(S.layer&&String(S.layer.key||'').startsWith('ea-')){V.flow=null;V.pending=null;CF.closeLayer();}
    readReturn();
  });
  function readReturn(){
    const hash=location.hash.replace(/^#/,'');
    if(hash.split('?')[0]!==ROUTE){V.returnTo='';V.returnKind='';V.returnBiz='';return;}
    const q=new URLSearchParams(hash.split('?')[1]||'');
    const back=q.get('return')||'';
    if(!back)return;
    if(!/^\/(marketplace|project|console|assets)(?:[/?]|$)/.test(back)||/[<>]/.test(back))return;
    V.returnTo=back;V.returnKind=q.get('from')||'';V.returnBiz=q.get('business')||'';
  }
  setTimeout(readReturn,0);

  /* ------------------------------------------------------------------ 评审工具 */
  CF.review.register(PAGE,{group:['Enterprise accounts','企业账户'],route:ROUTE,
    states:[ 'default',
      {id:'unverified',label:['Not verified yet','尚未取得认证资格'],group:'business'},
      'loading','empty','error'],
    get:()=>V.unverified?'unverified':V.scene==='ready'?'default':V.scene,
    set(value){V.unverified=value==='unverified';V.scene=['loading','empty','error'].includes(value)?value:'ready';},
    reset(){V.unverified=false;V.scene='ready';V.epoch++;}});

  const select=(id,label,options,current)=>'<div class="field"><label for="'+id+'">'+label+'</label>'+
    '<select class="inp" id="'+id+'">'+options.map(o=>'<option value="'+o[0]+'"'+(current===o[0]?' selected':'')+'>'+
      L(o[1],o[2])+'</option>').join('')+'</select></div>';
  function tools(){
    return '<section class="ea-demo"><h5>'+L('Enterprise account simulations','企业账户模拟')+'</h5>'+
      '<p class="hint">'+L('Local simulation only. No wallet, chain or backend is contacted; the platform does not verify that an account is real or reachable. Signature outcomes are chosen in the simulated wallet dialog.',
        '仅本地模拟：不调用钱包、链上接口或后端；平台不验证账户真实性与汇路可达性。签名结果在模拟钱包对话框内选择。')+'</p>'+
      select('ea-save-result',L('Next save / delete response','下次保存 / 删除响应'),
        [['success','Success','成功'],['failed','Failed','失败']],V.saveResult)+
      '<div class="seg">'+b('demo','Reset demonstration accounts','重置演示账户','reseed')+'</div></section>';
  }
  function demoAction(v){
    if(v==='reseed'){EA.reseed();V.flow=null;V.scene='ready';S.layer=null;S.demo=false;CF.toast(L('Demonstration accounts restored.','演示账户已恢复。'));}
  }
  const host=CF.LSView,priorDemo=host&&host.demo;
  if(host)host.demo=function(){return (S.page===PAGE?tools():'')+(priorDemo?priorDemo.call(host):'');};

  CF.define(CF.EAView={id:'enterprise-accounts',pages:[PAGE],dict,layers,
    content(){return page();},onAct});
})(window.CF);
