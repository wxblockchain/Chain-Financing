/* ================================================================
   50-charts.js —— P-LS-02 详情页两张图
   图 1 池内资产变动：有效质押价值 + 失效代币价值 = 池内资产总额（堆叠阶梯面积）
   图 2 融资变动：融资上限（线）vs 项目融资余额 + 项目在途金额（堆叠阶梯面积）
   四个量口径互不混用；担保不足（融资上限 < 项目融资余额）在图 2 上有独立区间。
   两图共用 30-calc.js 的同一份 seriesOf()，与页面数字同源。
   数值为阶梯：一次事件改变一次取值，事件之间保持不变——这就是业务的真实形状。
   ================================================================ */

var CHART_H = 206, CH_M = { l:72, r:114, t:16, b:38 };

function niceTicks(max, n){
  var raw = max / n, mag = Math.pow(10, Math.floor(Math.log(raw)/Math.LN10)), norm = raw / mag;
  var step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 4 ? 4 : norm <= 5 ? 5 : 10) * mag;
  var out = [], v = 0;
  while(v <= max + 1e-6){ out.push(v); v = round2(v + step); }
  return out;
}
function monthTicks(x0, x1){
  var out = [], d = new Date(x0 * 86400000);
  d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  while(d.getTime()/86400000 <= x1){
    var v = d.getTime()/86400000;
    if(v >= x0) out.push(v);
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 1));
  }
  if(out.length > 8) out = out.filter(function(_,i){ return i % 2 === 0; });
  return out;
}

function stepFwd(pts, get, X, Y){
  var d = '', i;
  for(i=0;i<pts.length;i++){
    var y = Y(get(pts[i])).toFixed(1), x = X(pts[i].x).toFixed(1);
    d += (i===0 ? 'M' : 'L') + x + ',' + y;
    if(i < pts.length-1) d += 'L' + X(pts[i+1].x).toFixed(1) + ',' + y;
  }
  return d;
}
function stepBack(pts, get, X, Y){
  var d = '', i, n = pts.length;
  d += 'L' + X(pts[n-1].x).toFixed(1) + ',' + Y(get(pts[n-1])).toFixed(1);
  for(i=n-2;i>=0;i--){
    d += 'L' + X(pts[i+1].x).toFixed(1) + ',' + Y(get(pts[i])).toFixed(1);
    d += 'L' + X(pts[i].x).toFixed(1)   + ',' + Y(get(pts[i])).toFixed(1);
  }
  return d;
}
var zero = function(){ return 0; };

/* 端点直标：色块携带身份，文字一律用墨色 token；同栏标签自动避让，不叠字 */
function endLabels(x, items){
  var minY = CH_M.t + 10, maxY = CHART_H - CH_M.b - 6, gap = 30, i;
  items = items.slice().sort(function(a,b){ return a.y - b.y; });
  for(i=0;i<items.length;i++){
    items[i].ly = Math.max(minY, items[i].y);
    if(i > 0 && items[i].ly - items[i-1].ly < gap) items[i].ly = items[i-1].ly + gap;
  }
  for(i=items.length-1;i>=0;i--){
    if(items[i].ly > maxY) items[i].ly = maxY;
    if(i < items.length-1 && items[i+1].ly - items[i].ly < gap) items[i].ly = items[i+1].ly - gap;
  }
  return items.map(function(it){
    var lead = (Math.abs(it.ly - it.y) > 3)
      ? '<path d="M' + (x+1).toFixed(1) + ',' + it.y.toFixed(1) + 'L' + (x+6).toFixed(1) + ',' + it.ly.toFixed(1) +
        '" stroke="var(--line-strong)" stroke-width="1" fill="none"></path>' : '';
    return lead + '<g transform="translate(' + (x+9).toFixed(1) + ',' + it.ly.toFixed(1) + ')">' +
      '<rect x="0" y="-8" width="9" height="9" rx="2" fill="' + it.sw + '"></rect>' +
      '<text x="13" y="0" font-size="11" fill="var(--ink)" font-weight="600" font-family="var(--num)">' + axisAmt(it.val) + '</text>' +
      '<text x="0"  y="13" font-size="10.5" fill="var(--ink-3)">' + esc(it.name) + '</text></g>';
  }).join('');
}

