# 金融服务平台原型接入层

本目录只维护本平台的页面登记与导航配置，不复制 token、组件或公共运行时。

`registry.js` 定义 `CF.PAGES`、`CF.NAV`、`CF.MODULES`、`CF.OWNER`、`CF.MSG_PAGE`、`CF.ENTRY`。运营端使用 `end: admin` 表示控制台画布，消息数据的 `end: fs_ops` 是另一维度。资产平台的登记表不在本平台文件中加载，避免资产菜单与运营菜单互相覆盖。

模块 HTML 的加载顺序：

1. `../../../asset-platform/prototypes/_shared/tokens.css`
2. `../../../asset-platform/prototypes/_shared/base.css`
3. 模块专有样式（HTML 内，仅内容组合）
4. `../_shared/registry.js`
5. `../../../asset-platform/prototypes/_shared/shell.js`
6. 模块脚本（HTML 内，调用 `CF.define()` 和 `CF.boot()`）

相对路径以本平台的模块子目录为起点。公共源文件只读复用，其路径和资产原型均不迁移、不修改。

本平台登记 P-O01～P-O06 和已入库协议管理 P-O-AG-01～04；侧栏为总览、协议管理。为 WS-309 保留 P-O20／P-O21。消息原型尚未入库，`fs-ops-notify` 暂时指向账户模块的接入边界（不是消息页面实现），让其他模块的铃铛也能进入明确的边界说明。跨文件进入账户模块仍经登录守卫，不模拟跨模块单点登录。WS-309 接入时登记真实文件、将其页面从登录模块的 `owns` 中移出，再验证铃铛／账号菜单的跨文件跳转；不能把消息页实现放到账户模块。

新增模块先在此登记，再引用同一公共运行时。若要交付可单独下载的 HTML，使用 `export.py` 机械内联公共文件，勿手改导出的快照。

导出工具保留协议管理既有 `--output` 用法；其他模块用 `--source <HTML> --output <附件>`。导出附件内点击跨模块链接会提示使用完整仓库，避免跳转到不存在的相邻文件。仓库版链接正常跳转。
