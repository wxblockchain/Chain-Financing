# M3b · 发行审核与机构材料 · UI 核验

2026-11-09 · existing-system adaptation / console · 中文与 English。企业、机构、账号、文件、时间及数值为演示数据。

## 本轮结果与范围

基线为 `cly-v6.0.0` 的 `a872c92`，业务以仓库最新 M3b PRD 为准。本轮在最新 140 屏原型上统一 UI，沿用项目 token、共享壳层、图标、状态标签和详情导航。不是上一轮 79 屏附件的继续版本。

- 申请列表维持八列及全部现有内容，调整名称、名单、日期和状态的宽度；编号整段展示，操作列保留吸右。最小宽 960 px，仅表内横向滚动。
- 26 个机构候选表启用 `.institution-choice`，勾选列 44 px，机构名 34%，状态 104 px，类型占余宽。只读名单和确认表不改变列语义；保留固定 600 × 700 px 分步弹窗。
- 运营四项“申请信息”改为两列；机构端七项或九项信息保留三列；业务签名与上方四阶段紧凑概览继承既有结构。
- `.review-screen` 与 M3a 共用平铺文件行：文件之间使用轻分隔线，不再逐份套框；保留完整名称、格式大小及预览、下载、移除入口。材料批次的机构/文件数、类型/账号、说明和时间形成清晰层级；时间靠该行右侧，较窄时回流。
- 底部操作记录保留原顺序和内容；角色账号与日期时区分列，结果详情改用轻竖线承接，减少重复浅底卡片。
- 评审目录复用侧栏空白区的位置变体，不再覆盖文件操作和弹窗底栏；菜单、画面目录内容、ID 与路由保持。

共享组件规范已同步至 v1.60。仅修改 M3b HTML / README、共享 CSS 的显式组件变体及组件规范；无新增 token，无模块私有样式文件，无业务脚本变化。M3a / M4a 沿用原有样式与业务内容。

## 保留的业务边界

机构只增不减、每类型最多一家、保存前确认、发起铸造须有资产托管机构、名单快照与重试、机构只补材料、铸造成功关闭待办并停止上传等规则均继承。没有增加画面、状态、业务字段、计算、校验或模拟保存。

静态比对确认：140 个画面的可见业务文字、非 class 属性、跳转/事件/禁用条件、内联脚本与基线一致。仅增加视觉类，并把既有四字段组从三列改为两列。

## 实际核验

- Chromium：源码与导出附件各 140 屏 × 中文 / English × 1280 / 1440 / 1920 px，共 1680 组布局。无脚本错误、整页或弹窗横向溢出、空白业务时间；弹窗底栏可达。
- 点击路径：首次分配选择与确认、新增机构确认与 Esc 返回、缺托管机构时铸造仍禁用、成功后机构材料只读。
- 键盘与滚动：材料 Enter 展开、文件预览及 Esc 返回保留展开状态和焦点；分步弹窗等高与 Tab 焦点约束；底部操作进度定位及 UTC / Asia/Shanghai 切换。
- 受限 `srcdoc` 嵌入：核验操作进度时间、材料预览、Esc 返回及分配弹窗正常；这是本地模拟受限嵌入，未验证平台实际预览页面。
- 共享消费者：M3a、M4a 的启动布局检查；本轮未重做其全量页面核验。未验证 Safari / Firefox、1280 px 以下、真实权限、存储、钱包或链上服务。

## 基线业务覆盖缺口

核查呈现时发现，继承原型仍未完整体现最新 PRD：

- §6.1 的初始单位价值输入（默认 1 USD）、初始资产估值，及 §6.1.1 的完整资产价值/初始单位价值等上链核对字段未完整出现在现有铸造画面。
- §5.1 所列资产类型、已分配机构数量、最近处理时间及类型/提交时间筛选未完整出现在八列列表中。
- §5.2 的企业注册号、所签内容及申请文件元信息/访问操作记录未完整呈现。

这些在基线中已存在，不是本轮 UI 引入。本轮遵守视觉深化边界，未补造业务字段或计算；需上游按 PRD 补齐原型后再核查。因此，本次通过的是 UI 呈现核验，不等于 PRD 或 Eval 全量业务验收。

## 打开与导出

- 完整原型：[index.html](../../index.html)。运营进入“发行审核”，机构进入“机构待办”。
- 当前源页：[发行审核.html](发行审核.html)。初始入口 `o-list-unassigned`；右下/侧栏“画面目录 · 演示数据”可选择全部画面及下一屏。
- 离线附件：`WS514-M3b-UI统一版-20261109.html` 双击即可打开，无需服务，不含其他模块的完整页面。
- 从源导出：在 `页面原型/` 运行 `python3 _shared/export.py --source 管理端/M3b-发行审核/发行审核.html --output <仓库外路径>.html`。
- 当前预设主流程：`o-list-unassigned → o-wait-reg → assign-empty → assign-ready → assign-ready-confirm → o-wait-ops → o-pass → o-pass-ready → o-pass-confirm`。后续铸造与重试使用原有画面目录，不自动执行交易。

