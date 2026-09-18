/* ==========================================================================
   registry.portal.js — 借贷平台 · 面客端页面登记表与导航
   面客端与管理端是两个部署单元，各自加载自己这一张登记表，不互相覆盖。
   layout: site（官网层整幅）/ portal（顶栏工作区）/ focus（居中卡片）。
   流程页与详情页由各业务模块在自己的文件里追加登记，不在本文件预先占位。
   ========================================================================== */
(function (CF) {
  CF.PAGES = CF.PAGES || {};
  CF.ENTRY = CF.ENTRY || {};
  CF.NAV = CF.NAV || {};

  var pages = {
    /* 首页。官网层整幅版式，不挂面包屑。 */
    "P-F51": { layout: "site", navKey: "navHome", route: "/" },

    /* 资产广场（已上架代币只读域）。编号取 PRD《资产广场 · 已上架代币只读域》的
       面客子段 P-F-AM-01；模块字母 AM = Asset Marketplace。
       只有列表页进顶栏导航，代币详情页 P-F-AM-02 由该模块在自己的文件里追加登记。 */
    "P-F-AM-01": { layout: "portal", navKey: "navAssets", route: "/assets" },

    /* 借贷广场。未登录访客可浏览，信息不隐藏，动作需登录。 */
    "P-LS-01": { layout: "portal", navKey: "navPlaza", route: "/marketplace" },

    /* 我的控制台。登录后的个人数据聚合页。 */
    "P-MC-01": { layout: "portal", navKey: "navConsole", route: "/console", auth: true },
    "P-F-MC-01": { layout: "portal", crumbKey: "navNotifications", route: "/notifications", auth: true, retainList: true },
    "P-F-MC-02": { layout: "portal", crumbKey: "navNotification", route: "/notification", auth: true, retainList: true }
  };

  for (var id in pages) {
    var p = pages[id];
    CF.PAGES[id] = { end: "asset", layout: p.layout, navKey: p.navKey, crumbKey: p.crumbKey, retainList: p.retainList, auth: !!p.auth };
    CF.ENTRY[id] = p.route;
  }

  /* 顶栏主导航四项。账户设置与机构信息挂账号下拉，不占主导航位；
     流程页与详情页由列表或深链带出，同样不占导航位。 */
  CF.NAV.asset = ["P-F51", "P-F-AM-01", "P-LS-01", "P-MC-01"];
})(window.CF = window.CF || {});
