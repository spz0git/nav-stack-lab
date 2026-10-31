/* ============================================================
   UI: companion notes (chapters) in the Learn column.
   The chapters are written in docs/notes/*.md and converted at build time (tools/notes.mjs); the build fills
   CHAPTERS below. Live values ({{live:key}} in the markdown) are computed here from the current parameters and the
   loop analysis, and refreshed whenever the analysis is invalidated. Try buttons use the lessons' cfg format.
   ============================================================ */
const CHAPTERS = /*__CHAPTERS__*/ [];
let chapterOpen = null,
  chapterFrom = null,
  chapterSec = null,
  liveTimer = null; // chapterFrom: the lesson a link came from
const liveF = (v, d = 2) => (v == null || !isFinite(v) ? '—' : (+v).toFixed(d));
// about how many cells an arc of the sonar's beam width covers at range r: its length over a cell, times the band's 1.4 cells
const sonArcN = r => Math.max(2, Math.round((1.41 * r * P.sonBeam * Math.PI) / 180 / RES));
// the pure-pursuit formulas of chapter 6, from the current parameters (valid for pure pursuit on the diff-drive robot)
function ppFormulas() {
  const v0 = anV0(),
    Ld = Math.max(0.1, P.ppL0 + P.ppK * v0),
    g = isCar() ? v0 / P.wheelbase : 1,
    Ke = (2 * v0) / (Ld * Ld),
    Kth = (2 * v0) / Ld,
    T = DT;
  const a = Ke * v0; // ω⁴ − Kθ²ω² − (Ke v0)² = 0
  const wc = Math.sqrt((Kth * Kth + Math.sqrt(Kth ** 4 + 4 * a * a)) / 2),
    lead = (Math.atan((Kth * wc) / a) * 180) / Math.PI,
    hold = (((wc * T) / 2) * 180) / Math.PI,
    pm = lead - hold;
  const wn = Math.sqrt(g * Ke * v0),
    zeta = (g * Kth) / (2 * wn);
  return {
    v0,
    Ld,
    Ke,
    Kth,
    wc,
    lead,
    hold,
    pm,
    dm: (pm * Math.PI) / 180 / wc,
    wn,
    zeta,
    zero: -v0 / Ld,
    os: 100 * Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta)),
    settle: 4 / (zeta * wn),
    ess: (100 * 0.1) / Ke
  };
}
function abGains() {
  const l = (P.agSigA * 0.01) / 0.1,
    s = Math.sqrt(l * l + 8 * l);
  return {a: -(l * l + 8 * l - (l + 4) * s) / 8, b: (l * l + 4 * l - l * s) / 4};
}
function liveRes() {
  if (AN.loop !== 'lat') return null;
  if (AN.dirty || !AN.res) {
    anCompute();
    AN.dirty = false;
  }
  return AN.res && AN.res.M.kind !== 'none' ? AN.res : null;
}
const LIVE = {
  ctl: () => CTL_NAMES[anCtl()] || P.ctl,
  // localization (chapter 2)
  loc: () =>
    ({truth: 'ground truth', dr: 'dead reckoning', ekf: 'the EKF', pf: 'the particle filter', slam: 'EKF-SLAM', custom: 'your own code'})[
      P.loc
    ] || P.loc,
  odoK: () => liveF(P.odoK, 1),
  odoB: () => liveF(P.odoB, 1),
  lmRange: () => liveF(P.lmRange, 0),
  npart: () => String(P.npart),
  sigv: () => liveF(odoErr(anV0()).sv, 3),
  sigw: () => liveF(odoErr(anV0()).sw, 3),
  odoBv: () => liveF(100 * odoErr(anV0()).bv, 1),
  odoBw: () => liveF(odoErr(anV0()).bw, 3),
  odoDrift: () => liveF((60 * odoErr(anV0()).bw * 180) / Math.PI, 0),
  // perception (chapter 3): the tracker's steady-state α–β gains from the tracking index λ = σa Δt² / σz
  lidarSig: () => liveF(P.lidarSig, 2),
  // the ultrasonic ring (chapter 3 §11)
  sonN: () => String(clamp(Math.round(P.sonN), 4, 16)),
  sonBeam: () => String(P.sonBeam),
  sonMax: () => liveF(P.sonMax, 1),
  sonMin: () => liveF(P.sonMin, 2),
  sonSig: () => liveF(P.sonSig, 3),
  sonSpec: () => String(P.sonSpec),
  sonXt: () => String(P.sonXt),
  sonCycle: () => liveF(sonCycle(), 2),
  sonGap: () => String(Math.max(0, Math.round(360 / clamp(Math.round(P.sonN), 4, 16) - P.sonBeam))),
  sonArcN2: () => String(sonArcN(2)),
  sonLarc2: () => liveF(Math.log((sonArcN(2) + 1) / (sonArcN(2) - 1)), 2),
  infl: () => liveF(P.infl, 1),
  agSigA: () => liveF(P.agSigA, 1),
  agT: () => liveF(P.agT, 1),
  agGrow: () => liveF(P.agGrow, 2),
  sensLat: () => liveF(P.sensLat, 2),
  lam: () => liveF((P.agSigA * 0.01) / 0.1, 3),
  alpha: () => liveF(abGains().a, 2),
  beta: () => liveF(abGains().b, 3),
  tauv: () => {
    const a = abGains().a;
    return liveF(0.1 / -Math.log(Math.sqrt(1 - a)), 1);
  },
  rAtT: () => liveF(0.35 + P.agGrow * P.agT, 2),
  // the radar (chapter 3 §12): its settings, and what 3° of bearing noise and the angular resolution are at 10 m
  radFov: () => liveF(P.radFov, 0),
  radRange: () => liveF(P.radRange, 0),
  radRes: () => liveF(P.radRes, 0),
  radClutter: () => liveF(P.radClutter, 1),
  radGhost: () => liveF(P.radGhost, 0),
  radLat10: () => liveF(10 * RAD.sb, 2),
  radCross10: () => liveF((10 * P.radRes * Math.PI) / 180, 2),
  // vehicle models (chapter 1)
  wheelbase: () => liveF(P.wheelbase, 2),
  steerMaxDeg: () => String(P.steerMaxDeg),
  ayPlan: () => liveF(anV0() ** 2 / planR(), 2),
  ayFrac: () => liveF((100 * anV0() ** 2) / planR() / Math.max(0.01, P.alat), 0),
  betaMax: () => liveF((Math.atan((1 - P.lf / P.wheelbase) * Math.tan(steerMax())) * 180) / Math.PI, 1),
  lr: () => liveF(P.wheelbase - P.lf, 2),
  // the car with tyre slip (chapter 1 §4–6), from the current tyre settings whichever vehicle is selected
  vehNow: () => (isDyn() ? 'the car with tyre slip' : isCar() ? 'the kinematic car' : 'the unicycle'),
  dynM: () => liveF(P.mass, 0),
  dynIz: () => liveF(P.Iz, 2),
  dynLf: () => liveF(dynInfo().lf, 2),
  dynLr: () => liveF(dynInfo().lr, 2),
  dynCf: () => liveF(P.Cf, 0),
  dynCr: () => liveF(P.Cr, 0),
  dynMu: () => liveF(P.mu, 2),
  Kus: () => liveF(dynInfo().K, 4),
  KusDeg: () => liveF((dynInfo().K * 180) / Math.PI, 2),
  vch: () => {
    const D = dynInfo();
    return D.vch ? liveF(D.vch, 2) : D.vcrit ? `none (it oversteers; critical speed ${liveF(D.vcrit, 2)} m/s)` : 'none (neutral steer)';
  },
  mug: () => liveF(P.mu * GRAV, 2),
  grPct: () => {
    const D = dynInfo(),
      v = anV0();
    return liveF((100 * D.L) / (D.L + D.K * v * v), 0);
  },
  yawMode: () => dynModes(anV0()).text,
  Rgrip: () => liveF(anV0() ** 2 / (P.mu * GRAV), 2),
  // path trackers (chapter 5)
  rwKe: () => liveF(P.rwKe, 1),
  rwKth: () => liveF(P.rwKth, 1),
  stanK: () => liveF(P.stanK, 1),
  alat: () => liveF(P.alat, 2),
  wnRwf: () => liveF(anV0() * Math.sqrt(P.rwKe)),
  zetaRwf: () => liveF(P.rwKth / (2 * Math.sqrt(P.rwKe))),
  // MPC (chapter 7)
  mpcNp: () => String(Math.round(P.mpcNp)),
  mpcNc: () => String(Math.min(Math.round(P.mpcNc), Math.round(P.mpcNp))),
  mpcDt: () => liveF(P.mpcDt, 2),
  mpcH: () => liveF(Math.round(P.mpcNp) * P.mpcDt, 1),
  mpcIt: () => String(Math.round(P.mpcIt)),
  mpcQlat: () => String(P.mpcQlat),
  mpcMarg: () => liveF(P.mpcMarg, 2),
  mpcRho: () => String(P.mpcRho),
  mpcTyres: () => (!isDyn() ? 'off (the kinematic car has no tyres to model)' : P.mpcDyn ? 'on' : 'off'),
  lagModel: () => (P.lag > 0 ? (P.mpcLag ? `τ = ${liveF(P.lag, 2)} s, modeled` : `τ = ${liveF(P.lag, 2)} s, not modeled`) : 'none'),
  // planning (chapter 4)
  eps: () => liveF(P.eps, 1),
  rrtIt: () => String(P.rrtIt),
  planPct: () => String(P.planPct),
  Rmin: () => liveF(P.wheelbase / Math.tan(steerMax()), 2),
  Rplan: () => liveF(planR(), 2),
  stMarg: () => liveF(P.stMarg, 2),
  stNt: () => String(Math.round(P.agT / 0.2)), // the speed planner's columns: its horizon in 0.2 s steps
  dtc: () => liveF(0.2 / Math.max(0.2, Math.min(P.vcruise, P.vmax)), 2),
  nt: () => String(Math.ceil(P.agT / (0.2 / Math.max(0.2, Math.min(P.vcruise, P.vmax)))) + 1),
  v0: () => liveF(anV0()),
  Ld: () => liveF(ppFormulas().Ld),
  Ke0: () => liveF(ppFormulas().Ke, 3),
  Kth0: () => liveF(ppFormulas().Kth, 3),
  wn0: () => liveF(ppFormulas().wn),
  wc0: () => liveF(ppFormulas().wc),
  lead0: () => liveF(ppFormulas().lead, 1),
  holdlag0: () => liveF(ppFormulas().hold, 1),
  pm0: () => liveF(ppFormulas().pm, 1),
  dm0: () => liveF(ppFormulas().dm),
  zero: () => liveF(ppFormulas().zero),
  os0: () => liveF(ppFormulas().os, 1),
  settle0: () => liveF(ppFormulas().settle, 1),
  ess0: () => liveF(ppFormulas().ess, 1),
  Ke: () => {
    const R = liveRes();
    return R && R.M.Ke != null ? liveF(R.M.Ke, 3) : '—';
  },
  Kth: () => {
    const R = liveRes();
    return R && R.M.Kth != null ? liveF(R.M.Kth, 3) : '—';
  },
  wc: () => {
    const R = liveRes();
    return R ? liveF(R.F.wc) : '—';
  },
  pm: () => {
    const R = liveRes();
    return R ? liveF(R.F.pm, 1) : '—';
  },
  dm: () => {
    const R = liveRes();
    return R ? liveF(R.F.dm) : '—';
  },
  gm: () => {
    const R = liveRes();
    return R ? liveF(R.F.gm, 1) : '—';
  },
  w180: () => {
    const R = liveRes();
    return R ? liveF(R.F.w180, 1) : '—';
  },
  ms: () => {
    const R = liveRes();
    return R ? liveF(R.F.ms) : '—';
  },
  nyq: () => {
    const R = liveRes();
    if (!R) return '—';
    const N = R.F.Ncw,
      Pl = R.F.P || 0,
      Z = N + Pl;
    return `N = ${N}, P = ${Pl}, Z = ${Z} → ${R.stable ? 'stable' : 'unstable'}`;
  },
  zeta: () => {
    const R = liveRes();
    return R ? liveF(R.zeta) : '—';
  },
  wn: () => {
    const R = liveRes();
    return R ? liveF(R.wn) : '—';
  },
  dom: () => {
    const R = liveRes();
    return R && R.dom ? `${liveF(R.dom[0])} ± ${liveF(R.dom[1])}j` : '—';
  },
  os: () => {
    const R = liveRes();
    return R ? liveF(R.smOff.overshoot, 1) : '—';
  },
  settle: () => {
    const R = liveRes();
    return R ? liveF(R.smOff.settle, 1) : '—';
  },
  ess: () => {
    const R = liveRes();
    return R ? liveF(100 * 0.1 * Math.abs(R.smBias.final), 1) : '—';
  }
};
function chapterLive() {
  const v = $('#learnview');
  if (!chapterOpen || !v) return;
  v.querySelectorAll('.live').forEach(el => {
    const f = LIVE[el.dataset.k];
    let s = '—';
    try {
      s = f ? f() : '?';
    } catch (_) {}
    el.textContent = s;
  });
}
function chapterLiveSoon() {
  if (!chapterOpen) return;
  clearTimeout(liveTimer);
  liveTimer = setTimeout(chapterLive, 120);
}
const chapterById = id => CHAPTERS.find(c => c.id === id);
function openChapter(id, sec) {
  const c = chapterById(id);
  if (!c) return false;
  chapterFrom = lessonOpen;
  if (lessonOpen) lessonBack();
  chapterOpen = id;
  chapterSec = sec || null;
  renderLearn();
  hashSoon();
  const v = $('#learnview'),
    h = sec && v.querySelector('#n-' + sec);
  if (h) h.scrollIntoView({block: 'start'});
  else if (v.getBoundingClientRect().top < 0) v.scrollIntoView({block: 'start'});
  return true;
}
function chapterBack() {
  const from = chapterFrom;
  chapterOpen = null;
  chapterFrom = null;
  chapterSec = null;
  if (from && openLesson(from, {restore: true})) {
    try {
      history.replaceState(null, '', lessonLink(from).replace(/^[^#]*/, ''));
    } catch (_) {}
    return;
  }
  renderLearn();
  if (activeTab === 'view') renderAllPanes();
}
function chapterLink(id, sec) {
  return location.href.split('#')[0] + `#notes=${id}${sec ? '/' + sec : ''}`;
}
// the list shown in the Learn column when nothing is open
function chaptersListHTML() {
  if (!CHAPTERS.length) return '';
  return (
    `<section class="lgroup notes-list"><h3>Companion notes</h3><p class="note">The mathematics behind each part of the lab, one chapter per tab, with numbers that follow your current settings.</p>` +
    CHAPTERS.map(
      c =>
        `<div class="chapter-item" data-sys="${c.sys}"><span class="lnum">${c.num}</span><button type="button" class="linkbtn chapter-open" data-ch="${c.id}">${c.title}</button><span class="note">${c.summary}</span></div>`
    ).join('') +
    `</section>`
  );
}
function renderChapter() {
  const v = $('#learnview'),
    c = chapterById(chapterOpen);
  v.classList.add('reading', 'chapter');
  v.innerHTML =
    `<div class="learn-head"><button class="btn small" id="learn-back" type="button" title="${chapterFrom ? 'Back to the lesson you came from' : 'Back to the list'}">${chapterFrom ? '← Back to the lesson' : '← Lessons and notes'}</button><span class="lbl" data-sys="${c.sys}">Chapter ${c.num}</span><button class="linkbtn" id="learn-link" type="button" title="A link that opens this chapter">Copy link</button><span class="lbl" id="learn-msg"></span></div>` +
    `<article class="chapter"><h2>${c.title}</h2><nav class="chapter-toc">${c.toc.map(t => `<a href="#n-${t.id}" data-to="n-${t.id}">${t.text}</a>`).join('')}</nav>${c.html}</article>`;
  v.querySelectorAll('.chapter-toc a').forEach(
    a =>
      (a.onclick = e => {
        e.preventDefault();
        const h = v.querySelector('#' + a.dataset.to);
        if (h) h.scrollIntoView({block: 'start', behavior: 'smooth'});
      })
  );
  v.querySelectorAll('button.try').forEach(
    b =>
      (b.onclick = () => {
        let cfg;
        try {
          cfg = JSON.parse(b.dataset.cfg);
        } catch (_) {
          return;
        }
        if (cfg.sim) tryGo(cfg);
        else lessonGo(cfg);
        chapterLiveSoon();
      })
  );
  $('#learn-back').onclick = chapterBack;
  $('#learn-link').onclick = () => {
    const u = chapterLink(chapterOpen),
      msg = $('#learn-msg');
    try {
      history.replaceState(null, '', '#' + u.split('#')[1]);
    } catch (_) {}
    if (navigator.clipboard)
      navigator.clipboard.writeText(u).then(
        () => {
          msg.textContent = 'Link copied.';
        },
        () => {
          msg.textContent = u;
        }
      );
    else msg.textContent = u;
  };
  chapterLive();
}
// #notes=ch6 opens Learn on that chapter; #notes=ch2/4-the-kalman-update-derived scrolls to that section
function chapterFromHash() {
  const m = /^notes=([\w-]+)(?:\/([\w-]+))?$/.exec(location.hash.slice(1));
  if (!m || !chapterById(m[1])) return false;
  setUIMode('learn');
  return openChapter(m[1], m[2]);
}
window.addEventListener('hashchange', chapterFromHash);
// GNSS (chapter 2 §12): the receiver's settings and what they imply for a filter that takes the fixes as white
Object.assign(LIVE, {
  gnssSig: () => liveF(P.gnssSig, 2),
  gnssBias: () => liveF(P.gnssBias, 1),
  gnssTau: () => liveF(P.gnssTau, 0),
  gnssHz: () => liveF(P.gnssHz, 0),
  gnssRep: () => liveF(gnssRep(), 2),
  gnssPhi: () => liveF(Math.exp(-1 / (P.gnssHz * Math.max(1, P.gnssTau))), 4),
  // a minute of fixes: what the plain filter claims for their average, and the truth with the correlated bias
  gnssClaim: () => liveF(gnssRep() / Math.sqrt(60 * P.gnssHz), 3),
  gnssTrue: () => {
    const N = Math.round(60 * P.gnssHz),
      phi = Math.exp(-1 / (P.gnssHz * Math.max(1, P.gnssTau)));
    let s = N;
    for (let m = 1; m < N; m++) s += 2 * (N - m) * phi ** m;
    return liveF(Math.sqrt((P.gnssSig * P.gnssSig) / N + (P.gnssBias * P.gnssBias * s) / (N * N)), 2);
  },
  gnssQ: () => liveF((2 * P.gnssBias * P.gnssBias) / Math.max(1, P.gnssTau), 3)
});
