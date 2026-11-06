# M5 · 管理端登录与权限、机构管理与机构待办

2026-11-06 · existing-system adaptation / console · 中文与 English。画面中的机构、企业、邮箱、编号、文件和时间均为演示数据。

## 本轮范围

本轮依据 2026-11-06 用户裁定及本 issue 最新两套 PRD 附件更新；仓库 PRD 仍是此前版本，业务差异以本说明和最新附件为准。机构资质 PDF 限制只适用于机构档案，不套用到机构材料。

- 本轮修改：机构名称、类型、列表筛选与八列布局、添加和编辑的必选类型、资质附件称谓、账户设置与账号菜单的机构类型、停用提示。
- 本轮新增：机构待办与共享材料；首次上传、其他机构已上传、首次待办已处理、铸造先于首次上传、铸造后继续追加、驳回关闭、停用继续办理、移除或未分配无权访问、上传与文件读取异常画面。
- 继承未改：登录、密码、验证码、人机校验、会话和本人改邮箱的业务规则；机构管理中的账号状态、资质 PDF 限制和邮箱不可由运营修改的规则。

主流程：`rg-list → invite-empty → invite-ready → invite-sent`；`task-list → task-application → material-upload-application → material-upload-application-ready → task-application-uploaded`。铸造先于首次上传：`task-token → material-upload-token-ready → task-token-uploaded`。机构待办的查看操作没有铸造、驳回、审核结论或解除按钮。

机构页面只有上传说明和文件两个填写项；机构、类型、账号、时间和阶段只读。首次成功上传后待办已处理，后续追加不生成新强制待办；申请驳回后只读。素材均为预设演示值，切换画面不会持久保存文件或机构关系。

## 打开方式

- 完整联看：双击 [index.html](../../index.html)，选择运营或机构；面客端选择已认证企业。侧栏与原有分区导航可跨模块往返。
- 当前源页：[原型 HTML](管理端账号与监管机构管理.html)。技术文件名保持稳定，避免既有路由断开。
- 单文件附件：在 `页面原型/` 执行 `python3 _shared/export.py --source 管理端/M5-管理端登录与权限/管理端账号与监管机构管理.html --output <仓库外路径>.html`；生成件可双击离线打开。单文件不包含其他模块的画面，跨模块入口提示在完整原型中查看。
- 右下角“画面目录 · 演示数据”默认关闭，可以选择所有画面与主流程下一屏。只切换预设画面，不接真实接口、邮件、文件、权限或链上交易。

## 画面清单

共 182 屏。数量包含继承的画面，不等于本轮优化数量。

