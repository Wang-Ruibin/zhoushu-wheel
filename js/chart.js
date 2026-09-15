/* 咒术转盘 · 维度图：数据汇总、法轮底纹、雷达绘制与自动弹窗节奏
   （阶段 C 从 index.html 内联脚本拆出；仍是无构建普通 <script>，只经 ZW 命名空间互通） */
(function(){
'use strict';
const { FONT, TAU, WFONT, chartDwellSec, clamp, dimsUpTo, gearTick, grownLabel, hasGearSfx, hideToast, isGradeWheel, isOverlayOpen, loadGearSfx, navGoBack, navTo, num, parseGrade, playGearSfx, save, saveSoon, state, toast, ui, uid, wheelById } = ZW;

/* chartAutoTimer / chartFlowDone 是本模块私有；外部（导航返回、调试出口）经这两个助手触碰 */
function chartAutoCancel(){ if (chartAutoTimer) { clearTimeout(chartAutoTimer); chartAutoTimer = null; } }
function chartManualOpen(){ chartAutoCancel(); chartFlowDone = null; }

function chartAutoDwellMs(){
  return Math.round(chartDwellSec(state.settings.chartDwell) * 1000);
}

/* ============================== 数据 ============================== */

const CHART_SHOW_DELAY = 650;      // 抽完之后等多久弹出来（毫秒）；先让结果动效播完

const CHART_RESUME_GAP = 280;      // 收起后等多久再继续下一站（毫秒）；等收起动画走完

let chartAutoTimer = null;

let chartFlowDone = null;          // 自动弹图时「收起之后接着要做什么」（流程继续往下一站）
/* 自动弹出的维度图被收起来了 → 通知流程继续。
   不管是到点自动收、还是用户自己按的关闭/返回，都从这里走；
   否则「用户提前关掉」会把流程永久卡在原地（pendingId 还在、但没有定时器了）。 */

function afterChartDismiss(){
  if (!chartFlowDone) return;
  const done = chartFlowDone;
  chartFlowDone = null;            // 先清再调，避免 done 里再触发一次
  try { done(); } catch(e){}
}
/* 自动弹出某张维度图，停留「设置里的秒数」后自动收起，然后执行 done（流程继续往下走）。
   · 弹出前会等一下（CHART_SHOW_DELAY），让抽奖的结果动效先播完
   · 弹出时刻用户已经开着别的面板 → 不抢焦点，直接把流程交给 done（不卡住）
   · 停留期间用户自己关掉 → 走 afterChartDismiss()，流程照常继续
   · 停留到点时图上又叠了别的面板 → 只认「这张图看过了」，流程交给 done 里的 ZW.continueFlow 兜底 */

function showChartThen(chart, done){
  if (!chart) { if (done) done(); return; }
  clearTimeout(chartAutoTimer);
  chartAutoTimer = setTimeout(() => {
    chartAutoTimer = null;
    if (isOverlayOpen()) { if (done) done(); return; }
    ui.chartItem = chart;
    navTo('chart');
    toast('本站属性维度图 · ' + chartDwellSec(state.settings.chartDwell) + ' 秒后继续', { action:'现在继续', fn:() => navGoBack() });
    chartFlowDone = () => {
      hideToast();
      setTimeout(() => { if (done) done(); }, CHART_RESUME_GAP);
    };
    chartAutoTimer = setTimeout(() => {
      chartAutoTimer = null;
      /* 还停在维度图上 → 正常收起（navGoBack 会走 afterChartDismiss）；
         已经被别的东西盖住了 → 只认「这张图看过了」 */
      if (isOverlayOpen() && ui.view === 'chart' && ui.chartItem === chart) navGoBack();
      else afterChartDismiss();
    }, chartAutoDwellMs());
  }, CHART_SHOW_DELAY);
}
/* 位置正好在某个转盘之后的维度图 */

/* 位置正好在某个转盘之后的维度图 */
function chartAfter(wheelId){
  const hit = (state.charts || []).filter(c => c.after === wheelId);
  return hit.length ? hit[hit.length - 1] : null;
}
/* 流程走到这个转盘时要不要顺手弹一张维度图（开关 + 停留时长都算上） */

/* 流程走到这个转盘时要不要顺手弹一张维度图（开关 + 停留时长都算上） */
function chartMidAt(wheelId){
  if (state.settings.chartMid === false) return null;
  if (!(chartDwellSec(state.settings.chartDwell) > 0)) return null;
  return chartAfter(wheelId);
}
/* 收好尾之后真正跳到下一站：定时器回调、维度图收起回调、手动「→ 下一站」都走这里。
   这一段是从 ZW.flowJump 里抽出来的：多一条路进来就少一个"忘了清 pendingId"的坑。 */

/* 流程走完时：如果有维度图，就自动展示（可在设置里关掉「流程结束时弹出属性维度图」） */
function showChartForEnd(done){
  if (state.settings.chartOnEnd === false) return false;
  const list = state.charts || [];
  if (!list.length) return false;
  const last = list.slice().sort((a, b) => chartSlotIndex(a) - chartSlotIndex(b))[list.length - 1];   // 位置最靠后的那张
  showChartThen(last, done || null);
  return true;
}

function chartDims(){
  const pick = {}, order = [];
  const add = (key, name, label) => {
    const g = parseGrade(label);
    if (g == null || !key) return;
    const w = wheelById(key);
    if (w && !isGradeWheel(w)) return;                              // 非属性盘不计入
    const grown = grownLabel(key, label);                           // ← 叠加本轮成长
    const gg = parseGrade(grown);
    if (gg == null) return;
    if (!pick[key]) order.push(key);
    pick[key] = { wheelId:key, wheel:name, label:grown, grade:gg, value:Math.round(gg * 10) };
  };
  (state.flow.path || []).forEach(p => add(p.wheelId, p.wheel, p.label));
  if (!order.length) {
    const since = state.flow.roundAt || 0;
    (state.history || []).slice(0, 40).forEach(h => { if ((h.at || 0) >= since) add(h.wheelId || h.wheel, h.wheel, h.label); });
  }
  return order.map(k => pick[k]);
}

function chartSummary(dims){
  return '【咒术转盘·本局属性】\n' + dims.map(d => d.wheel + '：' + d.label + '（' + d.value + '）').join('\n');
}
/* 把当前这一局的属性定格下来（流程结束时调用） */

/* 把当前这一局的属性定格下来（流程结束时调用） */
function saveRoundChart(){
  const dims = chartDims();
  if (dims.length < 1) return null;
  state.lastChart = { at: Date.now(), dims:dims };
  saveSoon();
  return state.lastChart;
}
/* 新建一张「属性维度图」：统计列表顺序在 afterId 之前（含）的属性盘，
   没抽到的按 0 算；生成后不再随转盘变化 */

function createChartSnapshot(name, afterId){
  const dims = dimsUpTo(afterId || '');
  /* 只在整个牌组都没有属性盘时才拒绝；放在靠前位置（那一刻还没属性盘）也要允许建，
     这类图的数据在展示时会按「本轮到目前为止」实时统计 */
  if (!dims.length && !(state.wheels || []).some(isGradeWheel)) {
    return { ok:false, msg:'牌组里没有属性转盘（带 E/D/C/B/A/S/SS/SSS/EX 等级的转盘）' };
  }
  const prev = state.charts[state.charts.length - 1] || null;
  const item = {
    id: uid(),
    name: (name && String(name).trim()) || ('属性维度图 ' + (state.charts.length + 1)),
    at: Date.now(),
    after: afterId || '',
    dims: dims.map(d => ({ wheel:d.wheel, label:d.label, value:d.value }))
  };
  state.charts.push(item);
  save();
  return { ok:true, item:item, prev:prev };
}
/* 上一张图（用于「从旧图形变到新图」的动画） */

/* 上一张图（用于「从旧图形变到新图」的动画） */
function prevChartOf(item){
  const i = state.charts.indexOf(item);
  return i > 0 ? state.charts[i - 1] : null;
}

/* ============================== 属性雷达图 ============================== */
/* 维度图配色（可在「设置」页切换） */

/* 维度图配色（可在「设置」页切换） */
const CHART_INKS = [
  ['zhu',  '朱砂', '#B23A2F'],
  ['mo',   '墨黑', '#2A241C'],
  ['qing', '靛青', '#2F5D7C'],
  ['jin',  '赭金', '#A9751F'],
  ['tai',  '苔绿', '#3E6B4A'],
  ['zi',   '紫苑', '#6B4A7C']
];

function chartInkKey(){
  const k = state.settings.chartColor || 'zhu';
  return CHART_INKS.some(x => x[0] === k) ? k : 'zhu';
}

function chartInk(){ return CHART_INKS.filter(x => x[0] === chartInkKey())[0][2]; }
/* 法轮颜色（与维度图颜色分开设置，默认赭金 = 黄铜） */
/* 法轮色板：在维度图六色之外多一个「素白」（深色主题下很亮，浅色主题下是淡淡一层） */

/* 法轮颜色（与维度图颜色分开设置，默认赭金 = 黄铜） */
/* 法轮色板：在维度图六色之外多一个「素白」（深色主题下很亮，浅色主题下是淡淡一层） */
const WHEEL_INKS = CHART_INKS.concat([['bai', '素白', '#FFFFFF']]);

function wheelInkKey(){
  const k = state.settings.wheelColor || 'jin';
  return WHEEL_INKS.some(x => x[0] === k) ? k : 'jin';
}

function wheelInk(){ return WHEEL_INKS.filter(x => x[0] === wheelInkKey())[0][2]; }
/* 明暗调整：amt>0 变亮、<0 变暗 */

/* 明暗调整：amt>0 变亮、<0 变暗 */
function shadeHex(hex, amt){
  const h = String(hex || '#888888').replace('#', '');
  const full = h.length === 3 ? h.replace(/./g, c => c + c) : h;
  const n = parseInt(full, 16) || 0;
  const f = v => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
  return 'rgb(' + f((n >> 16) & 255) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
}
/* 一颗小球（无高光：整体同色，只在边缘轻微压暗，保留一点体积感） */

/* 一颗小球（无高光：整体同色，只在边缘轻微压暗，保留一点体积感） */
function brassBall(ctx, x, y, r, col){
  const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
  g.addColorStop(0, col);
  g.addColorStop(0.82, col);
  g.addColorStop(1, shadeHex(col, -0.14));
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = shadeHex(col, 0.02);
  ctx.lineWidth = Math.max(0.5, r * 0.06);
  ctx.stroke();
}
/* 法轮：八根辐条 + 外环（正好压在 SSS 值上）+ 外圈八颗小球（圆心在 EX 值上）+ 中心球 */

/* 法轮：八根辐条 + 外环（正好压在 SSS 值上）+ 外圈八颗小球（圆心在 EX 值上）+ 中心球 */
const DHARMA_SPOKES = 8;
/* 离屏缓存：法轮先在离屏画布上用 100% 不透明画好，再整体按一次 alpha 贴上来。
   这样辐条、环、小球之间的重叠处不会"叠出"更深的颜色，透明度处处一致 */

let dharmaCache = null;

function dharmaWheelCanvas(R, col){
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const half = R * 1.2 + R * 0.14 + 4;
  const size = Math.max(8, Math.round(half * 2 * dpr));
  const key = [R.toFixed(1), col, dpr].join('|');
  if (dharmaCache && dharmaCache.key === key) return dharmaCache;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c2 = cv.getContext('2d');
  c2.setTransform(dpr, 0, 0, dpr, 0, 0);
  c2.translate(half, half);
  drawDharmaWheel(c2, R, 0, col, 1);
  dharmaCache = { key:key, cv:cv, half:half };
  return dharmaCache;
}

function drawDharmaWheel(ctx, R, deg, col, alpha){
  const A = (alpha == null) ? 0.40 : alpha;   // 半透明
  const ringW = R * 0.040;   // 外环再细一档
  const ballR = R * 0.122;   // 比原来小一点点
  const hubBall = R * 0.148;
  const outerR = R * 1.2;                    // 小球圆心 = EX 值（外环的 1.2 倍）
  const spokeOut = R * 0.060;                // 辐条探出外环的长度（只跟 R 挂钩，调环粗细不会牵连它）
  ctx.save();
  ctx.globalAlpha = A;                        // ← 关键：真正把透明度应用上去
  ctx.rotate(deg * Math.PI / 180);
  // 辐条
  ctx.strokeStyle = shadeHex(col, -0.06);   // 与环比色接近，避免"透明度不一致"的错觉
  ctx.lineWidth = Math.max(2, R * 0.032);
  ctx.lineCap = 'round';
  for (let i = 0; i < DHARMA_SPOKES; i++) {
    const a = -Math.PI / 2 + i * TAU / DHARMA_SPOKES;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * hubBall * 0.95, Math.sin(a) * hubBall * 0.95);   // 从中心球表面出发
    ctx.lineTo(Math.cos(a) * (R + spokeOut), Math.sin(a) * (R + spokeOut));   // 两端同半径，辐条才不歪   // 只探出外环一点点（探出长度 = R × 0.054，只跟 R 挂钩）
    ctx.stroke();
  }
  // 外环（SSS 值压在这条环上）
  const g = ctx.createLinearGradient(-R, -R, R, R);
  g.addColorStop(0, shadeHex(col, 0.18));
  g.addColorStop(0.45, col);
  g.addColorStop(1, shadeHex(col, -0.24));
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU);
  ctx.strokeStyle = g; ctx.lineWidth = ringW; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, R + ringW * 0.52, 0, TAU);
  ctx.strokeStyle = shadeHex(col, -0.16); ctx.lineWidth = Math.max(0.6, R * 0.006); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, R - ringW * 0.52, 0, TAU);
  ctx.strokeStyle = shadeHex(col, -0.14); ctx.lineWidth = Math.max(0.6, R * 0.006); ctx.stroke();
  // 外圈八颗小球
  for (let i = 0; i < DHARMA_SPOKES; i++) {
    const a = -Math.PI / 2 + i * TAU / DHARMA_SPOKES;
    brassBall(ctx, Math.cos(a) * outerR, Math.sin(a) * outerR, ballR, col);
  }
  // 中心球
  brassBall(ctx, 0, 0, hubBall, col);
  ctx.restore();
}
/* 法轮运动，与音效对齐：
   音效 0~2.0s（占 66.5%）是忽高忽低的“咔哒蓄力” → 法轮原地抖动、不产生净旋转；
   2.0~3.0s 转为持续平稳段 → 法轮平滑地逆时针转满 45°。
   分割点由音频包络分析得到（0.665 = 2.0 / 3.0）。 */

