/* M5 管理端登录与权限、监管机构管理 · 仓库联看路由。只登记本模块已有画面。 */
TP.registerModule({
  id:'adminAccount', end:'admin', file:'管理端账号与监管机构管理.html',
  routes:{
    signIn:{none:'login-ops'},
    regs:{ops:'rg-list', opsnew:'rg-list'},
    settings:{ops:'o-settings', opsnew:'o-settings-new', reg:'r-settings', regoff:'r-off', regnew:'r-settings-new'},
    logout:{ops:'login-out', opsnew:'login-out', reg:'login-out', regoff:'login-out', regnew:'login-out'}
  }
});
