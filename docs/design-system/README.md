# Chain Financing 设计系统

本目录是设计侧的**语义说明与约束**：组件 anatomy、状态、组合规则、可访问性与响应式要求。
它是**两个平台共用**的，所以留在仓库顶层，不属于 `asset-platform/` 或 `financial-service-platform/` 任何一方。

**「管理端」「面客端」指的是画布形态，不是平台或端的划分。** 管理端＝高密度控制台画布（固定侧栏、紧凑顶栏、清晰的表格边界）；面客端＝宽容器面客画布（居中宽内容容器、轻量顶栏、较舒展的留白）。四个端按各自的画布形态归入其一，而不是各有一套规范：资产端、金融服务端是面客形态，资产管理端、运营端是控制台形态。因此下面两份组件规范覆盖的是两个平台的全部四个端。

**它不再复述任何具体数值。** token 的唯一来源是 [`asset-platform/prototypes/_shared/tokens.css`](../../asset-platform/prototypes/_shared/tokens.css)；
公共组件的唯一实现是 [`asset-platform/prototypes/_shared/base.css`](../../asset-platform/prototypes/_shared/base.css)。
新增或修改 token、组件先改 `_shared/`，再回来更新本目录的语义说明。

## 分层

| 层 | 位置 | 谁说了算 |
| --- | --- | --- |
| token（颜色 / 字号 / 间距 / 圆角 / 控件高 / 动效） | `asset-platform/prototypes/_shared/tokens.css` | 代码为准 |
| 公共组件（壳层 / 控件 / 表格 / 弹层 / 反馈） | `asset-platform/prototypes/_shared/base.css` | 代码为准 |
| 页面登记表与导航 | 各平台 `prototypes/_shared/registry.js` | 代码为准，按平台隔离 |
| 公共运行时（i18n / 路由 / Toast / 弹层宿主） | `asset-platform/prototypes/_shared/shell.js` | 代码为准 |
| 语义、约束、禁止用法、可访问性 | 本目录 | 文档为准，实现必须遵守 |

模块只写自己的页面、文案、演示数据与状态表；不得在模块内重定义 token、重建导航或复制公共组件。

## 文档入口

| 文档 | 用途 |
| --- | --- |
| [管理端组件规范](harbour-credit-admin-components.md) | 管理端高密度画布下的组件语义与禁止用法 |
| [面客端组件规范](harbour-credit-portal-components.md) | 面客端宽容器、轻导航场景的组件语义与禁止用法 |
| [现有页面继承参考](harbour-credit-page-prototype-reference.md) | 新页面先继承哪套 shell 与 archetype，再做增量 |

## 现有实现

| 模块 | 所属平台 | 文件 | 画布形态 |
| --- | --- | --- | --- |
| 协议管理 | 资产平台 | `asset-platform/prototypes/协议管理/v1.0-协议管理-原型.html` | 管理端（覆盖资产管理端） |
| 账户与登录 | 资产平台 | `asset-platform/prototypes/账户与登录/v1.0-账户与登录-原型.html` | 面客端 + 管理端（覆盖资产端、资产管理端） |
| 消息通知 | 资产平台 | `asset-platform/prototypes/消息通知/v1.0-消息通知-原型.html` | 面客端 + 管理端（覆盖资产端、资产管理端） |
| 实名认证与审核 | 资产平台 | `asset-platform/prototypes/实名认证与审核/v1.0-实名认证与审核-原型.html` | 面客端 + 管理端（覆盖资产端、资产管理端） |
| 应收账款录入与确权 | 资产平台 | `asset-platform/prototypes/应收账款录入与确权/v1.0-应收账款录入与确权-原型.html` | 面客端 + 管理端（覆盖资产端、资产管理端） |
| 协议管理 | 金融服务平台 | `financial-service-platform/prototypes/协议管理/v1.0-协议管理-原型.html` | 管理端（覆盖运营端） |
| 账户与登录 | 金融服务平台 | `financial-service-platform/prototypes/账户与登录/v1.0-账户与登录-原型.html` | 管理端（运营端 focus + app） |
| 消息通知 | 金融服务平台 | `financial-service-platform/prototypes/消息通知/v1.0-消息通知-原型.html` | 管理端（运营端；delta prototype，外部页面与真实接口未接入） |

金融服务平台复用资产平台的 `tokens.css`、`base.css`、`shell.js`，由自己的 [`registry.js`](../../financial-service-platform/prototypes/_shared/registry.js) 登记页面与入口；接入和单文件导出见其 [公共层说明](../../financial-service-platform/prototypes/_shared/README.md)。

资产平台五个模块共用同一份登记表；两平台共用 token、组件与运行时，并各自维护侧栏和跨文件路由。
通知铃铛、快捷面板、消息列表项是**壳层级的全局组件**，实现在 `_shared/` 里。
铃铛与账号下拉的「消息中心」入口在所有模块都渲染；**未读角标与快捷面板只在提供了数据源的模块出现**，
其余模块不编造未读数，点铃铛直接跳到消息通知原型。

