/* ★ 维度图显示路径 —— 这次回归就是因为缺了这一项才漏掉「图打不开」。
   node _dev/t10_chart.js

   和 t8_draw.js 的区别：t8 是**直接调 drawRadar()**（跳过了整条渲染链），
   这里走**真实路径**：
     造属性盘 → 抽几次 → 建维度图 → navTo('chart')
     → renderSheet() → viewChart() → requestAnimationFrame → startChartAnim() → drawRadar()
   断言：viewChart() 的输出里有 chartCv、面板里真的出现了那个 canvas、
        动画跑完后画布尺寸 > 0、ctx 上真的记到了绘制调用。
   —— 凡是「静默不画」（尺寸为 0 直接 return、异常被吞掉）都能被抓到。 */
'use strict';
const { loadApp } = require('./harness');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const ok = (c, m, e) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + (e ? '  → ' + e : '')); } };
const mkOpt = (id, label) => ({ id, label, weight:1, color:null, next:'' });

/* 4 个属性盘：足够画雷达（≥3 个维度） */
function scenario(opts){
  opts = opts || {};
  const app = loadApp(opts.harness);
  const T = app.T, s = T.state();
  const mk = (id, name, labels) => ({ id, name, next:'', branch:false, grade:true, removeAfterPick:false,
                                      options:labels.map((l, i) => mkOpt(id + '_' + i, l)) });
  s.wheels = [
    mk('wA', '咒力总量', ['E-（极差）', 'SSS（顶尖）']),
    mk('wB', '咒力操纵', ['C（普通）', 'S（很强）']),
    mk('wC', '体术水平', ['D（偏低）', 'A（不错）']),
    mk('wD', '等级评定', ['E（很弱）', 'SS（很强）'])
  ];
  s.currentId = 'wA';
  s.settings.duration = 0.2;
  s.flow = { enabled:true, rootId:'wA', autoJump:true, autoSpin:false, delay:99,
             path:[], pendingId:'', retStack:[], paused:false, roundAt:Date.now(), grow:{} };
  return { app, T, s };
}
/* 抽满 4 个盘（用 flowJump 记路径，等价于抽到东西了） */
function fillAll(T, s, labels){
  s.flow.path = s.wheels.map((w, i) => ({ wheelId:w.id, wheel:w.name, label:labels[i], at:Date.now() }));
}

