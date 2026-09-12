/* ============================================================================
   咒术转盘 · 基础工具
   —— 纯函数与常量，不依赖任何别的模块（可以放心被任何文件调用）
   约定：每个 js/*.js 都是「往 ZW 这个命名空间上挂东西」的一小段代码。
        所有文件都是普通 <script>（不是 ES module），所以双击 index.html 就能用。
   ============================================================================ */
(function(){
'use strict';

const TAU = Math.PI * 2;

/* ---- DOM 小工具 ---- */
function $(s, r){ return (r || document).querySelector(s); }
function $$(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

/* ---- 字符串 / 数字 ---- */
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function uid(){ return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }
function num(v){ const n = Number(v); return isFinite(n) ? n : 0; }
function norm(a){ a %= TAU; return a < 0 ? a + TAU : a; }
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

/* ---- 字体 ---- */
const FONT = '-apple-system,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif';
const WFONT = '"Xingkai SC","Kaiti SC",KaiTi,STKaiti,"Songti SC","Noto Serif SC",serif';

/* ============================== 调色板 ============================== */
const PALETTES = {
  xuan:   { name:'宣纸',   s:40, l:62, hues:[6, 22, 42, 88, 148, 192, 214, 268, 320, 348] },
  vivid:  { name:'鲜艳',   s:71, l:52, hues:[214,276,330,8,34,88,168,196,252,300,46,130] },
  pastel: { name:'马卡龙', s:74, l:80, hues:[96,168,196,252,286,330,8,32,68,130] },
  morandi:{ name:'莫兰迪', s:26, l:70, hues:[210,276,330,10,36,90,166,196,250,300] },
  neon:   { name:'霓虹',   s:92, l:58, hues:[188,282,322,352,44,80,150,200,262,300] },
  ink:    { name:'水墨',   s:14, l:82, hues:[220,262,300,340,20,60,120,180] }
};
function hslToHex(h, s, l){
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = x => Math.round(255 * clamp(x, 0, 1)).toString(16).padStart(2, '0');
  return '#' + to(f(0)) + to(f(8)) + to(f(4));
}
function hexToRgb(hex){
  let h = String(hex || '').trim().replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  if (!isFinite(n)) return { r:255, g:255, b:255 };
  return { r:(n >> 16) & 255, g:(n >> 8) & 255, b:n & 255 };
}
/* 当前调色板由主逻辑注入（js/util.js 不认识 state，所以走一个注册口子）。
   用法：主逻辑 load 完 state 之后调 ZW.usePalette(() => state.settings.palette)。
   存的是**取值函数**而不是 key 本身 —— 这样存档被换掉（导入备份 / 恢复默认）也不用重新注册。
   ⚠️ 取值时必须调一次 paletteKey()；直接写 PALETTES[paletteKey] 会拿函数当键名，
      结果永远是 undefined → 悄悄退回默认色板（这个坑踩过一次，颜色全变鲜艳了）。 */
let paletteKey = () => Object.keys(PALETTES)[0];
function usePalette(fn){ if (typeof fn === 'function') paletteKey = fn; }
function paletteKeyNow(){
  let k = paletteKey;
  try { k = paletteKey(); } catch(e){ k = null; }
  return PALETTES[k] ? k : Object.keys(PALETTES)[0];
}
function paletteOf(){ return PALETTES[paletteKeyNow()]; }
/* 扇区配色：选项自己没指定颜色时，按当前调色板 + 序号取一个 */
function colorOf(w, o, i){
  if (o.color) return o.color;
  const p = paletteOf();
  const hue = p.hues[i % p.hues.length] + Math.floor(i / p.hues.length) * 9;
  return hslToHex(hue % 360, p.s, p.l);
}
function textOn(hex){
  const c = hexToRgb(hex);
  const L = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
  return L > 0.66 ? 'rgba(44,40,34,.93)' : '#ffffff';
}
function shuffleArr(a){
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

/* ---- 导出到 ZW ---- */
Object.assign(ZW, {
  TAU, FONT, WFONT, PALETTES,
  $, $$, esc, uid, num, norm, clamp,
  hslToHex, hexToRgb, colorOf, textOn, shuffleArr,
  usePalette, paletteOf, paletteKeyNow
});
})();
