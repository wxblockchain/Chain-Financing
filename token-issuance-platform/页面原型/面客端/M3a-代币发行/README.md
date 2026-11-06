# M3a · 代币发行申请

2026-11-06 · existing-system adaptation / console · English 默认，支持中文。基线：`cly-v6.0.0` 的 M3a 原型及最新 PRD 三册（`4c7d8c5`）。企业、资产、金额、地址、签名、文件和时间均为演示数据。规则、校验与异常分支以 PRD 为准。

## 本轮 UI 深化

基于已入库原型 `0d628ab`，按 `4c7d8c5` PRD 保持三阶段、无操作记录的企业口径。本轮为 existing-system adaptation / console，只调整呈现，不新增画面、业务分支、校验、计算或请求。

- **发行进度**：10 个既有详情变体采用编号、完成勾或驳回标识，阶段标题与状态分两行；去掉重复的胶囊背景，保留全部状态文字与 `aria-current`。概览标题降低为 14 px，从主体申请信息中让出层级；不加节点时间或历史轨迹。
- **文件与填写**：29 个文件分区使用行分隔，保留原文件名、格式、大小、提交时间及原有操作；收紧上传区和自动接收地址区的留白，选填标记降为辅助文字。无文件、上传中、失败、格式不符、已冻结等内容继承原型。
- **列表与数字**：六列宽度按编号、金额、时间、状态和操作重新分配。金额使用正文数字与等宽数字间距，编号、地址、签名继续使用等宽字体；数据精度和截断规则不变。
- **完整值展开**：原生 `details` 增加展开方向标识与明确的键盘焦点、点击范围。完整金额、四项签名业务值、唯一到期时点及复制行为保持可达。
- **评审入口**：1101 px 以上把画面目录入口移到侧栏底部空白处，避免遮挡文件移除／下载与吸底主操作；原画面目录、主流程及跨模块导航不变。

样式统一维护于 `_shared/components.css` 的现有 M3a 组件区；使用 `.issuance-*` 显式变体，`.review-timeline.compact` 当前仅 M3a 使用。沿用所有 token、品牌、字体资源和壳层，不影响其他模块的四阶段进度。

## 打开方式

- 仓库联看：双击 [index.html](../../index.html)，选择已认证企业；侧栏、资产和代币入口可跨模块跳转。
- 源页：[代币发行.html](代币发行.html)。
- 离线评审：在 `页面原型/` 执行 `python3 _shared/export.py --source 面客端/M3a-代币发行/代币发行.html --output <仓库外路径>.html`，生成件可双击打开，无需服务。
- 右下角画面目录默认关闭，可查看预设异常及点击“主流程下一屏”；等待钱包、提交中等画面不自动模拟签名成功。单模块附件的跨模块入口给出完整原型提示。

## 覆盖与核验

保留原有 75 个预设画面。本轮修改列表排版、10 个进度概览、29 个文件分区、填写与确认区、金额和签名展开控件；资产引用详情、认证引导、钱包反馈和状态分支继承上游，原画面清单与 ID 不变。

Chromium 实测中文 / English × 1280 / 1440 / 1920 px 的全部 75 屏（450 组），检查脚本、整页横向溢出和英文漏译。定向检查八条既有文件主路径、单份移除、上传阻断、原生展开控件键盘与焦点、文件弹窗焦点返回、吸顶标题和分区导航、目录入口与业务操作不遮挡、长文件名、驳回原文、完整签名值与时区、跨模块跳转，以及断网离线附件。M3b / M4a 使用未启用变体的组件，与修改前的计算布局做回归比较。

源码对照检查：75 屏全部文字与业务值、路由与控件属性、脚本均保持原值；新增进度标记仅为 `aria-hidden` 的视觉辅助。主流程中的签名完成与提交结果仍用画面目录手动切换，不模拟真实成功。内部截图用于视觉核验，默认不作为交付附件。

这是静态画面原型，不执行真实上传、下载、权限、业务校验、钱包签名、幂等或链上交易。文件内容鉴别、访问审计、签名有效性和跨模块真实状态来源需研发按 PRD 实现。已登记的 M3b 依赖 SYNC-M3A-01/02 继续由对应模块处理；本轮不修改 PRD、Eval、管理端或其他模块业务。

未验证 Safari / Firefox、1280 px 以下宽度、真实文件服务、生产权限及链上能力。布局核验不代表业务 AC 已通过。

