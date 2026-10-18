# Changelog

The version label in the page header (`v40 · 2026-10-16`) is the number used here; `src/version.json` holds it.
Design notes per feature are in [docs/roadmap.md](docs/roadmap.md).

## v48 · 2026-10-18

- The Simulate tabs' "How it works" panels are typeset too, and so are the two formulas in Analyze's derivations
  (with today's numbers in them). In JS source, a template literal tagged `TEX` holds TeX; the build rewrites it into
  MathML (`texSource` in `tools/tex.mjs`), so the page still never sees TeX. The state machine in Mission's panel is now
  a list of transitions. Fixed for all math: the columns of aligned equations were centred (temml's alignment classes
  had no CSS), so `=` signs did not line up in lessons, chapters or panels. (PR #101)

## v47 · 2026-10-18

- Lesson math is typeset: the lessons take TeX like the companion notes (`$…$` inline, `$$…$$` display), turned into
  MathML at build time (`tools/tex.mjs`, shared with the notes; the page keeps zero runtime dependencies). All 41 lessons
  converted: matrices, aligned systems, fractions and subscripts instead of plain-text `G = [1 0 −vΔt sin θ; …]`. The
  build refuses a lesson with an old `<div class="eq">` block.
- Every lesson's Try text checked against headless runs of the button (seed 7, and seeds 1–5 or more wherever a
  prediction compares runs). Fixed: numbers that no longer matched, Predict questions whose answer flipped with the seed
  or rested on a figure the page does not show (an RMS, a precision, a clearance), and three lessons (Localization 6 and
  8, Control 18) whose Predict questions each asked about the next Try. Dead reckoning's "Noise ×3" now asks what
  reliably triples (the 2σ band), since the error itself was 2–9× the ×1 run's at different moments of seed 7 and 0.5–2.9×
  in RMS over seeds 1–8.
- The what-if caption in Analyze says "would turn" / "would steer" (it said "would turns"). (PR #100)

## v46 · 2026-10-18

- The level menu scrolls: its grid row grew with the content past the menu's capped height, so on L3–L7 the last
  quick experiments were cut off with no scrollbar.
- Reset all progress works in the published artifact: it asked with `confirm()`, which the artifact's sandboxed frame
  blocks (it returned false without asking). It now asks for a second click within 4 s. (PR #99)

## v45 · 2026-10-17

- Training in the page (Tools → Train): retrain the people detector or the end-to-end policy from the GUI. Data from
  headless runs on levels, the map on screen, saved maps or random obstacles, with the map's, placed or random goals and
  any number of runs (DAgger rounds for the policy); four network shapes per block, from random or the built-in weights;
  backpropagation and Adam in plain JavaScript over up to four workers; the result against the built-in model on a
  held-out run; trained models kept in the browser, picked in Perceive → Detector model and Plan → Policy model,
  variable in Experiments, saved and imported as JSON in the format of `src/models/`. The collectors share the page's
  code (`core/dataset.js`, `detFeatures`) and write the same files as before. `tests/node/train.test.mjs`,
  `tests/trtest.py`.
- Changing level in the level menu or the search keeps the settings you changed (not the map edits, the beacons switched
  off, or a planner or tracker the new vehicle cannot use); Try buttons, lessons and links still start from the level's
  own setup. Control → Real-time budget per solve sets the MPC's 15 ms deadline (0: none); `dyntest.py` compares the
  page and the worker without it, so the check no longer depends on the computer's speed.

## v40 · 2026-10-16

Phase 4, the learning tracks, first blocks:

- An end-to-end policy (Plan → Learned policy): a multilayer perceptron (139 → 256 → 256 → 16, 105 744 parameters,
  665 KB inlined) from the scan with sector minima, the odometry and the goal in the robot frame to eight waypoints
  along the route, run as a planner the tracker follows, replanned every 0.5 s, with a safety layer that moves a
  waypoint out of an inflated obstacle; a subgoal mode points it 3 m along the A* route. Trained by behaviour cloning
  (`tools/collect-policy.mjs`: random goals, actuation noise on the expert's commands, A* labels; DAgger rounds with
  the policy driving; `training/policy/train.py`). Measured and told plainly in planning lesson 8 and chapter 4 §10:
  all goals on the open floor, four of five on the busy floor it never saw, a collision at the first shelf corner of
  the aisles and the building's doors beyond it, through noise injection, DAgger and the subgoal. `actNoise` on the
  vehicle for the collectors, `setGoals` for goal lists, a Node test of the perceptron.

- A learned people detector (Perceive → Agent tracking → Learned detector + Kalman): a 1D convolutional network over the
  120 beams (circular padding, 8 017 parameters, 66 KB inlined) that labels each beam "person" or "static" from six
  features, among them the previous scan reprojected through the odometry so that the robot's own motion is taken out;
  beams above 0.6 are clustered as the rule's unexplained hits are and handed to the tracker. Trained in PyTorch
  (`training/detector/train.py`) on 19 200 scans collected by `tools/collect-detector.mjs` over the headless core;
  the forward pass runs in `src/core/nn.js` with no dependency. The lidar layer colours hits by the probability.
  Measured on L5: precision 0.66 under lidar mapping against 0.07 for the rule without a settled map; 0.73 against
  the rule's 0.92 with a prior map. Per-target scan matching (Perceive → Agent tracking) aligns a track's hits from one
  scan to the next by ICP and fuses the displacement as a velocity measurement (0.40 to 0.25 m/s RMS). Perception
  lesson 7, chapter 3 §9, `tests/measure_det.py`, a Node test of the forward pass, `training/README.md`.

## v39 · 2026-10-16

- Velocity obstacles (Control → Response to agents → Velocity obstacles, for the path trackers): one cone per tracked
  person (the ray-disc quadratic within a horizon τ), the tracker's command tested against them and, when inside,
  replaced by the nearest of 76 sampled velocities outside all cones (speeds down to a quarter, headings to 90°, a
  slow reverse), realized as a speed and a turn; stop when none is free. A Velocity obstacles map layer (the cones in
  world coordinates scaled by τ, the command and the chosen velocity), horizon and clearance sliders, a Control info
  line with the interventions and stops. Perception lesson 6, *Velocity obstacles: steering around people in velocity
  space*, five measured experiments on the busy floor (scripted people who walk through the robot, reacting people,
  the shelf the cones do not know), chapter 4 §9.
- D* Lite (Plan → D* Lite, `core/planning-dstar.js`): the grid search kept between plans, run from the goal, with g and
  rhs per cell, the two-part key packed into one number, k_m for the robot's motion, a costmap diff (lethal flips and
  penalty moves over 0.1) that repairs only the touched vertices; the same cost model as A*, so the same paths; the
  search is dropped when the goal, the planner or ε changes. Each plan logs its vertex updates and the cells changed;
  the mission keeps plan totals (count, expansions, ms). Planning lesson 7, *D* Lite: repairing the plan instead of
  starting over*, five measured experiments with the honest reading (six-fold fewer expansions on a static map with a
  periodic replan, more work than A* when lidar mapping or agent stamps change thousands of cells), chapter 4 §8.
- Pose-graph SLAM (Localize → Pose-graph SLAM, lidar only): keyframes every 0.5 m with their scans, each first aligned
  to the hit map of the earlier keyframes and fused with the odometry (the edge carries the matched motion), loop
  closures by scan-to-scan ICP against keyframes at least ten back within a reach that grows with the uncertainty,
  Gauss–Newton over all poses with the first fixed (dense Cholesky, one optimization per second), the current pose's
  covariance from the marginal, the hit map and the planning grid rebuilt from every kept scan at the new poses. A
  Pose graph layer, a Localize info line, the "Loop closures" and "Map agreement" signals, switches for the two levels
  and the keyframe spacing, `goals` in a Try cfg (the mission restarts on them). Localization lesson 8, *Pose-graph
  SLAM: the map that closes the loop*, six experiments on an out-and-back tour of L4 (with the honest finding that
  scan-to-map matching does most of the work and closures need a gyro-grade odometry to be found), chapter 2 §11,
  Node tests for the pose algebra, ICP and the optimizer.

## v38 · 2026-10-16

- Scan matching (Localize → Lidar scan matching, with the EKF and a prior map): every fourth tick the scan is aligned
  to the map's distance field by Gauss–Newton from the current estimate and fused as a pose measurement with the
  covariance of the fit (inflated, floored at 5 cm), gated, fused only after the robot has moved, dropped when the fit
  is poor. The lidar becomes a position sensor: 4 cm RMS on L3 with every beacon off. A Localize info line reports
  each match; Signals has the residual; `bOff: "all"` in a Try switches every beacon off. Localization lesson 7, *Scan
  matching: the lidar as a position sensor*, five measured experiments including the kidnap that scan matching cannot
  see (perceptual aliasing), chapter 2 §10, the loc slot gets the map's distance field once (`obs.field`) and a
  scan-matching example.
- The code behind every lesson. Each of the 35 lessons shows the page's own function for what it teaches (cut from the
  page's source at runtime by `// @code` markers, so it cannot drift), with the lesson's lines marked, a note on what to
  look at and change, and "Edit and run", which puts a plain slot version of the algorithm into the Code tab as "Your
  code" on the lesson's level. Twelve slot examples (`src/examples/`): dead reckoning, EKF, particle filter; A*,
  Dijkstra, RRT*; pure pursuit, Stanley, PID, rear-wheel feedback; constant velocity, standing still. The Code tab gets
  an examples menu and a "How this fits in" panel per slot (where it runs in the tick, what it gets and returns, what
  happens when it fails); the "Your code" choice in Localize, Plan, Control and Perceive explains itself with a button
  into the Code tab. `tests/extest.py` runs every example against its built-in.

## v37 · 2026-10-16

Phase 4, content (from the assessment of 2026-10-15 and the owner's direction):

- A yaw-rate gyro for every vehicle (Vehicle → Yaw-rate gyro): the turn rate comes from the gyro instead of the
  wheels, with its own noise σ and a bias the filter is not told, and a zero-velocity update that holds the robot
  still for 2 s at the start of a run, averages the gyro into a bias estimate and subtracts it. The filters' assumed
  turn-rate noise follows. Lesson 6 of the localization group, *A gyro in the loop: heading is the expensive error*,
  with six measured experiments, and chapter 2 §9 with the random walk, the bias integrals and the update.
- Analyze: a design row under the pole plot. Pole placement by damping and natural frequency, and LQR from three
  weights with the closed-form gains, both shown as a what-if where the pair really lands with the delays in the
  loop; a lesson Try can ask for either (`place`, `lqr`). Control lesson 18, *Placing the poles on purpose: pole
  placement and LQR*, and chapter 6 §8 with the Riccati equation solved in closed form.
- Frontier exploration (Mission → Goal order → Explore) on any level with lidar mapping: the robot picks its own goals,
  the largest nearby frontier (known free next to unknown, at least N cells), drops a goal once nothing behind it is
  unknown any more, retries the ones that failed once nothing else is left, and stops when the map has no frontier.
  A Frontiers layer, a "Floor seen" signal and status metric, L4 gets an Explore button. Lesson 6 of the planning
  group, *Frontier exploration: the robot picks its own goals*, with five measured experiments, and chapter 4 §7.

## v36 · 2026-10-16

Phase 3, code health (from the assessment of 2026-10-15):

- `npm run lint`: ESLint with the shared scope's names generated from the manifest, so a misspelled cross-module
  reference fails statically instead of at runtime on that path; CI runs it. ESLint is a dev dependency only
  (`npm install`); the build and the page still need nothing.
- The source is formatted with Prettier at 140 columns (`npm run fmt`, checked in CI); one reformat commit, listed
  in `.git-blame-ignore-revs`. The lines go from 6,277 to 19,610 with no change in behaviour (the golden tests and
  the browser gate are identical).
- The three biggest functions are split: `draw` (477 lines) into eighteen layer functions in drawing order, `ctlMPC`
  (349) into the controller plus six helpers (agent predictions, agent constraints, warm start, linearization,
  rollout, the constraint set) with explicit parameters, `renderAnalysis` into the view plus four section helpers.
  The lint found the two locals the first cuts had missed. Every remaining function over 100 lines has a header
  that says what it does.
- Fix: switching to DWA (or your code) while the step test was playing threw in the response plot's playback; the
  playback now stops when the tracker has no linear model.
- `setParam` validates: a choice parameter must be one of its values (`PARAM_OPTS` in `core/params.js`) and a numeric
  one a finite number; anything else is ignored with a log line instead of falling into a default branch (a mistyped
  setup link `plan=foo` used to run RRT*). Its if-chain of side effects is an ordered table, `PARAM_EFFECTS`.
- Unit tests for the closed-form numerics (`tests/node/numerics.test.mjs`, in `npm test`): the 3 × 3 inverse, the
  Cholesky solve, the box QP, the distance transform, Reeds–Shepp lengths and samples, A* on a free line and round
  obstacles, and the textbook properties of one EKF update. The worker exposes them to Node as `self.__core`.
- `ui/st-plot.js` moves after the core in the manifest, so the core/ui split in the concatenation order is exact.
  Running the live simulation in the worker was assessed and deferred (a week of its own; `docs/roadmap.md`).

## v35 · 2026-10-16

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
- The telemetry dock takes the height that leaves the map at the world's 3:2 aspect (between 150 and 320 px) until
  the splitter is dragged, so the map no longer sits letterboxed between empty margins on the wide layout.
- The Code tab's editor highlights comments, strings, numbers, keywords and the slot API's names, tints the line an
  error names, shows the line count, and says what the sandbox allows.

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
