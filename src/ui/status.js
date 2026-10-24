/* ---------- status & metrics ---------- */
// Status strip: the state as a coloured chip (grey ready/idle, amber plan, green drive, blue done, red stuck/lost/contact), then large figures
const STATE_CLS = {IDLE: 'idle', PLAN: 'plan', DRIVE: 'drive', NO_PATH: 'bad', DONE: 'done', LOST: 'bad'};
// While the timeline replays a moment, the strip shows that moment (the recorded frame), marked "replay"
function renderStatus() {
  const f = replayFrame(),
    V = f || S,
    F = V.fsm,
    r = V.robot,
    e = V.est,
    ep = hyp(r.x - e.x, r.y - e.y),
    done = f ? f.done.filter(d => d[0]).length : WPS.filter(w => w.done).length,
    nc = V.coll + V.collPed;
  const ready = !f && !running && S.t === 0 && (F.state === 'DRIVE' || F.state === 'PLAN'),
    contact = r.contact || r.pedContact;
  const st = contact ? 'CONTACT' : ready ? 'READY' : F.state.replace('_', ' '),
    cls = contact ? 'bad' : ready ? 'ready' : STATE_CLS[F.state];
  const cell = (k, v, c = '', tip = '') => `<span class="kv" title="${tip || k}"><span>${k}</span><b class="${c}">${v}</b></span>`;
  $('#status').innerHTML =
    `<span class="pill ${cls}">${st}</span>${F.state === 'IDLE' && WPS.length === 0 ? `<span class="st-note">tap the map to add goals</span>` : ''}` +
    cell('t', `${V.t.toFixed(1)} s`, f ? 'replay' : '', f ? 'Replaying a recorded moment; Live or Run returns to the live state' : '') +
    (exploring()
      ? cell(
          'floor seen',
          `${(100 * (exploredFrac() || 0)).toFixed(0)} %`,
          '',
          `${S.frontiers ? S.frontiers.length : 0} frontiers left; Mission → Explore picks the goals`
        )
      : cell('goals', `${done}/${f ? f.done.length : WPS.length}`)) +
    (P.loc === 'truth'
      ? cell('pose', 'known', '', 'Ground truth: the estimate is the true pose; pick an estimator in Localize to see an error')
      : cell('pose error', `${ep.toFixed(2)} m`, ep > 0.5 ? 'bad' : '', 'Distance between the true pose and the estimate')) +
    cell('collisions', String(nc), nc ? 'bad' : '', `${V.coll} static, ${V.collPed} people`) +
    (!f && P.agPred === 'learned' && agOn() ? predCell(cell) : '') +
    (isCar() ? cell('gear · steer', `${r.v < -0.01 ? 'R' : r.v > 0.01 ? 'D' : '–'} · ${deg(r.d).toFixed(0)}°`) : '') +
    (f ? `<span class="st-replay" title="The page shows a recorded moment. Live or Run returns to the live state.">replay</span>` : '');
  $('#run').textContent = running ? 'Pause' : 'Run';
}
// With the learned predictor: both predictors' mean error at 2 s so far, the learned one first
function predCell(cell) {
  const pe = predErrors();
  if (!pe || pe.ln[1] == null) return '';
  return (
    cell(
      'pred. error 2 s',
      `${pe.ln[1].toFixed(2)} m`,
      pe.ln[1] > pe.cv[1] ? 'bad' : '',
      `Mean distance between where the learned predictor put each person 2 s ahead and where they were: ${pe.ln[1].toFixed(2)} m (at 1 s ${pe.ln[0].toFixed(2)} m). Constant velocity: ${pe.cv[1].toFixed(2)} m (at 1 s ${pe.cv[0].toFixed(2)} m).`
    ) + cell('cv', `${pe.cv[1].toFixed(2)} m`, '', 'Constant velocity’s mean error 2 s ahead, on the same people at the same moments')
  );
}
function renderMetrics() {
  const r = S.robot,
    e = S.est,
    ep = hyp(r.x - e.x, r.y - e.y);
  const nees = S.nees.length ? S.nees.reduce((a, b) => a + b, 0) / S.nees.length : null;
  const ps = S.planStats;
  const items = [
    ['Distance', `${S.dist.toFixed(1)} m`],
    ...(P.per === 'mapping'
      ? [
          [
            'Floor seen',
            `${(100 * (exploredFrac() || 0)).toFixed(0)} %${exploring() ? ` · ${S.frontiers ? S.frontiers.length : 0} frontiers` : ''}`,
            'per'
          ]
        ]
      : []),
    ['Collisions', `${S.coll} static, ${S.collPed} people${S.collPedStill ? ` (${S.collPedStill} into the stopped robot)` : ''}`],
    ...(P.loc === 'truth'
      ? [['Localization', 'ground truth: the pose is known, no estimate error', 'loc']]
      : [
          ['Pose error', `${ep.toFixed(2)} m · ${deg(Math.abs(wrap(r.th - e.th))).toFixed(1)}°`, 'loc'],
          ['Pose RMS', S.errN ? `${Math.sqrt(S.errSq / S.errN).toFixed(2)} m` : '—', 'loc'],
          ['NEES (3 = consistent)', nees == null ? '—' : `${nees.toFixed(1)}${nees > 7.8 ? ' · overconfident' : ''}`, 'loc']
        ]),
    ['Cross-track RMS', S.cteN ? `${Math.sqrt(S.cteSq / S.cteN).toFixed(3)} m` : '—', 'ctl'],
    ['Last plan', ps ? `${ps.name} · ${ps.len.toFixed(1)} m${ps.extra ? ' · ' + ps.extra : ''} · ${ps.ms.toFixed(0)} ms` : '—', 'plan'],
    ['Search effort', ps && ps.exp ? `${ps.exp} ${ps.name === 'RRT*' ? 'tree nodes' : 'expansions'}` : '—', 'plan']
  ];
  if (P.ctl === 'mpc' && S.mpcStats) {
    const m = S.mpcStats;
    items.push(
      ['MPC solve', `${m.mode} · ${m.ms.toFixed(1)} ms · ${m.it} it · J ${m.J.toFixed(1)}`, 'ctl'],
      ['MPC violation', m.viol > 0.005 ? `${m.viol.toFixed(3)}` : 'none', 'ctl']
    );
  }
  if (S.peds.length) items.push(['Closest to a person', isFinite(S.minPed) ? `${Math.max(0, S.minPed).toFixed(2)} m` : '—']);
  items.push(...safetyItems());
  if (S.agents && agOn()) {
    const tr = S.agents.tracks,
      cf = tr.filter(t => t.conf).length;
    items.push(['Agent tracks', `${cf} confirmed · ${tr.length - cf} tentative`, 'per']);
    const pe = predErrors(),
      m = v => (v == null ? '—' : v.toFixed(2));
    if (pe && pe.n)
      items.push([
        'Prediction error 1 s · 2 s',
        `constant velocity ${m(pe.cv[0])} · ${m(pe.cv[1])} m${pe.ln[0] != null ? ` · learned ${m(pe.ln[0])} · ${m(pe.ln[1])} m` : ''}`,
        'per'
      ]);
  }
  const rs = radarSummary();
  if (rs) {
    const a = rs.ahead;
    items.push([
      'Radar',
      `${rs.n} detections${rs.paired != null ? ` · ${rs.cand} candidates · ${rs.paired} on tracks · ${rs.born} new` : ''}`,
      'per'
    ]);
    items.push([
      'Radar, nearest ahead',
      a
        ? `${a.r.toFixed(1)} m · ${a.v < 0 ? 'closing' : 'opening'} at ${Math.abs(a.v).toFixed(1)} m/s${rs.ttc != null ? ` · contact in ${rs.ttc.toFixed(1)} s` : ''}`
        : 'nothing within 20°',
      'per'
    ]);
  }
  if (S.slam) items.push(['SLAM map', `${S.slam.n} of ${S.beacons.length} beacons · ${3 + 2 * S.slam.n} states`, 'loc']);
  if (S.pf) items.push(['Particles', `N_eff ${S.pf.neff.toFixed(0)}/${S.pf.N}, inj ${(S.pf.inj * 100).toFixed(0)}%`, 'loc']);
  if (P.assoc === 'unknown' && P.loc !== 'truth' && P.loc !== 'dr') items.push(['Gated measurements', String(S.rejected), 'loc']);
  $('#metrics').innerHTML = items.map(([a, b, c]) => `<div${c ? ` data-sys="${c}"` : ''}><dt>${a}</dt><dd>${b}</dd></div>`).join('');
}

