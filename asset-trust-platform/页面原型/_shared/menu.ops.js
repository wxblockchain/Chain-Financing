/* 资产可信平台运营端菜单与演示账号：所有运营端模块共用，新增或调整只改这里。
   菜单可见性以 M2《运营登录与企业管理》F-OP-11 运营端菜单表为准；本期只有“运营管理员”一个角色，菜单与数据范围相同。
   菜单 key 先找模块内 TP.routes；没有对应画面时显示范围提示，不伪造其他模块页面。
   业务模块新增运营端菜单时，须先在 M2 PRD 菜单表登记，再在这里追加。 */
(function(TP){
  var ops = [
    {group:'企业', items:[
      {key:'ents',      label:'企业管理',   icon:'org'}
    ]},
    {group:'资产数据', items:[
      {key:'invoices',  label:'发票与应收', icon:'doc'},
      {key:'purchase',  label:'上游采购',   icon:'cart'},
      {key:'vehicles',  label:'车辆履约',   icon:'truck'},
      {key:'sales',     label:'下游销售',   icon:'ledger'}
    ]},
    {group:'风控', items:[
      {key:'alerts',    label:'风控预警',   icon:'alert'},
      {key:'sources',   label:'三方数据源', icon:'database'}
    ]},
    {group:'审核与出库', items:[
      {key:'review',    label:'运营审核',   icon:'shield'},
      {key:'outbound',  label:'出库与供数', icon:'send'}
    ]},
    {group:'消息', items:[
      {key:'messages',  label:'消息中心',   icon:'msg'}
    ]}
  ];
  TP.addCopy({
    '资产可信平台':'Asset Trust Platform','运营端':'Operations',
    '企业':'Enterprises','企业管理':'Enterprise management','资产数据':'Asset data','发票与应收':'Invoices & receivables',
    '上游采购':'Upstream purchasing','车辆履约':'Vehicle fulfilment','下游销售':'Downstream sales','风控':'Risk control',
    '风控预警':'Risk alerts','三方数据源':'Third-party data sources','审核与出库':'Review & outbound','运营审核':'Operations review',
    '出库与供数':'Outbound & data supply','消息':'Messages','消息中心':'Message center','运营管理员':'Operations administrator',
    '账户设置':'Account settings','退出登录':'Sign out'
  });
  TP.NAV_BY = {ops:ops};
  // 账号入口的演示数据：姓名、登录邮箱由开发人员分配，角色固定为运营管理员。
  TP.demo = TP.demo || {};
  TP.demo.accounts = {
    ops:{name:'运营示例账号', email:'ops-demo@example.com', roles:['运营管理员'], settingsLabel:'账户设置'},
    // 首次登录强制改密的受限登录：只有登录邮箱与退出登录，不显示菜单。
    opsinit:{restricted:true, email:'new-ops@example.com'}
  };
})(window.TP = window.TP || {});
