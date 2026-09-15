/* 产品增强回归：随机复盘、搜索筛选、流程体检、模板、玩法包、结果卡片、存档槽。 */
'use strict';
const fs = require('fs');
const path = require('path');
const { loadApp, ROOT } = require('./harness');

let pass = 0, fail = 0;
const ok = (cond, msg, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg + (extra ? '  → ' + extra : '')); }
};

(async () => {
  console.log('\n[1] 固定种子与复盘码');
  const app = loadApp();
  const T = app.T;
  T.setRandomSeed('伏黑惠');
  const seq1 = [T.random(), T.random(), T.random(), T.random()];
  T.setRandomSeed('伏黑惠');
  const seq2 = [T.random(), T.random(), T.random(), T.random()];
  ok(JSON.stringify(seq1) === JSON.stringify(seq2), '同一种子产生完全相同的固定序列');
  T.setRandomSeed('虎杖悠仁');
  ok(T.random() !== seq1[0], '不同种子产生不同序列');
  T.setRandomSeed('五条悟·世界线');
  const code = T.replayCode({ app:3 });
  const parsed = T.parseReplayCode(code);
  ok(/^ZW1\./.test(code) && parsed && parsed.seed === '五条悟·世界线', '中文种子可以编码并解析复盘码');

  console.log('\n[2] 搜索、分类、概率模拟与流程体检');
  const s = T.state();
  const wheel = s.wheels[0];
  wheel.category = '角色';
  ok(T.wheelMatchesFilter(wheel, wheel.name.slice(0, 2), 'all'), '可按转盘名称搜索');
  ok(T.wheelMatchesFilter(wheel, wheel.options[0].label, '角色'), '可按选项文字与分类组合搜索');
  ok(!T.wheelMatchesFilter(wheel, '绝对不存在', 'all'), '无匹配内容会被过滤');
  wheel.options = [{ id:'a', label:'甲', weight:1 }, { id:'b', label:'乙', weight:3 }];
  const sim = T.simulateWheel(wheel, 10000);
  ok(sim.rows.length === 2 && sim.rows.reduce((n, row) => n + row.count, 0) === 10000, '概率模拟完整运行 1 万次');
  ok(Math.abs(sim.rows[0].observed - 0.25) < 0.02 && Math.abs(sim.rows[1].observed - 0.75) < 0.02, '模拟分布接近理论权重');
  const orphan = T.createTemplateWheels('draw')[0];
  orphan.name = '孤立分支'; orphan.branch = true; orphan.options = [];
  T.state().wheels.push(orphan);
  const issues = T.flowDiagnostics();
  ok(issues.some(issue => /没有可抽选项/.test(issue.text)), '流程体检能发现空转盘');
  ok(issues.some(issue => /没有任何入口/.test(issue.text)), '流程体检能发现无入口分支');

  console.log('\n[3] 四类本地模板');
  const draw = T.createTemplateWheels('draw');
  const norepeat = T.createTemplateWheels('norepeat');
  const story = T.createTemplateWheels('story');
  const growth = T.createTemplateWheels('growth');
  ok(draw.length === 1 && draw[0].options.length === 4, '公平抽签模板');
  ok(norepeat.length === 1 && norepeat[0].removeAfterPick, '不重复点名模板');
  ok(story.length === 3 && story[0].next === story[1].id && story[2].next === '__end__', '三幕剧情模板自带完整连接');
  ok(growth.length === 2 && growth[0].grade === true && /勇气\+/.test(growth[1].options[0].label), '属性养成模板含成长规则');

  console.log('\n[4] 玩法包导出、冲突改名与引用重建');
  s.wheels = story; s.currentId = story[0].id; s.flow.rootId = story[0].id;
  const pack = T.buildWheelPack('current');
  ok(pack.kind === 'zhoushu-wheel.pack' && pack.wheels.length === 3, '当前剧情可导出为带依赖的玩法包');
  const target = loadApp();
  const beforeCount = target.T.state().wheels.length;
  const imported = await target.T.importWheelPackText(JSON.stringify(pack), async () => true);
  ok(imported.ok && target.T.state().wheels.length === beforeCount + 3, '玩法包以追加方式导入');
  const importedRoot = target.T.wheelById(imported.rootId);
  ok(importedRoot && importedRoot.next && target.T.wheelById(importedRoot.next), '导入后内部跳转引用已重建');

  console.log('\n[5] 结果卡片、撤销与世界线');
  target.T.state().flow.path = [
    { wheelId:importedRoot.id, wheel:importedRoot.name, label:'接受任务', at:1 },
    { wheelId:importedRoot.next, wheel:'剧情·遭遇', label:'遇见盟友', at:2 }
  ];
  const card = target.T.exportResultCard({ download:false });
  ok(card.width === 1080 && card.height === 1350, '结果卡片使用稳定的分享尺寸');
  ok(card.getContext('2d').__calls.includes('fillText'), '结果卡片实际绘制了文字');
  const oldName = target.T.state().wheels[0].name;
  target.T.pushUndo('测试改名'); target.T.state().wheels[0].name = '临时名字';
  ok(target.T.undoLast() && target.T.state().wheels[0].name === oldName, '撤销可恢复完整状态快照');

  const profileState = { version:3, settings:{}, wheels:[{ name:'第二世界线', options:['唯一'] }] };
  target.T.profileIndex.items.push({ id:'p2', name:'世界线二', updated:1 });
  target.store.set('zhoushu-wheel.profile.p2', JSON.stringify(profileState));
  ok(target.T.switchProfile('p2'), '可以切换到另一条世界线');
  ok(target.T.state().wheels[0].name === '第二世界线', '每条世界线加载独立状态');

  console.log('\n[6] 新视图、无障碍语义与 PWA 文件');
  ['flowaudit','simulation','templates','complete'].forEach(view => {
    try { target.T.navTo(view); ok(target.T.ui.view === view, '视图 ' + view + ' 可渲染'); }
    catch(error) { ok(false, '视图 ' + view + ' 可渲染', error.message); }
  });
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/id="wheel" role="button" tabindex="0"/.test(html), 'Canvas 转盘具有按钮语义和键盘焦点');
  ok(/id="result" role="button" tabindex="0"/.test(html), '结果区具有按钮语义和键盘焦点');
  ok(/id="confirmOverlay" role="dialog" aria-modal="true"/.test(html), '确认框具有模态对话框语义');
  ok(fs.existsSync(path.join(ROOT, 'manifest.webmanifest')) && fs.existsSync(path.join(ROOT, 'sw.js')), 'PWA manifest 与 service worker 已就位');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ok(/location\.protocol !== 'file:'/.test(html) && /caches\.open/.test(sw), 'PWA 仅在线上注册且具备离线缓存');

  console.log('\n[7] 结果区键盘/点击入口（回归：openResultActions 的 spinning 守卫曾引用未声明变量）');
  const rt = target.T;
  rt.navCloseAll();
  rt.ui.resultLabel = '测试结果'; rt.ui.resultOptId = '';
  const resEl = target.byId['#result'];
  resEl.textContent = '测试结果';
  const kd = (resEl.listeners.keydown || [])[0];
  ok(typeof kd === 'function', '结果区挂了 keydown 监听');
  if (kd) {
    try {
      kd({ key:'Enter', code:'Enter', preventDefault(){}, stopPropagation(){} });
      ok(rt.ui.view === 'result', 'Enter 能打开结果面板（守卫不再抛 ReferenceError）');
      rt.navCloseAll();
    } catch (error) { ok(false, 'Enter 能打开结果面板', error.message); }
  }

  console.log('\n通过 ' + pass + ' / 失败 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
