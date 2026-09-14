/* ============================================================================
   调试用 Node 沙箱：把 js/*.js 里的插件代码按顺序拼起来，用 vm 跑，
   桩掉 document / canvas / history / localStorage，并导出内部函数。
   —— 只在开发时用（node _dev/run.js）。双击 index.html 的体验不受影响。

   结构约定（和 index.html 里的 <script src> 顺序一致）：
     1. js/_ns.js   建命名空间 ZW
     2. js/*.js     其它插件，按文件名排序
     3. index.html 里那段内联 <script>（主逻辑）
   ============================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const JS_DIR = path.join(ROOT, 'js');

/* ---------- 插件清单：**严格照 index.html 里 <script src> 的顺序** ----------
   不能自己按文件名排序！加载顺序 = 依赖顺序（util 必须在 spin 前面），
   排序猜错了就会出现「ZW.norm is not a function」这种莫名其妙的错。
   顺带校验：js/ 里有没有文件没被 index.html 引到（写了却忘了加载）。 */
function pluginFiles(){
  const refs = scriptsInHtml(HTML)
    .filter(s => /^js\//.test(s))
    .map(s => s.replace(/^js\//, ''));
  if (!refs.length) throw new Error('index.html 里没有 <script src="js/...">');
  if (refs[0] !== '_ns.js') throw new Error('js/_ns.js 必须是第一个加载的插件（现在是 ' + refs[0] + '）');
  const onDisk = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js'));
  const missing = onDisk.filter(f => refs.indexOf(f) < 0);
  if (missing.length) throw new Error('js/ 里这些文件没被 index.html 加载：' + missing.join(', '));
  const ghosts = refs.filter(f => onDisk.indexOf(f) < 0);
  if (ghosts.length) throw new Error('index.html 引用了不存在的 js 文件：' + ghosts.join(', '));
  return refs;
}
/* 把插件代码包进同一个作用域（相当于浏览器里同一段 <script> 顺序执行） */
function bundlePlugins(){
  const files = pluginFiles();
  const parts = files.map(f => '/* ===== js/' + f + ' ===== */\n' + fs.readFileSync(path.join(JS_DIR, f), 'utf8'));
  return { files, code: '(function(){\n' + parts.join('\n') + '\n})();\n' };
}
/* 抽出 index.html 里最后一个 <script>（主逻辑） */
function extractScript(html){
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m, last = null;
  while ((m = re.exec(html))) last = m[1];
  if (!last) throw new Error('没找到 <script>');
  return last;
}
/* 页面里 <script src="js/..."> 的顺序（用来核对 harness 的加载顺序和页面一致） */
function scriptsInHtml(html){
  const re = /<script\s+src="([^"]+)"\s*>/g;
  const out = [];
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

/* ---------- 极简 DOM ---------- */
const VOID_TAGS = new Set(['br','hr','img','input','meta','link','source','area','base','col','embed','track','wbr']);

/* 注入的钩子：让 <script src> 真的被"加载"（由 loadApp 填进来）。
   为什么必须模拟：index.html 的启动链是
     init() → loadWheelFiles(defs => { …; boot(); })
   而 loadWheelFiles 是「建一个 <script src="转盘/_index.js">，等 onload」。
   如果桩里 appendChild 不触发 onload/onerror，done() 永远不会被调用 →
   **boot() 根本不执行**（图标、fitWheel、启动小字、调试出口全不跑），
   测试却看起来是通的。所以这里必须把加载事件补上。 */
let scriptLoader = null;      // (el, defer) => void
function setScriptLoader(fn){ scriptLoader = fn; }

/* 极简 HTML 解析：只认标签、id、class、data-*、value，够用就行（不处理文本节点） */
function parseHTML(html, owner){
  const out = [];
  const stack = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[^>]*?)?)(\/?)>/g;
  let m;
  while ((m = re.exec(html))) {
    const closing = m[1] === '/', tag = m[2].toLowerCase(), attrs = m[3] || '', selfClose = m[4] === '/';
    if (closing) { stack.pop(); continue; }
    const el = new El(tag);
    const idm = attrs.match(/\bid="([^"]*)"/);            if (idm) el.id = idm[1];
    const cm  = attrs.match(/\bclass="([^"]*)"/);          if (cm)  el.className = cm[1];
    const vm  = attrs.match(/\bvalue="([^"]*)"/);          if (vm)  el.value = vm[1];
    const dm  = attrs.match(/\bdata-([\w-]+)="([^"]*)"/g);
    if (dm) dm.forEach(d => { const p = d.match(/\bdata-([\w-]+)="([^"]*)"/); el.dataset[p[1]] = p[2]; });
    el.parentNode = stack.length ? stack[stack.length - 1] : owner;
    out.push(el);
    if (!selfClose && !VOID_TAGS.has(tag)) stack.push(el);
  }
  return out;
}

