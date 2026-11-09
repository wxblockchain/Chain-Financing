/* M7 消息通知（管理端）· 仓库联看路由。只登记本模块已有画面。
   msg：顶栏预览的“查看全部消息”；msg-<消息 id>：预览中的单条消息，进入该条详情（由 _shared/inbox.js 的演示消息生成）。
   regd：M4b 的审计机构（只读）身份，进入本模块的审计机构画面；不作为 reg 的变体。 */
(function(){
  var routes = {msg:{ops:'o-list', opsnew:'o-list', reg:'r-list', regoff:'r-list', regnew:'r-list', regd:'d-list'}};
  var data = TP.inbox ? TP.inbox.DATA : {ops:[], reg:[], aud:[]};
  data.ops.forEach(function(m){ routes['msg-'+m.id] = {ops:'m-'+m.id, opsnew:'m-'+m.id}; });
  data.reg.forEach(function(m){ routes['msg-'+m.id] = {reg:'m-'+m.id, regoff:'m-'+m.id, regnew:'m-'+m.id}; });
  (data.aud || []).forEach(function(m){ routes['msg-'+m.id] = {regd:'m-'+m.id}; });
  TP.registerModule({id:'adminMessages', end:'admin', file:'消息通知.html', variants:['opsnew', 'regoff', 'regnew'], routes:routes});
})();
