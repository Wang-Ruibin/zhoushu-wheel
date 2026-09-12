/* ============================================================================
   咒术转盘 · 多面转盘
   —— 「同一个转盘，按之前某个转盘抽到的结果，展示不同的内容」。

   和「分支转盘」的区别（这两个概念很容易混，代码里千万别搅在一起）：
     分支转盘 branch : 影响【流程跳到哪】—— 不进默认顺序，只能被选项的跳转目标指到
     多面转盘 multi  : 影响【这个转盘自己显示什么】—— 照常参与默认顺序，位置随便换

   数据长这样（存在转盘对象上，跟着 转盘/*.js 一起存）：
     {
       name: '声望',
       multi: true,
       faceBy: '道德水平',            // 按哪个转盘的结果分面（写转盘名，和 next 一样好手改）
       faces: [
         { when:{ type:'gradeAtLeast', value:'A' }, options:[ … ] },   // 道德 A 及以上 → 这个面
         { when:{ type:'gradeAtMost',  value:'B' }, options:[ … ] }    // 道德 B 及以下 → 那个面
       ],
       options: [ … ]                 // 兜底面：没有任何 faces 命中时用它
     }

   命中规则：按 faces 数组顺序，**第一个**满足条件的胜出；都不满足就用 options（兜底面）。
   想写「否则」就加一个 { when:{ type:'else' } } 放在最后。

   ⚠️ 判定用的是「叠加本轮成长之后」的结果（grownLabel）——
      成长把道德从 B 抬到 A，声望就该切到高道德那一面。
   ============================================================================ */
(function(){
'use strict';

/* 条件类型（设置界面里选）：label 是给人看的，hint 解释它怎么算 */
const FACE_WHEN = [
  ['gradeAtLeast', '等级 ≥',   '抽到的等级在这个档位或更高（按 E- E D C B A S SS SSS EX 排）'],
  ['gradeAtMost',  '等级 ≤',   '抽到的等级在这个档位或更低'],
  ['gradeIs',      '等级 =',   '正好是这个档位（大小写都认）'],
  ['labelIs',      '结果 =',   '抽到的文字完全一样'],
  ['labelHas',     '结果包含', '抽到的文字里含这几个字'],
  ['else',         '其他情况', '上面都没命中时用它（一般放最后一条）']
];
function whenLabel(when){
  const t = (when && when.type) || 'else';
  const hit = FACE_WHEN.filter(x => x[0] === t)[0];
  if (!hit) return '（未知条件）';
  if (t === 'else') return hit[1];
  return hit[1] + ' ' + ((when && when.value) || '?');
}

/* 等级字符串 → 阶梯下标；不是等级就返回 0（当成最低档）
   ⚠️ 解析等级要跟主逻辑用同一套规则（E- E D C B A S SS SSS EX），
      所以这里不自己写正则，而是用注入进来的 parseGrade。 */
function gradeIndex(word){
  const parse = hooks.parseGrade;
  const g = parse ? parse(word) : null;
  if (g == null) return 0;
  /* parseGrade 返回 2(E-) 3(D) 4(C) … 10(EX)，±0.3 是 +/− 档 → 取整后减 2 就是下标 */
  return Math.max(0, Math.min(9, Math.round(g) - 2));
}

/* 一个条件命中吗 */
function matchWhen(when, label){
  const t = (when && when.type) || 'else';
  const v = (when && when.value) || '';
  const s = String(label == null ? '' : label);
  switch (t) {
    case 'else':         return true;
    case 'gradeAtLeast': return s !== '' && gradeIndex(s) >= gradeIndex(v);
    case 'gradeAtMost':  return s !== '' && gradeIndex(s) <= gradeIndex(v);
    case 'gradeIs':      return s !== '' && gradeIndex(s) === gradeIndex(v);
    case 'labelIs':      return s === v;
    case 'labelHas':     return v !== '' && s.indexOf(v) >= 0;
    default:             return false;
  }
}

/* 这个转盘算不算多面转盘 */
function isMultiWheel(w){
  return !!(w && (w.multi === true || (Array.isArray(w.faces) && w.faces.length)));
}
/* 分面依据的转盘名字（faceBy 为空时从 faces 的条件里猜不出来，只能为空） */
function faceSourceName(w){ return w && typeof w.faceBy === 'string' ? w.faceBy : ''; }

/* 一个多面转盘有多少个「面」（含兜底面） */
function faceCount(w){
  if (!isMultiWheel(w)) return 0;
  return (Array.isArray(w.faces) ? w.faces.length : 0) + 1;
}

/* ---- 依赖注入：这个模块不认识 state，也不认识 wheelById ---- */
const hooks = {};
function useMultiHooks(h){ Object.assign(hooks, h || {}); }

/* 某个转盘「本轮最近一次」的结果（叠加成长之后）。
   ⚠️ 历史和路径都要看：分支流程会把 path 截断/重走。
   ⚠️ 用 grownLabel 的注入版：成长把 B 抬到 A，分面就该跟着切。 */
function lastResultOf(wheel){
  const wid = wheel && wheel.id;
  if (!wid) return null;
  const grown = hooks.grownLabel || ((id, l) => l);
  const path = (hooks.flowPath && hooks.flowPath()) || [];
  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i].wheelId === wid && path[i].label) return grown(wid, path[i].label);
  }
  const his = (hooks.history && hooks.history()) || [];
  for (let i = 0; i < his.length; i++) {
    const k = his[i].wheelId || his[i].wheel;
    if (k === wid && his[i].label) return grown(wid, his[i].label);
  }
  return null;
}

