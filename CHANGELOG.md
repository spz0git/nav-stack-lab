# Changelog

The version label in the page header (`v33 · 2026-10-16`) is the number used here; `src/version.json` holds it.
Design notes per feature are in [docs/roadmap.md](docs/roadmap.md).

## Unreleased

Phase 1, the learning path (from the assessment of 2026-10-15):

- Learn opens with a "Start here" card: who the lessons are for, what they assume, how lessons, chapters, levels and
  the Symbols tab relate, and a first pass of eight lessons with a reading time each (`src/ui/path.js`).
- Opening a lesson sets the stage up as its first experiment would, without running it: the simulator on the
  lesson's level with its settings, tab and plot, or the Analyze view for a control lesson (`hold` in `tryGo`).
  Back from a chapter and the Try buttons leave the stage as it is.
- Predict first: an experiment can carry a question with three answers, asked before its button; "What you will
  see" stays folded until the learner has picked one, then the pick and the measured answer are marked. Every lesson
  ends with a numeric self-check (type a number, Check; the working appears after a second miss). Picks and passed
  checks are remembered in this browser.
- Progress: a dot per lesson (started, done), a bar per group and a count above the list, ticks on the first pass,
  "Continue with lesson n" on the Start here card; Next follows the first pass while the open lesson is on it.

## v33 · 2026-10-16

README rewritten in plain language; the module map and the lesson/chapter format move to `src/README.md`; the
learning tracks (classical, modular learning, end-to-end) join Phase 4 of the assessment and the roadmap (PR #54).

## v32 · 2026-10-16

Release series (open-source readiness, from the assessment of 2026-10-15):

- The built page is a complete standalone HTML document (doctype, charset, viewport, `lang`, CSP); it renders from
  any static host, not only inside the claude.ai artifact. `tests/wrap.py` is gone.
- The four typefaces are embedded (`src/fonts/`, SIL OFL); the page makes no network request at runtime.
- A public README with the GitHub Pages demo; maintainer rules in `docs/maintaining.md`.
- Portable tests (`tests/_browser.py`, `tests/run_all.py`, `package.json`); Node golden tests over
  `dist/core-worker.js` with a committed baseline (`tests/node/golden.json`); GitHub Actions for CI, the nightly
  browser gate and the Pages deploy.
- Lessons: the seed is pinned when a Try names a level, the order-dependent control Trys are self-contained, two
  numeric slips fixed, one notation (Q measurement, M odometry, R process noise, b bearing), the PID row and the
  kinematic sideslip number corrected.
- Accessibility: light-mode amber darkened and the dimmed log lines and tab numbers made readable (WCAG AA), group
  labels on the status strip and the transport bar.
- Removed from the tree: `legacy/` (the v1–v7 patch scripts; in the history up to this commit) and
  `docs/screenshots/` (40 MB of phase screenshots; kept on the `archive/screenshots` branch).

## v31 · 2026-10-16

L7, the moose test: a road with a box in the lane for the car with tyre slip; the MPC with the tyre model in its
prediction (`mpcDyn`); a lidar safety stop (PR #42).

## v30 · 2026-10-15

v29 feedback: sensor settings on Localize and Perceive, the previous run on every tab, Analyze lateral derivations
with the step test played back, Analyze legends, the planner's search step by step (PRs #38–#41).

## v29 · 2026-10-15

Car with tyre slip: a third vehicle (dynamic bicycle model, linear tyres with a friction limit) with Grippy and
Slippery floor presets, sideslip on the map, slip signals and a grip-limit health light, Analyze with the tyres in the
plant, three control lessons, chapter 1 with the lab's car (PRs #33–#37).

Earlier versions: see `docs/roadmap.md` (phases 6 and 7, the enhancement plan v8–v13) and the git history.
