# Nav Stack Lab v66 — assessment before the next feature track

Date: 2026-10-25. Scope: the same four areas as the v29 assessment of 2026-10-15 ([assessment-2026-10-15.md](assessment-2026-10-15.md)):
UI/UX, feature completeness, codebase quality, the learning content, plus the tests, CI and repository hygiene
that the release series added. Method: built from source, ran the whole gate (`npm run lint`, `npm run fmt:check`,
`npm test`, all eleven browser tests), ran the headless core in Node with edge-case parameters, drove the page at
1440 × 900 (light and dark) and 390 × 844 through every tab, tool, mode and one lesson per group, read all 54 lessons
and 9 chapters and recomputed every arithmetic claim in them, read the core and the build, and compared the docs with
the tree. Nothing in the repository was changed except this file and the project summary.

## Verdict in one paragraph

The v29 plan has been carried out almost in full: 37 releases in ten days delivered every Phase 0 release blocker, the
learning path, most of the workspace polish, the code-health items, the content expansion (gyro, scan matching,
pose-graph SLAM, D* Lite, LQR, frontier exploration, velocity obstacles), three learned blocks with training in the
page, levels as data with a world generator, four more sensors, and a complete safety lab. The gate is green from a
fresh clone (lint, format, 62 Node tests, eleven browser tests, 224 Try buttons, 223 chapter links). What this audit
finds is the residue of that speed, and it is small and specific: one page-freezing input path and two other
parameter-boundary bugs in the core, one reproducible console error on the phone, two lessons that can never be
completed, a noise-letter convention that the notation chapter states and three places contradict, three checks in
the gate that print instead of fail, and documentation that quotes counts and versions from v36. None of it blocks
feature work, but all of it is cheaper to fix now than after the next 10 000 lines, and the list below is about two
weeks of PR-sized work. The one structural item still open from v29, the live simulation in a worker, remains open
and should stay behind the fixes.

## What was verified

| Check | Result |
| --- | --- |
| `./build.sh` | BUILD_OK v66, 85 modules, 9 chapters, 54 lessons, 4 578 KB |
| `npm run lint`, `npm run fmt:check` | clean (1 294 shared names across 86 modules) |
| `npm test` (62 Node tests) | 62 pass, 40–54 s |
| `python3 tests/run_all.py` (all eleven) | all PASS, 766 s: smoke 42, test 34, p5test 128, tles 8, chtest 299, dyntest 59, extest 38, trtest 29, lvtest 26, sntest 32, saftest 71 |
| Try buttons / lessons / chapter links | 224 / 54 (glossary 778 terms listed, 0 bad) / 223 (0 broken) |
| Console during the desktop walkthrough (44 steps, light and dark) | zero errors, zero warnings |
| Console during the phone walkthrough | one reproducible uncaught error (UI finding 1) |
| Page load, file://, 1440 × 900 | 0.94–1.1 s to app ready, of which 0.65–0.78 s script execution; 46 570 DOM nodes |
| Frame time, L5, particle filter, 8× | p50 16.7–17.4 ms, p95 22–23 ms, 8× sustained; the simulation step is 0.2 ms p50, the frame is drawing-bound |
| Memory after 60 s and three level loads | no growth visible (`performance.memory` is quantised in this Chromium) |
| Controls without an accessible name | 0 of 1 225 |
| Lowest text contrast sampled | 4.54 : 1 light, 6.02 : 1 dark (both pass AA) |

The browser tests needed only `pip install playwright` and `NAV_LAB_CHROMIUM` pointed at an existing Chromium; the
portability work of v32 holds.

## 1. UI/UX

### Status of the v29 findings

Done: the standalone document (1), embedded fonts (2), per-level default plot and truth-aware metrics (3), lessons
reshape the stage (4), the URL hash tracks every change including replay time (5), the phone fixes (7), the code
tab (10), `lang` and contrast (11). Mostly done: the event log has severity, search, order and click-to-seek but no
search marks on the timeline ruler (8). Partly: the dock auto-sizes so the world fills the canvas, but the right panel
is still 495 px at 1440 (6); experiments draw their runs on the map with the hovered run bold, but there is no "adopt
this point's setting" (9); Learn has a Start here block, while the Simulate first-run hint is still one paragraph and
still says "across six levels" when the menu has L1–L7 plus Custom (12). Of the Phase 2 list, plot hover shows one
value at the cursor rather than every visible series with its age, there is no "trim to here", and no selection
history.

