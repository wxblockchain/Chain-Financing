/* M4b 销毁记录、解除资产托管与代币台账 · 只登记本模块画面。 */
TP.registerModule({
  id:'adminBurn', end:'admin', file:'销毁审核与解除质押.html',
  variants:['opsnew', 'regoff', 'regnew'],
  routes:{
    burn:{ops:'b-list', opsnew:'b-list'},
    release:{reg:'r-list', regoff:'r-list', regnew:'r-list', regd:'r-list-audit'},
    ledger:{ops:'l-list', opsnew:'l-list', reg:'rl-list', regoff:'rl-list', regnew:'rl-list', regd:'rld-list'},
    // M7 审计机构消息（NT-R04）前往代币详情
    auditToken025:{regd:'rld-025'},
    ledgerToken001:{ops:'l-001', opsnew:'l-001'},
    reviewToken:{ops:'l-027', opsnew:'l-027', reg:'rl-027', regoff:'rl-027', regnew:'rl-027'},
    // M7 消息前往原业务：运营进入销毁记录详情，资产托管机构进入解除托管详情
    burnApplication0031:{ops:'b-release', opsnew:'b-release', reg:'r-0031', regoff:'r-0031', regnew:'r-0031'},
    burnApplication0019:{ops:'b-release-2', opsnew:'b-release-2', reg:'r-detail', regoff:'r-disabled', regnew:'r-detail'},
    burnApplication0018:{ops:'b-released', opsnew:'b-released', reg:'r-released', regoff:'r-released', regnew:'r-released'},
    burnApplication0030:{ops:'b-pending-2', opsnew:'b-pending-2'},
    burnApplication0024:{ops:'b-prior-failed', opsnew:'b-prior-failed'},
    burnApplication0021:{ops:'b-failed', opsnew:'b-failed'},
    burnApplication0040:{ops:'b-external', opsnew:'b-external', reg:'r-external', regoff:'r-external', regnew:'r-external'}
  }
});
