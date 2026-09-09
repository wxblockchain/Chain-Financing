# 金融服务平台 · 原型目录

**占位目录，内容待补。** 金融服务平台（金融服务端 / 运营端）的原型统一存放于此，目前尚无任何已交付的原型——具体模块由后续需求明确后再落地。

## 约定（沿用资产平台）

- 每个功能模块建独立子目录，原型文件命名为 `[版本号]-[功能名]-原型.html`，与对应 PRD 的功能名保持一致。
- 交互说明写在同目录的 `README.md` 里。
- 设计规范取仓库顶层的 [`docs/design-system/`](../../docs/design-system/README.md)，两个平台共用，不在本目录复制一份。其中「管理端 / 面客端」指的是**画布形态**：金融服务端按面客形态、运营端按控制台形态取用。
- 公共层不在本目录：资产平台的原型底座是 [`asset-platform/prototypes/_shared/`](../../asset-platform/prototypes/_shared/README.md)，属于该平台内部实现。本平台首批原型落地时再决定是沿用、还是另起一套——届时有真实第二个使用方，才谈得上抽取共用底座。
- 资产平台的原型不要放进本目录，见 [`asset-platform/prototypes/`](../../asset-platform/prototypes/README.md)。
