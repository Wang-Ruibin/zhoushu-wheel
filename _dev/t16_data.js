/* 可靠性与真实数据清单：存档迁移、导入恢复点、数据引用和默认内容质量。 */
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
  console.log('\n[1] 老存档迁移与浏览器保存失败');
  const base = loadApp();
  const old = { version:2, settings:{ wheelAlpha:0.75 }, wheels:[{ name:'旧盘', options:['甲'] }] };
  const migrated = base.T.normalize(old);
  ok(migrated.settings.wheelAlpha === 0.75, '透明度保留在 settings.wheelAlpha');
  ok(!Object.prototype.hasOwnProperty.call(migrated, 'wheelAlpha'), '不会误写顶层 wheelAlpha');
  ok(base.T.normalize({ settings:{ wheelAlpha:0 }, wheels:old.wheels }).settings.wheelAlpha === 0.4,
    '非法透明度回退到 0.40');
  ok(base.T.normalize({ settings:{ wheelAlpha:9 }, wheels:old.wheels }).settings.wheelAlpha === 1,
    '透明度会限制在 0.05–1');

  const broken = loadApp({ storageSetError:'QuotaExceededError' });
  ok(broken.T.save() === false, 'localStorage 写失败时 save() 返回 false');
  ok(broken.T.storageStatus.ok === false, '设置页能读到“仅本次会话”状态');
  ok(/仅本次会话/.test(broken.T.storageStatusText()), '保存状态文案明确说明没有落盘');

  console.log('\n[2] 导入预览、确认、恢复点与失败保护');
  const app = loadApp();
  const beforeName = app.T.state().wheels[0].name;
  const invalid = await app.T.importDataText('{bad json', async () => true);
  ok(!invalid.ok && app.T.state().wheels[0].name === beforeName, '坏 JSON 不改变当前状态');

  const incoming = {
    version:3,
    settings:{ theme:'dark' },
    wheels:[{ name:'导入测试盘', options:[{ label:'唯一选项', weight:1 }] }],
    history:[{ label:'旧记录', wheel:'导入测试盘', at:1 }]
  };
  let preview = null;
  const imported = await app.T.importDataText(JSON.stringify(incoming), async summary => { preview = summary; return true; });
  ok(imported.ok, '确认后导入成功');
  ok(preview && preview.wheels === 1 && preview.options === 1 && preview.history === 1, '导入前摘要完整');
  ok(app.T.state().wheels[0].name === '导入测试盘', '确认后才替换当前状态');
  ok(app.store.has('zhoushu-wheel.import-recovery.v1'), '自动保留导入前恢复点');
  ok(await app.T.restoreImportState(async () => true), '可以撤销上次导入');
  ok(app.T.state().wheels[0].name === beforeName, '撤销后恢复原转盘');

  const noRecovery = loadApp({ storageSetError:(key) => key === 'zhoushu-wheel.import-recovery.v1' ? 'no space' : '' });
  const protectedName = noRecovery.T.state().wheels[0].name;
  const refused = await noRecovery.T.importDataText(JSON.stringify(incoming), async () => true);
  ok(!refused.ok, '无法创建恢复点时拒绝导入');
  ok(noRecovery.T.state().wheels[0].name === protectedName, '恢复点失败不会替换内存状态');

  console.log('\n[3] 真实转盘数据完整性');
  const real = loadApp({ withWheelFiles:true });
  await real.settle();
  const state = real.T.state();
  const ids = new Set(state.wheels.map(w => w.id));
  ok(state.wheels.length === 28, '真实清单完整加载 28 个转盘', String(state.wheels.length));
  ok(ids.size === state.wheels.length, '转盘 ID 唯一');
  ok(state.wheels.every(w => w.name.trim() && w.category), '每个转盘都有名称和分类');
  ok(state.wheels.every(w => !/副本|选项\s*\d+/.test(w.name)), '没有占位式转盘名称');

  let badWeight = 0, duplicateLabels = 0, dangling = 0, emptyLists = 0;
  const signatures = new Map();
  const graph = new Map(state.wheels.map(w => [w.id, []]));
  for (const wheel of state.wheels) {
    const lists = [wheel.options || []].concat((wheel.faces || []).map(facet => facet.options || []));
    if (lists.every(list => !list.some(option => Number(option.weight) > 0))) emptyLists++;
    const sig = JSON.stringify(lists.map(list => list.map(option => [option.label, Number(option.weight)])));
    signatures.set(sig, (signatures.get(sig) || []).concat(wheel.name));
    const targets = [];
    if (wheel.next && wheel.next !== '__end__' && wheel.next !== '__stay__') targets.push(wheel.next);
    if (wheel.faceBy && !ids.has(wheel.faceBy)) dangling++;
    for (const list of lists) {
      const labels = new Set();
      for (const option of list) {
        if (!(Number(option.weight) > 0)) badWeight++;
        if (labels.has(option.label)) duplicateLabels++;
        labels.add(option.label);
        if (option.next && option.next !== '__end__' && option.next !== '__stay__') targets.push(option.next);
      }
    }
    targets.forEach(target => { if (!ids.has(target)) dangling++; else graph.get(wheel.id).push(target); });
  }
  ok(badWeight === 0, '所有选项权重均为正数', String(badWeight));
  ok(duplicateLabels === 0, '同一面内没有重复标签', String(duplicateLabels));
  ok(dangling === 0, '跳转目标和多面来源没有悬空引用', String(dangling));
  ok(emptyLists === 0, '每个转盘至少有一套可抽选项', String(emptyLists));
  ok(Array.from(signatures.values()).every(names => names.length === 1), '没有完全相同的转盘选项集');

  const moral = state.wheels.find(w => w.name === '道德水平');
  const fame = state.wheels.find(w => w.name === '拥有的声望');
  const skills = state.wheels.find(w => w.name === '会哪些高级技巧');
  const skillCount = state.wheels.find(w => w.name === '高级技巧会几个');
  ok(fame && fame.multi && fame.faces.length === 2, '默认“声望”实际启用了两个条件面');
  ok(fame && moral && fame.faceBy === moral.id, '声望按道德水平分面');
  ok(moral && moral.next === fame.id, '默认主流程会经过声望盘');
  ok(skills && skills.branch && skills.options.every(o => !/^选项\s*\d+$/.test(o.label)), '高级技巧支线不是占位内容');
  ok(skillCount && skillCount.options.filter(o => o.label !== '不会').every(o => o.next === skills.id), '会技巧时会进入技巧支线');

  const dir = path.join(ROOT, '转盘');
  const diskNames = fs.readdirSync(dir).filter(name => /^\d{2}-.*\.js$/.test(name));
  ok(diskNames.length === 28, '磁盘上恰有 28 个编号数据文件');
  ok(diskNames.every(name => !name.includes('副本')), '数据文件名不再含“副本”');

  console.log('\n通过 ' + pass + ' / 失败 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
