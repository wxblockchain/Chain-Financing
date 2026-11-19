/* M12 提单信息 · 仓库联看路由。只登记本模块已有画面。
   bl:<提单号>：提单详情（M3、M5、M8、M13 中的提单号）；blVehicle:<提单号>:<VIN>：从车辆履约清关节点进入，定位到车辆清单中的该车。 */
TP.registerModule({
  id:'opsBills', end:'ops', file:'提单信息.html',
  routes:{
    bills:{ops:'b-list'},
    'bl:BL-DEMO-5501':{ops:'b-detail'},
    'bl:BL-DEMO-5530':{ops:'b-transit'},
    'blVehicle:BL-DEMO-5501:LDEMOVIN000000001':{ops:'b-located~vehicles'}
  }
});
