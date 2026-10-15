# 国际化 Web3 金融工作区 · WS-385

**历史修订报告（2026-10-14）：** 下文保留 WS-385 的实现与验证记录，不能作为当前组件数值定义或本轮重新测试的证据。2026-10-15 用户确认的现行蓝白、字体及双端组件规格见[共享组件视觉规范](共享组件视觉规范.md)；按端区分正文 / 控件密度等旧说明已被该规范取代，页面与业务仍按现行模块继承。

Stage 4 · existing-system adaptation / console。用户在 WS-385 明确要求“参考397对整个借贷平台的页面进行优化调整，直接入库”，本次合并中间评审阶段，目标为当前项目绑定的 `wxblockchain/Chain-Financing`、issue 指定分支 `cly-v3.0.0`。源码基线 `efa4fb44cf8411e688761f954d71bbee811598f1`；视觉参考为 WS-397 已确认方案及 V5 附件（2026-10-14）。

## Stage 1 · 范围与 coverage matrix

本次交付全平台原型的视觉适配，业务规则、数据服务、生产前端及真实钱包不属于本轮验收。矩阵里的 preserved from existing 表示保留既有流程和反馈实现，不表示本轮重新完成全部业务验收。

| 端 / 角色 | 页面 / 流程 | 默认 | 加载 / 空 / 无结果 | 错误 / 校验 / 提交等待 | 权限 | 响应式 |
| --- | --- | --- | --- | --- | --- | --- |
| 面客 / 访客、未绑定、资产方、资金方 | 登录、用户信息、企业 / 机构信息 | covered | preserved from existing | preserved from existing | preserved from existing | 320 / 375 / 414 / 768 / 1280 / 1440 / 1920 |
| 面客 / 资产方、资金方 | 企业 / 机构账户列表、查看、新增 / 编辑 | covered | preserved from existing | preserved from existing | preserved from existing | 同上 |
| 面客 / 四类身份 | 资产广场、代币详情 | covered | preserved from existing | preserved from existing | preserved from existing | 同上；内嵌连续追加保留 |
| 面客 / 四类身份 | 借贷广场、项目详情、创建 | covered | preserved from existing | preserved from existing | preserved from existing | 同上 |
| 面客 / 项目当事方 | 质押、解除 / 提取、融资发布、授信报价、放款、还款办理 | covered | preserved from existing | preserved from existing；继承 V5 一步解押 | preserved from existing | 同上；宽表允许弹层内部滚动 |
| 面客 / 资产方、资金方 | 我的控制台、项目 / 授信 / 报价 / 放款 / 还款只读详情 | covered | preserved from existing | preserved from existing | preserved from existing | 同上 |
| 面客 / 资产方、资金方 | 消息清单、消息详情及目标跳转 | covered | preserved from existing | preserved from existing | preserved from existing | 同上 |
| 运营管理员 | 登录、找回、首次改密、总览、账户设置 | covered | preserved from existing | preserved from existing | preserved from existing | 375 / 414 / 768 / 1280 / 1440 / 1920 |
| 运营管理员 | 融资参数列表、详情、维护 / 记录 | covered | preserved from existing | preserved from existing | preserved from existing | 1280 / 1440 / 1920 |
| 运营管理员 | 协议列表、详情、编辑、版本 / 操作记录 | covered | preserved from existing | preserved from existing | preserved from existing | 1280 / 1440 / 1920 |
| 运营管理员 | 项目审核、合约台账、详情 / 部署 | covered | preserved from existing | preserved from existing | preserved from existing | 1280 / 1440 / 1920 |
| 运营管理员 | 机构认证审核列表、详情 / 审核记录 | covered | preserved from existing | preserved from existing | preserved from existing | 1280 / 1440 / 1920 |
| 运营管理员 | 代币质押审核列表、详情 / 审核记录 | covered | preserved from existing | preserved from existing | preserved from existing | 1280 / 1440 / 1920 |
| 运营管理员 | 消息清单、详情 / 业务跳转 | covered | preserved from existing | preserved from existing | preserved from existing | 1280 / 1440 / 1920 |

## Stage 2 · 复用与落点

端/角色：面客端四类身份、运营管理员 · 模块：13 个原型模块 · 功能点：6 类视觉形态（列表、详情、表单、办理 / 审核、记录、消息）· 页面与状态：上表 · 视觉口径取自：`_shared/design-system/`、`_shared/tokens.css`、`_shared/base.css`、WS-397 V5。

