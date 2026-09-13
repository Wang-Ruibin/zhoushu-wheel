/* 真·端到端：调 spin()（真正转一次）→ 弹维度图 → 自动收起 → 跳下一站 */
'use strict';
const { loadApp } = require('./harness');
let pass = 0, fail = 0;
const ok = (c, m, e) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + (e ? '  → ' + e : '')); } };
const mkOpt = (id, label) => ({ id, label, weight:1, color:null, next:'' });

const app = loadApp(); const T = app.T; const s = T.state();
const A = { id:'wA', name:'属性盘A', next:'', branch:false, grade:true, removeAfterPick:false,
            options:[mkOpt('a1','E-（极差）'), mkOpt('a2','EX（离谱）'), mkOpt('a3','C（普通）')] };
const B = { id:'wB', name:'普通盘B', next:'', branch:false, grade:false, removeAfterPick:false,
            options:[mkOpt('b1','甲'), mkOpt('b2','乙')] };
s.wheels = [A, B]; s.currentId = 'wA';
s.charts = [{ id:'c1', name:'维度图1', after:'wA', at:Date.now(), dims:[] }];
s.settings.duration = 0.5;
s.flow = { enabled:true, rootId:'wA', autoJump:true, autoSpin:false, delay:0.3,
           path:[], pendingId:'', retStack:[], paused:false, roundAt:Date.now(), grow:{} };

const snap = () => 'view=' + T.ui.view + ' depth=' + T.navDepth() +
  ' cur=' + ((T.wheelById(s.currentId) || {}).name || '-') +
  ' 结果=' + (T.ui.resultLabel || '-') + ' pend=' + s.flow.pendingId;

(async function(){
  console.log('\n[A] spin() 真实旋转一轮');
  let spinDone = false;
  T.spin().then(() => { spinDone = true; });
  await app.drainAsync(3000);            // 0.5 秒旋转 + 收尾
  ok(spinDone, '旋转 Promise 已完成', snap());
  ok(!!s.history.length, '已记一条历史：' + (s.history[0] && s.history[0].label), snap());
  ok(s.flow.path.length === 1, '流程路径记了一步', 'path=' + s.flow.path.length);
  ok(s.flow.pendingId === 'wB', 'pendingId=B', snap());

  console.log('\n[B] 维度图自动弹出');
  await app.drainAsync(900);
  ok(T.ui.view === 'chart', '弹出维度图', snap());
  ok(T.ui.chartItem && T.ui.chartItem.id === 'c1', '弹的是维度图1', String(T.ui.chartItem && T.ui.chartItem.name));
  ok((T.ui.chartDims || []).length >= 1, '维度图有数据（' + (T.ui.chartDims || []).length + ' 项）',
     JSON.stringify((T.ui.chartDims || []).map(d => d.wheel + ':' + d.label)));

  console.log('\n[C] 自动收起 + 跳到下一站');
  await app.drainAsync(3600);
  ok(T.ui.view === 'none', '已收起', snap());
  await app.drainAsync(800);
  ok(T.wheelById(s.currentId).id === 'wB', '已跳到 B', snap());
  ok(s.flow.pendingId === '', 'pendingId 清空', snap());
  ok(s.flow.path.length === 1, '路径没有被污染', 'path=' + s.flow.path.length);

  console.log('\n[D] 再抽一次 B（最后一站 → 流程结束）');
  T.spin().then(() => {});
  await app.drainAsync(3000);
  ok(s.flow.finished === true, '流程已结束', snap());
  ok(s.flow.path.length === 2, '路径两步', 'path=' + s.flow.path.length);

  console.log('\n通过 ' + pass + ' / 失败 ' + fail);
  process.exit(fail ? 1 : 0);
})();
