/* Fictional fixtures only. Categories and destinations are metadata, not an event registry. */
(function(CF){
const now=Date.now();
CF.opsMessageDemo={
 categories:{review:{en:'Review requests',zh:'审核待办'},operations:{en:'Operations',zh:'运营通知'},security:{en:'Account security',zh:'账户安全'}},
 templates:[
  {category:'review',title:{en:'An institution application is ready for review',zh:'一笔机构认证申请待审核'},summary:{en:'Demo Institution A has submitted its application and supporting documents.',zh:'演示机构 A 已提交认证申请及材料，请查阅。'},body:{en:'Demo Institution A has submitted its institution certification application.\n\nThe application and supporting documents are ready for review. Open the related record to view the materials.',zh:'演示机构 A 已提交机构认证申请。\n\n申请信息及相关材料已齐备，可前往业务记录查看材料并继续处理。'},target:'record'},
  {category:'operations',title:{en:'Your operations notice is available',zh:'本期运营通知已发布'},summary:{en:'Read the latest arrangements for the operations team.',zh:'请查阅本期运营工作安排。'},body:{en:'Please review the latest operations arrangements.\n\nContinue to use the corresponding business lists to check the current status of each record.',zh:'请查阅本期运营工作安排。\n\n各项业务的当前状态请以对应业务列表为准。'}},
  {category:'security',title:{en:'Your sign-in password was changed',zh:'你的登录密码已变更'},summary:{en:'Your account password has been updated. Review your account if this was unexpected.',zh:'账户登录密码已更新。如非本人操作，请及时检查账户。'},body:{en:'The sign-in password for your account was changed.\n\nIf you did not make this change, contact operations support and reset your password.',zh:'你的账户登录密码已变更。\n\n如非本人操作，请联系运维并及时重置密码。'},target:'page',personal:true}
 ],
 seed(){return Array.from({length:127},(_,i)=>{const t=structuredClone(this.templates[i%3]);if(i%3===0){const ref='DEMO-'+String(i+1).padStart(4,'0');t.title={en:'Institution application '+ref+' is ready for review',zh:'机构认证申请 '+ref+' 待审核'};}return {...structuredClone(t),id:'ops-demo-'+String(i+1).padStart(3,'0'),platform:'lending',end:'admin',owner:t.personal?'operator@example.com':null,at:new Date(now-600000-i*3600000).toISOString(),initialRead:i%4===3,ref:'DEMO-'+String(i+1).padStart(4,'0'),expires:i===9?new Date(now-1000).toISOString():null};}).concat([
  {id:'other-platform',platform:'issuance',end:'admin',at:new Date(now).toISOString()},
  {id:'other-end',platform:'lending',end:'asset',at:new Date(now).toISOString()},
  {id:'other-person',platform:'lending',end:'admin',owner:'someone@example.com',at:new Date(now).toISOString()}
 ])}
};
})(window.CF);
