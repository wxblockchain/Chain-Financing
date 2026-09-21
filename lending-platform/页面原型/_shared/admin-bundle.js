/* Offline export adapter only. The repository uses regular HTML navigation.
   Replace the document on module transitions, just like a full-page navigation;
   clear the previous document's timers and listeners before loading the next. */
(function(){
  const bundle=window.__ADMIN_BUNDLE_PAYLOAD__;
  const nativeTimeout=window.setTimeout.bind(window),nativeInterval=window.setInterval.bind(window);
  const timers=new Set(),intervals=new Set();
  let current=bundle.initial;
  function owner(route){return bundle.entries.find(e=>route.startsWith(e.route))?.file||
    (route.startsWith('/ops/notification')?'消息通知/消息通知.html':bundle.initial)}
  function open(file,route,replace=false){
    if(!bundle.documents[file])return;
    timers.forEach(clearTimeout);intervals.forEach(clearInterval);timers.clear();intervals.clear();
    if(!replace)history.replaceState({adminFile:current},'',location.href);
    current=file;
    history[replace?'replaceState':'pushState']({adminFile:file},'',route?'#'+route:location.pathname);
    document.open();document.write(bundle.documents[file]);document.close();
  }
  window.AdminPrototypeBundle={open,install(){
    window.CF={};
    let lastRoute=location.hash,suppressHash=false;
    window.setTimeout=function(fn,delay,...args){const id=nativeTimeout(fn,delay,...args);timers.add(id);return id};
    window.setInterval=function(fn,delay,...args){const id=nativeInterval(fn,delay,...args);intervals.add(id);return id};
    window.addEventListener('hashchange',event=>{if(suppressHash){suppressHash=false;event.stopImmediatePropagation();return}lastRoute=location.hash},true);
    window.addEventListener('popstate',event=>{const file=event.state?.adminFile;if(!file||file===current)return;const route=location.hash.slice(1);history.replaceState({adminFile:current},'',lastRoute);let proceeded=false;const proceed=()=>{proceeded=true;open(file,route,true)};if(window.CF.AdminMenu)window.CF.AdminMenu.beforeLeave(proceed);else proceed();suppressHash=!proceeded});
  }};
  open(history.state?.adminFile||owner(location.hash.slice(1)),location.hash.slice(1),true);
})();