class El {
  constructor(tag, id){
    this.tagName = String(tag || 'div').toUpperCase();
    this.id = id || '';
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.dataset = {};
    this._cls = new Set();
    this._html = '';
    this.textContent = '';
    this.scrollTop = 0;
    this.scrollWidth = 0;
    this.scrollLeft = 0;
    this.value = '';
    this.checked = false;
    this.files = null;
    this.hidden = false;
    this.listeners = {};
    /* canvas 特有：width/height 是元素自己的属性（默认 300x150，和浏览器一致）。
       drawRadar 会读 clientWidth 算半径、再写 cv.width/height 做 DPR 适配，
       所以这里必须是可读写的独立属性，不能跟 clientWidth 混在一起。 */
    this._cw = 300; this._ch = 150;
    Object.defineProperty(this, 'width', {
      get: () => this._cw, set: v => { this._cw = Number(v) || 0; }, configurable:true, enumerable:true });
    Object.defineProperty(this, 'height', {
      get: () => this._ch, set: v => { this._ch = Number(v) || 0; }, configurable:true, enumerable:true });
    const self = this;
    this.classList = {
      add: (...c) => c.forEach(x => self._cls.add(x)),
      remove: (...c) => c.forEach(x => self._cls.delete(x)),
      contains: c => self._cls.has(c),
      toggle: (c, on) => { const v = (on === undefined) ? !self._cls.has(c) : !!on; if (v) self._cls.add(c); else self._cls.delete(c); return v; }
    };
  }
  get className(){ return Array.from(this._cls).join(' '); }
  set className(v){ this._cls = new Set(String(v || '').split(/\s+/).filter(Boolean)); }
  get innerHTML(){ return this._html; }
  set innerHTML(v){
    this._html = String(v == null ? '' : v);
    this.children = parseHTML(this._html, this);
  }
  addEventListener(t, fn){ (this.listeners[t] = this.listeners[t] || []).push(fn); }
  removeEventListener(){}
  appendChild(c){
    this.children.push(c);
    if (c && typeof c === 'object') c.parentNode = this;
    if (scriptLoader && c && c.tagName === 'SCRIPT' && c.src) scriptLoader(c);
    return c;
  }
  removeChild(c){ this.children = this.children.filter(x => x !== c); return c; }
  remove(){ if (this.parentNode) this.parentNode.removeChild(this); }
  /* 在「后代 + 自己解析出来的 HTML」里找：够 index.html 的用法（#id / .class / tag） */
  _all(){
    const out = [];
    const walk = n => { n.children.forEach(c => { out.push(c); walk(c); }); };
    walk(this);
    return out;
  }
  _match(sel){
    if (sel[0] === '#') return this.id === sel.slice(1);
    if (sel[0] === '.') return this._cls.has(sel.slice(1));
    return this.tagName === sel.toUpperCase();
  }
  querySelector(sel){
    /* 支持逗号分隔的几个简单选择器（index.html 里有 '.a, .b' 的用法） */
    const parts = String(sel).split(',').map(x => x.trim()).filter(Boolean);
    const nodes = this._all();
    for (const p of parts) {
      const hit = nodes.filter(n => n._match(p))[0];
      if (hit) return hit;
    }
    return null;
  }
  querySelectorAll(sel){
    const parts = String(sel).split(',').map(x => x.trim()).filter(Boolean);
    const nodes = this._all();
    const out = [];
    nodes.forEach(n => { if (parts.some(p => n._match(p)) && out.indexOf(n) < 0) out.push(n); });
    return out;
  }
  /* closest：往 parentNode 链上找（事件委托要用） */
  closest(sel){
    const parts = String(sel).split(',').map(x => x.trim()).filter(Boolean);
    let n = this;
    while (n) { if (parts.some(p => n._match(p))) return n; n = n.parentNode; }
    return null;
  }
  focus(){}
  select(){}
  click(){}
  setAttribute(){}
  getAttribute(){ return null; }
  removeAttribute(){}
  /* 布局尺寸：默认给一个"能画"的值（真实浏览器下面板有尺寸）。
     · 要测「尺寸为 0 → 静默不画」，直接 el.clientWidth = 0
     · 或者 el._box = { width:0, height:0 } */
  get _w(){ return this._box ? this._box.width : (this.__cw != null ? this.__cw : 578); }
  get _h(){ return this._box ? this._box.height : (this.__ch != null ? this.__ch : 578); }
  get clientWidth(){ return this._w; }
  set clientWidth(v){ this.__cw = Number(v) || 0; }
  get clientHeight(){ return this._h; }
  set clientHeight(v){ this.__ch = Number(v) || 0; }
  get offsetWidth(){ return this._w; }
  get offsetHeight(){ return this._h; }
  getBoundingClientRect(){
    return { left:0, top:0, width:this._w, height:this._h, right:this._w, bottom:this._h };
  }
  /* 画布：getContext 给一个「记录调用」的 ctx，width/height 跟着布局尺寸走
     （index.html 里 drawRadar 会读 cv.clientWidth 算半径，再写 cv.width/height） */
  getContext(type){ return this._ctx || (this._ctx = makeCtx()); }
  hasPointerCapture(){ return false; }
  setPointerCapture(){}
  releasePointerCapture(){}
}

