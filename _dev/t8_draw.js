/* 验证雷达图真的画了东西：真正调用 drawRadar，并把绘制调用录下来
   node _dev/t8_draw.js */
'use strict';
const { loadApp } = require('./harness');
let pass = 0, fail = 0;
const ok = (c, m, e) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + (e ? '  → ' + e : '')); } };

/* 记录型 2D 上下文：drawRadar 内部会 new 一个离屏 canvas 画法轮，也会直接画雷达 */
function makeRecorder(sink){
  const noop = () => {};
  return {
    canvas: { width:600, height:600, style:{} },
    save:noop, restore:noop,
    beginPath(){ sink.push('beginPath'); },
    closePath:noop, moveTo:noop, lineTo:noop, arc:noop, ellipse:noop, rect:noop,
    fill(){ sink.push('fill'); }, stroke(){ sink.push('stroke'); }, clip:noop,
    fillRect:noop, strokeRect:noop, clearRect(){ sink.push('clearRect'); },
    fillText(t){ sink.push('fillText:' + t); }, strokeText:noop,
    translate:noop, rotate:noop, scale:noop, transform:noop, setTransform:noop, resetTransform:noop,
    quadraticCurveTo:noop, bezierCurveTo:noop, setLineDash:noop,
    createLinearGradient:() => ({ addColorStop:noop }),
    createRadialGradient:() => ({ addColorStop:noop }),
    drawImage(){ sink.push('drawImage'); },
    measureText: t => ({ width:String(t == null ? '' : t).length * 8 })
  };
}

const app = loadApp();
const T = app.T; const s = T.state();
const mkOpt = (id, label) => ({ id, label, weight:1, color:null, next:'' });
const A = { id:'wA', name:'咒力总量', next:'', branch:false, grade:true, removeAfterPick:false,
            options:[mkOpt('a1','E-（极差）'), mkOpt('a2','EX（离谱）'), mkOpt('a3','SSS（顶尖）')] };
const B = { id:'wB', name:'等级评定', next:'', branch:false, grade:true, removeAfterPick:false,
            options:[mkOpt('b1','C（普通）'), mkOpt('b2','S（很强）')] };
s.wheels = [A, B]; s.currentId = 'wA';
s.charts = [{ id:'c1', name:'维度图1', after:'wA', at:Date.now(), dims:[] }];
s.flow = { enabled:true, rootId:'wA', autoJump:true, autoSpin:false, delay:0.3,
           path:[], retStack:[], pendingId:'', paused:false, roundAt:Date.now(), grow:{} };

T.flowJump(A, { label:'SSS（顶尖）' }, 'SSS（顶尖）');
const dims = T.chartLiveDims(s.charts[0]);
console.log('\n[A] 本轮属性数据');
console.log('   ', dims.map(d => d.wheel + '=' + d.label + '(' + d.value + ')').join(' / ') || '(空)');
ok(dims.length === 1 && dims[0].label === 'SSS（顶尖）', '数据是刚抽到的「咒力总量=SSS（顶尖）」', JSON.stringify(dims));
ok(dims[0].value === 90, 'SSS 解析成 90 分', String(dims[0] && dims[0].value));

console.log('\n[B] 画一遍雷达图（含法轮背景）');
const calls = [];
/* 造一个"有布局尺寸"的画布：drawRadar 用 clientWidth/clientHeight 算半径 */
function layoutCanvas(w, h){
  const cv = app.sandbox.document.createElement('canvas');
  cv.clientWidth = w; cv.clientHeight = h;
  cv.getContext = () => makeRecorder(calls);
  return cv;
}
const cv = layoutCanvas(600, 600);
/* 让离屏法轮画布也走同一个记录上下文 */
const origCreate = app.sandbox.document.createElement;
app.sandbox.document.createElement = function(tag){
  const el = origCreate.call(this, tag);
  if (String(tag).toLowerCase() === 'canvas') { el.clientWidth = 600; el.clientHeight = 600; el.getContext = () => makeRecorder(calls); }
  return el;
};
T.drawRadar(cv, dims, 1, null, 0, 0, 1);
const nStroke = calls.filter(x => x === 'stroke').length;
const nFill = calls.filter(x => x === 'fill').length;
const texts = calls.filter(x => String(x).indexOf('fillText:') === 0).map(x => x.slice(9));
console.log('    绘制调用 ' + calls.length + ' 次：stroke×' + nStroke + ' fill×' + nFill +
  ' drawImage×' + calls.filter(x => x === 'drawImage').length);
console.log('    文字：' + texts.join(' | '));
ok(calls.length > 40, '确实画了东西（' + calls.length + ' 次调用）', String(calls.length));
ok(nStroke > 5 && nFill > 5, '有描边也有填充', 'stroke=' + nStroke + ' fill=' + nFill);
ok(calls.indexOf('drawImage') >= 0, '法轮是离屏合成后整体贴上的（drawImage）');
ok(texts.some(t => /咒力总量/.test(t)), '画了维度名「咒力总量」', texts.join('|'));
ok(texts.some(t => /SSS/.test(t)), '画了等级文字 SSS', texts.join('|'));

