# Nav Stack Lab — source

One page, built from these modules by `node build.mjs` (Node 18+, no dependencies).
The modules share one scope (they are concatenated in `manifest.json` order inside an IIFE),
so a function defined in `core/planning.js` can be called from `ui/map.js` without imports.
`core/` never touches the DOM; it reaches the page only through the hook object `UI` in
`core/state.js`, which is why the same core runs in Node and in the Experiments workers.

```
src/
  index.html        page markup; /*__FONTS__*/, /*__CSS__*/, /*__JS__*/ and /*__WORKER__*/ are filled by the build
  styles.css
  fonts/            the typefaces (woff2 Latin subsets, SIL OFL) embedded by the build; fonts.json lists them
  manifest.json     the module order (declaration order matters for const/let)
  version.json      the version label in the header
  core/             the simulation; no DOM
    constants.js    world size, grid, helpers, footprint geometry
    worlds.js       obstacle layouts, beacons, people, the levels
    params.js       DEFAULTS, P (live parameters), LAYERS
    record.js       replay frames, ghost of the previous run
    state.js        S (simulation state), reset(), people motion
    config.js       loadLevel, the map as edited (applyMap), setParam, kidnapTo, requestReplan
    vehicle.js      actuator chain + unicycle/bicycle integration
    sensors.js      lidar, beacons
    localization.js dead reckoning, EKF, particle filter
    slam.js         EKF-SLAM
    perception.js   log-odds mapping, costmap
    planning.js     A*, RRT*, smoothing
    planning-car.js Reeds–Shepp, Hybrid A*
    path.js         track projection, curvature
    mission.js      goal ordering, state machine
    controllers.js  pure pursuit, rear-wheel feedback, Stanley, PID, DWA
    mpc.js          NMPC / LTV-MPC
    dispatch.js     which controller runs
    custom-controller.js  user code in a Web Worker
    slots.js        the other code slots (planner, localizer, predictor)
    agents.js       agent detection, tracking, prediction, ST speed planning
    predict.js      the learned people predictor: features, three futures, the prediction score
    fidelity.js     sensor latency, reactive pedestrians, the other vehicle, the tyre model
    step.js         one simulation tick, advance()
    log.js          event log (data only)
  ui/               everything that touches the DOM or a canvas
  analysis/         linear loop analysis (num, model, plots, lessons, glossary)
  worker/main.js    headless runner: core/* + this file = dist/core-worker.js, embedded in the page
docs/notes/         the eight companion chapters (markdown + TeX), converted by tools/notes.mjs at build time
docs/lessons/       the 32 lessons (markdown with HTML bodies), read by tools/lessons.mjs at build time
tests/              Playwright tests, the Node golden test, and the measurement scripts the lessons' numbers come from
```

Build: `node build.mjs` → `dist/nav-stack-lab.html` (the page) and `dist/core-worker.js` (the headless core).

## Lessons and chapters

`docs/notes/*.md` are the chapters shown in Learn mode: markdown with TeX formulas, plus `{{live:key}}` for numbers
the app computes from the current settings (defined in `src/ui/chapters.js`) and `[try: Label | {cfg}]` for
buttons that set the simulator or the analysis up; the header of `tools/notes.mjs` documents both. A lesson is a
markdown file in `docs/lessons/<group>/*.md` (front matter, the body, then `## Try: Label` sections with `cfg:`,
`Setup:`, `See:`, `Shows:`, `Predict:` with options and `Answer:`, a `## Think about` section of Q:/A: pairs and a
`## Check yourself`); the header of `tools/lessons.mjs` documents the format, and the build inlines them as
`LESSON_DATA` (`analysis/lessons-data.js`), which `analysis/lessons.js` and `lessons2.js` expose as before. A lesson
links to the section that derives its formula with `<a class="chref" href="#notes=ch2/<section-slug>">`, and Back
from the chapter returns to the lesson. The numbers in a lesson's "What you will see" are measured headless first
with the `tests/measure_*.py` scripts.
