/* M6 下游销售与收款追溯 · 仓库联看路由。只登记本模块已有画面。
   salesTrace:<应收账款编号>：按应收账款的车辆追溯；sale:<销售合同号>：销售交易详情。 */
TP.registerModule({
  id:'opsSales', end:'ops', file:'下游销售与收款追溯.html',
  routes:{
    sales:{ops:'s-list'},
    'salesTrace:AR-DEMO-0012':{ops:'t-trace'},
    'salesTrace:AR-DEMO-0019':{ops:'t-trace-multi'},
    'sale:SC-DEMO-2045':{ops:'d-detail'},
    'sale:SC-DEMO-2048':{ops:'d-mixed'},
    'sale:SC-DEMO-2060':{ops:'d-sparse'}
  }
});