## token 总览

具体值一律以 `tokens.css` 为准，这里只说明每组的用途和取值纪律。

| 组 | token | 用途与纪律 |
| --- | --- | --- |
| 字体 | `--sans` `--mono` | 正文与标签用 sans；hash、金额、版本号、时间等结构化短值用 mono |
| 表面 | `--bg` `--bg-elev` `--card` `--card-2` `--card-hover` | 页底 / 浮起面 / 卡片 / 次级卡片 / hover 态，单一浅色体系，无深色底 |
| 边界 | `--border` `--border-strong` `--border-dash` | 固定 1px；`strong` 用于输入控件，`dash` 用于分隔虚线 |
| 文字 | `--text` `--muted` `--faint` | 主 / 次 / 弱三级，不得再新增中间级 |
| 主色 | `--accent` `--accent-strong` `--accent-soft` `--accent-border` | 主操作、当前项、强调背景与描边 |
| 语义 | `--ok` `--warn` `--danger` `--violet` `--pos` 及各自 `-bg` / `-border` | 成功 / 提醒 / 错误 / PRD 面板 / 正向数值；每个语义色都成套使用 |
| 中性块 | `--gray-bg` `--gray-fg` `--gray-border` | 无语义的标签与代码块 |
| 链上值 | `--hash-text` `--hash-bg` `--hash-border` | 仅用于 hash / 地址 / version_id 一类结构化短值 |
| 层级 | `--shadow` `--shadow-lg` `--overlay` | 卡片轻阴影 / 浮层扩散阴影 / 遮罩 |
| 圆角 | `--radius` `--radius-sm` `--radius-xs` `--radius-pill` | 卡片 / 控件 / 小标记 / 胶囊，四档封闭，不得自定义 |
| 字号 | `--fs-10` … `--fs-28` | 阶梯封闭；正文默认字号由 body 承担 |
| 间距 | `--sp-1` … `--sp-8` | 4px 基准的封闭阶梯，卡片内外边距一律取其中的值 |
| 控件 | `--ctrl-h` `--ctrl-h-sm` `--field-gap` `--card-pad` | 控件高与表单节奏，保证同一行控件等高 |
| 动效 | `--dur-fast` `--dur-base` `--dur-slow` `--ease-out` `--ease-in-out` | 只动 `opacity` 与 `transform`；尊重 `prefers-reduced-motion`；焦点环不参与动画 |
| 进度 | `--track` | 进度条与骨架屏底槽 |

`[data-end="asset"]` 会覆盖 `--ctrl-h` / `--ctrl-h-sm` / `--field-gap` / `--card-pad`，
让面客形态在同一套 token 下呈现更松的密度。**两种画布形态的差异只体现在这四个值上，不体现为两套色板。**

承载这个差异的是 `registry.js` 里的 `end` 字段，目前是 `admin` / `asset` 二值——它表达的是**形态**（控制台 / 面客），
不是平台或端。新的端接入时先归入两种形态之一复用现有取值，不要为平台或端本身新增取值；
确有第三种画布形态时再扩枚举，并同步 `shell.js` 的 `data-end` 写入与 `base.css` 的覆盖规则。

## 通用状态与无障碍

每个交互控件都需要 default、hover（只在精确指针下）、focus-visible、active、disabled、loading、error、success。可访问性是组件契约的一部分：

- 使用清晰可见的 label，不以 placeholder 替代；错误文本取代 helper 文本且使用 `aria-invalid`。
- `:focus-visible` 使用 2px、与背景和组件均至少 3:1 的焦点环；不得移除焦点样式。
- 触控可达组件的命中区域不小于 44px；纯图标操作提供可访问名称。
- 错误提示使用 `role="alert"`；公共 `note()` 在 `kind="red"` 时自动补上，也可显式传入其他 role。
- loading 保持原有布局与可读标签；error、disabled、success 不依赖颜色单独表达。
- 中英文、长标题和结构化值允许内容区换行；按钮、顶级导航和 tab 标签保持单行，父容器改为折行或收纳。

## 组合总则

1. 每个信息区只保留一个视觉主操作；次操作使用低强调样式。
2. 卡片内边距、标题到内容、区块到区块一律取 `--sp-*` 阶梯上的值。
3. 结构化短值使用 `--mono`；正文、长说明和标签使用 `--sans`。
4. 表格、卡片、筛选条、反馈表面是 layout primitive，不携带任何领域含义。
5. 小屏把多列卡片与分栏收为单列；数据表改为可读的摘要/卡片式布局，而非水平截断关键内容。
6. 同一个类名只能有一个含义。`.bar` 是进度条；步骤之间的连接线是 `.steps .ln`，不复用 `.bar`。
7. tab 只有一套实现：`.tabs` / `.tab`，等宽并列场景加 `.tabs.even`。不得另起 `.seg-tab` 之类的别名。
8. 页面 ID 一律先在 `registry.js` 登记再实现；模块不得自造未登记的 ID，也不得在模块内重建侧栏菜单。
