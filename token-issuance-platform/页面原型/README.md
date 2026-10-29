# 代币发行平台 · 页面原型

原型只说明页面布局和展示的信息；规则、校验与异常分支以 [PRD](../PRD/README.md) 为准。

## 目录

| 路径 | 内容 |
| --- | --- |
| [`_shared/`](_shared/) | 公共层：`tokens.css`、`components.css`、`frame.js`、`export.py` |
| [`_shared/design-system/组件规范.md`](_shared/design-system/组件规范.md) | 本平台组件规范与原型轻量化约定 |
| [`面客端/01-企业登录与企业账户/`](面客端/01-企业登录与企业账户/企业登录与企业账户.html) | M1 企业登录与企业账户 |

## 打开与导出

- 在完整的 `页面原型/` 目录下双击模块 HTML 即可打开；右下角「画面目录 · 演示数据」列出全部画面。
- 生成单文件评审件（不入库）：

  ```
  python3 _shared/export.py --source 面客端/01-企业登录与企业账户/企业登录与企业账户.html --output <仓库外路径>.html
  ```

视觉取值沿用借贷平台运营端（`lending-platform/页面原型/_shared/`），差异见组件规范第 1 节。
