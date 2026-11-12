/* M2 运营登录、企业邀请与企业管理 · 仓库联看路由。只登记本模块已有画面。 */
TP.registerModule({
  id:'opsAccount', end:'ops', file:'运营登录与企业管理.html',
  routes:{
    signIn:{none:'login'},
    ents:{ops:'ent-list'},
    settings:{ops:'settings'},
    logout:{ops:'login-out', opsinit:'login-out'}
  }
});
