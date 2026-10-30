/* ==========================================================================
   asset-detail.js — 可信资产详情的六组信息（演示数据），供面客端与管理端复用
   只输出静态画面：基本信息、贸易订单、采购订单、账款信息、回款进度、材料。
   三个资产状态由各画面的摘要卡展示，这里不重复；字段与分级以 M2 PRD 为准。
   用法：<div class="asset-detail" data-asset-detail="上游资产编号"></div>，在 TP.boot 之前调用 TP.fillAssetDetail()。
   ========================================================================== */
(function(TP){
  'use strict';
  var FILE_TOAST = '原型未附真实文件';

  function file(name, kind){
    return '<li><span class="file-ico" aria-hidden="true"><i data-ico="doc"></i></span>'+
      '<div class="file-main"><button type="button" class="btn-link file-name" data-toast="'+FILE_TOAST+'">'+name+'</button><div class="cell-sub">'+kind+'</div></div>'+
      '<div class="file-acts"><button type="button" class="btn icon" data-toast="'+FILE_TOAST+'" aria-label="下载" title="下载"><i data-ico="download"></i></button></div></li>';
  }
  function day(iso){ return '<time data-day data-instant="'+iso+'" datetime="'+iso+'"></time>'; }
  function money(v, ccy){ return '<span class="money"><span class="mono">'+v+'</span><span class="ccy">'+ccy+'</span></span>'; }

  /* 演示资产：rich 为完整示例（两张销售发票、一条回款），其余为一张发票、暂无回款。 */
  var PARTY = {
    A:{name:'示例企业 A 有限公司', en:'Example Enterprise A Ltd.', region:'中国香港', id:'DEMO-1234567', kind:'CR'},
    C:{name:'Demo Trading C Pte. Ltd.', region:'新加坡', id:'DEMO-UEN-202600123', kind:'UEN'},
    B:{name:'Demo Buyer B LLC', region:'阿联酋', id:'DEMO-TL-889012', kind:'Trade License'},
    M:{name:'Demo Motors Trading FZE', region:'阿联酋', id:'DEMO-FZE-55120', kind:'Trade License'},
    E:{name:'Demo Retail E LLC', region:'阿联酋', id:'DEMO-TL-730045', kind:'Trade License'}
  };
  var ASSETS = {
    'RA-DEMO-0128':{cr:'A', db:'B', amt:'50,000.00', due:'2027-03-31T23:59:59+04:00', no:'0412', rich:true},
    'RA-DEMO-0131':{cr:'A', db:'M', amt:'82,400.00', due:'2027-05-15T23:59:59+04:00', no:'0436'},
    'RA-DEMO-0102':{cr:'A', db:'B', amt:'36,000.00', due:'2027-01-31T23:59:59+04:00', no:'0371'},
    'RA-DEMO-0097':{cr:'A', db:'M', amt:'24,800.00', due:'2027-02-28T23:59:59+04:00', no:'0359'},
    'RA-DEMO-0140':{cr:'A', db:'M', amt:'40,000.00', ccy:'EUR', due:'2027-06-30T23:59:59+04:00', no:'0460'},
    'RA-DEMO-0143':{cr:'A', db:'B', amt:'27,500.00', due:'2027-04-30T23:59:59+04:00', no:'0463'},
    'RA-DEMO-0150':{cr:'C', db:'E', amt:'61,200.00', due:'2027-06-20T23:59:59+04:00', no:'0502'}
  };

  function party(title, x){
    return '<div class="card-sec"><div class="sub-h">'+title+'</div><div class="facts-region"><dl class="facts">'+
      '<div><dt>名称</dt><dd>'+x.name+(x.en?'<div class="cell-sub">'+x.en+'</div>':'')+'</dd></div>'+
      '<div><dt>注册国家 / 地区</dt><dd>'+x.region+'</dd></div>'+
      '<div><dt>企业登记标识</dt><dd><span class="mono">'+x.id+'</span> <span class="faint">'+x.kind+'</span></dd></div>'+
      '</dl></div></div>';
  }

  function body(id){
    var a = ASSETS[id], so='SO-DEMO-2026-'+a.no, si='SI-DEMO-'+a.no, invoices, repay, files;
    if(a.rich){
      invoices = '<tr><td class="mono">'+si+'-01</td><td>'+day('2026-09-15T11:00:00+04:00')+'</td><td class="num">'+money('30,000.00','USD')+'</td></tr>'+
                 '<tr><td class="mono">'+si+'-02</td><td>'+day('2026-09-15T11:05:00+04:00')+'</td><td class="num">'+money('20,000.00','USD')+'</td></tr>';
      repay = '<div class="facts-region"><dl class="facts">'+
        '<div><dt>累计已回款</dt><dd>'+money('20,000.00','USD')+'</dd></div>'+
        '<div><dt>未回款余额</dt><dd>'+money('30,000.00','USD')+'</dd></div>'+
        '<div><dt>结清日期</dt><dd class="faint">—</dd></div></dl></div>'+
        '<div class="sub-h">回款记录<span class="sub">1 条</span></div>'+
        '<div class="tablewrap"><table class="tbl"><thead><tr><th>回款日期</th><th class="num">回款金额</th><th>回款流水号</th><th>支付凭证编号</th></tr></thead><tbody>'+
        '<tr><td>'+day('2026-10-20T15:30:00+04:00')+'</td><td class="num">'+money('20,000.00','USD')+'</td><td class="mono">TXN-DEMO-50021</td><td class="mono">PV-DEMO-50021</td></tr>'+
        '</tbody></table></div>';
    }else{
      invoices = '<tr><td class="mono">'+si+'-01</td><td>'+day('2026-09-15T11:00:00+04:00')+'</td><td class="num">'+money(a.amt,a.ccy||'USD')+'</td></tr>';
      repay = '<div class="facts-region"><dl class="facts">'+
        '<div><dt>累计已回款</dt><dd>'+money('0.00',a.ccy||'USD')+'</dd></div>'+
        '<div><dt>未回款余额</dt><dd>'+money(a.amt,a.ccy||'USD')+'</dd></div>'+
        '<div><dt>结清日期</dt><dd class="faint">—</dd></div></dl></div>'+
        '<div class="sub-h">回款记录</div><p class="sub-empty">暂无回款记录</p>';
    }
    files = file('CC-'+id+'.pdf','确权凭证') + file(si+'-01.pdf','销售发票文件') +
      (a.rich ? file(si+'-02.pdf','销售发票文件') + file('PV-DEMO-50021.pdf','回款支付凭证文件') : '') +
      file(so+'.pdf','贸易合同 / 订单文件') + file('POD-DEMO-'+a.no+'.pdf','交付凭证') + file('BL-DEMO-'+a.no+'.pdf','运输单据') +
      file('PO-DEMO-2026-'+a.no+'.pdf','采购合同 / 订单文件') + file('PI-DEMO-'+a.no+'-01.pdf','采购发票文件');
    var count = a.rich ? 9 : 7, nInv = a.rich ? 2 : 1;

    return [
      '<div class="card"><div class="card-head"><h2>基本信息</h2></div>',
      '<div class="facts-region"><dl class="facts">',
      '<div><dt>上游资产编号</dt><dd class="mono">'+id+'</dd></div>',
      '<div><dt>资产类型</dt><dd>应收账款</dd></div>',
      '<div><dt>行业大类</dt><dd>汽车贸易</dd></div>',
      '<div><dt>应收账款金额</dt><dd>'+money(a.amt,a.ccy||'USD')+'</dd></div>',
      '<div><dt>形成日期</dt><dd>'+day('2026-09-18T10:00:00+04:00')+'</dd></div>',
      '<div><dt>到期日</dt><dd><time data-instant="'+a.due+'" datetime="'+a.due+'"></time></dd></div>',
      '<div><dt>确权日期</dt><dd>'+day('2026-09-25T14:20:00+04:00')+'</dd></div>',
      '<div><dt>币种</dt><dd>'+(a.ccy||'USD')+'</dd></div>',
      '</dl></div>', party('债权人', PARTY[a.cr]), party('债务人', PARTY[a.db]), '</div>',

      '<div class="card"><div class="card-head"><h2>贸易订单</h2><span class="sub">债权人与债务人</span></div>',
      '<div class="facts-region"><dl class="facts">',
      '<div><dt>贸易合同 / 订单编号</dt><dd class="mono">'+so+'</dd></div>',
      '<div><dt>订单日期</dt><dd>'+day('2026-06-02T09:00:00+04:00')+'</dd></div>',
      '<div><dt>订单金额</dt><dd>'+money(a.amt,a.ccy||'USD')+'</dd></div>',
      '<div><dt>运输单据编号</dt><dd class="mono">BL-DEMO-'+a.no+'</dd></div>',
      '<div><dt>交付地点</dt><dd>Jebel Ali Free Zone, Demo Warehouse W-12</dd></div>',
      '<div><dt>交付日期</dt><dd>'+day('2026-09-12T16:00:00+04:00')+'</dd></div>',
      '</dl></div>',
      '<div class="sub-h">标的物明细<span class="sub">2 项</span></div>',
      '<div class="tablewrap"><table class="tbl auto"><thead><tr><th>名称</th><th>型号规格</th><th class="num">数量</th><th>唯一识别码</th></tr></thead><tbody>',
      '<tr><td>Demo Auto SUV</td><td>DM-X5 2026</td><td class="num">1</td><td class="mono">LDEMO0X5'+a.no+'00001</td></tr>',
      '<tr><td>Demo Auto SUV</td><td>DM-X5 2026</td><td class="num">1</td><td class="mono">LDEMO0X5'+a.no+'00002</td></tr>',
      '</tbody></table></div></div>',

      '<div class="card"><div class="card-head"><h2>采购订单</h2><span class="sub">债权人向供应商</span></div>',
      '<div class="facts-region"><dl class="facts">',
      '<div><dt>采购合同 / 订单编号</dt><dd class="mono">PO-DEMO-2026-'+a.no+'</dd></div>',
      '<div><dt>供应商名称</dt><dd>Demo Auto Manufacturing Co.</dd></div>',
      '<div><dt>采购日期</dt><dd>'+day('2026-06-10T09:00:00+08:00')+'</dd></div>',
      '<div><dt>采购金额</dt><dd>'+money('46,500.00','USD')+'</dd></div>',
      '</dl></div></div>',

      '<div class="card"><div class="card-head"><h2>账款信息</h2></div>',
      '<div class="sub-h">销售账款<span class="sub">债权人与债务人 · '+nInv+' 张发票</span></div>',
      '<div class="tablewrap"><table class="tbl auto"><thead><tr><th>销售发票编号</th><th>开具日期</th><th class="num">金额</th></tr></thead><tbody>',
      invoices, '</tbody></table></div>',
      '<div class="card-sec"><div class="sub-h">采购账款<span class="sub">债权人与供应商 · 1 张发票</span></div>',
      '<div class="tablewrap"><table class="tbl auto"><thead><tr><th>采购发票编号</th><th>开具日期</th><th class="num">金额</th></tr></thead><tbody>',
      '<tr><td class="mono">PI-DEMO-'+a.no+'-01</td><td>'+day('2026-08-28T10:00:00+08:00')+'</td><td class="num">'+money('46,500.00','USD')+'</td></tr>',
      '</tbody></table></div></div></div>',

      '<div class="card"><div class="card-head"><h2>回款进度</h2><span class="sub">债务人对本笔应收账款的回款</span></div>', repay, '</div>',

      '<div class="card"><div class="card-head"><h2>材料</h2><span class="sub">'+count+' 个文件</span></div><ul class="files">', files, '</ul></div>'
    ].join('');
  }

  TP.fillAssetDetail = function(){
    document.querySelectorAll('[data-asset-detail]').forEach(function(el){ el.innerHTML = body(el.dataset.assetDetail); });
    initDetailNavigation();
  };

  function initDetailNavigation(){
    document.querySelectorAll('[data-screen]').forEach(function(screen){
      if(!screen.querySelector('.asset-sum') && screen.id!=='e-detail')return;
      var content=screen.querySelector('.content-in');
      if(content.querySelector('[data-detail-nav]'))return;
      var overview=content.querySelector(':scope > .card:has(.asset-sum)');
      var sections=Array.from(content.querySelectorAll(':scope > .card, :scope > .asset-detail > .card')).filter(function(section){return section!==overview;});
      var nav=document.createElement('nav');
      nav.className='detail-nav';nav.dataset.detailNav='';nav.setAttribute('aria-label','详情信息导航');
      sections.forEach(function(section,index){
        var heading=section.querySelector('.card-head h2');
        var label=heading ? heading.textContent : (screen.id==='e-detail'?'企业信息':'资产概览');
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
    target.scrollIntoView({block:'start',behavior:'instant'});target.focus({preventScroll:true});
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
    '基本信息':'Basic information','上游资产编号':'Upstream asset ID','资产类型':'Asset type','应收账款':'Accounts receivable',
    '行业大类':'Industry','汽车贸易':'Automotive trade','应收账款金额':'Receivable amount','形成日期':'Origination date',
    '到期日':'Due date','确权日期':'Confirmation date','币种':'Currency','债权人':'Creditor','债务人':'Debtor','名称':'Name',
    '注册国家 / 地区':'Country / region of registration','企业登记标识':'Company registration ID',
    '中国香港':'Hong Kong, China','阿联酋':'United Arab Emirates',
    '贸易订单':'Trade order','债权人与债务人':'Creditor and debtor','贸易合同 / 订单编号':'Trade contract / order no.',
    '订单日期':'Order date','订单金额':'Order amount','运输单据编号':'Transport document no.','交付地点':'Delivery location','交付日期':'Delivery date',
    '标的物明细':'Goods','2 项':'2 items','型号规格':'Model / specification','数量':'Quantity','唯一识别码':'Unique identifier',
    '采购订单':'Purchase order','债权人向供应商':'Creditor to supplier','采购合同 / 订单编号':'Purchase contract / order no.',
    '供应商名称':'Supplier','采购日期':'Purchase date','采购金额':'Purchase amount',
    '账款信息':'Invoices','销售账款':'Sales invoices','债权人与债务人 · 2 张发票':'Creditor and debtor · 2 invoices','债权人与债务人 · 1 张发票':'Creditor and debtor · 1 invoice','7 个文件':'7 files','暂无回款记录':'No repayment records yet','新加坡':'Singapore',
    '销售发票编号':'Sales invoice no.','开具日期':'Issue date','金额':'Amount',
    '采购账款':'Purchase invoices','债权人与供应商 · 1 张发票':'Creditor and supplier · 1 invoice','债权人与供应商':'Creditor and supplier','采购发票编号':'Purchase invoice no.',
    '回款进度':'Repayment progress','债务人对本笔应收账款的回款':'Payments from the debtor against this receivable',
    '累计已回款':'Total repaid','未回款余额':'Outstanding balance','结清日期':'Settlement date',
    '回款记录':'Repayment records','1 条':'1 record','回款日期':'Payment date','回款金额':'Payment amount','回款流水号':'Payment reference','支付凭证编号':'Payment voucher no.',
    '材料':'Documents','9 个文件':'9 files','查看':'View','下载':'Download','原型未附真实文件':'No real file is attached to this prototype',
    '确权凭证':'Confirmation certificate','销售发票文件':'Sales invoice file','回款支付凭证文件':'Payment voucher file',
    '贸易合同 / 订单文件':'Trade contract / order file','交付凭证':'Proof of delivery','运输单据':'Transport document',
    '采购合同 / 订单文件':'Purchase contract / order file','采购发票文件':'Purchase invoice file',
    /* 资产状态与通用列名：面客端、管理端共用 */
    '回款状态':'Repayment status','未到期':'Not due','暂时无法确认':'Unable to confirm',
    '确权状态':'Confirmation','结清状态':'Settlement','逾期状态':'Overdue status','发行状态':'Issuance status',
    '已确权':'Confirmed','已撤销确权':'Confirmation revoked','未结清':'Unsettled','已结清':'Settled','未逾期':'Not overdue','已逾期':'Overdue',
    '暂时无法获取':'Temporarily unavailable','可发行':'Available','发行申请中':'Application in progress','已驳回':'Rejected','已发行':'Issued',
    '确权 · 结清 · 逾期':'Confirm · Settle · Overdue','应收账款金额':'Receivable amount','操作':'Actions',
    '资产详情':'Asset details','关联记录':'Related records','发行申请':'Issuance application','申请状态':'Application status',
    '资产概览':'Overview','详情信息导航':'Detail sections',
    '返回列表':'Back to list','重试':'Retry','请稍后重试。':'Please try again later.','关闭':'Close','默认':'Default','读取失败':'Load failed',
    '待运营审核':'Pending operator review','铸造成功':'Minted','代币':'Token','应收账款 · 汽车贸易 · 时区':'Accounts receivable · Automotive trade · Time zone'
  });
})(window.TP=window.TP||{});
