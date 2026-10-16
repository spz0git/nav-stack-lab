# Nav Stack Lab v29 — release assessment and improvement plan

Date: 2026-10-15. Scope: UI/UX against Foxglove, Rerun and RViz; feature completeness; codebase quality; the
learning content; readiness for an open-source release. Method: built from source, ran the whole test suite with a
local Chromium, drove the page at 1440 × 900 (light and dark) and 375 × 812, read the code, lessons and chapters,
and researched the peer tools. Nothing in the repo was changed except this file and `.claude/launch.json` (a
preview server config for the desktop app).

## Verdict in one paragraph

The substance is well beyond what any browser robotics tool offers: a complete navigation stack with an honest
simulator, a linear-analysis view that is checked against the nonlinear simulator, and 31 lessons plus seven
chapters that are measured rather than asserted. The Phase 7 workspace (timeline, replay, map tools, Layers, plot
dock, palette, health lights, runs) already borrows the right patterns from Foxglove. What stands between v29 and a
credible open-source release is packaging and legibility, not architecture: the built page is not a standalone HTML
document, there is no licence, the tests run on one machine only, the lessons have a seed leak that silently
invalidates their numbers, and a newcomer has no on-ramp into the content. All of that is days of work, not weeks.

## What was verified

| Check | Result |
| --- | --- |
| `./build.sh` | BUILD_OK, 59 modules, 7 chapters, 1285 KB |
| `tests/test.py` (L1–L5 regression) | all cases as documented, ERRORS [] |
| `tests/p5test.py` (97 Try buttons) | ERRORS [] |
| `tests/tles.py` (31 lessons, glossary) | ERR [] |
| `tests/chtest.py` (chapters, live values, links) | ERRORS [] |
| `tests/dyntest.py` (tyre model vs theory) | ERRORS [], FAILS [] |
| Whole suite wall time | about 2.5 minutes |
| Frame time, L5 with the particle filter at 8× speed | p50 16.7 ms, p95 16.8 ms (60 fps) |
| Headless core in Node, 58 s of L1 | 38 ms |
| Console errors during the tour | none |

The suite only ran after patching copies of the scripts: every test hardcodes
`executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome'` and assumes `cwd == tests/`.

Note on the working tree: while this assessment ran, another session was editing `src/core/mpc.js`,
`src/analysis/model.js`, `src/core/params.js` and `src/ui/schema.js` (an MPC with the tyre model in its
prediction, `P.mpcDyn`). The build regenerated `dist/` from that in-progress state, so `dist/` currently differs from
HEAD. Nothing was committed.

## 1. UI/UX

### What already matches the best tools

- One timeline drives everything: scrubbing replays map, status strip, plot window, metrics and the log (lines after
  the moment dimmed), with event marks coloured by kind and a REPLAY badge. This is the Foxglove hover-and-seek
  pattern done right.
- Select tool with a live card, hover cards sharing the same picker, Layers popover with a status and reason per
  overlay ("only with lidar mapping (Perceive)"): RViz's display list with better feedback.
- Command palette over settings, actions, layers, lessons, chapter sections, symbols and signals, with "appears in
  Control when Path tracker is MPC" notices. Nothing in Foxglove or Rerun searches this deeply.
- Health lights with reasons, the Changed badge with per-setting reset, runs kept and compared with Δ tables, layout
  presets, a complete keyboard sheet, dark mode, phone layout with a sticky transport bar and a Settings sheet.
- Analyze: the two explained plots (response from above, draggable poles) with physical units are a genuinely
  original piece of control-education UI.

### Findings, most important first

1. **The built page is not a standalone document.** `dist/nav-stack-lab.html` starts at `<title>`: no doctype,
   no `<meta charset>`, no viewport, no `lang`. Served by any static host (GitHub Pages, a local server) it renders
   mojibake ("v29 Â· 2026-10-15", "âŒ˜K", "1Ã—") and quirks mode; it only works inside the claude.ai artifact
   skeleton. `tests/wrap.py` exists precisely because of this. The release build must emit a full document.
