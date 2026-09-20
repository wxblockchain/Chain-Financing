/* 仅供离线跳转演示：复用借贷广场已有数据形状和页面，不作为持有地址事实源。 */
(function (CF) {
  var D = CF.LS, AM = CF.AM;
  AM.PROJECTS.filter(function (p) { return !p.draft; }).forEach(function (p, index) {
    // 不与独立借贷原型的 localStorage 混用；同一份导出件按稳定样例重建。
    D.projects = D.projects.filter(function (x) { return x.id !== p.id; });
    var published = "2026-09-01T00:00:00Z";
    D.projects.push({ id: p.id, name: p.name, owner: "entity-demo-b", state: index ? "closed" : "raising",
      balance: 0, published: published, expires: "2027-09-01T00:00:00Z",
      demands: index ? [] : [{ id: p.id + "-01", amount: 100000, state: "open", at: published }] });
  });
  AM.TOKENS.filter(function (t) { return t.pl && t.pl.st === "PS-2" && t.pl.chain === "ok" && !t.pl.project.draft; }).forEach(function (t) {
    D.tokens = D.tokens.filter(function (x) { return x.id !== t.no; });
    D.tokens.push({ id: t.no, owner: "entity-demo-b", kind: "ar", units: t.qty, symbol: "AR-DEMO", value: t.val,
      valid: t.ts === "valid", pool: t.pl.project.id, pledge: "pledged", buyer: AM.BUYERS[t.buyer], due: t.to, from: t.from, tx: t.mintTx });
  });
})(window.CF);
