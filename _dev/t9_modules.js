/* 模块拆分后的结构回归：插件顺序、命名空间、注入、色板解析
   node _dev/t9_modules.js
   —— 这些检查都是"拆模块时最容易悄悄坏掉"的地方：
      顺序错 → 某个函数 undefined；注入漏了 → 静默退回默认值（颜色/音效不对但不报错）。 */
'use strict';
const fs = require('fs');
const path = require('path');
const { loadApp, ROOT } = require('./harness');

let pass = 0, fail = 0;
const ok = (c, m, e) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + (e ? '  → ' + e : '')); } };

/* ---------- 1. index.html 的 <script src> 顺序 ---------- */
console.log('\n[1] 插件加载顺序');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const refs = [];
const re = /<script\s+src="js\/([^"]+)"\s*>/g;
let m;
while ((m = re.exec(html))) refs.push(m[1]);
console.log('    页面顺序：' + refs.join(' → '));
ok(refs[0] === '_ns.js', '第一个是 _ns.js（命名空间必须先建好）', refs[0]);
ok(refs.indexOf('util.js') < refs.indexOf('spin.js'), 'util.js 在 spin.js 之前（工具得先有）', refs.join(','));
ok(refs.indexOf('core.js') < refs.indexOf('spin.js'), 'core.js 在 spin.js 之前', refs.join(','));
const onDisk = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'));
ok(onDisk.every(f => refs.indexOf(f) >= 0), 'js/ 里每个文件都被页面加载了',
   '没加载：' + onDisk.filter(f => refs.indexOf(f) < 0).join(','));

/* ---------- 2. 启动 + 命名空间 ---------- */
console.log('\n[2] 命名空间 ZW 和注入');
const app = loadApp();
const T = app.T;
const Z = app.sandbox.ZW;
ok(!!Z, 'ZW 存在');
for (const k of ['$', '$$', 'esc', 'uid', 'num', 'norm', 'clamp', 'colorOf', 'paletteOf',
                 'icon', 'beep', 'tickSound', 'winSound', 'vibrate', 'spin', 'applySpinFx',
                 'core', 'usePalette', 'useAudioConfig', 'useSpinHooks']) {
  ok(typeof Z[k] === 'function' || typeof Z[k] === 'object', 'ZW.' + k + ' 已挂上（' + typeof Z[k] + '）', String(Z[k]));
}
ok(typeof Z.core.rot === 'number', 'ZW.core.rot 存在且是数字', String(Z.core.rot));
ok(Z.coreStore.rot === 0, 'ZW.coreStore 能看到原始值', String(Z.coreStore.rot));

/* ---------- 3. 色板解析（曾经静默退回鲜艳的坑） ---------- */
console.log('\n[3] 色板解析');
const s = T.state();
s.settings.palette = 'xuan';
ok(T.paletteOf().name === '宣纸', 'palette=xuan → 宣纸', T.paletteOf().name);
ok(T.paletteKeyNow() === 'xuan', 'paletteKeyNow() 取到 key 字符串', T.paletteKeyNow());
const xuanColor = T.colorOf(null, { color:null }, 0);
s.settings.palette = 'vivid';
ok(T.paletteOf().name === '鲜艳', 'palette=vivid → 鲜艳', T.paletteOf().name);
const vividColor = T.colorOf(null, { color:null }, 0);
ok(xuanColor !== vividColor, '换色板后颜色真的变了', xuanColor + ' → ' + vividColor);
s.settings.palette = 'xuan';
ok(T.paletteOf().name === '宣纸', '换回来也对（不是一次性缓存）', T.paletteOf().name);
ok(T.colorOf(null, { color:'#123456' }, 0) === '#123456', '选项自带颜色时不走色板');
s.settings.palette = '不存在的板子';
ok(T.paletteOf().name === '宣纸', '色板 key 非法时退回第一个（宣纸）', T.paletteOf().name);
s.settings.palette = 'xuan';

