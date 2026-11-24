/* M9 运营审核与资产推送 · 仓库联看路由。只登记本模块已有画面。
   application:<申请编号>：申请详情（M3、M15 中的申请编号）；m9-<申请编号>：M10 消息“前往原业务”。 */
(function(){
  var apps = {
    'AP-DEMO-0031':'d-pending', 'AP-DEMO-0028':'d-rejected', 'AP-DEMO-0026':'d-closed', 'AP-DEMO-0024':'d-taken',
    'AP-DEMO-0022':'d-failed', 'AP-DEMO-0021':'d-rejected-pull'
  };
  var routes = {review:{ops:'r-pending'}};
  Object.keys(apps).forEach(function(no){ routes['application:'+no] = routes['m9-'+no] = {ops:apps[no]}; });
  TP.registerModule({id:'opsReview', end:'ops', file:'运营审核与资产推送.html', routes:routes});
})();
