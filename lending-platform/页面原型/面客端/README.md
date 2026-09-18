# 借贷平台 · 面客端原型

**页面接入必读：** [面客工作区组件规范 §0：阅读顺序、样板版本、逐页继承](../_shared/design-system/面客工作区组件规范.md#0-必读入口顺序与样板版本) → [§5.1：内嵌布局与加载策略](../_shared/design-system/面客工作区组件规范.md#51-内嵌布局与数据加载必须分别决定) → [§8：浏览器验收](../_shared/design-system/面客工作区组件规范.md#8-响应式验收)。资产广场按已确认 PRD 使用全断点内嵌连续追加，每批20条；加载范围和位置随视图链接恢复。

官网型部署单元，覆盖资产方、资金方与未登录访客。每个模块一个目录，模块内只放自己的页面 HTML、模块 JS、文案、演示数据与状态。

- 公共层（token / 组件 / 骨架 / 运行时 / 登记表 / 设计规范）：[`../_shared/`](../_shared/README.md)
- 本端登记表：[`../_shared/registry.portal.js`](../_shared/registry.portal.js)
- 继承母版与 archetype：[`../_shared/design-system/页面继承参考.md`](../_shared/design-system/页面继承参考.md)
- 组件语义：[`官网层`](../_shared/design-system/官网层组件规范.md) · [`工作区`](../_shared/design-system/面客工作区组件规范.md)

已落库：[资产广场](资产广场/README.md)、[借贷广场 · 融资需求与代币质押](借贷广场/README.md)。当前业务输入取本分支 `lending-platform/PRD/`；`cly-V1.0.0` 仅作历史参考，不能替代最新已确认输入。

- [面客消息中心](消息中心/README.md)：列表、整页详情、顶栏快捷面板；含双语与异常场景。
