/* Existing-system adaptation · operations overview. Counts are read-only; actions
   enter the existing source lists. All service/permission fixtures remain local. */
(function(CF){
  'use strict';
  const S=CF.S,L=CF.L,E=CF.esc,OPS=CF.opsAccountModule,D=CF.opsOverviewData,P='P-O-AL-07';
  const sources={
    tokens:{permission:21,write:22,nav:'tokens',route:'/ops/token-admissions?status=pending&page=1&sort=submittedAt&dir=1',
      stat:['Admitted tokens','已准入代币'],task:['Tokens awaiting review','待审核代币'],unit:['records','笔'],
      group:['Token admissions','代币准入'],recent:[['approved',['Approved','通过']],['returned',['Returned','退回']]]},
    contracts:{permission:17,write:18,nav:'contracts',route:'/ops/contract-reviews?review=pending&page=1&dir=1',
      stat:['Approved projects','已通过项目'],task:['Projects awaiting review','待审核项目'],unit:['projects','个'],
      group:['Financing projects','融资项目'],recent:[['decided',['Manually decided','人工审结']]]},
    institutions:{permission:5,write:6,nav:'institution',route:'/ops/institution-reviews?state=submitted&page=1',
      stat:['Certified funders','已认证资金方机构'],task:['Funders awaiting review','待审核资金方机构'],unit:['institutions','家']},
    parameters:{permission:19,write:20,nav:'parameters',route:'/ops/financing-parameters?status=unset&page=1&size=20',
      task:['Parameters to configure','待配置融资参数'],unit:['combinations','个组合']},
    // Platform-wide financing totals only (PM-OV-01); no item-level or per-company data.
    finance:{permission:23}
  };
  // Each amount pairs with its daily series; the series colour identifies it in both places.
  const amounts=[
    {key:'tokens',field:'value',series:'tokenValue',tone:'1',ccy:'USD',label:['Token value','代币价值'],
      today:['Admitted today','今日新准入'],note:['Issuance value at issuance-time rates','签发价值，按签发时汇率折算']},
    {key:'finance',field:'demand',series:'newDemand',tone:'2',ccy:'USDT',label:['Financing demand','融资需求金额'],
      today:['Published today','今日新发布'],note:['Published demand not yet ended','已发布、未终结的需求']},
    {key:'finance',field:'funded',series:'newLoans',tone:'3',ccy:'USDT',label:['Funded balance','已融资余额'],
      today:['Disbursed today','今日新增放款'],note:['Disbursed principal not yet repaid','已放款、未偿还的本金']}
  ];
  const charts=[
    {ccy:'USD',title:['New token value admitted','新准入代币价值'],series:[{key:'tokens',id:'tokenValue',tone:'1',label:['Token value admitted','新准入代币价值']}]},
    {ccy:'USDT',title:['New financing demand and disbursements','新发布融资需求与新增放款'],series:[
      {key:'finance',id:'newDemand',tone:'2',label:['Demand published','新发布融资需求']},
      {key:'finance',id:'newLoans',tone:'3',label:['Disbursed','新增放款']}]}
  ];
  let scene='default',entered=false,scheduled=false,signature='',cache={},versions={},view='chart';
  const tr=x=>L(...x),can=key=>CF.opsAuth.can(sources[key].permission),keys=()=>Object.keys(sources).filter(can);
  const menu=key=>CF.AdminMenu.entries.find(e=>e.key===sources[key].nav);
  const sourceLabel=key=>tr(menu(key).label);
  // Category marks reuse the menu's vocabulary; they do not encode business status.
  const mark=key=>'<span class="ov-source-mark" data-source="'+key+'" aria-hidden="true">'+menu(key).icon+'</span>';
  const busy=()=>keys().some(k=>cache[k]?.state==='loading');
  const locale=()=>S.lang==='zh'?'zh-CN':'en-US';
  const count=n=>new Intl.NumberFormat(locale(),{maximumFractionDigits:0}).format(n);
  const unit=(key,n)=>S.lang==='en'&&n===1?sources[key].unit[0].replace(/s$/,''):tr(sources[key].unit);
  const pick=(data,path)=>path.split('.').reduce((o,k)=>o==null?null:o[k],data);
  // Exact two-decimal amount from integer cents, without floating-point drift.
  function money(c){const s=String(Math.round(c)).padStart(3,'0');return s.slice(0,-2).replace(/\B(?=(\d{3})+(?!\d))/g,',')+'.'+s.slice(-2);}
  // Same K/M/B rule as the marketplace amount summary; the exact value stays one click away.
  function compact(c,digits=2){const n=c/100,unit=[[1e9,'B'],[1e6,'M'],[1e3,'K']].find(([scale])=>n>=scale||Number((n/(scale/1000)).toFixed(digits))>=1000&&n>=scale/1000);
    return unit?(n/unit[0]).toFixed(digits)+unit[1]:digits?money(c):String(Math.round(n));}
  const stamp=at=>'<time datetime="'+new Date(at).toISOString()+'">'+E(CF.fmtStamp(at))+'</time>';
  const time=at=>'<span class="ov-time">'+L('Data as of ','数据时间 ')+stamp(at)+'</span>';
  const retry=key=>'<button type="button" class="ov-inline" data-act="ov-retry" data-v="'+key+'">'+L('Retry','重试')+'</button>';
  const utcDay=t=>new Date(t).toISOString().slice(0,10);
  function feedback(key){
    const c=cache[key];if(!c||c.state==='loading')return '<span class="ov-state" role="status"><span class="spinner" aria-hidden="true"></span>'+L(c?.data?'Updating…':'Loading…',c?.data?'正在更新…':'正在获取…')+'</span>';
    if(c.state==='error')return '<span class="ov-state" data-tone="warn">'+L(c.data?'Update failed · previous data':'Unable to load',c.data?'更新失败 · 上次数据':'读取失败')+retry(key)+'</span>';
    return '';
  }
  // While first loading, the adjacent progress status stands in for the number.
  const unavailable=key=>cache[key]?.data||cache[key]?.state==='error'?'<span class="ov-unavailable">'+L('Unavailable','暂不可用')+'</span>':'';
  // Exact integer with its unit; a missing value is never rendered as 0.
  const exact=(key,n,cls,id)=>n==null?unavailable(key):'<span class="'+(cls||'ov-number')+'" data-ov-value="'+key+'-'+id+'">'+count(n)+'<span class="ov-number-unit">'+unit(key,n)+'</span></span>';
  const figure=(key,path,cls)=>exact(key,cache[key]?.data?pick(cache[key].data,path):null,cls,path);
  const series=(key,id)=>cache[key]?.data?.daily?.[id]||null;
  // Currency icon (when the shared set has one) → compact value → small code; full amount in the peek panel.
  function amountPeek(m,v){
    const full=money(v)+' '+m.ccy,icon=CF.assetIconSvg&&CF.assetIconSvg(m.ccy)?CF.assetIcon(m.ccy,'ov-coin'):'';
    const face='<span class="ov-money" data-ov-value="'+m.key+'-'+m.field+'"><span class="ov-money-number">'+compact(v)+'</span><span class="ov-money-code">'+icon+'<span class="u">'+m.ccy+'</span></span></span>';
    if(compact(v)===money(v))return face;
    return '<details class="ov-money-peek"><summary title="'+E(full)+'" aria-label="'+E(full+' · '+L('Full amount','完整金额'))+'">'+face+'</summary><div class="ov-money-exact"><span>'+L('Full amount','完整金额')+'</span><b>'+full+'</b></div></details>';
  }
  // Circular tile: the ring frames one statistic in its identity colour; it encodes no share or ratio.
  function ring(tone,state,inner,size){
    return '<div class="ov-ring" data-tone="'+tone+'" data-ring-state="'+state+'"><svg viewBox="0 0 120 120" aria-hidden="true" focusable="false"><circle class="ov-ring-track" cx="60" cy="60" r="54"/><circle class="ov-ring-arc" cx="60" cy="60" r="54"/></svg><div class="ov-ring-center"'+(size?' data-size="'+size+'"':'')+'>'+inner+'</div></div>';
  }
  const ringState=key=>{const c=cache[key];return !c||c.state==='loading'&&!c.data?'loading':c.state==='error'&&!c.data?'error':'ready';};
  function amountCell(m){
    const c=cache[m.key],v=c?.data?c.data[m.field]:null,list=series(m.key,m.series),today=list?list[list.length-1]:null;
    const missing=m.field==='value'&&c?.data?.missingValue>0?'<p class="ov-flag">'+L(count(c.data.missingValue)+' record'+(c.data.missingValue===1?'':'s')+' without a token value are not included','另有 '+count(c.data.missingValue)+' 笔缺少代币价值，未计入')+'</p>':'';
    const todayLine=c?.data?'<p class="ov-today" data-tone="'+m.tone+'"><span>'+tr(m.today)+' (UTC)</span><b>'+(today==null?L('Unavailable','暂不可用'):money(today)+' '+m.ccy)+'</b></p>':'';
    const inner=v==null?unavailable(m.key):amountPeek(m,v);
    return '<div class="ov-tile ov-amount" data-source="'+m.key+'" data-read-state="'+(c?.state||'loading')+'"><div class="ov-tile-head"><h3>'+tr(m.label)+'</h3>'+(m.note?'<p class="ov-note">'+tr(m.note)+'</p>':'')+'</div>'+
      ring(m.tone,ringState(m.key),inner)+feedback(m.key)+missing+todayLine+(c?.at?time(c.at):'')+'</div>';
  }
  function countCell(k){
    const c=cache[k],n=c?.data?c.data.approved:null;
    const inner=n==null?unavailable(k):'<span class="ov-ring-value" data-ov-value="'+k+'-approved">'+count(n)+'</span><span class="u">'+unit(k,n)+'</span>';
    return '<div class="ov-tile ov-count" data-source="'+k+'" data-read-state="'+(c?.state||'loading')+'"><div class="ov-tile-head"><h3>'+mark(k)+tr(sources[k].stat)+'</h3></div>'+
      ring('src-'+k,ringState(k),inner,n!=null&&count(n).length>7?'long':'')+feedback(k)+(c?.at?time(c.at):'')+'</div>';
  }
  function niceMax(v){if(v<=0)return 100;const p=Math.pow(10,Math.floor(Math.log10(v))),n=v/p;return [1,2,2.5,5,10].find(x=>x>=n)*p;}
  function chartBlock(def,days){
    const shown=def.series.filter(s=>can(s.key));
    if(!shown.length)return '';
    const head='<div class="ov-chart-head"><h3>'+tr(def.title)+' <span class="ov-unit-chip">'+def.ccy+'</span></h3>'+(shown.length>1?'<ul class="ov-legend">'+shown.map(s=>'<li><span class="ov-swatch" data-tone="'+s.tone+'" aria-hidden="true"></span>'+tr(s.label)+'</li>').join('')+'</ul>':'')+'</div>';
    const ready=shown.filter(s=>cache[s.key]?.data);
    const status=[...new Set(shown.map(s=>s.key))].map(feedback).join('');
    if(!ready.length)return '<div class="ov-chart-block">'+head+'<div class="ov-chart-wait">'+status+'</div></div>';
    const value=(s,i)=>{const list=series(s.key,s.id);return list?list[i]:null;};
    const label=i=>days[i].slice(5)+(i===days.length-1?' · '+L('today, in progress','今天，未结束'):'');
    const describe=i=>shown.map(s=>{const v=value(s,i);return tr(s.label)+' '+(v==null?L('unavailable','暂不可用'):money(v)+' '+def.ccy);}).join('；');
    const missing=days.reduce((n,_,i)=>n+shown.filter(s=>value(s,i)==null).length,0);
    const times=[...new Set(shown.map(s=>s.key))].map(k=>cache[k]?.at?time(cache[k].at):'').join('');
    if(view==='table')return '<div class="ov-chart-block">'+head+status+'<div class="tablewrap ov-table-wrap"><table class="tbl"><thead><tr><th scope="col">'+L('Date (UTC)','日期（UTC）')+'</th>'+shown.map(s=>'<th scope="col" class="num">'+tr(s.label)+' ('+def.ccy+')</th>').join('')+'</tr></thead><tbody>'+
      days.map((d,i)=>i).reverse().map(i=>'<tr'+(i===days.length-1?' data-today="true"':'')+'><td class="num-date">'+days[i]+(i===days.length-1?' <span class="ov-today-tag">'+L('Today · in progress','今天 · 未结束')+'</span>':'')+'</td>'+shown.map(s=>{const v=value(s,i);return '<td class="num">'+(v==null?'<span class="ov-unavailable">'+L('Unavailable','暂不可用')+'</span>':money(v))+'</td>';}).join('')+'</tr>').join('')+'</tbody></table></div>'+times+'</div>';
    const peak=niceMax(Math.max(0,...days.flatMap((_,i)=>shown.map(s=>value(s,i)||0))));
    const axis=[1,.5,0].map(f=>'<span style="bottom:'+(f*100)+'%">'+compact(peak*f,0)+'</span>').join('');
    const cols=days.map((d,i)=>{const today=i===days.length-1;
      return '<li class="ov-col" tabindex="0"'+(today?' data-today="true"':'')+' aria-label="'+E(label(i)+' (UTC)：'+describe(i))+'"><div class="ov-bars">'+shown.map(s=>{const v=value(s,i);
        return v==null?'<span class="ov-bar" data-unavailable="true" style="height:100%"></span>':'<span class="ov-bar" data-tone="'+s.tone+'" style="height:'+(v/peak*100).toFixed(2)+'%"></span>';}).join('')+'</div>'+
        '<span class="ov-tick">'+(today?L('Today','今天'):d.slice(8))+'</span>'+
        '<span class="ov-tip" role="tooltip"><b>'+E(label(i))+' (UTC)</b>'+shown.map(s=>{const v=value(s,i);return '<span><i class="ov-swatch" data-tone="'+s.tone+'"></i>'+tr(s.label)+'<em>'+(v==null?L('Unavailable','暂不可用'):money(v)+' '+def.ccy)+'</em></span>';}).join('')+'</span></li>';}).join('');
    return '<div class="ov-chart-block">'+head+status+'<div class="ov-chart" data-series="'+shown.length+'"><div class="ov-axis" aria-hidden="true">'+axis+'</div><ol class="ov-cols" aria-label="'+E(tr(def.title)+' · '+L('last 14 UTC days','最近 14 个 UTC 日'))+'">'+cols+'</ol></div>'+
      '<div class="ov-chart-foot">'+(missing?'<span class="ov-chart-gap"><span class="ov-gap-swatch" aria-hidden="true"></span>'+L('Hatched: data unavailable, not zero','斜纹：数据暂不可用，不是 0')+'</span>':'')+times+'</div></div>';
  }
  function recentCard(key){
    const s=sources[key],c=cache[key];
    return '<article class="card ov-recent" data-source="'+key+'" data-read-state="'+(c?.state||'loading')+'"><div class="ov-recent-head">'+mark(key)+'<h3>'+tr(s.group)+'</h3></div>'+feedback(key)+
      (c?.data?'<dl class="ov-recent-figures">'+s.recent.map(([k,label])=>'<div><dt>'+tr(label)+'</dt><dd>'+figure(key,'recent.'+k)+'</dd></div>').join('')+'</dl>':'')+(c?.at?time(c.at):'')+'</article>';
  }
  function taskRow(k){
    const c=cache[k],s=sources[k],href=CF.AdminMenu.href(s.nav,s.route);
    const subset=k==='contracts'&&c?.data?(c.data.failed==null?'<p class="ov-task-note">'+L('Failed configuration count unavailable','配置失败数量暂不可用')+'</p>':c.data.failed>0?'<p class="ov-task-note">'+L('Includes '+count(c.data.failed)+' failed configuration'+(c.data.failed===1?'':'s')+' to retry','其中 '+count(c.data.failed)+' 个配置失败，可再次发起')+'</p>':''):'';
    const readonly=!CF.opsAuth.can(s.write),empty=c?.state==='ready'&&c.data.pending===0;
    return '<li class="ov-task" data-ov-task="'+k+'" data-read-state="'+(c?.state||'loading')+'"><div class="ov-task-head">'+mark(k)+'<h3>'+tr(s.task)+'</h3>'+(readonly?CF.tag('gray',L('View only','只读')):'')+
      '<a class="actlink ov-task-link" href="'+E(href)+'" data-ov-open="'+k+'" data-admin-destination="'+s.nav+'" data-admin-route="'+E(s.route)+'" aria-label="'+E(L('View '+s.task[0],'查看'+s.task[1]))+'">'+L('View','查看')+'<span aria-hidden="true">→</span></a></div>'+
      '<div class="ov-task-count">'+figure(k,'pending','ov-task-number')+feedback(k)+(empty?'<span class="ov-task-clear">'+L('No items awaiting action','暂无待办')+'</span>':'')+(c?.at?time(c.at):'')+'</div>'+subset+'</li>';
  }
  function refresh(only){
    const targets=only?[only].filter(can):keys();
    targets.forEach(key=>{
      const version=versions[key]=(versions[key]||0)+1;
      cache[key]={...cache[key],state:'loading'};
      if(scene==='loading')return;
      setTimeout(()=>{
        if(versions[key]!==version||!can(key)||S.page!==P)return;
        if(scene==='error'||['partial','stale'].includes(scene)&&['contracts','finance'].includes(key))cache[key]={...cache[key],state:'error'};
        else try{
          const result=D.read(key);
          if(scene==='empty')result.data=scale(result.data,()=>0,()=>0);
          if(scene==='large')result.data=scale(result.data,n=>n*41152263,c=>c*5000);
          if(scene==='subset'&&key==='contracts')result.data.failed=null;
          if(scene==='missing'&&key==='tokens')result.data.missingValue=2;
          if(scene==='series'&&key==='finance')result.data.daily.newLoans=null;
          if(scene==='series'&&key==='tokens')result.data.daily.tokenValue[9]=null;
          if(scene==='times')result.at-=Object.keys(sources).indexOf(key)*7*60000;
          cache[key]={...result,state:'ready'};
        }catch(_){cache[key]={...cache[key],state:'error'};}
        CF.render();
      },350+Object.keys(sources).indexOf(key)*60);
    });
    CF.render();
  }
  // Demo-only rescaling: amount fields and daily series are cents, everything else counts.
  function scale(data,countFn,centsFn,amount=false){
    if(Array.isArray(data))return data.map(v=>v==null?v:amount?centsFn(v):countFn(v));
    if(data&&typeof data==='object')return Object.fromEntries(Object.entries(data).map(([k,v])=>[k,scale(v,countFn,centsFn,amount||['value','demand','funded','daily'].includes(k))]));
    return typeof data==='number'?(amount?centsFn(data):countFn(data)):data;
  }
  function content(){
    const allowed=keys(),stats=allowed.filter(k=>sources[k].stat),tasks=allowed.filter(k=>sources[k].task),recents=allowed.filter(k=>sources[k].recent);
    const shownAmounts=amounts.filter(m=>can(m.key)),shownCharts=charts.filter(d=>d.series.some(s=>can(s.key)));
    const now=Date.now(),days=D.days(now).map(utcDay);
    const zone='<span class="ov-section-meta">'+L('Time zone: ','时区：')+E(S.tz)+'</span>';
    const tiles=shownAmounts.map(amountCell).concat(stats.map(countCell));
    const statsBlock=tiles.length?'<section class="card ov-stats" aria-labelledby="ov-stats-title"><div class="ov-section-head"><h2 id="ov-stats-title">'+L('Platform statistics','平台统计')+'</h2>'+zone+'</div><div class="ov-tiles" style="--ov-columns:'+tiles.length+'" data-split="'+(shownAmounts.length&&stats.length?shownAmounts.length:0)+'">'+tiles.join('')+'</div></section>':'';
    const allClear=tasks.length===4&&tasks.every(k=>cache[k]?.state==='ready'&&cache[k].data.pending===0);
    const rail=tasks.length?'<section class="ov-section ov-rail" aria-labelledby="ov-tasks-title"><div class="ov-section-head"><h2 id="ov-tasks-title">'+L('Action required','待办事项')+'</h2></div><ul class="ov-tasks">'+tasks.map(taskRow).join('')+'</ul>'+(allClear?'<p class="ov-empty" role="status">'+L('No items in these four queues need action.','当前暂无这四类待办事项。')+'</p>':'')+'</section>':'';
    const toggle='<div class="seg ov-view" role="group" aria-label="'+L('Display as','展示方式')+'">'+[['chart','Chart','图表'],['table','Table','表格']].map(([id,en,zh])=>'<button type="button" data-act="ov-view" data-v="'+id+'" aria-pressed="'+(view===id)+'">'+L(en,zh)+'</button>').join('')+'</div>';
    const daily=shownCharts.length?'<section class="card ov-panel" aria-labelledby="ov-daily-title"><div class="ov-section-head"><div><h2 id="ov-daily-title">'+L('Daily new','每日新增')+'</h2><p class="ov-section-meta">'+L('Last 14 UTC days · ','最近 14 个 UTC 日 · ')+days[0]+L(' to ',' 至 ')+days[days.length-1]+L(' · today in progress',' · 今天尚未结束')+'</p></div>'+toggle+'</div><div class="ov-charts">'+shownCharts.map(d=>chartBlock(d,days)).join('')+'</div></section>':'';
    const range=days[days.length-7]+L(' to ',' 至 ')+days[days.length-1];
    const recent=recents.length?'<section class="ov-section" aria-labelledby="ov-recent-title"><div class="ov-section-head"><h2 id="ov-recent-title">'+L('Recent decisions','近期审结')+'</h2><span class="ov-section-meta">'+L('Last 7 days (UTC) · ','近 7 个自然日（UTC）· ')+range+'</span></div><div class="ov-recent-list" style="--ov-columns:'+recents.length+'">'+recents.map(recentCard).join('')+'</div></section>':'';
    return '<div class="ov-page"><div class="ov-heading"><div><h1>'+L('Overview','总览')+'</h1><p class="page-desc">'+L('Platform statistics, daily activity and the work that needs attention.','平台统计、每日新增与当前待办。')+'</p></div><div><div class="ov-heading-tools">'+CF.tag('gray',L('Demonstration data','演示数据'))+'<button class="btn" type="button" id="ov-refresh" data-act="ov-refresh" '+(!allowed.length?'disabled':busy()?'aria-disabled="true"':'')+'>'+L('Refresh data','刷新数据')+'</button></div><p class="ov-refresh-status" aria-live="polite">'+(busy()?L('Updating available sources…','正在读取有权查看的数据…'):'')+'</p></div></div>'+
      statsBlock+daily+(recent||rail?'<div class="ov-lower'+(recent&&rail?'':' ov-lower-single')+'">'+recent+rail+'</div>':'')+(!allowed.length?CF.empty(L('No business sources available','暂无可查看的业务摘要'),L('This account has no query permission for these sources.','当前账号未开通这些来源的查询权限。'),''):'')+'</div>';
  }
  function setScene(value){
    scene=value;Object.keys(sources).forEach(k=>{versions[k]=(versions[k]||0)+1});cache={};
    CF.opsAuth.seedDemo('admin');
    if(value==='noaccess')Object.values(sources).forEach(s=>OPS.onAct('ops-grant',String(s.permission)));
    if(value==='readonly')Object.values(sources).filter(s=>s.write).forEach(s=>OPS.onAct('ops-grant',String(s.write)));
    if(value==='nofinance')OPS.onAct('ops-grant',String(sources.finance.permission));
    if(value==='stale')keys().forEach(k=>{cache[k]={...D.read(k),state:'ready'}});
    entered=true;signature=keys().join('|');refresh();
  }
  const priorAction=OPS.onAct,priorAfter=OPS.afterRender,priorDemo=OPS.demo;
  OPS.onAct=function(act,v,event){
    if(!act.startsWith('ov-'))return priorAction.call(this,act,v,event);
    if(act==='ov-refresh'&&!busy())refresh();
    if(act==='ov-retry')refresh(v);
    if(act==='ov-scene')setScene(v);
    if(act==='ov-view'){view=v==='table'?'table':'chart';CF.render();}
    if(act==='ov-permission'){priorAction('ops-grant',String(sources[v].permission));CF.render();}
    if(act==='ov-reset')setTimeout(()=>{D.reset();const entry=CF.AdminMenu.entries.find(e=>e.key==='account');if(window.AdminPrototypeBundle)window.AdminPrototypeBundle.open(entry.file,entry.route,true);else if(document.documentElement.dataset.adminModule==='overview')location.reload();else location.href=new URL('../'+entry.file+'#'+entry.route,location.href).href;},0);
    return true;
  };
  OPS.afterRender=function(){
    priorAfter.call(this);
    if(S.page!==P){entered=false;Object.keys(versions).forEach(k=>versions[k]++);if(!CF.opsAuth.can(14)){cache={};const host=document.querySelector('#acontent .ov-page');if(host)host.remove();}return;}
    Object.keys(cache).filter(k=>!can(k)).forEach(k=>{delete cache[k];versions[k]=(versions[k]||0)+1});
    const current=keys().join('|');
    if((!entered||signature!==current)&&!scheduled){entered=true;signature=current;scheduled=true;queueMicrotask(()=>{scheduled=false;if(S.page===P)refresh()});}
  };
  OPS.demo=function(){return S.page!==P?priorDemo.call(this):'<div class="grp"><h5>'+L('Overview · local demo','总览 · 本地演示')+'</h5><p class="hint">'+L('Counts read the source fixtures; financing totals are a demo aggregate. Changes here simulate read states and never decide a business.','数量读取来源演示数据，融资金额为演示汇总；此处只模拟读取状态，不作出业务处置。')+'</p><div class="ops-demo-actions">'+[['default','Normal','正常'],['loading','Initial loading','首次加载'],['empty','All zero','全部零值'],['partial','Partial failure','部分失败'],['series','Series or day unavailable','序列或单日不可用'],['error','Initial failure','首次失败'],['stale','Refresh fails with old data','旧数刷新失败'],['subset','Subset unavailable','失败子集不可用'],['missing','Token value missing','缺少代币价值'],['times','Different data times','不同数据时点'],['readonly','Query only','只有查询权限'],['nofinance','No financing statistics permission','无平台融资统计权限'],['noaccess','No query permissions','无来源查询权限'],['large','Large numbers','大数值']].map(([id,en,zh])=>'<button class="btn sm" data-act="ov-scene" data-v="'+id+'">'+L(en,zh)+'</button>').join('')+'</div><h5>'+L('Source query permissions','来源查询权限')+'</h5><div class="ops-demo-actions">'+Object.entries(sources).map(([k,s])=>'<button class="btn sm" data-act="ov-permission" data-v="'+k+'" aria-pressed="'+can(k)+'">'+(s.task?tr(s.task):L('Platform financing statistics','平台融资统计'))+'</button>').join('')+'</div><button class="btn sm" data-act="ov-reset">'+L('Reset source demo records','重置来源演示数据')+'</button></div>'};
  document.addEventListener('click',e=>document.querySelectorAll('.ov-money-peek[open]').forEach(d=>{if(!d.contains(e.target))d.open=false;}));
  document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const open=document.querySelector('.ov-money-peek[open]');if(open){open.open=false;open.querySelector('summary').focus();}});
  CF.opsOverview={content,refresh,setScene,get snapshot(){return cache},sources};
  CF.review.register(P,{group:['Overview','总览'],label:['Overview','总览'],route:'/ops/account-overview',visible:()=>CF.opsAuth.can(14),
    states:['default','loading','empty','error',{id:'partial',label:['Partial failure','部分失败']},{id:'series',label:['Series or day unavailable','序列或单日不可用']},{id:'stale',label:['Previous data · update failed','旧数 · 更新失败']}],
    get:()=>scene,set:setScene,reset:()=>setScene('default')});
  if(document.documentElement.dataset.adminModule!=='overview')CF.render();
})(window.CF);
