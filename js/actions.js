/* 咒术转盘 · 动作分发与事件：handleAction、行拖拽、全局事件绑定
   （阶段 C 从 index.html 内联脚本拆出；仍是无构建普通 <script>，只经 ZW 命名空间互通） */
(function(){
'use strict';
const { $, $$, CHART_INKS, core, GRADE_LADDER, NAV, SPIN_FX, STATE_VER, addProfile, applyTheme, applyWheelTemplate, askDialog, beep, canvas, chartDwellSec, chartInkKey, chartPositionText, clamp, clearJump, closeSheet, copyText, createChartSnapshot, ctx, currentWheel, deleteProfile, editOpts, editOptsName, expandFlowBar, exportData, exportResultCard, exportWheelPack, faceCount, faceSource, faceWhenText, findOptionById, fitWheel, hideOverlay, importDataText, importWheelPackText, isGradeWheel, isMultiWheel, isOverlayOpen, loadState, makeOption, makeWheel, moveChart, moveWheel, navBack, navCloseAll, navDepth, navGoBack, navPush, navTo, num, optById, parseBatch, parseReplayCode, pushUndo, randomSeed, refreshOptionProbabilities, refreshTitle, reloadFromFiles, renameProfile, renderFlowBar, renderSheet, replayCode, requestDraw, resetFlow, restoreImportState, resultEl, roundResultText, save, saveSoon, saveToFolder, seed, setRandomSeed, shuffleArr, simulateWheel, slotText, spin, spinFxKey, state, storageStatus, switchProfile, switchTo, toast, topNav, ui, uid, undoLast, undoToast, vibrate, wheelById, wheelInkKey, wheelMatchesFilter, wheelOptions } = ZW;

function dropLayerIf(view){ const t = topNav(); if (t && t.view === view) NAV.stack.pop(); }

async function handleAction(act, id, el){
  const w = currentWheel();
  switch (act) {
    case 'close': closeSheet(); break;
    case 'back': navGoBack(); break;
    case 'addWheel': {
      const name = await askDialog({ title:'新建转盘', desc:'给新转盘起个名字', value:'新转盘', ok:'创建' });
      if (name === null) return;
      const nw = makeWheel((name || '').trim() || '新转盘', ['选项 1', '选项 2', '选项 3', '选项 4']);
      state.wheels.push(nw); state.currentId = nw.id;
      save(); refreshTitle(); requestDraw();
      dropLayerIf('newpick');
      navTo('manager', { mtab:'content' });        // 建完直接进它的选项内容，返回即回列表
      toast('已创建「' + nw.name + '」');
      break;
    }
    case 'newPick': navTo('newpick'); break;
    case 'openTemplates': navTo('templates'); break;
    case 'applyTemplate': {
      const added = applyWheelTemplate(el.dataset.val || '');
      if (!added) { toast('模板创建失败'); break; }
      navCloseAll();
      undoToast('已添加模板：' + added.length + ' 个转盘');
      break;
    }
    case 'pickRoot':
      ui.targetCtx = { kind:'root', wheel:'', opt:'', cur: state.flow.rootId || '' };
      navTo('target'); break;
    case 'flowAudit': navTo('flowaudit'); break;
    case 'pickDefTarget':
      ui.targetCtx = { kind:'def', wheel:w.id, opt:'', cur: w.next || '' };
      navTo('target'); break;
    case 'chartUp': case 'chartDown': {
      const c = state.charts.filter(x => x.id === id)[0];
      if (!c) break;
      moveChart(c, act === 'chartUp' ? -1 : 1);
      renderSheet('swap');
      toast('维度图位置：' + chartPositionText(c));
      break;
    }
    case 'openChartItem': {
      const c = state.charts.filter(x => x.id === id)[0];
      if (!c) break;
      ui.chartItem = c;
      navTo('chart');
      break;
    }
    case 'newChartItem':
      ui.newChartName = ui.newChartName || ('属性维度图 ' + (state.charts.length + 1));
      navTo('newchart');
      break;
    case 'setAnchor': {
      const inp = $('#newChartName');
      if (inp && inp.value) ui.newChartName = inp.value;
      ui.newChartAnchor = el.dataset.val || '';
      renderSheet('swap');
      break;
    }
    case 'doCreateChart': {
      const inp = $('#newChartName');
      const nm = inp ? inp.value : ui.newChartName;
      const r = createChartSnapshot(nm, ui.newChartAnchor || '');
      if (!r.ok) { toast(r.msg); break; }
      ui.chartItem = r.item;
      dropLayerIf('newchart');
      navTo('chart');
      toast(r.prev ? '已生成，从「' + r.prev.name + '」变形过来' : '已生成第一张维度图');
      break;
    }
    case 'delChart': {
      const c = state.charts.filter(x => x.id === id)[0];
      if (!c) break;
      const okDel = await askDialog({ title:'删除维度图', desc:'确定删除「' + c.name + '」？删掉后它的快照就没了。', ok:'删除', danger:true });
      if (!okDel) return;
      pushUndo('删除维度图');
      state.charts = state.charts.filter(x => x.id !== id);
      if (ui.chartItem && ui.chartItem.id === id) ui.chartItem = null;
      save();
      if (ui.view === 'chart') navGoBack();
      else { ui.view = 'manager'; renderSheet('swap'); }
      undoToast('已删除维度图');
      break;
    }
    case 'use':
      state.currentId = id; state.flow.retStack = []; state.flow.paused = false;
      save(); refreshTitle(); requestDraw(); renderSheet();
      toast('已切换到「' + currentWheel().name + '」'); break;
    case 'rename': {
      const x = wheelById(id);
      if (!x) break;
      const name = await askDialog({ title:'重命名转盘', desc:'数据文件里的转盘名也会用这个名字', value:x.name, ok:'保存' });
      if (name === null) return;
      const v = String(name).trim();
      if (!v) { toast('名字不能为空'); break; }
      x.name = v;
      save(); refreshTitle(); renderSheet();
      toast('已改名为「' + v + '」');
      break;
    }
    case 'dup': {
      const src = state.wheels.filter(x => x.id === id)[0];
      if (!src) break;
      /* 复制要连"多面"的整套配置一起复制（面 + 分面依据），不然副本会变成普通转盘 */
      const copyOpt = o => ({ id:uid(), label:o.label, weight:o.weight, color:o.color, next:o.next || '' });
      const nw = { id:uid(), name:src.name + ' 副本', next:src.next || '',
                   branch:!!src.branch, grade:(src.grade === true ? true : (src.grade === false ? false : null)),
                   removeAfterPick:src.removeAfterPick,
                   multi:!!src.multi, faceBy:src.faceBy || '',
                   faces:(src.faces || []).map(f => ({
                     when: Object.assign({}, f.when || { type:'else' }),
                     options:(f.options || []).map(copyOpt)
                   })),
                   options:src.options.map(copyOpt) };
      state.wheels.splice(state.wheels.indexOf(src) + 1, 0, nw);
      save(); renderSheet(); toast('已复制转盘' + (src.multi ? '（含 ' + nw.faces.length + ' 个面）' : '')); break;
    }
    case 'del': {
      if (state.wheels.length <= 1) { toast('至少要保留一个转盘'); break; }
      const wheel = state.wheels.filter(x => x.id === id)[0];
      if (!wheel) break;
      const ok = await askDialog({ title:'删除转盘', desc:'确定删除「' + wheel.name + '」及其 ' + wheel.options.length + ' 个选项？', ok:'删除', danger:true });
      if (!ok) return;
      pushUndo('删除转盘');
      state.wheels = state.wheels.filter(x => x.id !== id);
      if (state.currentId === id) state.currentId = state.wheels[0].id;
      save(); refreshTitle(); requestDraw(); renderSheet(); undoToast('已删除「' + wheel.name + '」'); break;
    }
    case 'toggleBranch': {
      const x = wheelById(id);
      if (!x) break;
      x.branch = !x.branch;
      if (x.branch) { x.next = ''; }                 // 分支转盘不参与默认链
      save(); renderSheet(); renderFlowBar();
      toast(x.branch
        ? '「' + x.name + '」已标记为分支转盘：不进默认顺序，只能被选项分支指到'
        : '「' + x.name + '」已恢复为普通转盘');
      break;
    }
    case 'up': moveWheel(id, -1); break;
    case 'down': moveWheel(id, 1); break;
    case 'addOpt':
      editOpts(w, true).push(makeOption(''));
      save(); renderSheet(); requestDraw();
      (function(){ const rows = $$('#sheet .opt-row'); const last = rows[rows.length - 1];
        if (last) { const inp = last.querySelector('.opt-input'); if (inp) inp.focus(); } })();
      break;
    case 'delOpt': {
      const arr = editOpts(w, true);
      const i = arr.map(o => o.id).indexOf(id);
      if (i >= 0) { pushUndo('删除选项'); arr.splice(i, 1); }
      save(); renderSheet(); requestDraw(); undoToast('已删除选项'); break;
    }
    case 'autoColor':
      (editOpts(w, true).filter(o => o.id === id)[0] || {}).color = null;
      save(); renderSheet(); requestDraw(); break;
    case 'shuffle': shuffleArr(editOpts(w, true)); save(); renderSheet(); requestDraw(); break;
    case 'recolor': editOpts(w, true).forEach(o => { o.color = null; }); save(); renderSheet(); requestDraw(); toast('已按主题重新配色'); break;
    case 'clearOpts': {
      const ok = await askDialog({ title:'清空选项',
        desc:'将删除「' + w.name + '」' + (editOptsName(w) ? '的' + editOptsName(w) : '') + '的全部选项', ok:'清空', danger:true });
      if (!ok) return;
      pushUndo('清空选项');
      const arr = editOpts(w, true);
      arr.length = 0;                       // 原地清空，别换数组引用（多面转盘的面里存的也是它）
      save(); renderSheet(); requestDraw(); undoToast('已清空选项'); break;
    }
    case 'batch': navTo('batch'); break;
    case 'batchApply': {
      const mode = el.dataset.mode;
      const text = ($('#batchText') || {}).value || '';
      const list = parseBatch(text);
      if (!list.length) { toast('没有解析到内容'); break; }
      const opts = list.map(o => makeOption(o.label, o.weight));
      const arr = editOpts(w, true);
      if (mode !== 'append') pushUndo('批量覆盖选项');
      if (mode === 'append') { opts.forEach(o => arr.push(o)); }
      else { arr.length = 0; opts.forEach(o => arr.push(o)); }
      save(); requestDraw();
      if (ui.view === 'batch') navGoBack();          // 回到进来时那一页（并把栈同步好）
      else { ui.view = 'manager'; ui.mtab = 'content'; renderSheet('swap'); }
      if (mode === 'append') toast('已追加 ' + opts.length + ' 个选项' + (editOptsName(w) ? '（' + editOptsName(w) + '）' : ''));
      else undoToast('已覆盖为 ' + opts.length + ' 个选项' + (editOptsName(w) ? '（' + editOptsName(w) + '）' : ''));
      break;
    }
    case 'wheelFilter':
      ui.wheelFilter = el.dataset.val || 'all';
      renderSheet('swap');
      break;
    case 'simulate':
      ui.simResults = simulateWheel(currentWheel(), 10000);
      navTo('simulation');
      break;
    case 'setPalette': state.settings.palette = el.dataset.val; save(); renderSheet(); requestDraw(); break;
    case 'setTheme': state.settings.theme = el.dataset.val; applyTheme(); save(); renderSheet(); break;
    case 'setSeed': {
      const value = await askDialog({ title:'设置随机种子', desc:'同版本、同数据使用同一种子，会得到相同的抽取顺序。', value:randomSeed() || '我的世界线', ok:'启用' });
      if (value === null) return;
      state.settings.randomSeed = String(value).trim();
      setRandomSeed(state.settings.randomSeed); save(); renderSheet('swap');
      toast(state.settings.randomSeed ? '可复现随机已启用' : '已恢复真随机');
      break;
    }
    case 'clearSeed':
      state.settings.randomSeed = ''; setRandomSeed(''); save(); renderSheet('swap'); toast('已恢复真随机'); break;
    case 'copyReplay': {
      const code = replayCode({ app:STATE_VER });
      if (!code) { toast('请先设置随机种子'); break; }
      copyText(code); break;
    }
    case 'loadReplay': {
      const code = await askDialog({ title:'载入复盘码', desc:'会设置其中的随机种子并从头开始本轮。转盘数据必须与分享者一致。', value:'', ok:'载入' });
      if (code === null) return;
      const parsed = parseReplayCode(code);
      if (!parsed) { toast('复盘码格式不正确'); break; }
      state.settings.randomSeed = parsed.seed;
      setRandomSeed(parsed.seed); resetFlow(); save(); renderSheet('swap');
      toast(parsed.app && parsed.app !== STATE_VER ? '已载入；来源版本不同，结果可能有差异' : '复盘码已载入，可从起点重放');
      break;
    }
    case 'addProfile': await addProfile(); break;
    case 'renameProfile': await renameProfile(); break;
    case 'deleteProfile': await deleteProfile(); break;
    case 'exportData': exportData(); break;
    case 'exportCurrentPack': exportWheelPack('current'); break;
    case 'exportAllPack': exportWheelPack('all'); break;
    case 'saveFolder': saveToFolder(); break;
    case 'reloadFiles': reloadFromFiles(); break;
    case 'importData': ui.importMode = 'backup'; $('#fileImport').click(); break;
    case 'importPack': ui.importMode = 'pack'; $('#fileImport').click(); break;
    case 'restoreImport':
      if (await restoreImportState()) toast('已恢复导入前的数据');
      else if (!storageStatus.ok) toast('恢复失败：浏览器存储不可用');
      break;
    case 'undoLast': undoLast(); break;
    case 'copyData': copyText(JSON.stringify(state)); break;
    case 'resetAll': {
      const ok = await askDialog({ title:'恢复默认', desc:'将清除全部转盘、选项与历史记录，恢复为初始内容', ok:'恢复', danger:true });
      if (!ok) return;
      pushUndo('恢复默认');
      loadState(seed()); save(); applyTheme(); refreshTitle(); requestDraw(); renderSheet(); undoToast('已恢复默认内容'); break;
    }

    /* ---- 分支流程 ---- */
    case 'pickNext': {
      const o = optById(w.id, id);
      if (!o) break;
      ui.targetCtx = { kind:'opt', wheel:w.id, opt:o.id, cur:o.next || '' };
      navTo('target'); break;
    }
    case 'setTarget': {
      const ctx = ui.targetCtx || {}, val = el.dataset.val || '';
      if (ctx.kind === 'root') state.flow.rootId = val;
      else if (ctx.kind === 'def') { const x = wheelById(ctx.wheel); if (x) x.next = val; }
      else if (ctx.kind === 'opt') { const o = optById(ctx.wheel, ctx.opt); if (o) o.next = val; }
      if (val) state.flow.enabled = true;
      save();
      navBack(); renderFlowBar();
      toast(val ? '已设置为「' + slotText(val) + '」' : '已清除设置');
      break;
    }
    case 'setSpinFx': {
      state.settings.spinFx = el.dataset.val || 'bounce';
      save(); renderSheet('swap');
      const fx = SPIN_FX.filter(x => x[0] === spinFxKey())[0];
      toast('旋转效果：' + fx[1]);
      break;
    }
    case 'setWheelColor': {
      state.settings.wheelColor = el.dataset.val || 'jin';
      save(); renderSheet('swap');
      toast('法轮颜色：' + (CHART_INKS.filter(x => x[0] === wheelInkKey())[0][1]));
      break;
    }
    case 'setChartColor': {
      state.settings.chartColor = el.dataset.val || 'zhu';
      save(); renderSheet('swap');
      toast('维度图颜色：' + (CHART_INKS.filter(x => x[0] === chartInkKey())[0][1]));
      break;
    }
    case 'expandFlow': expandFlowBar(); break;
    case 'gradeAuto': {
      const x = wheelById(id);
      if (!x) break;
      x.grade = null; save(); renderSheet('swap');
      toast('「' + x.name + '」已恢复自动判断（' + (isGradeWheel(x) ? '会计入' : '不会计入') + '属性图）');
      break;
    }
    case 'copyResult': copyText(ui.resultLabel || resultEl.textContent); break;
    case 'copyRound':
      copyText(roundResultText());
      break;
    case 'exportResultCard': exportResultCard(); break;
    case 'restartRound': closeSheet(); resetFlow(); break;
    case 'spinAgain': closeSheet(); setTimeout(() => spin(), 240); break;
    case 'removeWinner': {
      const ww = currentWheel();
      const oo = findOptionById(ww, ui.resultOptId);
      if (!oo) { toast('这个选项已经不在了'); break; }
      if (wheelOptions(ww).filter(x => num(x.weight) > 0).length <= 1) { toast('至少要保留一个选项'); break; }
      pushUndo('移除抽中选项');
      /* 从它实际所在的那一组里删（可能是某个面，也可能就是兜底面） */
      const arr = editOpts(ww, true);
      const at = arr.map(x => x.id).indexOf(oo.id);
      if (at >= 0) arr.splice(at, 1);
      else ww.options = ww.options.filter(x => x.id !== oo.id);
      ui.resultOptId = '';
      save(); requestDraw(); closeSheet();
      undoToast('已把「' + oo.label + '」移出转盘');
      break;
    }
    case 'editWheel': {
      const wid = id || (el && el.dataset ? el.dataset.id : '');
      const x = wheelById(wid);
      if (!x) break;
      state.currentId = x.id; save(); refreshTitle(); requestDraw();
      // 选项内容永远是「转盘列表」的下一层：不在列表上就先垫一层，保证返回必定回到列表
      const atList = isOverlayOpen() && ui.view === 'manager' && ui.mtab === 'wheels';
      if (!atList) navTo('manager', { mtab:'wheels', force:true });
      navTo('manager', { mtab:'content', force:true });
      break;
    }
    case 'clearLinks': {
      const ok = await askDialog({ title:'清除所有连接', desc:'将删除全部「默认下一站」与选项上的跳转设置', ok:'清除', danger:true });
      if (!ok) return;
      /* ⚠️ 面里的选项也有跳转设置，一起清（别只清兜底面） */
      const clearWheel = x => {
        x.next = '';
        x.options.forEach(o => { o.next = ''; });
        (x.faces || []).forEach(f => (f.options || []).forEach(o => { o.next = ''; }));
      };
      state.wheels.forEach(clearWheel);
      state.flow.rootId = ''; state.flow.path = []; state.flow.pendingId = '';
      save(); renderSheet(); renderFlowBar(); toast('已清除所有连接'); break;
    }
    case 'gotoStep': {
      const f = state.flow, i = num(el.dataset.idx), p = f.path[i];
      if (!p) break;
      clearJump();
      f.path = f.path.slice(0, i); f.pendingId = ''; f.finished = false;
      ui.flowCollapsed = false;
      save();
      if (p.wheelId && wheelById(p.wheelId)) switchTo(p.wheelId, { silent:true });
      else renderFlowBar();
      break;
    }
    case 'resetFlow': ui.flowCollapsed = false; resetFlow(); break;
    case 'goPending': {
      const pid = state.flow.pendingId;
      state.flow.pendingId = '';
      state.flow.paused = false;                    // 手动点「下一站」= 明确要继续
      if (pid && wheelById(pid)) switchTo(pid, { silent:false, spin:false });
      else renderFlowBar();
      break;
    }
    case 'resumeFlow': {
      state.flow.paused = false;
      save(); renderFlowBar();
      toast('已恢复自动跳转');
      break;
    }
    case 'backFlow': navGoBack(); break;

    /* ---- 多面转盘 ----
       和「分支」是两件事：分支改"跳到哪"，多面改"这个盘显示什么"。 */
    case 'toggleMulti': {
      const x = wheelById(id);
      if (!x) break;
      if (isMultiWheel(x)) {
        const okOff = await askDialog({ title:'恢复成普通转盘',
          desc:'「' + x.name + '」的 ' + faceCount(x) + ' 个面会被删掉，只留下兜底面（也就是现在的选项内容）。确定吗？',
          ok:'恢复', danger:true });
        if (!okOff) return;
        x.multi = false; x.faces = []; x.faceBy = '';
        save(); renderSheet(); renderFlowBar(); requestDraw();
        toast('「' + x.name + '」已恢复为普通转盘');
        break;
      }
      /* 打开多面：先猜一个分面依据（前一个属性盘最像），猜错了再自己改 */
      const i = state.wheels.indexOf(x);
      let guess = null;
      for (let k = i - 1; k >= 0; k--) if (isGradeWheel(state.wheels[k])) { guess = state.wheels[k]; break; }
      if (!guess) guess = state.wheels.filter(y => y.id !== x.id && isGradeWheel(y))[0] || null;
      x.multi = true;
      x.faceBy = guess ? guess.id : '';
      if (!Array.isArray(x.faces) || !x.faces.length) {
        /* 默认给两个面，条件留空等用户填（填好之前不会命中，用兜底面） */
        const mid = GRADE_LADDER[Math.floor(GRADE_LADDER.length / 2)];
        x.faces = [
          { when:{ type:'gradeAtLeast', value:mid }, options:[] },
          { when:{ type:'else' }, options:[] }
        ];
      }
      save(); renderSheet(); renderFlowBar(); requestDraw();
      ui.faceWheelId = x.id;
      navTo('faces');
      toast(guess ? ('已设为多面转盘，按「' + guess.name + '」分面（不对可以改）') : '已设为多面转盘，先选一个「按哪个转盘分面」');
      break;
    }
    case 'openFaces': {
      ui.faceWheelId = id || currentWheel().id;
      navTo('faces');
      break;
    }
    case 'setFaceBy': {
      const x = wheelById(id);
      if (!x) break;
      x.faceBy = el.dataset.val || '';
      save(); renderSheet('swap'); requestDraw();
      const src = faceSource(x);
      toast(src ? ('现在按「' + src.name + '」分面') : '已清除分面依据（只会用兜底面）');
      break;
    }
    case 'addFace': {
      const x = wheelById(id);
      if (!x) break;
      x.faces = Array.isArray(x.faces) ? x.faces : [];
      x.faces.push({ when:{ type:'gradeAtLeast', value:'A' }, options:[] });
      ui.faceWheelId = x.id;
      save(); renderSheet(); requestDraw();
      ui.faceWhenIdx = x.faces.length - 1;
      navTo('facewhen');
      toast('加了一个面，先设它的条件');
      break;
    }
    case 'delFace': {
      const x = wheelById(id), i = num(el.dataset.idx);
      if (!x || !x.faces || !x.faces[i]) break;
      const okDel = await askDialog({ title:'删除这个面',
        desc:'第 ' + (i + 1) + ' 面（' + faceWhenText(x.faces[i]) + '）的选项会一起删掉。确定吗？', ok:'删除', danger:true });
      if (!okDel) return;
      x.faces.splice(i, 1);
      save(); renderSheet(); requestDraw();
      toast('已删除');
      break;
    }
    case 'faceUp': case 'faceDown': {
      const x = wheelById(id), i = num(el.dataset.idx);
      if (!x || !x.faces) break;
      const j = i + (act === 'faceUp' ? -1 : 1);
      if (j < 0 || j >= x.faces.length) break;
      const t = x.faces[i]; x.faces[i] = x.faces[j]; x.faces[j] = t;
      save(); renderSheet('swap'); requestDraw();
      break;
    }
    case 'editFace': {
      const x = wheelById(id);
      if (!x) break;
      const i = num(el.dataset.idx);
      ui.faceWheelId = x.id;
      ui.faceEdit = i < 0 ? -1 : i;
      if (state.currentId !== x.id) { state.currentId = x.id; save(); refreshTitle(); requestDraw(); }
      if (ui.view !== 'faces') { navTo('faces'); }
      navTo('manager', { mtab:'content', force:true });
      break;
    }
    case 'pickEditFace': {
      ui.faceEdit = el.dataset.val === 'auto' ? 'auto' : num(el.dataset.val);
      renderSheet('swap');
      requestDraw();
      break;
    }
    case 'pickFaceWhen': {
      ui.faceWheelId = id;
      ui.faceWhenIdx = num(el.dataset.idx);
      navTo('facewhen');
      break;
    }
    case 'setFaceWhenType': {
      const x = wheelById(ui.faceWheelId), i = num(ui.faceWhenIdx);
      const f = x && x.faces ? x.faces[i] : null;
      if (!f) break;
      const t = el.dataset.val || 'else';
      f.when = { type:t };
      if (t !== 'else' && t !== 'labelIs' && t !== 'labelHas') f.when.value = 'A';
      save(); renderSheet('swap'); requestDraw();
      break;
    }
    case 'setFaceWhenValue': {
      const x = wheelById(ui.faceWheelId), i = num(ui.faceWhenIdx);
      const f = x && x.faces ? x.faces[i] : null;
      if (!f) break;
      f.when = Object.assign({}, f.when, { value: el.dataset.val || '' });
      save(); renderSheet('swap'); requestDraw();
      break;
    }

    /* ---- 记录页 ---- */
    case 'clearHistory': {
      const ok = await askDialog({ title:'清空记录', desc:'确定清空全部抽奖历史？', ok:'清空', danger:true });
      if (!ok) return;
      pushUndo('清空记录');
      state.history = []; save(); renderSheet(); undoToast('已清空记录'); break;
    }
    case 'copyHistory':
      copyText(state.history.map(h => h.label + '（' + (h.wheel || '') + '）').join('\n')); break;
  }
}


/* ---- 转盘列表：按住 / 长按拖动排序 ---- */

/* ---- 转盘列表：按住 / 长按拖动排序 ---- */
let rowHold = null, rowDrag = null, suppressClickUntil = 0;

function clearRowHold(){ if (rowHold) { clearTimeout(rowHold.timer); rowHold = null; } }

function beginRowDrag(){
  if (!rowHold) return;
  const el = rowHold.el, list = el.closest('.list');
  const rect = el.getBoundingClientRect();
  rowDrag = { el:el, list:list, id:el.dataset.id, startY:rowHold.y, target:null, line:null };
  rowHold = null;
  el.classList.add('dragging');
  document.body.classList.add('row-dragging');
  if (list) {
    const line = document.createElement('div');
    line.className = 'drop-line';
    list.appendChild(line);
    rowDrag.line = line;
  }
  vibrate(12);
  beep(560, 0.05, 'sine', 0.028);
  updateDropLine(rect.top + rect.height / 2);
}

function updateDropLine(y){
  const d = rowDrag;
  if (!d || !d.line || !d.list) return;
  const rows = $$('.wheel-row', d.list).filter(r => r !== d.el);
  let idx = rows.length;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i].getBoundingClientRect();
    if (y < r.top + r.height / 2) { idx = i; break; }
  }
  d.target = idx;
  const ref = rows[idx];
  const top = ref ? ref.offsetTop : d.list.scrollHeight;
  d.line.style.top = Math.max(0, top - 1) + 'px';
}