// The safety measures (core/safety.js), in the metrics list: each contact with its speed and the lab's severity class,
// the clearance to the walls, and the leading indicators and exposure counted while the mission runs
function safetyItems() {
  const Z = S.safe;
  if (!Z) return [];
  const s1 = x => `${x.toFixed(1)} s`,
    hits = Z.events;
  const out = [
    [
      'Contacts by speed',
      hits.length
        ? hits
            .map(e =>
              e.kind === 'person' && e.still
                ? `a person walked into the stopped robot (${e.t.toFixed(0)} s)` // not the robot's impact (core/safety.js)
                : `${e.v.toFixed(2)} m/s ${e.sev} (${e.kind === 'static' ? 'wall' : 'person'}, ${e.t.toFixed(0)} s)`
            )
            .join(' · ')
        : 'none',
      'saf'
    ],
    ['Wall clearance', isFinite(Z.minObs) ? `${Math.max(0, Z.minObs).toFixed(2)} m` : '—', 'saf']
  ];
  if (S.peds.length)
    out.push(
      ['Under 0.3 m of a person', s1(Z.nearS), 'saf'],
      ['Time to contact', `${isFinite(Z.ttcMin) ? 'least ' + Z.ttcMin.toFixed(2) + ' s · ' : ''}under 1 s for ${s1(Z.ttc1S)}`, 'saf'],
      ['Person within 2 m', `${s1(Z.near2S)} of ${s1(Z.opS)} driving`, 'saf']
    );
  if (isCar()) out.push(['Reversing', s1(Z.revS), 'saf']);
  if (P.guard) out.push(['Safety stop capping the speed', s1(Z.guardS), 'saf']);
  if (P.radBrake) {
    const nf = Z.brakes.filter(b => b.kind !== 'person').length;
    out.push([
      'Emergency brake',
      `${Z.brakes.length} stop${Z.brakes.length === 1 ? '' : 's'}${nf ? `, ${nf} for a ghost, clutter or a wall` : ''} · held ${s1(Z.brakeS)}`,
      'saf'
    ]);
  }
  return out.concat(learnItems());
}
// The learned blocks (core/learnmon.js): people found by range, the prediction error by slice, how far out of distribution
function learnItems() {
  const L = learnSummary(),
    pc = x => (x == null ? '—' : `${(100 * x).toFixed(0)} %`),
    out = [];
  if (L.det) {
    const s = L.det.slices;
    out.push([
      'People found',
      `${pc(L.det.recall)} of those the scan hits · under 2.5 m ${pc(s.near[0])} · 2.5–5 m ${pc(s.mid[0])} · farther ${pc(s.far[0])} · ${L.det.fpScan.toFixed(2)} false per scan`,
      'saf'
    ]);
  }
  if (L.predSl && agOn()) {
    const line = k => {
      const E = L.predSl[k];
      return E
        ? ['steady', 'changing']
            .map(s => (E[s] ? `${s} ${E[s][0].toFixed(2)} m` : ''))
            .filter(Boolean)
            .join(', ')
        : '—';
    };
    out.push(['Prediction error at 2 s', `learned: ${line('ln')} · constant velocity: ${line('cv')}`, 'saf']);
  }
  const names = {detector: 'Detector input', predictor: 'Predictor input', policy: 'Policy input'},
    sig = learnSig() || {};
  for (const [b, o] of Object.entries(L.ood || {})) {
    if (sig[b] == null) continue;
    out.push([names[b], `score ${sig[b].toFixed(2)} now (outside above ${o.thr}) · ${pc(o.out)} of the run outside`, 'saf']);
  }
  return out;
}
