# 金融服务平台 · 运营端 · 账户与登录原型

Stage 4/4 · 已批准原型入库 · `existing-system adaptation` · `console` · 2026-09-09

用户于 2026-09-09 明确“入库”，批准上一版 Stage 3 delta prototype。此次按项目原型架构入库，保持已批准的页面、交互与范围：总览按 PRD 仅提供壳子，消息模块仅提供接入边界，服务端能力为模拟。这是已批准原型的最终入库，不代表金融服务平台完整产品或生产登录实现。

## 1. 基线与范围

所属端：金融服务平台运营端 Web；唯一业务角色：运营管理员。

PRD 基线：许楚清 2026-09-09 07:24 UTC 发布的 v3 附件 `v1.0-账户与登录-PRD.md`（123,623 bytes，附件 ID `01a0850d-e377-7be3-95a0-e8335def1c53`）及 `01-国际化基线.md`（17,353 bytes，附件 ID `01a0850d-e379-7ebf-a402-eeb370ad3c66`）。包含字段总表、108 条 AC、规则与功能编号；本项目本次以主文档内表格追溯，不要求另外生成四份重复文档。

仓库基线：`wxblockchain/Chain-Financing`，`cly-V1.0.0` 的 `ec0bd45`（含同期入库的 WS-310 协议管理原型）。入库时已核对最新仓库 PRD v3；公共视觉文件相对上一轮 `8c8b222` 未变化。

功能点 16 个：F-O01～F-O16。页面 6 个：P-O01 登录、P-O02 首登重置、P-O03 忘记密码验证邮箱、P-O04 设置新密码、P-O05 账户设置、P-O06 总览壳子。

### Stage 1 coverage matrix

`covered` 表示界面或本地模拟已覆盖，**不等于对应服务端 AC 验收通过**。`out of scope` 表示 PRD 排除项或本附件不实现的外部模块。原型没有业务列表，所以“筛选无结果”不适用，不虚构筛选器。

| 端／角色 × 页面 | 默认 | 加载／等待 | 空 | 错误／校验 | 权限 | 1280／1440／1920 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 运营端未登录 × P-O01 | covered | covered | covered：空字段校验 | covered：凭据错、初始密码过期、超时 | covered：停用、锁定 | covered | covered |
| 运营管理员 pending_reset × P-O02 | covered | covered | covered：空字段校验 | covered：当前密码、复杂度、不一致、初始密码比对 | covered：首登路由拦截 | covered | covered |
| 运营端未登录 × P-O03 | covered | covered | covered：空字段校验 | covered：验证码、发码、滑块、限频、锁定 | covered：验证码通过后才提示锁定 | covered | covered |
| 运营端验证码已验证 × P-O04 | covered | covered | covered：空字段校验 | covered：票据过期、原／初始密码比对 | covered：无票据退回验证邮箱 | covered | covered |
| 运营管理员 active × P-O05 | covered | covered | covered：暂无账号资料 | covered：加载失败、再认证、保存失败、硬退信 | covered：只读字段、访问拒绝、会话失效 | covered | covered |
| 运营管理员 active × P-O06 | covered：总览壳子 | out of scope：业务内容 | covered：说明文字 | covered：全局会话失效 | covered：登录／首登守卫 | covered | covered：壳子 |
| 运营管理员 × P-O20／P-O21 | out of scope：WS-309 | out of scope | out of scope | out of scope | out of scope：消息归属校验 | out of scope | out of scope：仅入口与回跳边界 |
| 金融服务端用户 × 登录／钱包／注册／协议 | out of scope | out of scope | out of scope | out of scope | out of scope | out of scope | out of scope |
| 技术／运维 × 账号增删改、初始化页面 | out of scope：无此 UI | out of scope | out of scope | out of scope | out of scope | out of scope | out of scope |

### Stage 2 继承方案

