/* Current application identities/statuses shared by the review and overview fixtures. */
(function(CF){
  CF.institutionReviewSeed=()=>Array.from({length:8},(_,i)=>({
    id:'DEMO-REG-'+String(i+1).padStart(3,'0'),
    status:i<6?'submitted':i===6?'verified':'rejected',version:i?1:2
  }));
})(window.CF=window.CF||{});