const GEAR_TURN_AT = 0.665;

function gearMotion(t){
  if (t <= GEAR_TURN_AT) {                       // 蓄力抖动
    const k = t / GEAR_TURN_AT;
    const deg = Math.sin(k * Math.PI * 26) * 1.2 * (0.3 + 0.7 * k);   // 抖动幅度已减半
    const dy = Math.sin(k * Math.PI * 34) * 0.8 * (0.3 + 0.7 * k);
    const sc = 1 + Math.sin(k * Math.PI * 26) * 0.003;
    return { deg:deg, dy:dy, sc:sc };
  }
  const k = (t - GEAR_TURN_AT) / (1 - GEAR_TURN_AT);   // 真正转动
  const e = 1 - Math.pow(1 - k, 2.6);
  const ripple = Math.sin(k * Math.PI * 6) * 0.7 * (1 - k);   // 极轻的齿轮余韵
  return { deg: -45 * e + ripple, dy: -2 * Math.sin(k * Math.PI) , sc: 1 + 0.012 * Math.sin(k * Math.PI) };
}

function gearAngle(t){ return gearMotion(t).deg; }

function chartColors(){
  const css = getComputedStyle(document.documentElement);
  const g = n => css.getPropertyValue(n).trim();
  return {
    ink: g('--ink') || '#2A241C', accent: chartInk(),
    line: g('--line') || 'rgba(70,56,34,.18)', muted: g('--muted') || '#8B7C65',
    paper: g('--paper') || '#FBF6E9'
  };
}
/* 刻度：外圈 = SSS（90 分）；EX（100）溢出到格外一格（1.2R） */

