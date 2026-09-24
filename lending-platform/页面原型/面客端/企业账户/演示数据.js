/* 企业账户 · 本企业收款账户目录（面客端唯一来源）。
   资产方收放款账户与资金方还款收款账户是同一套字段与维护规则，用途由使用它的业务决定。
   报价、放款、还款与控制台都从这里读取，不再各自保管一份账户目录。
   本文件只做本地演示：不连钱包、不发请求、不校验账户真实性。 */
(function(CF){
  'use strict';
  const S=CF.S,L=CF.L,E=CF.esc,KEY='hc-ws386-v1';
  const EA=CF.EA={};
  const iso=()=>CF.LS?CF.LS.iso():new Date().toISOString();

  /* 演示账户目录：双方各有法币与数币账户，便于演示按币种与按链的选用范围。 */
  function seed(){const at=iso();return [
    {id:'EA-DEMO-F01',owner:'entity-demo-a',kind:'fiat',ccy:'USD',label:['Singapore operating account','新加坡收款账户'],addressCountry:'SG',addressCity:'Singapore',addressLine:'18 Example Avenue, #08-01',iban:'SG64DEMO0000000001',bank:'Demo Bank Limited',bankCity:'Singapore',bankCountry:'SG',swift:'DEMOSGSG',primary:true,at},
    {id:'EA-DEMO-F02',owner:'entity-demo-a',kind:'fiat',ccy:'USD',label:['Hong Kong collection account','香港收款账户'],addressCountry:'HK',addressCity:'Hong Kong',addressLine:'8 Example Road, Central',iban:'HK00DEMO0000000002',bank:'Demo Bank (HK)',bankCity:'Hong Kong',bankCountry:'HK',swift:'',at},
    {id:'EA-DEMO-C01',owner:'entity-demo-a',kind:'crypto',chain:'ETH',label:['ETH receiving address','ETH 收款地址'],address:'0x00000000000000000000000000000000000000a1',primary:true,at},
    {id:'EA-DEMO-C02',owner:'entity-demo-a',kind:'crypto',chain:'TRON',label:['TRON receiving address','TRON 收款地址'],address:'TDemoReceiveAddressAssetAAAAAAAAAA',at},
    {id:'EA-DEMO-F03',owner:'entity-demo-b',kind:'fiat',ccy:'USD',label:['Main receiving account','主收款账户'],addressCountry:'SG',addressCity:'Singapore',addressLine:'20 Example Avenue',iban:'SG64DEMO0000000003',bank:'Demo Bank Limited',bankCity:'Singapore',bankCountry:'SG',swift:'DEMOSGSG',primary:true,at},
    {id:'EA-DEMO-R01',owner:'fund-a',kind:'fiat',ccy:'USD',label:['Singapore repayment account','新加坡还款收款账户'],addressCountry:'SG',addressCity:'Singapore',addressLine:'1 Example Quay, #20-05',iban:'SG64DEMO0000001001',bank:'Demo Capital Bank',bankCity:'Singapore',bankCountry:'SG',swift:'DEMOCPSG',primary:true,at},
    {id:'EA-DEMO-R02',owner:'fund-a',kind:'fiat',ccy:'USD',label:['London repayment account','伦敦还款收款账户'],addressCountry:'GB',addressCity:'London',addressLine:'12 Example Street',iban:'GB00DEMO0000001002',bank:'Demo Capital Bank (UK)',bankCity:'London',bankCountry:'GB',swift:'',at},
    {id:'EA-DEMO-R03',owner:'fund-a',kind:'crypto',chain:'ETH',label:['ETH repayment address','ETH 还款收款地址'],address:'0x00000000000000000000000000000000000000b1',primary:true,at},
    {id:'EA-DEMO-R04',owner:'fund-a',kind:'crypto',chain:'TRON',label:['TRON repayment address','TRON 还款收款地址'],address:'TDemoReceiveAddressFunderAAAAAAAAA',at},
    {id:'EA-DEMO-R05',owner:'fund-b',kind:'fiat',ccy:'USD',label:['Main repayment account','主还款收款账户'],addressCountry:'HK',addressCity:'Hong Kong',addressLine:'9 Example Road, Central',iban:'HK00DEMO0000001003',bank:'Demo Capital Bank (HK)',bankCity:'Hong Kong',bankCountry:'HK',swift:'DEMOCPHK',primary:true,at},
    {id:'EA-DEMO-R06',owner:'fund-b',kind:'crypto',chain:'ETH',label:['ETH repayment address','ETH 还款收款地址'],address:'0x00000000000000000000000000000000000000b3',primary:true,at}
  ];}

  let db;
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(db));}catch(_){}};
  function reset(){db={accounts:seed(),serial:0};save();}
  try{db=CF.LSReseeded?null:JSON.parse(localStorage.getItem(KEY));if(!Array.isArray(db?.accounts))reset();}catch(_){reset();}

  /* 本期一个企业只有一个账号，该账号即唯一维护人；演示身份对应演示企业。 */
  EA.owner=()=>S.role==='fund'?'fund-a':'entity-demo-a';
  EA.CHAINS=['ETH','TRON'];
  EA.TOKENS='USDT / USDC';
  EA.CURRENCY='USD';
  EA.REGIONS=['SG','HK','GB','US','JP','DE','AE','AU','CN','KR','MY','NL','CH'];

  const chainRank=a=>a.kind==='crypto'?EA.CHAINS.indexOf(a.chain):0;
  const order=(a,b)=>chainRank(a)-chainRank(b)||(b.primary?1:0)-(a.primary?1:0)||String(a.at).localeCompare(String(b.at))||a.id.localeCompare(b.id);

  EA.all=owner=>db.accounts.filter(a=>a.owner===owner).slice().sort(order);
  EA.accounts=(owner,kind)=>db.accounts.filter(a=>a.owner===owner&&a.kind===kind).slice().sort(order);
  EA.byId=id=>db.accounts.find(a=>a.id===id)||null;

  /* —— 字段表述统一取自字段命名与术语对照表；法币与数币均无收款人名称 —— */
  EA.labels={label:['Account name','账户备注名'],ccy:['Account currency','账户币种'],
    addressCountry:['Beneficiary country / region','收款人国家 / 地区'],addressCity:['Beneficiary city','收款人城市'],addressLine:['Beneficiary street address','收款人详细地址'],
    iban:['Account number / IBAN','账号 / IBAN'],bank:['Beneficiary bank','收款行名称'],bankCity:['Bank city','收款行城市'],bankCountry:['Bank country / region','收款行国家 / 地区'],swift:['SWIFT / BIC','SWIFT / BIC'],
    interSwift:['Intermediary SWIFT','中转行 SWIFT'],interName:['Intermediary bank','中转行名称'],interAccount:['Account at intermediary','在中转行账号'],
    chain:['Settlement chain','结算收款链'],address:['Receiving address','收款地址'],tokens:['Tokens accepted','可接收代币'],at:['Registered at','登记时间']};

  const FIAT_REQUIRED=['label','addressCountry','addressCity','addressLine','iban','bank','bankCity','bankCountry','swift'];
  EA.fiatRequired=FIAT_REQUIRED;

  EA.name=a=>Array.isArray(a.label)?E(L(...a.label)):E(a.label||'');
  EA.region=code=>{if(!code)return '—';try{return E(new Intl.DisplayNames([S.lang==='zh'?'zh-CN':'en'],{type:'region'}).of(code));}catch(_){return E(code);}};
  EA.maskTail=v=>{const s=String(v||'');return s.length<=4?E(s):'•••• '+E(s.slice(-4));};
  EA.maskAddress=v=>{const s=String(v||'');return s.length<=14?E(s):E(s.slice(0,6))+'…'+E(s.slice(-4));};
  EA.missing=a=>a.kind==='crypto'?(a.address?[]:['address']):FIAT_REQUIRED.filter(k=>!String(a[k]||'').trim());
  /* 已提交的业务记录保存的是账户快照，随记录固定；本模块之后的修改与删除不回改快照。 */
  EA.snapshot=a=>({...a,country:a.bankCountry});
  EA.key=a=>a.kind==='crypto'?E(a.chain)+' · <span class="mono">'+EA.maskAddress(a.address)+'</span>'
    :E(a.bank)+' · <span class="mono">'+EA.maskTail(a.iban)+'</span>';

  EA.rows=function(a,full=true){
    if(a.kind==='crypto')return [[L(...EA.labels.chain),E(a.chain)],
      [L(...EA.labels.address),'<span class="mono">'+(full?E(a.address):EA.maskAddress(a.address))+'</span>'],
      [L('Tokens accepted','可接收代币'),EA.TOKENS]];
    const rows=[[L(...EA.labels.label),EA.name(a)],
      [L(...EA.labels.iban),'<span class="mono">'+(full?E(a.iban):EA.maskTail(a.iban))+'</span>'],
      [L(...EA.labels.bank),E(a.bank)]];
    if(full)rows.push([L(...EA.labels.addressCountry),EA.region(a.addressCountry)],[L(...EA.labels.addressCity),E(a.addressCity)],
      [L(...EA.labels.addressLine),E(a.addressLine)],[L(...EA.labels.bankCity),E(a.bankCity)],
      [L(...EA.labels.bankCountry),EA.region(a.bankCountry)],[L(...EA.labels.swift),E(a.swift)||'—'],
      [L('Intermediary bank','中转行信息'),a.interSwift?E([a.interSwift,a.interName,a.interAccount].filter(Boolean).join(' · ')):L('Not provided','未填写')]);
    return rows;
  };

  /* —— 校验 —— */
  EA.swiftValid=v=>/^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$/.test(String(v||'').trim());
  EA.swiftCountry=v=>String(v||'').trim().slice(4,6).toUpperCase();
  EA.addressValid=(chain,v)=>{const s=String(v||'').trim();
    return chain==='ETH'?/^0x[0-9a-fA-F]{40}$/.test(s):chain==='TRON'?/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(s):false;};
  EA.duplicateFiat=(owner,iban,swift,exceptId)=>EA.accounts(owner,'fiat').find(a=>a.id!==exceptId&&
    String(a.iban||'').trim().toUpperCase()===String(iban||'').trim().toUpperCase()&&
    String(a.swift||'').trim().toUpperCase()===String(swift||'').trim().toUpperCase())||null;
  EA.duplicateCrypto=(owner,chain,address)=>EA.accounts(owner,'crypto').find(a=>a.chain===chain&&
    String(a.address||'').trim().toLowerCase()===String(address||'').trim().toLowerCase())||null;

  /* —— 维护动作：校验通过即生效，不进审核、不产生待办 —— */
  const defaultScope=a=>a.kind==='crypto'?(b=>b.kind==='crypto'&&b.chain===a.chain):(b=>b.kind==='fiat');
  function clearPeers(a){db.accounts.filter(b=>b.owner===a.owner&&b.id!==a.id&&defaultScope(a)(b)).forEach(b=>{delete b.primary;});}

  EA.add=function(draft){
    const a=Object.assign({id:'EA-'+(draft.kind==='crypto'?'C':'F')+String(++db.serial+100),owner:EA.owner(),at:iso()},draft);
    if(a.primary)clearPeers(a);
    db.accounts.push(a);save();return a;
  };
  EA.update=function(id,patch){
    const a=EA.byId(id);if(!a)return null;
    Object.assign(a,patch);save();return a;
  };
  EA.remove=function(id){
    const i=db.accounts.findIndex(a=>a.id===id);if(i<0)return false;
    db.accounts.splice(i,1);save();return true;   /* 删除只影响以后能否选用，不改写已提交业务记录 */
  };
  EA.setDefault=function(id,on){
    const a=EA.byId(id);if(!a)return null;
    if(on){clearPeers(a);a.primary=true;}else delete a.primary;
    save();return a;
  };
  /* 评审工具用：恢复演示目录，不影响其他模块的业务记录。 */
  EA.reseed=()=>{reset();};
})(window.CF=window.CF||{});
