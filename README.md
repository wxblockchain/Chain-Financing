# 跨境链融

当前项目工作分支为 `cly-4.0.0`。三个平台各自持有 PRD、页面原型、原型底座与设计规范，平台之间通过 API 接口交互；各目录入口说明指向本分支现行文件。

## 三平台导航

| 平台 | 目录 | 职责范围 |
| --- | --- | --- |
| 资产可信平台 | [`asset-trust-platform/`](asset-trust-platform/README.md) | 资产录入、信息验真、信息上链，并为另两个平台提供第三方授权登录 |
| 代币发行平台 | [`token-issuance-platform/`](token-issuance-platform/README.md) | 基于已确权的资产信息铸造代币，并将代币发布到借贷平台 |
| 借贷平台 | [`lending-platform/`](lending-platform/README.md) | 展示已对接的代币资产并完成融资 |

每个平台目录下固定两个子目录：`PRD/` 放本平台的产品需求文档，`页面原型/` 放本平台的页面原型。

## 原型底座与设计规范：各平台自持

每个平台自持原型底座，位于本平台目录下：

```
<平台目录>/页面原型/_shared/
  tokens.css / base.css / shell.js      # token、公共组件、壳层运行时
  registry.*.js                          # 本平台页面登记表与导航
  export.py                              # 单文件评审件导出
  design-system/                         # 本平台自持的设计规范
```

底座与设计规范一律落在 `页面原型/_shared/` 之下，**不为它们另开第三个子目录**，也不在分支根放公共的 `docs/`。各平台的底座相互独立，不跨平台相对路径引用。

## 当前资料与维护

需求与页面从上方平台入口进入。借贷平台的现行资料为：

- [PRD 目录](lending-platform/PRD/README.md)：模块正文、流程、消息通知与验收索引。
- [页面原型](lending-platform/页面原型/README.md)：面客、运营模块及本地运行方式。
- [组件与设计规范](lending-platform/页面原型/_shared/design-system/README.md)：当前组件规则与唯一实现来源。

维护时读取目标分支最新源码与已确认需求，组件修改同步相关规范。历史分支和旧评审附件用于追溯；独立 HTML 交付件从现行源文件导出，不回存为第二份维护源。
