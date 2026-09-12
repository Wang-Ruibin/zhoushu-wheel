# Jujutsu Wheel (咒术转盘)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-gxnatri.top-8A2BE2)](https://gxnatri.top/)

**English** | [简体中文](README.zh-CN.md)

A hand-drawn, paper-textured spin-wheel app with branching flows, grade/attribute systems, growth mechanics, and an attribute radar chart drawn on a dharma wheel. **Double-click `index.html` and it just works** — no network, no install, no server. All data lives in your browser (localStorage); build your own wheels, edit options, and wire branch flows by dragging.

**Play it online**: <https://gxnatri.top/> (same code as this repository)

> This is a non-commercial fan project. Wheel content design is credited in [Section 12](#12-credits).

---

## 1. Getting Started

| Scenario | How |
| --- | --- |
| Desktop | Double-click `index.html` (Edge / Chrome recommended) |
| Phone | Send `index.html` to your phone (e.g. WeChat "File Transfer"), open it in a browser; or host the folder on any static site / LAN server |
| Add to home screen | Use the browser menu's "Add to Home Screen" — it becomes a fullscreen mini-app whose back gesture pops panels one by one |

> Zero dependencies: the whole app is `index.html` plus `app.css` and `js/` — copy the folder and it runs anywhere.

---

## 2. Wheel Data Files (one file per wheel)

The `转盘/` folder holds **one data file per wheel**. They are loaded automatically when you open `index.html` — edit a file, refresh the page, done.

```
咒术转盘/
├─ index.html        ← double-click this
├─ app.css           ← styles
├─ js/               ← program (small modules loaded in order — don't reorder)
│   ├─ _ns.js  util.js  core.js  icons.js  sound.js  spin.js  multi.js
└─ 转盘/
   ├─ _index.js                 ← manifest: wheel order (also the "follow list order" flow order)
   ├─ 01-穿越后的初始身份.js
   ├─ 02-穿越后的时间点.js
   ├─ ...
   └─ 10-最终结局.js
```

> If you want to hack on the code: `js/_ns.js` creates the namespace, `js/util.js` holds utilities and palettes, `js/spin.js` the spin physics, `js/sound.js` audio, `js/multi.js` multi-face logic; everything else lives in the inline script inside `index.html`. After changes, run `node _dev/run.js` to check nothing broke.

Each file is plain JSON plus one registration call — edit it in any text editor:

```js
/* Jujutsu Wheel · single wheel data file
   Wheel name: 穿越后的初始身份 (initial identity after transmigration)
   "next" accepts a wheel name (where to go next), "结束" (end the flow), or nothing (stay)
   "weight" controls sector size and probability (default 1); "color" pins a sector color like "#B23A2F" */
window.__ZW_REGISTER({
  "name": "穿越后的初始身份",
  "next": "穿越后的时间点",
  "removeAfterPick": false,
  "options": [
    { "label": "咒术师" },
    { "label": "咒灵", "next": "最终结局" },
    { "label": "五条悟", "weight": 3, "color": "#B23A2F" }
  ]
});
```

| Field | Meaning |
| --- | --- |
| `order` | Position of this wheel (1-based). **Rewritten by the app when you reorder on the page**; editing the number by hand also reorders |
| `name` | Wheel name |
| `next` | Default next stop: another **wheel name** / `"结束"` (end) / `"留在本盘"` (stay); missing = stay |
| `branch` | `true` marks a **branch wheel** (excluded from the default order, reachable only via option jumps) — see Section 6 |
| `removeAfterPick` | Remove the picked option from the wheel |
| `options[].label` | Option text |
| `options[].weight` | Weight (sector size = probability), default 1 |
| `options[].color` | Pin a sector color; omit to follow the theme palette |
| `options[].next` | Where this option goes when picked (overrides the wheel's `next`) |

**Why `.js` files instead of `.json`**: when opened via `file://`, browsers block `fetch` of local JSON (CORS) but allow `<script src>` — so each file is "JSON + one registration call". It stays double-clickable and still edits like plain JSON. If you prefer pure `.json` for other tooling, ask and a variant can be added.

**Where order lives** (all three places, kept in sync when reordering)

1. The `"order": N` field inside each file, plus its header comment
2. The filename prefix `01-` `02-` … (renamed to match the new order)
3. The "current order" list in `_index.js` header comments + the array itself

So after you reorder wheels on the page (having granted folder access), all of these update automatically; conversely, edit `order` by hand and click "Reload from files" to push it into the page.

**Page edits ↔ data files, how they sync**

| Scenario | Behavior |
| --- | --- |
| Add / delete / edit on the page (options, wheels, order, branches…) | **Saved to the browser immediately** (survives refresh; never overwritten by files) |
| After granting the `转盘/` folder (Settings → "Save to folder", once) | Every change is **written back to the files after 900ms**; deleted wheels have their files removed too |
| No grant yet | Changes stay in the browser; a one-time hint points you to Settings; nothing is lost |
| Overwrite the page from files (e.g. after hand-editing .js) | Click "Reload from files" |

| Button / switch | Effect |
| --- | --- |
| Auto write-back to the `转盘/` folder | **On by default.** After the grant, changes land in the data files automatically |
| Save to folder | Pick the directory once and do a full write-back (Edge/Chrome; falls back to per-file download otherwise) |
| Reload from files | Replace the page's wheels with the folder contents (asks first) |

> On first open (no browser data yet), the app seeds itself from the `转盘/` folder.
> New wheels: create them on the page, or copy a data file, rename it, add the filename to `转盘/_index.js` (one line), then "Reload from files".
> If the folder can't be read (e.g. only `index.html` was copied to a phone), the app silently falls back to the built-in copy of the data.

---

## 3. UI Tour (matching the screenshots)

```
┌──────────────────────────────────┐
│ 咒   ☰  穿越后的初始身份  ⌄        │ ← seal + pill: tap to switch wheels
│ ⟲  初始身份·咒术师 › 时间点  → …  │ ← flow bar (appears in branch flows)
│                                  │
│              咒骸                 │ ← draw result (tap to open actions)
│                                  │
│            ╭────────╮            │
│           ╱   wheel   ╲          │ ← tap the wheel = spin
│            ╲          ╱          │
│            ╰────────╯            │
│                                  │
│   ⚙︎                                     ✎   │ ← left: settings & history; right: edit options
└──────────────────────────────────┘
```

- **Seal + pill at the top**: the 「咒」 seal is decorative; the pill opens the **Wheels** page — switch, rename, reorder, duplicate, delete in one place; **tap a wheel's name** to manage its options.
- **Big center text**: the picked result in Kai (regular script); while spinning it **follows the pointer live** — whatever sector the pointer crosses shows here; text over 7 characters shrinks automatically and freezes on landing.
- **Tap the result** (not while spinning) opens the result panel: copy / go to next stop / spin again / remove the option from the wheel.
- **Wheel**: pointer fixed at 12 o'clock; the hub is a **tiny needle tip** colored like the hub disc (ivory on light, ink on dark) with a hairline ink outline so it reads on any sector; the rim is **hand-drawn ink** (fixed-seed, no per-frame jitter); sectors run clockwise from 12 o'clock.
- **Bottom-left ⚙︎**: opens the management panel's Settings tab; **bottom-right ✎**: edits the **current** wheel's options (same as tapping its name on the Wheels page).
- Spin: **tap the wheel** or press **Space** (when no panel is open); **Esc** pops back one layer. The old "Spin" button is gone — only the two round buttons remain.

Each pick shows a toast "Picked: xxx" with a Copy button; with "remove after pick" on, the option is also deleted from the wheel.

---

## 4. Page Hierarchy & Back Logic

The app is **one hub + one back stack**, with no crossing entries:

```
Home ──┬─ Wheels (fullscreen list: switch + rename/reorder/duplicate/delete)
       │      └─ Option editor (detail page of one wheel; back returns to the list)
       │              └─ Bulk edit (sub-page)
       │              └─ Jump target picker (sub-page)
       ├─ Settings / History (other tabs of the same panel)
       └─ Result (bottom sheet)
```

| Action | Behavior |
| --- | --- |
| ⚙ / top pill | Land directly on Settings / Wheels — no drilling |
| ✎ (bottom-right) | Edit the **current** wheel's options directly |
| Switching tabs inside the panel | Also a stack layer: back returns to the previous tab, then closes |
| Option editor page | **Not a tab** — only reachable by tapping a wheel's name; back always returns to that list |
| Browser back / Android back gesture / Esc | Same logic as in-app back: **pop one layer at a time**, never exits the page outright |
| ✕ close | Clears all entries pushed this session in one go; no "dead" back presses afterwards |
| Scroll position | Long lists stay put after toggling a switch or finishing a drag; no jump to top |

---

## 5. Managing Wheels & Options

The management panel has 3 tabs: **Wheels / Settings / History**; the option editor is a detail page reached by tapping a wheel's name.

**Wheels** (直达 via the top pill; merges "pick a wheel" and "manage wheels")

Each row looks like:

```
● 穿越后的初始身份           [branch]  9 items  ›   ← tap the row = open its option editor
  [in use]  [✎ rename]  [↑]  [↓]  [duplicate]  [delete]  ← actions
```

- **Tap the row** → that wheel's **option editor**; back returns here
- `[branch]` → mark as a **branch wheel** (red = marked), see Section 6
- `switch` / `in use`: make it the home wheel (red highlight = current)
- `✎`: rename (syncs into the data file)
- `↑` `↓`: reorder (this order is also the "follow list order" flow)
- `duplicate` is handy for series of similar wheels; `delete` keeps at least one
- Color dot: the wheel's first option's color, for quick recognition
- "＋ New wheel" jumps straight into option editing

**Option editor** (tap a wheel's name on the Wheels page; bottom-right ✎ goes to the current wheel)

- The "editing" row on top switches which wheel you're editing; its `✎` renames that wheel
- Each row: `swatch` (tap to set a color, `A` to follow the theme) · `text` · `weight` · `delete`
- Toolbar: `Add option` / `Bulk edit` / `Shuffle` / `Recolor` / `Clear`
- "Remove picked option from wheel" switch: great for draws, roll calls, group assignment

**Bulk edit**: one option per line, weight via `name*weight`:

```
五条悟*3
虎杖悠仁
伏黑惠*2
钉崎野蔷薇
```

`*`, `×`, `x`, `,number` all parse as weight; missing = 1. Choose "replace" or "append".

**How weights work**: sector area splits proportionally — bigger weight, bigger sector, higher chance; `0` disables (hidden, never picked). What you see is what you get: wherever the pointer stops is the result; there is no hidden probability table.

Below each option sits a `→ jump target` row (next section): set "where this option goes when picked"; unset follows the wheel's default next stop.

---

## 6. Branch Flows: auto-advance to the next wheel

Configured in each wheel's **option editor** (the `→` row under each option, and the "default next stop" at the top); global switches live in Settings.

**How to set targets** — in the option editor:

1. **Option-level**: the `→ …` row under an option — "when this is picked, go to which wheel" (or "stay / end the flow").
2. **Wheel-level**: the "default next stop" row on top — applies to all other options.
3. **Neither**: follow the **list order** of the Wheels page — sort the list and the flow runs by itself.

**Three-level priority: option target → default next stop → list order**

| Where | Meaning |
| --- | --- |
| The option's own jump target | Highest: this option always goes somewhere specific (e.g. 「咒灵」 in the identity wheel → straight to the ending wheel) |
| The wheel's default next stop | All other options (e.g. identity → time point) |
| **Neither set** | **Follow the Wheels-page list order** (branch wheels skipped) — the list order is the default flow; gaps never stall it |
| Last in list + nothing set | Flow ends |
| `End flow` / `Stay` | Explicit finish / explicit stay (must be set explicitly to stay) |

The UI always tells you where you'd actually go: the "default next stop" row and each option's `→` row show the resolved target (e.g. "follow list order → 穿越后的初始身份").

**Branch wheels (interludes outside the default order)**

Tap `[branch]` on a wheel's row to mark it (red). Rules:

1. **Not in the default order**: "follow list order" skips it; its own default next stop is cleared; nothing points at it implicitly.
2. **Entered only via branches**: some option's jump target must point at it.
3. **After spinning, rejoin the origin's default order**: if the picked option has no own target —
   - the origin wheel's **default next stop** (if set, and not itself)
   - unset / self / another branch wheel → walk the **list order** forward to the next ordinary wheel (never stuck, never loops back into itself)
   - origin explicitly `结束` → flow ends

```
初始身份 ──default──▶ 时间点 ──default──▶ 地点 …      (mainline; branch wheels not in it)
   └ picked 「咒灵」──▶ 〔死亡结局 · branch wheel〕
                        ├ picked 「被宿傩夺舍」──▶ 最终结局      (option-level target)
                        └ anything else ──▶ back to identity's default next stop = 时间点
```

Nesting works (a branch wheel can branch into another); after finishing, the flow unwinds layer by layer back to the nearest mainline; the flow bar shows the whole trail.

**Loop protection**: if configuration forms a cycle (e.g. a wheel whose default next stop is itself), staying on the same wheel 12 times in a row **pauses** auto-advance; the flow bar shows `⏸ paused · resume`. Resuming, switching wheels manually, or "restart" all clear it. The old behavior of permanently disabling the auto-advance switch is gone.

**Flow switches** at the top of Settings: use branch flows / auto-advance after a pick / dwell time / auto-spin after jumping / **pop up radar charts mid-flow** / **chart dwell** / show the attribute chart when the flow ends, plus the **start wheel** and "clear all connections".

**Passing a radar-chart slot mid-flow**

If a slot holds an attribute radar chart (Section 7):

1. After the pick, wait **0.65s** (let the win animation finish) → **the chart pops up**
2. Stay **3.4s** (adjustable 1–15s in Settings); the toast counts down; "continue now" skips
3. Auto-dismiss → **continue to the next stop**

Don't want interruptions: turn off "pop up radar charts mid-flow" (mid-flow popups and the **end-of-flow** chart are **two independent switches**).
Manual mode (auto-advance off) never auto-pops either — no attention grabbing.
If you close the chart yourself or another panel is open, the flow still continues; it never stalls.

**Two switches, two jobs (independent)**

The "Branch" page top is a three-part toggle: master switch + two indented sub-switches, with a live mode line below.

| Switch | Effect | Default |
| --- | --- | --- |
| Use branch flows | Master: off = fully inert (no path recording, no jumps) | on |
| Auto-advance after a pick | Walk to the next stop automatically | on |
| Auto-spin the next wheel | After jumping, **spin again automatically** — chain runs | **off** |

So the default is "**jump but don't spin**": arrive at the next stop and stop, result area resets to `？`, waiting for your tap (or Space).
The mode line shows four states live: jump-only / full auto chain / manual / branch flows off.

**What it looks like running**

- After a pick the flow bar appears: `⟲ | 初始身份·咒术师 › 时间点 | → 术式天赋`; the last red pill is the current wheel, `→ xxx` the next stop.
- Idle 7s, the bar collapses to a small pill (`初始身份 · step 2`); tap to re-expand.
- After **1.6s** (adjustable 0.4–5s) it auto-advances; the result resets to `？`; tap `→ xxx` to go immediately.
- Only with "auto-spin the next wheel" on does the whole tree run itself to the end — good for continuous story runs.
- History pills on the bar are tappable — **jump back to that step and redo** (path beyond is truncated); the leftmost ⟲ restarts from the start wheel.
- Turn off "auto-advance" for manual mode: it only suggests the next stop; you decide when to go.

---

## 6.5 Multi-Face Wheels: one wheel, content that depends on earlier results

**The problem**: some wheels only make sense given earlier draws.
E.g. 「声望」(reputation) — with high morality EX is **超凡入圣** (saintly) and S is **家喻户晓** (household name);
with low morality EX becomes **婴儿止啼** (baby-silencing) and S **臭名昭著** (notorious).

**vs. branch wheels** (the two are easy to confuse):

| | Branch wheel | **Multi-face wheel** |
| --- | --- | --- |
| What changes | **Where the flow goes** | **What this wheel itself shows** |
| In the default order? | No (only reachable via jumps) | **Yes**, freely positioned like any wheel |

**How to use**:

1. On the Wheels page, tap a wheel's `multi` marker → it becomes multi-face (a "face-by" wheel is auto-guessed; correct it if wrong)
2. Open **Manage faces / conditions…**, pick the **face-by wheel** (e.g. 「道德水平」 morality)
3. **Add a face**, set its condition: choose "grade ≥", tap `A` — this face covers "morality A and above"
4. Tap `Contents` on the face to edit its options (the usual editor: single edits / bulk / drag-reorder)
5. Add another face, condition "grade ≤ B", fill in the low-morality set
6. The bottom **fallback face** = used when no condition matches (e.g. morality not drawn yet). It's the plain `options`

**Rules**:

- First match wins top-down → **face order is priority** (reorder with ↑↓)
- Conditions evaluate against the **post-growth** result — growth lifting morality from B to A switches reputation to the high-morality face automatically
- Face-by wheel **not drawn yet** → grade conditions all miss → fallback face
- Spins use the **currently matched face**'s options, not the fallback's

**Available conditions** (tap "edit condition" in face management):

| Condition | Example | Meaning |
| --- | --- | --- |
| grade ≥ | `A` | drawn grade is A or higher (order `E- E D C B A S SS SSS EX`) |
| grade ≤ | `B` | drawn grade is B or lower |
| grade = | `S` | exactly this grade |
| result = | `S（乐善好施）` | drawn text exactly equal |
| result contains | `乐善` | drawn text contains this |
| otherwise | — | the "else" — usually last |

When the current wheel is multi-face, the flow bar marks which face is active (e.g. `声望 · 等级 ≥ A`).

**Hand-editing data files** works too — format in the comments of `转盘/*.js`:

```js
"multi": true,
"faceBy": "道德水平",                       // face-by wheel (by name)
"faces": [
  { "when": { "type":"gradeAtLeast", "value":"A" }, "options": [ { "label":"EX（超凡入圣）" } ] },
  { "when": { "type":"gradeAtMost",  "value":"B" }, "options": [ { "label":"EX（婴儿止啼）" } ] }
],
"options": [ { "label":"（fallback）默默无闻" } ]
```

---

## 7. Attribute Radar Chart (grades → radar)

Wheels whose options are mostly **E- / E / D / C / B / A / S / SS / SSS / EX** grade labels are auto-detected as **attribute wheels**; each attribute wheel's **latest** drawn grade is aggregated into a radar chart (score = grade × 10).

**Create anytime**: no need to finish drawing first. On the Wheels page (or History) tap "New attribute radar chart", choose a **scope** — "up to a certain wheel" or "all wheels"; every attribute wheel in scope counts, **undrawn = 0**. Once generated, the chart is **frozen** and no longer tracks changes.

**Where it sits**: by its chosen scope it's **inserted into the Wheels-page list** (e.g. scope "up to 道德水平" puts it right after that row, with a cinnabar edge and a "chart" badge); "all wheels" charts sit after every wheel. View / delete anytime.

**Morph animation**: creating another chart morphs it **from the previous shape** (each axis grows old→new); the first one grows from center 0.

```
              道德水平  SS · 80
                  ／＼
    咒力效率 E-·17 ／    ＼ 穿越后的颜值 A · 60
    咒力操纵 S·70  ＼    ／ 咒力总量   EX · 100
                  ＼／
              体术水平  B · 50
        本局已抽 6 项 · 平均 63
```

- **Growth shows up in charts**: grades raised by growth wheels add onto the attribute; both chart kinds compute identically
- **The panel is just the chart**: name, chart, close — labels read "wheel name + grade"

> ⚠️ A known semantic subtlety: growth counts **cumulatively for the whole run**, regardless of which step it happened on.
> So a chart placed *before* a growth wheel still **grows** with it (effectively "totals as of now, including all growth so far").
> If you want it strictly frozen at "that moment", say so — the fix touches the save schema.

- **One entry point**: management panel → History → "New attribute radar chart" / the generated list (tap name to view, 🗑 to delete)
- **Flow passing its slot auto-pops it**: after a pick wait 0.65s → pop → stay 3.4s (adjustable) → dismiss → continue. Switch and duration in Settings → Flow (see end of Section 6)
- **A clean radar chart**: only name, chart, close — labels show "wheel + grade", no numbers
- **Spin physics**: pick in Settings, five options; implemented as per-frame `transform` on the wheel container, amplitude converging with progress, with a 0.34s settle transition. **3D tumble** uses `perspective(560px) + rotate3d()`: the tilt flips outward once per revolution (24°), the tilt axis orbits at 0.45× speed (coin-wobble feel), plus `rotateY` and 5% perspective scaling; **2D tumble** is a flat elliptical path (±26px horizontal, ≈±19px vertical) with slight twist. Phase advances at **fixed revolutions per second** (`FX_2D_TURNS_PER_SEC = 1.5` with a 1.35 ease-out), so: ① tumble speed **decouples from the wheel's own turns** (8 or 20 turns both tumble at ≈1.4 rev/s); ② per-frame phase moves only a dozen-some degrees, so the path is continuous (driving it off the spin angle undersamples into a few fixed bearings and looks jumpy). **3D tumble** likewise: time-driven phase (`FX_3D_TURNS_PER_SEC = 1.1`, same 1.35 ease-out), tilt/axis/`rotateY`/perspective each move a few degrees per frame — continuous volumetric rolling (an earlier version keyed phase to the spin angle and it undersampled into stutter). Old saves that picked "swing / fling" migrate automatically to 2D tumble / bumpy.
- **Presentation**: the panel is **centered** (no longer a bottom drawer), the chart **as large as possible** (~3/4 of viewport height on phones), labels outside the EX ring so overflowing vertices never collide
- **Delete / create live in the History list** (no extra buttons in the chart panel)
- **Animation**: first chart grows from **center 0** to its values; from the second on, it morphs from the previous shape (easeOutCubic, ≈1s)

**Dharma-wheel background**: the radar is drawn on a dharma wheel — **eight spokes** for eight directions, the **outer ring exactly on the SSS value**, the **eight outer beads' centers exactly on the EX value** (one ring out), one more bead at the center; its color is set separately in "Settings → dharma color". Every open, the wheel **clicks 45° counter-clockwise** (8 detents, quick-then-stop ratchet feel). The ratchet sound is taken from the first **0–3s** of the Bilibili **魔虚罗 sound-effects clip** [BV1KF3S62EaK](https://www.bilibili.com/video/BV1KF3S62EaK), converted to an 18KB mp3 and **embedded base64 in `js/sound.js`** (still fully offline, no external requests, nothing distributed beyond the repo). If decoding fails or the data is missing, it falls back to a built-in Web Audio synthesized ratchet.

- **Colors**: "Settings → chart color" (cinnabar / ink / indigo / ochre-gold / moss / aster); redraws immediately
- **Scale & scores**: outer ring = **SSS**, dashed ring = **EX** (one ring overflow); score = grade × 10 — E- 17, E 20, D 30, C 40, B 50, A 60, S 70, SS 80, SSS 90, EX 100; `+ / -` recognized too (S+ = 73)
- **What counts as an attribute wheel**: wheels where ≥60% of options are grade labels are auto-included ("attribute" badge in the list); per wheel you can force include/exclude via the "count in attribute chart" switch in its option editor, then "restore auto" to go back
- **Which draw counts**: the attribute wheel's **latest** result this run; if not drawn this run, the most recent history entry; none = 0
- The grade setting is written into data files (`"grade": true` / `false`; absent = auto)

---

## 8. Global Settings

| Setting | Notes |
| --- | --- |
| Palette | **Rice paper** (default; cinnabar/ochre/gamboge/stone-green/azurite/dai-purple traditional palette) / vivid / macaron / morandi / neon / ink |
| Appearance | Light (paper) / dark (ink night), both with paper grain and hand-drawn strokes |
| Chart color | Cinnabar (default) / ink / indigo / ochre-gold / moss / aster — stroke, fill and grade text of the radar chart |
| Dharma color | Same six, **separate from chart color** (default ochre-gold = brass) |
| Spin physics | **Steady** (no wobble) / **Bumpy** (default; like a wheel over pebbles, slight squash on landing) / **2D tumble** (continuous flat orbit, ±26px) / **3D tumble** (per-rev outward flip, perspective + orbiting tilt axis) / **Settle** (a few overshooting swings before rest) |
| Spin duration | 1.5–8s, ease-out, natural landing |
| Sound | Tick at sector boundaries + win chime (Web Audio synthesis, no audio files) |
| Haptics | Vibrate on result (phones) |
| Title follows pointer | On (default): while spinning, the title shows the sector under the pointer; off shows only "？" |
| Sector text layout | Single line if it fits legibly; **auto two-line radial split** when the font would be too small (each line gets half the radius, font ≈2× bigger); if two lines still don't fit, overflow is clipped by the disc (no ellipsis on screen) |
| Auto-flip text | Off by default (radial text as in the screenshots); on = left-half text flips upright |
| History entries kept | 20 / 50 / 100 / 200 |
| Flow | Use branch flows / auto-advance / auto-spin after jump / **pop radar charts mid-flow** / **chart dwell 1–15s** / show chart at flow end / dwell before jump / start wheel / clear all connections (see Section 6) |
| Data | Export backup (JSON) / import / copy data / reset |

**Moving phones**: on the old device "Export backup", move the JSON, on the new one "Import backup".

Ten starter wheels ship built in, all freely renamable/deletable:
initial identity, time point, location, age, gender, looks, morality, cursed-technique talent, cheat (golden finger), final ending — each prefixed "post-transmigration".

> Content source: the 《咒术转盘》 series by Bilibili creator **毓彧庾** (e.g. [BV1F1b36VE6K](https://www.bilibili.com/video/BV1F1b36VE6K)). **Sector proportions reproduce the videos** (e.g. Japan ≈46% of the location wheel; gender female 48% / male 40%, gag options as slivers). Old saves get the 5 newer starter wheels auto-added and wired on upgrade; your own wheels and custom links are untouched.

---

## 9. Technical Notes

- Plain HTML + CSS + Canvas 2D; no framework, no external assets, no build step; fully offline.
- **Code loads as small plain scripts**: `js/_ns.js` (creates the `window.ZW` namespace) → `js/util.js` (utilities & palettes) → `js/core.js` (shared runtime state: wheel angle etc.) → `js/icons.js` (icons) → `js/sound.js` (audio & haptics) → `js/spin.js` (spin & physics); the rest of the logic is the inline script in `index.html`.
  - **Plain `<script>` + one global object instead of ES modules** — under `file://`, `type="module"` is blocked by same-origin policy and double-click would break.
  - Modules talk only through `ZW.xxx`; any persisted data they need (current palette, sound switches…) is **injected** by the main logic, so every file stays testable standalone.
- **Paper texture** is CSS variables + an inline SVG `feTurbulence` grain (data URI) — no image files; the "hand-drawn" look comes from irregular border-radius (8-value syntax), ink strokes, doubled offset shadows and Kai-script headings.
- The wheel is Canvas with DPR scaling; radial text auto-shrinks/truncates; dark sectors auto-switch to white text; rim and hub **jitter uses a fixed seed**, identical every frame — no flicker.
- Spin uses `requestAnimationFrame` + easeOutCubic; **the result is drawn by weight first, then the landing angle is reverse-computed**, so the sector under the pointer always equals the displayed result.
- Page hierarchy is a **single view stack** `NAV.stack` (top = current) + History API: `navTo` pushes & `pushState`, `navBack` pops, `navCloseAll` clears with one `history.go(-n)`. In-app back, Esc, browser back and the Android gesture all share one path.
- Branch wheels use a small **return stack** `flow.retStack`: entering a branch pushes "where I came from"; with no target set on finish it pops and rejoins that layer's default next stop; entering an ordinary wheel clears it (back on the mainline). 30-layer guard plus the existing 60-step fuse — even cyclic configs can't hang.
- Flow jump targets support Pointer-Event dragging: an 8px threshold before dragging starts (scroll-safe), a translucent pill follows the finger, `elementFromPoint` highlights the drop zone; tap-to-select also works — both paths live.
- Data persists in `localStorage` (key `zhoushu-wheel.v1`, structure `version:2`); import does field fallbacks, legacy compatibility and one-shot migration (v1's default palette "vivid" becomes "paper"); dirty data never bricks the app.
- Accessibility: `aria-live` result announcements, `aria-modal` / `role="tablist"`, `:focus-visible` rings, Esc layer-pop, Space to spin (no false triggers while typing), and `prefers-reduced-motion` disables motion.
- Passing **297 automated checks** (`node _dev/run.js`: script syntax, CSS structure, dead code, module symbols, plus 10 test groups — chart auto-pop/dismiss, user interruption mid-flow, one real end-to-end draw, **chart display chain**, **every view/tab rendering**, **growth ↔ chart linkage**, **multi-face wheels (judging / file round-trip / UI / actions)**, **face edits persisting**, radar drawing, module structure & boot chain). Additionally verified in a real browser via screenshots: charts render, Settings/History open, growth changes shapes, multi-face shows both sets under both moralities, and face edits survive page switches.
- To poke at it in the browser: run `localStorage.setItem('zhoushu-wheel.debug','1')` in the console and reload — debug entries like `ZW.__app.openChart()` unlock (zero impact otherwise).

---

## 10. Ideas for Future Features

For example: one-click wheel template imports (Jujutsu Kaisen / Naruto / Genshin…), multi-pick consecutive draws, flow-tree image export, shareable result cards, cloud sync, custom handwriting fonts. Ask and they get added.

---

## 11. License

Code is released under the [MIT License](LICENSE) — Copyright (c) 2026 Wang-Ruibin. The wheel data files (`转盘/`) are fan content; when reusing them, keep the attribution below.

## 12. Credits

- Wheel content and sector proportions: adapted from the 《咒术转盘》 series by Bilibili creator **毓彧庾** ([BV1F1b36VE6K](https://www.bilibili.com/video/BV1F1b36VE6K) and related videos). This is a non-commercial fan work.
- Dharma-wheel ratchet sound: first 0–3s of the Bilibili **魔虚罗 sound-effects clip** [BV1KF3S62EaK](https://www.bilibili.com/video/BV1KF3S62EaK), converted to an 18KB mp3 embedded base64 in `js/sound.js`; falls back to a Web Audio synth on decode failure.
- *Jujutsu Kaisen* and all related names are © Gege Akutami / SHUEISHA. This project is unofficial and unaffiliated.

## 13. Development

- No build, no dependencies: edit `js/` or the inline script in `index.html`, refresh the browser.
- Regression suite: `node _dev/run.js` (syntax / CSS structure / dead code / module symbols + 10 functional groups, 297 assertions); single test: `node _dev/t13_multi.js`.
- Architecture notes (module load order, injection conventions): [docs/zh-CN/handover.md](docs/zh-CN/handover.md) (Chinese).
- Repository conventions (style, testing, commits): [AGENTS.md](AGENTS.md).
- Deployment: this app is served as pure static files; the Nginx site config actually in use lives in [`_deploy/zw.nginx.conf`](_deploy/zw.nginx.conf).
