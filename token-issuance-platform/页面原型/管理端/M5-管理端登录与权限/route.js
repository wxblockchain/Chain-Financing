/* M5 管理端登录与权限、机构管理 · 仓库联看路由。只登记本模块已有画面。
   variants：已改邮箱的运营沿用运营画面；账户设置的 opsnew / regoff / regnew 已显式登记各自画面。 */
TP.registerModule({
  id:'adminAccount', end:'admin', file:'管理端账号与监管机构管理.html',
  variants:['opsnew'],
  routes:{
    tasks:{ops:"task-list-ops",opsnew:"task-list-ops",reg:"task-list",regoff:"task-list",regnew:"task-list"},
    institutionApplication:{reg:"task-application",regoff:"task-disabled",regnew:"task-application"},
    institutionApplicationMinted:{reg:"task-token",regoff:"task-token",regnew:"task-token"},
    signIn:{none:'login-ops'},
    regs:{ops:'rg-list', opsnew:'rg-list'},
    settings:{ops:'o-settings', opsnew:'o-settings-new', reg:'r-settings', regoff:'r-off', regnew:'r-settings-new'},
    logout:{ops:'login-out', opsnew:'login-out', reg:'login-out', regoff:'login-out', regnew:'login-out'}
  }
});
