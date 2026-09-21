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
  CF.openNotificationTarget = (target, record) => {
    if (target.mode === 'object' && target.target === 'lending:P-LS-01') {
      const project = CF.LS.project(record.objectId);
      if (!project || project.state === 'draft' && !CF.LS.mine(project)) {
        CF.toast(CF.L('This project is no longer available.', '该项目已不可用。')); return;
      }
      CF.AM.returnDetail = null;
      location.hash = '#/project/' + encodeURIComponent(project.id) + '?' + new URLSearchParams({messageReturn: location.hash});
    } else CF.enterPage(target.target, target.mode === 'object' ? {object: record.objectId, panel: target.panel || ''} : null);
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
