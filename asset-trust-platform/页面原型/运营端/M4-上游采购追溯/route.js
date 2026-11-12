/* M4 上游采购追溯 · 仓库联看路由。只登记本模块已有画面。
   purchaseTrace:<应收账款编号>：按应收账款的车辆追溯；purchaseOrder:<采购订单号>：采购交易详情。 */
TP.registerModule({
  id:'opsPurchase', end:'ops', file:'上游采购追溯.html',
  routes:{
    purchase:{ops:'p-list'},
    'purchaseTrace:AR-DEMO-0012':{ops:'t-trace'},
    'purchaseTrace:AR-DEMO-0019':{ops:'t-trace-multi'},
    'purchaseTrace:AR-DEMO-0021':{ops:'t-trace-none'},
    'purchaseOrder:PO-DEMO-031':{ops:'d-detail'},
    'purchaseOrder:PO-DEMO-090':{ops:'d-hints'},
    'purchaseOrder:PO-DEMO-061':{ops:'d-sparse'}
  }
});
