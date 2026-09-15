/* 死 action 检查：handleAction 里的每个 case 都要有 data-act 入口
   （反过来也要查：data-act="x" 必须有对应的 case，否则点了没反应）
   阶段 C 拆分后 data-act 字符串分布在 index.html 和 js/*.js（视图、流程条）里，都要扫。
   node _dev/actions.js */
'use strict';
const fs = require('fs');
const path = require('path');
const JS_DIR = path.join(__dirname, '..', 'js');
/* 原插件（multi.js 里有条件匹配 switch，case 标签不是 action）不参与 data-act 扫描；
   阶段 C 拆出的业务模块（flow/views…）里的 data-act 才和 handleAction 对账 */
const PLUGIN_SKIP = new Set(['_ns.js','random.js','util.js','core.js','icons.js','sound.js','spin.js','multi.js']);
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8') +
  fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js') && !PLUGIN_SKIP.has(f))
    .map(f => fs.readFileSync(path.join(JS_DIR, f), 'utf8')).join('\n');

const cases = new Set();
/* case 可能写成 fall-through：case 'a': case 'b': { ... }
   所以不锚定行首，直接从全文里捞所有 case 标签 */
const re = /\bcase\s+'([A-Za-z0-9_]+)'\s*[:{]/g;
let m;
while ((m = re.exec(src))) cases.add(m[1]);

const acts = new Set();
const re2 = /data-act="([A-Za-z0-9_]+)"/g;
while ((m = re2.exec(src))) acts.add(m[1]);

/* 这些 case 是被 handleAction 之外的代码直接调用/转发的，允许没有 data-act */
const ALLOW_NO_ENTRY = new Set([]);

const noEntry = [...cases].filter(c => !acts.has(c) && !ALLOW_NO_ENTRY.has(c)).sort();
const noCase = [...acts].filter(a => !cases.has(a)).sort();

console.log('handleAction 里有 ' + cases.size + ' 个 case，页面里有 ' + acts.size + ' 种 data-act');
let bad = 0;
if (noEntry.length) { bad++; console.log('\n✗ 没有入口的 case（死代码）：\n    ' + noEntry.join(', ')); }
else console.log('\n✓ 每个 case 都有 data-act 入口');
if (noCase.length) { bad++; console.log('\n✗ 入口没有对应 case（点了没反应）：\n    ' + noCase.join(', ')); }
else console.log('✓ 每个 data-act 都有对应 case');
process.exit(bad ? 1 : 0);
