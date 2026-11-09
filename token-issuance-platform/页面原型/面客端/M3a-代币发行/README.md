# M3a · 代币发行申请

2026-11-09 · existing-system adaptation / console · English 默认，支持中文。基线：PRD `68c2e54` 三册（01 / 02 / 04；M3a 三册与 `a957f38` 相比无改动，本轮按 M3b 单位价值展示裁定同步），在上一版 M3a 原型上同步。企业、资产、金额、地址、签名、文件和时间均为演示数据。规则、校验与异常分支以 PRD 为准。

## 截断金额改为图标浮层（2026-11-09）

- 修改：`list` 与 `detail-ops-rejected` 中超两位小数的资产价值（IA-DEMO-0012）不再显示“已截断 · 完整值 / 已截断至两位 · 查看完整值”文字；改为金额旁的小下拉图标，点击后以浮层显示完整金额 12,345.675 USD，不改变行高与列宽。点击外部或 Esc 收起，浮层内可选中复制。核对页“查看所签的四项业务值”和签名展开不变。
- 核验：Chromium，中英文 × 1280 / 1440 / 1920 px 逐屏 74 屏无脚本错误、无整页横向溢出、无残留旧文案；两处浮层的打开、内容、未被表格裁切、列表宽度与行高不变、Esc / 外部点击收起、滚动跟随均通过。
- PRD `d75ac45` 已将该图标方式定为全平台通用的“两位小数截断展示”，原待确认项关闭；图标名称统一为“查看完整值”。

## PRD 68c2e54 同步（2026-11-09）

- 修改：`detail-minted` 铸造结果的初始单位价值按运营填写的完整值展示为“1 COU = 1 USD”（不补零、不截断），代币数量单位统一为 COU；铸造初始资产估值 36,000.00 USD（两位小数）。DEMO-TOKEN-001 的初始单位价值由 0.8 改为 1，与跨模块演示数据（36,000.00 COU / 36,000.00 USD）及 M4a / M4b 代币详情一致。
- 核验：Chromium headless、`file://`、1280 px，中英文逐屏 `TP.show` 全部 74 屏，无脚本错误、无整页横向溢出、无指向不存在画面的 `data-go`；`detail-minted` 中英文截图自查。
- 待确认：无。

## 上轮 PRD 同步（`7fb395b` → `a957f38`）

- **到期时点**：全部到期值改为来源时区到期日 24:00（演示来源时区 Asia/Dubai），按本人时区同时展示日期、时间和时区。核对、详情改称“到期时点”，下方可核对原始到期日与来源时区；所签业务值显示为来源时区的 `YYYY-MM-DD 24:00 Asia/Dubai`；铸造结果“到期日”、资产详情弹窗和可信资产衔接摘要同样带时区。
- **登录地址不可变更**：删除 `detail-former-login`（提交后登录地址变更）；历史申请 IA-DEMO-0031 / 0027 / 0012 的接收与签名地址统一为唯一登录地址 0x7A3f…A4bC；核对页后果说明改为“铸造成功的代币进入提交时记录的接收地址”。
- **不再有撤销确权**：`submit-asset-changed` 改为“提交时资产已不满足发起条件”（示例：资产已结清）。
- **钱包切换地址**：`submit-ended` 同时承接登录结束与钱包切换到其他地址，均要求重新登录。
- **进度口径**：发行处理中、铸造成功时“运营处理”环节显示“已完成”，说明改为“运营处理已完成，正在铸造”。
- **业务列表通用规则**：发行申请列表加分页条，按提交时间由新到旧；PRD 未定义查找条件，不加筛选条，无“筛选无匹配”画面。
- **可信资产衔接**：与 M2 新口径一致，资产详情增加发起条件说明和“关联记录”（申请编号可进入对应详情，申请状态取企业可见状态：运营处理中 / 发行处理中 / 运营驳回 / 铸造成功；已发行附代币编号）；可发行资产主操作改为“申请发行”，进入可信资产直接发起流程；衔接列表加分页条。
- 英文词典：机构名称改为 Institution name，清理机构分配、登录地址变更等过时文案。

