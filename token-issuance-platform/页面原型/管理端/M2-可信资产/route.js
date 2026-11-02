/* M2 可信资产（管理端）· 仓库联看路由。只登记本模块已有画面。
   variants：停用机构 / 已改邮箱示例沿用运营或监管的同一组画面。 */
TP.registerModule({
  id:'adminAssets', end:'admin', file:'可信资产.html',
  variants:['regoff', 'regnew', 'opsnew'],
  routes:{
    assets:{ops:'o-list', opsnew:'o-list', reg:'r-list', regoff:'r-list', regnew:'r-list'},
    ents:{ops:'e-list', opsnew:'e-list'},
    reviewAsset:{ops:'o-applying', opsnew:'o-applying', reg:'r-detail', regoff:'r-detail', regnew:'r-detail'},
    reviewCompany:{ops:'e-detail', opsnew:'e-detail'},
    burnAsset001:{ops:'o-deleted', opsnew:'o-deleted'}
  }
});
