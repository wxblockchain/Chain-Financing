/* M2 names, filter and pagination presentation. Field scope follows PRD §5.6 / §5.7 / §5.8.
   Static prototype: controls preview layout; no querying, validation, data
   filtering, paging, date interpretation or account persistence is simulated.
   用法：资产表格 table.asset-list（with-creditor 另加债权人条件）所在卡片自动生成筛选条与分页；
   没有表格的读取失败卡片用 data-asset-filters（值为 with-creditor 时另加债权人）、data-currencies="USD,EUR"
   只生成筛选条、不生成分页。TP.setAssetFilters(画面 id, {id, issue, repayment, debtor, creditor, currency})
   只回填已填条件的展示值。“尚无任何资产”的卡片不放表格也不加 data-asset-filters，因此不显示筛选条。 */
(function(TP){
  'use strict';
  function text(name, key){
    return '<label class="field"><span class="field-label">'+name+'</span><input class="inp" type="search" data-filter="'+key+'" placeholder="'+name+'"></label>';
  }
  function select(name, values, advanced, key){
    return '<label class="'+(advanced?'field filter-select-field':'filter-select')+'"><span class="'+(advanced?'field-label':'sr-only')+'">'+name+'</span><select class="inp" data-filter="'+key+'" aria-label="'+name+'">'+
      '<option value="">'+(advanced?'全部':name+' · 全部')+'</option>'+values.map(function(v){return '<option value="'+v+'">'+(advanced?v:name+' · '+v)+'</option>';}).join('')+'</select></label>';
  }
  // Presentation only: preserve the original name and reveal it on hover or activation.
  function fitNames(table){
    Array.from(table.tHead.rows[0].cells).forEach(function(heading,index){
      if(!heading.classList.contains('col-name'))return;
      Array.from(table.tBodies[0].rows).forEach(function(row){
        var cell=row.cells[index];
        var fields=Array.from(cell.querySelectorAll('[data-name-field]'));
        if(!fields.length)fields=[cell];
        fields.forEach(function(field){
          var full=field.textContent.trim();if(!full)return;
          var chars=typeof Intl.Segmenter==='function' ? Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(full),function(item){return item.segment;}) : Array.from(full);
          var tail=Math.min(8,Math.ceil(chars.length/3));
          var button=document.createElement('button');
          button.type='button';button.className='name-clip';button.title=full;
          button.setAttribute('data-upstream','');
          button.setAttribute('aria-label',full);button.dataset.toast=full;
          ['name-prefix','name-suffix'].forEach(function(cls,i){
            var part=document.createElement('span');part.className=cls;part.setAttribute('aria-hidden','true');
            part.textContent=(i?chars.slice(-tail):chars.slice(0,-tail)).join('');button.appendChild(part);
          });
          field.replaceChildren(button);
        });
      });
    });
  }
  TP.fillAssetFilters=function(){
    document.querySelectorAll('table:has([data-name-field])').forEach(fitNames);
    var cards=Array.from(document.querySelectorAll('.asset-list')).map(function(table){return table.closest('.card');})
      .concat(Array.from(document.querySelectorAll('.card[data-asset-filters]:not(:has(.asset-list))')));
    cards.forEach(function(card){
      var table=card.querySelector('.asset-list'), screen=card.closest('[data-screen]');
      var globalScope=table ? table.classList.contains('with-creditor') : card.dataset.assetFilters==='with-creditor';
      var currencies=table ? Array.from(new Set(Array.from(table.querySelectorAll('.ccy')).map(function(el){return el.textContent;})))
        : (card.dataset.currencies||'').split(',').filter(Boolean);
      var form=document.createElement('form');
      form.className='asset-filters';form.setAttribute('aria-label','筛选资产');
      var panelId=screen.id+'-advanced-filters';
      form.innerHTML='<div class="filter-toolbar">'+
        select('发行状态',['可发行','发行申请中','已发行'],false,'issue')+
        select('回款状态',['未到期','已逾期','已结清','暂时无法确认'],false,'repayment')+
        '<button class="btn sm filter-more" type="button" aria-expanded="false" aria-controls="'+panelId+'"><span>更多筛选</span><i data-ico="chev"></i></button>'+
        '<div class="filter-query"><label class="filter-search"><span class="sr-only">资产编号</span><i data-ico="search"></i><input class="inp" type="search" data-filter="id" placeholder="搜索资产编号"></label>'+
        '<div class="filter-actions"><button class="btn sm ghost" type="reset">重置</button><button class="btn sm primary" type="submit">查询</button></div></div></div>'+
        '<div class="filter-advanced" id="'+panelId+'" hidden>'+text('债务人名称','debtor')+(globalScope?text('债权人名称','creditor'):'')+select('币种',currencies,true,'currency')+
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
        TP.toast('演示数据，查询不改变列表结果。');
      });
      form.reflectFilledFields=reflectFilledFields;
      card.querySelector('.card-head').after(form);
      // data-total: total matching assets when the demo table shows only page 1 (10 per page).
      // A failed read has no known total, so cards without a table get no pager.
      if(table)card.appendChild(TP.buildPager(Number(table.dataset.total)||table.tBodies[0].rows.length,'资产分页'));
    });
  };
  // Demo only: show conditions the user has already entered on no-match / failed-read screens.
  TP.setAssetFilters=function(screenId, values){
    var form=document.querySelector('#'+screenId+' .asset-filters');if(!form)return;
    Object.keys(values).forEach(function(key){
      var field=form.querySelector('[data-filter="'+key+'"]');if(field)field.value=values[key];
    });
    form.reflectFilledFields();
  };
  TP.addCopy({
    '筛选资产':'Filter assets','债务人名称':'Debtor name','债权人名称':'Creditor name',
    '发行状态 · 全部':'Issuance · All','回款状态 · 全部':'Repayment · All','币种 · 全部':'Currency · All',
    '发行状态 · 可发行':'Issuance · Available','发行状态 · 发行申请中':'Issuance · Application in progress',
    '发行状态 · 已发行':'Issuance · Issued',
    '回款状态 · 未到期':'Repayment · Not due','回款状态 · 已逾期':'Repayment · Overdue',
    '回款状态 · 已结清':'Repayment · Settled','回款状态 · 暂时无法确认':'Repayment · Unable to confirm',
    '全部':'All','更多筛选':'More filters','搜索资产编号':'Search asset ID',
    '到期时间范围':'Due date range','到期时间自':'Due from','到期时间至':'Due to','至':'to',
    '查询':'Search','重置':'Reset','资产分页':'Asset pages','共':'Total','条':'records','上一页':'Previous page','下一页':'Next page','第 1 页':'Page 1',
    '演示数据，查询不改变列表结果。':'Demo data: searching does not change the list.',
    '演示数据只提供第 1 页。':'This demo includes page 1 only.','第 2 页':'Page 2'
  });
})(window.TP=window.TP||{});
