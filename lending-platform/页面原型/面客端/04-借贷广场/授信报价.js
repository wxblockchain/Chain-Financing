/* L6 · extends the L5 project, shared shell and overlay; offline demonstration only. */
(function(CF){
  'use strict';
  const D=CF.LS,S=CF.S,L=CF.L,E=CF.esc,H=3600000,KEY='hc-ws447-v1';
  const Q=CF.CQ={};
  ['P-LS-04','P-LS-05','P-LS-06'].forEach(id=>CF.PAGES[id]={end:'asset',layout:'portal',parent:'P-LS-02',presentation:'drawer'});
  let db,flow={},pendingDraft=null,busy=false,problem='',problemCopy=['',''],invalid='',fault='normal',accountScene='ready',balanceScene='enough',authScene='success',acceptScene='success',acceptBalanceScene='enough',contractScene='ready',detailScene='success',focusBack=null;
  /* 当前演示身份代表的资金机构；演示视角可切到另一家机构，查看同一项目下当前报价方与其他资金方的不同页面。 */
  const F=()=>(S.party&&S.party.fund)||'fund-a',setF=v=>{S.party=Object.assign({},S.party,{fund:v});}; Q.fund=F;
  const creditFiles=new Map();
  let companyState='complete',lastView='',pendingUI=null,returnTarget=null,originScroll=0;
  const detailSteps=new Map();
  function rememberUI(){const el=document.activeElement;pendingUI={top:document.querySelector('.drawer-b,.modal-b')?.scrollTop||0,id:el?.id,act:el?.dataset.act,value:el?.dataset.v};if(flow.stage)detailSteps.set(flow.stage,{...pendingUI});}
  function rememberTrigger(fallback){if(S.layer?.key==='cq-flow')return;const el=document.activeElement?.closest('[data-act]');returnTarget={act:el?.dataset.act||fallback,value:el?.dataset.v};focusBack=fallback;originScroll=window.scrollY;detailSteps.clear();}
  function findControl(root,target){return target?.id?root.querySelector('#'+CSS.escape(target.id)):[...root.querySelectorAll('[data-act]')].find(el=>el.dataset.act===target?.act&&(target.value===undefined||el.dataset.v===target.value));}
  function restoreFlowUI(modal){
    const key=[flow.project,flow.quote,flow.stage].join('|'),changed=key!==lastView;
    const body=modal.querySelector('.drawer-b,.modal-b'),heading=modal.querySelector('.drawer-h,.modal-h');heading.tabIndex=-1;
    if(changed){const saved=flow.restoreStep?detailSteps.get(flow.stage):null;body.scrollTop=saved?.top||0;(saved&&findControl(modal,saved)||heading).focus({preventScroll:true});flow.restoreStep=false;lastView=key;}
    else if(pendingUI){body.scrollTop=pendingUI.top;const el=findControl(modal,pendingUI);if(el&&!el.disabled)el.focus({preventScroll:true});}
    pendingUI=null;
    if(flow.restoreRequest){body.scrollTop=flow.restoreRequest;flow.restoreRequest=0;modal.querySelector('[data-act=cq-respond]')?.focus({preventScroll:true});}
    const error=modal.querySelector('#cq-error');
    if(error){const target=document.getElementById('cq-'+invalid);if(target){for(let a=target.parentElement;a&&a!==modal;a=a.parentElement)if(a.tagName==='DETAILS')a.open=true;target.setAttribute('aria-invalid','true');target.setAttribute('aria-describedby','cq-error');(target.closest('.field')||target.closest('.cq-check')||target.parentElement).append(error);const control=target.querySelector('select[data-icon-select]')||target;control.setAttribute('aria-invalid','true');control.setAttribute('aria-describedby','cq-error');control.focus();}else{error.tabIndex=-1;error.focus();}}
  }
  const creditTitle=m=>L({new:'Initial credit',increase:'Additional credit',renew:'Renewed credit'}[m],{new:'首次授信',increase:'追加授信',renew:'重新授信'}[m]);
  const creditRelated=c=>!!c&&(S.role==='fund'&&c.fund===F()||S.role==='asset'&&D.mine({owner:c.owner}));
  const creditWritable=()=>certified()&&flow.fund===F()&&pFlow()?.owner;
  const editingStage=()=>{let stage=flow.stage,back=flow.readBack;while(back){stage=back.stage;back=back.previous;}return stage;};
  const creditDirty=()=>editingStage()==='credit'&&(flow.total!==flow.initial?.total||flow.expires!==flow.initial?.expires||flow.remark!==''||flow.agreements?.length>0);
  const fileSize=n=>n>=1048576?(n/1048576).toFixed(2)+' MB':Math.max(0.01,n/1024).toFixed(2)+' KB';
  function renderCredit(){
    const body=document.querySelector('.drawer-b,.modal-b'),top=body?.scrollTop||0,focus=document.activeElement?.id;
    CF.render();
    if(focus)document.getElementById(focus)?.focus({preventScroll:true});
    const next=document.querySelector('.drawer-b,.modal-b');if(next)next.scrollTop=top;
  }
  function closeFlow(){
    (flow.agreements||[]).forEach(f=>{if(!flow.creditSaved)creditFiles.delete(f.id);});
    if(flow.previewURL)URL.revokeObjectURL(flow.previewURL);flow={};lastView='';pendingUI=null;save();CF.closeLayer();
    const target=returnTarget;setTimeout(()=>{window.scrollTo(0,originScroll);(findControl(document,target)||document.querySelector('[data-act="'+focusBack+'"]'))?.focus({preventScroll:true});},0);
  }
  function draftDirty(){return creditDirty()||(['quote','confirm'].includes(editingStage())&&!!(flow.ccy||flow.rate||flow.lender))||editingStage()==='reject'&&!!flow.reason?.trim();}
  function requestClose(destination='close'){if(flow.stage==='discard'){flow.stage=flow.discard.stage;flow.discard=false;flow.restoreStep=true;CF.render();return;}if(draftDirty()){flow.discard={stage:flow.stage,destination};flow.stage='discard';CF.render();}else if(destination==='request')returnRequest();else closeFlow();}
  /* 接受或拒绝成功后不自动打开详情：从办理区进入的关闭并留在原处；从融资申请详情进入的回到该详情。 */
  function settled(message){if(flow.returnRequest){returnRequest();flow.result=message;}else{closeFlow();CF.toast(message);}}
  function returnRequest(){const p=pFlow(),demand=flow.returnRequest?.demand||flow.demand||qFlow()?.demand||D.current(p)?.id,back=flow.returnRequest;flow={project:p.id,demand,stage:'request',onReturn:flow.onReturn,selected:back?.selected,restoreRequest:back?.top||0,restoreStep:true};problem='';invalid='';refreshRequest();}
  function refreshRequest(){const q=requestQuotes(pFlow(),flow.demand).find(x=>['waiting','funding','funded','terminated'].includes(x.state));flow.quote=q?.id;flow.selected=q?.id;}
  function visit(stage){flow.readBack={stage:flow.stage,previous:flow.readBack};flow.stage=stage;}
  function returnRead(){const back=flow.readBack;flow.stage=back?.stage||'request';flow.readBack=back?.previous;flow.restoreStep=true;if(flow.previewURL){URL.revokeObjectURL(flow.previewURL);delete flow.previewURL;}}

  function companyView(compact=false){
    const state=companyState,missing=L('Not provided','暂未提供');
    if(state==='loading')return '<div id="cq-enterprise" tabindex="-1" role="status" class="cq-company-state">'+L('Loading company information…','正在加载企业资料…')+'</div>';
    if(state==='error')return '<div id="cq-enterprise" tabindex="-1" class="cq-company-state">'+note('Company information could not be loaded.','企业资料加载失败。','warn')+B('company-retry','Retry','重新加载')+'</div>';
    if(state==='unconfirmed'||state==='denied')return '<div id="cq-enterprise" tabindex="-1">'+note(state==='denied'?'You do not have permission to act for this company.':'The credited company could not be confirmed. Retry later.',state==='denied'?'您无权为该企业办理授信。':'暂时无法确认被授信企业，请稍后重试。','red')+'</div>';
    const partial=state==='partial',a=pFlow().owner==='entity-demo-a';
    const en=partial?missing:(a?'Demo Asset Company A Pte. Ltd.':'Demo Asset Company B Pte. Ltd.');
    return '<div class="cq-company"><strong>'+(partial?L('Not provided','未提供'):company(pFlow()))+'</strong></div>'+(compact?'':dl([[L('Registered English name','登记英文名'),en],[L('Project ID','融资项目编号'),'<span class="mono">'+E(pFlow().id)+'</span>'],[L('Financing request ID','融资申请编号'),'<span class="mono">'+E(flow.demand||D.current(pFlow())?.id||'—')+'</span>']]));
  }
  function retryCompany(){companyState='loading';const draft=flow;setTimeout(()=>{if(flow!==draft)return;companyState='complete';renderCredit();},650);}
  function agreementList(){
    const list=flow.agreements||[];
    return '<div class="cq-upload-head"><label for="cq-agreements">'+L('Agreement files (optional)','协议文件（选填）')+'</label><span class="mono" aria-live="polite">'+list.filter(f=>f.state==='success').length+' / 10 '+L('uploaded','已上传')+'</span></div><p class="hint">'+L('Up to 10 PDF, JPG or PNG files · up to 10 MB each · credit can be saved with none','最多 10 份 PDF、JPG 或 PNG · 每份不超过 10 MB · 不上传也可保存授信')+'</p><label class="cq-upload-picker" for="cq-agreements"><span>'+L('Choose agreements','选择协议文件')+'</span><span class="hint">'+L('Slots remaining: ','还可添加 ')+(10-list.length)+L('',' 份')+'</span><input class="cq-file-input" id="cq-agreements" type="file" accept=".pdf,.jpg,.jpeg,.png" multiple aria-label="'+L('Choose credit agreements','选择授信协议')+'"'+(busy?' disabled':'')+'></label><ul class="cq-files cq-agreement-files" aria-live="polite">'+list.map(f=>'<li><div class="cq-file-meta"><b>'+E(f.name)+'</b><span class="hint">'+fileSize(f.size)+' · '+L({uploading:'Uploading',success:'Uploaded',failed:'Upload failed'}[f.state],{uploading:'上传中',success:'已上传',failed:'上传失败'}[f.state])+'</span>'+(f.state==='uploading'?'<progress max="100" value="'+f.progress+'" aria-label="'+L('Upload progress','上传进度')+'"></progress>':'')+'</div><div class="cq-file-actions">'+(f.state==='success'?B('credit-preview','Preview','预览',f.id)+B('credit-download','Download','下载',f.id):f.state==='failed'?B('credit-retry','Retry','重试',f.id):'')+B('credit-remove',f.state==='uploading'?'Cancel upload':'Remove',f.state==='uploading'?'取消上传':'移除',f.id)+'</div></li>').join('')+'</ul>'+(invalid==='agreements'?err():'');
  }
  function creditHistory(c,readOnly=false){
    if(!creditRelated(c))return '';
    if(!c.history?.length)return '<p class="hint">'+L('No agreements provided for this historical record.','历史记录未提供协议')+'</p>';
    return [...c.history].reverse().map(h=>'<article class="cq-credit-history"><div class="ls-row"><b>'+creditTitle(h.mode)+'</b><span class="hint">'+time(h.at)+'</span></div>'+dl([[L('Credit limit / valid until','授信额度 / 有效期至'),usd(h.total)+' · '+date(h.expires)],[L('Funder','授信机构'),institution(c.fund)]])+(h.remark&&S.role==='fund'&&c.fund===F()?'<p>'+L('Internal remark: ','内部备注：')+E(h.remark)+'</p>':'')+(h.agreements?.length?'<ul class="cq-files cq-agreement-files">'+h.agreements.map(f=>'<li><div class="cq-file-meta"><b>'+E(f.name)+'</b><span class="hint">'+fileSize(f.size)+(creditFiles.has(f.id)?'':L(' · Local file unavailable',' · 本地文件不可用'))+'</span></div><div class="cq-file-actions">'+(readOnly?(creditFiles.has(f.id)?'<a href="#" data-act="cq-credit-download" data-v="'+E(f.id)+'">'+L('Download file','下载文件')+'</a>':''):B('credit-preview','Preview','预览',f.id,false,!creditFiles.has(f.id))+B('credit-download','Download','下载',f.id,false,!creditFiles.has(f.id)))+'</div></li>').join('')+'</ul>':'<p class="hint">'+L('No agreements provided for this historical record.','历史记录未提供协议')+'</p>')+'</article>').join('');
  }
  /* 授信核验不通过时直接进入企业授信，页面顶部用一句话说明原因。 */
  function creditReason(p,c){
    if(flow.mode==='new')return note('Your institution has not granted credit to this company yet.','本机构尚未给该企业授信。');
    if(flow.mode==='renew')return note('Your credit to this company expired on '+date(c.expires)+'.','本机构对该企业的授信已于 '+date(c.expires)+' 到期。');
    const amount=D.current(p)?.amount||0,a=available(c);
    return note('Available credit does not cover this quote: '+usd(amount)+' − '+usd(a)+' = '+usd(Math.max(0,amount-a))+' (financing amount − available credit = shortfall).','可用授信不足以覆盖本次报价：'+usd(amount)+' − '+usd(a)+' = '+usd(Math.max(0,amount-a))+'（本次融资金额 − 可用授信 = 差额）。');
  }
  function creditEditor(){
    const p=pFlow(),c=credit(p),increase=flow.mode==='increase';
    const conditions='<div class="cq-grid">'+field('total',increase?'Increase amount (USDT) *':'Credit limit (USDT) *',increase?'增加额（USDT）*':'授信额度（USDT）*',flow.total,'text','inputmode="decimal"')+'<div>'+field('expires','Credit valid until *','授信有效期至 *',flow.expires,'date',increase?'min="'+c.expires+'"':'min="'+anniversary(1)+'" max="'+anniversary(5)+'"')+'<p class="hint">'+(increase?L('Current: ','当前：')+date(c.expires)+' · '+L('Keep or extend','可保持或延后'):date(anniversary(1))+' — '+date(anniversary(5)))+'</p></div></div>'+(increase?'<p class="hint">'+L('Current limit: ','当前额度：')+usd(c.total)+'</p><p id="cq-adjusted" class="cq-adjusted">'+L('Adjusted limit: ','调整后额度：')+usd(c.total+Number(flow.total||0))+'</p>':flow.mode==='renew'?'<p class="hint">'+L('Previous expiry: ','原到期日：')+date(c.expires)+'</p>':'')+(['total','expires'].includes(invalid)?err():'')+field('remark','Internal remark (optional)','内部备注（选填）',flow.remark,'text','maxlength="200"');
    return (flow.discard?'<div class="cq-discard" role="alert"><b>'+L('Discard unsaved credit changes?','放弃未保存的授信修改？')+'</b><p>'+L('Entered terms and new uploads will be discarded.','填写的授信条件及本次上传文件将被放弃。')+'</p><div class="ls-row">'+B('keep-editing','Continue editing','继续编辑','',true)+B('discard-credit','Discard changes','放弃修改')+'</div></div>':'')+'<div class="ls-row cq-mode">'+CF.tag('accent',creditTitle(flow.mode))+'<span class="hint">'+institution(F())+'</span></div>'+creditReason(p,c)+section(L('Credited company','被授信企业'),companyView(true)+(invalid==='enterprise'?err():''))+section(L('Credit terms','授信条件'),conditions)+section(L('Credit agreements (optional)','本次授信协议（选填）'),agreementList())+(!['total','expires','agreements','enterprise'].includes(invalid)?err():'');
  }
  function uploadAgreement(f){
    const draft=flow,fail=fault==='uploadFailure';if(fail)fault='normal';
    f.state='uploading';f.progress=20;const attempt=f.attempt=(f.attempt||0)+1;
    const live=()=>flow===draft&&flow.agreements.includes(f)&&f.attempt===attempt;
    setTimeout(()=>{if(live()){f.progress=65;renderCredit();}},250);
    setTimeout(()=>{if(live()){f.state=fail?'failed':'success';f.progress=100;renderCredit();}},700);
  }
  function pickAgreements(selected){
    if(flow.stage!=='credit'||!creditWritable()||busy)return;
    problem='';invalid='';
    if(flow.agreements.length+selected.length>10){failure('This selection exceeds the limit. You can add '+(10-flow.agreements.length)+' more files.','本批文件超出数量上限，还可添加 '+(10-flow.agreements.length)+' 份；已保留原有文件。','agreements');renderCredit();return;}
    const rejected=[];
    selected.forEach(file=>{
      if(!/\.(pdf|jpe?g|png)$/i.test(file.name)||!['application/pdf','image/jpeg','image/png',''].includes(file.type))rejected.push(file.name+L(' (unsupported format)','（格式不支持）'));
      else if(file.size===0||file.size>10*1024*1024)rejected.push(file.name+(file.size===0?L(' (empty file)','（空文件）'):L(' (over 10 MB)','（超过 10 MB）')));
      else{const f={id:'credit-file-'+(++db.serial),name:file.name,size:file.size};flow.agreements.push(f);creditFiles.set(f.id,file);uploadAgreement(f);}
    });
    if(rejected.length)failure('Not added: '+rejected.join('; '),'未添加：'+rejected.join('；'),'agreements');
    renderCredit();
  }
  function submitCredit(){
    const p=pFlow(),c=credit(p),num=Number(flow.total),total=flow.mode==='increase'&&c?c.total+num:num;
    if(!creditWritable()||['unconfirmed','denied'].includes(companyState))return failure('The company or your permission cannot be confirmed.','无法确认企业归属或您的办理权限。','enterprise');
    if(!/^\d+(\.\d{1,2})?$/.test(flow.total)||!Number.isFinite(total)||num<=0||c&&(total<c.total||total<c.principal+used(c)))return failure('Enter a positive amount with up to 2 decimal places; the credit limit cannot decrease.','请输入大于 0、最多两位小数的金额；额度不得调低或低于已用额。','total');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(flow.expires))return failure('Choose the credit expiry date.','请选择授信有效期。','expires');
    if(flow.mode==='increase'){
      if(flow.expires<c.expires)return failure('The expiry date cannot be earlier than the current date.','不得早于当前授信有效期。','expires');
      if(flow.expires>c.expires)return failure('The extension limit cannot be verified at this time. Keep the current date or retry later.','暂时无法校验延期上限，请保持原有效期或稍后重试。','expires');
    }else if(flow.expires<anniversary(1)||flow.expires>anniversary(5))return failure('Choose a date between '+anniversary(1)+' and '+anniversary(5)+'.','有效期须在 '+anniversary(1)+' 至 '+anniversary(5)+' 之间。','expires');
    if(flow.agreements.some(f=>f.state!=='success'))return failure('Wait for pending uploads; retry or remove failed files.','请等待上传完成，并重试或移除失败文件。','agreements');
    asyncAction(()=>{
      if(!creditWritable()||['unconfirmed','denied'].includes(companyState)){failure('Permission changed. No credit was saved.','权限已变化，未保存授信。','enterprise');return;}
      const record=c||{id:'CR-DEMO-'+(++db.serial),owner:p.owner,fund:F(),principal:0,first:D.iso(),history:[]};
      record.history.push({at:D.iso(),mode:flow.mode,total,expires:flow.expires,remark:flow.remark,agreements:flow.agreements.map(({id,name,size})=>({id,name,size}))});
      record.total=total;record.expires=flow.expires;if(!c)db.credits.push(record);flow.creditSaved=true;flow.agreements=[];flow.discard=false;
      closeFlow();CF.toast(L('Credit saved. Continue to quote.','已授信，请继续报价'));
    });
  }
  function creditFileAction(id,previewOnly){
    const draft=['credit','file-preview'].includes(flow.stage)&&creditWritable()&&flow.agreements?.some(f=>f.id===id&&f.state==='success');
    const historical=db.credits.some(c=>creditRelated(c)&&c.history?.some(h=>h.agreements?.some(f=>f.id===id)));
    if(!draft&&!historical){CF.toast(L('You cannot access this agreement.','您无权访问该协议。'));return;}
    const file=creditFiles.get(id);if(!file){CF.toast(L('The local file is unavailable.','本地文件不可用，请向经办人索取原件。'));return;}
    const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;
    if(previewOnly){flow.previewURL=url;flow.previewName=file.name;visit('file-preview');return;}
    a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function creditOverview(p){
    const list=db.credits.filter(c=>c.owner===p.owner&&creditRelated(c));if(!list.length)return '';
    return '<section class="card"><div class="card-head"><h2 class="ls-subheading">'+L('Credit and agreements','授信与协议')+'</h2></div><div class="card-b">'+list.map(c=>'<details class="ls-history"><summary>'+institution(c.fund)+' · '+usd(c.total)+' · '+L('Valid until ','有效期至 ')+date(c.expires)+'</summary>'+creditHistory(c)+'</details>').join('')+'</div></section>';
  }
  const company=p=>p.owner==='entity-demo-a'?L('Demo Asset Company A','演示资产企业 A'):L('Demo Asset Company B','演示资产企业 B');
  const institution=id=>id==='fund-b'?L('Demo Capital B','演示资金机构 B'):L('Demo Capital A','演示资金机构 A');
  const usd=n=>CF.fmtAmt(n)+' USDT',pv=n=>CF.fmtAmt(n)+' USD',time=n=>CF.fmtTime(typeof n==='number'?new Date(n).toISOString():n),date=n=>CF.fmtDate(n);
  const pNow=()=>D.project(decodeURIComponent((location.hash.match(/\/project\/([^?]+)/)||[])[1]||''));
  const pFlow=()=>D.project(flow.project),qFlow=()=>db.quotes.find(q=>q.id===flow.quote);
  const active=p=>db.quotes.find(q=>q.project===p.id&&['waiting','funding'].includes(q.state));
  const related=q=>S.role==='asset'&&D.mine(D.project(q.project))||S.role==='fund'&&q.fund===F();
  /* 只有已认证的资金方可以授信与报价；审核中或已驳回的看得到入口，触达时给出认证引导。 */
  const funderStatus=()=>CF.funder?.review?.account?.status||'verified';
  const certified=()=>S.role==='fund'&&(CF.portalEligible?CF.portalEligible().verified:funderStatus()==='verified');
  const credit=p=>db.credits.filter(c=>c.owner===p.owner&&c.fund===F()).sort((a,b)=>Date.parse(a.first)-Date.parse(b.first))[0];
  /* 报价上链确认中：签名已发出、授权尚未上链；本轮需求与本机构在途报价金额按本笔预占，没有融资业务编号。 */
  const holding=x=>['processing','unknown'].includes(x.state);
  const pendingOf=p=>{const d=D.current(p);return d?(db.pending||[]).find(x=>x.project===p.id&&x.demand===d.id&&holding(x)):null;};
  const used=c=>db.quotes.filter(q=>q.owner===c.owner&&q.fund===c.fund&&['waiting','funding'].includes(q.state)).reduce((n,q)=>n+q.amount,0)+(db.pending||[]).filter(x=>x.owner===c.owner&&x.fund===c.fund&&holding(x)).reduce((n,x)=>n+x.amount,0);
  const available=c=>c?Math.max(0,c.total-c.principal-used(c)):0;
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(db));}catch(_){}D.save();};
  const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:S.tz||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(D.now()));
  function anniversary(years){const n=new Date(day()+'T12:00:00Z');n.setUTCFullYear(n.getUTCFullYear()+years);return n.toISOString().slice(0,10);}
  /* 账户目录归企业账户模块（CF.EA）保管，本模块只读取与选用，不另建一份字段与校验。 */
  const EA=CF.EA;
  const accountKind=()=>'crypto';
  const accountFieldLabels=EA.labels;
  const accountName=EA.name;
  const missingFields=EA.missing;
  const accountsFor=q=>accountScene==='empty'?[]:EA.accounts(q.owner,accountKind(q.ccy));
  const maskTail=EA.maskTail,maskAddress=EA.maskAddress;
  const accountSnapshot=EA.snapshot;
  const accountRows=EA.rows;
  const FXSRC=['Operations · Exchange rate management','运营端汇率管理'];
  const demoHash=seed=>{let h=2166136261;for(const c of String(seed))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return '0x'+Array.from({length:64},()=>(h=Math.imul(h^(h>>>13),1597334677)>>>0,(h>>>28).toString(16))).join('');};
  /* 复用控制台既有的演示放款合约；不是项目质押合约，不代表真实部署配置。 */
  Q.loanContract='0x3B6dA2c94E07f1a85D2c6E40b9F17a3C8e05D2a7';
  const clone=v=>JSON.parse(JSON.stringify(v));
  function termSnapshot(x){const p=D.project(x.project),d=p?.demands.find(d=>d.id===x.demand);return clone({project:x.project,demand:x.demand,owner:x.owner,fund:x.fund,context:x.context||{project:p.name,asset:x.owner==='entity-demo-a'?['Demo Asset Company A','演示资产企业 A']:['Demo Asset Company B','演示资产企业 B'],funder:x.fund==='fund-b'?['Demo Capital B','演示资金机构 B']:['Demo Capital A','演示资金机构 A']},amount:x.amount,unit:'USDT',ccy:x.ccy,settlement:x.settlement,fx:x.fx,rate:x.rate,repayment:'quarterly-interest',repay:x.repay,lender:x.lender,receiving:x.payee||d?.payee||null,repayTo:x.repayTo,network:'Ethereum',contract:x.contract||Q.loanContract});}
  function confirmDemo(x){return {state:'verified',version:'QT-'+x.id,submission:x.id,terms:termSnapshot(x),signer:x.lender?.address,at:x.at,proof:demoHash(x.id+'-terms'),demo:true};}
  function integrity(x){const c=x?.confirmation;return !!(x?.lender?.address&&c?.state==='verified'&&c.signer===x.lender.address&&c.submission===(x.submission||x.id)&&JSON.stringify(c.terms)===JSON.stringify(termSnapshot(x)));}
  /* 放款合约对放款地址的授权额度：同一地址可同时为多笔待接受报价授权，任何一笔都不占用其他报价仍需的额度。 */
  const allowKey=(addr,ccy)=>addr+'|'+ccy;
  const reserved=(addr,ccy,except)=>db.quotes.filter(q=>q.state==='waiting'&&q!==except&&q.lender?.address===addr&&q.ccy===ccy).reduce((n,q)=>n+q.settlement,0);
  function reset(){db={quotes:[],credits:[],serial:10,events:[],allowances:{},pending:[]};const p=D.project('FP-DEMO-003'),d=p&&D.current(p);if(d?.state==='quoted'){const at=Date.parse(d.quoteAt),wallet=EA.accounts('fund-a','crypto').find(a=>a.chain==='ETH'&&!missingFields(a).length),lender=wallet?accountSnapshot(wallet):null;db.quotes.push({id:'FB-DEMO-0001',project:p.id,owner:p.owner,demand:d.id,amount:d.amount,ccy:'USDT',rate:'6.40',settlement:d.amount,fx:{value:1,version:'FX-DEMO-001',at:at-3*86400000,source:FXSRC},at,state:'waiting',fund:'fund-a',repay:p.expires,lender,repayTo:lender,auth:{at:at-H/2,tx:demoHash('FB-DEMO-0001-auth'),gas:'0.002100'},chain:null,progress:{}});db.quotes[0].payee=d.payee?clone(d.payee):null;db.quotes[0].confirmation=confirmDemo(db.quotes[0]);if(lender)db.allowances[allowKey(lender.address,'USDT')]=d.amount;d.institution=['Demo Capital A','演示资金机构 A'];}db.credits.push({id:'CR-DEMO-0001',owner:'entity-demo-a',fund:'fund-a',total:1500000,principal:100000,expires:anniversary(1),first:D.iso(),history:[]});save();}
  try{db=CF.LSReseeded?null:JSON.parse(localStorage.getItem(KEY));if(!db?.quotes)reset();}catch(_){reset();}
  // 旧版本把账户目录存在本模块里；企业账户模块建成后只保留一份，这里丢弃旧副本。
  if(db&&db.accounts){delete db.accounts;save();}
  if(db&&!db.allowances)db.allowances={};if(db&&!db.pending)db.pending=[];
  // 项目已不存在的报价无法渲染，直接丢弃，避免整页在启动时崩掉。
  if(db?.quotes){const kept=db.quotes.filter(q=>D.project(q.project));if(kept.length!==db.quotes.length){db.quotes=kept;save();}}
  // 旧演示快照的来源统一为运营端汇率管理，不重算已锁定的金额。
  db.quotes.forEach(q=>[q.fx,q.l7?.fx].filter(Boolean).forEach(fx=>{if(fx.version?.startsWith('FX-DEMO-')&&/demo$/.test(fx.source?.[0]||''))fx.source=['Operations · Exchange rate management','运营端汇率管理'];}));
  Q.data=()=>db;
  /* 链上放款记录由报价接受流程生成；沿用已存快照，不再生成独立的人工放款业务。 */
  Q.disbursements=()=>db.quotes.map(q=>q.l7).filter(x=>x&&D.project(x.project));
  Q.related=q=>!!q&&related(q);Q.save=save;Q.startJourney=step=>journeyStart(step);
  /* 从机构账户登记完放款地址后回到原报价：已填内容保留，授权按链上事实重新判断。 */
  Q.resumeSelection=()=>{const draft=pendingDraft;pendingDraft=null;const p=draft&&D.project(draft.project);
    if(!p||S.role!=='fund'||!certified()||!Q.quoteAvailable(p)){CF.toast(L('This request no longer accepts quotes.','本轮需求已不再接受报价。'));return;}
    flow={...draft,stage:'quote'};open('quote');CF.render();};
  /* 账户目录由企业账户模块保管，这里只把同一份转给放款与控制台；授信协议文件仍由本模块保管。 */
  Q.accounts=EA.accounts;
  Q.accountIcons=a=>accountIcons(a);Q.accountRows=accountRows;Q.accountName=accountName;Q.accountMissing=missingFields;Q.accountSnapshot=accountSnapshot;Q.accountLabels=accountFieldLabels;
  Q.accountKey=EA.key;Q.accountBrief=a=>accountBrief(a);Q.accountTail=a=>accountTail(a);
  Q.agreements=(owner,fundId)=>db.credits.filter(c=>c.owner===owner&&(!fundId||c.fund===fundId)).flatMap(c=>(c.history||[]).flatMap(h=>(h.agreements||[]).map(f=>({credit:c.id,file:f,available:creditFiles.has(f.id)}))));
  Q.creditFile=id=>creditFiles.get(id);
  Q.hasHistory=p=>db.quotes.some(q=>q.project===p.id);
  Q.quoteAvailable=p=>{const n=D.numbers(p),d=D.current(p);return !!(d?.state==='open'&&d.withdraw?.state!=='processing'&&!D.terminal(p)&&!p.expired&&n.limit>=p.balance+n.fly);};
  const originalActions=D.actions;D.actions=p=>{const a={...originalActions(p),quote:S.role==='fund'&&Q.quoteAvailable(p)};if(pendingOf(p))a.edit=false;return a;};
  const B=(act,en,zh,value='',primary=false,off=false)=>'<button type="button" class="btn'+(primary?' primary':'')+'" data-act="cq-'+act+'" data-v="'+E(value)+'"'+(off?' disabled':'')+'>'+L(en,zh)+'</button>';
  const note=(en,zh,t='accent')=>CF.note(t,'<div class="cq-note-content">'+L(en,zh)+'</div>');
  const err=()=>problem?'<div id="cq-error" role="alert">'+CF.note('red',L(...problemCopy))+'</div>':'';
  const dl=rows=>'<dl class="dl cq-dl">'+rows.map(r=>'<div class="cq-fact"><dt>'+r[0]+'</dt><dd>'+r[1]+'</dd></div>').join('')+'</dl>';
  const section=(title,html)=>'<section class="cq-section"><h3>'+title+'</h3>'+html+'</section>';
  const field=(key,en,zh,value='',type='text',extra='')=>'<div class="field"><label for="cq-'+key+'">'+CF.fieldLabel(L(en,zh))+'</label><input class="inp" id="cq-'+key+'" data-cq-field="'+key+'" type="'+type+'"'+(en.includes('*')?' aria-required="true"':'')+' value="'+E(value)+'" '+extra+(invalid===key?' aria-invalid="true" aria-describedby="cq-error"':'')+'></div>';
  const chainState=q=>['processing','unknown'].includes(q?.chain?.state)?q.chain.state:'';
  const status=q=>q.state==='waiting'&&chainState(q)?L(...{processing:['Disbursement processing','放款处理中'],unknown:['On-chain result to be verified','链上结果待核实']}[chainState(q)]):L({waiting:'Awaiting acceptance',funding:'Disbursement processing',funded:'Accepted · disbursed',terminated:'Accepted · business terminated',rejected:'Rejected',expired:'Quote invalidated'}[q.state],{waiting:'待接受',funding:'放款处理中',funded:'已接受 · 已放款',terminated:'已接受 · 业务已终止',rejected:'已拒绝',expired:'报价已失效'}[q.state]);
  const addrLabel=x=>x?E(Array.isArray(x.label)?L(...x.label):x.label||''):'';
  const addrInline=x=>x?CF.addrHead(Array.isArray(x.label)?L(...x.label):x.label||'')+CF.addrFull(x.address):'—';
  const addrSummary=x=>x?'<b>'+addrLabel(x)+'</b><span class="hint">'+E('Ethereum')+' · '+maskAddress(x.address)+'</span>':'—';
  /* 签名前核对本次交互的放款合约（名称、网络、完整地址，可复制、可在浏览器打开）与本次签名用途；合约读取失败时不能签名。 */
  function signCheck(addr,purpose){
    const contract=contractScene==='error'?'<div class="ls-inline-fail" role="alert"><span>'+L('The lending contract is temporarily unavailable, so you cannot sign right now.','放款合约信息暂时不可用，暂不能签名。')+'</span>'+B('contract-retry','Retry','重试')+'</div>'
      :'<div class="ls-signing-contract"><dt><span class="ls-signing-label">'+L('Lending contract','放款合约')+'<span class="cq-net">Ethereum</span></span><span class="ls-signing-tools">'+CF.copyBtn('ls-copy',addr,L('Copy lending contract address','复制放款合约地址'))+CF.linkOut('https://etherscan.io/address/'+encodeURIComponent(addr),L('Open the contract in a blockchain explorer (new window)','在区块链浏览器打开该合约（新窗口）'))+'</span></dt><dd><span class="mono ls-signing-address">'+E(addr)+'</span></dd></div>';
    return '<div class="ls-sign-check cq-sign-check" id="cq-contract"><dl class="ls-signing-facts">'+contract+'</dl><p class="ls-sign-purpose">'+purpose+'</p></div>';
  }
  const contractFail=()=>failure('The lending contract is temporarily unavailable. Your wallet was not opened; retry later.','放款合约信息暂时不可用，未唤起钱包，请稍后重试。');
  const txChip=(label,h)=>h&&CF.LSHash?'<span class="cq-turn-hash">'+label+' '+CF.LSHash(h)+'</span>':'';
  const payeeOf=q=>{const d=D.project(q.project)?.demands.find(x=>x.id===q.demand);return q.payee||q.confirmation?.terms?.receiving||d?.payee||null;};
  const authLabel=q=>!q.lender?'—':q.state==='funded'?L('Used for this disbursement','已按本笔使用'):['rejected','expired'].includes(q.state)?(q.auth?.revoked?L('Revoked','已撤销'):L('Not revoked','未撤销')):L('Active','有效');
  const demandEnded={coverage:['Financing request ended · automatically invalidated, pledge water level insufficient','所属融资需求终结 · 自动失效·质押水位不足'],expiry:['Financing request ended · project term ended','所属融资需求终结 · 项目到期'],withdrawn:['Financing request ended · withdrawn by the asset holder','所属融资需求终结 · 资产方撤下']};
  const reason=q=>q.state==='expired'?L(...(demandEnded[q.reason]||['Financing request ended','所属融资需求终结'])):E(q.reason||'');
  /* 报价没有有效期：只说明锁定起始与已锁定时长，不出现截止时刻或剩余时间。 */
  function lockInfo(q){if(!['waiting','funding','funded','rejected'].includes(q.state)||!related(q))return '';const end=q.state==='waiting'?D.now():(q.done||D.now()),hours=Math.floor((end-q.at)/H);return '<div class="cq-clock"><span>'+L('Lock started: ','锁定起始：')+time(q.at)+'</span><span>'+(q.state==='waiting'?L('Locked for ','已锁定 ')+hours+L(' h',' 小时'):L('Locked for ','共锁定 ')+hours+L(' h (ended)',' 小时（已停止）'))+'</span></div>';}
  const rateText=q=>'1 USDT = '+q.fx.value+' '+q.ccy;
  function snapshot(q){return dl([[L('Exchange rate','汇率'),rateText(q)],[L('Effective at','生效时间'),time(q.fx.at)],[L('Rate source','汇率来源'),L(...q.fx.source)],[L('Version','版本标识'),E(q.fx.version)]]);}
  /* 详情复用同一确认版本；余额、占用和质押是当前事实，不写入固定条款。所有凭证仅为原型演示。 */
  function fixedTermsView(t){return dl([
    [L('Project','融资项目'),E(L(...t.context.project))],[L('Project / request','项目 / 融资申请'),E(t.project)+' / '+E(t.demand)],
    [L('Asset holder','资产企业'),E(L(...t.context.asset))],[L('Funder','报价机构'),E(L(...t.context.funder))],
    [L('Financing amount','融资金额'),usd(t.amount)],[L('Settlement amount','结算金额'),money(t.settlement,t.ccy)],
    [L('Annual interest rate','年化利率'),E(t.rate)+'%'],[L('Repayment type','还款类型'),L('Quarterly interest; principal and remaining interest at maturity','按季付息；到期还本付息')],
    [L('Final repayment date','最终还款日'),date(t.repay)],[L('Funding address','放款地址'),addrInline(t.lender)],
    [L('Receiving address','融资收款地址'),addrInline(t.receiving)],[L('Repayment address','还款收款地址'),addrInline(t.repayTo)],
    [L('Network / lending contract','网络 / 放款合约'),'Ethereum · <span class="mono cq-break">'+E(t.contract)+'</span>']
  ])+snapshot(t);}
  function confirmationView(x){if(!x||!related(x))return '';const c=x.confirmation,t=c?.terms;
    if(!t)return note('The confirmation evidence for this historical example is unavailable. Do not accept until the terms are verified.','此历史示例的条款确认凭证暂不可用，核验一致前不可接受。','warn');
    const check=x.signCheck,result=!check?'':check.state==='match'?L('Matches · checked before disbursement','一致 · 放款前核验'):check.state==='mismatch'?L('Does not match · not disbursed','不一致 · 未放款'):L('Could not be checked · retry later','暂时无法核验 · 可稍后重试');
    return '<details class="ls-history cq-confirmation"><summary>'+L('Confirmed terms and evidence','确认条款与凭证')+'</summary>'+dl([
      ...(result?[[L('Check before disbursement','放款前核验'),result+(check.at?' · '+time(check.at):'')]]:[]),[L('Confirmed version','确认版本'),E(c.version)],
      [L('Submission reference','本次提交凭证'),E(c.submission)],
      [L('Signing address','签名地址'),c.signer?CF.addrFull(c.signer):'—'],
      [L('Confirmed at','签名确认时间'),time(c.at)],
      [L('Confirmation evidence (demo)','确认凭证（演示）'),'<span class="mono cq-break">'+E(c.proof||'—')+'</span>'],
      [L('Approval gas incurred','已产生授权 gas'),x.auth?.gas?E(x.auth.gas)+' ETH':L('To be verified','待核实')]
    ])+fixedTermsView(t)+'</details>';
  }
  Q.confirmationView=confirmationView;
  function pendingEvidence(x){return note(x.auth?'The offer result is not confirmed. Contact platform support; do not submit again.':'The offer result is not confirmed. Contact platform support; do not submit again.',x.auth?'报价结果尚未确定，请联系平台客服人员，不要重复提交。':'报价结果尚未确定，请联系平台客服人员，不要重复提交。','warn')+confirmationView(x);}
  function terms(q){const p=D.project(q.project),n=D.numbers(p);const facts=[[L('Financing business ID','融资业务编号'),E(q.id)],[L('Financing request ID','融资申请编号'),E(q.demand)],[L('Project ID','融资项目编号'),E(q.project)],[L('Asset holder','资产方'),company(p)],[L('Funder','资金方'),institution(q.fund)],[L('Financing amount','融资金额'),usd(q.amount)],[L('Settlement amount','结算金额'),CF.fmtAmt(q.settlement)+' '+q.ccy],[L('Annual interest rate','年化利率'),q.rate+'%'],[L('Repayment type','还款类型'),L('Quarterly interest; principal and remaining interest at maturity','按季付息；到期还本付息')],[L('Final repayment date','最终还款日'),date(q.repay)],[L('Receiving address','融资收款地址'),addrInline(payeeOf(q))],[L('Funder\'s repayment address','资金方还款收款地址'),addrInline(q.repayTo)],[L('Quoted at / lock started','报价时间 / 锁定起始'),time(q.at)],[L('Eligible borrowing limit','有效质押额'),pv(n.limit)],[L('Eligible pledged value','有效质押价值'),pv(n.value)+' · '+n.valid.length+L(' tokens',' 张')]];
    const plan=CF.L8?CF.L8.initial({...q,state:'waiting'}):'';
    return dl(facts)+snapshot(q)+plan+confirmationView(q);
  }
  function notify(q,event){const recipients={submitted:['asset'],disbursed:['asset'],failed:['asset',q.fund]}[event]||[q.fund];recipients.forEach(who=>{if(!db.events.some(e=>e.quote===q.id&&e.event===event&&e.who===who))db.events.push({quote:q.id,event,who,at:D.now()});});}
  function finish(q,state,why,at=D.now()){if(q.state!=='waiting')return;const p=D.project(q.project),d=p.demands.find(d=>d.id===q.demand);q.state=state;q.reason=why;q.done=at;if(state==='funding'){d.state='funding';p.state='financing';}else if(d.state==='quoted'){d.state='open';d.institution=null;d.quoteAt=null;d.rate=null;d.tenorDays=null;p.state='raising';}if(state!=='expired')notify(q,state==='rejected'?'rejected':'accepted');save();}
  /* 链上放款成功：接受成功、放款完成；在途转为本金、生成放款记录并交还款，同一时刻完成。 */
  function complete(q){const p=D.project(q.project),d=p.demands.find(x=>x.id===q.demand),c=db.credits.find(c=>c.owner===q.owner&&c.fund===q.fund),at=D.now(),stamp=new Date(at).toISOString();
    const chainTx=q.chain?.tx;q.state='funded';q.done=at;q.chain=null;q.auth={...(q.auth||{}),used:true};d.state='funded';p.state='financing';p.balance+=q.amount;if(c)c.principal+=q.amount;
    if(q.lender){const k=allowKey(q.lender.address,q.ccy);db.allowances[k]=Math.max(0,(db.allowances[k]||0)-q.settlement);}
    const receiving=payeeOf(q),payee=receiving?{kind:'crypto',chain:'ETH',...receiving}:null;q.progress={...(q.progress||{}),account:payee};
    q.l7={id:q.id,project:q.project,owner:q.owner,fund:q.fund,request:q.demand,ccy:q.ccy,amount:q.amount,settlement:q.settlement,rate:q.rate,fx:q.fx,at:q.at,acceptedAt:at,account:payee?{...payee}:{},state:'confirmed',confirmedAt:stamp,short:false,gap:0,expired:false,history:[],plan:'handoff',
      record:{id:'LN'+stamp.slice(0,10).replaceAll('-','')+String(++db.serial).padStart(6,'0'),at:stamp,account:q.repayTo?{...q.repayTo}:null,form:{hash:chainTx||demoHash(q.id+stamp),paidAt:stamp,files:[]}}};
    notify(q,'accepted');notify(q,'disbursed');}
  function disburse(q,outcome){if(q.state!=='waiting'||q.chain?.state!=='processing')return;const d=D.project(q.project).demands.find(x=>x.id===q.demand),mine=S.role==='asset'&&related(q);
    if(outcome==='unknown')q.chain.state='unknown';
    else if(outcome==='failed'){q.chain={state:'failed',at:D.now(),tx:q.chain?.tx,reason:['The funder\'s authorization or balance no longer covers this settlement amount.','资金方放款地址的授权或余额已不足以支付本笔结算金额。']};if(d?.state==='funding')d.state='quoted';notify(q,'failed');if(mine)CF.toast(L('The on-chain disbursement was not completed. The quote is still awaiting your response.','链上放款未完成，本笔仍待确认。'));}
    else{complete(q);if(mine)CF.toast(L('Disbursed on chain. The quote is accepted.','链上放款成功，报价已接受。'));}
    Q.sweep();save();CF.render();}
  /* 唯一的系统性终结：L5 判定本轮需求终结（项目到期 / 自动失效·质押水位不足），L6 同事件把待接受报价置为已失效。 */
  Q.sweep=()=>{let changed=false;db.quotes.filter(q=>q.state==='waiting'&&!chainState(q)).forEach(q=>{const p=D.project(q.project),d=p?.demands.find(d=>d.id===q.demand);if(d&&d.state==='ended'){finish(q,'expired',d.reason||'coverage',d.endedAt?Date.parse(d.endedAt):D.now());changed=true;}});return changed;};
  const originalRecompute=D.recompute;D.recompute=p=>{originalRecompute(p);Q.sweep();};
  const originalSeed=D.seed;D.seed=()=>{originalSeed();reset();};
  function failure(en,zh,key=''){problem=L(en,zh);problemCopy=[en,zh];invalid=key;return false;}
  function canQuote(p){if(S.role!=='fund'||flow.fund&&flow.fund!==F())return failure('Only the current funder may quote.','仅资金方可报价。');if(!certified())return failure('Only verified funders can grant credit or quote. Complete institution verification first.','只有已认证的资金方可以授信与报价，请先完成机构认证。');const d=D.current(p);if(p.expired||D.now()>=Date.parse(p.expires))return failure('The project term has ended. New quotes are unavailable.','项目已到期，不能新增报价。');if(!d||d.state==='ended')return failure('This financing request has ended.','本轮融资需求已终结。');if(d.state!=='open'||active(p))return failure('Another institution has already quoted on this request.','本轮需求已被其他机构报价。');const pend=pendingOf(p);if(pend)return pend.fund===F()?failure('Your offer for this round is pending on-chain.','本机构的报价正在上链确认。'):failure('Another institution\'s offer for this round is being confirmed on chain.','本轮正在处理其他机构的报价。');return true;}
  function checkCoverage(p,terminal=false){if(fault==='coverageUnavailable')return failure('Pledge sufficiency cannot be checked now. Retry later.','暂时无法完成质押校验，请稍后重试。');if(fault==='coverage'&&terminal){D.tokens.filter(t=>t.pool===p.id).forEach(t=>t.valid=false);D.recompute(p);fault='normal';}const n=D.numbers(p);if(n.limit<p.balance+n.fly){D.recompute(p);}if(!D.current(p)||D.current(p).state!=='open')return failure('This financing request has been invalidated (pledge water level insufficient). The asset holder must add collateral and publish a new request.','该融资需求已失效（质押水位不足），请待资产方补足质押后重新发布。');return true;}
  function mode(p){const c=credit(p);return !c?'new':c.expires<day()?'renew':available(c)<D.current(p).amount?'increase':'quote';}
  function creditForm(m){const p=pFlow(),c=credit(p);flow.mode=m;flow.stage='credit';flow.total=m==='renew'?String(c.total):'';flow.expires=m==='increase'?c.expires:anniversary(1);flow.remark='';flow.agreements=[];flow.creditSaved=false;flow.discard=false;flow.initial={total:flow.total,expires:flow.expires};if(companyState==='loading')retryCompany();}
  function open(stage){problem='';invalid='';lastView='';flow.stage=stage;CF.openLayer('drawer','cq-flow');}
  function startQuote(p){if(S.role==='fund'&&!certified()){CF.openLayer('modal','f-gate');return;}const back=flow.stage==='request'?{demand:flow.demand,selected:flow.selected,top:document.querySelector('.drawer-b,.modal-b')?.scrollTop||0}:null;rememberTrigger('ls-quote');flow={project:p.id,demand:D.current(p)?.id,returnRequest:back,onReturn:flow.onReturn,fund:F(),ccy:'',rate:'',lender:'',repay:'',auth:null,stage:'quote'};if(!canQuote(p)||!checkCoverage(p)){CF.toast(problem);return;}flow.mode=mode(p);rememberTrigger('ls-quote');if(flow.mode==='quote')open('quote');else{creditForm(flow.mode);open('credit');}if(flow.mode==='quote'&&companyState==='loading')retryCompany();}
  function beginReview(q){Q.sweep();if(!q||!related(q)||S.role!=='asset'){CF.toast(L('You cannot respond to this quote.','您无权处理该报价。'));return;}if(q.state!=='waiting'){CF.toast(status(q)+(reason(q)?' · '+reason(q):''));return;}if(chainState(q)){CF.toast(chainState(q)==='unknown'?L('The on-chain result is to be verified. Please contact platform support.','链上结果待核实，请联系平台客服人员。'):L('The on-chain disbursement is processing. Wait for the result.','链上放款处理中，请等待结果。'));return;}const back=flow.stage==='request'?{demand:flow.demand,selected:flow.selected,top:document.querySelector('.drawer-b,.modal-b')?.scrollTop||0}:null;rememberTrigger('ls-handoff');flow={project:q.project,quote:q.id,demand:q.demand,returnRequest:back,onReturn:flow.onReturn};open('respond');queryFundingBalance(q);}
  function creditInfo(p,c=credit(p)){return c?dl([[L('Credit ID','授信编号'),E(c.id)],[L('Credit limit','授信额度'),usd(c.total)],[L('Outstanding principal','授信占用额'),usd(c.principal)],[L('In-flight quotes','在途报价金额'),usd(used(c))],[L('Total credit used','授信已用额'),usd(c.principal+used(c))],[L('Available credit','可用授信'),usd(available(c))],[L('Valid until','有效期至'),date(c.expires)],[L('First credit granted','首次授信时间'),time(c.first)]]):'';}
  const money=(n,ccy)=>'<span class="mono">'+CF.fmtAmt(n)+' '+E(ccy)+'</span>';
  const need=()=>{const d=D.current(pFlow());return d&&flow.fx?d.amount*flow.fx.value:0;};
  /* 放款地址只能从本机构机构账户已登记的 Ethereum 数币账户中选；不预选、不能手输。 */
  const lenderAccounts=()=>accountScene==='empty'?[]:EA.accounts(F(),'crypto').filter(a=>a.chain==='ETH');
  const lenderPick=key=>lenderAccounts().find(a=>a.id===flow[key]&&!missingFields(a).length);
  /* 余额为演示值：充足时远高于所需，不足时只够六成。 */
  const balanceOf=()=>balanceScene==='short'?Math.floor(need()*0.6):Math.max(5000000,need()*2);
  function preview(){if(!flow.ccy)return '';if(fault==='fxUnavailable')return note('The exchange rate cannot be confirmed right now. Retry later.','暂时无法确认本笔汇率，请稍后重试。','red');if(!flow.fx)flow.fx={value:1,at:D.now()-3*86400000,source:FXSRC,version:'FX-DEMO-'+(db.serial+1)};return dl([[L('Settlement amount','结算金额'),money(need(),flow.ccy)],[L('Exchange rate','汇率'),rateText({ccy:flow.ccy,fx:flow.fx})]]);}
  /* 地址下拉复用共享组件：选项与选中值给网络、备注名和缩写地址。 */
  function addressPick(key,en,zh){
    const picked=lenderPick(key);
    const option=a=>{const miss=missingFields(a).length,name=EA.plainName(a),detail='Ethereum · '+accountTail(a),why=miss?L('Missing wallet address','缺少数币地址'):'';return '<option value="'+E(a.id)+'" data-icons="'+E(a.chain)+'" data-label="'+E(name)+'" data-detail="'+E(detail)+'" data-reason="'+E(why)+'"'+(picked?.id===a.id?' selected':'')+(miss?' disabled':'')+'>'+E(name+' · '+detail+(why?' · '+why:''))+'</option>';};
    return '<div class="field" id="cq-'+key+'" tabindex="-1"><label for="cq-'+key+'-select">'+CF.fieldLabel(L(en,zh))+'</label><select id="cq-'+key+'-select" class="inp" aria-required="true" data-cq-address="'+key+'" data-icon-select><option value="">'+L(key==='lender'?'Choose a funding address':'Choose a repayment address',key==='lender'?'请选择放款地址':'请选择还款收款地址')+'</option>'+lenderAccounts().map(option).join('')+'</select></div>';
  }
  function balanceHint(){
    if(!flow.ccy||!flow.fx||!lenderPick('lender'))return '';
    if(flow.checking)return '<p class="cq-balance-hint" id="cq-balance" role="status">'+L('Checking available balance…','正在查询可用余额…')+'</p>';
    if(balanceScene==='error')return '<p class="cq-balance-hint" id="cq-balance">'+L('Available balance cannot be checked right now. ','暂时无法查询可用余额。')+'<button type="button" class="cq-linkbtn" data-act="cq-balance-retry" data-v="">'+L('Retry','重试')+'</button></p>';
    return '<p class="cq-balance-hint" id="cq-balance">'+L('Available balance ','可用余额 ')+'<span class="mono">'+CF.fmtAmt(balanceOf())+' '+E(flow.ccy)+'</span></p>';
  }
  /* 接受页余额为独立查询：演示按完整地址＋锁定币种取值，未知绝不按 0 处理。 */
  function currentFundingBalance(q,afterSign=false){
    if(['loading','error'].includes(acceptBalanceScene))return null;
    if(acceptBalanceScene==='short'||acceptBalanceScene==='preShort'||afterSign&&acceptBalanceScene==='postShort')return q.settlement*0.6;
    if(acceptBalanceScene==='exact')return q.settlement;
    const value=db.balances?.[allowKey(q.lender?.address,q.ccy)];
    return Number.isFinite(value)?value:5000000;
  }
  function queryFundingBalance(q){
    const draft=flow,key=allowKey(q.lender?.address,q.ccy),request={key,state:'loading'};flow.fundingBalance=request;
    setTimeout(()=>{if(flow!==draft||flow.fundingBalance!==request||qFlow()!==q)return;
      if(acceptBalanceScene==='loading')return;
      const value=acceptBalanceScene==='preShort'?5000000:currentFundingBalance(q);
      Object.assign(request,{state:value===null?'error':'ready',value,at:D.now()});renderCredit();
    },500);
  }
  function fundingBalanceView(q){const b=flow.fundingBalance;
    const retry='<button type="button" class="cq-linkbtn" data-act="cq-funding-balance-retry">'+L('Refresh balance','重新查询')+'</button>';
    if(!b||b.key!==allowKey(q.lender?.address,q.ccy)||b.state==='loading')return '<div class="cq-funding-balance" id="cq-funding-balance" role="status">'+L('Checking current '+q.ccy+' balance…','正在查询当前 '+q.ccy+' 可用余额…')+'</div>';
    if(b.state==='error')return '<div class="cq-funding-balance" id="cq-funding-balance" role="status">'+L('Current balance is unavailable. Retry before accepting.','当前余额查询失败，请重试后再接受。')+' '+retry+'</div>';
    return '<div class="cq-funding-balance" id="cq-funding-balance" role="status"><span>'+L('Current available balance','当前可用余额')+'</span><b class="mono">'+CF.fmtAmt(b.value)+' '+E(q.ccy)+'</b>'+retry+(b.value<q.settlement?'<p class="cq-balance-short">'+L('The funder’s funding address balance is insufficient. Acceptance is unavailable until it is topped up; refresh to check again.','资金方放款地址余额不足，暂不能完成接受；补足后可重新查询。')+'</p>':'')+'</div>';
  }
  const balanceKnown=q=>flow.fundingBalance?.key===allowKey(q.lender?.address,q.ccy)&&flow.fundingBalance.state==='ready'&&flow.fundingBalance.value>=q.settlement;
  function lenderSection(){
    if(accountScene==='loading')return '<div id="cq-lender" tabindex="-1" role="status" class="cq-company-state">'+L('Loading your institution accounts…','正在读取本机构账户…')+'</div>';
    if(accountScene==='error')return '<div id="cq-lender" tabindex="-1">'+note('Your institution accounts cannot be read right now.','本机构账户暂时无法读取。','warn')+B('lender-retry','Retry','重试')+'</div>';
    const list=lenderAccounts();
    if(!list.length)return '<div id="cq-lender" tabindex="-1">'+note('Your institution has not added an Ethereum crypto account yet. Add one, then come back; what you entered here is kept.','本机构尚未登记 Ethereum 网络的数币账户。登记后回到本次报价，已填内容保留。','warn')+B('accounts-module','Go to institution accounts','前往机构账户')+'</div>';
    return addressPick('lender','Funding address *','放款地址 *')+balanceHint()+(list.some(a=>missingFields(a).length)?'<p class="hint">'+L('Incomplete accounts cannot be chosen; complete them in Institution accounts.','信息不完整的账户不能选，请到机构账户补齐。')+'</p>':'');
  }
  const repaySection=()=>addressPick('repay','Repayment address *','还款收款地址 *');
  const lastFailed=p=>{const d=D.current(p);const x=d&&(db.pending||[]).filter(x=>x.project===p.id&&x.demand===d.id&&x.fund===F()).at(-1);return x?.state==='failed'?x:null;};
  const failedNote=x=>note('Your last offer was not confirmed on chain, so no offer was made and no approval is on chain. Gas '+x.gas+' ETH was incurred and is not refunded. You can approve and offer again.','上次授权并报价未在链上完成，报价未成立，链上也没有授权；已产生 gas '+x.gas+' ETH，不退回。可以重新授权并报价。','warn');
  const quoteSteps=()=>'<ol class="ls-steps cq-steps" aria-label="'+L('Steps','办理步骤')+'">'+[['Offer details','填写报价信息'],['Approve & offer','发起授权']].map((x,n)=>'<li'+(n+1===(flow.qstep||1)?' aria-current="step"':'')+(n+1<(flow.qstep||1)?' class="done"':'')+'><span class="ls-step-n">'+(n+1)+'</span>'+L(...x)+'</li>').join('')+'</ol>';
  function quoteView(){const p=pFlow(),d=D.current(p),last=lastFailed(p);
    if(!d||d.state!=='open')return note('This request no longer accepts quotes. Close this window to view the current state.','当前需求已不再接受报价，请关闭弹窗查看最新状态。','warn');
    if(flow.qstep===2)return quoteSteps()+reviewView(p,d)+'<p class="cq-read-link"><button type="button" class="cq-linkbtn" data-act="cq-quote-details">'+L('View full offer details','查看完整报价资料')+'</button></p>';
    return quoteSteps()+(last?failedNote(last):'')+'<div class="cq-quote-context">'+dl([[L('Company','资产企业'),company(p)],[L('Financing amount','融资金额'),usd(d.amount)]])+'</div>'
      +section(L('Quote terms','报价条款'),'<div class="cq-grid"><div class="field"><label for="cq-ccy">'+CF.fieldLabel(L('Settlement currency *','结算币种 *'))+'</label><select id="cq-ccy" aria-required="true" class="inp" data-cq-field="ccy" data-icon-select><option value="">'+L('Choose currency','请选择币种')+'</option>'+['USDT','USDC'].map(x=>'<option data-icons="'+x+'" '+(flow.ccy===x?'selected':'')+'>'+x+'</option>').join('')+'</select></div><div>'+field('rate','Annual interest rate (%) *','年化利率（%）*',flow.rate,'text','inputmode="decimal"')+'<p class="hint">'+L('Interest calculation follows the financing contract signed by both parties.','计息规则以双方签署的融资合同为准。')+'</p></div></div>'+preview())
      +section(L('Funding and repayment addresses','放款与还款收款地址'),'<div class="cq-address-columns"><div>'+lenderSection()+'</div>'+(lenderAccounts().length&&!['loading','error'].includes(accountScene)?'<div>'+repaySection()+'</div>':'')+'</div>');}
  /* 第二步：核对条款与后果后发起授权；这一次签名就是提交报价。 */
  function reviewView(p,d){const a=lenderPick('lender'),r=lenderPick('repay');
    return '<p class="cq-signed">'+CF.tag('ok',L('Offer details signed','报价信息已签名确认'))+(flow.signedAt?'<span class="hint">'+time(flow.signedAt)+'</span>':'')+'</p><div class="cq-review"><div class="cq-review-pricing">'+dl([[L('Settlement amount · approval amount','结算金额 · 授权金额'),money(need(),flow.ccy)],[L('Annual interest rate','年化利率'),E(flow.rate)+'%']])+'</div>'+dl([[L('Financing amount','融资金额'),usd(d.amount)],[L('Exchange rate','汇率'),rateText({ccy:flow.ccy,fx:flow.fx})],[L('Repayment type','还款类型'),L('Quarterly interest; principal and remaining interest at maturity','按季付息；到期还本付息')],[L('Final repayment date','最终还款日'),date(p.expires)]])
      +'<div class="cq-review-addr"><div><span class="hint">'+L('Funding address','放款地址')+'</span>'+addrSummary(a)+'</div><div><span class="hint">'+L('Repayment address','还款收款地址')+'</span>'+addrSummary(r)+'</div><div><span class="hint">'+L('Receiving address · read only','融资收款地址 · 只读')+'</span>'+addrSummary(d.payee)+'</div></div></div>'+signCheck(Q.loanContract,L('This signature uses the funding address to approve the lending contract above to take '+CF.fmtAmt(need())+' '+flow.ccy+', and confirms and submits this offer. It is an on-chain transaction; your institution pays the gas. It does not move funds and is unrelated to sign-in.','本次签名：用放款地址授权上述放款合约调取 '+CF.fmtAmt(need())+' '+flow.ccy+'，同时提交本笔报价。这是一笔链上交易，gas 由本机构承担；签名本身不转出资金，与登录无关。'));}
  /* 选账户只给能辨认账户的信息：下拉单选；完整信息按需展开，不默认铺开。 */
  const plain=html=>String(html).replace(/<[^>]+>/g,'');
  const accountTail=a=>plain(a.kind==='crypto'?maskAddress(a.address):maskTail(EA.compact?EA.compact(a.iban):a.iban));
  /* 下拉项只放辨认账户所需：名称、类型、币种（数币为链）与末四位。 */
  const accountBrief=a=>a.kind==='crypto'?[a.chain,accountTail(a)].join(' · '):[EA.typeName?plain(EA.typeName(a)):'',EA.currencies?.(a)?.length?plain(EA.currencyText(a)):'',accountTail(a)].filter(Boolean).join(' · ');
  const accountIcons=a=>a.kind==='crypto'?String(a.chain||''):(EA.currencies?EA.currencies(a):[a.ccy]).filter(Boolean).join(',');
  const waited=t=>{const s=Math.max(1,Math.round((D.now()-t)/1000));return s<120?s+L(' s',' 秒'):Math.round(s/60)+L(' min',' 分钟');};
  function response(q){const p=D.project(q.project),n=D.numbers(p),payee=acceptScene==='payeeError'?null:payeeOf(q);
    const receiving=payee?addrSummary(payee)+'<p class="hint">'+L('Sign with this address to accept.','接受时用此地址签名。')+'</p>':'<div id="cq-payee" tabindex="-1">'+note('The financing receiving address cannot be read right now. You can retry, or reject this quote.','融资收款地址暂时无法读取。可以重试，也可以拒绝本笔报价。','warn')+B('payee-retry','Retry','重试')+'</div>';
    return (q.chain?.state==='failed'?note('The last on-chain disbursement was not completed: '+q.chain.reason[0]+' You can sign again or reject this quote.','上次链上放款未完成：'+q.chain.reason[1]+'可以重新签名接受，或拒绝本笔报价。','warn'):'')
      +(!integrity(q)?note('The offer terms are not verified. Acceptance is unavailable. Contact platform support.','报价条款尚未核验一致，暂不能接受，请联系平台客服人员。','warn'):'')+fundedMark(q,true)+'<div class="cq-response-head"><div class="cq-response-party"><strong>'+institution(q.fund)+'</strong>'+CF.tag('ok',L('Verified institution','已认证机构'))+'</div><div class="cq-response-pricing"><div><span class="hint">'+L('Settlement amount','结算金额')+'</span><strong class="mono">'+money(q.settlement,q.ccy)+'</strong></div><div><span class="hint">'+L('Annual interest rate','年化利率')+'</span><strong class="mono">'+q.rate+'%</strong></div></div></div>'
      +(n.gap?note('Current pledge gap: '+usd(n.gap)+'.','当前质押缺口：'+usd(n.gap)+'。','warn')+B('pledge','Add collateral','追加质押'):'')
      +dl([[L('Financing amount','融资金额'),usd(q.amount)],[L('Exchange rate','汇率'),rateText(q)],[L('Repayment type','还款类型'),L('Quarterly interest; principal and remaining interest at maturity','按季付息；到期还本付息')],[L('Final repayment date','最终还款日'),date(q.repay)]])
      +'<div class="cq-review-addr"><div><span class="hint">'+L('Receiving address','融资收款地址')+'</span>'+receiving+'</div><div><span class="hint">'+L('Funder funding address','资金方放款地址')+'</span>'+addrSummary(q.lender)+fundingBalanceView(q)+'</div></div>'+signCheck(q.contract||Q.loanContract,L('This signature uses this round\'s receiving address to accept the offer; the platform then transfers the settlement amount from the funder\'s funding address to the receiving address through the lending contract above. The signature itself is not on chain, costs nothing and is unrelated to sign-in.','本次签名：用本轮融资收款地址确认接受本笔报价，平台随即通过上述放款合约把本笔结算金额从资金方放款地址转入融资收款地址；这一签名本身不上链、不产生费用，与登录无关。'))+'<p class="cq-read-link"><button type="button" class="cq-linkbtn" data-act="cq-response-details">'+L('View full offer terms','查看完整报价条款')+'</button></p>';
  }
  const requestState=d=>d.state==='open'&&(db.pending||[]).some(x=>x.demand===d.id&&holding(x))?L('Offer pending on-chain','报价上链确认中'):L({open:'Awaiting quotes',quoted:'Quoted · awaiting confirmation',funding:'Funding in progress',funded:'Disbursed',ended:'Expired / closed'}[d.state]||d.state,{open:'待报价',quoted:'已报价待确认',funding:'放款中',funded:'已放款',ended:'已失效／已关闭'}[d.state]||d.state);
  /* 资产方看到的每笔待接受报价都标明资金已授权、接受即放款。 */
  const fundedMark=(q,compact=false)=>'<p class="cq-funded">'+CF.tag('ok',L('Funds approved · accepting disburses them','资金已授权，接受即放款'))+(compact?'':'<b class="mono">'+CF.fmtAmt(q.settlement)+' '+E(q.ccy)+'</b>')+'</p>';
  const requestQuotes=(p,id)=>db.quotes.filter(q=>q.project===p.id&&q.demand===id).sort((a,b)=>b.at-a.at);
  function openRequest(id,options={}){
    const {selected,onReturn}=typeof options==='string'?{selected:options}:options;
    const p=pNow(),d=p?.demands.find(d=>d.id===id);
    if(!d||['review','returned','available'].includes(p.state)&&!D.mine(p)){CF.toast(L('Request unavailable.','需求不存在或无权查看。'));return;}
    rememberTrigger('cq-request');flow={project:p.id,demand:id,historyOpen:selected,onReturn};refreshRequest();open('request');
  }
  Q.openRequest=openRequest;
  /* 链上放款记录（接受即放款）：放款成功后才有，直接读取本笔报价的链上记录。 */
  Q.loanRecord=q=>{const x=q?.l7;if(!x||!['confirmed','settled'].includes(x.state)||!x.record)return null;
    const lender=q.lender?.address||(Q.accounts(x.fund,'crypto')||[]).find(a=>a.chain==='ETH')?.address||'';
    return {id:x.record.id,ccy:x.ccy,amount:x.settlement,lender,payee:x.account?.address||'',repay:q.repayTo||x.record.account,tx:x.record.form?.hash||'',at:x.confirmedAt||x.record.at};};Q.institution=institution;Q.currentQuote=(p,did)=>requestQuotes(p,did).find(x=>['waiting','funding','funded','terminated'].includes(x.state));
  /* 链上放款记录只对本笔资产方与报价机构展示；还款信息只引用编号，不重复这些明细。 */
  function loanView(q,d){const loan=Q.loanRecord(q),addr=v=>v?CF.addrFull(v):'—';if(!loan)return '';
    return section(L('On-chain disbursement','链上放款记录'),dl([[L('Disbursement ID','放款编号'),'<span class="mono">'+E(loan.id)+'</span>'],[L('Currency / amount','放款币种与金额'),'<span class="mono">'+CF.fmtAmt(loan.amount)+' '+E(loan.ccy)+'</span>'],[L('Funding address','放款地址'),addr(loan.lender)],[L('Receiving address','融资收款地址'),addr(loan.payee||d?.payee?.address)],[L('Funder\'s repayment address','资金方还款收款地址'),loan.repay?(loan.repay.kind==='crypto'?addr(loan.repay.address):E(Q.accountBrief(loan.repay))):'—'],[L('Disbursed at','放款成功时间'),time(loan.at)]]));}
  function currentQuoteView(q){
    if(!q)return note('No current quote.','暂无当前报价。');
    if(!related(q)&&!(S.role==='asset'&&D.mine(D.project(q.project))))return '<div class="ls-row"><b>'+institution(q.fund)+'</b>'+CF.tag(q.state==='waiting'?'accent':'',status(q))+'</div>'+note('Quote terms are visible only to the asset holder and the quoting institution.','报价条款仅本笔资产方与报价机构可见。');
    return (q.state==='waiting'&&!chainState(q)&&S.role==='asset'&&D.mine(D.project(q.project))?fundedMark(q):'')+'<div class="ls-row"><b>'+institution(q.fund)+'</b>'+CF.tag(q.state==='waiting'?'accent':'',status(q))+'</div>'+dl([[L('Settlement amount','结算币种与金额'),'<span class="mono">'+CF.fmtAmt(q.settlement)+' '+E(q.ccy)+'</span>'],[L('Annual rate','年化利率'),E(q.rate)+'%']])+lockInfo(q)+'<details class="ls-history"><summary>'+L('Full terms','完整条款')+'</summary>'+dl([[L('Financing business ID','融资业务编号'),'<span class="mono">'+E(q.id)+'</span>'],[L('Financing amount','融资金额'),usd(q.amount)],[L('Repayment type','还款类型'),L('Quarterly interest; principal and remaining interest at maturity','按季付息；到期还本付息')],[L('Final repayment date','最终还款日'),date(q.repay)],[L('Quoted at','报价时间'),time(q.at)],[L('Funding address','放款地址'),addrInline(q.lender)],[L('Repayment address','还款收款地址'),addrInline(q.repayTo)],[L('Receiving address','融资收款地址'),addrInline(payeeOf(q))],[L('On-chain approval','链上授权'),authLabel(q)]])+snapshot(q)+(CF.L8?.initial({...q,state:'waiting'})||'')+'</details>'+confirmationView(q);
  }
  function requestAgreements(p){
    const rows=db.credits.filter(c=>c.owner===p.owner&&creditRelated(c)).flatMap(c=>(c.history||[]).flatMap(h=>(h.agreements||[]).map(f=>({c,f}))));
    if(!rows.length)return '<p class="muted">'+L('No agreement files available.','暂无可查看的协议文件。')+'</p>';
    return '<div class="tablewrap"><table class="tbl resp"><thead><tr>'+[L('File','文件名'),L('Business','所属业务'),L('File status','文件状态')].map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+rows.map(({c,f})=>'<tr><td><a href="#" data-act="cq-credit-download" data-v="'+E(f.id)+'">'+E(f.name)+'</a></td><td class="mono">'+E(c.id)+' · '+L('Credit agreement','授信协议')+'</td><td>'+L(creditFiles.has(f.id)?'Available':'Local file unavailable',creditFiles.has(f.id)?'可下载':'本地文件不可用')+'</td></tr>').join('')+'</tbody></table></div>';
  }
  function requestView(){
    const p=pFlow(),d=p?.demands.find(d=>d.id===flow.demand);if(!d)return note('Request unavailable.','融资申请已不可用。','warn');
    const list=requestQuotes(p,d.id),q=list.find(x=>['waiting','funding','funded','terminated'].includes(x.state)),party=!q||related(q),history=list.filter(x=>x!==q&&related(x)),credits=q&&party?db.credits.filter(c=>c.owner===p.owner&&c.fund===q.fund&&creditRelated(c)):[];
    flow.quote=q?.id;
    const overview='<div class="cq-request-head"><div><span class="hint">'+L('Financing request','融资申请')+'</span><h2 class="mono">'+CF.fmtAmt(d.amount)+' USDT</h2><span class="mono hint">'+E(d.id)+'</span></div>'+CF.tag('',requestState(d))+'</div>';
    /* 融资收款地址：本企业资产方可见完整值；资金方按该笔业务当事方读取，非当事方不可见。 */
    const owner=S.role==='asset'&&D.mine(p),payee=d.payee&&(owner||q&&related(q))?CF.addrHead(L(...(d.payee.label||['',''])))+CF.addrFull(d.payee.address):null;
    const request=dl([[L('Project','所属项目'),E(L(...p.name))],[L('Asset holder','资产企业'),company(p)],[L('Reference settlement currency','参考结算币种'),(p.settle?.length?E(p.settle.join(' / ')):L('Not provided','未提供'))],...(payee?[[L('Receiving address','融资收款地址'),payee]]:[]),[L('Published at','申请发布时间'),time(d.at)],[L('Final repayment date','最终还款日'),date(p.expires)]]);
    /* 操作记录：本轮全部链上交易的唯一记载位置，在详情最下方。每笔一条：时间、操作、地址、交易哈希；尚未成功的标明状态。
       冻结类只给本企业资产方；报价授权与链上放款给本企业资产方和该笔报价机构，非当事资金方看不到。 */
    const f=D.freezeOf(p,d),ops=[],add=(at,op,addr,tx,state,show)=>{if(tx&&show)ops.push({at,op,addr,tx,state});};
    const OP={publish:['Publish freeze','发布冻结'],edit:['Amount change (freeze adjusted)','修改金额（冻结调整）'],withdraw:['Withdrawal (unfreeze)','撤下（解冻）'],release:['Platform unfreeze','平台解除冻结'],auth:['Quote approval','报价授权'],loan:['On-chain disbursement','链上放款']};
    add(f.done||f.at,OP.publish,d.signer,f.tx,'',owner);
    (f.log||[]).forEach(x=>add(x.done||x.at,x.kind==='withdraw'?OP.withdraw:OP.edit,x.signer||d.signer,x.tx,x.state==='success'?'':'failed',owner));
    if(d.edit?.state==='processing')add(d.edit.at,OP.edit,d.edit.signer,d.edit.tx,'processing',owner);
    if(d.withdraw?.state==='processing')add(d.withdraw.at,OP.withdraw,d.withdraw.signer,d.withdraw.tx,'processing',owner);
    if(f.state==='released')add(f.releasedAt,f.releaseKind==='withdraw'?OP.withdraw:OP.release,f.releasedBy||D.EXEC_WALLET,f.releaseTx,'',owner);
    list.forEach(x=>{const party=owner||related(x);if(x.auth?.tx)add(x.auth.at||x.at,OP.auth,x.lender?.address||'',x.auth.tx,x.auth.state==='processing'?'processing':'',party);
      const loan=Q.loanRecord(x);if(loan)add(loan.at,OP.loan,loan.payee||d.payee?.address||'',loan.tx,'',party);});
    /* 报价上链确认中、待核实或未成功的授权，以及链上放款处理中、待核实或未成功的放款，同样记一条并标明状态。 */
    (db.pending||[]).filter(x=>x.demand===d.id&&x.tx&&x.state!=='done').forEach(x=>add(x.at,OP.auth,x.lender?.address||'',x.tx,{processing:'processing',unknown:'unknown',failed:'failed'}[x.state]||'',owner||S.role==='fund'&&x.fund===F()));
    list.forEach(x=>{if(x.chain?.tx)add(x.chain.at,OP.loan,payeeOf(x)?.address||d.payee?.address||'',x.chain.tx,x.chain.state,owner||related(x));});
    ops.sort((a,b)=>new Date(b.at)-new Date(a.at));
    const full=v=>v?'<span class="mono cq-break">'+E(v)+'</span>':'—',stateTag=st=>st==='processing'?' '+CF.tag('warn',L('Processing','处理中')):st==='unknown'?' '+CF.tag('warn',L('To be verified','待核实')):st==='failed'?' '+CF.tag('danger',L('Not completed','未成功')):'';
    const opsView=ops.length?section(L('Operation records','操作记录'),'<div class="tablewrap"><table class="tbl resp cq-ops"><thead><tr><th scope="col">'+L('Time','时间')+' ('+E(S.tz||'UTC')+')</th><th scope="col">'+L('Operation','操作')+'</th><th scope="col">'+L('Address','地址')+'</th><th scope="col">'+L('Transaction hash','交易哈希')+'</th></tr></thead><tbody>'+ops.map(o=>'<tr><td data-label="'+L('Time','时间')+' ('+E(S.tz||'UTC')+')"><time class="mono" datetime="'+E(o.at)+'" title="'+E(time(o.at))+'">'+E(CF.fmtStamp(o.at))+'</time></td><td data-label="'+L('Operation','操作')+'"><span class="ls-op-name">'+L(...o.op)+'</span>'+(stateTag(o.state)?'<span class="ls-op-state">'+stateTag(o.state)+'</span>':'')+'</td><td data-label="'+L('Address','地址')+'">'+(o.addr?CF.addrCopy(o.addr):'—')+'</td><td data-label="'+L('Transaction hash','交易哈希')+'">'+(CF.LSHash?CF.LSHash(o.tx):full(o.tx))+'</td></tr>').join('')+'</tbody></table></div>'):'';
    const creditSummary=credits.map(c=>'<div class="cq-credit-summary"><b>'+institution(c.fund)+'</b>'+dl([[L('Credit limit','授信额度'),usd(c.total)],[L('Credit used','授信已用额'),usd(c.principal+used(c))]])+'<details class="ls-history" data-cq-credit-id="'+E(c.id)+'"'+(flow.openCreditDetails?.includes(c.id)?' open':'')+'><summary>'+L('Credit details and agreements','授信详情与协议')+'</summary>'+companyView()+creditInfo(p,c)+creditHistory(c,true)+'</details></div>').join('')+(credits.length?'<p class="hint">'+L('Shared across all projects of this company.','该企业所有项目共用。')+'</p>':'');
    /* 报价历史只给每笔关键信息与终结原因；资金方只看本机构自己的。 */
    const why=x=>x.state==='rejected'?(related(x)?E(x.reason||'—'):'—'):x.state==='expired'?reason(x):'—';
    const historyView='<details class="ls-history cq-quote-history"'+(flow.historyOpen?' open':'')+'><summary>'+L('Quote history','报价历史')+' · '+history.length+'</summary>'+(history.length?'<div class="tablewrap"><table class="tbl resp"><thead><tr>'+[L('Institution','报价机构'),L('Business ID','融资业务编号'),L('Quoted at','报价时间'),L('Currency / rate','结算币种 / 年化利率'),L('Result','终结结果'),L('Reason','原因')].map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+history.map(x=>'<tr data-history-quote="'+E(x.id)+'"'+(flow.historyOpen===x.id?' class="is-selected"':'')+'><td>'+institution(x.fund)+'</td><td class="mono">'+E(x.id)+'</td><td>'+time(x.at)+'</td><td>'+E(x.ccy)+' · '+E(x.rate)+'%</td><td>'+status(x)+'<div class="hint">'+(x.done?time(x.done):'—')+'</div>'+(S.role==='fund'&&x.lender?'<div class="hint">'+L('On-chain approval: ','链上授权：')+authLabel(x)+'</div>':'')+'</td><td>'+why(x)+'</td></tr>').join('')+'</tbody></table></div>':'<p class="muted">'+L('No historical quotes.','暂无历史报价。')+'</p>')+'</details>';
    const loanView_=q&&(owner||related(q))?loanView(q,d):'';
    return (flow.result?note(flow.result,flow.result,'ok'):'')+overview+section(L('Request information','融资申请资料'),request)+section(L('Current quote','当前报价'),currentQuoteView(q))+(party?(creditSummary?section(L('Credit summary','授信摘要'),creditSummary):'')+loanView_+historyView+section(L('Agreement files','协议文件'),requestAgreements(p)):'')+opsView;
  }
  /* 融资流程的节点模型：操作区左侧竖轴据此画节点，不再单独画横向进度条。 */
  /* 轴只表示当前这一轮：没有进行中的需求时停在「发布」，上一轮的结果在项目记录里。 */
  Q.financeSteps=p=>{
    const d=D.current(p);
    const stage=!d?0:{open:1,quoted:2,funding:2}[d.state]??0;
    return {ended:false,stage,labels:[['Publish request','发布融资需求'],['Institution quote','机构报价'],['Accept and disburse','接受并放款']]};
  };
  /* 发布入口按当前事实呈现：能发布就给主按钮，不能发布时按钮保留为不可用并就近写明原因。 */
  function publishGate(p){
    const n=D.numbers(p),d=D.current(p);
    if(D.terminal(p))return null;
    if(d&&d.state==='funding')return L('A new round can be published once this round\'s on-chain disbursement result is confirmed.','本轮放款结果确定后才能发布新一轮。');
    if(['review','returned'].includes(p.state))return L('Available once the project is approved.','项目审核通过后可发布。');
    if(D.freezing(p))return L('The freeze for this round is still processing. You can act once its result is confirmed.','本轮冻结结果确定后才能办理。');
    if(!n.value)return L('This project has no valid collateral. Complete a token pledge before publishing.','本项目暂无有效质押，请先完成代币质押后再发布。');
    if(p.expired)return L('The project has expired. New rounds cannot be published.','项目已到期，不能发布新一轮。');
    if(n.grade==='short')return L('Pledge shortfall. Add collateral before publishing.','质押不足，补足质押后才能发布。');
    if(n.free<=0)return L('The available amount is 0, so a new round cannot be published.','可融金额为 0，暂不能发布新一轮。');
    return '';
  }
  const publishButton=(p,label,reason)=>'<button class="btn primary" data-act="ls-publish"'+(reason?' disabled aria-describedby="cq-publish-why"':'')+'>'+label+'</button>'+(reason?'<p class="cq-why" id="cq-publish-why">'+reason+'</p>':'');
  /* Facts belong to the selected stage. Private quote/payment facts keep their
     original party boundary; future stages never borrow another stage's data. */
  Q.financeSummary=(p,stage)=>{
    const d=D.current(p),last=[...p.demands].reverse().sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).at(0);
    const facts=rows=>'<dl class="cq-round-facts">'+rows.map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+value+'</dd></div>').join('')+'</dl>';
    const amount=(label,value)=>'<span class="cq-round-label">'+label+'</span><p class="cq-round-amount mono">'+value+'</p>';
    const box=body=>'<section class="cq-round-summary" data-stage="'+stage+'">'+body+'</section>';
    const none=text=>'<p class="cq-stage-empty">'+text+'</p>';
    if(stage===0){
      if(d)return box(amount(L('Published request amount','已发布需求金额'),CF.fmtAmt(d.amount)+' USDT')+facts([
        [L('Request ID','需求编号'),'<span class="mono">'+E(d.id)+'</span>'],
        [L('Published','发布时间'),time(d.at)],
        [L('Request status','需求状态'),E(requestState(d))]]));
      return box((D.mine(p)?amount(L('Available to borrow','当前可融金额'),CF.fmtAmt(D.numbers(p).free)+' USDT'):'')+facts([[L('Reference currencies','参考结算币种'),E((p.settle||[]).join(' / '))||'—'],[L('Project expiry','项目到期日'),date(p.expires)]])
        +(last?'<details class="cq-previous-round"><summary><span>'+L('Previous request','上一轮需求')+'</span><b class="mono">'+CF.fmtAmt(last.amount)+' USDT'+'</b><span class="cq-previous-car" aria-hidden="true">⌄</span></summary>'+facts([[L('Request ID','需求编号'),'<span class="mono">'+E(last.id)+'</span>'],[L('Published','发布时间'),time(last.at)],[L('Result','需求结果'),E(requestState(last))]])+'</details>':''));
    }
    if(!d)return none(L('This round has not been published yet.','本轮尚未发布融资需求。'));
    if(stage===1){
      const rows=[[L('Request ID','需求编号'),'<span class="mono">'+E(d.id)+'</span>'],[L('Request status','需求状态'),E(requestState(d))],[L('Reference currencies','参考结算币种'),E((p.settle||[]).join(' / '))||'—']];
      if(S.role==='fund'){const c=credit(p);if(c)rows.push([L('Your available credit','本机构可用授信'),usd(available(c))]);}
      return box(amount(L('Financing request amount','融资需求金额'),CF.fmtAmt(d.amount)+' USDT')+facts(rows));
    }
    const q=Q.currentQuote(p,d.id);
    if(!q)return none(L('No quote is available for confirmation yet.','尚无可确认的机构报价。'));
    if(!related(q))return none(L('Quote terms are visible only to the financing parties.','报价条款仅融资双方可见。'));
    return box(amount(L('Quoted settlement amount','报价结算金额'),CF.fmtAmt(q.settlement)+' '+E(q.ccy))+facts([
      [L('Funder','报价机构'),institution(q.fund)],[L('Annual rate','年化利率'),E(q.rate)+'%'],
      [L('Final repayment date','最终还款日'),date(q.repay)],[L('Business ID','融资业务编号'),'<span class="mono">'+E(q.id)+'</span>']]));
  };
  /* 只有当前没有可办理的动作时才提示原因：等待对方用中性色，存在阻碍用警示色。能办理的状态只给按钮，不加提示。 */
  const turnLabels={wait:['Nothing to do right now','当前不能操作'],blocked:['Not available now','当前不能操作']};
  const turn=Q.turn=(kind,title,detail='',id='')=>'<div class="cq-turn" data-kind="'+kind+'" role="status"'+(id?' id="'+id+'"':'')+'><span class="cq-turn-label">'+L(...turnLabels[kind])+'</span><b>'+title+'</b>'+(detail?'<p>'+detail+'</p>':'')+'</div>';
  Q.financePanel=p=>{
    const a=D.actions(p),again=p.demands.length>0,newLabel=again?L('Publish a new round','发布新一轮融资需求'):L('Publish financing request','发布融资需求');
    const d=D.current(p),q=d&&active(p);let action='',secondary='',t='',extra='';
    if(!d){
      if(a.mine){const gate=publishGate(p);
        if(gate===null)t=turn('blocked',L('The project has ended','项目已终结'),L('No new financing rounds can be published.','不再发布新一轮融资需求。'));
        else if(gate)t=turn('blocked',L('You cannot publish a request yet','暂不能发布融资需求'),gate,'cq-publish-why');
        if(gate!==null)action=publishButton(p,newLabel,gate).replace(/<p class="cq-why"[^>]*>.*?<\/p>/,'');}
      else t=turn('wait',L('No active financing request','暂无进行中的融资需求'),again?L('Earlier rounds are in the project records. You can quote after the asset holder publishes a new one.','往轮记录见项目记录；资产方发布新一轮后才可报价。'):L('You can quote after the asset holder publishes a request.','资产方发布融资需求后才可报价。'));
    }
    else if(d.state==='open'&&pendingOf(p)){const x=pendingOf(p);
      if(S.role==='fund'&&x.fund===F()){extra=B('pending-details','View confirmation evidence','查看确认凭证',x.id);t=x.state==='unknown'?turn('blocked',L('On-chain result to be verified','链上结果待核实'),L('Please contact platform support. Do not start the offer again.','请联系平台客服人员，不要重复发起。')+txChip(L('Approval tx hash','授权交易哈希'),x.tx)):turn('wait',L('Offer pending on-chain','报价上链确认中'),L('Waited ','已等待 ')+waited(x.at)+L('. The offer is made once the approval is on chain.','。授权上链成功即报价成功。')+txChip(L('Approval tx hash','授权交易哈希'),x.tx));}
      else if(a.mine)t=turn('wait',L('An offer is pending on-chain','机构报价上链确认中'),L('Once '+institution(x.fund)+'\'s offer is on chain, you can review it.',institution(x.fund)+' 的报价上链成功后，可以确认或拒绝。'));
      else t=turn('blocked',L('Another institution\'s offer is being confirmed','本轮正在处理其他机构的报价'),L('You can make an offer only if that offer is not made.','该报价未成立时，你才可以报价。'));
    }
    else if(d.state==='open'){
      if(a.mine){if(!a.edit)t=turn('wait',L('Waiting for a funder to quote','等待资金机构报价'),a.freezing?L('An on-chain operation for this round is processing. You can edit or withdraw once the result is confirmed.','本轮链上操作处理中，结果确定后才能修改或撤下。'):L('The request cannot be changed right now.','当前不能修改或撤下本轮需求。'));
        if(a.edit)secondary='<button class="btn" data-act="ls-publish">'+L('Edit amount','修改融资金额')+'</button><button class="btn" data-act="ls-end-demand">'+L('Withdraw request','撤下需求')+'</button>';}
      else if(S.role!=='fund')t=turn('blocked',L('Only funders can quote','仅资金方可以报价'),L('You can view this request and its records.','你可以查看本笔需求与相关记录。'));
      else if(!a.quote)t=turn('blocked',L('You cannot quote on this request now','当前不能为本轮需求报价'),p.expired?L('The project term has ended.','项目已到期。'):L('The pledge water level is unsafe. Quotes reopen when the asset holder restores it.','质押水位不安全，资产方补足质押后才可报价。'));
      else if(!certified())t=turn('blocked',funderStatus()==='submitted'?L('Your institution verification is under review','你的机构认证正在审核中'):L('Your institution verification was not approved','你的机构认证未通过'),L('You can quote once verification is approved. Quote now shows the next step.','认证通过后才能报价；点“立即报价”可查看下一步。'));
      if(!a.mine&&a.quote&&S.role==='fund')action='<button class="btn primary" data-act="ls-quote" data-v="'+E(p.id)+'">'+L('Make an offer','立即报价')+'</button>';if(S.role==='fund'&&lastFailed(p))extra=failedNote(lastFailed(p));
    }
    else{
      /* 已报价待确认，或资产方已签名、链上放款处理中（需求对外为“放款中”）。 */
      const chain=q?(q.state==='funding'?'processing':chainState(q)):'',party=a.mine||!!q&&related(q),failed=q?.chain?.state==='failed';
      if(chain&&party)t=chain==='unknown'?turn('blocked',L('On-chain result to be verified','链上结果待核实'),L('Please contact platform support. Do not start the acceptance again.','请联系平台客服人员，不要重复发起。')+txChip(L('Disbursement tx hash','放款交易哈希'),q.chain?.tx))
        :turn('wait',L('On-chain disbursement processing','链上放款处理中'),(q.chain?.at?L('Waited ','已等待 ')+waited(q.chain.at)+L('. ','。'):'')+L('Acceptance succeeds once it is on chain.','上链成功即接受成功。')+txChip(L('Disbursement tx hash','放款交易哈希'),q.chain?.tx));
      else if(a.mine){action='<button class="btn primary" data-act="ls-handoff" data-v="quote">'+L('Review and respond','确认 / 拒绝报价')+'</button>';extra=q?fundedMark(q):'';if(failed)extra+=note('The last on-chain disbursement was not completed. You can sign again or reject.','上次链上放款未完成，可以重新签名接受或拒绝。','warn');}
      else if(q&&related(q))t=turn('wait',L('Waiting for the asset holder to respond','等待资产方确认报价'),failed?L('The last on-chain disbursement was not completed. Keep your lending address authorization and balance sufficient.','上次链上放款未完成，请保持放款地址的授权与余额充足。'):'');
      else t=turn('blocked',L('Already quoted by '+(q?institution(q.fund):'another institution'),'本轮已由'+(q?institution(q.fund):'其他机构')+'报价'),L('You can quote only if the asset holder rejects that quote and the request reopens.','资产方拒绝该报价、需求回到待报价后，你才可以报价。'));
    }
    return {turn:t,body:(q&&related(q)?lockInfo(q):'')+extra,primary:action,secondary};
  };
  const journeyLabels=[['Publish request','发布融资需求'],['Corporate credit','企业授信'],['Submit quote','提交融资报价'],['Sign, accept and disburse','签名接受与放款']];
  function journeyStage(){const p=pNow(),d=p&&D.current(p);if(!d)return 0;if(['quoted','funding'].includes(d.state))return 3;const c=p&&credit(p);return !c||c.expires<day()||available(c)<d.amount?1:2;}
  function journeyStart(step){
    fault='normal';companyState='complete';accountScene='ready';balanceScene='enough';authScene='success';acceptScene='success';acceptBalanceScene='enough';contractScene='ready';detailScene='success';
    demo(step==='1'?'new':step==='3'||step==='4'?'waiting':'enough');
    let p=D.projects[0];if(step==='0'){S.role='asset';p.demands=[];p.state='raising';}
    if(step==='3'||step==='4')p=D.project('FP-DEMO-003');
    if(step==='4'){const q=active(p),d=p.demands.find(x=>x.id===q.demand),a=accountsFor(q).find(x=>!missingFields(x).length);q.progress={...(q.progress||{}),account:d?.payee?{kind:'crypto',chain:'ETH',...d.payee}:a?accountSnapshot(a):null};finish(q,'funding','');S.role='fund';}
    flow={};S.st='default';S.demo=true;location.hash='#/project/'+p.id;save();
    setTimeout(()=>{CF.LSView.onAct('ls-tab','financing');CF.render();},0);
  }
  /* 还款场景的本地演示起点复用同一条链上放款完成逻辑。 */
  Q.demoDisbursement=()=>{journeyStart('3');const q=active(D.project('FP-DEMO-003'));complete(q);save();return q.l7;};
  Q.organizeTools=()=>{
    const panel=document.getElementById('demoPanel');if(!S.demo||panel.querySelector('.cq-guide'))return;
    const host=panel.querySelector(':scope > .review-more > .review-more-body')||panel;
    const step=journeyStage(),p=pNow(),d=p&&D.current(p),old=document.createElement('div');while(host.firstChild)old.append(host.firstChild);
    const root=document.createElement('div');root.className='cq-guide';
    root.innerHTML='<h3>'+L('Financing walkthrough','融资流程演示')+'</h3><div class="cq-demo-current"><span class="hint">'+L('Current stage','当前环节')+'</span><strong>'+(step+1)+'. '+L(...journeyLabels[step])+'</strong><p>'+L('Acting as: ','当前身份：')+L({asset:'Asset holder',fund:'Funder',guest:'Guest'}[S.role]||'Operations',{asset:'资产方',fund:'资金方',guest:'游客'}[S.role]||'运营端')+'</p><p class="hint">'+L('Next actor: ','下一步操作方：')+([0,3].includes(step)?L('Asset holder','资产方'):L('Funder','资金方'))+'</p><p class="mono hint">'+E(p?.id||L('No project selected','尚未选择项目'))+(d?' · '+requestState(d):'')+'</p>'+B('journey-continue','Continue this stage','办理当前环节','',true)+'</div><details class="cq-demo-group"><summary>'+L('Jump to a stage · resets example','选择流程起点 · 重置示例')+'</summary><p class="hint">'+L('Each start point resets demonstration data and sets the required identity.','切换起点会重置示例数据，并切换到该环节的操作身份。')+'</p><ol class="cq-journey">'+journeyLabels.map((x,i)=>'<li'+(i===step?' aria-current="step"':'')+'>'+B('journey',String(i+1)+'. '+x[0],String(i+1)+'. '+x[1],String(i))+'</li>').join('')+'</ol></details>';
    function group(en,zh,selectors){const box=document.createElement('details');box.className='cq-demo-group';box.innerHTML='<summary>'+L(en,zh)+'</summary><div class="cq-demo-controls"></div>';const target=box.lastElementChild;selectors.forEach(selector=>old.querySelectorAll(selector).forEach(node=>{const control=node.matches('input,select')?node.closest('.field,.ls-check')||node:node.matches('[data-act=cq-event]')?node.closest('p'):node;target.append(control);}));if(target.childNodes.length)root.append(box);}
    group('Identity & page state','身份与页面状态',['.grp']);
    group('1 · Collateral and request setup','1 · 质押与需求准备',['#ls-demo-project','[data-act=ls-demo-project]','#ls-demo-application','[data-act=ls-demo-event][data-v=approve]','[data-act=ls-demo-event][data-v=reject]','[data-act=ls-demo-event][data-v=twoDays]','[data-act=ls-demo-event][data-v=eightDays]','#ls-outcome','[data-act=ls-demo-event][data-v=results]','#ls-gate','#ls-contract-scene','#ls-review-load','#ls-agreement-fail','#ls-submit-fail','[data-act=ls-demo-event][data-v=late]','[data-act=ls-demo-event][data-v=expire]','[data-act=ls-demo-event][data-v=amountChange]']);
    group('2–3 · Credit and quote scenarios','2–3 · 授信与报价场景',['[data-act=cq-demo][data-v=new]','[data-act=cq-demo][data-v=increase]','[data-act=cq-demo][data-v=renew]','[data-act=cq-demo][data-v=enough]','[data-act=cq-demo][data-v=fundSubmitted]','[data-act=cq-demo][data-v=fundRejected]','#cq-company-state','#cq-account-scene','#cq-balance-scene','#cq-details-scene','#cq-auth-scene','#cq-fault']);
    group('4 · Acceptance, disbursement and request-ended scenarios','4 · 接受放款与需求终结场景',['[data-act=cq-demo][data-v=quoteHistory]','[data-act=cq-demo][data-v=waiting]','[data-act=cq-demo][data-v=rejected]','[data-act=cq-demo][data-v=voidCoverage]','[data-act=cq-demo][data-v=voidExpiry]','[data-act=cq-demo][data-v=short]','#cq-accept-scene','#cq-accept-balance-scene','#cq-contract-scene']);
    group('Permissions & notification events','权限与通知事件',['[data-act=cq-demo][data-v=other]','[data-act=cq-demo][data-v=denied]','[data-act=ls-demo-event][data-v=deniedWrite]','[data-act=ls-demo-event][data-v=fromConsole]','[data-act=ls-pledge-notifications]','[data-act=cq-event]']);
    root.insertAdjacentHTML('beforeend','<p class="why">'+L('Local demonstration only. Close this panel to use the product.','仅本地演示；关闭工具后可操作产品页面。')+'</p>');
    old.querySelectorAll('[data-act=ls-demo-event][data-v=reset]').forEach(x=>root.append(x));host.append(root);panel.classList.add('cq-demo-panel');
  };

  /* 签名摘要、核心后果与主动作留在页脚；完整说明在正文末尾常驻。 */
  const signBar=(sum,text)=>'<div class="ls-sign-bar" role="status" aria-live="polite">'+(sum?'<p class="ls-sign-sum">'+sum+'</p>':'')+'<p class="ls-sign-note">'+text+'</p></div>';
  const disclosure=text=>'<div class="cq-consequence" role="note"><p>'+text+'</p></div>';
  Q.layers={'cq-flow':()=>{if(S.layer)S.layer.type=flow.stage==='request'&&!flow.result?'drawer':'modal';const p=pFlow(),q=qFlow(),c=p&&credit(p);let title='',html='',foot=B('close','Cancel','取消');const loading=busy?note('Submitting…','正在提交…'):'';if(['intent','credit','quote','confirm'].includes(flow.stage)&&!creditWritable())return {title:L('Access unavailable','无法办理'),html:note('Your identity changed. Close and reopen with the correct account.','身份已变化，请关闭后以正确账号重新办理。','warn'),foot:B('close','Close','关闭')};
    if(['respond','reject'].includes(flow.stage)&&(!q||S.role!=='asset'||!related(q)))return {title:L('Access unavailable','无法办理'),html:note('You cannot respond to this quote.','您无权处理该报价。','warn'),foot:B('close','Close','关闭')};
    if(flow.stage==='request'){title=L('Financing request details','融资申请详情');html='<div class="cq-request-detail">'+requestView()+'</div>';foot=B('close','Close','关闭');}
    if(flow.stage==='credit'){title=L('Corporate credit','企业授信');html=creditEditor();foot=B('cancel-request','Cancel','取消')+B('save-credit','Save credit','保存授信','',true,busy||flow.discard);}
    if(flow.stage==='quote'){title=L('Loan offer','融资报价');html=quoteView();const open=D.current(p)?.state==='open'&&!pendingOf(p);
      if(!open)foot=B('cancel-request','Cancel','取消');
      else if(flow.qstep!==2){const lender=lenderPick('lender'),signed=detailsSigned();
        if(flow.reviewedTerms&&!signed)html+=note('The offer details changed after you signed, so that signature is void. Sign again.','报价信息已在签名后修改，原签名已失效，请重新签名。','warn');
        foot=signBar(lender?'<span>'+L('Sign with','签名地址')+' <b class="mono">'+E(accountTail({kind:'crypto',address:lender.address}))+'</b></span>':'',L('This signature confirms the offer details above with the funding address. It is not on chain, costs nothing and does not submit the offer; the platform checks it at disbursement.','本次签名：用放款地址确认以上报价信息；不上链、不产生费用、不提交报价，平台在放款时核验。'))
          +B('cancel-request','Cancel','取消')+(signed?B('quote-next','Continue to approval','继续发起授权','',true):B('sign-details',busy?'Waiting for wallet signature…':'Sign offer details',busy?'等待钱包签名…':'签名确认报价信息','',true,busy));}
      else {html+=disclosure(L('Signing submits an irrevocable offer and locks this round. In-flight offers increase until rejection or demand termination. Keep the funding address balance sufficient: acceptance automatically transfers the settlement amount without further confirmation. Your institution pays approval gas; gas incurred on failure is not refunded.','签名即提交报价，不可修改、不可撤回，并锁定本轮需求、增加在途报价金额，只有资产方拒绝或需求终结才会退出。此前须保持放款地址余额充足；资产方接受后自动转出本笔结算金额，无需再次确认。授权 gas 由本机构承担，失败已产生的不退。'));
        const lender=lenderPick('lender');
        foot=signBar('<span>'+L('Approval amount','授权金额')+' <b class="mono">'+CF.fmtAmt(need())+' '+E(flow.ccy)+'</b></span><span>'+L('Sign with','签名地址')+' <b class="mono">'+E(accountTail({kind:'crypto',address:lender?.address||''}))+'</b></span>',L('Signing submits the offer. It cannot be changed or withdrawn. Your institution pays gas.','签名即提交报价，不可修改、不可撤回。gas 由本机构承担。'))
          +B('quote-back','Back','上一步','',false,busy)+B('submit',busy?'Waiting for wallet signature…':'Approve & offer',busy?'等待钱包签名…':'授权并报价','',true,busy);}
    }
    if(flow.stage==='respond'){const b=flow.fundingBalance,balanceFoot=b?.state==='ready'?L('Funding balance ','放款余额 ')+CF.fmtAmt(b.value)+' '+E(q.ccy)+(b.value<q.settlement?L(' · insufficient',' · 不足'):''):b?.state==='error'?L('Balance query failed','余额查询失败'):L('Checking funding balance…','正在查询放款余额…');title=L('Review loan offer','确认报价');html=response(q);const payee=acceptScene==='payeeError'?null:payeeOf(q);
      html+=disclosure(L('Sign with the receiving address to initiate the automatic transfer of the settlement amount from the funder. On-chain success accepts the offer, completes disbursement and starts repayment. No fee is charged to you. Repayment dates are recalculated from the actual disbursement date.','用融资收款地址签名后，即从资金方放款地址自动转入本笔结算金额；上链成功即接受成功、放款完成，并进入还款。资产方不承担费用。放款成功后，还款日期按实际放款日重新计算。'));
      foot=signBar('<span>'+L('Settlement','结算金额')+' <b class="mono">'+CF.fmtAmt(q.settlement)+' '+E(q.ccy)+'</b></span>'+(payee?'<span>'+L('Sign with','签名地址')+' <b class="mono">'+E(accountTail({kind:'crypto',address:payee.address}))+'</b></span>':'')+'<span>'+balanceFoot+'</span>',L('Acceptance succeeds once the disbursement is on chain. No fee is charged to you.','上链成功即接受成功，资产方不承担费用。'))
        +B('reject','Reject quote','拒绝报价')+(flow.returnRequest?B('return-request','Back to financing details','返回融资详情'):B('close','Close','关闭'))+(payee?B('accept',busy?'Waiting for wallet signature…':'Accept & receive funds',busy?'等待钱包签名…':'接受并收款','',true,busy||!balanceKnown(q)||!integrity(q)):'');}
    if(flow.stage==='reject'){title=L('Reject this quote','拒绝融资报价');html=dl([[L('Funder','资金方'),institution(q.fund)],[L('Amount','融资金额'),usd(q.amount)]])+note('The reason is visible to the quoting institution. This quote will end; its in-flight credit will be released.','拒绝原因对报价机构可见；本笔报价终结并释放在途报价金额。','warn')+'<div class="field"><label for="cq-reason">'+CF.fieldLabel(L('Reason (1–200 characters) *','拒绝原因（1～200 字）*'))+'</label><textarea class="inp" id="cq-reason" aria-required="true" data-cq-field="reason" maxlength="200">'+E(flow.reason||'')+'</textarea></div>';foot=B('back-response','Back','返回')+B('reject-confirm','Confirm rejection','确认拒绝','',true,busy);}
    if(flow.stage==='quote-details'){title=L('Offer details','报价资料');html=creditWritable()?fixedTermsView(flow.reviewedTerms||termSnapshot(draftQuote())):note('Access unavailable.','无权查看本笔资料。','warn');foot=B('read-back','Back to offer','返回报价');}
    if(flow.stage==='response-details'){title=L('Full offer terms','完整报价条款');html=q&&related(q)?terms(q):note('Access unavailable.','无权查看本笔条款。','warn');foot=B('read-back','Back to acceptance','返回确认报价');}
    if(flow.stage==='offer-evidence'){const x=db.pending.find(x=>x.id===flow.pending&&related(x));title=L('Offer confirmation evidence','报价确认凭证');html=x?pendingEvidence(x):note('Evidence unavailable.','无权查看本笔凭证。','warn');foot=B('close','Close','关闭');}
    if(flow.stage==='history'){title=L('Loan offer','融资报价');html=CF.tag(q.state==='rejected'||q.state==='expired'?'warn':'',status(q))+lockInfo(q)+terms(q)+(q.done?dl([[L('Result time','处理时间'),time(q.done)],[L('Reason','原因'),['rejected','terminated'].includes(q.state)&&!related(q)?'—':reason(q)||'—']]):'')+(related(q)?loanView(q,D.project(q.project)?.demands.find(x=>x.id===q.demand)):'');foot=(flow.returnRequest?B('return-request','Back to financing details','返回融资详情'):'')+B('close','Close','关闭');}
    if(flow.stage==='unavailable'){title=L('Unable to continue','当前无法继续');html=note('No new quote was created. Any credit already granted remains effective.','未生成新报价；已办理的授信仍然生效。','warn');foot=B('close','Back to project','返回项目详情');}
    if(flow.stage==='credit-details'){const record=db.credits.find(c=>c.id===flow.creditId&&creditRelated(c));title=L('Credit details','授信详情');html=record?section(L('Credited company','被授信企业'),companyView())+dl([[L('Institution','授信机构'),institution(record.fund)],[L('Credit ID','授信编号'),record.id],[L('Total credit','总授信'),usd(record.total)],[L('Credit used','已用授信'),usd(record.principal+used(record))],[L('Credit valid until','授信有效期至'),date(record.expires)]])+creditHistory(record):note('Credit unavailable.','无权查看该授信。','warn');foot=B('read-back','Back','返回');}
    if(flow.stage==='estimated'){const item=db.quotes.find(x=>x.id===flow.estimatedQuote);title=L('Estimated repayment plan','预计还款计划');html=item?(CF.L8?.initial({...item,state:'waiting'})||note('The estimated plan is unavailable.','预计计划暂不可用。')):note('Business unavailable.','融资业务已不可用。');foot=B('read-back','Back','返回');}
    if(flow.stage==='file-preview'){title=flow.previewName;html='<iframe title="'+E(flow.previewName)+'" src="'+E(flow.previewURL)+'" style="width:100%;height:65vh;border:0"></iframe>';foot=B('read-back','Back','返回');}
    if(flow.stage==='discard'){title=L('Discard unsaved changes?','放弃未提交的修改？');html=note('Unsaved entries and new uploads will be discarded. Saved credit is not affected.','未提交的填写内容和新增上传将被放弃；已生效的授信不受影响。','warn');foot=B('keep-editing','Continue editing','继续编辑','',true)+B('discard-credit','Discard changes','放弃修改');}
    return {title,html:'<div class="cq-flow" data-cq-stage="'+E(flow.stage)+'">'+html+loading+(flow.stage==='credit'?'':err())+'</div>',foot};}};
  const fxFail=()=>failure('The exchange rate cannot be confirmed right now. Retry later.','暂时无法确认本笔汇率，请稍后重试。','ccy');
  function lenderValid(){
    if(!['USDT','USDC'].includes(flow.ccy))return failure('Choose a settlement currency.','请选择结算币种。','ccy');
    if(fault==='fxUnavailable'||!flow.fx)return fxFail();
    if(['loading','error'].includes(accountScene))return failure('Your institution accounts cannot be read right now. Retry first.','本机构账户暂时无法读取，请先重试。','lender');
    if(!lenderPick('lender'))return failure('Choose the lending address.','请选择放款地址。','lender');
    return true;}
  function balanceValid(){
    if(balanceScene==='error')return failure('The funding address balance cannot be checked right now. Retry later.','暂时无法查询放款地址余额，请稍后重试。');
    if(balanceOf()<need())return failure('The funding address balance is insufficient. Top it up, or go back and choose another funding address.','放款地址余额不足，请补足余额，或返回上一步更换放款地址。');
    return true;}
  function quoteValid(){if(!canQuote(pFlow())||!lenderValid())return false;if(!lenderPick('repay'))return failure('Choose the repayment address.','请选择还款收款地址。','repay');if(!/^\d+(\.\d{1,2})?$/.test(flow.rate)||+flow.rate<=0||+flow.rate>100)return failure('Enter an annual rate above 0 and at most 100, with up to 2 decimal places.','请输入大于 0、不超过 100 且最多两位小数的年化利率。','rate');const settlement=need();if(Math.abs(settlement*100-Math.round(settlement*100))>0.000001)return failure('The settlement amount cannot be confirmed at this time. Retry after settlement details are available.','当前暂无法确认结算金额，请待结算资料完整后重试。');return true;}
  function draftQuote(){const p=pFlow(),d=D.current(p);return {project:p.id,owner:p.owner,demand:d?.id,amount:d?.amount,ccy:flow.ccy,settlement:need(),fx:flow.fx,fund:F(),lender:lenderPick('lender')?accountSnapshot(lenderPick('lender')):null,repayTo:lenderPick('repay')?accountSnapshot(lenderPick('repay')):null,rate:flow.rate,repay:p.expires,payee:d?.payee||null};}
  /* 第一步签名只确认报价信息：不上链、不收费、不提交；签名后内容一改即失效，须重新签名。 */
  const detailsSigned=()=>{if(!flow.reviewedTerms)return false;try{return JSON.stringify(termSnapshot(draftQuote()))===JSON.stringify(flow.reviewedTerms);}catch(_){return false;}};
  function signDetails(){
    if(!quoteValid())return;
    if(contractScene==='error')return contractFail();
    const draft=flow;busy=true;CF.render();
    setTimeout(()=>{busy=false;if(flow!==draft||S.layer?.key!=='cq-flow'){CF.render();return;}
      if(detailScene==='cancelled')failure('Signature was not completed. Your entries are kept.','签名未完成，已保留填写内容。');
      else if(detailScene==='wrongSigner')failure('The signature is not from the selected funding address. Switch your wallet to the funding address and sign again.','签名地址不是所选放款地址，请在钱包切换到放款地址后重新签名。','lender');
      else{flow.reviewedTerms=termSnapshot(draftQuote());flow.signedAt=D.now();flow.qstep=2;lastView='';}
      CF.render();},700);}
  function reviewChanged(){const next=termSnapshot(draftQuote());if(JSON.stringify(next)===JSON.stringify(flow.reviewedTerms))return false;flow.reviewedTerms=null;flow.qstep=1;failure('The offer details changed, so the earlier signature is void. Sign the offer details again. Your wallet was not opened.','报价信息已变化，原签名已失效，请重新签名确认报价信息；本次未唤起钱包。');return true;flow.reviewedTerms=next;failure('The offer terms changed. Review the updated information, then approve and offer again. Your wallet was not opened.','报价条款已变化，请核对更新后的信息再授权并报价，本次未唤起钱包。');return true;}
  /* 授权并报价：先终检，通过才唤起钱包；放款地址的一次签名即提交报价，授权上链成功即报价成功；报价签名在放款时核验。 */
  function offer(){
    const p=pFlow();if(!quoteValid()){flow.qstep=1;return;}
    if(!D.current(p)?.payee?.address)return failure('The financing receiving address cannot be read right now. Your entries are kept; retry later.','融资收款地址暂时无法读取，已保留填写内容，请稍后重试。');
    if(contractScene==='error')return contractFail();
    if(!checkCoverage(p,true)){flow.stage='unavailable';return;}
    if(fault==='competing'){fault='normal';const other=F()==='fund-a'?'fund-b':'fund-a',w=EA.accounts(other,'crypto').find(a=>a.chain==='ETH'&&!missingFields(a).length),d=D.current(p),x={id:'PO-DEMO-'+(++db.serial),project:p.id,owner:p.owner,demand:d.id,amount:d.amount,ccy:'USDT',settlement:d.amount,fx:{...flow.fx,value:1},fund:other,lender:w?accountSnapshot(w):null,repayTo:w?accountSnapshot(w):null,rate:'7.00',repay:p.expires,at:D.now(),state:'processing'};db.pending.push(x);setTimeout(()=>settleOffer(x,'success'),2500);save();return failure('Another institution\'s offer for this round is being confirmed on chain. Your wallet was not opened and nothing was submitted.','本轮正在处理其他机构的报价，未唤起钱包，本机构未提交报价。');}
    const c=credit(p),d=D.current(p);if(available(c)<d.amount||c.expires<day()){creditForm(c.expires<day()?'renew':'increase');return failure('Credit changed. Review the current limit.','授信已变化，请核对最新额度。');}
    if(fault==='fxChanged'){fault='normal';flow.fx={...flow.fx,value:flow.ccy==='USDT'?1:1.02,version:flow.fx.version+'-R',at:D.now()};flow.reviewedTerms=null;flow.qstep=1;return failure('The exchange rate changed, so the earlier signature is void. Review the new amounts and sign the offer details again.','汇率已变化，原签名已失效，请核对新的结算金额后重新签名确认报价信息。');return failure('The exchange rate changed. Review the new settlement and approval amount, then approve and offer again. Your wallet was not opened.','汇率已变化，请核对新的结算金额与授权金额后再次点击，本次未唤起钱包。');}
    if(fault==='finalBalanceShort'){fault='normal';balanceScene='short';}
    if(reviewChanged()||!balanceValid())return;
    const signedTerms=clone(flow.reviewedTerms);
    const lender=lenderPick('lender'),repayTo=lenderPick('repay'),draft=flow;busy=true;CF.render();
    setTimeout(()=>{busy=false;if(flow!==draft||S.layer?.key!=='cq-flow'){CF.render();return;}
      if(authScene==='cancelled'){failure('Signature was not completed. No offer was submitted; nothing was sent on chain and no gas was incurred.','签名未完成，未提交报价，未发生链上操作、未产生 gas。');CF.render();return;}
      if(authScene==='wrongSigner'){failure('The signature is not from the selected funding address. No offer was sent; switch to the funding address and sign again.','签名地址不是本笔放款地址，未发送报价；请切换到放款地址后重新签名。');CF.render();return;}
      if(S.role!=='fund'||F()!==draft.fund||!canQuote(p)||JSON.stringify(termSnapshot(draftQuote()))!==JSON.stringify(signedTerms)){failure('The identity or offer details changed. No offer was sent. Sign the offer details again.','身份或报价信息已变化，本次未发送报价，请重新签名确认报价信息。');flow.reviewedTerms=null;flow.qstep=1;CF.render();return;}
      const x={id:'PO-DEMO-'+(++db.serial),project:p.id,owner:p.owner,demand:d.id,amount:d.amount,ccy:flow.ccy,settlement:need(),fx:{...flow.fx},fund:F(),lender:accountSnapshot(lender),repayTo:accountSnapshot(repayTo),rate:flow.rate,repay:p.expires,at:D.now(),state:'processing',tx:demoHash('approval'+db.serial+D.now()),payee:clone(signedTerms.receiving)},outcome=authScene;
      x.confirmation=confirmDemo(x);x.confirmation.state='pending';x.confirmation.terms=signedTerms;x.context=clone(signedTerms.context);x.contract=signedTerms.contract;
      db.pending.push(x);save();closeFlow();CF.toast(L('Signed. Your offer is pending on-chain; it is made once the approval is on chain.','已签名，报价上链确认中；授权上链成功即报价成功。'));
      setTimeout(()=>settleOffer(x,outcome),2500);CF.render();},700);}
  function settleOffer(x,outcome){if(x.state!=='processing')return;const mine=S.role==='fund'&&F()===x.fund;
    if(['unknown','termsUnknown','termsConflict'].includes(outcome)){x.state='unknown';
      if(outcome!=='unknown'){x.auth={at:D.now(),tx:x.tx||demoHash(x.id+'-approval'),gas:'0.002100'};x.confirmation.state=outcome==='termsConflict'?'conflict':'pending';if(x.lender)db.allowances[allowKey(x.lender.address,x.ccy)]=reserved(x.lender.address,x.ccy)+x.settlement;}
    }
    else if(outcome==='failed'){x.state='failed';x.gas='0.001800';x.done=D.now();if(mine)CF.toast(L('The offer was not confirmed on chain. No offer was made.','授权并报价未在链上完成，报价未成立。'));}
    else{if(!x.confirmation)x.confirmation=confirmDemo(x);x.confirmation.state='verified';
      if(!integrity(x)){x.state='unknown';x.confirmation.state='conflict';x.auth={at:D.now(),tx:x.tx||demoHash(x.id+'-approval'),gas:'0.002100'};if(x.lender)db.allowances[allowKey(x.lender.address,x.ccy)]=reserved(x.lender.address,x.ccy)+x.settlement;save();CF.render();return;}
      x.state='done';const p=D.project(x.project),d=p.demands.find(r=>r.id===x.demand),at=D.now();
      if(x.lender)db.allowances[allowKey(x.lender.address,x.ccy)]=reserved(x.lender.address,x.ccy)+x.settlement;
      const q={id:'FB-DEMO-'+(++db.serial),project:x.project,owner:x.owner,demand:x.demand,amount:x.amount,rate:x.rate,ccy:x.ccy,settlement:x.settlement,fx:x.fx,fund:x.fund,at,repay:x.repay,state:'waiting',lender:x.lender,repayTo:x.repayTo,payee:clone(x.confirmation.terms.receiving),confirmation:clone(x.confirmation),submission:x.id,context:clone(x.confirmation.terms.context),contract:x.confirmation.terms.contract,auth:{at,tx:x.tx||demoHash(x.id+at),gas:'0.002100'},chain:null,progress:{}};db.quotes.push(q);
      if(d&&d.state==='open'){d.state='quoted';d.rate=x.rate;d.currency=x.ccy;d.institution=x.fund==='fund-a'?['Demo Capital A','演示资金机构 A']:['Demo Capital B','演示资金机构 B'];d.quoteAt=new Date(at).toISOString();p.state='locked';notify(q,'submitted');if(mine)CF.toast(L('Offer made. Waiting for the asset holder.','报价成功，等待资产方确认。'));}
      else{q.state='expired';q.reason=d?.reason||'coverage';q.done=at;}}
    save();CF.render();}
  /* 发起接受前：融资收款地址、质押水位、放款地址的授权与余额都满足才唤起钱包。 */
  /* 演示只区分授权是否仍覆盖本笔：每笔报价成功即带本笔授权，额度不足由演示工具“资金方授权或余额不足”模拟。 */
  function lenderReady(q){return acceptScene!=='lenderShort';}
  const payeeTail=q=>{const x=payeeOf(q);return x?addrLabel(x)+'（'+accountTail({kind:'crypto',address:x.address})+'）':'—';};
  function accept(q){
    if(acceptScene==='payeeError'||!payeeOf(q))return failure('The financing receiving address cannot be read right now. Retry later, or reject this quote.','融资收款地址暂时无法读取，请稍后重试，也可以拒绝本笔报价。');
    const p=D.project(q.project);
    if(fault==='coverageUnavailable')return failure('Pledge sufficiency cannot be checked now. Retry later.','暂时无法完成质押校验，请稍后重试。');
    if(fault==='coverage'){fault='normal';D.tokens.filter(t=>t.pool===p.id).forEach(t=>t.valid=false);}
    const n=D.numbers(p);if(n.limit<p.balance+n.fly)D.recompute(p);Q.sweep();
    if(q.state!=='waiting'){flow.stage='history';return failure('The financing request has been invalidated (pledge water level insufficient). This quote is no longer valid.','该融资需求已失效（质押水位不足），本笔报价随之失效。');}
    if(contractScene==='error')return contractFail();
    /* 放款前核验报价签名：签名地址为本笔放款地址、签名内容与本笔条款及本次放款参数一致。 */
    if(acceptScene==='sigUnavailable'){q.signCheck={state:'unavailable',at:D.now()};save();return failure('The offer signature cannot be checked right now. Nothing was sent; retry later.','暂时无法核验本笔报价签名，未唤起钱包，请稍后重试。');}
    if(acceptScene==='sigMismatch'||!integrity(q)){q.signCheck={state:'mismatch',at:D.now()};save();return failure('The offer details did not pass verification, so this offer cannot be accepted. Nothing was sent on chain. Contact platform support; you can still reject it.','本笔报价信息核验未通过，暂不能接受，未发生链上操作。请联系平台客服人员；你仍可拒绝本笔报价。');}
    if(!balanceKnown(q)||currentFundingBalance(q)===null)return failure('The current funding balance is not confirmed. Refresh before accepting.','当前放款地址余额尚未查明，请重新查询后再接受。');
    if(!lenderReady(q)||currentFundingBalance(q)<q.settlement){if(!q.blockedNotified){q.blockedNotified=true;notify(q,'blocked');}save();return failure('The funder\'s lending address authorization or balance is insufficient, so acceptance cannot be completed now. Try again later, or reject this quote.','资金方放款地址的授权或余额不足，暂不能完成接受。可以稍后再试，或直接拒绝本笔报价。');}
    busy=true;const draft=flow,confirmed=clone(q.confirmation),identity=S.role;CF.render();
    setTimeout(()=>{busy=false;if(flow!==draft||q.state!=='waiting'||S.layer?.key!=='cq-flow'){CF.render();return;}
      if(acceptScene==='walletCancel'){failure('Signature was not completed. This quote was not accepted.','签名未完成，本次未接受。');CF.render();return;}if(acceptScene==='sigMismatchAfter'){q.signCheck={state:'mismatch',at:D.now()};save();failure('The offer details did not pass the check before disbursement. Nothing was disbursed and the offer is still awaiting your response. Contact platform support; you can still reject it.','放款前核验发现本笔报价信息不一致，未放款，本笔保持待接受。请联系平台客服人员；你仍可拒绝本笔报价。');CF.render();return;}if(acceptScene==='walletOther'){failure('Your wallet is on another address. Switch to the receiving address '+payeeTail(q)+' and sign again; your sign-in is not affected.','钱包当前不是融资收款地址，请切换到 '+payeeTail(q)+' 后再签名；切换不影响当前登录。');CF.render();return;}if(acceptScene==='wrongSigner'){failure('The signature is not from this round\'s receiving address. Nothing was sent on chain and this offer is unchanged.','签名地址不是本轮融资收款地址，未上链，本笔状态不变。');CF.render();return;}
      const current=D.numbers(p),demand=p.demands.find(x=>x.id===q.demand);
      if(S.role!==identity||!related(q)||demand?.state!=='quoted'||!integrity(q)||JSON.stringify(q.confirmation)!==JSON.stringify(confirmed)){failure('The offer or your identity changed. Nothing was sent on chain.','报价条款、状态或您的身份已变化，本次未上链。');CF.render();return;}
      if(fault==='coverageUnavailable'){failure('Pledge sufficiency cannot be checked now. Retry later.','暂时无法完成质押校验，请稍后重试。');CF.render();return;}
      if(current.limit<p.balance+current.fly){D.recompute(p);Q.sweep();failure('The request is no longer valid because its pledge is insufficient.','质押水位不足，融资需求已失效。');CF.render();return;}
      if(!lenderReady(q)||currentFundingBalance(q,true)===null||currentFundingBalance(q,true)<q.settlement){failure('The funder’s authorization or balance no longer covers this amount. Nothing was sent on chain. Refresh and retry later.','签名后复核发现资金方授权或余额已不足，或暂时无法查询，本次未上链；请重新查询后再试。');if(acceptBalanceScene==='postShort')acceptBalanceScene='short';queryFundingBalance(q);CF.render();return;}
      const outcome={chainFailed:'failed',chainUnknown:'unknown'}[acceptScene]||'success',d=p.demands.find(x=>x.id===q.demand);
      q.signCheck={state:'match',at:D.now()};q.chain={state:'processing',at:D.now(),tx:demoHash(q.id+'-disbursement'+D.now())};if(d)d.state='funding';save();
      settled(L('Signed. The platform is executing the on-chain disbursement; acceptance succeeds once it is on chain.','已签名，平台正在执行链上放款；上链成功即接受成功。'));
      setTimeout(()=>disburse(q,outcome),2500);CF.render();},700);}
  function stillWaiting(q){Q.sweep();if(S.role!=='asset'||!D.mine(D.project(q.project)))return failure('You cannot act for this asset holder.','您无权代表该资产方操作。');if(chainState(q))return failure('The on-chain disbursement is processing. Wait for the result.','链上放款处理中，请等待结果。');if(q.state!=='waiting'){flow.stage='history';return failure('This quote has already been processed: '+status(q)+'.','该报价已处理：'+status(q)+'。');}return true;}
  function asyncAction(fn){if(busy)return;busy=true;const identity=S.role,draft=flow,route=location.hash,actor=F();setTimeout(()=>{try{if(flow!==draft||location.hash!==route||S.layer?.key!=='cq-flow')return;if(identity!==S.role||actor!==F())failure('The identity changed. Retry with the correct account.','身份已变化，请以正确账号重试。');else if(fault==='submitFailure')failure('Submission failed. Your entries are retained; retry later.','提交失败，已保留填写内容，请稍后重试。');else fn();}finally{busy=false;save();CF.render();}},450);}
  Q.onAct=(act,v)=>{if(busy&&(act.startsWith('cq-')||act==='ls-quote'||act==='ls-handoff'))return true;if(act.startsWith('cq-'))rememberUI();if(act==='ls-quote'){startQuote(D.project(v));return true;}if(act==='ls-handoff'&&v==='quote'){const p=pNow(),q=p&&active(p);if(q)beginReview(q);else CF.toast(L('This quote is no longer awaiting confirmation.','报价已不再待确认，请查看融资记录。'));return true;}if(!act.startsWith('cq-'))return false;act=act.slice(3);if(busy)return true;problem='';invalid='';const p=pFlow(),q=qFlow();
    if(act==='close')requestClose();
    if(act==='source-back')flow.onReturn?.();
    if(act==='save-close')closeFlow();
    if(act==='return-request')requestClose('request');
    if(act==='cancel-request')requestClose();
    if(act==='quote-request')startQuote(p);
    if(act==='read-back')returnRead();
    if(act==='quote-details'&&flow.stage==='quote'&&creditWritable())visit('quote-details');
    if(act==='response-details'&&flow.stage==='respond'&&q&&related(q))visit('response-details');
    if(act==='credit-details'){flow.creditId=v;visit('credit-details');}
    if(act==='estimated'){flow.estimatedQuote=v||q?.id;visit('estimated');}
    if(act==='keep-editing'){flow.stage=flow.discard.stage;flow.discard=false;flow.restoreStep=true;}
    if(act==='discard-credit'){const destination=flow.discard.destination;if(flow.responseCheckpoint&&qFlow())qFlow().progress=JSON.parse(flow.responseCheckpoint);(flow.agreements||[]).forEach(f=>creditFiles.delete(f.id));if(destination==='request')returnRequest();else closeFlow();}
    if(act==='company-retry'&&['credit','quote','request','credit-details'].includes(flow.stage))retryCompany();
    if(act==='credit-preview'||act==='credit-download')creditFileAction(v,act==='credit-preview');
    if(['credit-remove','credit-retry'].includes(act)&&flow.stage==='credit'&&creditWritable()){const f=flow.agreements.find(f=>f.id===v);if(f){if(act==='credit-remove'){flow.agreements=flow.agreements.filter(f=>f.id!==v);creditFiles.delete(v);}else uploadAgreement(f);}}
    if(act==='request')openRequest(v);
    if(act==='select-quote'&&flow.stage==='request')flow.historyOpen=v;
    if(act==='journey')journeyStart(v);
    if(act==='journey-continue'){const target=pNow();if(!target){CF.toast(L('Choose a start point first.','请先选择流程起点。'));return true;}S.demo=false;CF.LSView.onAct('ls-tab','financing');const d=D.current(target);if(!d&&D.mine(target))CF.LSView.onAct('ls-publish','');else if(d?.state==='open'&&S.role==='fund')startQuote(target);else if(d?.state==='quoted'&&D.mine(target))beginReview(active(target));else if(d)openRequest(d.id);}
    if(act==='save-credit'&&flow.stage==='credit'&&!flow.discard)submitCredit();
    if(act==='sign-details'&&flow.stage==='quote'&&creditWritable())signDetails();
    if(act==='quote-next'&&flow.stage==='quote'&&creditWritable()){if(detailsSigned()){flow.qstep=2;flow.restoreStep=false;lastView='';}else failure('The offer details changed after you signed, so that signature is void. Sign again.','报价信息已在签名后修改，原签名已失效，请重新签名。');}
    if(act==='quote-back'&&flow.stage==='quote'){flow.qstep=1;lastView='';}
    if(act==='submit'&&flow.stage==='quote'&&flow.qstep===2&&creditWritable())offer();
    if(act==='pending-details'){const x=db.pending.find(x=>x.id===v&&related(x));if(x){rememberTrigger('cq-pending-details');flow={project:x.project,pending:x.id};open('offer-evidence');}}
    if(act==='history'){flow={quote:v,project:db.quotes.find(q=>q.id===v).project};open('history');}
    if(act==='respond')beginReview(db.quotes.find(q=>q.id===v));
    if(act==='reject'&&stillWaiting(q)){flow.reason='';flow.stage='reject';}
    if(act==='back-response'){flow.stage='respond';flow.restoreStep=true;}
    if(act==='reject-confirm'&&stillWaiting(q)){if(!flow.reason?.trim()||[...flow.reason.trim()].length>200)failure('Enter a reason of 1–200 characters.','请输入 1～200 字拒绝原因。','reason');else asyncAction(()=>{if(stillWaiting(q)){finish(q,'rejected',flow.reason.trim());settled(L('Quote rejected.','报价已拒绝。'));}});}
    if(act==='accept'&&stillWaiting(q))accept(q);
    if(act==='accounts-module'){const back=location.hash.replace(/^#/,'')||'/marketplace';pendingDraft={...flow};
      location.hash='#'+CF.ENTRY['P-F-EA-01']+'?'+new URLSearchParams({return:back,from:'quote',business:flow.project||''});}
    if(act==='lender-retry'){accountScene='loading';const draft=flow;setTimeout(()=>{if(flow!==draft)return;accountScene='ready';renderCredit();},650);}
    if(act==='balance-retry'){flow.checking=true;const draft=flow;setTimeout(()=>{if(flow!==draft)return;flow.checking=false;balanceScene='enough';renderCredit();},650);}
    if(act==='funding-balance-retry'&&flow.stage==='respond'&&q){if(acceptBalanceScene==='error')acceptBalanceScene='enough';queryFundingBalance(q);}
    if(act==='payee-retry'){acceptScene='success';}
    if(act==='contract-retry'){contractScene='ready';}
    if(act==='pledge'){CF.closeLayer();setTimeout(()=>document.querySelector('.mk-collateral-actions [data-act=ls-pledge]')?.click(),0);}
    if(act==='event'){const target=db.quotes.find(x=>x.id===v);if(target){S.demo=false;location.hash='#/project/'+target.project;setTimeout(()=>{if(target.state==='waiting'&&S.role==='asset')beginReview(target);else openRequest(target.demand,{selected:target.id});},100);}}
    if(act==='demo')demo(v);
    save();return true;
  };
  Q.enhance=()=>{const panel=document.getElementById('demoPanel');if(S.demo&&!panel.querySelector('.cq-demo,.cq-guide')){const el=document.createElement('div');el.className='cq-demo ls-review';el.innerHTML='<h5>'+L('Credit and quotes · review tools','授信报价 · 评审工具')+'</h5><div class="ls-row">'+[['new','No credit','无授信'],['increase','Insufficient credit','额度不足'],['renew','Expired credit','授信到期'],['enough','Sufficient credit','额度充足'],['quoteHistory','Multiple quote records','多次报价记录'],['waiting','Pending quote','待接受报价'],['rejected','Rejected quote','已拒绝报价'],['voidCoverage','Request ends · water level','需求终结 · 质押水位不足'],['voidExpiry','Request ends · project term','需求终结 · 项目到期'],['short','Current pledge shortfall alert','当前质押不足提醒'],['other','Other funder','切换其他资金方'],['fundSubmitted','Funder under review','审核中的资金方'],['fundRejected','Funder rejected','已驳回的资金方'],['denied','Rejected write','越权写入反馈']].map(x=>B('demo',x[1],x[2],x[0])).join('')+'</div><div class="field"><label for="cq-fault">'+L('Next submission','下次提交')+'</label><select class="inp" id="cq-fault">'+[['normal','Normal','正常'],['fxUnavailable','Rate unavailable','汇率不可用'],['coverageUnavailable','Pledge check unavailable','质押校验不可用'],['coverage','Pledge shortfall · request invalidated','质押不足终检'],['competing','Another offer pending','他方报价上链确认中'],['fxChanged','Rate changes','汇率变化'],['finalBalanceShort','Balance short at final check','终检余额不足'],['submitFailure','Submission failure','提交失败'],['uploadFailure','File upload failure','文件上传失败']].map(x=>'<option value="'+x[0]+'" '+(fault===x[0]?'selected':'')+'>'+L(x[1],x[2])+'</option>').join('')+'</select></div><p class="why">'+L('Events and credentials are simulated. Files stay on this device. Reload retains progress, but local file contents are not persisted.','事件与企业资料均为演示。文件仅留在本机；刷新保留进度，不保存文件内容。')+'</p>';const events=db.events.filter(e=>{const q=db.quotes.find(q=>q.id===e.quote);return q&&(S.role==='asset'&&D.mine(D.project(q.project))&&e.who==='asset'||S.role==='fund'&&e.who===F());});el.innerHTML+='<h5>'+L('Notification event previews','通知事件预览')+'</h5>'+(events.length?events.map(e=>'<p>'+L({submitted:'Quote received',accepted:'Quote accepted, disbursed',disbursed:'Financing disbursement received',failed:'Financing disbursement not completed',blocked:'Acceptance could not be completed',rejected:'Quote rejected'}[e.event],{submitted:'收到融资报价',accepted:'融资报价已接受，已放款',disbursed:'融资放款已到账',failed:'融资放款未完成',blocked:'资产方接受未能完成',rejected:'融资报价已拒绝'}[e.event])+' · '+E(e.quote)+' '+B('event','View','查看',e.quote)+'</p>').join(''):'<p class="why">'+L('No events for this identity.','当前身份暂无事件。')+'</p>');el.insertAdjacentHTML('beforeend','<div class="field"><label for="cq-account-scene">'+L('Institution crypto accounts','机构数币账户')+'</label><select class="inp" id="cq-account-scene">'+[['ready','Accounts available','有可用账户'],['empty','None registered','尚未登记'],['loading','Loading','加载中'],['error','Load failed','读取失败']].map(x=>'<option value="'+x[0]+'" '+(accountScene===x[0]?'selected':'')+'>'+L(x[1],x[2])+'</option>').join('')+'</select></div>');const scene=(id,en,zh,value,options)=>'<div class="field"><label for="'+id+'">'+L(en,zh)+'</label><select class="inp" id="'+id+'">'+options.map(x=>'<option value="'+x[0]+'" '+(value===x[0]?'selected':'')+'>'+L(x[1],x[2])+'</option>').join('')+'</select></div>';el.insertAdjacentHTML('beforeend',scene('cq-balance-scene','Lending address balance','放款地址余额',balanceScene,[['enough','Sufficient','充足'],['short','Insufficient','不足'],['error','Query failed','查询失败']])+scene('cq-contract-scene','Lending contract','放款合约',contractScene,[['ready','Readable','可读取'],['error','Read failed','读取失败']])+scene('cq-details-scene','Offer details signature','签名确认报价信息',detailScene,[['success','Signed','已签名'],['cancelled','Not signed','未签名'],['wrongSigner','Another address signed','非放款地址签名']])+scene('cq-auth-scene','Approve & offer result','授权并报价结果',authScene,[['success','On chain','上链成功'],['failed','Failed on chain','上链失败'],['cancelled','Not signed','未签名'],['wrongSigner','Wrong funding signer','非放款地址签名'],['unknown','Result unknown','结果长期未知']])+scene('cq-accept-scene','Acceptance and disbursement','接受与链上放款',acceptScene,[['success','Disbursed on chain','放款成功'],['lenderShort','Funder authorization / balance short','资金方授权或余额不足'],['walletCancel','Not signed','未签名'],['chainFailed','Disbursement failed','放款失败'],['chainUnknown','Result unknown','结果长期未知'],['sigMismatch','Offer signature mismatch','报价签名核验不一致'],['sigUnavailable','Offer signature check unavailable','报价签名暂时无法核验'],['sigMismatchAfter','Mismatch after signing','签名后核验不一致'],['walletOther','Wallet on another address','钱包不是收款地址'],['wrongSigner','Signed by another address','非收款地址签名'],['payeeError','Receiving address unreadable','收款地址读取失败']])+scene('cq-accept-balance-scene','Acceptance · current token balance','确认报价 · 当前币种余额',acceptBalanceScene,[['enough','Sufficient','充足'],['exact','Exactly sufficient','等于结算金额'],['short','Insufficient','不足'],['loading','Loading','查询中'],['error','Query failed','查询失败'],['preShort','Drops before signing','发起时余额减少'],['postShort','Drops after signing','签名后余额减少']]));el.insertAdjacentHTML('beforeend','<div class="field"><label for="cq-company-state">'+L('Company information scenario','企业资料场景')+'</label><select class="inp" id="cq-company-state">'+[['complete','Complete','完整'],['partial','Partially unavailable','部分未提供'],['loading','Loading','加载中'],['error','Load failed','加载失败'],['unconfirmed','Owner unconfirmed','企业归属不明'],['denied','Permission denied','无办理权限']].map(x=>'<option value="'+x[0]+'" '+(companyState===x[0]?'selected':'')+'>'+L(x[1],x[2])+'</option>').join('')+'</select></div>');panel.prepend(el);}const modal=document.querySelector('.modal:has(.cq-flow),.drawer:has(.cq-flow)');document.getElementById('portal').inert=!!S.layer;if(modal){restoreFlowUI(modal);if(flow.stage==='request'&&!modal.contains(document.activeElement)){const heading=modal.querySelector('.drawer-h,.modal-h');heading.tabIndex=-1;heading.focus({preventScroll:true});}if(busy)modal.querySelectorAll('input,textarea,select,button').forEach(el=>el.disabled=true);if(flow.stage==='credit'&&invalid){const target=document.getElementById('cq-'+invalid);if(target){target.setAttribute('aria-invalid','true');target.focus();}}if(flow.discard){modal.querySelector('.cq-discard')?.scrollIntoView({block:'start'});}modal.querySelectorAll('[aria-invalid=true]').forEach(x=>x.setAttribute('aria-describedby','cq-error'));}if(S.layer?.key==='cq-flow'&&qFlow()?.state!=='waiting'&&['respond','reject'].includes(flow.stage)){flow.stage='history';CF.render();}};
  function demo(v){let p=pNow()||D.projects[0];if(['new','increase','renew','enough','waiting','rejected'].includes(v)){D.seed();p=D.projects[0];if(v!=='waiting'&&v!=='rejected')CF.funder?.review?.seed('verified');S.role=v==='waiting'||v==='rejected'?'asset':'fund';setF('fund-a');const c=credit(p);if(v==='new')db.credits=[];if(v==='increase')c.total=used(c)+c.principal+100000;if(v==='renew')c.expires='2020-01-01';if(v==='waiting'||v==='rejected')p=D.project('FP-DEMO-003');if(v==='rejected')finish(active(p),'rejected',L('The financing terms do not match our current needs.','融资条款不符合当前需求。'));S.layer=null;location.hash='#/project/'+p.id;}
    if(v==='quoteHistory'){
      demo('waiting');p=D.project('FP-DEMO-003');const current=active(p);p.published=new Date(current.at-3*H).toISOString();D.current(p).at=p.published;
      [['fund-b','7.10','FB-DEMO-H01'],['fund-a','6.80','FB-DEMO-H02']].forEach((row,i)=>{const at=current.at-(2-i)*H;db.quotes.push({...structuredClone(current),id:row[2],fund:row[0],rate:row[1],at,state:'rejected',done:at+H/2,reason:L('The proposed rate does not match our financing needs.','报价利率不符合本次融资需求。')});});
    }
    if(v==='other'){setF(F()==='fund-a'?'fund-b':'fund-a');CF.funder?.review?.seed('verified');S.role='fund';S.layer=null;}
    if(v==='fundSubmitted'||v==='fundRejected'){CF.funder?.review?.seed(v==='fundSubmitted'?'submitted':'rejected');S.role='fund';setF('fund-a');S.layer=null;p=D.projects[0];location.hash='#/project/'+p.id;}
    if(v==='voidExpiry'){p.expires=new Date(D.now()-1000).toISOString();D.sweep();D.recompute(p);Q.sweep();}
    if(v==='voidCoverage'){D.tokens.filter(t=>t.pool===p.id).forEach(t=>t.valid=false);D.recompute(p);Q.sweep();}
    if(v==='short'){p.balance=800000;D.tokens.filter(t=>t.pool===p.id).forEach(t=>t.valid=false);p.coverageAt=D.iso();}
    if(v==='denied')CF.toast(L('Permission denied. No business state changed.','无权执行，业务状态未改变。'));
    save();
  }
  document.addEventListener('toggle',e=>{const el=e.target;if(flow.stage!=='request'||!el.isConnected||!el.matches('details[data-cq-credit-id]'))return;const ids=new Set(flow.openCreditDetails||[]);if(el.open)ids.add(el.dataset.cqCreditId);else ids.delete(el.dataset.cqCreditId);flow.openCreditDetails=[...ids];},true);
  document.addEventListener('input',e=>{const el=e.target,k=el.dataset.cqField;if(!k)return;invalid='';problem='';el.removeAttribute('aria-invalid');el.removeAttribute('aria-describedby');document.getElementById('cq-error')?.remove();flow[k]=el.value;if(k==='rate'){const r=document.getElementById('cq-sum-rate');if(r)r.textContent=/^\d+(\.\d{1,2})?$/.test(el.value)?el.value+'%':'—';}if(k==='total'&&flow.mode==='increase'){const a=document.getElementById('cq-adjusted');if(a)a.textContent=L('Adjusted limit: ','调整后额度：')+usd(credit(pFlow()).total+Number(el.value||0));}});
  document.addEventListener('change',e=>{const el=e.target;if(el.closest('.cq-flow'))rememberUI();if(el.id==='cq-agreements'){pickAgreements([...el.files]);return;}if(el.id==='cq-company-state'){companyState=el.value;return;}
    const scenes={'cq-account-scene':v=>accountScene=v,'cq-balance-scene':v=>balanceScene=v,'cq-auth-scene':v=>authScene=v,'cq-details-scene':v=>detailScene=v,'cq-accept-scene':v=>acceptScene=v,'cq-contract-scene':v=>contractScene=v,'cq-accept-balance-scene':v=>{acceptBalanceScene=v;if(flow.stage==='respond'&&qFlow())queryFundingBalance(qFlow());}};if(scenes[el.id]){scenes[el.id](el.value);CF.render();return;}
    if(el.id==='cq-ccy'){flow.ccy=el.value;flow.fx=null;flow.auth=null;CF.render();return;}if(el.id==='cq-fault'){fault=el.value;return;}
    /* 放款地址变更后须重新校验余额与授权；还款收款地址默认跟随放款地址，改选过的不再被覆盖。 */
    if(el.dataset.cqAddress){const k=el.dataset.cqAddress;problem='';invalid='';flow[k]=el.value;if(k==='lender'){flow.auth=null;if(!flow.repayEdited)flow.repay=el.value;}else flow.repayEdited=true;CF.render();}});
  document.addEventListener('keydown',e=>{const dialog=document.querySelector('.modal:has(.cq-flow),.drawer:has(.cq-flow)');if(!dialog||e.key!=='Tab')return;const els=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select,textarea,summary,a[href]')].filter(x=>x.getClientRects().length),first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}});
  Q.beforeAct=(act,event)=>{if(act!=='closelayer'||S.layer?.key!=='cq-flow')return false;if(event?.type==='click'&&event.target.closest('[data-stop]'))return false;if(busy)return true;requestClose();return true;};
  Q.deepAction=action=>{const p=pNow();if(!p)return;const params=new URLSearchParams(location.hash.split('?')[1]||''),business=params.get('business')||params.get('quote'),request=params.get('request')||params.get('application');
    const target=business?db.quotes.find(x=>x.id===business&&x.project===p.id):null;
    if(business&&!target){CF.toast(L('The requested financing business is unavailable.','目标融资业务不存在或不可查看。'));return;}
    if(action==='quote'){const current=D.current(p);if(target||request&&request!==current?.id){openRequest(target?.demand||request,{selected:target?.id});return;}startQuote(p);}
    if(action==='quote_confirm'){const q=target||active(p);if(!q){if(request)openRequest(request);else CF.toast(L('This quote is no longer awaiting confirmation.','报价已不再待确认。'));return;}if(q.state==='waiting'&&S.role==='asset'&&related(q))beginReview(q);else{openRequest(q.demand,{selected:q.id});CF.toast(L('Showing the current result for the requested quote.','已展示目标报价的当前结果。'));}}
  };
  function requestDeepLink(){const params=new URLSearchParams(location.hash.split('?')[1]||''),id=params.get('business');if(!id||params.has('action'))return;const p=pNow(),q=db.quotes.find(x=>x.id===id&&x.project===p?.id);if(q&&['waiting','rejected','expired'].includes(q.state))openRequest(q.demand,{selected:q.id});}
  window.addEventListener('hashchange',()=>{if(S.layer?.key==='cq-flow'){(flow.agreements||[]).forEach(f=>creditFiles.delete(f.id));flow={};lastView='';pendingUI=null;CF.closeLayer();}setTimeout(requestDeepLink,0);});
  setTimeout(requestDeepLink,0);
})(window.CF);
