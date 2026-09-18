# 跨境链融 · cly2.0.0

本分支是三平台重划分后的目录骨架。资产平台与金融服务平台拆分为三个相互独立的平台，各自持有自己的 PRD、页面原型、原型底座与设计规范，平台之间通过 API 接口交互。

## 三平台导航

| 平台 | 目录 | 职责范围 |
| --- | --- | --- |
| 资产可信平台 | [`asset-trust-platform/`](asset-trust-platform/README.md) | 资产录入、信息验真、信息上链，并为另两个平台提供第三方授权登录 |
| 代币发行平台 | [`token-issuance-platform/`](token-issuance-platform/README.md) | 基于已确权的资产信息铸造代币，并将代币发布到借贷平台 |
| 借贷平台 | [`lending-platform/`](lending-platform/README.md) | 展示已对接的代币资产并完成融资 |

每个平台目录下固定两个子目录：`PRD/` 放本平台的产品需求文档，`页面原型/` 放本平台的页面原型。

## 原型底座与设计规范：各平台自持

`cly-V1.0.0` 上的原型是跨平台引用的——三个平台的原型共用 `asset-platform/prototypes/_shared/` 的 token、公共组件与壳层运行时，设计规范共用顶层 `docs/design-system/`。三平台独立部署后这条引用链不成立，因此本分支上**每个平台自持一份**：

```
<平台目录>/页面原型/_shared/
  tokens.css / base.css / shell.js      # token、公共组件、壳层运行时
  registry.*.js                          # 本平台页面登记表与导航
  export.py                              # 单文件评审件导出
  design-system/                         # 本平台自持的设计规范
```

底座与设计规范一律落在 `页面原型/_shared/` 之下，**不为它们另开第三个子目录**，也不在分支根放公共的 `docs/`。各平台的底座相互独立，不跨平台相对路径引用。

## 参考基线

`cly-V1.0.0` 是**只读参考基线**，现状按原有的 `asset-platform/` 与 `financial-service-platform/` 结构存放：

- PRD：`asset-platform/prd/`、`financial-service-platform/prd/`
- 原型：`asset-platform/prototypes/`、`financial-service-platform/prototypes/`
- 组件与设计规范：`docs/design-system/`
- 通知契约：`docs/notification-contract/`

各平台的模块清单，以及每个模块对应的 `cly-V1.0.0` 参考路径，见三个平台入口 issue（WS-344 资产可信平台 / WS-345 代币发行平台 / WS-346 借贷平台）。

`cly-V1.0.0` 保持不动，本分支不复制、不搬动其上的任何文件；重构后的产出提交到本分支。
