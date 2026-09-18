# 借贷平台 · 页面原型

本目录存放借贷平台的页面原型。原型底座与设计规范在 `_shared/` 之下，与模块原型同处本目录，不另开第三个子目录。

## 目录结构

```
页面原型/
  _shared/
    tokens.css                # 色板、字号阶梯、间距、圆角、控件高、动效
    base.css                  # 整页骨架与公共组件
    shell.js                  # i18n、路由、导航渲染、面包屑、Toast、弹层与抽屉宿主
    registry.面客端.js          # 面客端页面登记表与导航
    registry.管理端.js          # 管理端页面登记表与导航
    export.py                 # 单文件评审件导出
    README.md                 # 接入顺序与公共层说明
    design-system/            # 本平台自持的设计规范
  面客端/<模块目录>/
  管理端/<模块目录>/
```

面客端与管理端共用同一份 token、公共组件与壳层运行时，差别在整页骨架与各自的登记表；两端可独立打包部署。模块只写自己的页面、文案、演示数据与状态，不重定义 token、不复制公共组件、不自建导航。

当前 `_shared/` 与模块目录尚未落库，落库归 WS-347。

## 参考基线

参考原型与设计规范请到 **`cly-V1.0.0`** 分支读取：

- 原型：`financial-service-platform/prototypes/`
- 原型底座：`financial-service-platform/prototypes/_shared/` 与 `asset-platform/prototypes/_shared/`
- 组件与设计规范：`docs/design-system/`

逐模块的参考路径见 WS-346。
