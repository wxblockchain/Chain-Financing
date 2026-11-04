/* M1 presentation only: show the clicked row (address, name, reference) in the existing account dialogs.
   No account updates, reference checks, wallet requests or persistence. */
(function(TP){
  TP.addCopy({
    '左右滑动查看完整账户信息，操作固定在右侧。':'Scroll horizontally for all account details. Actions stay on the right.',
    '该账户已被处理中的发行申请 IA-DEMO-0031 引用，不能删除。':'This account is used by in-progress issuance application IA-DEMO-0031 and cannot be deleted.',
    '该账户已被代币 DEMO-TOKEN-001 引用，不能删除。':'This account is referenced by token DEMO-TOKEN-001 and cannot be deleted.',
    '查看申请':'View application','查看代币':'View token'
  });
  var dialogs={};
  ['acc-edit','acc-del','acc-del-login','acc-del-ref'].forEach(function(id){
    var dialog=document.getElementById(id), address=dialog.querySelector('[data-account-address]');
    var name=dialog.querySelector('[data-account-name]');
    dialogs[id]={element:dialog, address:address.cloneNode(true), name:name?name.textContent:null};
  });
  function setAddress(dialog,address){
    // A fresh node keeps the shared language renderer's original-value cache correct.
    var previous=dialog.querySelector('[data-account-address]'), value=previous.cloneNode(false);
    value.title=address;value.textContent=address.slice(0,6)+'…'+address.slice(-4);
    previous.replaceWith(value);
  }
  // Each row states its own reference (an in-progress application or a token).
  function setReference(dialog,kind){
    var shown=null;
    dialog.querySelectorAll('[data-account-ref]').forEach(function(el){
      el.hidden=el.dataset.accountRef!==kind;
      if(!el.hidden && el.matches('.note'))shown=el.querySelector('p[id]');
    });
    if(shown)dialog.querySelector('[role="alertdialog"]').setAttribute('aria-describedby',shown.id);
  }
  function setName(name){
    var input=document.getElementById('edit-name');input.value=name;
    document.querySelector('#acc-edit .count').replaceChildren(document.createTextNode(name.length+' / 100'));
  }
  function setTargetName(dialog,name){
    var previous=dialog.querySelector('[data-account-name]');if(!previous)return;
    var value=previous.cloneNode(false);value.textContent=name || '未设置备注名';previous.replaceWith(value);
  }
  document.addEventListener('click',function(event){
    var button=event.target.closest('[data-go],[data-demo-go]');
    if(!button || button.disabled || button.getAttribute('aria-disabled')==='true')return;
    var id=button.dataset.go || button.dataset.demoGo, entry=dialogs[id];if(!entry)return;
    var row=button.closest('.account-list tbody tr');
    if(row){
      var address=row.querySelector('.addr-pill[title]'), name=row.cells[0].querySelector('.cell-main');
      if(!address)return;
      setAddress(entry.element,address.title);
      setTargetName(entry.element,name?name.textContent.trim():'');
      if(id==='acc-edit')setName(name?name.textContent.trim():'');
      if(id==='acc-del-ref')setReference(entry.element,button.dataset.accountRef||'application');
    }else if(button.hasAttribute('data-demo-go')){
      if(id==='acc-del-ref')setReference(entry.element,'application');
      setAddress(entry.element,entry.address.title);
      if(entry.name!==null)setTargetName(entry.element,entry.name);
      if(id==='acc-edit')setName(document.getElementById('edit-name').defaultValue);
    }
  },true);
})(window.TP);
