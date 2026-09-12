/* 扫 app.css：找出所有孤立的声明块（属性写在深度 0，没有选择器跟着）——上次抽 CSS 时的遗留
   node _dev/csslint.js */
'use strict';
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'app.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const lines = css.split('\n');
const orphans = [];
let depth = 0, pendingDecl = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const opens = (line.match(/\{/g) || []).length;
  const closes = (line.match(/\}/g) || []).length;
  if (depth === 0 && closes > 0 && opens === 0) {
    orphans.push({ line: i + 1, text: line.trim(), decls: pendingDecl.slice() });
    pendingDecl = [];
  } else if (depth === 0 && opens === 0 && line.trim()) {
    pendingDecl.push((i + 1) + ': ' + line.trim());
  } else if (opens > 0) {
    pendingDecl = [];
  }
  depth += opens - closes;
}
const totalOpen = (css.match(/\{/g) || []).length, totalClose = (css.match(/\}/g) || []).length;
console.log('app.css 括号：{ ' + totalOpen + ' 个 / } ' + totalClose + ' 个 → ' + (totalOpen === totalClose ? '✓ 配平' : '✗ 差 ' + Math.abs(totalOpen - totalClose)));
if (orphans.length) {
  console.log('\n孤立声明块 ' + orphans.length + ' 处（选择器被删掉、只剩属性）：');
  orphans.forEach(o => {
    console.log('\n  ✗ 第 ' + o.line + ' 行 的 } 没有开头');
    o.decls.forEach(d => console.log('      ' + d));
  });
} else {
  console.log('✓ 没有孤立声明块');
}
process.exit((orphans.length || totalOpen !== totalClose) ? 1 : 0);
