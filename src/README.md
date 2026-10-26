# Nav Stack Lab — source

One page, built from these modules by `node build.mjs` (Node 18+, no dependencies).
The modules share one scope (they are concatenated in `manifest.json` order inside an IIFE),
so a function defined in `core/planning.js` can be called from `ui/map.js` without imports.
`core/` never touches the DOM; it reaches the page only through the hook object `UI` in
`core/state.js`, which is why the same core runs in Node and in the Experiments workers.

The 85 modules of `manifest.json` (42 core, 35 ui, 8 analysis), in build order within each group, plus the worker.
Each line says what the file holds; the file's header comment says more.

```
src/
  index.html        page markup; /*__FONTS__*/, /*__CSS__*/, /*__JS__*/ and /*__WORKER__*/ are filled by the build
  styles.css        the stylesheet, with the light and dark tokens
  fonts/            the typefaces (woff2 Latin subsets, SIL OFL) embedded by the build; fonts.json lists them
  manifest.json     the module order (declaration order matters for const/let)
  version.json      the version label in the header
  examples/         slot examples, src/examples/<slot>/<nn>-<id>.js (ctl, loc, plan, pred), inlined as SLOT_LIBRARY
  models/           the learned blocks' weights (detector, predictor, policy), inlined as MODELS

  core/             the simulation; no DOM
    constants.js        world size (setWorld), grid, helpers, footprint geometry
    worlds.js           the built-in levels: obstacle layouts, beacons, people, goals, Try lists
    levels.js           the level format (JSON): to and from the built-in levels, checking, levelOf
    worldgen.js         seeded world generator: rooms and corridors, warehouse, open hall
    params.js           DEFAULTS, P (live parameters), the parameter ranges, LAYERS
    record.js           replay frames, the ghost of the previous run, the signals in a frame
    state.js            S (simulation state), reset(), the UI hooks, people motion
    config.js           loadLevel, the map as edited (applyMap), setParam, kidnapTo, requestReplan
    vehicle.js          actuator chain, unicycle and bicycle integration, the car with tyre slip, odometry
    sensors.js          lidar, beacons, the ultrasonic ring, GNSS, the sensor switches
    localization.js     dead reckoning, EKF, particle filter, scan matching, the gyro and GNSS updates
    slam.js             EKF-SLAM: beacons estimated with the pose
    pgslam.js           pose-graph SLAM, lidar only: keyframes, ICP loop closures, Gauss–Newton
    perception.js       log-odds mapping (lidar and sonar), the costmap, free-space checks
    planning.js         straight line, A* (gridSearch), RRT*, smoothing
    planning-dstar.js   D* Lite: the grid search kept between plans
    planning-policy.js  the end-to-end policy: scan and goal to candidate paths, with its safety layer
    planning-car.js     Reeds–Shepp, Hybrid A*
    path.js             path tracking helpers: projection, curvature
    mission.js          goal ordering, the state machine, frontier exploration
    controllers.js      pure pursuit, rear-wheel feedback, Stanley, PID, DWA
    mpc.js              NMPC and LTV-MPC, the prediction model with the actuator lag
    dispatch.js         which controller runs, the lidar guard, alignment at cusps
    custom-controller.js  user controller code in a Web Worker, run in lockstep
    examples-data.js    the slot examples (SLOT_LIBRARY), inlined by the build
    slots.js            the other code slots: planner, localizer, predictor
    models-data.js      the learned blocks' weights (MODELS) and models trained in the page
    nn.js               forward pass of the learned networks (1D convolution, dense layers)
    nn-train.js         training in the page: backpropagation, Adam, the losses
    agents.js           people detection (rule and learned), tracking, prediction, velocity obstacles, ST speed planning
    radar.js            the radar, the weather, the radar's update in the people tracker
    predict.js          the learned people predictor: features, three futures, the prediction score
    dataset.js          training data: one headless run recorded at every scan (Train tab and collectors)
    learnmon.js         the learned blocks under watch: detection by slice, out-of-distribution scores
    oddmon.js           the ODD monitor and its minimal-risk manoeuvre
    fidelity.js         sensor latency, reactive pedestrians (social force), the other vehicle, space-time A*
    safety.js           safety measures: contact events with severity, margins, the conditions at the time
    health.js           the health rules of every subsystem (the lights), recorded in the core
    search.js           scenario search: ODD sheets, sampled worlds, the worst runs, rates and intervals
    argument.js         the safety argument (GSN) with live evidence
    step.js             one simulation tick in three parts, advance()
    log.js              event log (data only)

  ui/               everything that touches the DOM or a canvas
    st-plot.js          the ST graph in the telemetry dock
    log.js              event log rendering: seek, search, severity filter
    map.js              the map canvas: the world, estimates, layers, view and zoom
    plot.js             the preset plot and the shared time window
    status.js           status strip and metrics
    fsm.js              live state diagram of the behaviour layer (Mission tab)
    tabs.js             the tab list and the subsystems they belong to
    schema.js           every setting's control (SCHEMA), presets, info lines
    notes.js            the Simulate tabs' How it works panels (TEX template literals)
    panes.js            level strip and menu, tabs, tryGo (the Try buttons and the seed), the panes
    nomenclature.js     the Symbols tab's table (NOMEN)
    panes2.js           the Symbols, Layers and Code panes
    learn.js            the three modes and the Learn column: lessons, Predict, self-check, glossary popups
    path.js             Start here, the first pass, minute estimates, progress in this browser
    chapters.js         companion chapters: rendering, live values (LIVE), Try buttons
    experiments.js      batch runs in Web Workers, results table, CSV, shareable setups
    safety.js           Tools → Safety: ODD sheets, the scenario search, scenario sets
    argument.js         Tools → Safety → Safety argument: the GSN graph, its editor and checks
    train.js            Tools → Train: collect, train, compare, save and pick models
    levelmenu.js        custom levels: import, export, links, generate, keep in this browser
    replay.js           the timeline: one time cursor for the map, plots, strip and log
    source.js           the page shows its own source; codeSnippet cuts the lessons' snippets
    transport.js        run, step, speed, reset; taps on the map; the plot preset
    maptools.js         map tools (Select, Goal, Kidnap, Beacon) and the Layers list
    signals.js          every recorded signal by name, for plots, Values and CSV
    plots.js            the plot dock: more panes, zoom and pan, Whole run, CSV, PNG
    palette.js          the command palette and the Changed list with named setups
    health.js           one health light per subsystem with its checks
    runs.js             runs kept, compared, exported and imported
    polish.js           icons, the View menu, the keyboard sheet, the phone's bottom sheet
    whatsnew.js         What's new: CHANGELOG.md under the version label
    loop.js             the main loop and error reporting
    workspace.js        the stage, dock and panel splitters, sizes kept in this browser
    urlstate.js         the URL hash as the setup link, and back
    boot.js             wiring the UI hooks and starting the page

  analysis/         linear loop analysis and the lesson data
    num.js              complex numbers, polynomials and their roots, the matrix exponential, eigenvalues
    model.js            the linearized lateral loop: gains, Bode, Nyquist, step, margins, the step test
    speed.js            the speed (longitudinal) loop
    ui.js               the Analyze view: plots, poles to drag, the story, the design tools
    lessons-data.js     LESSON_DATA and the code snippets' index, inlined by the build
    lessons2.js         the simulator lessons (loc, per, plan, saf) from LESSON_DATA
    lessons.js          the control lessons, the lesson groups, lessonGo (a control Try)
    glossary.js         the glossary (GLOSS) and each lesson's terms (LESSON_TERMS)

  worker/main.js    headless runner: core/* + this file = dist/core-worker.js, embedded in the page
docs/notes/         the nine companion chapters (markdown + TeX), converted by tools/notes.mjs at build time
docs/lessons/       the 54 lessons (markdown + TeX) in five groups, read by tools/lessons.mjs at build time
tests/              Playwright tests, the Node tests, and the measurement scripts the lessons' numbers come from
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
