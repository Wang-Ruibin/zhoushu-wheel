/* 阶段 C 拆分工具：把 index.html 内联主逻辑按名称清单搬进 js/ 模块。
   用法：node _dev/split-c.js <round>   （round ∈ 1..4，见 ROUNDS 表）
   —— 每轮只搬一组域，搬完跑 node _dev/run.js 全量回归。这是临时工程工具，拆完可删。 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'index.html');

/* ---------- 内联脚本提取（与 harness.extractScript 一致） ---------- */
function splitHtml(html){
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m, last = null, end = 0;
  while ((m = re.exec(html))) { last = m[1]; end = re.lastIndex; }
  if (!last) throw new Error('没找到内联 <script>');
  /* 注意：regex 的 lastIndex 在 </script> 之后，重组时要把闭合标签补回来 */
  return { before: html.slice(0, end - last.length - 9), inline: last, after: '</script>' + html.slice(end) };
}

/* ---------- 顶层声明解析（IIFE 深度 1），带跨度和前置注释 ---------- */
function parseDecls(inline){
  const lines = inline.split('\n');
  let depth = 0;
  const found = [];          // { name, kind, start, codeStart }
  const norm = s => s.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  lines.forEach((raw, i) => {
    const line = norm(raw);
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    if (depth === 1) {
      const fn = raw.match(/^(?:async )?function\s+([\w$]+)/);
      const vr = raw.match(/^(?:const|let|var)\s+([\w$]+)/);
      if (fn) found.push({ name: fn[1], kind: 'fn', start: i, codeStart: i });
      else if (vr) found.push({ name: vr[1], kind: 'var', start: i, codeStart: i });
    }
    depth += opens - closes;
    if (depth < 0) depth = 0;
  });
  if (!found.length) throw new Error('没解析到顶层声明');
  /* 多名字声明（const A = 1, B = 2;）：同一语句的所有名字共享跨度 */
  found.forEach(d => {
    d.names = [d.name];
    if (d.kind === 'var') {
      /* 找到本语句文本（到第一个分号）里的 `, name =` 次级名字 */
      let text = '';
      for (let i = d.codeStart; i < lines.length; i++) {
        text += lines[i] + '\n';
        if (lines[i].indexOf(';') >= 0) break;
      }
      const head = text.slice(0, text.indexOf(';') < 0 ? text.length : text.indexOf(';'));
      const r = /,\s*([A-Za-z_$][\w$]*)\s*=/g;
      let mm;
      while ((mm = r.exec(head))) d.names.push(mm[1]);
    }
  });
  /* 跨度 = 本声明首行 → 下一个声明首行前；再往前吸附紧贴的注释/空行（不跨大节横幅） */
  return found.map((d, idx) => {
    let end = idx + 1 < found.length ? found[idx + 1].start : lines.length;
    /* 尾部裁掉纯空行 */
    while (end > d.codeStart + 1 && !lines[end - 1].trim()) end--;
    let start = d.codeStart;
    while (start > 0) {
      const prev = lines[start - 1].trim();
      if (!prev) { start--; continue; }                      // 空线可以吸附（中间的）
      if (/^\/\* ={2,}/.test(prev)) break;                   // 大节横幅归下一段
      if (/^(\/\/|\/\*|\*)/.test(prev)) { start--; continue; } // 普通注释吸附
      break;
    }
    while (start < d.codeStart && !lines[start].trim()) start++;  // 头部不留空行
    d.start = start; d.end = end;
    return d;
  });
}

/* ---------- 标识符工具 ---------- */
const BUILTIN = new Set(('window document console Math JSON Object Array String Number Boolean ZW Date RegExp Error ' +
  'TypeError RangeError Promise Map Set WeakMap WeakSet Symbol Proxy Reflect Infinity NaN undefined null true false ' +
  'this arguments super eval globalThis self isFinite isNaN parseInt parseFloat encodeURIComponent decodeURIComponent ' +
  'encodeURI decodeURI setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame ' +
  'queueMicrotask localStorage indexedDB caches history location navigator getComputedStyle matchMedia Blob File ' +
  'FileReader URL Image Audio AudioContext OffscreenCanvas DOMParser fetch Uint8Array Uint8ClampedArray Int32Array ' +
  'Float64Array ArrayBuffer atob btoa ResizeObserver performance crypto innerWidth innerHeight addEventListener ' +
  'removeEventListener dispatchEvent alert confirm prompt case default if else for while do switch return break ' +
  'continue new delete typeof instanceof in of void yield await async function class const let var try catch finally ' +
  'throw extends get set').split(/\s+/));
