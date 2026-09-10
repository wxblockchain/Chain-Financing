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

 /* WS-311 金融服务端登录（主干 + 资产方 SSO + 资金方账户体系）。三点说明：
    ① 本模块是**面客画布**，端别取 end:'asset'——按 docs/design-system/README.md，
       end 表达画布形态（控制台 / 面客）而不是平台或端；金融服务端归面客形态，
       密度由 base.css 的 [data-end="asset"] 覆盖承担，不新增第三种取值。
    ② 页面 ID 直接取 PRD 的 P-F 段位（主干 P-F50~P-F53、资产方 P-F01~P-F05、
       资金方 P-F20~P-F24），与 PRD 一一对应，便于逐条核验；不在模块内自造。
    ③ 弹层不占页面 ID 路由：P-F02 离站告知、P-F25 改邮箱、P-F26 改密码在 PRD 里
       就是弹窗形态，由模块的 modals 表承载，不登记为可路由页面。 */
 CF.MODULES['fs-portal-login']={dir:'金融服务端登录',file:'v1.0-金融服务端登录-原型.html',
   name:['Portal sign-in','金融服务端登录']};
 (function(){
  var focusPages={
   'P-F50':[['Choose your role','选择你的身份'],'/signin/role'],
   'P-F52':[['Switching role','切换身份'],'/signin/switch'],
   'P-F53':[['Something went wrong','通用失败态'],'/signin/error'],
   'P-F01':[['Signing you in','SSO 中转'],'/signin/sso/callback'],
   'P-F03':[['Terms of service','首登协议同意'],'/signin/agreement'],
   'P-F05':[['Sign-in could not be completed','SSO 失败'],'/signin/sso/failed'],
   'P-F20':[['Funder sign in','资金方登录 / 申请入驻'],'/signin/funder'],
   'P-F21':[['Set your password','设置密码 · 提交邮箱'],'/signin/password/email'],
   'P-F22':[['Set your password','设置密码 · 设置新密码'],'/signin/password/new']
  };
  var appPages={
   'P-F51':[['Home','平台首页'],'/'],
   'P-F04':[['Account settings','账户设置'],'/account'],
   'P-F24':[['Account settings','账户设置'],'/account']
  };
  for(var id in focusPages){
   CF.PAGES[id]={end:'asset',layout:'focus',name:focusPages[id][0]};
   CF.OWNER[id]='fs-portal-login'; CF.ENTRY[id]='#'+focusPages[id][1];
  }
  for(var id2 in appPages){
   CF.PAGES[id2]={end:'asset',layout:'app',name:appPages[id2][0]};
   CF.OWNER[id2]='fs-portal-login'; CF.ENTRY[id2]='#'+appPages[id2][1];
  }
  Object.assign(CF.PAGES['P-F51'],{nav:'P-F51',navKey:'navPortalHome',ico:'⌂'});
  Object.assign(CF.PAGES['P-F04'],{nav:'P-F04',navKey:'navAccount'});
  Object.assign(CF.PAGES['P-F24'],{nav:'P-F24',navKey:'navAccount'});
 })();
 /* 面客侧栏只登记「平台首页」这一条常驻项。账户设置随身份解析到 P-F04（资产方）
    或 P-F24（资金方），游客态两条都不出现——这是权限矩阵总表第 16 行（游客 ❌）
    在导航上的直接落点，由模块在会话态变化时改写 CF.NAV.asset 的第二项实现，
    侧栏本身仍由 shell 按登记表渲染，模块不自建菜单。 */
 CF.NAV.asset=['P-F51'];
 CF.MSG_PAGE={admin:'P-O20'};
})(window.CF=window.CF||{});
