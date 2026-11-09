# M5 · 管理端登录与权限、机构管理

2026-11-06 · 已确认范围修订 / Stage 4 · existing-system adaptation / console · 简体中文与 English。

## 基线与范围

依据本 issue 2026-11-06 08:25 的机构管理四册、08:28 收口后的管理端登录与权限功能/验收册及同日流程/通知册；安全记录按用户 08:26 确认，仅由平台内部留存 180 天，产品内无查询或导出入口。对应仓库 PRD 基线为 `f20b8d2`，见[机构管理功能册](../../../PRD/管理端/M5-机构管理/01-机构管理-PRD.md)与[管理端登录与权限功能册](../../../PRD/管理端/M5-管理端登录与权限/01-管理端登录与权限-PRD.md)。

- 本轮更新：机构编号的列表、查找、详情与编辑只读展示；固定三类机构；联系人姓名 2–50 字、联系电话、注册地址和机构级基础资质说明/附件；找回成功即完成首次密码设置；2 小时无操作后下一次操作转至重新登录且该次操作未执行；历史登录邮箱不可转分配；停用提示只说明机构状态和新业务选择范围。
- 继承：未受上述变化影响的登录、首次改密、验证码、人机校验、本人改密/改邮箱、语言/时区、临时锁定与邮件失败画面。只展示规则结果和预设画面，不实现校验、计时、发码或账号状态机。
- 归属调整：原有 32 屏机构待办/材料画面原样移至 [M3b](../M3b-发行审核/README.md)，相应路由随迁；M5 不再承载具体申请、材料、铸造或代币权限规则。迁移是保留既有画面和联看能力，不代表重新验收 M3b 业务规则。

机构、邮箱、编号、地址、联系人、文件与时间均为演示数据。机构编号示例固定为 C → ORG-DEMO-003，D/E/F/G → 004/005/006/007。

## 打开与主流程

完整联看：双击 [index.html](../../index.html)，选择管理端运营或机构，通过真实侧栏与账户菜单往返。当前[源页](管理端账号与监管机构管理.html)保留原文件名以兼容既有入口。侧栏底部（窄屏为右下角）的「画面目录 · 演示数据」默认关闭，展开可到达下表全部画面。

- 添加：`rg-list → invite-ready → invite-sent → rg-initial`（空表单 `invite-empty` 由目录进入）。
- 编辑：`rg-detail → edit-ready`；目录进入已修改示例 `edit-changed → edit-saved`。编号与登录邮箱只读，账号状态没有人工修改入口。
- 启停：`rg-detail → disable-confirm → rg-off → enable-confirm → rg-detail`。
- 待首登账号找回：目录进入 `recover-initial-ready → login-recovered-initial → r-settings`；完整联看重新登录进入 M3b 机构待办，不经过首次强制改密。
- 会话：目录进入 `login-idle` 查看下一次操作被拦截后的重新登录结果；无提前提醒、无演示计时器。4 小时绝对有效期画面继承。

生成离线单文件（在 `页面原型/` 下执行）：

```bash
python3 _shared/export.py --source 管理端/M5-管理端登录与权限/管理端账号与监管机构管理.html --output <仓库外路径>.html
```

源文件共享，交付时内联。共享入口为 `_shared/tokens.css`、`components.css`、`frame.js`、`menu.admin.js` 与 `display.js`。沿用主色 `--accent #1D4ED8`、背景 `--bg #F7F8FB`、44 px 控件、238 px 侧栏、68 px 顶栏、24 px 卡片内边距及系统字体；组件基线见[组件规范](../../_shared/design-system/组件规范.md)。未另建视觉系统。

## UI 深化（2026-11-06）

本轮为 existing-system adaptation / console，承接 `bb93b00` 原型，不新增画面、业务字段或业务流程。保留本模块全部 150 屏，机构待办与材料继续由 M3b 承载。