console.log('\n[C] 三个维度 → 走雷达（网格圈 + 刻度 + 三个轴）');
{
  const c2 = [];
  const cv2 = layoutCanvas(600, 600);
  cv2.getContext = () => makeRecorder(c2);
  app.sandbox.document.createElement = function(tag){
    const el = origCreate.call(this, tag);
    if (String(tag).toLowerCase() === 'canvas') { el.clientWidth = 600; el.clientHeight = 600; el.getContext = () => makeRecorder(c2); }
    return el;
  };
  const many = [
    { wheelId:'wA', wheel:'咒力总量', label:'SSS（顶尖）', value:90 },
    { wheelId:'wB', wheel:'等级评定', label:'C（普通）', value:40 },
    { wheelId:'wC', wheel:'体术水平', label:'E-（极差）', value:17 }
  ];
  T.drawRadar(cv2, many, 1, null, 0, 0, 1);
  const t2 = c2.filter(x => String(x).indexOf('fillText:') === 0).map(x => x.slice(9));
  console.log('    绘制调用 ' + c2.length + ' 次；文字：' + t2.join(' | '));
  ok(t2.some(t => /等级评定/.test(t)) && t2.some(t => /体术水平/.test(t)), '三个维度名都画了', t2.join('|'));
  ok(t2.filter(t => /^(E|D|C|B|A|S|SS|SSS)$/.test(t)).length >= 6,
     '画了刻度圈等级（E=20 … SSS=90）', t2.join('|'));
  ok(t2.some(t => /^E-$/.test(t)), '中心标着 E-（17 分 = 0 位置）', t2.join('|'));
}

console.log('\n[D] 位置语义（按交接文档 2.6）：最前/最后 = 本轮抽过的全部；某转盘之后 = 只算它之前（没抽到记 0）');
{
  const all = T.chartLiveDims({ id:'c2', name:'图2', after:'', at:Date.now(), dims:[] });
  console.log('    位置=最后      →', all.map(d => d.wheel + '=' + d.value).join(' / '));
  ok(all.length === 1 && all[0].wheel === '咒力总量', '「所有转盘之后」只统计本轮抽过的', JSON.stringify(all.map(d => d.wheel)));

  const afterA = T.chartLiveDims({ id:'c3', name:'图3', after:'wA', at:Date.now(), dims:[] });
  console.log('    位置=wA之后    →', afterA.map(d => d.wheel + '=' + d.value).join(' / '));
  /* 语义（dimsUpTo 里 limit = 该转盘的下标，含自身）：
     after:'wA' = 排在 wA 与 wB 之间 → 只统计到 wA 为止 */
  ok(afterA.length === 1 && afterA[0].wheel === '咒力总量', '「wA 之后」只统计到 wA 为止', JSON.stringify(afterA.map(d => d.wheel)));

  const afterB = T.chartLiveDims({ id:'c4', name:'图4', after:'wB', at:Date.now(), dims:[] });
  console.log('    位置=wB之后    →', afterB.map(d => d.wheel + '=' + d.value).join(' / '));
  ok(afterB.length === 2, '「wB 之后」把两张盘都算进来', JSON.stringify(afterB.map(d => d.wheel)));
  ok(afterB.some(d => d.wheel === '等级评定' && d.value === 0),
     '没抽到的「等级评定」= 0（刻意的：位置靠前的图就是那一刻的快照）', JSON.stringify(afterB));
  ok(afterB.some(d => d.wheel === '等级评定' && d.label === '—'), '没抽到的标签显示「—」', JSON.stringify(afterB));

  const top = T.chartLiveDims({ id:'c5', name:'图5', after:'__top__', at:Date.now(), dims:[] });
  console.log('    位置=列表最前  →', top.map(d => d.wheel + '=' + d.value).join(' / '));
  ok(top.length === 1, '「列表最前」也是本轮抽过的（1 条）', JSON.stringify(top.map(d => d.wheel)));

  /* 两维度 → 条形图兜底 */
  const c3 = [];
  const cv3 = layoutCanvas(600, 600);
  cv3.getContext = () => makeRecorder(c3);
  T.drawRadar(cv3, afterB, 1, null, 0, 0, 1);
  const t3 = c3.filter(x => String(x).indexOf('fillText:') === 0).map(x => x.slice(9));
  console.log('    两维度绘制 ' + c3.length + ' 次；文字：' + t3.join(' | '));
  ok(c3.length > 5, '两个维度也能画（条形图兜底）', String(c3.length));
  ok(t3.some(t => /等级评定/.test(t)), '条形图里也有「等级评定」', t3.join('|'));
}

console.log('\n通过 ' + pass + ' / 失败 ' + fail);
process.exit(fail ? 1 : 0);
