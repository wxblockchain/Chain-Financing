/* M5 车辆履约（单车维度，WS-660）· 仓库联看路由。只登记本模块已有画面。
   vehicle:<VIN>：车辆履约详情。 */
TP.registerModule({
  id:'opsVehicles', end:'ops', file:'车辆履约.html',
  routes:{
    vehicles:{ops:'f-list'},
    'vehicle:LDEMOVIN000000001':{ops:'f-detail'},
    'vehicle:LDEMOVIN000000002':{ops:'f-multi'},
    'vehicle:LDEMOVIN000000021':{ops:'f-transit'},
    'vehicle:LDEMOVIN000000015':{ops:'f-sparse'},
    'vehicle:LDEMOVIN000000011':{ops:'f-transfer'},
    'vehicle:LDEMOVIN000000012':{ops:'f-returned'},
    'vehicle:LDEMOVIN000000031':{ops:'f-nobl'}
  }
});
