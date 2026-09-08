# 原型公共层

两个模块原型共用的 token、组件、页面登记表与运行时。**这里是唯一来源**：任何一处改动对所有模块同时生效。

## 文件

| 文件 | 内容 | 改它意味着 |
| --- | --- | --- |
| `tokens.css` | 71 个 CSS 变量：颜色、字体、圆角、字号、间距、控件高、动效 | 改全站视觉基准 |
| `base.css` | 公共组件：壳层、focus 版式、按钮、表单、表格、筛选、分页、Tab、Timeline、步骤、统计卡、上传、骨架屏、Modal / Drawer / Toast、PRD 面板 | 改全站组件 |
| `registry.js` | 全站页面登记表 `CF.PAGES`、侧栏菜单 `CF.NAV`、页面归属 `CF.OWNER` | 改页面 ID 与菜单 |
| `shell.js` | 公共运行时：i18n、状态、路由与 URL 同步、侧栏、面包屑、顶栏、Toast、弹层宿主、状态切换条、通用片段 | 改全站行为 |

## 新增一个模块

1. 在 `registry.js` 里登记页面 ID（`end` / `layout` / `name`，一级菜单再加 `nav` / `navKey` / `icoKey`）。
2. 新建 `prototypes/[模块名]/[版本]-[模块名]-原型.html`，`<head>` 里按顺序引入：

   ```html
   <link rel="stylesheet" href="../_shared/tokens.css">
   <link rel="stylesheet" href="../_shared/base.css">
   <style>/* 只放本模块专有的样式 */</style>
   ```

3. `<body>` 末尾按顺序引入，再写自己的模块脚本：

   ```html
   <script src="../_shared/registry.js"></script>
   <script src="../_shared/shell.js"></script>
   <script>
   (function(){
     var CF = window.CF;
     var t=CF.t, L=CF.L, esc=CF.esc, note=CF.note, pageHead=CF.pageHead, toast=CF.toast /* … */;
     var S;
     /* 本模块的 DICT / PRD / 演示数据 / 页面函数 / STATES */
     CF.define({ id:"…", end:"admin", home:"P-…", owns:["P-…"],
                 dict:DICT, prd:PRD, states:STATES,
                 onBoot:function(st){ S=st; },
                 content:renderContent });
     CF.boot();
   })();
   </script>
   ```

4. `<body>` 结构必须包含 shell 需要的挂载点：
   `#app`（内含 `#brandSub` `#nav` `#topRight` `#crumb` `#content`）、`#layers`；
   有 focus 版式页面时再加一个 `#focus`。

做完这四步，模块就自动获得与现有模块完全一致的 token、壳层、侧栏、路由、URL 同步、
语言切换、Toast、Modal、Drawer、PRD 面板和状态切换条——不需要复制任何一行公共代码。

## 模块接口

`CF.define()` 的完整字段说明见 `shell.js` 头部注释。常用的：

| 字段 | 作用 |
| --- | --- |
| `owns` | 本模块真正实现的页面；不在其中的菜单目标由 shell 渲染成归属指向页 |
| `content()` / `focus()` | 两种版式的页面内容 |
| `modals` / `drawers` | 弹窗与抽屉表（`prd` 抽屉由 shell 提供） |
| `account()` | 顶栏账户菜单的身份与跳转目标 |
| `crumbParts()` / `crumbCur()` | 面包屑的上级层级与当前级文案 |
| `hash` | 自定义 URL 方案；不给就用 `#/<page-id>` |
| `onAct(n,a,v,e)` | 模块自己的 `data-act`；返回 `true` 表示已处理 |
| `state()` / `onBoot(S)` | 模块的初始状态字段，以及拿到共享 state 引用 |

## 纪律

- 模块 `<style>` 里**不允许**出现 `:root`、token 定义，或对 `base.css` 已有类的覆盖。
- 一个类名只能有一个含义。`.bar` 是进度条；步骤连接线是 `.steps .ln`。
- Tab 只有 `.tabs` / `.tab` 一套，等宽并列加 `.tabs.even`。
- 页面 ID 先登记后实现，不在模块内自造。
- 只用传统 `<link>` 与 `<script src>`：**不要**改成 ES module 或 `fetch`，
  否则 `file://` 直接双击打开会被 CORS 拦掉，原型就不能免服务器预览了。
