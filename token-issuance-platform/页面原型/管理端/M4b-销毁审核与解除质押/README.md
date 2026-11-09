# M4b · 销毁记录、解除资产托管与代币台账

2026-11-09 · existing-system adaptation / console · 中文与 English。业务依据 M4b PRD `68c2e54`，列表分页、空状态与读取失败按 M2 §5.8 业务列表通用规则；展示结构对齐 M3b 发行审核（顶部紧凑进度、底部操作进度、分步弹窗）和 M4a 我的代币（页头、台账列、代币详情分区）。**规则、校验与异常分支以 PRD 为准**。企业、机构、地址、编号、金额、文件和时间均为演示数据。

## 对齐 M3b 优化（2026-11-09）

- 操作进度与 M3b 呈现一致：每条记录的“角色与账号”在左、带时区的时间在右侧单独一列；失败说明、解除说明改为左侧轻竖线承接，不再用浅底块。共享样式由 `.review-screen` 扩展到 `.operation-history`，只影响 M3b 与 M4b。
- “债务人”统一为“债务人名称”，与 M3b、M2 一致，并标记为上游原值（41 处：运营与机构的发行关联业务、机构申请信息）。M4a / M4b PRD 只列债务人名称，因此未增加“债务人英文名称”。
- 核验：源码与离线附件各 82 屏 × 中文 / English × 1280 / 1440 / 1920 px，无脚本错误、失效画面或整页溢出；M3b 140 屏双语 1440 px 回归通过。

## PRD d75ac45 · 截断展示与确认中调价（2026-11-09）

- 修改：超过两位小数的金额、代币数量与资产估值（DEMO-TOKEN-028 / BA-DEMO-0040 的 12,345.675 COU、12,345.675 USD 估值等）主显示截断到两位，旁边以 `.value-pop` 图标浮层查看完整值；去掉“已截断 · 完整值”文字，页头数量同样处理。`l-028`、`rl-028` 名称改为“数量截断展示”。
- 确认中代币（`l-021-lock`）保留可用的“调整单位价值”，与 PRD 一致。
- 核验见文末。

## 本轮同步（PRD a957f38 → 68c2e54）

- **确认中**：两个代币台账的“销毁进度”及其筛选新增“确认中”（代币有提交锁、尚未形成申请），该行只有“查看”。新增 `l-list-lock`（全平台台账按“确认中”筛选，DEMO-TOKEN-021）与 `l-021-lock`（同一代币的确认中详情）：页头下方提示提交已超过 10 分钟、请联系平台开发；销毁记录只列已形成的 BA-DEMO-0024，不出现提交锁记录；无超时处理或解除提交锁入口。代币编号与 M4a `t-lock` 一致。
- **单位价值调整超时（NT-A09）**：`l-001-updating` 改为“调价处理中 · 超过 10 分钟”，提示仍无明确结果、当前值不变、结果确认前不能再次提交、请联系平台开发；无处理按钮。
- **单位价值完整值**：初始、当前单位价值及调价确认、调价记录中的新旧值按填写值展示（如 1 COU = 1 USD、1 COU = 0.95 USD），不补零；估值仍两位小数截断。
- **持有信息表**：修正非质押代币行多出的“质押地址”空列与重复持有数量（运营 9 屏、机构 5 屏），列与表头一致。
- 调价等待超时已由 PRD 裁定，移除对应待确认项。

## 打开与导出

- 完整原型：双击 [index.html](../../index.html)，选择运营或机构。本模块源页为 [销毁审核与解除质押.html](销毁审核与解除质押.html)，文件名沿用不变。侧栏底部（窄屏为右下角）的“画面目录 · 演示数据”默认关闭。
- 离线附件：在 `页面原型/` 执行 `python3 _shared/export.py --source 管理端/M4b-销毁审核与解除质押/销毁审核与解除质押.html --output <仓库外路径>.html`。

## 主流程

- 运营：`b-list → b-pending`（销毁中）→ `b-release`（销毁成功 · 托管中）；失败看 `b-failed`、`b-prior-failed`（已有新申请），超过 10 分钟看 `b-pending-2`，非平台入口与风险项看 `b-external`。
- 解除资产托管（资产托管机构 示例机构 C）：`r-list → r-detail → r-edit → r-ready → r-confirm → r-submitting → r-result`。必填、文件上传中或失败、提交失败、结果未确认，以及停用机构、依据缺失、非平台入口风险提示（`r-external`）见画面目录。
- 调整单位价值（DEMO-TOKEN-001）：`l-001 → v-edit → v-ready → v-confirm → v-pending → v-success → l-001-updated`；失败为 `v-failed`。超过 10 分钟仍无结果为 `l-001-updating`（NT-A09 落地）。`l-021`（销毁中）的调整按钮不可用，已销毁代币不显示调整入口；`l-022`（质押中）可调整。
- 机构查看销毁申请：资产托管机构 `rl-021 → rl-b-0024`（销毁失败）；审计机构（示例机构 D，只读）`r-list-audit`（无解除事项）→ `rld-list` → `rld-025 → rld-b-0018`。

