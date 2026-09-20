/* Demonstration fixtures only. No requests, signatures or real business data. */
(function(CF){
  CF.pledgeSeed = function(){
    const now=Date.now(), H=3600000;
    const rows=Array.from({length:36},(_,i)=>{
      const n=String(i+1).padStart(3,'0'), group=i<4?1:Math.floor((i-4)/3)+2;
      const submitted=now-(i<4?30:2+group)*H;
      return {id:'DEMO-PR-'+n,token:'DEMO-TK-'+n,batch:'PA-DEMO-'+String(group).padStart(3,'0'),
        owner:i<4?'A':group%2?'B':'A',project:i<4?'01':group%3?'01':'02',type:i<4?'first':'add',
        value:125000+i*7500,amount:125000+i*7500,currency:'USD',term:90+i%3*30,buyer:'DEMO-BUYER-'+(i%3+1),
        valid:true,submitted,deadline:submitted+48*H,status:'pending',decisionAt:null,operator:null,
        entryDeadline:null,reason:'',category:'',remark:'',files:[],follow:'none',fee:null,tx:null,
        started:null,completed:null,events:[{at:submitted,title:['Application submitted','申请已提交'],actor:['Asset holder','资产方'],text:''}]};
    });
    function approved(i,follow){let r=rows[i];r.status='approved';r.decisionAt=now-H;r.operator=['Demo operator Lin','示例审核员林'];r.entryDeadline=now+6*24*H;r.follow=follow;r.files=[{id:'demo-agreement',name:'Demo-pledge-agreement.pdf',sample:true,state:'ready'}];r.events.unshift({at:r.decisionAt,title:['Approved','审核通过'],actor:r.operator,text:''});return r;}
    approved(3,'ready');approved(24,'success');approved(25,'failed');approved(26,'processing');approved(27,'verify');approved(28,'difference');approved(29,'invalid');approved(30,'expired');
    [24,25,26,27,28].forEach(i=>{rows[i].started=now-0.75*H;rows[i].fee=i===27?null:0.0012;rows[i].feeCurrency='ETH';});
    rows[24].completed=now-0.5*H;rows[24].tx='DEMO-TX-024';rows[25].completed=now-0.5*H;rows[25].executionReason=['Transfer rejected by execution platform','执行平台返回转入失败'];
    rows[28].executionReason=['Late success conflicts with the original record. Further actions on this token are paused.','迟到成功与原记录冲突，该代币后续操作已暂停。'];
    rows[29].executionReason=['Project is closed','项目已终结'];rows[30].batch='PA-DEMO-OLD';rows[30].submitted=now-9*24*H;rows[30].deadline=rows[30].submitted+48*H;rows[30].decisionAt=now-8*24*H;rows[30].entryDeadline=now-24*H;
    rows[31].status='rejected';rows[31].reason='申请材料中的代币编号与本次提交不一致，请核对后重新申请。';rows[31].decisionAt=now-H;rows[31].operator=['Demo operator Chen','示例审核员陈'];
    rows[32].status='withdrawn';rows[32].ended=now-H;
    rows[33].batch='PA-DEMO-TIMEOUT';rows[33].status='timeout';rows[33].submitted=now-50*H;rows[33].deadline=now-2*H;rows[33].ended=rows[33].deadline;
    rows[34].token=rows[31].token;rows[34].owner=rows[31].owner;rows[34].project=rows[31].project;rows[34].previous=rows[31].id;rows[34].batch='PA-DEMO-NEW';rows[34].submitted=now-0.5*H;rows[34].deadline=rows[34].submitted+48*H;
    rows[35].value=null;rows[35].buyer=null;rows[35].valid=false;
    rows.forEach(r=>{r.events=[{at:r.submitted,title:['Application submitted','申请已提交'],actor:['Asset holder','资产方'],text:''}];if(r.status!=='pending')r.events.unshift({at:r.decisionAt||r.ended,title:({approved:['Approved','审核通过'],rejected:['Rejected','审核驳回'],withdrawn:['Withdrawn','申请撤回'],timeout:['Review timed out','审核超时']})[r.status],actor:r.operator||(r.status==='withdrawn'?['Asset holder','资产方']:['System','系统']),text:r.reason});if(r.decisionAt)r.reviewId=r.id.replace('PR','RV');});
    return {now,rows};
  };
})(window.CF=window.CF||{});
