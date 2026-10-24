/* ============================================================
   Safety measures (the safety lessons, docs/safety-lab.md §6 C1–C3). Observation only: nothing here changes what the
   robot does, and nothing draws a random number, so a run is the same with or without them.
   - Contact events (C1): every contact's time, place, kind, the relative speed at contact and the lab's severity
     class for it, and the conditions active at the time (weather, sensors off, faults the filters are not told about).
   - Clearance to the walls and racks (C2): the true footprint's smallest gap to a static obstacle, read from the
     distance field of the true occupancy (LV.truthDist, 0.1 m cells; the car's footprint is its covering circles,
     which overstate the body by up to about 0.14 m at the bumpers).
   - Health (C5): every 0.5 s the rules of core/health.js; the first time each check turned amber or red, and the
     moments a subsystem's light did, so a run without a page can say when the stack noticed.
   - Leading indicators and exposure (C3), counted while the mission runs: seconds with a person closer than 0.3 m,
     the smallest time to contact with a person (both keeping their velocities), seconds with it under 1 s, seconds
     with a person within 2 m, seconds reversing, and seconds the safety stop capped the speed.
   ============================================================ */
// The lab's severity scale from the relative speed at contact [m/s]: the lab's own, not a standard's injury classes
const SAFE_SEV = [
  [0.3, 'touch'],
  [1, 'bump'],
  [Infinity, 'strike']
];
const sevClass = v => SAFE_SEV.find(([lim]) => v < lim)[1];
// Settings that make a run's conditions differ from the defaults, named in a contact event when they do
const SAFE_CONDS = [
  'weather',
  'people',
  'odoK',
  'odoB',
  'gyroBias',
  'bOff',
  'bOut',
  'assoc',
  'clutter',
  'gnssMp',
  'gnssOut',
  'sensLat',
  'latency',
  'lag',
  'biasDeg',
  'biasW',
  'mu',
  'radClutter',
  'radGhost',
  'sonXt'
];

