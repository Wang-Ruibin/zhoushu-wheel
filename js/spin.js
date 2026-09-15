/* ============================================================================
   咒术转盘 · 旋转
   —— 起手动画（easeOut）、旋转时标题实时跟随、6 种物理效果的每帧位移，
      以及一次完整抽奖 spin() 的编排。
   依赖注入（ZW.useSpinHooks）：
     need   : () => 需要重绘（主逻辑的 requestDraw）
     draw   : () => 立刻重绘一帧
     result : 结果区 DOM { resultEl() }
     core   : 共享状态盒（rot / spinning / fxDur / fxReduced / wheelSize）
     config : { sound:()=>bool, vibrate:()=>bool, duration:()=>秒, rolling:()=>bool,
                spinFx:()=>key, autoFlip:()=>bool }
     state  : 存档读写口 { flow, ui, settings }（见下面注掉的老写法）
     flow   : { jump:(w,opt,label)=>void, clearJump:()=>void, renderBar:()=>void }
     wheels : { current:()=>wheel, options:(w)=>[], to:(x)=>void, history:(w,label)=>void }
     growth : (label)=>void
     toast / copy : 反馈
   ============================================================================ */
(function(){
'use strict';

const $ = ZW.$, num = ZW.num, clamp = ZW.clamp, norm = ZW.norm, TAU = ZW.TAU;
const tickSound = ZW.tickSound, winSound = ZW.winSound, vibrate = ZW.vibrate, audio = ZW.audio;
const core = ZW.core;
const random = typeof ZW.random === 'function' ? ZW.random : Math.random;
/* DOM 引用由主逻辑在 ZW.dom 上挂出来 —— 用取值函数而不是解构，
   因为这个文件加载时主逻辑还没跑（ZW.dom 还不存在）。 */
const dom = k => (ZW.dom || {})[k];
const resultEl = () => dom('resultEl');
const resultLive = () => dom('resultLive');
const wheelWrap = () => dom('wheelWrap');

/* ---------------- 结果区文字 ---------------- */
function setResult(text, pop){
  resultEl().textContent = text;
  resultEl().setAttribute('aria-label', text === '？' ? '当前没有结果' : ('结果：' + text + '。按回车打开结果操作'));
  if (resultLive()) resultLive().textContent = text === '？' ? '' : ('抽中：' + text);
  resultEl().classList.toggle('small', String(text).length > 7);
  if (pop !== false) {
    resultEl().classList.remove('pop');
    void resultEl().offsetWidth;
    resultEl().classList.add('pop');
  }
}
/* 旋转过程中标题实时跟随指针所指的扇区 */
function setLiveText(text){
  resultEl().textContent = text;
  resultEl().classList.toggle('small', String(text).length > 7);
}
function beginRolling(){ resultEl().classList.add('rolling'); }
function endRolling(){ resultEl().classList.remove('rolling'); }

/* ---------------- 旋转的物理效果（设置里可选） ---------------- */
const SPIN_FX = [
  ['none',   '平稳', '不晃，最安静'],
  ['bounce', '颠簸', '像轮子碾过小石子，一下一下地弹（落地还会轻微压扁）'],
  ['drum2d', '2D滚筒', '在平面里绕着上/下/左/右滚一圈，像盘子在桌上打转'],
  ['drum',   '3D滚筒', '每转一圈朝外翻出去一次（3D 透视 + 倾角轴绕圈的立体翻滚）'],
  ['settle', '收势', '慢下来时来回摆几下，再稳稳停住']
];
try { core.fxReduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch(e){}
const FX_2D_TURNS_PER_SEC = 1.5;   // 2D滚筒：每秒滚几圈（想更快/更慢改这里）
const FX_3D_TURNS_PER_SEC = 1.1;   // 3D滚筒：每秒翻几圈

function spinFxKey(){
  const k = hooks.config.spinFx() || 'bounce';
  return SPIN_FX.some(x => x[0] === k) ? k : 'bounce';
}
/* 每帧按当前角度/进度给转盘加一点位移旋转，t 是 0~1 的进度 */
function applySpinFx(t){
  if (core.fxReduced || !wheelWrap()) return;
  const fx = spinFxKey();
  if (fx === 'none') { wheelWrap().style.transform = ''; return; }
  const damp = 1 - Math.pow(t, 2.6);                 // 越接近停下越收敛
  let tr = '';
  if (fx === 'bounce') {                             // 颠簸：一下一下弹，落地轻微压扁
    const b = Math.pow(Math.abs(Math.sin(core.rot * 1.9)), 0.65);
    tr = 'translateY(' + (-11 * b * damp).toFixed(2) + 'px)' +
         ' scale(' + (1 + b * 0.014 * damp).toFixed(4) + ',' + (1 - b * 0.022 * damp).toFixed(4) + ')' +
         ' rotate(' + (b * 0.9 * damp).toFixed(3) + 'deg)';
  } else if (fx === 'drum2d') {                      // 2D滚筒：平面内绕上/下/左/右连续滚圈
    /* 相位按「每秒固定圈数」推进（再乘一个温和的缓出），所以滚动速度跟转盘自转的
       圈数脱钩：转盘转 8 圈还是 20 圈，滚筒都是一样的快慢节奏；缓出用的是 1.35
       这种很轻的指数，开头不会像 3.4 那样每帧跳几十度（那会看着不丝滑） */
    const ease = 1 - Math.pow(1 - t, 1.35);
    const ph = ease * Math.PI * 2 * FX_2D_TURNS_PER_SEC * core.fxDur;
    const r = 26 * damp;                             // 偏转半径
    const x = Math.cos(ph) * r, y = Math.sin(ph) * r * 0.74;
    tr = 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px)' +
         ' rotate(' + (Math.sin(ph) * 4 * damp).toFixed(3) + 'deg)' +
         ' scale(' + (1 + Math.cos(ph) * 0.018 * damp).toFixed(4) + ')';
  } else if (fx === 'drum') {                        // 3D滚筒：每转一圈朝外翻滚一次（3D）
    /* 和 2D 一样按「每秒固定圈数」驱动：原来的相位直接取自转角度，而转盘每帧自转几十度，
       sin/cos 被欠采样成乱跳的值，翻滚看着就是一顿一顿的 */
    const ease = 1 - Math.pow(1 - t, 1.35);
    const ph = ease * Math.PI * 2 * FX_3D_TURNS_PER_SEC * core.fxDur;
    const s = Math.sin(ph);                          // 翻滚量：一圈一次
    const lift = Math.abs(s);
    const tilt = s * 24 * damp;                      // 倾角（朝观察者翻出去）
    const axis = ph * 0.45;                          // 倾角轴慢慢绕圈 → 硬币旋摆的立体感
    const ax = Math.cos(axis).toFixed(3), ay = Math.sin(axis).toFixed(3);
    tr = 'perspective(560px)' +
         ' rotate3d(' + ax + ',' + ay + ',0,' + tilt.toFixed(2) + 'deg)' +
         ' rotateY(' + (Math.cos(ph) * 7 * damp).toFixed(2) + 'deg)' +
         ' translateY(' + (-13 * lift * damp).toFixed(2) + 'px)' +
         ' rotate(' + (Math.cos(ph) * 1.8 * damp).toFixed(3) + 'deg)' +
         ' scale(' + (1 - lift * 0.05 * damp).toFixed(4) + ')';
  } else if (fx === 'settle') {                      // 收势：慢下来时来回摆几下（峰值在 3/4 处）
    const env = Math.pow(t, 2.2) * (1 - t) * 6.5;
    const w = Math.sin(t * 26);
    tr = 'rotate(' + (w * 6 * env * damp).toFixed(3) + 'deg)' +
         ' translateY(' + (Math.abs(w) * 9 * env * damp).toFixed(2) + 'px)' +
         ' scale(' + (1 + Math.abs(w) * 0.01 * env * damp).toFixed(4) + ')';
  }
  wheelWrap().style.transform = tr;
}
function startSpinFx(){ if (wheelWrap()) wheelWrap().style.transition = 'none'; }
function endSpinFx(){
  if (!wheelWrap()) return;
  wheelWrap().style.transition = 'transform .34s cubic-bezier(.2,.9,.25,1)';
  wheelWrap().style.transform = '';
  setTimeout(() => { if (wheelWrap()) wheelWrap().style.transition = ''; }, 380);
}

/* 每帧驱动：rot 从 from 缓出到 to，同时算当前指针下的扇区名 */
function animateSpin(from, to, dur, secs, liveText){
  return new Promise(resolve => {
    const t0 = performance.now();
    let last = -1;
    core.fxDur = Math.max(0.4, dur / 1000);
    startSpinFx();
    (function frame(now){
      const t = clamp((now - t0) / dur, 0, 1);
      const e = 1 - Math.pow(1 - t, 3.4);
      core.rot = from + (to - from) * e;
      applySpinFx(t);
      hooks.draw();
      const i = hooks.winnerIndex(secs, core.rot);
      if (i !== last) {
        last = i;
        tickSound();
        if (liveText) setLiveText((secs[i].opt || {}).label || '（空）');
      }
      if (t < 1) requestAnimationFrame(frame);
      else { core.rot = norm(to); hooks.draw(); endSpinFx(); resolve(); }
    })(t0);
  });
}

/* 完整抽一次：起手 → 动画 → 出结果 → 记历史 → 成长 → 交给流程 */
async function spin(){
  if (core.spinning) return;
  hooks.clearJump();
  hooks.pendingClear();
  hooks.expandFlowBar();
  const w = hooks.currentWheel();
  const opts = hooks.activeOptions(w);
  if (!opts.length) {
    hooks.toast('还没有可抽的选项，先去添加吧');
    hooks.openContent();
    return;
  }
  const secs = hooks.layoutSectors(opts, w);
  const idx = hooks.pickIndex(opts);
  core.spinning = true;
  document.body.classList.add('spinning');
  audio();
  const liveText = opts.length > 1 && !!hooks.config.rolling();
  if (liveText) {
    beginRolling();
    // 起手先对齐到指针当前所在的扇区，避免第一帧跳变
    const cur = hooks.winnerIndex(secs, core.rot);
    setLiveText((opts[cur] || {}).label || '（空）');
  } else {
    endRolling();
    setResult('？', false);
  }

  const jitter = (random() * 0.64 - 0.32) * secs[idx].span;
  const target = -Math.PI / 2 - secs[idx].start - secs[idx].span / 2 + jitter;
  const from = core.rot;
  const turns = opts.length === 1 ? 2 : 5 + Math.floor(random() * 3);
  const to = from + turns * TAU + norm(target - from);
  const dur = (opts.length === 1 ? 1.6 : clamp(num(hooks.config.duration()) || 4.2, 1, 12)) * 1000;

  await animateSpin(from, to, dur, secs, liveText);
  endRolling();
  core.spinning = false;
  document.body.classList.remove('spinning');

  const label = opts[idx].label || '（空）';
  hooks.setResultLabel(label, opts[idx].id);
  setResult(label);
  hooks.addHistory(w, label);
  winSound();
  vibrate([0, 30, 55, 70]);

  let removed = false;
  if (w.removeAfterPick && w.options.filter(o => num(o.weight) > 0).length > 1) {
    const i = w.options.indexOf(opts[idx]);
    if (i > -1) { w.options.splice(i, 1); removed = true; hooks.saveSoon(); }
  }
  hooks.requestDraw();
  hooks.toast((removed ? '抽中：' + label + '（已移除）' : '抽中：' + label),
              { action:'复制', fn:() => hooks.copyText(label) });
  hooks.applyGrowth(label);                            // 成长转盘：转为属性提升
  hooks.flowJump(w, opts[idx], label);
}

/* 系统是不是开了「减少动态效果」（设置页要拿它显示提示文字）。
   ⚠️ 不要把它当模块级变量往外塞：它是 core 的属性，页面里直接写 fxReduced
      会 ReferenceError（曾经就是这么炸的，而且是在 tabSettings 里，
      结果「设置」页整个打不开）。这里给一个明确的取值函数。 */
function prefersReducedMotion(){ return !!core.fxReduced; }

/* ---------------- 依赖注入 ---------------- */
const hooks = {};
function useSpinHooks(h){ Object.assign(hooks, h || {}); }

Object.assign(ZW, { spin, animateSpin, applySpinFx, startSpinFx, endSpinFx, spinFxKey,
                    setResult, setLiveText, beginRolling, endRolling, SPIN_FX,
                    useSpinHooks, prefersReducedMotion,
                    FX_2D_TURNS_PER_SEC, FX_3D_TURNS_PER_SEC });
})();