function chartFrame(uid, W, yTicks, yMax, xTicks, X, Y){
  var g = '', i;
  for(i=0;i<yTicks.length;i++){
    var y = Y(yTicks[i]).toFixed(1);
    g += '<line x1="' + CH_M.l + '" y1="' + y + '" x2="' + (W - CH_M.r) + '" y2="' + y +
         '" stroke="var(--grid)" stroke-width="1"></line>' +
         '<text x="' + (CH_M.l - 9) + '" y="' + y + '" dy="3.5" text-anchor="end" font-size="10.5" ' +
         'fill="var(--axis-ink)" font-family="var(--num)">' + axisAmt(yTicks[i]) + '</text>';
  }
  for(i=0;i<xTicks.length;i++){
    var x = X(xTicks[i]).toFixed(1);
    g += '<text x="' + x + '" y="' + (CHART_H - CH_M.b + 18) + '" text-anchor="middle" font-size="10.5" ' +
         'fill="var(--axis-ink)" font-family="var(--num)">' + mdLabel(dstr(xTicks[i])) + '</text>';
  }
  g += '<line x1="' + CH_M.l + '" y1="' + Y(0) + '" x2="' + (W - CH_M.r) + '" y2="' + Y(0) +
       '" stroke="var(--axis)" stroke-width="1"></line>';
  return g;
}

/* ---- 图 1：池内资产变动 ---- */
function chartPool(uid, pts, W){
  var x0 = pts[0].x, x1 = pts[pts.length-1].x;
  if(x1 <= x0) x1 = x0 + 30;
  var PW = W - CH_M.l - CH_M.r, PH = CHART_H - CH_M.t - CH_M.b;
  var yMax = Math.max.apply(null, pts.map(function(p){ return p.total; })) * 1.14 || 1;
  var X = function(v){ return CH_M.l + (v - x0) / (x1 - x0) * PW; };
  var Y = function(v){ return CH_M.t + PH - v / yMax * PH; };
  var cur = pts[pts.length-1];
  var s = '';

  s += '<defs><pattern id="hatchVoid' + uid + '" width="7" height="7" patternTransform="rotate(135)" patternUnits="userSpaceOnUse">' +
       '<rect width="7" height="7" fill="var(--s-void-fill)"></rect>' +
       '<line x1="0" y1="0" x2="0" y2="7" stroke="var(--s-void)" stroke-width="1.4" opacity=".55"></line></pattern></defs>';
  s += chartFrame(uid, W, niceTicks(yMax, 4), yMax, monthTicks(x0, x1), X, Y);

  /* 事件竖线 */
  pts.forEach(function(p){
    if(!p.ev) return;
    s += '<line x1="' + X(p.x).toFixed(1) + '" y1="' + CH_M.t + '" x2="' + X(p.x).toFixed(1) + '" y2="' + Y(0) +
         '" stroke="var(--grid)" stroke-width="1" stroke-dasharray="2 3"></line>';
  });

  /* 有效质押价值（底层，计入担保） */
  s += '<path d="' + stepFwd(pts, function(p){ return p.valid; }, X, Y) + stepBack(pts, zero, X, Y) +
       'Z" fill="var(--s1-fill)"></path>';
  /* 失效代币价值（上层，不计入担保）—— 中性灰 + 斜纹，双通道编码 */
  s += '<path d="' + stepFwd(pts, function(p){ return p.total; }, X, Y) +
       stepBack(pts, function(p){ return p.valid; }, X, Y) + 'Z" fill="url(#hatchVoid' + uid + ')"></path>';
  /* 池内资产总额：堆叠顶缘，虚线。先画它，失效为 0 的区段由下面的实线盖住，避免蓝线看起来是虚的 */
  s += '<path d="' + stepFwd(pts, function(p){ return p.total; }, X, Y) +
       '" fill="none" stroke="var(--s-void)" stroke-width="1.5" stroke-dasharray="5 3"></path>';
  /* 堆叠分界：先铺 3px 底色留缝，再描 1.9px 系列线 */
  s += '<path d="' + stepFwd(pts, function(p){ return p.valid; }, X, Y) + '" fill="none" stroke="var(--card)" stroke-width="3.4"></path>';
  s += '<path d="' + stepFwd(pts, function(p){ return p.valid; }, X, Y) + '" fill="none" stroke="var(--s1)" stroke-width="1.9" stroke-linejoin="round"></path>';

  /* 事件点 */
  pts.forEach(function(p){
    if(!p.ev) return;
    s += '<circle cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.total).toFixed(1) +
         '" r="3.6" fill="var(--card)" stroke="var(--s-void)" stroke-width="1.8"></circle>';
  });

  /* 失效起点标注 */
  var firstDead = null;
  pts.forEach(function(p){ if(firstDead === null && p.dead > 0) firstDead = p; });
  if(firstDead){
    s += '<line x1="' + X(firstDead.x).toFixed(1) + '" y1="' + (CH_M.t - 2) + '" x2="' + X(firstDead.x).toFixed(1) +
         '" y2="' + Y(0) + '" stroke="var(--s-void)" stroke-width="1.2" stroke-dasharray="3 3"></line>' +
         '<text x="' + (X(firstDead.x) + 6).toFixed(1) + '" y="' + (CH_M.t + 10) + '" font-size="10.5" fill="var(--ink-2)">' +
         '底层资产失效 ' + firstDead.d + '</text>';
  }

  var labels = [{ y:Y(cur.valid), sw:'var(--s1)', name:'有效质押价值', val:cur.valid }];
  if(cur.dead > 0) labels.push({ y:Y(cur.total), sw:'var(--s-void)', name:'池内资产总额', val:cur.total });
  s += endLabels(X(x1), labels);

  return { svg:s, W:W, X:X, Y:Y, x0:x0, x1:x1 };
}

