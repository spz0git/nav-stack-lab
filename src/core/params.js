/* ============================================================
   Parameters
   ============================================================ */
const DEFAULTS = {
  loc: 'truth',
  assoc: 'known',
  npart: 400,
  inject: true,
  pfLidar: true,
  scanMatch: false,
  pgKf: 0.5,
  pgLoop: true,
  pgMatch: true,
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
  mpcBudget: 15, // ms of real time per solve before the SQP stops with what it has; 0: no limit (deterministic, for tests)
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
  actNoise: 0, // random perturbation of the executed command (σ in rad/s on the turn rate, relative on speed): the collectors use it
  detModel: 'builtin', // which detector the learned tracker runs: the built-in one or the id of a model trained in the Train tab
  polModel: 'builtin', // which end-to-end policy Plan → Learned policy runs (the same)
  predModel: 'builtin', // which people predictor Perceive → Prediction → Learned runs (the same)
  policyGoal: 'final', // what the learned policy is pointed at: the mission goal, or a subgoal 3 m along the A* route
  odoK: 0,
  odoB: 0,
  lmK: 1,
  lmRange: 7,
  clutter: 0,
  bOff: '',
  map: 'level', // the obstacles: the level's ('level') or none but the outer walls ('empty'); beacons and people stay
  mapAdd: '', // obstacles painted on the map: cells of the 0.4 m paint grid (j·60 + i), comma-separated
  mapDel: '', // the level's obstacles erased on the map: their indices in the level's shape list, comma-separated
  misLoop: false, // after the last goal the mission starts again from the first, until stopped
  bOut: 0,
  bOutLen: 1,
  lidarSig: 0.02,
  seed: 7,
  agents: 'off',
  agPred: 'cv',
  predModes: 'top', // the learned predictor's futures the planners avoid: the most probable, or every one at least 20 % probable
  agT: 4,
  agGrow: 0.1,
  agSigA: 0.8,
  agICP: false,
  spd: 'none',
  voT: 3,
  voMargin: 0.2,
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
  loc: ['truth', 'dr', 'ekf', 'pf', 'slam', 'pgslam', 'custom'],
  assoc: ['known', 'unknown'],
  per: ['oracle', 'mapping'],
  unknownAs: ['free', 'lethal'],
  agents: ['off', 'truth', 'lidar', 'learned'],
  agPred: ['cv', 'static', 'learned', 'custom'],
  predModes: ['top', 'all'],
  mis: ['sequential', 'greedy', 'optimal', 'explore'],
  plan: ['straight', 'astar', 'dstar', 'rrtstar', 'stastar', 'rs', 'hybrid', 'policy', 'custom'],
  policyGoal: ['final', 'subgoal'],
  hybH: ['both', '2d'],
  ctl: ['pp', 'rwf', 'stanley', 'pid', 'dwa', 'mpc', 'custom'],
  spd: ['none', 'stop', 'st', 'vo'],
  mpcMode: ['nmpc', 'ltv'],
  model: ['diff', 'car'],
  carPhys: ['kin', 'dyn'],
  people: ['scripted', 'reactive'],
  map: ['level', 'empty']
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
  frontier: true,
  graph: true,
  vo: true
};

// ---- Sensors switchboard and GNSS (appended: one switch per modality, see SENSORS in core/sensors.js) ----
const SENSOR_DEFAULTS = {
  odom: true, // wheel odometry; off: the filters predict with the commanded velocity
  lidar: true, // the 360° lidar; off: no mapping, scan matching, people detection, safety stop or lidar layers
  gnss: false, // GNSS position fixes (outdoors on L6 and L7; anywhere else as if the world had a sky)
  gnssHz: 2, // fixes per second
  gnssSig: 0.3, // white noise σ per fix [m]
  gnssBias: 1.0, // σ of the slowly wandering bias, a first-order Gauss–Markov process [m]
  gnssTau: 60, // its time constant [s]
  gnssMp: true, // multipath within 1.5 m of a wall or a parked car: a bias jump and extra noise
  gnssOut: 0, // share of time the receiver has no fix [%]
  gnssOutLen: 6, // mean length of one outage [s]
  gnssAug: false // the EKF estimates the GNSS bias as two more states (random walk)
};
Object.assign(DEFAULTS, SENSOR_DEFAULTS);
for (const [k, v] of Object.entries(SENSOR_DEFAULTS)) if (!(k in P)) P[k] = v;
LAYERS.gnss = true;
