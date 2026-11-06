# M3a · 代币发行申请

2026-11-06 · existing-system adaptation / console · English 默认，支持中文。基线：`cly-v6.0.0` 的 M3a 原型及最新 PRD 三册（`4c7d8c5`）。企业、资产、金额、地址、签名、文件和时间均为演示数据。规则、校验与异常分支以 PRD 为准。

## 本轮范围

更新本 issue 的企业申请原型，复用 `_shared/tokens.css`、`components.css`、壳层、分区导航、语言及时区组件。视觉值继承现有原型：主色 `--accent` #1D4ED8，背景 `--bg` #F7F8FB，侧栏 238 px，顶栏 68 px，控件高 44 px，卡片内边距 24 px；不新增 token 或模块样式表。

- 企业发行进度改为紧凑的“企业提交 → 运营处理 → 铸造”，只展示当前阶段和结果，不显示机构分配、处理人员、节点时间、独立操作记录或历史轨迹。共享组件新增显式 `.compact` 变体，其他模块的四阶段展示不受影响。
- 提交成功、列表与所有详情变体统一“运营处理中”；运营通过后为“发行处理中”，运营驳回停在运营处理，铸造成功三阶段完成。保留驳回意见原文及驳回时间、完整铸造结果及铸造时间。
- 确认页保留 1:1 数量、提交后不可撤回或修改、驳回后同一资产不能再申请、历史接收地址固定等关键后果。四项完整签名值可展开核对，明确文件不参与签名，清除旧上链实现说明及字段排除清单。
- 两个发起入口、0 / 1 / 2 份文件、上传阻断、文件冻结与读取失败、完整金额及截断标识、唯一到期时点、签名记录、接收地址变化等画面沿用现有有效内容。保留原画面 ID 与跨模块路由，历史 `detail-reg` ID 现在也展示运营处理中。

## 打开方式

- 仓库联看：双击 [index.html](../../index.html)，选择已认证企业；侧栏、资产和代币入口可跨模块跳转。
- 源页：[代币发行.html](代币发行.html)。
- 离线评审：在 `页面原型/` 执行 `python3 _shared/export.py --source 面客端/M3a-代币发行/代币发行.html --output <仓库外路径>.html`，生成件可双击打开，无需服务。
- 右下角画面目录默认关闭，可查看预设异常及点击“主流程下一屏”；等待钱包、提交中等画面不自动模拟签名成功。单模块附件的跨模块入口给出完整原型提示。

## 覆盖与核验

共 75 个预设画面，清单如下。本轮实改：列表状态、4 个提交成功变体、10 个详情进度概览、确认及文件相关说明；选择资产、认证引导、资产引用详情、钱包与提交异常、导航及壳层继承。所有画面可由默认关闭的目录到达，主流程按钮逐屏跳转；钱包完成与提交结果用目录“主流程下一屏”手动进入，不模拟签名或自动推进。

Chromium 已检查 75 屏 × 中文 / English × 1280 / 1440 / 1920 px（450 组）：画面可达、无脚本异常、无整页横向溢出；10 个详情变体均为三阶段，概览无节点时间，三档宽度下高度小于 200 px。逐项点击目录核验全部 75 屏；定向核验两入口 × 0 / 1 / 2 份文件的 8 条主路径、上传阻断、文件弹窗与重试、驳回意见和时间、铸造结果、仓库联看路由及离线附件。视觉检查使用内部截图，不交付截图。共享组件回归检查 M3b、M4a，未启用紧凑变体的模块保持原展示。

这是静态画面原型，不执行真实上传、下载、权限、业务校验、钱包签名、幂等或链上交易。文件上限、内容鉴别、访问审计和签名有效性等由研发按 PRD 实现，不能据此判定业务 AC 通过。PRD 已登记 M3b 的跨模块同步依赖 SYNC-M3A-01/02，原型按 M3a 的已确认企业口径呈现；真实端到端状态来源和铸造结果待管理端同步后验收。本轮没有新增产品待确认项。

本期不做：企业选取或查看机构、机构审核与材料、监管协议、撤回或修改或重新申请、草稿或批量操作、自选接收地址、自填数量或到期日或合约、交易哈希、非 USD 资产申请，以及铸造后的融资、销毁与解除监管。管理端、M2、M4、M7 业务内容不在本 issue 修订范围。

未验证 Safari / Firefox、1280 px 以下宽度、生产权限与链上数值承载能力。

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
