/* ① 补充：用户中途插手时流程不能卡住
   node _dev/t6_interrupt.js */
'use strict';
const { loadApp } = require('./harness');
let pass = 0, fail = 0;
const ok = (c, m, e) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + (e ? '  → ' + e : '')); } };
const mkOpt = (id, label) => ({ id, label, weight:1, color:null, next:'' });

function scenario(opts){
  opts = opts || {};
  const app = loadApp(); const T = app.T; const s = T.state();
  const A = { id:'wA', name:'属性盘A', next:'', branch:false, grade:true, removeAfterPick:false,
              options:[mkOpt('a1','E-（极差）'), mkOpt('a2','EX（离谱）')] };
  const B = { id:'wB', name:'属性盘B', next:'', branch:false, grade:true, removeAfterPick:false,
              options:[mkOpt('b1','C（普通）'), mkOpt('b2','S（很强）')] };
  const C = { id:'wC', name:'普通盘C', next:'', branch:false, grade:false, removeAfterPick:false,
              options:[mkOpt('c1','甲')] };
  s.wheels = [A, B, C]; s.currentId = 'wA';
  s.charts = [{ id:'c1', name:'维度图1', after:'wA', at:Date.now(), dims:[] }];
  s.flow = { enabled:true, rootId:'wA', autoJump:true, autoSpin:false, delay:0.3,
             path:[], pendingId:'', retStack:[], paused:false, roundAt:Date.now(), grow:{} };
  if (opts.settings) Object.assign(s.settings, opts.settings);
  if (opts.flow) Object.assign(s.flow, opts.flow);
  return { app, T, s, A, B, C };
}
const snap = T => 'view=' + T.ui.view + ' depth=' + T.navDepth() +
  ' cur=' + ((T.wheelById(T.state().currentId) || {}).name || '-') + ' pend=' + T.state().flow.pendingId;

(async function(){
  /* 1. 停留期间用户自己按 × 关掉 → 流程要继续，不能卡住 */
  console.log('\n[1] 停留期间用户自己关掉维度图');
  {
    const { app, T, s } = scenario();
    T.flowJump(s.wheels[0], { label:'E-（极差）' }, 'E-（极差）');
    await app.drainAsync(700);
    ok(T.ui.view === 'chart', '已弹出', snap(T));
    T.navGoBack();                                   // 点 × / 按 Esc
    ok(T.ui.view === 'none', '图已关掉', snap(T));
    await app.drainAsync(60);
    ok(T.ui.view === 'none', '600ms 内没有被自动再打开', snap(T));
    await app.drainAsync(800);
    ok(T.wheelById(s.currentId).id === 'wB', '流程继续走到 B', snap(T));
    ok(s.flow.pendingId === '', 'pendingId 已清空', snap(T));
  }

  /* 2. 停留期间用户自己打开了别的面板，然后停留到点 */
  console.log('\n[2] 停留到点时用户正开着别的面板');
  {
    const { app, T, s } = scenario();
    T.flowJump(s.wheels[0], { label:'E-（极差）' }, 'E-（极差）');
    await app.drainAsync(700);
    ok(T.ui.view === 'chart', '已弹出', snap(T));
    T.navTo('manager', { mtab:'wheels' });            // 用户点了顶部标题
    ok(T.ui.view === 'manager', '面板已压在上面', snap(T));
    await app.drainAsync(3600);                       // 停留到点
    ok(T.ui.view === 'manager', '没把用户的面板抢走', snap(T));
    await app.drainAsync(1000);
    ok(T.wheelById(s.currentId).id === 'wB', '流程继续走到 B', snap(T));
  }

  /* 3. 停留期间用户自己走到别的转盘 */
  console.log('\n[3] 停留期间用户手动切到 C');
  {
    const { app, T, s } = scenario();
    T.flowJump(s.wheels[0], { label:'E-（极差）' }, 'E-（极差）');
    await app.drainAsync(700);
    T.switchTo('wC', { silent:true });
    await app.drainAsync(400);
    ok(T.wheelById(s.currentId).id === 'wC', '用户已到 C', snap(T));
    await app.drainAsync(4000);
    ok(T.wheelById(s.currentId).id === 'wC', '自动跳转没有把用户拽走', snap(T));
    ok(s.flow.pendingId === '', 'pendingId 已清空（不再有悬空跳转）', snap(T));
  }

  /* 4. 提示条在收起后要消失 */
  console.log('\n[4] 自动收起后提示条要收掉');
  {
    const { app, T, s } = scenario();
    const toastEl = app.byId['#toast'];
    T.flowJump(s.wheels[0], { label:'E-（极差）' }, 'E-（极差）');
    await app.drainAsync(700);
    ok(toastEl.classList.contains('show'), '弹出时提示条显示', toastEl.className);
    await app.drainAsync(3600);
    ok(!toastEl.classList.contains('show'), '收起后提示条消失', toastEl.className);
  }

  /* 5. 流程走完（最后一站）时的维度图也要能自动收起 */
  console.log('\n[5] 结束时弹出的维度图同样会自动收起');
  {
    const { app, T, s } = scenario({ settings:{ chartOnEnd:true } });
    s.charts = [{ id:'c9', name:'总结图', after:'', at:Date.now(), dims:[] }];
    T.flowJump(s.wheels[0], { label:'E-（极差）' }, 'E-（极差）');   // A → B（不弹）
    await app.drainAsync(900);
    T.flowJump(s.wheels[1], { label:'C（普通）' }, 'C（普通）');      // B → C
    await app.drainAsync(900);
    T.flowJump(s.wheels[2], { label:'甲' }, '甲');                   // C 是最后一个 → 结束
    await app.drainAsync(900);
    ok(T.ui.view === 'chart', '结束时弹出总结图', snap(T));
    await app.drainAsync(3600);
    ok(T.ui.view === 'none', '3.4 秒后自动收起', snap(T));
    await app.drainAsync(1000);
    ok(T.ui.view === 'none', '收起后不再弹（流程已结束）', snap(T));
  }

  console.log('\n通过 ' + pass + ' / 失败 ' + fail);
  process.exit(fail ? 1 : 0);
})();
