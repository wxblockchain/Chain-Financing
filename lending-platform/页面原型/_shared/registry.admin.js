/* ==========================================================================
   registry.admin.js — 借贷平台 · 管理端（运营管理平台）页面登记表与导航
   代币域的 P-O-TC-* / P-O-TI-* / P-O-FX-* / P-O-DS-* 已随代币发行平台移交，
   本登记表不再登记它们；P-O-DS-* 的定义方仍是资产平台，这里只是取消本平台登记。
   资金方机构认证审核、代币质押审核、消息通知的导航位由各自模块登记，本文件不代填。
   ========================================================================== */
(function (CF) {
  CF.PAGES = CF.PAGES || {};
  CF.ENTRY = CF.ENTRY || {};
  CF.NAV = CF.NAV || {};

  var pages = {
    "P-L40": { navKey: "navInstitutionReview", ico: "▣", route: "/ops/institution-reviews" },
    "P-L41": { navKey: "navInstitutionDetail", ico: "▣", route: "/ops/institution-reviews/detail" },
    "P-O06": { navKey: "navOverview", ico: "▤", route: "/ops/overview" },
    "P-O-AG-01": { navKey: "navAgreements", ico: "▧", route: "/ops/agreements" }
  };

  for (var id in pages) {
    var p = pages[id];
    CF.PAGES[id] = { end: "admin", layout: "app", navKey: p.navKey, ico: p.ico };
    CF.ENTRY[id] = p.route;
  }

  CF.PAGES["P-L40"].permission = 5;
  CF.PAGES["P-L41"].permission = 5;
  CF.NAV.admin = ["P-O06", "P-O-AG-01", "P-L40"];
  // Account flows are registered, but never added as business sidebar items.
  var accountPages = [
    ['01', 'navOpsLogin', '/ops/login', 'focus'],
    ['03', 'navOpsFirst', '/ops/first-password', 'focus'],
    ['04', 'navOpsForgot', '/ops/forgot-password', 'focus'],
    ['05', 'navOpsReset', '/ops/reset-password', 'focus'],
    ['06', 'navOpsAccount', '/ops/account', 'app'],
    ['07', 'navOverview', '/ops/account-overview', 'app']
  ];
  accountPages.forEach(function (p) {
    var id = 'P-O-AL-' + p[0];
    CF.PAGES[id] = { end: 'admin', layout: p[3], navKey: p[1], ico: '▤' };
    CF.ENTRY[id] = p[2];
  });
})(window.CF = window.CF || {});