/* 刻度：外圈 = SSS（90 分）；EX（100）溢出到格外一格（1.2R） */
const CHART_MAX = 90, CHART_OVER = 50;

const GRADE_BASE = 17;                 // E- = 17 分 → 维度图 0 位置

function chartRadiusRatio(v){
  const x = Math.max(0, num(v));
  if (x <= GRADE_BASE) return 0;                                       // E- 及以下都贴中心
  if (x <= CHART_MAX) return (x - GRADE_BASE) / (CHART_MAX - GRADE_BASE);
  return 1 + (x - CHART_MAX) / CHART_OVER;
}

function drawRadar(cv, dims, prog, fromVals, wheelDeg, wheelDy, wheelSc){
  if (!cv || !dims || !dims.length) return;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const W = Math.round(w * dpr), H = Math.round(h * dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const c = chartColors();
  const n = dims.length;
  const cx = w / 2, cy = h / 2;
  const R = (Math.min(w, h) / 2 - 74) / 1.2;          // 给 EX 小球 / 标签留位置
  ctx.save();
  ctx.translate(cx, cy);                                // 法轮画在圆心
  if (wheelDy) ctx.translate(0, wheelDy);               // 蓄力段的上下抖动
  if (wheelSc && wheelSc !== 1) ctx.scale(wheelSc, wheelSc);
  ctx.rotate((wheelDeg || 0) * Math.PI / 180);          // 旋转在贴图这一步做
  const dc = dharmaWheelCanvas(R, wheelInk());
  ctx.globalAlpha = clamp(num(state.settings.wheelAlpha) || 0.40, 0.05, 1);   // 透明度可在设置里调
  ctx.drawImage(dc.cv, -dc.half, -dc.half, dc.half * 2, dc.half * 2);
  ctx.globalAlpha = 1;
  ctx.restore();
  /* 每个轴各自从「上一张图的值」长到「这一张的值」；没有上一张就从 0 长出来 */
  const cur = dims.map((d, i) => {
    const from = fromVals ? num(fromVals[i]) : 0;
    return from + (num(d.value) - from) * prog;
  });
  const vals = cur.map(v => Math.min(chartRadiusRatio(v), 1.2));

  if (n < 3 || R < 24) {            // 少于 3 个维度画不了雷达 → 用条形
    const rowH = Math.min(46, (h - 10) / Math.max(1, n));
    dims.forEach((d, i) => {
      const y = 8 + i * rowH;
      ctx.font = '600 12.5px ' + FONT; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillStyle = c.ink; ctx.fillText(String(d.wheel).slice(0, 8), 4, y + 8);
      ctx.textAlign = 'right'; ctx.fillStyle = c.accent;
      ctx.font = '700 14px ' + WFONT;
      ctx.fillText(d.label.split('（')[0], w - 4, y + 8);
      const bx = 4, bw = w - 8, by = y + 20;
      ctx.fillStyle = c.line; ctx.fillRect(bx, by, bw, 8);
      ctx.fillStyle = c.accent; ctx.fillRect(bx, by, bw * (vals[i] / 1.2), 8);   // vals 已按新刻度算过
    });
    return;
  }
  const pt = (i, r) => {
    const a = -Math.PI / 2 + i * TAU / n;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const poly = r => {
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const p = pt(i, typeof r === 'function' ? r(i) : r); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    ctx.closePath();
  };
  // 网格：每一圈正好落在某个等级上（E=20 … SSS=90），方便对照等级
  const RING_GRADES = [['E',20],['D',30],['C',40],['B',50],['A',60],['S',70],['SS',80],['SSS',90]];
  RING_GRADES.forEach(([name, v], k) => {
    const isTop = v === CHART_MAX;
    poly(R * chartRadiusRatio(v));
    ctx.strokeStyle = isTop ? c.ink : c.line;
    ctx.globalAlpha = isTop ? 0.5 : 1;
    ctx.setLineDash(isTop ? [] : [3, 4]);
    ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  });
  // 等级刻度：写在正上方那根轴上（左侧），对齐它所在的圈
  {
    const fs = Math.max(8, R * 0.085);
    ctx.font = '600 ' + fs.toFixed(1) + 'px ' + FONT;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillStyle = c.muted;
    RING_GRADES.forEach(([name, v]) => {
      ctx.globalAlpha = (v === CHART_MAX) ? 0.9 : 0.72;
      ctx.fillText(name, -R * 0.045, -R * chartRadiusRatio(v));
    });
    ctx.globalAlpha = 0.55;                       // 中心 = E-
    ctx.fillText('E-', -R * 0.045, -R * 0.2);
    ctx.globalAlpha = 1;
  }
  for (let k = 1; k <= 0; k++) {
    poly(R * k / 1);
    ctx.strokeStyle = k === rings ? c.ink : c.line;
    ctx.globalAlpha = k === rings ? 0.5 : 1;
    ctx.setLineDash(k === rings ? [] : [3, 4]);
    ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  // EX 线（格外一格）
  poly(1.2 * R);
  ctx.strokeStyle = c.accent; ctx.globalAlpha = 0.45;   // EX 大圆环：恢复到看得清
  ctx.lineWidth = Math.max(0.8, R * 0.008);
  ctx.setLineDash([2, 5]); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  // 轴线
  ctx.strokeStyle = c.line; ctx.setLineDash([3, 4]);
  for (let i = 0; i < n; i++) { const p = pt(i, R); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p[0], p[1]); ctx.stroke(); }
  ctx.setLineDash([]);
  // 数值多边形
  poly(i => R * vals[i]);
  ctx.fillStyle = c.accent; ctx.globalAlpha = 0.22; ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = c.accent; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.stroke();
  // 顶点
  for (let i = 0; i < n; i++) {
    const p = pt(i, R * vals[i]);
    ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, TAU); ctx.fillStyle = c.accent; ctx.fill();
    ctx.beginPath(); ctx.arc(p[0], p[1], 1.6, 0, TAU); ctx.fillStyle = c.paper; ctx.fill();
  }
  // 标签：转盘名 + 等级（不显示数字）；统一放在 EX 外圈之外，避免和溢出的顶点重叠
  const LR = R * 1.2 + R * 0.122 + 16;   // 让开外圈小球
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * TAU / n;
    const lx = cx + Math.cos(a) * LR, ly = cy + Math.sin(a) * LR;
    const cos = Math.cos(a);
    ctx.textAlign = Math.abs(cos) < 0.25 ? 'center' : (cos > 0 ? 'left' : 'right');
    ctx.textBaseline = 'middle';
    const avail = Math.abs(cos) < 0.25 ? (w / 2 - 8) : (cos > 0 ? (w - lx - 6) : (lx - 6));
    const nameTxt = String(dims[i].wheel).slice(0, 7);
    const valTxt = dims[i].label.split('（')[0];        // 只留等级，如 EX / SSS
    let fs1 = 11;
    ctx.font = '600 ' + fs1 + 'px ' + FONT;
    while (fs1 > 8 && ctx.measureText(nameTxt).width > avail) { fs1 -= 0.5; ctx.font = '600 ' + fs1 + 'px ' + FONT; }
    ctx.fillStyle = c.muted;
    ctx.fillText(nameTxt, lx, ly - 9);
    let fs2 = 14;
    ctx.font = '700 ' + fs2 + 'px ' + WFONT;
    while (fs2 > 9 && ctx.measureText(valTxt).width > avail) { fs2 -= 0.5; ctx.font = '700 ' + fs2 + 'px ' + WFONT; }
    ctx.fillStyle = c.accent;
    ctx.fillText(valTxt, lx, ly + 8);
  }
}

