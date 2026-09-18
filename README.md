# 跨境链融 · cly2.0.0

本分支是三平台重划分后的目录骨架。资产平台与金融服务平台拆分为三个相互独立的平台，各自持有自己的 PRD 与页面原型，平台之间通过 API 接口交互。

## 三平台导航

| 平台 | 目录 | 职责范围 |
| --- | --- | --- |
| 资产可信平台 | [`asset-trust-platform/`](asset-trust-platform/README.md) | 资产录入、信息验真、信息上链，并为另两个平台提供第三方授权登录 |
| 代币发行平台 | [`token-issuance-platform/`](token-issuance-platform/README.md) | 基于已确权的资产信息铸造代币，并将代币发布到借贷平台 |
| 借贷平台 | [`lending-platform/`](lending-platform/README.md) | 展示已对接的代币资产并完成融资 |

每个平台目录下固定两个子目录：`PRD/` 放本平台的产品需求文档，`页面原型/` 放本平台的页面原型。

## 参考基线

本分支**只有目录骨架，不含任何 PRD、原型与组件/设计规范文件**。这三类内容的现状全部在 **`cly-V1.0.0`** 分支上，按原有的 `asset-platform/` 与 `financial-service-platform/` 结构存放：

- PRD：`asset-platform/prd/`、`financial-service-platform/prd/`
- 原型：`asset-platform/prototypes/`、`financial-service-platform/prototypes/`
- 组件与设计规范：`docs/design-system/`
- 通知契约：`docs/notification-contract/`

各平台的模块清单，以及每个模块对应的 `cly-V1.0.0` 参考路径，见三个平台入口 issue（WS-344 资产可信平台 / WS-345 代币发行平台 / WS-346 借贷平台）。

`cly-V1.0.0` 保持不动，只作只读参考；重构后的产出提交到本分支。
