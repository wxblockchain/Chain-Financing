/* ==========================================================================
   asset-detail.js — 可信资产详情（演示数据），供面客端与管理端复用
   按交易双方分两组：核心信息（应收账款与交易双方、销售合同 / 订单、货物交付、
   销售发票、回款进度）与补充信息（与上游供应商、债务人与其下游客户）；材料随所属环节展示。
   三个资产状态由各画面的摘要卡展示，这里不重复；字段与分级以 M2 PRD 为准。
   用法：<div class="asset-detail" data-asset-detail="资产编号"></div>，在 TP.boot 之前调用 TP.fillAssetDetail()。
   ========================================================================== */
(function(TP){
  'use strict';
  var FILE_TOAST = '演示文件，不提供真实文件。';

  function fileRef(name){
    return '<span class="file-ref"><i data-ico="doc"></i><button type="button" class="btn-link file-name" data-toast="'+FILE_TOAST+'">'+name+'</button>'+
      '<button type="button" class="btn icon" data-toast="'+FILE_TOAST+'" aria-label="下载" title="下载"><i data-ico="download"></i></button></span>';
  }
  function day(iso){ return '<time data-day data-instant="'+iso+'" datetime="'+iso+'"></time>'; }
  function money(v, ccy){ return '<span class="money"><span class="mono">'+v+'</span><span class="ccy">'+ccy+'</span></span>'; }
  /* 超过两位小数的金额：主显示截断到两位，旁边 .value-pop 图标查看完整值（PRD M2 两位小数截断展示）。 */
  function moneyFull(v, full, ccy){
    return money(v, ccy)+(full ? '<span class="dd value-pop"><button type="button" class="btn icon dd-btn" aria-expanded="false" aria-label="查看完整值" title="查看完整值"><i data-ico="chev"></i></button><span class="dd-list" hidden><span class="mono">'+full+' '+ccy+'</span></span></span>' : '');
  }
  function upstream(v){ return '<span data-upstream>'+v+'</span>'; }
  function mono(v){ return '<span class="mono">'+v+'</span>'; }
  /* L1 缺失说明上游未提供；L2 缺失弱化为未提供。 */
  function missing(l1){ return l1 ? '<span class="missing">上游未提供</span>' : '<span class="missing soft">未提供</span>'; }
  function facts(rows, columns){
    return '<div class="facts-region"><dl class="facts'+(columns===3?' cols-3':columns===2?' cols-2':'')+'">'+rows.map(function(r){ return '<div'+(r[2]?' class="wide"':'')+'><dt>'+r[0]+'</dt><dd>'+r[1]+'</dd></div>'; }).join('')+'</dl></div>';
  }
  function table(cols, rows){
    return '<div class="tablewrap detail-table"><table class="tbl auto"><thead><tr>'+cols.map(function(c){ return c.charAt(0)==='#' ? '<th class="num">'+c.slice(1)+'</th>' : '<th>'+c+'</th>'; }).join('')+'</tr></thead><tbody>'+
      rows.map(function(r){ return '<tr>'+r.map(function(v,i){ return '<td'+(cols[i].charAt(0)==='#'?' class="num"':'')+'>'+v+'</td>'; }).join('')+'</tr>'; }).join('')+'</tbody></table></div>';
  }
  function subHead(title, sub){ return '<div class="sub-h">'+title+(sub?'<span class="sub">'+sub+'</span>':'')+'</div>'; }
  function sec(inner){ return '<div class="card-sec">'+inner+'</div>'; }
  function empty(text){ return '<p class="sub-empty">'+text+'</p>'; }
  function card(title, nav, sub, inner){
    return '<div class="card" data-nav-label="'+nav+'"><div class="card-head"><h3>'+title+'</h3>'+(sub?'<span class="sub">'+sub+'</span>':'')+'</div>'+inner+'</div>';
  }
  function group(title, sub, cards){
    return '<div class="detail-group"><div class="detail-group-h"><h2>'+title+'</h2><span class="sub">'+sub+'</span></div>'+cards+'</div>';
  }

  /* 到期日由上游连同来源时区提供；到期时点为来源时区下到期日当天 24:00（即次日 00:00），
     按查看者时区换算后展示日期、时间和时区。演示资产的来源时区均为 Asia/Dubai。 */
  var SOURCE_ZONE={name:'Asia/Dubai', offset:'+04:00'};
  function dueInstant(dayIso){ return new Date(new Date(dayIso+'T00:00:00'+SOURCE_ZONE.offset).getTime()+86400000).toISOString(); }
  function dueTime(dayIso){ var t=dueInstant(dayIso); return '<time data-minute data-instant="'+t+'" datetime="'+t+'"></time> <span class="faint" data-zone></span>'; }

  /* 演示资产：rich 为补充信息完整的示例；sparse 为 L1 缺项、L2 与补充信息均缺失的示例；其余为一张发票、暂无回款、无债务人下游客户交易。 */
  var PARTY = {
    A:{name:'示例企业 A 有限公司', en:'Example Enterprise A Ltd.', region:'中国香港', id:'DEMO-1234567', kind:'CR'},
    C:{name:'Demo Trading C Pte. Ltd.', region:'新加坡', id:'DEMO-UEN-202600123', kind:'UEN'},
    B:{name:'Demo Buyer B LLC', en:'Demo Buyer B Limited Liability Company', region:'阿联酋', id:'DEMO-TL-889012', kind:'Trade License'},
    M:{name:'Demo Motors Trading FZE', region:'阿联酋', id:'DEMO-FZE-55120', kind:'Trade License'},
    E:{name:'Demo Retail E LLC', region:'阿联酋', id:'DEMO-TL-730045', kind:'Trade License'}
  };
  var ASSETS = {
    'RA-DEMO-0128':{cr:'A', db:'B', amt:'50,000.00', due:'2027-03-31', no:'0412', rich:true, repaid:'50,000.00', balance:'0.00'},
    'RA-DEMO-0131':{cr:'A', db:'M', amt:'82,400.00', due:'2027-05-15', no:'0436', repaid:'82,400.00', balance:'0.00'},
    'RA-DEMO-0102':{cr:'A', db:'B', amt:'36,000.00', due:'2027-01-31', no:'0371'},
    'RA-DEMO-0097':{cr:'A', db:'M', amt:'24,800.00', due:'2027-02-28', no:'0359'},
    'RA-DEMO-0115':{cr:'A', db:'B', amt:'18,600.00', due:'2026-10-15', no:'0233', sparse:true,
      formed:'2026-07-01T10:00:00+04:00', invoiced:'2026-06-28T11:00:00+04:00'},
    'RA-DEMO-0140':{cr:'A', db:'M', amt:'40,000.00', ccy:'EUR', due:'2027-06-30', no:'0460'},
    'RA-DEMO-0143':{cr:'A', db:'B', amt:'27,500.00', due:'2027-04-30', no:'0463'},
    'RA-DEMO-0150':{cr:'C', db:'E', amt:'61,200.00', due:'2027-06-20', no:'0502'},
    'RA-DEMO-0160':{cr:'A', db:'B', amt:'12,345.67', full:'12,345.675', due:'2027-04-30', no:'0510'},
    'RA-DEMO-0166':{cr:'A', db:'E', amt:'45,200.00', due:'2027-05-31', no:'0518'},
    'RA-DEMO-0171':{cr:'A', db:'M', amt:'63,750.50', due:'2027-07-15', no:'0526'},
    'RA-DEMO-0174':{cr:'A', db:'E', amt:'30,000.00', due:'2027-06-30', no:'0530'}
  };
  // 0128 / 0131 为静态演示：已回款等于原始资产价值、余额为零，上游仍未结清。
  // 不据此计算或改变任何状态；M2 仅运营画面另行呈现非阻断预警。
  /* 债务人与其下游客户的交易（演示）：本企业不是交易一方；一笔部分回款，一笔暂无回款。 */
  var DEBTOR_BUYERS = [
    {name:'Demo Auto Retail G LLC', region:'阿联酋', so:'SO-DEMO-B-2026-0815', ordered:'2026-08-20T10:00:00+04:00', amt:'32,000.00',
      delivered:'2026-09-20T15:00:00+04:00', pod:'POD-DEMO-B-0815.pdf',
      repay:[['2026-10-05T11:00:00+04:00','10,000.00','TXN-DEMO-B0815-1'],['2026-10-25T11:00:00+04:00','10,000.00','TXN-DEMO-B0815-2']]},
    {name:'Demo Auto Hub F Co.', region:'沙特阿拉伯', so:'SO-DEMO-B-2026-0905', ordered:'2026-09-05T10:00:00+03:00', amt:'28,800.00',
      delivered:'2026-10-10T14:00:00+03:00', pod:'POD-DEMO-B-0905.pdf', repay:[]}
  ];

  function party(title, x){
    return '<section class="party-panel"><h4 class="sub-h">'+title+'</h4>'+facts([
      ['企业名称', upstream(x.name), true],
      ['企业英文名称', x.en ? upstream(x.en) : missing(), true],
      ['注册国家 / 地区', upstream(x.region)],
      ['企业登记标识', mono(x.id)+' <span class="faint">'+x.kind+'</span>']
    ],2)+'</section>';
  }

  function core(id, a, ccy){
    var so='SO-DEMO-2026-'+a.no, si='SI-DEMO-'+a.no, sp=a.sparse;
    var receivable = card('应收账款与交易双方','交易双方','',
      facts([
        ['资产编号', '<span class="mono">'+id+'</span>'],
        ['资产类型', upstream('应收账款')],
        ['行业大类', upstream('汽车贸易')],
        ['原始资产价值', moneyFull(a.amt,a.full,ccy)],
        ['币种', TP.currencyLabel(ccy)],
        ['形成日期', day(a.formed||'2026-09-18T10:00:00+04:00')],
        ['到期日', dueTime(a.due)],
        ['原始到期日', mono(a.due)+' <span class="faint">'+SOURCE_ZONE.name+'</span>'],
        ['确权日期', sp ? missing(true) : day('2026-09-25T14:20:00+04:00')],
        ['确权凭证', sp ? missing(true) : fileRef('CC-'+id+'.pdf'), true]
      ],3) + '<div class="party-grid">'+party('债权人', PARTY[a.cr]) + party('债务人', PARTY[a.db])+'</div>');

    var goods = sp ? sec(subHead('标的物明细')+empty('未提供')) :
      sec(subHead('标的物明细','2 项')+table(['名称','型号规格','#数量','唯一识别码'],[
        ['Demo Auto SUV','DM-X5 2026','1',mono('LDEMO0X5'+a.no+'00001')],
        ['Demo Auto SUV','DM-X5 2026','1',mono('LDEMO0X5'+a.no+'00002')]
      ]));
    var order = card('销售合同 / 订单','销售订单','',
      facts([
        ['销售合同 / 订单编号', mono(so)],
        ['订单日期', sp ? missing() : day('2026-06-02T09:00:00+04:00')],
        ['订单金额', sp ? missing() : moneyFull(a.amt,a.full,ccy)],
        ['销售合同 / 订单文件', sp ? missing() : fileRef(so+'.pdf')]
      ]) + goods);

    var delivery = card('货物交付','货物交付','',
      facts(sp ? [['交付地点',missing(),true],['交付日期',missing()],['运输单据编号',missing()],['运输单据',missing()],['交付凭证',missing()]] : [
        ['交付地点', upstream('Jebel Ali Free Zone, Demo Warehouse W-12'), true],
        ['交付日期', day('2026-09-12T16:00:00+04:00')],
        ['运输单据编号', mono('BL-DEMO-'+a.no)],
        ['运输单据', fileRef('BL-DEMO-'+a.no+'.pdf')],
        ['交付凭证', fileRef('POD-DEMO-'+a.no+'.pdf')]
      ]));

    var invRows = a.rich ?
      [[mono(si+'-01'), day('2026-09-15T11:00:00+04:00'), money('30,000.00','USD'), fileRef(si+'-01.pdf')],
       [mono(si+'-02'), day('2026-09-15T11:05:00+04:00'), money('20,000.00','USD'), fileRef(si+'-02.pdf')]] :
      [[mono(si+'-01'), day(a.invoiced||'2026-09-15T11:00:00+04:00'), moneyFull(a.amt,a.full,ccy), fileRef(si+'-01.pdf')]];
    var invoice = card('销售发票','销售发票', a.rich?'2 张':'1 张',
      table(['销售发票编号','开具日期','#金额','发票文件'], invRows));

    var repayFacts = facts([
      ['累计已回款', money(a.repaid||(a.rich?'20,000.00':'0.00'), ccy)],
      ['未回款余额', a.balance||a.rich ? money(a.balance||'30,000.00', ccy) : moneyFull(a.amt, a.full, ccy)],
      ['结清日期', '<span class="faint">—</span>']
    ],3);
    var repayRecords = (a.rich || a.repaid) ?
      subHead('回款记录','1 条')+table(['回款日期','#回款金额','回款流水号','支付凭证编号','支付凭证'],[
        [day('2026-10-20T15:30:00+04:00'), money(a.repaid||'20,000.00',ccy), mono('TXN-DEMO-50021'), mono('PV-DEMO-50021'), fileRef('PV-DEMO-50021.pdf')]
      ]) :
      subHead('回款记录')+empty('暂无回款记录');
    var repay = card('回款进度','回款进度','债务人对本笔应收账款的回款', repayFacts+repayRecords);

    return group('核心信息','债权人与债务人', receivable+order+delivery+invoice+repay);
  }

  function supplement(a){
    var supplier, buyers;
    if(a.sparse){
      supplier = card('与上游供应商','上游供应商','',
        sec(subHead('采购合同 / 订单')+empty('暂无采购合同 / 订单信息'))+
        sec(subHead('供应商发货')+empty('暂无发货记录'))+
        sec(subHead('采购发票')+empty('暂无采购发票'))+
        sec(subHead('向供应商付款')+empty('暂无付款记录')));
    }else{
      var po='PO-DEMO-2026-'+a.no, pi='PI-DEMO-'+a.no;
      var piRows = a.rich ?
        [[mono(pi+'-01'), day('2026-07-22T10:00:00+08:00'), money('30,000.00','USD'), fileRef(pi+'-01.pdf')],
         [mono(pi+'-02'), day('2026-07-22T10:10:00+08:00'), money('16,500.00','USD'), fileRef(pi+'-02.pdf')]] :
        [[mono(pi+'-01'), day('2026-08-28T10:00:00+08:00'), money('46,500.00','USD'), fileRef(pi+'-01.pdf')]];
      var payRows = a.rich ?
        [[day('2026-06-15T10:00:00+08:00'), money('13,950.00','USD'), mono('TXN-DEMO-P'+a.no+'-1'), fileRef('PV-DEMO-P'+a.no+'-1.pdf')],
         [day('2026-07-25T10:00:00+08:00'), money('32,550.00','USD'), mono('TXN-DEMO-P'+a.no+'-2'), fileRef('PV-DEMO-P'+a.no+'-2.pdf')]] :
        [[day('2026-09-01T10:00:00+08:00'), money('46,500.00','USD'), mono('TXN-DEMO-P'+a.no+'-1'), fileRef('PV-DEMO-P'+a.no+'-1.pdf')]];
      supplier = card('与上游供应商','上游供应商','Demo Auto Manufacturing Co.',
        sec(subHead('采购合同 / 订单')+facts([
          ['采购合同 / 订单编号', mono(po)],
          ['供应商名称', 'Demo Auto Manufacturing Co.'],
          ['采购日期', day('2026-06-10T09:00:00+08:00')],
          ['采购金额', money('46,500.00','USD')],
          ['采购合同 / 订单文件', fileRef(po+'.pdf')]
        ]))+
        sec(subHead('供应商发货')+facts([
          ['发货日期', day('2026-07-20T10:00:00+08:00')],
          ['发货记录', fileRef('SR-DEMO-'+a.no+'.pdf')]
        ]))+
        sec(subHead('采购发票', a.rich?'2 张':'1 张')+table(['采购发票编号','开具日期','#金额','发票文件'], piRows))+
        sec(subHead('向供应商付款', a.rich?'2 条':'1 条')+table(['付款日期','#付款金额','付款流水号','付款凭证'], payRows)));
    }
    if(a.rich){
      buyers = card('债务人与其下游客户','债务人下游客户','2 笔交易 · 回款不计入本笔应收账款',
        DEBTOR_BUYERS.map(function(t){
          return sec(subHead(upstream(t.name), upstream(t.region))+facts([
            ['销售合同 / 订单编号', mono(t.so)],
            ['订单日期', day(t.ordered)],
            ['订单金额', money(t.amt,'USD')],
            ['销售合同 / 订单文件', fileRef(t.so+'.pdf')],
            ['交付日期', day(t.delivered)],
            ['交付凭证', fileRef(t.pod)]
          ])+(t.repay.length ?
            subHead('回款记录', t.repay.length+' 条')+table(['回款日期','#回款金额','回款流水号','支付凭证'], t.repay.map(function(r){
              return [day(r[0]), money(r[1],'USD'), mono(r[2]), fileRef('PV-'+r[2].slice(4)+'.pdf')];
            })) :
            subHead('回款记录')+empty('暂无回款记录')));
        }).join(''));
    }else{
      buyers = card('债务人与其下游客户','债务人下游客户','', sec(empty('暂无债务人下游客户交易信息')));
    }
    return group('补充信息','债权人与上游供应商，债务人与其下游客户', supplier+buyers);
  }

  function body(id){
    var a = ASSETS[id], ccy = a.ccy||'USD';
    return core(id, a, ccy) + supplement(a);
  }

  TP.fillAssetDetail = function(){
    document.querySelectorAll('[data-asset-detail]').forEach(function(el){ el.innerHTML = body(el.dataset.assetDetail); });
    // Summary and embedded asset-reference screens share the same fiat identity.
    document.querySelectorAll('.asset-sum .amount-lg').forEach(function(el){
      var ccy=el.querySelector('.ccy');
      if(ccy && !el.querySelector('.asset-icon,[data-asset]'))el.insertAdjacentHTML('afterbegin',TP.assetIcon(ccy.textContent.trim()));
    });
    initDetailNavigation();
  };

  function initDetailNavigation(){
    document.querySelectorAll('[data-screen]').forEach(function(screen){
      if(!screen.hasAttribute('data-detail-layout') && !screen.querySelector('.asset-sum') && screen.id!=='e-detail')return;
      var content=screen.querySelector('.content-in');
      if(content.querySelector('[data-detail-nav]'))return;
      // data-detail-layout: every card is a section unless marked data-detail-summary (an asset summary may sit inside a section card).
      var layout=screen.hasAttribute('data-detail-layout');
      var overview=content.querySelector(layout?':scope > .card[data-detail-summary]':':scope > .card:has(.asset-sum), :scope > .card[data-detail-summary]');
      var sections=Array.from(content.querySelectorAll(':scope > .card, :scope > .asset-detail > .card, :scope > .asset-detail > .detail-group > .card')).filter(function(section){return section!==overview;});
      var nav=document.createElement('nav'), lastGroup=null;
      nav.className='detail-nav';nav.dataset.detailNav='';nav.setAttribute('aria-label','详情信息导航');
      sections.forEach(function(section,index){
        var heading=section.querySelector('.card-head :is(h2,h3)');
        var label=section.dataset.navLabel || (heading ? heading.textContent : (screen.id==='e-detail'?'企业信息':'资产概览'));
        // Extra space separates related records, core and supplementary groups.
        var group=section.closest('.detail-group');
        if(index>0 && group!==lastGroup){var sep=document.createElement('span');sep.className='detail-nav-sep';sep.setAttribute('aria-hidden','true');nav.appendChild(sep);}
        lastGroup=group;
        section.id=screen.id+'-section-'+index;
        section.dataset.detailSection='';section.tabIndex=-1;
        if(heading){heading.id=section.id+'-heading';section.setAttribute('aria-labelledby',heading.id);}
        else section.setAttribute('aria-label',label);
        var link=document.createElement('a');link.href='#'+section.id;link.textContent=label;
        link.dataset.detailTarget=section.id;
        if(index===0)link.setAttribute('aria-current','location');
        nav.appendChild(link);
      });
      if(overview)overview.after(nav);
      else if(layout && sections[0])sections[0].before(nav);
      else content.querySelector('.page-head').after(nav);
    });
  }

  // Navigation only: keep the screen route and business data unchanged.
  var selectedTarget=null, selectedY=null;
  TP.refreshDetailNav=function(){
    var nav=document.querySelector('[data-screen]:not([hidden]) [data-detail-nav]');
    if(!nav)return;
    var links=Array.from(nav.querySelectorAll('a')), active=links[0];
    var edge=nav.getBoundingClientRect().bottom+24;
    links.forEach(function(link){
      if(document.getElementById(link.dataset.detailTarget).getBoundingClientRect().top<=edge)active=link;
    });
    if(window.scrollY>0 && window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-2)active=links[links.length-1];
    // Several sections can fit at the page bottom. Keep the clicked section
    // selected until the user scrolls away, without adding blank space.
    if(selectedTarget && Math.abs(window.scrollY-selectedY)<2 && links.indexOf(selectedTarget)!==-1)active=selectedTarget;
    else selectedTarget=null;
    links.forEach(function(link){
      if(link===active)link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    });
  };
  document.addEventListener('click',function(event){
    var link=event.target.closest('[data-detail-target]');if(!link)return;
    event.preventDefault();
    var target=document.getElementById(link.dataset.detailTarget);
    // A file-batch destination exposes the existing files and receives keyboard focus.
    var batch=target.matches('.material-batch') ? target : null;
    if(batch)batch.open=true;
    // Keep the parent heading visible when entering the first card in a group.
    var group=target.closest('.detail-group');
    var position=group && group.querySelector('.card')===target ? group : target;
    position.scrollIntoView({block:'start',behavior:'instant'});
    (batch ? batch.querySelector('summary') : target).focus({preventScroll:true});
    selectedTarget=link;selectedY=window.scrollY;
    TP.refreshDetailNav();
  });
  var scrollPending=false;
  window.addEventListener('scroll',function(){
    if(scrollPending)return;scrollPending=true;
    requestAnimationFrame(function(){scrollPending=false;TP.refreshDetailNav();});
  },{passive:true});
  window.addEventListener('resize',TP.refreshDetailNav);

  TP.addCopy({
    '企业名称':'Company name','企业英文名称':'Company English name',
    '核心信息':'Core information','补充信息':'Supplementary information',
    '债权人与债务人':'Creditor and debtor','债权人与上游供应商，债务人与其下游客户':'Creditor with upstream supplier; debtor with its customers',
    '应收账款与交易双方':'Receivable and parties','交易双方':'Parties','资产编号':'Asset ID','资产类型':'Asset type','应收账款':'Accounts receivable',
    '行业大类':'Industry','汽车贸易':'Automotive trade','原始资产价值':'Original asset value','查看完整值':'View full value','形成日期':'Origination date',
    '到期日':'Due date','确权日期':'Confirmation date','确权凭证':'Confirmation certificate','币种':'Currency','债权人':'Creditor','债务人':'Debtor','名称':'Name',
    '注册国家 / 地区':'Country / region of registration','企业登记标识':'Company registration ID',
    '中国香港':'Hong Kong, China','阿联酋':'United Arab Emirates','新加坡':'Singapore','沙特阿拉伯':'Saudi Arabia',
    '销售合同 / 订单':'Sales contract / order','销售订单':'Sales order','销售合同 / 订单编号':'Sales contract / order no.','销售合同 / 订单文件':'Sales contract / order file',
    '订单日期':'Order date','订单金额':'Order amount',
    '标的物明细':'Goods','2 项':'2 items','型号规格':'Model / specification','数量':'Quantity','唯一识别码':'Unique identifier',
    '货物交付':'Delivery','交付地点':'Delivery location','交付日期':'Delivery date','运输单据编号':'Transport document no.','运输单据':'Transport document','交付凭证':'Proof of delivery',
    '销售发票':'Sales invoices','销售发票编号':'Sales invoice no.','开具日期':'Issue date','金额':'Amount','发票文件':'Invoice file','1 张':'1 invoice','2 张':'2 invoices',
    '回款进度':'Repayment progress','债务人对本笔应收账款的回款':'Payments from the debtor against this receivable',
    '累计已回款':'Total repaid','未回款余额':'Outstanding balance','结清日期':'Settlement date',
    '回款记录':'Repayment records','1 条':'1 record','2 条':'2 records','回款日期':'Payment date','回款金额':'Payment amount','回款流水号':'Payment reference',
    '支付凭证编号':'Payment voucher no.','支付凭证':'Payment voucher','暂无回款记录':'No repayment records yet',
    '与上游供应商':'Upstream supplier','上游供应商':'Supplier','采购合同 / 订单':'Purchase contract / order','采购合同 / 订单编号':'Purchase contract / order no.',
    '采购合同 / 订单文件':'Purchase contract / order file','供应商名称':'Supplier','采购日期':'Purchase date','采购金额':'Purchase amount',
    '供应商发货':'Supplier shipment','发货日期':'Shipment date','发货记录':'Shipment record',
    '采购发票':'Purchase invoices','采购发票编号':'Purchase invoice no.',
    '向供应商付款':'Payments to supplier','付款日期':'Payment date','付款金额':'Payment amount','付款流水号':'Payment reference','付款凭证':'Payment voucher',
    '暂无采购合同 / 订单信息':'No purchase contract or order information','暂无发货记录':'No shipment record','暂无采购发票':'No purchase invoices','暂无付款记录':'No payment records',
    '债务人与其下游客户':'Debtor and its customers','债务人下游客户':'Debtor’s customers','2 笔交易 · 回款不计入本笔应收账款':'2 transactions · repayments do not count toward this receivable',
    '暂无债务人下游客户交易信息':'No transactions between the debtor and its customers',
    '上游未提供':'Not provided by upstream','未提供':'Not provided',
    '查看':'View','下载':'Download',/* 资产状态与通用列名：面客端、管理端共用 */
    '回款状态':'Repayment status','未到期':'Not due','暂时无法确认':'Unable to confirm',
    '确权状态':'Confirmation','结清状态':'Settlement','逾期状态':'Overdue status','发行状态':'Issuance status',
    '已确权':'Confirmed','已撤销确权':'Confirmation revoked','原始到期日':'Original due date','未结清':'Unsettled','已结清':'Settled','未逾期':'Not overdue','已逾期':'Overdue',
    '暂时无法获取':'Temporarily unavailable','可发行':'Available','发行申请中':'Application in progress','已驳回':'Rejected','已发行':'Issued',
    '确权 · 结清 · 逾期':'Confirm · Settle · Overdue','资产价值':'Asset value','操作':'Actions',
    '资产详情':'Asset details','关联记录':'Related records','申请明细':'Application records','发行申请':'Issuance application','申请状态':'Application status',
    '资产概览':'Overview','详情信息导航':'Detail sections',
    '返回列表':'Back to list','重试':'Retry','请稍后重试。':'Please try again later.','关闭':'Close','默认':'Default','读取失败':'Load failed',
    '待运营审核':'Pending operator review','铸造成功':'Minted','代币':'Token','应收账款 · 汽车贸易 · 时区':'Accounts receivable · Automotive trade · Time zone'
  });
})(window.TP=window.TP||{});
