/* M1 展示文案补充；企业账户只读，不提供账户变更或地址归属签名。 */
(function(TP){
  TP.addCopy({
    '登录已结束：上游账户已锁定':'Session ended: upstream account locked','你在资产可信平台的账户已锁定，本次登录已结束。':'Your Asset Trust Platform account is locked. This session has ended.',
    '解除说明：请联系资产可信平台解除锁定后重新登录。':'To unlock: contact the Asset Trust Platform, then sign in again.',
    '登录未完成：建立企业用户失败':'Sign-in incomplete: enterprise user not created','登录未完成，请重试或退出。':'Sign-in could not be completed. Try again or exit.',
    '错误码':'Error code','退出':'Exit',
    '登录已到期':'Session expired','登录已到期，请重新签名登录。':'Your session has expired. Sign in again with your wallet.','未保存的内容不会保留。':'Unsaved changes are not kept.'
  });
  TP.addCopy({
  "账户标识": "Account identifier",
  "当前登录地址": "Current sign-in address",
  "当前登录地址已变更。新申请使用此地址，历史申请和已铸造代币保留原接收地址。": "The current sign-in address has changed. New applications use this address; historical applications and minted tokens keep their recorded receiving addresses."
});
})(window.TP);
