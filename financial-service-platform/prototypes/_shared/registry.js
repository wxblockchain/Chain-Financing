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

 /* WS-311 金融服务端登录（主干 + 资产方 SSO + 资金方账户体系）。四点说明：
    ① 本模块是**面客画布**，端别取 end:'asset'——按 docs/design-system/README.md，
       end 表达画布形态（控制台 / 面客）而不是平台或端；金融服务端归面客形态，
       密度由 base.css 的 [data-end="asset"] 覆盖承担，不新增第三种取值。
    ② 页面 ID 取 PRD 的 P-F 段位：主干 P-F50~P-F53、资产方 P-F01~P-F09（PRD 用到 05）、
       资金方 P-F10~P-F29（PRD 用到 26），与 PRD 一一对应，便于逐条核验。
    ③ **P-F06 与 P-F27 是本轮用户新增的两页，PRD 里还没有**：分别取各自段位内
       尚未分配的下一个号（资产方 P-F06、资金方 P-F27），落在正确段位、不与任何
       已用号相撞。**待《登录模块 · 统一编号段位分配表》正式登记后回写**，
       在那之前它们是原型侧的暂定号，不要据此当成 PRD 已定义的页面。
    ④ 弹层不占页面 ID 路由：P-F02 离站告知、P-F25 改邮箱、P-F26 改密码在 PRD 里
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
   'P-F51':[['Home','首页'],'/'],
   'P-F04':[['Account settings','账户设置'],'/account'],
   'P-F24':[['Account settings','账户设置'],'/account'],
   'P-F06':[['Get verified','入驻引导'],'/account/verification'],
   'P-F27':[['Institution','机构信息'],'/account/institution'],
   /* WS-316 资金方机构认证审核。编号取 PRD 03-1 第 5 章的页面清单
      P-F30～P-F34，逐一对应、不自行改号；C-F50 二次确认弹窗与 C-F52
      客服入口在 PRD 里就是弹层形态，由模块的 modals 表承载，与 P-F02 /
      P-F25 / P-F26 同一处理，不登记为可路由页面。
      五页都挂在「机构信息」P-F27 之下，不占顶栏导航项：PRD 8.1～8.6 的
      入口就是账户 · 机构信息，而顶栏主导航只有首页。 */
   'P-F30':[['Institution profile form','入驻引导 · 机构资料'],'/account/institution/apply'],
   'P-F31':[['Review and submit','提交预览'],'/account/institution/review'],
   'P-F32':[['Application submitted','提交结果'],'/account/institution/submitted'],
   'P-F33':[['Application status','审核进度'],'/account/institution/status'],
   'P-F34':[['Application details','申请详情'],'/account/institution/application']
  };
  for(var id in focusPages){
   CF.PAGES[id]={end:'asset',layout:'focus',name:focusPages[id][0]};
   CF.OWNER[id]='fs-portal-login'; CF.ENTRY[id]='#'+focusPages[id][1];
  }
  for(var id2 in appPages){
   CF.PAGES[id2]={end:'asset',layout:'app',name:appPages[id2][0]};
   CF.OWNER[id2]='fs-portal-login'; CF.ENTRY[id2]='#'+appPages[id2][1];
  }
  /* 只有首页进顶栏主导航。账户设置与机构信息挂在右上角账号下拉里（account().extra），
     入驻引导页 P-F06 不进任何菜单——它是资产方首登后的落地页与流程页，入口只来自
     首登流程本身、常驻补全提示条与受限操作引导弹层，不占导航位。
     WS-316 的申请链路五页同理：入口是「机构信息」P-F27，不占导航位、不进账号下拉。
     因此这些页都不登记 nav / navKey，只登记 crumb 让面包屑当前级有稳定文案。 */
  Object.assign(CF.PAGES['P-F51'],{nav:'P-F51',navKey:'navPortalHome'});
  Object.assign(CF.PAGES['P-F06'],{crumb:['Get verified','入驻引导']});
  Object.assign(CF.PAGES['P-F27'],{crumb:['Institution','机构信息']});
  Object.assign(CF.PAGES['P-F30'],{crumb:['Institution profile','机构资料']});
  Object.assign(CF.PAGES['P-F31'],{crumb:['Review and submit','核对并提交']});
  Object.assign(CF.PAGES['P-F32'],{crumb:['Application submitted','申请已提交']});
  Object.assign(CF.PAGES['P-F33'],{crumb:['Application status','审核进度']});
  Object.assign(CF.PAGES['P-F34'],{crumb:['Application details','申请详情']});
 })();
 CF.NAV.asset=['P-F51'];

 /* WS-324 借贷广场 · 融资需求与代币质押（金融服务端面客画布，portal 顶栏骨架）。三点说明：
    (1) 端别 end:'asset'——按 docs/design-system/README.md，end 表达画布形态；金融服务端归面客形态。
        本模块继承 4.3 已落库的顶栏（金融服务端登录），不并入 WS-308/309/310/312/318 的 .app 侧栏骨架。
    (2) 页面 ID 取 PRD 的 P-LS 段位：P-LS-01 融资需求列表、P-LS-02 融资需求详情、P-LS-03 建池与发布，
        与 PRD 6.5 一一对应、不自行改号。
    (3) P-LS-90「我的融资项目」是原型侧内部页，PRD 未定义此页：WS-324 PRD 6.1 只写了
        「草稿在"我的项目"与控制台有继续发布入口」，没有给页面编号。它承载 AC-LS-54
        「两段式可中断可续做」所必需的最小续做入口，不是 WS-328 我的控制台。
        **号段特意取 90 段避让 PRD**：P-LS-04 / 05 / 06 已被 WS-325 PRD V4.0 占用
        （授信核定 / 机构报价 / 接受拒绝），原型侧不得再占 PRD 连号段位。 */
 CF.MODULES['lending-marketplace']={dir:'借贷广场-融资需求与代币质押',
   file:'v1.0-借贷广场-融资需求与代币质押-原型.html',
   name:['Lending marketplace','借贷广场 · 融资需求与代币质押']};
 (function(){
  var pages={
   'P-LS-01':[['Financing marketplace','融资需求广场'],'/plaza'],
   'P-LS-02':[['Financing request details','融资需求详情'],'/project'],
   'P-LS-03':[['Create pool and publish','建池与发布'],'/project/new'],
   'P-LS-90':[['My financing projects','我的融资项目'],'/my-projects']
  };
  for(var id in pages){
   CF.PAGES[id]={end:'asset',layout:'app',name:pages[id][0]};
   CF.OWNER[id]='lending-marketplace'; CF.ENTRY[id]='#'+pages[id][1];
  }
  /* 只有广场与我的融资项目进顶栏主导航；详情与建池是由列表 / 流程带出来的页面，
     按 4.3「流程页与落地页不一定进菜单」不占导航位，只登记 crumb。 */
  Object.assign(CF.PAGES['P-LS-01'],{nav:'P-LS-01',navKey:'navPlaza',ico:'\u25a4'});
  Object.assign(CF.PAGES['P-LS-90'],{nav:'P-LS-90',navKey:'navMyProjects',ico:'\u25a6'});
  Object.assign(CF.PAGES['P-LS-02'],{crumb:['Request details','融资需求详情']});
  Object.assign(CF.PAGES['P-LS-03'],{crumb:['Create and publish','建池与发布']});
 })();

 /* WS-325 借贷广场 · 授信、报价与接受/拒绝（同一块面客画布，与 WS-324 共用 portal 顶栏骨架）。
    (1) 页面 ID 直接取 PRD 给的 P-LS-04 / 05 / 06，不自造号；WS-324 的「我的融资项目」已让到
        P-LS-90（commit 6f31e6e），两边不撞号。
    (2) 三页都不进顶栏主导航：授信核定与报价是从广场「立即报价」带出来的流程页，
        接受/拒绝是从融资业务深链带出来的处理页，按 4.3「流程页与落地页不一定进菜单」只登记 crumb。
    (3) ENTRY 用各页自己的锚点，与分册 6.6.1 的深链契约一致：
        授信步骤不另开锚点（D-LS-15），它是 project/{id}?action=quote 内的一步。 */
 CF.MODULES['lending-credit-quote']={dir:'借贷广场-授信报价与接受拒绝',
   file:'v1.0-借贷广场-授信报价与接受拒绝-原型.html',
   name:['Credit, quote and response','借贷广场 · 授信报价与接受/拒绝']};
 (function(){
  var pages={
   'P-LS-04':[['Credit assessment','授信核定'],'/project?action=quote'],
   'P-LS-05':[['Institution quote','机构报价'],'/project?action=quote'],
   'P-LS-06':[['Accept or decline','接受 / 拒绝报价'],'/deal?action=respond_quote']
  };
  for(var id in pages){
   CF.PAGES[id]={end:'asset',layout:'app',name:pages[id][0]};
   CF.OWNER[id]='lending-credit-quote'; CF.ENTRY[id]='#'+pages[id][1];
  }
  Object.assign(CF.PAGES['P-LS-04'],{crumb:['Credit assessment','授信核定']});
  Object.assign(CF.PAGES['P-LS-05'],{crumb:['Institution quote','机构报价']});
  Object.assign(CF.PAGES['P-LS-06'],{crumb:['Accept or decline','接受 / 拒绝报价']});
 })();

 /* WS-326 借贷广场 · 放款与融资确认（同一块面客画布，与 WS-324 / WS-325 共用 portal 顶栏骨架）。
    (1) 页面 ID 直接取 PRD 分册 6.5 给的 P-LS-07 / P-LS-08，不自造号；已占用的号段是
        P-LS-01/02/03（WS-324）、P-LS-04/05/06（WS-325）、P-LS-90（WS-324 原型侧内部页）。
    (2) 两页都不进顶栏主导航：放款是从融资业务深链带出来的处理页，融资确认同理，
        按 4.3「流程页与落地页不一定进菜单」只登记 crumb。
    (3) ENTRY 用分册 6.7.1 的新增锚点，与深链契约一致：三个处置动作**不各占锚点**（D-LN-39），
        它们随 deal/{id}?action=disburse 一并返回；也不新增 disbursement/{id} 这一层（D-LN-40）。
        资产方重传盖章件的锚点 deal/{id}?action=reupload_contract 落在 P-LS-07 的资产方视角。 */
 CF.MODULES['lending-disbursement']={dir:'借贷广场-放款与融资确认',
   file:'v1.0-借贷广场-放款与融资确认-原型.html',
   name:['Disbursement and confirmation','借贷广场 · 放款与融资确认']};
 (function(){
  var pages={
   'P-LS-07':[['Record disbursement','放款与放款凭证上传'],'/deal?action=disburse'],
   'P-LS-08':[['Confirm receipt','确认到账'],'/deal?action=confirm_disbursement']
  };
  for(var id in pages){
   CF.PAGES[id]={end:'asset',layout:'app',name:pages[id][0]};
   CF.OWNER[id]='lending-disbursement'; CF.ENTRY[id]='#'+pages[id][1];
  }
  Object.assign(CF.PAGES['P-LS-07'],{crumb:['Record disbursement','放款与放款凭证上传']});
  Object.assign(CF.PAGES['P-LS-08'],{crumb:['Confirm receipt','确认到账']});
 })();
 CF.NAV.asset=['P-F51','P-LS-01','P-LS-90'];
 CF.MSG_PAGE={admin:'P-O20'};
})(window.CF=window.CF||{});
