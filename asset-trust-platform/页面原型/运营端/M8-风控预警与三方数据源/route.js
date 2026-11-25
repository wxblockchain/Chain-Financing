/* M8 风控预警与三方数据源 · 仓库联看路由。只登记本模块已有画面。
   alertsOf:<应收账款编号>：按应收账款筛选的预警列表；alertsOfRule:<规则编号>：按规则筛选的预警列表；
   alert:<预警编号>：预警详情；m8-<预警编号>：M10 消息“前往原业务”（M8-NT01）；rule:<规则编号>：规则详情（M8-NT02 打开处）。 */
(function(){
  var alerts = {
    'W-DEMO-0009':'a-block', 'W-DEMO-0007':'a-party', 'W-DEMO-0011':'a-repay', 'W-DEMO-0012':'a-tip',
    'W-DEMO-0006':'a-auto', 'W-DEMO-0005':'a-off', 'W-DEMO-0014':'a-fail', 'W-DEMO-0015':'a-name'
  };
  var rules = {'RK-01':'r-detail', 'RK-16':'r-detail-adjusted', 'RK-26':'r-detail-off'};
  var routes = {
    alerts:{ops:'a-list'},
    rules:{ops:'r-list'},
    sources:{ops:'s-info'},
    'alertsOf:AR-DEMO-0012':{ops:'a-list-ar'},
    'alertsOfRule:RK-01':{ops:'a-list-rule'}
  };
  Object.keys(alerts).forEach(function(no){ routes['alert:'+no] = routes['m8-'+no] = {ops:alerts[no]}; });
  Object.keys(rules).forEach(function(no){ routes['rule:'+no] = {ops:rules[no]}; });
  TP.registerModule({id:'opsAlerts', end:'ops', file:'风控预警与三方数据源.html', routes:routes});
})();
