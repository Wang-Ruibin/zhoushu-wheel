/* 咒术转盘 · 转盘画布：DOM 捕获、尺寸适配、墨线绘制与重绘调度
   （阶段 C 从 index.html 内联脚本拆出；仍是无构建普通 <script>，只经 ZW 命名空间互通） */
(function(){
'use strict';
const { $, FONT, TAU, WFONT, activeOptions, clamp, currentWheel, layoutSectors, norm, seed, state, textOn } = ZW;

const core = ZW.core;

let wheelSize = 0;                     // 逻辑边长同时同步到 core.wheelSize（别的模块要用）

function getRot(){ return core.rot; }

function setRot(v){ core.rot = v; }
/* 给 js/spin.js 用的读写口 + 重绘触发（模块之间只通过这些函数来往，不碰内部变量） */
Object.assign(ZW.rot = ZW.rot || {}, { get:getRot, set:setRot });

const canvas = $('#wheel');

const ctx = canvas.getContext('2d');

const resultEl = $('#result');

const resultLive = $('#resultLive');

const wheelWrap = $('#wheelWrap');   // 旋转按钮已移除：点转盘 / 空格键都能开始
/* 这几个 DOM 引用也要给 js/spin.js 用，挂到 ZW.dom 上（原来的短名保持不动） */
Object.assign(ZW.dom = ZW.dom || {}, { canvas, ctx, resultEl, resultLive, wheelWrap });

function cssVar(name, fallback){
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function requestDraw(){
  if (core.drawQueued) return;
  core.drawQueued = true;
  requestAnimationFrame(() => { core.drawQueued = false; draw(); });
}

function fitWheel(){
  const stage = $('.stage');
  const availW = stage.clientWidth - 6;
  const availH = stage.clientHeight - resultEl.offsetHeight - 26;
  const size = Math.max(150, Math.min(availW, availH, 470));
  if (Math.abs(wheelSize - size) < 0.5) return;
  wheelSize = size;
  core.wheelSize = size;
  wheelWrap.style.width = size + 'px';
  wheelWrap.style.height = size + 'px';
}
/* 把一段文字切成两行：优先在标点处切，并让两段宽度尽量接近 */

/* 把一段文字切成两行：优先在标点处切，并让两段宽度尽量接近 */
function splitTwoLines(text, budget, measure){
  const n = String(text).length;
  if (n < 2) return null;
  const soft = '（(）)·、，,。：:；;—-—/／ 　';
  const closing = '）)」』】〕］';
  let best = null;
  for (let i = 1; i < n; i++) {
    const a = text.slice(0, i), b = text.slice(i);
    const wa = measure(a), wb = measure(b);
    if (wa > budget || wb > budget) continue;
    const okBreak = soft.indexOf(text[i]) >= 0 || soft.indexOf(text[i - 1]) >= 0;
    let score = Math.abs(wa - wb);
    if (okBreak) score -= budget * 0.6;
    if (closing.indexOf(text[i]) >= 0) score += budget * 0.8;   // 别让第二行以右括号开头
    if (!best || score < best.score) best = { a:a, b:b, score:score };
  }
  return best ? [best.a, best.b] : null;
}

function draw(){
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  if (!cw || !ch) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const W = Math.round(cw * dpr), H = Math.round(ch * dpr);
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);

  const cx = cw / 2, cy = ch / 2, R = Math.min(cw, ch) / 2;
  const cRing = cssVar('--w-ring', '#fff');
  const cHub  = cssVar('--w-hub', '#f6f2e8');
  const cPtr  = cssVar('--w-pointer', '#fff');
  const cSep  = cssVar('--w-sep', 'rgba(255,255,255,.86)');
  const ring = R * 0.05, R2 = R - ring, hubR = R * 0.155;

  // 底盘（纸白外圈）
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
  ctx.fillStyle = cRing;
  ctx.shadowColor = 'rgba(110,95,70,.20)';
  ctx.shadowBlur = R * 0.10;
  ctx.shadowOffsetY = R * 0.025;
  ctx.fill();
  ctx.restore();
  // 手绘墨线圈（固定种子 → 每帧一致，不会抖动）
  ctx.save();
  ctx.strokeStyle = cssVar('--ink', '#2A241C');
  ctx.lineWidth = Math.max(1, R * 0.0055);
  ctx.lineJoin = 'round';
  sketchCircle(cx, cy, R - Math.max(1, R * 0.006), 7, 2, 0.30);
  ctx.restore();

  const w = currentWheel();
  const opts = activeOptions(w);
  if (!opts.length) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R2, 0, TAU);
    ctx.fillStyle = cSep; ctx.fill();
    ctx.fillStyle = cssVar('--muted', '#9C9384');
    ctx.font = '600 ' + Math.round(R * 0.085) + 'px ' + FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('暂无选项', cx, cy);
    ctx.font = '500 ' + Math.round(R * 0.055) + 'px ' + FONT;
    ctx.fillText('点右下角编辑内容', cx, cy + R * 0.13);
    ctx.restore();
    drawHub(cx, cy, R, hubR, cHub, cPtr, cSep);
    return;
  }

  const secs = layoutSectors(opts, w);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(getRot());
  // 扇形
  secs.forEach(s => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R2, s.start, s.end);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
  });
  // 分隔线
  ctx.lineWidth = Math.max(1.2, R2 * 0.006);
  ctx.strokeStyle = cSep;
  secs.forEach(s => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(s.start) * R2, Math.sin(s.start) * R2);
    ctx.stroke();
  });
  // 文字
  /* 排版策略：
     ① 单行能放下、字号也够看 → 单行（短标签和以前完全一样）
     ② 单行得把字缩到「看不清」才行 → 改排两行：两段沿半径**并排**（横跨扇区宽度），
        每段只用一半长度，所以字号能大一倍左右，多出三四个字也放得下
     ③ 两行都塞不进（扇区太窄/文字太长）→ 按能放下的字号画出来，不截断，
        超出转盘的部分被圆盘裁掉（就是你说的「冲突的字允许被转盘遮挡」） */
  const maxLen = R2 * 0.945 - hubR * 1.25;
  const MIN_FS = Math.max(9.5, R2 * 0.048);
  const pad = R2 * 0.055;
  const measureAt = (size, t) => { ctx.font = '600 ' + size.toFixed(1) + 'px ' + WFONT; return ctx.measureText(t).width; };
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, R2, 0, TAU); ctx.clip();      // 超出转盘的文字被挡住
  secs.forEach(s => {
    const label = (s.opt.label || '').trim();
    if (!label) return;
    ctx.save();
    ctx.rotate(s.mid);
    let flip = false;
    if (state.settings.autoFlip && Math.cos(norm(s.mid + getRot())) < 0) { flip = true; ctx.rotate(Math.PI); }
    ctx.textAlign = flip ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    const baseFs = clamp(Math.min(R2 * 0.125, s.span * R2 * 0.52), MIN_FS, 27);
    const xOuter = flip ? -pad - maxLen : R2 - pad;
    /* ① 单行：先求能放下的最大字号 */
    let f1 = baseFs;
    while (f1 > MIN_FS && measureAt(f1, label) > maxLen) f1 -= 0.5;
    const singleOk = measureAt(f1, label) <= maxLen;
    /* ② 两行：两段并排，各自只用整段长度 */
    const readable = Math.max(baseFs * 0.72, 11);
    let f2 = 0, parts = null;
    if (!singleOk || f1 < readable) {
      for (let size = baseFs; size >= MIN_FS; size -= 0.5) {
        const p = splitTwoLines(label, maxLen, t => measureAt(size, t));
        if (!p) continue;
        /* 两行要横着占地方：最靠内的那行半径越小，切向越窄，窄过两行高度就塞不下 */
        const wMax = Math.max(measureAt(size, p[0]), measureAt(size, p[1]));
        const rIn = Math.max(hubR * 1.2, R2 - pad - wMax);
        const halfArc = Math.max(3, rIn * Math.sin(Math.min(s.span, Math.PI * 0.95) / 2));
        if (size * 1.24 <= halfArc * 2) { parts = p; f2 = size; break; }
      }
    }
    const useTwo = !!parts && f2 > f1 + 0.4;
    const fs = useTwo ? f2 : f1;
    ctx.font = '600 ' + fs.toFixed(1) + 'px ' + WFONT;
    ctx.fillStyle = textOn(s.color);
    ctx.shadowColor = 'rgba(0,0,0,.16)';
    ctx.shadowBlur = 3;
    if (useTwo) {
      const lh = fs * 1.24;
      ctx.fillText(parts[0], xOuter, -lh / 2);
      ctx.fillText(parts[1], xOuter,  lh / 2);
    } else {
      ctx.fillText(label, xOuter, 0);        // 不截断：超出圆盘的部分由上面的 clip 遮住
    }
    ctx.restore();
  });
  ctx.restore();
  ctx.restore();

  drawHub(cx, cy, R, hubR, cHub, cPtr, cSep);
}

