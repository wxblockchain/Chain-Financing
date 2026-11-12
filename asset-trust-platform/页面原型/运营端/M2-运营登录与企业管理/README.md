# M2 · 运营登录、企业邀请与企业管理（运营端）

2026-11-12 · console / greenfield（本平台首个运营端原型，视觉沿用代币发行平台组件规范）· 简体中文与 English。

## 基线

- PRD：WS-602 附件《运营登录与企业管理》四册 2026-11-12 需求评审稿（Q-M2-01～06 裁定后版本），以 01 功能与业务规则、02 流程图与状态机出屏；PRD 尚未入库。
- 视觉与组件：代币发行平台《组件规范》v1.96（`token-issuance-platform/页面原型/_shared/`，cly-v6.0.0 @ e2f8eb3），即本平台自持的 [`../../_shared/`](../../_shared/design-system/组件规范.md)（与企业端 M1 共用；本模块新增组件 A7–A11、`menu.ops.js` 与账号入口文字配置已登记在该规范）；列表、详情、金额与时间等按《资产可信平台列表与详情展示参考规范 v1.0》。
- 入驻资料字段取自 M1《企业登录与首次入驻》PRD 的个人信息、企业补充信息与钱包信息。

**规则、校验与异常分支以 PRD 为准。** 原型只画规则生效后的画面，不实现校验、计时、发码、锁定计数、查重或状态机。企业、邮箱、编号、钱包地址、联系人与时间均为演示数据。

## 打开与主流程

双击 [运营登录与企业管理.html](运营登录与企业管理.html) 打开（需同步 `../../_shared/`；模块英文文案在 `m2-copy.js`）；侧栏底部「画面目录 · 演示数据」默认关闭，展开后按“分组 → 画面”到达全部画面，并提供“主流程下一屏”。

- 登录：`login → ent-list`（默认页为企业管理）
- 邀请：`ent-list → invite-ready → invite-same-name → invite-sent → d-initial → resend-confirm → d-initial-resent`
- 维护：`d-active → edit-ready → edit-changed → d-active-saved → role-confirm → d-role-added`；`d-active → reset-confirm → d-active-reset`
- 解锁：`d-locked → unlock-confirm → d-unlocked`
- 首次登录：`login-initial → first-empty → first-ready → login-changed`
- 找回密码：`recover-filled → recover-captcha → recover-code → recover-password → recover-ready → login-recovered`
- 本人改密：`settings → password-verify → password-new → login-changed`

生成离线单文件（在 `asset-trust-platform/页面原型/` 下执行）：

```bash
python3 _shared/export.py --source 运营端/M2-运营登录与企业管理/运营登录与企业管理.html --output <仓库外路径>.html
```

## 页面与呈现要点

- 菜单按 PRD F-OP-11 分为 企业 / 资产数据 / 风控 / 审核与出库 / 消息 五组（`_shared/menu.ops.js`）；本模块只落地“企业管理”和账号入口，其他菜单点击显示“该入口尚未纳入原型”。无首页、无工作台。
- 企业列表：十二列按 PRD 字段；编号进入详情；四个筛选（业务角色、企业账号状态、入驻进度、认证状态）+ 编号 / 名称 / 登记号码 / 登录邮箱查找；尚无企业时不显示筛选条。表格最小 1280 px，较窄时表内滚动、操作列固定在右。
- 邀请企业：企业身份、联系人、业务角色与登录账号三张卡；不出现初始密码输入或展示；同名提醒为确认弹窗，重复企业身份在表单内指向已有企业。
- 账号入口与菜单：顶栏为界面语言与账号入口（姓名、登录邮箱、运营管理员，账户设置 / 退出登录）；首次登录改密只显示登录邮箱与退出；本期无消息铃铛，消息中心为菜单项。
- 企业详情：入驻与认证（入驻节点 + 认证状态、入驻进度、业务角色）→ 企业用户与钱包（账号操作按 PRD 组合表出现在卡头）→ 企业档案（运营维护）→ 入驻资料（企业端维护、只读，与联系人分开）→ 操作记录。页头为“编辑资料”与（仅单一角色时）“增加业务角色”。
- 已入驻企业编辑时，注册国家／地区与企业登记号码只读；入驻前可更正（`edit-pre`）。
- 主流程示例企业外的同类操作按钮可用，点击提示演示范围，不另画重复确认画面。

## 画面清单

共 87 屏。默认、空、代表性异常、业务阶段与流程步骤按下表；未出屏的状态以 PRD 为准。

