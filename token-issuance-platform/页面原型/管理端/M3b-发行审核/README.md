# M3b · 发行审核与机构分配

2026-11-06 · existing-system adaptation / console · 中文与 English。画面中的机构、企业、邮箱、编号、文件和时间均为演示数据。

## 本轮范围

本轮仅更新最新机构分配规则涉及的发行审核：先至少成功分配一家机构，才开放运营铸造或驳回；未上传任何机构材料也可以继续处理。删除原机构一审、机构通过与驳回的画面和路由。

- 本轮修改：运营列表、详情、进度、分配名单、共享材料与文件预览；初始入口 `o-list-unassigned`，分配后示例列表 `o-list`。
- 本轮新增：单家或多家分配、三类机构的全部八种选择画面、调整分配、移除确认、至少保留一家、无启用机构、读取失败、保存失败、提交中、材料读取失败不阻断处理。
- 继承：原合约选择、上链字段、平台签名、交易结果、失败重试和并发反馈；本轮对受影响的“二审”文案改为运营处理，没有修改数量、地址、到期日、签名和重试规则。

主流程：`o-list-unassigned → o-wait-reg → assign-empty → assign-one / assign-ready → o-assigned-one / o-wait-ops → o-pass → o-pass-ready → o-pass-confirm → o-mint-signing → o-mint-waiting → o-mint-success`。分配机构不限定每种类型都出现；停用机构不进入新增分配选项。

选择组合是预设画面跳转，包含 C、D、E 各自单选以及所有多选组合，不运行真实分配计算。铸造和重试沿用同一组固定示例，最终结果画面以 C + D 为示例；不是可保存任意组合的业务模拟器。

## 打开方式

- 完整联看：双击 [index.html](../../index.html)，选择运营或机构；面客端选择已认证企业。侧栏与原有分区导航可跨模块往返。
- 当前源页：[原型 HTML](发行审核.html)。技术文件名保持稳定，避免既有路由断开。
- 单文件附件：在 `页面原型/` 执行 `python3 _shared/export.py --source 管理端/M3b-发行审核/发行审核.html --output <仓库外路径>.html`；生成件可双击离线打开。单文件不包含其他模块的画面，跨模块入口提示在完整原型中查看。
- 右下角“画面目录 · 演示数据”默认关闭，可以选择所有画面与主流程下一屏。只切换预设画面，不接真实接口、邮件、文件、权限或链上交易。

## 画面清单

共 111 屏。数量包含继承的画面，不等于本轮优化数量。

| 分组 | 画面 ID 与名称 |
| --- | --- |
| 运营 · 申请列表 | `o-list` 申请列表；`o-list-empty` 暂无申请；`o-list-noresults` 筛选无结果；`o-list-error` 列表读取失败；`o-list-mint` 铸造失败申请列表；`o-list-unassigned` 待分配机构 · 申请列表 |
| 运营 · 申请详情 | `o-wait-reg` 待分配机构；`o-wait-ops` 运营处理中；`o-ops-rejected` 运营驳回；`o-minting` 铸造中；`o-failed` 铸造失败；`o-success` 铸造成功；`o-detail-error` 申请详情读取失败；`o-detail-denied` 无权查看或申请不存在；`o-upstream` 上游撤销确权；`o-cache` 上游暂时不可用；`o-minting-disabled` 铸造中 · 原合约平台停用；`o-minting-timeout` 铸造中 · 已超时；`o-sign-error` 业务签名读取失败；`o-assigned-one` 分配一家机构 · 零材料；`o-with-material` 运营处理中 · 已有机构材料；`o-material-error` 运营处理中 · 材料读取失败；`o-assigned-D` 机构分配 · D；`o-assigned-E` 机构分配 · E；`o-assigned-CE` 机构分配 · CE；`o-assigned-DE` 机构分配 · DE；`o-assigned-CDE` 机构分配 · CDE |
| 机构材料 · 查看与下载 | `o-file-view` 运营 · 查看机构材料；`o-file` 运营 · 协议查看失败；`o-file-download` 运营 · 协议下载失败 |
| 运营 · 运营处理驳回 | `o-reject` 驳回 · 空白意见；`o-reject-ready` 驳回 · 已填写；`o-reject-error` 驳回 · 必填提示；`o-reject-save-error` 驳回 · 未提交成功；`o-reject-confirm` 确认驳回申请；`o-reject-submitting` 正在提交驳回 |
| 运营 · 运营处理通过 | `o-pass` 第 1 步 · 未选合约；`o-pass-ready` 第 1 步 · 已选合约；`o-pass-none` 第 1 步 · 无可用合约；`o-pass-load-error` 第 1 步 · 合约读取失败；`o-pass-unavailable` 第 2 步 · 所选合约失效；`o-pass-save-error` 第 2 步 · 未提交成功；`o-pass-confirm` 第 2 步 · 发起铸造 |
| 运营 · 铸造进度 | `o-pass-submitting` 运营处理通过 · 记录中；`o-mint-signing` 平台签名并提交；`o-mint-waiting` 等待链上结果；`o-mint-timeout` 等待链上结果 · 已超时；`o-mint-success` 铸造成功；`o-mint-failed` 链上执行失败；`o-mint-sign-failed` 平台未能签名或提交 |
| 运营 · 铸造重试 | `o-retry` 确认重试铸造；`o-retry-platform-disabled` 原合约平台停用 · 仍可重试；`o-retry-unavailable` 原合约链上执行异常；`o-retry-failed` 重试未能发起；`o-retry-submitting` 重试 · 平台签名并提交 |
| 操作反馈 | `o-changed` 运营 · 申请状态已变化 |
| 机构分配 | `assign-empty` 机构分配 · 未选择；`assign-one` 机构分配 · 已选择；`assign-ready` 机构分配 · 已选择；`assign-fail` 机构分配 · 保存失败；`assign-saving` 机构分配 · 提交中；`assign-none` 机构分配 · 暂无启用机构；`assign-error` 机构分配 · 读取失败；`assign-manage` 调整分配；`assign-remove` 确认移除机构；`assign-last` 必须保留至少一家机构。；`assign-D` 机构分配 · 已选择；`assign-E` 机构分配 · 已选择；`assign-CE` 机构分配 · 已选择；`assign-DE` 机构分配 · 已选择；`assign-CDE` 机构分配 · 已选择；`assign-manage-empty` 调整分配；`assign-manage-C` 调整分配；`assign-manage-D` 调整分配；`assign-manage-CD` 调整分配；`assign-manage-E` 调整分配；`assign-manage-CE` 调整分配；`assign-manage-DE` 调整分配；`assign-manage-CDE` 调整分配 |

