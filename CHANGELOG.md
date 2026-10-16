# Changelog

The version label in the page header (`v34 · 2026-10-16`) is the number used here; `src/version.json` holds it.
Design notes per feature are in [docs/roadmap.md](docs/roadmap.md).

## Unreleased

Phase 2, workspace polish (from the assessment of 2026-10-15):

- The preset plot follows the level until you pick one: cross-track where the pose is known (L1, L2, L6, L7),
  position error where there is an estimate to judge. With ground truth the status strip says "pose known" and the
  metrics show one line instead of a zero pose error, a zero RMS and an empty NEES.
- Phone: the level selector is a row again (the app bar's 380 px flex basis had become its height), the world is
  fitted left of the view buttons so the east wall's beacons can be tapped, and in the stacked layouts a plain wheel
  scrolls the page past the map while Ctrl or ⌘ + wheel (a pinch) zooms it.
- The address bar always says what the page shows: the setup link in Simulate (`#l=L3&seed=7&loc=ekf…`), with
  `mode=an` in Analyze and `t=12.3` while a recorded moment is replayed; `#learn`, `#lesson=…` or `#notes=…` in
  Learn. A pasted link applies while the page is open, and a link with `t=` runs the setup to that moment and shows
  it paused (`ui/urlstate.js`).
- The event log has a search box (matching lines are marked on the timeline), a severity filter (All, Warnings,
  Errors), an order toggle (oldest first) and follows the replayed moment.
- The recording plays: ▶ next to the timeline (or P) plays it at the speed setting from the shown moment; I and O
  set a loop region's in and out points (handles on the track drag them, × clears), playback wraps inside it, and
  "Whole run" in the plots and the CSV export are trimmed to it.
- A health light is the worst of its subsystem's checks; a click opens the list: every check with its state, the
  subsystem's recent events (a click seeks the timeline) and the button to its tab.
- Settings applied from a link re-render the tabs at once (the Localize tab could still show the level's default
  estimator while the link's one ran).
- Experiments land in the workspace: the runs' paths are drawn on the map (a layer, coloured by configuration);
  when one numeric parameter is varied the chart is the metric against its value, a dot per run with the mean as a
  line; hovering a dot (or a bar) makes that run's path bold on the map and names it, and a click runs that setup
  live with its seed.

## v34 · 2026-10-16

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
- The level panel's Try list is now "Quick experiments", with a line that names the lessons whose experiments run
  on this floor (a click opens the lesson), so the two experiment systems stop competing.
- Chapter 8, Notation and references: the conventions (frames, truth and estimate, the three noise covariances M,
  Q and R, bearing b), the letters that mean two things, one symbol table by area, and the sixteen references the
  material draws on. Control lesson 1 names its chips in one line each before the later lessons use them; the
  longest sentences of chapters 1 and 6 are split.
- The lessons move out of JavaScript: `docs/lessons/<group>/*.md`, one file per lesson, read by `tools/lessons.mjs`
  at build time and inlined as `LESSON_DATA`; the lesson objects the page sees are byte-identical (round-tripped).
  A content contributor never opens a `.js` file for a lesson now; the terms list stays in `glossary.js`.

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
