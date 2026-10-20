/* Fictional fixtures only. Categories and destinations are metadata, not an event registry.
   承接范围按本端现行登记：全体运营＝机构资料待审核（审核任务）＋协议三类告警（运营告警）；本人＝密码变更通知（账户安全）。
   本模块不产生独立事件，池内不得出现已废止的时点提醒（临期、超时、催办）。 */
(function(CF){
const now=Date.now();
const T=(en,zh)=>({en,zh});
/* 目标指向仓库内既有的运营端演示记录，权限项沿各目标模块的交付配置。 */
const agreementVersion=(id,n,permission)=>({to:'agreements',route:'/ops/agreements/version?id='+id+'&v='+n+'&tab=history',permission});
/* 生效失败的目标是协议详情的基本信息：待生效版本与当前仍生效版本在此同屏可得，且不依赖历史版本读取权限。 */
const agreementDetail=(id,permission)=>({to:'agreements',route:'/ops/agreements/detail?id='+id+'&tab=basic',permission});
const application=id=>({to:'institution',route:'/ops/institution-reviews/detail?state=submitted&q=&from=&to=&page=1&application='+id,permission:5});

CF.opsMessageDemo={
 /* 与面客端共用的统一分类；筛选只列出本人实际有消息的分类，无法识别时回落“其他”。 */
 categories:{
  progress:T('Business progress','业务办理进度'),
  reminder:T('Business reminders','业务提醒'),
  compliance:T('Verification & compliance','认证与合规'),
  account:T('Account security','账户安全'),
  review:T('Review tasks','审核任务'),
  alert:T('Operations alerts','运营告警')
 },
 templates:[
  /* 机构资料待审核 · 全体运营 · 目标为该申请的机构审核详情并定位本次提交 */
  {category:'review',target:application('DEMO-REG-001'),
   title:T('Institution application DEMO-REG-001 is ready for review','机构认证申请 DEMO-REG-001 待审核'),
   summary:T('Demo Institution A submitted its second application for review.','演示机构 A 已提交第 2 次认证申请，待审核。'),
   body:T('Demo Institution A submitted its institution certification application.\n\nThis is the second submission for this account. The submitted profile and supporting documents are available in the institution review record.',
          '演示机构 A 已提交机构认证申请。\n\n本次为该账户的第 2 次提交，提交的机构资料与材料可在机构认证审核记录中查看。'),
   business:{name:T('Demo Institution A','演示机构 A'),number:'DEMO-REG-001'}},

  /* 定时生效成功告警 · 全体运营 · 目标为该协议实际生效的版本 */
  {category:'alert',target:agreementVersion('DEMO-PRIVACY',1,9),
   title:T('Privacy policy version 1 took effect as scheduled','隐私政策 第 1 版 已按计划生效'),
   summary:T('The scheduled release completed and this version is now in effect.','定时发布已执行，该版本现为生效版本。'),
   body:T('The scheduled release for Privacy policy version 1 completed successfully.\n\nThis version is now the effective agreement content shown to customers.',
          '隐私政策 第 1 版 的定时发布已执行成功。\n\n该版本现为对客展示的生效协议内容。'),
   business:{name:T('Privacy policy · version 1','隐私政策 第 1 版')}},

  /* 密码变更通知 · 本人 · 目标为本人账户设置（静态页面） */
  {category:'account',personal:true,target:{to:'settings',route:'/ops/account',permission:14,page:true},
   title:T('Your sign-in password was changed','你的登录密码已变更'),
   summary:T('Your account password has been updated. Review your account if this was unexpected.','账户登录密码已更新。如非本人操作，请及时检查账户。'),
   body:T('The sign-in password for your account was changed.\n\nIf you did not make this change, contact operations support and reset your password from account settings.',
          '你的账户登录密码已变更。\n\n如非本人操作，请联系运维并在账户设置中重置密码。')
   },

  /* 机构资料待审核 · 该次提交的结论已生效：原动作不可用、原记录只读 */
  {category:'review',target:application('DEMO-REG-007'),demoMode:'handled',
   title:T('Institution application DEMO-REG-007 is ready for review','机构认证申请 DEMO-REG-007 待审核'),
   summary:T('Demo Institution F submitted its application and supporting documents.','演示机构 F 已提交认证申请及材料。'),
   body:T('Demo Institution F submitted its institution certification application.\n\nThe submitted profile and supporting documents are available in the institution review record.',
          '演示机构 F 已提交机构认证申请。\n\n提交的机构资料与材料可在机构认证审核记录中查看。'),
   business:{name:T('Demo Institution F','演示机构 F'),number:'DEMO-REG-007'}},

  /* 定时生效失败告警 · 全体运营 · 目标为待生效版本及当前仍生效版本 */
  {category:'alert',target:agreementDetail('DEMO-SERVICE',9),
   title:T('Scheduled release failed for Service agreement version 3','服务协议 第 3 版 定时生效失败'),
   summary:T('Version 3 did not take effect. Version 2 remains the effective content.','第 3 版未能生效，当前仍以第 2 版为生效内容。'),
   body:T('The scheduled release for Service agreement version 3 did not complete.\n\nVersion 2 remains the effective agreement content. Version 3 will try again at the next 24:00. Open the agreement to check the pending version and decide how to continue.',
          '服务协议 第 3 版 的定时发布未能执行完成。\n\n当前仍以第 2 版为生效协议内容，第 3 版将在下一个 24:00 再次生效。可进入该协议查看待生效版本并决定后续处理。'),
   business:{name:T('Service agreement · version 3','服务协议 第 3 版')}},

  /* 待生效计划撤销告警 · 全体运营 · 被撤销的版本已移除，目标为该协议的协议详情 */
  {category:'alert',target:agreementDetail('DEMO-FIRST',9),
   title:T('Scheduled activation of First release agreement version 1 was cancelled','首版协议 第 1 版 的定时生效已撤销'),
   summary:T('Version 1 and its file were removed before taking effect.','第 1 版及其文件已在生效前移除。'),
   body:T('Demo operator · op***@example.invalid cancelled First release agreement version 1, which was scheduled for the next 24:00.\n\nThe version and its file were removed. No version of this agreement took effect from it. Open the agreement to review its current state.',
          '演示运营人员 · op***@example.invalid 撤销了首版协议 第 1 版，该版本原定于下一个 24:00 生效。\n\n该版本及其文件已移除，未使任何版本生效。可进入该协议查看当前状态。'),
   business:{name:T('First release agreement · version 1','首版协议 第 1 版')}},

  /* 定时生效成功告警（较早）· 目标版本现已成为历史版本，按历史版本读取判权 */
  {category:'alert',target:agreementVersion('DEMO-SERVICE',1,15),
   title:T('Service agreement version 1 took effect as scheduled','服务协议 第 1 版 已按计划生效'),
   summary:T('The scheduled release completed. A newer version has since replaced it.','定时发布已执行成功，之后已由更新版本替代。'),
   body:T('The scheduled release for Service agreement version 1 completed successfully.\n\nA newer version has since taken effect, so this version is kept as version history.',
          '服务协议 第 1 版 的定时发布已执行成功。\n\n此后已有更新版本生效，该版本作为历史版本留存。'),
   business:{name:T('Service agreement · version 1','服务协议 第 1 版')}}
 ],
 seed(){
  const n=this.templates.length;
  const institutions=['A','B','C','D','E'];
  return Array.from({length:126},(_,i)=>{
   const t=structuredClone(this.templates[i%n]);
   if(t.category==='review'&&t.demoMode!=='handled'&&i>=n){
    const suffix=String((i%5)+1).padStart(3,'0'),letter=institutions[i%5];
    t.target=application('DEMO-REG-'+suffix);
    t.title={en:'Institution application DEMO-REG-'+suffix+' is ready for review',zh:'机构认证申请 DEMO-REG-'+suffix+' 待审核'};
    t.summary={en:'Demo Institution '+letter+' submitted its application and supporting documents.',zh:'演示机构 '+letter+' 已提交认证申请及材料。'};
    t.body={en:'Demo Institution '+letter+' submitted its institution certification application.\n\nThe submitted profile and supporting documents are available in the institution review record.',
            zh:'演示机构 '+letter+' 已提交机构认证申请。\n\n提交的机构资料与材料可在机构认证审核记录中查看。'};
    t.business={name:T('Demo Institution '+letter,'演示机构 '+letter),number:'DEMO-REG-'+suffix};
   }
   return {...t,id:'ops-demo-'+String(i+1).padStart(3,'0'),platform:'lending',end:'admin',
    owner:t.personal?'operator@example.com':null,
    at:new Date(now-600000-i*3600000).toISOString(),
    initialRead:i%4===3,expires:null};
  }).concat([
   {id:'other-platform',platform:'issuance',end:'admin',at:new Date(now).toISOString()},
   {id:'other-end',platform:'lending',end:'asset',at:new Date(now).toISOString()},
   {id:'other-person',platform:'lending',end:'admin',owner:'someone@example.com',at:new Date(now).toISOString()}
  ]);
 }
};
})(window.CF);
