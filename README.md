# 跨境链融

当前交付分支为 `cly-v5.0.0`。三个平台各自持有 PRD 与页面原型，平台之间通过 API 接口交互。

## 三平台导航

| 平台 | 目录 | 职责范围 |
| --- | --- | --- |
| 资产可信平台 | [`asset-trust-platform/`](asset-trust-platform/README.md) | 资产录入、信息验真、信息上链，并为另两个平台提供第三方授权登录 |
| 代币发行平台 | [`token-issuance-platform/`](token-issuance-platform/README.md) | 基于已确权的资产信息铸造代币，并将代币发布到借贷平台 |
| 借贷平台 | [`lending-platform/`](lending-platform/README.md) | 展示已对接的代币资产并完成融资 |

每个平台目录下固定两个子目录：`PRD/` 放本平台的产品需求文档，`页面原型/` 放本平台的页面原型。

## 借贷平台入口

需求与页面从上方平台入口进入。借贷平台的现行资料为：

- [PRD 目录](lending-platform/PRD/README.md)：模块正文、流程、消息通知与验收索引。
- [面客端源码](lending-platform/页面原型/面客端/)
- [运营端源码](lending-platform/页面原型/运营端/)
- [共享代码与资源](lending-platform/页面原型/_shared/)
