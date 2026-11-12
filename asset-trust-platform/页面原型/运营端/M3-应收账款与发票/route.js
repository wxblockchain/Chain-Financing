/* M3 应收账款与发票（运营端）· 仓库联看路由。只登记本模块已有画面。
   receivable:<应收账款编号>：应收账款详情（M4–M9 的应收账款编号、“返回应收账款”“查看应收账款当前资料”）。 */
TP.registerModule({
  id:'opsReceivables', end:'ops', file:'应收账款与发票.html',
  routes:{
    invoices:{ops:'o-list'},
    'receivable:AR-DEMO-0012':{ops:'o-detail'},
    'receivable:AR-DEMO-0019':{ops:'o-diff'},
    'receivable:AR-DEMO-0021':{ops:'o-sparse'},
    'receivable:AR-DEMO-0008':{ops:'o-closed'}
  }
});
