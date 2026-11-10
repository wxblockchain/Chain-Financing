/* M3b 发行审核 · 仓库联看路由。只登记本模块已有画面。
   reviewApplication：IA-DEMO-0031 处于运营处理中（可信资产发行申请中）；reviewApplicationMinted：同一申请铸造成功后（代币详情返回）；
   reviewApplicationUnassigned：同一申请处于待分配机构（新发行申请待分配机构 NT-A07 的落地画面）。
   reviewApplication0012 / reviewApplication0048：RA-DEMO-0160 被驳回的 IA-DEMO-0012 与重新发起、待分配机构的 IA-DEMO-0048（仅运营）。
   运营不显示“机构待办”菜单，tasks 只登记机构身份。 */
TP.registerModule({
  id:'adminReview', end:'admin', file:'发行审核.html',
  variants:['opsnew', 'regoff', 'regnew'],
  routes:{
    tasks:{reg:"task-list",regoff:"task-list",regnew:"task-list"},
    institutionApplication:{reg:"task-application",regoff:"task-disabled",regnew:"task-application"},
    institutionApplicationMinted:{reg:"task-token",regoff:"task-token",regnew:"task-token"},
    review:{ops:'o-list-unassigned', opsnew:'o-list-unassigned'},
    reviewApplication:{ops:'o-wait-ops', opsnew:'o-wait-ops'},
    reviewApplicationUnassigned:{ops:'o-wait-reg', opsnew:'o-wait-reg'},
    reviewApplicationMinted:{ops:'o-success', opsnew:'o-success'},
    reviewApplication0012:{ops:'o-reapplied-original', opsnew:'o-reapplied-original'},
    reviewApplication0048:{ops:'o-reapplied', opsnew:'o-reapplied'}
  }
});
