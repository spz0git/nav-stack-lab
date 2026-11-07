/* ============================================================
   Polish (7.8): one icon set on the map, a View menu (dock and panel toggles, layout presets), the keyboard sheet
   (?), titles readable on touch screens (long-press), and on phones the panel as a bottom sheet over the map.
   ============================================================ */
// the map's view buttons in the toolbar's icon style
Object.assign(ICON, {
  zin: '<path d="M8 3.5v9M3.5 8h9"/>',
  zout: '<path d="M3.5 8h9"/>',
  fit: '<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>',
  follow: '<circle cx="8" cy="8" r="5.2"/><circle cx="8" cy="8" r="1.8" fill="currentColor" stroke="none"/>',
  key: '<path d="M6 6.2a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6.9v.8"/><circle cx="8" cy="11.8" r=".4" fill="currentColor"/>',
  keys: '<rect x="1.8" y="4" width="12.4" height="8" rx="1.5"/><path d="M4.5 6.6h.01M7 6.6h.01M9.5 6.6h.01M12 6.6h.01M5 9.4h6"/>'
});
[
  ['mv-in', 'zin'],
  ['mv-out', 'zout'],
  ['mv-fit', 'fit'],
  ['mv-follow', 'follow'],
  ['mv-key', 'key']
].forEach(([id, k]) => {
  const b = $('#' + id);
  if (b) {
    b.innerHTML = svgI(k);
    if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', b.title.replace(/ \(.*$/, ''));
  }
});

/* ---------- View menu: dock and panel, and layout presets ---------- */
const PRESETS = [
  [
    'tune',
    'Tune',
    'The map, the plot and the settings: the default',
    () => {
      setUIMode('sim');
      wsInspector(true);
      WS.dock = 220;
      wsDock(true);
      PANES.length = 0;
      renderPanes();
      setMetView('metrics');
      twReset();
    }
  ],
  [
    'loc',
    'Debug localization',
    'Localize tab and its layers; error with σ, NEES, N_eff and beacon readings plotted; Values',
    () => {
      setUIMode('sim');
      wsInspector(true);
      setLevel('advanced', 'the localization plots and Values');
      showTab('loc', false);
      layersEdited = false;
      layersKey = '';
      renderAllPanes();
      PANES.length = 0;
      PANES.push({sigs: ['ep', 'sp'], off: new Set()}, {sigs: ['nees'], off: new Set()}, {sigs: ['neff', 'zn'], off: new Set()});
      renderPanes();
      setMetView('values');
    }
  ],
  [
    'cmp',
    'Compare runs',
    'Whole run in every plot, cross-track and speed added, the Runs panel open',
    () => {
      setUIMode('sim');
      setLevel('advanced', 'the Runs panel and the added plots');
      PANES.length = 0;
      PANES.push({sigs: ['cte'], off: new Set()}, {sigs: ['va', 'vc'], off: new Set()});
      renderPanes();
      TW.all = true;
      TW.end = null;
      syncTW();
      drawPlot();
      toggleRuns(true);
    }
  ],
  [
    'map',
    'Map only',
    'Hide the panel and fold the dock',
    () => {
      setUIMode('sim');
      wsInspector(false);
      wsDock(false);
    }
  ]
];
function vmMark() {
  document.querySelectorAll('#viewmenu [data-preset]').forEach(x => x.setAttribute('aria-current', String(x.dataset.preset === WS.preset)));
}
{
  const tools = $('#bartools'),
    b = document.createElement('button');
  b.type = 'button';
  b.id = 'tg-view';
  b.className = 'ibtn';
  b.setAttribute('aria-expanded', 'false');
  b.setAttribute('aria-controls', 'viewmenu');
  b.title = 'Dock, panel and layout presets';
  b.innerHTML = 'View ▾';
  const m = document.createElement('div');
  m.id = 'viewmenu';
  m.className = 'viewmenu';
  m.hidden = true;
  m.setAttribute('role', 'dialog');
  m.setAttribute('aria-label', 'View');
  m.innerHTML = `<p class="vm-h">Show</p><div class="vm-tg"></div><p class="vm-h">Layouts</p>${PRESETS.map(([id, name, sub]) => `<button type="button" class="vm-item" data-preset="${id}"><b>${name}<i class="vm-cur">current</i></b><span>${sub}</span></button>`).join('')}<p class="vm-h">Help</p><button type="button" class="vm-item" id="vm-keys"><b>Keyboard shortcuts</b><span>?</span></button>`;
  // the level switch (ui/workspace.js setLevel): in the app bar beside View, and as a row of View's Show
  const adv = document.createElement('button');
  adv.type = 'button';
  adv.id = 'tg-adv';
  adv.className = 'ibtn';
  adv.setAttribute('aria-pressed', 'false');
  adv.title = 'Show every setting, tab, plot and the event log. Basic shows the essentials.';
  adv.textContent = 'Advanced';
  tools.appendChild(adv);
  tools.appendChild(b);
  document.body.appendChild(m);
  const tg = m.querySelector('.vm-tg');
  tg.appendChild($('#tg-dock'));
  tg.appendChild($('#tg-insp'));
  const va = adv.cloneNode(true);
  va.id = 'vm-adv';
  va.textContent = 'Advanced: every tab, setting and plot';
  tg.appendChild(va);
  const place = () => {
    const r = b.getBoundingClientRect();
    m.style.top = r.bottom + 6 + 'px';
    m.style.right = Math.max(8, innerWidth - r.right) + 'px';
  };
  b.onclick = () => {
    const on = m.hidden;
    m.hidden = !on;
    b.setAttribute('aria-expanded', String(on));
    if (on) {
      place();
      m.querySelector('button').focus();
    }
  };
  const close = () => {
    m.hidden = true;
    b.setAttribute('aria-expanded', 'false');
  };
  // which layout was applied last is marked (and remembered); showing or hiding the dock or the panel by hand clears the mark
  m.querySelectorAll('[data-preset]').forEach(
    x =>
      (x.onclick = () => {
        close();
        const P2 = PRESETS.find(p => p[0] === x.dataset.preset);
        P2[3]();
        WS.preset = P2[0];
        wsSave();
        vmMark();
        toast(`Layout: ${P2[1]}`);
      })
  );
  ['#tg-dock', '#tg-insp', '#dock-fold'].forEach(id =>
    $(id).addEventListener('click', () => {
      WS.preset = null;
      wsSave();
      vmMark();
    })
  );
  $('#vm-keys').onclick = () => {
    close();
    showKeys();
  };
  document.addEventListener(
    'pointerdown',
    e => {
      if (!m.hidden && !m.contains(e.target) && !b.contains(e.target)) close();
    },
    true
  );
  m.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      b.focus();
    }
  });
}

