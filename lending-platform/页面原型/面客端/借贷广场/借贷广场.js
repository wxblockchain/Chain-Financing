/* WS-351 · module views. Shared tokens/components/shell remain the only source. */
(function(CF){
  'use strict';
  const S=CF.S,D=CF.LS,L=CF.L,E=CF.esc,Q=CF.CQ;
  const LIST='P-LS-01',DETAIL='P-LS-02',NEW='P-LS-03';
  CF.PAGES[DETAIL]={end:'asset',layout:'portal',crumbKey:'lsDetail',parent:LIST};
  CF.PAGES[NEW]={end:'asset',layout:'portal',crumbKey:'lsNew',parent:LIST,auth:true};
  CF.ENTRY[DETAIL]='/project/'+D.projects[0].id;CF.ENTRY[NEW]='/project/new';
  let selection=[],name='',kind='',error='',amount='',busy=false,appId=null,operation='deposit',pages={tokens:1,demands:1,select:1},filter={},pendingAction=null;
  let reviewFilter={},reviewLoad='default',historyToken=null,agreementId=null,agreementFail=false,feeQuote=[],confirmationChanges=[],demoApplication='';
  let outcome='success',executionGate='normal',submitFail=false,refocus=null,fromConsole=false;
  try{fromConsole=sessionStorage.getItem('hc-ls-origin')==='console';}catch(_){}
  const stateNames={draft:['Draft','草稿'],raising:['Fundraising','募集中'],locked:['Locked','已锁定'],financing:['Financing','融资中'],closed:['Closed','已关闭'],settled:['Settled','已结清'],review:['Under review','审核中'],approved:['Approved · pending deposit','审核通过 · 待入池'],rejected:['Rejected','已驳回'],withdrawn:['Withdrawn','已撤回'],expired:['Approval expired','结论已失效'],void:['Approval voided','结论已作废'],timeout:['Pledge failed (review timeout)','质押失败（审核超时）'],executing:['Execution in progress','执行处理中'],recorded:['Results recorded','结果已回写'],processing:['Processing','处理中'],success:['Succeeded','成功'],failure:['Failed','失败'],noFee:['Failed','失败'],open:['Awaiting quotes','待报价'],quoted:['Quoted · awaiting confirmation','已报价待确认'],funding:['Funding in progress','放款中'],funded:['Funded','已放款'],ended:['Expired / closed','已失效／已关闭'],surplus:['Coverage surplus','覆盖有余'],balanced:['Coverage balanced','覆盖持平'],short:['Coverage shortfall','覆盖不足']};
  const reasons={reviewTimeout:['Operations did not complete the review within 48 hours.','48 小时未完成审核。'],rejected:['The selected receivables require a complete buyer acknowledgement. Please provide the missing evidence before submitting again.','所选应收账款缺少完整的买方确认，请补全确认材料后重新提交。'],recheck:['The token is no longer eligible. This deposit permission has been voided; no execution was started and no fees were incurred.','代币已不满足入池条件，入池许可已作废；未发起链上执行，未产生任何费用。'],closed:['The project is closed.','项目已关闭。'],coverage:['Automatically expired · coverage shortfall','自动失效 · 覆盖不足'],withdrawn:['Withdrawn by asset holder','资产方撤下'],expiry:['Project term expired','有效期到期'],owner:['Closed by asset holder','资产方主动关闭']};
  const errors={permission:['You cannot perform this action for this entity.','你无权代表该企业执行此操作。'],selectionChanged:['The selection is no longer available. Select eligible tokens again.','所选代币已被占用或不再可质押，请重新选择。'],name:['Enter a project name of 1–60 characters.','请输入 1～60 字符的项目名称。'],kind:['Select a token type.','请选择代币类型。'],reviewChanged:['This application already has a decision and cannot be withdrawn.','该申请已有结论，无法撤回。'],approvalChanged:['This approval is no longer available. Check the application history.','该审核结论已不可用，请查看审核历史。'],publishChanged:['The project cannot be published now. Refresh the amount and project status.','当前无法发布，请检查最新额度和项目状态。'],demandChanged:['The financing request has changed and cannot be edited.','融资需求状态已变化，当前不可修改。'],cannotClose:['Withdraw the open financing request and settle outstanding financing before closing.','请先撤下在途需求并结清存量融资业务，再关闭项目。'],amount:['Enter a positive USD amount with no more than 2 decimal places, within the available amount.','请输入大于 0、最多两位小数且不超过可融金额的 USD 金额。'],withdrawLimit:['The selected value exceeds the current withdrawal limit. Reduce the selection or wait for repayment.','拟撤回价值超过当前上限，请减少勾选或等待还款释放余额。']};
  const txt=a=>a?L(a[0],a[1]):'—',usd=n=>CF.fmtAmt(n)+' USD',time=v=>v?new Intl.DateTimeFormat(S.lang==='zh'?'zh-CN':'en-GB',{timeZone:S.tz||'UTC',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(v))+' ('+E(S.tz||'UTC')+')':'—',date=v=>v?CF.fmtDate(v):'—';
  const label=k=>txt(stateNames[k]||[k,k]);
  const tag=k=>CF.tag(['short','failure','timeout','rejected'].includes(k)?'danger':['approved','success','surplus'].includes(k)?'ok':['review','processing','executing'].includes(k)?'warn':'',label(k));
  const note=(s,t='accent')=>CF.note(t==='danger'?'red':t,s);
  const btn=(act,text,value='',primary=false,disabled=false)=>'<button type="button" class="btn'+(primary?' primary':'')+'" data-act="'+act+'" data-v="'+E(value)+'"'+(disabled?' disabled':'')+'>'+text+'</button>';
  const card=(title,body)=>'<section class="card"><div class="card-head"><h2 class="ls-subheading">'+title+'</h2></div><div class="card-b">'+body+'</div></section>';
  const small=s=>'<div class="cell-sub">'+s+'</div>';
  const err=()=>error?'<div class="ls-error" role="alert">'+note(error,'danger')+'</div>':'';
  const path=()=>location.hash.replace(/^#/,'');
  const viewCache={},detailCache={},actionTabs={};
  let reviewReturn=false,focusReview=false,railExpanded=false;
  const expandedRecords=new Set();let reviewScroll=0;
  const currentTab=()=>actionTabs[project()?.id]||(S.role==='fund'?'financing':'global');
  let listRoute='/marketplace';
  function readFilters(route){const q=new URLSearchParams(route.split('?')[1]||'');const v={};['currency','tenor','keyword','type','vmin','vmax','amin','amax','status','quote','coverage','sort'].forEach(k=>{if(q.has(k))v[k]=q.get(k);});return v;}
  function savePosition(){const box=document.querySelector('#content .listbox');if(S.page===LIST&&box)viewCache[listRoute]={shown:S.shown,top:box.scrollTop,y:window.scrollY,focus:document.activeElement?.closest('.ls-project-row')?.dataset.v||viewCache[listRoute]?.focus||''};}
  // A local list snapshot also survives refresh and opening a detail in a new context.
  function listSnapshot(){savePosition();const c=viewCache[listRoute]||{},q=new URLSearchParams(listRoute.split('?')[1]||'');[['shown',c.shown],['scroll',c.top],['pageScroll',c.y],['focus',c.focus]].forEach(([k,v])=>{if(v)q.set(k,v);else q.delete(k);});return '/marketplace'+(q.size?'?'+q:'');}
  function listState(){const q=new URLSearchParams(listRoute.split('?')[1]||''),num=(k,max)=>Math.min(max,Math.max(0,Number(q.get(k))||0));return {shown:Math.max(20,num('shown',2000)),top:num('scroll',100000),y:num('pageScroll',100000),focus:q.get('focus')||''};}
  function writeFilters(){const q=new URLSearchParams();Object.keys(filter).forEach(k=>{if(filter[k])q.set(k,filter[k]);});const target='/marketplace'+(q.size?'?'+q.toString():'');viewCache[target]={shown:20,top:0,y:0};CF.ENTRY[LIST]=target;listRoute=target;if(path()!==target)location.hash='#'+target;CF.resetList();setTimeout(()=>window.scrollTo(0,0),0);}
  function restorePosition(){const c=viewCache[listRoute]||listState();S.shown=c.shown;S.toTop=false;CF.render();const box=document.querySelector('#content .listbox');if(box)box.scrollTop=c.top;window.scrollTo(0,c.y);if(c.focus)(document.querySelector('.ls-project-row[data-v="'+CSS.escape(c.focus)+'"]')||box||document.getElementById('ls-keyword'))?.focus({preventScroll:true});}
  function project(){const m=path().match(/^\/project\/([^?]+)/);try{return m?D.project(decodeURIComponent(m[1])):null;}catch(_){return null;}}
  function syncRoute(){const h=path();if(h==='/project/new')return;if(/^\/project\/[^/?]+/.test(h)){CF.ENTRY[DETAIL]=h;const back=new URLSearchParams(h.split('?')[1]||'').get('return');if(back&&/^\/marketplace(?:\?|$)/.test(back)&&!back.includes('#')){listRoute=back;CF.ENTRY[LIST]=back;}}else if(/^\/marketplace(?:\?|$)/.test(h))CF.ENTRY[LIST]=h;}
  function goto(id){if(CF.AM)CF.AM.returnDetail=null;if(S.page===LIST){savePosition();viewCache[listRoute]=Object.assign({shown:20,top:0,y:0},viewCache[listRoute],{focus:id});const back=listSnapshot();viewCache[back]=viewCache[listRoute];listRoute=back;CF.ENTRY[LIST]=back;history.replaceState(null,'','#'+back);}CF.ENTRY[DETAIL]='/project/'+encodeURIComponent(id)+'?return='+encodeURIComponent(listRoute);location.hash='#'+CF.ENTRY[DETAIL];}
  function showError(ex){error=txt(errors[ex.message]||reasons[ex.message]||['The action could not be completed. Please retry.','操作未完成，请重试。']);}
  function publicMissing(){return CF.empty(L('Content not found or access denied','内容不存在或无权访问'),'',btn('ls-list',L('Back to marketplace','返回借贷广场')));}
  function owner(p){return p.owner==='entity-demo-a'?L('Demo Asset Company A','演示资产企业 A'):L('Demo Asset Company B','演示资产企业 B');}
  function pledgeLabel(p){return p&&D.numbers(p).valid.length?L('Add collateral','追加质押'):L('Start token pledge','发起代币质押');}
  function twoSteps(){return note(L('1. Submit for review now. No on-chain operation or fees. 2. After approval, return to confirm the deposit and pay the blockchain fees.','① 现在提交审核，不发生链上操作、不产生费用。② 审核通过后，回来确认入池并承担链上费用。'));}
  function guestNotice(){return ''; }
  function pager(key,count){const total=Math.max(1,Math.ceil(count/5));pages[key]=Math.min(pages[key]||1,total);return '<div class="pager"><span class="total">'+L(count+' items · 5 per page','共 '+count+' 条 · 每页 5 条')+'</span>'+btn('ls-page','←',key+':'+(pages[key]-1),false,pages[key]===1)+'<span>'+pages[key]+' / '+total+'</span>'+btn('ls-page','→',key+':'+(pages[key]+1),false,pages[key]===total)+'</div>';}
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
  function tokenTable(list,mode='public',key='tokens'){
    const head=[L('Token / hash','代币 / Hash'),L('Quantity / currency','代币数量 / 币种'),L('Token value','代币价值'),L('Receivable term','底层应收账款账期'),L('Buyer','买方企业'),L('Status','状态')];
    if(mode==='select'||mode==='release')head.unshift(L('Select','选择'));
    if(mode==='own')head.push(L('On-chain execution','链上执行状态'));
    if(!list.length)return CF.empty(L('No tokens available','暂无代币'),mode==='select'?L('No eligible tokens for this entity.','本企业暂无符合条件的代币。'):L('There are no tokens in this list.','当前清单暂无代币。'));
    const tail=pager(key,list.length),start=(pages[key]-1)*5;
    return dataTable(head,list.slice(start,start+5).map(t=>{
      const execution=mode==='own'?latestExecution(project(),t):null,notInPool=mode==='own'&&t.pool!==project().id;
      const status=notInPool?(execution?.state==='processing'?L('Awaiting deposit · excluded from coverage','入池处理中 · 不计入覆盖'):L('Not deposited · excluded from coverage','未入池 · 不计入覆盖')):!t.valid?L('Expired · excluded from coverage','已失效 · 不计入覆盖'):t.frozen?(mode==='own'?L('Reconciliation pending · excluded','对账处理中 · 不计入覆盖'):L('Excluded from coverage','不计入覆盖')):t.pledge==='released'?L('Released · awaiting collection','已释放 · 待提取'):L('Valid','有效');
      const row=['<span class="mono">'+E(t.id)+'</span>'+(t.tx?'<div class="ls-hash-row"><button type="button" class="ls-hash mono" data-act="ls-copy" data-v="'+E(t.tx)+'" title="'+E(t.tx)+'" aria-label="'+L('Copy transaction hash ','复制交易哈希 ')+E(t.tx)+'">'+E(t.tx.slice(0,8))+'…'+E(t.tx.slice(-6))+'</button><a class="ls-explorer" href="https://etherscan.io/tx/'+E(t.tx)+'" target="_blank" rel="noopener noreferrer" title="'+L('Open blockchain explorer','打开区块链浏览器')+'" aria-label="'+L('Open transaction in blockchain explorer (new window)','在区块链浏览器打开交易（新窗口）')+'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M10 5H5v14h14v-5"/></svg></a></div>':''),CF.fmtAmt(t.units)+' '+E(t.symbol),usd(t.value),date(t.from)+' → '+date(t.due),E(txt(t.buyer)),CF.tag(t.valid&&!t.frozen?'':'warn',status)];
      if(mode==='select'||mode==='release'){
        const off=mode==='select'?!D.selectable(t,project()):!!(t.frozen||t.pending);
        row.unshift('<label class="ls-check"><input type="checkbox" data-token="'+E(t.id)+'" '+(selection.includes(t.id)?'checked ':'')+(off?'disabled ':'')+'aria-label="'+L('Select ','选择 ')+E(t.id)+'"><span>'+L('Select','选择')+'</span></label>'+(off?small(t.application?L('Reserved by ','已被申请占用 ')+E(t.application):t.pending?L('On-chain processing','链上处理中'):L('Reconciliation pending','对账处理中')):''));
      }
      if(mode==='own')row.push(execution?tag(execution.state)+(execution.boundary?small(L('Result received · allocation pending verification','已收到结果 · 归属待核实')):'')+(['failure','noFee'].includes(execution.state)?small(execution.fee?L('Incurred fee: ','已产生费用：')+Number(execution.fee).toFixed(6)+' '+E(execution.feeCurrency):L('No fees incurred','未产生费用')):''):tag(t.pending?'processing':'success'));
      return row;
    }))+tail;
  }
  /* 更多筛选与主筛选条同一套控件：多选药丸 + 紧凑区间输入，不再各带一套标签字段和按钮。 */
  let advancedOpen=false;
  document.addEventListener('toggle',e=>{if(e.target.classList&&e.target.classList.contains('ls-more-filters'))advancedOpen=e.target.open;},true);
  function advancedFilters(){
    const fm=(id,label,opts,cur)=>CF.filterMenu(id,label,opts,String(cur||'').split(',').filter(Boolean));
    const range=(label,minId,maxId,minV,maxV)=>'<span class="fb-range"><span class="fb-label">'+label+'</span>'+
      '<input class="inp" id="'+minId+'" type="number" min="0" inputmode="numeric" placeholder="'+L('Min','最小')+'" aria-label="'+label+' · '+L('minimum','最小')+'" value="'+E(minV||'')+'">'+
      '<span class="fb-dash" aria-hidden="true">–</span>'+
      '<input class="inp" id="'+maxId+'" type="number" min="0" inputmode="numeric" placeholder="'+L('Max','最大')+'" aria-label="'+label+' · '+L('maximum','最大')+'" value="'+E(maxV||'')+'"></span>';
    return '<div class="filterbar ls-advanced-filters">'+
      fm('ls-type',L('Asset type','资产类型'),[['ar',L('Receivables','应收账款')]],filter.type)+
      fm('ls-coverage',L('Coverage shortfall','覆盖不足'),[['yes',L('Yes','是')],['no',L('No','否')]],filter.coverage)+
      range(L('Pool value (USD)','池内资产价值（USD）'),'ls-vmin','ls-vmax',filter.vmin,filter.vmax)+
      range(L('Requested amount (USD)','需求金额（USD）'),'ls-amin','ls-amax',filter.amin,filter.amax)+
      '<div class="fb-acts">'+btn('ls-filter',L('Apply','应用'),'',true)+'</div></div>';}
  function filters(){
    const fm=(id,label,opts,cur)=>CF.filterMenu(id,label,opts,String(cur||'').split(',').filter(Boolean));
    return '<div class="filterbar ls-primary-filters">'+
    fm('ls-currency',L('Currency','币种'),[['USD','USD']],filter.currency)+
    fm('ls-tenor',L('Tenor','期限'),[['60',L('60 days','60 天')],['90',L('90 days','90 天')],['120',L('120 days','120 天')]],filter.tenor)+
    fm('ls-status',L('Project status','项目状态'),['raising','locked','financing','closed','settled'].map(k=>[k,txt(stateNames[k])]),filter.status)+
    fm('ls-quote',L('Open for quotes','可报价'),[['yes',L('Yes','是')],['no',L('No','否')]],filter.quote)+
    CF.filterSearch('ls-keyword',L('Project, request ID or holder','项目、需求编号或资产方'),filter.keyword||'')+
    '<div class="fb-acts">'+
    btn('ls-clear',L('Reset','重置'))+btn('ls-filter',L('Search','查询'),'',true)+'</div></div>'+
    '<details class="ls-more-filters"'+(advancedOpen||['type','coverage','vmin','vmax','amin','amax'].some(k=>filter[k])||/^filter:ls-(type|coverage)$/.test(S.menu||'')?' open':'')+'><summary>'+L('More filters','更多筛选')+'</summary>'+advancedFilters()+'</details>';}
  function requestInfo(p){const d=D.current(p);return {d,amount:d?d.amount:null,currency:'USD',tenor:d?.tenorDays,rate:d?.rate,updated:D.events.find(e=>e.project===p.id)?.at||d?.at||p.published};}
  function matching(){return D.projects.filter(p=>p.state!=='draft'||Q&&Q.hasHistory(p)).filter(p=>{
    const n=D.numbers(p),d=D.current(p),amount=d?d.amount:0,open=Q?Q.quoteAvailable(p):d&&d.state==='open'&&!p.expired&&n.grade==='surplus';
    const info=requestInfo(p);
    const within=(sel,value)=>{const l=String(sel||'').split(',').filter(Boolean);return !l.length||l.includes(String(value));};
    if(!within(filter.currency,info.currency)||!within(filter.tenor,info.tenor))return false;
    if(filter.keyword&&!([p.id,info.d?.id,...p.name,owner(p)].join(' ').toLowerCase().includes(filter.keyword.trim().toLowerCase())))return false;
    if(!within(filter.status,p.state))return false;
    if(!within(filter.type,'ar'))return false;
    if(filter.vmin&&n.value<+filter.vmin||filter.vmax&&n.value>+filter.vmax||filter.amin&&amount<+filter.amin||filter.amax&&amount>+filter.amax)return false;
    if(!within(filter.quote,open?'yes':'no'))return false;
    if(!within(filter.coverage,n.grade==='short'?'yes':'no'))return false;
    return true;
  }).sort((a,b)=>filter.sort==='value'?D.numbers(b).value-D.numbers(a).value:filter.sort==='amount'?((D.current(b)||{}).amount||0)-((D.current(a)||{}).amount||0):(filter.sort==='oldest'?1:-1)*(Date.parse(requestInfo(a).updated)-Date.parse(requestInfo(b).updated)));}
  function quoteReason(p){const n=D.numbers(p),d=D.current(p);return S.role==='asset'?L('Asset holders cannot submit quotes.','资产方不可提交报价。'):n.grade==='short'?L('Coverage shortfall','覆盖不足'):p.expired?L('Project term expired','项目已到期'):d&&d.state==='quoted'?L('An active quote already exists','已有在途报价'):L('This request is not open for quotes','当前需求不可报价');}
  function listColumns(){return [L('Financing project','融资项目'),L('Asset holder','资产方企业'),L('Pledged amount','质押额度'),L('Financing request','融资需求'),L('Collateral coverage','质押覆盖'),L('Project status','项目状态'),L('Updated','更新时间')];}
  function projectRow(p){const n=D.numbers(p),r=requestInfo(p),heads=listColumns();
    const money=v=>'<span class="ls-amt">'+CF.icoChip(r.currency,{hue:1,small:true,iconOnly:true})+'<b class="mono">'+usd(v)+'</b></span>';
    const demand=r.d?money(r.amount)+small(tag(r.d.state)):'<span class="muted">'+L('No active request','暂无融资需求')+'</span>';
    const coverage=tag(n.grade)+(n.grade==='short'?small(L('Shortfall ','缺口 ')+usd(n.gap)):'');
    const hue=n.grade==='short'?4:n.grade==='surplus'?2:1;
    const name='<span class="ls-project-name">'+CF.icoChip(txt(p.name),{glyph:CF.ICON.pool,hue:['closed','settled'].includes(p.state)?0:hue,small:true})+'</span>';
    const cells=[name,E(owner(p)),money(n.value),demand,coverage,tag(p.state),'<span class="cell-sub">'+time(r.updated)+'</span>'];
    return '<tr class="ls-project-row" tabindex="0" data-act="ls-detail" data-v="'+E(p.id)+'" aria-label="'+L('Open project: ','打开项目：')+E(txt(p.name))+'">'+cells.map((c,i)=>'<td data-label="'+E(heads[i])+'"><div class="cell-wrap">'+c+'</div></td>').join('')+'</tr>';
  }
  function listHead(){return '<thead><tr>'+listColumns().map((h,i)=>{const key=i===2?'value':i===3?'amount':i===6?'newest':null,sort=filter.sort||'newest',active=key&&(sort===key||i===6&&sort==='oldest');return key?'<th scope="col" class="sortable" aria-sort="'+(active?(sort==='oldest'?'ascending':'descending'):'none')+'"><button type="button" data-act="ls-sort-column" data-v="'+key+'">'+h+'<span class="ar">'+(sort==='oldest'?'↑':'↓')+'</span></button></th>':'<th scope="col">'+h+'</th>';}).join('')+'</tr></thead>';}
  /* 广场汇总：按当前筛选结果实时合计，数字全部来自演示数据，不额外引入口径。 */
  function marketStats(rows){
    const open=rows.filter(p=>{const d=D.current(p);return d&&d.state==='open';});
    const demand=open.reduce((n,p)=>n+(D.current(p).amount||0),0);
    const pool=rows.reduce((n,p)=>n+D.numbers(p).value,0);
    const outstanding=rows.reduce((n,p)=>n+(p.balance||0),0);
    const cell=(k,v,note,tone)=>'<div class="s"'+(tone?' data-tone="'+tone+'"':'')+'><div class="k">'+k+'</div><div class="v">'+v+'</div><div class="n">'+note+'</div></div>';
    return '<div class="stat-strip ls-market-stats">'+
      cell(L('Open requests','在售融资需求'),open.length,L('projects seeking funding','个项目正在寻求出资'))+
      cell(L('Requested amount','融资需求总额'),'<span class="u">USD</span>'+CF.fmtAmt(demand),L('across open requests','按在售需求合计'),'accent')+
      cell(L('Eligible collateral','有效质押价值'),'<span class="u">USD</span>'+CF.fmtAmt(pool),L('counted towards coverage','计入覆盖的池内价值'))+
      cell(L('Outstanding financing','已放款余额'),'<span class="u">USD</span>'+CF.fmtAmt(outstanding),L('not yet repaid','尚未偿还'),outstanding?'pos':'')+
      '</div>';
  }
  function listPage(){const rows=matching();let content=CF.surface({emptyTitle:L('No financing projects yet','暂无融资项目'),emptyDesc:L('Published projects will appear here.','融资项目发布后会出现在这里。'),backTo:'/marketplace'});if(content===null)content=rows.length?listFullBar(rows.length)+'<div class="tablewrap listbox listbox-contained ls-market-zone" tabindex="0" role="region" aria-label="'+L('Financing projects','融资项目列表')+'"><table class="tbl resp ls-market-table">'+listHead()+'<tbody>'+rows.slice(0,S.shown).map(projectRow).join('')+'</tbody></table>'+CF.moreFoot(rows.length)+'</div>':CF.empty(L('No results match these filters','筛选无结果'),L('Try widening or clearing the filters.','请放宽筛选条件或清空筛选。'),btn('ls-clear',L('Clear filters','清空筛选')));return '<div class="page-head"><div><h1 class="page-title">'+L('Lending marketplace','借贷广场')+'</h1><p class="page-desc">'+L('Explore project collateral pools and their current financing requests.','查看融资项目的质押池与资产方当前融资需求。')+'</p></div>'+(S.role==='asset'?'<div class="page-actions">'+btn('ls-new',L('Create project','创建融资项目'),'',true)+'</div>':'')+'</div>'+guestNotice()+marketStats(rows)+'<section class="card listzone">'+filters()+content+'</section>';}
  function listFullBar(total){return '<div class="list-full-bar"><span>'+E(L('Showing ','共 ')+total+L(' projects',' 个融资项目'))+'</span><button class="btn icon" type="button" id="ls-full" data-act="list-full" data-v="ls-full" aria-pressed="'+!!S.listFull+'" title="'+E(S.listFull?L('Exit full window','退出放大'):L('Expand to window','放大到整窗'))+'" aria-label="'+E(S.listFull?L('Exit full window','退出放大'):L('Expand to window','放大到整窗'))+'">'+(S.listFull?CF.ICON.close:CF.ICON.expand)+'</button></div>';}
  function stats(p){const n=D.numbers(p),d=D.current(p);
    const money=v=>'<span class="u">USD</span>'+CF.fmtAmt(v);
    const cells=[
      [L('Eligible pledged tokens','有效质押代币'),n.valid.length,L('tokens','张'),''],
      [L('Eligible collateral value','有效质押价值'),money(n.value),L('counted towards coverage','计入覆盖'),'accent'],
      [L('Current request','当前融资需求'),d?money(d.amount):'—',d?L('awaiting funding','等待出资'):L('no active request','暂无需求'),''],
      [L('Outstanding financing','已融资余额'),money(p.balance),L('not yet repaid','尚未偿还'),p.balance?'pos':''],
      [L('Pledge ratio','质押率'),'80%',L('platform parameter','平台参数'),'']];
    return '<div class="stat-strip ls-stats">'+cells.map(v=>'<div class="s"'+(v[3]?' data-tone="'+v[3]+'"':'')+'><div class="k">'+v[0]+'</div><div class="v">'+v[1]+'</div><div class="n">'+v[2]+'</div></div>').join('')+'</div>';}

  /* 质押池构成：环形图给比例，右侧表格给数值，两者同源于池内代币。 */
  function poolChart(p){
    const n=D.numbers(p);
    if(!n.pool.length)return '';
    const counted=n.value;
    const frozen=n.pool.filter(t=>t.valid&&(t.frozen||t.pending)).reduce((v,t)=>v+t.value,0);
    const expired=n.pool.filter(t=>!t.valid).reduce((v,t)=>v+t.value,0);
    const total=counted+frozen+expired;
    const parts=[
      {tone:'accent',value:counted,label:L('Counted towards coverage','计入覆盖'),count:n.valid.length},
      {tone:'warn',value:frozen,label:L('Pending on-chain or reconciliation','链上或对账处理中'),count:n.pool.filter(t=>t.valid&&(t.frozen||t.pending)).length},
      {tone:'gray',value:expired,label:L('Expired','已失效'),count:n.pool.filter(t=>!t.valid).length}
    ].filter(x=>x.count||x.value);
    const pct=v=>total?(v/total*100).toFixed(1)+'%':'—';
    const rows=parts.map(x=>'<tr><td><span class="legend-dot" data-tone="'+x.tone+'" aria-hidden="true"></span>'+x.label+'</td><td class="num nw">'+usd(x.value)+'</td><td class="num">'+x.count+'</td><td class="num">'+pct(x.value)+'</td></tr>').join('');
    return '<div class="chart-split ls-pool-chart">'+
      CF.donut(parts,{value:pct(counted),label:L('Counted','计入覆盖')},L('Collateral pool composition','质押池构成'))+
      '<table class="tbl ls-legend-table"><thead><tr><th scope="col">'+L('Pool composition','池内构成')+'</th><th scope="col" class="num">'+L('Value','价值')+'</th><th scope="col" class="num">'+L('Tokens','张数')+'</th><th scope="col" class="num">'+L('Share','占比')+'</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  function demandTable(p){
    if(!p.demands.length)return CF.empty(L('No financing applications yet','尚未发布融资申请'),'');
    const tail=pager('demands',p.demands.length),list=[...p.demands].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice((pages.demands-1)*5,pages.demands*5);
    return dataTable([L('Application ID','融资申请编号'),L('Amount / currency','申请金额 / 币种'),L('Application status','申请状态'),L('Institution / annual rate','机构 / 年化利率'),L('Published at','发布时间')],list.map(d=>{const q=Q?.currentQuote(p,d.id);return ['<span class="ls-demand-link">'+E(d.id)+' ↗</span>',usd(d.amount),tag(d.state)+(d.reason?small(txt(reasons[d.reason])):''),q?E(Q.institution(q.fund))+small(q.rate+' %'):L('No active quote','暂无有效报价'),time(d.at)];}),list.map(d=>' class="ls-financing-row" tabindex="0" data-act="cq-request" data-v="'+E(d.id)+'" aria-label="'+L('Open application ','查看融资申请 ')+E(d.id)+'"'))+tail;
  }
  const applicationAmount=a=>a.tokens.reduce((sum,id)=>sum+(D.token(id)?.value||0),0);
  function actionableApplications(p){return D.mine(p)?D.applications.filter(a=>a.project===p.id&&D.eligible(a)):[];}
  function todoBadge(count){return count?'<span class="ls-todo" aria-label="'+L(count+' to do',count+' 项待办')+'">'+count+'</span>':'';}
  function operationMetric(title,value){return '<div class="ls-operation-metric"><span class="muted">'+title+'</span><b class="mono">'+value+'</b></div>';}
  function actions(p){const a=D.actions(p),n=D.numbers(p),d=D.current(p),tab=currentTab(),todo=actionableApplications(p).length;
    const active=D.applications.filter(x=>x.project===p.id&&['review','approved','executing'].includes(x.state)).sort((x,y)=>Date.parse(y.submitted)-Date.parse(x.submitted));
    let body='',primary='',secondary='';
    if(tab==='repay'&&CF.L8?.available(p).length){const panel=CF.L8.panel(p);body=panel.body;primary=panel.primary;secondary=panel.secondary;}else if(S.role==='guest'){body='<h3>'+L('Continue with this project','办理本项目业务')+'</h3><p class="muted">'+L('Sign in to view actions available to your company.','登录后查看本企业可办理的业务。')+'</p>';primary=btn('signin',L('Sign in now','立即登录'),'',true);}
    else if(tab==='global'){
      if(a.mine){
        body='<section class="ls-op-section"><h3>'+L('Collateral management','质押管理')+'</h3>'+operationMetric(L('Withdrawal limit','可撤回额度'),usd(n.withdraw))+'</section>';
        if(active.length)body+='<section class="ls-op-section"><div class="ls-row"><h3>'+L('Pledge progress','质押进度')+'</h3><span class="muted">'+L(active.length+' in progress',active.length+' 笔进行中')+'</span></div><div class="ls-app-preview">'+active.slice(0,3).map(x=>'<div><span class="mono">'+E(x.tokens[0])+'</span>'+tag(x.state)+'</div>').join('')+'</div></section>';
        else body+='<p class="muted">'+L('No pledge applications in progress.','暂无进行中的质押申请。')+'</p>';
        body+='<div class="ls-secondary-actions">'+btn('ls-review',L('Pledge review & confirmation','质押审核与确认'))+btn('ls-release',L('Release collateral','解除质押'),'',false,!a.withdraw)+'</div>';
        if(p.l8ReleasePending)body+=note(L('Collateral release result is not yet available. Collection is unavailable until release is confirmed.','质押释放结果暂未取得，确认已释放前暂不可提取。'));else if(D.terminal(p))body+='<p class="hint">'+L('Collect released tokens to return them to the original holding address. Blockchain fees apply.','已释放代币需自行提取至原持有地址，提取将产生链上费用。')+'</p>';
        body+='<div class="ls-op-danger">'+btn('ls-close',L('Close project','关闭项目'),'',false,!a.close)+'</div>';
        primary=todo?btn('ls-review',L('Review pending tokens','处理待入池代币')+todoBadge(todo),'',true):btn(D.terminal(p)?'ls-release':'ls-pledge',D.terminal(p)?L('Collect collateral','提取已释放代币'):pledgeLabel(p),'',true,D.terminal(p)?!a.withdraw:!a.pledge);
        if(todo)secondary=btn('ls-pledge',pledgeLabel(p),'',false,!a.pledge);
      }else body='<h3>'+L('Collateral overview','质押概览')+'</h3>'+operationMetric(L('Pledged amount','质押额度'),usd(n.value))+'<p class="muted">'+L('Collateral is managed by the asset holder. Select Financing to view the current request.','质押由资产方管理，可在「融资」中查看当前需求。')+'</p>';
    }else if(tab==='financing'){
      const panel=Q.financePanel(p);body=panel.body;primary=panel.primary;secondary=panel.secondary;
    }else{
      body='<h3>'+L('Repayment overview','还款概览')+'</h3>'+operationMetric(L('Outstanding financing','已融资余额'),usd(p.balance));
      if(p.balance){body+=select('ls-repay','Financing request','需求编号',p.demands.filter(x=>x.state==='funded').map(x=>[x.id,x.id,x.id]))+'<p class="muted">'+L('No repayment recorded.','暂无还款记录。')+'</p>';if(a.mine)primary=btn('ls-handoff',L('Repay now','立即还款'),'repay',true);}
      else body+='<p class="muted">'+L('No repayment due.','暂无待还款业务。')+'</p>';
    }
    const tabs=[['global','Collateral','质押',todo],['financing','Financing','融资',a.mine&&d?.state==='quoted'?1:0],['repay','Repayment','还款',0]];
    return '<section class="card ls-operations" data-expanded="'+railExpanded+'"><div class="ls-operations-head"><h2>'+L('Project actions','项目操作')+'</h2><button type="button" class="ls-rail-toggle" data-act="ls-rail-toggle" aria-expanded="'+railExpanded+'" aria-controls="ls-action-panel">'+(railExpanded?L('Collapse','收起'):L('Expand','展开'))+'</button></div><div class="ls-tabs" role="tablist" aria-label="'+L('Action categories','操作分类')+'">'+tabs.map(t=>'<button type="button" id="ls-tab-'+t[0]+'" role="tab" data-act="ls-tab" data-v="'+t[0]+'" aria-selected="'+(tab===t[0])+'" aria-controls="ls-action-panel" tabindex="'+(tab===t[0]?0:-1)+'">'+L(t[1],t[2])+todoBadge(t[3])+'</button>').join('')+'</div><div class="ls-action-panel" id="ls-action-panel" role="tabpanel" aria-labelledby="ls-tab-'+tab+'" tabindex="0">'+body+'</div>'+((primary||secondary)?'<div class="ls-action-footer">'+primary+secondary+'</div>':'')+'</section>';
  }
  function waitLine(start,days){const elapsed=Math.max(0,Math.floor((D.now()-Date.parse(start))/60000));return '<p class="hint">'+L('Waiting: ','已等待：')+Math.floor(elapsed/60)+L(' h ',' 小时 ')+(elapsed%60)+L(' min.',' 分钟。')+(days?L(' Review deadline: ',' 审核截止：')+time(new Date(Date.parse(start)+days*86400000).toISOString()):'')+'</p>';}
  function resultRows(p,application){const list=D.executions.filter(e=>e.project===p.id&&(application===undefined||e.application===application));if(!list.length)return '';return card(L('Per-token execution results','逐张执行结果'),dataTable([L('Token / operation','代币 / 操作'),L('Result','执行结果'),L('Blockchain fee','链上费用'),L('Next step','下一步')],[...list].reverse().map(e=>{
    const t=D.token(e.token),why=['failure','noFee'].includes(e.state)?L('The transfer was not completed.','代币转移未完成。'):e.state==='processing'?L('The token issuance platform is executing the transfer. This page updates when results arrive.','代币发行平台正在执行，结果回写后本页更新。'):'';
    let next=e.state==='processing'?L('Wait for the result; no new action is available for this token.','请等待结果，该张代币暂不可发起新操作。'):e.late||t.frozen?L('Reconciliation pending. New actions are paused; excluded from coverage.','对账处理中，已暂停新操作，不计入覆盖。'):e.state==='success'?e.kind==='deposit'?L('Counted as collateral; manage in Release collateral.','已计入质押，可通过解除质押入口管理。'):L('Returned to the original holding address.','已转回质押前的原持有地址。'):e.kind==='deposit'?L('Available for a new application to this or another project.','可重新提交到本项目或其他项目。'):e.kind==='redeem'?L('Still awaiting collection. You may retry.','仍为待提取，可重新发起。'):L('Still in the pool. Reserved value restored; you may retry.','仍在池内，预扣已撤销，可重新发起。');
    return [E(e.token)+small(L({deposit:'Deposit',withdraw:'Withdraw',redeem:'Collect'}[e.kind],{deposit:'入池',withdraw:'撤回',redeem:'提取'}[e.kind])),tag(e.state)+(e.boundary?small(L('Reported result: ','已收到结果：')+label(e.observedResult)+L(' · Awaiting verification of allocation.',' · 归属待核实。')):'')+(why?small(why):'')+(e.state==='processing'?waitLine(e.at,null):small(time(e.done))),e.fee===null?L('Awaiting fee result','费用待回写'):e.fee===0?L('No fees incurred','未产生费用'):Number(e.fee).toFixed(6)+' '+E(e.feeCurrency||'ETH')+small(L('Incurred fees are not refunded.','已产生的费用不退回。')),next+(['failure','noFee'].includes(e.state)&&!t.frozen&&!t.pending?'<div class="ls-block">'+btn(e.kind==='deposit'?'ls-pledge':'ls-release',L('Select again','重新选择'))+'</div>':'')];
  })));
  }
  function reviewLabel(a){return a.reviewState==='approved'?CF.tag('ok',L('Approved','审核通过')):tag(a.reviewState||a.state);}
  function executionFor(a){return [...D.executions].reverse().find(e=>e.application===a.id);}
  function progressLabel(a){const e=executionFor(a),t=D.token(a.tokens[0]);return t.frozen?CF.tag('warn',L('Discrepancy · actions paused','存在差异 · 暂停操作')):e?tag(e.state):a.state==='approved'?CF.tag('ok',L('Ready to deposit','待确认入池')):a.state==='expired'?CF.tag('',L('Deposit permission expired','入池许可已到期')):a.state==='void'?CF.tag('',L('Deposit permission voided','入池许可已作废')):CF.tag('',L('Not started','未发起'));}
  function unavailableReason(a){const t=D.token(a.tokens[0]),e=executionFor(a);if(t.frozen)return L('Discrepancy; new actions are paused.','存在差异，暂停新操作。');if(t.pending||e?.state==='processing')return L('Awaiting execution results.','等待执行结果，暂不可再次操作。');if(e?.state==='success')return L('This application has already succeeded.','本笔已成功，不可重复入池。');if(a.state==='approved'&&!D.eligible(a))return L('Eligibility changed; deposit is unavailable.','入池资格已变化，当前不可入池。');return a.state==='review'?L('Awaiting review.','尚未通过审核。'):a.state==='expired'?L('The deposit deadline has passed.','已超过本笔入池截止时间。'):a.state==='void'?txt(reasons[a.reason]||reasons.recheck):a.state==='recorded'?L('Execution ended; submit a new application if eligible.','本次执行已结束，可按资格重新申请。'):a.state==='timeout'?txt(reasons.reviewTimeout):L('No valid approval for this application.','本笔无有效的入池许可。');}
  function reviewTiming(a){return small(L('Submitted: ','提交：')+time(a.submitted))+small(L('Review by: ','审核截止：')+time(D.reviewDeadline(a)))+(a.reviewState==='approved'?small(L('Approved: ','通过：')+time(a.approvedAt))+small(L('Deposit by: ','入池截止：')+time(D.approvalDeadline(a))):a.decided?small(L('Reviewed: ','审核：')+time(a.decided)):a.finished?small(L('Ended: ','结束：')+time(a.finished)):'');}
  function tokenHistory(id){const p=project();if(!D.mine(p))return publicMissing();const records=D.applications.filter(a=>a.project===p.id&&a.tokens.includes(id)).sort((a,b)=>Date.parse(b.submitted)-Date.parse(a.submitted));const t=D.token(id);return card(L('Token information','代币信息'),dataTable([L('Amount','金额'),L('Quantity','数量'),L('Receivable term','应收账款账期'),L('Buyer','买方企业')],[[usd(t.value),t.units+' '+E(t.symbol),date(t.from)+' → '+date(t.due),E(txt(t.buyer))]]))+records.map(a=>'<article class="ls-application" id="record-'+E(a.id)+'"><div class="ls-row"><b class="mono">'+E(a.id)+'</b>'+reviewLabel(a)+progressLabel(a)+'</div><p class="hint">'+L('Submission reference: ','提交批次：')+E(a.batch)+'</p>'+reviewTiming(a)+(a.reviewer?'<p>'+L('Reviewer: ','审核人：')+E(txt(a.reviewer))+'</p>':'')+(a.reason?note(E(txt(reasons[a.reason]||[a.reason,a.reason])),['rejected','timeout'].includes(a.state)?'danger':'warn'):'')+(!executionFor(a)?'<p class="hint">'+L('Not started · no blockchain fee incurred.','未发起链上执行 · 未产生链上费用。')+'</p>':'')+(a.agreement?'<div class="ls-row">'+btn('ls-agreement',L('View agreement','查看协议'),a.id)+btn('ls-agreement-download',L('Download agreement','下载协议'),a.id)+(a.state==='expired'||a.state==='void'?small(L('Archived','已存档')):'')+'</div>':'')+(a.state==='review'?waitLine(a.submitted,2):'')+resultRows(p,a.id)+(a.id===D.latest(p,id)?.id?'<div class="ls-row">'+(a.state==='review'?btn('ls-cancel-app',L('Withdraw application','撤回申请'),a.id):D.selectable(t,p)&&!D.terminal(p)?btn('ls-reapply',L('Apply again','重新申请'),t.id):'')+'</div>':'')+'</article>').join('')||CF.empty(L('No application history','暂无申请历史'),'');}
  function agreementText(a){return L('Demonstration agreement — not a signed legal document.','演示协议 — 非真实签署文件。')+'\n\n'+txt(a.agreement.name)+'\n'+L('Project: ','项目：')+txt(D.project(a.project).name)+'\n'+L('Token: ','代币：')+a.tokens[0]+'\n'+L('Application: ','申请：')+a.id+'\n'+L('Asset holder: ','资产方：')+owner(D.project(a.project))+'\n'+L('Approved: ','通过时间：')+time(a.approvedAt);}
  function agreementAction(id,download){const a=D.applications.find(a=>a.id===id);if(!a||!D.mine(D.project(a.project))||!a.agreement)throw Error('permission');if(agreementFail){agreementFail=false;error=L('Unable to load the agreement. Retry when available.','协议加载失败，请重试。');return;}if(download){const url=URL.createObjectURL(new Blob([agreementText(a)],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=a.agreement.id+'.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}else{agreementId=id;open('agreement');}}
  function tokenMark(t){const ownerMark=t.owner==='entity-demo-a'?'A':'B',suffix=t.id.slice(-1);return '<span class="tok-mark" data-hue="'+((Number(suffix)||0)%4+1)+'" aria-hidden="true">'+E(ownerMark+suffix)+'</span>';}
  function reviewListStatus(a){return a.reviewState==='approved'?(D.eligible(a)?tag('approved'):progressLabel(a)):reviewLabel(a);}
  function currentRows(p){return [...new Set(D.applications.filter(a=>a.project===p.id).flatMap(a=>a.tokens))].map(id=>D.latest(p,id));}
  function filteredRows(p){return currentRows(p).filter(a=>(!reviewFilter.keyword||a.tokens[0].toLowerCase().includes(reviewFilter.keyword.toLowerCase()))&&(!reviewFilter.state||a.reviewState===reviewFilter.state)&&(!reviewFilter.progress||(D.token(a.tokens[0]).frozen?'discrepancy':executionFor(a)?.state==='noFee'?'failure':executionFor(a)?.state||a.state)===reviewFilter.progress)).sort((a,b)=>Date.parse(b.submitted)-Date.parse(a.submitted));}
  function applications(p){
    if(!D.mine(p))return publicMissing();
    const rows=filteredRows(p),opts=[['','All','全部']];
    const filters='<div class="ls-review-filters">'+field('ls-review-keyword','Token ID','代币编号',reviewFilter.keyword||'','search')+select('ls-review-state','Review status','审核状态',opts.concat(['review','approved','rejected','timeout','withdrawn'].map(k=>[k,...(k==='approved'?['Approved','审核通过']:stateNames[k])])),reviewFilter.state||'')+select('ls-review-progress','Follow-up status','后续情况',opts.concat(['approved','expired','void','processing','success','failure'].map(k=>[k,...stateNames[k]]),[['discrepancy','Discrepancy','存在差异']]),reviewFilter.progress||'')+'<div class="ls-row ls-review-filter-actions">'+btn('ls-review-filter',L('Filter','筛选'))+btn('ls-review-reset',L('Reset','重置'))+'</div></div>';
    let body=reviewLoad==='loading'?CF.skelTable(3):reviewLoad==='error'?CF.empty(L('Unable to load tokens','代币清单加载失败'),'',btn('ls-review-retry',L('Retry','重试'))):null;
    if(body===null){const total=reviewLoad==='empty'?[]:rows;const tail=pager('review',total.length);body=total.length?dataTable([L('Select','选择'),L('Token','代币'),L('Quantity','数量'),L('Amount','金额'),L('Status','状态'),L('Time ↓','时间 ↓'),L('Agreement','协议')],total.slice((pages.review-1)*5,pages.review*5).map(a=>{const t=D.token(a.tokens[0]),can=D.eligible(a);return ['<label class="ls-check"><input data-deposit-token="'+E(t.id)+'" type="checkbox" aria-label="'+L('Select ','选择 ')+E(t.id)+'" '+(selection.includes(t.id)?'checked ':'')+(can?'':'disabled')+'><span class="sr-only">'+L('Select','选择')+'</span></label>','<button type="button" class="actlink mono tok ls-token-link" data-act="ls-token-history" data-v="'+E(t.id)+'" aria-label="'+L('View token details: ','查看代币详情：')+E(t.id)+'">'+tokenMark(t)+'<span>'+E(t.id)+'</span></button>','<span class="mono">'+CF.fmtAmt(t.units)+'</span>','<span class="mono">'+usd(t.value)+'</span>',reviewListStatus(a),'<span class="cell-sub">'+time(a.submitted)+'</span>',a.agreement?'<button type="button" class="actlink ls-agreement-link" data-act="ls-agreement-download" data-v="'+E(a.id)+'" aria-label="'+L('Download agreement for ','下载协议：')+E(t.id)+'">'+E(txt(a.agreement.name))+'</button>':'—'];}))+tail:CF.empty(L(currentRows(p).length&&reviewLoad!=='empty'?'No matching tokens':'No token applications',currentRows(p).length&&reviewLoad!=='empty'?'筛选无结果':'暂无代币申请'),'');}
    return filters+'<div class="ls-token-list">'+body+'</div>'+err()+resultRows(p,null);
  }
  function feeSnapshot(){return selection.map(id=>({id,application:D.latest(project(),id)?.id,deadline:D.approvalDeadline(D.latest(project(),id)),...D.quoteFee(id)}));}
  function feeTotals(){const totals={};feeQuote.forEach(f=>totals[f.currency]=(totals[f.currency]||0)+f.amount);return Object.entries(totals).map(([c,n])=>Number(n).toFixed(6)+' '+E(c)).join(' / ')||'—';}
  function validateDeposit(){
    const changes=[];D.sweep();selection.forEach(id=>{const a=D.latest(project(),id),old=feeQuote.find(f=>f.id===id);if(a?.state==='approved'&&!D.eligible(a)){try{D.recheck(a);}catch(_){}}
      if(!D.eligible(a)){changes.push(id+' · '+(a?unavailableReason(a):L('Unavailable','不可用')));return;}
      const fee=D.quoteFee(id);if(!old||old.application!==a.id||old.deadline!==D.approvalDeadline(a)||old.amount!==fee.amount||old.currency!==fee.currency)changes.push(id+' · '+L('Approval, deadline or fee changed.','申请、截止时间或费用已变化。'));
    });
    if(changes.length){selection=selection.filter(id=>D.eligible(D.latest(project(),id)));feeQuote=feeSnapshot();confirmationChanges=changes;error='';return false;}return selection.length>0;
  }
  const recordLoads={};
  function recordCard(id,title,render){const state=recordLoads[id];return card(title,state==='loading'?CF.skelTable(3):state==='error'?CF.empty(L('Unable to load records','记录加载失败'),'',btn('ls-record-retry',L('Retry','重试'),id)):render());}
  CF.LSRecords={setState:(id,state)=>{recordLoads[id]=state;CF.render();}};
  const detailSections=[['ls-pledged-tokens','Pledged tokens','质押代币'],['ls-applications','Financing applications','融资申请'],['ls-disbursements','Disbursements','融资放款'],['ls-repayments','Repayment','还款']];
  function sectionNavigation(){return '<nav class="ls-section-nav" aria-label="'+L('Project sections','项目详情分区')+'">'+detailSections.map(([id,en,zh],i)=>'<button type="button" data-ls-anchor="'+id+'" aria-controls="'+id+'"'+(!i?' aria-current="location"':'')+'>'+L(en,zh)+'</button>').join('')+'</nav>';}
  function syncSectionNavigation(){const nav=document.querySelector('.ls-section-nav');if(!nav)return;const edge=nav.getBoundingClientRect().bottom+24;let active=detailSections[0][0];detailSections.forEach(([id])=>{const el=document.getElementById(id);if(el&&el.getBoundingClientRect().top<=edge)active=id;});if(window.scrollY>0&&window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-3)active=detailSections.at(-1)[0];nav.querySelectorAll('button').forEach(el=>{if(el.dataset.lsAnchor===active)el.setAttribute('aria-current','location');else el.removeAttribute('aria-current');});}
  document.addEventListener('click',e=>{const button=e.target.closest('[data-ls-anchor]');if(!button)return;e.preventDefault();const id=button.dataset.lsAnchor;if(window.innerWidth<=900&&railExpanded){railExpanded=false;CF.render();sizeWorkspace();}const target=document.getElementById(id);target?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});target?.focus({preventScroll:true});});
  function detailPage(){const p=project();if(!p||p.state==='draft'&&!D.mine(p)&&!(Q&&Q.hasHistory(p)))return publicMissing();const n=D.numbers(p);let surface=CF.surface({emptyTitle:L('No project data','暂无项目数据'),emptyDesc:'',backTo:'/marketplace'});if(surface!==null)return surface;
    let warning='';if(n.gap)warning=note(L('Coverage shortfall: ','覆盖缺口：')+usd(n.gap)+L(' · Additional asset value required: ',' · 需追加资产价值：')+usd(n.gap/0.8)+L('. Additional collateral requires review; submission does not restore coverage immediately.','. 追加质押需先经审核，提交不即时生效。')+'<br>'+L('Triggered: ','触发时间：')+time(p.coverageAt),'warn');
    if(p.state==='draft'&&!n.value&&D.mine(p))warning+=note(L('This project has no valid collateral. Complete a token pledge before publishing a financing request.','本项目暂无有效质押，请先完成代币质押后再发布。'),'warn');
    const information=warning+stats(p)+'<p class="ls-pool-summary">'+L(n.pool.length+' pledged tokens · '+n.valid.length+' counted · '+(n.pool.length-n.valid.length)+' excluded from coverage',n.pool.length+' 张已质押 · '+n.valid.length+' 张计入覆盖 · '+(n.pool.length-n.valid.length)+' 张不计入覆盖')+'</p>'+sectionNavigation()+'<div id="ls-pledged-tokens" tabindex="-1">'+recordCard('tokens',L('Pledged tokens','质押代币清单'),()=>poolChart(p)+tokenTable(projectTokenList(p),D.mine(p)?'own':'public'))+'</div>'+'<div id="ls-applications" tabindex="-1">'+recordCard('applications',L('Financing applications','融资申请信息'),()=>demandTable(p))+'</div><div id="ls-disbursements" tabindex="-1">'+recordCard('disbursements',L('Financing disbursements','融资放款信息'),()=>CF.L7?.recordTable?CF.L7.recordTable(p):CF.empty(L('No disbursements yet','暂无融资放款'),''))+'</div><div id="ls-repayments" tabindex="-1">'+recordCard('repayments',L('Repayment information','还款信息'),()=>CF.L8?.recordTable?CF.L8.recordTable(p):CF.empty(L('No repayment business yet','暂无还款业务'),''))+'</div>';
    return (CF.AM&&CF.AM.returnDetail?'<a class="btn-link am-back-token" href="'+E(CF.AM.returnDetail)+'">'+L('← Back to token details','← 返回代币详情')+'</a>':'')+'<div class="ls-stack ls-detail'+(!n.pool.length&&!p.demands.length&&!p.balance?' ls-detail-new':'')+'">'+(fromConsole?'<div class="ls-row">'+btn('ls-handoff',L('Return to my console','返回我的控制台'),'console')+'</div>':'')+'<div class="ls-detail-head"><span class="tok-mark" aria-hidden="true">AR</span><div><p class="hint">'+(p.published?L('Published: ','发布时间：')+time(p.published):L('Created: ','创建时间：')+time(p.created))+(p.expires?' · '+L('Valid until: ','有效期至：')+time(p.expires):'')+' · <span class="mono">'+E(p.id)+'</span> · '+L('SPV: ','SPV 机构：')+E(txt(p.spv))+'</p><div class="ls-row"><h1 class="page-title">'+E(txt(p.name))+'</h1><span class="muted">'+E(owner(p))+'</span></div><div class="ls-row ls-detail-tags">'+tag(p.state)+(n.pool.length?tag(n.grade):'')+(p.expired?CF.tag('',L('Expired · existing business continues','已到期 · 存量处理中')):'')+'</div></div></div><div class="portal-cols ls-workspace"><div class="ls-stack ls-detail-main" role="region" aria-label="'+L('Project details','项目详情信息')+'">'+information+'</div><aside class="portal-rail ls-action-rail" aria-label="'+L('Project actions','项目操作')+'">'+actions(p)+'</aside></div></div>';
  }
  function eventNote(e){const a=D.applications.find(a=>a.id===e.application);if(!a)return '';return e.key==='approved'?small(L('Deposit by: ','入池截止：')+time(D.approvalDeadline(a))):e.key==='reviewTimeout'?small(L('48 hours without a review. No execution or fee; the reservation is released.','48 小时未完成审核。未执行、零费用，申请占用已释放。')):e.key==='rejected'?small(E(txt(reasons[a.reason]||[a.reason,a.reason]))):'';}
  function eventHistory(p){const ev=D.events.filter(e=>e.project===p.id);if(!ev.length)return '';const names={created:['Project created','项目已创建'],submitted:['Application submitted','申请已提交'],approved:['Review approved','审核通过'],rejected:['Review rejected','审核驳回'],applicationWithdrawn:['Application withdrawn','申请已撤回'],reviewTimeout:['Review timed out · no fees','审核超时失败 · 未产生费用'],approvalExpired:['Deposit window expired','入池结论已失效'],executionStarted:['Execution started','已发起执行'],executionSuccess:['Transfer completed','转移完成'],executionFailed:['Transfer failed','转移失败'],recheckFailed:['Pre-execution check failed','入池复核不通过'],reconciliation:['Reconciliation pending','对账处理中'],coverageShort:['Coverage shortfall triggered','覆盖不足提醒触发'],coverageRestored:['Coverage restored','覆盖不足提醒解除'],demandVoided:['Request expired due to coverage','融资需求因覆盖不足失效'],published:['Financing request published','融资需求已发布'],amountEdited:['Request amount changed','需求金额已修改'],demandWithdrawn:['Financing request withdrawn','融资需求已撤下'],businessRelease:['Collateral released · awaiting collection','已业务释放 · 待提取'],closed:['Project closed','项目已关闭'],projectExpired:['Project term expired','项目已到期']};return '<details class="ls-history card"><summary>'+L('Activity history','操作记录')+'</summary><div class="card-b">'+dataTable([L('Time','时间'),L('Event','事件'),L('Reference','关联记录')],ev.map(e=>[time(e.at),txt(names[e.key]||[e.key,e.key])+(e.application?eventNote(e):''),e.application?btn('ls-event-record',E(e.token)+' · '+E(e.application),e.application):E(e.ref)||'—']))+'</div></details>';}
  const kindNames={ar:['Receivables','应收账款']};
  function newPage(){if(S.role!=='asset')return publicMissing();
    const noTokens=S.st==='empty';
    const surface=noTokens?null:CF.surface({backTo:'/marketplace'});if(surface!==null)return surface;
    const kinds=noTokens?[]:D.kinds(),none=!kinds.length;
    const options=none?[['','No token type available','暂无可选代币类型']]:[['','Choose a type','请选择代币类型'],...kinds.map(k=>[k,(kindNames[k]||[k,k])[0],(kindNames[k]||[k,k])[1]])];
    return '<div class="ls-form ls-stack"><h1 class="page-title">'+L('Create financing project','创建融资项目')+'</h1>'
      +card(L('Project information','项目信息'),
        field('ls-name','Project name *','项目名称 *',name,'text','maxlength="60" required aria-describedby="ls-name-help"')
        +'<p class="hint" id="ls-name-help">'+L('1–60 characters','1～60 字符')+'</p>'
        +select('ls-kind','Token type *','代币类型 *',options,kind,'required'+(none?' disabled':''))
        +(none?'<p class="hint">'+L('Issue and sync a token for your company first, then create the project.','请先完成代币发行与同步，再创建融资项目。')+'</p>':'')
        +'<div class="field"><p class="field-label" id="ls-spv-label">'+L('SPV institution','SPV 机构名称')+'</p><p class="field-static" role="note" aria-labelledby="ls-spv-label">'+E(txt(D.SPV))+'</p></div>')
      +err()
      +'<div class="ls-form-foot"><p class="hint">'+L('After creation you land on the project page, where you start the token pledge yourself.','创建后进入项目详情页，在详情页自主发起代币质押。')+'</p>'
      +'<div class="ls-row">'+btn('ls-create',L('Create project','创建项目'),'',true,busy||none)+btn('ls-list',L('Cancel','取消'))+'</div></div></div>';}
  function selectionSummary(){const total=selection.map(D.token).filter(Boolean).reduce((v,t)=>v+t.value,0);return '<div class="ls-selected" role="status">'+L('Selected ','已选 ')+selection.length+L(' tokens · ',' 张 · ')+usd(total)+'</div>';}
  function fees(){return '<div class="ls-stack">'+selectionSummary()+dataTable([L('Token','代币'),L('Estimated blockchain fee','预估链上费用')],selection.map(id=>{const f=operation==='deposit'?feeQuote.find(f=>f.id===id):D.quoteFee(id),a=D.latest(project(),id);return [E(id)+(operation==='deposit'&&a?small(L('Deposit by: ','入池截止：')+time(D.approvalDeadline(a))):''),Number(f?.amount||0).toFixed(6)+' '+E(f?.currency||'ETH')];}))+note(L('Your company pays blockchain fees. Incurred fees are non-refundable, including failed transfers. The platform charges no service fee or advances payment.','链上费用由本企业承担，已产生费用不退，执行失败亦同。平台不收服务费、不代付。'),'warn')+(D.executions.filter(e=>D.now()-Date.parse(e.at)<86400000).length>5?note(L('Frequent on-chain operations incur more fees. Consider submitting tokens together.','频繁链上操作会产生较多费用，建议批量提交。'),'warn'):'')+'</div>';}
  let flowFrames=[],flowOrigin=null,discardLayer=null,publishInitial='',flowRestore=null,referenceCurrencies=[];
  const publishSnapshot=()=>JSON.stringify([amount,referenceCurrencies]);
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
  function hasEdits(){return S.layer?.key==='publish'&&publishSnapshot()!==publishInitial||['pledge','application','release','fees','execute'].includes(S.layer?.key)&&selection.length>0&&!(operation==='deposit'&&flowFrames.some(f=>f.layer.key==='review'));}
  function requestClose(){if(hasEdits()){discardLayer={layer:{...S.layer},top:document.querySelector('#layers .drawer-b, #layers .modal-b')?.scrollTop||0,focus:controlRef(document.activeElement)};CF.openLayer('modal','discard');}else closeFlow();}
  function locateRecord(id){setTimeout(()=>{const el=document.getElementById(id);el?.scrollIntoView({block:'start'});el?.focus({preventScroll:true});},0);}

  function clearSelection(){if(selection.length)CF.toast(L('Selection cleared.','已清空勾选。'));selection=[];}
  function returnToReview(){reviewReturn=false;error='';const previous=flowFrames.find(f=>f.layer.key==='review');flowFrames=[];CF.openLayer('modal','review');if(previous)flowRestore=previous;else focusReview=true;}
  function guarded(p){if(!p||!D.mine(p)){CF.toast(txt(errors.permission));return false;}return true;}
  function openPublish(){const p=project();if(!guarded(p))return;const a=D.actions(p);if(!a.edit&&!a.publish){CF.toast(txt(errors.publishChanged));return;}amount=D.current(p)?String(D.current(p).amount):'';referenceCurrencies=[...(D.current(p)?.referenceCurrencies||p.demands.at(-1)?.referenceCurrencies||[])];publishInitial=publishSnapshot();open('publish');}
  async function createProject(){if(busy)return;error='';
    if(!name.trim()||[...name.trim()].length>60){error=txt(errors.name);refocus='ls-name';CF.render();return;}
    if(!kind){error=txt(errors.kind);refocus='ls-kind';CF.render();return;}
    busy=true;CF.render();await new Promise(r=>setTimeout(r,350));
    try{const p=D.create(name,kind);name='';kind='';goto(p.id);CF.toast(L('Project created. Start the token pledge on this page.','项目已创建，可在本页发起代币质押。'));}
    catch(ex){showError(ex);}finally{busy=false;CF.render();}}
  function openPledge(){const p=project();if(!guarded(p))return;if(!D.actions(p).pledge){CF.toast(txt(reasons.closed));return;}selection=[];pages.select=1;open('pledge');}
  function openRelease(){const p=project();if(!guarded(p))return;if(!D.actions(p).withdraw){CF.toast(L('Current withdrawal limit: ','当前可撤回上限：')+usd(D.numbers(p).withdraw));return;}selection=[];operation='release';pages.select=1;open('release');}
  function beginDeposit(){if(!guarded(project())||!selection.length)return;operation='deposit';feeQuote=feeSnapshot();confirmationChanges=[];open('fees');validateDeposit();}
  async function commitApplication(){if(busy)return;busy=true;CF.render();await new Promise(r=>setTimeout(r,450));try{if(submitFail)throw Error('submitFailed');D.submit(project(),selection);selection=[];reviewReturn=false;S.layer=null;CF.toast(L('Application submitted. No fees incurred.','质押申请已提交，未产生费用。'));}catch(ex){showError(ex);}finally{busy=false;CF.render();}}
  const layers={
    executionResult:()=>({title:L('Operation started','操作已发起'),html:resultRows(project()),foot:btn('closelayer',L('Done','完成'),'',true)}),
    discard:()=>({title:L('Discard unsaved changes?','放弃尚未提交的内容？'),html:note(L('Your changes have not been submitted.','当前填写内容尚未提交。'),'warn'),foot:btn('ls-continue-edit',L('Continue editing','继续编辑'))+btn('ls-discard',L('Discard and close','放弃并关闭'),'',true)}),
    review:()=>({title:L('Pledge review & confirmation','质押审核与确认'),html:'<div class="ls-review-surface ls-stack">'+applications(project())+'</div>',foot:(D.mine(project())?'<span class="ls-review-selected">'+L('Selected: ','已选：')+selection.length+L(' tokens',' 张')+'</span>':'')+btn('closelayer',L('Close','关闭'))+(D.mine(project())?btn('ls-enter',L('Confirm deposit','确认入池'),'',true,!selection.length):'')}),
    tokenHistory:()=>({title:L('Token details & history','代币详情与历史')+' · '+historyToken,html:'<div class="ls-wide ls-stack">'+tokenHistory(historyToken)+err()+'</div>',foot:btn('ls-history-back',L('Back to tokens','返回代币清单'))}),
    agreement:()=>{const a=D.applications.find(a=>a.id===agreementId),allowed=a&&D.mine(D.project(a.project));return {title:L('Pledge agreement','质押协议'),html:'<div class="ls-medium">'+(allowed?'<p class="ls-raw">'+E(agreementText(a))+'</p>':publicMissing())+'</div>',foot:btn('ls-token-history',L('Back to history','返回历史'),a?.tokens[0]||'')};},
    pledgeNotifications:()=>({title:L('Pledge notification preview','质押通知预览'),html:'<div class="ls-wide ls-stack">'+(D.mine(project())?eventHistory(project()).replace('<details ','<details open '):publicMissing())+'</div>',foot:btn('closelayer',L('Close','关闭'))}),
    copy:data=>({title:L('Copy transaction hash','复制交易哈希'),html:'<p>'+L('Automatic copy is unavailable. Select and copy the hash below.','自动复制不可用，请选中下方哈希手动复制。')+'</p><textarea class="inp ls-raw" readonly aria-label="Hash">'+E(data)+'</textarea>',foot:btn('closelayer',L('Close','关闭'))}),
    pledge:()=>({title:pledgeLabel(project()),html:'<div class="ls-wide ls-stack">'+twoSteps()+tokenTable(D.candidates(project()),'select','select')+selectionSummary()+err()+'</div>',foot:btn('closelayer',L('Cancel','取消'))+btn('ls-confirm-application',L('Submit pledge application','提交质押申请'),'',true,!selection.length)}),
    application:()=>({title:L('Confirm pledge application','确认质押申请'),html:'<div class="ls-medium ls-stack">'+twoSteps()+selectionSummary()+err()+'</div>',foot:btn('ls-application-back',L('Back','返回'),'',false,busy)+btn('ls-submit',busy?L('Submitting…','提交中…'):L('Confirm submission','确认提交'),'',true,busy)}),
    publish:()=>{const p=project(),d=D.current(p),max=D.numbers(p).free+(d?d.amount:0);return {title:d?L('Edit financing amount','修改融资需求金额'):L('Publish financing request','发布融资需求'),html:'<div class="ls-medium ls-stack"><p>'+L('Available amount: ','当前可融金额：')+'<b class="num">'+usd(max)+'</b></p>'+field('ls-amount','Financing request (USD) *','融资需求金额（USD）*',amount,'text','inputmode="decimal" aria-describedby="ls-amount-error" aria-invalid="'+!!error+'"')+'<fieldset class="ls-reference-currencies"><legend>'+L('Reference settlement currencies *','参考结算币种 *')+'</legend>'+['USD','USDT','USDC'].map(c=>'<label><input type="checkbox" id="ls-reference-'+c+'" data-ls-reference="'+c+'"'+(referenceCurrencies.includes(c)?' checked':'')+'> '+c+'</label>').join('')+'<p class="hint">'+L('For reference only. The funder may quote in another supported currency.','仅供参考，不限制资金方实际报价币种。')+'</p></fieldset>'+'<div id="ls-amount-error">'+err()+'</div>'+note(L('Publishing makes this request public and reserves the amount. The project term is one year from first publication.','发布后融资需求将公开并占用额度，项目有效期为首次发布起一年。'))+'</div>',foot:btn('closelayer',L('Cancel','取消'))+btn('ls-publish-confirm',L('Confirm','确认'),'',true,busy)};},
    release:()=>{const p=project(),n=D.numbers(p),all=D.tokens.filter(t=>t.pool===p.id&&t.pledge==='pledged'||t.releasedFrom===p.id&&t.pledge==='released');const chosen=selection.map(D.token).filter(t=>t.pledge==='pledged'&&t.valid).reduce((v,t)=>v+t.value,0);return {title:L('Release collateral','解除质押'),html:'<div class="ls-wide ls-stack"><section><h3>'+L('Expired · withdraw at any time','已失效 · 可随时撤回')+'</h3>'+tokenTable(all.filter(t=>!t.valid&&t.pledge==='pledged'),'release','invalid')+'</section><section><h3>'+L('Valid collateral · subject to limit','有效抵押物 · 受额度限制')+'</h3>'+note(L('Current withdrawal limit: ','当前最多可撤回：')+usd(n.withdraw)) +tokenTable(all.filter(t=>t.valid&&t.pledge==='pledged'),'release','valid')+'<p role="status">'+L('Selected valid collateral: ','拟撤回有效抵押物价值：')+usd(chosen)+L(' · Difference: ',' · 超出差额：')+usd(Math.max(0,chosen-n.withdraw))+'</p>'+(chosen>n.withdraw?note(txt(errors.withdrawLimit),'danger'):'')+'</section><section><h3>'+L('Released · awaiting collection','已释放 · 待提取')+'</h3>'+tokenTable(all.filter(t=>t.pledge==='released'),'release','released')+'</section>'+note(L('Tokens are returned to their original holding address. You cannot change the destination.','代币将转回质押前的原持有地址，不能更改目的地址。'))+selectionSummary()+err()+'</div>',foot:btn('closelayer',L('Cancel','取消'))+btn('ls-release-fees',L('Continue','继续'),'',true,!selection.length)};},
    fees:()=>{const deposit=operation==='deposit';return {title:deposit?L('Confirm pledge deposit','确认质押入池'):L('Review operation and fees','核对操作与费用'),html:'<div class="'+(deposit?'ls-medium ls-stack ls-deposit-confirm':'ls-wide')+'">'+(deposit?'<div><span class="muted">'+L('Destination project','入池项目')+'</span><p class="cell-main">'+E(txt(project().name))+'</p></div>':'')+(deposit&&confirmationChanges.length?note(L('Nothing has started. Review these changes and confirm the updated selection:','尚未发起。请核对以下变化，再确认更新后的选择：')+'<ul>'+confirmationChanges.map(c=>'<li>'+E(c)+'</li>').join('')+'</ul>','warn'):'')+fees()+(deposit?operationMetric(L('Total estimated blockchain fees','预估链上费用合计'),feeTotals()):'')+err()+'</div>',foot:btn('closelayer',L('Cancel','取消'),'',false,busy)+btn(deposit?'ls-execute':'ls-second-confirm',busy?L('Starting…','发起中…'):deposit?L('Confirm fees and start deposit','确认费用并发起入池'):L('Continue','继续'),'',true,busy||(deposit&&!selection.length))};},
    execute:()=>({title:L('Confirm blockchain fees','确认链上费用'),html:'<div class="ls-medium ls-stack">'+fees()+note(L('Confirm that your company will pay the estimated fees for these tokens.','请确认本企业承担本次代币操作的预估链上费用。'),'warn')+err()+'</div>',foot:btn('closelayer',L('Cancel','取消'))+btn('ls-execute',busy?L('Starting…','发起中…'):L('Confirm and start','确认并发起'),'',true,busy)}),
    close:()=>{const p=project(),n=D.numbers(p),a=D.actions(p);return {title:L('Close project','关闭项目'),html:'<div class="ls-medium">'+(a.canClose?note(CF.L8?.available(p).length?L('Closing the project triggers collateral release. Check the confirmed result before collecting tokens.','关闭项目后触发质押释放，请以确认结果为准办理提取。'):L('The project will close and its collateral will be released without fees. Tokens remain in the contract until you collect them; collection incurs blockchain fees.','关闭后即时解除质押占用，不产生费用。代币仍在合约内，需自行提取；提取将产生链上费用。'),'warn'):note(txt(errors.cannotClose)+'<br>'+L('Outstanding financing: ','项目融资余额：')+usd(p.balance)+'<br>'+L('Committed demand: ','项目在途金额：')+usd(n.fly),'danger'))+err()+'</div>',foot:btn('closelayer',L('Cancel','取消'))+btn('ls-close-confirm',L('Confirm close','确认关闭'),'',true,!a.canClose)};},
    endDemand:()=>({title:L('Withdraw financing request','撤下融资需求'),html:note(L('The financing request will no longer accept quotes. Its reserved amount will be released. Existing collateral stays in the pool.','撤下后不再接受报价，释放该需求的在途占用，池内质押保留。'),'warn')+err(),foot:btn('closelayer',L('Cancel','取消'))+btn('ls-end-confirm',L('Confirm withdrawal','确认撤下'),'',true)}),
    cancelApp:()=>({title:L('Withdraw pledge application','撤回质押申请'),html:note(L('Tokens will become available for a new application. No on-chain operation or fees have occurred.','撤回后代币可重新提交质押。未发生链上操作，未产生任何费用。'))+err(),foot:btn('closelayer',L('Cancel','取消'))+btn('ls-cancel-confirm',L('Confirm withdrawal','确认撤回'),'',true)}),
    handoff:data=>({title:L('Continue to the next step','继续办理'),html:'<p>'+L('This action continues in the '+({quote:'quotation',funding:'funding',repay:'repayment',console:'my console'}[data]||'related')+' module.','此操作由'+({quote:'融资报价',funding:'融资放款',repay:'还款',console:'我的控制台'}[data]||'相关')+'模块承接。')+'</p>',foot:btn('closelayer',L('Return','返回'))})
  };
  const l5LayerKeys=Object.keys(layers);
  l5LayerKeys.forEach(key=>{const render=layers[key];layers[key]=data=>{const body=render(data);return {...body,title:body.title+(project()?' · '+project().id:''),html:'<div class="ls-flow">'+body.html+'</div>',foot:(flowFrames.length&&key!=='discard'&&!['application','tokenHistory','agreement'].includes(key)?btn('ls-back',L('Back','返回')):'')+(body.foot||'')};};});
  function footer(){document.getElementById('foot').innerHTML='<div class="ft-in"><p class="ft-mark">Harbour Credit</p><p class="ft-tag">'+L('Cross-border receivables financing on tokenised assets.','基于代币化资产的跨境应收账款融资。')+'</p><nav class="ft-links">'+['Terms','Privacy','Risk disclosure','Contact'].map((t,i)=>'<a href="#" data-act="ls-handoff">'+L(t,['服务协议','隐私声明','风险揭示','联系我们'][i])+'</a>').join('')+'</nav><div class="ft-meta"><span>'+L('Demonstration data — no real companies, amounts or transactions','演示数据 —— 非真实企业、金额或链上交易')+'</span><span>'+E(S.tz||'UTC')+'</span></div></div>';}
  function tools(){if(!S.demo)return;const el=document.getElementById('demoPanel');if(el.querySelector('.ls-review,.cq-guide'))return;const end=el.querySelector('.grp');if(end)end.remove();let box=document.createElement('div');box.className='ls-review';box.innerHTML=select('ls-demo-record','Project record list','项目清单',[['tokens','Pledged tokens','质押代币'],['applications','Applications','融资申请'],['disbursements','Disbursements','融资放款'],['repayments','Repayments','还款信息']],'tokens')+select('ls-demo-record-state','List loading state','清单读取状态',[['default','Default','正常'],['loading','Loading','加载中'],['error','Failed','读取失败']],'default')+'<h5>'+L('External events · review only','外部事件 · 仅供评审')+'</h5>'+select('ls-demo-project','Open project','打开项目',D.projects.filter(p=>p.state!=='draft'||D.mine(p)).map(p=>[p.id,p.name[0],p.name[1]]),project()?.id||D.projects[0].id)+btn('ls-demo-project',L('Open','打开'))+select('ls-demo-application','Review one application','审核单笔', [['','Latest pending','最近待审笔'],...D.applications.filter(a=>a.project===(project()?.id||D.projects[0].id)&&a.state==='review').map(a=>[a.id,a.tokens[0]+' · '+a.id,a.tokens[0]+' · '+a.id])],demoApplication)+'<div class="ls-block ls-row">'+btn('ls-demo-event',L('Approve','审核通过'),'approve')+btn('ls-demo-event',L('Reject','驳回'),'reject')+btn('ls-demo-event',L('+2 days','推进 2 天'),'twoDays')+btn('ls-demo-event',L('+8 days','推进 8 天'),'eightDays')+'</div>'+select('ls-outcome','Execution result','执行结果',[['success','All return success','逐张成功'],['mixed','Two success, one failure','2 成 1 败'],['failure','Execution failed · charged','执行失败 · 已产生费用'],['noFee','Execution failed · no fee','执行失败 · 零费用'],['wait','Await results','等待回写']],outcome)+btn('ls-demo-event',L('Return results','回写结果'),'results')+select('ls-gate','Next execution attempt','下次发起执行',[['normal','Available','正常'],['feeChange','One fee changes at confirmation','确认时一张费用变化'],['expiryChange','One deadline passes at confirmation','确认时一张到期'],['unavailable','Execution entry unavailable','执行入口不可用'],['nogas','Insufficient fee balance','费用余额不足'],['recheck','Recheck failed','复核不通过']],executionGate)+'<div class="ls-row">'+btn('ls-demo-event',L('Late success','迟到成功回写'),'late')+btn('ls-demo-event',L('Token expires','代币失效'),'expire')+btn('ls-demo-event',L('Amount changes','额度变化'),'amountChange')+btn('ls-demo-event',L('Permission rejection','越权写入反馈'),'deniedWrite')+btn('ls-demo-event',L('From my console','从控制台进入'),'fromConsole')+'</div>'+select('ls-review-load','Token list state','代币清单状态',[['default','Default','默认'],['loading','Loading','加载中'],['empty','Empty','空数据'],['error','Load failed','加载失败']],reviewLoad)+'<label class="ls-check"><input type="checkbox" id="ls-agreement-fail" '+(agreementFail?'checked':'')+'>'+L('Agreement load failure','协议读取失败')+'</label>'+btn('ls-pledge-notifications',L('Pledge notification preview','质押通知预览'))+'<label class="ls-check"><input id="ls-submit-fail" type="checkbox" '+(submitFail?'checked':'')+'>'+L('Submission failure','提交失败')+'</label><p class="why">'+L('Simulated events and fees. Wallet/signature hosting and real cross-platform connections are not implemented. +2 days advances the demo clock; the deadline check runs automatically.','演示事件与费用，未实现钱包签名及真实跨平台连接。推进 2 天只改变演示时钟，到期判定自动运行。')+'</p>'+btn('ls-demo-event',L('Reset demonstration','重置演示数据'),'reset');el.appendChild(box);}
  async function copyHash(value){try{if(navigator.clipboard)await navigator.clipboard.writeText(value);else{const input=document.createElement('textarea');input.value=value;input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();const ok=document.execCommand('copy');input.remove();if(!ok)throw Error('copy');}CF.toast(L('Hash copied.','哈希已复制。'));}catch(_){CF.openLayer('drawer','copy',value);}}
  function saveDetail(){if(S.layer&&['review','fees','execute','tokenHistory','agreement','cancelApp','pledgeNotifications'].includes(S.layer.key)&&!D.mine(project())){S.layer=null;selection=[];}const panel=document.querySelector('.ls-action-panel');if(panel)detailCache[panel.dataset.project+':'+panel.dataset.tab]=panel.scrollTop;if(S.layer?.key==='review'){document.querySelectorAll('[data-record]').forEach(el=>{if(el.open)expandedRecords.add(el.dataset.record);else expandedRecords.delete(el.dataset.record);});reviewScroll=document.querySelector('#layers .drawer-b, #layers .modal-b')?.scrollTop||0;}}
  function restoreDetail(){const panel=document.querySelector('.ls-action-panel'),p=project();if(panel&&p){panel.dataset.project=p.id;panel.dataset.tab=currentTab();panel.scrollTop=detailCache[p.id+':'+currentTab()]||0;}sizeWorkspace();if(flowRestore){const previous=flowRestore;flowRestore=null;setTimeout(()=>{const body=document.querySelector('#layers .drawer-b, #layers .modal-b');if(body)body.scrollTop=previous.top;restoreControl(previous.focus);},0);}}
  function sizeWorkspace(){const box=document.querySelector('.ls-workspace');if(!box)return;const top=(document.querySelector('.portal-head')?.getBoundingClientRect().height||68)+12;box.style.setProperty('--ls-rail-top',top+'px');const rail=box.querySelector('.ls-action-rail');const anchorTop=top+(window.innerWidth<=900&&rail?rail.getBoundingClientRect().height+8:0);box.style.setProperty('--ls-section-top',anchorTop+'px');syncSectionNavigation();if(rail)box.style.setProperty('--ls-rail-room',Math.max(190,window.innerHeight-top-16)+'px');}
  window.addEventListener('resize',sizeWorkspace);
  let scrollFrame=false;window.addEventListener('scroll',()=>{if(!scrollFrame){scrollFrame=true;requestAnimationFrame(()=>{sizeWorkspace();scrollFrame=false;});}},{passive:true});
  function enhance(){const modal=document.querySelector('#layers .modal:has(.ls-flow,.cq-flow,.ln-drawer,.ln-confirm,.rp-drawer,.rp-confirm)');if(modal&&!modal.querySelector('.ls-modal-close')){const close=document.createElement('button');close.className='btn ghost sm ls-modal-close';close.dataset.act='closelayer';close.type='button';close.setAttribute('aria-label',L('Close','关闭'));close.textContent='×';modal.querySelector('.modal-h')?.append(close);}if(CF.AM && ![LIST,DETAIL,NEW].includes(S.page))return;footer();tools();if(Q){Q.enhance();Q.organizeTools();}document.getElementById('portal').inert=!!S.layer;sizeWorkspace();if(focusReview&&S.layer?.key==='review'){const heading=document.querySelector('#layers .drawer-h, #layers .modal-h');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});document.querySelector('#layers .drawer-b, #layers .modal-b').scrollTop=0;}focusReview=false;}else if(S.layer?.key==='review'){const body=document.querySelector('#layers .drawer-b, #layers .modal-b');if(body)body.scrollTop=reviewScroll;}document.querySelectorAll('.nav-item').forEach(a=>{if(a.getAttribute('href')==='#/marketplace'&&[LIST,DETAIL,NEW].includes(S.page))a.setAttribute('aria-current','page');});if(!document.querySelector('.ls-demo-mark')){const el=document.createElement('p');el.className='ls-demo-mark';el.textContent=L('Demonstration data','演示数据');document.getElementById('content').prepend(el);}if(refocus){document.getElementById(refocus)?.focus({preventScroll:true});refocus=null;}sizeWorkspace();}
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
    states:id===LIST?['default','loading','empty','noresult','error','denied']:['default','loading','empty','error','denied'],
    route:()=>id===LIST?'/marketplace':id===NEW?'/project/new':'/project/'+D.projects.find(p=>p.state!=='draft').id,
    beforeChange(proceed){if(busy||S.layer){CF.toast(L('Finish or cancel the current operation first.','请先完成或取消当前操作。'));return;}proceed();},
    reset(){S.st='default';reviewLoad='default';agreementFail=false;submitFail=false;}
  }));

  CF.define(CF.LSView={id:'lending-marketplace',pages:[LIST,DETAIL,NEW],breadcrumbRoute:id=>id===LIST?CF.ENTRY[LIST]:null,dict:{en:{navHome:'Home',navAssets:'Asset marketplace',navPlaza:'Lending marketplace',navConsole:'My console',lsDetail:'Financing project',lsNew:'Create project'},zh:{navHome:'首页',navAssets:'资产广场',navPlaza:'借贷广场',navConsole:'我的控制台',lsDetail:'融资项目详情',lsNew:'创建融资项目'}},layers:Object.assign(layers,Q?Q.layers:{}),beforeRender:saveDetail,afterRender:restoreDetail,onBeforeAct(act,v,e){if(Q&&Q.beforeAct(act,e))return true;if(act==='closelayer'&&ownLayer()){if(busy)return true;if(S.layer.key==='discard'){S.layer=discardLayer.layer;flowRestore=discardLayer;discardLayer=null;return true;}requestClose();return true;}return false;},content(id){D.sweep();if(Q)Q.sweep();setTimeout(enhance,0);if(id===NEW)return newPage();if(id===DETAIL)return detailPage();return listPage();},onAct(act,v){
    if(Q&&Q.onAct(act,v))return true;
    const p=project();
    try{
      if(act==='ls-record-retry'){recordLoads[v]='loading';setTimeout(()=>{delete recordLoads[v];CF.render();},350);return true;}
      if(act==='ls-back'){backStep();return true;}
      if(act==='ls-continue-edit'){if(discardLayer){S.layer=discardLayer.layer;flowRestore=discardLayer;discardLayer=null;}return true;}
      if(act==='ls-discard'){closeFlow();return true;}
      if(act==='ls-rail-toggle'){railExpanded=!railExpanded;return true;}
      if(act==='ls-tab'){actionTabs[p.id]=v;railExpanded=true;refocus='ls-tab-'+v;return true;}
      if(act==='ls-review'){if(guarded(p)){clearSelection();reviewReturn=false;reviewScroll=0;open('review');}return true;}
      if(act==='ls-list'){S.layer=null;location.hash='#'+CF.ENTRY[LIST];return true;}
      if(act==='ls-new'){if(S.role!=='asset')throw Error('permission');selection=[];name='';kind='';error='';pages.select=1;location.hash='#/project/new';return true;}
      if(act==='ls-create'){createProject();return true;}
      if(act==='ls-detail'){pages.tokens=pages.demands=1;goto(v);return true;}
      if(act==='ls-sort-column'){filter.sort=v==='newest'&&(!filter.sort||filter.sort==='newest')?'oldest':v;writeFilters();return true;}
      if(act==='ls-filter'){['keyword','vmin','vmax','amin','amax'].forEach(k=>{const el=document.getElementById('ls-'+k);if(el)filter[k]=el.value;});writeFilters();return true;}
      if(act==='filter-set'){const [id,mode]=String(v).split('|'),key=id.replace('ls-','');
        filter[key]=mode==='all'?Array.from(document.querySelectorAll('[data-filter="'+id+'"]')).map(b=>b.value).join(','):'';
        refocus=id;writeFilters();return true;}
      if(act==='ls-clear'){filter={};S.st='default';writeFilters();return true;}
      if(act==='ls-page'){const [k,n]=v.split(':');pages[k]=Math.max(1,+n);return true;}
      if(act==='ls-pledge'){openPledge();return true;}
      if(act==='ls-confirm-application'){if(!selection.length)throw Error('selectionChanged');open('application');return true;}
      if(act==='ls-application-back'){backStep();return true;}
      if(act==='ls-submit'){commitApplication();return true;}
      if(act==='ls-publish'){openPublish();return true;}
      if(act==='ls-publish-confirm'){const max=D.numbers(p).free+(D.current(p)?.amount||0),n=Number(amount);if(!/^\d+(\.\d{1,2})?$/.test(amount)||n<=0||n>max){error=txt(errors.amount)+' '+L('Available: ','可融金额：')+usd(max)+L(' · Excess: ',' · 超出差额：')+usd(Math.max(0,n-max)||0);refocus='ls-amount';return true;}if(!referenceCurrencies.length){error=L('Choose at least one reference currency.','请至少选择一种参考结算币种。');refocus='ls-reference-USD';return true;}D.publish(p,n,!!D.current(p),referenceCurrencies);closeFlow();pages.demands=1;locateRecord('ls-applications');CF.toast(L('Financing request saved.','融资需求已保存。'));return true;}
      if(act==='ls-release'){openRelease();return true;}
      if(act==='ls-release-fees'){const n=D.numbers(p),total=selection.map(D.token).filter(t=>t.valid&&t.pledge==='pledged').reduce((v,t)=>v+t.value,0);if(total>n.withdraw)throw Error('withdrawLimit');operation='release';open('fees');return true;}
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
        else{flowFrames=[];CF.openLayer('modal','executionResult');CF.toast(L('Execution started. Results will appear per token.','已发起执行，结果将逐张更新。')); }return true;
      }
      if(act==='ls-review-filter'||act==='ls-review-reset'){clearSelection();pages.review=1;reviewFilter=act==='ls-review-reset'?{}:{keyword:document.getElementById('ls-review-keyword').value,state:document.getElementById('ls-review-state').value,progress:document.getElementById('ls-review-progress').value};return true;}
      if(act==='ls-review-retry'){reviewLoad='loading';setTimeout(()=>{reviewLoad='default';CF.render();},350);return true;}
      if(act==='ls-token-history'){if(!guarded(p))return true;historyToken=v;open('tokenHistory');return true;}
      if(act==='ls-history-back'){returnToReview();return true;}
      if(act==='ls-agreement'||act==='ls-agreement-download'){agreementAction(v,act==='ls-agreement-download');return true;}
      if(act==='ls-reapply'){if(!guarded(p))return true;if(!D.selectable(D.token(v),p)||D.terminal(p))throw Error('selectionChanged');selection=[v];open('application');return true;}
      if(act==='ls-event-record'){const a=D.applications.find(a=>a.id===v&&a.project===p.id);if(!a||!guarded(p))return true;clearSelection();historyToken=a.tokens[0];open('tokenHistory');setTimeout(()=>document.getElementById('record-'+a.id)?.scrollIntoView({block:'start'}),0);return true;}
      if(act==='ls-pledge-notifications'){if(guarded(p))open('pledgeNotifications');return true;}
      if(act==='ls-close'){if(guarded(p))open('close');return true;}
      if(act==='ls-close-confirm'){D.close(p);closeFlow();return true;}
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
  document.addEventListener('input',e=>{if(e.target.id==='ls-name')name=e.target.value;if(e.target.id==='ls-amount')amount=e.target.value;});
  document.addEventListener('change',e=>{
    if(e.target.dataset.filter&&e.target.dataset.filter.startsWith('ls-')){
      const id=e.target.dataset.filter,key=id.replace('ls-','');
      filter[key]=Array.from(document.querySelectorAll('[data-filter="'+id+'"]')).filter(b=>b.checked).map(b=>b.value).join(',');
      refocus=e.target.id;writeFilters();return;
    }
    if(e.target.dataset.lsReference){referenceCurrencies=['USD','USDT','USDC'].filter(c=>document.getElementById('ls-reference-'+c)?.checked);error='';}
    const el=e.target;if(el.id==='ls-kind'){kind=el.value;selection=[];pages.select=1;refocus=el.id;CF.render();}
    if(el.dataset.depositToken){const id=el.dataset.depositToken;if(D.eligible(D.latest(project(),id)))selection=el.checked?[...new Set([...selection,id])]:selection.filter(x=>x!==id);CF.render();setTimeout(()=>document.querySelector('[data-deposit-token="'+id+'"]')?.focus({preventScroll:true}),0);}
    if(el.id==='ls-demo-record-state'){const id=document.getElementById('ls-demo-record').value;recordLoads[id]=el.value;CF.render();}if(el.id==='ls-review-load')reviewLoad=el.value;if(el.id==='ls-demo-application')demoApplication=el.value;if(el.id==='ls-agreement-fail')agreementFail=el.checked;
    if(el.dataset.token){const id=el.dataset.token;selection=el.checked?[...new Set([...selection,id])]:selection.filter(x=>x!==id);CF.render();setTimeout(()=>document.querySelector('[data-token="'+id+'"]')?.focus(),0);}
    if(el.id==='ls-outcome')outcome=el.value;if(el.id==='ls-gate')executionGate=el.value;if(el.id==='ls-submit-fail')submitFail=el.checked;
    if(el.id==='ls-sort'){filter.sort=el.value;writeFilters();refocus=el.id;CF.render();}
  });
  document.addEventListener('click',e=>{
    if(CF.AM && ![LIST,DETAIL,NEW].includes(S.page))return;
    savePosition();const a=e.target.closest('a');if(a&&!(CF.AM&&a.getAttribute('href')==='#/assets')&&['#/','#/assets','#/console'].includes(a.getAttribute('href'))){e.preventDefault();if(a.getAttribute('href')==='#/assets'&&document.querySelector('script[src]')){location.href='../资产广场/资产广场.html#/assets';return;}CF.openLayer('modal','handoff',a.getAttribute('href')==='#/console'?'console':'other');}
    const el=e.target.closest('[data-act]');if(el&&el.dataset.act==='clearfilter')filter={};
    if(el&&el.dataset.act==='role'){reviewReturn=false;S.layer=null;error='';selection=[];}
    if(el&&el.dataset.act==='closelayer'&&busy){e.stopImmediatePropagation();return;}
  });
  document.addEventListener('keydown',e=>{
    if(e.target.matches('.ls-project-row,.ls-financing-row')&&['Enter',' '].includes(e.key)){e.preventDefault();e.target.click();return;}
    if(e.target.matches('.ls-tabs [role=tab]')&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const tabs=[...document.querySelectorAll('.ls-tabs [role=tab]')],i=tabs.indexOf(e.target),next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length;tabs[next].click();return;}
    if(e.key==='Enter'&&e.target.id==='ls-keyword'){e.preventDefault();document.querySelector('[data-act=\"ls-filter\"]').click();return;}
    const dialog=document.querySelector('#layers [role="dialog"]');if(!dialog)return;
    if(e.key==='Escape'&&busy){e.stopImmediatePropagation();return;}
  });
  window.addEventListener('hashchange',()=>{if(CF.AM && !/^\/(project|marketplace)(?:[/?]|$)/.test(path()))return;savePosition();clearSelection();S.layer=null;reviewReturn=false;railExpanded=false;reviewScroll=0;expandedRecords.clear();syncRoute();error='';pages.tokens=pages.demands=1;const isList=/^\/marketplace(?:\?|$)/.test(path());if(isList){listRoute=path();filter=readFilters(listRoute);}pendingAction=new URLSearchParams(path().split('?')[1]||'').get('action');setTimeout(()=>{if(isList)restorePosition();else{deepAction();window.scrollTo(0,0);}},0);});
  function deepAction(){if(!pendingAction)return;const action=pendingAction;pendingAction=null;const p=project();if(Q&&['quote','quote_confirm'].includes(action)){Q.deepAction(action);return;}if(!p||!D.mine(p))return;if(action==='pledge')openPledge();else if(action==='publish')openPublish();else if(action==='withdraw'||action==='redeem')openRelease();else if(action==='enter_pool'){clearSelection();const ref=new URLSearchParams(path().split('?')[1]||'').get('application'),a=D.applications.find(a=>a.project===p.id&&a.id===ref);if(a){historyToken=a.tokens[0];open('tokenHistory');setTimeout(()=>document.getElementById('record-'+a.id)?.scrollIntoView({block:'start'}),0);}else open('review');}}
  // The timer only updates simulated deadline outcomes. It never performs network work.
  setInterval(()=>{if(D.sweep())CF.render();},1000);
  if(!path()||path()==='/')location.hash='#/marketplace';syncRoute();if(/^\/marketplace(?:\?|$)/.test(path())){listRoute=path();filter=readFilters(listRoute);}pendingAction=new URLSearchParams(path().split('?')[1]||'').get('action');if(!CF.deferBoot)CF.boot();setTimeout(()=>{if(CF.AM && !/^\/(project|marketplace)(?:[/?]|$)/.test(path()))return;if(/^\/marketplace(?:\?|$)/.test(path()))restorePosition();else{deepAction();window.scrollTo(0,0);}},0);
})(window.CF);
