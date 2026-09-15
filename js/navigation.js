/* 咒术转盘 · 导航与界面外壳：面板栈、返回键、toast、对话框、标题与主题
   （阶段 C 从 index.html 内联脚本拆出；仍是无构建普通 <script>，只经 ZW 命名空间互通） */
(function(){
'use strict';
const { $, currentWheel, esc, state } = ZW;

const ui = { view:'none', mtab:'wheels', treeOpen:{}, targetCtx:null, flowCollapsed:false, resultLabel:'', resultOptId:'',
             faceWheelId:'', faceEdit:'auto', faceWhenIdx:-1, wheelQuery:'', wheelFilter:'all', simResults:null };
/* 跨模块共享的运行时变量在 js/core.js 里。转盘角度 rot 由 js/spin.js 每帧改写、
   绘制这边要读，所以集中放 core；绘制里统一写 core.rot（别用本地副本，会不同步）。 */

let toastTimer = null;

function toast(msg, opts){
  const el = $('#toast');
  el.innerHTML = '<span>' + esc(msg) + '</span>';
  if (opts && opts.action) {
    const b = document.createElement('button');
    b.className = 'toast-act';
    b.textContent = opts.action;
    b.onclick = () => { hideToast(); try { opts.fn && opts.fn(); } catch(e){} };
    el.appendChild(b);
  }
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, (opts && opts.action) ? 3400 : 1800);
}

function hideToast(){ $('#toast').classList.remove('show'); }

function askDialog(o){
  o = o || {};
  return new Promise(resolve => {
    const ov = $('#confirmOverlay');
    const previousFocus = document.activeElement;
    $('#cTitle').textContent = o.title || '提示';
    const d = $('#cDesc'); d.textContent = o.desc || ''; d.hidden = !o.desc;
    const inp = $('#cInput');
    const isInput = o.value !== undefined && o.value !== null;
    inp.hidden = !isInput;
    if (isInput) inp.value = o.value;
    const ok = $('#cOk');
    ok.textContent = o.ok || '确定';
    ok.classList.toggle('danger', !!o.danger);
    ov.classList.add('open');
    const cancel = $('#cCancel');
    setTimeout(() => {
      try {
        if (isInput) { inp.focus(); inp.select(); }
        else ok.focus();
      } catch(e){}
    }, 60);
    const finish = v => {
      ov.classList.remove('open');
      ok.onclick = null; cancel.onclick = null; inp.onkeydown = null; ov.onclick = null; ov.onkeydown = null;
      if (previousFocus && previousFocus.focus && document.contains(previousFocus)) {
        setTimeout(() => { try { previousFocus.focus(); } catch(e){} }, 0);
      }
      resolve(v);
    };
    ok.onclick = () => finish(isInput ? inp.value : true);
    cancel.onclick = () => finish(isInput ? null : false);
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ok.click(); } };
    ov.onclick = e => { if (e.target === ov) finish(isInput ? null : false); };
    ov.onkeydown = e => {
      if (e.key === 'Escape') { e.preventDefault(); finish(isInput ? null : false); return; }
      if (e.key !== 'Tab') return;
      const focusables = isInput ? [inp, cancel, ok] : [cancel, ok];
      const at = focusables.indexOf(document.activeElement);
      if (e.shiftKey && at <= 0) { e.preventDefault(); focusables[focusables.length - 1].focus(); }
      else if (!e.shiftKey && at === focusables.length - 1) { e.preventDefault(); focusables[0].focus(); }
    };
  });
}

const NAV = { stack: [], swallowPop: 0, lastFocus: null, hideTimer: null };

const scrollMemo = {};

function isOverlayOpen(){ return $('#overlay').classList.contains('open'); }

function topNav(){ return NAV.stack.length ? NAV.stack[NAV.stack.length - 1] : null; }

function navDepth(){ return Math.max(0, NAV.stack.length - 1); }   // 已压入的历史条目数

function navHist(){ try { history.pushState({ nav: NAV.stack.length }, ''); } catch(e){} }

function showOverlay(){
  const ov = $('#overlay');
  NAV.lastFocus = document.activeElement;
  ov.classList.remove('closing');
  ov.classList.add('open');
}

function hideOverlay(){
  const ov = $('#overlay');
  if (!ov.classList.contains('open')) return;
  ov.classList.add('closing');
  clearTimeout(NAV.hideTimer);
  NAV.hideTimer = setTimeout(() => {
    ov.classList.remove('open', 'closing');
    const lf = NAV.lastFocus;
    if (lf && lf.focus && document.contains(lf)) { try { lf.focus(); } catch(e){} }
  }, 200);
}
/* 栈顶永远是「当前状态」；返回 = 弹出栈顶并应用新的栈顶 */

/* 栈顶永远是「当前状态」；返回 = 弹出栈顶并应用新的栈顶 */
function navPush(entry, dir){
  NAV.stack.push(entry);
  ui.view = entry.view;
  if (entry.mtab) ui.mtab = entry.mtab;
  navHist();
  renderSheet(dir || 'push');
}

