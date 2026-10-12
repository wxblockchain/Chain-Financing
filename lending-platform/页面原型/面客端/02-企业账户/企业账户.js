/* 企业账户（面客 · 资产方与资金方双侧）。资产方侧展示名“企业账户”，资金方侧“机构账户”，同一页面、同一套字段。
   继承面客端 portal 壳层与公共组件；本模块只提供总览页内容、维护抽屉与确认弹窗，导航、路由、浮层宿主由 _shared/shell.js 提供。
   账户目录与字段定义在 ./演示数据.js（CF.EA），报价、放款、还款与控制台读取同一份。
   钱包、签名、服务端校验均为本地演示，不发网络请求。 */
(function(CF){
  'use strict';
  const S=CF.S,L=CF.L,E=CF.esc,EA=CF.EA;
  const PAGE='P-F-EA-01',ROUTE='/company-accounts';
  CF.PAGES[PAGE]={end:'asset',layout:'portal',navKey:'navCompanyAccounts',auth:true};
  CF.ENTRY[PAGE]=ROUTE;
  /* 文档标题与评审目录按侧取展示名：壳层读页面的字典键，这里在每次渲染时按当前身份切换。 */
  const dict={en:{navCompanyAccounts:'Company accounts',navInstitutionAccounts:'Institution accounts'},
    zh:{navCompanyAccounts:'企业账户',navInstitutionAccounts:'机构账户'}};
  const KINDS=['fiat','crypto'];

  /* scene：整页读取状态；unverified：模拟尚未取得业务资格；saveResult：下次保存／删除响应。 */
  const V={scene:'ready',unverified:false,flow:null,busy:'',problem:'',pending:null,
    saveResult:'success',copyValue:'',returnTo:'',returnKind:'',returnBiz:'',epoch:0};

  const owner=()=>EA.owner();
  const title=()=>L(...EA.title());
  const eligible=()=>{
    const e=CF.portalEligible?CF.portalEligible():{verified:true};
    return V.unverified?Object.assign({},e,{verified:false}):e;
  };
  const b=(act,en,zh,v='',primary=false,off=false)=>'<button type="button" class="btn'+(primary?' primary':'')+
    '" data-act="ea-'+act+'" data-v="'+E(v)+'"'+(off?' disabled':'')+'>'+L(en,zh)+'</button>';
  const link=(act,en,zh,v,label)=>'<button type="button" class="actlink" data-act="ea-'+act+'" data-v="'+E(v)+'" aria-label="'+
    E(L(en,zh)+' · '+label)+'">'+L(en,zh)+'</button>';
  const dl=rows=>'<dl class="dl ea-dl">'+rows.map(r=>'<dt>'+r[0]+'</dt><dd>'+r[1]+'</dd>').join('')+'</dl>';
  const zone=()=>E(S.tz||'UTC');
  const stamp=iso=>iso?'<span class="num">'+E(CF.fmtStamp(iso))+'</span> <span class="muted">('+zone()+')</span>':'—';
  const copyable=(shown,value,label,cls='mono')=>'<span class="copy-pair"><span class="'+cls+'">'+E(shown)+'</span>'+
    CF.copyBtn('ea-copy',value,label)+'</span>';
  const kindName=k=>k==='fiat'?L('Fiat accounts','法币账户'):L('Crypto accounts','数币账户');

  /* ------------------------------------------------------------------ 视图参数：Tab 与回流目标写在 query 里，刷新与分享可恢复 */
  function query(){return new URLSearchParams(location.hash.split('?')[1]||'');}
  function tab(){const t=query().get('type');return KINDS.includes(t)?t:'fiat';}
  function setTab(t){
    const q=query();if(t==='fiat')q.delete('type');else q.set('type',t);
    const s=q.toString();history.replaceState(null,'','#'+ROUTE+(s?'?'+s:''));
    CF.render();
    setTimeout(()=>document.querySelector('.ea-tabs [aria-selected="true"]')?.focus(),0);
  }

  /* ------------------------------------------------------------------ 总览 */
  function head(){
    return '<div class="page-head"><div><h1 class="page-title">'+E(title())+'</h1>'+
      '<p class="page-desc">'+L('Your company\'s bank and crypto accounts. When you accept a quote or record a disbursement, you choose one of the accounts saved here.',
        '本企业自己的法币账户与数币账户。接受报价、登记放款时，从这里已登记的账户中选用。')+'</p></div>'+
      '<div class="page-actions">'+CF.tag('',L('Demonstration data','演示数据'))+'</div></div>';
  }
  /* 未登录与登录未绑定角色都取不到本企业账户；这里给本页的引导。 */
  function accessSurface(){
    if(S.role==='signed')return CF.empty(L('This page is not available for your current role','该页面不适用于当前身份'),
      L('Accounts belong to an asset holder or funder account.','账户属于已绑定角色的资产方或资金方账号。'),
      '<button class="btn primary" type="button" data-act="go" data-v="/assets">'+L('Back to assets','返回资产广场')+'</button>');
    return CF.empty(L('Sign in to view your accounts','登录后查看本企业账户'),
      L('After signing in, you will return to this page.','登录后将返回当前页面。'),
      '<button class="btn primary" type="button" data-act="signin">'+L('Sign in','登录')+'</button>');
  }
  function guidance(e){
    const act=e.act?'<button type="button" class="btn primary" data-act="'+E(e.act)+'" data-v="'+E(e.value||'')+'">'+
      L(...(e.label||['Complete verification','前往完成认证']))+'</button>':'';
    return '<section class="card"><div class="card-b ea-gate"><h2>'+L('Verification required','需要先完成认证')+'</h2>'+
      '<p>'+L('Once your company is verified, you can add the bank and crypto accounts used in financing.',
        '本企业完成认证后，即可登记用于融资业务的法币账户与数币账户。')+'</p>'+(act?'<div class="detail-actions">'+act+'</div>':'')+'</div></section>';
  }
  function loadError(){
    return '<section class="card">'+CF.empty(L('We couldn\'t load your accounts','暂时无法读取本企业账户'),
      L('This doesn\'t mean no accounts are saved. Try again, or come back later.','这不表示尚未登记账户。请重试，或稍后再来。'),
      '<button class="btn primary" type="button" data-act="ea-reload">'+L('Try again','重试')+'</button>')+'</section>';
  }
  function returnBanner(){
    if(!V.returnTo)return '';
    return '<div class="ea-return">'+CF.note('accent','<span>'+L('Add the account you need here, then go back to finish the transaction.',
      '在这里登记需要的账户后，返回原办理继续。')+'</span>')+b('return','Back to the transaction','返回原办理','',true)+'</div>';
  }
  const list=kind=>V.scene==='empty'?[]:EA.accounts(owner(),kind);
  function tabs(){
    const current=tab();
    return '<div class="card-tabs ea-tabs" role="tablist" aria-label="'+L('Account types','账户类别')+'">'+
      KINDS.map(k=>'<button type="button" role="tab" id="ea-tab-'+k+'" aria-controls="ea-panel" aria-selected="'+(k===current)+'" tabindex="'+(k===current?0:-1)+
        '" data-act="ea-tab" data-v="'+k+'">'+kindName(k)+' <span class="ea-count">'+list(k).length+'</span></button>').join('')+
      '<div class="ea-tab-actions">'+(list(current).length?b('add',current==='fiat'?'Add fiat account':'Add crypto account',
        current==='fiat'?'新增法币账户':'新增数币账户',current,true):'')+'</div></div>';
  }
  function empty(kind){
    return kind==='fiat'
      ? CF.empty(L('No fiat accounts yet','尚未登记法币账户'),L('Add a USD bank account to use it in USD transactions.','登记 USD 银行账户后，即可在 USD 结算的业务中选用。'),
          b('add','Add fiat account','新增法币账户','fiat',true))
      : CF.empty(L('No crypto accounts yet','尚未登记数币账户'),L('Add a wallet address on ETH or TRON to use it in USDT and USDC transactions.','登记 ETH 或 TRON 上的地址后，即可在 USDT、USDC 结算的业务中选用。'),
          b('add','Add crypto account','新增数币账户','crypto',true));
  }
  function incomplete(a){
    const miss=EA.missing(a);
    return miss.length?'<div class="ea-incomplete">'+CF.tag('warn',L('Incomplete','信息不完整'))+'<span class="cell-sub">'+
      L('Add ','补齐 ')+miss.map(k=>L(...EA.labels[k])).join(L(', ','、'))+L(' to use it in transactions',' 后才能在业务中选用')+'</span></div>':'';
  }
  function actions(a){
    const n=EA.plainName(a);
    return '<td class="col-act" data-label="">'+link('view','View','查看',a.id,n)+link('edit','Edit','修改',a.id,n)+link('remove','Delete','删除',a.id,n)+'</td>';
  }
  function fiatTable(rows){
    const h=[L('Account nickname','账户备注名'),L('Bank','开户行'),L('Account number / IBAN','账号 / IBAN'),L('SWIFT / BIC','SWIFT / BIC')];
    return '<table class="tbl resp ea-table"><thead><tr>'+h.map(x=>'<th scope="col">'+x+'</th>').join('')+
      '<th scope="col">'+L('Added','登记时间')+'<span class="ea-th-zone">'+zone()+'</span></th><th scope="col" class="col-act"><span class="sr-only">'+L('Actions','操作')+'</span></th></tr></thead><tbody>'+
      rows.map(a=>'<tr><td data-label="'+h[0]+'"><div class="cell-wrap"><span class="cell-main">'+EA.name(a)+'</span>'+incomplete(a)+'</div></td>'+
        '<td data-label="'+h[1]+'"><div class="cell-wrap"><span>'+E(a.bank)+'</span><span class="cell-sub">'+E([a.bankCity,EA.regionName(a.bankCountry)].filter(Boolean).join(', '))+'</span></div></td>'+
        '<td data-label="'+h[2]+'" class="nw"><span class="mono">'+EA.maskTail(EA.compact(a.iban))+'</span></td>'+
        '<td data-label="'+h[3]+'" class="nw">'+(a.swift?'<span class="mono">'+E(a.swift)+'</span>':'<span class="faint">—</span>')+'</td>'+
        '<td data-label="'+L('Added','登记时间')+'" class="nw muted"><span class="num">'+E(CF.fmtStamp(a.at))+'</span></td>'+actions(a)+'</tr>').join('')+'</tbody></table>';
  }
  function cryptoTable(rows){
    const h=[L('Account nickname','账户备注名'),L('Network','结算收款链'),L('Wallet address','数币地址'),L('Supported tokens','适用代币')];
    return '<table class="tbl resp ea-table"><thead><tr>'+h.map(x=>'<th scope="col">'+x+'</th>').join('')+
      '<th scope="col">'+L('Added','登记时间')+'<span class="ea-th-zone">'+zone()+'</span></th><th scope="col" class="col-act"><span class="sr-only">'+L('Actions','操作')+'</span></th></tr></thead><tbody>'+
      rows.map(a=>'<tr><td data-label="'+h[0]+'"><span class="cell-main">'+EA.name(a)+'</span></td>'+
        '<td data-label="'+h[1]+'">'+CF.tag('accent',a.chain)+'</td>'+
        '<td data-label="'+h[2]+'" class="nw"><span class="mono">'+EA.maskAddress(a.address)+'</span></td>'+
        '<td data-label="'+h[3]+'" class="nw">'+EA.tokens()+'</td>'+
        '<td data-label="'+L('Added','登记时间')+'" class="nw muted"><span class="num">'+E(CF.fmtStamp(a.at))+'</span></td>'+actions(a)+'</tr>').join('')+'</tbody></table>';
  }
  function panel(){
    const k=tab(),rows=list(k);
    return '<div id="ea-panel" role="tabpanel" aria-labelledby="ea-tab-'+k+'" class="ea-panel">'+
      (rows.length?'<div class="tablewrap">'+(k==='fiat'?fiatTable(rows):cryptoTable(rows))+'</div>':empty(k))+'</div>';
  }
  function page(){
    CF.PAGES[PAGE].navKey=S.role==='fund'?'navInstitutionAccounts':'navCompanyAccounts';
    if(!['asset','fund'].includes(S.role))return head()+accessSurface();
    const e=eligible();
    if(!e.verified)return head()+guidance(e);
    if(V.scene==='loading')return head()+'<section class="card">'+CF.skelTable(4)+'</section>';
    if(V.scene==='error')return head()+loadError();
    return head()+returnBanner()+'<section class="card ea-card">'+tabs()+panel()+'</section>';
  }

  /* ------------------------------------------------------------------ 表单 */
  const blankFiat=()=>({label:'',addressCountry:'',addressCity:'',addressLine:'',iban:'',bank:'',
    bankCity:'',bankCountry:'',swift:'',interSwift:'',interName:'',interAccount:''});
  const fromAccount=a=>a.kind==='crypto'?{label:EA.plainName(a),chain:a.chain,address:a.address}
    :Object.assign(blankFiat(),{label:EA.plainName(a),addressCountry:a.addressCountry||'',addressCity:a.addressCity||'',
      addressLine:a.addressLine||'',iban:a.iban||'',bank:a.bank||'',bankCity:a.bankCity||'',bankCountry:a.bankCountry||'',
      swift:a.swift||'',interSwift:a.interSwift||'',interName:a.interName||'',interAccount:a.interAccount||''});
  const F=()=>V.flow;
  const val=k=>String(F().form[k]||'');
  const err=k=>F().errors[k]||'';
  const required=k=>EA.fiatRequired.includes(k)||k==='address';
  /* 输入属性按国际化表单惯例给出：地址字段带 autocomplete，代码类关闭拼写检查并转大写。 */
  const INPUT={
    label:'autocomplete="off"',addressCity:'autocomplete="section-holder address-level2"',addressLine:'autocomplete="section-holder street-address"',
    iban:'autocomplete="off" spellcheck="false" autocapitalize="characters"',bank:'autocomplete="off"',bankCity:'autocomplete="off"',
    swift:'autocomplete="off" spellcheck="false" autocapitalize="characters" maxlength="14"',
    interSwift:'autocomplete="off" spellcheck="false" autocapitalize="characters" maxlength="14"',interName:'autocomplete="off"',
    interAccount:'autocomplete="off" spellcheck="false"',address:'autocomplete="off" spellcheck="false" autocapitalize="off"'};
  const HINT={
    iban:['Enter it exactly as your bank shows it. Spaces are ignored.','按开户行提供的写法填写，空格会被忽略。'],
    swift:['8 or 11 letters and digits.','8 位或 11 位字母数字。'],
    interSwift:['8 or 11 letters and digits.','8 位或 11 位字母数字。']};

  function field(k,full=false){
    const id='ea-f-'+k,hint=HINT[k];
    const nameHint=k==='label'&&F().sameName?L('Another account already uses this nickname. You can keep it, but a distinct name is easier to tell apart.',
      '已有账户使用相同的备注名。可以保留，但用不同的名称更容易区分。'):'';
    return '<div class="field'+(full?' ea-full':'')+'"><label for="'+id+'">'+L(...EA.labels[k])+'</label>'+
      '<input class="inp" id="'+id+'" data-ea-field="'+k+'" type="text" value="'+E(val(k))+'"'+
      (required(k)?' aria-required="true"':'')+(err(k)?' aria-invalid="true"':'')+' aria-describedby="'+id+'-err'+(hint||k==='label'?' '+id+'-hint':'')+'" '+(INPUT[k]||'')+'>'+
      (hint?'<span class="hint" id="'+id+'-hint">'+L(...hint)+'</span>':'')+
      (k==='label'?'<span class="hint" id="'+id+'-hint" data-ea-namehint>'+E(nameHint)+'</span>':'')+
      '<span class="err-msg" id="'+id+'-err" role="alert">'+E(err(k))+'</span></div>';
  }
  function regionField(k){
    const id='ea-f-'+k,codes=EA.regions();
    return '<div class="field"><label for="'+id+'">'+L(...EA.labels[k])+'</label>'+
      '<select class="inp" id="'+id+'" data-ea-field="'+k+'"'+(k==='addressCountry'?' autocomplete="section-holder country"':' autocomplete="off"')+
      (required(k)?' aria-required="true"':'')+(err(k)?' aria-invalid="true"':'')+' aria-describedby="'+id+'-err">'+
      '<option value="">'+L('Select a country or region','请选择国家或地区')+'</option>'+
      codes.map(c=>'<option value="'+c+'"'+(val(k)===c?' selected':'')+'>'+E(EA.regionName(c))+'</option>').join('')+'</select>'+
      '<span class="err-msg" id="'+id+'-err" role="alert">'+E(err(k))+'</span></div>';
  }
  const group=(heading,html,extra='')=>'<fieldset class="ea-group"><legend>'+heading+'</legend>'+extra+'<div class="ea-grid">'+html+'</div></fieldset>';

  function fiatForm(){
    const f=F(),interOpen=f.interOpen||['interSwift','interName','interAccount'].some(k=>val(k)||err(k));
    return '<div class="ea-drawer">'+(f.problem?CF.note('red',E(f.problem)):'')+
      group(L('Account','账户信息'),field('label',true)+
        '<div class="field"><span class="field-label">'+L(...EA.labels.ccy)+'</span><span class="field-static">'+EA.CURRENCY+'</span></div>')+
      group(L('Account holder address','账户持有人地址'),regionField('addressCountry')+field('addressCity')+field('addressLine',true),
        '<p class="hint">'+L('Your company\'s address as the bank has it on record.','开户行登记的本企业地址。')+'</p>')+
      group(L('Bank details','开户行信息'),field('bank',true)+field('iban')+field('swift')+field('bankCity')+regionField('bankCountry'))+
      '<details class="ea-inter"'+(interOpen?' open':'')+'><summary>'+L('Intermediary bank (optional)','中转行信息（选填）')+'</summary>'+
        '<p class="hint">'+L('Only needed if your bank routes USD payments through another bank. Ask your bank if you are not sure. If you add one, fill in all three fields.',
          '只有开户行需要经其他银行转汇 USD 时才需填写，不确定请向开户行确认。填写其中一项就要三项齐全。')+'</p>'+
        '<div class="ea-grid">'+field('interSwift')+field('interName')+field('interAccount',true)+'</div></details>'+
      (f.conflict?CF.note('warn',L('The bank country / region does not match the country in the SWIFT / BIC code. If both are correct, save again to continue.',
        '开户行国家 / 地区与 SWIFT / BIC 中的国家代码不一致。确认两者都正确时，再次保存即可继续。')):'')+
      (f.duplicate?CF.note('warn','<div><p>'+L('An account with this account number and SWIFT / BIC is already saved.',
        '已登记过相同账号与 SWIFT / BIC 的账户。')+'</p><div class="detail-actions">'+
        b('view','View that account','查看该账户',f.duplicate)+'</div></div>'):'')+'</div>';
  }
  const CHAIN_HINT={ETH:['Ethereum · address starts with 0x','以太坊 · 地址以 0x 开头'],TRON:['TRON · address starts with T','波场 · 地址以 T 开头']};
  function cryptoForm(){
    const f=F();
    if(f.mode==='edit')return '<div class="ea-drawer">'+(f.problem?CF.note('red',E(f.problem)):'')+
      group(L('Account','账户信息'),field('label',true))+
      dl([[L(...EA.labels.chain),CF.tag('accent',f.form.chain)],[L(...EA.labels.address),'<span class="mono ea-break">'+E(f.form.address)+'</span>']])+
      '<p class="hint">'+L('The network and address can\'t be changed. To use a different address, add a new crypto account and sign with it, then delete this one if you no longer need it.',
        '结算收款链与数币地址登记后不可修改。要换地址，请新增一个数币账户并用新地址签名，再按需删除本账户。')+'</p></div>';
    const step=f.step;
    const steps='<ol class="ea-steps">'+[[1,'Network','选择链'],[2,'Address','填写地址'],[3,'Verify ownership','证明地址所有权']]
      .map(s=>'<li data-complete="'+(step>s[0])+'"'+(step===s[0]?' aria-current="step"':'')+'><span class="ea-step-no">'+s[0]+'</span>'+L(s[1],s[2])+'</li>').join('')+'</ol>';
    let body='';
    if(step===1){
      body=CF.note('warn','<div><p><b>'+L('Only add an address you can sign with.','只能登记你能签名的地址。')+'</b> '+
        L('Adding it requires a signature from that address to prove you own it.','添加时需要用这个地址本身签名，以证明它归你所有。')+'</p><p>'+
        L('Exchange deposit addresses, third-party custodial addresses and contract addresses that can\'t sign are not supported.',
          '交易所充值地址、第三方托管地址以及无法签名的合约地址都无法登记。')+'</p></div>')+
        '<fieldset class="ea-chains"><legend>'+L('Select the network your address is on. It can\'t be changed after the account is saved.',
          '请先选择地址所在的链。链一经登记不可修改。')+'</legend>'+
        EA.CHAINS.map(c=>'<label class="ea-chain"><input type="radio" name="ea-chain" value="'+c+'" data-ea-chain="'+c+'"'+
          (f.form.chain===c?' checked':'')+'><span><b>'+c+'</b><span class="hint">'+L(...CHAIN_HINT[c])+'</span></span></label>').join('')+
        '</fieldset><span class="err-msg" id="ea-f-chain-err" role="alert">'+E(err('chain'))+'</span>';
    }else if(step===2){
      body='<div class="ea-chosen">'+dl([[L(...EA.labels.chain),CF.tag('accent',f.form.chain)],[L(...EA.labels.tokens),EA.tokens()]])+'</div>'+
        '<div class="ea-grid">'+field('label',true)+field('address',true)+'</div>'+
        (f.duplicate?CF.note('warn','<div><p>'+L('This address is already saved for your company.','这个地址已经在本企业登记过了。')+
          '</p><div class="detail-actions">'+b('view','View that account','查看该账户',f.duplicate)+'</div></div>'):'');
    }else{
      body=dl([[L(...EA.labels.label),E(f.form.label)],[L(...EA.labels.chain),CF.tag('accent',f.form.chain)],
        [L(...EA.labels.address),'<span class="mono ea-break">'+E(f.form.address)+'</span>']])+
        '<p class="ea-lead">'+L('Sign with this address to confirm you own it. This signature doesn\'t change how you sign in, and it doesn\'t switch your login wallet.',
          '请用这个地址签名，确认它归你所有。此次签名不会改变你的登录方式，也不会更换登录钱包。')+'</p>'+
        (f.problem?CF.note('red',E(f.problem)):'');
    }
    return '<div class="ea-drawer">'+steps+body+'</div>';
  }
  function formTitle(){
    const f=F();
    if(f.kind==='fiat')return f.mode==='edit'?L('Edit fiat account','修改法币账户'):L('Add fiat account','新增法币账户');
    return f.mode==='edit'?L('Edit crypto account','修改数币账户'):L('Add crypto account','新增数币账户');
  }
  function formFoot(){
    const f=F(),busy=V.busy==='save';
    const cancel=b('close','Cancel','取消','',false,busy);
    if(f.kind==='fiat'||f.mode==='edit')
      return cancel+b('save',busy?'Saving…':f.conflict?'Save anyway':'Save',busy?'正在保存…':f.conflict?'确认并保存':'保存','',true,busy);
    if(f.step===1)return cancel+b('next','Continue','下一步','',true);
    if(f.step===2)return cancel+b('back','Back','上一步')+b('next','Continue to signature','下一步：签名确认','',true);
    return cancel+b('back','Back','上一步','',false,busy)+b('sign',busy?'Waiting for signature…':'Sign with this address',busy?'等待签名…':'用该地址签名','',true,busy);
  }

  /* ------------------------------------------------------------------ 校验与保存 */
  const REQUIRED=L('This field is required.','该项为必填。');
  function validateFiat(){
    const f=F(),e={};
    EA.fiatRequired.forEach(k=>{if(!val(k).trim())e[k]=k.endsWith('Country')?L('Select a country or region.','请选择国家或地区。'):REQUIRED;});
    if(val('swift').trim()&&!EA.swiftValid(val('swift')))e.swift=L('Enter 8 or 11 letters and digits.','请输入 8 位或 11 位字母数字。');
    const inter=['interSwift','interName','interAccount'];
    if(inter.some(k=>val(k).trim()))inter.forEach(k=>{if(!val(k).trim())e[k]=L('Fill in all three intermediary bank fields, or leave them all empty.','中转行三项须齐全，或全部留空。');});
    if(val('interSwift').trim()&&!e.interSwift&&!EA.swiftValid(val('interSwift')))e.interSwift=L('Enter 8 or 11 letters and digits.','请输入 8 位或 11 位字母数字。');
    f.errors=e;
    if(Object.keys(e).length){f.interOpen=f.interOpen||inter.some(k=>e[k]);return false;}
    const dup=EA.duplicateFiat(owner(),val('iban'),val('swift'),f.id);
    f.duplicate=dup?dup.id:'';
    if(dup)return false;
    f.conflict=!!(EA.swiftCountry(val('swift'))&&val('bankCountry')&&EA.swiftCountry(val('swift'))!==val('bankCountry'))&&!f.ack;
    return !f.conflict;
  }
  function validateAddress(){
    const f=F(),e={};
    if(!val('label').trim())e.label=REQUIRED;
    const address=val('address').trim();
    if(!address)e.address=REQUIRED;
    else if(!EA.addressValid(f.form.chain,address))
      e.address=f.form.chain==='ETH'?L('That isn\'t a valid ETH address. It should start with 0x followed by 40 hexadecimal characters.',
        '这不是一个有效的 ETH 地址，应以 0x 开头并包含 40 位十六进制字符。')
        :L('That isn\'t a valid TRON address. It should start with T.','这不是一个有效的 TRON 地址，应以 T 开头。');
    f.errors=e;
    if(Object.keys(e).length)return false;
    const dup=EA.duplicateCrypto(owner(),f.form.chain,address);
    f.duplicate=dup?dup.id:'';
    return !dup;
  }
  /* 保存进行中让用户知道处理未完成；失败时账户保持上一次成功状态，不产生半条账户。 */
  function later(run){
    V.busy='save';const token=++V.epoch,f=F();f.problem='';CF.render();
    setTimeout(()=>{
      if(token!==V.epoch||F()!==f)return;
      V.busy='';
      if(V.saveResult==='failed'){f.problem=L('We couldn\'t save your changes. Nothing was changed; please try again.','保存失败，账户保持原状，请重试。');CF.render();return;}
      run();
    },450);
  }
  function commitFiat(){
    const f=F(),form=f.form,t=k=>String(form[k]||'').trim();
    const patch={label:t('label'),ccy:EA.CURRENCY,addressCountry:form.addressCountry,addressCity:t('addressCity'),addressLine:t('addressLine'),
      iban:EA.compact(form.iban),bank:t('bank'),bankCity:t('bankCity'),bankCountry:form.bankCountry,swift:EA.compact(form.swift),
      interSwift:EA.compact(form.interSwift),interName:t('interName'),interAccount:t('interAccount')};
    if(f.mode==='edit')EA.update(f.id,patch);else EA.add(Object.assign({kind:'fiat'},patch));
    V.flow=null;CF.closeLayer();
    CF.toast(f.mode==='edit'?L('Changes saved.','修改已保存。'):L('Fiat account added.','法币账户已登记。'));
  }
  function commitAddress(){
    const f=F();
    EA.add({kind:'crypto',chain:f.form.chain,label:f.form.label.trim(),address:f.form.address.trim(),ownership:'signed'});
    V.flow=null;CF.closeLayer();
    if(tab()!=='crypto')setTab('crypto');
    CF.toast(L('Crypto account added.','数币账户已登记。'));
  }
  /* 钱包对话框是模拟的签名宿主，不是产品页面的一部分：它给出本次签名的结果。 */
  function signature(r){
    const f=F();
    V.busy='save';f.problem='';S.layer=V.pending||S.layer;V.pending=null;
    const token=++V.epoch;CF.render();
    setTimeout(()=>{
      if(token!==V.epoch||F()!==f)return;
      V.busy='';
      if(r==='mismatch')f.problem=L('The signing address doesn\'t match the address you\'re adding. Please sign with that address.',
        '签名的地址和你要登记的地址不是同一个，请用该地址签名。');
      else if(r==='rejected')f.problem=L('The signature wasn\'t completed, so the account wasn\'t saved. You can try again.',
        '本次没有完成签名，账户尚未登记，你可以重试。');
      else if(r==='unavailable')f.problem=L('Your wallet is unavailable or doesn\'t support this network. Reconnect it and try again.',
        '钱包环境不可用或不支持该链，请重新连接后重试。');
      else {commitAddress();return;}
      CF.render();
    },550);
  }

  /* ------------------------------------------------------------------ 浮层 */
  function viewSections(a){
    const section=(h,rows)=>'<section class="ea-view-section"><h3>'+h+'</h3>'+dl(rows)+'</section>';
    const times=[[L('Added','登记时间'),stamp(a.at)]].concat(a.updated?[[L('Last updated','最近修改'),stamp(a.updated)]]:[]);
    if(a.kind==='crypto')return section(L('Account','账户信息'),[[L(...EA.labels.label),EA.name(a)],[L(...EA.labels.chain),CF.tag('accent',a.chain)],
        [L(...EA.labels.tokens),EA.tokens()]])+
      section(L('Wallet address','数币地址'),[[L(...EA.labels.address),copyable(a.address,a.address,L('Copy address','复制地址'),'hash ea-break')],
        [L(...EA.labels.ownership),CF.tag('ok',L('Confirmed by signature','已签名确认'))]])+section(L('Record','记录'),times);
    return section(L('Account','账户信息'),[[L(...EA.labels.label),EA.name(a)],[L(...EA.labels.ccy),EA.CURRENCY]])+
      section(L('Bank details','开户行信息'),[[L(...EA.labels.bank),E(a.bank)],
        [L(...EA.labels.iban),copyable(EA.groupIban(a.iban),EA.compact(a.iban),L('Copy account number','复制账号'))],
        [L(...EA.labels.swift),a.swift?copyable(a.swift,a.swift,L('Copy SWIFT / BIC','复制 SWIFT / BIC')):'<span class="faint">—</span>'],
        [L(...EA.labels.bankAddress),E([a.bankCity,EA.regionName(a.bankCountry)].filter(Boolean).join(', '))||'—']])+
      section(L('Account holder address','账户持有人地址'),[[L('Address','地址'),E([a.addressLine,a.addressCity,EA.regionName(a.addressCountry)].filter(Boolean).join(', '))||'—']])+
      section(L('Intermediary bank','中转行信息'),a.interSwift?[[L(...EA.labels.interName),E(a.interName)],[L(...EA.labels.interSwift),E(a.interSwift)],
        [L(...EA.labels.interAccount),'<span class="mono">'+E(a.interAccount)+'</span>']]:[[L('Status','状态'),L('Not provided','未填写')]])+
      section(L('Record','记录'),times);
  }
  const gone=()=>({title:L('Account','账户'),html:CF.note('warn',L('This account has been deleted.','该账户已删除。')),foot:b('close','Close','关闭')});
  const layers={
    'ea-form':()=>{setTimeout(restoreForm,0);
      return {title:formTitle(),html:F().kind==='fiat'?fiatForm():cryptoForm(),foot:formFoot()};},
    'ea-view':id=>{const a=EA.byId(id);if(!a)return gone();
      return {title:EA.plainName(a),html:'<div class="ea-drawer">'+incomplete(a)+viewSections(a)+'</div>',
        foot:b('remove','Delete','删除',a.id)+b('close','Close','关闭')+b('edit','Edit','修改',a.id,true)};},
    'ea-remove':id=>{const a=EA.byId(id);if(!a)return gone();
      const peers=EA.accounts(owner(),a.kind).filter(x=>x.id!==a.id&&!EA.missing(x).length&&(a.kind==='fiat'||x.chain===a.chain));
      const last=!peers.length?'<p>'+(a.kind==='fiat'
        ?L('This is your only usable USD account. Until you add another, USD transactions can\'t be submitted.','删除后 USD 暂无可选账户，相关业务办理将无法提交，需要时可重新登记。')
        :L('This is your only usable account on '+a.chain+'. Until you add another, transactions settled on '+a.chain+' can\'t be submitted.','删除后 '+a.chain+' 链暂无可选账户，相关业务办理将无法提交，需要时可重新登记。'))+'</p>':'';
      return {title:L('Delete this account?','删除这个账户？'),
        html:'<div class="ea-confirm"><p><b>'+EA.name(a)+'</b><br><span class="hint">'+EA.key(a)+'</span></p>'+
          CF.note('warn','<div><p>'+L('It will no longer be available to select in transactions. Transactions already submitted keep the account details they were submitted with.',
            '删除后该账户不再出现在任何选用列表；已提交的业务记录保留当时的账户信息，不受影响。')+'</p>'+last+
          '<p>'+L('This can\'t be undone.','删除后不可撤销。')+(a.kind==='crypto'?' '+L('To use this address again, you\'ll need to add it and sign again.','再次使用该地址需重新登记并签名。'):'')+'</p></div>')+
          (V.problem?CF.note('red',E(V.problem)):'')+'</div>',
        foot:b('close','Cancel','取消','',false,V.busy==='remove')+
          b('remove-confirm',V.busy==='remove'?'Deleting…':'Delete account',V.busy==='remove'?'正在删除…':'确认删除',a.id,true,V.busy==='remove')};},
    'ea-wallet':()=>({title:L('Wallet signature request','钱包签名请求'),
      html:'<div class="ea-wallet"><p>'+L('Sign with this address to confirm you own it.','请用这个地址签名，确认它归你所有。')+'</p>'+
        '<p class="mono ea-break">'+E(F()?.form.address||'')+'</p>'+
        '<p class="hint">'+L('This signature doesn\'t send a transaction, doesn\'t change how you sign in, and doesn\'t switch your login wallet.',
          '本次签名不会发起交易，不会改变你的登录方式，也不会更换登录钱包。')+'</p></div>',
      foot:b('wallet','Decline','拒绝签名','rejected')+b('wallet','Sign with another address','用其他地址签名','mismatch')+
        b('wallet','Wallet unavailable','钱包不可用','unavailable')+b('wallet','Sign','确认签名','ok',true)}),
    'ea-discard':()=>({title:L('Discard your changes?','放弃填写内容？'),
      html:'<div class="ea-confirm"><p>'+L('Nothing you entered will be saved.','已填写的内容不会保存。')+'</p></div>',
      foot:b('discard-keep','Keep editing','继续编辑')+b('discard-drop','Discard','放弃填写','',true)}),
    'ea-copy':()=>({title:L('Copy','复制'),
      html:'<input class="inp ea-copy-value" readonly value="'+E(V.copyValue)+'" aria-label="'+L('Value to copy','待复制内容')+'">'+
        '<p>'+L('Select the text and copy it.','请选中文本后复制。')+'</p>',foot:b('close','Close','关闭')})
  };

  function restoreForm(){
    const f=F();if(!f)return;
    const host=document.querySelector('.drawer:has(.ea-drawer)');if(!host)return;
    const heading=host.querySelector('.drawer-h');if(heading)heading.tabIndex=-1;
    const first=Object.keys(f.errors||{})[0];
    const target=first&&(document.getElementById('ea-f-'+first)||(first==='chain'&&host.querySelector('[data-ea-chain]')));
    if(target){target.focus({preventScroll:true});target.scrollIntoView({block:'center',behavior:'auto'});return;}
    if(f.focus){const el=document.getElementById(f.focus);f.focus='';if(el){el.focus({preventScroll:true});return;}}
    const notice=host.querySelector('.ea-drawer > .note.warn:last-child, .ea-drawer > .note.red');
    if(notice&&(f.conflict||f.duplicate||f.problem)){notice.tabIndex=-1;notice.focus({preventScroll:true});notice.scrollIntoView({block:'nearest'});return;}
    if(heading)heading.focus({preventScroll:true});
  }

  /* ------------------------------------------------------------------ 动作 */
  function openForm(kind,mode,id){
    const a=id?EA.byId(id):null;
    V.flow={kind,mode,id:id||'',step:kind==='crypto'&&mode==='new'?1:0,
      form:a?fromAccount(a):kind==='fiat'?blankFiat():{chain:'',label:'',address:''},
      errors:{},dirty:false,ack:false,conflict:false,duplicate:'',problem:'',focus:'',interOpen:false,sameName:false};
    V.problem='';CF.openLayer('drawer','ea-form');
  }
  const dirty=()=>{const f=F();return !!f&&(f.dirty||f.kind==='crypto'&&f.mode==='new'&&!!(f.form.chain||f.form.address||f.form.label));};
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
      case 'tab':if(KINDS.includes(v)&&v!==tab())setTab(v);break;
      case 'reload':V.scene='loading';{const token=++V.epoch;setTimeout(()=>{if(token===V.epoch){V.scene='ready';CF.render();}},600);}break;
      case 'add':openForm(v,'new');break;
      case 'view':if(S.layer?.key==='ea-form')V.flow=null;CF.openLayer('drawer','ea-view',v);break;
      case 'edit':{const a=EA.byId(v);if(!a){CF.toast(L('This account has been deleted.','该账户已删除。'));break;}openForm(a.kind,'edit',v);break;}
      case 'remove':V.problem='';CF.openLayer('modal','ea-remove',v);break;
      case 'remove-confirm':{
        V.busy='remove';const token=++V.epoch;CF.render();
        setTimeout(()=>{if(token!==V.epoch)return;V.busy='';
          if(V.saveResult==='failed'){V.problem=L('We couldn\'t delete this account. Nothing was changed; please try again.','删除失败，账户保持原状，请重试。');CF.render();return;}
          EA.remove(v);S.layer=null;CF.render();CF.toast(L('Account deleted.','账户已删除。'));
          setTimeout(()=>document.querySelector('.ea-tabs [aria-selected="true"]')?.focus(),0);},450);
        break;}
      case 'close':if(S.layer?.key==='ea-form')closeForm();else{V.flow=null;CF.closeLayer();}break;
      case 'discard-keep':S.layer=V.pending;V.pending=null;break;
      case 'discard-drop':V.flow=null;V.pending=null;CF.closeLayer();break;
      case 'back':{const f=F();f.step=Math.max(1,f.step-1);f.problem='';f.errors={};f.duplicate='';break;}
      case 'next':{const f=F();
        if(f.step===1){if(!f.form.chain){f.errors={chain:L('Select a network first.','请先选择结算收款链。')};break;}f.errors={};f.step=2;f.focus='ea-f-label';}
        else if(validateAddress()){f.errors={};f.step=3;}
        break;}
      case 'save':{const f=F();
        if(f.kind==='crypto'){if(!val('label').trim()){f.errors={label:REQUIRED};break;}
          f.errors={};later(()=>{EA.update(f.id,{label:val('label').trim()});V.flow=null;CF.closeLayer();CF.toast(L('Changes saved.','修改已保存。'));});break;}
        if(f.conflict&&!f.ack)f.ack=true;
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

  /* ------------------------------------------------------------------ 输入、Tab 键盘与离页保护 */
  const CODE_FIELDS=['iban','swift','interSwift'];
  document.addEventListener('input',e=>{
    const el=e.target,k=el.dataset.eaField;if(!k||!F())return;
    F().form[k]=el.value;F().dirty=true;
    if(F().errors[k]){delete F().errors[k];el.removeAttribute('aria-invalid');
      const slot=document.getElementById(el.id+'-err');if(slot)slot.textContent='';}
    if(F().problem){F().problem='';document.querySelector('.ea-drawer .note.red')?.remove();}
  });
  /* change 在失焦时才到，重绘会吞掉紧接着的那一次点击；这里只更新取值与就地提示，不整体重绘。 */
  document.addEventListener('change',e=>{
    const el=e.target;
    if(el.dataset.eaField&&F()){const k=el.dataset.eaField;
      if(CODE_FIELDS.includes(k)&&k!=='iban'){el.value=EA.compact(el.value);}
      F().form[k]=el.value;F().dirty=true;
      if(['swift','bankCountry'].includes(k)){F().conflict=false;F().ack=false;}
      if(k==='label'){F().sameName=EA.sameName(owner(),el.value,F().id);
        const slot=document.querySelector('[data-ea-namehint]');if(slot)slot.textContent=F().sameName?L('Another account already uses this nickname. You can keep it, but a distinct name is easier to tell apart.',
          '已有账户使用相同的备注名。可以保留，但用不同的名称更容易区分。'):'';}
      return;}
    if(el.dataset.eaChain&&F()){F().form.chain=el.dataset.eaChain;F().dirty=true;F().errors={};const slot=document.getElementById('ea-f-chain-err');if(slot)slot.textContent='';return;}
    if(el.id==='ea-save-result'){V.saveResult=el.value;return;}
  });
  document.addEventListener('toggle',e=>{if(e.target.classList?.contains('ea-inter')&&F())F().interOpen=e.target.open;},true);
  /* Tab 列表按 WAI-ARIA：左右方向键切换并选中，Home / End 到首尾。 */
  document.addEventListener('keydown',e=>{
    const t=e.target.closest?.('.ea-tabs [role="tab"]');if(!t)return;
    const i=KINDS.indexOf(t.dataset.v);let n=-1;
    if(e.key==='ArrowRight')n=(i+1)%KINDS.length;else if(e.key==='ArrowLeft')n=(i+KINDS.length-1)%KINDS.length;
    else if(e.key==='Home')n=0;else if(e.key==='End')n=KINDS.length-1;
    if(n<0)return;e.preventDefault();setTab(KINDS[n]);
  });
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
    const q=query(),back=q.get('return')||'';
    if(!back||!/^\/(marketplace|project|console|assets)(?:[/?]|$)/.test(back)||/[<>]/.test(back))return;
    V.returnTo=back;V.returnKind=q.get('from')||'';V.returnBiz=q.get('business')||'';
  }
  setTimeout(readReturn,0);

  /* ------------------------------------------------------------------ 评审工具 */
  CF.review.register(PAGE,{group:['Company accounts','企业账户'],route:ROUTE,
    states:['default',{id:'unverified',label:['Not verified yet','尚未取得认证资格'],group:'business'},'loading','empty','error'],
    get:()=>V.unverified?'unverified':V.scene==='ready'?'default':V.scene,
    set(value){V.unverified=value==='unverified';V.scene=['loading','empty','error'].includes(value)?value:'ready';},
    reset(){V.unverified=false;V.scene='ready';V.epoch++;}});

  const select=(id,label,options,current)=>'<div class="field"><label for="'+id+'">'+label+'</label>'+
    '<select class="inp" id="'+id+'">'+options.map(o=>'<option value="'+o[0]+'"'+(current===o[0]?' selected':'')+'>'+L(o[1],o[2])+'</option>').join('')+'</select></div>';
  function tools(){
    return '<section class="ea-demo"><h5>'+L('Account simulations','账户模拟')+'</h5>'+
      '<p class="hint">'+L('Local simulation only. No wallet, chain or backend is contacted. Signature outcomes are chosen in the simulated wallet dialog.',
        '仅本地模拟：不调用钱包、链上接口或后端。签名结果在模拟钱包对话框内选择。')+'</p>'+
      select('ea-save-result',L('Next save / delete response','下次保存 / 删除响应'),[['success','Success','成功'],['failed','Failed','失败']],V.saveResult)+
      '<div class="seg">'+b('demo','Reset demonstration accounts','重置演示账户','reseed')+'</div></section>';
  }
  function demoAction(v){
    if(v==='reseed'){EA.reseed();V.flow=null;V.scene='ready';S.layer=null;S.demo=false;CF.toast(L('Demonstration accounts restored.','演示账户已恢复。'));}
  }
  const host=CF.LSView,priorDemo=host&&host.demo;
  if(host)host.demo=function(){return (S.page===PAGE?tools():'')+(priorDemo?priorDemo.call(host):'');};

  CF.define(CF.EAView={id:'enterprise-accounts',pages:[PAGE],dict,layers,content(){return page();},onAct});
})(window.CF);
