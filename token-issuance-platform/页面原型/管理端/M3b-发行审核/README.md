# M3b · 发行审核与机构材料 · 终版核验

2026-11-10 · PRD 基线 `9aed0f2` · existing-system adaptation / console · 中文与 English。企业、机构、账号、文件、时间及数值为演示数据。

## UI 更新（2026-11-10）

承接 `8b2e546`，保留 PRD `9aed0f2` 的业务口径，沿用现有配色、字体、组件与尺寸 token。

- 发起铸造的三个第 2 步画面：先以双列呈现代币数量、初始代币单位价值、资产价值和交易所用合约，数值采用现有 16 px 字号、币种保持辅助字号；“复核申请”的五项参考信息随后，细线分区。单位价值“铸造时写入所选合约”、原始完整值、地址与签名复制、确认后果及错误说明均保留。弹窗仍为 600 × 700 px，正文滚动、底栏固定。
- 五张申请列表：企业名称复用共享首尾保留的省略组件，24ch 阅读上限，悬停及键盘激活可看全名；资产编号保持单行，时间字段保留阅读下限，窄桌面继续只在表内横滚，右侧操作固定。未增加筛选或分页。
- 47 个材料批次：展开控制统一共享 `chev` SVG 与开合方向，“查看文件 / 收起文件”保留双语可访问名称；仍由原生 summary 响应键盘，预览及返回不改变展开状态。
- 保留 124 屏、原业务文案、字段、演示数值、精度、输入及按钮属性、可见范围、状态与路由；仅增加共用名称呈现调用。

本轮实际核验：源码与离线附件各 124 屏 × 中文 / English × 1280 / 1440 / 1920 px，共 1488 组，无脚本错误、整页或弹窗横向溢出、空白业务时间；列表允许在表内横滚。1280 × 800 下三个第 2 步画面的关键数值与合约首屏完整可见，参考信息、完整签名复制入口、后果提示和错误说明可滚动核对，底栏可达。长英文名称保留首尾并可通过 title / 无障碍名称 / Enter 查看全文；材料 Enter / Space 展开、预览与 Esc 返回、0.80009 精度与 65,927.416 完整值浮层、C+G 分配及结果回填通过。业务文本、关键属性与业务脚本和 `8b2e546` 对照一致。组件规范同步 v1.96。Safari / Firefox、1280 px 以下宽度与真实业务服务未验证。

## PRD 9aed0f2 同步：上链范围（2026-11-10）

- PRD 删除“上链字段”六项清单，只规定初始代币单位价值随铸造写入所选合约，其他上链字段由研发定义。
- 发起铸造第 2 步（`o-pass-confirm`、`o-pass-unavailable`、`o-pass-save-error`）：“写入链上的内容”改为“复核申请”，保留资产编号、原始资产价值、到期日、接收地址、企业业务签名值；初始代币单位价值移入“铸造数量与价值”，提示“铸造时写入所选合约”；资产价值去掉“不上链”。
- 第 1 步（`o-pass`、`o-pass-ready`、`o-pass-truncated`）资产价值说明去掉“不上链”。重试弹窗原本未列上链字段，无需改动；`o-mint-sign-failed`“交易未上链，没有铸造交易哈希”描述交易状态，保留。
- 核验：Chromium 逐屏打开源码与单文件附件全部 124 屏 × 中文 / English × 1280 / 1440 / 1920 px，无脚本错误、整页或弹窗横向溢出、空白时间。

## 上一轮交付（PRD 3841bd6）

在 `cly-v6.0.0` 的 `6c3d69b` 上应用 Hallmark 设计师交付的 `M3b-原型-PRD3841bd6.patch`（补丁原基线 `fd5e2ed`），无冲突。本轮业务改动仅为 `material-upload-application*` 7 个弹窗的中英文说明：铸造成功后发行企业可查看、下载本批材料，不再写“看不到上传账号”。