### Findings, most important first

1. **Search playback throws every frame after the stage changes (phone).** At 390 × 844: Learn → first Planning lesson
   → its first Try (the A* playback starts) → open a Control lesson (the stage becomes Analyze, the map is hidden).
   `spTick` keeps its animation loop and calls `draw()` on a zero-size canvas, the view scale goes negative and
   `arc()` gets a negative radius: `IndexSizeError` from `src/ui/maptools.js` through `src/ui/map.js`, once per frame
   until the page is reloaded. Reproducible; the only console error found. Stop the playback on lesson, mode or level
   change and return early from `draw()` when the canvas has no size.
2. **Derivation chips do not wrap.** The `a.chref` links under "Where it comes from" are inline-block monospace
   without wrapping: at 1440 the safety lesson's chip is cut at the panel edge ("…and the measured ta"); at 390 it is
   the only cause of horizontal page scroll (scrollWidth 786 for a 390 px viewport). Every other phone step measured
   390.
3. **Keyboard: tabs and the palette.** Every tab is in the tab order (no roving tabindex), arrow keys do nothing, Enter
   activates a tab but focus drops to the body because the row re-renders, and Space on a focused tab starts the
   simulation (the global Run shortcut). In the palette, Tab leaves the dialog (focus is not trapped); once it has
   left, Escape no longer closes it while the overlay still swallows every click. The "More" menu opens on Enter but
   arrow keys do not enter it. Keyboard-only operation of a lesson Try and of the level menu works.
4. **The map legend outlives everything.** Opened once with "?", it stays over the map's bottom-left corner through
   tab, tool, level and mode changes, and Escape does not close it.
5. **Phone: Changed, Runs and View have no entry point.** `.bartools` is hidden under the phone layout; Runs is
   reachable only by typing "runs" in the palette; the Changed badge with per-setting reset and the View presets are
   not reachable at all.
6. **Phone: the Mission state-machine diagram** is scaled to 328 px with 6 px labels (9 px on desktop) and cannot be
   read. Show it at natural size in a horizontal scroller or tap-to-enlarge.
7. **Tool-tab layout shift.** Picking Experiments, Train, Safety or Code at the default panel width wraps the tab row
   onto a second line ("Safety ⌄" alone under the seven pipeline tabs), so the pane jumps about 40 px on every tool
   pick. Intended since v63, but it reads as a glitch.
8. **First-run text.** The hint and the `<h1 title>` still say six levels; the hint does not point at Learn's first
   pass, so a newcomer who stays in Simulate never meets "Start here".
9. **Phone level menu** scrolls horizontally with "L4 Unkn…" cut at the edge and no scroll affordance.
10. **Small accessibility items.** The event log is a plain list, so contacts and faults are not announced (give it
    `role=log`); the `flash` keyframe and two transitions ignore `prefers-reduced-motion`; the palette footer says
    "1 results"; the Code tab's idle status is "Not loaded.".

Empty states all say something useful now (Telemetry, Runs, Safety sets, Experiments). Dark mode is consistent in
every view checked. Timing: the page is drawing-bound at the vsync floor, so the main-thread simulation is still not a
performance problem.

## 2. Feature completeness

Every gap the v29 assessment listed has been delivered: frontier exploration, scan matching, the gyro in the EKF with a
zero-velocity update, pose-graph SLAM, D* Lite, pole placement and LQR in Analyze, the MPC with the tyre model. Beyond
that list: a learned detector, predictor and policy with training in the page; levels as JSON and a seeded world
generator; GNSS, a sonar ring, radar and weather; a Sensors tab with noise profiles and a switchboard; a fault
schedule; and the safety lab (contact severity, leading indicators, ODD sheets and monitor, scenario search, learned
block monitors, a radar emergency brake, risk per hour with intervals, a GSN argument with live evidence).

