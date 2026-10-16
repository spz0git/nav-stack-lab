(()=>{
'use strict';
/* ---- core/constants.js ---- */
/* ============================================================
   Constants & helpers
   ============================================================ */
const W = 24,
  H = 16,
  RES = 0.1,
  GW = 240,
  GH = 160,
  NC = GW * GH,
  DT = 0.05,
  RR = 0.3,
  LETHAL = 0.4,
  LMAX = 8,
  NBEAM = 120,
  PENW = 3,
  SQ2 = Math.SQRT2,
  TAU = Math.PI * 2;
const ARRIVE = 0.25,
  OFFPATH = 1.0; // arrival radius; replan when the estimate is this far from the path [m]
const $ = s => (typeof document !== 'undefined' ? document.querySelector(s) : null);
const CAR = {rear: 0.15, front: 0.15, width: 0.5}; // overhangs and width [m]; pose = rear-axle center
const wrap = a => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const hyp = Math.hypot;
const deg = r => (r * 180) / Math.PI;
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRng(seed) {
  const u = mulberry32(seed >>> 0);
  let spare = null;
  return {
    u,
    n() {
      if (spare !== null) {
        const s = spare;
        spare = null;
        return s;
      }
      let a;
      do {
        a = u();
      } while (a <= 1e-12);
      const b = u();
      const r = Math.sqrt(-2 * Math.log(a));
      spare = r * Math.sin(TAU * b);
      return r * Math.cos(TAU * b);
    }
  };
}
const cellI = x => Math.floor(x / RES),
  cellIdx = (x, y) => {
    const i = Math.floor(x / RES),
      j = Math.floor(y / RES);
    if (i < 0 || j < 0 || i >= GW || j >= GH) return -1;
    return j * GW + i;
  };
function integ(x, y, th, v, w, dt) {
  if (Math.abs(w) < 1e-6) return {x: x + v * dt * Math.cos(th), y: y + v * dt * Math.sin(th), th: wrap(th + w * dt)};
  const r = v / w,
    th2 = th + w * dt;
  return {x: x + r * (Math.sin(th2) - Math.sin(th)), y: y - r * (Math.cos(th2) - Math.cos(th)), th: wrap(th2)};
}
const isCar = () => P.model === 'car';
const isDyn = () => isCar() && P.carPhys === 'dyn'; // car with tyre slip (dynamic bicycle model, vehicle.js)
const steerMax = () => (P.steerMaxDeg * Math.PI) / 180;
const minTurnR = () => P.wheelbase / Math.tan(steerMax());
const planSteer = () => (steerMax() * P.planPct) / 100,
  planR = () => P.wheelbase / Math.tan(planSteer()); // planners keep steering margin for feedback
const carLen = () => CAR.rear + P.wheelbase + CAR.front;
// Footprint as covering circles (used by planners and DWA). Diff-drive: one circle.
function fpCircles(x, y, th) {
  if (!isCar()) return [[x, y, RR]];
  const part = carLen() / 3,
    r = Math.hypot(part / 2, CAR.width / 2),
    c = Math.cos(th),
    s = Math.sin(th),
    out = [];
  for (let i = 0; i < 3; i++) {
    const o = -CAR.rear + part * (i + 0.5);
    out.push([x + o * c, y + o * s, r]);
  }
  return out;
}
// Exact oriented-rectangle test for the car body (used by physics)
function carHits(x, y, th, shapes, m) {
  m = m || 0;
  const c = Math.cos(th),
    s = Math.sin(th),
    hl = carLen() / 2 + m,
    hw = CAR.width / 2 + m,
    off = carLen() / 2 - CAR.rear,
    cx = x + off * c,
    cy = y + off * s,
    ac = Math.abs(c),
    as = Math.abs(s);
  for (const sh of shapes) {
    if (sh.t === 'c') {
      const dx = sh.x - cx,
        dy = sh.y - cy,
        lx = dx * c + dy * s,
        ly = -dx * s + dy * c,
        qx = clamp(lx, -hl, hl),
        qy = clamp(ly, -hw, hw);
      if (Math.hypot(lx - qx, ly - qy) < sh.r) return true;
      continue;
    }
    const ex = sh.w / 2,
      ey = sh.h / 2,
      dx = sh.x + ex - cx,
      dy = sh.y + ey - cy;
    if (Math.abs(dx) > ex + hl * ac + hw * as) continue;
    if (Math.abs(dy) > ey + hl * as + hw * ac) continue;
    if (Math.abs(dx * c + dy * s) > hl + ex * ac + ey * as) continue;
    if (Math.abs(-dx * s + dy * c) > hw + ex * as + ey * ac) continue;
    return true;
  }
  return false;
}
const bodyHits = (x, y, th, shapes, m) => (isCar() ? carHits(x, y, th, shapes, m) : circleHits(x, y, RR + (m || 0), shapes));
// Smallest footprint clearance against a distance field
function fpClear(x, y, th, dist) {
  let m = Infinity;
  for (const [cx, cy, r] of fpCircles(x, y, th)) {
    const k = cellIdx(cx, cy);
    if (k < 0) return -1;
    const d = dist[k] - r;
    if (d < m) m = d;
  }
  return m;
}
class Heap {
  constructor() {
    this.k = [];
    this.v = [];
  }
  get size() {
    return this.k.length;
  }
  push(v, k) {
    const K = this.k,
      V = this.v;
    let i = K.length;
    K.push(k);
    V.push(v);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (K[p] <= k) break;
      K[i] = K[p];
      V[i] = V[p];
      i = p;
    }
    K[i] = k;
    V[i] = v;
  }
  pop() {
    const K = this.k,
      V = this.v;
    const top = V[0];
    const lk = K.pop(),
      lv = V.pop();
    const n = K.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const m = r < n && K[r] < K[l] ? r : l;
        if (K[m] >= lk) break;
        K[i] = K[m];
        V[i] = V[m];
        i = m;
      }
      K[i] = lk;
      V[i] = lv;
    }
    return top;
  }
}

/* ---- core/worlds.js ---- */
/* ============================================================
   Worlds & levels
   ============================================================ */
const Rc = (x, y, w, h) => ({t: 'r', x, y, w, h}),
  Ci = (x, y, r) => ({t: 'c', x, y, r});
const BORDER = [Rc(0, 0, 24, 0.2), Rc(0, 15.8, 24, 0.2), Rc(0, 0, 0.2, 16), Rc(23.8, 0, 0.2, 16)];
function warehouse() {
  const s = [...BORDER];
  for (const y of [3.2, 6.4, 9.6, 12.8]) {
    s.push(Rc(3.5, y, 7, 0.8));
    s.push(Rc(13.5, y, 7, 0.8));
  }
  return s;
}
const WH_BEACONS = [
  [3.3, 3.6],
  [20.7, 3.6],
  [10.7, 6.8],
  [13.3, 6.8],
  [3.3, 10],
  [20.7, 10],
  [10.7, 13.2],
  [13.3, 13.2],
  [12, 0.45],
  [12, 15.55],
  [0.45, 8],
  [23.55, 8]
];
const BUILDING = [
  ...BORDER,
  Rc(7.9, 0, 0.2, 6),
  Rc(7.9, 7.4, 0.2, 8.6), // wall x=8, door y 6–7.4
  Rc(15.9, 0, 0.2, 11),
  Rc(15.9, 12.4, 0.2, 3.6), // wall x=16, door y 11–12.4
  Rc(0, 7.9, 3, 0.2),
  Rc(4.4, 7.9, 3.5, 0.2), // wall y=8 left, door x 3–4.4
  Rc(16.1, 7.9, 2.9, 0.2),
  Rc(20.4, 7.9, 3.6, 0.2), // wall y=8 right, door x 19–20.4
  Rc(10, 2, 2.5, 1.2),
  Rc(11, 11, 1.2, 3),
  Rc(3, 11, 2, 1),
  Rc(19, 3, 2, 2),
  Ci(13, 7, 0.6)
];

// Parking lot: parked cars are obstacles (0.56 × 1.0 m); bays are 1 m wide
const PARKING = (() => {
  const s = [...BORDER, Rc(4, 9.45, 16, 0.3)];
  for (let bx = 4; bx < 20; bx++) {
    if (bx !== 10 && bx !== 16) s.push(Rc(bx + 0.22, 14.65, 0.56, 1.0));
    if (bx !== 7 && bx !== 13) s.push(Rc(bx + 0.22, 9.85, 0.56, 1.0));
    if (bx !== 15 && bx !== 9) s.push(Rc(bx + 0.22, 8.35, 0.56, 1.0));
  }
  for (const x of [4, 7.2, 9.7, 12.5, 15.5]) s.push(Rc(x, 0.3, 1.0, 0.56)); // 2.2 m parallel slot at x 5.0–7.2
  s.push(Ci(9, 4.6, 0.35), Ci(13, 4.6, 0.35), Ci(17, 4.6, 0.35), Rc(20.6, 2.4, 1.2, 1.2));
  return s;
})();
// Moose test: a 3.2 m road with barriers, a box in the right lane, then one in the left lane (a slalom)
const MOOSE = [...BORDER, Rc(0.2, 6.1, 23.6, 0.3), Rc(0.2, 9.6, 23.6, 0.3), Rc(8, 6.4, 0.6, 1.5), Rc(15, 8.1, 0.6, 1.5)];
const LEVELS = [
  {
    id: 'L1',
    name: 'Open floor',
    adds: 'Perfect pose and a known map, a few pillars, straight-line paths. Everything is ideal except the controller, so this is where you tune tracking.',
    tries: [
      {
        t: '<b>Control:</b> drop pure-pursuit L<sub>0</sub> to 0.1 m, then raise it to 2 m. Watch the cross-track plot: short lookahead oscillates, long lookahead cuts corners.',
        b: [
          ['L<sub>0</sub> = 0.1 m', {set: {ppL0: 0.1}, tab: 'ctl', plot: 'cte'}],
          ['L<sub>0</sub> = 2 m', {set: {ppL0: 2}, tab: 'ctl', plot: 'cte'}]
        ]
      },
      {t: '<b>Control:</b> switch to PID and compare the same legs.', b: [['PID', {set: {ctl: 'pid'}, tab: 'ctl', plot: 'cte'}]]},
      {
        t: '<b>Vehicle:</b> turn on acceleration limits and set lag τ to 0.3 s. The speed plot shows command and response diverge.',
        b: [['Limits on, τ = 0.3 s', {set: {accel: true, lag: 0.3}, tab: 'veh', plot: 'v'}]]
      },
      {
        t: '<b>Control:</b> MPC. Compare cross-track RMS with pure pursuit. Shrink Np to 3 (myopic) and Nc to 1 (one held move). With lag τ = 0.3 s, tick Include actuator lag and compare.',
        b: [
          ['MPC', {set: {ctl: 'mpc'}, tab: 'ctl', plot: 'cte'}],
          ['N<sub>p</sub> = 3, N<sub>c</sub> = 1', {set: {ctl: 'mpc', mpcNp: 3, mpcNc: 1}, tab: 'ctl', plot: 'cte'}],
          ['τ = 0.3 s, lag modeled', {set: {ctl: 'mpc', lag: 0.3, mpcLag: true}, tab: 'ctl', plot: 'v'}]
        ]
      }
    ],
    shapes: [...BORDER, Ci(6, 11, 0.7), Ci(14, 6, 0.8), Ci(12, 2.5, 0.5), Ci(19, 13.5, 0.6), Rc(8, 7, 2, 1.5)],
    beacons: [
      [0.45, 4],
      [0.45, 12],
      [12, 0.45],
      [12, 15.55],
      [23.55, 4],
      [23.55, 12]
    ],
    peds: [],
    start: [2, 2, 0.6],
    wps: [
      [10, 12],
      [20, 10],
      [18, 3],
      [4, 8]
    ],
    cfg: {
      loc: 'truth',
      per: 'oracle',
      mis: 'sequential',
      plan: 'straight',
      ctl: 'pp',
      odoK: 0,
      odoB: 0,
      accel: false,
      lag: 0,
      assoc: 'known',
      clutter: 0,
      replan: 0
    },
    layers: {cost: false}
  },
  {
    id: 'L2',
    name: 'Warehouse aisles',
    adds: 'Shelving rows block straight lines. Pose and map are still perfect, so the global planner is the only thing that changes outcomes.',
    tries: [
      {
        t: '<b>Plan:</b> pick Straight line and run. The robot drives into a shelf and the stuck detector fires.',
        b: [['Straight line', {set: {plan: 'straight'}, tab: 'plan'}]]
      },
      {
        t: '<b>Plan:</b> A* with ε = 1 versus ε = 3. Compare expansions and path length in the log (weighted A* is bounded by ε × optimal).',
        b: [
          ['ε = 1', {set: {plan: 'astar', eps: 1}, tab: 'plan'}],
          ['ε = 3', {set: {plan: 'astar', eps: 3}, tab: 'plan'}]
        ]
      },
      {
        t: '<b>Plan:</b> RRT*, then change the seed and reset. Sampling planners give a different path every time.',
        b: [
          ['RRT*', {set: {plan: 'rrtstar'}, tab: 'plan'}],
          ['RRT*, next seed', {seed: 'next', set: {plan: 'rrtstar'}, tab: 'plan'}]
        ]
      },
      {
        t: '<b>Mission:</b> Optimal versus In order. The log shows total mission cost for each.',
        b: [
          ['In order', {set: {mis: 'sequential'}, tab: 'mis'}],
          ['Optimal', {set: {mis: 'optimal'}, tab: 'mis'}]
        ]
      }
    ],
    shapes: warehouse(),
    beacons: WH_BEACONS,
    peds: [],
    start: [1.5, 1.5, 0],
    wps: [
      [8, 5.2],
      [17, 11.2],
      [5, 14.7],
      [21.8, 2]
    ],
    cfg: {
      loc: 'truth',
      per: 'oracle',
      mis: 'sequential',
      plan: 'astar',
      ctl: 'pp',
      odoK: 0,
      odoB: 0,
      accel: false,
      lag: 0,
      assoc: 'known',
      clutter: 0,
      replan: 0
    },
    layers: {cost: true}
  },
  {
    id: 'L3',
    name: 'Noisy odometry',
    adds: 'Wheel odometry is noisy and slightly miscalibrated. The filter is not told about the calibration bias. Wall beacons give range and bearing.',
    tries: [
      {
        t: '<b>Localize:</b> the level starts on dead reckoning. Watch the truth and the estimate separate, and the ellipse grow.',
        b: [['Dead reckoning', {set: {loc: 'dr'}, tab: 'loc', plot: 'pos'}]]
      },
      {
        t: '<b>Localize:</b> switch to EKF. Then raise the odometry bias (Localize, Odometry) and watch NEES climb past 3: the filter becomes overconfident.',
        b: [
          ['EKF', {set: {loc: 'ekf'}, tab: 'loc', plot: 'pos'}],
          ['EKF, bias ×3', {set: {loc: 'ekf', odoB: 3}, tab: 'loc', plot: 'pos'}]
        ]
      },
      {
        t: "<b>Localize:</b> raise the filter's assumed motion noise until NEES settles near 3 again.",
        b: [['EKF, bias ×3, assumed noise ×4', {set: {loc: 'ekf', odoB: 3, filtK: 4}, tab: 'loc', plot: 'pos'}]]
      },
      {
        t: '<b>Localize:</b> EKF-SLAM does not know where the beacons are. It drifts like dead reckoning until it sees a beacon it mapped early; a longer sensor range gives more overlap and bounds the drift.',
        b: [
          ['EKF-SLAM', {set: {loc: 'slam'}, tab: 'loc', plot: 'pos'}],
          ['EKF-SLAM, beacon range 12 m', {set: {loc: 'slam', lmRange: 12}, tab: 'loc', plot: 'pos'}],
          ['EKF-SLAM, unlabeled', {set: {loc: 'slam', assoc: 'unknown'}, tab: 'loc', plot: 'pos'}]
        ]
      },
      {
        t: '<b>Localize:</b> kidnap the robot. With known IDs the EKF can pull itself back. With unlabeled beacons the gate rejects every reading. The particle filter recovers either way.',
        b: [
          ['EKF, kidnap at 8 s', {set: {loc: 'ekf'}, tab: 'loc', plot: 'pos', act: 'kidnap'}],
          ['Unlabeled, kidnap', {set: {loc: 'ekf', assoc: 'unknown'}, tab: 'loc', plot: 'pos', act: 'kidnap'}],
          ['Particle filter, kidnap', {set: {loc: 'pf', assoc: 'unknown'}, tab: 'loc', plot: 'pos', act: 'kidnap'}]
        ]
      },
      {
        t: '<b>Localize:</b> take beacons away from the EKF. With the east half off it coasts on odometry there, like dead reckoning, and snaps back in the west. Flicker costs little; long outages leave dead zones where the ellipse grows.',
        b: [
          ['EKF, east beacons off', {set: {loc: 'ekf', bOff: '1,3,5,7,11'}, tab: 'loc', plot: 'pos'}],
          ['EKF, flickering beacons', {set: {loc: 'ekf', bOut: 50, bOutLen: 0.4}, tab: 'loc', plot: 'pos'}],
          ['EKF, long outages', {set: {loc: 'ekf', bOut: 70, bOutLen: 6}, tab: 'loc', plot: 'pos'}]
        ]
      }
    ],
    shapes: warehouse(),
    beacons: WH_BEACONS,
    peds: [],
    start: [1.5, 1.5, 0],
    wps: [
      [21.8, 2],
      [21.8, 14.5],
      [12, 8.4],
      [2, 14.5],
      [2, 5]
    ],
    cfg: {
      loc: 'dr',
      per: 'oracle',
      mis: 'sequential',
      plan: 'astar',
      ctl: 'pp',
      odoK: 1,
      odoB: 1,
      accel: false,
      lag: 0,
      assoc: 'known',
      clutter: 0,
      replan: 0
    },
    layers: {cost: false}
  },
  {
    id: 'L4',
    name: 'Unknown building',
    adds: 'No prior map. Lidar builds an occupancy grid in the estimated frame, and the planner treats unknown space as free and replans as walls appear.',
    tries: [
      {t: '<b>Mission:</b> follow the replans in the event log as rooms are discovered.', b: [['Run', {tab: 'mis'}]]},
      {
        t: '<b>Mission:</b> let the robot pick its own goals. Frontier exploration maps the whole building with no goals given, one frontier at a time.',
        b: [['Explore', {set: {mis: 'explore'}, tab: 'mis', plot: 'pos'}]]
      },
      {
        t: '<b>Perceive:</b> set unknown space to lethal. Goals in unexplored rooms become unreachable, which is the gap frontier-based exploration fills.',
        b: [['Unknown = lethal', {set: {unknownAs: 'lethal'}, tab: 'per'}]]
      },
      {
        t: '<b>Localize:</b> switch to dead reckoning and watch the map smear: mapping inherits pose error.',
        b: [['Dead reckoning', {set: {loc: 'dr'}, tab: 'loc'}]]
      },
      {
        t: '<b>Control:</b> the path tracker never reads the lidar; it follows a path planned on the map. With dead reckoning and the odometry bias doubled the map smears, and pure pursuit hits walls that are plainly in its scan (2 collisions). The lidar safety stop caps the speed for scan points on the arc it commands: no contact, but the robot still stops short of the goals the smeared map has wrong (1 of 4 either way).',
        b: [
          ['Dead reckoning, bias ×2', {set: {loc: 'dr', odoB: 1}, tab: 'loc'}],
          ['Same, safety stop on', {set: {loc: 'dr', odoB: 1, guard: true}, tab: 'ctl'}]
        ]
      },
      {
        t: '<b>Layers:</b> hide the true-map ghost and judge the map as the robot sees it.',
        b: [['Hide the ghost', {layers: {ghost: false}, tab: 'view', keep: true}]]
      },
      {
        t: '<b>Control:</b> MPC with obstacle constraints handles the tight rooms. Switch it to LTV, which cannot take nonconvex obstacle constraints, and watch it clip the table.',
        b: [
          ['MPC', {set: {ctl: 'mpc'}, tab: 'ctl'}],
          ['LTV', {set: {ctl: 'mpc', mpcMode: 'ltv'}, tab: 'ctl'}]
        ]
      }
    ],
    shapes: BUILDING,
    beacons: [
      [0.45, 4],
      [0.45, 12],
      [7.65, 3],
      [7.65, 12],
      [8.35, 3],
      [8.35, 12],
      [12, 0.45],
      [12, 15.55],
      [15.65, 5],
      [16.35, 14],
      [23.55, 4],
      [23.55, 12],
      [2, 7.65],
      [6, 8.35],
      [18, 8.35],
      [22, 7.65]
    ],
    peds: [],
    start: [2, 2, 0],
    wps: [
      [5, 13],
      [13.5, 14],
      [21, 13],
      [22.5, 5.5]
    ],
    cfg: {
      loc: 'ekf',
      per: 'mapping',
      mis: 'sequential',
      plan: 'astar',
      ctl: 'pp',
      odoK: 1,
      odoB: 0.5,
      accel: false,
      lag: 0,
      assoc: 'known',
      clutter: 0,
      replan: 0
    },
    layers: {cost: false}
  },
  {
    id: 'L5',
    name: 'Busy floor',
    adds: 'Prior map, but people walk the aisles. A lidar tracker estimates where they are and how fast they move, and a speed planner predicts where they will be. Acceleration limits and actuator lag are on, and beacons are unlabeled with false detections.',
    tries: [
      {
        t: '<b>Control:</b> pure pursuit runs with the response to agents set to Speed planning: it keeps its path and slows or waits for people predicted to cross it. Open the ST graph in Telemetry. Then set it to Ignore, then Reactive stop, and compare people contacts.',
        b: [
          ['Speed planning', {tab: 'ctl', plot: 'st'}],
          ['Ignore', {set: {spd: 'none'}, tab: 'ctl'}],
          ['Reactive stop', {set: {spd: 'stop'}, tab: 'ctl'}]
        ]
      },
      {
        t: '<b>Perceive:</b> set Prediction to Static (frozen). The planner then reacts only to where people are now, and the robot pulls into gaps that are about to close.',
        b: [['Static prediction', {set: {agPred: 'static'}, tab: 'per', plot: 'st'}]]
      },
      {
        t: '<b>Perceive:</b> switch Agent tracking from Lidar to Ground truth. The difference is what tracking costs: late confirmation, noisy velocity, coasting through occlusion.',
        b: [['Ground truth', {set: {agents: 'truth'}, tab: 'per'}]]
      },
      {
        t: '<b>Control:</b> DWA and MPC use the predictions too, as time-indexed obstacles. Compare them with Agent tracking off, which treats every lidar hit as a static obstacle at the moment of the scan. MPC respects the acceleration limits exactly; tick Include actuator lag, since τ = 0.15 s here.',
        b: [
          ['DWA', {set: {ctl: 'dwa'}, tab: 'ctl'}],
          ['DWA, tracking off', {set: {ctl: 'dwa', agents: 'off'}, tab: 'ctl'}],
          ['MPC', {set: {ctl: 'mpc', mpcLag: true}, tab: 'ctl'}],
          ['MPC, tracking off', {set: {ctl: 'mpc', mpcLag: true, agents: 'off'}, tab: 'ctl'}]
        ]
      },
      {
        t: '<b>Localize:</b> scatter the particles. With unlabeled beacons this warehouse is nearly 180° symmetric, so the filter can lock onto the mirror pose. Switch to Known IDs and scatter again.',
        b: [
          ['Scatter at 8 s', {tab: 'loc', act: 'scatter'}],
          ['Known IDs, scatter', {set: {assoc: 'known'}, tab: 'loc', act: 'scatter'}]
        ]
      },
      {
        t: '<b>Localize:</b> raise false detections and watch gating and robust weights hold.',
        b: [['2 false detections per scan', {set: {clutter: 2}, tab: 'loc'}]]
      },
      {
        t: '<b>Vehicle:</b> make the people react. With social forces they step around the robot, so even Ignore looks better than it is; the contact counts tell the story.',
        b: [
          ['Reactive people, speed planning', {set: {people: 'reactive'}, tab: 'veh'}],
          ['Reactive people, ignore', {set: {people: 'reactive', spd: 'none'}, tab: 'ctl'}]
        ]
      },
      {
        t: '<b>Vehicle:</b> add sensor latency. The lidar and the beacons arrive 0.2 s late and the filter processes stale readings against a prediction that has moved on; the particle filter loses the robot and recovers.',
        b: [['Sensor latency 0.2 s', {set: {sensLat: 0.2}, tab: 'veh', plot: 'pos'}]]
      },
      {
        t: '<b>Plan:</b> Space-time A* plans in (x, y, t) against the predicted people and will wait in a doorway rather than detour. Compare its replans with A* in the log.',
        b: [['Space-time A*', {set: {plan: 'stastar'}, tab: 'plan', layers: {search: true}}]]
      }
    ],
    shapes: warehouse(),
    beacons: WH_BEACONS,
    peds: [
      {a: [3, 5.2], b: [21, 5.2], v: 0.8, s0: 0.3},
      {a: [12, 1], b: [12, 15], v: 0.7, s0: 0.5},
      {a: [21, 8.4], b: [3, 8.4], v: 0.9, s0: 0.1},
      {a: [2, 14.6], b: [22, 14.6], v: 0.6, s0: 0.7}
    ],
    start: [1.5, 1.5, 0],
    wps: [
      [21.8, 2],
      [17, 11.2],
      [2, 14.5],
      [8, 5.2],
      [21.8, 14.5]
    ],
    cfg: {
      loc: 'pf',
      per: 'oracle',
      mis: 'sequential',
      plan: 'astar',
      ctl: 'pp',
      odoK: 1,
      odoB: 0.5,
      accel: true,
      lag: 0.15,
      assoc: 'unknown',
      clutter: 0.5,
      replan: 2,
      lostGuard: true,
      agents: 'lidar',
      spd: 'st'
    },
    layers: {cost: false}
  },
  {
    id: 'L6',
    name: 'Parking lot',
    adds: 'The robot becomes a car: kinematic bicycle model, 32° steering limit, a turning radius near 1 m, and a body that cannot turn in place. Goals now carry a heading: reverse into a bay, nose into another, then parallel park. People cross the lanes on their way to and from cars, pausing before they turn back.',
    tries: [
      {
        t: '<b>Plan:</b> watch Hybrid A* insert reverse legs (dashed orange). Then switch to A*: the path ignores heading and turning radius, so the car swings wide and misses the bay.',
        b: [
          ['Hybrid A*', {tab: 'plan'}],
          ['A*', {set: {plan: 'astar'}, tab: 'plan'}]
        ]
      },
      {
        t: '<b>Plan:</b> pick Reeds–Shepp. It finds the shortest maneuver but ignores obstacles, so it drives through parked cars.',
        b: [['Reeds–Shepp', {set: {plan: 'rs'}, tab: 'plan'}]]
      },
      {
        t: '<b>Plan:</b> untick Allow reversing. The reverse-in bay and the parallel slot become unreachable or far longer.',
        b: [['No reversing', {set: {revOK: false}, tab: 'plan'}]]
      },
      {
        t: '<b>Plan:</b> set the heuristic to 2D only and compare expansions in the log. Then raise Steering used by the planner to 100%: full-lock arcs leave the tracker no room to correct.',
        b: [
          ['2D heuristic', {set: {hybH: '2d'}, tab: 'plan'}],
          ['Planner at 100 %', {set: {planPct: 100}, tab: 'plan'}]
        ]
      },
      {
        t: '<b>Control:</b> DWA follows the plan into a bay but stops short. It scores distance to a carrot, not the final pose, so it is a local avoider rather than a parking controller.',
        b: [['DWA', {set: {ctl: 'dwa'}, tab: 'ctl'}]]
      },
      {
        t: '<b>Control:</b> the default is rear-wheel feedback (curvature feedforward). Switch to pure pursuit and watch it cut the inside of full-lock arcs. Then try Stanley and lower the steering rate limit in Vehicle.',
        b: [
          ['Pure pursuit', {set: {ctl: 'pp'}, tab: 'ctl', plot: 'cte'}],
          ['Stanley, rate 0.5 rad/s', {set: {ctl: 'stanley', steerRate: 0.5}, tab: 'veh', plot: 'turn'}]
        ]
      },
      {
        t: '<b>Localize:</b> switch to EKF and raise odometry noise. The log reports the true final pose error at every bay.',
        b: [['EKF, noise ×2', {set: {loc: 'ekf', odoK: 2}, tab: 'loc', plot: 'pos'}]]
      },
      {
        t: '<b>Control:</b> MPC knows the steering-rate limit, so it needs no dry-steering rule at cusps. Switch it to LTV and watch the dashed linear prediction drift from the true one at the start of each leg.',
        b: [
          ['MPC', {set: {ctl: 'mpc'}, tab: 'ctl'}],
          ['LTV', {set: {ctl: 'mpc', mpcMode: 'ltv'}, tab: 'ctl'}]
        ]
      },
      {
        t: '<b>Control:</b> people cross the lanes. With the response to agents set to Speed planning the car keeps its maneuver and picks a speed that lets them pass; the ST graph in Telemetry shows why. Set it to Ignore and count contacts, then Reactive stop.',
        b: [
          ['Speed planning', {tab: 'ctl', plot: 'st'}],
          ['Ignore', {set: {spd: 'none'}, tab: 'ctl'}],
          ['Reactive stop', {set: {spd: 'stop'}, tab: 'ctl'}]
        ]
      },
      {
        t: '<b>Perceive:</b> set Prediction to Static (frozen), or the horizon to 1 s. The car stops treating crossing people as future obstacles and noses into their way.',
        b: [
          ['Static prediction', {set: {agPred: 'static'}, tab: 'per', plot: 'st'}],
          ['Horizon 1 s', {set: {agT: 1}, tab: 'per', plot: 'st'}]
        ]
      },
      {
        t: '<b>Vehicle:</b> another car drives the lanes and yields when the robot is close ahead. The tracker sees it as a wide cluster; the speed planner treats it like any agent. Turn it off to compare.',
        b: [
          ['Vehicles on', {tab: 'veh'}],
          ['Vehicles off', {set: {vehicles: false}, tab: 'veh'}],
          ['Reactive people too', {set: {people: 'reactive'}, tab: 'veh'}]
        ]
      },
      {
        t: '<b>Vehicle:</b> the same car with tyres that slip (Vehicle → Car, dynamic). With grippy tyres it parks like the kinematic car (4/4, the yaw rate within 0.2 % of v tanδ / L); on the slippery floor it understeers in every turn, its yaw rate 4 % below v tanδ / L on average, and still parks all four, reverse legs included. The Sideslip arrow shows the centre of mass sliding, up to 19° at full lock even with grippy tyres, as for the kinematic car.',
        b: [
          ['Grippy tyres', {set: {veh: 'dyn', mass: 10, Iz: 0.9, lf: 0.27, Cf: 500, Cr: 700, mu: 0.9}, tab: 'veh', layers: {slip: true}}],
          ['Slippery floor', {set: {veh: 'dyn', mass: 10, Iz: 0.9, lf: 0.27, Cf: 40, Cr: 90, mu: 0.25}, tab: 'veh', layers: {slip: true}}]
        ]
      }
    ],
    shapes: PARKING,
    beacons: [
      [0.45, 4],
      [0.45, 12],
      [12, 0.45],
      [12, 15.55],
      [23.55, 4],
      [23.55, 12],
      [3.85, 9.6],
      [20.15, 9.6],
      [3.8, 15.55],
      [20.2, 15.55],
      [9, 4.98],
      [17, 4.98]
    ],
    peds: [
      {a: [0.8, 10.2], b: [3.3, 10.2], v: 0.5, s0: 0.15, dw: 3},
      {a: [14.8, 11.2], b: [14.8, 14.3], v: 0.5, s0: 0.18, dw: 2},
      {a: [4.5, 6.6], b: [19, 6.6], v: 0.7, s0: 0.95, dw: 1},
      {a: [11, 1.5], b: [11, 7.7], v: 0.5, s0: 0.48, dw: 2}
    ],
    cars: [
      {
        loop: [
          [3, 12.4],
          [21, 12.4],
          [21, 6.6],
          [3, 6.6]
        ],
        v: 0.6,
        s0: 0.55
      }
    ],
    start: [2, 4, Math.PI / 2],
    wps: [
      [10.5, 15.3, -Math.PI / 2],
      [15.5, 8.35, Math.PI / 2],
      [5.8, 0.68, 0],
      [2, 13]
    ],
    cfg: {
      model: 'car',
      loc: 'truth',
      per: 'oracle',
      mis: 'sequential',
      plan: 'hybrid',
      ctl: 'rwf',
      odoK: 0,
      odoB: 0,
      accel: false,
      lag: 0,
      assoc: 'known',
      clutter: 0,
      replan: 0,
      vcruise: 0.6,
      ppL0: 0.4,
      ppK: 0.3,
      agents: 'lidar',
      spd: 'st'
    },
    layers: {cost: false}
  },
  {
    id: 'L7',
    name: 'Moose test',
    adds: "Speed. The car with tyre slip, on the slippery floor, enters a two-lane road at 3.5 m/s, above its characteristic speed of 2.6 m/s. A box blocks the right lane, a second one the left lane 7 m on: swerve left, then back (a slalom like the moose test). The map is known and the plan is fixed; what decides the run is whether the controller's model knows the tyres. The MPC starts with the kinematic model.",
    tries: [
      {
        t: '<b>Control:</b> the kinematic MPC drives into the first box. It starts the swerve at 1.35 s and steers up to 15°, expecting <i>v</i> tan δ / <i>L</i> of yaw rate, and gets about a third of it: 0.65 m right of its path at 2.4 s, it hits the box. Tick Tyre model in the prediction: the MPC knows the car turns at 40 % of what its wheels point, so it starts at 0.8 s, steers up to 21°, and passes both boxes, 0.40 m off the path at worst. The plots show the yaw rate <i>r</i> against <i>v</i> tan δ / <i>L</i>, and the cross-track error.',
        b: [
          ['Kinematic MPC', {layers: {slip: true}, tab: 'ctl', panes: [['yawr', 'yawk'], ['cte']]}],
          ['Tyre model in the MPC', {set: {mpcDyn: true}, layers: {slip: true}, tab: 'ctl', panes: [['yawr', 'yawk'], ['cte']]}]
        ]
      },
      {
        t: '<b>Vehicle:</b> the car the kinematic model describes. The same MPC, plan and speed get through with at most 11° of steering and 0.18 m of cross-track error.',
        b: [['Kinematic car', {set: {veh: 'car'}, layers: {slip: true}, tab: 'veh', plot: 'cte'}]]
      },
      {
        t: "<b>Control:</b> entry speed. At 2.5 m/s, just below <i>v</i><sub>ch</sub>, the kinematic MPC gets through, but 0.98 m off its path on the way back and with an off-path replan; with the tyre model the MPC takes 4 m/s, the car's top speed, 0.47 m off at worst.",
        b: [
          ['2.5 m/s, kinematic MPC', {set: {vcruise: 2.5}, layers: {slip: true}, tab: 'ctl', plot: 'cte'}],
          ['4 m/s, tyre model', {set: {vcruise: 4, mpcDyn: true}, layers: {slip: true}, tab: 'ctl', plot: 'cte'}]
        ]
      },
      {
        t: '<b>Vehicle:</b> grippy tyres (characteristic speed 11.5 m/s). At 4 m/s the car turns at 89 % of <i>v</i> tan δ / <i>L</i>, nearly kinematic, and the kinematic MPC passes, 0.24 m off at worst.',
        b: [['Grippy, 4 m/s', {set: {Cf: 500, Cr: 700, mu: 0.9, vcruise: 4}, layers: {slip: true}, tab: 'veh', plot: 'cte'}]]
      },
      {
        t: '<b>Control:</b> the path trackers at 3.5 m/s. Pure pursuit and rear-wheel feedback hit the first box, as the kinematic MPC does. Stanley gets through, but 0.98 m off its path, with the steering at its lock and an off-path replan.',
        b: [
          ['Pure pursuit', {set: {ctl: 'pp'}, layers: {slip: true}, tab: 'ctl', plot: 'cte'}],
          ['Rear-wheel feedback', {set: {ctl: 'rwf'}, layers: {slip: true}, tab: 'ctl', plot: 'cte'}],
          ['Stanley', {set: {ctl: 'stanley'}, layers: {slip: true}, tab: 'ctl', plot: 'cte'}]
        ]
      }
    ],
    shapes: MOOSE,
    beacons: [
      [4, 6.45],
      [12, 6.45],
      [20, 6.45],
      [6, 9.55],
      [14, 9.55],
      [22, 9.55]
    ],
    peds: [],
    start: [1.2, 7.2, 0],
    wps: [[22.5, 7.2, 0]],
    cfg: {
      model: 'car',
      carPhys: 'dyn',
      mass: 10,
      Iz: 0.9,
      lf: 0.27,
      Cf: 40,
      Cr: 90,
      mu: 0.25,
      loc: 'truth',
      per: 'oracle',
      mis: 'sequential',
      plan: 'hybrid',
      revOK: false,
      ctl: 'mpc',
      odoK: 0,
      odoB: 0,
      accel: true,
      amax: 3,
      lag: 0,
      assoc: 'known',
      clutter: 0,
      replan: 0,
      vcruise: 3.5,
      vmax: 4,
      alat: 8,
      agents: 'off',
      spd: 'none'
    },
    layers: {cost: false}
  }
];

