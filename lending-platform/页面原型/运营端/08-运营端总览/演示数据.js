/* Local demonstration adapter. Source modules own their records; overview only reads.
   One stored source snapshot supports navigation/return in the single-file prototype.
   Production replaces this adapter with authenticated, permission-filtered responses. */
(function(CF){
  'use strict';
  const KEY='hc.ops.overview.sources.v1',GRANTS='hc.ops.overview.grants.v1';
  const copy=x=>JSON.parse(JSON.stringify(x));
  function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return {}}}
  function saved(key){const value=load()[key];return Array.isArray(value)?copy(value):null;}
  function publish(key,rows){try{const data=load();data[key]=rows;localStorage.setItem(KEY,JSON.stringify(data));}catch(_){}}
  function restore(key,rows){return saved(key)||rows;}
  const factories={tokens:()=>CF.tokenAdmissionSeed().rows,contracts:()=>CF.contractSeed().rows,
    institutions:()=>CF.institutionReviewSeed(),parameters:()=>CF.parameterSeed().rows};
  const unique=rows=>[...new Map(rows.filter(r=>r&&r.id).map(r=>[r.id,r])).values()];
  // Same day boundary and decision readers as the source modules' 7-day summaries.
  const utcDayStart=(t,back=0)=>{const d=new Date(t);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-back);};
  const tokenDecision=r=>(r.decisions||[])[(r.decisions||[]).length-1]||null;
  const projectDecision=r=>{const e=(r.events||[]).find(x=>['return','config-ok'].includes(x.kind));return e?e.at:null;};
  const count=(rows,test)=>rows.filter(test).length;
  function summarize(key,records,at=Date.now()){
    const rows=unique(records),since=utcDayStart(at,6);
    if(key==='tokens'){
      const decided=kind=>count(rows,r=>r.status===kind&&tokenDecision(r)&&tokenDecision(r).at>=since);
      return {pending:count(rows,r=>r.status==='pending'),approved:count(rows,r=>r.status==='approved'),returned:count(rows,r=>r.status==='returned'),
        flags:{duplicate:count(rows,r=>r.status==='pending'&&(r.dupes||[]).length>0),
          expired:count(rows,r=>r.status==='approved'&&r.tokenState!=='valid'),
          changed:count(rows,r=>r.status==='approved'&&r.changed)},
        recent:{approved:decided('approved'),returned:decided('returned')}};
    }
    if(key==='contracts'){
      const pending=rows.filter(r=>r.review==='pending'&&!r.closed),configuring=rows.filter(r=>r.review==='configuring');
      return {pending:pending.length,failed:count(pending,r=>r.exec==='failed'),
        configuring:configuring.length,unknown:count(configuring,r=>r.exec==='unknown'),
        approved:count(rows,r=>r.review==='approved'&&r.exec==='success'),
        returned:count(rows,r=>r.review==='returned'&&!r.closed),
        closed:count(rows,r=>['pending','returned'].includes(r.review)&&r.closed),
        recent:{decided:count(rows,r=>{const t=projectDecision(r);return t!=null&&t>=since;})}};
    }
    if(key==='institutions'){
      const current=rows.filter(r=>r.version>0&&r.status!=='draft');
      return {pending:count(current,r=>r.status==='submitted'),approved:count(current,r=>r.status==='verified'),rejected:count(current,r=>r.status==='rejected')};
    }
    const unset=r=>r.maxRatio==null||r.maxTermMonths==null;
    return {pending:count(rows,unset),configured:count(rows,r=>!unset(r))};
  }
  CF.opsOverviewData={saved,publish,restore,summarize,
    read(key){const at=Date.now();return {data:summarize(key,restore(key,factories[key]()),at),at};},
    utcDayStart,
    carryGrants(grants){try{if(grants)localStorage.setItem(GRANTS,JSON.stringify(grants));}catch(_){}},
    takeGrants(){try{const value=JSON.parse(localStorage.getItem(GRANTS)||'null');localStorage.removeItem(GRANTS);return value}catch(_){return null}},
    reset(){try{localStorage.removeItem(KEY);localStorage.removeItem(GRANTS)}catch(_){}},
  };
})(window.CF=window.CF||{});
