/* 开发分析工具：列出 index.html 内联脚本里真正的顶层声明（花括号深度 0）。
   用法：node _dev/analyze-structure.js  （不会被 run.js 收集，名字不带 t 前缀） */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const re = /<script>([\s\S]*?)<\/script>/g;
let m, last = null;
while ((m = re.exec(html))) last = m[1];
const lines = last.split('\n');
let depth = 0;
const out = [];
const norm = s => s.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
lines.forEach((raw, i) => {
  const line = norm(raw);
  const opens = (line.match(/\{/g) || []).length;
  const closes = (line.match(/\}/g) || []).length;
  if (depth === 1) {
    const fn = line.match(/^(?:async )?function\s+(\w+)/);
    const vr = line.match(/^(?:const|let|var)\s+([\w$]+)/);
    const de = line.match(/^}\s*else\s*\{/);
    const sec = line.match(/^\/\* =+ (.+?) =+ ?\*\//);
    if (fn) out.push((i + 1) + '\tFN\t' + fn[1]);
    else if (vr) out.push((i + 1) + '\tVAR\t' + vr[1]);
    else if (sec) out.push((i + 1) + '\tSEC\t' + sec[1]);
  }
  depth += opens - closes;
  if (depth < 0) depth = 0;
});
console.log('inline chars: ' + last.length + ', lines: ' + lines.length + ', top decls: ' + out.length);
console.log(out.join('\n'));
