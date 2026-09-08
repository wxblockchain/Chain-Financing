/* ==========================================================================
   registry.js — 全站页面登记表与导航表（唯一来源）
   任何模块新增页面，必须先在这里登记 page ID，再在模块里实现；
   模块不得自行发明未登记的 ID，也不得在模块内重建导航。

   字段说明
     end     所属端：admin（管理端） / asset（资产端）
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

    /* ------------------------------ 管理端 ------------------------------ */
    "P-M01": { end: "admin", layout: "focus", name: ["Sign in", "管理端登录页"] },
    "P-M02": { end: "admin", layout: "focus", name: ["First sign-in reset", "首登强制重置密码"] },
    "P-M03": { end: "admin", layout: "focus", name: ["Forgot password · work email", "忘记密码 · 提交工作邮箱"] },
    "P-M04": { end: "admin", layout: "focus", name: ["Forgot password · new password", "忘记密码 · 设置新密码"] },

    /* 管理端账户设置：唯一 ID 为 P-M05。
       历史上协议管理原型曾用 P-M09 指代同一页，已统一到 P-M05，P-M09 作废不再使用。 */
    "P-M05": { end: "admin", layout: "app", nav: "P-M05", navKey: "navAccount", icoKey: "gear",
               crumb: ["Account settings", "账户设置"], name: ["Account settings", "管理端账户设置"] },

    "P-M10": { end: "admin", layout: "app", nav: "P-M10", navKey: "navAgreements", icoKey: "doc",
               crumb: ["Agreements", "协议管理"], name: ["Agreements", "协议列表"] },
    "P-M11": { end: "admin", layout: "app", nav: "P-M10", name: ["Agreement details", "协议详情"] },
    "P-M13": { end: "admin", layout: "app", nav: "P-M10", name: ["Version details", "版本编辑页"] }
  };

  /* 侧栏一级菜单顺序。两个模块渲染出的菜单完全一致，只有高亮项不同；
     指向本模块未实现页面的菜单项由 shell 统一渲染为「归属指向页」。 */
  CF.NAV = {
    admin: ["P-M10", "P-M05"],
    asset: ["P-A16", "P-A17"]
  };

  /* 各页面归属的模块目录名，用于生成指向页文案 */
  CF.OWNER = {
    "P-M10": ["协议管理", "Agreements"], "P-M11": ["协议管理", "Agreements"], "P-M13": ["协议管理", "Agreements"],
    "P-M01": ["账户与登录", "Account & sign-in"], "P-M02": ["账户与登录", "Account & sign-in"],
    "P-M03": ["账户与登录", "Account & sign-in"], "P-M04": ["账户与登录", "Account & sign-in"],
    "P-M05": ["账户与登录", "Account & sign-in"],
    "P-A01": ["账户与登录", "Account & sign-in"], "P-A03": ["账户与登录", "Account & sign-in"],
    "P-A04": ["账户与登录", "Account & sign-in"], "P-A10": ["账户与登录", "Account & sign-in"],
    "P-A11": ["账户与登录", "Account & sign-in"], "P-A16": ["账户与登录", "Account & sign-in"],
    "P-A17": ["账户与登录", "Account & sign-in"]
  };

})(window.CF = window.CF || {});
