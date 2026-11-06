/* 企业端（面客端）菜单与演示登录地址：所有企业端模块共用，新增或调整只改这里。
   分组与简报 4.1 的功能一致；biz 项在未认证时显示锁定并进入认证引导，desc 为引导页说明。
   菜单 key 先找模块内 TP.routes，再找仓库联看路由（各模块 route.js）；都没有时显示范围提示。 */
(function(TP){
  TP.demo = TP.demo || {};
  TP.demo.address = '0x7A3f2B9c41D05e8F6a1b2C3d4E5f60718293A4bC';  // 示例企业 A 的登录地址（演示数据）
  TP.NAV = [
    {group:'业务', items:[
      {key:'assets', label:'可信资产', icon:'asset', biz:true, desc:'查看本企业已确权的应收账款，从可发行的资产申请代币发行。'},
      {key:'issue',  label:'代币发行', icon:'issue', biz:true, desc:'提交代币发行申请，查看审核进度与铸造结果。'},
      {key:'tokens', label:'我的代币', icon:'token', biz:true, desc:'查看已铸造的代币，满足条件时发起销毁。'},
      {key:'burn',   label:'销毁申请', icon:'burn',  biz:true, desc:'查看销毁申请的审核进度与解除监管进度。'}
    ]},
    {group:'用户中心', items:[
      {key:'accounts', label:'企业账户', icon:'wallet', biz:true, desc:'查看本企业当前登录地址。'},
      {key:'org',      label:'企业信息', icon:'org'},
      {key:'me',       label:'用户信息', icon:'user'}
    ]}
  ];
})(window.TP = window.TP || {});
