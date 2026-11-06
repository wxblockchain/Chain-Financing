/* M4b 销毁审核、解除监管与代币台账 · 仓库联看路由。只登记本模块已有画面。 */
TP.registerModule({
  id:'adminBurn', end:'admin', file:'销毁审核与解除质押.html',
  variants:['opsnew', 'regoff', 'regnew'],
  routes:{
    burn:{ops:'b-list', opsnew:'b-list'},
    ledger:{ops:'l-list', opsnew:'l-list', reg:'rl-list', regoff:'rl-list', regnew:'rl-list'},
    ledgerToken001:{ops:'l-001', opsnew:'l-001'},
    reviewToken:{ops:'l-027', opsnew:'l-027', reg:'rl-027', regoff:'rl-027', regnew:'rl-027'},
    // M7 消息前往原业务：销毁申请（运营）/ 解除监管事项（监管）的当前画面
    burnApplication0031:{ops:'b-release', opsnew:'b-release'},
    burnApplication0019:{ops:'b-release-2', opsnew:'b-release-2'},
    burnApplication0018:{ops:'b-released', opsnew:'b-released'},
    burnApplication0030:{ops:'b-pending-2', opsnew:'b-pending-2'},
    burnApplication0024:{ops:'b-rejected', opsnew:'b-rejected'},
    burnApplication0021:{ops:'b-failed', opsnew:'b-failed'}
  }
});