const IDENT = /[A-Za-z_$][\w$]*/g;
function stripNoise(code){
  return code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}
function bareIds(code){
  const out = new Set();
  let m;
  const clean = stripNoise(code);
  const re = /(?<![\w.$])([A-Za-z_$][\w$]*)(?![\w$])/g;
  let mm;
  while ((mm = re.exec(clean))) {
    const after = clean.slice(mm.index + mm[1].length).replace(/^\s+/, '');
    if (after[0] === ':') continue;      // 对象键
    out.add(mm[1]);
  }
  return out;
}

/* ---------- 轮次定义 ---------- */
/* lateBind：晚加载符号 → 生成 ZW.x 属性访问（正则按词边界替换，只处理代码区近似即可，
   这些名字不会出现在字符串里；替换后人工复核 diff）。 */
const ROUNDS = {
  1: [
    { file: 'wheels', order: 0,
      title: '转盘模型：选项/转盘构造、归一化、概率布局、查找与编辑辅助',
      names: ['END','STAY','BASE_ALL','WHEEL_CATEGORIES','inferWheelCategory','makeOption','normOption','makeWheel',
              'wheelFromDef','currentWheel','wheelOptions','faceOptions','activeOptions','layoutSectors','winnerIndex',
              'pickIndex','parseBatch','wheelById','optById','slotText','nextOf','defaultTargetLabel','nextInOrderAfter',
              'wheelMatchesFilter','findOptionById','editFaceIndex','editOpts','editOptsName','moveWheel','simulateWheel'],
      lateBind: { state: 'ZW.state', ui: 'ZW.ui' },
      extraExports: [] },
    { file: 'state', order: 1,
      title: '状态底座：版本迁移、加载保存、撤销、世界线（profile）、存档状态',
      names: ['LS_KEY','HINT_KEY','RECOVERY_KEY','PROFILE_INDEX_KEY','PROFILE_PREFIX','BASE_SETTINGS','STATE_VER',
              'BASE_FLOW','BASE_WHEELS','V3_PRESETS','CHART_DWELL_MIN','CHART_DWELL_MAX','CHART_DWELL_DEF',
              'chartDwellSec','seed','upgradeToV3','normalize','load','storageStatus','storageErrorShown','save',
              'saveTimer','saveSoon','state','profileIndex','undoStack','pushUndo','undoLast','undoToast',
              'saveProfileIndex','currentProfile','activateProfileState','switchProfile','addProfile','renameProfile',
              'deleteProfile','addHistory'],
      lateBind: { toast:'ZW.toast', renderFlowBar:'ZW.renderFlowBar', requestDraw:'ZW.requestDraw',
                  refreshTitle:'ZW.refreshTitle', applyTheme:'ZW.applyTheme', renderSheet:'ZW.renderSheet',
                  isOverlayOpen:'ZW.isOverlayOpen', scheduleSync:'ZW.scheduleSync', fmtTime:'ZW.fmtTime' },
      exactReplace: [
        ['state = normalize(JSON.parse(item.raw));', 'loadState(normalize(JSON.parse(item.raw)));'],
        ['state = normalize(next);', 'loadState(normalize(next));']
      ],
      prelude: [
        '/* 状态单例：永远只改内容不换对象（loadState 原地替换），',
        '   这样每个模块 const { state } = ZW 拿到的引用永远有效。 */',
        'function loadState(next){',
        '  Object.keys(state).forEach(k => { if (!(k in next)) delete state[k]; });',
        '  Object.assign(state, next);',
        '  return state;',
        '}',
        '/* storage 域要重置「保存失败已提示过」标记时用（storageErrorShown 是本模块私有） */',
        'function storageErrorReset(){ storageErrorShown = false; }'
      ].join('\n'),
      extraExports: ['loadState', 'storageErrorReset'] }
  ],
  2: [
    { file: 'growth', order: 0,
      title: '属性成长：等级解析、成长规则与属性汇总',
      names: ['GRADES','parseGrade','isGradeWheel','GRADE_LADDER','GROW_ALIAS','GROW_WORD_MAX','growTargetWheel',
              'growHintFor','parseGrowth','growLabel','grownLabel','lastLabelOf','applyGrowth','attrCountUpTo','dimsUpTo'],
      /* toast 在 navigation（本轮 order 1）里，比本模块晚 → ZW.x 运行时访问 */
      lateBind: { toast:'ZW.toast' } },
    { file: 'navigation', order: 1,
      title: '导航与界面外壳：面板栈、返回键、toast、对话框、标题与主题',
      names: ['ui','NAV','toastTimer','toast','hideToast','askDialog','scrollMemo','isOverlayOpen','topNav','navDepth',
              'navHist','showOverlay','hideOverlay','navPush','navTo','navBack','navCloseAll','navGoBack','openSheet',
              'closeSheet','renderSheet','refreshTitle','applyTheme'],
      /* 视图函数在 views.js（R4）才拆出；canvas 元素仍在主脚本 → 一律 ZW.x 运行时访问 */
      lateBind: {
        viewManager:'ZW.viewManager', viewBatch:'ZW.viewBatch', viewTarget:'ZW.viewTarget', viewChart:'ZW.viewChart',
        viewNewPick:'ZW.viewNewPick', viewTemplates:'ZW.viewTemplates', viewNewChart:'ZW.viewNewChart',
        viewFaces:'ZW.viewFaces', viewFaceWhen:'ZW.viewFaceWhen', viewResult:'ZW.viewResult',
        viewComplete:'ZW.viewComplete', viewFlowAudit:'ZW.viewFlowAudit', viewSimulation:'ZW.viewSimulation',
        startChartAnim:'ZW.startChartAnim', afterChartDismiss:'ZW.afterChartDismiss', canvas:'ZW.canvas'
      },
      exactReplace: [
        ['if (chartAutoTimer) { clearTimeout(chartAutoTimer); chartAutoTimer = null; }', 'ZW.chartAutoCancel();']
      ] },
    { file: 'chart', order: 2,
      title: '维度图：数据汇总、法轮底纹、雷达绘制与自动弹窗节奏',
      names: ['chartAutoDwellMs','CHART_SHOW_DELAY','CHART_RESUME_GAP','chartAutoTimer','chartFlowDone',
              'afterChartDismiss','showChartThen','chartAfter','chartMidAt','showChartForEnd','chartDims','chartSummary',
              'saveRoundChart','createChartSnapshot','prevChartOf','CHART_INKS','chartInkKey','chartInk','WHEEL_INKS',
              'wheelInkKey','wheelInk','shadeHex','brassBall','DHARMA_SPOKES','dharmaCache','dharmaWheelCanvas',
              'drawDharmaWheel','GEAR_TURN_AT','gearMotion','gearAngle','chartColors','CHART_MAX','GRADE_BASE',
              'chartRadiusRatio','drawRadar','chartRaf','startChartAnim','chartLiveDims','chartSlots','chartSlotIndex',
              'moveChart','chartPositionText'],
      /* flow.js（R3）的函数在这里还是主脚本/晚加载 → ZW.x 运行时访问 */
      lateBind: { continueFlow:'ZW.continueFlow', flowJump:'ZW.flowJump', resetFlow:'ZW.resetFlow', renderFlowBar:'ZW.renderFlowBar' },
      prelude: [
        '/* chartAutoTimer / chartFlowDone 是本模块私有；外部（导航返回、调试出口）经这两个助手触碰 */',
        'function chartAutoCancel(){ if (chartAutoTimer) { clearTimeout(chartAutoTimer); chartAutoTimer = null; } }',
        'function chartManualOpen(){ chartAutoCancel(); chartFlowDone = null; }'
      ].join('\n'),
      extraExports: ['chartAutoCancel', 'chartManualOpen'] }
  ],
  /* 主脚本侧逐轮精确替换（搬运后主脚本里残留的跨域引用） */
  MAIN_REPLACE: { 2: [
    ['clearTimeout(chartAutoTimer); chartAutoTimer = null;', 'chartManualOpen();'],
    ['chartFlowDone = null;', '']
  ] }
};
/* 已存在的 ZW 符号（插件 + 之前轮次模块导出），按轮次累积 */
function pluginSymbols(){
  const out = new Set();
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const re = /<script\s+src="js\/([^"]+)"\s*>/g;
  let m;
  while ((m = re.exec(html))) {
    const src = fs.readFileSync(path.join(ROOT, 'js', m[1]), 'utf8');
    const r3 = /Object\.assign\(ZW\s*,\s*\{([\s\S]*?)\}\s*\)/g;
    let mm;
    while ((mm = r3.exec(src))) {
      mm[1].split(/[,\n]/).forEach(p => {
        const t = p.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/, '').trim();
        const n = t.match(/^([A-Za-z_$][\w$]*)\s*(?::|$)/);
        if (n) out.add(n[1]);
      });
    }
    /* util 等文件里 const X = ZW 形式之外，还有顶层 function 直接挂 ZW.x = 的情形 */
    const r4 = /^\s*(?:function\s+([\w$]+)|const\s+([\w$]+))/gm;
    let r;
    const tops = new Set();
    while ((r = r4.exec(src))) tops.add(r[1] || r[2]);
    /* ZW.xxx = 赋值 */
    const r5 = /\bZW\.([\w$]+)\s*=/g;
    while ((r = r5.exec(src))) out.add(r[1]);
  }
  return out;
}

