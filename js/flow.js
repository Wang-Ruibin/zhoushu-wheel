/* 咒术转盘 · 分支流程：跳转、返回栈、循环检测、流程条与体检
   （阶段 C 从 index.html 内联脚本拆出；仍是无构建普通 <script>，只经 ZW 命名空间互通） */
(function(){
'use strict';
const { $, BASE_FLOW, CHART_SHOW_DELAY, END, STAY, chartMidAt, currentWheel, esc, faceOf, icon, isMultiWheel, isOverlayOpen, navTo, nextInOrderAfter, nextOf, num, refreshTitle, save, saveRoundChart, setRandomSeed, setResult, showChartForEnd, showChartThen, spin, state, toast, ui, wheelById, wheelOptions } = ZW;

let jumpTimer = null, arriveTimer = null;

function continueFlow(id){
  const f = state.flow;
  if (!f || !f.autoJump || f.paused || f.finished) return false;
  const target = wheelById(id);
  if (!target) { f.pendingId = ''; renderFlowBar(); return false; }
  clearJump();
  f.pendingId = '';
  switchTo(id, { silent:true, spin: f.autoSpin });
  return true;
}

function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

function clearJump(){
  if (jumpTimer) { clearTimeout(jumpTimer); jumpTimer = null; }
  if (arriveTimer) { clearTimeout(arriveTimer); arriveTimer = null; }
}

async function switchTo(id, opts){
  opts = opts || {};
  const target = wheelById(id);
  if (!target) return;
  clearJump();
  if (id === state.currentId) { if (opts.spin) spin(); return; }
  const stage = $('.stage');
  /* 拿不到舞台元素也要能跳（比如 DOM 被改过 / 别的地方复用了跳转逻辑），
     不能让"少一个淡出动画"把整条流程打断 */
  if (stage) stage.classList.add('fading');
  await wait(160);
  state.currentId = id;
  ui.flowCollapsed = true;              // 跳转后先收起流程条，避免抢视线
  setResult('？', false);
  ZW.resultEl.classList.remove('small');
  refreshTitle();
  ZW.requestDraw();
  save();
  if (stage) stage.classList.remove('fading');
  if (!opts.silent) toast('已跳到「' + target.name + '」');
  if (opts.spin) arriveTimer = setTimeout(() => { arriveTimer = null; spin(); }, 500);
}

function resetFlow(){
  const f = state.flow;
  clearJump();
  f.path = []; f.pendingId = ''; f.finished = false; f.retStack = []; f.paused = false;
  f.grow = {};                                   // 新一轮：清空成长累计
  setRandomSeed(state.settings.randomSeed || ''); // 同一种子重新开始会得到同一轮结果
  f.roundAt = Date.now();                        // 新的一轮：属性图从这一刻重新算
  const rootId = (f.rootId && wheelById(f.rootId)) ? f.rootId : state.currentId;
  save();
  renderFlowBar();
  if (rootId !== state.currentId) switchTo(rootId, { silent:true });
  else toast('已回到起点');
}

function flowJump(w, opt, label){
  const f = state.flow;
  if (!f.enabled) return;
  if (!Array.isArray(f.retStack)) f.retStack = [];
  f.path.push({ wheelId:w.id, wheel:w.name, label:label, at:Date.now() });
  if (f.path.length > 160) f.path = f.path.slice(-120);
  ui.flowCollapsed = false;

  const explicit = !!(opt && opt.next);
  let nx = nextOf(w, opt);
  /* 分支转盘本身不在默认顺序里：抽完如果没为这个选项设目标，
     就回到「当初从哪个转盘拐进来的」，接着那个转盘的默认下一站往下走 */
  if (w.branch && !explicit) {
    let guard = 0;
    while (nx.kind === 'none' && f.retStack.length && guard++ < 30) {
      const back = f.retStack.pop();
      const origin = back ? wheelById(back.origin) : null;
      if (!origin) continue;
      nx = nextOf(origin, null);
      /* 「接着原转盘的默认顺序」：
         - 原盘没设默认下一站 → 顺着列表顺序找下一个普通转盘
         - 原盘的默认下一站就是这条分支自己（或另一个分支）→ 同上，避免自己跳回自己
         - 只有明确写了「结束」才真的结束 */
      if (nx.kind === 'none' || (nx.kind === 'wheel' && (nx.wheel.id === w.id || nx.wheel.branch))) {
        const alt = nextInOrderAfter(origin.id);
        nx = alt ? { kind:'wheel', id:alt.id, wheel:alt } : { kind:'none' };
      }
      if (origin.branch && nx.kind === 'none') continue;   // 原转盘自己也是分支 → 继续往外找
      break;
    }
  }
  if (nx.kind === 'end') {
    f.pendingId = ''; f.finished = true;
    saveRoundChart();                               // 记录一下本局结果（供导出/统计）
    save(); renderFlowBar();
    toast('流程结束：' + label, { action:'重新开始', fn:resetFlow });
    const finish = () => { if (!isOverlayOpen()) navTo('complete'); };
    if (!showChartForEnd(finish)) setTimeout(finish, CHART_SHOW_DELAY);
    return;
  }
  if (nx.kind === 'wheel') {
    /* 防死循环：最近 12 步里出现「长度 1~4 的循环重复 3 轮以上」→ 临时暂停自动跳转
       （只暂停，不改开关；点「继续」/手动切换/重来即恢复） */
    const loopLen = f.autoJump && !f.paused ? loopDetected() : 0;
    if (loopLen) {
      f.paused = true; f.pendingId = '';
      save(); renderFlowBar();
      const where = loopLen === 1 ? ('「' + w.name + '」') : (loopLen + ' 个转盘之间');
      toast('流程在 ' + where + ' 反复循环，已临时暂停自动跳转', { action:'继续连转', fn:() => { state.flow.paused = false; renderFlowBar(); toast('已恢复自动跳转'); } });
      return;
    }
    /* 顺序走到维度图那一位：先弹出来看一眼，自动收起后再继续往下一站。
       只在"会自动往下走"的时候才弹（手动模式 / 已暂停时点「→ 下一站」就行，别抢注意力）。
       开关：「中途自动弹出维度图」(chartMid)，停留时长见设置里的 chartDwell。 */
    const midChart = (f.autoJump && !f.paused) ? chartMidAt(w.id) : null;
    if (midChart) {
      if (nx.wheel.branch) f.retStack.push({ origin: w.id }); else f.retStack.length = 0;
      f.pendingId = nx.id;
      const here = state.currentId;                 // 收图那一刻还停在本盘才算数
      save(); renderFlowBar();
      showChartThen(midChart, () => {
        if (state.currentId !== here) {             // 用户自己换了转盘 → 别把他拽回来
          if (state.flow.pendingId === nx.id) { state.flow.pendingId = ''; renderFlowBar(); }
          return;
        }
        continueFlow(nx.id);
      });
      return;
    }
    if (nx.wheel.branch) f.retStack.push({ origin: w.id });   // 拐进分支：记住回来的路
    else f.retStack.length = 0;                               // 回到主线：偏离结束
    f.pendingId = nx.id;
    save(); renderFlowBar();
    if (!f.autoJump || f.paused) return;           // 手动模式 / 已暂停：点顶部「→ 下一站」再走
    jumpTimer = setTimeout(() => {
      jumpTimer = null;
      continueFlow(nx.id);
    }, Math.max(400, num(f.delay) * 1000));
    return;
  }
  if (!w.branch) f.retStack.length = 0;            // 主线停在原地，同样算偏离结束
  f.pendingId = '';
  save(); renderFlowBar();
}
/* 最近 12 步里是否出现长度 1~4 的循环（重复 3 轮以上）→ 返回循环长度，否则 0 */

/* 最近 12 步里是否出现长度 1~4 的循环（重复 3 轮以上）→ 返回循环长度，否则 0 */
function loopDetected(){
  const p = state.flow.path;
  if (!p || p.length < 6) return 0;
  const ids = p.slice(-12).map(x => x.wheelId);
  for (let len = 1; len <= 4; len++) {
    const need = len * 3;
    if (ids.length < need) continue;
    let same = true;
    for (let i = ids.length - need + len; i < ids.length; i++) {
      if (ids[i] !== ids[i - len]) { same = false; break; }
    }
    if (same) return len;
  }
  return 0;
}

let flowCollapseTimer = null;

function scheduleFlowCollapse(){
  clearTimeout(flowCollapseTimer);
  flowCollapseTimer = null;
  if (!state.flow.enabled || ui.flowCollapsed) return;
  if (!state.flow.path.length && !state.flow.pendingId) return;
  flowCollapseTimer = setTimeout(() => {
    flowCollapseTimer = null;
    if (state.flow.enabled && (state.flow.path.length || state.flow.pendingId)) {
      ui.flowCollapsed = true;
      renderFlowBar();
    }
  }, 7000);
}

function expandFlowBar(){
  ui.flowCollapsed = false;
  renderFlowBar();
}

function renderFlowBar(){
  const bar = $('#flowBar');
  if (!bar) return;
  const f = state.flow || BASE_FLOW;
  if (!f.enabled) { bar.hidden = true; bar.className = 'flow-bar'; bar.innerHTML = ''; return; }
  const cur = currentWheel();
  const pend = f.pendingId ? wheelById(f.pendingId) : null;
  bar.hidden = false;
  if (ui.flowCollapsed) {
    bar.className = 'flow-bar collapsed';
    bar.innerHTML = '<button class="flow-collapsed" data-act="expandFlow" aria-expanded="false" title="展开流程路径">' +
        icon('branch') + esc(cur ? cur.name : '') + ' · 第 ' + (f.path.length + 1) + ' 步</button>' +
      (pend ? '<button class="flow-next" data-act="goPending" title="立即前往下一站">→ ' + esc(pend.name) + '</button>' : '');
    return;
  }
  bar.className = 'flow-bar';
  let chips = '';
  f.path.forEach((p, i) => {
    chips += '<button class="flow-chip" data-act="gotoStep" data-idx="' + i + '" title="回到这一步重来"><b>' + esc(p.wheel) + '</b><i>' + esc(p.label) + '</i></button>' +
             '<span class="flow-arrow" aria-hidden="true">›</span>';
  });
  chips += '<span class="flow-chip cur">' + esc(cur ? cur.name : '') +
    /* 多面转盘：顺手标出它此刻用的是哪一面 */
    (cur && isMultiWheel(cur) ? '<i>· ' + esc(faceOf(cur).face ? ZW.faceWhenText(faceOf(cur).face) : '兜底面') + '</i>' : '') +
    '</span>';
  const paused = !!f.paused;
  bar.innerHTML = '<button class="flow-reset" data-act="resetFlow" aria-label="回到起点重新开始" title="回到起点重新开始">' + icon('refresh') + '</button>' +
    '<div class="flow-strip">' + chips + '</div>' +
    (paused
      ? '<button class="flow-next paused" data-act="resumeFlow" title="点一下恢复自动跳转">⏸ 已暂停 · 继续</button>'
      : (pend ? '<button class="flow-next" data-act="goPending" title="立即前往下一站">→ ' + esc(pend.name) + '</button>' : ''));
  const strip = bar.querySelector('.flow-strip');
  if (strip) strip.scrollLeft = strip.scrollWidth;
  scheduleFlowCollapse();
}

function flowDiagnostics(){
  const issues = [];
  const normal = state.wheels.filter(w => !w.branch);
  const ids = new Set(state.wheels.map(w => w.id));
  const graph = new Map(state.wheels.map(w => [w.id, []]));
  const incoming = new Map(state.wheels.map(w => [w.id, 0]));
  const addEdge = (from, to) => {
    if (!from || !ids.has(to) || to === END || to === STAY) return;
    if (graph.get(from).indexOf(to) < 0) graph.get(from).push(to);
    incoming.set(to, (incoming.get(to) || 0) + 1);
  };
  state.wheels.forEach(w => {
    const fallback = w.next || ((!w.branch && nextInOrderAfter(w.id)) ? nextInOrderAfter(w.id).id : '');
    addEdge(w.id, fallback);
    [w.options || []].concat((w.faces || []).map(facet => facet.options || [])).forEach(list => {
      list.forEach(option => addEdge(w.id, option.next));
    });
    if (!wheelOptions(w).some(option => num(option.weight) > 0)) {
      issues.push({ level:'error', text:'「' + w.name + '」没有可抽选项' });
    }
  });
  state.wheels.filter(w => w.branch && !(incoming.get(w.id) > 0)).forEach(w => {
    issues.push({ level:'warn', text:'分支盘「' + w.name + '」没有任何入口，正常流程到不了这里' });
  });
  const root = (state.flow.rootId && wheelById(state.flow.rootId)) || normal[0] || state.wheels[0];
  const seen = new Set();
  const walk = id => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    (graph.get(id) || []).forEach(walk);
  };
  if (root) walk(root.id);
  state.wheels.filter(w => !seen.has(w.id) && (!w.branch || incoming.get(w.id) > 0)).forEach(w => {
    issues.push({ level:'warn', text:'从起点无法到达「' + w.name + '」' });
  });
  const visiting = new Set(), done = new Set(), cycleNames = new Set();
  const visit = id => {
    if (visiting.has(id)) { const w = wheelById(id); if (w) cycleNames.add(w.name); return; }
    if (done.has(id)) return;
    visiting.add(id);
    (graph.get(id) || []).forEach(visit);
    visiting.delete(id); done.add(id);
  };
  state.wheels.forEach(w => visit(w.id));
  if (cycleNames.size) issues.push({ level:'warn', text:'检测到可能循环：' + Array.from(cycleNames).join('、') + '（运行时仍会在连续循环后暂停）' });
  return issues;
}

Object.assign(ZW, { jumpTimer, arriveTimer, continueFlow, wait, clearJump, switchTo, resetFlow, flowJump, loopDetected, flowCollapseTimer, scheduleFlowCollapse, expandFlowBar, renderFlowBar, flowDiagnostics });
})();
