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
  'P-O21':['Notification details','消息详情','app','/ops/messages/demo-password-change']
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
 // WS-309 pages are reserved above. Register its actual file only when delivered.
 // The account prototype currently renders its approved, explicit handoff boundary.
 CF.NAV={admin:['P-O06','P-O-AG-01'],asset:[]};
 Object.assign(CF.PAGES,{
 'P-O-AG-01':{end:'admin',layout:'app',nav:'P-O-AG-01',navKey:'navAgreements',icoKey:'doc',name:['Agreements','协议管理']},
 'P-O-AG-02':{end:'admin',layout:'app',nav:'P-O-AG-01',name:['Agreement details','协议详情']},
 'P-O-AG-03':{end:'admin',layout:'app',nav:'P-O-AG-01',name:['Edit version','版本编辑']},
 'P-O-AG-04':{end:'admin',layout:'app',nav:'P-O-AG-01',name:['Version details','版本详情']}
 });
 CF.MODULES.agreements={dir:"协议管理",file:"v1.0-协议管理-原型.html",name:["Agreements","协议管理"]};
 ["P-O-AG-01","P-O-AG-02","P-O-AG-03","P-O-AG-04"].forEach(id=>CF.OWNER[id]="agreements");
 CF.ENTRY["P-O-AG-01"]="#/agreements";
 // Temporary handoff target, not a message implementation. WS-309 replaces it.
 CF.MODULES["fs-ops-notify"]={dir:"账户与登录",file:"v1.0-账户与登录-原型.html",name:["Notification handoff","消息接入边界"]};
 CF.MSG_PAGE={admin:'P-O20'};
})(window.CF=window.CF||{});