## 画面清单

| 分组 | 画面 |
| --- | --- |
| 运营 · 销毁记录列表（4） | `b-list` 默认 · `b-list-empty` 尚无记录 · `b-list-error` 读取失败 · `b-list-nomatch` 筛选无匹配 |
| 运营 · 销毁记录详情（10） | `b-pending` 销毁中 · `b-pending-2` 超过 10 分钟；`b-failed` · `b-prior-failed` 销毁失败；`b-release` · `b-release-2` 销毁成功 · 托管中；`b-released` 已解除托管；`b-external` 非平台入口 · 有风险项；`b-detail-error` · `b-notfound` |
| 机构 · 解除托管列表（5） | `r-list` 默认 · `r-nomatch` 筛选无匹配 · `r-empty` · `r-error` · `r-list-audit` 审计机构 |
| 机构 · 解除托管详情（7） | `r-detail` · `r-0031` 托管中；`r-external` 非平台入口 · 有风险项；`r-released` 已解除；`r-disabled` 停用机构；`r-blocked` 依据缺失；`r-denied` 无权 |
| 机构 · 解除资产托管办理（11） | `r-edit` · `r-required` · `r-uploading` · `r-upload-fail` · `r-ready-one` · `r-ready` · `r-confirm` · `r-submitting` · `r-submit-fail` · `r-unconfirmed` · `r-result` |
| 运营 · 代币台账（5） | `l-list` · `l-empty` · `l-error` · `l-nomatch` · `l-list-lock` 筛选确认中 |
| 机构 · 代币台账（5） | `rl-list` 资产托管机构 · `rl-empty` · `rl-error` · `rl-nomatch` · `rld-list` 审计机构 |
| 运营 · 代币详情（13） | `l-001` · `l-027` · `l-031` · `l-021` · `l-021-lock` 确认中（NT-A08 提交锁超时落地） · `l-022` · `l-023` · `l-024` · `l-025` · `l-026` · `l-028` · `l-holding-fail` · `l-detail-error` |
| 机构 · 代币详情（11） | `rl-001` · `rl-027` · `rl-021` … `rl-026` · `rl-028` · `rld-025` · `rl-denied` |
| 机构 · 销毁申请查看（2） | `rl-b-0024` 资产托管机构 · 销毁失败 · `rld-b-0018` 审计机构 · 已解除托管 |
| 运营 · 调整单位价值（9） | `v-edit` · `v-invalid` · `v-ready` · `v-confirm` · `v-pending` · `v-failed` · `v-success` · `l-001-updating` 超过 10 分钟 · `l-001-updated` |

已删除：`r-history`（已解除切换页，由筛选取代）。新增画面编号 76–82，`r-nomatch` 沿用原 15 号。

仓库联看路由（`route.js`）保留 M7 消息与 M3b 使用的全部 key：`burnApplication0018/0019/0021/0024/0030/0031/0040`、`reviewToken`、`ledgerToken001`、菜单 key `release`；本轮新增 `ledgerTokenLocked`（运营 → `l-021-lock`，NT-A08 提交锁超时）与 `ledgerTokenAdjusting`（运营 → `l-001-updating`，NT-A09）。

本期不做：
- 运营审核、驳回、重试或代发销毁；销毁、提交锁与调价超时的线上处理入口。
- 违约或质押代币的强制销毁与改地址。
- 法律服务、审计机构办理解除；资产托管机构变更；平台对长期未解除事项催办。
- 销毁交易哈希展示。

## 待确认 / 待共享层处理

1. **确认中能否调价**：PRD A-TOKEN-02 前提只排除销毁中申请与处理中调整，未排除提交锁，`l-021-lock` 按现文提供“调整单位价值”；如需禁止，请 PRD 补规则。
2. **消息（共享 `_shared/inbox.js`）**：需总控补 NT-A08 提交锁超时（DEMO-TOKEN-021 → `ledgerTokenLocked`）与 NT-A09（DEMO-TOKEN-001 → `ledgerTokenAdjusting`）；原 NT-A08 销毁中超时仍前往 `burnApplication0030` → `b-pending-2`。
3. **组件规范 §10** 仍写解除托管 `.seg` 切换、PRD `eba411d`，未提提交锁 / 调价超时提示，需同步本轮口径。
4. 非平台入口三项都满足（无风险）的画面未单独出屏。

## 核验（2026-11-09，本轮）

- Chromium 打开源文件，82 屏逐屏 `TP.show`，中文与 English 各一遍，1280 px：无脚本错误、无整页横向溢出、无失效 `data-go`；新画面可从画面目录到达，`l-list-lock` 行可进入 `l-021-lock`。英文界面仅演示主体名称与原文为中文。
- 截图自查：`l-list-lock`、`l-021-lock`（中英）、`l-001-updating`、`l-list`、`rl-list`、`v-confirm`、`l-001`。
- 未验证 Safari / Firefox、离线附件导出、跨模块入口与消息跳转回归、真实权限、上传、链上与消息联调；原型不证明这些能力已实现。