视觉优化仅增强分组候选的本次选择态：已选机构行用现有主色浅底，名称字重 600，与原生单选圆点同时表达；“暂不分配”、已保存的分配以及确认结果不使用该选择底色。其余既有风格、信息布局、固定尺寸弹窗和文件批次组件保留，无新 token。

组件规范同步至 v1.88，并修正其中机构材料组件仍写“不展示完整分配名单”的过时说明，按当前 PRD 写明机构可见名单、不可见企业业务签名/内部失败说明/同资产其他申请。

应用补丁后，HTML 源码与上游交付逐字节比对一致；本轮视觉修订只改共享 CSS 的 M3b 显式选择态，不改字段、演示值、计算、业务脚本、禁用条件或路由。124 屏 ID 及内部跳转目标保持。

## 实际核验

- Chromium：源码与本次导出件各 124 屏 × 中文 / English × 1280 / 1440 / 1920 px，共 1488 组布局；无脚本错误、整页或弹窗横向溢出、空白业务时间，底部操作可达。
- 分配：未选时下一步禁用；首次选 C+G、确认后进入对应名单详情；已有 C+D 新增 G、确认后进入 C+D+G；既有类型不能替换；选择态与实际单选一致。
- 数值与确认：0.80009 单位价值完整保留，资产价值展示 65,927.41 USD，浮层可核对完整值 65,927.416 USD；发起铸造复核信息仍可达，Tab 焦点约束与 Esc 返回正常。
- 可见范围与历史：机构详情未出现企业业务签名或同资产其他申请；成功申请本页无上传操作；0207 / 0208 两笔历史分别列出；重新申请与原驳回记录可互跳，500 字意见全文保留。
- 追加材料入口：完整原型中由 `task-token` 进入 M4b `rl-027`，本模块不复制追加动作或消息。
- 800 px 短屏：中英文的分配、铸造确认、材料上传弹窗底栏可达。
- 本地受限 `srcdoc` 嵌入：操作进度时间、分组确认、Esc 返回、表内键盘横向滚动正常。这是本地模拟，未核验平台实际嵌入容器。

未验证 Safari / Firefox、1280 px 以下宽度及真实后端权限、文件服务、钱包、精度校验和链上最终性。本次为原型呈现与定向交互核验，不替代 PRD 的全部业务验收或 Eval 执行；合约无损承载及单位价值精度仍由研发、测试验证。

机构类型名称沿用项目 v1.80 约定，在 English 界面保持中文原名；企业/机构名称及驳回意见原文也不翻译，未擅自改变此约定。

## 打开与运行

- 完整原型：[index.html](../../index.html)，运营进入发行审核，机构进入机构待办。
- 当前源页：[发行审核.html](发行审核.html)，初始入口 `o-list-unassigned`。画面目录保留全部 124 屏。
- 本轮离线原型：`WS514-M3b-UI更新-20261110.html`，可直接双击，无需服务或网络；跨模块完整页面仅在仓库联看中提供。
- 从源生成：在 `页面原型/` 执行 `python3 _shared/export.py --source 管理端/M3b-发行审核/发行审核.html --output <仓库外路径>.html`。
- 运营主流程：`o-list-unassigned → o-wait-reg → assign-empty → assign-ready-confirm → o-assigned-* → o-pass → o-pass-ready → o-pass-confirm → o-pass-submitting → o-mint-signing / o-mint-waiting / o-mint-success`。分配步骤按原生单选回填本次机构；铸造及文件操作仍为预设画面，不执行真实业务。
- 机构主流程：`task-list → task-application → material-upload-application → material-upload-application-ready → task-application-uploaded`；历史从 `task-history` 进入，成功后经“前往追加材料”进入 M4b。

## 画面目录（124 屏）

