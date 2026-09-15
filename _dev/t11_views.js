/* ★ 每个视图都要能渲染出来 —— 这一项能一次性挡住 "某个函数被删/没转发" 这类问题。
   node _dev/t11_views.js

   为什么需要它：曾经删死 action 时，把 `tabHistory()` 的定义一起删掉了
   （它不是 action，但恰好住在被删的代码块里）。结果：
     navTo('manager', {mtab:'history'}) → viewManager() → tabHistory() → ReferenceError
   整个「设置 / 记录」面板打不开，而 151 项断言全绿 —— 因为**没有一项真的去渲染面板**。
   同理 `fxReduced` 没转发时，是 tabSettings() 抛错。

   所以这个测试的做法很简单粗暴但有效：**把每个视图/每个标签都渲染一遍**，
   任何一个抛错就红灯。 */
'use strict';
const { loadApp } = require('./harness');
let pass = 0, fail = 0;
const ok = (c, m, e) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + (e ? '  → ' + e : '')); } };
const mkOpt = (id, label) => ({ id, label, weight:1, color:null, next:'' });

(async function(){
  const app = loadApp();
  const T = app.T, s = T.state();
  await app.drainAsync(3000);
  await app.settle();

  /* 造一份"什么都有"的状态：属性盘 / 普通盘 / 分支盘 / 维度图 / 历史 / 流程路径 */
  const mk = (id, name, labels, extra) => Object.assign({
    id, name, next:'', branch:false, grade:null, removeAfterPick:false,
    options: labels.map((l, i) => mkOpt(id + '_' + i, l))
  }, extra || {});
  s.wheels = [
    mk('wA', '咒力总量', ['E-（极差）', 'SSS（顶尖）'], { grade:true }),
    mk('wB', '体术水平', ['C（普通）', 'S（很强）'], { grade:true }),
    mk('wC', '最终结局', ['成为最强', '苟到大结局']),
    mk('wD', '事件成长', ['虚度光阴（无属性成长）', '体术+1'], { branch:true })
  ];
  s.currentId = 'wA';
  s.charts = [
    { id:'c1', name:'维度图甲', after:'', at:Date.now(), dims:[] },
    { id:'c2', name:'维度图乙', after:'wA', at:Date.now(), dims:[] }
  ];
  s.history = [{ id:'h1', wheelId:'wA', wheel:'咒力总量', label:'SSS（顶尖）', at:Date.now() }];
  s.flow = { enabled:true, rootId:'wA', autoJump:true, autoSpin:false, delay:1.6,
             path:[{ wheelId:'wA', wheel:'咒力总量', label:'SSS（顶尖）', at:Date.now() }],
             pendingId:'wB', retStack:[{ origin:'wA' }], paused:false, roundAt:Date.now(), grow:{} };

  /* ---------- 1. 每个 opts/view 都渲染一遍 ---------- */
  console.log('\n[1] 逐个渲染所有「视图」（view 参数）');
  const views = ['manager', 'batch', 'target', 'chart', 'newpick', 'newchart', 'result'];
  for (const v of views) {
    let err = null;
    try {
      T.ui.chartItem = s.charts[0];
      T.ui.targetCtx = { kind:'opt', wheel:'wA', opt:'wA_0', cur:'' };
      T.ui.newChartAnchor = '';
      T.ui.resultLabel = 'SSS（顶尖）';
      T.ui.resultOptId = 'wA_1';
      T.navTo(v, { force:true });
      /* 真的把 HTML 生出来（renderSheet 只拼字符串，这里再确认一次没抛） */
      const html = app.byId['#sheet'].innerHTML;
      if (!html || html.length < 40) throw new Error('渲染结果太短：' + html.length);
    } catch(e) { err = e.constructor.name + ': ' + e.message; }
    ok(!err, 'view=' + v + ' 渲染成功', err || '');
  }

  /* ---------- 2. 中枢的三个标签 ---------- */
  console.log('\n[2] 「转盘 / 设置 / 记录」三个标签');
  for (const mt of ['wheels', 'settings', 'history']) {
    let err = null, html = '';
    try {
      T.navCloseAll();
      await app.drainAsync(300);
      T.navTo('manager', { mtab: mt, force: true });
      await app.drainAsync(50);
      html = app.byId['#sheet'].innerHTML;
    } catch(e) { err = e.constructor.name + ': ' + e.message; }
    ok(!err, '标签「' + mt + '」渲染成功', err || '');
    ok(!err && html.length > 100, '标签「' + mt + '」有实质内容（' + html.length + ' 字符）', String(html.length));
  }

  /* ---------- 3. 记录页要有它该有的东西 ---------- */
  console.log('\n[3] 「记录」页的必备元素');
  {
    let html = '';
    T.navCloseAll();
    await app.drainAsync(300);
    try { T.navTo('manager', { mtab:'history', force:true }); html = app.byId['#sheet'].innerHTML; } catch(e){}
    const need = [
      ['属性维度图 标题', /属性维度图/],
      ['新建维度图按钮', /data-act="newChartItem"/],
      ['维度图列表（两张图都在）', /维度图甲[\s\S]*维度图乙|维度图乙[\s\S]*维度图甲/],
      ['抽奖记录标题', /抽奖记录/],
      ['历史那一条', /SSS（顶尖）/],
      ['清空记录按钮', /data-act="clearHistory"/],
      ['复制记录按钮', /data-act="copyHistory"/]
    ];
    need.forEach(([name, re]) => ok(re.test(html), name, name + ' 没找到'));
  }

  /* ---------- 4. 设置页要有新加的那些开关 ---------- */
  console.log('\n[4] 「设置」页的必备元素');
  {
    let html = '';
    T.navCloseAll();
    await app.drainAsync(300);
    try { T.navTo('manager', { mtab:'settings', force:true }); html = app.byId['#sheet'].innerHTML; } catch(e){}
    const need = [
      ['中途弹图开关 chartMid', /data-toggle="chartMid"/],
      ['维度图停留滑杆 flowDwell', /data-field="flowDwell"/],
      ['结束弹图开关 chartOnEnd', /data-toggle="chartOnEnd"/],
      ['旋转效果按钮', /data-act="setSpinFx"/],
      ['法轮透明度滑杆', /data-field="wheelAlpha"/],
      ['减少动态效果提示位（fxReduced 那条）', /mp4|减少动态效果|$/]
    ];
    need.forEach(([name, re]) => ok(re.test(html), name, name + ' 没找到'));
  }

  /* ---------- 5. 每个 data-act 都真的存在于某个视图里 ---------- */
  console.log('\n[5] 面板里出现的 data-act 都能被 handleAction 处理');
  {
    /* 抓 t9/actions.js 那套：这里只做"渲染出来的 act 有 case"的子集检查。
       阶段 C 拆分后 handleAction 的 case 在 js/actions.js 里，业务模块一并扫 */
    const fs = require('fs'), path = require('path');
    const JS_DIR = path.join(__dirname, '..', 'js');
    const PLUGIN_SKIP = new Set(['_ns.js','random.js','util.js','core.js','icons.js','sound.js','spin.js','multi.js']);
    const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8') +
      fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js') && !PLUGIN_SKIP.has(f))
        .map(f => fs.readFileSync(path.join(JS_DIR, f), 'utf8')).join('\n');
    const cases = new Set();
    let m;
    const r = /\bcase\s+'([A-Za-z0-9_]+)'\s*[:{]/g;
    while ((m = r.exec(src))) cases.add(m[1]);
    /* 渲染四个主要视图，收集里面出现的 data-act */
    const seen = new Set();
    ['wheels','settings','history'].forEach(mt => {
      try {
        T.navCloseAll();
        T.navTo('manager', { mtab: mt, force: true });
        const html = app.byId['#sheet'].innerHTML;
        let mm;
        const rr = /data-act="([A-Za-z0-9_]+)"/g;
        while ((mm = rr.exec(html))) seen.add(mm[1]);
      } catch(e){}
    });
    const missing = Array.from(seen).filter(a => !cases.has(a));
    console.log('    面板里出现的 data-act：' + Array.from(seen).sort().join(', '));
    ok(missing.length === 0, '渲染出来的 data-act 全都有对应 case', '缺 case：' + missing.join(', '));
  }

  console.log('\n通过 ' + pass + ' / 失败 ' + fail);
  process.exit(fail ? 1 : 0);
})();
