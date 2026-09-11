/* ================================================================
   30-calc.js —— 派生量的唯一实现
   六个派生量、担保档位、可撤回上限只在这里算一次，
   卡片 / 详情 / 发布页 / 两张图全部消费同一份结果（AC-FIN-15 / H-04）。
   原型内为前端即时预览；真实系统提交时一律由服务端权威重算（AC-FIN-06）。
   ================================================================ */

/* ---- 格式化：USD 保留 2 位小数，界面标注币种（AC-FIN-14 / AC-FIN-18） ---- */
function amt(n){
  if(n===null||n===undefined) return '—';
  var neg = n<0; n = Math.abs(n);
  var s = n.toFixed(2), p = s.split('.');
  return (neg?'−':'') + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + p[1];
}
function usd(n){ return n===null||n===undefined ? '—' : amt(n) + ' ' + CCY; }
/* 坐标轴刻度：压缩取整，仅为可读性；精确值见悬浮提示、数据表与键值区 */
function axisAmt(n){
  if(n>=1000000) return '$' + (n/1000000).toFixed(n%1000000===0?0:1) + 'M';
  if(n>=1000)    return '$' + Math.round(n/1000) + 'K';
  return '$' + Math.round(n);
}
function intn(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function shortHash(h){ return h.slice(0,10) + '…' + h.slice(-6); }

/* ---- 日期 ---- */
function dnum(s){ var p=s.split('-'); return Date.UTC(+p[0], +p[1]-1, +p[2]) / 86400000; }
function dstr(n){ var d=new Date(n*86400000);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth()+1).padStart(2,'0') + '-' + String(d.getUTCDate()).padStart(2,'0'); }
function addYears(s, y){ var p=s.split('-'); return (+p[0]+y) + '-' + p[1] + '-' + p[2]; }
function daysTo(s){ return dnum(s) - dnum(TODAY); }
function mdLabel(s){ var p=s.split('-'); return p[1] + '/' + p[2]; }

/* ---- 到期提醒标记（AC-LS-03；触达依赖消息中心，本期只做页面标记） ---- */
function expiryFlag(p){
  if(!p.expiresAt) return null;
  var d = daysTo(p.expiresAt);
  if(d < 0)  return { tone:'mute', t:'已到期', x:'到期日 ' + p.expiresAt };
  if(d <= EXPIRY_NEAR[1]) return { tone:'warn', t:'有效期剩余 ' + d + ' 天', x:'到期前 7 天标记' };
  if(d <= EXPIRY_NEAR[0]) return { tone:'warn', t:'有效期剩余 ' + d + ' 天', x:'到期前 30 天标记' };
  return null;
}

/* ================================================================
   事件流 → 时点序列。两张图、时间线、当前派生量同源。
   ================================================================ */
function seriesOf(p){
  var total=0, dead=0, bal=0, fly=0, pts=[], i;
  for(i=0;i<p.events.length;i++){
    var e = p.events[i];
    total += e.dTotal || 0;
    dead  += e.dVoid  || 0;
    bal   += e.dBal   || 0;
    fly   += e.dFly   || 0;
    pts.push(snap(e.d, total, dead, bal, fly, e));
  }
  /* 末点补到今天，让"当前处于哪一档"在图上有横向宽度可读 */
  var last = pts[pts.length-1];
  if(last && last.d !== TODAY) pts.push(snap(TODAY, total, dead, bal, fly, null));
  return pts;
}
function snap(d, total, dead, bal, fly, ev){
  var valid = total - dead;
  var cap   = round2(valid * PLEDGE_RATE);
  return {
    d:d, x:dnum(d), ev:ev,
    total:total,            /* 池内资产总额 FP-10（含失效，不参与校验） */
    dead:dead,              /* 失效代币价值 FP-19 */
    valid:valid,            /* 有效质押价值 FP-11 —— 一切校验只认这个数 */
    cap:cap,                /* 融资上限 FP-12 = FP-11 × 80% */
    bal:bal,                /* 项目融资余额 FP-13 */
    fly:fly,                /* 项目在途金额 FP-14（唯一来源为发布占用） */
    free:Math.max(0, round2(cap - bal - fly)),   /* 可融金额 FP-15 */
    short:cap < bal          /* 担保不足：融资上限 < 项目融资余额（档③） */
  };
}
function round2(n){ return Math.round(n*100)/100; }

