# 跨境链融

跨境链融产品需求文档（PRD）、原型（Prototype）与配套资料的统一存放仓库。

## 目录结构

```text
Chain-Financing/
├── prd/          # 产品需求文档（按功能或版本组织）
├── prototypes/   # 原型（HTML、Figma、交互稿等）
└── docs/         # 其他配套文档（调研、评审纪要等）
```

## 使用约定

- `main` 为稳定分支，功能开发使用 `feat/xxx` 分支，合入前走 PR。
- PRD 命名采用 `[版本号]-[功能名]-PRD.md`，例如 `v1.0-登录注册-PRD.md`。
- 原型名称与对应 PRD 的功能名保持一致。
