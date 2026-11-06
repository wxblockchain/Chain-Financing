# M3a · 代币发行申请

2026-11-06 · existing-system adaptation / console · 中文与 English。画面中的机构、企业、邮箱、编号、文件和时间均为演示数据。

## 本轮范围

本轮为机构分配调整的关联修订，不重新设计企业发行流程。

- 删除企业选择机构的表单、机构停用重选、机构读取异常和机构驳回分支。
- 企业申请列表和核对页面不再展示运营的分配名单；提交后先待分配机构，再由运营处理。
- 删除线下签署特定机构协议的提示；机构材料不作为企业提交或运营铸造的前置条件。
- 继承资产选择、自动使用当前登录地址、钱包签名、签名值、提交异常和发行结果；合并最新入库的当前登录地址作为接收地址规则，不修改数值、精度、地址及签名规则。

主流程：`list → asset-none → asset-selected → info-none → confirm → sign-wait → submitting → submit-success → detail-reg`。企业无需选择机构或接收地址；接收地址自动使用提交时登录地址并固化到申请。

## 打开方式

- 完整联看：双击 [index.html](../../index.html)，选择运营或机构；面客端选择已认证企业。侧栏与原有分区导航可跨模块往返。
- 当前源页：[原型 HTML](代币发行.html)。技术文件名保持稳定，避免既有路由断开。
- 单文件附件：在 `页面原型/` 执行 `python3 _shared/export.py --source 面客端/M3a-代币发行/代币发行.html --output <仓库外路径>.html`；生成件可双击离线打开。单文件不包含其他模块的画面，跨模块入口提示在完整原型中查看。
- 右下角“画面目录 · 演示数据”默认关闭，可以选择所有画面与主流程下一屏。只切换预设画面，不接真实接口、邮件、文件、权限或链上交易。

## 画面清单

共 45 屏。数量包含继承的画面，不等于本轮优化数量。

| 分组 | 画面 ID 与名称 |
| --- | --- |
| 申请列表 | `list` 默认；`list-empty` 暂无申请；`list-fail` 列表读取失败；`gate` 未认证企业受限 |
| 1 选择资产 | `asset-none` 尚未选择资产；`asset-selected` 已选择资产（含从可信资产带入）；`asset-empty` 无可发起资产；`asset-fail` 可选资产读取失败；`asset-changed` 带入资产已不满足条件；`asset-view-0128` 资产详情 RA-DEMO-0128；`asset-view-0166` 资产详情 RA-DEMO-0166；`asset-view-0171` 资产详情 RA-DEMO-0171 |
| 2 填写申请信息 | `info-none` 确认自动接收地址 |
| 3 核对并签名提交 | `confirm` 核对申请；`sign-wait` 等待钱包签名；`sign-cancelled` 取消或拒绝签名；`sign-wrong-address` 钱包地址不是登录地址；`sign-wrong-network` 钱包网络不是 Ethereum；`sign-invalid` 签名未通过核对；`submitting` 签名通过，提交中；`submit-success` 提交成功；`submit-fail` 申请保存失败；`submit-unverified` 提交时认证失效；`submit-upstream` 暂时无法确认提交条件；`submit-duplicate` 同一资产已有申请；`submit-asset-changed` 提交时债权人确权已撤销；`submit-ended` 登录结束且未保存 |
| 申请详情 | `detail-reg` 待分配机构（提交时登录地址接收）；`detail-ops` 运营处理中；`detail-ops-rejected` 运营驳回；`detail-progress` 发行处理中；`detail-minted` 铸造成功；`detail-former-login` 提交后登录地址变更（保留历史接收地址）；`detail-denied` 无权查看或申请不存在；`detail-fail` 详情读取失败；`detail-signature-fail` 签名记录读取失败 |
| 监管协议 | `agreement-fail` 协议查看或下载失败 |
| 可信资产衔接 | `asset-reference-ready` 可发行；`asset-reference-pending` RA-DEMO-0128 · 发行申请中；`asset-reference-ops` RA-DEMO-0131 · 发行申请中；`asset-reference-progress` RA-DEMO-0143 · 发行申请中；`asset-reference-issued` RA-DEMO-0102 · 已发行；`asset-reference-ops-rejected` RA-DEMO-0160 · 已驳回；`asset-reference-list` 可信资产入口 |
| 相邻页面衔接 | `leave-confirm` 前往资产可信平台：确认 |

多账户组件的历史设计与样式保留在[后续组件储备](../../_shared/design-system/reserved/多账户组件储备.md)，本期不启用。


## 核验与边界

Chromium 桌面核验覆盖中文 / English、1280 / 1440 / 1920 px，检查页面切换、脚本错误、整体横向溢出；新主流程、菜单权限呈现、弹窗键盘与关闭返回、离线附件另做定向核验。实际结果见本轮交付说明。

未验证 Safari / Firefox、1280 px 以下宽度和真实后端权限。未确认机构材料的格式、大小、份数，不沿用资质附件的 PDF 限制；不提供铸造成功后的机构名单变更；不向通用机构赋予未确认的解除职责。M7 旧业务通知内容本轮未重设计。