## 核验与边界

Chromium 桌面核验覆盖中文 / English、1280 / 1440 / 1920 px，检查页面切换、脚本错误、整体横向溢出；新主流程、菜单权限呈现、弹窗键盘与关闭返回、离线附件另做定向核验。实际结果见本轮交付说明。

未验证 Safari / Firefox、1280 px 以下宽度和真实后端权限。未确认机构材料的格式、大小、份数，不沿用资质附件的 PDF 限制；不提供铸造成功后的机构名单变更；不向通用机构赋予未确认的解除职责。M7 旧业务通知内容本轮未重设计。


## 2026-11-06 · M5 边界对齐

按最新 M5 PRD，将原由 M5 承载的 32 屏机构待办与材料画面连同路由原样迁入本模块。`tasks`、`institutionApplication`、`institutionApplicationMinted` 现由本模块提供；侧栏与登录后机构默认入口保持可达。此次只迁移归属，不新增或改变 M3b 业务规则。迁入画面如下，均可通过本模块画面目录进入。

| 分组 | 迁入画面 |
| --- | --- |
| 机构待办与材料 | `task-list` 机构待办 · 本机构；`task-list-ops` 机构待办 · 全平台；`task-list-handled` 机构待办 · 已处理；`task-list-closed` 机构待办 · 已关闭；`task-empty` 暂无机构待办；`task-error` 机构待办 · 读取失败；`task-application` 机构待办 · 首次上传；`task-application-shared` 机构待办 · 其他机构已上传；`task-application-uploaded` 机构待办 · 首次上传已处理；`task-token` 铸造成功 · 首次待办保留；`task-token-uploaded` 铸造成功 · 继续追加材料；`task-rejected` 申请驳回 · 历史材料；`task-disabled` 停用机构 · 继续上传；`task-ops-detail` 机构待办 · 运营查看；`task-denied` 机构范围外或已移除；`task-material-error` 机构材料 · 读取失败 |
| 机构材料上传 | `material-upload-application` 材料上传 · 尚未选择文件；`material-upload-application-ready` 材料上传 · 已选择文件；`material-upload-application-error` 材料上传 · 上传失败；`material-upload-application-saving` 材料上传 · 提交中；`material-upload-application-required` 材料上传 · 必填提示；`material-upload-application-save-error` 材料上传 · 保存失败；`material-upload-application-uploading` 材料上传 · 文件上传中；`material-upload-token` 材料上传 · 尚未选择文件；`material-upload-token-ready` 材料上传 · 已选择文件；`material-upload-token-error` 材料上传 · 上传失败；`material-upload-token-saving` 材料上传 · 提交中；`material-upload-token-required` 材料上传 · 必填提示；`material-upload-token-save-error` 材料上传 · 保存失败；`material-upload-token-uploading` 材料上传 · 文件上传中；`material-preview` 文件预览；`material-file-error` 机构材料 · 文件读取失败 |

迁移验证：Chromium 中英文 × 1280/1440/1920 px 检查全部 32 屏与两屏既有申请页面；机构/运营及停用、改邮箱身份的入口可达，材料弹窗可打开并用 Esc 返回，无脚本错误或整体横向溢出。业务规则仍按 M3b PRD 验收。
