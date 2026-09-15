/* 咒术转盘 · 数据进出：JSON/玩法包导入导出、IndexedDB 目录句柄、文件写回
   （阶段 C 从 index.html 内联脚本拆出；仍是无构建普通 <script>，只经 ZW 命名空间互通） */
(function(){
'use strict';
const { END, LS_KEY, PROFILE_PREFIX, RECOVERY_KEY, STATE_VER, STAY, WHEEL_CATEGORIES, applyTheme, askDialog, chartDims, currentWheel, drawRadar, esc, inferWheelCategory, isOverlayOpen, loadState, makeOption, normalize, num, profileIndex, pushUndo, refreshTitle, renderSheet, save, setRandomSeed, slotText, state, storageErrorReset, storageStatus, toast, ui, uid, undoToast, version, wheelById, wheelOptions } = ZW;

/* fileWheelCount / dirUsable / booting 是本模块私有；主脚本 init/boot 与测试经这些口子触碰 */
function setFileWheelCount(n){ fileWheelCount = n; }
function setDirUsable(v){ dirUsable = !!v; }
function setBooting(v){ booting = !!v; }
function fileWheelCountGet(){ return fileWheelCount; }
function dirUsableGet(){ return dirUsable; }
function bootingGet(){ return booting; }

let importRecoveryRaw = (() => {
  try { return localStorage.getItem(RECOVERY_KEY) || ''; } catch(e) { return ''; }
})();

function exportData(){
  try {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '咒术转盘备份-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('已导出备份文件');
  } catch(e){ toast('导出失败'); }
}

function downloadJson(name, value){
  const blob = new Blob([JSON.stringify(value, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function packWheelIds(mode){
  if (mode === 'all') return new Set(state.wheels.map(w => w.id));
  const found = new Set();
  const visit = id => {
    if (!id || found.has(id) || !wheelById(id)) return;
    found.add(id);
    const wheel = wheelById(id);
    const refs = [wheel.next, wheel.faceBy];
    [wheel.options || []].concat((wheel.faces || []).map(facet => facet.options || [])).forEach(list => list.forEach(option => refs.push(option.next)));
    refs.forEach(ref => { if (ref !== END && ref !== STAY) visit(ref); });
  };
  visit(currentWheel().id);
  return found;
}

function buildWheelPack(mode){
  const ids = packWheelIds(mode || 'current');
  return {
    kind:'zhoushu-wheel.pack', version:1, appVersion:STATE_VER,
    name:(mode === 'all' ? '完整玩法包' : currentWheel().name),
    rootId:currentWheel().id,
    wheels:state.wheels.filter(w => ids.has(w.id)).map(w => JSON.parse(JSON.stringify(w)))
  };
}

function exportWheelPack(mode){
  try {
    const pack = buildWheelPack(mode);
    downloadJson('咒术转盘-' + pack.name.replace(/[\\/:*?"<>|]/g, '_') + '.json', pack);
    toast('已导出 ' + pack.wheels.length + ' 个转盘的玩法包');
    return pack;
  } catch(e) { toast('玩法包导出失败'); return null; }
}

function uniqueImportedName(name, used){
  const base = String(name || '导入转盘').trim() || '导入转盘';
  if (!used.has(base)) { used.add(base); return base; }
  let n = 2, next = base + '（导入）';
  while (used.has(next)) next = base + '（导入 ' + n++ + '）';
  used.add(next); return next;
}

async function importWheelPackText(text, confirmImport){
  let pack;
  try { pack = JSON.parse(text); } catch(e) { return { ok:false, error:'玩法包格式不正确' }; }
  if (!pack || pack.kind !== 'zhoushu-wheel.pack' || !Array.isArray(pack.wheels) || !pack.wheels.length) {
    return { ok:false, error:'不是有效的咒术转盘玩法包' };
  }
  const confirmed = confirmImport
    ? await confirmImport(pack)
    : await askDialog({ title:'导入玩法包', desc:'将添加“' + String(pack.name || '未命名玩法包') + '”中的 ' + pack.wheels.length + ' 个转盘；同名转盘会自动改名。', ok:'添加' });
  if (!confirmed) return { ok:false, cancelled:true };
  const raw = normalize({ version:STATE_VER, wheels:pack.wheels, settings:state.settings }).wheels;
  if (!raw.length) return { ok:false, error:'玩法包没有可用转盘' };
  pushUndo('导入玩法包');
  const used = new Set(state.wheels.map(w => w.name));
  const idMap = new Map(), nameMap = new Map();
  raw.forEach((wheel, i) => {
    const source = pack.wheels[i] || {};
    const oldId = source.id || wheel.id;
    wheel.id = uid();
    wheel.name = uniqueImportedName(wheel.name, used);
    idMap.set(oldId, wheel.id);
    nameMap.set(String(source.name || ''), wheel.id);
    wheel.options.forEach(option => { option.id = uid(); });
    (wheel.faces || []).forEach(facet => facet.options.forEach(option => { option.id = uid(); }));
  });
  const existingByName = new Map(state.wheels.map(w => [w.name, w.id]));
  const mapRef = ref => {
    if (!ref || ref === END || ref === STAY) return ref || '';
    return idMap.get(ref) || nameMap.get(ref) || existingByName.get(ref) || '';
  };
  raw.forEach(wheel => {
    wheel.next = mapRef(wheel.next);
    wheel.faceBy = mapRef(wheel.faceBy);
    [wheel.options || []].concat((wheel.faces || []).map(facet => facet.options || [])).forEach(list => {
      list.forEach(option => { option.next = mapRef(option.next); });
    });
  });
  state.wheels.push.apply(state.wheels, raw);
  state.currentId = idMap.get(pack.rootId) || raw[0].id;
  save(); refreshTitle(); ZW.requestDraw(); renderSheet('swap');
  undoToast('已导入玩法包：' + raw.length + ' 个转盘');
  return { ok:true, count:raw.length, rootId:state.currentId };
}

function roundResultText(){
  const path = state.flow.path || [];
  return path.map((item, i) => (i + 1) + '. ' + item.wheel + '：' + item.label).join('\n');
}

function wrapCanvasText(ctx2, text, maxWidth){
  const chars = Array.from(String(text || ''));
  const lines = [];
  let line = '';
  chars.forEach(ch => {
    const next = line + ch;
    if (line && ctx2.measureText(next).width > maxWidth) { lines.push(line); line = ch; }
    else line = next;
  });
  if (line) lines.push(line);
  return lines;
}

function downloadCanvasPng(cv, name){
  if (cv.toBlob) {
    cv.toBlob(blob => {
      if (!blob) { toast('图片生成失败'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, 'image/png');
    return true;
  }
  if (cv.toDataURL) {
    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png'); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    return true;
  }
  return false;
}

function exportResultCard(opts){
  opts = opts || {};
  const cv = document.createElement('canvas');
  cv.width = 1080; cv.height = 1350;
  const c = cv.getContext('2d');
  c.fillStyle = '#F3EBD8'; c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = '#FBF6E9'; c.fillRect(48, 48, 984, 1254);
  c.strokeStyle = '#B23A2F'; c.lineWidth = 8; c.strokeRect(68, 68, 944, 1214);
  c.textAlign = 'center'; c.fillStyle = '#B23A2F'; c.font = '700 70px serif'; c.fillText('咒术转盘', 540, 155);
  c.fillStyle = '#2A241C'; c.font = '700 54px serif';
  const path = state.flow.path || [];
  const final = path.length ? path[path.length - 1].label : (ui.resultLabel || '本轮结果');
  wrapCanvasText(c, final, 820).slice(0, 2).forEach((line, i) => c.fillText(line, 540, 235 + i * 62));

  const dims = chartDims();
  if (dims.length) {
    const radar = document.createElement('canvas');
    radar.width = 720; radar.height = 720;
    drawRadar(radar, dims, 1, null, 0, 0, 1);
    c.drawImage(radar, 180, 300, 720, 720);
  }
  c.textAlign = 'left'; c.fillStyle = '#4A4136'; c.font = '32px sans-serif';
  const shown = path.slice(-6);
  let y = dims.length ? 1045 : 360;
  shown.forEach((item, i) => {
    const prefix = (Math.max(0, path.length - shown.length) + i + 1) + '. ';
    const line = prefix + item.wheel + '：' + item.label;
    wrapCanvasText(c, line, 880).slice(0, 1).forEach(text => c.fillText(text, 100, y));
    y += 48;
  });
  c.textAlign = 'center'; c.fillStyle = '#8B7C65'; c.font = '24px sans-serif';
  c.fillText(new Date().toLocaleDateString() + ' · gxnatri.top', 540, 1258);
  if (opts.download !== false) {
    if (downloadCanvasPng(cv, '咒术转盘-本轮结果-' + new Date().toISOString().slice(0, 10) + '.png')) toast('结果卡片已生成');
    else toast('当前浏览器不支持导出图片');
  }
  return cv;
}

function stateOptionCount(s){
  return (s.wheels || []).reduce((total, wheel) => {
    const faceTotal = (wheel.faces || []).reduce((n, facet) => n + ((facet.options || []).length), 0);
    return total + (wheel.options || []).length + faceTotal;
  }, 0);
}

function importSummary(raw, next){
  const version = Math.max(1, num(raw && raw.version) || 1);
  const warnings = [];
  if (version > STATE_VER) warnings.push('备份来自更高版本，未知字段可能无法保留');
  if (!(raw && Array.isArray(raw.history))) warnings.push('备份没有历史记录');
  if (next.wheels.some(w => !wheelOptions(w).some(o => num(o.weight) > 0))) warnings.push('包含没有可抽选项的转盘');
  return {
    version,
    wheels:next.wheels.length,
    options:stateOptionCount(next),
    history:next.history.length,
    warnings
  };
}

function importSummaryText(summary){
  const lines = [
    '备份版本：v' + summary.version,
    '内容：' + summary.wheels + ' 个转盘、' + summary.options + ' 个选项、' + summary.history + ' 条历史',
    '导入前会自动保留当前数据，可在设置里“撤销上次导入”。'
  ];
  if (summary.warnings.length) lines.push('注意：' + summary.warnings.join('；'));
  return lines.join('\n');
}

function markStorageFailure(error){
  storageStatus.ok = false;
  storageStatus.error = (error && error.message) || '浏览器拒绝写入';
}

function replaceStateWithRecovery(next, beforeRaw){
  const nextRaw = JSON.stringify(next);
  try {
    localStorage.setItem(RECOVERY_KEY, beforeRaw);
    localStorage.setItem(LS_KEY, nextRaw);
    if (profileIndex && profileIndex.current) localStorage.setItem(PROFILE_PREFIX + profileIndex.current, nextRaw);
  } catch(e) {
    try { localStorage.setItem(LS_KEY, beforeRaw); } catch(ignore){}
    markStorageFailure(e);
    return false;
  }
  importRecoveryRaw = beforeRaw;
  loadState(next);
  setRandomSeed(state.settings.randomSeed || '');
  storageStatus.ok = true;
  storageStatus.at = Date.now();
  storageStatus.error = '';
  storageErrorReset();
  scheduleSync();
  return true;
}

async function importDataText(text, confirmImport){
  let raw, next;
  try {
    raw = JSON.parse(text);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('根内容不是对象');
    next = normalize(raw);
  } catch(e) {
    return { ok:false, error:'文件格式不正确' };
  }
  if (!next.wheels.length) return { ok:false, error:'文件里没有转盘数据' };
  const summary = importSummary(raw, next);
  const confirmed = confirmImport
    ? await confirmImport(summary)
    : await askDialog({ title:'确认导入备份', desc:importSummaryText(summary), ok:'导入' });
  if (!confirmed) return { ok:false, cancelled:true, summary };
  const beforeRaw = JSON.stringify(state);
  if (!replaceStateWithRecovery(next, beforeRaw)) {
    return { ok:false, error:'无法创建恢复点，当前数据没有改变', summary };
  }
  applyTheme(); refreshTitle(); ZW.requestDraw(); renderSheet();
  return { ok:true, summary };
}

async function restoreImportState(confirmRestore){
  if (!importRecoveryRaw) return false;
  let previous;
  try { previous = normalize(JSON.parse(importRecoveryRaw)); } catch(e) { return false; }
  if (!previous.wheels.length) return false;
  const confirmed = confirmRestore
    ? await confirmRestore(previous)
    : await askDialog({ title:'撤销上次导入', desc:'恢复导入前的 ' + previous.wheels.length + ' 个转盘；当前数据会成为新的恢复点。', ok:'恢复' });
  if (!confirmed) return false;
  const currentRaw = JSON.stringify(state);
  if (!replaceStateWithRecovery(previous, currentRaw)) return false;
  applyTheme(); refreshTitle(); ZW.requestDraw(); renderSheet();
  return true;
}

const WHEEL_DIR = '转盘';

const FILE_INDEX = '_index.js';

let fileWheelCount = 0;

let dirHandle = null;        // 已授权写入的「转盘」文件夹

let dirUsable = false;       // 本次会话能不能直接写文件

let booting = true;          // 启动阶段不触发自动写回

function registerWheelFile(def){ (window.__ZW_WHEELS = window.__ZW_WHEELS || []).push(def); }

function loadWheelFiles(done, bust){
  window.__ZW_REGISTER = registerWheelFile;
  window.__ZW_WHEELS = [];
  const q = bust ? ('?t=' + Date.now()) : '';
  let finished = false;
  const finish = () => { if (!finished) { finished = true; done((window.__ZW_WHEELS || []).slice()); } };
  const idx = document.createElement('script');
  idx.src = WHEEL_DIR + '/' + FILE_INDEX + q;
  idx.onerror = () => { finished = true; done([]); };          // 没有文件夹 → 用内置数据
  idx.onload = () => {
    const list = window.__ZW_INDEX || [];
    if (!list.length) { finish(); return; }
    let left = list.length;
    const tick = () => { if (--left <= 0) finish(); };
    list.forEach(f => {
      const s = document.createElement('script');
      s.src = WHEEL_DIR + '/' + f + q;
      s.onload = tick; s.onerror = tick;                       // 单个文件坏了也不卡住
      document.head.appendChild(s);
    });
    setTimeout(finish, 5000);                                  // 兜底
  };
  document.head.appendChild(idx);
}
/* ---- 多面转盘的存档读写 ----
   存进数据文件时 faceBy 写「转盘名」（和 next 一样，方便手改）；
   内存里存 id。faces[].when 里的名字类条件直接存原文。 */

function faceToFile(f){
  const out = { when: f.when || { type:'else' }, options: f.options.map(o => {
    const z = { label:o.label, weight:num(o.weight) };
    if (o.color) z.color = o.color;
    if (o.next) z.next = slotText(o.next);
    return z;
  }) };
  return out;
}

function applyWheelFiles(defs){
  if (!defs || !defs.length) return false;
  const wheels = defs.filter(d => d && d.name).map(d => {
    const w = { id:uid(), name:String(d.name), category:WHEEL_CATEGORIES.indexOf(d.category) >= 0 ? d.category : inferWheelCategory(d.name), next:'', branch:!!d.branch,
                grade:(d.grade === true ? true : (d.grade === false ? false : null)),
                removeAfterPick:!!d.removeAfterPick, options:[] };
    w._order = (typeof d.order === 'number' && isFinite(d.order)) ? d.order : null;
    w._nextName = typeof d.next === 'string' ? d.next : '';
    w.options = (Array.isArray(d.options) ? d.options : []).map(o => {
      if (typeof o === 'string' || typeof o === 'number') return makeOption(o);
      const op = makeOption(o.label, o.weight == null ? 1 : o.weight, o.color || null);
      op._nextName = typeof o.next === 'string' ? o.next : '';
      return op;
    });
    /* 多面转盘：先原样收着，等下面的 byName 建好再解析 faceBy / 选项跳转 */
    w.multi = d.multi === true || (Array.isArray(d.faces) && d.faces.length > 0);
    w._faceByName = typeof d.faceBy === 'string' ? d.faceBy : '';
    w._facesRaw = Array.isArray(d.faces) ? d.faces : [];
    return w;
  });
  if (!wheels.length) return false;
  const byName = {};
  wheels.forEach(w => { byName[w.name] = w; });
  const resolve = v => {
    if (!v) return '';
    if (v === '结束' || v === 'END' || v === '__end__') return END;
    if (v === '留在本盘' || v === '__stay__') return STAY;
    return byName[v] ? byName[v].id : '';
  };
  wheels.forEach(w => {
    w.next = resolve(w._nextName); delete w._nextName;
    w.options.forEach(o => { o.next = resolve(o._nextName); delete o._nextName; });
    /* 面：选项的 next 也要解析，faceBy 用名字换成 id */
    w.faces = (w._facesRaw || []).map(f => ({
      when: (f && f.when && typeof f.when === 'object') ? f.when : { type:'else' },
      options: ((f && Array.isArray(f.options)) ? f.options : []).map(o => {
        if (typeof o === 'string' || typeof o === 'number') return makeOption(o);
        const op = makeOption(o.label, o.weight == null ? 1 : o.weight, o.color || null);
        op.next = resolve(typeof o.next === 'string' ? o.next : '');
        return op;
      })
    }));
    delete w._facesRaw;
    const src = w._faceByName ? byName[w._faceByName] : null;
    w.faceBy = src ? src.id : String(w._faceByName || '');
    delete w._faceByName;
    if (!w.multi) { w.multi = false; w.faces = []; w.faceBy = ''; }
  });
  // 文件里写了 "order" 就按它排序（方便手改顺序），没写就按文件顺序
  if (wheels.some(w => w._order != null)) {
    wheels.forEach((w, i) => { if (w._order == null) w._order = i + 1; });
    wheels.sort((a, b) => a._order - b._order);
  }
  wheels.forEach(w => { delete w._order; });
  state.wheels = wheels;                                   // 文件为准
  if (!state.wheels.some(x => x.id === state.currentId)) state.currentId = state.wheels[0].id;
  if (!state.flow.rootId || !state.wheels.some(x => x.id === state.flow.rootId)) state.flow.rootId = state.wheels[0].id;
  state.flow.path = []; state.flow.pendingId = '';
  fileWheelCount = wheels.length;
  return true;
}
/* 当前数据 → 文件文本（格式与数据文件夹里完全一致，可以来回改）
   idx = 这个转盘在列表里的位置（0 起），会写成显式的 "order" 字段 */
/* 一个选项写成文件里的那一行 */

/* 一个选项写成文件里的那一行 */
function optionFileLine(o, last){
  const no = wheelById(o.next);
  let line = '    { "label": ' + JSON.stringify(o.label);
  if (num(o.weight) !== 1) line += ', "weight": ' + num(o.weight);
  if (o.color) line += ', "color": ' + JSON.stringify(o.color);
  if (o.next === END) line += ', "next": "结束"';
  else if (o.next === STAY) line += ', "next": "留在本盘"';
  else if (no) line += ', "next": ' + JSON.stringify(no.name);
  line += ' }' + (last ? '' : ',');
  return line;
}

function wheelFileText(w, idx){
  const order = (typeof idx === 'number' && idx >= 0) ? (idx + 1) : (state.wheels.indexOf(w) + 1);
  const L = [];
  L.push('/* 咒术转盘 · 单转盘数据文件');
  L.push('   转盘名：' + w.name);
  L.push('   顺序：第 ' + order + ' 位（order 字段；顺序也可以在网页的「转盘」页拖动调整）');
  L.push('   改完保存、刷新网页即可生效（浏览器直接读这个文件）');
  L.push('   next 写「转盘名字」表示下一步去哪个转盘；写 "结束" 表示流程到此为止；不写就留在本盘');
  L.push('   branch: true 表示这是「分支转盘」：不在默认顺序里，只能被别的转盘的选项分支指到；');
  L.push('           它抽完若没给该选项设 next，会自动接着「拐进来的那个转盘」的默认下一站继续。');
  if (w.multi) {
    const src = ZW.faceSource(w);
    L.push('   multi/faceBy/faces 表示这是「多面转盘」：**照常参与默认顺序**，位置随便放，');
    L.push('           但展示什么内容取决于 faceBy 那个转盘抽到了什么（可以写多个面，按顺序取第一个命中的）。');
    L.push('           faces 里没命中的时候用最下面那个 options（兜底面）。');
    L.push('           当前分面依据：' + (src ? src.name : '（没设置）'));
  }
  L.push('   weight 是权重（决定扇区大小与概率），留空默认 1；color 可写 "#B23A2F" 固定扇区颜色 */');
  L.push('window.__ZW_REGISTER({');
  L.push('  "order": ' + order + ',');
  L.push('  "name": ' + JSON.stringify(w.name) + ',');
  L.push('  "category": ' + JSON.stringify(w.category || inferWheelCategory(w.name)) + ',');
  const nw = wheelById(w.next);
  L.push('  "next": ' + (w.next === END ? '"结束"' : (nw ? JSON.stringify(nw.name) : '""')) + ',');
  if (w.branch) L.push('  "branch": true,');
  if (w.grade === true) L.push('  "grade": true,');
  if (w.grade === false) L.push('  "grade": false,');
  if (w.multi) {
    L.push('  "multi": true,');
    L.push('  "faceBy": ' + JSON.stringify((ZW.faceSource(w) || {}).name || '') + ',');
    L.push('  "faces": [');
    (w.faces || []).forEach((f, i) => {
      L.push('    { "when": ' + JSON.stringify(f.when || { type:'else' }) + ', "options": [');
      (f.options || []).forEach((o, j) => L.push(optionFileLine(o, j === f.options.length - 1)));
      L.push('    ] }' + (i < w.faces.length - 1 ? ',' : ''));
    });
    L.push('  ],');
    L.push('  // ↑ 面都按条件从上往下试，第一个命中的生效；下面 options 是兜底面');
  }
  L.push('  "removeAfterPick": ' + (!!w.removeAfterPick) + ',');
  L.push('  "options": [');
  w.options.forEach((o, j) => L.push(optionFileLine(o, j === w.options.length - 1)));
  L.push('  ]');
  L.push('});');
  L.push('');
  return L.join('\n');
}

function wheelFileName(w, i){
  return String(i + 1).padStart(2, '0') + '-' + String(w.name).replace(/[\\/:*?"<>|]/g, '_') + '.js';
}

function indexFileText(wheels){
  const head = ['/* 转盘清单 —— 这里的顺序就是网页里「转盘」页的顺序，也是「按列表顺序串联」的顺序。',
                '   顺序变化时这个文件会跟着重写（文件名前的 01/02… 也是顺序，每个文件里还有 "order" 字段）。',
                '   新增转盘：照抄一份上面的文件、改名，再把文件名加到下面这个列表里。',
                '   当前顺序：'];
  wheels.forEach((w, i) => {
    head.push('     ' + (i + 1) + '. ' + w.name +
      (w.branch ? '  [分支转盘·不进默认顺序]' : '') +
      (isMultiWheel(w) ? '  [多面转盘·按「' + ((ZW.faceSource(w) || {}).name || '？') + '」分面]' : '') +
      '  →  ' + wheelFileName(w, i));
  });
  head.push('*/');
  return head.concat(['window.__ZW_INDEX = ['])
    .concat(wheels.map((w, i) => '  ' + JSON.stringify(wheelFileName(w, i)) + (i < wheels.length - 1 ? ',' : '')))
    .concat(['];', '']).join('\n');
}

function downloadText(name, text){
  const blob = new Blob([text], { type:'text/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
/* 记住「转盘」文件夹的授权，下次打开尽量免选（Chrome/Edge） */

/* 记住「转盘」文件夹的授权，下次打开尽量免选（Chrome/Edge） */
function idbOpen(){
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open('zswheel-db', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch(e) { rej(e); }
  });
}

async function idbSet(k, v){
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(v, k);
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
  });
}

async function idbGet(k){
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readonly');
    const q = tx.objectStore('kv').get(k);
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  });
}
/* 拿到可写目录：interactive=true 时允许弹一次目录选择/授权 */

/* 拿到可写目录：interactive=true 时允许弹一次目录选择/授权 */
async function getDir(interactive){
  if (!window.showDirectoryPicker) return null;
  try {
    if (!dirHandle) { try { dirHandle = (await idbGet('dir')) || null; } catch(e){ dirHandle = null; } }
    if (dirHandle) {
      let p = 'denied';
      try { p = await dirHandle.queryPermission({ mode:'readwrite' }); } catch(e) { p = 'denied'; }
      if (p === 'granted') return dirHandle;
      if (!interactive) return null;
      const r = await dirHandle.requestPermission({ mode:'readwrite' });
      if (r === 'granted') return dirHandle;
      dirHandle = null;
    }
    if (!interactive) return null;
    dirHandle = await window.showDirectoryPicker({ mode:'readwrite', id:'zswheel-dir' });
    try { await idbSet('dir', dirHandle); } catch(e){}
    return dirHandle;
  } catch(e) { return null; }
}
/* 把当前转盘写回「转盘」文件夹（顺带清掉已删除转盘留下的旧文件） */

/* 把当前转盘写回「转盘」文件夹（顺带清掉已删除转盘留下的旧文件） */
async function syncToFolder(opts){
  opts = opts || {};
  const wheels = state.wheels;
  if (!wheels.length) return false;
  const dir = await getDir(!!opts.interactive);
  if (!dir) { if (opts.interactive) toast('没有拿到文件夹写入权限'); return false; }
  try {
    const keep = {};
    for (let i = 0; i < wheels.length; i++) {
      const name = wheelFileName(wheels[i], i);
      keep[name] = 1;
      const fh = await dir.getFileHandle(name, { create:true });
      const ws = await fh.createWritable();
      await ws.write(wheelFileText(wheels[i], i));
      await ws.close();
    }
    const fh2 = await dir.getFileHandle(FILE_INDEX, { create:true });
    const ws2 = await fh2.createWritable();
    await ws2.write(indexFileText(wheels));
    await ws2.close();
    // 清掉已经不存在的转盘文件（只动 01-xx.js 这种命名的）
    try {
      for await (const h of dir.values()) {
        if (h.kind === 'file' && /^\d{2}-.*\.js$/.test(h.name) && !keep[h.name]) await dir.removeEntry(h.name);
      }
    } catch(e){}
    dirUsable = true;
    ui.fileError = '';
    ui.lastSync = Date.now();
    if (opts.toast) toast('已写回 ' + wheels.length + ' 个文件到「' + WHEEL_DIR + '」');
    return true;
  } catch(e) {
    dirUsable = false;
    ui.fileError = (e && e.message) || String(e || '未知错误');
    if (opts.toast) toast('写回失败：' + ((e && e.message) || e));
    return false;
  }
}

let syncTimer = null, hintedNoDir = false;

function scheduleSync(){
  if (booting || state.settings.autoSave === false) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    syncToFolder({}).then(ok => {
      if (ok) {
        if (isOverlayOpen() && ui.view === 'manager' && ui.mtab === 'settings') renderSheet('swap');
      } else if (!hintedNoDir && fileWheelCount && !booting) {
        hintedNoDir = true;
        toast('改动已存进浏览器；要同步到「' + WHEEL_DIR + '」数据文件，需要授权一次目录', { action:'授权并写回', fn:() => saveToFolder() });
      }
    });
  }, 900);
}
/* 手动「重新读取文件」：会用文件内容覆盖网页上的转盘 */

/* 手动「重新读取文件」：会用文件内容覆盖网页上的转盘 */
async function reloadFromFiles(){
  const ok = await askDialog({ title:'重新读取数据文件', ok:'读取',
    desc:'会用「' + WHEEL_DIR + '」文件夹里的内容覆盖网页上的转盘。网页上还没写回文件的改动会丢失，确定吗？' });
  if (!ok) return;
  loadWheelFiles(defs => {
    if (!defs.length) { toast('没读到数据文件'); return; }
    pushUndo('从文件重新读取');
    applyWheelFiles(defs); save();
    refreshTitle(); ZW.requestDraw(); renderSheet();
    undoToast('已从文件读取 ' + defs.length + ' 个转盘');
  }, true);
}

function fileStatusShort(){
  if (!fileWheelCount) return '数据文件：没读到「' + WHEEL_DIR + '」文件夹（当前用网页内置数据）';
  if (ui.fileError) return '数据文件：<b>写回失败</b> —— ' + esc(ui.fileError);
  if (dirUsable) return '数据文件：已同步' + (ui.lastSync ? '（' + ZW.fmtTime(ui.lastSync) + ' 写回，含顺序）' : '（含顺序）');
  return '数据文件：<b>未授权写入</b> —— 顺序等改动目前只存在浏览器里';
}

function fileStatusText(){
  const a = fileWheelCount
    ? '已读到「' + WHEEL_DIR + '」里的 <b>' + fileWheelCount + '</b> 个数据文件'
    : '没读到「' + WHEEL_DIR + '」文件夹（当前用网页内置数据）';
  const b = ui.fileError
    ? '，<b>文件写回失败</b>：' + esc(ui.fileError) + '；浏览器内的数据仍然保留'
    : dirUsable
    ? '，文件夹<b>已授权写入</b>' + (ui.lastSync ? '（上次写回 ' + ZW.fmtTime(ui.lastSync) + '）' : '')
    : '，文件夹<b>尚未授权</b>：改动先存在浏览器里（刷新不丢），点下面「保存回文件夹」选一次目录即可自动同步';
  return a + b + '。';
}

async function saveToFolder(){
  const wheels = state.wheels;
  if (!wheels.length) { toast('还没有转盘'); return; }
  if (await syncToFolder({ interactive:true, toast:true })) { renderSheet('swap'); return; }
  if (!window.showDirectoryPicker) {
    // 老浏览器：退回逐个下载
    wheels.forEach((w, i) => setTimeout(() => downloadText(wheelFileName(w, i), wheelFileText(w, i)), i * 350));
    setTimeout(() => downloadText(FILE_INDEX, indexFileText(wheels)), wheels.length * 350 + 200);
    toast('正在下载 ' + (wheels.length + 1) + ' 个文件（浏览器可能询问是否允许多个下载）');
  }
}

/* ============================== 调试出口 ==============================
   平时什么都不做（`ZW.__app` 保持 undefined），所以对用户零影响。
   想在浏览器里做验证时，在地址栏 / 控制台先设一个开关再刷新：

     localStorage.setItem('zhoushu-wheel.debug', '1')   // 然后刷新

   之后控制台就能直接用内部函数了（不用改代码、不用暴露给普通用户）：
     __app.state         当前存档
     __app.ui            界面状态（含 chartDims / chartItem）
     __app.openChart()   打开第一张维度图（等价于点「记录」页里那张）
     __app.spin()        抽一次
     __app.flowJump(...) 手动推进流程
   ==================================================================== */

Object.assign(ZW, { importRecoveryRaw, exportData, downloadJson, packWheelIds, buildWheelPack, exportWheelPack, uniqueImportedName, importWheelPackText, roundResultText, wrapCanvasText, downloadCanvasPng, exportResultCard, stateOptionCount, importSummary, importSummaryText, markStorageFailure, replaceStateWithRecovery, importDataText, restoreImportState, WHEEL_DIR, FILE_INDEX, fileWheelCount, dirHandle, dirUsable, booting, registerWheelFile, loadWheelFiles, faceToFile, applyWheelFiles, optionFileLine, wheelFileText, wheelFileName, indexFileText, downloadText, idbOpen, idbSet, idbGet, getDir, syncToFolder, syncTimer, hintedNoDir, scheduleSync, reloadFromFiles, fileStatusShort, fileStatusText, saveToFolder, setFileWheelCount, setDirUsable, setBooting, fileWheelCountGet, dirUsableGet, bootingGet });
})();
