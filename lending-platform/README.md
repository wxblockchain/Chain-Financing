# 借贷平台（lending-platform）

负责展示已对接的代币资产并完成融资（融资需求、代币质押、授信报价、放款与还款）；资产方通过资产可信平台授权登录。

面客端是官网类型，管理端是标准管理平台，两者相互独立部署。

## 目录

- [`PRD/`](PRD/README.md) —— 本平台的产品需求文档
- [`页面原型/`](页面原型/README.md) —— 本平台的页面原型，原型底座与设计规范在其下的 `_shared/`

## 原型底座与设计规范

本平台自持一份，落在 [`页面原型/_shared/`](页面原型/README.md)，不再引用 `asset-platform/prototypes/_shared/`。面客端与管理端共用同一份 token、公共组件与壳层运行时，各自持有一张页面登记表与导航。落库归 WS-347。

## 参考基线

参考 PRD、参考原型与设计规范请到 **`cly-V1.0.0`** 分支对应路径读取：

- PRD：`financial-service-platform/prd/`（借贷广场四件套、代币质押审核、我的控制台、面客消息中心等模块）
- 原型：`financial-service-platform/prototypes/`
- 组件与设计规范：`docs/design-system/`
- 通知契约：`docs/notification-contract/`

本分支不复制、不搬动 `cly-V1.0.0` 上的任何文件。模块清单与逐模块参考路径见 WS-346。
