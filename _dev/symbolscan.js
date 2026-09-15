/* 模块符号扫描：找出「模块私有、却被 index.html 当变量用」的符号
   node _dev/symbolscan.js

   【为什么需要这个】同一个坑踩了两次，都是拆模块造成的：
     GEAR_SFX   在 js/sound.js 里是顶层 let，页面直接当变量用 → ReferenceError
                （在 rAF 回调里，报错看不见 → 表现为"维度图打不开"）
     fxReduced  在 js/spin.js 里是 core 的属性，页面直接当变量用 → ReferenceError
                （在 tabSettings 里 → 表现为"设置/记录面板打不开"）
   两次都不是"函数被删"，而是"名字不在作用域里"。这个脚本专门盯这一类。

   【判据】页面里的裸标识符 X，满足下面全部就报：
     ① 页面自己没声明 X（也不在 const {...} = ZW 转发清单里）
     ② 不是浏览器/语言全局
     ③ 页面确实把它当变量用（不是对象键 `{X: …}`）
     ④ X 在模块里出现过：是模块的顶层声明，或模块用过的属性名 `.X`

   【误报】页面局部变量和模块属性同名时会误报，列在 KNOWN_LOCAL 里（人工确认过）。
         数量很少，过一眼即可 —— 这个方向宁可多报也别漏。 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const JS_DIR = path.join(ROOT, 'js');

/* 已知的、和模块属性同名的页面局部变量（人工确认过的误报） */
const KNOWN_LOCAL = new Set([
  'html',     // renderSheet 里的局部 html
  'l',        // 到处在用的短循环变量
  'spinning', // 页面里只出现在 rows[i].getBoundingClientRect() 这类属性访问之后
  'dur',      // 页面里是 animateSpin 的参数名
  'frame',    // 模块里是递归函数名
  'm', 're', 'id', 'at', 'in', 'set', 'list', 'key', 'top', 'left', 'self', 'name', 'value', 'text', 'src',
  'g',        // 绘制代码里的局部渐变变量 g，与模块属性 .g 同名（人工确认过）
  'b',        // 循环变量 b，与模块属性 .b 同名（人工确认过）
  'el', 'label', 'opt', 'opts',   // 主脚本装配段的事件参数/回调节点变量（人工确认过）
  'r', 't', 'view', 'x'           // 主脚本装配段的依赖注入参数名（人工确认过）
]);

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const reS = /<script>([\s\S]*?)<\/script>/g;
let m, inline = null;
while ((m = reS.exec(html))) inline = m[1];
if (!inline) throw new Error('index.html 里没找到内联 <script>');