2. **"Zero runtime dependencies" is not quite true.** The page loads four font families from Google Fonts. Offline
   or behind a blocker it falls back to system fonts, and every viewer pings Google. Either self-host a subset
   (adds roughly 200–400 KB) or pick a system font stack and say so.
3. **The default plot is empty on half the levels.** L1, L2 and L6 start on ground-truth localization, so the dock
   opens on a flat zero "Position error" plot and the metrics show "Pose RMS 0.00 m". The first thing a visitor sees
   in the dock says nothing. Pick the default series per level (cross-track for L1 and L6, path/plan effort for L2).
4. **Learn mode does not reshape the stage.** Open a localization lesson while Analyze is showing and the Bode/pole
   view stays on the left until a Try is pressed; the lesson list promises "opening a lesson shows the map layers it
   is about". Opening a lesson should switch the stage to the simulator (or analysis for control lessons) at once.
5. **The URL hash goes stale.** `#lesson=loc:2` stays in the bar after switching to Simulate and loading L6. A
   shared link should always mean what the page shows: write the hash on every mode/level change, or clear it.
6. **The map wastes its stage.** At 1440 × 900 the canvas is 897 × 465 px for a 3:2 world, so about a fifth of it
   is blank margin at fit zoom, while the right panel is 500 px wide for a column of text. A narrower default panel
   (or a map that fills to the world's aspect and lets the panel overflow) would give the map 15–20 % more pixels.
7. **Phone layout bugs.** The L1–L6 selector stretches to about 380 px tall (each level a full-height column)
   between the telemetry dock and the level brief. The map's view buttons still cover the east-wall beacon. On a
   mouse, wheel over the map zooms instead of scrolling the page, so a trackpad user cannot scroll past the map.
8. **Event log is weaker than its neighbours.** Newest-on-top while the timeline reads left to right; no severity
   filter, no search, no follow/pause toggle. Foxglove's Log panel (severity, namespace toggles, search hits on an
   overview ruler, click-to-seek) is the target; the click-to-seek part already exists.
9. **Experiments are hidden power.** Parameter sweeps run in workers and come back as a table and a bar chart in
   the panel; nothing lands in the workspace. Bret Victor's "ladder of abstraction" is the model: overlay the swept
   trajectories on the map, plot metric against parameter, hover a point to show that run.
10. **Code tab** is a plain textarea: no highlighting, no error line mapping, no example picker beyond "Restore
    example". Fine for v1, but say in the tab that user code runs in a Worker with same-origin fetch available.
11. **Accessibility.** No `lang` attribute (also missing from the test wrapper). Buttons, inputs and the canvas are
    all named; three live regions exist; focus rings and reduced-motion are handled. Contrast of the small grey
    caption text in the status strip ("T", "GOALS") should be measured against WCAG AA; it looks borderline.
12. **Onboarding is one paragraph.** The first-run hint explains the three verbs; there is no "start here", no
    thirty-second tour, and the level Try lists and the lessons are two unexplained experiment systems side by side.

### Patterns worth borrowing (from the peer-tool research)

- Hover tooltips that show every visible series with "last value, 0.4 s ago" for series without a sample
  (Foxglove Plot).
- Loop region with range handles on the timeline and "trim to here" palette commands (Foxglove, Rerun).
- Expression-based series picking (`@delta`, `@derivative`, a constant as a reference line) instead of a fixed
  registry (Foxglove message paths).
- A roll-up status tree behind each health light: worst child wins, click for the reason list (RViz Displays
  status, Foxglove Diagnostics).
- Selection history with back/forward and an (i) hover help per panel (Rerun).
- URL state that carries the moment: `#run=…&t=…&layout=…` (Foxglove shareable links).
- Predict-then-observe before every experiment, visible per-lesson progress, and gating of later Trys
  (PhET, Brilliant, Nicky Case).

## 2. Feature completeness