/* ---- 图 2：融资变动 ---- */
function chartFin(uid, pts, W){
  var x0 = pts[0].x, x1 = pts[pts.length-1].x;
  if(x1 <= x0) x1 = x0 + 30;
  var PW = W - CH_M.l - CH_M.r, PH = CHART_H - CH_M.t - CH_M.b;
  var yMax = Math.max.apply(null, pts.map(function(p){ return Math.max(p.cap, p.bal + p.fly); })) * 1.18 || 1;
  var X = function(v){ return CH_M.l + (v - x0) / (x1 - x0) * PW; };
  var Y = function(v){ return CH_M.t + PH - v / yMax * PH; };
  var cur = pts[pts.length-1];
  var s = '';

  s += '<defs><pattern id="hatchGap' + uid + '" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">' +
       '<rect width="7" height="7" fill="var(--st-crit-wash)"></rect>' +
       '<line x1="0" y1="0" x2="0" y2="7" stroke="var(--st-crit)" stroke-width="1.4" opacity=".45"></line></pattern></defs>';
  s += chartFrame(uid, W, niceTicks(yMax, 4), yMax, monthTicks(x0, x1), X, Y);

  /* 担保不足区间：融资上限 < 项目融资余额 的连续区段 —— 先铺底，图形压在上面 */
  var bands = [], i, open = null;
  for(i=0;i<pts.length;i++){
    if(pts[i].short && open === null) open = pts[i];
    if(!pts[i].short && open !== null){ bands.push([open, pts[i]]); open = null; }
  }
  if(open !== null) bands.push([open, pts[pts.length-1]]);
  bands.forEach(function(b){
    var bx = X(b[0].x), bw = Math.max(2, X(b[1].x) - bx);
    s += '<rect x="' + bx.toFixed(1) + '" y="' + CH_M.t + '" width="' + bw.toFixed(1) + '" height="' + PH +
         '" fill="url(#hatchGap' + uid + ')"></rect>' +
         '<line x1="' + bx.toFixed(1) + '" y1="' + CH_M.t + '" x2="' + bx.toFixed(1) + '" y2="' + Y(0) +
         '" stroke="var(--st-crit)" stroke-width="1.4"></line>';
  });

  pts.forEach(function(p){
    if(!p.ev) return;
    s += '<line x1="' + X(p.x).toFixed(1) + '" y1="' + CH_M.t + '" x2="' + X(p.x).toFixed(1) + '" y2="' + Y(0) +
         '" stroke="var(--grid)" stroke-width="1" stroke-dasharray="2 3"></line>';
  });

  /* 项目融资余额（底层） */
  s += '<path d="' + stepFwd(pts, function(p){ return p.bal; }, X, Y) + stepBack(pts, zero, X, Y) +
       'Z" fill="var(--s2-fill)"></path>';
  /* 项目在途金额（堆在余额之上，两条线因此可分辨） */
  s += '<path d="' + stepFwd(pts, function(p){ return p.bal + p.fly; }, X, Y) +
       stepBack(pts, function(p){ return p.bal; }, X, Y) + 'Z" fill="var(--s3-fill)"></path>';
  s += '<path d="' + stepFwd(pts, function(p){ return p.bal; }, X, Y) + '" fill="none" stroke="var(--card)" stroke-width="3.4"></path>';
  s += '<path d="' + stepFwd(pts, function(p){ return p.bal; }, X, Y) + '" fill="none" stroke="var(--s2)" stroke-width="1.9" stroke-linejoin="round"></path>';
  s += '<path d="' + stepFwd(pts, function(p){ return p.bal + p.fly; }, X, Y) + '" fill="none" stroke="var(--s3)" stroke-width="1.9" stroke-linejoin="round"></path>';
  /* 融资上限：主线，比两条面积更重 */
  s += '<path d="' + stepFwd(pts, function(p){ return p.cap; }, X, Y) +
       '" fill="none" stroke="var(--card)" stroke-width="4"></path>';
  s += '<path d="' + stepFwd(pts, function(p){ return p.cap; }, X, Y) +
       '" fill="none" stroke="var(--s1)" stroke-width="2.4" stroke-linejoin="round"></path>';

  /* 跨线点：担保不足起点 */
  bands.forEach(function(b){
    var bx = X(b[0].x);
    s += '<circle cx="' + bx.toFixed(1) + '" cy="' + Y(b[0].cap).toFixed(1) +
         '" r="5" fill="var(--card)" stroke="var(--st-crit)" stroke-width="2.4"></circle>' +
         '<text x="' + (bx + 9).toFixed(1) + '" y="' + (CH_M.t + 11) + '" font-size="10.5" fill="var(--st-crit)" font-weight="700">' +
         '担保不足区间 · 自 ' + b[0].d + ' 起</text>' +
         '<text x="' + (bx + 9).toFixed(1) + '" y="' + (CH_M.t + 24) + '" font-size="10.5" fill="var(--ink-2)">' +
         '融资上限跌破项目融资余额</text>';
  });

  /* 可融金额：末端的上限线与占用顶之间的竖向标注 */
  if(cur.free > 0){
    var fx = X(x1) - 14, yTop = Y(cur.cap), yBot = Y(cur.bal + cur.fly);
    s += '<line x1="' + fx.toFixed(1) + '" y1="' + yTop.toFixed(1) + '" x2="' + fx.toFixed(1) + '" y2="' + yBot.toFixed(1) +
         '" stroke="var(--ink-3)" stroke-width="1"></line>' +
         '<line x1="' + (fx-4).toFixed(1) + '" y1="' + yTop.toFixed(1) + '" x2="' + (fx+4).toFixed(1) + '" y2="' + yTop.toFixed(1) + '" stroke="var(--ink-3)" stroke-width="1"></line>' +
         '<line x1="' + (fx-4).toFixed(1) + '" y1="' + yBot.toFixed(1) + '" x2="' + (fx+4).toFixed(1) + '" y2="' + yBot.toFixed(1) + '" stroke="var(--ink-3)" stroke-width="1"></line>' +
         '<text x="' + (fx-7).toFixed(1) + '" y="' + ((yTop+yBot)/2).toFixed(1) + '" dy="3.5" text-anchor="end" font-size="10.5" fill="var(--ink-2)">可融</text>';
  }

  var labels = [{ y:Y(cur.cap), sw:'var(--s1)', name:'融资上限', val:cur.cap },
                { y:Y(cur.bal), sw:'var(--s2)', name:'项目融资余额', val:cur.bal }];
  if(cur.fly > 0) labels.push({ y:Y(cur.bal + cur.fly), sw:'var(--s3)', name:'项目在途金额', val:cur.fly });
  s += endLabels(X(x1), labels);

  return { svg:s, W:W, X:X, Y:Y, x0:x0, x1:x1 };
}