## 画面目录

保留全部 140 屏，数量包含继承画面，不等于本轮新增画面或功能。

| 分组 | 画面 |
| --- | --- |
| 运营 · 申请列表 | `o-list` 申请列表；`o-list-empty` 暂无申请；`o-list-noresults` 筛选无结果；`o-list-error` 列表读取失败；`o-list-mint` 铸造失败申请列表；`o-list-unassigned` 待分配机构 · 申请列表 |
| 运营 · 申请详情 | `o-wait-reg` 待分配机构；`o-wait-ops` 运营处理中；`o-ops-rejected` 运营驳回；`o-minting` 铸造中；`o-failed` 铸造失败；`o-success` 铸造成功；`o-detail-error` 申请详情读取失败；`o-detail-denied` 无权查看或申请不存在；`o-upstream` 上游撤销确权；`o-cache` 上游暂时不可用；`o-minting-disabled` 铸造中 · 原合约平台停用；`o-minting-timeout` 铸造中 · 已超时；`o-sign-error` 业务签名读取失败；`o-assigned-one` 分配一家机构 · 零材料；`o-with-material` 运营处理中 · 多机构多批材料；`o-material-error` 运营处理中 · 材料读取失败；`o-assigned-D` 机构分配 · D；`o-assigned-E` 机构分配 · E；`o-assigned-CE` 机构分配 · CE；`o-assigned-DE` 机构分配 · DE；`o-assigned-CDE` 机构分配 · CDE |
| 机构材料 · 查看与下载 | `o-file-view` 运营 · 查看机构材料；`o-file` 运营 · 协议查看失败；`o-file-download` 运营 · 协议下载失败 |
| 运营 · 运营处理驳回 | `o-reject` 驳回 · 空白意见；`o-reject-ready` 驳回 · 已填写；`o-reject-error` 驳回 · 必填提示；`o-reject-save-error` 驳回 · 未提交成功；`o-reject-confirm` 确认驳回申请；`o-reject-submitting` 正在提交驳回 |
| 运营 · 运营处理通过 | `o-pass` 第 1 步 · 未选合约；`o-pass-ready` 第 1 步 · 已选合约；`o-pass-none` 第 1 步 · 无可用合约；`o-pass-load-error` 第 1 步 · 合约读取失败；`o-pass-unavailable` 第 2 步 · 所选合约失效；`o-pass-save-error` 第 2 步 · 未提交成功；`o-pass-confirm` 第 2 步 · 发起铸造 |
| 运营 · 铸造进度 | `o-pass-submitting` 运营处理通过 · 记录中；`o-mint-signing` 平台签名并提交；`o-mint-waiting` 等待链上结果；`o-mint-timeout` 等待链上结果 · 已超时；`o-mint-success` 铸造成功；`o-mint-failed` 链上执行失败；`o-mint-sign-failed` 平台未能签名或提交 |
| 运营 · 铸造重试 | `o-retry` 确认重试铸造；`o-retry-platform-disabled` 原合约平台停用 · 仍可重试；`o-retry-unavailable` 原合约链上执行异常；`o-retry-failed` 重试未能发起；`o-retry-submitting` 重试 · 平台签名并提交 |
| 操作反馈 | `o-changed` 运营 · 申请状态已变化 |
| 机构分配 | `assign-empty` 分配机构 · 未选择；`assign-one` 分配机构 · 已选择 C；`assign-one-confirm` 分配机构 · 确认 C；`assign-D` 分配机构 · 已选择 D；`assign-D-confirm` 分配机构 · 确认 D；`assign-E` 分配机构 · 已选择 E；`assign-E-confirm` 分配机构 · 确认 E；`assign-ready` 分配机构 · 已选择 C + D；`assign-ready-confirm` 分配机构 · 确认 C + D；`assign-CE` 分配机构 · 已选择 C + E；`assign-CE-confirm` 分配机构 · 确认 C + E；`assign-DE` 分配机构 · 已选择 D + E；`assign-DE-confirm` 分配机构 · 确认 D + E；`assign-CDE` 分配机构 · 已选择 C + D + E；`assign-CDE-confirm` 分配机构 · 确认 C + D + E；`assign-saving` 分配机构 · 提交中；`assign-fail` 分配机构 · 保存失败；`assign-none` 分配机构 · 暂无启用机构；`assign-error` 分配机构 · 读取失败；`assign-add-CD` 新增机构 · 已有 C + D · 未选择；`assign-add-CD-E` 新增机构 · 已有 C + D · 选择 E；`assign-add-CD-E-confirm` 新增机构 · 已有 C + D · 确认 E；`assign-add-CD-E-conflict` 新增机构 · 类型已被占用；`assign-add-C` 新增机构 · 已有 C · 未选择；`assign-add-C-D` 新增机构 · 已有 C · 选择 D；`assign-add-C-D-confirm` 新增机构 · 已有 C · 确认 D；`assign-add-C-E` 新增机构 · 已有 C · 选择 E；`assign-add-C-E-confirm` 新增机构 · 已有 C · 确认 E；`assign-add-C-DE` 新增机构 · 已有 C · 选择 D + E；`assign-add-C-DE-confirm` 新增机构 · 已有 C · 确认 D + E；`assign-add-D` 新增机构 · 已有 D · 未选择；`assign-add-D-C` 新增机构 · 已有 D · 选择 C；`assign-add-D-C-confirm` 新增机构 · 已有 D · 确认 C；`assign-add-D-E` 新增机构 · 已有 D · 选择 E；`assign-add-D-E-confirm` 新增机构 · 已有 D · 确认 E；`assign-add-D-CE` 新增机构 · 已有 D · 选择 C + E；`assign-add-D-CE-confirm` 新增机构 · 已有 D · 确认 C + E；`assign-add-E` 新增机构 · 已有 E · 未选择；`assign-add-E-C` 新增机构 · 已有 E · 选择 C；`assign-add-E-C-confirm` 新增机构 · 已有 E · 确认 C；`assign-add-E-D` 新增机构 · 已有 E · 选择 D；`assign-add-E-D-confirm` 新增机构 · 已有 E · 确认 D；`assign-add-E-CD` 新增机构 · 已有 E · 选择 C + D；`assign-add-E-CD-confirm` 新增机构 · 已有 E · 确认 C + D；`assign-add-CE` 新增机构 · 已有 C + E · 未选择；`assign-add-CE-D` 新增机构 · 已有 C + E · 选择 D；`assign-add-CE-D-confirm` 新增机构 · 已有 C + E · 确认 D；`assign-add-DE` 新增机构 · 已有 D + E · 未选择；`assign-add-DE-C` 新增机构 · 已有 D + E · 选择 C；`assign-add-DE-C-confirm` 新增机构 · 已有 D + E · 确认 C |
| 机构待办与材料 | `task-list` 机构待办 · 本机构；`task-list-ops` 机构待办 · 全平台；`task-list-handled` 机构待办 · 已处理；`task-list-closed` 机构待办 · 已关闭；`task-empty` 暂无机构待办；`task-error` 机构待办 · 读取失败；`task-application` 机构待办 · 首次上传；`task-application-shared` 机构待办 · 其他机构已上传；`task-application-uploaded` 机构待办 · 首次上传已处理；`task-token` 铸造成功 · 材料只读；`task-rejected` 申请驳回 · 历史材料；`task-disabled` 停用机构 · 继续上传；`task-ops-detail` 机构待办 · 运营查看；`task-denied` 机构范围外或已移除；`task-material-error` 机构材料 · 读取失败 |
| 机构材料上传 | `material-upload-application` 材料上传 · 尚未选择文件；`material-upload-application-ready` 材料上传 · 已选择文件；`material-upload-application-error` 材料上传 · 上传失败；`material-upload-application-saving` 材料上传 · 提交中；`material-upload-application-required` 材料上传 · 必填提示；`material-upload-application-save-error` 材料上传 · 保存失败；`material-upload-application-uploading` 材料上传 · 文件上传中；`material-preview` 文件预览；`material-file-error` 机构材料 · 文件读取失败 |
| 机构材料 · 多文件预览 | `ops-material-file-audit` DEMO-Audit-Report.pdf · ops；`ops-material-file-audit-photo` DEMO-Audit-Annex.jpg · ops；`ops-material-file-custody` DEMO-Custody-Statement.pdf · ops；`ops-material-file-check` DEMO-Asset-Check.pdf · ops；`ops-material-file-check-photo` DEMO-Asset-Check.png · ops；`reg-material-file-audit` DEMO-Audit-Report.pdf · reg；`reg-material-file-audit-photo` DEMO-Audit-Annex.jpg · reg；`reg-material-file-custody` DEMO-Custody-Statement.pdf · reg；`reg-material-file-check` DEMO-Asset-Check.pdf · reg；`reg-material-file-check-photo` DEMO-Asset-Check.png · reg |
