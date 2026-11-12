/* M8 风控预警与三方数据源 · 仓库联看路由。只登记本模块已有画面。
   alertsOf:<应收账款编号>：按应收账款筛选的预警列表；alert:<预警编号>：预警详情；m8-<预警编号>：M10 消息“前往原业务”。 */
(function(){
  var alerts = {
    'W-DEMO-0007':'a-party', 'W-DEMO-0010':'a-vin', 'W-DEMO-0008':'a-repay',
    'W-DEMO-0005':'a-repay-risk', 'W-DEMO-0009':'a-fail'
  };
  var routes = {
    alerts:{ops:'a-list'},
    sources:{ops:'s-info'},
    'alertsOf:AR-DEMO-0012':{ops:'a-list-ar'}
  };
  Object.keys(alerts).forEach(function(no){ routes['alert:'+no] = routes['m8-'+no] = {ops:alerts[no]}; });
  TP.registerModule({id:'opsAlerts', end:'ops', file:'风控预警与三方数据源.html', routes:routes});
})();
