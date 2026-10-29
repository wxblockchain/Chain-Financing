/* M1 display preview: bilingual copy and time-zone formatting only.
   No wallet, authorization, validation, account persistence or request simulation.
   The browser retains only the visitor's language; account preferences require API integration. */
(function(TP){
  'use strict';
  var EN = {
    '代币发行平台':'Token Issuance Platform','企业端':'Enterprise portal','主导航':'Main navigation',
    '业务':'Business','用户中心':'User center','可信资产':'Trusted assets','代币发行':'Token issuance','我的代币':'My tokens','销毁申请':'Burn requests',
    '企业账户':'Enterprise accounts','数币账户':'Digital currency accounts','企业信息':'Company information','用户信息':'User information',
    '企业登录与用户中心 · 代币发行平台':'Sign in & user center · Token Issuance Platform',
    '连接钱包登录':'Sign in with your wallet','使用在资产可信平台登记的钱包地址登录':'Use the wallet address registered on the Asset Trust Platform',
    '连接钱包':'Connect wallet','连接成功':'Wallet connected','确认签名':'Confirm signature','钱包签名返回':'Wallet signature returned',
    '登录成功':'Signed in','验签通过':'Signature verified','等待钱包签名返回':'Waiting for wallet signature',
    '支持网络：':'Supported network:','钱包地址':'Wallet address','区块链网络':'Blockchain network',
    '钱包已连接，请继续确认登录签名。':'Your wallet is connected. Continue to confirm the sign-in signature.',
    '继续：确认签名':'Continue to signature','确认并发起签名':'Confirm and request signature',
    '本次将请求一次登录签名。签名只用于证明你拥有该钱包，不发起交易、不消耗 gas，也不转移或授权任何资产。':'One sign-in signature will be requested. It only proves ownership of this wallet. It does not initiate a transaction, use gas, transfer assets or grant asset permissions.',
    '签名已通过校验，正在建立登录。':'Your signature has been verified. Signing you in.',
    '请在钱包中确认签名':'Confirm the signature in your wallet','请核对钱包中显示的地址与上方一致。':'Check that the wallet address matches the address above.',
    '正在向资产可信平台获取账户信息。':'Retrieving account information from the Asset Trust Platform.',
    '暂时无法确认身份，请重试。':'We could not confirm your identity. Please try again.',
    '资产可信平台登记的钱包地址已变更，请重新登录。':'Your registered wallet address has changed on the Asset Trust Platform. Please sign in again.',
    '取消':'Cancel','重新登录':'Sign in again','登录地址':'Sign-in address','当前登录地址':'Current sign-in address','本次登录地址':'Current sign-in address',
    '当前地址暂未关联企业账户':'This address is not associated with an enterprise account',
    '完成注册并登记该地址后，才能使用本平台的业务功能。':'Register and add this address to use business features on this platform.',
    '前往资产可信平台进行注册':'Register on the Asset Trust Platform','注册并登记该地址后，请退出并重新登录。':'After registering this address, sign out and sign in again.',
    '前往注册':'Go to registration','联系平台管理人员':'Contact platform support','复制邮箱':'Copy email',
    '即将前往资产可信平台':'Open the Asset Trust Platform','你将离开本平台，前往「资产可信平台」。':'You are leaving this platform to open the Asset Trust Platform.',
    '前往':'Continue','关闭':'Close','当前位置':'Current location',
    '这些信息由资产可信平台维护，本平台只读。':'This information is maintained by the Asset Trust Platform and is read-only here.',
    '已认证':'Verified','审核中':'Under review','企业 id':'Company ID','当前有效认证结论':'Current verification status',
    '企业名称':'Company name','英文名称':'English name','注册国家 / 地区':'Country / region of registration','香港 CR 编号':'Hong Kong CR number','香港 BR 编号':'Hong Kong BR number','注册地址':'Registered address',
    '中国香港':'Hong Kong, China','中国':'China',
    '企业认证尚未通过，暂不能办理代币发行等业务。认证状态请在资产可信平台查看。':'Company verification is pending. Token issuance and other business actions are unavailable. Check your status on the Asset Trust Platform.',
    '暂无企业信息':'No company information','企业信息需在资产可信平台完善。':'Complete your company information on the Asset Trust Platform.',
    '企业信息读取失败':'Could not load company information','暂时无法读取，请稍后重试。':'Information could not be loaded. Please try again later.','重试':'Try again',
    '钱包当前地址':'Current wallet address','与登录地址不一致，本次登录仍对应原登录地址。':'does not match your sign-in address. This session still uses the original sign-in address.',
    '用该地址重新登录':'Sign in with this address','本次登录':'Current session','同步时间':'Last synced',
    '个人资料':'Personal information','姓名':'Name','英文姓名':'English name','邮箱':'Email','国籍':'Nationality','证件类型':'ID type','证件号码':'ID number',
    '与企业的关系':'Relationship to company','授权代表':'Authorized representative','身份证':'National ID','暂不展示':'Not displayed',
    '暂无个人信息':'No personal information','个人信息由资产可信平台维护。':'Personal information is maintained by the Asset Trust Platform.',
    '个人信息读取失败':'Could not load personal information','偏好设置':'Preferences','语言':'Language','界面语言':'Interface language','时区':'Time zone',
    '选择界面显示语言。':'Choose the interface language.','时间按该时区展示，业务时间本身不变。':'Times are displayed in this time zone. The underlying business times do not change.',
    '偏好保存失败，已恢复原值，请重新选择。':'Could not save your preference. The previous value has been restored. Please select it again.',
    '预览偏好已更新。':'Preview preference updated.',
    '管理本企业用于接收代币的数币账户。':'Manage company digital currency accounts for receiving tokens.',
    '新增账户':'Add account','账户备注名':'Account label','数币地址':'Digital currency address','来源':'Source','创建时间':'Created at','操作':'Actions',
    '1 个':'1 account','3 个':'3 accounts','4 个':'4 accounts','企业新增':'Added by company','编辑':'Edit','删除':'Delete',
    '还没有新增账户。需要用其他地址接收代币时，可新增账户并签名验证。':'No additional accounts. Add and verify an address to receive tokens in another wallet.',
    '数币账户暂时无法读取':'Could not load digital currency accounts','请稍后重试。':'Please try again later.',
    '需先在资产可信平台完成认证':'Complete verification on the Asset Trust Platform',
    '企业认证通过后才能办理业务。当前认证状态请在资产可信平台查看。':'Business actions require company verification. Check the current status on the Asset Trust Platform.',
    '前往资产可信平台完成认证':'Go to verification','新增数币账户':'Add digital currency account','填写信息':'Enter details','签名验证':'Verify ownership',
    '只支持':'Only ',
    '地址。只能登记本企业能用钱包签名的地址，交易所充值地址等由第三方托管的地址无法登记。':' addresses are supported. Only register an address your company can sign for. Third-party custodial addresses, such as exchange deposit addresses, cannot be registered.',
    '只读':'Read-only','0x 开头，共 42 位':'Starts with 0x, 42 characters','登记后不能修改。':'Cannot be changed after registration.',
    '例如：收币地址':'For example: receiving wallet','下一步：签名验证':'Next: verify ownership','本企业已有该地址（登录地址）。':'This company already has this address (sign-in address).',
    '查看已有账户':'View existing account','上一步':'Back','发起签名':'Request signature',
    '请用上述地址在钱包中签名一次。签名只用于证明该地址归本企业控制，不发起交易，不转移或授权任何资产，也不改变当前登录。':'Sign once in your wallet using the address above. The signature only proves company control of the address. It does not initiate a transaction, transfer assets, grant asset permissions or change this session.',
    '请在钱包中切换到上述地址并确认签名':'Switch to the address above in your wallet and confirm the signature',
    '签名完成后，本次登录仍对应原登录地址。':'This session will continue to use the original sign-in address.',
    '签名的地址和要登记的地址不是同一个。请在钱包中切换到要登记的地址后重试，账户尚未登记。':'The signing address does not match the address being registered. Switch to the correct address and try again. No account has been registered.',
    '重新签名':'Sign again','账户已登记':'Account registered','编辑账户备注名':'Edit account label','保存':'Save','已保存':'Saved','已删除':'Deleted',
    '地址登记后不能修改。需要更换地址时，请新增账户并签名验证，再删除旧账户。':'The registered address cannot be changed. To use another address, add and verify a new account, then delete the old one.',
    '删除数币账户':'Delete digital currency account','删除后，该账户不再出现在列表和发行申请的可选范围中，且不可恢复；需要时可重新新增并签名验证。':'This account will be removed from the list and issuance application choices. Deletion cannot be undone. You can register it again by verifying ownership.',
    '无法删除数币账户':'Cannot delete account','该地址为登录地址，由系统维护，不能删除。':'This is the sign-in address. It is maintained by the system and cannot be deleted.',
    '该账户已被代币 DEMO-TOKEN-001 引用，不能删除；已销毁的代币仍构成引用。':'This account is referenced by token DEMO-TOKEN-001 and cannot be deleted. Burned tokens still count as references.',
    '复制地址':'Copy address','复制登录地址':'Copy sign-in address','退出登录':'Sign out','已退出登录':'Signed out','我的账户':'My account',
    '消息通知，3 条未读':'Messages, 3 unread','消息通知属于 M7 消息通知模块，本原型不展开':'Message center is covered by module M7.',
    '需先完成认证':'Verification required','预览：复制完整值':'Preview: copy full value','已复制':'Copied','复制失败，请重试。':'Could not copy. Please try again.',
    '正在保存偏好，请稍候。':'Saving your preference. Please wait.','偏好保存中':'Saving preference',
    '演示：此处离开本平台，前往资产可信平台':'Preview: open the Asset Trust Platform',
    '画面目录 · 演示数据':'Screen catalog · Sample data','画面目录':'Screen catalog','评审工具 · 演示数据':'Review tool · Sample data',
    '画面目录（评审工具）':'Screen catalog (review tool)','主流程下一屏：':'Next screen: ',
    '平台反馈':'Platform status','账户信息':'Account information','账户信息加载中':'Loading account information','正在加载账户信息':'Loading account information','账户信息加载失败':'Could not load account information','登录已结束':'Session ended',
    '请在钱包插件中完成签名，签名返回并验签通过后将直接进入平台。':'Complete the signature in your wallet extension. You will enter the platform once the returned signature is verified.',
    '登录':'Sign in','游客':'Visitor','游客引导':'Visitor guidance','前往资产可信平台：确认':'Leave platform: confirmation',
    '登录成功：调取身份':'Signed in: retrieving identity','登录失败：无法确认身份':'Sign-in failed: identity unavailable','登录已结束：地址变更':'Session ended: address changed',
    '未认证（审核中）':'Not verified (under review)','无企业归属（空）':'No company association','读取失败':'Load failed','钱包地址与登录地址不一致':'Wallet address mismatch','账户入口展开':'Account menu open',
    '默认':'Default','无个人信息（空）':'No personal information','偏好保存失败：恢复原值':'Preference save failed: previous value',
    '列表':'List','仅登录地址（空）':'Sign-in address only','未认证：受限引导':'Verification required',
    '新增 · 填写信息':'Add: enter details','新增 · 填写有误':'Add: form error','新增 · 签名说明':'Add: signature explanation','新增 · 等待签名':'Add: waiting for signature','新增 · 签名地址不一致':'Add: signing address mismatch','新增 · 登记成功':'Add: registered',
    '编辑备注名':'Edit label','删除确认':'Delete confirmation','删除：登录地址不可删除':'Delete: sign-in address protected','删除：已被引用不可删除':'Delete: referenced account protected'
  };
  var originalText=new WeakMap(), originalAttrs=new WeakMap();
  TP.language='en'; TP.zone='UTC';
  function translated(value){
    var key=value.trim(), result=EN[key];
    if(result===undefined && key.indexOf('主流程下一屏：')===0){var next=key.slice('主流程下一屏：'.length);result='Next screen: '+(EN[next]||next);}
    if(result===undefined && key.indexOf('账户：')===0) result='Account: '+key.slice(3);
    if(result===undefined && key.indexOf('「')===0 && key.indexOf('」属于其他模块，本原型不展开')>0){
      var name=key.slice(1,key.indexOf('」'));result=(EN[name]||name)+' is covered by another module.';
    }
    return result===undefined ? value : value.replace(key,result);
  }
  TP.localize=function(root){
    root=root||document.body;
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT), node;
    while((node=walker.nextNode())){
      if(node.parentElement.closest('script,style,textarea,[data-instant],[data-zone]'))continue;
      if(!originalText.has(node))originalText.set(node,node.nodeValue);
      var text=originalText.get(node);node.nodeValue=TP.language==='en'?translated(text):text;
    }
    [root].concat(Array.from(root.querySelectorAll('*'))).forEach(function(el){
      if(!el.getAttribute)return;
      var attrs=originalAttrs.get(el)||{};
      ['aria-label','placeholder','title'].forEach(function(attr){
        if(el.hasAttribute(attr)){
          if(attrs[attr]===undefined)attrs[attr]=el.getAttribute(attr);
          el.setAttribute(attr,TP.language==='en'?translated(attrs[attr]):attrs[attr]);
        }
      });originalAttrs.set(el,attrs);
    });
    document.documentElement.lang=TP.language==='en'?'en':'zh-CN';
    document.title=TP.language==='en'?EN['企业登录与用户中心 · 代币发行平台']:'企业登录与用户中心 · 代币发行平台';
  };
  TP.renderDisplay=function(){
    document.querySelectorAll('[data-language]').forEach(function(el){el.value=TP.language;});
    document.querySelectorAll('[data-timezone]').forEach(function(el){
      if(!Array.from(el.options).some(function(o){return o.value===TP.zone;}))el.add(new Option(TP.zone,TP.zone));
      el.value=TP.zone;
    });
    document.querySelectorAll('[data-zone]').forEach(function(el){el.textContent=TP.zone;});
    var fmt=new Intl.DateTimeFormat('en-CA',{timeZone:TP.zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
    document.querySelectorAll('[data-instant]').forEach(function(el){
      var parts={};fmt.formatToParts(new Date(el.dataset.instant)).forEach(function(p){parts[p.type]=p.value;});
      var day=parts.year+'-'+parts.month+'-'+parts.day, clock=parts.hour+':'+parts.minute;
      el.replaceChildren(document.createTextNode(day+(el.hasAttribute('data-compact')?'':' '+clock+':'+parts.second)));
      if(el.hasAttribute('data-compact')){var sub=document.createElement('span');sub.className='cell-sub';sub.textContent=clock;el.appendChild(sub);}
    });
    TP.localize();
  };
  TP.setLanguage=function(value){
    if(value!=='en'&&value!=='zh')return;
    TP.language=value;
    try{localStorage.setItem('tp-visitor-language',value);}catch(e){/* Preview can still switch when storage is unavailable. */}
    TP.renderDisplay();
  };
  TP.initDisplay=function(){
    try{var saved=localStorage.getItem('tp-visitor-language');if(saved==='en'||saved==='zh')TP.language=saved;}catch(e){}
    try{TP.zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';}catch(e){TP.zone='UTC';}
  };
  document.addEventListener('change',function(e){
    if(e.target.matches('[data-language]')){
      if(e.target.value===TP.language)return;
      TP.setLanguage(e.target.value);TP.refreshLanguageTools();TP.renderDisplay();
    }else if(e.target.matches('[data-timezone]')){
      if(e.target.value===TP.zone)return;
      try{new Intl.DateTimeFormat('en',{timeZone:e.target.value});}catch(err){e.target.value=TP.zone;return;}
      TP.zone=e.target.value;TP.renderDisplay();
    }else return;
    var row=e.target.closest('.preferences'), feedback=row&&row.querySelector('.preference-feedback');
    if(feedback){feedback.textContent='预览偏好已更新。';TP.localize(feedback);}
  });
})(window.TP=window.TP||{});
