/* M2 可信资产（企业端）· 仓库联看路由。只登记本模块已有画面。 */
TP.registerModule({
  id:'clientAssets', end:'client', file:'可信资产.html',
  routes:{
    assets:{certified:'list'},
    assetToken001:{certified:'d-issued'}
  }
});