/* ---- core/params.js ---- */
/* ============================================================
   Parameters
   ============================================================ */
const DEFAULTS = {
  loc: 'truth',
  assoc: 'known',
  npart: 400,
  inject: true,
  pfLidar: true,
  filtK: 1,
  per: 'oracle',
  unknownAs: 'free',
  infl: 0.6,
  mis: 'sequential',
  exploreMin: 6, // frontier exploration: a frontier counts from this many cells
  replan: 0,
  lostGuard: false,
  rwKth: 3.0,
  rwKe: 6.0,
  latency: 0,
  biasDeg: 0,
  biasW: 0,
  mpcMode: 'nmpc',
  mpcNp: 20,
  mpcNc: 10,
  mpcDt: 0.1,
  mpcIt: 3,
  mpcQlat: 20,
  mpcQlon: 4,
  mpcQth: 6,
  mpcQv: 2,
  mpcQf: 5,
  mpcRa: 0.3,
  mpcRs: 0.3,
  mpcRd: 1.0,
  mpcRho: 200,
  mpcObs: true,
  mpcMarg: 0.1,
  mpcLag: false,
  mpcDyn: false,
  planPct: 85,
  model: 'diff',
  carPhys: 'kin',
  mass: 10,
  Iz: 0.9,
  lf: 0.27,
  Cf: 500,
  Cr: 700,
  mu: 0.9,
  gyro: false,
  gyroSig: 0.3, // yaw-rate gyro noise σ per reading [°/s]
  gyroBias: 0, // the gyro's bias the filter is not told [°/s]
  zupt: false, // estimate the gyro bias while standing still (zero-velocity update) and subtract it
  wheelbase: 0.6,
  steerMaxDeg: 32,
  steerRate: 1.5,
  revOK: true,
  revPen: 2.0,
  gearPen: 2.0,
  hybH: 'both',
  stanK: 2.0,
  plan: 'astar',
  eps: 1,
  smooth: true,
  rrtIt: 1500,
  ctl: 'pp',
  vcruise: 0.8,
  ppL0: 0.5,
  ppK: 0.5,
  alat: 0.6,
  kp: 2.0,
  ki: 0,
  kd: 0.15,
  dwaG: 1.0,
  dwaO: 0.6,
  dwaV: 0.4,
  dwaT: 1.6,
  vmax: 1.0,
  wmax: 1.8,
  accel: false,
  amax: 0.8,
  alpha: 3.0,
  lag: 0,
  odoK: 0,
  odoB: 0,
  lmK: 1,
  lmRange: 7,
  clutter: 0,
  bOff: '',
  bOut: 0,
  bOutLen: 1,
  lidarSig: 0.02,
  seed: 7,
  agents: 'off',
  agPred: 'cv',
  agT: 4,
  agGrow: 0.1,
  agSigA: 0.8,
  spd: 'none',
  stMarg: 0.3,
  agPlan: true,
  people: 'scripted',
  sensLat: 0,
  vehicles: true,
  guard: false
};
const P = {...DEFAULTS};
// The values a choice parameter can take; setParam ignores anything else (a mistyped setup link, a wrong Try cfg).
// The UI's option lists (ui/schema.js) are views on these, narrowed by the vehicle where it matters.
const PARAM_OPTS = {
  loc: ['truth', 'dr', 'ekf', 'pf', 'slam', 'custom'],
  assoc: ['known', 'unknown'],
  per: ['oracle', 'mapping'],
  unknownAs: ['free', 'lethal'],
  agents: ['off', 'truth', 'lidar'],
  agPred: ['cv', 'static', 'custom'],
  mis: ['sequential', 'greedy', 'optimal', 'explore'],
  plan: ['straight', 'astar', 'rrtstar', 'stastar', 'rs', 'hybrid', 'custom'],
  hybH: ['both', '2d'],
  ctl: ['pp', 'rwf', 'stanley', 'pid', 'dwa', 'mpc', 'custom'],
  spd: ['none', 'stop', 'st'],
  mpcMode: ['nmpc', 'ltv'],
  model: ['diff', 'car'],
  carPhys: ['kin', 'dyn'],
  people: ['scripted', 'reactive']
};

// The Vehicle tab's one row (unicycle · car, kinematic · car, dynamic) is a view over model and carPhys, not a parameter of its own
const vehOf = (m, c) => (m !== 'car' ? 'diff' : c === 'dyn' ? 'dyn' : 'car');
Object.defineProperty(P, 'veh', {
  get() {
    return vehOf(P.model, P.carPhys);
  },
  set(v) {
    P.model = v === 'diff' ? 'diff' : 'car';
    if (v !== 'diff') P.carPhys = v === 'dyn' ? 'dyn' : 'kin';
  },
  enumerable: false
});
// Tyre presets for the car with tyre slip (lab car: L 0.6 m, m 10 kg). Grippy: realistic, kinematic-like below 2 m/s.
// Slippery floor: soft tyres, v_ch ≈ 2.6 m/s and μg ≈ 2.5 m/s², reached on 1–2 m turns at lab speeds.
const DYN_PRESETS = {
  grippy: {mass: 10, Iz: 0.9, lf: 0.27, Cf: 500, Cr: 700, mu: 0.9},
  slippery: {mass: 10, Iz: 0.9, lf: 0.27, Cf: 40, Cr: 90, mu: 0.25}
};
const LAYERS = {
  ghost: true,
  cost: false,
  search: true,
  lidar: true,
  beam: true,
  belief: true,
  trail: true,
  dwa: true,
  agents: true,
  ghostrun: true,
  sweep: true,
  frontier: true
};

/* ---- core/record.js ---- */
/* ============================================================
   Recording: frames for replay, and the ghost of the previous run
   ============================================================ */
const REC = {frames: [], max: 3000, every: 2, on: true}; // 10 Hz frames, up to 5 minutes
let GHOST = null; // {level, label, trailT, plot} kept from the previous run on this level
function recFrame() {
  if (!REC.on || S.tick % REC.every) return;
  const sp = S.scanPts,
    sc = new Float32Array(sp.length * 2);
  for (let i = 0; i < sp.length; i++) {
    sc[2 * i] = sp[i][0];
    sc[2 * i + 1] = sp[i][1];
  }
  const A = S.agents;
  REC.frames.push({
    t: S.t,
    tick: S.tick,
    robot: {...S.robot},
    est: {...S.est},
    Pc: S.Pc ? S.Pc.slice() : null,
    cmd: {...S.cmd},
    peds: S.peds.map(p => ({x: p.x, y: p.y, vx: p.vx || 0, vy: p.vy || 0, r: p.r, wait: p.wait || 0})),
    scan: sc,
    lastZ: S.lastZ,
    bDown: S.bDown ? S.bDown.slice() : null,
    nT: S.trailT.length,
    nE: S.trailE.length,
    plan: S.plan,
    segIdx: S.segIdx,
    track: S.track,
    ctlViz: S.ctlViz,
    search: S.search,
    fsm: {state: S.fsm.state, queue: S.fsm.queue.slice()},
    done: WPS.map(w => [w.done, w.skipped]),
    agents: A ? {tracks: A.tracks.map(t => ({...t})), egoPath: A.egoPath, st: A.st, det: [], dynPts: [], staticPts: null} : null,
    coll: S.coll,
    collPed: S.collPed,
    // scalar diagnostics for the plot dock's signals (UI only; nothing in the simulation reads them)
    sig: {
      explored: P.per === 'mapping' ? exploredFrac() : null,
      mpcMs: S.mpcStats ? S.mpcStats.ms : null,
      mpcIt: S.mpcStats ? S.mpcStats.it : null,
      mpcJ: S.mpcStats ? S.mpcStats.J : null,
      nees: S.nees.length ? S.nees[S.nees.length - 1] : null,
      neff: S.pf ? S.pf.neff : null,
      minPed: isFinite(S.minPed) ? S.minPed : null,
      rejected: S.rejected,
      dist: S.dist,
      fsm: S.fsm.state,
      dyn: isDyn() ? dynSig(S.robot) : null
    }
  });
  if (REC.frames.length > REC.max) REC.frames.splice(0, REC.frames.length - REC.max);
}
// A frame as a view over the live state: fields the renderer reads come from the frame, everything else falls through
function frameView(f) {
  const v = Object.create(S);
  Object.assign(v, {
    t: f.t,
    tick: f.tick,
    robot: f.robot,
    est: f.est,
    Pc: f.Pc,
    cmd: f.cmd,
    peds: f.peds,
    lastZ: f.lastZ,
    bDown: f.bDown,
    plan: f.plan,
    segIdx: f.segIdx,
    track: f.track,
    ctlViz: f.ctlViz,
    search: f.search,
    agents: f.agents,
    coll: f.coll,
    collPed: f.collPed,
    pf: null,
    fsm: Object.assign(Object.create(S.fsm), f.fsm),
    trailT: S.trailT.slice(0, f.nT),
    trailE: S.trailE.slice(0, f.nE)
  });
  const pts = [];
  for (let i = 0; i < f.scan.length; i += 2) pts.push([f.scan[i], f.scan[i + 1]]);
  v.scanPts = pts;
  return v;
}
function runLabel() {
  const names = {
    pp: 'pure pursuit',
    rwf: 'rear-wheel feedback',
    stanley: 'Stanley',
    pid: 'PID',
    dwa: 'DWA',
    mpc: P.mpcMode === 'ltv' ? 'LTV-MPC' : 'MPC',
    custom: 'your code'
  };
  const d = [];
  for (const k of Object.keys(P)) {
    if (k === 'ctl' || k === 'seed') continue;
    const def = k in (LV.cfg || {}) ? LV.cfg[k] : DEFAULTS[k];
    if (def !== undefined && P[k] !== def) d.push(`${k} ${typeof P[k] === 'boolean' ? (P[k] ? 'on' : 'off') : P[k]}`);
  }
  return `${names[P.ctl] || P.ctl} · seed ${P.seed}${d.length ? ' · ' + d.slice(0, 3).join(', ') + (d.length > 3 ? ' …' : '') : ''}`;
}
function keepGhost() {
  if (S) UI.runEnded(); // the page keeps a copy (runs library); S and the frames are still the finished run's here
  // the level and settings noted while the run was live: a new level or a Try has already replaced LV and P here
  const m = S && UI.runMeta();
  if (S && S.t > 1 && S.trailT.length > 5)
    GHOST = {level: m ? m.level : LV.id, label: m ? m.label : runLabel(), trailT: S.trailT.slice(), plot: S.plot.slice(), t: S.t}; // nulls in trailT: kidnap breaks
  REC.frames = [];
}

/* ---- core/state.js ---- */
/* ============================================================
   Simulation state
   ============================================================ */
let LV = LEVELS[0],
  S = null,
  WPS = [];
let running = false,
  pauseOnContact = false;
// What the simulation core needs from a user interface. The page overrides these; a worker leaves them as no-ops.
const UI = {
  draw() {},
  refresh() {},
  invalidate() {},
  levelChanged() {},
  slotStatus() {},
  runEnded() {},
  runMeta: () => null,
  mode: () => 'sim'
}; // runEnded: the run is about to be cleared (record.js)
const dirty = {occ: true, cost: true, search: true};

function prepLevel(L) {
  if (L.truthOcc) return;
  const occ = new Uint8Array(NC);
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      const x = (i + 0.5) * RES,
        y = (j + 0.5) * RES;
      if (insideAny(x, y, L.shapes)) occ[j * GW + i] = 1;
    }
  L.truthOcc = occ;
  L.truthDist = distanceTransform(occ);
}
function insideAny(x, y, shapes) {
  for (const s of shapes) {
    if (s.t === 'r') {
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
    } else if (hyp(x - s.x, y - s.y) <= s.r) return true;
  }
  return false;
}
function circleHits(x, y, r, shapes) {
  for (const s of shapes) {
    if (s.t === 'r') {
      const cx = clamp(x, s.x, s.x + s.w),
        cy = clamp(y, s.y, s.y + s.h);
      if (hyp(x - cx, y - cy) < r) return true;
    } else if (hyp(x - s.x, y - s.y) < r + s.r) return true;
  }
  return false;
}
function rayCast(ox, oy, dx, dy, maxR, shapes) {
  let best = maxR;
  for (const s of shapes) {
    if (s.t === 'r') {
      let tmin = -Infinity,
        tmax = Infinity;
      if (Math.abs(dx) < 1e-12) {
        if (ox < s.x || ox > s.x + s.w) continue;
      } else {
        let t1 = (s.x - ox) / dx,
          t2 = (s.x + s.w - ox) / dx;
        if (t1 > t2) {
          const q = t1;
          t1 = t2;
          t2 = q;
        }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
      }
      if (Math.abs(dy) < 1e-12) {
        if (oy < s.y || oy > s.y + s.h) continue;
      } else {
        let t1 = (s.y - oy) / dy,
          t2 = (s.y + s.h - oy) / dy;
        if (t1 > t2) {
          const q = t1;
          t1 = t2;
          t2 = q;
        }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
      }
      if (tmin <= tmax && tmin >= 0 && tmin < best) best = tmin;
    } else {
      const fx = ox - s.x,
        fy = oy - s.y,
        b = fx * dx + fy * dy,
        c = fx * fx + fy * fy - s.r * s.r,
        disc = b * b - c;
      if (disc < 0) continue;
      const t = -b - Math.sqrt(disc);
      if (t >= 0 && t < best) best = t;
    }
  }
  return best;
}
function distanceTransform(occ) {
  const d = new Float32Array(NC);
  const INF = 1e9;
  for (let i = 0; i < NC; i++) d[i] = occ[i] ? 0 : INF;
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      const k = j * GW + i;
      let m = d[k];
      if (m === 0) continue;
      if (i > 0) m = Math.min(m, d[k - 1] + 1);
      if (j > 0) {
        m = Math.min(m, d[k - GW] + 1);
        if (i > 0) m = Math.min(m, d[k - GW - 1] + SQ2);
        if (i < GW - 1) m = Math.min(m, d[k - GW + 1] + SQ2);
      }
      d[k] = m;
    }
  for (let j = GH - 1; j >= 0; j--)
    for (let i = GW - 1; i >= 0; i--) {
      const k = j * GW + i;
      let m = d[k];
      if (m === 0) continue;
      if (i < GW - 1) m = Math.min(m, d[k + 1] + 1);
      if (j < GH - 1) {
        m = Math.min(m, d[k + GW] + 1);
        if (i < GW - 1) m = Math.min(m, d[k + GW + 1] + SQ2);
        if (i > 0) m = Math.min(m, d[k + GW - 1] + SQ2);
      }
      d[k] = m;
    }
  for (let i = 0; i < NC; i++) d[i] *= RES;
  return d;
}

function reset() {
  keepGhost();
  prepLevel(LV);
  const st = LV.start;
  S = {
    t: 0,
    tick: 0,
    rngW: makeRng(P.seed * 7919 + 1),
    rngA: makeRng(P.seed * 104729 + 3),
    rngB: makeRng(P.seed * 7907 + 11),
    bDown: null,
    shapes: LV.shapes,
    peds: LV.peds.map(p => ({...p, s: p.s0 || 0, dir: 1, x: p.a[0], y: p.a[1], r: 0.3})),
    beacons: LV.beacons.map((b, i) => ({id: i, x: b[0], y: b[1]})),
    robot: {x: st[0], y: st[1], th: st[2], v: 0, w: 0, d: 0, vy: 0, r: 0, contact: false, pedContact: false},
    cmd: {v: 0, w: 0, steer: 0},
    cmdQ: [],
    odo: {v: 0, w: 0},
    plan: null,
    segIdx: 0,
    mpc: null,
    mpcStats: null,
    est: {x: st[0], y: st[1], th: st[2]},
    Pc: null,
    pf: null,
    lo: new Float32Array(NC),
    cm: {occ: new Uint8Array(NC), dist: null, lethal: new Uint8Array(NC), pen: new Float32Array(NC)},
    scan: null,
    scanPts: [],
    lastZ: [],
    gyroBiasEst: 0, // the zero-velocity update's running estimate of the gyro bias [rad/s]
    fsm: {state: 'IDLE', queue: [], lastPlanT: -99, lastBlockT: 0, prog: {t: 0, x: st[0], y: st[1]}, fails: 0, cost: null},
    track: null,
    pathId: 0,
    search: null,
    planStats: null,
    ctlViz: null,
    ctlState: {I: 0, prev: null},
    log: [],
    coll: 0,
    collPed: 0,
    dist: 0,
    errSq: 0,
    errN: 0,
    cteSq: 0,
    cteN: 0,
    nees: [],
    plot: [],
    trailT: [],
    trailE: [],
    rejected: 0,
    customMark: null,
    agents: agInit(),
    collPedStill: 0,
    minPed: Infinity
  };
  for (const w of WPS) {
    w.done = false;
    w.skipped = false;
  }
  if (P.vehicles !== false) carsInit();
  updatePeds(0);
  initLoc(true);
  buildCostmap();
  dirty.occ = dirty.cost = true;
  logE(`${LV.id} ${LV.name} · seed ${P.seed}`);
  if (WPS.length) {
    startMission();
    doPlan('initial');
  }
  S.locInit = false;
  for (const k in SLOTS) if (SLOTS[k].worker) SLOTS[k].worker.reset();
  UI.refresh();
}

/* ---------- people ---------- */
function updatePeds(dt) {
  if (P.people === 'reactive' && dt > 0) {
    updatePedsReactive(dt);
    updateCars(dt);
    return;
  }
  for (const p of S.peds) {
    if (p.car) continue;
    const L = hyp(p.b[0] - p.a[0], p.b[1] - p.a[1]);
    if (p.dw) {
      if (p.wait > 0) p.wait -= dt;
      else {
        p.s += (p.dir * p.v * dt) / L;
        if (p.s >= 1) {
          p.s = 1;
          p.dir = -1;
          p.wait = p.dw;
        }
        if (p.s <= 0) {
          p.s = 0;
          p.dir = 1;
          p.wait = p.dw;
        }
      }
    } else {
      p.s += (p.dir * p.v * dt) / L;
      if (p.s > 1) {
        p.s = 2 - p.s;
        p.dir = -1;
      }
      if (p.s < 0) {
        p.s = -p.s;
        p.dir = 1;
      }
    }
    p.x = p.a[0] + (p.b[0] - p.a[0]) * p.s;
    p.y = p.a[1] + (p.b[1] - p.a[1]) * p.s;
    const mv = !(p.wait > 0);
    p.vx = mv ? (p.dir * p.v * (p.b[0] - p.a[0])) / L : 0;
    p.vy = mv ? (p.dir * p.v * (p.b[1] - p.a[1])) / L : 0;
  }
  if (dt > 0) updateCars(dt);
}
function pedShapes() {
  return S.peds.flatMap(p => (p.car ? carCircles(p) : [{t: 'c', x: p.x, y: p.y, r: p.r}]));
}
function allShapes() {
  return S.peds.length ? S.shapes.concat(pedShapes()) : S.shapes;
}

/* ---- core/config.js ---- */
/* ============================================================
   Configuration: level loading, parameter changes, kidnapping
   ============================================================ */
function kidnapTo(p) {
  // p = [x, y] or null for a free spot far from the robot
  const r = S.robot;
  let best = null;
  if (!p) {
    for (let i = 0; i < 400; i++) {
      const x = 1 + S.rngA.u() * (W - 2),
        y = 1 + S.rngA.u() * (H - 2),
        k = cellIdx(x, y);
      if (k < 0 || LV.truthDist[k] < 0.8) continue;
      const d = hyp(x - r.x, y - r.y);
      if (d > 6 && (!best || d > best[2])) best = [x, y, d];
      if (best && best[2] > 12) break;
    }
    if (!best) return;
    p = best;
  }
  r.x = p[0];
  r.y = p[1];
  r.v = 0;
  r.w = 0;
  r.d = 0;
  r.vy = 0;
  r.r = 0;
  r.contact = false;
  S.trailT.push(null);
  logE(`Robot kidnapped to (${p[0].toFixed(1)}, ${p[1].toFixed(1)}). The estimate was not told.`, 'bad');
  UI.draw();
  UI.refresh();
}
function loadLevel(i) {
  LV = LEVELS[i];
  Object.assign(P, DEFAULTS, {seed: P.seed}, LV.cfg);
  LAYERS.cost = !!(LV.layers && LV.layers.cost);
  WPS = LV.wps.map(w => ({x: w[0], y: w[1], th: w.length > 2 ? w[2] : null, done: false}));
  running = false;
  reset();
  UI.levelChanged();
  UI.invalidate();
}
// What changing a parameter implies, as an ordered table: [the keys, the effect(k, v, old, live)]. Several keys may
// share one effect; a key may appear in more than one entry (each runs, in this order). `live` is true while a slider
// is still being dragged, so the costly effects (a costmap rebuild, a replan) wait for the release.
const PARAM_EFFECTS = [
  [
    ['loc', 'npart'],
    () => {
      S.locInit = false;
      if (SLOTS.loc.worker) SLOTS.loc.worker.reset();
      initLoc(false);
      logE(
        `Localization → ${{truth: 'ground truth', dr: 'dead reckoning', ekf: 'EKF', pf: 'particle filter', slam: 'EKF-SLAM', custom: 'your code'}[P.loc]}`
      );
    }
  ],
  [
    ['assoc', 'inject', 'filtK'],
    () => {
      S.nees = [];
    }
  ],
  [
    ['agents'],
    (k, v) => {
      S.agents = agInit();
      logE(`Agent tracking → ${{off: 'off', truth: 'ground truth', lidar: 'lidar'}[v]}`);
    }
  ],
  [['spd'], (k, v) => logE(`Response to agents → ${{none: 'ignore', stop: 'reactive stop', st: 'speed planning'}[v]}`)],
  [
    ['gyro', 'zupt'],
    (k, v) => {
      S.gyroBiasEst = 0;
      logE(
        k === 'gyro'
          ? `Yaw-rate gyro → ${v ? 'on: the turn rate comes from the gyro' : 'off: the turn rate comes from the wheels'}`
          : `Zero-velocity bias update → ${v ? 'on' : 'off'}`
      );
    }
  ],
  [
    ['per'],
    (k, v) => {
      if (v === 'mapping') S.lo.fill(0);
      buildCostmap();
      dirty.occ = true;
      logE(`Map source → ${v === 'oracle' ? 'prior map' : 'lidar mapping (empty grid)'}`);
      requestReplan('map source changed');
    }
  ],
  [
    ['unknownAs', 'infl'],
    (k, v, old, live) => {
      if (live) return;
      buildCostmap();
      requestReplan('costmap changed');
    }
  ],
  [
    ['mis'],
    (k, v) => {
      if (S.fsm.state !== 'IDLE' && S.fsm.state !== 'DONE') {
        startMission();
        doPlan('initial');
      } else logE(`Goal order → ${v}`);
    }
  ],
  [['plan', 'smooth'], () => requestReplan('planner changed')],
  [
    ['eps', 'rrtIt'],
    (k, v, old, live) => {
      if (!live) requestReplan('planner changed');
    }
  ],
  [
    ['ctl'],
    (k, v) => {
      S.ctlState = {I: 0, prev: null};
      S.ctlViz = null;
      SLOTS.ctl.lastErr = '';
      if (SLOTS.ctl.worker) SLOTS.ctl.worker.reset();
      logE(
        `Controller → ${{pp: 'pure pursuit', rwf: 'rear-wheel feedback', pid: 'PID', dwa: 'DWA', stanley: 'Stanley', mpc: 'MPC', custom: 'your code'}[v]}`
      );
    }
  ],
  [
    ['agPred'],
    () => {
      if (SLOTS.pred.worker) SLOTS.pred.worker.reset();
    }
  ],
  [
    ['vehicles', 'people'],
    (k, v) => {
      if (k === 'vehicles') {
        S.peds = S.peds.filter(p => !p.car);
        if (v) carsInit();
      }
      logE(k === 'people' ? `People → ${v}` : `Other vehicles → ${v ? 'on' : 'off'}`);
    }
  ],
  [
    ['bOff'],
    () => {
      const n = beaconsOff().size,
        u = beaconUse();
      logE(
        n
          ? `Beacons switched off: ${[...beaconsOff()].join(', ')} (${S.beacons.length - n} of ${S.beacons.length} on)${u ? `; note: ${u}` : ''}`
          : 'All beacons on',
        n && u && P.loc !== 'custom' ? 'warn' : ''
      );
    }
  ],
  [
    ['bOut'],
    (k, v, old, live) => {
      if (!live) logE(v > 0 ? `Random beacon outages: each beacon down ${v} % of the time` : 'Random beacon outages off');
    }
  ],
  [
    ['seed'],
    (k, v, old, live) => {
      if (!live) logE(`Seed ${v} takes effect on Reset`);
    }
  ],
  [
    ['carPhys'],
    (k, v) => {
      S.robot.vy = 0;
      S.robot.r = 0;
      logE(v === 'dyn' ? 'Car → dynamic (tyre slip)' : 'Car → kinematic (no slip)');
    }
  ],
  [
    ['model'],
    (k, v) => {
      S.robot.d = 0;
      S.robot.w = 0;
      S.robot.vy = 0;
      S.robot.r = 0;
      S.cmd = {v: 0, w: 0, steer: 0};
      if (v === 'diff') {
        if (P.plan === 'rs' || P.plan === 'hybrid') P.plan = 'astar';
        if (P.ctl === 'stanley') P.ctl = 'pp';
      } else if (P.plan !== 'rs') P.plan = 'hybrid';
      logE(v === 'car' ? 'Vehicle → car-like (bicycle) · planner → Hybrid A*' : 'Vehicle → unicycle (diff-drive)');
      requestReplan('vehicle model changed');
    }
  ],
  [
    ['wheelbase', 'steerMaxDeg', 'revOK', 'revPen', 'gearPen', 'hybH', 'planPct'],
    (k, v, old, live) => {
      if (!live && (P.plan === 'hybrid' || P.plan === 'rs')) requestReplan('vehicle or planner changed');
    }
  ]
];
// the keys whose effect runs even when the value did not change (a slider released on its old value still rebuilds)
const PARAM_ALWAYS = ['infl', 'eps', 'rrtIt', 'wheelbase', 'steerMaxDeg', 'revPen', 'gearPen', 'planPct'];
// Set one parameter: `veh` fans out to model and carPhys; a choice parameter must be one of its values and a numeric one
// a finite number (a mistyped setup link or Try cfg is ignored with a log line); then the effects table runs.
function setParam(k, v, live) {
  if (k === 'veh') {
    const m = v === 'diff' ? 'diff' : 'car';
    if (m !== P.model) setParam('model', m, live);
    if (m === 'car') setParam('carPhys', v === 'dyn' ? 'dyn' : 'kin', live);
    return;
  }
  if (PARAM_OPTS[k] && !PARAM_OPTS[k].includes(v)) {
    logE(`Ignored: ${k} has no value "${v}" (one of ${PARAM_OPTS[k].join(', ')})`, 'warn');
    return;
  }
  if (typeof DEFAULTS[k] === 'number' && !(typeof v === 'number' && isFinite(v))) {
    logE(`Ignored: ${k} needs a number, not "${v}"`, 'warn');
    return;
  }
  const old = P[k];
  P[k] = v;
  if (k.startsWith('mpc') && S) S.mpc = null;
  if (old === v && !PARAM_ALWAYS.includes(k)) return;
  for (const [keys, fx] of PARAM_EFFECTS) if (keys.includes(k)) fx(k, v, old, live);
  UI.invalidate();
  if (UI.mode() === 'sim') {
    UI.draw();
    UI.refresh();
  }
}
function toggleBeacon(id) {
  const s = beaconsOff();
  if (s.has(id)) s.delete(id);
  else s.add(id);
  setParam('bOff', [...s].sort((a, b) => a - b).join(','), false);
}
function requestReplan(reason) {
  const F = S.fsm;
  if (F.state === 'DRIVE' || F.state === 'NO_PATH' || F.state === 'PLAN') {
    F.state = 'PLAN';
    F.pendingReason = reason;
    if (!running) advanceMission();
  }
}
function advanceMission() {
  missionTick();
  UI.draw();
  UI.refresh();
}

/* ---- core/vehicle.js ---- */
/* ============================================================
   Vehicle: actuator + unicycle integration
   ============================================================ */
function actuate() {
  const r = S.robot,
    c = S.cmd;
  let dyn = null;
  let vt = clamp(c.v, -0.5 * P.vmax, P.vmax),
    wt;
  if (isCar()) {
    // bicycle: command (v, δ) → lag → accel limit → steering-rate limit → ω = v tanδ / L
    const dm = steerMax();
    let st = clamp(c.steer || 0, -dm, dm);
    if (P.lag > 0) {
      const a = 1 - Math.exp(-DT / P.lag);
      vt = r.v + (vt - r.v) * a;
      st = r.d + (st - r.d) * a;
    }
    if (P.accel) vt = clamp(vt, r.v - P.amax * DT, r.v + P.amax * DT);
    r.d = clamp(st, r.d - P.steerRate * DT, r.d + P.steerRate * DT);
    wt = (vt * Math.tan(r.d + ((P.biasDeg || 0) * Math.PI) / 180)) / P.wheelbase; // misalignment: the wheels sit biasDeg off what the encoder reads
    if (isDyn()) {
      r.wk = wt;
      dyn = dynStep(r, vt, r.d + ((P.biasDeg || 0) * Math.PI) / 180);
      wt = dyn.r;
    } // tyre slip: the yaw rate is a state, wt only what the encoders imply
  } else {
    const wa = r.wa ?? r.w; // actuator state (turn rate the motors are trying to produce)
    wt = clamp(c.w, -P.wmax, P.wmax);
    if (P.lag > 0) {
      const a = 1 - Math.exp(-DT / P.lag);
      vt = r.v + (vt - r.v) * a;
      wt = wa + (wt - wa) * a;
    }
    if (P.accel) {
      vt = clamp(vt, r.v - P.amax * DT, r.v + P.amax * DT);
      wt = clamp(wt, wa - P.alpha * DT, wa + P.alpha * DT);
    }
    r.wa = wt;
    wt += P.biasW || 0; // bias: e.g. one weaker motor
  }
  const n = dyn || integ(r.x, r.y, r.th, vt, wt, DT);
  if (bodyHits(n.x, n.y, n.th, S.shapes)) {
    if (!isCar()) r.th = wrap(r.th + wt * DT);
    r.v = 0;
    r.w = isCar() ? 0 : wt;
    if (dyn) {
      r.vy = 0;
      r.r = 0;
    }
    if (!r.contact && Math.abs(vt) > 0.01) {
      S.coll++;
      logE('Collision with static obstacle', 'bad');
      S.halt = true;
    }
    r.contact = true;
  } else {
    S.dist += hyp(n.x - r.x, n.y - r.y);
    r.x = n.x;
    r.y = n.y;
    r.th = n.th;
    r.v = vt;
    r.w = wt;
    if (dyn) {
      r.vy = dyn.vy;
      r.r = dyn.r;
    }
    if (r.contact && !bodyHits(r.x, r.y, r.th, S.shapes, 0.05)) r.contact = false;
  }
  let pc = false;
  if (isCar()) pc = S.peds.length > 0 && carHits(r.x, r.y, r.th, pedShapes());
  else for (const c of pedShapes()) if (hyp(c.x - r.x, c.y - r.y) < RR + c.r) pc = true;
  if (S.peds.length) {
    let g = Infinity;
    for (const p of S.peds) g = Math.min(g, bodyGap(r, p));
    if (g < S.minPed) S.minPed = g;
  }
  if (pc && !r.pedContact) {
    S.collPed++;
    const still = Math.abs(r.v) < 0.05;
    if (still) S.collPedStill = (S.collPedStill || 0) + 1;
    logE(still ? 'A person walked into the stopped robot' : 'Contact with a person', 'bad');
    S.halt = true;
  }
  r.pedContact = pc;
}

/* ---------- car with tyre slip: the dynamic bicycle model (chapter 1 §4) ----------
   States at the centre of mass: lateral velocity v_y and yaw rate r; the forward speed v_x comes from the
   longitudinal chain above. Slip angles α_f = tanδ − (v_y + l_f r)/v_x, α_r = −(v_y − l_r r)/v_x (chapter 1's
   small-angle model with tanδ for δ, so that stiff tyres give exactly the kinematic r = v tanδ / L; sign-flipped in
   reverse, so the tyres always oppose sliding), linear tyres F = C·α clipped at μ·F_z with static loads. Passing
   through standstill (v_x changes sign within a tick when there are no acceleration limits) starts from v_y = r = 0. Below |v_x| 0.3 m/s the slip angles lose meaning (they divide by v_x), so the state blends to the kinematic
   one (r = v tanδ / L, v_y = l_r r), fully kinematic below 0.15 m/s. The yaw mode is fast (time constants of a few ms
   at low speed with grippy tyres), so one tick is DYN_SUB substeps of a 2-stage Rosenbrock method (ROS2: second order,
   L-stable, so stiff tyres converge to the kinematic car instead of blowing up). The pose stays at the rear axle,
   whose body-frame velocity is (v_x, v_y − l_r r); each substep moves it with the new velocities (semi-implicit). */
const DYN_SUB = 20,
  GRAV = 9.81,
  ROS_G = 1 + Math.SQRT1_2;
