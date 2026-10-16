/* ---------- guided lessons ---------- */
function lessonGo(cfg) {
  if (cfg.level != null) loadLevel(cfg.level); // always start from the level's defaults
  for (const [k, v] of Object.entries(cfg.set || {})) setParam(k, v, false);
  if (cfg.stepKind) AN.stepKind = cfg.stepKind;
  if (cfg.stepAmp != null) AN.stepAmp = cfg.stepAmp;
  if (cfg.injAmp) AN.injAmp = cfg.injAmp;
  AN.adv = true;
  AN.wi = null;
  AN.loop = cfg.loop || 'lat';
  AN.curveR = cfg.curveR || 0;
  AN.useEst = !!cfg.useEst;
  AN.meas = {step: null, freq: null, spd: null};
  syncAnControls();
  renderAllPanes();
  setMode('an');
  if (cfg.test === 'step') {
    runStepTest();
    renderAnalysis();
  } else if (cfg.test === 'inj') runInjection();
  else if (cfg.test === 'spdstep') {
    if (!AN.resSpd) spdCompute();
    runSpeedStepTest();
    renderAnalysis();
  }
}
const LV_DIFF = 0,
  LV_CAR = 5,
  LV_MOOSE = 6; // levels that set up each vehicle; L7 the moose test
// The lessons themselves are written in docs/lessons/<group>/*.md (see tools/lessons.mjs for the format) and
// inlined by the build as LESSON_DATA (analysis/lessons-data.js). LESSONS are the first ten control lessons (the
// loop analysis, v6); LESSONS_EXTRA the control lessons added since, whose experiments may run the simulator.
const LESSONS = LESSON_DATA.ctl,
  LESSONS_EXTRA = LESSON_DATA.ctlExtra;
const LESSON_GROUPS = () => [
  {
    id: 'loc',
    title: 'Localization',
    note: 'Runs in the simulator. Each button reloads the level, applies the settings and runs.',
    items: SIM_LESSONS.loc
  },
  {id: 'per', title: 'Perception', note: '', items: SIM_LESSONS.per},
  {id: 'plan', title: 'Planning and the mission', note: '', items: SIM_LESSONS.plan},
  {
    id: 'ctl',
    title: 'The control loop (linear analysis)',
    note: 'Each button sets up the lab and shows the loop analysis on the left; <b>A</b> switches between it and the map.',
    items: LESSONS.concat(LESSONS_EXTRA)
  }
];
