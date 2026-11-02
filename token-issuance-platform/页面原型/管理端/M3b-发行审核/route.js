/* M3b 发行审核 · 仓库联看路由。只登记本模块已有画面。 */
TP.registerModule({
  id:'adminReview', end:'admin', file:'发行审核.html',
  variants:['opsnew', 'regoff', 'regnew'],
  routes:{
    review:{ops:'o-list', opsnew:'o-list', reg:'r-list', regoff:'r-list', regnew:'r-list'},
    reviewApplication:{ops:'o-wait-ops', opsnew:'o-wait-ops', reg:'r-wait-ops', regoff:'r-wait-ops', regnew:'r-wait-ops'}
  }
});
