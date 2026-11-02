/* M6 合约管理 · 仓库联看路由。只登记本模块已有画面。 */
TP.registerModule({
  id:'adminContracts', end:'admin', file:'合约管理.html',
  variants:['opsnew'],
  routes:{
    contracts:{ops:'ct-list', opsnew:'ct-list'}
  }
});