/* ---- 悬浮层：十字线 + 全序列读数（线/面积图默认带交互） ---- */
function attachHover(wrapId, pts, built, kind){
  var wrap = document.getElementById(wrapId);
  if(!wrap) return;
  var svg = wrap.querySelector('svg'), tip = wrap.querySelector('.chart-tip');
  var cross = svg.querySelector('.cross');
  function idxAt(px){
    var i, last = 0;
    for(i=0;i<pts.length;i++){ if(built.X(pts[i].x) <= px + 0.5) last = i; }
    return last;
  }
  function move(e){
    var r = svg.getBoundingClientRect(), px = e.clientX - r.left;
    if(px < CH_M.l || px > built.W - CH_M.r){ leave(); return; }
    var i = idxAt(px), p = pts[i], cx = built.X(p.x);
    cross.setAttribute('transform', 'translate(' + cx.toFixed(1) + ',0)');
    cross.style.display = '';
    var rows;
    if(kind === 'pool'){
      rows = [['var(--s1)','有效质押价值', p.valid], ['var(--s-void)','失效代币价值（不计入担保）', p.dead], [null,'池内资产总额', p.total]];
    } else {
      rows = [['var(--s1)','融资上限', p.cap], ['var(--s2)','项目融资余额', p.bal], ['var(--s3)','项目在途金额', p.fly], [null,'可融金额', p.free]];
    }
    tip.innerHTML = '<div class="dt">' + p.d + ' · ' + TZ_LABEL + '</div>' +
      rows.map(function(r){
        return '<div class="r"><span class="lf">' + (r[0] ? '<i style="background:' + r[0] + '"></i>' : '<i style="background:transparent"></i>') +
          esc(r[1]) + '</span><b>' + amt(r[2]) + '</b></div>';
      }).join('') +
      (kind === 'fin' && p.short ? '<div class="ev" style="color:var(--st-crit)">担保不足：融资上限 < 项目融资余额，缺口 ' + amt(p.bal - p.cap) + ' ' + CCY + '</div>' : '') +
      (p.ev ? '<div class="ev"><b>' + esc(p.ev.t) + '</b>' + (p.ev.note ? '<br>' + esc(p.ev.note) : '') + '</div>' : '');
    var tw = tip.offsetWidth || 240;
    var left = cx + 14; if(left + tw > built.W - 6) left = cx - tw - 14;
    tip.style.left = Math.max(6, left) + 'px';
    tip.style.top  = (CH_M.t + 6) + 'px';
    tip.classList.add('on');
  }
  function leave(){ tip.classList.remove('on'); if(cross) cross.style.display = 'none'; }
  svg.addEventListener('mousemove', move);
  svg.addEventListener('mouseleave', leave);
}

