/* ==========================================================================
   registry.admin.js — 借贷平台 · 管理端（运营管理平台）页面登记表与导航
   代币域的 P-O-TC-* / P-O-TI-* / P-O-FX-* / P-O-DS-* 已随代币发行平台移交，
   本登记表不再登记它们；P-O-DS-* 的定义方仍是资产平台，这里只是取消本平台登记。
   本文件登记页面与父级。当前管理端业务菜单统一由 admin-menu.js 维护。
   ========================================================================== */
(function (CF) {
  CF.PAGES = CF.PAGES || {};
  CF.ENTRY = CF.ENTRY || {};
  CF.NAV = CF.NAV || {};

  var pages = {
    "P-O20": { navKey: "navOpsMessages", route: "/ops/notifications" },
    "P-O21": { navKey: "navOpsMessageDetail", parent: "P-O20", route: "/ops/notification" },
    "P-O-PR-01": { navKey: "navPledgeReviews", ico: "▤", route: "/ops/pledge-reviews" },
    "P-O-PR-02": { navKey: "navPledgeReviewDetail", parent: "P-O-PR-01", route: "/ops/pledge-reviews/detail" },
    "P-O-CM-01": { navKey: "navContractQueue", ico: "▦", route: "/ops/contract-reviews" },
    "P-O-CM-02": { navKey: "navContractDetail", parent: "P-O-CM-01", route: "/ops/contract-reviews/detail" },
    "P-O-CM-03": { navKey: "navContractLedger", ico: "▦", route: "/ops/contract-ledger" },
    "P-O-FC-01": { navKey: "navFinancingParameters", ico: "▩", route: "/ops/financing-parameters" },
    "P-O-FC-02": { navKey: "navParameterDetail", parent: "P-O-FC-01", route: "/ops/financing-parameters/detail" },
    "P-O-FC-03": { navKey: "navParameterEdit", parent: "P-O-FC-02", route: "/ops/financing-parameters/edit" },
    "P-L40": { navKey: "navInstitutionReview", ico: "▣", route: "/ops/institution-reviews" },
    "P-L41": { navKey: "navInstitutionDetail", parent: "P-L40", ico: "▣", route: "/ops/institution-reviews/detail" },
    "P-O06": { navKey: "navOverview", ico: "▤", route: "/ops/overview" },
    "P-O-AG-01": { navKey: "navAgreements", ico: "▧", route: "/ops/agreements" },
    "P-O-AG-02": { navKey: "navAgreementDetail", parent: "P-O-AG-01", route: "/ops/agreements/detail" },
    "P-O-AG-03": { navKey: "navAgreementEdit", parent: "P-O-AG-02", route: "/ops/agreements/edit" },
    "P-O-AG-04": { navKey: "navAgreementVersion", parent: "P-O-AG-02", route: "/ops/agreements/version" }
  };

  for (var id in pages) {
    var p = pages[id];
    CF.PAGES[id] = { end: "admin", layout: "app", navKey: p.navKey, parent: p.parent, ico: p.ico };
    CF.ENTRY[id] = p.route;
  }

  // Historical base sample only; all five business entries load admin-menu.js.
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
