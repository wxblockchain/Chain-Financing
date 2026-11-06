# M3a · 代币发行申请

2026-11-06 · existing-system adaptation / console · English 默认，支持中文。基线：`cly-v6.0.0` 的 M3a 页面；本轮依据同分支 PRD `2872587`。企业、资产、金额、地址、签名、文件和时间均为演示数据。

## 本轮范围

仅更新企业申请面客端，沿用共享壳层、token、样式和组件；没有变更管理端或消息模块。

- 填写页补齐选填的发行申请文件；显示 PDF / JPG / JPEG / PNG、最多 10 份、每份最大 10 MB、内容须与扩展名一致。提供无文件、两份文件、单份移除、上传中、上传失败和格式不符的预设画面。
- 核对页展示原文件名、格式、大小、份数；文件选填，无文件也有对应的签名、提交和详情画面。上传中或失败未移除的画面禁止继续。
- 申请详情新增文件清单、提交时间与冻结说明；所有结果状态保留查看 / 下载入口，不提供替换、删除或补传。文件预览、读取失败和重试沿用现有弹窗。
- 仅展示企业提交 → 机构分配 → 运营处理 → 铸造；不出现机构选择、名单、材料、机构审核或监管协议。删除旧协议失败画面和旧监管翻译；修正运营处理提示。
- 签名内容可展开核对四项完整业务值；明确申请文件不签名、不上链，成功铸造才写入签名。修正历史演示记录中签名地址与接收地址不一致的问题。
- 确认和详情保留来源时区的唯一到期时点，切换展示时区不改写业务值。12,345.675 USD 示例主显示截断为 12,345.67，可用键盘展开完整值。铸造结果补齐初始单位价值、初始资产估值。
- 可信资产 `issueFromAsset` 入口直接进入固定资产的填写页，无资产改选入口。已删除画面的历史 `assetApplication0097` 路由落到统一“无权查看或申请不存在”，避免错误展示另一笔申请；相邻 M2 / M7 中历史记录的业务文案不在本轮修改范围。

## 打开方式

- 仓库联看：双击 [index.html](../../index.html)，选择已认证企业；侧栏、资产和代币入口可跨模块跳转。
- 源页：[代币发行.html](代币发行.html)。
- 离线评审：在 `页面原型/` 执行 `python3 _shared/export.py --source 面客端/M3a-代币发行/代币发行.html --output <仓库外路径>.html`，生成件可双击打开，无需服务。
- 右下角画面目录默认关闭，可查看预设异常及点击“主流程下一屏”；等待钱包、提交中等画面不自动模拟签名成功。单模块附件的跨模块入口给出完整原型提示。

## 覆盖与核验

共 75 个预设画面：原有 45 屏删除 1 个旧协议画面，保留 44 屏，并按最新 PRD 补齐 31 个文件及入口变体；数量不代表独立页面或业务验收通过数。列表、填写、确认、详情、只读进度和相关异常为本轮修改；可信资产引用详情、认证引导、既有钱包异常与壳层继承。

Chromium 检查中文 / English，1280 / 1440 / 1920 px 的所有画面（450 组），包括脚本错误、整页横向溢出和英文漏译；定向检查两入口 × 0 / 1 / 2 份文件的八条成功路径、单份移除、上传阻断、文件弹窗键盘与关闭焦点、四项签名值和时区、冻结清单、真实跨模块入口，以及断网离线附件。截图仅用于内部视觉核验。

这是静态交互原型：只切换已标识的样本画面，不接收真实文件、不鉴别文件内容、不执行实际上传 / 下载、权限、签名、幂等或链上交易。文件体积和份数边界、同名文件、内容鉴别、访问记录与机构访问权限需研发实现后按 PRD 验收；不能以此原型判定后端 AC 通过。签名取消等异常沿用预设画面，不模拟全部文件组合与返回链路；改选其他资产沿用既有预设资产演示，不作真实表单持久化。

未验证 Safari / Firefox、1280 px 以下宽度、生产权限与链上数值承载能力。无新增 token / CSS，对共享组件的实现没有影响。

## 画面清单

