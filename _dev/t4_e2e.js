/* ① 维度图自动弹出 / 自动收起 —— 端到端回归
   node _dev/t4_e2e.js
   场景：属性盘A → 属性盘B（列表顺序），维度图放在 A 之后
   期望：抽完 A → 650ms 后弹出维度图 → 停留 N 秒 → 自动收起 → 继续跳到 B */
'use strict';
const { loadApp } = require('./harness');

let pass = 0, fail = 0;
function ok(cond, msg, extra){
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg + (extra ? '  → ' + extra : '')); }
}

function mkOpt(id, label, next){ return { id, label, weight:1, color:null, next:next || '' }; }

function scenario(opts){
  opts = opts || {};
  const app = loadApp();
  const T = app.T;
  const s = T.state();
  const A = { id:'wA', name:'属性盘A', next:'', branch:false, grade:true, removeAfterPick:false,
              options:[mkOpt('a1', 'E-（极差）'), mkOpt('a2', 'EX（离谱）')] };
  const B = { id:'wB', name:'属性盘B', next:'', branch:false, grade:true, removeAfterPick:false,
              options:[mkOpt('b1', 'C（普通）'), mkOpt('b2', 'S（很强）')] };
  s.wheels = [A, B];
  s.currentId = 'wA';
  s.charts = [{ id:'c1', name:'维度图1', after:'wA', at:Date.now(), dims:[] }];
  s.settings.duration = 0.2;                  // 转盘转得快一点，测试跑得更快
  s.flow = { enabled:true, rootId:'wA', autoJump:true, autoSpin:false, delay:0.3,
             path:[], pendingId:'', retStack:[], paused:false, roundAt:Date.now(), grow:{} };
  if (opts.settings) Object.assign(s.settings, opts.settings);
  if (opts.flow) Object.assign(s.flow, opts.flow);
  if (opts.overlayOpen) app.byId['#overlay'].classList.add('open');
  return { app, T, s, A, B };
}

const snap = T => 'view=' + T.ui.view + ' depth=' + T.navDepth() +
  ' chart=' + (T.ui.chartItem ? T.ui.chartItem.name : '-') +
  ' cur=' + ((T.wheelById(T.state().currentId) || {}).name || '-');

