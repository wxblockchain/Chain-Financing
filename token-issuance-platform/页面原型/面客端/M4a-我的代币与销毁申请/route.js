/* M4a 我的代币与销毁申请 · 仓库联看路由。只登记本模块已有画面。 */
TP.registerModule({
  id:'clientTokens', end:'client', file:'我的代币与销毁申请.html',
  routes:{
    tokens:{certified:'t-list'},
    burn:{certified:'b-list'},
    tokenDemo001:{certified:'t-future'},
    // M7 消息前往原业务：销毁申请的当前画面
    burnApplication0031:{certified:'a-release'},
    burnApplication0019:{certified:'a-release-record'},
    burnApplication0018:{certified:'a-message'},
    burnApplication0024:{certified:'a-old-active'},
    burnApplication0021:{certified:'a-failed'}
  }
});