## 继承的视觉基线（2026-11-06）

三阶段、无操作记录的企业口径及以下视觉语言由既有原型继承，本轮未重新设计。

- **发行进度**：既有详情变体采用编号、完成勾或驳回标识，阶段标题与状态分两行；去掉重复的胶囊背景，保留全部状态文字与 `aria-current`。概览标题降低为 14 px，从主体申请信息中让出层级；不加节点时间或历史轨迹。
- **文件与填写**：文件分区使用行分隔，保留原文件名、格式、大小、提交时间及原有操作；收紧上传区和自动接收地址区的留白，选填标记降为辅助文字。无文件、上传中、失败、格式不符、已冻结等内容继承原型。
- **列表与数字**：六列宽度按编号、金额、时间、状态和操作重新分配。金额使用正文数字与等宽数字间距，编号、地址、签名继续使用等宽字体；数据精度和截断规则不变。
- **完整值展开**：原生 `details` 增加展开方向标识与明确的键盘焦点、点击范围。四项签名业务值、唯一到期时点及复制行为保持可达；截断金额的完整值已改为图标浮层（见上）。
- **评审入口**：1101 px 以上把画面目录入口移到侧栏底部空白处，避免遮挡文件移除／下载与吸底主操作；原画面目录、主流程及跨模块导航不变。

样式统一维护于 `_shared/components.css` 的现有 M3a 组件区；使用 `.issuance-*` 显式变体，`.review-timeline.compact` 的三阶段用于 M3a，M3b 通过显式四阶段变体复用。沿用所有 token、品牌、字体资源和壳层，不影响其他模块的四阶段进度。

## 打开方式

- 仓库联看：双击 [index.html](../../index.html)，选择已认证企业；侧栏、资产和代币入口可跨模块跳转。
- 源页：[代币发行.html](代币发行.html)。
- 离线评审：在 `页面原型/` 执行 `python3 _shared/export.py --source 面客端/M3a-代币发行/代币发行.html --output <仓库外路径>.html`，生成件可双击打开，无需服务。
- 画面目录默认关闭（桌面位于侧栏底部），可查看预设异常及点击“主流程下一屏”；等待钱包、提交中等画面不自动模拟签名成功。单模块附件的跨模块入口给出完整原型提示。

## 覆盖与核验

74 个画面（删除 1 个）。Chromium 1280 px、视口高 800 px、展示时区 Asia/Shanghai，逐屏 `TP.show` 遍历中文 / English 各 74 屏：无脚本异常，无整页横向溢出，英文无漏译。对列表、核对、发行处理中详情、铸造成功详情、资产弹窗、可信资产衔接（可发行、已发行）截图自查：到期时点显示为 2027-04-01 04:00 Asia/Shanghai，并可核对原始到期日 2027-03-31 与来源时区 Asia/Dubai。

这是静态画面原型，不执行真实上传、下载、权限、业务校验、钱包签名、幂等、分页或链上交易；钱包完成和提交结果用画面目录手动推进。未验证 Safari / Firefox 与 1280 px 以下宽度。布局核验不代表业务 AC 已通过。

## 待确认

- 无需业务裁定的缺口。PRD 未定义发行申请列表的查找条件，本原型不加筛选条；如后续增加，需 PRD 补充字段。

## 画面清单

