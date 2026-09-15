/* 咒术转盘 · 状态底座：版本迁移、加载保存、撤销、世界线（profile）、存档状态
   （阶段 C 从 index.html 内联脚本拆出；仍是无构建普通 <script>，只经 ZW 命名空间互通） */
(function(){
'use strict';
const { END, PALETTES, WHEEL_CATEGORIES, clamp, inferWheelCategory, normOption, num, setRandomSeed, uid, useAudioConfig, usePalette, wheelFromDef } = ZW;

/* 状态单例：永远只改内容不换对象（loadState 原地替换），
   这样每个模块 const { state } = ZW 拿到的引用永远有效。 */
function loadState(next){
  Object.keys(state).forEach(k => { if (!(k in next)) delete state[k]; });
  Object.assign(state, next);
  return state;
}
/* storage 域要重置「保存失败已提示过」标记时用（storageErrorShown 是本模块私有） */
function storageErrorReset(){ storageErrorShown = false; }

function chartDwellSec(v){
  const n = num(v);
  if (!(n > 0)) return CHART_DWELL_DEF;
  return clamp(n, CHART_DWELL_MIN, CHART_DWELL_MAX);
}

const LS_KEY = 'zhoushu-wheel.v1';

const HINT_KEY = 'zhoushu-wheel.hint';

const RECOVERY_KEY = 'zhoushu-wheel.import-recovery.v1';

const PROFILE_INDEX_KEY = 'zhoushu-wheel.profiles.v1';

const PROFILE_PREFIX = 'zhoushu-wheel.profile.';

const BASE_SETTINGS = {
  palette:'xuan', theme:'light', sound:true, vibrate:true,
  duration:4.2, rolling:true, autoFlip:false, historyLimit:50,
  autoSave:true,      // 改动后自动写回「转盘」文件夹（需要授权过一次）
  chartOnEnd:true,    // 流程结束时自动弹出属性维度图
  chartMid:true,      // 流程走到某个转盘、而这个位置正好有一张维度图时，也弹出来看一眼
  chartDwell:3.4,     // 中途自动弹出的维度图停留几秒（0 = 不自动弹）
  chartColor:'zhu',   // 维度图配色（CHART_INKS 的 key）
  wheelColor:'jin',   // 法轮配色（独立设置，默认赭金=黄铜）
  wheelAlpha:0.40,    // 法轮透明度
  spinFx:'bounce',    // 旋转的物理效果（SPIN_FX 的 key）
  fromFiles:false,    // 仅内部用：true = 每次打开都以文件覆盖
  randomSeed:''       // 留空 = 真随机；填写后同版本同数据可复现
};
/* ---- 维度图自动弹出的节奏（想微调改这里就行） ---- */

const CHART_DWELL_MIN  = 1.0;      // 停留时长下限（秒）

const CHART_DWELL_MAX  = 30;       // 停留时长上限（秒）

const CHART_DWELL_DEF  = 3.4;      // 没设置过 / 设成 0 时的默认停留时长（秒）

const STATE_VER = 3;

const BASE_FLOW = { enabled:true, rootId:'', autoJump:true, autoSpin:false, delay:1.6, path:[], pendingId:'', retStack:[], paused:false };

const BASE_WHEELS = [
  { name:'穿越后的初始身份', labels:['咒术师','诅咒师','咒灵','咒骸','式神','咒具','魂穿原著角色','咒术高层','普通人'] },
  { name:'穿越后的时间点',   labels:['怀玉时期','0卷时期','剧情开始时','涩谷事变时期','死灭回游时期','新宿决战时期','68年后·外传','平安时代（千年前）','400年前'] },
  { name:'穿越后的地点',     opts:[['日本',40],['亚洲除日本其他地方',9],['北美洲',8],['欧洲',8],['澳洲',7],['非洲',6],['南美洲',5],['澳大利亚星人·自动刷',4]] },
  { name:'穿越后的年龄',     opts:[['刚出生的婴儿',3],['11岁是小学生',12],['16岁未成年',10],['刚满18岁',7],['24大好青年',9],['30岁壮年巅峰期',10],['40岁中年人',9],['55岁过半百',16],['66岁老年人',10],['75古稀之年',10],['88岁耄耋之年',5],['99极限斗罗',3]] },
  { name:'穿越后的性别',     opts:[['女',48],['男',40],['武装直升机',7],['不男不女',5]] },
  { name:'穿越后的颜值',     opts:[['E（面目可憎）',16],['咒术回战看多了诞生的咒灵',4],['EX（咒术魅魔）',8],['SSS（倾国倾城）',10],['SS（沉鱼落雁）',12],['S（国色天香）',12],['A（花容月貌）',11],['B（眉清目秀）',9],['C（其貌不扬）',9],['D（尖嘴猴腮）',8]] },
  { name:'道德水平',         opts:[['SS（光明磊落）',16],['SSS（高风亮节）',10],['EX（超凡入圣）',12],['E-（禽兽不如）',12],['E（丧心病狂）',11],['D（恬不知耻）',8],['C（见利忘义）',9],['B（见义勇为）',10],['A（安分守己）',10],['S（乐善好施）',10]] },
  { name:'穿越后的术式天赋', labels:['无下限术式','十种影法术','咒灵操术','无为转变','赤血操术','投射咒法','构筑术式','复制术式','纯体术·无术式'] },
  { name:'穿越后的金手指',   labels:['咒力量十倍','无限咒力','熟知全部剧情','随身咒具库','一次时间回溯','弱化版六眼','主角光环','系统面板','没有金手指'] },
  { name:'最终结局',         labels:['成为最强','与挚友并肩','死在涩谷','被咒灵同化','苟到大结局','改写历史','成为咒灵王','回到原来的世界'] }
];
/* v3 新增的内置转盘（老存档升级时按名字补进来） */

/* v3 新增的内置转盘（老存档升级时按名字补进来） */
const V3_PRESETS = ['穿越后的地点', '穿越后的年龄', '穿越后的性别', '穿越后的颜值', '道德水平'];

function seed(){
  const s = {
    version:STATE_VER, currentId:null,
    wheels: BASE_WHEELS.map(wheelFromDef),
    charts: [],
    settings: Object.assign({}, BASE_SETTINGS),
    history: [], flow: Object.assign({}, BASE_FLOW)
  };
  s.currentId = s.wheels[0].id;
  const byName = n => s.wheels.filter(w => w.name === n)[0];
  const link = (from, to) => { const a = byName(from), b = byName(to); if (a) a.next = b ? b.id : END; };
  const branch = (wName, optLabel, toName) => {
    const w = byName(wName), t = byName(toName);
    if (!w || !t) return;
    const o = w.options.filter(x => x.label === optLabel)[0];
    if (o) o.next = t.id;
  };
  link('穿越后的初始身份', '穿越后的时间点');
  link('穿越后的时间点', '穿越后的地点');
  link('穿越后的地点', '穿越后的年龄');
  link('穿越后的年龄', '穿越后的性别');
  link('穿越后的性别', '穿越后的颜值');
  link('穿越后的颜值', '道德水平');
  link('道德水平', '穿越后的术式天赋');
  link('穿越后的术式天赋', '穿越后的金手指');
  link('穿越后的金手指', '最终结局');
  const last = byName('最终结局'); if (last) last.next = END;
  // 示例分支：不同选项去不同转盘
  branch('穿越后的初始身份', '魂穿原著角色', '穿越后的术式天赋');
  branch('穿越后的初始身份', '咒灵', '最终结局');
  branch('穿越后的初始身份', '普通人', '最终结局');
  s.flow.rootId = s.wheels[0].id;
  return s;
}
/* v2 → v3：把新增的内置转盘补进老存档，并接回原来的链路 */

/* v2 → v3：把新增的内置转盘补进老存档，并接回原来的链路 */
function upgradeToV3(s){
  const have = {};
  s.wheels.forEach(w => { have[w.name] = w; });
  const add = [];
  V3_PRESETS.forEach(name => {
    if (have[name]) return;
    const def = BASE_WHEELS.filter(b => b.name === name)[0];
    if (def) add.push(wheelFromDef(def));
  });
  if (!add.length) return s;
  const anchor = have['穿越后的时间点'];
  const tail = have['穿越后的术式天赋'];
  const at = anchor ? s.wheels.indexOf(anchor) + 1 : s.wheels.length;
  s.wheels.splice.apply(s.wheels, [at, 0].concat(add));
  const oldNext = (anchor && anchor.next) || (tail ? tail.id : END);
  add.forEach((w, i) => { w.next = i < add.length - 1 ? add[i + 1].id : oldNext; });
  if (anchor && (!anchor.next || anchor.next === (tail ? tail.id : END))) anchor.next = add[0].id;
  if (s.flow && !s.flow.rootId && s.wheels.length) s.flow.rootId = s.wheels[0].id;
  return s;
}

function normalize(d){
  const s = {
    version:STATE_VER,
    wheels:[],
    currentId: d && d.currentId,
    settings: Object.assign({}, BASE_SETTINGS, (d && d.settings) || {}),
    history: (d && Array.isArray(d.history)) ? d.history.filter(h => h && h.label) : []
  };
  const ws = (d && Array.isArray(d.wheels)) ? d.wheels : [];
  s.wheels = ws.filter(w => w && typeof w === 'object').map(w => ({
    id: w.id || uid(),
    name: String(w.name == null ? '未命名转盘' : w.name),
    category: WHEEL_CATEGORIES.indexOf(w.category) >= 0 ? w.category : inferWheelCategory(w.name),
    removeAfterPick: !!w.removeAfterPick,
    next: (w.next && typeof w.next === 'string') ? w.next : '',
    branch: !!w.branch,
    grade: (w.grade === true ? true : (w.grade === false ? false : null)),
    /* 多面转盘：multi / faceBy（存 id）/ faces[]（每个面一套 when + options） */
    multi: w.multi === true || (Array.isArray(w.faces) && w.faces.length > 0),
    faceBy: (typeof w.faceBy === 'string') ? w.faceBy : '',
    faces: (Array.isArray(w.faces) ? w.faces : []).map(f => ({
      when: (f && f.when && typeof f.when === 'object') ? f.when : { type:'else' },
      options: ((f && Array.isArray(f.options)) ? f.options : []).map(o => normOption(o))
    })),
    options: (Array.isArray(w.options) ? w.options : []).map(o => normOption(o))
  }));
  if (s.wheels.length) {
    s.currentId = s.wheels[0].id;
    if (d && d.currentId && s.wheels.some(w => w.id === d.currentId)) s.currentId = d.currentId;
  }
  s.settings.duration = clamp(num(s.settings.duration) || 4.2, 1, 12);
  if (!PALETTES[s.settings.palette]) s.settings.palette = 'xuan';
  if (s.settings.theme !== 'dark') s.settings.theme = 'light';
  if (!s.settings.historyLimit) s.settings.historyLimit = 50;
  if (s.settings.autoSave !== false) s.settings.autoSave = true;
  if (s.settings.chartOnEnd !== false) s.settings.chartOnEnd = true;
  if (s.settings.chartMid !== false) s.settings.chartMid = true;      // 老的存档没有 → 默认开
  s.settings.chartDwell = chartDwellSec(s.settings.chartDwell);
  if (!s.settings.chartColor) s.settings.chartColor = 'zhu';
  if (!s.settings.wheelColor) s.settings.wheelColor = 'jin';
  s.settings.wheelAlpha = clamp(num(s.settings.wheelAlpha) || 0.40, 0.05, 1);
  if (!s.settings.spinFx) s.settings.spinFx = 'bounce';
  /* 老存档里的效果名迁移：摇摆 → 2D滚筒，甩出（已移除）→ 颠簸 */
  if (s.settings.spinFx === 'sway') s.settings.spinFx = 'drum2d';
  if (s.settings.spinFx === 'lean') s.settings.spinFx = 'bounce';
  s.lastChart = (d && d.lastChart && Array.isArray(d.lastChart.dims) && d.lastChart.dims.length)
    ? { at: num(d.lastChart.at) || Date.now(), dims: d.lastChart.dims.filter(x => x && x.label) } : null;
  /* 属性维度图：点「新建」时把当时的属性定格成一张图，之后不再改变 */
  s.charts = (d && Array.isArray(d.charts) ? d.charts : [])
    .filter(c => c && Array.isArray(c.dims) && c.dims.length)
    .map((c, i) => ({
      id: c.id || uid(),
      name: String(c.name == null ? ('属性维度图 ' + (i + 1)) : c.name),
      at: num(c.at) || Date.now(),
      after: (typeof c.after === 'string') ? c.after : '',
      dims: c.dims.filter(x => x && x.label).map(x => ({ wheel:String(x.wheel || ''), label:String(x.label), value: num(x.value) }))
    }))
    .slice(-60);
  // v1 → v2：整体换成纸张/手绘皮肤，旧默认配色「鲜艳」一并迁移到「宣纸」
  if (num(d && d.version) < 2 && s.settings.palette === 'vivid') s.settings.palette = 'xuan';
  // v2 → v3：补齐新增的内置转盘（地点 / 年龄 / 性别 / 颜值 / 道德水平）
  if (num(d && d.version) < 3) upgradeToV3(s);
  const f = (d && d.flow && typeof d.flow === 'object') ? d.flow : {};
  s.flow = {
    enabled: f.enabled !== false,
    rootId: typeof f.rootId === 'string' ? f.rootId : '',
    autoJump: f.autoJump !== false,
    autoSpin: !!f.autoSpin,
    delay: clamp(num(f.delay) || 1.6, 0.4, 8),
    path: (Array.isArray(f.path) ? f.path : []).filter(p => p && p.label).slice(-40),
    pendingId:'', retStack:[], paused:false, roundAt:0, grow:{}
  };
  if (s.flow.path.length) s.flow.path.forEach(p => { if (p && typeof p.wheel !== 'string') p.wheel = ''; });
  if (s.flow.rootId && !s.wheels.some(w => w.id === s.flow.rootId)) s.flow.rootId = '';
  return s;
}

function load(){
  let s = null;
  try { const raw = localStorage.getItem(LS_KEY); if (raw) s = normalize(JSON.parse(raw)); } catch(e){ s = null; }
  if (!s || !s.wheels.length) s = seed();
  if (!s.wheels.some(w => w.id === s.currentId)) s.currentId = s.wheels[0].id;
  return s;
}

const storageStatus = { ok:true, at:0, error:'' };

let storageErrorShown = false;

function save(){
  let ok = true;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    if (profileIndex && profileIndex.current) localStorage.setItem(PROFILE_PREFIX + profileIndex.current, JSON.stringify(state));
    storageStatus.ok = true;
    storageStatus.at = Date.now();
    storageStatus.error = '';
    storageErrorShown = false;
  } catch(e) {
    ok = false;
    storageStatus.ok = false;
    storageStatus.error = (e && e.message) || '浏览器拒绝写入';
    if (!storageErrorShown) {
      storageErrorShown = true;
      setTimeout(() => ZW.toast('保存失败：改动目前只在本次会话中，请立即导出备份'), 0);
    }
  }
  ZW.scheduleSync();
  return ok;
}

let saveTimer = null;

function saveSoon(){ clearTimeout(saveTimer); saveTimer = setTimeout(save, 200); }

let state = load();
setRandomSeed(state.settings.randomSeed || '');

let profileIndex = (() => {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_INDEX_KEY) || 'null');
    if (parsed && Array.isArray(parsed.items) && parsed.items.length && parsed.current) return parsed;
  } catch(e){}
  return { current:'default', items:[{ id:'default', name:'默认世界线', updated:Date.now() }] };
})();

