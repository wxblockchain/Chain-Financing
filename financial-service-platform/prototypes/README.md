# 金融服务平台 · 原型目录

金融服务平台（金融服务端 / 运营端）的原型统一存放于此。

| 模块 | 覆盖端 | 入口 | 说明 |
| --- | --- | --- | --- |
| 账户与登录（WS-308） | 运营端 | [v1.0-账户与登录-原型.html](账户与登录/v1.0-账户与登录-原型.html) | [交互与覆盖说明](账户与登录/README.md)；登录、首登重置、忘记密码、账户设置及总览壳子；后端为模拟，消息入口已接入 WS-309 原型 |
| 协议管理（WS-310） | 运营端 | [v1.0-协议管理-原型.html](协议管理/v1.0-协议管理-原型.html) | [交互、覆盖与限制](协议管理/README.md) |
| 消息通知（WS-309） | 运营端 | [v1.0-消息通知-原型.html](消息通知/v1.0-消息通知-原型.html) | [交互与覆盖说明](消息通知/README.md)；P-O20 / P-O21、C-O20～C-O23，真实后端未接入 |

## 约定（沿用资产平台）

- 每个功能模块建独立子目录，原型文件命名为 `[版本号]-[功能名]-原型.html`，与对应 PRD 的功能名保持一致。
- 交互说明写在同目录的 `README.md` 里。
- 设计规范取仓库顶层的 [`docs/design-system/`](../../docs/design-system/README.md)，两个平台共用，不在本目录复制一份。其中「管理端 / 面客端」指的是**画布形态**：金融服务端按面客形态、运营端按控制台形态取用。
- 公共 token、组件和运行时只读沿用 [`asset-platform/prototypes/_shared/`](../../asset-platform/prototypes/_shared/README.md)，不复制、不迁移；共享壳层的兼容改动须回归两个平台。页面登记与导航配置由本平台 [`_shared/registry.js`](_shared/registry.js) 维护，接入顺序见 [`_shared/README.md`](_shared/README.md)。运营端使用 `admin` 控制台画布，与消息池 `fs_ops` 区分。
- 仓库版需保留完整目录后双击模块 HTML；可用 [`_shared/export.py`](_shared/export.py) 内联依赖生成独立附件。不要把导出的快照当成维护源文件。
- 资产平台的原型不要放进本目录，见 [`asset-platform/prototypes/`](../../asset-platform/prototypes/README.md)。