端／角色：运营端／运营管理员 · 模块：账户与登录 · 功能点：16 · 页面：P-O01～P-O06 · 视觉口径：`asset-platform/prototypes/_shared/` 与资产账户原型 P-M01～P-M05。

| 页面 | 继承端别 | shell | 母版／archetype | 本页增量 |
| --- | --- | --- | --- | --- |
| P-O01～P-O04 | `admin` 控制台画布 | `focus` | 账户与登录原型 P-M01～P-M04，居中任务表单 | 运营端文案、路由、登录态、动态校验 |
| P-O05 | `admin` | `app` | P-M05，账户信息行＋偏好区＋原地弹窗 | 独立演示身份、单角色、运营端通知入口 |
| P-O06 | `admin` | `app` | 既有控制台壳层 | 总览与已入库协议管理菜单、PRD 要求的简短说明 |

保留公共 token、字号、字体、控件、两种壳层、Toast、语言下拉、账号菜单、弹层宿主及路由运行时。没有新建平行设计系统。页面状态入口收纳在当前页底部的折叠说明里，不添加页面选单或原型外层侧栏；正常业务导航仍按产品流程运行。

## 2. 打开与演示

**仓库版**：保留完整仓库目录，双击本目录 `v1.0-账户与登录-原型.html`，公共 CSS／JS 经相对路径加载，无需服务器或安装依赖。**附件版**：下载导出的单文件 `financial-service-ops-login-prototype.html`，可以独立双击打开。英文默认，右上角切换简体中文；建议桌面宽度至少 1280px。

**以下凭据仅为虚构演示数据，不是线上账户：**

| 用途 | 值 |
| --- | --- |
| 演示工作邮箱 | `ops@demo-finance.test` |
| 正常登录密码 | `Demo2026!` |
| 首登演示初始密码 | `Init2026!`（同一个账号，输入此密码进入首登重置） |
| 第一次发送的验证码 | `123456` |
| 同一页面再次发送的验证码 | 与 `654321` 交替；新码使旧码失效 |
| 可用的新密码示例 | `Review2026!` |

正常登录 → 总览 → 右上角账号下拉 → 账户设置 → 修改密码。修改密码先在弹窗验证当前密码，再填写新密码，成功后返回登录页，当前文档会记住新密码。

首登路径：输入初始密码登录 → 强制重置 → 返回登录 → 用刚设置的新密码登录。初始密码完成重置后不可继续登录。未完成重置时将 hash 改为 `#/ops/account`，仍会回到首登重置页。

找回路径：登录页“忘记密码”→ 输入工作邮箱 → 发送验证码 → 把蓝色拼块移动到虚线框（滑条约 72%，键盘可调整）→ 继续 → 输入验证码 → 设置新密码 → 返回登录。

模拟异常：展开当前页的“原型状态与评审说明”，选择状态。改密弹窗内另有提交响应选择器。等待态可以通过说明内“重试”恢复。为了让评审可重复，**状态选择器可以重置模拟状态，它不属于生产功能**。

账号锁定有 10 分钟、30 分钟及“5 秒后解锁”三个演示入口；最后一个入口用于直接观察归零后表单自动恢复。三种时长中只有前两项是业务参数。滑块失败 5 次进入 60 秒冷却，发码 60 秒冷却；验证码有效期 10 分钟。

刷新文件会清空本次演示登录态、密码改动、锁定、票据与事件记录，恢复演示凭据；浏览器本地语言和偏好保留。所有数据只用于本地模拟，不发送密码、邮件或网络请求。file:// 多标签存储通知是否共享由浏览器决定，不作为跨设备会话验收。

## 3. 状态与业务规则追溯

本 PRD 未提供独立 STATE／FIELD 编号；下表使用代码中的状态 key 与 PRD 字段名，不伪造产品编号。每页都有默认态；共 67 个页面状态选项，另含滑块与改密弹窗状态。

