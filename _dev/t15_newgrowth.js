/* 「我新加一个属性成长，系统还能统计到吗？」
   node _dev/t15_newgrowth.js

   结论预告：
     ✅ 只要**成长文字里那个词，能对上牌组里某个转盘的名字**（部分匹配也算），就自动生效 ——
        **不需要改任何代码、也不需要维护别名表**。
     ✅ 成长会一路传到维度图（只要那个属性盘被认成"属性盘"）。
     ❌ 对不上名字 / 名字超过 24 字 / 有歧义 的时候会**安静地不生效**（不报错）——
        这是唯一需要小心的三种情况，下面逐个验证。 */
'use strict';
const { loadApp } = require('./harness');
let pass = 0, fail = 0;
const ok = (c, m, e) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + (e ? '  → ' + e : '')); } };
const mkOpt = (id, label) => ({ id, label, weight:1, color:null, next:'' });
const mk = (id, name, labels, extra) => Object.assign({
  id, name, next:'', branch:false, grade:null, removeAfterPick:false,
  multi:false, faceBy:'', faces:[],
  options: labels.map((l, i) => mkOpt(id + '_' + i, l))
}, extra || {});

const app = loadApp();
const T = app.T, s = T.state();
const setWheels = list => { s.wheels = list; s.flow.path = []; s.flow.grow = {}; };
const target = label => (T.parseGrowth(label) || []).map(x => x.wheel.name + '+' + x.steps);
const one = (label) => (target(label).join() || '（不成长）');

