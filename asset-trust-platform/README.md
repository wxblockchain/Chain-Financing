# 资产可信平台（asset-trust-platform）

负责资产录入、信息验真与信息上链，并作为统一身份源为代币发行平台、借贷平台提供第三方授权登录。

## 目录

- [`PRD/`](PRD/README.md) —— 本平台的产品需求文档
- [`页面原型/`](页面原型/README.md) —— 本平台的页面原型，原型底座与设计规范在其下的 `_shared/`

## 原型底座与设计规范

本平台自持一份，落在 `页面原型/_shared/`（token、公共组件、壳层运行时、页面登记表、导出脚本与 `design-system/`），不另开第三个子目录。三平台独立后不再跨平台引用彼此的公共层，具体落库安排见 WS-344。

## 参考基线

参考 PRD、参考原型与设计规范请到 **`cly-V1.0.0`** 分支对应路径读取：

- PRD：`asset-platform/prd/`
- 原型：`asset-platform/prototypes/`
- 原型底座：`asset-platform/prototypes/_shared/`
- 组件与设计规范：`docs/design-system/`
- 通知契约：`docs/notification-contract/`

本分支不复制、不搬动 `cly-V1.0.0` 上的任何文件。模块清单与逐模块参考路径见 WS-344。
