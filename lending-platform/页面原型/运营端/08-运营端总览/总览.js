/* Existing-system adaptation · operations overview. Counts are read-only; actions
   enter the existing source lists. All service/permission fixtures remain local. */
(function(CF){
  'use strict';
  const S=CF.S,L=CF.L,E=CF.esc,OPS=CF.opsAccountModule,D=CF.opsOverviewData,P='P-O-AL-07';
  const sources={
    tokens:{permission:21,write:22,nav:'tokens',route:'/ops/token-admissions?status=pending&page=1&sort=submittedAt&dir=1',
      stat:['Admitted tokens','已准入代币'],task:['Tokens awaiting review','待审核代币'],unit:['records','笔'],
      group:['Token admissions','代币准入'],
      mix:[['pending',['Pending review','待审核'],'warn'],['approved',['Approved','已通过'],'ok'],['returned',['Returned','已退回'],'danger']],
      flags:[['duplicate',['Pending with duplicate alerts','待审核中有重复提醒']],['expired',['Approved, token now invalid','已通过但代币已失效']],['changed',['Details changed after approval','已通过后资料有变更']]],
      recent:[['approved',['Approved','通过']],['returned',['Returned','退回']]]},
    contracts:{permission:17,write:18,nav:'contracts',route:'/ops/contract-reviews?review=pending&page=1&dir=1',
      stat:['Approved projects','已通过项目'],task:['Projects awaiting review','待审核项目'],unit:['projects','个'],
      group:['Financing projects','融资项目'],
      mix:[['pending',['Pending review','待审核'],'warn',['failed',['Configuration failed','配置失败']]],
        ['configuring',['Configuration in progress','配置处理中'],'accent',['unknown',['Result to be verified','结果待核实']]],
        ['approved',['Approved','已通过'],'ok'],['returned',['Returned','已退回'],'danger'],['closed',['Closed without approval','未通过已关闭'],'gray']],
      recent:[['decided',['Manually decided','人工审结']]]},
    institutions:{permission:5,write:6,nav:'institution',route:'/ops/institution-reviews?state=submitted&page=1',
      stat:['Certified funders','已认证资金方机构'],task:['Funders awaiting review','待审核资金方机构'],unit:['institutions','家'],
      group:['Funder certification','资金方机构认证'],
      mix:[['pending',['Pending review','待审核'],'warn'],['approved',['Certified','已认证'],'ok'],['rejected',['Rejected','已驳回'],'danger']]},
    parameters:{permission:19,write:20,nav:'parameters',route:'/ops/financing-parameters?status=unset&page=1&size=20',
      task:['Parameters to configure','待配置融资参数'],unit:['combinations','个组合'],
      group:['Financing parameters','融资参数配置'],
      mix:[['configured',['Configured','已配置'],'ok'],['pending',['Not configured','未配置'],'warn']]}
  };
  let scene='default',entered=false,scheduled=false,signature='',cache={},versions={};
  const tr=x=>L(...x),can=key=>CF.opsAuth.can(sources[key].permission),keys=()=>Object.keys(sources).filter(can);
  const sourceLabel=key=>tr(CF.AdminMenu.entries.find(e=>e.key===sources[key].nav).label);
  // Category marks reuse the menu's vocabulary; they do not encode business status.
  const mark=key=>'<span class="ov-source-mark" data-source="'+key+'" aria-hidden="true">'+CF.AdminMenu.entries.find(e=>e.key===sources[key].nav).icon+'</span>';
  const busy=()=>keys().some(k=>cache[k]?.state==='loading');
  const count=n=>new Intl.NumberFormat(S.lang==='zh'?'zh-CN':'en-US',{maximumFractionDigits:0}).format(n);
  const unit=(key,n)=>S.lang==='en'&&n===1?sources[key].unit[0].replace(/s$/,''):tr(sources[key].unit);
  const pick=(data,path)=>path.split('.').reduce((o,k)=>o==null?null:o[k],data);
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
  const value=(key,field)=>figure(key,field);
  const total=key=>{const d=cache[key]?.data;if(!d)return null;const parts=sources[key].mix.map(([k])=>d[k]);return parts.some(n=>n==null)?null:parts.reduce((a,b)=>a+b,0);};
  function bar(key){
    const d=cache[key].data,sum=total(key);
    if(sum==null)return '<div class="ov-bar" data-empty="unavailable" aria-hidden="true"></div>';
    if(!sum)return '<div class="ov-bar" data-empty="zero" aria-hidden="true"></div>';
    return '<div class="ov-bar" aria-hidden="true">'+sources[key].mix.filter(([k])=>d[k]>0).map(([k,label,tone])=>'<span class="ov-seg" data-tone="'+tone+'" style="flex-grow:'+d[k]+'" title="'+E(tr(label)+' '+count(d[k])+' '+unit(key,d[k]))+'"></span>').join('')+'</div>';
  }
  function mixCard(key){
    const s=sources[key],c=cache[key],sum=total(key);
    const head='<div class="ov-mix-head">'+mark(key)+'<h3>'+tr(s.group)+'</h3><p class="ov-mix-total">'+(c?.data?(sum==null?'<span class="ov-mix-total-label">'+L('Total','合计')+'</span>'+unavailable(key):'<span class="ov-mix-total-label">'+L('Total','合计')+'</span>'+exact(key,sum,'ov-total','total')):'')+'</p></div>';
    if(!c?.data)return '<article class="card ov-mix" data-source="'+key+'" data-read-state="'+(c?.state||'loading')+'">'+head+'<div class="ov-mix-wait">'+feedback(key)+'</div></article>';
    const d=c.data;
    const rows=s.mix.map(([k,label,tone,sub])=>{
      let note='';
      if(sub){const n=d[sub[0]];note=n==null?'<span class="ov-mix-sub" data-tone="warn">'+L(sub[1][0]+' count unavailable',sub[1][1]+'数量暂不可用')+'</span>':n>0?'<span class="ov-mix-sub">'+L('Of which '+sub[1][0].toLowerCase()+' ','其中'+sub[1][1]+' ')+'<b>'+count(n)+'</b></span>':'';}
      return '<li><span class="ov-swatch" data-tone="'+tone+'" aria-hidden="true"></span><span class="ov-mix-label">'+tr(label)+note+'</span>'+figure(key,k,'ov-mix-value')+'</li>';
    }).join('');
    const flags=s.flags?'<div class="ov-flags"><h4>'+L('Flags','提醒')+'</h4><ul>'+s.flags.map(([k,label])=>{const n=d.flags?.[k];return '<li data-zero="'+(n===0)+'"><span class="ov-flag-icon" aria-hidden="true">!</span><span class="ov-mix-label">'+tr(label)+'</span>'+figure(key,'flags.'+k,'ov-mix-value')+'</li>';}).join('')+'</ul></div>':'';
    return '<article class="card ov-mix" data-source="'+key+'" data-read-state="'+c.state+'">'+head+feedback(key)+bar(key)+'<ul class="ov-mix-list">'+rows+'</ul>'+flags+'<div class="ov-mix-foot">'+(c.at?time(c.at):'')+'</div></article>';
  }
  function recentCard(key){
    const s=sources[key],c=cache[key];
    return '<article class="card ov-recent" data-source="'+key+'" data-read-state="'+(c?.state||'loading')+'"><div class="ov-recent-head">'+mark(key)+'<h3>'+tr(s.group)+'</h3></div>'+feedback(key)+
      (c?.data?'<dl class="ov-recent-figures">'+s.recent.map(([k,label])=>'<div><dt>'+tr(label)+'</dt><dd>'+figure(key,'recent.'+k)+'</dd></div>').join('')+'</dl>':'')+(c?.at?time(c.at):'')+'</article>';
  }
  function refresh(only){
    const targets=only?[only].filter(can):keys();
    targets.forEach(key=>{
      const version=versions[key]=(versions[key]||0)+1;
      cache[key]={...cache[key],state:'loading'};
      if(scene==='loading')return;
      setTimeout(()=>{
        if(versions[key]!==version||!can(key)||S.page!==P)return;
        if(scene==='error'||['partial','stale'].includes(scene)&&key==='contracts')cache[key]={...cache[key],state:'error'};
        else try{
          const result=D.read(key),scale=f=>JSON.parse(JSON.stringify(result.data),(k,v)=>typeof v==='number'?f(v):v);
          if(scene==='empty')result.data=scale(()=>0);
          if(scene==='large')result.data=scale(v=>v*41152263);
          if(scene==='subset'&&key==='contracts')Object.assign(result.data,{failed:null,unknown:null});
          if(scene==='item'&&key==='tokens')result.data.returned=null;
          if(scene==='item'&&key==='contracts')result.data.recent.decided=null;
          if(scene==='times')result.at-=Object.keys(sources).indexOf(key)*7*60000;
          cache[key]={...result,state:'ready'};
        }catch(_){cache[key]={...cache[key],state:'error'};}
        CF.render();
      },350+Object.keys(sources).indexOf(key)*60);
    });
    CF.render();
  }
  function content(){
    const allowed=keys(),stats=allowed.filter(k=>sources[k].stat),recents=allowed.filter(k=>sources[k].recent);
    const zone='<span class="ov-section-meta">'+L('Time zone: ','时区：')+E(S.tz)+'</span>';
    const core=stats.length?'<dl class="ov-stats" style="--ov-stat-columns:'+stats.length+'">'+stats.map(k=>'<div class="card ov-stat" data-source="'+k+'" data-read-state="'+(cache[k]?.state||'loading')+'"><dt>'+mark(k)+tr(sources[k].stat)+'</dt><dd>'+value(k,'approved')+feedback(k)+'</dd>'+(cache[k]?.at?time(cache[k].at):'')+'</div>').join('')+'</dl>':'';
    const scale=allowed.length?'<section class="ov-section" aria-labelledby="ov-scale-title"><div class="ov-section-head"><h2 id="ov-scale-title">'+L('Platform scale','业务规模')+'</h2>'+zone+'</div>'+core+'<div class="ov-mix-grid">'+allowed.map(mixCard).join('')+'</div></section>':'';
    const now=Date.now(),range=utcDay(D.utcDayStart(now,6))+L(' to ',' 至 ')+utcDay(now);
    const recent=recents.length?'<section class="ov-section ov-recent-section" aria-labelledby="ov-recent-title"><div class="ov-section-head"><h2 id="ov-recent-title">'+L('Recent decisions','近期审结')+'</h2><span class="ov-section-meta">'+L('Last 7 days · UTC','近 7 个自然日 · UTC')+'</span></div><div class="ov-recent-list">'+recents.map(recentCard).join('')+'</div><p class="ov-period">'+L('Period ','统计期 ')+range+' (UTC)</p></section>':'';
    const allClear=allowed.length===4&&allowed.every(k=>cache[k]?.state==='ready'&&cache[k].data.pending===0);
    const tasks=allowed.length?'<section class="ov-section ov-task-section" aria-labelledby="ov-tasks-title"><div class="ov-section-head"><h2 id="ov-tasks-title">'+L('Action required','待办事项')+'</h2></div><ul class="ov-tasks">'+allowed.map(k=>{
      const c=cache[k],subset=k==='contracts'&&c?.data?(c.data.failed==null?'<p class="ov-task-note">'+L('Failed configuration count unavailable','配置失败数量暂不可用')+'</p>':c.data.failed>0?'<p class="ov-task-note">'+L('Includes '+count(c.data.failed)+' failed configuration'+(c.data.failed===1?'':'s')+' to retry','其中 '+count(c.data.failed)+' 个配置失败，可再次发起')+'</p>':''):'';
      const s=sources[k],href=CF.AdminMenu.href(s.nav,s.route);
      const readonly=!CF.opsAuth.can(s.write),empty=c?.state==='ready'&&c.data.pending===0;
      return '<li class="card ov-task" data-ov-task="'+k+'" data-read-state="'+(c?.state||'loading')+'"><div class="ov-task-head">'+mark(k)+'<h3>'+tr(s.task)+'</h3>'+(readonly?CF.tag('gray',L('View only','只读')):'')+'</div><div class="ov-task-body"><div class="ov-task-count">'+value(k,'pending')+feedback(k)+'</div>'+subset+(empty?'<p class="ov-task-clear">'+L('No items awaiting action','暂无待办')+'</p>':'')+'</div><div class="ov-task-foot"><div><span class="ov-module-name">'+sourceLabel(k)+'</span>'+(c?.at?time(c.at):'')+'</div><a class="btn ov-task-link" href="'+E(href)+'" data-ov-open="'+k+'" data-admin-destination="'+s.nav+'" data-admin-route="'+E(s.route)+'" aria-label="'+E(L('View '+s.task[0], '查看'+s.task[1]))+'">'+L('View','查看')+'<span aria-hidden="true">→</span></a></div></li>';
    }).join('')+'</ul>'+(allClear?'<p class="ov-empty" role="status">'+L('No items in these four queues need action.','当前暂无这四类待办事项。')+'</p>':'')+'</section>':'';
    return '<div class="ov-page"><div class="ov-heading"><div><h1>'+L('Overview','总览')+'</h1><p class="page-desc">'+L('Business scale, recent decisions and the work that needs attention.','业务规模、近期审结与当前待办。')+'</p></div><div><div class="ov-heading-tools">'+CF.tag('gray',L('Demonstration data','演示数据'))+'<button class="btn" type="button" id="ov-refresh" data-act="ov-refresh" '+(!allowed.length?'disabled':busy()?'aria-disabled="true"':'')+'>'+L('Refresh data','刷新数据')+'</button></div><p class="ov-refresh-status" aria-live="polite">'+(busy()?L('Updating available sources…','正在读取有权查看的数据…'):'')+'</p></div></div>'+scale+(recent||tasks?'<div class="ov-lower'+(recent?'':' ov-lower-single')+'">'+recent+tasks+'</div>':'')+(!allowed.length?CF.empty(L('No business sources available','暂无可查看的业务摘要'),L('This account has no query permission for these sources.','当前账号未开通这些来源的查询权限。'),''):'')+'</div>';
  }
  function setScene(value){
    scene=value;Object.keys(sources).forEach(k=>{versions[k]=(versions[k]||0)+1});cache={};
    CF.opsAuth.seedDemo('admin');
    if(value==='noaccess')Object.values(sources).forEach(s=>OPS.onAct('ops-grant',String(s.permission)));
    if(value==='readonly')Object.values(sources).forEach(s=>OPS.onAct('ops-grant',String(s.write)));
    if(value==='stale')keys().forEach(k=>{cache[k]={...D.read(k),state:'ready'}});
    entered=true;signature=keys().join('|');refresh();
  }
  const priorAction=OPS.onAct,priorAfter=OPS.afterRender,priorDemo=OPS.demo;
  OPS.onAct=function(act,v,event){
    if(!act.startsWith('ov-'))return priorAction.call(this,act,v,event);
    if(act==='ov-refresh'&&!busy())refresh();
    if(act==='ov-retry')refresh(v);
    if(act==='ov-scene')setScene(v);
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
  OPS.demo=function(){return S.page!==P?priorDemo.call(this):'<div class="grp"><h5>'+L('Overview · local demo','总览 · 本地演示')+'</h5><p class="hint">'+L('Counts read the source fixtures. Changes here simulate read states and never decide a business.','数量读取来源演示数据；此处只模拟读取状态，不作出业务处置。')+'</p><div class="ops-demo-actions">'+[['default','Normal','正常'],['loading','Initial loading','首次加载'],['empty','All queues empty','全部零值'],['partial','Partial failure','部分失败'],['item','One item unavailable','单项不可用'],['error','Initial failure','首次失败'],['stale','Refresh fails with old data','旧数刷新失败'],['subset','Subset unavailable','失败子集不可用'],['times','Different data times','不同数据时点'],['readonly','Query only','只有查询权限'],['noaccess','No query permissions','无来源查询权限'],['large','Large numbers','大整数']].map(([id,en,zh])=>'<button class="btn sm" data-act="ov-scene" data-v="'+id+'">'+L(en,zh)+'</button>').join('')+'</div><h5>'+L('Source query permissions','来源查询权限')+'</h5><div class="ops-demo-actions">'+Object.entries(sources).map(([k,s])=>'<button class="btn sm" data-act="ov-permission" data-v="'+k+'" aria-pressed="'+can(k)+'">'+tr(s.task)+'</button>').join('')+'</div><button class="btn sm" data-act="ov-reset">'+L('Reset source demo records','重置来源演示数据')+'</button></div>'};
  CF.opsOverview={content,refresh,setScene,get snapshot(){return cache},sources};
  CF.review.register(P,{group:['Overview','总览'],label:['Overview','总览'],route:'/ops/account-overview',visible:()=>CF.opsAuth.can(14),
    states:['default','loading','empty','error',{id:'partial',label:['Partial failure','部分失败']},{id:'item',label:['One item unavailable','单项不可用']},{id:'stale',label:['Previous data · update failed','旧数 · 更新失败']}],
    get:()=>scene,set:setScene,reset:()=>setScene('default')});
  if(document.documentElement.dataset.adminModule!=='overview')CF.render();
})(window.CF);
