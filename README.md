# Nav Stack Lab

A browser simulator for autonomous-robot navigation: localization (dead reckoning, EKF, particle filter, EKF-SLAM),
perception (log-odds mapping, costmaps, agent tracking and prediction), mission and planning (A*, RRT*, Hybrid A*,
space-time A*, ST speed planning), control (pure pursuit, Stanley, rear-wheel feedback, PID, DWA, MPC) for a
differential-drive or car-like robot, plus a loop-analysis view (Bode, Nyquist, step, root locus) with guided lessons.

Live version: https://claude.ai/artifact/UF1o4AwGB7PaMe4dw8kyM7 · Roadmap and design notes: [docs/roadmap.md](docs/roadmap.md)

## Build and test

```sh
./build.sh                 # node build.mjs → dist/nav-stack-lab.html, dist/core-worker.js; tests/wrapped.html
cd tests
python3 test.py            # L1–L5 regression summary (goals, contacts, time, errors)
python3 p5test.py          # every Try button runs without errors
python3 tles.py            # lessons
python3 chtest.py          # companion notes: live values and Try buttons
```

The tests need Python 3 with Playwright and a Chromium (`pip install playwright && playwright install chromium`).
`dist/nav-stack-lab.html` is committed so the published artifact always matches a commit.
`legacy/` holds the patch scripts the single file was grown with before the split into modules (v1–v7).

## Companion notes

`docs/notes/*.md` are the textbook chapters shown in the app's Learn mode. They are markdown with TeX formulas, plus
`{{live:key}}` for numbers the app computes from the current settings and `[try: Label | {cfg}]` for buttons that set the
simulator or the analysis up. `node build.mjs` converts them (TeX → MathML with the vendored temml) and inlines them in the page.
A lesson links to the section that derives its formula with `<a class="chref" href="#notes=ch2/<section-slug>">` (the slug is the
heading's id without `n-`; `#notes=ch2/<slug>` also works as a deep link), and Back from the chapter returns to the lesson.
Lesson Try buttons may carry an explanation, `['Label', cfg, {setup, see, shows}]`, rendered as numbered experiment cards, and a
lesson may carry questions `q: [[question, answer], …]`.

## Source layout

One page, built from these modules by `node build.mjs` (Node 18+, no dependencies).
The modules share one scope (they are concatenated in `manifest.json` order inside an IIFE),
so a function defined in `core/planning.js` can be called from `ui/map.js` without imports.

```
src/
  index.html        page markup; /*__CSS__*/, /*__JS__*/ and /*__WORKER__*/ are filled by the build
  styles.css
  manifest.json     the module order (declaration order matters for const/let)
  core/             the simulation; no DOM. Talks to the page only through the UI hook object in state.js
    constants.js    world size, grid, helpers, footprint geometry
    worlds.js       obstacle layouts, beacons, people, the six levels
    params.js       DEFAULTS, P (live parameters), LAYERS
    record.js       replay frames, ghost of the previous run
    state.js        S (simulation state), reset(), people motion
    config.js       loadLevel, setParam, kidnapTo, requestReplan
    vehicle.js      actuator chain + unicycle/bicycle integration
    sensors.js      lidar, beacons
    localization.js dead reckoning, EKF, particle filter
    perception.js   log-odds mapping, costmap
    planning.js     A*, RRT*, smoothing
    planning-car.js Reeds–Shepp, Hybrid A*
    path.js         track projection, curvature
    mission.js      goal ordering, state machine
    controllers.js  pure pursuit, rear-wheel feedback, Stanley, PID, DWA
    mpc.js          NMPC / LTV-MPC
    dispatch.js     which controller runs
    custom-controller.js  user code in a Web Worker
    agents.js       agent detection, tracking, prediction, ST speed planning
    step.js         one simulation tick, advance()
    log.js          event log (data only)
  ui/               everything that touches the DOM or a canvas
  analysis/         linear loop analysis (num, model, plots, lessons)
  worker/main.js    headless runner: core/* + this file = dist/core-worker.js, embedded in the page
```

Build: `node build.mjs` → `dist/nav-stack-lab.html` (the artifact) and `dist/core-worker.js`.
