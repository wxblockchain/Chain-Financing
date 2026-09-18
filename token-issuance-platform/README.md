# 代币发行平台（token-issuance-platform）

负责基于资产可信平台已确权的资产信息铸造代币，并将代币发布到借贷平台；资产方通过资产可信平台授权登录。

## 目录

- [`PRD/`](PRD/README.md) —— 本平台的产品需求文档
- [`页面原型/`](页面原型/README.md) —— 本平台的页面原型，原型底座与设计规范在其下的 `_shared/`

## 原型底座与设计规范

本平台自持一份，落在 `页面原型/_shared/`（token、公共组件、壳层运行时、页面登记表、导出脚本与 `design-system/`），不另开第三个子目录。三平台独立后不再跨平台引用彼此的公共层，具体落库安排见 WS-345。

从借贷平台移交过来的运营端页面（`P-O-TC-*` 智能合约、`P-O-TI-*` 代币清单与详情、`P-O-FX-*` 汇率管理、`P-O-DS-*` 资产清单与详情）在本平台的登记表里登记，借贷平台侧取消登记。

## 参考基线

参考 PRD、参考原型与设计规范请到 **`cly-V1.0.0`** 分支对应路径读取：

- PRD：`financial-service-platform/prd/`（资产清单与代币签发、代币合约等模块）
- 原型：`financial-service-platform/prototypes/`
- 原型底座：`financial-service-platform/prototypes/_shared/` 与 `asset-platform/prototypes/_shared/`
- 组件与设计规范：`docs/design-system/`；本平台组件规范与资产可信平台一致，可一并参考 `asset-platform/prototypes/`
- 通知契约：`docs/notification-contract/`

本分支不复制、不搬动 `cly-V1.0.0` 上的任何文件。模块清单与逐模块参考路径见 WS-345。
