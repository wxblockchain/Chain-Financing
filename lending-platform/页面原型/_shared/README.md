# 借贷平台原型公共层

本层是借贷平台**自持**的原型底座：token、公共组件与整页骨架、公共运行时、两张页面登记表、导出脚本，以及本平台的设计规范。不再引用 `asset-platform/prototypes/_shared/` 或任何其他平台的公共层。

| 内容 | 唯一来源 |
| --- | --- |
| token | [`tokens.css`](tokens.css) |
| 公共组件与四种整页骨架 | [`base.css`](base.css) |
| 公共运行时（i18n / 路由 / 导航 / Toast / 弹层宿主 / 演示工具） | [`shell.js`](shell.js) |
| 面客端页面登记与导航 | [`registry.portal.js`](registry.portal.js) |
| 管理端页面登记与导航 | [`registry.admin.js`](registry.admin.js) |
| 语义、约束、禁止用法、可访问性 | [`design-system/`](design-system/README.md) |
| 四种 shell 与状态表面的母版 | [`样板/底座样板.html`](样板/底座样板.html) |

## 两个部署单元

面客端与管理端分开上线，**各自只加载自己那张登记表**。两端共用同一份 `tokens.css` / `base.css` / `shell.js`，差异只落在 `[data-end]` 覆盖的密度与正文字号上，不是两套色板。

`registry` 的 `end` 表达部署单元与画布形态：`asset` = 面客端，`admin` = 管理端。`layout` 表达整页骨架：`site` / `portal` / `app` / `focus`。

## 接入一个模块

模块放在 `面客端/[功能名]/` 或 `管理端/[功能名]/`。先在对应登记表里登记页面、导航与入口锚点，再实现页面。加载顺序：

```html
<link rel="stylesheet" href="../../_shared/tokens.css">
<link rel="stylesheet" href="../../_shared/base.css">
<style>/* 仅本模块专有样式，禁止覆盖 token 或公共组件 */</style>
<!-- 沿用公共运行时要求的挂载点：portal / app / nav / anav / tools / atools / crumb / acrumb / content / acontent / layers / toasts / demoBtn / demoPanel -->
<script src="../../_shared/registry.portal.js"></script>
<script src="../../_shared/shell.js"></script>
<script>/* CF.define({ id, dict, layers, content, onAct }) + CF.boot()，不重建导航 */</script>
```

管理端模块加载 `registry.admin.js`；需要在同一份评审件里同时演示两端时（如底座样板）两张都加载。

模块接口：

| 字段 | 说明 |
| --- | --- |
| `id` | 模块标识，仅用于调试 |
| `dict` | `{ en:{}, zh:{} }` 文案，合并进公共字典 |
| `content(pageId)` | 返回该页内容区 HTML |
| `layers` | `{ key: fn }` 抽屉与弹窗内容表 |
| `onAct(act, value, event)` | 模块自己的点击动作；返回 `true` 表示已处理 |

公共层提供的片段：`CF.tag` / `CF.note` / `CF.empty` / `CF.skelTable` / `CF.surface`（六种状态表面）/ `CF.toast` / `CF.openLayer` / `CF.closeLayer` / `CF.fmtDate` / `CF.fmtTime` / `CF.fmtAmt` / `CF.esc` / `CF.L`。模块不得重新实现其中任何一项。

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
