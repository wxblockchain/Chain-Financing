/* ==========================================================================
   inbox.js — 消息入口（M7 消息通知）：顶栏铃铛的未读数与最近消息预览，以及三类身份的演示消息。
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
     无 go 表示不跳转。denied 表示原业务不存在或当前无权查看。 */
  var A = '示例企业 A 有限公司', C = '示例机构 C', Q = 'COU';
  /* M3b · 铸造失败待重试（NT-A03）：失败说明不写入正文；本例未产生交易哈希。 */
  function mintA03(id, app, at){
    return {id:id, cat:'alert', at:at, read:true,
      t:['铸造失败，等待重试','Minting failed and requires retry'],
      b:['发行申请 '+app+' 本次铸造失败，请进入申请详情查看并处理。',
         'Minting failed for issuance application '+app+'. Open the application details to review and retry.'],
      ref:[['申请编号',app]]};
  }
  /* M3b · 铸造超时待处理（NT-A05） */
  function mintA05(id, app, at){
    return {id:id, cat:'alert', at:at, read:true,
      t:['铸造超时，等待结果','Minting is taking longer than expected'],
      b:['发行申请 '+app+' 的铸造已等待超过 10 分钟，当前仍在处理中。请进入详情查看。',
         'Minting for issuance application '+app+' has been pending for over 10 minutes and is still processing. Open the details to review it.'],
      ref:[['申请编号',app]]};
  }
  /* M4b · 销毁成功知会（NT-A06），交易来源须写明 */
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
  /* M4b · 代币已销毁、待解除托管（NT-R02），收件人为本代币的资产托管机构 */
  function custodyR02(id, app, asset, qty, burned, go){
    return {id:id, cat:'review', at:burned.replace(/:00Z$/,':20Z'), read:true,
      t:['代币已销毁，待解除托管','Token burned; release of asset custody required'],
      b:['企业 '+A+' 的代币已销毁。销毁申请：'+app+'；资产：'+asset+'；销毁数量：'+qty+' '+Q+'；销毁时间：{t:'+burned+'}。请在平台办理解除资产托管。',
         'Tokens for '+A+' have been burned. Burn application: '+app+'; asset: '+asset+'; quantity burned: '+qty+' '+Q+'; burned at: {t:'+burned+'}. Release asset custody on the platform.'],
      ref:[['销毁申请编号',app],['资产编号',asset]], go:{key:go}};
  }
  /* M4b · 销毁成功（NT-C06）/ 销毁失败（NT-C10），面客端 */
  function burnC06(id, app, asset, qty, submitted, go, read){
    return {id:id, cat:'progress', at:'2026-10-30T07:15:20Z', read:read,
      t:['销毁成功','Token burn completed'],
      b:['销毁申请 '+app+' 已销毁成功。资产：'+asset+'；申请提交时间：{t:'+submitted+'}；销毁数量：'+qty+' '+Q+'。请等待资产托管机构解除资产托管。',
         'Burn application '+app+' has completed. Asset: '+asset+'; submitted at: {t:'+submitted+'}; quantity burned: '+qty+' '+Q+'. Await release of asset custody by the asset custodian.'],
      ref:[['销毁申请编号',app],['资产编号',asset]], go:{key:go}};
  }
  function burnC10(id, app, asset, submitted, failed, go){
    return {id:id, cat:'progress', at:failed.replace(/:00Z$/,':20Z'), read:true,
      t:['销毁失败','Token burn failed'],
      b:['销毁申请 '+app+' 执行失败。资产：'+asset+'；申请提交时间：{t:'+submitted+'}；失败时间：{t:'+failed+'}。本笔申请已结束；当前仍满足销毁条件时，请重新发起一笔销毁交易。',
         'Burn application '+app+' failed. Asset: '+asset+'; submitted at: {t:'+submitted+'}; failed at: {t:'+failed+'}. This application has ended. If all current conditions are met, initiate a new burn transaction.'],
      ref:[['销毁申请编号',app],['资产编号',asset]], go:{key:go}};
  }
  /* M3b · 发行申请进入铸造（NT-C03），面客端 */
  function mintC03(id, app, at, go){
    return {id:id, cat:'progress', at:at, read:true,
      t:['发行申请已进入铸造','Issuance application entered minting'],
      b:['您的发行申请 '+app+' 已进入铸造，请等待链上结果。',
         'Issuance application '+app+' has entered minting. Please wait for the on-chain result.'],
      ref:[['申请编号',app]], go:go?{key:go}:null};
  }
  /* M5 · 密码变更通知（NT-LG-03）：站内措辞待 M5 定稿，原型暂写 */
  function password(id, kind, at, read){
    var zh = {set:'设置',changed:'修改'}[kind], en = {set:'set',changed:'changed'}[kind];
    return {id:id, cat:'security', at:at, read:read,
      t:['登录密码已'+zh,'Your sign-in password was '+en],
      b:['本账号的登录密码已于 {t:'+at+'} '+zh+'。如非本人操作，请立即联系平台管理员。',
         'The sign-in password for this account was '+en+' at {t:'+at+'}. If you did not do this, contact the platform administrator immediately.']};
  }

  var DATA = {
    /* 管理端 · 运营：全体运营（各自记录已读）+ 本人。共 23 条，第一批 20 条。 */
    ops: [
      password('o01','changed','2026-11-07T02:10:00Z',true),
      Object.assign(burnA06('o02','BA-DEMO-0040','RA-DEMO-0208','12,345.675','2026-11-06T05:31:00Z','非平台入口','burnApplication0040'), {read:false}),
      Object.assign(burnA06('o03','BA-DEMO-0031','RA-DEMO-0201','50,000.00','2026-10-30T07:15:00Z','平台入口','burnApplication0031'), {read:false}),
      burnA06('o04','BA-DEMO-0019','RA-DEMO-0204','65,000.00','2026-10-30T07:15:00Z','平台入口','burnApplication0019'),
      burnA06('o05','BA-DEMO-0018','RA-DEMO-0205','18,000.00','2026-10-30T07:15:00Z','平台入口','burnApplication0018'),
      Object.assign(mintA05('o06','IA-DEMO-0027','2026-10-30T06:30:00Z'), {read:false}),
      mintA03('o07','IA-DEMO-0027','2026-10-30T06:12:00Z'),
      burnA04('o08','BA-DEMO-0024','RA-DEMO-0201','2026-10-28T06:30:00Z','2026-10-28T06:42:00Z','burnApplication0024'),
      Object.assign(burnA04('o09','BA-DEMO-0021','RA-DEMO-0206','2026-10-28T06:30:00Z','2026-10-28T06:40:00Z','burnApplication0021'), {read:false}),
      mintA03('o10','IA-DEMO-0211','2026-06-01T04:10:00Z'),
      mintA05('o11','IA-DEMO-0208','2026-06-01T03:50:00Z'),
      mintA03('o12','IA-DEMO-0208','2026-06-01T03:35:00Z'),
      mintA03('o13','IA-DEMO-0206','2026-06-01T03:20:00Z'),
      mintA03('o14','IA-DEMO-0205','2026-06-01T03:15:00Z'),
      mintA05('o15','IA-DEMO-0204','2026-06-01T03:12:00Z'),
      mintA03('o16','IA-DEMO-0204','2026-06-01T03:10:00Z'),
      mintA03('o17','IA-DEMO-0203','2026-06-01T03:05:00Z'),
      mintA03('o18','IA-DEMO-0202','2026-06-01T03:02:00Z'),
      mintA03('o19','IA-DEMO-0201','2026-06-01T03:00:00Z'),
      password('o20','set','2026-05-20T02:00:00Z',true),
      mintA03('o21','IA-DEMO-0203','2026-05-31T09:20:00Z'),
      mintA03('o22','IA-DEMO-0202','2026-05-31T09:10:00Z'),
      mintA03('o23','IA-DEMO-0201','2026-05-31T09:00:00Z')
    ],
    /* 管理端 · 机构（示例机构 C，资产托管机构）：本机构 + 本人 */
    reg: [
      Object.assign(custodyR02('r01','BA-DEMO-0040','RA-DEMO-0208','12,345.675','2026-11-06T05:31:00Z','burnApplication0040'), {read:false}),
      Object.assign(custodyR02('r02','BA-DEMO-0031','RA-DEMO-0201','50,000.00','2026-10-30T07:15:00Z','burnApplication0031'), {read:false}),
      Object.assign(custodyR02('r03','BA-DEMO-0019','RA-DEMO-0204','65,000.00','2026-10-30T07:15:00Z','burnApplication0019'), {read:false}),
      Object.assign(custodyR02('r04','BA-DEMO-0018','RA-DEMO-0205','18,000.00','2026-10-30T07:15:00Z','burnApplication0018'), {done:true}),
      password('r05','set','2026-05-20T03:00:00Z',true)
    ],
    /* 面客端 · 本企业（有有效企业归属，已认证、未认证均可查看） */
    client: [
      {id:'c01', cat:'progress', at:'2026-10-30T08:20:20Z', read:false,
        t:['资产已解除托管','Asset custody released'],
        b:['资产 RA-DEMO-0205 已解除托管。销毁申请：BA-DEMO-0018；资产托管机构：'+C+'；解除时间：{t:2026-10-30T08:20:00Z}。',
           'Asset custody has been released for asset RA-DEMO-0205. Burn application: BA-DEMO-0018; asset custodian: '+C+'; released at: {t:2026-10-30T08:20:00Z}.'],
        ref:[['销毁申请编号','BA-DEMO-0018'],['资产编号','RA-DEMO-0205']], go:{key:'burnApplication0018'}},
      burnC06('c02','BA-DEMO-0031','RA-DEMO-0201','50,000.00','2026-10-30T06:30:00Z','burnApplication0031',false),
      burnC06('c03','BA-DEMO-0019','RA-DEMO-0204','65,000.00','2026-10-28T06:30:00Z','burnApplication0019',true),
      burnC06('c04','BA-DEMO-0018','RA-DEMO-0205','18,000.00','2026-10-28T06:30:00Z','burnApplication0018',true),
      {id:'c05', cat:'progress', at:'2026-10-30T06:25:20Z', read:false,
        t:['代币铸造成功','Token minting succeeded'],
        b:['发行申请 IA-DEMO-0019 已铸造成功，代币编号为 DEMO-TOKEN-001，数量为 36,000.00 '+Q+'。',
           'Issuance application IA-DEMO-0019 was minted successfully. Token ID: DEMO-TOKEN-001; quantity: 36,000.00 '+Q+'.'],
        ref:[['代币编号','DEMO-TOKEN-001'],['申请编号','IA-DEMO-0019']], go:{key:'tokenDemo001'}},
      mintC03('c06','IA-DEMO-0019','2026-10-30T06:20:20Z','assetApplication0102'),
      {id:'c07', cat:'progress', at:'2026-10-30T06:20:20Z', read:false,
        t:['发行申请已驳回','Issuance application rejected'],
        b:['您的发行申请 IA-DEMO-0012 已被驳回。驳回意见：【演示意见】贸易合同记载的订单编号与销售发票对应的编号不一致，交付凭证中的债务人名称也与申请记录存在差异。请核实资产材料中的贸易合同、销售发票及交付凭证，确保相关信息能够相互对应。',
           'Issuance application IA-DEMO-0012 has been rejected. Reason (original text): 【演示意见】贸易合同记载的订单编号与销售发票对应的编号不一致，交付凭证中的债务人名称也与申请记录存在差异。请核实资产材料中的贸易合同、销售发票及交付凭证，确保相关信息能够相互对应。'],
        ref:[['申请编号','IA-DEMO-0012']], go:{key:'assetApplication0160'}},
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
  var LIST = {client:'list', ops:'o-list', reg:'r-list'}, PREVIEW = {client:'preview', ops:'o-preview', reg:'r-preview'};
  var BY_WHO = {certified:'client', uncertified:'client', ops:'ops', opsnew:'ops', reg:'reg', regoff:'reg', regnew:'reg'};

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
      '<span class="msg-meta">'+meta(m)+'</span>'+
      '<span class="msg-summary">'+body(m)+'</span>'+(opts.compact?when:'')+'</span>'+
      '<span class="msg-side">'+(read?'<span class="tag">已读</span>':'<span class="tag accent">未读</span>')+
      (opts.compact?'':when)+'</span></button></li>';
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