function dynGeom() {
  const L = P.wheelbase,
    lf = clamp(P.lf, 0.05 * L, 0.95 * L);
  return {L, lf, lr: L - lf, m: P.mass, Iz: P.Iz};
}
// Steady-state quantities for the UI and the analysis: understeer gradient, characteristic speed, friction limit
function dynInfo() {
  const {L, lf, lr, m} = dynGeom(),
    K = (m / L) * (lr / P.Cf - lf / P.Cr);
  return {K, vch: K > 0 ? Math.sqrt(L / K) : null, vcrit: K < 0 ? Math.sqrt(-L / K) : null, aMax: P.mu * GRAV, L, lf, lr};
}
// The linear model about straight driving at speed vx: [v̇_y, ṙ] = A [v_y, r] + B tanδ (chapter 1 §4; Analyze uses it)
function dynLin(vx) {
  const {L, lf, lr, m, Iz} = dynGeom(),
    Cf = P.Cf,
    Cr = P.Cr,
    u = Math.max(Math.abs(vx), 1e-3),
    sg = vx < 0 ? -1 : 1;
  return {
    A: [
      [-(Cf + Cr) / (m * u), -vx - (lf * Cf - lr * Cr) / (m * u)],
      [-(lf * Cf - lr * Cr) / (Iz * u), -(lf * lf * Cf + lr * lr * Cr) / (Iz * u)]
    ],
    B: [(sg * Cf) / m, (sg * lf * Cf) / Iz]
  };
}
// Its yaw mode in words: natural frequency and damping, or two time constants
function dynModes(vx) {
  const {A} = dynLin(vx),
    tr = A[0][0] + A[1][1],
    det = A[0][0] * A[1][1] - A[0][1] * A[1][0],
    disc = (tr * tr) / 4 - det;
  if (det <= 0) return {unstable: true, text: 'unstable (one eigenvalue is positive)'};
  if (disc < 0) {
    const wn = Math.sqrt(det),
      z = -tr / 2 / wn;
    return {wn, z, text: `ω_n ${wn.toFixed(1)} rad/s, ζ ${z.toFixed(2)}`};
  }
  const l1 = tr / 2 + Math.sqrt(disc),
    l2 = tr / 2 - Math.sqrt(disc);
  return {tau: [-1 / l1, -1 / l2], text: `time constants ${(-1000 / l1).toFixed(0)} and ${(-1000 / l2).toFixed(0)} ms`};
}
// Lateral dynamics at forward speed vx and wheel angle de: o = [v̇_y, ṙ]; also returns slip angles and forces in T
function dynF(vy, yr, vx, de, G, o, T) {
  const sg = vx < 0 ? -1 : 1,
    af = sg * (G.td - (vy + G.lf * yr) / vx),
    ar = (-sg * (vy - G.lr * yr)) / vx;
  const Ff = clamp(P.Cf * af, -G.ff, G.ff),
    Fr = clamp(P.Cr * ar, -G.fr, G.fr),
    Fc = Ff * Math.cos(de);
  o[0] = (Fc + Fr) / G.m - vx * yr;
  o[1] = (G.lf * Fc - G.lr * Fr) / G.Iz;
  if (T) {
    T.af = af;
    T.ar = ar;
    T.Ff = Ff;
    T.Fr = Fr;
  }
  return o;
}
function dynStep(r, vx, de) {
  const G = dynGeom();
  G.ff = (P.mu * G.m * GRAV * G.lr) / G.L;
  G.fr = (P.mu * G.m * GRAV * G.lf) / G.L;
  G.td = Math.tan(de);
  const h = DT / DYN_SUB,
    rk = (vx * G.td) / G.L,
    yk = G.lr * rk,
    wB = clamp((Math.abs(vx) - 0.15) / 0.15, 0, 1);
  let vy = r.vy || 0,
    yr = r.r || 0,
    x = r.x,
    y = r.y,
    th = r.th;
  if (vx * r.v < 0) {
    vy = 0;
    yr = 0;
  }
  const f0 = [0, 0],
    f1 = [0, 0],
    fa = [0, 0],
    fb = [0, 0];
  for (let i = 0; i < DYN_SUB; i++) {
    if (wB > 0) {
      dynF(vy, yr, vx, de, G, f0);
      // Jacobian by differences, then M = I − γhJ and its inverse (2×2)
      const e1 = 1e-6 * (1 + Math.abs(vy)),
        e2 = 1e-6 * (1 + Math.abs(yr));
      dynF(vy + e1, yr, vx, de, G, fa);
      dynF(vy, yr + e2, vx, de, G, fb);
      const gh = ROS_G * h,
        m11 = 1 - (gh * (fa[0] - f0[0])) / e1,
        m12 = (-gh * (fb[0] - f0[0])) / e2,
        m21 = (-gh * (fa[1] - f0[1])) / e1,
        m22 = 1 - (gh * (fb[1] - f0[1])) / e2,
        dt = m11 * m22 - m12 * m21;
      const sol = (a, b) => [(m22 * a - m12 * b) / dt, (m11 * b - m21 * a) / dt];
      const k1 = sol(f0[0], f0[1]);
      dynF(vy + h * k1[0], yr + h * k1[1], vx, de, G, f1);
      const k2 = sol(f1[0] - 2 * k1[0], f1[1] - 2 * k1[1]);
      vy += h * (1.5 * k1[0] + 0.5 * k2[0]);
      yr += h * (1.5 * k1[1] + 0.5 * k2[1]);
      if (wB < 1) {
        vy = wB * vy + (1 - wB) * yk;
        yr = wB * yr + (1 - wB) * rk;
      }
    } else {
      vy = yk;
      yr = rk;
    }
    const n = integ(x, y, th, vx, yr, h),
      ly = (vy - G.lr * yr) * h,
      tm = th + 0.5 * yr * h; // arc of the rear axle plus its sideways slide
    x = n.x - ly * Math.sin(tm);
    y = n.y + ly * Math.cos(tm);
    th = n.th;
  }
  return {x, y, th, vy, r: yr};
}
// Slip state of the current motion (UI signals): slip angles, sideslip at the CoM, lateral acceleration
function dynSlip(rb) {
  const G = dynGeom();
  G.ff = (P.mu * G.m * GRAV * G.lr) / G.L;
  G.fr = (P.mu * G.m * GRAV * G.lf) / G.L;
  const vx = rb.v,
    de = (rb.d || 0) + ((P.biasDeg || 0) * Math.PI) / 180,
    T = {},
    o = [0, 0];
  if (Math.abs(vx) < 0.05) return {af: 0, ar: 0, beta: 0, ay: 0, Ff: 0, Fr: 0};
  G.td = Math.tan(de);
  dynF(rb.vy || 0, rb.r || 0, vx, de, G, o, T);
  return {af: T.af, ar: T.ar, beta: Math.atan2(rb.vy || 0, Math.abs(vx)), ay: (T.Ff * Math.cos(de) + T.Fr) / G.m, Ff: T.Ff, Fr: T.Fr};
}

// The slip state for the plots and the health light, in display units (recorded in each replay frame's sig.dyn)
function dynSig(rb) {
  const q = dynSlip(rb);
  return {beta: deg(q.beta), r: rb.r || 0, rk: rb.wk != null ? rb.wk : 0, ay: q.ay, mug: P.mu * GRAV, af: deg(q.af), ar: deg(q.ar)};
}

/* ---------- odometry model ---------- */
const sigV = (v, w, k) => k * (0.1 * Math.abs(v) + 0.02);
const sigW = (v, w, k) => k * (0.2 * Math.abs(w) + 0.1 * Math.abs(v) + 0.02);
const gyroSig = () => (P.gyroSig * Math.PI) / 180,
  gyroBias = () => (P.gyroBias * Math.PI) / 180;
function odometry() {
  const r = S.robot,
    g = S.rngW,
    k = P.odoK;
  // the car with tyre slip measures ω from the wheels and the steering encoder (v tanδ / L), so slip is odometry error;
  // a yaw-rate gyro (P.gyro) reports the true yaw rate instead, for every vehicle, with its own noise and bias and
  // none of the wheels' turn-rate bias; standing still, the zero-velocity update averages the reading into a bias
  // estimate that is subtracted from then on (what a real IMU driver does at every stop)
  const w = isDyn() && !P.gyro && r.wk != null ? r.wk : r.w;
  const vb = r.v * (1 + 0.02 * P.odoB),
    vo = vb + sigV(r.v, w, k) * g.n(); // the speed's draw first, then the turn rate's: the random sequence of every run before the gyro
  let wo;
  if (P.gyro) {
    wo = w + gyroBias() + gyroSig() * g.n();
    if (P.zupt) {
      if (Math.abs(r.v) < 0.01 && Math.abs(S.cmd.w || 0) < 1e-6 && Math.abs(r.w) < 1e-4) S.gyroBiasEst += 0.1 * (wo - S.gyroBiasEst); // settles within a 2 s hold (40 readings), noise averaged about 4× down
      wo -= S.gyroBiasEst;
    }
  } else wo = w + 0.01 * P.odoB * r.v + sigW(r.v, w, k) * g.n();
  S.odo = {v: vo, w: wo};
}
// the filter's assumed turn-rate noise: the gyro's σ (scaled by the assumed-noise slider) when the gyro is on
const filtSigW = (v, w) => (P.gyro ? P.filtK * gyroSig() : sigW(v, w, assumedK()));
const assumedK = () => P.filtK * Math.max(P.odoK, 0.25);
// odometry error when driving straight at v, for the UI and notes: random σ per reading and the fixed bias (as in odometry())
const odoErr = v => ({sv: sigV(v, 0, P.odoK), sw: sigW(v, 0, P.odoK), bv: 0.02 * P.odoB * v, bw: 0.01 * P.odoB * v});
const sigR = () => 0.08 * Math.max(P.lmK, 0.25),
  sigB = () => 0.03 * Math.max(P.lmK, 0.25);

/* ---- core/sensors.js ---- */
/* ============================================================
   Sensors
   ============================================================ */
function lidarSense() {
  const r = S.robot,
    g = S.rngW,
    sh = allShapes();
  const ranges = new Float32Array(NBEAM);
  for (let k = 0; k < NBEAM; k++) {
    const a = r.th - Math.PI + (k * TAU) / NBEAM;
    let d = rayCast(r.x, r.y, Math.cos(a), Math.sin(a), LMAX, sh);
    if (d < LMAX) d = Math.max(0.05, d + P.lidarSig * g.n());
    ranges[k] = d;
  }
  return ranges;
}
// Beacon availability: switched off by the user (P.bOff, comma-separated IDs) or down in a random outage.
// Each beacon is a two-state Markov chain stepped at every beacon scan: an outage lasts bOutLen s on average
// and a beacon is down bOut % of the time. Outages draw from their own stream, so the sensor noise is unchanged.
function beaconsOff() {
  return new Set(
    String(P.bOff || '')
      .split(',')
      .filter(s => s.trim() !== '')
      .map(Number)
  );
}
// How the active estimator depends on the beacons, in words (null: it needs them)
function beaconUse() {
  if (P.loc === 'truth') return 'ground truth localization ignores the beacons (the estimate is the true pose)';
  if (P.loc === 'dr') return 'dead reckoning never uses the beacons (odometry only)';
  if (P.loc === 'pf' && P.pfLidar && P.per === 'oracle')
    return 'the particle filter also matches lidar against the prior map, so it can localize without beacons';
  if (P.loc === 'custom') return 'your localizer gets the beacon readings that remain';
  return null;
}
function beaconDown(id) {
  return beaconsOff().has(id) || !!(S.bDown && S.bDown[id]);
}
function beaconOutages() {
  const n = S.beacons.length;
  if (!S.bDown) S.bDown = new Array(n).fill(false);
  const f = clamp((P.bOut || 0) / 100, 0, 0.95);
  if (f <= 0) {
    S.bDown.fill(false);
    return;
  }
  const dt = 4 * DT,
    pUp = Math.min(1, dt / Math.max(dt, P.bOutLen || 1)),
    pDown = Math.min(1, (pUp * f) / (1 - f)),
    g = S.rngB;
  for (let i = 0; i < n; i++) S.bDown[i] = S.bDown[i] ? g.u() >= pUp : g.u() < pDown;
}
function senseBeacons() {
  const r = S.robot,
    g = S.rngW,
    sh = allShapes(),
    out = [];
  const sr = 0.08 * P.lmK,
    sb = 0.03 * P.lmK;
  const off = beaconsOff();
  beaconOutages();
  // why each beacon did or did not answer this scan, and when it last answered (for the UI; nothing reads it back)
  if (!S.bWhy) S.bWhy = [];
  if (!S.bSeen) S.bSeen = S.beacons.map(() => []);
  for (const b of S.beacons) {
    const W = S.bSeen[b.id];
    while (W.length && W[0] < S.t - 5) W.shift();
    if (off.has(b.id) || S.bDown[b.id]) {
      S.bWhy[b.id] = off.has(b.id) ? 'off' : 'outage';
      continue;
    }
    const dx = b.x - r.x,
      dy = b.y - r.y,
      d = hyp(dx, dy);
    if (d > P.lmRange || d < 0.2) {
      S.bWhy[b.id] = 'range';
      continue;
    }
    if (rayCast(r.x, r.y, dx / d, dy / d, d, sh) < d - 0.12) {
      S.bWhy[b.id] = 'blocked';
      continue;
    }
    S.bWhy[b.id] = 'ok';
    W.push(S.t);
    out.push({id: b.id, r: d + sr * g.n(), b: wrap(Math.atan2(dy, dx) - r.th + sb * g.n())});
  }
  if (P.assoc === 'unknown' && P.clutter > 0) {
    for (let k = 0; k < 3; k++)
      if (g.u() < P.clutter / 3) out.push({id: -1, fake: true, r: 0.5 + g.u() * (P.lmRange - 0.5), b: (g.u() * 2 - 1) * Math.PI});
  }
  return out;
}

/* ---- core/localization.js ---- */
/* ============================================================
   Localization: truth / dead reckoning / EKF / particle filter
   ============================================================ */
function initLoc(fromStart) {
  const base = fromStart ? {x: S.robot.x, y: S.robot.y, th: S.robot.th} : {...S.est};
  S.est = {...base};
  S.nees = [];
  if (P.loc === 'dr' || P.loc === 'ekf') S.Pc = [0.01, 0, 0, 0, 0.01, 0, 0, 0, 0.0025];
  else S.Pc = null;
  if (P.loc === 'slam') slamInit();
  else S.slam = null;
  if (P.loc === 'pf') {
    const N = P.npart,
      g = S.rngA;
    S.pf = {
      N,
      x: new Float64Array(N),
      y: new Float64Array(N),
      th: new Float64Array(N),
      lw: new Float64Array(N),
      wslow: 0,
      wfast: 0,
      neff: N,
      inj: 0,
      mB: 1,
      mL: 1
    };
    for (let i = 0; i < N; i++) {
      S.pf.x[i] = base.x + 0.1 * g.n();
      S.pf.y[i] = base.y + 0.1 * g.n();
      S.pf.th[i] = wrap(base.th + 0.05 * g.n());
    }
    pfEstimate();
  } else S.pf = null;
}
function m3mul(A, B) {
  const C = new Array(9);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      C[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
    }
  return C;
}
const m3T = A => [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];
function m3inv(A) {
  const [a, b, c, d, e, f, g, h, i] = A;
  const C0 = e * i - f * h,
    C1 = -(d * i - f * g),
    C2 = d * h - e * g;
  const det = a * C0 + b * C1 + c * C2;
  if (Math.abs(det) < 1e-18) return null;
  return [
    C0 / det,
    -(b * i - c * h) / det,
    (b * f - c * e) / det,
    C1 / det,
    (a * i - c * g) / det,
    -(a * f - c * d) / det,
    C2 / det,
    -(a * h - b * g) / det,
    (a * e - b * d) / det
  ];
}
function locPredict() {
  const {v, w} = S.odo;
  if (P.loc === 'truth') return;
  if (P.loc === 'slam') {
    slamPredict(v, w);
    return;
  }
  if (P.loc === 'dr' || P.loc === 'ekf') {
    const e = S.est,
      th = e.th;
    const n = integ(e.x, e.y, th, v, w, DT);
    const G = [1, 0, -v * DT * Math.sin(th), 0, 1, v * DT * Math.cos(th), 0, 0, 1];
    const k = assumedK(),
      sv = sigV(v, w, k),
      sw = filtSigW(v, w);
    const c = Math.cos(th),
      s = Math.sin(th),
      a = DT * DT * sv * sv,
      b = DT * DT * sw * sw;
    const VMV = [a * c * c, a * c * s, 0, a * c * s, a * s * s, 0, 0, 0, b];
    const Pn = m3mul(m3mul(G, S.Pc), m3T(G));
    for (let i = 0; i < 9; i++) Pn[i] += VMV[i];
    S.Pc = Pn;
    S.est = n;
    return;
  }
  if (P.loc === 'pf') {
    const f = S.pf,
      g = S.rngA,
      k = assumedK();
    const sv = Math.max(sigV(v, w, k), 0.02),
      sw = Math.max(filtSigW(v, w), 0.02);
    for (let i = 0; i < f.N; i++) {
      const n = integ(f.x[i], f.y[i], f.th[i], v + sv * g.n(), w + sw * g.n(), DT);
      f.x[i] = n.x;
      f.y[i] = n.y;
      f.th[i] = n.th;
    }
    const mv = Math.abs(v) * DT + 0.5 * Math.abs(w) * DT;
    f.mB += mv;
    f.mL += mv;
    pfEstimate();
  }
}
function ekfUpdate(z) {
  const sr = sigR(),
    sb = sigB();
  for (const m of z) {
    const e = S.est,
      Pc = S.Pc;
    const cand = P.assoc === 'known' && !m.fake ? [S.beacons[m.id]] : P.assoc === 'known' ? [] : S.beacons;
    let best = null;
    for (const lm of cand) {
      const dx = lm.x - e.x,
        dy = lm.y - e.y,
        q = dx * dx + dy * dy,
        r = Math.sqrt(q);
      if (r < 1e-6) continue;
      const H = [-dx / r, -dy / r, 0, dy / q, -dx / q, -1];
      const PH = [
        Pc[0] * H[0] + Pc[1] * H[1] + Pc[2] * H[2],
        Pc[0] * H[3] + Pc[1] * H[4] + Pc[2] * H[5],
        Pc[3] * H[0] + Pc[4] * H[1] + Pc[5] * H[2],
        Pc[3] * H[3] + Pc[4] * H[4] + Pc[5] * H[5],
        Pc[6] * H[0] + Pc[7] * H[1] + Pc[8] * H[2],
        Pc[6] * H[3] + Pc[7] * H[4] + Pc[8] * H[5]
      ]; // 3x2
      const S00 = H[0] * PH[0] + H[1] * PH[2] + H[2] * PH[4] + sr * sr,
        S01 = H[0] * PH[1] + H[1] * PH[3] + H[2] * PH[5],
        S10 = H[3] * PH[0] + H[4] * PH[2] + H[5] * PH[4],
        S11 = H[3] * PH[1] + H[4] * PH[3] + H[5] * PH[5] + sb * sb;
      const det = S00 * S11 - S01 * S10;
      if (Math.abs(det) < 1e-12) continue;
      const Si = [S11 / det, -S01 / det, -S10 / det, S00 / det];
      const nu = [m.r - r, wrap(m.b - (Math.atan2(dy, dx) - e.th))];
      const d2 = nu[0] * (Si[0] * nu[0] + Si[1] * nu[1]) + nu[1] * (Si[2] * nu[0] + Si[3] * nu[1]);
      if (!best || d2 < best.d2) best = {d2, H, PH, Si, nu};
    }
    const gate = P.assoc === 'unknown' ? 9.21 : 1e9;
    if (!best || best.d2 > gate) {
      if (m.fake || P.assoc === 'unknown') S.rejected++;
      continue;
    }
    const {H, PH, Si, nu} = best;
    const K = [
      PH[0] * Si[0] + PH[1] * Si[2],
      PH[0] * Si[1] + PH[1] * Si[3],
      PH[2] * Si[0] + PH[3] * Si[2],
      PH[2] * Si[1] + PH[3] * Si[3],
      PH[4] * Si[0] + PH[5] * Si[2],
      PH[4] * Si[1] + PH[5] * Si[3]
    ];
    S.est = {x: e.x + K[0] * nu[0] + K[1] * nu[1], y: e.y + K[2] * nu[0] + K[3] * nu[1], th: wrap(e.th + K[4] * nu[0] + K[5] * nu[1])};
    // Joseph form: P = (I-KH)P(I-KH)^T + K R K^T
    const IKH = [
      1 - (K[0] * H[0] + K[1] * H[3]),
      -(K[0] * H[1] + K[1] * H[4]),
      -(K[0] * H[2] + K[1] * H[5]),
      -(K[2] * H[0] + K[3] * H[3]),
      1 - (K[2] * H[1] + K[3] * H[4]),
      -(K[2] * H[2] + K[3] * H[5]),
      -(K[4] * H[0] + K[5] * H[3]),
      -(K[4] * H[1] + K[5] * H[4]),
      1 - (K[4] * H[2] + K[5] * H[5])
    ];
    const Pn = m3mul(m3mul(IKH, Pc), m3T(IKH));
    const r2 = sr * sr,
      b2 = sb * sb;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) Pn[i * 3 + j] += K[i * 2] * K[j * 2] * r2 + K[i * 2 + 1] * K[j * 2 + 1] * b2;
    S.Pc = Pn;
  }
}
function pfUpdate(z) {
  const f = S.pf,
    N = f.N;
  if (!z.length || f.mB < 0.05) return;
  f.mB = 0;
  const sr = sigR(),
    sb = sigB(),
    FLOOR = 1e-3;
  let avg = 0;
  for (let i = 0; i < N; i++) {
    let ll = 0;
    for (const m of z) {
      let best = 0;
      const cands = P.assoc === 'known' ? (m.fake ? [] : [S.beacons[m.id]]) : S.beacons;
      for (const lm of cands) {
        const dx = lm.x - f.x[i],
          dy = lm.y - f.y[i];
        const er = (m.r - hyp(dx, dy)) / sr,
          eb = wrap(m.b - (Math.atan2(dy, dx) - f.th[i])) / sb;
        const L = Math.exp(-0.5 * (er * er + eb * eb));
        if (L > best) best = L;
      }
      ll += Math.log(best + FLOOR);
    }
    f.lw[i] += ll;
    avg += Math.exp(ll / z.length);
  }
  avg /= N;
  // augmented MCL: short/long-term likelihood averages
  if (f.wslow === 0) {
    f.wslow = avg;
    f.wfast = avg;
  }
  f.wslow += 0.001 * (avg - f.wslow);
  f.wfast += 0.1 * (avg - f.wfast);
  const pinj = P.inject ? Math.min(0.25, Math.max(0, 1 - f.wfast / f.wslow)) : 0;
  f.inj = pinj;
  pfResample(pinj, z);
}
// Lidar likelihood-field model against the prior map (as in AMCL). 24 of 120 beams, tempered.
function pfLidarUpdate(ranges) {
  const f = S.pf,
    N = f.N,
    D = LV.truthDist,
    SIG = 0.2,
    TEMPER = 0.4;
  if (f.mL < 0.05) return;
  f.mL = 0;
  for (let i = 0; i < N; i++) {
    let ll = 0;
    const x = f.x[i],
      y = f.y[i],
      th = f.th[i];
    for (let k = 0; k < NBEAM; k += 5) {
      const r = ranges[k];
      if (r >= LMAX - 1e-3) continue;
      const a = th - Math.PI + (k * TAU) / NBEAM;
      const idx = cellIdx(x + r * Math.cos(a), y + r * Math.sin(a));
      const d = idx < 0 ? 2 : Math.max(0, D[idx] - 0.05);
      ll += Math.log(0.9 * Math.exp(-0.5 * (d / SIG) ** 2) + 0.05);
    }
    f.lw[i] += TEMPER * ll;
  }
  pfResample(0, null);
}
function pfResample(pinj, z) {
  const f = S.pf,
    N = f.N;
  let mx = -Infinity;
  for (let i = 0; i < N; i++) if (f.lw[i] > mx) mx = f.lw[i];
  let sum = 0;
  const w = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    w[i] = Math.exp(f.lw[i] - mx);
    sum += w[i];
  }
  let s2 = 0;
  for (let i = 0; i < N; i++) {
    w[i] /= sum;
    s2 += w[i] * w[i];
  }
  f.neff = 1 / s2;
  if (f.neff < N / 2 || pinj > 0.01) {
    const g = S.rngA,
      nx = new Float64Array(N),
      ny = new Float64Array(N),
      nt = new Float64Array(N);
    const step = 1 / N;
    let u = g.u() * step,
      c = w[0],
      i = 0;
    for (let m = 0; m < N; m++) {
      const U = u + m * step;
      while (U > c && i < N - 1) {
        i++;
        c += w[i];
      }
      if (pinj > 0 && g.u() < pinj) {
        const q = srlSample(z, g);
        nx[m] = q.x;
        ny[m] = q.y;
        nt[m] = q.th;
      } else {
        nx[m] = f.x[i];
        ny[m] = f.y[i];
        nt[m] = f.th[i];
      }
    }
    f.x = nx;
    f.y = ny;
    f.th = nt;
    f.lw = new Float64Array(N);
  }
  pfEstimate();
}
// Sensor-resetting sample: a pose consistent with one current beacon reading (Lenser & Veloso)
function srlSample(z, g) {
  const real = z.filter(m => P.assoc === 'unknown' || !m.fake);
  for (let t = 0; t < 30 && real.length; t++) {
    const m = real[Math.floor(g.u() * real.length)];
    const lm = P.assoc === 'known' ? S.beacons[m.id] : S.beacons[Math.floor(g.u() * S.beacons.length)];
    const r = m.r + sigR() * g.n(),
      phi = g.u() * TAU,
      x = lm.x - r * Math.cos(phi),
      y = lm.y - r * Math.sin(phi);
    const k = cellIdx(x, y);
    if (k < 0 || LV.truthDist[k] < RR) continue;
    return {x, y, th: wrap(phi - (m.b + sigB() * g.n()))};
  }
  return randomFree(g);
}
function randomFree(g) {
  for (let t = 0; t < 200; t++) {
    const x = 0.3 + g.u() * (W - 0.6),
      y = 0.3 + g.u() * (H - 0.6);
    const k = cellIdx(x, y);
    if (k >= 0 && LV.truthDist[k] > RR + 0.05) return {x, y, th: (g.u() * 2 - 1) * Math.PI};
  }
  return {x: W / 2, y: H / 2, th: 0};
}
function pfEstimate() {
  const f = S.pf,
    N = f.N;
  let mx = -Infinity;
  for (let i = 0; i < N; i++) if (f.lw[i] > mx) mx = f.lw[i];
  let sw = 0,
    sx = 0,
    sy = 0,
    sc = 0,
    ss = 0;
  const w = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    w[i] = Math.exp(f.lw[i] - mx);
    sw += w[i];
  }
  for (let i = 0; i < N; i++) {
    const wi = w[i] / sw;
    w[i] = wi;
    sx += wi * f.x[i];
    sy += wi * f.y[i];
    sc += wi * Math.cos(f.th[i]);
    ss += wi * Math.sin(f.th[i]);
  }
  const th = Math.atan2(ss, sc);
  const C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < N; i++) {
    const d = [f.x[i] - sx, f.y[i] - sy, wrap(f.th[i] - th)];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a * 3 + b] += w[i] * d[a] * d[b];
  }
  for (let a = 0; a < 3; a++) C[a * 4] += 1e-6;
  S.est = {x: sx, y: sy, th};
  S.Pc = C;
}
function scatterParticles() {
  if (P.loc !== 'pf') {
    logE('Scatter needs the particle filter', 'warn');
    return;
  }
  const f = S.pf,
    g = S.rngA;
  for (let i = 0; i < f.N; i++) {
    const q = randomFree(g);
    f.x[i] = q.x;
    f.y[i] = q.y;
    f.th[i] = q.th;
    f.lw[i] = 0;
  }
  f.mB = f.mL = 1;
  pfEstimate();
  logE(`Scattered ${f.N} particles uniformly (global localization)`, 'warn');
  UI.draw();
}

/* ---- core/slam.js ---- */
/* ============================================================
   EKF-SLAM: the beacon positions are unknown and estimated together with the pose.
   State x = [x, y, θ, m1x, m1y, m2x, m2y, …], full covariance. Known IDs give data association;
   unlabeled readings are matched to the mapped beacons by Mahalanobis distance inside the gate.
   ============================================================ */
function slamInit() {
  const e = S.est;
  S.slam = {n: 0, ids: [], x: [e.x, e.y, e.th], P: [0.01, 0, 0, 0, 0.01, 0, 0, 0, 0.0025]};
  S.Pc = [0.01, 0, 0, 0, 0.01, 0, 0, 0, 0.0025];
}
const slamDim = () => 3 + 2 * S.slam.n;
function slamPredict(v, w) {
  const M = S.slam,
    n = slamDim(),
    th = M.x[2],
    nx = integ(M.x[0], M.x[1], th, v, w, DT);
  const k = assumedK(),
    sv = sigV(v, w, k),
    sw = filtSigW(v, w),
    c = Math.cos(th),
    s = Math.sin(th),
    a = DT * DT * sv * sv,
    b = DT * DT * sw * sw;
  const Gx = [1, 0, -v * DT * s, 0, 1, v * DT * c, 0, 0, 1],
    Q = [a * c * c, a * c * s, 0, a * c * s, a * s * s, 0, 0, 0, b];
  // P ← G P Gᵀ + Q on the pose block; cross terms: G P_xm ; map block unchanged
  const P = M.P,
    Pn = P.slice();
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k2 = 0; k2 < 3; k2++) sum += Gx[i * 3 + k2] * P[k2 * n + j];
      Pn[i * n + j] = sum;
    }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k2 = 0; k2 < 3; k2++) sum += Pn[i * n + k2] * Gx[j * 3 + k2];
      P[i * n + j] = sum;
    }
  for (let i = 0; i < n; i++) for (let j = 3; j < n; j++) P[i * n + j] = Pn[i * n + j];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) P[i * n + j] += Q[i * 3 + j];
  M.x[0] = nx.x;
  M.x[1] = nx.y;
  M.x[2] = nx.th;
  slamExport();
}
function slamExport() {
  const M = S.slam,
    n = slamDim();
  S.est = {x: M.x[0], y: M.x[1], th: M.x[2]};
  S.Pc = [M.P[0], M.P[1], M.P[2], M.P[n], M.P[n + 1], M.P[n + 2], M.P[2 * n], M.P[2 * n + 1], M.P[2 * n + 2]];
}
function slamAdd(id, r, b) {
  const M = S.slam,
    n0 = slamDim(),
    n = n0 + 2,
    th = M.x[2],
    a = th + b;
  const mx = M.x[0] + r * Math.cos(a),
    my = M.x[1] + r * Math.sin(a);
  // Jacobians of the inverse observation
  const Jx = [1, 0, -r * Math.sin(a), 0, 1, r * Math.cos(a)],
    Jz = [Math.cos(a), -r * Math.sin(a), Math.sin(a), r * Math.cos(a)];
  const sr = sigR(),
    sb = sigB(),
    R = [sr * sr, 0, 0, sb * sb];
  const Pn = new Array(n * n).fill(0);
  for (let i = 0; i < n0; i++) for (let j = 0; j < n0; j++) Pn[i * n + j] = M.P[i * n0 + j];
  // P_mx = Jx P_xx ; P_mm = Jx P_xx Jxᵀ + Jz R Jzᵀ ; P_m,others = Jx P_x,others
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < n0; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += Jx[i * 3 + k] * M.P[k * n0 + j];
      Pn[(n0 + i) * n + j] = s;
      Pn[j * n + n0 + i] = s;
    }
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += Pn[(n0 + i) * n + k] * Jx[j * 3 + k];
      for (let k = 0; k < 2; k++) s += Jz[i * 2 + k] * R[k * 2 + k] * Jz[j * 2 + k];
      Pn[(n0 + i) * n + n0 + j] = s;
    }
  M.P = Pn;
  M.x.push(mx, my);
  M.ids.push(id);
  M.n++;
}
// EKF-SLAM measurement update: known or unlabeled IDs, Mahalanobis gating, new landmarks appended to the state and covariance.
function slamUpdate(z) {
  const M = S.slam,
    sr = sigR(),
    sb = sigB();
  for (const m of z) {
    const n = slamDim(),
      x = M.x,
      Pm = M.P;
    // candidates: the beacon with this id, or every mapped beacon when unlabeled
    let cands = [];
    if (P.assoc === 'known' && !m.fake) {
      const j = M.ids.indexOf(m.id);
      cands = j >= 0 ? [j] : [];
    } else if (P.assoc === 'unknown') cands = M.ids.map((_, j) => j);
    let best = null;
    for (const j of cands) {
      const k = 3 + 2 * j,
        dx = x[k] - x[0],
        dy = x[k + 1] - x[1],
        q = dx * dx + dy * dy,
        r = Math.sqrt(q);
      if (r < 1e-6) continue;
      const H = new Float64Array(2 * n); // rows: range, bearing; columns: pose (3) and this landmark (2)
      H[0] = -dx / r;
      H[1] = -dy / r;
      H[2] = 0;
      H[k] = dx / r;
      H[k + 1] = dy / r;
      H[n + 0] = dy / q;
      H[n + 1] = -dx / q;
      H[n + 2] = -1;
      H[n + k] = -dy / q;
      H[n + k + 1] = dx / q;
      // S = H P Hᵀ + R using the sparse columns
      const cols = [0, 1, 2, k, k + 1],
        PH = new Float64Array(n * 2);
      for (let i = 0; i < n; i++)
        for (let c = 0; c < 2; c++) {
          let s = 0;
          for (const cc of cols) s += Pm[i * n + cc] * H[c * n + cc];
          PH[i * 2 + c] = s;
        }
      const S00 = (() => {
          let s = 0;
          for (const cc of cols) s += H[cc] * PH[cc * 2];
          return s + sr * sr;
        })(),
        S01 = (() => {
          let s = 0;
          for (const cc of cols) s += H[cc] * PH[cc * 2 + 1];
          return s;
        })(),
        S11 = (() => {
          let s = 0;
          for (const cc of cols) s += H[n + cc] * PH[cc * 2 + 1];
          return s + sb * sb;
        })();
      const det = S00 * S11 - S01 * S01;
      if (Math.abs(det) < 1e-14) continue;
      const Si = [S11 / det, -S01 / det, -S01 / det, S00 / det];
      const nu = [m.r - r, wrap(m.b - (Math.atan2(dy, dx) - x[2]))];
      const d2 = nu[0] * (Si[0] * nu[0] + Si[1] * nu[1]) + nu[1] * (Si[2] * nu[0] + Si[3] * nu[1]);
      if (!best || d2 < best.d2) best = {d2, j, PH, Si, nu, H};
    }
    const gate = P.assoc === 'unknown' ? 9.21 : 1e9;
    if (!best || best.d2 > gate) {
      if (m.fake) {
        S.rejected++;
        continue;
      }
      // unknown beacon: add it to the map (unlabeled: only when it is far from every mapped one)
      if (P.assoc === 'known') slamAdd(m.id, m.r, m.b);
      else if (!best || best.d2 > 40) {
        slamAdd(-1 - M.n, m.r, m.b);
      } else S.rejected++;
      continue;
    }
    const {PH, Si, nu} = best;
    const K = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) {
      K[i * 2] = PH[i * 2] * Si[0] + PH[i * 2 + 1] * Si[2];
      K[i * 2 + 1] = PH[i * 2] * Si[1] + PH[i * 2 + 1] * Si[3];
    }
    for (let i = 0; i < n; i++) x[i] += K[i * 2] * nu[0] + K[i * 2 + 1] * nu[1];
    x[2] = wrap(x[2]);
    // P ← P − K S Kᵀ  (Joseph form is costlier; symmetrize instead)
    const KS = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) {
      KS[i * 2] = K[i * 2] * S00of(best) + K[i * 2 + 1] * S01of(best);
      KS[i * 2 + 1] = K[i * 2] * S01of(best) + K[i * 2 + 1] * S11of(best);
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) Pm[i * n + j] -= KS[i * 2] * K[j * 2] + KS[i * 2 + 1] * K[j * 2 + 1];
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const s = 0.5 * (Pm[i * n + j] + Pm[j * n + i]);
        Pm[i * n + j] = s;
        Pm[j * n + i] = s;
      }
  }
  slamExport();
}
// S (innovation covariance) recovered from its inverse
function S00of(b) {
  const d = b.Si[0] * b.Si[3] - b.Si[1] * b.Si[2];
  return b.Si[3] / d;
}
function S01of(b) {
  const d = b.Si[0] * b.Si[3] - b.Si[1] * b.Si[2];
  return -b.Si[1] / d;
}
function S11of(b) {
  const d = b.Si[0] * b.Si[3] - b.Si[1] * b.Si[2];
  return b.Si[0] / d;
}
function slamLandmarks() {
  const M = S.slam;
  if (!M) return [];
  const n = slamDim(),
    out = [];
  for (let j = 0; j < M.n; j++) {
    const k = 3 + 2 * j;
    out.push({
      id: M.ids[j],
      x: M.x[k],
      y: M.x[k + 1],
      P: [M.P[k * n + k], M.P[k * n + k + 1], 0, M.P[(k + 1) * n + k], M.P[(k + 1) * n + k + 1], 0, 0, 0, 0]
    });
  }
  return out;
}