| PAGE／组件 | FUNC | STATE／交互 | FIELD | 规则与 AC | 覆盖说明 |
| --- | --- | --- | --- | --- | --- |
| P-O01 | F-O01 | default、incorrect、third、expired、disabled、loading、wait、submitting、failure、timeout | work_email、password | D-O07／D-O12；AC-O09～O17 | 唯一登录方式、统一错误、空值／邮箱长度与格式、密码眼睛、正常登录落总览 |
| P-O02 | F-O02 | default、currentBad、sameInitial、mismatch、请求状态 | current_password、password、password_confirm | D-O08／D-O11；AC-O18～O25 | 首登流程与前端守卫已演示；服务端双重拦截未实现 |
| P-O03／P-O04 | F-O03 | sent、codeBad、codeMany、resetTicket、same、sameInitial、mismatch | work_email、code、password、password_confirm | D-O12／D-O14；AC-O26～O40 | 中性发码提示、6 位数字粘贴清洗、有效期、单码 5 次错误、重置后退出 |
| P-O05 | F-O04 | default、loading、empty、loadFail、noPermission、bounce、再认证弹窗及提交失败 | work_email、name、status、current_password、password、password_confirm | D-O21；AC-O42～O50、O77 | 四项账户资料，邮箱与姓名只读；锚点滚动，修改密码原地完成；硬退信提示 |
| C-O11／C-O20 挂载位 | F-O05 | 账号菜单展开、消息中心入口、退出 | work_email、status | D-O20／D-O24；AC-O42、O106 | 消息中心在账户设置之上；铃铛在语言左侧；不编造未读数 |
| C-O05／P-O01／P-O05／P-O06 | F-O06 | renew、idle、session、poll401、changed、disabled | 登录态、role、时间戳 | D-O10／D-O11；AC-O51～O58、O104、O107～O108 | 2 小时／30 分钟计时、续期提示、统一退出、语言保留；401 与跨设备情况为模拟 |
| P-O01／P-O03 | F-O07 | third、locked1、locked2、lockEnding、lockedCode | 失败计数、锁定截止时间 | D-O09／D-O12／D-O15；AC-O59～O62 | 第 3 次起剩余次数，第 5 次锁定；10／30 分钟档位、24 小时触发窗口重置；正确验证码后再判锁定 |
| C-O01 | F-O08 | 拼块拖动／方向键、失败、capLoad、capCool、ticket、ipChallenge | slider、票据用途／目标邮箱模拟 | D-O15；AC-O28～O30、O63 | 交互和失败反馈可演示；无真实轨迹验证或反机器人能力 |
| P-O03 | F-O09 | rateEmail、rateIp、rateDevice、codeService、60 秒重发冷却 | work_email、模拟限频响应 | D-O15；AC-O64 | 三维超限展示与邮件失败重试；IP／设备实际计数未实现 |
| P-O02／P-O04／P-O05 弹窗 | F-O10 | 两条实时规则、mismatch、same、sameInitial | password、password_confirm | D-O14；AC-O35～O40 | 8–20 字符、字母＋数字、空格清理／拒绝、异步模拟原／初始密码比对 |
| P-O03 与改密成功输出 | F-O11 | M-O02／M-O01 模拟记录、codeService、bounce | 脱敏收件人、邮件类型 | D-O18／D-O19；AC-O67～O77 | 模拟触发类型和界面提示；不交付邮件 HTML／纯文本模板，不真实投递 |
| 改密成功输出 | F-O12 | E-O01 模拟负载（评审说明内可展开） | end、recipient_scope、recipient_admin_id、category、biz_type、page_target、dedupe_key | D-O20／D-O24；AC-O68～O80 | `fs_ops`／`admin_account`／`security`／P-O05；消息投递、去重存储、列表归 WS-309 |
| C-O04／P-O05 | F-O13 | 语言下拉；已填内容／错误保留并翻译 | locale | D-O16；AC-O81～O86、O89、O94～O96 | 默认英文，不使用浏览器语言；即时中英切换 |
| C-O04／P-O05 | F-O14 | 保存等待、saveFailed、重试、本地保留 | locale、显式设置时间 | D-O16；AC-O83、O86～O89 | 本地手动／模拟账号偏好按较晚显式时间处理；不具备真实跨设备同步 |
| P-O05 | F-O15 | 时区下拉、带偏移时间、保存成功／失败 | timezone | D-O17；AC-O17、O49、O90 | 首次登录推断时区，兜底 UTC；已保存时区不自动覆盖 |
| C-O12 | F-O16 | 成功／失败 Toast、错误提示中英切换 | 文案 key | AC-O91～O92 | 继承顶部居中 Toast；失败 live region 为 assertive |
| P-O06／登录路由 | 公共承载 | 登录落地、回跳、非法外部 redirect 丢弃 | redirect、role | D-O23／D-O24；AC-O97～O106 | 使用 `#/ops/*` 模拟业务路由；真实服务器路由不属于单文件原型 |

