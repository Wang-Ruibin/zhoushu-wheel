# _dev —— 开发/调试用（和网页本身无关）

这里的文件**不会**被 `index.html` 加载，删掉也完全不影响双击打开网页。
它们只在改代码时用：改完跑一遍，看有没有把原来能用的东西弄坏。

## 一行命令跑全部检查

```bash
node _dev/run.js
```

它会依次做五件事（任何一项挂了退出码都是 1）：

| 步骤 | 检查什么 |
| --- | --- |
| 语法 | 抽出 `index.html` 里的内联 `<script>`，用 `vm.Script` 编译（不执行） |
| CSS | `app.css` 括号配平 + 有没有「孤立声明块」（选择器被删掉、只剩属性） |
| 死 action | `handleAction` 里每个 `case` 都要有 `data-act` 入口；每个 `data-act` 都要有 `case` |
| 模块符号 | `symbolscan.js`：模块私有 / 忘了转发的名字（拆模块最容易出的错） |
| 测试 | 跑下面所有的 `t*.js` |

## 各个文件在干嘛

| 文件 | 作用 |
| --- | --- |
| `harness.js` | **核心**：桩掉 `document` / canvas / `history` / `localStorage`，在 Node 里跑整个应用 |
| `run.js` | 一键回归（上面那个） |
| `actions.js` | 死 action 双向检查（可以单独跑） |
| `symbolscan.js` | 模块符号扫描（可以单独跑） |
| `csslint.js` | CSS 结构检查（可以单独跑，输出比 `run.js` 详细） |
| `collect.js` | 起个小 http 服务收页面 POST 上来的诊断 JSON（无头浏览器调试用） |
| `t4_e2e.js` | 维度图自动弹出 / 自动收起 / 停留时长 / 各种开关（24 条） |
| `t6_interrupt.js` | 用户中途插手（自己关图、开面板、切转盘）时流程不能卡住（17 条） |
| `t7_real_spin.js` | 真调 `spin()` 转一轮 → 弹图 → 自动收起 → 跳下一站（13 条） |
| `t8_draw.js` | `drawRadar()` 本身画得对不对 + 位置语义（18 条） |
| `t9_modules.js` | 模块结构：插件顺序、`ZW` 导出、注入、色板解析、启动链（52 条） |
| `t10_chart.js` | ★ **维度图显示整条链路**：`navTo('chart')` → `viewChart` → rAF → `startChartAnim` → `drawRadar`（27 条） |
| `t11_views.js` | ★ **每个视图 × 每个标签都渲染一遍**，断言内容非空、关键元素都在（27 条） |
| `t12_growth.js` | ★ **成长 → 维度图**：哪些选项算成长、成长后两张图都要体现、封顶、变形起点、位置语义（24 条） |
| `t13_multi.js` | ★ **多面转盘**：条件判定、逐档边界、成长改变分面、文件往返、界面渲染、面管理动作（71 条） |
| `t14_faceedit.js` | ★ **面里编辑要存得住**：每个输入字段真打字 → 切页面/关面板/重建实例 → 内容还在；两个面互不串味（24 条） |

> **`t10`~`t14` 是怎么来的**：四次线上事故 + 一次新功能，各催生了一个或几个。
> · 只有 `t8`（直接调 `drawRadar`）时，`startChartAnim` 里的 `ReferenceError` 没人挡 → `t10`
> · 只有状态层测试时，`tabHistory()` 被误删没人挡 → `t11`
> · 只测了 `dimsUpTo` 那条路径，`chartDims()` 漏掉成长没人挡 → `t12`
> · 新功能配套 → `t13`（当场抓出 `faceBy` id/名字不一致）
> · 多面转盘"打字存不住"没人挡 → `t14`
> **规律：一个函数只要"能没人碰过"，它坏掉就没人知道。测试要覆盖到"调用链最外层"——
> 真实的入口 → 真实的视图 → 真实的绘制，而不是只调内部小函数。**
> 另外两条：
> · **同一件事有两处实现时（两条数据路径），两条都要测**
> · **数据从"一层"变成"多层"时（`options` → 兜底面 + `faces[].options`），
>   所有"按 id 定位对象"的路径都要重查**：读、写、删、跳转、批量、复制、清空

## 桩的三条红线（踩过，别再犯）