/* ---- core/perception.js ---- */
/* ============================================================
   Perception: occupancy mapping + costmap
   ============================================================ */
const L_FREE = -0.4,
  L_OCC = 0.85,
  L_CLAMP = 4;
function integrateScan(ranges) {
  const e = S.est,
    lo = S.lo;
  const i0 = cellI(e.x),
    j0 = cellI(e.y);
  for (let k = 0; k < NBEAM; k++) {
    const hit = ranges[k] < LMAX - 1e-3,
      a = e.th - Math.PI + (k * TAU) / NBEAM,
      r = Math.min(ranges[k], LMAX);
    const i1 = cellI(e.x + r * Math.cos(a)),
      j1 = cellI(e.y + r * Math.sin(a));
    let x = i0,
      y = j0;
    const dx = Math.abs(i1 - i0),
      dy = -Math.abs(j1 - j0),
      sx = i0 < i1 ? 1 : -1,
      sy = j0 < j1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 200; guard++) {
      if (x < 0 || y < 0 || x >= GW || y >= GH) break;
      const idx = y * GW + x,
        last = x === i1 && y === j1;
      lo[idx] = clamp(lo[idx] + (last && hit ? L_OCC : L_FREE), -L_CLAMP, L_CLAMP);
      if (last) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }
}
function buildCostmap() {
  const cm = S.cm,
    occ = cm.occ;
  if (P.per === 'oracle') occ.set(LV.truthOcc);
  else {
    const lo = S.lo;
    for (let i = 0; i < NC; i++) {
      const l = lo[i];
      occ[i] = l > 0.5 ? 1 : P.unknownAs === 'lethal' && Math.abs(l) < 0.05 ? 1 : 0;
    }
  }
  cm.dist = distanceTransform(occ);
  const d = cm.dist,
    inf = Math.max(P.infl, 0.01);
  for (let i = 0; i < NC; i++) {
    cm.lethal[i] = d[i] < LETHAL ? 1 : 0;
    const q = (LETHAL + inf - d[i]) / inf;
    cm.pen[i] = d[i] < LETHAL ? 1 : q > 0 ? q * q : 0;
  }
  dirty.cost = true;
}
// Why a goal cell is lethal, for the planners' log line: under the cautious policy, unexplored cells are obstacles,
// so a goal in or next to unseen space is blocked by the unknown, not by anything the lidar saw
function goalBlocked(gx, gy) {
  if (P.per === 'mapping' && P.unknownAs === 'lethal') {
    const i0 = cellI(gx),
      j0 = cellI(gy),
      n = Math.ceil(LETHAL / RES);
    for (let j = j0 - n; j <= j0 + n; j++)
      for (let i = i0 - n; i <= i0 + n; i++) {
        if (i < 0 || j < 0 || i >= GW || j >= GH) continue;
        if (Math.abs(S.lo[j * GW + i]) < 0.05)
          return 'goal is in unexplored space, and unknown space is lethal (Perceive): the robot stays where it can see; Mission → Explore picks goals it can reach';
      }
  }
  return null;
}
function nearestFree(s) {
  const seen = new Uint8Array(NC);
  const q = [s];
  seen[s] = 1;
  for (let h = 0; h < q.length && h < 6000; h++) {
    const u = q[h];
    if (!S.cm.lethal[u]) return u;
    const ui = u % GW,
      uj = (u / GW) | 0;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      const vi = ui + di,
        vj = uj + dj;
      if (vi < 0 || vj < 0 || vi >= GW || vj >= GH) continue;
      const v = vj * GW + vi;
      if (!seen[v]) {
        seen[v] = 1;
        q.push(v);
      }
    }
  }
  return -1;
}
// Segment check against costmap. allowExit: ignore leading samples inside an obstacle region (start pose near a wall).
function segClear(ax, ay, bx, by, margin, allowExit) {
  const L = hyp(bx - ax, by - ay),
    n = Math.max(1, Math.ceil(L / 0.05));
  let exiting = allowExit;
  for (let k = 0; k <= n; k++) {
    const t = k / n,
      idx = cellIdx(ax + (bx - ax) * t, ay + (by - ay) * t);
    if (idx < 0) return false;
    if (S.cm.dist[idx] < margin) {
      if (exiting) continue;
      return false;
    }
    exiting = false;
  }
  return true;
}

/* ---- core/planning.js ---- */
/* ============================================================
   Motion planning: straight line / A* / RRT*
   ============================================================ */
const NB = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQ2],
  [1, -1, SQ2],
  [-1, 1, SQ2],
  [-1, -1, SQ2]
];
function gridSearch(s, g, eps, tr) {
  // tr: an object to receive the expansion order (closedAt, openAt: 1-based step)
  const cm = S.cm,
    gs = new Float32Array(NC).fill(Infinity),
    par = new Int32Array(NC).fill(-1),
    closed = new Uint8Array(NC),
    heap = new Heap();
  const gi = g >= 0 ? g % GW : 0,
    gj = g >= 0 ? (g / GW) | 0 : 0;
  const h = (i, j) => {
    if (g < 0) return 0;
    const dx = Math.abs(i - gi),
      dy = Math.abs(j - gj);
    return (Math.max(dx, dy) + (SQ2 - 1) * Math.min(dx, dy)) * RES * eps;
  };
  gs[s] = 0;
  heap.push(s, h(s % GW, (s / GW) | 0));
  let exp = 0,
    found = false;
  if (tr) {
    tr.order = new Int32Array(NC);
    tr.closedAt = new Int32Array(NC);
    tr.openAt = new Int32Array(NC).fill(-1);
    tr.openAt[s] = 0;
  }
  while (heap.size) {
    const u = heap.pop();
    if (closed[u]) continue;
    closed[u] = 1;
    exp++;
    if (tr) {
      tr.order[exp - 1] = u;
      tr.closedAt[u] = exp;
    }
    if (u === g) {
      found = true;
      break;
    }
    const ui = u % GW,
      uj = (u / GW) | 0;
    for (const [di, dj, c] of NB) {
      const vi = ui + di,
        vj = uj + dj;
      if (vi < 0 || vj < 0 || vi >= GW || vj >= GH) continue;
      const v = vj * GW + vi;
      if (cm.lethal[v] || closed[v]) continue;
      if (di && dj && (cm.lethal[uj * GW + vi] || cm.lethal[vj * GW + ui])) continue;
      const ng = gs[u] + c * RES * (1 + PENW * cm.pen[v]);
      if (ng < gs[v]) {
        gs[v] = ng;
        par[v] = u;
        heap.push(v, ng + h(vi, vj));
        if (tr && tr.openAt[v] < 0) tr.openAt[v] = exp;
      }
    }
  }
  return {gs, par, closed, exp, found};
}
const center = k => [((k % GW) + 0.5) * RES, (((k / GW) | 0) + 0.5) * RES];
function smoothPath(pts) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !segClear(pts[i][0], pts[i][1], pts[j][0], pts[j][1], LETHAL + 0.1, i === 0)) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}
function pathLen(p) {
  let L = 0;
  for (let i = 1; i < p.length; i++) L += hyp(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return L;
}
function astar(sx, sy, gx, gy) {
  let s = cellIdx(sx, sy),
    g = cellIdx(gx, gy);
  if (s < 0 || g < 0) return {ok: false, reason: 'outside the map'};
  if (S.cm.lethal[g]) return {ok: false, reason: goalBlocked(gx, gy) || 'goal is inside an inflated obstacle'};
  if (S.cm.lethal[s]) {
    s = nearestFree(s);
    if (s < 0) return {ok: false, reason: 'start is enclosed'};
  }
  const tr = {},
    R = gridSearch(s, g, P.eps, tr);
  S.search = {type: 'astar', closed: R.closed};
  S.searchTrace = {type: 'grid', name: 'A*', n: R.exp, order: tr.order, closedAt: tr.closedAt, openAt: tr.openAt, par: R.par}; // for step-by-step playback
  if (!R.found) return {ok: false, reason: 'no route in the current costmap', exp: R.exp};
  const cells = [];
  for (let k = g; k >= 0; k = R.par[k]) cells.push(k);
  cells.reverse();
  // keep only turning points
  let pts = [[sx, sy]];
  for (let k = 1; k < cells.length - 1; k++) {
    const a = cells[k - 1],
      b = cells[k],
      c = cells[k + 1];
    if (b - a !== c - b) pts.push(center(b));
  }
  pts.push([gx, gy]);
  if (P.smooth) pts = smoothPath(pts);
  return {ok: true, pts, exp: R.exp, cost: R.gs[g]};
}
// RRT*: sample, steer from the nearest node, connect to the cheapest parent within the radius, rewire; the radius shrinks with n.
function rrtstar(sx, sy, gx, gy) {
  const g = S.rngA,
    cm = S.cm;
  const gk = cellIdx(gx, gy);
  if (gk < 0 || cm.lethal[gk]) return {ok: false, reason: (gk >= 0 && goalBlocked(gx, gy)) || 'goal is inside an inflated obstacle'};
  const X = [sx],
    Y = [sy],
    Pa = [-1],
    Co = [0],
    step = 0.6,
    gam = 8,
    Pa0 = [-1],
    QX = [sx],
    QY = [sy],
    rew = []; // Pa0, QX/QY, rew: for playback
  for (let it = 0; it < P.rrtIt; it++) {
    let qx, qy;
    if (g.u() < 0.1) {
      qx = gx;
      qy = gy;
    } else {
      qx = g.u() * W;
      qy = g.u() * H;
    }
    let ni = 0,
      nd = Infinity;
    for (let i = 0; i < X.length; i++) {
      const d = (X[i] - qx) ** 2 + (Y[i] - qy) ** 2;
      if (d < nd) {
        nd = d;
        ni = i;
      }
    }
    const d = Math.sqrt(nd);
    if (d < 1e-6) continue;
    const sc = Math.min(step, d) / d,
      nx = X[ni] + (qx - X[ni]) * sc,
      ny = Y[ni] + (qy - Y[ni]) * sc;
    const nk = cellIdx(nx, ny);
    if (nk < 0 || cm.lethal[nk]) continue;
    const n = X.length,
      rad = Math.min(gam * Math.sqrt(Math.log(n + 1) / (n + 1)), 1.5),
      r2 = rad * rad;
    const near = [];
    for (let i = 0; i < n; i++) if ((X[i] - nx) ** 2 + (Y[i] - ny) ** 2 <= r2) near.push(i);
    let bp = -1,
      bc = Infinity;
    if (segClear(X[ni], Y[ni], nx, ny, LETHAL + 0.05, ni === 0)) {
      bp = ni;
      bc = Co[ni] + hyp(nx - X[ni], ny - Y[ni]);
    }
    for (const i of near) {
      const c = Co[i] + hyp(nx - X[i], ny - Y[i]);
      if (c < bc && segClear(X[i], Y[i], nx, ny, LETHAL + 0.05, i === 0)) {
        bc = c;
        bp = i;
      }
    }
    if (bp < 0) continue;
    X.push(nx);
    Y.push(ny);
    Pa.push(bp);
    Co.push(bc);
    Pa0.push(bp);
    QX.push(qx);
    QY.push(qy);
    for (const i of near) {
      if (i === bp || i === 0) continue;
      const c = bc + hyp(nx - X[i], ny - Y[i]);
      if (c < Co[i] && segClear(nx, ny, X[i], Y[i], LETHAL + 0.05, false)) {
        Pa[i] = n;
        Co[i] = c;
        rew.push(n, i);
      }
    }
  }
  // connect best node to goal (walk parents for true cost)
  let best = -1,
    bc = Infinity;
  for (let i = 0; i < X.length; i++) {
    const dg = hyp(X[i] - gx, Y[i] - gy);
    if (dg > 1.0) continue;
    if (!segClear(X[i], Y[i], gx, gy, LETHAL + 0.05, i === 0)) continue;
    let c = dg,
      k = i;
    while (Pa[k] >= 0) {
      c += hyp(X[k] - X[Pa[k]], Y[k] - Y[Pa[k]]);
      k = Pa[k];
    }
    if (c < bc) {
      bc = c;
      best = i;
    }
  }
  S.search = {type: 'rrt', X, Y, Pa};
  S.searchTrace = {type: 'rrt', name: 'RRT*', n: X.length, X, Y, Pa0, QX, QY, rew};
  if (best < 0) return {ok: false, reason: `no connection to the goal after ${P.rrtIt} samples`, exp: X.length};
  let pts = [[gx, gy]];
  for (let k = best; k >= 0; k = Pa[k]) pts.push([X[k], Y[k]]);
  pts.reverse();
  if (P.smooth) pts = smoothPath(pts);
  return {ok: true, pts, exp: X.length, cost: pathLen(pts)};
}

/* RS_BEGIN */
const RS = (() => {
  const PI = Math.PI,
    HP = PI / 2,
    sin = Math.sin,
    cos = Math.cos;
  const M = x => {
    let v = x % (2 * PI);
    if (v < -PI) v += 2 * PI;
    else if (v > PI) v -= 2 * PI;
    return v;
  };
  const pol = (x, y) => [Math.hypot(x, y), Math.atan2(y, x)];
  // Path families in normalized units (turning radius 1). Signed lengths: negative = reverse.
  function LSL(x, y, p) {
    const [u, t] = pol(x - sin(p), y - 1 + cos(p));
    if (t >= 0 && t <= PI) {
      const v = M(p - t);
      if (v >= 0 && v <= PI) return [[t, u, v], 'LSL'];
    }
    return null;
  }
  function LSR(x, y, p) {
    let [u1, t1] = pol(x + sin(p), y - 1 - cos(p));
    u1 *= u1;
    if (u1 >= 4) {
      const u = Math.sqrt(u1 - 4),
        th = Math.atan2(2, u),
        t = M(t1 + th),
        v = M(t - p);
      if (t >= 0 && v >= 0) return [[t, u, v], 'LSR'];
    }
    return null;
  }
  function LxRxL(x, y, p) {
    const [u1, th] = pol(x - sin(p), y - 1 + cos(p));
    if (u1 <= 4) {
      const A = Math.acos(0.25 * u1),
        t = M(A + th + HP),
        u = M(PI - 2 * A),
        v = M(p - t - u);
      return [[t, -u, v], 'LRL'];
    }
    return null;
  }
  function LxRL(x, y, p) {
    const [u1, th] = pol(x - sin(p), y - 1 + cos(p));
    if (u1 <= 4) {
      const A = Math.acos(0.25 * u1),
        t = M(A + th + HP),
        u = M(PI - 2 * A),
        v = M(-p + t + u);
      return [[t, -u, -v], 'LRL'];
    }
    return null;
  }
  function LRxL(x, y, p) {
    const [u1, th] = pol(x - sin(p), y - 1 + cos(p));
    if (u1 <= 4 && u1 > 1e-9) {
      const u = Math.acos(1 - u1 * u1 * 0.125),
        A = Math.asin(Math.max(-1, Math.min(1, (2 * sin(u)) / u1))),
        t = M(-A + th + HP),
        v = M(t - u - p);
      return [[t, u, -v], 'LRL'];
    }
    return null;
  }
  function LRxLR(x, y, p) {
    const [u1, th] = pol(x + sin(p), y - 1 - cos(p));
    if (u1 <= 2) {
      const A = Math.acos((u1 + 2) * 0.25),
        t = M(th + A + HP),
        u = M(A),
        v = M(p - t + 2 * u);
      if (t >= 0 && u >= 0 && v >= 0) return [[t, u, -u, -v], 'LRLR'];
    }
    return null;
  }
  function LxRLxR(x, y, p) {
    const [u1, th] = pol(x + sin(p), y - 1 - cos(p));
    const u2 = (20 - u1 * u1) / 16;
    if (u2 >= 0 && u2 <= 1 && u1 > 1e-9) {
      const u = Math.acos(u2),
        A = Math.asin(Math.max(-1, Math.min(1, (2 * sin(u)) / u1))),
        t = M(th + A + HP),
        v = M(t - p);
      if (t >= 0 && v >= 0) return [[t, -u, -u, v], 'LRLR'];
    }
    return null;
  }
  function LxR90SL(x, y, p) {
    const [u1, th] = pol(x - sin(p), y - 1 + cos(p));
    if (u1 >= 2) {
      const q = Math.sqrt(u1 * u1 - 4),
        u = q - 2,
        A = Math.atan2(2, q),
        t = M(th + A + HP),
        v = M(t - p + HP);
      if (t >= 0 && v >= 0) return [[t, -HP, -u, -v], 'LRSL'];
    }
    return null;
  }
  function LSR90xL(x, y, p) {
    const [u1, th] = pol(x - sin(p), y - 1 + cos(p));
    if (u1 >= 2) {
      const q = Math.sqrt(u1 * u1 - 4),
        u = q - 2,
        A = Math.atan2(q, 2),
        t = M(th - A + HP),
        v = M(t - p - HP);
      if (t >= 0 && v >= 0) return [[t, u, HP, -v], 'LSRL'];
    }
    return null;
  }
  function LxR90SR(x, y, p) {
    const [u1, th] = pol(x + sin(p), y - 1 - cos(p));
    if (u1 >= 2) {
      const t = M(th + HP),
        u = u1 - 2,
        v = M(p - t - HP);
      if (t >= 0 && v >= 0) return [[t, -HP, -u, -v], 'LRSR'];
    }
    return null;
  }
  function LSL90xR(x, y, p) {
    const [u1, th] = pol(x + sin(p), y - 1 - cos(p));
    if (u1 >= 2) {
      const t = M(th),
        u = u1 - 2,
        v = M(p - t - HP);
      if (t >= 0 && v >= 0) return [[t, u, HP, -v], 'LSLR'];
    }
    return null;
  }
  function LxR90SL90xR(x, y, p) {
    const [u1, th] = pol(x + sin(p), y - 1 - cos(p));
    if (u1 >= 4) {
      const q = Math.sqrt(u1 * u1 - 4),
        u = q - 4,
        A = Math.atan2(2, q),
        t = M(th + A + HP),
        v = M(t - p);
      if (t >= 0 && v >= 0) return [[t, -HP, -u, -HP, v], 'LRSLR'];
    }
    return null;
  }
  const FAMS = [LSL, LSR, LxRxL, LxRL, LRxL, LRxLR, LxRLxR, LxR90SL, LSR90xL, LxR90SR, LSL90xR, LxR90SL90xR];
  const flip = s => s.replace(/[LR]/g, c => (c === 'L' ? 'R' : 'L'));
  function cands(x, y, p) {
    const out = [];
    for (let f = 0; f < FAMS.length; f++) {
      const F = FAMS[f];
      let r;
      if ((r = F(x, y, p))) out.push({L: r[0], T: r[1], f});
      if ((r = F(-x, y, -p))) out.push({L: r[0].map(d => -d), T: r[1], f});
      if ((r = F(x, -y, -p))) out.push({L: r[0], T: flip(r[1]), f});
      if ((r = F(-x, -y, p))) out.push({L: r[0].map(d => -d), T: flip(r[1]), f});
    }
    for (const c of out) {
      let s = 0;
      for (const d of c.L) s += Math.abs(d);
      c.len = s;
    }
    return out.filter(c => isFinite(c.len)).sort((a, b) => a.len - b.len);
  }
  function norm(q0, q1, R) {
    const dx = q1[0] - q0[0],
      dy = q1[1] - q0[1],
      c = cos(q0[2]),
      s = sin(q0[2]);
    return [(c * dx + s * dy) / R, (-s * dx + c * dy) / R, wrap(q1[2] - q0[2])];
  }
  function endpoint(q0, c, R) {
    let x = q0[0],
      y = q0[1],
      th = q0[2];
    for (let i = 0; i < c.L.length; i++) {
      const d = c.L[i],
        t = c.T[i];
      if (t === 'S') {
        x += R * d * cos(th);
        y += R * d * sin(th);
      } else if (t === 'L') {
        const t2 = th + d;
        x += R * (sin(t2) - sin(th));
        y += R * (-cos(t2) + cos(th));
        th = t2;
      } else {
        const t2 = th - d;
        x += R * (-sin(t2) + sin(th));
        y += R * (cos(t2) - cos(th));
        th = t2;
      }
    }
    return [x, y, wrap(th)];
  }
  function valid(q0, q1, c, R) {
    const e = endpoint(q0, c, R);
    return hyp(e[0] - q1[0], e[1] - q1[1]) < 1e-3 * Math.max(1, R) && Math.abs(wrap(e[2] - q1[2])) < 1e-3;
  }
  // All endpoint-verified candidates, shortest first
  function solve(q0, q1, R) {
    const [x, y, p] = norm(q0, q1, R);
    return cands(x, y, p).filter(c => valid(q0, q1, c, R));
  }
  // Length only (for the heuristic): shortest verified length in metres
  function length(q0, q1, R) {
    const [x, y, p] = norm(q0, q1, R);
    for (const c of cands(x, y, p)) if (valid(q0, q1, c, R)) return c.len * R;
    return Infinity;
  }
  // Sample poses every ds metres, split into legs by gear
  function sample(q0, c, R, ds) {
    const segs = [];
    let x = q0[0],
      y = q0[1],
      th = q0[2],
      cur = null;
    for (let i = 0; i < c.L.length; i++) {
      const d = c.L[i],
        t = c.T[i],
        dir = d >= 0 ? 1 : -1,
        len = Math.abs(d) * R;
      if (len < 1e-6) continue;
      if (!cur || cur.dir !== dir) {
        cur = {dir, pts: [[x, y, th]]};
        segs.push(cur);
      }
      const n = Math.max(1, Math.ceil(len / ds)),
        x0 = x,
        y0 = y,
        t0 = th;
      for (let k = 1; k <= n; k++) {
        const dk = (d * k) / n;
        let xx, yy, tt;
        if (t === 'S') {
          xx = x0 + R * dk * cos(t0);
          yy = y0 + R * dk * sin(t0);
          tt = t0;
        } else if (t === 'L') {
          tt = t0 + dk;
          xx = x0 + R * (sin(tt) - sin(t0));
          yy = y0 + R * (-cos(tt) + cos(t0));
        } else {
          tt = t0 - dk;
          xx = x0 + R * (-sin(tt) + sin(t0));
          yy = y0 + R * (cos(tt) - cos(t0));
        }
        cur.pts.push([xx, yy, wrap(tt)]);
      }
      const l = cur.pts[cur.pts.length - 1];
      x = l[0];
      y = l[1];
      th = l[2];
    }
    return segs;
  }
  return {solve, length, sample, endpoint, cands, norm, valid, NF: FAMS.length};
})();

/* ---- core/planning-car.js ---- */
/* ---------- Reeds–Shepp only (ignores obstacles) ---------- */
function rsPlan(e, wp) {
  const R = planR(),
    th = wp.th != null ? wp.th : Math.atan2(wp.y - e.y, wp.x - e.x);
  const c = RS.solve([e.x, e.y, e.th], [wp.x, wp.y, th], R)[0];
  S.search = null;
  if (!c) return {ok: false, reason: 'no Reeds–Shepp solution'};
  const segs = RS.sample([e.x, e.y, e.th], c, R, 0.1);
  return {ok: true, segs, len: c.len * R, exp: 0, extra: `${c.T} · ${segs.length - 1} cusp${segs.length === 2 ? '' : 's'}`};
}

/* ---------- Hybrid A* (Dolgov et al. 2008) ---------- */
const HY = {XY: 0.2, NT: 72};
HY.NX = Math.ceil(W / HY.XY);
HY.NY = Math.ceil(H / HY.XY);
HY.N = HY.NX * HY.NY * HY.NT;
let HYB = null;
function hyBuf() {
  if (!HYB)
    HYB = {
      g: new Float32Array(HY.N),
      closed: new Uint8Array(HY.N),
      par: new Int32Array(HY.N),
      x: new Float32Array(HY.N),
      y: new Float32Array(HY.N),
      th: new Float32Array(HY.N),
      dir: new Int8Array(HY.N),
      st: new Float32Array(HY.N)
    };
  HYB.g.fill(Infinity);
  HYB.closed.fill(0);
  return HYB;
}
// obstacle-aware, non-holonomic-free heuristic: 8-connected Dijkstra from the goal on the 0.1 m grid
function holoField(gx, gy, dist, thr) {
  const h = new Float32Array(NC).fill(Infinity),
    done = new Uint8Array(NC),
    heap = new Heap(),
    g = cellIdx(gx, gy);
  if (g < 0) return h;
  h[g] = 0;
  heap.push(g, 0);
  while (heap.size) {
    const u = heap.pop();
    if (done[u]) continue;
    done[u] = 1;
    const ui = u % GW,
      uj = (u / GW) | 0;
    for (const [di, dj, c] of NB) {
      const vi = ui + di,
        vj = uj + dj;
      if (vi < 0 || vj < 0 || vi >= GW || vj >= GH) continue;
      const v = vj * GW + vi;
      if (done[v] || dist[v] < thr) continue;
      const ng = h[u] + c * RES;
      if (ng < h[v]) {
        h[v] = ng;
        heap.push(v, ng);
      }
    }
  }
  return h;
}
// Hybrid A*: a search over (x, y, θ) with arc primitives at the planning lock, Reeds–Shepp shots to the goal, the
// max(2D Dijkstra, Reeds–Shepp) heuristic, gear and steering penalties, and an expansion budget.
function hybridAstar(e, wp) {
  const dist = S.cm.dist,
    L = P.wheelbase,
    dm = planSteer(),
    R = planR(),
    MARG = 0.15,
    STEP = 0.4,
    SUB = 0.1,
    BUDGET = 60000;
  const goalTh = wp.th != null ? wp.th : null,
    q1 = [wp.x, wp.y, goalTh];
  const part = carLen() / 3,
    rc = Math.hypot(part / 2, CAR.width / 2),
    offs = [0, 1, 2].map(i => -CAR.rear + part * (i + 0.5));
  const clearAt = (x, y, th) => {
    const c = Math.cos(th),
      s = Math.sin(th);
    let m = Infinity;
    for (const o of offs) {
      const k = cellIdx(x + o * c, y + o * s);
      if (k < 0) return -1;
      const d = dist[k] - rc;
      if (d < m) m = d;
    }
    return m;
  };
  if (goalTh != null && clearAt(wp.x, wp.y, goalTh) < MARG)
    return {ok: false, reason: goalBlocked(wp.x, wp.y) || 'the goal pose overlaps an obstacle'};
  if (goalTh == null && cellIdx(wp.x, wp.y) >= 0 && dist[cellIdx(wp.x, wp.y)] < CAR.width / 2 + MARG)
    return {ok: false, reason: goalBlocked(wp.x, wp.y) || 'goal is too close to an obstacle for the car'};
  const startClear = clearAt(e.x, e.y, e.th);
  const h2 = holoField(wp.x, wp.y, dist, CAR.width / 2 + 0.02);
  const h2At = (x, y) => {
    const k = cellIdx(x, y);
    if (k < 0) return Infinity;
    const v = h2[k];
    return isFinite(v) ? v : hyp(x - wp.x, y - wp.y) + 20;
  };
  const useRS = goalTh != null && P.hybH === 'both';
  const hAt = (x, y, th) => {
    let h = h2At(x, y);
    if (useRS && h < 5) {
      const r = RS.length([x, y, th], q1, R);
      if (r > h) h = r;
    }
    return h;
  };
  const B = hyBuf(),
    NT = HY.NT,
    XY = HY.XY,
    NX = HY.NX;
  const key = (x, y, th) => {
    const i = Math.floor(x / XY),
      j = Math.floor(y / XY);
    if (i < 0 || j < 0 || i >= NX || j >= HY.NY) return -1;
    return (j * NX + i) * NT + (((Math.round(th / (TAU / NT)) % NT) + NT) % NT);
  };
  const steers = [-dm, -dm / 2, 0, dm / 2, dm],
    dirs = P.revOK ? [1, -1] : [1];
  const s0 = key(e.x, e.y, e.th);
  if (s0 < 0) return {ok: false, reason: 'start is outside the map'};
  let viz, exp, fin, tail, shots, pix, im; // pix: each expansion's parent, as an index into the expansion order (playback)
  // lenient: within 1 m of the start, primitives need only startClear − RES (one grid cell below the start's reading)
  const search = lenient => {
    B.g[s0] = 0;
    B.par[s0] = -1;
    B.x[s0] = e.x;
    B.y[s0] = e.y;
    B.th[s0] = e.th;
    B.dir[s0] = 0;
    B.st[s0] = S.robot.d || 0;
    const heap = new Heap();
    heap.push(s0, P.eps * hAt(e.x, e.y, e.th));
    viz = [];
    exp = 0;
    fin = -1;
    tail = null;
    shots = 0;
    pix = [];
    im = new Map();
    while (heap.size && exp < BUDGET) {
      const u = heap.pop();
      if (B.closed[u]) continue;
      B.closed[u] = 1;
      exp++;
      const x = B.x[u],
        y = B.y[u],
        th = B.th[u];
      im.set(u, exp - 1);
      if (viz.length < 40000) {
        viz.push(x, y);
        const pu = B.par[u];
        pix.push(pu >= 0 && im.has(pu) ? im.get(pu) : -1);
      }
      const dg = hyp(x - wp.x, y - wp.y);
      if (dg < 0.15 && (goalTh == null || Math.abs(wrap(th - goalTh)) < 0.12)) {
        fin = u;
        break;
      } // inside the arrival tolerance
      // analytic expansion: try a Reeds–Shepp shot to the goal
      if (goalTh != null && (dg < 2.5 || exp % 10 === 0)) {
        shots++;
        const cs = RS.solve([x, y, th], q1, R);
        for (let ci = 0, tried = 0; ci < cs.length && tried < 4 && !tail; ci++) {
          // reject shots with gear legs too short to execute (< 0.25 m)
          let short = false,
            acc = 0,
            sg0 = 0;
          for (const d of cs[ci].L) {
            const sg = Math.sign(d);
            if (Math.abs(d) < 1e-9) continue;
            if (sg !== sg0 && sg0 !== 0) {
              if (acc < 0.25) short = true;
              acc = 0;
            }
            sg0 = sg;
            acc += Math.abs(d) * R;
          }
          if (acc < 0.25 && cs[ci].len * R > 0.25) short = true;
          if (short) continue;
          tried++;
          const segs = RS.sample([x, y, th], cs[ci], R, SUB);
          let ok = true;
          for (const sg of segs) {
            for (const p of sg.pts) {
              if (clearAt(p[0], p[1], p[2]) < MARG) {
                ok = false;
                break;
              }
            }
            if (!ok) break;
          }
          if (ok) tail = segs;
        }
        if (tail) {
          fin = u;
          break;
        }
      }
      for (const d of dirs)
        for (const st of steers) {
          let nx = x,
            ny = y,
            nt = th,
            minC = Infinity,
            ok = true;
          const w = (d * Math.tan(st)) / L;
          for (let k = 0; k < Math.round(STEP / SUB); k++) {
            const n = integ(nx, ny, nt, d, w, SUB);
            nx = n.x;
            ny = n.y;
            nt = n.th;
            const c = clearAt(nx, ny, nt),
              need = lenient && hyp(nx - e.x, ny - e.y) < 1.0 ? startClear - RES : MARG; // let a car in a tight spot back out
            if (c < need) {
              ok = false;
              break;
            }
            if (c < minC) minC = c;
          }
          if (!ok) continue;
          const v = key(nx, ny, nt);
          if (v < 0 || B.closed[v]) continue;
          const prox = Math.max(0, (0.4 - minC) / 0.4);
          const cost =
            STEP * (d > 0 ? 1 : P.revPen) +
            (0.05 * Math.abs(st)) / dm +
            (0.1 * Math.abs(st - B.st[u])) / dm +
            (B.dir[u] !== 0 && B.dir[u] !== d ? P.gearPen : 0) +
            STEP * 2 * prox * prox;
          const ng = B.g[u] + cost;
          if (ng < B.g[v]) {
            B.g[v] = ng;
            B.par[v] = u;
            B.x[v] = nx;
            B.y[v] = ny;
            B.th[v] = nt;
            B.dir[v] = d;
            B.st[v] = st;
            heap.push(v, ng + P.eps * hAt(nx, ny, nt));
          }
        }
    }
  };
  // A car touching something may back out at reduced margin. Clearance reads come in whole 0.1 m cells, so a start
  // one cell above MARG can be boxed in too: a 1 cm move drops the reading by a cell and every way out of a tight
  // slot fails. Such a start gets the same leniency, but only when the strict search runs out of nodes.
  search(startClear < MARG);
  if (fin < 0 && exp < BUDGET && startClear >= MARG && startClear - RES < MARG) {
    hyBuf();
    search(true);
  }
  S.search = {type: 'hybrid', pts: viz};
  S.searchTrace = {type: 'pts', name: 'Hybrid A*', n: viz.length / 2, pts: viz, pix, cell: 0};
  if (fin < 0)
    return {ok: false, reason: exp >= BUDGET ? `search budget of ${BUDGET} expansions used up` : 'no kinematically feasible route', exp};
  // rebuild: re-simulate each primitive from its parent pose
  const chain = [];
  for (let k = fin; k !== s0 && k >= 0; k = B.par[k]) chain.push(k);
  chain.reverse();
  const segs = [];
  let cur = null;
  const add = (dir, pt) => {
    if (!cur || cur.dir !== dir) {
      const st = cur ? cur.pts[cur.pts.length - 1] : [e.x, e.y, e.th];
      cur = {dir, pts: [st]};
      segs.push(cur);
    }
    cur.pts.push(pt);
  };
  for (const k of chain) {
    const p = B.par[k],
      d = B.dir[k],
      w = (d * Math.tan(B.st[k])) / L;
    let nx = B.x[p],
      ny = B.y[p],
      nt = B.th[p];
    for (let i = 0; i < Math.round(STEP / SUB); i++) {
      const n = integ(nx, ny, nt, d, w, SUB);
      nx = n.x;
      ny = n.y;
      nt = n.th;
      add(d, [nx, ny, nt]);
    }
  }
  if (tail) for (const g of tail) for (let i = 1; i < g.pts.length; i++) add(g.dir, g.pts[i]);
  if (!segs.length)
    segs.push({
      dir: 1,
      pts: [
        [e.x, e.y, e.th],
        [e.x + 1e-3 * Math.cos(e.th), e.y + 1e-3 * Math.sin(e.th), e.th]
      ]
    });
  let len = 0;
  for (const g of segs) len += pathLen(g.pts);
  return {ok: true, segs, len, exp, extra: `${segs.length - 1} cusp${segs.length === 2 ? '' : 's'}${tail ? ' · RS shot' : ''}`};
}

/* ---- core/path.js ---- */
/* ---------- path tracking helpers ---------- */
function setPlan(segs) {
  S.plan = {segs};
  S.segIdx = 0;
  loadSeg(0);
}
function loadSeg(i) {
  const g = S.plan.segs[i];
  setTrack(g.pts);
  S.track.dir = g.dir;
  S.ctlState = {I: 0, prev: null};
}
function setTrack(pts) {
  pts = pts.filter((p, i) => i === 0 || hyp(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-4);
  if (pts.length < 2) pts = [pts[0], [pts[0][0] + 1e-3, pts[0][1]]];
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + hyp(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  S.track = {pts, s, total: s[s.length - 1], idx: 0, dir: 1};
  S.pathId++;
  const n = pts.length,
    hd = [],
    kv = new Float64Array(n);
  for (let i = 0; i < n - 1; i++) hd.push(Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]));
  for (let i = 1; i < n - 1; i++) {
    const l = (s[i + 1] - s[i - 1]) / 2;
    kv[i] = l > 1e-6 ? wrap(hd[i] - hd[i - 1]) / l : 0;
  }
  if (n > 2) {
    kv[0] = kv[1];
    kv[n - 1] = kv[n - 2];
  }
  S.track.hd = hd;
  S.track.kv = kv;
  // dense copy for the custom controller
  const dense = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i],
      L = hyp(b[0] - a[0], b[1] - a[1]),
      n = Math.max(1, Math.ceil(L / 0.1));
    for (let k = 0; k < n; k++) dense.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  dense.push(pts[pts.length - 1]);
  S.track.dense = dense;
}
function project(x, y, windowed) {
  const T = S.track,
    p = T.pts;
  let best = Infinity,
    bi = 0,
    bt = 0;
  const i0 = windowed ? T.idx : 0,
    i1 = windowed ? Math.min(p.length - 2, T.idx + 40) : p.length - 2;
  for (let i = i0; i <= i1; i++) {
    const a = p[i],
      b = p[i + 1],
      vx = b[0] - a[0],
      vy = b[1] - a[1],
      L2 = vx * vx + vy * vy;
    let t = L2 > 0 ? ((x - a[0]) * vx + (y - a[1]) * vy) / L2 : 0;
    t = clamp(t, 0, 1);
    const px = a[0] + vx * t,
      py = a[1] + vy * t,
      d = (x - px) ** 2 + (y - py) ** 2;
    if (d < best) {
      best = d;
      bi = i;
      bt = t;
    }
  }
  return {i: bi, s: T.s[bi] + bt * (T.s[bi + 1] - T.s[bi]), d: Math.sqrt(best)};
}
function pointAt(sArc, ext) {
  const T = S.track,
    p = T.pts;
  if (sArc >= T.total) {
    const b = p[p.length - 1];
    if (!ext) return b;
    const a = p[p.length - 2],
      l = hyp(b[0] - a[0], b[1] - a[1]) || 1,
      x = sArc - T.total;
    return [b[0] + ((b[0] - a[0]) / l) * x, b[1] + ((b[1] - a[1]) / l) * x];
  }
  if (sArc <= 0) return p[0];
  let i = 0;
  while (i < p.length - 2 && T.s[i + 1] < sArc) i++;
  const t = (sArc - T.s[i]) / (T.s[i + 1] - T.s[i] || 1);
  return [p[i][0] + (p[i + 1][0] - p[i][0]) * t, p[i][1] + (p[i + 1][1] - p[i][1]) * t];
}