function navTo(view, opts){
  opts = opts || {};
  if (!NAV.stack.length) NAV.stack.push({ view:'none', mtab:ui.mtab });   // 根：主页
  const cur = topNav();
  if (cur && cur.view === view && !opts.force) {                          // 已在同一层：只切标签
    if (opts.mtab && opts.mtab !== ui.mtab) { navPush({ view:view, mtab:opts.mtab }, 'swap'); return; }
    if (opts.mtab) ui.mtab = opts.mtab;
    renderSheet('swap');
    return;
  }
  const first = !isOverlayOpen();
  navPush({ view:view, mtab: opts.mtab || ui.mtab }, opts.dir || 'push');
  if (first) {
    showOverlay();
    const sh = $('#sheet');
    if (sh && sh.focus) { try { sh.focus({ preventScroll:true }); } catch(e){} }
  }
}

function navBack(){
  if (navDepth() <= 0) {                      // 已在根：交给浏览器（真的退出页面）
    if (isOverlayOpen()) { NAV.stack.length = 0; ui.view = 'none'; hideOverlay(); return true; }
    return false;
  }
  NAV.stack.pop();
  const prev = topNav();
  ui.view = prev.view;
  if (prev.mtab) ui.mtab = prev.mtab;
  if (prev.view === 'none') hideOverlay();
  else renderSheet('pop');
  return true;
}

function navCloseAll(){
  const n = navDepth();
  const wasChart = ui.view === 'chart';
  NAV.stack.length = 0;
  ui.view = 'none';
  hideOverlay();
  if (n > 0) { NAV.swallowPop = 1; try { history.go(-n); } catch(e){} }
  if (wasChart) ZW.afterChartDismiss();          // 自动弹的维度图被关了 → 流程接着走
}
/* 界面上的「返回 / Esc」：本地退一层，同时把浏览器历史也退一格，
   否则会留下“按了没反应”的历史条目（下次真的按返回键会空跳） */

function navGoBack(){
  ZW.chartAutoCancel();
  hideToast();                      // 自动弹图的提示条别跟着飘在下一站
  if (navDepth() <= 0) { if (isOverlayOpen()) navCloseAll(); return false; }
  const wasChart = ui.view === 'chart';
  NAV.swallowPop++;
  try { history.go(-1); } catch(e){ NAV.swallowPop--; }
  const r = navBack();
  if (wasChart) ZW.afterChartDismiss();          // 自动弹的维度图被关了 → 流程接着走
  return r;
}
/* 兼容旧调用点 */

/* 兼容旧调用点 */
function openSheet(view, mtab){ navTo(view, mtab ? { mtab:mtab } : null); }

function closeSheet(){ navCloseAll(); }

function renderSheet(dir){
  const sheet = $('#sheet');
  const key = ui.view + '|' + ui.mtab;
  const prevBody = sheet.querySelector('.sheet-body');
  if (prevBody && sheet.dataset.scrollKey) scrollMemo[sheet.dataset.scrollKey] = prevBody.scrollTop;
  let cls = 'sheet', html = '';
  if (ui.view === 'manager')      { cls = 'sheet full'; html = ZW.viewManager(); }
  else if (ui.view === 'batch')   { html = ZW.viewBatch(); }
  else if (ui.view === 'target')  { html = ZW.viewTarget(); }
  else if (ui.view === 'chart')   { cls = 'sheet chart-sheet'; html = ZW.viewChart(); }
  else if (ui.view === 'newpick') { html = ZW.viewNewPick(); }
  else if (ui.view === 'templates'){ html = ZW.viewTemplates(); }
  else if (ui.view === 'newchart'){ html = ZW.viewNewChart(); }
  else if (ui.view === 'faces')   { html = ZW.viewFaces(); }
  else if (ui.view === 'facewhen'){ html = ZW.viewFaceWhen(); }
  else if (ui.view === 'result')  { html = ZW.viewResult(); }
  else if (ui.view === 'complete'){ html = ZW.viewComplete(); }
  else if (ui.view === 'flowaudit'){ html = ZW.viewFlowAudit(); }
  else if (ui.view === 'simulation'){ html = ZW.viewSimulation(); }
  sheet.className = cls;
  const ovEl = $('#overlay');
  if (ovEl) ovEl.classList.toggle('center', ui.view === 'chart');   // 维度图：居中显示
  sheet.innerHTML = '<div class="sheet-inner' + (dir ? ' ' + dir : '') + '">' + html + '</div>';
  const body = sheet.querySelector('.sheet-body');
  if (body) body.scrollTop = scrollMemo[key] || 0;
  sheet.dataset.scrollKey = key;
  if (ui.view === 'chart') {                     // 维度图：画布就绪后播放生长/变形动画
    const dims = ui.chartDims || [];
    const from = ui.chartFrom || null;
    requestAnimationFrame(() => {
      const cv = $('#chartCv');
      if (cv && dims.length) ZW.startChartAnim(cv, dims, from);
    });
  }
}

/* ============================== 动作处理 ============================== */

function refreshTitle(){
  const w = currentWheel();
  $('#wheelName').textContent = w ? w.name : '咒术转盘';
  ZW.canvas.setAttribute('aria-label', '旋转「' + (w ? w.name : '当前转盘') + '」');
  ZW.renderFlowBar();
}

function applyTheme(){
  document.documentElement.dataset.theme = state.settings.theme === 'dark' ? 'dark' : 'light';
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = state.settings.theme === 'dark' ? '#141317' : '#F3EFE4';
  ZW.requestDraw();
}

Object.assign(ZW, { ui, toastTimer, toast, hideToast, askDialog, NAV, scrollMemo, isOverlayOpen, topNav, navDepth, navHist, showOverlay, hideOverlay, navPush, navTo, navBack, navCloseAll, navGoBack, openSheet, closeSheet, renderSheet, refreshTitle, applyTheme });
})();
