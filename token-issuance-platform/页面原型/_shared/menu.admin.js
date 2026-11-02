/* 管理端菜单：运营、监管机构各一份，所有管理端模块共用，新增或调整菜单只改这里。
   菜单 key 先找模块内 TP.routes，再找仓库联看路由（各模块 route.js）；都没有时显示范围提示。
   停用机构（regoff）、已改邮箱（regnew / opsnew）只是同一角色的展示变体，菜单不变。 */
(function(TP){
  var ops = [
    {group:'业务', items:[
      {key:'review', label:'发行审核', icon:'issue'},
      {key:'burn',   label:'销毁审核', icon:'burn'},
      {key:'ledger', label:'代币台账', icon:'ledger'},
      {key:'assets', label:'可信资产', icon:'asset'},
      {key:'ents',   label:'企业',     icon:'org'}
    ]},
    {group:'系统管理', items:[
      {key:'regs',      label:'监管机构管理', icon:'shield'},
      {key:'contracts', label:'合约管理',     icon:'doc'}
    ]}
  ];
  var reg = [
    {group:'业务', items:[
      {key:'review',  label:'发行审核', icon:'issue'},
      {key:'release', label:'解除监管', icon:'shield'},
      {key:'ledger',  label:'代币台账', icon:'ledger'},
      {key:'assets',  label:'可信资产', icon:'asset'}
    ]}
  ];
  TP.NAV_BY = {ops:ops, opsnew:ops, reg:reg, regoff:reg, regnew:reg};
})(window.TP = window.TP || {});