/* ---------- 极简 canvas 2d ctx ----------
   所有绘制调用都是 no-op，但会**记账**：ctx.__calls 里能看到调用序列。
   这样测试能断言「图真的画了东西」（stroke/fill/fillText/drawImage 各几次），
   而不是只看「没抛错」—— 静默不画（尺寸为 0 直接 return）也能被抓到。 */
function makeCtx(){
  const ctx = {
    canvas: null,
    __calls: [],
    __texts: [],
    save(){ ctx.__calls.push('save'); }, restore(){ ctx.__calls.push('restore'); },
    beginPath(){ ctx.__calls.push('beginPath'); }, closePath(){ ctx.__calls.push('closePath'); },
    moveTo(){ ctx.__calls.push('moveTo'); }, lineTo(){ ctx.__calls.push('lineTo'); },
    arc(){ ctx.__calls.push('arc'); }, ellipse(){ ctx.__calls.push('ellipse'); },
    rect(){ ctx.__calls.push('rect'); },
    fill(){ ctx.__calls.push('fill'); }, stroke(){ ctx.__calls.push('stroke'); },
    clip(){ ctx.__calls.push('clip'); },
    fillRect(){ ctx.__calls.push('fillRect'); }, strokeRect(){ ctx.__calls.push('strokeRect'); },
    clearRect(){ ctx.__calls.push('clearRect'); },
    fillText(t){ ctx.__calls.push('fillText'); ctx.__texts.push(String(t)); },
    strokeText(){ ctx.__calls.push('strokeText'); },
    translate(){ ctx.__calls.push('translate'); }, rotate(){ ctx.__calls.push('rotate'); },
    scale(){ ctx.__calls.push('scale'); }, transform:() => {}, setTransform:() => {},
    resetTransform:() => {}, quadraticCurveTo:() => {}, bezierCurveTo:() => {}, setLineDash:() => {},
    createLinearGradient: () => ({ addColorStop(){} }),
    createRadialGradient: () => ({ addColorStop(){} }), createPattern: () => null,
    drawImage(){ ctx.__calls.push('drawImage'); },
    putImageData:() => {}, getImageData: () => ({ data:new Uint8ClampedArray(4) }),
    measureText: t => ({ width: String(t == null ? '' : t).length * 8 }),
    createImageData: () => ({ data:new Uint8ClampedArray(4) })
  };
  return ctx;
}

