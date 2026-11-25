/* M17 运营端首页 · 仓库联看路由。只登记本模块已有画面。
   home：侧栏“首页”与运营端登录后没有原目标时的默认落地（已在 M2 运营端菜单表登记）。 */
TP.registerModule({
  id:'opsHome', end:'ops', file:'运营端首页.html',
  routes:{
    home:{ops:'home-default'}
  }
});
