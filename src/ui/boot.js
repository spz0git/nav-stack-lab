/* ---------- boot ---------- */
UI.draw = () => {
  if (AN.mode === 'sim') draw();
};
UI.refresh = refreshAll;
UI.invalidate = anInvalidate;
UI.levelChanged = () => {
  SEL = null;
  if (REPLAY.active) {
    REPLAY.active = false;
    logDirty = true;
  }
  REPLAY.playing = false;
  REPLAY.loop = null;
  buildLevels();
  levelLinkPrep(LV);
  applyTabLayers(true);
  plotDefault();
  renderAllPanes();
  hashSoon();
};
UI.mode = () => AN.mode;
buildTabs();
loadLevel(0);
let linkCfg = null;
{
  const fail = e => logE('Could not restore the setup from the link: ' + e.message, 'warn'),
    apply = c => {
      applyConfig(c);
      logE('Setup restored from the link', 'ok');
      return c;
    };
  let c = null;
  try {
    c = configFromHash();
  } catch (e) {
    fail(e);
  }
  // a link that carries a compressed level is read asynchronously, after the page is up
  if (c && c.lz)
    configResolve(c).then(c2 => {
      try {
        apply(c2);
        hashLast = location.hash.slice(1);
        if (c2.mode === 'an') setMode('an');
        else if (c2.t > 0) runToMoment(c2.t);
      } catch (e) {
        fail(e);
      }
    }, fail);
  else if (c) {
    try {
      linkCfg = apply(c);
    } catch (e) {
      fail(e);
    }
  }
}
custLoadSaved();
syncModeUI();
renderLearn();
lessonFromHash() || chapterFromHash() || (location.hash === '#learn' && setUIMode('learn'));
readTokens();
draw();
drawPlot();
if (linkCfg) {
  hashLast = location.hash.slice(1);
  if (linkCfg.mode === 'an') setMode('an');
  else if (linkCfg.t > 0) runToMoment(linkCfg.t);
}
requestAnimationFrame(loop);
window.__an = {
  AN,
  anCompute,
  GLOSS,
  LESSON_TERMS,
  glossMark,
  lessonTerms,
  LESSONS_EXTRA,
  LESSON_GROUPS,
  spdCompute,
  runStepTest,
  runInjection,
  setMode,
  setUIMode,
  openLesson,
  lessonBack,
  openChapter,
  chapterBack,
  get lessonOpen() {
    return lessonOpen;
  },
  lessonGo,
  LESSONS,
  stepMetrics,
  Ljw,
  anBuild
};
window.__runs = {
  RUNS,
  runSnapshot,
  runImport,
  runExportJSON: r => {
    const {_S, id, ...run} = r;
    return JSON.stringify({format: 'nav-stack-lab-run', version: 1, run});
  }
};
window.__plots = {TW, runCSV, plotsImage, PANES, addPane, SIGNALS, sigAt, timeWindow};
window.__nav = {
  scatter: () => scatterParticles(),
  kidnapTo,
  get S() {
    return S;
  },
  P,
  LEVELS,
  levelToJSON,
  get world() {
    return [W, H, GW, GH];
  },
  loadLevel,
  switchLevel,
  advance,
  exploredFrac,
  mapAgree,
  scanMatch,
  distanceTransform,
  pgPoints,
  setParam,
  get WPS() {
    return WPS;
  },
  toScreen: (x, y) => toScreen(x, y),
  get VIEW() {
    return VIEW;
  },
  get GHOST() {
    return GHOST;
  },
  LAYERS,
  EXP,
  SAF, // Tools → Safety (ui/safety.js)
  safSearch,
  expCSV,
  configURL,
  get LV() {
    return LV;
  },
  SLOTS,
  SLOT_LIBRARY,
  slotLoad,
  slamLandmarks,
  tryGo,
  actuate,
  dynInfo,
  dynSlip,
  health: () => healthNow(null),
  SENSORS,
  sensorOn,
  setSensor,
  sensorsBlind,
  gnssTick
};
