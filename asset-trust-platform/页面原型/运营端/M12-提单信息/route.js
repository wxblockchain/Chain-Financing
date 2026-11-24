/* M12 提单信息 · 仓库联看路由。只登记本模块已有画面。
   bl:<提单号>：提单详情（M3、M5、M8、M9、M13、M15 中的提单号）；blVehicle:<提单号>:<VIN>：从车辆履约清关单号进入，定位到车辆清单中的该车；
   customs:<清关单号>：从风控预警详情的清关单号进入，对应一张提单时定位到详情中的这张清关单，对应多张提单时进入列表并按该清关单号查找。 */
TP.registerModule({
  id:'opsBills', end:'ops', file:'提单信息.html',
  routes:{
    bills:{ops:'b-list'},
    'bl:BL-DEMO-5501':{ops:'b-detail'},
    'bl:BL-DEMO-5530':{ops:'b-transit'},
    'blVehicle:BL-DEMO-5501:LDEMOVIN000000001':{ops:'b-located~vehicles'},
    'customs:CC-DEMO-0101':{ops:'b-customs~customs'},
    'customs:CC-DEMO-0108':{ops:'b-list-customs'}
  }
});
