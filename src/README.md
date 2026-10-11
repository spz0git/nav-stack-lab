# Nav Stack Lab — source

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
