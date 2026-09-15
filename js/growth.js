/* 咒术转盘 · 属性成长：等级解析、成长规则与属性汇总
   （阶段 C 从 index.html 内联脚本拆出；仍是无构建普通 <script>，只经 ZW 命名空间互通） */
(function(){
'use strict';
const { $, save, state, wheelById, wheelOptions } = ZW;

const GRADES = { F:1, E:2, D:3, C:4, B:5, A:6, S:7, SS:8, SSS:9, EX:10 };

function parseGrade(label){
  const m = String(label == null ? '' : label).match(/^\s*(EX|SSS|SS|S|A|B|C|D|E|F)\s*([+\-＋－]?)/i);
  if (!m) return null;
  let v = GRADES[m[1].toUpperCase()];
  if (v == null) return null;
  if (m[2] === '+' || m[2] === '＋') v += 0.3;
  else if (m[2] === '-' || m[2] === '－') v -= 0.3;
  return Math.max(0, Math.min(10, v));
}
/* 这个转盘算不算「属性盘」：手动指定优先，否则看选项里等级标签的比例
   注意：按「当前展示的全部选项」判断，不受临时停用（权重 0）影响；
        多面转盘按**当前命中的那一面**看。 */

function isGradeWheel(w){
  if (!w) return false;
  if (w.grade === true) return true;
  if (w.grade === false) return false;
  const opts = wheelOptions(w);
  if (!opts.length) return false;
  const hit = opts.filter(o => parseGrade(o.label) != null).length;
  return hit >= Math.ceil(opts.length * 0.6);
}
/* ===== 成长：转到「XX+N」就给对应属性升 N 级（EX 封顶） ===== */

const GRADE_LADDER = ['E-', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'EX'];
/* 简称 → 转盘名（成长转盘里写的是「体术」「评级」这种简称） */

/* 简称 → 转盘名（成长转盘里写的是「体术」「评级」这种简称） */
const GROW_ALIAS = [
  ['体术', '体术水平'], ['体质', '体质（基础体质）'], ['咒操', '咒力操纵'], ['操纵', '咒力操纵'],
  ['效率', '咒力效率'], ['评级', '等级评定'], ['高级技巧', '高级技巧会几个'],
  ['颜值', '穿越后的颜值'], ['道德', '道德水平'], ['咒力总量', '咒力总量'], ['天赋', '天赋']
];
/* 成长文字里那个「名字」最长多少字。
   ⚠️ 超过这个长度就解析不到（会安静地不生效）—— 所以：
      · 转盘名超过 24 字的，写成长时请用简称（部分匹配也算），或者把转盘名改短
      · 编辑器里会对过长的写法给出提示，见 growHintFor() */

const GROW_WORD_MAX = 24;

function growTargetWheel(word){
  const clean = String(word || '').replace(/[\s（(【\[].*$/, '').replace(/[的了之]$/, '').trim();
  if (!clean) return null;
  const ws = state.wheels || [];
  let w = ws.filter(x => x.name === clean)[0];
  if (!w) w = ws.filter(x => x.name.indexOf(clean) >= 0)[0];
  if (!w) {
    const a = GROW_ALIAS.filter(pr => clean.indexOf(pr[0]) >= 0 || pr[0].indexOf(clean) >= 0)[0];
    if (a) w = ws.filter(x => x.name === a[1])[0] || ws.filter(x => x.name.indexOf(a[1].replace(/（.*$/, '')) >= 0)[0];
  }
  return w || null;
}
/* 编辑器用：这个成长写法能不能对上转盘？
   返回 null 表示没问题；否则返回一句提示。 */

function growHintFor(label){
  const s = String(label || '');
  if (!/[＋+]/.test(s)) return null;
  if (/无属性成长|虚度光阴/.test(s)) return null;          // 明确不成长
  const words = [];
  const mAll = s.match(/[（(]([^）)]*)[＋+]/);
  [mAll ? mAll[1] : null, s].filter(Boolean).forEach(body => {
    const re = new RegExp('([^＋+\\d（()）]{1,' + GROW_WORD_MAX + '}?)\\s*[＋+]\\s*(\\d+)', 'g');
    let m;
    while ((m = re.exec(body))) m[1].split(/[与和、,，]/).forEach(nm => words.push(nm));
  });
  if (!words.length) return null;                          // 没解析到词，不以为是成长
  const bad = words.filter(w => !growTargetWheel(w));
  if (bad.length) return '看不出「' + bad.join('、') + '」对应哪个转盘 —— 这个成长不会生效（写转盘名或它的一部分）';
  /* 词太长的情况：整体写法可能已经被正则截断 */
  if (s.length > GROW_WORD_MAX && !/无属性成长/.test(s)) {
    const anyByName = words.some(w => growTargetWheel(w));
    if (!anyByName && s.length > GROW_WORD_MAX) return '写法太长了，成长词最多 ' + GROW_WORD_MAX + ' 字';
  }
  return null;
}
/* 解析一次抽屉结果的成长项：[{ wheel, steps }]；「虚度光阴（无属性成长）」返回空
   支持这些写法：
     体术+1                        简称（走别名表）
     咒力操纵+1 / 剑术造诣+1        转盘名（或名字的一部分）
     体质（基础体质）+1             **写全名、带括号**也行（见下面"括号名"那段）
     我掌握了咒力的核心！（咒操与效率+1）   括号里的补充说明；「与/和/、」隔开的多目标共用 +N
     我悟了！（阴阳术+1）（剑术+1）         多个括号各算各的 */

function parseGrowth(label){
  const s = String(label || '');
  if (/无属性成长|虚度光阴/.test(s)) return [];
  const out = [], seen = {};
  const push = (word, n) => {
    const w = growTargetWheel(word);
    if (!w || seen[w.id]) return;
    seen[w.id] = 1;
    out.push({ wheel: w, steps: Math.max(1, Math.min(5, n)) });
  };
  const scan = (body, allowParens) => {
    /* allowParens：允许匹配段里出现括号 —— 用来认「（咒操与效率+1）」这种整段，
       以及「体质（基础体质）+1」这种名字自带括号的写法 */
    const cls = allowParens ? '[^＋+\\d）)]' : '[^＋+\\d（()）]';
    const re = new RegExp('(' + cls + '{1,' + GROW_WORD_MAX + '}?)\\s*[＋+]\\s*(\\d+)', 'g');
    let m;
    while ((m = re.exec(body))) {
      const n = parseInt(m[2], 10) || 1;
      m[1].split(/[与和、,，]/).forEach(nm => push(nm, n));   // 「咒操与效率+1」→ 两个目标共用 +1
    }
  };
  scan(s, false);                       // ① 正常扫一遍（不含括号的写法）
  /* ② 名字自带括号的情况：「体质（基础体质）+1」
        上面的扫描会在括号处截断，解析不出「体质（基础体质）」→ 这里补一轮特殊处理。
        做法：找「（…）」紧跟 +N 的片段，把括号里的内容**并进**它前面的词。
        ⚠️ 这一步只在"值本身带括号"时才做，避免把「我悟了！（阴阳术+1）」
           这种"说明文字里带成长"的写法误读成一整个长名字。 */
  {
    const re2 = /([^＋+\d（()）]{1,24})\s*[（(]([^）)]*)[）)]\s*[＋+]\s*(\d+)/g;
    let m2;
    while ((m2 = re2.exec(s))) {
      const n = parseInt(m2[3], 10) || 1;
      if (growTargetWheel(m2[1] + '（' + m2[2] + '）')) push(m2[1] + '（' + m2[2] + '）', n);
    }
  }
  /* ③ 括号里的补充说明也可能带成长：我掌握了咒力的核心！（咒操与效率+1）
        也可能有多个括号：我悟了！（阴阳术+1）（剑术+1） */
  {
    const re3 = new RegExp('[（(]([^）)]{1,80}?)[）)]\\s*(?=[（(]|$)', 'g');
    let m3;
    while ((m3 = re3.exec(s))) scan(m3[1], true);
  }
  return out;
}
/* 把标签沿「阶梯」上移 steps 级：等级型走 E-…EX，数字型（3个/不会）按该盘自己的选项排序，顶格即封顶 */

/* 把标签沿「阶梯」上移 steps 级：等级型走 E-…EX，数字型（3个/不会）按该盘自己的选项排序，顶格即封顶 */
function growLabel(wheel, label, steps){
  if (!wheel || !steps) return label;
  const base = String(label || '').replace(/[（(].*$/, '').trim();
  const li = GRADE_LADDER.indexOf(base);
  if (li >= 0) {
    const next = GRADE_LADDER[Math.min(GRADE_LADDER.length - 1, li + steps)];
    /* 在该盘**当前展示的**选项里找哪一项是这个等级（多面转盘要看当前那一面） */
    const full = wheelOptions(wheel).filter(o => String(o.label).replace(/[（(].*$/, '').trim() === next)[0];
    return full ? full.label : next;      // 「C」→ 该盘里的「C（三级）」
  }
  const numOf = v => { const m = String(v).match(/(\d+)/); return m ? parseInt(m[1], 10) : (/不会|无|零/.test(v) ? 0 : null); };
  const cur = numOf(base);
  if (cur != null) {
    const opts = wheelOptions(wheel);
    const nums = opts.map(o => numOf(o.label)).filter(v => v != null).sort((a, b) => a - b);
    if (nums.length) {
      const want = Math.min(nums[nums.length - 1], cur + steps);
      const hit = opts.filter(o => numOf(o.label) === want)[0];
      if (hit) return hit.label;
    }
  }
  return label;
}
/* 叠加本轮已累计的成长 */

/* 叠加本轮已累计的成长 */
function grownLabel(wheelId, label){
  const g = (state.flow.grow || {})[wheelId];
  if (!g || label == null) return label;
  return growLabel(wheelById(wheelId), label, g);
}
/* 本轮某个属性最近一次抽到的原始标签 */

/* 本轮某个属性最近一次抽到的原始标签 */
function lastLabelOf(wheelId){
  const path = state.flow.path || [];
  for (let i = path.length - 1; i >= 0; i--) if (path[i].wheelId === wheelId) return path[i].label;
  const his = state.history || [];
  for (let i = 0; i < his.length; i++) if ((his[i].wheelId || his[i].wheel) === wheelId) return his[i].label;
  return null;
}
/* 抽到成长选项时调用：累计 + 提示 */

/* 抽到成长选项时调用：累计 + 提示 */
function applyGrowth(label){
  const list = parseGrowth(label);
  if (!list.length) return false;
  if (!Array.isArray(state.flow.path)) state.flow.path = [];
  if (!state.flow.grow || typeof state.flow.grow !== 'object') state.flow.grow = {};
  const msgs = [];
  list.forEach(({ wheel, steps }) => {
    const raw = lastLabelOf(wheel.id);
    const before = raw == null ? null : grownLabel(wheel.id, raw);
    const beforeTxt = before || '—';
    const grown = grownLabel(wheel.id, raw == null ? growLabel(wheel, GRADE_LADDER[0], 0) : raw);
    const after = raw == null ? null : growLabel(wheel, before, steps);
    const capped = before != null && after === before;
    state.flow.grow[wheel.id] = Math.min(9, (state.flow.grow[wheel.id] || 0) + steps);
    if (after != null) msgs.push(wheel.name + ' ' + beforeTxt + ' → ' + after + (capped ? '（已封顶）' : ''));
    else msgs.push(wheel.name + ' +' + steps);
  });
  save();
  ZW.toast('成长：' + msgs.join(' · '));
  return true;
}
/* 某个转盘（含）之前一共有多少个属性盘 */

/* 某个转盘（含）之前一共有多少个属性盘 */
function attrCountUpTo(wheelId){
  const ws = state.wheels;
  const limit = wheelId ? ws.findIndex(w => w.id === wheelId) : ws.length - 1;
  if (limit < 0) return 0;
  return ws.filter((w, i) => i <= limit && isGradeWheel(w)).length;
}
/* 统计「列表顺序在 anchorId 之前（含）」的所有属性盘：
   抽到的用最后一次结果，没抽到的按 0 显示 */

function dimsUpTo(anchorId){
  const ws = state.wheels;
  let limit = ws.length - 1;
  if (anchorId) { const i = ws.findIndex(w => w.id === anchorId); limit = i < 0 ? ws.length - 1 : i; }
  const pool = ws.filter((w, i) => i <= limit && isGradeWheel(w));
  if (!pool.length) return [];
  const last = {};
  (state.flow.path || []).forEach(p => { if (parseGrade(p.label) != null) last[p.wheelId] = p.label; });
  if (!Object.keys(last).length) {
    const since = state.flow.roundAt || 0;
    (state.history || []).slice(0, 60).forEach(h => {
      const k = h.wheelId || h.wheel;
      if (last[k] == null && (h.at || 0) >= since) last[k] = h.label;
    });
  }
  return pool.map(w => {
    const raw0 = last[w.id];
    const raw = raw0 != null ? grownLabel(w.id, raw0) : null;   // 叠加本轮成长
    const g = raw != null ? parseGrade(raw) : null;
    return {
      wheelId: w.id, wheel: w.name,
      label: raw != null ? raw : '—',
      value: g != null ? Math.round(g * 10) : 0
    };
  });
}
/* 汇总本局的属性维度（实时预览用：只统计抽到过的）
   ⚠️ 必须和 dimsUpTo() 一样叠加本轮成长（grownLabel）——
      以前这里直接用原始标签，于是：
        · 位置=「某转盘之后」的图（走 dimsUpTo）会体现成长
        · 位置=「所有转盘之后」的图（走这个函数）**不体现成长**
      同一个位置语义，两张图却算出不同结果（成长转盘升的级看不见）。
      「变形动画」的起点也走这个函数，所以不修的话起点数据也是错的。 */

Object.assign(ZW, { GRADES, parseGrade, isGradeWheel, GRADE_LADDER, GROW_ALIAS, GROW_WORD_MAX, growTargetWheel, growHintFor, parseGrowth, growLabel, grownLabel, lastLabelOf, applyGrowth, attrCountUpTo, dimsUpTo });
})();