const undoStack = [];

function pushUndo(label){
  undoStack.push({ label:String(label || '上一步操作'), raw:JSON.stringify(state) });
  if (undoStack.length > 12) undoStack.shift();
}

function undoLast(){
  const item = undoStack.pop();
  if (!item) { ZW.toast('没有可以撤销的操作'); return false; }
  try { loadState(normalize(JSON.parse(item.raw))); }
  catch(e) { ZW.toast('撤销失败：恢复点已损坏'); return false; }
  setRandomSeed(state.settings.randomSeed || '');
  save(); ZW.applyTheme(); ZW.refreshTitle(); ZW.requestDraw(); ZW.renderFlowBar();
  if (ZW.isOverlayOpen()) ZW.renderSheet('swap');
  ZW.toast('已撤销：' + item.label);
  return true;
}

function undoToast(message){
  ZW.toast(message, { action:'撤销', fn:undoLast });
}

function saveProfileIndex(){
  try { localStorage.setItem(PROFILE_INDEX_KEY, JSON.stringify(profileIndex)); return true; }
  catch(e) { ZW.markStorageFailure(e); return false; }
}

function currentProfile(){
  return profileIndex.items.filter(item => item.id === profileIndex.current)[0] || profileIndex.items[0];
}

function activateProfileState(next){
  loadState(normalize(next));
  setRandomSeed(state.settings.randomSeed || '');
  save(); ZW.applyTheme(); ZW.refreshTitle(); ZW.requestDraw(); ZW.renderFlowBar();
  if (ZW.isOverlayOpen()) ZW.renderSheet('swap');
}

