# 借贷平台 · 页面原型

**原型评审切换统一规则（WS-385）：** [先选页面，再选当前页状态](_shared/design-system/原型评审切换规范.md)。页面目录、联动状态与恢复默认由共享运行时提供，评审工具默认关闭；模块复用原业务流程与权限保护。

**页面接入必读：** [面客工作区组件规范 §0：阅读顺序、样板版本、逐页继承](_shared/design-system/面客工作区组件规范.md#0-必读入口顺序与样板版本) → [§5.1：内嵌布局与加载策略](_shared/design-system/面客工作区组件规范.md#51-内嵌布局与数据加载必须分别决定) → [§8：浏览器验收](_shared/design-system/面客工作区组件规范.md#8-响应式验收)。资产广场按已确认 PRD 使用全断点内嵌连续追加，每批20条；加载范围和位置随视图链接恢复。

本目录存放借贷平台的页面原型。原型底座与设计规范在 `_shared/` 之下，与模块原型同处本目录，不另开第三个子目录。

## 目录结构

```
页面原型/
  _shared/
    tokens.css                # 色板、字号阶梯、间距、圆角、控件高、动效、层级
    base.css                  # 四种整页骨架（site / portal / app / focus）与公共组件
    shell.js                  # i18n、路由、导航与面包屑、Toast、抽屉与弹窗宿主、演示工具
    registry.portal.js        # 面客端页面登记表与导航
    registry.admin.js         # 管理端页面登记表与导航
    export.py                 # 单文件评审件导出
    README.md                 # 接入顺序与模块接口
    design-system/            # 本平台自持的设计规范
    样板/底座样板.html          # 四种 shell 与状态表面的母版
  面客端/<模块目录>/
  管理端/<模块目录>/
```

面客端与管理端是两个独立部署单元，各自只加载自己那张登记表；两端共用同一份 token、组件与运行时，差异只落在密度与正文字号上。接入方式见 [`_shared/README.md`](_shared/README.md)。

## 从哪开始

新增或改造页面前先读 [`_shared/design-system/页面继承参考.md`](_shared/design-system/页面继承参考.md)，选定部署单元、shell 与 archetype，再做增量。母版是 [`_shared/样板/底座样板.html`](_shared/样板/底座样板.html) —— 它是底座样板，不是业务模块原型，字段集只是够用的样例。

## 参考基线

参考原型与原设计规范请到 **`cly-V1.0.0`** 分支读取：

- 原型：`financial-service-platform/prototypes/`
- 原型底座：`asset-platform/prototypes/_shared/` 与 `financial-service-platform/prototypes/_shared/`
- 组件与设计规范：`docs/design-system/`

本分支不复制、不搬动 `cly-V1.0.0` 上的任何文件。逐模块的参考路径见 WS-346。
