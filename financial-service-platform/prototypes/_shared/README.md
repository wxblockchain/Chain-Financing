# 金融服务平台原型接入层

本层维护金融服务平台的页面与跨文件导航登记；视觉和运行时直接复用仓库现有实现，不复制第二套公共代码。

| 内容 | 唯一来源 |
| --- | --- |
| 语义、组件约束与画布规范 | [`docs/design-system/`](../../../docs/design-system/README.md) |
| token / 公共组件 / 运行时 | [`asset-platform/prototypes/_shared/`](../../../asset-platform/prototypes/_shared/README.md) 的 `tokens.css`、`base.css`、`shell.js` |
| 本平台页面、模块归属、导航、消息入口 | 本目录 [`registry.js`](registry.js) |
| 本平台国际化与脱敏规则 | [`01-国际化基线.md`](../../prd/v1.0-账户与登录/01-国际化基线.md) |

`registry.end = admin` 表达控制台画布，消息契约的 `end = fs_ops` 表达运营端消息池，两者不要混用。金融服务平台模块**只加载本平台 registry**，不加载后再覆盖资产平台 registry；资产平台原有五个模块继续读取自己的登记表。

## 接入模块

模块放在 `prototypes/[功能名]/`，先在本层登记页面、模块、OWNER、ENTRY，再实现页面。消息中心 P-O20 不登记侧栏入口，铃铛及账号菜单通过 `CF.MSG_PAGE.admin` 进入。

模块按顺序加载：

```html
<link rel="stylesheet" href="../../../asset-platform/prototypes/_shared/tokens.css">
<link rel="stylesheet" href="../../../asset-platform/prototypes/_shared/base.css">
<style>/* 仅本模块专有样式，禁止覆盖 token 或公共组件 */</style>
<!-- 沿用公共运行时要求的 app / nav / topRight / crumb / content / layers 挂载点 -->
<script src="../_shared/registry.js"></script>
<script src="../../../asset-platform/prototypes/_shared/shell.js"></script>
<script>/* CF.define(...) + CF.boot()，不重建导航 */</script>
```

因此仓库预览需保留两个平台的目录相对位置，不能只拷走某个模块 HTML。`account().settings` 仅在对应页面可用时提供；公共运行时现在允许省略它，避免生成 `undefined` 死入口。账号设置与登录原型已入库；消息模块提供 P-O05 账户设置入口，会话中断页提供携带原消息路径的登录入口。账户模块按自身演示守卫处理登录，不共享真实登录态。

## 导出独立评审附件

在仓库根目录执行（Python 3.9+，标准库，无需构建依赖）：

```bash
python3 financial-service-platform/prototypes/_shared/export.py \
  --source financial-service-platform/prototypes/消息通知/v1.0-消息通知-原型.html \
  --output ../deliverables/金融服务平台-运营端-消息通知-入库版.html
```

输出 HTML 从当前仓库源文件内联 CSS / JS，可单文件双击打开，无网络依赖。生成件不放回仓库，避免出现第二份可编辑公共代码；公共源更新后重新执行导出即可。

该脚本处理本仓库采用的普通 stylesheet link / script src 写法，不是通用网页打包器；不收录远程资源。

省略 `--source` 时仍导出协议管理，保留已发布的 `export.py --output …` 用法。三个模块的仓库版导航可互相跳转；单文件附件中的跨模块链接会显示范围提示，完整跨模块操作请使用完整仓库。