/* ---- core/mission.js ---- */
/* ============================================================
   High-level planning: mission ordering + state machine
   ============================================================ */
function remaining() {
  return WPS.map((w, i) => (w.done ? -1 : i)).filter(i => i >= 0);
}
function computeOrder(idx) {
  if (idx.length < 2 || P.mis === 'sequential') return {order: idx.slice(), cost: null};
  const pts = [[S.est.x, S.est.y], ...idx.map(i => [WPS[i].x, WPS[i].y])],
    n = idx.length;
  const C = [];
  for (let a = 0; a <= n; a++) {
    let s = cellIdx(pts[a][0], pts[a][1]);
    if (S.cm.lethal[s]) s = nearestFree(s);
    const R = gridSearch(s, -1, 1);
    C.push(
      pts.map(p => {
        const k = cellIdx(p[0], p[1]);
        const v = R.gs[k];
        return isFinite(v) ? v : 1e6;
      })
    );
  }
  let order;
  if (P.mis === 'greedy') {
    order = [];
    const used = new Array(n + 1).fill(false);
    let u = 0;
    for (let k = 0; k < n; k++) {
      let b = -1;
      for (let v = 1; v <= n; v++) if (!used[v] && (b < 0 || C[u][v] < C[u][b])) b = v;
      used[b] = true;
      order.push(b);
      u = b;
    }
  } else {
    let best = Infinity,
      bestP = null;
    const used = new Array(n + 1).fill(false),
      cur = [];
    (function dfs(u, c, d) {
      if (c >= best) return;
      if (d === n) {
        best = c;
        bestP = cur.slice();
        return;
      }
      for (let v = 1; v <= n; v++)
        if (!used[v]) {
          used[v] = true;
          cur.push(v);
          dfs(v, c + C[u][v], d + 1);
          cur.pop();
          used[v] = false;
        }
    })(0, 0, 0);
    order = bestP;
  }
  let cost = 0,
    u = 0;
  for (const v of order) {
    cost += C[u][v];
    u = v;
  }
  return {order: order.map(v => idx[v - 1]), cost};
}
// Frontier exploration (Yamauchi 1997): a frontier cell is known free with an unknown 4-neighbour; frontiers are
// 8-connected clusters of at least P.exploreMin cells, each summarized by the member cell nearest its centroid. The
// goal the planner gets is the nearest known-free cell with some margin beyond the inflated obstacles (a frontier
// cell sits next to unknown space, which the cautious policy inflates); a frontier with no such cell nearby is skipped.
const exploring = () => P.mis === 'explore' && P.per === 'mapping';
function frontiers() {
  const lo = S.lo,
    isF = new Uint8Array(NC),
    unk = i => Math.abs(lo[i]) < 0.05,
    n = Math.ceil(LETHAL / RES);
  // a seen obstacle within the lethal radius (not the unknown: that would rule out every frontier under the cautious policy)
  const nearWall = (i, j) => {
    for (let dj = -n; dj <= n; dj++)
      for (let di = -n; di <= n; di++) {
        const ii = i + di,
          jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= GW || jj >= GH || di * di + dj * dj > n * n) continue;
        if (lo[jj * GW + ii] > 0.5) return true;
      }
    return false;
  };
  for (let j = 1; j < GH - 1; j++)
    for (let i = 1; i < GW - 1; i++) {
      const k = j * GW + i;
      if (lo[k] < -0.05 && (unk(k - 1) || unk(k + 1) || unk(k - GW) || unk(k + GW)) && !nearWall(i, j)) isF[k] = 1;
    }
  const seen = new Uint8Array(NC),
    out = [];
  for (let s = 0; s < NC; s++) {
    if (!isF[s] || seen[s]) continue;
    const cells = [s],
      q = [s];
    seen[s] = 1;
    while (q.length) {
      const k = q.pop(),
        i = k % GW,
        j = (k - i) / GW;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const ii = i + di,
            jj = j + dj,
            kk = jj * GW + ii;
          if (ii < 0 || jj < 0 || ii >= GW || jj >= GH || !isF[kk] || seen[kk]) continue;
          seen[kk] = 1;
          cells.push(kk);
          q.push(kk);
        }
    }
    if (cells.length < P.exploreMin) continue;
    let cx = 0,
      cy = 0;
    for (const k of cells) {
      cx += k % GW;
      cy += (k - (k % GW)) / GW;
    }
    cx /= cells.length;
    cy /= cells.length;
    let best = cells[0],
      bd = Infinity;
    for (const k of cells) {
      const d = ((k % GW) - cx) ** 2 + ((k - (k % GW)) / GW - cy) ** 2;
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    const g = nearestKnownFree(best);
    if (g < 0) continue;
    out.push({cells, size: cells.length, x: ((g % GW) + 0.5) * RES, y: ((g - (g % GW)) / GW + 0.5) * RES, key: best});
  }
  return out;
}
// the nearest known-free cell 0.2 m or more beyond the inflated obstacles, within about 2 m of cell s; in a corridor
// too narrow for that margin the nearest known-free cell that is merely not lethal; for a sliver seen through a door,
// where every known cell is lethal, the nearest cell that is not lethal at all (unknown, when unknown counts as free:
// the planner then heads into the unknown, which is the point) (−1: none)
function nearestKnownFree(s) {
  const seen = new Uint8Array(NC),
    q = [s],
    lim = Math.round(2 / RES);
  seen[s] = 1;
  const si = s % GW,
    sj = (s - si) / GW;
  let fallback = -1,
    last = -1;
  for (let h = 0; h < q.length; h++) {
    const u = q[h];
    if (!S.cm.lethal[u]) {
      if (S.lo[u] < -0.05) {
        if (S.cm.dist[u] >= LETHAL + 0.2) return u;
        if (fallback < 0) fallback = u;
      } else if (last < 0) last = u;
    }
    const ui = u % GW,
      uj = (u - ui) / GW;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      const vi = ui + di,
        vj = uj + dj;
      if (vi < 0 || vj < 0 || vi >= GW || vj >= GH || Math.abs(vi - si) > lim || Math.abs(vj - sj) > lim) continue;
      const v = vj * GW + vi;
      if (seen[v]) continue;
      seen[v] = 1;
      q.push(v);
    }
  }
  return fallback >= 0 ? fallback : last;
}
// The next frontier to visit: the largest nearby one (size per metre of distance), skipping the ones that failed;
// the goal list becomes that one goal. Returns false when nothing is left to see.
function exploreNext(reason, quiet) {
  const fr = frontiers(),
    e = S.est,
    failed = S.exploreFailed || (S.exploreFailed = new Set());
  S.frontiers = fr;
  let best = null,
    bs = -Infinity;
  for (const f of fr) {
    if (failed.has(f.key)) continue;
    const d = hyp(f.x - e.x, f.y - e.y),
      s = f.size / (1 + d);
    if (s > bs) {
      bs = s;
      best = f;
    }
  }
  if (!best && failed.size && !S.exploreRetried) {
    // nothing left but the frontiers that failed: one more try at each, from wherever the robot is now
    S.exploreRetried = true;
    failed.clear();
    logE('Explore: only the frontiers that failed are left, trying them once more');
    return exploreNext(reason, quiet);
  }
  if (!best) {
    if (quiet) return false;
    const pct = exploredFrac();
    logE(
      `Explored: ${fr.length ? `${fr.length} frontier${fr.length === 1 ? '' : 's'} left, none reachable` : 'no frontier left'} · ${(100 * pct).toFixed(0)} % of the floor seen`,
      'ok'
    );
    return false;
  }
  WPS = [{x: best.x, y: best.y, th: null, done: false, explore: true, key: best.key, cells: best.cells}];
  S.fsm.queue = [0];
  logE(
    `Explore${reason ? ` (${reason})` : ''}: frontier of ${best.size} cells at (${best.x.toFixed(1)}, ${best.y.toFixed(1)}), ${fr.length} frontier${fr.length === 1 ? '' : 's'}, ${(100 * exploredFrac()).toFixed(0)} % seen`
  );
  return true;
}
// how much of the floor the robot could stand on has been seen (known cells among the true free cells)
function exploredFrac() {
  const lo = S.lo,
    tr = LV.truthOcc;
  if (!tr || P.per !== 'mapping') return null;
  let n = 0,
    k = 0;
  for (let i = 0; i < NC; i++) {
    if (tr[i]) continue;
    n++;
    if (Math.abs(lo[i]) >= 0.05) k++;
  }
  return n ? k / n : 0;
}
// a frontier goal is pointless once none of its cells borders unknown space any more (seen on the way there)
function frontierGone(wp) {
  const lo = S.lo,
    unk = i => Math.abs(lo[i]) < 0.05;
  for (const k of wp.cells) if (lo[k] < -0.05 && (unk(k - 1) || unk(k + 1) || unk(k - GW) || unk(k + GW))) return false;
  return true;
}
// when a frontier goal is done or given up: the next frontier, or the end of the exploration
function exploreMore(failedKey) {
  if (!exploring()) return false;
  if (failedKey != null) (S.exploreFailed || (S.exploreFailed = new Set())).add(failedKey);
  return exploreNext(failedKey != null ? 'that one failed' : 'next');
}
function startMission() {
  const F = S.fsm;
  if (exploring()) {
    S.exploreFailed = new Set();
    S.exploreRetried = false;
    F.stuckN = 0;
    F.queue = [];
    F.scanT = S.t; // PLAN waits for the first scan when nothing is known yet (missionTick), up to 3 s
    F.state = 'PLAN';
    F.pendingReason = 'initial';
    return;
  }
  if (WPS.length && WPS[0].explore) WPS = LV.wps.map(w => ({x: w[0], y: w[1], th: w.length > 2 ? w[2] : null, done: false})); // back from exploring
  const rem = remaining();
  if (!rem.length) {
    F.state = WPS.length ? 'DONE' : 'IDLE';
    F.queue = [];
    S.track = null;
    S.plan = null;
    return;
  }
  const r = computeOrder(rem);
  F.queue = r.order;
  F.cost = r.cost;
  F.state = 'PLAN';
  const names = {sequential: 'in order', greedy: 'greedy nearest', optimal: 'optimal'};
  logE(
    `Mission: ${F.queue.length} goal${F.queue.length > 1 ? 's' : ''}, ${names[P.mis]}${r.cost != null ? ` · cost ${r.cost.toFixed(1)}` : ''}`
  );
}
const POSE_PLANNERS = ['hybrid', 'rs', 'custom'],
  ALIGN_TOL = 0.035; // planners that take the goal heading; unicycle alignment tolerance [rad]