let chartRaf = 0;

function startChartAnim(cv, dims, fromDims){
  cancelAnimationFrame(chartRaf);
  const fromMap = {};
  (fromDims || []).forEach(d => { fromMap[d.wheel] = num(d.value); });
  const fromVals = dims.map(d => (fromMap[d.wheel] != null ? fromMap[d.wheel] : 0));
  const hasPrev = (fromDims || []).length > 0;
  const t0 = performance.now(), dur = 3000;         // 和音效等长（3 秒）
  const growth = GEAR_TURN_AT;                      // 数据图形在蓄力段就长好
  loadGearSfx();
  let played = playGearSfx();
  let triedSynth = false;
  (function frame(now){
    const t = clamp((now - t0) / dur, 0, 1);       // 钳到 0~1，避免时钟差异算出负进度
    if (!played) {                                  // 真音效还没解码好：等着补播，绝不误用合成音
      loadGearSfx();
      played = playGearSfx();
      if (!played && !hasGearSfx() && !triedSynth) { triedSynth = true; gearTick(); }
    }
    const gm = gearMotion(t);
    drawRadar(cv, dims, clamp(t / growth, 0, 1), fromVals, gm.deg, gm.dy, gm.sc);   // 法轮：前段抖动、后段转 45°
    if (t < 1) chartRaf = requestAnimationFrame(frame);
  })(t0);
}

