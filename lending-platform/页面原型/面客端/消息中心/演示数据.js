/* 非业务登记表。全部为虚构评审数据；接入方、业务规则及消息文案不构成上线登记。 */
(function(CF){
  const pair=(en,zh)=>({en,zh});
  const D=CF.NCData={
    categories:{progress:pair('Business progress','业务办理进度'),account:pair('Account','账户'),service:pair('Service updates','服务动态')},
    types:{
      'demo.case.progress':{mode:'object',target:'lending:P-LS-01',panel:'detail',preflight:true},
      'demo.account.notice':{mode:'none'},
      'demo.service.update':{mode:'page',target:'lending:P-F-MC-01'}
    },
    templates:{
      'demo.case.progress':{title:pair('Demo request {reference}','演示申请 {reference}'),body:pair('Your request {reference} has an update.\nReview the latest information before continuing.\n\nThis message records the update at the time it was sent.','你的申请 {reference} 有了新的进展。\n请查看最新信息后继续办理。\n\n此消息记录发送时的进展。')},
      'demo.account.notice':{title:pair('Your account information has been updated','你的账户信息已更新'),body:pair('Your account information was updated.\nYou can review the information from your account.','你的账户信息已更新。\n你可以在账户中查看最新信息。')},
      'demo.service.update':{title:pair('A service update is available','你收到一条服务动态'),body:pair('You can now review the latest service information in your messages.','你可以在消息中心查看最新服务信息。')},
      'demo.unregistered.notice':{title:pair('A new record is available','你收到一条新记录'),body:pair('The record has been saved for you to review.','记录已保存，你可以随时查阅。')}
    },rows:[]
  };
  const states=['active','pending','complete','failed'];
  const nodes=[pair('Review in progress','资料核对'),pair('Information needed','补充资料'),pair('Review completed','核对完成'),pair('Review unsuccessful','核对未通过')];
  ['asset','fund'].forEach((owner,ri)=>{
    for(let i=0;i<(ri?37:125);i++){
      const progress=i%3===0;
      const r={id:'demo-'+owner+'-'+((i+73)*2654435761>>>0).toString(16),owner,platform:'lending',end:'asset',
        biz:progress?'demo.case.progress':i%3===1?'demo.account.notice':'demo.service.update',
        category:progress?'progress':i%3===1?'account':'service',at:new Date(Date.UTC(2026,8,18,9,30)-i*1800000).toISOString(),
        vars:{reference:'DEMO-'+String(7001+Math.floor(i/4))},read:i%7===6,
        check:['ok','deleted','changed','denied','timeout'][Math.floor(i/3)%5]};
      if(progress)r.progress={name:pair('Demo service request','演示业务申请'),number:r.vars.reference,node:nodes[Math.floor(i/3)%4],state:states[Math.floor(i/3)%4],step:i===12?null:2,total:5};
      if(i===4)r.expires='2026-01-01T00:00:00Z';
      if(i===5){r.biz='demo.unregistered.notice';r.category='unregistered';}
      if(i===7)r.missing=true;
      if(i===8)r.onlyZh=true;
      if(i===9)r.vars={};
      if(i===10)r.literal='<script>alert("demo")</script>\nPlain text <b>only</b> / 仅作为纯文本展示';
      if(i===15)r.progress.state='unknown';
      if(progress)r.objectId='S-FP-26090107';
      D.rows.push(r);
    }
  });
  // 异常隔离夹具：不出现在可见池内。
  D.rows.push({...D.rows[0],id:'foreign-platform',platform:'token'});
  D.rows.push({...D.rows[0],id:'other-member',owner:'other-member'});
  D.addType=function(){
    D.categories.newdemo=pair('New demonstration category','新增演示分类');
    D.types['demo.extension.received']={mode:'none'};
    D.templates['demo.extension.received']={title:pair('New demonstration message {reference}','新增演示消息 {reference}'),body:pair('This record is ready for you to review.','这条记录已准备好供你查阅。')};
    if(!D.rows.some(r=>r.id==='demo-extension-'+CF.S.role))D.rows.push({id:'demo-extension-'+CF.S.role,platform:'lending',end:'asset',owner:CF.S.role,biz:'demo.extension.received',category:'newdemo',vars:{reference:'DEMO-NEW'},read:false,at:'2026-09-18T10:00:00Z'});
  };
})(window.CF);
