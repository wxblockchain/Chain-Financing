/* ==========================================================================
   registry.js — 全站页面登记表与导航表（唯一来源）
   任何模块新增页面，必须先在这里登记 page ID，再在模块里实现；
   模块不得自行发明未登记的 ID，也不得在模块内重建导航。

   字段说明
     end     所属端／画布：admin（管理端） / asset（资产端） / ops（运营端画布，WS-313 起）
     layout  版式：app（侧栏+顶栏+内容区） / focus（居中卡片，无侧栏）
     name    页面名 [en, zh]，用于页面目录与面包屑兜底
     nav     该页在侧栏中的归属项；值为某个一级菜单的 page ID。
             页面自身即一级菜单时写自己的 ID；详情/编辑等下级页写其所属菜单 ID。
     navKey  仅一级菜单需要：菜单文案的 i18n key
     icoKey  仅一级菜单需要：ICO 中的 SVG 图标名（与 ico 二选一）
     ico     仅一级菜单需要：直接给出的字符图标（与 icoKey 二选一）
     crumb   面包屑当前级文案 [en, zh]，缺省时用 name
   ========================================================================== */
(function (CF) {

  CF.PAGES = {
    /* ------------------------------ 资产端 ------------------------------ */
    "P-A01": { end: "asset", layout: "focus", name: ["Sign in", "登录页"] },
    "P-A03": { end: "asset", layout: "focus", name: ["Set or reset password · email", "设置/重置密码 · 提交邮箱"] },
    "P-A04": { end: "asset", layout: "focus", name: ["Set or reset password · password", "设置/重置密码 · 设置密码"] },
    "P-A10": { end: "asset", layout: "app", crumb: ["Setup guide", "建号引导"], name: ["Setup guide", "建号后引导页"] },
    "P-A16": { end: "asset", layout: "app", nav: "P-A16", navKey: "navOverview", ico: "▤",
               crumb: ["Overview", "总览"], name: ["Overview", "总览页"] },
    "P-A17": { end: "asset", layout: "app", nav: "P-A17", navKey: "navUserCenter", ico: "◎",
               crumb: ["User center", "用户中心"], name: ["User center", "用户中心"] },
    "P-A11": { end: "asset", layout: "app", crumb: ["Account settings", "账户设置"], name: ["Account settings", "账户设置单页"] },

    /* 实名认证与审核（WS-303）。认证填写与详情均挂在用户中心菜单下。 */
    "P-K01": { end: "asset", layout: "app", nav: "P-A17", name: ["Verification form", "认证填写"] },
    "P-K02": { end: "asset", layout: "app", nav: "P-A17", name: ["Submission received", "提交结果"] },
    "P-K03": { end: "asset", layout: "app", nav: "P-A17", name: ["Verification details", "认证详情"] },

    /* 消息通知（WS-304）。按其 PRD 5.1「不新增左侧菜单项」，这几页不进 CF.NAV，
       入口是顶栏铃铛 C-20 与账号下拉的「消息中心」。文案取自 WS-304 12.3。 */
    "P-A18": { end: "asset", layout: "app", crumb: ["Notifications", "消息中心"],
               name: ["Notifications", "消息中心"] },
    "P-A19": { end: "asset", layout: "app", name: ["Notification details", "消息详情"] },

    /* 应收账款录入与确权（WS-305） */
    "P-A20": { end: "asset", layout: "app", nav: "P-A20", navKey: "navReceivables", ico: "▧",
               crumb: ["My receivables", "我的应收账款"], name: ["My receivables", "我的应收账款列表"] },
    "P-A21": { end: "asset", layout: "app", nav: "P-A20",
               name: ["Add or edit receivable", "新增/编辑应收账款"] },
    "P-A22": { end: "asset", layout: "app", nav: "P-A20",
               name: ["Receivable details", "应收账款详情（卖方视角）"] },
    "P-A23": { end: "asset", layout: "app", nav: "P-A23", navKey: "navConfirmReceivables", ico: "✓",
               crumb: ["Confirm receivables", "待我确权"], name: ["Confirm receivables", "待我确权列表"] },
    "P-A24": { end: "asset", layout: "app", nav: "P-A23",
               name: ["Receivable details", "应收账款详情（买方视角）"] },

    /* ------------------------------ 管理端 ------------------------------ */
    "P-M01": { end: "admin", layout: "focus", name: ["Sign in", "管理端登录页"] },
    "P-M02": { end: "admin", layout: "focus", name: ["First sign-in reset", "首登强制重置密码"] },
    "P-M03": { end: "admin", layout: "focus", name: ["Forgot password · work email", "忘记密码 · 提交工作邮箱"] },
    "P-M04": { end: "admin", layout: "focus", name: ["Forgot password · new password", "忘记密码 · 设置新密码"] },

    /* 管理端账户设置：唯一 ID 为 P-M05。
       历史上协议管理原型曾用 P-M09 指代同一页，已统一到 P-M05，P-M09 作废不再使用。 */
    "P-M05": { end: "admin", layout: "app", nav: "P-M05", navKey: "navAccount", icoKey: "gear",
               crumb: ["Account settings", "账户设置"], name: ["Account settings", "管理端账户设置"] },

    "P-M20": { end: "admin", layout: "app", crumb: ["Notifications", "消息中心"],
               name: ["Notifications", "管理端消息中心"] },
    "P-M21": { end: "admin", layout: "app", name: ["Notification details", "管理端消息详情"] },

    /* 实名认证与审核（WS-303）。个人、企业审核是「用户管理」下的两个二级菜单。 */
    "P-M30": { end: "admin", layout: "app", nav: "P-M30", navKey: "navIdentityReviews", ico: "人",
               crumb: ["Identity reviews", "个人认证审核"], name: ["Identity reviews", "个人认证审核列表"] },
    "P-M31": { end: "admin", layout: "app", nav: "P-M30",
               crumb: ["Identity review", "个人认证审核"], name: ["Identity review details", "个人认证审核详情"] },
    "P-M32": { end: "admin", layout: "app", nav: "P-M32", navKey: "navBusinessReviews", ico: "企",
               crumb: ["Business reviews", "企业认证审核"], name: ["Business reviews", "企业认证审核列表"] },
    "P-M33": { end: "admin", layout: "app", nav: "P-M32",
               crumb: ["Business review", "企业认证审核"], name: ["Business review details", "企业认证审核详情"] },

    /* 应收账款录入与确权（WS-305） */
    "P-M40": { end: "admin", layout: "app", nav: "P-M40", navKey: "navReceivableAdmin", ico: "▦",
               crumb: ["Receivables", "应收账款"], name: ["Receivables", "应收账款列表"] },
    "P-M41": { end: "admin", layout: "app", nav: "P-M40",
               name: ["Receivable details", "应收账款详情"] },

    /* 可信数据同步（WS-313）。资产管理端推送侧三页；运营端收单侧两页。
       运营端的画布端别取 ops：它与 admin 同密度，但侧栏只有本模块交付的资产清单，
       两端在同一份原型里可切换，推送与收单的联动才看得出来。 */
    "P-M-DS-01": { end: "admin", layout: "app", nav: "P-M-DS-01", navKey: "navDataSyncAssets",
               crumb: ["Push confirmed assets", "已确权资产推送"], name: ["Push confirmed assets", "已确权资产推送"] },
    "P-M-DS-02": { end: "admin", layout: "app", nav: "P-M-DS-02", navKey: "navDataSyncBatches",
               crumb: ["Push batches", "推送记录"], name: ["Push batches", "推送记录"] },
    "P-M-DS-03": { end: "admin", layout: "app", nav: "P-M-DS-02",
               crumb: ["Batch details", "推送批次详情"], name: ["Batch details", "推送批次详情"] },
    "P-O-DS-01": { end: "ops", layout: "app", nav: "P-O-DS-01", navKey: "navAssetInventory", ico: "▤",
               crumb: ["Asset inventory", "资产清单"], name: ["Asset inventory", "资产清单"] },
    "P-O-DS-02": { end: "ops", layout: "app", nav: "P-O-DS-01",
               crumb: ["Asset details", "资产详情"], name: ["Asset details", "资产详情"] },

    /* 协议管理（WS-301）。页面编号已按其 PRD 3.3 从 P-M10/P-M11/P-M13 整体迁到模块前缀式
       P-AG-01/02/03：原段位与 WS-303 管理端审核页重号（X-01），P-M1x 全段已交还平台。 */
    "P-AG-01": { end: "admin", layout: "app", nav: "P-AG-01", navKey: "navAgreements", icoKey: "doc",
               crumb: ["Agreements", "协议管理"], name: ["Agreements", "协议列表"] },
    "P-AG-02": { end: "admin", layout: "app", nav: "P-AG-01", name: ["Agreement details", "协议详情"] },
    "P-AG-03": { end: "admin", layout: "app", nav: "P-AG-01", name: ["Version details", "版本编辑页"] }
  };

  /* 侧栏菜单顺序。字符串是一级页面；对象是静态展开的一级分组及其二级页面。
     各模块渲染出的菜单完全一致，只有高亮项不同；指向本模块未实现页面的菜单项
     由 shell 统一渲染为跨文件链接。 */
  CF.NAV = {
    admin: ["P-AG-01", "P-M40",
            { navKey: "navDataSync", ico: "⇄", children: ["P-M-DS-01", "P-M-DS-02"] },
            { navKey: "navUserManagement", ico: "用", children: ["P-M30", "P-M32"] }, "P-M05"],
    ops: ["P-O-DS-01"],
    asset: [
      "P-A16",
      { navKey: "navReceivableGroup", ico: "▧", children: ["P-A20", "P-A23"] },
      "P-A17"
    ]
  };

  /* 模块登记：每个模块的目录、入口文件与名称。
     各模块原型是各自独立可打开的文件，但侧栏是同一份；点到不属于当前文件的页面时，
     shell 会用这里的信息直接跳到对方文件的对应页面，而不是停在占位页。 */
  CF.MODULES = {
    agreements: { dir: "协议管理", file: "v1.0-协议管理-原型.html", name: ["Agreements", "协议管理"] },
    account:    { dir: "账户与登录", file: "v1.0-账户与登录-原型.html", name: ["Account & sign-in", "账户与登录"] },
    kyc:        { dir: "实名认证与审核", file: "v1.0-实名认证与审核-原型.html", name: ["Verification", "实名认证与审核"] },
    notify:     { dir: "消息通知", file: "v1.0-消息通知-原型.html", name: ["Notifications", "消息通知"] },
    receivable: { dir: "应收账款录入与确权", file: "v1.0-应收账款录入与确权-原型.html", name: ["Receivables", "应收账款录入与确权"] },
    datasync:   { dir: "可信数据同步", file: "v1.0-可信数据同步-原型.html", name: ["Trusted data sync", "可信数据同步"] }
  };

  /* 页面 → 所属模块。跨文件跳转和指向页文案都读这张表。 */
  CF.OWNER = {
    "P-AG-01": "agreements", "P-AG-02": "agreements", "P-AG-03": "agreements",
    "P-M01": "account", "P-M02": "account", "P-M03": "account", "P-M04": "account",
    "P-M05": "account",
    "P-A01": "account", "P-A03": "account", "P-A04": "account", "P-A10": "account",
    "P-A11": "account", "P-A16": "account",
    "P-A17": "kyc", "P-K01": "kyc", "P-K02": "kyc", "P-K03": "kyc",
    "P-M30": "kyc", "P-M31": "kyc", "P-M32": "kyc", "P-M33": "kyc",
    "P-A18": "notify", "P-A19": "notify", "P-M20": "notify", "P-M21": "notify",
    "P-A20": "receivable", "P-A21": "receivable", "P-A22": "receivable",
    "P-A23": "receivable", "P-A24": "receivable",
    "P-M40": "receivable", "P-M41": "receivable",
    "P-M-DS-01": "datasync", "P-M-DS-02": "datasync", "P-M-DS-03": "datasync",
    "P-O-DS-01": "datasync", "P-O-DS-02": "datasync"
  };

  /* 页面 → 外部需求。这些页面不属于本仓库的任何原型文件，只在此登记归属，
     由 shell 渲染成标注归属的入口占位页。
     WS-304 的消息中心原本登记在这里，其原型（asset-platform/prototypes/消息通知/）落库后已移出，
     改为正常的跨文件跳转；机制保留给下一个「入口先行、页面后到」的需求。 */
  CF.EXTERNAL = {};

  /* 每个端的消息中心页面 ID。铃铛 C-20 与账号下拉的「消息中心」都读这张表。 */
  CF.MSG_PAGE = { asset: "P-A18", admin: "P-M20" };

  /* 跨文件深链的 hash。模块自定义了 URL 方案时在这里登记对应入口，
     没登记的用默认 #/<小写 page id>。 */
  CF.ENTRY = {
    "P-AG-01": "#/agreements",
    "P-AG-02": "#/agreements",
    "P-AG-03": "#/agreements",
    "P-A18": "#/messages",
    "P-A19": "#/messages",
    "P-M20": "#/admin/messages",
    "P-M21": "#/admin/messages",
    "P-A17": "#/p-a17",
    "P-K01": "#/p-k01",
    "P-K02": "#/p-k02",
    "P-K03": "#/p-k03",
    "P-M30": "#/p-m30",
    "P-M31": "#/p-m31",
    "P-M32": "#/p-m32",
    "P-M33": "#/p-m33",
    "P-A20": "#/receivables",
    "P-A21": "#/receivables/new",
    "P-A22": "#/receivables/detail",
    "P-A23": "#/confirmations",
    "P-A24": "#/confirmations/detail",
    "P-M40": "#/admin/receivables",
    "P-M41": "#/admin/receivables/detail",
    "P-M-DS-01": "#/admin/data-sync/assets",
    "P-M-DS-02": "#/admin/data-sync/batches",
    "P-M-DS-03": "#/admin/data-sync/batches",
    "P-O-DS-01": "#/ops/asset-inventory",
    "P-O-DS-02": "#/ops/asset-inventory"
  };

})(window.CF = window.CF || {});
