/* 企业账户 · 本企业自己的法币账户与数币账户（面客端唯一一份目录与字段定义）。
   资产方与资金方同一套字段与维护规则；账户在业务里用来收放款还是收还款，由该业务决定，账户本身不带用途。
   报价、放款、还款与控制台都读这里，不再各自保管一份。
   本文件只做本地演示：不连钱包、不发请求、不校验账户真实性。 */
(function(CF){
  'use strict';
  const S=CF.S,L=CF.L,E=CF.esc,KEY='hc-ws386-v5';
  const EA=CF.EA={};
  const now=()=>CF.LS?CF.LS.now():Date.now();
  const DAY=86400000;

  /* 演示用的企业 / 机构当前名称：资产方取资产可信平台同步的企业名称，资金方取审核通过的机构名称。 */
  const NAMES={'entity-demo-a':['Demo Asset Company A','演示资产企业 A'],'entity-demo-b':['Demo Asset Company B','演示资产企业 B'],
    'fund-a':['Demo Capital A','演示资金机构 A'],'fund-b':['Demo Capital B','演示资金机构 B']};
  /* 演示目录：双方各有法币与数币账户，便于演示按币种的选用范围；数币账户当前都在以太坊网络。登记时间错开，列表顺序可见。 */
  function seed(){const t=n=>new Date(now()-n*DAY).toISOString();return [
    {id:'EA-DEMO-F01',owner:'entity-demo-a',kind:'fiat',accountType:'general',ccys:['USD','EUR'],label:['Singapore operating account','新加坡运营账户'],iban:'SG64DEMO0000000001',bank:'Demo Bank Limited',bankCity:'Singapore',swift:'DEMOSGSG',at:t(40)},
    {id:'EA-DEMO-F02',owner:'entity-demo-a',kind:'fiat',ccys:['USD'],label:['Hong Kong account','香港账户'],iban:'HK00DEMO0000000002',bank:'Demo Bank (HK)',bankCity:'Hong Kong',swift:'DEMOHKHH',at:t(12)},
    {id:'EA-DEMO-F04',owner:'entity-demo-a',kind:'fiat',accountType:'supervised',ccys:['USD','GBP'],label:['London supervised account','伦敦监管账户'],iban:'GB00DEMO0000000004',bank:'Demo Bank (UK)',bankCity:'London',swift:'DEMOGB2L',at:t(5)},
    {id:'EA-DEMO-C01',owner:'entity-demo-a',kind:'crypto',chain:'ETH',label:['Treasury wallet','资金钱包'],address:'0x00000000000000000000000000000000000000a1',at:t(30)},
    {id:'EA-DEMO-C02',owner:'entity-demo-a',kind:'crypto',chain:'ETH',label:['Collection wallet','收款钱包'],address:'0x00000000000000000000000000000000000000a2',at:t(9)},
    {id:'EA-DEMO-F03',owner:'entity-demo-b',kind:'fiat',accountType:'general',ccys:['USD'],label:['Main account','主账户'],iban:'SG64DEMO0000000003',bank:'Demo Bank Limited',bankCity:'Singapore',swift:'DEMOSGSG',at:t(50)},
    {id:'EA-DEMO-R01',owner:'fund-a',kind:'fiat',accountType:'general',ccys:['USD','EUR'],label:['Singapore account','新加坡账户'],iban:'SG64DEMO0000001001',bank:'Demo Capital Bank',bankCity:'Singapore',swift:'DEMOCPSG',at:t(60)},
    {id:'EA-DEMO-R02',owner:'fund-a',kind:'fiat',accountType:'supervised',ccys:['USD','GBP','EUR'],label:['London account','伦敦账户'],iban:'GB00DEMO0000001002',bank:'Demo Capital Bank (UK)',bankCity:'London',swift:'DEMOCPGB',at:t(20)},
    {id:'EA-DEMO-R03',owner:'fund-a',kind:'crypto',chain:'ETH',label:['Operations wallet','运营钱包'],address:'0x00000000000000000000000000000000000000b1',at:t(45)},
    {id:'EA-DEMO-R04',owner:'fund-a',kind:'crypto',chain:'ETH',label:['Repayment wallet','还款钱包'],address:'0x00000000000000000000000000000000000000b2',at:t(15)},
    {id:'EA-DEMO-R05',owner:'fund-b',kind:'fiat',accountType:'general',ccys:['USD'],label:['Main account','主账户'],iban:'HK00DEMO0000001003',bank:'Demo Capital Bank (HK)',bankCity:'Hong Kong',swift:'DEMOCPHK',at:t(35)},
    {id:'EA-DEMO-R06',owner:'fund-b',kind:'crypto',chain:'ETH',label:['Main wallet','主钱包'],address:'0x00000000000000000000000000000000000000b3',at:t(25)}
  ].map(a=>a.kind==='fiat'?Object.assign(a,{holder:NAMES[a.owner]}):a);}

  let db;
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(db));}catch(_){}};
  function reset(){db={accounts:seed(),serial:0,names:JSON.parse(JSON.stringify(NAMES)),nameUnavailable:false};save();}
  try{db=CF.LSReseeded?null:JSON.parse(localStorage.getItem(KEY));if(!Array.isArray(db?.accounts))reset();}catch(_){reset();}
  try{['hc-ws386-v1','hc-ws386-v2','hc-ws386-v3','hc-ws386-v4'].forEach(k=>localStorage.removeItem(k));}catch(_){}   /* 旧目录字段已变，丢弃 */

  /* 本期一个企业只有一个账号，该账号即唯一维护人；演示身份对应演示企业。 */
  EA.owner=()=>S.role==='fund'?'fund-a':'entity-demo-a';
  /* 模块与数据口径统一叫“企业账户”；面客展示名按侧区分：资产方“企业账户”、资金方“机构账户”。 */
  EA.title=()=>S.role==='fund'?['Institution accounts','机构账户']:['Company accounts','企业账户'];
  /* 结算收款链当前仅以太坊，用户不选择；数据里保留链代码供业务按链匹配，界面一律展示网络全名，不展示 ETH 缩写，避免与 ETH 币混淆。 */
  EA.CHAINS=['ETH'];
  EA.CHAIN='ETH';
  const CHAIN_NAMES={ETH:['Ethereum','以太坊']};
  EA.chainName=c=>CHAIN_NAMES[c]?L(...CHAIN_NAMES[c]):String(c||'');
  EA.TOKENS=['USDT','USDC'];
  /* 账户币种只作标注：本期可选 USD、EUR、GBP（由平台维护、可调整），平台不核验，业务选用也不据此筛选。
     清单调整后，已登记账户原有的标注保持不变。 */
  EA.CURRENCIES=['USD','EUR','GBP'];
  /* 账户类型只作标注，不带额外限制或材料。 */
  EA.ACCOUNT_TYPES=[{id:'general',label:['General account','一般账户']},{id:'supervised',label:['Supervised account','监管账户']}];
  EA.typeName=a=>{const t=EA.ACCOUNT_TYPES.find(x=>x.id===(a&&a.accountType||a));return t?L(...t.label):'';};
  /* 账户名称由平台按本企业当前名称带出，本人不能修改；取不到时不能新增法币账户。 */
  EA.companyName=owner=>db.nameUnavailable?null:(db.names&&db.names[owner||EA.owner()])||null;
  EA.holderName=a=>Array.isArray(a.holder)?E(L(...a.holder)):E(a.holder||'');
  EA.setNameUnavailable=on=>{db.nameUnavailable=!!on;save();};
  /* 企业名称变更：本企业所有法币账户的账户名称随之更新；已提交业务记录的快照保留旧名称。 */
  EA.renameCompany=(owner,name)=>{db.names[owner]=name;db.accounts.filter(a=>a.owner===owner&&a.kind==='fiat').forEach(a=>{a.holder=name;});save();};
  const ccyNames={};
  EA.currencyName=c=>{const lang=S.lang==='zh'?'zh-CN':'en',key=lang+c;if(ccyNames[key])return ccyNames[key];
    try{return ccyNames[key]=new Intl.DisplayNames([lang],{type:'currency'}).of(c);}catch(_){return c;}};
  EA.currencies=a=>Array.isArray(a.ccys)&&a.ccys.length?EA.CURRENCIES.filter(c=>a.ccys.includes(c)).concat(a.ccys.filter(c=>!EA.CURRENCIES.includes(c))):(a.ccy?[a.ccy]:[]);
  EA.currencyText=a=>E(EA.currencies(a).join(' · '))||'—';

  /* 列表按登记时间排列，最近登记的在前；本模块不设默认账户。 */
  const order=(a,b)=>String(b.at).localeCompare(String(a.at))||a.id.localeCompare(b.id);
  EA.all=owner=>db.accounts.filter(a=>a.owner===owner).slice().sort(order);
  EA.accounts=(owner,kind)=>db.accounts.filter(a=>a.owner===owner&&a.kind===kind).slice().sort(order);
  EA.byId=id=>db.accounts.find(a=>a.id===id)||null;

  /* —— 字段名取自字段命名与术语对照表；本模块登记的是本企业自己的账户，无收款人名称 —— */
  EA.labels={label:['Account nickname','账户备注名'],ccy:['Account currencies','账户币种'],
    accountType:['Account type','账户类型'],holder:['Account name','账户名称'],
    iban:['Account number / IBAN','账号 / IBAN'],bank:['Bank name','开户行名称'],
    bankCity:['Bank city','开户行地址'],swift:['SWIFT / BIC','SWIFT / BIC'],
    chain:['Network','结算收款链'],address:['Wallet address','数币地址'],tokens:['Supported tokens','适用代币'],
    ownership:['Address ownership','地址所有权'],at:['Added','登记时间']};

  EA.labels.ccys=EA.labels.ccy;
  const FIAT_REQUIRED=['accountType','label','ccys','iban','bank','bankCity','swift'];
  EA.fiatRequired=FIAT_REQUIRED;

  EA.name=a=>Array.isArray(a.label)?E(L(...a.label)):E(a.label||'');
  EA.plainName=a=>Array.isArray(a.label)?L(...a.label):String(a.label||'');
  EA.maskTail=v=>{const s=String(v||'');return s.length<=4?E(s):'•••• '+E(s.slice(-4));};
  EA.maskAddress=v=>{const s=String(v||'');return s.length<=14?E(s):E(s.slice(0,6))+'…'+E(s.slice(-4));};
  EA.missing=a=>a.kind==='crypto'?(a.address?[]:['address']):FIAT_REQUIRED.filter(k=>k==='ccys'?!EA.currencies(a).length:!String(a[k]||'').trim());

  /* —— 规范化与展示：代码类取值去空格转大写；IBAN 按银行惯例每 4 位分组展示 —— */
  EA.compact=v=>String(v||'').replace(/\s+/g,'').toUpperCase();
  EA.groupIban=v=>{const s=EA.compact(v);return /^[A-Z]{2}\d{2}/.test(s)?s.replace(/(.{4})(?=.)/g,'$1 '):s;};
  EA.tokens=()=>EA.TOKENS.join(' · ');

  /* 已提交的业务记录保存的是账户快照，随记录固定；本模块之后的修改与删除不回改快照。 */
  EA.snapshot=a=>JSON.parse(JSON.stringify(a));
  EA.key=a=>a.kind==='crypto'?E(EA.chainName(a.chain))+' · <span class="mono">'+EA.maskAddress(a.address)+'</span>'
    :[EA.holderName(a),E(EA.typeName(a)),E(a.bank)+' · <span class="mono">'+EA.maskTail(EA.compact(a.iban))+'</span>',EA.currencies(a).length?EA.currencyText(a):''].filter(Boolean).join(' · ');

  /* 业务侧读取的字段行（报价、放款、还款、控制台共用）；full=false 为脱敏摘要。 */
  EA.rows=function(a,full=true){
    if(a.kind==='crypto')return [[L(...EA.labels.chain),E(EA.chainName(a.chain))],
      [L(...EA.labels.address),'<span class="mono">'+(full?E(a.address):EA.maskAddress(a.address))+'</span>'],
      [L(...EA.labels.tokens),EA.tokens()]];
    const rows=[[L(...EA.labels.label),EA.name(a)],[L(...EA.labels.holder),EA.holderName(a)||'—'],[L(...EA.labels.accountType),E(EA.typeName(a))||'—'],
      [L(...EA.labels.iban),'<span class="mono">'+(full?E(EA.groupIban(a.iban)):EA.maskTail(EA.compact(a.iban)))+'</span>'],
      [L(...EA.labels.bank),E(a.bank)],[L(...EA.labels.ccy),EA.currencyText(a)]];
    if(full)rows.push([L(...EA.labels.bankCity),E(a.bankCity||'')||'—'],[L(...EA.labels.swift),E(a.swift)||'—']);
    return rows;
  };

  /* —— 校验 —— */
  EA.swiftValid=v=>/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(EA.compact(v));
  /* 以太坊地址：0x 加 40 位十六进制字符；其他网络格式的地址一律不通过。 */
  EA.addressValid=v=>/^0x[0-9a-fA-F]{40}$/.test(String(v||'').trim());
  EA.duplicateFiat=(owner,iban,swift,exceptId)=>EA.accounts(owner,'fiat').find(a=>a.id!==exceptId&&
    EA.compact(a.iban)===EA.compact(iban)&&EA.compact(a.swift)===EA.compact(swift))||null;
  /* 以太坊地址查重不区分大小写。 */
  const sameAddress=(x,y)=>String(x||'').trim().toLowerCase()===String(y||'').trim().toLowerCase();
  EA.duplicateCrypto=(owner,address)=>EA.accounts(owner,'crypto').find(a=>sameAddress(a.address,address))||null;
  /* 由用户自由填写的文本字段暂定最多 100 个字符（按字符计）；账号 / IBAN 去除空格后计数。地址类字段不限长度与字符种类。 */
  EA.TEXT_MAX=100;
  EA.textLength=(k,v)=>[...(k==='iban'?EA.compact(v):String(v||'').trim())].length;
  EA.tooLong=(k,v)=>EA.textLength(k,v)>EA.TEXT_MAX;
  /* 备注名在本企业内不要求唯一，重名只提示可能混淆，不阻断。 */
  EA.sameName=(owner,name,exceptId)=>{const n=String(name||'').trim().toLowerCase();
    return !!n&&EA.all(owner).some(a=>a.id!==exceptId&&EA.plainName(a).trim().toLowerCase()===n);};

  /* —— 维护动作：校验通过即生效，不进审核、不产生待办、不发通知 —— */
  EA.add=function(draft){
    const a=Object.assign({id:'EA-'+(draft.kind==='crypto'?'C':'F')+String(++db.serial+100),owner:EA.owner(),at:new Date(now()).toISOString()},draft);
    db.accounts.push(a);save();return a;
  };
  EA.update=function(id,patch){const a=EA.byId(id);if(!a)return null;Object.assign(a,patch,{updated:new Date(now()).toISOString()});save();return a;};
  EA.remove=function(id){const i=db.accounts.findIndex(a=>a.id===id);if(i<0)return false;db.accounts.splice(i,1);save();return true;};
  /* 评审工具用：恢复演示目录，不影响其他模块的业务记录。 */
  EA.reseed=()=>{reset();};
})(window.CF=window.CF||{});
