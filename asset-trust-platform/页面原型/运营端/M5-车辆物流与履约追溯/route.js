/* M5 车辆物流与履约追溯 · 仓库联看路由。只登记本模块已有画面。
   vehicleTrace:<应收账款编号>：从应收账款进入的履约总览；vehicle:<VIN>：车辆履约详情。 */
TP.registerModule({
  id:'opsVehicles', end:'ops', file:'车辆物流与履约追溯.html',
  routes:{
    vehicles:{ops:'v-list'},
    'vehicleTrace:AR-DEMO-0012':{ops:'t-overview'},
    'vehicle:LDEMOVIN000000002':{ops:'v-detail'},
    'vehicle:LDEMOVIN000000001':{ops:'v-delivered'},
    'vehicle:LDEMOVIN000000011':{ops:'v-hints'},
    'vehicle:LDEMOVIN000000021':{ops:'v-shipped'},
    'vehicle:LDEMOVIN000000015':{ops:'v-none'}
  }
});