function drawHub(cx, cy, R, hubR, cHub, cPtr, cSep){
  ctx.save();
  ctx.translate(cx, cy);
  // 小巧针尖：与中心圆盘同色，尖头只探出很短一截
  const baseY = -hubR * 0.5;          // 针尾（藏在圆盘里）
  const tipY  = -R * 0.22;            // 针尖高度：越接近 -R*0.155 越短
  const len   = baseY - tipY;         // 可见长度
  const pw    = R * 0.040;            // 半宽（保持不变）
  ctx.beginPath();
  ctx.moveTo(0, tipY);
  ctx.bezierCurveTo(pw * 1.55, tipY + len * 0.36, pw * 1.22, baseY, 0, baseY);
  ctx.bezierCurveTo(-pw * 1.22, baseY, -pw * 1.55, tipY + len * 0.36, 0, tipY);
  ctx.closePath();
  ctx.fillStyle = cPtr;                                   // = 中心圆盘色（--w-hub / --w-pointer）
  ctx.shadowColor = 'rgba(90,75,50,.22)';
  ctx.shadowBlur = R * 0.030;
  ctx.shadowOffsetY = R * 0.008;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = Math.max(1, R * 0.004);                 // 墨色细描边：两种主题下都有对比
  ctx.strokeStyle = cssVar('--ink', '#2A241C');
  ctx.globalAlpha = 0.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(0, 0, hubR, 0, TAU);
  ctx.fillStyle = cHub; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, hubR - 0.5, 0, TAU);
  ctx.lineWidth = 1; ctx.strokeStyle = cSep; ctx.stroke();
  // 中心手绘墨圈
  ctx.strokeStyle = cssVar('--ink', '#2A241C');
  ctx.lineWidth = Math.max(1, R * 0.005);
  sketchCircle(0, 0, hubR * 1.04, 23, 1, 0.34);
  ctx.restore();
}
/* 手绘圈：固定种子生成轻微抖动，两次描边模拟毛笔重叠 */

/* 手绘圈：固定种子生成轻微抖动，两次描边模拟毛笔重叠 */
function sketchCircle(cx, cy, r, seed, passes, alphaBase){
  const N = 96;
  for (let p = 0; p < passes; p++) {
    let s = seed + p * 977;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU;
      const rr = r + (rnd() - 0.5) * r * 0.017 - p * r * 0.007;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    ctx.globalAlpha = alphaBase * (p === 0 ? 1 : 0.62);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* 声音与震动（audio / beep / tickSound / winSound / loadGearSfx / playGearSfx / gearTick / vibrate）
   在 js/sound.js 里 */

/* 旋转（setResult / setLiveText / SPIN_FX / applySpinFx / animateSpin / spin）
   在 js/spin.js 里 —— 那边的函数从 ZW.dom 和注入的 hooks 拿依赖 */

Object.assign(ZW, { core, wheelSize, getRot, setRot, canvas, ctx, resultEl, resultLive, wheelWrap, cssVar, requestDraw, fitWheel, splitTwoLines, draw, drawHub, sketchCircle });
})();