function switchProfile(id){
  const target = profileIndex.items.filter(item => item.id === id)[0];
  if (!target || target.id === profileIndex.current) return true;
  if (!save()) return false;
  let next = null;
  try { const raw = localStorage.getItem(PROFILE_PREFIX + target.id); if (raw) next = JSON.parse(raw); } catch(e){}
  profileIndex.current = target.id; target.updated = Date.now(); saveProfileIndex();
  activateProfileState(next || seed());
  ZW.toast('已切换到「' + target.name + '」');
  return true;
}

async function addProfile(){
  const name = await ZW.askDialog({ title:'新建世界线', desc:'创建一份独立的默认转盘、历史和成长记录。', value:'新世界线', ok:'创建' });
  if (name === null) return false;
  if (!save()) return false;
  const id = uid();
  const item = { id, name:String(name).trim() || '新世界线', updated:Date.now() };
  profileIndex.items.push(item); profileIndex.current = id; saveProfileIndex();
  activateProfileState(seed());
  ZW.toast('已创建「' + item.name + '」');
  return true;
}

async function renameProfile(){
  const item = currentProfile();
  const name = await ZW.askDialog({ title:'重命名世界线', value:item.name, ok:'保存' });
  if (name === null) return false;
  item.name = String(name).trim() || item.name; item.updated = Date.now(); saveProfileIndex(); ZW.renderSheet('swap');
  return true;
}