(async function(){
  await app.drainAsync(3000);
  await app.settle();

  /* 一套"用户自定义"的牌组：转盘名都是他自己起的 */
  const MINE = [
    mk('a', '阴阳术水平', ['E（很弱）', 'C（普通）', 'S（很强）'], { grade:true }),
    mk('b', '剑术造诣',   ['D（偏低）', 'B（还行）'], { grade:true }),
    mk('c', '人脉',       ['没有', '有几个', '很多'], {}),          // 数字型、非等级
    mk('d', '这个转盘的名字特别长超过二十四个字了吧', ['A（不错）', 'S（很强）'], { grade:true }),
    mk('e', '咒力操纵',   ['E（很弱）', 'C（普通）'], { grade:true }),
    mk('f', '咒力效率',   ['E（很弱）', 'C（普通）'], { grade:true }),
    mk('g', '体质（基础体质）', ['E（很弱）', 'C（普通）'], { grade:true })
  ];

  console.log('\n[1] 直接用转盘全名写成长 —— 应该自动生效');
  setWheels(MINE);
  ok(one('阴阳术水平+1') === '阴阳术水平+1', '「阴阳术水平+1」', one('阴阳术水平+1'));
  ok(one('剑术造诣+2') === '剑术造诣+2', '「剑术造诣+2」', one('剑术造诣+2'));
  ok(one('人脉+1') === '人脉+1', '非等级的「人脉+1」也识别（只是不进维度图）', one('人脉+1'));

  console.log('\n[2] 用转盘名的**一部分**写 —— 也能对上（部分匹配）');
  ok(one('阴阳术+1') === '阴阳术水平+1', '「阴阳术+1」→ 阴阳术水平', one('阴阳术+1'));
  ok(one('剑术+1') === '剑术造诣+1', '「剑术+1」→ 剑术造诣', one('剑术+1'));
  ok(one('造诣+1') === '剑术造诣+1', '「造诣+1」→ 剑术造诣', one('造诣+1'));

  console.log('\n[3] 内置的简称别名（GROW_ALIAS）仍然有效');
  ok(one('咒操+1') === '咒力操纵+1', '「咒操+1」→ 咒力操纵（走别名表）', one('咒操+1'));
  ok(one('效率+1') === '咒力效率+1', '「效率+1」→ 咒力效率', one('效率+1'));
  ok(one('操纵+1') === '咒力操纵+1', '「操纵+1」→ 咒力操纵', one('操纵+1'));

  console.log('\n[4] 括号相关的各种写法');
  ok(one('我悟了！（阴阳术与剑术+1）') === '阴阳术水平+1,剑术造诣+1',
     '「我悟了！（阴阳术与剑术+1）」→ 两个目标各 +1', one('我悟了！（阴阳术与剑术+1）'));
  ok(one('我悟了！（阴阳术+1）（剑术+2）') === '阴阳术水平+1,剑术造诣+2',
     '多个括号各算各的：「（阴阳术+1）（剑术+2）」', one('我悟了！（阴阳术+1）（剑术+2）'));
  ok(one('体质（基础体质）+1') === '体质（基础体质）+1',
     '★ 写**全名带括号**：「体质（基础体质）+1」也能认（以前认不出来）', one('体质（基础体质）+1'));
  ok(one('体质+1') === '体质（基础体质）+1', '简称「体质+1」照样认（走别名表）', one('体质+1'));
  ok(one('我悟了！（咒操与效率+1）') === '咒力操纵+1,咒力效率+1',
     '「（咒操与效率+1）」→ 咒操→咒力操纵、效率→咒力效率（都走别名表）', one('我悟了！（咒操与效率+1）'));
  /* 不该被误认成成长的 */
  ok(one('我悟了！（无属性成长）') === '（不成长）', '「（无属性成长）」不成长', one('我悟了！（无属性成长）'));
  ok(one('学会了什么（没有加号）') === '（不成长）', '括号里没有 +N → 不成长', one('学会了什么（没有加号）'));
  ok(one('随便写点什么') === '（不成长）', '普通文字不成长', one('随便写点什么'));

  /* ---------- 5. 什么情况会"安静地不生效" ---------- */
  console.log('\n[5] 什么情况会"安静地不生效"（这是唯一要小心的）');
  ok(one('法术水平+1') === '（不成长）',
     '① 名字对不上（写错字）→ 不成长、不报错。得和转盘名一致', one('法术水平+1'));  /* ⚠️ 我一开始猜了三个"会失败"的情况，实测下来**两个是错的**：
     · 名字很长（27 字）→ 照样命中（正则抓的是 + 前最多 24 字，那片段总是名字的子串）
     · 名字里有空格/括号 → 也会在分隔符处截断，截出来的前缀仍然是名字的子串 → 照样命中
     （「体质（基础体质）」还额外有别名表兜着）
     真正会失败的只有「名字对不上」和「有歧义」，如实记在这里。 */
  const longName = '这个转盘的名字真的特别特别长绝对超过二十四个字了好长啊';
  setWheels(MINE.concat([ mk('L', longName, ['A（不错）', 'S（很强）'], { grade:true }) ]));
  ok(one(longName + '+1') === longName + '+1',
     '② 名字很长（' + longName.length + ' 字）也能命中 —— 长名字不是问题', one(longName + '+1'));

  {
    setWheels([ mk('T', '忍术 水平', ['A（不错）', 'S（很强）'], { grade:true }) ]);
    s.flow.path = []; s.flow.grow = {};
    ok(one('忍术 水平+1') === '忍术 水平+1', '③ 名字里带**空格**也能命中（在空格处截断，前缀仍是子串）', one('忍术 水平+1'));
    ok(one('忍术+1') === '忍术 水平+1', '   只写前面一段也行', one('忍术+1'));
  }
  {
    setWheels([ mk('Q', '体质（基础体质）', ['E（很弱）', 'C（普通）'], { grade:true }) ]);
    s.flow.path = []; s.flow.grow = {};
    ok(one('体质（基础体质）+1') === '体质（基础体质）+1', '④ 名字里有**括号**也能命中', one('体质（基础体质）+1'));
    ok(one('体质+1') === '体质（基础体质）+1', '   简称「体质」也行（别名表）', one('体质+1'));
  }

  /* 歧义：两个转盘名字都以「咒力」开头 */
  setWheels([
    mk('x', '咒力总量', ['E（很弱）', 'C（普通）'], { grade:true }),
    mk('y', '咒力操纵', ['E（很弱）', 'C（普通）'], { grade:true })
  ]);
  ok(one('咒力+1') === '咒力总量+1',
     '⑤ 有歧义（「咒力」同时能匹配两个盘）→ 取**列表里靠前**的那个', one('咒力+1'));
  ok(one('咒力操纵+1') === '咒力操纵+1', '   写全名就没有歧义', one('咒力操纵+1'));

  console.log('\n[6] 在「多面转盘」里加成长 —— 按当前命中的那一面认属性盘');
  {
    const multi = {
      id:'m1', name:'声望', next:'', branch:false, grade:null, removeAfterPick:false,
      multi:true, faceBy:'a',
      faces:[ { when:{ type:'gradeAtLeast', value:'A' }, options:[mkOpt('mh','SS（光明磊落）'), mkOpt('mh2','S（乐善好施）')] } ],
      options:[mkOpt('md','（兜底）默默无闻')]
    };
    setWheels([MINE[0], multi]);
    s.flow.path = [{ wheelId:'a', wheel:'阴阳术水平', label:'A（不错）', at:Date.now() }];
    s.flow.grow = {};
    ok(T.isGradeWheel(multi), '命中高等级面（内容是等级）→ 认成属性盘', String(T.isGradeWheel(multi)));
    s.flow.path = [];
    ok(!T.isGradeWheel(multi), '没命中面（兜底面是文字）→ 不认成属性盘', String(T.isGradeWheel(multi)));
  }

  /* ---------- 7. 关键：新加的成长能不能一路传到维度图 ---------- */
  console.log('\n[7] ★ 新加的属性成长，维度图能不能统计到');
  {
    const A = mk('a', '阴阳术水平', ['E（很弱）', 'D（偏低）', 'C（普通）', 'B（还行）', 'A（不错）', 'S（很强）'], { grade:true });
    const B = mk('b', '剑术造诣',   ['D（偏低）', 'C（普通）', 'B（还行）'], { grade:true });
    setWheels([A, B]);
    s.charts = [{ id:'c1', name:'图', after:'', at:Date.now(), dims:[] }];
    s.currentId = 'a';

    /* 先抽两个属性盘 */
    s.flow.path.push({ wheelId:'a', wheel:'阴阳术水平', label:'E（很弱）', at:Date.now() });
    s.flow.path.push({ wheelId:'b', wheel:'剑术造诣',   label:'D（偏低）', at:Date.now() });
    let d = T.chartLiveDims(s.charts[0]);
    console.log('     成长前：' + d.map(x => x.wheel + '=' + x.label + '(' + x.value + ')').join('  '));
    ok(d.length === 2, '两个属性盘都进了图', String(d.length));
    ok(d[0].value === 20 && d[1].value === 30, '初始分值 20 / 30', d.map(x => x.value).join(' / '));

    /* 走成长盘，抽到「阴阳术+2」（用的是**部分匹配**的写法） */
    s.flow.path.push({ wheelId:'g', wheel:'成长', label:'阴阳术+2', at:Date.now() });
    T.applyGrowth('阴阳术+2');
    d = T.chartLiveDims(s.charts[0]);
    console.log('     「阴阳术+2」后：' + d.map(x => x.wheel + '=' + x.label + '(' + x.value + ')').join('  '));
    ok(d[0].value === 40, 'E +2 → C（40 分）', String(d[0].value));
    ok(d[1].value === 30, '没被成长的那个不受影响', String(d[1].value));
    ok(s.flow.grow.a === 2, '成长记在 flow.grow 里', JSON.stringify(s.flow.grow));

    /* 再抽到另一种写法 */
    s.flow.path.push({ wheelId:'g', wheel:'成长', label:'造诣+1', at:Date.now() });
    T.applyGrowth('造诣+1');
    d = T.chartLiveDims(s.charts[0]);
    console.log('     「造诣+1」后：' + d.map(x => x.wheel + '=' + x.label + '(' + x.value + ')').join('  '));
    ok(d[1].value === 40, '剑术造诣 D +1 → C（40 分）', String(d[1].value));

    /* 位置=某转盘之后的那条路径也要一致 */
    s.charts.push({ id:'c2', name:'图2', after:'a', at:Date.now(), dims:[] });
    const d2 = T.chartLiveDims(s.charts[1]);
    console.log('     位置=「a 之后」的图：' + d2.map(x => x.wheel + '=' + x.label).join('  '));
    ok(d2[0].label.indexOf('C') === 0, 'dimsUpTo 那条路径也带成长', d2[0].label);
  }

  /* ---------- 8. 数字型属性的成长 ---------- */
  console.log('\n[8] 数字型属性（没有等级，按该盘自己的选项数字递增）');
  {
    /* 真实数据里的样子：19-高级技巧会几个.js = 3个 / 2个 / 4个 / 1个 / 不会 / 5个 */
    const R = mk('r', '高级技巧会几个', ['3个', '2个', '4个', '1个', '不会', '5个'], { grade:false });
    setWheels([R]);
    s.currentId = 'r';
    s.flow.path = [{ wheelId:'r', wheel:'高级技巧会几个', label:'1个', at:Date.now() }];
    s.flow.grow = {};
    s.flow.grow = {};
    s.flow.grow.r = 1;
    ok(T.grownLabel('r', '1个') === '2个', '「1个」+1 → 「2个」', T.grownLabel('r', '1个'));
    s.flow.grow.r = 3;
    ok(T.grownLabel('r', '1个') === '4个', '+3 → 「4个」', T.grownLabel('r', '1个'));
    s.flow.grow.r = 9;
    ok(T.grownLabel('r', '1个') === '5个', '加过头 → 「5个」（该盘最大，封顶）', T.grownLabel('r', '1个'));
    s.flow.grow.r = 1;
    ok(T.grownLabel('r', '不会') === '1个', '「不会」当成 0 → +1 得「1个」（阶梯 不会<1个<2个…）', T.grownLabel('r', '不会'));
    console.log('     ↑ 注意：从「不会」涨一级是「1个」，不是「2个」—— 0+1=1');
    /* 「高级技巧+1」这种简称能对上（部分匹配） */
    setWheels([R]);
    s.flow.path = [];
    ok(one('高级技巧+1') === '高级技巧会几个+1', '「高级技巧+1」→ 高级技巧会几个（部分匹配）', one('高级技巧+1'));
    console.log('     ⚠️ 文字型（没有数字）的选项不会递增 —— 递增靠的是从标签里提取数字');
    const W = mk('w', '人脉', ['没有', '有几个', '很多'], { grade:false });
    setWheels([W]);
    s.flow.grow = { w: 2 };
    ok(T.grownLabel('w', '没有') === '没有', '「没有/有几个/很多」这种没有数字的，成长不生效',
       T.grownLabel('w', '没有'));
    console.log('     → 想让它们能成长，选项里写上数字（如「3个」），或改用等级标签');
  }

  console.log('\n通过 ' + pass + ' / 失败 ' + fail);
  process.exit(fail ? 1 : 0);
})();
