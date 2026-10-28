/* Fictional fixtures only. Categories and destinations are metadata, not an event registry.
   承接范围按本端现行登记：全体运营＝机构资料待审核（审核任务）＋协议两类告警：定时生效成功、定时生效失败（运营告警）；本人＝密码变更通知（账户安全）。
   本模块不产生独立事件，池内不得出现已废止的时点提醒（临期、超时、催办）。 */
(function(CF){
const now=Date.now();
const T=(en,zh)=>({en,zh});
/* 目标指向仓库内既有的运营端演示记录，权限项沿各目标模块的交付配置。
   协议两类告警都定位到原协议的协议详情，并在版本历史中标出这一版本；进入协议详情按协议当前内容与工作版本查询判权。 */
const agreementDetail=(id,n)=>({to:'agreements',route:'/ops/agreements/detail?id='+id+'&v='+n,permission:9});
/* 正文中的时点以 {time:键} 占位，阅读时按本人时区展示并标注时区；事实本身存 UTC。 */
const day=(()=>{const d=new Date(now);return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())).toISOString()})();
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

  /* 定时生效成功告警 · 全体运营 · 目标为该协议的协议详情，版本历史中标出实际生效的版本 */
  {category:'alert',target:agreementDetail('DEMO-PRIVACY',1),
   title:T('Privacy policy v1 took effect as scheduled','隐私政策 v1 已按计划生效'),
   summary:T('v1 is now the effective version of Privacy policy.','v1 现为隐私政策的生效版本。'),
   body:T('Privacy policy v1 took effect as scheduled.\n\nEffective time: {time:effective}',
          '隐私政策 v1 已按计划生效。\n\n实际生效时间：{time:effective}'),
   times:{effective:'2026-09-19T00:00:00Z'},
   business:{name:T('Privacy policy v1','隐私政策 v1'),number:'DEMO-PRIVACY'}},

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

  /* 定时生效失败告警 · 全体运营 · 目标为该协议的协议详情，版本历史中同时可辨认待生效版本与当前仍生效版本 */
  {category:'alert',target:agreementDetail('DEMO-SERVICE',3),
   title:T('Service agreement v3 could not take effect as scheduled','服务协议 v3 未能按计划生效'),
   summary:T('v3 did not take effect. v2 remains the effective version.','v3 未能生效，当前仍生效的版本为 v2。'),
   body:T('Service agreement v3 could not take effect as scheduled.\n\nScheduled time: {time:planned}\nVersion currently in effect: v2\n\nv3 will take effect again at the next 24:00 (UTC).',
          '服务协议 v3 未能按计划生效。\n\n原定生效时间：{time:planned}\n当前仍生效的版本：v2\n\nv3 将在下一个 24:00（UTC）再次生效。'),
   times:{planned:day},
   business:{name:T('Service agreement v3','服务协议 v3'),number:'DEMO-SERVICE'}},

  /* 定时生效成功告警（较早）· 该版本此后已被替换归档，打开后由协议详情说明当前状态 */
  {category:'alert',target:agreementDetail('DEMO-SERVICE',1),
   title:T('Service agreement v1 took effect as scheduled','服务协议 v1 已按计划生效'),
   summary:T('v1 is now the effective version of Service agreement.','v1 现为服务协议的生效版本。'),
   body:T('Service agreement v1 took effect as scheduled.\n\nEffective time: {time:effective}',
          '服务协议 v1 已按计划生效。\n\n实际生效时间：{time:effective}'),
   times:{effective:'2026-09-12T00:00:00Z'},
   business:{name:T('Service agreement v1','服务协议 v1'),number:'DEMO-SERVICE'}}
 ],
 seed(){
  const n=this.templates.length;
  const institutions=['A','B','C','D','E'];
  return Array.from({length:126},(_,i)=>{
   const t=structuredClone(this.templates[i%n]);
   /* 协议告警每个事实只出现一次：后续循环位改作机构审核样例，不重复同一协议、版本与生效日界。 */
   if(i>=n&&((t.category==='review'&&t.demoMode!=='handled')||t.category==='alert')){
    t.category='review';delete t.times;
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
    /* 协议告警的发生时间取该生效日界。 */
    at:t.times?(t.times.effective||t.times.planned):new Date(now-600000-i*3600000).toISOString(),
    initialRead:i%4===3,expires:null};
  }).concat([
   {id:'other-platform',platform:'issuance',end:'admin',at:new Date(now).toISOString()},
   {id:'other-end',platform:'lending',end:'asset',at:new Date(now).toISOString()},
   {id:'other-person',platform:'lending',end:'admin',owner:'someone@example.com',at:new Date(now).toISOString()}
  ]);
 }
};
})(window.CF);
