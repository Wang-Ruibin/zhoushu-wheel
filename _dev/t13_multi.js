/* ★ 多面转盘：按「之前抽到的结果」切换自己的内容
   node _dev/t13_multi.js */
'use strict';
const { loadApp } = require('./harness');
let pass = 0, fail = 0;
const ok = (c, m, e) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + (e ? '  → ' + e : '')); } };
const mkOpt = (id, label) => ({ id, label, weight:1, color:null, next:'' });
const mk = (id, name, labels, extra) => Object.assign({
  id, name, next:'', branch:false, grade:null, removeAfterPick:false,
  options: labels.map((l, i) => mkOpt(id + '_' + i, l))
}, extra || {});

(async function(){
  const app = loadApp();
  const T = app.T, s = T.state();
  await app.drainAsync(3000);
  await app.settle();

  /* ---------- 场景：道德水平（属性盘）→ 声望（多面转盘）----------- */
  const MORAL = mk('wM', '道德水平',
    ['E-（禽兽不如）', 'E（丧心病狂）', 'D（恬不知耻）', 'C（见利忘义）', 'B（见义勇为）',
     'A（安分守己）', 'S（乐善好施）', 'SS（光明磊落）', 'SSS（高风亮节）', 'EX（超凡入圣）'],
    { grade:true });
  const FAME = {
    id:'wF', name:'声望', next:'', branch:false, grade:null, removeAfterPick:false,
    multi:true, faceBy:'道德水平',
    faces: [
      { when:{ type:'gradeAtLeast', value:'A' },
        options:[ mkOpt('f_h1','EX（超凡入圣）'), mkOpt('f_h2','S（家喻户晓）'), mkOpt('f_h3','A（小有名气）') ] },
      { when:{ type:'gradeAtMost', value:'B' },
        options:[ mkOpt('f_l1','EX（婴儿止啼）'), mkOpt('f_l2','S（臭名昭著）'), mkOpt('f_l3','A（颇遭非议）') ] }
    ],
    options:[ mkOpt('f_d1','（兜底）默默无闻') ]
  };
  s.wheels = [MORAL, FAME];
  s.currentId = 'wM';
  s.flow = { enabled:true, rootId:'wM', autoJump:false, autoSpin:false, delay:99,
             path:[], pendingId:'', retStack:[], paused:false, roundAt:Date.now(), grow:{} };

  const labels = () => T.wheelOptions(FAME).map(o => o.label);
  const faceIdx = () => T.faceOf(FAME).index;

  /* ---------- 1. 还没抽道德 → 兜底面 ---------- */
  console.log('\n[1] 道德还没抽过 → 用兜底面');
  ok(faceIdx() === -1, '没有面命中（index = -1）', String(faceIdx()));
  ok(labels().join() === '（兜底）默默无闻', '显示兜底面的内容', labels().join(' | '));

  /* ---------- 2. 抽到 A 级 → 高道德那一面 ---------- */
  console.log('\n[2] 道德抽到 A（安分守己）');
  s.flow.path.push({ wheelId:'wM', wheel:'道德水平', label:'A（安分守己）', at:Date.now() });
  ok(faceIdx() === 0, '命中第 0 个面（等级 ≥ A）', String(faceIdx()));
  ok(labels().indexOf('EX（超凡入圣）') >= 0 && labels().indexOf('EX（婴儿止啼）') < 0,
     '显示的是「超凡入圣」而不是「婴儿止啼」', labels().join(' | '));

  /* ---------- 3. 抽到 B 级 → 低道德那一面 ---------- */
  console.log('\n[3] 道德抽到 B（见义勇为）');
  s.flow.path.push({ wheelId:'wM', wheel:'道德水平', label:'B（见义勇为）', at:Date.now() });
  ok(faceIdx() === 1, '命中第 1 个面（等级 ≤ B）', String(faceIdx()));
  ok(labels().indexOf('EX（婴儿止啼）') >= 0 && labels().indexOf('S（臭名昭著）') >= 0,
     '显示「婴儿止啼 / 臭名昭著」', labels().join(' | '));

  /* ---------- 4. 边界：每一档都过一遍 ---------- */
  console.log('\n[4] 逐个等级验证边界（≥A 走高面，≤B 走低面）');
  const caseOf = label => {
    s.flow.path = [{ wheelId:'wM', wheel:'道德水平', label, at:Date.now() }];
    return faceIdx();
  };
  [['E-（禽兽不如）',1], ['E（丧心病狂）',1], ['D（恬不知耻）',1], ['C（见利忘义）',1],
   ['B（见义勇为）',1], ['A（安分守己）',0], ['S（乐善好施）',0], ['SS（光明磊落）',0],
   ['SSS（高风亮节）',0], ['EX（超凡入圣）',0]].forEach(([lab, want]) => {
    const got = caseOf(lab);
    ok(got === want, '道德=' + lab + ' → 第 ' + got + ' 面（期望 ' + want + '）', String(got));
  });

  /* ---------- 5. ★ 成长会改变分面 ---------- */
  console.log('\n[5] ★ 成长把道德从 B 抬到 A → 面应该跟着切');
  s.flow.path = [{ wheelId:'wM', wheel:'道德水平', label:'B（见义勇为）', at:Date.now() }];
  s.flow.grow = {};
  ok(faceIdx() === 1, '成长前：B → 低道德面', String(faceIdx()));
  s.flow.grow = { wM: 2 };                      // 道德 +2：B → A
  ok(faceIdx() === 0, '道德 +2（B→A）之后 → 切成高道德面', String(faceIdx()));
  ok(labels().indexOf('EX（超凡入圣）') >= 0, '内容也跟着换成「超凡入圣」', labels().join(' | '));
  s.flow.grow = {};

  /* ---------- 6. 历史里的结果也算（path 被截断时不至于失忆） ---------- */
  console.log('\n[6] path 被清掉后，从历史里找');
  s.flow.path = [];
  s.history = [{ id:'h1', wheelId:'wM', wheel:'道德水平', label:'S（乐善好施）', at:Date.now() }];
  ok(faceIdx() === 0, '只用历史也能判出高道德面', String(faceIdx()));
  s.history = [];
  ok(faceIdx() === -1, '历史也空 → 兜底面', String(faceIdx()));

  /* ---------- 7. 各种条件类型 ---------- */
  console.log('\n[7] 条件类型（等级 ≥ / ≤ / = / 结果 = / 包含 / 其他）');
  const one = when => ({ when, options:[mkOpt('x','命中')] });
  const probe = (when, label) => {
    const w = { id:'t', name:'测试', multi:true, faceBy:'道德水平', faces:[one(when)], options:[mkOpt('d','兜底')] };
    s.wheels = [MORAL, w];
    s.flow.path = label == null ? [] : [{ wheelId:'wM', wheel:'道德水平', label, at:Date.now() }];
    s.flow.grow = {};
    return T.wheelOptions(w).map(o => o.label).join();
  };
  ok(probe({ type:'gradeAtLeast', value:'A' }, 'S（乐善好施）') === '命中', '等级 ≥ A：S 命中');
  ok(probe({ type:'gradeAtLeast', value:'A' }, 'C（见利忘义）') === '兜底', '等级 ≥ A：C 不命中');
  ok(probe({ type:'gradeAtMost', value:'C' }, 'E（丧心病狂）') === '命中', '等级 ≤ C：E 命中');
  ok(probe({ type:'gradeIs', value:'S' }, 'S（乐善好施）') === '命中', '等级 = S：S 命中');
  ok(probe({ type:'gradeIs', value:'S' }, 'SS（光明磊落）') === '兜底', '等级 = S：SS 不命中');
  ok(probe({ type:'labelIs', value:'S（乐善好施）' }, 'S（乐善好施）') === '命中', '结果 = 整串文字：命中');
  ok(probe({ type:'labelHas', value:'乐善' }, 'S（乐善好施）') === '命中', '结果包含「乐善」：命中');
  ok(probe({ type:'else' }, null) === '命中', '其他情况：没抽过也命中');

  /* ---------- 8. 按顺序取第一个命中的面 ---------- */
  console.log('\n[8] 多个面命中时取第一个（顺序 = 优先级）');
  {
    const w = { id:'t2', name:'测试2', multi:true, faceBy:'道德水平',
      faces:[ { when:{ type:'gradeAtLeast', value:'S' }, options:[mkOpt('a','很高')] },
              { when:{ type:'gradeAtLeast', value:'A' }, options:[mkOpt('b','偏高')] },
              { when:{ type:'else' },                   options:[mkOpt('c','其他')] } ],
      options:[mkOpt('d','兜底')] };
    s.wheels = [MORAL, w];
    s.flow.grow = {};
    const at = label => { s.flow.path = label ? [{ wheelId:'wM', wheel:'道德水平', label, at:Date.now() }] : []; return T.wheelOptions(w).map(o => o.label).join(); };
    ok(at('SS（光明磊落）') === '很高', 'SS → 「很高」（第一条就命中）', at('SS（光明磊落）'));
    ok(at('A（安分守己）') === '偏高', 'A → 「偏高」（第一条不中，第二条中）', at('A（安分守己）'));
    ok(at('C（见利忘义）') === '其他', 'C → 「其他」（else 兜住）', at('C（见利忘义）'));
  }

  /* ---------- 9. 抽取用的选项列表也是当前面 ---------- */
  console.log('\n[9] 抽奖用的是当前面的选项（不是兜底面）');
  {
    s.wheels = [MORAL, FAME];
    s.flow.path = [{ wheelId:'wM', wheel:'道德水平', label:'A（安分守己）', at:Date.now() }];
    s.flow.grow = {};
    const opts = T.activeOptions(FAME).map(o => o.label);
    ok(opts.indexOf('EX（超凡入圣）') >= 0, 'activeOptions 走当前面', opts.join(' | '));
    ok(opts.indexOf('（兜底）默默无闻') < 0, '不含兜底面内容', opts.join(' | '));
    /* 真抽一次 */
    s.currentId = 'wF';
    s.settings.duration = 0.2;
    let spinErr = null;
    T.spin().catch(e => { spinErr = e.message; });
    await app.drainAsync(3000);
    await app.settle();
    ok(!spinErr, 'spin() 在多面转盘上不报错', spinErr || '');
    const got = s.history.length ? s.history[0].label : '(没抽到)';
    ok(['EX（超凡入圣）', 'S（家喻户晓）', 'A（小有名气）'].indexOf(got) >= 0,
       '抽出来的结果来自当前面：' + got, got);
  }

  /* ---------- 10. 数据文件往返（写出去 → 读回来，不能丢面） ---------- */
  console.log('\n[10] 写进 转盘/*.js 再读回来，面不能丢');
  {
    s.wheels = [MORAL, FAME];
    s.currentId = 'wM';
    /* 两种情况都要能写对：
       ① 手写的字面量（faceBy 是**名字**，和用户手改数据文件一样）
       ② 界面里点出来的（faceBy 是 **id**） */
    const textA = T.wheelFileText(FAME, 1);
    ok(textA.indexOf('"faceBy": "道德水平"') >= 0,
       '① faceBy 是名字时，原样写回名字', textA.match(/"faceBy":[^,]*/)[0]);

    /* 走一遍真正的读入：applyWheelFiles 会把名字解析成 id */
    const defs = [
      { name:'道德水平', order:1, grade:true, options:[{ label:'A（安分守己）' }, { label:'B（见义勇为）' }] },
      { name:'声望', order:2, multi:true, faceBy:'道德水平',
        faces:[ { when:{ type:'gradeAtLeast', value:'A' }, options:[{ label:'EX（超凡入圣）' }] },
                { when:{ type:'gradeAtMost', value:'B' },  options:[{ label:'EX（婴儿止啼）' }] } ],
        options:[{ label:'（兜底）默默无闻' }] }
    ];
    T.applyWheelFiles(defs);
    const back = T.state().wheels.filter(w => w.name === '声望')[0];
    const srcBack = T.state().wheels.filter(w => w.name === '道德水平')[0];
    ok(!!back, '读回来有「声望」这个转盘');
    ok(T.isMultiWheel(back), '读回来还是多面转盘', String(back.multi));
    ok(back.faces.length === 2, '两个面还在', String(back.faces.length));
    ok(!!srcBack && back.faceBy === srcBack.id, 'faceBy 解析成了「道德水平」的 id',
       (T.wheelById(back.faceBy) || {}).name || 'null');

    const textB = T.wheelFileText(back, 1);
    ok(textB.indexOf('"faceBy": "道德水平"') >= 0,
       '② faceBy 是 id 时，写出来还是名字（两种都指向同一个结果）', textB.match(/"faceBy":[^,]*/)[0]);
    ok(textB.indexOf('"multi": true') >= 0, '文件里有 "multi": true');
    ok(textB.indexOf('"gradeAtLeast"') >= 0 && textB.indexOf('"gradeAtMost"') >= 0, '两个面的条件都写进去了');
    ok(textB.indexOf('EX（超凡入圣）') >= 0 && textB.indexOf('EX（婴儿止啼）') >= 0, '两个面的选项都写进去了');
    ok(textB.indexOf('兜底面') >= 0, '文件注释里说明了兜底面');
    ok(textB.indexOf('"options": [') >= 0 && textB.indexOf('（兜底）默默无闻') >= 0, '兜底面也写进了 options');

    /* 读回来之后判定也要能用 */
    T.state().flow.path = [{ wheelId:srcBack.id, wheel:'道德水平', label:'A（安分守己）', at:Date.now() }];
    T.state().flow.grow = {};
    ok(T.wheelOptions(back).map(o => o.label).join() === 'EX（超凡入圣）', '读回来之后判定照常工作',
       T.wheelOptions(back).map(o => o.label).join());
    ok(T.wheelOptions(back).length === 1, '只返回当前命中面的选项', String(T.wheelOptions(back).length));
  }

  /* ---------- 11. 界面能渲染（多面相关的视图/标签） ---------- */
  console.log('\n[11] 界面渲染（多面的面板都要能打开）');
  {
    const app2 = loadApp();
    const T2 = app2.T, s2 = T2.state();
    await app2.drainAsync(3000);
    await app2.settle();
    s2.wheels = [MORAL, FAME];
    s2.currentId = 'wM';
    s2.flow = { enabled:true, rootId:'wM', autoJump:false, autoSpin:false, delay:1.6,
                path:[{ wheelId:'wM', wheel:'道德水平', label:'A（安分守己）', at:Date.now() }],
                pendingId:'', retStack:[], paused:false, roundAt:Date.now(), grow:{} };
    /* 「转盘」页要有多面标记 */
    let html = '';
    let err = null;
    try { T2.navTo('manager', { mtab:'wheels', force:true }); html = app2.byId['#sheet'].innerHTML; }
    catch(e){ err = e.message; }
    ok(!err, '「转盘」页渲染成功', err || '');
    ok(/data-act="toggleMulti"/.test(html), '「转盘」页有多面标记按钮');
    ok(/多面/.test(html), '「转盘」页显示「多面」字样');

    /* 内容页：多面转盘要出现「正在编辑哪一面」的条 */
    err = null;
    try { s2.currentId = 'wF'; T2.navTo('manager', { mtab:'content', force:true }); html = app2.byId['#sheet'].innerHTML; }
    catch(e){ err = e.message; }
    ok(!err, '「选项内容」页渲染成功', err || '');
    ok(/data-act="pickEditFace"/.test(html), '内容页有「切面」的按钮组');
    ok(/data-act="openFaces"/.test(html), '内容页有「管理面 / 条件」入口');
    ok(html.indexOf('超凡入圣') >= 0, '内容页显示的是当前命中那一面的内容', html.indexOf('超凡入圣') >= 0 ? '有' : '没有');

    /* 面管理面板 */
    err = null;
    try { T2.ui.faceWheelId = 'wF'; T2.navTo('faces', { force:true }); html = app2.byId['#sheet'].innerHTML; }
    catch(e){ err = e.message; }
    ok(!err, '「面管理」面板渲染成功', err || '');
    ok(/data-act="addFace"/.test(html), '有「加一个面」按钮');
    ok(/data-act="setFaceBy"/.test(html), '有「按哪个转盘分面」的选择');
    ok(/data-act="pickFaceWhen"/.test(html), '有「改条件」入口');
    ok(/兜底面/.test(html), '列出了兜底面');

    /* 条件编辑页 */
    err = null;
    try { T2.ui.faceWhenIdx = 0; T2.navTo('facewhen', { force:true }); html = app2.byId['#sheet'].innerHTML; }
    catch(e){ err = e.message; }
    ok(!err, '「条件编辑」页渲染成功', err || '');
    ok(/data-act="setFaceWhenType"/.test(html), '能选条件类型');
    ok(/data-act="setFaceWhenValue"/.test(html), '能选等级值');
    ok(/E-/.test(html) && /EX/.test(html), '等级档位从 E- 到 EX 都给出来了');

    /* 流程条上标出当前用的是哪一面 */
    err = null;
    try { T2.renderFlowBar(); } catch(e){ err = e.message; }
    ok(!err, '流程条渲染不报错', err || '');
  }

  /* ---------- 12. 界面动作真的能改数据 ---------- */
  console.log('\n[12] 面管理的动作（改条件 / 加面 / 删面 / 排序）');
  {
    const app3 = loadApp();
    const T3 = app3.T, s3 = T3.state();
    await app3.drainAsync(3000);
    await app3.settle();
    const act = (name, id, idx, val) => T3.handleAction(name, id,
      { dataset: Object.assign({ id:id }, idx == null ? {} : { idx:String(idx) }, val == null ? {} : { val:String(val) }),
        closest: () => null });
    /* 确认对话框在沙箱里没人点 → 自动点「确定」。
       （askDialog 把 resolve 挂在 #cOk.onclick 上，所以直接调它就行） */
    const autoConfirm = () => {
      const ok = app3.byId['#cOk'];
      if (ok && typeof ok.onclick === 'function') { const fn = ok.onclick; ok.onclick = null; fn(); }
    };
    s3.wheels = [MORAL, FAME];
    s3.currentId = 'wF';
    T3.ui.faceWheelId = 'wF';

    /* 加一个面 */
    const n0 = FAME.faces.length;
    await act('addFace', 'wF');
    ok(FAME.faces.length === n0 + 1, '加面生效', FAME.faces.length + ' 个面');

    /* 改条件 */
    T3.ui.faceWhenIdx = 0;
    await act('setFaceWhenType', null, null, 'gradeIs');
    ok(FAME.faces[0].when.type === 'gradeIs', '改条件类型生效', JSON.stringify(FAME.faces[0].when));
    await act('setFaceWhenValue', null, null, 'SS');
    ok(FAME.faces[0].when.value === 'SS', '改条件的值生效', JSON.stringify(FAME.faces[0].when));

    /* 排序：把第 2 面挪到第 1 位 */
    const secondVal = FAME.faces[1].when.value;
    await act('faceUp', 'wF', 1);
    ok(FAME.faces[0].when.value === secondVal, '「上移」把第 2 面挪到了第 1 位',
       FAME.faces.map(f => f.when.value).join(' , '));

    /* 删面：里面会弹确认框，先排好自动确认 */
    const n1 = FAME.faces.length;
    const delP = act('delFace', 'wF', 0);
    await app3.settle();
    autoConfirm();
    await delP;
    ok(FAME.faces.length === n1 - 1, '删面生效（确认后真的删了）', FAME.faces.length + ' 个面');
  }

  console.log('\n通过 ' + pass + ' / 失败 ' + fail);
  process.exit(fail ? 1 : 0);
})();
