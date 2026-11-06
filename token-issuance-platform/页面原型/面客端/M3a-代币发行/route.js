/* M3a 代币发行（企业端）· 仓库联看路由。只登记本模块已有画面。 */
TP.registerModule({
  id:'clientIssuance', end:'client', file:'代币发行.html',
  routes:{
    issue:{certified:'list'},
    issueFromAsset:{certified:'info-from-asset'},
    assetApplication0131:{certified:'detail-ops'},
    assetApplication0097:{certified:'detail-denied'},
    assetApplication0102:{certified:'detail-minted'},
    assetApplication0027:{certified:'detail-progress'}
  }
});
