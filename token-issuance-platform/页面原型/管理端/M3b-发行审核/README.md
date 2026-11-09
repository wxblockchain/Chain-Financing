# M3b · 发行审核与机构材料

2026-11-09 · existing-system adaptation / console · 中文与 English。企业、机构、账号、文件、时间及数值为演示数据。

## 基线与本轮范围

业务以 PRD 提交 `a957f38` 的 M3b 四册及 M2 §5.8「业务列表通用规则」为准（上一轮对齐约为 `7fb395b`）。本轮按 PRD 变化同步画面，沿用已确认的 UI 统一版组件与布局，不新增 CSS。

- **发行申请列表**：列改为申请编号、企业名称、资产编号、资产类型、完整资产价值、提交时间、申请状态、已分配机构数量、最近处理时间 + 操作（`.token-list.ledger-list` 密集表，1280 px 时表内横向滚动，操作列固定）；行序按最近处理时间由新到旧；共 12 条，画第 1 页（`data-pager`）。筛选为申请状态、资产类型，“更多筛选”展开提交时间范围，查找申请编号 / 企业名称 / 资产编号。“暂无申请”不显示筛选条；“筛选无结果”保留已填条件；“读取失败”保留条件并可重试。超过两位小数的资产价值按截断展示并可展开完整值。
- **申请详情**：申请信息增加企业登记标识，关联资产增加资产类型；铸造中 / 铸造失败 / 铸造成功增加初始单位价值、代币数量和初始资产估值。
- **通过并铸造**：第 1 步改为“合约与单位价值”，增加铸造初始单位价值（USD，默认 1）、代币数量（1:1）和初始资产估值；新增估值截断示例。第 2 步“写入链上的内容”改为六项（资产编号、完整资产价值、到期日、接收地址、企业业务签名值、铸造初始单位价值），合约与代币符号单列，数量与估值另列并注明估值不上链。
- **超时 / 失败**：超时画面写明平台不提供重试或驳回、请联系平台开发人员查明；铸造失败详情写明只能按原参数重试、不能驳回或终止；重试弹窗增加初始单位价值。删除“原合约链上执行异常”阻断重试画面。
- **删除**：`o-upstream`（上游撤销确权）、`o-retry-unavailable`、运营视角的 `task-list-ops` / `task-ops-detail`，以及已无对应筛选的 `task-list-handled`。`o-cache` 改为“资产信息暂时无法获取”并可重试。
- **机构待办**：只对机构开放。`.seg` 切换“待办”（按分配时间由新到旧）与“已关闭申请”历史（按关闭时间由新到旧，只读），列为申请编号、企业名称、资产编号、分配时间、首次材料状态、申请状态；均带分页；PRD 未规定查找 / 筛选，故不设筛选条。新增“暂无历史申请”。
- **机构申请详情**：按 PRD 可见范围重建，与运营详情同构：进度概览、本机构材料待办、完整机构名单、申请与资产、共享材料、运营处理与铸造结果、操作进度（含操作账号）；不显示企业业务签名和内部铸造失败说明，无驳回 / 铸造 / 重试操作。新增“铸造失败 · 可继续追加”。
- 消息 NT-A07（M7 承载）落地为 `o-wait-reg`，`route.js` 新增 `reviewApplicationUnassigned`；`tasks` 路由只登记机构身份。

## 打开

- 完整原型：[index.html](../../index.html)。运营进入“发行审核”，机构进入“机构待办”。
- 当前源页：[发行审核.html](发行审核.html)，初始入口 `o-list-unassigned`；“画面目录 · 演示数据”可到达全部画面及下一屏。
- 运营主流程：`o-list-unassigned → o-wait-reg → assign-empty → assign-ready → assign-ready-confirm → o-wait-ops → o-pass → o-pass-ready → o-pass-confirm → o-pass-submitting → o-mint-signing → o-mint-waiting → o-mint-success`。
- 机构主流程：`task-list → task-application → material-upload-application → material-upload-application-ready → task-application-uploaded`；历史：`task-history → task-token`。

## 画面目录（138 屏）

