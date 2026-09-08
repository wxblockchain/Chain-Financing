# Harbour Credit 管理端组件规范

## 1. 范围与视觉口径

本规范面向管理端的组件语义与禁止用法。实现以 `prototypes/_shared/base.css` 为准，token 以 `prototypes/_shared/tokens.css` 为准；本文不复述数值。

现有实现：`prototypes/协议管理/v1.0-协议管理-原型.html`（管理端画布、列表 / 详情 / 编辑）。

管理端的核心特征是：浅色应用底、固定侧栏、紧凑顶栏、白色卡片、清晰表格边界、蓝色主操作、青绿正向状态以及对结构化值的等宽排版。

## 2. Token 与排版

沿用 [token 总览](README.md#token-总览)。管理端的额外规则如下：

| 项目 | 规则 |
| --- | --- |
| 基础正文字号 | 由 `body` 统一承担，行高约 1.5 |
| 页面标题 | 20–24px、600–650 字重；说明 12–12.5px |
| 表头 | 10–10.5px、650 字重、全大写/字距 `.06em` 的视觉口径；中文实现不强制大写 |
| 统计值 | `--mono`、640 字重、轻微负字距；字号取 `--fs-*` 阶梯，管理端摘要用 `.vsum`，资产端概览用 `.stat` |
| 结构化短值 | 10.5–12px 等宽字体；不可承载长段正文 |
| 卡片 | `--card` 底、1px `--border`、`--radius`、`--shadow` |

## 3. Shell layout

| 元素 | 布局规则 | 禁止用法 |
| --- | --- | --- |
| 侧栏 | 白底、右侧 1px 边线、sticky 全高；内容区最小宽度为 0 | 用公开门户顶栏替代侧栏；把业务导航写死为组件示例 |
| 品牌区 | 18px 左右内边距、34px 标记、底部边线 | 使用真实机构标志或身份信息作为规范内容 |
| 分组标签 | 10px、字距较大、低强调色、位于导航组上方 | 作为可点击主操作 |
| 导航项 | 8px 纵向内边距、9px radius；active 用 `accent-soft` + `accent-border` | 只依赖颜色提示当前项 |
| 顶栏 | 13px 纵向、26px 横向内边距、轻透明白底与 blur；承载 breadcrumb 和工具区 | 叠加在业务内容上方遮挡表格 |
| 内容画布 | 24–26px 横向内边距；标题区和首个卡片间留 16–20px | 把一切压入单张巨型卡片 |

桌面基准为 1280 / 1440 / 1920px：侧栏不得覆盖内容，表格操作区始终可达。低于 1280px 时，侧栏可收纳为可打开面板，不能挤压表格到不可读。

## 4. 基础组件

| 组件 | anatomy / sizes | variants 与状态 | 禁止用法 |
| --- | --- | --- | --- |
| Button | 图标（可选）+ 单行标签；高取 `--ctrl-h`，小号取 `--ctrl-h-sm`；圆角 `--radius-sm` | default、primary（蓝色渐变）、ghost、danger；loading 用行内 spinner，disabled 降低不透明度并解释原因 | 两个并列 primary；可换行按钮文案 |
| Icon button | `--ctrl-h` 可达区；可见图标 + `aria-label` | default / hover / focus-visible / disabled | 无文字替代和无 accessible name 的纯图标 |
| Input / Select | label 在上、控件高取 `--ctrl-h`、1px 固定 `--border-strong`、8px radius、右侧预留状态槽 | hover 用表面轻变；focus 用 2px outline；error 替换 helper 文本；loading 不冻结编辑 | 用 placeholder 当 label；状态切换改变 border 宽度 |
| Tag / Badge | 色点（可选）+ 文本，`--radius-pill` | neutral / accent / `--pos` / `--warn` / `--danger`；颜色以文字和图形辅助 | 用 badge 表示唯一关键信息而无文本 |
| Tooltip | 触发图标 15–16px；深色浮层、10px radius、11.5px 文本 | hover 与键盘 focus 都可打开；靠近边缘时翻转 | 作为唯一说明或只支持 hover |
| Link | `--accent` 文本，可配小图标 | default / hover / focus-visible | 伪装为普通文字、点击范围过小 |
| Tab | `.tabs` + `.tab`；等宽并列时父级加 `.tabs.even` | `aria-selected` 表达当前项，选中态用下边线 + `--accent`；`.tab .cnt` 放计数，`.tab .lk` 放次级提示 | 另起别名类；用颜色而不用下边线表达选中 |

## 5. 数据与业务通用组件

这里的“数据”仅表示视觉结构，不附加数据来源或业务语义。

| 组件 | 布局与 variants | 组合规则 |
| --- | --- | --- |
| Statistic card | 内边距取 `--sp-*`；上方小型 label、中部大等宽值、底部辅助文本 | 3–4 列桌面栅格；窄屏变为 1 列 |
| Filter bar | `--card-2` 背景、1px 下边线；输入与操作保持同高 | 位于表格卡片内部、表头下方；不可承载业务条件定义 |
| Table | 表头浅底、行 48px 左右、cell 12px 内边距、最后一列固定为操作区 | 1280px 下操作列必须保持可达；长值截断前提供完整值机制 |
| Cell | 主文本 620 字重，辅助文本 10.5px `faint`；数值右对齐并用等宽字体 | 一格只建立一层主/辅层级 |
| Chart frame | 卡片内标题、辅助说明、图形区、图例/轴区；网格线低对比 | 没有数据时展示 skeleton 或空态，不画伪业务曲线 |
| Timeline | 小色点 + 垂直节奏 + 标题/辅助文本（`.tl`） | 每项的时间或次序采用等宽小字；不承载流程规则 |
| Step indicator | 圆形索引 `.steps .n` + 连接线 `.steps .ln`、标题与短说明 | 只表达视觉进度形态，不定义审批或业务步骤；连接线不得复用进度条的 `.bar` |
| Code / hash token | 等宽短文本、`--hash-bg` 背景、1px `--hash-border`、`--radius-xs` | 仅用于短结构化字符串；长值换行/省略须保留可访问完整内容 |
| Empty state | 轻量图标、单行原因、一个修复性入口（可选） | 使用通用占位说明，不写业务原因 |

## 6. 反馈组件

| 组件 | 布局 | 行为与状态 |
| --- | --- | --- |
| Modal | 居中、最大宽度 430px（宽变体另计）、`--radius`、`--shadow-lg`；标题/内容/操作三区 | Escape、backdrop、显式关闭均可退出；焦点受限在浮层内 |
| Drawer | 右侧详情面板，顶部标题、可滚动内容、固定或清晰的操作区 | 只在需要保留列表上下文时使用 |
| Toast | **顶部居中**、浅色 `--bg-elev` 表面、`--radius-sm`、短文案；最多同时 3 条，成功/信息 3 秒、失败 5 秒，同标题去重（账户与登录 PRD 8.7.1） | 成功/失败提供文本与图标；不承载长说明 |
| Inline alert | 左侧强调线或图标、浅色语义背景、9px radius | 信息、提示、错误、成功各自使用语义色与文本 |
| Loading | 表格/卡片优先 skeleton；控件内用 spinner | 保持原布局，避免整体跳动 |
| Permission / disabled surface | 降低强调、说明可用条件或替代路径 | 不可只用灰色和禁用 cursor |

## 7. 组合示例（仅 layout）

```text
管理端画布
├─ 页面标题 + 辅助说明 + 1 个主操作
├─ Statistic card × 3/4
└─ 表格卡片
   ├─ 卡片标题 + 次级说明
   ├─ Filter bar
   ├─ Table
   └─ Empty / loading / error 表面（按状态替换）
```

此组合不得被解释为功能页面蓝图；它只规定高密度组件在同一画布内的间距与层级。

## 8. 响应式与验收清单

- 1280 / 1440 / 1920px：无水平溢出、侧栏不重叠、操作区不裁切。
- 小屏：侧栏收纳；统计卡折列；表格改为行摘要，不隐藏关键操作。
- 中文与英文都预留 30% 左右的文本扩展空间；长 hash/代码可截断显示完整值入口。
- 每个交互项都有可见 focus-visible、非颜色唯一状态提示和减少动效支持。
