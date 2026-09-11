/* ================================================================
   70-actions.js —— 动作层
   链上调用只发生在三个动作上：入池（质押 / 追加）、撤回、提取。
   额度动作（发布需求、撤下、占用与释放、预警触发与解除）一律不触达链上。
   ================================================================ */

function resetWiz(){ state.wiz = { pid:null, name:'', sel:{}, amount:'', amtErr:null, result:null, wsel:{}, busy:false }; }

function wizName(v){ state.wiz.name = v; renderSoft(); }
function wizTok(id){ state.wiz.sel[id] = !state.wiz.sel[id]; render(); }
function wizAll(on){ WALLET.forEach(function(t){ state.wiz.sel[t.id] = on; }); render(); }
function wTok(id){ state.wiz.wsel[id] = !state.wiz.wsel[id]; render(); }
function wizAmount(v){ state.wiz.amount = v; state.wiz.amtErr = null; renderSoft(); }

function removeFromWallet(ids){
  for(var i = WALLET.length - 1; i >= 0; i--){ if(ids.indexOf(WALLET[i].id) >= 0) WALLET.splice(i, 1); }
}
function newProjectId(){
  var n = PROJECTS.length + 55;
  return 'FP-' + TODAY.replace(/-/g,'') + '-' + String(n).padStart(4,'0');
}

/* ---- 建池：一次提交完成"建池 + 首笔质押" ---- */
function submitCreate(){
  var sel = WALLET.filter(function(t){ return state.wiz.sel[t.id]; });
  if(!sel.length || !state.wiz.name.trim()) return;
  confirmChain({
    title:'创建融资项目并发起首笔质押',
    rows:[ ['操作内容', '将 ' + sel.length + ' 张代币转入质押合约', true],
           ['项目名称', state.wiz.name.trim(), true],
           ['质押价值合计', usd(sel.reduce(function(a,t){ return a + t.amt; }, 0))] ],
    n:sel.length, gas:gasEstimate(sel.length),
    extra:'<div class="note" style="margin-top:14px"><span class="ic">i</span><div class="bd">' +
      '创建校验的对象是<b>质押申请已提交</b>：链上「处理中」或「成功」均算通过，不要求等待链上确认完成。' +
      '所以您不需要在页面上干等——提交后随时可以离开，回来继续第二段。</div></div>',
    onDone:function(k){ finishCreate(k, sel); }
  });
}
function finishCreate(k, sel){
  /* 取消签名 / gas 不足：交易未发出，不产生任何记录变更（D-FIN-71 / E-10） */
  if(k === 'cancel' || k === 'nogas'){ state.wiz.result = { k:k }; render(); return; }

  var id = newProjectId(), gas = gasEstimate(sel.length);
  var okTok = [], badN = 0, ct = 'CT-2';
  if(k === 'ok')      { okTok = sel.slice(); }
  else if(k === 'partial'){ var c = Math.max(1, Math.ceil(sel.length/2)); okTok = sel.slice(0, c); badN = sel.length - c; }
  else if(k === 'timeout'){ okTok = sel.slice(); ct = 'CT-1'; }
  else                { okTok = []; badN = sel.length; }   /* offchain / onchain：空池草稿 E-12 */

  okTok.forEach(function(t){ t.ct = ct; t.ps = 'PS-2'; });
  var total = okTok.reduce(function(a,t){ return a + t.amt; }, 0);
  var p = {
    id:id, name:state.wiz.name.trim(), owner:ACTORS.asset.full, entity:ACTORS.asset.entity,
    status:'S-FP-1', expired:false, draft:true, emptyPool:(okTok.length === 0 || ct === 'CT-1' ? okTok.length === 0 : false),
    publishedAt:null, expiresAt:null, demand:null, quotes:0, assetType:'应收账款类',
    tokens:okTok,
    /* 处理中（CT-1）不预先计入质押价值——估值保守原则 */
    events:[{ d:TODAY, k:(okTok.length ? 'pledge' : 'fail'),
              t:'创建资产池 · 质押 ' + sel.length + ' 张' + (badN ? '（' + badN + ' 张链上失败）' : ''),
              dTotal:(ct === 'CT-2' ? total : 0),
              note:(ct === 'CT-1' ? '链上结果未返回，处理中不预先计入有效质押价值（D-FIN-54 ①）'
                                  : okTok.length ? '链上转入成功（CT-2），计入有效质押价值'
                                                 : '首笔质押链上失败，项目保留为空池草稿（E-12 / D-FIN-62）') }]
  };
  if(ct === 'CT-1') p.emptyPool = true;   /* 尚无 CT-2 ⇒ 有效质押价值为 0，发布入口 ⊘ */
  PROJECTS.push(p);
  removeFromWallet(okTok.map(function(t){ return t.id; }));

  state.wiz.result = { k:k, n:okTok.length, ok:okTok.length, bad:badN, gas:gas };
  state.wiz.pid = id; state.wiz.sel = {};
  state.id = id; state.page = 'publish'; state.step = 2;
  syncHash(); render(); window.scrollTo(0, 0);
}