Complete for its stated scope. The six levels, five estimators, two mapping modes, six planners, seven controllers,
agents with tracking and ST speed planning, three vehicles and the analysis cover a full undergraduate navigation
course. Gaps that the simulator could fill cheaply, all already hinted at in lessons or the roadmap:

- Frontier exploration (promised in two lessons, never delivered).
- Scan matching / ICP (the likelihood field and lidar exist).
- Gyro/IMU fusion in the L3 EKF (the gyro exists only on the dynamic car).
- Pose-graph SLAM (mentioned twice as "sparse graph formulations").
- D* Lite or incremental replanning (the mission replans from scratch).
- LQR / pole placement named as such in Analyze (the what-if already drags poles).
- A dynamic MPC (in progress in the working tree).

Known limits worth stating up front in the README: runs live in memory, health thresholds are heuristics, NEES and
the phantom rule use ground truth, one y-axis per plot pane, Compare only on the same level.

## 3. Codebase quality

### Strong

- The core/UI boundary is real: the only non-DOM calls in `core/` are `performance.now`, a guarded `$` and a Worker
  `setTimeout`; the page reaches the core through seven hooks on `UI` in `core/state.js`. The same core runs
  unmodified in Node and in the Experiments workers.
- The build is twenty lines, reproducible (no timestamps, version from `src/version.json`) and checks both outputs
  with `node --check`. No duplicate top-level names across 59 modules.
- The sandbox for user code is sound: Blob-URL Worker, strict mode, timeouts with `terminate()`, coerced return
  values; no `eval` or `new Function` anywhere; config-link keys are allow-listed; `localStorage` always guarded;
  log text escaped. No injection path found from the URL hash.
- Rendering is gated by dirty flags; no `getImageData`; the tick is cheap.

### Weak

1. **Density.** 6,424 lines at 117 chars average, 457 lines over 300 chars, the longest 2,390
   (`src/ui/panes.js:92`). Comments are about 3 % of lines. `ctlMPC` (`src/core/mpc.js:64–176`) is ~110 lines of
   150–330-char lines with rollout, Jacobians, cost, constraints and the time budget in one body; `draw` in
   `src/ui/map.js:50–166` and `renderAnalysis` in `src/analysis/ui.js:288–334` are similar. Outside contributors
   will not touch these.
2. **No stored test baseline.** `test.py` prints a summary and asks a human to notice that it changed. `p5test` and
   `chtest` assert only "no console errors". `dyntest` is the one numeric test. There is no CI.
3. **Non-portable tests**, see above. 17 of 18 scripts share the hardcoded path.
4. **`setParam` side effects** (`src/core/config.js:17–29`) are a growing if-chain; the UI also writes `P.x` directly
   in 16 places and `S.x` in 6. String params (`ctl`, `loc`, `plan`) are not validated against their option lists,
   so `#l=…&plan=foo` falls into an `else` branch silently.
5. **Lesson prose lives in JS template literals** (`src/analysis/lessons.js`, `lessons2.js`: 216 KB). The chapters
   already have a markdown pipeline (`tools/notes.mjs`); lessons should use it, so content contributors never open a
   JS file.
6. **Everything runs on the main thread.** Planners have no time budget except Hybrid A*'s expansion cap and RRT*'s
   iteration count; at 8× the rAF loop runs up to 40 ticks per frame. It is fine today (60 fps measured), but the
   worker core exists and is the natural home for the live simulation.
7. **Manifest order**: `ui/st-plot.js` sits between `core/fidelity.js` and `core/step.js`; nothing in the core needs
   it, so moving it after `core/log.js` makes the core/ui split exact.

### Repo hygiene for release

- Missing: LICENSE, CONTRIBUTING, CITATION.cff, package.json (engines, scripts), `.github/` (workflows, issue
  forms), CHANGELOG, CODE_OF_CONDUCT. `tools/vendor/temml` carries its MIT licence; a NOTICE should mention it.