const PLAN_NAMES = {
  straight: 'Straight',
  astar: 'A*',
  rrtstar: 'RRT*',
  rs: 'Reeds–Shepp',
  hybrid: 'Hybrid A*',
  stastar: 'Space-time A*',
  custom: 'Your code'
};
function doPlan(reason) {
  const F = S.fsm;
  if (!F.queue.length) {
    F.state = 'DONE';
    S.track = null;
    S.plan = null;
    return;
  }
  const agL = reason === 'agent blocking' && P.plan !== 'stastar' && agCostLayer(); // predicted agents enter the costmap for this plan only
  const wp = WPS[F.queue[0]],
    e = S.est,
    t0 = performance.now();
  let res;
  S.searchTrace = null;
  if (P.plan === 'custom') {
    customPlanStart(wp, reason);
    if (agL) buildCostmap();
    return;
  }
  if (P.plan === 'straight')
    res = {
      ok: true,
      pts: [
        [e.x, e.y],
        [wp.x, wp.y]
      ],
      exp: 0
    };
  else if (P.plan === 'astar') res = astar(e.x, e.y, wp.x, wp.y);
  else if (P.plan === 'rs') res = rsPlan(e, wp);
  else if (P.plan === 'hybrid') res = hybridAstar(e, wp);
  else if (P.plan === 'stastar') res = stAstar(e.x, e.y, wp.x, wp.y);
  else res = rrtstar(e.x, e.y, wp.x, wp.y);
  if (P.plan === 'straight') S.search = null;
  applyPlanResult(res, PLAN_NAMES[P.plan], reason, t0, agL);
}
function applyPlanResult(res, name, reason, t0, agL) {
  const F = S.fsm,
    e = S.est,
    ms = performance.now() - t0;
  F.lastPlanT = S.t;
  if (agL) buildCostmap();
  if (!F.queue.length) return;
  if (res.ok) {
    setPlan(res.segs || [{pts: res.pts, dir: 1}]);
    F.state = 'DRIVE';
    F.fails = 0;
    if (reason === 'initial' || reason === 'relocalized') F.prog = {t: S.t, x: e.x, y: e.y};
    S.ctlState = {I: 0, prev: null};
    S.planStats = {
      name,
      len: res.len != null ? res.len : pathLen(res.pts || res.segs.flatMap(s => s.pts)),
      exp: res.exp,
      ms,
      extra: res.extra || ''
    };
    if (reason !== 'periodic')
      logE(
        `${reason === 'initial' ? 'Plan' : 'Replan (' + reason + ')'} · ${name} ${S.planStats.len.toFixed(1)} m${P.plan === 'astar' || P.plan === 'hybrid' || P.plan === 'stastar' || (P.plan === 'custom' && res.exp) ? ` · ${res.exp} expansions` : P.plan === 'rrtstar' ? ` · ${res.exp} nodes` : ''}${res.extra ? ' · ' + res.extra : ''} · ${ms.toFixed(0)} ms`,
        reason === 'initial' ? '' : 'warn'
      );
  } else {
    F.state = 'NO_PATH';
    F.fails++;
    S.track = null;
    S.plan = null;
    logE(`${name}: no path to goal ${wpLabel(F.queue[0])} (${res.reason})`, 'bad');
    if (F.fails >= 3) {
      logE(`Skipping goal ${wpLabel(F.queue[0])} after 3 attempts`, 'bad');
      const fk = WPS[F.queue[0]].explore ? WPS[F.queue[0]].key : null;
      WPS[F.queue[0]].done = true;
      WPS[F.queue[0]].skipped = true;
      F.queue.shift();
      F.fails = 0;
      F.state = F.queue.length || exploreMore(fk) ? 'PLAN' : 'DONE';
    }
  }
}
function wpLabel(i) {
  return i + 1;
}
const posSigma = () => (S.Pc ? Math.sqrt(Math.max(0, S.Pc[0] + S.Pc[4])) : 0);
// One tick of the mission state machine (IDLE, PLAN, DRIVE, NO_PATH, LOST, DONE): goals reached by the estimate, replans on
// blocked, off path, stuck or timer, the lost guard, and the heading alignment at posed goals.
function missionTick() {
  const F = S.fsm;
  if (F.state === 'PLAN') {
    if (F.planPending) return;
    if (exploring() && !F.queue.length) {
      // the first frontier once the first scan is in; an empty map after 3 s, or no frontier left, ends the exploration
      const waiting = S.t - (F.scanT || 0) < 3;
      if (!exploreNext(F.scanT != null ? 'start' : 'next', waiting)) {
        if (!waiting) {
          F.state = 'DONE';
          S.track = null;
          S.plan = null;
        }
        return;
      }
      F.scanT = null;
    }
    doPlan(F.pendingReason || 'initial');
    F.pendingReason = null;
    return;
  }
  if (F.state === 'NO_PATH') {
    if (S.t - F.lastPlanT > 2) {
      F.state = 'PLAN';
      F.pendingReason = 'retry';
    }
    return;
  }
  if (F.state === 'LOST') {
    if (posSigma() < 0.4) {
      logE(`Relocalized (σ ${posSigma().toFixed(2)} m). Resuming.`, 'ok');
      F.state = 'PLAN';
      F.pendingReason = 'relocalized';
    }
    return;
  }
  if (F.state !== 'DRIVE') return;
  if (P.lostGuard && S.Pc && posSigma() > 1.0) {
    F.state = 'LOST';
    logE(`Position σ ${posSigma().toFixed(1)} m: holding and turning in place to find beacons`, 'warn');
    return;
  }
  const wp = WPS[F.queue[0]],
    e = S.est;
  if (wp.explore && S.t - (F.frontierT || 0) >= 1) {
    F.frontierT = S.t;
    if (frontierGone(wp)) {
      logE(`Frontier at (${wp.x.toFixed(1)}, ${wp.y.toFixed(1)}) seen on the way: next`);
      wp.done = true;
      F.queue.shift();
      F.stuckN = 0;
      S.ctlState = {I: 0, prev: null};
      if (exploreMore()) {
        F.state = 'PLAN';
        F.pendingReason = 'initial';
      } else {
        F.state = 'DONE';
        S.track = null;
        S.plan = null;
        logE(`Exploration complete in ${S.t.toFixed(1)} s`, 'ok');
      }
      return;
    }
  }
  let lastSeg = !S.plan || S.segIdx >= S.plan.segs.length - 1;
  if (!lastSeg) {
    const pr = project(e.x, e.y, true),
      T = S.track,
      end = T.pts[T.pts.length - 1];
    if (T.total - pr.s < 0.12 || hyp(end[0] - e.x, end[1] - e.y) < 0.1) {
      S.segIdx++;
      loadSeg(S.segIdx);
      F.prog = {t: S.t, x: e.x, y: e.y};
      logE(`Cusp → ${S.track.dir > 0 ? 'forward' : 'reverse'} (leg ${S.segIdx + 1}/${S.plan.segs.length})`);
      lastSeg = S.segIdx >= S.plan.segs.length - 1;
    }
  }
  // A goal with a heading: the car's pose planners (Hybrid A*, Reeds–Shepp, your code) arrive with it; the unicycle
  // drives to the point and then turns in place (F.align) until the estimate faces the goal heading within ALIGN_TOL.
  // Point planners on the car cannot honour it, so the heading is reported and not waited for.
  const posed = wp.th != null && (!isCar() || POSE_PLANNERS.includes(P.plan));
  if (wp.th != null && isCar() && !posed && F.headWarn !== F.queue[0]) {
    F.headWarn = F.queue[0];
    logE(`${PLAN_NAMES[P.plan]} plans to a point and ignores the goal heading; Hybrid A* or Reeds–Shepp arrive with it`, 'warn');
  }
  const hErr = posed ? Math.abs(wrap(e.th - wp.th)) : 0,
    headOK = !posed || hErr < (isCar() ? 0.2 : ALIGN_TOL);
  const legDone = !isCar() || !S.track || S.track.total - project(e.x, e.y, true).s < 0.08;
  const near = hyp(e.x - wp.x, e.y - wp.y) < (posed && isCar() ? 0.2 : ARRIVE);
  if (posed && !isCar() && lastSeg && near && !headOK && !F.align) {
    F.align = true;
    F.prog = {t: S.t, x: e.x, y: e.y};
    logE(`At goal ${wpLabel(F.queue[0])}: turning in place to ${deg(wp.th).toFixed(0)}° (${deg(hErr).toFixed(0)}° to go)`);
  }
  if (F.align && (!near || !posed)) {
    F.align = false;
  }
  if (F.align) {
    if (!headOK) return;
  }
  if (lastSeg && headOK && legDone && near) {
    F.align = false;
    const te = hyp(S.robot.x - wp.x, S.robot.y - wp.y),
      he = posed ? Math.abs(deg(wrap(S.robot.th - wp.th))) : 0;
    logE(
      `Reached goal ${wpLabel(F.queue[0])} by estimate · true error ${te.toFixed(2)} m${posed ? ` · ${he.toFixed(0)}°` : ''}`,
      te > 0.5 || he > 20 ? 'warn' : 'ok'
    );
    wp.done = true;
    F.queue.shift();
    F.stuckN = 0;
    S.ctlState = {I: 0, prev: null};
    if (F.queue.length || exploreMore()) {
      F.state = 'PLAN';
      F.pendingReason = 'initial';
    } else {
      F.state = 'DONE';
      S.track = null;
      S.plan = null;
      logE(exploring() ? `Exploration complete in ${S.t.toFixed(1)} s` : `Mission complete in ${S.t.toFixed(1)} s`, 'ok');
    }
    return;
  }
  // the estimate is far from the path (kidnapped, relocalized, pushed aside): plan again from where the robot is now
  if (S.t - F.lastPlanT > 0.5 && project(e.x, e.y, true).d > OFFPATH) {
    F.state = 'PLAN';
    F.pendingReason = 'off path';
    return;
  }
  if (P.replan > 0 && S.t - F.lastPlanT >= P.replan) {
    F.state = 'PLAN';
    F.pendingReason = 'periodic';
    return;
  }
  if (P.plan === 'hybrid' && isCar() && S.t - F.lastBlockT > 0.5) {
    // footprint check of the remaining legs (poses carry heading)
    F.lastBlockT = S.t;
    const pr = project(e.x, e.y, true);
    let trav = 0,
      first = true;
    for (let gi = S.segIdx; gi < S.plan.segs.length && trav < 6; gi++) {
      const pts = S.plan.segs[gi].pts;
      for (let i = gi === S.segIdx ? pr.i + 2 : 1; i < pts.length && trav < 6; i++) {
        trav += hyp(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        const c = fpClear(pts[i][0], pts[i][1], pts[i][2], S.cm.dist);
        if (c < 0 && first) continue;
        first = false;
        if (c < 0) {
          F.state = 'PLAN';
          F.pendingReason = 'path blocked';
          return;
        }
      }
    }
  } else if (P.plan !== 'straight' && P.plan !== 'rs' && S.t - F.lastBlockT > 0.5) {
    F.lastBlockT = S.t;
    const pr = project(e.x, e.y, true);
    let exiting = true;
    for (let s = pr.s + 0.2; s < Math.min(S.track.total, pr.s + 6); s += 0.1) {
      const p = pointAt(s),
        k = cellIdx(p[0], p[1]);
      const bad = k >= 0 && S.cm.lethal[k];
      if (bad && exiting) continue;
      exiting = false;
      if (bad) {
        F.state = 'PLAN';
        F.pendingReason = 'path blocked';
        return;
      }
    }
  }
  if (S.t - F.prog.t > 5) {
    if (hyp(e.x - F.prog.x, e.y - F.prog.y) < 0.15) {
      F.stuckN = (F.stuckN || 0) + 1;
      if (F.stuckN >= 3) {
        logE(`Skipping goal ${wpLabel(F.queue[0])}: stuck 3 times`, 'bad');
        const fk = WPS[F.queue[0]].explore ? WPS[F.queue[0]].key : null;
        WPS[F.queue[0]].done = true;
        WPS[F.queue[0]].skipped = true;
        F.queue.shift();
        F.stuckN = 0;
        F.state = F.queue.length || exploreMore(fk) ? 'PLAN' : 'DONE';
        F.pendingReason = 'initial';
        if (!F.queue.length) {
          S.track = null;
          S.plan = null;
        }
      } else {
        F.state = 'PLAN';
        F.pendingReason = 'stuck';
      }
    }
    F.prog = {t: S.t, x: e.x, y: e.y};
  }
}

/* ---- core/controllers.js ---- */
/* ============================================================
   Controllers
   ============================================================ */
function goalDist(pr) {
  const T = S.track,
    g = T.pts[T.pts.length - 1];
  return Math.max(T.total - pr.s, hyp(g[0] - S.est.x, g[1] - S.est.y));
}
const decelCap = d =>
  isCar()
    ? Math.min(Math.sqrt(2 * (P.accel ? P.amax : 0.8) * Math.max(0, d - 0.02)), 0.1 + 0.6 * d) + (d > 0.03 ? 0.04 : 0) // car: linear ramp into each leg end
    : Math.sqrt(2 * (P.accel ? P.amax : 0.8) * Math.max(0, d - 0.08));
// Shared preamble. On a reverse leg the controller works in a virtual frame: heading θ+π, forward speed,
// and the steering sign flipped. For the rear-axle reference point this is exact for the bicycle model.
function kapAt(sArc) {
  const T = S.track;
  if (sArc < 0) return 0;
  sArc = Math.min(sArc, T.total - 1e-3); // hold the final curvature up to the cusp
  let i = T.idx;
  while (i > 0 && T.s[i] > sArc) i--;
  while (i < T.pts.length - 2 && T.s[i + 1] < sArc) i++;
  const t = (sArc - T.s[i]) / (T.s[i + 1] - T.s[i] || 1);
  return T.kv[i] + (T.kv[i + 1] - T.kv[i]) * t;
}
// Rear-wheel feedback (Samson; Paden et al. 2016 §V-A): curvature feedforward + heading and lateral feedback
function ctlRWF() {
  const {e, T, pr, dir, thv} = trackPre(),
    q = pointAt(pr.s),
    i = Math.min(pr.i, T.hd.length - 1),
    thp = T.hd[i];
  const el = Math.cos(thp) * (e.y - q[1]) - Math.sin(thp) * (e.x - q[0]),
    the = wrap(thv - thp); // el > 0: left of path
  const vprev = Math.abs(S.odo.v),
    kmax = isCar() ? Math.tan(steerMax()) / P.wheelbase : 3;
  const k = clamp(kapAt(pr.s + 0.2), -kmax, kmax); // fixed preview covers steering-rate lag
  let kpk = 0;
  for (let ds = 0; ds <= 0.8; ds += 0.2) kpk = Math.max(kpk, Math.abs(kapAt(pr.s + ds)));
  let v = Math.min(P.vcruise, vCap(dir));
  if (kpk > 1e-6) v = Math.min(v, Math.sqrt(P.alat / kpk));
  v = Math.min(v, decelCap(goalDist(pr)));
  const sinc = Math.abs(the) < 1e-4 ? 1 : Math.sin(the) / the;
  const kc = (k * Math.cos(the)) / Math.max(0.3, 1 - k * el) - P.rwKth * the - P.rwKe * sinc * el;
  S.ctlViz = {carrot: q};
  if (isCar()) {
    const dv = clamp(Math.atan(P.wheelbase * kc), -steerMax(), steerMax());
    return {v: dir * v, steer: dir * dv};
  }
  if (Math.abs(the) > Math.PI / 2) return {v: 0, w: -Math.sign(the) * P.wmax * 0.7};
  return {v, w: clamp(v * kc, -P.wmax, P.wmax)};
}
const vCap = dir => (dir > 0 ? P.vmax : Math.min(0.35, 0.5 * P.vmax)); // reverse legs: manoeuvring speed
function trackPre() {
  const e = S.est,
    T = S.track,
    pr = project(e.x, e.y, true);
  T.idx = Math.max(T.idx, pr.i);
  const dir = T.dir || 1;
  return {e, T, pr, dir, thv: dir > 0 ? e.th : wrap(e.th + Math.PI)};
}
function ctlPP() {
  const {e, pr, dir, thv} = trackPre();
  const Ld = Math.max(0.1, P.ppL0 + P.ppK * Math.abs(S.odo.v));
  const c = pointAt(pr.s + Ld, isCar()),
    dx = c[0] - e.x,
    dy = c[1] - e.y,
    L = Math.max(hyp(dx, dy), 1e-3),
    alpha = wrap(Math.atan2(dy, dx) - thv);
  S.ctlViz = {carrot: c};
  if (isCar()) {
    const dm = steerMax(),
      big = Math.abs(alpha) > Math.PI / 2;
    const dv = big ? Math.sign(alpha) * dm : clamp(Math.atan((P.wheelbase * 2 * Math.sin(alpha)) / L), -dm, dm);
    const k = Math.abs(Math.tan(dv)) / P.wheelbase;
    let v = Math.min(P.vcruise, vCap(dir));
    if (k > 1e-6) v = Math.min(v, Math.sqrt(P.alat / k));
    v = Math.min(v, decelCap(goalDist(pr)));
    if (big) v = Math.min(v, 0.2);
    return {v: dir * v, steer: dir * dv};
  }
  if (Math.abs(alpha) > Math.PI / 2) return {v: 0, w: Math.sign(alpha) * P.wmax * 0.7};
  const kap = (2 * Math.sin(alpha)) / L;
  let v = Math.min(P.vcruise, P.vmax);
  if (Math.abs(kap) > 1e-6) v = Math.min(v, Math.sqrt(P.alat / Math.abs(kap)));
  v = Math.min(v, decelCap(goalDist(pr)));
  let w = v * kap;
  if (Math.abs(w) > P.wmax) {
    w = Math.sign(w) * P.wmax;
    v = P.wmax / Math.abs(kap);
  }
  return {v, w};
}
function ctlPID() {
  const {e, pr, dir, thv} = trackPre();
  const Ld = Math.max(0.1, P.ppL0 + P.ppK * Math.abs(S.odo.v));
  const c = pointAt(pr.s + Ld, isCar()),
    err = wrap(Math.atan2(c[1] - e.y, c[0] - e.x) - thv),
    C = S.ctlState;
  S.ctlViz = {carrot: c};
  C.I = clamp(C.I + err * DT, -1, 1);
  const D = C.prev == null ? 0 : wrap(err - C.prev) / DT;
  C.prev = err;
  if (isCar()) {
    const st = clamp(P.kp * err + P.ki * C.I + P.kd * D, -steerMax(), steerMax());
    let v = Math.min(P.vcruise, vCap(dir)) * Math.max(0.3, Math.cos(err) ** 2);
    v = Math.min(v, decelCap(goalDist(pr)));
    return {v: dir * v, steer: dir * st};
  }
  const w = clamp(P.kp * err + P.ki * C.I + P.kd * D, -P.wmax, P.wmax);
  let v = Math.min(P.vcruise, P.vmax) * Math.max(0, Math.cos(err)) ** 2;
  v = Math.min(v, decelCap(goalDist(pr)));
  return {v, w};
}
// Stanley (Hoffmann et al. 2007): front-axle cross-track + heading error. Forward legs only.
function ctlStanley() {
  if (!isCar() || (S.track.dir || 1) < 0) return ctlPP();
  const {e, T, pr} = trackPre(),
    L = P.wheelbase,
    fx = e.x + L * Math.cos(e.th),
    fy = e.y + L * Math.sin(e.th),
    p = T.pts;
  let best = Infinity,
    bx = fx,
    by = fy,
    bth = e.th;
  for (let i = T.idx; i <= Math.min(p.length - 2, T.idx + 80); i++) {
    const a = p[i],
      b = p[i + 1],
      vx = b[0] - a[0],
      vy = b[1] - a[1],
      l2 = vx * vx + vy * vy;
    if (l2 < 1e-12) continue;
    let t = ((fx - a[0]) * vx + (fy - a[1]) * vy) / l2;
    t = i === p.length - 2 ? Math.max(0, t) : clamp(t, 0, 1);
    const qx = a[0] + vx * t,
      qy = a[1] + vy * t,
      d = (fx - qx) ** 2 + (fy - qy) ** 2;
    if (d < best) {
      best = d;
      bx = qx;
      by = qy;
      bth = Math.atan2(vy, vx);
    }
  }
  const eLeft = Math.cos(bth) * (fy - by) - Math.sin(bth) * (fx - bx),
    dm = steerMax();
  const d = clamp(wrap(bth - e.th) - Math.atan2(P.stanK * eLeft, 0.5 + Math.abs(S.odo.v)), -dm, dm);
  S.ctlViz = {carrot: [bx, by], from: [fx, fy]};
  const k = Math.abs(Math.tan(d)) / L;
  let v = Math.min(P.vcruise, P.vmax);
  if (k > 1e-6) v = Math.min(v, Math.sqrt(P.alat / k));
  return {v: Math.min(v, decelCap(goalDist(pr))), steer: d};
}
function ctlDWA() {
  const {e, pr, dir} = trackPre(),
    car = isCar();
  const carrot = pointAt(pr.s + 1.6, car),
    dg = goalDist(pr);
  const A = P.accel ? P.amax : 3,
    AL = P.accel ? P.alpha : 8,
    win = 0.25,
    v0 = dir * S.odo.v,
    w0 = S.odo.w;
  const vtop = Math.min(P.vcruise, vCap(dir), decelCap(dg) + 0.05);
  const vlo = Math.max(0, v0 - A * win),
    vhi = Math.max(vlo, Math.min(vtop, v0 + A * win));
  // second sampled input: ω for diff-drive, steering angle δ for the car
  let wlo, whi;
  if (car) {
    const dm = steerMax(),
      d0 = S.robot.d;
    wlo = Math.max(-dm, d0 - P.steerRate * win);
    whi = Math.min(dm, d0 + P.steerRate * win);
  } else {
    wlo = Math.max(-P.wmax, w0 - AL * win);
    whi = Math.min(P.wmax, w0 + AL * win);
  }
  const pts = ((S.agents && S.agents.staticPts) || S.scanPts).filter(p => hyp(p[0] - e.x, p[1] - e.y) < 4.5),
    ags = agOn() ? agList(4.5 + P.dwaT * 2.5) : [];
  const NV = 7,
    NW = 15,
    hor = P.dwaT,
    sdt = 0.1,
    ns = Math.round(hor / sdt);
  let best = null;
  const trajs = [];
  for (let a = 0; a < NV; a++) {
    const vm = vlo + ((vhi - vlo) * a) / (NV - 1),
      v = dir * vm;
    for (let b = 0; b < NW; b++) {
      const u = wlo + ((whi - wlo) * b) / (NW - 1),
        w = car ? (v * Math.tan(u)) / P.wheelbase : u;
      let x = e.x,
        y = e.y,
        th = e.th,
        clear = Infinity;
      const tp = [x, y];
      for (let k = 0; k < ns; k++) {
        const n = integ(x, y, th, v, w, sdt);
        x = n.x;
        y = n.y;
        th = n.th;
        if (k % 2 === 1) tp.push(x, y);
        for (const [cx, cy, cr] of fpCircles(x, y, th))
          for (const p of pts) {
            const d = hyp(p[0] - cx, p[1] - cy) - cr;
            if (d < clear) clear = d;
          }
        for (const a of ags) {
          const q = agPred(a, (k + 1) * sdt);
          for (const [cx, cy, cr] of fpCircles(x, y, th)) {
            const d = hyp(q[0] - cx, q[1] - cy) - cr - q[2];
            if (d < clear) clear = d;
          }
        }
        if (clear < 0.05) break;
      }
      const ok = clear >= 0.05 && vm <= Math.sqrt(2 * A * Math.max(0, clear)) + 1e-3;
      let cost = Infinity;
      if (ok) {
        const thv = dir > 0 ? th : th + Math.PI,
          dgoal = hyp(carrot[0] - x, carrot[1] - y),
          head = Math.abs(wrap(Math.atan2(carrot[1] - y, carrot[0] - x) - thv));
        cost = P.dwaG * (dgoal + 0.3 * head) + P.dwaO * (1 / Math.min(Math.max(clear, 0.05), 3)) + P.dwaV * (vtop - vm);
        if (!best || cost < best.cost) best = {v, u, cost, i: trajs.length};
      }
      trajs.push({pts: tp, ok});
    }
  }
  S.ctlViz = {carrot, trajs, best: best ? best.i : -1};
  if (!best) {
    if (car) return {v: 0, steer: S.robot.d};
    const a = wrap(Math.atan2(carrot[1] - e.y, carrot[0] - e.x) - e.th);
    return {v: 0, w: Math.sign(a || 1) * Math.min(0.6, P.wmax)};
  }
  return car ? {v: best.v, steer: best.u} : {v: best.v, w: best.u};
}
/* ============================================================
   Model predictive control
   Gauss–Newton SQP on the condensed (single-shooting) problem.
   NMPC: relinearize about the latest nonlinear rollout every iteration.
   LTV:  linearize once about the reference and predict with that linear model.
   Inputs are actuator rates, so input bounds are exact (box QP);
   state constraints use augmented-Lagrangian penalties.
   ============================================================ */
// State x = [x, y, θ, v, s, (v_cmd, s_cmd)], s = δ (car) or ω (diff); input u = [a, ṡ]

/* ---- core/mpc.js ---- */
function mpcModel() {
  const car = isCar(),
    L = P.wheelbase,
    lag = P.mpcLag && P.lag > 0,
    tau = P.lag,
    sMax = car ? steerMax() : P.wmax;
  const dyn = mpcTyres(),
    iy = lag ? 7 : 5; // tyre model: v_y and r appended after the other states
  const sat = s => clamp(s, -sMax, sMax); // the actuator saturates; the model does too
  const G = dyn ? mpcDynGeom() : null;
  const f = (x, u, dt) => {
    const v = x[3],
      s = x[4],
      w = car ? (v * Math.tan(s)) / L : s,
      thm = x[2] + 0.5 * w * dt;
    const o = dyn ? mpcDynPose(x, v, s, dt, G, iy) : [x[0] + v * Math.cos(thm) * dt, x[1] + v * Math.sin(thm) * dt, x[2] + w * dt, 0, 0];
    if (lag) {
      const a = 1 - Math.exp(-dt / tau);
      o[3] = v + (x[5] - v) * a;
      o[4] = sat(s + (x[6] - s) * a);
      o[5] = x[5] + u[0] * dt;
      o[6] = sat(x[6] + u[1] * dt);
    } else {
      o[3] = v + u[0] * dt;
      o[4] = sat(s + u[1] * dt);
    }
    return o;
  };
  return {n: iy + (dyn ? 2 : 0), f, car, lag, dyn, iy};
}
// The prediction with tyre slip (P.mpcDyn on the car with tyre slip): the simulator's dynamic bicycle model (dynF in
// vehicle.js: linear tyres clipped at μF_z, the same low-speed blend to the kinematic car), stepped MPC_DSUB times per
// prediction step with one linearly implicit Euler stage (L-stable, so grippy tyres reduce to the kinematic car), and
// the rear axle moved with the new velocities. Speed and steering are held over the step, as in the kinematic model.
const MPC_DSUB = 5,
  mpcTyres = () => isDyn() && !!P.mpcDyn;
function mpcDynGeom() {
  const G = dynGeom();
  G.ff = (P.mu * G.m * GRAV * G.lr) / G.L;
  G.fr = (P.mu * G.m * GRAV * G.lf) / G.L;
  return G;
}
function mpcDynPose(x, vx, de, dt, G, iy) {
  G.td = Math.tan(de);
  const h = dt / MPC_DSUB,
    rk = (vx * G.td) / G.L,
    yk = G.lr * rk,
    wB = clamp((Math.abs(vx) - 0.15) / 0.15, 0, 1),
    f0 = [0, 0],
    fa = [0, 0],
    fb = [0, 0];
  let vy = x[iy],
    yr = x[iy + 1],
    px = x[0],
    py = x[1],
    th = x[2];
  for (let i = 0; i < MPC_DSUB; i++) {
    if (wB > 0) {
      dynF(vy, yr, vx, de, G, f0);
      const e1 = 1e-6 * (1 + Math.abs(vy)),
        e2 = 1e-6 * (1 + Math.abs(yr));
      dynF(vy + e1, yr, vx, de, G, fa);
      dynF(vy, yr + e2, vx, de, G, fb);
      const m11 = 1 - (h * (fa[0] - f0[0])) / e1,
        m12 = (-h * (fb[0] - f0[0])) / e2,
        m21 = (-h * (fa[1] - f0[1])) / e1,
        m22 = 1 - (h * (fb[1] - f0[1])) / e2,
        d = m11 * m22 - m12 * m21;
      vy += (h * (m22 * f0[0] - m12 * f0[1])) / d;
      yr += (h * (m11 * f0[1] - m21 * f0[0])) / d;
      if (wB < 1) {
        vy = wB * vy + (1 - wB) * yk;
        yr = wB * yr + (1 - wB) * rk;
      }
    } else {
      vy = yk;
      yr = rk;
    }
    const tm = th + 0.5 * yr * h,
      ly = vy - G.lr * yr,
      c = Math.cos(tm),
      sn = Math.sin(tm);
    px += (vx * c - ly * sn) * h;
    py += (vx * sn + ly * c) * h;
    th += yr * h;
  }
  const o = [px, py, th, 0, 0];
  o[iy] = vy;
  o[iy + 1] = yr;
  return o;
}
// Central-difference Jacobians A = ∂f/∂x, B = ∂f/∂u. Not forward differences: the steering state saturates at ±s_max, and a
// forward step from +s_max is clipped, which reads as zero sensitivity to steering at full left lock (the solver then cannot unwind it)
function mpcJac(M, x, u, dt) {
  const n = M.n,
    f0 = M.f(x, u, dt),
    A = new Float64Array(n * n),
    B = new Float64Array(n * 2),
    h = 1e-6;
  for (let j = 0; j < n; j++) {
    const xp = x.slice(),
      xm = x.slice();
    xp[j] += h;
    xm[j] -= h;
    const fp = M.f(xp, u, dt),
      fm = M.f(xm, u, dt);
    for (let i = 0; i < n; i++) A[i * n + j] = (fp[i] - fm[i]) / (2 * h);
  }
  for (let j = 0; j < 2; j++) {
    const up = u.slice(),
      um = u.slice();
    up[j] += h;
    um[j] -= h;
    const fp = M.f(x, up, dt),
      fm = M.f(x, um, dt);
    for (let i = 0; i < n; i++) B[i * 2 + j] = (fp[i] - fm[i]) / (2 * h);
  }
  return {f0, A, B};
}
function cholSolve(A, b, n) {
  const L = new Float64Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = A[i * n + j];
      for (let k = 0; k < j; k++) s -= L[i * n + k] * L[j * n + k];
      if (i === j) L[i * n + i] = Math.sqrt(Math.max(s, 1e-12));
      else L[i * n + j] = s / L[j * n + j];
    }
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = b[i];
    for (let k = 0; k < i; k++) s -= L[i * n + k] * y[k];
    y[i] = s / L[i * n + i];
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let k = i + 1; k < n; k++) s -= L[k * n + i] * x[k];
    x[i] = s / L[i * n + i];
  }
  return x;
}
// min ½zᵀHz + gᵀz  s.t. lo ≤ z ≤ hi   (projected Newton, Bertsekas 1982)
function boxQP(H, g, lo, hi, n) {
  const z = new Float64Array(n);
  for (let i = 0; i < n; i++) z[i] = clamp(0, lo[i], hi[i]);
  const q = w => {
    let v = 0;
    for (let i = 0; i < n; i++) {
      let hz = 0;
      for (let j = 0; j < n; j++) hz += H[i * n + j] * w[j];
      v += w[i] * (0.5 * hz + g[i]);
    }
    return v;
  };
  let fz = q(z);
  for (let it = 0; it < 40; it++) {
    const gr = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let s = g[i];
      for (let j = 0; j < n; j++) s += H[i * n + j] * z[j];
      gr[i] = s;
    }
    const fr = [];
    for (let i = 0; i < n; i++) {
      if (!((z[i] <= lo[i] + 1e-9 && gr[i] > 0) || (z[i] >= hi[i] - 1e-9 && gr[i] < 0))) fr.push(i);
    }
    if (!fr.length) break;
    const m = fr.length,
      Hf = new Float64Array(m * m),
      bf = new Float64Array(m);
    for (let a = 0; a < m; a++) {
      bf[a] = -gr[fr[a]];
      for (let b = 0; b < m; b++) Hf[a * m + b] = H[fr[a] * n + fr[b]];
    }
    const d = cholSolve(Hf, bf, m);
    let dm = 0;
    for (let a = 0; a < m; a++) dm = Math.max(dm, Math.abs(d[a]));
    if (dm < 1e-9) break;
    let al = 1,
      ok = false;
    while (al > 1e-4) {
      const zn = z.slice();
      for (let a = 0; a < m; a++) {
        const i = fr[a];
        zn[i] = clamp(z[i] + al * d[a], lo[i], hi[i]);
      }
      const fn = q(zn);
      if (fn < fz - 1e-12) {
        z.set(zn);
        fz = fn;
        ok = true;
        break;
      }
      al *= 0.5;
    }
    if (!ok) break;
  }
  return z;
}
function segAt(sArc) {
  const T = S.track;
  sArc = clamp(sArc, 0, T.total);
  let i = Math.min(T.idx, T.pts.length - 2);
  while (i > 0 && T.s[i] > sArc) i--;
  while (i < T.pts.length - 2 && T.s[i + 1] < sArc) i++;
  return i;
}
// Time-parametrized reference along the current leg, using the same speed profile as the other trackers.
// With speed planning on and agents in play, s(t) and v(t) come from the ST profile instead, so the reference yields:
// otherwise the tracking cost pulls the robot along at v_ref into people and only the agent constraints push back.
function mpcReference(Np, dt) {
  const {T, pr, dir} = trackPre(),
    ref = []; // also advances the path-progress index
  const vAt = s => {
    let v = Math.min(P.vcruise, vCap(dir)),
      kp = 0;
    for (let d = 0; d <= 0.6; d += 0.2) kp = Math.max(kp, Math.abs(kapAt(s + d)));
    if (kp > 1e-6) v = Math.min(v, Math.sqrt(P.alat / kp));
    return Math.min(v, decelCap(T.total - s));
  };
  const st = S.agents && S.agents.st,
    useST = stActive() && st && st.prof && st.inter && st.pathId === S.pathId && st.seg === S.segIdx;
  const pAt = (t, c) => {
    const q = st.prof,
      f = clamp(t / st.dt, 0, st.nt),
      i = Math.min(Math.floor(f), st.nt - 1),
      w = f - i;
    return q[i][c] * (1 - w) + q[i + 1][c] * w;
  }; // ST profile column c (1: s, 2: v) at time t after it was planned
  const age = useST ? S.t - st.t : 0,
    s0 = useST ? pAt(age, 1) : 0;
  let s = pr.s;
  for (let k = 0; k <= Np; k++) {
    if (useST) s = Math.min(T.total, pr.s + pAt(age + k * dt, 1) - s0);
    const p = pointAt(s),
      hd = T.hd[segAt(s)],
      v = useST ? pAt(age + k * dt, 2) : vAt(s);
    ref.push({x: p[0], y: p[1], hd, th: dir > 0 ? hd : wrap(hd + Math.PI), v: dir * v, kap: kapAt(s)});
    if (!useST) s = Math.min(T.total, s + v * dt);
  }
  return {ref, dir};
}
// The MPC controller: reference, bounds, constraints (lidar, agents), warm start, then Gauss–Newton SQP with a box QP
// and a line search within the time budget; the command is returned in Δu form (see the notes at the top of the file).
function ctlMPC() {
  const t0 = performance.now(),
    M = mpcModel(),
    n = M.n,
    car = M.car,
    ltv = P.mpcMode === 'ltv';
  const Np = Math.round(P.mpcNp),
    Nc = Math.max(1, Math.min(Math.round(P.mpcNc), Np)),
    dt = P.mpcDt,
    nU = 2 * Nc;
  const {ref, dir} = mpcReference(Np, dt),
    e = S.est;
  const x0 = [e.x, e.y, e.th, S.odo.v, car ? S.robot.d : S.odo.w];
  // Δu form: build on this controller's own last command when it ran on the previous tick;
  // after any interruption (replan tick, controller switch) start again from the measured actuator state
  const LC = S.mpcCmd && S.mpcCmd.tick === S.tick - 1 ? S.mpcCmd : {v: S.odo.v, steer: S.robot.d, w: S.odo.w};
  if (M.lag) x0.push(LC.v || 0, car ? LC.steer || 0 : LC.w || 0);
  if (M.dyn) x0.push(S.robot.vy || 0, S.robot.r || 0); // v_y and r as a gyro and a sideslip estimator would give them (here: the true values)
  // reference states (θ unwrapped next to the robot) and the inputs that would produce them
  const Xr = [],
    Ur = [];
  let thp = x0[2];
  for (let k = 0; k <= Np; k++) {
    const th = thp + wrap(ref[k].th - thp);
    thp = th;
    const sr = car ? dir * Math.atan(P.wheelbase * ref[k].kap) : ref[k].v * ref[k].kap;
    const xr = [ref[k].x, ref[k].y, th, ref[k].v, sr];
    if (M.lag) xr.push(xr[3], xr[4]);
    if (M.dyn) {
      const rr = (ref[k].v * Math.tan(sr)) / P.wheelbase;
      xr.push(dynGeom().lr * rr, rr);
    } // no slip on the reference
    Xr.push(xr);
  }
  for (let k = 0; k < Np; k++) Ur.push([(Xr[k + 1][3] - Xr[k][3]) / dt, (Xr[k + 1][4] - Xr[k][4]) / dt]);
  // bounds and constraints
  const aMax = P.accel ? P.amax : 3,
    rMax = car ? P.steerRate : P.accel ? P.alpha : 8;
  const vMax = car ? vCap(dir) : P.vmax,
    sMax = car ? steerMax() : P.wmax,
    rho = P.mpcRho;
  const obs = P.mpcObs && !ltv,
    offs = car ? [0, 1, 2].map(i => -CAR.rear + (carLen() / 3) * (i + 0.5)) : [0],
    rc = car ? Math.hypot(carLen() / 6, CAR.width / 2) : RR;
  const agM = obs && agOn(),
    nc = 4 + (obs ? offs.length * (agM ? 2 : 1) : 0),
    ags = agM ? agList(14) : []; // the speed planner's range: the hold window reaches T_p + 3 s ahead
  const pts = obs
    ? ((S.agents && S.agents.staticPts) || S.scanPts).filter(p => hyp(p[0] - e.x, p[1] - e.y) < Np * dt * Math.max(vMax, 0.3) + 1.5)
    : [];
  const QA = mpcAgentPredictions(agM, ags, Np, dt);
  const {agCons, brk} = mpcAgentConstraints(agM, QA, offs, rc, x0, M, aMax, Np, dt);
  // warm start: shift the previous solution by one sim tick
  const sig = `${P.mpcMode}|${Np}|${Nc}|${dt}|${n}|${nc}|${P.model}|${M.dyn}|${S.pathId}`;
  const W = mpcWarmStart(sig, Np, Nc, nc, nU, Ur, dt);
  const ulo = j => (j % 2 ? -rMax : -aMax),
    uhi = j => (j % 2 ? rMax : aMax);
  let U = W.U.map((u, j) => clamp(u, ulo(j), uhi(j)));
  const uk = (U, k) => {
    const j = Math.min(k, Nc - 1);
    return [U[2 * j], U[2 * j + 1]];
  };
  const ABr = ltv ? mpcLinearize(M, Xr, Ur, Np, dt) : null;
  const rollout = U => mpcRollout(U, x0, M, ltv, Np, dt, uk, ABr, Xr, Ur, n);
  const cons = mpcConstraintFn(dir, vMax, sMax, obs, offs, pts, rc, agM, agCons, brk);
  // residuals of step k (1..Np) as [r, grad over state]; inputs handled separately
  const sq = Math.sqrt,
    lamOf = (k, c) => W.lam[(k - 1) * nc + c];
  const stateRes = (k, x) => {
    const R = ref[k],
      w = k === Np ? P.mpcQf : 1,
      c = Math.cos(R.hd),
      s = Math.sin(R.hd),
      ex = x[0] - R.x,
      ey = x[1] - R.y,
      out = [];
    const a = sq(w * P.mpcQlon),
      b = sq(w * P.mpcQlat),
      t = sq(w * P.mpcQth),
      q = sq(w * P.mpcQv);
    out.push(
      [a * (c * ex + s * ey), [a * c, a * s, 0, 0, 0]],
      [b * (-s * ex + c * ey), [-b * s, b * c, 0, 0, 0]],
      [t * wrap(x[2] - Xr[k][2]), [0, 0, t, 0, 0]],
      [q * (x[3] - R.v), [0, 0, 0, q, 0]]
    );
    cons(k, x).forEach(([cv, g], ci) => {
      const z = cv + lamOf(k, ci) / rho;
      if (z > 0) {
        const f = sq(rho / 2);
        out.push([f * z, g.map(v => v * f)]);
      }
    });
    return out;
  };
  const inRes = (U, k) => {
    const u = uk(U, k),
      out = [[sq(P.mpcRa) * u[0]], [sq(P.mpcRs) * u[1]]];
    if (k < Nc) {
      const p = k === 0 ? W.uPrev : uk(U, k - 1);
      out.push([sq(P.mpcRd) * (u[0] - p[0])], [sq(P.mpcRd) * (u[1] - p[1])]);
    }
    return out;
  };
  const cost = (X, U) => {
    let J = 0;
    for (let k = 1; k <= Np; k++) for (const [r] of stateRes(k, X[k])) J += r * r;
    for (let k = 0; k < Np; k++) for (const [r] of inRes(U, k)) J += r * r;
    return J;
  };
  let X = rollout(U),
    J = cost(X, U),
    it = 0;
  const iters = ltv ? 2 : Math.round(P.mpcIt);
  for (; it < iters; it++) {
    if (performance.now() - t0 > 15) break; // real-time budget
    const AB = ltv ? ABr : X.slice(0, Np).map((x, k) => mpcJac(M, x, uk(U, k), dt));
    // Gauss–Newton: H = JᵀJ, g = Jᵀr, with sensitivities S_k = ∂x_k/∂U (move blocking after Nc)
    const H = new Float64Array(nU * nU),
      g = new Float64Array(nU);
    const addRow = (row, r) => {
      for (let a = 0; a < nU; a++) {
        const ra = row[a];
        if (ra === 0) continue;
        g[a] += ra * r;
        for (let b = 0; b < nU; b++) H[a * nU + b] += ra * row[b];
      }
    };
    let Sk = new Float64Array(n * nU);
    for (let k = 0; k < Np; k++) {
      const {A, B} = AB[k],
        j = Math.min(k, Nc - 1),
        Sn = new Float64Array(n * nU);
      for (let i = 0; i < n; i++) {
        for (let c = 0; c < nU; c++) {
          let s = 0;
          for (let m = 0; m < n; m++) s += A[i * n + m] * Sk[m * nU + c];
          Sn[i * nU + c] = s;
        }
        Sn[i * nU + 2 * j] += B[i * 2];
        Sn[i * nU + 2 * j + 1] += B[i * 2 + 1];
      }
      Sk = Sn;
      for (const [r, gr] of stateRes(k + 1, X[k + 1])) {
        const row = new Float64Array(nU);
        for (let m = 0; m < 5; m++) {
          if (gr[m] === 0) continue;
          for (let c = 0; c < nU; c++) row[c] += gr[m] * Sk[m * nU + c];
        }
        addRow(row, r);
      }
      const ir = inRes(U, k);
      for (let q = 0; q < ir.length; q++) {
        const row = new Float64Array(nU),
          ch = q % 2,
          f = q < 2 ? (q ? sq(P.mpcRs) : sq(P.mpcRa)) : sq(P.mpcRd);
        row[2 * j + ch] = f;
        if (q >= 2 && k > 0) row[2 * (k - 1) + ch] = -f;
        addRow(row, ir[q][0]);
      }
    }
    for (let i = 0; i < nU; i++) H[i * nU + i] += 1e-6 + 1e-4 * H[i * nU + i];
    const lo = new Float64Array(nU),
      hi = new Float64Array(nU);
    for (let i = 0; i < nU; i++) {
      lo[i] = ulo(i) - U[i];
      hi[i] = uhi(i) - U[i];
    }
    const dU = boxQP(H, g, lo, hi, nU);
    let al = 1,
      acc = false;
    while (al >= 0.1) {
      const Un = U.map((u, i) => u + al * dU[i]),
        Xn = rollout(Un),
        Jn = cost(Xn, Un);
      if (Jn < J) {
        U = Un;
        X = Xn;
        J = Jn;
        acc = true;
        break;
      }
      al *= 0.5;
    }
    // augmented-Lagrangian multiplier update
    for (let k = 1; k <= Np; k++)
      cons(k, X[k]).forEach(([cv], ci) => {
        const i = (k - 1) * nc + ci;
        W.lam[i] = Math.max(0, W.lam[i] + rho * cv);
      });
    J = cost(X, U);
    if (!acc) break;
  }
  W.U = U;
  const u0 = uk(U, 0);
  W.uPrev = u0;
  let viol = 0;
  for (let k = 1; k <= Np; k++) for (const [cv] of cons(k, X[k])) viol = Math.max(viol, cv);
  // what the chosen inputs really do (nonlinear), drawn next to the LTV prediction
  let Xtrue = X;
  if (ltv) {
    Xtrue = [x0.slice()];
    for (let k = 0; k < Np; k++) Xtrue.push(M.f(Xtrue[k], uk(U, k), dt));
  }
  S.ctlViz = {pred: Xtrue.map(x => [x[0], x[1]]), lin: ltv ? X.map(x => [x[0], x[1]]) : null, ref: ref.map(r => [r.x, r.y])};
  S.mpcStats = {ms: performance.now() - t0, it, J, viol, mode: ltv ? 'LTV' : 'NMPC', Np, Nc};
  const bv = LC.v || 0,
    bs = car ? LC.steer || 0 : LC.w || 0,
    vc = bv + u0[0] * DT,
    sc = bs + u0[1] * DT; // u = u_prev + u̇·T
  S.mpcCmd = {v: vc, steer: car ? clamp(sc, -steerMax(), steerMax()) : 0, w: car ? 0 : clamp(sc, -P.wmax, P.wmax), tick: S.tick};
  return car ? {v: vc, steer: sc} : {v: vc, w: sc};
}

// Predicted agents at each step of the horizon (null when agents are not constrained). The prediction ends at Np·dt, but
// the robot does not vanish there: at the end of a leg (a cusp, a goal) it stops and waits, so the terminal state must
// also stay clear while it waits, out to the speed planner's window T_p + 3 s, with the radius growth frozen at the
// horizon (the same terminal test as stPlan).
function mpcAgentPredictions(agM, ags, Np, dt) {
  if (!agM) return null;
  const tN = Np * dt,
    QA = Array.from({length: Np + 1}, (_, k) => ags.map(a => agPred(a, k * dt)));
  for (const a of ags) {
    const r = agPred(a, tN)[2];
    for (let tt = tN + 0.5; tt <= Math.max(P.agT, tN) + 3 + 1e-6; tt += 0.5) {
      const q = agPred(a, tt);
      QA[Np].push([q[0], q[1], r]);
    }
  }
  return QA;
}

// The agent constraints: clearance to the nearest predicted agent for footprint circle o at step k, as c ≤ 0 with its
// gradient (agCons), and the passive-safety relaxation brk[k][o]: what braking to a stop now (and waiting) would violate.
// The robot answers for the clearance it can still control: a person may walk into it whatever it does, so braking
// always satisfies the relaxed constraints, the problem stays feasible, and the multipliers cannot wind up.
function mpcAgentConstraints(agM, QA, offs, rc, x0, M, aMax, Np, dt) {
  const agCons = (k, x, o) => {
    const c = Math.cos(x[2]),
      sn = Math.sin(x[2]),
      cx = x[0] + o * c,
      cy = x[1] + o * sn;
    let bd = Infinity,
      bq = null;
    for (const q of QA[k]) {
      const d = hyp(q[0] - cx, q[1] - cy) - q[2];
      if (d < bd) {
        bd = d;
        bq = q;
      }
    }
    if (!bq) return [-1, [0, 0, 0, 0, 0]];
    const d = Math.max(hyp(cx - bq[0], cy - bq[1]), 1e-6),
      ux = (cx - bq[0]) / d,
      uy = (cy - bq[1]) / d;
    return [rc + bq[2] + P.mpcMarg - d, [-ux, -uy, -(ux * (-o * sn) + uy * (o * c)), 0, 0]];
  };
  const brk = [];
  if (agM) {
    let xb = x0.slice();
    for (let k = 0; k <= Np; k++) {
      if (k) xb = M.f(xb, [clamp(-(M.lag ? xb[5] : xb[3]) / dt, -aMax, aMax), 0], dt);
      brk.push(offs.map(o => Math.max(0, agCons(k, xb, o)[0])));
    }
  }
  return {agCons, brk};
}

// Warm start: the previous solution shifted by one sim tick (a new signature starts from the reference inputs)
function mpcWarmStart(sig, Np, Nc, nc, nU, Ur, dt) {
  let W = S.mpc;
  if (!W || W.sig !== sig) {
    W = S.mpc = {sig, U: new Float64Array(nU), lam: new Float64Array(Np * nc), uPrev: [0, 0]};
    for (let j = 0; j < Nc; j++) {
      W.U[2 * j] = Ur[j][0];
      W.U[2 * j + 1] = Ur[j][1];
    }
  } else {
    const sh = DT / dt,
      U = W.U,
      Un = new Float64Array(nU),
      ln = new Float64Array(Np * nc);
    for (let j = 0; j < Nc; j++) {
      const p = Math.min(j + sh, Nc - 1),
        j0 = Math.floor(p),
        j1 = Math.min(j0 + 1, Nc - 1),
        f = p - j0;
      for (let c = 0; c < 2; c++) Un[2 * j + c] = U[2 * j0 + c] * (1 - f) + U[2 * j1 + c] * f;
    }
    for (let k = 0; k < Np; k++) {
      const kk = Math.min(Np - 1, Math.round(k + sh));
      for (let c = 0; c < nc; c++) ln[k * nc + c] = W.lam[kk * nc + c];
    }
    W.U = Un;
    W.lam = ln;
  }
  return W;
}

// LTV: Jacobians and defects along the reference, computed once per tick
function mpcLinearize(M, Xr, Ur, Np, dt) {
  const ABr = [];
  for (let k = 0; k < Np; k++) {
    const J = mpcJac(M, Xr[k], Ur[k], dt);
    ABr.push({A: J.A, B: J.B, d: J.f0.map((v, i) => v - Xr[k + 1][i])});
  }
  return ABr;
}

// The predicted states for inputs U: the nonlinear model (NMPC) or the linearized one about the reference (LTV)
function mpcRollout(U, x0, M, ltv, Np, dt, uk, ABr, Xr, Ur, n) {
  const X = [x0.slice()];
  if (!ltv) {
    for (let k = 0; k < Np; k++) X.push(M.f(X[k], uk(U, k), dt));
    return X;
  }
  let dx = x0.map((v, i) => v - Xr[0][i]);
  for (let k = 0; k < Np; k++) {
    const {A, B, d} = ABr[k],
      u = uk(U, k),
      du = [u[0] - Ur[k][0], u[1] - Ur[k][1]],
      nx = new Array(n);
    for (let i = 0; i < n; i++) {
      let s = d[i] + B[i * 2] * du[0] + B[i * 2 + 1] * du[1];
      for (let m = 0; m < n; m++) s += A[i * n + m] * dx[m];
      nx[i] = s;
    }
    dx = nx;
    X.push(dx.map((v, i) => v + Xr[k + 1][i]));
  }
  return X;
}

// Constraint values c ≤ 0 and their gradients with respect to the state at step k: speed sign and limit, steering (or
// turn rate) limit, and with obstacle constraints the lidar clearance per footprint circle and the relaxed agent clearance
function mpcConstraintFn(dir, vMax, sMax, obs, offs, pts, rc, agM, agCons, brk) {
  return (k, x) => {
    const v = x[3],
      s = x[4],
      out = [];
    out.push(dir > 0 ? [-v, [0, 0, 0, -1, 0]] : [v, [0, 0, 0, 1, 0]]);
    out.push(dir > 0 ? [v - vMax, [0, 0, 0, 1, 0]] : [-v - vMax, [0, 0, 0, -1, 0]]);
    out.push([s - sMax, [0, 0, 0, 0, 1]], [-s - sMax, [0, 0, 0, 0, -1]]);
    if (obs) {
      const c = Math.cos(x[2]),
        sn = Math.sin(x[2]);
      for (const o of offs) {
        const cx = x[0] + o * c,
          cy = x[1] + o * sn;
        let bd = Infinity,
          bp = null;
        for (const p of pts) {
          const d = (p[0] - cx) ** 2 + (p[1] - cy) ** 2;
          if (d < bd) {
            bd = d;
            bp = p;
          }
        }
        if (!bp) {
          out.push([-1, [0, 0, 0, 0, 0]]);
          continue;
        }
        const d = Math.max(Math.sqrt(bd), 1e-6),
          ux = (cx - bp[0]) / d,
          uy = (cy - bp[1]) / d;
        out.push([rc + P.mpcMarg - d, [-ux, -uy, -(ux * (-o * sn) + uy * (o * c)), 0, 0]]);
      }
      if (agM)
        offs.forEach((o, oi) => {
          const [cv, g] = agCons(k, x, o);
          out.push([cv - brk[k][oi], g]);
        });
    }
    return out;
  };
}

/* ---- core/dispatch.js ---- */
function builtinCmd() {
  const c = builtinRaw();
  // car: hold speed until the wheels have turned close to the commanded angle (dry steering at cusps)
  if (isCar() && c.steer != null && P.ctl !== 'mpc') {
    const de = Math.abs(c.steer - S.robot.d);
    if (de > 0.1) c.v *= clamp(1 - (de - 0.1) / 0.25, 0, 1);
  }
  return lidarGuard(agSpeedCap(c));
}
// Lidar safety stop for the path trackers (P.guard), like a robot's collision monitor: they follow the path and never read
// the lidar, so a wall the map has wrong (drift, a late scan) or a corner cut on the swing round it is hit side-on.
// Sweep the footprint along the commanded arc against this scan's points (placed with the estimate, so their positions
// relative to the robot are as measured) and cap the speed at what stops before the first point closer than MARGIN
// that the arc approaches. DWA and MPC check the scan themselves.
const GUARD_CTL = ['pp', 'pid', 'stanley', 'rwf'],
  GUARD_MARG = 0.05;
