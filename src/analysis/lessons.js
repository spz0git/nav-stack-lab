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
  if (cfg.place) anDesign('place', cfg.place.zeta, cfg.place.wn); // a lesson's design what-if (pole placement or LQR, ui.js)
  if (cfg.lqr) anDesign('lqr', cfg.lqr.qe, cfg.lqr.qth, cfg.lqr.r);
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
// Foundations comes first: one idea per lesson for an engineering undergraduate. Each other group's note starts with
// the level it is written at.
const LESSON_GROUPS = () => [
  {
    id: 'intro',
    title: 'Foundations',
    note: 'Start here. One idea per lesson, under ten minutes each, written for an engineering undergraduate: the math is folded away under Show the math. The groups below go deeper.',
    items: SIM_LESSONS.intro
  },
  {
    id: 'loc',
    title: 'Localization',
    note: 'Graduate level: covariance matrices, Jacobians and the Kalman filter. Runs in the simulator. Each button reloads the level, applies the settings and runs.',
    items: SIM_LESSONS.loc
  },
  {
    id: 'per',
    title: 'Perception',
    note: 'Graduate level: Bayes’ rule on a grid, Kalman tracking and small neural networks.',
    items: SIM_LESSONS.per
  },
  {
    id: 'plan',
    title: 'Planning and the mission',
    note: 'Graduate level: graph search, its guarantees, and planning for a car and around moving people.',
    items: SIM_LESSONS.plan
  },
  {
    id: 'ctl',
    title: 'The control loop (linear analysis)',
    note: 'Graduate level: transfer functions, Bode and Nyquist plots (chapter 6 builds them). Each button sets up the lab and shows the loop analysis on the left; <b>A</b> switches between it and the map.',
    items: LESSONS.concat(LESSONS_EXTRA)
  },
  {
    id: 'saf',
    title: 'Safety',
    note: 'Graduate level: hazard analysis, statistics of rare events and safety arguments. The ideas of ISO 26262, ISO 21448 (SOTIF), ISO/PAS 8800 and UL 4600, done on the simulator; the lab paraphrases them and is not a substitute for their text.',
    items: SIM_LESSONS.saf
  }
];
