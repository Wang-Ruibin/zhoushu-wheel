/* 死 action 检查：handleAction 里的每个 case 都要有 data-act 入口
   （反过来也要查：data-act="x" 必须有对应的 case，否则点了没反应）
   node _dev/actions.js */
'use strict';
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

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
