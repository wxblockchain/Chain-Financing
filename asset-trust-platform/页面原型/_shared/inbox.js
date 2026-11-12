/* ==========================================================================
   inbox.js — 消息入口（M10 消息中心）：顶栏铃铛的未读数与最近消息预览，以及两端的演示消息。
   基线：代币发行平台 _shared/inbox.js（M7 消息通知）。本平台改动：分类按 M10 PRD §4.2；
   消息取自现行来源模块 03 消息通知册（M7a-NT01～03、M7b-NT01～03、M8-NT01）；无“认证引导”“固定页面”去向。
   各模块在 menu.*.js 之后加载，由 frame.js 渲染到顶栏；入驻未完成、受限登录（首登改密）不显示消息入口。
   不发送、不计算、不保存已读：未读数取本份演示数据，画面可用 data-unread 指定本屏的值。
   规则（收件范围、送达、已读、全部已读、前往原业务）以 PRD 两端共用/M10-消息中心 为准。
   ========================================================================== */
(function(TP){
  'use strict';
  var esc = function(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };

  /* 两端同一套分类；“其他”只是无法识别时的兜底，不是可选分类 */
  var CATS = {progress:'业务办理进度', reminder:'业务提醒', pending:'待处理事项', security:'账户安全', alert:'运营告警', other:'其他'};
  var SCOPE = '此入口在单模块附件中不展开，请在完整原型的 index.html 中打开。';

  /* 消息：id · 分类 · 发生时间 · 演示时的阅读状态 · 中英文标题与正文 · 原业务识别信息 · 去向。
     正文中 {t:ISO} 为按所选时区展示的时间。企业名称、发票号、驳回原因按原值展示，中英文正文都不翻译。
     ref 第三项为 'text' 时按界面语言展示（如预警类型），否则为等宽编号。
     go.key 为原业务的路由键（来源模块原型交付后登记）；done 表示原动作已办完或已不适用，前往后只能查看当前结果；
     denied 表示原业务不存在或本人无权查看。演示中的企业、编号、金额、时间均为演示数据。 */
  var NG = 'Carloha Nigeria', SB = 'Demo Supplier B Ltd.';
  function appRef(app, inv){ return [['申请编号',app],['发票号',inv]]; }

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
      b:[debtor+' 已确认贵企业就发票 '+inv+'（应收账款编号 '+ar+'）发起的确权申请 '+app+'。贵企业在这笔业务中是债权人。申请已进入运营审核，审核通过前不能出库。',
         debtor+' has confirmed confirmation request '+app+' submitted by your company for invoice '+inv+' (receivable '+ar+'). Your company is the creditor in this transaction. The request is now awaiting operations review; the asset cannot be released before the review is approved.'],
      ref:appRef(app, inv), go:{key:'m7a-'+app}};
  }
  /* M7b-NT02 确权申请被债务人驳回（业务办理进度，发给债权人企业）→ M7a 申请详情；驳回原因按原文展示 */
  function m7b02(id, app, debtor, inv, ar, reason, at, read){
    return {id:id, cat:'progress', at:at, read:read,
      t:['确权申请被债务人驳回','Confirmation request rejected by debtor'],
      b:[debtor+' 驳回了贵企业就发票 '+inv+'（应收账款编号 '+ar+'）发起的确权申请 '+app+'。驳回原因：'+reason+'。贵企业在这笔业务中是债权人。该应收账款满足申请条件时可以重新发起确权申请。',
         debtor+' has rejected confirmation request '+app+' submitted by your company for invoice '+inv+' (receivable '+ar+'). Reason: '+reason+'. Your company is the creditor in this transaction. You can submit a new confirmation request when the receivable meets the request conditions.'],
      ref:appRef(app, inv), go:{key:'m7a-'+app}};
  }
  /* M7b-NT03 有新的确权申请待运营审核（待处理事项，全体运营）→ M9 审核详情；到期日按 ERP 原值并带时区 */
  function m7b03(id, app, inv, ar, amt, ccy, due, at, read){
    return {id:id, cat:'pending', at:at, read:read,
      t:['有新的确权申请待运营审核','New confirmation request awaiting review'],
      b:['债务人 '+NG+' 已确认债权人 Carloha Holding 就发票 '+inv+'（应收账款编号 '+ar+'，金额 '+amt+' '+ccy+'，到期日 '+due+'（Africa/Lagos））发起的确权申请 '+app+'，请进行运营审核。应收账款到期时仍未审核通过的申请将自动关闭。',
         'Debtor '+NG+' has confirmed confirmation request '+app+' submitted by creditor Carloha Holding for invoice '+inv+' (receivable '+ar+', amount '+amt+' '+ccy+', due date '+due+' (Africa/Lagos)). Please review it. Requests not approved by the receivable\'s due date will be closed automatically.'],
      ref:appRef(app, inv), go:{key:'m9-'+app}};
  }
  /* M9-NT01 运营审核已通过 / M9-NT02 资产已出库（业务办理进度，发给债权人企业）→ M7a 申请详情（只能查看） */
  function m9a(id, app, debtor, inv, ar, at, read){
    return {id:id, cat:'progress', at:at, read:read,
      t:['运营审核已通过','Operations review approved'],
      b:['贵企业就发票 '+inv+'（应收账款编号 '+ar+'）向 '+debtor+' 发起的确权申请 '+app+' 已通过运营审核。贵企业在这笔业务中是债权人。审核通过表示这笔应收账款已取得出库资格，尚未出库；出库进度可在申请详情中查看。',
         'Confirmation request '+app+' submitted by your company to '+debtor+' for invoice '+inv+' (receivable '+ar+') has been approved by operations. Your company is the creditor in this transaction. Approval means the receivable is now eligible for release; it has not been released yet. You can track the release progress in the request details.'],
      ref:appRef(app, inv), go:{key:'m7a-'+app}};
  }
  function m9b(id, app, inv, ar, at, read){
    return {id:id, cat:'progress', at:at, read:read,
      t:['资产已出库','Asset released'],
      b:['贵企业发票 '+inv+'（应收账款编号 '+ar+'，确权申请 '+app+'）对应的资产已完成出库：平台已将审核通过时的资料存证，并由资产数字化平台确认接收。贵企业在这笔业务中是债权人。',
         'The asset for your company\'s invoice '+inv+' (receivable '+ar+', confirmation request '+app+') has been released: the approved records have been notarised and accepted by the asset digitisation platform. Your company is the creditor in this transaction.'],
      ref:appRef(app, inv), go:{key:'m7a-'+app}};
  }
  /* M9-NT03 资产出库失败（运营告警，全体运营）→ M9 申请详情的出库信息；失败环节随语言，失败原因按原文 */
  function m9c(id, app, inv, ar, attempt, step, reason, at, read){
    var en = step==='存证' ? 'Notarisation' : 'Data supply';
    return {id:id, cat:'alert', at:at, read:read,
      t:['资产出库失败','Asset release failed'],
      b:['债权人 Carloha Holding 的发票 '+inv+'（应收账款编号 '+ar+'，确权申请 '+app+'）第 '+attempt+' 次出库失败，失败环节：'+step+'，原因：'+reason+'。资产尚未出库，请查看后在条件满足时重新出库。',
         'Release attempt '+attempt+' for creditor Carloha Holding\'s invoice '+inv+' (receivable '+ar+', confirmation request '+app+') failed at '+en+'. Reason: '+reason+'. The asset has not been released. Please review it and retry when the release conditions are met.'],
      ref:appRef(app, inv), go:{key:'m9-'+app}};
  }
  /* M8-NT01 新的风控预警（运营告警，全体运营）→ M8 预警详情。
     预警类型随界面语言；主体名称、单据编号、VIN 按原值；差异摘要中的平台用语随语言。 */
  var ALERT = {party:['主体不一致','Party mismatch','party mismatch'], vin:['VIN 不一致','VIN mismatch','VIN mismatch'],
               repay:['回款金额偏差','Collection amount deviation','collection amount deviation']};
  function m8(id, w, type, obj, diff, recv, at, read){
    var T = ALERT[type], r = recv ? recv : ['无','None'];
    return {id:id, cat:'alert', at:at, read:read,
      t:['新的风控预警：'+T[0],'New risk alert: '+T[1]],
      b:['平台比对发现'+T[0]+'，预警编号 '+w+'。比较对象：'+obj[0]+'。差异：'+diff[0]+'。关联应收账款：'+r[0]+'。请核实后记录处理结果。预警不会自动阻止确权申请、运营审核或出库。',
         'A '+T[2]+' has been detected, alert number '+w+'. Compared item: '+obj[1]+'. Difference: '+diff[1]+'. Related receivables: '+r[1]+'. Please verify and record the result. The alert does not automatically block confirmation requests, operations review or asset release.'],
      ref:[['预警编号',w],['预警类型',T[0],'text']], go:{key:'m8-'+w}};
  }
  function repay(id, w, ar, dir, pct, at, read){
    return m8(id, w, 'repay', ['应收账款 '+ar+' · 回款','Receivable '+ar+' · Collections'],
      ['按汇率折算后，已收与未收之和比应收账款金额'+(dir==='less'?'少':'多')+' '+pct,
       'After exchange-rate conversion, collected plus outstanding is '+pct+(dir==='less'?' less':' more')+' than the receivable amount'],
      [ar, ar], at, read);
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
      m9a('c06','AP-DEMO-0022',NG,'INV-0011','AR-DEMO-0011','2026-10-30T03:00:00Z',true),
      m7a01('c07','AP-DEMO-0039',SB,'INV-0105','AR-DEMO-0105','41,200.00','2026-10-28T07:40:00Z',true),
      m7b01('c08','AP-DEMO-0026',NG,'INV-0008','AR-DEMO-0008','2026-10-20T09:00:00Z',true),
      /* AP-DEMO-0036 后已到期关闭（c04）：已读不代表已办理，前往后只能查看当前结果 */
      Object.assign(m7a01('c09','AP-DEMO-0036',SB,'INV-0103','AR-DEMO-0103','25,800.00','2026-10-12T10:05:00Z',true), {done:true}),
      m9b('c10','AP-DEMO-0021','INV-0005','AR-DEMO-0005','2026-09-20T08:00:00Z',true),
      m9a('c11','AP-DEMO-0021',NG,'INV-0005','AR-DEMO-0005','2026-09-15T06:00:00Z',true)
    ],
    /* 运营端 · 全体运营（各自记录已读）。24 条，6 条未读，第一批 20 条。本期没有来源登记“本人”范围的消息。 */
    ops: [
      m8('o01','W-DEMO-0031','party',['应收账款 AR-DEMO-0012 · 买方','Receivable AR-DEMO-0012 · Buyer'],
        ['买方：发票 INV-0012 为 Carloha Nigeria，收款登记 RCV-DEMO-1020 为 Lagos Auto Trading Ltd','Buyer: invoice INV-0012 shows Carloha Nigeria, receipt record RCV-DEMO-1020 shows Lagos Auto Trading Ltd'],
        ['AR-DEMO-0012','AR-DEMO-0012'],'2026-11-11T08:40:00Z',false),
      m7b03('o02','AP-DEMO-0024','INV-0019','AR-DEMO-0019','48,000.00','USD','2027-01-18','2026-11-10T09:30:00Z',false),
      repay('o03','W-DEMO-0030','AR-DEMO-0019','less','3.20%','2026-11-10T06:10:00Z',false),
      m8('o04','W-DEMO-0029','vin',['发票 INV-0019 与合同 SC-DEMO-2026-044','Invoice INV-0019 and contract SC-DEMO-2026-044'],
        ['发票 INV-0019 中的 LDEMOVIN000000011 不在合同 SC-DEMO-2026-044 的车辆中','LDEMOVIN000000011 in invoice INV-0019 is not among the vehicles in contract SC-DEMO-2026-044'],
        ['AR-DEMO-0019','AR-DEMO-0019'],'2026-11-09T12:00:00Z',false),
      /* 已由其他运营管理员处理：前往后只能查看当前结果 */
      Object.assign(m8('o05','W-DEMO-0028','party',['采购交易 PO-DEMO-031 · 卖方（供应商）','Purchase transaction PO-DEMO-031 · Seller (supplier)'],
        ['卖方（供应商）：采购订单 PO-DEMO-031 为 Demo Supplier C Ltd.，付款记录 PAY-DEMO-0720 为 Demo Trading D Ltd.，等 2 处','Seller (supplier): purchase order PO-DEMO-031 shows Demo Supplier C Ltd., payment record PAY-DEMO-0720 shows Demo Trading D Ltd., and 2 more'],
        null,'2026-11-05T03:20:00Z',true), {done:true}),
      /* AP-DEMO-0022 第 1 次出库供数未接收：仍可在原业务重新出库 */
      m9c('o06','AP-DEMO-0022','INV-0011','AR-DEMO-0011',1,'供数','【演示原因】Receiver rejected: duplicate asset record','2026-11-02T07:30:00Z',true),
      Object.assign(m7b03('o07','AP-DEMO-0022','INV-0011','AR-DEMO-0011','55,000.00','USD','2026-12-01','2026-10-29T02:00:00Z',true), {done:true}),
      /* 申请已到期关闭：未读仍计入未读数，前往后只能查看当前结果 */
      Object.assign(m7b03('o08','AP-DEMO-0026','INV-0008','AR-DEMO-0008','60,000.00','USD','2026-10-31','2026-10-20T09:00:00Z',false), {done:true}),
      repay('o09','W-DEMO-0027','AR-DEMO-0015','more','2.50%','2026-10-18T08:00:00Z',true),
      m8('o10','W-DEMO-0026','vin',['保单 PL-DEMO-889 与合同 SC-DEMO-2026-031','Insurance policy PL-DEMO-889 and contract SC-DEMO-2026-031'],
        ['保单 PL-DEMO-889 中的 LDEMOVIN000000002 不在合同 SC-DEMO-2026-031 的车辆中','LDEMOVIN000000002 in insurance policy PL-DEMO-889 is not among the vehicles in contract SC-DEMO-2026-031'],
        ['AR-DEMO-0008','AR-DEMO-0008'],'2026-10-15T05:30:00Z',true),
      m8('o11','W-DEMO-0025','party',['销售交易 SC-DEMO-2026-031 · 客户','Sales transaction SC-DEMO-2026-031 · Customer'],
        ['客户：销售合同 SC-DEMO-2026-031 为 Carloha Nigeria，收款记录 CUS-DEMO-1020 为 Demo Buyer Y Ltd.','Customer: sales contract SC-DEMO-2026-031 shows Carloha Nigeria, receipt record CUS-DEMO-1020 shows Demo Buyer Y Ltd.'],
        ['AR-DEMO-0008，共 2 笔','AR-DEMO-0008, 2 in total'],'2026-10-12T04:00:00Z',true),
      Object.assign(m7b03('o12','AP-DEMO-0021','INV-0005','AR-DEMO-0005','30,000.00','USD','2026-09-30','2026-09-12T03:00:00Z',true), {done:true})
    ]
  };
  /* 更早的回款金额偏差预警（o13–o24）：用于呈现“加载更多”；o23 未读，属于尚未加载的部分 */
  for(var k=0;k<12;k++){
    var ar = ['AR-DEMO-0005','AR-DEMO-0011','AR-DEMO-0015','AR-DEMO-0012'][k%4];
    var day = new Date(Date.UTC(2026,8,8-k*3,6,0)).toISOString().replace('.000','');
    var n = String(13+k), w = 'W-DEMO-00'+String(24-k).padStart(2,'0');
    DATA.ops.push(repay('o'+n, w, ar, k%2?'more':'less', (1.5+k*0.25).toFixed(2)+'%', day, k!==10));
  }

  var LIST = {client:'list', ops:'o-list'}, PREVIEW = {client:'preview', ops:'o-preview'};
  var BY_WHO = {creditor:'client', debtor:'client', both:'client', norole:'client', ops:'ops'};

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
    var when = '<time class="msg-time" data-instant="'+m.at+'" data-minute></time>';
    return '<li><button type="button" class="msg-item'+(opts.compact?' compact':'')+(read?'':' is-unread')+'"'+link(screen, 'msg-'+m.id)+'>'+
      '<span class="msg-dot" aria-hidden="true"></span>'+
      '<span class="msg-main"><span class="msg-title">'+title(m)+'</span>'+
      '<span class="msg-summary">'+body(m)+'</span>'+
      '<span class="msg-meta">'+meta(m)+'</span>'+(opts.compact?when:'')+'</span>'+
      '<span class="msg-side">'+(opts.compact?'':when)+
      (read?'<span class="tag">已读</span>':'<span class="tag accent">未读</span>')+'</span></button></li>';
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
    '业务办理进度':'Business progress','业务提醒':'Business reminders','待处理事项':'Pending tasks','账户安全':'Account security',
    '运营告警':'Operations alerts','其他':'Other',
    '已读':'Read','未读':'Unread','最近消息':'Recent messages','查看全部消息':'View all messages',
    '最近消息读取失败':'Could not load recent messages','暂时无法读取，请稍后重试。':'Unable to load right now. Please try again later.','重试':'Retry',
    '还没有消息':'No messages yet','业务有新的进展时，会在这里通知你。':'You will be notified here when there is an update on your business.',
    '申请编号':'Request number','发票号':'Invoice number','预警编号':'Alert number','预警类型':'Alert type',
    '主体不一致':'Party mismatch','VIN 不一致':'VIN mismatch','回款金额偏差':'Collection amount deviation',
    '存证':'Notarisation','供数':'Data supply',
    '时区':'Time zone','消息通知':'Notifications'
  });
})(window.TP = window.TP || {});
