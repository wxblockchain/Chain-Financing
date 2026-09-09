# 跨境链融

跨境链融产品需求文档（PRD）、原型（Prototype）与配套资料的统一存放仓库。

## 平台划分

仓库按**平台**组织，每个平台下再分 PRD 与原型：

| 平台 | 目录 | 包含的端 | 现状 |
| --- | --- | --- | --- |
| 资产平台 | [`asset-platform/`](asset-platform/README.md) | 资产端、资产管理端 | 已有 5 个模块的 PRD 与 5 份原型，模块清单与端归属见该目录 README |
| 金融服务平台 | [`financial-service-platform/`](financial-service-platform/README.md) | 金融服务端、运营端 | 已有 3 个模块的 PRD（协议管理、消息通知、账户与登录），以及运营端「协议管理」「账户与登录」两份原型；模块清单与端归属见该目录 README |

## 目录结构

```text
Chain-Financing/
├── asset-platform/              # 资产平台（资产端 + 资产管理端）
│   ├── prd/                     # 资产平台的产品需求文档，按模块建子目录
│   └── prototypes/              # 资产平台的原型（HTML、Figma、交互稿等）
│       ├── _shared/             # 原型公共底座：tokens.css / base.css / registry.js / shell.js
│       └── [功能名]/            # 每个模块一个子目录，与模块目录同级引用 ../_shared/
├── financial-service-platform/  # 金融服务平台（金融服务端 + 运营端）
│   ├── prd/
│   └── prototypes/
└── docs/                        # 两平台共用的配套文档
    └── design-system/           # 设计系统与组件规范，两平台共用，保持在顶层
```

## 使用约定

- `cly-V1.0.0` 是 V1.0.0 阶段的工作分支：PRD、原型与文档的改动直接提交到该分支，当前不使用 `feat/xxx` 特性分支、也不走 PR 流程。`main` 目前只有仓库初始化提交，尚未合入任何内容。恢复特性分支与 PR 流程需另行约定，约定前请勿按旧流程操作。
- 新增内容先确定归属平台，再放进对应平台目录；两个平台共用的资料才放 `docs/`。
- PRD 命名采用 `[版本号]-[功能名]-PRD.md`，例如 `v1.0-登录注册-PRD.md`；每个模块建独立子目录，入口文件与目录同名。
- 原型名称与对应 PRD 的功能名保持一致。
- `asset-platform/prototypes/_shared/` 是资产平台原型的公共底座，**必须与模块目录保持同级**——各模块 HTML 一律以 `../_shared/` 引用，跨模块跳转按 `../[模块目录]/` 拼接，挪动它会同时打断这两条相对路径。新增模块页面先在 `_shared/registry.js` 登记页面 ID，再实现。
- 金融服务平台只读复用上述底座的 token、组件与 shell；其页面／导航在 `financial-service-platform/prototypes/_shared/registry.js` 独立登记。两平台不同时加载对方的登记表，不复制公共样式与运行时。使用方式见该平台原型目录。
- 端的归属（资产端 / 资产管理端等）只在各平台 README 的模块清单里标注，**不按端拆目录**。