Still open from the roadmap and worth stating as known limits: the live simulation runs on the main thread (a slow
plan freezes the page for its duration); runs live in memory; the MPC does not plan through a cusp; the obstacle
constraints see a lidar snapshot; health thresholds are heuristics; NEES and the phantom rule use ground truth.

## 3. Codebase quality

### Status of the v29 findings

Prettier at 140 columns is in CI and the core reads at 38 characters per line (was 117) with 10 lines over 300
characters (was 457), all data rows in `worlds.js`; comment-only lines are 6.3 % (was about 3 %). The golden baseline,
CI, the portable tests, the manifest order, the `PARAM_EFFECTS` table with option-list validation, the ESLint check
of every free identifier against the manifest, and the numerics unit tests are all done. The UI writes `P` directly
in four places (all `P.seed`) and `S` in six (clearing trails for a map tool), down from 16 and 6. `ctlMPC` had five
helpers pulled out and is still 213 lines. The live simulation in a worker is not started.

### Correctness bugs (each reproduced on the headless core)

1. **A negative control latency freezes the page.** `src/core/step.js:117`: `n = round(latency / DT)`; with `n < 0`
   the loop `while (S.cmdQ.length > n) S.cmd = S.cmdQ.shift()` never ends. Reachable from a setup link
   (`#l=L1&latency=-0.1`), a fault schedule and a worker override: `setParam` checks only that a number is finite.
   The loop runs inside `advance`, so the tab hangs. High.
2. **The fault schedule skips every costly effect.** `src/core/config.js:72` applies scheduled events with
   `setParam(k, v, true)`, and `true` is the "slider still being dragged" flag, so the effects gated on it
   (costmap rebuild and replan for `unknownAs`/`infl`, the planner parameters, the vehicle geometry, the outage and
   seed log lines) never run for a scheduled change. The shipped schedules use only ungated keys (`lidar`, `vcruise`,
   `biasW`, `bOff`), so no lesson is affected; a user-authored schedule in Tools → Safety is. Medium.
3. **A level's `settings` bypass the validation.** `loadLevel` assigns `LV.cfg` onto `P` with a `typeof` check only,
   so a level file or `lj=` link with `"plan": "foo"` loads silently (the planner falls through to RRT*, the log says
   "Plan · undefined"), and `"npart": -5` throws out of `reset()`. Medium.
4. **`mpcNp = 0` throws every tick** (the warm start reads an empty array); `mass`, `Iz` or `wheelbase` of 0 make the
   pose NaN and log a phantom collision at t ≈ 0; `npart` has no cap (10 000 000 runs for minutes). Sliders floor all
   of these, so only links and schedules reach them. Low.
5. **A core exception stalls the simulation silently.** `src/ui/loop.js:28` calls `advance(n)` without a catch and
   there is no `unhandledrejection` handler, so after bugs 3 or 4 the robot stands still with nothing in the log.
   The worker path does report its errors.
6. **`k in DEFAULTS` admits prototype keys** (`__proto__` makes `setParam` throw a caught TypeError), and `goals=` in
   a link is not checked for finiteness ("Plan · Straight NaN m"). Five lines.

The sandbox for user code is still sound (Blob-URL Worker, strict mode, timeouts, coerced and bounds-checked
results, no `eval` or `new Function` in `src/`); the one leak is a blob URL that is never revoked per Load. The
filters and planners guard their determinants and pivots; sixty odd parameter values (zero reach, zero rates,
negative noise, missing models, 100 % outages, latency of either sign) ran without NaN or exception apart from the
cases above. The weak spot is the parameter boundary, not the algorithms.

### Structure

- **The run state is grown lazily.** `reset()` initialises 53 fields of `S`; 51 more are added by modules on first
  use (`S.dstar`, `S.pg`, `S.slam`, eleven `S.policy*` fields, `S.vo*`, `S.sched*`, `S.rad*`, `S.son*`, …). There is no
  one place that says what a run carries, and reset relies on the new object dropping the old fields. This is the main
  obstacle for a contributor in the core.
