# Repository Guidelines

## Project Structure & Module Organization

This repository is a dependency-free, offline web application. `index.html` contains the page shell and most application logic; `app.css` owns the visual design. Browser modules live in `js/` and are loaded in the explicit order declared near the top of `index.html`: `_ns.js`, utilities, shared state, icons, sound, spin behavior, and multi-face wheel logic. Preserve that order when adding or splitting modules.

Wheel definitions live in `转盘/`. `_index.js` controls their load order, while numbered files such as `01-穿越后的时间点.js` register individual wheels. `_dev/` contains the Node-based harness, lint checks, and regression tests. Deployment-only Nginx configuration is under `_deploy/`; screenshots and documentation remain at the repository root or beside the data they describe.

## Build, Test, and Development Commands

There is no build step or package installation. Open `index.html` directly in Edge or Chrome for normal use. For an HTTP origin during browser debugging, run:

```bash
python -m http.server 8000
```

Run the complete verification suite from the repository root:

```bash
node _dev/run.js
```

This checks inline JavaScript syntax, CSS structure, action wiring, module exports, and every `_dev/t*.js` regression test. Run an individual test, for example `node _dev/t13_multi.js`, while iterating on one feature.

## Coding Style & Naming Conventions

Use UTF-8, two-space indentation, single quotes in JavaScript, semicolons, and `'use strict'`. Follow existing `camelCase` function and variable names; reserve `UPPER_SNAKE_CASE` for constants. Browser modules use small IIFEs and expose shared behavior through the `ZW` namespace rather than new globals. Keep CSS selectors descriptive and reuse existing custom properties.

Name tests `t<number>_<feature>.js`. Keep wheel filenames zero-padded and synchronized with `转盘/_index.js`; wheel data must call `window.__ZW_REGISTER(...)`.

## Testing Guidelines

Add regression coverage for behavior changes, especially navigation, persistence, rendering side effects, flow interruption, and both ordinary and multi-face wheel paths. Use `_dev/harness.js` and its virtual clock instead of real delays. Assert observable state or canvas/DOM effects, not merely the absence of exceptions. The full suite must pass before submission; no numeric coverage threshold is configured.

## Commit & Pull Request Guidelines

This checkout contains no Git history, so no repository-specific commit convention can be inferred. Use short, imperative subjects such as `Fix multi-face option persistence`, and keep unrelated changes separate. Pull requests should explain user-visible behavior, list validation commands, link relevant issues, and include before/after screenshots for layout or animation changes. Call out edits to wheel ordering, persisted-data schemas, or `_deploy/` configuration explicitly.
