/* 咒术转盘 · 面板视图：管理/编辑/记录/设置/结果/模板/体检等 HTML 组装
   （阶段 C 从 index.html 内联脚本拆出；仍是无构建普通 <script>，只经 ZW 命名空间互通） */
(function(){
'use strict';
const { $, CHART_DWELL_MIN, CHART_INKS, END, FACE_WHEN, GRADE_LADDER, GROW_WORD_MAX, PALETTES, SPIN_FX, STAY, WHEEL_DIR, WHEEL_INKS, attrCountUpTo, byRef, chartDims, chartDwellSec, chartInk, chartInkKey, chartLiveDims, chartPositionText, chartSlotIndex, chartSlots, colorOf, ctx, currentWheel, defaultTargetLabel, dirUsable, editFaceIndex, editOpts, editOptsName, esc, faceCount, faceOf, faceOptions, faceSourceName, fileStatusShort, fileStatusText, findOptionById, flowDiagnostics, growHintFor, icon, importRecoveryRaw, inferWheelCategory, isGradeWheel, isMultiWheel, lastResultOf, makeWheel, num, optById, prefersReducedMotion, prevChartOf, profileIndex, pushUndo, randomDraws, randomSeed, refreshTitle, renderFlowBar, requestDraw, resultEl, save, simulateWheel, slotText, spinFxKey, state, storageStatus, toast, ui, undoStack, uniqueImportedName, wheelById, wheelInkKey, wheelMatchesFilter, wheelOptions, whenLabel } = ZW;

function fmtTime(t){
  const d = new Date(t || Date.now());
  const p = n => String(n).padStart(2, '0');
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

/* ============================== 分支流程 ============================== */

function viewTarget(){
  const ctx = ui.targetCtx || { kind:'opt', wheel:'', opt:'', cur:'' };
  const title = ctx.kind === 'root' ? '设置起点转盘' : (ctx.kind === 'def' ? '设置默认下一站' : '抽中后去哪个转盘');
  const o = ctx.kind === 'opt' ? optById(ctx.wheel, ctx.opt) : null;
  const sub = ctx.kind === 'opt'
    ? '<div class="hint">当前选项：<b>' + esc((o && o.label) || '（空）') + '</b>（来自「' + esc((wheelById(ctx.wheel) || {}).name || '') + '」）</div>'
    : '<div class="hint">' + (ctx.kind === 'root' ? '流程从这里开始。' : '该转盘里所有「跟随默认」的选项都会走到这里。') + '</div>';
  return '<div class="sheet-head">' +
      '<button class="icon-btn" data-act="backFlow">' + icon('back') + '</button>' +
      '<h3 class="sheet-title">' + title + '</h3>' +
      '<button class="icon-btn" data-act="close">' + icon('close') + '</button></div>' +
    '<div class="sheet-body">' + sub +
      '<div class="list">' + state.wheels.map(x =>
        '<button class="pick-row' + (ctx.cur === x.id ? ' on' : '') + '" data-act="setTarget" data-val="' + x.id + '" data-id="' + x.id + '">' +
        '<span>' + esc(x.name) + '</span><em>' + wheelOptions(x).length + ' 项' + (isMultiWheel(x) ? ' · 多面' : '') + '</em></button>').join('') + '</div>' +
      (ctx.kind === 'root' ? '' :
        '<div class="sec-title">其他</div><div class="tools">' +
        '<button class="mini" data-act="setTarget" data-val="' + STAY + '">留在本盘</button>' +
        '<button class="mini" data-act="setTarget" data-val="' + END + '">流程结束</button>' +
        (ctx.cur ? '<button class="mini danger" data-act="setTarget" data-val="">清除设置</button>' : '') +
        '</div>') +
      '<div class="hint">选中即保存。同一个转盘可以被多个节点指向，也可以指向自己（形成循环，循环会被自动检测并提示）。</div>' +
    '</div>';
}

/* ============================== 属性维度（等级 → 维度图） ==============================
   像「E- / E / D / C / B / A / S / SS / SSS / EX」这种带等级的转盘，
   抽完一轮后汇总成一张雷达图。分值 = 等级 × 10（E- = 17，EX = 100）。
   ==================================================================================== */

function viewNewPick(){
  return '<div class="sheet-head">' +
      '<button class="icon-btn" data-act="back" aria-label="返回">' + icon('back') + '</button>' +
      '<h3 class="sheet-title">新建</h3>' +
      '<button class="icon-btn" data-act="close" aria-label="关闭">' + icon('close') + '</button></div>' +
    '<div class="sheet-body"><div class="action-list">' +
      '<button class="action-row" data-act="addWheel"><span class="ai">' + icon('plus') + '</span>新建转盘<em>抽选项用</em></button>' +
      '<button class="action-row" data-act="newChartItem"><span class="ai">' + icon('branch') + '</span>新建属性维度图<em>随时可建</em></button>' +
      '<button class="action-row" data-act="openTemplates"><span class="ai">▦</span>从模板创建<em>4 种玩法</em></button>' +
    '</div>' +
    '<div class="hint"><b>属性维度图</b>会把所选范围里的属性固化成一张雷达图（没抽到的按 <b>0</b> 算），' +
      '生成后<b>不再随转盘变化</b>；之后再建一张时，新图会<b>从上一张的形状变形过来</b>。<br>' +
      '建好之后在「记录」页可以看到全部维度图。</div></div>';
}

const WHEEL_TEMPLATES = [
  ['draw', '公平抽签', '适合抽奖、选人和随机决定'],
  ['norepeat', '不重复点名', '抽中过的名字自动移除'],
  ['story', '三幕剧情路线', '起点、遭遇、结局自动串联'],
  ['growth', '属性养成', '属性盘、成长事件和维度图示例']
];

function viewTemplates(){
  return '<div class="sheet-head"><button class="icon-btn" data-act="back" aria-label="返回">' + icon('back') + '</button>' +
    '<h3 class="sheet-title">选择玩法模板</h3><button class="icon-btn" data-act="close" aria-label="关闭">' + icon('close') + '</button></div>' +
    '<div class="sheet-body"><div class="action-list">' + WHEEL_TEMPLATES.map(item =>
      '<button class="action-row" data-act="applyTemplate" data-val="' + item[0] + '"><span class="ai">▦</span>' + item[1] + '<em>' + item[2] + '</em></button>').join('') +
    '</div><div class="hint">模板只会在本地添加转盘，不联网；添加后可像普通转盘一样修改，也可以立即撤销。</div></div>';
}

function createTemplateWheels(key){
  if (key === 'draw' || key === 'norepeat') {
    const wheel = makeWheel(key === 'draw' ? '公平抽签' : '不重复点名', ['名字 1', '名字 2', '名字 3', '名字 4']);
    wheel.category = '自定义'; wheel.removeAfterPick = key === 'norepeat';
    return [wheel];
  }
  if (key === 'story') {
    const start = makeWheel('剧情·起点', ['接受任务', '意外卷入', '主动调查']);
    const event = makeWheel('剧情·遭遇', ['遇见盟友', '遭遇强敌', '发现秘密']);
    const end = makeWheel('剧情·结局', ['平安归来', '改写命运', '留下悬念']);
    [start, event].forEach(wheel => { wheel.category = '事件'; }); end.category = '结局';
    start.next = event.id; event.next = end.id; end.next = END;
    return [start, event, end];
  }
  if (key === 'growth') {
    const attr = makeWheel('勇气', ['E（胆怯）','D（犹豫）','C（镇定）','B（果断）','A（无畏）','S（英雄）']);
    attr.category = '属性'; attr.grade = true;
    const event = makeWheel('勇气训练', ['直面恐惧（勇气+1）','保护同伴（勇气+2）','暂避锋芒（无属性成长）']);
    event.category = '事件'; attr.next = event.id; event.next = END;
    return [attr, event];
  }
  return [];
}

function applyWheelTemplate(key){
  const added = createTemplateWheels(key);
  if (!added.length) return false;
  pushUndo('添加玩法模板');
  const used = new Set(state.wheels.map(w => w.name));
  added.forEach(wheel => { wheel.name = uniqueImportedName(wheel.name, used); });
  state.wheels.push.apply(state.wheels, added);
  state.currentId = added[0].id;
  state.flow.enabled = true; state.flow.rootId = added[0].id;
  state.flow.path = []; state.flow.pendingId = '';
  save(); refreshTitle(); requestDraw(); renderFlowBar();
  return added;
}

function viewNewChart(){
  const n = ui.newChartAnchor || '';
  const head = '<div class="sheet-head">' +
      '<button class="icon-btn" data-act="back" aria-label="返回">' + icon('back') + '</button>' +
      '<h3 class="sheet-title">新建属性维度图</h3>' +
      '<button class="icon-btn" data-act="close" aria-label="关闭">' + icon('close') + '</button></div>';
  const cnt = attrCountUpTo(n);
  return head + '<div class="sheet-body">' +
    '<label class="row-switch"><span>名字</span>' +
      '<input id="newChartName" type="text" maxlength="20" style="width:56%;text-align:right" ' +
      'value="' + esc(ui.newChartName || ('属性维度图 ' + (state.charts.length + 1))) + '"></label>' +
    '<div class="sec-title">统计范围 · 这里之前的属性转盘都会算进来</div>' +
    '<div class="list">' +
      '<button class="pick-row' + (n === '__top__' ? ' on' : '') + '" data-act="setAnchor" data-val="__top__">' +
        '<span>列表最前（不统计任何转盘）</span><em>0 项</em></button>' +
      '<button class="pick-row' + (n === '' ? ' on' : '') + '" data-act="setAnchor" data-val="">' +
        '<span>全部转盘（放在列表最后）</span><em>' + attrCountUpTo('') + ' 项</em></button>' +
      state.wheels.map((w, i) =>
        '<button class="pick-row' + (n === w.id ? ' on' : '') + '" data-act="setAnchor" data-val="' + w.id + '" data-id="' + w.id + '">' +
        '<span>到「' + esc(w.name) + '」为止</span><em>' + attrCountUpTo(w.id) + ' 项</em></button>').join('') +
    '</div>' +
    '<button class="btn block" data-act="doCreateChart">生成维度图（' + cnt + ' 项属性）</button>' +
    '<div class="hint">没抽到的属性按 <b>0</b> 算，所以<b>随时都能建</b>，不必等转盘抽完。<br>' +
      '生成后这张图会<b>定格</b>、不再随转盘变化；它会在「转盘」页里排在所选的转盘后面，' +
      '之后再新建一张时，新图会从上一张的形状<b>变形过来</b>。</div>' +
  '</div>';
}

function viewChart(){
  const item = ui.chartItem || null;
  const dims = chartLiveDims(item);
  ui.chartDims = dims;
  const prev = item ? prevChartOf(item) : null;
  ui.chartFrom = prev ? chartLiveDims(prev) : null;   // 从上一张的实时数据变形过来
  const head = '<div class="sheet-head">' +
      '<span class="icon-btn" aria-hidden="true"></span>' +
      '<h3 class="sheet-title">' + esc(item ? item.name : '属性维度图') + '</h3>' +
      '<button class="icon-btn" data-act="close" aria-label="关闭">' + icon('close') + '</button></div>';
  if (!dims.length) {
    return head + '<div class="sheet-body"><div class="empty">这张图没有可统计的属性</div></div>';
  }
  return head + '<div class="sheet-body"><div class="chart-wrap"><canvas id="chartCv"></canvas></div></div>';
}

/* ============================== toast / 对话框 ============================== */

async function copyText(text){
  try { await navigator.clipboard.writeText(text); toast('已复制'); return; } catch(e){}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    document.execCommand('copy'); ta.remove(); toast('已复制');
  } catch(e){ toast('复制失败，请长按手动选择'); }
}

/* ============================== 面板视图 ============================== */

function switchRow(key, label, val, scope){
  const attr = 'data-' + (scope ? scope + '-' : '') + 'toggle';
  return '<label class="row-switch"><span>' + label + '</span>' +
    '<input type="checkbox" ' + attr + '="' + key + '"' + (val ? ' checked' : '') + '><i></i></label>';
}
/* ---- 「记录」页：属性维度图 + 抽奖记录 ----
   ⚠️ 这个函数曾经被误删过（它在被删掉的死 action 代码块里），
      结果 tabHistory() 未定义 → viewManager() 抛错 → 「设置 / 记录」两个标签整页打不开。
      现在有 t11_views.js 盯着：每个视图都要能渲染出来。 */

function tabHistory(){
  const charts = state.charts.slice().reverse();
  return '<div class="sec-title">属性维度图</div>' +
    '<div class="tools"><button class="mini" data-act="newChartItem">' + icon('plus') + ' 新建属性维度图</button></div>' +
    (charts.length
      ? '<div class="list">' + charts.map(c =>
          '<div class="row" data-id="' + c.id + '">' +
            '<div class="wheel-top">' +
              '<button class="wheel-open" data-act="openChartItem" data-id="' + c.id + '">' +
                '<span class="wdot" style="background:' + chartInk() + '"></span>' +
                '<span class="wname">' + esc(c.name) + '</span>' +
              '</button>' +
              '<span class="wmeta">' + chartPositionText(c) + ' · ' + fmtTime(c.at) + '</span>' +
            '</div>' +
            '<div class="row-acts">' +
              '<button class="mini" data-act="openChartItem" data-id="' + c.id + '">查看</button>' +
              '<button class="mini danger" data-act="delChart" data-id="' + c.id + '">' + icon('trash') + '</button>' +
            '</div>' +
          '</div>').join('') + '</div>'
      : '<div class="empty">还没有维度图<br>点上面「新建属性维度图」—— <b>随时都能建</b>，没抽到的属性按 0 算</div>') +
    '<div class="hint"><b>属性维度图</b>按位置插在「转盘」页的列表里（用 ↑↓ 调位置）。' +
      '位置写「某个转盘之后」时只统计它之前抽过的属性盘；写「所有转盘之后」就统计本轮抽过的全部。</div>' +
    '<div class="sec-title">抽奖记录</div>' +
    (state.history.length
      ? '<div class="tools">' +
          '<button class="mini" data-act="copyHistory">' + icon('copy') + ' 复制全部</button>' +
          '<button class="mini danger" data-act="clearHistory">' + icon('trash') + ' 清空记录</button></div>' +
        '<div class="list">' + state.history.map(h =>
          '<div class="row his-row"><div class="row-main"><div class="his-label">' + esc(h.label) + '</div>' +
          '<div class="sub">' + esc(h.wheel || '') + ' · ' + fmtTime(h.at) + '</div></div></div>').join('') + '</div>'
      : '<div class="empty">还没有抽奖记录</div>');
}

function flowModeText(){
  const f = state.flow;
  if (!f.enabled) return { t:'分支流程已关闭 —— 不记录路径，抽完也不会跳转', off:true };
  if (f.paused) return { t:'自动跳转已临时暂停（检测到循环）—— 点「继续连转」恢复', off:false };
  if (!f.autoJump) return { t:'当前：手动模式 —— 抽完只提示下一站，点顶部「→ 下一站」再走', off:false };
  if (f.autoSpin) return { t:'当前：一路自动连转 —— 跳过去之后会立刻自动旋转', off:false };
  return { t:'当前：只跳不转 —— 跳过去后停下，等你点「点击旋转」', off:false };
}

function storageStatusText(){
  if (!storageStatus.ok) {
    return '<b>仅本次会话</b>：浏览器存储写入失败（' + esc(storageStatus.error || '未知原因') +
      '）。请立即使用“导出备份”。';
  }
  return '浏览器存储：<b>已保存</b>' + (storageStatus.at ? '（' + fmtTime(storageStatus.at) + '）' : '') + '。';
}

function viewFlowAudit(){
  const issues = flowDiagnostics();
  return '<div class="sheet-head"><button class="icon-btn" data-act="back" aria-label="返回">' + icon('back') + '</button>' +
    '<h3 class="sheet-title">流程体检</h3><button class="icon-btn" data-act="close" aria-label="关闭">' + icon('close') + '</button></div>' +
    '<div class="sheet-body"><div class="audit-summary ' + (issues.length ? 'warn' : 'ok') + '">' +
      (issues.length ? ('发现 ' + issues.length + ' 项需要留意') : '连接完整，没有发现明显问题') + '</div>' +
    (issues.length ? '<div class="list">' + issues.map(issue => '<div class="row audit-row ' + issue.level + '">' + esc(issue.text) + '</div>').join('') + '</div>' :
      '<div class="empty">起点、默认顺序、分支入口和可抽选项均正常。</div>') +
    '<div class="hint">体检只分析当前数据，不会修改任何转盘。刻意设计的循环仍可保留，运行时会自动暂停保护。</div></div>';
}

function tabSettings(){
  const s = state.settings, f = state.flow;
  const mode = flowModeText();
  const rootW = (f.rootId && wheelById(f.rootId)) ? wheelById(f.rootId) : null;
  return '<div class="sec-title">流程</div>' +
    '<label class="row-switch"><span>使用分支流程</span>' +
      '<input type="checkbox" data-flow-toggle="enabled"' + (f.enabled ? ' checked' : '') + '><i></i></label>' +
    switchRow('autoJump', '抽中后自动跳转下一站', f.autoJump, 'flow') +
    switchRow('autoSpin', '跳转后自动旋转下一个转盘', f.autoSpin, 'flow') +
    switchRow('chartMid', '中途走到维度图时弹出来看一眼', state.settings.chartMid !== false) +
    '<label class="row-switch"><span>维度图停留 <em id="dwellVal">' + chartDwellSec(state.settings.chartDwell).toFixed(1) + ' 秒</em></span>' +
      '<input type="range" min="' + CHART_DWELL_MIN + '" max="15" step="0.2" value="' + chartDwellSec(state.settings.chartDwell) + '" data-field="flowDwell"></label>' +
    switchRow('chartOnEnd', '流程结束时展示属性维度图', state.settings.chartOnEnd !== false) +
    '<label class="row-switch"><span>跳转前停留 <em id="delayVal">' + f.delay + ' 秒</em></span>' +
      '<input type="range" min="0.4" max="5" step="0.2" value="' + f.delay + '" data-field="flowDelay"></label>' +
    '<div class="hint">维度图<b>放在哪个转盘之后</b>，就在流程走到那一步时自动弹出来，停留上面设定的秒数后自动收起、' +
      '接着跳到下一站（想让它停下等你，把那把滑杆拖到最短也行，或者关掉「中途弹出来看一眼」）。' +
      '位置在「转盘」页里用 ↑↓ 调整。</div>' +
    '<div class="mode-line' + (mode.off ? ' off' : '') + '">' + mode.t + '</div>' +
    (f.paused ? '<div class="tools"><button class="mini" data-act="resumeFlow">继续连转</button></div>' : '') +
    '<div class="tools">' +
      '<button class="mini" data-act="pickRoot">' + icon('branch') + ' 起点：' + esc(rootW ? rootW.name : '第一个转盘') + '</button>' +
      '<button class="mini" data-act="flowAudit">体检流程</button>' +
      '<button class="mini danger" data-act="clearLinks">清除所有连接</button>' +
    '</div>' +
    '<div class="hint">优先级：<b>选项自己的跳转目标</b> 高于 <b>转盘的默认下一站</b>；都没设就跟着「转盘」页的列表顺序走（分支转盘跳过），排到最后一个就收尾。' +
      '这两处目标都在各个转盘的「选项内容」页里设置。</div>' +
    '<div class="sec-title">调色板</div><div class="seg">' +
    Object.keys(PALETTES).map(k =>
      '<button class="seg-btn' + (s.palette === k ? ' on' : '') + '" data-act="setPalette" data-val="' + k + '">' + PALETTES[k].name + '</button>').join('') +
    '</div>' +
    '<div class="sec-title">外观</div><div class="seg">' +
    '<button class="seg-btn' + (s.theme !== 'dark' ? ' on' : '') + '" data-act="setTheme" data-val="light">浅色</button>' +
    '<button class="seg-btn' + (s.theme === 'dark' ? ' on' : '') + '" data-act="setTheme" data-val="dark">深色</button>' +
    '</div>' +
    '<div class="sec-title">维度图颜色</div>' +
    '<div class="tools">' + CHART_INKS.map(x =>
      '<button class="mini' + (chartInkKey() === x[0] ? ' on' : '') + '" data-act="setChartColor" data-val="' + x[0] + '">' +
      '<span class="cdot" style="background:' + x[2] + '"></span>' + x[1] + '</button>').join('') + '</div>' +
    '<div class="hint">决定属性维度图的<b>描边、填充和等级文字</b>颜色（雷达图会立刻按新颜色重画）。</div>' +
    '<div class="sec-title">法轮颜色</div>' +
    '<div class="tools">' + WHEEL_INKS.map(x =>
      '<button class="mini' + (wheelInkKey() === x[0] ? ' on' : '') + '" data-act="setWheelColor" data-val="' + x[0] + '">' +
      '<span class="cdot" style="background:' + x[2] + '"></span>' + x[1] + '</button>').join('') + '</div>' +
    '<label class="row-switch"><span>法轮透明度 <em id="wAlphaVal">' + Math.round((num(s.wheelAlpha) || 0.40) * 100) + '%</em></span>' +
      '<input type="range" min="0.05" max="1" step="0.05" value="' + (num(s.wheelAlpha) || 0.40) + '" data-field="wheelAlpha"></label>' +
    '<div class="hint">法轮是维度图的背景：八根辐条对应八个方向、外环压在 <b>SSS</b> 值上、' +
      '外圈八颗小球的圆心正好在 <b>EX</b> 值上。每次打开维度图会<b>逆时针咔哒转 45°</b>（带齿轮音）。' +
      '此项与维度图颜色分开设置。</div>' +
    '<div class="hint" style="opacity:.6;font-size:11px">构建 v09-11-03:54 法轮0.18·抖动1.2（如果这里不是最新的，按 Ctrl+F5 强制刷新）</div>' +
    '<div class="sec-title">旋转的物理效果</div>' +
    '<div class="tools">' + SPIN_FX.map(x =>
      '<button class="mini' + (spinFxKey() === x[0] ? ' on' : '') + '" data-act="setSpinFx" data-val="' + x[0] + '" title="' + x[2] + '">' +
      x[1] + '</button>').join('') + '</div>' +
    '<div class="hint">' + esc((SPIN_FX.filter(x => x[0] === spinFxKey())[0] || SPIN_FX[0])[2]) +
      (prefersReducedMotion() ? '（系统开了「减少动态效果」，已自动关掉）' : '') + '</div>' +
    '<div class="sec-title">旋转与反馈</div>' +
    '<label class="row-switch"><span>旋转时长 <em id="durVal">' + s.duration + ' 秒</em></span>' +
    '<input type="range" min="1.5" max="8" step="0.2" value="' + s.duration + '" data-field="duration"></label>' +
    switchRow('sound', '音效（滴答 / 中奖音）', s.sound) +
    switchRow('vibrate', '震动反馈（手机）', s.vibrate) +
    switchRow('rolling', '旋转时标题跟随指针显示扇区名', s.rolling) +
    switchRow('autoFlip', '文字自动翻转（始终保持正立）', s.autoFlip) +
    '<div class="sec-title">可复现随机</div>' +
    '<div class="hint">当前：<b>' + (randomSeed() ? ('种子「' + esc(randomSeed()) + '」· 已取 ' + randomDraws() + ' 次随机数') : '真随机') +
      '</b>。同版本、同转盘数据和同一种子会得到同一轮结果。</div>' +
    '<div class="tools">' +
      '<button class="mini" data-act="setSeed">' + (randomSeed() ? '更换种子' : '设置种子') + '</button>' +
      (randomSeed() ? '<button class="mini" data-act="copyReplay">复制复盘码</button><button class="mini" data-act="clearSeed">恢复真随机</button>' : '') +
      '<button class="mini" data-act="loadReplay">载入复盘码</button>' +
    '</div>' +
    '<div class="sec-title">世界线存档</div>' +
    '<label class="row-switch"><span>当前世界线</span><select id="profilePicker" aria-label="切换世界线">' +
      profileIndex.items.map(item => '<option value="' + item.id + '"' + (item.id === profileIndex.current ? ' selected' : '') + '>' + esc(item.name) + '</option>').join('') +
    '</select></label>' +
    '<div class="tools"><button class="mini" data-act="addProfile">新建世界线</button>' +
      '<button class="mini" data-act="renameProfile">重命名</button>' +
      (profileIndex.items.length > 1 ? '<button class="mini danger" data-act="deleteProfile">删除当前</button>' : '') + '</div>' +
    '<div class="hint">每条世界线独立保存转盘、历史、成长与维度图；切换前会自动保存当前进度。</div>' +
    '<div class="sec-title">记录</div>' +
    '<label class="row-switch"><span>历史记录保留条数</span><select data-setting="historyLimit">' +
    [20, 50, 100, 200].map(n => '<option value="' + n + '"' + (num(s.historyLimit) === n ? ' selected' : '') + '>' + n + ' 条</option>').join('') +
    '</select></label>' +
    '<div class="sec-title">转盘数据文件</div>' +
    switchRow('autoSave', '改动后自动写回「' + WHEEL_DIR + '」文件夹', s.autoSave !== false) +
    '<div class="hint">' + fileStatusText() + '</div>' +
    '<div class="tools">' +
      '<button class="mini" data-act="saveFolder">' + icon('download') + ' 保存回文件夹</button>' +
      '<button class="mini" data-act="reloadFiles">' + icon('upload') + ' 从文件重新读取</button>' +
    '</div>' +
    '<div class="hint">网页上的增删改会<b>立刻存在浏览器里</b>（刷新、关掉都不会丢，也不会被文件覆盖）。' +
      '要让「' + WHEEL_DIR + '」里的数据文件也跟着变：点一次「保存回文件夹」授权目录，之后开着上面开关就自动同步；' +
      '想反过来用文件覆盖网页，点「从文件重新读取」。</div>' +
    '<div class="sec-title">数据</div><div class="tools">' +
    (undoStack.length ? '<button class="mini" data-act="undoLast">撤销：' + esc(undoStack[undoStack.length - 1].label) + '</button>' : '') +
    '<button class="mini" data-act="exportData">' + icon('download') + ' 导出备份</button>' +
    '<button class="mini" data-act="importData">' + icon('upload') + ' 导入备份</button>' +
    '<button class="mini" data-act="exportAllPack">导出玩法包</button>' +
    '<button class="mini" data-act="importPack">导入玩法包</button>' +
    (importRecoveryRaw ? '<button class="mini" data-act="restoreImport">撤销上次导入</button>' : '') +
    '<button class="mini" data-act="copyData">' + icon('copy') + ' 复制数据</button>' +
    '<button class="mini danger" data-act="resetAll">' + icon('refresh') + ' 恢复默认</button>' +
    '</div>' +
    '<div class="hint">' + storageStatusText() + ' 所有内容只保存在本机浏览器，不会上传到任何服务器。换设备时用「导出备份」把数据带走。</div>' +
    '<div class="hint">咒术转盘 · 纸张版 v3.0 · 共 ' + state.wheels.length + ' 个转盘 / ' +
    state.wheels.reduce((a, w) => a + w.options.length, 0) + ' 个选项</div>';
}

function viewManager(){
  // 「选项内容」不再占标签位：它是某个转盘的详情子页，从「转盘」页点名字进来
  if (ui.mtab === 'content') {
    const w = currentWheel();
    return '<div class="sheet-head">' +
        '<button class="icon-btn" data-act="back" aria-label="返回上一层">' + icon('back') + '</button>' +
        '<h3 class="sheet-title">' + esc(w ? w.name : '') + ' · 选项内容</h3>' +
        '<button class="icon-btn" data-act="close" aria-label="关闭面板">' + icon('close') + '</button></div>' +
      '<div class="sheet-body">' + tabContent() + '</div>';
  }
  const tabs = [['wheels','转盘'], ['settings','设置'], ['history','记录']];
  const body = ui.mtab === 'settings'? tabSettings()
             : ui.mtab === 'history' ? tabHistory()
             : tabWheels();
  return '<div class="sheet-head"><div class="tabs" role="tablist">' +
    tabs.map(t => '<button class="tab' + (ui.mtab === t[0] ? ' on' : '') + '" role="tab" aria-selected="' +
      (ui.mtab === t[0]) + '" data-mtab="' + t[0] + '">' + t[1] + '</button>').join('') +
    '</div><button class="icon-btn" data-act="close" aria-label="关闭面板">' + icon('close') + '</button></div>' +
    '<div class="sheet-body">' + body + '</div>';
}

function viewResult(){
  const w = currentWheel();
  const label = ui.resultLabel || '？';
  const opt = ui.resultOptId ? findOptionById(w, ui.resultOptId) : null;
  const pend = state.flow.pendingId ? wheelById(state.flow.pendingId) : null;
  const canRemove = !!opt && wheelOptions(w).filter(o => num(o.weight) > 0).length > 1;
  return '<div class="sheet-head">' +
      '<span class="icon-btn" aria-hidden="true"></span>' +
      '<h3 class="sheet-title">本次结果</h3>' +
      '<button class="icon-btn" data-act="close" aria-label="关闭">' + icon('close') + '</button></div>' +
    '<div class="sheet-body">' +
      '<div class="result-hero">' + esc(label) + '</div>' +
      '<div class="hint" style="text-align:center;margin-top:0">来自「' + esc(w.name) + '」' +
        (pend ? ' · 下一站<b>' + esc(pend.name) + '</b>' : '') + '</div>' +
      '<div class="action-list">' +
        '<button class="action-row" data-act="copyResult"><span class="ai">' + icon('copy') + '</span>复制结果</button>' +
        (pend ? '<button class="action-row" data-act="goPending"><span class="ai">' + icon('branch') + '</span>去下一站<em>' + esc(pend.name) + '</em></button>' : '') +
        '<button class="action-row" data-act="spinAgain"><span class="ai">' + icon('refresh') + '</span>再抽一次</button>' +
        (canRemove ? '<button class="action-row danger" data-act="removeWinner"><span class="ai">' + icon('trash') + '</span>从转盘移除该选项</button>' : '') +
      '</div></div>';
}

function viewComplete(){
  const path = (state.flow.path || []).slice();
  const dims = chartDims();
  const final = path.length ? path[path.length - 1].label : (ui.resultLabel || resultEl.textContent || '完成');
  return '<div class="sheet-head"><span class="icon-btn" aria-hidden="true"></span>' +
      '<h3 class="sheet-title">本轮命运完成</h3>' +
      '<button class="icon-btn" data-act="close" aria-label="关闭">' + icon('close') + '</button></div>' +
    '<div class="sheet-body"><div class="complete-seal">咒</div>' +
      '<div class="result-hero">' + esc(final) + '</div>' +
      '<div class="complete-stats"><span><b>' + path.length + '</b> 个命运节点</span><span><b>' + dims.length + '</b> 项属性</span></div>' +
      (path.length ? '<ol class="complete-path">' + path.map(item => '<li><span>' + esc(item.wheel || '') + '</span><b>' + esc(item.label) + '</b></li>').join('') + '</ol>' :
        '<div class="empty">这一轮还没有流程记录</div>') +
      '<div class="action-list">' +
        '<button class="action-row" data-act="exportResultCard"><span class="ai">▣</span>保存结果卡片<em>PNG</em></button>' +
        '<button class="action-row" data-act="copyRound"><span class="ai">' + icon('copy') + '</span>复制本轮结果</button>' +
        '<button class="action-row" data-act="restartRound"><span class="ai">' + icon('refresh') + '</span>重新开始一轮</button>' +
      '</div></div>';
}

function chartRowHtml(c){
  return '<div class="row chart-item" data-id="' + c.id + '">' +
      '<div class="wheel-top">' +
        '<button class="wheel-open" data-act="openChartItem" data-id="' + c.id + '" title="查看这张维度图">' +
          '<span class="wdot" style="background:' + chartInk() + '"></span>' +
          '<span class="wname">' + esc(c.name) + '</span>' +
        '</button>' +
        '<span class="badge branch">维度图</span>' +
        '<span class="wmeta">' + esc(chartPositionText(c)) + '</span>' +
      '</div>' +
      '<div class="row-acts">' +
        '<button class="mini" data-act="chartUp" data-id="' + c.id + '" title="往前挪一位"' + (chartSlotIndex(c) === 0 ? ' disabled' : '') + '>' + icon('up') + '</button>' +
        '<button class="mini" data-act="chartDown" data-id="' + c.id + '" title="往后挪一位"' + (chartSlotIndex(c) === chartSlots().length - 1 ? ' disabled' : '') + '>' + icon('down') + '</button>' +
        '<button class="mini" data-act="openChartItem" data-id="' + c.id + '">查看</button>' +
        '<button class="mini danger" data-act="delChart" data-id="' + c.id + '">' + icon('trash') + '</button>' +
      '</div>' +
    '</div>';
}
/* 默认下一站写着「结束」、但后面其实还有转盘的 → 多半是无意留的，提示一下 */

/* 默认下一站写着「结束」、但后面其实还有转盘的 → 多半是无意留的，提示一下 */
function staleEndWheels(){
  const normal = state.wheels.filter(w => !w.branch);
  const lastId = normal.length ? normal[normal.length - 1].id : '';
  return state.wheels.filter(w => w.next === END && w.id !== lastId);
}

function tabWheels(){
  const cur = currentWheel();  const nBranch = state.wheels.filter(w => w.branch).length;
  /* 维度图按「排在哪个转盘之后」插进列表里；没指定 / anchor 已删的排在最后 */
  const byAnchor = {};
  state.charts.forEach(c => {
    const a = (c.after == null) ? '' : c.after;
    const key = (a === '__top__') ? '__top__' : ((a && wheelById(a)) ? a : '');
    (byAnchor[key] = byAnchor[key] || []).push(c);
  });
  const rows = [];
  (byAnchor['__top__'] || []).forEach(c => rows.push(chartRowHtml(c)));   // 列表最前
  state.wheels.forEach((w, i) => {
    if (!wheelMatchesFilter(w, ui.wheelQuery, ui.wheelFilter)) return;
    const on = cur && w.id === cur.id;
    /* 列表里那个小圆点的取色：按**当前展示的**第一项（多面转盘跟着当前面走） */
    const shown = wheelOptions(w);
    const dot = shown.length ? colorOf(w, shown[0], 0) : 'var(--line)';
    rows.push('<div class="row wheel-row' + (on ? ' cur' : '') + (w.branch ? ' is-branch' : '') + '" ' +
        'data-act="editWheel" data-id="' + w.id + '" title="进入「' + esc(w.name) + '」的选项内容（按住可拖动排序）">' +
      '<div class="wheel-top">' +
        '<button class="wheel-open" data-act="editWheel" data-id="' + w.id + '" ' +
          'aria-label="管理「' + esc(w.name) + '」的选项内容">' +
          '<span class="wdot" style="background:' + dot + '"></span>' +
          '<span class="wname">' + esc(w.name) + '</span>' +
        '</button>' +
        '<button class="bchip' + (w.branch ? ' on' : '') + '" data-act="toggleBranch" ' +
          'aria-pressed="' + (w.branch ? 'true' : 'false') + '" ' +
          'title="' + (w.branch ? '分支转盘：不在默认顺序里，抽完回到来路' : '标记为分支转盘（不进默认顺序）') + '">分支</button>' +
        '<button class="bchip' + (isMultiWheel(w) ? ' on' : '') + '" data-act="toggleMulti" data-id="' + w.id + '" ' +
          'aria-pressed="' + (isMultiWheel(w) ? 'true' : 'false') + '" ' +
          'title="' + (isMultiWheel(w)
            ? ('多面转盘：按「' + esc((faceSource(w) || {}).name || '没设置') + '」的结果切换内容（照常参与默认顺序）')
            : '标记为多面转盘：内容按之前抽到的结果切换（照常参与默认顺序）') + '">多面</button>' +
        (isGradeWheel(w) ? '<span class="badge">属性</span>' : '') +
        '<span class="badge wheel-cat">' + esc(w.category || inferWheelCategory(w.name)) + '</span>' +
        '<span class="wmeta">' + (isMultiWheel(w) ? (faceCount(w) + ' 面 · ') : '') +
          wheelOptions(w).length + ' 项' + (w.removeAfterPick ? ' · 抽中即移除' : '') + '</span>' +
      '</div>' +
      '<div class="row-acts">' +
        '<button class="mini' + (on ? ' on' : '') + '" data-act="use">' + (on ? '使用中' : '切换') + '</button>' +
        '<button class="mini" data-act="rename" title="改名">' + icon('edit') + '</button>' +
        '<button class="mini" data-act="up" title="上移"' + (i === 0 ? ' disabled' : '') + '>' + icon('up') + '</button>' +
        '<button class="mini" data-act="down" title="下移"' + (i === state.wheels.length - 1 ? ' disabled' : '') + '>' + icon('down') + '</button>' +
        '<button class="mini" data-act="dup" title="复制这个转盘">' + icon('copy') + '</button>' +
        '<button class="mini danger" data-act="del" title="删除这个转盘">' + icon('trash') + '</button>' +
      '</div>' +
    '</div>');
    (byAnchor[w.id] || []).forEach(c => rows.push(chartRowHtml(c)));
  });
  (byAnchor[''] || []).forEach(c => rows.push(chartRowHtml(c)));   // 统计全部 / anchor 已删 → 排在最后
  return '<div class="wheel-find"><input id="wheelSearch" type="search" value="' + esc(ui.wheelQuery || '') + '" placeholder="搜索转盘或选项" aria-label="搜索转盘或选项"></div>' +
    '<div class="seg wheel-filters">' + [['all','全部'],['角色','角色'],['属性','属性'],['能力','能力'],['事件','事件'],['结局','结局'],['branch','分支'],['multi','多面']].map(x =>
      '<button class="seg-btn' + (ui.wheelFilter === x[0] ? ' on' : '') + '" data-act="wheelFilter" data-val="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>' +
    '<div class="hint">点转盘框<b>任意位置</b> → 进它的<b>选项内容</b>管理；<b>按住拖动</b>可以调整顺序；点「切换」把它设为首页正在用的转盘。</div>' +
    (staleEndWheels().length ? '<div class="hint warn">「' + staleEndWheels().map(w => esc(w.name)).join('」「') +
      '」的默认下一站是<b>流程结束</b>，但后面还有转盘 —— 想让流程继续往下走，' +
      '进它的「选项内容」页把默认下一站点「清除设置」，就会跟着列表顺序走。</div>' : '') +
    '<div class="filestat' + (dirUsable ? ' on' : '') + '">' +
      '<span>' + fileStatusShort() + '</span>' +
      '<button class="mini" data-act="saveFolder">' + (dirUsable ? '立即写回' : '授权并写回') + '</button>' +
    '</div>' +
    '<div class="list">' + (rows.length ? rows.join('') : '<div class="empty">没有符合条件的转盘</div>') + '</div>' +
    '<button class="btn block" data-act="newPick">' + icon('plus') + ' 新建（转盘 / 属性维度图）</button>' +
    '<div class="hint"><b>属性维度图</b>排在哪个转盘后面，就统计<b>它之前</b>抽过的属性转盘（没抽到的按 0 算）。' +
      '数据是<b>打开时按当前进度实时统计</b>的 —— 所以先放好位置，等流程跑到那里（或轮次结束）会自动展示该有的数据。' +
      '在「记录」页新建与管理。</div>' +
    '<div class="hint"><b>分支转盘</b>（点行里的「分支」标记）不参与默认顺序，只能被别的转盘的<b>选项跳转目标</b>指到；' +
      '它抽完若没给该选项设目标，会自动接着「拐进来的那个转盘」的默认下一站继续。当前有 <b>' + nBranch + '</b> 个分支转盘。</div>' +
    '<div class="hint">列表顺序 = 默认顺序 = 「按列表顺序串联」的顺序；拖动或 ↑↓ 都能调整。' +
      '顺序会<b>写进数据文件</b>：文件名前的 <b>01/02…</b>、每个文件里的 <b>"order" 字段</b>，以及 <b>_index.js</b> 清单里的排列。</div>' +
    '<div class="hint">每个转盘的<b>默认下一站</b>和每个选项的<b>跳转目标</b>，都在它的「选项内容」页里设置；' +
      '流程的整体开关在「设置」页。</div>';
}
/* 取多面转盘的「分面依据」转盘对象。
   ⚠️ faceBy 可能是 id（界面里选出来的）也可能是名字（手写数据文件里的），
      js/multi.js 的 byRef() 两种都认 —— 这里统一走它，别各处分别写 wheelById。 */

function faceSource(w){ return w ? byRef(faceSourceName(w)) : null; }

/* ============================== 多面转盘的面管理 ==============================
   一个「面」= 一组条件 + 一套选项。抽到这个多面转盘时，按顺序找第一个命中的面来展示。
   ⚠️ 和分支转盘的区别写在 js/multi.js 顶部 —— 别把两件事混在一起。
   ========================================================================== */

function faceWhenText(f){
  return whenLabel((f && f.when) || { type:'else' });
}

function viewFaces(){
  const w = wheelById(ui.faceWheelId) || currentWheel();
  if (!isMultiWheel(w)) {
    return '<div class="sheet-head">' +
        '<button class="icon-btn" data-act="backFlow">' + icon('back') + '</button>' +
        '<h3 class="sheet-title">多面转盘</h3>' +
        '<button class="icon-btn" data-act="close">' + icon('close') + '</button></div>' +
      '<div class="sheet-body"><div class="empty">「' + esc(w.name) + '」还不是多面转盘<br>' +
        '在「转盘」页点它那行的「多面」标记就能打开</div></div>';
  }
  const src = faceSource(w);
  const live = faceOf(w);
  const faces = w.faces || [];
  const others = state.wheels.filter(x => x.id !== w.id);

  const rows = faces.map((f, i) => {
    const on = live.index === i;
    return '<div class="row' + (on ? ' cur' : '') + '" data-id="face' + i + '">' +
        '<div class="wheel-top">' +
          '<span class="wname">第 ' + (i + 1) + ' 面</span>' +
          (on ? '<span class="badge">当前命中</span>' : '') +
          '<span class="wmeta">' + esc(faceWhenText(f)) + ' · ' + (f.options || []).length + ' 项</span>' +
        '</div>' +
        '<div class="row-acts">' +
          '<button class="mini" data-act="pickFaceWhen" data-id="' + w.id + '" data-idx="' + i + '" title="改这个面的条件">改条件</button>' +
          '<button class="mini" data-act="editFace" data-id="' + w.id + '" data-idx="' + i + '" title="编辑这个面的选项">内容</button>' +
          '<button class="mini" data-act="faceUp" data-id="' + w.id + '" data-idx="' + i + '" title="往前挪（靠前的优先命中）"' + (i === 0 ? ' disabled' : '') + '>' + icon('up') + '</button>' +
          '<button class="mini" data-act="faceDown" data-id="' + w.id + '" data-idx="' + i + '" title="往后挪"' + (i === faces.length - 1 ? ' disabled' : '') + '>' + icon('down') + '</button>' +
          '<button class="mini danger" data-act="delFace" data-id="' + w.id + '" data-idx="' + i + '">' + icon('trash') + '</button>' +
        '</div>' +
      '</div>';
  }).join('');

  return '<div class="sheet-head">' +
      '<button class="icon-btn" data-act="backFlow">' + icon('back') + '</button>' +
      '<h3 class="sheet-title">「' + esc(w.name) + '」的面</h3>' +
      '<button class="icon-btn" data-act="close">' + icon('close') + '</button></div>' +
    '<div class="sheet-body">' +
    '<div class="hint">多面转盘<b>照常参与默认顺序</b>，位置随便换；只是它的内容会跟着别的转盘的结果变。' +
      '抽到它的时候，<b>从上往下</b>找第一个命中的面，用那个面的选项。</div>' +
    '<div class="sec-title">按哪个转盘分面</div>' +
    '<div class="tools">' +
      state.wheels.filter(x => x.id !== w.id).map(x =>
        '<button class="mini' + (w.faceBy === x.id ? ' on' : '') + '" data-act="setFaceBy" data-id="' + w.id + '" data-val="' + x.id + '">' +
        esc(x.name) + (isGradeWheel(x) ? '（属性）' : '') + '</button>').join('') +
      (others.length ? '' : '<span class="hint">还没有别的转盘可以按</span>') +
    '</div>' +
    '<div class="hint">' + (src
      ? ('当前按「<b>' + esc(src.name) + '</b>」的结果分面，它本轮最近一次是 <b>' +
         esc(lastResultOf(src) || '（还没抽过）') + '</b>')
      : '<b>还没选定依据</b> —— 点上面任一转盘。没选定时永远用兜底面。') + '</div>' +
    '<div class="sec-title">面（从上往下，第一个命中的生效）</div>' +
    (faces.length ? '<div class="list">' + rows + '</div>'
                  : '<div class="empty">还没有面<br>点下面的「加一个面」，条件写「等级 ≥ A」这种</div>') +
    '<div class="tools">' +
      '<button class="mini" data-act="addFace" data-id="' + w.id + '">' + icon('plus') + ' 加一个面</button>' +
    '</div>' +
    '<div class="sec-title">兜底面</div>' +
    '<div class="row"><div class="wheel-top">' +
      '<span class="wname">' + (live.face ? '没命中任何面时用' : '← 现在用的就是它') + '</span>' +
      '<span class="wmeta">' + (w.options || []).length + ' 项</span>' +
    '</div><div class="row-acts">' +
      '<button class="mini" data-act="editFace" data-id="' + w.id + '" data-idx="-1" title="编辑兜底面的选项">内容</button>' +
    '</div></div>' +
    '<div class="hint">兜底面就是「普通转盘的选项内容」—— 面都没命中时用它，' +
      '也方便你先把内容填好再慢慢加条件。</div>' +
    '</div>';
}

function editFaceOptions(w){
  const idx = editFaceIndex(w);
  return idx < 0 ? (w.options || []) : (faceOptions(w, idx) || []);
}
/* 多面转盘在「选项内容」页顶部的那一条：看清在编辑哪一面 + 切面入口 */

/* 多面转盘在「选项内容」页顶部的那一条：看清在编辑哪一面 + 切面入口 */
function faceEditBar(w){
  if (!isMultiWheel(w)) return '';
  const live = faceOf(w);
  const cur = editFaceIndex(w);
  const src = faceSource(w);
  const label = cur < 0 ? '兜底面' : ('第 ' + (cur + 1) + ' 面（' + faceWhenText((w.faces || [])[cur]) + '）');
  return '<div class="hint" style="border-color:rgba(178,58,47,.35)">' +
      '<b>多面转盘</b>：按「' + esc(src ? src.name : '（没设置）') + '」的结果切换内容' +
      (src ? '，它现在是 <b>' + esc(lastResultOf(src) || '还没抽过') + '</b>' : '') + '。<br>' +
      '正在编辑：<b>' + esc(label) + '</b>' +
      (live.face ? '' : '（← 当前没面命中，用的就是这一套）') +
    '</div>' +
    '<div class="tools">' +
      '<button class="mini' + (cur === live.index ? ' on' : '') + '" data-act="pickEditFace" data-val="auto">' +
        '自动（当前命中）</button>' +
      (w.faces || []).map((f, i) =>
        '<button class="mini' + (cur === i ? ' on' : '') + '" data-act="pickEditFace" data-val="' + i + '">' +
        '第' + (i + 1) + '面</button>').join('') +
      '<button class="mini' + (cur === -1 ? ' on' : '') + '" data-act="pickEditFace" data-val="-1">兜底面</button>' +
      '<button class="mini" data-act="openFaces" data-id="' + w.id + '">管理面 / 条件…</button>' +
    '</div>';
}
/* 改一个面的条件：先选条件类型，再选值（等级档位从那个属性盘的选项里取） */

/* 改一个面的条件：先选条件类型，再选值（等级档位从那个属性盘的选项里取） */
function viewFaceWhen(){
  const w = wheelById(ui.faceWheelId);
  const idx = num(ui.faceWhenIdx);
  const f = w && w.faces ? w.faces[idx] : null;
  const head = '<div class="sheet-head">' +
      '<button class="icon-btn" data-act="backFlow">' + icon('back') + '</button>' +
      '<h3 class="sheet-title">第 ' + (idx + 1) + ' 面的条件</h3>' +
      '<button class="icon-btn" data-act="close">' + icon('close') + '</button></div>';
  if (!w || !f) return head + '<div class="sheet-body"><div class="empty">这个面已经没了</div></div>';
  const when = f.when || { type:'else' };
  const src = faceSource(w);

  let valueBlock = '';
  if (when.type !== 'else') {
    /* 值从「依据转盘」的选项里挑，这样不会和实际标签对不上 */
    const pool = src ? wheelOptions(src) : [];
    const isGrade = when.type !== 'labelIs' && when.type !== 'labelHas';
    valueBlock = '<div class="sec-title">值</div>';
    if (isGrade) {
      /* 等级类：给完整的阶梯（E- 到 EX），不受那个盘实际有哪些选项限制 */
      valueBlock += '<div class="tools">' + GRADE_LADDER.map(g =>
        '<button class="mini' + (when.value === g ? ' on' : '') + '" data-act="setFaceWhenValue" data-val="' + g + '">' + g + '</button>').join('') + '</div>' +
        '<div class="hint">阶梯：' + GRADE_LADDER.join(' → ') + '。' +
        '抽到的等级会先<b>叠加本轮成长</b>再比 —— 所以成长把 B 抬到 A 之后，条件「≥ A」就会命中。</div>';
    } else {
      valueBlock += '<div class="list">' + (pool.length
        ? pool.map(o => '<button class="pick-row' + (when.value === o.label ? ' on' : '') +
            '" data-act="setFaceWhenValue" data-val="' + esc(o.label) + '"><span>' + esc(o.label) + '</span></button>').join('')
        : '<div class="empty">依据的那个转盘还没有选项</div>') + '</div>' +
        '<div class="hint">也可以直接编辑下面的文字，手写要匹配的内容。</div>' +
        '<input class="opt-input" style="width:100%" data-field="faceWhenValue" value="' + esc(when.value || '') + '" placeholder="要匹配的文字">';
    }
  }
  return head + '<div class="sheet-body">' +
    '<div class="hint">依据：<b>' + esc(src ? src.name : '（没设置）') + '</b>' +
      (src ? '（本轮最近一次：' + esc(lastResultOf(src) || '还没抽过') + '）' : '') + '</div>' +
    '<div class="sec-title">条件</div>' +
    '<div class="tools">' + FACE_WHEN.map(x =>
      '<button class="mini' + (when.type === x[0] ? ' on' : '') + '" data-act="setFaceWhenType" data-val="' + x[0] + '" title="' + esc(x[2]) + '">' +
      x[1] + '</button>').join('') + '</div>' +
    '<div class="hint">' + esc((FACE_WHEN.filter(x => x[0] === when.type)[0] || FACE_WHEN[5])[2]) + '</div>' +
    valueBlock +
    '<div class="hint">这个面当前是：<b>' + esc(whenLabel(when)) + '</b></div>' +
  '</div>';
}

/* 按 id 找一个选项 —— 兜底面和各层的面都要找。
   ⚠️ 凡是"按 id 定位选项"的地方都该用它（输入、删除、改色、跳转目标…），
      只查 w.options 会让多面转盘的面里那些选项变成"点了没反应"。 */

function tabContent(){
  const w = currentWheel();
  const opts = editFaceOptions(w);            // ★ 编辑的是当前选中的那一面
  const totalWeight = opts.reduce((sum, option) => sum + Math.max(0, num(option.weight)), 0);
  const list = opts.length
    ? '<div class="list">' + opts.map((o, i) => {
        const off = num(o.weight) <= 0;
        const probability = totalWeight > 0 ? (Math.max(0, num(o.weight)) / totalWeight * 100) : 0;
        const nx = o.next ? { set:true, text:slotText(o.next) }
                          : { set:false, text:'跟随默认：' + defaultTargetLabel(w) };
        return '<div class="opt-card' + (off ? ' off' : '') + '" data-id="' + o.id + '">' +
          '<div class="opt-line opt-row">' +
            '<input type="color" data-field="color" value="' + colorOf(w, o, i) + '" title="扇区颜色">' +
            '<input class="opt-input" type="text" data-field="label" value="' + esc(o.label) + '" placeholder="选项文字" maxlength="20">' +
            '<input class="w-input" type="number" min="0" step="1" data-field="weight" value="' + num(o.weight) + '" title="权重">' +
            '<button class="mini" data-act="autoColor" title="恢复跟随主题配色">A</button>' +
            '<button class="mini danger" data-act="delOpt">' + icon('trash') + '</button>' +
          '</div>' +
          '<button class="next-btn' + (nx.set ? ' set' : '') + '" data-act="pickNext">' +
            '<span class="nx-arrow">→</span><span class="nx-t">' + esc(nx.text) + '</span></button>' +
          '<div class="prob-line"><span data-prob="' + o.id + '">' + probability.toFixed(probability < 1 ? 2 : 1) + '%</span>' +
            (off ? ' · 已停用' : ' · 权重 ' + num(o.weight)) + '</div>' +
        '</div>';
      }).join('') + '</div>'
    : '<div class="empty">还没有选项，点「添加选项」或「批量编辑」开始</div>';
  return '<div class="edit-head">' +
      '<span class="eh-label">编辑中</span>' +
      '<select id="wheelPicker" aria-label="切换要编辑的转盘">' +
        state.wheels.map(x => '<option value="' + x.id + '"' + (x.id === w.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') +
      '</select>' +
      '<button class="mini" data-act="rename" data-id="' + w.id + '" title="给这个转盘改名">' + icon('edit') + '</button>' +
    '</div>' +
    faceEditBar(w) +
    '<button class="next-btn' + (w.next ? ' set' : '') + '" data-act="pickDefTarget">' +
      '<span class="nx-arrow">→</span><span class="nx-t">默认下一站：' +
      esc(w.next ? slotText(w.next) : ('跟随列表顺序 → ' + defaultTargetLabel(w))) + '</span></button>' +
    '<div class="tools">' +
      '<button class="mini" data-act="addOpt">' + icon('plus') + ' 添加选项</button>' +
      '<button class="mini" data-act="batch">批量编辑</button>' +
      '<button class="mini" data-act="exportCurrentPack">导出此盘/支线</button>' +
      '<button class="mini" data-act="shuffle">' + icon('shuffle') + ' 打乱顺序</button>' +
      '<button class="mini" data-act="recolor">重新配色</button>' +
      '<button class="mini" data-act="simulate">模拟 1 万次</button>' +
      '<button class="mini danger" data-act="clearOpts">清空</button>' +
    '</div>' +
    '<div class="prob-summary">当前面总权重 <b>' + totalWeight + '</b> · 每项概率会随权重实时变化</div>' +
    '<label class="row-switch"><span>抽中后从转盘移除该选项</span>' +
      '<input type="checkbox" data-wheel-toggle="removeAfterPick"' + (w.removeAfterPick ? ' checked' : '') + '><i></i></label>' +
    '<label class="row-switch"><span>计入属性维度图 <em>' +
        (w.grade === true ? '强制计入' : w.grade === false ? '已排除' : (isGradeWheel(w) ? '自动识别：是' : '自动识别：否')) + '</em></span>' +
      '<input type="checkbox" data-wheel-toggle="grade"' + (w.grade === true ? ' checked' : '') + '><i></i></label>' +
    '<div class="hint">带 <b>E / D / C / B / A / S / SS / SSS / EX</b> 这类等级的转盘会自动计入。' +
      '抽完一轮后可以在结果面板或「记录」页看维度图。' +
      '<button class="mini" data-act="gradeAuto" data-id="' + w.id + '" style="margin-left:6px">恢复自动判断</button></div>' +
    '<div class="hint">权重越大，扇区越大、被抽中的概率越高（例如 <b>五条悟*3</b> 的扇区面积是普通选项的 3 倍）。权重填 <b>0</b> 表示停用该选项，它不会出现在转盘上。</div>' +
    list +
    '<div class="hint">颜色块可单独改色，点 <b>A</b> 恢复跟随主题。</div>' +
    growHintBlock(w, w.options);   // 这个盘里写着「XX+N」但**对不上任何转盘**的，在这里点出来
}

function viewSimulation(){
  const data = ui.simResults || simulateWheel(currentWheel(), 10000);
  return '<div class="sheet-head"><button class="icon-btn" data-act="back" aria-label="返回">' + icon('back') + '</button>' +
    '<h3 class="sheet-title">概率模拟 · ' + esc(currentWheel().name) + '</h3><button class="icon-btn" data-act="close" aria-label="关闭">' + icon('close') + '</button></div>' +
    '<div class="sheet-body"><div class="hint">在本机独立模拟 <b>' + data.runs.toLocaleString() + '</b> 次，不会消耗正式抽取的随机序列。</div>' +
    '<div class="sim-table"><div class="sim-head"><span>选项</span><span>理论</span><span>模拟</span></div>' +
    data.rows.map(row => '<div class="sim-row"><span>' + esc(row.label) + '</span><b>' + (row.expected * 100).toFixed(1) + '%</b><em>' + (row.observed * 100).toFixed(1) + '%</em></div>').join('') +
    '</div></div>';
}

function refreshOptionProbabilities(){
  const opts = editFaceOptions(currentWheel());
  const total = opts.reduce((sum, option) => sum + Math.max(0, num(option.weight)), 0);
  opts.forEach(option => {
    const el = $('[data-prob="' + option.id + '"]');
    if (!el) return;
    const probability = total > 0 ? Math.max(0, num(option.weight)) / total * 100 : 0;
    el.textContent = probability.toFixed(probability < 1 ? 2 : 1) + '%';
  });
  const summary = $('#sheet .prob-summary b');
  if (summary) summary.textContent = total;
}

/* 成长写法的自查提示：选项里写了「XX+N」但 XX 对不上任何转盘时提醒一下 ——
   因为那种情况是**安静地不生效**的（不会报错，只是转了也白转）。 */

function growHintBlock(w, list){
  const bad = (list || []).map(o => o.label).filter(l => growHintFor(l));
  if (!bad.length) return '';
  return '<div class="hint warn">这些选项里的成长<b>对不上转盘</b>，抽到也不会升：<br>' +
    bad.map(l => '· <b>' + esc(l) + '</b> —— ' + esc(growHintFor(l))).join('<br>') +
    '<br>写法：<b>转盘名+1</b>，或者转盘名的一部分（如「咒力+1」→ 咒力总量）。' +
    '转盘名超过 ' + GROW_WORD_MAX + ' 字时请写简称。</div>';
}

function viewBatch(){
  const w = currentWheel();
  const opts = editOpts(w);
  return '<div class="sheet-head">' +
    '<button class="icon-btn" data-act="back">' + icon('back') + '</button>' +
    '<h3 class="sheet-title">批量编辑 · ' + esc(w.name) + (editOptsName(w) ? '·' + esc(editOptsName(w)) : '') + '</h3>' +
    '<button class="icon-btn" data-act="close">' + icon('close') + '</button></div>' +
    '<div class="sheet-body">' +
    '<div class="hint">每行一个选项；用 <b>名称*权重</b>（如 <b>五条悟*3</b>）设置权重，不写权重就是 1。' +
      (editOptsName(w) ? '<br>⚠️ 这个转盘是多面的，这里编辑的是它的 <b>' + esc(editOptsName(w)) + '</b>。' : '') + '</div>' +
    '<textarea class="ta" id="batchText" spellcheck="false">' +
    esc(opts.map(o => num(o.weight) === 1 ? o.label : o.label + '*' + num(o.weight)).join('\n')) + '</textarea>' +
    '<div class="tools">' +
      '<button class="btn" data-act="batchApply" data-mode="replace">覆盖当前选项</button>' +
      '<button class="btn ghost" data-act="batchApply" data-mode="append">追加到末尾</button>' +
    '</div><div class="hint">覆盖会整体替换' + (editOptsName(w) ? '这一面' : '该转盘') + '的所有选项。</div></div>';
}
/* ============================== 导航：单一视图栈 + 返回键 ==============================
   · 所有面板都是「压栈」的一层，任何位置返回 = 退回上一层
   · 浏览器 / 安卓返回手势、Esc、左上返回键 三者走同一条 navBack()
   · 关掉整个面板时把之前压入的历史条目一次性回退，避免污染浏览历史
   ================================================================================= */

Object.assign(ZW, { fmtTime, viewTarget, viewNewPick, WHEEL_TEMPLATES, viewTemplates, createTemplateWheels, applyWheelTemplate, viewNewChart, viewChart, copyText, switchRow, tabHistory, flowModeText, storageStatusText, viewFlowAudit, tabSettings, viewManager, viewResult, viewComplete, chartRowHtml, staleEndWheels, tabWheels, faceSource, faceWhenText, viewFaces, editFaceOptions, faceEditBar, viewFaceWhen, tabContent, viewSimulation, refreshOptionProbabilities, growHintBlock, viewBatch });
})();
