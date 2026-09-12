/* ★ 成长 → 维度图 的联动 —— 这一项是用户报的"第二张图没有成长"催生的。
   node _dev/t12_growth.js

   覆盖三件事：
     ① 成长转盘的**哪些选项**会升级、哪些不该升级（用户特地提醒"你自己判断"）
     ② 升级后**两张图都要体现**（位置=某转盘之后 / 位置=所有转盘之后 是两条不同的代码路径）
     ③ 变形动画的起点数据（fromVals）也要用成长后的值 */
'use strict';
const { loadApp } = require('./harness');
let pass = 0, fail = 0;
const ok = (c, m, e) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + (e ? '  → ' + e : '')); } };
const mkOpt = (id, label) => ({ id, label, weight:1, color:null, next:'' });
const mk = (id, name, labels, extra) => Object.assign({
  id, name, next:'', branch:false, grade:null, removeAfterPick:false,
  options: labels.map((l, i) => mkOpt(id + '_' + i, l))
}, extra || {});

function scenario(){
  const app = loadApp();
  const T = app.T, s = T.state();
  s.wheels = [
    mk('wA', '咒力总量', ['E（很弱）', 'D（偏低）', 'C（普通）', 'EX（离谱）'], { grade:true }),
    mk('g1', '事件成长', ['虚度光阴（无属性成长）', '咒力总量+1', '咒力总量+2',
                          '我掌握了咒力的核心！（咒操与效率+1）', '学会反转术式', '体术+1'], { branch:true }),
    mk('wB', '体术水平', ['C（普通）', 'B（还行）', 'A（不错）'], { grade:true }),
    mk('wC', '咒力操纵', ['D（偏低）', 'C（普通）'], { grade:true }),
    mk('wD', '咒力效率', ['D（偏低）', 'C（普通）'], { grade:true })
  ];
  s.currentId = 'wA';
  s.settings.chartMid = false;
  s.charts = [
    { id:'c1', name:'维度图①', after:'wA', at:Date.now(), dims:[] },   // 走 dimsUpTo
    { id:'c2', name:'维度图②', after:'',   at:Date.now(), dims:[] }    // 走 chartDims
  ];
  s.flow = { enabled:true, rootId:'wA', autoJump:false, autoSpin:false, delay:99,
             path:[], pendingId:'', retStack:[], paused:false, roundAt:Date.now(), grow:{} };
  const step = (wheel, label) => {
    s.flow.path.push({ wheelId:wheel.id, wheel:wheel.name, label, at:Date.now() });
    T.applyGrowth(label);
  };
  const byName = n => s.wheels.filter(w => w.name === n)[0];
  const val = (item, wheelName) => {
    const d = T.chartLiveDims(item).filter(x => x.wheel === wheelName)[0];
    return d ? d.label : '(不在图里)';
  };
  return { app, T, s, step, byName, val };
}

