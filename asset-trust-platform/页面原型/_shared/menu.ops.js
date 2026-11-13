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
      {key:'invoices',  label:'应收账款',   icon:'doc'},
      {key:'purchase',  label:'上游采购',   icon:'cart'},
      {key:'vehicles',  label:'车辆履约',   icon:'truck'},
      {key:'sales',     label:'下游销售',   icon:'ledger'}
    ]},
    {group:'风控', items:[
      // 角标为当前未处理风控预警条数（M8 F-M8-05），评审演示值；接入时由风控预警模块提供，全体运营相同。
      {key:'alerts',    label:'风控预警',   icon:'alert', pendingCount:5},
      {key:'sources',   label:'三方数据源', icon:'database'}
    ]},
    {group:'审核与出库', items:[
      // 角标数量为评审演示值；接入时由 M9 运营审核与资产出库按全平台待审核、出库待办提供。
      {key:'review',    label:'运营审核',   icon:'shield', pendingCount:4},
      {key:'outbound',  label:'出库与供数', icon:'send', pendingCount:2}
    ]},
    {group:'消息', items:[
      {key:'messages',  label:'消息中心',   icon:'msg'}
    ]},
    // M11 汇率管理（WS-612）：已登记于 M2 PRD F-OP-11 菜单表（2026-11-13 修订）。
    {group:'平台配置', items:[
      {key:'fx',        label:'汇率管理',   icon:'fx'}
    ]}
  ];
  TP.addCopy({
    '资产可信平台':'Asset Trust Platform','运营端':'Operations',
    '企业':'Enterprises','企业管理':'Enterprise management','资产数据':'Asset data','应收账款':'Receivables',
    '上游采购':'Upstream purchasing','车辆履约':'Vehicle fulfilment','下游销售':'Downstream sales','风控':'Risk control',
    '风控预警':'Risk alerts','三方数据源':'Third-party data sources','审核与出库':'Review & outbound','运营审核':'Operations review',
    '出库与供数':'Outbound & data supply','消息':'Messages','消息中心':'Message center','平台配置':'Platform settings','汇率管理':'Exchange rates','运营管理员':'Operations administrator',
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
