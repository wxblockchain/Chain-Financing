/* WS-376 / L7. Session-only demonstration adapter; no payment or chain calls. */
(function(CF){
  'use strict';
  const S=CF.S,L=CF.L,E=CF.esc,V=CF.LSView,Q=CF.CQ,D=CF.LS;
  const N={rows:[],visible:()=>N.rows.filter(r=>r.owner===S.role&&deals[r.deal]&&Q.related(Q.data().quotes.find(q=>q.id===deals[r.deal].id))),markRead:ids=>N.rows.forEach(r=>{if(ids.includes(r.id))r.read=true;})};
  const PAGE='P-LS-02';
  const tr=p=>L(p[0],p[1]),amt=(n,c='USD')=>CF.fmtAmt(n)+' '+c;
  const b=(act,title,v='',primary=false,disabled=false)=>'<button type="button" class="btn'+(primary?' primary':'')+'" data-act="'+act+'" data-v="'+E(v)+'"'+(disabled?' disabled':'')+'>'+title+'</button>';
  const card=(title,body)=>'<section class="card"><div class="card-head"><h2 class="ln-heading">'+title+'</h2></div><div class="card-b">'+body+'</div></section>';
  const rows=data=>'<dl class="dl">'+data.map(([k,v])=>'<dt>'+k+'</dt><dd>'+v+'</dd>').join('')+'</dl>';
  const field=(key,title,type='text',extra='',hint='')=>'<div class="field"><label for="ln-'+key+'">'+title+'</label><input class="inp" id="ln-'+key+'" data-ln-field="'+key+'" type="'+type+'" value="'+E(form[key]||'')+'" '+extra+' aria-describedby="ln-'+key+'-err"'+(errors[key]?' aria-invalid="true"':'')+'>'+(hint?'<p class="ln-small" id="ln-'+key+'-hint">'+hint+'</p>':'')+'<span class="err-msg ln-error" role="alert" id="ln-'+key+'-err">'+E(errors[key]||'')+'</span></div>';
  /* 交易标识按本笔结算收款链分别校验；TRON 查验入口取值未定，只保留复制能力，不放死链接。 */
  const CHAINS={ETH:{test:v=>/^0x[0-9a-fA-F]{64}$/.test(v),hint:['0x followed by 64 hexadecimal characters','0x 后接 64 位十六进制字符'],explorer:h=>'https://etherscan.io/tx/'+h},
    TRON:{test:v=>/^[0-9a-fA-F]{64}$/.test(v),hint:['64 hexadecimal characters without the 0x prefix','64 位十六进制字符，不带 0x 前缀'],explorer:null}};
  let deals=[],selected=0,form={},errors={},busy=false,confirm=null,offset=0,serial=0,uploadBusy=false;
  let submitFailure=false,uploadFailure=false,planWaiting=true,commitGate='normal',coverageRead='ready',accountScene='ready';
  let relatedReturn=null,detailReturn=null,discardReturn=null,dirty=false,resultText='',tablePages={};
  let savedScroll=0,lastRole=S.role,lastLayer=null,lastFocus=null;
  let origin=null,fileReturn=null,confirmationReturn=null,pendingRestore=null,activeDraft='',lastHash=location.hash,epoch=0,errorFocus=null;
  const drafts=new Map();
  const control=el=>el?{id:el.id,act:el.dataset.act,value:el.dataset.v}:null;
  function findControl(root,target){return target?.id?root.querySelector('#'+CSS.escape(target.id)):[...root.querySelectorAll('[data-act]')].find(el=>el.dataset.act===target?.act&&el.dataset.v===target?.value);}
  function rememberLayer(){return {layer:S.layer?{...S.layer}:null,top:document.querySelector('#layers .drawer-b,#layers .modal-b')?.scrollTop||0,focus:control(document.activeElement)};}
  function restoreLayer(context){pendingRestore=context;if(context?.layer)CF.openLayer(context.layer.type,context.layer.key,context.layer.data,context.layer.under);else CF.closeLayer();}
  function closeBusiness(){relatedReturn=null;dirty=false;detailReturn=null;discardReturn=null;const previous=origin?.layer?{...origin,layer:null}:origin;origin=null;fileReturn=null;confirmationReturn=null;confirm=null;errors={};restoreLayer(previous);}
  function cancelConfirmation(){if(busy||!confirm)return;confirm=null;errors.submit='';restoreLayer(confirmationReturn);confirmationReturn=null;}
  function session(){return {epoch,deal:d(),hash:location.hash,role:S.role,form,layer:S.layer?.key};}
  function isCurrent(x){return x.epoch===epoch&&x.deal===d()&&x.hash===location.hash&&x.role===S.role&&x.form===form&&x.layer===S.layer?.key&&party();}
  function invalidate(){dirty=false;resultText='';detailReturn=null;discardReturn=null;epoch++;busy=false;uploadBusy=false;form={};errors={};confirm=null;origin=null;fileReturn=null;confirmationReturn=null;pendingRestore=null;activeDraft='';drafts.clear();}
  function focusError(key){errorFocus=key;CF.render();}

  const now=()=>D.now()+offset,iso=()=>new Date(now()).toISOString(),d=()=>deals[selected];
  const time=v=>v?CF.fmtTime(v):'—';
  const ids=()=>L('Application ','申请编号 ')+d().request+' · '+L('Business ','业务编号 ')+d().id;
  const party=()=>!!d()&&Q.related(Q.data().quotes.find(q=>q.id===d().id));
  /* 待放款只有资金方提交放款一个出口；待放款确认只有资产方确认到账一个出口。 */
  const can=action=>party()&&(action==='read'||(action==='confirm'?S.role==='asset'&&d().state==='waiting':S.role==='fund'&&d().state==='pending'));
  const denied=()=>CF.toast(L('You do not have permission to perform this action.','你无权执行此操作。'));
  const label=x=>tr({pending:['Awaiting disbursement','待放款'],waiting:['Awaiting receipt confirmation','待放款确认'],confirmed:['Disbursed','已放款'],settled:['Disbursed','已放款']}[x.state]||['Disbursed','已放款']);
  const borrower=()=>d().owner==='entity-demo-a'?L('Demo Asset Company A','演示资产企业 A'):L('Demo Asset Company B','演示资产企业 B'),funder=()=>d().fund==='fund-b'?L('Demo Capital B','演示资金机构 B'):L('Demo Capital A','演示资金机构 A');
  const chainOf=x=>(x||d()).account?.chain||'ETH',chainSpec=x=>CHAINS[chainOf(x)]||CHAINS.ETH;
  /* 已接受报价直接承接放款记录；不另建第二套项目或金额模型。 */
  function makeDeal(q){return {id:q.id,project:q.project,owner:q.owner,fund:q.fund,request:q.demand,ccy:q.ccy,amount:q.amount,settlement:q.settlement,rate:q.rate,fx:q.fx,at:q.at,acceptedAt:q.done,account:{...q.progress.account},state:'pending',short:false,gap:0,expired:false,history:[],record:null,plan:'waiting'};}
  function ensure(){const id=d()?.id;deals=Q.data().quotes.filter(q=>(q.l7||q.state==='funding')&&D.project(q.project)).map(q=>q.l7||(q.l7=makeDeal(q)));selected=Math.max(0,deals.findIndex(x=>x.id===id));deals.forEach(x=>{const p=D.project(x.project),n=D.numbers(p);x.expired=p.expired||D.now()>=Date.parse(p.expires);x.gap=Math.max(0,p.balance+n.fly-n.limit);x.short=x.gap>0;if(x.record)serial=Math.max(serial,Number(x.record.id.slice(-6))||0);});}
  function choose(id){ensure();const i=deals.findIndex(x=>x.id===id);if(i<0)return false;selected=i;return true;}
  function reset(){N.rows=[];Q.startJourney('4');ensure();selected=0;offset=0;form={};errors={};confirm=null;busy=false;}
  function syncProjects(){
    const x=d(),q=Q.data().quotes.find(q=>q.id===x.id),p=D.project(x.project),r=p.demands.find(r=>r.id===x.request),c=Q.data().credits.find(c=>c.owner===q.owner&&c.fund===q.fund);
    if(x.state==='confirmed'&&q.state!=='funded'){p.balance+=x.amount;if(c)c.principal+=x.amount;q.state='funded';r.state='funded';p.state='financing';}
    Q.save();
  }
  function emit(kind,owners,action=''){const x=d();owners.forEach(owner=>{const id=x.id+'-'+kind;if(N.rows.some(r=>r.id===id+'-'+owner))return;N.rows.push({id:id+'-'+owner,kind,owner,platform:'lending',end:'asset',at:iso(),read:false,deal:selected,action});});}
  const eventNames={submit:['Disbursement record submitted','放款记录已提交'],confirm:['Receipt confirmed','已确认到账']};
  function addHistory(kind){d().history.unshift({kind,at:iso(),by:S.role==='fund'?['Demo employee F · Demo Capital Company','演示员工 F · 演示资金企业']:['Demo employee A · Demo Asset Company A','演示员工 A · 演示资产企业 A']});}
  function support(){return '<div class="ln-support ln-small"><b>'+L('Need help?','需要帮助？')+'</b><p>'+L('If funds have not arrived, keep this unconfirmed and settle it with the counterparty. The platform never confirms or cancels on your behalf.','尚未到账时，请保持未确认并与对方核实；平台不会代为确认，也不会自动作废本笔业务。')+'</p><p>'+L('When you email support, quote the application and business numbers below. The support mailbox is not available yet.','联系客服时请注明下列融资申请编号与融资业务编号；客服邮箱尚未启用。')+'</p><p class="mono">'+E(ids())+'</p>'+CF.copyBtn('ln-copy',ids(),L('Copy reference numbers','复制业务编号'))+'</div>';}
  /* 待放款确认没有时限，只中性说明长期不确认的业务后果，不用倒计时或超期表达。 */
  function pendingNote(){return CF.note('',L('This business stays in awaiting receipt confirmation until the asset holder confirms. Until then no repayment schedule is generated, the project committed amount and committed quote amount stay occupied, and the collateral is not released.','在资产方确认到账前，本笔一直处于待放款确认：还款计划不生成，项目在途金额与在途报价金额继续占用，质押不释放。'));}
  /* 有效质押额结论决定能否提交放款；读取不到结论时不放行，也不当作不足。 */
  const gate=()=>coverageRead==='error'?'unknown':d().short?'short':'ok';
  function coverage(){const g=gate();if(g==='unknown')return CF.note('warn','<p>'+L('The collateral check is temporarily unavailable. This business is unchanged and stays readable; retry before submitting.','暂时无法完成额度校验。本笔资料不受影响，请重试后再提交。')+'</p>'+b('ln-coverage-retry',L('Retry','重试')));
    if(g==='short')return CF.note('warn','<p>'+L('Eligible pledge amount is short by ','有效质押额缺口 ')+amt(d().gap)+L('. Disbursement cannot be submitted until the asset holder adds collateral.','，资产方追加质押后方可提交放款。')+'</p><p>'+L('Added collateral must be pledged on chain and pass review before it counts towards the eligible pledge amount; a successful on-chain pledge does not take effect immediately.','追加质押要先上链、再经审核通过才计入有效质押额，上链成功不即时生效。')+'</p>');
    return '';}
  function terms(compact=false){const list=[[L('Financing amount','融资金额'),'<span class="'+(compact?'ln-summary-amount':'mono')+'">'+amt(d().amount)+'</span>'],[L('Settlement currency / amount','结算币种 / 金额'),amt(d().settlement,d().ccy)],[L('Annual interest rate','年化利率'),E(d().rate)+'%'],[L('Repayment type','还款类型'),L('Quarterly interest; principal and remaining interest at maturity','按季付息；到期还本付息')],[L('Parties','双方企业主体'),E(funder())+' / '+E(borrower())],[L('Financing application','融资申请编号'),E(d().request)],[L('Business number','融资业务编号'),E(d().id)],[L('Project number','融资项目编号'),E(d().project)],[L('Quoted exchange rate','报价汇率快照'),'1 '+d().ccy+' = '+d().fx.value+' USD<br>'+time(new Date(d().fx.at).toISOString())+'<br>'+E(tr(d().fx.source))+' · '+E(d().fx.version)],[L('Eligible pledge amount','有效质押额'),amt(D.numbers(D.project(d().project)).limit)],[L('Quote submitted / accepted','报价时间 / 接受时间'),time(new Date(d().at).toISOString())+'<br>'+time(new Date(d().acceptedAt).toISOString())]];return compact?'<dl>'+list.map(([k,v])=>'<div><dt>'+k+'</dt><dd>'+v+'</dd></div>').join('')+'</dl>':rows(list);}
  /* 资产方收款账户在 L6 接受环节选定，本册只读承接企业账户模块的字段。 */
  function assetAccount(readOnly=false,compact=false){const a=d().account;if(!a||!a.id&&!a.iban&&!a.address)return '<p class="hint">'+L('The receiving account for this business is unavailable. Check this business before recording a payment.','本笔收款账户暂不可读取，请先核对本笔资料再登记放款。')+'</p>';
    if(a.kind==='crypto'||d().ccy!=='USD')return rows([[L('Account name','账户备注名'),E(Array.isArray(a.label)?L(...a.label):a.label||'—')],[L('Settlement chain','结算收款链'),E(chainOf())],[L('Receiving address','收款地址'),'<span class="copy-pair"><span class="hash">'+E(a.address||'')+'</span>'+(readOnly?'':CF.copyBtn('ln-copy',a.address||'',L('Copy address','复制地址')))+'</span>']]);
    const full=[[L('Account name','账户备注名'),E(Array.isArray(a.label)?L(...a.label):a.label||'—')],[L('Account / IBAN','账号 / IBAN'),'<span class="copy-pair"><span class="mono">'+E(a.iban||'—')+'</span>'+(readOnly?'':CF.copyBtn('ln-copy',a.iban||'',L('Copy account number','复制账号')))+'</span>'],[L('Recipient bank','收款行名称'),E(a.bank||'—')]];
    if(compact)return rows(full);
    return rows(full.concat([[L('Beneficiary address','收款人地址'),E([a.addressCountry,a.addressCity,a.addressLine].filter(Boolean).join(' · ')||'—')],[L('Bank address','收款行地址'),E(a.bankCity||'—')],[L('SWIFT / BIC','SWIFT / BIC'),E(a.swift||'—')],[L('Bank country / region','收款行国家 / 地区'),E(a.bankCountry||a.country||'—')],[L('Intermediary bank','中转行信息'),E([a.interName,a.interSwift,a.interAccount].filter(Boolean).join(' · ')||'')||L('Not provided','未填写')]]));}
  /* 资金方还款收款账户：本企业已登记账户中选用，办理内不新增、不编辑、不手输。 */
  const repayKind=()=>d().ccy==='USD'?'fiat':'crypto';
  const repayList=()=>accountScene==='empty'?[]:(Q.accounts?Q.accounts(d().fund,repayKind()):[]);
  const repayPick=()=>repayList().find(a=>a.id===form.repayAccount);
  function repayAccount(readOnly=false){const a=d().record?.account;if(!a)return '<p class="hint">'+L('Available after the funder submits the disbursement record.','待资金方提交放款记录后显示。')+'</p>';
    return rows(Q.accountRows(a,!readOnly||party()));}
  function accountChooser(){
    if(accountScene==='loading')return '<div id="ln-repayAccount" tabindex="-1" role="status" class="ln-small">'+L('Loading your company receiving accounts…','正在加载本企业收款账户…')+'</div>';
    if(accountScene==='error')return '<div id="ln-repayAccount" tabindex="-1">'+CF.note('warn',L('Your receiving accounts could not be read just now. Retry before submitting.','暂时无法读取本企业收款账户，请重试后再提交。'))+b('ln-account-retry',L('Retry','重新加载'))+'</div>';
    const list=repayList();
    if(!list.length)return '<div id="ln-repayAccount" tabindex="-1">'+CF.note('warn',d().ccy==='USD'?L('Your company has no USD receiving account yet. Register one in Company accounts, then come back to this business.','本企业尚未登记 USD 法币收款账户，请先在企业账户登记，再回到本笔选用。'):L('Your company has no digital-currency receiving address yet. Register one in Company accounts, then come back to this business.','本企业尚未登记数币收款地址，请先在企业账户登记，再回到本笔选用。'))+b('ln-accounts-module',L('Go to company accounts','前往企业账户'))+'</div>';
    const picked=repayPick();
    return '<div id="ln-repayAccount" tabindex="-1"><fieldset class="cq-account-fieldset"><legend class="sr-only">'+L('Repayment receiving account for this business','本笔还款收款账户')+'</legend><ul class="cq-account-list">'+list.map(a=>{const miss=Q.accountMissing(a);
      return '<li><label class="cq-account-option"><input type="radio" name="ln-account-choice" value="'+E(a.id)+'" data-ln-account="'+E(a.id)+'"'+(picked?.id===a.id?' checked':'')+(miss.length?' disabled':'')+'><span class="cq-account-body"><b>'+Q.accountName(a)+'</b>'+(a.primary?CF.tag('',L('Default','默认账户')):'')+'<span class="hint">'+Q.accountKey(a)+'</span>'+(miss.length?'<span class="cq-account-off">'+L('Missing: ','缺少：')+miss.map(k=>L(...Q.accountLabels[k])).join(L(', ','、'))+L(' · complete it in Company accounts',' · 请在企业账户补齐')+'</span>':'')+'</span></label></li>';}).join('')+'</ul></fieldset>'+(picked?'<div class="cq-account-detail">'+rows(Q.accountRows(picked))+'</div>':'')+'<span class="err-msg ln-error" role="alert" id="ln-repayAccount-err">'+E(errors.repayAccount||'')+'</span><p class="ln-small">'+L('Receiving accounts are maintained in Company accounts; they cannot be added or edited here.','收款账户在企业账户模块维护，本次办理内不新增、不编辑。')+'</p></div>';
  }
  function explorer(hash){const spec=chainSpec();return spec.explorer?CF.linkOut(spec.explorer(hash),L('Open transaction in block explorer','在区块浏览器查看交易')):'';}
  function transaction(hash,readOnly){const spec=chainSpec();return rows([[L('Transaction ID','交易标识'),'<span class="copy-pair"><span class="hash">'+E(hash)+'</span>'+(readOnly?'':CF.copyBtn('ln-copy',hash,L('Copy transaction ID','复制交易标识')))+'</span>'],[L('Settlement chain','结算收款链'),E(chainOf())]])+explorer(hash)+CF.note('',spec.explorer?L('The platform has not verified this transaction. The link is for your own inspection.','平台未核验该交易，链接仅供自行查验。'):L('The platform has not verified this transaction. Copy the transaction ID and check it on your own block explorer.','平台未核验该交易，请复制交易标识自行查验。'));}
  function record(readOnly=false,compact=false){const r=d().record;if(!r)return CF.empty(L('No disbursement record yet','尚无放款记录'),L('The funder has not submitted a disbursement record.','资金方尚未提交放款记录。'));
    const head=compact?[[L('Currency / amount','币种 / 金额'),amt(d().settlement,d().ccy)],[L('Paid at · entered by funder','发放时间 · 资金方填写'),time(r.form.paidAt)],[L('Submitted at · platform recorded','提交时间 · 平台记录'),time(r.at)]]
      :[[L('Record number','放款记录编号'),E(r.id)],[L('Currency / amount','币种 / 金额'),amt(d().settlement,d().ccy)],[L('Paid at · entered by funder','发放时间 · 资金方填写'),time(r.form.paidAt)],[L('Submitted at · platform recorded','提交时间 · 平台记录'),time(r.at)],[L('Confirmed at','确认时间'),time(d().confirmedAt)],[L('Submitted by','提交人及企业主体'),L('Demo employee F · Demo Capital Company','演示员工 F · 演示资金企业')]];
    const evidence=!party()?'':(d().ccy==='USD'?readFiles(r.form.files||[],L('Transfer receipt','放款凭证'),readOnly):transaction(r.form.hash,readOnly)+(compact?'':readFiles(r.form.files||[],L('Supplementary documents','补充材料'),readOnly)));
    const note=r.form.note?rows([[L('Note','放款备注'),E(r.form.note)]]):'';
    const received=!compact&&d().confirmedAt?rows([[L('Amount received','实收金额'),r.received?amt(Number(r.received),d().ccy):'—']]):'';
    return '<div class="ln-stack">'+rows(head)+note+evidence+received+'</div>';}
  function readFiles(files,title,readOnly=false){return '<div><h3 class="ln-heading">'+title+'</h3>'+(files.length?'<ul class="ln-files-read">'+files.map((f,i)=>'<li>'+(readOnly?(f.url?'<a href="'+E(f.url)+'" download="'+E(f.name)+'">'+E(f.name)+'</a>':E(f.name)):E(f.name)+' '+b('ln-file-preview',L('Preview','预览'),i,false,!f.url)+b('ln-file-download',L('Download','下载'),i,false,!f.url))+(!f.url?'<span class=hint>'+L('Local file unavailable','本地文件不可用')+'</span>':'')+'</li>').join('')+'</ul>':'<p class="ln-small">'+L('No files','暂无文件')+'</p>')+'</div>';}
  function history(){const list=d().history;return list.length?'<ol class="ln-history">'+list.map(x=>'<li><b>'+tr(eventNames[x.kind])+'</b><span class="ln-small">'+time(x.at)+(party()?' · '+E(tr(x.by)):'')+'</span></li>').join('')+'</ol>':CF.empty(L('No disbursement activity yet','暂无放款操作记录'),L('The quote has been accepted.','报价已接受。'));}
  /* 授信协议为非必填；缺失时只说明本笔未提供，不显示待上传或待审核。 */
  function agreements(){const list=party()&&Q.agreements?Q.agreements(d().owner,d().fund):[];
    if(!list.length)return '<p class="hint">'+L('No credit agreement file was provided for this business. Financing contracts are signed offline and are not held on the platform.','本笔未提供授信协议文件；融资合同由双方线下签署，不在平台保管。')+'</p>';
    return '<div class="tablewrap"><table class="tbl resp ln-agreements"><thead><tr>'+[L('File','协议文件'),L('Type','类型'),L('File status','文件状态')].map(v=>'<th>'+v+'</th>').join('')+'</tr></thead><tbody>'+list.map(x=>'<tr><td data-label="'+L('File','协议文件')+'"><button class="btn-link" data-act="ln-agreement-download" data-v="'+E(x.file.id)+'"'+(x.available?'':' disabled')+'>'+E(x.file.name)+'</button></td><td data-label="'+L('Type','类型')+'">'+L('Credit agreement','授信协议')+' · <span class="mono">'+E(x.credit)+'</span></td><td data-label="'+L('File status','文件状态')+'">'+(x.available?L('Available','可下载'):L('Local file unavailable','本地文件不可用'))+'</td></tr>').join('')+'</tbody></table></div><p class="hint">'+L('Financing contracts are signed offline and are not held on the platform.','融资合同由双方线下签署，不在平台保管。')+'</p>';}
  function plan(){if(CF.L8&&d().state==='confirmed'){CF.L8.ensure();return '<div class="ln-pending">'+CF.tag('ok',L('Receipt confirmed','已确认到账'))+'<p>'+time(d().confirmedAt)+'</p>'+(Q.data().quotes.find(q=>q.id===d().id)?.l8?'<button class="btn" data-act="ln-repayment" data-v="'+E(d().id)+'">'+L('View repayment schedule','查看还款计划')+'</button>':CF.note('',L('Repayment plan is being generated.','还款计划生成中。')))+'</div>';}return '<div class="ln-stack">'+CF.tag('ok',L('Receipt confirmed','已确认到账'))+'<p>'+time(d().confirmedAt)+'</p>'+CF.note('',d().plan==='waiting'?L('Repayment plan is being generated.','还款计划生成中。'):L('Receipt and repayment account have been handed over. The repayment module provides the schedule.','到账事实与还款收款账户已交接，具体计划由还款模块提供。'))+'</div>';}
  function upload(key,title,required=false){const files=form[key]||[];return '<div class="field ln-full"><label for="ln-'+key+'">'+title+(required?' *':'')+'</label><div class="ln-upload"><input type="file" id="ln-'+key+'" data-ln-upload="'+key+'" accept=".pdf,.jpg,.jpeg,.png" multiple aria-describedby="ln-'+key+'-err"><p class="ln-small">PDF / JPG / PNG · '+L('Up to 5 files, 10 MB each','最多 5 个文件，单文件不超过 10 MB')+'</p>'+files.map((f,i)=>'<div class="ln-file"><span>'+E(f.name)+'</span>'+b('ln-remove',L('Remove','移除'),key+':'+i)+'</div>').join('')+'</div><span class="err-msg ln-error" role="alert" id="ln-'+key+'-err">'+E(errors[key]||'')+'</span>'+(uploadBusy?'<span role="status">'+L('Uploading…','上传中…')+'</span>':'')+'</div>';}
  function paymentForm(){const spec=chainSpec();
    return '<div class="ln-stack">'+card(L('Accepted commercial terms','本笔已接受商务条款'),terms())
      +card(L('Asset holder’s receiving account','资产方收款账户'),assetAccount())
      +card(L('Disbursement record','放款记录'),'<p class="ln-amount">'+amt(d().settlement,d().ccy)+'</p><div class="ln-grid">'+field('paidAt',L('Paid at *','发放时间 *'),'datetime-local','required')
      +(d().ccy==='USD'?upload('files',L('Transfer receipt','放款凭证'),true)
        :field('hash',L('Transaction ID *','交易标识 *'),'text','required autocomplete="off"',L('On ','本笔结算收款链 ')+E(chainOf())+L(': ','：')+tr(spec.hint))+'<div class="field"><label>'+L('Settlement chain','结算收款链')+'</label><p>'+E(chainOf())+'</p><p class="ln-small">'+L('Taken from the receiving account selected by the asset holder.','由资产方所选收款账户带出。')+'</p></div>'+upload('files',L('Supplementary documents','补充材料')))
      +'<div class="field ln-full"><label for="ln-note">'+L('Note (optional)','放款备注（选填）')+'</label><textarea class="inp" id="ln-note" data-ln-field="note" maxlength="200">'+E(form.note||'')+'</textarea><span class="err-msg">'+E(errors.note||'')+'</span></div></div>')
      +card(L('Your repayment receiving account','资金方还款收款账户'),'<p class="ln-small">'+L('Repayments for this business will be received into this account.','本笔将来的还款收到该账户。')+'</p>'+accountChooser())+'</div>';}
  const fee=()=>CF.note('accent','<div class="ln-fee">'+L('The amount received will be less than the financing amount (cross-border fees are borne by you). Your repayment principal remains ','到账金额会少于融资金额（跨境手续费由您承担）；您需要偿还的本金仍按融资金额 ')+amt(d().amount)+L('.',' 计算。')+'</div>');
  function draw(key){if(!can(key==='pay'?'pay':key==='confirm'?'confirm':'read'))return {title:L('Access denied','无访问权限'),html:CF.empty(L('Access denied','无访问权限'),'')};let body='',foot='';
    if(key==='pay'){body='<div class="ln-stack">'+coverage()+paymentForm()+'</div>';foot=b('ln-pay-ask',L('Submit disbursement','提交放款'),'',true,busy||uploadBusy||gate()!=='ok');}
    if(key==='confirm'){body='<p class="ln-counterparty">'+L('Paid by: ','付款方：')+E(funder())+'</p>'+record(false,true)+card(L('Receiving account for this payment','本次收款账户'),assetAccount(false,true))+fee()+field('received',L('Amount received (optional) · ','实收金额（选填）· ')+d().ccy,'text','inputmode="decimal" autocomplete="off"')+'<p class="hint">'+L('Confirm only after checking receipt. If funds have not arrived, keep this unconfirmed and contact the payer.','请核实实际到账后确认；尚未到账请保持未确认并联系付款方。')+'</p>'+support();foot=b('ln-confirm-ask',L('Confirm receipt','确认到账'),'',true,busy);}
    if(errors.submit)body+=CF.note('red',E(errors.submit));
    foot=b('ln-back',L('Cancel','取消'),'',false,busy||uploadBusy)+foot;
    return {title:(key==='pay'?L('Record disbursement','登记放款'):L('Confirm receipt','确认到账'))+' · '+(S.role==='fund'?borrower():funder()),html:'<div class="ln-drawer ln-stack" data-view="'+key+'">'+body+'</div>',foot};
  }
  function confirmBody(){const kind=confirm.kind;return {title:kind==='pay'?L('Submit this disbursement record?','确认提交放款记录？'):L('Confirm that funds have arrived?','确认款项已实际到账？'),html:'<div class="ln-drawer ln-confirm ln-stack"><p>'+E(S.role==='fund'?borrower():funder())+'</p><div class="ln-amount">'+amt(d().settlement,d().ccy)+'</div>'+CF.note('',kind==='pay'?L('The record and the repayment receiving account cannot be edited or withdrawn after submission. The platform does not verify payment authenticity. No confirmation countdown starts — the asset holder confirms at a time you agree offline.','记录及所选还款收款账户提交后不可修改或撤回。平台不核验付款真实性。本次提交不启动任何确认倒计时，确认时点由双方线下商定。'):L('I have verified that the funds have actually arrived. The platform does not verify receipt. This confirmation is irreversible, enters repayment and triggers repayment plan generation.','本人已核实款项实际到账；平台不核验。确认不可撤销，确认后进入还款并触发还款计划生成。'))+(kind==='confirm'?fee():'')+(errors.submit?CF.note('red',E(errors.submit)):'')+'</div>',foot:b('ln-confirm-back',L('Cancel','取消'),'',false,busy)+b('ln-commit',busy?L('Submitting…','提交中…'):L('Confirm','确认'),'',true,busy)};}
  function validate(){errors={};
    if(!form.paidAt||isNaN(Date.parse(form.paidAt)))errors.paidAt=L('Enter the payment time.','请填写发放时间。');
    else if(Date.parse(form.paidAt)>now())errors.paidAt=L('Payment time cannot be later than the submission time.','发放时间不得晚于提交时刻。');
    if(d().ccy==='USD'){if(!form.files?.length)errors.files=L('Upload at least one transfer receipt.','请上传至少一个转账凭证。');}
    else if(!chainSpec().test((form.hash||'').trim()))errors.hash=L('Use ','请输入')+tr(chainSpec().hint)+L('.','。');
    if([...(form.note||'')].length>200)errors.note=L('Use no more than 200 characters.','备注不得超过 200 字。');
    if(accountScene==='loading'||accountScene==='error')errors.repayAccount=L('Your receiving accounts could not be read. Retry before submitting.','暂时无法读取本企业收款账户，请重试后再提交。');
    else if(!repayList().length)errors.repayAccount=L('Register a receiving account in Company accounts first.','请先在企业账户登记收款账户。');
    else if(!repayPick())errors.repayAccount=L('Select the account that will receive repayments for this business.','请选用本笔将来的还款收款账户。');
    else if(Q.accountMissing(repayPick()).length)errors.repayAccount=L('This account is incomplete. Complete it in Company accounts or choose another.','该账户信息不完整，请在企业账户补齐或改选其他账户。');
    return !Object.keys(errors).length;}
  /* 实收金额选填：只校验是有限金额与已批准精度，不与融资金额比对。 */
  function validateReceived(){const raw=(form.received||'').trim();errors.received='';if(!raw)return true;
    if(!/^\d+(\.\d+)?$/.test(raw)||!isFinite(Number(raw))){errors.received=L('Enter an amount in digits, or leave it blank.','请填写数字金额，或留空。');return false;}
    if(d().ccy==='USD'&&(raw.split('.')[1]||'').length>2){errors.received=L('USD allows at most two decimal places.','USD 最多两位小数。');return false;}
    return true;}
  function open(key){
    if(!can(key==='record'?'read':key)){denied();return;}
    if(!S.layer?.key.startsWith('ln-')){origin=rememberLayer();detailReturn=null;}else if(S.layer.key==='ln-detail')detailReturn=rememberLayer();
    const id=d().id+':'+S.role+':'+key;
    if(activeDraft!==id){lastLayer=null;savedScroll=0;activeDraft=id;form=drafts.get(id)||{};drafts.set(id,form);}
    errors={};CF.openLayer('modal','ln-'+key);
  }
  function ask(kind){
    if(!can(kind)){denied();return;}
    if(kind==='pay'){if(gate()!=='ok')return;if(!validate()){focusError(Object.keys(errors)[0]);return;}}
    if(kind==='confirm'&&!validateReceived()){focusError('received');return;}
    confirmationReturn=rememberLayer();confirm={kind,drawer:S.layer.key};errors.submit='';CF.openLayer('modal','ln-confirmation');
  }
  async function commit(){if(busy)return;const kind=confirm?.kind,target=session();if(!kind||!can(kind)){denied();return;}busy=true;errors.submit='';CF.render();await new Promise(r=>setTimeout(r,550));if(!isCurrent(target))return;
    if(submitFailure){busy=false;errors.submit=L('Submission failed. Your entries are preserved; please retry.','提交失败，已保留填写内容，请重试。');CF.render();return;}
    if(kind==='pay'&&commitGate==='coverage'){D.tokens.filter(t=>t.pool===d().project).forEach(t=>t.valid=false);ensure();busy=false;confirm=null;S.layer={type:'modal',key:'ln-pay'};errors.submit=L('The eligible pledge amount has fallen. No record was submitted. Ask the asset holder to add collateral.','有效质押额已下降，本次未提交记录，请资产方追加质押。');CF.render();return;}
    if(kind==='pay'&&commitGate==='unknown'){coverageRead='error';busy=false;confirm=null;S.layer={type:'modal',key:'ln-pay'};errors.submit=L('The collateral check is temporarily unavailable. No record was submitted; retry when it recovers.','暂时无法完成额度校验，本次未提交记录，请恢复后重试。');CF.render();return;}
    if(commitGate==='stale'){busy=false;confirm=null;S.layer=null;CF.toast(L('This entry is no longer available. Review the current business.','原入口已失效，请查看当前业务。'));CF.render();return;}
    if(!can(kind)){busy=false;confirm=null;S.layer=null;CF.toast(L('The business has changed. Review the current result.','业务状态已变化，请查看当前结果。'));CF.render();return;}
    if(kind==='pay'){if(gate()!=='ok'||!validate()){busy=false;confirm=null;S.layer={type:'modal',key:'ln-pay'};CF.render();return;}const stamp=iso(),picked=repayPick();
      d().record={id:'LN'+stamp.slice(0,10).replaceAll('-','')+String(++serial).padStart(6,'0'),at:stamp,account:Q.accountSnapshot(picked),form:{...form,paidAt:new Date(form.paidAt).toISOString(),files:[...(form.files||[])]}};
      d().state='waiting';addHistory('submit');emit('submit',['asset'],'confirm');}
    if(kind==='confirm'){d().state='confirmed';d().confirmedAt=iso();d().record.received=(form.received||'').trim();d().plan=planWaiting?'waiting':'handoff';addHistory('confirm');emit('confirm',['fund']);}
    syncProjects();busy=false;confirm=null;drafts.delete(activeDraft);activeDraft='';form={};dirty=false;resultText=kind==='pay'?L('Disbursement submitted. Waiting for the asset holder to confirm receipt.','放款已提交，等待资产方确认到账。'):L('Receipt confirmed. The repayment plan is being generated.','到账已确认，正在生成还款计划。');CF.openLayer('drawer','ln-detail');CF.toast(kind==='pay'?L('Record submitted. Awaiting receipt confirmation.','放款记录已提交，等待资产方确认到账。'):L('Receipt confirmed.','已确认到账。'));}
  async function addFiles(key,list){if(busy||uploadBusy||!can('pay'))return;const target=session(),chosen=[...list],existing=form[key]||[];errors[key]='';if(existing.length+chosen.length>5){errors[key]=L('A maximum of 5 files is allowed.','最多上传 5 个文件。');CF.render();return;}const valid=[];for(const f of chosen){if(!/\.(pdf|jpe?g|png)$/i.test(f.name)||!['application/pdf','image/jpeg','image/png'].includes(f.type)){errors[key]=L('Only PDF, JPG and PNG files are supported.','仅支持 PDF、JPG、PNG 文件。');continue;}if(!f.size||f.size>10*1024*1024){errors[key]=f.size?L('Each file must be 10 MB or smaller.','单文件不得超过 10 MB。'):L('The file is empty. Choose a valid file.','文件为空，请选择有效文件。');continue;}valid.push(f);}uploadBusy=true;CF.render();await new Promise(r=>setTimeout(r,350));if(!isCurrent(target))return;uploadBusy=false;if(uploadFailure){errors[key]=L('Upload failed. Existing files are preserved. Select the file to retry.','上传失败，已有文件已保留，请重新选择文件重试。');}else{form[key]=existing.concat(valid.map(f=>({name:f.name,type:f.type,url:URL.createObjectURL(f),size:f.size})));dirty=true;}CF.render();}
  async function copy(value){if(!party()){denied();return;}try{await navigator.clipboard.writeText(value);CF.toast(L('Copied.','已复制。'));}catch(_){const a=document.createElement('textarea');a.value=value;a.style.position='fixed';document.body.append(a);a.select();let ok=false;try{ok=document.execCommand('copy');}catch(_){}a.remove();CF.toast(ok?L('Copied.','已复制。'):L('Copy is unavailable. Select the visible text and copy manually.','自动复制不可用，请选中文本手动复制。'));}}
  function download(url,name){if(!url)return;if(!party()){denied();return;}const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();}
  function demoReceipt(){const lines=['DEMONSTRATION TRANSFER RECEIPT','Paid amount: '+d().ccy+' '+d().settlement,'Business: '+d().id,'Payer: Demo Capital Company','Recipient: Demo Asset Company A','This receipt is fictional demonstration data.'];const stream='BT /F1 14 Tf 50 780 Td '+lines.map((l,i)=>(i?'0 -38 Td ':'')+'('+l+') Tj').join('\n')+' ET';const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'];let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+o+'\nendobj\n';});const start=pdf.length;pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF';return URL.createObjectURL(new Blob([pdf],{type:'application/pdf'}));}
  function go(i,action=''){ensure();if(!deals[i])return;selected=i;form={};errors={};location.hash='#/project/'+d().project+'?business='+encodeURIComponent(d().id)+(action?'&action='+action:'');V.onAct('ls-tab','financing');CF.render();if(action)setTimeout(applyDeepLink,0);}
  function applyDeepLink(){
    const params=new URLSearchParams(location.hash.split('?')[1]||''),id=params.get('business'),action=params.get('action'),project=decodeURIComponent((location.hash.match(/project\/([^?]+)/)||[])[1]||'');
    if(!id||params.has('instalment')||params.has('repayment')||(action&&!['pay','confirm','record','contract','funding'].includes(action)))return;
    if(!action&&!CF.L7.deals.some(x=>x.id===id))return;
    if(!choose(id)||d().project!==project){S.layer=null;CF.toast(L('This business is unavailable for the selected project.','当前项目下无可用的这笔融资业务。'));CF.render();return;}
    if(['pay','confirm'].includes(action)&&can(action))open(action);else openDetail(id);
  }
  const settleScenes=[['USD','USD · fiat','USD · 法币'],['USDT|ETH','USDT · ETH','USDT · ETH'],['USDT|TRON','USDT · TRON','USDT · TRON'],['USDC|ETH','USDC · ETH','USDC · ETH']];
  function demo(){ensure();if(!deals.length)return '';const settleNow=d().ccy==='USD'?'USD':d().ccy+'|'+chainOf();
    const check=(id,on,en,zh)=>'<label><input type="checkbox" id="'+id+'" '+(on?'checked':'')+'> '+L(en,zh)+'</label>';
    const select=(id,en,zh,options,current)=>'<label for="'+id+'">'+L(en,zh)+'</label><select id="'+id+'" class="inp">'+options.map(o=>'<option value="'+o[0]+'"'+(current===o[0]?' selected':'')+'>'+L(o[1],o[2])+'</option>').join('')+'</select>';
    return '<div class="ln-demo"><h5>'+L('Disbursement & receipt scenarios','放款与确认场景')+'</h5><p class="ln-small">'+L('Scenario buttons reset the example and switch to the next actor.','场景按钮会重置示例，并切换至下一步操作身份。')+'</p>'
      +'<label for="ln-demo-deal">'+L('Accepted quote','已接受报价')+'</label><select id="ln-demo-deal" class="inp">'+deals.map((x,i)=>'<option value="'+i+'"'+(selected===i?' selected':'')+'>'+x.ccy+' · '+x.id+'</option>').join('')+'</select>'
      +[['pending','Awaiting disbursement','待放款'],['waiting','Awaiting receipt confirmation','待放款确认'],['confirmed','Disbursed','已放款']].map(([k,en,zh])=>b('ln-scenario',L(en,zh),k)).join('')
      +select('ln-demo-settle','Settlement of this business','本笔结算方式',settleScenes,settleNow)
      +select('ln-demo-coverage','Eligible pledge amount','有效质押额',[['ok','Sufficient','充足'],['short','Short','不足'],['error','Check unavailable','暂时无法校验']],coverageRead==='error'?'error':d().short?'short':'ok')
      +select('ln-demo-account','Funder receiving accounts','资金方收款账户',[['ready','Accounts available','有可用账户'],['empty','None registered','尚未登记'],['loading','Loading','加载中'],['error','Load failed','读取失败']],accountScene)
      +select('ln-demo-gate','At final submission','最终提交时',[['normal','Unchanged','状态不变'],['coverage','Eligible pledge amount falls','有效质押额下降'],['unknown','Check unavailable','额度校验不可用'],['stale','Old entry','过期入口']],commitGate)
      +check('ln-demo-expired',d().expired,'Project expired','项目已到期')+check('ln-demo-submit',submitFailure,'Submission fails','提交失败')+check('ln-demo-upload',uploadFailure,'Upload fails','上传失败')+check('ln-demo-plan',planWaiting,'Repayment plan pending','还款计划生成中')
      +b('ln-role-other',L('Non-party account','非当事方账号'))+b('ln-denied-test',L('Try unauthorized write','尝试越权写入'))+b('ln-old-entry',L('Open old confirmation link','打开旧确认入口'))+b('ln-plan-ready',L('L8 handoff ready','L8 交接就绪'))+b('ln-events',L('Notification events','通知事件'))+b('ln-reset',L('Reset all demonstrations','重置演示'))+'</div>';}
  function settleScenario(value){const [ccy,chain]=value.split('|'),x=d(),q=Q.data().quotes.find(q=>q.id===x.id);
    const account=(Q.accounts(x.owner,ccy==='USD'?'fiat':'crypto')||[]).filter(a=>!Q.accountMissing(a).length).find(a=>ccy==='USD'||a.chain===chain);
    if(!account){CF.toast(L('No registered account matches this settlement in the demonstration data.','演示数据中没有与该结算方式匹配的已登记账户。'));return;}
    q.ccy=x.ccy=ccy;q.settlement=x.settlement=x.amount;q.fx=x.fx={...x.fx,value:1};q.progress.selected=account.id;q.progress.account=Q.accountSnapshot(account);x.account={...q.progress.account};
    if(x.record)x.record.form.hash=chain==='TRON'?'a'.repeat(64):'0x'+'a'.repeat(64);
    form={};errors={};drafts.clear();activeDraft='';Q.save();CF.render();}
  function scenario(value){invalidate();reset();const q=Q.data().quotes.find(q=>q.id===d().id);q.l7=makeDeal(q);ensure();form={};errors={};confirm=null;busy=false;S.layer=null;coverageRead='ready';accountScene='ready';commitGate='normal';N.rows=N.rows.filter(x=>x.deal!==selected);const x=d();
    if(['waiting','confirmed'].includes(value)){x.state='waiting';const at=new Date(now()-3600000).toISOString(),fund=Q.accounts(x.fund,x.ccy==='USD'?'fiat':'crypto').find(a=>!Q.accountMissing(a).length);
      x.record={id:'LN'+at.slice(0,10).replaceAll('-','')+String(++serial).padStart(6,'0'),at,account:fund?Q.accountSnapshot(fund):null,form:{paidAt:new Date(Date.parse(at)-3600000).toISOString(),hash:chainOf(x)==='TRON'?'a'.repeat(64):'0x'+'a'.repeat(64),files:[{name:'demonstration-transfer-receipt.pdf',type:'application/pdf',url:demoReceipt()}],note:''}};addHistory('submit');emit('submit',['asset'],'confirm');}
    if(value==='confirmed'){x.state='confirmed';x.confirmedAt=iso();addHistory('confirm');emit('confirm',['fund']);}
    S.role=value==='pending'?'fund':'asset';syncProjects();go(selected);}
  function notificationBody(r){const x=deals[r.deal];return '<div class="ln-stack"><h2 class="ln-heading">'+tr(eventNames[r.kind])+'</h2><p class="mono">'+E(x.request)+' · '+E(x.id)+'</p><p>'+time(r.at)+'</p>'+(r.kind==='submit'?'<p>'+L('Check the receipt yourself, then confirm in this business.','请自行核实到账后，在本笔业务中确认。')+'</p>':'')+(r.kind==='confirm'?'<p>'+L('Receipt confirmed. ','已确认到账。')+(x.plan==='waiting'?L('Repayment plan is being generated.','还款计划生成中。'):L('Handed over to repayment.','已交接还款模块。'))+'</p>':'')+b('ln-notification-go',L('View business','查看业务'),r.id,true)+'</div>';}
  const layers={'ln-detail':detail,'ln-discard':discardBody,'ln-pay':()=>draw('pay'),'ln-confirm':()=>draw('confirm'),'ln-confirmation':confirmBody,
    'ln-accounts':()=>({title:L('Company accounts','企业账户'),html:'<div class="ln-drawer ln-stack">'+CF.note('warn',L('Receiving accounts are registered and maintained in Company accounts. Register the account there, then come back to this business and select it.','收款账户在企业账户模块登记与维护，登记完成后回到本笔选用。'))+'<p class="hint">'+L('The company accounts module is not part of this prototype yet.','本原型尚未接入企业账户模块页面。')+'</p></div>',foot:b('ln-accounts-back',L('Back','返回'),'',true)}),
    'ln-file':f=>({title:f.name,html:'<div class="ln-drawer ln-confirm">'+preview(f)+'</div>',foot:b('ln-file-back',L('Back to record','返回记录'))})};
  function preview(f){if(!f.url)return CF.empty(L('Local file unavailable','本地文件不可用'),L('The file content is not retained after this page is reloaded.','重新打开页面后，文件内容不保留。'));return f.type.startsWith('image/')?'<img class="ln-document" src="'+E(f.url)+'" alt="'+E(f.name)+'">':'<object class="ln-document" data="'+E(f.url)+'" type="application/pdf"><p>'+L('Preview is not supported in this browser. Download the original file.','此浏览器不支持预览，请下载原件。')+'</p></object>';}
  function onAct(act,v){if(act.startsWith('ln-')&&(busy||uploadBusy))return true;if(act==='ls-handoff'&&v==='funding'){ensure();const p=location.hash.match(/project\/([^?]+)/),i=deals.findIndex(x=>x.project===p?.[1]&&['pending','waiting'].includes(x.state));if(i>=0){selected=i;const kind=can('pay')?'pay':can('confirm')?'confirm':'';if(kind)open(kind);else openDetail(d().id);return true;}return false;}
    if(!act.startsWith('ln-'))return false;ensure();if(!d())return true;if(act==='ln-business'){openDetail(v);return true;}if(act==='ln-page'){const [id,page]=v.split(':');tablePages[id]=+page;return true;}if(act==='ln-events'){CF.openLayer('modal','ln-events');return true;}
    if(act==='ln-related-back'){const back=relatedReturn;relatedReturn=null;if(back)back();else closeBusiness();}
    else if(act==='ln-repayment'){const context=rememberLayer(),id=d().id;if(CF.L8?.openDetail)CF.L8.openDetail(id,{onReturn:()=>{choose(id);restoreLayer(context);}});}
    else if(act==='ln-detail-back')backDetail();else if(act==='ln-close')requestClose();
    else if(act==='ln-discard-cancel'){restoreLayer(discardReturn);discardReturn=null;}
    else if(act==='ln-discard-confirm'){drafts.delete(activeDraft);form={};dirty=false;closeBusiness();}
    else if(act==='ln-associated-request'){if(CF.CQ.openRequest){const context=rememberLayer(),id=d().id;CF.CQ.openRequest(d().request,{selected:id,onReturn:()=>{choose(id);restoreLayer(context);}});}}
    else if(act==='ln-agreement-download'){if(!party())denied();else{const file=Q.creditFile?.(v);if(file)download(URL.createObjectURL(file),file.name);else CF.toast(L('The local file is unavailable.','本地文件不可用。'));}}
    else if(act==='ln-operate'){if(choose(v)){const kind=can('pay')?'pay':can('confirm')?'confirm':'';if(kind)open(kind);else openDetail(v);}}
    else if(act==='ln-open')open(v);else if(act==='ln-pay-ask')ask('pay');else if(act==='ln-confirm-ask')ask('confirm');else if(act==='ln-commit')commit();else if(act==='ln-confirm-back')cancelConfirmation();else if(act==='ln-back')requestClose();
    else if(act==='ln-copy')copy(v);
    else if(act==='ln-remove'){const [key,i]=v.split(':');form[key].splice(+i,1);dirty=true;}
    else if(act==='ln-coverage-retry'){coverageRead='ready';CF.toast(L('Collateral check reloaded.','额度校验已重新读取。'));}
    else if(act==='ln-account-retry'){accountScene='ready';CF.toast(L('Receiving accounts reloaded.','收款账户已重新读取。'));}
    else if(act==='ln-accounts-module'){origin=origin||rememberLayer();detailReturn=rememberLayer();CF.openLayer('modal','ln-accounts');}
    else if(act==='ln-accounts-back')backDetail();
    else if(act==='ln-project'){location.hash='#/project/'+d().project;}
    else if(act==='ln-go')go(+v);else if(act==='ln-scenario')scenario(v);
    else if(act==='ln-file-preview'||act==='ln-file-download'){if(!party())denied();else{const f=d().record?.form.files?.[+v];if(f){if(act==='ln-file-download')download(f.url,f.name);else{fileReturn=rememberLayer();CF.openLayer(S.layer?.type||'drawer','ln-file',f);}}}}
    else if(act==='ln-file-back'){restoreLayer(fileReturn);fileReturn=null;}
    else if(act==='ln-notification-go'){const r=N.visible().find(x=>x.id===v);if(r){N.markRead([r.id]);go(r.deal,r.action);}}
    else if(act==='ln-old-entry')go(selected,'confirm');
    else if(act==='ln-role-other'){S.role='other';S.layer=null;}
    else if(act==='ln-denied-test'){const old=S.role;S.role='other';if(!can('pay'))denied();S.role=old;}
    else if(act==='ln-plan-ready'){if(d().state==='confirmed'){d().plan='handoff';Q.save();}}
    else if(act==='ln-reset'){reset();go(0);}
    return true;
  }
  // Compose within the existing marketplace module and preserve its hooks.
  const originalAct=V.onAct,originalBefore=V.beforeRender,originalAfter=V.afterRender,originalGuard=V.onBeforeAct;
  Object.assign(V.layers,layers,{'ln-events':()=>({title:L('Notification events','通知事件'),html:N.rows.filter(r=>r.kind&&deals[r.deal]&&Q.related(Q.data().quotes.find(q=>q.id===deals[r.deal].id))&&r.owner===S.role).map(notificationBody).join('')||L('No events','暂无事件'),foot:b('closelayer',L('Close','关闭'))})});
  V.onAct=(act,v)=>onAct(act,v)||originalAct(act,v);
  V.beforeRender=()=>{originalBefore?.();ensure();const el=document.querySelector('#layers .drawer-b,#layers .modal-b');if(el)savedScroll=el.scrollTop;lastFocus=control(document.activeElement);
    if(S.role!==lastRole||location.hash!==lastHash||(activeDraft&&!party())||((busy||uploadBusy)&&!S.layer?.key.startsWith('ln-'))){invalidate();if(S.layer?.key.startsWith('ln-'))S.layer=null;lastRole=S.role;lastHash=location.hash;}
  };
  V.afterRender=()=>{originalAfter?.();};
  V.demo=demo;
  V.onBeforeAct=(act,v,e)=>{
    if(act==='closelayer'&&S.layer?.key.startsWith('ln-')){
      if(e.type==='click'&&e.target.closest('[data-stop]')&&e.target.closest('[data-act]')?.classList.contains('modal-mask'))return false;
      if(busy||uploadBusy)return true;
      if(S.layer.key==='ln-events')CF.closeLayer();else requestClose();return true;
    }
    if((act==='signout'||act==='role')&&(busy||uploadBusy))return true;
    return originalGuard?.(act,v,e)||false;
  };
  document.addEventListener('input',e=>{const k=e.target.dataset.lnField;if(!k)return;form[k]=e.target.value;dirty=true;delete errors[k];e.target.removeAttribute('aria-invalid');const error=document.getElementById('ln-'+k+'-err');if(error)error.textContent='';});
  document.addEventListener('change',e=>{const el=e.target;
    if(el.dataset.lnUpload){addFiles(el.dataset.lnUpload,el.files);return;}
    if(el.dataset.lnAccount){form.repayAccount=el.dataset.lnAccount;errors.repayAccount='';dirty=true;CF.render();return;}
    if(el.id==='ln-demo-deal')go(+el.value);
    if(el.id==='ln-demo-settle')settleScenario(el.value);
    if(el.id==='ln-demo-coverage'){coverageRead=el.value==='error'?'error':'ready';D.tokens.filter(t=>t.pool===d().project).forEach(t=>t.valid=el.value!=='short');ensure();CF.render();}
    if(el.id==='ln-demo-account'){accountScene=el.value;CF.render();}
    if(el.id==='ln-demo-gate')commitGate=el.value;
    if(el.id==='ln-demo-expired'){D.project(d().project).expired=el.checked;ensure();CF.render();}
    if(el.id==='ln-demo-submit')submitFailure=el.checked;
    if(el.id==='ln-demo-upload')uploadFailure=el.checked;
    if(el.id==='ln-demo-plan')planWaiting=el.checked;});
  document.addEventListener('keydown',e=>{if(e.target.matches('.ln-record-row')&&['Enter',' '].includes(e.key)){e.preventDefault();openDetail(e.target.dataset.v);return;}
    if(e.key==='Tab'&&S.layer?.key.startsWith('ln-')){const nodes=[...document.querySelectorAll('#layers button:not(:disabled),#layers a[href],#layers input:not(:disabled),#layers select,#layers textarea,#layers [tabindex="0"]')].filter(x=>x.getClientRects().length&&!x.closest('[inert]'));const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();e.stopImmediatePropagation();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();e.stopImmediatePropagation();first?.focus();}}},true);
  const observer=new MutationObserver(()=>{
    const layer=S.layer?.key,dialog=[...document.querySelectorAll('#layers [role=dialog]')].find(x=>!x.closest('[inert]'));
    document.getElementById('portal').inert=!!dialog;document.getElementById('demoBtn').hidden=!!dialog;
    if(dialog&&layer?.startsWith('ln-')){
      const body=dialog.querySelector('.drawer-b,.modal-b'),heading=dialog.querySelector('.drawer-h b,.modal-h');
      if(layer===lastLayer){if(body)body.scrollTop=savedScroll;findControl(dialog,lastFocus)?.focus({preventScroll:true});}
      else{if(body)body.scrollTop=0;if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
      if(busy||uploadBusy)dialog.querySelectorAll('input,textarea,select,button').forEach(el=>el.disabled=true);
      if(errorFocus){const target=document.getElementById('ln-'+errorFocus);target?.setAttribute('aria-invalid','true');target?.focus();target?.scrollIntoView({block:'center'});errorFocus=null;}
      lastLayer=layer;
    }else lastLayer=null;
    if(pendingRestore){const restore=pendingRestore;pendingRestore=null;setTimeout(()=>{const root=document.querySelector('#layers [role=dialog]:not([inert])')||document,body=root.querySelector('.drawer-b,.modal-b');if(body)body.scrollTop=restore.top;(findControl(root,restore.focus)||document.querySelector('[data-act=cq-request]'))?.focus({preventScroll:true});},0);}
  });observer.observe(document.getElementById('layers'),{childList:true});
  window.addEventListener('hashchange',()=>{setTimeout(applyDeepLink,0);});
  // Persist business facts with L6; blob content remains local to this open session.
  Q.data().quotes.forEach(q=>{if(q.l7)q.l7.record?.form.files?.forEach(f=>f.url=null);});
  const find=q=>{ensure();return deals.find(x=>x.id===q?.id);};
  function summaryBody(q){const x=find(q);if(!x)return '';if(!Q.related(q))return '<p class="hint">'+L('Disbursement details are visible only to the financing parties.','放款明细仅融资双方可见。')+'</p>';choose(q.id);
    const heads=[L('Record ID','放款记录编号'),L('Amount','金额'),L('Submitted / confirmed','提交 / 确认时间'),L('Status','状态')];
    const recordRows=x.record?'<div class="tablewrap"><table class="tbl resp ln-record-table"><thead><tr>'+heads.map(t=>'<th>'+t+'</th>').join('')+'</tr></thead><tbody><tr>'+[x.record.id,amt(x.settlement,x.ccy),time(x.record.at)+'<br>'+time(x.confirmedAt),label(x)].map((t,i)=>'<td data-label="'+heads[i]+'">'+t+'</td>').join('')+'</tr></tbody></table></div>':'<p class="hint">'+L('No disbursement record has been submitted.','资金方尚未提交放款记录。')+'</p>';
    return '<section class="cq-section ln-business-detail"><div class="ln-row ln-between"><h3>'+L('Disbursement progress','放款进度')+'</h3>'+CF.tag(['confirmed','settled'].includes(x.state)?'ok':'',label(x))+'</div>'+recordRows+(x.state==='waiting'?pendingNote():'')+(['confirmed','settled'].includes(x.state)?plan():'')+(x.state==='waiting'?'<details class="ls-history"><summary>'+L('Need help?','需要帮助？')+'</summary>'+support()+'</details>':'')+'<div class="ln-row">'+b('ln-business',can('pay')?L('Record disbursement','登记放款'):can('confirm')?L('Confirm receipt','确认到账'):L('View disbursement details','查看放款详情'),q.id,true)+'</div><details class="ls-history"><summary>'+L('Disbursement activity','放款操作记录')+'</summary>'+history()+'</details></section>';}
  function recordTable(p){ensure();const list=deals.filter(x=>x.project===p.id).sort((a,b)=>Number(Q.data().quotes.find(q=>q.id===b.id)?.done||0)-Number(Q.data().quotes.find(q=>q.id===a.id)?.done||0));if(!list.length)return CF.empty(L('No disbursement business','暂无融资放款'),L('Accepted quotes appear here.','接受报价后，可在这里查看放款业务。'));const pages=Math.ceil(list.length/5),page=Math.max(1,Math.min(tablePages[p.id]||1,pages));tablePages[p.id]=page;const heads=[L('Application / business','融资申请 / 业务'),L('Funder','资金方'),L('Financing amount','融资金额'),L('Disbursement amount','放款金额'),L('Disbursement number','放款编号'),L('Status','状态'),L('Submitted / confirmed','提交 / 确认时间')];return '<div class="tablewrap"><table class="tbl resp ln-list"><thead><tr>'+heads.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+list.slice((page-1)*5,page*5).map(x=>'<tr class="ln-record-row" data-act="ln-business" data-v="'+E(x.id)+'" tabindex="0" role="button" aria-label="'+E(L('View disbursement ','查看放款业务 ')+x.id)+'">'+[E(x.request)+'<br><span class="hint mono">'+E(x.id)+'</span>',E(x.fund==='fund-b'?L('Demo Capital B','演示资金机构 B'):L('Demo Capital A','演示资金机构 A')),amt(x.amount),amt(x.settlement,x.ccy)+(!x.record?'<br><span class="hint">'+L('Agreed amount','约定放款金额')+'</span>':''),x.record?E(x.record.id):'<span class="hint">'+L('No disbursement record yet','尚无放款记录')+'</span>',CF.tag(['confirmed','settled'].includes(x.state)?'ok':'',label(x)),(x.record?time(x.record.at):L('Not submitted','未提交'))+'<br><span class="hint">'+(x.confirmedAt?time(x.confirmedAt):L('Not confirmed','未确认'))+'</span>'].map((cell,i)=>'<td data-label="'+heads[i]+'">'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table></div><div class="ln-pagination"><span class="hint">'+list.length+L(' businesses · 5 per page',' 笔业务 · 每页 5 条')+'</span><div class="ln-row">'+b('ln-page',L('Previous','上一页'),p.id+':'+(page-1),false,page===1)+'<span>'+page+' / '+pages+'</span>'+b('ln-page',L('Next','下一页'),p.id+':'+(page+1),false,page===pages)+'</div></div>';}
  /* 详情按 PRD 顺序一次完整给出：放款信息、资金方还款收款账户、资产方放款收款账户、商务条款、协议文件。 */
  function detail(){const x=d();if(!x)return {title:L('Unavailable','业务不可用'),html:CF.empty(L('Business unavailable','业务不可用'),'')};
    const next=x.state==='pending'?L('Funder','资金方'):x.state==='waiting'?L('Asset holder','资产方'):L('No pending disbursement action','当前无放款待办');
    const summary='<div class="ln-detail-hero"><div><p class="hint">'+(x.record?L('Disbursement amount','放款金额'):L('Agreed disbursement amount','约定放款金额'))+'</p><div class="ln-amount">'+amt(x.settlement,x.ccy)+'</div></div>'+CF.tag(['confirmed','settled'].includes(x.state)?'ok':'',label(x))+'</div>'
      +rows([[L('Current actor','当前处理方'),next],[L('Application number','融资申请编号'),E(x.request)],[L('Business number','融资业务编号'),E(x.id)],[L('Disbursement number','放款编号'),x.record?E(x.record.id):L('No disbursement record yet','尚无放款记录')],[L('Submitted / confirmed','提交 / 确认时间'),(x.record?time(x.record.at):L('Not submitted','未提交'))+' / '+(x.confirmedAt?time(x.confirmedAt):L('Not confirmed','未确认'))]])
      +(x.expired?CF.note('',L('The project has expired; existing business continues.','项目已到期 · 存量处理中。')):'');
    const privateBody=party()?((x.record?card(L('Payment evidence','放款凭证与明细'),record(true)):'')
      +(x.state==='waiting'?pendingNote():'')
      +card(L('Funder’s repayment receiving account','资金方还款收款账户'),'<p class="ln-small">'+L('Repayments for this business will be received into this account.','本笔将来的还款收到该账户。')+'</p>'+repayAccount(true))
      +card(L('Asset holder’s disbursement receiving account','资产方放款收款账户'),assetAccount(true))
      +card(L('Accepted commercial terms','本笔已接受商务条款'),terms())
      +card(L('Agreement files','协议文件'),agreements())
      +(['confirmed','settled'].includes(x.state)?CF.note('',L('Receipt confirmed. Repayment information is listed on the project.','已确认到账，还款信息见项目清单。')):'')
      +(x.state==='waiting'?support():'')):'<p class="hint">'+L('Accounts, evidence and agreements are available only to the financing parties.','账户、凭证与协议仅融资双方可见。')+'</p>';
    return {title:L('Disbursement details','融资放款详情'),html:'<div class="ln-drawer ln-stack" data-view="detail">'+(resultText?CF.note('ok',E(resultText)):'')+summary+privateBody+'</div>',foot:b('ln-close',L('Close','关闭'))};}
  function openDetail(id,{onReturn}={}){relatedReturn=onReturn||null;if(!choose(id)){CF.toast(L('Business unavailable.','业务不可用。'));return false;}if(!S.layer?.key.startsWith('ln-'))origin=rememberLayer();detailReturn=null;resultText='';confirm=null;errors={};CF.openLayer('drawer','ln-detail');return true;}
  function backDetail(){confirm=null;errors={};if(detailReturn)restoreLayer(detailReturn);else CF.openLayer('drawer','ln-detail');}
  function requestClose(){if(busy||uploadBusy)return;if(S.layer?.key==='ln-discard'){restoreLayer(discardReturn);discardReturn=null;return;}if(dirty){discardReturn=rememberLayer();CF.openLayer('modal','ln-discard');}else closeBusiness();}
  function discardBody(){return {title:L('Discard changes?','放弃未提交的内容？'),html:'<div class="ln-drawer ln-stack"><p class="mono">'+E(ids())+'</p><p>'+L('Your entries and uploaded files have not been submitted. Return to continue, or discard them and close.','填写内容和已上传文件尚未提交。可返回继续办理，或放弃本次编辑并关闭。')+'</p></div>',foot:b('ln-discard-cancel',L('Keep editing','继续编辑'),'',true)+b('ln-discard-confirm',L('Discard and close','放弃并关闭'))};}
  function panelBody(p,progress){ensure();const available=deals.filter(x=>x.project===p.id&&['pending','waiting'].includes(x.state)&&Q.related(Q.data().quotes.find(q=>q.id===x.id)));
    if(available.length>1)return {body:progress+'<p>'+L('Select a disbursement business','选择要查看或办理的放款业务')+'</p><div class="ln-stack">'+available.map(x=>'<div class="ln-pending"><p class="mono">'+E(x.id)+'</p><p>'+amt(x.settlement,x.ccy)+' · '+label(x)+'</p>'+b('ln-operate',L('Handle business','办理业务'),x.id)+'</div>').join('')+'</div>',primary:'',secondary:''};
    const current=D.current(p),x=deals.find(x=>x.project===p.id&&x.request===current?.id&&['pending','waiting'].includes(x.state));if(!x)return null;choose(x.id);
    if(!party())return {body:progress+'<p>'+L('Funding in progress','融资放款中')+'</p><p class="hint">'+L('Disbursement information is visible to the financing parties.','放款信息仅融资双方可见。')+'</p>',primary:'',secondary:''};
    return {body:progress+'<div class="cq-operation-status">'+CF.tag('',label(x))+'</div><div class="ls-operation-amount mono">'+amt(x.settlement,x.ccy)+'</div><p>'+E(funder())+'</p><div class="ln-step-track"><div '+(x.state==='pending'?'aria-current="step"':'')+'>'+L('Funder disburses','资金方放款')+'</div><div '+(x.state==='waiting'?'aria-current="step"':'')+'>'+L('Asset holder confirms receipt','资产方确认到账')+'</div></div><p class="cq-next-step">'+(can('pay')?L('Check the accepted terms and the receiving account, then record your payment.','核对已接受条款与收款账户，登记实际放款。'):can('confirm')?L('Verify the funds have arrived, then confirm receipt.','核实款项实际到账后确认。'):L('Waiting for the counterparty to continue.','等待对方继续办理。'))+'</p>'+(x.state==='waiting'?pendingNote()+'<details class="ls-history"><summary>'+L('Need help?','需要帮助？')+'</summary>'+support()+'</details>':''),
      primary:can('pay')?b('ln-operate',L('Record disbursement','登记放款'),x.id,true):can('confirm')?b('ln-operate',L('Confirm receipt','确认到账'),x.id,true):'',secondary:''};}
  function summary(q){const old=d()?.id,result=summaryBody(q);if(old)choose(old);return result;}
  function panel(p,progress){const old=d()?.id,result=panelBody(p,progress);if(old)choose(old);return result;}
  CF.L7={get deals(){ensure();return deals;},get selected(){return selected;},scenario,go,can,now,validate,summary,panel,find,label,recordTable,openDetail,get form(){return form;},get busy(){return busy;}};
  if(!CF.portalConnected)CF.boot();setTimeout(applyDeepLink,0);
})(window.CF);
