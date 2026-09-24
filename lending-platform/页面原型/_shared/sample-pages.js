/* WS-347：承载与关联样板。沿用底座/消息组合入口，不接管业务模块自身路由。 */
(function (CF) {
  'use strict';
  CF.makeRelationSample = function (requests, assets) {
    const S = CF.S, L = CF.L, E = CF.esc;
    const LIST = 'P-LS-01', CONSOLE = 'P-MC-01', PROJECT = 'SAMPLE-PROJECT', RECORD = 'SAMPLE-RECORD', TOKEN = 'SAMPLE-TOKEN';
    const projects = requests.map((r, i) => ({id: 'S-PJ-' + String(i + 1).padStart(3, '0'), request: r,
      token: assets.find(t => t.holder[0] === r.holder[0] && t.ps === 'pledged')}));
    CF.PAGES[PROJECT] = {end:'asset', layout:'portal', crumbKey:'sampleProject', parent:LIST};
    CF.PAGES[RECORD] = {end:'asset', layout:'portal', crumbKey:'sampleRecord', parent:CONSOLE, auth:true};
    CF.PAGES[TOKEN] = {end:'asset', layout:'portal', crumbKey:'sampleToken', parent:PROJECT};
    CF.ENTRY[TOKEN] = '/sample/token';
    CF.ENTRY[PROJECT] = '/sample/project'; CF.ENTRY[RECORD] = '/sample/record';
    const dict = {en:{sampleProject:'Project details',sampleRecord:'Record details',sampleToken:'Token details'},zh:{sampleProject:'项目详情',sampleRecord:'记录详情',sampleToken:'代币详情'}};
    const params = () => new URLSearchParams(location.hash.split('?')[1] || '');
    const num = (q, k, max, fallback=0) => Math.floor(Math.max(0, Math.min(max, Number(q.get(k)) || fallback)));
    const route = (path, q) => path + (q.toString() ? '?' + q : '');
    const allowed = value => /^\/(?:console|marketplace|sample\/record|sample\/project|sample\/token)(?:\?|$)/.test(value || '') ? value : '/marketplace';
    const current = () => location.hash.slice(1);
    const find = () => projects.find(p => p.id === params().get('id'));
    const mine = p => S.role === 'asset' ? p.request.holder[0] === 'Asset Holder A' : S.role === 'fund' && ['disbursing','repaying'].includes(p.request.st);
    const name = p => L('Receivables financing · ', '应收账款融资 · ') + L(p.request.holder[0],p.request.holder[1]);
    const button = (act,label,value='',primary=false) => '<button type="button" class="btn'+(primary?' primary':'')+'" data-act="'+act+'" data-v="'+E(value)+'">'+label+'</button>';
    const link = (path,label,primary=false) => '<a class="btn'+(primary?' primary':'')+'" href="#'+E(path)+'" data-act="sample-follow" data-v="'+E(path)+'">'+label+'</a>';
    const status = p => CF.tag(p.request.st==='repaying'?'ok':'accent', L({quoting:'Receiving quotes',review:'Under review',disbursing:'Disbursing',repaying:'Repaying'}[p.request.st], {quoting:'报价中',review:'审核中',disbursing:'放款中',repaying:'还款中'}[p.request.st]));
    const fields = rows => '<dl class="dl">'+rows.map(r=>'<dt>'+r[0]+'</dt><dd>'+r[1]+'</dd>').join('')+'</dl>';
    const card = (title,body,id='') => '<section class="card detail-section"'+(id?' id="'+id+'"':'')+'><h2 class="card-head">'+title+'</h2><div class="card-body">'+body+'</div></section>';
    const projectFields = p => fields([[L('Project ID','项目编号'),E(p.id)],[L('Asset holder','资产方企业'),E(L(...p.request.holder))],[L('Current request','当前需求'),E(p.request.id)],[L('Requested amount','需求金额'),CF.fmtAmt(p.request.amt,p.request.ccy)],[L('Tenor','期限'),p.request.tenor+L(' days',' 天')]]);
    const recordFields = p => fields([[L('Request ID','需求编号'),E(p.request.id)],[L('Amount','金额'),CF.fmtAmt(p.request.amt,p.request.ccy)],[L('Tenor','期限'),p.request.tenor+L(' days',' 天')],[L('Indicative annual rate','参考年化'),E(p.request.rate)+' %'],[L('Updated','更新时间'),CF.fmtTime(p.request.at)]]);
    let restoredHash = null;
    let detailHash = null;
    function restoreDetail() {
      if(detailHash===location.hash)return;
      detailHash=location.hash;restoredHash=null;
      const hash=location.hash,y=num(params(),'y',100000);
      requestAnimationFrame(()=>{if(hash!==location.hash)return;document.querySelector('#content h1')?.focus({preventScroll:true});window.scrollTo(0,y);});
    }
    function restoreList() {
      detailHash=null;
      if (restoredHash === location.hash) return;
      restoredHash = location.hash;
      const q = params(), hash = location.hash;
      S.shown = num(q,'shown',100,20); S.pageNo = Math.max(1,num(q,'page',100,1));
      requestAnimationFrame(() => {
        if (hash !== location.hash) return;
        const box = document.querySelector('.sample-list');
        if (box) box.scrollTop = num(q,'scroll',100000);
        window.scrollTo(0,num(q,'outer',100000));
        const focus = document.getElementById(q.get('focus'));
        if (focus) focus.focus({preventScroll:true});
      });
    }
    function captureList(id) {
      const q = params(), box = document.querySelector('.sample-list');
      q.set('shown', S.shown); q.set('page', S.pageNo); q.set('scroll',box?.scrollTop || 0); q.set('outer',window.scrollY); q.set('focus','sample-row-'+id);
      const saved = route(S.page===CONSOLE?'/console':'/marketplace', q);
      history.replaceState(null,'','#'+saved); restoredHash = null;
      return saved;
    }
    function destination(path,p,from) { return route(path,new URLSearchParams({id:p.id,from:allowed(from)})); }
    function head(title,desc,side='') { return '<div class="page-head"><div><h1 class="page-title" tabindex="-1">'+title+'</h1><p class="page-desc">'+desc+'</p></div><div class="page-actions">'+side+'</div></div>'; }
    function list(consoleMode) {
      restoreList();
      const legacy=projects.find(p=>p.request.id===params().get('object'));
      // 兼容旧消息深链时替换中转页，避免后退到中转页后再次被送回详情。
      if(!consoleMode&&params().get('panel')==='detail'&&legacy) location.replace('#'+destination('/sample/project',legacy,'/marketplace'));
      if(consoleMode && !['asset','fund'].includes(S.role)) return CF.empty(L('Sign in to view your console','登录后查看我的控制台'), L('View activity associated with your account.','查看与你的账户有关的业务记录。'),button('signin',L('Sign in','登录'),'',true));
      const q=params(), keyword=q.get('q')||'', currency=q.get('ccy')||'';
      const all=projects.filter(p=>!consoleMode||mine(p));
      const rows=all.filter(p=>(!currency||p.request.ccy===currency)&&(!keyword||(p.id+' '+p.request.id+' '+p.request.holder.join(' ')).toLowerCase().includes(keyword.toLowerCase())));
      if(consoleMode) S.pageNo=Math.min(S.pageNo,Math.max(1,Math.ceil(rows.length/5)));
      const shown=consoleMode?rows.slice((S.pageNo-1)*5,S.pageNo*5):rows.slice(0,S.shown);
      const alt=CF.surface({emptyTitle:L('No records yet','暂无记录'),emptyDesc:L('New records will appear here.','有新记录后会显示在这里。')});
      const filters='<div class="filterbar">'+
        CF.filterSelect('sample-currency',L('Currency','币种'),[['',L('All','全部')],['USD','USD'],['EUR','EUR']],currency,'')+
        CF.filterSearch('sample-q',L('Project, request or asset holder','项目、需求或资产方'),keyword)+
        '<div class="fb-acts">'+button('sample-reset',L('Reset','重置'))+button('sample-search',L('Search','查询'),'',true)+'</div></div>';
      const labels=[consoleMode?L('Request','融资需求'):L('Financing project','融资项目'),L('Asset holder','资产方企业'),L('Requested amount','需求金额'),L('Status','状态'),L('Actions','操作')];
      const table='<div class="tablewrap '+(consoleMode?'':'listbox listbox-contained sample-list')+'" tabindex="0" role="region" aria-label="'+L('Records','记录列表')+'"><table class="tbl resp"><thead><tr>'+labels.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+shown.map(p=>'<tr>'+[
        '<a class="actlink" id="sample-row-'+p.id+'" href="#'+E(destination(consoleMode?'/sample/record':'/sample/project',p,current()))+'" data-act="sample-open" data-v="'+p.id+'">'+E(consoleMode?p.request.id:p.id)+'</a>',E(L(...p.request.holder)),CF.fmtAmt(p.request.amt,p.request.ccy),status(p),button('sample-preview',L('Quick view','速览'),p.id)
      ].map((v,i)=>'<td data-label="'+labels[i]+'">'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table>'+(consoleMode?'':CF.moreFoot(rows.length))+'</div>';
      return head(consoleMode?L('My console','我的控制台'):L('Lending marketplace','借贷广场'),consoleMode?L('Your financing activity','与你有关的融资业务'):L('Explore financing projects and current requests','查看融资项目及当前需求'))+'<section class="card">'+filters+(alt||(rows.length?table+(consoleMode?CF.pagerFoot(rows.length,5):''):CF.empty(L('No matching records','筛选无结果'),L('Try a different keyword or clear your filters.','更换关键词或清空筛选。'),button('sample-reset-confirm',L('Clear filters','清空筛选')))))+'</section>';
    }
    function detail(record) {
      restoreDetail();
      const p=find();
      if(record && (!p||!mine(p))) return CF.empty(L('Record unavailable','记录不可用'),L('Sign in with an account associated with this record.','请使用与该记录有关的账户登录。'),link('/console',L('My console','我的控制台')));
      if(!p) return CF.empty(L('Project unavailable','项目不可用'),L('The link may be invalid.','链接可能已失效。'),link('/marketplace',L('Lending marketplace','借贷广场')));
      const alt=CF.surface({emptyTitle:L('No details available','暂无详情'),emptyDesc:L('No information is available for this record.','当前记录暂无可展示资料。')});
      if(alt) return head(record?L('Record details','记录详情'):L('Project details','项目详情'),E(p.id))+alt;
      const origin=allowed(params().get('from')), fromRecord=origin.startsWith('/sample/record?');
      if(record) return head(L('Financing request','融资需求')+' · '+E(p.request.id),E(name(p)),status(p))+
        '<div class="detail-stack">'+card(L('Request information','需求信息'),recordFields(p))+card(L('Associated project','关联项目'),projectFields(p)+'<div class="detail-actions">'+link(destination('/sample/project',p,current()),L('Open in lending marketplace','前往借贷广场'),true)+'</div>')+'</div>';
      const token=p.token;
      const tokenList=token?'<table class="tbl resp"><thead><tr><th>'+L('Token','代币')+'</th><th>'+L('Quantity','数量')+'</th><th>'+L('Value','价值')+'</th></tr></thead><tbody><tr><td data-label="'+L('Token','代币')+'"><a class="actlink mono" data-act="sample-follow" data-v="'+E(destination('/sample/token',p,current()))+'" href="#'+E(destination('/sample/token',p,current()))+'">'+E(token.no)+'</a><div class="cell-sub">'+E(token.name)+'</div></td><td data-label="'+L('Quantity','数量')+'">'+CF.fmtAmt(token.qty)+L(' tokens',' 枚')+'</td><td data-label="'+L('Value','价值')+'">'+CF.fmtAmt(token.val,'USD')+'</td></tr></tbody></table>':CF.empty(L('No collateral records','暂无质押代币'),'');
      return head(E(name(p)),E(p.id),status(p))+'<div class="detail-layout"><div class="detail-stack">'+
        card(L('Project information','项目资料'),projectFields(p),'sample-overview')+
        card(L('Pledged tokens','质押代币清单'),tokenList,'sample-tokens')+
        card(L('Financing requests','融资信息清单'),'<div class="detail-record"><div><b class="mono">'+E(p.request.id)+'</b><p>'+CF.fmtAmt(p.request.amt,p.request.ccy)+'</p>'+status(p)+'</div>'+button('sample-preview',L('Quick view','速览'),p.id)+'</div>','sample-history')+
        '</div><aside class="detail-rail"><section class="card"><h2 class="card-head">'+L('On this page','本页内容')+'</h2><nav class="detail-index" aria-label="'+L('Page sections','页内目录')+'">'+[['sample-overview',L('Project information','项目资料')],['sample-tokens',L('Pledged tokens','质押代币清单')],['sample-history',L('Financing requests','融资信息清单')]].map(x=>button('sample-section',x[1],x[0])).join('')+'</nav></section>'+
        (fromRecord?card(L('My console','我的控制台'),'<p>'+E(p.request.id)+'</p>'+link(origin,L('Back to record','返回该记录'),true)):mine(p)?card(L('My console','我的控制台'),link(destination('/sample/record',p,'/console'),L('View my record','查看我的记录'))):'')+'</aside></div>';
    }
    const layers={samplePreview:id=>{const p=projects.find(p=>p.id===id);if(!p)return null;return {title:L('Request quick view','需求速览')+' · '+p.request.id,html:status(p)+recordFields(p),foot:button('closelayer',L('Close','关闭'))+button('sample-preview-open',L('Open project details','查看项目详情'),p.id,true)};},sampleReset:()=>({title:L('Clear filters?','清空筛选条件？'),html:'<p>'+L('The full list will be shown from the beginning.','将显示全部记录，并回到列表起点。')+'</p>',foot:button('closelayer',L('Cancel','取消'))+button('sample-reset-confirm',L('Clear filters','清空筛选'),'',true)})};
    function action(act,v) {
      if(!act.startsWith('sample-'))return false;
      const p=projects.find(p=>p.id===v);
      if(act==='sample-follow') {
        const target=allowed(v), q=new URLSearchParams(target.split('?')[1]||'');
        if(q.get('from')===current()) {
          const source=params();source.set('y',window.scrollY);
          const saved=route(current().split('?')[0],source);
          history.replaceState(null,'','#'+saved);q.set('from',saved);
        }
        location.hash='#'+route(target.split('?')[0],q);return true;
      }
      if(act==='sample-request') {const target=projects.find(p=>p.request.id===v);if(target)location.hash='#'+destination('/sample/project',target,'/marketplace');return true;}
      if(act==='sample-search'||act==='sample-reset-confirm') {
        const q=new URLSearchParams();
        if(act==='sample-search'){q.set('q',document.getElementById('sample-q').value.trim());q.set('ccy',document.getElementById('sample-currency').value);}
        S.layer=null;S.st='default';S.pageNo=1;S.shown=20;
        restoredHash=null;location.hash='#'+route(S.page===CONSOLE?'/console':'/marketplace',q);
      } else if(act==='sample-reset') CF.openLayer('modal','sampleReset');
      else if(act==='sample-preview') CF.openLayer('drawer','samplePreview',v);
      else if(act==='sample-section') {document.getElementById(v)?.scrollIntoView({block:'start',behavior:'instant'});}
      else if(act==='sample-open'||act==='sample-preview-open') {
        if(!p)return true;
        const from=[LIST,CONSOLE].includes(S.page)?captureList(v):current();
        S.layer=null;location.hash='#'+destination(act==='sample-open'&&S.page===CONSOLE?'/sample/record':'/sample/project',p,from);
      }
      return true;
    }
    function breadcrumb(id) {
      const q=params(), from=allowed(q.get('from'));
      if(S.page===TOKEN&&id===PROJECT)return from.startsWith('/sample/project?')?from:'/sample/project?id='+E(q.get('id'));
      if(S.page===RECORD&&id===CONSOLE)return from.startsWith('/console')?from:'/console';
      if(S.page===PROJECT&&id===LIST)return from.startsWith('/marketplace')?from:'/marketplace';
      return null;
    }
    function tokenDetail() {
      restoreDetail();
      const p=find(),t=p?.token;
      if(!t)return CF.empty(L('Token unavailable','代币不可用'),'');
      return head(E(t.name),E(t.no))+card(L('Token information','代币信息'),fields([[L('Token number','代币编号'),E(t.no)],[L('Holder','持有人'),E(L(...t.holder))],[L('Quantity','数量'),CF.fmtAmt(t.qty)+L(' tokens',' 枚')],[L('Value','价值'),CF.fmtAmt(t.val,'USD')],[L('Receivable term','应收账款账期'),CF.fmtDate(t.from)+' – '+CF.fmtDate(t.to)]]));
    }
    return {dict,layers,action,breadcrumb,reviewRoute:id=>{if(![PROJECT,RECORD,TOKEN].includes(id))return CF.ENTRY[id];const p=projects.find(p=>id===RECORD?mine(p):id===TOKEN?!!p.token:true);return p?CF.ENTRY[id]+'?id='+encodeURIComponent(p.id):null;},content:page=>page===LIST?list(false):page===CONSOLE?list(true):page===PROJECT?detail(false):page===RECORD?detail(true):page===TOKEN?tokenDetail():null};
  };
})(window.CF);

(function (CF) {
  var L = CF.L, esc = CF.esc, S = CF.S, tag = CF.tag;
  if(document.getElementById("focus")) {
    CF.PAGES["DEMO-FOCUS"] = {end:"asset", layout:"focus", navKey:"focusSample"};
    CF.ENTRY["DEMO-FOCUS"] = "/sample/focus";
  }

  /* ====================== 演示数据 ======================================
     全部为演示数据，不对应任何真实企业、金额或利率。 */
  var ASSETS = [
    { no: "TK20260612000147", name: "HC-AR-2606", holder: ["Asset Holder A", "资产方 A"],
      kind: "ar", qty: 1250, val: 1250000, ts: "valid", ps: "pledged",
      from: "2026-06-12", to: "2026-09-10", at: "2026-06-12T10:20:00" },
    { no: "TK20260705000288", name: "HC-AR-2607", holder: ["Asset Holder B", "资产方 B"],
      kind: "ar", qty: 860, val: 860000, ts: "valid", ps: "unpledged",
      from: "2026-07-05", to: "2026-11-02", at: "2026-07-05T09:05:00" },
    { no: "TK20260818000361", name: "HC-AR-2608", holder: ["Asset Holder C", "资产方 C"],
      kind: "ar", qty: 2040, val: 2040000, ts: "valid", ps: "pledged",
      from: "2026-08-18", to: "2026-10-17", at: "2026-08-18T16:40:00" },
    { no: "TK20260220000092", name: "HC-AR-2602", holder: ["Asset Holder A", "资产方 A"],
      kind: "ar", qty: 460, val: 460000, ts: "void", ps: "unpledged",
      from: "2026-02-20", to: "2026-05-21", at: "2026-02-20T11:15:00" },
    { no: "TK20260903000415", name: "HC-AR-2609", holder: ["Asset Holder D", "资产方 D"],
      kind: "ar", qty: 1120, val: 1120000, ts: "valid", ps: "unpledged",
      from: "2026-09-03", to: "2027-01-01", at: "2026-09-03T08:30:00" }
  ];

  var REQUESTS = [
    { id: "S-FP-26090107", holder: ["Asset Holder A", "资产方 A"], amt: 800000, ccy: "USD",
      tenor: 90, rate: "6.40 – 7.20", st: "quoting", token: "AR-USD-2606", at: "2026-09-16T09:20:00" },
    { id: "S-FP-26090312", holder: ["Asset Holder B", "资产方 B"], amt: 520000, ccy: "EUR",
      tenor: 120, rate: "5.80 – 6.50", st: "review", token: "AR-EUR-2607", at: "2026-09-15T14:05:00" },
    { id: "S-FP-26082804", holder: ["Asset Holder C", "资产方 C"], amt: 1400000, ccy: "USD",
      tenor: 60, rate: "6.95", st: "disbursing", token: "AR-USD-2608", at: "2026-09-12T11:40:00" },
    { id: "S-FP-26081902", holder: ["Asset Holder A", "资产方 A"], amt: 460000, ccy: "USD",
      tenor: 90, rate: "7.10", st: "repaying", token: "AR-USD-2606", at: "2026-09-09T16:30:00" }
  ];

  /* 上面五条是手写样例，下面按同一形状补足到 47 / 33 条，
     只为演示每批 20 条的滚动加载，全部仍是演示数据。 */
  (function () {
    var holders = [["Asset Holder A", "资产方 A"], ["Asset Holder B", "资产方 B"],
                   ["Asset Holder C", "资产方 C"], ["Asset Holder D", "资产方 D"],
                   ["Asset Holder E", "资产方 E"], ["Asset Holder F", "资产方 F"]];
    function pad(n, w) { return ("000000" + n).slice(-w); }
    for (var i = 0; i < 42; i++) {
      var mo = (i % 9) + 1, day = (i % 26) + 2, seq = 500 + i * 7;
      var ds = "2026-" + pad(mo, 2) + "-" + pad(day, 2);
      var de = "2026-" + pad(Math.min(12, mo + 3), 2) + "-" + pad(day, 2);
      ASSETS.push({
        no: "TK2026" + pad(mo, 2) + pad(day, 2) + pad(seq, 6),
        name: "HC-AR-26" + pad(mo, 2) + "-" + pad(i + 1, 2),
        holder: holders[i % holders.length],
        kind: "ar",
        qty: 180 + (i % 17) * 95,
        val: (180 + (i % 17) * 95) * 1000,
        ts: i % 11 === 0 ? "void" : "valid",
        ps: i % 3 === 0 ? "pledged" : "unpledged",
        from: ds, to: de,
        at: ds + "T" + pad(8 + (i % 9), 2) + ":" + pad((i * 7) % 60, 2) + ":00"
      });
    }
    var sts = ["quoting", "review", "disbursing", "repaying"];
    for (var j = 0; j < 29; j++) {
      var m2 = (j % 9) + 1, d2 = (j % 25) + 3;
      var ds2 = "2026-" + pad(m2, 2) + "-" + pad(d2, 2);
      REQUESTS.push({
        id: "S-FP-26" + pad(m2, 2) + pad(d2, 2) + pad(100 + j * 3, 2),
        holder: holders[j % holders.length],
        amt: 150000 + (j % 13) * 85000,
        ccy: j % 4 === 1 ? "EUR" : "USD",
        tenor: [60, 90, 120][j % 3],
        rate: (5.4 + (j % 9) * 0.25).toFixed(2),
        st: sts[j % sts.length],
        token: ASSETS[j % ASSETS.length].name,
        at: ds2 + "T" + pad(9 + (j % 8), 2) + ":" + pad((j * 11) % 60, 2) + ":00"
      });
    }
  })();

  var AGREEMENTS = [
    { code: "AG-PLEDGE", name: ["Pledge service agreement", "质押服务协议"], ver: "V2.1",
      st: "effective", eff: "2026-08-01T00:00:00" },
    { code: "AG-FUNDER", name: ["Funder onboarding terms", "资金方入驻条款"], ver: "V1.4",
      st: "effective", eff: "2026-06-15T00:00:00" },
    { code: "AG-PRIVACY", name: ["Privacy notice", "隐私声明"], ver: "V3.0",
      st: "pending", eff: "2026-10-01T00:00:00" },
    { code: "AG-RISK", name: ["Risk disclosure", "风险揭示书"], ver: "V1.0",
      st: "archived", eff: "2025-11-01T00:00:00" }
  ];

  var ST_TAG = {
    valid: ["ok", ["Valid", "有效"]],
    void: ["", ["Void", "失效"]],
    pledged: ["accent", ["Pledged", "已质押"]],
    unpledged: ["", ["Not pledged", "未质押"]],
    quoting: ["accent", ["Receiving quotes", "报价中"]],
    review: ["warn", ["Pledge under review", "质押审核中"]],
    disbursing: ["violet", ["Disbursing", "放款中"]],
    repaying: ["ok", ["Repaying", "还款中"]],
    effective: ["ok", ["Effective", "生效中"]],
    pending: ["warn", ["Takes effect later", "待生效"]],
    archived: ["", ["Archived", "已归档"]]
  };
  function stTag(k) {
    var s = ST_TAG[k]; return tag(s[0], L(s[1][0], s[1][1]));
  }
  function nm(pair) { return L(pair[0], pair[1]); }

  /* ====================== 文案 ========================================== */
  var dict = {
    en: {
      focusSample: "Centered card", navHome: "Home", navAssets: "Asset marketplace", navPlaza: "Lending marketplace",
      navConsole: "My console", navOverview: "Overview", navAgreements: "Agreements",
      navGroupOps: "Operations"
    },
    zh: {
      focusSample: "居中卡片", navHome: "首页", navAssets: "资产广场", navPlaza: "借贷广场",
      navConsole: "我的控制台", navOverview: "总览", navAgreements: "协议管理",
      navGroupOps: "运营"
    }
  };

  /* ====================== 官网首页 ====================================== */
  /* 24×24 圆角方形首字母块；没有 logo 时不用通用占位图。 */
  function tokMark(text) {
    var ch = String(text || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
    var hue = (ch.charCodeAt(0) % 4) + 1;
    return '<span class="tok-mark" data-hue="' + hue + '" aria-hidden="true">' + esc(ch) + "</span>";
  }
  function tokCell(mark, name) {
    return '<div class="tok">' + tokMark(mark) + '<span class="tok-name">' + esc(name) + "</span></div>";
  }

  function assetMiniRow(a) {
    return '<a class="mini-row" href="#/assets">' +
      '<div class="lead-col">' + tokCell(a.name.slice(-2), a.name) +
        '<div class="sub">' + esc(nm(a.holder)) + " · " + esc(a.no) + "</div></div>" +
      '<div class="val"><span class="k">' + L("Token value", "代币价值") + '</span>' +
        '<span class="v">' + CF.fmtAmt(a.val, "USD") + "</span></div>" +
      '<div class="val"><span class="k">' + L("Pledge status", "质押状态") + '</span>' +
        '<span class="v txt">' + L(a.ps === "pledged" ? "Pledged" : "Not pledged",
                               a.ps === "pledged" ? "已质押" : "未质押") + "</span></div>" +
      '<span class="go" aria-hidden="true">&rarr;</span></a>';
  }

  function reqMiniRow(r) {
    return '<a class="mini-row" href="#/marketplace">' +
      '<div class="lead-col">' + tokCell(r.holder[0].slice(-1), r.id) +
        '<div class="sub">' + esc(nm(r.holder)) + " · " + r.tenor + L(" days", " 天") + "</div></div>" +
      '<div class="val"><span class="k">' + L("Amount", "金额") + '</span>' +
        '<span class="v">' + CF.fmtAmt(r.amt, r.ccy) + "</span></div>" +
      '<div class="val"><span class="k">' + L("Indicative rate", "参考年化") + '</span>' +
        '<span class="v">' + esc(r.rate) + " %</span></div>" +
      '<span class="go" aria-hidden="true">&rarr;</span></a>';
  }

  var STEPS = [
    [["Asset onboarding", "资产上架"], ["Tokenised receivables arrive from the issuance platform.", "已确权的应收账款由代币发行平台上架。"]],
    [["Pool and pledge", "建池与质押"], ["The holder pools an asset and pledges it against a financing request.", "资产方建池，并将其质押给一笔融资需求。"]],
    [["Credit and quote", "授信与报价"], ["Funders assess the request and submit a quote.", "资金方核定授信并提交报价。"]],
    [["Disbursement", "放款"], ["The accepted quote becomes a deal and the funder disburses.", "接受报价后成交，资金方放款。"]],
    [["Repayment", "还款"], ["Repayments run to schedule; settlement releases the pledge.", "按计划还款；结清后释放质押。"]]
  ];

  function pageHome() {
    var signedOut = S.role === "guest";
    return '<section class="site-hero"><div class="site-wrap"><div class="hero-grid"><div>' +
      '<p class="eyebrow">' + L("Cross-border receivables financing", "跨境应收账款融资") + "</p>" +
      "<h1>" + L("Tokenised receivables, financed end to end.", "已代币化的应收账款，融资全流程贯通。") + "</h1>" +
      "</div><div>" +
      '<p class="lede">' + L(
        "Browse listed assets and open financing requests without signing in. Sign in when you are ready to pledge, quote, disburse or repay.",
        "已上架资产与在招标的融资需求无需登录即可浏览。需要质押、报价、放款或还款时再登录。") + "</p>" +
      '<div class="acts">' +
      '<a class="btn primary" href="#/marketplace">' + L("Browse the lending marketplace", "浏览借贷广场") + "</a>" +
      '<a class="btn" href="#/assets">' + L("See listed assets", "查看已上架资产") + "</a>" +
      "</div></div></div></div></section>" +

      '<section class="site-band"><div class="site-wrap">' +
      '<div class="sec-head"><div>' +
      '<h2 class="sec-title">' + L("Listed assets", "已上架资产") + "</h2>" +
      '<p class="sec-note">' + L("Tokenised receivable pools available to pledge.", "可用于质押的应收账款池。") + "</p>" +
      '</div><a class="btn-link more" href="#/assets">' + L("See all", "查看全部") +
      '<span class="ar" aria-hidden="true">&rarr;</span></a></div>' +
      '<div class="mini-list">' + ASSETS.slice(0, 3).map(assetMiniRow).join("") + "</div>" +
      "</div></section>" +

      '<section class="site-band alt"><div class="site-wrap">' +
      '<div class="sec-head"><div>' +
      '<h2 class="sec-title">' + L("Open financing requests", "在招标的融资需求") + "</h2>" +
      '<p class="sec-note">' + L("Requests currently receiving or executing quotes.", "正在接受报价或执行中的融资需求。") + "</p>" +
      '</div><a class="btn-link more" href="#/marketplace">' + L("See all", "查看全部") +
      '<span class="ar" aria-hidden="true">&rarr;</span></a></div>' +
      '<div class="mini-list">' + REQUESTS.slice(0, 3).map(reqMiniRow).join("") + "</div>" +
      "</div></section>" +

      '<section class="site-band"><div class="site-wrap">' +
      '<div class="sec-head"><div><h2 class="sec-title">' + L("How a deal runs", "一笔业务怎么走") + "</h2></div></div>" +
      '<div class="site-steps">' + STEPS.map(function (s, i) {
        return '<div class="step" data-on="' + (i === 0 ? 1 : 0) + '">' +
          '<span class="sn">' + ("0" + (i + 1)) + "</span>" +
          "<h4>" + esc(nm(s[0])) + "</h4><p>" + esc(nm(s[1])) + "</p></div>";
      }).join("") + "</div></div></section>" +

      '<section class="site-band alt"><div class="site-wrap"><div class="site-paths">' +
      '<div class="path"><h3>' + L("For asset holders", "资产方") + "</h3><ul>" +
      "<li>" + L("Pool listed receivables and publish a financing request.", "用已上架的应收账款建池，发布融资需求。") + "</li>" +
      "<li>" + L("Compare quotes and accept one.", "比较报价并接受其中一个。") + "</li>" +
      "<li>" + L("Track disbursement and repayment in one place.", "在一处跟踪放款与还款。") + "</li>" +
      "</ul>" + (signedOut
        ? '<button class="btn primary" type="button" data-act="signin">' + L("Sign in", "登录") + "</button>"
        : '<a class="btn primary" href="#/console">' + L("Go to my console", "进入我的控制台") + "</a>") +
      "</div>" +
      '<div class="path"><h3>' + L("For funders", "资金方") + "</h3><ul>" +
      "<li>" + L("Review open requests and the pledged asset behind each one.", "查看在招标的需求与其背后的质押资产。") + "</li>" +
      "<li>" + L("Submit a quote with your rate and tenor.", "按你的利率与期限提交报价。") + "</li>" +
      "<li>" + L("Disburse and confirm repayments.", "放款并确认还款。") + "</li>" +
      "</ul>" + (signedOut
        ? '<button class="btn" type="button" data-act="toast" data-v="apply">' + L("Apply to join", "申请入驻") + "</button>"
        : '<a class="btn" href="#/marketplace">' + L("Find a request", "寻找需求") + "</a>") +
      "</div></div></div></section>";
  }

  /* ====================== 资产广场 ====================================== */
  /* 列集与头部汇总取《资产广场 · 已上架代币只读域》PRD 的 L-AM-01～L-AM-10 与 F-AM-02。
     本页是列表形态的 shell 母版，完整字段校验与验收归 WS-350。 */
  function sortTh(key, label) {
    var cur = S.sort === key;
    var dir = cur ? S.sortDir : null;
    var aria = cur ? (dir === "asc" ? "ascending" : "descending") : "none";
    return '<th class="sortable" aria-sort="' + aria + '" scope="col">' +
      '<button type="button" data-act="sort" data-v="' + key + '">' + esc(label) +
      '<span class="ar" aria-hidden="true">' + (dir === "asc" ? "\u2191" : "\u2193") + "</span></button></th>";
  }

  function sortedAssets() {
    var list = ASSETS.slice();
    var key = S.sort || "at", dir = S.sortDir === "asc" ? 1 : -1;
    list.sort(function (a, b) {
      var x = key === "val" ? a.val : (key === "to" ? a.to : a.at);
      var y = key === "val" ? b.val : (key === "to" ? b.to : b.at);
      return x > y ? dir : (x < y ? -dir : 0);
    });
    return list;
  }

  function assetRow(a) {
    return "<tr>" +
      '<td data-label="' + L("Token", "代币") + '">' + tokCell(a.name.slice(-2), a.name) + "</td>" +
      '<td data-label="' + L("Token number", "代币编号") + '"><div class="cell-wrap">' +
        '<span class="mono nw">' + esc(a.no) + "</span>" +
        CF.copyBtn("copy", a.no, L("Copy token number", "复制代币编号")) + "</div></td>" +
      '<td data-label="' + L("Asset holder", "资产方企业") + '">' + esc(nm(a.holder)) + "</td>" +
      '<td data-label="' + L("Token type", "代币类型") + '">' + L("Receivables", "应收账款类") + "</td>" +
      '<td data-label="' + L("Token quantity", "代币数量") + '" class="num">' + a.qty.toFixed(2) + "</td>" +
      '<td data-label="' + L("Token value", "代币价值") + '" class="num nw">' + CF.fmtAmt(a.val, "USD") + "</td>" +
      '<td data-label="' + L("Token status", "代币状态") + '">' + stTag(a.ts) + "</td>" +
      '<td data-label="' + L("Pledge status", "质押状态") + '">' + stTag(a.ps) + "</td>" +
      '<td data-label="' + L("Receivable term", "底层应收账款账期") + '" class="tiny nw">' +
        esc(a.from) + " \u2013 " + esc(a.to) + "</td>" +
      '<td data-label="' + L("Minted at", "铸造时间") + '" class="tiny">' + CF.fmtTime(a.at) + "</td>" +
      "</tr>";
  }

  function pageAssets() {
    var alt = CF.surface({
      skelRows: 5,
      emptyTitle: L("No tokens synced yet", "暂无已同步代币"),
      emptyDesc: L("Tokens appear here once the issuance platform lists them.", "代币发行平台上架后，代币会出现在这里。")
    });
    var shown = S.st === "empty" || S.st === "noresult" ? [] : ASSETS;
    var total = shown.length;
    var value = shown.reduce(function (n, a) { return n + a.val; }, 0);
    var voidCount = shown.filter(function (a) { return a.ts === "void"; }).length;

    var head = '<div class="page-head"><div>' +
      '<h1 class="page-title">' + L("Asset marketplace", "资产广场") + "</h1>" +
      '<p class="page-desc">' + L(
        "Tokens synced from the issuance platform. Read-only, open to everyone.",
        "由代币发行平台同步过来的代币，只读，对所有人开放。") + "</p></div></div>";

    /* 头部汇总三项；空态显示 0 不隐藏整块。 */
    var summary = '<div class="stat-row">' +
      '<div class="stat"><div class="k">' + L("Tokens", "代币数量") + '</div><div class="v">' +
        total + '</div><div class="n">' + L("issued tokens", "张") + "</div></div>" +
      '<div class="stat"><div class="k">' + L("Token value", "代币价值") + '</div><div class="v">' +
        CF.fmtAmt(value, "USD") + "</div></div>" +
      '<div class="stat"><div class="k">' + L("Of which void", "其中失效") + '</div><div class="v">' +
        voidCount + '</div><div class="n">' + L("issued tokens", "张") + "</div></div>" +
      '</div><p class="sum-note">' +
      L("Converted at each issuance-time FX rate.", "按各笔签发时汇率折算。") + "</p>";

    var filters = '<div class="filterbar">' +
      CF.filterSelect("a-ts", L("Token status", "代币状态"),
        [["", L("All", "全部")], ["valid", L("Valid", "有效")], ["void", L("Void", "失效")]], "", "") +
      CF.filterSelect("a-ps", L("Pledge status", "质押状态"),
        [["", L("All", "全部")], ["pledged", L("Pledged", "已质押")], ["unpledged", L("Not pledged", "未质押")]], "", "") +
      CF.filterSelect("a-kind", L("Token type", "代币类型"),
        [["", L("All", "全部")], ["ar", L("Receivables", "应收账款类")]], "", "") +
      CF.filterSelect("a-holder", L("Asset holder", "资产方企业"),
        [["", L("All", "全部")], ["a", L("Asset Holder A", "资产方 A")], ["b", L("Asset Holder B", "资产方 B")]], "", "") +
      CF.filterSearch("a-kw", L("Token number, holder or minting hash", "代币编号、资产方企业名或铸造交易哈希"), "") +
      '<div class="fb-acts"><button class="btn" type="button" data-act="clearfilter">' + L("Reset", "重置") + "</button>" +
      '<button class="btn primary" type="button" data-act="clearfilter">' + L("Search", "查询") + "</button></div>" +
      "</div>";

    var table = '<div class="tablewrap listbox listbox-contained"><table class="tbl resp"><thead><tr>' +
      "<th>" + L("Token", "代币") + "</th><th>" + L("Token number", "代币编号") + "</th>" +
      "<th>" + L("Asset holder", "资产方企业") + "</th><th>" + L("Token type", "代币类型") + "</th>" +
      "<th>" + L("Token quantity", "代币数量") + "</th>" +
      sortTh("val", L("Token value", "代币价值")) +
      "<th>" + L("Token status", "代币状态") + "</th><th>" + L("Pledge status", "质押状态") + "</th>" +
      sortTh("to", L("Receivable term", "底层应收账款账期")) +
      sortTh("at", L("Minted at", "铸造时间")) +
      "</tr></thead><tbody>" +
      sortedAssets().slice(0, S.shown).map(assetRow).join("") +
      "</tbody></table>" + CF.moreFoot(total) + "</div>";

    return head + summary + '<div style="height:var(--sp-6)"></div>' +
      '<div class="card">' + filters + (alt || table) + "</div>";
  }

  /* ====================== 借贷广场 ====================================== */
  function reqRow(r) {
    var guest = S.role === "guest";
    var canQuote = !guest && S.role === "fund" && r.st === "quoting";
    var quoteAttrs = canQuote
      ? ' data-act="quote" data-v="' + esc(r.id) + '"'
      : ' class="actlink off" aria-disabled="true" title="' + esc(guest
          ? L("Sign in to submit a quote.", "登录后可提交报价。")
          : L("Quoting is limited to funder accounts on requests that are receiving quotes.", "仅资金方账号可对报价中的需求提交报价。")) + '"';
    return "<tr>" +
      '<td data-label="' + L("Request", "需求") + '"><div class="tok">' + tokMark(r.holder[0].slice(-1)) +
        '<div class="cell-wrap"><div class="cell-main mono nw">' + esc(r.id) + "</div>" +
        '<div class="cell-sub">' + esc(nm(r.holder)) + "</div></div></div></td>" +
      '<td data-label="' + L("Amount", "金额") + '" class="num">' + CF.fmtAmt(r.amt, r.ccy) + "</td>" +
      '<td data-label="' + L("Tenor", "期限") + '">' + r.tenor + L(" days", " 天") + "</td>" +
      '<td data-label="' + L("Rate", "年化") + '" class="num">' + esc(r.rate) + " %</td>" +
      '<td data-label="' + L("Pledged token", "质押代币") + '"><span class="hash">' + esc(r.token) + "</span></td>" +
      '<td data-label="' + L("Status", "状态") + '">' + stTag(r.st) + "</td>" +
      '<td data-label="' + L("Updated", "更新") + '" class="tiny">' + CF.fmtTime(r.at) + "</td>" +
      '<td class="col-act">' +
        '<a class="actlink" href="#/marketplace" data-act="detail" data-v="' + esc(r.id) + '">' + L("View", "查看") + "</a>" +
        (canQuote
          ? '<a class="actlink"' + quoteAttrs + ">" + L("Quote", "报价") + "</a>"
          : "<span" + quoteAttrs + ">" + L("Quote", "报价") + "</span>") +
      "</td></tr>";
  }

  function sortedRequests() {
    var list = REQUESTS.slice();
    var key = S.sort === "amt" ? "amt" : "at", dir = S.sortDir === "asc" ? 1 : -1;
    list.sort(function (a, b) { return a[key] > b[key] ? dir : (a[key] < b[key] ? -dir : 0); });
    return list;
  }

  /* ====================== 管理端：总览 ================================== */
  function pageOverview() {
    var alt = CF.surface({
      skelRows: 4,
      emptyTitle: L("Nothing waiting on you", "暂无待办"),
      emptyDesc: L("Submitted reviews appear here.", "提交上来的审核会出现在这里。")
    });
    var rows = REQUESTS.slice(0, 3).map(function (r) {
      return "<tr>" +
        '<td data-label="' + L("Request", "需求") + '"><div class="cell-wrap">' +
          '<span class="mono cell-main">' + esc(r.id) + "</span>" +
          '<div class="cell-sub">' + esc(nm(r.holder)) + "</div></div></td>" +
        '<td data-label="' + L("Amount", "金额") + '" class="num">' + CF.fmtAmt(r.amt, r.ccy) + "</td>" +
        '<td data-label="' + L("Status", "状态") + '">' + stTag(r.st) + "</td>" +
        '<td data-label="' + L("Updated", "更新") + '" class="tiny">' + CF.fmtTime(r.at) + "</td>" +
        "</tr>";
    }).join("");
    return '<div class="page-head"><div><h1 class="page-title">' + L("Overview", "总览") + "</h1>" +
      '<p class="page-desc">' + L("Operations workload across the lending platform.", "借贷平台运营侧的工作量概览。") +
      "</p></div></div>" +
      '<div class="stat-row" style="margin-bottom:var(--sp-6)">' +
      '<div class="stat"><div class="k">' + L("Pledge reviews pending", "待审核质押") + '</div><div class="v">3</div></div>' +
      '<div class="stat"><div class="k">' + L("Funder applications", "资金方入驻申请") + '</div><div class="v">2</div></div>' +
      '<div class="stat"><div class="k">' + L("Agreements effective", "生效中的协议") + '</div><div class="v">2</div></div>' +
      "</div>" +
      '<div class="card"><div class="card-head">' + L("Recent financing activity", "最近的融资动态") + "</div>" +
      (alt || '<div class="tablewrap"><table class="tbl"><thead><tr><th>' + L("Request", "需求") +
        "</th><th>" + L("Amount", "金额") + "</th><th>" + L("Status", "状态") + "</th><th>" +
        L("Updated", "更新") + "</th></tr></thead><tbody>" + rows + "</tbody></table></div>") +
      "</div>";
  }

  /* ====================== 管理端：协议管理 ============================== */
  function pageAgreements() {
    var alt = CF.surface({
      skelRows: 4,
      emptyTitle: L("No agreements yet", "暂无协议"),
      emptyDesc: L("Published agreement versions appear here.", "发布后的协议版本会出现在这里。")
    });
    var rows = AGREEMENTS.map(function (a) {
      return "<tr>" +
        '<td data-label="' + L("Code", "编码") + '"><span class="mono cell-main">' + esc(a.code) + "</span></td>" +
        '<td data-label="' + L("Agreement", "协议") + '">' + esc(nm(a.name)) + "</td>" +
        '<td data-label="' + L("Version", "版本") + '" class="num">' + esc(a.ver) + "</td>" +
        '<td data-label="' + L("Status", "状态") + '">' + stTag(a.st) + "</td>" +
        '<td data-label="' + L("Takes effect", "生效时间") + '" class="tiny">' + CF.fmtTime(a.eff) + "</td>" +
        '<td class="col-act"><a class="actlink" href="#/ops/agreements" data-act="agdetail" data-v="' +
          esc(a.code) + '">' + L("Details", "详情") + "</a>" +
        (a.st === "archived"
          ? '<span class="actlink off" aria-disabled="true" title="' +
            esc(L("Archived versions cannot be edited.", "已归档版本不可编辑。")) + '">' + L("Edit", "编辑") + "</span>"
          : '<a class="actlink" href="#/ops/agreements" data-act="toast" data-v="edit">' + L("Edit", "编辑") + "</a>") +
        "</td></tr>";
    }).join("");
    return '<div class="page-head"><div><h1 class="page-title">' + L("Agreements", "协议管理") + "</h1>" +
      '<p class="page-desc">' + L("Agreement versions shown to platform users.", "面向平台用户展示的协议版本。") +
      '</p></div><div class="page-actions">' +
      '<button class="btn primary" type="button" data-act="toast" data-v="newver">' +
      L("New version", "新建版本") + "</button></div></div>" +
      '<div class="card"><div class="filterbar">' +
      CF.filterSelect("a-st", L("Status", "状态"),
        [["", L("All", "全部")], ["effective", L("Effective", "生效中")], ["later", L("Takes effect later", "待生效")], ["archived", L("Archived", "已归档")]], "", "") +
      CF.filterSearch("a-kw", L("Code or name", "编码或名称"), "") +
      '<div class="fb-acts"><button class="btn" type="button" data-act="clearfilter">' + L("Reset", "重置") + "</button></div>" +
      "</div>" +
      (alt || '<div class="tablewrap"><table class="tbl"><thead><tr><th>' + L("Code", "编码") +
        "</th><th>" + L("Agreement", "协议") + "</th><th>" + L("Version", "版本") + "</th><th>" +
        L("Status", "状态") + "</th><th>" + L("Takes effect", "生效时间") + '</th><th class="col-act">' +
        L("Actions", "操作") + "</th></tr></thead><tbody>" + rows + "</tbody></table></div>") +
      "</div>";
  }

  /* ====================== 抽屉 ========================================== */
  var layers = {
    agDetail: function (code) {
      var a = AGREEMENTS.filter(function (x) { return x.code === code; })[0];
      if (!a) return null;
      return {
        title: nm(a.name) + " · " + a.ver,
        html: '<div style="margin-bottom:var(--sp-5)">' + stTag(a.st) + "</div>" +
          '<dl class="dl">' +
          "<dt>" + L("Code", "编码") + '</dt><dd class="mono">' + esc(a.code) + "</dd>" +
          "<dt>" + L("Version", "版本") + '</dt><dd class="num">' + esc(a.ver) + "</dd>" +
          "<dt>" + L("Takes effect", "生效时间") + "</dt><dd>" + CF.fmtTime(a.eff) + "</dd>" +
          "</dl>",
        foot: '<button class="btn" type="button" data-act="closelayer">' + L("Close", "关闭") + "</button>"
      };
    }
  };

  /* ====================== 页脚（Ft1） =================================== */
  function renderFoot() {
    var el = document.getElementById("foot");
    if (!el) return;
    el.innerHTML = '<div class="ft-in">' +
      '<p class="ft-mark">Harbour Credit</p>' +
      '<p class="ft-tag">' + L(
        "Cross-border receivables financing on tokenised assets.",
        "基于代币化资产的跨境应收账款融资。") + "</p>" +
      '<nav class="ft-links" aria-label="' + L("Footer", "页脚") + '">' +
      '<a href="#/" data-act="toast" data-v="terms">' + L("Terms", "服务协议") + "</a>" +
      '<a href="#/" data-act="toast" data-v="privacy">' + L("Privacy", "隐私声明") + "</a>" +
      '<a href="#/" data-act="toast" data-v="risk">' + L("Risk disclosure", "风险揭示") + "</a>" +
      '<a href="#/" data-act="toast" data-v="contact">' + L("Contact", "联系我们") + "</a>" +
      "</nav>" +
      '<div class="ft-meta"><span>' + L("Prototype baseline", "原型底座样板") + "</span>" +
      "<span>" + L("Demonstration data — not real companies, amounts or rates",
                   "演示数据 —— 非真实企业、金额或利率") + "</span>" +
      "<span>" + L("Times shown in", "时间时区") + " " + esc(S.tz || "UTC") + "</span></div></div>";
  }

  /* ====================== 模块接入 ====================================== */
  var relations = CF.makeRelationSample(REQUESTS, ASSETS);
  // 样板不展示尚未组合装载的业务入口，避免裸文案键与空页面。
  CF.NAV.admin = (CF.NAV.admin || []).filter(function(id) { return id === "P-O06" || id === "P-O-AG-01"; });
  Object.assign(dict.en, relations.dict.en); Object.assign(dict.zh, relations.dict.zh);
  Object.assign(layers, relations.layers);
  var PAGE_FN = {
    "P-F51": pageHome, "P-F-AM-01": pageAssets,
    "P-O06": pageOverview, "P-O-AG-01": pageAgreements
  };

  CF.renderFooter = renderFoot;

  ['P-F-AM-01','P-LS-01','P-MC-01','P-O06','P-O-AG-01','DEMO-FOCUS','SAMPLE-PROJECT','SAMPLE-RECORD','SAMPLE-TOKEN'].forEach(id=>CF.review.register(id,{
    group:CF.PAGES[id].end==='admin'?['Operations samples','管理端样板']:['Customer samples','面客端样板'],
    route:()=>relations.reviewRoute(id),
    states:['DEMO-FOCUS','SAMPLE-TOKEN'].includes(id)?['default']:['SAMPLE-PROJECT','SAMPLE-RECORD'].includes(id)?['default','loading','empty','error','denied']:['default','loading','empty','noresult','error','denied']
  }));

  CF.define({
    id: "lending-baseline",
    dict: dict,
    layers: layers,
    breadcrumbRoute: relations.breadcrumb,
    content: function (page) {
      renderFoot();
      var related = relations.content(page);
      if (related !== null) return related;
      if (page === "DEMO-FOCUS") return '<h1 class="page-title">' + L('Centered card', '居中卡片') + '</h1><p class="page-desc">' + L('A focused task with lightweight tools.', '聚焦单一任务，保留轻量工具。') + '</p><p><a class="btn" href="#/">' + L('Back to sample', '返回样板') + '</a></p>';
      var fn = PAGE_FN[page];
      return fn ? fn() : "";
    },
    onAct: function (act, v) {
      if (relations.action(act, v)) return true;
      if (act === "detail") { return relations.action("sample-request", v); }
      if (act === "agdetail") { CF.openLayer("drawer", "agDetail", v); return true; }
      if (act === "sort") {
        if (S.sort === v) { S.sortDir = S.sortDir === "asc" ? "desc" : "asc"; }
        else { S.sort = v; S.sortDir = "desc"; }
        CF.resetList();
        return true;
      }
      if (act === "copy") {
        try {
          if (navigator.clipboard) navigator.clipboard.writeText(v);
          CF.toast(L("Token number copied.", "代币编号已复制。"));
        } catch (e) {
          CF.toast(L("Copy is unavailable here — select the number to copy it.",
                     "此处无法自动复制，请手动选中编号。"));
        }
        return true;
      }
      if (act === "quote") { return relations.action("sample-request", v); }
      return false;
    }
  });

  if (!CF.deferBoot) CF.boot();
})(window.CF);