(async function(){
  /* ---------- 1. 成长转盘里哪些选项会升级 ---------- */
  console.log('\n[1] 成长转盘的选项解析（用户提醒：不是所有选项都影响维度图）');
  {
    const { T } = scenario();
    const parse = label => (T.parseGrowth(label) || []).map(x => x.wheel.name + '+' + x.steps);
    const cases = [
      ['虚度光阴（无属性成长）', [], '明确不成长'],
      ['虚度光阴',               [], '不带括号也认'],
      ['咒力总量+1',             ['咒力总量+1'], '最简单的 +N'],
      ['咒力总量+2',             ['咒力总量+2'], '＋2'],
      ['体术+1',                 ['体术水平+1'], '简称「体术」要映射到「体术水平」'],
      ['评级+1',                 [], '别名指向不存在的盘 → 忽略（不报错）'],
      ['我掌握了咒力的核心！（咒操与效率+1）', ['咒力操纵+1', '咒力效率+1'], '括号里两个目标共用 +1'],
      ['学会反转术式',           [], '没有 +N，不该误判成成长'],
      ['高级技巧+2',             [], '目标盘不存在时安静忽略']
    ];
    cases.forEach(([label, want, why]) => {
      const got = parse(label);
      ok(JSON.stringify(got) === JSON.stringify(want), '「' + label + '」→ ' + (got.join(' / ') || '不成长') + '（' + why + '）',
         '得到 ' + JSON.stringify(got) + '，期望 ' + JSON.stringify(want));
    });
  }

  /* ---------- 2. 成长后两张图都要体现 ---------- */
  console.log('\n[2] 成长后「两张图」都要体现（两条不同的代码路径）');
  {
    const { T, s, step, byName, val } = scenario();
    const A = byName('咒力总量'), G = byName('事件成长');
    step(A, 'E（很弱）');
    const before1 = val(s.charts[0], '咒力总量');
    const before2 = val(s.charts[1], '咒力总量');
    ok(before1 === 'E（很弱）' && before2 === 'E（很弱）', '成长前两张图都是 E（很弱）', before1 + ' / ' + before2);

    step(G, '咒力总量+2');
    const after1 = val(s.charts[0], '咒力总量');
    const after2 = val(s.charts[1], '咒力总量');
    console.log('     图①(位置=wA之后)      = ' + after1);
    console.log('     图②(位置=所有转盘之后) = ' + after2);
    ok(after1 === 'C（普通）', '图①（dimsUpTo 路径）体现了成长 E→C', after1);
    ok(after2 === 'C（普通）', '★ 图②（chartDims 路径）也体现了成长 E→C —— 就是这次修的 bug', after2);

    /* 数字也要跟着涨（雷达图半径用的是 value） */
    const v1 = T.chartLiveDims(s.charts[0])[0].value;
    const v2 = T.chartLiveDims(s.charts[1])[0].value;
    ok(v1 === 40 && v2 === 40, '两张图的分数都从 20 涨到 40', v1 + ' / ' + v2);
  }

  /* ---------- 3. 成长封顶 / 多步叠加 ---------- */
  console.log('\n[3] 多次成长叠加与封顶（阶梯 E- E D C B A S SS SSS EX）');
  {
    const { T, s, step, byName, val } = scenario();
    const A = byName('咒力总量'), G = byName('事件成长');
    step(A, 'E（很弱）');
    step(G, '咒力总量+2');          // E → D 是 +1，E → C 是 +2
    ok(val(s.charts[1], '咒力总量') === 'C（普通）', 'E +2 → C', val(s.charts[1], '咒力总量'));
    step(G, '咒力总量+2');          // C → B → A
    const lvA = val(s.charts[1], '咒力总量');
    ok(/^A/.test(lvA), 'C +2 → A（不是直接跳 EX）', lvA);
    ok(T.chartLiveDims(s.charts[1]).filter(d => d.wheel === '咒力总量')[0].value === 60,
       '分数 40 → 60', String(T.chartLiveDims(s.charts[1]).filter(d => d.wheel === '咒力总量')[0].value));
    step(G, '咒力总量+2');          // A → S → SS
    ok(/^SS/.test(val(s.charts[1], '咒力总量')), 'A +2 → SS', val(s.charts[1], '咒力总量'));
    /* 一直加到底，再确认封顶 */
    for (let i = 0; i < 6; i++) step(G, '咒力总量+2');
    const top = val(s.charts[1], '咒力总量');
    ok(/EX/.test(top), '加到底就是 EX（封顶，不越界）', top);
    for (let i = 0; i < 4; i++) step(G, '咒力总量+2');
    ok(/EX/.test(val(s.charts[1], '咒力总量')), '继续加还是 EX（真的封顶了）', val(s.charts[1], '咒力总量'));
  }

  /* ---------- 4. 变形动画的起点也是成长后的值 ---------- */
  console.log('\n[4] 打开图②时的「变形起点」也应该是成长后的值');
  {
    const { app, T, s, step, byName } = scenario();
    const A = byName('咒力总量'), G = byName('事件成长');
    step(A, 'E（很弱）');
    step(G, '咒力总量+2');
    T.ui.chartItem = s.charts[1];
    T.navTo('chart', { force:true });
    await app.drainAsync(300);
    const from = T.ui.chartFrom || [];
    console.log('     chartFrom = ' + JSON.stringify(from.map(d => d.wheel + '=' + d.label)));
    ok(from.length === 0 || from.every(d => d.value >= 40),
       '起点的值不会是"未成长的 20"（图①②都是第一张，所以这里通常为空）',
       JSON.stringify(from));
    /* 再建第三张图，起点 = 上一张（图②），必须是成长后的 */
    T.ui.chartItem = s.charts[1];
    s.charts.push({ id:'c3', name:'维度图③', after:'', at:Date.now(), dims:[] });
    T.ui.chartItem = s.charts[2];
    T.navTo('chart', { force:true });
    await app.drainAsync(300);
    const from2 = (T.ui.chartFrom || []);
    console.log('     开第三张时 chartFrom = ' + JSON.stringify(from2.map(d => d.wheel + '=' + d.label)));
    ok(from2.length > 0 && from2.every(d => d.value >= 40), '第三张的起点用的是成长后的值（≥40，不是 20）',
       JSON.stringify(from2.map(d => d.value)));
  }

  /* ---------- 5. 位置语义没被改坏 ---------- */
  console.log('\n[5] 位置语义仍然正确');
  {
    const { T, s, step, byName, val } = scenario();
    const A = byName('咒力总量'), B = byName('体术水平');
    step(A, 'E（很弱）');
    step(B, 'C（普通）');
    /* 图① 在 wA 之后 → 不该有 体术水平 */
    const d1 = T.chartLiveDims(s.charts[0]).map(d => d.wheel);
    ok(d1.indexOf('体术水平') < 0, '位置=wA之后 的图里没有「体术水平」（它排在更后面）', d1.join(', '));
    /* 图② 在所有之后 → 两个都在 */
    const d2 = T.chartLiveDims(s.charts[1]).map(d => d.wheel);
    ok(d2.indexOf('体术水平') >= 0 && d2.indexOf('咒力总量') >= 0, '位置=所有之后 的图里两个都在', d2.join(', '));
    /* 定位到 wC 之后的图 → 包含 wA/wB/wC，不包含 wD */
    s.charts.push({ id:'c9', name:'图·wC之后', after:'wC', at:Date.now(), dims:[] });
    const d3 = T.chartLiveDims(s.charts[2]).map(d => d.wheel);
    ok(d3.indexOf('咒力效率') < 0, '位置=wC之后 的图里没有更靠后的「咒力效率」', d3.join(', '));
  }

  console.log('\n通过 ' + pass + ' / 失败 ' + fail);
  process.exit(fail ? 1 : 0);
})();