/* ---- 两张图合成一张卡片 ----
   上一版两张图各占一张大卡（合计 ~900px），在详情页里压过了三数与操作区。
   本版合成一张卡、单图高度 252 → 206、去掉每图的边框与底部大段读法块，
   数据表下沉到折叠层：图仍然完整可读，但不再是页面上最重的东西。 */
function chartBody(p, kind){
  var d = derive(p), pts = d.pts, uid = kind + '-' + p.id.replace(/[^A-Za-z0-9]/g,'');
  var isPool = (kind === 'pool');
  var legend = isPool
    ? '<span><i class="s1"></i>有效质押价值（计入担保）</span>' +
      '<span><i class="void"></i>失效代币价值（不计入担保）</span>' +
      '<span><i class="dash"></i>池内资产总额</span>'
    : '<span><i class="l s1l"></i>融资上限（＝有效质押价值 × ' + (PLEDGE_RATE*100) + '%）</span>' +
      '<span><i class="s2"></i>项目融资余额</span>' +
      '<span><i class="s3"></i>项目在途金额</span>' +
      '<span><i class="gap"></i>担保不足区间</span>';
  var read = isPool
    ? '蓝色是<b>参与计算</b>的部分，灰斜纹是<b>因底层应收账款失效而不计入担保</b>的部分，两者之和才是账面的池内资产总额。'
    : '面积顶到蓝线之间的空隙就是<b>可融金额</b>；<b>橙色面积高过蓝线的那一段就是担保不足</b>——判据只比项目融资余额，不含在途。';
  var tbl = '<div class="tscroll"><table class="dt"><thead><tr><th>日期</th>' +
    (isPool ? '<th class="n">有效质押价值</th><th class="n">失效代币价值</th><th class="n">池内资产总额</th>'
            : '<th class="n">融资上限</th><th class="n">项目融资余额</th><th class="n">项目在途金额</th><th class="n">可融金额</th>') +
    '<th>事件</th></tr></thead><tbody>' +
    pts.map(function(q){
      return '<tr><td class="n">' + q.d + '</td>' +
        (isPool ? '<td class="n">' + amt(q.valid) + '</td><td class="n">' + amt(q.dead) + '</td><td class="n">' + amt(q.total) + '</td>'
                : '<td class="n">' + amt(q.cap) + '</td><td class="n">' + amt(q.bal) + '</td><td class="n">' + amt(q.fly) + '</td><td class="n">' + amt(q.free) + '</td>') +
        '<td>' + (q.ev ? esc(q.ev.t) : '当前（' + TODAY + '）') + '</td></tr>';
    }).join('') + '</tbody></table></div>';

  return '<div class="cbody">' +
    '<div class="chart-head"><div><h3>' + (isPool ? '池内资产变动' : '融资变动') + '</h3>' +
      '<p>' + (isPool ? '池子里有多少钱、其中多少还顶用' : '额度被什么消耗、还剩多少、什么时候跨过担保线') +
      '。单位 ' + CCY + '，刻度为压缩取整，精确值见悬浮读数与数据表。</p></div></div>' +
    '<div class="chart-legend">' + legend + '</div>' +
    '<div class="chart-wrap" id="wrap-' + uid + '"><div class="chart-tip"></div></div>' +
    '<div class="chart-rd">读法：' + read + '</div>' +
    '<div style="padding:0 24px 6px">' + fold('数据表 · ' + (isPool ? '池内资产' : '融资') + '逐时点数值', pts.length + ' 行', tbl) + '</div>' +
  '</div>';
}
function chartPairCard(p){
  return '<div class="card chart-pair">' + chartBody(p, 'pool') + chartBody(p, 'fin') + '</div>';
}