/* ---------- 主流程 ---------- */
const roundNo = String(process.argv[2] || '');
const round = ROUNDS[roundNo];
if (!round) { console.error('用法: node _dev/split-c.js <1..n>；可用轮次: ' + Object.keys(ROUNDS).join(',')); process.exit(1); }

const html = fs.readFileSync(HTML_PATH, 'utf8');
const parts = splitHtml(html);
const decls = parseDecls(parts.inline);
const byName = new Map();
decls.forEach(d => d.names.forEach(n => byName.set(n, d)));
const lines = parts.inline.split('\n');

/* 收集要搬的行区间（按文件内出现顺序） */
const taken = [];    // {start, end}
const movedDecls = new Map();  // name -> decl（多名字语句的每个名字都指向同一 decl）
round.forEach(mod => {
  mod.names.forEach(n => {
    const d = byName.get(n);
    if (!d) throw new Error('轮 ' + roundNo + ' 模块 ' + mod.file + '：找不到顶层声明 ' + n);
    d.names.forEach(alias => {
      if (!movedDecls.has(alias)) {
        movedDecls.set(alias, d);
        taken.push({ start: d.start, end: d.end });
      }
    });
  });
});
taken.sort((a, b) => a.start - b.start);
const removed = new Set();
taken.forEach(t => { for (let i = t.start; i < t.end; i++) removed.add(i); });

