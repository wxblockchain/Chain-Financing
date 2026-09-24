/* Fictional fixtures only. Categories and destinations are metadata, not an event registry.
   承接范围按本端现行登记：全体运营＝机构资料待审核＋协议三类告警；本人＝密码变更通知。
   本模块不产生独立事件，池内不得出现已废止的时点提醒（临期、超时、催办）。 */
(function(CF){
const now=Date.now();
const T=(en,zh)=>({en,zh});
/* 目标指向仓库内既有的管理端演示记录，权限项沿各目标模块的交付配置。 */
const agreementVersion=(id,n,permission)=>({to:'agreements',route:'/ops/agreements/version?id='+id+'&v='+n+'&tab=history',permission,
 records:{route:'/ops/agreements/detail?id='+id+'&tab=basic',permission:16}});
/* 生效失败的目标是协议详情的基本信息：待生效版本与当前仍生效版本在此同屏可得，且不依赖历史版本读取权限。 */
const agreementDetail=(id,permission)=>({to:'agreements',route:'/ops/agreements/detail?id='+id+'&tab=basic',permission,
 records:{route:'/ops/agreements/detail?id='+id+'&tab=basic',permission:16}});
const application=id=>({to:'institution',route:'/ops/institution-reviews/detail?state=submitted&q=&from=&to=&page=1&application='+id,permission:5});

CF.opsMessageDemo={
 categories:{
  review:T('Review requests','审核待办'),
  agreement:T('Agreement alerts','协议告警'),
  security:T('Account security','账户安全')
 },
 templates:[
  /* 机构资料待审核 · 全体运营 · 目标为该申请的机构审核详情并定位本次提交 */
  {category:'review',target:application('DEMO-REG-001'),
   title:T('Institution application DEMO-REG-001 is ready for review','机构认证申请 DEMO-REG-001 待审核'),
   summary:T('Demo Institution A submitted its second application for review.','演示机构 A 已提交第 2 次认证申请，待审核。'),
   body:T('Demo Institution A submitted its institution certification application.\n\nThis is the second submission for this account. The submitted profile and supporting documents are available in the institution review record.',
          '演示机构 A 已提交机构认证申请。\n\n本次为该账户的第 2 次提交，提交的机构资料与材料可在机构认证审核记录中查看。'),
   relation:[['Application','申请编号','DEMO-REG-001'],['Institution','机构名称',T('Demo Institution A','演示机构 A')],['Submission','提交次数',T('Submission 2','第 2 次提交')]]},

  /* 定时生效成功告警 · 全体运营 · 目标为该协议实际生效的版本 */
  {category:'agreement',target:agreementVersion('DEMO-PRIVACY',1,9),
   title:T('Privacy policy version 1 took effect as scheduled','隐私政策 第 1 版 已按计划生效'),
   summary:T('The scheduled release completed and this version is now in effect.','定时发布已执行，该版本现为生效版本。'),
   body:T('The scheduled release for Privacy policy version 1 completed successfully.\n\nThis version is now the effective agreement content shown to customers.',
          '隐私政策 第 1 版 的定时发布已执行成功。\n\n该版本现为对客展示的生效协议内容。'),
   relation:[['Agreement','协议名称',T('Privacy policy','隐私政策')],['Version','版本号',T('Version 1','第 1 版')],['Outcome','执行结果',T('Took effect','已生效')]]},

  /* 密码变更通知 · 本人 · 目标为本人账户设置（静态页面） */
  {category:'security',personal:true,target:{to:'settings',route:'/ops/account',permission:14,page:true},
   title:T('Your sign-in password was changed','你的登录密码已变更'),
   summary:T('Your account password has been updated. Review your account if this was unexpected.','账户登录密码已更新。如非本人操作，请及时检查账户。'),
   body:T('The sign-in password for your account was changed.\n\nIf you did not make this change, contact operations support and reset your password from account settings.',
          '你的账户登录密码已变更。\n\n如非本人操作，请联系运维并在账户设置中重置密码。'),
   relation:[['Account','账户',T('Your own account','本人账户')]]},

  /* 机构资料待审核 · 该次提交的结论已生效：原动作不可用、原记录只读 */
  {category:'review',target:application('DEMO-REG-007'),demoMode:'handled',
   title:T('Institution application DEMO-REG-007 is ready for review','机构认证申请 DEMO-REG-007 待审核'),
   summary:T('Demo Institution F submitted its application and supporting documents.','演示机构 F 已提交认证申请及材料。'),
   body:T('Demo Institution F submitted its institution certification application.\n\nThe submitted profile and supporting documents are available in the institution review record.',
          '演示机构 F 已提交机构认证申请。\n\n提交的机构资料与材料可在机构认证审核记录中查看。'),
   relation:[['Application','申请编号','DEMO-REG-007'],['Institution','机构名称',T('Demo Institution F','演示机构 F')],['Submission','提交次数',T('Submission 1','第 1 次提交')]]},

  /* 定时生效失败告警 · 全体运营 · 目标为待生效版本及当前仍生效版本 */
  {category:'agreement',target:agreementDetail('DEMO-SERVICE',9),
   title:T('Scheduled release failed for Service agreement version 3','服务协议 第 3 版 定时生效失败'),
   summary:T('Version 3 did not take effect. Version 2 remains the effective content.','第 3 版未能生效，当前仍以第 2 版为生效内容。'),
   body:T('The scheduled release for Service agreement version 3 did not complete.\n\nVersion 2 remains the effective agreement content. Open the agreement to check the pending version and decide how to continue.',
          '服务协议 第 3 版 的定时发布未能执行完成。\n\n当前仍以第 2 版为生效协议内容。可进入该协议查看待生效版本并决定后续处理。'),
   relation:[['Agreement','协议名称',T('Service agreement','服务协议')],['Pending version','待生效版本',T('Version 3','第 3 版')],['Still in effect','当前生效版本',T('Version 2','第 2 版')]]},

  /* 待生效计划撤销告警 · 全体运营 · 目标为被撤销的待生效版本 */
  {category:'agreement',target:agreementVersion('DEMO-FIRST',1,9),
   title:T('Scheduled plan withdrawn for First release agreement version 1','首版协议 第 1 版 待生效计划已撤销'),
   summary:T('The confirmed release plan for version 1 was withdrawn.','该版本已确认的定时生效计划被撤销。'),
   body:T('The confirmed release plan for First release agreement version 1 was withdrawn.\n\nNo version of this agreement took effect from this plan. Open the version to review its current state.',
          '首版协议 第 1 版 已确认的定时生效计划被撤销。\n\n本次计划未使任何版本生效。可进入该版本查看当前状态。'),
   relation:[['Agreement','协议名称',T('First release agreement','首版协议')],['Version','版本号',T('Version 1','第 1 版')],['Outcome','计划结果',T('Plan withdrawn','计划已撤销')]]},

  /* 定时生效成功告警（较早）· 目标版本现已成为历史版本，按历史版本读取判权 */
  {category:'agreement',target:agreementVersion('DEMO-SERVICE',1,15),
   title:T('Service agreement version 1 took effect as scheduled','服务协议 第 1 版 已按计划生效'),
   summary:T('The scheduled release completed. A newer version has since replaced it.','定时发布已执行成功，之后已由更新版本替代。'),
   body:T('The scheduled release for Service agreement version 1 completed successfully.\n\nA newer version has since taken effect, so this version is kept as version history.',
          '服务协议 第 1 版 的定时发布已执行成功。\n\n此后已有更新版本生效，该版本作为历史版本留存。'),
   relation:[['Agreement','协议名称',T('Service agreement','服务协议')],['Version','版本号',T('Version 1','第 1 版')],['Outcome','执行结果',T('Took effect','已生效')]]}
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
    t.relation=[['Application','申请编号','DEMO-REG-'+suffix],['Institution','机构名称',T('Demo Institution '+letter,'演示机构 '+letter)],['Submission','提交次数',T('Submission 1','第 1 次提交')]];
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