/* 只展示图：标题 + 雷达图（管理/删除都在「记录」页的列表里） */
function chartLiveDims(item){
  const full = chartDims();                       // 本轮到目前为止抽过的全部属性
  if (!item) return dimsUpTo('');
  const a = (item.after == null) ? '' : item.after;
  /* ① 放在「列表最前 / 所有转盘之后」→ 这两处本来就是"整轮"的位置，直接统计本轮全部 */
  if (a === '__top__' || !a) return full.length ? full : (item.dims || []);
  /* ② 指定了某个转盘之后 → 只统计它之前的属性盘（没抽到的显示 0，这是刻意的：
        位置靠前的图本来就该是"那一刻的快照"，只有 0 才是真实情况） */
  const scoped = dimsUpTo(a);
  if (scoped.length) return scoped;
  /* ③ 那个范围里一个属性盘都没有（比如放在成长盘后面，属性盘还在更后面）→
        退回本轮全部，否则这张图永远是空的 */
  return full.length ? full : (item.dims || []);
}

/* 维度图的位置：'__top__' 最前 → 各转盘之后 → '' 最后 */
function chartSlots(){ return ['__top__'].concat(state.wheels.map(w => w.id)).concat(['']); }

function chartSlotIndex(c){ const s = chartSlots(); const a = (c.after == null) ? '' : c.after; const i = s.indexOf(a); return i < 0 ? s.length - 1 : i; }