- 复用 portal / app / focus 壳层、真实导航、页面注册、`CF.review`、权限判定、弹层宿主、共享文件与通知组件。保留模块目录和原生入口；不增加外层页面选择器。
- 色板、字体、圆角、密度仍只有 `tokens.css` 一个来源。白色内容面、浅灰蓝画布、深色正文与单一蓝色当前项；链、合约、代币提供 Web3 识别，语义色仍表示实际状态。
- 公共视觉修改追加在 `base.css`，面客与运营保留原密度差异；统一自然大小写表头、可读标签、轻阴影、主次按钮、字段边界和弹层节奏。局部布局只扩展既有模块 CSS。
- WS-397 V5 从共享源层导出的三个原生文件差异（借贷广场 CSS / JS、授信报价 JS）回合至其原目录；不拆分、拷贝整个自包含评审 HTML，不引入其中的强制登录评审入口。
- 保留资产广场内嵌连续追加与单列详情、借贷详情右侧吸顶办理区、账户分组、只读控制台、运营固定侧栏和业务审核步骤。默认英文、中文切换与时区偏好沿用现有运行时。

## 视觉与组件约定

1. 一个信息区一个主动作；列表查询、提交与当前办理可用实心蓝色。关闭项目为同组低强调动作，危险确认仍使用既有确认流程。
2. 正文与业务标签不使用浅淡小字或全大写；表头用可换行的自然大小写。蓝色只承担可操作或当前项，金额使用中性正文色；币种文字始终保留。
3. 金额与数量用 tabular numbers，桌面同列右对齐；移动卡片保留原来每个字段的标签和值，不裁切完整金额、长标题或地址。
4. 记录区轻表面，办理区通过边界、标题和当前动作突出；不使用叠加渐变或装饰线抢占注意力。
5. 输入边界与焦点可辨识；只读字段沿用浅色静态表面。弹层仍使用共享宿主、头尾分隔、键盘和焦点恢复，不新增确认层。
6. 面客端保持既有小屏与内滚约定；运营端保持高密度与 1280px 操作列可达。所有新增颜色、字体和尺寸引用 canonical tokens。
7. 时刻的日期与时分必须一起按当前展示时区换算。`CF.fmtTime` 修正此前只换时分、日期仍取宿主本地日期的问题；业务日期 `CF.fmtDate` 的既有含义不变，无效时区显示 UTC 兜底。

## 追溯及边界

| 页面组 | 功能 / 字段 / 状态基线 | 本轮验收 |
| --- | --- | --- |
| 面客各组 | `面客端/*/README.md` 与 `PRD/面客端/` 各模块现行正文 | 标题、标签、表格、金额、表单、弹层与响应式呈现；既有 FIELD / AC 业务语义继承 |
| P-LS-01 / 02 / 03 及关联办理 | WS-397 V5；F-LS-01 / 05 / 06 / 10 / 11 / 17 / 18 / 20 / 80 / 81；L6 / L7 / L8 | 环节标题与事实、上一轮金额、当事方隐私、日期分层与选币直接签名 |
| 运营各组 | `运营端/*/README.md` 与 `PRD/运营端/` 各模块现行正文 | 共享组件视觉、表头、筛选、审核动作、固定操作列；不改变权限项与审核规则 |

全部企业、金额、地址、合约、凭据和链上执行均为既有演示数据。生产接口、钱包 / 链上交易、真实附件与消息投递、业务 PRD 全量 FIELD / AC 穷举、Safari / Firefox / 真机 / 屏幕阅读器不属于本轮交付。

实际验证结果及附件运行方式见最终交付说明；不得将视觉适配称为生产系统业务验收。

## Stage 4 · 验证与交付

### 实际验证

Chromium headless，源码入口和共享导出器生成的两份离线 HTML：

