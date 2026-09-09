# 跨境链融

跨境链融产品需求文档（PRD）、原型（Prototype）与配套资料的统一存放仓库。

## 平台划分

仓库按**平台**组织，每个平台下再分 PRD 与原型：

| 平台 | 目录 | 包含的端 | 现状 |
| --- | --- | --- | --- |
| 资产平台 | [`asset-platform/`](asset-platform/README.md) | 资产端、资产管理端 | 已有 5 个模块的 PRD，模块清单与端归属见该目录 README |
| 金融服务平台 | [`financial-service-platform/`](financial-service-platform/README.md) | 金融服务端、运营端 | 空壳，内容待后续需求补充 |

## 目录结构

```text
Chain-Financing/
├── asset-platform/              # 资产平台（资产端 + 资产管理端）
│   ├── prd/                     # 资产平台的产品需求文档
│   └── prototypes/              # 资产平台的原型——待原型侧迁移后落位
├── financial-service-platform/  # 金融服务平台（金融服务端 + 运营端），当前为空壳
│   └── prd/
├── prototypes/                  # 原型（HTML、Figma、交互稿等）——尚未迁入 asset-platform/
└── docs/                        # 两平台共用的配套文档
    └── design-system/           # 设计系统与组件规范，两平台共用，保持在顶层
```

> **迁移进行中**：PRD 侧已迁入 `asset-platform/prd/`（原顶层 `prd/` 已不存在）。原型侧 `prototypes/`（含 `_shared/`）仍在顶层，将整体迁入 `asset-platform/prototypes/`，届时本表与下方约定一并更新。`docs/design-system/` 为两平台共用，不参与迁移。

## 使用约定

- `main` 为稳定分支，功能开发使用 `feat/xxx` 分支，合入前走 PR。
- 新增内容先确定归属平台，再放进对应平台目录；两个平台共用的资料才放 `docs/`。
- PRD 命名采用 `[版本号]-[功能名]-PRD.md`，例如 `v1.0-登录注册-PRD.md`；每个模块建独立子目录，入口文件与目录同名。
- 原型名称与对应 PRD 的功能名保持一致。
- 端的归属（资产端 / 资产管理端等）只在各平台 README 的模块清单里标注，**不按端拆目录**。
