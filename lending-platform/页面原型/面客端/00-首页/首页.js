/* Public homepage · read-only presentation of the supplied WS-432 prototype.
   Business modules remain authoritative for account, marketplace and financing flows. */
(function (CF) {
  'use strict';
  const L = CF.L, E = CF.esc, S = CF.S, D = CF.HomeData;
  const PAGE = 'P-HOME-01';
  const num = (n, places = 0) => Number(n).toLocaleString('en-US', {minimumFractionDigits:places, maximumFractionDigits:places});
  const arrow = '<span class="hc-arrow" aria-hidden="true">→</span>';
  const link = (route, en, zh, primary = false) => `<a class="btn${primary ? ' primary' : ''}" href="#${route}">${L(en, zh)}${arrow}</a>`;
  const jump = (id, en, zh, index) => `<button class="hc-jump" type="button" data-act="home-section" data-v="${id}"><span aria-hidden="true">${index}</span>${L(en, zh)}</button>`;
  const eyebrow = (en, zh) => `<div class="hc-eyebrow">${L(en, zh)}</div>`;
  const legal = () => L('Harbour Credit is a tokenization registry and pledge infrastructure. It does not hold client funds, set prices or provide credit. Institutions lend directly to asset owners and bear their own credit risk. Rates shown are quotes or targets, not guarantees. Not available to retail investors or in restricted jurisdictions. All data in this prototype is mock data.', 'Harbour Credit 是代币化登记与质押基础设施，不归集资金、不参与定价、不提供信用。机构直接向资产方放款并自担信用风险。页面所示利率为报价或目标值，非保证收益。不向零售投资者及受限地区提供服务。本原型所有数据均为演示数据。');
  const verifyButton = () => `<button class="hc-text-button" type="button" data-act="home-verifier">${L('Open attestation verifier', '打开存证校验器')}${arrow}</button>`;

  function ledgerRow(index, label, title, sub, side) {
    return `<div class="hc-ledger-row"><span class="hc-step-no" aria-hidden="true">${index}</span><div><span class="hc-ledger-label">${label}</span><div class="hc-ledger-title hc-number">${title}</div><div class="hc-ledger-sub">${sub}</div></div><div class="hc-ledger-side">${side}</div></div>`;
  }
  function hero() {
    return `<section class="hc-hero" aria-labelledby="hc-hero-title"><div class="hc-wrap hc-hero-grid"><div>
      ${eyebrow('Verified real-world credit', '可信资产 · 链上融资')}
      <h1 id="hc-hero-title">${L('Verified trade assets.<br><span>Financed on-chain.</span>', '可信贸易资产，<br><span>在链上完成融资。</span>')}</h1>
      <p class="hc-lead">${L('Assets verified at the source become fractional, whitelisted tokens. Institutions lend against them directly — every step recorded on Ethereum and Base.', '源头验真的资产被铸造为可拆分、白名单限转的份额代币；机构基于质押直接放款，每一步都记录在 Ethereum 与 Base 上。')}</p>
      <div class="hc-actions">${link('/assets','Explore assets','浏览资产广场',true)}${link('/marketplace','Explore lending','浏览借贷广场')}</div>
      <div class="hc-proof"><span>${L('Anchored attestations','链上存证锚定')}</span><span>${L('Direct, bilateral lending','机构直贷')}</span><span>${L('Self-serve verification','自助校验')}</span></div>
    </div><div class="hc-ledger" role="group" aria-label="${L('Asset to financing illustration','资产到融资示例')}">
      <div class="hc-ledger-head"><b>${L('From asset to financing','从资产到融资')}</b><span>${L('Illustrative data','演示数据')}</span></div>
      ${ledgerRow('01',L('Verified asset','可信资产'),'TA-2026-000100','Toyota Land Cruiser 300',`<span class="hc-status">✓ ${L('L4 · verified','L4 · 已验真')}</span><div>${L('4/4 evidence flows matched','四流交叉核验通过')}</div>`)}
      ${ledgerRow('02',L('Fractional shares','份额化代币'),'3,260.5000 <small>'+L('shares','份')+'</small>','HCT-VEH-0412',L('$100 face value / share','$100 面值 / 份')+'<div>Ethereum</div>')}
      ${ledgerRow('03',L('Project pledge contract','项目质押合约'),'$'+num(D.pledge,2),'HCF-2026-018',L('Borrowing cap (80%)','融资上限（80%）')+'<div class="hc-number">$'+num(D.cap,2)+'</div>')}
      <div class="hc-ledger-end"><div><span>${L('Latest disbursement · USDC','最新放款 · USDC')}</span><br><b class="hc-number">200,000.00</b></div><div>${L('Northbridge Family Office','Northbridge Family Office')}<br>${L('9.20% APR · illustrative quote','年化利率 9.20% · 报价示例')}</div></div>
    </div></div></section>`;
  }
  function metrics() {
    const T = D.totals;
    const items = [
      ['$'+num(T.value/1e6,2)+'M',L('Tokenized asset value','代币化资产总值'),L('Includes matured & invalidated','含已到期 / 失效'),'$'+num(T.value,2)],
      [num(T.shares/1e3,2)+'K',L('Shares issued','份额总量'),L('Fractional token shares','代币份额'),num(T.shares,4)+' '+L('shares','份')],
      ['$'+num(T.fin/1e6,2)+'M',L('Cumulative financing','累计融资额'),L('Direct institutional lending','机构直接放款'),'$'+num(T.fin,2)],
      [num(T.active),L('Active projects','活跃融资项目'),'',''],
      [num(T.inst),L('Lending institutions','合作机构'),'',''],
      [num(T.att),L('On-chain attestations','链上存证笔数'),'','']
    ];
    return `<section class="hc-section" id="hc-activity" aria-labelledby="hc-activity-title"><div class="hc-wrap">
      <div class="hc-section-title"><div>${eyebrow('Platform activity','平台业务概览')}<h2 id="hc-activity-title" tabindex="-1">${L('Visible data.<br>Verifiable records.','公开的业务数据，<br>可核验的链上记录。')}</h2></div><p class="hc-note">${L('Illustrative snapshot · not live platform totals','演示快照 · 非实时平台汇总')}<br>Ethereum · Base</p></div>
      <div class="hc-metrics">${items.map(([value,label,hint,full])=>{const body=`<span class="hc-metric-value" ${full?`aria-label="${E(full)}"`:''}>${value}</span><span class="hc-metric-label">${label}</span>${hint?`<span class="hc-metric-hint">${hint}</span>`:''}`;return full?`<details class="hc-metric"><summary title="${E(full)}">${body}<span class="hc-metric-toggle">${L('Full value','完整数值')} <span aria-hidden="true">↕</span></span></summary><span class="hc-metric-full hc-number">${full}</span></details>`:`<div class="hc-metric">${body}</div>`;}).join('')}</div>
      <div class="hc-source"><p class="hc-note">${L('Source illustration: token, pledge & registry contracts','来源示意：代币、质押与登记合约')} · 2026-10-14 08:30 UTC</p>${verifyButton()}</div>
      <details class="hc-activity"><summary>${L('Recent activity · illustrative records','近期动态 · 演示记录')}</summary><div class="hc-activity-list">${D.activity.map(a=>`<div class="hc-activity-row"><div><b>${L(a[0],a[1])}</b> · ${a[2]}<br>${a[4]==='eth'?'Ethereum':'Base'}</div><span class="hc-number">${a[3]}</span></div>`).join('')}</div></details>
    </div></section>`;
  }
  function how() {
    const steps = [
      [L('Verify','验真'),L('Platform A cross-checks purchase, logistics, customs and sales evidence and grades each asset L1–L4.','A 平台交叉核验采购、物流、清关与销售证据，并给出 L1–L4 验真等级。'),`<div class="hc-levels"><span>L4 · 46%</span><span>L3 · 28%</span><span>L2 · 18%</span><span>L1 · 8%</span></div>${L('Share of assets by level (mock)','各等级资产占比（演示）')}`],
      [L('Tokenize','份额化'),L('Each asset is minted into fractional shares with a $100 face value, transferable only between whitelisted addresses.','每项资产按 $100 面值铸造为可拆分份额，仅能在白名单地址间转让。'),`${L('Valuation ÷ face value = shares','估值 ÷ 面值 = 份额数')}<br><strong>$326,050 ÷ $100<br>= 3,260.5000 ${L('shares','份')}</strong>`],
      [L('Pledge','质押'),L('Owners pledge shares into a project-specific contract. The borrowing cap updates with the pledged value.','资产方按需质押份额到项目独立的质押合约，融资上限随质押价值更新。'),`${L('Separate illustration','独立算例')}<br><strong>$485,975 × 80% = $388,780</strong>`],
      [L('Finance','融资'),L('Credit-approved institutions quote a rate. The first quote locks the request; funds move directly from lender to owner.','已授信机构给出利率报价，首个报价即锁定需求；资金由机构直接划转给资产方。'),`${L('Quote 9.20% → Accepted','报价 9.20% → 接受报价')}<br><strong>${L('Disbursed · USDC','已放款 · USDC')}</strong>`]
    ];
    return `<section class="hc-section hc-tinted" id="hc-how" aria-labelledby="hc-how-title"><div class="hc-wrap"><div class="hc-section-title"><div>${eyebrow('How it works','运作机制')}<h2 id="hc-how-title" tabindex="-1">${L('One asset. Four connected steps.','从可信资产，到融资到账。')}</h2><p class="hc-section-copy">${L('Verification, tokenization, pledge and direct financing.','验真、份额化、质押与机构直接放款。')}</p></div><p class="hc-note">${L('Illustrative workflow · not a live application status','流程示意 · 非实际办理进度')}</p></div><ol class="hc-steps">${steps.map(([title,copy,example],i)=>`<li><span class="hc-step-no" aria-hidden="true">0${i+1}</span><h3>${title}</h3><p>${copy}</p><div class="hc-example hc-number">${example}</div></li>`).join('')}</ol></div></section>`;
  }
  function why() {
    const items = [
      [CF.ICON.search,L('Source-level verification','源头验真'),L('Evidence is pulled from ERP, logistics and customs systems — not typed in after the fact.','证据直接取自 ERP、物流与报关系统，而非事后录入。'),L('L3+ assets: 74% · illustrative','L3 及以上资产占比 74% · 演示')],
      [CF.ICON.pool,L('Compliance built in','合规内建'),L('Whitelisted transfers, admitted institutions only, and no secondary trading in phase 1.','白名单限转，仅已准入机构可操作，一期不开放二级流通。'),L('ERC-3643-style token','ERC-3643 类代币标准')],
      [CF.ICON.globe,L('Direct, bilateral lending','双边直贷'),L('The platform never holds funds or sets rates. Lenders price and disburse on their own terms.','平台不归集资金、不参与定价，机构自主报价与放款。'),L('0 client funds held','平台托管资金：0')],
      [CF.ICON.chain,L('Verify it yourself','链上自助校验'),L('Compare a token ID, trusted-asset number or attestation hash with a registry record.','输入代币 ID、可信资产编号或存证哈希，比对登记记录。'),L('1,284 attestations · illustrative','1,284 笔存证 · 演示')]
    ];
    return `<section class="hc-section" id="hc-why" aria-labelledby="hc-why-title"><div class="hc-wrap"><div class="hc-section-title"><div>${eyebrow('Why Harbour Credit','为什么选择 Harbour Credit')}<h2 id="hc-why-title" tabindex="-1">${L('Verify before you lend.','先核验，再放款。')}</h2><p class="hc-section-copy">${L('Built for institutions that assess the evidence behind an asset.','为重视资产底层证据的机构而设计。')}</p></div>${verifyButton()}</div><div class="hc-principles">${items.map(([icon,title,copy,proof])=>`<div class="hc-principle"><span aria-hidden="true">${icon}</span><div><h3>${title}</h3><p>${copy}</p><small>${proof}</small></div></div>`).join('')}</div></div></section>`;
  }
  function partners() {
    const groups = [
      [L('Data & verification','数据与验真'),['Chengyuan Trust','Veritas Inspect','PortSync','LedgerAnchor']],
      [L('Asset originators','资产方'),['Carloha Trading','Meridian Receivables','Pacific Auto Supply','Gulf Motors']],
      [L('Capital partners','资金方'),['Northbridge FO','Harbor Ridge Fund','Kestrel Capital','Aster Bay Capital']]
    ];
    return `<section class="hc-section hc-tinted" id="hc-partners" aria-labelledby="hc-partners-title"><div class="hc-wrap"><div class="hc-section-title"><div>${eyebrow('Partner ecosystem','合作网络')}<h2 id="hc-partners-title" tabindex="-1">${L('Data, assets and capital. Connected.','连接数据、资产与资金。')}</h2></div><p class="hc-note">${L('All partner names below are prototype placeholders.','以下合作伙伴名称均为原型占位。')}</p></div><div class="hc-partners">${groups.map(([label,names])=>`<div class="hc-partner-group"><h3>${label}</h3><ul>${names.map(n=>`<li>${n}</li>`).join('')}</ul></div>`).join('')}</div></div></section>`;
  }
  function access() {
    return `<section class="hc-section" id="hc-access" aria-labelledby="hc-access-title"><div class="hc-wrap hc-access"><div>${eyebrow('Before you start','使用须知')}<h2 id="hc-access-title" tabindex="-1">${L('Browse everything.<br>Lend once admitted.','公开可看，<br>准入可投。')}</h2><p class="hc-section-copy">${L('Asset and project data are public. Quoting, credit and disbursement open to institutions after admission review.','资产与项目数据全部公开；报价、授信与放款在机构准入审核通过后开放。')}</p><div class="hc-actions">${link('/assets','Explore assets','浏览资产广场',true)}${link('/marketplace','Explore lending','浏览借贷广场')}</div></div><div class="hc-access-roles"><div class="hc-access-role"><h3>${L('For asset owners','资产方')}</h3><p>${L('Sign in through Platform A to access your existing assets and financing.','通过 A 平台登录，查看既有资产与融资。')}</p></div><div class="hc-access-role"><h3>${L('For institutions','资金机构')}</h3><p>${L('Complete admission review before quoting, credit and disbursement.','完成机构准入审核后，办理报价、授信与放款。')}</p></div><div class="hc-access-role"><h3>${L('Availability & risk','服务范围与风险')}</h3><p>${L('Not available to retail investors or restricted jurisdictions. Quoted rates do not guarantee returns.','不向零售投资者及受限地区提供服务。报价利率不代表保证收益。')}</p></div></div></div></section>`;
  }
  function content() {
    return `<div class="hc-home">${hero()}<div class="hc-wrap"><nav class="hc-section-nav" aria-label="${L('On this page','本页内容')}">${jump('activity','Activity','业务概览','01')}${jump('how','How it works','运作机制','02')}${jump('why','Why Harbour Credit','平台特点','03')}${jump('partners','Partners','合作网络','04')}${jump('access','Before you start','使用须知','05')}</nav></div>${metrics()}${how()}${why()}${partners()}${access()}</div>`;
  }
  function footer() {
    const contracts = Object.entries(D.contracts).map(([net,address])=>`<div>${L('Token contract','代币合约')} · ${net==='eth'?'Ethereum':'Base'} · <a href="https://${net==='eth'?'etherscan.io':'basescan.org'}/address/${address}" target="_blank" rel="noopener noreferrer" aria-label="${L('Open token contract on block explorer','在区块浏览器查看代币合约')} · ${net==='eth'?'Ethereum':'Base'} · ${address}">${address} ↗</a></div>`).join('');
    return `<div class="hc-home-foot"><div class="hc-foot-top"><div><a href="#/home" class="hc-foot-brand">Harbour Credit</a><p>${L('Verified trade assets. Direct institutional lending.','可信贸易资产，连接机构直贷。')}</p></div><nav class="hc-foot-links" aria-label="${L('Footer','页脚')}">${verifyButton()}<a href="#/assets">${L('Asset marketplace','资产广场')}</a><a href="#/marketplace">${L('Lending marketplace','借贷广场')}</a></nav></div><div class="hc-foot-contracts">${contracts}</div><p class="hc-legal">${legal()}</p></div>`;
  }

  // Same local matching semantics and source records as the supplied verifier.
  // No RPC request, wallet action, marketplace write or real verification claim.
  let query = '', result = null, busy = false, timer = null, previousPage = null;
  function verifyLayer() {
    const row = result && typeof result === 'object' ? result : null;
    const status = result==='empty' ? `<p id="hc-verify-error" class="hc-verify-error" role="alert">${L('Enter a token ID, asset number or hash.','请输入代币 ID、资产编号或哈希。')}</p>` : result==='missing' ? `<p class="hc-verify-error" role="status">${L('No match in the illustrative registry. Check the value and try again.','演示登记记录中无匹配项，请核对后重试。')}</p>` : row ? `<p class="hc-verify-ok" role="status">✓ ${L('Consistent with the illustrative record','与演示记录一致')}</p><dl><dt>${L('Token','代币')}</dt><dd>${E(row.id)}</dd><dt>${L('Data package','数据包版本')}</dt><dd>${E(row.anchor.pkg)}</dd><dt>${L('Verification level','验真等级')}</dt><dd>${E(row.level)}</dd><dt>${L('Anchored','上链时间')}</dt><dd>${E(row.anchor.at)}</dd><dt>${L('Block','区块')}</dt><dd>#${num(row.anchor.block)}</dd><dt>${L('Hash','哈希')}</dt><dd>${E(row.anchor.hash)}</dd></dl>` : '';
    return {title:L('Attestation verifier','存证校验器'),dismiss:true,
      html:`<form class="hc-verify" id="hc-verify-form"><p class="hc-verify-demo">${L('Local demonstration only. Records are illustrative; no live on-chain verification is performed.','仅本地演示。使用示例记录，未进行真实链上校验。')}</p><p>${L('Compare a token ID, trusted-asset number or attestation hash with the illustrative registry.','输入代币 ID、可信资产编号或存证哈希，与演示登记记录比对。')}</p><div class="hc-verify-field"><label for="hc-verify-input">${L('Value to verify','待校验内容')}</label><input class="inp" id="hc-verify-input" value="${E(query)}" aria-describedby="hc-verify-help${result==='empty'?' hc-verify-error':''}" ${result==='empty'?'aria-invalid="true"':''} ${busy?'readonly':''}><p id="hc-verify-help">${L('Example: HCT-VEH-0412 or TA-2026-000100','示例：HCT-VEH-0412 或 TA-2026-000100')}</p></div><button class="btn primary" type="submit" ${busy?'disabled':''}>${busy?L('Reading illustrative registry…','正在读取演示记录…'):L('Verify record','校验记录')}</button><div aria-live="polite">${status}</div></form>`,
      foot:`<button type="button" class="btn" data-act="closelayer">${L('Close','关闭')}</button>`};
  }
  function verify() {
    if (busy) return;
    query = document.getElementById('hc-verify-input').value.trim();
    if (!query) { result='empty'; CF.render(); document.getElementById('hc-verify-input').focus(); return; }
    result=null; busy=true; CF.render();
    timer=setTimeout(()=>{
      timer=null; busy=false;
      if (S.layer?.key!=='home-verify') return;
      const v=query.toLowerCase();
      result=D.tokens.find(t=>t.id.toLowerCase()===v || t.assetNo.toLowerCase()===v || t.anchor.hash.toLowerCase()===v) || 'missing';
      CF.render(); document.getElementById('hc-verify-input')?.focus();
    },1200);
  }
  document.addEventListener('submit',event=>{if(event.target.id==='hc-verify-form'){event.preventDefault();verify();}});
  document.addEventListener('input',event=>{if(event.target.id==='hc-verify-input')query=event.target.value;});

  CF.define({id:'public-homepage',pages:[PAGE],dict:{en:{navHome:'Home'},zh:{navHome:'首页'}},content,
    layers:{'home-verify':verifyLayer},
    onAct(act,value,event){
      if(act==='home-section'){
        event.preventDefault();
        const section=document.getElementById('hc-'+value),heading=section?.querySelector('h2');
        if(section){const offset=document.querySelector('.portal-head').getBoundingClientRect().height+24;window.scrollTo({top:section.getBoundingClientRect().top+window.scrollY-offset,behavior:'auto'});heading?.focus({preventScroll:true});}
        return true;
      }
      if(act==='home-verifier'){event.preventDefault();result=null;CF.openLayer('modal','home-verify');queueMicrotask(()=>document.getElementById('hc-verify-input')?.focus());return true;}
      return false;
    }
  });
  CF.Home={afterRender(){
    if(S.layer?.key!=='home-verify'){clearTimeout(timer);timer=null;busy=false;}
    if(S.page===PAGE){
      document.getElementById('foot').innerHTML=footer();
      if(previousPage!==PAGE)window.scrollTo(0,0);
    }
    previousPage=S.page;
  }};
})(window.CF);