/* ---------- 4. 声音开关的注入 ---------- */
console.log('\n[4] 音效 / 震动开关走注入（js/sound.js 不认识 state）');
ok(typeof Z.audio === 'function', 'audio() 可用');
s.settings.sound = false;
let threw = null;
try { Z.beep(440, 0.02, 'square', 0.02); Z.tickSound(); Z.winSound(); Z.gearTick(); } catch(e){ threw = e.message; }
ok(!threw, '关掉音效后调用各种音效不报错', threw || '');
s.settings.sound = true;
threw = null;
try { Z.vibrate([0, 10]); } catch(e){ threw = e.message; }
ok(!threw, 'vibrate 不报错（沙箱里没有 navigator.vibrate）', threw || '');

/* ---------- 5. spin 的依赖注入是否齐 ---------- */
console.log('\n[5] 旋转模块的依赖注入');
const mkOpt = (id, label) => ({ id, label, weight:1, color:null, next:'' });
const A = { id:'wA', name:'测试盘', next:'', branch:false, grade:false, removeAfterPick:false,
            options:[mkOpt('a1','甲'), mkOpt('a2','乙')] };
s.wheels = [A]; s.currentId = 'wA';
s.settings.duration = 0.2;
s.flow = { enabled:true, rootId:'wA', autoJump:true, autoSpin:false, delay:99,
           path:[], pendingId:'', retStack:[], paused:false, roundAt:Date.now(), grow:{} };
let spinErr = null;
T.spin().catch(e => { spinErr = e.message; });
(async function(){
  await app.drainAsync(3000);
  ok(!spinErr, 'spin() 跑完不报错（依赖注入齐全）', spinErr || '');
  ok(s.history.length === 1, '抽奖记了一条历史', String(s.history.length));
  ok(T.ui.resultLabel && T.ui.resultLabel !== '？', '结果区有内容：' + T.ui.resultLabel, T.ui.resultLabel);
  ok(s.flow.path.length === 1, '流程记了一步', String(s.flow.path.length));
  ok(Z.core.rot !== 0, '转盘角度被动画改过（core.rot 共享成功）', String(Z.core.rot));

  /* ---------- 6. 调试出口默认不暴露 ---------- */
  console.log('\n[6] 调试出口（ZW.__app）默认关闭');
  const a1 = loadApp();
  await a1.drainAsync(3000);                 // 等 boot() 跑完（它挂在异步的文件读取回调里）
  await a1.settle();
  ok(a1.sandbox.ZW.__app === undefined, '没设调试开关时 ZW.__app 是 undefined（对用户零影响）',
     typeof a1.sandbox.ZW.__app);
  const a2 = loadApp({ preload:{ 'zhoushu-wheel.debug': '1' } });
  await a2.drainAsync(3000);
  await a2.settle();
  const dbg = a2.sandbox.ZW.__app;
  ok(!!dbg, '设了 zhoushu-wheel.debug=1 之后才暴露', typeof dbg);
  if (dbg) {
    ok(typeof dbg.openChart === 'function' && typeof dbg.spin === 'function', 'openChart / spin 可用');
    ok(!!dbg.state && !!dbg.ui && !!dbg.nav, '能拿到 state / ui / nav');
    ok(typeof dbg.canvasCalls === 'function', 'canvasCalls 可用（浏览器里手查用）');
  }

  /* ---------- 7. 启动链：boot 真的跑了 / 数据文件加载 ---------- */
  console.log('\n[7] 启动链（boot 与数据文件）');
  ok(a2.T.fileWheelCountGet() === 0, '默认不读「转盘/」数据文件（测试用内置数据，保证确定性）',
     String(a2.T.fileWheelCountGet()));
  ok(a2.T.state().wheels.length === 10, '默认是内置的 10 个转盘', String(a2.T.state().wheels.length));
  const a3 = loadApp({ withWheelFiles: true });
  await a3.drainAsync(3000);
  await a3.settle();
  await a3.drainAsync(1000);
  await a3.settle();
  const s3 = a3.T.state();
  ok(s3.wheels.length > 10, 'withWheelFiles:true 时真的读了数据文件（' + s3.wheels.length + ' 个转盘）', String(s3.wheels.length));
  ok(a3.T.fileWheelCountGet() === s3.wheels.length, 'fileWheelCount 与转盘数一致', String(a3.T.fileWheelCountGet()));
  ok(s3.wheels.some(w => w.name !== '穿越后的初始身份'), '用的是文件里的转盘名（不是内置那批）');

  console.log('\n通过 ' + pass + ' / 失败 ' + fail);
  process.exit(fail ? 1 : 0);
})();