/* ---- 当前派生量 ---- */
function derive(p){
  var pts = seriesOf(p), cur = pts[pts.length-1];
  var g = cur.short ? 'short' : (cur.free === 0 ? 'used-up' : 'normal');
  return {
    pts:pts,
    total:cur.total, dead:cur.dead, valid:cur.valid,
    cap:cur.cap, bal:cur.bal, fly:cur.fly, free:cur.free,
    grade:g,
    gap:      cur.short ? round2(cur.bal - cur.cap) : 0,             /* 担保缺口 FP-21 */
    need:     cur.short ? round2((cur.bal - cur.cap) / PLEDGE_RATE) : 0, /* 需追加资产价值 = 缺口 ÷ 80% */
    shortFrom:shortFrom(pts),
    /* 可撤回上限 FP-16 = 可融金额 ÷ 质押率（AC-FIN-22，AC-FIN-13 的代数变形） */
    wLimit:round2(cur.free / PLEDGE_RATE),
    deadCount:p.tokens.filter(function(t){ return t.dead; }).length,
    liveCount:p.tokens.filter(function(t){ return !t.dead; }).length
  };
}
/* 担保不足起始日：最后一段连续 short 区间的起点 */
function shortFrom(pts){
  var i, from=null;
  for(i=0;i<pts.length;i++){
    if(pts[i].short){ if(from===null) from = pts[i].d; }
    else from = null;
  }
  return from;
}
function gradeOf(p){ return derive(p).grade; }
function gradeMeta(k){ for(var i=0;i<GRADES.length;i++){ if(GRADES[i].k===k) return GRADES[i]; } return GRADES[0]; }

/* ---- 演示用 gas 预估（虚构值，仅用于走通费用区与二次确认） ---- */
function gasEstimate(n){ return (0.00042 * n + 0.00018).toFixed(5); }

/* ================================================================
   available_actions（H-03）
   服务端在每次读取时返回当前可执行动作清单，前端按其渲染、
   不自行依据状态推断；须区分「不可见」与「可见不可点 ⊘」，后者附原因。
   原型内由本函数就地模拟同一份契约。
   ================================================================ */
