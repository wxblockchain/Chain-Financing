/* 企业账户（面客 · 资产方与资金方双侧）。资产方侧展示名“企业账户”，资金方侧“机构账户”，同一页面、同一套字段。
   继承面客端 portal 壳层与公共组件；本模块只提供总览页内容、详情面板与维护、确认对话框，导航、路由、浮层宿主由 _shared/shell.js 提供。
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
  /* 按用户指定：数币账户 Tab 在前、法币账户 Tab 在后；进入本页默认打开第一个 Tab。 */
  const KINDS=['crypto','fiat'];

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
    '" data-act="ea-'+act+'" data-v="'+E(v)+'"'+(off?' disabled':'')+'>'+(act==='add'?'<span class="ea-plus" aria-hidden="true">+</span>':'')+L(en,zh)+'</button>';
  const link=(act,en,zh,v,label)=>'<button type="button" class="actlink" data-act="ea-'+act+'" data-v="'+E(v)+'" aria-label="'+
    E(L(en,zh)+' · '+label)+'">'+L(en,zh)+'</button>';
  const dl=rows=>'<dl class="dl ea-dl">'+rows.map(r=>'<dt>'+r[0]+'</dt><dd>'+r[1]+'</dd>').join('')+'</dl>';
  const zone=()=>E(S.tz||'UTC');
  const stamp=iso=>iso?'<span class="num">'+E(CF.fmtStamp(iso))+'</span> <span class="muted">('+zone()+')</span>':'—';
  const copyable=(shown,value,label,cls='mono')=>'<span class="copy-pair"><span class="'+cls+'">'+E(shown)+'</span>'+
    CF.copyBtn('ea-copy',value,label)+'</span>';
  /* 本模块图形来自已内嵌的 CC0 图库；不改变目录、币种顺序或选择默认值。 */
  const assetLabel=code=>'<span class="ea-asset-label" title="'+E(EA.currencyName(code))+'">'+CF.eaAssetIcon(code)+'<span>'+E(code)+'</span></span>';
  function assetTags(c,compact=false){
    if(!c.length)return '<span class="faint">—</span>';
    const all='<span class="ea-ccy-list">'+c.map(assetLabel).join('')+'</span>';
    if(!compact)return all;
    const label=L('View all currencies: ','查看全部币种：')+c.join(', ');
    return '<button type="button" class="ea-currency-peek" aria-label="'+E(label)+'" data-ea-currencies="'+E(JSON.stringify(c))+'">'+
      '<span class="ea-icon-stack">'+c.slice(0,2).map(x=>CF.eaAssetIcon(x)).join('')+(c.length>2?'<span class="ea-more-icon" aria-hidden="true">+</span>':'')+'</span></button>';
  }
  const currencyTags=(a,compact=false)=>assetTags(EA.currencies(a),compact);
  const tokenTags=(compact=false)=>assetTags(EA.TOKENS,compact);
  /* 网络只展示全名（以太坊 / Ethereum），不展示 ETH 缩写，避免与 ETH 币混淆。 */
  const networkTag=code=>'<span class="ea-network"><span class="ea-asset-label">'+CF.eaAssetIcon(code)+'<span>'+E(EA.chainName(code))+'</span></span></span>';
  const kindIcon=kind=>'<svg class="ea-kind-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+
    (kind==='fiat'?'<path d="m3 9 9-5 9 5H3ZM5 11v7m5-7v7m4-7v7m5-7v7M3 21h18"/>':'<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18m-4 4h4v4h-4a2 2 0 0 1 0-4Z"/>')+'</svg>';
  const kindName=k=>k==='fiat'?L('Fiat accounts','法币账户'):L('Crypto accounts','数币账户');

  /* 浮窗挂在 body / top layer，避开表格滚动与卡片裁切；只展示，不改变行高或业务状态。 */
  let currencyAnchor=null,currencyTip=null,currencyTimer=0;
  function hideCurrencyTip(){
    clearTimeout(currencyTimer);
    if(currencyTip){if(currencyTip.hidePopover&&currencyTip.matches(':popover-open'))currencyTip.hidePopover();currencyTip.hidden=true;}
    currencyAnchor?.removeAttribute('aria-describedby');currencyAnchor=null;
  }
  function placeCurrencyTip(){
    if(!currencyAnchor)return;
    if(!currencyAnchor.isConnected){hideCurrencyTip();return;}
    const r=currencyAnchor.getBoundingClientRect(),w=currencyTip.offsetWidth,h=currencyTip.offsetHeight;
    if(r.bottom<0||r.top>innerHeight){hideCurrencyTip();return;}
    currencyTip.style.left=Math.max(12,Math.min(r.left,innerWidth-w-12))+'px';
    currencyTip.style.top=Math.max(12,r.bottom+8+h<=innerHeight-12?r.bottom+8:r.top-h-8)+'px';
  }
  function showCurrencyTip(anchor){
    clearTimeout(currencyTimer);
    if(currencyAnchor!==anchor)hideCurrencyTip();
    if(!currencyTip){currencyTip=document.createElement('div');currencyTip.id='ea-currency-tooltip';
      currencyTip.className='ea-currency-tooltip';currencyTip.setAttribute('role','tooltip');currencyTip.setAttribute('popover','manual');
      document.body.appendChild(currencyTip);}
    currencyAnchor=anchor;currencyTip.innerHTML=assetTags(JSON.parse(anchor.dataset.eaCurrencies));currencyTip.hidden=false;
    if(currencyTip.showPopover&&!currencyTip.matches(':popover-open'))currencyTip.showPopover();
    anchor.setAttribute('aria-describedby',currencyTip.id);placeCurrencyTip();
  }
  const tipTarget=target=>target?.closest?.('.ea-currency-peek');
  document.addEventListener('pointerover',e=>{
    if(e.pointerType==='touch')return;
    const anchor=tipTarget(e.target);
    if(anchor&&!anchor.contains(e.relatedTarget))showCurrencyTip(anchor);
    if(currencyTip?.contains(e.target))clearTimeout(currencyTimer);
  });
  document.addEventListener('pointerout',e=>{
    if(!currencyAnchor||!(currencyAnchor.contains(e.target)||currencyTip.contains(e.target)))return;
    if(currencyAnchor.contains(e.relatedTarget)||currencyTip.contains(e.relatedTarget))return;
    currencyTimer=setTimeout(()=>{if(document.activeElement!==currencyAnchor)hideCurrencyTip();},140);
  });
  document.addEventListener('focusin',e=>{const anchor=tipTarget(e.target);if(anchor)showCurrencyTip(anchor);});
  document.addEventListener('focusout',e=>{if(e.target===currencyAnchor)hideCurrencyTip();});
  document.addEventListener('click',e=>{
    const anchor=tipTarget(e.target);
    if(anchor){showCurrencyTip(anchor);return;}
    if(currencyAnchor&&!currencyTip.contains(e.target))hideCurrencyTip();
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&currencyAnchor){hideCurrencyTip();e.preventDefault();e.stopImmediatePropagation();}
  },true);
  window.addEventListener('scroll',placeCurrencyTip,true);
  window.addEventListener('resize',placeCurrencyTip);

  /* ------------------------------------------------------------------ 视图参数：Tab 与回流目标写在 query 里，刷新与分享可恢复 */
  function query(){return new URLSearchParams(location.hash.split('?')[1]||'');}
  function tab(){const t=query().get('type');return KINDS.includes(t)?t:KINDS[0];}
  function setTab(t){
    const q=query();if(t===KINDS[0])q.delete('type');else q.set('type',t);
    const s=q.toString();history.replaceState(null,'','#'+ROUTE+(s?'?'+s:''));
    CF.render();
    setTimeout(()=>document.querySelector('.ea-tabs [aria-selected="true"]')?.focus(),0);
  }

  /* ------------------------------------------------------------------ 总览 */
  function head(){
    return '<div class="page-head ea-head"><div><h1 class="page-title">'+E(title())+'</h1>'+
      '<p class="page-desc">'+L('Your company\'s crypto and bank accounts. When you accept a quote or record a disbursement, you choose one of the accounts saved here.',
        '本企业自己的数币账户与法币账户。接受报价、登记放款时，从这里已登记的账户中选用。')+'</p></div>'+
      '<div class="page-actions">'+CF.tag('',L('Demonstration data','演示数据'))+'</div></div>';
  }
  /* 未登录与登录未绑定角色都取不到本企业账户；这里给本页的引导。 */
  function accessSurface(){
    if(S.role==='signed')return CF.empty(L('This page is not available for your current role','该页面不适用于当前身份'),
      L('Accounts belong to an asset holder or funder account.','账户属于已绑定角色的资产方或资金方账号。'),
      '<button class="btn primary" type="button" data-act="go" data-v="/assets">'+L('Back to assets','返回资产广场')+'</button>');
    return CF.empty(L('Sign in to view your accounts','登录后查看本企业账户'),
      L('After signing in, you will return to this page.','登录后将返回当前页面。'),
      '<button class="btn primary" type="button" data-act="signin">'+L('Connect wallet','连接钱包')+'</button>');
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
        '" data-act="ea-tab" data-v="'+k+'">'+kindIcon(k)+kindName(k)+' <span class="ea-count">'+list(k).length+'</span></button>').join('')+
      '<div class="ea-tab-actions">'+(list(current).length?b('add',current==='fiat'?'Add fiat account':'Add crypto account',
        current==='fiat'?'新增法币账户':'新增数币账户',current,true):'')+'</div></div>';
  }
  function empty(kind){
    return kind==='fiat'
      ? CF.empty(L('No fiat accounts yet','尚未登记法币账户'),L('Add a USD bank account to use it in USD transactions.','登记 USD 银行账户后，即可在 USD 结算的业务中选用。'),
          b('add','Add fiat account','新增法币账户','fiat',true))
      : CF.empty(L('No crypto accounts yet','尚未登记数币账户'),L('Add an Ethereum address to use it in USDT and USDC transactions.','登记以太坊网络上的地址后，即可在 USDT、USDC 结算的业务中选用。'),
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
    const h=[L('Account','账户'),L('Account type','账户类型'),L('Currencies','账户币种'),L('Bank','开户行'),L('Account number / IBAN','账号 / IBAN'),L('SWIFT / BIC','SWIFT / BIC')];
    return '<table class="tbl resp ea-table ea-table-fiat"><thead><tr>'+h.map(x=>'<th scope="col">'+x+'</th>').join('')+
      '<th scope="col">'+L('Added','登记时间')+'<span class="ea-th-zone">'+zone()+'</span></th><th scope="col" class="col-act"><span class="sr-only">'+L('Actions','操作')+'</span></th></tr></thead><tbody>'+
      /* 账户列：备注名为主标识，下方是平台带出的账户名称。 */
      rows.map(a=>'<tr><td data-label="'+h[0]+'"><div class="cell-wrap"><span class="cell-main">'+EA.name(a)+'</span><span class="cell-sub">'+(EA.holderName(a)||'—')+'</span>'+incomplete(a)+'</div></td>'+
        '<td data-label="'+h[1]+'">'+(a.accountType?'<span class="ea-type">'+E(EA.typeName(a))+'</span>':'<span class="faint">—</span>')+'</td>'+
        '<td data-label="'+h[2]+'">'+currencyTags(a,true)+'</td>'+
        '<td data-label="'+h[3]+'"><div class="cell-wrap"><span>'+E(a.bank)+'</span><span class="cell-sub">'+E(a.bankCity||'')+'</span></div></td>'+
        '<td data-label="'+h[4]+'" class="nw"><span class="mono">'+EA.maskTail(EA.compact(a.iban))+'</span></td>'+
        '<td data-label="'+h[5]+'" class="nw">'+(a.swift?'<span class="mono">'+E(a.swift)+'</span>':'<span class="faint">—</span>')+'</td>'+
        '<td data-label="'+L('Added','登记时间')+'" class="nw muted"><span class="num">'+E(CF.fmtStamp(a.at))+'</span></td>'+actions(a)+'</tr>').join('')+'</tbody></table>';
  }
  function cryptoTable(rows){
    const h=[L('Account nickname','账户备注名'),L('Network','结算收款链'),L('Wallet address','数币地址'),L('Supported tokens','适用代币')];
    return '<table class="tbl resp ea-table ea-table-crypto"><thead><tr>'+h.map(x=>'<th scope="col">'+x+'</th>').join('')+
      '<th scope="col">'+L('Added','登记时间')+'<span class="ea-th-zone">'+zone()+'</span></th><th scope="col" class="col-act"><span class="sr-only">'+L('Actions','操作')+'</span></th></tr></thead><tbody>'+
      rows.map(a=>'<tr><td data-label="'+h[0]+'"><span class="cell-main">'+EA.name(a)+'</span></td>'+
        '<td data-label="'+h[1]+'">'+networkTag(a.chain)+'</td>'+
        '<td data-label="'+h[2]+'" class="nw"><span class="mono">'+EA.maskAddress(a.address)+'</span></td>'+
        '<td data-label="'+h[3]+'">'+tokenTags(true)+'</td>'+
        '<td data-label="'+L('Added','登记时间')+'" class="nw muted"><span class="num">'+E(CF.fmtStamp(a.at))+'</span></td>'+actions(a)+'</tr>').join('')+'</tbody></table>';
  }
  function panel(){
    const k=tab(),rows=list(k);
    return '<div id="ea-panel" role="tabpanel" aria-labelledby="ea-tab-'+k+'" class="ea-panel">'+
      (rows.length?'<div class="tablewrap">'+(k==='fiat'?fiatTable(rows):cryptoTable(rows))+'</div>':empty(k))+'</div>';
  }
  function page(){
    hideCurrencyTip();
    CF.PAGES[PAGE].navKey=S.role==='fund'?'navInstitutionAccounts':'navCompanyAccounts';
    if(!['asset','fund'].includes(S.role))return head()+accessSurface();
    const e=eligible();
    if(!e.verified)return head()+guidance(e);
    if(V.scene==='loading')return head()+'<section class="card">'+CF.skelTable(4)+'</section>';
    if(V.scene==='error')return head()+loadError();
    return head()+returnBanner()+'<section class="card ea-card">'+tabs()+panel()+'</section>';
  }

  /* ------------------------------------------------------------------ 表单 */
  const blankFiat=()=>({accountType:'',label:'',ccys:[],iban:'',bank:'',bankCity:'',swift:''});
  const fromAccount=a=>a.kind==='crypto'?{label:EA.plainName(a),chain:a.chain,address:a.address}
    :Object.assign(blankFiat(),{accountType:a.accountType||'',label:EA.plainName(a),ccys:EA.currencies(a).slice(),iban:a.iban||'',bank:a.bank||'',
      bankCity:a.bankCity||'',swift:a.swift||''});
  const F=()=>V.flow;
  const val=k=>String(F().form[k]||'');
  const err=k=>F().errors[k]||'';
  const required=k=>EA.fiatRequired.includes(k)||k==='address';
  const requiredMark='<span class="ea-required" aria-hidden="true">*</span>';
  const requiredGroup=()=>requiredMark+'<span class="sr-only">'+L(' (Required)','（必填）')+'</span>';
  /* 输入属性按国际化表单惯例给出：地址字段带 autocomplete，代码类关闭拼写检查并转大写。 */
  const INPUT={
    label:'autocomplete="off"',
    iban:'autocomplete="off" spellcheck="false" autocapitalize="characters"',bank:'autocomplete="off"',bankCity:'autocomplete="off"',
    swift:'autocomplete="off" spellcheck="false" autocapitalize="characters" maxlength="14"',
    address:'autocomplete="off" spellcheck="false" autocapitalize="off"'};
  const HINT={bankCity:['The city where the bank branch is located.','开户行所在城市。'],iban:['Enter it as your bank shows it. Spaces are ignored.','按开户行提供的写法填写，空格会被忽略。'],
    swift:['8 or 11 letters and digits.','8 位或 11 位字母数字。'],
    address:['An Ethereum address: 0x followed by 40 hexadecimal characters. It can\'t be changed after the account is saved.','以太坊地址：0x 开头，后接 40 位十六进制字符；登记后不可修改。']};
  const NAME_HINT=['Another account already uses this nickname. You can keep it, but a distinct name is easier to tell apart.','已有账户使用相同的备注名。可以保留，但用不同的名称更容易区分。'];

  function field(k,full=false,placeholder=''){
    const id='ea-f-'+k,hint=HINT[k];
    const extraHint=k==='label'?'<span class="hint" id="'+id+'-hint" data-ea-namehint>'+(F().sameName?L(...NAME_HINT):'')+'</span>':'';
    return '<div class="field'+(full?' ea-full':'')+'"><label for="'+id+'">'+(required(k)?requiredMark:'')+L(...EA.labels[k])+'</label>'+
      '<input class="inp" id="'+id+'" data-ea-field="'+k+'" type="text" value="'+E(val(k))+'"'+(placeholder?' placeholder="'+E(placeholder)+'"':'')+
      (required(k)?' aria-required="true"':'')+(err(k)?' aria-invalid="true"':'')+' aria-describedby="'+id+'-err'+(hint||extraHint?' '+id+'-hint':'')+'" '+(INPUT[k]||'')+'>'+
      (hint?'<span class="hint" id="'+id+'-hint">'+L(...hint)+'</span>':'')+extraHint+
      '<span class="err-msg" id="'+id+'-err" role="alert">'+E(err(k))+'</span></div>';
  }
  /* 账户类型：单选、必选、不预选；只作标注。 */
  function typeField(){
    const v=F().form.accountType;
    return '<fieldset class="ea-chains ea-types ea-full" aria-describedby="ea-f-accountType-err"'+(err('accountType')?' aria-invalid="true"':'')+'><legend>'+requiredGroup()+L(...EA.labels.accountType)+'</legend>'+
      '<div class="ea-chain-row">'+EA.ACCOUNT_TYPES.map(t=>'<label class="ea-chain"><input type="radio" name="ea-type" value="'+t.id+'" data-ea-type="'+t.id+'"'+(v===t.id?' checked':'')+
        '><span><b>'+L(...t.label)+'</b></span></label>').join('')+'</div>'+
      '<span class="err-msg" id="ea-f-accountType-err" role="alert">'+E(err('accountType'))+'</span></fieldset>';
  }
  /* 账户名称：平台按本企业当前名称带出，只读。 */
  function holderField(){
    const a=F().id?EA.byId(F().id):null,name=a&&a.holder?a.holder:EA.companyName();
    return '<div class="field"><span class="field-label" id="ea-holder-label">'+L(...EA.labels.holder)+'<span class="ea-readonly-label">'+L('Read only','只读')+'</span></span>'+
      '<span class="field-static" role="textbox" aria-readonly="true" aria-labelledby="ea-holder-label">'+(name?E(L(...name)):'—')+'</span>'+
      '<span class="hint">'+L('Your company\'s current name. It can\'t be edited.','本企业当前名称，不可修改。')+'</span></div>';
  }
  /* 账户币种：多选标注，选项取平台拟定的法币清单；不核验、不参与业务匹配。 */
  function currencyField(){
    const picked=F().form.ccys||[];
    return '<fieldset class="ea-ccys ea-full" aria-describedby="ea-f-ccys-hint ea-f-ccys-err"'+(err('ccys')?' aria-invalid="true"':'')+'>'+
      '<legend>'+requiredGroup()+L(...EA.labels.ccy)+'</legend>'+
      '<span class="hint" id="ea-f-ccys-hint">'+L('Select every currency this account supports. This is a label for your reference; the platform doesn\'t check it.',
        '选择这个账户支持的币种。仅作标注，方便你核对，平台不核验。')+'</span>'+
      '<div class="ea-chips">'+EA.CURRENCIES.concat(picked.filter(c=>!EA.CURRENCIES.includes(c))).map(c=>'<label class="ea-chip" title="'+E(EA.currencyName(c))+'"><input type="checkbox" data-ea-ccy="'+c+'"'+
        (picked.includes(c)?' checked':'')+' aria-label="'+E(c+' · '+EA.currencyName(c))+'"><span class="ea-chip-body">'+assetLabel(c)+'</span></label>').join('')+'</div>'+
      '<span class="err-msg" id="ea-f-ccys-err" role="alert">'+E(err('ccys'))+'</span></fieldset>';
  }
  /* 结算收款链：当前仅以太坊，平台固定带出，只读，用户不选择。 */
  function networkField(){
    return '<div class="field ea-full"><span class="field-label" id="ea-network-label">'+L(...EA.labels.chain)+'<span class="ea-readonly-label">'+L('Read only','只读')+'</span></span>'+
      '<span class="field-static ea-network-static" role="textbox" aria-readonly="true" aria-labelledby="ea-network-label">'+networkTag(EA.CHAIN)+'</span></div>';
  }
  const group=(heading,html,extra='')=>'<fieldset class="ea-group"><legend>'+heading+'</legend>'+extra+'<div class="ea-grid">'+html+'</div></fieldset>';
  const notice=(kind,html)=>'<div class="ea-notice">'+CF.note(kind,html)+'</div>';

  function fiatForm(){
    const f=F();
    return '<div class="ea-form">'+(f.problem?notice('red',E(f.problem)):'')+
      group(L('Account','账户信息'),typeField()+holderField()+field('label')+currencyField())+
      group(L('Bank details','开户行信息'),field('bank')+field('bankCity')+field('iban')+field('swift'))+
      (f.duplicate?notice('warn','<div class="ea-notice-row"><span>'+L('An account with this account number and SWIFT / BIC is already saved.',
        '已登记过相同账号与 SWIFT / BIC 的账户。')+'</span>'+b('view','View it','查看该账户',f.duplicate)+'</div>'):'')+'</div>';
  }
  function steps(step){
    return '<ol class="ea-steps" aria-label="'+L('Progress','进度')+'">'+[[1,'Address','填写地址'],[2,'Verify ownership','签名确认地址所有权']]
      .map(s=>'<li data-complete="'+(step>s[0])+'"'+(step===s[0]?' aria-current="step"':'')+'><span class="ea-step-no" aria-hidden="true">'+(step>s[0]?'✓':s[0])+'</span>'+L(s[1],s[2])+'</li>').join('')+'</ol>';
  }
  function cryptoForm(){
    const f=F();
    if(f.mode==='edit')return '<div class="ea-form">'+(f.problem?notice('red',E(f.problem)):'')+
      '<div class="ea-grid">'+field('label',true)+'</div>'+
      '<div class="ea-chosen">'+dl([[L(...EA.labels.chain),networkTag(f.form.chain)],[L(...EA.labels.address),'<span class="mono ea-break">'+E(f.form.address)+'</span>']])+'</div>'+
      '<p class="hint">'+L('The address can\'t be changed. To use a different address, add a new crypto account and verify it, then delete this one if you no longer need it.',
        '数币地址登记后不可修改。要换地址，请新增一个数币账户并完成签名，再按需删除本账户。')+'</p></div>';
    if(f.step===1)return '<div class="ea-form">'+steps(1)+
      notice('warn','<div><b>'+L('Only Ethereum addresses are supported, and only ones you can sign with.','当前仅支持以太坊网络地址，且只能登记你能签名的地址。')+'</b> '+
        L('Exchange deposit addresses, third-party custodial addresses and contract addresses that can\'t sign are not supported.',
          '交易所充值地址、第三方托管地址以及无法签名的合约地址都无法登记。')+'</div>')+
      '<div class="ea-grid">'+networkField()+field('address',true,'0x…')+field('label',true)+'</div>'+
      (f.duplicate?notice('warn','<div class="ea-notice-row"><span>'+L('This address is already saved for your company.','这个地址已经在本企业登记过了。')+'</span>'+
        b('view','View it','查看该账户',f.duplicate)+'</div>'):'')+'</div>';
    return '<div class="ea-form">'+steps(2)+
      '<div class="ea-chosen">'+dl([[L(...EA.labels.label),E(f.form.label)],[L(...EA.labels.chain),networkTag(f.form.chain)],
        [L(...EA.labels.address),'<span class="mono ea-break">'+E(f.form.address)+'</span>']])+'</div>'+
      '<p class="ea-lead">'+L('Sign a message with this address in your wallet to confirm you own it. This doesn\'t send a transaction, change how you sign in, or switch your login wallet.',
        '请用这个地址在钱包中签名，确认它归你所有。此次签名不会发起交易，不会改变你的登录方式，也不会更换登录钱包。')+'</p>'+
      (f.problem?notice('red',E(f.problem)):'')+'</div>';
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
      return cancel+b('save',busy?'Saving…':f.mode==='edit'?'Save changes':'Add account',
        busy?'正在保存…':f.mode==='edit'?'保存修改':'登记账户','',true,busy);
    if(f.step===1)return cancel+b('next','Continue','下一步','',true);
    return b('back','Back','上一步','',false,busy)+b('sign',busy?'Waiting for wallet…':'Sign in wallet',busy?'等待钱包签名…':'在钱包中签名','',true,busy);
  }

  /* ------------------------------------------------------------------ 校验与保存 */
  const REQUIRED=()=>L('This field is required.','该项为必填。');
  const TOO_LONG=k=>k==='iban'?L('Use '+EA.TEXT_MAX+' characters or fewer, not counting spaces.','不超过 '+EA.TEXT_MAX+' 个字符（不计空格）。')
    :L('Use '+EA.TEXT_MAX+' characters or fewer.','不超过 '+EA.TEXT_MAX+' 个字符。');
  const LIMITED=['label','iban','bank'];
  const addressError=()=>L('That isn\'t a valid Ethereum address. It should start with 0x followed by 40 hexadecimal characters.',
    '这不是一个有效的以太坊地址，应以 0x 开头并包含 40 位十六进制字符。');
  function validateFiat(){
    const f=F(),e={};
    EA.fiatRequired.forEach(k=>{
      if(k==='ccys'){if(!(f.form.ccys||[]).length)e.ccys=L('Select at least one currency.','请至少选择一个币种。');}
      else if(k==='accountType'){if(!f.form.accountType)e.accountType=L('Select an account type.','请选择账户类型。');}
      else if(!val(k).trim())e[k]=REQUIRED();});
    LIMITED.forEach(k=>{if(!e[k]&&EA.tooLong(k,val(k)))e[k]=TOO_LONG(k);});
    if(val('swift').trim()&&!EA.swiftValid(val('swift')))e.swift=L('Enter 8 or 11 letters and digits.','请输入 8 位或 11 位字母数字。');
    f.errors=e;
    if(Object.keys(e).length)return false;
    const dup=EA.duplicateFiat(owner(),val('iban'),val('swift'),f.id);
    f.duplicate=dup?dup.id:'';
    return !dup;
  }
  /* 结算收款链固定为以太坊：地址不符合以太坊格式（含其他网络格式）都不能进入签名。 */
  function validateAddress(){
    const f=F(),e={};
    const address=val('address').trim();
    if(!address)e.address=REQUIRED();
    else if(!EA.addressValid(address))e.address=addressError();
    if(!val('label').trim())e.label=REQUIRED();else if(EA.tooLong('label',val('label')))e.label=TOO_LONG('label');
    f.errors=e;
    if(Object.keys(e).length)return false;
    const dup=EA.duplicateCrypto(owner(),address);
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
    const patch={accountType:form.accountType,label:t('label'),ccys:EA.CURRENCIES.filter(c=>form.ccys.includes(c)).concat(form.ccys.filter(c=>!EA.CURRENCIES.includes(c))),
      iban:EA.compact(form.iban),bank:t('bank'),bankCity:t('bankCity'),swift:EA.compact(form.swift)};
    if(f.mode==='edit')EA.update(f.id,patch);
    else{const name=EA.companyName();if(!name){V.flow=null;S.layer={type:'modal',key:'ea-noname'};CF.render();return;}EA.add(Object.assign({kind:'fiat',holder:name},patch));}
    V.flow=null;CF.closeLayer();
    CF.toast(f.mode==='edit'?L('Changes saved.','修改已保存。'):L('Fiat account added.','法币账户已登记。'));
  }
  function commitAddress(){
    const f=F();
    EA.add({kind:'crypto',chain:EA.CHAIN,label:f.form.label.trim(),address:f.form.address.trim(),ownership:'signed'});
    V.flow=null;CF.closeLayer();
    if(tab()!=='crypto')setTab('crypto');
    CF.toast(L('Crypto account added.','数币账户已登记。'));
  }
  /* 钱包对话框是模拟的签名宿主：它给出本次签名的结果。 */
  function signature(r){
    const f=F();
    V.busy='save';f.problem='';S.layer=V.pending||S.layer;V.pending=null;
    const token=++V.epoch;CF.render();
    setTimeout(()=>{
      if(token!==V.epoch||F()!==f)return;
      V.busy='';
      if(r==='mismatch')f.problem=L('The signing address doesn\'t match the address you\'re adding. Please sign with that address.','签名的地址和你要登记的地址不是同一个，请用该地址签名。');
      else if(r==='rejected')f.problem=L('The signature wasn\'t completed, so the account wasn\'t saved. You can try again.','本次没有完成签名，账户尚未登记，你可以重试。');
      else if(r==='unavailable')f.problem=L('Your wallet is unavailable. Reconnect it and try again.','钱包环境不可用，请重新连接钱包后重试。');
      else if(r==='network')f.problem=L('Your wallet isn\'t on the Ethereum network. Switch to Ethereum in your wallet, then try again.','钱包当前不在以太坊网络，请在钱包中切换到以太坊网络后重试。');
      else {commitAddress();return;}
      CF.render();
    },550);
  }

  /* ------------------------------------------------------------------ 浮层 */
  /* 新增 / 修改账户、签名、删除与放弃确认都用居中对话框（标题 + 右上角关闭 + 底部右对齐主次按钮）；
     只读详情用右侧面板，便于对照列表。 */
  function viewSections(a){
    const section=(h,rows)=>'<section class="ea-view-section"><h3>'+h+'</h3>'+dl(rows)+'</section>';
    const times=[[L('Added','登记时间'),stamp(a.at)]].concat(a.updated?[[L('Last updated','最近修改'),stamp(a.updated)]]:[]);
    if(a.kind==='crypto')return section(L('Account','账户信息'),[[L(...EA.labels.label),EA.name(a)],[L(...EA.labels.chain),networkTag(a.chain)],
        [L(...EA.labels.tokens),tokenTags()]])+
      section(L('Wallet address','数币地址'),[[L(...EA.labels.address),copyable(a.address,a.address,L('Copy address','复制地址'),'hash ea-break')],
        [L(...EA.labels.ownership),CF.tag('ok',L('Confirmed by signature','已签名确认'))]])+section(L('Record','记录'),times);
    return section(L('Account','账户信息'),[[L(...EA.labels.label),EA.name(a)],[L(...EA.labels.holder),EA.holderName(a)||'—'],
        [L(...EA.labels.accountType),a.accountType?E(EA.typeName(a)):'<span class="faint">—</span>'],[L(...EA.labels.ccy),currencyTags(a)]])+
      section(L('Bank details','开户行信息'),[[L(...EA.labels.bank),E(a.bank)],
        [L(...EA.labels.iban),copyable(EA.groupIban(a.iban),EA.compact(a.iban),L('Copy account number','复制账号'))],
        [L(...EA.labels.swift),a.swift?copyable(a.swift,a.swift,L('Copy SWIFT / BIC','复制 SWIFT / BIC')):'<span class="faint">—</span>'],
        [L(...EA.labels.bankCity),E(a.bankCity||'')||'—']])+
      section(L('Record','记录'),times);
  }
  const gone=()=>({title:L('Account','账户'),html:CF.note('warn',L('This account has been deleted.','该账户已删除。')),foot:b('close','Close','关闭'),dismiss:true});
  const danger=(act,en,zh,v,off)=>'<button type="button" class="btn danger" data-act="ea-'+act+'" data-v="'+E(v)+'"'+(off?' disabled':'')+'>'+L(en,zh)+'</button>';
  const layers={
    'ea-form':()=>{setTimeout(restoreForm,0);
      return {title:formTitle(),html:F().kind==='fiat'?fiatForm():cryptoForm(),foot:formFoot(),dismiss:V.busy!=='save'};},
    'ea-view':id=>{const a=EA.byId(id);if(!a)return gone();
      return {title:EA.plainName(a),html:'<div class="ea-drawer">'+incomplete(a)+viewSections(a)+'</div>',
        foot:b('remove','Delete','删除',a.id)+b('close','Close','关闭')+b('edit','Edit','修改',a.id,true)};},
    'ea-remove':id=>{const a=EA.byId(id);if(!a)return gone();
      const peers=EA.accounts(owner(),a.kind).filter(x=>x.id!==a.id&&!EA.missing(x).length);
      const items=[L('It will no longer be available to select in transactions.','该账户不再出现在任何选用列表中。'),
        L('Transactions already submitted keep the account details they were submitted with.','已提交的业务记录保留当时的账户信息，不受影响。')];
      if(!peers.length)items.push(a.kind==='fiat'?L('This is your only usable fiat account. Until you add another, USD transactions can\'t be submitted.','删除后暂无可选法币账户，USD 结算的业务办理将无法提交，需要时可重新登记。')
        :L('This is your only usable crypto account. Until you add another, USDT and USDC transactions can\'t be submitted.','删除后暂无可选的数币账户，USDT、USDC 结算的业务办理将无法提交，需要时可重新登记。'));
      items.push(a.kind==='crypto'?L('This can\'t be undone. To use this address again, you\'ll need to add it and sign again.','删除不可撤销；再次使用该地址需重新登记并签名。'):L('This can\'t be undone.','删除不可撤销。'));
      return {title:L('Delete account?','删除账户？'),dismiss:V.busy!=='remove',
        html:'<div class="ea-confirm"><div class="ea-confirm-target"><b>'+EA.name(a)+'</b><span class="hint">'+EA.key(a)+'</span></div>'+
          '<ul class="ea-consequences">'+items.map(x=>'<li>'+x+'</li>').join('')+'</ul>'+(V.problem?CF.note('red',E(V.problem)):'')+'</div>',
        foot:b('close','Cancel','取消','',false,V.busy==='remove')+danger('remove-confirm',V.busy==='remove'?'Deleting…':'Delete account',V.busy==='remove'?'正在删除…':'删除账户',a.id,V.busy==='remove')};},
    'ea-wallet':()=>{const f=F();return {title:L('Signature request','签名请求'),dismiss:true,
      html:'<div class="ea-wallet"><div class="ea-wallet-head">'+networkTag(EA.CHAIN)+'<span>'+L('Verify address ownership','确认地址所有权')+'</span></div>'+
        '<div class="ea-wallet-box"><span class="hint">'+L('Signing address','签名地址')+'</span><span class="mono ea-break">'+E(f?.form.address||'')+'</span></div>'+
        '<p class="hint">'+L('Signing proves you control this address. It doesn\'t send a transaction or cost a network fee.','签名只证明你控制这个地址，不会发起交易，也不产生链上费用。')+'</p>'+
        '<div class="ea-sim"><span class="ea-sim-label">'+L('Simulate · review only','模拟 · 仅评审')+'</span>'+
          b('wallet','Signed by another address','用其他地址签名','mismatch')+b('wallet','Wallet not on Ethereum','钱包不在以太坊网络','network')+b('wallet','Wallet unavailable','钱包不可用','unavailable')+'</div></div>',
      foot:b('wallet','Decline','拒绝','rejected')+b('wallet','Sign','签名','ok',true)};},
    'ea-noname':()=>({title:L('Can\'t add a fiat account right now','暂时无法新增法币账户'),dismiss:true,
      html:'<div class="ea-confirm"><p>'+L('We can\'t get your company name at the moment, so a fiat account can\'t be added yet. Please try again later. You can still add a crypto account.',
        '暂时无法取得本企业名称，因此还不能新增法币账户，请稍后重试。新增数币账户不受影响。')+'</p></div>',
      foot:b('close','Close','关闭')+b('add','Try again','重试','fiat',true)}),
    'ea-discard':()=>({title:L('Discard changes?','放弃填写内容？'),
      html:'<div class="ea-confirm"><p>'+L('What you\'ve entered won\'t be saved.','已填写的内容不会保存。')+'</p></div>',
      foot:b('discard-keep','Keep editing','继续编辑')+danger('discard-drop','Discard','放弃','')}),
    'ea-copy':()=>({title:L('Copy','复制'),dismiss:true,
      html:'<input class="inp ea-copy-value" readonly value="'+E(V.copyValue)+'" aria-label="'+L('Value to copy','待复制内容')+'">'+
        '<p>'+L('Select the text and copy it.','请选中文本后复制。')+'</p>',foot:b('close','Close','关闭')})
  };

  function restoreForm(){
    const f=F();if(!f||S.layer?.key!=='ea-form')return;
    const host=[...document.querySelectorAll('#layers .modal')].pop();if(!host||!host.querySelector('.ea-form'))return;
    const body=host.querySelector('.modal-b'),heading=host.querySelector('.modal-h');if(heading)heading.tabIndex=-1;
    const first=Object.keys(f.errors||{})[0];
    const target=first&&(first==='ccys'?host.querySelector('[data-ea-ccy]'):first==='accountType'?host.querySelector('[data-ea-type]'):document.getElementById('ea-f-'+first));
    if(target){target.focus({preventScroll:true});target.scrollIntoView({block:'center',behavior:'auto'});return;}
    /* 打开或换步时的初始焦点保留到用户开始输入，避免同一次操作里的第二次重绘把焦点移走。 */
    if(f.focus){const el=document.getElementById(f.focus);if(el){el.focus({preventScroll:true});return;}}
    const note=host.querySelector('.ea-form > .ea-notice:last-child, .ea-form > .ea-notice:first-child');
    if(note&&(f.duplicate||f.problem)){note.tabIndex=-1;note.focus({preventScroll:true});if(body)note.scrollIntoView({block:'nearest'});return;}
    if(heading)heading.focus({preventScroll:true});
  }

  /* ------------------------------------------------------------------ 动作 */
  function openForm(kind,mode,id){
    const a=id?EA.byId(id):null;
    V.flow={kind,mode,id:id||'',step:kind==='crypto'&&mode==='new'?1:0,
      form:a?fromAccount(a):kind==='fiat'?blankFiat():{chain:EA.CHAIN,label:'',address:''},
      errors:{},dirty:false,duplicate:'',problem:'',focus:mode==='edit'?'ea-f-label':'',sameName:false};
    V.problem='';CF.openLayer('modal','ea-form');
  }
  const dirty=()=>{const f=F();return !!f&&(f.dirty||f.kind==='crypto'&&f.mode==='new'&&!!(f.form.address||f.form.label));};
  function closeForm(){
    if(dirty()){V.pending=S.layer;CF.openLayer('modal','ea-discard',null,V.pending);return;}
    V.flow=null;CF.closeLayer();
  }
  function goBack(){
    const back=V.returnTo,kind=V.returnKind,biz=V.returnBiz;
    V.returnTo='';V.returnKind='';V.returnBiz='';
    location.hash='#'+back;
    setTimeout(()=>{if(kind==='quote')CF.CQ?.resumeSelection?.(biz);else if(kind==='repay')CF.L8?.resumeAccounts?.(biz);},40);
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
      case 'add':if(v==='fiat'&&!EA.companyName()){V.flow=null;CF.openLayer('modal','ea-noname');break;}openForm(v,'new');break;
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
      case 'back':{const f=F();f.step=1;f.problem='';f.errors={};f.duplicate='';f.focus='ea-f-address';break;}
      case 'next':{const f=F();if(validateAddress()){f.errors={};f.step=2;f.focus='';}break;}
      case 'save':{const f=F();
        if(f.kind==='crypto'){if(!val('label').trim()||EA.tooLong('label',val('label'))){f.errors={label:val('label').trim()?TOO_LONG('label'):REQUIRED()};break;}
          f.errors={};later(()=>{EA.update(f.id,{label:val('label').trim()});V.flow=null;CF.closeLayer();CF.toast(L('Changes saved.','修改已保存。'));});break;}
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
  const setSlot=(id,text,invalid)=>{const slot=document.getElementById(id+'-err');if(slot)slot.textContent=text||'';
    const el=document.getElementById(id);if(el){if(invalid)el.setAttribute('aria-invalid','true');else el.removeAttribute('aria-invalid');}};
  document.addEventListener('input',e=>{
    const el=e.target,k=el.dataset.eaField;if(!k||!F())return;
    F().form[k]=el.value;F().dirty=true;F().focus='';
    if(F().errors[k]){delete F().errors[k];setSlot(el.id,'',false);}
    if(F().problem){F().problem='';document.querySelector('.ea-form .note.red')?.closest('.ea-notice')?.remove();}
  });
  /* change 在失焦时才到，整体重绘会吞掉紧接着的那一次点击；这里只更新取值与就地提示。 */
  document.addEventListener('change',e=>{
    const el=e.target,f=F();
    if(el.dataset.eaField&&f){const k=el.dataset.eaField;
      if(k==='swift')el.value=EA.compact(el.value);
      f.form[k]=el.value;f.dirty=true;
      if(k==='label'){f.sameName=EA.sameName(owner(),el.value,f.id);const slot=document.querySelector('[data-ea-namehint]');if(slot)slot.textContent=f.sameName?L(...NAME_HINT):'';}
      return;}
    if(el.dataset.eaType&&f){f.form.accountType=el.dataset.eaType;f.dirty=true;
      if(f.errors.accountType){delete f.errors.accountType;el.closest('fieldset').removeAttribute('aria-invalid');const s=document.getElementById('ea-f-accountType-err');if(s)s.textContent='';}return;}
    if(el.dataset.eaCcy&&f){const set=new Set(f.form.ccys||[]);el.checked?set.add(el.dataset.eaCcy):set.delete(el.dataset.eaCcy);
      f.form.ccys=EA.CURRENCIES.filter(c=>set.has(c));f.dirty=true;
      if(f.form.ccys.length&&f.errors.ccys){delete f.errors.ccys;el.closest('fieldset').removeAttribute('aria-invalid');const s=document.getElementById('ea-f-ccys-err');if(s)s.textContent='';}
      return;}
    if(el.id==='ea-save-result'){V.saveResult=el.value;return;}
    if(el.id==='ea-name-state'){EA.setNameUnavailable(el.value==='missing');CF.render();return;}
  });
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
    if(V.busy){e.preventDefault();e.stopImmediatePropagation();return;}
    if(!guardClose())return;
    e.preventDefault();e.stopImmediatePropagation();CF.render();
  });
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape'||!S.layer||!String(S.layer.key).startsWith('ea-'))return;
    if(V.busy){e.preventDefault();e.stopImmediatePropagation();return;}
    if(!guardClose())return;
    e.preventDefault();e.stopImmediatePropagation();CF.render();
  });
  /* 离开本页即丢弃未提交内容：本模块不设草稿。 */
  window.addEventListener('hashchange',()=>{
    hideCurrencyTip();
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
    scenarios:()=>['asset','fund'].includes(S.role)?KINDS.map(k=>({id:k,label:k==='fiat'?['Bank accounts','法币账户']:['Crypto accounts','数币账户'],route:ROUTE+'?type='+k,description:['Open the existing account category','定位已有账户分类']})):[],
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
      select('ea-name-state',L('Company name','企业名称'),[['ok','Available','可取得'],['missing','Unavailable','取不到']],EA.companyName()?'ok':'missing')+
      '<div class="seg">'+b('demo','Simulate a company name change','模拟企业名称变更','rename')+b('demo','Reset demonstration accounts','重置演示账户','reseed')+'</div></section>';
  }
  function demoAction(v){
    if(v==='rename'){const o=owner(),cur=EA.companyName(o)||[o,o];
      EA.renameCompany(o,cur[0].endsWith(' Holdings')?[cur[0].replace(/ Holdings$/,''),cur[1].replace(/控股$/,'')]:[cur[0]+' Holdings',cur[1]+'控股']);
      CF.toast(L('Company name changed. Fiat accounts now show the new name.','企业名称已变更，法币账户已显示新名称。'));return;}
    if(v==='reseed'){EA.reseed();V.flow=null;V.scene='ready';S.layer=null;S.demo=false;CF.toast(L('Demonstration accounts restored.','演示账户已恢复。'));}
  }
  const host=CF.LSView,priorDemo=host&&host.demo;
  if(host)host.demo=function(){return (S.page===PAGE?tools():'')+(priorDemo?priorDemo.call(host):'');};

  CF.define(CF.EAView={id:'enterprise-accounts',pages:[PAGE],dict,layers,content(){return page();},onAct});
})(window.CF);