| 分组 | 画面 |
| --- | --- |
| 运营 · 申请列表 | `o-list` 申请列表；`o-list-empty` 暂无申请；`o-list-noresults` 筛选无结果；`o-list-error` 列表读取失败；`o-list-mint` 铸造失败申请列表；`o-list-unassigned` 待分配机构 · 申请列表 |
| 运营 · 申请详情 | `o-wait-reg` 待分配机构；`o-wait-ops` 运营处理中；`o-ops-rejected` 运营驳回；`o-minting` 铸造中；`o-failed` 铸造失败；`o-success` 铸造成功；`o-detail-error` 读取失败；`o-detail-denied` 无权查看或申请不存在；`o-cache` 资产信息暂时无法获取；`o-minting-disabled` 铸造中 · 原合约平台停用；`o-minting-timeout` 铸造中 · 已超时；`o-sign-error` 业务签名读取失败；`o-assigned-one` / `o-with-material` / `o-material-error`；`o-assigned-D` / `-E` / `-CE` / `-DE` / `-CDE` 不同名单 |
| 机构材料 · 查看与下载 | `o-file-view`；`o-file`；`o-file-download` |
| 运营 · 驳回 | `o-reject`；`o-reject-ready`；`o-reject-error`；`o-reject-save-error`；`o-reject-confirm`；`o-reject-submitting` |
| 运营 · 通过并铸造 | `o-pass` 未选合约；`o-pass-ready` 已选合约；`o-pass-truncated` 估值超过两位小数；`o-pass-none`；`o-pass-load-error`；`o-pass-unavailable`；`o-pass-save-error`；`o-pass-confirm` |
| 运营 · 铸造进度 | `o-pass-submitting`；`o-mint-signing`；`o-mint-waiting`；`o-mint-timeout`；`o-mint-success`；`o-mint-failed`；`o-mint-sign-failed` |
| 运营 · 铸造重试 | `o-retry`；`o-retry-platform-disabled` 原合约平台停用 · 仍可重试；`o-retry-failed` 重试未能发起；`o-retry-submitting` |
| 操作反馈 | `o-changed` 申请状态已变化 |
| 机构分配 | `assign-*` 首次分配（选择 / 确认 / 提交中 / 失败 / 无启用机构 / 读取失败）与 `assign-add-*` 新增机构各组合，共 50 屏，未改动 |
| 机构待办与材料 | `task-list` 待办列表；`task-history` 已关闭申请；`task-empty` 暂无待办；`task-history-empty` 暂无历史申请；`task-error` 待办读取失败；`task-denied` 不在名单内 · 无权查看 |
| 机构待办 · 申请详情 | `task-application` 待首次上传；`task-application-shared` 其他机构已上传；`task-application-uploaded` 首次材料已完成；`task-failed` 铸造失败 · 可继续追加；`task-token` 铸造成功 · 只读；`task-rejected` 运营驳回 · 只读；`task-disabled` 停用机构 · 继续办理；`task-material-error` 材料读取失败 |
| 机构材料上传与预览 | `material-upload-application*` 7 屏；`material-preview`；`material-file-error`；`ops-material-file-*` / `reg-material-file-*` 各 5 屏 |

## 待确认

- PRD §5.2「企业与资产」列有“债务人与交易对手”，应收账款下交易对手与债务人的区别未定义，画面只展示债务人。
- PRD 未规定初始单位价值的展示精度，演示按两位小数展示 1.00 USD；截断示例使用 0.80009 USD 以呈现第三位小数，实际精度以合约与业务共同支持的精度为准。
- 机构待办与已关闭申请历史未规定查找 / 筛选条件，原有“任务状态”筛选与查找已移除；如需保留请在 PRD 补充。
- 已关闭申请历史按关闭时间排序，但字段与待办相同、不展示关闭时间；是否需要展示关闭时间待 PRD 确认。

## 实际核验

- Chromium（Playwright，file://）：138 屏 × 中文 / English，1280 px 逐屏 `TP.show`：无脚本错误，无整页横向溢出；English 下新增文案均有译文（演示名称、意见原文按约定不翻译）。
- 跳转登记：全部 `data-go` / `data-next` / `data-base` / 面包屑目标均指向现有画面。
- 通过并铸造第 2 步内容高于弹窗固定高度，在弹窗正文内滚动；申请列表在 1280 px 时表内横向滚动查看后两列。
- 未验证：1440 px 以上与 Safari / Firefox、仓库联看跨模块跳转（NT-A07 消息入口由 M7 接入）、真实权限、存储与链上服务。