/* ---- 挂载 / 重绘（宽度变化时重算像素，不做缩放变形） ---- */
var mountedCharts = [];
function drawCharts(){
  mountedCharts.forEach(function(m){
    var wrap = document.getElementById('wrap-' + m.uid);
    if(!wrap) return;
    var W = Math.max(560, wrap.clientWidth);
    var built = (m.kind === 'pool') ? chartPool(m.uid, m.pts, W) : chartFin(m.uid, m.pts, W);
    var tip = wrap.querySelector('.chart-tip');
    wrap.innerHTML = '<svg class="chart-svg" width="' + W + '" height="' + CHART_H + '" role="img" aria-label="' +
      (m.kind === 'pool' ? '池内资产变动阶梯面积图' : '融资变动图') + '，精确数值见同卡片的数据表">' + built.svg +
      '<g class="cross" style="display:none"><line x1="0" y1="' + CH_M.t + '" x2="0" y2="' + (CHART_H - CH_M.b) +
      '" stroke="var(--ink-3)" stroke-width="1" stroke-dasharray="3 3"></line></g></svg>';
    wrap.appendChild(tip);
    attachHover('wrap-' + m.uid, m.pts, built, m.kind);
  });
}
function registerChart(p, kind){
  mountedCharts.push({ uid:kind + '-' + p.id.replace(/[^A-Za-z0-9]/g,''), pts:derive(p).pts, kind:kind });
}
var rsz = null;
window.addEventListener('resize', function(){ clearTimeout(rsz); rsz = setTimeout(drawCharts, 120); });