function moveChart(c, dir){
  const s = chartSlots();
  const i = clamp(chartSlotIndex(c) + dir, 0, s.length - 1);
  c.after = s[i];
  save();
  return i;
}

function chartPositionText(c){
  const a = (c.after == null) ? '' : c.after;
  if (a === '__top__') return '列表最前';
  if (!a) return '所有转盘之后';
  const w = wheelById(a);
  return w ? ('「' + w.name + '」之后') : '所有转盘之后';
}

Object.assign(ZW, { chartAutoDwellMs, CHART_SHOW_DELAY, CHART_RESUME_GAP, chartAutoTimer, chartFlowDone, afterChartDismiss, showChartThen, chartAfter, chartMidAt, showChartForEnd, chartDims, chartSummary, saveRoundChart, createChartSnapshot, prevChartOf, CHART_INKS, chartInkKey, chartInk, WHEEL_INKS, wheelInkKey, wheelInk, shadeHex, brassBall, DHARMA_SPOKES, dharmaCache, dharmaWheelCanvas, drawDharmaWheel, GEAR_TURN_AT, gearMotion, gearAngle, chartColors, CHART_MAX, CHART_OVER, GRADE_BASE, chartRadiusRatio, drawRadar, chartRaf, startChartAnim, chartLiveDims, chartSlots, chartSlotIndex, moveChart, chartPositionText, chartAutoCancel, chartManualOpen });
})();
