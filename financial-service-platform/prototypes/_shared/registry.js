/* Financial platform registry. Reuses the console shell; no asset routes or accounts. */
(function(CF){
CF.PAGES={
 'P-O-AG-01':{end:'admin',layout:'app',nav:'P-O-AG-01',navKey:'navAgreements',icoKey:'doc',name:['Agreements','协议管理']},
 'P-O-AG-02':{end:'admin',layout:'app',nav:'P-O-AG-01',name:['Agreement details','协议详情']},
 'P-O-AG-03':{end:'admin',layout:'app',nav:'P-O-AG-01',name:['Edit version','版本编辑']},
 'P-O-AG-04':{end:'admin',layout:'app',nav:'P-O-AG-01',name:['Version details','版本详情']}
};
CF.NAV={admin:['P-O-AG-01']};
CF.MODULES={agreements:{dir:'协议管理',file:'v1.0-协议管理-原型.html',name:['Agreements','协议管理']}};
CF.OWNER={'P-O-AG-01':'agreements','P-O-AG-02':'agreements','P-O-AG-03':'agreements','P-O-AG-04':'agreements'};
CF.EXTERNAL={}; CF.MSG_PAGE={}; CF.ENTRY={'P-O-AG-01':'#/agreements'};
})(window.CF=window.CF||{});
