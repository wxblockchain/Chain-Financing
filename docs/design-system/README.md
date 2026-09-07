# Harbour Credit 组件规范

本目录沉淀 Harbour Credit 两端页面的**组件布局规范**，用于后续页面生成与实现。它只定义视觉语言、组件 anatomy、尺寸、状态和组合规则；不定义或推断产品功能、业务流程、权限、领域字段、菜单或数据语义。

## 文档入口

| 文档 | 适用端 | 使用方式 |
| --- | --- | --- |
| [管理端组件规范](harbour-credit-admin-components.md) | 内部管理端 | 用于紧凑的侧栏、表格、筛选和反馈布局 |
| [面客端组件规范](harbour-credit-portal-components.md) | 公开门户及自助内容层 | 用于宽内容容器、轻量导航和自助内容布局 |
| [现有页面继承参考](harbour-credit-page-prototype-reference.md) | 两端后续页面 | 先选择已生成页面的 shell 与 archetype，再在内容区做增量调整 |

## 输入与边界

| 端侧 | 唯一视觉基线 | 追溯 |
| --- | --- | --- |
| 管理端 | `harbour-credit-admin-console.html` | WS-291 最新附件 `01a06b74-acb5-7ae7-bc59-2852ab617835` |
| 面客端 | `harbour-credit-portal-prototype.html` | WS-289 最新附件 `01a06b63-b52d-7a02-997d-5e8e876c19b0` |

同名历史附件不构成基线。两份文档共享 token 名称与基础控件状态，但不共享 shell：管理端不借用面客端的公开展示布局，面客端不借用管理端的高密度侧栏或操作表格模式。

## 后续页面的使用顺序

两份 HTML 是已经生成的现有页面，后续页面必须在其基础上调整，不重新起一套视觉语言：

1. 阅读[现有页面继承参考](harbour-credit-page-prototype-reference.md)，声明本页继承的端别、shell、archetype 与增量；
2. 再按对应的管理端或面客端组件规范组合控件与状态；
3. 只替换真实页面所需内容，保留已有 shell、token、密度、状态表面和响应式规则。

## 共享 token 基础

| 类别 | Token | 值 / 规则 |
| --- | --- | --- |
| 表面 | `bg` / `surface` / `surface-subtle` | `#F6F7FA` / `#FFFFFF` / `#F9FAFC` |
| 边界 | `border` / `border-strong` | `#E6E9F0` / `#D5DAE4`，固定 1px |
| 文字 | `text` / `muted` / `faint` | `#101828` / `#5A6474` / `#8B94A6` |
| 语义 | `accent` / `positive` / `warning` / `danger` / `violet` | `#2557E8` / `#0B8A76` / `#B54708` / `#D92D20` / `#5925DC` |
| 字体 | `font-sans` | `Inter, -apple-system, Segoe UI, PingFang SC, Microsoft YaHei, system-ui, sans-serif` |
| 结构化值 | `font-mono` | `SF Mono, JetBrains Mono, Roboto Mono, ui-monospace, Menlo, Consolas, monospace` |
| 几何 | spacing / radius | 4px 基准；控件 8–9px、卡片 12px、overlay 14–16px |
| 层级 | `shadow` / `shadow-lg` | 卡片用 1–3px 轻阴影；overlay 用 12px 以上扩散阴影 |
| 动效 | motion | 仅 `opacity` 与 `transform`，150–250ms；尊重 `prefers-reduced-motion`；焦点环不动画 |

## 通用状态与无障碍

每个交互控件都需要 default、hover（只在精确指针下）、focus-visible、active、disabled、loading、error、success。可访问性是组件契约的一部分：

- 使用清晰可见的 label，不以 placeholder 替代；错误文本取代 helper 文本且使用 `aria-invalid`。
- `:focus-visible` 使用 2px、与背景和组件均至少 3:1 的焦点环；不得移除焦点样式。
- 触控可达组件的命中区域不小于 44px；纯图标操作提供可访问名称。
- loading 保持原有布局与可读标签；error、disabled、success 不依赖颜色单独表达。
- 中英文、长标题和结构化值允许内容区换行；按钮、顶级导航和 tab 标签保持单行，父容器改为折行或收纳。

## 组合总则

1. 每个信息区只保留一个视觉主操作；次操作使用低强调样式。
2. 卡片内边距、标题到内容、区块到区块均使用 4px 基准的倍数。
3. 结构化短值使用等宽字体；正文、长说明和标签使用无衬线字体。
4. 表格、卡片、筛选条、反馈表面是 layout primitive，不携带任何领域含义。
5. 小屏把多列卡片与分栏收为单列；数据表改为可读的摘要/卡片式布局，而非水平截断关键内容。
