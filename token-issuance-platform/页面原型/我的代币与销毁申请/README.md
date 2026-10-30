# 我的代币与销毁申请 · 面客端原型

2026-10-30｜existing-system adaptation / console｜7 项功能 · 59 个画面

依据 M4a 四册 PRD 的 `103c02a` 修订及 M4b 唯一衔接字段清单，沿用组件规范 v1.13 的视觉口径，合入并保留 M3b 的 v1.14 组件；本轮公共组件增量登记为 v1.15。用户本轮要求“直接输出页面原型”，合并后续阶段完成，不再增加阶段确认。目标分支为 `cly-v6.0.0`。

## 打开与维护

完整同步仓库后双击 [我的代币与销毁申请.html](我的代币与销毁申请.html)，默认进入我的代币列表。真实侧栏的“我的代币”“销毁申请”进入模块两类列表；可前往已交付的 M1、M2。M2 的 `RA-DEMO-0102` 与本模块 `DEMO-TOKEN-001` 保持数量 36,000.00 USD、到期时点和原发行申请 `IA-DEMO-0019` 一致，点击关联入口能双向查看；其他没有匹配画面的资产、发行申请、消息入口提示范围。

源码按 issue 指定位置维护，引用 `../_shared/tokens.css`、`components.css`、`asset-icons.js`、`display.js`、`frame.js`、`navigation.js`。不建立第二份 token、CSS 或业务运行时。公共样式取值来源为 `_shared/tokens.css`，主色 #1D4ED8、背景 #F7F8FB、侧栏 238 px、顶栏 68 px、控件 44/36 px、内容边距 24 px。

在 `页面原型/` 目录导出单文件附件：

```sh
python3 _shared/export.py --source 我的代币与销毁申请/我的代币与销毁申请.html --output <仓库外路径>.html
```

生成件仅作为离线附件，不入库；不包含 `navigation.js`、其他模块画面或远程资源。附件双击打开，各关联模块入口显示范围提示。仓库模式传递既有身份、语言与时区展示上下文，不把展示参数当作生产权限依据。

## 主流程与画面到达

- 选择代币：`t-list` → `t-ready` → `c-confirm` → `c-sending` → `c-success` → `a-pending`。确认区全部只读，取消返回代币；提交中没有重复提交按钮。异步等待不会自动完成，在独立画面目录中查看下一屏。
- 申请进度：目录中的 `a-pending`、`a-burning`、`a-failed`、`a-success`、`a-release`、`a-done` 呈现不同业务时点，主流程的申请编号保持 `BA-DEMO-0031`。失败示例另用 `BA-DEMO-0021`；企业没有审核、执行或重试入口。
- 再次发起：`a-rejected`（`BA-DEMO-0024`）→ `r-confirm` → `r-success` → `r-existing`（`BA-DEMO-0032`）。旧记录保留，当前限制、已有新申请、已销毁分别另有画面。
- 列表历史使用各自记录：`a-active-record`（0030）、`a-release-record`（0019）、`a-completed-record`（0018）。详情返回代币会到对应的只读阶段画面，保持代币编号、数量和申请关系。
- 右下角“画面目录 · 演示数据”默认关闭，按页面/流程分组列出全部画面；所有清单 ID 均可从目录到达。它是评审工具，不冒充业务菜单。

所有企业、地址、数量、意见与编号为演示数据。画面是独立静态快照；目录切换不修改数据，不模拟时间、上游事件、规则运算或真实申请流转。业务意见、机构名称与账户备注名保留原文；界面标签支持中英文，时间按有效 IANA 展示时区换算。

## 业务不变量与本期不做

融资、结清、监管与销毁分开表达；冲突或未知不能提交。监管中与原合约平台停用不额外阻断符合原条件的销毁。完整数量为两位小数 USD，确认前披露运营审核后销毁、随后原机构解除监管。已销毁后保留历史，解除未完成时不显示全流程完成。

企业只看到审核方、结果、审核时间及原文驳回意见；失败不展示时间、内部说明与重试记录。解除结果仅展示结果、原机构当前名称与完成时间，不展示操作人、备注、凭证或下载入口。

本期不做：融资/解押办理、代币转移、更换所在地址、企业审核/执行/重试销毁或解除监管、修改/撤回/批量/部分销毁申请、企业自填数量/原因/备注/凭证、修改上游业务字段、把销毁失败归并成发行处理中、管理端/消息中心整模块、真实钱包与接口/权限/业务持久化、移动端适配。规则、校验与异常分支以 PRD 为准。

## 画面清单

以下为本轮新增，状态 `covered` 表示静态画面已实现且浏览器检查通过，不代表生产业务已实现。M1/M2 与共享层既有功能为 `preserved from existing`；以上本期不做项为 `out of scope`。没有在范围内静默留空的画面。

