/* M1 企业登录与企业账户 · 仓库联看路由：菜单 / 操作 key → 各身份落地画面。只登记本模块已有画面。 */
TP.registerModule({
  id:'account', end:'client', file:'企业登录与企业账户.html',
  routes:{
    signIn:{none:'login', guest:'login'},
    guestRegister:{guest:'guest'},
    accounts:{certified:'acc'},
    org:{certified:'org', uncertified:'org-uncert', noent:'org-noent'},
    me:{certified:'me', uncertified:'me-uncert', noent:'me-noent'},
    logout:{certified:'login', uncertified:'login', noent:'login'},
    certify:{screens:{uncertified:'leave', noent:'leave'}, bases:{uncertified:'org-uncert', noent:'acc-noent'}}
  }
});