/* 去掉注释和字符串，免得里面的词被当成代码 */
const code = inline
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/\/\/[^\n]*/g, ' ')
  .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
  .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
  .replace(/`(?:[^`\\]|\\.)*`/g, '``');

/* ---------- 模块侧 ---------- */
const modTop = new Set(), modProp = new Set(), modExport = new Set();
fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js')).forEach(f => {
  const src = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
  let mm;
  const r1 = /^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;   // 顶层声明
  while ((mm = r1.exec(src))) modTop.add(mm[1]);
  const r2 = /\.([A-Za-z_$][\w$]*)/g;                                      // 用过的属性名
  while ((mm = r2.exec(src))) modProp.add(mm[1]);
  const r3 = /Object\.assign\(ZW\s*,\s*\{([\s\S]*?)\}\s*\)/g;              // 导出
  while ((mm = r3.exec(src))) {
    mm[1].split(/[,\n]/).forEach(p => {
      const t = p.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/, '').trim();
      const n = t.match(/^([A-Za-z_$][\w$]*)\s*(?::|$)/);
      if (n) modExport.add(n[1]);
    });
  }
});

/* ---------- 页面侧：声明 ---------- */
const declared = new Set();
{
  let mm;
  const r = /\b(?:const|let|var|function|class)\s+([^;=\n]+)/g;
  while ((mm = r.exec(code))) {
    mm[1].split(',').forEach(part => {
      const t = part.split('=')[0].trim().replace(/^[\[({]+/, '');
      const n = t.match(/^([A-Za-z_$][\w$]*)/);
      if (n) declared.add(n[1]);
    });
  }
  [/(?:const|let|var)\s*\{([^}]*)\}\s*=/g,
   /(?:const|let|var)\s*\[([^\]]*)\]\s*=/g,
   /(?:function\s*[\w$]*\s*|(?:\([^()]*\)|[\w$]+)\s*=>\s*)\(([^()]*)\)/g,
   /catch\s*\(\s*([A-Za-z_$][\w$]*)/g,
   /for\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g].forEach(r => {
    let mm2;
    while ((mm2 = r.exec(code))) {
      mm2[1].split(',').forEach(x => {
        const t = x.split(':').pop().split('=')[0].trim().replace(/^[\[({]+/, '');
        if (/^[A-Za-z_$][\w$]*$/.test(t)) declared.add(t);
      });
    }
  });
}
/* 转发清单也算声明： const { a, b } = ZW; */
{
  let mm;
  const r = /const\s*\{([\s\S]*?)\}\s*=\s*ZW\s*;/g;
  while ((mm = r.exec(inline))) {
    mm[1].split(',').forEach(x => { const t = x.split(':').pop().trim(); if (/^[A-Za-z_$][\w$]*$/.test(t)) declared.add(t); });
  }
}

/* ---------- 全局白名单 ---------- */
const G = new Set(('window document console Math JSON Object Array String Number Boolean ZW Date RegExp Error ' +
 'TypeError RangeError Promise Map Set WeakMap WeakSet Symbol Proxy Reflect Infinity NaN undefined null true false ' +
 'this arguments super eval globalThis self top parent frames isFinite isNaN parseInt parseFloat encodeURIComponent ' +
 'decodeURIComponent encodeURI decodeURI setTimeout clearTimeout setInterval clearInterval requestAnimationFrame ' +
 'cancelAnimationFrame queueMicrotask structuredClone localStorage sessionStorage indexedDB caches history location ' +
 'navigator screen getComputedStyle matchMedia Blob File FileReader URL URLSearchParams Image Audio AudioContext ' +
 'webkitAudioContext OffscreenCanvas Path2D DOMParser XMLHttpRequest fetch Uint8Array Uint8ClampedArray Uint16Array ' +
 'Int8Array Int16Array Int32Array Float32Array Float64Array ArrayBuffer DataView atob btoa ResizeObserver ' +
 'IntersectionObserver MutationObserver CustomEvent Event KeyboardEvent PointerEvent MouseEvent TouchEvent DragEvent ' +
 'alert confirm prompt Node Element HTMLElement HTMLCanvasElement CanvasRenderingContext2D performance crypto ' +
 'requestIdleCallback devicePixelRatio innerWidth innerHeight scrollX scrollY addEventListener removeEventListener ' +
 'dispatchEvent postMessage close open focus blur print case default if else for while do switch return break ' +
 'continue new delete typeof instanceof in of void yield await async function class const let var try catch finally ' +
 'throw extends import export from as get set static enum with debugger').split(/\s+/));

/* ---------- 页面里真正当变量用的裸标识符 ---------- */
const cands = new Set();
{
  const r = /(?<![\w.$])([A-Za-z_$][\w$]*)(?![\w$])/g;
  let mm;
  while ((mm = r.exec(code))) {
    const id = mm[1];
    const after = code.slice(mm.index + id.length).replace(/^\s+/, '');
    if (after[0] === ':') continue;                 // 对象键 / 解构键
    cands.add(id);
  }
}

const hits = [];
cands.forEach(id => {
  if (declared.has(id) || G.has(id) || modExport.has(id) || KNOWN_LOCAL.has(id)) return;
  if (!modTop.has(id) && !modProp.has(id)) return;
  hits.push(id);
});
hits.sort();

/* 另一条互补的检查：模块**导出**了某个名字，页面也确实把它当变量用，
   但转发清单里没有它 —— 说明"转发那一步被删了"。
   这是上面那条判据的反方向（上面查"模块私有"，这条查"导出了却没接"）。
   例：把 `prefersReducedMotion` 从 const {...} = ZW 里删掉 → 这里报出来。 */
const missedForward = [];
cands.forEach(id => {
  if (declared.has(id) || G.has(id) || KNOWN_LOCAL.has(id)) return;
  if (!modExport.has(id)) return;
  missedForward.push(id);
});
missedForward.sort();

console.log('模块：顶层声明 ' + modTop.size + ' 个 / 用过的属性 ' + modProp.size + ' 个 / 导出 ' + modExport.size + ' 个');
console.log('页面：声明 ' + declared.size + ' 个 / 候选标识符 ' + cands.size + ' 个');
if (hits.length || missedForward.length) {
  const lines = inline.split('\n');
  const locate = id => {
    const at = [];
    const esc2 = id.replace(/\$/g, '\\$');
    lines.forEach((l, i) => { if (new RegExp('(?<![\\w.$])' + esc2 + '(?![\\w$])').test(l)) at.push(i + 1); });
    return 'index.html 第 ' + at.slice(0, 5).join(', ') + ' 行';
  };
  if (hits.length) {
    console.log('\n✗ 模块私有、却被页面当变量用（会 ReferenceError）：');
    hits.forEach(id => console.log('    ' + id.padEnd(20) + (modTop.has(id) ? '[模块顶层声明]' : '[模块属性名]') + ' ' + locate(id)));
  }
  if (missedForward.length) {
    console.log('\n✗ 模块导出了、页面也在用，但**转发清单里没有**（会 ReferenceError）：');
    missedForward.forEach(id => console.log('    ' + id.padEnd(20) + '[模块已导出，忘了转发] ' + locate(id)));
  }
  console.log('\n  修法：模块里 Object.assign(ZW, { 名字 })，再到 index.html 的');
  console.log('        const { ... } = ZW 那一行补上同样的名字。');
  process.exit(1);
}
console.log('\n✓ 模块/页面之间没有"名字不在作用域里"的符号');
