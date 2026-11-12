/* M7a 应收查看与确权申请（企业端·债权人）· 仓库联看路由。只登记本模块已有画面。
   request:<申请编号>：申请详情；m7a-<申请编号>：M10 消息“前往原业务”。
   variants：“债权人与债务人”沿用债权人画面。 */
(function(){
  var requests = {
    'AP-DEMO-0031':'d-pending', 'AP-DEMO-0024':'d-review', 'AP-DEMO-0018':'d-approved',
    'AP-DEMO-0029':'d-rejected', 'AP-DEMO-0011':'d-rejected-expired', 'AP-DEMO-0026':'d-closed'
  };
  var routes = {
    receivables:{creditor:'l-list', both:'l-list'},
    requests:{creditor:'r-list', both:'r-list'}
  };
  Object.keys(requests).forEach(function(no){
    routes['request:'+no] = routes['m7a-'+no] = {creditor:requests[no], both:requests[no]};
  });
  TP.registerModule({id:'clientRequests', end:'client', file:'应收查看与确权申请.html', variants:{both:['creditor']}, routes:routes});
})();
