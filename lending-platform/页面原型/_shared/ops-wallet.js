/* 运营端平台统一钱包签名（本地演示）：连接钱包 → 核对地址 → 签名。
   项目合约管理的部署签名与代币质押审核的通过签名（链上执行解冻）共用这一份；不连接真实钱包，也不是登录方式。
   模块负责把 layers 并入自己的弹层表、把 ow-* 动作交给 onAct，并在 onSigned / onAbort 里回到自己的办理弹窗。
   start({showGasNotice:false}) 仅省略签名页的费用承担说明；默认展示，签名与费用规则不变。 */
(function(CF){
  'use strict';
  const L=CF.L,E=CF.esc;
  /* 平台统一钱包地址在代码层面写死，运营端没有配置入口；这里只是演示取值。 */
  const PLATFORM='0xDEMO'+'0'.repeat(32)+'W001';
  const OTHER='0xDEMO'+'0'.repeat(32)+'P777';
  const short=a=>a?a.slice(0,10)+'…'+a.slice(-8):'';
  const txt=x=>Array.isArray(x)?L(x[0],x[1]):x;
  let job=null;
  const btn=(en,zh,act,v='',cls='')=>`<button type="button" class="btn ${cls}" data-act="${act}" data-v="${E(v)}">${L(en,zh)}</button>`;
  const ABORT={
    cancel:['Wallet connection cancelled. Nothing was signed and no decision was made.','已取消连接钱包：未签名，未产生结论。'],
    rejected:['Signature declined. Nothing was submitted and no decision was made.','已拒绝签名：未提交，未产生结论。'],
    failed:['The signature failed. Nothing was submitted and no decision was made. You can try again.','签名失败：未提交，未产生结论，可以重试。']
  };
  function start(opts){job={...opts,error:''};CF.openLayer('modal','ow-connect');}
  function abort(kind){const j=job;job=null;if(j&&j.onAbort)j.onAbort(kind);}
  const layers={
    'ow-connect':()=>({title:L('Connect the platform wallet · simulation','连接平台统一钱包 · 演示'),
      html:`<div class="ow-flow"><p>${E(txt(job?.purpose||''))}</p>
        <p class="ow-meta">${L('Only the platform wallet address can sign. Connecting a wallet is used for this signature only and is not a way to sign in.','只有平台统一钱包地址可以签名；连接钱包只用于本次签名，不是登录方式。')}</p>
        <div class="ow-address-list" role="group" aria-label="${L('Wallet addresses','钱包地址')}">
          <button type="button" class="ow-address" data-act="ow-address" data-v="${PLATFORM}"><span class="mono">${E(short(PLATFORM))}</span><span class="ow-meta">${L('Demo address · platform wallet','演示地址 · 平台统一钱包')}</span></button>
          <button type="button" class="ow-address" data-act="ow-address" data-v="${OTHER}"><span class="mono">${E(short(OTHER))}</span><span class="ow-meta">${L('Demo address · another wallet','演示地址 · 其他钱包')}</span></button>
        </div>
        ${job?.error?`<p class="ow-error" role="alert">${E(txt(job.error))}</p>`:''}
        <p class="ow-meta">${L('Demonstration addresses. No wallet is contacted.','演示地址，不连接真实钱包。')}</p></div>`,
      foot:btn('Wallet unavailable','模拟：钱包不可用','ow-unavailable','','ghost')+btn('Cancel','取消','ow-cancel')}),
    'ow-sign':()=>({title:L('Wallet signature · simulation','钱包签名 · 演示'),
      html:`<div class="ow-flow"><p>${E(txt(job?.purpose||''))}</p>
        <dl class="ow-kv"><div><dt>${L('Signing address','签名地址')}</dt><dd class="mono">${E(short(PLATFORM))}</dd></div>
        ${job?.showGasNotice===false?'':`<div><dt>${L('Gas','gas')}</dt><dd>${L('Borne by the platform wallet; operations staff pay nothing personally.','由平台统一钱包承担，运营人员个人不付费。')}</dd></div>`}</dl>
        ${job?.detail?`<p class="ow-meta">${E(txt(job.detail))}</p>`:''}</div>`,
      foot:btn('Decline signature','拒绝签名','ow-sign','rejected','ghost')+btn('Signature fails','签名失败','ow-sign','failed','ghost')+btn('Confirm signature','确认签名','ow-sign','ok','primary')})
  };
  function onAct(act,v){
    if(!act.startsWith('ow-'))return false;
    if(!job)return true;
    if(act==='ow-address'){
      if(v!==PLATFORM){job.error=['The connected address '+short(v)+' is not the platform wallet address, so it cannot sign. Connect the platform wallet instead.','连接的地址 '+short(v)+' 不是平台统一钱包地址，不能签名，请改用平台统一钱包。'];CF.openLayer('modal','ow-connect');return true;}
      job.error='';CF.openLayer('modal','ow-sign');return true;
    }
    if(act==='ow-unavailable'){job.error=['No wallet is available. Nothing was signed and no decision was made.','未检测到可用的钱包：未签名，未产生结论。'];CF.openLayer('modal','ow-connect');return true;}
    if(act==='ow-cancel'){abort('cancel');return true;}
    if(act==='ow-sign'){
      if(v==='ok'){const j=job;job=null;j.onSigned(PLATFORM);return true;}
      abort(v==='failed'?'failed':'rejected');return true;
    }
    return true;
  }
  /* 弹层关闭（遮罩、Esc）等同取消。 */
  function closing(){if(job&&CF.S.layer?.key?.startsWith('ow-')){abort('cancel');return true;}return false;}
  CF.opsWallet={platform:PLATFORM,short,start,layers,onAct,closing,abortText:k=>ABORT[k]||ABORT.cancel,active:()=>!!job};
})(window.CF);
