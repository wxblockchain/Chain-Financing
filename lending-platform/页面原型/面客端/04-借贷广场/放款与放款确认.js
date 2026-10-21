/* WS-376 / L7. Session-only demonstration adapter; no payment or chain calls. */
(function(CF){
  'use strict';
  const S=CF.S,L=CF.L,E=CF.esc,V=CF.LSView,Q=CF.CQ,D=CF.LS;
  const N={rows:[],visible:()=>N.rows.filter(r=>r.owner===S.role&&deals[r.deal]&&Q.related(Q.data().quotes.find(q=>q.id===deals[r.deal].id))),markRead:ids=>N.rows.forEach(r=>{if(ids.includes(r.id))r.read=true;})};
  const PAGE='P-LS-02';
  const tr=p=>L(p[0],p[1]),amt=(n,c='USD')=>CF.fmtAmt(n)+' '+c;
  const b=(act,title,v='',primary=false,disabled=false)=>'<button type="button" class="btn'+(primary?' primary':'')+'" data-act="'+act+'" data-v="'+E(v)+'"'+(disabled?' disabled':'')+'>'+title+'</button>';
  const card=(title,body)=>'<section class="ln-section"><h2 class="ln-heading">'+title+'</h2><div class="ln-section-body">'+body+'</div></section>';
  const extra=(full,shown)=>full.filter(([k,v])=>!shown.some(([a,b])=>a===k&&b===v));
  const rows=(data,variant='')=>'<dl class="dl ln-facts '+variant+'">'+data.map(([k,v])=>'<div class="ln-fact"><dt>'+k+'</dt><dd>'+v+'</dd></div>').join('')+'</dl>';
  const field=(key,title,type='text',extra='',hint='')=>'<div class="field"><label for="ln-'+key+'">'+CF.fieldLabel(title)+'</label><input class="inp" id="ln-'+key+'" data-ln-field="'+key+'" type="'+type+'" value="'+E(form[key]||'')+'" '+extra+' aria-describedby="ln-'+key+'-err"'+(errors[key]?' aria-invalid="true"':'')+'>'+(hint?'<p class="ln-small" id="ln-'+key+'-hint">'+hint+'</p>':'')+'<span class="err-msg ln-error" role="alert" id="ln-'+key+'-err">'+E(errors[key]||'')+'</span></div>';
  /* 交易标识按本笔结算收款链分别校验；两条链都按链给查验入口，取不到入口时只保留复制。浏览器地址为演示取值。 */
  const CHAINS={ETH:{test:v=>/^0x[0-9a-fA-F]{64}$/.test(v),hint:['0x followed by 64 hexadecimal characters','0x 后接 64 位十六进制字符'],explorer:h=>'https://etherscan.io/tx/'+h},
    TRON:{test:v=>/^[0-9a-fA-F]{64}$/.test(v),hint:['64 hexadecimal characters without the 0x prefix','64 位十六进制字符，不带 0x 前缀'],explorer:h=>'https://tronscan.org/#/transaction/'+h}};
  /* 客服邮箱在代码中固定、随版本发布；这里是演示取值。 */
  const SUPPORT_EMAIL='support@harbourcredit.example';
  let deals=[],selected=0,form={},errors={},busy=false,confirm=null,offset=0,serial=0,uploadBusy=false;
  let submitFailure=false,uploadFailure=false,planWaiting=true,commitGate='normal',coverageRead='ready',accountScene='ready',explorerReady=true;
  let relatedReturn=null,detailReturn=null,discardReturn=null,dirty=false,resultText='',tablePages={};
  let savedScroll=0,lastRole=S.role,lastLayer=null,lastFocus=null;
  let accountsTrip=null,L7resume=null;
  let origin=null,fileReturn=null,confirmationReturn=null,pendingRestore=null,activeDraft='',lastHash=location.hash,epoch=0,errorFocus=null;
  const drafts=new Map(),revealed=new Set();
  const control=el=>el?{id:el.id,act:el.dataset.act,value:el.dataset.v}:null;
  function findControl(root,target){return target?.id?root.querySelector('#'+CSS.escape(target.id)):[...root.querySelectorAll('[data-act]')].find(el=>el.dataset.act===target?.act&&el.dataset.v===target?.value);}
  function rememberLayer(){return {layer:S.layer?{...S.layer}:null,top:document.querySelector('#layers .drawer-b,#layers .modal-b')?.scrollTop||0,focus:control(document.activeElement)};}
  function restoreLayer(context){pendingRestore=context;if(context?.layer)CF.openLayer(context.layer.type,context.layer.key,context.layer.data,context.layer.under);else CF.closeLayer();}
  function closeBusiness(){relatedReturn=null;dirty=false;detailReturn=null;discardReturn=null;const previous=origin?.layer?{...origin,layer:null}:origin;origin=null;fileReturn=null;confirmationReturn=null;confirm=null;errors={};restoreLayer(previous);}
  function session(){return {epoch,deal:d(),hash:location.hash,role:S.role,form,layer:S.layer?.key};}
  function isCurrent(x){return x.epoch===epoch&&x.deal===d()&&x.hash===location.hash&&x.role===S.role&&x.form===form&&x.layer===S.layer?.key&&party();}
  function invalidate(){dirty=false;resultText='';detailReturn=null;discardReturn=null;epoch++;busy=false;uploadBusy=false;form={};errors={};confirm=null;origin=null;fileReturn=null;confirmationReturn=null;pendingRestore=null;activeDraft='';drafts.clear();revealed.clear();}
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
  function ensure(){const id=d()?.id;deals=Q.data().quotes.filter(q=>(q.l7||q.state==='funding')&&D.project(q.project)).map(q=>q.l7||(q.l7=makeDeal(q)));selected=Math.max(0,deals.findIndex(x=>x.id===id));deals.forEach(x=>{const p=D.project(x.project),n=D.numbers(p);x.expired=p.expired||D.now()>=Date.parse(p.expires);x.gap=Math.max(0,p.balance+n.fly-n.limit);x.short=x.gap>0;(x.record?.form.files||[]).forEach(f=>{if(f.demo&&!f.url)f.url=demoReceipt(x);});if(x.record)serial=Math.max(serial,Number(x.record.id.slice(-6))||0);});}
  function choose(id){ensure();const i=deals.findIndex(x=>x.id===id);if(i<0)return false;selected=i;return true;}
  function reset(){N.rows=[];Q.startJourney('4');ensure();selected=0;offset=0;form={};errors={};confirm=null;busy=false;}
  function syncProjects(){
    const x=d(),q=Q.data().quotes.find(q=>q.id===x.id),p=D.project(x.project),r=p.demands.find(r=>r.id===x.request),c=Q.data().credits.find(c=>c.owner===q.owner&&c.fund===q.fund);
    if(x.state==='confirmed'&&q.state!=='funded'){p.balance+=x.amount;if(c)c.principal+=x.amount;q.state='funded';r.state='funded';p.state='financing';}
    Q.save();
  }
  function emit(kind,owners,action=''){const x=d();owners.forEach(owner=>{const id=x.id+'-'+kind;if(N.rows.some(r=>r.id===id+'-'+owner))return;N.rows.push({id:id+'-'+owner,kind,owner,platform:'lending',end:'asset',at:iso(),read:false,deal:selected,action});});}
  const eventNames={submit:['Disbursement recorded — verify receipt','放款记录已提交，请核实到账'],confirm:['Asset holder confirmed receipt','资产方已确认放款到账']};
  function addHistory(kind){d().history.unshift({kind,at:iso(),by:S.role==='fund'?['Demo employee F · Demo Capital Company','演示员工 F · 演示资金企业']:['Demo employee A · Demo Asset Company A','演示员工 A · 演示资产企业 A']});}
  function support(){return '<div class="ln-support ln-small"><b>'+L('Funds not arrived?','尚未到账？')+'</b><p>'+L('Keep this unconfirmed and check with the payer. The platform never confirms or cancels on your behalf. To contact support, quote the application and business numbers.','请保持未确认并与付款方核实；平台不会代为确认，也不会自动作废本笔业务。联系客服时请在邮件中注明融资申请编号与融资业务编号。')+'</p>'
    +'<p class="copy-pair">'+L('Support email: ','客服邮箱：')+'<span class="mono">'+SUPPORT_EMAIL+'</span>'+CF.copyBtn('ln-copy',SUPPORT_EMAIL,L('Copy support email','复制客服邮箱'))+'</p>'
    +'<p class="copy-pair"><span class="mono">'+E(ids())+'</span>'+CF.copyBtn('ln-copy',ids(),L('Copy reference numbers','复制业务编号'))+'</p></div>';}
  /* 待放款确认没有时限，只中性说明长期不确认的业务后果，不用倒计时或超期表达。 */
  function pendingNote(){return CF.note('',L('This business stays in awaiting receipt confirmation until the asset holder confirms. Until then no repayment schedule is generated, the project committed amount and committed quote amount stay occupied, and the collateral is not released.','在资产方确认到账前，本笔一直处于待放款确认：还款计划不生成，项目在途金额与在途报价金额继续占用，质押不释放。'));}
  /* 提交放款前按当场结论复核质押水位；读取不到结论时不放行，也不当作不安全。 */
  const gate=x=>coverageRead==='error'?'unknown':(x||d()).short?'short':'ok';
  const gateText=(x,asset=false)=>{const g=gate(x);if(g==='unknown')return {title:L('The collateral check is temporarily unavailable','暂时无法完成额度校验'),detail:L('Disbursement cannot be submitted until the check recovers. This business stays readable.','校验恢复前不能提交放款，本笔资料照常可查看。')};
    if(g==='short')return {title:asset?L('The funder cannot record the disbursement yet','资金方暂不能登记放款'):L('Pledge level is unsafe — disbursement cannot be submitted','质押水位不安全，暂不能提交放款'),detail:(asset?L('Add collateral to restore it. ','请追加质押以恢复。'):L('It restores once the asset holder adds collateral. ','资产方追加质押后恢复。'))+L('Added collateral counts towards the eligible borrowing limit as soon as it is pledged on chain; tokens still processing on chain do not count.','追加质押上链成功即计入有效质押额，上链处理中不计入。')};
    return null;};
  function coverage(){const t=gateText();if(!t)return '';return Q.turn('blocked',t.title,t.detail,'ln-gate')+(gate()==='unknown'?'<div class="ln-row">'+b('ln-coverage-retry',L('Retry','重试'))+'</div>':'');}
  /* 商务条款常驻关键项，汇率依据与时间收进“完整条款”。编号已在放款信息中给出，这里不重复。 */
  function terms(){const q=Q.data().quotes.find(q=>q.id===d().id);
    return rows([[L('Financing amount','融资金额'),'<span class="mono">'+amt(d().amount)+'</span>'],[L('Settlement currency / amount','结算币种 / 金额'),amt(d().settlement,d().ccy)],[L('Annual interest rate','年化利率'),E(d().rate)+'%'],[L('Repayment type','还款类型'),L('Quarterly interest; principal and remaining interest at maturity','按季付息；到期还本付息')],[L('Final repayment date','最终还款日'),q?.repay?CF.fmtDate(q.repay):'—'],[L('Funder / asset holder','报价机构 / 资产方'),E(funder())+' / '+E(borrower())]])
      +'<details class="ls-history ln-more"><summary>'+L('Full terms','完整条款')+'</summary>'+rows([[L('Quoted exchange rate','报价折算比值'),'1 '+d().ccy+' = '+d().fx.value+' USD'],[L('Rate effective at','折算生效时间'),time(new Date(d().fx.at).toISOString())],[L('Rate source / version','折算依据 / 版本'),E(tr(d().fx.source))+' · '+E(d().fx.version)],[L('Quoted at','报价时间'),time(new Date(d().at).toISOString())],[L('Accepted at','接受时间'),time(new Date(d().acceptedAt).toISOString())]])+'</details>';}
  /* 账号与地址默认脱敏；融资双方在每个脱敏处都能查看完整值并复制，非当事方没有这个操作。 */
  function accountView(a,key,withMore=true){const EA=CF.EA,crypto=a.kind==='crypto',numLabel=L(...EA.labels[crypto?'address':'iban']),id=d().id+':'+key,open=revealed.has(id);
    const full=crypto?a.address||'':EA.groupIban(a.iban)||'',copy=crypto?a.address||'':EA.compact(a.iban)||'';
    const valueId='ln-account-value-'+key,label=crypto?(open?L('Hide full address','隐藏完整地址'):L('Show full address','查看完整地址')):(open?L('Hide full account number','隐藏完整账号'):L('Show full account number','查看完整账号'));
    const cell='<span class="copy-pair ln-reveal"><span class="mono ln-account-value" id="'+valueId+'">'+(open?E(full):crypto?EA.maskAddress(a.address):EA.maskTail(EA.compact(a.iban)))+'</span><span class="ln-reveal-controls">'
      +(party()?'<button type="button" class="btn icon bare ln-visibility-toggle" data-act="ln-reveal" data-v="'+E(key)+'" aria-pressed="'+open+'" aria-controls="'+valueId+'" aria-label="'+E(label)+'" title="'+E(label)+'">'+(open?CF.ICON.eyeOff:CF.ICON.eye)+'</button>':'')
      +(open?CF.copyBtn('ln-copy',copy,crypto?L('Copy address','复制地址'):L('Copy account number','复制账号')):'')+'</span></span>';
    const brief=Q.accountRows(a,false).map(([k,v])=>k===numLabel?[k,cell]:[k,v]);
    const rest=withMore?Q.accountRows(a,true).filter(([k,v])=>k!==numLabel&&!brief.some(([x,y])=>x===k&&y===v)):[];
    return rows(brief)+(rest.length?'<details class="ls-history ln-more"><summary>'+L('View account details','查看账户详情')+'</summary>'+rows(rest)+'</details>':'');}
  /* 资产方收款账户在 L6 接受环节选定，本册只读承接企业账户模块的字段。 */
  /* 资产方收款账户在接受报价时选定，本模块只读沿用。付款方办理时给完整值与复制；只读处给脱敏摘要，完整信息按需展开。 */
  function assetAccount(mode='detail'){const a=d().account;if(!a||!a.id&&!a.iban&&!a.address)return CF.note('warn',L('The receiving account for this business cannot be read right now. Retry before recording a payment.','本笔收款账户暂时无法读取，请重试后再登记放款。'));
    if(mode==='pay'){const EA=CF.EA,lb=k=>L(...EA.labels[k]),pair=(v,copy,label)=>'<span class="copy-pair"><span class="mono">'+E(v)+'</span>'+CF.copyBtn('ln-copy',copy,label)+'</span>';
      const key=a.kind==='crypto'?[[lb('label'),EA.name(a)],[lb('chain'),E(chainOf())],[lb('address'),pair(a.address||'',a.address||'',L('Copy address','复制地址'))]]
        :[[lb('label'),EA.name(a)],[lb('iban'),pair(EA.groupIban(a.iban)||'—',EA.compact(a.iban),L('Copy account number','复制账号'))],[lb('bank'),E(a.bank||'—')],[lb('swift'),a.swift?pair(a.swift,a.swift,L('Copy SWIFT / BIC','复制 SWIFT / BIC')):'—']];
      const more=extra(Q.accountRows(a,true),key.map(([k])=>[k,'']).concat(key)).filter(([k])=>!key.some(([a])=>a===k));return rows(key)+(more.length?'<details class="ls-history ln-more"><summary>'+L('View account details','查看账户详情')+'</summary>'+rows(more)+'</details>':'');}
    return accountView(a,'asset',mode==='detail');}
  /* 资金方收款账户（将来收还款）：从本机构已登记账户中逐笔选用，不预先带出；数币只能选与本笔结算收款链相同的账户。 */
  const repayKind=()=>d().ccy==='USD'?'fiat':'crypto';
  const allRepay=()=>accountScene==='empty'?[]:(Q.accounts?Q.accounts(d().fund,repayKind()):[]);
  const sameChain=a=>repayKind()==='fiat'||a.chain===chainOf();
  const repayList=()=>accountScene==='otherChain'?[]:allRepay().filter(sameChain);
  const repayPick=()=>repayList().find(a=>a.id===form.repayAccount);
  const accountLine=a=>Q.accountName(a).replace(/<[^>]+>/g,'')+' · '+Q.accountBrief(a);
  function repayAccount(){const a=d().record?.account;if(!a)return '<p class="hint">'+L('Pending the funder’s submission.','待资金方提交。')+'</p>';
    return accountView(a,'repay');}
  function accountChooser(){
    if(accountScene==='loading')return '<div id="ln-repayAccount" tabindex="-1" role="status" class="ln-small">'+L('Loading your institution accounts…','正在加载本机构账户…')+'</div>';
    if(accountScene==='error')return '<div id="ln-repayAccount" tabindex="-1">'+CF.note('warn',L('Your accounts could not be read just now. Retry before submitting.','暂时无法读取本机构账户，请重试后再提交。'))+b('ln-account-retry',L('Retry','重新加载'))+'</div>';
    const list=repayList();
    if(!list.length){const other=repayKind()==='crypto'&&(accountScene==='otherChain'||allRepay().length);
      return '<div id="ln-repayAccount" tabindex="-1">'+CF.note('warn',repayKind()==='fiat'?L('Your institution has no USD fiat account yet. Add one in Institution accounts, then come back to this business.','本机构尚未登记 USD 法币账户，请先在机构账户登记，再回到本笔选用。')
        :other?L('This business settles on '+chainOf()+'. Your institution has no crypto account on '+chainOf()+' yet — add one in Institution accounts, then come back.','本笔结算收款链为 '+chainOf()+'，本机构尚未登记 '+chainOf()+' 上的数币账户。请先在机构账户登记，再回到本笔选用。')
        :L('Your institution has no crypto account on '+chainOf()+' yet. Add one in Institution accounts, then come back to this business.','本机构尚未登记 '+chainOf()+' 上的数币账户，请先在机构账户登记，再回到本笔选用。'))+b('ln-accounts-module',L('Go to institution accounts','前往机构账户'))+'</div>';}
    const picked=repayPick();
    const lost=errors.accountLost?CF.note('warn',E(errors.accountLost)):'';
    const option=a=>{const miss=Q.accountMissing(a),why=miss.length?L('Missing ','缺少')+miss.map(k=>L(...Q.accountLabels[k])).join(L(', ','、')):'';return '<option value="'+E(a.id)+'" data-label="'+E(Q.accountName(a).replace(/<[^>]+>/g,''))+'" data-detail="'+E(Q.accountBrief(a))+'" data-reason="'+E(why)+'" data-icons="'+E(Q.accountIcons?Q.accountIcons(a):'')+'"'+(picked?.id===a.id?' selected':'')+(miss.length?' disabled':'')+'>'+E(accountLine(a))+(miss.length?L(' (missing ',' （缺少')+miss.map(k=>L(...Q.accountLabels[k])).join(L(', ','、'))+L(')','）'):'')+'</option>';};
    return '<div class="field" id="ln-repayAccount" tabindex="-1">'+lost+'<label for="ln-account-select">'+CF.fieldLabel(L('Funder’s receiving account','资金方收款账户'),true)+'</label><select id="ln-account-select" class="inp" aria-required="true" data-ln-account="1" data-icon-select aria-describedby="ln-repayAccount-err"'+(errors.repayAccount?' aria-invalid="true"':'')+'><option value="">'+L('Select the account for future repayments','请选择用于将来收还款的账户')+'</option>'+list.map(option).join('')+'</select>'
      +'<span class="err-msg ln-error" role="alert" id="ln-repayAccount-err">'+E(errors.repayAccount||'')+'</span>'
      +(list.some(a=>Q.accountMissing(a).length)?'<p class="hint">'+L('Accounts with missing details cannot be used; complete them in Institution accounts.','信息不完整的账户不可选，请先在机构账户补齐。')+'</p>':'')
      +(picked?'<details class="ls-history ln-more"><summary>'+L('View account details','查看账户详情')+'</summary>'+rows(Q.accountRows(picked,true))+'</details>':'')+'</div>';
  }
  function explorer(hash){const spec=chainSpec();return spec.explorer&&explorerReady?CF.linkOut(spec.explorer(hash),L('Open transaction in block explorer','在区块浏览器查看交易')):'';}
  function transaction(hash,readOnly){const linked=chainSpec().explorer&&explorerReady;return rows([[L('Transaction ID','交易标识'),'<span class="copy-pair"><span class="hash">'+E(hash)+'</span>'+(readOnly?'':CF.copyBtn('ln-copy',hash,L('Copy transaction ID','复制交易标识')))+explorer(hash)+'</span>'],[L('Settlement chain','结算收款链'),E(chainOf())]])+'<p class="hint">'+(linked?L('The platform has not verified this transaction. The link is for your own inspection.','平台未核验该交易，链接仅供自行查验。'):L('The platform has not verified this transaction. Copy the transaction ID to check it yourself.','平台未核验该交易，请复制交易标识自行查验。'))+'</p>';}
  function record(readOnly=false,compact=false){const r=d().record;if(!r)return CF.empty(L('No disbursement record yet','尚无放款记录'),L('The funder has not submitted a disbursement record.','资金方尚未提交放款记录。'));
    const head=compact?[[L('Currency / amount','币种 / 金额'),amt(d().settlement,d().ccy)],[L('Paid at · entered by funder','发放时间 · 资金方填写'),time(r.form.paidAt)],[L('Submitted at · platform recorded','提交时间 · 平台记录'),time(r.at)]]
      :[[L('Record number','放款记录编号'),E(r.id)],[L('Currency / amount','币种 / 金额'),amt(d().settlement,d().ccy)],[L('Paid at · entered by funder','发放时间 · 资金方填写'),time(r.form.paidAt)],[L('Submitted at · platform recorded','提交时间 · 平台记录'),time(r.at)],[L('Confirmed at','确认时间'),time(d().confirmedAt)],[L('Submitted by','提交人及企业主体'),L('Demo employee F · Demo Capital Company','演示员工 F · 演示资金企业')]];
    const evidence=!party()?'':(d().ccy==='USD'?readFiles(r.form.files||[],L('Transfer receipt','放款凭证'),readOnly):transaction(r.form.hash,readOnly)+(compact?'':readFiles(r.form.files||[],L('Supplementary documents','补充材料'),readOnly)));
    const note=r.form.note?rows([[L('Note','放款备注'),E(r.form.note)]]):'';
    return '<div class="ln-stack">'+rows(head,compact?'ln-receipt-facts':'')+note+evidence+'</div>';}
  function readFiles(files,title,readOnly=false){return '<div><h3 class="ln-heading">'+title+'</h3>'+(files.length?'<ul class="ln-files-read">'+files.map((f,i)=>'<li>'+(!f.url?E(f.name)+'<span class="hint">'+L('Local file unavailable','本地文件不可用')+'</span>':readOnly?'<a href="'+E(f.url)+'" download="'+E(f.name)+'">'+E(f.name)+'</a>':E(f.name)+' '+b('ln-file-preview',L('Preview','预览'),i)+b('ln-file-download',L('Download','下载'),i))+'</li>').join('')+'</ul>':'<p class="ln-small">'+L('No files','暂无文件')+'</p>')+'</div>';}
  function history(){const list=d().history;return list.length?'<ol class="ln-history">'+list.map(x=>'<li><b>'+tr(eventNames[x.kind])+'</b><span class="ln-small">'+time(x.at)+(party()?' · '+E(tr(x.by)):'')+'</span></li>').join('')+'</ol>':CF.empty(L('No disbursement activity yet','暂无放款操作记录'),L('The quote has been accepted.','报价已接受。'));}
  /* 授信协议为非必填；缺失时只说明本笔未提供，不显示待上传或待审核。 */
  function agreements(){const list=party()&&Q.agreements?Q.agreements(d().owner,d().fund):[];
    if(!list.length)return '<p class="hint">'+L('Not provided for this business. Financing contracts are signed offline and are not held on the platform.','本笔未提供。融资合同由双方线下签署，不在平台保管。')+'</p>';
    return '<div class="tablewrap"><table class="tbl resp ln-agreements"><thead><tr>'+[L('File','协议文件'),L('Type','类型'),L('File status','文件状态')].map(v=>'<th>'+v+'</th>').join('')+'</tr></thead><tbody>'+list.map(x=>'<tr><td data-label="'+L('File','协议文件')+'"><button class="btn-link" data-act="ln-agreement-download" data-v="'+E(x.file.id)+'"'+(x.available?'':' disabled')+'>'+E(x.file.name)+'</button></td><td data-label="'+L('Type','类型')+'">'+L('Credit agreement','授信协议')+' · <span class="mono">'+E(x.credit)+'</span></td><td data-label="'+L('File status','文件状态')+'">'+(x.available?L('Available','可下载'):L('Local file unavailable','本地文件不可用'))+'</td></tr>').join('')+'</tbody></table></div><p class="hint">'+L('Financing contracts are signed offline and are not held on the platform.','融资合同由双方线下签署，不在平台保管。')+'</p>';}
  function plan(){const ready=CF.L8?(CF.L8.ensure(),!!Q.data().quotes.find(q=>q.id===d().id)?.l8):d().plan!=='waiting';return '<p class="ln-small">'+(ready?L('The repayment schedule is available under Repayment information.','还款计划已可在还款信息中查看。'):L('Repayment schedule is being generated.','还款计划生成中。'))+'</p>';}
  function upload(key,title,required=false){const files=form[key]||[];return '<div class="field ln-full"><label for="ln-'+key+'">'+CF.fieldLabel(title,required)+'</label><div class="ln-upload"><input type="file" id="ln-'+key+'"'+(required?' aria-required="true"':'')+' data-ln-upload="'+key+'" accept=".pdf,.jpg,.jpeg,.png" multiple aria-describedby="ln-'+key+'-err"><p class="ln-small">PDF / JPG / PNG · '+L('Up to 5 files, 10 MB each','最多 5 个文件，单文件不超过 10 MB')+'</p>'+files.map((f,i)=>'<div class="ln-file"><span>'+E(f.name)+'</span>'+b('ln-remove',L('Remove','移除'),key+':'+i)+'</div>').join('')+'</div><span class="err-msg ln-error" role="alert" id="ln-'+key+'-err">'+E(errors[key]||'')+'</span>'+(uploadBusy?'<span role="status">'+L('Uploading…','上传中…')+'</span>':'')+'</div>';}
  /* 一页完成：已接受条款与资产方收款账户只读在上，填写放款记录，最后选资金方收款账户。 */
  function paymentForm(){const spec=chainSpec();
    return '<div class="ln-stack"><div class="ln-pay-head"><p class="hint">'+L('Amount to disburse','本笔放款金额')+'</p><p class="ln-amount">'+amt(d().settlement,d().ccy)+'</p></div>'
      +'<div class="ln-pay-layout"><div class="ln-pay-reference">'+card(L('Accepted commercial terms','本笔已接受商务条款'),terms())
      +card(L('Asset holder’s receiving account','资产方收款账户'),assetAccount('pay'))
      +'</div><div class="ln-pay-entry">'+card(L('Disbursement record','放款记录'),'<div class="ln-grid">'+field('paidAt',L('Paid at *','发放时间 *'),'datetime-local','required aria-required="true"')
      +(d().ccy==='USD'?upload('files',L('Transfer receipt','转账凭证'),true)
        :field('hash',L('Transaction ID *','交易标识 *'),'text','required aria-required="true" autocomplete="off"',chainOf()+L(': ','：')+tr(spec.hint))+'<div class="field"><span class="field-label">'+L('Settlement chain','结算收款链')+'</span><p class="mono">'+E(chainOf())+'</p></div>'+upload('files',L('Supplementary documents (optional)','补充材料（选填）')))
      +'<div class="field ln-full"><label for="ln-note">'+L('Note (optional)','放款备注（选填）')+'</label><textarea class="inp" id="ln-note" data-ln-field="note" maxlength="200">'+E(form.note||'')+'</textarea><span class="err-msg">'+E(errors.note||'')+'</span></div></div>')
      +card(L('Funder’s receiving account','资金方收款账户'),'<p class="ln-small">'+L('For future repayments of this business.','用于接收本笔将来的还款。')+'</p>'+accountChooser())+'</div></div></div>';}
  const fee=()=>CF.note('accent','<div class="ln-fee">'+L('The amount received will be less than the financing amount (cross-border fees are borne by you). Your repayment principal remains ','到账金额会少于融资金额（跨境手续费由您承担）；您需要偿还的本金仍按融资金额 ')+amt(d().amount)+L('.',' 计算。')+'</div>');
  function draw(key){if(!can(key==='pay'?'pay':key==='confirm'?'confirm':'read'))return {title:L('Access denied','无访问权限'),html:CF.empty(L('Access denied','无访问权限'),''),foot:b('ln-back',L('Close','关闭'))};let body='',foot='';
    /* 不能提交时只说明原因，不放置置灰的提交按钮。 */
    if(key==='pay'){const a=repayPick();body='<div class="ln-stack">'+coverage()+paymentForm()+(gate()==='ok'?CF.note('','<div class="ln-submit-copy">'+(a?'<p><b>'+L('Future repayments go to: ','将来还款打入：')+'</b>'+Q.accountName(a)+' <span class="mono">('+E(Q.accountTail(a))+')</span>'+(a.kind==='crypto'?' · '+E(a.chain):'')+'</p>':'')+'<p>'+L('The record and the selected receiving account cannot be edited or withdrawn after submission. The platform does not verify payment authenticity. No countdown starts — when the asset holder confirms is agreed between you offline.','提交后，放款记录与所选资金方收款账户不可修改、不可撤回。平台不核验付款真实性。提交不启动任何倒计时，资产方何时确认由双方线下商定。')+'</p></div>'):'')+'</div>';foot=gate()==='ok'?b('ln-pay-ask',busy?L('Submitting…','提交中…'):L('Submit disbursement','提交放款'),'',true,busy||uploadBusy):'';}
    if(key==='confirm'){body='<div class="ln-receipt-layout"><div class="ln-receipt-record ln-stack"><p class="ln-counterparty">'+L('Paid by: ','付款方：')+E(funder())+'</p>'+record(false,true)+'</div><div class="ln-receipt-account">'+card(L('Asset holder’s receiving account','资产方收款账户'),assetAccount('confirm'))+'</div></div>'+fee()+CF.note('',L('Confirm only after you have checked that the funds actually arrived. The platform has not verified this payment. Confirmation cannot be undone and moves the business into repayment. If the funds have not arrived, just close this page.','请在自行核实款项实际到账后再确认。平台未核验付款；确认后不可撤销，并进入还款。尚未到账时直接关闭即可。'))+support();foot=b('ln-confirm-ask',busy?L('Confirming…','确认中…'):L('Confirm receipt','确认到账'),'',true,busy);}
    if(errors.submit)body=CF.note('red',E(errors.submit))+body;
    foot=b('ln-back',foot?L('Cancel','取消'):L('Close','关闭'),'',false,busy||uploadBusy)+foot;
    return {title:(key==='pay'?L('Record disbursement','登记放款'):L('Confirm receipt','确认到账'))+' · '+(S.role==='fund'?borrower():funder()),html:'<div class="ln-drawer ln-stack" data-view="'+key+'">'+body+'</div>',foot};
  }
  function validate(){errors={};
    if(!form.paidAt||isNaN(Date.parse(form.paidAt)))errors.paidAt=L('Enter the payment time.','请填写发放时间。');
    else if(Date.parse(form.paidAt)>now())errors.paidAt=L('Payment time cannot be later than the submission time.','发放时间不得晚于提交时刻。');
    if(d().ccy==='USD'){if(!form.files?.length)errors.files=L('Upload at least one transfer receipt.','请上传至少一个转账凭证。');}
    else if(!chainSpec().test((form.hash||'').trim()))errors.hash=L('On '+chainOf()+', use ','本笔结算收款链为 '+chainOf()+'，请输入')+tr(chainSpec().hint)+L('.','。');
    if([...(form.note||'')].length>200)errors.note=L('Use no more than 200 characters.','备注不得超过 200 字。');
    if(accountScene==='loading'||accountScene==='error')errors.repayAccount=L('Your accounts could not be read. Retry before submitting.','暂时无法读取本机构账户，请重试后再提交。');
    else if(!repayList().length)errors.repayAccount=repayKind()==='crypto'?L('Add a crypto account on '+chainOf()+' in Institution accounts first.','请先在机构账户登记 '+chainOf()+' 上的数币账户。'):L('Add a USD fiat account in Institution accounts first.','请先在机构账户登记 USD 法币账户。');
    else if(!repayPick())errors.repayAccount=L('Select the funder’s receiving account for future repayments.','请选用资金方收款账户（用于将来收还款）。');
    else if(Q.accountMissing(repayPick()).length)errors.repayAccount=L('This account is incomplete. Complete it in Institution accounts or choose another.','该账户信息不完整，请在机构账户补齐或改选其他账户。');
    return !Object.keys(errors).length;}
  function open(key){
    if(!can(key==='record'?'read':key)){denied();return;}
    if(!S.layer?.key.startsWith('ln-')){origin=rememberLayer();detailReturn=null;}else if(S.layer.key==='ln-detail')detailReturn=rememberLayer();
    const id=d().id+':'+S.role+':'+key;
    if(activeDraft!==id){lastLayer=null;savedScroll=0;activeDraft=id;form=drafts.get(id)||{};drafts.set(id,form);}
    errors={};CF.openLayer('modal','ln-'+key);
  }
  function ask(kind){
    if(!can(kind)){denied();return;}
    if(kind==='pay'){if(gate()!=='ok')return;if(!validate()){focusError(Object.keys(errors)[0]==='repayAccount'?'account-select':Object.keys(errors)[0]);return;}}
    /* 点击即提交，不再叠加二次确认；后果告知已在办理页内始终可见。 */
    confirm={kind,drawer:S.layer.key};errors.submit='';commit();
  }
  async function commit(){if(busy)return;const kind=confirm?.kind,target=session();if(!kind||!can(kind)){denied();return;}busy=true;errors.submit='';CF.render();await new Promise(r=>setTimeout(r,550));if(!isCurrent(target))return;
    if(submitFailure){busy=false;confirm=null;errors.submit=L('Submission failed. Your entries are preserved; please retry.','提交失败，已保留填写内容，请重试。');CF.render();return;}
    if(kind==='pay'&&commitGate==='coverage'){D.tokens.filter(t=>t.pool===d().project).forEach(t=>t.valid=false);ensure();busy=false;confirm=null;S.layer={type:'modal',key:'ln-pay'};errors.submit=L('The eligible pledge amount has fallen. No record was submitted. Ask the asset holder to add collateral.','有效质押额已下降，本次未提交记录，请资产方追加质押。');CF.render();return;}
    if(kind==='pay'&&commitGate==='unknown'){coverageRead='error';busy=false;confirm=null;S.layer={type:'modal',key:'ln-pay'};errors.submit=L('The collateral check is temporarily unavailable. No record was submitted; retry when it recovers.','暂时无法完成额度校验，本次未提交记录，请恢复后重试。');CF.render();return;}
    /* 提交时再校验所选资金方收款账户：已变更或不在本笔结算收款链上都不成立，退回重新选用。 */
    if(kind==='pay'&&(commitGate==='accountChanged'||commitGate==='otherChain')){const changed=commitGate==='accountChanged';commitGate='normal';busy=false;confirm=null;form.repayAccount='';errors={accountLost:changed?L('The account you selected has changed. No record was submitted; select the funder’s receiving account again.','所选账户已变更，本次未提交，请重新选用资金方收款账户。'):L('That account is not on this business\u2019s settlement chain ('+chainOf()+'). No record was submitted; select an account on '+chainOf()+'.','所选数币账户不在本笔结算收款链（'+chainOf()+'）上，本次未提交，请选用该链上的数币账户。')};S.layer={type:'modal',key:'ln-pay'};errorFocus='account-select';CF.render();return;}
    if(commitGate==='stale'){busy=false;confirm=null;S.layer=null;CF.toast(L('This entry is no longer available. Review the current business.','原入口已失效，请查看当前业务。'));CF.render();return;}
    if(!can(kind)){busy=false;confirm=null;S.layer=null;CF.toast(L('The business has changed. Review the current result.','业务状态已变化，请查看当前结果。'));CF.render();return;}
    if(kind==='pay'){if(gate()!=='ok'||!validate()){busy=false;confirm=null;S.layer={type:'modal',key:'ln-pay'};CF.render();return;}const stamp=iso(),picked=repayPick();
      d().record={id:'LN'+stamp.slice(0,10).replaceAll('-','')+String(++serial).padStart(6,'0'),at:stamp,account:Q.accountSnapshot(picked),form:{...form,paidAt:new Date(form.paidAt).toISOString(),files:[...(form.files||[])]}};
      d().state='waiting';addHistory('submit');emit('submit',['asset'],'confirm');}
    if(kind==='confirm'){d().state='confirmed';d().confirmedAt=iso();d().plan=planWaiting?'waiting':'handoff';addHistory('confirm');emit('confirm',['fund']);}
    syncProjects();busy=false;confirm=null;drafts.delete(activeDraft);activeDraft='';form={};dirty=false;resultText='';/* 成功后结束本次办理，回到来源并刷新本笔记录与办理入口，不自动打开详情。 */closeBusiness();CF.toast(kind==='pay'?L('Record submitted. Awaiting receipt confirmation.','放款记录已提交，等待资产方确认到账。'):L('Receipt confirmed.','已确认到账。'));}
  async function addFiles(key,list){if(busy||uploadBusy||!can('pay'))return;const target=session(),chosen=[...list],existing=form[key]||[];errors[key]='';if(existing.length+chosen.length>5){errors[key]=L('A maximum of 5 files is allowed.','最多上传 5 个文件。');CF.render();return;}const valid=[];for(const f of chosen){if(!/\.(pdf|jpe?g|png)$/i.test(f.name)||!['application/pdf','image/jpeg','image/png'].includes(f.type)){errors[key]=L('Only PDF, JPG and PNG files are supported.','仅支持 PDF、JPG、PNG 文件。');continue;}if(!f.size||f.size>10*1024*1024){errors[key]=f.size?L('Each file must be 10 MB or smaller.','单文件不得超过 10 MB。'):L('The file is empty. Choose a valid file.','文件为空，请选择有效文件。');continue;}valid.push(f);}uploadBusy=true;CF.render();await new Promise(r=>setTimeout(r,350));if(!isCurrent(target))return;uploadBusy=false;if(uploadFailure){errors[key]=L('Upload failed. Existing files are preserved. Select the file to retry.','上传失败，已有文件已保留，请重新选择文件重试。');}else{form[key]=existing.concat(valid.map(f=>({name:f.name,type:f.type,url:URL.createObjectURL(f),size:f.size})));dirty=true;}CF.render();}
  async function copy(value){if(!party()){denied();return;}try{await navigator.clipboard.writeText(value);CF.toast(L('Copied.','已复制。'));}catch(_){const a=document.createElement('textarea');a.value=value;a.style.position='fixed';document.body.append(a);a.select();let ok=false;try{ok=document.execCommand('copy');}catch(_){}a.remove();CF.toast(ok?L('Copied.','已复制。'):L('Copy is unavailable. Select the visible text and copy manually.','自动复制不可用，请选中文本手动复制。'));}}
  function download(url,name){if(!url)return;if(!party()){denied();return;}const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();}
  function demoReceipt(x=d()){const lines=['DEMONSTRATION TRANSFER RECEIPT','Paid amount: '+x.ccy+' '+x.settlement,'Business: '+x.id,'Payer: Demo Capital Company','Recipient: Demo Asset Company A','This receipt is fictional demonstration data.'];const stream='BT /F1 14 Tf 50 780 Td '+lines.map((l,i)=>(i?'0 -38 Td ':'')+'('+l+') Tj').join('\n')+' ET';const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'];let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+o+'\nendobj\n';});const start=pdf.length;pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF';return URL.createObjectURL(new Blob([pdf],{type:'application/pdf'}));}
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
      +select('ln-demo-coverage','Pledge level','质押水位',[['ok','Safe','安全'],['short','Unsafe','不安全'],['error','Check unavailable','暂时无法校验']],coverageRead==='error'?'error':d().short?'short':'ok')
      +select('ln-demo-account','Funder receiving accounts','资金方收款账户',[['ready','Accounts available','有可用账户'],['empty','None registered','尚未登记'],['otherChain','Crypto only on the other chain','数币账户只在另一条链'],['loading','Loading','加载中'],['error','Load failed','读取失败']],accountScene)
      +select('ln-demo-gate','At final submission','最终提交时',[['normal','Unchanged','状态不变'],['coverage','Pledge level turns unsafe','质押水位转为不安全'],['unknown','Check unavailable','额度校验不可用'],['accountChanged','Selected account changed','所选账户已变更'],['otherChain','Account on another chain (bypass)','绕过选用提交另一条链账户'],['stale','Old entry','过期入口']],commitGate)
      +check('ln-demo-expired',d().expired,'Project expired','项目已到期')+check('ln-demo-submit',submitFailure,'Submission fails','提交失败')+check('ln-demo-upload',uploadFailure,'Upload fails','上传失败')+check('ln-demo-plan',planWaiting,'Repayment plan pending','还款计划生成中')+check('ln-demo-explorer',!explorerReady,'Explorer entry unavailable','查验入口不可用')
      +b('ln-role-other',L('Non-party account','非当事方账号'))+b('ln-denied-test',L('Try unauthorized write','尝试越权写入'))+b('ln-old-entry',L('Open old confirmation link','打开旧确认入口'))+b('ln-plan-ready',L('L8 handoff ready','L8 交接就绪'))+b('ln-events',L('Notification events','通知事件'))+b('ln-reset',L('Reset all demonstrations','重置演示'))+'</div>';}
  function settleScenario(value){const [ccy,chain]=value.split('|'),x=d(),q=Q.data().quotes.find(q=>q.id===x.id);
    const account=(Q.accounts(x.owner,ccy==='USD'?'fiat':'crypto')||[]).filter(a=>!Q.accountMissing(a).length).find(a=>ccy==='USD'||a.chain===chain);
    if(!account){CF.toast(L('No registered account matches this settlement in the demonstration data.','演示数据中没有与该结算方式匹配的已登记账户。'));return;}
    q.ccy=x.ccy=ccy;q.settlement=x.settlement=x.amount;q.fx=x.fx={...x.fx,value:1};q.progress.selected=account.id;q.progress.account=Q.accountSnapshot(account);x.account={...q.progress.account};
    if(x.record)x.record.form.hash=chain==='TRON'?'a'.repeat(64):'0x'+'a'.repeat(64);
    form={};errors={};drafts.clear();activeDraft='';Q.save();CF.render();}
  function scenario(value){invalidate();reset();const q=Q.data().quotes.find(q=>q.id===d().id);q.l7=makeDeal(q);ensure();form={};errors={};confirm=null;busy=false;S.layer=null;coverageRead='ready';accountScene='ready';commitGate='normal';explorerReady=true;N.rows=N.rows.filter(x=>x.deal!==selected);const x=d();
    if(['waiting','confirmed'].includes(value)){x.state='waiting';const at=new Date(now()-3600000).toISOString(),fund=Q.accounts(x.fund,x.ccy==='USD'?'fiat':'crypto').find(a=>!Q.accountMissing(a).length&&(x.ccy==='USD'||a.chain===chainOf(x)));
      x.record={id:'LN'+at.slice(0,10).replaceAll('-','')+String(++serial).padStart(6,'0'),at,account:fund?Q.accountSnapshot(fund):null,form:{paidAt:new Date(Date.parse(at)-3600000).toISOString(),hash:chainOf(x)==='TRON'?'a'.repeat(64):'0x'+'a'.repeat(64),files:[{name:'demonstration-transfer-receipt.pdf',type:'application/pdf',url:demoReceipt()}],note:''}};addHistory('submit');emit('submit',['asset'],'confirm');}
    if(value==='confirmed'){x.state='confirmed';x.confirmedAt=iso();addHistory('confirm');emit('confirm',['fund']);}
    S.role=value==='pending'?'fund':'asset';syncProjects();go(selected);}
  function notificationBody(r){const x=deals[r.deal];return '<div class="ln-stack"><h2 class="ln-heading">'+tr(eventNames[r.kind])+'</h2><p class="mono">'+E(x.request)+' · '+E(x.id)+'</p><p>'+time(r.at)+'</p>'+(r.kind==='submit'?'<p>'+L('Check the receipt yourself, then confirm in this business.','请自行核实到账后，在本笔业务中确认。')+'</p>':'')+(r.kind==='confirm'?'<p>'+L('Receipt confirmed. ','已确认到账。')+(x.plan==='waiting'?L('Repayment plan is being generated.','还款计划生成中。'):L('Handed over to repayment.','已交接还款模块。'))+'</p>':'')+b('ln-notification-go',L('View business','查看业务'),r.id,true)+'</div>';}
  const layers={'ln-detail':detail,'ln-discard':discardBody,'ln-pay':()=>draw('pay'),'ln-confirm':()=>draw('confirm'),
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
    else if(act==='ln-open')open(v);else if(act==='ln-pay-ask')ask('pay');else if(act==='ln-confirm-ask')ask('confirm');else if(act==='ln-commit')commit();else if(act==='ln-back')requestClose();
    else if(act==='ln-copy')copy(v);
    else if(act==='ln-reveal'){if(!party())denied();else{const id=d().id+':'+v;if(revealed.has(id))revealed.delete(id);else revealed.add(id);}}
    else if(act==='ln-remove'){const [key,i]=v.split(':');form[key].splice(+i,1);dirty=true;}
    else if(act==='ln-coverage-retry'){coverageRead='ready';CF.toast(L('Collateral check reloaded.','额度校验已重新读取。'));}
    else if(act==='ln-account-retry'){accountScene='ready';CF.toast(L('Receiving accounts reloaded.','收款账户已重新读取。'));}
    else if(act==='ln-accounts-module'){const back=location.hash;accountsTrip={back,deal:d().id};
      location.hash='#'+CF.ENTRY['P-F-EA-01']+'?'+new URLSearchParams({return:back.replace(/^#/,''),from:'loan',business:d().id});}
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
    if(S.role!==lastRole||location.hash!==lastHash||(activeDraft&&!party())||((busy||uploadBusy)&&!S.layer?.key.startsWith('ln-'))){
      const trip=accountsTrip&&S.role===lastRole&&[accountsTrip.back,'#'+CF.ENTRY['P-F-EA-01']].some(h=>location.hash===h||location.hash.startsWith(h+'?'));
      if(!trip){invalidate();accountsTrip=null;}
      if(S.layer?.key.startsWith('ln-'))S.layer=null;lastRole=S.role;lastHash=location.hash;}
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
    if(el.dataset.lnAccount){form.repayAccount=el.value;delete errors.repayAccount;delete errors.accountLost;dirty=true;CF.render();return;}
    if(el.id==='ln-demo-deal')go(+el.value);
    if(el.id==='ln-demo-settle')settleScenario(el.value);
    if(el.id==='ln-demo-coverage'){coverageRead=el.value==='error'?'error':'ready';D.tokens.filter(t=>t.pool===d().project).forEach(t=>t.valid=el.value!=='short');ensure();CF.render();}
    if(el.id==='ln-demo-account'){accountScene=el.value;CF.render();}
    if(el.id==='ln-demo-gate')commitGate=el.value;
    if(el.id==='ln-demo-expired'){D.project(d().project).expired=el.checked;ensure();CF.render();}
    if(el.id==='ln-demo-submit')submitFailure=el.checked;
    if(el.id==='ln-demo-upload')uploadFailure=el.checked;
    if(el.id==='ln-demo-plan')planWaiting=el.checked;if(el.id==='ln-demo-explorer'){explorerReady=!el.checked;CF.render();}});
  document.addEventListener('keydown',e=>{if(e.target.matches('.ln-record-row')&&['Enter',' '].includes(e.key)){e.preventDefault();openDetail(e.target.dataset.v);return;}
    if(e.key==='Tab'&&S.layer?.key.startsWith('ln-')){const nodes=[...document.querySelectorAll('#layers button:not(:disabled),#layers a[href],#layers input:not(:disabled),#layers select,#layers textarea,#layers [tabindex="0"]')].filter(x=>x.getClientRects().length&&!x.closest('[inert]'));const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();e.stopImmediatePropagation();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();e.stopImmediatePropagation();first?.focus();}}},true);
  const observer=new MutationObserver(()=>{
    const layer=S.layer?.key,dialog=[...document.querySelectorAll('#layers [role=dialog]')].find(x=>!x.closest('[inert]'));
    document.getElementById('portal').inert=!!dialog;document.getElementById('demoBtn').hidden=!!dialog;
    if(dialog&&layer?.startsWith('ln-')){
      const body=dialog.querySelector('.drawer-b,.modal-b'),heading=dialog.querySelector('.drawer-h b,.modal-h');
      if(layer===lastLayer){if(body)body.scrollTop=savedScroll;const target=findControl(dialog,lastFocus)||heading;if(target){if(target===heading)target.tabIndex=-1;target.focus({preventScroll:true});}}
      else{if(body)body.scrollTop=0;if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
      if(busy||uploadBusy)dialog.querySelectorAll('input,textarea,select,button').forEach(el=>el.disabled=true);
      if(errorFocus){const target=document.getElementById('ln-'+errorFocus);target?.setAttribute('aria-invalid','true');
        const focus=()=>{if(!target?.isConnected)return;const control=document.getElementById(target.id+'-btn')||target;control.setAttribute('aria-invalid','true');control.focus();control.scrollIntoView({block:'center'});};
        if(target?.matches('select[data-icon-select]'))requestAnimationFrame(focus);else focus();errorFocus=null;}
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
    return '<section class="cq-section ln-business-detail"><div class="ln-row ln-between"><h3>'+L('Disbursement progress','放款进度')+'</h3>'+CF.tag(['confirmed','settled'].includes(x.state)?'ok':'',label(x))+'</div>'+recordRows+(x.state==='waiting'?pendingNote():'')+(['confirmed','settled'].includes(x.state)?plan():'')+'<div class="ln-row">'+b('ln-business',L('View disbursement details','查看放款详情'),q.id)+'</div><details class="ls-history"><summary>'+L('Disbursement activity','放款操作记录')+'</summary>'+history()+'</details></section>';}
  /* 清单：编号、报价机构、放款编号与展示状态所有资金方可见；金额与时间只对本笔双方。 */
  function recordTable(p){ensure();const list=deals.filter(x=>x.project===p.id).sort((a,b)=>Number(Q.data().quotes.find(q=>q.id===b.id)?.done||0)-Number(Q.data().quotes.find(q=>q.id===a.id)?.done||0));if(!list.length)return CF.empty(L('No disbursement business','暂无融资放款'),L('Accepted quotes appear here.','接受报价后在此查看放款业务。'));
    const pages=Math.ceil(list.length/5),page=Math.max(1,Math.min(tablePages[p.id]||1,pages));tablePages[p.id]=page;
    const heads=[L('Application / business','融资申请 / 业务'),L('Funder','报价机构'),L('Disbursement amount','放款金额'),L('Disbursement number','放款编号'),L('Status','状态'),L('Submitted / confirmed','提交 / 确认时间')];
    const own=x=>Q.related(Q.data().quotes.find(q=>q.id===x.id)),hidden='<span class="hint">'+L('Parties only','仅本笔双方可见')+'</span>';
    return '<div class="tablewrap"><table class="tbl resp ln-list"><thead><tr>'+heads.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+list.slice((page-1)*5,page*5).map(x=>'<tr class="ln-record-row" data-act="ln-business" data-v="'+E(x.id)+'" tabindex="0" role="button" aria-label="'+E(L('View disbursement ','查看放款业务 ')+x.id)+'">'+[E(x.request)+'<br><span class="hint mono">'+E(x.id)+'</span>',E(x.fund==='fund-b'?L('Demo Capital B','演示资金机构 B'):L('Demo Capital A','演示资金机构 A')),own(x)?amt(x.settlement,x.ccy)+(!x.record?'<br><span class="hint">'+L('Agreed amount','约定放款金额')+'</span>':''):hidden,x.record?'<span class="mono">'+E(x.record.id)+'</span>':'<span class="hint">'+L('No disbursement record submitted yet','尚未提交放款记录')+'</span>',CF.tag(['confirmed','settled'].includes(x.state)?'ok':'',label(x)),own(x)?(x.record?time(x.record.at):L('Not submitted','未提交'))+'<br><span class="hint">'+(x.confirmedAt?time(x.confirmedAt):L('Not confirmed','未确认'))+'</span>':hidden].map((cell,i)=>'<td data-label="'+heads[i]+'">'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table></div><div class="ln-pagination"><span class="hint">'+list.length+L(' businesses · 5 per page',' 笔业务 · 每页 5 条')+'</span><div class="ln-row">'+b('ln-page',L('Previous','上一页'),p.id+':'+(page-1),false,page===1)+'<span>'+page+' / '+pages+'</span>'+b('ln-page',L('Next','下一页'),p.id+':'+(page+1),false,page===pages)+'</div></div>';}
    /* 详情按顺序一次给全：放款信息、资金方收款账户、资产方收款账户、商务条款、协议文件；非当事资金方只见编号、报价机构与状态。 */
  function detail(){const x=d();if(!x)return {title:L('Unavailable','业务不可用'),html:CF.empty(L('Business unavailable','业务不可用'),'')};
    const done=['confirmed','settled'].includes(x.state),mine=r=>S.role===r;
    const step=(label,state)=>'<div data-state="'+state+'"'+(state==='turn'||state==='wait'?' aria-current="step"':'')+'><b>'+label+'</b><span>'+({done:L('Done','已完成'),turn:L('Your turn','轮到您'),wait:L('Waiting for the other party','等待对方'),next:L('Not started','未开始')}[state])+'</span></div>';
    const steps='<div class="ln-steps">'+step(L('Funder disburses','资金方放款'),x.state==='pending'?(mine('fund')?'turn':'wait'):'done')+step(L('Asset holder confirms receipt','资产方确认到账'),done?'done':x.state==='waiting'?(mine('asset')?'turn':'wait'):'next')+'</div>';
    if(!party())return {title:L('Disbursement details','融资放款详情'),html:'<div class="ln-drawer ln-stack" data-view="detail"><div class="ln-detail-hero"><div><p class="hint">'+L('Business number','融资业务编号')+'</p><p class="mono">'+E(x.id)+'</p></div>'+CF.tag(done?'ok':'',label(x))+'</div>'+rows([[L('Application number','融资申请编号'),E(x.request)],[L('Funder','报价机构'),E(funder())],[L('Disbursement number','放款编号'),x.record?E(x.record.id):L('No disbursement record submitted yet','尚未提交放款记录')]])+'<p class="hint">'+L('Amounts, accounts and payment evidence are visible only to the two parties of this business.','放款金额、账户与付款凭据仅本笔双方可见。')+'</p></div>',foot:b('ln-close',L('Close','关闭'))};
    const r=x.record,actor=x.state==='pending'?L('Funder','资金方'):x.state==='waiting'?L('Asset holder','资产方'):L('None','无');
    const info=rows([[L('Current actor','当前处理方'),actor],[L('Application number','融资申请编号'),E(x.request)],[L('Business number','融资业务编号'),E(x.id)],[L('Disbursement number','放款编号'),r?E(r.id):L('No disbursement record submitted yet','尚未提交放款记录')],[L('Paid at · entered by funder','发放时间 · 资金方填写'),r?time(r.form.paidAt):'—'],[L('Submitted at · platform recorded','提交时间 · 平台记录'),r?time(r.at):L('Not submitted','未提交')],[L('Confirmed at','确认时间'),x.confirmedAt?time(x.confirmedAt):L('Not confirmed','未确认')]])
      +(r?(r.form.note?rows([[L('Note','放款备注'),E(r.form.note)]]):'')+(x.ccy==='USD'?readFiles(r.form.files||[],L('Transfer receipt','转账凭证'),true):transaction(r.form.hash,true)+((r.form.files||[]).length?readFiles(r.form.files,L('Supplementary documents','补充材料'),true):'')):'');
    const hero='<div class="ln-detail-hero"><div><p class="hint">'+(r?L('Disbursement amount','放款金额'):L('Agreed disbursement amount','约定放款金额'))+'</p><div class="ln-amount">'+amt(x.settlement,x.ccy)+'</div></div>'+CF.tag(done?'ok':'',label(x))+'</div>'+steps;
    const body=hero+(x.state==='waiting'?pendingNote():'')
      +card(L('Disbursement information','放款信息'),info)
      +card(L('Funder’s receiving account','资金方收款账户'),'<p class="ln-small">'+L('For future repayments of this business.','用于接收本笔将来的还款。')+'</p>'+repayAccount())
      +card(L('Asset holder’s receiving account','资产方收款账户'),'<p class="ln-small">'+L('Receives this disbursement.','用于接收本笔放款。')+'</p>'+assetAccount('detail'))
      +card(L('Accepted commercial terms','本笔已接受商务条款'),terms())
      +card(L('Agreement files','协议文件'),agreements())
      +(done?plan():'')+(x.state==='waiting'?support():'');
    return {title:L('Disbursement details','融资放款详情'),html:'<div class="ln-drawer ln-stack" data-view="detail">'+(resultText?CF.note('ok',E(resultText)):'')+body+'</div>',foot:b('ln-close',L('Close','关闭'))};}
  function openDetail(id,{onReturn}={}){relatedReturn=onReturn||null;if(!choose(id)){CF.toast(L('Business unavailable.','业务不可用。'));return false;}if(!S.layer?.key.startsWith('ln-'))origin=rememberLayer();detailReturn=null;resultText='';confirm=null;errors={};CF.openLayer('drawer','ln-detail');return true;}
  function backDetail(){confirm=null;errors={};if(detailReturn)restoreLayer(detailReturn);else CF.openLayer('drawer','ln-detail');}
  function requestClose(){if(busy||uploadBusy)return;if(S.layer?.key==='ln-discard'){restoreLayer(discardReturn);discardReturn=null;return;}if(dirty){discardReturn=rememberLayer();CF.openLayer('modal','ln-discard');}else closeBusiness();}
  function discardBody(){return {title:L('Discard changes?','放弃未提交的内容？'),html:'<div class="ln-drawer ln-stack"><p class="mono">'+E(ids())+'</p><p>'+L('Your entries and uploaded files have not been submitted. Return to continue, or discard them and close.','填写内容和已上传文件尚未提交。可返回继续办理，或放弃本次编辑并关闭。')+'</p></div>',foot:b('ln-discard-cancel',L('Keep editing','继续编辑'),'',true)+b('ln-discard-confirm',L('Discard and close','放弃并关闭'))};}
  /* 办理区只放当前能办理的按钮；资金方被质押水位或额度校验挡住时不放置灰按钮，由提示说明原因。 */
  function panelBody(p,progress){ensure();const available=deals.filter(x=>x.project===p.id&&['pending','waiting'].includes(x.state)&&Q.related(Q.data().quotes.find(q=>q.id===x.id)));
    const act=x=>{const old=selected;selected=deals.indexOf(x);const k=can('pay')&&gate(x)==='ok'?'pay':can('confirm')?'confirm':'';selected=old;return k;};
    if(available.length>1)return {body:progress+'<p>'+L('Several disbursement businesses are open. Choose one to handle.','本项目有多笔放款业务，请选择要办理的一笔。')+'</p><div class="ln-stack">'+available.map(x=>'<div class="ln-pending"><p class="mono">'+E(x.request)+' · '+E(x.id)+'</p><p>'+amt(x.settlement,x.ccy)+' · '+label(x)+'</p>'+(act(x)?b('ln-operate',act(x)==='pay'?L('Record disbursement','登记放款'):L('Confirm receipt','确认到账'),x.id):'')+'</div>').join('')+'</div>',primary:'',secondary:''};
    const current=D.current(p),x=deals.find(x=>x.project===p.id&&x.request===current?.id&&['pending','waiting'].includes(x.state));if(!x)return null;choose(x.id);
    if(!party())return {body:progress+'<div class="cq-operation-status">'+CF.tag('',label(x))+'</div>',primary:'',secondary:''};
    const blocked=can('pay')&&gate()!=='ok';
    return {body:progress+'<div class="cq-operation-status">'+CF.tag('',label(x))+'</div><div class="ls-operation-amount mono">'+amt(x.settlement,x.ccy)+'</div><p>'+E(funder())+'</p><div class="ln-step-track"><div '+(x.state==='pending'?'aria-current="step"':'')+'>'+L('Funder disburses','资金方放款')+'</div><div '+(x.state==='waiting'?'aria-current="step"':'')+'>'+L('Asset holder confirms receipt','资产方确认到账')+'</div></div>',
      primary:blocked?(gate()==='unknown'?b('ln-coverage-retry',L('Retry the check','重新校验'),'',true):''):can('pay')?b('ln-operate',L('Record disbursement','登记放款'),x.id,true):can('confirm')?b('ln-operate',L('Confirm receipt','确认到账'),x.id,true):'',secondary:''};}
  function summary(q){const old=d()?.id,result=summaryBody(q);if(old)choose(old);return result;}
  function panel(p,progress){const old=d()?.id,result=panelBody(p,progress);if(old)choose(old);return result;}
  /* 登记完账户后回到本笔放款办理的原位置；本笔已填内容在往返期间保留。 */
  L7resume=id=>{ensure();const target=id||accountsTrip?.deal;accountsTrip=null;
    const i=deals.findIndex(x=>x.id===target);
    if(i<0){CF.toast(L('That business is no longer available.','原办理已不可用。'));return;}
    selected=i;if(can('pay'))open('pay');else openDetail(d().id);CF.render();};
  CF.L7={resumeAccounts:(...a)=>L7resume(...a),gate:x=>gate(x),gateText:(x,asset)=>gateText(x,asset),get deals(){ensure();return deals;},get selected(){return selected;},scenario,go,can,now,validate,summary,panel,find,label,recordTable,openDetail,get form(){return form;},get busy(){return busy;}};
  if(!CF.portalConnected)CF.boot();setTimeout(applyDeepLink,0);
})(window.CF);
