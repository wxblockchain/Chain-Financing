/* M7a 应收查看与确权申请（企业端·债权人）· 仓库联看路由。只登记本模块已有画面。
   request:<申请编号>：申请详情；m7a-<申请编号>：M10 消息“前往原业务”。
   债权人的应收账款详情在本模块内（A 组画面），由列表与申请详情进入，不登记 receivable: 键（该键在 M3 迁移完成前仍由企业端 M3 登记）。
   variants：“债权人与债务人”沿用债权人画面。 */
(function(){
  var requests = {
    'AP-DEMO-0031':'d-pending', 'AP-DEMO-0045':'d-pending-fx', 'AP-DEMO-0024':'d-review', 'AP-DEMO-0022':'d-approved',
    'AP-DEMO-0021':'d-pushed', 'AP-DEMO-0028':'d-reapplied', 'AP-DEMO-0026':'d-closed'
  };
  var routes = {
    receivables:{creditor:'l-list', both:'l-list'}
  };
  Object.keys(requests).forEach(function(no){
    routes['request:'+no] = routes['m7a-'+no] = {creditor:requests[no], both:requests[no]};
  });
  TP.registerModule({id:'clientRequests', end:'client', file:'应收查看与确权申请.html', variants:{both:['creditor']}, routes:routes});
})();
