/* M13 保单信息 · 仓库联看路由。只登记本模块已有画面。
   policy:<保单号>：保单详情。M3、M5、M12 与 M8 预警详情中的保单号可写 data-module-key="policy:<保单号>" 进入。 */
TP.registerModule({
  id:'opsPolicies', end:'ops', file:'保单信息.html',
  routes:{
    policies:{ops:'p-list'},
    'policy:PL-DEMO-889':{ops:'d-detail'},
    'policy:PL-DEMO-903':{ops:'d-ngn'},
    'policy:PL-DEMO-921':{ops:'d-na'},
    'policy:PL-DEMO-862':{ops:'d-empty'}
  }
});
