/* 非业务登记表。全部为虚构评审数据；接入方、业务规则及消息文案不构成上线登记。
 * WS-379：演示消息按 L5 / L6 / L7 / L8、登录与机构认证各册的现行事件生成，
 * 读取 CF.LS / CF.CQ / CF.L7 / CF.L8 的演示事实，本文件不自建业务对象。
 * 本批废止的九类事件（质押审核超时、报价临期与到期、放款确认临期与超期、
 * 要求重传、放款前终止、还款确认临期与超期）不再出现，正文也不带任何业务时限。 */
(function(CF){
  'use strict';
  const pair=(en,zh)=>({en,zh});
  const D=CF.NCData={
    categories:{
      progress:pair('Business progress','业务办理进度'),
      reminder:pair('Business alerts','业务提醒'),
      account:pair('Account security','账户安全'),
      compliance:pair('Verification & compliance','认证与合规')
    },
    /* 业务类型标识沿来源三段式；目标形态为业务对象 / 本平台静态页面 / 无跳转三选一。 */
    types:{
      'financing.project.review_approved':{mode:'object',kind:'project'},
      'financing.project.review_returned':{mode:'object',kind:'project'},
      'financing.pledge.review_approved':{mode:'object',kind:'project'},
      'financing.pledge.review_rejected':{mode:'object',kind:'project'},
      'financing.pledge.execution_failed':{mode:'object',kind:'project'},
      'financing.demand.coverage_invalidated':{mode:'object',kind:'project'},
      'financing.project.coverage_shortfall':{mode:'object',kind:'project'},
      'financing.project.coverage_restored':{mode:'object',kind:'project'},
      'financing.project.expiry_reminder':{mode:'object',kind:'project'},
      'financing.quote.submitted':{mode:'object',kind:'quote'},
      'financing.quote.accepted':{mode:'object',kind:'loan'},
      'financing.quote.rejected':{mode:'object',kind:'quote'},
      'financing.disbursement.submitted':{mode:'object',kind:'loan'},
      'financing.deal.confirmed':{mode:'object',kind:'repayment'},
      'financing.repayment.plan_ready':{mode:'object',kind:'repayment'},
      'financing.repayment.due_soon':{mode:'object',kind:'repayment'},
      'financing.repayment.overdue':{mode:'object',kind:'repayment'},
      'financing.repayment.submitted':{mode:'object',kind:'repayment'},
      'financing.repayment.confirmed':{mode:'object',kind:'repayment'},
      'financing.deal.settled':{mode:'object',kind:'repayment'},
      'verification.asset.revoked':{mode:'page',target:'lending:P-L12'},
      'verification.funder.approved':{mode:'page',target:'lending:P-L22'},
      'verification.funder.rejected':{mode:'page',target:'lending:P-L22'},
      'verification.funder.paused':{mode:'page',target:'lending:P-L22'},
      'account.email.changed':{mode:'page',target:'lending:P-L23'},
      'account.access.restored':{mode:'page',target:'lending:P-L23'}
    },
    templates:{
      'financing.project.review_approved':{
        title:pair('Financing project approved','融资项目审核通过'),
        body:pair('Project {project_name} ({project_id}) was approved at {approved_at}. Pledge contract address: {contract_address}. You can now pledge tokens from the project details. Pledging requires your signature and the gas is payable by you.',
          '项目 {project_name}（{project_id}）已于 {approved_at} 审核通过，质押合约地址 {contract_address}。现在可以在项目详情发起代币质押；质押需要你本人签名，gas 自担。')},
      'financing.project.review_returned':{
        title:pair('Financing project returned','融资项目审核退回'),
        body:pair('Project {project_name} ({project_id}) was returned for revision. Reason: {reason}. Update the project details and resubmit. The project term is not restarted and resubmission does not create a new project.',
          '项目 {project_name}（{project_id}）的审核结论为退回。原因：{reason}。请修改创建信息后重新提交；项目期限不会重新起算，重新提交不产生新的项目编号。')},
      'financing.pledge.review_approved':{
        title:pair('Pledge approved','质押审核通过'),
        body:pair('The pledge of token {token_id} in project {project_name} ({project_id}) was approved at {approved_at} and now counts toward the eligible borrowing limit. No further confirmation is required; you may publish or amend a financing request within the current limit.',
          '项目 {project_name}（{project_id}）的代币 {token_id} 本笔质押已于 {approved_at} 审核通过，自此计入有效质押额并参与覆盖判断。无需再做确认，可按当前额度发布或修改融资需求。')},
      'financing.pledge.review_rejected':{
        title:pair('Pledge rejected','本笔质押未通过审核'),
        body:pair('The pledge of token {token_id} in project {project_name} ({project_id}) was rejected. Reason: {reason}. The token remains in the project’s pledge contract and still counts toward the pledged-pending-review amount. Release it yourself to retrieve it; you may then pledge again subject to current eligibility. Other tokens retain their own outcomes.',
          '项目 {project_name}（{project_id}）的代币 {token_id} 本笔质押未通过。原因：{reason}。该代币仍在本项目质押合约内并计入待审质押额，请自助解押取回；取回后可按当前资格重新发起。其他代币按各自结果处理。')},
      /* T-LS-04A / 04B / 04C：同一失败事件按费用事实择一，费用未知不写 0。 */
      'financing.pledge.execution_failed':{
        title:pair('Deposit execution failed','入池执行失败'),
        body:pair('Deposit execution {action_id} for token {token_id} in project {project_name} ({project_id}) failed. Reason: {reason}. {fee_sentence} The token was not deposited and does not count toward coverage. Once no reservation remains, you may reapply subject to current eligibility; fees must be confirmed again.',
          '项目 {project_name}（{project_id}）的代币 {token_id} 本次入池执行 {action_id} 失败。原因：{reason}。{fee_sentence}该笔未成功入池、不计入覆盖，确认无占用后可按当前资格重新申请；再次操作须重新确认费用。')},
      'financing.demand.coverage_invalidated':{
        title:pair('Financing request invalidated','融资需求因覆盖不足失效'),
        body:pair('Financing request {demand_id} in project {project_name} ({project_id}) was automatically invalidated due to insufficient coverage. Pending offers for that request were also invalidated. The original record is retained. A new request may be published once current eligibility requirements are met, with no cooldown period.',
          '项目 {project_name}（{project_id}）的融资申请 {demand_id} 已因覆盖不足自动失效，该轮在途报价同时失效。原记录保留；满足当前发布资格后可重新发布新的融资申请，无需等待冷却期。')},
      'financing.demand.coverage_invalidated@fund':{
        title:pair('Financing request for your offer invalidated','报价所属融资需求已失效'),
        body:pair('Financing request {demand_id} in project {project_name} ({project_id}) was automatically invalidated due to insufficient coverage. Your pending offer for that request was also invalidated. Review the original request’s current outcome; do not continue under that offer.',
          '项目 {project_name}（{project_id}）的融资申请 {demand_id} 已因覆盖不足自动失效，你方在该轮的在途报价同时失效。请查看原申请的当前结果，不要按原报价继续办理。')},
      'financing.project.coverage_shortfall':{
        title:pair('Project coverage shortfall','项目出现覆盖不足'),
        body:pair('Project {project_name} ({project_id}) had a coverage shortfall at {occurred_at}. The shortfall was {shortfall} USD, requiring additional assets valued at {additional_value} USD. Additional pledges by the asset originator require review; submission has no immediate effect. Coverage is updated after successful deposit.',
          '项目 {project_name}（{project_id}）于 {occurred_at} 出现覆盖不足，覆盖缺口 {shortfall} USD，需追加资产价值 {additional_value} USD。资产方追加质押须先经审核，提交不即时生效，成功入池后按实际覆盖更新。')},
      'financing.project.coverage_restored':{
        title:pair('Coverage shortfall resolved','本轮覆盖不足已解除'),
        body:pair('The current coverage shortfall for project {project_name} ({project_id}) was resolved at {occurred_at}. Check the project’s current coverage. Resolution of this alert does not mean the financing debt has been settled.',
          '项目 {project_name}（{project_id}）的本轮覆盖不足已于 {occurred_at} 解除。请以项目当前覆盖情况为准；解除提醒不代表融资债务已结清。')},
      'financing.project.expiry_reminder':{
        title:pair('Project expires in 7 days','项目距有效期届满还有 7 天'),
        body:pair('Project {project_name} ({project_id}) expires at {expires_at}. There are 7 days remaining as of this notification. New financing will not be available after expiry; existing business continues under its current status.',
          '项目 {project_name}（{project_id}）将于 {expires_at} 届满有效期。当前距离届满还有 7 天；到期后不能新增融资，存量业务仍按其当前状态办理。')},
      'financing.quote.submitted':{
        title:pair('Financing offer received','收到融资报价'),
        body:pair('{institution_name} submitted an offer for financing request {demand_id}, financing reference {business_id}, with a financing amount of {amount_usd} USD. The offer has no expiry date and stays open until you accept or reject it. Review the terms and decide. If the underlying financing request ends because the project is closed, the project term expires, or collateral coverage falls short, this offer lapses with it.',
          '融资申请 {demand_id} 收到 {institution_name} 的报价，融资业务编号 {business_id}，融资金额 {amount_usd} USD。该报价没有有效期，在您接受或拒绝之前一直有效；请查看条款并决定接受或拒绝。若所属融资需求因项目关闭、项目到期或池内覆盖不足而终结，本笔报价将同时失效。')},
      'financing.quote.accepted':{
        title:pair('Financing offer accepted','融资报价已接受'),
        body:pair('Your offer for financing request {demand_id}, financing reference {business_id}, was accepted at {accepted_at} and entered the pending-disbursement stage. Proceed with disbursement from this financing record under the current process. Acceptance does not mean the loan has been disbursed.',
          '你方对融资申请 {demand_id} 的报价（融资业务编号 {business_id}）已于 {accepted_at} 被接受，当前进入待放款。请在本笔融资放款信息中按当前流程办理放款；接受报价不代表已完成放款。')},
      'financing.quote.rejected':{
        title:pair('Financing offer rejected','融资报价已拒绝'),
        body:pair('Your offer for financing request {demand_id}, financing reference {business_id}, was rejected at {rejected_at}. Reason: {reason}. The pending-offer allocation for this offer has been released, and the original offer cannot be reinstated. Review its history; any new offer is subject to current eligibility.',
          '你方对融资申请 {demand_id} 的报价（融资业务编号 {business_id}）已于 {rejected_at} 被拒绝。原因：{reason}。该笔在途报价金额已释放，原报价不可恢复；请查看本笔报价历史，后续报价以当前资格为准。')},
      'financing.disbursement.submitted':{
        title:pair('Disbursement recorded — verify receipt','放款记录已提交，请核实到账'),
        body:pair('Funder {institution_name} submitted disbursement record {disbursement_id} for financing request {demand_id}, financing reference {business_id}, at {submitted_at}. The recorded amount is {amount} {currency}. Confirm only after independently verifying receipt; if funds have not arrived, clarify the payment with the other party offline. The platform has not verified the payment and will not confirm receipt automatically or on your behalf.',
          '融资申请 {demand_id}、融资业务 {business_id} 的资金方 {institution_name} 已于 {submitted_at} 提交放款记录 {disbursement_id}，登记金额为 {amount} {currency}。请自行核实到账后确认；未到账请先与对方线下核实。平台未核验付款真实性，也不会代为或自动确认本笔业务。')},
      /* T-LN-04A：计划已定稿；T-LN-04B：计划正在生成。按真实进度择一，不拼状态词。 */
      'financing.deal.confirmed':{
        title:pair('Asset holder confirmed receipt','资产方已确认放款到账'),
        body:pair('The asset holder confirmed receipt for disbursement record {disbursement_id}, financing request {demand_id}, financing reference {business_id}, at {confirmed_at}. The financing entered the repayment stage, and its finalized repayment schedule is available. Open this financing’s repayment information to review the schedule.',
          '融资申请 {demand_id}、融资业务 {business_id} 的放款记录 {disbursement_id} 已由资产方于 {confirmed_at} 确认到账，业务进入还款阶段，定稿还款计划已可查看。请前往本笔还款信息查看正式安排。')},
      'financing.deal.confirmed@generating':{
        title:pair('Asset holder confirmed receipt','资产方已确认放款到账'),
        body:pair('The asset holder confirmed receipt for disbursement record {disbursement_id}, financing request {demand_id}, financing reference {business_id}, at {confirmed_at}. The financing entered the repayment stage, and its repayment schedule is being generated. Receipt confirmation is effective and does not need to be repeated. Check this financing’s repayment information for progress and use the finalized schedule when available.',
          '融资申请 {demand_id}、融资业务 {business_id} 的放款记录 {disbursement_id} 已由资产方于 {confirmed_at} 确认到账，业务进入还款阶段，还款计划正在生成。确认结果已生效，无需再次确认；请在本笔还款信息查看计划进度，定稿后以正式安排为准。')},
      'financing.repayment.plan_ready':{
        title:pair('Repayment schedule finalized','还款计划已定稿'),
        body:pair('The repayment schedule for financing request {demand_id}, financing reference {business_id}, disbursement {disbursement_id}, with funder {institution_name}, is finalized. Its finalization time is {finalized_at}. The estimated interest start date was {planned_start_date}; the actual date is {actual_start_date}. The estimated schedule had {planned_count} installments; the finalized schedule has {actual_count}. Review the complete installment comparison below and follow the finalized dates and amounts. No further offer acceptance is required.',
          '融资申请 {demand_id}、融资业务 {business_id}、放款 {disbursement_id}，资金方 {institution_name} 的还款计划已定稿。定稿时点为 {finalized_at}；预计起息日 {planned_start_date}，实际起息日 {actual_start_date}；预计 {planned_count} 期，定稿 {actual_count} 期。完整逐期对照如下，请按定稿日期和金额安排还款；无需再次接受报价。')},
      'financing.repayment.due_soon':{
        title:pair('Repayment schedule reminder','本期还款安排提醒'),
        body:pair('For financing request {demand_id}, financing reference {business_id}, disbursement {disbursement_id}, with funder {institution_name}, installment {installment_no} (schedule {schedule_id}) is due on {due_date}. The total due is {usd_total} USD, payable as {settlement_amount} {currency}. Review the schedule and prepare your payment information. Repayment recording opens at {recording_opens_at}; before then, information is read-only and no repayment entry or submission is available. Once recording opens, submit the actual payment record by the due date. The platform records information only and does not transfer funds on your behalf.',
          '融资申请 {demand_id}、融资业务 {business_id}、放款 {disbursement_id}，资金方 {institution_name}：第 {installment_no} 期（计划 {schedule_id}）应还日为 {due_date}，应还合计 {usd_total} USD，结算金额 {settlement_amount} {currency}。请查看本期安排并准备付款资料。还款信息录入从 {recording_opens_at} 开放，此前仅可查看，不可提前录入或提交；开放后请按期提交实际付款记录。平台仅登记信息，不代为转账。')},
      'financing.repayment.overdue':{
        title:pair('Repayment overdue','本期还款已逾期'),
        body:pair('For financing request {demand_id}, financing reference {business_id}, disbursement {disbursement_id}, with funder {institution_name}, installment {installment_no} (schedule {schedule_id}) was due on {due_date}. No repayment record had been successfully submitted as of {overdue_as_of}, and it was {overdue_days} days overdue. The total due is {usd_total} USD, payable as {settlement_amount} {currency}. Record the actual payment for this installment. Successful submission only freezes its overdue day count; the overdue-but-unsettled indication remains until receipt is verified and acknowledged by the funder. No penalty interest is added.',
          '融资申请 {demand_id}、融资业务 {business_id}、放款 {disbursement_id}，资金方 {institution_name}：第 {installment_no} 期（计划 {schedule_id}）应还日为 {due_date}，截至 {overdue_as_of} 尚未成功提交还款，已逾期 {overdue_days} 天。应还合计 {usd_total} USD，结算金额 {settlement_amount} {currency}。请录入本期实际付款信息；成功提交仅冻结本期期次逾期天数，已逾期未结清提示保留，待资金方核实到账后确认。本期不增加罚息。')},
      'financing.repayment.overdue@fund':{
        title:pair('Repayment record overdue','本期尚未提交还款，已逾期'),
        body:pair('For your institution {institution_name}, financing request {demand_id}, financing reference {business_id}, disbursement {disbursement_id}, installment {installment_no} (schedule {schedule_id}) was due on {due_date}. No repayment record had been submitted on the platform as of {overdue_as_of}, and it was {overdue_days} days overdue. The total due is {usd_total} USD, payable as {settlement_amount} {currency}. Review this installment’s repayment information. This notice does not verify any payment made outside the platform, and no penalty interest is added.',
          '你方机构 {institution_name} 的融资申请 {demand_id}、融资业务 {business_id}、放款 {disbursement_id}，第 {installment_no} 期（计划 {schedule_id}）应还日为 {due_date}，截至 {overdue_as_of} 尚未收到平台还款提交记录，已逾期 {overdue_days} 天。应还合计 {usd_total} USD，结算金额 {settlement_amount} {currency}。请查看该期履约信息；本通知不代表平台核验线下付款，也不增加罚息。')},
      'financing.repayment.submitted':{
        title:pair('Repayment recorded — verify receipt','还款记录已提交，请核实到账'),
        body:pair('A repayment record was successfully submitted at {submitted_at} for your institution {institution_name}, financing request {demand_id}, financing reference {business_id}, disbursement {disbursement_id}, installment {installment_no} (schedule {schedule_id}, due on {due_date}). The total due is {usd_total} USD, payable as {settlement_amount} {currency}. Acknowledge receipt only after independently verifying it. There is no deadline for the acknowledgment; the timing is agreed between the two parties offline. The platform has not verified the payment and will never acknowledge receipt on your behalf. If this installment was overdue, submission retains its overdue-but-unsettled indication.',
          '你方机构 {institution_name} 的融资申请 {demand_id}、融资业务 {business_id}、放款 {disbursement_id}，第 {installment_no} 期（计划 {schedule_id}，应还日 {due_date}）已于 {submitted_at} 成功提交还款记录。应还合计 {usd_total} USD，结算金额 {settlement_amount} {currency}。请自行核实到账后确认收到还款；确认没有时限，办理时机由双方线下商定，平台不会自动确认，也不核验付款真实性；如本期曾逾期，提交后仍保留逾期未结清提示。')},
      'financing.repayment.confirmed':{
        title:pair('Installment repayment acknowledged','本期还款已确认'),
        body:pair('Funder {institution_name} acknowledged receipt at {confirmed_at} for financing request {demand_id}, financing reference {business_id}, disbursement {disbursement_id}, installment {installment_no} (schedule {schedule_id}). This installment is settled. Other installments remain unsettled for this financing. Review this result and the finalized repayment schedule. This notice does not mean the project’s collateral has been released.',
          '融资申请 {demand_id}、融资业务 {business_id}、放款 {disbursement_id} 的资金方 {institution_name} 已于 {confirmed_at} 确认第 {installment_no} 期（计划 {schedule_id}）收到还款，该期已结清。本笔业务仍有其他未结清期次，请查看本期结果与正式还款安排；本通知不表示项目质押已释放。')},
      'financing.deal.settled':{
        title:pair('Financing fully settled','本笔融资业务已结清'),
        body:pair('Funder {institution_name} acknowledged receipt at {confirmed_at} for financing request {demand_id}, financing reference {business_id}, disbursement {disbursement_id}, installment {installment_no} (schedule {schedule_id}). All installments are settled, and this financing was fully settled at {settled_at}. Its outstanding principal and associated principal allocations are now zero. Review the project’s collateral status: settlement of one financing does not directly release project collateral. Business release occurs when the project meets its closure or settlement conditions. Released tokens still awaiting withdrawal must be withdrawn using “Release collateral — Withdraw released tokens”; you pay the gas fee. Tokens do not return to your wallet automatically.',
          '融资申请 {demand_id}、融资业务 {business_id}、放款 {disbursement_id} 的资金方 {institution_name} 已于 {confirmed_at} 确认第 {installment_no} 期（计划 {schedule_id}）收到还款；全部期次已结清，本笔业务于 {settled_at} 结清。本笔未偿本金及对应本金占用已归零。请查看本项目质押状态：单笔业务结清不直接释放项目质押；项目满足关闭或结清条件后业务释放，已释放且仍待提取的代币需从「解除质押—提取已释放」入口自行提取并自付 gas，不会自动回到钱包。')},
      'financing.deal.settled@fund':{
        title:pair('Financing fully settled','本笔融资业务已结清'),
        body:pair('For your institution {institution_name}, financing request {demand_id}, financing reference {business_id}, disbursement {disbursement_id}, receipt for installment {installment_no} (schedule {schedule_id}) was acknowledged at {confirmed_at}. All installments are settled, and this financing was fully settled at {settled_at}. Its outstanding principal and associated project financing balance and credit allocation are now zero; allocations for other financing are unaffected. Review this result and the project’s collateral status. Business release requires the project to meet its closure or settlement conditions. The asset holder must still withdraw released tokens using “Release collateral — Withdraw released tokens” and pay the gas fee; release does not mean the tokens have returned to the wallet.',
          '你方机构 {institution_name} 的融资申请 {demand_id}、融资业务 {business_id}、放款 {disbursement_id}，第 {installment_no} 期（计划 {schedule_id}）已于 {confirmed_at} 确认收到还款；全部期次已结清，本笔业务于 {settled_at} 结清。本笔未偿本金及对应项目融资余额、授信占用额已归零，不代表其他业务占用归零。请查看本笔结果及项目质押状态；项目业务释放须满足项目关闭或结清条件，已释放代币仍需资产方从「解除质押—提取已释放」入口自行提取并自付 gas，不代表已回到钱包。')},
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
        body:pair('Your account contact email was changed. View the current email in account settings. If you did not make this change, contact support through the platform’s existing support entry.',
          '你的账户联系邮箱已修改。请在账户设置查看当前邮箱。如非本人操作，请通过平台现有客服入口反馈。')},
      'account.access.restored':{
        title:pair('Account restored','账户已恢复'),
        body:pair('This account status change restored your login access. Available business actions still depend on your current institution verification status.',
          '本次账户状态变更已恢复你的登录访问。可办理的业务仍以当前机构认证状态为准。')},
      /* 业务类型尚未登记落点：正文照常可读、计未读，只是没有业务跳转动作。 */
      'financing.settlement.netting_prepared':{
        title:pair('Settlement netting record available','收到一条结算净额记录'),
        body:pair('A settlement netting record was created for project {project_name} ({project_id}). Review the record in the project details.',
          '项目 {project_name}（{project_id}）已生成一条结算净额记录。请在项目详情查看该记录。')},
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
  const now=()=>CF.L8?.now||CF.L7?.now?.()||CF.LS?.now?.()||Date.now();
  const nodes={
    quoteWaiting:pair('Awaiting acceptance','待接受'),
    quoteRejected:pair('Rejected','已拒绝'),
    pendingLoan:pair('Awaiting disbursement','待放款'),
    confirming:pair('Awaiting receipt confirmation','待放款确认'),
    disbursed:pair('Disbursed','已放款'),
    repaying:pair('Repaying','还款中'),
    planGenerating:pair('Plan generating','计划生成中'),
    due:pair('Pending repayment','待还款'),
    repayConfirming:pair('Awaiting repayment confirmation','待还款确认'),
    periodSettled:pair('Installment settled','本期已结清'),
    settled:pair('Settled','已结清'),
    reviewApproved:pair('Review approved','审核通过'),
    reviewRejected:pair('Review not approved','审核未通过'),
    reviewReturned:pair('Returned for revision','已退回'),
    executionFailed:pair('Execution failed','执行失败'),
    demandEnded:pair('Financing request ended','需求已终结'),
    coverageShort:pair('Coverage shortfall','覆盖不足'),
    coverageOk:pair('Coverage restored','覆盖已恢复'),
    projectExpiring:pair('Final term window','有效期最后窗口')
  };
  let serial=0;
  function push(row){
    row.platform=row.platform||'lending';row.end='asset';
    row.id=row.id||('nc-'+row.owner+'-'+(++serial));
    D.rows.push(row);
    return row;
  }
  const business=(name,number,node,state,extra)=>Object.assign({name,number,node,state},extra||{});

  /* ---------------------------------------------------------- 资产方消息 */
  function seedAsset(){
    const d=D5(),q=Q(),own=d.projects.filter(p=>p.owner==='entity-demo-a');
    /* 项目与逐笔事件按各自发生次序铺开，同批逐笔结果仍各自保留一条。 */
    const slots=Math.max(own.length,1),tick=n=>iso(now()-n*9*H);
    own.forEach((p,pi)=>{
      const at=Date.parse(p.published||p.created||iso(now()));
      const vars={project_name:p.name,project_id:p.id};
      if(pi===1)push({owner:'asset',biz:'financing.project.review_returned',category:'progress',objectKind:'project',objectId:p.id,
        at:tick(226+pi*6),vars:{...vars,reason:pair('The pledge rate in the project details exceeds the rate registered for this token type.','创建信息中的质押率超过该代币类型的登记上限。')},
        business:business(p.name,p.id,nodes.reviewReturned,'failed')});
      push({owner:'asset',biz:'financing.project.review_approved',category:'progress',objectKind:'project',objectId:p.id,
        at:tick(220+pi*6),vars:{...vars,approved_at:tick(220+pi*6),contract_address:p.contract},
        business:business(p.name,p.id,nodes.reviewApproved,'complete')});
      /* 逐笔质押审核结果：每张在合约内的代币一条，驳回只覆盖一张。 */
      d.tokens.filter(t=>t.pool===p.id&&t.pledge==='pledged').forEach((t,ti)=>{
        const rejected=pi===1&&ti===2,when=tick(pi+ti*slots);
        push({owner:'asset',biz:rejected?'financing.pledge.review_rejected':'financing.pledge.review_approved',
          category:'progress',objectKind:'project',objectId:p.id,at:when,
          vars:rejected?{...vars,token_id:t.id,reason:pair('The buyer confirmation attached to this receivable is not the version on record.','本张应收账款附带的买方确认函与备案版本不一致。')}
            :{...vars,token_id:t.id,approved_at:when},
          business:business(p.name,t.id,rejected?nodes.reviewRejected:nodes.reviewApproved,rejected?'failed':'complete')});
      });
      if(pi===2){
        const fees=[['A',pair('The deposit transaction was rejected by the pledge contract.','质押合约拒绝了本次入池交易。'),'0.0041','ETH'],
          ['B',pair('The token was already reserved by another application when this deposit executed.','入池执行时该代币已被另一笔申请预占。'),null,null],
          ['C',pair('The chain returned a definitive failure for this deposit.','链上对本次入池返回了确定的失败结果。'),'pending',null]];
        fees.forEach(([tag,reason,fee,ccy],i)=>{
          const sentence=fee===null?pair('No execution fees were incurred for this operation.','本次未产生执行费用。')
            :fee==='pending'?pair('The actual execution fees are pending verification; this does not mean no fees were incurred. Any incurred fees remain payable by the asset originator and are not refunded.','本次实际执行费用待核实，不代表未产生费用；如已产生，仍由资产方承担且不退回。')
            :pair('This operation incurred fees of '+fee+' '+ccy+', payable by the asset originator. Incurred fees are not refunded.','本次已产生费用 '+fee+' '+ccy+'，由资产方承担，已产生的费用不退回。');
          push({owner:'asset',biz:'financing.pledge.execution_failed',category:'progress',objectKind:'project',objectId:p.id,
            at:tick(126+i*4),vars:{...vars,token_id:'TK-DEMO-'+(pi+1)+'-'+(i+1),action_id:'EX-DEMO-'+p.id.slice(-3)+'-'+tag,reason,fee_sentence:sentence},
            business:business(p.name,'EX-DEMO-'+p.id.slice(-3)+'-'+tag,nodes.executionFailed,'failed')});
        });
      }
      if(pi%3===0){
        const shortfall=45000+pi*5000;
        push({owner:'asset',biz:'financing.project.coverage_shortfall',category:'reminder',objectKind:'project',objectId:p.id,
          at:tick(96+pi*7),vars:{...vars,occurred_at:tick(96+pi*7),shortfall:money(shortfall),additional_value:money(shortfall*1.25)},
          business:business(p.name,p.id,nodes.coverageShort,'pending')});
        push({owner:'asset',biz:'financing.project.coverage_restored',category:'reminder',objectKind:'project',objectId:p.id,
          at:tick(88+pi*7),vars:{...vars,occurred_at:tick(88+pi*7)},
          business:business(p.name,p.id,nodes.coverageOk,'complete')});
      }
      if(pi===3)['asset','fund'].forEach(who=>push({owner:who,
        biz:who==='fund'?'financing.demand.coverage_invalidated@fund':'financing.demand.coverage_invalidated',
        category:'progress',objectKind:'project',objectId:p.id,at:tick(74),vars:{...vars,demand_id:p.id+'-01'},
        business:business(p.name,p.id+'-01',nodes.demandEnded,'failed')}));
      /* 届满前 7 天的提醒节点已经过去才存在这条消息，不预生成未来事件。 */
      if(p.expires&&Date.parse(p.expires)-7*DAY<=now())
        push({owner:'asset',biz:'financing.project.expiry_reminder',category:'reminder',objectKind:'project',objectId:p.id,
          at:iso(Date.parse(p.expires)-7*DAY),vars:{...vars,expires_at:p.expires},
          business:business(p.name,p.id,nodes.projectExpiring,'active')});
    });
    /* 报价、放款、还款：按 CF.CQ / CF.L7 / CF.L8 的现行演示业务生成。 */
    let gapShown=false;
    q.data().quotes.filter(x=>x.owner==='entity-demo-a').forEach(x=>{
      const p=d.project(x.project),inst=fundName(x.fund),plan=x.l8,deal=x.l7;
      if(!p)return;
      const ids={demand_id:x.demand,business_id:x.id};
      if(['waiting','funding','funded','rejected'].includes(x.state))
        push({owner:'asset',biz:'financing.quote.submitted',category:'progress',objectKind:'quote',objectId:x.id,objectProject:x.project,
          at:iso(x.at),vars:{...ids,institution_name:inst,amount_usd:money(x.amount)},
          business:business(p.name,x.id,x.state==='waiting'?nodes.quoteWaiting:x.state==='rejected'?nodes.quoteRejected:nodes.pendingLoan,
            x.state==='waiting'?'pending':x.state==='rejected'?'failed':'active')});
      if(deal&&deal.record)
        push({owner:'asset',biz:'financing.disbursement.submitted',category:'progress',objectKind:'loan',objectId:x.id,objectProject:x.project,
          at:deal.record.at,vars:{...ids,institution_name:inst,submitted_at:deal.record.at,disbursement_id:deal.record.id,amount:money(deal.amount),currency:deal.ccy},
          business:business(p.name,deal.record.id,deal.state==='waiting'?nodes.confirming:nodes.disbursed,deal.state==='waiting'?'pending':'complete',
            {step:1,total:2})});
      if(plan){
        /* 预计起息日按报价时点估算，实际起息日按到账确认日。其中一笔演示业务保留两者
           相差一个季度的情形，用于呈现只有一侧有条目的对照行。 */
        const gap=!gapShown&&plan.periods.length>=3&&(gapShown=true);
        const plannedStart=gap?day(iso(Date.parse(plan.start)-92*DAY)):day(iso(x.at));
        const planned=CF.L8.build(plannedStart,day(x.repay),x.amount,x.rate,x.fx.value);
        const base={...ids,disbursement_id:deal.record.id,institution_name:inst};
        push({owner:'asset',biz:'financing.repayment.plan_ready',category:'progress',objectKind:'repayment',objectId:x.id,objectProject:x.project,
          at:plan.at,vars:{...base,finalized_at:plan.at,planned_start_date:plannedStart,actual_start_date:plan.start,
            planned_count:planned.length,actual_count:plan.periods.length},
          installments:{ccy:deal.ccy,planned:planned.map(r=>({seq:r.seq,due:r.due,total:r.total,settlement:r.settlement})),
            actual:plan.periods.map(r=>({seq:r.seq,due:r.due,total:r.total,settlement:r.settlement,id:r.id}))},
          business:business(p.name,x.id,plan.settledAt?nodes.settled:nodes.repaying,plan.settledAt?'complete':'active')});
        plan.periods.forEach(pd=>{
          const ref={...base,installment_no:pd.seq,schedule_id:pd.id,due_date:pd.due,usd_total:money(pd.total),
            settlement_amount:money(pd.settlement),currency:deal.ccy};
          const over=pd.record?pd.record.overdue:Math.max(0,Math.floor((Date.parse(day(iso(now())))-Date.parse(pd.due))/DAY));
          if(pd.state==='due'&&Date.parse(pd.due)-3*DAY<=now())
            push({owner:'asset',biz:'financing.repayment.due_soon',category:'reminder',objectKind:'repayment',objectId:x.id,objectProject:x.project,period:pd.id,
              at:iso(Date.parse(pd.due)-3*DAY),vars:{...ref,recording_opens_at:pd.due+'T00:00:00Z'},
              business:business(p.name,pd.id,nodes.due,'active')});
          if(over>0&&pd.state!=='settled')
            push({owner:'asset',biz:'financing.repayment.overdue',category:'reminder',objectKind:'repayment',objectId:x.id,objectProject:x.project,period:pd.id,
              at:pd.record?pd.record.at:iso(Date.parse(pd.due)+DAY),
              vars:{...ref,overdue_as_of:pd.record?pd.record.at:iso(Date.parse(pd.due)+DAY),overdue_days:over},
              business:business(p.name,pd.id,nodes.due,'pending')});
          if(pd.state==='settled'&&pd.record&&pd.record.confirmedAt){
            const last=plan.settledAt&&pd.seq===plan.periods.length;
            push({owner:'asset',biz:last?'financing.deal.settled':'financing.repayment.confirmed',category:'progress',
              objectKind:'repayment',objectId:x.id,objectProject:x.project,period:pd.id,at:pd.record.confirmedAt,
              vars:{...ref,confirmed_at:pd.record.confirmedAt,settled_at:plan.settledAt||pd.record.confirmedAt},
              business:business(p.name,pd.id,last?nodes.settled:nodes.periodSettled,'complete')});
          }
        });
      }
    });
    push({owner:'asset',biz:'verification.asset.revoked',category:'compliance',at:iso(now()-5*DAY),vars:{}});
  }

  /* ---------------------------------------------------------- 资金方消息 */
  function seedFund(){
    const d=D5(),q=Q();
    q.data().quotes.filter(x=>x.fund==='fund-a').forEach(x=>{
      const p=d.project(x.project),inst=fundName(x.fund),plan=x.l8,deal=x.l7;
      if(!p)return;
      const ids={demand_id:x.demand,business_id:x.id};
      if(['funding','funded'].includes(x.state))
        push({owner:'fund',biz:'financing.quote.accepted',category:'progress',objectKind:'loan',objectId:x.id,objectProject:x.project,
          at:iso(x.done||x.at),vars:{...ids,accepted_at:iso(x.done||x.at)},
          business:business(p.name,x.id,deal&&deal.state!=='pending'?nodes.confirming:nodes.pendingLoan,deal&&deal.state!=='pending'?'active':'pending')});
      if(x.state==='rejected')
        push({owner:'fund',biz:'financing.quote.rejected',category:'progress',objectKind:'quote',objectId:x.id,objectProject:x.project,
          at:iso(x.done||x.at),vars:{...ids,rejected_at:iso(x.done||x.at),
            reason:x.reason||pair('Terms do not match current needs','融资条款不符合当前需求')},
          business:business(p.name,x.id,nodes.quoteRejected,'failed')});
      if(x.state==='expired')
        push({owner:'fund',biz:'financing.demand.coverage_invalidated@fund',category:'progress',objectKind:'project',objectId:x.project,
          at:iso(x.done||x.at),vars:{project_name:p.name,project_id:p.id,demand_id:x.demand},
          business:business(p.name,x.demand,nodes.demandEnded,'failed')});
      if(deal&&deal.confirmedAt)
        push({owner:'fund',biz:plan?'financing.deal.confirmed':'financing.deal.confirmed@generating',category:'progress',
          objectKind:'repayment',objectId:x.id,objectProject:x.project,at:deal.confirmedAt,
          vars:{...ids,disbursement_id:deal.record.id,confirmed_at:deal.confirmedAt},
          business:business(p.name,deal.record.id,plan?nodes.repaying:nodes.planGenerating,'active',{step:2,total:2})});
      if(plan){
        const base={...ids,disbursement_id:deal.record.id,institution_name:inst};
        plan.periods.forEach(pd=>{
          const ref={...base,installment_no:pd.seq,schedule_id:pd.id,due_date:pd.due,usd_total:money(pd.total),
            settlement_amount:money(pd.settlement),currency:deal.ccy};
          const over=pd.record?pd.record.overdue:Math.max(0,Math.floor((Date.parse(day(iso(now())))-Date.parse(pd.due))/DAY));
          if(pd.state==='pending'&&pd.record)
            push({owner:'fund',biz:'financing.repayment.submitted',category:'progress',objectKind:'repayment',objectId:x.id,objectProject:x.project,period:pd.id,
              at:pd.record.at,vars:{...ref,submitted_at:pd.record.at},
              business:business(p.name,pd.id,nodes.repayConfirming,'pending')});
          if(over>0&&pd.state==='due')
            push({owner:'fund',biz:'financing.repayment.overdue@fund',category:'reminder',objectKind:'repayment',objectId:x.id,objectProject:x.project,period:pd.id,
              at:iso(Date.parse(pd.due)+DAY),vars:{...ref,overdue_as_of:iso(Date.parse(pd.due)+DAY),overdue_days:over},
              business:business(p.name,pd.id,nodes.due,'active')});
          if(pd.state==='settled'&&pd.record&&pd.record.confirmedAt&&plan.settledAt&&pd.seq===plan.periods.length)
            push({owner:'fund',biz:'financing.deal.settled@fund',category:'progress',objectKind:'repayment',objectId:x.id,objectProject:x.project,period:pd.id,
              at:pd.record.confirmedAt,vars:{...ref,confirmed_at:pd.record.confirmedAt,settled_at:plan.settledAt},
              business:business(p.name,pd.id,nodes.settled,'complete')});
        });
      }
    });
    d.projects.filter(p=>p.balance>0).forEach((p,i)=>{
      const at=Date.parse(p.published||iso(now()))+40*H,shortfall=38000+i*4000;
      push({owner:'fund',biz:'financing.project.coverage_shortfall',category:'reminder',objectKind:'project',objectId:p.id,
        at:iso(at),vars:{project_name:p.name,project_id:p.id,occurred_at:iso(at),shortfall:money(shortfall),additional_value:money(shortfall*1.25)},
        business:business(p.name,p.id,nodes.coverageShort,'active')});
      if(i%2===0)push({owner:'fund',biz:'financing.project.coverage_restored',category:'reminder',objectKind:'project',objectId:p.id,
        at:iso(at+20*H),vars:{project_name:p.name,project_id:p.id,occurred_at:iso(at+20*H)},
        business:business(p.name,p.id,nodes.coverageOk,'complete')});
    });
    const app='FA-DEMO-0007',submitted=iso(now()-9*DAY),reviewed=iso(now()-8*DAY);
    push({owner:'fund',biz:'verification.funder.approved',category:'compliance',at:reviewed,
      vars:{application_number:app,submitted_time:submitted,reviewed_time:reviewed}});
    push({owner:'fund',biz:'verification.funder.rejected',category:'compliance',at:iso(now()-21*DAY),
      vars:{application_number:'FA-DEMO-0006',submitted_time:iso(now()-23*DAY),reviewed_time:iso(now()-21*DAY)}});
    push({owner:'fund',biz:'verification.funder.paused',category:'compliance',at:iso(now()-24*DAY),
      vars:{application_number:'FA-DEMO-0006',submitted_time:iso(now()-24*DAY)}});
    push({owner:'fund',biz:'account.email.changed',category:'account',at:iso(now()-4*DAY),vars:{}});
    push({owner:'fund',biz:'account.access.restored',category:'account',at:iso(now()-30*DAY),vars:{}});
  }

  /* -------------------------------------------- 降级与隔离夹具（评审用） */
  function seedFixtures(){
    const base=D.rows.find(r=>r.owner==='asset'&&r.business)||D.rows[0];
    if(!base)return;
    const at=n=>iso(now()-n*H);
    push({...base,id:'nc-fixture-expired',at:at(120),read:false,expires:'2026-01-01T00:00:00Z'});
    push({...base,id:'nc-fixture-missing-template',biz:'financing.unknown.event',category:'progress',at:at(121),read:false,missing:true,business:null});
    push({...base,id:'nc-fixture-zh-only',at:at(122),read:false,onlyZh:true});
    push({...base,id:'nc-fixture-unregistered-type',biz:'financing.settlement.netting_prepared',category:'progress',at:at(123),read:false,
      business:{...base.business,node:{en:'Awaiting registration',zh:'类型待登记'},state:'active'}});
    push({...base,id:'nc-fixture-unregistered-category',category:'treasury',at:at(124),read:false});
    push({...base,id:'nc-fixture-plain-text',at:at(125),read:false,
      literal:'<script>alert("demo")</script>\nPlain text <b>only</b> / 仅作为纯文本展示'});
    push({...base,id:'nc-fixture-unknown-state',at:at(126),read:false,business:{...base.business,state:'unknown'}});
    push({...base,id:'nc-fixture-no-step',at:at(127),read:false,business:{...base.business,number:null,step:null,total:null}});
    push({...base,id:'nc-fixture-denied-target',at:at(128),read:false,check:'denied'});
    push({...base,id:'nc-fixture-timeout-target',at:at(129),read:false,check:'timeout'});
    push({...base,id:'nc-fixture-no-target',biz:'verification.asset.revoked',category:'compliance',at:at(130),read:false,
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
      ['financing.project.review_approved','progress',nodes.reviewApproved,'complete',i=>({project_name:project,project_id:'FP-DEMO-'+i,approved_at:iso(now()-i*H),contract_address:'0x'+String(i).padStart(40,'0')})],
      ['financing.quote.submitted','progress',nodes.quoteWaiting,'pending',i=>({demand_id:'FP-DEMO-'+i+'-01',business_id:'FB-DEMO-'+i,institution_name:fundName('fund-a'),amount_usd:money(240000+i*1000)})],
      ['financing.project.coverage_shortfall','reminder',nodes.coverageShort,'active',i=>({project_name:project,project_id:'FP-DEMO-'+i,occurred_at:iso(now()-i*H),shortfall:money(40000+i*500),additional_value:money(50000+i*625)})],
      ['verification.asset.revoked','compliance',null,null,()=>({})]
    ];
    for(let i=1;i<=8;i++)cases.forEach(([biz,category,node,state,vars],k)=>push({
      owner:'asset',biz,category,at:iso(now()-((i-1)*cases.length+k)*3*H),vars:vars(i),
      business:node?business(project,'FB-DEMO-'+i,node,state):null}));
  }
  let seeded=false;
  D.ensure=function(){
    if(seeded)return D;
    seeded=true;
    try{if(CF.LS&&CF.CQ&&CF.L8){seedAsset();seedFund();}else seedStandalone();seedFixtures();}
    catch(e){/* 演示数据缺失时保持可读空池，不阻断页面。 */}
    /* 消息记录已经发生的事实：演示池不保留发生时点还没到的条目。 */
    const until=now();
    D.rows=D.rows.filter(r=>!Number.isFinite(Date.parse(r.at))||Date.parse(r.at)<=until);
    /* 每 7 条留 1 条已读，其余未读；本地已读记录载入后覆盖该初值。 */
    D.rows.forEach((r,i)=>{if(r.read===undefined)r.read=i%7===6;});
    D.rows.sort((a,b)=>String(b.at).localeCompare(String(a.at)));
    return D;
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
