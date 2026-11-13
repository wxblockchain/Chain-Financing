/* M10 消息中心（运营端）· 仓库联看路由。只登记本模块已有画面。
   messages：账号入口“账户设置”下的“消息中心”；msg：顶栏预览的“查看全部消息”；msg-<消息 id>：预览中的单条消息，进入该条详情。 */
(function(){
  var routes = {messages:{ops:'o-list'}, msg:{ops:'o-list'}};
  (TP.inbox ? TP.inbox.DATA.ops : []).forEach(function(m){ routes['msg-'+m.id] = {ops:'m-'+m.id}; });
  TP.registerModule({id:'opsMessages', end:'ops', file:'消息中心.html', routes:routes});
})();
