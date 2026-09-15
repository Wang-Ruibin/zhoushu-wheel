/* 咒术转盘 · 可复现随机数。空种子时仍使用浏览器 Math.random。 */
(function(){
'use strict';

let seedText = '';
let seedState = 0;
let draws = 0;

function hashSeed(text){
  let h = 2166136261 >>> 0;
  const s = String(text || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function setRandomSeed(text){
  seedText = String(text || '').trim();
  seedState = hashSeed(seedText) || 0x6d2b79f5;
  draws = 0;
  return seedText;
}
function random(){
  if (!seedText) return Math.random();
  seedState = (seedState + 0x6d2b79f5) >>> 0;
  let t = seedState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  draws++;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function randomSeed(){ return seedText; }
function randomDraws(){ return draws; }
function encodeBase64Url(text){
  const raw = unescape(encodeURIComponent(text));
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function decodeBase64Url(text){
  const s = String(text || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = s + '==='.slice((s.length + 3) % 4);
  return decodeURIComponent(escape(atob(padded)));
}
function replayCode(meta){
  if (!seedText) return '';
  return 'ZW1.' + encodeBase64Url(JSON.stringify({ v:1, seed:seedText, app:(meta && meta.app) || 3 }));
}
function parseReplayCode(code){
  const s = String(code || '').trim();
  if (s.indexOf('ZW1.') !== 0) return null;
  try {
    const data = JSON.parse(decodeBase64Url(s.slice(4)));
    if (!data || data.v !== 1 || !String(data.seed || '').trim()) return null;
    return { seed:String(data.seed).trim(), app:Number(data.app) || 0 };
  } catch(e) { return null; }
}

Object.assign(ZW, { hashSeed, setRandomSeed, random, randomSeed, randomDraws, replayCode, parseReplayCode });
})();
