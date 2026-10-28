/* 非业务登记表。全部为虚构评审数据；接入方、业务规则及消息文案不构成上线登记。
 * 演示消息按各来源模块消息通知册的现行事件生成：登录主干（资产方认证失效）、资金方账户
 * （联系邮箱修改、认证权限暂停）、机构认证审核（通过 / 驳回）、项目合约管理（项目审核通过 / 退回）、
 * 融资需求与代币质押、授信报价与接受拒绝（含链上放款结果）、链上还款。
 * 读取 CF.LS / CF.CQ / CF.L8 的演示事实，本文件不自建业务对象；数据里没有对应事实的事件
 * 另按同一批演示业务补一条样例。账户停用 / 恢复本期不触发，不出样例。 */
(function(CF){
  'use strict';
  const pair=(en,zh)=>({en,zh});
  const D=CF.NCData={
    categories:{
      progress:pair('Business progress','业务办理进度'),
      reminder:pair('Business reminders','业务提醒'),
      account:pair('Account security','账户安全'),
      compliance:pair('Verification & compliance','认证与合规')
    },
    /* 业务类型标识沿来源三段式；目标形态为业务对象 / 本平台静态页面 / 无跳转三选一。 */
    types:{
      'financing.project.review_approved':{mode:'object',kind:'project'},
      'financing.project.review_returned':{mode:'object',kind:'project'},
      'financing.pledge.execution_failed':{mode:'object',kind:'project'},
      'financing.demand.freeze_failed':{mode:'object',kind:'project'},
      'financing.demand.coverage_invalidated':{mode:'object',kind:'project'},
      'financing.project.coverage_shortfall':{mode:'object',kind:'project'},
      'financing.project.coverage_restored':{mode:'object',kind:'project'},
      'financing.project.expiry_reminder':{mode:'object',kind:'project'},
      'financing.quote.submitted':{mode:'object',kind:'quote'},
      'financing.quote.accepted':{mode:'object',kind:'loan'},
      'financing.loan.disbursed':{mode:'object',kind:'loan'},
      'financing.loan.failed':{mode:'object',kind:'quote'},
      'financing.loan.blocked':{mode:'object',kind:'quote'},
      'financing.quote.rejected':{mode:'object',kind:'quote'},
      'financing.repayment.plan_ready':{mode:'object',kind:'repayment'},
      'financing.repayment.due_soon':{mode:'object',kind:'repayment'},
      'financing.repayment.overdue':{mode:'object',kind:'repayment'},
      'financing.repayment.confirmed':{mode:'object',kind:'repayment'},
      'financing.repayment.received':{mode:'object',kind:'repayment'},
      'financing.repayment.failed':{mode:'object',kind:'repayment'},
      'financing.deal.settled':{mode:'object',kind:'repayment'},
      'verification.asset.revoked':{mode:'page',target:'lending:P-L12'},
      'verification.funder.approved':{mode:'page',target:'lending:P-L22'},
      'verification.funder.rejected':{mode:'page',target:'lending:P-L22'},
      'verification.funder.paused':{mode:'page',target:'lending:P-L22'},
      'account.email.changed':{mode:'page',target:'lending:P-L23'},
      /* 演示：来源把打开后去向设为“不跳转”的类型。 */
      'demo.notice.no_target':{mode:'none'}
    },
    templates:{
      /* ---- 项目审核（项目合约管理发送，模板在融资需求与代币质押册维护） */
      'financing.project.review_approved':{
        title:pair('Financing project approved','融资项目审核通过'),
        body:pair('Project {project_name} ({project_id}) was approved at {approved_at}. Pledge contract address: {contract_address}. You can now pledge tokens from the project details. Pledging requires your approval and then your signature, and the gas is payable by you.',
          '项目 {project_name}（{project_id}）已于 {approved_at} 审核通过，质押合约地址 {contract_address}。现在可以在项目详情发起代币质押；质押需要你本人先授权、再签名，gas 自担。')},
      'financing.project.review_returned':{
        title:pair('Financing project returned','融资项目审核退回'),
        body:pair('Project {project_name} ({project_id}) was returned for revision. Reason: {reason}. Update the project details and resubmit. The project term is not restarted and resubmission does not create a new project.',
          '项目 {project_name}（{project_id}）的审核结论为退回。原因：{reason}。请修改创建信息后重新提交；项目期限不会重新起算，重新提交不产生新的项目编号。')},
      /* ---- 链上操作失败：按操作与 gas 事实择一对模板，演示取质押·已产生 / 解押·待核实 / 提取·未产生三种 */
      'financing.pledge.execution_failed:pledge-paid':{
        title:pair('Pledge failed','质押上链失败'),
        body:pair('On-chain pledge {action_id} for token(s) {token_ids} in project {project_name} ({project_id}) failed. Reason: {reason}. This operation incurred gas of {fee_amount} {fee_currency}, payable by the asset originator and not refunded. None of these tokens entered the pledge contract, and none counts toward any amount. Once no reservation remains, you may pledge again subject to current eligibility; existing approvals remain valid, and a new attempt requires a new pledge signature and new gas.',
          '项目 {project_name}（{project_id}）的代币 {token_ids} 本次质押上链 {action_id} 失败。原因：{reason}。本次已产生 gas {fee_amount} {fee_currency}，由资产方承担，不退回。这些代币均未进入质押合约，不计入任何额度；无占用后可按当前资格重新发起，已有授权仍有效，重新发起需要再次签名质押并另付 gas。')},
      'financing.pledge.execution_failed:release-pending':{
        title:pair('Release failed','解押失败'),
        body:pair('Release {action_id} for token(s) {token_ids} in project {project_name} ({project_id}) failed. Reason: {reason}. The actual gas is pending verification; this does not mean none was incurred. Any incurred gas is payable by the asset originator and not refunded. These tokens remain in the project\'s pledge contract; for eligible collateral among them, the provisional deduction has been reversed. You may try again subject to current eligibility; a new attempt requires a new signature.',
          '项目 {project_name}（{project_id}）的代币 {token_ids} 本次解押 {action_id} 失败。原因：{reason}。本次实际 gas 待核实，不代表未产生；如已产生，由资产方承担且不退回。这些代币仍在本项目质押合约内；其中的有效抵押物，本次预扣已撤销。可按当前资格重新发起，需要再次签名。')},
      'financing.pledge.execution_failed:collect-none':{
        title:pair('Collection failed','提取失败'),
        body:pair('Collection {action_id} for token(s) {token_ids} in project {project_name} ({project_id}) failed. Reason: {reason}. No gas was incurred for this operation. These tokens remain released and awaiting collection; this does not restore the project reservation. You may collect again; a new attempt requires a new signature.',
          '项目 {project_name}（{project_id}）的代币 {token_ids} 本次提取 {action_id} 失败。原因：{reason}。本次未产生 gas。这些代币仍为已释放待提取，不恢复项目占用；可重新提取，需要再次签名。')},
      /* ---- 融资需求链上操作失败：发布与改额一对，撤下一对 */
      'financing.demand.freeze_failed':{
        title:pair('Financing request freeze failed','融资需求冻结失败'),
        body:pair('The on-chain freeze {action_id} for {operation} (amount {amount} USDT) in project {project_name} ({project_id}) failed. Reason: {reason}. A new request was not published and nothing was frozen; for an amount change, the request keeps its original amount and freeze. You have not been charged any fees. You may try again subject to current eligibility; a new attempt requires you to sign again.',
          '项目 {project_name}（{project_id}）本次{operation}（金额 {amount} USDT）的冻结上链 {action_id} 失败。原因：{reason}。发布未成立、未冻结；修改金额的，该轮保持原金额与原冻结。你未承担任何费用。可按当前资格重新办理，需要再次签名确认。')},
      'financing.demand.freeze_failed:withdraw':{
        title:pair('Financing request withdrawal not completed','融资需求撤下未完成'),
        body:pair('The on-chain release {action_id} for withdrawing financing request {demand_id} in project {project_name} ({project_id}) failed. Reason: {reason}. The request remains active and is open for offers again; its freeze and amount in progress are unchanged. You have not been charged any fees. To withdraw it, try again subject to current eligibility; a new attempt requires you to sign again.',
          '项目 {project_name}（{project_id}）撤下融资申请 {demand_id} 的解冻上链 {action_id} 失败。原因：{reason}。本轮仍然有效，已恢复为待报价，冻结与在途金额保持不变。你未承担任何费用。如仍需撤下，可按当前资格重新办理，需要再次签名确认。')},
      /* ---- 融资需求终结：自动失效 / 项目到期，按收件角色各一套 */
      'financing.demand.coverage_invalidated':{
        title:pair('Financing request invalidated','融资需求因质押水位不足失效'),
        body:pair('Financing request {demand_id} in project {project_name} ({project_id}) was automatically invalidated because the eligible borrowing limit no longer covered the outstanding principal and amounts in progress. Pending offers for that request were also invalidated. The original record is retained. A new request may be published once current eligibility requirements are met, with no cooldown period.',
          '项目 {project_name}（{project_id}）的融资申请 {demand_id} 已因质押水位不足自动失效，该轮在途报价同时失效。原记录保留；满足当前发布资格后可重新发布新的融资申请，无需等待冷却期。')},
      'financing.demand.coverage_invalidated@fund':{
        title:pair('Financing request for your offer invalidated','报价所属融资需求已失效'),
        body:pair('Financing request {demand_id} in project {project_name} ({project_id}) was automatically invalidated because the eligible borrowing limit no longer covered the outstanding principal and amounts in progress. Your pending offer for that request was also invalidated. Review the original request\'s current outcome; do not continue under that offer.',
          '项目 {project_name}（{project_id}）的融资申请 {demand_id} 已因质押水位不足自动失效，你方在该轮的在途报价同时失效。请查看原申请的当前结果，不要按原报价继续办理。')},
      'financing.demand.coverage_invalidated:expiry':{
        title:pair('Financing request ended at project expiry','融资需求因项目到期终结'),
        body:pair('Project {project_name} ({project_id}) expired at {expires_at}, so financing request {demand_id} has ended. Pending offers for that request were also invalidated. The original record is retained. No new request can be published after expiry; existing business continues under its current status.',
          '项目 {project_name}（{project_id}）已于 {expires_at} 到期，融资申请 {demand_id} 随之终结，该轮在途报价同时失效。原记录保留；到期后不能再发布新的融资申请，存量业务按其当前状态办理。')},
      'financing.demand.coverage_invalidated@fund:expiry':{
        title:pair('Financing request for your offer ended','报价所属融资需求已终结'),
        body:pair('Project {project_name} ({project_id}) expired at {expires_at}, so financing request {demand_id} has ended. Your pending offer for that request was also invalidated. Review the original request\'s current outcome; do not continue under the original offer.',
          '项目 {project_name}（{project_id}）已于 {expires_at} 到期，融资申请 {demand_id} 随之终结，你方在该轮的在途报价同时失效。请查看原申请的当前结果，不要按原报价继续办理。')},
      /* ---- 质押情况与项目提醒 */
      'financing.project.coverage_shortfall':{
        title:pair('Pledge shortfall','项目出现质押不足'),
        body:pair('Project {project_name} ({project_id}) had a pledge shortfall at {occurred_at}. The pledge gap was {shortfall} USD, requiring additional assets valued at {additional_value} USD. Additional pledges count toward the eligible borrowing limit once they are successfully recorded on chain.',
          '项目 {project_name}（{project_id}）于 {occurred_at} 出现质押不足，质押缺口 {shortfall} USD，需追加资产价值 {additional_value} USD。追加质押上链成功即计入有效质押额。')},
      'financing.project.coverage_restored':{
        title:pair('Pledge shortfall resolved','本轮质押不足已解除'),
        body:pair('The current pledge shortfall for project {project_name} ({project_id}) was resolved at {occurred_at}. Check the project\'s current pledge sufficiency. Resolution of this alert does not mean the financing debt has been settled.',
          '项目 {project_name}（{project_id}）的本轮质押不足已于 {occurred_at} 解除。请以项目当前质押情况为准；解除提醒不代表融资债务已结清。')},
      'financing.project.expiry_reminder':{
        title:pair('Project expires in 7 days','项目距有效期届满还有 7 天'),
        body:pair('Project {project_name} ({project_id}) expires at {expires_at}. There were 7 days remaining when this notification was sent. New financing will not be available after expiry; existing business continues under its current status. If no business is still outstanding at expiry, the project ends automatically and its pledged tokens are released for collection.',
          '项目 {project_name}（{project_id}）将于 {expires_at} 届满有效期。通知发出时距离届满还有 7 天；到期后不能新增融资，存量业务仍按其当前状态办理；届时没有未处理完成的业务的，项目将自动终结并整池释放，之后可提取代币。')},
      /* ---- 授信报价与接受拒绝（含链上放款结果） */
      'financing.quote.submitted':{
        title:pair('Financing offer received','收到融资报价'),
        body:pair('{institution_name} submitted an offer for financing request {demand_id}, financing reference {business_id}, with a financing amount of {amount_usdt} USDT. The funds are already approved on-chain, so accepting the offer disburses them to this round\'s receiving address right away. The offer has no expiry date and stays open until you accept or reject it. Review the terms and decide whether to accept and receive the funds or reject. If the underlying financing request ends because the project term expires or the pledge level falls short, this offer lapses with it.',
          '融资申请 {demand_id} 收到 {institution_name} 的报价，融资业务编号 {business_id}，融资金额 {amount_usdt} USDT。报价机构已在链上授权本笔资金，您接受后将立即放款到本轮融资收款地址。该报价没有有效期，在您接受或拒绝之前一直有效；请查看条款并决定接受或拒绝。若所属融资需求因项目到期或质押水位不足而终结，本笔报价将同时失效。')},
      'financing.quote.accepted':{
        title:pair('Financing offer accepted and disbursed','融资报价已接受，已放款'),
        body:pair('Your offer for financing request {demand_id}, financing reference {business_id}, was accepted and disbursed on-chain at {disbursed_at}. Disbursement reference {loan_id}, amount {loan_amount}. The financing is now in repayment; see the repayment record for the formal schedule.',
          '你方对融资申请 {demand_id} 的报价（融资业务编号 {business_id}）已被接受，并于 {disbursed_at} 完成链上放款，放款编号 {loan_id}，放款金额 {loan_amount}。本笔已进入还款中，正式还款计划请在还款信息中查看。')},
      'financing.loan.disbursed':{
        title:pair('Financing disbursed','融资放款已到账'),
        body:pair('The offer from {institution_name} that you accepted for financing request {demand_id}, financing reference {business_id}, was disbursed on-chain at {disbursed_at}. Disbursement reference {loan_id}; {loan_amount} has been sent to this round\'s receiving address. The financing is now in repayment; see the repayment record for the formal schedule.',
          '融资申请 {demand_id} 接受的 {institution_name} 报价（融资业务编号 {business_id}）已于 {disbursed_at} 完成链上放款，放款编号 {loan_id}，{loan_amount} 已转入本轮融资收款地址。本笔已进入还款中，正式还款计划请在还款信息中查看。')},
      'financing.loan.failed':{
        title:pair('Disbursement not completed','融资放款未完成'),
        body:pair('The on-chain disbursement for financing request {demand_id}, financing reference {business_id}, did not complete at {failed_at}. Reason: {fail_reason}. The offer is still awaiting acceptance and the pending allocation is unchanged. The asset side can sign to accept again or reject; if the funder\'s approval or balance needs attention, restore it and let the asset side know.',
          '融资申请 {demand_id} 的报价（融资业务编号 {business_id}）于 {failed_at} 链上放款未完成。原因：{fail_reason}。本笔仍待接受，在途金额不变；资产方可以重新签名接受或拒绝，资金方如需处理授权或余额，请在恢复后告知资产方。')},
      'financing.loan.blocked':{
        title:pair('Acceptance could not proceed','资产方接受未能完成'),
        body:pair('The asset side of financing request {demand_id} tried to accept your offer, financing reference {business_id}, at {blocked_at}, but the disbursement address had {block_reason}. The offer is still awaiting acceptance. Top up the settlement token balance on the disbursement address; the existing approval stays in place and does not need to be renewed. The asset side can then complete acceptance.',
          '融资申请 {demand_id} 的资产方于 {blocked_at} 尝试接受你方报价（融资业务编号 {business_id}），因放款地址{block_reason}未能完成。本笔仍待接受；请补足放款地址上本笔结算币种的余额，授权一直保留、无需重新授权，补足后资产方即可完成接受。')},
      'financing.quote.rejected':{
        title:pair('Financing offer rejected','融资报价已拒绝'),
        body:pair('Your offer for financing request {demand_id}, financing reference {business_id}, was rejected at {rejected_at}. Reason: {reason}. The pending-offer allocation for this offer has been released, and the original offer cannot be reinstated. To withdraw this offer\'s approval of the disbursement contract, revoke it under Approvals in your console. Any new offer is subject to current eligibility.',
          '你方对融资申请 {demand_id} 的报价（融资业务编号 {business_id}）已于 {rejected_at} 被拒绝。原因：{reason}。该笔在途报价金额已释放，原报价不可恢复；如需收回本笔对放款合约的授权，可在我的控制台“链上授权”中撤销授权。后续报价以当前资格为准。')},
      /* ---- 链上还款 */
      'financing.repayment.plan_ready':{
        title:pair('Repayment schedule finalized','还款计划已定稿'),
        body:pair('The repayment schedule for financing request {demand_id}, financing reference {business_id}, disbursement {disbursement_id}, with funder {institution_name}, is finalized. Its finalization time is {finalized_at}. The estimated interest start date was {planned_start_date}; the actual date is {actual_start_date}. The estimated schedule had {planned_count} installments; the finalized schedule has {actual_count}. Review the complete installment comparison below and follow the finalized dates and amounts. No further offer acceptance is required.',
          '融资申请 {demand_id}、融资业务 {business_id}、放款 {disbursement_id}，资金方 {institution_name} 的还款计划已定稿。定稿时点为 {finalized_at}；预计起息日 {planned_start_date}，实际起息日 {actual_start_date}；预计 {planned_count} 期，定稿 {actual_count} 期。完整逐期对照如下，请按定稿日期和金额安排还款；无需再次接受报价。')},
      'financing.repayment.due_soon':{
        title:pair('Repayment reminder','本期还款安排提醒'),
        body:pair('For financing request {demand_id}, financing reference {business_id}, disbursement {disbursement_id}, with funder {institution_name}, installment {installment_no} (installment ID {schedule_id}) is due on {due_date}. The total due is {total_due} USDT, payable as {settlement_amount} {currency}. Repayment opens at {recording_opens_at}; until then the installment is view-only. Keep enough {currency} and gas funds in your paying address. Once repayment opens, use “Approve & repay” to sign the approval first, then sign the repayment transaction. Your enterprise pays gas for both transactions. The installment is settled when the on-chain repayment succeeds.',
          '融资申请 {demand_id}、融资业务 {business_id}、放款 {disbursement_id}，资金方 {institution_name}：第 {installment_no} 期（期次编号 {schedule_id}）应还日为 {due_date}，应还合计 {total_due} USDT，结算金额 {settlement_amount} {currency}。还款从 {recording_opens_at} 开放，此前仅可查看、不能还款。请在出账地址上准备足够的 {currency} 及 gas，开放后通过“授权并还款”先完成授权签名，再进行交易签名；两笔 gas 由你方承担，链上还款成功即本期结清。')},
      'financing.repayment.overdue':{
        title:pair('Repayment overdue','本期还款已逾期'),
        body:pair('For financing request {demand_id}, financing reference {business_id}, disbursement {disbursement_id}, with funder {institution_name}, installment {installment_no} (installment ID {schedule_id}) was due on {due_date}. It had not been repaid as of {overdue_as_of} and was {overdue_days} days overdue. The total due is {total_due} USDT, payable as {settlement_amount} {currency}. Use “Approve & repay” to sign the approval first, then sign the repayment transaction. The overdue day count freezes only when the repayment transaction is sent, not when approval succeeds. Your enterprise pays gas for both transactions. The installment is settled once the on-chain repayment succeeds. No penalty interest is added.',
          '融资申请 {demand_id}、融资业务 {business_id}、放款 {disbursement_id}，资金方 {institution_name}：第 {installment_no} 期（期次编号 {schedule_id}）应还日为 {due_date}，截至 {overdue_as_of} 尚未完成还款，已逾期 {overdue_days} 天。应还合计 {total_due} USDT，结算金额 {settlement_amount} {currency}。请通过“授权并还款”先完成授权签名，再进行交易签名；还款交易发出才冻结本期逾期天数，授权成功不冻结。两笔 gas 由你方承担，链上还款成功后本期结清。本期不增加罚息。')},
      'financing.repayment.overdue@fund':{
        title:pair('Repayment overdue','本期尚未还款，已逾期'),
        body:pair('For your institution {institution_name}, financing request {demand_id}, financing reference {business_id}, disbursement {disbursement_id}, installment {installment_no} (installment ID {schedule_id}) was due on {due_date}. The asset holder had not repaid it as of {overdue_as_of}, and it was {overdue_days} days overdue. The total due is {total_due} USDT, payable as {settlement_amount} {currency}. Review this installment\'s repayment information. No action is needed from you; once the asset holder\'s repayment succeeds on-chain, the funds go directly to your repayment address. No penalty interest is added.',
          '你方机构 {institution_name} 的融资申请 {demand_id}、融资业务 {business_id}、放款 {disbursement_id}，第 {installment_no} 期（期次编号 {schedule_id}）应还日为 {due_date}，截至 {overdue_as_of} 资产方尚未完成还款，已逾期 {overdue_days} 天。应还合计 {total_due} USDT，结算金额 {settlement_amount} {currency}。请查看该期履约信息；你方无需办理，资产方还款上链成功后款项将直接转入你方还款收款地址。本期不增加罚息。')},
      'financing.repayment.confirmed':{
        title:pair('Installment repaid','本期还款已完成'),
        body:pair('Installment {installment_no} (installment ID {schedule_id}) for financing request {demand_id}, financing reference {business_id}, disbursement {disbursement_id}, was repaid on-chain at {repaid_at}. {repaid_amount} {currency} was sent to the repayment address of funder {institution_name}, and the installment is settled; no acknowledgment from the funder is needed. Other installments remain unsettled for this financing. Review the finalized repayment schedule. This notice does not mean the project\'s collateral has been released.',
          '融资申请 {demand_id}、融资业务 {business_id}、放款 {disbursement_id}，第 {installment_no} 期（期次编号 {schedule_id}）已于 {repaid_at} 完成链上还款，{repaid_amount} {currency} 已转入资金方 {institution_name} 的还款收款地址，该期已结清，无需资金方确认。本笔业务仍有其他未结清期次，请查看正式还款安排；本通知不表示项目质押已释放。')},
      'financing.repayment.received':{
        title:pair('Installment repayment received','本期还款已到账'),
        body:pair('For your institution {institution_name}, financing request {demand_id}, financing reference {business_id}, disbursement {disbursement_id}, {repaid_amount} {currency} for installment {installment_no} (installment ID {schedule_id}, due on {due_date}) was repaid on-chain to your repayment address at {repaid_at}. The installment is settled, and no acknowledgment is needed from you. Other installments remain unsettled for this financing.',
          '你方机构 {institution_name} 的融资申请 {demand_id}、融资业务 {business_id}、放款 {disbursement_id}，第 {installment_no} 期（期次编号 {schedule_id}，应还日 {due_date}）的 {repaid_amount} {currency} 已于 {repaid_at} 经链上还款转入你方还款收款地址，该期已结清，你方无需确认。本笔业务仍有其他未结清期次。')},
      /* 本期还款未完成：按本期是否已逾期在正文末尾取一句。 */
      'financing.repayment.failed':{
        title:pair('Installment repayment not completed','本期还款未完成'),
        body:pair('For financing request {demand_id}, financing reference {business_id}, disbursement {disbursement_id}, with funder {institution_name}, the repayment of installment {installment_no} (installment ID {schedule_id}, due on {due_date}) was not completed. No funds were sent, and the installment is still due. Reason: {failure_reason}. The total due is {total_due} USDT, payable as {settlement_amount} {currency}. Check the repayment balance and gas funds of your paying address, then use “Approve & repay” again: sign the approval first, then the repayment transaction. Your enterprise pays gas for both; gas already spent is not refunded. If the approval was recorded on-chain, it remains in place; you can revoke it in your wallet. Please repay by the due date.',
          '融资申请 {demand_id}、融资业务 {business_id}、放款 {disbursement_id}，资金方 {institution_name}：第 {installment_no} 期（期次编号 {schedule_id}，应还日 {due_date}）的还款未能完成，款项没有转出，本期仍待还款。原因：{failure_reason}。应还合计 {total_due} USDT，结算金额 {settlement_amount} {currency}，请确认出账地址的还款余额与 gas 后重新授权并还款，先授权签名、再交易签名，两笔 gas 由你方承担，已产生的不退。若授权已上链，它仍保留在链上，可在钱包中自行撤销。请在应还日内完成还款。')},
      'financing.repayment.failed:overdue':{
        title:pair('Installment repayment not completed','本期还款未完成'),
        body:pair('For financing request {demand_id}, financing reference {business_id}, disbursement {disbursement_id}, with funder {institution_name}, the repayment of installment {installment_no} (installment ID {schedule_id}, due on {due_date}) was not completed. No funds were sent, and the installment is still due. Reason: {failure_reason}. The total due is {total_due} USDT, payable as {settlement_amount} {currency}. Check the repayment balance and gas funds of your paying address, then use “Approve & repay” again: sign the approval first, then the repayment transaction. Your enterprise pays gas for both; gas already spent is not refunded. If the approval was recorded on-chain, it remains in place; you can revoke it in your wallet. As of {overdue_as_of}, this installment was {overdue_days} days overdue; the count freezes only after you sign and send the repayment transaction again.',
          '融资申请 {demand_id}、融资业务 {business_id}、放款 {disbursement_id}，资金方 {institution_name}：第 {installment_no} 期（期次编号 {schedule_id}，应还日 {due_date}）的还款未能完成，款项没有转出，本期仍待还款。原因：{failure_reason}。应还合计 {total_due} USDT，结算金额 {settlement_amount} {currency}，请确认出账地址的还款余额与 gas 后重新授权并还款，先授权签名、再交易签名，两笔 gas 由你方承担，已产生的不退。若授权已上链，它仍保留在链上，可在钱包中自行撤销。截至 {overdue_as_of} 本期已逾期 {overdue_days} 天，重新完成还款交易签名并发出交易后才会冻结逾期天数。')},
      'financing.deal.settled':{
        title:pair('Financing fully settled','本笔融资业务已结清'),
        body:pair('Installment {installment_no} (installment ID {schedule_id}) for financing request {demand_id}, financing reference {business_id}, disbursement {disbursement_id}, was repaid on-chain at {repaid_at}, and {repaid_amount} {currency} was sent to the repayment address of funder {institution_name}. All installments are settled, and this financing was fully settled at {settled_at}. Its outstanding principal and associated principal allocations are now zero. Review the project\'s collateral status: settlement of one financing does not directly release project collateral. Business release occurs when the project meets its closure or settlement conditions. Released tokens still awaiting withdrawal must be withdrawn using “Release collateral — Withdraw released tokens”; you pay the gas fee. Tokens do not return to your wallet automatically.',
          '融资申请 {demand_id}、融资业务 {business_id}、放款 {disbursement_id}，第 {installment_no} 期（期次编号 {schedule_id}）已于 {repaid_at} 完成链上还款，{repaid_amount} {currency} 已转入资金方 {institution_name} 的还款收款地址；全部期次已结清，本笔业务于 {settled_at} 结清。本笔未偿本金及对应本金占用已归零。请查看本项目质押状态：单笔业务结清不直接释放项目质押；项目满足关闭或结清条件后业务释放，已释放且仍待提取的代币需从“解除质押—提取已释放”入口自行提取并自付 gas，不会自动回到钱包。')},
      'financing.deal.settled@fund':{
        title:pair('Financing fully settled','本笔融资业务已结清'),
        body:pair('For your institution {institution_name}, financing request {demand_id}, financing reference {business_id}, disbursement {disbursement_id}, {repaid_amount} {currency} for installment {installment_no} (installment ID {schedule_id}) was repaid on-chain to your repayment address at {repaid_at}. All installments are settled, and this financing was fully settled at {settled_at}. Its outstanding principal and associated project financing balance and credit allocation are now zero; allocations for other financing are unaffected. Review this result and the project\'s collateral status. Business release requires the project to meet its closure or settlement conditions. The asset holder must still withdraw released tokens using “Release collateral — Withdraw released tokens” and pay the gas fee; release does not mean the tokens have returned to the wallet.',
          '你方机构 {institution_name} 的融资申请 {demand_id}、融资业务 {business_id}、放款 {disbursement_id}，第 {installment_no} 期（期次编号 {schedule_id}）的 {repaid_amount} {currency} 已于 {repaid_at} 经链上还款转入你方还款收款地址；全部期次已结清，本笔业务于 {settled_at} 结清。本笔未偿本金及对应项目融资余额、授信占用额已归零，不代表其他业务占用归零。请查看本笔结果及项目质押状态；项目业务释放须满足项目关闭或结清条件，已释放代币仍需资产方从“解除质押—提取已释放”入口自行提取并自付 gas，不代表已回到钱包。')},
      /* ---- 认证与账户 */
      'verification.asset.revoked':{
        title:pair('Verification status changed','实名认证状态已变更'),
        body:pair('Your verification status changed. At the time of this change, access to submitting financing applications became unavailable. You can still browse the platform. Visit the Asset Trust Platform to check your current verification status.',
          '你的实名认证状态已变更，本次变更使发起融资申请权限暂不可用。你仍可浏览平台。请前往资产可信平台查看当前认证状态。')},
      'verification.funder.approved':{
        title:pair('Institution verification approved','机构认证审核通过'),
        body:pair('The institution details submitted for application {application_number} at {submitted_time} were approved at {reviewed_time}. View the record of this review. Your current verification status and available actions are shown on the verification results page.',
          '申请 {application_number} 于 {submitted_time} 提交的机构认证资料，已于 {reviewed_time} 审核通过。请查看本次审核记录；当前认证状态及可办理业务以认证结果页为准。')},
      'verification.funder.rejected':{
        title:pair('Institution verification rejected','机构认证审核未通过'),
        body:pair('The institution details submitted for application {application_number} at {submitted_time} were rejected at {reviewed_time}. View the reason for this review and your current application status. If the application is still rejected, you can update the details and submit again.',
          '申请 {application_number} 于 {submitted_time} 提交的机构认证资料，已于 {reviewed_time} 审核驳回。请查看本次驳回原因及当前申请状态；如当前仍为已驳回，可修改资料后重新提交。')},
      'verification.funder.paused':{
        title:pair('Changes submitted; verified access paused','资料变更已提交，认证业务权限暂不可用'),
        body:pair('Information changes for application {application_number} were successfully submitted at {submitted_time}. This submission paused access to business actions that require institution verification. View the current review status and the corresponding submission record.',
          '申请 {application_number} 的资料变更已于 {submitted_time} 成功提交。本次提交使需要机构认证的业务权限暂不可用。请查看当前审核状态及对应提交记录。')},
      'account.email.changed':{
        title:pair('Contact email changed','联系邮箱已修改'),
        body:pair('Your account contact email was changed. View the current email in User information. If you did not make this change, email our support team at {support_email}.',
          '你的账户联系邮箱已修改。请在用户信息查看当前邮箱。如非本人操作，请发送邮件至平台客服邮箱 {support_email} 反馈。')},
      /* ---- 评审夹具：业务类型尚未登记落点，正文照常可读、计未读，只是没有业务跳转动作。 */
      'financing.settlement.netting_prepared':{
        title:pair('Settlement netting record available','收到一条结算净额记录'),
        body:pair('A settlement netting record was created for project {project_name} ({project_id}). Review the record in the project details.',
          '项目 {project_name}（{project_id}）已生成一条结算净额记录。请在项目详情查看该记录。')},
      'demo.notice.no_target':{
        title:pair('Demonstration notice','演示告知'),
        body:pair('This demonstration message has no linked page.','这是一条没有关联页面的演示消息。')},
      /* 增量接入演示：零改框架接入一个本模块此前没有的虚构业务类型。 */
      'demo.extension.received':{
        title:pair('New demonstration message {reference}','新增演示消息 {reference}'),
        body:pair('This record is ready for you to review.','这条记录已准备好供你查阅。')}
    },
    rows:[]
  };

  /* ---------------------------------------------------------- 取值与工具 */
  const D5=()=>CF.LS,Q=()=>CF.CQ,DAY=86400000,H=3600000;
  const iso=n=>new Date(n).toISOString();
  const day=s=>String(s).slice(0,10);
  const money=n=>Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  const fundName=id=>id==='fund-b'?pair('Demo Capital B','演示资金机构 B'):pair('Demo Capital A','演示资金机构 A');
  const now=()=>CF.L8?.now||CF.LS?.now?.()||Date.now();
  const at=v=>typeof v==='number'?iso(v):v;
  let serial=0;
  function push(row){
    row.platform=row.platform||'lending';row.end='asset';
    row.id=row.id||('nc-'+row.owner+'-'+(++serial));
    row.fact=row.fact||[row.owner,row.biz,row.objectId||'',row.period||'',row.at].join('|');
    D.rows.push(row);
    return row;
  }
  /* 来源提供的原业务名称与编号；本期没有来源发送办理进度节点或步序。 */
  const business=(name,number)=>({name,number});

  /* ---------------------------------------------------------- 项目、需求与质押 */
  function seedProjects(){
    const d=D5(),q=Q(),own=d.projects.filter(p=>p.owner==='entity-demo-a');
    const tick=n=>iso(now()-n*9*H),pv=p=>({project_name:p.name,project_id:p.id});
    const fundOn=p=>q.data().quotes.some(x=>x.project===p.id&&x.fund==='fund-a'&&x.l7&&!x.l8?.settledAt);
    own.forEach((p,pi)=>{
      const vars=pv(p);
      if(pi===1)push({owner:'asset',biz:'financing.project.review_returned',category:'progress',objectKind:'project',objectId:p.id,
        at:tick(226+pi*6),vars:{...vars,reason:pair('The pledge rate in the project details exceeds the rate registered for this token type.','创建信息中的质押率超过该代币类型的登记上限。')},
        business:business(p.name,p.id)});
      if(p.contract)push({owner:'asset',biz:'financing.project.review_approved',category:'progress',objectKind:'project',objectId:p.id,
        at:tick(220+pi*6),vars:{...vars,approved_at:tick(220+pi*6),contract_address:p.contract},
        business:business(p.name,p.id)});
      /* 链上操作失败：每笔交易一条，列出本笔涉及的全部代币。 */
      if(pi===2)[['pledge-paid','A',pair('The pledge contract rejected this on-chain pledge','质押合约拒绝了本次质押上链交易'),{fee_amount:'0.0041',fee_currency:'ETH'},2],
        ['release-pending','B',pair('The release transaction was not confirmed on chain','本次解押交易未在链上确认'),{},1],
        ['collect-none','C',pair('The chain returned a definitive failure for this collection','链上对本次提取返回了确定的失败结果'),{},1]].forEach(([tpl,tag,reason,fee,n],i)=>{
        const action='EX-DEMO-'+p.id.slice(-3)+'-'+tag,ids=Array.from({length:n},(_,k)=>'TK-DEMO-'+(pi+1)+'-'+(i+k+1));
        push({owner:'asset',biz:'financing.pledge.execution_failed',tpl:'financing.pledge.execution_failed:'+tpl,category:'progress',objectKind:'project',objectId:p.id,
          at:tick(126+i*4),vars:{...vars,token_ids:pair(ids.join(', '),ids.join('、')),action_id:action,reason,...fee},
          business:business(p.name,action)});
      });
      /* 需求终结：资产方各收一条；有在途报价的资金方由报价侧生成。 */
      p.demands.filter(x=>x.state==='ended').forEach(x=>{
        const expiry=x.reason==='expiry';
        push({owner:'asset',biz:'financing.demand.coverage_invalidated',tpl:expiry?'financing.demand.coverage_invalidated:expiry':'',category:'progress',
          objectKind:'project',objectId:p.id,at:x.endedAt||(expiry?p.expires:tick(60)),vars:{...vars,demand_id:x.id,expires_at:p.expires},business:business(p.name,x.id)});
      });
      /* 届满前 7 天的提醒节点已经过去才存在这条消息，不预生成未来事件。 */
      if(p.expires&&Date.parse(p.expires)-7*DAY<=now())
        push({owner:'asset',biz:'financing.project.expiry_reminder',category:'reminder',objectKind:'project',objectId:p.id,
          at:iso(Date.parse(p.expires)-7*DAY),vars:{...vars,expires_at:p.expires},business:business(p.name,p.id)});
    });
    /* 项目到期使当前轮终结：演示数据里没有这一事实时，在一个已到期的项目上补一对样例。 */
    if(!own.some(p=>p.demands.some(x=>x.state==='ended'&&x.reason==='expiry'))){
      const p=own.find(p=>p.expires&&Date.parse(p.expires)<=now()&&!p.demands.length);
      if(p)['asset','fund'].forEach(who=>push({owner:who,biz:who==='fund'?'financing.demand.coverage_invalidated@fund':'financing.demand.coverage_invalidated',
        tpl:who==='fund'?'financing.demand.coverage_invalidated@fund:expiry':'financing.demand.coverage_invalidated:expiry',category:'progress',
        objectKind:'project',objectId:p.id,at:p.expires,vars:{...pv(p),demand_id:p.id+'-01',expires_at:p.expires},business:business(p.name,p.id+'-01')}));
    }
    /* 融资需求链上操作失败：发布失败定位到项目，撤下失败定位到原申请。 */
    const openRound=own.filter(p=>p.demands.some(x=>x.state==='open'));
    const pub=openRound.find(p=>p.id==='FP-MC-010')||openRound[0],wd=openRound.find(p=>p.id==='FP-MC-011')||openRound[1];
    if(pub){const x=pub.demands.find(x=>x.state==='open'),t=Date.parse(x.at||pub.published||tick(40))-2*H;
      push({owner:'asset',biz:'financing.demand.freeze_failed',category:'progress',objectKind:'project',objectId:pub.id,at:iso(t),
        vars:{...pv(pub),operation:pair('publishing a financing request','发布融资需求'),amount:money(x.amount),action_id:'FZ-DEMO-'+pub.id.slice(-3)+'-A',
          reason:pair('The freeze transaction was reverted on chain','冻结交易在链上被回退')},business:business(pub.name,pub.id)});}
    if(wd&&wd!==pub){const x=wd.demands.find(x=>x.state==='open');
      push({owner:'asset',biz:'financing.demand.freeze_failed',tpl:'financing.demand.freeze_failed:withdraw',category:'progress',objectKind:'project',objectId:wd.id,at:tick(30),
        vars:{...pv(wd),demand_id:x.id,action_id:'FZ-DEMO-'+wd.id.slice(-3)+'-W',reason:pair('The release transaction was reverted on chain','解冻交易在链上被回退')},
        business:business(wd.name,x.id)});}
    /* 质押不足与解除：资产方与该项目有未结清业务的资金方各收一条，发生时间相同。 */
    own.filter(p=>p.balance>0).forEach((p,i)=>{
      if(i%2)return;
      const t=now()-(70+i*9)*9*H,shortfall=45000+i*5000,who=['asset'].concat(fundOn(p)?['fund']:[]);
      who.forEach(o=>push({owner:o,biz:'financing.project.coverage_shortfall',category:'reminder',objectKind:'project',objectId:p.id,
        at:iso(t),vars:{...pv(p),occurred_at:iso(t),shortfall:money(shortfall),additional_value:money(shortfall*1.25)},business:business(p.name,p.id)}));
      if(i%4===0)who.forEach(o=>push({owner:o,biz:'financing.project.coverage_restored',category:'reminder',objectKind:'project',objectId:p.id,
        at:iso(t+30*H),vars:{...pv(p),occurred_at:iso(t+30*H)},business:business(p.name,p.id)}));
    });
  }

  /* ---------------------------------------------------------- 报价、链上放款与还款 */
  function seedDeals(){
    const d=D5(),q=Q(),quotes=q.data().quotes;
    let gapShown=false;
    quotes.forEach(x=>{
      const p=d.project(x.project),inst=fundName(x.fund),plan=x.l8,loan=x.l7?.record?x.l7:null;
      if(!p)return;
      const mine=x.owner==='entity-demo-a',ours=x.fund==='fund-a',ids={demand_id:x.demand,business_id:x.id};
      const quoteRow=(owner,biz,t,vars,extra)=>push({owner,biz,category:'progress',objectKind:'quote',objectId:x.id,objectProject:x.project,at:at(t),vars:{...ids,...vars},business:business(p.name,x.id),...extra});
      /* 收到融资报价：报价上链成功进入待接受即发，之后的接受、拒绝或失效不撤回。 */
      if(mine&&['waiting','funding','funded','rejected','expired'].includes(x.state))
        quoteRow('asset','financing.quote.submitted',x.at,{institution_name:inst,amount_usdt:money(x.amount)},{act:true});
      if(ours&&x.state==='rejected')
        quoteRow('fund','financing.quote.rejected',x.done||x.at,{rejected_at:at(x.done||x.at),reason:x.reason||pair('Terms do not match current needs','融资条款不符合当前需求')});
      if(ours&&x.state==='expired')
        push({owner:'fund',biz:'financing.demand.coverage_invalidated@fund',tpl:x.reason==='expiry'?'financing.demand.coverage_invalidated@fund:expiry':'',category:'progress',objectKind:'project',objectId:x.project,
          at:at(x.done||x.at),vars:{project_name:p.name,project_id:p.id,demand_id:x.demand,expires_at:p.expires},business:business(p.name,x.demand)});
      /* 链上放款失败：资产方与资金方各一条；本笔仍待接受。 */
      if(x.chain?.state==='failed')['asset','fund'].forEach(o=>(o==='asset'?mine:ours)&&quoteRow(o,'financing.loan.failed',x.chain.at,
        {failed_at:at(x.chain.at),fail_reason:x.chain.reason?pair(...x.chain.reason.map(t=>String(t).replace(/[.。]\s*$/,''))):pair('The disbursement did not complete on chain','链上放款未完成')},o==='asset'?{act:true}:{}));
      /* 链上放款成功：资金方收“已接受，已放款”，资产方收“放款已到账”。 */
      if(loan){
        const lv={loan_id:loan.record.id,loan_amount:money(loan.settlement||loan.amount)+' '+loan.ccy,disbursed_at:loan.record.at};
        const loanRow=(owner,biz,vars)=>push({owner,biz,category:'progress',objectKind:'loan',objectId:x.id,objectProject:x.project,at:loan.record.at,vars:{...ids,...lv,...vars},business:business(p.name,loan.record.id)});
        if(mine)loanRow('asset','financing.loan.disbursed',{institution_name:inst});
        if(ours)loanRow('fund','financing.quote.accepted',{});
      }
      if(!plan||!loan)return;
      const base={...ids,disbursement_id:loan.record.id,institution_name:inst};
      const repRow=(owner,biz,pd,t,vars,tpl)=>push({owner,biz,tpl:tpl||'',category:/due_soon|overdue/.test(biz)?'reminder':'progress',objectKind:'repayment',objectId:x.id,objectProject:x.project,period:pd&&pd.id,
        at:at(t),vars:{...base,...vars},business:business(p.name,pd?pd.id:x.id)});
      /* 计划定稿只发资产方。预计起息日按报价时点估算；其中一笔保留两者相差一个季度的情形，用于呈现只有一侧有条目的对照行。 */
      if(mine){
        const gap=!gapShown&&plan.periods.length>=3&&(gapShown=true);
        const plannedStart=gap?day(iso(Date.parse(plan.start)-92*DAY)):day(iso(x.at));
        let planned=[];try{planned=CF.L8.build(plannedStart,day(x.repay),x.amount,x.rate,1)||[];}catch(e){planned=[];}
        const row=repRow('asset','financing.repayment.plan_ready',null,plan.at,{finalized_at:plan.at,planned_start_date:plannedStart,actual_start_date:plan.start,
          planned_count:planned.length||plan.periods.length,actual_count:plan.periods.length});
        row.installments={ccy:loan.ccy,planned:planned.map(r=>({seq:r.seq,due:r.due,total:r.total,settlement:r.settlement})),
          actual:plan.periods.map(r=>({seq:r.seq,due:r.due,total:r.total,settlement:r.settlement,id:r.id}))};
      }
      let failShown=false;
      plan.periods.forEach(pd=>{
        const ref={installment_no:pd.seq,schedule_id:pd.id,due_date:pd.due,total_due:money(pd.total),settlement_amount:money(pd.settlement),currency:loan.ccy};
        const dueAt=Date.parse(pd.due+'T00:00:00Z'),overAt=dueAt+DAY;
        if(mine&&pd.state==='due'&&dueAt-3*DAY<=now())
          repRow('asset','financing.repayment.due_soon',pd,dueAt-3*DAY,{...ref,recording_opens_at:iso(dueAt)});
        /* 逾期每期只发一次，天数取发信时点已成立的天数，之后不改写。 */
        if(pd.state==='due'&&overAt<=now()){
          if(mine)repRow('asset','financing.repayment.overdue',pd,overAt,{...ref,overdue_as_of:iso(overAt),overdue_days:1});
          if(ours)repRow('fund','financing.repayment.overdue@fund',pd,overAt,{...ref,overdue_as_of:iso(overAt),overdue_days:1});
          /* 本期还款未完成：演示在第一笔逾期期次上补一次还款交易失败。 */
          const failAt=now()-20*H;
          if(mine&&!failShown&&failAt>overAt){failShown=true;
            const days=Math.floor((Date.parse(day(iso(failAt)))-dueAt)/DAY);
            repRow('asset','financing.repayment.failed',pd,failAt,{...ref,overdue_as_of:iso(failAt),overdue_days:days,
              failure_reason:pair('The paying address balance was no longer sufficient','出账地址余额已不足')},'financing.repayment.failed:overdue');}
        }
        if(pd.state==='settled'&&pd.record){
          const t=pd.record.confirmedAt||pd.record.at,last=plan.settledAt&&pd.seq===plan.periods.length;
          const paid={...ref,repaid_at:t,repaid_amount:money(pd.record.amount||pd.settlement),currency:pd.record.ccy||loan.ccy,settled_at:plan.settledAt||t};
          /* 末期使整笔结清时双方各只收一封“已结清”，不再另收单期消息。 */
          if(mine)repRow('asset',last?'financing.deal.settled':'financing.repayment.confirmed',pd,t,paid);
          if(ours)repRow('fund',last?'financing.deal.settled@fund':'financing.repayment.received',pd,t,paid);
        }
      });
    });
    /* 演示数据里没有链上放款失败与接受被拦下的事实时，在待接受报价上各补一条样例。 */
    const waiting=quotes.filter(x=>x.state==='waiting'&&x.fund==='fund-a'&&x.owner==='entity-demo-a'&&d.project(x.project));
    const sample=(x,owner,biz,t,vars,extra)=>{const p=d.project(x.project);push({owner,biz,category:'progress',objectKind:'quote',objectId:x.id,objectProject:x.project,
      at:iso(t),vars:{demand_id:x.demand,business_id:x.id,...vars},business:business(p.name,x.id),...extra});};
    if(!quotes.some(x=>x.chain?.state==='failed')){
      const x=waiting.find(x=>x.id==='FB-MC-0012')||waiting[0];
      if(x){const t=Math.min(x.at+4*H,now()-H);
        ['asset','fund'].forEach(o=>sample(x,o,'financing.loan.failed',t,{failed_at:iso(t),
          fail_reason:pair('The funder\'s authorization or balance no longer covers this settlement amount','资金方放款地址的授权或余额已不足以支付本笔结算金额')},o==='asset'?{act:true}:{}));}
    }
    const blocked=waiting.find(x=>x.id==='FB-MC-0001')||waiting.find(x=>x.id!=='FB-MC-0012');
    if(blocked){const t=Math.min(blocked.at+6*H,now()-2*H);
      sample(blocked,'fund','financing.loan.blocked',t,{blocked_at:iso(t),block_reason:pair('insufficient balance','余额不足')});}
  }

  /* ---------------------------------------------------------- 认证与账户 */
  function seedAccounts(){
    push({owner:'asset',biz:'verification.asset.revoked',category:'compliance',at:iso(now()-5*DAY),vars:{}});
    const submitted=iso(now()-9*DAY),reviewed=iso(now()-8*DAY);
    push({owner:'fund',biz:'verification.funder.approved',category:'compliance',at:reviewed,
      vars:{application_number:'FA-DEMO-0007',submitted_time:submitted,reviewed_time:reviewed}});
    push({owner:'fund',biz:'verification.funder.rejected',category:'compliance',at:iso(now()-21*DAY),
      vars:{application_number:'FA-DEMO-0006',submitted_time:iso(now()-23*DAY),reviewed_time:iso(now()-21*DAY)}});
    push({owner:'fund',biz:'verification.funder.paused',category:'compliance',at:iso(now()-24*DAY),
      vars:{application_number:'FA-DEMO-0006',submitted_time:iso(now()-24*DAY)}});
    push({owner:'fund',biz:'account.email.changed',category:'account',at:iso(now()-4*DAY),vars:{support_email:CF.funder?.support?.email||''}});
  }

  /* -------------------------------------------- 降级与隔离夹具（评审用） */
  function seedFixtures(){
    const base=D.rows.find(r=>r.owner==='asset'&&r.business)||D.rows[0];
    if(!base)return;
    const at=n=>iso(now()-n*H);
    push({...base,id:'nc-fixture-expired',at:at(120),read:false,expires:'2026-01-01T00:00:00Z'});
    push({...base,id:'nc-fixture-missing-template',biz:'financing.unknown.event',category:'progress',at:at(121),read:false,missing:true,business:null});
    push({...base,id:'nc-fixture-zh-only',at:at(122),read:false,onlyZh:true});
    push({...base,id:'nc-fixture-unregistered-type',biz:'financing.settlement.netting_prepared',category:'progress',at:at(123),read:false});
    push({...base,id:'nc-fixture-unregistered-category',category:'treasury',at:at(124),read:false});
    push({...base,id:'nc-fixture-plain-text',at:at(125),read:false,
      literal:'<script>alert("demo")</script>\nPlain text <b>only</b> / 仅作为纯文本展示'});
    push({...base,id:'nc-fixture-no-reference',at:at(127),read:false,business:{...base.business,number:null}});
    push({...base,id:'nc-fixture-denied-target',at:at(128),read:false,check:'denied'});
    push({...base,id:'nc-fixture-timeout-target',at:at(129),read:false,check:'timeout'});
    push({...base,id:'nc-fixture-no-target',biz:'demo.notice.no_target',category:'account',at:at(130),read:false,
      objectKind:null,objectId:null,objectProject:null,period:null,vars:{},business:null});
    /* 不属于本池：错端与他人消息不可见、不计未读、不可深链。 */
    D.rows.push({...base,id:'nc-fixture-foreign-platform',platform:'token'});
    D.rows.push({...base,id:'nc-fixture-other-member',owner:'other-member'});
  }

  /* 底座样板只装载壳层与本模块，没有借贷业务适配器；此时给一份自包含演示池，
     沿用同一批现行事件类型，但不提供业务跳转落点。 */
  function seedStandalone(){
    const project=pair('Demonstration project','演示项目');
    const cases=[
      ['financing.project.review_approved','progress',i=>({project_name:project,project_id:'FP-DEMO-'+i,approved_at:iso(now()-i*H),contract_address:'0x'+String(i).padStart(40,'0')})],
      ['financing.quote.submitted','progress',i=>({demand_id:'FP-DEMO-'+i+'-01',business_id:'FB-DEMO-'+i,institution_name:fundName('fund-a'),amount_usdt:money(240000+i*1000)})],
      ['financing.project.coverage_shortfall','reminder',i=>({project_name:project,project_id:'FP-DEMO-'+i,occurred_at:iso(now()-i*H),shortfall:money(40000+i*500),additional_value:money(50000+i*625)})],
      ['verification.asset.revoked','compliance',()=>({})]
    ];
    for(let i=1;i<=8;i++)cases.forEach(([biz,category,vars],k)=>push({
      owner:'asset',biz,category,at:iso(now()-((i-1)*cases.length+k)*3*H),vars:vars(i),
      business:category==='compliance'?null:business(project,'FB-DEMO-'+i)}));
  }
  let seeded=false;
  D.ensure=function(){
    if(seeded)return D;
    seeded=true;
    /* 各来源分开播种：某一来源的演示事实缺失时只少那一组消息，不阻断页面。 */
    const safe=fn=>{try{fn();}catch(e){}};
    if(CF.LS&&CF.CQ&&CF.L8){safe(seedProjects);safe(seedDeals);safe(seedAccounts);}else safe(seedStandalone);
    safe(seedFixtures);
    /* 消息记录已经发生的事实：演示池不保留发生时点还没到的条目。 */
    const until=now();
    D.rows=D.rows.filter(r=>!Number.isFinite(Date.parse(r.at))||Date.parse(r.at)<=until);
    /* 每 7 条留 1 条已读，其余未读；本地已读记录载入后覆盖该初值。 */
    D.rows.forEach((r,i)=>{if(r.read===undefined)r.read=i%7===6;});
    /* 列表按消息创建时间从新到旧；at 是业务发生时间，只用于展示。预置消息按发生即送达处理，创建时间取发生时间。 */
    D.rows.forEach(r=>{if(!r.created)r.created=r.at;});
    D.rows.sort((a,b)=>String(b.created).localeCompare(String(a.created)));
    return D;
  };
  /* 演示投递：同一收件人的同一事实只保留一条，新事实追加为未读。 */
  D.deliver=function(row){
    D.ensure();
    const fact=[row.owner,row.biz,row.objectId||'',row.period||'',row.at].join('|');
    const same=D.rows.find(r=>r.fact===fact);
    if(same)return {added:false,row:same};
    const fresh={...row,created:row.created||new Date().toISOString(),id:'nc-'+row.owner+'-live-'+(++serial),fact,read:false};
    D.rows.unshift(fresh);
    return {added:true,row:fresh};
  };
  D.addType=function(){
    D.ensure();
    D.categories.newdemo=pair('New demonstration category','新增演示分类');
    D.types['demo.extension.received']={mode:'none'};
    const id='demo-extension-'+CF.S.role;
    if(!D.rows.some(r=>r.id===id))
      D.rows.unshift({id,platform:'lending',end:'asset',owner:CF.S.role,biz:'demo.extension.received',
        category:'newdemo',vars:{reference:'DEMO-NEW'},read:false,at:iso(now())});
  };
})(window.CF);