## 4. 角色与端矩阵

| 视图 | 进入方式 | 可用操作 | 被拒绝的操作 |
| --- | --- | --- | --- |
| 未登录 | 初次打开、退出、会话失效 | 工作邮箱密码登录、找回、语言 | 账户／总览直达会跳登录并保留回跳 |
| pending_reset | 用演示初始密码登录 | 首登重置、退出、语言 | 账户／总览／消息路由均回首登重置 |
| active 运营管理员 | 正常凭据登录 | 总览、账户设置、改密、语言、时区、消息入口 | 账户管理、跨资产平台入口均不存在 |
| locked | 连错 5 次或锁定状态 | 语言、等待 | 登录和找回不能完成；正确验证码后才揭示锁定 |
| disabled | 登录状态或已登录状态选择“账号停用” | 语言、联系技术提示 | 登录被拒，已登录态退出 |
| 金融服务端用户／其他角色 | out of scope | 不提供切端／选角色页面 | 本期不新增角色 |

## 5. 视觉来源与源码形式

已阅读 `docs/design-system/README.md`、`harbour-credit-admin-components.md`、`harbour-credit-page-prototype-reference.md`、`asset-platform/prototypes/_shared/README.md` 及公共实现。仓库无额外 `design.md`／`.hallmark/log.json`，以这些现有规范为准。

| 量取项 | 唯一来源／实际值 |
| --- | --- |
| 主色／应用底色 | `_shared/tokens.css`：`--accent: #2557E8`、`--bg: #F6F7FA` |
| 字体 | `--sans`：Inter／系统字体回退；`--mono`：SF Mono／系统等宽回退；不请求远程字体 |
| 圆角 | `--radius: 12px`、`--radius-sm: 9px`、`--radius-xs: 7px`、胶囊 999px |
| 控件 | admin `--ctrl-h: 36px`、小控件 28px；表单间距 13px；卡片内边距 16px |
| app shell | `_shared/base.css`：侧栏 238px；顶栏 13px × 26px；内容区 22px／26px／60px |
| focus shell | 主体 48px／24px／40px；居中列最大宽度 470px |
| 状态／叠层 | `.note`、`.rows`、`.modal`、`.mask`、`.toasts` 原有结构与语义色 |
| 表格 | 本模块无表格，不另外引入列表密度或斑马纹 |

源文件共享，交付时内联：本目录 HTML 按资产原型的既有结构维护模块样式、文案、状态及行为；通过传统 link／script 引用唯一公共 token、base.css、shell.js。金融服务平台自己的页面登记集中在 `../_shared/registry.js`，不加载资产平台的 registry，不复制公共代码。

公共路径均为 `../../../asset-platform/prototypes/_shared/`；这里只读引用，既有资产原型不受影响。平台接入方式见 [`../_shared/README.md`](../_shared/README.md)。这同时满足 PRD AC-O100 的不修改资产目录约束与设计规范的单一视觉／运行时来源要求；无需迁移公共层或重新维护一套样式。

从仓库根目录生成独立附件：

