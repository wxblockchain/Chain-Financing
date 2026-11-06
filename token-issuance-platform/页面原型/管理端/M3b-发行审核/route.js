/* M3b 发行审核 · 仓库联看路由。只登记本模块已有画面。
   reviewApplication：IA-DEMO-0031 处于待运营审核（可信资产发行申请中）；reviewApplicationMinted：同一申请铸造成功后（代币详情返回）。 */
TP.registerModule({
  id:'adminReview', end:'admin', file:'发行审核.html',
  variants:['opsnew', 'regoff', 'regnew'],
  routes:{
    tasks:{ops:"task-list-ops",opsnew:"task-list-ops",reg:"task-list",regoff:"task-list",regnew:"task-list"},
    institutionApplication:{reg:"task-application",regoff:"task-disabled",regnew:"task-application"},
    institutionApplicationMinted:{reg:"task-token",regoff:"task-token",regnew:"task-token"},
    review:{ops:'o-list-unassigned', opsnew:'o-list-unassigned'},
    reviewApplication:{ops:'o-wait-ops', opsnew:'o-wait-ops'},
    reviewApplicationMinted:{ops:'o-success', opsnew:'o-success'}
  }
});
