/* Local demonstration adapter. Source modules own their records; overview only reads.
   One stored source snapshot supports navigation/return in the single-file prototype.
   Production replaces this adapter with authenticated, permission-filtered responses.
   Amounts are integer cents so two-decimal totals stay exact. */
(function(CF){
  'use strict';
  const KEY='hc.ops.overview.sources.v1',GRANTS='hc.ops.overview.grants.v1',DAYS=14,DAY=86400000;
  const copy=x=>JSON.parse(JSON.stringify(x));
  function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return {}}}
  function saved(key){const value=load()[key];return Array.isArray(value)?copy(value):null;}
  function publish(key,rows){try{const data=load();data[key]=rows;localStorage.setItem(KEY,JSON.stringify(data));}catch(_){}}
  function restore(key,rows){return saved(key)||rows;}
  /* Platform financing totals have no operations-side source module; the demo
     aggregate stands in for the permission-filtered statistics response. */
  const financeSeed=()=>[{id:'platform',demand:235000000,funded:148000000,
    newDemand:[18000000,0,32000000,12000000,0,45000000,26000000,0,15000000,38000000,0,22000000,9000000,15000000],
    newLoans:[0,12000000,0,25000000,8000000,0,30000000,14000000,0,0,21000000,6000000,18000000,0]}];
  const factories={tokens:()=>CF.tokenAdmissionSeed().rows,contracts:()=>CF.contractSeed().rows,
    institutions:()=>CF.institutionReviewSeed(),parameters:()=>CF.parameterSeed().rows,finance:financeSeed};
  const unique=rows=>[...new Map(rows.filter(r=>r&&r.id).map(r=>[r.id,r])).values()];
  // Same UTC day boundary and decision reader as the token admission module.
  const utcDayStart=(t,back=0)=>{const d=new Date(t);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-back);};
  const tokenDecision=r=>(r.decisions||[])[(r.decisions||[]).length-1]||null;
  const count=(rows,test)=>rows.filter(test).length;
  const cents=v=>v==null||v===''||isNaN(Number(v))?null:Math.round(Number(v)*100);
  // Oldest first; index DAYS-1 is today's UTC day, which is still in progress.
  const days=at=>Array.from({length:DAYS},(_,i)=>utcDayStart(at,DAYS-1-i));
  function summarize(key,records,at=Date.now()){
    const rows=unique(records);
    if(key==='tokens'){
      const counted=rows.filter(r=>r.status==='approved'&&r.tokenState==='valid');
      const daily=days(at).map(()=>0),first=utcDayStart(at,DAYS-1);
      rows.forEach(r=>{const d=tokenDecision(r),v=cents(r.value);
        if(r.status==='approved'&&d&&d.result==='approved'&&d.at>=first&&v!=null)daily[Math.floor((utcDayStart(d.at)-first)/DAY)]+=v;});
      return {pending:count(rows,r=>r.status==='pending'),approved:count(rows,r=>r.status==='approved'),
        value:counted.reduce((sum,r)=>sum+(cents(r.value)||0),0),missingValue:count(counted,r=>cents(r.value)==null),
        daily:{tokenValue:daily}};
    }
    if(key==='contracts'){
      const pending=rows.filter(r=>r.review==='pending'&&!r.closed);
      return {pending:pending.length,failed:count(pending,r=>r.exec==='failed'),
        approved:count(rows,r=>r.review==='approved'&&r.exec==='success')};
    }
    if(key==='institutions'){
      const current=rows.filter(r=>r.version>0&&r.status!=='draft');
      return {pending:count(current,r=>r.status==='submitted'),approved:count(current,r=>r.status==='verified')};
    }
    if(key==='finance'){const f=rows[0];return {demand:f.demand,funded:f.funded,daily:{newDemand:f.newDemand.slice(),newLoans:f.newLoans.slice()}};}
    return {pending:count(rows,r=>r.maxRatio==null||r.maxTermMonths==null)};
  }
  CF.opsOverviewData={saved,publish,restore,summarize,days,DAYS,
    read(key){const at=Date.now();return {data:summarize(key,restore(key,factories[key]()),at),at};},
    utcDayStart,
    carryGrants(grants){try{if(grants)localStorage.setItem(GRANTS,JSON.stringify(grants));}catch(_){}},
    takeGrants(){try{const value=JSON.parse(localStorage.getItem(GRANTS)||'null');localStorage.removeItem(GRANTS);return value}catch(_){return null}},
    reset(){try{localStorage.removeItem(KEY);localStorage.removeItem(GRANTS)}catch(_){}},
  };
})(window.CF=window.CF||{});
