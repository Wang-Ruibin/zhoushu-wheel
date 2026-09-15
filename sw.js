/* 线上版离线缓存；file:// 模式不会注册。
   ⚠️ CORE 必须和 index.html 的 <script src> 清单同步（js/ 顺序一致），
      _dev/run.js 会检查两边漂移。 */
'use strict';
const CACHE = 'zhoushu-wheel-v5';
const CORE = [
  './', './index.html', './app.css', './favicon.svg', './manifest.webmanifest',
  './js/_ns.js', './js/random.js', './js/util.js', './js/core.js', './js/icons.js', './js/sound.js', './js/spin.js', './js/multi.js',
  './js/wheels.js', './js/state.js', './js/growth.js', './js/navigation.js', './js/chart.js', './js/flow.js', './js/storage.js',
  './js/wheelview.js', './js/views.js', './js/actions.js',
  './转盘/_index.js',
  './转盘/01-穿越后的时间点.js', './转盘/02-事件成长-平安时代.js', './转盘/03-事件成长-400年前.js',
  './转盘/04-事件成长-怀玉_0卷时期.js', './转盘/05-穿越后的地点.js', './转盘/06-穿越后的初始身份.js',
  './转盘/07-穿越后的性别.js', './转盘/08-穿越后的颜值.js', './转盘/09-道德水平.js', './转盘/10-拥有的声望.js',
  './转盘/11-是否拥有生的术式.js', './转盘/12-拥有什么术式.js', './转盘/13-咒力总量.js', './转盘/14-咒力操纵.js',
  './转盘/15-体术水平.js', './转盘/16-体质（基础体质）.js', './转盘/17-咒力效率.js', './转盘/18-天赋.js',
  './转盘/19-高级技巧会几个.js', './转盘/20-会哪些高级技巧.js', './转盘/21-是否有特殊天赋.js',
  './转盘/22-特殊天赋是.js', './转盘/23-等级评定.js', './转盘/24-事件成长-怀玉_0卷时期·任务历练.js',
  './转盘/25-事件成长-怀玉_0卷时期·同伴切磋.js', './转盘/26-事件成长-怀玉_0卷时期·生死突破.js',
  './转盘/27-事件成长-怀玉_0卷时期·术式研习.js', './转盘/28-事件成长-怀玉_0卷时期·决战余波.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const isEntry = new URL(event.request.url).pathname.endsWith('/') || new URL(event.request.url).pathname.endsWith('/index.html');
  if (isEntry) {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response;
    }).catch(() => caches.match(event.request).then(hit => hit || caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => {
    const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response;
  })));
});