| 分组 | 画面 ID 与名称 |
| --- | --- |
| 登录与会话（13） | `login` 运营端登录；`login-empty` 登录 · 空表单；`login-error` 登录 · 邮箱或密码错误；`login-attempts` 登录 · 剩余机会；`login-locked` 登录 · 账号临时锁定；`login-service` 登录 · 服务异常；`login-busy` 登录 · 提交中；`login-target` 登录 · 返回原页面；`login-changed` 登录 · 密码已修改；`login-recovered` 登录 · 密码已重置；`login-expired` 登录 · 登录已到期；`login-idle` 登录 · 长时间无操作；`login-out` 登录 · 已退出 |
| 首次登录改密（5） | `login-initial` 登录 · 使用初始密码；`first-empty` 首次登录 · 设置新密码；`first-ready` 首次登录 · 已填写；`first-error` 首次登录 · 两次输入不一致；`first-fail` 首次登录 · 与初始密码相同 |
| 找回密码（16） | `recover-email` 找回 · 输入邮箱；`recover-filled` 找回 · 已填写邮箱；`recover-send-fail` 找回 · 验证码发送失败；`recover-limit` 找回 · 发送次数已达上限；`recover-captcha` 找回 · 安全验证；`recover-captcha-fail` 找回 · 安全验证未通过；`recover-captcha-retry` 找回 · 连续 3 次未通过；`recover-captcha-cooldown` 找回 · 安全验证冷却中；`recover-captcha-load-fail` 找回 · 题目加载失败；`recover-code` 找回 · 输入验证码；`recover-code-invalid` 找回 · 验证码无效；`recover-locked` 找回 · 验证后账号锁定；`recover-password` 找回 · 设置新密码；`recover-ready` 找回 · 新密码已填写；`recover-password-error` 找回 · 与当前密码相同；`recover-stale` 找回 · 验证已失效 |
| 企业列表（5） | `ent-list` 企业列表；`ent-list-added` 企业列表 · 新邀请已加入；`ent-empty` 企业列表 · 尚无企业；`ent-no-results` 企业列表 · 筛选无结果；`ent-list-fail` 企业列表 · 读取失败 |
| 邀请企业（10） | `invite-empty` 邀请 · 空表单；`invite-ready` 邀请 · 资料已填写；`invite-error` 邀请 · 字段错误；`invite-no-role` 邀请 · 未选业务角色；`invite-duplicate` 邀请 · 企业已被邀请；`invite-email-unavailable` 邀请 · 登录邮箱不可用；`invite-busy` 邀请 · 发送中；`invite-same-name` 邀请 · 同名提醒；`invite-sent` 邀请 · 已发出；`invite-mail-fail` 邀请 · 已建立但邮件未发出 |
| 企业详情（18） | `d-initial` 详情 · 待首次改密（新邀请）；`d-wallet` 详情 · 待绑定钱包；`d-profile` 详情 · 待提交资料；`d-active` 详情 · 已入驻（单一角色）；`d-both` 详情 · 已入驻（两个角色）；`d-locked` 详情 · 账号锁定；`d-locked-initial` 详情 · 锁定且待首次改密；`d-reset` 详情 · 已入驻、重置后待改密；`d-part-fail` 详情 · 入驻资料读取失败；`d-active-saved` 详情 · 资料已保存；`d-role-added` 详情 · 业务角色已增加；`d-active-reset` 详情 · 密码已重置；`d-reset-mail-fail` 详情 · 重置后邮件未发出；`d-initial-resent` 详情 · 已重发邀请；`d-initial-mail-fail` 详情 · 邀请邮件未发出；`d-unlocked` 详情 · 已解除锁定；`d-not-found` 详情 · 内容不存在或无权查看；`d-fail` 详情 · 读取失败 |
| 账号操作（4） | `resend-confirm` 重发邀请 · 确认；`reset-confirm` 重置密码 · 确认；`unlock-confirm` 解除锁定 · 确认；`unlock-stale` 解除锁定 · 已不是锁定 |
| 增加业务角色（2） | `role-confirm` 增加业务角色 · 确认；`role-exists` 增加业务角色 · 角色已存在 |
| 编辑企业资料（6） | `edit-ready` 编辑 · 已入驻（企业身份只读）；`edit-changed` 编辑 · 已修改待保存；`edit-pre` 编辑 · 入驻前（企业身份可更正）；`edit-error` 编辑 · 字段错误；`edit-fail` 编辑 · 保存失败；`edit-conflict` 编辑 · 资料已被他人修改 |
| 账户设置（4） | `settings` 账户设置；`settings-fail` 账户设置 · 账号信息读取失败；`pref-fail` 账户设置 · 时区保存失败；`acct-menu` 账号入口 · 展开 |
| 修改密码（4） | `password-verify` 修改密码 · 验证当前密码；`password-wrong` 修改密码 · 当前密码错误；`password-new` 修改密码 · 设置新密码；`password-expired` 修改密码 · 验证已过期 |

## 本期不做（按 PRD 1.2，原型中不出现入口）

运营账号管理与停用 / 启用、企业账号停用 / 启用、取消业务角色、运营本人修改登录邮箱、验证码 / 钱包 / 第三方登录与“记住我”、动态口令、删除企业、运营修改企业登录邮箱或查看密码、解绑或更换钱包、代填入驻资料、站内消息、安全记录查询。

## 待相邻模块对齐（不影响本模块画面，未在原型中自定规则）

- 入驻进度名称：M2 为“待首次改密 / 待绑定钱包 / 待提交资料 / 已入驻”，M1 现稿写“待完善资料 / 已完成入驻”，按 M2 出屏，待 M1 对齐（PRD 依赖已列）。
- “企业英文名称”在 M2（运营维护的企业档案）与 M1（企业补充信息）各有一项，按 Q-M2-03“两个维度、不同步”分别展示于企业档案和入驻资料。
- 企业编号格式 PRD 未定义，原型用 `ENT-DEMO-001` 演示。
- M11 汇率管理已有运营端 PRD，但未登记在 M2 菜单表，本原型菜单未加入。

## 核验

Playwright Chromium：87 屏 × 中文 / English × 1280 / 1440 / 1920 px，无脚本错误、无整页横向溢出、无失效 data-go / 面包屑目标、按钮与操作列无右侧裁切；English 下除演示业务值（企业名称、联系人等原值）外无未翻译文案。离线单文件另遍历一次，无外部依赖。截图仅作内部核验。