- **Three parameter entry points with three rules.** `setParam` checks choices and finiteness; `loadLevel` checks
  `typeof`; the worker sets `P.seed` unchecked and `tryGo` writes it directly. No parameter has a range outside the
  slider schema.
- **Density.** The core is 13 210 lines (roughly doubled since v29); 974 functions, 36 over 60 lines, 17 over 100,
  6 over 200: `RS` 258, `hybridAstar` 239, `stPlan` 233, `missionTick` 214, `ctlMPC` 213, `healthNow` 204. Of the 34
  top-level core functions over 60 lines, 28 have a header comment and 6 do not (`agVO`, `healthSensorChecks`,
  `policyPlan`, `slotWorker`, `reset`, `actuate`). Across all 85 modules: 78 functions over 60 lines, 33 over 100,
  174 lines over 300 characters (the longest 1 974 in `ui/train.js`).
- **Duplication.** Five grid searches each with their own open-set loop (`astar`, `dstarPlan`, `stAstar`,
  `holoField`, `hybridAstar`) sharing only the heap; `agTrackFused` in `radar.js` repeats the track lifecycle of
  `agTrack` (34 identical non-trivial lines including the pruning).
- **Dead code.** `beaconDown`, `customWorkerOf`, `preControl` and the `NUM_BEGIN` marker are referenced nowhere.
- **No tests for `analysis/num.js`** (`eig`, `pRoots`, `expm`, `cxSolve`); every other closed-form numeric has one.
- **The core/UI boundary holds** (only `performance.now` and the sandbox's Worker in `core/`), memory is bounded
  (log 200, plot 3 000, trails 1 500, replay 3 000 frames, level cache 8, tracks pruned), grid buffers are reallocated
  on a world change, and the manifest order is exact.
- **Learned models.** Detector 72 KB, predictor 70 KB, policy 763 KB (119 108 parameters at three decimals); all
  carry input, output, training and `ref` metadata, and a test checks `ref` against the input description. The page
  inlines the weights once. The policy would halve at three significant figures; nothing requires it.

## 4. Learning content

### Status of the v29 findings

All four must-fixes are done: a Try that names a level resets the seed to 7 (a number pins it, `next` steps it), the
Stanley sign, the PID row, the Symbols tab's `b`, the two numeric slips. The should-fixes are done too, with the
exceptions below: a Start here block with prerequisites, an eight-lesson first pass with minutes, progress in the
browser, predict-first on every Try, one quantitative self-check per lesson, control lesson 1's chips defined in
place, a notation chapter (ch9) with a "letters that mean two things" table and a reference list, lessons in
markdown, the level Try lists labelled "Quick experiments". Every arithmetic claim in the 54 lessons and the 9
chapters was recomputed; all the Check-yourself answers and the derivations in ch1, ch2, ch3, ch5 and ch6 are right.

### Errors and conflicts

1. **Two lessons can never be completed.** The Check yourself of `per/07` and `per/08` has no `Tolerance:` line;
   `tools/lessons.mjs` then leaves `tol` undefined and `src/ui/learn.js:319` compares `Math.abs(x − a) <= undefined`,
   which is false for every answer, so 1 200 and 1 600 are rejected.
2. **The noise letters are swapped again.** Chapter 9 fixes Q = measurement noise, R = process noise, M = odometry
   noise. Against it: ch2 §12 (GNSS) and `loc/09` write R for the measurement and Q for the process; the Perceive
   How-it-works panel (`src/ui/notes.js:63`) writes Q for the tracker's process noise where `per/03` and ch3 write R;
   the glossary's `Qproc` ("process noise covariance") is attached to the tracking lesson whose equation says Q is the
   measurement; `Rm` is attached to EKF-SLAM whose text now writes Q while its code focus and the Localize panel still
   say R. The Localize panel also still writes the bearing as φ (`notes.js:31`), which ch9 says was retired.
3. **One chapter number is wrong.** ch2 §9: "At 0.5°/s and 0.8 m/s that is 30° and 7.9 m after a minute" should be
   12.6 m (½ · 0.8 · 0.00873 · 60²), as the lesson's own self-check says.
4. **One lesson number does not reconcile.** `ctl/01` quotes a crossover of 2.27 rad/s for the car at 0.6 m/s with the
   default lookahead, where the lesson's own rule ω_c = 2.2 v₀/L_d gives 1.65; the delay margin quoted is consistent
   with 2.27, so the chip may be right and the stated speed or lookahead wrong. Remeasure and state the setting.
5. **Two "95 %" intervals in one breath.** `saf/08` Try 2 gives "0 to 2.9 per hour" (two-sided, 3.69/T) and "below
   2.4 per hour" (one-sided, 3/T), both as 95 %; ch8 explains the difference, the lesson does not, and Try 3 repeats
   it.
6. **Cross-references.** ch5 cites "chapter 1 §5" twice for the limits (it is §6); ch2 §9 cites "chapter 3 §2" for the
   distance transform (it is §3); the roadmaps at the top of ch2 and ch3 announce lessons 1–5 only, not §9–§12.
7. **Predicts under the wrong Try.** In `per/10`, three "Before you press" questions sit under the Try before the one
   they describe (fog lidar-only asks about the radar run, and so on), so the learner predicts one run and watches
   another. `loc/01` Try 1's answer ("heading outside the 2σ band after two minutes") is the claim its own text says
   does not hold on seeds 2, 3 and 8; the ten-minute claim does.
8. **Number drift between a lesson and its chapter** (six cases, e.g. ch7 "0.8 s" vs `ctl/17` "0.85 s", ch3 "96 % to
   84 %" vs `per/04` "83 %", ch4 "Dolgov 2008" vs ch9 "2010"), and two small notation slips (`ctl/08` K_p in the
   formula, k_i in the prose; the Symbols tab gives k_e the unit 1/m² while ch9 gives none; ch1 writes α_f with δ
   while ch7 and the code use tan δ).
9. **Still order-dependent:** one Try of 224 names no level (`ctl/03` "measure the loop as it is set now").
10. **Seed caveat missing** in 8 of the 22 lessons that never mention a seed and do run the simulator (`ctl/14`,
    `ctl/15`, `ctl/17`, `per/01`, `per/05`, `plan/01`, `plan/03`, `loc/02`); `loc/06`'s "All numbers below are at seed 7
    over 120 s" is the sentence to copy.

### Structure and path

Every lesson has a Try with cfg, Setup, See, Shows and (for 216 of 224 Trys) a Predict with options and a valid
answer, three Think-about pairs, a Check yourself and at least one chapter link; 223 chapter links resolve. Lessons per
group: control 18, localization 9, perception 10, planning 8, safety 9 (62, 38, 51, 32, 41 Trys). Eight Trys have no
Predict (reference runs); the progress strip still counts them.

The minute estimate counts only the body paragraph (`words / 170`, minimum 3), about a third of a lesson's prose,
and nothing for the experiments. The safety group names the standards it uses but not the lessons it assumes
(`saf/03` leans on `per/08`, `saf/06` on `per/07–08` and `plan/08`, `saf/08` on `saf/05`), and the first pass has no
safety, gyro, scan-matching or people lesson. Terms used before any definition and absent from the glossary: Frenet
(`ctl/01`, ch5, ch6), the zero of a transfer function (`ctl/03`), inscribed-angle theorem, argument principle,
describing function (four lessons before `ctl/09` defines it), Lyapunov, Padé, Bresenham, lock-in, Joseph form used
bare in `loc/09` and `per/10`. Ten works cited inline are missing from ch9 §4 (Pomerleau 1989, Ross & Bagnell 2010
and 2011, Laskey 2017, Cui 2019, Bishop 1994, Fiorini & Shiller 1998, van den Berg 2008, Koenig & Likhachev 2002,
Yamauchi 1997, Samson). Two "-ish" survive.

### The safety lessons

All nine lessons carry the same two-sentence disclaimer (paraphrase only; clause numbers from public outlines, not
checked against the texts), and ch8 says it once. No sentence, table or figure from a standard is quoted; claims are
phrased as the lesson's reading. The lessons cite 38 clause mentions, 29 distinct (standard, clause) pairs; chapter 8
adds one more. `docs/safety-lab.md` §10 has the 34-row check table (33 unchecked, one confirmed from a contents page),
which is the "33" in the project summary. Three inconsistencies in the marking: `saf/09` still says 6.4.8 is
unchecked while the table says confirmed; safety-lab.md's own rule says every clause number is confirmed before a
lesson is released and the lessons were released unconfirmed; the lessons say "UL 4600 third edition" and ch8 adds
the year. By the project's own table, the five citations resting on the weakest ground are `saf/01` (UL 4600 clause 8
for the ODD), `saf/03` (the four SOTIF areas in "clause 4"), `saf/07` (ISO 21448 clause 8), `saf/08` (clause 9) and
`saf/04` (the FTTI from part 1 clause 3); they deserve the first hour of the owner's check. One judgement call: `saf/02`
and ch8 restate the ASIL table as a sum rule, which is the whole table by another name; safety-lab.md says that
table is not reproduced.