/* ---------- 按选择器注册的几个关键节点 ---------- */
function makeDom(custom){
  const ids = ['wheel','result','wheelWrap','overlay','sheet','flowBar','toast','confirmOverlay',
               'fileImport','btnSwitch','btnPanel','btnEdit','wheelName','cTitle','cDesc','cInput','cCancel','cOk'];
  const byId = {};
  ids.forEach(i => { byId['#' + i] = new El(i === 'wheel' ? 'canvas' : 'div', i); });
  /* .stage 也要能被 $('.stage') 查到：挂上 class，不能只塞进 byId 的 key
     （以前只塞 key，`_match('.stage')` 匹配不到，于是 $('.stage') 返回 null） */
  const stage = new El('main');
  stage.className = 'stage';
  byId['.stage'] = stage;
  /* overlay 默认「关着」——真实双击打开时就是关的。navTo 会自己 showOverlay()。
     某些测试想模拟「面板已经开着」再自己 classList.add('open')。 */
  Object.assign(byId, custom || {});

  /* document 上的查询要能查到「动态写进 innerHTML 的元素」。
     ⚠️ index.html 的画图流程是：sheet.innerHTML = '…<canvas id="chartCv">…'
        然后 requestAnimationFrame(() => { const cv = $('#chartCv'); … })。
        $ 走的是 document.querySelector —— 如果这里只查固定的那几个 byId 节点，
        就会永远拿到 null，于是 **startChartAnim 根本不会被调用**，
        看起来就是「维度图打不开」，而其实只是测试桩查不到元素。
        （这个坑让"图不显示"的排查多绕了一圈：桩的假故障掩盖了真故障。） */
  function docQueryAll(sel){
    const parts = String(sel).split(',').map(x => x.trim()).filter(Boolean);
    const out = [];
    /* 1) 固定的几个关键节点（#wheel / #sheet / .stage …） */
    Object.keys(byId).forEach(k => { if (parts.some(p => byId[k]._match(p)) && out.indexOf(byId[k]) < 0) out.push(byId[k]); });
    /* 2) 这些节点里被 innerHTML 解析出来的后代 */
    Object.keys(byId).forEach(k => {
      byId[k]._all().forEach(n => { if (parts.some(p => n._match(p)) && out.indexOf(n) < 0) out.push(n); });
    });
    /* 3) documentElement / body / head 上的 */
    [doc.documentElement, doc.body, doc.head].forEach(root => {
      root._all().forEach(n => { if (parts.some(p => n._match(p)) && out.indexOf(n) < 0) out.push(n); });
    });
    return out;
  }

  const doc = {
    documentElement: new El('html'),
    head: new El('head'),
    body: new El('body'),
    activeElement: null,
    querySelector: sel => docQueryAll(sel)[0] || null,
    querySelectorAll: sel => docQueryAll(sel),
    createElement: tag => new El(tag),
    getElementById: id => docQueryAll('#' + id)[0] || null,
    addEventListener: (t, fn) => { (doc.__listeners[t] = doc.__listeners[t] || []).push(fn); },
    removeEventListener: () => {},
    contains: () => true,
    __listeners: {}
  };
  doc.documentElement.dataset = {};
  return { doc, byId };
}

