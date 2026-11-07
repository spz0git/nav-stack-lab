/* ============================================================
   Workspace (7.1): the map fills the stage; a telemetry dock under it and the panel on the right can be resized
   (drag the splitters, or focus one and use the arrow keys) and hidden. Sizes are remembered in this browser only.
   ============================================================ */
// dockAuto: the dock takes the height that leaves the map at the world's 3:2 aspect (no letterbox margins), within
// limits, until the user drags the splitter; a stored layout with an untouched dock keeps that behaviour
// level: 'basic' shows the four subsystem tabs, their main settings, one plot and three metrics; 'advanced' everything
const WS = {insp: null, dock: 220, inspOff: false, dockOff: false, preset: 'tune', dockAuto: true, level: 'basic'};
const WS_KEY = 'nav-stack-lab.layout';
try {
  const s = JSON.parse(localStorage.getItem(WS_KEY) || 'null');
  if (s && typeof s === 'object') {
    for (const k of Object.keys(WS)) if (k in s) WS[k] = s[k];
    if (!('dockAuto' in s)) WS.dockAuto = s.dock == null || s.dock === 220;
    if (typeof s.brief === 'boolean') briefOpen = s.brief;
    if (WS.level !== 'advanced') WS.level = 'basic';
  }
} catch (_) {}
function wsSave() {
  try {
    localStorage.setItem(WS_KEY, JSON.stringify({...WS, brief: briefOpen}));
  } catch (_) {}
}
const wideUI = () => matchMedia('(min-width:961px) and (min-height:600px)').matches;
function wsApply() {
  const lay = $('.layout');
  if (WS.insp) lay.style.setProperty('--insp-w', WS.insp + 'px');
  else lay.style.removeProperty('--insp-w');
  lay.style.setProperty('--dock-h', WS.dock + 'px');
  lay.classList.toggle('insp-off', WS.inspOff);
  lay.dataset.level = WS.level;
  document.querySelectorAll('#tg-adv, #vm-adv').forEach(b => b.setAttribute('aria-pressed', String(WS.level === 'advanced')));
  $('#dock').classList.toggle('folded', WS.dockOff);
  $('#tg-insp').setAttribute('aria-pressed', String(!WS.inspOff));
  $('#tg-dock').setAttribute('aria-pressed', String(!WS.dockOff));
  const f = $('#dock-fold');
  f.setAttribute('aria-expanded', String(!WS.dockOff));
  f.textContent = WS.dockOff ? '▴' : '▾';
  f.title = WS.dockOff ? 'Open the dock' : 'Fold the dock to its header';
}
// a taller dock when plots are added (desktop), up to what leaves the map about 300 px
function wsEnsureDock(h) {
  if (!wideUI()) return;
  if (WS.dockOff) WS.dockOff = false;
  if (WS.dock < h) {
    const st = $('#simview').getBoundingClientRect().height;
    WS.dock = Math.round(Math.max(WS.dock, Math.min(h, st - 420)));
  }
  wsApply();
  wsSave();
}
function wsInspector(on) {
  WS.inspOff = !on;
  wsApply();
  wsSave();
}
// The automatic dock height: whatever leaves the map canvas at 3:2, between 150 and 320 px (wide layout only)
let dockAutoQ = 0;
function wsDockAuto() {
  if (!WS.dockAuto || !wideUI() || WS.dockOff || AN.mode !== 'sim') return;
  const m = $('.mapwrap').getBoundingClientRect();
  if (!m.width) return;
  const want = Math.round(clamp(WS.dock + (m.height - m.width / 1.5), 150, 320));
  if (Math.abs(want - WS.dock) >= 2) {
    WS.dock = want;
    wsApply();
  }
}
function wsDock(on) {
  WS.dockOff = !on;
  wsApply();
  wsSave();
}
vmMark();
$('#tg-insp').onclick = () => wsInspector(WS.inspOff);
$('#tg-dock').onclick = () => wsDock(WS.dockOff);
$('#dock-fold').onclick = () => wsDock(WS.dockOff);
// Splitters: pointer drag, double-click to hide or fold, arrow keys to resize, Enter to hide or fold
function wsSplitter(el, {size, set, toggle}) {
  let drag = null;
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    drag = {p0: el.getAttribute('aria-orientation') === 'vertical' ? e.clientX : e.clientY, s0: size()};
    el.setPointerCapture(e.pointerId);
    el.classList.add('drag');
  });
  el.addEventListener('pointermove', e => {
    if (!drag) return;
    const p = el.getAttribute('aria-orientation') === 'vertical' ? e.clientX : e.clientY;
    set(drag.s0 - (p - drag.p0));
  });
  const end = () => {
    if (!drag) return;
    drag = null;
    el.classList.remove('drag');
    wsSave();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('dblclick', toggle);
  el.addEventListener('keydown', e => {
    const d = {ArrowLeft: 24, ArrowUp: 24, ArrowRight: -24, ArrowDown: -24}[e.key];
    if (d) {
      e.preventDefault();
      set(size() + d);
      wsSave();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      toggle();
    }
  });
}
wsSplitter($('#insp-split'), {
  size: () => $('#inspector').getBoundingClientRect().width,
  set: w => {
    const L = $('.layout').getBoundingClientRect().width;
    WS.insp = Math.round(clamp(w, 300, Math.max(300, L - 460)));
    wsApply();
  },
  toggle: () => wsInspector(false)
});
wsSplitter($('#dock-split'), {
  size: () => (WS.dockOff ? 44 : $('#dock').getBoundingClientRect().height),
  set: h => {
    const st = $('#simview').getBoundingClientRect().height;
    WS.dockOff = false;
    WS.dockAuto = false;
    WS.dock = Math.round(clamp(h, 120, Math.max(120, st - 300)));
    wsApply();
  },
  toggle: () => wsDock(WS.dockOff)
});
// Learn lives in the panel, so opening Learn shows it
$('#modesel').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b && b.dataset.v === 'learn' && WS.inspOff) wsInspector(true);
});
// Canvases follow their panels (splitters and folding change sizes without a window resize)
{
  let q = 0;
  const redraw = () => {
    q = 0;
    wsDockAuto();
    if (AN.mode === 'an') {
      if (!$('#anview').hidden) renderAnalysis();
    } else if (S) {
      draw();
      drawPlot();
    }
  };
  const ro = new ResizeObserver(() => {
    if (!q) q = requestAnimationFrame(redraw);
  });
  ro.observe($('.mapwrap'));
  ro.observe($('#plotcol'));
  ro.observe($('.stage'));
}

