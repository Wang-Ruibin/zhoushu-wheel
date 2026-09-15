/* 咒术转盘 · 转盘模型：选项/转盘构造、归一化、概率布局、查找与编辑辅助
   （阶段 C 从 index.html 内联脚本拆出；仍是无构建普通 <script>，只经 ZW 命名空间互通） */
(function(){
'use strict';
const { $, TAU, colorOf, faceOf, isMultiWheel, norm, num, optionsOf, random, uid } = ZW;

const BASE_ALL = 0.0001;

const END = '__end__', STAY = '__stay__';

const WHEEL_CATEGORIES = ['角色', '属性', '能力', '事件', '结局', '自定义'];

function inferWheelCategory(name){
  const s = String(name || '');
  if (/事件|成长/.test(s)) return '事件';
  if (/结局|等级评定/.test(s)) return '结局';
  if (/咒力|体术|体质|天赋|道德|声望|颜值/.test(s)) return '属性';
  if (/术式|技巧|金手指|身份/.test(s)) return '能力';
  if (/穿越|地点|性别|时间/.test(s)) return '角色';
  return '自定义';
}

function makeOption(label, weight, color, next){
  return { id:uid(), label:String(label == null ? '' : label), weight: weight == null ? 1 : num(weight),
           color: color || null, next: next || '' };
}
/* 存档里的一项选项 → 运行时选项（纯字符串/数字也认；字段做兜底，脏数据不会让程序打不开） */

/* 存档里的一项选项 → 运行时选项（纯字符串/数字也认；字段做兜底，脏数据不会让程序打不开） */
function normOption(o){
  if (typeof o === 'string' || typeof o === 'number') return makeOption(o);
  return { id:(o && o.id) || uid(),
           label:String((o && o.label) == null ? '' : o.label),
           weight:(o && o.weight == null) ? 1 : num(o.weight),
           color:(o && o.color) || null,
           next:(o && typeof o.next === 'string') ? o.next : '' };
}

function makeWheel(name, labels){
  return { id:uid(), name:name, category:'自定义', next:'', branch:false, grade:null, removeAfterPick:false,
           multi:false, faceBy:'', faces:[], options:(labels || []).map(l => makeOption(l)) };
}
/* 内置转盘定义 → 运行时转盘（支持带权重的 opts） */

/* 内置转盘定义 → 运行时转盘（支持带权重的 opts） */
function wheelFromDef(def){
  return {
    id:uid(), name:def.name, category:def.category || inferWheelCategory(def.name), next:'', branch:!!def.branch, grade:(def.grade === true ? true : (def.grade === false ? false : null)),
    removeAfterPick:false, multi:false, faceBy:'', faces:[],
    options: def.opts ? def.opts.map(p => makeOption(p[0], p[1])) : (def.labels || []).map(l => makeOption(l))
  };
}

function currentWheel(){
  if (!ZW.state.wheels.length) ZW.state.wheels.push(makeWheel('新转盘', ['选项 1', '选项 2']));
  return ZW.state.wheels.filter(w => w.id === ZW.state.currentId)[0] || ZW.state.wheels[0];
}
/* ★ 多面转盘的唯一收口：一个转盘「此刻该展示的全部选项」。
   ⚠️ 凡是"要展示 / 要抽"的地方都得走这里，别直接读 w.options ——
      否则多面转盘在那些地方会显示成兜底面。
      （编辑界面是例外：那里要能编辑任意一个面，走 faceOptions(w, faceIndex)。）*/

function wheelOptions(w){
  const x = w || currentWheel();
  return isMultiWheel(x) ? (optionsOf(x) || []) : (x.options || []);
}
/* 某张面（index = -1 表示兜底面）的选项 —— 给编辑界面用 */

/* 某张面（index = -1 表示兜底面）的选项 —— 给编辑界面用 */
function faceOptions(w, index){
  if (!isMultiWheel(w)) return w.options || [];
  if (index < 0) return w.options || [];
  const f = (w.faces || [])[index];
  return (f && Array.isArray(f.options)) ? f.options : [];
}

function activeOptions(w){ return wheelOptions(w).filter(o => num(o.weight) > 0); }

/* ============================== 转盘几何 ============================== */

function layoutSectors(opts, wheel){
  // 颜色按「转盘里当前展示的完整顺序」取，停用某个选项后其余颜色不会跳变
  // ⚠️ 多面转盘要按「当前这一面」的顺序取色，所以这里不能用 w.options
  const w = wheel || currentWheel();
  const all = wheelOptions(w);
  let total = 0;
  opts.forEach(o => { total += Math.max(BASE_ALL, num(o.weight)); });
  let a = -Math.PI / 2;
  return opts.map(o => {
    const span = TAU * (Math.max(BASE_ALL, num(o.weight)) / total);
    const ci = Math.max(0, all.indexOf(o));
    const sec = { opt:o, start:a, end:a + span, mid:a + span / 2, span:span, color:colorOf(w, o, ci) };
    a += span;
    return sec;
  });
}

function winnerIndex(secs, rotation){
  const p = -Math.PI / 2;
  for (let i = 0; i < secs.length; i++) {
    const rel = norm(p - rotation - secs[i].start);
    if (rel < secs[i].span - 1e-9) return i;
  }
  return secs.length - 1;
}

function pickIndex(opts, rand){
  const rng = typeof rand === 'function' ? rand : random;
  const ws = opts.map(o => Math.max(0, num(o.weight)));
  const total = ws.reduce((a, b) => a + b, 0);
  if (total <= 0) return Math.floor(rng() * opts.length);
  let r = rng() * total;
  for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r < 0) return i; }
  return ws.length - 1;
}

