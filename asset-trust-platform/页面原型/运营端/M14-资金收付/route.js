/* M14 资金收付 · 仓库联看路由。只登记本模块已有画面。
   funds:<交易流水号>：收付记录详情（M3 回款记录、M4 合同信息付款 / 收款记录、M5 外销段、M8 预警详情、M9 当次依据中的交易流水号）；
   funds:<交易流水号>:<关联单据编号>：交易流水号有多条收付记录时，进入来源位置对应的那一条（演示 TRX-DEMO-1102 的两条记录）。 */
TP.registerModule({
  id:'opsFunds', end:'ops', file:'资金收付.html',
  routes:{
    funds:{ops:'f-list'},
    'funds:TRX-DEMO-1015':{ops:'f-detail'},
    'funds:TRX-DEMO-1102':{ops:'f-d-novoucher'},
    'funds:TRX-DEMO-1102:INV-0012':{ops:'f-d-novoucher'},
    'funds:TRX-DEMO-1102:INV-0019':{ops:'f-d-dup'},
    'funds:RC-DEMO-7781':{ops:'f-d-ngn'},
    'funds:PAY-DEMO-0130':{ops:'f-d-multi'},
    'funds:PAY-DEMO-0140':{ops:'f-d-unadopted'}
  }
});
