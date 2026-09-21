/* Opt-in uploaded-file presentation. Permissions and file IO belong to the caller. */
(function(CF){
  'use strict';
  CF.fileRow=function(file){
    const E=CF.esc,L=CF.L;
    const action=(a,label)=>a?`<button type="button" class="btn ghost sm" data-act="${E(a.act)}" data-v="${E(a.value)}" aria-label="${E(label+' · '+file.name)}" ${file.disabled?'disabled':''}>${E(label)}</button>`:'';
    const ready=file.state==='ready';
    return `<div class="file-row" data-file-key="${E(file.key)}"><div class="file-row-info"><strong>${E(file.name)}</strong><span class="file-row-status">${E(file.status)}</span>${file.state==='uploading'?`<progress aria-label="${L('Uploading','上传中')}"></progress>`:''}${file.error?`<span class="file-row-error" role="alert">${E(file.error)}</span>`:''}</div><div class="file-row-actions">${ready&&file.previewable?action(file.preview,L('Preview','预览')):''}${ready?action(file.download,L('Download','下载')):''}${file.error?action(file.retry,L('Retry','重试')):''}${action(file.remove,L('Remove','移除'))}</div></div>`;
  };
})(window.CF=window.CF||{});
