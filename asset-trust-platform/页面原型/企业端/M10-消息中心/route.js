/* M10 消息中心（企业端）· 仓库联看路由。只登记本模块已有画面。
   msg：顶栏预览的“查看全部消息”；msg-<消息 id>：预览中的单条消息，进入该条详情（由 _shared/inbox.js 的演示消息生成）。
   演示信箱属于同时有债权人、债务人角色的企业；仅债权人、仅债务人、暂无业务角色进入时沿用同一组画面（与顶栏预览同一份演示消息）。 */
(function(){
  var all = {creditor:'list', debtor:'list', both:'list', norole:'list'};
  var routes = {msg:all};
  (TP.inbox ? TP.inbox.DATA.client : []).forEach(function(m){
    routes['msg-'+m.id] = {creditor:'m-'+m.id, debtor:'m-'+m.id, both:'m-'+m.id, norole:'m-'+m.id};
  });
  TP.registerModule({id:'clientMessages', end:'client', file:'消息中心.html', variants:{creditor:['both'], debtor:['both'], norole:['both']}, routes:routes});
})();
