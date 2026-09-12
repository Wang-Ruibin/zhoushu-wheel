/* ============================================================================
   咒术转盘 · 图标
   —— 纯字符串生成，不碰 DOM。用法：icon('trash') → 一段 <svg> 字符串。
   ============================================================================ */
(function(){
'use strict';

/* 统一包一层 svg 外壳 */
function svg(inner, w){
  return '<svg viewBox="0 0 24 24" width="' + (w || 20) + '" height="' + (w || 20) +
    '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
}

/* 图标表：key → svg 内部路径。加图标就在这里加一行 */
const ICONS = {
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  chevron:'<path d="M6 9.5l6 6 6-6"/>',
  back:'<path d="M15 5l-7 7 7 7"/>',
  close:'<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  sliders:'<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2.2"/><circle cx="9" cy="16" r="2.2"/>',
  edit:'<path d="M4 20h4L18.5 9.5a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.6 6.4l4 4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  trash:'<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7"/>',
  copy:'<rect x="9" y="9" width="11" height="11" rx="2.6"/><path d="M15 5.6A2.6 2.6 0 0 0 12.4 3H6.6A3.1 3.1 0 0 0 3.5 6.1v5.8A2.6 2.6 0 0 0 6 14.5"/>',
  up:'<path d="M12 19.5V5M6 11l6-6 6 6"/>',
  down:'<path d="M12 4.5V19M6 13l6 6 6-6"/>',
  download:'<path d="M12 4v10.5M7.5 10L12 14.5 16.5 10M5 19.5h14"/>',
  upload:'<path d="M12 15V4.5M7.5 9L12 4.5 16.5 9M5 19.5h14"/>',
  refresh:'<path d="M20 11.2A8 8 0 1 0 17.6 17"/><path d="M20.5 5v6h-6"/>',
  shuffle:'<path d="M4 7h3.5l4 5 4 5H20M4 17h3.5l1.8-2.2M14.5 7H20M17.5 4.5L20 7l-2.5 2.5M17.5 14.5L20 17l-2.5 2.5"/>',
  clock:'<circle cx="12" cy="12" r="8.4"/><path d="M12 7.4V12l3.1 2"/>',
  branch:'<path d="M7 4v6a4 4 0 0 0 4 4h5"/><circle cx="18" cy="14" r="2.2"/><path d="M7 20v-6"/>'
};
/* 拖动排序用的"抓手"：实心点，不描边，所以单独写 */
ICONS.drag = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none">' +
  '<circle cx="9.5" cy="6" r="1.5"/><circle cx="14.5" cy="6" r="1.5"/>' +
  '<circle cx="9.5" cy="12" r="1.5"/><circle cx="14.5" cy="12" r="1.5"/>' +
  '<circle cx="9.5" cy="18" r="1.5"/><circle cx="14.5" cy="18" r="1.5"/></svg>';

const icon = n => svg(ICONS[n] || '', 20);

Object.assign(ZW, { svg, ICONS, icon });
})();