## 画面清单

| 分组 | 画面 ID 与名称 |
| --- | --- |
| 申请列表 | `list` 默认；`list-empty` 暂无申请；`list-fail` 列表读取失败；`gate` 未认证企业受限 |
| 1 选择资产 | `asset-none` 尚未选择资产；`asset-selected` 已选择资产（含从可信资产带入）；`asset-empty` 无可发起资产；`asset-fail` 可选资产读取失败；`asset-changed` 带入资产已不满足条件；`asset-view-0128` 资产详情 RA-DEMO-0128；`asset-view-0166` 资产详情 RA-DEMO-0166；`asset-view-0171` 资产详情 RA-DEMO-0171 |
| 2 填写申请信息 | `info-none` 申请文件与自动接收地址；`info-files` 申请文件已上传；`info-uploading` 申请文件上传中；`info-upload-failed` 申请文件上传失败；`info-file-invalid` 申请文件不符合要求；`info-file-pdf` 申请文件剩余 1 份 · PDF；`info-file-png` 申请文件剩余 1 份 · PNG |
| 3 核对并签名提交 | `confirm` 核对申请；`sign-wait` 等待钱包签名；`sign-cancelled` 取消或拒绝签名；`sign-wrong-address` 钱包地址不是登录地址；`sign-wrong-network` 钱包网络不是 Ethereum；`sign-invalid` 签名未通过核对；`submitting` 签名通过，提交中；`submit-success` 提交成功；`submit-fail` 申请保存失败；`submit-unverified` 提交时认证失效；`submit-upstream` 暂时无法确认提交条件；`submit-duplicate` 同一资产已有申请；`submit-asset-changed` 提交时债权人确权已撤销；`submit-ended` 登录结束且未保存；`confirm-empty` 核对申请（未上传文件）；`sign-wait-empty` 等待签名（无申请文件）；`submitting-empty` 提交中（无申请文件）；`submit-success-empty` 提交成功（无申请文件）；`confirm-file-pdf` 核对申请 · PDF；`confirm-file-png` 核对申请 · PNG；`sign-wait-pdf` 等待钱包签名 · PDF；`submitting-pdf` 签名通过，提交中 · PDF；`submit-success-pdf` 提交成功 · PDF；`sign-wait-png` 等待钱包签名 · PNG；`submitting-png` 签名通过，提交中 · PNG；`submit-success-png` 提交成功 · PNG |
| 申请详情 | `detail-reg` 运营处理中（提交时登录地址接收）；`detail-ops` 运营处理中；`detail-ops-rejected` 运营驳回；`detail-progress` 发行处理中；`detail-minted` 铸造成功；`detail-former-login` 提交后登录地址变更（保留历史接收地址）；`detail-denied` 无权查看或申请不存在；`detail-fail` 详情读取失败；`detail-signature-fail` 签名记录读取失败；`detail-reg-empty` 运营处理中（无申请文件）；`detail-reg-pdf` 运营处理中（提交时登录地址接收） · PDF；`detail-reg-png` 运营处理中（提交时登录地址接收） · PNG |
| 可信资产衔接 | `asset-reference-ready` 可发行；`asset-reference-pending` RA-DEMO-0128 · 发行申请中；`asset-reference-ops` RA-DEMO-0131 · 发行申请中；`asset-reference-progress` RA-DEMO-0143 · 发行申请中；`asset-reference-issued` RA-DEMO-0102 · 已发行；`asset-reference-ops-rejected` RA-DEMO-0160 · 已驳回；`asset-reference-list` 可信资产入口 |
| 相邻页面衔接 | `leave-confirm` 前往资产可信平台：确认 |
| 可信资产直接发起 | `info-from-asset` 固定资产 · 申请文件与自动接收地址；`info-from-asset-files` 固定资产 · 申请文件已上传；`confirm-from-asset` 固定资产 · 核对申请；`confirm-from-asset-empty` 固定资产 · 核对申请（未上传文件）；`info-from-asset-file-pdf` 固定资产 · 申请文件剩余 1 份 · PDF；`confirm-from-asset-file-pdf` 固定资产 · 核对申请 · PDF；`info-from-asset-file-png` 固定资产 · 申请文件剩余 1 份 · PNG；`confirm-from-asset-file-png` 固定资产 · 核对申请 · PNG |
| 发行申请文件 | `application-file-preview` 申请文件预览；`application-file-fail` 申请文件读取失败 |
