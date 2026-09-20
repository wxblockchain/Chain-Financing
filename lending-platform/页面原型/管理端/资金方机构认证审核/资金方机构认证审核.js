/* WS-358 · Local review simulation, composed with the existing funder account flow. */
(function(CF){
  'use strict';
  const S=CF.S,L=CF.L,E=CF.esc,R=CF.funder.review,$=id=>document.getElementById(id);
  const copy=x=>JSON.parse(JSON.stringify(x));
  const A={session:true,sessionEpoch:0,selected:'DEMO-REG-001',version:0,filter:{state:'submitted',q:'',from:'',to:''},page:1,error:'',busy:false,
    response:'success',material:'ready',pending:null,issues:[],additional:'',rejectError:false,queryError:false,duplicate:false,limited:false,template:'ready',extras:[],audit:[]};
  const targets=[['name','Institution name','机构名称'],['country','Country or region','注册国家或地区'],['identifierType','Identifier type','标识类型'],['identifier','Institution identifier','机构唯一标识'],['institutionType','Institution type','机构类型'],['registeredAddress','Registered address','注册地址'],['regulator','Regulator','监管机构'],['license','Financial licence number','金融牌照编号'],['contact','Business contact email','业务联系人邮箱'],['file','Institution document','机构证明材料']];
  const label=k=>targets.find(x=>x[0]===k)?.slice(1)||['Field','字段'];
  const btn=(en,zh,act,v='',kind='',disabled=false)=>`<button type="button" class="btn ${kind}" data-act="rv-${act}" data-v="${E(v)}" ${disabled?'disabled':''}>${L(en,zh)}</button>`;
  const link=(en,zh,act,v='')=>`<button type="button" class="btn-link" data-act="rv-${act}" data-v="${E(v)}">${L(en,zh)}</button>`;
  const time=t=>t?CF.fmtTime(t):'—';
  const name=s=>L(...({submitted:['Pending review','待审核'],verified:['Approved','已通过'],rejected:['Rejected','已驳回'],draft:['Not submitted','未提交']}[s]));
  const tag=s=>CF.tag(s==='verified'?'ok':s==='rejected'?'danger':'warn',name(s));
  function rows(){return [{...R.account,id:'DEMO-REG-001'},...A.extras].filter(a=>a.version>0&&a.status!=='draft');}
  function selected(){return A.selected==='DEMO-REG-001'?R.account:A.extras.find(a=>a.id===A.selected);}
  function snapshot(){const a=selected();if(!a)return null;return A.version&&A.version!==a.version?a.history.find(h=>h.version===A.version):{...a,fields:a.submittedFields,form:a.submittedForm||a.form};}
  function allowed(){return S.end==='admin'&&S.role==='ops'&&A.session;}
  function canReview(){const a=selected();return allowed()&&a?.status==='submitted'&&(!A.version||A.version===a.version);}
  function expireSession(){A.session=false;A.sessionEpoch++;A.pending=null;A.busy=false;A.error='';S.layer=null;S.demo=false;}
  function go(page){S.layer=null;S.demo=false;S.st='default';A.error='';location.hash='#'+page;CF.render();}
  function open(key){CF.openLayer('modal','rv-'+key);queueMicrotask(()=>{focusLayer();if(key==='reject')$('rv-reason')?.focus();});}
  function note(){return A.error?CF.note('red',E(A.error)):'';}
  function title(en,zh,desc=''){return `<div class="page-head"><div><h1 class="page-title">${L(en,zh)}</h1>${desc?`<p class="page-desc">${desc}</p>`:''}</div>${CF.tag('neutral',L('Demonstration data','演示数据'))}</div>`;}
  function kv(data){return `<dl class="rv-kv">${data.map(x=>`<div ${x[0]==='Registered address'?'class="rv-wide"':''}><dt>${L(x[0],x[1])}</dt><dd>${E(String(x[2]||'—'))}</dd></div>`).join('')}</dl>`;}
  function fail(en,zh,desc,act='retry'){return CF.empty(L(en,zh),desc,btn('Retry','重试',act,'','primary'));}
  function signedOut(){return CF.empty(L('Sign in to continue','请先完成运营登录'),L('Your session has ended. Sign in again to view the current application and materials.','登录已失效，请重新登录后查看当前申请与材料。'),btn('Sign in again','重新登录','sign-in','','primary'));}
  function list(){
    if(!allowed())return signedOut();
    const f=A.filter;
    const filters=`<div class="filters rv-filters"><div class="field"><label for="rv-state">${L('Status','状态')}</label><select id="rv-state" class="inp">${['submitted','verified','rejected','all'].map(s=>`<option value="${s}" ${f.state===s?'selected':''}>${s==='all'?L('All decisions','全部结论'):name(s)}</option>`).join('')}</select></div><div class="field"><label for="rv-query">${L('Application / identifier / name','申请编号 / 机构标识 / 名称')}</label><input id="rv-query" class="inp" type="search" value="${E(f.q)}"></div><div class="field"><label for="rv-from">${L('Submitted from','提交开始日期')}</label><input id="rv-from" class="inp" type="date" value="${f.from}" aria-invalid="${A.queryError}"></div><div class="field"><label for="rv-to">${L('Submitted to','提交结束日期')}</label><input id="rv-to" class="inp" type="date" value="${f.to}" aria-invalid="${A.queryError}"></div><div class="acts">${btn('Search','查询','search','','primary')}${btn('Reset','重置','reset')}</div></div>`;
    let found=rows().filter(a=>{const fields=a.submittedForm||a.form;return(f.state==='all'||a.status===f.state)&&(!f.q||[a.id,fields.name,fields.identifier].some(v=>String(v).toLowerCase().includes(f.q.trim().toLowerCase())))&&(!f.from||localDay(a.submitted)>=f.from)&&(!f.to||localDay(a.submitted)<=f.to);}).sort((a,b)=>a.submitted.localeCompare(b.submitted));
    let body='';
    if(S.st==='loading')body=`<div role="status">${CF.skelTable(5)}</div>`;
    else if(S.st==='error')body=fail('Applications could not be loaded','申请列表加载失败',L('Retry to retrieve the application list.','请重试获取申请列表。'));
    else if(A.queryError)body=CF.note('red',L('Start date must not be later than end date.','开始日期不能晚于结束日期。'));
    else if(S.st==='empty'||S.st==='noresult'||!found.length)body=CF.empty(L(S.st==='empty'?'No submitted applications':'No matching applications',S.st==='empty'?'暂无已提交申请':'没有符合条件的申请'),L('Try clearing your filters.','可清除筛选后查看。'),btn('Clear filters','清除筛选','reset'));
    else {
      const pages=Math.ceil(found.length/5);A.page=Math.min(A.page,pages);
      body=`<div class="tablewrap"><table class="tbl rv-table"><thead><tr>${[['Application','申请编号'],['Institution','机构标识 / 名称'],['Submitted ↑','提交时间 ↑'],['Status','状态'],['Decision time','结论时间'],['Action','操作']].map((h,i)=>`<th ${i===5?'class="col-act"':''} ${i===2?'aria-sort="ascending"':''}>${L(...h)}</th>`).join('')}</tr></thead><tbody>${found.slice((A.page-1)*5,A.page*5).map(a=>{const f=a.submittedForm||a.form;return `<tr><td class="mono">${a.id}</td><td><b>${E(f.name)}</b><div class="rv-meta mono">${E(f.identifier)}</div></td><td class="rv-meta">${time(a.submitted)}</td><td>${tag(a.status)}</td><td class="rv-meta">${time(a.reviewed)}</td><td class="col-act">${link('View','查看','view',a.id)}</td></tr>`;}).join('')}</tbody></table></div><div class="rv-foot"><span class="rv-meta">${L(`${found.length} applications`,`${found.length} 条申请`)}</span><div>${btn('Previous','上一页','page',String(A.page-1),'',A.page===1)} <span class="rv-meta">${A.page} / ${pages}</span> ${btn('Next','下一页','page',String(A.page+1),'',A.page===pages)}</div></div>`;
    }
    return `<div class="review-wrap">${title('Institution certification','资金方机构认证审核',L('Review submitted institution information and supporting materials.','核对机构资料与提交材料，处理认证申请。'))}<section class="card">${filters}${body}</section></div>`;
  }
  function localDay(t){const p=new Intl.DateTimeFormat('en-CA',{timeZone:S.tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(t));return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');}
  function problemList(v){return(v.issues||[]).map(i=>`<div class="rv-history"><b>${E(L(...i.label))}</b><p>${E(L(i.en,i.zh))}</p></div>`).join('')+(v.additional?`<p class="rv-reason-text">${E(v.additional)}</p>`:'');}
  function detail(){
    if(!allowed())return signedOut();
    if(S.st==='loading')return CF.skelTable(6);
    if(S.st==='error')return fail('Application could not be loaded','申请详情加载失败',L('Materials are temporarily unavailable. Please retry.','资料暂不可读，请重试。'));
    const a=selected(),v=snapshot();if(!a||!v)return CF.empty(L('Version not found','未找到该申请版本'),' ',btn('Back to list','返回列表','back'));
    const old=v.version!==a.version,fields=v.fields||a.submittedFields||[],reviewable=canReview();
    return `<div class="review-wrap">${link('← Back to applications','← 返回申请列表','back')}${title('Application details','机构认证申请详情',A.selected+' · V'+v.version)}
      ${old?CF.note('warn',L('Historical version · read only.','历史版本 · 只读。')+' '+link('Return to current version','返回当前版本','version','0')):''}${note()}
      <div class="rv-grid ${reviewable?'has-actions':''}"><div class="rv-stack"><section class="card"><div class="card-b"><h2>${L('Submission','提交信息')} ${tag(v.status)}</h2>${kv([['Funder account','资金方账号',A.selected==='DEMO-REG-001'?'DEMO-FUNDER':'DEMO-FUNDER-'+A.selected.slice(-3)],['Template version','模版版本',v.template||'DEMO-1'],['Submitted','提交时间',time(v.submitted)],['Decision time','结论时间',time(v.reviewed)],['Current account contact email','当前账户联系邮箱',a.email],['Contact email at submission','提交时账户联系邮箱',v.snapshotEmail],['Wallet address','钱包地址',a.address]])}</div></section>
      <section class="card"><div class="card-b"><h2>${L('Institution information','机构资料')}</h2>${kv(fields.filter(x=>x[0]!=='Institution document'))}</div></section>
      <section class="card"><div class="card-b"><h2>${L('Supporting materials','提交材料')}</h2><div class="rv-doc"><span class="funder-file-icon" aria-hidden="true">▤</span><div><b>${E(v.form?.file||fields.find(x=>x[0]==='Institution document')?.[2]||'institution-demo.pdf')}</b><div class="rv-meta">${L('Institution document','机构证明材料')} · ${L('Version','版本')} ${v.version}${v.form?.fileSize?' · '+E(v.form.fileSize>=1048576?(v.form.fileSize/1048576).toFixed(1)+' MB':Math.ceil(v.form.fileSize/1024)+' KB'):''}</div></div>${btn('View material','查看材料','material')}</div></div></section>
      ${v.status==='rejected'?`<section class="card"><div class="card-b"><h2>${L('Rejection reasons','驳回原因')}</h2>${problemList(v)}</div></section>`:''}
      <section class="card"><div class="card-b"><h2>${L('Review decision','审核结论')}</h2>${v.reviewed?kv([['Decision','结论',name(v.status)],['Decided by','操作人',v.reviewer||'DEMO-OP-01'],['Decision time','结论时间',time(v.reviewed)]]):`<p class="rv-meta">${L('No decision yet','尚未出具结论')}</p>`}
      ${reviewable?'':CF.note('accent',L(old?'Historical versions cannot be reviewed.':'This version has a final decision and is read only.',old?'历史版本不可再次处置。':'该版本已出具结论，仅可查看。'))}</div></section></div>
      ${reviewable?`<aside class="card rv-operation" aria-labelledby="rv-operation-title"><div class="card-b"><h2 id="rv-operation-title">${L('Review actions','审核操作')}</h2><div class="rv-actions">${btn('Approve','通过','approve','','primary')}${btn('Reject','驳回','reject')}</div></div></aside>`:''}</div>
      <section class="card rv-version-history" aria-labelledby="rv-history-title"><div class="card-b"><h2 id="rv-history-title">${L('Version history','版本历史')}</h2></div><div class="tablewrap"><table class="tbl rv-version-table"><thead><tr><th>${L('Version','版本')}</th><th>${L('Submitted','提交时间')}</th><th>${L('Status','状态')}</th><th>${L('Decision time','结论时间')}</th><th class="col-act">${L('Action','操作')}</th></tr></thead><tbody>${[{...a},...a.history.slice().reverse()].map(h=>`<tr><td><b>V${h.version}</b>${h.version===a.version?`<div class="rv-meta">${L('Current submission','当前提交')}</div>`:''}</td><td class="rv-meta">${time(h.submitted)}</td><td>${tag(h.status)}</td><td class="rv-meta">${time(h.reviewed)}</td><td class="col-act">${h.version===v.version?`<span class="rv-meta" aria-current="true">${L('Viewing','正在查看')}</span>`:link('View','查看','version',String(h.version))}</td></tr>`).join('')}</tbody></table></div></section></div>`;
  }
  function ensureWrite(){if(!canReview()){A.error=allowed()?L('This version has changed or already has a decision. Review the current result.','申请版本已变化或已出具结论，请查看当前结果。'):L('Your session has ended. Sign in again before reviewing.','登录已失效，请重新登录后再审核。');A.pending=null;A.busy=false;S.layer=null;return false;}return true;}
  function begin(decision){if(A.pending&&A.response==='unknown'){open('unknown');return;}if(!ensureWrite())return;A.error='';A.pending={id:A.selected,version:selected().version,decision};if(decision==='verified')open('confirm');else{A.issues=[];A.additional='';A.rejectError=false;open('reject');}}
  function validReasons(){return !!A.additional.trim();}
  function confirm(){
    if(A.busy||!A.pending)return;
    if(!ensureWrite())return;
    if(A.pending.id!==A.selected||A.pending.version!==selected().version){A.error=L('The application has changed. View its current version.','申请版本已变化，请查看当前版本。');S.layer=null;return;}
    if(A.pending.decision==='rejected'&&!validReasons()){A.rejectError=true;open('reject');return;}
    const epoch=A.sessionEpoch;A.busy=true;CF.render();
    setTimeout(()=>{
      if(epoch!==A.sessionEpoch)return;
      A.busy=false;if(!ensureWrite()){CF.render();return;}
      if(A.response==='session'){expireSession();CF.render();return;}
      if(A.response==='stale'){apply('verified',[], '');A.error=L('Another operator has already processed this version. The current result is shown.','该版本已由其他运营人员处理，已显示当前结果。');A.pending=null;S.layer=null;CF.render();return;}
      if(A.response==='failed'){A.error=L('The decision could not be saved. No result was changed. Retry after checking the application.','审核提交失败，结论未改变。核对申请后可重试。');S.layer=null;CF.render();return;}
      if(A.response==='unknown'){open('unknown');return;}
      finish();
    },650);
  }
  function apply(status,issues,additional){
    const a=selected();if(a.status!=='submitted'||(A.pending&&A.pending.version!==a.version))return false;
    if(A.selected==='DEMO-REG-001')R.decide(a.version,status,copy(issues),additional);
    else{a.status=status;a.reviewed=new Date().toISOString();a.issues=copy(issues);a.additional=additional;a.reviewer='DEMO-OP-01';}
    A.audit.push({id:A.selected,version:a.version,status,time:a.reviewed});return true;
  }
  function finish(){
    if(!A.pending||!ensureWrite())return;
    if((A.duplicate||A.response==='duplicate'||hasDuplicate(selected().submittedForm||selected().form,A.selected))&&A.pending.decision==='verified'){A.error=L('This institution is already registered. Verify the institution identifier before proceeding.','该机构已在平台注册，请核实机构标识后处理。');S.layer=null;A.pending=null;CF.render();return;}
    const done=apply(A.pending.decision,[],A.pending.decision==='rejected'?A.additional.trim():'');A.pending=null;S.layer=null;A.error='';CF.render();if(done)CF.toast(L('Review decision saved.','审核结论已保存。'));
  }
  function rejectionForm(){return {title:L('Reject application','驳回申请'),html:`<div class="field rv-rejection"><label for="rv-reason">${L('Rejection reason *','驳回原因 *')}</label><textarea class="inp" id="rv-reason" rows="5" required aria-invalid="${A.rejectError}" aria-describedby="rv-reason-help${A.rejectError?' rv-reason-error':''}" placeholder="${L('Explain why the application is rejected and what needs to change.','请填写驳回原因及需要修改的内容。')}">${E(A.additional)}</textarea><p id="rv-reason-help" class="hint">${L('The applicant will see this reason.','申请人可查看此原因。')}</p>${A.rejectError?`<p id="rv-reason-error" class="err-msg" role="alert">${L('Enter a rejection reason.','请填写驳回原因。')}</p>`:''}</div>`,foot:btn('Cancel','取消','cancel')+btn('Review rejection','核对驳回内容','preview-reject','','primary')};}
  const layers={
    'rv-sign-in':()=>({title:L('Operations sign-in · simulation','运营登录 · 演示'),html:`<p>${L('This prototype simulates returning after operations sign-in. No real credentials are requested.','此原型模拟完成运营登录后的返回，不收集真实账号密码。')}</p>`,foot:btn('Cancel','取消','cancel')+btn('Simulate successful sign-in','模拟登录成功','signed-in','','primary')}),
    'rv-reject':rejectionForm,
    'rv-confirm':()=>({title:L(A.pending?.decision==='verified'?'Approve this application?':'Confirm rejection?',A.pending?.decision==='verified'?'确认通过认证？':'确认驳回申请？'),html:`<p><b>${A.selected} · V${A.pending?.version}</b></p>${A.pending?.decision==='verified'?CF.note('accent',L('The applicant will become verified and receive the review result.','通过后，该资金方将获得已认证状态并收到审核结果。')):`<p>${L('The applicant will see this reason and may edit and resubmit.','申请人将看到以下原因，可修改后重新提交。')}</p>${problemList({additional:A.additional.trim()})}`}${A.busy?CF.note('accent',L('Saving decision…','正在保存审核结论…')):''}`,foot:(A.pending?.decision==='rejected'?btn('Edit reason','返回修改','edit-reason','','',A.busy):btn('Cancel','取消','cancel','','',A.busy))+btn(A.busy?'Saving…':'Confirm',A.busy?'正在保存…':'确认','confirm','','primary',A.busy)}),
    'rv-unknown':()=>({title:L('Review result not confirmed','审核结果暂未确认'),html:CF.note('warn',L('Check the current application state before sending another decision.','请先查询当前申请状态，避免重复提交结论。')),foot:btn('Check current result','查询当前结果','resolve','','primary')}),
    'rv-material':()=>{
      if(!allowed())return{title:L('Sign in to continue','请先完成运营登录'),html:signedOut(),foot:btn('Close','关闭','cancel')};
      const v=snapshot();
      if(A.material==='loading')return{title:L('Opening material','正在读取材料'),html:CF.skelTable(3),foot:btn('Close','关闭','cancel')};
      if(A.material==='error')return{title:L('Material unavailable','材料暂不可读'),html:CF.note('red',L('The uploaded material could not be loaded. This does not mean it is missing.','已上传材料暂时加载失败，不代表申请人未上传。')),foot:btn('Close','关闭','cancel')+btn('Retry','重试','material-retry','','primary')};
      if(v.form?.file&&v.form.file!=='institution-demo.pdf')return{title:L('Material preview unavailable','原件预览不可用'),html:CF.note('warn',L('The original file cannot be opened here. Please retry later.','此处暂时无法打开材料原件，请稍后重试。')),foot:btn('Close','关闭','cancel')+btn('Retry','重试','material-retry')};
      return{title:L('Institution document','机构证明材料'),html:`<p>${A.selected} · V${v.version} · ${E(v.form?.file||'institution-demo.pdf')}</p><div class="rv-preview"><h2>${L('Demonstration document','演示材料')}</h2><p>${L('Institution registration extract','机构登记信息摘要')}</p><dl>${(v.fields||[]).slice(0,5).map(f=>`<div><dt>${L(f[0],f[1])}</dt><dd>${E(f[2])}</dd></div>`).join('')}</dl></div>`,foot:btn('Close','关闭','cancel')};
    }
  };
  function demo(){return `<section class="rv-demo"><h5>${L('Certification review · demo tools','机构认证审核 · 演示工具')}</h5><p>${L('Local demonstration data. No real document, email or review service is contacted.','本地演示数据，不连接真实材料、邮件或审核服务。')}</p><div>${btn('Operations','运营端','ops')}${btn('Applicant','资金方本人','applicant')}</div><label for="rv-response">${L('Next review response','下次审核响应')}</label><select id="rv-response" class="inp">${[['success','Success','成功'],['failed','Failed','失败'],['unknown','Unknown result','结果未知'],['duplicate','Duplicate institution','通过时查重冲突'],['stale','Already processed','他人已处理'],['session','Session expired','登录失效']].map(o=>`<option value="${o[0]}" ${A.response===o[0]?'selected':''}>${L(o[1],o[2])}</option>`).join('')}</select><div class="seg">${btn('Expire operations session','运营登录失效','expire-session')}${btn('Material failure','材料加载失败','material-fail')}${btn('Duplicate on submit','提交时机构重复','duplicate')}${btn('5 submits / 24 hours','24 小时已提交 5 次','limit')}${btn('Hypothetical template upgrade','假设模版升级','template-upgrade')}${btn('Clear submit constraints','恢复提交条件','clear-constraints')}${btn('Attempt stale write','尝试旧页面处置','attempt')}${btn('Reset review dataset','重置审核样例','seed')}</div><p>${L('Use Applicant to follow the same application through resubmission. Existing funder tools remain available below.','点击资金方本人可查看同一申请并重提；下方保留既有资金方工具。')}</p></section>`;}
  function seed(){
    R.state.activeTemplate='DEMO-1';R.seed('submitted');const a=R.account;a.version=2;a.submitted='2026-09-18T02:30:00Z';a.form.name='Demo Institution A';a.form.identifier='DEMO-REG-100';a.submittedFields=R.fields();a.submittedForm=copy(a.form);a.history=[{version:1,status:'rejected',submitted:'2026-09-16T01:00:00Z',reviewed:'2026-09-17T03:00:00Z',snapshotEmail:a.email,fields:copy(a.submittedFields),form:copy(a.form),template:'DEMO-1',reviewer:'DEMO-OP-02',issues:[{key:'identifier',label:label('identifier'),en:'The registration number differs from the document. Correct the full number.',zh:'登记号与材料不一致，请核对并填写完整编号。'}]}];a.history[0].form.identifier='DEMO-REG-099';a.history[0].fields=a.history[0].fields.map(f=>f[0]==='Institution identifier'?[...f.slice(0,2),'DEMO-REG-099']:f);a.issues=[];a.additional='';a.successTimes=[];a.template='DEMO-1';R.persist();
    A.extras=Array.from({length:7},(_,i)=>{const x=copy(a);x.id='DEMO-REG-'+String(i+2).padStart(3,'0');x.form.name='Demo Institution '+String.fromCharCode(66+i);x.form.identifier='DEMO-REG-'+(101+i);x.submittedForm=copy(x.form);x.submittedFields=x.submittedFields.map(f=>f[0]==='Institution name'?[...f.slice(0,2),x.form.name]:f[0]==='Institution identifier'?[...f.slice(0,2),x.form.identifier]:f);x.version=1;x.history=[];x.submitted=`2026-09-${String(18+i%2).padStart(2,'0')}T${String(3+i).padStart(2,'0')}:00:00Z`;x.status=i<5?'submitted':i===5?'verified':'rejected';x.reviewed=i>=5?'2026-09-20T01:00:00Z':null;if(x.status==='rejected')x.issues=copy(a.history[0].issues);return x;});
    A.selected='DEMO-REG-001';A.version=0;A.pending=null;A.busy=false;A.response='success';A.session=true;A.sessionEpoch++;A.template='ready';R.state.activeTemplate='DEMO-1';A.error='';A.material='ready';A.filter={state:'submitted',q:'',from:'',to:''};A.page=1;S.role='ops';S.end='admin';S.layer=null;S.demo=false;location.hash='#/ops/institution-reviews';
  }
  function action(act,v){
    if(!act.startsWith('rv-'))return false;
    switch(act.slice(3)){
      case 'view':A.selected=v;A.version=0;go('/ops/institution-reviews/detail?application='+v);break;
      case 'back':go('/ops/institution-reviews');break;
      case 'version':A.version=+v;A.error='';S.toTop=true;break;
      case 'page':A.page=+v;break;
      case 'search':A.queryError=!!(A.filter.from&&A.filter.to&&A.filter.from>A.filter.to);A.page=1;break;
      case 'reset':A.filter={state:'submitted',q:'',from:'',to:''};A.queryError=false;S.st='default';A.page=1;break;
      case 'retry':S.st='loading';setTimeout(()=>{S.st='default';CF.render();},500);break;
      case 'approve':begin('verified');break;
      case 'reject':begin('rejected');break;
      case 'preview-reject':if(!ensureWrite())break;A.rejectError=!validReasons();open(A.rejectError?'reject':'confirm');break;
      case 'edit-reason':if(!A.busy&&ensureWrite())open('reject');break;
      case 'confirm':confirm();break;
      case 'resolve':finish();break;
      case 'cancel':if(!A.busy){A.pending=null;CF.closeLayer();}break;
      case 'material':if(allowed())open('material');else {S.layer=null;CF.toast(L('Sign in again to view materials.','请重新登录后查看材料。'));}break;
      case 'material-retry':A.material='loading';CF.render();setTimeout(()=>{A.material='ready';CF.render();},500);break;
      case 'material-fail':A.material='error';S.demo=false;break;
      case 'expire-session':expireSession();break;
      case 'sign-in':if(CF.opsAuth)go('/ops/login');else open('sign-in');break;
      case 'signed-in':A.session=true;A.sessionEpoch++;A.pending=null;A.response='success';A.version=0;A.error='';S.role='ops';S.end='admin';S.layer=null;S.toTop=true;break;
      case 'ops':S.role='ops';S.end='admin';go('/ops/institution-reviews');break;
      case 'applicant':R.activate();go('/funder/status');break;
      case 'seed':seed();break;
      case 'attempt':if(!ensureWrite())CF.toast(A.error);else begin('verified');S.demo=false;break;
      case 'duplicate':A.duplicate=true;S.demo=false;break;
      case 'limit':A.limited=true;A.limitUntil=Date.now()+3600000;S.demo=false;break;
      case 'template-upgrade':A.template='upgraded';R.state.activeTemplate='DEMO-2';R.account.form.regulator='';R.persist();S.demo=false;break;
      case 'clear-constraints':A.duplicate=false;A.limited=false;A.response='success';A.template='ready';R.state.activeTemplate='DEMO-1';R.state.saveResult='success';R.state.error=null;break;
    }
    return true;
  }
  function identity(f){const clean=v=>String(v||'').normalize('NFKC').replace(/\s+/g,'').toUpperCase();return (f.identifierType||'REG_NO')+':'+((f.identifierType||'REG_NO')==='REG_NO'?clean(f.country)+':':'')+clean(f.identifier);}
  function hasDuplicate(form,id){return rows().some(a=>{if(a.id===id)return false;const previous=a.history.slice().reverse().find(h=>h.status==='verified');return (['submitted','verified'].includes(a.status)&&identity(a.submittedForm||a.form)===identity(form))||(previous?.form&&identity(previous.form)===identity(form));});}
  R.beforeSubmit=a=>{
    const recent=(a.successTimes||[]).filter(t=>Date.now()-t<86400000).sort();
    if(A.limited||recent.length>=5){const next=A.limited?A.limitUntil:recent[0]+86400000;return ['You can submit up to 5 times in 24 hours. Try again after '+time(next)+'.','24 小时内最多成功提交 5 次，可在 '+time(next)+' 后再次提交。'];}
    if(A.duplicate||hasDuplicate(a.form,'DEMO-REG-001'))return ['This institution is already registered. Contact support if you believe this is an error.','该机构已在平台注册，如有疑问请联系客服。'];
    if(A.template==='upgraded'&&!a.form.regulator.trim())return ['Complete the newly required regulator field before submitting.','请补齐新增必填项：监管机构。'];
    return null;
  };
  function afterRender(){
    queueMicrotask(()=>{
      if(S.demo&&!document.querySelector('.rv-demo'))$('demoPanel').insertAdjacentHTML('afterbegin',demo());
      if(S.end==='admin'){
        document.querySelector('#demoPanel [data-act="st"][data-v="denied"]')?.remove();
        document.querySelector('#atools .bell')?.remove();
        const role=document.querySelector('.op-role');if(role)role.textContent=L(A.session?'Operations':'Signed out',A.session?'运营人员':'未登录');
      }
      if(S.end==='asset'){
        CF.funder.afterRender();
        if(S.page==='P-L21'&&R.account.status==='rejected')for(const i of R.account.issues||[]){const input=$('f-'+i.key);if(input&&!input.parentElement.querySelector('.rv-field-reason'))input.insertAdjacentHTML('afterend',`<p class="funder-error rv-field-reason">${E(L(i.en,i.zh))}</p>`);}
        if(S.page==='P-L21'&&A.template==='upgraded'){
          const h=document.querySelector('.funder-grid .card-b');if(h&&!$('rv-template-note'))h.insertAdjacentHTML('afterbegin',`<p class="note warn" id="rv-template-note">${L('The template has changed. One new required field: regulator. Business contact email has been removed. Other details have been retained.','模版已调整，新增 1 项必填：监管机构；业务联系人邮箱已移除。其他资料已保留。')}</p>`);
        }
        if(S.page==='P-L21'&&(A.limited||(R.account.successTimes||[]).filter(t=>Date.now()-t<86400000).length>=5)){
          const b=document.querySelector('[data-act="f-submit"]');if(b){b.disabled=true;b.insertAdjacentHTML('beforebegin',`<p class="funder-error">${E(L(...R.beforeSubmit(R.account)))}</p>`);}
        }
      }
      focusLayer();
    });
  }
  function focusLayer(){const dialog=document.querySelector('#layers [role="dialog"]');$('app').inert=!!dialog;$('portal').inert=!!dialog;$('demoBtn').inert=!!dialog;$('demoPanel').inert=!!dialog;}
  document.addEventListener('input',e=>{
    const el=e.target;
    if(el.id==='rv-query')A.filter.q=el.value;
    if(el.id==='rv-from')A.filter.from=el.value;
    if(el.id==='rv-to')A.filter.to=el.value;
    if(el.id==='rv-reason')A.additional=el.value;
  });
  document.addEventListener('change',e=>{
    const el=e.target;
    if(el.id==='rv-state'){A.filter.state=el.value;A.page=1;}
    else if(el.id==='rv-response')A.response=el.value;
    else return;
    CF.render();queueMicrotask(afterRender);
  });
  document.addEventListener('keydown',e=>{
    if(!S.layer?.key.startsWith('rv-'))return;
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(S.layer?.key==='rv-unknown')return;if(!A.busy){A.pending=null;CF.closeLayer();}return;}
    if(e.key==='Tab'){
      const nodes=[...document.querySelectorAll('#layers button:not(:disabled),#layers input,#layers select,#layers textarea')].filter(x=>x.getClientRects().length),first=nodes[0],last=nodes.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }
  },true);
  CF.define({id:'institution-review',pages:['P-L40','P-L41'],dict:{en:{navGroupOps:'Operations',navInstitutionReview:'Institution review',navInstitutionDetail:'Application details'},zh:{navGroupOps:'运营管理',navInstitutionReview:'机构认证审核',navInstitutionDetail:'申请详情'}},
    content:page=>page==='P-L40'?list():detail(),layers,onAct:action,demo,
    allowNav:id=>S.end!=='admin'||id==='P-L40',
    onBeforeAct(act){if(act==='end'){A.error='';return false;}if(act==='closelayer'&&(A.busy||S.layer?.key==='rv-unknown'))return true;if(act==='f-confirm-submit'&&R.state.pendingSubmission)return true;return false;},
    beforeRender(){if(S.end==='admin'){CF.resetCompletion();if(!allowed()&&S.layer?.key.startsWith('rv-')&&S.layer.key!=='rv-sign-in'){S.layer=null;A.pending=null;A.busy=false;}}const params=new URLSearchParams(location.hash.split('?')[1]||'');if(params.has('application'))A.selected=params.get('application');},
    afterRender
  });
  CF.reviewDemo=A;
  // Keep the established registry, while the composed review entry offers only implemented navigation.
  const requested=location.hash;seed();if(requested&&requested!=='#/')location.hash=requested;CF.boot();
})(window.CF);
