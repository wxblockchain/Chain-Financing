/* 管理端菜单与演示账号：运营、机构各一份，所有管理端模块共用，新增或调整只改这里。
   菜单 key 先找模块内 TP.routes，再找仓库联看路由（各模块 route.js）；都没有时显示范围提示。
   停用机构（regoff）、已改邮箱（regnew / opsnew）只是同一角色的展示变体，菜单不变。 */
(function(TP){
  var ops = [
    {group:'业务', items:[
      {key:'review', label:'发行审核', icon:'issue'},
      {key:'tasks', label:'机构待办', icon:'doc'},
      {key:'burn',   label:'销毁审核', icon:'burn'},
      {key:'ledger', label:'代币台账', icon:'ledger'},
      {key:'assets', label:'可信资产', icon:'asset'},
      {key:'ents',   label:'企业',     icon:'org'}
    ]},
    {group:'系统管理', items:[
      {key:'regs',      label:'机构管理', icon:'shield'},
      {key:'contracts', label:'合约管理',     icon:'doc'}
    ]}
  ];
  var reg = [
    {group:'业务', items:[
      {key:'tasks',   label:'机构待办', icon:'doc'},
      {key:'ledger',  label:'代币台账', icon:'ledger'},
      {key:'assets',  label:'可信资产', icon:'asset'}
    ]}
  ];
  TP.addCopy({'机构':'Institution','机构管理':'Institutions','机构待办':'Institution tasks','资产托管机构':'Asset custodian','本机构已停用。':'This institution is disabled.'});
  TP.NAV_BY = {ops:ops, opsnew:ops, reg:reg, regoff:reg, regnew:reg};
  // 账号入口的演示数据：机构账号名称即机构名称；停用机构、改邮箱是同一账号的展示变体。
  var opsAcc = {name:'运营示例账号', email:'ops-demo@example.com', role:'运营管理员'};
  var regAcc = {name:'示例机构 C', email:'reviewer-demo@reg.example', role:'机构', org:'示例机构 C', type:'资产托管机构'};
  TP.demo = TP.demo || {};
  TP.demo.accounts = {
    ops: opsAcc,
    opsnew: Object.assign({}, opsAcc, {email:'new-ops@example.com'}),
    reg: regAcc,
    regoff: Object.assign({}, regAcc, {notice:'本机构已停用。'}),
    regnew: Object.assign({}, regAcc, {email:'new-reviewer@reg.example'})
  };
})(window.TP = window.TP || {});