| 分组 | 画面 ID 与名称 |
| --- | --- |
| 登录与首次改密 | `login-ops` 邮箱密码登录；`login-reg` 机构账号登录示例；`login-empty` 登录 · 空表单；`login-error` 登录 · 凭据错误；`login-attempts` 登录 · 剩余机会；`login-locked` 登录 · 账号锁定；`login-service` 登录 · 服务异常；`login-busy` 登录 · 提交中；`login-initial` 初始账号登录示例；`login-target-ops` 登录 · 返回原机构详情；`login-target-reg` 登录 · 原目标无权访问；`login-changed` 密码已修改；`login-recovered` 密码已重置；`login-expired` 登录已到期；`login-idle` 因长时间无操作；`login-out` 已退出登录；`first-empty` 首次登录 · 设置密码；`first-ready` 首次登录 · 设置新密码；`first-error` 首次登录 · 输入有误；`first-busy` 首次登录 · 保存中；`first-fail` 首次登录 · 保存失败；`login-recovered-ops` 运营示例 · 密码已重置；`login-recovered-initial` 找回成功 · 尚未完成首登 |
| 找回密码 | `recover-email` 找回密码；`recover-filled` 找回 · 已填写邮箱；`recover-captcha` 找回 · 人机校验；`recover-captcha-fail` 找回 · 人机校验未通过；`recover-captcha-refresh` 找回 · 连续 3 次未通过；`recover-captcha-cooldown` 找回 · 人机校验冷却中；`recover-captcha-load-fail` 找回 · 题目加载失败；`recover-send-fail` 找回 · 发送失败；`recover-limit-email` 找回 · 邮箱发送已达上限；`recover-limit-ip` 找回 · 请求过于频繁；`recover-code` 找回 · 验证邮箱；`recover-code-invalid` 找回 · 验证码无效；`recover-code-expired` 找回 · 验证码已失效；`recover-locked` 找回 · 验证后账号锁定；`recover-stale` 找回 · 验证资格已失效；`recover-password` 找回 · 设置新密码；`recover-ready` 找回 · 密码已填写；`recover-password-error` 找回 · 密码输入有误；`recover-busy` 找回 · 提交中；`recover-fail` 找回 · 保存失败；`recover-ops-email` 运营示例 · 找回密码；`recover-ops-filled` 运营示例 · 找回 · 已填写邮箱；`recover-ops-captcha` 运营示例 · 找回 · 人机校验；`recover-ops-send-fail` 运营示例 · 找回 · 发送失败；`recover-ops-code` 运营示例 · 找回 · 验证邮箱；`recover-ops-code-invalid` 运营示例 · 找回 · 验证码无效；`recover-ops-locked` 运营示例 · 找回 · 验证后账号锁定；`recover-ops-stale` 运营示例 · 找回 · 验证资格已失效；`recover-ops-password` 运营示例 · 找回 · 设置新密码；`recover-ops-ready` 运营示例 · 找回 · 密码已填写；`recover-ops-password-error` 运营示例 · 找回 · 密码输入有误；`recover-ops-busy` 运营示例 · 找回 · 提交中；`recover-ops-fail` 运营示例 · 找回 · 保存失败 |
| 账户设置与身份 | `o-settings` 运营账户设置；`r-settings` 机构账户设置；`r-off` 停用机构账户设置；`settings-missing` 账号信息 · 缺少可选值；`settings-fail` 账号信息 · 读取失败；`pref-busy` 偏好 · 保存中；`pref-fail` 偏好 · 保存失败；`o-menu` 运营账号入口；`r-menu` 机构账号入口；`off-menu` 停用机构账号入口；`r-settings-new` 机构账户 · 邮箱修改后；`o-settings-new` 运营账户 · 邮箱修改后 |
| 本人修改密码 | `password-ops` 运营修改密码 · 验证当前密码；`password-reg` 机构修改密码 · 验证当前密码；`password-ready` 修改密码 · 设置新密码；`password-reg-ready` 机构修改密码 · 设置新密码；`password-error` 修改密码 · 当前密码有误；`password-busy` 修改密码 · 提交中；`password-fail` 修改密码 · 保存失败；`password-reauth-expired` 修改密码 · 当前密码验证已过期 |
| 本人修改登录邮箱 | `self-email` 修改邮箱 · 验证当前密码；`self-email-filled` 修改邮箱 · 填写新邮箱；`self-email-captcha` 修改邮箱 · 人机校验；`self-email-captcha-fail` 修改邮箱 · 人机校验未通过；`self-email-captcha-cooldown` 修改邮箱 · 人机校验冷却中；`self-email-code` 修改邮箱 · 新邮箱收码；`self-email-occupied` 修改邮箱 · 邮箱不可用；`self-email-code-error` 修改邮箱 · 验证码无效；`self-email-send-fail` 修改邮箱 · 发送失败；`self-email-limit` 修改邮箱 · 发送已达上限；`self-email-reauth-expired` 修改邮箱 · 当前密码验证已过期；`self-email-stale` 修改邮箱 · 信息已变更；`self-email-save-fail` 修改邮箱 · 保存失败；`self-email-confirm` 修改邮箱 · 确认；`self-email-busy` 修改邮箱 · 提交中；`self-email-ops` 运营示例 · 修改邮箱 · 验证当前密码；`self-email-ops-filled` 运营示例 · 修改邮箱 · 填写新邮箱；`self-email-ops-captcha` 运营示例 · 修改邮箱 · 人机校验；`self-email-ops-code` 运营示例 · 修改邮箱 · 新邮箱收码；`self-email-ops-occupied` 运营示例 · 修改邮箱 · 邮箱不可用；`self-email-ops-code-error` 运营示例 · 修改邮箱 · 验证码无效；`self-email-ops-send-fail` 运营示例 · 修改邮箱 · 发送失败；`self-email-ops-stale` 运营示例 · 修改邮箱 · 信息已变更；`self-email-ops-save-fail` 运营示例 · 修改邮箱 · 保存失败；`self-email-ops-confirm` 运营示例 · 修改邮箱 · 确认；`self-email-ops-busy` 运营示例 · 修改邮箱 · 提交中 |
| 会话与访问反馈 | `session-warning` 无操作提醒；`access-menu` 无权访问菜单；`access-data` 无权查看或内容不存在；`access-action` 无权操作 |
| 机构列表 | `rg-list` 机构列表；`rg-empty` 机构 · 尚未添加；`rg-no-results` 机构 · 筛选无结果；`rg-list-fail` 机构 · 读取失败；`rg-added` 机构列表 · 新邀请已添加 |
| 添加机构 | `invite-empty` 添加 · 空表单；`invite-ready` 添加 · 资料已填写；`invite-error` 添加 · 名称重复；`invite-uploading` 添加 · 附件上传中；`invite-busy` 添加 · 提交中；`invite-fail` 添加 · 保存失败；`invite-sent` 添加 · 已建立并发出邮件；`invite-mail-fail` 添加 · 已建立但邮件失败 |
| 机构详情 | `rg-detail` 机构详情 · 启用正常；`rg-off` 机构详情 · 停用；`rg-initial` 机构详情 · 待首登改密；`rg-missing` 机构详情 · 资料未补齐；`rg-mail-fail` 机构详情 · 邮件发送失败；`rg-initial-fail` 新机构 · 邀请邮件失败；`rg-list-initial` 机构详情 · 机构 D 待首登改密；`rg-list-locked` 机构详情 · 账号锁定；`rg-list-off` 机构详情 · 机构 F 已停用；`rg-self-email` 机构详情 · 机构本人改邮箱后；`rg-not-found` 机构不存在；`rg-detail-fail` 机构详情读取失败 |
| 编辑机构资料与附件 | `edit-ready` 编辑 · 资料已反显；`edit-changed` 编辑 · 已修改待保存；`edit-missing` 编辑 · 核心资料待补齐；`edit-error` 编辑 · 字段错误；`edit-busy` 编辑 · 保存中；`edit-fail` 编辑 · 保存失败；`files-uploading` 附件 · 上传中；`files-failed` 附件 · 上传失败；`files-limit` 附件 · 超出限制；`files-removed` 附件 · 移除待保存；`edit-saved` 编辑 · 已保存；`files-read-fail` 资质附件 · 读取失败 |
| 停用与启用 | `disable-confirm` 停用机构 · 确认；`disable-busy` 停用机构 · 提交中；`disable-fail` 停用机构 · 失败；`enable-confirm` 启用机构 · 确认；`enable-busy` 启用机构 · 提交中；`enable-fail` 启用机构 · 失败；`status-stale` 机构状态已变化 |
| 机构待办与材料 | `task-list` 机构待办 · 本机构；`task-list-ops` 机构待办 · 全平台；`task-list-handled` 机构待办 · 已处理；`task-list-closed` 机构待办 · 已关闭；`task-empty` 暂无机构待办；`task-error` 机构待办 · 读取失败；`task-application` 机构待办 · 首次上传；`task-application-shared` 机构待办 · 其他机构已上传；`task-application-uploaded` 机构待办 · 首次上传已处理；`task-token` 铸造成功 · 首次待办保留；`task-token-uploaded` 铸造成功 · 继续追加材料；`task-rejected` 申请驳回 · 历史材料；`task-disabled` 停用机构 · 继续上传；`task-ops-detail` 机构待办 · 运营查看；`task-denied` 机构范围外或已移除；`task-material-error` 机构材料 · 读取失败 |
| 机构材料上传 | `material-upload-application` 材料上传 · 尚未选择文件；`material-upload-application-ready` 材料上传 · 已选择文件；`material-upload-application-error` 材料上传 · 上传失败；`material-upload-application-saving` 材料上传 · 提交中；`material-upload-application-required` 材料上传 · 必填提示；`material-upload-application-save-error` 材料上传 · 保存失败；`material-upload-application-uploading` 材料上传 · 文件上传中；`material-upload-token` 材料上传 · 尚未选择文件；`material-upload-token-ready` 材料上传 · 已选择文件；`material-upload-token-error` 材料上传 · 上传失败；`material-upload-token-saving` 材料上传 · 提交中；`material-upload-token-required` 材料上传 · 必填提示；`material-upload-token-save-error` 材料上传 · 保存失败；`material-upload-token-uploading` 材料上传 · 文件上传中；`material-preview` 文件预览；`material-file-error` 机构材料 · 文件读取失败 |

## 核验与边界

Chromium 桌面核验覆盖中文 / English、1280 / 1440 / 1920 px，检查页面切换、脚本错误、整体横向溢出；新主流程、菜单权限呈现、弹窗键盘与关闭返回、离线附件另做定向核验。实际结果见本轮交付说明。

未验证 Safari / Firefox、1280 px 以下宽度和真实后端权限。未确认机构材料的格式、大小、份数，不沿用资质附件的 PDF 限制；不提供铸造成功后的机构名单变更；不向通用机构赋予未确认的解除职责。M7 旧业务通知内容本轮未重设计。
