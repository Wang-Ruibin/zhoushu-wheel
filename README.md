<div align="center">

# 🎡 Jujutsu Wheel

**A hand-drawn, paper-textured spin wheel · branching storylines · attribute growth · a dharma-wheel radar chart**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live demo](https://img.shields.io/badge/live-demo-gxnatri.top-8A2BE2)](https://gxnatri.top/)

[🚀 Play now](https://gxnatri.top/) · [🛠️ Get involved](#get-involved)

**English** | [简体中文](README.zh-CN.md)

**Double-click `index.html` and play** — no network, no install, no server

</div>

---

## ✨ Highlights

- 🎨 **Hand-drawn paper style**: ink-line wheel, Kai-script headlines, paper grain; light "rice paper" / dark "ink night" themes × six traditional palettes
- 🎯 **What you see is what you get**: however big the sector, that's the probability — wherever the pointer stops is the result; no hidden odds
- 🔀 **Branching storylines**: give any option a "when picked, go to this wheel" target — draw 「咒灵」and plummet straight into the death-ending wheel; auto-advance after each draw, with a flow bar recording your whole destiny chain and jump-back-to-redo at any step
- 🧭 **Attribute radar chart**: morality, cursed energy, physique… grade-wheel results roll up into a radar chart drawn on a **dharma wheel** that clicks 45° every time it appears
- 🎭 **Multi-face wheels**: one 「声望」(reputation) wheel shows *saintly* EX at high morality — and *baby-silencing* EX at low
- 📈 **Growth**: event-growth wheels raise grades you've already drawn, and the radar chart follows along
- 📴 **Fully offline**: copy the folder and it runs anywhere; data lives in your browser with JSON export/import for moving devices
- ⌨️ **Accessible**: Space to spin, Esc to pop back, `prefers-reduced-motion` support, live result announcements

## 🚀 Quick Start

| | How |
| --- | --- |
| 🌐 **Play online** (fastest) | Open <https://gxnatri.top/> |
| 💻 **Desktop** | **Code → Download ZIP** (or `git clone`), unzip, double-click `index.html` |
| 📱 **Phone** | Send `index.html` to your phone and open it in a browser; "Add to Home Screen" turns it into a fullscreen mini-app |

## 🎮 How it plays

### Spinning
Tap the wheel (or press Space) to spin; five physics feels to choose from: steady, bumpy, 2D/3D tumble, settle. The big Kai-script text follows the pointer live and freezes on landing. Tap the result to **copy** it, **spin again**, or **remove it from the wheel** — perfect for draws, roll calls and group assignment.

### Branch flows
Every option can set "when picked, go to which wheel": unset options follow the list order automatically, set ones take their own storyline. The top flow bar remembers your route (`初始身份·咒术师 › 时间点 → …`); tap any history node to jump back and re-draw. Wire it however you like — if you get stuck on the same wheel 12 times in a row, auto-advance politely pauses instead of looping forever.

### Attributes & growth
Wheels with grades (E- ~ EX) are auto-detected as attribute wheels; snap a radar chart any time to plot your morality, cursed energy, physique… When the flow passes it, it pops up for a 3-second look. Event-growth wheels raise the grades you've drawn — and the chart grows with them.

### Make it yours
Create / duplicate / drag-reorder wheels; bulk-edit options (one per line, `name*weight` for weights); drag to wire branches; "remove after pick" for lucky draws; six palettes + light/dark themes + an independently colorable dharma wheel.

## 📦 Your data stays yours

Everything persists in your browser's localStorage, with **one-click JSON backup** and import for moving devices. Optionally grant the `转盘/` folder and the app **writes your edits back to the data files** — one `.js` per wheel, editable in any text editor, refresh to apply, with the format documented in the files' own comments (it's `.js` rather than `.json` because a local page opened by double-click can't fetch local JSON, but it can load local scripts).

<a id="get-involved"></a>

## 🛠️ Get involved

Zero build, zero dependencies: plain HTML + CSS + vanilla JS + Canvas 2D. Clone and start hacking.

```bash
git clone git@github.com:Wang-Ruibin/jujutsu-wheel.git
cd jujutsu-wheel
# double-click index.html to run locally; for an HTTP origin:
python -m http.server 8000
# must be fully green before submitting (297 assertions):
node _dev/run.js
# run a single test:
node _dev/t13_multi.js
```

Two things to know before you start:

- The load order of the `js/` modules is fixed at the top of `index.html` — don't reorder; modules talk only through the `ZW` namespace, no new globals.
- Code style, testing rules, and commit & PR conventions live in [AGENTS.md](AGENTS.md).

Issues and PRs are welcome — if there's a feature you want, just say so.

## 📜 License & credits

Code is [MIT](LICENSE) — Copyright (c) 2026 Wang-Ruibin. Wheel content and sector proportions are adapted from the 《咒术转盘》 series by Bilibili creator **毓彧庾** ([BV1F1b36VE6K](https://www.bilibili.com/video/BV1F1b36VE6K) etc.), a non-commercial fan work; the dharma-wheel ratchet sound is taken from the first 0–3s of a Bilibili sound-effects clip ([BV1KF3S62EaK](https://www.bilibili.com/video/BV1KF3S62EaK)) and embedded in code. *Jujutsu Kaisen* and all related names are © Gege Akutami / SHUEISHA; this project is unofficial and unaffiliated.

---

<div align="center">

## ⭐ A little star, please

If the wheel spun you a decent destiny, drop by the repo and give it a Star —

**think of it as refueling the wheel with cursed energy ✨**

</div>
