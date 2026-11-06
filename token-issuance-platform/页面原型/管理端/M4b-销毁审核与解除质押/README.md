# M4b · 销毁审核与代币台账

2026-11-06 · existing-system adaptation / console · 中文与 English。画面中的机构、企业、邮箱、编号、文件和时间均为演示数据。

## 本轮范围

本轮只更新机构权限与代币材料入口，保留既有销毁业务计算、签名、持有地址检查、重试和运营历史记录。

- 本轮修改：机构菜单去掉解除操作；删除机构解除操作画面和路由；关联代币按铸造时最终分配名单查看；代币详情追加机构材料区。
- 本轮新增：未销毁的已关联代币上传说明与文件入口、各代币独立上传画面、已选文件、保存失败、追加成功与文件预览。新材料保留旧记录，代币数量、合约、地址、融资与销毁状态不变。
- 继承未重设计：运营销毁审核和历史解除记录。销毁后专属解除职责归属仍待业务确认，通用机构账号无此操作；已销毁代币只展示历史，不新增未确认的上传场景。

主流程：机构 `rl-list → rl-027 → rl-027-material-upload → rl-027-material-upload-ready → rl-027-material-saved`；已存在材料的 `rl-001` 展示追加前后的独立记录。运营只能查看机构材料，不提供代机构上传入口。

实际权限过滤、永久文件、铸造结果与最终名单锁定需要后端实现，当前仅画预设结果。

## 打开方式

- 完整联看：双击 [index.html](../../index.html)，选择运营或机构；面客端选择已认证企业。侧栏与原有分区导航可跨模块往返。
- 当前源页：[原型 HTML](销毁审核与解除质押.html)。技术文件名保持稳定，避免既有路由断开。
- 单文件附件：在 `页面原型/` 执行 `python3 _shared/export.py --source 管理端/M4b-销毁审核与解除质押/销毁审核与解除质押.html --output <仓库外路径>.html`；生成件可双击离线打开。单文件不包含其他模块的画面，跨模块入口提示在完整原型中查看。
- 右下角“画面目录 · 演示数据”默认关闭，可以选择所有画面与主流程下一屏。只切换预设画面，不接真实接口、邮件、文件、权限或链上交易。

## 画面清单

共 87 屏。数量包含继承的画面，不等于本轮优化数量。

