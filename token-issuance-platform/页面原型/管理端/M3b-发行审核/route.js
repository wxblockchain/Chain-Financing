/* M3b 发行审核 · 仓库联看路由。只登记本模块已有画面。
   reviewApplication：IA-DEMO-0031 处于待运营审核（可信资产发行申请中）；reviewApplicationMinted：同一申请铸造成功后（代币详情返回）。 */
TP.registerModule({
  id:'adminReview', end:'admin', file:'发行审核.html',
  variants:['opsnew', 'regoff', 'regnew'],
  routes:{
    review:{ops:'o-list', opsnew:'o-list', reg:'r-list', regoff:'r-list', regnew:'r-list'},
    reviewApplication:{ops:'o-wait-ops', opsnew:'o-wait-ops', reg:'r-wait-ops', regoff:'r-wait-ops', regnew:'r-wait-ops'},
    reviewApplicationMinted:{ops:'o-success', opsnew:'o-success', reg:'r-success', regoff:'r-success', regnew:'r-success'}
  }
});