function autoScrollBy(y){
  const body = $('#sheet .sheet-body');
  if (!body) return;
  const r = body.getBoundingClientRect();
  if (y < r.top + 44) body.scrollTop = Math.max(0, body.scrollTop - 12);
  else if (y > r.bottom - 44) body.scrollTop = body.scrollTop + 12;
}

function onRowPointerMove(e){
  if (rowHold) {
    const moved = Math.abs(e.clientY - rowHold.y) + Math.abs(e.clientX - rowHold.x);
    if (rowHold.type === 'mouse') { if (moved > 5) beginRowDrag(); }
    else if (moved > 10) clearRowHold();          // 触屏上移动＝滚动列表，不算长按
  }
  if (!rowDrag) return;
  rowDrag.el.style.transform = 'translateY(' + (e.clientY - rowDrag.startY) + 'px)';
  autoScrollBy(e.clientY);
  updateDropLine(e.clientY);
  if (e.cancelable) e.preventDefault();
}

function endRowDrag(drop){
  clearRowHold();
  const d = rowDrag;
  if (!d) return;
  rowDrag = null;
  suppressClickUntil = Date.now() + 400;          // 拖完别把这次松手当成点击
  d.el.classList.remove('dragging');
  d.el.style.transform = '';
  document.body.classList.remove('row-dragging');
  if (d.line && d.line.parentNode) d.line.parentNode.removeChild(d.line);
  if (!drop) return;
  const from = state.wheels.findIndex(w => w.id === d.id);
  if (from < 0) return;
  const arr = state.wheels.slice();
  const moved = arr.splice(from, 1)[0];
  const to = Math.max(0, Math.min(arr.length, d.target == null ? from : d.target));
  if (to === from) return;
  arr.splice(to, 0, moved);
  state.wheels = arr;
  save(); renderSheet('swap');
  toast('「' + moved.name + '」已移到第 ' + (to + 1) + ' 位');
}