function parseBatch(text){
  return String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
    let m = l.match(/^(.*?)\s*[*×xX]\s*(\d+(?:\.\d+)?)$/) || l.match(/^(.*?)\s*[,，、\t]\s*(\d+(?:\.\d+)?)$/);
    if (m && m[1].trim()) return { label:m[1].trim(), weight:num(m[2]) };
    return { label:l, weight:1 };
  }).filter(o => o.label);
}

/* ============================== 绘制 ============================== */

function wheelById(id){ return ZW.state.wheels.filter(w => w.id === id)[0] || null; }

function optById(wid, oid){
  const w = wheelById(wid);
  /* 走 findOptionById：兜底面和各层的面都找得到（多面转盘必需） */
  return w ? findOptionById(w, oid) : null;
}

function slotText(v){
  if (!v) return '未设置';
  if (v === END) return '流程结束';
  if (v === STAY) return '留在本盘';
  const t = wheelById(v);
  return t ? t.name : '（目标已删除）';
}

function nextOf(wheel, opt){
  const v = (opt && opt.next) || (wheel && wheel.next) || '';
  if (v === END) return { kind:'end' };
  if (v === STAY) return { kind:'stay' };
  if (v) {
    const t = wheelById(v);
    return t ? { kind:'wheel', id:t.id, wheel:t } : { kind:'none' };
  }
  /* 都没设 → 跟随「转盘页的列表顺序」里的下一个普通转盘（分支转盘跳过）；
     已经是最后一个就收尾。想停在原地请显式设「留在本盘」。 */
  const alt = wheel ? nextInOrderAfter(wheel.id) : null;
  if (alt) return { kind:'wheel', id:alt.id, wheel:alt, byOrder:true };
  return { kind:'end', byOrder:true };
}

/* 给界面用：这个转盘的「默认下一站」实际会去哪儿 */
function defaultTargetLabel(w){
  const nx = nextOf(w, null);
  if (nx.kind === 'wheel') return nx.wheel.name + (nx.byOrder ? '（按列表顺序）' : '');
  if (nx.kind === 'end') return nx.byOrder ? '流程结束（已是最后一个）' : '流程结束';
  if (nx.kind === 'stay') return '留在本盘';
  return '未设置';
}

/* 列表顺序里，某个转盘之后的下一个「非分支」转盘（分支转盘不进默认顺序） */
function nextInOrderAfter(wheelId){
  const idx = ZW.state.wheels.findIndex(w => w.id === wheelId);
  if (idx < 0) return null;
  for (let i = idx + 1; i < ZW.state.wheels.length; i++) {
    if (!ZW.state.wheels[i].branch) return ZW.state.wheels[i];
  }
  return null;
}