/* 剩余主脚本行 */
const mainLines = lines.filter((l, i) => !removed.has(i));

/* 既有 ZW 符号（插件 + 之前轮次的模块导出） */
const zwBase = pluginSymbols();
/* 本轮各模块按 order 排序，import 只允许解构「更早模块 + 既有符号」 */
const sortedMods = round.slice().sort((a, b) => a.order - b.order);

/* 主脚本随后会发布的函数（运行时 ZW.x 反查可用；但模块解构导入不允许——主脚本最后加载） */
function mainPublished(){
  const out = new Set();
  const decl2 = parseDecls(mainLines.join('\n'));
  decl2.forEach(d => { if (d.kind === 'fn') out.add(d.name); });
  return out;
}
const mainFns = mainPublished();

/* ---------- 生成模块文件 ---------- */
const MODULE_ORDER_TAG = { [roundNo]: sortedMods.map(m => 'js/' + m.file + '.js') };
const available = new Set(zwBase);     /* 随 order 递增累积 */
sortedMods.forEach(mod => {
  const segSet = new Set();
  movedDecls.forEach((d, name) => { if (mod.names.includes(name)) segSet.add(d); });
  const segs = Array.from(segSet).sort((a, b) => a.start - b.start);
  let body = segs.map(d => lines.slice(d.start, d.end).join('\n')).join('\n\n');
  /* 精确替换（state 赋值改 loadState 等） */
  (mod.exactReplace || []).forEach(([from, to]) => {
    if (body.indexOf(from) < 0) throw new Error(mod.file + '：精确替换源不存在 → ' + from);
    body = body.split(from).join(to);
  });
  /* 晚加载符号 → ZW.x（词边界） */
  Object.keys(mod.lateBind || {}).forEach(name => {
    const target = mod.lateBind[name];
    body = body.replace(new RegExp('(?<![\\w.$])' + name + '(?![\\w$])', 'g'), target);
  });
  /* 主脚本函数在体里出现 → 改成 ZW.x 属性访问（主脚本最后加载，不能解构） */
  mainFns.forEach(fn => {
    if (new RegExp('(?<![\\w.$])' + fn + '(?![\\w$])').test(stripNoise(body))) {
      body = body.replace(new RegExp('(?<![\\w.$])' + fn + '(?![\\w$])', 'g'), 'ZW.' + fn);
    }
  });
  /* 计算解构导入：体里的裸标识符 ∩ 当前可见符号 − 本模块自有 − 内建 */
  const locals = new Set();
  segs.forEach(d => d.names.forEach(n => locals.add(n)));
  (mod.extraExports || []).forEach(n => locals.add(n));
  const ids = bareIds(body);
  const imports = [];
  ids.forEach(id => {
    if (locals.has(id) || BUILTIN.has(id)) return;
    if (!available.has(id)) return;
    imports.push(id);
  });
  imports.sort();
  const head =
    '/* 咒术转盘 · ' + mod.title + '\n' +
    '   （阶段 C 从 index.html 内联脚本拆出；仍是无构建普通 <script>，只经 ZW 命名空间互通） */\n' +
    "(function(){\n'use strict';\n" +
    (imports.length ? 'const { ' + imports.join(', ') + ' } = ZW;\n' : '');
  const exportsList = [];
  segs.forEach(d => d.names.forEach(n => { if (!exportsList.includes(n)) exportsList.push(n); }));
  (mod.extraExports || []).forEach(n => { if (!exportsList.includes(n)) exportsList.push(n); });
  const foot = '\nObject.assign(ZW, { ' + exportsList.join(', ') + ' });\n})();\n';
  const pre = mod.prelude ? mod.prelude + '\n\n' : '';
  const out = head + '\n' + pre + body + '\n' + foot;
  fs.writeFileSync(path.join(ROOT, 'js', mod.file + '.js'), out, 'utf8');
  console.log('生成 js/' + mod.file + '.js：' + segs.length + ' 个声明，' + out.length + ' 字符，imports: ' + (imports.join(', ') || '(无)'));
  segs.forEach(d => d.names.forEach(n => available.add(n)));
  (mod.extraExports || []).forEach(n => available.add(n));
});

