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
    rows.forEach(r=>{
      // Explicit local event fixtures. Unknown timestamps remain unknown.
      const add=(key,at,title,result,extra={})=>r.events.push({id:r.id+':'+key,at,title,result,actor:['System','系统'],...extra});
      r.events=[];
      add('submitted',r.submitted,['Application submitted','申请已提交'],['Pending review','待审核'],{actor:['Asset holder','资产方']});
      if(r.decisionAt)r.reviewId=r.id.replace('PR','RV');
      if(r.status!=='pending')add('review',r.decisionAt||r.ended,({approved:['Approved','审核通过'],rejected:['Rejected','审核驳回'],withdrawn:['Withdrawn','申请撤回'],timeout:['Review timed out','审核超时']})[r.status],({approved:['Pending review → Approved · awaiting asset holder confirmation','待审核 → 已通过 · 待资产方确认入池'],rejected:['Pending review → Rejected','待审核 → 已驳回'],withdrawn:['Pending review → Withdrawn','待审核 → 已撤回'],timeout:['Pending review → Timed out · hold released, no execution fee','待审核 → 审核超时 · 占用已释放，未执行零费用']})[r.status],{actor:r.operator||(r.status==='withdrawn'?['Asset holder','资产方']:['System','系统']),text:r.status==='approved'?['At approval: deposit pre-check and execution had not started; no execution fee.','通过时：尚未进行入池复核或发起执行，未产生执行费用。']:r.reason,files:r.files.map(f=>({name:f.name}))});
      if(r.follow==='invalid')add('precheck',now-.6*H,['Pre-check invalidated','复核作废'],['Approved → Invalidated · not executed, no fee','已通过 → 已作废 · 未执行，零费用'],{text:r.executionReason});
      if(r.follow==='expired')add('expired',r.entryDeadline,['Initiation window expired','未发起已过有效期'],['Awaiting confirmation → Expired · not executed, no fee','待确认入池 → 已过期 · 未执行，零费用']);
      if(r.started){
        add('precheck',r.started-60000,['Pre-check passed','入池前复核通过'],['Eligible for initiation','符合发起条件']);
        add('started',r.started,['Execution initiated','执行已发起'],['Awaiting confirmation → Executing','待确认入池 → 执行中'],{actor:['Asset holder','资产方'],execution:true,started:r.started,completed:null,fee:null,feeCurrency:r.feeCurrency});
        if(r.follow==='processing')add('fee',r.started+60000,['Execution in progress','执行处理中'],['Awaiting execution result','等待执行结果'],{execution:true,started:r.started,completed:null,fee:r.fee,feeCurrency:r.feeCurrency});
        if(['success','failed'].includes(r.follow))add('result',r.completed,r.follow==='success'?['Execution succeeded','执行成功']:['Execution failed','执行失败'],r.follow==='success'?['Executing → Succeeded','执行中 → 执行成功']:['Executing → Failed','执行中 → 执行失败'],{execution:true,started:r.started,completed:r.completed,fee:r.fee,feeCurrency:r.feeCurrency,text:r.executionReason,tx:r.tx});
        if(r.follow==='verify')add('verification',null,['Result under verification','结果待核实'],['Executing → Under verification','执行中 → 待核实'],{execution:true,started:r.started,completed:null,fee:null,actor:null,text:['Execution result has not been confirmed.','执行结果尚未确认。']});
        if(r.follow==='difference'){
          add('prior-result',now-.5*H,['Failure reported','曾收到失败结果'],['Executing → Reported failed','执行中 → 已报失败'],{execution:true,started:r.started,completed:now-.5*H,fee:r.fee,feeCurrency:r.feeCurrency,text:['Earlier execution response retained.','保留原执行响应。']});
          add('discrepancy',now-.25*H,['Reconciliation discrepancy','对账差异'],['Reported failed → Conflicting success received','已报失败 → 收到冲突成功结果'],{execution:true,started:r.started,completed:null,fee:r.fee,feeCurrency:r.feeCurrency,text:r.executionReason,tx:'DEMO-LATE-TX-029'});
        }
      }
    });
    return {now,rows};
  };
})(window.CF=window.CF||{});
