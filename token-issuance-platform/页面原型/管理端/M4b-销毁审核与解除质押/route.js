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
    // M2 机构资产详情前往本机构代币详情
    regToken001:{reg:'rl-001', regoff:'rl-001', regnew:'rl-001'},
    // M7 运营告警：NT-A08 提交锁超时（DEMO-TOKEN-021 确认中）、NT-A09 代币单位价值调整超时（DEMO-TOKEN-001）前往代币详情
    ledgerTokenLocked:{ops:'l-021-lock', opsnew:'l-021-lock'},
    ledgerTokenAdjusting:{ops:'l-001-updating', opsnew:'l-001-updating'},
    // M7 NT-A10 机构追加了发行材料：运营前往 DEMO-TOKEN-021 代币详情的补充记录
    ledgerTokenSupplement021:{ops:'l-021~supplement', opsnew:'l-021~supplement'},
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