/* 主脚本可转发的 ZW 符号全集 */
const zwSymbols = new Set(zwBase);
round.forEach(mod => {
  mod.names.forEach(n => {
    const d = byName.get(n);
    (d ? d.names : [n]).forEach(x => zwSymbols.add(x));
  });
  (mod.extraExports || []).forEach(n => zwSymbols.add(n));
});

/* ---------- 主脚本重排：转发清单重算 + 主脚本函数发布 ---------- */
let mainCode = mainLines.join('\n');
/* 0) 先做主脚本侧精确替换（state 赋值点 / 私有标记重置），
      这样替换产生的引用（loadState、storageErrorReset…）能被下面的转发计算看到 */
mainCode = mainCode.split('state = seed();').join('loadState(seed());');
mainCode = mainCode.split('state = next;').join('loadState(next);');
mainCode = mainCode.split('storageErrorShown = false;').join('storageErrorReset();');
((ROUNDS.MAIN_REPLACE || {})[roundNo] || []).forEach(([from, to]) => {
  if (mainCode.indexOf(from) < 0) throw new Error('主脚本精确替换源不存在 → ' + from);
  mainCode = mainCode.split(from).join(to);
});
/* 主脚本仍持有的顶层名字（含函数与变量）——它们不能再进转发清单（会重复声明） */
const mainDecls = new Set();
parseDecls(mainCode).forEach(d => d.names.forEach(n => mainDecls.add(n)));
/* 1) 扩展命名空间转发：体里引用的 ZW 符号补进 const {...} = ZW; */
const mainIds = bareIds(mainCode);
const fwd = [];
mainIds.forEach(id => {
  if (zwSymbols.has(id) && !fwd.includes(id) && !mainDecls.has(id)) fwd.push(id);
});
/* 保持原有插件转发顺序在前：读现有块，合并 */
const fwdMatch = mainCode.match(/const \{ TAU[\s\S]*?\} = ZW;/);
if (!fwdMatch) throw new Error('找不到命名空间转发块');
const existing = fwdMatch[0].slice('const { '.length, -' } = ZW;'.length)
  .split(',').map(s => s.trim()).filter(Boolean);