/* ---------- keyboard shortcuts (?) ---------- */
const KEYS = [
  ['Run', 'Space', 'Run or pause'],
  ['Run', 'N', 'Step 0.5 s'],
  ['Run', 'R', 'Reset'],
  ['Run', '[  ]', 'Slower, faster'],
  ['Timeline', ',  .', 'Back or forward 0.1 s in the recording'],
  ['Timeline', 'End', 'Back to live'],
  ['Timeline', 'P', 'Play or pause the recording at the speed setting'],
  ['Timeline', 'I  O', 'Loop in and out points at the shown moment; drag the handles; × clears'],
  ['Map', 'V G H K B', 'Select · Goal · Goal with heading · Kidnap · Beacon'],
  ['Map', 'L', 'Layers'],
  ['Map', 'F', 'Follow the robot'],
  ['Map', '0', 'Fit the whole world'],
  ['Map', 'Esc', 'Close a popover, clear the selection, back to Goal'],
  ['Map', 'Wheel · drag', 'Zoom · pan (drag also pans with any tool but Goal with heading; Shift-drag always)'],
  ['Plots', 'Wheel · drag', 'Zoom · pan the time window'],
  ['Plots', 'Double-click', 'Follow the last 30 s again'],
  ['Plots', 'Click', 'Show that moment'],
  ['Page', 'A', 'Simulate ⇄ Analyze'],
  ['Page', 'Ctrl+K · ⌘K · /', 'Search everything'],
  ['Page', '?', 'This list'],
  ['Splitters', '← → ↑ ↓ · Enter', 'Resize · hide or fold (focus a splitter first)']
];
function showKeys() {
  let d = $('#keysdlg');
  if (!d) {
    d = document.createElement('dialog');
    d.id = 'keysdlg';
    d.className = 'srcdlg keysdlg';
    d.setAttribute('aria-label', 'Keyboard shortcuts');
    const groups = [...new Set(KEYS.map(k => k[0]))];
    d.innerHTML = `<div class="srchead"><b>Keyboard shortcuts</b><span class="lbl">keys work when no text field has focus</span><button class="btn small" id="keys-x" style="margin-left:auto">Close</button></div><div class="keys-body">${groups
      .map(
        g =>
          `<section><h4>${g}</h4><dl>${KEYS.filter(k => k[0] === g)
            .map(
              k =>
                `<dt>${k[1]
                  .split(/\s{2,}| /)
                  .filter(Boolean)
                  .map(x => (/^[·⇄]$/.test(x) ? x : `<kbd>${esc(x)}</kbd>`))
                  .join(' ')}</dt><dd>${esc(k[2])}</dd>`
            )
            .join('')}</dl></section>`
      )
      .join('')}</div>`;
    document.body.appendChild(d);
    $('#keys-x').onclick = () => d.close();
    d.addEventListener('click', e => {
      if (e.target === d) d.close();
    });
  }
  if (!d.open) d.showModal();
}
document.addEventListener('keydown', e => {
  const t = e.target,
    tag = t && t.tagName;
  if (
    e.key !== '?' ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    (tag === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox') ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT'
  )
    return;
  e.preventDefault();
  showKeys();
});

/* ---------- titles on touch screens: long-press shows them (and a tap on the name shows the specs) ---------- */
{
  const tip = document.createElement('div');
  tip.className = 'termtip';
  tip.id = 'touchtip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.appendChild(tip);
  let timer = 0,
    at = null;
  const hide = () => {
    tip.hidden = true;
    at = null;
  };
  const show = el => {
    const t = el.getAttribute('title');
    if (!t) return;
    tip.textContent = t;
    tip.hidden = false;
    at = el;
    const r = el.getBoundingClientRect(),
      w = tip.offsetWidth,
      h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8)) + 'px';
    tip.style.top = (r.top - h - 8 > 8 ? r.top - h - 8 : r.bottom + 8) + 'px';
  };
  document.addEventListener(
    'pointerdown',
    e => {
      if (at && !tip.contains(e.target)) hide();
      if (e.pointerType !== 'touch') return;
      const el = e.target.closest && e.target.closest('[title]');
      if (!el || el.id === 'map') return;
      clearTimeout(timer);
      timer = setTimeout(() => show(el), 520);
    },
    true
  );
  ['pointerup', 'pointercancel', 'pointermove'].forEach(ev =>
    document.addEventListener(
      ev,
      e => {
        if (ev === 'pointermove' && Math.abs(e.movementX) + Math.abs(e.movementY) < 6) return;
        clearTimeout(timer);
      },
      true
    )
  );
  document.addEventListener('contextmenu', e => {
    if (at) e.preventDefault();
  });
  $('.brand h1').addEventListener('click', e => {
    if (matchMedia('(pointer:coarse)').matches) show(e.currentTarget);
  });
  addEventListener('scroll', hide, true);
}

