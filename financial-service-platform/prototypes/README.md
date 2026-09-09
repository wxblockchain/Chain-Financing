# 金融服务平台 · 原型目录

金融服务平台（金融服务端 / 运营端）的原型统一存放于此。

| 模块 | 覆盖端 | 入口 | 说明 |
| --- | --- | --- | --- |
| 协议管理（WS-310） | 运营端 | [v1.0-协议管理-原型.html](协议管理/v1.0-协议管理-原型.html) | [交互、覆盖与限制](协议管理/README.md) |

从完整仓库双击入口即可离线打开；单文件导出方式见模块说明。当前均为演示原型，不连接真实后端。

## 约定（沿用资产平台）

- 每个功能模块建独立子目录，原型文件命名为 `[版本号]-[功能名]-原型.html`，与对应 PRD 的功能名保持一致。
- 交互说明写在同目录的 `README.md` 里。
- 设计规范取仓库顶层的 [`docs/design-system/`](../../docs/design-system/README.md)，两个平台共用，不在本目录复制一份。其中「管理端 / 面客端」指的是**画布形态**：金融服务端按面客形态、运营端按控制台形态取用。
- 公共视觉与运行时直接沿用 [`asset-platform/prototypes/_shared/`](../../asset-platform/prototypes/_shared/README.md) 的 token、base.css 和 shell.js，不复制第二份。金融平台独立的页面与导航登记在 [`_shared/registry.js`](_shared/registry.js)，接入边界见 [`_shared/README.md`](_shared/README.md)。
- 资产平台的原型不要放进本目录，见 [`asset-platform/prototypes/`](../../asset-platform/prototypes/README.md)。