function lidarGuard(c) {
  S.guard = null;
  if (!P.guard || !GUARD_CTL.includes(P.ctl) || S.fsm.state !== 'DRIVE' || !S.track) return c;
  const v = c.v || 0,
    sp = Math.abs(v);
  if (sp < 1e-3) return c;
  const e = S.est,
    A = P.accel ? P.amax : 0.8,
    D = Math.min(3, (sp * sp) / (2 * A) + 0.4),
    pts = S.scanPts.filter(p => hyp(p[0] - e.x, p[1] - e.y) < D + 1);
  if (!pts.length) return c;
  const k = isCar() ? Math.tan(c.steer != null ? c.steer : 0) / P.wheelbase : (c.w || 0) / v; // curvature per metre driven (signed with v)
  const clear = (x, y, th) => {
    let m = Infinity;
    for (const [cx, cy, r] of fpCircles(x, y, th))
      for (const p of pts) {
        const d = hyp(p[0] - cx, p[1] - cy) - r;
        if (d < m) m = d;
      }
    return m;
  };
  const c0 = clear(e.x, e.y, e.th),
    dir = Math.sign(v);
  let x = e.x,
    y = e.y,
    th = e.th,
    free = D;
  for (let s = 0.05; s <= D + 1e-9; s += 0.05) {
    const n = integ(x, y, th, dir, dir * k, 0.05);
    x = n.x;
    y = n.y;
    th = n.th;
    const cl = clear(x, y, th);
    if (cl < GUARD_MARG && cl < c0 - 0.005) {
      free = s - 0.05;
      break;
    }
  }
  const vm = Math.sqrt(2 * A * Math.max(0, free - 0.05));
  if (sp <= vm) return c;
  const f = vm / sp;
  S.guard = {free, v: vm};
  if (!S.guardLogT || S.t - S.guardLogT > 3) {
    S.guardLogT = S.t;
    logE(`Safety stop: lidar points ${free.toFixed(2)} m ahead on the commanded arc · speed capped at ${vm.toFixed(2)} m/s`, 'warn');
  }
  const o = {...c, v: v * f};
  if (!isCar() && o.w != null) o.w = c.w * f;
  return o;
}
// At a goal with a heading (unicycle): stop and turn in place, proportional on the heading error, within the turn-rate limit
function alignCmd() {
  const wp = WPS[S.fsm.queue[0]],
    err = wp && wp.th != null ? wrap(wp.th - S.est.th) : 0;
  S.ctlViz = null;
  const wm = Math.min(P.wmax, 1.5);
  return {v: 0, w: Math.sign(err) * clamp(2.5 * Math.abs(err), 0.15, wm)};
}
function builtinRaw() {
  if (S.fsm.state === 'LOST') {
    S.ctlViz = null;
    return {v: 0, w: Math.min(0.6, P.wmax)};
  }
  if (S.fsm.state !== 'DRIVE' || !S.track) {
    S.ctlViz = null;
    return {v: 0, w: 0};
  }
  if (S.fsm.align) return alignCmd();
  if (P.ctl === 'pp') return ctlPP();
  if (P.ctl === 'pid') return ctlPID();
  if (P.ctl === 'dwa') return ctlDWA();
  if (P.ctl === 'stanley') return ctlStanley();
  if (P.ctl === 'rwf') return ctlRWF();
  if (P.ctl === 'mpc') return ctlMPC();
  return {v: 0, w: 0};
}

/* ---- core/custom-controller.js ---- */
/* ---------- custom controller: user code in a Web Worker, run in lockstep ---------- */
const DEFAULT_CODE = `// Your controller. Called every 50 ms while the robot drives a leg.
// Return { v, w } in m/s and rad/s, or { v, steer } (rad) for the car-like model.
// Add mark: [x, y] to draw a point on the map.
//
// obs.pose   {x, y, th}      estimated pose (not ground truth)
// obs.odom   {v, w}          measured velocity from wheel odometry
// obs.path   [[x, y], ...]   current global path, resampled every 0.1 m
// obs.goal   {x, y}          current goal
// obs.scan   [[x, y], ...]   lidar hits in the world frame (from the estimate)
// obs.agents [{id, x, y, vx, vy, r}]  tracked moving agents (Perceive → Moving agents)
// obs.limits {vmax, wmax, accel, amax, alpha}
// obs.dir                    +1 on a forward leg, -1 on a reverse leg (car paths have cusps)
// obs.vehicle {model, wheelbase, steerMax, steer}   model is 'diff' or 'car'
// obs.pathId                 changes whenever the planner replans or a new leg starts
// obs.t, obs.dt              sim time and step [s]
// mem                        object that persists between calls

function control(obs, mem) {
  const { pose, path, goal, limits } = obs;
  if (mem.pathId !== obs.pathId) { mem.pathId = obs.pathId; mem.i = 0; }

  // 1. closest path index, searching forward from last time
  let best = Infinity;
  const i0 = mem.i;
  for (let i = i0; i < Math.min(path.length, i0 + 60); i++) {
    const d = Math.hypot(path[i][0] - pose.x, path[i][1] - pose.y);
    if (d < best) { best = d; mem.i = i; }
  }

  // 2. carrot: first path point at least L ahead
  const L = 0.8;
  let c = path[path.length - 1];
  for (let i = mem.i; i < path.length; i++) {
    if (Math.hypot(path[i][0] - pose.x, path[i][1] - pose.y) >= L) { c = path[i]; break; }
  }

  // 3. heading error measured against the direction of travel
  const dir = obs.dir;
  const th = dir > 0 ? pose.th : pose.th + Math.PI;
  const a = Math.atan2(c[1] - pose.y, c[0] - pose.x) - th;
  const err = Math.atan2(Math.sin(a), Math.cos(a));

  // 4. slow down when misaligned or near the end of this leg
  const end = path[path.length - 1];
  const dEnd = Math.hypot(end[0] - pose.x, end[1] - pose.y);
  if (obs.vehicle.model === 'car') {
    const speed = Math.min(0.6, 0.8 * dEnd) * Math.max(0.3, Math.cos(err));
    const Lc = Math.max(0.1, Math.hypot(c[0] - pose.x, c[1] - pose.y));
    const steer = Math.atan(obs.vehicle.wheelbase * 2 * Math.sin(err) / Lc);
    return { v: dir * speed, steer: dir * steer, mark: c };
  }
  const v = Math.min(0.7, 0.8 * dEnd) * Math.max(0, Math.cos(err));
  return { v, w: 2.0 * err, mark: c };
}
`;
async function customCmd() {
  if (S.fsm.state === 'LOST') {
    S.ctlViz = null;
    return {v: 0, w: Math.min(0.6, P.wmax)};
  }
  if (S.fsm.state !== 'DRIVE' || !S.track) {
    S.ctlViz = null;
    return {v: 0, w: 0};
  }
  const customWorker = SLOTS.ctl.worker;
  if (!customWorker) {
    slotNotLoaded('ctl');
    return {v: 0, w: 0};
  }
  const e = S.est,
    wp = WPS[S.fsm.queue[0]];
  const obs = {
    t: S.t,
    dt: DT,
    pose: {x: e.x, y: e.y, th: e.th},
    odom: {...S.odo},
    path: S.track.dense,
    goal: {x: wp.x, y: wp.y},
    scan: S.scanPts,
    agents: agList().map(t => ({id: t.id, x: t.x, y: t.y, vx: t.vx, vy: t.vy, r: t.r})),
    limits: {vmax: P.vmax, wmax: P.wmax, accel: P.accel, amax: P.amax, alpha: P.alpha},
    pathId: S.pathId,
    dir: S.track.dir || 1,
    vehicle: {model: P.model, wheelbase: P.wheelbase, steerMax: steerMax(), steer: S.robot.d}
  };
  const r = await customWorker.call(obs);
  if (!r.ok) {
    slotErr('ctl', r.error);
    S.ctlViz = null;
    return {v: 0, w: 0};
  }
  SLOTS.ctl.lastErr = '';
  S.ctlViz = r.mark ? {carrot: r.mark} : null;
  return {v: isFinite(r.v) ? r.v : 0, w: isFinite(r.w) ? r.w : 0, steer: r.steer};
}

/* ---- core/slots.js ---- */
/* ============================================================
   Code slots: user JavaScript for the controller, the global planner, the localizer and the agent predictor.
   Each slot runs in its own Web Worker, called in lockstep with the simulation, with a timeout.
   ============================================================ */
const SLOT_EXAMPLES = {
  plan: `// Your global planner. Called whenever the mission needs a path (initial plan, replans).
// Return { path: [[x, y], ...] } from the start to the goal, or { error: 'reason' } when there is none.
// A car may return { segs: [{ pts: [[x, y, th], ...], dir: +1 | -1 }, ...] } with reverse legs.
//
// obs.start  {x, y, th}      estimated pose
// obs.goal   {x, y, th|null} the goal, heading only for posed goals
// obs.grid   {w, h, res}     the costmap grid: w × h cells of res metres
// obs.lethal Uint8Array      1 where the robot centre may not go (w*h, row-major, cell (i, j) = j*w + i)
// obs.dist   Float32Array    distance to the nearest obstacle per cell [m]
// obs.vehicle {model, wheelbase, steerMax, minTurnR, revOK}
// Budget: 3 s per call. mem persists between calls.

function plan(obs, mem) {
  const { w, h, res } = obs.grid, L = obs.lethal;
  const cell = (x, y) => [Math.floor(x / res), Math.floor(y / res)];
  const [si, sj] = cell(obs.start.x, obs.start.y), [gi, gj] = cell(obs.goal.x, obs.goal.y);
  // 8-connected A* with the octile heuristic
  const g = new Float32Array(w * h).fill(Infinity), par = new Int32Array(w * h).fill(-1), closed = new Uint8Array(w * h);
  const heur = (i, j) => { const dx = Math.abs(i - gi), dy = Math.abs(j - gj); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  const open = [[heur(si, sj), sj * w + si]]; g[sj * w + si] = 0;
  const NB = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
  let found = false, expansions = 0;
  while (open.length) {
    let b = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[b][0]) b = k;   // a heap would be faster
    const [, u] = open.splice(b, 1)[0]; if (closed[u]) continue; closed[u] = 1; expansions++;
    if (u === gj * w + gi) { found = true; break; }
    const ui = u % w, uj = (u / w) | 0;
    for (const [di, dj, c] of NB) { const vi = ui + di, vj = uj + dj; if (vi < 0 || vj < 0 || vi >= w || vj >= h) continue;
      const v = vj * w + vi; if (L[v] || closed[v]) continue;
      if (di && dj && (L[uj * w + vi] || L[vj * w + ui])) continue;           // no corner cutting
      const ng = g[u] + c * (1 + 3 * Math.max(0, 0.6 - obs.dist[v]));         // stay away from walls when it is cheap to
      if (ng < g[v]) { g[v] = ng; par[v] = u; open.push([ng + heur(vi, vj), v]); } }
  }
  if (!found) return { error: 'no path on the grid' };
  const path = []; for (let u = gj * w + gi; u >= 0; u = par[u]) path.push([(u % w + 0.5) * res, (((u / w) | 0) + 0.5) * res]);
  path.reverse(); path[0] = [obs.start.x, obs.start.y]; path[path.length - 1] = [obs.goal.x, obs.goal.y];
  return { path, expansions };
}
`,
  loc: `// Your localizer. Called every 50 ms tick, before the planner and controller use the estimate.
// Return { x, y, th } and optionally cov: a 3×3 covariance as 9 numbers, row-major (drawn as an ellipse).
//
// obs.init    {x, y, th} on the first call only (the start pose), else null
// obs.dt      0.05 s
// obs.odom    {v, w}   measured speed and yaw rate (noisy, slightly biased)
// obs.beacons [{id, r, b}] or null: range and bearing (body frame) to beacons seen this tick; id is -1 when unlabeled
// obs.map     [{id, x, y}] beacon positions
// obs.scan    Float32Array(120) of lidar ranges or null; beam k points at -π + k·2π/120 in the body frame, 8 m max
// mem persists between calls. Budget: 200 ms per call.

function localize(obs, mem) {
  if (obs.init) { mem.x = obs.init.x; mem.y = obs.init.y; mem.th = obs.init.th; }
  // dead reckoning with the exact arc
  const v = obs.odom.v, w = obs.odom.w, dt = obs.dt;
  if (Math.abs(w) < 1e-6) { mem.x += v * dt * Math.cos(mem.th); mem.y += v * dt * Math.sin(mem.th); }
  else { const r = v / w, t2 = mem.th + w * dt; mem.x += r * (Math.sin(t2) - Math.sin(mem.th)); mem.y -= r * (Math.cos(t2) - Math.cos(mem.th)); mem.th = t2; }
  // pull toward each labeled beacon reading: a fixed-gain correction, not a Kalman filter
  if (obs.beacons) for (const z of obs.beacons) {
    const b = obs.map.find(m => m.id === z.id); if (!b) continue;
    const dx = b.x - mem.x, dy = b.y - mem.y, rHat = Math.hypot(dx, dy), bHat = Math.atan2(dy, dx) - mem.th;
    const er = z.r - rHat, eb = Math.atan2(Math.sin(z.b - bHat), Math.cos(z.b - bHat));
    const ux = dx / rHat, uy = dy / rHat;
    mem.x -= 0.2 * er * ux; mem.y -= 0.2 * er * uy; mem.th -= 0.2 * eb;   // a larger measured bearing means the heading estimate is too large
  }
  mem.th = Math.atan2(Math.sin(mem.th), Math.cos(mem.th));
  return { x: mem.x, y: mem.y, th: mem.th };
}
`,
  pred: `// Your agent predictor. Called at 10 Hz with the current tracks.
// Return { trajectories: { [id]: [[x, y, r], ...] } }: one sample per step of obs.dt from t = 0 to obs.horizon, per track.
// The speed planner, DWA and MPC read these samples instead of the built-in constant-velocity model.
//
// obs.tracks  [{id, x, y, vx, vy, r, age}]  position, velocity estimate, radius, seconds since confirmed
// obs.horizon seconds to predict (the Prediction horizon slider)
// obs.dt      sample step (0.1 s)
// obs.lethal, obs.grid  the static map, as for the planner (people do not walk through walls)
// mem persists between calls. Budget: 200 ms per call.

function predict(obs, mem) {
  const out = {}, n = Math.round(obs.horizon / obs.dt);
  for (const t of obs.tracks) {
    const samples = [];
    let vx = t.vx, vy = t.vy;
    for (let k = 0; k <= n; k++) {
      const tt = k * obs.dt;
      // constant velocity, with the velocity decaying toward a walking pace after 2 s: people rarely keep running
      const sp = Math.hypot(vx, vy), cap = tt > 2 ? 1.2 : Infinity;
      if (sp > cap) { vx *= cap / sp; vy *= cap / sp; }
      samples.push([t.x + vx * tt, t.y + vy * tt, t.r + 0.1 * tt]);
    }
    out[t.id] = samples;
  }
  return { trajectories: out };
}
`
};
const SLOT_DEFS = {
  ctl: {
    name: 'Controller',
    fn: 'control',
    timeout: 200,
    param: 'ctl',
    wrap: r => ({
      ok: true,
      v: +r.v || 0,
      w: +r.w || 0,
      steer: r.steer == null ? null : +r.steer,
      mark: Array.isArray(r.mark) ? r.mark : null
    })
  },
  plan: {
    name: 'Planner',
    fn: 'plan',
    timeout: 3000,
    param: 'plan',
    wrap: r => ({ok: true, path: r.path, segs: r.segs, error: r.error, expansions: r.expansions, nodes: r.nodes})
  },
  loc: {
    name: 'Localizer',
    fn: 'localize',
    timeout: 200,
    param: 'loc',
    wrap: r => ({ok: true, x: +r.x, y: +r.y, th: +r.th, cov: Array.isArray(r.cov) && r.cov.length === 9 ? r.cov.map(Number) : null})
  },
  pred: {name: 'Predictor', fn: 'predict', timeout: 200, param: 'agPred', wrap: r => ({ok: true, trajectories: r.trajectories || {}})}
};
const SLOTS = {};
for (const k of Object.keys(SLOT_DEFS))
  SLOTS[k] = {code: k === 'ctl' ? DEFAULT_CODE : SLOT_EXAMPLES[k], worker: null, status: {msg: 'Not loaded.', cls: ''}, lastErr: ''};
function slotWorker(k, code) {
  const D = SLOT_DEFS[k];
  const src = `"use strict";\n${code}\n;const __mem={};const __wrap=${D.wrap.toString()};self.onmessage=(e)=>{if(e.data&&e.data.reset){for(const k in __mem)delete __mem[k];return;}try{if(typeof ${D.fn}!=='function')throw new Error('Define a function named ${D.fn}(obs, mem)');const r=${D.fn}(e.data,__mem)||{};self.postMessage(__wrap(r));}catch(err){self.postMessage({ok:false,error:String(err&&err.message||err)});}};`;
  const url = URL.createObjectURL(new Blob([src], {type: 'text/javascript'}));
  let wk;
  try {
    wk = new Worker(url);
  } catch (err) {
    return {error: 'Workers are unavailable here: ' + err.message};
  }
  const W_ = {wk, pending: null, dead: false, error: null, slot: k};
  wk.onmessage = e => {
    const p = W_.pending;
    W_.pending = null;
    if (p) {
      clearTimeout(p.to);
      p.res(e.data);
    }
  };
  wk.onerror = e => {
    e.preventDefault();
    W_.error = `Line ${Math.max(1, (e.lineno || 2) - 1)}: ${e.message}`;
    W_.dead = true;
    const p = W_.pending;
    W_.pending = null;
    if (p) {
      clearTimeout(p.to);
      p.res({ok: false, error: W_.error});
    }
    slotStatus(k, W_.error, 'err');
  };
  W_.call = obs =>
    new Promise(res => {
      if (W_.dead) return res({ok: false, error: W_.error || 'worker stopped'});
      const to = setTimeout(() => {
        W_.pending = null;
        W_.dead = true;
        W_.error = `Timed out after ${D.timeout} ms (infinite loop?)`;
        wk.terminate();
        slotStatus(k, W_.error, 'err');
        res({ok: false, error: W_.error});
      }, D.timeout);
      W_.pending = {res, to};
      wk.postMessage(obs);
    });
  W_.reset = () => {
    if (!W_.dead) wk.postMessage({reset: true});
  };
  W_.kill = () => {
    try {
      wk.terminate();
    } catch (_) {}
  };
  return W_;
}
function slotStatus(k, msg, cls) {
  SLOTS[k].status = {msg, cls};
  UI.slotStatus(k, msg, cls);
}
// Load a slot's code and switch the matching parameter to 'custom'
function slotLoad(k, code) {
  const sl = SLOTS[k];
  if (code != null) sl.code = code;
  if (sl.worker) sl.worker.kill();
  const w = slotWorker(k, sl.code);
  if (w.error) {
    sl.worker = null;
    slotStatus(k, w.error, 'err');
    return false;
  }
  sl.worker = w;
  sl.lastErr = '';
  slotStatus(k, `Loaded. ${SLOT_DEFS[k].name} set to Your code.`, 'ok');
  if (S) setParam(SLOT_DEFS[k].param, 'custom', false);
  return true;
}
function slotErr(k, err) {
  const sl = SLOTS[k];
  if (sl.lastErr !== err) {
    logE(`Your ${SLOT_DEFS[k].name.toLowerCase()}: ${err}`, 'bad');
    slotStatus(k, err, 'err');
    sl.lastErr = err;
  }
}
function slotNotLoaded(k) {
  const sl = SLOTS[k];
  if (sl.lastErr !== 'none') {
    logE(`Your ${SLOT_DEFS[k].name.toLowerCase()} is not loaded yet. Open the Code tab and press Load.`, 'warn');
    sl.lastErr = 'none';
  }
}
const customWorkerOf = k => SLOTS[k].worker;
// ---- planner slot ----
function customPlanStart(wp, reason) {
  const F = S.fsm,
    w = SLOTS.plan.worker;
  if (!w) {
    slotNotLoaded('plan');
    F.state = 'NO_PATH';
    F.fails++;
    return;
  }
  const e = S.est,
    t0 = performance.now();
  const obs = {
    start: {x: e.x, y: e.y, th: e.th},
    goal: {x: wp.x, y: wp.y, th: wp.th == null ? null : wp.th},
    grid: {w: GW, h: GH, res: RES},
    lethal: S.cm.lethal.slice(),
    dist: S.cm.dist.slice(),
    vehicle: {model: P.model, wheelbase: P.wheelbase, steerMax: steerMax(), minTurnR: isCar() ? minTurnR() : 0, revOK: P.revOK},
    reason
  };
  F.planPending = true;
  F.planPromise = w.call(obs).then(r => {
    F.planPending = false;
    F.planPromise = null;
    let res;
    if (!r.ok) {
      slotErr('plan', r.error);
      res = {ok: false, reason: r.error};
    } else if (r.error) res = {ok: false, reason: String(r.error)};
    else {
      const valid = p =>
        Array.isArray(p) &&
        p.length >= 2 &&
        p.every(q => Array.isArray(q) && isFinite(q[0]) && isFinite(q[1]) && q[0] >= 0 && q[0] <= W && q[1] >= 0 && q[1] <= H);
      if (r.segs && Array.isArray(r.segs) && r.segs.length && r.segs.every(s => valid(s.pts)))
        res = {ok: true, segs: r.segs.map(s => ({pts: s.pts.map(q => q.slice(0, 3)), dir: s.dir < 0 ? -1 : 1})), exp: r.expansions || 0};
      else if (valid(r.path)) res = {ok: true, pts: r.path.map(q => [+q[0], +q[1]]), exp: r.expansions || 0};
      else {
        slotErr('plan', 'return { path: [[x, y], ...] } with at least two points inside the world');
        res = {ok: false, reason: 'invalid path'};
      }
      if (r.nodes && Array.isArray(r.nodes)) S.search = {type: 'hybrid', pts: r.nodes.flat()};
      else S.search = null;
    }
    SLOTS.plan.lastErr = res.ok ? '' : SLOTS.plan.lastErr;
    applyPlanResult(res, 'Your code', reason, t0, false);
  });
}
// ---- localizer slot ----
async function customLocalize() {
  const w = SLOTS.loc.worker;
  if (!w) {
    slotNotLoaded('loc');
    return;
  }
  const first = !S.locInit;
  S.locInit = true;
  const z = S.deliv && S.deliv.z ? S.deliv.z.map(m => ({id: P.assoc === 'known' ? m.id : -1, r: m.r, b: m.b})) : null;
  const obs = {
    init: first ? {x: S.robot.x, y: S.robot.y, th: S.robot.th} : null,
    dt: DT,
    odom: {...S.odo},
    beacons: z,
    map: S.beacons.map(b => ({id: b.id, x: b.x, y: b.y})),
    scan: S.deliv && S.deliv.scan ? Array.from(S.deliv.scan) : null,
    t: S.t
  };
  const r = await w.call(obs);
  if (!r.ok) {
    slotErr('loc', r.error);
    return;
  }
  if (!isFinite(r.x) || !isFinite(r.y) || !isFinite(r.th)) {
    slotErr('loc', 'return { x, y, th } as finite numbers');
    return;
  }
  SLOTS.loc.lastErr = '';
  S.est = {x: r.x, y: r.y, th: wrap(r.th)};
  S.Pc = r.cov ? r.cov.slice() : null;
}
// ---- predictor slot ----
async function customPredict() {
  const w = SLOTS.pred.worker,
    A = S.agents;
  if (!w) {
    slotNotLoaded('pred');
    return;
  }
  const tracks = A.tracks.filter(t => t.conf);
  if (!tracks.length) return;
  const dt = 0.1,
    obs = {
      tracks: tracks.map(t => ({id: t.id, x: t.x, y: t.y, vx: t.vx, vy: t.vy, r: t.r, age: +(S.t - (t.t0 || S.t)).toFixed(2)})),
      horizon: P.agT,
      dt,
      grid: {w: GW, h: GH, res: RES},
      lethal: LV.truthOcc
    };
  const r = await w.call(obs);
  if (!r.ok) {
    slotErr('pred', r.error);
    return;
  }
  SLOTS.pred.lastErr = '';
  for (const t of tracks) {
    const tr = r.trajectories[t.id];
    t.traj = Array.isArray(tr) && tr.length ? {dt, s: tr.map(q => [+q[0], +q[1], q[2] == null ? t.r : +q[2]])} : null;
  }
}
function trajPred(t, tt) {
  const T = t.traj;
  if (!T) return null;
  const k = tt / T.dt,
    i = Math.min(T.s.length - 1, Math.floor(k)),
    j = Math.min(T.s.length - 1, i + 1),
    f = k - i;
  const a = T.s[i],
    b = T.s[j];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/* ---- core/agents.js ---- */
/* ============================================================
   Step
   ============================================================ */
/* ============================================================
   Moving agents: lidar detection, tracking (constant-velocity Kalman filter),
   prediction, and an ST-graph speed planner that uses the predictions.
   The global path stays static; agents are handled at the trajectory level
   (path–velocity decomposition), with escalation to a replan when speed alone
   cannot resolve the conflict.
   ============================================================ */
const AG_PATH_CTL = ['pp', 'rwf', 'stanley', 'pid'];
function agInit() {
  return {
    tracks: [],
    nextId: 1,
    det: [],
    dynPts: [],
    staticPts: null,
    lastT: null,
    st: null,
    vlim: Infinity,
    vlimStop: Infinity,
    blockT: 0,
    lastAgentPlan: -99,
    yieldLog: {},
    egoPath: null
  };
}
const agOn = () => P.agents !== 'off';
const AG_ST_CTL = [...AG_PATH_CTL, 'mpc']; // controllers that follow the speed plan: path trackers as a speed cap, MPC as its reference
const stActive = () => AG_ST_CTL.includes(P.ctl) && P.spd === 'st' && agOn();
// A lidar hit is "explained" when the static map accounts for it
function agExplained(x, y) {
  const k = cellIdx(x, y);
  if (k < 0) return true;
  if (P.per === 'oracle') return S.cm.dist[k] < 0.25;
  const i = k % GW,
    j = (k / GW) | 0; // built map: only cells that have been occupied for a while count as static
  for (let dj = -1; dj <= 1; dj++)
    for (let di = -1; di <= 1; di++) {
      const ii = i + di,
        jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= GW || jj >= GH) continue;
      if (S.lo[jj * GW + ii] > 2.0) return true;
    }
  return false;
}
// Detection: cluster unexplained hits over consecutive beams, reject clusters too large to be a person
function agDetect() {
  const A = S.agents,
    e = S.est,
    R = S.scan;
  A.det = [];
  A.dynPts = [];
  if (!R) return;
  const pts = new Array(NBEAM).fill(null);
  for (let k = 0; k < NBEAM; k++) {
    if (R[k] >= LMAX - 1e-3) continue;
    const a = e.th - Math.PI + (k * TAU) / NBEAM,
      x = e.x + R[k] * Math.cos(a),
      y = e.y + R[k] * Math.sin(a);
    if (!agExplained(x, y)) pts[k] = [x, y, k];
  }
  const cl = [];
  let cur = null,
    miss = 0;
  for (let k = 0; k < NBEAM; k++) {
    const p = pts[k];
    if (!p) {
      if (cur && ++miss > 1) cur = null;
      continue;
    }
    const l = cur && cur[cur.length - 1];
    if (l && hyp(p[0] - l[0], p[1] - l[1]) < 0.45) {
      cur.push(p);
      miss = 0;
    } else {
      cur = [p];
      cl.push(cur);
      miss = 0;
    }
  }
  if (cl.length > 1) {
    const f = cl[0],
      l = cl[cl.length - 1],
      a = f[0],
      b = l[l.length - 1];
    if (a[2] <= 1 && b[2] >= NBEAM - 2 && hyp(a[0] - b[0], a[1] - b[1]) < 0.45) {
      l.push(...f);
      cl.shift();
    }
  }
  for (const c of cl) {
    let mx = 0,
      my = 0;
    for (const p of c) {
      mx += p[0];
      my += p[1];
    }
    mx /= c.length;
    my /= c.length;
    let ext = 0;
    for (const p of c) ext = Math.max(ext, hyp(p[0] - mx, p[1] - my));
    ext *= 2;
    if (ext > (S.peds.some(p => p.car) ? 2.2 : 1.2)) continue;
    const dx = mx - e.x,
      dy = my - e.y,
      d = hyp(dx, dy) || 1,
      r = clamp(0.5 * ext + 0.1, 0.3, S.peds.some(p => p.car) ? 0.9 : 0.55),
      sh = 0.6 * r; // hits lie on the near side
    A.det.push({x: mx + (dx / d) * sh, y: my + (dy / d) * sh, r, n: c.length});
  }
  for (const p of pts) if (p) A.dynPts.push(p);
}
// Tracking: one constant-velocity Kalman filter per agent, gated greedy nearest-neighbour association
const AG_SZ = 0.1; // measurement noise σ [m]
function agTrack() {
  const A = S.agents;
  if (P.agents === 'truth') {
    A.tracks = S.peds.map((p, i) => ({
      id: i + 1,
      x: p.x,
      y: p.y,
      vx: p.vx || 0,
      vy: p.vy || 0,
      r: p.r,
      pxx: 0,
      pxv: 0,
      pvv: 0,
      hits: 99,
      conf: true,
      lastUpd: S.t
    }));
    return;
  }
  const dt = A.lastT == null ? 0.1 : Math.max(1e-3, S.t - A.lastT);
  A.lastT = S.t;
  const q = P.agSigA * P.agSigA,
    R = AG_SZ * AG_SZ;
  for (const t of A.tracks) {
    t.x += t.vx * dt;
    t.y += t.vy * dt; // predict: x' = F x,  P' = F P Fᵀ + Q  (per axis; both axes share P)
    const a = t.pxx + 2 * dt * t.pxv + dt * dt * t.pvv + (q * dt ** 4) / 4,
      b = t.pxv + dt * t.pvv + (q * dt ** 3) / 2,
      c = t.pvv + q * dt * dt;
    t.pxx = a;
    t.pxv = b;
    t.pvv = c;
  }
  const pairs = [];
  A.tracks.forEach((t, i) =>
    A.det.forEach((d, j) => {
      const m = ((d.x - t.x) ** 2 + (d.y - t.y) ** 2) / (t.pxx + R);
      if (m < 9.21) pairs.push([m, i, j]);
    })
  );
  pairs.sort((a, b) => a[0] - b[0]);
  const ut = new Set(),
    ud = new Set();
  for (const [, i, j] of pairs) {
    if (ut.has(i) || ud.has(j)) continue;
    ut.add(i);
    ud.add(j);
    const t = A.tracks[i],
      d = A.det[j],
      S2 = t.pxx + R,
      k0 = t.pxx / S2,
      k1 = t.pxv / S2,
      nx = d.x - t.x,
      ny = d.y - t.y;
    t.x += k0 * nx;
    t.y += k0 * ny;
    t.vx += k1 * nx;
    t.vy += k1 * ny;
    const pxx = (1 - k0) * t.pxx,
      pxv = (1 - k0) * t.pxv,
      pvv = t.pvv - k1 * t.pxv;
    t.pxx = pxx;
    t.pxv = pxv;
    t.pvv = pvv;
    const sp = hyp(t.vx, t.vy);
    if (sp > 2.5) {
      t.vx *= 2.5 / sp;
      t.vy *= 2.5 / sp;
    }
    t.r = 0.8 * t.r + 0.2 * d.r;
    t.hits++;
    t.lastUpd = S.t;
    if (!t.conf && t.hits >= 3) {
      t.conf = true;
      t.t0 = S.t;
    }
  }
  A.det.forEach((d, j) => {
    if (!ud.has(j))
      A.tracks.push({id: A.nextId++, x: d.x, y: d.y, vx: 0, vy: 0, r: d.r, pxx: R, pxv: 0, pvv: 1, hits: 1, conf: false, lastUpd: S.t});
  });
  A.tracks = A.tracks.filter(t => S.t - t.lastUpd < (t.conf ? 1.0 : 0.25)); // confirmed tracks coast through 1 s of occlusion
}
// Prediction: constant velocity (or frozen), radius inflated with time
function agPred(t, tt) {
  if (P.agPred === 'custom') {
    const q = trajPred(t, tt);
    if (q) return q;
  }
  const cv = P.agPred !== 'static';
  return [t.x + (cv ? t.vx * tt : 0), t.y + (cv ? t.vy * tt : 0), t.r + (cv ? P.agGrow * tt : 0)];
}
function agList(rng) {
  const A = S.agents;
  if (!A || !agOn()) return [];
  const e = S.est;
  return A.tracks.filter(t => t.conf && hyp(t.x - e.x, t.y - e.y) < (rng || 10));
}

// ---- ST-graph speed planning along the current leg ----
// Occupancy: cell (t, s) is blocked when the footprint at path distance s ahead overlaps a predicted agent at time t.
// Dynamic programming over (t, s, v) with a small set of accelerations finds the cheapest collision-free speed profile.
const ST_DT = 0.2,
  ST_DS = 0.1,
  ST_DV = 0.05;
