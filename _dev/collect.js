/* 极简接收服务器：把页面 POST 上来的诊断 JSON 落盘，方便无头浏览器核对
   node _dev/collect.js   → 监听 127.0.0.1:8765，收到就打印并追加写 _dev/report.jsonl */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'report.jsonl');
fs.writeFileSync(OUT, '');
const srv = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    if (body) {
      let pretty = body;
      try { pretty = JSON.stringify(JSON.parse(body), null, 1); } catch(e){}
      console.log('--- ' + new Date().toISOString() + ' ---');
      console.log(pretty);
      fs.appendFileSync(OUT, body + '\n');
    }
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
    res.end();
  });
});
srv.listen(8765, '127.0.0.1', () => console.log('listening on http://127.0.0.1:8765'));
setTimeout(() => { srv.close(); console.log('done, wrote ' + OUT); process.exit(0); }, 30000);