```sh
python3 financial-service-platform/prototypes/_shared/export.py --source financial-service-platform/prototypes/账户与登录/v1.0-账户与登录-原型.html --output /tmp/financial-service-ops-login-prototype.html
```

已保留同期入库协议管理的 P-O-AG-01～04 登记和导出命令；总览与协议管理导航在两模块间共用。仓库版可以跨文件跳转，进入账户模块须重新走该文件的演示登录守卫；没有跨模块真实会话同步。独立附件中跨模块链接显示使用完整仓库的提示，不访问缺失的相邻文件。

不要直接修改导出文件。后续金融服务平台模块继续使用本平台 registry 和同一公共运行时。

## 6. 验证结果

- Chromium 以 `file://` 打开；主流程检查无脚本错误、无网络请求。
- 6 页 × 中英 2 种语言 × 1280／1440／1920 三种宽度，共 36 组 DOM 几何检查，无横向溢出；抽查截图确认 focus／app 壳层和弹窗布局。范围不含 1280px 以下、移动端、Safari／Firefox。
- 67 个页面状态选项均可打开、无脚本报错；滑块、首登改密、忘记密码、再认证改密、退出、首登路由守卫、回跳等路径另以实际控件操作验证。
- 检查了超时保留已填内容并可重试、5 秒演示锁定归零、正确验证码后判锁定、外站回跳丢弃、字段错误随语言切换且值不丢失。
- 检查了弹窗 `inert` 背景、Tab 焦点约束、Escape 关闭及焦点回到改密按钮；字段带 label、aria-invalid、aria-describedby；继承公共 focus-visible。
- 入库合并时保留同期协议管理登记；补查两模块跨文件跳转、消息接入边界与协议管理三档桌面宽度。两个模块的单文件导出均可打开，协议管理原有导出命令仍兼容。
- 未执行真正的邮件、通知、数据库、服务端权限与会话安全测试；不能把本轮结果当作 108 条 AC 全通过。

Hallmark console slop test：**10 项通过，2 项部分覆盖**。完整业务规则项仅有界面模拟；全量功能页面项因 P-O06 壳子及外部模块边界保持 delta。其余项目（真实导航、状态、角色与账号状态、桌面宽度、视觉来源、离线形式、演示数据、排除项、结构指令、追溯表）按本次评审范围核对通过。

设计自评（1–5）：Philosophy 4／Hierarchy 4／Execution 4／Specificity 4／Restraint 5／Variety 3。未套用面向 landing page 的 58 门测试。

## 7. 跨模块接口与本期不做

对 WS-309：提供 C-O20 铃铛位置、C-O11 消息中心条目、P-O20／P-O21 回跳路径以及 E-O01 示例负载；入口点击显示明确的模块边界说明，不冒充可用消息中心，不显示假未读角标。消息池归属、消息详情、404／越权、实际轮询与投递仍由 WS-309 实现。

本期不做：金融服务端用户登录、注册／自动建号、钱包／第三方／验证码登录、协议勾选／重新同意、凭据补齐、修改邮箱、账号管理／部署初始化界面、总览业务内容、未交付的其他业务菜单、最后一个管理员保护、金额／链上值展示场景。邮件模板成品、实际发送、轨迹验签、服务端限频／权限／审计、跨设备状态同步也不属于本交互附件的实现。

假设与限制：界面使用“金融服务平台／Financial Services”作为功能名称，FS 为原型缩写，不代表已批准正式品牌。PRD 的 7 个品牌／合规占位符实际值仍待提供。演示时区选项覆盖常见 IANA 地区，不是完整时区目录。验证码、锁定、密码比对、偏好账号侧存储均为可审阅的本地模型。

本轮将模块 HTML、README、平台登记与导出工具，以及仓库／平台原型索引直接提交至 `cly-V1.0.0`，不开 PR。具体提交 SHA 以 issue 入库回帖为准。未修改资产平台、docs、PRD 或 WS-309 文件；原型的模拟与范围限制不因入库而改变。
