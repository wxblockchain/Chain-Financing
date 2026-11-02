/* M4b 销毁审核、解除监管与代币台账 · 仓库联看路由。只登记本模块已有画面。 */
TP.registerModule({
  id:'adminBurn', end:'admin', file:'销毁审核与解除质押.html',
  variants:['opsnew', 'regoff', 'regnew'],
  routes:{
    burn:{ops:'b-list', opsnew:'b-list'},
    release:{reg:'r-list', regoff:'r-list', regnew:'r-list'},
    ledger:{ops:'l-list', opsnew:'l-list', reg:'rl-list', regoff:'rl-list', regnew:'rl-list'},
    ledgerToken001:{ops:'l-001', opsnew:'l-001'}
  }
});
