/* WS-432: first-version homepage composition, isolated from business flows. */
(function(CF){
  'use strict';
  const L=CF.L,E=CF.esc,S=CF.S,D=CF.HomeData,PAGE='P-HOME-01';
  const nf=(n,dp=2)=>Number(n).toLocaleString('en-US',{minimumFractionDigits:dp,maximumFractionDigits:dp});
  const num=(n,dp=0)=>nf(n,dp);
  const usd=n=>nf(n)+' USD';
  function compact(n){const a=Math.abs(n);return a>=1e9?(n/1e9).toFixed(2)+'B':a>=1e6?(n/1e6).toFixed(2)+'M':a>=1e3?(n/1e3).toFixed(1)+'K':nf(n);}
  const pct=n=>nf(n*100)+'%';
  const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  filter: '<path d="M3 6h18M6 12h12M10 18h4"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  ext: '<path d="M14 4h6v6M20 4 10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  left: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  right: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  arrowDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  wallet: '<path d="M20 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-4a2 2 0 0 0 0 4h4v2a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6"/>',
  car: '<path d="M3 17v-5l2.5-5h13l2.5 5v5M3 12h18M3 17h18"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  vault: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M12 9V7M12 17v-2M15 12h2M7 12h2"/>',
  bank: '<path d="M3 10h18L12 4Z"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  flame: '<path d="M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8a7 7 0 0 0 7 7Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  fingerprint: '<path d="M12 11v3a8 8 0 0 1-2 5M8 7.5A5 5 0 0 1 17 11v2M7 11a5 5 0 0 1 .5-2.2M4 15c.6-1.2 1-2.6 1-4a7 7 0 0 1 12.5-4.3M16 15c0 2-.4 3.5-1 5M20 13v-2"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'
};
  const ic = (n, s = 16, cls = '') => `<svg class="${cls}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
  // 本期区块链网络只有 Ethereum。
  const netIcon = (s = 20) => `<span class="ic-net" title="Ethereum"><svg width="${s}" height="${s}" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" style="fill:var(--brand-eth)"/><g style="fill:var(--logo-fg)"><path fill-opacity=".6" d="M16.5 4v8.87l7.5 3.35z"/><path d="M16.5 4 9 16.22l7.5-3.35z"/><path fill-opacity=".6" d="M16.5 21.97V28L24 17.62z"/><path d="M16.5 28v-6.03L9 17.62z"/><path fill-opacity=".2" d="m16.5 20.57 7.5-4.35-7.5-3.35z"/><path fill-opacity=".6" d="m9 16.22 7.5 4.35v-7.7z"/></g></svg></span>`;

  function footer(){
    return `<footer class="site-foot home-footer">${CF.marketplaceFooterContent()}</footer>`;
  }
  function content(){
    const T = D.totals, H = D.hero, eligible = H.pledgeValue * H.ratio;
    const cells = Array.from({ length: 60 }, () => '<i></i>').join('');
    const tick = D.activity.concat(D.activity).map((a) => `<span class="tk"><b>${L(a[0], a[1])}</b><span class="t3">${a[2]}</span></span>`).join('');
    const metric = (v, fmt, en, zh, sub) => `<div class="mcell rv"><div class="v" data-count="${v}" data-fmt="${fmt}">0</div><span class="caption">${L(en, zh)}</span>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
    const steps = (rows) => rows.map((s, k) => `<div class="row" style="margin-top:${k ? 6 : 0}px">${ic('check', 14, 'pos')}<span>${s}</span></div>`).join('');
    return `<div class="hc-home"><div class="home" id="home" tabindex="0" role="region" aria-label="${L('Homepage sections','首页分屏内容')}">
    <section class="scr hero" data-i="0" aria-labelledby="home-title-0"><div class="wrap"><div class="hero-g">
      <div><span class="eyebrow rv">${ic('shield', 14)}${L('Trusted assets · On-chain financing', '可信资产 · 链上融资')}</span>
        <h1 id="home-title-0" tabindex="-1" class="rv" style="--d:80ms;margin-top:var(--space-4)">${L('Verified trade assets,<br><em>financed on-chain.</em>', '可信贸易资产，<br><em>在链上完成融资。</em>')}</h1>
        <p class="lead rv" style="--d:160ms">${L('Trade assets whose facts and on-chain attestations come from the Asset Trust Platform are registered as tokens. Institutions lend directly against pledged tokens, and every record is kept on Ethereum.', '经资产可信平台提供资产事实与链上存证的贸易资产以代币形式登记，机构基于质押直接放款，业务记录在 Ethereum 上。')}</p>
        <div class="hero-proof rv" style="--d:240ms"><span>${ic('check')}${L('On-chain attestations you can check', '链上存证可查')}</span><span>${ic('check')}${L('Institutions lend directly; the platform never handles funds', '机构直接放款，平台不经手资金')}</span><span>${ic('check')}${L('Anyone can verify independently', '任何人可以自行查验')}</span></div></div>
      <div class="home-visual-frame"><span class="hv-note">${L('Illustration · fixed example', '示意 · 固定示例')}</span><div class="hv" aria-hidden="true">
        <svg class="paths" viewBox="0 0 560 520" preserveAspectRatio="none"><path class="flowp" d="M200 110 C 290 110, 300 70, 330 70"/><path class="flowp" d="M430 200 C 430 260, 240 250, 170 300"/><path class="flowp" d="M260 390 C 320 400, 320 430, 330 430"/></svg>
        <div class="hv-card" style="left:0;top:20px;--d:200ms"><span class="caption">${L('Trusted asset', '可信资产')}</span><div class="v" style="font-size:var(--text-h3)">${H.tokenNo}</div><div class="small t2">${L('Token ID', '代币编号')}</div><div class="small pos row" style="margin-top:var(--space-2)">${ic('check', 14)}${L('Token admission approved', '代币准入审核通过')}</div></div>
        <div class="hv-card" style="right:0;top:0;width:270px;--d:500ms"><div class="between"><span class="caption">${L('Token', '代币')}</span>${netIcon(16)}</div><div class="v">${nf(H.qty)} <span class="small t2">${L('tokens', '枚')}</span></div><div class="small t2">${L('Token amount', '代币数量')} · Ethereum</div><div class="tok-grid" id="hv-grid">${cells}</div></div>
        <div class="hv-card" style="left:10px;top:290px;--d:800ms"><span class="caption">${L('Project pledge', '项目质押')}</span><div class="v">${nf(eligible)} <span class="small t2">USD</span></div><div class="small t2">${L('Eligible borrowing limit', '有效质押额')}</div><div class="small t3">${L(`Eligible pledged value ${nf(H.pledgeValue)} USD × project pledge ratio ${pct(H.ratio)} (set by the asset owner)`, `有效质押价值 ${nf(H.pledgeValue)} USD × 项目质押率 ${pct(H.ratio)}（资产方自填）`)}</div><div class="bar" style="margin-top:var(--space-2)"><i style="width:${H.ratio * 100}%"></i></div></div>
        <div class="hv-card" style="right:10px;top:370px;--d:1100ms"><span class="caption">${L('Disbursement', '放款')}</span><div class="v" id="hv-live">200,000.00 <span class="small t2">USDC</span></div><div class="small t2">${L('Disbursed amount · currency USDT or USDC', '放款金额 · 放款币种 USDT 或 USDC')}</div></div>
      </div></div></div></div>
      <div class="scroll-cue"><i></i>${L('Scroll', '向下滑动')}</div></section>

    <section class="scr" data-i="1" aria-labelledby="home-title-1"><div class="wrap"><span class="eyebrow rv">${ic('activity', 14)}${L('Business overview · demonstration', '业务概览 · 演示')}</span>
      <h2 id="home-title-1" tabindex="-1" class="big rv" style="--d:80ms">${L('Platform activity anyone can verify.', '平台业务数据，任何人都可以核验。')}</h2>
      <div class="mgrid">${metric(T.value, 'usd', 'Tokenized asset value', '代币化资产总值', L('Incl. matured & invalidated tokens · converted at each token’s issuance rate', '含已到期与失效代币 · 按各笔签发时汇率折算'))}${metric(T.qty, 'qty', 'Total token amount (tokens)', '代币总量（枚）')}${metric(T.fin, 'usd', 'Cumulative financing', '累计融资额', L('USDT and USDC at 1:1 to USD', 'USDT、USDC 按 1:1 折算为 USD'))}${metric(T.active, 'int', 'Active projects', '活跃项目数')}${metric(T.inst, 'int', 'Partner institutions', '合作机构数')}${metric(T.att, 'int', 'On-chain attestations', '链上存证笔数')}</div>
      <div class="home-ticker-wrap"><button type="button" class="home-motion-toggle" data-home-motion aria-pressed="false">${L('Pause animation','暂停动画')}</button><div class="ticker rv" style="--d:300ms"><div class="ticker-track">${tick}</div></div></div>
      <div class="src-note">${L('Illustrative snapshot · ','演示快照 · ')}${ic('clock', 12)}${L('Source: admitted tokens, financing projects, on-chain disbursements and verified institutions on the platform · network: Ethereum · updated', '来源：平台已准入代币、融资项目、链上放款与已认证资金方记录 · 网络：Ethereum · 更新于')} 2026-10-14 08:30 UTC</div></div></section>

    <section class="scr" data-i="2" aria-labelledby="home-title-2"><div class="wrap"><span class="eyebrow rv">${ic('layers', 14)}${L('How it works', '运作机制')}</span>
      <h2 id="home-title-2" tabindex="-1" class="big rv" style="--d:80ms">${L('From a verified asset to a disbursed loan in four steps.', '从可信资产到融资到账，四步完成。')}</h2>
      <div class="hw"><div class="hw-line"><i></i></div>
        <div class="hw-step"><div class="hw-node" style="--d:200ms">${ic('shield', 20)}</div><div class="hw-card rv" style="--d:200ms"><h3>1 · ${L('Verify', '验真')}</h3><p>${L('Asset facts and on-chain attestations come from the Asset Trust Platform. A token appears in the Asset marketplace only after it passes token admission. Admission does not mean the platform confirms the token’s value, authenticity or the validity of the trade.', '资产的业务事实与链上存证由资产可信平台提供；代币经运营端代币准入审核通过后才出现在资产广场；准入通过不代表平台确认代币价值、真伪或交易有效性。')}</p>
          <div class="hw-viz">${steps([L('Asset facts · Asset Trust Platform', '资产事实 · 资产可信平台'), L('On-chain attestation · Asset Trust Platform', '链上存证 · 资产可信平台'), L('Token admission · approved', '代币准入审核 · 通过')])}</div></div></div>
        <div class="hw-step"><div class="hw-node" style="--d:800ms">${ic('layers', 20)}</div><div class="hw-card rv" style="--d:400ms"><h3>2 · ${L('Tokenize', '代币化')}</h3><p>${L('The asset is registered as a token on Ethereum with token type ERC-3525-Receivables. Token amount is counted in tokens: 1 USD equals 1 token at issuance. Token value is the issuance value and does not change afterwards.', '资产以代币形式登记在 Ethereum 上，代币类型为 ERC-3525-应收账款；代币数量以“枚”计，签发时 1 USD 对应 1 枚；代币价值为签发价值，之后不变。')}</p>
          <div class="hw-viz"><div class="t3">${L('Issuance value → token amount (1 USD = 1 token)', '签发价值 → 代币数量（1 USD = 1 枚）')}</div><div class="amount" style="font-size:var(--text-h3);margin-top:var(--space-1)">326,050.00 USD</div><div class="amount pos" style="font-size:var(--text-h3)">= 326,050.00 ${L('tokens', '枚')}</div></div></div></div>
        <div class="hw-step"><div class="hw-node" style="--d:1400ms">${ic('vault', 20)}</div><div class="hw-card rv" style="--d:600ms"><h3>3 · ${L('Pledge', '质押')}</h3><p>${L('The asset owner pledges whole pledge shares into the pledge contract configured for the project; projects under the same combination share one pledge contract. A pledge counts toward the eligible borrowing limit once it succeeds on-chain. Eligible borrowing limit = eligible pledged value × project pledge ratio; the ratio is set by the asset owner and cannot exceed the maximum pledge ratio.', '资产方把质押份额整份质押到项目所配置的质押合约，同一组合下的项目共用一份质押合约；质押上链成功即计入有效质押额；有效质押额 = 有效质押价值 × 项目质押率，项目质押率由资产方自填、不超过最高质押率。')}</p>
          <div class="hw-viz"><div class="between"><span class="t3">${L('Eligible pledged value', '有效质押价值')}</span><b class="amount">500,000.00 USD</b></div><div class="between" style="margin-top:4px"><span class="t3">× ${L('Project pledge ratio', '项目质押率')} ${pct(H.ratio)}</span><b class="amount">${nf(eligible)} USD</b></div><div class="bar" style="margin-top:var(--space-2)"><i class="pos" style="width:${H.ratio * 100}%"></i></div></div></div></div>
        <div class="hw-step"><div class="hw-node" style="--d:2000ms">${ic('bank', 20)}</div><div class="hw-card rv" style="--d:800ms"><h3>4 · ${L('Finance', '融资')}</h3><p>${L('Verified lenders quote on financing requests. Only one institution can quote a round at a time, and a successful quote locks that round. Once the asset owner accepts, the loan is disbursed on-chain from the lender’s disbursement address straight to the asset owner’s receiving address — the platform never handles funds. Disbursement currency is USDT or USDC.', '已认证资金方对融资需求报价，同一轮需求同一时刻只由一家机构报价，报价成功即锁定该轮需求；资产方接受后链上放款，款项从资金方放款地址直接转入资产方收款地址，平台不经手资金；放款币种为 USDT 或 USDC。')}</p>
          <div class="hw-viz">${steps([L('Quote submitted · round locked', '报价成功 · 该轮需求锁定'), L('Quote accepted by the asset owner', '资产方接受报价'), L('Disbursed on-chain · USDT or USDC', '链上放款 · USDT 或 USDC')])}</div></div></div>
      </div></div></section>

    <section class="scr" data-i="3" aria-labelledby="home-title-3"><div class="wrap"><span class="eyebrow rv">${ic('shield', 14)}${L('Platform features', '平台特点')}</span>
      <h2 id="home-title-3" tabindex="-1" class="big rv" style="--d:80ms">${L('Built for institutions that verify before they lend.', '为“先核验、再放款”的机构而设计。')}</h2>
      <div class="why">${[
        ['fingerprint', 'Source-level verification', '源头验真', 'Asset facts and on-chain attestations come from the Asset Trust Platform.', '资产事实与链上存证来自资产可信平台。', `${num(T.att)} on-chain attestations`, `链上存证 ${num(T.att)} 笔`],
        ['lock', 'Compliance built in', '合规内建', 'Tokens are shown publicly only after token admission. Only verified lenders can grant credit and quote. Asset owners register and verify on the Asset Trust Platform.', '代币经运营准入审核后才公开展示；只有已认证资金方可以授信与报价；资产方须在资产可信平台完成注册与认证。', `${num(T.inst)} verified partner institutions`, `合作机构 ${num(T.inst)} 家，均已认证`],
        ['bank', 'Direct, bilateral lending', '双边直贷', 'The platform neither pools nor advances funds. Lenders set the annual interest rate and decide on credit themselves.', '平台不归集资金、不垫付；年化利率由资金方填写；授信由资金方自行决定。', 'Funds go from lender to asset owner directly', '款项由资金方直接转入资产方收款地址'],
        ['search', 'Verify it yourself', '自行查验', 'Anyone can compare a token ID or attestation hash with the attestation record, or check it in a block explorer.', '任何人可以凭代币编号或存证哈希比对存证记录，也可以到区块浏览器自行查验。', 'Attestation transactions open in a block explorer', '链上存证交易可在区块浏览器打开']
      ].map((w, k) => `<div class="why-c rv" style="--d:${120 + k * 100}ms"><span class="ic-type">${ic(w[0], 20)}</span><div><h3>${L(w[1], w[2])}</h3><p>${L(w[3], w[4])}</p><div class="proof">${ic('check', 14, 'pos')}${L(w[5], w[6])}</div>${w[0] === 'search' ? `<a class="btn-link why-act" href="#/home" data-act="home-verifier">${L('Open attestation verification', '打开存证校验')}${ic('right', 14)}</a>` : ''}</div></div>`).join('')}</div></div></section>

    <section class="scr" data-i="4" aria-labelledby="home-title-4"><div class="wrap"><span class="eyebrow rv">${ic('globe', 14)}${L('Partners', '合作伙伴')}</span>
      <h2 id="home-title-4" tabindex="-1" class="big rv" style="--d:80ms">${L('One network across data, assets and capital.', '数据、资产与资金，一张网络。')}</h2>
      <div class="pt-groups">${[
        ['Data & verification', '数据与验真', ['Chengyuan Trust', 'Veritas Inspect', 'PortSync', 'LedgerAnchor']],
        ['Asset originators', '资产方', ['Carloha Trading', 'Meridian Receivables', 'Pacific Auto Supply', 'Gulf Motors']],
        ['Capital partners', '资金方', ['Northbridge FO', 'Harbor Ridge Fund', 'Kestrel Capital', 'Aster Bay Capital']]
      ].map((g, k) => `<div class="pt-g rv" style="--d:${150 + k * 120}ms"><h3>${L(g[0], g[1])}</h3><div class="pt-logos">${g[2].map((n) => `<div class="pt-logo">${ic(k === 0 ? 'shield' : k === 1 ? 'building' : 'bank', 16)}${n}</div>`).join('')}</div></div>`).join('')}</div>
      <p class="hint" style="margin-top:var(--space-4)">${L('Partner names are placeholders for the prototype.', '合作伙伴名称为原型占位。')}</p></div></section>

    <section class="scr scr-last" data-i="5" aria-labelledby="home-title-5"><div class="wrap" style="flex:1;display:flex;flex-direction:column;justify-content:center"><span class="eyebrow rv">${ic('file', 14)}${L('Before you start', '使用须知')}</span>
      <h2 id="home-title-5" tabindex="-1" class="big rv" style="--d:80ms">${L('Browse in public. Transact once verified.', '公开浏览，认证后办理。')}</h2>
      <ul class="home-notes rv" style="--d:160ms">${[
        L('Token information in the Asset marketplace is public to everyone.', '资产广场的代币信息对所有访客公开。'),
        L('The Lending marketplace project list is public; project details depend on who you are — visitors see basic information only.', '借贷广场的项目列表公开；项目详情按身份决定可见范围，游客只看到基本信息。'),
        L('Credit, quoting and disbursement are open to verified lenders only.', '授信、报价与放款只对已认证资金方开放。'),
        L('Asset owners register and verify on the Asset Trust Platform; the only way to sign in is Connect wallet.', '资产方在资产可信平台完成注册与认证；登录方式只有连接钱包。')
      ].map((t) => `<li>${ic('check', 14, 'pos')}<span>${t}</span></li>`).join('')}</ul>
      <div class="rv" style="--d:240ms;margin-top:var(--space-6)"><a class="btn btn-primary btn-lg" href="#/assets">${L('Asset marketplace', '资产广场')}${ic('right')}</a></div></div>${footer()}</section>
    </div>
    <nav class="scr-dots" aria-label="${L('Sections', '分屏')}">${[0, 1, 2, 3, 4, 5].map((i) => `<button type="button" aria-label="${L('Section', '第')} ${i + 1}" data-home-section="${i}"></button>`).join('')}</nav></div>`;
  }
  // Local demonstration: matches the illustrative records only. No RPC request, wallet action or real verification claim.
  let query = '', result = null, busy = false, timer = null;
  const dash = v => v === null || v === undefined || v === '' ? '—' : E(String(v));
  function verifyLayer() {
    const rows = Array.isArray(result) ? result : null;
    const record = r => `<dl><dt>${L('Token ID','代币编号')}</dt><dd>${dash(r.no)}</dd><dt>${L('Attestation hash','存证哈希')}</dt><dd>${dash(r.hash)}</dd><dt>${L('Attestation transaction hash','链上存证交易哈希')}</dt><dd>${dash(r.tx)}</dd><dt>${L('Block height','区块高度')}</dt><dd>${r.block ? num(r.block) : '—'}</dd><dt>${L('Attestation chain','存证链')}</dt><dd>${dash(r.chain)}</dd><dt>${L('Attested at','存证时间')}</dt><dd>${dash(r.at)}</dd></dl>`;
    const status = result==='empty' ? `<p id="hc-verify-error" class="hc-verify-error" role="alert">${L('Enter a token ID or attestation hash.','请输入代币编号或存证哈希。')}</p>` : result==='missing' ? `<p class="hc-verify-error" role="status">${L('No matching record found. Check the value and try again.','未找到匹配的登记记录，请核对后重试。')}</p>` : rows ? `<p class="hc-verify-ok" role="status">✓ ${L('Consistent with the registered attestation record','与登记的存证记录一致')}${rows.length>1?L(` · ${rows.length} tokens`,` · 共 ${rows.length} 笔代币`):''}</p>${rows.map(record).join('')}` : '';
    return {title:L('Attestation verification','存证校验'),dismiss:true,
      html:`<form class="hc-verify" id="hc-verify-form"><p class="hc-verify-demo">${L('Local demonstration only. Records are illustrative; no live on-chain verification is performed.','仅本地演示。使用示例记录，未进行真实链上校验。')}</p><p>${L('Compare a token ID or attestation hash with the registered on-chain attestation record.','输入代币编号或存证哈希，与登记的链上存证记录比对。')}</p><div class="hc-verify-field"><label for="hc-verify-input">${L('Value to verify','待校验内容')}</label><input class="inp" id="hc-verify-input" value="${E(query)}" aria-describedby="hc-verify-help${result==='empty'?' hc-verify-error':''}" ${result==='empty'?'aria-invalid="true"':''} ${busy?'readonly':''}><p id="hc-verify-help">${L('Token ID, e.g. TK20260612000147 · Attestation hash, e.g. 0x followed by 64 hex characters','代币编号示例：TK20260612000147 · 存证哈希示例：0x 开头的 64 位十六进制字符')}</p></div><button class="btn primary" type="submit" ${busy?'disabled':''}>${busy?L('Reading records…','正在读取记录…'):L('Verify','校验')}</button><div aria-live="polite">${status}</div></form>`,
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
      const v=query.toLowerCase(),rows=D.tokens.filter(t=>t.no.toLowerCase()===v || t.hash.toLowerCase()===v);
      result=rows.length?rows:'missing';
      CF.render(); document.getElementById('hc-verify-input')?.focus();
    },1200);
  }
  document.addEventListener('submit',event=>{if(event.target.id==='hc-verify-form'){event.preventDefault();verify();}});
  document.addEventListener('input',event=>{if(event.target.id==='hc-verify-input')query=event.target.value;});

  const media=matchMedia('(prefers-reduced-motion: reduce)');
  let io=null,resizeObserver=null,liveTimer=null,scrollFrame=null,scrollTop=0,previousPage=null,lastLang=null,heldHome=null,frames=new Set(),delays=new Set(),seen=new Set(),motionPaused=false,liveIndex=0;
  const amounts=[[200000,'USDC'],[150000,'USDC'],[310000,'USDT'],[240000,'USDT']];
  function frame(fn){const id=requestAnimationFrame(now=>{frames.delete(id);fn(now);});frames.add(id);return id;}
  function delay(fn,ms){const id=setTimeout(()=>{delays.delete(id);fn();},ms);delays.add(id);}
  function dispose(){
    io?.disconnect();io=null;resizeObserver?.disconnect();resizeObserver=null;
    clearInterval(liveTimer);liveTimer=null;frames.forEach(cancelAnimationFrame);frames.clear();
    delays.forEach(clearTimeout);delays.clear();scrollFrame=null;
  }
  function setDot(index){document.querySelectorAll('.hc-home .scr-dots button').forEach((button,i)=>{
    button.classList.toggle('on',i===index);
    if(i===index)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
  });}
  function settleGrid(){document.querySelectorAll('#hv-grid i').forEach((cell,k)=>cell.className=k<44||k>=52?'lk':'on');}
  function fillGrid(){
    if(media.matches||motionPaused){settleGrid();return;}
    const cells=Array.from(document.querySelectorAll('#hv-grid i'));
    cells.forEach(cell=>cell.className='');
    cells.forEach((cell,k)=>delay(()=>cell.classList.add(k<52?'on':'lk'),700+k*28));
    delay(()=>cells.slice(0,44).forEach(cell=>cell.className='lk'),700+60*28+600);
  }
  function countUp(el,instant=false){
    if(el.dataset.done)return;
    el.dataset.done='true';const target=+el.dataset.count;
    const format=value=>el.dataset.fmt==='usd'?'$'+compact(value):el.dataset.fmt==='qty'?compact(value):nf(value,0);
    const full=el.dataset.fmt==='usd'?usd(target):el.dataset.fmt==='qty'?nf(target)+' '+L('tokens','枚'):nf(target,0);
    el.title=full;el.setAttribute('aria-label',full);
    if(instant||media.matches||motionPaused){el.textContent=format(target);return;}
    const start=performance.now();
    const step=now=>{const k=Math.min(1,(now-start)/1400),e=1-Math.pow(1-k,3);el.textContent=format(target*e);if(k<1)frame(step);};
    frame(step);
  }
  function showLive(){const el=document.getElementById('hv-live');if(!el)return;const [amount,ccy]=amounts[liveIndex];el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');el.innerHTML=`${nf(amount)} <span class="small t2">${ccy}</span>`;}
  function applyMotion(){
    const home=document.querySelector('.hc-home');if(!home)return;
    const paused=motionPaused||media.matches;
    home.classList.toggle('home-motion-paused',paused);
    const button=home.querySelector('[data-home-motion]');
    button.setAttribute('aria-pressed',String(motionPaused));
    button.textContent=motionPaused?L('Resume animation','继续动画'):L('Pause animation','暂停动画');
    button.hidden=media.matches;
    clearInterval(liveTimer);liveTimer=null;
    if(paused){frames.forEach(cancelAnimationFrame);frames.clear();scrollFrame=null;delays.forEach(clearTimeout);delays.clear();settleGrid();home.querySelectorAll('[data-count]').forEach(el=>{delete el.dataset.done;countUp(el,true);});}
    else liveTimer=setInterval(()=>{if(document.hidden)return;liveIndex=(liveIndex+1)%amounts.length;showLive();},4000);
  }
  function fitHome(){
    const home=document.querySelector('.hc-home'),root=document.getElementById('home');if(!home||!root)return;
    const header=document.querySelector('.portal-head');home.style.setProperty('--home-header-h',header.getBoundingClientRect().height+'px');
    const frame=home.querySelector('.home-visual-frame');
    if(innerWidth<=640){const scale=frame.clientWidth/560;frame.style.height=(520*scale)+'px';frame.style.setProperty('--home-visual-scale',String(scale));}
    else {frame.style.height='';frame.style.removeProperty('--home-visual-scale');}
  }
  function activeSection(){
    const root=document.getElementById('home');if(!root)return;
    const top=root.getBoundingClientRect().top;
    const sections=Array.from(root.querySelectorAll('.scr'));
    let best=0,area=-1;
    sections.forEach((section,i)=>{const r=section.getBoundingClientRect(),visible=Math.max(0,Math.min(r.bottom,top+root.clientHeight)-Math.max(r.top,top));if(visible>area){area=visible;best=i;}});
    setDot(best);
  }
  function afterRender(){
    if(S.layer?.key!=='home-verify'){clearTimeout(timer);timer=null;busy=false;}
    const home=S.page===PAGE;
    document.documentElement.toggleAttribute('data-home-view',home);
    document.getElementById('foot').hidden=home;
    if(!home){scrollTop=0;seen.clear();previousPage=S.page;return;}
    // Header/menu/message refreshes must not restart the first version's animation timeline.
    if(heldHome){
      const foot=heldHome.querySelector('.home-footer'),html=CF.marketplaceFooterContent();
      if(foot.innerHTML!==html)foot.innerHTML=html;
      document.querySelector('.hc-home').replaceWith(heldHome);heldHome=null;fitHome();return;
    }
    const root=document.getElementById('home');
    fitHome();
    if(previousPage!==PAGE){scrollTop=0;seen.clear();liveIndex=0;}
    root.style.scrollBehavior='auto';root.scrollTop=scrollTop;root.style.scrollBehavior='';
    const initialSeen=new Set(seen);
    root.querySelectorAll('.scr').forEach(section=>{
      const i=+section.dataset.i;
      if(initialSeen.has(i)){section.classList.add('in');section.querySelectorAll('[data-count]').forEach(el=>countUp(el,true));}
    });
    if(initialSeen.has(0))settleGrid();
    io=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(!entry.isIntersecting||entry.intersectionRect.height<Math.min(entry.boundingClientRect.height,root.clientHeight)*.4)return;
      const section=entry.target,i=+section.dataset.i,first=!seen.has(i);
      section.classList.add('in');seen.add(i);
      if(i===0&&first)fillGrid();
      section.querySelectorAll('[data-count]').forEach(el=>countUp(el,initialSeen.has(i)));
    }),{root,threshold:[0,.01,.1,.2,.4,.45,.6]});
    root.querySelectorAll('.scr').forEach(section=>io.observe(section));
    root.addEventListener('scroll',()=>{scrollTop=root.scrollTop;if(!scrollFrame)scrollFrame=frame(()=>{scrollFrame=null;activeSection();});},{passive:true});
    resizeObserver=new ResizeObserver(()=>{fitHome();activeSection();});resizeObserver.observe(document.querySelector('.portal-head'));resizeObserver.observe(root);
    activeSection();applyMotion();if(liveIndex)showLive();previousPage=PAGE;lastLang=S.lang;
    // A long viewport may expose the footer with keyboard navigation; keep focus reachable.
    root.addEventListener('focusin',event=>{const section=event.target.closest('.scr');if(section&&event.target!==root){const r=event.target.getBoundingClientRect(),view=root.getBoundingClientRect();if(r.bottom>view.bottom||r.top<view.top)event.target.scrollIntoView({block:'nearest',behavior:'auto'});}});
  }
  document.addEventListener('click',event=>{
    const dot=event.target.closest('[data-home-section]'),pause=event.target.closest('[data-home-motion]');
    if(!dot&&!pause)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(pause){motionPaused=!motionPaused;applyMotion();return;}
    const root=document.getElementById('home'),section=root?.querySelector(`[data-i="${dot.dataset.homeSection}"]`);
    if(root&&section)root.scrollTo({top:section.offsetTop,behavior:media.matches?'auto':'smooth'});
  },true);
  media.addEventListener('change',()=>{if(S.page===PAGE)applyMotion();});
  window.addEventListener('pagehide',dispose);
  CF.define({id:'public-homepage',pages:[PAGE],dict:{en:{navHome:'Home'},zh:{navHome:'首页'}},content,
    layers:{'home-verify':verifyLayer},
    onAct(act,value,event){
      if(act==='home-verifier'){event.preventDefault();result=null;CF.openLayer('modal','home-verify');queueMicrotask(()=>document.getElementById('hc-verify-input')?.focus());return true;}
      return false;
    }
  });
  CF.Home={beforeRender(){const root=document.getElementById('home');if(root)scrollTop=root.scrollTop;if(root&&S.page===PAGE&&previousPage===PAGE&&lastLang===S.lang){heldHome=document.querySelector('.hc-home');return;}heldHome=null;dispose();},afterRender};
})(window.CF);