- **1,002 个页面呈现检查**：797 个面客端、205 个运营端，覆盖 41 个实际页面编号；其中 200 个为默认以外的加载、空、无结果、失败、无权限反馈检查。其余按中英、可达身份和约定宽度组合。已认证资金方访问注册页按既有守卫回到申请状态页；实际未提交机构注册表单另用 draft 身份补测。
- 面客端检查 320 / 375 / 414 / 768 / 1280 / 1440 / 1920；运营业务检查 1280 / 1440 / 1920，运营账户同时检查 375 / 414 / 768。未发现文档横向溢出、空白页或脚本异常。既有顶栏、项目分区导航与选币宽表允许容器内横滚，键盘聚焦可显示末项，不把容器内滚动误报成页面溢出。
- **56 个弹层布局组合**：账户表单、质押选币、解押选币及选中态 × 中英 × 七种宽度；核对弹层边界、头尾与按钮可达。窄屏签名前的合约标签单独一行，完整地址可读并可复制；选币表保留内部滚动，不把代币编号挤成逐字列。
- **26 项关键路径检查**：筛选 / 清空、真实列表进详情、桌面质押三动作同组、直接签名及等待 / 发起、环节事实区分、未来环节空态、报价隐私、真实语言菜单切换保留创建输入、双日期标签、账户共用弹层、资产清单键盘追加、三种桌面宽度的运营操作列、参数详情和权限反馈等。
- **22 项离线交付检查**：面客四个跨模块目标、运营全部业务菜单及消息 / 总览、融资节点切换、Escape 关闭、取消签名无交易 / 无 gas / 保留勾选、默认关闭评审工具、可见键盘焦点；无外部 HTTP(S) 请求或脚本异常。
- **15 项窄屏与可访问性抽样**：机构注册实际表单及上传按钮四宽度、320px 账户 Tab、项目导航键盘显露、签名触控高度、减少动态效果。对页底的对比度：主正文 17.16:1、次文字 7.09:1、弱文字 4.68:1、焦点主色 6.31:1、输入边界 3.47:1。这是 canonical token 抽样，不代替完整 WCAG 审计。
- 修改的 JavaScript 经 `node --check`，`git diff --check` 通过。截图用于内部视觉复核，不作为交付附件。
- **8 项时间展示边界检查**：跨日、跨年、夏令时切换、午夜、中英、无效时区与无效值；验证日期和时分来自同一目标时区，底层业务时间不改。

1,002 是实际呈现组合数，不代表 1,002 条独立业务验收。加载、空、无权限等继承各模块原有状态容器；本轮不重演全部审核、全部异常与 FIELD / AC。

### console slop test 与设计自评

| 检查 | 结果 |
| --- | --- |
| 1 菜单与功能对应；2 原生页面可达；5 角色 / 端；6 宽度；7 视觉来源；8 共享内联与离线；9 演示数据；10 范围边界；11 用户结构要求 | 已核对；菜单和页面结构沿用现有系统 |
| 3 全量状态；4 全量业务规则；12 全量 FIELD / AC 追溯验收 | 继承现有实现并抽样回归；未做业务穷举，视觉覆盖和模块基线已在上表追溯 |

不使用营销页的 58 门 slop test 分数。设计自评（1–5）：Philosophy 4、Hierarchy 4、Execution 4、Specificity 5、Restraint 4、Variety 4。

### 运行与维护

- 仓库源码：保持 `lending-platform/页面原型/` 完整，双击各模块 HTML。面客各入口共用 `portal-entry.js`；运营各入口保留自己的业务宿主与真实相对链接。
- 附件：面客端默认进入资产广场，主导航进入借贷广场；我的控制台与账户等受限页面通过默认关闭的 Demo tools 选择演示身份后查看。运营端从真实登录页进入，可在 Demo tools 载入虚构管理员凭据后登录，也可用既有演示页面 / 状态入口检查各业务模块。两份附件均可双击离线打开，默认英文，可切中文。
- 维护唯一源码：`tokens.css` / `base.css` 及既有模块文件。交付 HTML 由 `_shared/export.py` 内联，生成件不入库，不手工维护快照。
- 本轮文件：公共 tokens / base / shell 时间格式、页面及设计系统说明、登录样式、账户样式、资产广场样式、借贷广场 CSS / JS / README 与授信报价 JS、控制台样式。运营各模块、消息模块通过共享层获得统一视觉，没有复制业务脚本。
- 入库方式：按用户要求直接提交并 push 到 `cly-v3.0.0`，不新开 PR；具体 commit 和 push 结果以 issue 最终回复为准。没有后续设计阶段待批准。

使用知识：hallmark SKILL 与 console / existing-system supporting references、Hallmark knowledge INDEX、项目现行设计系统与模块 README、WS-397 方案及 V5。未更新工作区知识库。
