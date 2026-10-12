/* 企业账户 · 本企业自己的法币账户与数币账户（面客端唯一一份目录与字段定义）。
   资产方与资金方同一套字段与维护规则；账户在业务里用来收放款还是收还款，由该业务决定，账户本身不带用途。
   报价、放款、还款与控制台都读这里，不再各自保管一份。
   本文件只做本地演示：不连钱包、不发请求、不校验账户真实性。 */
(function(CF){
  'use strict';
  const S=CF.S,L=CF.L,E=CF.esc,KEY='hc-ws386-v3';
  const EA=CF.EA={};
  const now=()=>CF.LS?CF.LS.now():Date.now();
  const DAY=86400000;

  /* 演示目录：双方各有法币与数币账户，便于演示按币种与按链的选用范围。登记时间错开，列表顺序可见。 */
  function seed(){const t=n=>new Date(now()-n*DAY).toISOString();return [
    {id:'EA-DEMO-F01',owner:'entity-demo-a',kind:'fiat',ccys:['USD','SGD'],label:['Singapore operating account','新加坡运营账户'],addressCountry:'SG',addressCity:'Singapore',addressLine:'18 Example Avenue, #08-01',iban:'SG64DEMO0000000001',bank:'Demo Bank Limited',bankCity:'Singapore',bankCountry:'SG',swift:'DEMOSGSG',at:t(40)},
    {id:'EA-DEMO-F02',owner:'entity-demo-a',kind:'fiat',ccys:['USD','HKD'],label:['Hong Kong account','香港账户'],addressCountry:'HK',addressCity:'Hong Kong',addressLine:'8 Example Road, Central',iban:'HK00DEMO0000000002',bank:'Demo Bank (HK)',bankCity:'Hong Kong',bankCountry:'HK',swift:'',at:t(12)},
    {id:'EA-DEMO-C01',owner:'entity-demo-a',kind:'crypto',chain:'ETH',label:['Treasury wallet (ETH)','资金钱包（ETH）'],address:'0x00000000000000000000000000000000000000a1',at:t(30)},
    {id:'EA-DEMO-C02',owner:'entity-demo-a',kind:'crypto',chain:'TRON',label:['Treasury wallet (TRON)','资金钱包（TRON）'],address:'TDemoReceiveAddressAssetAAAAAAAAAA',at:t(9)},
    {id:'EA-DEMO-F03',owner:'entity-demo-b',kind:'fiat',ccys:['USD'],label:['Main account','主账户'],addressCountry:'SG',addressCity:'Singapore',addressLine:'20 Example Avenue',iban:'SG64DEMO0000000003',bank:'Demo Bank Limited',bankCity:'Singapore',bankCountry:'SG',swift:'DEMOSGSG',at:t(50)},
    {id:'EA-DEMO-R01',owner:'fund-a',kind:'fiat',ccys:['USD','SGD','EUR'],label:['Singapore account','新加坡账户'],addressCountry:'SG',addressCity:'Singapore',addressLine:'1 Example Quay, #20-05',iban:'SG64DEMO0000001001',bank:'Demo Capital Bank',bankCity:'Singapore',bankCountry:'SG',swift:'DEMOCPSG',at:t(60)},
    {id:'EA-DEMO-R02',owner:'fund-a',kind:'fiat',ccys:['USD','GBP','EUR'],label:['London account','伦敦账户'],addressCountry:'GB',addressCity:'London',addressLine:'12 Example Street',iban:'GB00DEMO0000001002',bank:'Demo Capital Bank (UK)',bankCity:'London',bankCountry:'GB',swift:'',at:t(20)},
    {id:'EA-DEMO-R03',owner:'fund-a',kind:'crypto',chain:'ETH',label:['Operations wallet (ETH)','运营钱包（ETH）'],address:'0x00000000000000000000000000000000000000b1',at:t(45)},
    {id:'EA-DEMO-R04',owner:'fund-a',kind:'crypto',chain:'TRON',label:['Operations wallet (TRON)','运营钱包（TRON）'],address:'TDemoReceiveAddressFunderAAAAAAAAA',at:t(15)},
    {id:'EA-DEMO-R05',owner:'fund-b',kind:'fiat',ccys:['USD','HKD'],label:['Main account','主账户'],addressCountry:'HK',addressCity:'Hong Kong',addressLine:'9 Example Road, Central',iban:'HK00DEMO0000001003',bank:'Demo Capital Bank (HK)',bankCity:'Hong Kong',bankCountry:'HK',swift:'DEMOCPHK',at:t(35)},
    {id:'EA-DEMO-R06',owner:'fund-b',kind:'crypto',chain:'ETH',label:['Main wallet (ETH)','主钱包（ETH）'],address:'0x00000000000000000000000000000000000000b3',at:t(25)}
  ];}

  let db;
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(db));}catch(_){}};
  function reset(){db={accounts:seed(),serial:0};save();}
  try{db=CF.LSReseeded?null:JSON.parse(localStorage.getItem(KEY));if(!Array.isArray(db?.accounts))reset();}catch(_){reset();}
  try{['hc-ws386-v1','hc-ws386-v2'].forEach(k=>localStorage.removeItem(k));}catch(_){}   /* 旧目录带默认标记或中转行，丢弃 */

  /* 本期一个企业只有一个账号，该账号即唯一维护人；演示身份对应演示企业。 */
  EA.owner=()=>S.role==='fund'?'fund-a':'entity-demo-a';
  /* 模块与数据口径统一叫“企业账户”；面客展示名按侧区分：资产方“企业账户”、资金方“机构账户”。 */
  EA.title=()=>S.role==='fund'?['Institution accounts','机构账户']:['Company accounts','企业账户'];
  EA.CHAINS=['ETH','TRON'];
  EA.TOKENS=['USDT','USDC'];
  /* 账户币种只作标注：选项为平台拟定的法币币种清单（由平台维护、可调整；此处为演示取值），
     平台不核验，业务选用也不据此过滤。 */
  EA.CURRENCIES=['USD','EUR','GBP','HKD','SGD','JPY','CNH','AUD','CAD','CHF','AED'];
  const ccyNames={};
  EA.currencyName=c=>{const lang=S.lang==='zh'?'zh-CN':'en',key=lang+c;if(ccyNames[key])return ccyNames[key];
    try{return ccyNames[key]=new Intl.DisplayNames([lang],{type:'currency'}).of(c==='CNH'?'CNY':c)+(c==='CNH'?L(' (offshore)','（离岸）'):'');}catch(_){return c;}};
  EA.currencies=a=>Array.isArray(a.ccys)&&a.ccys.length?EA.CURRENCIES.filter(c=>a.ccys.includes(c)).concat(a.ccys.filter(c=>!EA.CURRENCIES.includes(c))):(a.ccy?[a.ccy]:[]);
  EA.currencyText=a=>E(EA.currencies(a).join(' · '))||'—';

  /* ISO 3166-1 alpha-2 全集；名称由浏览器按界面语言给出，按名称排序后供选择。 */
  EA.REGIONS=('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ '+
    'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR '+
    'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP '+
    'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ '+
    'NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW '+
    'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ '+
    'UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' ');
  const regionNames={};
  EA.regionName=code=>{if(!code)return '';const lang=S.lang==='zh'?'zh-CN':'en';
    const key=lang+code;if(regionNames[key])return regionNames[key];
    try{return regionNames[key]=new Intl.DisplayNames([lang],{type:'region'}).of(code)||code;}catch(_){return code;}};
  EA.regions=()=>EA.REGIONS.slice().sort((a,b)=>EA.regionName(a).localeCompare(EA.regionName(b),S.lang==='zh'?'zh-CN':'en'));
  EA.region=code=>code?E(EA.regionName(code)):'—';

  /* 列表按登记时间排列，最近登记的在前；本模块不设默认账户。 */
  const order=(a,b)=>String(b.at).localeCompare(String(a.at))||a.id.localeCompare(b.id);
  EA.all=owner=>db.accounts.filter(a=>a.owner===owner).slice().sort(order);
  EA.accounts=(owner,kind)=>db.accounts.filter(a=>a.owner===owner&&a.kind===kind).slice().sort(order);
  EA.byId=id=>db.accounts.find(a=>a.id===id)||null;

  /* —— 字段名取自字段命名与术语对照表；本模块登记的是本企业自己的账户，无收款人名称 —— */
  EA.labels={label:['Account nickname','账户备注名'],ccy:['Account currencies','账户币种'],
    holderAddress:['Account holder address','账户持有人地址'],
    addressCountry:['Country / region','国家 / 地区'],addressCity:['City','城市'],addressLine:['Street address','详细地址'],
    iban:['Account number / IBAN','账号 / IBAN'],bank:['Bank name','开户行名称'],
    bankAddress:['Bank address','开户行地址'],bankCity:['Bank city','开户行城市'],bankCountry:['Bank country / region','开户行国家 / 地区'],
    swift:['SWIFT / BIC','SWIFT / BIC'],
    chain:['Network','结算收款链'],address:['Wallet address','数币地址'],tokens:['Supported tokens','适用代币'],
    ownership:['Address ownership','地址所有权'],at:['Added','登记时间']};

  EA.labels.ccys=EA.labels.ccy;
  const FIAT_REQUIRED=['label','ccys','addressCountry','addressCity','addressLine','iban','bank','bankCity','bankCountry','swift'];
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
  EA.snapshot=a=>({...a,country:a.bankCountry});
  EA.key=a=>a.kind==='crypto'?E(a.chain)+' · <span class="mono">'+EA.maskAddress(a.address)+'</span>'
    :E(a.bank)+' · <span class="mono">'+EA.maskTail(EA.compact(a.iban))+'</span>'+(EA.currencies(a).length?' · '+EA.currencyText(a):'');

  /* 业务侧读取的字段行（报价、放款、还款、控制台共用）；full=false 为脱敏摘要。 */
  EA.rows=function(a,full=true){
    if(a.kind==='crypto')return [[L(...EA.labels.chain),E(a.chain)],
      [L(...EA.labels.address),'<span class="mono">'+(full?E(a.address):EA.maskAddress(a.address))+'</span>'],
      [L(...EA.labels.tokens),EA.tokens()]];
    const rows=[[L(...EA.labels.label),EA.name(a)],
      [L(...EA.labels.iban),'<span class="mono">'+(full?E(EA.groupIban(a.iban)):EA.maskTail(EA.compact(a.iban)))+'</span>'],
      [L(...EA.labels.bank),E(a.bank)],[L(...EA.labels.ccy),EA.currencyText(a)]];
    if(full)rows.push([L(...EA.labels.holderAddress),E([a.addressLine,a.addressCity].filter(Boolean).join(', '))+(a.addressCountry?', '+EA.region(a.addressCountry):'')],
      [L(...EA.labels.bankAddress),E(a.bankCity||'')+(a.bankCountry?', '+EA.region(a.bankCountry):'')],
      [L(...EA.labels.swift),E(a.swift)||'—']);
    return rows;
  };

  /* —— 校验 —— */
  EA.swiftValid=v=>/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(EA.compact(v));
  EA.swiftCountry=v=>EA.compact(v).slice(4,6);
  EA.addressValid=(chain,v)=>{const s=String(v||'').trim();
    return chain==='ETH'?/^0x[0-9a-fA-F]{40}$/.test(s):chain==='TRON'?/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(s):false;};
  EA.duplicateFiat=(owner,iban,swift,exceptId)=>EA.accounts(owner,'fiat').find(a=>a.id!==exceptId&&
    EA.compact(a.iban)===EA.compact(iban)&&EA.compact(a.swift)===EA.compact(swift))||null;
  EA.duplicateCrypto=(owner,chain,address)=>EA.accounts(owner,'crypto').find(a=>a.chain===chain&&
    String(a.address||'').trim().toLowerCase()===String(address||'').trim().toLowerCase())||null;
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