async function deleteProfile(){
  if (profileIndex.items.length <= 1) { ZW.toast('至少保留一条世界线'); return false; }
  const item = currentProfile();
  const confirmed = await ZW.askDialog({ title:'删除世界线', desc:'确定删除「' + item.name + '」及其独立记录？', ok:'删除', danger:true });
  if (!confirmed) return false;
  try { localStorage.removeItem(PROFILE_PREFIX + item.id); } catch(e){}
  profileIndex.items = profileIndex.items.filter(x => x.id !== item.id);
  profileIndex.current = profileIndex.items[0].id; saveProfileIndex();
  let next = null;
  try { const raw = localStorage.getItem(PROFILE_PREFIX + profileIndex.current); if (raw) next = JSON.parse(raw); } catch(e){}
  activateProfileState(next || seed());
  ZW.toast('世界线已删除');
  return true;
}
/* js/util.js 的 colorOf 需要知道当前调色板；它不认识 state，所以从这里注入 */
usePalette(() => state && state.settings ? state.settings.palette : 'xuan');
/* 声音模块同理：音效 / 震动开关也从这里喂进去 */
useAudioConfig({ sound: () => !!(state && state.settings && state.settings.sound),
                 vibrate: () => !!(state && state.settings && state.settings.vibrate) });

function addHistory(w, label){
  state.history.unshift({ id:uid(), wheelId:w.id, wheel:w.name, label:label, at:Date.now() });
  const lim = Math.max(10, num(state.settings.historyLimit) || 50);
  state.history = state.history.slice(0, lim);
  saveSoon();
}

Object.assign(ZW, { chartDwellSec, LS_KEY, HINT_KEY, RECOVERY_KEY, PROFILE_INDEX_KEY, PROFILE_PREFIX, BASE_SETTINGS, CHART_DWELL_MIN, CHART_DWELL_MAX, CHART_DWELL_DEF, STATE_VER, BASE_FLOW, BASE_WHEELS, V3_PRESETS, seed, upgradeToV3, normalize, load, storageStatus, storageErrorShown, save, saveTimer, saveSoon, state, profileIndex, undoStack, pushUndo, undoLast, undoToast, saveProfileIndex, currentProfile, activateProfileState, switchProfile, addProfile, renameProfile, deleteProfile, addHistory, loadState, storageErrorReset });
})();