| 页面 / 组件 | 实际修改与覆盖 |
| --- | --- |
| 机构列表 | 保留九列与全部筛选；表格设 1120 px 阅读下限，较窄时独立横向滚动并固定操作列，滚动区支持键盘；正常与新添加列表共 2 屏，空态与异常沿用 |
| 添加 / 编辑 | 16 屏表单变体统一 1120 px 阅读宽度，联系方式成组，编号与登录邮箱只读上下文更紧凑；原取消与提交区吸底，未完成和提交中的禁用状态保留 |
| 机构详情 | 11 屏详情变体按档案、基础资质、账号与维护信息阅读；邮件发送结果归入账号区，保留全部元信息；标题持续显示编号，“编辑”为主操作，启停仍经过原确认 |
| 账户设置 | 11 屏身份 / 状态变体将真实账号状态放在标题旁，资料按身份、机构归属、时间排列；原修改密码 / 邮箱、语言和时区入口保留 |
| 启停确认 | 7 屏沿用原弹窗与结果，短字段成对排列，取消、关闭与确认跳转不变 |
| 登录、找回、首登改密、本人修改密码 / 邮箱等 | 继承未改视觉结构；连同上述页面一起回归 |

修改前后静态核对全部 150 屏：业务字段及值、296 个输入 / 选择控件的原属性、原有按钮跳转与禁用状态完全一致；仅调整展示 DOM、信息顺序和样式层级。标题重复显示机构编号只用于滚动中辨认对象，不产生新字段。

实际核验：Chromium 全部 150 屏 × 中文 / English × 1280 / 1440 / 1920 px，共 900 个画面组合，无脚本错误、整页横向溢出或页头 / 吸底按钮横向裁切。实测表格键盘滚动与右侧操作、长表单最后输入的聚焦避让、详情标题吸附、编辑 / 添加 / 找回主路径、启停弹窗 Tab / Escape / 返回焦点，以及机构待办—关联资产—账户设置的跨模块往返。长英文机构名只在浏览器内作布局核验，未写入演示数据。

组件规范同步至 v1.49。系统字体、主色、150 屏目录、路由与业务规则不变。截图仅供内部核验；对外提供由源文件生成的离线 HTML。

## 画面清单

共 150 屏，含继承画面；每屏均登记于默认关闭的目录。默认、空、代表性异常、角色和流程步骤按下表保留，不穷举所有组合。

