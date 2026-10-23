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
  function summarize(key,records){
    const rows=unique(records);
    if(key==='tokens')return {approved:rows.filter(r=>r.status==='approved').length,pending:rows.filter(r=>r.status==='pending').length};
    if(key==='contracts'){
      const pending=rows.filter(r=>r.review==='pending'&&!r.closed&&!r.expiryPassed);
      return {approved:rows.filter(r=>r.review==='approved'&&r.exec==='success').length,
        pending:pending.length,failed:pending.filter(r=>r.exec==='failed').length};
    }
    if(key==='institutions')return {approved:rows.filter(r=>r.status==='verified').length,
      pending:rows.filter(r=>r.status==='submitted'&&r.version>0).length};
    return {pending:rows.filter(r=>r.maxRatio==null||r.maxTermMonths==null).length};
  }
  CF.opsOverviewData={saved,publish,restore,summarize,
    read(key){return {data:summarize(key,restore(key,factories[key]())),at:Date.now()};},
    carryGrants(grants){try{if(grants)localStorage.setItem(GRANTS,JSON.stringify(grants));}catch(_){}},
    takeGrants(){try{const value=JSON.parse(localStorage.getItem(GRANTS)||'null');localStorage.removeItem(GRANTS);return value}catch(_){return null}},
    reset(){try{localStorage.removeItem(KEY);localStorage.removeItem(GRANTS)}catch(_){}},
  };
})(window.CF=window.CF||{});
