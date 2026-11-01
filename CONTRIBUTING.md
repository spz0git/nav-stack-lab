# Contributing

Thanks for looking. This page says what the project is for, what kind of change it takes, how to run the tests that
every pull request passes, and how the pieces fit, so that a first contribution lands on the first try.

## What the project is

A complete robot navigation stack that runs in one HTML file, honest enough to learn from: every number a lesson
quotes is measured in the simulator, every formula in a chapter is the one the code implements, and the linear
analysis is checked against the nonlinear simulation. The target reader is a student or an engineer who wants to see
localization, perception, planning and control interact, change one thing, and watch what happens.

The page has no runtime dependencies and the build needs nothing beyond Node (the TeX converter is vendored); the
lint and format checks use ESLint and Prettier, which `npm ci` installs as development dependencies.
Keep it that way: a change that pulls in a framework, a bundler or a CDN will not be accepted.

## What we take

- **Lessons and chapters** that are measured, not asserted: a new lesson comes with the `tests/measure_*.py` run
  that produced its "What you will see" numbers (seed 7) and a derivation link into a chapter section.
- **Simulator features** from the roadmap (`docs/roadmap.md`, "Candidate next steps") or the good-first-issue list
  (`docs/good-first-issues.md`): a planner, an estimator, a sensor model, a signal. Each comes with a lesson or a
  level Try that shows what it does, and with the L1–L5 regression summary unchanged unless the change intends it.
- **Workspace improvements** that borrow a proven pattern (Foxglove, RViz, Rerun are the references) and work on a
  phone too.
- **Fixes** with a run export or a setup link that reproduces the problem.

What we do not take: content that is not measured, changes that make the page depend on a server, and large
rewrites without an issue first. Open an issue before a change that touches more than one subsystem.

## The test gate

Every pull request:

1. Builds: `./build.sh` (Node 20+). Commit the rebuilt `dist/` with the source change; CI checks that the committed
   page equals a fresh build.
2. Passes the Node tests: `npm test` (69 tests, about 35–55 s). They run the built core, so run `./build.sh` first
   (they read `dist/core-worker.js`). The files in `tests/node/`:
   - `golden.test.mjs`: the L1–L5 regression summary against `golden.json`;
   - `numerics.test.mjs`: the closed-form numerics, each against a hand-checkable answer (add a case when you touch a
     formula);
   - `params.test.mjs`: the parameter boundary, an out-of-range value ignored with a log line, and the fault schedule;
   - `level.test.mjs`: which settings survive a change of level;
   - `levels.test.mjs`: levels as data and the world generator, a built-in through the format and back;
   - `sonar.test.mjs`: the ultrasonic ring, off leaving no trace, on repeatable and enough to localize;
   - `train.test.mjs`: training in the page, backpropagation against finite differences and a loss that falls;
   - `learnmon.test.mjs`: the learned blocks' out-of-distribution monitor and the radar emergency brake;
   - `risk.test.mjs`: the Poisson interval, rates per hour and importance sampling of the failure search;
   - `argument.test.mjs`: the safety argument's format, its evidence checks and a solution checked on the core.

   `core.mjs` is the harness they share (it loads the core and runs headless missions). If your change intends to move
   the L1–L5 numbers, regenerate the baseline with `npm run golden -- --why "…"` (it prints the diff and writes only with a reason) in the
   same PR, and put a line starting `golden:` with the reason in the commit message: CI fails a changed `golden.json`
   without one.
3. Passes the browser tests it touches, run once when the PR is ready to merge: `python3 tests/run_all.py --changed`
   (Playwright's Chromium; `pip install -r tests/requirements.txt && playwright install chromium` once). It runs the smoke test for
   any change to the page and the tests of the areas the change touches; `--changed --list` shows which. `test.py`'s
   summary must not change, and every script must report no errors. The full suite (`python3 tests/run_all.py`,
   about twelve minutes) runs nightly in CI. A change in an area no test covers adds its check to the nearest test
   (or `smoke.py`); a new test, or a new area for an existing one, needs a `SCOPE` entry in `tests/run_all.py`, the
   table that maps changed paths to the tests they need.
4. For a UI change: screenshots at 1440 × 900 and 390 × 844, light and dark, in the PR description
   (`tests/shots.py <dir>` makes them).

## How the code is organised

`src/` is concatenated in `manifest.json` order into one page (the module map is in `src/README.md`). Three rules:

- `core/` never touches the DOM. It reaches the page only through the `UI` hooks in `core/state.js`, which is why
  the same core runs in Node (`tests/node/core.mjs`) and in the Experiments workers.
- A parameter lives in `core/params.js` (`DEFAULTS`), is shown by `ui/schema.js`, and is set through `setParam`
  (`core/config.js`), never by writing `P.x` from the UI.
- A number the user sees comes from the simulation or the analysis, not from a constant in the UI.

Lessons are markdown files in `docs/lessons/<group>/*.md`: front matter (group, title), the body, then one
`## Try: Label` section per experiment (`cfg:` as JSON, `Setup:`, `See:`, `Shows:`, a `Predict:` question with its
`- options` and the `Answer:` index), `## Think about` (Q:/A: pairs) and `## Check yourself` (Q:, Answer:, Tolerance:,
Unit:, How:); math is TeX as in the chapters (`$…$` inline, `$$…$$` display, turned into MathML at build time by
`tools/tex.mjs`); the header of `tools/lessons.mjs` documents the format and the build inlines them. Chapters are
`docs/notes/*.md` (markdown + TeX, `{{live:key}}` values from `src/ui/chapters.js`, `[try: Label | {cfg}]` buttons;
the header of `tools/notes.mjs` documents both). Math inside JS strings (the How it works panels in `src/ui/notes.js`)
goes in a template literal tagged `TEX`, which the build turns into MathML (`texSource` in `tools/tex.mjs`). A new lesson's terms go in `LESSON_TERMS` in
`src/analysis/glossary.js`, keyed by its title.

## Pull requests

- One change per PR, on a branch, with the tests above run and their result in the description.
- The code is formatted with Prettier at 140 columns (`npm run fmt`; CI checks it with `npm run fmt:check`). The
  one-off reformat commit is listed in `.git-blame-ignore-revs`, so `git blame` skips it once you run
  `git config blame.ignoreRevsFile .git-blame-ignore-revs`.
- `npm run lint` (after `npm ci`) checks every cross-module name: the modules share one scope, so a misspelled
  function from another file is a `ReferenceError` only when that path runs; the lint config collects every
  top-level name of every module and `no-undef` catches it statically. CI runs it on every PR.
- The maintainer merges, bumps the version label, and republishes the demo; see `docs/maintaining.md`.
- By contributing you agree that your contribution is licensed under the project's licence (see `LICENSE`).
