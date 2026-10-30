/* M2 filter presentation. Field scope follows PRD §5.6.
   Static prototype: controls preview layout; no querying, validation, data
   filtering, date interpretation or account persistence is simulated. */
(function(TP){
  'use strict';
  function text(name){
    return '<label class="filter-text"><span class="sr-only">'+name+'</span><input class="inp" type="search" placeholder="'+name+'"></label>';
  }
  function select(name, values){
    return '<label class="filter-select"><span class="sr-only">'+name+'</span><select class="inp" aria-label="'+name+'">'+
      '<option value="">'+name+' · 全部</option>'+values.map(function(v){return '<option>'+v+'</option>';}).join('')+'</select></label>';
  }
  TP.fillAssetFilters=function(){
    document.querySelectorAll('.asset-list').forEach(function(table){
      var screen=table.closest('[data-screen]'), card=table.closest('.card');
      var globalScope=screen.id==='o-list'||screen.id==='r-list';
      var currencies=Array.from(new Set(Array.from(table.querySelectorAll('.ccy')).map(function(el){return el.textContent;})));
      var form=document.createElement('form');
      form.className='asset-filters';form.setAttribute('aria-label','筛选资产');
      form.innerHTML='<div class="filter-fields">'+text('上游资产编号')+text('债务人名称')+(globalScope?text('债权人名称'):'')+
        select('发行状态',['可发行','发行申请中','已驳回','已发行'])+
        select('回款状态',['未到期','已逾期','已结清','暂时无法确认'])+'</div>'+
        '<div class="filter-secondary">'+select('币种',currencies)+
        '<div class="filter-dates" role="group" aria-label="到期时间范围">'+
        '<label><span>到期时间自</span><input class="inp" type="datetime-local" aria-label="到期时间自"></label>'+
        '<label><span>至</span><input class="inp" type="datetime-local" aria-label="到期时间至"></label></div>'+
        '<span class="filter-zone" data-zone></span>'+
        '<div class="filter-actions"><button class="btn sm primary" type="submit">查询</button><button class="btn sm" type="reset">重置</button></div></div>';
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
    '到期时间范围':'Due date range','到期时间自':'Due from','到期时间至':'Due to','至':'to',
    '查询':'Search','重置':'Reset',
    '本原型仅展示筛选布局，查询规则与结果以业务系统为准。':'This prototype previews the filters. Query rules and results require the business system.'
  });
})(window.TP=window.TP||{});
