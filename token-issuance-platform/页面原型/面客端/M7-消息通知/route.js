/* M7 消息通知（企业端）· 仓库联看路由。只登记本模块已有画面。
   msg：顶栏预览的“查看全部消息”；msg-<消息 id>：预览中的单条消息，进入该条详情；未认证企业进入本身份的画面。 */
(function(){
  var routes = {msg:{certified:'list', uncertified:'u-list'}};
  (TP.inbox ? TP.inbox.DATA.client : []).forEach(function(m){ routes['msg-'+m.id] = {certified:'m-'+m.id, uncertified:'u-'+m.id}; });
  TP.registerModule({id:'clientMessages', end:'client', file:'消息通知.html', routes:routes});
})();