| 分组 | 画面 ID 与名称 |
| --- | --- |
| 登录与首次改密 | `login-ops` 邮箱密码登录；`login-reg` 机构账号登录示例；`login-empty` 登录 · 空表单；`login-error` 登录 · 凭据错误；`login-attempts` 登录 · 剩余机会；`login-locked` 登录 · 账号锁定；`login-service` 登录 · 服务异常；`login-busy` 登录 · 提交中；`login-initial` 初始账号登录示例；`login-target-ops` 登录 · 返回原机构详情；`login-target-reg` 登录 · 原目标无权访问；`login-changed` 密码已修改；`login-recovered` 密码已重置；`login-expired` 登录已到期；`login-idle` 因长时间无操作；`login-out` 已退出登录；`first-empty` 首次登录 · 设置密码；`first-ready` 首次登录 · 设置新密码；`first-error` 首次登录 · 输入有误；`first-busy` 首次登录 · 保存中；`first-fail` 首次登录 · 保存失败；`login-recovered-ops` 运营示例 · 密码已重置；`login-recovered-initial` 找回成功 · 已完成首次密码设置 |
| 找回密码 | `recover-email` 找回密码；`recover-filled` 找回 · 已填写邮箱；`recover-captcha` 找回 · 人机校验；`recover-captcha-fail` 找回 · 人机校验未通过；`recover-captcha-refresh` 找回 · 连续 3 次未通过；`recover-captcha-cooldown` 找回 · 人机校验冷却中；`recover-captcha-load-fail` 找回 · 题目加载失败；`recover-send-fail` 找回 · 发送失败；`recover-limit-email` 找回 · 邮箱发送已达上限；`recover-limit-ip` 找回 · 请求过于频繁；`recover-code` 找回 · 验证邮箱；`recover-code-invalid` 找回 · 验证码无效；`recover-code-expired` 找回 · 验证码已失效；`recover-locked` 找回 · 验证后账号锁定；`recover-stale` 找回 · 验证资格已失效；`recover-password` 找回 · 设置新密码；`recover-ready` 找回 · 密码已填写；`recover-password-error` 找回 · 密码输入有误；`recover-busy` 找回 · 提交中；`recover-fail` 找回 · 保存失败；`recover-ops-email` 运营示例 · 找回密码；`recover-ops-filled` 运营示例 · 找回 · 已填写邮箱；`recover-ops-captcha` 运营示例 · 找回 · 人机校验；`recover-ops-send-fail` 运营示例 · 找回 · 发送失败；`recover-ops-code` 运营示例 · 找回 · 验证邮箱；`recover-ops-code-invalid` 运营示例 · 找回 · 验证码无效；`recover-ops-locked` 运营示例 · 找回 · 验证后账号锁定；`recover-ops-stale` 运营示例 · 找回 · 验证资格已失效；`recover-ops-password` 运营示例 · 找回 · 设置新密码；`recover-ops-ready` 运营示例 · 找回 · 密码已填写；`recover-ops-password-error` 运营示例 · 找回 · 密码输入有误；`recover-ops-busy` 运营示例 · 找回 · 提交中；`recover-ops-fail` 运营示例 · 找回 · 保存失败；`recover-initial-ready` 待首登账号 · 找回设密 |
| 账户设置与身份 | `o-settings` 运营账户设置；`r-settings` 机构账户设置；`r-off` 停用机构账户设置；`settings-missing` 账号信息 · 缺少可选值；`settings-fail` 账号信息 · 读取失败；`pref-busy` 偏好 · 保存中；`pref-fail` 偏好 · 保存失败；`o-menu` 运营账号入口；`r-menu` 机构账号入口；`off-menu` 停用机构账号入口；`r-settings-new` 机构账户 · 邮箱修改后；`o-settings-new` 运营账户 · 邮箱修改后 |
| 本人修改密码 | `password-ops` 运营修改密码 · 验证当前密码；`password-reg` 机构修改密码 · 验证当前密码；`password-ready` 修改密码 · 设置新密码；`password-reg-ready` 机构修改密码 · 设置新密码；`password-error` 修改密码 · 当前密码有误；`password-busy` 修改密码 · 提交中；`password-fail` 修改密码 · 保存失败；`password-reauth-expired` 修改密码 · 当前密码验证已过期 |
| 本人修改登录邮箱 | `self-email` 修改邮箱 · 验证当前密码；`self-email-filled` 修改邮箱 · 填写新邮箱；`self-email-captcha` 修改邮箱 · 人机校验；`self-email-captcha-fail` 修改邮箱 · 人机校验未通过；`self-email-captcha-cooldown` 修改邮箱 · 人机校验冷却中；`self-email-code` 修改邮箱 · 新邮箱收码；`self-email-occupied` 修改邮箱 · 邮箱不可用；`self-email-code-error` 修改邮箱 · 验证码无效；`self-email-send-fail` 修改邮箱 · 发送失败；`self-email-limit` 修改邮箱 · 发送已达上限；`self-email-reauth-expired` 修改邮箱 · 当前密码验证已过期；`self-email-stale` 修改邮箱 · 信息已变更；`self-email-save-fail` 修改邮箱 · 保存失败；`self-email-confirm` 修改邮箱 · 确认；`self-email-busy` 修改邮箱 · 提交中；`self-email-ops` 运营示例 · 修改邮箱 · 验证当前密码；`self-email-ops-filled` 运营示例 · 修改邮箱 · 填写新邮箱；`self-email-ops-captcha` 运营示例 · 修改邮箱 · 人机校验；`self-email-ops-code` 运营示例 · 修改邮箱 · 新邮箱收码；`self-email-ops-occupied` 运营示例 · 修改邮箱 · 邮箱不可用；`self-email-ops-code-error` 运营示例 · 修改邮箱 · 验证码无效；`self-email-ops-send-fail` 运营示例 · 修改邮箱 · 发送失败；`self-email-ops-stale` 运营示例 · 修改邮箱 · 信息已变更；`self-email-ops-save-fail` 运营示例 · 修改邮箱 · 保存失败；`self-email-ops-confirm` 运营示例 · 修改邮箱 · 确认；`self-email-ops-busy` 运营示例 · 修改邮箱 · 提交中 |
| 会话与访问反馈 | `access-menu` 无权访问菜单；`access-data` 无权查看或内容不存在；`access-action` 无权操作 |
| 机构列表 | `rg-list` 机构列表；`rg-empty` 机构 · 尚未添加；`rg-no-results` 机构 · 筛选无结果；`rg-list-fail` 机构 · 读取失败；`rg-added` 机构列表 · 新邀请已添加 |
| 添加机构 | `invite-empty` 添加 · 空表单；`invite-ready` 添加 · 资料已填写；`invite-error` 添加 · 名称重复；`invite-uploading` 添加 · 附件上传中；`invite-busy` 添加 · 提交中；`invite-fail` 添加 · 保存失败；`invite-sent` 添加 · 已建立并发出邮件；`invite-mail-fail` 添加 · 已建立但邮件失败；`invite-email-unavailable` 添加 · 登录邮箱不可用 |
| 机构详情 | `rg-detail` 机构详情 · 启用正常；`rg-off` 机构详情 · 停用；`rg-initial` 机构详情 · 待首登改密；`rg-missing` 机构详情 · 资料未补齐；`rg-mail-fail` 机构详情 · 邮件发送失败；`rg-initial-fail` 新机构 · 邀请邮件失败；`rg-list-initial` 机构详情 · 机构 D 待首登改密；`rg-list-locked` 机构详情 · 账号锁定；`rg-list-off` 机构详情 · 机构 F 已停用；`rg-self-email` 机构详情 · 机构本人改邮箱后；`rg-not-found` 无权查看或机构不存在；`rg-detail-fail` 机构详情读取失败 |
| 编辑机构资料与附件 | `edit-ready` 编辑 · 资料已反显；`edit-changed` 编辑 · 已修改待保存；`edit-missing` 编辑 · 核心资料待补齐；`edit-error` 编辑 · 字段错误；`edit-busy` 编辑 · 保存中；`edit-fail` 编辑 · 保存失败；`files-uploading` 附件 · 上传中；`files-failed` 附件 · 上传失败；`files-removed` 附件 · 移除待保存；`edit-saved` 编辑 · 已保存；`files-read-fail` 资质附件 · 读取失败 |
| 停用与启用 | `disable-confirm` 停用机构 · 确认；`disable-busy` 停用机构 · 提交中；`disable-fail` 停用机构 · 失败；`enable-confirm` 启用机构 · 确认；`enable-busy` 启用机构 · 提交中；`enable-fail` 启用机构 · 失败；`status-stale` 机构状态已变化 |

