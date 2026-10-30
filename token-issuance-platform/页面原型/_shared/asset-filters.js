/* M2 filter presentation. Field scope follows PRD §5.6.
   Static prototype: controls preview layout; no querying, validation, data
   filtering, date interpretation or account persistence is simulated. */
(function(TP){
  'use strict';
  function text(name){
    return '<label class="field"><span class="field-label">'+name+'</span><input class="inp" type="search" placeholder="'+name+'"></label>';
  }
  function select(name, values, advanced){
    return '<label class="'+(advanced?'field filter-select-field':'filter-select')+'"><span class="'+(advanced?'field-label':'sr-only')+'">'+name+'</span><select class="inp" aria-label="'+name+'">'+
      '<option value="">'+(advanced?'全部':name+' · 全部')+'</option>'+values.map(function(v){return '<option value="'+v+'">'+(advanced?v:name+' · '+v)+'</option>';}).join('')+'</select></label>';
  }
  TP.fillAssetFilters=function(){
    document.querySelectorAll('.asset-list').forEach(function(table){
      var screen=table.closest('[data-screen]'), card=table.closest('.card');
      var globalScope=screen.id==='o-list'||screen.id==='r-list';
      var currencies=Array.from(new Set(Array.from(table.querySelectorAll('.ccy')).map(function(el){return el.textContent;})));
      var form=document.createElement('form');
      form.className='asset-filters';form.setAttribute('aria-label','筛选资产');
      var panelId=screen.id+'-advanced-filters';
      form.innerHTML='<div class="filter-toolbar">'+
        select('发行状态',['可发行','发行申请中','已驳回','已发行'])+
        select('回款状态',['未到期','已逾期','已结清','暂时无法确认'])+
        '<button class="btn sm filter-more" type="button" aria-expanded="false" aria-controls="'+panelId+'"><span>更多筛选</span><i data-ico="chev"></i></button>'+
        '<div class="filter-query"><label class="filter-search"><span class="sr-only">上游资产编号</span><i data-ico="search"></i><input class="inp" type="search" placeholder="搜索资产编号"></label>'+
        '<div class="filter-actions"><button class="btn sm ghost" type="reset">重置</button><button class="btn sm primary" type="submit">查询</button></div></div></div>'+
        '<div class="filter-advanced" id="'+panelId+'" hidden>'+text('债务人名称')+(globalScope?text('债权人名称'):'')+select('币种',currencies,true)+
        '<div class="field filter-date-field"><div class="field-label"><span>到期时间范围</span><span class="filter-zone" data-zone></span></div>'+
        '<div class="filter-dates" role="group" aria-label="到期时间范围">'+
        '<input class="inp" type="datetime-local" aria-label="到期时间自"><span>至</span><input class="inp" type="datetime-local" aria-label="到期时间至"></div></div></div>';
      var more=form.querySelector('.filter-more'), panel=form.querySelector('.filter-advanced');
      function expand(open){
        more.setAttribute('aria-expanded',String(open));panel.hidden=!open;
        if(open)panel.querySelector('input,select').focus();
        else more.focus();
      }
      more.addEventListener('click',function(){expand(panel.hidden);});
      panel.addEventListener('keydown',function(event){
        if(event.key==='Escape'){event.preventDefault();expand(false);}
      });
      function reflectFilledFields(){
        more.classList.toggle('has-values',Array.from(panel.querySelectorAll('input,select')).some(function(el){return el.value!=='';}));
      }
      panel.addEventListener('input',reflectFilledFields);
      panel.addEventListener('change',reflectFilledFields);
      form.addEventListener('reset',function(){requestAnimationFrame(reflectFilledFields);});
      form.addEventListener('submit',function(event){
        event.preventDefault();
        TP.toast('本原型仅展示筛选布局，查询规则与结果以业务系统为准。');
      });
      card.querySelector('.card-head').after(form);
    });
  };
  TP.addCopy({
    '筛选资产':'Filter assets','债务人名称':'Debtor name','债权人名称':'Creditor name',
    '发行状态 · 全部':'Issuance · All','回款状态 · 全部':'Repayment · All','币种 · 全部':'Currency · All',
    '发行状态 · 可发行':'Issuance · Available','发行状态 · 发行申请中':'Issuance · Application in progress',
    '发行状态 · 已驳回':'Issuance · Rejected','发行状态 · 已发行':'Issuance · Issued',
    '回款状态 · 未到期':'Repayment · Not due','回款状态 · 已逾期':'Repayment · Overdue',
    '回款状态 · 已结清':'Repayment · Settled','回款状态 · 暂时无法确认':'Repayment · Unable to confirm',
    '全部':'All','更多筛选':'More filters','搜索资产编号':'Search asset ID',
    '到期时间范围':'Due date range','到期时间自':'Due from','到期时间至':'Due to','至':'to',
    '查询':'Search','重置':'Reset',
    '本原型仅展示筛选布局，查询规则与结果以业务系统为准。':'This prototype previews the filters. Query rules and results require the business system.'
  });
})(window.TP=window.TP||{});