/* 按 id 或名字找转盘。
   ⚠️ 两种都要认：内存里 faceBy 存的是 id，
      但手写数据文件时人只会写转盘名（"faceBy": "道德水平"），
      读回来若因为多了一层解析而失效，就会出现"改了条件却永远走兜底面"这种玄学问题。 */
function byRef(ref){
  if (!ref) return null;
  const list = (hooks.wheels && hooks.wheels()) || [];
  return list.filter(w => w.id === ref)[0]                  // id
      || list.filter(w => w.name === ref)[0]                // 名字
      || list.filter(w => String(w.name).indexOf(ref) >= 0)[0]   // 名字的一部分
      || null;
}

/* 这个多面转盘当前该用哪个面？
   返回 { face, index, label, options, source } —— 没命中任何面时 face 为 null（用兜底面） */
function faceOf(w){
  if (!isMultiWheel(w)) return { face:null, index:-1, label:'（普通转盘）', options:(w && w.options) || [], source:null };
  const src = byRef(faceSourceName(w));
  const label = src ? lastResultOf(src) : null;
  const faces = Array.isArray(w.faces) ? w.faces : [];
  for (let i = 0; i < faces.length; i++) {
    const f = faces[i];
    if (!f) continue;
    /* 只有一个面时，条件可以省略（等于"永远用这个面"） */
    const when = f.when || (faces.length === 1 ? { type:'else' } : null);
    if (!when) continue;
    if (src && label == null && when.type !== 'else') continue;   // 那个盘还没抽过 → 等级类条件不命中
    if (matchWhen(when, label)) {
      return { face:f, index:i, label:label, source:src,
               options: Array.isArray(f.options) ? f.options : [] };
    }
  }
  return { face:null, index:-1, label:label, source:src, options:w.options || [] };
}

/* 这个多面转盘当前该展示的选项（所有绘制/抽取都要走这里，别直接用 w.options） */
function optionsOf(w){
  if (!isMultiWheel(w)) return (w && w.options) || [];
  return faceOf(w).options || [];
}

/* 界面用：这两个面在一句话里说清是哪个 */
function faceDesc(w){
  if (!isMultiWheel(w)) return '';
  const r = faceOf(w);
  const srcName = r.source ? r.source.name : (faceSourceName(w) || '？');
  if (!r.face) return '兜底面（' + srcName + ' 还没抽到）';
  return whenLabel(r.face.when || { type:'else' }) + (r.label ? ' · 当前 ' + r.label : '');
}

Object.assign(ZW, {
  FACE_WHEN, whenLabel, gradeIndex, matchWhen,
  isMultiWheel, faceSourceName, faceCount, byRef,
  lastResultOf, faceOf, optionsOf, faceDesc,
  useMultiHooks
});
})();