## 本期不做与依赖

不提供机构自助注册、删除机构、多个机构账号、其他/自定义类型或类型配置、账号启停或人工冻结、运营代改登录邮箱/重置密码、开通邮件重发、安全记录查询或导出。机构级基础资质不关联具体申请或代币。M2/M3b/M4b/M7 的业务规则由各自模块维护。

最新 PRD 将资质附件格式、大小、份数留给通用文件能力由研发验证；原型不沿用旧的 PDF/10 MB/10 份限制。演示中的 PDF 文件只是样例。此为技术依赖，当前没有新增产品待确认项。

规则、校验与异常分支以 PRD 为准；原型能切换画面不代表真实账号、邮件、权限或后端能力已实现。

## 上游核验记录（bb93b00）

Chromium 实测：150 屏均可从目录逐屏到达；中英文 × 1280/1440/1920 px 共 900 个画面/宽度组合无整体横向溢出或机构列表操作列裁切，无脚本错误。新增/修订核心画面另作视觉检查。迁入 M3b 的 32 屏及两个原有页面同样完成六档布局检查。

已点击核验添加机构、待首登账号找回后直接进入正常账号、机构登录 → M3b 待办 → M5 设置往返、停用/改邮箱身份变体、材料弹窗及 Esc 返回；离线附件 150 屏与主流程可用，无外部资源或网络请求，无控制台警告。未验证 Safari/Firefox、1280 px 以下宽度或真实服务。
