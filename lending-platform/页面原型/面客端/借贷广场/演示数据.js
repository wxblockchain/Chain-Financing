/* WS-351: isolated, labelled demonstration service. No API, wallet or chain calls.
 * Token snapshots and lending facts remain separate. UI consumes action decisions
 * from this adapter; production must replace it with authenticated server responses.
 */
(function (CF) {
  'use strict';
  const KEY = CF.LSStorageKey || 'hc-ws351-demo-v2', DAY = 86400000;
  const D = CF.LS = { projects: [], tokens: [], applications: [], executions: [], events: [], offset: 0, serial: 100 };
  D.now = () => Date.now() + D.offset;
  D.iso = () => new Date(D.now()).toISOString();
  D.save = () => { try { localStorage.setItem(KEY, JSON.stringify({projects:D.projects,tokens:D.tokens,applications:D.applications,executions:D.executions,events:D.events,offset:D.offset,serial:D.serial})); } catch (_) {} };
  D.project = id => D.projects.find(p => p.id === id);
  D.token = id => D.tokens.find(t => t.id === id);
  D.mine = p => CF.S.role === 'asset' && p && p.owner === 'entity-demo-a';
  D.terminal = p => ['closed','settled'].includes(p.state);
  D.log = (p, key, ref) => {
    const a=D.applications.find(a=>a.id===ref), e=D.executions.find(e=>e.id===ref);
    const application=a?.id||e?.application||null, token=a?.tokens[0]||e?.token||null;
    if(application&&D.events.some(x=>x.key===key&&x.ref===ref))return;
    D.events.unshift({project:p.id,key,ref:ref||'',application,token,at:key==='reviewTimeout'?D.reviewDeadline(a):D.iso()});
  };
  D.reviewDeadline = a => new Date(Date.parse(a.submitted)+2*DAY).toISOString();
  D.approvalDeadline = a => a.deadline || (a.approvedAt?new Date(Date.parse(a.approvedAt)+7*DAY).toISOString():null);
  D.latest = (p,id) => [...D.applications].reverse().find(a=>a.project===p.id&&a.tokens.includes(id)&&['review','approved','executing'].includes(a.state)) || [...D.applications].reverse().find(a=>a.project===p.id&&a.tokens.includes(id));
  D.eligible = a => { const t=a&&D.token(a.tokens[0]),p=a&&D.project(a.project);return !!(a&&D.mine(p)&&a.state==='approved'&&D.now()<Date.parse(D.approvalDeadline(a))&&!D.terminal(p)&&t&&t.owner===p.owner&&t.kind==='ar'&&t.valid&&!t.frozen&&!t.pending&&t.pledge==='free'&&t.application===a.id); };
  D.quoteFee = id => { const t=D.token(id);return {amount:t.feeEstimate??0.0004,currency:t.feeCurrency||'ETH'}; };
  D.agreement = a => ({id:'AGR-'+a.id,name:['Pledge agreement · '+a.id,'质押协议 · '+a.id]});
  D.normalize = () => {
    D.applications=D.applications.flatMap(a=>a.tokens.map((id,i)=>{
      const row={...a,id:a.tokens.length>1?a.id+'-'+(i+1):a.id,batch:a.batch||a.id,tokens:[id]};
      row.reviewState=a.reviewState||(['approved','executing','recorded','expired','void'].includes(a.state)?'approved':a.state);
      if(row.reviewState==='approved'){row.approvedAt=a.approvedAt||a.decided;row.deadline=D.approvalDeadline(row);row.reviewer=a.reviewer||['Demo reviewer '+(i+1),'演示审核员 '+(i+1)];row.agreement=a.agreement||D.agreement(row);}
      if(row.reviewState==='rejected')row.reviewer=a.reviewer||['Demo reviewer','演示审核员'];
      const t=D.token(id);if(t?.application===a.id)t.application=row.id;
      D.executions.filter(e=>e.application===a.id&&e.token===id).forEach(e=>e.application=row.id);
      return row;
    }));
  };
  D.numbers = p => {
    const pool = D.tokens.filter(t => t.pool === p.id && t.pledge === 'pledged');
    const valid = pool.filter(t => t.valid && !t.frozen && !t.pending);
    const value = valid.reduce((v,t) => v+t.value,0);
    const fly = p.demands.filter(d => ['open','quoted','funding'].includes(d.state)).reduce((v,d) => v+d.amount,0);
    const limit = value*0.8, free = Math.max(0,limit-p.balance-fly);
    return {pool,valid,value,fly,limit,free,withdraw:free/0.8,gap:Math.max(0,p.balance-limit),grade:limit<p.balance?'short':free>0?'surplus':'balanced'};
  };
  D.current = p => p.demands.find(d => ['open','quoted','funding'].includes(d.state));
  D.actions = p => {
    const n=D.numbers(p), current=D.current(p), mine=D.mine(p), terminal=D.terminal(p);
    const releasable=D.tokens.filter(t => (t.pool===p.id || t.releasedFrom===p.id) && !t.pending && !t.frozen && (t.pledge==='released'||t.pledge==='pledged'&&(!t.valid||t.value<=n.withdraw)));
    return {mine,pledge:mine&&!terminal,publish:mine&&!terminal&&!p.expired&&!current&&n.free>0,
      edit:mine&&current&&current.state==='open'&&!p.expired,withdraw:mine&&releasable.length>0,
      close:mine&&!terminal,canClose:mine&&!terminal&&!n.fly&&!p.balance&&!['locked','financing'].includes(p.state),
      quote:CF.S.role==='fund'&&current&&current.state==='open'&&!terminal&&!p.expired&&n.grade==='surplus'};
  };
  D.candidates = () => D.tokens.filter(t => t.owner==='entity-demo-a'&&t.kind==='ar'&&t.valid&&t.pledge==='free'&&!t.frozen);
  D.selectable = t => t && t.owner==='entity-demo-a'&&t.valid&&t.kind==='ar'&&t.pledge==='free'&&!t.pending&&!t.application&&!t.frozen;
  D.releaseApplication = a => a.tokens.forEach(id => { const t=D.token(id);if(t.application===a.id)t.application=null; });
  D.recompute = p => {
    let n=D.numbers(p);
    [...p.demands].reverse().forEach(d => {
      if (['open','quoted'].includes(d.state) && n.limit < p.balance+n.fly) {
        d.state='ended';d.reason='coverage';d.quoteState='ended';D.log(p,'demandVoided',d.id);n=D.numbers(p);
      }
    });
    if(!D.terminal(p)&&!D.current(p))p.state=p.balance?'financing':'draft';
    if(n.grade!==p.grade){ if(n.grade==='short'||p.grade==='short')D.log(p,n.grade==='short'?'coverageShort':'coverageRestored'); p.grade=n.grade;p.coverageAt=D.iso(); }
  };
  D.releasePool = p => {
    D.tokens.filter(t=>t.pool===p.id&&t.pledge==='pledged'&&!t.pending).forEach(t=>{t.pool=null;t.pledge='released';t.releasedFrom=p.id;});
    D.applications.filter(a=>a.project===p.id&&['review','approved'].includes(a.state)).forEach(a=>{a.state='void';a.reason='closed';a.finished=D.iso();D.releaseApplication(a);});
    D.log(p,'businessRelease');
  };
  D.sweep = () => {
    let changed=false;
    D.applications.forEach(a=>{
      if(a.state==='review'&&D.now()>=Date.parse(a.submitted)+2*DAY){a.state='timeout';a.reason='reviewTimeout';a.finished=D.reviewDeadline(a);a.reviewState='timeout';D.releaseApplication(a);D.log(D.project(a.project),'reviewTimeout',a.id);changed=true;}
      if(a.state==='approved'&&D.now()>=Date.parse(D.approvalDeadline(a))){a.state='expired';D.releaseApplication(a);D.log(D.project(a.project),'approvalExpired',a.id);changed=true;}
    });
    D.projects.forEach(p=>{if(p.expires&&!p.expired&&D.now()>=Date.parse(p.expires)){p.expired=true;const n=D.numbers(p);if(!n.fly&&!p.balance){p.state='closed';p.closeReason='expiry';D.releasePool(p);}D.log(p,'projectExpired');changed=true;}});
    if(changed)D.save();return changed;
  };
  D.submit = (p, ids, name) => {
    if(CF.S.role!=='asset'||p&&!D.mine(p))throw Error('permission');
    if(p&&D.terminal(p))throw Error('closed');
    if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!D.selectable(D.token(id))))throw Error('selectionChanged');
    if(!p){if(!name.trim()||[...name.trim()].length>60)throw Error('name');p={id:'FP-DEMO-'+(++D.serial),name:[name.trim(),name.trim()],owner:'entity-demo-a',state:'draft',balance:0,demands:[],created:D.iso(),published:null,expires:null};D.projects.unshift(p);D.log(p,'created');}
    const batch='PA-DEMO-'+(++D.serial),submitted=D.iso(),type=p.demands.length||D.applications.some(a=>a.project===p.id)?'additional':'initial';
    ids.forEach(id=>{const a={id:'RV-DEMO-'+(++D.serial),batch,project:p.id,type,tokens:[id],state:'review',reviewState:'review',submitted,decided:null};D.applications.push(a);D.token(id).application=a.id;D.log(p,'submitted',a.id);});
    D.save();return p;
  };
  D.review = (p, outcome, id) => {
    D.sweep(); const a=id?D.applications.find(a=>a.id===id&&a.project===p.id):[...D.applications].reverse().find(a=>a.project===p.id&&a.state==='review');if(!a||a.state!=='review')return false;
    a.state=outcome==='approve'?'approved':'rejected';a.reviewState=a.state;a.decided=D.iso();a.reviewer=['Demo reviewer '+(++D.serial),'演示审核员 '+D.serial];
    if(a.state==='approved'){a.approvedAt=a.decided;a.deadline=new Date(Date.parse(a.approvedAt)+7*DAY).toISOString();a.agreement=D.agreement(a);}
    else {a.reason='rejected';D.releaseApplication(a);}D.log(p,a.state,a.id);D.save();return true;
  };
  D.cancelApplication = a => {D.sweep();if(!D.mine(D.project(a.project))||a.state!=='review')throw Error('reviewChanged');a.state='withdrawn';a.reviewState='withdrawn';a.finished=D.iso();D.releaseApplication(a);D.log(D.project(a.project),'applicationWithdrawn',a.id);D.save();};
  D.recheck = a => {
    D.sweep();if(!a||!D.mine(D.project(a.project)))throw Error('permission');
    if(a.state!=='approved')throw Error('approvalChanged');
    if(!D.eligible(a)){
      a.state='void';a.reason='recheck';D.releaseApplication(a);D.log(D.project(a.project),'recheckFailed',a.id);D.save();throw Error('recheck');
    }
  };
  D.execute = (p, kind, ids, appId) => {
    if(!D.mine(p))throw Error('permission');
    if(kind==='deposit'){
      D.sweep();if(!ids.length||new Set(ids).size!==ids.length)throw Error('selectionChanged');
      const rows=ids.map(id=>D.latest(p,id));if(rows.some(a=>!D.eligible(a)))throw Error('selectionChanged');
      rows.forEach(a=>{a.state='executing';D.releaseApplication(a);});
    }
    else {
      const n=D.numbers(p);if(!ids.length||ids.some(id=>{const t=D.token(id);return !t||t.owner!==p.owner||t.frozen||t.pending||!(t.pool===p.id&&t.pledge==='pledged'||t.releasedFrom===p.id&&t.pledge==='released');}))throw Error('selectionChanged');
      const amount=ids.map(D.token).filter(t=>t.pledge==='pledged'&&t.valid).reduce((v,t)=>v+t.value,0);if(amount>n.withdraw)throw Error('withdrawLimit');
    }
    ids.forEach(id=>{const t=D.token(id);const actualKind=kind==='deposit'?'deposit':t.pledge==='released'?'redeem':'withdraw';const e={id:'EX-DEMO-'+(++D.serial),project:p.id,token:id,application:kind==='deposit'?D.latest(p,id).id:null,kind:actualKind,state:'processing',at:D.iso(),fee:null,feeCurrency:D.quoteFee(id).currency};D.executions.push(e);t.pending=e.id;D.log(p,'executionStarted',e.id);});D.save();
  };
  D.result = (e, result) => {
    const t=D.token(e.token),p=D.project(e.project);
    if(e.state!=='processing'&&result==='late'){t.frozen=true;e.late=true;e.conflictAt=D.iso();D.log(p,'reconciliation',e.id);D.recompute(p);D.save();return;}
    if(e.state!=='processing'||!['success','failure','noFee'].includes(result))return;
    const a=D.applications.find(a=>a.id===e.application);
    if(e.kind==='deposit'&&(D.terminal(p)||D.now()>=Date.parse(D.approvalDeadline(a)))){e.observedResult=result;e.observedAt=D.iso();e.fee=result==='noFee'?0:D.quoteFee(e.token).amount;e.boundary=true;D.save();return;}
    e.state=result;e.done=D.iso();e.fee=result==='noFee'?0:D.quoteFee(e.token).amount;
    t.pending=null;
    if(e.kind==='deposit'){
      if(result==='success'){t.pledge=D.terminal(p)?'released':'pledged';t.pool=D.terminal(p)?null:p.id;if(D.terminal(p))t.releasedFrom=p.id;t.tx='0x'+String(D.serial+1).padStart(64,'0');}
      else {t.pledge='free';t.pool=null;}
    }else if(result==='success'){t.pledge='free';t.pool=null;t.releasedFrom=null;}
    else if(D.terminal(p)){t.pledge='released';t.pool=null;t.releasedFrom=p.id;}
    if(e.application){const a=D.applications.find(a=>a.id===e.application);if(!D.executions.some(x=>x.application===a.id&&x.state==='processing'))a.state='recorded';}
    D.log(p,result==='success'?'executionSuccess':'executionFailed',e.id);D.recompute(p);D.save();
  };
  D.publish = (p, amount, edit) => {
    D.sweep();const a=D.actions(p),n=D.numbers(p),current=D.current(p);
    if(!D.mine(p))throw Error('permission');if(edit?!a.edit:!a.publish)throw Error('publishChanged');
    const max=n.free+(edit?current.amount:0);if(!Number.isFinite(amount)||amount<=0||Math.abs(Math.round(amount*100)-amount*100)>1e-6||amount>max)throw Error('amount');
    if(edit)current.amount=amount;
    else{const at=D.iso();p.demands.push({id:p.id+'-'+String(p.demands.length+1).padStart(2,'0'),amount,state:'open',at});p.state='raising';if(!p.published){p.published=at;const expiry=new Date(at);expiry.setUTCFullYear(expiry.getUTCFullYear()+1);p.expires=expiry.toISOString();}}
    D.log(p,edit?'amountEdited':'published');D.save();
  };
  D.endDemand = p => {const a=D.actions(p);if(!a.edit)throw Error('demandChanged');const d=D.current(p);d.state='ended';d.reason='withdrawn';D.recompute(p);D.log(p,'demandWithdrawn',d.id);D.save();};
  D.close = p => {if(!D.actions(p).canClose)throw Error('cannotClose');p.state='closed';p.closeReason='owner';D.releasePool(p);D.log(p,'closed');D.save();};
  D.seed = () => {
    D.projects=[];D.tokens=[];D.applications=[];D.executions=[];D.events=[];D.offset=0;D.serial=100;
    for(let i=1;i<=24;i++){
      const p={id:'FP-DEMO-'+String(i).padStart(3,'0'),name:['Receivables pool '+String(i).padStart(2,'0'),'应收账款资产池 '+String(i).padStart(2,'0')],owner:i<=7?'entity-demo-a':'entity-demo-b',state:i===3?'locked':i===4?'financing':i===5?'settled':i===6?'closed':'raising',balance:i===4?500000:0,demands:[],published:new Date(D.now()-i*DAY).toISOString(),expires:new Date(D.now()+(365-i)*DAY).toISOString(),quotes:i===3?1:0};
      if(i!==5&&i!==6)p.demands.push({id:p.id+'-01',amount:i===4?500000:300000,state:i===4?'funded':i===3?'quoted':'open',at:p.published,tenorDays:i===3?90:i===4?120:null,rate:i===3?'6.40':i===4?'6.80':null,institution:i===3?['Demo Capital','演示资金机构']:null,quoteAt:i===3?p.published:null});
      D.projects.push(p);
      for(let j=1;j<=7;j++){const released=[5,6].includes(i);const value=j===7?100000:150000;
        D.tokens.push({id:'TK-DEMO-'+i+'-'+j,owner:p.owner,kind:'ar',units:1,symbol:'AR-DEMO',value,valid:i===4?j<=3:j!==7,pool:released?null:p.id,releasedFrom:released?p.id:null,pledge:released?'released':'pledged',buyer:['Demo Buyer '+j,'演示买方 '+j],due:'2027-01-20',from:'2026-07-20',tx:'0x'+(i*10+j).toString(16).padStart(64,'0')});}
      p.grade=D.numbers(p).grade;p.coverageAt=p.published;
    }
    for(let i=1;i<=12;i++)D.tokens.push({id:'TK-FREE-'+String(i).padStart(2,'0'),owner:'entity-demo-a',kind:'ar',units:1,symbol:'AR-DEMO',value:[300000,300000,400000][(i-1)%3],valid:true,pool:null,pledge:'free',buyer:['Demo Buyer '+i,'演示买方 '+i],due:'2027-03-18',from:'2026-09-18'});
    const a={id:'PA-DEMO-001',project:D.projects[0].id,type:'additional',tokens:D.tokens.filter(t=>t.id.startsWith('TK-FREE')).slice(0,3).map(t=>t.id),state:'approved',submitted:new Date(D.now()-DAY).toISOString(),decided:new Date(D.now()-3600000).toISOString()};D.applications.push(a);a.tokens.forEach(id=>D.token(id).application=a.id);D.normalize();
    D.applications[1].batch='PA-DEMO-002';D.applications[1].approvedAt=new Date(D.now()-1800000).toISOString();D.applications[1].decided=D.applications[1].approvedAt;D.applications[1].deadline=new Date(D.now()+7*DAY-1800000).toISOString();
    const pending=D.applications[2];pending.state=pending.reviewState='review';pending.decided=pending.approvedAt=pending.deadline=pending.agreement=pending.reviewer=null;
    D.applications.forEach(a=>D.log(D.project(a.project),a.state==='approved'?'approved':'submitted',a.id));D.save();
  };
  try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&Array.isArray(saved.projects)&&saved.projects.length)Object.assign(D,saved);else D.seed();}catch(_){D.seed();}
  D.normalize();D.sweep();
})(window.CF);