- `README.md` and `CLAUDE.md` are written for one maintainer with a claude.ai artifact as the deployment target.
  The public README needs a neutral demo URL (GitHub Pages serving `dist/`), a GIF, how to run, how to test, how to
  contribute. The artifact-publishing rules belong in a maintainer doc.
- `.git` is 47 MB; `dist/nav-stack-lab.html` accounts for 53 MB uncompressed across 51 revisions and grows 1.3 MB
  per release. `docs/screenshots` holds 230 PNGs (35 MB). `legacy/` is 684 KB of patch scripts that are in history
  anyway.

## 4. Learning content

### Strong

Mathematically careful throughout: the EKF update and Joseph form, particle weights and injection, log-odds, octile
admissibility and the weighted-A* bound, the RRT* γ bound, pure pursuit's gains and ζ = 1/√2, rear-wheel and Stanley
derivations, the dynamic bicycle A-matrix, K_us, v_ch, v_crit and the preset eigenvalues, DM = PM/ω_c, the M_s
bounds, Nyquist with the indented contour: all reproduce by hand. The voice is excellent ("Convergence is not
correctness"; "Lookahead is not a comfort setting; it is the loop's bandwidth, and bandwidth is paid for in delay
tolerance"). The control group with chapters 5, 6 and 1 is close to world class, and ch6 §6's worked table is the
template every lesson should follow.

### Must-fix

1. **The seed leaks across lessons.** `loadLevel` keeps `P.seed` and `tryGo` increments it permanently on
   `seed:'next'`. Every "What you will see" number was measured at seed 7; after the RRT* lesson's next-seed button
   or L2's Try, every later stochastic lesson reports numbers for a different seed with no warning. Pin `seed:7` in
   lesson cfgs or reset the seed when a lesson Try carries a level.
2. **Order-dependent Try buttons without a level** ("…and run a step test", the two "+ latency" buttons, ch1's
   `[try:]` buttons) act on whatever is currently set; their quoted numbers hold in one order only.
3. **Notation conflicts a student will hit.** Stanley's sign in the ch6 §7 table is the opposite of ch5 §4, the
   notes and the code; the PID row's `K_e = k_p v_0/L_d` does not match `ctlPID`; ch2 §8 uses Q for motion noise and
   then for sensor noise; the EKF-SLAM lesson uses R where every other lesson uses Q; the Symbols tab says φ, σ_φ
   while lessons say b, σ_b; the kinematic sideslip number assumes l_r/L = 0.5 while the dynamic car uses l_f = 0.27.
4. **Two numeric slips** in `lessons.js`: "against 3° in the slow loop" should be about 1.7°; "the 14° difference is
   atan(1.89 × 0.15)" evaluates to 15.8°.

### Should-fix

- No "start here": no stated prerequisites (Laplace, Bode, Gaussians, χ², Jacobians are assumed from lesson 1), no
  recommended path, no time estimates, no map of lessons ↔ chapters ↔ levels.
- Control lesson 1 uses crossover, phase margin, M_s and dominant poles two lessons before "Reading the Bode plot"
  defines them.
- No prediction before observation, no checkpoints, no progress. "Think about" answers are passive.
- Sim-group numbers are asserted ("4/4 in 40.8 s, 4.2 cm RMS") without saying they are single seed-7 runs; the RRT*
  lesson does this honestly and should be the template.
- Comma-chained sentences of 60–80 words in ch6 and the "Why this matters" paragraphs; jargon before definition
  (Frenet, Bresenham, inscribed-angle theorem, argument principle); "-ish".
- No reference list (Rajamani, Paden, Hoffmann, Helbing, Karaman–Frazzoli, Dolgov are cited inline only) and no
  notation page.
- Display math with matrices and `\dfrac` is cramped at phone width; wrap display math in a horizontal scroller.

## Plan

Phases are ordered by what unblocks the release; each bullet is one PR.

### Phase 0 — release blockers (about a week)

1. Standalone build: `build.mjs` emits doctype, charset, viewport, `lang`, a CSP meta; drop `tests/wrap.py`.
2. Fonts: self-host a subset or switch to a system stack; make "no network at runtime" true and say it.
3. LICENSE (MIT or Apache-2.0), NOTICE for temml, CITATION.cff, CODE_OF_CONDUCT, CONTRIBUTING with the vision, what
   is accepted, and the test gate.
4. Public README: pitch, live link (GitHub Pages from `dist/`), 15-second GIF, three-bullet feature list, run, test,
   contribute, cite. Maintainer rules (artifact publishing, version bump) move to `docs/maintaining.md` and CLAUDE.md.
5. Portable tests: a shared `tests/_browser.py` (env override, Playwright default), paths from `__file__`, a
   `tests/run_all.py`; `package.json` with `engines` and `npm test`.
6. Node golden tests: load `dist/core-worker.js` in `node --test`, assert the L1–L5 summary against a committed JSON
   (goals, collisions, cross-track and pose RMS with tolerances). Runs in under a second.
7. GitHub Actions: build + `git diff --exit-code dist/` + Node tests on every PR; Playwright nightly and on demand;
   Pages deploy on main.
8. Content must-fixes: pin the seed, make dependent Trys self-contained, fix the Stanley sign, the PID row, Q/R/M and
   b/φ, the two numeric slips.
9. Accessibility pass: `lang`, contrast of caption text, a quick screen-reader walk of the transport bar and palette.
10. Trim the repo: delete `legacy/`, move screenshots to a release asset or orphan branch, note both in a CHANGELOG.
11. Issue forms (bug with a run export attached, lesson error, feature) and 5–10 labelled good-first-issues (a new
    lesson, a chapter note, a planner heuristic, a signal).

### Phase 1 — the learning path (one to two weeks)

1. "Start here" card in Learn: who it is for, prerequisites, the recommended path (L1 → control 1–3 → loc 1–2 →
   per 1 → plan 1 → …), time per lesson, how lessons, chapters, levels and Symbols relate.
2. Opening a lesson reshapes the stage (simulator or analysis) and loads its level before the first Try.
3. Predict-then-observe: a one-tap prediction with a reason before each Try; "What you will see" revealed after the
   run; a "you predicted X, measured Y" line. Each lesson gets one quantitative self-check.
4. Progress per lesson and chapter in `localStorage`, a progress strip, "Next" that follows the path.
5. Reorder or annotate control lesson 1; a notation page and a reference list; shorter sentences in ch6 and the
   "Why this matters" paragraphs.
6. Merge or label the level Try lists as "quick experiments" so they stop competing with the lessons.
7. Lessons move to markdown under `docs/lessons/` through the existing notes pipeline.

### Phase 2 — workspace polish toward Foxglove (two to three weeks)

1. Per-level default plot series and metrics; hide ground-truth-only metrics when the estimator is truth.
2. Plot hover: every visible series, last value with age; loop region with range handles; a "trim to here" action.
3. Event log: severity filter, search with ruler marks, follow toggle, oldest-on-top option.
4. Experiments land in the workspace: swept trajectories overlaid on the map, metric-vs-parameter plot, hover to
   show that run, one click to adopt a point's setting.
5. URL state: `#l=…&t=…&layout=…` written on every change, so a link always means what the page shows.
6. Health lights open a status tree (worst child wins) instead of a tab.
7. Phone: compact level selector, map wheel/scroll conflict, the beacon under the view buttons.
8. Map fills to the world's aspect; narrower default panel; selection history.
9. Code tab: a small highlighter, error lines mapped, examples menu, and a note on the sandbox.

### Phase 3 — code health (ongoing, one PR each)

1. Prettier once at 140 columns; a 160-column soft limit for new code; 1–3 line headers on the 15 functions over 60
   lines.
2. Split `ctlMPC`, `draw` and `renderAnalysis`.
3. `setParam` validates string params against option lists; a `PARAM_EFFECTS` table replaces the if-chain; the UI
   stops writing `P` and `S` directly.
4. A build step that checks every free identifier of each module against the manifest's top-level names.
5. Unit tests for the closed-form numerics (matrix inverse, box QP, distance transform, Reeds–Shepp lengths, EKF
   update, A* optimality on a toy grid).
6. Move `ui/st-plot.js` after the core in the manifest; then run the live simulation in the worker.

### Phase 4 — content expansion (after release)

Frontier exploration, gyro/IMU fusion in the L3 EKF, scan matching, LQR named in Analyze, D* Lite, pose-graph SLAM,
velocity obstacles; each as a lesson plus a chapter section plus a measured Try.

#### Three tracks: classical, modular learning, end-to-end

Everything in the lab today is model-based. Robotics has moved a long way toward learned components, and the lab
is well placed to show that shift honestly, because it can generate unlimited labelled data from a simulator whose
ground truth it already knows. The goal is three parallel tracks a learner can switch between on the same levels
and compare with the existing Runs tools:

1. **Track A, classical** (what exists): filters, grid maps, search-based planners, hand-designed controllers.
2. **Track B, modular learning**: the same pipeline, with one block at a time replaced by a learned one.
   - Perception first: a small convolutional network that turns the lidar scan (and a short history) into an
     occupancy or semantic grid, trained against the true map; a learned detector for people instead of the
     unexplained-hit clustering.
   - Prediction second: a trajectory predictor for the pedestrians trained on the simulator's own walkers
     (including the reactive ones), replacing constant velocity; multi-modal output where the constant-velocity
     model fails (people stopping and turning).
   - Planning third, optionally: a learned cost or value map that feeds A*, or a learned local planner that
     proposes the velocity profile the ST planner searches for.
3. **Track C, end-to-end**: one policy from raw inputs (lidar, odometry, goal in the robot frame) to velocity or
   steering commands. First behaviour cloning from Track A on L1 and L2, then a goal-conditioned policy on L5 with
   people, then offline reinforcement-learning fine-tuning if the budget allows.

How it can be built without breaking what the lab is:

- The code slots (controller, planner, localizer, predictor) already define the interfaces a learned block needs;
  a learned module is a slot implementation whose weights ship with the page.
- Data collection is a Node script over `dist/core-worker.js`: it already runs an hour of simulated driving in
  seconds and can log scans, true maps, true poses, people trajectories and the classical stack's commands.
- Training happens offline in Python (PyTorch), with notebooks in a `training/` folder; the weights are exported as
  JSON or ONNX. This is the one place where Python enters the project, and it is the right one.
- Inference in the page stays dependency-free for small networks: a forward pass for an MLP or a small CNN is a
  few hundred lines of plain JavaScript and runs in the existing Web Worker; a 1 MB weight file is acceptable in
  the single-file build. Larger models would need ONNX Runtime Web (about 10 MB, loaded on demand), which is an
  explicit exception to the no-dependency rule and should be a separate, optional build.
- Phones set the ceiling: aim for networks that run at 20 Hz on a mid-range phone's CPU; the simulator's 2D world
  keeps the inputs small (120 beams, a 240 × 160 grid).

What the lessons would teach: what a network learned and what it did not (show the learned occupancy next to
log-odds, the predicted paths next to constant velocity); distribution shift (train on the grippy floor, test on
the slippery one; train on L2, test on L4); why the modular track is debuggable and the end-to-end one is not
(the health lights have reasons in Track B and only an outcome in Track C); data efficiency (how many simulated
hours each track needs); and where the classical stack still wins (consistency, guarantees, the NEES test has no
learned equivalent).

Suggested order, one PR each with a measured lesson: B1 learned occupancy from lidar; B2 learned pedestrian
prediction; C1 behaviour-cloned controller on L1 compared with pure pursuit in Analyze and in the simulator; B3
learned cost map for A*; C2 goal-conditioned policy on L5; C3 offline RL fine-tuning. B1 and C1 are small enough
to be the first proofs that the pipeline (collect, train, export, run in the page) works.
