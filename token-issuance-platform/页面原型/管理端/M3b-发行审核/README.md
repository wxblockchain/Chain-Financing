# M3b · 发行审核与机构材料

2026-11-09 · existing-system adaptation / console · 中文与 English。企业、机构、账号、文件、时间及数值为演示数据。

## 基线与本轮范围

业务以 PRD 提交 `68c2e54` 的 M3b 四册及 M2 §5.8「业务列表通用规则」为准（上一轮对齐 `a957f38`，见提交 `fe8bffa`）。本轮只同步 PRD 变化涉及的画面，沿用已确认的 UI 统一版组件与布局，不新增 CSS。

- **企业与资产**（运营与机构全部申请详情的“关联资产”，26 屏）：“债务人”改为“债务人名称”“债务人英文名称”两个字段，与 M2 同一资产一致；RA-DEMO-0131 上游未提供英文名称，展示“未提供”，不补写。
- **初始单位价值**：申请详情（`o-minting` / `o-failed` / `o-success` 及机构 `task-failed` / `task-token` 等）、发起铸造复核（`o-pass-confirm` 及后续铸造进度）、重试弹窗（`o-retry*`）统一为“1 COU = 1 USD”，按填写的完整值展示，不补零；初始资产估值仍按两位小数截断。`o-pass-truncated` 的输入值 0.80009 保持完整值。代币符号统一为大写 COU（原为 cou）。
- **机构待办 `task-list`**：增加查找（申请编号、企业名称、资产编号）与“首次材料状态”筛选（待上传、已完成）；`task-error` 保留筛选条。
- **已关闭申请 `task-history`**：增加查找与“申请结果”筛选（运营驳回、铸造成功）；新增“关闭时间”列（驳回生效或铸造成功时间），按关闭时间由新到旧排列。
- **新增**：`task-list-noresults` 待办 · 筛选无结果、`task-history-noresults` 已关闭申请 · 筛选无结果，保留已填条件并可清除。`task-empty`、`task-history-empty` 不显示筛选条。

## 打开

- 完整原型：[index.html](../../index.html)。运营进入“发行审核”，机构进入“机构待办”。
- 当前源页：[发行审核.html](发行审核.html)，初始入口 `o-list-unassigned`；“画面目录 · 演示数据”可到达全部画面及下一屏。
- 运营主流程：`o-list-unassigned → o-wait-reg → assign-empty → assign-ready → assign-ready-confirm → o-wait-ops → o-pass → o-pass-ready → o-pass-confirm → o-pass-submitting → o-mint-signing → o-mint-waiting → o-mint-success`。
- 机构主流程：`task-list → task-application → material-upload-application → material-upload-application-ready → task-application-uploaded`；历史：`task-history → task-token`。

## 画面目录（140 屏）

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
| 机构待办与材料 | `task-list` 待办列表；`task-history` 已关闭申请；`task-empty` 暂无待办；`task-history-empty` 暂无历史申请；`task-list-noresults` 待办 · 筛选无结果；`task-history-noresults` 已关闭申请 · 筛选无结果；`task-error` 待办读取失败；`task-denied` 不在名单内 · 无权查看 |
| 机构待办 · 申请详情 | `task-application` 待首次上传；`task-application-shared` 其他机构已上传；`task-application-uploaded` 首次材料已完成；`task-failed` 铸造失败 · 可继续追加；`task-token` 铸造成功 · 只读；`task-rejected` 运营驳回 · 只读；`task-disabled` 停用机构 · 继续办理；`task-material-error` 材料读取失败 |
| 机构材料上传与预览 | `material-upload-application*` 7 屏；`material-preview`；`material-file-error`；`ops-material-file-*` / `reg-material-file-*` 各 5 屏 |

## 待确认

- 债务人英文名称“有值”的情况：演示申请 IA-DEMO-0031 对应的 RA-DEMO-0131 在 M2 中没有英文名称，故只画“未提供”；有值时按 M2 原值展示（如 Demo Buyer B Limited Liability Company），本模块无该资产的申请详情画面。
- 已关闭申请历史的“读取失败”画面未单独绘制，表现同 `task-error`。

## 实际核验

- Chromium（Playwright，file://，1280 px）：140 屏 × 中文 / English 逐屏 `TP.show`，无脚本错误，无整页横向溢出；全部 `data-go` / `data-next` / `data-base` 指向现有画面；English 下新增文案均有译文（演示名称、意见原文按约定不翻译）。
- 截图自查：`task-list`、`task-history`、`task-error`、两个筛选无结果画面、`o-wait-ops` / `task-token` 关联资产、`o-success`、`o-pass-confirm`、`o-retry`。
- 未验证：1440 px 以上与 Safari / Firefox、仓库联看跨模块跳转、真实权限、存储与链上服务。