测试替身"太假"会**掩盖**真 bug —— 上次就是这样：

| 桩的失真 | 后果 |
| --- | --- |
| `$('#chartCv')` 查不到动态写进 `innerHTML` 的元素 | `startChartAnim()` 根本不会被调用，图永远画不出来，而测试还以为"打开面板成功" |
| canvas 没有 `width`/`height` 属性 | `drawRadar()` 拿不到尺寸 |
| `<script src>` 的 `onload` 不触发 | `boot()` **从来不执行**（图标 / fitWheel / 启动小字 / 读数据文件全没跑） |

现在这三个都补齐了：`innerHTML` 会真的解析并挂进文档树、canvas 有 `width`/`height`
（`getContext` 会**记录绘制调用**，所以能断言"真的画了东西"）、`<script src>` 会真的
从磁盘读 `转盘/*.js` 并在同一个沙箱里执行、触发 onload/onerror。

**写新测试时的规矩**：
- 断言要能区分「没抛错」和「真的做了事」——优先断言**副作用**（画了多少笔、状态变没变）
- 别用 `try { x() } catch {}` 把错误吞掉；harness 会把定时器里的异常打到 stderr
- 桩的行为要"像真的"，别图省事返回 `null` 了事

## harness 怎么用（写新测试时抄 t9_modules.js / t10_chart.js）

```js
const { loadApp } = require('./harness');
const app = loadApp();                        // 跑一遍整个应用（含 js/*.js 插件）
const T = app.T;                              // 内部函数与状态都挂在 T 上
const s = T.state();                          // 存档对象（可直接改，造场景用）

await app.drainAsync(1000);                   // 推进虚拟时间 1000ms（定时器 + rAF 都走虚拟时钟）
await app.settle();                           // 让挂着的微任务链跑完（数据文件加载要它）
app.byId['#toast']                            // 取 DOM 桩节点
app.byId['#sheet'].querySelector('#chartCv')  // 面板里动态生成的节点也能查到
app.sandbox.ZW                                // 看命名空间
```

**loadApp 的选项**：

| 选项 | 作用 |
| --- | --- |
| `preload: { 'zhoushu-wheel.v1': JSON.stringify(obj) }` | 预置 localStorage（模拟"浏览器里已经有存档"）—— 会走 `load()` → `normalize()` 这条路 |
| `withWheelFiles: true` | 真的读 `转盘/*.js`（默认**不读**，用内置的 10 个转盘保证确定性） |
| `html: '<另一份 index.html 的内容>'` | 换一份源码来跑（调试时插日志用，不用改真文件） |
| `trace: true` / `sandbox.__traceScript = true` | 打印定时器 / 脚本加载日志 |

**要点**：

- **虚拟时钟**：`setTimeout` / `requestAnimationFrame` / `performance.now()` 全走 `app.drain(ms)` /
  `drainAsync(ms)` 推进的虚拟时间。`drainAsync` 会顺手把微任务跑完，所以带 `await` 的代码
  （比如 `switchTo`）要用它。
- **插件加载顺序严格照 `index.html` 里的 `<script src>`**（不是按文件名排序）。
  顺序猜错会出「`ZW.norm is not a function`」这种看着莫名其妙的错 —— harness 会直接报错提示。
- **`await app.drainAsync(N)` 之后不一定"都跑完了"**：像数据文件加载那种
  「onload → 再 append → 再 onload」的链条要再 `await app.settle()`。

## 浏览器端验证（可选）

无头 Edge 截图能看整体样子，但**遮罩面板（`.overlay`）在无头环境下不会真正绘制**
（`backdrop-filter` + 虚拟时间下 CSS 过渡不推进），所以「维度图弹出来长什么样」这一条
只能靠上面的 `t4/t6/t7`（状态层面）+ 自己在真实浏览器里点一遍。截图主要用来看排版：

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu `
  --hide-scrollbars --window-size=440,900 --virtual-time-budget=3000 `
  --screenshot="$env:TEMP\shot.png" "file:///$((Get-Location).Path -replace '\\','/')/index.html"
```

- ⚠️ `--window-size` 的高度要和内容高度对上，否则 `position:fixed` 的元素会落到截图外面
- ⚠️ CSS 动画 / 过渡在虚拟时间下不推进，会拍到动画中间态
