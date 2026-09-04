# Harbour Credit 面客端组件规范

## 1. 范围与视觉口径

本规范面向公开门户与自助内容层的组件布局。来源为 WS-289 指定 HTML 附件 `01a06b63-b52d-7a02-997d-5e8e876c19b0`。它只记录面客端的组件视觉、容器层级和状态；**不包含**任何功能流程、认证/准入规则、角色权限、领域字段或演示数据。

面客端的核心特征是：同一浅色金融科技 token 基础、居中宽内容容器、轻量顶栏、较舒展的留白、卡片与摘要信息并置，以及对结构化短值的谨慎等宽展示。

## 2. Token 与排版

沿用 [共享 token](README.md#共享-token-基础)。面客端的额外规则如下：

| 项目 | 规则 |
| --- | --- |
| 基础正文字号 | 14–14.5px，行高约 1.55 |
| 容器 | 最大宽度约 1560px，默认横向内边距 24px；移动端 16px |
| 标题 | 公开内容标题可使用 `clamp()`；内容层标题保持 20–28px、650 字重 |
| 卡片 | 12px 常规 radius；摘要/展示卡可使用 16px；白底与轻阴影 |
| 密度 | 公开层优先留白和短文案；自助内容层可使用表格，但不复制管理端紧凑密度 |
| 颜色 | 蓝色表示主操作，青绿色表示正向，紫色仅作辅助分类或标识，不承担主要 CTA |

## 3. Shell layout

| 元素 | 布局规则 | 禁止用法 |
| --- | --- | --- |
| 顶栏 | sticky 白色半透明表面、1px 下边线；品牌、主导航、语言/上下文操作、主 CTA 分区 | 引入管理端左侧导航或内部工具栏密度 |
| 主导航 | 14px 左右、10px radius、active 使用白色 surface + 轻阴影 | 让导航标签在窄屏换成两行 |
| 内容容器 | `max-width` + auto margin；24px 桌面、16px 移动端内边距 | 使用 `100vw` 造成滚动条溢出 |
| 公开内容区 | 宽留白、主标题/短说明/主操作形成单一焦点；卡片可作为辅助区 | 把公开层堆成管理端的统计/表格墙 |
| 自助内容区 | breadcrumb/上下文、标题区、摘要卡、内容卡按垂直节奏排列 | 用侧栏模拟管理端 shell |
| 页脚 | 轻边线、低强调的多列说明；窄屏自然折列 | 把关键 CTA 放入低对比页脚文字中 |

## 4. 基础组件

| 组件 | anatomy / sizes | variants 与状态 | 禁止用法 |
| --- | --- | --- | --- |
| Button | 图标（可选）+ 单行标签；常规高约 38–40px；移动/触控区不小于 44px | primary、secondary、ghost、context；loading 保留可读标签 | 在公开层同时放多个同级 primary；长 CTA 换行 |
| Header action | 顶栏内独立操作区；与语言/上下文控件保持 8px gap | 默认、已连接/已选择视觉上下文、disabled | 将身份或业务状态写入通用规范文案 |
| Input / Select | label 在上、38–40px 控件高、8px radius、1px 固定边框 | default、hover、focus、error、disabled、loading、success | 只为漂亮而移除原生 select 的键盘能力 |
| Language toggle | 共同外框内的两个紧凑按钮，当前项用 `accent-soft` | 状态可见且有 accessible name | 仅用国旗或颜色区分语言 |
| Tag / Badge | 色点（可选）+ 短文本；11–12px；有足够背景对比 | neutral / accent / positive / warning / danger | 用多枚彩色 badge 代替信息层级 |
| Tooltip | 深色浮层、约 290px 最大宽、11.5px 文本、边缘翻转 | hover 与 focus 均可用 | 仅为装饰性图标添加 tooltip |
| Link / icon link | `accent` 文本/图标；外部跳转加语义提示 | hover、focus-visible、disabled | 小于 44px 的独立触控目标 |

## 5. 数据展示与内容组件

| 组件 | 布局与 variants | 组合规则 |
| --- | --- | --- |
| Metric / stat card | 16–26px 内边距；小型 label、大等宽值、辅助说明 | 2–3 列公开摘要、最多 4 列自助摘要；小屏 1 列 |
| Summary card | 标题、短说明、可选图标、可选一项操作；16px radius 可用于重点区 | 不把所有信息打平成同等卡片 |
| Detail group | 以 `key / value` 对齐、虚线或轻分隔组织；值右对齐 | 长值换行而不挤压 label；短值可用等宽字体 |
| Table | 自助内容中使用浅表头、12px cell padding、右对齐数值与结构化值 | 10 列以上在移动端转为摘要卡；不横向截断关键内容 |
| Chart frame | 图形区、低对比网格、最小图例/轴、标题与说明 | 没有数据时用 empty/skeleton；不引入伪业务序列 |
| Timeline | 7–8px 色点、时间/标题/说明三层；纵向空间更舒展 | 保持每项可扫读，文本不堆成段落 |
| Step indicator | 线性步骤、圆形索引、标题与短说明 | 仅定义视觉进度；不记录任何流程逻辑 |
| Code / hash token | `font-mono`、`accent-soft`、`accent-border`、7px radius | 用于短结构化值；长字符串提供完整值可达性 |
| Empty state | 小图标、原因说明、可选修复性操作 | 使用通用内容占位，避免业务化文案 |

## 6. 反馈组件

| 组件 | 布局 | 行为与状态 |
| --- | --- | --- |
| Modal | 固定居中、最大约 500px、16px radius、内容可滚动 | backdrop / Escape / 关闭按钮均可退出；打开后焦点进入内容 |
| Bottom Toast | 视口底部居中、深色小表面、11px radius、最大宽度不超过 90vw | 用短句和图标传达状态；可自动消退但不抢焦点 |
| Inline note / alert | 左侧强调线、浅色语义底、9px radius | 信息、提示、错误、成功均配文字，避免只用色带 |
| Gated / unavailable surface | 普通内容布局中保留可见上下文；用图标、说明、低强调操作呈现 | 不展示内部管理式权限表；不把不可用项完全隐藏造成方向丢失 |
| Loading | 内容卡/表格使用 skeleton；按钮内使用 inline spinner | 形状与最终内容一致，避免页面跳动 |

## 7. 组合示例（仅 layout）

```text
面客端内容容器
├─ 顶栏（品牌 + 单行导航 + 上下文操作）
├─ 标题区（短标题 + 说明 + 1 个主操作）
├─ Summary card × 2/3
└─ 内容卡
   ├─ 卡片标题 + 辅助说明
   ├─ Detail group / Table / Chart frame
   └─ Empty / loading / error 表面（按状态替换）
```

此组合仅表达容器、留白和组件层级；它不对应或暗示任何功能页。

## 8. 响应式与验收清单

- 320 / 375 / 414 / 768px 以及桌面宽度下无水平滚动；根节点用 `overflow-x: clip`。
- 顶栏主导航在内容不再容纳时收纳，而不是让标签换行；触控控件最小 44px。
- 公开内容标题允许换行，交互标签保持单行；卡片、分栏和 overlay 在窄屏变为单列或全宽可读布局。
- 中英文与长文本预留扩展空间；使用逻辑属性，避免语言相关的左/右硬编码。
- 所有控件提供 `focus-visible`、错误文本、禁用说明和 `prefers-reduced-motion` 处理。