/* ---------- 运行 ---------- */
function loadApp(opts){
  opts = opts || {};
  /* 默认**不读**「转盘/」里的数据文件：
     · 测试要的是确定性 —— 用内置的 10 个转盘，不要被用户自己的数据文件影响
     · 但加载流程（init → loadWheelFiles → boot）照样完整走一遍，只是所有
       <script src> 都触发 onerror，等价于"没有数据文件夹 → 退回内置数据"
     想测真实文件加载：loadApp({ withWheelFiles: true }) */
  opts.noWheelFiles = !opts.withWheelFiles;
  const { doc, byId } = makeDom();
  const store = new Map();
  /* preload：预置 localStorage —— 用来模拟「浏览器里已经有存档」。
     这个很重要：首次打开走的是 seed() 路径，老用户走的是 load() → normalize() 路径，
     两条路的代码不一样，**只测 seed 会漏掉 normalize 里的错**（踩过）。
     用法：loadApp({ preload:{ 'zhoushu-wheel.v1': JSON.stringify(obj) } }) */
  Object.keys(opts.preload || {}).forEach(k => store.set(k, String(opts.preload[k])));

  /* 虚拟定时器队列：{ id, at(虚拟毫秒), fn, raf } */
  const queue = [];
  let timerSeq = 0;
  const queueTimer = (fn, ms, raf) => { const id = ++timerSeq; queue.push({ id, at:vnow + ms, fn, raf:!!raf, ms }); return id; };
  const dropTimer = id => { const i = queue.findIndex(t => t.id === id); if (i >= 0) queue.splice(i, 1); };

  const sandbox = {
    console,
    document: doc,
    window: null,
    navigator: { vibrate(){}, clipboard:{ writeText: async () => {} }, userAgent:'node' },
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => {
        if (opts.storageSetError) {
          const err = typeof opts.storageSetError === 'function' ? opts.storageSetError(k, v) : opts.storageSetError;
          if (err) throw (err instanceof Error ? err : new Error(String(err)));
        }
        store.set(k, String(v));
      },
      removeItem: k => store.delete(k)
    },
    location: { href:'file:///index.html', reload(){} },
    /* window 上的事件：bindEvents() 会挂 popstate / resize / orientationchange。
       ⚠️ 少了 addEventListener 会让 bindEvents() 抛错 —— 而它是被 loadWheelFiles 的
          try/catch 包着的，于是 **boot() 静默不执行**：启动小字、图标、fitWheel 全没跑，
          测试却"看起来"是通的。（这个洞让好几个测试其实没测到真正的启动路径） */
    addEventListener: (t, fn) => { (sandbox.__winListeners[t] = sandbox.__winListeners[t] || []).push(fn); },
    removeEventListener: () => {},
    dispatchEvent: () => true,
    __winListeners: {},
    history: {
      replaceState(){}, pushState(){}, go(){}, back(){},
      get state(){ return null; },
      get length(){ return 1; }
    },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    setInterval: () => 0,
    clearInterval: () => {},
    ResizeObserver: function(){ this.observe = () => {}; this.disconnect = () => {}; },
    Image: function(){ this.src = ''; },
    Audio: function(){ this.play = () => {}; },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL(){} },
    Blob: function(){},
    indexedDB: { open: () => { throw new Error('no idb in sandbox'); } },
    Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Promise, Map, Set,
    Symbol, isFinite, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    Uint8ClampedArray, Float64Array, Int32Array, Uint8Array, ArrayBuffer
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  /* 假时钟：所有定时器都进虚拟队列，drain(ms) 按虚拟时间推进。
     performance.now() 也跟着虚拟时钟走（animateSpin / startChartAnim 用它算进度）。 */
  let vnow = opts.fakeNow || Date.now();
  sandbox.performance = { now: () => vnow };
  sandbox.requestAnimationFrame = fn => queueTimer(fn, 16, true);
  sandbox.cancelAnimationFrame = id => dropTimer(id);
  sandbox.setTimeout = (fn, ms) => queueTimer(fn, ms || 0, false);
  sandbox.clearTimeout = id => dropTimer(id);

  /* html：换一份 index.html 来跑（默认用工程里那份）。
     用途：调试时把源码复制一份、手工插日志进去跑，不用改真文件。
     用法：loadApp({ html: fs.readFileSync('_dev/_probe.html','utf8') }) */
  const srcHtml = opts.html || HTML;
  let main = extractScript(srcHtml);
  const tail = '\n;(globalThis.__T = Object.assign({}, ZW, { state:() => state, ui, NAV, wheelById, nextOf, chartAfter, chartSlots, ' +
    'chartSlotIndex, flowJump, showChartThen, showChartForEnd, spin, switchTo, navTo, navBack, navGoBack, navCloseAll, ' +
    'navDepth, isOverlayOpen, topNav, renderSheet, handleAction, isGradeWheel, parseGrade, chartDims, chartLiveDims, ' +
    'saveRoundChart, resetFlow, renderFlowBar, draw, layoutSectors, applyGrowth, grownLabel, currentWheel, save, load, ' +
    'normalize, dimsUpTo, createChartSnapshot, prevChartOf, moveChart, moveWheel, applyWheelFiles, wheelFileText, ' +
    'indexFileText, wheelFileName, attrCountUpTo, scheduleSync, toast, askDialog, loopDetected, nextInOrderAfter, ' +
    'storageStatus, storageStatusText, importSummary, importSummaryText, importDataText, restoreImportState, stateOptionCount, ' +
    'boot, chartColors, gradeValue: (l) => parseGrade(l), continueFlow, chartMidAt, hideToast, ' +
    'chartDwellSec, drawRadar, startChartAnim, drawDharmaWheel, dharmaWheelCanvas, paletteOf, paletteKeyNow, ' +
    'fileWheelCountGet: () => fileWheelCount, dirUsableGet: () => dirUsable, bootingGet: () => booting, ' +
    'parseGrowth, applyGrowth: applyGrowth, growLabel, GRADE_LADDER, GROW_ALIAS, growTargetWheel, ' +
    'wheelOptions, faceOptions, activeOptions, currentWheel, editFaceIndex, editOpts, findOptionById }));\n';
  main = main.replace(/\}\)\(\);\s*$/, tail + '})();');
  if (main.indexOf('__T = ') < 0) throw new Error('导出钩子插入失败（IIFE 结尾没匹配上）');

  /* 顺序：命名空间 → 插件 → 主逻辑。插件在主逻辑的 IIFE *外面*，
     所以它们只通过 ZW 暴露自己；主逻辑在 IIFE 里用同名短名转发（见 index.html 的"命名空间转发"段）。 */
  const bundle = bundlePlugins();
  const code = bundle.code + '\n' + main;
  if (process.env.HARNESS_DUMP) {
    fs.writeFileSync(path.join(__dirname, '_last_load.js'), code, 'utf8');
  }

  const ctx = vm.createContext(sandbox);

  /* ⚠️ 必须在 vm.runInContext 之前注册 scriptLoader！
     因为主逻辑的最后一行是 init() → loadWheelFiles(...)，它在那一刻就会 appendChild
     那个 <script src="转盘/_index.js">。loader 晚一步注册的话，第一次加载就没人接管，
     done() 要等 5 秒兜底定时器 —— 而且拿到的还是空数组（内置数据）。 */
  setScriptLoader(el => {
    if (sandbox.__traceScript) console.log('[scriptLoader] 收到 ' + el.tagName + ' src=' + el.src);
    const fire = (which, ev) => Promise.resolve().then(() => { try { if (el[which]) el[which](ev); } catch(e){ console.error('[script ' + which + ' 回调出错]', e && e.message); } });
    const rel = String(el.src || '').split('?')[0].replace(/^\.\//, '');
    if (opts.noWheelFiles) { if (sandbox.__traceScript) console.log('[scriptLoader] noWheelFiles → onerror'); fire('onerror', {}); return; }
    /* 只放行「转盘」目录下的数据文件，别让别的东西意外执行 */
    if (!/^转盘\//.test(rel)) { if (sandbox.__traceScript) console.log('[scriptLoader] 不在转盘/ 下 → onerror: ' + rel); fire('onerror', {}); return; }
    let text = null;
    try { text = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch(e){ text = null; }
    if (text == null) { if (sandbox.__traceScript) console.log('[scriptLoader] 读不到文件 → onerror: ' + rel); fire('onerror', {}); return; }
    try {
      vm.runInContext(text, ctx, { filename: rel });
      if (process.env.HARNESS_TRACE || sandbox.__traceScript) console.log('[scriptLoader] 已执行 ' + rel +
        ' → __ZW_INDEX=' + (sandbox.window.__ZW_INDEX || []).length + ' __ZW_WHEELS=' + (sandbox.window.__ZW_WHEELS || []).length);
    }
    catch(e) { console.error('[数据文件执行出错] ' + rel + ': ' + (e && e.message)); fire('onerror', {}); return; }
    fire('onload', {});
  });

  vm.runInContext(code, ctx, { filename:'index.html' });
  /* 插件没加载成功时给出明确报错，别让测试里只看到莫名其妙的 undefined */
  const Z = sandbox.ZW;
  if (!Z) throw new Error('js/_ns.js 没有执行 → ZW 不存在（检查 index.html 的 <script src> 顺序）');
  if (!Z.PALETTES || !Z.$ || !Z.clamp) {
    throw new Error('js/util.js 没有把工具挂到 ZW 上（缺 PALETTES/$/clamp）→ 检查 _dev/harness.js 的插件顺序');
  }

  let log = () => {};
  if (opts.trace) {
    const realSet = sandbox.setTimeout, realClear = sandbox.clearTimeout;
    let depth = 0;
    const pad = () => '  '.repeat(depth);
    log = (...a) => console.log(pad() + a.join(' '));
    sandbox.setTimeout = (fn, ms) => { const id = realSet(fn, ms); log('[set  ] id=' + id + ' ms=' + (ms || 0)); return id; };
    sandbox.clearTimeout = id => { log('[clear] id=' + id); return realClear(id); };
  }

  /* 让 <script src="…"> 真的加载：读磁盘 → 在同一个沙箱里执行 → 触发 onload/onerror。
     用微任务延后触发，避免在 appendChild 里同步回调（真实浏览器也是异步的）。
     默认从工程根目录读（转盘/*.js）；opts.noWheelFiles = true 时一律 onerror，
     用来模拟「没有数据文件夹 → 退回内置数据」。 */
  /* 延迟加载的 <script src>：已在上面的 setScriptLoader 里处理 */

  /* 推进虚拟时间 ms：到点的定时器按时间顺序执行（rAF 算 16ms 一帧）
     回调里的 Promise 微任务会在每轮之间自动跑完，用 await 依赖的测试请用 drainAsync */
  function drain(ms){
    const limit = vnow + (ms == null ? Infinity : ms);
    let guard = 0;
    while (guard++ < 20000) {
      let best = -1;
      for (let i = 0; i < queue.length; i++) if (queue[i].at <= limit && (best < 0 || queue[i].at < queue[best].at)) best = i;
      if (best < 0) break;
      const t = queue.splice(best, 1)[0];
      vnow = Math.max(vnow, t.at);
      try { t.fn(vnow); } catch(e){ console.error('[timer error]', e && e.message, e && e.stack); }
    }
    vnow = Math.max(vnow, limit === Infinity ? vnow : limit);
    return vnow;
  }
  /* 同上，但每步之后让微任务队列跑完（switchTo 里有 await） */
  async function drainAsync(ms){
    const limit = vnow + (ms == null ? Infinity : ms);
    let guard = 0;
    while (guard++ < 20000) {
      let best = -1;
      for (let i = 0; i < queue.length; i++) if (queue[i].at <= limit && (best < 0 || queue[i].at < queue[best].at)) best = i;
      if (best < 0) break;
      const t = queue.splice(best, 1)[0];
      vnow = Math.max(vnow, t.at);
      try { t.fn(vnow); } catch(e){ console.error('[timer error]', e && e.message, e && e.stack); }
      await Promise.resolve();
      await new Promise(r => setImmediate(r));
    }
    vnow = Math.max(vnow, limit === Infinity ? vnow : limit);
    return vnow;
  }
  const pending = () => queue.map(t => ({ id:t.id, at:t.at - vnow, raf:t.raf }));

  /* 让所有"排着的微任务"跑完。
     为什么需要它：数据文件的加载是「onload 微任务 → 再 appendChild 下一批脚本」这样
     一层层链下去的，只跑一次 drainAsync 会在链条中途返回（日志顺序看起来也会乱）。
     启动相关、文件加载相关的断言，前面都要先 await 它。 */
  async function settle(rounds){
    const n = rounds || 30;
    for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r));
  }
  return { T: sandbox.__T, sandbox, byId, store, drain, drainAsync, pending, now: () => vnow, settle };
}

module.exports = { loadApp, extractScript, ROOT };
