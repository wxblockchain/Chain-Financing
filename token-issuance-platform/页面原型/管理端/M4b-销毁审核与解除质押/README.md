# M4b · 销毁审核、解除监管与代币台账

2026-11-02｜existing-system adaptation / console｜10 项功能 · 66 个画面

按用户“开始输出本 issue 负责的页面原型”，沿用此前 M3b、M4a、M6 中“直接输出页面原型”的授权，合并后续阶段交付。业务基线为 `cly-v6.0.0` 上的 M4b PRD 四册（`3d581de`，含合约停用后既有业务继续办理的裁定）。视觉沿用组件规范 v1.15 及管理端壳层，本轮在规范中登记 v1.16 的四状态摘要。**规则、校验与异常分支以 PRD 为准。**

## 打开与维护

- 完整同步 `页面原型/` 后双击 [销毁审核与解除质押.html](销毁审核与解除质押.html)，默认进入运营「销毁审核」列表。监管机构画面在右下角默认关闭的「画面目录 · 演示数据」中切换，也可从其他管理端模块的监管菜单进入。
- 运营菜单：销毁审核、代币台账；监管菜单：解除监管、代币台账。其他菜单通过共享导航进入已交付的 M2、M3b、M5、M6，保留身份、语言与时区。
- 已连接的跨模块入口：申请或代币中的企业名称 → M2 企业详情；合约名称 → M6 合约管理；M2 资产 `RA-DEMO-0102` 的“查看代币台账” ↔ 本模块 `DEMO-TOKEN-001`。其他没有对应画面的资产和发行申请显示范围提示。
- 源文件只引用 `_shared/` 的 token、组件、图标、展示、壳层和导航，不包含模块 CSS 或第二套运行时。导出离线单文件附件（生成件不入库）：

  ```sh
  python3 _shared/export.py --source 管理端/M4b-销毁审核与解除质押/销毁审核与解除质押.html --output <仓库外路径>.html
  ```

## 主流程

- 通过并销毁：`b-list` → `b-pending`（BA-DEMO-0031）→ `b-approve` → `b-approve-submitting` → `b-burning` → `b-release`（销毁成功，待解除监管）。
- 解除监管：`r-list` → `r-detail` → `r-form` →（选择凭证）`r-form-file` → `r-submitting` → `r-done`（已解除，记录留存）。
- 驳回：`b-unknown`（BA-DEMO-0024 结清无法确认，通过不可用）→ `b-reject` → `b-reject-error`（必填提示）→ `b-reject-ready` → `b-reject-submitting` → `b-rejected`。
- 失败重试：`b-failed`（BA-DEMO-0021）→ `b-retry` → `b-retry-submitting` → `b-retry-burning`。
- 台账：`l-list` / `rl-list` → 代币详情 → 销毁申请记录 → 对应申请或解除事项；监管的 `rl-024` 可直接前往该代币的待解除事项。

提交中和销毁中画面不会自动推进，用画面目录的「主流程下一屏」查看结果。其他同类申请上的通过、驳回和解除按钮保持可用表现，提示演示只展开主流程示例。

## 画面清单

`covered` 表示已出屏并纳入本轮浏览器检查，不代表生产业务已实现。