(async function(){
  /* ---------- 1. 自动弹出 + 自动收起 + 继续下一站 ---------- */
  console.log('\n[1] 抽完 A → 弹图 → 自动收起 → 跳到 B');
  {
    const { app, T, s } = scenario();
    T.flowJump(s.wheels[0], { label:'E-（极差）' }, 'E-（极差）');
    ok(s.flow.pendingId === 'wB', 'A 抽完后 pendingId=B', 'pendingId=' + s.flow.pendingId);
    ok(T.ui.view === 'none', '650ms 之前不弹图', snap(T));

    await app.drainAsync(649);
    ok(T.ui.view === 'none', 't=649ms 仍未弹图', snap(T));

    await app.drainAsync(2);
    ok(T.ui.view === 'chart', 't=651ms 已弹出维度图', snap(T));
    ok(T.ui.chartItem && T.ui.chartItem.id === 'c1', '弹的是「维度图1」', snap(T));

    await app.drainAsync(3390);
    ok(T.ui.view === 'chart', '停留期间一直显示维度图', snap(T));

    await app.drainAsync(20);                 // 3400 到点：navGoBack
    ok(T.ui.view === 'none', '3400ms 后自动收起', snap(T));

    await app.drainAsync(600);                // 280ms 回调 + switchTo 的 160ms
    ok(T.wheelById(T.state().currentId).id === 'wB', '收起后自动跳到下一站 B', snap(T));
    ok(s.flow.pendingId === '', 'pendingId 已清空', snap(T));
  }

  /* ---------- 2. 停留时长受设置控制 ---------- */
  console.log('\n[2] 停留时长 = 设置里的 chartDwell（默认 3.4 秒）');
  {
    const { app, T, s } = scenario();
    ok(T.chartDwellSec(s.settings.chartDwell) === 3.4, '默认 chartDwell = 3.4', String(s.settings.chartDwell));
    s.settings.chartDwell = 1.0;
    T.flowJump(s.wheels[0], { label:'E-（极差）' }, 'E-（极差）');
    await app.drainAsync(700);
    ok(T.ui.view === 'chart', '已弹出', snap(T));
    await app.drainAsync(850);
    ok(T.ui.view === 'chart', 't=1.55s 仍在显示（停留 1 秒：0.65+1.0=1.65 才收）', snap(T));
    await app.drainAsync(300);
    ok(T.ui.view === 'none', 't≈1.85s 已收起（1.0s 停留生效）', snap(T));
    await app.drainAsync(600);
    ok(T.wheelById(s.currentId).id === 'wB', '收起后继续到 B', snap(T));
  }

  /* ---------- 3. 关掉「中途弹图」开关 ---------- */
  console.log('\n[3] 关掉「中途走到维度图时弹出来看一眼」→ 不弹，但流程照走');
  {
    const { app, T, s } = scenario({ settings:{ chartMid:false } });
    T.flowJump(s.wheels[0], { label:'E-（极差）' }, 'E-（极差）');
    await app.drainAsync(200);
    ok(T.ui.view === 'none', '没弹维度图', snap(T));
    await app.drainAsync(1000);
    ok(T.wheelById(s.currentId).id === 'wB', '按正常节拍跳到 B', snap(T));
  }

  /* ---------- 4. 面板开着时不抢焦点，但流程要照常继续 ---------- */
  console.log('\n[4] 弹图前用户已经开着一个面板 → 不抢焦点，但流程继续');
  {
    const { app, T, s } = scenario();
    T.navTo('manager', { mtab:'wheels' });         // 模拟用户正开着「转盘」页
    const before = T.ui.view;
    T.flowJump(s.wheels[0], { label:'E-（极差）' }, 'E-（极差）');
    await app.drainAsync(1000);
    ok(T.ui.view === before, '没有抢走当前面板', snap(T));
    await app.drainAsync(4000);
    ok(T.wheelById(T.state().currentId).id === 'wB', '流程照常走到 B', snap(T));
  }

  /* ---------- 5. 自动跳转关掉时：不该自动弹（用户自己控制节奏） ---------- */
  console.log('\n[5] autoJump=false → 不自动弹图、不自动跳');
  {
    const { app, T, s } = scenario({ flow:{ autoJump:false } });
    T.flowJump(s.wheels[0], { label:'E-（极差）' }, 'E-（极差）');
    await app.drainAsync(1200);
    ok(T.ui.view === 'none', '没自动弹图', snap(T));
    ok(s.flow.pendingId === 'wB', 'pendingId=B 供手动前往', snap(T));
  }

  /* ---------- 6. 位置=所有转盘之后 → 流程结束时弹 ---------- */
  console.log('\n[6] 维度图放在「所有转盘之后」→ 流程结束时自动弹');
  {
    const { app, T, s } = scenario();
    s.charts = [{ id:'c9', name:'总结图', after:'', at:Date.now(), dims:[] }];
    T.flowJump(s.wheels[0], { label:'E-（极差）' }, 'E-（极差）');   // A → B
    await app.drainAsync(800);
    ok(T.ui.view === 'none', '走到 B 时不该弹「总结图」', snap(T));
    await app.drainAsync(1000);
    ok(T.wheelById(T.state().currentId).id === 'wB', '已到 B', snap(T));
    T.flowJump(s.wheels[1], { label:'C（普通）' }, 'C（普通）');      // B 是最后一个 → 结束
    await app.drainAsync(1000);
    ok(s.flow.finished === true, '流程已结束', snap(T));
    ok(T.ui.view === 'chart', '结束时弹出「总结图」', snap(T));
  }

  console.log('\n通过 ' + pass + ' / 失败 ' + fail);
  process.exit(fail ? 1 : 0);
})();