/* ---------- the Basic and Advanced levels (v84 redesign: "the page is loaded with too many things") ----------
   Basic shows the four subsystem tabs (the four health lights), their main settings, one plot and three metrics;
   Advanced shows every tab, setting, plot, the event log and the Runs panel. Whatever asks for something Basic hides
   (a lesson's tab, a search result, a link's setting, a layout preset) switches to Advanced first and says so. */
const BASIC_TABS = ['loc', 'per', 'plan', 'ctl'],
  BASIC_MORE = ['view', 'sym'],
  AN_TABS = ['ctl', 'veh']; // Analyze reads only Control and Vehicle
const levelBasic = () => WS.level === 'basic';
// the open lesson is one of the Foundations (level 1), written for the Basic page
const foundationsOpen = () => {
  const it = lessonOpen && lessonItem(lessonOpen);
  return !!it && it.L.level === 1;
};
// While a lesson is open the dock shows the event log and every metric, whatever the level: the lessons point at them
const basicDockNow = () => levelBasic() && !lessonOpen;
// the tab row and the More menu for the left side and the level
function tabsRow() {
  if (AN.mode === 'an') return AN_TABS;
  return levelBasic() ? BASIC_TABS : TAB_GROUPS[0].tabs;
}
function tabsMore() {
  if (AN.mode === 'an') return [{name: 'Reference', tabs: ['sym']}];
  return levelBasic() ? [{name: 'Reference', tabs: BASIC_MORE}] : TAB_GROUPS.slice(1);
}
const tabShown = id => tabsRow().includes(id) || tabsMore().some(g => g.tabs.includes(id));
function setLevel(lv, why) {
  if ((lv !== 'basic' && lv !== 'advanced') || lv === WS.level) return;
  WS.level = lv;
  wsSave();
  wsApply();
  if (why) toast(`Switched to Advanced to show ${why}`, 4200);
  if (lv === 'basic') basicDock();
  if (!tabShown(activeTab)) activeTab = AN.mode === 'an' ? 'ctl' : 'loc';
  buildTabs();
  renderAllPanes();
  if (S) {
    renderMetrics();
    drawPlot();
  }
}
// Basic keeps one plot and the run summary: added plots, the second channel, Values and the Runs panel go
function basicDock() {
  PANES.length = 0;
  renderPanes();
  plotCh2 = 'none';
  $('#plotsel2').value = 'none';
  if (metView !== 'metrics') setMetView('metrics');
  if (!$('#runpanel').hidden) toggleRuns(false);
}
// Every request for a tab comes here: from Analyze a Simulate tab goes back to the simulator, and a tab the Basic
// level hides switches to Advanced first.
function showTab(id, render = true) {
  if (AN.mode === 'an' && !tabShown(id)) setMode('sim');
  if (!tabShown(id)) {
    // a Foundations lesson is written for Basic: its experiments name a tab for the reader, and the console is not
    // shown in Learn, so the page stays Basic; every other request opens Advanced and says so
    if (foundationsOpen()) id = tabShown(activeTab) ? activeTab : 'loc';
    else setLevel('advanced', TAB_NAME[id]);
  }
  TABS_MODE.before = null; // a tab asked for wins over the one Analyze set aside
  activeTab = id;
  consoleOpen = true;
  buildTabs();
  if (render) renderAllPanes();
}
// Basic shows a schema field only when it carries basic: true and sits on a tab Basic shows (Analyze's Vehicle tab too)
const fieldBasic = (f, tab) => !!f.basic && (BASIC_TABS.includes(tab) || AN_TABS.includes(tab));
const isSettingField = f => !!f.k || f.type === 'beacons' || f.type === 'sensors';
// a link that sets something Basic hides opens in Advanced, so the page shows what the link set
function levelForLink() {
  if (!levelBasic()) return;
  const c = changedList().find(s => !(s.f.basic && BASIC_TABS.includes(s.tab)));
  if (c) setLevel('advanced', `“${plain(c.f.label)}” from the link`);
}
// The tabs follow the left side: Analyze shows Control and Vehicle; back in the simulator the tab open before returns
const TABS_MODE = {mode: 'sim', before: null};
function tabsFollowMode() {
  if (AN.mode === TABS_MODE.mode) return;
  TABS_MODE.mode = AN.mode;
  if (AN.mode === 'an' && !tabShown(activeTab)) {
    TABS_MODE.before = activeTab;
    activeTab = 'ctl';
  } else if (AN.mode !== 'an' && TABS_MODE.before) {
    if (tabShown(TABS_MODE.before)) activeTab = TABS_MODE.before;
    TABS_MODE.before = null;
  }
  buildTabs();
  if (S) renderAllPanes();
}
$('#tg-adv').onclick = $('#vm-adv').onclick = () => setLevel(levelBasic() ? 'advanced' : 'basic');
// "N more settings in Advanced" at the end of a Basic pane, and More's "Show everything"
document.addEventListener('click', e => {
  if (e.target && e.target.closest && e.target.closest('[data-adv]')) setLevel('advanced');
});
wsApply();
