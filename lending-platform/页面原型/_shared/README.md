# 借贷平台原型公共层

本轮详情承载与跨页返回的接入约定见[详情与跨页关联基线](design-system/详情与跨页关联基线.md)。独立详情、记录速览及短确认分别演示；样板业务样例不替代模块 PRD。

**页面接入必读：** [面客工作区组件规范 §0：阅读顺序、样板版本、逐页继承](design-system/面客工作区组件规范.md#0-必读入口顺序与样板版本) → [§5.1：内嵌布局与加载策略](design-system/面客工作区组件规范.md#51-内嵌布局与数据加载必须分别决定) → [§8：浏览器验收](design-system/面客工作区组件规范.md#8-响应式验收)。资产广场按已确认 PRD 使用全断点内嵌连续追加，每批20条；加载范围和位置随视图链接恢复。

本层是借贷平台**自持**的原型底座：token、公共组件与整页骨架、公共运行时、两张页面登记表、导出脚本，以及本平台的设计规范。不再引用 `asset-platform/prototypes/_shared/` 或任何其他平台的公共层。

| 内容 | 唯一来源 |
| --- | --- |
| token | [`tokens.css`](tokens.css) |
| 公共组件与四种整页骨架 | [`base.css`](base.css) |
| 公共运行时（i18n / 路由 / 导航 / Toast / 弹层宿主 / 演示工具） | [`shell.js`](shell.js) |
| 面客端页面登记与导航 | [`registry.portal.js`](registry.portal.js) |
| 管理端页面登记 | [`registry.admin.js`](registry.admin.js) |
| 管理端共享菜单、目标文件、查询权限编号及邮箱账户菜单 | [`admin-menu.js`](admin-menu.js) |
| 管理端消息铃铛、预览、未读数量与已读状态 | [`admin-notifications.js`](admin-notifications.js) |
| 管理端消息虚构记录与分类 | [`admin-message-data.js`](admin-message-data.js) |
| 语义、约束、禁止用法、可访问性 | [`design-system/`](design-system/README.md) |
| 四种 shell 与状态表面的母版 | [`样板/底座样板.html`](样板/底座样板.html) |

## 两个部署单元

面客端与管理端分开上线，**各自只加载自己那张登记表**。两端共用同一份 `tokens.css` / `base.css` / `shell.js`，差异只落在 `[data-end]` 覆盖的密度与正文字号上，不是两套色板。

`registry` 的 `end` 表达部署单元与画布形态：`asset` = 面客端，`admin` = 管理端。`layout` 表达整页骨架：`site` / `portal` / `app` / `focus`。

## 接入一个模块

模块放在 `面客端/[功能名]/` 或 `管理端/[功能名]/`。先在对应登记表里登记页面与入口锚点；管理端菜单统一在 `admin-menu.js` 维护。加载顺序：

```html
<link rel="stylesheet" href="../../_shared/tokens.css">
<link rel="stylesheet" href="../../_shared/base.css">
<style>/* 仅本模块专有样式，禁止覆盖 token 或公共组件 */</style>
<!-- 沿用公共运行时要求的挂载点：portal / app / nav / anav / tools / atools / crumb / acrumb / content / acontent / layers / toasts / demoBtn / demoPanel -->
<script src="../../_shared/registry.portal.js"></script>
<script src="../../_shared/shell.js"></script>
<script>/* CF.define({ id, dict, layers, content, onAct }) + CF.boot()，不重建导航 */</script>
```

管理端业务模块依次加载 `registry.admin.js`、`shell.js`、`admin-menu.js`、`admin-message-data.js`、`admin-notifications.js`，最后加载业务脚本。根元素通过 `data-admin-module` 标识当前模块；需要同时演示两端时两张登记表都加载，面客菜单保持原样。

## 管理端共享菜单（2026-09-21）

`admin-menu.js` 为当前五个管理端业务模块的唯一菜单维护位置：总览、机构认证审核、代币质押审核、协议管理为侧栏入口；消息中心和账户设置为顶部账户菜单入口。详情沿登记表的父级链高亮所属菜单。侧栏底部不再展示账户信息，账户操作保留在顶部。底座样板的历史导航只是样板展示，不参与业务模块菜单配置。

实际接入：`管理端/账户与登录/`、`资金方机构认证审核/`、`代币质押审核/`、`消息通知/`、`协议管理/`。模块不再通过覆盖 `CF.NAV.admin` 来裁剪整个菜单；现有 `allowNav` 继续提供本模块的查询权限判断及路由根，账户模块按 `CF.opsAuth.can` 过滤共享入口。其他独立业务原型的演示身份与权限仍由各自模块控制，本次未合并认证状态或授权数据。源码跨模块通过真实相对 HTML 链接跳转；离开协议未保存草稿仍需确认，审核编辑中的跳转保持阻断。

管理端导出自动读取同一清单，内联全部五个目标源文件。`admin-bundle.js` 仅用于单文件导出中的文档切换、计时器清理与历史导航，不引入第二份业务实现或评审选择器。原型文件间切换遵循整页加载语义：未持久化的演示身份、临时状态会重新初始化，账户入口可能要求重新登录；真实统一会话需后端接入。后续更新菜单或模块源码后重新运行 `export.py` 即可。

### 共享消息与账户工具（WS-360 修订）

上述五模块的顶栏统一由公共壳层组合：消息铃铛 → 语言 → 邮箱地址。`admin-menu.js` 维护账户菜单；悬浮、点击或键盘打开后显示只读角色，管理员显示“管理员”，运营专员仍显示其实际角色。身份优先读取账户宿主；独立业务原型读取上次演示邮箱，首次使用 `operator@example.com`。该邮箱快照仅用于展示，不提供认证或业务授权。

`admin-notifications.js` 是铃铛、最近 10 条预览、未读角标与已读标记的唯一实现。消息列表及详情通过 `CF.opsNotifications` 使用同一记录池与已读存储；记录和分类保存在 `hc.ops.message-pool.v1`，已读状态继续按邮箱存放于 `hc.ops.messages.v1.*`。同一浏览器存储范围内跨模块、刷新及多标签同步；真实跨设备消息由后端接入。展开预览不标记已读，成功读取详情后才更新，零条隐藏角标，超过 99 条显示 `99+`。

模块可用 `configure` 提供本模块权限与失败演示，用 `replaceRows` 更新演示记录，不自建铃铛或复制消息数据。`CF.refreshAdminTools()` 只更新顶栏，不重绘正文，避免悬浮菜单、预览及计数刷新丢失表单内容；跨模块消息入口同样经过 `beforeAdminNavigate` 离开保护。账户或消息权限不可用时相应入口隐藏。登录、首登和找回页沿用 focus 布局。

修订后须重新导出 HTML：旧附件是静态快照，不会随共享源码更新。本次修订附件内联全部五个最新模块，可直接检查跨模块消息及账户菜单。

模块接口：

| 字段 | 说明 |
| --- | --- |
| `id` | 模块标识，仅用于调试 |
| `dict` | `{ en:{}, zh:{} }` 文案，合并进公共字典 |
| `content(pageId)` | 返回该页内容区 HTML |
| `layers` | `{ key: fn }` 抽屉与弹窗内容表 |
| `onAct(act, value, event)` | 模块自己的点击动作；返回 `true` 表示已处理 |
| `breadcrumbRoute(pageId)` | 可选：返回父级页面的模块内路由（不含 `#`），保留所选记录、筛选及列表状态；默认使用 `CF.ENTRY[pageId]` |
| `allowNav(pageId)` | 可选：在登记表内按模块范围与查询权限过滤导航，不自行生成菜单 |
| `adminContext()` | 可选：共享管理端返回 `{email, role, signedIn}` 的必要覆盖项；省略时读取账户宿主或展示快照。历史样板的 `name / subtitle / hideNotifications` 仅用于旧壳层回退，不控制已接入共享层的消息入口 |
| `beforeAdminNavigate(proceed)` | 可选：跨模块跳转前校验未保存编辑或进行中操作，允许离开时调用 `proceed()` |
| `demoOnly` + `demo()` | 可选：独立模块只使用自己的默认关闭演示面板，不展示无关部署单元切换 |

公共层提供的片段：`CF.tag` / `CF.note` / `CF.empty` / `CF.skelTable` / `CF.surface`（六种状态表面）/ `CF.toast` / `CF.openLayer` / `CF.closeLayer` / `CF.fmtDate` / `CF.fmtTime` / `CF.fmtAmt` / `CF.esc` / `CF.L`。模块不得重新实现其中任何一项。

## 面包屑与上级返回

详情与流程页面在 `CF.PAGES[pageId].parent` 声明真实父页面 ID；不登记成新增菜单。共享壳层根据父级链渲染面包屑，以当前部署单元可用导航首项为根；使用明确路由，直接打开深链也能返回。已有查询参数优先沿用 `CF.ENTRY`，需要记录 ID 或视图参数时由 `breadcrumbRoute(pageId)` 返回。返回继续经过模块既有路由守卫，不调用 `history.back()`；模块不得重绘公共面包屑。

祖先使用可聚焦链接，当前页使用 `aria-current="page"` 非链接文字；分隔符对读屏隐藏。窄屏只收起较远祖先，保留直接上级与当前页，长标题可换行。新接入默认通过面包屑返回，不再附加「返回上级」按钮；资产详情既有返回入口按下节确认约定保留。管理端挂在页面内容区 `#acontent` 内、标题上方，与正文左边界对齐并随内容滚动；顶部工具栏只承载全局工具。公共层在内容重绘后维护 `#acrumb`，模块不自行移动或重绘。历史 site 骨架及居中登录页不增加面包屑；当前产品已移除首页，面客导航以资产广场为根，旧根地址兼容跳转。

## 资产广场连续追加接入

本模块已确认布局、默认入口及返回约定见[组件规范 §5.4](design-system/面客工作区组件规范.md#54-资产广场已确认组合与返回契约)。资产详情保留整宽纵向分区和既有返回链接；共享详情组合仅为可选项，不能覆盖这些确认结果。

`base.css` 的可选修饰类 `.listbox-contained` 在所有断点保留内嵌高度与滚动；当前资产广场样板与业务模块启用。其他列表未启用时保持各自现有窄屏策略。卡片形态与内外滚动是不同维度，不能因转卡片而移除内滚。

资产广场复用 `.loadmore` 尾部外观与 `CF.moreFoot` 结束状态；正常下滑自动追加，不展示加载按钮，独立动作 `am-more` 仅用于失败重试。异步请求不交给样板的同步 `more` 哨兵；已有记录和汇总在追加时保持。恢复必须先按 URL 重建已加载范围，再恢复位置，不能只读取本地会话缓存，也不能仅因恢复到尾部自动追加；继续下滑才触发。详细契约见[组件规范 §5.1](design-system/面客工作区组件规范.md#51-内嵌布局与数据加载必须分别决定)及[资产模块接入说明](../面客端/资产广场/README.md#2026-09-20--下滑自动追加)。

资产广场当前九字段、编号复制与整行导航、数量单位及详情宽度约定见[组件规范 §5.2](design-system/面客工作区组件规范.md#52-资产广场编号与整行交互2026-09-20)；登录导航与本轮实际来源版本见[模块接入说明](../面客端/资产广场/README.md#2026-09-20--五点反馈增量)。业务反馈冲突不得通过修改样板或删除其他页面资料来消解。

## 导出独立评审附件

在 `lending-platform/页面原型/` 下执行（Python 3.9+，标准库，无构建依赖）：

```bash
python3 _shared/export.py \
  --source _shared/样板/底座样板.html \
  --output ../../../deliverables/借贷平台-原型底座样板.html
```

输出 HTML 从当前源文件内联 CSS / JS，单文件双击可开，无网络依赖。**生成件不放回仓库**，避免出现第二份可编辑的公共代码；源更新后重新执行导出即可。该脚本只处理本仓库采用的普通 stylesheet link / script src 写法，不是通用打包器，也不收录远程资源。

## 参考基线

本层承接自 `cly-V1.0.0` 的 `asset-platform/prototypes/_shared/` 与 `financial-service-platform/prototypes/_shared/`：变量名与语义分层保留，取值重做，运行时按本平台的两个部署单元重写。代币域的 `P-O-TC-*` / `P-O-TI-*` / `P-O-FX-*` / `P-O-DS-*` 已随代币发行平台移交，本平台登记表不再登记。

## 消息中心接入

面客消息快照与角标由 `shell.js` 持有；模块通过 `CF.notifications` 提供演示记录与预览。`CF.define` 可用 `pages` 声明自己承载的页，其他页面委托此前注册的模块；可选钩子为 `beforeRender`、`afterRender`、`onRoute`、`onBeforeAct`、`demo`。组合装载时先设 `CF.deferBoot = true`，最后统一启动。母版内容区维护于 `sample-pages.js`；原母版 HTML 只引用，禁止复制成第二份可编辑内容源。

母版与资产广场已接入同一份消息模块。详见[消息中心说明](../面客端/消息中心/README.md)。共享层更新后重新导出受影响的单文件附件。