| 分组 | 画面 ID 与名称 |
| --- | --- |
| 运营 · 销毁审核列表 | `b-list` 销毁申请列表；`b-list-empty` 暂无销毁申请；`b-list-error` 列表读取失败 |
| 运营 · 销毁详情 | `b-pending` 待运营审核 · 条件满足；`b-pending-2` 待运营审核 · 其他申请；`b-contract-off` 待运营审核 · 原合约平台停用；`b-not-held` 待运营审核 · 持有地址不是铸造到账地址；`b-pending-pledged` 待运营审核 · 代币在质押地址；`b-unknown` 待运营审核 · 条件无法确认；`b-signature-fail` 待运营审核 · 签名记录读取失败；`b-burning` 销毁中；`b-failed` 销毁失败；`b-failed-pledged` 销毁失败 · 代币在质押地址；`b-failed-sign` 销毁失败 · 平台未能签名或提交；`b-failed-holding` 销毁失败 · 持有信息查询失败；`b-release` 销毁成功 · 待解除监管；`b-release-2` 待解除机构 · 其他申请；`b-released` 已解除监管；`b-rejected` 驳回；`b-detail-error` 详情读取失败；`b-notfound` 无权查看或内容不存在 |
| 运营 · 通过并销毁 | `b-approve` 确认通过并销毁；`b-approve-submitting` 正在提交审核；`b-approve-blocked` 提交时条件不满足；`b-changed` 申请已被处理 |
| 运营 · 驳回 | `b-reject` 驳回 · 未填写意见；`b-reject-error` 驳回 · 必填提示；`b-reject-ready` 驳回 · 已填写意见；`b-reject-submitting` 正在提交驳回 |
| 运营 · 驳回销毁失败的申请 | `b-reject-failed` 驳回失败申请 · 已填写意见；`b-reject-failed-submitting` 正在提交驳回；`b-rejected-failed` 驳回 · 由销毁失败驳回 |
| 运营 · 失败重试 | `b-retry` 确认重试销毁；`b-retry-blocked` 持有地址不是铸造到账地址；`b-retry-submitting` 正在发起重试；`b-retry-burning` 重试后 · 销毁中 |
| 运营 · 代币台账 | `l-list` 代币台账；`l-empty` 暂无代币；`l-error` 台账读取失败 |
| 机构 · 代币台账 | `rl-list` 代币台账；`rl-empty` 暂无代币；`rl-error` 台账读取失败 |
| 运营 · 代币详情 | `l-001` 未到期 · 未申请；`l-027` 新铸造 · 未申请；`l-031` 其他机构；`l-021` 待运营审核；`l-022` 融资中 · 未申请；`l-023` 待运营审核 · 其他代币；`l-024` 已销毁 · 待解除监管；`l-025` 已解除监管；`l-026` 销毁失败；`l-holding-fail` 持有信息查询失败；`l-detail-error` 详情读取失败 |
| 机构 · 代币详情 | `rl-001` 未到期 · 未申请；`rl-027` 新铸造 · 未申请；`rl-021` 待运营审核；`rl-022` 融资中 · 未申请；`rl-023` 待运营审核 · 其他代币；`rl-024` 已销毁 · 待解除监管；`rl-025` 已解除监管；`rl-026` 销毁失败；`rl-denied` 无权查看或内容不存在；`rl-001-material-saved` 材料已追加 · DEMO-TOKEN-001；`rl-027-material-saved` 材料已追加 · DEMO-TOKEN-027；`rl-021-material-saved` 材料已追加 · DEMO-TOKEN-021；`rl-022-material-saved` 材料已追加 · DEMO-TOKEN-022；`rl-023-material-saved` 材料已追加 · DEMO-TOKEN-023；`rl-026-material-saved` 材料已追加 · DEMO-TOKEN-026 |
| 机构材料上传 | `rl-001-material-upload` 材料上传 · 尚未选择文件；`rl-001-material-upload-ready` 材料上传 · 已选择文件；`rl-001-material-upload-fail` 材料上传 · 保存失败；`rl-027-material-upload` 材料上传 · 尚未选择文件；`rl-027-material-upload-ready` 材料上传 · 已选择文件；`rl-027-material-upload-fail` 材料上传 · 保存失败；`rl-021-material-upload` 材料上传 · 尚未选择文件；`rl-021-material-upload-ready` 材料上传 · 已选择文件；`rl-021-material-upload-fail` 材料上传 · 保存失败；`rl-022-material-upload` 材料上传 · 尚未选择文件；`rl-022-material-upload-ready` 材料上传 · 已选择文件；`rl-022-material-upload-fail` 材料上传 · 保存失败；`rl-023-material-upload` 材料上传 · 尚未选择文件；`rl-023-material-upload-ready` 材料上传 · 已选择文件；`rl-023-material-upload-fail` 材料上传 · 保存失败；`rl-026-material-upload` 材料上传 · 尚未选择文件；`rl-026-material-upload-ready` 材料上传 · 已选择文件；`rl-026-material-upload-fail` 材料上传 · 保存失败；`ledger-material-preview` 文件预览 |

## 核验与边界

Chromium 桌面核验覆盖中文 / English、1280 / 1440 / 1920 px，检查页面切换、脚本错误、整体横向溢出；新主流程、菜单权限呈现、弹窗键盘与关闭返回、离线附件另做定向核验。实际结果见本轮交付说明。

未验证 Safari / Firefox、1280 px 以下宽度和真实后端权限。未确认机构材料的格式、大小、份数，不沿用资质附件的 PDF 限制；不提供铸造成功后的机构名单变更；不向通用机构赋予未确认的解除职责。M7 旧业务通知内容本轮未重设计。