### Prose

The lessons are in good shape: median sentence 18–20 words in every group, the "Why this matters" paragraphs average
24–28 words, and the voice holds ("Benchmarking a sampling planner on one seed measures the seed"; "Silence is
evidence, but weak"). The long sentences live in two places: the chapters (ch3 and ch4 have half their sentences over
40 words; ch6 §1, §3, §5 and §7 are at 38–50 % against 20 % in the §6 worked table) and the "See:" lines that carry a
run log in prose (`loc/08` has one 87-word sentence with eight numbers; `loc/01`, `per/10`, `plan/07` and the safety
lessons do the same). The chapters already tabulate these results; the lessons should too.

## 5. Tests, CI and repository hygiene

### Status of the v29 Phase 0

Done: the standalone build, the fonts, LICENSE/NOTICE/CITATION/CODE_OF_CONDUCT/CONTRIBUTING, the maintainer doc, the
portable tests, the Node golden tests, the three workflows, the content must-fixes, `legacy/` and the screenshots
removed, issue forms and labels. Partly: the README has no GIF and quotes stale counts; no screen-reader walk is on
record; zero issues have ever been filed and five of the nine good-first-issue drafts are already delivered.

### Findings

1. **Three checks print instead of failing.** `chtest.py` collects unfilled live values ("—") and prints them without
   adding them to its errors; `tles.py` prints the glossary's `bad` list and gates on page errors only; `p5test.py`
   computes the level and FSM state after each Try and never asserts on them. All three pass today because the
   content is right, not because the test would catch it.
