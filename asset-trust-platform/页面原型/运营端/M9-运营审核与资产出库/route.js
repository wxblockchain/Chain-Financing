/* M9 运营审核与资产出库 · 仓库联看路由。只登记本模块已有画面。
   application:<申请编号>：申请详情（审核或出库的当前画面）；m9-<申请编号>：M10 消息“前往原业务”。 */
(function(){
  var apps = {
    'AP-DEMO-0031':'d-pending', 'AP-DEMO-0024':'d-taken', 'AP-DEMO-0028':'d-rejected', 'AP-DEMO-0026':'d-closed',
    'AP-DEMO-0029':'b-blocked', 'AP-DEMO-0019':'b-expired', 'AP-DEMO-0027':'b-retry-void'
  };
  var routes = {review:{ops:'r-pending'}, outbound:{ops:'o-list'}};
  Object.keys(apps).forEach(function(no){ routes['application:'+no] = routes['m9-'+no] = {ops:apps[no]}; });
  TP.registerModule({id:'opsReview', end:'ops', file:'运营审核与资产出库.html', routes:routes});
})();
