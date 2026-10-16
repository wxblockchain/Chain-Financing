/* WS-351 · module views. Shared tokens/components/shell remain the only source. */
(function(CF){
  'use strict';
  const S=CF.S,D=CF.LS,L=CF.L,E=CF.esc,Q=CF.CQ;
  const LIST='P-LS-01',DETAIL='P-LS-02',NEW='P-LS-03';
  CF.PAGES[DETAIL]={end:'asset',layout:'portal',crumbKey:'lsDetail',parent:LIST};
  CF.PAGES[NEW]={end:'asset',layout:'portal',crumbKey:'lsNew',parent:LIST,auth:true};
  CF.ENTRY[DETAIL]='/project/'+D.projects[0].id;CF.ENTRY[NEW]='/project/new';
  let selection=[],name='',kind='',rate='',expiry='',settle=[],editing=null,error='',amount='',busy=false,appId=null,operation='deposit',pages={tokens:1,demands:1,select:1},filter={},pendingAction=null;
  let reviewFilter={},reviewLoad='default',historyToken=null,agreementId=null,agreementFail=false,feeQuote=[],confirmationChanges=[],demoApplication='';
  let outcome='success',executionGate='normal',submitFail=false,closeRace=false,refocus=null,fromConsole=false;
  try{fromConsole=sessionStorage.getItem('hc-ls-origin')==='console';}catch(_){}
  const stateNames={projectReview:['Under review','待审核'],returned:['Returned','已退回'],available:['Available','可用'],raising:['Fundraising','募集中'],locked:['Locked','已锁定'],financing:['Financing','融资中'],closed:['Closed','已关闭'],settled:['Settled','已结清'],review:['Under review','审核中'],approved:['Approved','审核通过'],rejected:['Rejected','已驳回'],withdrawn:['Withdrawn','已撤回'],void:['Ended with the project','随项目终结'],executing:['Execution in progress','执行处理中'],recorded:['Results recorded','结果已回写'],processing:['Processing','处理中'],success:['Succeeded','成功'],failure:['Failed','失败'],noFee:['Failed','失败'],open:['Awaiting quotes','待报价'],quoted:['Quoted · awaiting confirmation','已报价待确认'],funding:['Funding in progress','放款中'],funded:['Funded','已放款'],ended:['Expired / closed','已失效／已关闭'],surplus:['Pledge surplus','质押充足'],balanced:['Pledge balanced','质押持平'],short:['Pledge shortfall','质押不足']};
  const reasons={reviewTimeout:['Operations did not complete the review within 48 hours.','48 小时未完成审核。'],rejected:['The selected receivables require a complete buyer acknowledgement. Please provide the missing evidence before submitting again.','所选应收账款缺少完整的买方确认，请补全确认材料后重新提交。'],recheck:['The token is no longer eligible. This deposit permission has been voided; no execution was started and no fees were incurred.','代币已不满足入池条件，入池许可已作废；未发起链上执行，未产生任何费用。'],closed:['The project is closed.','项目已关闭。'],coverage:['Automatically expired · pledge shortfall','自动失效 · 质押不足'],withdrawn:['Withdrawn by asset holder','资产方撤下'],expiry:['Project term expired','有效期到期'],owner:['Closed by asset holder','资产方主动关闭']};
  const errors={deploying:['This project is being processed for review and cannot be closed right now. Please try again later.','本项目正在处理审核，暂不可关闭，请稍后再试。'],expiry:['Choose an expiry date within the selectable range.','请在可选范围内选择项目到期日。'],termCap:['No maximum project term is configured for this token type, so the project cannot be submitted.','该代币类型尚未配置最长项目期限，暂不能提交。'],rate:['Enter a pledge rate above 0, within the limit, with no more than 2 decimal places.','请输入大于 0、不超过上限且最多两位小数的质押率。'],permission:['You cannot perform this action for this entity.','你无权代表该企业执行此操作。'],selectionChanged:['The selection is no longer available. Select eligible tokens again.','所选代币已被占用或不再可质押，请重新选择。'],name:['Enter a project name of 1–60 characters.','请输入 1～60 字符的项目名称。'],kind:['Select a token type.','请选择代币类型。'],reviewChanged:['This application already has a decision and cannot be withdrawn.','该申请已有结论，无法撤回。'],approvalChanged:['This approval is no longer available. Check the application history.','该审核结论已不可用，请查看审核历史。'],publishChanged:['The project cannot be published now. Refresh the amount and project status.','当前无法发布，请检查最新额度和项目状态。'],demandChanged:['The financing request has changed and cannot be edited.','融资需求状态已变化，当前不可修改。'],cannotClose:['Withdraw the open financing request and settle outstanding financing before closing.','请先撤下在途需求并结清存量融资业务，再关闭项目。'],amount:['Enter a positive USD amount with no more than 2 decimal places, within the available amount.','请输入大于 0、最多两位小数且不超过可融金额的 USD 金额。'],withdrawLimit:['The selected value exceeds the current withdrawable limit. Reduce the selection, or wait for repayment to release more.','拟撤回价值超过当前上限，请减少勾选或等待还款释放余额。']};
  const txt=a=>a?L(a[0],a[1]):'—',usd=n=>CF.fmtAmt(n)+' USD',time=v=>v?CF.fmtStamp(v)+':'+String(new Date(v).getUTCSeconds()).padStart(2,'0')+' ('+E(S.tz||'UTC')+')':'—',date=v=>v?CF.fmtDate(v):'—';
  const stampCell=v=>v?'<time class="ls-stamp mono" datetime="'+E(v)+'" title="'+time(v)+'">'+E(CF.fmtStamp(v))+'</time>':'—';
  const label=k=>txt(stateNames[k]||[k,k]);
  /* 业务日期按 UTC 判定，取当日正午格式化，任何展示时区都落在同一天。 */
  const day=v=>v?CF.fmtDate(v.slice(0,10)+'T12:00:00Z'):'—';
  const termText=p=>day(p.created)+' ～ '+day(p.expiry)+' (UTC)';
  const copyIcon=(value,labelText)=>CF.copyBtn('ls-copy',value,labelText);
  /* 本项目质押合约：公开事实、完整地址可复制，平台不做链上核验；部署前只说明，不给占位地址。 */
  function contractBlock(p,compact){
    if(!p.contract)return '<div class="ls-contract is-pending"><span class="ls-contract-k">'+L('Pledge contract','质押合约')+'</span><p class="ls-contract-wait">'+L('The platform deploys this project\'s pledge contract once the review is approved.','审核通过后由平台部署本项目质押合约。')+'</p></div>';
    return '<div class="ls-contract"><div class="ls-contract-top"><span class="ls-contract-k">'+L('Pledge contract','质押合约')+'</span>'+CF.icoChip(D.PLEDGE_CHAIN,{glyph:CF.ICON.chain,small:true})+'<span class="ls-contract-tools">'+copyIcon(p.contract,L('Copy pledge contract address','复制质押合约地址'))+CF.linkOut('https://etherscan.io/address/'+encodeURIComponent(p.contract),L('Open the contract in a blockchain explorer (new window)','在区块链浏览器打开该合约（新窗口）'))+'</span></div>'
      +'<p class="ls-contract-full mono">'+E(p.contract)+'</p>'
      +'<p class="ls-contract-meta"><span>'+L('Deployed ','部署完成 ')+time(p.deployedAt)+'</span><span class="ls-unverified">'+L('Not verified by the platform','平台未核验')+'</span></p></div>';
  }
  /* 签名前的确认里写明本次目标合约，与项目详情所示同一个值。 */
  function targetContract(p){return '<div class="ls-target"><span class="muted">'+L('Target pledge contract','目标质押合约')+' · '+E(D.PLEDGE_CHAIN)+'</span><p class="ls-contract-addr"><span class="mono">'+E(p.contract||'—')+'</span>'+(p.contract?copyIcon(p.contract,L('Copy pledge contract address','复制质押合约地址')):'')+'</p><p class="hint">'+E(txt(p.name))+' · '+E(p.id)+'</p></div>';}
  const tag=k=>CF.tag(['short','failure','timeout','rejected'].includes(k)?'danger':['approved','success','surplus'].includes(k)?'ok':['review','processing','executing'].includes(k)?'warn':'',label(k));
  const note=(s,t='accent')=>CF.note(t==='danger'?'red':t,s);
  const btn=(act,text,value='',primary=false,disabled=false)=>'<button type="button" class="btn'+(primary?' primary':'')+'" data-act="'+act+'" data-v="'+E(value)+'"'+(disabled?' disabled':'')+'>'+text+'</button>';
  const card=(title,body)=>'<section class="card"><div class="card-head"><h2 class="ls-subheading">'+title+'</h2></div><div class="card-b">'+body+'</div></section>';
  const small=s=>'<div class="cell-sub">'+s+'</div>';
  const err=()=>error?'<div class="ls-error" role="alert">'+note(error,'danger')+'</div>':'';
  const path=()=>location.hash.replace(/^#/,'');
  const viewCache={},detailCache={},actionTabs={},actionNodes={};
  let reviewReturn=false,focusReview=false,railExpanded=false,tokenView='list';
  const expandedRecords=new Set();let reviewScroll=0;
  let listRoute='/marketplace';
  function readFilters(route){const q=new URLSearchParams(route.split('?')[1]||'');const v={};['currency','tenor','keyword','type','vmin','vmax','amin','amax','status','quote','coverage','sort'].forEach(k=>{if(q.has(k))v[k]=q.get(k);});return v;}
  function savePosition(){const box=document.querySelector('#content .listbox');if(S.page===LIST&&box)viewCache[listRoute]={shown:S.shown,top:box.scrollTop,y:window.scrollY,focus:document.activeElement?.closest('.ls-project-row')?.dataset.v||viewCache[listRoute]?.focus||''};}
  // A local list snapshot also survives refresh and opening a detail in a new context.
  function listSnapshot(){savePosition();const c=viewCache[listRoute]||{},q=new URLSearchParams(listRoute.split('?')[1]||'');[['shown',c.shown],['scroll',c.top],['pageScroll',c.y],['focus',c.focus]].forEach(([k,v])=>{if(v)q.set(k,v);else q.delete(k);});return '/marketplace'+(q.size?'?'+q:'');}
  function listState(){const q=new URLSearchParams(listRoute.split('?')[1]||''),num=(k,max)=>Math.min(max,Math.max(0,Number(q.get(k))||0));return {shown:Math.max(20,num('shown',2000)),top:num('scroll',100000),y:num('pageScroll',100000),focus:q.get('focus')||''};}
  function writeFilters(){const q=new URLSearchParams();Object.keys(filter).forEach(k=>{if(filter[k])q.set(k,filter[k]);});const target='/marketplace'+(q.size?'?'+q.toString():'');viewCache[target]={shown:20,top:0,y:0};CF.ENTRY[LIST]=target;listRoute=target;if(path()!==target)location.hash='#'+target;CF.resetList();setTimeout(()=>window.scrollTo(0,0),0);}
  function restorePosition(){const c=viewCache[listRoute]||listState();S.shown=c.shown;S.toTop=false;CF.render();const box=document.querySelector('#content .listbox');if(box)box.scrollTop=c.top;window.scrollTo(0,c.y);if(c.focus)(document.querySelector('.ls-project-row[data-v="'+CSS.escape(c.focus)+'"]')||box||document.getElementById('ls-keyword'))?.focus({preventScroll:true});}
  function project(){const m=path().match(/^\/project\/([^?]+)/);try{return m?D.project(decodeURIComponent(m[1]))||null:null;}catch(_){return null;}}
  function syncRoute(){const h=path();if(h==='/project/new')return;if(/^\/project\/[^/?]+/.test(h)){CF.ENTRY[DETAIL]=h;const back=new URLSearchParams(h.split('?')[1]||'').get('return');if(back&&/^\/marketplace(?:\?|$)/.test(back)&&!back.includes('#')){listRoute=back;CF.ENTRY[LIST]=back;}}else if(/^\/marketplace(?:\?|$)/.test(h))CF.ENTRY[LIST]=h;}
  function goto(id){if(CF.AM)CF.AM.returnDetail=null;if(S.page===LIST){savePosition();viewCache[listRoute]=Object.assign({shown:20,top:0,y:0},viewCache[listRoute],{focus:id});const back=listSnapshot();viewCache[back]=viewCache[listRoute];listRoute=back;CF.ENTRY[LIST]=back;history.replaceState(null,'','#'+back);}CF.ENTRY[DETAIL]='/project/'+encodeURIComponent(id)+'?return='+encodeURIComponent(listRoute);location.hash='#'+CF.ENTRY[DETAIL];}
  function showError(ex){error=txt(errors[ex.message]||reasons[ex.message]||['The action could not be completed. Please retry.','操作未完成，请重试。']);}
  function publicMissing(){return CF.empty(L('Content not found or access denied','内容不存在或无权访问'),'',btn('ls-list',L('Back to marketplace','返回借贷广场')));}
  function owner(p){return p.owner==='entity-demo-a'?L('Demo Asset Company A','演示资产企业 A'):L('Demo Asset Company B','演示资产企业 B');}
  function pledgeLabel(p){return p&&D.numbers(p).valid.length?L('Add collateral','追加质押'):L('Start token pledge','发起代币质押');}
  /* 上链前一次讲清：本次发生链上操作、需本人签名、gas 自担且失败不退。 */
  function chainNotice(){return note(L('This sends an on-chain transfer to the project pledge contract. You sign it yourself; gas is paid by your company and is not refunded if the transfer fails.','本次向本项目质押合约发起链上转入，需你本人签名；gas 由本企业承担，上链失败已产生的 gas 同样不退。'),'warn');}
  function pager(key,count){const total=Math.max(1,Math.ceil(count/5));pages[key]=Math.min(pages[key]||1,total);return '<div class="pager"><span class="total">'+L(count+(count===1?' item':' items')+' · 5 per page','共 '+count+' 条 · 每页 5 条')+'</span>'+btn('ls-page','←',key+':'+(pages[key]-1),false,pages[key]===1)+'<span>'+pages[key]+' / '+total+'</span>'+btn('ls-page','→',key+':'+(pages[key]+1),false,pages[key]===total)+'</div>';}
  function field(id,en,zh,value='',type='text',extra=''){return '<div class="field"><label for="'+id+'">'+L(en,zh)+'</label><input class="inp" id="'+id+'" type="'+type+'" value="'+E(value)+'" '+extra+'></div>';}
  function select(id,en,zh,opts,value='',extra=''){return '<div class="field"><label for="'+id+'">'+L(en,zh)+'</label><select class="inp" id="'+id+'" '+extra+'>'+opts.map(o=>'<option value="'+o[0]+'"'+(o[0]===value?' selected':'')+(o[3]?' disabled':'')+'>'+L(o[1],o[2])+'</option>').join('')+'</select></div>';}
  function dataTable(heads,rows,rowAttrs=[]){return '<div class="tablewrap"><table class="tbl resp ls-table"><thead><tr>'+heads.map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map((r,i)=>'<tr'+(rowAttrs[i]||'')+'>'+r.map((c,i)=>'<td data-label="'+E(heads[i])+'"><div class="cell-wrap">'+c+'</div></td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
  function latestExecution(p,t){return [...D.executions].reverse().find(e=>e.project===p.id&&e.token===t.id);}
  function projectTokenList(p){
    const pool=D.numbers(p).pool;if(!D.mine(p))return pool;
    const recent=new Map(D.executions.filter(e=>e.project===p.id).map((e,index)=>[e.token,{...e,order:index}]));
    const extra=D.tokens.filter(t=>{const e=recent.get(t.id);return !pool.includes(t)&&e?.kind==='deposit'&&['processing','failure','noFee'].includes(e.state);});
    return [...pool,...extra].sort((a,b)=>(recent.get(b.id)?.order??-1)-(recent.get(a.id)?.order??-1));
  }
  /* 合约内代币按审核结论与有效性分五类，与总质押额、待审质押额、有效质押额同一口径。 */
  const tokenTones={valid:'accent',review:'violet',rejected:'warn',expired:'gray',frozen:'danger'};
  const tokenNames={valid:['Valid','有效'],review:['Under review','待审核'],rejected:['Rejected · release to retrieve','已驳回 · 待解押'],expired:['Expired','已失效'],frozen:['Reconciliation pending','对账处理中'],released:['Released · awaiting collection','已释放 · 待提取']};
  function tokenState(p,t){
    if(t.pledge==='released')return 'released';
    const a=D.appOf(p,t)?.state;
    if(a==='review')return 'review';if(a==='rejected')return 'rejected';
    if(!t.valid)return 'expired';if(t.frozen||t.pending)return 'frozen';return 'valid';
  }
  function hexMark(tone){return '<svg class="ls-hex" data-tone="'+tone+'" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z"/><path class="core" d="M12 8l3.5 2v4L12 16l-3.5-2v-4z"/></svg>';}
  function tokenTable(list,mode='public',key='tokens'){
    const head=[L('Token / hash','代币 / Hash'),L('Quantity / currency','代币数量 / 币种'),L('Token value','代币价值'),L('Receivable term','底层应收账款账期'),L('Buyer','买方企业'),L('Status','状态')];
    if(mode==='select'||mode==='release')head.unshift(L('Select','选择'));
    if(mode==='own')head.push(L('On-chain execution','链上执行状态'));
    if(!list.length)return CF.empty(L('No tokens available','暂无代币'),mode==='select'?L('No eligible tokens for this entity.','本企业暂无符合条件的代币。'):L('There are no tokens in this list.','当前清单暂无代币。'));
    const tail=pager(key,list.length),start=(pages[key]-1)*5;
    return dataTable(head,list.slice(start,start+5).map(t=>{
      const execution=mode==='own'?latestExecution(project(),t):null,notInPool=mode==='own'&&t.pool!==project().id;
      const pr=project(),st=pr&&(t.pool===pr.id||t.releasedFrom===pr.id)?tokenState(pr,t):(t.valid?'valid':'expired');
      const status=notInPool?(execution?.state==='processing'?L('On-chain processing','上链处理中'):L('Not on chain','未上链')):txt(tokenNames[st]);
      const tone=notInPool?'gray':tokenTones[st]||'gray';
      const row=['<span class="ls-token-id">'+hexMark(tone)+'<span class="mono">'+E(t.id)+'</span></span>'+(t.tx?'<div class="ls-hash-row"><button type="button" class="ls-hash mono" data-act="ls-copy" data-v="'+E(t.tx)+'" title="'+E(t.tx)+'" aria-label="'+L('Copy transaction hash ','复制交易哈希 ')+E(t.tx)+'">'+E(t.tx.slice(0,8))+'…'+E(t.tx.slice(-6))+'</button><a class="ls-explorer" href="https://etherscan.io/tx/'+E(t.tx)+'" target="_blank" rel="noopener noreferrer" title="'+L('Open blockchain explorer','打开区块链浏览器')+'" aria-label="'+L('Open transaction in blockchain explorer (new window)','在区块链浏览器打开交易（新窗口）')+'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M10 5H5v14h14v-5"/></svg></a></div>':''),CF.fmtAmt(t.units)+' '+E(t.symbol),usd(t.value),date(t.from)+' → '+date(t.due),E(txt(t.buyer)),CF.tag(notInPool?'':st==='valid'?'ok':st==='released'||st==='review'?'':'warn',status)];
      if(mode==='select'||mode==='release'){
        const off=mode==='select'?!D.selectable(t,project()):!!(t.frozen||t.pending);
        row.unshift('<label class="ls-check"><input type="checkbox" data-token="'+E(t.id)+'" '+(selection.includes(t.id)?'checked ':'')+(off?'disabled ':'')+'aria-label="'+L('Select ','选择 ')+E(t.id)+'"><span>'+L('Select','选择')+'</span></label>'+(off?small(t.application?L('Reserved by ','已被申请占用 ')+E(t.application):t.pending?L('On-chain processing','链上处理中'):L('Reconciliation pending','对账处理中')):''));
      }
      if(mode==='own')row.push(execution?tag(execution.state)+(execution.boundary?small(L('Result received · allocation pending verification','已收到结果 · 归属待核实')):'')+(['failure','noFee'].includes(execution.state)?small(execution.fee?L('Incurred fee: ','已产生费用：')+Number(execution.fee).toFixed(6)+' '+E(execution.feeCurrency):L('No fees incurred','未产生费用')):''):tag(t.pending?'processing':'success'));
      return row;
    }))+tail;
  }
  /* 更多筛选与主筛选条同一套控件：多选药丸即时生效，区间输入随「查询」一起提交，不另设应用按钮。 */
  let advancedOpen=false,marketView='cards';
  function advancedFilters(){
    const fm=(id,label,opts,cur)=>CF.filterMenu(id,label,opts,String(cur||'').split(',').filter(Boolean));
    const range=(label,minId,maxId,minV,maxV)=>'<span class="fb-range"><span class="fb-label">'+label+'</span>'+
      '<input class="inp" id="'+minId+'" type="number" min="0" inputmode="numeric" placeholder="'+L('Min','最小')+'" aria-label="'+label+' · '+L('minimum','最小')+'" value="'+E(minV||'')+'">'+
      '<span class="fb-dash" aria-hidden="true">–</span>'+
      '<input class="inp" id="'+maxId+'" type="number" min="0" inputmode="numeric" placeholder="'+L('Max','最大')+'" aria-label="'+label+' · '+L('maximum','最大')+'" value="'+E(maxV||'')+'"></span>';
    return '<div class="filterbar ls-advanced-filters">'+
      fm('ls-type',L('Token type','代币类型'),D.TYPES.map(x=>[x.id,txt(x.label)]),filter.type)+
      fm('ls-coverage',L('Pledge shortfall','质押不足'),[['yes',L('Yes','是')],['no',L('No','否')]],filter.coverage)+
      range(L('Eligible borrowing limit (USD)','有效质押额（USD）'),'ls-vmin','ls-vmax',filter.vmin,filter.vmax)+
      range(L('Financing request (USD)','融资需求金额（USD）'),'ls-amin','ls-amax',filter.amin,filter.amax)+
      '</div>';}
  /* 筛选、结果数、排序与放大合并成一行工具条；更多筛选收成一个开关，展开时才占第二行。 */
  function filters(total){
    const fm=(id,label,opts,cur)=>CF.filterMenu(id,label,opts,String(cur||'').split(',').filter(Boolean));
    const moreKeys=['type','coverage','vmin','vmax','amin','amax'],moreCount=moreKeys.filter(k=>filter[k]).length;
    const moreOpen=advancedOpen||/^filter:ls-(type|coverage)$/.test(S.menu||'');
    return '<div class="filterbar ls-primary-filters ls-toolbar">'+
    fm('ls-currency',L('Currency','币种'),[['USD','USD']],filter.currency)+
    fm('ls-tenor',L('Tenor','期限'),[['60',L('60 days','60 天')],['90',L('90 days','90 天')],['120',L('120 days','120 天')]],filter.tenor)+
    fm('ls-status',L('Project status','项目状态'),['raising','locked','financing','closed','settled'].map(k=>[k,txt(stateNames[k])]),filter.status)+
    fm('ls-quote',L('Open for quotes','可报价'),[['yes',L('Yes','是')],['no',L('No','否')]],filter.quote)+
    sortControl()+
    '<button type="button" class="ls-more-toggle" data-act="ls-more" aria-expanded="'+moreOpen+'" aria-controls="ls-more-panel">'+L('More','更多筛选')+(moreCount?'<span class="ls-more-count">'+moreCount+'</span>':'')+'<span class="ls-more-car" aria-hidden="true"></span></button>'+
    CF.filterSearch('ls-keyword',L('Project, request or publisher','项目、需求或发布方'),filter.keyword||'',
      L('Project name, request ID or project publisher','融资项目、需求编号或项目发布方'))+
    '<div class="fb-acts">'+
    btn('ls-clear',L('Reset','重置'))+btn('ls-filter',L('Search','查询'),'',true)+'</div>'+
    '</div>'+
    (moreOpen?'<div class="ls-more-panel" id="ls-more-panel">'+advancedFilters()+'</div>':'');}
  function requestInfo(p){const d=D.current(p);return {d,amount:d?d.amount:null,currency:'USD',tenor:d?.tenorDays,rate:d?.rate,updated:D.events.find(e=>e.project===p.id)?.at||d?.at||p.published};}
  function matching(){return D.projects.filter(p=>!['review','returned','available'].includes(p.state)||Q&&Q.hasHistory(p)).filter(p=>{
    const n=D.numbers(p),d=D.current(p),amount=d?d.amount:0,open=Q?Q.quoteAvailable(p):d&&d.state==='open'&&!p.expired&&n.grade==='surplus';
    const info=requestInfo(p);
    const within=(sel,value)=>{const l=String(sel||'').split(',').filter(Boolean);return !l.length||l.includes(String(value));};
    if(!within(filter.currency,info.currency)||!within(filter.tenor,info.tenor))return false;
    if(filter.keyword&&!([p.id,info.d?.id,...p.name,owner(p)].join(' ').toLowerCase().includes(filter.keyword.trim().toLowerCase())))return false;
    if(!within(filter.status,p.state))return false;
    if(!within(filter.type,p.kind))return false;
    if(filter.vmin&&n.limit<+filter.vmin||filter.vmax&&n.limit>+filter.vmax||filter.amin&&amount<+filter.amin||filter.amax&&amount>+filter.amax)return false;
    if(!within(filter.quote,open?'yes':'no'))return false;
    if(!within(filter.coverage,n.grade==='short'?'yes':'no'))return false;
    return true;
  }).sort((a,b)=>filter.sort==='total'?D.numbers(b).total-D.numbers(a).total:filter.sort==='amount'?((D.current(b)||{}).amount||0)-((D.current(a)||{}).amount||0):Date.parse(b.published||b.created)-Date.parse(a.published||a.created));}
  function quoteReason(p){const n=D.numbers(p),d=D.current(p);return S.role==='asset'?L('Asset holders cannot submit quotes.','资产方不可提交报价。'):n.grade==='short'?L('Pledge shortfall','质押不足'):p.expired?L('Project term expired','项目已到期'):d&&d.state==='quoted'?L('An active quote already exists','已有在途报价'):L('This request is not open for quotes','当前需求不可报价');}
  function listColumns(){return [L('Network','网络'),L('Financing project','融资项目'),L('Project publisher','项目发布方'),L('Eligible borrowing limit','有效质押额'),L('Current request','当前融资需求'),L('Pledge sufficiency','质押情况'),L('Project status','项目状态'),L('Published','发布时间')];}
  function projectRow(p){const n=D.numbers(p),r=requestInfo(p),heads=listColumns();
    const money=v=>CF.market.amount(v,'USD');
    const demand=r.d?money(r.amount)+small(tag(r.d.state)):'<span class="muted">'+L('No active request','暂无融资需求')+'</span>';
    const coverage=tag(n.grade)+(n.grade==='short'?small(L('Shortfall ','缺口 ')+usd(n.gap)):'');
    const hue=n.grade==='short'?4:n.grade==='surplus'?2:1;
    const name='<span class="ls-project-name">'+CF.icoChip(txt(p.name),{glyph:CF.ICON.pool,hue:['closed','settled'].includes(p.state)?0:hue,small:true})+'</span>';
    const cells=[CF.market.network(D.PLEDGE_CHAIN),name,E(owner(p)),money(n.limit),demand,coverage,tag(p.state),stampCell(p.published)];
    return '<tr class="ls-project-row" tabindex="0" data-act="ls-detail" data-v="'+E(p.id)+'" aria-label="'+L('Open project: ','打开项目：')+E(txt(p.name))+'">'+cells.map((c,i)=>'<td class="'+(i===0?'mk-network-cell':i===1?'mk-item-cell':[3,4].includes(i)?'ls-num':'')+'" data-label="'+E(heads[i]+(i===7?' ('+(S.tz||'UTC')+')':''))+'"><div class="cell-wrap">'+c+'</div></td>').join('')+'</tr>';
  }
  function listHead(){return '<thead><tr>'+listColumns().map((h,i)=>'<th scope="col" class="'+(i===0?'mk-network-col':[3,4].includes(i)?'ls-num':'')+'">'+h+(i===7?'<span class="ls-table-tz">'+E(S.tz||'UTC')+'</span>':'')+'</th>').join('')+'</tr></thead>';}
  /* 排序只有三种：发布时间倒序（默认）、需求金额、总质押额；总质押额不是列，所以统一放在列表顶部的排序选择里。 */
  function sortControl(){const cur=['amount','total'].includes(filter.sort)?filter.sort:'newest';return '<span class="fb ls-sort"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4.6 2.8v10.4M2.4 10.8l2.2 2.4 2.2-2.4M11.4 13.2V2.8M9.2 5.2l2.2-2.4 2.2 2.4"/></svg><select class="inp" id="ls-sort" aria-label="'+L('Sort','排序')+'"'+(cur!=='newest'?' data-on="1"':'')+'>'+[['newest','Newest first','最新发布'],['amount','Largest request','需求金额最高'],['total','Largest total pledged','总质押额最高']].map(o=>'<option value="'+o[0]+'"'+(o[0]===cur?' selected':'')+'>'+L(o[1],o[2])+'</option>').join('')+'</select></span>';}
  /* 广场汇总：按当前筛选结果实时合计，数字全部来自演示数据，不额外引入口径。 */
  function marketStats(rows,available){
    const open=rows.filter(p=>{const d=D.current(p);return d&&d.state==='open';});
    const demand=open.reduce((n,p)=>n+(D.current(p).amount||0),0),pool=rows.reduce((n,p)=>n+D.numbers(p).limit,0),outstanding=rows.reduce((n,p)=>n+(p.balance||0),0);
    const cell=(k,v,note)=>'<div class="s"><div class="k">'+k+'</div><div class="v">'+(available?v:'—')+'</div><div class="n">'+note+'</div></div>';
    const stats='<div class="stat-strip ls-market-stats">'+
      cell(L('Amount awaiting quotes','待报价需求金额'),CF.market.amount(demand,'USD',{compact:true,icon:true}),L(open.length+' requests awaiting quotes',open.length+' 笔待报价需求'))+
      cell(L('Eligible borrowing limit','有效质押额'),CF.market.amount(pool,'USD',{compact:true,icon:true}),'')+
      cell(L('Outstanding financing','已融资余额'),CF.market.amount(outstanding,'USD',{compact:true,icon:true}),'')+'</div>';
    const parts=[['raising','Fundraising','募集中','accent'],['locked','Locked','已锁定','violet'],['financing','Financing','融资中','info'],['closed','Closed','已关闭','muted'],['settled','Settled','已结清','warn']].map(x=>({key:x[0],label:L(x[1],x[2]),value:rows.filter(p=>p.state===x[0]).length,tone:x[3]}));
    return '<div class="mk-overview">'+stats+(available?CF.market.distribution(L('Projects by status','项目状态分布'),parts,'ls-chart-status',filter.status,L('projects','个项目')):'<div class="mk-distribution muted">'+L('Composition unavailable','构成暂不可用')+'</div>')+'</div>';
  }
  function listPage(){
    const rows=['empty','noresult'].includes(S.st)?[]:matching();
    let content=CF.surface({emptyTitle:L('No financing projects yet','暂无融资项目'),emptyDesc:L('Published projects will appear here.','融资项目发布后会出现在这里。'),backTo:'/marketplace'});
    const counted=content===null;
    if(content===null)content=rows.length?'<div class="tablewrap listbox listbox-contained ls-market-zone" tabindex="0" role="region" aria-label="'+L('Financing projects','融资项目列表')+'"><table class="tbl resp ls-market-table">'+listHead()+'<tbody>'+rows.slice(0,S.shown).map(projectRow).join('')+'</tbody></table>'+CF.moreFoot(rows.length)+'</div>':CF.empty(L('No results match these filters','筛选无结果'),L('Try widening or clearing the filters.','请放宽筛选条件或清空筛选。'),btn('ls-clear',L('Clear filters','清空筛选')));
    return '<div class="ls-market-page"><div class="page-head"><div><h1 class="page-title">'+L('Lending marketplace','借贷广场')+'</h1><p class="page-desc">'+L('Real assets. On-chain collateral. Find your next financing opportunity.','以真实资产为基础，查看质押池与融资机会。')+'</p></div>'+(S.role==='asset'?'<div class="page-actions">'+btn('ls-new',L('Create financing project','创建融资项目'),'',true)+'</div>':'')+'</div>'+marketStats(rows,S.st!=='loading'&&S.st!=='error'&&S.st!=='denied')+'<section class="card listzone" data-view="'+marketView+'">'+filters(counted?rows.length:null)+'<div class="mk-result-head"><h2>'+CF.market.icon('asset')+L('Financing pools','融资项目')+'</h2><div class="mk-result-tools">'+CF.market.views(marketView,'ls-view')+'<span class="ls-total">'+(counted?L(rows.length+' projects','共 '+rows.length+' 个'):'')+'</span>'+fullButton()+'</div></div>'+content+'</section></div>';
  }
  function fullButton(){return '<button class="btn icon" type="button" id="ls-full" data-act="list-full" data-v="ls-full" aria-pressed="'+!!S.listFull+'" title="'+E(S.listFull?L('Exit full window','退出放大'):L('Expand to window','放大到整窗'))+'" aria-label="'+E(S.listFull?L('Exit full window','退出放大'):L('Expand to window','放大到整窗'))+'">'+(S.listFull?CF.ICON.close:CF.ICON.expand)+'</button>';}
  /* 额度六项：沿用原有的开放式数字条（不加卡片框），常驻四项核心数字、整行不折断；总质押额与待审明细收进下方的折叠行。 */
  function stats(p){const n=D.numbers(p),d=D.current(p);
    const parts=tokenParts(p),reviewPart=parts.find(x=>x.key==='review'),rejectedPart=parts.find(x=>x.key==='rejected');
    const money=v=>CF.market.amount(v,'USD');
    const cell=(k,v,note,tone)=>'<div class="s"'+(tone?' data-tone="'+tone+'"':'')+'><div class="k">'+k+'</div><div class="v">'+v+'</div>'+(note?'<div class="n">'+note+'</div>':'')+'</div>';
    const core='<div class="stat-strip ls-stats">'
      +cell(L('Eligible borrowing limit','有效质押额'),money(n.limit),'','accent')
      +cell(L('Current request','本轮融资需求'),d?money(d.amount):'—',d?tag(d.state):L('No active request','暂无需求'))
      +cell(L('Outstanding financing','已融资余额'),money(p.balance),L('not yet repaid','尚未偿还'),p.balance?'pos':'')
      +cell(L('Project pledge ratio','项目质押率'),(Math.round(n.rate*10000)/100)+'%',L('locked at creation','创建时锁定'))
      +'</div>';
    const line=(k,v,sub)=>'<div class="ls-more-row"><span class="k">'+k+'</span><span class="v mono">'+v+'</span><span class="sub">'+(sub||'')+'</span></div>';
    const pending=n.waiting.length;
    const more='<details class="ls-stat-more"><summary>'+L('Total pledged value ','总质押额 ')+'<b class="mono">'+usd(n.total)+'</b><span>·</span><span>'+L(n.pool.length+' shares in the contract','合约内 '+n.pool.length+' 份')+'</span>'+(pending?'<span>·</span><span class="ls-stat-flag">'+L(pending+' pending review',pending+' 份待审')+'</span>':'')+'<span class="ls-stat-car" aria-hidden="true"></span></summary>'
      +'<div class="ls-more-body">'
      +line(L('Pledged pending review','待审质押额'),usd(n.pendingValue))
      +line(L('· Awaiting review','· 审核中'),usd(reviewPart?reviewPart.value:0),L((reviewPart?reviewPart.count:0)+' shares',(reviewPart?reviewPart.count:0)+' 份'))
      +line(L('· Rejected, not yet released','· 已驳回未解押'),usd(rejectedPart?rejectedPart.value:0),L((rejectedPart?rejectedPart.count:0)+' shares',(rejectedPart?rejectedPart.count:0)+' 份'))
      +line(L('Eligible pledged value','有效质押价值'),usd(n.value),L(n.valid.length+' shares',n.valid.length+' 份'))
      +capitalAllocation(p)
      +'</div></details>';
    return '<section class="ls-figures">'+core+more+'</section>';}
  function tokenParts(p){
    const n=D.numbers(p),keys=['valid','review','rejected','expired','frozen'];
    return keys.map(key=>{const list=n.pool.filter(t=>tokenState(p,t)===key);return {key,tone:tokenTones[key],label:txt(tokenNames[key]),count:list.length,value:list.reduce((v,t)=>v+t.value,0)};}).filter(x=>x.count);
  }
  /* 构成视图：分段环 + 六边形代币标记，五类合计等于总质押额。 */
  function ring(parts,total,center,caption){
    const r=58,c=2*Math.PI*r,gap=parts.length>1?3:0;let at=0;
    const arcs=parts.map(x=>{const len=Math.max(0,c*x.value/total-gap);const arc='<circle class="seg" data-tone="'+x.tone+'" cx="80" cy="80" r="'+r+'" stroke-dasharray="'+len.toFixed(2)+' '+(c-len).toFixed(2)+'" stroke-dashoffset="'+(-at).toFixed(2)+'"></circle>';at+=c*x.value/total;return arc;}).join('');
    return '<svg class="ls-ring" viewBox="0 0 160 160" role="img" aria-label="'+E(caption)+'"><circle class="halo" cx="80" cy="80" r="74"></circle><g transform="rotate(-90 80 80)"><circle class="track" cx="80" cy="80" r="'+r+'"></circle>'+arcs+'</g><text class="ls-ring-v" x="80" y="80" text-anchor="middle">'+E(center.value)+'</text><text class="ls-ring-k" x="80" y="99" text-anchor="middle">'+E(center.label)+'</text></svg>';
  }
  function poolChart(p){
    const n=D.numbers(p),parts=tokenParts(p),total=n.total;
    if(!parts.length||!total)return CF.empty(L('No tokens in the contract','合约内暂无代币'),'');
    const pct=v=>(v/total*100).toFixed(1)+'%';
    const rows=parts.map(x=>'<li class="ls-comp-row">'+hexMark(x.tone)+'<span class="ls-comp-name">'+E(x.label)+'<span class="muted">'+L(x.count+(x.count===1?' share':' shares'),x.count+' 份')+'</span></span><span class="ls-comp-val mono">'+usd(x.value)+'</span><span class="ls-comp-bar" aria-hidden="true"><i data-tone="'+x.tone+'" style="width:'+(x.value/total*100).toFixed(2)+'%"></i></span><span class="ls-comp-pct mono">'+pct(x.value)+'</span></li>').join('');
    return '<div class="ls-composition">'+ring(parts,total,{value:pct(n.value),label:L('Eligible','有效占比')},L('Composition of tokens in the pledge contract','质押合约内代币构成'))
      +'<div class="ls-comp-side"><div class="ls-comp-total"><span class="muted">'+L('Total pledged value','总质押额')+'</span><b class="mono">'+usd(total)+'</b></div><ul class="ls-comp-list">'+rows+'</ul></div></div>';
  }
  function tokenViewTabs(){return '<div class="ls-text-tabs" role="tablist" aria-label="'+L('Pledged token view','质押代币视图')+'">'+[['list','List','列表'],['chart','Chart','图表']].map(([k,en,zh])=>'<button type="button" role="tab" data-act="ls-token-view" data-v="'+k+'" aria-selected="'+(tokenView===k)+'" aria-controls="ls-token-view-panel" id="ls-token-tab-'+k+'">'+L(en,zh)+'</button>').join('')+'</div>';}
  function demandTable(p){
    if(!p.demands.length)return CF.empty(L('No financing applications yet','尚未发布融资申请'),'');
    const tail=pager('demands',p.demands.length),list=[...p.demands].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice((pages.demands-1)*5,pages.demands*5);
    return dataTable([L('Application ID','融资申请编号'),L('Amount / currency','申请金额 / 币种'),L('Application status','申请状态'),L('Institution / annual rate','机构 / 年化利率'),L('Published at','发布时间')+' ('+E(S.tz||'UTC')+')'],list.map(d=>{const q=Q?.currentQuote(p,d.id);return ['<span class="ls-demand-link">'+E(d.id)+' ↗</span>','<span class="mono">'+usd(d.amount)+'</span>',tag(d.state)+(d.reason?small(txt(reasons[d.reason])):''),q?E(Q.institution(q.fund))+small(q.rate+' %'):L('No active quote','暂无有效报价'),stampCell(d.at)];}),list.map(d=>' class="ls-financing-row" tabindex="0" data-act="cq-request" data-v="'+E(d.id)+'" aria-label="'+L('Open application ','查看融资申请 ')+E(d.id)+'"'))+tail;
  }
  const applicationAmount=a=>a.tokens.reduce((sum,id)=>sum+(D.token(id)?.value||0),0);
  /* 上链后资产方要处理的只有被驳回、需自助解押取回的代币。 */
  function actionableApplications(p){return D.mine(p)?D.applications.filter(a=>a.project===p.id&&a.state==='rejected'&&D.token(a.tokens[0])?.pool===p.id):[];}
  function todoBadge(count){return count?'<span class="ls-todo" aria-label="'+L(count+' to do',count+' 项待办')+'">'+count+'</span>':'';}
  function operationMetric(title,value){return '<div class="ls-operation-metric"><span class="muted">'+title+'</span><b class="mono">'+value+'</b></div>';}
  /* 三条流程：一次只展开一条。有线性进度的画节点轴，没有的只摆固定操作。 */
  const flowOrder=['financing','repay'];
  const flowNames={global:['Collateral','质押流程'],financing:['Financing','融资流程'],repay:['Repayment','还款流程']};
  function repaySteps(p){
    const avail=CF.L8?.available(p)||[];
    const stage=!avail.length?0:CF.L8?.hasUnsettled?.(p)?1:3;
    return {ended:false,stage,labels:[['Repayment plan','生成还款计划'],['Submit repayment','提交本期还款'],['Funder confirms','资金方确认到账'],['Settled','结清']]};
  }
  function flowSteps(p,key){return key==='financing'?(Q?Q.financeSteps(p):null):key==='repay'?repaySteps(p):null;}
  function flowTodo(p,key){
    const a=D.actions(p),d=D.current(p);
    if(key==='global')return actionableApplications(p).length;
    if(key==='financing')return a.mine&&d?.state==='quoted'?1:0;
    return a.mine&&p.balance?1:0;
  }
  function flowSummary(p,key){
    const n=D.numbers(p),d=D.current(p);
    if(key==='global'){const todo=actionableApplications(p).length,review=n.pool.filter(t=>tokenState(p,t)==='review').length;return todo?L(todo+' rejected · release to retrieve',todo+' 份已驳回待解押'):review?L(review+' under review',review+' 份审核中'):L(n.pool.length+' shares in the contract','合约内 '+n.pool.length+' 份');}
    if(key==='financing')return d?label(d.state):p.demands.length?L('Previous round ended','上一轮已结束'):L('No active request','暂无进行中需求');
    return p.balance?L('Outstanding ','已融资余额 ')+usd(p.balance):L('Starts after disbursement is confirmed','放款到账后生成还款计划');
  }
  function openFlow(p){
    const chosen=actionTabs[p.id];
    if(chosen&&flowOrder.includes(chosen))return chosen;
    if(S.role==='fund')return 'financing';
    return flowOrder.find(k=>flowTodo(p,k))||'financing';
  }
  /* 点选的历史节点只在同一环节内有效；环节一推进（如发布成功）就回到当前环节，不留回看状态。 */
  function pickedNode(p,key,steps){const pick=actionNodes[p.id+':'+key];return pick&&pick.at===steps.stage?pick.i:steps.stage;}
  /* 节点只画点，名称靠悬停浮窗；轴上不写第几步。 */
  function flowAxis(p,key,steps){
    const sel=pickedNode(p,key,steps);
    return '<div class="ls-flow-axis" role="tablist" aria-label="'+L('Flow steps','流程节点')+'">'+steps.labels.map((s,i)=>{
      const state=steps.ended?'':i<steps.stage?'done':i===steps.stage?'now':'';
      const name=txt(s);
      return '<button type="button" class="ls-flow-node'+(state?' '+state:'')+'" role="tab" data-act="ls-node" data-v="'+key+':'+i+'"'
        +' aria-selected="'+(i===sel)+'" tabindex="'+(i===sel?0:-1)+'"><span class="ls-node-pt"></span>'
        +'<span class="ls-node-tip">'+E(name)+'</span></button>';
    }).join('')+'</div>';
  }
  /* 已完成 / 未开始的环节：不编造内容，只说明并把人带到对应清单。 */
  function stepBrief(p,key,steps,i){
    const name=txt(steps.labels[i]),anchor=key==='financing'?(i>=3?'ls-disbursements':'ls-applications'):'ls-repayments';
    const done=i<steps.stage;
    return (key==='financing'?'':'<h3>'+E(name)+CF.tag('',done?L('Completed','已完成'):L('Not started','未开始'))+'</h3>')
      +'<p class="ls-flow-note">'+(done?L('Finished. The result is in the project records.','已完成，结果见项目记录。'):L('Not started yet.','尚未开始。'))+'</p>';
  }
  /* 质押段只放动作：数字与清单都在左侧，这里不重复；驳回待解押时给一条可直接办理的提醒。 */
  function pledgeBody(p){
    const a=D.actions(p),todo=actionableApplications(p).length;
    if(!a.mine)return '<p class="ls-flow-note">'+L('Collateral is managed by the asset holder. Token status is in the pledged token list.','质押由资产方管理，代币状态见左侧质押代币清单。')+'</p>';
    let body='';
    if(['review','returned'].includes(p.state))body+='<p class="ls-flow-note">'+L('Pledging opens once the project is approved and its pledge contract is deployed.','项目审核通过、质押合约部署后即可质押。')+'</p>';
    if(todo)body+='<div class="ls-flow-alert"><span>'+L(todo+' rejected share'+(todo>1?'s':'')+' still in the contract. Release to retrieve.',todo+' 份代币已驳回，仍在合约内，需解押取回。')+'</span></div>';
    if(p.l8ReleasePending)body+='<p class="ls-flow-note">'+L('Collateral release result is not yet available. Collection opens once release is confirmed.','质押释放结果暂未取得，确认已释放后可提取。')+'</p>';
    const terminal=D.terminal(p);
    body+='<div class="ls-actions-stack ls-pledge-action-group" role="group" aria-label="'+L('Pledge actions','质押操作')+'">'
      +(terminal?btn('ls-release',L('Collect released tokens','提取已释放代币'),'',true,!a.withdraw)
        :btn('ls-pledge',L('Add collateral','追加质押'),'',true,!a.pledge)+btn('ls-release',todo?L('Release collateral','解除质押')+todoBadge(todo):L('Release collateral','解除质押'),'',false,!a.withdraw))+'</div>';
    return body;
  }
  function flowPane(p,key){
    const steps=flowSteps(p,key);
    const sel=steps?pickedNode(p,key,steps):0;
    const heading=key==='financing'?'<h3 class="ls-stage-title" data-stage="'+sel+'">'+E(txt(steps.labels[sel]))+(sel!==steps.stage?CF.tag('',sel<steps.stage?L('Completed','已完成'):L('Not started','未开始')):'')+'</h3>':'';
    const summary=key==='financing'&&Q.financeSummary?Q.financeSummary(p,sel):'';
    if(S.role==='guest')return {plain:true,html:heading+summary+(key==='financing'?'':'<h3>'+L('Continue with this project','办理本项目业务')+'</h3>')+'<p class="muted">'+L('Sign in to view actions available to your company.','登录后查看本企业可办理的业务。')+'</p><div class="ls-flow-do">'+btn('signin',L('Sign in now','立即登录'),'',true)+'</div>'};
    if(key==='global')return {plain:true,html:pledgeBody(p)};
    if(sel!==steps.stage)return {plain:false,axis:flowAxis(p,key,steps),html:heading+summary+stepBrief(p,key,steps,sel)};
    const panel=key==='financing'?Q.financePanel(p):(CF.L8?.available(p).length?CF.L8.panel(p):null);
    let html;
    if(panel)html=panel.body+((panel.primary||panel.secondary)?'<div class="ls-flow-do">'+panel.primary+panel.secondary+'</div>':'');
    else html='<h3>'+L('Repayment plan','生成还款计划')+'</h3><p class="ls-flow-note">'+L('No disbursement has been confirmed for this project, so no repayment plan exists yet.','本项目还没有放款到账，还款计划尚未生成。')+'</p>';
    return {plain:false,axis:flowAxis(p,key,steps),html:heading+summary+html};
  }
  function actions(p){
    const open=openFlow(p),todoAll=actionableApplications(p).length+flowOrder.reduce((t,k)=>t+flowTodo(p,k),0);
    const sections=flowOrder.map(key=>{
      const on=key===open,todo=flowTodo(p,key),pane=on?flowPane(p,key):null;
      return '<section class="ls-flow" data-open="'+on+'">'
        +'<button type="button" class="ls-flow-bar" data-act="ls-tab" data-v="'+key+'" id="ls-tab-'+key+'" aria-expanded="'+on+'">'
        +'<span class="t"><b>'+txt(flowNames[key])+'</b><span>'+E(flowSummary(p,key))+'</span></span>'
        +(todo?'<span class="ls-flow-flag">'+L('Action needed','待你处理')+'</span>':'')
        +'<span class="ls-flow-car" aria-hidden="true">'+(on?'▲':'▼')+'</span></button>'
        +(on?'<div class="ls-flow-open'+(pane.plain?' plain':'')+'">'+(pane.plain?'':pane.axis)+'<div class="ls-flow-info">'+pane.html+'</div></div>':'')
        +'</section>';
    }).join('');
    const collateral=D.mine(p)?'<div class="mk-collateral-actions" aria-label="'+L('Collateral actions','质押操作')+'">'+pledgeBody(p)+'</div>':'';
    return '<section class="card ls-operations" data-expanded="'+railExpanded+'"><div class="ls-operations-head"><h2>'+L('Project actions','项目办理')+'</h2>'
      +(todoAll?'<span class="ls-flow-todo"><i aria-hidden="true"></i>'+L(todoAll+' to handle',todoAll+' 项待你处理')+'</span>':'')
      +'<button type="button" class="ls-rail-toggle" data-act="ls-rail-toggle" aria-expanded="'+railExpanded+'" aria-controls="ls-flows">'+(railExpanded?L('Collapse','收起'):L('Expand','展开'))+'</button></div>'
      +collateral+'<div class="ls-flows" id="ls-flows">'+sections+'</div></section>';
  }
  function waitLine(start,days){const elapsed=Math.max(0,Math.floor((D.now()-Date.parse(start))/60000));return '<p class="hint">'+L('Waiting: ','已等待：')+Math.floor(elapsed/60)+L(' h ',' 小时 ')+(elapsed%60)+L(' min.',' 分钟。')+(days?L(' Review deadline: ',' 审核截止：')+time(new Date(Date.parse(start)+days*86400000).toISOString()):'')+'</p>';}
  function resultRows(p,application){const list=D.executions.filter(e=>e.project===p.id&&(application===undefined||e.application===application));if(!list.length)return '';return card(L('Per-share execution results','逐份执行结果'),dataTable([L('Token / operation','代币 / 操作'),L('Result','执行结果'),L('Blockchain fee','链上费用'),L('Next step','下一步')],[...list].reverse().map(e=>{
    const t=D.token(e.token),why=['failure','noFee'].includes(e.state)?L('The transfer was not completed.','代币转移未完成。'):e.state==='processing'?L('The token issuance platform is executing the transfer. This page updates when results arrive.','代币发行平台正在执行，结果回写后本页更新。'):'';
    let next=e.state==='processing'?L('Wait for the result; no new action is available for this token.','请等待结果，该份代币暂不可发起新操作。'):e.late||t.frozen?L('Reconciliation pending. New actions are paused; not counted toward eligible pledged value.','对账处理中，已暂停新操作，不计入有效质押。'):e.state==='success'?e.kind==='deposit'?L('Counted as collateral; manage in Release collateral.','已计入质押，可通过解除质押入口管理。'):L('Returned to the original holding address.','已转回质押前的原持有地址。'):e.kind==='deposit'?L('Available for a new application to this or another project.','可重新提交到本项目或其他项目。'):e.kind==='redeem'?L('Still awaiting collection. You may retry.','仍为待提取，可重新发起。'):L('Still in the pool. Reserved value restored; you may retry.','仍在池内，预扣已撤销，可重新发起。');
    return [E(e.token)+small(L({deposit:'Deposit',withdraw:'Withdraw',redeem:'Collect'}[e.kind],{deposit:'入池',withdraw:'撤回',redeem:'提取'}[e.kind])),tag(e.state)+(e.boundary?small(L('Reported result: ','已收到结果：')+label(e.observedResult)+L(' · Awaiting verification of allocation.',' · 归属待核实。')):'')+(why?small(why):'')+(e.state==='processing'?waitLine(e.at,null):small(time(e.done))),e.fee===null?L('Awaiting fee result','费用待回写'):e.fee===0?L('No fees incurred','未产生费用'):Number(e.fee).toFixed(6)+' '+E(e.feeCurrency||'ETH')+small(L('Incurred fees are not refunded.','已产生的费用不退回。')),next+(['failure','noFee'].includes(e.state)&&!t.frozen&&!t.pending?'<div class="ls-block">'+btn(e.kind==='deposit'?'ls-pledge':'ls-release',L('Select again','重新选择'))+'</div>':'')];
  })));
  }
  function reviewLabel(a){return a.reviewState==='approved'?CF.tag('ok',L('Approved','审核通过')):tag(a.reviewState||a.state);}
  function executionFor(a){return [...D.executions].reverse().find(e=>e.application===a.id);}
  function progressLabel(a){const e=executionFor(a),t=D.token(a.tokens[0]);return t.frozen?CF.tag('warn',L('Discrepancy · actions paused','存在差异 · 暂停操作')):e?tag(e.state):a.state==='approved'?CF.tag('ok',L('Ready to deposit','待确认入池')):a.state==='expired'?CF.tag('',L('Deposit permission expired','入池许可已到期')):a.state==='void'?CF.tag('',L('Deposit permission voided','入池许可已作废')):CF.tag('',L('Not started','未发起'));}
  function unavailableReason(a){const t=D.token(a.tokens[0]),e=executionFor(a);if(t.frozen)return L('Discrepancy; new actions are paused.','存在差异，暂停新操作。');if(t.pending||e?.state==='processing')return L('Awaiting execution results.','等待执行结果，暂不可再次操作。');if(e?.state==='success')return L('This application has already succeeded.','本笔已成功，不可重复入池。');return a.state==='review'?L('Awaiting review.','尚未通过审核。'):a.state==='expired'?L('The deposit deadline has passed.','已超过本笔入池截止时间。'):a.state==='void'?txt(reasons[a.reason]||reasons.recheck):a.state==='recorded'?L('Execution ended; submit a new application if eligible.','本次执行已结束，可按资格重新申请。'):L('This token needs to be released back before it can be pledged again.','本份需先自助解押取回后才能重新质押。');}
  function reviewTiming(a){return small(L('On chain: ','上链：')+time(a.submitted))+(a.reviewState==='approved'?small(L('Approved: ','通过：')+time(a.approvedAt)):a.decided?small(L('Reviewed: ','审核：')+time(a.decided)):a.finished?small(L('Ended: ','结束：')+time(a.finished)):'');}
  /* 质押代币清单：一张代币一行、上链时间倒序。本企业资产方另见审核状态与当前去向，可筛选；点开为只读代币详情。 */
  const goingNames={onchain:['On-chain processing','上链处理中'],review:['Awaiting review','待审核'],counted:['Counted as eligible','已计入有效质押额'],release:['Awaiting self-release','待自助解押'],releasing:['Release in progress','解押处理中'],returned:['Released and returned','已解押退回'],collect:['Released · awaiting collection','已释放 · 待提取']};
  const reviewNames={review:['Under review','待审核'],approved:['Approved','审核通过'],rejected:['Rejected','已驳回'],withdrawn:['Withdrawn','已撤回']};
  let tokenFilter={};
  const projectApps=(p,t)=>D.applications.filter(a=>a.project===p.id&&a.tokens.includes(t.id));
  const depositOf=(p,t)=>[...D.executions].reverse().find(e=>e.project===p.id&&e.token===t.id&&e.kind==='deposit');
  function tokenGoing(p,t){
    const e=latestExecution(p,t);
    if(t.pool!==p.id&&t.releasedFrom!==p.id)return e?.kind==='deposit'&&e.state==='processing'?'onchain':projectApps(p,t).length?'returned':null;
    if(t.pledge==='released')return 'collect';
    if(t.pending&&e&&e.kind!=='deposit'&&e.state==='processing')return 'releasing';
    const st=D.appOf(p,t)?.state;return st==='review'?'review':st==='rejected'?'release':'counted';
  }
  const landedAt=(p,t)=>Date.parse(D.appOf(p,t)?.submitted||projectApps(p,t).at(-1)?.submitted||depositOf(p,t)?.at||0);
  function ownTokens(p){
    const inPool=D.tokens.filter(t=>t.pool===p.id&&t.pledge==='pledged'||t.releasedFrom===p.id&&t.pledge==='released');
    const onchain=D.tokens.filter(t=>!inPool.includes(t)&&tokenGoing(p,t)==='onchain');
    const gone=tokenFilter.going==='returned'?D.tokens.filter(t=>!inPool.includes(t)&&!onchain.includes(t)&&tokenGoing(p,t)==='returned'):[];
    return [...inPool,...onchain,...gone].filter(t=>(!tokenFilter.keyword||t.id.toLowerCase().includes(tokenFilter.keyword.trim().toLowerCase()))&&(!tokenFilter.state||(projectApps(p,t).at(-1)?.reviewState||projectApps(p,t).at(-1)?.state)===tokenFilter.state)&&(!tokenFilter.going||tokenGoing(p,t)===tokenFilter.going)).sort((a,b)=>landedAt(p,b)-landedAt(p,a));
  }
  /* 每行是一份质押份额：代币编号 + 该份的持有数量；同一笔代币的不同份额分别成行。 */
  const shortAddr=a=>a?a.slice(0,6)+'…'+a.slice(-4):'—';
  const qty=t=>CF.fmtAmt(t.units)+' '+E(t.symbol);
  function shareQty(list){const by={};list.forEach(t=>{by[t.symbol]=(by[t.symbol]||0)+t.units;});return Object.entries(by).map(([k,v])=>CF.fmtAmt(v)+' '+E(k)).join(' / ')||'—';}
  function tokenCell(t){return '<span class="ls-token-id">'+hexMark(t.valid?'accent':'gray')+'<span><span class="mono">'+E(D.tokenNo(t))+'</span><span class="cell-sub">'+qty(t)+'</span></span></span>';}
  function tokenList(p){
    const mine=D.mine(p),list=mine?ownTokens(p):D.tokens.filter(t=>t.pool===p.id&&t.pledge==='pledged').sort((a,b)=>landedAt(p,b)-landedAt(p,a));
    const options=names=>[['',L('All','全部')],...Object.entries(names).map(([k,v])=>[k,txt(v)])];
    const filters=mine?'<div class="filterbar ls-token-filters">'+CF.filterSelect('ls-tf-state',L('Review','审核状态'),options(reviewNames),tokenFilter.state||'')+CF.filterSelect('ls-tf-going',L('Current status','当前去向'),options(goingNames),tokenFilter.going||'')+CF.filterSearch('ls-tf-keyword',L('Token ID','代币编号'),tokenFilter.keyword||'',L('Token ID','代币编号'))+'<div class="fb-acts">'+btn('ls-tf-reset',L('Reset','重置'))+'</div></div>':'';
    if(!list.length)return filters+CF.empty(Object.values(tokenFilter).some(Boolean)&&mine?L('No matching tokens','筛选无结果'):L('No tokens in the contract','合约内暂无代币'),'');
    const head=[L('Network','网络'),L('Token','代币'),L('Share value','份额价值'),L('Validity','有效性'),L('Counts toward eligible pledged value','计入有效质押')].concat(mine?[L('Review','审核状态'),L('Current status','当前去向')]:[]);
    const tail=pager('tokens',list.length),start=(pages.tokens-1)*5;
    const rows=list.slice(start,start+5).map(t=>{
      const going=mine?tokenGoing(p,t):null,inPool=t.pool===p.id,counted=inPool&&tokenState(p,t)==='valid',a=projectApps(p,t).at(-1),rv=a?(a.reviewState||a.state):null;
      const e=going==='onchain'?latestExecution(p,t):null;
      const cells=[CF.market.network(D.PLEDGE_CHAIN),tokenCell(t),'<span class="mono">'+usd(t.value)+'</span>',CF.tag(t.valid?'':'warn',t.valid?L('Valid','有效'):L('Expired','已失效')),inPool?CF.tag(counted?'ok':'',counted?L('Counted','计入'):L('Not counted','不计入')):'<span class="muted">—</span>'];
      if(mine)cells.push(rv?CF.tag(rv==='approved'?'ok':rv==='rejected'?'danger':rv==='review'?'warn':'',txt(reviewNames[rv])):'<span class="muted">—</span>',E(txt(goingNames[going]))+(e?small(waitText(e.at)):''));
      return '<tr class="ls-token-row" tabindex="0" data-act="ls-token-detail" data-v="'+E(t.id)+'" aria-label="'+L('Open token details ','查看代币详情 ')+E(D.tokenNo(t))+'">'+cells.map((c,i)=>'<td class="'+(i===0?'mk-network-cell':i===2?'ls-token-value':'')+'" data-label="'+E(head[i])+'"><div class="cell-wrap">'+c+'</div></td>').join('')+'</tr>';
    }).join('');
    return filters+'<div class="tablewrap"><table class="tbl resp ls-table ls-token-table"><thead><tr>'+head.map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>'+tail;
  }
  function waitText(start){const m=Math.max(0,Math.floor((D.now()-Date.parse(start))/60000));return L('Waiting ','已等待 ')+(m>=1440?Math.floor(m/1440)+L(' d ',' 天 '):'')+Math.floor(m%1440/60)+L(' h ',' 小时 ')+(m%60)+L(' min',' 分钟');}
  /* 代币详情：只读，无办理动作。代币信息对所有可见方；审核、上链事实、去向与历史只对本企业资产方。 */
  function tokenDetail(id){
    const p=project(),t=D.token(id),mine=D.mine(p);if(!p||detailScope(p)!=='full')return publicMissing();
    if(!p||!t||!(t.pool===p.id||t.releasedFrom===p.id||mine&&(tokenGoing(p,t)))) return publicMissing();
    const inPool=t.pool===p.id,counted=inPool&&tokenState(p,t)==='valid';
    const dl=rows=>'<dl class="ls-dl">'+rows.map(([k,v])=>'<div><dt>'+k+'</dt><dd>'+v+'</dd></div>').join('')+'</dl>';
    const section=(title,body)=>'<section class="ls-detail-sec"><h3>'+title+'</h3>'+body+'</section>';
    const hash=t.tx?'<span class="ls-contract-addr"><span class="mono">'+E(t.tx)+'</span>'+copyIcon(t.tx,L('Copy transaction hash','复制交易哈希'))+CF.linkOut('https://etherscan.io/tx/'+encodeURIComponent(t.tx),L('Open transaction in blockchain explorer (new window)','在区块链浏览器打开交易（新窗口）'))+'</span>':'—';
    let html=section(L('Token information','代币信息'),dl([[L('Token ID','代币编号'),'<span class="mono">'+E(D.tokenNo(t))+'</span>'],[L('Pledged quantity','质押数量'),qty(t)],[L('Share value','份额价值'),usd(t.value)]].concat(t.tokenUnits&&t.tokenUnits!==t.units?[[L('Token total','该笔代币数量 / 价值'),CF.fmtAmt(t.tokenUnits)+' '+E(t.symbol)+' · '+usd(t.tokenValue)]]:[]).concat(mine?[[L('Original holding address','原持有地址'),'<span class="mono ls-break">'+E(D.holderOf(t))+'</span>']]:[]).concat([[L('Validity','有效性'),t.valid?L('Valid','有效'):L('Expired','已失效')],[L('Counts toward eligible pledged value','计入有效质押'),inPool?(counted?L('Counted','计入'):L('Not counted','不计入')):'—'],[L('Receivable term','底层应收账款账期'),date(t.from)+' → '+date(t.due)],[L('Buyer','买方企业'),E(txt(t.buyer))],[L('Pledge contract','所在质押合约'),'<span class="mono ls-break">'+E(p.contract||'—')+'</span>'],[L('Transaction hash','交易 Hash'),hash]])));
    if(!mine)return html;
    const apps=projectApps(p,t).sort((a,b)=>Date.parse(b.submitted)-Date.parse(a.submitted)),a=D.appOf(p,t)||apps[0],e=depositOf(p,t),going=tokenGoing(p,t);
    if(a){const rv=a.reviewState||a.state;html+=section(L('Review','本笔审核'),dl([[L('Status','审核状态'),txt(reviewNames[rv]||[rv,rv])],[L('Submitted','提交时间'),time(a.submitted)+(rv==='review'?small(waitText(a.submitted)):'')],[L('Decided','结论时间'),a.decided?time(a.decided):'—'],[L('Reviewer','审核人'),a.reviewer?E(txt(a.reviewer)):'—']].concat(a.reason?[[L('Reason','驳回原因'),E(txt(reasons[a.reason]||[a.reason,a.reason]))]]:[]).concat([[L('Agreement','适用协议'),a.agreement?'<button type="button" class="actlink" data-act="ls-agreement-download" data-v="'+E(a.id)+'">'+E(txt(a.agreement.name))+'</button>':'—']])));}
    html+=section(L('On-chain facts','本笔上链事实'),dl([[L('Started','发起时间'),e?time(e.at):a?time(a.submitted):'—'],[L('Completed','完成时间'),e?.done?time(e.done):e?.state==='processing'?L('Processing','处理中'):a?time(a.submitted):'—'],[L('Actual gas','实际 gas'),e?(e.fee===null?L('To be verified','待核实'):Number(e.fee).toFixed(6)+' '+E(e.feeCurrency||'ETH')):L('To be verified','待核实')],[L('Proof','链上凭证'),hash]]));
    const next={onchain:['Waiting for the on-chain result.','等待上链结果回写。'],review:['Wait for the review result, or withdraw it from Release collateral.','等待审核结果；也可从「解除质押」撤回。'],counted:['Counted as eligible collateral. Withdrawal is limited by the withdrawable limit, from Release collateral.','已计入有效质押额；撤回受可撤回上限约束，从「解除质押」办理。'],release:['Rejected. Release it from Release collateral to get it back.','已驳回，需从「解除质押」自助解押取回。'],releasing:['Release in progress. This updates when the result arrives.','解押处理中，结果回写后更新。'],returned:['Returned to the original holding address.','已退回质押前的原持有地址。'],collect:['Released. Collect it from Collect released tokens.','已释放，可从「提取已释放代币」提取。']}[going];
    html+=section(L('Current status','当前去向'),'<p class="ls-going">'+CF.tag('',txt(goingNames[going]||['—','—']))+'<span>'+(next?txt(next):'')+'</span></p>');
    html+=section(L('History','逐币历史'),apps.length?dataTable([L('Batch','提交批次'),L('Application','单笔标识'),L('Result','结论'),L('Time','时间')],apps.map(x=>['<span class="mono">'+E(x.batch||'—')+'</span>','<span class="mono">'+E(x.id)+'</span>',txt(reviewNames[x.reviewState||x.state]||[x.state,x.state]),time(x.decided||x.finished||x.submitted)])):'<p class="muted">'+L('No submissions yet.','暂无提交记录。')+'</p>');
    return html;
  }
  function tokenHistory(id){const p=project();if(!D.mine(p))return publicMissing();const records=D.applications.filter(a=>a.project===p.id&&a.tokens.includes(id)).sort((a,b)=>Date.parse(b.submitted)-Date.parse(a.submitted));const t=D.token(id);return card(L('Token information','代币信息'),dataTable([L('Amount','金额'),L('Quantity','数量'),L('Receivable term','应收账款账期'),L('Buyer','买方企业')],[[usd(t.value),t.units+' '+E(t.symbol),date(t.from)+' → '+date(t.due),E(txt(t.buyer))]]))+records.map(a=>'<article class="ls-application" id="record-'+E(a.id)+'"><div class="ls-row"><b class="mono">'+E(a.id)+'</b>'+reviewLabel(a)+progressLabel(a)+'</div><p class="hint">'+L('Submission reference: ','提交批次：')+E(a.batch)+'</p>'+reviewTiming(a)+(a.reviewer?'<p>'+L('Reviewer: ','审核人：')+E(txt(a.reviewer))+'</p>':'')+(a.reason?note(E(txt(reasons[a.reason]||[a.reason,a.reason])),['rejected','timeout'].includes(a.state)?'danger':'warn'):'')+(!executionFor(a)?'<p class="hint">'+L('Not started · no blockchain fee incurred.','未发起链上执行 · 未产生链上费用。')+'</p>':'')+(a.agreement?'<div class="ls-row">'+btn('ls-agreement',L('View agreement','查看协议'),a.id)+btn('ls-agreement-download',L('Download agreement','下载协议'),a.id)+(a.state==='expired'||a.state==='void'?small(L('Archived','已存档')):'')+'</div>':'')+(a.state==='review'?waitLine(a.submitted,null):'')+resultRows(p,a.id)+(a.id===D.latest(p,id)?.id?'<div class="ls-row">'+(a.state==='review'?btn('ls-cancel-app',L('Withdraw application','撤回申请'),a.id):D.selectable(t,p)&&!D.terminal(p)?btn('ls-reapply',L('Apply again','重新申请'),t.id):'')+'</div>':'')+'</article>').join('')||CF.empty(L('No application history','暂无申请历史'),'');}
  function agreementText(a){return L('Demonstration agreement — not a signed legal document.','演示协议 — 非真实签署文件。')+'\n\n'+txt(a.agreement.name)+'\n'+L('Project: ','项目：')+txt(D.project(a.project).name)+'\n'+L('Token: ','代币：')+a.tokens[0]+'\n'+L('Application: ','申请：')+a.id+'\n'+L('Asset holder: ','资产方：')+owner(D.project(a.project))+'\n'+L('Approved: ','通过时间：')+time(a.approvedAt);}
  function agreementAction(id,download){const a=D.applications.find(a=>a.id===id);if(!a||!D.mine(D.project(a.project))||!a.agreement)throw Error('permission');if(agreementFail){agreementFail=false;error=L('Unable to load the agreement. Retry when available.','协议加载失败，请重试。');return;}if(download){const url=URL.createObjectURL(new Blob([agreementText(a)],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=a.agreement.id+'.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}else{agreementId=id;open('agreement');}}
  function tokenMark(t){const ownerMark=t.owner==='entity-demo-a'?'A':'B',suffix=t.id.slice(-1);return '<span class="tok-mark" data-hue="'+((Number(suffix)||0)%4+1)+'" aria-hidden="true">'+E(ownerMark+suffix)+'</span>';}
  function reviewListStatus(a){return reviewLabel(a);}
  function currentRows(p){return [...new Set(D.applications.filter(a=>a.project===p.id).flatMap(a=>a.tokens))].map(id=>D.latest(p,id));}
  function filteredRows(p){return currentRows(p).filter(a=>(!reviewFilter.keyword||a.tokens[0].toLowerCase().includes(reviewFilter.keyword.toLowerCase()))&&(!reviewFilter.state||a.reviewState===reviewFilter.state)&&(!reviewFilter.progress||(D.token(a.tokens[0]).frozen?'discrepancy':executionFor(a)?.state==='noFee'?'failure':executionFor(a)?.state||a.state)===reviewFilter.progress)).sort((a,b)=>Date.parse(b.submitted)-Date.parse(a.submitted));}
  function applications(p){
    if(!D.mine(p))return publicMissing();
    const rows=filteredRows(p),opts=[['','All','全部']];
    const filters='<div class="ls-review-filters">'+field('ls-review-keyword','Token ID','代币编号',reviewFilter.keyword||'','search')+select('ls-review-state','Review status','审核状态',opts.concat(['review','approved','rejected','withdrawn'].map(k=>[k,...stateNames[k]])),reviewFilter.state||'')+select('ls-review-progress','Follow-up status','后续情况',opts.concat(['processing','success','failure'].map(k=>[k,...stateNames[k]]),[['discrepancy','Discrepancy','存在差异']]),reviewFilter.progress||'')+'<div class="ls-row ls-review-filter-actions">'+btn('ls-review-filter',L('Filter','筛选'))+btn('ls-review-reset',L('Reset','重置'))+'</div></div>';
    let body=reviewLoad==='loading'?CF.skelTable(3):reviewLoad==='error'?CF.empty(L('Unable to load tokens','代币清单加载失败'),'',btn('ls-review-retry',L('Retry','重试'))):null;
    if(body===null){const total=reviewLoad==='empty'?[]:rows;const tail=pager('review',total.length);body=total.length?dataTable([L('Select','选择'),L('Token','代币'),L('Quantity','数量'),L('Amount','金额'),L('Status','状态'),L('Time ↓','时间 ↓'),L('Agreement','协议')],total.slice((pages.review-1)*5,pages.review*5).map(a=>{const t=D.token(a.tokens[0]),can=['review','rejected'].includes(a.state)&&t.pool===project().id&&!t.pending&&!t.frozen;return ['<label class="ls-check"><input data-deposit-token="'+E(t.id)+'" type="checkbox" aria-label="'+L('Select ','选择 ')+E(t.id)+'" '+(selection.includes(t.id)?'checked ':'')+(can?'':'disabled')+'><span class="sr-only">'+L('Select','选择')+'</span></label>','<button type="button" class="actlink mono tok ls-token-link" data-act="ls-token-history" data-v="'+E(t.id)+'" aria-label="'+L('View token details: ','查看代币详情：')+E(t.id)+'">'+tokenMark(t)+'<span>'+E(t.id)+'</span></button>','<span class="mono">'+CF.fmtAmt(t.units)+'</span>','<span class="mono">'+usd(t.value)+'</span>',reviewListStatus(a),'<span class="cell-sub">'+time(a.submitted)+'</span>',a.agreement?'<button type="button" class="actlink ls-agreement-link" data-act="ls-agreement-download" data-v="'+E(a.id)+'" aria-label="'+L('Download agreement for ','下载协议：')+E(t.id)+'">'+E(txt(a.agreement.name))+'</button>':'—'];}))+tail:CF.empty(L(currentRows(p).length&&reviewLoad!=='empty'?'No matching tokens':'No token applications',currentRows(p).length&&reviewLoad!=='empty'?'筛选无结果':'暂无代币申请'),'');}
    return filters+'<div class="ls-token-list">'+body+'</div>'+err()+resultRows(p,null);
  }
  function feeSnapshot(){return selection.map(id=>({id,...D.quoteFee(id)}));}
  function feeTotals(){const totals={};feeQuote.forEach(f=>totals[f.currency]=(totals[f.currency]||0)+f.amount);return Object.entries(totals).map(([c,n])=>Number(n).toFixed(6)+' '+E(c)).join(' / ')||'—';}
  /* 签名前逐张复核资格：任何一张变化就更新集合，由用户确认后再签名。 */
  function validateDeposit(){
    const p=project(),changes=[];
    selection.forEach(id=>{const t=D.token(id),old=feeQuote.find(f=>f.id===id);
      if(!D.selectable(t,p)){changes.push(D.tokenNo(D.token(id))+' · '+L('No longer eligible for pledge.','已不可质押。'));return;}
      const fee=D.quoteFee(id);if(!old||old.amount!==fee.amount||old.currency!==fee.currency)changes.push(D.tokenNo(D.token(id))+' · '+L('Estimated gas changed.','预估 gas 已更新。'));
    });
    if(changes.length){selection=selection.filter(id=>D.selectable(D.token(id),p));feeQuote=feeSnapshot();confirmationChanges=changes;error='';return false;}
    return selection.length>0;
  }
  const recordLoads={},recordScroll={};
  function recordCard(id,title,render,head){const state=recordLoads[id],body=state==='loading'?CF.skelTable(3):state==='error'?CF.empty(L('Unable to load records','记录加载失败'),'',btn('ls-record-retry',L('Retry','重试'),id)):render();return '<section class="card"><div class="card-head ls-card-head"><h2 class="ls-subheading">'+title+'</h2>'+(head||'')+'</div><div class="card-b" tabindex="0" '+(id==='tokens'?'id="ls-token-view-panel" role="tabpanel" aria-labelledby="ls-token-tab-'+tokenView+'"':'role="region" aria-label="'+E(title)+'"')+' data-record-scroll="'+E(project().id+':'+id+':'+(id==='tokens'?tokenView:'records'))+'">'+body+'</div></section>';}
  CF.LSRecords={setState:(id,state)=>{recordLoads[id]=state;CF.render();}};
  const detailSections=[['ls-pledged-tokens','Pledged tokens','质押代币'],['ls-applications','Financing applications','融资申请'],['ls-disbursements','Disbursements','融资放款'],['ls-repayments','Repayment','还款']];
  function sectionNavigation(){return '<nav class="ls-section-nav" aria-label="'+L('Project sections','项目详情分区')+'">'+detailSections.map(([id,en,zh],i)=>'<button type="button" data-ls-anchor="'+id+'" aria-controls="'+id+'"'+(!i?' aria-current="location"':'')+'>'+L(en,zh)+'</button>').join('')+'</nav>';}
  function syncSectionNavigation(){const nav=document.querySelector('.ls-section-nav');if(!nav)return;const edge=nav.getBoundingClientRect().bottom+24;let active=detailSections[0][0];detailSections.forEach(([id])=>{const el=document.getElementById(id);if(el&&el.getBoundingClientRect().top<=edge)active=id;});if(window.scrollY>0&&window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-3)active=detailSections.at(-1)[0];nav.querySelectorAll('button').forEach(el=>{if(el.dataset.lsAnchor===active)el.setAttribute('aria-current','location');else el.removeAttribute('aria-current');});
    // Reveal the active label on narrow screens without moving the document.
    if(nav.dataset.activeSection!==active||Number(nav.dataset.navWidth)!==nav.clientWidth){nav.dataset.activeSection=active;nav.dataset.navWidth=String(nav.clientWidth);const button=nav.querySelector('[aria-current]'),bounds=nav.getBoundingClientRect(),rect=button?.getBoundingClientRect();if(rect){if(rect.left<bounds.left)nav.scrollLeft-=bounds.left-rect.left;else if(rect.right>bounds.right)nav.scrollLeft+=rect.right-bounds.right;}}
  }
  document.addEventListener('click',e=>{const button=e.target.closest('[data-ls-anchor]');if(!button)return;e.preventDefault();const id=button.dataset.lsAnchor;if(window.innerWidth<=900&&railExpanded){railExpanded=false;CF.render();sizeWorkspace();}const target=document.getElementById(id);target?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});target?.focus({preventScroll:true});});
  function capitalAllocation(p){
    const n=D.numbers(p),total=Math.max(n.limit,p.balance+n.fly);
    if(!total)return '';
    const parts=[{label:L('Outstanding','已融资余额'),value:p.balance||0,tone:'info'},{label:L('In transit','项目在途金额'),value:n.fly||0,tone:'violet'},{label:L('Available','可融金额'),value:n.free||0,tone:'accent'}];
    return '<section class="mk-capital"><h2>'+CF.market.icon('chart')+L('Borrowing limit allocation','融资额度占用')+'</h2><div class="mk-stackbar" role="img" aria-label="'+E(parts.map(x=>x.label+': '+usd(x.value)).join('; '))+'">'+parts.map(x=>'<span data-tone="'+x.tone+'" style="flex-grow:'+x.value+'"></span>').join('')+'</div><div class="mk-legend">'+parts.map(x=>'<div><i data-tone="'+x.tone+'" aria-hidden="true"></i>'+E(x.label)+'<b class="mono">'+usd(x.value)+'</b></div>').join('')+'</div>'+(n.gap?'<p class="hint">'+L('Pledge shortfall: allocation exceeds the eligible borrowing limit.','质押不足：占用超出有效质押额。')+'</p>':'')+'</section>';
  }
  function projectInformation(p){
    const field=(title,value)=>'<div class="ls-fact"><dt>'+title+'</dt><dd>'+value+'</dd></div>';
    return '<section class="card mk-project-info" aria-labelledby="ls-project-info-title"><div class="card-head"><h2 id="ls-project-info-title">'+L('Project information','项目信息')+'</h2></div><dl class="mk-project-info-body ls-facts" tabindex="0" aria-label="'+L('Project information','项目信息')+'">'
      +field(L('Project publisher','项目发布方'),E(owner(p)))
      +field(L('Token type','代币类型'),E(txt(D.type(p.kind).label)))
      +field(L('SPV institution','SPV 机构'),E(txt(p.spv)))
      +field(L('Project term','项目期限'),termText(p))
      +field(L('Settlement currencies','结算币种'),(p.settle||[]).map(c=>CF.market.currency(c)).join(' '))
      +field(p.published?L('Published','发布时间'):L('Created','创建时间'),time(p.published||p.created))
      +'</dl></section>';
  }
  function projectReferences(p){
    return '<div class="mk-project-references"><span class="ls-project-id">'+L('Project ID','项目编号')+' <b class="mono">'+E(p.id)+'</b>'+CF.copyBtn('ls-copy',p.id,L('Copy project ID','复制项目编号'))+'</span><details class="mk-contract-inline"><summary>'+CF.market.icon('chain')+L('Pledge contract','质押合约')+' <span class="mono">'+(p.contract?E(p.contract.slice(0,8)+'…'+p.contract.slice(-6)):L('Pending deployment','待部署'))+'</span></summary><div class="mk-contract-popover">'+contractBlock(p)+'</div></details></div>';
  }
  document.addEventListener('click',e=>{document.querySelectorAll('.ls-detail :is(.mk-contract-inline,.ls-stat-more)[open]').forEach(el=>{if(!el.contains(e.target))el.open=false;});});
  document.addEventListener('keydown',e=>{if(e.key!=='Escape'||S.layer)return;const open=document.querySelector('.ls-detail :is(.mk-contract-inline,.ls-stat-more)[open]');if(open){open.open=false;open.querySelector('summary')?.focus({preventScroll:true});e.preventDefault();}});
  /* 登录未绑定角色：只看项目基本信息，其余区域统一说明仅供资金方查看并给出申请入口。 */
  /* 项目详情按身份划分：游客、登录未绑定角色、其他企业的资产方只看 6 项基本信息，其余区域以一块说明代替；资金方与本企业资产方看完整详情。 */
  function detailScope(p){return S.role==='guest'?'guest':S.role==='signed'?'signed':S.role==='asset'&&!D.mine(p)?'other':'full';}
  function basicDetail(p,scope){
    const row=(k,v)=>'<div class="ls-fact"><dt>'+k+'</dt><dd>'+v+'</dd></div>';
    const lock={guest:[L('Sign in to view the rest of this project','登录后可查看项目的其余信息'),btn('signin',L('Sign in now','立即登录'),'',true)],
      signed:[L('The following information is available to funders only','以下信息仅供资金方查看'),btn('ls-fund-apply',L('Apply to become a funder','申请成为资金方'),'',true)],
      other:[L('This is not your project, so its details are not available','非自身项目，无法查看'),'']}[scope];
    return '<div class="ls-stack ls-detail ls-detail-basic" data-scope="'+scope+'"><div class="ls-detail-head"><span class="tok-mark" aria-hidden="true">AR</span><div><div class="ls-row"><h1 class="page-title">'+E(txt(p.name))+'</h1><span class="mk-title-tags">'+tag(p.state)+'</span></div>'
      +'</div></div>'
      +'<section class="card ls-basic-card" aria-labelledby="ls-basic-title"><div class="card-head"><h2 id="ls-basic-title">'+L('Project information','项目信息')+'</h2></div><dl class="ls-facts">'+row(L('Project ID','项目编号'),'<span class="mono">'+E(p.id)+'</span>')+row(L('Project publisher','项目发布方'),E(owner(p)))+row(L('Token type','代币类型'),E(kindLabel(p.kind)))+row(L('Project term','项目期限'),termText(p))+'</dl></section>'
      +'<section class="card ls-funder-only" aria-labelledby="ls-funder-only-title"><span class="ls-funder-only-ico" aria-hidden="true">'+CF.market.icon('shield')+'</span><h2 id="ls-funder-only-title">'+lock[0]+'</h2>'+lock[1]+'</section></div>';
  }
  function detailPage(){const p=project();if(!p||['review','returned','available'].includes(p.state)&&!D.mine(p)&&!(Q&&Q.hasHistory(p)))return publicMissing();const scope=detailScope(p);if(scope!=='full'){const s0=CF.surface({emptyTitle:L('No project data','暂无项目数据'),emptyDesc:'',backTo:'/marketplace'});return s0!==null?s0:basicDetail(p,scope);}const n=D.numbers(p);let surface=CF.surface({emptyTitle:L('No project data','暂无项目数据'),emptyDesc:'',backTo:'/marketplace'});if(surface!==null)return surface;
    let warning='';if(n.gap)warning=note(L('Pledge gap: ','质押缺口：')+usd(n.gap)+L(' · Additional asset value required: ',' · 需追加资产价值：')+usd(n.gap/n.rate)+L('. Additional collateral must land on chain and pass review before it counts; landing on chain alone does not resolve the shortfall.','。追加质押须先上链再经审核通过才计入有效质押额，上链成功不即时生效。')+'<br>'+L('Triggered: ','触发时间：')+time(p.coverageAt),'warn');
    if(p.state==='review'&&D.mine(p))warning+=note(L('This project is under review. The pledge contract is deployed once it is approved; you cannot pledge or publish yet.','本项目正在审核，通过后由平台部署质押合约；此前不能质押，也不能发布融资需求。'));
    if(p.state==='returned'&&D.mine(p))warning+=note(L('Returned: ','审核退回：')+E(txt(p.reviewReason||['',''])) +' '+btn('ls-amend',L('Amend and resubmit','修改并重新提交'),p.id),'warn');
    if(p.state==='available'&&!n.value&&D.mine(p))warning+=note(L('This project has no valid collateral. Complete a token pledge before publishing a financing request.','本项目暂无有效质押，请先完成代币质押后再发布。'),'warn');
    const information=warning+stats(p)+projectInformation(p)+sectionNavigation()+'<div id="ls-pledged-tokens" class="mk-fixed-panel" tabindex="-1">'+recordCard('tokens',L('Pledged tokens','质押代币清单'),()=>tokenView==='chart'?poolChart(p):tokenList(p),tokenViewTabs())+'</div>'+'<div id="ls-applications" class="mk-fixed-panel" tabindex="-1">'+recordCard('applications',L('Financing applications','融资申请信息'),()=>demandTable(p))+'</div><div id="ls-disbursements" class="mk-fixed-panel" tabindex="-1">'+recordCard('disbursements',L('Financing disbursements','融资放款信息'),()=>CF.L7?.recordTable?CF.L7.recordTable(p):CF.empty(L('No disbursements yet','暂无融资放款'),''))+'</div><div id="ls-repayments" class="mk-fixed-panel" tabindex="-1">'+recordCard('repayments',L('Repayment information','还款信息'),()=>CF.L8?.recordTable?CF.L8.recordTable(p):CF.empty(L('No repayment business yet','暂无还款业务'),''))+'</div>';
    return (CF.AM&&CF.AM.returnDetail?'<a class="btn-link am-back-token" href="'+E(CF.AM.returnDetail)+'">'+L('← Back to token details','← 返回代币详情')+'</a>':'')+'<div class="ls-stack ls-detail'+(!n.pool.length&&!p.demands.length&&!p.balance?' ls-detail-new':'')+'">'+(fromConsole?'<div class="ls-row">'+btn('ls-handoff',L('Return to my console','返回我的控制台'),'console')+'</div>':'')+'<div class="ls-detail-head"><span class="tok-mark" aria-hidden="true">AR</span><div><div class="ls-row"><h1 class="page-title">'+E(txt(p.name))+'</h1><span class="mk-title-tags">'+tag(p.state)+(n.pool.length?tag(n.grade):'')+(p.expired?CF.tag('',L('Expired · existing business continues','已到期 · 存量处理中')):'')+'</span></div>'
      +projectReferences(p)+'</div>'+(D.mine(p)&&!D.terminal(p)?'<div class="mk-project-global-actions">'+btn('ls-close',L('Close project','关闭项目'),'',false,!D.actions(p).close)+'</div>':'')+'</div><div class="portal-cols ls-workspace"><div class="ls-stack ls-detail-main" role="region" aria-label="'+L('Project details','项目详情信息')+'">'+information+'</div><aside class="portal-rail ls-action-rail" aria-label="'+L('Project actions','项目操作')+'">'+actions(p)+'</aside></div></div>';
  }
  function eventNote(e){const a=D.applications.find(a=>a.id===e.application);if(!a)return '';return e.key==='approved'?small(L('Approved: ','通过：')+time(a.approvedAt)):e.key==='reviewTimeout'?small(L('48 hours without a review. No execution or fee; the reservation is released.','48 小时未完成审核。未执行、零费用，申请占用已释放。')):e.key==='rejected'?small(E(txt(reasons[a.reason]||[a.reason,a.reason]))):'';}
  function eventHistory(p){const ev=D.events.filter(e=>e.project===p.id);if(!ev.length)return '';const names={created:['Project created','项目已创建'],submitted:['Application submitted','申请已提交'],approved:['Review approved','审核通过'],rejected:['Review rejected','审核驳回'],applicationWithdrawn:['Application withdrawn','申请已撤回'],reviewTimeout:['Review timed out · no fees','审核超时失败 · 未产生费用'],approvalExpired:['Deposit window expired','入池结论已失效'],executionStarted:['Execution started','已发起执行'],executionSuccess:['Transfer completed','转移完成'],executionFailed:['Transfer failed','转移失败'],recheckFailed:['Pre-execution check failed','入池复核不通过'],reconciliation:['Reconciliation pending','对账处理中'],coverageShort:['Pledge shortfall triggered','质押不足提醒触发'],coverageRestored:['Pledge shortfall resolved','质押不足提醒解除'],demandVoided:['Request expired due to pledge shortfall','融资需求因质押不足失效'],published:['Financing request published','融资需求已发布'],amountEdited:['Request amount changed','需求金额已修改'],demandWithdrawn:['Financing request withdrawn','融资需求已撤下'],businessRelease:['Collateral released · awaiting collection','已业务释放 · 待提取'],closed:['Project closed','项目已关闭'],projectExpired:['Project term expired','项目已到期']};return '<details class="ls-history card"><summary>'+L('Activity history','操作记录')+'</summary><div class="card-b">'+dataTable([L('Time','时间'),L('Event','事件'),L('Reference','关联记录')],ev.map(e=>[time(e.at),txt(names[e.key]||[e.key,e.key])+(e.application?eventNote(e):''),e.application?btn('ls-event-record',E(e.token)+' · '+E(e.application),e.application):E(e.ref)||'—']))+'</div></details>';}
  const kindLabel=id=>txt(D.type(id).label);
  /* 项目期限 = 创建日 ～ 所选到期日：起点只读，终点用日期选择，范围外的日期不可选。 */
  function termField(kindId,back){
    const range=kindId?D.termRange(kindId,back):null,off=!range||range.none||range.empty;
    const help=!range?'':range.none?txt(errors.termCap):range.empty?L('No expiry date can be selected from the original creation date any more. This project cannot be resubmitted; create a new project instead.','按原创建日已没有可选的到期日，本项目不能重新提交，可另建项目。')
      :L('Selectable expiry: ','可选到期日：')+day(range.min)+L(' to ',' 至 ')+day(range.max)+' (UTC)';
    return '<div class="field ls-term-field"><p class="field-label">'+L('Project term *','项目期限 *')+'</p><div class="ls-term"><div class="ls-term-item"><span class="ls-term-label">'+L('Effective date','项目生效日')+'</span><span class="ls-term-start mono">'+(range?day(range.start):'—')+'</span></div><div class="ls-term-item"><label class="ls-term-label" for="ls-expiry">'+L('Expiry date','项目到期日')+'</label>'
      +'<input class="inp" id="ls-expiry" type="date" value="'+E(expiry)+'"'+(range&&!off?' min="'+range.min+'" max="'+range.max+'"':'')+(off?' disabled':'')+' required aria-describedby="ls-expiry-help" aria-label="'+L('Project expiry date','项目到期日')+'"></div></div>'
      +'<p class="hint'+(range&&(range.none||range.empty)?' ls-hint-warn':'')+'" id="ls-expiry-help">'+help+'</p></div>';
  }
  function newPage(){
    if(S.role!=='asset')return publicMissing();
    const noTokens=S.st==='empty',surface=noTokens?null:CF.surface({backTo:'/marketplace'});
    if(surface!==null)return surface;
    const kinds=noTokens?[]:D.kinds(),none=!kinds.length,cfg=D.type(kind||kinds[0]),back=editing?D.project(editing):null;
    const options=none?[['','No token type available','暂无可选代币类型']]:[['','Choose a type','请选择代币类型'],...kinds.map(k=>[k,txt(D.type(k).label),txt(D.type(k).label)])];
    const nameField=field('ls-name','Project name *','项目名称 *',name,'text','maxlength="60" required aria-describedby="ls-name-help"')+'<p class="hint" id="ls-name-help">'+L('1–60 characters','1～60 字符')+'</p>';
    const typeField=select('ls-kind','Token type *','代币类型 *',options,kind,'required'+(none?' disabled':''))+(none?'<p class="hint">'+L('Issue and sync a token for your company first.','请先完成本企业的代币发行与同步。')+'</p>':'');
    const ratioField=field('ls-rate','Pledge ratio (%) *','项目质押率（%）*',rate,'text','inputmode="decimal" required aria-describedby="ls-rate-help"')+'<p class="hint" id="ls-rate-help">'+L('Above 0, up to '+(cfg.maxRate*100)+'%. Locked at creation.','大于 0、不超过 '+(cfg.maxRate*100)+'%，创建后锁定。')+'</p>';
    const currencies='<div class="field"><p class="field-label">'+L('Reference settlement currency *','参考结算币种 *')+'</p><div class="ls-row">'+D.SETTLE.map(c=>'<label class="ls-check"><input type="checkbox" data-settle="'+c[0]+'"'+(settle.includes(c[0])?' checked':'')+'>'+CF.market.currency(c[0])+'</label>').join('')+'</div><p class="hint">'+L('For reference only. Funders may quote in another supported currency.','仅供参考，资金方可使用其他支持币种报价。')+'</p></div>';
    const terms='<section class="ls-readonly-terms"><h2>'+L('Fixed project terms','固定项目条款')+'</h2><div class="mk-form-pair"><div><p class="field-label">'+L('Repayment method','还款方式')+'</p><p class="field-static">'+E(txt(D.REPAY))+'</p></div><div><p class="field-label">'+L('SPV institution','SPV 机构')+'</p><p class="field-static">'+E(txt(D.SPV))+'</p></div></div></section>';
    return '<div class="ls-form ls-stack"><div class="mk-create-header">'+CF.market.currency('ETH')+'<span>'+L('Create → Review → Pledge','创建 → 审核 → 质押')+'</span></div><h1 class="page-title">'+(back?L('Resubmit project','修改并重新提交'):L('Create financing project','创建融资项目'))+'</h1>'+(back&&back.reviewReason?note(L('Returned: ','审核退回：')+E(txt(back.reviewReason)),'warn'):'')+card(L('Project setup','项目信息'),'<div class="mk-form-col">'+nameField+'</div><div class="mk-form-pair"><div class="mk-form-col">'+typeField+'</div><div class="mk-form-col">'+ratioField+'</div></div>'+termField(none?null:kind||kinds[0],back)+currencies+terms)+err()+'<div class="ls-form-foot"><p class="hint">'+L('Submission starts review. No on-chain transaction or fee.','提交后进入审核，不发生链上交易、不产生费用。')+'</p><div class="ls-row">'+btn('ls-create',L('Submit for review','提交审核'),'',true,busy||none||!!(back&&D.termRange(back.kind,back).empty))+btn('ls-list',L('Cancel','取消'))+'</div></div></div>';
  }
  function selectionSummary(){const total=selection.map(D.token).filter(Boolean).reduce((v,t)=>v+t.value,0);return '<div class="ls-selected" role="status">'+L('Selected ','已选 ')+selection.length+L(' shares · ',' 份 · ')+usd(total)+'</div>';}
  function fees(){return '<div class="ls-stack">'+selectionSummary()+dataTable([L('Token','代币'),L('Estimated blockchain fee','预估链上费用')],selection.map(id=>{const f=operation==='deposit'?feeQuote.find(f=>f.id===id):D.quoteFee(id),a=D.latest(project(),id);return [E(id),Number(f?.amount||0).toFixed(6)+' '+E(f?.currency||'ETH')];}))+note(L('Your company pays blockchain fees. Incurred fees are non-refundable, including failed transfers. The platform charges no service fee or advances payment.','链上费用由本企业承担，已产生费用不退，执行失败亦同。平台不收服务费、不代付。'),'warn')+(D.executions.filter(e=>D.now()-Date.parse(e.at)<86400000).length>5?note(L('Frequent on-chain operations incur more fees. Consider submitting tokens together.','频繁链上操作会产生较多费用，建议批量提交。'),'warn'):'')+'</div>';}
  let flowFrames=[],flowOrigin=null,discardLayer=null,publishInitial='',flowRestore=null;
  const publishSnapshot=()=>JSON.stringify([amount]);
  const controlRef=el=>el?.dataset.act?{act:el.dataset.act,v:el.dataset.v}:el?.id?{id:el.id}:null;
  function restoreControl(ref){if(!ref)return;const el=ref.id?document.getElementById(ref.id):document.querySelector('[data-act="'+CSS.escape(ref.act)+'"]'+(ref.v!==undefined?'[data-v="'+CSS.escape(ref.v)+'"]':''));el?.focus({preventScroll:true});}
  function ownLayer(){return !!(S.layer&&l5LayerKeys.includes(S.layer.key));}
  function open(key,type='modal'){
    if(!S.layer){flowOrigin={y:window.scrollY,focus:controlRef(document.activeElement)};flowFrames=[];}
    else if(S.layer.key!==key)flowFrames.push({layer:{...S.layer},top:document.querySelector('#layers .drawer-b, #layers .modal-b')?.scrollTop||0,focus:controlRef(document.activeElement)});
    if(key==='review')focusReview=true;error='';CF.openLayer(type,key);
  }
  function backStep(){const prev=flowFrames.pop();if(!prev){closeFlow();return;}S.layer=prev.layer;flowRestore=prev;error='';}
  function closeFlow(){const origin=flowOrigin;flowOrigin=null;flowFrames=[];discardLayer=null;reviewReturn=false;clearSelection();CF.closeLayer();setTimeout(()=>{if(origin){window.scrollTo(0,origin.y);restoreControl(origin.focus);}},0);}
  function hasEdits(){return S.layer?.key==='publish'&&publishSnapshot()!==publishInitial||['pledge','release','fees','execute'].includes(S.layer?.key)&&selection.length>0&&!(operation==='deposit'&&flowFrames.some(f=>f.layer.key==='review'));}
  function requestClose(){if(hasEdits()){discardLayer={layer:{...S.layer},top:document.querySelector('#layers .drawer-b, #layers .modal-b')?.scrollTop||0,focus:controlRef(document.activeElement)};CF.openLayer('modal','discard');}else closeFlow();}
  function locateRecord(id){setTimeout(()=>{const el=document.getElementById(id);el?.scrollIntoView({block:'start'});el?.focus({preventScroll:true});},0);}

  function clearSelection(){if(selection.length)CF.toast(L('Selection cleared.','已清空勾选。'));selection=[];}
  function returnToReview(){reviewReturn=false;error='';const previous=flowFrames.find(f=>f.layer.key==='review');flowFrames=[];CF.openLayer('modal','review');if(previous)flowRestore=previous;else focusReview=true;}
  function guarded(p){if(!p||!D.mine(p)){CF.toast(txt(errors.permission));return false;}return true;}
  function openPublish(){const p=project();if(!guarded(p))return;const a=D.actions(p);if(!a.edit&&!a.publish){CF.toast(txt(errors.publishChanged));return;}amount=D.current(p)?String(D.current(p).amount):'';publishInitial=publishSnapshot();open('publish');}
  async function createProject(){if(busy)return;error='';
    const cfg=D.type(kind);
    if(!name.trim()||[...name.trim()].length>60){error=txt(errors.name);refocus='ls-name';CF.render();return;}
    if(!kind){error=txt(errors.kind);refocus='ls-kind';CF.render();return;}
    const r=Number(rate);
    if(!/^\d+(\.\d{1,2})?$/.test(rate.trim())||!(r>0&&r<=cfg.maxRate*100)){error=L('Enter a pledge rate above 0 and no more than '+(cfg.maxRate*100)+'%, with at most 2 decimal places.','请输入大于 0、不超过 '+(cfg.maxRate*100)+'% 且最多两位小数的质押率。');refocus='ls-rate';CF.render();return;}
    const range=D.termRange(kind,editing?D.project(editing):null);
    if(range.none){error=txt(errors.termCap);refocus='ls-expiry';CF.render();return;}
    if(range.empty){error=L('No expiry date can be selected any more. Create a new project instead.','已没有可选的到期日，请另建项目。');CF.render();return;}
    if(!expiry||expiry<range.min||expiry>range.max){error=L('Choose an expiry date from '+day(range.min)+' to '+day(range.max)+' (UTC).','请选择 '+day(range.min)+' 至 '+day(range.max)+'（UTC）之间的到期日。');refocus='ls-expiry';CF.render();return;}
    if(!settle.length){error=L('Choose at least one reference settlement currency.','请至少选择一种参考结算币种。');CF.render();return;}
    busy=true;CF.render();await new Promise(x=>setTimeout(x,350));
    try{
      const p=D.createProject({name,kind,rate,expiry,settle},editing?D.project(editing):null);
      name='';kind='';rate='';expiry='';settle=[];editing=null;goto(p.id);
      CF.toast(L('Submitted for review. The contract is deployed once it is approved.','已提交审核，通过后由平台部署本项目质押合约。'));
    }catch(ex){showError(ex);}finally{busy=false;CF.render();}}
  function openPledge(){const p=project();if(!guarded(p))return;if(!D.actions(p).pledge){CF.toast(txt(reasons.closed));return;}selection=[];feeQuote=[];confirmationChanges=[];error='';open('pledge');}
  function openRelease(){const p=project();if(!guarded(p))return;if(!D.actions(p).withdraw){CF.toast(L('Current withdrawable limit: ','当前可撤回上限：')+usd(D.numbers(p).withdraw));return;}selection=[];feeQuote=[];confirmationChanges=[];operation='release';pages.select=1;open('release');}
  function beginDeposit(){if(!guarded(project())||!selection.length)return;operation='deposit';feeQuote=feeSnapshot();confirmationChanges=[];open('fees');validateDeposit();}
  /* 质押办理：勾选与签名同一步。顶部告知随勾选即时更新，签名前一直可见。 */
  /* 可质押份额按持有地址分组；一次签名只能包含同一持有地址的份额。 */
  function pledgeCandidates(p){return D.tokens.filter(t=>D.selectable(t,p)).sort((a,b)=>D.holderOf(a).localeCompare(D.holderOf(b))||b.value-a.value||a.id.localeCompare(b.id));}
  const signAddress=()=>selection.length?D.holderOf(D.token(selection[0])):'';
  function pledgeNotice(p){
    const chosen=selection.map(D.token).filter(Boolean),total=chosen.reduce((v,t)=>v+t.value,0);
    const gas={};chosen.forEach(t=>{const f=D.quoteFee(t.id);gas[f.currency]=(gas[f.currency]||0)+f.amount;});
    const gasText=Object.entries(gas).map(([c,n])=>Number(n).toFixed(6)+' '+E(c)).join(' / ')||'—';
    const cell=(k,v)=>'<div><span class="k">'+k+'</span><b class="v mono">'+v+'</b></div>';
    return '<section class="ls-pledge-notice" role="status" aria-live="polite">'
      +'<div class="ls-pledge-sum">'+cell(L('Selected','已选'),L(chosen.length+(chosen.length===1?' share':' shares'),chosen.length+' 份'))+cell(L('Holding quantity','持有数量'),shareQty(chosen))+cell(L('Share value','份额价值合计'),usd(total))+cell(L('Estimated gas','预估 gas'),gasText)+'</div>'
      +'<div class="ls-pledge-to"><span class="muted">'+L('Signing address','签名地址')+'</span><span class="mono">'+E(signAddress()||'—')+'</span><span class="hint">'+L('One signature covers shares at one address only.','一次签名只能包含同一持有地址的份额。')+'</span></div>'
      +'<div class="ls-pledge-to"><span class="muted">'+L('To pledge contract','转入质押合约')+' · '+E(D.PLEDGE_CHAIN)+'</span><span class="mono">'+E(p.contract||'—')+'</span>'+(p.contract?copyIcon(p.contract,L('Copy pledge contract address','复制质押合约地址')):'')+'</div>'
      +'<p>'+L('You sign this yourself in your wallet. Gas is paid by your company and is not refunded if the transfer fails. Once on chain, tokens count towards Pledged pending review; each counts towards the Eligible borrowing limit, and can support a financing request, only after it passes the platform\'s review.','需你本人在钱包中签名；gas 由本企业承担，上链失败已产生的 gas 不退。上链成功后先计入待审质押额，经平台逐份审核通过后才计入有效质押额、可用于发布融资需求。')+'</p></section>';
  }
  function pledgePicker(p){
    const list=pledgeCandidates(p);
    if(!list.length)return CF.empty(L('No tokens available to pledge','暂无可质押的代币'),L('Tokens issued to your company appear here once synced.','本企业代币同步后会出现在这里。'));
    const addr=signAddress()||D.holderOf(list[0]),group=list.filter(t=>D.holderOf(t)===addr),all=group.every(t=>selection.includes(t.id));
    return '<div class="tablewrap"><table class="tbl ls-pick"><thead><tr><th scope="col" class="ls-pick-check"><label class="ls-check"><input type="checkbox" data-token-all="1"'+(all?' checked':'')+' aria-label="'+L('Select all shares at this address','全选本地址的份额')+'"></label></th><th scope="col">'+L('Token','代币')+'</th><th scope="col">'+L('Holding address','持有地址')+'</th><th scope="col" class="num">'+L('Holding quantity','持有数量')+'</th><th scope="col" class="num">'+L('Share value','份额价值')+'</th><th scope="col">'+L('Receivable due','账期到期')+'</th><th scope="col">'+L('Buyer','买方企业')+'</th><th scope="col">'+L('Validity','有效性')+'</th></tr></thead><tbody>'
      +list.map(t=>{const on=selection.includes(t.id),other=!!signAddress()&&D.holderOf(t)!==signAddress();return '<tr class="ls-pick-row'+(on?' on':'')+(other?' held':'')+'"><td class="ls-pick-check"><label class="ls-check"><input type="checkbox" data-token="'+E(t.id)+'"'+(on?' checked':'')+(other?' disabled':'')+' aria-label="'+L('Select ','选择 ')+E(D.tokenNo(t))+' · '+E(D.holderOf(t))+'"></label></td><td><span class="ls-token-id">'+hexMark('accent')+'<span class="mono">'+E(D.tokenNo(t))+'</span></span></td><td><span class="mono" title="'+E(D.holderOf(t))+'">'+E(shortAddr(D.holderOf(t)))+'</span>'+(other?'<span class="cell-sub">'+L('Another address · sign separately','其他地址 · 需另行签名')+'</span>':'')+'</td><td class="num">'+qty(t)+'</td><td class="num">'+usd(t.value)+'</td><td class="mono">'+E(String(t.due||'').slice(0,10)||'—')+'</td><td>'+E(txt(t.buyer))+'</td><td>'+(t.valid?L('Valid','有效'):L('Expired','已失效'))+'</td></tr>';}).join('')
      +'</tbody></table></div>';
  }
  async function signPledge(){
    const p=project();if(busy||!selection.length||!guarded(p))return;error='';
    if(executionGate==='unavailable'||executionGate==='nogas'){error=executionGate==='unavailable'?L('The wallet is unavailable. Nothing was sent on chain and no gas was incurred; your tokens remain available.','钱包当前不可用，本次未发生链上操作、未产生 gas，代币仍可质押。'):L('Insufficient balance for gas. Nothing was sent on chain and no gas was incurred.','gas 余额不足，本次未发生链上操作、未产生 gas。');CF.render();return;}
    if(executionGate==='recheck'){D.token(selection.at(-1)).valid=false;executionGate='normal';}
    if(executionGate==='feeChange'){D.token(selection.at(-1)).feeEstimate=0.0006;executionGate='normal';}
    if(!validateDeposit()){CF.render();return;}
    busy=true;CF.render();await new Promise(r=>setTimeout(r,600));
    try{if(submitFail)throw Error('submitFailed');D.execute(p,'deposit',selection);selection=[];feeQuote=[];confirmationChanges=[];flowFrames=[];CF.closeLayer();pages.tokens=1;
      setTimeout(()=>{const list=document.getElementById('ls-pledged-tokens');list?.scrollIntoView({block:'start',behavior:'smooth'});list?.focus({preventScroll:true});},0);
      CF.toast(L('Signed and sent. Tokens count towards Pledged pending review once on chain.','已签名发起质押，上链成功后先计入待审质押额。'));}
    catch(ex){error=ex.message==='submitFailed'?L('Signature was not completed. Nothing was sent on chain and no gas was incurred.','签名未完成，本次未发生链上操作、未产生 gas。'):txt(errors[ex.message]||['The action could not be completed. Please retry.','操作未完成，请重试。']);}
    finally{busy=false;CF.render();}
  }
  /* Release uses one selection/signing surface, matching the pledge contract. */
  /* 质押水位：有效质押额低于项目融资余额 + 项目在途金额时，已通过审核的代币（有效抵押物与已失效）一律不能转出；待审、已驳回照常可取回。 */
  const waterHeld=(p,t)=>D.waterLocked(p)&&t.pledge==='pledged'&&D.appOf(p,t)?.state==='approved';
  function releaseCandidates(p){return D.tokens.filter(t=>t.owner===p.owner&&!t.frozen&&!t.pending&&(t.pool===p.id&&t.pledge==='pledged'||t.releasedFrom===p.id&&t.pledge==='released')).sort((a,b)=>b.value-a.value||a.id.localeCompare(b.id));}
  function releaseValue(p){return selection.map(D.token).filter(t=>t&&t.pledge==='pledged'&&t.valid&&D.appOf(p,t)?.state==='approved').reduce((v,t)=>v+t.value,0);}
  function releaseNotice(p){
    const chosen=selection.map(D.token).filter(Boolean),total=chosen.reduce((v,t)=>v+t.value,0),gas={};
    chosen.forEach(t=>{const f=D.quoteFee(t.id);gas[f.currency]=(gas[f.currency]||0)+f.amount;});
    const gasText=Object.entries(gas).map(([c,n])=>Number(n).toFixed(6)+' '+E(c)).join(' / ')||'—';
    const cell=(k,v)=>'<div><span class="k">'+k+'</span><b class="v mono">'+v+'</b></div>';
    return '<section class="ls-pledge-notice ls-release-notice" role="status" aria-live="polite">'+frequentNotice(p)+'<div class="ls-pledge-sum">'
      +cell(L('Selected','已选'),L(chosen.length+(chosen.length===1?' share':' shares'),chosen.length+' 份'))+cell(L('Pledged quantity','质押数量'),shareQty(chosen))+cell(L('Share value','份额价值合计'),usd(total))+cell(L('Estimated gas','预估 gas'),gasText)+'</div>'
      +'<div class="ls-pledge-to"><span class="muted">'+L('Target pledge contract','目标质押合约')+' · '+E(D.PLEDGE_CHAIN)+'</span><span class="mono">'+E(p.contract||'—')+'</span>'+(p.contract?copyIcon(p.contract,L('Copy pledge contract address','复制质押合约地址')):'')+'</div>'
      +'<p>'+L('Tokens return to their original holding address; the destination cannot be changed. You sign in your wallet. Your company pays gas; incurred gas is not refunded if execution fails. Withdrawing a pending token ends its review.','代币转回质押前的原持有地址，不能更改目的地址。需你本人在钱包签名，gas 由本企业承担，执行失败已产生的 gas 不退；撤回待审代币将终结该笔审核。')+'</p>'
      +(D.waterLocked(p)?'<p class="ls-release-held" role="note">'+L('While the pledge water level is unsafe, approved tokens cannot be transferred out. Tokens under review or rejected can still be retrieved.','水位不安全时已通过审核的代币暂不能转出；待审、已驳回的代币仍可取回。')+'</p>':!D.terminal(p)?releaseLimit(p):'')+'</section>';
  }
  /* 拟撤回有效抵押物价值与可撤回上限实时对照；超出时同时给出差额与两条出路。 */
  function releaseLimit(p){
    const chosen=releaseValue(p),limit=D.numbers(p).withdraw,over=Math.max(0,chosen-limit);
    return '<p class="ls-release-limit">'+L('Selected eligible collateral: ','拟撤回有效抵押物价值：')+'<b class="mono">'+usd(chosen)+'</b> · '+L('Withdrawable limit: ','可撤回上限：')+'<b class="mono">'+usd(limit)+'</b>'+(over?' · '+L('Over by: ','超出差额：')+'<b class="mono">'+usd(over)+'</b>':'')+'</p>'
      +(over?'<p class="ls-release-over" role="alert">'+E(txt(errors.withdrawLimit))+'</p>':'');
  }
  /* 24 小时内本项目发起超过 5 次链上操作：只提示 gas 较多，不阻断。 */
  function frequentNotice(p){const recent=D.executions.filter(e=>e.project===p.id&&D.now()-Date.parse(e.at)<86400000).length;return recent>5?'<p class="ls-release-frequent">'+L('You have started '+recent+' on-chain operations for this project in the last 24 hours. Frequent operations cost more gas; consider selecting tokens together.','本项目 24 小时内已发起 '+recent+' 次链上操作，频繁操作会产生较多 gas，建议合并勾选后一次办理。')+'</p>':'';}
  function releasePicker(p){
    const list=releaseCandidates(p);if(!list.length)return CF.empty(L('No tokens available to release or collect','暂无可解除或提取的代币'),'');
    const open=list.filter(t=>!waterHeld(p,t)),all=open.length>0&&open.every(t=>selection.includes(t.id));
    return '<div class="tablewrap"><table class="tbl ls-pick ls-release-pick"><thead><tr><th scope="col" class="ls-pick-check"><label class="ls-check"><input type="checkbox" data-release-all="1"'+(all?' checked':'')+(busy?' disabled':'')+' aria-label="'+L('Select all','全选')+'"></label></th><th scope="col">'+L('Token','代币')+'</th><th scope="col">'+L('Original holding address','原持有地址')+'</th><th scope="col" class="num">'+L('Pledged quantity','质押数量')+'</th><th scope="col" class="num">'+L('Share value','份额价值')+'</th><th scope="col">'+L('Current status','当前状态')+'</th><th scope="col" class="num">'+L('Est. gas','预估 gas')+'</th></tr></thead><tbody>'
      +[...open,...list.filter(t=>waterHeld(p,t))].map(t=>{const on=selection.includes(t.id),f=D.quoteFee(t.id),state=tokenState(p,t),held=waterHeld(p,t);return '<tr class="ls-pick-row'+(on?' on':'')+(held?' held':'')+'"><td class="ls-pick-check"><label class="ls-check"><input type="checkbox" data-token="'+E(t.id)+'"'+(on?' checked':'')+(busy||held?' disabled':'')+' aria-label="'+L('Select ','选择 ')+E(D.tokenNo(t))+' · '+E(D.holderOf(t))+'"></label></td><td><span class="ls-token-id">'+hexMark(tokenTones[state]||'accent')+'<span class="mono">'+E(D.tokenNo(t))+'</span></span></td><td><span class="mono" title="'+E(D.holderOf(t))+'">'+E(shortAddr(D.holderOf(t)))+'</span></td><td class="num">'+qty(t)+'</td><td class="num">'+usd(t.value)+'</td><td>'+E(txt(tokenNames[state]))+(held?'<span class="cell-sub">'+L('Cannot be transferred out while the pledge water level is unsafe','水位不安全，暂不能转出')+'</span>':'')+'</td><td class="num">'+Number(f.amount).toFixed(6)+' '+E(f.currency)+'</td></tr>';}).join('')+'</tbody></table></div>';
  }
  function validateRelease(p){
    const candidates=new Set(releaseCandidates(p).filter(t=>!waterHeld(p,t)).map(t=>t.id)),changes=[];
    selection.forEach(id=>{const old=feeQuote.find(f=>f.id===id);if(!candidates.has(id)){changes.push(D.tokenNo(D.token(id))+' · '+L('No longer available for this operation.','已不可办理本次操作。'));return;}const fee=D.quoteFee(id);if(!old||old.amount!==fee.amount||old.currency!==fee.currency)changes.push(D.tokenNo(D.token(id))+' · '+L('Estimated gas changed.','预估 gas 已更新。'));});
    if(changes.length){selection=selection.filter(id=>candidates.has(id));feeQuote=feeSnapshot();confirmationChanges=changes;error='';return false;}
    if(releaseValue(p)>D.numbers(p).withdraw){error=txt(errors.withdrawLimit);return false;}
    return selection.length>0&&new Set(selection).size===selection.length;
  }
  async function signRelease(){
    const p=project();if(busy||!selection.length||!guarded(p))return;error='';
    if(executionGate==='unavailable'||executionGate==='nogas'){error=executionGate==='unavailable'?L('The wallet is unavailable. Nothing was sent and no gas was incurred.','钱包当前不可用，本次未发起、未产生 gas。'):L('Insufficient balance for gas. Nothing was sent and no gas was incurred.','gas 余额不足，本次未发起、未产生 gas。');CF.render();return;}
    if(executionGate==='recheck'){D.token(selection.at(-1)).frozen=true;executionGate='normal';}
    if(executionGate==='feeChange'){D.token(selection.at(-1)).feeEstimate=0.0006;executionGate='normal';}
    if(!validateRelease(p)){CF.render();return;}
    busy=true;CF.render();await new Promise(resolve=>setTimeout(resolve,600));
    try{
      if(submitFail)throw Error('signatureFailed');
      if(!guarded(p)||!validateRelease(p))return;
      D.execute(p,'release',selection);selection=[];feeQuote=[];confirmationChanges=[];flowFrames=[];closeFlow();pages.tokens=1;tokenView='list';locateRecord('ls-pledged-tokens');
      CF.toast(L('Signed and sent. Await the per-share on-chain results.','已签名发起，请等待逐份链上结果。'));
    }catch(ex){error=ex.message==='signatureFailed'?L('Wallet signature was not completed. Nothing was sent and no gas was incurred; your selection is retained.','钱包签名未完成，本次未发起、未产生 gas；已保留勾选。'):txt(errors[ex.message]||['The operation could not be started. Please retry.','本次未能发起，请重试。']);}
    finally{busy=false;CF.render();}
  }
  const layers={
    executionResult:()=>({title:L('Operation started','操作已发起'),html:resultRows(project()),foot:btn('closelayer',L('Done','完成'),'',true)}),
    discard:()=>({title:L('Discard unsaved changes?','放弃尚未提交的内容？'),html:note(L('Your changes have not been submitted.','当前填写内容尚未提交。'),'warn'),foot:btn('ls-continue-edit',L('Continue editing','继续编辑'))+btn('ls-discard',L('Discard and close','放弃并关闭'),'',true)}),
    review:()=>({title:L('Pledge review','质押审核'),html:'<div class="ls-review-surface ls-stack">'+applications(project())+'</div>',foot:(D.mine(project())?'<span class="ls-review-selected">'+L('Selected: ','已选：')+selection.length+L(' shares',' 份')+'</span>':'')+btn('closelayer',L('Close','关闭'))+(D.mine(project())?btn('ls-release',L('Release selected','解押取回所选'),'',true,!selection.length):'')}),
    tokenHistory:()=>({title:L('Token details','代币详情')+' · '+(D.tokenNo(D.token(historyToken))||historyToken),html:'<div class="ls-medium ls-stack ls-token-detail">'+tokenDetail(historyToken)+err()+'</div>',foot:btn('closelayer',L('Close','关闭'))}),
    agreement:()=>{const a=D.applications.find(a=>a.id===agreementId),allowed=a&&D.mine(D.project(a.project));return {title:L('Pledge agreement','质押协议'),html:'<div class="ls-medium">'+(allowed?'<p class="ls-raw">'+E(agreementText(a))+'</p>':publicMissing())+'</div>',foot:btn('ls-token-history',L('Back to history','返回历史'),a?.tokens[0]||'')};},
    pledgeNotifications:()=>({title:L('Pledge notification preview','质押通知预览'),html:'<div class="ls-wide ls-stack">'+(D.mine(project())?eventHistory(project()).replace('<details ','<details open '):publicMissing())+'</div>',foot:btn('closelayer',L('Close','关闭'))}),
    copy:data=>({title:L('Copy manually','手动复制'),html:'<p>'+L('Automatic copy is unavailable. Select and copy the value below.','自动复制不可用，请选中下方内容手动复制。')+'</p><textarea class="inp ls-raw" readonly aria-label="Hash">'+E(data)+'</textarea>',foot:btn('closelayer',L('Close','关闭'))}),
    pledge:()=>({title:pledgeLabel(project()),html:'<div class="ls-wide ls-stack ls-pledge">'+pledgeNotice(project())+(confirmationChanges.length?note(L('Nothing was sent. These tokens changed and were removed from your selection — check, then sign again:','本次未发起。以下代币资格已变化并已移出选择，请核对后再次签名：')+'<ul>'+confirmationChanges.map(c=>'<li>'+E(c)+'</li>').join('')+'</ul>','warn'):'')+pledgePicker(project())+err()+'</div>',foot:btn('closelayer',L('Cancel','取消'),'',false,busy)+btn('ls-sign-pledge',busy?L('Waiting for wallet signature…','等待钱包签名…'):L('Sign and pledge','签名并发起质押'),'',true,busy||!selection.length)}),
    publish:()=>{const p=project(),d=D.current(p),max=D.numbers(p).free+(d?d.amount:0);return {title:d?L('Edit financing amount','修改融资需求金额'):L('Publish financing request','发布融资需求'),html:'<div class="ls-medium ls-stack"><p>'+L('Available to borrow: ','当前可融金额：')+'<b class="num">'+usd(max)+'</b></p>'+field('ls-amount','Financing request (USD) *','融资需求金额（USD）*',amount,'text','inputmode="decimal" aria-describedby="ls-amount-error" aria-invalid="'+!!error+'"')+'<div class="field"><p class="field-label" id="ls-settle-label">'+L('Reference settlement currency','参考结算币种')+'</p><p class="field-static" role="note" aria-labelledby="ls-settle-label">'+E((p.settle||[]).join(' / '))+(p.settle?.length?'':L('Not provided','未提供'))+'</p><p class="hint">'+L('Set when the project was created and locked to it. For reference only; funders may quote in another supported currency.','随项目创建时确定并锁定，仅供参考，不限制资金方实际报价币种。')+'</p></div>'+'<div id="ls-amount-error">'+err()+'</div>'+note(L('Publishing makes this request public and reserves the amount. The project still expires on ','发布后融资需求将公开并占用额度；项目到期日不变，仍为 ')+day(p.expiry)+' (UTC)'+L('.','。'))+'</div>',foot:btn('closelayer',L('Cancel','取消'))+btn('ls-publish-confirm',L('Confirm','确认'),'',true,busy)};},
    release:()=>{const p=project();return {title:D.terminal(p)?L('Collect released tokens','提取已释放代币'):L('Release collateral','解除质押'),html:'<div class="ls-wide ls-stack ls-release">'+releaseNotice(p)+(confirmationChanges.length?note(L('Nothing was sent. Review the changes, then sign again:','本次未发起。请核对以下变化，再次签名：')+'<ul>'+confirmationChanges.map(c=>'<li>'+E(c)+'</li>').join('')+'</ul>','warn'):'')+releasePicker(p)+err()+'</div>',foot:btn('closelayer',L('Cancel','取消'),'',false,busy)+btn('ls-sign-release',busy?L('Waiting for wallet signature…','等待钱包签名…'):D.terminal(p)?L('Sign and collect','签名并提取'):L('Sign and release','签名并解除质押'),'',true,busy||!selection.length||releaseValue(p)>D.numbers(p).withdraw)};},
    fees:()=>{const deposit=operation==='deposit';return {title:deposit?L('Confirm pledge deposit','确认质押入池'):L('Review operation and fees','核对操作与费用'),html:'<div class="'+(deposit?'ls-medium ls-stack ls-deposit-confirm':'ls-wide ls-stack')+'">'+targetContract(project())+(deposit&&confirmationChanges.length?note(L('Nothing has started. Review these changes and confirm the updated selection:','尚未发起。请核对以下变化，再确认更新后的选择：')+'<ul>'+confirmationChanges.map(c=>'<li>'+E(c)+'</li>').join('')+'</ul>','warn'):'')+fees()+(deposit?operationMetric(L('Total estimated blockchain fees','预估链上费用合计'),feeTotals()):'')+err()+'</div>',foot:btn('closelayer',L('Cancel','取消'),'',false,busy)+btn(deposit?'ls-execute':'ls-second-confirm',busy?L('Starting…','发起中…'):deposit?L('Confirm fees and start deposit','确认费用并发起入池'):L('Continue','继续'),'',true,busy||(deposit&&!selection.length))};},
    execute:()=>({title:L('Confirm blockchain fees','确认链上费用'),html:'<div class="ls-medium ls-stack">'+targetContract(project())+fees()+note(L('Confirm that your company will pay the estimated fees for these tokens.','请确认本企业承担本次代币操作的预估链上费用。'),'warn')+err()+'</div>',foot:btn('closelayer',L('Cancel','取消'))+btn('ls-execute',busy?L('Starting…','发起中…'):L('Confirm and start','确认并发起'),'',true,busy)}),
    close:()=>{const p=project(),n=D.numbers(p),a=D.actions(p);return {title:L('Close project','关闭项目'),html:'<div class="ls-medium">'+(p.deploying?note(txt(errors.deploying),'warn'):a.canClose?note(CF.L8?.available(p).length?L('Closing the project triggers collateral release. Check the confirmed result before collecting tokens.','关闭项目后触发质押释放，请以确认结果为准办理提取。'):L('The project will close and its collateral will be released without fees. Tokens remain in the contract until you collect them; collection incurs blockchain fees.','关闭后即时解除质押占用，不产生费用。代币仍在合约内，需自行提取；提取将产生链上费用。'),'warn'):note(txt(errors.cannotClose)+'<br>'+L('Outstanding financing: ','项目融资余额：')+usd(p.balance)+'<br>'+L('Committed demand: ','项目在途金额：')+usd(n.fly),'danger'))+err()+'</div>',foot:btn('closelayer',L('Cancel','取消'))+btn('ls-close-confirm',L('Confirm close','确认关闭'),'',true,!a.canClose)};},
    endDemand:()=>({title:L('Withdraw financing request','撤下融资需求'),html:note(L('The financing request will no longer accept quotes. Its reserved amount will be released. Existing collateral stays in the pool.','撤下后不再接受报价，释放该需求的在途占用，池内质押保留。'),'warn')+err(),foot:btn('closelayer',L('Cancel','取消'))+btn('ls-end-confirm',L('Confirm withdrawal','确认撤下'),'',true)}),
    cancelApp:()=>({title:L('Withdraw pledge application','撤回质押申请'),html:note(L('Tokens will become available for a new application. No on-chain operation or fees have occurred.','撤回后代币可重新提交质押。未发生链上操作，未产生任何费用。'))+err(),foot:btn('closelayer',L('Cancel','取消'))+btn('ls-cancel-confirm',L('Confirm withdrawal','确认撤回'),'',true)}),
    handoff:data=>({title:L('Continue to the next step','继续办理'),html:'<p>'+L('This action continues in the '+({quote:'quotation',funding:'funding',repay:'repayment',console:'my console'}[data]||'related')+' module.','此操作由'+({quote:'融资报价',funding:'融资放款',repay:'还款',console:'我的控制台'}[data]||'相关')+'模块承接。')+'</p>',foot:btn('closelayer',L('Return','返回'))})
  };
  const l5LayerKeys=Object.keys(layers);
  l5LayerKeys.forEach(key=>{const render=layers[key];layers[key]=data=>{const body=render(data);return {...body,title:body.title+(project()?' · '+project().id:''),html:'<div class="ls-flow">'+body.html+'</div>',foot:(flowFrames.length&&key!=='discard'&&!['application','tokenHistory','agreement'].includes(key)?btn('ls-back',L('Back','返回')):'')+(body.foot||'')};};});
  function footer(){document.getElementById('foot').innerHTML='<div class="ft-in"><p class="ft-mark">Harbour Credit</p><p class="ft-tag">'+L('Cross-border receivables financing on tokenised assets.','基于代币化资产的跨境应收账款融资。')+'</p><nav class="ft-links">'+['Terms','Privacy','Risk disclosure','Contact'].map((t,i)=>'<a href="#" data-act="ls-handoff">'+L(t,['服务协议','隐私声明','风险揭示','联系我们'][i])+'</a>').join('')+'</nav><div class="ft-meta"><span>'+L('Demonstration data — no real companies, amounts or transactions','演示数据 —— 非真实企业、金额或链上交易')+'</span><span>'+E(S.tz||'UTC')+'</span></div></div>';}
  function tools(){if(!S.demo)return;const el=document.getElementById('demoPanel');if(el.querySelector('.ls-review,.cq-guide'))return;const end=el.querySelector('.grp');if(end)end.remove();let box=document.createElement('div');box.className='ls-review';box.innerHTML=select('ls-demo-record','Project record list','项目清单',[['tokens','Pledged tokens','质押代币'],['applications','Applications','融资申请'],['disbursements','Disbursements','融资放款'],['repayments','Repayments','还款信息']],'tokens')+select('ls-demo-record-state','List loading state','清单读取状态',[['default','Default','正常'],['loading','Loading','加载中'],['error','Failed','读取失败']],'default')+'<h5>'+L('External events · review only','外部事件 · 仅供评审')+'</h5>'+select('ls-demo-project','Open project','打开项目',D.projects.filter(p=>p.state!=='draft'||D.mine(p)).map(p=>[p.id,p.name[0],p.name[1]]),project()?.id||D.projects[0].id)+btn('ls-demo-project',L('Open','打开'))+select('ls-demo-application','Review one application','审核单笔', [['','Latest pending','最近待审笔'],...D.applications.filter(a=>a.project===(project()?.id||D.projects[0].id)&&a.state==='review').map(a=>[a.id,a.tokens[0]+' · '+a.id,a.tokens[0]+' · '+a.id])],demoApplication)+'<div class="ls-block ls-row">'+btn('ls-demo-event',L('Approve','审核通过'),'approve')+btn('ls-demo-event',L('Reject','驳回'),'reject')+btn('ls-demo-event',L('+2 days','推进 2 天'),'twoDays')+btn('ls-demo-event',L('+8 days','推进 8 天'),'eightDays')+'</div>'+select('ls-outcome','Execution result','执行结果',[['success','All return success','逐份成功'],['mixed','Two success, one failure','2 成 1 败'],['failure','Execution failed · charged','执行失败 · 已产生费用'],['noFee','Execution failed · no fee','执行失败 · 零费用'],['wait','Await results','等待回写']],outcome)+btn('ls-demo-event',L('Return results','回写结果'),'results')+select('ls-gate','Next execution attempt','下次发起执行',[['normal','Available','正常'],['feeChange','One fee changes at confirmation','确认时一份费用变化'],['expiryChange','One deadline passes at confirmation','确认时一份到期'],['unavailable','Execution entry unavailable','执行入口不可用'],['nogas','Insufficient fee balance','费用余额不足'],['recheck','Recheck failed','复核不通过']],executionGate)+'<div class="ls-row">'+btn('ls-demo-event',L('Late success','迟到成功回写'),'late')+btn('ls-demo-event',L('Token expires','代币失效'),'expire')+btn('ls-demo-event',L('Amount changes','额度变化'),'amountChange')+btn('ls-demo-event',L('Permission rejection','越权写入反馈'),'deniedWrite')+btn('ls-demo-event',L('From my console','从控制台进入'),'fromConsole')+'</div>'+select('ls-review-load','Token list state','代币清单状态',[['default','Default','默认'],['loading','Loading','加载中'],['empty','Empty','空数据'],['error','Load failed','加载失败']],reviewLoad)+'<label class="ls-check"><input type="checkbox" id="ls-agreement-fail" '+(agreementFail?'checked':'')+'>'+L('Agreement load failure','协议读取失败')+'</label>'+'<h5>'+L('Project review · operations side','项目审核 · 运营侧')+'</h5><div class="ls-row">'+btn('ls-demo-project',L('Submit approval · deploying','提交通过 · 部署中'),'submit')+btn('ls-demo-project',L('Approve & deploy','通过并部署'),'approve')+btn('ls-demo-project',L('Deployment failed','部署失败'),'deployFailed')+btn('ls-demo-project',L('Return','退回'),'return')+'</div>'+btn('ls-pledge-notifications',L('Pledge notification preview','质押通知预览'))+'<label class="ls-check"><input id="ls-submit-fail" type="checkbox" '+(submitFail?'checked':'')+'>'+L('Submission failure','提交失败')+'</label><label class="ls-check"><input id="ls-close-race" type="checkbox" '+(closeRace?'checked':'')+'>'+L('Operations approval takes effect before the close','关闭提交时运营的提交通过已先生效')+'</label><p class="why">'+L('Simulated events and fees. Wallet/signature hosting and real cross-platform connections are not implemented. +2 days advances the demo clock; the deadline check runs automatically.','演示事件与费用，未实现钱包签名及真实跨平台连接。推进 2 天只改变演示时钟，到期判定自动运行。')+'</p>'+btn('ls-demo-event',L('Reset demonstration','重置演示数据'),'reset');el.appendChild(box);}
  async function copyHash(value){try{if(navigator.clipboard)await navigator.clipboard.writeText(value);else{const input=document.createElement('textarea');input.value=value;input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();const ok=document.execCommand('copy');input.remove();if(!ok)throw Error('copy');}CF.toast(!/^0x/.test(value)?L('Copied.','已复制。'):value.length===42?L('Address copied.','地址已复制。'):L('Hash copied.','哈希已复制。'));}catch(_){CF.openLayer('drawer','copy',value);}}
  function saveDetail(){document.querySelectorAll('[data-record-scroll]').forEach(el=>{recordScroll[el.dataset.recordScroll]=el.scrollTop;});if(S.layer&&['pledge','release','review','fees','execute','agreement','cancelApp','pledgeNotifications'].includes(S.layer.key)&&!D.mine(project())){S.layer=null;selection=[];}const panel=document.querySelector('.ls-flow-open');if(panel)detailCache[panel.dataset.project+':'+panel.dataset.tab]=panel.scrollTop;if(S.layer?.key==='review'){document.querySelectorAll('[data-record]').forEach(el=>{if(el.open)expandedRecords.add(el.dataset.record);else expandedRecords.delete(el.dataset.record);});reviewScroll=document.querySelector('#layers .drawer-b, #layers .modal-b')?.scrollTop||0;}}
  function restoreDetail(){document.querySelectorAll('[data-record-scroll]').forEach(el=>{el.scrollTop=recordScroll[el.dataset.recordScroll]||0;});const panel=document.querySelector('.ls-flow-open'),p=project();if(panel&&p){const k=openFlow(p);panel.dataset.project=p.id;panel.dataset.tab=k;panel.scrollTop=detailCache[p.id+':'+k]||0;}sizeWorkspace();if(flowRestore){const previous=flowRestore;flowRestore=null;setTimeout(()=>{const body=document.querySelector('#layers .drawer-b, #layers .modal-b');if(body)body.scrollTop=previous.top;restoreControl(previous.focus);},0);}}
  function sizeWorkspace(){const box=document.querySelector('.ls-workspace');if(!box)return;const headerHeight=document.querySelector('.portal-head')?.getBoundingClientRect().height||68;const top=headerHeight+12;box.style.setProperty('--ls-rail-top',top+'px');const rail=box.querySelector('.ls-action-rail');const pinnedRail=rail&&['sticky','fixed'].includes(getComputedStyle(rail).position);const anchorTop=headerHeight+(window.innerWidth<=900&&pinnedRail?rail.getBoundingClientRect().height+8:0);box.style.setProperty('--ls-section-top',anchorTop+'px');const nav=box.querySelector('.ls-section-nav');if(nav)box.style.setProperty('--ls-section-height',nav.getBoundingClientRect().height+'px');syncSectionNavigation();const contract=rail?.querySelector('.ls-contract-card')?.getBoundingClientRect().height||0;if(rail)box.style.setProperty('--ls-rail-room',Math.max(190,window.innerHeight-top-16-(contract?contract+12:0))+'px');}
  window.addEventListener('resize',sizeWorkspace);
  let scrollFrame=false;window.addEventListener('scroll',()=>{if(!scrollFrame){scrollFrame=true;requestAnimationFrame(()=>{sizeWorkspace();scrollFrame=false;});}},{passive:true});
  function enhance(){const modal=document.querySelector('#layers .modal:has(.ls-flow,.cq-flow,.ln-drawer,.ln-confirm,.rp-drawer,.rp-confirm)');if(modal&&!modal.querySelector('.ls-modal-close')){const close=document.createElement('button');close.className='btn ghost sm ls-modal-close';close.dataset.act='closelayer';close.type='button';close.setAttribute('aria-label',L('Close','关闭'));close.textContent='×';modal.querySelector('.modal-h')?.append(close);}if(CF.AM && ![LIST,DETAIL,NEW].includes(S.page))return;
    /* 详情里打开的只读详情与办理层同样带上本项目质押合约；签名确认层已在正文写明目标合约。 */
    const lp=S.page===DETAIL?project():null,layerBody=document.querySelector('#layers .drawer-b, #layers .modal-b');
    if(lp&&lp.contract&&layerBody&&S.layer&&!['discard','copy','handoff','pledge','release','fees','execute','tokenHistory'].includes(S.layer.key)&&!layerBody.querySelector('.ls-layer-contract'))layerBody.insertAdjacentHTML('afterbegin','<div class="ls-layer-contract"><span class="muted">'+L('Pledge contract','质押合约')+' · '+E(D.PLEDGE_CHAIN)+'</span><span class="mono">'+E(lp.contract)+'</span>'+copyIcon(lp.contract,L('Copy pledge contract address','复制质押合约地址'))+'</div>');footer();tools();if(Q){Q.enhance();Q.organizeTools();}document.getElementById('portal').inert=!!S.layer;sizeWorkspace();if(focusReview&&S.layer?.key==='review'){const heading=document.querySelector('#layers .drawer-h, #layers .modal-h');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});document.querySelector('#layers .drawer-b, #layers .modal-b').scrollTop=0;}focusReview=false;}else if(S.layer?.key==='review'){const body=document.querySelector('#layers .drawer-b, #layers .modal-b');if(body)body.scrollTop=reviewScroll;}document.querySelectorAll('.nav-item').forEach(a=>{if(a.getAttribute('href')==='#/marketplace'&&[LIST,DETAIL,NEW].includes(S.page))a.setAttribute('aria-current','page');});if(!document.querySelector('.ls-demo-mark')){const el=document.createElement('p');el.className='ls-demo-mark';el.textContent=L('Demonstration data','演示数据');document.getElementById('content').prepend(el);}if(refocus){document.getElementById(refocus)?.focus({preventScroll:true});refocus=null;}sizeWorkspace();}
  function externalEvent(value){const p=project()||D.projects[0];if(value==='reset'){reviewLoad='default';reviewFilter={};demoApplication='';agreementFail=false;executionGate='normal';D.seed();S.layer=null;selection=[];location.hash='#/marketplace';return;}
    if(value==='approve'||value==='reject'){if(!D.review(p,value,demoApplication))CF.toast(L('No pending application in this project.','本项目暂无待审核申请。'));}
    if(value==='twoDays'||value==='eightDays')D.offset+=(value==='twoDays'?2:8)*86400000;
    if(value==='results'){D.executions.filter(e=>e.project===p.id&&e.state==='processing').forEach((e,i)=>{if(outcome!=='wait')D.result(e,outcome==='mixed'?(i%3===2?'failure':'success'):outcome);});}
    if(value==='late'){const e=[...D.executions].reverse().find(e=>e.project===p.id&&['failure','noFee'].includes(e.state));if(e)D.result(e,'late');else CF.toast(L('First demonstrate an execution failure.','请先演示执行失败。'));}
    if(value==='expire'||value==='amountChange'){const t=D.numbers(p).valid.at(-1);if(t){t.valid=false;D.recompute(p);}if(value==='amountChange')CF.toast(L('Available amounts have been refreshed.','额度已变化，请核对最新数值。'));}
    if(value==='fromConsole'){fromConsole=true;try{sessionStorage.setItem('hc-ls-origin','console');}catch(_){}goto(p.id);}
    if(value==='deniedWrite')CF.toast(txt(errors.permission));D.sweep();D.save();
  }

  [LIST,DETAIL,NEW].forEach(id=>CF.review.register(id, {
    group:['Lending marketplace','借贷广场'],
    scenarios:()=>id!==DETAIL?[]:[
      ['collateral',['Collateral overview','质押概览'],'global',p=>!D.terminal(p)],
      ['publish',['Ready to publish a request','待发布融资需求'],'financing',p=>!D.current(p)&&D.actions(p).publish],
      ['quotes',['Awaiting quotes','待机构报价'],'financing',p=>D.current(p)?.state==='open'],
      ['respond',['Awaiting quote confirmation','待确认报价'],'financing',p=>D.current(p)?.state==='quoted'],
      ['disburse',['Awaiting disbursement','待放款'],'financing',p=>Q?.data().quotes.some(q=>q.project===p.id&&q.l7?.state==='pending')],
      ['receipt',['Awaiting receipt confirmation','待放款确认'],'financing',p=>Q?.data().quotes.some(q=>q.project===p.id&&q.l7?.state==='waiting')],
      ['repaying',['Repayment in progress','还款中'],'repay',p=>Q?.data().quotes.some(q=>q.project===p.id&&q.l8&&!q.l8.settledAt)],
      ['settled',['Financing settled','已结清'],'global',p=>p.state==='settled'],
      ['closed',['Project closed','项目已关闭'],'global',p=>p.state==='closed']
    ].map(([key,label,tab,match])=>{
      const p=D.projects.find(p=>(S.role!=='asset'||D.mine(p))&&match(p));
      const privateStage=['respond','disburse','receipt','repaying'].includes(key),allowed=!privateStage||['asset','fund'].includes(S.role);
      return {id:key,label,available:!!p&&allowed,route:p?'/project/'+p.id:null,
        description:!allowed?['Choose an asset holder or funder identity','请先选择资产方或资金方身份']:p?['Existing project · '+p.id,'已有项目 · '+p.id]:['No matching project; use the existing flow to create one','暂无对应项目，可通过既有业务流程产生'],
        enter(){if(p){actionTabs[p.id]=tab;railExpanded=true;delete actionNodes[p.id+':'+tab];}}};
    }),
    states:id===LIST?['default','loading','empty','noresult','error','denied']:['default','loading','empty','error','denied'],
    route:()=>id===LIST?'/marketplace':id===NEW?'/project/new':'/project/'+D.projects.find(p=>!['review','returned','available'].includes(p.state)).id,
    beforeChange(proceed){if(busy||S.layer){CF.toast(L('Finish or cancel the current operation first.','请先完成或取消当前操作。'));return;}proceed();},
    reset(){S.st='default';reviewLoad='default';agreementFail=false;submitFail=false;closeRace=false;}
  }));

  CF.define(CF.LSView={id:'lending-marketplace',pages:[LIST,DETAIL,NEW],breadcrumbRoute:id=>id===LIST?CF.ENTRY[LIST]:null,dict:{en:{navHome:'Home',navAssets:'Asset marketplace',navPlaza:'Lending marketplace',navConsole:'My console',lsDetail:'Financing project',lsNew:'Create project'},zh:{navHome:'首页',navAssets:'资产广场',navPlaza:'借贷广场',navConsole:'我的控制台',lsDetail:'融资项目详情',lsNew:'创建融资项目'}},layers:Object.assign(layers,Q?Q.layers:{}),beforeRender:saveDetail,afterRender:restoreDetail,onBeforeAct(act,v,e){if(Q&&Q.beforeAct(act,e))return true;if(act==='closelayer'&&ownLayer()){if(busy)return true;if(S.layer.key==='discard'){S.layer=discardLayer.layer;flowRestore=discardLayer;discardLayer=null;return true;}requestClose();return true;}return false;},content(id){D.sweep();if(Q)Q.sweep();setTimeout(enhance,0);const mark='<p class="ls-demo-mark">'+L('Demonstration data','演示数据')+'</p>';return mark+(id===NEW?newPage():id===DETAIL?detailPage():listPage());},onAct(act,v){
    if(Q&&Q.onAct(act,v))return true;
    const p=project();
    try{
      if(act==='ls-record-retry'){recordLoads[v]='loading';setTimeout(()=>{delete recordLoads[v];CF.render();},350);return true;}
      if(act==='ls-back'){backStep();return true;}
      if(act==='ls-continue-edit'){if(discardLayer){S.layer=discardLayer.layer;flowRestore=discardLayer;discardLayer=null;}return true;}
      if(act==='ls-discard'){closeFlow();return true;}
      if(act==='ls-rail-toggle'){railExpanded=!railExpanded;return true;}
      if(act==='ls-tab'){actionTabs[p.id]=actionTabs[p.id]===v?'':v;railExpanded=true;refocus='ls-tab-'+v;return true;}
      if(act==='ls-node'){const[key,i]=v.split(':');actionNodes[p.id+':'+key]={i:Number(i),at:flowSteps(p,key).stage};return true;}
      if(act==='ls-locate'){locateRecord(v);return true;}
      if(act==='ls-review'){if(guarded(p)){clearSelection();reviewReturn=false;reviewScroll=0;open('review');}return true;}
      if(act==='ls-list'){S.layer=null;location.hash='#'+CF.ENTRY[LIST];return true;}
      if(act==='ls-new'){if(S.role!=='asset')throw Error('permission');selection=[];name='';kind='';rate='';expiry='';settle=[];editing=null;error='';pages.select=1;location.hash='#/project/new';return true;}
      if(act==='ls-fund-apply'){S.layer=null;if(CF.funder?.onboard)CF.funder.onboard();else CF.openLayer('modal','handoff','fund');return true;}
      if(act==='ls-view'){marketView=v==='table'?'table':'cards';setTimeout(()=>document.querySelector('.mk-views [data-v="'+marketView+'"]')?.focus({preventScroll:true}),0);return true;}
      if(act==='ls-chart-status'){filter.status=filter.status===v?'':v;writeFilters();return true;}
      if(act==='ls-token-view'){const y=window.scrollY;tokenView=v;requestAnimationFrame(()=>{document.querySelector('[data-act="ls-token-view"][data-v="'+v+'"]')?.focus({preventScroll:true});window.scrollTo({top:y,behavior:'instant'});});return true;}
      if(act==='ls-amend'){const t=D.project(v);if(!t||!D.mine(t))throw Error('permission');
        editing=t.id;name=txt(t.name);kind=t.kind;rate=String(Math.round(t.rate*10000)/100);expiry=t.expiry||'';settle=[...t.settle];error='';
        location.hash='#/project/new';return true;}
      if(act==='ls-create'){createProject();return true;}
      if(act==='ls-detail'){pages.tokens=pages.demands=1;goto(v);return true;}
      if(act==='ls-sort-column'){filter.sort=v==='newest'&&(!filter.sort||filter.sort==='newest')?'oldest':v;writeFilters();return true;}
      if(act==='ls-filter'){['keyword','vmin','vmax','amin','amax'].forEach(k=>{const el=document.getElementById('ls-'+k);if(el)filter[k]=el.value;});writeFilters();return true;}
      if(act==='ls-clear'){filter={};S.st='default';writeFilters();return true;}
      if(act==='ls-page'){const [k,n]=v.split(':');pages[k]=Math.max(1,+n);return true;}
      if(act==='ls-pledge'){openPledge();return true;}
      if(act==='ls-sign-pledge'){signPledge();return true;}
      if(act==='ls-publish'){openPublish();return true;}
      if(act==='ls-publish-confirm'){const max=D.numbers(p).free+(D.current(p)?.amount||0),n=Number(amount);if(!/^\d+(\.\d{1,2})?$/.test(amount)||n<=0||n>max){error=txt(errors.amount)+' '+L('Available: ','可融金额：')+usd(max)+L(' · Excess: ',' · 超出差额：')+usd(Math.max(0,n-max)||0);refocus='ls-amount';return true;}D.publish(p,n,!!D.current(p),p.settle);closeFlow();pages.demands=1;locateRecord('ls-applications');CF.toast(L('Financing request saved.','融资需求已保存。'));return true;}
      if(act==='ls-release'){openRelease();return true;}
      if(act==='ls-sign-release'||act==='ls-release-fees'){signRelease();return true;}
      if(act==='ls-enter'){beginDeposit();return true;}
      if(act==='ls-second-confirm'){open('execute');return true;}
      if(act==='ls-execute'){
        if(busy)return true;if(executionGate==='unavailable'||executionGate==='nogas'){error=executionGate==='unavailable'?L('Unable to start now. No fees incurred. Please try again later.','当前无法发起，本次未产生任何费用，可稍后重试。'):L('Insufficient balance for blockchain fees. No execution was started and no fees were incurred.','费用余额不足，未发起执行，未产生任何费用。');return true;}
        if(operation==='deposit'){
          if(!guarded(p))return true;if(!selection.length)return true;
          if(executionGate==='recheck'){D.token(selection.at(-1)).valid=false;executionGate='normal';}
          if(executionGate==='feeChange'){D.token(selection.at(-1)).feeEstimate=0.0006;executionGate='normal';}
          if(executionGate==='expiryChange'){D.latest(p,selection.at(-1)).deadline=new Date(D.now()-1).toISOString();executionGate='normal';}
          if(!validateDeposit())return true;
        }
        D.execute(p,operation==='deposit'?'deposit':'release',selection,operation==='deposit'?appId:null);selection=[];
        if(operation==='deposit'){reviewReturn=false;focusReview=false;pages.tokens=1;CF.closeLayer();setTimeout(()=>{const list=document.getElementById('ls-pledged-tokens');list?.scrollIntoView({block:'start',behavior:'smooth'});list?.focus({preventScroll:true});},0);CF.toast(L('Deposit started. Check the pledged token list for results.','已发起入池，请在质押代币清单查看结果。'));}
        else{flowFrames=[];CF.openLayer('modal','executionResult');CF.toast(L('Execution started. Results will appear per share.','已发起执行，结果将逐份更新。')); }return true;
      }
      if(act==='ls-review-filter'||act==='ls-review-reset'){clearSelection();pages.review=1;reviewFilter=act==='ls-review-reset'?{}:{keyword:document.getElementById('ls-review-keyword').value,state:document.getElementById('ls-review-state').value,progress:document.getElementById('ls-review-progress').value};return true;}
      if(act==='ls-review-retry'){reviewLoad='loading';setTimeout(()=>{reviewLoad='default';CF.render();},350);return true;}
      if(act==='ls-token-history'||act==='ls-token-detail'){historyToken=v;open('tokenHistory','drawer');return true;}
      if(act==='ls-more'){advancedOpen=!advancedOpen;setTimeout(()=>document.querySelector('[data-act="ls-more"]')?.focus({preventScroll:true}),0);return true;}
      if(act==='ls-tf-reset'){tokenFilter={};pages.tokens=1;return true;}
      if(act==='ls-history-back'){returnToReview();return true;}
      if(act==='ls-agreement'||act==='ls-agreement-download'){agreementAction(v,act==='ls-agreement-download');return true;}
      if(act==='ls-event-record'){const a=D.applications.find(a=>a.id===v&&a.project===p.id);if(!a||!guarded(p))return true;clearSelection();historyToken=a.tokens[0];open('tokenHistory');setTimeout(()=>document.getElementById('record-'+a.id)?.scrollIntoView({block:'start'}),0);return true;}
      if(act==='ls-demo-project'){
        try{D.decideProject(p,v,v==='return'?['The pledge rate needs to match the agreed terms.','项目质押率需与约定条款一致，请修改后重新提交。']:null);
          CF.toast(v==='submit'?L('Approval submitted. The pledge contract is being deployed.','运营已提交通过，本项目质押合约部署中。')
            :v==='approve'?L('Approved. Pledge contract deployed.','已通过，本项目质押合约已部署。')
            :v==='deployFailed'?L('Deployment failed. Operations will start it again.','部署失败，由管理人员再次发起。')
            :L('Returned to the asset holder.','已退回资产方。'));}
        catch(ex){showError(ex);}return true;}
      if(act==='ls-pledge-notifications'){if(guarded(p))open('pledgeNotifications');return true;}
      if(act==='ls-close'){if(guarded(p))open('close');return true;}
      if(act==='ls-close-confirm'){
        /* 演示并发：运营的提交通过先生效时，本次关闭被拒，项目不变化。 */
        if(closeRace&&p.state==='review'&&!p.deploying)D.decideProject(p,'submit');
        try{D.close(p);}catch(ex){showError(ex);CF.render();return true;}
        closeFlow();return true;}
      if(act==='ls-end-demand'){if(guarded(p))open('endDemand');return true;}
      if(act==='ls-end-confirm'){D.endDemand(p);closeFlow();locateRecord('ls-applications');return true;}
      if(act==='ls-cancel-app'){if(!guarded(p))return true;appId=v;open('cancelApp');return true;}
      if(act==='ls-cancel-confirm'){D.cancelApplication(D.applications.find(a=>a.id===appId));returnToReview();return true;}
      if(act==='ls-copy'){copyHash(v);return true;}
      if(act==='ls-quote'){const q=D.project(v);if(!D.actions(q).quote){CF.toast(quoteReason(q));return true;}CF.openLayer('modal','handoff','quote');return true;}
      if(act==='ls-handoff'){CF.openLayer('modal','handoff',v);return true;}
      if(act==='ls-demo-project'){const id=document.getElementById('ls-demo-project').value;S.demo=false;S.st='default';goto(id);return true;}
      if(act==='ls-demo-event'){externalEvent(v);return true;}
    }catch(ex){showError(ex);if(!S.layer)CF.toast(error);return true;}
    return false;
  }});
  CF.LSView.footer=footer;
  document.addEventListener('toggle',e=>{if(e.target.dataset.record){if(e.target.open)expandedRecords.add(e.target.dataset.record);else expandedRecords.delete(e.target.dataset.record);}},true);
  document.addEventListener('input',e=>{if(e.target.id==='ls-name')name=e.target.value;if(e.target.id==='ls-rate')rate=e.target.value;if(e.target.id==='ls-expiry')expiry=e.target.value;if(e.target.id==='ls-amount')amount=e.target.value;});
  document.addEventListener('change',e=>{
    if(e.target.dataset.filter&&e.target.dataset.filter.startsWith('ls-')){
      const id=e.target.dataset.filter,key=id.replace('ls-','');
      filter[key]=Array.from(document.querySelectorAll('[data-filter="'+id+'"]')).filter(b=>b.checked).map(b=>b.value).join(',');
      refocus=e.target.id;writeFilters();return;
    }
    const el=e.target;if(el.id==='ls-kind'){kind=el.value;selection=[];pages.select=1;refocus=el.id;CF.render();}
    if(el.dataset.settle){const c=el.dataset.settle;settle=el.checked?[...new Set([...settle,c])]:settle.filter(x=>x!==c);}
    if(el.dataset.depositToken){const id=el.dataset.depositToken;if(D.selectable(D.token(id),project()))selection=el.checked?[...new Set([...selection,id])]:selection.filter(x=>x!==id);CF.render();setTimeout(()=>document.querySelector('[data-deposit-token="'+id+'"]')?.focus({preventScroll:true}),0);}
    if(el.id==='ls-demo-record-state'){const id=document.getElementById('ls-demo-record').value;recordLoads[id]=el.value;CF.render();}if(el.id==='ls-review-load')reviewLoad=el.value;if(el.id==='ls-demo-application')demoApplication=el.value;if(el.id==='ls-agreement-fail')agreementFail=el.checked;
    if(el.dataset.tokenAll){const list=pledgeCandidates(project()),addr=signAddress()||D.holderOf(list[0]);selection=el.checked?list.filter(t=>D.holderOf(t)===addr).map(t=>t.id):[];if(S.layer?.key==='pledge'){feeQuote=feeSnapshot();confirmationChanges=[];}CF.render();setTimeout(()=>document.querySelector('[data-token-all]')?.focus(),0);}
    if(el.dataset.releaseAll){selection=el.checked?releaseCandidates(project()).filter(t=>!waterHeld(project(),t)).map(t=>t.id):[];feeQuote=feeSnapshot();confirmationChanges=[];error='';CF.render();setTimeout(()=>document.querySelector('[data-release-all]')?.focus(),0);}
    if(el.dataset.token){const id=el.dataset.token;selection=el.checked?[...new Set([...selection,id])]:selection.filter(x=>x!==id);if(['pledge','release'].includes(S.layer?.key)){feeQuote=feeSnapshot();confirmationChanges=[];error='';}CF.render();setTimeout(()=>document.querySelector('[data-token="'+id+'"]')?.focus(),0);}
    if(['ls-tf-state','ls-tf-going','ls-tf-keyword'].includes(el.id)){tokenFilter[el.id.slice(6)]=el.value;pages.tokens=1;refocus=el.id;CF.render();}
    if(el.id==='ls-outcome')outcome=el.value;if(el.id==='ls-gate')executionGate=el.value;if(el.id==='ls-submit-fail')submitFail=el.checked;if(el.id==='ls-close-race')closeRace=el.checked;
    if(el.id==='ls-sort'){filter.sort=el.value;writeFilters();refocus=el.id;CF.render();}
  });
  document.addEventListener('click',e=>{
    if(CF.AM && ![LIST,DETAIL,NEW].includes(S.page))return;
    savePosition();const a=e.target.closest('a');if(a&&!(CF.AM&&a.getAttribute('href')==='#/assets')&&['#/','#/assets','#/console'].includes(a.getAttribute('href'))){e.preventDefault();if(a.getAttribute('href')==='#/assets'&&document.querySelector('script[src]')){location.href='../03-资产广场/资产广场.html#/assets';return;}CF.openLayer('modal','handoff',a.getAttribute('href')==='#/console'?'console':'other');}
    const el=e.target.closest('[data-act]');if(el&&el.dataset.act==='clearfilter')filter={};
    if(el&&el.dataset.act==='role'){reviewReturn=false;S.layer=null;error='';selection=[];}
    if(el&&el.dataset.act==='closelayer'&&busy){e.stopImmediatePropagation();return;}
  });
  /* 勾选行：点整行即勾选，弹层会拦截冒泡，所以在捕获阶段处理。 */
  document.addEventListener('click',e=>{const pick=e.target.closest('.ls-pick-row');if(pick&&!e.target.closest('input,label'))pick.querySelector('input[data-token]')?.click();},true);
  document.addEventListener('keydown',e=>{
    if(e.target.matches('.ls-project-row,.ls-financing-row,.ls-token-row')&&['Enter',' '].includes(e.key)){e.preventDefault();e.target.click();return;}
    if(e.target.matches('.ls-flow-axis [role=tab]')&&['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();const axis=e.target.closest('.ls-flow-axis'),tabs=[...axis.querySelectorAll('[role=tab]')],i=tabs.indexOf(e.target),next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowDown'?1:tabs.length-1))%tabs.length;tabs[next].click();return;}
    if(e.key==='Enter'&&/^ls-(keyword|vmin|vmax|amin|amax)$/.test(e.target.id)){e.preventDefault();document.querySelector('[data-act=\"ls-filter\"]').click();return;}
    const dialog=document.querySelector('#layers [role="dialog"]');if(!dialog)return;
    if(e.key==='Escape'&&busy){e.stopImmediatePropagation();return;}
  });
  window.addEventListener('hashchange',()=>{if(CF.AM && !/^\/(project|marketplace)(?:[/?]|$)/.test(path()))return;savePosition();clearSelection();S.layer=null;reviewReturn=false;railExpanded=false;reviewScroll=0;expandedRecords.clear();syncRoute();error='';pages.tokens=pages.demands=1;const isList=/^\/marketplace(?:\?|$)/.test(path());if(isList){listRoute=path();filter=readFilters(listRoute);}pendingAction=new URLSearchParams(path().split('?')[1]||'').get('action');setTimeout(()=>{if(isList)restorePosition();else{deepAction();window.scrollTo(0,0);}},0);});
  function deepAction(){if(!pendingAction)return;const action=pendingAction;pendingAction=null;const p=project();if(Q&&['quote','quote_confirm'].includes(action)){if(p&&detailScope(p)==='full')Q.deepAction(action);return;}if(!p||!D.mine(p))return;if(action==='pledge')openPledge();else if(action==='publish')openPublish();else if(action==='withdraw'||action==='redeem')openRelease();else if(action==='enter_pool'){clearSelection();const ref=new URLSearchParams(path().split('?')[1]||'').get('application'),a=D.applications.find(a=>a.project===p.id&&a.id===ref);if(a){historyToken=a.tokens[0];open('tokenHistory','drawer');}}else if(action==='token'){const id=new URLSearchParams(path().split('?')[1]||'').get('token');if(id){historyToken=id;open('tokenHistory','drawer');}}}
  // The timer only updates simulated deadline outcomes. It never performs network work.
  setInterval(()=>{if(D.sweep())CF.render();},1000);
  if(!path()||path()==='/')location.hash='#/marketplace';syncRoute();if(/^\/marketplace(?:\?|$)/.test(path())){listRoute=path();filter=readFilters(listRoute);}pendingAction=new URLSearchParams(path().split('?')[1]||'').get('action');if(!CF.deferBoot)CF.boot();setTimeout(()=>{if(CF.AM && !/^\/(project|marketplace)(?:[/?]|$)/.test(path()))return;if(/^\/marketplace(?:\?|$)/.test(path()))restorePosition();else{deepAction();window.scrollTo(0,0);}},0);
})(window.CF);