2. **`npm run golden` blesses a regression in one command.** `--write-golden` overwrites `golden.json` without
   printing a diff against the committed file, and CI's only reaction to a changed golden is that the test passes.
   `maintaining.md` still says the L1–L5 summary has been byte-identical since v16; it was regenerated on 2026-10-20
   (L4 with unknown as lethal, 0 → 4 goals, explained in the commit). `test.py` runs the same 14 cases through the
   page but asserts nothing on its printout, so the page path (click wiring, UI `advance`) is covered only by a human
   reading it.
3. **No browser test runs on a PR.** `ci.yml` runs lint, format, build, the dist check and the Node tests (about 65
   s); the 42 s smoke test is run by hand on one machine. The nightly re-downloads Playwright and Chromium (unpinned,
   uncached), uploads nothing on failure, and starts five to six hours after its cron. No `permissions:` block, no
   dependency cache, no PR template, no Node matrix although `engines` says ≥ 18 and CI tests 22 only (the `--test`
   glob in `package.json` may not work on 18).
4. **23 UI modules and the stylesheet map to no test.** A change to `ui/panes.js` (which holds `tryGo` and the seed
   logic), `ui/schema.js` (every setting's UI), `ui/transport.js`, `ui/replay.js`, `ui/runs.js`, `ui/palette.js`,
   `ui/plots.js`, `ui/workspace.js` or `src/styles.css` runs only `smoke.py`, whose assertion is "the pane has text and
   nothing threw". Replay and the loop region, runs keep/compare/export/import, the palette, Layers, the URL hash
   round trip, the keyboard sheet, dark mode, What's new, the How-it-works panels and the plot dock have no test.
   Six scripts in `tests/` (`p1test`–`p4test`, `wtest`, `tag`) are print-only leftovers from phases 1–4.
5. **Versions and counts are stale.** `package.json` says 36.0.0 and `CITATION.cff` version 36 dated 2026-10-16
   against v66; there are no git tags, so "the tree at v50" needs a `git log -S`. README says 50 lessons (54), `npm
   test` "about 10 s" (40–54 s), and links the demo that is off; `src/README.md` says eight chapters and 32 lessons and
   lists none of the 15 core modules added since v36 nor anything in `ui/`; CONTRIBUTING names one of the nine Node
   test files; `maintaining.md` step 1 says "No test gate yet"; the issue-template config sends reporters to the
   demo and its placeholders say v30; `PROJECT-SUMMARY.md`'s commit is v64's.
6. **Roadmap and good-first-issues list delivered work as open.** "Candidate next steps" still offers the sonar ring,
   scan matching for SLAM, velocity obstacles and "first proofs B1 and C1" of the learning tracks, all shipped; the
   Phase 4 heading still says "in progress". Good-first-issue drafts 4, 5, 6 and 8 are done and 9 superseded; draft
   1's file number is taken and its "done when" cites a script that is not in the gate.
7. **The training procedure produces a model the tests reject.** `training/README.md` goes train → `src/models/x.json`
   → build, but the `ref` block the OOD monitor needs comes from `tools/ood-ref.mjs`, which neither the README nor the
   trainers mention; `learnmon.test.mjs` then fails on the new model. The README's "a few tens of kilobytes each" is
   wrong for the 763 KB policy.
8. **Page weight.** 4.70 MB: models 883 KB (the policy 745 KB of it), lessons 804 KB, chapters 615 KB, code about
   1.34 MB, the core a second time as the worker's source 533 KB, fonts 213 KB, CSS 100 KB; 1.38 MB gzipped. Growth
   is about 33 KB per release with 100–300 KB jumps on lesson-heavy ones. Load is about a second on a laptop, so this
   is not urgent; the two cheap cuts are the policy at three significant figures and cutting the worker's source from
   the page's own script at runtime, as the lesson snippets already are.
9. **Small things.** `.venv/` is not in `.gitignore` though the README says to create it there; `npm test` throws
   ENOENT instead of "run ./build.sh first"; no `requirements.txt` pins Playwright; `training/` and the collectors
   have no SCOPE entry.

## Plan

Ordered by what protects the next feature track; each bullet is one PR. Phase A is what to do before any new
feature, about a week; B and C can interleave with feature work.

### Phase A — fix what is broken (about a week)

1. Parameter ranges in the core: a `PARAM_RANGE` table next to `PARAM_OPTS`, enforced in `setParam`, with
   `latency`, `sensLat`, `npart`, `mpcNp`, `mpcDt`, `mass`, `Iz`, `wheelbase`; clamp the command queue length; a Node
   test for a negative latency. (Code bugs 1, 4.)
2. The fault schedule applies with `live = false`, plus a Node test that a scheduled `infl` change replans. (Bug 2.)
3. A level's `settings` go through the same validation as a link, and the parser reports "plan has no value foo".
   (Bug 3.)
4. The page loop catches tick errors into the event log and a window `unhandledrejection` handler. (Bug 5.)
5. Stop the search playback on lesson, mode and level change; `draw()` returns on a zero-size canvas. (UI 1.)
6. `Tolerance: 0` default in `tools/lessons.mjs` (or the two lines in `per/07` and `per/08`). (Content 1.)
7. One noise-letter convention: ch2 §12, `loc/09`, the three How-it-works lines, the two glossary entries, the
   `loc/05` focus; the Q/R row in ch9's table; φ → b in the Localize panel. (Content 2.)
8. Chapter numbers and cross-references: 12.6 m, ch1 §6, ch3 §3, the ch2/ch3 roadmaps, the six drifts; the three
   `per/10` Predicts moved, `loc/01` Try 1 reworded, `ctl/03` Try 3 given a level, `saf/08`'s one- and two-sided
   intervals named, `ctl/01`'s 2.27 rad/s remeasured. (Content 3–9.)
9. Make the printed checks fail: chtest's unfilled live values, tles's glossary list, p5test's level and state. (Tests 1.)
10. Derivation chips wrap; the legend closes on Escape and on a stage change. (UI 2, 4.)

### Phase B — keep it honest (one to two weeks, interleaved)

1. `smoke.py` and `npm test` on every PR with npm and Playwright caches; the nightly pinned, cached, and uploading
   its log and a screenshot on failure; `permissions: contents: read`.
2. The golden guard: `--write-golden` prints the diff and requires `--why`; CI fails when `golden.json` changes
   without a `golden:` line in the commit; `test.py` asserts its summary against the same JSON.
3. One source of truth for the version: a release step or CI check that `package.json`, `CITATION.cff` and the issue
   templates equal `src/version.json`; `git tag vNN` on each release.
4. A UI test for the 23 uncovered modules (replay and loop, runs keep/compare/export/import, palette, Layers, URL
   round trip, keyboard sheet, dark mode, What's new, How-it-works, plots and CSV), mapped in `SCOPE`; retire the six
   print-only scripts.
5. Keyboard: roving tabindex and arrow keys on the tab rows, Space activates a focused tab, focus kept across the
   re-render, arrow navigation in More; the palette traps focus and Escape closes it from anywhere.
6. Phone: Changed, Runs and View in the bottom bar or the sheet header; the Mission diagram at natural size in a
   scroller; a scroll affordance on the level strip.
7. Docs refresh in one PR: README (54, timings, the GIF or drop the promise, the demo note), `src/README.md` as a
   complete module map including `ui/` and `analysis/`, CONTRIBUTING (the Node tests, versions, build before test,
   the SCOPE rule), maintaining ("No test gate yet", the baseline sentence), the issue-template config, the summary's
   commit; prune the roadmap's next steps and the good-first-issue drafts.
8. `training/README.md` documents the `ood-ref` step (or the trainers write `ref` themselves) with a test that a
   model without `ref` is rejected with a message.
9. Declare the whole run state in `reset()`: the 51 lazy `S.*` fields initialised with a one-line comment each.
10. Seed caveats in the eight simulator lessons; glossary entries for the ten undefined terms; the ten missing
    references in ch9; the minute estimate over the whole lesson; the safety disclaimer aligned with `safety-lab.md`
    (6.4.8 confirmed, the "confirmed before release" rule rewritten, the UL 4600 year).

### Phase C — code health (ongoing, one PR each)

1. Split the six functions over 200 lines along the comments already inside them (the golden tests make it safe).
2. Merge `agTrackFused` into `agTrack`; consider one open-set loop for the five grid searches.
3. Tests for `analysis/num.js`; delete the dead code; revoke the slot worker's blob URL; `Object.hasOwn` for the
   `in DEFAULTS` checks and finiteness for link `goals=`.
4. "See:" run logs as tables in `loc/01`, `loc/08`, `per/07`, `per/10`, `plan/07` and the safety lessons; shorten ch3,
   ch4 and ch6 §1/3/5/7; `role=log` on the event log; reduced-motion guards; the first-run hint says L1–L7 and points
   at Learn's first pass; the tool-tab row stops shifting.
5. Page weight: the policy at three significant figures; the worker's source cut from the page's script at runtime.
6. The live simulation in a worker, as its own phase, after A and B: the estimate in the roadmap (about a week) still
   holds, and the error-handling and state-declaration PRs above are its prerequisites.

### The safety clause numbers

The owner's hour with the standards is unchanged as the next action for the safety lab, and this audit narrows it:
start with the five citations the project's own table marks as secondary or disputed (`saf/01`, `saf/03`, `saf/04`,
`saf/07`, `saf/08`), then decide on the ASIL sum rule, then the rest of the 33 rows.
