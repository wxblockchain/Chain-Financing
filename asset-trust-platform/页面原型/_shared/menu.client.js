/* 资产可信平台企业端菜单与演示账号：所有企业端模块共用，新增或调整只改这里。
   菜单按企业的业务角色给出（债权人 / 债务人 / 两者；每个企业至少有一个角色，角色只增不减），只放真实去向；没有首页或工作台。
   业务入口的页面由应收查看与确权申请（M7a：应收账款、申请记录）、确权待办与确认处理（M7b：确权申请）交付，未交付前点击显示范围提示。
   首登改密（focus 画面）不显示菜单；入驻准备在平台内进行，侧栏按本企业角色列出全部菜单，带锁形标记、不可点击，
   账号入口只有登录邮箱与退出。以下均为演示数据（示例企业 A 为债权人）。 */
(function(TP){
  TP.demo = TP.demo || {};
  var email = 'user-a@demo.example';
  var receivables = {key:'receivables', label:'应收账款', icon:'receivable'};
  // 债权人本企业发起的确权申请（M7a 申请记录与进度），与债务人的“确权申请”待办分开。
  var requests = {key:'requests', label:'申请记录', icon:'ledger'};
  // 角标数量为评审演示值；接入时由确权待办模块按当前用户提供。
  var confirmations = {key:'confirmations', label:'确权申请', icon:'confirm', pendingCount:4};
  var account = {group:'账户', items:[{key:'account', label:'账户信息', icon:'user'}]};
  TP.NAV_BY = {
    creditor:[{group:'业务', items:[receivables, requests]}, account],
    debtor:[{group:'业务', items:[confirmations]}, account],
    both:[{group:'业务', items:[receivables, requests, confirmations]}, account],
    onboarding:[{group:'业务', items:[receivables, requests]}, account]
  };
  TP.demo.accounts = {
    onboarding:{restricted:true, locked:true, email:email},
    creditor:{name:'张示例', email:email, roles:['债权人']},
    debtor:{name:'张示例', email:email, roles:['债务人']},
    both:{name:'张示例', email:email, roles:['债权人', '债务人']}
  };
  if(TP.addCopy) TP.addCopy({'债权人':'Creditor','债务人':'Debtor','申请记录':'Request history'});
})(window.TP = window.TP || {});