(async function(){
  /* ---------- 1. 面板渲染路径：viewChart 的输出 ---------- */
  console.log('\n[1] navTo("chart") 之后面板里真的有画布');
  let app1, T1, s1;
  {
    const sc = scenario(); app1 = sc.app; T1 = sc.T; s1 = sc.s;
    fillAll(T1, s1, ['SSS（顶尖）', 'S（很强）', 'A（不错）', 'SS（很强）']);
    const item = { id:'c1', name:'维度图1', after:'', at:Date.now(), dims:[] };
    s1.charts = [item];

    const html = T1.viewChart ? null : null;   // viewChart 没导出，走 navTo 触发
    T1.ui.chartItem = item;
    let threw = null;
    try { T1.navTo('chart'); } catch(e){ threw = e.message + '\n' + (e.stack || '').split('\n')[1]; }
    ok(!threw, 'navTo("chart") 不抛错', threw || '');
    ok(T1.ui.view === 'chart', 'ui.view 变成 chart', T1.ui.view);
    ok((T1.ui.chartDims || []).length === 4, 'chartDims 有 4 个维度', String((T1.ui.chartDims || []).length));

    const sheet = app1.byId['#sheet'];
    ok(sheet.innerHTML.indexOf('chartCv') >= 0, 'sheet 的 HTML 里有 chartCv', String(sheet.innerHTML.length) + ' 字符');
    const cv = sheet.querySelector('#chartCv');
    ok(!!cv, '能从面板里查回 #chartCv（querySelector 找得到）', cv ? cv.tagName : 'null');

    /* 面板打开后那一帧：startChartAnim 在这时候被调用 */
    await app1.drainAsync(50);
    ok(!!cv, '动画启动后画布还在', cv ? '在' : '没了');
    ok(cv && cv.width > 0 && cv.height > 0, '画布有了真实像素尺寸（width/height > 0）',
       cv ? (cv.width + 'x' + cv.height) : '-');
    ok(cv && cv._ctx && cv._ctx.__calls.length > 0, '动画第一帧就画了东西',
       cv && cv._ctx ? (cv._ctx.__calls.length + ' 次调用') : '没有 ctx');

    /* 动画跑满（约 1 秒）后应该画了完整的一张图 */
    await app1.drainAsync(1600);
    const calls = (cv && cv._ctx) ? cv._ctx.__calls : [];
    const allTexts = (cv && cv._ctx) ? cv._ctx.__texts : [];
    const texts = allTexts.slice(0, 16);          // 每帧都重画，全打出来会刷屏
    console.log('    绘制调用 ' + calls.length + ' 次：stroke×' + calls.filter(x => x === 'stroke').length +
      ' fill×' + calls.filter(x => x === 'fill').length +
      ' drawImage×' + calls.filter(x => x === 'drawImage').length +
      '（含约 ' + Math.round(calls.length / Math.max(1, allTexts.length / 15)) + ' 帧）');
    console.log('    文字（第一帧）：' + texts.join(' | '));
    ok(calls.length > 50, '动画跑完画了完整的一张图（' + calls.length + ' 次调用）', String(calls.length));
    ok(calls.filter(x => x === 'stroke').length > 5, '有描边', String(calls.filter(x => x === 'stroke').length));
    ok(calls.indexOf('drawImage') >= 0, '法轮背景贴上了（drawImage）');
    ok(texts.some(t => /咒力总量/.test(t)), '画了维度名', texts.join('|'));
    ok(texts.some(t => /SSS/.test(t)), '画了等级', texts.join('|'));
  }

  /* ---------- 2. 自动弹出那条路（流程走到 → 弹图 → 真的画出来） ---------- */
  console.log('\n[2] 流程自动弹图这条路也要真画出东西');
  {
    const sc = scenario(); const app = sc.app, T = sc.T, s = sc.s;
    fillAll(T, s, ['SSS（顶尖）', 'S（很强）', 'A（不错）', 'SS（很强）']);
    s.charts = [{ id:'c1', name:'维度图1', after:'wA', at:Date.now(), dims:[] }];
    s.flow.path = [{ wheelId:'wA', wheel:'咒力总量', label:'SSS（顶尖）', at:Date.now() }];
    T.flowJump(s.wheels[0], { label:'SSS（顶尖）' }, 'SSS（顶尖）');
    await app.drainAsync(700);                       // 650ms 弹图
    ok(T.ui.view === 'chart', '自动弹出了维度图', T.ui.view);
    const cv = app.byId['#sheet'].querySelector('#chartCv');
    ok(!!cv, '自动弹的那张也有画布', cv ? '在' : 'null');
    await app.drainAsync(1600);
    ok(cv && cv._ctx && cv._ctx.__calls.length > 50, '自动弹的那张也真的画了（' + (cv && cv._ctx ? cv._ctx.__calls.length : 0) + ' 次调用）');
    await app.drainAsync(2500);                      // 收起 + 继续
    ok(T.ui.view === 'none', '照常自动收起', T.ui.view);
  }

  /* ---------- 3. 尺寸为 0 时不该炸，也不该假装画好了 ---------- */
  console.log('\n[3] 面板还没布局完（画布尺寸为 0）的情况');
  {
    const sc = scenario(); const app = sc.app, T = sc.T, s = sc.s;
    fillAll(T, s, ['SSS（顶尖）', 'S（很强）', 'A（不错）', 'SS（很强）']);
    const item = { id:'c1', name:'维度图1', after:'', at:Date.now(), dims:[] };
    s.charts = [item];
    /* 让 sheet 里的画布都是 0 尺寸 */
    const origQ = app.byId['#sheet'].querySelector.bind(app.byId['#sheet']);
    app.byId['#sheet'].querySelector = sel => {
      const el = origQ(sel);
      if (el && String(sel).indexOf('chartCv') >= 0) el._box = { width:0, height:0 };
      return el;
    };
    T.ui.chartItem = item;
    let threw = null;
    try { T.navTo('chart'); } catch(e){ threw = e.message; }
    await app.drainAsync(2000);
    ok(!threw, '尺寸为 0 时不抛错（drawRadar 会直接 return）', threw || '');
    ok(T.ui.view === 'chart', '面板还是打开了（不至于白屏崩掉）', T.ui.view);
    console.log('    ↑ 这条只保证"不崩"。真实浏览器里尺寸不会是 0（面板是文档流布局，rAF 时已排好版）');
  }

  /* ---------- 4. 三张图连续打开（变形动画那条路） ---------- */
  console.log('\n[4] 连续打开两张图（从上一张变形的路径）');
  {
    const sc = scenario(); const app = sc.app, T = sc.T, s = sc.s;
    fillAll(T, s, ['SSS（顶尖）', 'S（很强）', 'A（不错）', 'SS（很强）']);
    s.charts = [{ id:'c1', name:'图1', after:'wA', at:Date.now(), dims:[] },
                { id:'c2', name:'图2', after:'', at:Date.now(), dims:[] }];
    T.ui.chartItem = s.charts[0]; T.navTo('chart');
    await app.drainAsync(1500);
    T.navGoBack();
    await app.drainAsync(300);
    let threw = null;
    try { T.ui.chartItem = s.charts[1]; T.navTo('chart'); } catch(e){ threw = e.message; }
    await app.drainAsync(1500);
    ok(!threw, '打开第二张不抛错', threw || '');
    ok(!!T.ui.chartFrom, '第二张拿到了"上一张"的数据（会做变形动画）',
       T.ui.chartFrom ? (T.ui.chartFrom.length + ' 项') : 'null');
    const cv = app.byId['#sheet'].querySelector('#chartCv');
    ok(cv && cv._ctx && cv._ctx.__calls.length > 50, '第二张也画出来了',
       cv && cv._ctx ? String(cv._ctx.__calls.length) + ' 次调用' : '-');
  }

  /* ---------- 5. 老存档（已有 localStorage）也要能打开图 ---------- */
  console.log('\n[5] 浏览器里已经有存档时（走 load() → normalize() 那条路）');
  {
    const saved = {
      version: 3, currentId: 'wA',
      wheels: [{ id:'wA', name:'咒力总量', next:'', branch:false, grade:true, removeAfterPick:false,
                 options:[mkOpt('a1', 'SSS（顶尖）'), mkOpt('a2', 'E-（极差）')] },
               { id:'wB', name:'咒力操纵', next:'', branch:false, grade:true, removeAfterPick:false,
                 options:[mkOpt('b1', 'S（很强）')] },
               { id:'wC', name:'体术水平', next:'', branch:false, grade:true, removeAfterPick:false,
                 options:[mkOpt('c1', 'A（不错）')] }],
      settings: { chartDwell: 2, chartMid: true, chartOnEnd: true, palette:'xuan' },
      charts: [{ id:'c1', name:'老存档的图', after:'', at: Date.now(),
                 dims: [{ wheel:'咒力总量', label:'SSS（顶尖）', value:90 },
                        { wheel:'咒力操纵', label:'S（很强）', value:70 },
                        { wheel:'体术水平', label:'A（不错）', value:60 }] }],
      history: []
    };
    let app2 = null, threw = null;
    try { app2 = loadApp({ preload:{ 'zhoushu-wheel.v1': JSON.stringify(saved) } }); }
    catch(e){ threw = e.constructor.name + ': ' + e.message; }
    ok(!threw, '带存档启动不抛错（normalize 那条路）', threw || '');
    if (app2) {
      const T2 = app2.T, s2 = T2.state();
      ok(s2.charts.length === 1, '存档里的维度图还在', String(s2.charts.length));
      ok(T2.chartDwellSec(s2.settings.chartDwell) === 2, 'chartDwell 从存档读出来了', String(s2.settings.chartDwell));
      T2.ui.chartItem = s2.charts[0];
      let e2 = null;
      try { T2.navTo('chart'); } catch(e){ e2 = e.message; }
      await app2.drainAsync(1500);
      ok(!e2, '老存档里那张图能打开', e2 || '');
      const cv = app2.byId['#sheet'].querySelector('#chartCv');
      ok(cv && cv._ctx && cv._ctx.__calls.length > 50, '老存档那张也画出来了',
         cv && cv._ctx ? String(cv._ctx.__calls.length) + ' 次调用' : '-');
    }
  }

  console.log('\n通过 ' + pass + ' / 失败 ' + fail);
  process.exit(fail ? 1 : 0);
})();
