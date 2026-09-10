/* Financial-service platform registrations; shared visual/runtime code is imported
 * read-only from asset-platform/prototypes/_shared. end denotes canvas shape,
 * not account or message-pool ownership (the operations message end is fs_ops).
 * Load this registry, not the asset platform registry, in this platform's files. */
(function(CF){
 CF.PAGES={}; CF.OWNER={}; CF.ENTRY={}; CF.EXTERNAL={};
 const pages={
  'P-O01':['Sign in','运营端登录','focus','/ops/login'],
  'P-O02':['Reset your initial password','首登强制重置密码','focus','/ops/first-reset'],
  'P-O03':['Reset password','忘记密码 · 验证工作邮箱','focus','/ops/forgot-password'],
  'P-O04':['Set a new password','设置新密码','focus','/ops/reset-password'],
  'P-O05':['Account settings','账户设置','app','/ops/account'],
  'P-O06':['Overview','总览','app','/ops/overview'],
  'P-O20':['Notifications','消息中心','app','/ops/messages'],
  'P-O21':['Notification details','消息详情','app','/ops/messages']
 };
 for(const [id,p] of Object.entries(pages)){
  CF.PAGES[id]={end:'admin',layout:p[2],name:p.slice(0,2)};
  CF.OWNER[id]=id==='P-O20'||id==='P-O21'?'fs-ops-notify':'fs-ops-login';
  CF.ENTRY[id]='#'+p[3];
 }
 Object.assign(CF.PAGES['P-O06'],{nav:'P-O06',navKey:'navOverview',ico:'▤'});
 CF.MODULES={
  'fs-ops-login':{dir:'账户与登录',file:'v1.0-账户与登录-原型.html',name:['Operations account','运营端账户与登录']}
 };
 // WS-309 pages belong to the delivered notifications module, not the account module.
 /* 菜单顺序按 WS-318 PRD V1.1 5.1：总览 / 资产清单 / 汇率管理 / 代币管理 / 协议管理。 */
 CF.NAV={admin:['P-O06','P-O-DS-01','P-O-FX-01',
   {navKey:'navTokenManagement',icoKey:'doc',children:['P-O-TC-01','P-O-TI-01']},
   'P-O-AG-01'],asset:[]};
 Object.assign(CF.PAGES,{
 'P-O-AG-01':{end:'admin',layout:'app',nav:'P-O-AG-01',navKey:'navAgreements',icoKey:'doc',name:['Agreements','协议管理']},
 'P-O-AG-02':{end:'admin',layout:'app',nav:'P-O-AG-01',name:['Agreement details','协议详情']},
 'P-O-AG-03':{end:'admin',layout:'app',nav:'P-O-AG-01',name:['Edit version','版本编辑']},
 'P-O-AG-04':{end:'admin',layout:'app',nav:'P-O-AG-01',name:['Version details','版本详情']}
 });
 CF.MODULES.agreements={dir:"协议管理",file:"v1.0-协议管理-原型.html",name:["Agreements","协议管理"]};
 ["P-O-AG-01","P-O-AG-02","P-O-AG-03","P-O-AG-04"].forEach(id=>CF.OWNER[id]="agreements");
 CF.ENTRY["P-O-AG-01"]="#/agreements";
 // Both global notification entrances resolve to the delivered WS-309 file.
 CF.MODULES["fs-ops-notify"]={dir:"消息通知",file:"v1.0-消息通知-原型.html",name:["Notifications","消息通知"]};
 CF.MODULES['smart-contracts']={dir:'代币合约',file:'v1.0-代币合约-原型.html',name:['Smart contracts','智能合约']};
 ['P-O-TC-01','P-O-TC-02'].forEach(function(id){
   CF.PAGES[id]={end:'admin',layout:'app',nav:'P-O-TC-01',navKey:'navSmartContracts',name:id==='P-O-TC-01'?['Smart contracts','智能合约']:['Contract details','合约详情']};
   CF.OWNER[id]='smart-contracts';
 });
 CF.ENTRY['P-O-TC-01']='#/ops/token-contracts';
 /* WS-318 资产清单与代币签发。三点说明：
    ① P-O-DS-01 / P-O-DS-02 的**定义方仍是 WS-313**（资产平台那份登记一个字不动）。
       这里只是把同两个页面登记进金融服务平台运营端画布 end:'admin'，让它们与总览、
       汇率管理、代币管理、协议管理同处一根侧栏——PRD 5.1 的菜单树要求如此。
       不要据此把它们当成 WS-318 新增的页面编号，也不要拿来和资产平台那份对账判成撞号。
    ② 本模块本期新增的页面编号恰好三个：P-O-TI-01 / P-O-FX-01 / P-O-FX-02（AC-TI-53）。
    ③ P-O-TI-01 与其下的 P-O-TI-02 都挂在代币管理菜单下、与 P-O-TC-01 平级，
       且都是只读视图（AC-TI-54 / AC-TI-58）。代币详情只在侧栏体现为代币清单的下级，
       不单独占一个侧栏条目——它的唯一入口是代币清单某行的「查看代币详情」。 */
 CF.MODULES['token-issuance']={dir:'资产清单与代币签发',file:'v1.0-资产清单与代币签发-原型.html',
   name:['Asset inventory & token issuance','资产清单与代币签发']};
 Object.assign(CF.PAGES,{
  'P-O-DS-01':{end:'admin',layout:'app',nav:'P-O-DS-01',navKey:'navAssetInventory',ico:'\u25a4',
    crumb:['Asset inventory','资产清单'],name:['Asset inventory','资产清单']},
  'P-O-DS-02':{end:'admin',layout:'app',nav:'P-O-DS-01',name:['Asset details','资产详情']},
  'P-O-FX-01':{end:'admin',layout:'app',nav:'P-O-FX-01',navKey:'navFxRates',ico:'\u2696',
    crumb:['FX rates','汇率管理'],name:['FX rates','汇率管理']},
  'P-O-FX-02':{end:'admin',layout:'app',nav:'P-O-FX-01',name:['FX rate history','汇率历史版本']},
  'P-O-TI-01':{end:'admin',layout:'app',nav:'P-O-TI-01',navKey:'navTokenList',
    crumb:['Token list','代币清单'],name:['Token list','代币清单']},
  'P-O-TI-02':{end:'admin',layout:'app',nav:'P-O-TI-01',name:['Token details','代币详情']}
 });
 ['P-O-DS-01','P-O-DS-02','P-O-FX-01','P-O-FX-02','P-O-TI-01','P-O-TI-02'].forEach(function(id){
   CF.OWNER[id]='token-issuance';
 });
 CF.ENTRY['P-O-DS-01']='#/ops/asset-inventory';
 CF.ENTRY['P-O-DS-02']='#/ops/asset-inventory';
 CF.ENTRY['P-O-FX-01']='#/ops/fx-rates';
 CF.ENTRY['P-O-FX-02']='#/ops/fx-rates/CNY/history';
 CF.ENTRY['P-O-TI-01']='#/ops/token-list';
 CF.ENTRY['P-O-TI-02']='#/ops/token-list';
 CF.MSG_PAGE={admin:'P-O20'};
})(window.CF=window.CF||{});
