/* M3a 代币发行（企业端）· 仓库联看路由。只登记本模块已有画面。 */
TP.registerModule({
  id:'clientIssuance', end:'client', file:'代币发行.html',
  routes:{
    issue:{certified:'list'},
    issueFromAsset:{certified:'asset-selected'}
  }
});
