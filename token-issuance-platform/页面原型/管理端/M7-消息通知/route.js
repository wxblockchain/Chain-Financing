/* M7 消息通知（管理端）· 仓库联看路由。只登记本模块已有画面。
   msg：顶栏预览的“查看全部消息”；msg-<消息 id>：预览中的单条消息，进入该条详情（由 _shared/inbox.js 的演示消息生成）。 */
(function(){
  var routes = {msg:{ops:'o-list', opsnew:'o-list', reg:'r-list', regoff:'r-list', regnew:'r-list'}};
  var data = TP.inbox ? TP.inbox.DATA : {ops:[], reg:[]};
  data.ops.forEach(function(m){ routes['msg-'+m.id] = {ops:'m-'+m.id, opsnew:'m-'+m.id}; });
  data.reg.forEach(function(m){ routes['msg-'+m.id] = {reg:'m-'+m.id, regoff:'m-'+m.id, regnew:'m-'+m.id}; });
  TP.registerModule({id:'adminMessages', end:'admin', file:'消息通知.html', variants:['opsnew', 'regoff', 'regnew'], routes:routes});
})();