/* ============================== 事件绑定 ============================== */

function bindEvents(){
  $('#btnSwitch').addEventListener('click', () => navTo('manager', { mtab:'wheels' }));
  $('#btnPanel').addEventListener('click', () => navTo('manager', { mtab:'settings' }));
  $('#btnEdit').addEventListener('click', () => {
    const w = currentWheel();
    if (w) handleAction('editWheel', w.id, { dataset:{ id:w.id } });
  });
  canvas.addEventListener('click', spin);
  canvas.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.code === 'Space') { e.preventDefault(); e.stopPropagation(); spin(); }
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  const openResultActions = () => {
    if (core.spinning) return;
    const t = resultEl.textContent.trim();
    if (!t || t === '？') return;
    clearJump();                                  // 打开结果面板时暂停自动跳转
    navTo('result');
  };
  resultEl.addEventListener('click', openResultActions);
  resultEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.code === 'Space') { e.preventDefault(); e.stopPropagation(); openResultActions(); }
  });

  const overlay = $('#overlay');
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSheet(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (isOverlayOpen()) { e.preventDefault(); navGoBack(); }
      return;
    }
    if (e.code === 'Space' && !isOverlayOpen()) {
      const tag = (document.activeElement || {}).tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') { e.preventDefault(); spin(); }
    }
  });
  window.addEventListener('popstate', () => {
    if (NAV.swallowPop > 0) { NAV.swallowPop--; return; }   // 自己回退的历史，忽略
    if (navDepth() > 0) navBack();
    else if (isOverlayOpen()) { NAV.stack.length = 0; ui.view = 'none'; hideOverlay(); }
  });
  try { history.replaceState({ nav:0 }, ''); } catch(e){}

  const sheet = $('#sheet');
  sheet.addEventListener('click', e => {
    if (Date.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); return; }   // 刚拖完，忽略这次点击
    const tab = e.target.closest('[data-mtab]');
    if (tab) {
      const t = tab.dataset.mtab;
      if (t === ui.mtab) return;
      navPush({ view: ui.view, mtab: t }, 'swap');     // 标签也算一层：返回=回到上一个标签
      return;
    }
    const btn = e.target.closest('[data-act]');
    if (btn) {
      const row = btn.closest('[data-id]');
      handleAction(btn.dataset.act, row ? row.dataset.id : null, btn);
      return;
    }
    const slot = e.target.closest('[data-slot]');
    if (slot) {
      const kind = slot.dataset.slot, hostW = slot.dataset.wheel || '', oid = slot.dataset.opt || '';
      const cur = kind === 'root' ? (state.flow.rootId || '')
                : (kind === 'def' ? ((wheelById(hostW) || {}).next || '')
                                  : ((optById(hostW, oid) || {}).next || ''));
      ui.targetCtx = { kind:kind, wheel:hostW, opt:oid, cur:cur };
      navTo('target');
    }
  });
  sheet.addEventListener('input', e => {
    const t = e.target, field = t.dataset.field;
    if (t.id === 'wheelSearch') {
      ui.wheelQuery = t.value || '';
      $$('#sheet .wheel-row').forEach(row => {
        const x = wheelById(row.dataset.id);
        row.hidden = !x || !wheelMatchesFilter(x, ui.wheelQuery, ui.wheelFilter);
      });
      return;
    }
    if (!field) return;
    const row = t.closest('[data-id]'), id = row ? row.dataset.id : null;
    if (field === 'name') {
      const wheel = state.wheels.filter(x => x.id === id)[0];
      if (!wheel) return;
      wheel.name = t.value; refreshTitle(); saveSoon(); return;
    }
    if (field === 'duration') {
      state.settings.duration = clamp(num(t.value) || 4.2, 1.5, 8);
      const d = $('#durVal'); if (d) d.textContent = state.settings.duration + ' 秒';
      saveSoon(); return;
    }
    if (field === 'wheelAlpha') {
      state.settings.wheelAlpha = clamp(num(t.value) || 0.4, 0.05, 1);
      const d = $('#wAlphaVal'); if (d) d.textContent = Math.round(state.settings.wheelAlpha * 100) + '%';
      saveSoon(); return;
    }
    if (field === 'flowDelay') {
      state.flow.delay = clamp(num(t.value) || 1.6, 0.4, 8);
      const d = $('#delayVal'); if (d) d.textContent = state.flow.delay + ' 秒';
      saveSoon(); return;
    }
    if (field === 'flowDwell') {
      state.settings.chartDwell = chartDwellSec(t.value);
      const d = $('#dwellVal'); if (d) d.textContent = chartDwellSec(state.settings.chartDwell).toFixed(1) + ' 秒';
      saveSoon(); return;
    }
    if (field === 'faceWhenValue') {
      const x = wheelById(ui.faceWheelId), i = num(ui.faceWhenIdx);
      const f = x && x.faces ? x.faces[i] : null;
      if (!f) return;
      f.when = Object.assign({}, f.when, { value: t.value });
      saveSoon(); return;
    }
    /* ⚠️ 找选项要在**所有可能的选项数组**里找：兜底面 + 当前转盘的每一个面。
       以前只查 currentWheel().options（兜底面），多面转盘的面里那些选项就找不到 →
       下面 `if (!o) return` 会**静默丢弃**输入（打字打着打着内容就没了）。
       —— 这是"渲染改成按面取选项、但输入路径忘了同步"造成的。 */
    const o = findOptionById(currentWheel(), id);
    if (!o) return;
    if (field === 'label') { o.label = t.value; saveSoon(); requestDraw(); }
    else if (field === 'weight') {
      o.weight = Math.max(0, num(t.value));
      if (row) row.classList.toggle('off', o.weight <= 0);
      refreshOptionProbabilities(); saveSoon(); requestDraw();
    } else if (field === 'color') { o.color = t.value; saveSoon(); requestDraw(); }
  });
  sheet.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.flowToggle) {                   // 流程开关
      state.flow[t.dataset.flowToggle] = t.checked;
      if (t.dataset.flowToggle === 'enabled' && t.checked && !state.flow.rootId) state.flow.rootId = currentWheel().id;
      save(); renderSheet(); renderFlowBar(); return;
    }
    if (t.dataset.toggle) {                       // 全局开关
      state.settings[t.dataset.toggle] = t.checked; save(); return;
    }
    if (t.dataset.wheelToggle) {                  // 当前转盘开关
      currentWheel()[t.dataset.wheelToggle] = t.checked;
      save(); renderSheet(); return;
    }
    if (t.id === 'wheelPicker') {                 // 选项页切换转盘
      state.currentId = t.value; save(); refreshTitle(); requestDraw(); renderSheet(); return;
    }
    if (t.id === 'profilePicker') { switchProfile(t.value); return; }
    if (t.dataset.setting === 'historyLimit') {
      state.settings.historyLimit = num(t.value) || 50;
      state.history = state.history.slice(0, Math.max(10, state.settings.historyLimit));
      save(); return;
    }
  });

  const fi = $('#fileImport');
  fi.addEventListener('change', async () => {
    const f = fi.files && fi.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      const result = ui.importMode === 'pack' ? await importWheelPackText(text) : await importDataText(text);
      if (result.ok) {
        if (ui.importMode !== 'pack') toast('导入成功：' + state.wheels.length + ' 个转盘（可撤销）');
      } else if (!result.cancelled) toast('导入失败：' + (result.error || '文件格式不正确'));
    } catch(e){ toast('导入失败：无法读取文件'); }
    ui.importMode = '';
    fi.value = '';
  });

  sheet.addEventListener('pointerdown', e => {

    // 转盘列表：按住（触屏长按）拖动排序；右下角按钮和「分支」标记不参与
    const row = e.target.closest('.wheel-row');
    if (row && !e.target.closest('.row-acts') && !e.target.closest('.bchip')) {
      clearRowHold();
      rowHold = { el:row, x:e.clientX, y:e.clientY, type:e.pointerType || 'mouse',
                  timer:setTimeout(beginRowDrag, 320) };
    }
  });

  document.addEventListener('pointermove', onRowPointerMove, { passive:false });
  document.addEventListener('pointerup', () => endRowDrag(true));
  document.addEventListener('pointercancel', () => endRowDrag(false));
  document.addEventListener('touchmove', e => { if (rowDrag && e.cancelable) e.preventDefault(); }, { passive:false });
  document.addEventListener('contextmenu', e => { if (rowDrag) e.preventDefault(); });

  // 顶部流程条
  $('#flowBar').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (btn) handleAction(btn.dataset.act, null, btn);
  });

  const ro = new ResizeObserver(() => { fitWheel(); requestDraw(); });
  ro.observe($('.stage'));
  window.addEventListener('resize', () => { fitWheel(); requestDraw(); });
  window.addEventListener('orientationchange', () => setTimeout(() => { fitWheel(); requestDraw(); }, 220));
}

/* ============================== 单文件转盘数据（「转盘」文件夹） ==============================
   每个转盘一个数据文件，双击打开网页时自动读取。
   为什么数据文件是 .js 而不是 .json：file:// 页面被禁止 fetch 本地 json（CORS），
   而 <script src> 加载本地 js 是允许的，所以数据文件里是「纯 JSON + 一行注册调用」。
   读不到文件夹就退回页面内置数据，程序照样能用。
   ==================================================================================== */

Object.assign(ZW, { dropLayerIf, handleAction, rowHold, rowDrag, suppressClickUntil, clearRowHold, beginRowDrag, updateDropLine, autoScrollBy, onRowPointerMove, endRowDrag, bindEvents });
})();