| 功能 | 画面 | 状态 |
| --- | --- | --- |
| A-BURN-01 销毁审核列表 | `b-list` 默认（6 笔各阶段）、`b-list-empty`、`b-list-error` | covered |
| A-BURN-02 销毁详情与条件核对 | `b-pending` 条件满足、`b-pending-2` 其他申请、`b-contract-off` 原合约平台停用仍可通过、`b-unknown` 结清无法确认、`b-burning`、`b-failed`、`b-release`、`b-release-2`、`b-released`、`b-rejected`、`b-detail-error`、`b-notfound` | covered |
| A-BURN-03 通过并执行销毁 | `b-approve` 确认与后果、`b-approve-submitting`、`b-approve-blocked` 提交时融资结果不一致、`b-changed` 已被其他运营处理 | covered |
| A-BURN-04 驳回 | `b-reject`、`b-reject-error`、`b-reject-ready`、`b-reject-submitting` | covered |
| A-BURN-05 失败手动重试 | `b-retry`、`b-retry-blocked` 当前条件无法确认、`b-retry-submitting`、`b-retry-burning` | covered |
| R-RELEASE-01 解除监管列表 | `r-list` 待解除、`r-list-done` 已解除、`r-list-empty`、`r-list-error` | covered |
| R-RELEASE-02 解除监管详情 | `r-detail`、`r-detail-2`、`r-detail-off` 机构已停用仍可解除、`r-detail-missing` 销毁结果暂时无法取得、`r-detail-done`、`r-detail-denied` | covered |
| R-RELEASE-03 解除并留记录 | `r-form`、`r-form-file`、`r-form-file-error`、`r-submitting`、`r-done` | covered |
| A-TOKEN-01 全平台代币台账 | `l-list`（8 个代币，含其他监管机构）、`l-empty`、`l-error`；详情 `l-021`…`l-031`、`l-partial` 融资无法确认、`l-detail-error` | covered |
| R-TOKEN-01 本机构代币台账 | `rl-list`（7 个代币）、`rl-empty`、`rl-error`；详情 `rl-021`…`rl-001`、`rl-denied` | covered |
| 共享壳层、账户设置、消息入口、语言与时区 | 沿用现有共享层与 M5 | preserved from existing |
| 企业端提交与结果展示 | M4a 承载 | out of scope |

身份差异：运营可见运营审核人、失败说明、重试记录、账户备注名，并可前往 M2 企业详情与 M6 合约；监管机构只看本机构代币与解除事项，不显示运营账号、失败说明或账户备注名，仅在待解除时提供解除操作。解除备注与凭证仅运营、原监管机构可见。

本期不做（out of scope）：运营代企业申请、监管代运营审核、运营代监管解除；部分或任意数量销毁、批量处理、撤销或修改申请；自动重试、企业重试、失败后另建申请；平台内融资或解除融资质押、更换合约 / 地址 / 监管机构；台账编辑、转账、导出与统计；真实接口、链上执行、文件服务、消息发送与权限判断。

## 待确认与说明

- Q-M4B-02 未定：驳回意见、解除备注没有设长度上限或计数；解除凭证未写格式、份数和大小，只表现“选填、可不上传、上传失败须重试或移除”。确认后需补充提示与超限画面。
- 监管菜单名称由「解除质押」统一为「解除监管」，与 M4b 正文及“解除监管不替代解除融资质押”的区分一致；同步修改了 M2、M3b、M5、M6 的菜单文案（M5 PRD 约定菜单名称由设计确定）。如需保留原名称，只需改回各模块菜单配置。
- 演示数据与 M4a 对齐申请编号、代币、数量与时间（BA-DEMO-0031 / 0030 / 0024 / 0021 / 0019 / 0018）。监管机构名称按管理端 M5 口径写作“示例监管机构 C”，M4a 同一机构写作 “Demo Supervision C”，属于演示数据差异，不代表两个机构。
- 所有企业、机构、地址、编号、意见、备注和文件均为演示数据；画面为独立静态快照，不模拟条件计算、执行结果、并发或上传。

## 实际核验

- Chromium headless：源文件 66 屏 × 中文 / English × 1280 / 1440 / 1920 px，共 396 次检查；离线附件同样 396 次。未发现脚本错误、整页横向溢出、控件或操作列越出视口、英文界面残留未翻译文案（业务原文除外）；附件无外部请求或其他模块文件请求。
- 实测主流程点击、弹窗焦点落在主按钮、Esc 返回、通过不可用状态、空意见进入必填提示、凭证选择与提交；M3b ↔ 本模块菜单双向跳转（含 Enter 键与浏览器返回）、监管 / 停用机构身份保持、M2 ↔ `DEMO-TOKEN-001`、企业 → M2、合约 → M6。
- 共享层变更后回归：M2 管理端、M3b、M6 全部画面三档宽度双语检查无溢出或脚本错误；M5 抽检画面无溢出，监管菜单可进入本模块。
- 内部目视查看列表、详情、通过确认、解除弹窗、台账与四状态摘要。未做真实后端 / 链上 / 权限联调，未测 Safari / Firefox，未覆盖 1280 px 以下。
