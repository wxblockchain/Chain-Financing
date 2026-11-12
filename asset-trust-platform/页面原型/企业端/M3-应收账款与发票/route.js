/* M3 应收账款与发票（企业端）· 仓库联看路由。只登记本模块已有画面。
   receivable:<应收账款编号>：债权人从 M7a 进入；debtorReceivable:<应收账款编号>：债务人从 M7b 申请详情进入。
   variants：“债权人与债务人”沿用债权人、债务人两组画面。 */
TP.registerModule({
  id:'clientReceivables', end:'client', file:'应收账款与发票.html',
  variants:{both:['creditor', 'debtor']},
  routes:{
    'receivable:AR-DEMO-0012':{creditor:'c-detail', both:'c-detail'},
    'receivable:AR-DEMO-0019':{creditor:'c-diff', both:'c-diff'},
    'debtorReceivable:AR-DEMO-0012':{debtor:'d-detail', both:'d-detail'}
  }
});
