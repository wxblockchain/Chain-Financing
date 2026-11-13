/* M1 企业登录与首次入驻 · 仓库联看路由：菜单 / 操作 key → 各身份落地画面。只登记本模块已有画面。
   onboard：入驻准备中的账号（首登改密后进入入驻准备）；logout：各身份退出后回到登录。 */
(function(){
  var account = {creditor:'account', debtor:'account-debtor', both:'account-both'};
  TP.registerModule({
    id:'clientAccount', end:'client', file:'企业登录与首次入驻.html',
    routes:{
      signIn:{none:'login'},
      onboard:{onboarding:'bind'},
      account:account,
      settings:account,
      logout:{onboarding:'login', creditor:'login', debtor:'login', both:'login'}
    }
  });
})();
