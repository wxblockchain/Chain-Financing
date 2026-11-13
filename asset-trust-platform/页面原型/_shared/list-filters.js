/* ==========================================================================
   list-filters.js — 列表筛选条的展示行为（代币发行平台组件规范 v1.96 §4.14「列表筛选条」）
   模块在卡片头之后直接写静态 <form class="asset-filters" data-static-form> 标记：
   .filter-toolbar（常用下拉、更多筛选、搜索、重置、查询）+ .filter-advanced（展开区，默认 hidden）。
   这里只负责：更多筛选展开 / 收起（Esc 收起并还焦点）、已填条件提示、查询给出演示说明；
   下拉选项带 data-go 时切换到该范围的画面（列表范围作为筛选项）。
   不实现查询、匹配、日期校验或分页计算；规则以 PRD 为准。在 TP.boot 之前调用 TP.initListFilters()。
   ========================================================================== */
(function(TP){
  'use strict';
  TP.initListFilters=function(){
    document.querySelectorAll('form.asset-filters').forEach(function(form){
      var more=form.querySelector('.filter-more'), panel=form.querySelector('.filter-advanced');
      function reflect(){
        if(more&&panel)more.classList.toggle('has-values',Array.from(panel.querySelectorAll('input,select')).some(function(el){return el.value!=='';}));
      }
      function expand(open){
        more.setAttribute('aria-expanded',String(open));panel.hidden=!open;
        if(open)panel.querySelector('input,select').focus();else more.focus();
      }
      if(more&&panel){
        more.addEventListener('click',function(){expand(panel.hidden);});
        panel.addEventListener('keydown',function(event){if(event.key==='Escape'){event.preventDefault();event.stopPropagation();expand(false);}});
        panel.addEventListener('input',reflect);panel.addEventListener('change',reflect);
      }
      // 列表范围（如“待审核”“待处理 / 已处理”）作为筛选项：选中的项有对应画面时切换过去，其余条件为静态筛选。
      form.addEventListener('change',function(event){
        var opt=event.target.selectedOptions && event.target.selectedOptions[0];
        if(opt && opt.dataset.go && TP.show) TP.show(opt.dataset.go);
      });
      form.addEventListener('reset',function(){requestAnimationFrame(reflect);});
      form.addEventListener('submit',function(event){event.preventDefault();TP.toast('演示数据，查询不改变列表结果。');});
      reflect();
    });
  };
  TP.addCopy({'更多筛选':'More filters','查询':'Search','重置':'Reset','全部':'All','至':'to',
    '演示数据，查询不改变列表结果。':'Demo data: searching does not change the list.'});
})(window.TP=window.TP||{});