/* ---------- phones: the panel as a bottom sheet over the page ---------- */
{
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.id = 'sheetbtn';
  fab.className = 'sheetbtn';
  fab.setAttribute('aria-expanded', 'false');
  fab.setAttribute('aria-controls', 'inspector');
  fab.textContent = 'Settings';
  // phones: a bottom bar with Settings (the sheet), Telemetry (scrolls to the dock) and Learn (the lessons)
  const bar = document.createElement('nav');
  bar.className = 'bottombar';
  bar.setAttribute('aria-label', 'Panels');
  const tel = document.createElement('button'),
    lrn = document.createElement('button');
  tel.type = lrn.type = 'button';
  tel.textContent = 'Telemetry';
  tel.onclick = () => {
    set(false);
    if (uiMode === 'learn') setUIMode('sim');
    $('#dock').scrollIntoView({block: 'start', behavior: 'smooth'});
  };
  lrn.id = 'bb-learn';
  lrn.onclick = () => {
    set(false);
    setUIMode(uiMode === 'learn' ? 'sim' : 'learn');
    lrn.textContent = uiMode === 'learn' ? 'Simulate' : 'Learn';
  };
  lrn.textContent = uiMode === 'learn' ? 'Simulate' : 'Learn';
  bar.append(fab, tel, lrn);
  document.body.appendChild(bar);
  const head = document.createElement('div');
  head.className = 'sheet-head';
  head.innerHTML =
    '<span class="sheet-grab" aria-hidden="true"></span><b>Settings</b><button type="button" class="ibtn" id="sheet-x" aria-label="Close the settings sheet">×</button>';
  const right = $('#inspector');
  right.insertBefore(head, right.firstChild);
  const set = on => {
    document.body.classList.toggle('sheet-open', on);
    fab.setAttribute('aria-expanded', String(on));
    fab.textContent = on ? 'Close' : 'Settings';
    const lb = $('#bb-learn');
    if (lb) lb.textContent = uiMode === 'learn' ? 'Simulate' : 'Learn';
    if (on) {
      consoleOpen = true;
      buildTabs();
      renderAllPanes();
      head.parentNode.scrollTop = 0;
    }
  };
  fab.onclick = () => set(!document.body.classList.contains('sheet-open'));
  $('#sheet-x').onclick = () => set(false);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.classList.contains('sheet-open')) set(false);
  });
  // the header's Changed, Runs, Advanced and View are hidden on phones: there they sit in the sheet's head
  const tools = document.createElement('span');
  tools.className = 'sheet-tools';
  head.insertBefore(tools, $('#sheet-x'));
  const placeTools = () =>
    ['#tg-chg', '#tg-runs', '#tg-adv', '#tg-view'].forEach(id => (narrowUI() ? tools : $('#bartools')).appendChild($(id)));
  placeTools();
  matchMedia('(max-width:760px)').addEventListener('change', e => {
    if (!e.matches) set(false);
    placeTools();
  });
}
