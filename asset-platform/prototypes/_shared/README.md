# 原型公共层

六个模块原型共用的 token、组件、页面登记表与运行时。**这里是唯一来源**：任何一处改动对所有模块同时生效。

金融服务平台消息通知也直接引用这里的 `tokens.css`、`base.css`、`shell.js`，但使用它自己的 [页面登记层](../../../financial-service-platform/prototypes/_shared/README.md)。修改公共视觉或运行时需同时检查该消费端；资产平台的 `registry.js` 仍只管理资产平台页面。

## 文件

| 文件 | 内容 | 改它意味着 |
| --- | --- | --- |
| `tokens.css` | 71 个 CSS 变量：颜色、字体、圆角、字号、间距、控件高、动效 | 改全站视觉基准 |
| `base.css` | 公共组件：壳层、focus 版式、按钮、表单、表格、筛选、分页、Tab、Timeline、步骤、统计卡、上传、骨架屏、Modal / Drawer / Toast、PRD 面板 | 改全站组件 |
| `registry.js` | 模块登记 `CF.MODULES`、页面登记表 `CF.PAGES`、侧栏菜单 `CF.NAV`、页面归属 `CF.OWNER`、外部需求归属 `CF.EXTERNAL`、消息中心页 `CF.MSG_PAGE`、跨文件入口 `CF.ENTRY` | 改页面 ID、菜单、跨文件跳转与外部占位页 |
| `shell.js` | 公共运行时：i18n、状态、路由与 URL 同步、侧栏、面包屑、顶栏、通知铃铛与快捷面板、消息列表项、Toast、弹层宿主、状态切换条、通用片段 | 改全站行为 |

## 和 docs/design-system/ 的分工

**两边都要看，但问的问题不同。**

`_shared/` 回答「长什么样、怎么写」——引用 token、套用 base.css 的类，结果自然一致，不需要查文档确认数值。

[`docs/design-system/`](../../../docs/design-system/) 回答「该用哪个、什么不能做」——这类判断代码强制不了：
`base.css` 不会阻止你在一个信息区放两个 primary 按钮，也不会告诉你这个场景该用 Drawer 还是 Modal。

| 你想知道的 | 去哪里 |
| --- | --- |
| 某个颜色 / 圆角 / 间距 / 控件高是多少 | `tokens.css`，直接引用 token，不必查文档 |
| 按钮、表格、弹窗、Tab 的类名和写法 | `base.css` + 本文件 |
| 怎么把新模块接进来 | 本文件「新增一个模块」 |
| 这个场景该用 Drawer 还是 Modal、统计卡放几列 | [组件规范](../../../docs/design-system/)的「组合规则」列 |
| 什么是明确禁止的 | 组件规范的「禁止用法」列 |
| 新页面从哪个 shell / archetype 开始 | [现有页面继承参考](../../../docs/design-system/harbour-credit-page-prototype-reference.md) |
| 可访问性与响应式的硬性契约 | [设计系统 README](../../../docs/design-system/README.md) 的「通用状态与无障碍」「组合总则」 |

### 新增模块时的阅读顺序

1. 本文件——接入四步 + 纪律；
2. [现有页面继承参考](../../../docs/design-system/harbour-credit-page-prototype-reference.md) 第 3–5 节——声明本模块每一页继承哪套 shell 与 archetype；
3. 对应端别的组件规范——**只读本页会用到的组件行**，重点看「禁止用法」和「组合规则」两列；
4. [设计系统 README](../../../docs/design-system/README.md) 的「通用状态与无障碍」「组合总则」——每页交付前对一遍的检查清单。

不需要通读，四份文档合计约 420 行。文档里已经没有任何数值，抄不到也不用抄。

## 新增一个模块

1. 在 `registry.js` 里登记：
   - `CF.MODULES` 加一条本模块的 `dir` / `file` / `name`；
   - `CF.PAGES` 登记页面 ID（`end` / `layout` / `name`，一级菜单再加 `nav` / `navKey` / `icoKey`）；
   - `CF.NAV` 的普通一级项直接写页面 ID；需要常驻展开的一级/二级分组写 `{ navKey, ico, children:[页面 ID] }`，二级页仍通过 `CF.PAGES` 的 `navKey` 取文案；
   - `CF.OWNER` 把这些页面指向本模块；自定义了 URL 方案的再在 `CF.ENTRY` 登记跨文件入口 hash。
2. 新建 `asset-platform/prototypes/[模块名]/[版本]-[模块名]-原型.html`，`<head>` 里按顺序引入：

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
语言切换、Toast、Modal、Drawer、PRD 面板和状态切换条——不需要复制任何一行公共代码，
也会自动出现在其他模块的侧栏里、并且互相点得过去。

## 顶栏铃铛与消息中心

顶栏右侧固定顺序 `[铃铛] [语言下拉] [账号下拉]`，账号下拉为「消息中心 / 账户设置 / 退出登录」。
两者都由公共层渲染，任何模块接入后自动获得，不需要各自实现。

- 点铃铛或「消息中心」落到 `CF.MSG_PAGE` 指定的页面（资产端 `P-A18`、管理端 `P-M20`）。
  这两页由 `asset-platform/prototypes/消息通知/` 交付，不在本文件里时按跨文件规则**真的跳过去**。
- **铃铛的完整形态（未读角标 + 快捷面板 C-21）只在模块实现了 `notify()` 时渲染**；
  其余模块保留铃铛的位置与形态但**不渲染角标**——公共层不替没有数据源的模块编造未读数。
- `notify()` 返回 `{ unread, phase, items }`，面板内的「打开某条 / 重试 / 查看全部」
  由公共层处理，模块只需再提供 `notifyOpen(id)` 与 `notifyRetry()`。
- 消息列表项 `CF.msgItem()` 是同一个组件：快捷面板与消息中心列表共用，
  两处的未读点、分类标签、进度四态标签、时间口径因此不会走样。
- `CF.EXTERNAL` 是「入口先行、页面后到」的兜底机制（页面渲染成标注归属的占位页）。
  WS-304 落库后这张表已清空，机制保留给下一个同类需求。

## 侧栏是一份，文件是多份

六份原型各自是独立可打开的文件，但同一端的侧栏菜单来自同一张 `CF.NAV`，所以各文件渲染出的菜单完全一致；`CF.NAV` 同时支持普通平级项和常驻展开的一级/二级分组。
点到不属于当前文件的菜单项时，shell 会按 `CF.MODULES` + `CF.ENTRY` 生成相对地址，
**直接跳到对方原型文件的对应页面**（例如从协议管理点「账户设置」→ `../账户与登录/…#/p-m05`），
而不是停在占位页。顶栏账户菜单里的「账户设置」同理。

这要求各模块目录是同级的，且都在本地存在——从仓库直接打开或整个 `asset-platform/prototypes/` 一起拷走都满足。
只单独拷走一个 HTML 时，跨文件链接会失效，`_shared/` 也加载不到，请整目录一起拷。

用 URL 直接落到不属于本文件的页面时，会看到一张说明归属的兜底页，上面有跳转按钮。

## 模块接口

`CF.define()` 的完整字段说明见 `shell.js` 头部注释。常用的：

| 字段 | 作用 |
| --- | --- |
| `owns` | 本模块真正实现的页面；不在其中的菜单目标由 shell 渲染成指向对方文件的链接 |
| `content()` / `focus()` | 两种版式的页面内容 |
| `modals` / `drawers` | 弹窗与抽屉表（`prd` 抽屉由 shell 提供） |
| `account()` | 顶栏账户菜单的身份与跳转目标；`settings` 可省略，省略时不渲染账户设置项 |
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
