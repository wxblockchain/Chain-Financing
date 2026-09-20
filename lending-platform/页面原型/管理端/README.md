# 借贷平台 · 运营管理平台原型

标准管理平台部署单元，覆盖运营管理员与 SPV 机构。每个模块一个目录，模块内只放自己的页面 HTML、模块 JS、文案、演示数据与状态。

- 公共层（token / 组件 / 骨架 / 运行时 / 登记表 / 设计规范）：[`../_shared/`](../_shared/README.md)
- 本端登记表：[`../_shared/registry.admin.js`](../_shared/registry.admin.js)
- 继承母版与 archetype：[`../_shared/design-system/页面继承参考.md`](../_shared/design-system/页面继承参考.md)
- 组件语义：[`管理端组件规范`](../_shared/design-system/管理端组件规范.md)

已落库模块：[账户与登录](账户与登录/README.md)（运营管理员、运营专员；SPV 职责通过功能权限表达）。代币域页面（`P-O-TC-*` / `P-O-TI-*` / `P-O-FX-*` / `P-O-DS-*`）已移交代币发行平台，不在本端范围内。
