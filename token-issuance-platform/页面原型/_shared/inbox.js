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
  var A = '示例企业 A 有限公司', C = '示例监管机构 C';
  function issueA01(id, app, asset, value, at){
    return {id:id, cat:'review', at:at, read:true,
      t:['有发行申请待二审','Issuance application awaiting second review'],
      b:[A+' 的发行申请 '+app+'（资产 '+asset+'，资产价值 '+value+'）已于 {t:'+at+'} 由 '+C+' 审核通过。请进行二审。',
         'Issuance application '+app+' from '+A+' (asset '+asset+', asset value '+value+') was approved by '+C+' at {t:'+at+'}. Please complete the second review.'],
      ref:[['申请编号',app],['资产编号',asset]]};
  }
  function burnA02(id, app, asset, qty, at, go){
    return {id:id, cat:'review', at:at, read:true,
      t:['新的销毁申请','New token burn application'],
      b:['企业 '+A+' 已提交销毁申请 '+app+'。资产：'+asset+'；代币数量：'+qty+'；提交时间：{t:'+at+'}。请前往审核。',
         A+' has submitted token burn application '+app+'. Asset: '+asset+'; token quantity: '+qty+'; submitted at: {t:'+at+'}. Review this application.'],
      ref:[['销毁申请编号',app],['资产编号',asset]], go:go?{key:go}:null};
  }
  function regR01(id, app, asset, value, at){
    return {id:id, cat:'review', at:at, read:true,
      t:['有新的发行申请待审核','New issuance application to review'],
      b:[A+' 提交了代币发行申请 '+app+'，资产 '+asset+'，资产价值 '+value+'，提交时间 {t:'+at+'}。请进行一审。',
         A+' submitted token issuance application '+app+' for asset '+asset+' with an asset value of '+value+', at {t:'+at+'}. Please complete the first review.'],
      ref:[['申请编号',app],['资产编号',asset]]};
  }
  function regR02(id, app, asset, qty, at, go){
    return {id:id, cat:'review', at:'2026-10-30T07:15:20Z', read:true,
      t:['代币已销毁，待解除监管','Token burned; release of supervision required'],
      b:['企业 '+A+' 的代币已销毁。销毁申请：'+app+'；资产：'+asset+'；销毁数量：'+qty+'；销毁时间：{t:'+at+'}。请在平台办理解除监管。',
         'Tokens for '+A+' have been burned. Burn application: '+app+'; asset: '+asset+'; quantity burned: '+qty+'; burned at: {t:'+at+'}. Release supervision on the platform.'],
      ref:[['销毁申请编号',app],['资产编号',asset]], go:{key:go}};
  }
  function burnC06(id, app, asset, qty, submitted, go, read){
    return {id:id, cat:'progress', at:'2026-10-30T07:15:20Z', read:read,
      t:['销毁成功','Token burn completed'],
      b:['销毁申请 '+app+' 已销毁成功。资产：'+asset+'；申请提交时间：{t:'+submitted+'}；销毁数量：'+qty+'。请等待原监管机构解除监管。',
         'Burn application '+app+' has completed. Asset: '+asset+'; application submitted at: {t:'+submitted+'}; quantity burned: '+qty+'. Await release of supervision by the original regulator.'],
      ref:[['销毁申请编号',app],['资产编号',asset]], go:{key:go}};
  }
  function issueC01(id, app, asset, at, go, read){
    return {id:id, cat:'progress', at:at, read:read,
      t:['监管机构已审核通过','Regulator approved your application'],
      b:['发行申请 '+app+'（资产 '+asset+'）已由 '+C+' 审核通过，现等待平台运营审核。监管协议已可在申请中查看和下载。',
         'Issuance application '+app+' (asset '+asset+') has been approved by '+C+' and is now awaiting platform review. The regulatory agreement is available to view and download in the application.'],
      ref:[['申请编号',app],['资产编号',asset]], go:go?{key:go}:null};
  }
  function issueC03(id, app, asset, at, go){
    return {id:id, cat:'progress', at:at, read:true,
      t:['平台已审核通过，发行处理中','Platform approved, issuance in progress'],
      b:['发行申请 '+app+'（资产 '+asset+'）已由平台运营审核通过，现进入发行处理，结果将另行通知。',
         'Issuance application '+app+' (asset '+asset+') has been approved by the platform and is now being processed for issuance. You will be notified of the result.'],
      ref:[['申请编号',app],['资产编号',asset]], go:{key:go}};
  }
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
      password('o01','changed','2026-11-04T02:10:00Z',true),
      {id:'o02', cat:'alert', at:'2026-10-30T07:10:20Z', read:false,
        t:['销毁失败，待手动重试','Token burn failed; manual retry required'],
        b:['企业 '+A+' 的销毁申请 BA-DEMO-0021 执行失败。资产：RA-DEMO-0206；申请提交时间：{t:2026-10-28T06:30:00Z}；失败时间：{t:2026-10-30T07:10:00Z}。请核对当前条件后手动重试。失败说明：链上交易未执行成功。',
           'Burn application BA-DEMO-0021 for '+A+' failed. Asset: RA-DEMO-0206; application submitted at: {t:2026-10-28T06:30:00Z}; failed at: {t:2026-10-30T07:10:00Z}. Check the current conditions and retry manually. Failure details: 链上交易未执行成功。'],
        ref:[['销毁申请编号','BA-DEMO-0021'],['资产编号','RA-DEMO-0206']], go:{key:'burnApplication0021'}},
      Object.assign(issueA01('o03','IA-DEMO-0031','RA-DEMO-0131','82,400.00 USD','2026-10-30T07:00:20Z'), {read:false, go:{key:'reviewApplication'}}),
      issueA01('o04','IA-DEMO-0019','RA-DEMO-0102','36,000.00 USD','2026-10-30T07:00:20Z'),
      Object.assign(burnA02('o05','BA-DEMO-0031','RA-DEMO-0201','50,000.00 cou','2026-10-30T06:30:20Z','burnApplication0031'), {done:true}),
      {id:'o06', cat:'alert', at:'2026-10-30T06:30:20Z', read:false,
        t:['代币铸造超时，待处理','Token minting timed out, action needed'],
        b:[A+' 的发行申请 IA-DEMO-0027（资产 RA-DEMO-0143）于 {t:2026-10-30T06:20:00Z} 开始铸造，超过 10 分钟仍未取得链上结果，申请仍为铸造中。请线下联系开发人员处理。',
           'Minting for issuance application IA-DEMO-0027 from '+A+' (asset RA-DEMO-0143) started at {t:2026-10-30T06:20:00Z} and has had no on-chain result for over 10 minutes. The application is still minting. Please contact the developers offline.'],
        ref:[['申请编号','IA-DEMO-0027'],['资产编号','RA-DEMO-0143']]},
      issueA01('o07','IA-DEMO-0027','RA-DEMO-0143','27,500.00 USD','2026-10-30T03:00:20Z'),
      Object.assign(burnA02('o08','BA-DEMO-0030','RA-DEMO-0203','24,300.00 cou','2026-10-28T06:30:20Z','burnApplication0030'), {read:false}),
      Object.assign(burnA02('o09','BA-DEMO-0024','RA-DEMO-0201','50,000.00 cou','2026-10-28T06:30:20Z','burnApplication0024'), {done:true}),
      Object.assign(burnA02('o10','BA-DEMO-0021','RA-DEMO-0206','32,000.00 cou','2026-10-28T06:30:20Z','burnApplication0021'), {done:true}),
      Object.assign(burnA02('o11','BA-DEMO-0019','RA-DEMO-0204','65,000.00 cou','2026-10-28T06:30:20Z','burnApplication0019'), {done:true}),
      Object.assign(burnA02('o12','BA-DEMO-0018','RA-DEMO-0205','18,000.00 cou','2026-10-28T06:30:20Z','burnApplication0018'), {done:true}),
      {id:'o13', cat:'alert', at:'2026-06-01T03:10:20Z', read:true,
        t:['代币铸造失败，待重试','Token minting failed, retry needed'],
        b:[A+' 的发行申请 IA-DEMO-0204（资产 RA-DEMO-0204）于 {t:2026-06-01T03:10:00Z} 铸造失败。失败说明：链上交易未执行成功。请在申请中手动重试。',
           'Minting for issuance application IA-DEMO-0204 from '+A+' (asset RA-DEMO-0204) failed at {t:2026-06-01T03:10:00Z}. Details: 链上交易未执行成功。 Please retry manually in the application.'],
        ref:[['申请编号','IA-DEMO-0204'],['资产编号','RA-DEMO-0204']]},
      issueA01('o14','IA-DEMO-0206','RA-DEMO-0206','32,000.00 USD','2026-06-01T02:00:20Z'),
      issueA01('o15','IA-DEMO-0205','RA-DEMO-0205','18,000.00 USD','2026-06-01T01:50:20Z'),
      issueA01('o16','IA-DEMO-0204','RA-DEMO-0204','65,000.00 USD','2026-06-01T01:40:20Z'),
      issueA01('o17','IA-DEMO-0203','RA-DEMO-0203','24,300.00 USD','2026-06-01T01:30:20Z'),
      issueA01('o18','IA-DEMO-0202','RA-DEMO-0202','72,500.00 USD','2026-06-01T01:20:20Z'),
      issueA01('o19','IA-DEMO-0201','RA-DEMO-0201','50,000.00 USD','2026-06-01T01:10:20Z'),
      password('o20','set','2026-05-20T02:00:00Z',true),
      issueA01('o21','IA-DEMO-0013','RA-DEMO-0083','15,800.00 USD','2026-05-18T02:00:20Z'),
      issueA01('o22','IA-DEMO-0012','RA-DEMO-0082','40,000.00 USD','2026-05-16T02:00:20Z'),
      issueA01('o23','IA-DEMO-0011','RA-DEMO-0081','12,600.00 USD','2026-05-14T02:00:20Z')
    ],
    /* 管理端 · 监管机构：本机构 + 本人 */
    reg: [
      Object.assign(regR02('r01','BA-DEMO-0031','RA-DEMO-0201','50,000.00 cou','2026-10-30T07:15:00Z','burnApplication0031'), {read:false}),
      Object.assign(regR02('r02','BA-DEMO-0019','RA-DEMO-0204','65,000.00 cou','2026-10-30T07:15:00Z','burnApplication0019'), {read:false}),
      Object.assign(regR02('r03','BA-DEMO-0018','RA-DEMO-0205','18,000.00 cou','2026-10-30T07:15:00Z','burnApplication0018'), {done:true}),
      Object.assign(regR01('r04','IA-DEMO-0031','RA-DEMO-0131','82,400.00 USD','2026-10-29T05:15:00Z'), {go:{key:'reviewApplication'}, done:true}),
      regR01('r05','IA-DEMO-0027','RA-DEMO-0143','27,500.00 USD','2026-10-28T01:15:00Z'),
      regR01('r06','IA-DEMO-0019','RA-DEMO-0102','36,000.00 USD','2026-10-27T05:15:00Z'),
      regR01('r07','IA-DEMO-0015','RA-DEMO-0097','24,800.00 USD','2026-10-26T05:15:00Z'),
      password('r08','set','2026-05-20T03:00:00Z',true)
    ],
    /* 面客端 · 本企业（已认证、未认证均可查看） */
    client: [
      {id:'c01', cat:'progress', at:'2026-10-30T10:25:20Z', read:false,
        t:['代币铸造成功','Tokens minted'],
        b:['发行申请 IA-DEMO-0019（资产 RA-DEMO-0102）的代币已铸造成功：36,000.00 cou，已到账 登录地址，到期日 {d:2027-01-31T19:59:59Z}。该笔资产已进入监管。',
           'Tokens for issuance application IA-DEMO-0019 (asset RA-DEMO-0102) have been minted: 36,000.00 cou to Login address, maturing on {d:2027-01-31T19:59:59Z}. The asset is now under regulatory supervision.'],
        ref:[['申请编号','IA-DEMO-0019'],['资产编号','RA-DEMO-0102']], go:{key:'assetApplication0102'}},
      issueC03('c02','IA-DEMO-0019','RA-DEMO-0102','2026-10-30T10:20:20Z','assetApplication0102'),
      {id:'c03', cat:'progress', at:'2026-10-30T08:20:20Z', read:false,
        t:['资产已解除监管','Asset supervision released'],
        b:['资产 RA-DEMO-0205 已解除监管。销毁申请：BA-DEMO-0018；监管机构：'+C+'；解除时间：{t:2026-10-30T08:20:00Z}。',
           'Supervision has been released for asset RA-DEMO-0205. Burn application: BA-DEMO-0018; regulator: '+C+'; released at: {t:2026-10-30T08:20:00Z}.'],
        ref:[['销毁申请编号','BA-DEMO-0018'],['资产编号','RA-DEMO-0205']], go:{key:'burnApplication0018'}},
      burnC06('c04','BA-DEMO-0031','RA-DEMO-0201','50,000.00 cou','2026-10-30T06:30:00Z','burnApplication0031',false),
      burnC06('c05','BA-DEMO-0019','RA-DEMO-0204','65,000.00 cou','2026-10-28T06:30:00Z','burnApplication0019',true),
      burnC06('c06','BA-DEMO-0018','RA-DEMO-0205','18,000.00 cou','2026-10-28T06:30:00Z','burnApplication0018',true),
      issueC01('c07','IA-DEMO-0031','RA-DEMO-0131','2026-10-30T07:00:20Z','assetApplication0131',false),
      issueC01('c08','IA-DEMO-0019','RA-DEMO-0102','2026-10-30T07:00:20Z','assetApplication0102',true),
      {id:'c09', cat:'progress', at:'2026-10-30T07:00:20Z', read:true,
        t:['监管机构已驳回申请','Regulator rejected your application'],
        b:['发行申请 IA-DEMO-0015（资产 RA-DEMO-0097）已被 '+C+' 驳回，驳回意见：申请材料中的贸易订单与应收账款信息不一致，请核实订单编号、债务人名称及交付凭证。申请已终止，这笔资产不能再次发起发行申请。',
           'Issuance application IA-DEMO-0015 (asset RA-DEMO-0097) was rejected by '+C+'. Reason: 申请材料中的贸易订单与应收账款信息不一致，请核实订单编号、债务人名称及交付凭证。 The application is closed, and this asset cannot be used for another issuance application.'],
        ref:[['申请编号','IA-DEMO-0015'],['资产编号','RA-DEMO-0097']], go:{key:'assetApplication0097'}},
      issueC03('c10','IA-DEMO-0027','RA-DEMO-0143','2026-10-30T06:20:20Z','assetApplication0027'),
      issueC01('c11','IA-DEMO-0027','RA-DEMO-0143','2026-10-30T03:00:20Z','assetApplication0027',true),
      {id:'c12', cat:'progress', at:'2026-10-28T08:00:20Z', read:true,
        t:['销毁申请驳回','Token burn application rejected'],
        b:['销毁申请 BA-DEMO-0024 已被驳回。资产：RA-DEMO-0201；申请提交时间：{t:2026-10-28T06:30:00Z}；驳回意见：请核对资产结清情况后重新申请。满足当前销毁条件时可再次申请销毁。',
           'Burn application BA-DEMO-0024 was rejected. Asset: RA-DEMO-0201; application submitted at: {t:2026-10-28T06:30:00Z}; reason: 请核对资产结清情况后重新申请。 You may submit a new application when the current burn conditions are met.'],
        ref:[['销毁申请编号','BA-DEMO-0024'],['资产编号','RA-DEMO-0201']], go:{key:'burnApplication0024'}},
      {id:'c13', cat:'compliance', at:'2026-10-20T02:00:00Z', read:true,
        t:['认证状态已变更','Verification status changed'],
        b:['你的认证状态已变更，代币发行等业务暂不可用。你仍可查看用户信息、企业信息和消息。请前往资产可信平台查看当前认证状态。',
           'Your verification status has changed. Token issuance and other business actions are temporarily unavailable. You can still view your user information, company information and messages. Visit the Asset Trust Platform to check your current verification status.'],
        go:{key:'me', page:'前往用户信息'}},
      Object.assign(issueC01('c14','IA-DEMO-0008','RA-DEMO-0064','2026-05-12T03:00:20Z',null,true), {denied:true})
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
    }).join('');
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
  function panel(who, state, hidden){
    var role = BY_WHO[who], rows = (DATA[role]||[]).slice(0,10), sc = screens(who), list = sc.list;
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
      '<div class="inbox-h"><h2>最近消息</h2></div>'+inner+all+'</div>';
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
    '申请编号':'Application ID','资产编号':'Asset ID','销毁申请编号':'Burn application ID',
    '登录地址':'Login address','前往用户信息':'Go to user information'
  });
})(window.TP = window.TP || {});
