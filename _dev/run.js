/* 一键回归：语法检查 + 全部测试
   node _dev/run.js
   （改了 index.html 之后跑这个；任何一项失败都会退出码 1） */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { extractScript, ROOT } = require('./harness');

const HTML_PATH = path.join(ROOT, 'index.html');
let failed = 0;

/* 1. 语法检查：把 <script> 抽出来喂给 vm 编译（不执行） */
console.log('=== 语法检查 index.html 里的 <script> ===');
const code = extractScript(fs.readFileSync(HTML_PATH, 'utf8'));
try {
  new vm.Script(code, { filename:'index.html<script>' });
  console.log('  ✓ 语法 OK（' + code.length + ' 字符）');
} catch(e) {
  failed++;
  console.log('  ✗ 语法错误：' + e.message);
}

/* 2. app.css：括号配平 + 孤立声明块（选择器被删、只剩属性的情况） */
console.log('\n=== app.css 结构 ===');
try {
  const css = fs.readFileSync(path.join(ROOT, 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const lines = css.split('\n');
  const orphans = [];
  let depth = 0, decls = [];
  for (let i = 0; i < lines.length; i++) {
    const opens = (lines[i].match(/\{/g) || []).length, closes = (lines[i].match(/\}/g) || []).length;
    if (depth === 0 && closes > 0 && opens === 0) { orphans.push(i + 1); decls = []; }
    else if (depth === 0 && opens === 0 && lines[i].trim()) decls.push(lines[i].trim());
    else if (opens > 0) decls = [];
    depth += opens - closes;
  }
  const o = (css.match(/\{/g) || []).length, c = (css.match(/\}/g) || []).length;
  if (o === c) console.log('  ✓ 括号配平（{ ' + o + ' / } ' + c + '）');
  else { failed++; console.log('  ✗ 括号不配平：{ ' + o + ' / } ' + c); }
  if (orphans.length) { failed++; console.log('  ✗ 孤立声明块（第 ' + orphans.join(', ') + ' 行的 } 没有开头）'); }
  else console.log('  ✓ 没有孤立声明块');
} catch(e) { failed++; console.log('  ✗ ' + e.message); }

/* 2.5 sw.js：语法可解析 + CORE 里的 js 清单和 index.html 的 <script src> 顺序一致
   （拆分期间曾因追加清单漏逗号导致 service worker 解析失败，测试却全绿——补上这道门） */
console.log('\n=== sw.js 离线清单 ===');
try {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  new vm.Script(sw, { filename: 'sw.js' });
  const htmlSrc = fs.readFileSync(HTML_PATH, 'utf8');
  const reTag = /<script\s+src="(js\/[^"]+)"\s*>/g;
  const inHtml = [];
  let tm;
  while ((tm = reTag.exec(htmlSrc))) inHtml.push('./' + tm[1]);
  const inSw = [];
  const rePath = /'\.\/js\/[^']+'/g;
  let sm;
  while ((sm = rePath.exec(sw))) inSw.push(sm[0].slice(1, -1));
  const drift = inHtml.filter(p => !inSw.includes(p)).concat(inSw.filter(p => !inHtml.includes(p)));
  const orderOk = inSw.every(p => inHtml.indexOf(p) >= 0) || inHtml.join() === inSw.join();
  if (drift.length) { failed++; console.log('  ✗ 清单漂移：' + drift.join(', ')); }
  else if (!orderOk) { failed++; console.log('  ✗ sw.js 的 js 顺序与 index.html 不一致'); }
  else console.log('  ✓ 语法 OK，' + inSw.length + ' 个 js 条目与 index.html 同步');
} catch(e) { failed++; console.log('  ✗ ' + e.message); }

/* 3. 死 action 检查（每个 case 都要有 data-act 入口，反之亦然） */
console.log('\n=== 死 action 检查 ===');
try {
  const out = execFileSync(process.execPath, [path.join(__dirname, 'actions.js')], { encoding:'utf8', cwd:ROOT });
  process.stdout.write(out);
} catch(e) { failed++; process.stdout.write((e.stdout || '') + (e.stderr || '')); }

/* 4. 模块符号检查（模块私有却被页面当变量用 → ReferenceError） */
console.log('\n=== 模块符号检查 ===');
try {
  const out = execFileSync(process.execPath, [path.join(__dirname, 'symbolscan.js')], { encoding:'utf8', cwd:ROOT });
  process.stdout.write(out);
} catch(e) { failed++; process.stdout.write((e.stdout || '') + (e.stderr || '')); }

/* 5. 跑所有 t*.js 测试 */
const tests = fs.readdirSync(__dirname).filter(f => /^t\d+.*\.js$/.test(f)).sort();
for (const t of tests) {
  console.log('\n=== ' + t + ' ===');
  try {
    const out = execFileSync(process.execPath, [path.join(__dirname, t)], { encoding:'utf8', cwd:ROOT });
    process.stdout.write(out.split('\n').filter(l => /[✓✗]|通过|失败/.test(l)).join('\n') + '\n');
  } catch(e) {
    failed++;
    const out = ((e.stdout || '') + (e.stderr || ''));
    process.stdout.write(out.split('\n').filter(l => /[✓✗]|通过|失败|Error/.test(l)).join('\n') + '\n');
  }
}

console.log('\n================================');
console.log(failed ? ('✗ 有 ' + failed + ' 项失败') : '✓ 全部通过');
process.exit(failed ? 1 : 0);
