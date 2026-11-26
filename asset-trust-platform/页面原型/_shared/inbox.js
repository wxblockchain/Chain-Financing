/* ==========================================================================
   inbox.js — 消息入口（M10 消息中心）：顶栏铃铛的未读数与最近消息预览，以及两端的演示消息。
   基线：代币发行平台 _shared/inbox.js（M7 消息通知）。本平台改动：分类按 M10 PRD §4.2（四类，另有“其他”兜底）；
   消息取自现行来源模块 03 消息通知册（M7a-NT01～03、M7b-NT01～03、M8-NT01～02、M9-NT01、M9-NT03、M15-NT01）；无“认证引导”“固定页面”去向。
   各模块在 menu.*.js 之后加载，由 frame.js 渲染到顶栏；入驻未完成、受限登录（首登改密）不显示消息入口。
   不发送、不计算、不保存已读：未读数取本份演示数据，画面可用 data-unread 指定本屏的值。
   规则（收件范围、送达、已读、全部已读、前往原业务）以 PRD 两端共用/M10-消息中心 为准。
   ========================================================================== */
(function(TP){
  'use strict';
  var esc = function(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };

  /* 两端同一套分类（运营告警只用于运营端）；“其他”只是无法识别时的兜底，不是可选分类 */
  var CATS = {progress:'业务办理进度', reminder:'业务提醒', pending:'待处理事项', alert:'运营告警', other:'其他'};
  var SCOPE = '此入口在单模块附件中不展开，请在完整原型的 index.html 中打开。';

  /* 消息：id · 分类 · 发生时间 · 演示时的阅读状态 · 中英文标题与正文 · 原业务识别信息 · 去向。
     正文中 {t:ISO} 为按所选时区展示的时间。企业名称、内销发票号、驳回原因按原值展示，中英文正文都不翻译。
     ref 第三项为 'text' 时按界面语言展示（如规则名称、接口名称），否则为等宽编号。
     go.key 为原业务的路由键（登记在来源模块 route.js）；done 表示原动作已办完或已不适用，前往后只能查看当前结果；
     denied 表示原业务不存在或本人无权查看。演示中的企业、编号、金额、时间均为演示数据。 */
  var NG = 'Carloha Nigeria', SB = 'Demo Supplier B Ltd.';
  function appRef(app, inv){ return [['申请编号',app],['内销发票号',inv]]; }

  /* M7a-NT01 收到新的确权申请（待处理事项，发给债务人企业）→ M7b 申请详情 */
  function m7a01(id, app, creditor, inv, ar, amt, at, read){
    return {id:id, cat:'pending', at:at, read:read,
      t:['收到新的确权申请','New confirmation request received'],
      b:[creditor+' 就发票 '+inv+'（应收账款编号 '+ar+'，金额 '+amt+' USD）向贵企业发起确权申请，申请编号 '+app+'。贵企业在这笔业务中是债务人，请核对后确认或驳回。',
         creditor+' has submitted a confirmation request to your company for invoice '+inv+' (receivable '+ar+', amount '+amt+' USD). Request number: '+app+'. Your company is the debtor in this transaction. Please review it and confirm or reject.'],
      ref:appRef(app, inv), go:{key:'m7b-'+app}};
  }
  /* M7a-NT02 确权申请已到期关闭（业务办理进度，发给债权人企业）→ M7a 申请详情（只能查看） */
  function m7a02(id, app, inv, ar, stage, at, read){
    var en = stage==='待运营审核' ? 'awaiting operations review' : 'awaiting debtor confirmation';
    return {id:id, cat:'progress', at:at, read:read,
      t:['确权申请已到期关闭','Confirmation request closed on expiry'],
      b:['贵企业就发票 '+inv+'（应收账款编号 '+ar+'）发起的确权申请 '+app+' 在'+stage+'期间，因应收账款已到期，已自动关闭。贵企业在这笔业务中是债权人。该应收账款已到期，不能再发起确权申请。',
         'Confirmation request '+app+' submitted by your company for invoice '+inv+' (receivable '+ar+') was closed automatically while '+en+', because the receivable has passed its due date. Your company is the creditor in this transaction. A new confirmation request cannot be submitted for this receivable.'],
      ref:appRef(app, inv), go:{key:'m7a-'+app}};
  }
  /* M7a-NT03 待确认的确权申请已到期关闭（业务办理进度，发给债务人企业）→ M7b 申请详情（只能查看） */
  function m7a03(id, app, creditor, inv, ar, at, read){
    return {id:id, cat:'progress', at:at, read:read, done:true,
      t:['待确认的确权申请已到期关闭','Pending confirmation request closed on expiry'],
      b:[creditor+' 就发票 '+inv+'（应收账款编号 '+ar+'）发给贵企业的确权申请 '+app+'，因应收账款已到期，已自动关闭。贵企业在这笔业务中是债务人，无需再处理。',
         'Confirmation request '+app+' sent to your company by '+creditor+' for invoice '+inv+' (receivable '+ar+') was closed automatically because the receivable has passed its due date. Your company is the debtor in this transaction; no further action is needed.'],
      ref:appRef(app, inv), go:{key:'m7b-'+app}};
  }
  /* M7b-NT01 确权申请已被债务人确认（业务办理进度，发给债权人企业）→ M7a 申请详情 */
  function m7b01(id, app, debtor, inv, ar, at, read){
    return {id:id, cat:'progress', at:at, read:read,
      t:['确权申请已被债务人确认','Confirmation request confirmed by debtor'],
      b:[debtor+' 已确认贵企业就内销发票 '+inv+'（应收账款编号 '+ar+'）发起的确权申请 '+app+'。贵企业在这笔业务中是债权人。申请已进入运营审核。',
         debtor+' has confirmed confirmation request '+app+' submitted by your company for invoice '+inv+' (receivable '+ar+'). Your company is the creditor in this transaction. The request is now awaiting operations review.'],
      ref:appRef(app, inv), go:{key:'m7a-'+app}};
  }
  /* M7b-NT02 确权申请被债务人驳回（业务办理进度，发给债权人企业）→ M7a 申请详情；驳回原因按原文展示 */
  function m7b02(id, app, debtor, inv, ar, reason, at, read){
    return {id:id, cat:'progress', at:at, read:read,
      t:['确权申请被债务人驳回','Confirmation request rejected by debtor'],
      b:[debtor+' 驳回了贵企业就内销发票 '+inv+'（应收账款编号 '+ar+'）发起的确权申请 '+app+'。驳回原因：'+reason+'。贵企业在这笔业务中是债权人。该应收账款满足申请条件时可以重新发起确权申请。',
         debtor+' has rejected confirmation request '+app+' submitted by your company for invoice '+inv+' (receivable '+ar+'). Reason: '+reason+'. Your company is the creditor in this transaction. You can submit a new confirmation request when the receivable meets the request conditions.'],
      ref:appRef(app, inv), go:{key:'m7a-'+app}};
  }
  /* M7b-NT03 有新的确权申请待运营审核（待处理事项，全体运营）→ M9 审核详情；到期日按 M3 计算的日期，不带时区 */
  function m7b03(id, app, inv, ar, amt, ccy, due, at, read){
    return {id:id, cat:'pending', at:at, read:read,
      t:['有新的确权申请待运营审核','New confirmation request awaiting review'],
      b:['债务人 '+NG+' 已确认债权人 Carloha Holding 就内销发票 '+inv+'（应收账款编号 '+ar+'，金额 '+amt+' '+ccy+'，到期日 '+due+'）发起的确权申请 '+app+'，请进行运营审核。应收账款到期时仍未审核通过的申请将自动关闭。',
         'Debtor '+NG+' has confirmed confirmation request '+app+' submitted by creditor Carloha Holding for invoice '+inv+' (receivable '+ar+', amount '+amt+' '+ccy+', due date '+due+'). Please review it. Requests not approved by the receivable\'s due date will be closed automatically.'],
      ref:appRef(app, inv), go:{key:'m9-'+app}};
  }
  /* M9-NT01 运营审核已通过（业务办理进度，发给债权人企业）→ M7a 申请详情（只能查看）；审核提交上链成功时发送，文案按 M9 03 册（5d2ec4f3） */
  function m9a(id, app, debtor, inv, ar, at, read){
    return {id:id, cat:'progress', at:at, read:read,
      t:['运营审核已通过','Operations review approved'],
      b:['贵企业就内销发票 '+inv+'（应收账款编号 '+ar+'）向 '+debtor+' 发起的确权申请 '+app+' 已通过运营审核，审核通过的资料已上链存证。贵企业在这笔业务中是债权人。详情可在申请详情中查看。',
         'Confirmation request '+app+' submitted by your company to '+debtor+' for invoice '+inv+' (receivable '+ar+') has been approved by operations, and the approved records have been recorded on chain. Your company is the creditor in this transaction. You can view the details in the request details.'],
      ref:appRef(app, inv), go:{key:'m7a-'+app}};
  }
  /* M9-NT03 运营审核上链失败（运营告警，全体运营）→ M9 申请详情；失败原因按原文，申请仍为待运营审核 */
  function m9c(id, app, inv, ar, attempt, reason, at, read){
    /* 失败原因：万纳连返回的原文不翻译（字符串）；超时为平台文案，随界面语言（[中文, English]） */
    if(typeof reason==='string') reason=[reason, reason];
    return {id:id, cat:'alert', at:at, read:read,
      t:['运营审核上链失败','Review on-chain recording failed'],
      b:['债权人 Carloha Holding 的内销发票 '+inv+'（应收账款编号 '+ar+'，确权申请 '+app+'）第 '+attempt+' 次审核提交上链失败，原因：'+reason[0]+'。这笔申请尚未审核通过，仍为待运营审核，请查看后重新审核通过。',
         'On-chain recording for review submission '+attempt+' of creditor Carloha Holding\'s invoice '+inv+' (receivable '+ar+', confirmation request '+app+') failed. Reason: '+reason[1]+'. The request has not been approved and is still pending operations review. Please review it and approve again.'],
      ref:appRef(app, inv), go:{key:'m9-'+app}};
  }
  /* M8-NT01 新的风控预警（运营告警，全体运营）→ M8 预警详情。只有阻断、预警等级发消息；标题与正文随等级。
     规则名称随界面语言（英文名按 M8 03 册“规则与等级的英文名称”）；预警编号、主体名称、单据编号、VIN 按原值。
     比较对象、差异摘要、关联应收账款按 M8 预警详情的演示数据，取预警生成时的值。 */
  var RULE = {'RK-01':['VIN 重复','Duplicate VIN'], 'RK-03':['发票金额与车辆明细不一致','Invoice amount does not match vehicle details'],
    'RK-10':['回款风险','Repayment risk'], 'RK-14':['内销收款主体不一致','Repayment parties mismatch'],
    'RK-16':['外销单价低于内采单价','Export price below domestic price'], 'RK-20':['外采付款主体不一致','Purchase payment parties mismatch'],
    'RK-26':['BL 信息与外部数据不一致','B/L information differs from external data']};
  function m8(id, w, lv, rk, obj, diff, recv, at, read){
    var R = RULE[rk], block = lv==='block';
    return {id:id, cat:'alert', at:at, read:read,
      t:[block ? '新的风控预警（阻断）：'+R[0] : '新的风控预警：'+R[0], block ? 'New risk alert (blocking): '+R[1] : 'New risk alert: '+R[1]],
      b:['平台比对发现'+R[0]+'，预警编号 '+w+'，等级：'+(block?'阻断':'预警')+'。比较对象：'+obj[0]+'。差异：'+R[0]+'：'+diff[0]+'。关联应收账款：'+recv[0]+'。'+
           (block ? '阻断存在期间，关联应收账款不能运营审核通过。请核实差异，按规则说明的方式更正资料；差异消除后阻断自动解除，无需在平台记录处理。' : '请核实后记录处理结果；预警不会自动阻止确权申请或运营审核。'),
         'The platform has found "'+R[1]+'". Alert number '+w+', level: '+(block?'Blocking':'Warning')+'. Compared item: '+obj[1]+'. Difference: '+R[1]+': '+diff[1]+'. Related receivables: '+recv[1]+'. '+
           (block ? 'While this alert remains, the related receivables cannot pass operations review. Please verify the difference and have the data corrected as the rule describes; the block is lifted automatically once the difference is resolved, and no handling needs to be recorded.' : 'Please verify and record the result; this alert does not automatically block confirmation requests or operations review.')],
      ref:[['预警编号',w],['规则名称',R[0],'text']], go:{key:'m8-'+w}};
  }
  /* M8-NT02 风控规则已调整（业务提醒，全体运营，含调整人本人）→ M8 规则详情（配置记录）。
     调整人姓名、调整原因按原文；等级、规则名称随界面语言。演示值按 M8 规则详情 R6 / R7 的配置记录。 */
  var LEVEL = {'预警':'Warning', '阻断':'Blocking'};
  function m8level(id, rk, by, from, to, reason, affected, at, read){
    var R = RULE[rk];
    return {id:id, cat:'reminder', at:at, read:read,
      t:['风控规则已调整：'+R[0], 'Risk rule changed: '+R[1]],
      b:[by+' 将风控规则“'+R[0]+'（'+rk+'）”的等级由'+from+'调整为'+to+'，立即生效。原因：'+reason+'。'+(affected?'受影响的待运营审核申请 '+affected[0]+' 笔。':''),
         by+' changed the level of risk rule "'+R[1]+' ('+rk+')" from '+LEVEL[from]+' to '+LEVEL[to]+', effective immediately. Reason: '+reason+'.'+(affected?' Affected requests awaiting review: '+affected[0]+'.':'')],
      ref:[['规则编号',rk],['规则名称',R[0],'text']], go:{key:'rule:'+rk}};
  }
  function m8off(id, rk, by, reason, at, read){
    var R = RULE[rk];
    return {id:id, cat:'reminder', at:at, read:read,
      t:['风控规则已停用：'+R[0], 'Risk rule disabled: '+R[1]],
      b:[by+' 停用了风控规则“'+R[0]+'（'+rk+'）”，立即生效。原因：'+reason+'。该规则 1 条未处理预警已关闭，其预警不再产生作用。',
         by+' disabled risk rule "'+R[1]+' ('+rk+')", effective immediately. Reason: '+reason+'. 1 open alert under this rule has been closed, and its alerts no longer have any effect.'],
      ref:[['规则编号',rk],['规则名称',R[0],'text']], go:{key:'rule:'+rk}};
  }
  /* M15-NT01 数据接入异常（运营告警，全体运营）→ M15 该接口的调用记录。接口名称、数据来源、承接模块随界面语言；
     失败原因按原文，但不出现接口地址、账号与密钥只显示遮盖后的内容（M15 PRD dcb9f2cd）。接口与 M15 原型演示清单一致。 */
  var IFACE = {BL:['提单','Bills of lading','提单信息（M12）','Bills of lading (M12)'],
    PL:['保单','Insurance policies','保单信息（M13）','Policy information (M13)'],
    PM:['收付款','Payments & receipts','资金收付（M14）','Payments & receipts (M14)'],
    PC:['外采合同','Purchase contracts','合同信息（M4）','Contracts (M4)'],
    DI:['内销发票','Domestic invoices','应收账款（M3）','Receivables (M3)']};
  function m15(id, code, reason, failAt, lastOk, read){
    var I = IFACE[code];
    return {id:id, cat:'alert', at:failAt, read:read,
      t:['数据接入异常：'+I[0], 'Data intake failure: '+I[1]],
      b:['客户 ERP 接口“'+I[0]+'”（承接模块：'+I[2]+'）于 {t:'+failAt+'} 调用失败，原因：'+reason+'。最近成功时间：{t:'+lastOk+'}。接口恢复前，这类单据的新数据不会进入平台，请查看调用记录。',
         'The customer ERP interface "'+I[1]+'" (used by: '+I[3]+') failed at {t:'+failAt+'}. Reason: '+reason+'. Last successful call: {t:'+lastOk+'}. New data of this type will not reach the platform until the interface recovers. Please review the call records.'],
      ref:[['接口名称',I[0],'text'],['数据来源','客户 ERP','text']], go:{key:'interface:'+code}};
  }
  var REASON = '【演示意见】销售清单中第 2 辆车的 VIN 与我方收货记录不一致，请核对后重新发起';

  var DATA = {
    /* 企业端 · 本企业（同时有债权人、债务人角色，一个信箱、一个未读数）。11 条，4 条未读。 */
    client: [
      m7b01('c01','AP-DEMO-0024',NG,'INV-0019','AR-DEMO-0019','2026-11-10T09:30:00Z',false),
      m7a01('c02','AP-DEMO-0041',SB,'INV-0107','AR-DEMO-0107','36,500.00','2026-11-10T08:15:00Z',false),
      m7b02('c03','AP-DEMO-0028',NG,'INV-0012','AR-DEMO-0012',REASON,'2026-11-04T14:20:00Z',false),
      m7a03('c04','AP-DEMO-0036',SB,'INV-0103','AR-DEMO-0103','2026-11-02T23:00:00Z',true),
      Object.assign(m7a02('c05','AP-DEMO-0026','INV-0008','AR-DEMO-0008','待运营审核','2026-10-31T23:00:00Z',false), {done:true}),
      /* AP-DEMO-0022 第 1 次审核提交上链失败（o11），再次提交后上链成功 */
      m9a('c06','AP-DEMO-0022',NG,'INV-0011','AR-DEMO-0011','2026-10-30T04:52:00Z',true),
      m7a01('c07','AP-DEMO-0039',SB,'INV-0105','AR-DEMO-0105','41,200.00','2026-10-28T07:40:00Z',true),
      m7b01('c08','AP-DEMO-0026',NG,'INV-0008','AR-DEMO-0008','2026-10-20T09:00:00Z',true),
      /* AP-DEMO-0036 后已到期关闭（c04）：已读不代表已办理，前往后只能查看当前结果 */
      Object.assign(m7a01('c09','AP-DEMO-0036',SB,'INV-0103','AR-DEMO-0103','25,800.00','2026-10-12T10:05:00Z',true), {done:true}),
      m7b01('c10','AP-DEMO-0021',NG,'INV-0005','AR-DEMO-0005','2026-09-12T03:00:00Z',true),
      m9a('c11','AP-DEMO-0021',NG,'INV-0005','AR-DEMO-0005','2026-09-15T06:00:00Z',true)
    ],
    /* 运营端 · 全体运营（各自记录已读）。24 条，6 条未读，第一批 20 条（o23 未读，属于尚未加载的部分）。
       预警、规则、接口与 M8、M15 原型的演示数据一致；申请与 M7b、M9 一致。 */
    ops: [
      m8level('o01','RK-16','运营示例账号','预警','阻断','外销倒挂多为垫资套现信号，按风控会议要求在运营审核前拦截',[1],'2026-12-14T04:10:00Z',false),
      m8off('o02','RK-26','运营示例账号','外部航程跟踪数据航次编号规则与船公司不同，误报较多，待研发核对数据源后再启用','2026-12-14T03:00:00Z',true),
      m8('o03','W-DEMO-0009','block','RK-01',['VIN LDEMOVIN000000001','VIN LDEMOVIN000000001'],
        ['LDEMOVIN000000001 同时占用 AR-DEMO-0012、AR-DEMO-0020','LDEMOVIN000000001 is used by both AR-DEMO-0012 and AR-DEMO-0020'],
        ['AR-DEMO-0012，共 2 笔','AR-DEMO-0012, 2 in total'],'2026-12-12T09:30:00Z',false),
      /* 生成时剩余 7 天；之后数值更新不改写消息 */
      m8('o04','W-DEMO-0011','warn','RK-10',['应收账款 AR-DEMO-0012 · 回款','Receivable AR-DEMO-0012 · Collections'],
        ['剩余天数 7，终端回款进度 67.22%','7 days remaining, end-sales collection progress 67.22%'],
        ['AR-DEMO-0012','AR-DEMO-0012'],'2026-12-12T00:05:00Z',true),
      m8('o05','W-DEMO-0014','block','RK-03',['应收账款 AR-DEMO-0019','Receivable AR-DEMO-0019'],
        ['车辆明细单价合计 47,500.00 USD，发票金额 48,000.00 USD','vehicle unit prices total 47,500.00 USD, invoice amount 48,000.00 USD'],
        ['AR-DEMO-0019','AR-DEMO-0019'],'2026-12-10T07:20:00Z',true),
      m8('o06','W-DEMO-0007','warn','RK-14',['应收账款 AR-DEMO-0012 · 回款','Receivable AR-DEMO-0012 · Collections'],
        ['付款方 Demo Auto Trading Ltd','payer Demo Auto Trading Ltd'],
        ['AR-DEMO-0012','AR-DEMO-0012'],'2026-11-28T08:12:00Z',true),
      /* 规则 RK-26 之后停用，这条未处理预警随之关闭（o02）：前往后只能查看当前结果 */
      Object.assign(m8('o07','W-DEMO-0005','warn','RK-26',['提单 BL-DEMO-5501','Bill of lading BL-DEMO-5501'],
        ['船名航次 OCEAN STAR 026W','vessel/voyage OCEAN STAR 026W'],
        ['AR-DEMO-0012','AR-DEMO-0012'],'2026-11-26T05:10:00Z',true), {done:true}),
      /* 失败原因原文含接口地址与账号、密钥：消息中去掉接口地址，账号与密钥只显示遮盖后的内容；M15 调用记录中接口地址照常展示 */
      m15('o08','BL','401 Unauthorized user=svc****01 key=sk_****7f3a','2026-11-24T10:05:00Z','2026-11-24T09:05:00Z',false),
      /* 已由其他运营管理员处理：前往后只能查看当前结果 */
      Object.assign(m8('o09','W-DEMO-0008','warn','RK-20',['外采合同 PO-DEMO-031 · 外采供应商','Purchase contract PO-DEMO-031 · Supplier'],
        ['收款方 Demo Trading D Ltd','payee Demo Trading D Ltd'],
        ['AR-DEMO-0019','AR-DEMO-0019'],'2026-11-20T04:30:00Z',true), {done:true}),
      m7b03('o10','AP-DEMO-0024','INV-0019','AR-DEMO-0019','48,000.00','USD','2027-01-18','2026-11-10T09:30:00Z',false),
      /* AP-DEMO-0022 第 1 次审核提交上链超时（按失败处理），发送时申请仍为待运营审核；之后再次提交并上链成功（企业端 c06），
         所以这条与 o12 前往后都只能查看当前结果 */
      Object.assign(m9c('o11','AP-DEMO-0022','INV-0011','AR-DEMO-0011',1,['上链超时未返回结果','On-chain recording timed out with no result'],'2026-10-30T03:04:00Z',true), {done:true}),
      Object.assign(m7b03('o12','AP-DEMO-0022','INV-0011','AR-DEMO-0011','55,000.00','USD','2026-12-01','2026-10-29T02:00:00Z',true), {done:true}),
      /* 申请已到期关闭：未读仍计入未读数，前往后只能查看当前结果 */
      Object.assign(m7b03('o13','AP-DEMO-0026','INV-0008','AR-DEMO-0008','60,000.00','USD','2026-10-31','2026-10-20T09:00:00Z',false), {done:true}),
      Object.assign(m7b03('o14','AP-DEMO-0021','INV-0005','AR-DEMO-0005','30,000.00','USD','2026-09-30','2026-09-12T03:00:00Z',true), {done:true})
    ]
  };
  /* 更早的数据接入异常（o15–o24）：各接口恢复后再次进入异常，各自一条；用于呈现“加载更多”。o23 未读，属于尚未加载的部分 */
  ['PL','PM','PC','DI'].concat(['PL','PM','PC','DI','PL','PM']).forEach(function(code, k){
    var fail = new Date(Date.UTC(2026,8,8-k*3,6,0)), ok = new Date(fail.getTime()-3600000);
    var iso = function(d){ return d.toISOString().replace('.000',''); };
    DATA.ops.push(m15('o'+(15+k), code, k%2?'HTTP 503 Service Unavailable':'connection timeout', iso(fail), iso(ok), k!==8));
  });

  var LIST = {client:'list', ops:'o-list'}, PREVIEW = {client:'preview', ops:'o-preview'};
  var BY_WHO = {creditor:'client', debtor:'client', both:'client', ops:'ops'};

  function find(role, id){ var r=null; (DATA[role]||[]).forEach(function(m){ if(m.id===id) r=m; }); return r; }
  function pair(zh, en, cls){
    return '<span class="lang-zh'+(cls?' '+cls:'')+'" lang="zh-CN">'+zh+'</span><span class="lang-en'+(cls?' '+cls:'')+'" lang="en">'+en+'</span>';
  }
  function times(s){ return esc(s).replace(/\{t:([^}]+)\}/g,'<time data-instant="$1" data-minute></time>'); }
  function title(m){ return pair(esc(m.t[0]), esc(m.t[1])); }
  function body(m){ return pair(times(m.b[0]), times(m.b[1])); }
  function refValue(r){ return r[2]==='text' ? '<span>'+esc(r[1])+'</span>' : '<span class="mono">'+esc(r[1])+'</span>'; }
  /* 列表、预览里的原业务识别信息只展示，不做链接；分类在前。 */
  function meta(m){
    return '<span class="msg-cat">'+CATS[m.cat||'other']+'</span>'+(m.ref||[]).map(function(r){
      return '<span class="msg-ref"><span>'+r[0]+'</span> '+refValue(r)+'</span>';
    }).join('');
  }
  /* 消息中心模块（html[data-module="messages"]）内用 data-go；其他模块的画面 id 可能同名（如 o-list），
     改用仓库联看路由 key（msg：全部消息，msg-<消息 id>：该条详情，登记在 M10 的 route.js）；附件中给范围提示。 */
  function own(screen){ return document.documentElement.dataset.module==='messages' && !!document.getElementById(screen); }
  function link(screen, key){ return own(screen) ? ' data-go="'+screen+'"' : ' data-module-key="'+key+'" data-toast="'+SCOPE+'"'; }

  /* 一条消息（列表与预览共用）。opts.read 覆盖演示状态，opts.compact 为预览，opts.screen 为详情画面 id。 */
  function item(role, m, opts){
    opts = opts || {};
    var read = opts.read!==undefined ? opts.read : m.read;
    var screen = opts.screen || 'm-'+m.id;
    var when = '<time class="msg-time" data-instant="'+m.at+'" '+(opts.compact?'data-minute':'data-compact')+'></time>';
    var status = read?'<span class="tag">已读</span>':'<span class="tag accent">未读</span>';
    return '<li><button type="button" class="msg-item'+(opts.compact?' compact':'')+(read?'':' is-unread')+'"'+link(screen, 'msg-'+m.id)+'>'+
      '<span class="msg-dot" aria-hidden="true"></span>'+
      '<span class="msg-main"><span class="msg-title">'+title(m)+'</span>'+
      '<span class="msg-meta">'+meta(m)+'</span>'+
      '<span class="msg-summary">'+body(m)+'</span>'+(opts.compact?'<span class="msg-footer">'+when+status+'</span>':'')+'</span>'+
      (opts.compact?'':'<span class="msg-side">'+when+status+'</span>')+'</button></li>';
  }

  function unread(role){ return (DATA[role]||[]).filter(function(m){ return !m.read; }).length; }

  /* 最近消息预览：最近 10 条（已读、未读都包括）；没有消息、读取失败各一种状态；不提供全部已读。 */
  function panel(who, state, hidden, opts){
    var role = BY_WHO[who], rows = (DATA[role]||[]).slice(0,10), list = opts && opts.omitList ? null : LIST[role];
    var inner;
    if(state==='error'){
      inner = '<div class="state err inbox-state" role="alert"><span class="state-ico">'+TP.icon('alert')+'</span><h3>最近消息读取失败</h3><p>暂时无法读取，请稍后重试。</p>'+
        '<button type="button" class="btn sm"'+(own(PREVIEW[role])?' data-go="'+PREVIEW[role]+'"':'')+'>重试</button></div>';
    }else if(state==='empty' || !rows.length){
      inner = '<div class="state inbox-state" role="status"><span class="state-ico">'+TP.icon('bell')+'</span><h3>还没有消息</h3><p>业务有新的进展时，会在这里通知你。</p></div>';
    }else{
      inner = '<ul class="msg-list">'+rows.map(function(m){ return item(role, m, {compact:true, screen:'m-'+m.id}); }).join('')+'</ul>';
    }
    var all = list ? '<button type="button" class="inbox-all"'+link(list, 'msg')+'>查看全部消息</button>' : '';
    return '<div class="dd-list inbox-panel" role="region" aria-label="最近消息"'+(hidden?' hidden':'')+'>'+
      '<div class="inbox-h"><h2>最近消息</h2><span class="inbox-zone"><span>时区</span> <span data-zone></span></span></div>'+inner+all+'</div>';
  }

  TP.inbox = {
    CATS:CATS, DATA:DATA, LIST:LIST,
    roleOf:function(who){ return BY_WHO[who] || null; },
    unread:unread, find:find, item:item, panel:panel,
    title:title, body:body, meta:meta, pair:pair, times:times, esc:esc, refValue:refValue
  };

  TP.addCopy && TP.addCopy({
    '业务办理进度':'Business progress','业务提醒':'Business reminders','待处理事项':'Pending tasks',
    '运营告警':'Operations alerts','其他':'Other',
    '已读':'Read','未读':'Unread','最近消息':'Recent messages','查看全部消息':'View all messages',
    '最近消息读取失败':'Could not load recent messages','暂时无法读取，请稍后重试。':'Unable to load right now. Please try again later.','重试':'Retry',
    '还没有消息':'No messages yet','业务有新的进展时，会在这里通知你。':'You will be notified here when there is an update on your business.',
    '申请编号':'Request number','发票号':'Invoice number','内销发票号':'Invoice number','预警编号':'Alert number',
    '规则名称':'Rule name','规则编号':'Rule number','接口名称':'Interface name','数据来源':'Data source','客户 ERP':'Customer ERP',
    '时区':'Time zone','消息通知':'Notifications'
  });
  /* 原业务识别信息中随界面语言展示的值：规则名称、接口名称 */
  var names = {};
  Object.keys(RULE).forEach(function(k){ names[RULE[k][0]] = RULE[k][1]; });
  Object.keys(IFACE).forEach(function(k){ names[IFACE[k][0]] = IFACE[k][1]; });
  TP.addCopy && TP.addCopy(names);
})(window.TP = window.TP || {});
