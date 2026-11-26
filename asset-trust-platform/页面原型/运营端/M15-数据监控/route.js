/* M15 数据监控 · 仓库联看路由。只登记本模块已有画面。
   pushRecord:<申请编号>：资产推送详情（直接链接）；已交互资产进入对应详情，从未交互、未审核通过的资产进入兜底屏（PRD dcb9f2cd）。
   interface:<接口>：接口调用记录（M10 告警“前往原业务”）。 */
TP.registerModule({
  id:'opsMonitoring', end:'ops', file:'数据监控.html',
  routes:{
    monitor:{ops:'v-default'}, intake:{ops:'i-list'}, push:{ops:'p-list'},
    'pushRecord:AP-DEMO-0031':{ops:'pr-pushed'},
    'pushRecord:AP-DEMO-0024':{ops:'pr-failed'},
    'pushRecord:AP-DEMO-0021':{ops:'pr-rejected'},
    // 从未交互（AP-DEMO-0027）、未审核通过（AP-DEMO-0022）的资产按 M2 F-OP-11 不返回内容（PRD dcb9f2cd）
    'pushRecord:AP-DEMO-0027':{ops:'pr-missing'},
    'pushRecord:AP-DEMO-0022':{ops:'pr-missing'},
    'interface:BL':{ops:'c-records'}
  }
});
