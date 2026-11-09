# M3b · 发行审核与机构分配

2026-11-09 · existing-system adaptation / console · 中文与 English。画面中的机构、企业、邮箱、编号、文件和时间均为演示数据。

## 本轮范围

按 `cly-v6.0.0` 的 PRD `07841ac` 和本 issue 已确认建议，补齐多机构、多批材料的画面表达。沿用 `_shared/tokens.css`、`components.css`、`asset-detail.js` 和现有壳层；组件约定见[组件规范 §7.1](../../_shared/design-system/组件规范.md#71-机构分配与材料2026-11-06)。规则、校验与异常分支以 PRD 为准。

- 本轮修改 23 屏：19 个运营详情的当前/最终分配名单改为一家一行，字段为机构名称、类型、启停状态、分配时间；未分配与无移除记录分别展示空态。`o-with-material`、`task-application-shared`、`task-application-uploaded`、`task-rejected`、`task-ops-detail` 的材料改为按上传批次组织的记录，保留上传主体、阶段、说明、时间及时区。
- 多机构示例：`o-with-material`（目录名“运营处理中 · 多机构多批材料”）和 `task-application-uploaded` 展示 C、D 两机构的三批上传，共五份文件；D 的两批独立保留，第一批默认展开。机构只看到有权共享的材料，不显示完整名单。每份文件可打开对应机构、格式与大小的预览信息弹窗，下载仍提示演示文件。
- 新增 10 屏文件预览，运营/机构各五屏。继承其余 88 屏及已有主流程：列表、分配表单、上传反馈、其他文件查看、合约选择、上链字段、签名、交易结果、重试与并发反馈。机构/企业端不增加运营日志；本轮不改其业务规则，不对继承范围重新宣称 PRD 全量验收。
- 所有详情从下方画面目录进入；主流程从 `o-list-unassigned` 开始。详情的“操作进度”分区导航可直接定位页面底部，画面目录默认关闭。

主流程：`o-list-unassigned → o-wait-reg → assign-empty → assign-one / assign-ready → o-assigned-one / o-wait-ops → o-pass → o-pass-ready → o-pass-confirm → o-mint-signing → o-mint-waiting → o-mint-success`。分配机构不限定每种类型都出现；停用机构不进入新增分配选项。

选择组合是预设画面跳转，包含 C、D、E 各自单选以及所有多选组合，不运行真实分配计算。铸造和重试沿用同一组固定示例，最终结果画面以 C + D 为示例；不是可保存任意组合的业务模拟器。

## 打开方式

- 完整联看：双击 [index.html](../../index.html)，选择运营或机构；面客端选择已认证企业。侧栏与原有分区导航可跨模块往返。
- 当前源页：[原型 HTML](发行审核.html)。技术文件名保持稳定，避免既有路由断开。
- 单文件附件：在 `页面原型/` 执行 `python3 _shared/export.py --source 管理端/M3b-发行审核/发行审核.html --output <仓库外路径>.html`；生成件可双击离线打开。单文件不包含其他模块的画面，跨模块入口提示在完整原型中查看。
- 右下角“画面目录 · 演示数据”默认关闭，可以选择所有画面与主流程下一屏。只切换预设画面，不接真实接口、邮件、文件、权限或链上交易。

## 画面清单

共 121 屏。数量包含继承的画面，不等于本轮优化数量。

| 分组 | 画面 ID 与名称 |
| --- | --- |
| 多文件预览（本轮新增） | `ops-material-file-audit`、`ops-material-file-audit-photo`、`ops-material-file-custody`、`ops-material-file-check`、`ops-material-file-check-photo`；机构端对应 `reg-material-file-*` 五屏。均从上述材料批次的文件名进入，关闭后回到原申请，保留展开状态。 |
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

本轮 Chromium 实测 23 个修订画面 + 10 个文件预览 × 中文 / English × 1280 / 1440 / 1920 px，覆盖源码、本地离线文件与受限 `srcdoc` 嵌入预览三种打开方式，无整体横向溢出、表格/材料区溢出或脚本错误。五个材料示例均核验原生概要的 Enter / Space 展开、各文件名预览及 Escape 关闭返回与焦点恢复；UTC / Asia/Shanghai 转换正常。画面目录可见全部 121 屏入口，附件无外部请求，另 88 屏源码与修订前逐屏比对一致。分配/铸造主流程继承前轮结果，本轮未重新进行全流程业务验收。

未验证 Safari / Firefox、1280 px 以下宽度和真实后端权限。本轮不重新核验机构材料上传限制、成功后的材料待办、后续模块职责或 M7 旧业务通知；这些继承画面的规则以最新 PRD 为准。操作历史为明确标注的演示数据，不接真实审计日志或链上服务。

2026-11-09 修复：附件嵌入 `srcdoc` 沙箱时，历史地址写入被拒绝曾中断展示渲染，导致操作进度和其他日期、时区为空。共享 `frame.js` 现允许继续渲染；页面布局与业务数据未改。Chromium 实测本地单文件与受限嵌入预览各 19 详情 × 中英文 × 1280/1440/1920 px，初次渲染、按钮切屏、弹窗焦点/关闭、底部定位与 UTC/Asia/Shanghai 转换均正常，无脚本错误；另核验 M3a、M4b、M5 导出件的嵌入启动。


2026-11-09 补数：运营主流程详情此前除 `o-with-material` 外均显示“暂无机构材料”，从申请列表或 index.html 进入时看不到有数据的材料区。现将同一申请（C + D 分配）的三批五份材料补入 `o-wait-ops`、`o-ops-rejected`、`o-minting`、`o-minting-disabled`、`o-minting-timeout`、`o-failed`、`o-success`、`o-upstream`、`o-cache`、`o-sign-error` 共 10 屏，上传时间均早于驳回/发起铸造，阶段为“铸造前”。`o-wait-reg`（未分配）与 `o-assigned-*`（刚完成分配）保留零材料空态。文件预览弹窗关闭后回到打开时的详情。Chromium 实测源码与单文件附件各 11 详情 × 中文 / English × 1280 / 1440 / 1920 px，材料区、时间时区、展开与预览返回正常，无脚本错误或整体横向溢出；组件与业务规则未改。

## 2026-11-06 · M5 边界对齐

按最新 M5 PRD，将原由 M5 承载的 32 屏机构待办与材料画面连同路由原样迁入本模块。`tasks`、`institutionApplication`、`institutionApplicationMinted` 现由本模块提供；侧栏与登录后机构默认入口保持可达。此次只迁移归属，不新增或改变 M3b 业务规则。迁入画面如下，均可通过本模块画面目录进入。

| 分组 | 迁入画面 |
| --- | --- |
| 机构待办与材料 | `task-list` 机构待办 · 本机构；`task-list-ops` 机构待办 · 全平台；`task-list-handled` 机构待办 · 已处理；`task-list-closed` 机构待办 · 已关闭；`task-empty` 暂无机构待办；`task-error` 机构待办 · 读取失败；`task-application` 机构待办 · 首次上传；`task-application-shared` 机构待办 · 其他机构已上传；`task-application-uploaded` 机构待办 · 首次上传已处理；`task-token` 铸造成功 · 首次待办保留；`task-token-uploaded` 铸造成功 · 继续追加材料；`task-rejected` 申请驳回 · 历史材料；`task-disabled` 停用机构 · 继续上传；`task-ops-detail` 机构待办 · 运营查看；`task-denied` 机构范围外或已移除；`task-material-error` 机构材料 · 读取失败 |
| 机构材料上传 | `material-upload-application` 材料上传 · 尚未选择文件；`material-upload-application-ready` 材料上传 · 已选择文件；`material-upload-application-error` 材料上传 · 上传失败；`material-upload-application-saving` 材料上传 · 提交中；`material-upload-application-required` 材料上传 · 必填提示；`material-upload-application-save-error` 材料上传 · 保存失败；`material-upload-application-uploading` 材料上传 · 文件上传中；`material-upload-token` 材料上传 · 尚未选择文件；`material-upload-token-ready` 材料上传 · 已选择文件；`material-upload-token-error` 材料上传 · 上传失败；`material-upload-token-saving` 材料上传 · 提交中；`material-upload-token-required` 材料上传 · 必填提示；`material-upload-token-save-error` 材料上传 · 保存失败；`material-upload-token-uploading` 材料上传 · 文件上传中；`material-preview` 文件预览；`material-file-error` 机构材料 · 文件读取失败 |

迁移验证：Chromium 中英文 × 1280/1440/1920 px 检查全部 32 屏与两屏既有申请页面；机构/运营及停用、改邮箱身份的入口可达，材料弹窗可打开并用 Esc 返回，无脚本错误或整体横向溢出。业务规则仍按 M3b PRD 验收。
