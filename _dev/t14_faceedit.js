/* ★ 多面转盘：在「面」里编辑内容必须能存住
   node _dev/t14_faceedit.js

   用户报的 bug：在多面转盘的某个面里填内容，还没填完、点去别的页面 → 内容没了。

   根因：input 处理器里用 `currentWheel().options` 找选项（**只看兜底面**），
        面里的选项找不到 → `if (!o) return` **静默丢弃**输入。
        —— 渲染和编辑动作都改成按面取了，唯独输入路径漏了。

   这个测试就是"把每个输入字段都打一遍字，然后切页面回来对答案"。
   教训：**凡是"按 id 定位对象"的地方，都要问一句"多面转盘时它在哪一层"**。 */
'use strict';
const { loadApp } = require('./harness');
let pass = 0, fail = 0;
const ok = (c, m, e) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + (e ? '  → ' + e : '')); } };
const mkOpt = (id, label, w) => ({ id, label, weight: w == null ? 1 : w, color:null, next:'' });

(async function(){
  const app = loadApp();
  const T = app.T, s = T.state();
  await app.drainAsync(3000);
  await app.settle();

  const srcWheel = { id:'wm', name:'道德水平', next:'', branch:false, grade:true, removeAfterPick:false,
                     multi:false, faceBy:'', faces:[],
                     options:[mkOpt('m0','A（安分守己）'), mkOpt('m1','B（见义勇为）')] };
  const multi = {
    id:'wf', name:'声望', next:'', branch:false, grade:null, removeAfterPick:false,
    multi:true, faceBy:'wm',
    faces:[
      { when:{ type:'gradeAtLeast', value:'A' }, options:[mkOpt('h0',''), mkOpt('h1','')] },
      { when:{ type:'gradeAtMost',  value:'B' }, options:[] }
    ],
    options:[mkOpt('d0','（兜底）默默无闻')]
  };
  s.wheels = [srcWheel, multi];
  s.currentId = 'wf';
  s.flow = { enabled:true, rootId:'wm', autoJump:false, autoSpin:false, delay:1.6,
             path:[{ wheelId:'wm', wheel:'道德水平', label:'A（安分守己）', at:Date.now() }],
             pendingId:'', retStack:[], paused:false, roundAt:Date.now(), grow:{} };

  /* 打一个"输入"事件（和真实 DOM 的 input 事件同形） */
  function typeInput(id, field, value){
    const sheet = app.byId['#sheet'];
    const ls = (sheet.listeners && sheet.listeners['input']) || [];
    const row = { dataset:{ id: id }, classList:{ toggle(){}, add(){}, remove(){} } };
    const target = { dataset:{ field: field }, value: value, closest: () => row };
    ls.forEach(fn => fn({ target: target, preventDefault(){}, stopPropagation(){} }));
  }
  const faceOpts = i => multi.faces[i].options;
  const labelsOf = arr => arr.map(o => o.label).join(' , ');

  /* ---------- 1. 编辑第一个面：打字要落在这个面上 ---------- */
  console.log('\n[1] 在第 1 面里输入内容');
  T.ui.faceEdit = 0;                       // 选中第 1 面
  T.navTo('manager', { mtab:'content', force:true });
  ok(T.editFaceIndex(multi) === 0, '当前编辑的是第 1 面', String(T.editFaceIndex(multi)));

  typeInput('h0', 'label', 'EX（超凡入圣）');
  ok(labelsOf(faceOpts(0)) === 'EX（超凡入圣） , ', '内容写进了**第 1 面**', labelsOf(faceOpts(0)));
  ok(multi.options[0].label === '（兜底）默默无闻', '兜底面没有被误改', multi.options[0].label);

  typeInput('h1', 'label', 'S（家喻户晓）');
  ok(labelsOf(faceOpts(0)) === 'EX（超凡入圣） , S（家喻户晓）', '第二条也写进去了', labelsOf(faceOpts(0)));

  /* ---------- 2. 切到别的页面再回来，内容还在 ---------- */
  console.log('\n[2] 切页面再回来，内容还在（这就是用户报的现象）');
  /* 模拟"点别的页面"：真的切 mtab（设置 / 记录），再切回来 */
  for (const mt of ['settings', 'history', 'wheels']) {
    T.navTo('manager', { mtab: mt, force:true });
    await app.drainAsync(50);
    ok(labelsOf(faceOpts(0)) === 'EX（超凡入圣） , S（家喻户晓）',
       '切到「' + mt + '」再回来，第 1 面内容还在', labelsOf(faceOpts(0)));
  }
  /* 回内容页确认渲染出来的值也是对的（不只是内存里对） */
  T.navTo('manager', { mtab:'content', force:true });
  await app.drainAsync(50);
  {
    const html = app.byId['#sheet'].innerHTML;
    ok(html.indexOf('EX（超凡入圣）') >= 0, '重新渲染出来的输入框里有这个值', html.indexOf('EX（超凡入圣）') >= 0 ? '有' : '没有');
  }

  /* 彻底关掉面板再打开 */
  T.navCloseAll();
  await app.drainAsync(400);
  T.navTo('manager', { mtab:'content', force:true });
  await app.drainAsync(50);
  ok(labelsOf(faceOpts(0)) === 'EX（超凡入圣） , S（家喻户晓）', '关掉整个面板再打开也在', labelsOf(faceOpts(0)));

  /* 存盘 / 读盘往返 */
  const saved = app.sandbox.localStorage.getItem('zhoushu-wheel.v1');
  const parsed = JSON.parse(saved);
  const back = parsed.wheels.filter(w => w.name === '声望')[0];
  ok(back && back.faces[0].options.map(o => o.label).join(' , ') === 'EX（超凡入圣） , S（家喻户晓）',
     '存档（localStorage）里也有', JSON.stringify(back && back.faces[0].options.map(o => o.label)));
  /* 走一遍"刷新页面"：把存档喂给新的实例 */
  {
    const app2 = loadApp({ preload:{ 'zhoushu-wheel.v1': saved } });
    const back2 = app2.T.state().wheels.filter(w => w.name === '声望')[0];
    ok(!!back2 && back2.faces[0].options.map(o => o.label).join(' , ') === 'EX（超凡入圣） , S（家喻户晓）',
       '刷新页面（重新读存档）之后内容还在',
       JSON.stringify(back2 && back2.faces[0].options.map(o => o.label)));
  }

  /* ---------- 3. 第二个面独立 ---------- */
  console.log('\n[3] 第 2 面是独立的（互不串味）');
  T.ui.faceEdit = 1;
  T.navTo('manager', { mtab:'content', force:true });
  ok(T.editFaceIndex(multi) === 1, '切到第 2 面', String(T.editFaceIndex(multi)));
  /* 第 2 面是空的 → 先用「添加选项」造一条 */
  await T.handleAction('addOpt', null, { dataset:{}, closest:() => null });
  ok(faceOpts(1).length === 1, '第 2 面加了一条', String(faceOpts(1).length));
  typeInput(faceOpts(1)[0].id, 'label', 'EX（婴儿止啼）');
  ok(faceOpts(1)[0].label === 'EX（婴儿止啼）', '内容写进第 2 面', faceOpts(1)[0].label);
  ok(labelsOf(faceOpts(0)) === 'EX（超凡入圣） , S（家喻户晓）', '第 1 面没被影响', labelsOf(faceOpts(0)));

  /* ---------- 4. 兜底面也能编辑 ---------- */
  console.log('\n[4] 兜底面（和普通转盘一样）');
  T.ui.faceEdit = -1;
  T.navTo('manager', { mtab:'content', force:true });
  typeInput('d0', 'label', '（兜底）无名之辈');
  ok(multi.options[0].label === '（兜底）无名之辈', '兜底面能改', multi.options[0].label);

  /* ---------- 5. 权重 / 颜色 / 删除 也要按面工作 ---------- */
  console.log('\n[5] 权重、颜色、删除同样要落在「当前那一面」');
  T.ui.faceEdit = 0;
  T.navTo('manager', { mtab:'content', force:true });
  typeInput('h0', 'weight', '5');
  ok(faceOpts(0)[0].weight === 5, '权重改到了第 1 面', String(faceOpts(0)[0].weight));
  ok(multi.options[0].weight === 1, '兜底面的权重没被连带改', String(multi.options[0].weight));
  typeInput('h0', 'color', '#123456');
  ok(faceOpts(0)[0].color === '#123456', '颜色改到了第 1 面', String(faceOpts(0)[0].color));

  const n0 = faceOpts(0).length;
  await T.handleAction('delOpt', 'h0', { dataset:{ id:'h0' }, closest:() => null });
  ok(faceOpts(0).length === n0 - 1, '删除删的是第 1 面里的那条', String(faceOpts(0).length));
  ok(faceOpts(1).length === 1, '第 2 面没被删到', String(faceOpts(1).length));

  /* ---------- 6. 选项的「跳转目标」也要能找到面里的选项 ---------- */
  console.log('\n[6] 面里的选项也要能设「跳转目标」');
  T.ui.faceEdit = 0;
  T.navTo('manager', { mtab:'content', force:true });
  const targetId = faceOpts(0)[0].id;
  await T.handleAction('pickNext', targetId, { dataset:{ id:targetId }, closest:() => null });
  ok(T.ui.targetCtx && T.ui.targetCtx.opt === targetId,
     '点「→」能定位到面里的选项', JSON.stringify(T.ui.targetCtx));

  /* ---------- 7. 批量编辑也按面 ---------- */
  console.log('\n[7] 批量编辑作用在当前面');
  T.ui.faceEdit = 0;
  T.navTo('batch', { force:true });
  app.byId['#sheet'].innerHTML = '<textarea id="batchText">甲*2\n乙</textarea>';
  /* batchText 是渲染出来的，这里直接给它塞一个假的取值口 */
  const fakeText = { value:'甲*2\n乙', dataset:{} };
  const origQ = app.sandbox.document.querySelector;
  app.sandbox.document.querySelector = sel => (sel === '#batchText') ? fakeText : origQ.call(app.sandbox.document, sel);
  await T.handleAction('batchApply', null, { dataset:{ mode:'replace' }, closest:() => null });
  app.sandbox.document.querySelector = origQ;
  ok(faceOpts(0).map(o => o.label + '*' + o.weight).join(' , ') === '甲*2 , 乙*1',
     '批量覆盖写进第 1 面', faceOpts(0).map(o => o.label + '*' + o.weight).join(' , '));
  ok(faceOpts(1).length === 1, '第 2 面不受影响', String(faceOpts(1).length));

  console.log('\n通过 ' + pass + ' / 失败 ' + fail);
  process.exit(fail ? 1 : 0);
})();