/* ---- 追加质押（D-FIN-48：任何项目状态下都允许，只增不减） ---- */
function openPledge(pid){ go('publish', { id:pid, action:'pledge', step:2 }); }
function submitPledge(pid){
  var p = findProject(pid), sel = WALLET.filter(function(t){ return state.wiz.sel[t.id]; });
  if(!sel.length) return;
  var sum = sel.reduce(function(a,t){ return a + t.amt; }, 0);
  confirmChain({
    title:'追加质押',
    rows:[ ['操作内容', '将 ' + sel.length + ' 张代币转入质押合约', true],
           ['目标资产池', p.name + ' · ' + p.id, true],
           ['追加价值合计', usd(sum)],
           ['融资上限将增加', usd(round2(sum * PLEDGE_RATE))] ],
    n:sel.length, gas:gasEstimate(sel.length),
    onDone:function(k){
      if(k === 'cancel' || k === 'nogas'){ state.wiz.result = { k:k }; render(); return; }
      if(k === 'ok' || k === 'partial'){
        var take = (k === 'ok') ? sel : sel.slice(0, Math.max(1, Math.ceil(sel.length/2)));
        take.forEach(function(t){ t.ct = 'CT-2'; t.ps = 'PS-2'; });
        p.tokens = p.tokens.concat(take);
        p.emptyPool = false;
        var s = take.reduce(function(a,t){ return a + t.amt; }, 0);
        p.events.push({ d:TODAY, k:'topup', t:'追加质押 ' + take.length + ' 张 · ' + usd(s), dTotal:s,
                        note:'池内资产只增不减地增强担保（D-FIN-48）' });
        removeFromWallet(take.map(function(t){ return t.id; }));
        state.wiz.result = { k:k, n:take.length, ok:take.length, bad:sel.length - take.length, gas:gasEstimate(sel.length) };
      } else {
        state.wiz.result = { k:k, n:sel.length, gas:gasEstimate(sel.length) };
      }
      state.wiz.sel = {}; state.panel = null; render(); window.scrollTo(0, 0);
    }
  });
}

/* ---- 发布：额度动作，不触达链上（D-FIN-67） ---- */
function submitPublish(pid){
  var p = findProject(pid), d = derive(p);
  var v = parseFloat(String(state.wiz.amount).replace(/,/g, ''));
  if(!(v > 0)){
    state.wiz.amtErr = { head:'请填写有效的融资需求金额。', body:'金额必须大于 ' + usd(0) + '，精度为 ' + CCY + ' 2 位小数。' };
    render(); return;
  }
  v = round2(v);
  if(v > d.free){
    var diff = round2(v - d.free);
    state.wiz.amtErr = {
      head:'融资需求金额超出可融金额，发布校验不通过。',
      body:'本次填写 <span class="n">' + usd(v) + '</span>；当前可融金额 <span class="n">' + usd(d.free) +
           '</span>；差额 <span class="n">' + usd(diff) + '</span>。<br>' +
           '两条出路：① 把需求金额下调到 ' + usd(d.free) + ' 以内；② 追加质押抬高融资上限——需追加资产价值 <span class="n">' +
           usd(round2(diff / PLEDGE_RATE)) + '</span>（＝差额 ÷ ' + (PLEDGE_RATE*100) + '%）。<br>' +
           '已完成的质押不会因为本次发布校验失败而回滚，代币照常在池、照常计入价值。'
    };
    render(); return;
  }
  var first = !p.publishedAt;
  p.demand = v; p.status = 'S-FP-2'; p.draft = false;
  if(first){ p.publishedAt = TODAY; p.expiresAt = addYears(TODAY, TERM_YEARS); }
  p.events.push({ d:TODAY, k:'publish', t:(first ? '发布' : '再次发布') + '融资需求 ' + usd(v), dFly:v,
                  note:'发布即产生在途占用，这是项目在途金额的唯一来源；报价环节不再新增占用（AC-FIN-23）' });
  state.wiz.amount = ''; state.wiz.amtErr = null;
  toast('发布成功：项目转「募集中」，需求金额 ' + usd(v) + ' 已计入项目在途金额' +
        (first ? '，有效期至 ' + p.expiresAt + '（首次发布日 + 1 年，只读）' : '（有效期不重置）') + '。');
  go('project', { id:pid });
}

