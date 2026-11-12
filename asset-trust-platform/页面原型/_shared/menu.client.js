/* 资产可信平台企业端菜单与演示账号：所有企业端模块共用，新增或调整只改这里。
   菜单按企业的业务角色给出（债权人 / 债务人 / 两者 / 暂无角色），只放真实去向；没有首页或工作台。
   业务入口的页面由应收查看与确权申请（M7a）、确权待办与确认处理（M7b）交付，未交付前点击显示范围提示。
   受限登录（首登改密、入驻准备）只有登录邮箱与退出，不显示菜单。以下均为演示数据。 */
(function(TP){
  TP.demo = TP.demo || {};
  var email = 'user-a@demo.example';
  var receivables = {key:'receivables', label:'应收账款', icon:'receivable'};
  var confirmations = {key:'confirmations', label:'确权申请', icon:'confirm'};
  var account = {group:'账户', items:[{key:'account', label:'账户信息', icon:'user'}]};
  TP.NAV_BY = {
    creditor:[{group:'业务', items:[receivables]}, account],
    debtor:[{group:'业务', items:[confirmations]}, account],
    both:[{group:'业务', items:[receivables, confirmations]}, account],
    norole:[account]
  };
  TP.demo.accounts = {
    onboarding:{restricted:true, email:email},
    creditor:{name:'张示例', email:email, roles:['债权人']},
    debtor:{name:'张示例', email:email, roles:['债务人']},
    both:{name:'张示例', email:email, roles:['债权人', '债务人']},
    norole:{name:'张示例', email:email, roles:[]}
  };
  if(TP.addCopy) TP.addCopy({'债权人':'Creditor','债务人':'Debtor'});
})(window.TP = window.TP || {});