| ID | 页面/流程 | 主状态 | 身份 |
| --- | --- | --- | --- |
| `t-list` | 我的代币列表 | 默认 | certified |
| `t-empty` | 我的代币列表 | 暂无代币 | certified |
| `t-loading` | 我的代币列表 | 读取中 | certified |
| `t-error` | 我的代币列表 | 读取失败 | certified |
| `t-ready` | 代币详情 | 可申请 · 默认 | certified |
| `t-restricted` | 代币详情 | 多项条件不满足 | certified |
| `t-conflict` | 代币详情 | 融资结果不一致 | certified |
| `t-unknown` | 代币详情 | 融资依据无法确认 | certified |
| `t-active` | 代币详情 | 已有处理中申请 | certified |
| `t-burned` | 代币详情 | 已销毁 · 待解除监管 | certified |
| `t-released` | 代币详情 | 已解除监管 | certified |
| `t-contract-off` | 代币详情 | 原合约平台停用 · 可申请 | certified |
| `t-account-changed` | 代币详情 | 原登录地址顺延普通账户 | certified |
| `t-denied` | 代币详情 | 无权或不存在 | certified |
| `t-detail-error` | 代币详情 | 详情读取失败 | certified |
| `t-partial` | 代币详情 | 结清信息暂不可用 | certified |
| `t-future` | 代币详情 | 未到期 · 关联资产入口 | certified |
| `t-financed` | 代币详情 | 仍有融资质押 | certified |
| `c-confirm` | 提交销毁申请 | 只读确认 | certified |
| `c-sending` | 提交销毁申请 | 提交中 | certified |
| `c-success` | 提交销毁申请 | 提交成功 | certified |
| `c-changed` | 提交销毁申请 | 提交前条件改变 | certified |
| `c-failed` | 提交销毁申请 | 明确提交失败 | certified |
| `c-unknown` | 提交销毁申请 | 提交结果未确认 | certified |
| `c-existing` | 提交销毁申请 | 已有处理中申请 | certified |
| `b-list` | 销毁申请列表 | 默认 · 历次申请 | certified |
| `b-empty` | 销毁申请列表 | 暂无申请 | certified |
| `b-loading` | 销毁申请列表 | 读取中 | certified |
| `b-error` | 销毁申请列表 | 读取失败 | certified |
| `a-pending` | 申请详情 | 待运营审核 | certified |
| `a-rejected` | 申请详情 | 驳回 | certified |
| `a-burning` | 申请详情 | 销毁中 | certified |
| `a-failed` | 申请详情 | 销毁失败 | certified |
| `a-success` | 申请详情 | 销毁成功 | certified |
| `a-release` | 申请详情 | 待解除监管 | certified |
| `a-done` | 申请详情 | 已解除监管 | certified |
| `a-denied` | 申请详情 | 无权或不存在 | certified |
| `a-error` | 申请详情 | 详情读取失败 | certified |
| `a-partial` | 申请详情 | 结果部分无法取得 | certified |
| `a-message` | 申请详情 | 旧消息 · 已完成 | certified |
| `a-old-active` | 申请详情 | 旧驳回 · 已有新申请 | certified |
| `r-confirm` | 再次发起 | 再次核对确认 | certified |
| `r-success` | 再次发起 | 新申请提交成功 | certified |
| `r-blocked` | 再次发起 | 当前不满足条件 | certified |
| `r-existing` | 再次发起 | 新申请 · 待运营审核 | certified |
| `r-burned` | 再次发起 | 代币已销毁 | certified |
| `gate-tokens` | 身份与访问 | 未认证 · 我的代币 | uncertified |
| `gate-burn` | 身份与访问 | 未认证 · 销毁申请 | uncertified |
| `guest` | 身份与访问 | 游客 · 不展示业务数据 | guest |
| `signin` | 身份与访问 | 未登录 · 返回原目标 | none |
| `a-active-record` | 申请详情 | 待运营审核 | certified |
| `a-release-record` | 申请详情 | 待解除监管 | certified |
| `a-completed-record` | 申请详情 | 已解除监管 | certified |
| `t-main-pending` | 代币详情 | 原申请待审核 · 返回代币 | certified |
| `t-main-burning` | 代币详情 | 原申请销毁中 · 返回代币 | certified |
| `t-main-burned` | 代币详情 | 原申请销毁成功 · 返回代币 | certified |
| `t-main-done` | 代币详情 | 原申请解除完成 · 返回代币 | certified |
| `t-main-new` | 代币详情 | 新申请待审核 · 返回代币 | certified |
| `t-main-failed` | 代币详情 | 原申请销毁失败 · 返回代币 | certified |

## 实际验证与限制

Chromium headless：全部 59 屏 × 中文/英文 × 1280/1440/1920 px，共 354 次源码画面检查；离线附件在 1280 px 下双语遍历全部 59 屏，共 118 次画面检查。未发现脚本错误、整页横向溢出或出界业务按钮。内部人工查看列表、代币详情、确认、驳回、待解除等代表画面；截图仅供内部核验。

已实测主流程点击、独立等待画面、驳回后新编号与旧记录保留、失败无企业重试、企业结果字段隔离、目录默认关闭及全部可达、M2 精确对象双向跳转、刷新、语言/时区保持、键盘焦点及语言菜单 Esc 返回焦点。离线附件仅产生自身文件请求，跨模块入口只提示，无外部依赖。

另核验 M1 菜单 Enter 进入与返回、浏览器前进后退、受限菜单标题、未登录/游客仅能进入其既有 M1 入口，以及申请返回代币后不能重复提交。M1、M2 两端、M5、M6 各抽检一个既有 app 画面，共享层未发现脚本或整页溢出回归；未遍历这些模块的全部业务画面。

实际 UTF-8 体积：本模块源码 191,230 B、合入共享层最新改动后的单文件附件 292,242 B；本模块共享导航增加 575 B、公共样式增加 2,122 B，M2 精确代币入口增加 62 B。附件不含仓库导航及其他模块画面。合并后重新完成上述全部 472 次画面检查，并抽检 M3b 运营审核列表，无脚本错误或整页溢出。

未进行真实登录/权限/接口/链上或通知端到端联调，未测试 Safari/Firefox，未覆盖 1280 px 以下。原 PRD 32 条验收中的真实业务校验、幂等、通知时效和服务端资料隔离仍由研发与测试按 PRD 验证，原型不能证明这些能力已实现。
