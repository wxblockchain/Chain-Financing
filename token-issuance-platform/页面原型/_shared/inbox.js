/* ==========================================================================
   inbox.js — 消息入口（M7 消息通知）：顶栏铃铛的未读数与最近消息预览，以及各身份的演示消息。
   所有模块加载（放在 menu.*.js 之后、navigation.js 之前），由 frame.js 渲染到顶栏。
   消息内容取自各来源模块 03 消息通知册的中英文标题与正文，动态值为跨模块统一的演示数据。
   不发送、不计算、不保存已读：未读数取本份演示数据，画面可用 data-unread 指定本屏的值。
   规则（收件范围、送达、已读、全部已读、前往原业务）以 PRD 两端共用/M7-消息通知 为准。
   ========================================================================== */
(function(TP){
  'use strict';
  var esc = function(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };

  /* 统一分类（两端共用），“其他”只是无法识别时的兜底 */
  var CATS = {
    progress:'业务办理进度', reminder:'业务提醒', compliance:'认证与合规', security:'账户安全',
    review:'审核任务', alert:'运营告警', other:'其他'
  };
  var SCOPE = '此入口在单模块附件中不展开，请在完整原型的 index.html 中打开。';

  /* 消息：id · 分类 · 发生时间 · 演示时的阅读状态 · 中英文标题与正文 · 原业务识别信息 · 去向。
     正文中 {t:ISO} 为按所选时区展示的时间，{d:ISO} 只展示日期。
     go.key 为前往原业务的路由键（仓库联看由所属模块 route.js 登记）；go.page 为本端固定页面的按钮文字；
     go.nav 为企业端原业务所在菜单（本企业未认证时前往原业务页面，由该页面给出认证引导）；
     无 go 表示不跳转。denied 表示原业务不存在或当前无权查看；done 表示原动作已办完，只能查看当前结果。 */
  var A = '示例企业 A 有限公司', C = '示例机构 C', Q = 'COU';
  /* M3b · 铸造失败待重试（NT-A03）：失败说明不写入正文；本例未产生交易哈希。 */
  function mintA03(id, app, at){
    return {id:id, cat:'alert', at:at, read:true,
      t:['铸造失败，等待重试','Minting failed and requires retry'],
      b:['发行申请 '+app+' 本次铸造失败，请进入申请详情查看并处理。',
         'Minting failed for issuance application '+app+'. Open the application details to review and retry.'],
      ref:[['申请编号',app]]};
  }
  /* M3b · 铸造超时待处理（NT-A05）：平台不提供重试或驳回，提示联系平台开发人员；本例未产生交易哈希。 */
  function mintA05(id, app, at){
    return {id:id, cat:'alert', at:at, read:true,
      t:['铸造超时，请联系开发处理','Minting timed out; contact the developers'],
      b:['发行申请 '+app+' 的铸造已等待超过 10 分钟，当前仍在处理中。请联系平台开发人员查明处理，并进入详情查看。',
         'Minting for issuance application '+app+' has been pending for over 10 minutes and is still processing. Please contact the platform developers to investigate, and open the details to review it.'],
      ref:[['申请编号',app]]};
  }
  /* M3b · 新发行申请待分配机构（NT-A07），审核任务；企业名称按上游原值展示，不翻译 */
  function reviewA07(id, app, at, go){
    return {id:id, cat:'review', at:at, read:true,
      t:['新发行申请待分配机构','New issuance application awaiting institution assignment'],
      b:['企业 '+A+' 提交了发行申请 '+app+'，请进入申请详情分配机构。',
         A+' submitted issuance application '+app+'. Open the application details to assign institutions.'],
      ref:[['申请编号',app]], go:go?{key:go}:null};
  }
  /* M4b · 销毁成功知会（NT-A06）：本模块只有这条标明交易来源 */
  function burnA06(id, app, asset, qty, at, source, go){
    var en = source==='非平台入口' ? 'Non-platform entry' : 'Platform entry';
    return {id:id, cat:'progress', at:at, read:true,
      t:['销毁成功知会','Token burn success notice'],
      b:['企业 '+A+' 的代币已销毁成功。销毁申请：'+app+'；资产：'+asset+'；销毁数量：'+qty+' '+Q+'；销毁时间：{t:'+at+'}；交易来源：'+source+'。本消息仅供知悉。',
         'Tokens for '+A+' have been burned. Burn application: '+app+'; asset: '+asset+'; quantity burned: '+qty+' '+Q+'; burned at: {t:'+at+'}; transaction source: '+en+'. This message is for information only.'],
      ref:[['销毁申请编号',app],['资产编号',asset]], extra:source==='非平台入口'?[['交易来源',source]]:null, go:{key:go}};
  }
  /* M4b · 销毁失败知会（NT-A04）：不含内部失败说明与重试指引 */
  function burnA04(id, app, asset, submitted, failed, go){
    return {id:id, cat:'alert', at:failed, read:true,
      t:['销毁失败知会','Token burn failure notice'],
      b:['企业 '+A+' 的销毁申请 '+app+' 执行失败。资产：'+asset+'；申请提交时间：{t:'+submitted+'}；失败时间：{t:'+failed+'}。本消息仅供知悉。',
         'Burn application '+app+' for '+A+' failed. Asset: '+asset+'; submitted at: {t:'+submitted+'}; failed at: {t:'+failed+'}. This message is for information only.'],
      ref:[['销毁申请编号',app],['资产编号',asset]], go:{key:go}};
  }
  /* M4b · 销毁超时待处理（NT-A08）· 销毁中超时：发生时间为进入销毁中满 10 分钟的时点；不含交易哈希与内部失败说明 */
  function burnA08(id, app, asset, at, go){
    return {id:id, cat:'alert', at:at, read:true,
      t:['销毁超时待处理','Token burn pending over 10 minutes'],
      b:['企业 '+A+' 的销毁申请 '+app+' 已处于销毁中超过 10 分钟，仍无明确结果。资产：'+asset+'。请联系平台开发查明并处理。',
         'Burn application '+app+' for '+A+' has been in progress for over 10 minutes without a definite result. Asset: '+asset+'. Contact the platform developers to investigate and resolve it.'],
      ref:[['销毁申请编号',app],['资产编号',asset]], go:{key:go}};
  }
  /* M4b · 销毁超时待处理（NT-A08）· 提交锁超时：尚未形成销毁申请，以代币编号识别；发生时间为自加锁起满 10 分钟的时点 */
  function burnA08Lock(id, token, asset, at, go){
    return {id:id, cat:'alert', at:at, read:true,
      t:['销毁超时待处理','Token burn pending over 10 minutes'],
      b:['企业 '+A+' 的代币 '+token+' 已提交销毁超过 10 分钟，仍未取得交易标识，当前为确认中。资产：'+asset+'。请联系平台开发查明并处理。',
         'The burn submission for token '+token+' of '+A+' has been pending for over 10 minutes without a transaction identifier and is awaiting confirmation. Asset: '+asset+'. Contact the platform developers to investigate and resolve it.'],
      ref:[['代币编号',token],['资产编号',asset]], go:{key:go}};
  }
  /* M4b · 单位价值调整超时待处理（NT-A09）：单位价值按填写的完整值展示；不含调整原因、操作人与交易哈希 */
  function adjustA09(id, token, next, prev, submitted, at, go){
    return {id:id, cat:'alert', at:at, read:true,
      t:['单位价值调整超时待处理','Unit value adjustment pending over 10 minutes'],
      b:['代币 '+token+'（发行人：'+A+'）的单位价值调整已提交超过 10 分钟，仍无明确结果。新单位价值：1 '+Q+' = '+next+' USD；当前仍生效：1 '+Q+' = '+prev+' USD；提交时间：{t:'+submitted+'}。请联系平台开发查明并处理。',
         'The unit value adjustment for token '+token+' (issuer: '+A+') was submitted over 10 minutes ago and has no definite result yet. New unit value: 1 '+Q+' = '+next+' USD; currently effective: 1 '+Q+' = '+prev+' USD; submitted at: {t:'+submitted+'}. Contact the platform developers to investigate and resolve it.'],
      ref:[['代币编号',token]], go:{key:go}};
  }
  /* M4b · 代币已销毁、待解除托管（NT-R02），收件人为本代币的资产托管机构；不标交易来源 */
  function custodyR02(id, app, asset, qty, confirmed, go){
    return {id:id, cat:'review', at:confirmed, read:true,
      t:['代币已销毁，待解除托管','Token burned; release of asset custody required'],
      b:['企业 '+A+' 的代币已销毁。销毁申请：'+app+'；资产：'+asset+'；销毁数量：'+qty+' '+Q+'；链上确认时间：{t:'+confirmed+'}。请在平台办理解除资产托管。',
         'Tokens for '+A+' have been burned. Burn application: '+app+'; asset: '+asset+'; quantity burned: '+qty+' '+Q+'; confirmed on-chain at: {t:'+confirmed+'}. Release asset custody on the platform.'],
      ref:[['销毁申请编号',app],['资产编号',asset]], go:{key:go}};
  }
  /* M4b · 代币已销毁（NT-R04），收件人为名单内的法律服务机构、审计机构；原业务识别信息为代币编号 */
  function burnR04(id, app, asset, token, qty, confirmed, go){
    return {id:id, cat:'progress', at:confirmed, read:true,
      t:['代币已销毁','Token burned'],
      b:['企业 '+A+' 的代币已销毁。销毁申请：'+app+'；资产：'+asset+'；销毁数量：'+qty+' '+Q+'；链上确认时间：{t:'+confirmed+'}。资产托管将由资产托管机构办理解除，本消息仅供知悉。',
         'Tokens for '+A+' have been burned. Burn application: '+app+'; asset: '+asset+'; quantity burned: '+qty+' '+Q+'; confirmed on-chain at: {t:'+confirmed+'}. Asset custody will be released by the asset custodian. This message is for information only.'],
      ref:[['代币编号',token]], go:go?{key:go}:null};
  }
  /* M4b · 销毁成功（NT-C06）/ 销毁失败（NT-C10），面客端；销毁成功写链上确认时间，不标交易来源 */
  function burnC06(id, app, asset, qty, confirmed, go, read){
    return {id:id, cat:'progress', at:confirmed, read:read,
      t:['销毁成功','Token burn completed'],
      b:['销毁申请 '+app+' 已销毁成功。资产：'+asset+'；链上确认时间：{t:'+confirmed+'}；销毁数量：'+qty+' '+Q+'。请等待资产托管机构解除资产托管。',
         'Burn application '+app+' has completed. Asset: '+asset+'; confirmed on-chain at: {t:'+confirmed+'}; quantity burned: '+qty+' '+Q+'. Await release of asset custody by the asset custodian.'],
      ref:[['销毁申请编号',app],['资产编号',asset]], go:{key:go, nav:'burn'}};
  }
  function burnC10(id, app, asset, submitted, failed, go){
    return {id:id, cat:'progress', at:failed, read:true,
      t:['销毁失败','Token burn failed'],
      b:['销毁申请 '+app+' 执行失败。资产：'+asset+'；申请提交时间：{t:'+submitted+'}；失败时间：{t:'+failed+'}。本笔申请已结束；当前仍满足销毁条件时，请重新发起一笔销毁交易。',
         'Burn application '+app+' failed. Asset: '+asset+'; submitted at: {t:'+submitted+'}; failed at: {t:'+failed+'}. This application has ended. If all current conditions are met, initiate a new burn transaction.'],
      ref:[['销毁申请编号',app],['资产编号',asset]], go:{key:go, nav:'burn'}};
  }
  /* M3b · 发行申请进入铸造（NT-C03），面客端 */
  function mintC03(id, app, at, go){
    return {id:id, cat:'progress', at:at, read:true,
      t:['发行申请已进入铸造','Issuance application entered minting'],
      b:['您的发行申请 '+app+' 已进入铸造，请等待链上结果。',
         'Issuance application '+app+' has entered minting. Please wait for the on-chain result.'],
      ref:[['申请编号',app]], go:go?{key:go, nav:'issue'}:null};
  }
  /* M5 · 密码变更通知（NT-LG-03）：设置 / 重置 / 修改三种情形各一套标题与正文；不跳转。
     官方客服邮箱由需求方上线后提供；提供前按 PRD 推荐不写“如非本人操作”的求助一句，其余照常。 */
  var PASSWORD = {
    set:['管理端账号密码已设置','Admin account password set',
      '您的管理端账号已于 {t:@} 完成首次密码设置，初始密码已失效，该账号的全部登录已结束，请使用新密码登录。',
      'Your admin account password was set for the first time at {t:@}. The initial password is no longer valid and all sessions of this account have been signed out. Please sign in with your new password.'],
    reset:['管理端账号密码已重置','Admin account password reset',
      '您的管理端账号已于 {t:@} 通过邮箱验证码重置密码，原密码已失效，该账号的全部登录已结束，请使用新密码登录。',
      'Your admin account password was reset via email verification code at {t:@}. The previous password is no longer valid and all sessions of this account have been signed out. Please sign in with your new password.'],
    changed:['管理端账号密码已修改','Admin account password changed',
      '您的管理端账号已于 {t:@} 修改密码，原密码已失效，该账号的全部登录已结束，请使用新密码登录。',
      'Your admin account password was changed at {t:@}. The previous password is no longer valid and all sessions of this account have been signed out. Please sign in with your new password.']
  };
  function password(id, kind, at, read){
    var p = PASSWORD[kind];
    return {id:id, cat:'security', at:at, read:read, t:[p[0], p[1]],
      b:[p[2].replace('@',at), p[3].replace('@',at)]};
  }

  var DATA = {
    /* 管理端 · 运营：全体运营（各自记录已读）+ 本人。共 27 条，6 条未读，第一批 20 条。 */
    ops: [
      password('o01','changed','2026-11-07T02:10:00Z',true),
      Object.assign(burnA06('o02','BA-DEMO-0040','RA-DEMO-0208','12,345.675','2026-11-06T05:31:00Z','非平台入口','burnApplication0040'), {read:false}),
      /* DEMO-TOKEN-001 的单位价值调整于 11-04 11:00（UTC+8）提交，满 10 分钟仍在处理中 */
      Object.assign(adjustA09('o03','DEMO-TOKEN-001','0.95','1','2026-11-04T03:00:00Z','2026-11-04T03:10:00Z','ledgerTokenAdjusting'), {read:false}),
      Object.assign(burnA06('o04','BA-DEMO-0031','RA-DEMO-0201','50,000.00','2026-10-30T07:15:00Z','平台入口','burnApplication0031'), {read:false}),
      burnA06('o05','BA-DEMO-0019','RA-DEMO-0204','65,000.00','2026-10-30T07:15:00Z','平台入口','burnApplication0019'),
      burnA06('o06','BA-DEMO-0018','RA-DEMO-0205','18,000.00','2026-10-30T07:15:00Z','平台入口','burnApplication0018'),
      Object.assign(mintA05('o07','IA-DEMO-0027','2026-10-30T06:30:00Z'), {read:false}),
      mintA03('o08','IA-DEMO-0027','2026-10-30T06:12:00Z'),
      /* IA-DEMO-0031 已由运营分配机构，前往只查看当前结果 */
      Object.assign(reviewA07('o09','IA-DEMO-0031','2026-10-29T01:15:00Z','reviewApplication'), {done:true}),
      /* DEMO-TOKEN-021（企业端 M4a 提交锁画面）签名后未取得交易标识，自加锁起满 10 分钟 */
      Object.assign(burnA08Lock('o10','DEMO-TOKEN-021','RA-DEMO-0201','2026-10-28T08:10:00Z','ledgerTokenLocked'), {read:false}),
      burnA04('o11','BA-DEMO-0024','RA-DEMO-0201','2026-10-28T06:30:00Z','2026-10-28T06:42:00Z','burnApplication0024'),
      Object.assign(burnA08('o12','BA-DEMO-0030','RA-DEMO-0203','2026-10-28T06:40:00Z','burnApplication0030'), {read:false}),
      burnA04('o13','BA-DEMO-0021','RA-DEMO-0206','2026-10-28T06:30:00Z','2026-10-28T06:40:00Z','burnApplication0021'),
      mintA03('o14','IA-DEMO-0211','2026-06-01T04:10:00Z'),
      mintA05('o15','IA-DEMO-0208','2026-06-01T03:50:00Z'),
      mintA03('o16','IA-DEMO-0208','2026-06-01T03:35:00Z'),
      mintA03('o17','IA-DEMO-0206','2026-06-01T03:20:00Z'),
      mintA03('o18','IA-DEMO-0205','2026-06-01T03:15:00Z'),
      mintA05('o19','IA-DEMO-0204','2026-06-01T03:12:00Z'),
      mintA03('o20','IA-DEMO-0204','2026-06-01T03:10:00Z'),
      mintA03('o21','IA-DEMO-0203','2026-06-01T03:05:00Z'),
      mintA03('o22','IA-DEMO-0202','2026-06-01T03:02:00Z'),
      mintA03('o23','IA-DEMO-0201','2026-06-01T03:00:00Z'),
      mintA03('o24','IA-DEMO-0203','2026-05-31T09:20:00Z'),
      mintA03('o25','IA-DEMO-0202','2026-05-31T09:10:00Z'),
      mintA03('o26','IA-DEMO-0201','2026-05-31T09:00:00Z'),
      password('o27','set','2026-05-20T02:00:00Z',true)
    ],
    /* 管理端 · 机构（示例机构 C，资产托管机构）：本机构 + 本人 */
    reg: [
      Object.assign(custodyR02('r01','BA-DEMO-0040','RA-DEMO-0208','12,345.675','2026-11-06T05:31:00Z','burnApplication0040'), {read:false}),
      Object.assign(custodyR02('r02','BA-DEMO-0031','RA-DEMO-0201','50,000.00','2026-10-30T07:15:00Z','burnApplication0031'), {read:false}),
      Object.assign(custodyR02('r03','BA-DEMO-0019','RA-DEMO-0204','65,000.00','2026-10-30T07:15:00Z','burnApplication0019'), {read:false}),
      Object.assign(custodyR02('r04','BA-DEMO-0018','RA-DEMO-0205','18,000.00','2026-10-30T07:15:00Z','burnApplication0018'), {done:true}),
      password('r05','set','2026-05-20T03:00:00Z',true)
    ],
    /* 管理端 · 机构（示例机构 D，审计机构，M4b 的只读身份 regd）：本机构 + 本人。
       只有 DEMO-TOKEN-025 在 M4b 有该机构的代币详情画面。 */
    aud: [
      Object.assign(burnR04('d01','BA-DEMO-0040','RA-DEMO-0208','DEMO-TOKEN-028','12,345.675','2026-11-06T05:31:00Z'), {read:false}),
      Object.assign(burnR04('d02','BA-DEMO-0031','RA-DEMO-0201','DEMO-TOKEN-021','50,000.00','2026-10-30T07:15:00Z'), {read:false}),
      burnR04('d03','BA-DEMO-0018','RA-DEMO-0205','DEMO-TOKEN-025','18,000.00','2026-10-30T07:15:00Z','auditToken025'),
      password('d04','set','2026-05-20T04:00:00Z',true)
    ],
    /* 面客端 · 本企业（有有效企业归属，已认证、未认证均可查看） */
    client: [
      {id:'c01', cat:'progress', at:'2026-10-30T08:20:00Z', read:false,
        t:['资产已解除托管','Asset custody released'],
        b:['资产 RA-DEMO-0205 已解除托管。销毁申请：BA-DEMO-0018；资产托管机构：'+C+'；解除时间：{t:2026-10-30T08:20:00Z}。',
           'Asset custody has been released for asset RA-DEMO-0205. Burn application: BA-DEMO-0018; asset custodian: '+C+'; released at: {t:2026-10-30T08:20:00Z}.'],
        ref:[['销毁申请编号','BA-DEMO-0018'],['资产编号','RA-DEMO-0205']], go:{key:'burnApplication0018', nav:'burn'}},
      burnC06('c02','BA-DEMO-0031','RA-DEMO-0201','50,000.00','2026-10-30T07:15:00Z','burnApplication0031',false),
      burnC06('c03','BA-DEMO-0019','RA-DEMO-0204','65,000.00','2026-10-30T07:15:00Z','burnApplication0019',true),
      burnC06('c04','BA-DEMO-0018','RA-DEMO-0205','18,000.00','2026-10-30T07:15:00Z','burnApplication0018',true),
      {id:'c05', cat:'progress', at:'2026-10-30T06:25:20Z', read:false,
        t:['代币铸造成功','Token minting succeeded'],
        b:['发行申请 IA-DEMO-0019 已铸造成功，代币编号为 DEMO-TOKEN-001，数量为 36,000.00 '+Q+'。',
           'Issuance application IA-DEMO-0019 was minted successfully. Token ID: DEMO-TOKEN-001; quantity: 36,000.00 '+Q+'.'],
        ref:[['代币编号','DEMO-TOKEN-001'],['申请编号','IA-DEMO-0019']], go:{key:'tokenDemo001', nav:'tokens'}},
      mintC03('c06','IA-DEMO-0019','2026-10-30T06:20:20Z','assetApplication0102'),
      {id:'c07', cat:'progress', at:'2026-10-30T06:20:20Z', read:false,
        t:['发行申请已驳回','Issuance application rejected'],
        b:['您的发行申请 IA-DEMO-0012 已被驳回。驳回意见：【演示意见】贸易合同记载的订单编号与销售发票对应的编号不一致，交付凭证中的债务人名称也与申请记录存在差异。请核实资产材料中的贸易合同、销售发票及交付凭证，确保相关信息能够相互对应。',
           'Issuance application IA-DEMO-0012 has been rejected. Reason (original text): 【演示意见】贸易合同记载的订单编号与销售发票对应的编号不一致，交付凭证中的债务人名称也与申请记录存在差异。请核实资产材料中的贸易合同、销售发票及交付凭证，确保相关信息能够相互对应。'],
        ref:[['申请编号','IA-DEMO-0012']], go:{key:'assetApplication0160', nav:'issue'}},
      mintC03('c08','IA-DEMO-0027','2026-10-30T06:05:20Z','assetApplication0027'),
      burnC10('c09','BA-DEMO-0024','RA-DEMO-0201','2026-10-28T06:30:00Z','2026-10-28T06:42:00Z','burnApplication0024'),
      burnC10('c10','BA-DEMO-0021','RA-DEMO-0206','2026-10-28T06:30:00Z','2026-10-28T06:40:00Z','burnApplication0021'),
      {id:'c11', cat:'compliance', at:'2026-10-20T02:00:00Z', read:true,
        t:['认证状态已变更','Verification status changed'],
        b:['你的认证状态已变更，需要企业认证的业务暂不可用。你仍可查看用户信息、企业信息和消息。请前往资产可信平台查看当前认证状态。',
           'Your verification status has changed. Business actions that require company verification are temporarily unavailable. You can still view your user information, company information and messages. Visit the Asset Trust Platform to check your current verification status.'],
        go:{key:'me', page:'前往用户信息'}},
      Object.assign(mintC03('c12','IA-DEMO-0008','2026-05-12T03:00:20Z',null), {denied:true})
    ]
  };
  var LIST = {client:'list', ops:'o-list', reg:'r-list', aud:'d-list'}, PREVIEW = {client:'preview', ops:'o-preview', reg:'r-preview', aud:'d-preview'};
  var BY_WHO = {certified:'client', uncertified:'client', ops:'ops', opsnew:'ops', reg:'reg', regoff:'reg', regnew:'reg', regd:'aud'};

  function find(role, id){ var r=null; (DATA[role]||[]).forEach(function(m){ if(m.id===id) r=m; }); return r; }
  function pair(zh, en, cls){
    return '<span class="lang-zh'+(cls?' '+cls:'')+'" lang="zh-CN">'+zh+'</span><span class="lang-en'+(cls?' '+cls:'')+'" lang="en">'+en+'</span>';
  }
  function times(s){
    return esc(s).replace(/\{t:([^}]+)\}/g,'<time data-instant="$1" data-minute></time>')
                 .replace(/\{d:([^}]+)\}/g,'<time data-instant="$1" data-day></time>');
  }
  function title(m){ return pair(esc(m.t[0]), esc(m.t[1])); }
  function body(m){ return pair(times(m.b[0]), times(m.b[1])); }
  /* 列表、预览里的原业务识别信息只展示，不做链接；分类在前。 */
  function meta(m){
    return '<span class="msg-cat">'+CATS[m.cat||'other']+'</span>'+(m.ref||[]).map(function(r){
      return '<span class="msg-ref"><span>'+r[0]+'</span> <span class="mono">'+esc(r[1])+'</span></span>';
    }).join('')+(m.extra||[]).map(function(x){ return '<span class="tag warn">'+esc(x[1])+'</span>'; }).join('');
  }
  /* 指向本模块画面时用 data-go；在其他模块里经仓库联看路由前往 M7，附件中给范围提示。 */
  function link(screen, key){
    return document.getElementById(screen) ? ' data-go="'+screen+'"' : ' data-module-key="'+key+'" data-toast="'+SCOPE+'"';
  }

  /* 一条消息（列表与预览共用）。opts.read 覆盖演示状态，opts.compact 为预览，opts.screen 为详情画面 id。 */
  function item(role, m, opts){
    opts = opts || {};
    var read = opts.read!==undefined ? opts.read : m.read;
    var screen = opts.screen || 'm-'+m.id;
    // 预览宽度有限：时间放在摘要下方，右侧只留阅读状态。
    var when = '<time class="msg-time" data-instant="'+m.at+'" data-minute></time>';
    return '<li><button type="button" class="msg-item'+(opts.compact?' compact':'')+(read?'':' is-unread')+'"'+link(screen,'msg-'+m.id)+'>'+
      '<span class="msg-dot" aria-hidden="true"></span>'+
      '<span class="msg-main"><span class="msg-title">'+title(m)+'</span>'+
      '<span class="msg-summary">'+body(m)+'</span>'+
      '<span class="msg-meta">'+meta(m)+'</span>'+(opts.compact?when:'')+'</span>'+
      '<span class="msg-side">'+(opts.compact?'':when)+
      (read?'<span class="tag">已读</span>':'<span class="tag accent">未读</span>')+'</span></button></li>';
  }

  function unread(role){ return (DATA[role]||[]).filter(function(m){ return !m.read; }).length; }

  /* 未认证企业沿用同一批消息，详情与列表为该身份自己的画面（u- 前缀），不切换成已认证身份。 */
  function screens(who){ return who==='uncertified' ? {list:'u-list', prefix:'u-'} : {list:LIST[BY_WHO[who]], prefix:'m-'}; }

  /* 最近消息预览：最近 10 条（已读、未读都包括）；没有消息、读取失败各一种状态；不提供全部已读。 */
  function panel(who, state, hidden, opts){
    var role = BY_WHO[who], rows = (DATA[role]||[]).slice(0,10), sc = screens(who), list = opts && opts.omitList ? null : sc.list;
    var inner;
    if(state==='error'){
      inner = '<div class="state err inbox-state" role="alert"><span class="state-ico">'+TP.icon('alert')+'</span><h3>最近消息读取失败</h3><p>暂时无法读取，请稍后重试。</p>'+
        '<button type="button" class="btn sm"'+(document.getElementById(PREVIEW[role])?' data-go="'+PREVIEW[role]+'"':'')+'>重试</button></div>';
    }else if(state==='empty' || !rows.length){
      inner = '<div class="state inbox-state" role="status"><span class="state-ico">'+TP.icon('bell')+'</span><h3>还没有消息</h3><p>业务有新的进展时，会在这里通知你。</p></div>';
    }else{
      inner = '<ul class="msg-list">'+rows.map(function(m){ return item(role, m, {compact:true, screen:sc.prefix+m.id}); }).join('')+'</ul>';
    }
    var all = list ? '<button type="button" class="inbox-all"'+link(list,'msg')+'>查看全部消息</button>' : '';
    return '<div class="dd-list inbox-panel" role="region" aria-label="最近消息"'+(hidden?' hidden':'')+'>'+
      '<div class="inbox-h"><h2>最近消息</h2><span class="inbox-zone"><span>时区</span> <span data-zone></span></span></div>'+inner+all+'</div>';
  }

  TP.inbox = {
    CATS:CATS, DATA:DATA, LIST:LIST,
    roleOf:function(who){ return BY_WHO[who] || null; },
    unread:unread, find:find, item:item, panel:panel, screens:screens,
    title:title, body:body, meta:meta, pair:pair, times:times, esc:esc
  };

  TP.addCopy && TP.addCopy({
    '业务办理进度':'Business progress','业务提醒':'Business reminders','认证与合规':'Verification & compliance','账户安全':'Account security',
    '审核任务':'Review tasks','运营告警':'Operations alerts','其他':'Other',
    '已读':'Read','未读':'Unread','最近消息':'Recent messages','查看全部消息':'View all messages',
    '最近消息读取失败':'Could not load recent messages','暂时无法读取，请稍后重试。':'Unable to load right now. Please try again later.','重试':'Retry',
    '还没有消息':'No messages yet','业务有新的进展时，会在这里通知你。':'You will be notified here when there is an update on your business.',
    '申请编号':'Application ID','资产编号':'Asset ID','销毁申请编号':'Burn application ID','代币编号':'Token ID','交易来源':'Transaction source','非平台入口':'Non-platform entry','平台入口':'Platform entry',
    '登录地址':'Login address','时区':'Time zone','前往用户信息':'Go to user information'
  });
})(window.TP = window.TP || {});
