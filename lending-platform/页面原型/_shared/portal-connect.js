/* Compose existing customer modules without replacing their business views. */
(function (CF) {
  'use strict';
  const N = CF.NCView, A = CF.AccountView, S = CF.S;
  const before = N.beforeRender, after = N.afterRender, guard = N.onBeforeAct, action = N.onAct, demo = N.demo;
  N.beforeRender = () => { A.beforeRender?.(); before?.(); };
  N.afterRender = () => {
    A.afterRender?.(); after?.();
    const q = new URLSearchParams(location.hash.split('?')[1] || ''), back = q.get('messageReturn');
    if (/^#\/notification\?id=[^#]+$/.test(back || '') && S.page === 'P-LS-02') {
      const row = document.createElement('div'); row.className = 'mc-return';
      const link = document.createElement('a'); link.className = 'btn'; link.href = back;
      link.textContent = CF.L('Return to message', '返回消息详情'); row.append(link);
      document.getElementById('content').prepend(row);
    }
  };
  N.onBeforeAct = (act, value, event) => A.onBeforeAct?.(act, value, event) || guard?.(act, value, event);
  N.demo = () => /^#\/notification/.test(location.hash) ? demo() : CF.LSView.demo?.() || '';
  N.onAct = (act, value, event) => {
    if (act === 'ls-handoff' && value === 'console') { S.layer = null; location.hash = '#/console'; return true; }
    return action(act, value, event);
  };
  /* 消息的原对象定位：项目类落项目详情并带返回入口，报价落原申请的报价历史，
     放款与还款落控制台的只读详情及原期次；控制台不因此获得办理入口。 */
  const CONSOLE = {loan: 'loans', repayment: 'repayments'};
  const unavailable = () => CF.toast(CF.L('The related content is unavailable.', '相关内容暂不可访问。'));
  CF.openNotificationTarget = (target) => {
    if (!target) return;
    if (target.mode !== 'object') { CF.enterPage(target.target, null); return; }
    if (target.kind === 'project' || target.kind === 'quote') {
      const project = CF.LS.project(target.kind === 'project' ? target.id : target.project);
      if (!project || project.state === 'draft' && !CF.LS.mine(project)) { unavailable(); return; }
      const params = {messageReturn: location.hash};
      if (target.kind === 'quote') params.business = target.id;
      CF.AM.returnDetail = null;
      location.hash = '#/project/' + encodeURIComponent(project.id) + '?' + new URLSearchParams(params);
      return;
    }
    const params = new URLSearchParams({id: target.id});
    if (target.period) params.set('period', target.period);
    location.hash = '#/console/' + (CONSOLE[target.kind] || 'loans') + '?' + params;
  };
  CF.resumePortalTarget = () => {
    const target = CF.portalLoginReturn; CF.portalLoginReturn = '';
    if (!/^#\/(assets|marketplace|project|console|notifications|notification)(?:[/?]|$)/.test(target || '') || /[<>]/.test(target)) return false;
    S.layer = null; S.menu = null; location.hash = target; return true;
  };
  CF.MCSeedPeriods?.();
  CF.boot();
  CF.MC.attach();
})(window.CF);