| 分组 | 画面 ID 与名称 |
| --- | --- |
| 申请列表 | `list` 默认；`list-empty` 暂无申请；`list-fail` 列表读取失败；`gate` 未认证企业受限 |
| 1 选择资产 | `asset-none` 尚未选择资产；`asset-selected` 已选择资产（含从可信资产带入）；`asset-empty` 无可发起资产；`asset-fail` 可选资产读取失败；`asset-changed` 带入资产已不满足条件；`asset-view-0128` 资产详情 RA-DEMO-0128；`asset-view-0166` 资产详情 RA-DEMO-0166；`asset-view-0171` 资产详情 RA-DEMO-0171 |
| 2 填写申请信息 | `info-none` 申请文件与自动接收地址；`info-files` 申请文件已上传；`info-uploading` 申请文件上传中；`info-upload-failed` 申请文件上传失败；`info-file-invalid` 申请文件不符合要求；`info-file-pdf` 申请文件剩余 1 份 · PDF；`info-file-png` 申请文件剩余 1 份 · PNG |
| 3 核对并签名提交 | `confirm` 核对申请；`sign-wait` 等待钱包签名；`sign-cancelled` 取消或拒绝签名；`sign-wrong-address` 钱包地址不是登录地址；`sign-wrong-network` 钱包网络不是 Ethereum；`sign-invalid` 签名未通过核对；`submitting` 签名通过，提交中；`submit-success` 提交成功；`submit-fail` 申请保存失败；`submit-unverified` 提交时认证失效；`submit-upstream` 暂时无法确认提交条件；`submit-duplicate` 同一资产已有申请；`submit-asset-changed` 提交时债权人确权已撤销；`submit-ended` 登录结束且未保存；`confirm-empty` 核对申请（未上传文件）；`sign-wait-empty` 等待签名（无申请文件）；`submitting-empty` 提交中（无申请文件）；`submit-success-empty` 提交成功（无申请文件）；`confirm-file-pdf` 核对申请 · PDF；`confirm-file-png` 核对申请 · PNG；`sign-wait-pdf` 等待钱包签名 · PDF；`submitting-pdf` 签名通过，提交中 · PDF；`submit-success-pdf` 提交成功 · PDF；`sign-wait-png` 等待钱包签名 · PNG；`submitting-png` 签名通过，提交中 · PNG；`submit-success-png` 提交成功 · PNG |
| 申请详情 | `detail-reg` 待分配机构（提交时登录地址接收）；`detail-ops` 运营处理中；`detail-ops-rejected` 运营驳回；`detail-progress` 发行处理中；`detail-minted` 铸造成功；`detail-former-login` 提交后登录地址变更（保留历史接收地址）；`detail-denied` 无权查看或申请不存在；`detail-fail` 详情读取失败；`detail-signature-fail` 签名记录读取失败；`detail-reg-empty` 待分配机构（无申请文件）；`detail-reg-pdf` 待分配机构（提交时登录地址接收） · PDF；`detail-reg-png` 待分配机构（提交时登录地址接收） · PNG |
| 可信资产衔接 | `asset-reference-ready` 可发行；`asset-reference-pending` RA-DEMO-0128 · 发行申请中；`asset-reference-ops` RA-DEMO-0131 · 发行申请中；`asset-reference-progress` RA-DEMO-0143 · 发行申请中；`asset-reference-issued` RA-DEMO-0102 · 已发行；`asset-reference-ops-rejected` RA-DEMO-0160 · 已驳回；`asset-reference-list` 可信资产入口 |
| 相邻页面衔接 | `leave-confirm` 前往资产可信平台：确认 |
| 可信资产直接发起 | `info-from-asset` 固定资产 · 申请文件与自动接收地址；`info-from-asset-files` 固定资产 · 申请文件已上传；`confirm-from-asset` 固定资产 · 核对申请；`confirm-from-asset-empty` 固定资产 · 核对申请（未上传文件）；`info-from-asset-file-pdf` 固定资产 · 申请文件剩余 1 份 · PDF；`confirm-from-asset-file-pdf` 固定资产 · 核对申请 · PDF；`info-from-asset-file-png` 固定资产 · 申请文件剩余 1 份 · PNG；`confirm-from-asset-file-png` 固定资产 · 核对申请 · PNG |
| 发行申请文件 | `application-file-preview` 申请文件预览；`application-file-fail` 申请文件读取失败 |
