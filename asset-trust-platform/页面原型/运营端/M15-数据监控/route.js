/* M15 数据监控 · 仓库联看路由。只登记本模块已有画面。
   pushRecord:<申请编号>：资产推送详情（M9 申请详情“查看完整推送记录”）；interface:<接口>：接口调用记录。
   存证中、存证失败的资产不在本模块（PRD 46fd0a8e），不登记。 */
TP.registerModule({
  id:'opsMonitoring', end:'ops', file:'数据监控.html',
  routes:{
    monitor:{ops:'v-default'}, intake:{ops:'i-list'}, push:{ops:'p-list'},
    'pushRecord:AP-DEMO-0031':{ops:'pr-pushed'},
    'pushRecord:AP-DEMO-0024':{ops:'pr-rejected-pending'},
    'pushRecord:AP-DEMO-0027':{ops:'pr-ready'},
    'pushRecord:AP-DEMO-0021':{ops:'pr-rejected'},
    'interface:BL':{ops:'c-records'}
  }
});