/* ---- 撤回：按额度判定；失效代币无限制（AC-FIN-13 / D-FIN-59） ---- */
function submitWithdraw(pid){
  var p = findProject(pid), d = derive(p);
  var sel = p.tokens.filter(function(t){ return state.wiz.wsel[t.id]; });
  if(!sel.length) return;
  var live = sel.filter(function(t){ return !t.dead; }), liveSum = live.reduce(function(a,t){ return a + t.amt; }, 0);
  if(liveSum > d.wLimit){ render(); return; }   /* 页面上已给出三个数与两条出路 */
  var deadSel = sel.filter(function(t){ return t.dead; });
  confirmChain({
    title:'撤回质押',
    rows:[ ['操作内容', '将 ' + sel.length + ' 张代币从质押合约转回原持有地址', true],
           ['其中有效抵押物', live.length + ' 张 · ' + usd(liveSum), true],
           ['其中已失效代币', deadSel.length + ' 张 · ' + usd(deadSel.reduce(function(a,t){ return a + t.amt; }, 0)) + '（不做额度判定）', true],
           ['目的地址', '质押前的原持有地址（不接受人工指定）', true] ],
    n:sel.length, gas:gasEstimate(sel.length),
    onDone:function(k){
      if(k === 'cancel' || k === 'nogas'){ state.wiz.result = { k:k }; render(); return; }
      if(k === 'ok'){
        var ids = sel.map(function(t){ return t.id; });
        p.tokens = p.tokens.filter(function(t){ return ids.indexOf(t.id) < 0; });
        var dTot = sel.reduce(function(a,t){ return a + t.amt; }, 0);
        var dVoid = deadSel.reduce(function(a,t){ return a + t.amt; }, 0);
        p.events.push({ d:TODAY, k:'withdraw',
          t:'撤回质押 ' + sel.length + ' 张 · ' + usd(dTot), dTotal:-dTot, dVoid:-dVoid,
          note:(deadSel.length ? '其中 ' + deadSel.length + ' 张为已失效代币，不做额度判定直接放行（D-FIN-59）；' : '') +
               '链上转出成功后代币移出池、派生量重算、回到可质押' });
        /* 失效代币不再满足可质押条件，不回到钱包 */
        live.forEach(function(t){ t.ct = 'CT-0'; t.ps = 'PS-1'; WALLET.push(t); });
        state.wiz.result = { k:'ok', n:sel.length, gas:gasEstimate(sel.length) };
      } else {
        /* E-3：代币保持在池，预扣撤销，禁止先置已释放再回滚 */
        state.wiz.result = { k:k, n:sel.length, gas:gasEstimate(sel.length) };
      }
      state.wiz.wsel = {}; render(); window.scrollTo(0, 0);
    }
  });
}

/* ---- 自助提取（D-FIN-57 第二段） ---- */
function openRedeem(){
  if(!REDEEMABLE.length){ toast('当前没有可提取的代币。'); return; }
  var sum = REDEEMABLE.reduce(function(a,t){ return a + t.amt; }, 0);
  confirmChain({
    title:'批量提取已释放代币',
    rows:[ ['操作内容', '将 ' + REDEEMABLE.length + ' 张代币从质押合约转回原持有地址', true],
           ['合计价值', usd(sum)],
           ['来源', '项目结清释放（业务释放已于结清同刻完成，无费用）', true] ],
    n:REDEEMABLE.length, gas:gasEstimate(REDEEMABLE.length),
    onDone:function(k){
      if(k === 'ok'){
        REDEEMABLE.forEach(function(t){ t.ct = 'CT-0'; t.ps = 'PS-1'; t.pending = false; WALLET.push(t); });
        REDEEMABLE.length = 0;
        toast('提取成功：代币已转回原持有地址，重新成为可质押代币。');
      } else if(k === 'cancel' || k === 'nogas'){
        state.wiz.result = { k:k };
      } else {
        /* E-4：提取失败不影响任何项目的额度与状态，业务已在第一段释放完毕，可随时重试 */
        state.wiz.result = { k:k, n:REDEEMABLE.length };
      }
      render(); window.scrollTo(0, 0);
    }
  });
}
