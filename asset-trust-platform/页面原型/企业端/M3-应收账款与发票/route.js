/* M3 应收账款与发票（企业端）· 仓库联看路由。只登记本模块已有画面。
   债权人的应收账款详情已由 M7a（F-M7a-09）承接，本模块不再登记 receivable: 键。
   debtorReceivable:<应收账款编号>：债务人从 M7b 申请详情进入；M7b 原型画出 F-M7b-05 后删除本模块。
   variants：“债权人与债务人”沿用债务人画面。 */
TP.registerModule({
  id:'clientReceivables', end:'client', file:'应收账款与发票.html',
  variants:{both:['debtor']},
  routes:{
    'debtorReceivable:AR-DEMO-0012':{debtor:'d-detail', both:'d-detail'}
  }
});