function safeInit() {
  return {
    events: [],
    minObs: Infinity,
    nearS: 0,
    ttcMin: Infinity,
    ttc1S: 0,
    near2S: 0,
    revS: 0,
    guardS: 0,
    brakes: [], // the radar emergency brake's stops: time, what the echo really was, its time to contact and range
    brakeS: 0,
    opS: 0,
    gap: Infinity,
    health: {}, // the first time each health check turned amber or red: 'sys/name' → {t, lvl, msg} (C5)
    hprev: {},
    hev: [] // the moments a subsystem's light turned amber or red, as the page marks them on its timeline
  };
}
function safeConds() {
  const out = [];
  for (const k of SAFE_CONDS)
    if (P[k] != null && JSON.stringify(P[k]) !== JSON.stringify(DEFAULTS[k])) out.push(k + '=' + JSON.stringify(P[k]));
  for (const s of sensorsOff()) if (!s.on && DEFAULTS[s.flag]) out.push(s.key + ' off'); // switched off, not off by default (the beacons' switch is bOff)
  return out;
}
// The robot's true velocity in the world frame (the car with tyre slip adds its sideways velocity)
function safeVel(r) {
  const c = Math.cos(r.th),
    s = Math.sin(r.th),
    vy = isDyn() ? r.vy || 0 : 0;
  return [r.v * c - vy * s, r.v * s + vy * c];
}
// A contact's rising edge (core/vehicle.js): kind 'static' or 'person'; v0 the robot's speed before a static contact
function safeContact(kind, v0) {
  const r = S.robot,
    Z = S.safe;
  let v = Math.abs(v0 || 0),
    still = false;
  if (kind === 'person') {
    let best = null,
      g = Infinity;
    for (const p of S.peds) {
      const d = bodyGap(r, p);
      if (d < g) {
        g = d;
        best = p;
      }
    }
    const [rx, ry] = safeVel(r);
    v = best ? hyp((best.vx || 0) - rx, (best.vy || 0) - ry) : 0;
    still = Math.abs(r.v) < 0.05;
  }
  v = +v.toFixed(2); // the class of the speed as shown, so that "0.30 m/s" never reads as a touch
  Z.events.push({
    t: +S.t.toFixed(2),
    kind,
    still,
    x: +r.x.toFixed(2),
    y: +r.y.toFixed(2),
    v,
    sev: sevClass(v),
    state: S.fsm.state,
    conds: safeConds()
  });
}
// Once per tick, after the robot and the people moved (core/step.js metrics)
function safeTick() {
  const r = S.robot,
    Z = S.safe,
    run = S.fsm.state !== 'IDLE' && S.fsm.state !== 'DONE';
  if (S.lastZ && S.lastZ.length) S.zLastT = S.t; // the beacon-silence check reads it (core/health.js)
  if (S.tick % 10 === 0) safeHealth();
  const D = LV.truthDist;
  if (D)
    for (const [x, y, rad] of fpCircles(r.x, r.y, r.th)) {
      const i = Math.floor(x / RES),
        j = Math.floor(y / RES);
      if (i < 0 || j < 0 || i >= GW || j >= GH) continue;
      const g = D[j * GW + i] - rad;
      if (g < Z.minObs) Z.minObs = g;
    }
  if (!run) return;
  Z.opS += DT;
  if (Z.gap < 0.3) Z.nearS += DT;
  if (Z.gap < 2) Z.near2S += DT;
  if (r.v < -0.05) Z.revS += DT;
  if (S.guard) Z.guardS += DT;
  if (S.radBrake && S.t < S.radBrake.until) Z.brakeS += DT;
  if (!S.peds.length) return;
  const [rx, ry] = safeVel(r);
  let ttc = Infinity;
  for (const p of S.peds) {
    const g = bodyGap(r, p),
      dx = p.x - r.x,
      dy = p.y - r.y,
      d = hyp(dx, dy),
      close = d > 1e-6 ? -(dx * ((p.vx || 0) - rx) + dy * ((p.vy || 0) - ry)) / d : 0; // closing speed along the line between them
    if (g > 0 && close > 0.05) ttc = Math.min(ttc, g / close);
  }
  if (ttc < Z.ttcMin) Z.ttcMin = ttc;
  if (ttc < 1) Z.ttc1S += DT;
}
// Every 0.5 s: the health rules of core/health.js, the same the page's lights show
function safeHealth() {
  const H = healthNow(null),
    Z = S.safe,
    t = +S.t.toFixed(2);
  for (const [k] of H_SYS) {
    for (const c of H.all[k] || []) {
      const key = k + '/' + c.name;
      if (c.on && H_RANK[c.lvl] >= 2 && !Z.health[key]) Z.health[key] = {t, lvl: c.lvl, msg: c.msg};
    }
    const lv = H[k][0],
      pv = Z.hprev[k];
    if (pv != null && H_RANK[lv] >= 2 && H_RANK[lv] > H_RANK[pv] && Z.hev.length < 200) Z.hev.push({t, sys: k, lvl: lv, msg: H[k][1]});
    Z.hprev[k] = lv;
  }
}
// The summary's safety fields (src/worker/main.js runSummary, the Experiments metrics)
function safeSummary() {
  const Z = S.safe,
    f = (x, n = 2) => (isFinite(x) ? +x.toFixed(n) : null),
    hits = Z.events.filter(e => e.kind === 'person' && !e.still);
  return {
    impact: hits.length ? Math.max(...hits.map(e => e.v)) : 0,
    minObs: f(Z.minObs, 3),
    nearS: f(Z.nearS, 1),
    ttcMin: f(Z.ttcMin),
    ttc1S: f(Z.ttc1S, 1),
    near2S: f(Z.near2S, 1),
    revS: f(Z.revS, 1),
    guardS: f(Z.guardS, 1),
    brakes: Z.brakes.length,
    brakesFalse: Z.brakes.filter(b => b.kind !== 'person').length, // braked for a ghost, clutter or a wall
    brakeS: f(Z.brakeS, 1),
    opS: f(Z.opS, 1),
    events: Z.events,
    health: Z.health,
    healthEv: Z.hev
  };
}
