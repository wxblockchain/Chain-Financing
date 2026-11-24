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
      // M4 合同信息（WS-659）：已登记于 M2 PRD F-OP-11 菜单表（fa536c94）。
      {key:'contracts', label:'合同信息',   icon:'ledger'},
      {key:'vehicles',  label:'车辆履约',   icon:'truck'},
      // M12 提单信息（WS-661）：已登记于 M2 PRD F-OP-11 菜单表（fa536c94）。
      {key:'bills',     label:'提单信息',   icon:'ship'},
      // M13 保单信息（WS-662）：已登记于 M2 PRD F-OP-11 菜单表（fa536c94）。
      {key:'policies',  label:'保单信息',   icon:'umbrella'},
      // M14 资金收付（WS-663）：已登记于 M2 PRD F-OP-11 菜单表（fa536c94）。
      {key:'funds',     label:'资金收付',   icon:'wallet'}
    ]},
    {group:'风控', items:[
      // 角标为当前未处理风控预警条数（M8 F-M8-05），评审演示值；接入时由风控预警模块提供，全体运营相同。
      {key:'alerts',    label:'风控预警',   icon:'alert', pendingCount:5},
      // M8 风控规则配置（F-M8-19，WS-609）：已登记于 M2 PRD F-OP-11 菜单表，位于“风控预警”之后。
      {key:'rules',     label:'风控规则',   icon:'sliders'},
      {key:'sources',   label:'三方数据源', icon:'database'}
    ]},
    {group:'审核', items:[
      // 角标为全平台待运营审核笔数（M9 F-M9-01），评审演示值；接入时由 M9 运营审核与资产推送提供。
      {key:'review',    label:'运营审核',   icon:'shield', pendingCount:4}
    ]},
    // M15 数据监控（WS-610）：已登记于 M2 PRD F-OP-11 菜单表（b693d078）。角标：数据接入为异常接口个数、数据推送为存证失败笔数（F-M15-05），评审演示值。
    {group:'数据监控', items:[
      {key:'monitor',   label:'监控概览',   icon:'chart'},
      {key:'intake',    label:'数据接入',   icon:'plug', pendingCount:1},
      {key:'push',      label:'数据推送',   icon:'send', pendingCount:1}
    ]},
    // M11 汇率管理（WS-612）：已登记于 M2 PRD F-OP-11 菜单表（2026-11-13 修订）。
    {group:'平台配置', items:[
      {key:'fx',        label:'汇率管理',   icon:'fx'}
    ]}
  ];
  TP.addCopy({
    '资产可信平台':'Asset Trust Platform','运营端':'Operations',
    '企业':'Enterprises','企业管理':'Enterprise management','资产数据':'Asset data','应收账款':'Receivables',
    '上游采购':'Upstream purchasing','合同信息':'Contracts','车辆履约':'Vehicle fulfilment','提单信息':'Bills of lading','资金收付':'Payments & receipts','保单信息':'Policy information','下游销售':'Downstream sales','风控':'Risk control',
    '风控预警':'Risk alerts','风控规则':'Risk rules','三方数据源':'Third-party data sources','审核':'Review','运营审核':'Operations review',
    '数据监控':'Data monitoring','监控概览':'Monitoring overview','数据接入':'Data intake','数据推送':'Data push','消息':'Messages','消息中心':'Message center','平台配置':'Platform settings','汇率管理':'Exchange rates','运营管理员':'Operations administrator',
    '账户设置':'Account settings','退出登录':'Sign out'
  });
  TP.NAV_BY = {ops:ops};
  // 账号入口的演示数据：姓名、登录邮箱由开发人员分配，角色固定为运营管理员。
  TP.demo = TP.demo || {};
  TP.demo.accounts = {
    // 消息中心（M10）不在侧栏菜单，放在账号入口“账户设置”下面（用户 2026-11-13 确认，WS-611）。
    ops:{name:'运营示例账号', email:'ops-demo@example.com', roles:['运营管理员'], settingsLabel:'账户设置', messagesLabel:'消息中心'},
    // 首次登录强制改密的受限登录：只有登录邮箱与退出登录，不显示菜单。
    opsinit:{restricted:true, email:'new-ops@example.com'}
  };
})(window.TP = window.TP || {});