// The ST speed planner: dynamic programming over (time, distance along the path, speed) against the predicted agents,
// with a terminal test past the horizon; its speed at 0.2 s caps the tracker.
function stPlan() {
  const A = S.agents,
    T = S.track,
    e = S.est;
  A.st = null;
  A.vlim = Infinity;
  if (!T || S.fsm.state !== 'DRIVE' || !agOn()) return;
  const ags = agList(14),
    dir = T.dir || 1,
    pr = project(e.x, e.y, true),
    Hh = P.agT,
    nt = Math.round(Hh / ST_DT);
  const vtop = Math.min(P.vcruise, isCar() ? vCap(dir) : P.vmax),
    sRem = Math.max(0, T.total - pr.s);
  const v0 = clamp(Math.abs(S.odo.v), 0, vtop + 0.3),
    sMax = Math.min(sRem, (vtop + 0.3) * Hh) + 0.3,
    ns = Math.ceil(sMax / ST_DS) + 1;
  const vref = new Float32Array(ns);
  for (let j = 0; j < ns; j++) {
    const s = pr.s + j * ST_DS;
    let v = vtop,
      kp = 0;
    for (let d = 0; d <= 0.6; d += 0.2) kp = Math.max(kp, Math.abs(kapAt(s + d)));
    if (kp > 1e-6) v = Math.min(v, Math.sqrt(P.alat / kp));
    vref[j] = Math.min(v, decelCap(T.total - s));
  }
  // occ: inside the clearance (1) or touching (2); cc: collision cost of the cell; prox: soft cost just outside the clearance
  const occ = new Uint8Array((nt + 1) * ns),
    cc = new Float32Array((nt + 1) * ns),
    prox = new Float32Array((nt + 1) * ns),
    who = new Int16Array((nt + 1) * ns),
    marg = P.stMarg;
  let inter = false;
  // terminal cost: the profile must end somewhere the robot could stay. Parking in an agent's lane just beyond the horizon is not free.
  const term = new Float32Array(ns);
  // cost of a cell: inside the predicted body (no uncertainty growth) is a collision; inside the growth band or the clearance is soft
  const cellCost = (b0, bg) => (b0 < 0 ? 400 + 2000 * -b0 : 40 * (marg - Math.min(bg, b0)));
  if (ags.length)
    for (let j = 0; j < ns; j++) {
      const s = Math.min(T.total, pr.s + j * ST_DS),
        p = pointAt(s),
        hd = T.hd[segAt(s)],
        C = fpCircles(p[0], p[1], dir > 0 ? hd : hd + Math.PI);
      for (let k = 1; k <= nt; k++) {
        const tt = k * ST_DT;
        let best = Infinity,
          bid = 0;
        let b0 = Infinity;
        for (const a of ags) {
          const q = agPred(a, tt);
          for (const c of C) {
            const dc = hyp(c[0] - q[0], c[1] - q[1]) - c[2],
              d = dc - q[2];
            if (d < best) {
              best = d;
              bid = a.id;
            }
            if (dc - a.r < b0) b0 = dc - a.r;
          }
        }
        const i = k * ns + j;
        if (best < marg) {
          occ[i] = b0 < 0 ? 2 : 1;
          cc[i] = cellCost(b0, best);
          who[i] = bid;
          inter = true;
        } else if (best < marg + 0.6) {
          prox[i] = 1 - (best - marg) / 0.6;
          who[i] = bid;
          inter = true;
        }
      }
      for (let tt = Hh + 0.5; tt <= Hh + 3 + 1e-6; tt += 0.5) {
        let best = Infinity,
          b0 = Infinity;
        for (const a of ags) {
          const q = agPred(a, tt),
            gH = q[2] - agPred(a, Hh)[2];
          for (const c of C) {
            const dc = hyp(c[0] - q[0], c[1] - q[1]) - c[2],
              d = dc - q[2] + gH;
            if (d < best) best = d;
            if (dc - a.r < b0) b0 = dc - a.r;
          }
        }
        if (best < marg) term[j] = Math.max(term[j], 0.5 * cellCost(b0, best));
      }
    } // growth frozen at the horizon
  const Aacc = P.accel ? P.amax : 0.8,
    Bdec = P.accel ? P.amax : 1.5,
    acts = [-Bdec, -0.5 * Bdec, -0.2 * Bdec, 0, 0.5 * Aacc, Aacc];
  const nv = Math.round((vtop + 0.3) / ST_DV) + 1,
    NSV = ns * nv,
    N = (nt + 1) * NSV;
  const C = new Float32Array(N).fill(Infinity),
    Sv = new Float32Array(N),
    Vv = new Float32Array(N),
    Par = new Int32Array(N).fill(-1);
  const vrefAt = s => vref[clamp(Math.round(s / ST_DS), 0, ns - 1)];
  const put = (k, s, v, c, par) => {
    const i = k * NSV + clamp(Math.round(s / ST_DS), 0, ns - 1) * nv + clamp(Math.round(v / ST_DV), 0, nv - 1);
    if (c < C[i]) {
      C[i] = c;
      Sv[i] = s;
      Vv[i] = v;
      Par[i] = par;
    }
  };
  const trans = (k, s, v, par, c0) => {
    for (const a of acts) {
      let v2 = v + a * ST_DT,
        s2;
      if (v2 < 0) {
        s2 = s + (a < 0 ? (v * v) / (-2 * a) : 0);
        v2 = 0;
      } else s2 = s + ((v + v2) / 2) * ST_DT;
      s2 = Math.min(s2, sMax);
      const vr = vrefAt(s2);
      if (v2 > vr + 0.02 && a !== acts[0]) continue;
      const j2 = clamp(Math.round(s2 / ST_DS), 0, ns - 1),
        row = (k + 1) * ns;
      let pen = 0;
      for (let j = Math.min(j2, Math.max(0, Math.ceil(s / ST_DS - 1e-6))); j <= j2; j++) if (cc[row + j] > pen) pen = cc[row + j]; // always includes the cell it ends in   // soft: the least-bad profile still exists
      put(k + 1, s2, v2, c0 + ST_DT * ((vr - v2) ** 2 + 0.3 * a * a + 3 * prox[row + j2] + pen), par);
    }
  };
  trans(0, 0, v0, -2, 0);
  for (let k = 1; k < nt; k++) {
    const b = k * NSV;
    for (let i = 0; i < NSV; i++) {
      const g = b + i;
      if (C[g] !== Infinity) trans(k, Sv[g], Vv[g], g, C[g]);
    }
  }
  let bi = -1,
    bc = Infinity;
  for (let i = nt * NSV; i < N; i++) {
    if (C[i] === Infinity) continue;
    const c = C[i] + term[((i - nt * NSV) / nv) | 0];
    if (c < bc) {
      bc = c;
      bi = i;
    }
  }
  // unconstrained reference: accelerate toward v_ref, ignoring agents
  const free = [[0, 0]];
  {
    let s = 0,
      v = v0;
    for (let k = 1; k <= nt; k++) {
      const vr = vrefAt(s),
        v2 = v < vr ? Math.min(vr, v + Aacc * ST_DT) : Math.max(vr, v - Bdec * ST_DT);
      s = Math.min(sMax, s + ((v + v2) / 2) * ST_DT);
      v = v2;
      free.push([k * ST_DT, s]);
    }
  }
  const st = {
    nt,
    ns,
    dt: ST_DT,
    ds: ST_DS,
    sMax,
    occ,
    prox,
    who,
    free,
    prof: null,
    conflict: false,
    inter,
    s0: pr.s,
    dir,
    pathId: S.pathId,
    seg: S.segIdx,
    t: S.t
  };
  if (bi >= 0) {
    const prof = [];
    let i = bi;
    for (let k = nt; k >= 1; k--) {
      prof.push([k * ST_DT, Sv[i], Vv[i]]);
      i = Par[i];
    }
    prof.push([0, 0, v0]);
    prof.reverse();
    st.prof = prof;
    // conflict: even the cheapest profile is predicted to touch an agent
    for (let k = 1; k <= nt && !st.conflict; k++) {
      const j2 = clamp(Math.round(prof[k][1] / ST_DS), 0, ns - 1),
        j1 = Math.min(j2, Math.max(0, Math.ceil(prof[k - 1][1] / ST_DS - 1e-6)));
      for (let j = j1; j <= j2; j++)
        if (occ[k * ns + j] === 2) {
          st.conflict = k * ST_DT;
          break;
        }
    }
  }
  A.st = st;
  if (!stActive()) return;
  if (!st.prof) A.vlim = Math.max(0, v0 - Bdec * 2 * DT);
  else if (inter) A.vlim = st.prof[1][2];
  // yielding message and escalation to the global planner
  if (st.prof && inter) {
    const sEnd = st.prof[nt][1],
      fEnd = free[nt][1];
    if (sEnd < fEnd - 0.5) {
      let id = 0;
      for (let k = 1; k <= nt && !id; k++) {
        const j0 = clamp(Math.round(st.prof[k][1] / ST_DS), 0, ns - 1);
        for (let j = j0; j < Math.min(ns, j0 + 12); j++) {
          const w = who[k * ns + j];
          if (w && (occ[k * ns + j] || prox[k * ns + j] > 0.3)) {
            id = w;
            break;
          }
        }
      }
      if (id && (A.yieldLog[id] == null || S.t - A.yieldLog[id] > 6)) {
        A.yieldLog[id] = S.t;
        logE(`Speed planner: yielding to agent #${id}`, 'warn');
      }
    }
  }
  const waiting = st.prof && inter && st.prof[nt][1] < 0.2 && v0 < 0.1;
  A.blockT = st.conflict ? A.blockT + 2 * DT * 10 : waiting ? A.blockT + 2 * DT : 0; // escalate after ≈0.3 s of unavoidable conflict, or ≈4 s of waiting
  if (A.blockT >= 3.9 && P.agPlan && S.t - A.lastAgentPlan > 4) {
    A.blockT = 0;
    A.lastAgentPlan = S.t;
    S.fsm.state = 'PLAN';
    S.fsm.pendingReason = 'agent blocking';
    logE('Speed planner: an agent blocks the path; asking for a new path', 'warn');
  }
}
// Reactive baseline: brake for unexplained lidar hits inside the footprint corridor ahead (no tracking, no prediction)
function stReactive() {
  const A = S.agents,
    T = S.track,
    e = S.est;
  if (!T || S.fsm.state !== 'DRIVE' || !A.dynPts.length) return Infinity;
  const dir = T.dir || 1,
    pr = project(e.x, e.y, true),
    B = P.accel ? P.amax : 1.5,
    look = Math.min(T.total - pr.s, 3);
  const near = A.dynPts.filter(p => hyp(p[0] - e.x, p[1] - e.y) < look + 1.5);
  if (!near.length) return Infinity;
  for (let s = 0.1; s <= look + 1e-6; s += 0.1) {
    const q = pointAt(pr.s + s),
      hd = T.hd[segAt(pr.s + s)];
    for (const c of fpCircles(q[0], q[1], dir > 0 ? hd : hd + Math.PI))
      for (const p of near) if (hyp(p[0] - c[0], p[1] - c[1]) < c[2] + 0.1) return Math.sqrt(2 * B * Math.max(0, s - 0.3));
  }
  return Infinity;
}
function agentsTick() {
  const A = S.agents;
  if (!A) return;
  if (!agOn() && P.spd !== 'stop') {
    if (A.tracks.length || A.st || A.det.length) S.agents = agInit();
    return;
  }
  const lid = S.scanTick === S.tick;
  if (lid) agDetect();
  if (agOn() && (lid || P.agents === 'truth')) agTrack();
  if (!agOn()) A.tracks = [];
}
function agentsPlan() {
  const A = S.agents;
  if (!A || (!agOn() && P.spd !== 'stop')) return;
  const lid = S.scanTick === S.tick;
  if (lid) {
    const conf = A.tracks.filter(t => t.conf);
    A.staticPts = conf.length ? S.scanPts.filter(p => !conf.some(t => hyp(p[0] - t.x, p[1] - t.y) < t.r + 0.25)) : S.scanPts;
    if (agOn()) stPlan();
    else {
      A.st = null;
      A.vlim = Infinity;
    }
    A.vlimStop = P.spd === 'stop' ? stReactive() : Infinity;
  }
}
// Cap the path tracker's speed (keeps the commanded curvature)
function agSpeedCap(c) {
  const A = S.agents;
  if (!A || !AG_PATH_CTL.includes(P.ctl) || S.fsm.state !== 'DRIVE' || !S.track) return c;
  const lim = P.spd === 'st' && agOn() ? A.vlim : P.spd === 'stop' ? A.vlimStop : Infinity;
  const v = Math.abs(c.v || 0);
  if (!(lim < v)) return c;
  const f = v > 1e-9 ? lim / v : 0,
    o = {...c, v: c.v * f};
  if (!isCar() && o.w != null) o.w = c.w * f;
  return o;
}
// The controller's own prediction of the ego, for the map and the ST graph
function agPost() {
  const A = S.agents;
  if (!A) return;
  A.egoPath = null;
  if (!agOn() || !S.track) return;
  const V = S.ctlViz;
  if (P.ctl === 'mpc' && V && V.pred) A.egoPath = {pts: V.pred, dt: P.mpcDt, src: 'MPC prediction'};
  else if (P.ctl === 'dwa' && V && V.trajs && V.best >= 0) {
    const q = V.trajs[V.best].pts,
      pts = [];
    for (let i = 0; i < q.length; i += 2) pts.push([q[i], q[i + 1]]);
    A.egoPath = {pts, dt: 0.2, src: 'DWA rollout'};
  }
}
// Ego positions at whole seconds: from the speed plan (path trackers) or the local planner's own prediction (DWA, MPC)
function agEgoMarks() {
  const A = S.agents,
    out = [];
  if (!A || !S.track) return out;
  if (A.egoPath) {
    const {pts, dt} = A.egoPath;
    for (let t = 1; t * 1 <= (pts.length - 1) * dt + 1e-6; t++) {
      const i = Math.round(t / dt);
      if (i < pts.length) out.push([pts[i][0], pts[i][1], t]);
    }
    return out;
  }
  if (stActive() && A.st && A.st.prof && A.st.pathId === S.pathId) {
    const st = A.st;
    for (let t = 1; t <= st.nt * st.dt + 1e-6; t++) {
      const k = Math.round(t / st.dt);
      if (k > st.nt) break;
      const p = pointAt(st.s0 + st.prof[k][1]);
      out.push([p[0], p[1], t]);
    }
  }
  return out;
}
// Agent layer for the global planner: mark predicted positions over the next 2 s as occupied
function agCostLayer() {
  const ags = agList(30);
  if (!ags.length) return false;
  const cm = S.cm,
    occ = cm.occ;
  for (const a of ags)
    for (let tt = 0; tt <= 2.0001; tt += 0.5) {
      const q = agPred(a, tt),
        r = q[2];
      for (let j = cellI(q[1] - r); j <= cellI(q[1] + r); j++)
        for (let i = cellI(q[0] - r); i <= cellI(q[0] + r); i++) {
          if (i < 0 || j < 0 || i >= GW || j >= GH) continue;
          if (hyp((i + 0.5) * RES - q[0], (j + 0.5) * RES - q[1]) <= r) occ[j * GW + i] = 1;
        }
    }
  cm.dist = distanceTransform(occ);
  const d = cm.dist,
    inf = Math.max(P.infl, 0.01);
  for (let i = 0; i < NC; i++) {
    cm.lethal[i] = d[i] < LETHAL ? 1 : 0;
    const qq = (LETHAL + inf - d[i]) / inf;
    cm.pen[i] = d[i] < LETHAL ? 1 : qq > 0 ? qq * qq : 0;
  }
  return true;
}
// Exact clearance between the true body and a person (for the metric)
function bodyGap(r, p) {
  if (p.car) return Math.min(...carCircles(p).map(c => bodyGap(r, c)));
  if (!isCar()) return hyp(p.x - r.x, p.y - r.y) - RR - p.r;
  const c = Math.cos(r.th),
    s = Math.sin(r.th),
    hl = carLen() / 2,
    hw = CAR.width / 2,
    off = carLen() / 2 - CAR.rear,
    cx = r.x + off * c,
    cy = r.y + off * s;
  const dx = p.x - cx,
    dy = p.y - cy,
    lx = dx * c + dy * s,
    ly = -dx * s + dy * c;
  return hyp(lx - clamp(lx, -hl, hl), ly - clamp(ly, -hw, hw)) - p.r;
}

/* ---- core/fidelity.js ---- */
/* ============================================================
   Fidelity: sensor latency, reactive pedestrians (social force), other vehicles
   ============================================================ */
// ---- sensor latency: measurements are produced now and delivered sensLat/DT ticks later ----
function sensEnqueue(kind, data) {
  const n = Math.round((P.sensLat || 0) / DT);
  if (!S.sensQ) S.sensQ = [];
  S.sensQ.push({due: S.tick + n, kind, data});
}
function sensDeliver() {
  S.deliv = {scan: null, z: null};
  if (!S.sensQ || !S.sensQ.length) return;
  const keep = [];
  for (const it of S.sensQ) {
    if (it.due > S.tick) {
      keep.push(it);
      continue;
    }
    if (it.kind === 'lidar') {
      lidarApply(it.data);
      S.deliv.scan = it.data;
    } else {
      beaconsApply(it.data);
      S.deliv.z = it.data;
    }
  }
  S.sensQ = keep;
}
function lidarApply(ranges) {
  S.scan = ranges;
  const e = S.est,
    pts = [];
  for (let k = 0; k < NBEAM; k++) {
    if (ranges[k] >= LMAX - 1e-3) continue;
    const a = e.th - Math.PI + (k * TAU) / NBEAM;
    pts.push([e.x + ranges[k] * Math.cos(a), e.y + ranges[k] * Math.sin(a)]);
  }
  S.scanPts = pts;
  S.scanTick = S.tick;
  if (P.per === 'mapping') integrateScan(ranges);
  if (P.loc === 'pf' && P.pfLidar && P.per === 'oracle' && S.tick % 4 === 3) pfLidarUpdate(ranges);
}
function beaconsApply(z) {
  S.lastZ = z;
  if (P.loc === 'ekf') ekfUpdate(z);
  else if (P.loc === 'pf') pfUpdate(z);
  else if (P.loc === 'slam') slamUpdate(z);
}

// ---- people ----
// scripted: back and forth on a segment (the original). reactive: social forces toward the segment's far end,
// away from the robot, other people and walls (Helbing & Molnár 1995, simplified).
const SF = {tau: 0.5, A: 2.0, B: 0.35, Ar: 3.0, Br: 0.5, Aw: 2.5, Bw: 0.25};
function pedGoal(p) {
  return p.dir > 0 ? p.b : p.a;
}
function updatePedsReactive(dt) {
  const r = S.robot,
    ps = S.peds.filter(p => !p.car);
  for (const p of ps) {
    if (p.wait > 0) {
      p.wait -= dt;
      p.vx = 0;
      p.vy = 0;
      continue;
    }
    const g = pedGoal(p),
      dx = g[0] - p.x,
      dy = g[1] - p.y,
      d = hyp(dx, dy);
    if (d < 0.25) {
      p.dir = -p.dir;
      p.wait = p.dw || 0.5;
      p.vx = 0;
      p.vy = 0;
      continue;
    }
    const ex = dx / d,
      ey = dy / d;
    let fx = (p.v * ex - (p.vx || 0)) / SF.tau,
      fy = (p.v * ey - (p.vy || 0)) / SF.tau;
    // the robot
    {
      const ddx = p.x - r.x,
        ddy = p.y - r.y,
        dd = hyp(ddx, ddy) || 1e-6,
        rr = p.r + (isCar() ? 0.55 : RR),
        f = SF.Ar * Math.exp((rr - dd) / SF.Br);
      fx += (f * ddx) / dd;
      fy += (f * ddy) / dd;
    }
    // other people and vehicles
    for (const q of S.peds) {
      if (q === p) continue;
      const ddx = p.x - q.x,
        ddy = p.y - q.y,
        dd = hyp(ddx, ddy) || 1e-6,
        f = SF.A * Math.exp((p.r + q.r - dd) / SF.B);
      fx += (f * ddx) / dd;
      fy += (f * ddy) / dd;
    }
    // walls: gradient of the distance field
    {
      const k = cellIdx(p.x, p.y);
      if (k >= 0) {
        const D = LV.truthDist,
          i = k % GW,
          j = (k / GW) | 0,
          gx = (D[j * GW + Math.min(GW - 1, i + 1)] - D[j * GW + Math.max(0, i - 1)]) / (2 * RES),
          gy = (D[Math.min(GH - 1, j + 1) * GW + i] - D[Math.max(0, j - 1) * GW + i]) / (2 * RES),
          f = SF.Aw * Math.exp((p.r - D[k]) / SF.Bw);
        fx += f * gx;
        fy += f * gy;
      }
    }
    let vx = (p.vx || 0) + fx * dt,
      vy = (p.vy || 0) + fy * dt;
    const sp = hyp(vx, vy),
      cap = 1.3 * p.v;
    if (sp > cap) {
      vx *= cap / sp;
      vy *= cap / sp;
    }
    const nx = p.x + vx * dt,
      ny = p.y + vy * dt,
      kn = cellIdx(nx, ny);
    if (kn >= 0 && LV.truthDist[kn] > p.r * 0.8) {
      p.x = nx;
      p.y = ny;
      p.vx = vx;
      p.vy = vy;
    } else {
      p.vx = 0;
      p.vy = 0;
    }
    p.s = 1 - hyp(pedGoal(p)[0] - p.x, pedGoal(p)[1] - p.y) / Math.max(1e-6, hyp(p.b[0] - p.a[0], p.b[1] - p.a[1]));
  }
}
// ---- other vehicles: a car-like body on a closed loop, yielding to the ego when it is close ahead ----
function carsInit() {
  if (!LV.cars) return;
  for (const c of LV.cars) {
    const L = c.loop,
      seg = [];
    let tot = 0;
    for (let i = 0; i < L.length; i++) {
      const a = L[i],
        b = L[(i + 1) % L.length],
        l = hyp(b[0] - a[0], b[1] - a[1]);
      seg.push([tot, l]);
      tot += l;
    }
    const p = {
      car: true,
      loop: L,
      seg,
      tot,
      s: (c.s0 || 0) * tot,
      v: c.v,
      vset: c.v,
      x: 0,
      y: 0,
      th: 0,
      vx: 0,
      vy: 0,
      r: 0.5,
      len: 1.0,
      wid: 0.5,
      a: [0, 0],
      b: [0, 0],
      dir: 1
    };
    carPose(p);
    S.peds.push(p);
  }
}
function carPose(p) {
  const s = ((p.s % p.tot) + p.tot) % p.tot;
  let i = 0;
  while (i < p.seg.length - 1 && p.seg[i + 1][0] <= s) i++;
  const a = p.loop[i],
    b = p.loop[(i + 1) % p.loop.length],
    t = (s - p.seg[i][0]) / p.seg[i][1];
  const th = Math.atan2(b[1] - a[1], b[0] - a[0]);
  p.x = a[0] + (b[0] - a[0]) * t;
  p.y = a[1] + (b[1] - a[1]) * t;
  p.th = th;
  p.vx = p.v * Math.cos(th);
  p.vy = p.v * Math.sin(th);
}
function updateCars(dt) {
  const r = S.robot;
  for (const p of S.peds) {
    if (!p.car) continue;
    // yield: ego within 3 m ahead inside a ±35° cone, or any person within 1.5 m ahead
    const ahead = (x, y) => {
      const dx = x - p.x,
        dy = y - p.y,
        d = hyp(dx, dy),
        ang = Math.abs(wrap(Math.atan2(dy, dx) - p.th));
      return {d, ang};
    };
    let stop = false;
    {
      const q = ahead(r.x, r.y);
      if (q.d < 3.2 && q.ang < 0.6) stop = true;
    }
    for (const o of S.peds) {
      if (o === p || o.car) continue;
      const q = ahead(o.x, o.y);
      if (q.d < 1.8 && q.ang < 0.8) stop = true;
    }
    const vt = stop ? 0 : p.vset;
    p.v += clamp(vt - p.v, -1.2 * dt, 0.8 * dt);
    if (Math.abs(p.v) < 1e-3) p.v = 0;
    p.s += p.v * dt;
    carPose(p);
  }
}
function carCircles(p) {
  const c = Math.cos(p.th),
    s = Math.sin(p.th),
    out = [];
  for (const o of [-0.3, 0, 0.3]) out.push({t: 'c', x: p.x + o * c, y: p.y + o * s, r: 0.3});
  return out;
}

/* ---------- space-time A*: plans (x, y, t) on a coarse grid against the agents' predicted positions ----------
   Cells 0.2 m, time quantized by the move time at the reference speed; moves to 8 neighbours or wait.
   Agents block a cell at a time when the predicted disc (plus the robot radius and a margin) covers it;
   beyond the prediction horizon only the static map counts. The ST speed planner then enforces the timing. */
// Space-time A* for the diff-drive robot: a search over (x, y, t) with waits, against the agents' predicted positions.
function stAstar(sx, sy, gx, gy) {
  const CW = 2,
    cw = RES * CW,
    gw = Math.floor(GW / CW),
    gh = Math.floor(GH / CW),
    v = Math.max(0.2, Math.min(P.vcruise, P.vmax)),
    dtc = cw / v,
    T = P.agT,
    nt = Math.ceil(T / dtc) + 1;
  const ci = x => clamp(Math.floor(x / cw), 0, gw - 1),
    cj = y => clamp(Math.floor(y / cw), 0, gh - 1);
  const si = ci(sx),
    sj = cj(sy),
    gi = ci(gx),
    gj = cj(gy);
  // static lethal on the coarse grid: any fine lethal cell inside
  const leth = new Uint8Array(gw * gh);
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      let b = 0;
      for (let a = 0; a < CW && !b; a++) for (let c = 0; c < CW && !b; c++) if (S.cm.lethal[(j * CW + a) * GW + i * CW + c]) b = 1;
      leth[j * gw + i] = b;
    }
  if (leth[gj * gw + gi]) return {ok: false, reason: goalBlocked(gx, gy) || 'goal is inside an inflated obstacle'};
  // agent discs per time slice
  const ags = agList(40),
    marg = P.stMarg,
    discs = [];
  for (let k = 0; k < nt; k++) {
    const t = k * dtc;
    discs.push(
      ags.map(a => {
        const q = agPred(a, Math.min(t, T));
        return [q[0], q[1], q[2] + RR + marg];
      })
    );
  }
  const blocked = (i, j, k) => {
    if (k >= nt) return false;
    const x = (i + 0.5) * cw,
      y = (j + 0.5) * cw;
    for (const d of discs[k]) if (hyp(x - d[0], y - d[1]) < d[2]) return true;
    return false;
  };
  // heuristic: 2D grid distance (octile) in time
  const h = (i, j) => {
    const dx = Math.abs(i - gi),
      dy = Math.abs(j - gj);
    return (Math.max(dx, dy) + (SQ2 - 1) * Math.min(dx, dy)) * dtc;
  };
  const KMAX = nt + 2,
    key = (i, j, k) => (Math.min(k, KMAX) * gh + j) * gw + i; // after the horizon all times share a key (static world)
  const gsc = new Map(),
    par = new Map(),
    heap = new Heap();
  const s0 = key(si, sj, 0);
  gsc.set(s0, 0);
  heap.push(s0, h(si, sj));
  const NB8 = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, SQ2],
    [1, -1, SQ2],
    [-1, 1, SQ2],
    [-1, -1, SQ2],
    [0, 0, 1]
  ];
  let exp = 0,
    found = null;
  const closed = new Set();
  while (heap.size && exp < 60000) {
    const u = heap.pop();
    if (closed.has(u)) continue;
    closed.add(u);
    exp++;
    const i = u % gw,
      j = ((u / gw) | 0) % gh,
      kq = (u / (gw * gh)) | 0,
      g = gsc.get(u),
      k = Math.round(g / dtc);
    if (i === gi && j === gj) {
      found = u;
      break;
    }
    for (const [di, dj, c] of NB8) {
      const vi = i + di,
        vj = j + dj;
      if (vi < 0 || vj < 0 || vi >= gw || vj >= gh) continue;
      const vk = k + Math.round(c);
      if (di && dj && (leth[j * gw + vi] || leth[vj * gw + i])) continue;
      if (leth[vj * gw + vi] || blocked(vi, vj, vk) || (c > 1 && blocked(vi, vj, vk - 1))) continue;
      if (di === 0 && dj === 0 && vk >= nt) continue; // waiting past the horizon is pointless
      const vkey = key(vi, vj, vk),
        ng = g + c * dtc * (1 + (di === 0 && dj === 0 ? 0.2 : 0)) + (S.cm.pen[vj * CW * GW + vi * CW] || 0) * 0.3 * dtc;
      if (ng < (gsc.has(vkey) ? gsc.get(vkey) : Infinity)) {
        gsc.set(vkey, ng);
        par.set(vkey, u);
        heap.push(vkey, ng + h(vi, vj));
      }
    }
  }
  S.search = {type: 'hybrid', pts: [...closed].slice(0, 4000).flatMap(u => [((u % gw) + 0.5) * cw, ((((u / gw) | 0) % gh) + 0.5) * cw])};
  {
    const ord = [...closed],
      ix = new Map();
    ord.forEach((u, i) => ix.set(u, i)); // playback: every expansion, with its parent's index
    S.searchTrace = {
      type: 'pts',
      name: 'Space-time A*',
      n: ord.length,
      pts: ord.flatMap(u => [((u % gw) + 0.5) * cw, ((((u / gw) | 0) % gh) + 0.5) * cw]),
      pix: ord.map(u => (par.has(u) && ix.has(par.get(u)) ? ix.get(par.get(u)) : -1)),
      cell: cw
    };
  }
  if (found == null) return {ok: false, reason: 'no space-time route within the horizon', exp};
  const cells = [];
  for (let u = found; u != null; u = par.get(u)) cells.push(u);
  cells.reverse();
  const pts = [[sx, sy]];
  let prev = null;
  for (const u of cells) {
    const i = u % gw,
      j = ((u / gw) | 0) % gh;
    if (prev && prev[0] === i && prev[1] === j) continue;
    prev = [i, j];
    pts.push([(i + 0.5) * cw, (j + 0.5) * cw]);
  }
  pts.push([gx, gy]);
  const waits = cells.length - 1 - (pts.length - 2);
  return {ok: true, pts, exp, extra: waits > 0 ? `${(waits * dtc).toFixed(1)} s of waiting planned` : ''};
}

/* ---- core/step.js ---- */
// One tick, in three parts so that user code in workers can be awaited between them:
// sense → (custom localizer) → mission and tracking → (custom predictor) → speed planning
function preSense() {
  S.tick++;
  S.t += DT;
  updatePeds(DT);
  actuate();
  odometry();
  if (P.loc !== 'custom') locPredict();
  if (S.tick % 2 === 1) sensEnqueue('lidar', lidarSense());
  if (S.tick % 4 === 1) sensEnqueue('beacons', senseBeacons());
  sensDeliver();
  if (P.loc === 'truth') S.est = {x: S.robot.x, y: S.robot.y, th: S.robot.th};
}
function postSense() {
  if (P.per === 'mapping' && S.tick % 10 === 0) {
    buildCostmap();
    dirty.occ = true;
  }
  metrics();
  missionTick();
  agentsTick();
}
function preControl() {
  preSense();
  postSense();
  agentsPlan();
}
function metrics() {
  const r = S.robot,
    e = S.est;
  const ex = r.x - e.x,
    ey = r.y - e.y,
    eth = wrap(r.th - e.th),
    ep = hyp(ex, ey);
  S.errSq += ep * ep;
  S.errN++;
  let cte = null;
  if (S.track && S.fsm.state === 'DRIVE') {
    cte = project(r.x, r.y, false).d;
    S.cteSq += cte * cte;
    S.cteN++;
  }
  if (S.Pc && S.tick % 4 === 1) {
    const Pi = m3inv(S.Pc);
    if (Pi) {
      const v = [ex, ey, eth];
      let q = 0;
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) q += v[a] * Pi[a * 3 + b] * v[b];
      S.nees.push(q);
      if (S.nees.length > 100) S.nees.shift();
    }
  }
  if (S.tick % 2 === 0) {
    S.plot.push({
      t: S.t,
      ex,
      ey,
      ep,
      eth,
      sp: S.Pc ? Math.sqrt(Math.max(0, S.Pc[0] + S.Pc[4])) : null,
      sx: S.Pc ? Math.sqrt(Math.max(0, S.Pc[0])) : null,
      sth: S.Pc ? Math.sqrt(Math.max(0, S.Pc[8])) : null,
      cte,
      vc: S.cmd.v,
      va: r.v,
      tc: isCar() ? deg(S.cmd.steer || 0) : S.cmd.w,
      ta: isCar() ? deg(r.d) : r.w
    });
    if (S.plot.length > 3000) S.plot.shift();
  } // 5 min at 10 Hz, as long as the replay frames (record.js)
  if (S.tick % 4 === 0) {
    S.trailT.push([r.x, r.y]);
    S.trailE.push([e.x, e.y]);
    if (S.trailT.length > 1500) {
      S.trailT.shift();
      S.trailE.shift();
    }
  }
}
let busy = false;
// Controllers return {v, w} or {v, steer}; convert to what the active vehicle model takes
function normCmd(c) {
  const v = isFinite(c.v) ? c.v : 0;
  if (!isCar()) return {v, w: isFinite(c.w) ? c.w : 0, steer: 0};
  let st = c.steer;
  if (st == null || !isFinite(st)) {
    const w = isFinite(c.w) ? c.w : 0;
    st = Math.abs(v) < 0.05 ? Math.sign(w) * steerMax() : Math.atan((P.wheelbase * w) / v);
  }
  st = clamp(st, -steerMax(), steerMax());
  return {v, steer: st, w: (v * Math.tan(st)) / P.wheelbase};
}
// Control latency: commands wait latency/DT ticks before reaching the actuators
function applyCmd(c) {
  // the zero-velocity update needs the robot still: with it on, the first 2 s of a run are a calibration hold
  if (P.gyro && P.zupt && S.t < 2) c = {v: 0, w: 0, steer: 0};
  S.cmdIssued = c;
  const n = Math.round(P.latency / DT);
  if (!n) {
    S.cmd = c;
    S.cmdQ = [];
    return;
  }
  if (!S.cmdQ) S.cmdQ = [];
  S.cmdQ.push(c);
  while (S.cmdQ.length > n) S.cmd = S.cmdQ.shift();
}
async function advance(n) {
  if (busy) return;
  busy = true;
  try {
    for (let i = 0; i < n; i++) {
      if (S.fsm.planPending && S.fsm.planPromise) await S.fsm.planPromise; // a custom planner answers in lockstep
      preSense();
      if (P.loc === 'custom') await customLocalize();
      postSense();
      if (P.agPred === 'custom' && S.scanTick === S.tick && agOn()) await customPredict();
      agentsPlan();
      const cmd = P.ctl === 'custom' && !S.fsm.align ? await customCmd() : builtinCmd();
      applyCmd(normCmd(cmd));
      agPost();
      recFrame();
      if (S.halt) {
        S.halt = false;
        if (pauseOnContact && running) {
          running = false;
          logE('Paused on contact (uncheck Pause on contact to keep going)', 'warn');
          break;
        }
      }
    }
  } finally {
    busy = false;
  }
}

/* ---- core/log.js ---- */
/* ============================================================
   Event log
   ============================================================ */
function logE(msg, cls = '') {
  if (!S) return;
  S.log.unshift({t: S.t, msg, cls});
  if (S.log.length > 200) S.log.pop();
  logDirty = true;
}
let logDirty = true;

/* ============================================================
   Headless runner (Web Worker). The same simulation core as the page, no DOM.
   Message in:  {cmd:'run', id, level, seed, overrides:{param:value}, secs, stopWhenDone}
   Messages out: {id, progress} … {id, done:true, summary, ms}
   ============================================================ */
function runSummary() {
  const r = S.robot,
    e = S.est,
    F = S.fsm;
  const nees = S.nees.length ? S.nees.reduce((a, b) => a + b, 0) / S.nees.length : null;
  return {
    t: +S.t.toFixed(2),
    state: F.state,
    goalsDone: WPS.filter(w => w.done && !w.skipped).length,
    goals: WPS.length,
    skipped: WPS.filter(w => w.skipped).length,
    coll: S.coll,
    ped: S.collPed,
    pedStill: S.collPedStill || 0,
    minPed: isFinite(S.minPed) ? +S.minPed.toFixed(3) : null,
    dist: +S.dist.toFixed(2),
    poseRMS: S.errN ? +Math.sqrt(S.errSq / S.errN).toFixed(4) : null,
    poseErrFinal: +hyp(r.x - e.x, r.y - e.y).toFixed(3),
    cteRMS: S.cteN ? +Math.sqrt(S.cteSq / S.cteN).toFixed(4) : null,
    nees: nees == null ? null : +nees.toFixed(2),
    replans: S.log.filter(l => /^Replan/.test(l.msg)).length,
    mpcMs: S.mpcStats ? +S.mpcStats.ms.toFixed(2) : null,
    log: S.log
      .slice(0, 12)
      .map(l => l.t.toFixed(1) + ' ' + l.msg)
      .reverse(),
    path: S.trailT.filter((_, i) => i % 2 === 0).map(p => (p ? [+p[0].toFixed(2), +p[1].toFixed(2)] : null))
  }; // the true path every 0.4 s (the trail is kept every 0.2 s; null: a kidnap)
}
// The core's numerics, reachable from the Node tests (tests/node/numerics.test.mjs); unused by the page's worker
self.__core = {
  m3inv,
  m3mul,
  cholSolve,
  boxQP,
  distanceTransform,
  RS,
  astar,
  ekfUpdate,
  initLoc,
  loadLevel,
  setParam,
  wrap,
  clamp,
  get S() {
    return S;
  },
  get P() {
    return P;
  },
  RES,
  GW,
  GH,
  NC
};
self.onmessage = async e => {
  const m = e.data;
  if (m.cmd !== 'run') return;
  REC.on = false;
  try {
    if (m.seed) P.seed = m.seed;
    loadLevel(m.level);
    for (const [k, v] of Object.entries(m.overrides || {})) if (k !== 'seed') setParam(k, v, false);
    for (const [k, code] of Object.entries(m.codes || {})) {
      if (!code) continue;
      if (!slotLoad(k, code)) throw new Error(SLOTS[k].status.msg);
    }
    if ((S.fsm.state === 'IDLE' || S.fsm.state === 'DONE') && remaining().length) startMission();
    const N = Math.round((m.secs || 120) / DT),
      t0 = performance.now();
    let done = 0;
    while (done < N) {
      const n = Math.min(40, N - done);
      await advance(n);
      done += n;
      if (S.fsm.state === 'DONE' && m.stopWhenDone !== false) break;
      if (done % 400 === 0) postMessage({id: m.id, progress: done / N});
    }
    postMessage({id: m.id, done: true, summary: runSummary(), ms: +(performance.now() - t0).toFixed(0)});
  } catch (err) {
    postMessage({id: m.id, done: true, error: String((err && err.stack) || err)});
  }
};

})();