const merged = existing.slice();
fwd.forEach(id => { if (!merged.includes(id)) merged.push(id); });
const grouped = merged.join(',\n        ');
/* ⚠️ 用函数替换：替换串里的 $$ / $& 会被 String.replace 当特殊模式 */
mainCode = mainCode.replace(fwdMatch[0], () => 'const { ' + grouped + ' } = ZW;');
/* 2) 主脚本函数发布到 ZW（供先加载的模块运行时反查）；
      ui/canvas 这类「晚绑定模块要用、但还没搬走的共享对象」也要发布（仍在主脚本时才发） */
const VAR_PUBLISH = ['ui', 'canvas'];
const publish = Array.from(mainFns).concat(VAR_PUBLISH.filter(n => mainDecls.has(n))).sort();
const pubBlock = '\n/* 主脚本仍持有的函数也挂到 ZW：先加载的模块（state/flow/storage…）运行时要反查 */\nObject.assign(ZW, { ' + publish.join(', ') + ' });\n';
if (mainCode.indexOf('主脚本仍持有的函数也挂到 ZW') >= 0) {
  mainCode = mainCode.replace(/\n\/\* 主脚本仍持有的函数也挂到 ZW[^\n]*\nObject\.assign\(ZW, \{ [^}]* \}\);\n/, () => pubBlock);
} else {
  mainCode = mainCode.replace('\n/* ============================== 启动 ============================== */\n', pubBlock + '\n/* ============================== 启动 ============================== */\n');
}
parts.inline = mainCode;

/* ---------- script 标签插入（新模块一律插在主 <script> 之前，保证轮次顺序） ---------- */
let doc = parts.before + parts.inline + parts.after;
const newTags = MODULE_ORDER_TAG[roundNo].map(f => '<script src="' + f + '"></script>').join('\n');
if (doc.indexOf(newTags) < 0) {
  const anchor = '\n<script>\n(function(){';
  if (doc.indexOf(anchor) < 0) throw new Error('找不到主 <script> 开标签锚点');
  doc = doc.replace(anchor, '\n' + newTags + anchor);
}

/* ---------- sw.js CORE 清单同步（追加到最后一个 js 条目之后） ---------- */
const swPath = path.join(ROOT, 'sw.js');
let sw = fs.readFileSync(swPath, 'utf8');
const newPaths = MODULE_ORDER_TAG[roundNo].map(f => "'./" + f + "', ").join('').replace(/, $/, '');
if (!sw.includes("'" + MODULE_ORDER_TAG[roundNo][0] + "'")) {
  const lastJs = (sw.match(/'\.\/js\/[\w.-]+\.js',/g) || []).pop();
  if (!lastJs) throw new Error('sw.js 里没找到 js 条目');
  sw = sw.replace(lastJs, lastJs + ' ' + newPaths);
}
fs.writeFileSync(swPath, sw, 'utf8');

fs.writeFileSync(HTML_PATH, doc, 'utf8');
console.log('index.html 更新：内联脚本 ' + mainCode.length + ' 字符；新增 <script> ' + newTags);
console.log('sw.js CORE 已同步');
