/* ============================================================================
   咒术转盘 · 共享状态盒
   —— 只放「多个模块都要读写」的运行时变量。目前主要就是转盘角度 rot。

   为什么需要它：rot 由 js/spin.js 的动画循环每帧改写，而 js/spin.js 和主逻辑
   里的绘制都要读它 —— 拆成模块之后两者不在同一个作用域里，所以放到这里共享。

   存档数据 state 和界面状态 ui 不在这里：它们由主逻辑持有
   （还牵涉 localStorage 序列化等），其它模块通过注入的钩子访问。

   ⚠️ rot 是**弧度**，而且旋转时每帧变化几十度。
      任何用 sin(rot)/cos(rot) 做的视觉效果都要降频、或改按时间驱动，
      否则时间欠采样会一顿一顿的（这个坑踩过）。
   ============================================================================ */
(function(){
'use strict';

const store = {
  rot: 0,            // 转盘当前角度（弧度）
  spinning: false,   // 正在旋转中（防重复触发）
  drawQueued: false, // 是否已经排了一帧重绘
  wheelSize: 0,      // 转盘画布的逻辑边长（CSS 像素）
  fxDur: 4.2,        // 本次旋转时长（秒）：animateSpin 写入、物理效果读取
  fxReduced: false   // 系统是否开了「减少动态效果」
};

/* 用 getter/setter 包一层：读写 ZW.core.rot 和读写一个普通变量手感一样 */
const core = {};
Object.keys(store).forEach(k => {
  Object.defineProperty(core, k, {
    enumerable: true,
    get(){ return store[k]; },
    set(v){ store[k] = v; }
  });
});

ZW.core = core;
ZW.coreStore = store;          // 调试用：直接看原始值
})();
