/* WS-381 · Local review simulation for funder institution certification. Session and delivered
   permissions come from the shared operations account; the applicant side reuses the funder flow. */
(function(CF){
  'use strict';
  const S=CF.S,L=CF.L,E=CF.esc,R=CF.funder.review,OPS=CF.opsAccountModule,PORTAL=CF.AccountView,$=id=>document.getElementById(id);
  const OPS_PAGES=['P-O-AL-01','P-O-AL-03','P-O-AL-04','P-O-AL-05','P-O-AL-06','P-O-AL-07'];
  const copy=x=>JSON.parse(JSON.stringify(x));
  const A={sessionEpoch:0,selected:'DEMO-REG-001',legacyLink:false,filter:{state:'submitted',q:'',from:'',to:''},page:1,error:'',busy:false,
    response:'success',material:'ready',openFile:'',pending:null,issues:[],additional:'',rejectError:false,queryError:false,duplicate:false,limited:false,template:'ready',extras:[],audit:[]};
  let routeKey=null,returnPosition=null,restoreList=false,returnHash='',lastHash='',onModule=false,wasSigned=false;
  const btn=(en,zh,act,v='',kind='',disabled=false)=>`<button type="button" class="btn ${kind}" data-act="rv-${act}" data-v="${E(v)}" ${disabled?'disabled':''}>${L(en,zh)}</button>`;
  const time=t=>t?CF.fmtTime(t):'—';
  const name=s=>L(...({submitted:['Pending review','待审核'],verified:['Approved','已通过'],rejected:['Rejected','已驳回'],draft:['Not submitted','未提交']}[s]));
  const tag=s=>CF.tag(s==='verified'?'ok':s==='rejected'?'danger':'warn',name(s));
  function rows(){return [{...R.account,id:'DEMO-REG-001'},...A.extras].filter(a=>a.version>0&&a.status!=='draft');}
  function selected(){return A.selected==='DEMO-REG-001'?R.account:A.extras.find(a=>a.id===A.selected);}
  function snapshot(){const a=selected();return a&&!A.legacyLink?{...a,fields:a.submittedFields,form:a.submittedForm}:null;}
  /* 功能权限只有运营端账户与登录一处登记：PM-AL-05 申请与材料查询、PM-AL-06 审核处置。
     本册不分查询岗与处置岗，持 PM-AL-05 即可查看并处置；仅持 PM-AL-06 时按缺配套查询权限拒绝。 */
  const signedIn=()=>!!CF.opsAuth&&CF.opsAuth.can(14);
  const canRead=()=>!!CF.opsAuth&&CF.opsAuth.can(5);
  const decideOnly=()=>!!CF.opsAuth&&!CF.opsAuth.can(5)&&CF.opsAuth.can(6);
  function allowed(){return S.end==='admin'&&signedIn()&&canRead();}
  function canReview(){const a=selected();return allowed()&&!A.legacyLink&&a?.status==='submitted';}
  function dropReview(){A.sessionEpoch++;A.pending=null;A.busy=false;A.error='';S.layer=null;}
  function go(page){S.layer=null;S.demo=false;S.st='default';A.error='';location.hash='#'+page;CF.render();}
  // Keep list context and the selected application addressable without changing the shared router.
  function contextParams(){return new URLSearchParams({state:A.filter.state,q:A.filter.q,from:A.filter.from,to:A.filter.to,page:String(A.page)});}
  function listRoute(row=''){const p=contextParams();if(row)p.set('row',row);return '/ops/institution-reviews?'+p;}
  function detailRoute(id){const p=contextParams();p.set('application',id);return '/ops/institution-reviews/detail?'+p;}
  function routeLink(en,zh,act,value,route){return `<a class="btn-link" href="#${E(route)}" data-act="rv-${act}" data-v="${E(value)}">${L(en,zh)}</a>`;}
  function syncContext(){
    if(routeKey===location.hash)return;
    const previous=routeKey;routeKey=location.hash;
    const path=location.hash.slice(1).split('?')[0];
    if(!['/ops/institution-reviews','/ops/institution-reviews/detail'].includes(path))return;
    const p=new URLSearchParams(location.hash.split('?')[1]||'');
    const date=key=>/^\d{4}-\d{2}-\d{2}$/.test(p.get(key)||'')?p.get(key):'';
    A.filter={state:['submitted','verified','rejected','all'].includes(p.get('state'))?p.get('state'):'submitted',q:p.get('q')||'',from:date('from'),to:date('to')};
    A.page=Math.max(1,Math.min(10000,parseInt(p.get('page'),10)||1));
    A.queryError=!!(A.filter.from&&A.filter.to&&A.filter.from>A.filter.to);
    if(path.endsWith('/detail')){A.selected=p.get('application')||'';A.legacyLink=p.has('version');}
    else if(previous?.includes('/detail')||p.has('row'))restoreList=p.get('row')||A.selected;
  }
  function writeListRoute(){history.replaceState(null,'','#'+listRoute());routeKey=location.hash;}
  function open(key){CF.openLayer('modal','rv-'+key);queueMicrotask(()=>{focusLayer();if(key==='reject')$('rv-reason')?.focus();});}
  function cancelReview(){
    const decision=A.pending?.decision,material=S.layer?.key==='rv-material';A.pending=null;CF.closeLayer();if(material)requestAnimationFrame(()=>document.querySelector('[data-act="rv-material"]')?.focus({preventScroll:true}));
    if(decision)requestAnimationFrame(()=>document.querySelector(`[data-act="rv-${decision==='verified'?'approve':'reject'}"]`)?.focus({preventScroll:true}));
  }
  function note(){return A.error?CF.note('red',E(A.error)):'';}
  function title(en,zh,desc=''){return `<div class="page-head"><div><h1 class="page-title">${L(en,zh)}</h1>${desc?`<p class="page-desc">${desc}</p>`:''}</div>${CF.tag('neutral',L('Demonstration data','演示数据'))}</div>`;}
  function kv(data){return `<dl class="rv-kv">${data.map(x=>`<div ${['registeredAddress','wide'].includes(x[3])?'class="rv-wide"':''}><dt>${L(x[0],x[1])}</dt><dd>${E(R.fieldValue(x))}</dd></div>`).join('')}</dl>`;}
  function size(bytes){return bytes>=1048576?(bytes/1048576).toFixed(1)+' MB':Math.max(1,Math.ceil(bytes/1024))+' KB';}
  /* 本次提交的全部材料逐件列出，单件读取失败只影响该件。 */
  function materials(form){
    const files=R.docs(form);
    if(!files.length)return `<p class="rv-meta">${L('This submission contains no files.','本次提交没有材料文件。')}</p>`;
    return files.map(file=>CF.fileRow({key:'institution-ops-'+file.id,name:file.name,
      meta:L('Institution supporting documents','机构证明材料')+(file.size?' · '+size(file.size):''),
      state:file.status==='done'?'ready':'failed',status:file.status==='done'?L('Uploaded','已上传'):L('Upload failed','上传失败'),
      previewable:R.materialPreviewable(file),preview:{act:'rv-material',value:file.id},download:{act:'rv-material-download',value:file.id}})).join('');
  }
  function openFile(){return R.docs(snapshot()?.form).find(f=>f.id===A.openFile);}
  function fail(en,zh,desc,act='retry'){return CF.empty(L(en,zh),desc,btn('Retry','重试',act,'','primary'));}
  function signedOut(){return CF.empty(L('Sign in to continue','请先完成运营登录'),L('Your session has ended. Sign in again to view the current application and materials.','登录已失效，请重新登录后查看当前申请与材料。'),btn('Sign in again','重新登录','sign-in','','primary'));}
  function noAccess(){return decideOnly()
    ? CF.empty(L('Review access is incomplete','审核权限配置不完整'),L('This account can decide applications but cannot query applications or materials, so the review is refused. Ask your platform provider to correct the delivered configuration.','该账号可作出审核处置，但未开通申请与材料查询，本次访问已拒绝。请联系平台建设方修正交付配置。'),'')
    : CF.empty(L('No access to institution certification','无权访问机构认证审核'),L('The delivered configuration does not give this account the institution certification permissions.','当前交付配置未为该账号开通机构认证相关权限。'),'');}
  function gate(){return !signedIn()?signedOut():!canRead()?noAccess():'';}
  function list(){
    const blocked=gate();if(blocked)return `<div class="review-wrap">${title('Institution certification','资金方机构认证审核')}${blocked}</div>`;
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
      body=`<div class="tablewrap"><table class="tbl rv-table"><thead><tr>${[['Application','申请编号'],['Institution','机构标识 / 名称'],['Submitted ↑','提交时间 ↑'],['Status','状态'],['Decision time','结论时间'],['Action','操作']].map((h,i)=>`<th ${i===5?'class="col-act"':''} ${i===2?'aria-sort="ascending"':''}>${L(...h)}</th>`).join('')}</tr></thead><tbody>${found.slice((A.page-1)*5,A.page*5).map(a=>{const f=a.submittedForm||a.form;return `<tr><td class="mono">${a.id}</td><td><b>${E(f.name)}</b><div class="rv-meta mono">${E(f.identifier)}</div></td><td class="rv-meta">${time(a.submitted)}</td><td>${tag(a.status)}</td><td class="rv-meta">${time(a.reviewed)}</td><td class="col-act">${routeLink('View','查看','view',a.id,detailRoute(a.id))}</td></tr>`;}).join('')}</tbody></table></div><div class="rv-foot"><span class="rv-meta">${L(`${found.length} applications`,`${found.length} 条申请`)}</span><div>${btn('Previous','上一页','page',String(A.page-1),'',A.page===1)} <span class="rv-meta">${A.page} / ${pages}</span> ${btn('Next','下一页','page',String(A.page+1),'',A.page===pages)}</div></div>`;
    }
    return `<div class="review-wrap">${title('Institution certification','资金方机构认证审核',L('Review submitted institution information and supporting materials.','核对机构资料与提交材料，处理认证申请。'))}<section class="card">${filters}${body}</section></div>`;
  }
  function localDay(t){const p=new Intl.DateTimeFormat('en-CA',{timeZone:S.tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(t));return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');}
  function problemList(v){return(v.issues||[]).map(i=>`<div class="rv-history"><b>${E(L(...i.label))}</b><p>${E(L(i.en,i.zh))}</p></div>`).join('')+(v.additional?`<p class="rv-reason-text">${E(v.additional)}</p>`:'');}
  function detail(){
    const blocked=gate();if(blocked)return `<div class="review-wrap">${title('Application details','机构认证申请详情')}${blocked}</div>`;
    if(S.st==='loading')return CF.skelTable(6);
    if(S.st==='error')return fail('Application could not be loaded','申请详情加载失败',L('Materials are temporarily unavailable. Please retry.','资料暂不可读，请重试。'));
    const a=selected(),v=snapshot();if(A.legacyLink)return CF.empty(L('Historical materials unavailable','不再提供历史资料'),L('Open the current application to view its latest submission and review records.','请进入当前申请查看最新提交资料及审核记录。'),a?routeLink('Open current application','查看当前申请','view',A.selected,detailRoute(A.selected)):btn('Back to list','返回列表','back'));if(!a||!v)return CF.empty(L('Application not found','未找到该申请'),' ',btn('Back to list','返回列表','back'));
    const fields=v.fields||a.submittedFields||[],reviewable=canReview();
    return `<div class="review-wrap">${title('Application details','机构认证申请详情',E(A.selected))}
      ${note()}
      <div class="rv-grid ${reviewable?'has-actions':''}"><div class="detail-stack rv-stack"><section class="card"><div class="card-b"><h2>${L('Submission','提交信息')} ${tag(v.status)}</h2>${kv([['Funder account','资金方账号',A.selected==='DEMO-REG-001'?'DEMO-FUNDER':'DEMO-FUNDER-'+A.selected.slice(-3)],['Submitted','提交时间',time(v.submitted)],['Decision time','结论时间',time(v.reviewed)],['Current account contact email','当前账户联系邮箱',a.email],['Account contact email at submission','提交时账户联系邮箱',v.snapshotEmail],['Wallet address','钱包地址',a.address,'wide']])}</div></section>
      <section class="card"><div class="card-b"><h2>${L('Institution information','机构资料')}</h2>${kv(fields.filter(R.notDocuments))}</div></section>
      <section class="card"><div class="card-b"><h2>${L('Supporting materials','提交材料')} <span class="rv-meta">${L(R.docs(v.form).length+' files',R.docs(v.form).length+' 份')}</span></h2>${materials(v.form)}</div></section>
      ${v.status==='rejected'?`<section class="card"><div class="card-b"><h2>${L('Rejection reasons','驳回原因')}</h2>${problemList(v)}</div></section>`:''}
      <section class="card"><div class="card-b"><h2>${L('Review decision','审核结论')}</h2>${v.reviewed?kv([['Decision','结论',name(v.status)],['Decided by','操作人',v.reviewer||'DEMO-OP-01'],['Decision time','结论时间',time(v.reviewed)]]):`<p class="rv-meta">${L('No decision yet','尚未出具结论')}</p>`}
      ${reviewable?'':CF.note('accent',L('This submission has a final decision and is read only.','本次提交已出具结论，仅可查看。'))}</div></section></div>
      ${reviewable?`<aside class="card rv-operation" aria-labelledby="rv-operation-title"><div class="card-b"><h2 id="rv-operation-title">${L('Review actions','审核操作')}</h2><div class="rv-actions">${btn('Approve','通过','approve','','primary')}${btn('Reject','驳回','reject')}</div></div></aside>`:''}</div>
      <section class="card rv-review-records" aria-labelledby="rv-history-title"><div class="card-b"><h2 id="rv-history-title">${L('Submission and review activity','提交与审核记录')}</h2>${R.reviewTimeline(a.records,true)}</div></section></div>`;

  }
  function ensureWrite(){if(!canReview()){A.error=allowed()?L('This submission has changed or already has a decision. Review the current result.','申请已重新提交或已出具结论，请查看当前结果。'):signedIn()?L('This account can no longer review institution applications.','当前账号已不能处置机构认证申请。'):L('Your session has ended. Sign in again before reviewing.','登录已失效，请重新登录后再审核。');A.pending=null;A.busy=false;S.layer=null;return false;}return true;}
  function begin(decision){if(A.pending&&A.response==='unknown'){open('unknown');return;}if(!ensureWrite())return;A.error='';A.pending={id:A.selected,version:selected().version,decision};if(decision==='verified')open('confirm');else{A.issues=[];A.additional='';A.rejectError=false;open('reject');}}
  function validReasons(){return !!A.additional.trim();}
  function confirm(){
    if(A.busy||!A.pending)return;
    if(!ensureWrite())return;
    if(A.pending.id!==A.selected||A.pending.version!==selected().version){A.error=L('The application has changed. View its current submission.','申请已重新提交，请查看当前申请。');S.layer=null;return;}
    if(A.pending.decision==='rejected'&&!validReasons()){A.rejectError=true;open('reject');return;}
    const epoch=A.sessionEpoch,request=A.pending;A.busy=true;CF.render();
    setTimeout(()=>{
      if(epoch!==A.sessionEpoch||A.pending!==request)return;
      A.busy=false;if(!ensureWrite()){CF.render();return;}
      if(A.response==='session'){expireSession();CF.render();return;}
      if(A.response==='stale'){apply('verified',[], '');A.error=L('Another operator has already processed this submission. The current result is shown.','本次提交已由其他运营人员处理，已显示当前结果。');A.pending=null;S.layer=null;CF.render();return;}
      if(A.response==='failed'){A.pending=null;A.error=L('The decision could not be saved. No result was changed. Retry after checking the application.','审核提交失败，结论未改变。核对申请后可重试。');S.layer=null;CF.render();return;}
      if(A.response==='unknown'){open('unknown');return;}
      finish();
    },650);
  }
  function apply(status,issues,additional){
    const a=selected();if(a.status!=='submitted'||(A.pending&&A.pending.version!==a.version))return false;
    if(A.selected==='DEMO-REG-001')R.decide(a.version,status,copy(issues),additional);
    else{a.status=status;a.reviewed=new Date().toISOString();a.issues=copy(issues);a.additional=additional;a.reviewer='DEMO-OP-01';R.recordDecision(a);}
    A.audit.push({id:A.selected,version:a.version,status,time:a.reviewed});return true;
  }
  function finish(){
    if(!A.pending||!ensureWrite())return;if(A.pending.id!==A.selected||A.pending.version!==selected().version){A.pending=null;S.layer=null;A.error=L('The application has changed. Review the current submission.','申请已重新提交，请重新核对当前资料。');CF.render();return;}
    if((A.duplicate||A.response==='duplicate'||hasDuplicate(selected().submittedForm||selected().form,A.selected))&&A.pending.decision==='verified'){A.error=L('This institution is already registered. Verify the institution identifier before proceeding.','该机构已在平台注册，请核实机构标识后处理。');S.layer=null;A.pending=null;CF.render();return;}
    const done=apply(A.pending.decision,[],A.pending.decision==='rejected'?A.additional.trim():'');A.pending=null;S.layer=null;A.error='';CF.render();if(done)CF.toast(L('Review decision saved.','审核结论已保存。'));
  }
  function rejectionForm(){return {title:L('Reject application','驳回申请'),html:`<div class="field rv-rejection"><label for="rv-reason">${L('Rejection reason *','驳回原因 *')}</label><textarea class="inp" id="rv-reason" rows="5" required aria-invalid="${A.rejectError}" aria-describedby="rv-reason-help${A.rejectError?' rv-reason-error':''}" placeholder="${L('Explain why the application is rejected and what needs to change.','请填写驳回原因及需要修改的内容。')}">${E(A.additional)}</textarea><p id="rv-reason-help" class="hint">${L('The applicant will see this reason.','申请人可查看此原因。')}</p>${A.rejectError?`<p id="rv-reason-error" class="err-msg" role="alert">${L('Enter a rejection reason.','请填写驳回原因。')}</p>`:''}</div>`,foot:btn('Cancel','取消','cancel')+btn('Review rejection','核对驳回内容','preview-reject','','primary')};}
  const layers={
    'rv-reject':rejectionForm,
    'rv-confirm':()=>({title:L(A.pending?.decision==='verified'?'Approve this application?':'Confirm rejection?',A.pending?.decision==='verified'?'确认通过认证？':'确认驳回申请？'),html:`<p><b>${E(A.selected)}</b></p>${A.pending?.decision==='verified'?CF.note('accent',L('The applicant will become verified and receive the review result.','通过后，该资金方将获得已认证状态并收到审核结果。')):`<p>${L('The applicant will see this reason and may edit and resubmit.','申请人将看到以下原因，可修改后重新提交。')}</p>${problemList({additional:A.additional.trim()})}`}${A.busy?CF.note('accent',L('Saving decision…','正在保存审核结论…')):''}`,foot:(A.pending?.decision==='rejected'?btn('Edit reason','返回修改','edit-reason','','',A.busy):btn('Cancel','取消','cancel','','',A.busy))+btn(A.busy?'Saving…':'Confirm',A.busy?'正在保存…':'确认','confirm','','primary',A.busy)}),
    'rv-unknown':()=>({title:L('Review result not confirmed','审核结果暂未确认'),html:CF.note('warn',L('Check the current application state before sending another decision.','请先查询当前申请状态，避免重复提交结论。')),foot:btn('Check current result','查询当前结果','resolve','','primary')}),
    'rv-material':()=>{
      if(!allowed())return{title:L('Sign in to continue','请先完成运营登录'),html:gate(),foot:btn('Close','关闭','cancel')};
      const v=snapshot(),file=openFile();if(!v||!file)return {title:L('Materials unavailable','资料不可用'),html:L('Open the current application to view its materials.','请进入当前申请查看资料。'),foot:btn('Close','关闭','cancel')};
      if(A.material==='loading')return{title:L('Opening material','正在读取材料'),html:CF.skelTable(3),foot:btn('Close','关闭','cancel')};
      if(A.material==='error')return{title:E(file.name),html:CF.note('red',L('This file could not be loaded. It does not mean the applicant left it out.','该材料暂时加载失败，不代表申请人未上传。')),foot:btn('Close','关闭','cancel')+btn('Retry','重试','material-retry')+btn('Download','下载','material-download',file.id)};
      return{title:E(file.name),html:R.materialPreview(file,v.fields),foot:btn('Close','关闭','cancel')+btn('Download','下载','material-download',file.id)};
    }
  };

  const DENIED={id:'denied',label:['No access','无权限'],group:'business'};
  ['P-L40','P-L41'].forEach(id=>CF.review.register(id,{
    group:['Institution review','机构认证审核'],
    states:id==='P-L40'?['default','loading','empty','noresult','error',DENIED]:['default','loading','error',DENIED],
    route:()=>id==='P-L40'?'/ops/institution-reviews':detailRoute(rows()[0]?.id||'DEMO-REG-001'),
    get:()=>canRead()?S.st:'denied',
    set(value){if(value==='denied'){grant('none');S.st='default';return;}if(!canRead())grant('admin');S.st=value;},
    reset(){if(!canRead())grant('admin');S.st='default';A.material='ready';A.response='success';A.error='';},
    beforeChange(proceed){if(A.busy||A.pending){CF.toast(L('Finish or cancel the review first.','请先完成或取消审核。'));return;}proceed();}
  }));

  /* 演示用的交付配置：管理员固定开通本模块两项；专员按交付默认关闭，可单独试出仅处置时的拒绝分支。 */
  function grant(mode){
    if(!CF.opsAuth)return;
    CF.opsAuth.seedDemo(mode==='admin'?'admin':'specialist');
    if(mode==='read')OPS.onAct('ops-grant','5');
    if(mode==='decide')OPS.onAct('ops-grant','6');
    dropReview();
  }
  function demo(){return `<section class="rv-demo"><h5>${L('Certification review · demo tools','机构认证审核 · 演示工具')}</h5><p>${L('Local demonstration data. No real document, email or review service is contacted.','本地演示数据，不连接真实材料、邮件或审核服务。')}</p><div>${btn('Operations','运营端','ops')}${btn('Applicant','资金方本人','applicant')}</div><label>${L('Delivered account configuration','交付的账号配置')}</label><div class="seg">${btn('Administrator','运营管理员','grant','admin')}${btn('Specialist · no institution access','运营专员 · 未开通本模块','grant','none')}${btn('Specialist · application query','运营专员 · 已开通申请查询','grant','read')}${btn('Specialist · decision only','运营专员 · 仅开通审核处置','grant','decide')}</div><label for="rv-response">${L('Next review response','下次审核响应')}</label><select id="rv-response" class="inp">${[['success','Success','成功'],['failed','Failed','失败'],['unknown','Unknown result','结果未知'],['duplicate','Duplicate institution','通过时查重冲突'],['stale','Already processed','他人已处理'],['session','Session expired','登录失效']].map(o=>`<option value="${o[0]}" ${A.response===o[0]?'selected':''}>${L(o[1],o[2])}</option>`).join('')}</select><div class="seg">${btn('Expire operations session','运营登录失效','expire-session')}${btn('Next file fails to load','下一次材料读取失败','material-fail')}${btn('Duplicate on submit','提交时机构重复','duplicate')}${btn('5 submits / 24 hours','24 小时已提交 5 次','limit')}${btn('Hypothetical template upgrade','假设模版升级','template-upgrade')}${btn('Clear submit constraints','恢复提交条件','clear-constraints')}${btn('Attempt stale write','尝试旧页面处置','attempt')}${btn('Reset review dataset','重置审核样例','seed')}</div><p>${L('Use Applicant to follow the same application through resubmission. Existing funder tools remain available below.','点击资金方本人可查看同一申请并重提；下方保留既有资金方工具。')}</p></section>`;}
  function seed(){
    R.state.activeTemplate='DEMO-1';R.seed('submitted');const a=R.account;a.version=2;a.submitted='2026-09-18T02:30:00Z';a.form.name='Demo Institution A';a.form.identifier='DEMO-REG-100';a.submittedFields=R.fields();a.submittedForm=copy(a.form);a.accountId='DEMO-FUNDER';a.records=[{sequence:1,submitter:a.accountId,status:'rejected',submitted:'2026-09-16T01:00:00Z',reviewed:'2026-09-17T03:00:00Z',reviewer:'DEMO-OP-02',additional:'登记号与材料不一致，请核对并填写完整编号。',issues:[]},R.recordOf(a)];delete a.history;delete a.boundIdentity;a.issues=[];a.additional='';a.successTimes=[];a.template='DEMO-1';R.persist();
    A.extras=Array.from({length:7},(_,i)=>{const x=copy(a);x.id='DEMO-REG-'+String(i+2).padStart(3,'0');x.form.name='Demo Institution '+String.fromCharCode(66+i);x.form.identifier='DEMO-REG-'+(101+i);x.submittedForm=copy(x.form);x.submittedFields=R.fieldsFrom(x.submittedForm,'DEMO-1');x.version=1;x.accountId='DEMO-FUNDER-'+x.id.slice(-3);x.records=[];x.submitted=`2026-09-${String(18+i%2).padStart(2,'0')}T${String(3+i).padStart(2,'0')}:00:00Z`;x.status=i<5?'submitted':i===5?'verified':'rejected';x.reviewed=i>=5?'2026-09-20T01:00:00Z':null;x.reviewer=x.reviewed?'DEMO-OP-01':'';if(x.status==='rejected')x.additional=a.records[0].additional;R.recordDecision(x);return x;});
    A.selected='DEMO-REG-001';A.legacyLink=false;A.pending=null;A.busy=false;A.response='success';A.sessionEpoch++;A.openFile='';A.template='ready';R.state.activeTemplate='DEMO-1';A.error='';A.material='ready';A.filter={state:'submitted',q:'',from:'',to:''};A.page=1;S.role='ops';S.end='admin';S.layer=null;S.demo=false;location.hash='#/ops/institution-reviews';
  }
  function action(act,v,e){
    if(e&&(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)&&['rv-view','rv-version'].includes(act))return false;
    if(!act.startsWith('rv-'))return false;
    switch(act.slice(3)){
      case 'view':returnPosition={row:v,y:window.scrollY};A.selected=v;A.legacyLink=false;go(detailRoute(v));break;
      case 'back':go(listRoute(A.selected));break;
      case 'version':A.legacyLink=true;S.layer=null;break;
      case 'page':A.page=+v;writeListRoute();S.toTop=true;break;
      case 'search':A.queryError=!!(A.filter.from&&A.filter.to&&A.filter.from>A.filter.to);A.page=1;writeListRoute();break;
      case 'reset':A.filter={state:'submitted',q:'',from:'',to:''};A.queryError=false;S.st='default';A.page=1;writeListRoute();break;
      case 'retry':S.st='loading';setTimeout(()=>{S.st='default';CF.render();},500);break;
      case 'approve':begin('verified');break;
      case 'reject':begin('rejected');break;
      case 'preview-reject':if(!ensureWrite())break;A.rejectError=!validReasons();open(A.rejectError?'reject':'confirm');break;
      case 'edit-reason':if(!A.busy&&ensureWrite())open('reject');break;
      case 'confirm':confirm();break;
      case 'resolve':finish();break;
      case 'cancel':if(!A.busy)cancelReview();break;
      case 'material':A.openFile=v;if(allowed())open('material');else {S.layer=null;CF.toast(L('Sign in again to view materials.','请重新登录后查看材料。'));}break;
      case 'material-download':{if(!allowed()||A.legacyLink||!snapshot()){CF.toast(L('Sign in again to download materials.','请重新登录后下载材料。'));break;}
        const file=R.docs(snapshot().form).find(f=>f.id===(v||A.openFile));if(file)R.downloadMaterial(file);break;}
      case 'material-retry':A.material='loading';CF.render();setTimeout(()=>{A.material='ready';CF.render();},500);break;
      case 'material-fail':A.material='error';S.demo=false;break;
      case 'expire-session':dropReview();S.demo=false;OPS.onAct('ops-session-expire');break;
      case 'grant':grant(v);S.demo=false;S.toTop=true;go(S.page==='P-L41'?detailRoute(A.selected):listRoute());break;
      case 'sign-in':go('/ops/login');break;
      case 'ops':S.role='ops';S.end='admin';go(listRoute());break;
      case 'applicant':R.activate();S.end='asset';go('/funder/status');break;
      case 'seed':seed();break;
      case 'attempt':if(!ensureWrite())CF.toast(A.error);else begin('verified');S.demo=false;break;
      case 'duplicate':A.duplicate=true;S.demo=false;break;
      case 'limit':A.limited=true;A.limitUntil=Date.now()+3600000;S.demo=false;break;
      case 'template-upgrade':A.template='upgraded';R.state.activeTemplate='DEMO-2';R.account.form.regulator='';R.persist();S.demo=false;break;
      case 'clear-constraints':A.duplicate=false;A.limited=false;A.response='success';A.template='ready';R.state.activeTemplate='DEMO-1';R.state.saveResult='success';R.state.error=null;break;
    }
    return true;
  }
  function hasDuplicate(form,id){const candidate=R.identity(form);return rows().some(a=>a.id!==id&&((['submitted','verified'].includes(a.status)&&R.identity(a.submittedForm||a.form)===candidate)||a.boundIdentity===candidate));}
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
      if(S.end==='admin')OPS.afterRender();
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
      if(restoreList&&S.page==='P-L40'&&allowed()){
        const row=restoreList;restoreList=false;
        requestAnimationFrame(()=>{
          if(S.page!=='P-L40')return;
          const target=[...document.querySelectorAll('[data-act="rv-view"]')].find(el=>el.dataset.v===row);
          if(target){if(returnPosition?.row===row)window.scrollTo(0,returnPosition.y);else target.scrollIntoView({block:'nearest'});target.focus({preventScroll:true});}
          else $('rv-query')?.focus({preventScroll:true});
        });
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
    if(el.id==='rv-state'){A.filter.state=el.value;A.page=1;writeListRoute();}
    else if(el.id==='rv-response')A.response=el.value;
    else return;
    CF.render();queueMicrotask(afterRender);
  });
  document.addEventListener('keydown',e=>{
    if(!S.layer?.key.startsWith('rv-'))return;
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(S.layer?.key==='rv-unknown')return;if(!A.busy)cancelReview();return;}
    if(e.key==='Tab'){
      const nodes=[...document.querySelectorAll('#layers button:not(:disabled),#layers input,#layers select,#layers textarea')].filter(x=>x.getClientRects().length),first=nodes[0],last=nodes.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }
  },true);
  /* 复用运营账户模块的壳层工具与权限，但本模块保留公共评审工具面板。 */
  CF.define({...OPS,id:'institution-review',demoOnly:false,reviewToolsInLayer:false,dict:{en:{navGroupOps:'Operations',navInstitutionReview:'Institution review',navInstitutionDetail:'Application details'},zh:{navGroupOps:'运营管理',navInstitutionReview:'机构认证审核',navInstitutionDetail:'申请详情'}},
    content:page=>page==='P-L40'?list():page==='P-L41'?detail():OPS_PAGES.includes(page)?OPS.content(page):PORTAL.content(page),
    layers:{...PORTAL.layers,...OPS.layers,...layers},demo,
    onAct:(act,v,e)=>action(act,v,e)||(S.end==='admin'||act.startsWith('ops-')?OPS.onAct(act,v,e):false)||PORTAL.onAct(act,v,e),
    beforeAdminNavigate(proceed){if(A.busy||A.pending){CF.toast(L('Finish or cancel the current review first.','请先完成或取消当前审核。'));return}proceed()},
    breadcrumbRoute:id=>id==='P-L40'?listRoute(A.selected):null,
    onRoute(prev,next){A.pending=null;A.busy=false;A.error='';A.openFile='';if(S.end==='admin')OPS.onRoute(prev,next);},
    allowNav:id=>S.end!=='admin'||id==='P-L40'||OPS_PAGES.includes(id),
    onBeforeAct(act,v,e){if(act==='end'){A.error='';return false;}if(act==='closelayer'&&(A.busy||S.layer?.key==='rv-unknown'))return true;if(act==='closelayer'&&S.layer?.key.startsWith('rv-')&&!e.target.closest('[data-stop]')){cancelReview();return true;}if(act==='f-confirm-submit'&&R.state.pendingSubmission)return true;return S.end==='admin'?OPS.onBeforeAct(act,v,e):false;},
    beforeRender(){
      syncContext();
      if(S.end!=='admin')return;
      CF.resetCompletion();
      const signed=signedIn();
      if(signed&&['P-L40','P-L41'].includes(S.page))lastHash=location.hash;
      /* 登录失效后重新登录，回到审核时所在的申请查询或详情。 */
      if(!signed&&wasSigned){dropReview();if(onModule)returnHash=lastHash;}
      OPS.beforeRender();
      if(signed&&!wasSigned&&returnHash){location.hash=returnHash;returnHash='';}
      wasSigned=signed;onModule=['P-L40','P-L41'].includes(S.page);
      if(!allowed()&&S.layer?.key.startsWith('rv-')){S.layer=null;A.pending=null;A.busy=false;}
    },
    afterRender
  });
  CF.reviewDemo=A;
  // Keep the established registry, while the composed review entry offers only implemented navigation.
  const requested=location.hash;CF.opsAuth.seedDemo('admin');seed();if(requested&&requested!=='#/')location.hash=requested;CF.boot();
})(window.CF);