function wheelMatchesFilter(w, query, filter){
  const q = String(query || '').trim().toLocaleLowerCase();
  if (q && String(w.name || '').toLocaleLowerCase().indexOf(q) < 0 &&
      wheelOptions(w).every(o => String(o.label || '').toLocaleLowerCase().indexOf(q) < 0)) return false;
  if (!filter || filter === 'all') return true;
  if (filter === 'branch') return !!w.branch;
  if (filter === 'multi') return isMultiWheel(w);
  return w.category === filter;
}

/* 编辑中的那张面：'auto' = 当前实际命中的那一面；数字 = 指定第几面；-1 = 兜底面 */
function editFaceIndex(w){
  if (!isMultiWheel(w)) return -1;
  const e = ZW.ui.faceEdit;
  if (e === 'auto' || e == null) return faceOf(w).index;
  return num(e);
}

function findOptionById(w, id){
  if (!w || !id) return null;
  const hit = (w.options || []).filter(o => o.id === id)[0];
  if (hit) return hit;
  const faces = Array.isArray(w.faces) ? w.faces : [];
  for (let i = 0; i < faces.length; i++) {
    const arr = (faces[i] && Array.isArray(faces[i].options)) ? faces[i].options : [];
    const f = arr.filter(o => o.id === id)[0];
    if (f) return f;
  }
  return null;
}
/* 编辑操作（增删/改色/乱序/清空/批量）作用在「当前编辑的那一面」上。
   ⚠️ 普通转盘就是 w.options；多面转盘要看「选项内容」页顶上选了哪一面。 */

function editOpts(w, create){
  const x = w || currentWheel();
  if (!isMultiWheel(x)) return x.options;
  const idx = editFaceIndex(x);
  if (idx < 0) return x.options;
  const f = (x.faces || [])[idx];
  if (!f) return x.options;
  if (!Array.isArray(f.options) && create) f.options = [];
  if (!Array.isArray(f.options)) f.options = [];
  return f.options;
}

function editOptsName(w){
  const x = w || currentWheel();
  if (!isMultiWheel(x)) return '';
  const idx = editFaceIndex(x);
  return idx < 0 ? '兜底面' : ('第 ' + (idx + 1) + ' 面');
}

function simulateWheel(wheel, runs){
  const options = activeOptions(wheel || currentWheel());
  const n = Math.max(100, Math.min(100000, Math.floor(num(runs) || 10000)));
  if (!options.length) return { runs:n, rows:[] };
  let seed = 0x9e3779b9;
  const rng = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const counts = options.map(() => 0);
  for (let i = 0; i < n; i++) counts[pickIndex(options, rng)]++;
  const total = options.reduce((sum, option) => sum + Math.max(0, num(option.weight)), 0);
  return { runs:n, rows:options.map((option, i) => ({
    id:option.id, label:option.label, count:counts[i],
    expected:total > 0 ? Math.max(0, num(option.weight)) / total : 1 / options.length,
    observed:counts[i] / n
  })) };
}

function moveWheel(id, dir){
  const i = ZW.state.wheels.findIndex(w => w.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ZW.state.wheels.length) return;
  const t = ZW.state.wheels[i]; ZW.state.wheels[i] = ZW.state.wheels[j]; ZW.state.wheels[j] = t;
  save(); ZW.renderSheet();
}
/* shuffleArr 在 js/util.js 里 */

Object.assign(ZW, { BASE_ALL, END, STAY, WHEEL_CATEGORIES, inferWheelCategory, makeOption, normOption, makeWheel, wheelFromDef, currentWheel, wheelOptions, faceOptions, activeOptions, layoutSectors, winnerIndex, pickIndex, parseBatch, wheelById, optById, slotText, nextOf, defaultTargetLabel, nextInOrderAfter, wheelMatchesFilter, editFaceIndex, findOptionById, editOpts, editOptsName, simulateWheel, moveWheel });
})();
