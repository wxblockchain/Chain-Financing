/* M4 合同信息 · 仓库联看路由。只登记本模块已有画面。
   domesticContract:<内销合同号>、purchaseContract:<外采订单号>、exportContract:<外销合同号>：对应页签的合同详情；
   purchaseInvoice:<外采发票号>：所属外采合同详情并定位到该发票（M5、M14 的外采发票入口）。 */
TP.registerModule({
  id:'opsContracts', end:'ops', file:'合同信息.html',
  routes:{
    contracts:{ops:'c-list'},
    'domesticContract:SC-DEMO-2026-031':{ops:'c-detail'},
    'domesticContract:SC-DEMO-2026-044':{ops:'c-unbilled'},
    'purchaseContract:PO-DEMO-031':{ops:'p-detail'},
    'purchaseContract:PO-DEMO-061':{ops:'p-noinvoice'},
    'purchaseInvoice:PPI-DEMO-0302':{ops:'p-located~PPI-DEMO-0302'},
    'exportContract:SC-DEMO-2045':{ops:'s-detail'},
    'exportContract:SC-DEMO-2048':{ops:'s-mixed'}
  }
});