| 分组 | 画面 ID 与名称 |
| --- | --- |
| 申请列表 | `list` 默认（分页，按提交时间由新到旧）；`list-empty` 暂无申请；`list-fail` 列表读取失败；`gate` 未认证企业受限 |
| 1 选择资产 | `asset-none` 尚未选择资产；`asset-selected` 已选择资产（含从可信资产带入）；`asset-empty` 无可发起资产；`asset-fail` 可选资产读取失败；`asset-changed` 带入资产已不满足条件；`asset-view-0128` 资产详情 RA-DEMO-0128；`asset-view-0166` 资产详情 RA-DEMO-0166；`asset-view-0171` 资产详情 RA-DEMO-0171 |
| 2 填写申请信息 | `info-none` 申请文件与自动接收地址；`info-files` 申请文件已上传；`info-uploading` 申请文件上传中；`info-upload-failed` 申请文件上传失败；`info-file-invalid` 申请文件不符合要求；`info-file-pdf` 申请文件剩余 1 份 · PDF；`info-file-png` 申请文件剩余 1 份 · PNG |
| 3 核对并签名提交 | `confirm` 核对申请；`sign-wait` 等待钱包签名；`sign-cancelled` 取消或拒绝签名；`sign-wrong-address` 钱包地址不是登录地址；`sign-wrong-network` 钱包网络不是 Ethereum；`sign-invalid` 签名未通过核对；`submitting` 签名通过，提交中；`submit-success` 提交成功；`submit-fail` 申请保存失败；`submit-unverified` 提交时认证失效；`submit-upstream` 暂时无法确认提交条件；`submit-duplicate` 同一资产已有申请；`submit-asset-changed` 提交时资产已不满足发起条件；`submit-ended` 登录结束或钱包已切换地址；`confirm-empty` 核对申请（未上传文件）；`sign-wait-empty` 等待签名（无申请文件）；`submitting-empty` 提交中（无申请文件）；`submit-success-empty` 提交成功（无申请文件）；`confirm-file-pdf` 核对申请 · PDF；`confirm-file-png` 核对申请 · PNG；`sign-wait-pdf` 等待钱包签名 · PDF；`submitting-pdf` 签名通过，提交中 · PDF；`submit-success-pdf` 提交成功 · PDF；`sign-wait-png` 等待钱包签名 · PNG；`submitting-png` 签名通过，提交中 · PNG；`submit-success-png` 提交成功 · PNG |
| 申请详情 | `detail-reg` 运营处理中（本次提交）；`detail-ops` 运营处理中；`detail-ops-rejected` 运营驳回；`detail-progress` 发行处理中；`detail-minted` 铸造成功；`detail-denied` 无权查看或申请不存在；`detail-fail` 详情读取失败；`detail-signature-fail` 签名记录读取失败；`detail-reg-empty` 运营处理中（无申请文件）；`detail-reg-pdf` 运营处理中（本次提交） · PDF；`detail-reg-png` 运营处理中（本次提交） · PNG |
| 可信资产衔接 | `asset-reference-ready` 可发行（申请发行入口）；`asset-reference-pending` RA-DEMO-0128 · 发行申请中；`asset-reference-ops` RA-DEMO-0131 · 发行申请中；`asset-reference-progress` RA-DEMO-0143 · 发行申请中；`asset-reference-issued` RA-DEMO-0102 · 已发行；`asset-reference-ops-rejected` RA-DEMO-0160 · 已驳回；`asset-reference-list` 可信资产入口 |
| 相邻页面衔接 | `leave-confirm` 前往资产可信平台：确认 |
| 可信资产直接发起 | `info-from-asset` 固定资产 · 申请文件与自动接收地址；`info-from-asset-files` 固定资产 · 申请文件已上传；`confirm-from-asset` 固定资产 · 核对申请；`confirm-from-asset-empty` 固定资产 · 核对申请（未上传文件）；`info-from-asset-file-pdf` 固定资产 · 申请文件剩余 1 份 · PDF；`confirm-from-asset-file-pdf` 固定资产 · 核对申请 · PDF；`info-from-asset-file-png` 固定资产 · 申请文件剩余 1 份 · PNG；`confirm-from-asset-file-png` 固定资产 · 核对申请 · PNG |
| 发行申请文件 | `application-file-preview` 申请文件预览；`application-file-fail` 申请文件读取失败 |