function availableActions(p, role){
  var d = derive(p), own = (role === 'asset' && p.entity === ACTORS.asset.entity), out = [];
  var guest = (role === 'guest');
  var st = p.status;
  var live = (st==='S-FP-1'||st==='S-FP-2'||st==='S-FP-3'||st==='S-FP-4');

  /* --- 报价：资金方动作，广场唯一对外入口 --- */
  var q = { key:'quote', label:'立即报价', anchor:'quote', primary:true, enabled:false, reason:'' };
  if(guest){
    q.reason = '未登录。登录并以资金方企业主体进入后可发起报价；页面信息 L1～L5 不因未登录而隐藏。';
  } else if(role === 'asset'){
    q.reason = own ? '不能为自己的项目报价。' : '当前企业主体未开通资金方资质，无法发起报价。';
  } else if(p.draft){
    q.reason = '草稿项目不进广场。';
  } else if(d.grade === 'short'){
    q.reason = '该项目处于担保不足预警，已暂停接受新报价（AC-LS-39）。当前担保缺口 ' + usd(d.gap) + '。';
  } else if(p.expired){
    q.reason = '该项目有效期已到期，停止接受新报价；存量融资业务照常履约（D-FIN-43 分支②）。';
  } else if(st === 'S-FP-3'){
    q.reason = '该项目已有在途报价，同一时刻至多承载一笔在途融资业务（D-FIN-33）。';
  } else if(!p.demand){
    q.reason = '该项目当前无在途融资需求。';
  } else if(d.free === 0){
    q.reason = '该项目可融金额为 ' + usd(0) + '，不能再新增占用（AC-FIN-12）。';
  } else if(st !== 'S-FP-2'){
    q.reason = '当前项目状态为「' + FP_STATUS[st].t + '」，只有「募集中」接受新报价。';
  } else {
    q.enabled = true;
  }
  out.push(q);

  /* --- 以下为资产方对自有项目的动作；非本方登录用户不可见（服务端归属过滤 AC-LS-06） --- */
  var mine = own || guest;   /* 游客：可见不可点 + 引导登录（D-LS-04 L6） */
  if(mine && live){
    var pub = { key:'publish', anchor:'publish', enabled:false, reason:'',
                label: st==='S-FP-1' ? '填写金额并发布' : '再次发布 / 管理需求' };
    if(guest)                 pub.reason = '未登录。项目动作仅对该项目所属企业主体开放。';
    else if(p.emptyPool)      pub.reason = '本项目暂无有效质押，请重新质押后再发布（D-FIN-62）。';
    else if(d.valid <= 0)     pub.reason = '有效质押价值为 ' + usd(0) + '，不满足发布校验（D-FIN-61）。';
    else if(p.expired)        pub.reason = '项目已到期，不允许再次发布（D-FIN-43 分支②）。';
    else if(d.free <= 0)      pub.reason = '可融金额为 ' + usd(0) + '，无可发布额度（AC-FIN-12）。';
    else pub.enabled = true;
    out.push(pub);

    out.push({ key:'pledge', anchor:'pledge', label:'追加质押', enabled:!guest, primary:(d.grade==='short'),
               reason: guest ? '未登录。项目动作仅对该项目所属企业主体开放。' : '' });

    var w = { key:'withdraw', anchor:'withdraw', label:'撤回质押', enabled:false, reason:'' };
    if(guest) w.reason = '未登录。项目动作仅对该项目所属企业主体开放。';
    else if(d.wLimit <= 0 && d.deadCount === 0)
      w.reason = '当前可撤回上限为 ' + usd(0) + '（可融金额 ÷ 80%），池内也没有已失效代币，暂无可撤回的代币。'
               + '入口保留可见，不隐藏（H-03）。';
    else w.enabled = true;
    out.push(w);

    var c = { key:'close', anchor:'close', label:'关闭项目', enabled:false, reason:'' };
    if(guest) c.reason = '未登录。项目动作仅对该项目所属企业主体开放。';
    else if(st==='S-FP-3'||st==='S-FP-4') c.reason = '存在在途或未结清融资业务，项目不可关闭（6.1）。';
    else if(d.fly > 0) c.reason = '存在在途占用 ' + usd(d.fly) + '，请先撤下需求再关闭。';
    else c.enabled = true;
    out.push(c);
  }

  /* --- 提取：无可提取代币时不返回该动作，页面不得自行判断（AC-LS-71） --- */
  if(own && REDEEMABLE.length > 0){
    out.push({ key:'redeem', anchor:'redeem', label:'提取已释放代币（' + REDEEMABLE.length + ' 张）', enabled:true, reason:'' });
  }
  return out;
}
function actionOf(list, key){ for(var i=0;i<list.length;i++){ if(list[i].key===key) return list[i]; } return null; }

/* ---- 可见项目集：草稿不进广场（D-FIN-64 / AC-LS-05） ---- */
function plazaProjects(){ return PROJECTS.filter(function(p){ return !p.draft; }); }
function myProjects(){ return PROJECTS.filter(function(p){ return p.entity === ACTORS.asset.entity; }); }
function findProject(id){ for(var i=0;i<PROJECTS.length;i++){ if(PROJECTS[i].id===id) return PROJECTS[i]; } return null; }
