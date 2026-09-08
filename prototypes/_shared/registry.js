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

    /* 消息中心：页面本身归 WS-304《消息通知》，本仓库暂无对应原型文件。
       这里登记只为让铃铛 C-20 与账号下拉的「消息中心」有确定的跳转目标。 */
    "P-A18": { end: "asset", layout: "app", crumb: ["Message center", "消息中心"], name: ["Message center", "消息中心"] },

    /* ------------------------------ 管理端 ------------------------------ */
    "P-M01": { end: "admin", layout: "focus", name: ["Sign in", "管理端登录页"] },
    "P-M02": { end: "admin", layout: "focus", name: ["First sign-in reset", "首登强制重置密码"] },
    "P-M03": { end: "admin", layout: "focus", name: ["Forgot password · work email", "忘记密码 · 提交工作邮箱"] },
    "P-M04": { end: "admin", layout: "focus", name: ["Forgot password · new password", "忘记密码 · 设置新密码"] },

    /* 管理端账户设置：唯一 ID 为 P-M05。
       历史上协议管理原型曾用 P-M09 指代同一页，已统一到 P-M05，P-M09 作废不再使用。 */
    "P-M05": { end: "admin", layout: "app", nav: "P-M05", navKey: "navAccount", icoKey: "gear",
               crumb: ["Account settings", "账户设置"], name: ["Account settings", "管理端账户设置"] },

    "P-M20": { end: "admin", layout: "app", crumb: ["Message center", "消息中心"], name: ["Message center", "消息中心"] },

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

  /* 模块登记：每个模块的目录、入口文件与名称。
     两份原型是各自独立可打开的文件，但侧栏是同一份；点到不属于当前文件的页面时，
     shell 会用这里的信息直接跳到对方文件的对应页面，而不是停在占位页。 */
  CF.MODULES = {
    agreements: { dir: "协议管理", file: "v1.0-协议管理-原型.html", name: ["Agreements", "协议管理"] },
    account:    { dir: "账户与登录", file: "v1.0-账户与登录-原型.html", name: ["Account & sign-in", "账户与登录"] }
  };

  /* 页面 → 所属模块。跨文件跳转和指向页文案都读这张表。 */
  CF.OWNER = {
    "P-M10": "agreements", "P-M11": "agreements", "P-M13": "agreements",
    "P-M01": "account", "P-M02": "account", "P-M03": "account", "P-M04": "account",
    "P-M05": "account",
    "P-A01": "account", "P-A03": "account", "P-A04": "account", "P-A10": "account",
    "P-A11": "account", "P-A16": "account", "P-A17": "account"
  };

  /* 页面 → 外部需求。这些页面不属于本仓库的任何原型文件，只在此登记归属，
     由 shell 渲染成标注归属的入口占位页。 */
  CF.EXTERNAL = {
    "P-A18": { req: "WS-304", name: ["Notifications", "消息通知"] },
    "P-M20": { req: "WS-304", name: ["Notifications", "消息通知"] }
  };

  /* 每个端的消息中心页面 ID。铃铛 C-20 与账号下拉的「消息中心」都读这张表。 */
  CF.MSG_PAGE = { asset: "P-A18", admin: "P-M20" };

  /* 跨文件深链的 hash。模块自定义了 URL 方案时在这里登记对应入口，
     没登记的用默认 #/<小写 page id>。 */
  CF.ENTRY = {
    "P-M10": "#/agreements",
    "P-M11": "#/agreements",
    "P-M13": "#/agreements"
  };

})(window.CF = window.CF || {});