| 分组 | 画面 |
| --- | --- |
| 运营 · 申请列表 | `o-list` 申请列表；`o-list-empty` 暂无申请；`o-list-noresults` 筛选无结果；`o-list-error` 列表读取失败；`o-list-mint` 铸造失败申请列表；`o-list-unassigned` 待分配机构 · 申请列表 |
| 运营 · 申请详情 | `o-wait-reg` 待分配机构；`o-wait-ops` 运营处理中；`o-ops-rejected` 运营驳回；`o-minting` 铸造中；`o-failed` 铸造失败；`o-success` 铸造成功；`o-detail-error` 读取失败；`o-detail-denied` 无权查看或申请不存在；`o-cache` 资产信息暂时无法获取；`o-minting-disabled` 铸造中 · 原合约平台停用；`o-minting-timeout` 铸造中 · 已超时；`o-sign-error` 业务签名读取失败；`o-assigned-one` / `o-with-material` / `o-material-error`；`o-assigned-D` / `-E` / `-CE` / `-DE` / `-CDE` 不同名单；`o-assigned-G`、`o-assigned-CG`、`o-assigned-DG`、`o-assigned-CDG` 含法律服务机构 G 的名单；`o-reapplied` 重新申请 · 待分配机构（IA-DEMO-0048）；`o-reapplied-original` 运营驳回 · 同一资产已重新申请（IA-DEMO-0012） |
| 机构材料 · 查看与下载 | `o-file-view`；`o-file`；`o-file-download` |
| 运营 · 驳回 | `o-reject`；`o-reject-ready`；`o-reject-error`；`o-reject-save-error`；`o-reject-confirm`；`o-reject-submitting` |
| 运营 · 通过并铸造 | `o-pass` 未选合约；`o-pass-ready` 已选合约；`o-pass-truncated` 资产价值超过两位小数；`o-pass-none`；`o-pass-load-error`；`o-pass-unavailable`；`o-pass-save-error`；`o-pass-confirm` |
| 运营 · 铸造进度 | `o-pass-submitting`；`o-mint-signing`；`o-mint-waiting`；`o-mint-timeout`；`o-mint-success`；`o-mint-failed`；`o-mint-sign-failed` |
| 运营 · 铸造重试 | `o-retry`；`o-retry-platform-disabled` 原合约平台停用 · 仍可重试；`o-retry-failed` 重试未能发起；`o-retry-submitting` |
| 操作反馈 | `o-changed` 申请状态已变化 |
| 机构分配 | 首次分配：`assign-empty` 未选择；`assign-ready` 已选 C + D；`assign-ready-confirm` 确认；`assign-saving` 提交中；`assign-fail` 保存失败；`assign-none` 无启用机构；`assign-error` 读取失败。新增机构：`assign-add-{已有}` 与 `assign-add-{已有}-confirm`，已有名单覆盖 C、D、E、G、CD、CE、DE、CG、DG；`assign-add-CD-E-conflict` 类型已被占用。共 26 屏 |
| 机构待办与材料 | `task-list` 待办列表；`task-history` 已关闭申请；`task-empty` 暂无待办；`task-history-empty` 暂无历史申请；`task-list-noresults` 待办 · 筛选无结果；`task-history-noresults` 已关闭申请 · 筛选无结果；`task-error` 待办读取失败；`task-denied` 不在名单内 · 无权查看 |
| 机构待办 · 申请详情 | `task-application` 待首次上传；`task-application-shared` 其他机构已上传；`task-application-uploaded` 首次材料已完成；`task-failed` 铸造失败 · 可继续追加；`task-token` 铸造成功 · 只读；`task-rejected` 运营驳回 · 只读；`task-disabled` 停用机构 · 继续办理；`task-material-error` 材料读取失败 |
| 机构材料上传与预览 | `material-upload-application*` 7 屏；`material-preview`；`material-file-error`；`ops-material-file-*` / `reg-material-file-*` 各 6 屏（含铸造后追加 `*-post`） |

## 未单独绘制的画面

已关闭申请历史的读取失败未单独出屏，继续沿用上游注明的 `task-error` 表现；本轮未增加画面或业务分支。
