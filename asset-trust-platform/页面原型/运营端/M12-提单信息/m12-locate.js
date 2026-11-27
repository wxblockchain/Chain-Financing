/* M12 提单详情内的清关单号定位（PRD §3.3 单据编号跳转 customs-no-link）。只做定位与标出，不改业务数据。
   清关单表中的清关单号（data-cc-mark）：分区导航定位到车辆清单，标出该清关单在本提单中对应的全部车辆（车辆行 data-ccs）；
   车辆清单中的清关单号（data-cc-locate）：定位到清关单表，标出这张清关单。标出复用 tr.is-target，换屏或再次点击时清除。 */
(function(TP){
  'use strict';
  function clear(scope){
    scope.querySelectorAll('[data-cc-marked]').forEach(function(row){row.classList.remove('is-target');row.removeAttribute('data-cc-marked');});
    scope.querySelectorAll('.m12-cc-note').forEach(function(note){note.remove();});
  }
  function mark(row){
    if(row.classList.contains('is-target'))return; // 进入时已定位的行（D3、D7）保持原样
    row.classList.add('is-target');row.setAttribute('data-cc-marked','');
  }
  function note(screen,no,count){
    var acts=screen.querySelector('.bl-vehicles').closest('.card').querySelector('.card-head .acts');
    var box=document.createElement('span');box.className='m12-cc-note';box.setAttribute('role','status');
    var tag=document.createElement('span');tag.className='tag accent';
    var label=document.createElement('span');label.textContent='已标出';
    var id=document.createElement('span');id.className='mono';id.textContent=no;
    var n=document.createElement('span');n.textContent=count+' 辆';
    tag.append(label,' ',id,' · ',n);
    var off=document.createElement('button');off.type='button';off.className='btn-link';off.dataset.ccClear='';off.textContent='取消标出';
    box.append(tag,off);acts.prepend(box);
    if(TP.localize)TP.localize(box);
  }
  document.addEventListener('click',function(event){
    var off=event.target.closest('[data-cc-clear]');
    if(off){
      // The clear button is removed with the note. Keep keyboard focus at the
      // existing, focusable vehicle region instead of dropping it onto body.
      var region=off.closest('.card').querySelector('.tablewrap');
      clear(off.closest('[data-screen]'));
      if(region)region.focus({preventScroll:true});
      return;
    }
    var link=event.target.closest('[data-cc-mark],[data-cc-locate]');if(!link)return;
    var screen=link.closest('[data-screen]');clear(screen);
    if(link.dataset.ccMark){
      var no=link.dataset.ccMark;
      var rows=Array.from(screen.querySelectorAll('.bl-vehicles tbody tr')).filter(function(row){return (row.dataset.ccs||'').split(' ').indexOf(no)!==-1;});
      rows.forEach(mark);note(screen,no,rows.length);
    }else{
      screen.querySelectorAll('.bl-customs [data-cc-mark="'+link.dataset.ccLocate+'"]').forEach(function(button){mark(button.closest('tr'));});
    }
  });
  window.addEventListener('hashchange',function(){clear(document);});
})(window.TP=window.TP||{});
