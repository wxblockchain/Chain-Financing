/* M7b 确权待办与确认处理（企业端·债务人）· 仓库联看路由。只登记本模块已有画面。
   confirmation:<申请编号>：申请详情；m7b-<申请编号>：M10 消息“前往原业务”。
   “债权人与债务人”的确权申请列表是独立画面 m-both；详情沿用债务人画面。 */
(function(){
  var details = {
    'AP-DEMO-0031':'d-pending', 'AP-DEMO-0035':'d-pending-diff', 'AP-DEMO-0028':'d-reissued',
    'AP-DEMO-0030':'d-approved', 'AP-DEMO-0021':'d-closed', 'AP-DEMO-0033':'d-expired'
  };
  var routes = {confirmations:{debtor:'m-pending', both:'m-both'}};
  Object.keys(details).forEach(function(no){
    routes['confirmation:'+no] = routes['m7b-'+no] = {debtor:details[no], both:details[no]};
  });
  TP.registerModule({id:'clientConfirmations', end:'client', file:'确权待办与确认处理.html', variants:{both:['debtor']}, routes:routes});
})();
