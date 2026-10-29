/* ---------- lesson glossary: short definitions of the terms and symbols each lesson uses ---------- */
// GLOSS[id] = [shown as (HTML), definition (HTML), unit, patterns]. Patterns are the exact text (or HTML) the lessons
// write; the longest one wins at each position, lowercase words match any case, [] means listed but not marked inline.
// A symbol means different things in different lessons (Σ, g, L, ω …), so each meaning has its own id.
const GLOSS = {
  // localization
  odometry: [
    'odometry',
    'Motion the robot measures itself, from its wheel encoders: speed <i>v</i> and turn rate ω every tick. Its errors are never corrected, so they accumulate.',
    '',
    ['odometry']
  ],
  deadreck: [
    'dead reckoning',
    'Estimating the pose by integrating odometry alone, with no external reference. The error grows without bound.',
    '',
    ['dead reckoning']
  ],
  arc: [
    'arc model',
    'Motion model that holds <i>v</i> and ω constant over one tick, so the robot moves along a circular arc (a straight line when ω = 0).',
    '',
    ['arc model']
  ],
  covariance: [
    'covariance',
    'How uncertain the estimate is, and how the errors of its states are correlated. Drawn on the map as the 95 % ellipse.',
    '',
    ['covariance']
  ],
  ellipse: ['ellipse', 'The 95 % uncertainty ellipse of the position, drawn on the map from Σ.', '', ['ellipse']],
  consistent: [
    'consistent filter',
    'A filter whose covariance matches its real errors: the true error stays inside its σ bounds as often as statistics predict.',
    '',
    ['consistent filter', 'consistent']
  ],
  band2s: [
    '2σ band',
    'Two standard deviations of the estimate either side of zero on the error plot. A consistent filter stays inside it about 95 % of the time.',
    '',
    ['2σ band']
  ],
  poserr: [
    'Position error',
    "Telemetry plot of the distance between the true and the estimated position, with the filter's 2σ band.",
    '',
    ['Position error']
  ],
  mu: ['μ', "Pose estimate, the filter's mean [<i>x̂</i>, <i>ŷ</i>, θ̂]. μ′ is its value one tick later.", 'm, rad', ['μ']],
  Sigma: ['Σ', 'Covariance of the pose estimate, 3 × 3. Σ′ is its value one tick later.', '', ['Σ']],
  gmot: [
    '<i>g</i>(μ, <i>u</i>)',
    'Motion model: the next pose from the current one and the odometry input, by the arc model.',
    '',
    ['g(μ, u)', 'g']
  ],
  uodo: ['<i>u</i>', 'Odometry input (<i>v</i>, ω).', 'm/s, rad/s', ['u']],
  Gjac: [
    '<i>G</i>',
    'Jacobian of the motion model with respect to the pose: how an error in the pose carries into the next pose.',
    '',
    ['G']
  ],
  Vjac: ['<i>V</i>', 'Jacobian of the motion model with respect to the odometry input: how odometry noise enters the pose.', '', ['V']],
  Modo: ['<i>M</i>', 'Odometry noise covariance, diag(σ<sub>v</sub>², σ<sub>ω</sub>²).', '', ['M']],
  sigx: ['σ<sub>x</sub>²', 'Variance of the <i>x</i> estimate, the top-left entry of Σ.', 'm²', ['σ_x²']],
  v: ['<i>v</i>', 'Speed along the heading.', 'm/s', ['<i>v</i>', 'v']],
  w: ['ω', 'Turn rate (yaw rate).', 'rad/s', ['ω']],
  thetaerr: ['θ', 'Heading. In the drift formula, the heading error.', 'rad', ['θ']],
  t: ['<i>t</i>', 'Time.', 's', ['t']],
  beacon: [
    'beacon',
    'Landmark at a known position on the walls. The robot measures range and bearing to the ones within reach.',
    '',
    ['beacons', 'beacon']
  ],
  rb: ['range and bearing', "Distance to a beacon, and its direction relative to the robot's heading.", 'm, rad', ['range and bearing']],
  ekf: [
    'EKF',
    'Extended Kalman filter: a Kalman filter for nonlinear models, linearized about the current estimate. It keeps one Gaussian belief (μ, Σ).',
    '',
    ['EKF']
  ],
  kgain: [
    'Kalman gain',
    'How far the estimate moves per unit of innovation. Large when the estimate is uncertain and the sensor precise.',
    '',
    ['Kalman gain']
  ],
  nu: [
    'ν',
    'Innovation <i>z</i> − <i>ẑ</i>: measured minus predicted reading, the part the filter did not expect.',
    'm, rad',
    ['ν', 'innovations', 'innovation']
  ],
  z: ['<i>z</i>', 'Measurement: range and bearing to a beacon.', 'm, rad', ['z']],
  zhat: ['<i>ẑ</i>', 'Predicted measurement, computed from the current estimate.', 'm, rad', ['ẑ']],
  Sinn: ['<i>S</i>', 'Innovation covariance <i>H</i>Σ<i>H</i>ᵀ + <i>Q</i>: how spread out the innovations should be.', '', ['S']],
  Hjac: ['<i>H</i>', 'Measurement Jacobian: how the predicted reading changes with the pose.', '', ['H']],
  Qmeas: ['<i>Q</i>', 'Measurement noise covariance, diag(σ<sub>r</sub>², σ<sub>b</sub>²).', '', ['Q']],
  K: ['<i>K</i>', 'Kalman gain Σ<i>H</i>ᵀ<i>S</i>⁻¹.', '', ['K']],
  Iid: ['<i>I</i>', 'Identity matrix.', '', ['I']],
  nees: [
    'NEES',
    "Normalized estimation error squared, <i>e</i>ᵀΣ⁻¹<i>e</i>: the true error in units of the filter's own covariance. About 3 on average for a consistent 3-state filter; above 3 means overconfident.",
    '',
    ['NEES']
  ],
  eerr: ['<i>e</i>', 'True estimation error: true pose minus estimate.', 'm, rad', ['e']],
  overconf: [
    'overconfident',
    'Its covariance is smaller than its real error: the filter trusts itself too much and underweights readings that would correct it.',
    '',
    ['overconfident']
  ],
  bias: [
    'bias',
    'Systematic error that does not average out, such as a wheel slightly larger than the model assumes. Filters model noise, not bias.',
    '',
    ['bias']
  ],
  assumed: [
    'assumed motion noise',
    'The odometry noise the filter believes in (Localize tab). Raising it widens Σ, so beacon readings count for more.',
    '',
    ['assumed motion noise']
  ],
  unlabeled: [
    'unlabeled beacons',
    'Beacons that all look alike: the filter must work out which one each reading came from (data association).',
    '',
    ['unlabeled beacons', 'unlabeled']
  ],
  mahal: [
    'Mahalanobis distance',
    'Distance counted in standard deviations, allowing for correlations: <i>d</i>² = νᵀ<i>S</i>⁻¹ν.',
    '',
    ['Mahalanobis distance']
  ],
  gate: ['gate', 'Acceptance threshold on <i>d</i>²: a reading outside it is treated as an outlier and ignored.', '', ['gate']],
  d2: ['<i>d</i>²', 'Squared Mahalanobis distance between a reading and its prediction.', '', ['d²']],
  chi2: [
    'χ²',
    'Chi-squared distribution. For a correct 2-D reading <i>d</i>² follows χ² with 2 degrees of freedom, which exceeds 9.21 only 1 % of the time.',
    '',
    ['χ²']
  ],
  clutter: ['clutter', 'False detections: readings that come from no beacon.', '', ['clutter']],
  outlier: ['outlier', 'A reading too far from its prediction to be trusted.', '', ['outliers', 'outlier']],
  kidnap: [
    'kidnapping',
    'Teleporting the robot without telling the estimator, to test whether localization recovers from a gross error.',
    '',
    ['kidnapping', 'kidnap']
  ],
  knownids: ['known IDs', 'Each reading says which beacon it came from, so no association and no gate are needed.', '', ['known IDs']],
  pf: [
    'particle filter',
    'Represents the belief by many sampled poses (particles), weighted by how well each explains the readings. It can hold several hypotheses at once.',
    '',
    ['particle filter']
  ],
  hyp: ['hypotheses', 'Candidate poses the filter is still considering.', '', ['hypotheses']],
  particle: ['particle', 'One sampled guess of the pose.', '', ['particles', 'particle']],
  motionmodel: [
    'motion model',
    'Predicts the next pose from the current pose and the odometry; each particle samples it with its own noise.',
    '',
    ['motion model']
  ],
  likelihood: ['likelihood', "How probable the actual reading is if the robot were at a particle's pose.", '', ['likelihood']],
  resample: [
    'resampling',
    'Drawing a new particle set from the old one in proportion to the weights: likely particles are copied, unlikely ones dropped.',
    '',
    ['resamples', 'resampling', 'resample']
  ],
  neff: [
    '<i>N</i><sub>eff</sub>',
    'Effective sample size 1 / Σ <i>w</i><sub>i</sub>²: <i>N</i> when all weights are equal, 1 when one particle holds all the weight.',
    '',
    ['effective sample size', 'N_eff']
  ],
  Npart: ['<i>N</i>', 'Number of particles.', '', ['N']],
  sumP: ['Σ', 'Sum over all particles (here not a covariance).', '', ['Σ']],
  wi: ['<i>w</i><sub>i</sub>', 'Normalized weight of particle <i>i</i>; the weights sum to 1.', '', ['w_i']],
  lowvar: [
    'low-variance resampling',
    'Resampling with one random number and <i>N</i> evenly spaced pointers, so the new set follows the weights as closely as possible.',
    '',
    ['low-variance resampling']
  ],
  amcl: [
    'augmented MCL',
    'Monte Carlo localization (a particle filter) that watches how well the readings fit and injects new particles when the fit suddenly drops.',
    '',
    ['augmented MCL']
  ],
  wfs: [
    '<i>w</i><sub>fast</sub>, <i>w</i><sub>slow</sub>',
    'Short- and long-term running averages of the particle likelihood. <i>w</i><sub>fast</sub> falling below <i>w</i><sub>slow</sub> means the readings have stopped fitting.',
    '',
    ['w_fast', 'w_slow']
  ],
  wavg: ['<i>w</i>', 'Average particle likelihood at this update.', '', ['w']],
  inject: [
    'injection',
    'Replacing some particles with poses drawn from the current readings, so the filter can find a robot it has lost.',
    '',
    ['injection', 'inject']
  ],
  globalloc: ['global localization', 'Finding the pose with no initial guess at all.', '', ['global localization']],
  mirror: [
    'mirror pose',
    'The pose turned 180° about the warehouse center, which unlabeled beacons cannot tell from the true one.',
    '',
    ['mirror pose']
  ],
  lidar: ['lidar', 'Laser scanner: distance to the nearest obstacle along 120 beams around the robot.', '', ['lidar']],
  slam: ['SLAM', 'Simultaneous localization and mapping: estimating the pose and the map together.', '', ['EKF-SLAM', 'SLAM']],
  landmark: ['landmark', 'A mapped feature whose position the filter estimates; here, a beacon.', '', ['landmarks', 'landmark']],
  xslam: ['<i>x</i>', 'SLAM state: the pose [<i>x</i>, <i>y</i>, θ] followed by every landmark position.', '', ['x']],
  mlm: ['<i>m</i>', 'Position of a landmark; <i>m</i>₁ₓ, <i>m</i>₁ᵧ are the coordinates of the first one.', 'm', ['m₁ₓ', 'm']],
  Pslam: ['<i>P</i>', 'Covariance of the whole SLAM state: pose and landmarks, with their correlations.', '', ['P']],
  nlm: ['<i>n</i>', 'Number of landmarks in the map.', '', ['n']],
  ppos: ['<i>p</i>', 'Robot position when the landmark is first seen.', 'm', ['p']],
  rr: ['<i>r</i>', 'Measured range to the beacon.', 'm', ['r']],
  bb: ['<i>b</i>', 'Measured bearing to the beacon, relative to the heading.', 'rad', ['b']],
  Pmm: ['<i>P</i><sub>mm</sub>, <i>P</i><sub>xx</sub>', 'Covariance of the new landmark, and of the pose.', '', ['P_mm', 'P_xx']],
  Jxz: [
    '<i>J</i><sub>x</sub>, <i>J</i><sub>z</sub>',
    'Jacobians of the new landmark position with respect to the pose and to the reading.',
    '',
    ['J_x', 'J_z']
  ],
  correlated: [
    'correlated',
    'Errors that move together: if the pose is off, the landmarks placed from it are off the same way.',
    '',
    ['correlated']
  ],
  loopclosure: [
    'loop closure',
    'Re-observing a landmark mapped long ago, which corrects the drift accumulated since.',
    '',
    ['loop closure']
  ],
  drift: ['drift', 'Error that grows steadily with the distance travelled.', '', ['drifts', 'drift']],
  // perception
  beam: ['beam', 'One lidar ray, traced through the grid cell by cell.', '', ['beams', 'beam']],
  grid: ['occupancy grid', 'The map as 0.1 m cells, each holding how likely it is to be occupied.', '', ['grid']],
  logodds: [
    'log-odds',
    "<i>l</i> = ln(<i>p</i> / (1 − <i>p</i>)) for a cell's probability <i>p</i> of being occupied: 0 is unknown, positive is probably occupied. Evidence then simply adds.",
    '',
    ['log-odds']
  ],
  l: ['<i>l</i>', 'Log-odds of a cell.', '', ['l']],
  lmeas: [
    '<i>l</i><sub>meas</sub>',
    'Evidence from one beam: <i>l</i><sub>free</sub> for the cells it crosses, <i>l</i><sub>hit</sub> for its end cell.',
    '',
    ['l_meas']
  ],
  lfh: [
    '<i>l</i><sub>free</sub>, <i>l</i><sub>hit</sub>',
    'Log-odds added for a cell a beam crosses (−0.4) and for the cell it ends in (+0.85).',
    '',
    ['l_free', 'l_hit']
  ],
  clamp: ['clamp', 'Limit a value to a range; here ±4, so a cell can always change its mind.', '', ['clamping', 'clamp']],
  estframe: [
    'estimated frame',
    'Coordinates built from the estimated pose: wherever the estimate is wrong, the map is drawn wrong.',
    '',
    ['<i>estimated</i> frame']
  ],
  costmap: ['costmap', 'The grid the planner sees: a cost for every cell, computed from the obstacle distances.', '', ['costmap']],
  disttrans: ['distance transform', 'Gives every cell its distance to the nearest occupied cell.', '', ['distance transform']],
  lethal: [
    'lethal',
    "A cell the robot's center may not enter: closer than 0.4 m to an obstacle (radius 0.3 m plus margin).",
    '',
    ['lethal']
  ],
  inflation: [
    'inflation band',
    'Band beyond the lethal cells where the cost fades to zero, so paths keep clear of walls when they can.',
    '',
    ['inflation band']
  ],
  penalty: ['penalty', 'Extra cost of a cell in the inflation band: 1 at its inner edge, 0 at its outer edge.', '', ['penalty']],
  dobs: ['<i>d</i>', 'Distance from a cell to the nearest obstacle.', 'm', ['d']],
  winf: ['<i>w</i>', 'Width of the inflation band.', 'm', ['w']],
  edgecost: ['edge cost', 'Cost of a move between neighbouring cells: its length, raised by the penalty.', '', ['edge cost']],
  frontier: [
    'frontier exploration',
    'Driving to the boundary between known free space and unknown space, to map more.',
    '',
    ['frontier exploration']
  ],
  cluster: ['cluster', 'Neighbouring lidar hits grouped as one object.', '', ['cluster']],
  track: ['track', 'One tracked person: a filter holding their position and velocity.', '', ['tracks', 'track']],
  cvkf: [
    'constant-velocity Kalman filter',
    'Kalman filter that assumes the person keeps their velocity, with random acceleration as noise.',
    '',
    ['constant-velocity Kalman filter']
  ],
  radar: [
    'radar',
    'A sensor that sends radio waves and times their echoes: range, bearing and, from the Doppler shift, radial velocity per detection. Coarse in bearing, unbothered by fog.',
    '',
    ['radar']
  ],
  doppler: [
    'radial velocity',
    'The part of the relative velocity along the line of sight, read from the Doppler shift of the echo: negative when closing. Motion across the line of sight leaves no trace in it.',
    'm/s',
    ['radial velocity', 'Doppler']
  ],
  angres: [
    'angular resolution',
    'The smallest difference in bearing at which two echoes come back as two detections; closer ones (in range and Doppler too) merge into one.',
    '°',
    ['angular resolution']
  ],
  ghost: [
    'ghost',
    'A radar detection of a real person at a place they are not: the echo bounced off a wall on the way, so it seems to come from the mirror image behind the wall.',
    '',
    ['ghosts', 'ghost']
  ],
  egomotion: [
    'ego speed',
    "The robot's own speed, here measured from the Doppler of the static echoes, which all close at v cos b.",
    'm/s',
    ['ego speed']
  ],
  ttc: [
    'time to contact',
    'Range divided by closing speed: how long until contact if nothing changes. One radar detection gives it, without any tracking.',
    's',
    ['time to contact']
  ],
  xconfirm: [
    'cross-sensor confirmation',
    "A track inside both sensors' view counts only once both have seen it: an artefact of one sensor rarely shows in the other.",
    '',
    ['cross-sensor confirmation']
  ],
  fog: [
    'fog',
    "Water droplets that scatter the lidar's light: shorter reach, missing beams, and returns from the air itself. A radar's millimetre waves pass through.",
    '',
    ['fog']
  ],
  confirm: ['confirm', 'A track counts only after three hits, so one stray detection does not create a person.', '', ['confirm']],
  coast: [
    'coast',
    'Keep predicting a track that has no detection, here for up to 1 s, while the person is hidden.',
    '',
    ['coasts', 'coast']
  ],
  xag: [
    '<i>x</i>',
    'Track state [<i>p</i><sub>x</sub>, <i>p</i><sub>y</sub>, <i>v</i><sub>x</sub>, <i>v</i><sub>y</sub>]: position and velocity.',
    'm, m/s',
    ['x']
  ],
  pxy: ['<i>p</i><sub>x</sub>, <i>p</i><sub>y</sub>', 'Tracked position.', 'm', ['p_x', 'p_y']],
  vxy: ['<i>v</i><sub>x</sub>, <i>v</i><sub>y</sub>', 'Tracked velocity, inferred from position changes.', 'm/s', ['v_x', 'v_y']],
  Fcv: ['<i>F</i>', 'State transition of the constant-velocity model: position grows by velocity × Δ<i>t</i>.', '', ['F']],
  Rproc: ['<i>R</i>', 'Process noise covariance: how much the velocity may change unpredictably per step.', '', ['R']],
  Qtrk: ['<i>Q</i>', 'Measurement noise covariance of a detected position, σ<sub>z</sub>² <i>I</i>.', '', ['Q']],
  siga: ['σ<sub>a</sub>', 'Standard deviation of the random acceleration the tracker assumes.', 'm/s²', ['σ_a']],
  pt: ['<i>p</i>(<i>t</i>)', 'Predicted position <i>t</i> seconds ahead.', 'm', ['p(t)']],
  rt: ['<i>r</i>(<i>t</i>)', 'Predicted radius <i>t</i> seconds ahead; it grows to cover prediction error.', 'm', ['r(t)']],
  ggrow: ['<i>g</i>', 'Growth rate of the predicted radius.', 'm/s', ['g']],
  pag: ['<i>p</i>', 'Current tracked position.', 'm', ['p']],
  vag: ['<i>v</i>', 'Current tracked velocity.', 'm/s', ['v']],
  rag: ['<i>r</i>', 'Radius of the person.', 'm', ['r']],
  groundtruth: ['ground truth', "The simulator's true values, which a real robot never has.", '', ['ground truth']],
  latency: ['latency', 'Delay between a reading (or command) being made and being used.', 's', ['latency']],
  tick: ['tick', 'One simulation step, 0.05 s.', 's', ['ticks', 'tick']],
  Ts: ['<i>T</i><sub>s</sub>', 'Sensor latency.', 's', ['T_s']],
  biased: ['biased', 'Wrong on average, not just noisy.', '', ['biased']],
  lagged: [
    'lagged-state filter',
    'A filter that keeps recent states (or buffers readings), so a late reading is applied at the time it was taken.',
    '',
    ['lagged-state']
  ],
  timestamp: ['timestamp', 'The time a reading was taken, stored with it.', '', ['timestamp']],
  socialforce: [
    'social forces',
    'Pedestrian model: each person accelerates toward their goal and is pushed away from the robot, other people and walls.',
    '',
    ['social forces']
  ],
  Fsf: ['<i>F</i>', 'Social force on a person: the acceleration that steers them.', 'm/s²', ['F']],
  v0p: ['<i>v</i>₀', 'Preferred walking speed.', 'm/s', ['v₀']],
  edir: ['<i>e</i>', "Unit vector toward the person's goal.", '', ['e']],
  vp: ['<i>v</i>', 'Current velocity of the person.', 'm/s', ['v']],
  tausf: ['τ', 'Relaxation time: how fast a person returns to the preferred velocity.', 's', ['τ']],
  sumO: ['Σ', 'Sum over the other people and the robot.', '', ['Σ']],
  Asf: ['<i>A</i>', 'Strength of the push.', 'm/s²', ['A']],
  Bsf: ['<i>B</i>', 'Distance over which the push fades.', 'm', ['B']],
  rij: ['<i>r</i><sub>i</sub>, <i>r</i><sub>j</sub>', 'Radii of the two bodies.', 'm', ['r_i', 'r_j']],
  dpp: ['<i>d</i>', 'Distance between the two centers.', 'm', ['d']],
  ndir: ['<i>n</i>', 'Unit vector pointing away from the other body.', '', ['n']],
  closest: [
    'closest approach',
    'Smallest distance between the robot and any person during the run (a Telemetry metric).',
    'm',
    ['closest-approach', 'closest approach']
  ],
  contacts: ['contacts', 'Times the robot touched a person.', '', ['contacts']],
  sonar: [
    'sonar',
    'Ultrasonic range sensor: it sends a ping and times the first echo, which gives one range for a whole cone about 30° wide. A ring of them fires in turn round the hull.',
    '',
    ['sonars', 'sonar', 'ultrasonic']
  ],
  cone: [
    'cone',
    "A sonar's field of view. The echo can come from anywhere in it, so the reading gives the range of the nearest thing in the cone and nothing about its bearing within the beam.",
    '',
    ['cones', 'cone']
  ],
  specular: [
    'specular reflection',
    'A smooth surface met at a slant sends the echo away, as a mirror does light: the sonar hears nothing and reads its maximum range though a wall is in its cone.',
    '',
    ['specular']
  ],
  deadzone: [
    'dead zone',
    'The range closer than which a sonar hears no echo, because the transducer is still ringing from its own ping (0.2 m here).',
    'm',
    ['dead zone']
  ],
  crosstalk: ['crosstalk', "A sonar hearing the echo of a neighbour's ping and reporting it as its own range.", '', ['crosstalk']],
  arcmodel: [
    'arc inverse sensor model',
    "The map update for one sonar reading: occupied evidence shared over the cells of the arc at the reading's range, free evidence for the cells inside the cone before it.",
    '',
    ['arc update', 'arc model']
  ],
  conelik: [
    'cone likelihood',
    "How probable a sonar reading is at a particle's pose: compared with the nearest obstacle the prior map puts inside that sonar's cone.",
    '',
    ['cone likelihood']
  ],
  guard: [
    'safety stop',
    'A collision monitor under the path tracker: it sweeps the footprint along the commanded arc against what the sensor sees now and caps the speed at what stops in time.',
    '',
    ['safety stop']
  ],
  // planning
  astar: ['A*', 'Best-first graph search: always expands the node with the smallest <i>f</i> = <i>g</i> + <i>h</i>.', '', ['A*']],
  node: ['node', 'A search state; here a grid cell.', '', ['node']],
  fcost: ['<i>f</i>', 'Estimated total cost of a path through the node, <i>g</i> + <i>h</i>.', '', ['f']],
  gcost: ['<i>g</i>', 'Cost of the best path found so far from the start to the node.', '', ['g']],
  hcost: ['<i>h</i>', 'Heuristic estimate of the cost from the node to the goal.', '', ['h']],
  heur: ['heuristic', 'An estimate of the remaining cost to the goal that steers the search toward it.', '', ['heuristics', 'heuristic']],
  admissible: [
    'admissible',
    'A heuristic that never overestimates the true cost to the goal; with it, A* returns an optimal path.',
    '',
    ['admissible']
  ],
  eightconn: ['8-connected', 'Each cell has eight neighbours: four straight, four diagonal.', '', ['8-connected']],
  octile: [
    'octile distance',
    'Shortest distance on an 8-connected grid without obstacles: diagonal steps plus straight ones.',
    '',
    ['octile distance']
  ],
  eps: ['ε', 'Heuristic weight. Above 1 the search is greedier and faster, and the path costs at most ε times the optimum.', '', ['ε']],
  expansions: ['expansions', 'Nodes the search took off its queue and expanded: the work it did.', '', ['expansions', 'expansion']],
  weighted: ['weighted A*', 'A* with <i>h</i> multiplied by ε > 1.', '', ['Weighted A*', 'weighted A*']],
  rrtstar: [
    'RRT*',
    'Rapidly-exploring random tree, optimal variant: grows a tree toward random samples and rewires it toward shorter paths.',
    '',
    ['RRT*']
  ],
  samples: ['samples', 'Random points in free space that the tree grows toward.', '', ['samples']],
  parent: ['parent', 'The node a new node connects back to; following parents leads to the start.', '', ['parent']],
  rewire: ['rewire', 'Reconnect existing nodes through a new node when that shortens their path to the start.', '', ['rewires', 'rewire']],
  neigh: ['neighbourhood', 'Nodes within radius <i>r</i> of a new node, considered as its parent and for rewiring.', '', ['neighbourhood']],
  asym: [
    'asymptotically optimal',
    'Converges to the shortest path as the number of samples grows without limit.',
    '',
    ['asymptotically optimal']
  ],
  rrad: ['<i>r</i>', 'Neighbourhood radius; it shrinks as the tree grows.', 'm', ['r']],
  ntree: ['<i>n</i>', 'Number of nodes in the tree.', '', ['n']],
  seed: ['seed', 'Starting value of the random number generator: the same seed gives the same run.', '', ['seed']],
  hybrid: [
    'Hybrid A*',
    'A* over grid cells in which every node keeps a continuous pose and every edge is an arc the car can drive.',
    '',
    ['Hybrid A*']
  ],
  heading: ['heading', 'Direction the vehicle points.', 'rad', ['heading']],
  minturn: [
    'minimum turning radius',
    'Tightest circle the car can drive, <i>L</i> / tan δ<sub>max</sub>; about 1 m here.',
    'm',
    ['minimum turning radius']
  ],
  arcs: ['arc', 'A short drive at a constant steering angle: the edges of the search.', '', ['arcs', 'arc']],
  reverse: ['reverse', 'Driving backward; each change of direction is a cusp.', '', ['reverse']],
  dijkstra: [
    'Dijkstra',
    'Search outward from the goal over the grid, giving the exact obstacle-aware distance from every cell; used here as a heuristic.',
    '',
    ['2D Dijkstra', 'Dijkstra']
  ],
  rs: [
    'Reeds–Shepp',
    'Shortest path for a car that can reverse, ignoring obstacles: a few arcs and straights. Also used as a heuristic.',
    '',
    ['Reeds–Shepp']
  ],
  analytic: [
    'analytic expansion',
    'Try a direct Reeds–Shepp path from the current node to the goal, and take it if it is collision-free.',
    '',
    ['analytic expansion']
  ],
  steerlimit: ['steering limit', 'Largest front-wheel angle, δ<sub>max</sub> = 32° here.', '°', ['steering limit']],
  fulllock: ['full-lock', 'Steering at the limit.', '', ['full-lock']],
  tracker: ['tracker', 'The path-following controller (Control tab).', '', ['trackers', 'tracker']],
  fsm: [
    'state machine',
    'A small set of states (PLAN, DRIVE, …) with rules for moving between them, drawn live in the Mission tab.',
    '',
    ['state machine']
  ],
  states: [
    'DRIVE, PLAN, NO_PATH',
    'Mission states: following a path; computing one; no path found (retry after 2 s, skip the goal after 3 failures).',
    '',
    ['DRIVE', 'PLAN', 'NO_PATH']
  ],
  replan: ['replan', 'Plan again from the current estimate.', '', ['replans', 'replan']],
  estimate: ['estimate', 'The pose the localization believes; the planner and controller use it, not the truth.', '', ['estimate']],
  speedplanner: [
    'speed planner',
    'Picks the speed along the path so the robot avoids predicted people by slowing or waiting.',
    '',
    ['speed planner']
  ],
  agent: ['agent', 'A moving obstacle; here, a person.', '', ['agent']],
  sta: [
    'Space-time A*',
    'A* over (<i>x</i>, <i>y</i>, <i>t</i>): waiting is a move, and a cell is blocked at the times a predicted person covers it.',
    '',
    ['Space-time A*']
  ],
  refspeed: ['reference speed', 'Speed used to turn moves into time, <i>v</i>₀.', 'm/s', ['reference speed']],
  horizon: ['prediction horizon', "How far ahead people's positions are predicted.", 's', ['prediction horizon']],
  ijk: ['(<i>i</i>, <i>j</i>, <i>k</i>)', 'Search state: grid cell (<i>i</i>, <i>j</i>) and time index <i>k</i>.', '', ['(i, j, k)']],
  kidx: ['<i>k</i>', 'Time index, <i>t</i> / Δ<i>t</i>.', '', ['k']],
  dtst: ['Δ<i>t</i>', 'Time per step: the time to cross one cell at the reference speed.', 's', ['Δt']],
  v0r: ['<i>v</i>₀', 'Reference speed.', 'm/s', ['v₀']],
  cij: ['<i>c</i><sub>ij</sub>', 'Center of cell (<i>i</i>, <i>j</i>).', 'm', ['c_ij']],
  pa: [
    '<i>p</i><sub>a</sub>, <i>r</i><sub>a</sub>',
    'Predicted position and radius of agent <i>a</i>; the radius grows with time.',
    'm',
    ['p_a', 'r_a']
  ],
  rrobot: ['<i>r</i><sub>robot</sub>', 'Robot radius, 0.3 m.', 'm', ['r_robot']],
  // control loop
  ectl: ['<i>e</i>', 'Lateral (cross-track) error: signed distance from the path.', 'm', ['e']],
  the: ['θ<sub>e</sub>', 'Heading error: robot heading minus path direction.', 'rad', ['θ<sub>e</sub>', 'θₑ', 'θ_e']],
  thdot: ['θ̇<sub>e</sub>', 'Rate of change of the heading error.', 'rad/s', ['θ̇ₑ', 'θ̇_e']],
  edot: ['<i>ė</i>', 'Rate of change of the lateral error.', 'm/s', ['ė']],
  v0c: ['<i>v</i><sub>0</sub>', 'Operating speed of the analysis (the cruise speed).', 'm/s', ['v<sub>0</sub>', 'v₀']],
  gpl: [
    '<i>g</i>',
    'Plant gain from the steering command to the heading rate: 1 for diff-drive, <i>v</i><sub>0</sub>/<i>L</i> for the car.',
    '',
    ['g']
  ],
  uc: ['<i>u</i>', 'Steering command: turn rate ω (diff-drive) or steering angle δ (car).', '', ['u']],
  u0: ['<i>u</i>₀', 'Steering command at the settled point on the circle.', '', ['u₀']],
  wturn: ['ω', 'Turn-rate command (diff-drive).', 'rad/s', ['ω']],
  wfreq: ['ω', 'Angular frequency of a sinusoid.', 'rad/s', ['ω']],
  delta: ['δ', 'Front-wheel steering angle (car).', 'rad', ['δ']],
  Lwb: ['<i>L</i>', 'Wheelbase of the car.', 'm', ['L']],
  integrator: [
    'integrator',
    'Its output is the running integral of its input; two in series make the double integrator.',
    '',
    ['integrators', 'integrator']
  ],
  derivative: ['derivative action', 'Feedback on the rate of change of the error; it damps the loop.', '', ['derivative action']],
  opoint: [
    'operating point',
    'The steady condition the loop is linearized about: speed, path curvature and settled offset.',
    '',
    ['operating point']
  ],
  findiff: [
    'finite differences',
    'Estimating a derivative by nudging the input slightly and measuring the change in the output.',
    '',
    ['finite differences']
  ],
  hold: [
    'hold delay',
    'A sampled controller holds each command for one tick, which on average delays it by half a tick (25 ms).',
    's',
    ['hold delay']
  ],
  actlag: [
    'actuator lag',
    'The actuator approaches each command exponentially, with time constant τ, instead of at once.',
    '',
    ['actuator lag', 'first-order lag']
  ],
  Ls: [
    '<i>L</i>(<i>s</i>)',
    'Open-loop transfer function: the loop broken at the steering command. <i>L</i>(jω) is its frequency response.',
    '',
    ['L(s)', 'L(jω)', '|L|']
  ],
  sL: ['<i>s</i>', 'Laplace variable (complex frequency); on the frequency axis <i>s</i> = jω.', '1/s', ['s']],
  Td: ['<i>T</i><sub>d</sub>', 'Loop delay: half a tick of hold, plus any latency.', 's', ['T_d']],
  wc: ['ω<sub>c</sub>', 'Gain crossover: the frequency where |<i>L</i>| = 1 (0 dB), roughly the closed-loop bandwidth.', 'rad/s', ['ω_c']],
  pm: [
    'phase margin',
    'How far the phase at crossover lies above −180°. More margin, less overshoot and more tolerance of delay.',
    '°',
    ['phase margin', 'PM']
  ],
  linearized: ['linearized', 'Approximated by a linear model, valid for small errors.', '', ['Linearized', 'linearized']],
  pd: ['PD controller', 'Proportional-derivative: feedback on the error and on its rate of change.', '', ['PD controller']],
  pp: ['pure pursuit', 'Path tracker that steers along the arc through a carrot point on the path.', '', ['Pure pursuit', 'pure pursuit']],
  carrot: [
    'carrot',
    'The point on the path a lookahead distance <i>L</i><sub>d</sub> ahead, which pure pursuit steers toward.',
    '',
    ['carrot']
  ],
  Ld: ['<i>L</i><sub>d</sub>', 'Lookahead distance of pure pursuit.', 'm', ['L_d']],
  alpha: ['α', "Bearing from the robot's heading to the carrot.", 'rad', ['α']],
  curv: ['curvature', '1 / turning radius; positive to the left.', '1/m', ['curvature']],
  bode: ['Bode plot', 'Gain in dB and phase of <i>L</i>(jω) against frequency, on logarithmic axes.', '', ['Bode plot', 'Bode']],
  dB: ['dB', 'Decibels: 20 log<sub>10</sub> of a gain; 0 dB is a gain of 1.', '', ['dB']],
  decade: ['decade', 'A factor of 10 in frequency.', '', ['decade']],
  zero: [
    'zero',
    "A zero of a transfer function: a value of <i>s</i> where it is 0, a root of its numerator. The trackers' zero at <i>s</i> = −<i>K</i><sub>e</sub><i>v</i><sub>0</sub>/<i>K</i><sub>θ</sub> comes from the heading feedback; above that frequency it adds phase lead.",
    '',
    ['zero']
  ],
  Ke: ['<i>K</i><sub>e</sub>, <i>K</i><sub>θ</sub>', 'Controller gains on lateral error and on heading error.', '', ['K_e', 'K_θ']],
  crossover: ['crossover', 'The frequency ω<sub>c</sub> where |<i>L</i>| = 1.', '', ['crossover']],
  zeta: ['ζ', 'Damping ratio of the dominant closed-loop poles: 1 is critically damped, lower values overshoot more.', '', ['ζ']],
  closedloop: ['closed loop', 'The loop with its feedback connected.', '', ['closed loop']],
  Tcl: ['|<i>T</i>|', 'Complementary sensitivity <i>L</i> / (1 + <i>L</i>): how the robot follows a path offset.', '', ['|T|']],
  Ssens: ['|<i>S</i>|', 'Sensitivity 1 / (1 + <i>L</i>): how much disturbances are amplified (above 0 dB) or suppressed.', '', ['|S|']],
  Ms: [
    '<i>M</i><sub>s</sub>',
    'Peak of |<i>S</i>|, equal to 1 / (closest distance from <i>L</i> to −1). Above 2 the loop is fragile.',
    '',
    ['M_s']
  ],
  piT: ['π/<i>T</i>', 'Nyquist frequency of the sampled loop: half the 20 Hz sampling rate, 62.8 rad/s.', 'rad/s', ['π/T']],
  nyqfreq: ['Nyquist frequency', 'Highest frequency a sampled system can represent.', 'rad/s', ['Nyquist frequency']],
  nyqcrit: [
    'Nyquist criterion',
    '<i>Z</i> = <i>N</i> + <i>P</i>: counts the unstable closed-loop poles from the encirclements of −1 and the unstable open-loop poles.',
    '',
    ['Nyquist criterion']
  ],
  pole: [
    'pole',
    'A value of <i>s</i> where the transfer function is infinite. Closed-loop poles set how the loop responds; right of the imaginary axis means unstable.',
    '',
    ['poles', 'pole']
  ],
  m1: ['−1', 'The critical point: where <i>L</i> = −1, 1 + <i>L</i> = 0 and the closed loop is on the edge of instability.', '', ['−1']],
  encircle: ['encirclements', 'Times the curve winds around −1, counted clockwise.', '', ['encirclements']],
  Nenc: ['<i>N</i>', 'Clockwise encirclements of −1.', '', ['N']],
  Zun: ['<i>Z</i>', 'Unstable closed-loop poles.', '', ['Z']],
  Pun: ['<i>P</i>', 'Unstable open-loop poles (none here).', '', ['P']],
  DT: ['Δ<i>T</i>', 'Extra delay added to the loop.', 's', ['ΔT']],
  DM: ['DM', 'Delay margin PM / ω<sub>c</sub>: the extra latency the loop tolerates before it goes unstable.', 's', ['DM']],
  limitcycle: [
    'limit cycle',
    'A sustained oscillation of fixed size: an unstable loop held in check by a saturation.',
    '',
    ['limit cycle']
  ],
  steptest: ['step test', 'Shift the path sideways at once and record how the robot settles.', '', ['step test']],
  zdisc: ['<i>z</i>', 'Pole of the discrete 20 Hz loop; <i>s</i> = ln <i>z</i> / <i>T</i>.', '', ['z']],
  Tsamp: ['<i>T</i>', 'Sample time, 0.05 s.', 's', ['T']],
  wn: ['ω<sub>n</sub>', 'Natural frequency of the dominant pole pair.', 'rad/s', ['ω_n']],
  overshoot: ['overshoot', 'How far the response passes its final value, in % of the step.', '%', ['overshoot']],
  ts: ['<i>t</i><sub>s</sub>', 'Settling time: until the response stays within 2 % of its final value.', 's', ['t_s']],
  rwf: [
    'rear-wheel feedback',
    'Path tracker that feeds back lateral and heading error through gains <i>k</i><sub>e</sub>, <i>k</i><sub>θ</sub>, with the path curvature as feedforward.',
    '',
    ['Rear-wheel feedback', 'rear-wheel feedback']
  ],
  kth: [
    '<i>k</i><sub>θ</sub>, <i>k</i><sub>e</sub>',
    'Rear-wheel feedback gains on heading error and on lateral error.',
    '',
    ['k_θ', 'k_e']
  ],
  rootlocus: ['root locus', 'The paths of the closed-loop poles as the controller gain is scaled.', '', ['root locus']],
  rhp: ['right half plane', 'Re <i>s</i> > 0: a pole there grows exponentially, so the loop is unstable.', '', ['right half plane']],
  gm: ['gain margin', 'Factor by which the loop gain can grow before the loop goes unstable.', '', ['gain margin']],
  firstorder: [
    'first-order actuator',
    'Its response approaches the command exponentially: transfer function 1/(τ<i>s</i> + 1).',
    '',
    ['first-order actuator']
  ],
  tau: ['τ', 'Actuator time constant: the time to cover 63 % of a step.', 's', ['τ']],
  mpc: [
    'MPC',
    'Model predictive control: optimizes the next commands over a horizon with a model of the vehicle, applies the first, repeats every tick.',
    '',
    ['MPC']
  ],
  moose: [
    'moose test',
    'A swerve round an obstacle into the other lane and back at a set entry speed (ISO 3888-2, the elk test): a test of what the tyres and the controller can do together near the grip limit.',
    '',
    ['moose test']
  ],
  tyrempc: [
    'tyre model in the prediction',
    'The MPC predicts with the dynamic bicycle model (sideslip <i>v</i><sub>y</sub> and yaw rate <i>r</i> as states) instead of the kinematic car (Control tab, car with tyre slip only).',
    '',
    ['Tyre model in the prediction', 'tyre model']
  ],
  predmodel: ['prediction model', 'The model MPC uses to predict how the vehicle responds to its commands.', '', ['prediction model']],
  Kc: ['<i>K</i><sub>c</sub>', 'MPC gain on its own commanded value, used when the lag is modeled.', '', ['K_c']],
  stepdist: ['step disturbance', 'A constant push that starts suddenly; here, an actuator bias.', '', ['step disturbance']],
  ess: ['<i>e</i><sub>ss</sub>', 'Steady-state lateral error left by the bias.', 'm', ['e_ss']],
  dbias: ['<i>d</i>', 'Size of the constant bias, in command units.', '', ['d']],
  Ke1: ['<i>K</i><sub>e</sub>', 'Command per metre of lateral error.', '', ['K_e']],
  pid: ['PID', 'Proportional-integral-derivative controller.', '', ['PID']],
  Ki: ['<i>k</i><sub>i</sub>', 'Integral gain.', '', ['k_i']],
  smallsig: ['small signals', 'Errors small enough that the linear model holds.', '', ['small signals']],
  ratelim: ['rate limit', 'The fastest an actuator can change, such as 1.5 rad/s of steering.', '', ['rate limit']],
  injsine: ['injected sine', 'A small sine added to the steering command to measure <i>L</i>(jω) in the simulator.', '', ['injected sine']],
  L0: ['<i>L</i><sub>0</sub>', 'Lookahead at zero speed.', 'm', ['L<sub>0</sub>']],
  kpp: [
    '<i>k</i>',
    'Lookahead growth with speed: <i>L</i><sub>d</sub> = <i>L</i><sub>0</sub> + <i>k</i>·<i>v</i><sub>0</sub>.',
    's',
    ['k']
  ],
  plantgain: ['plant gain', "Ratio of the vehicle's response to the command; here it grows with speed.", '', ['plant gain']],
  gainsched: ['gain scheduling', 'Changing the controller gains with the operating condition, here the speed.', '', ['gain scheduling']],
  cruise: ['cruise speed', 'Target speed on a straight path (Control tab).', 'm/s', ['cruise speed']],
  openloop: ['open loop', 'No feedback: the command is computed without measuring the result.', '', ['open']],
  Gs: ['<i>G</i>(<i>s</i>)', 'Transfer function of the speed actuator chain.', '', ['G(s)']],
  Tlat: ['<i>T</i><sub>lat</sub>', 'Control latency.', 's', ['T_lat']],
  bandwidth: ['bandwidth', 'The frequency up to which the output follows the input.', 'rad/s', ['bandwidth']],
  rise: ['rise time', 'Time from 10 % to 90 % of a step.', 's', ['rise']],
  aacc: ['<i>a</i>', 'Acceleration command.', 'm/s²', []],
  Kv: [
    '<i>K</i><sub>v</sub>, <i>K</i><sub>vc</sub>, <i>K</i><sub>u</sub>',
    'MPC gains on the speed error, on the commanded-speed error, and on its previous acceleration.',
    '',
    ['K_v', 'K_vc', 'K_u']
  ],
  vref: ['<i>v</i><sub>ref</sub>, <i>v</i><sub>cmd</sub>', 'Speed from the profile, and the commanded speed.', 'm/s', ['v_ref', 'v_cmd']],
  aprev: ['<i>a</i><sub>prev</sub>', 'Previous acceleration command.', 'm/s²', ['a_prev']],
  eest: ['<i>e</i><sub>est</sub>', 'Lateral error computed from the estimate: what the controller actually sees.', 'm', ['e_est']],
  injection: [
    'injection',
    'Measuring <i>L</i>(jω) by adding a sine to the steering command and recording the response.',
    '',
    ['injection']
  ],
  feedforward: ['feedforward', 'A command computed from the path itself (here its curvature), added to the feedback.', '', ['feedforward']],
  offset: ['Offset chip', 'Analysis readout of the steady lateral offset the tracker settles at on the circle.', 'm', ['Offset chip']],
  steerrate: ['steering-rate limit', 'The fastest the steering angle can change, 1.5 rad/s.', 'rad/s', ['steering-rate limit']],
  stanley: ['Stanley', "Path tracker that steers by the heading error plus a term in the front axle's cross-track error.", '', ['Stanley']],
  frontiercell: [
    'frontier cell',
    'A known-free cell with an unknown neighbour: standing there, the lidar would see something new. Frontiers are clusters of them.',
    '',
    ['frontier cells', 'frontier cell', 'frontiers']
  ],
  floorseen: [
    'floor seen',
    "The share of the true free floor whose cells the robot's map knows (free or occupied). What exploration maximizes.",
    '%',
    ['floor seen', 'floor is seen', 'of the floor']
  ],
  scanmatch: [
    'scan matching',
    'Aligning a lidar scan to a map (or to an earlier scan) by moving the pose until the hits fall on the walls; the result is a pose fix.',
    '',
    ['scan matching', 'scan-matched', 'scan match']
  ],
  gaussnewton: [
    'Gauss–Newton',
    'Least squares by repeated linearization: each step solves H δ = −b with H = Σ JᵀJ, b = Σ Jᵀ r, and moves the estimate by δ.',
    '',
    ['Gauss–Newton', 'Gauss-Newton']
  ],
  posegraph: [
    'pose graph',
    'Keyframe poses as nodes, relative-pose measurements (odometry, loop closures) as edges; optimizing it moves every past pose at once.',
    '',
    ['pose graph', 'pose-graph']
  ],
  keyframe: ['keyframe', 'A pose kept with its scan, every half metre or so; the nodes of the pose graph.', '', ['keyframes', 'keyframe']],
  icp: [
    'ICP',
    'Iterative closest point: pair each point with its nearest in the other scan, solve the best rigid alignment of the pairs, repeat.',
    '',
    ['ICP']
  ],
  dstar: [
    'D* Lite',
    'An incremental A* run from the goal: the search is kept between plans and only the cells a change touched are repaired.',
    '',
    ['D* Lite']
  ],
  rhs: [
    'rhs',
    "A cell's one-step lookahead: the best cost through any neighbour; where it differs from g the cell needs repair.",
    '',
    ['rhs', 'lookahead']
  ],
  km: [
    'k_m',
    "D* Lite's key offset: the heuristic change from the robot's motion, added once instead of re-keying the queue.",
    '',
    ['k_m']
  ],
  vo: [
    'velocity obstacle',
    'The set of robot velocities that collide with a moving person within the horizon, assuming the person keeps their velocity: a cone in velocity space.',
    '',
    ['velocity obstacles', 'velocity obstacle']
  ],
  rvo: [
    'reciprocal velocity obstacles',
    'Velocity obstacles for two parties that both avoid: each takes half the detour, which stops the dance of two VO agents.',
    '',
    ['Reciprocal velocity obstacles', 'reciprocal velocity obstacles', 'RVO']
  ],
  conv1d: [
    '1D convolution',
    'A small filter slid along the ring of beams, so each output depends on a few neighbouring beams; stacked, the layers see further.',
    '',
    ['one-dimensional convolution', '1D convolution', 'convolution']
  ],
  precision: ['precision', 'The share of detections that are real: true detections over all detections.', '', ['precision']],
  recall: ['recall', 'The share of real people that were detected: true detections over detectable people.', '', ['recall']],
  distshift: [
    'distribution shift',
    'A learned block meeting inputs unlike its training data: a new sensor, site or behaviour; the central risk of learned components.',
    '',
    ['distribution shift']
  ],
  bc: [
    'behaviour cloning',
    'Imitation as regression: fit a function from what the expert saw to what it did, and run the function.',
    '',
    ['behaviour cloning', 'Behaviour cloning', 'imitation']
  ],
  compounding: [
    'compounding error',
    "An imitator's small mistakes take it to states the expert never showed, where the next mistakes are larger: the cost grows with the square of the horizon.",
    '',
    ['compounding error', 'Compounding error', 'compound']
  ],
  dagger: [
    'DAgger',
    'Dataset aggregation: let the learned policy drive, have the expert label the states it reaches, retrain on everything.',
    '',
    ['DAgger']
  ],
  dart: [
    'noise injection',
    "Perturb the expert's executed commands while recording its intended ones, so the demonstrations cover the states a learner will drift into (DART).",
    '',
    ['noise injection', 'Noise injection', 'DART']
  ],
  mlp: [
    'multilayer perceptron',
    'Dense layers with a nonlinearity between them: the plainest neural network, a function of a flat input vector.',
    '',
    ['multilayer perceptron', 'dense layers']
  ],
  mixture: [
    'mixture of Gaussians',
    'A distribution that is a weighted sum of several Gaussians: here K futures for a person, or K candidate paths for the end-to-end policy, each with a probability. Trained by its negative log-likelihood, it is a mixture density network.',
    '',
    ['mixture of three Gaussians', 'mixture of Gaussians', 'mixture']
  ],
  resp: [
    'responsibility',
    'How much of an outcome one mixture component explains: its probability times its likelihood, normalized over the components. It is the weight each future gets in the gradient.',
    '',
    ['responsibilities', 'responsibility']
  ],
  wta: [
    'winner-takes-all',
    'Train only the future nearest the outcome (and the probability to pick it): the limit of the mixture loss as σ goes to zero.',
    '',
    ['winner-takes-all', 'Winner-takes-all']
  ],
  multimodal: [
    'multimodal',
    'With more than one likely outcome: a person at the end of an aisle may walk on or turn back, and the average of the two is a place nobody goes.',
    '',
    ['multimodal', 'multi-modal', 'modes']
  ],
  prederr: [
    'prediction error',
    'The distance between where a predictor put a person t seconds ahead and where they were t seconds later (the displacement error at t). The metrics show it at 1 s and 2 s.',
    '',
    ['prediction error']
  ]
};
// Terms each lesson uses, in reading order (keyed by lesson title)
// the car with tyre slip (lessons on the dynamic bicycle model)
Object.assign(GLOSS, {
  dynbike: [
    'dynamic bicycle model',
    'The bicycle model with mass, yaw inertia and tyres that slip. Its states are the lateral velocity and the yaw rate at the centre of mass (chapter 1 §4).',
    '',
    ['dynamic bicycle model']
  ],
  tyreslip: [
    'tyre slip',
    'A tyre pushes sideways only by sliding a little: the contact patch deforms and the wheel moves at a small angle to where it points.',
    '',
    ['tyre slip']
  ],
  slipang: [
    'slip angle',
    "Angle between where a tyre points and where it moves. Below the grip limit the tyre's sideways force is proportional to it.",
    'rad',
    ['slip angle', 'α_f', 'α_r']
  ],
  cornstiff: [
    'cornering stiffness',
    'Sideways force of an axle per radian of slip angle: <i>C</i><sub>f</sub> front, <i>C</i><sub>r</sub> rear.',
    'N/rad',
    ['cornering stiffness', 'C_f', 'C_r']
  ],
  kus: [
    '<i>K</i><sub>us</sub>',
    'Understeer gradient (<i>m</i>/<i>L</i>)(<i>l</i><sub>r</sub>/<i>C</i><sub>f</sub> − <i>l</i><sub>f</sub>/<i>C</i><sub>r</sub>): the extra steering per unit of lateral acceleration. Positive: understeer.',
    'rad/(m/s²)',
    ['understeer gradient', 'K_us']
  ],
  vch: [
    '<i>v</i><sub>ch</sub>',
    'Characteristic speed √(<i>L</i>/<i>K</i><sub>us</sub>): the yaw-rate gain per unit of steering peaks there, at half of <i>v</i>/<i>L</i>, and falls above it.',
    'm/s',
    ['characteristic speed', 'v_ch']
  ],
  understeer: [
    'understeer',
    'The car turns less than its steering geometry says, and the more so the faster it goes (<i>K</i><sub>us</sub> > 0).',
    '',
    ['understeer']
  ],
  sideslip: [
    'sideslip β',
    "Angle between the car's heading and the direction its centre of mass moves, atan(<i>v</i><sub>y</sub>/<i>v</i><sub>x</sub>).",
    'rad',
    ['sideslip', 'β']
  ],
  yawr: ['<i>r</i>', 'Yaw rate of the car with tyre slip, a state of its own: θ̇ = <i>r</i>.', 'rad/s', ['<i>r</i>']],
  ay: ['<i>a</i><sub>y</sub>', 'Lateral acceleration, <i>v</i>²κ in a steady turn.', 'm/s²', ['lateral acceleration', 'a_y']],
  mug: [
    'μ<i>g</i>',
    'Grip limit: the largest lateral acceleration the tyres can hold, the friction coefficient μ times <i>g</i>.',
    'm/s²',
    ['grip limit', 'μg']
  ],
  alatcap: [
    '<i>a</i><sub>lat</sub>',
    "The speed profile's lateral-acceleration cap (Control tab): <i>v</i> ≤ √(<i>a</i><sub>lat</sub>/κ) in a curve. The lab's stand-in for the grip limit.",
    'm/s²',
    ['a_lat']
  ],
  yawmode: [
    'yaw mode',
    "The car's own response of yaw rate to steering: two poles set by mass, inertia and tyres, fast and well damped at low speed, slower and less damped above <i>v</i><sub>ch</sub>.",
    '',
    ['yaw mode']
  ],
  gyro: [
    'yaw-rate gyro',
    'A sensor that measures the yaw rate directly, independent of the wheels: no wheel-calibration bias, its own small noise and its own bias. On the car with tyre slip it also sees the slip.',
    '',
    ['yaw-rate gyro']
  ],
  zupt: [
    'zero-velocity update',
    'Standing still, the gyro should read zero, so its average then is its bias; subtracting that estimate from later readings removes the drift it would cause. Every stop re-calibrates.',
    '',
    ['zero-velocity update', 'ZUPT', 'zero-velocity updates']
  ],
  lqr: [
    'LQR',
    'Linear-quadratic regulator: the state feedback that minimizes ∫ xᵀQx + uᵀRu dt for a linear plant; the gains come from the Riccati equation, and the closed-loop poles follow from the weights rather than being chosen directly.',
    '',
    ['LQR', 'linear-quadratic regulator']
  ],
  poleplace: [
    'pole placement',
    'Choosing the closed-loop poles first and solving for the feedback gains that put them there; for the two-integrator loop two gains place one pair exactly, before the delays move it.',
    '',
    ['pole placement']
  ]
});
// GNSS (Localization lesson 9)
Object.assign(GLOSS, {
  gnss: [
    'GNSS',
    'Global navigation satellite system (GPS, Galileo, GLONASS, BeiDou): a receiver that computes its position from satellite signals, anywhere under open sky.',
    '',
    ['GNSS', 'fix', 'fixes']
  ],
  gaussmarkov: [
    'Gauss–Markov process',
    'A random signal that drifts and forgets: each step keeps a fraction e<sup>−Δ<i>t</i>/τ</sup> of its value and adds fresh noise, so it wanders with spread σ<sub>b</sub> and is correlated over about τ seconds.',
    '',
    ['Gauss–Markov', 'Gauss-Markov']
  ],
  white: [
    'white noise',
    'Noise drawn fresh at every reading, independent of the last one. Every Kalman update assumes its measurement noise is white.',
    '',
    ['white']
  ],
  multipath: [
    'multipath',
    'A satellite signal that reaches the antenna by a reflection as well as, or instead of, directly: the longer path shifts the fix by metres, next to walls and vehicles.',
    '',
    ['multipath', 'reflections']
  ],
  augstate: [
    'augmented state',
    'The filter state extended with quantities that are not the pose but shape the error, here the GNSS bias, so that the filter estimates them instead of treating their effect as noise.',
    '',
    ['bias in the state']
  ],
  outage: [
    'outage',
    'A spell with no readings from a sensor: under a bridge, in a tunnel, or a beacon that is down.',
    '',
    ['outage', 'outages']
  ]
});
// the Safety lessons (docs/lessons/saf, chapter 8): the standards' ideas in the lab's words
Object.assign(GLOSS, {
  odd: [
    'operating domain',
    'The conditions a system is designed to work in (ODD, operational design domain): each attribute of the world, the mission and the robot with the values it may take. Safety claims are made about the domain, not the world.',
    '',
    ['operating domain', 'ODD']
  ],
  margin: [
    'margin',
    'What is left between the robot and an obstacle once the errors are taken off: in an aisle, half the width beside the centred robot, minus the position and tracking errors.',
    'm',
    ['margins', 'margin']
  ],
  wallclear: [
    'wall clearance',
    "The smallest gap between the robot's true footprint and a rack or wall over the run (Metrics).",
    'm',
    ['wall clearance']
  ],
  hara: [
    'hazard analysis and risk assessment',
    'Listing the situations a system meets and the harm it could do in each, and rating each by severity, exposure and controllability, to decide which need a safety goal.',
    '',
    ['hazard analysis and risk assessment', 'hazard analysis']
  ],
  hazard: [
    'hazard',
    'Something the system can do that could hurt someone: drive into a person, into a rack, stop where a person walks into it.',
    '',
    ['hazard']
  ],
  hazevent: [
    'hazardous event',
    'A hazard in a given operational situation: driving into a person while passing them in an aisle.',
    '',
    ['hazardous events', 'hazardous event']
  ],
  opsit: [
    'operational situation',
    'A situation the system meets in use: driving down an aisle a person is walking, reversing out of a bay.',
    '',
    ['operational situations', 'operational situation']
  ],
  severity: [
    'severity',
    'How badly a hazardous event could hurt. The lab rates the relative speed at contact: touch below 0.3 m/s, bump up to 1 m/s, strike above (the lab’s own scale, not a standard’s).',
    '',
    ['severity']
  ],
  sevclass: [
    'touch, bump, strike',
    'The lab’s severity classes for a contact, by relative speed: below 0.3 m/s, 0.3 to 1 m/s, above 1 m/s (Metrics → Contacts by speed).',
    '',
    ['strikes', 'strike', 'bumps', 'bump']
  ],
  vrel: [
    'relative speed',
    'The speed of the robot relative to the person at contact: the difference of their true velocities.',
    'm/s',
    ['relative speed']
  ],
  exposure: [
    'exposure',
    'How often a situation occurs; the lab measures it as the share of the operating time spent in it.',
    '',
    ['exposure']
  ],
  controllability: [
    'controllability',
    'Whether the robot itself can still avoid the harm, or soften it, once the hazardous event begins: by braking it can when the time to contact is longer than its stopping time. People stepping aside are not counted: that is credit taken from others.',
    '',
    ['controllability']
  ],
  asil: [
    'integrity level',
    'ISO 26262’s rating of a hazardous event, from QM through A to D, set by its severity, exposure and controllability; it sets how rigorous the development must be.',
    '',
    ['integrity level', 'ASIL']
  ],
  safetygoal: [
    'safety goal',
    'The top-level requirement for a hazardous event, stated so it can be checked: no contact with a person above 0.3 m/s.',
    '',
    ['safety goals', 'safety goal']
  ],
  sotif: [
    'SOTIF',
    'Safety of the intended functionality (ISO 21448): risk from a function that is not good enough for some situations, with nothing broken.',
    '',
    ['SOTIF']
  ],
  funcins: [
    'functional insufficiency',
    'A way a function, or its sensors and algorithms, is not good enough for some situations, though working as specified.',
    '',
    ['functional insufficiency', 'insufficiency']
  ],
  trigcond: [
    'triggering condition',
    'A situation that exposes a functional insufficiency: fog for a lidar, a person turning back for a constant-velocity prediction.',
    '',
    ['triggering conditions', 'triggering condition']
  ],
  fourareas: [
    'known and unknown, safe and unsafe',
    'The four areas situations fall into. The work is to fix or restrict the known-unsafe and to search for the unknown-unsafe.',
    '',
    ['known-unsafe']
  ],
  fault: ['fault', 'Something broken: a sensor that fails, a bias nobody was told about. The subject of ISO 26262.', '', ['fault']],
  degraded: [
    'degraded mode',
    'What a system does when it notices it cannot do its job fully: slower, stopped, or holding to relocalize.',
    '',
    ['degraded mode']
  ],
  lostguard: [
    'lost guard',
    'Holds the robot and turns it in place when the position σ passes 1 m, until the estimate has relocalized.',
    '',
    ['lost guard']
  ],
  ftti: [
    'fault tolerant time interval',
    'The time from a fault to the harm it would lead to if nothing reacted. Detection and reaction together must fit inside it.',
    's',
    ['fault tolerant time interval']
  ],
  safetymech: [
    'safety mechanism',
    'What detects a fault and brings the system to a state where it can do no harm: here a health light and what reacts to it.',
    '',
    ['safety mechanisms', 'safety mechanism']
  ],
  safestate: [
    'safe state',
    'A state in which a fault can do no harm: stopped, or crawling. Rarely a useful one, so it is chosen for the situation.',
    '',
    ['safe state']
  ],
  faultsched: [
    'fault schedule',
    'The lab’s timetable of faults: settings changed at given seconds (a sensor off, a motor biased), applied during the run and logged.',
    '',
    ['fault schedule']
  ],
  fmea: [
    'FMEA',
    'Failure-mode and effects analysis: for each part, how it can fail, the effect, how the failure is detected, and what reacts.',
    '',
    ['FMEA', 'failure-mode']
  ],
  scenario: [
    'scenario',
    'One point of the operating domain: a generated world, the weather, the people’s behaviour and the run’s seed.',
    '',
    ['scenarios', 'scenario']
  ],
  runmargin: [
    'margin',
    'A run’s score in the search: minus the fastest contact’s speed if there was a contact, else the smallest gap to a person or a rack. Lower is worse.',
    '',
    ['margin']
  ],
  refine: [
    'refinement',
    'The second half of a search: runs near the worst found so far, each range moved by a step that shrinks every round.',
    '',
    ['refinement', 'refined']
  ],
  scenset: [
    'scenario set',
    'Scenarios kept from a search and rerun after every change, so that a fix is judged on all of them.',
    '',
    ['scenario sets', 'scenario set']
  ],
  ttcsafe: [
    'time to contact',
    'The gap to a person divided by the speed the two are closing at: how long until contact if both keep their velocities (Metrics).',
    's',
    ['time to contact']
  ],
  slice: [
    'slice',
    'A part of the situations a block meets, named so that its performance can be measured there alone: people far away, people who change course. A requirement on a slice is how the hazard reaches the data.',
    '',
    ['slices', 'slice']
  ],
  coverage: [
    'data coverage',
    "How well a learned block's training data spans the situations of the operating domain, slice by slice. What the data does not cover, the block was never shown.",
    '',
    ['data coverage', 'coverage']
  ],
  ood: [
    'out of distribution',
    "An input unlike those a learned block was trained on. The lab scores it as the root mean square of the z-scores of a short description of the input against the training inputs' statistics; above the 99th percentile of the training scores it counts as outside.",
    '',
    ['out-of-distribution score', 'out of distribution', 'out-of-distribution']
  ],
  monitor: [
    'runtime monitor',
    'A check that runs while the system works and says when it has left the conditions it was made for: the health lights, the out-of-distribution score. It detects; something else has to react.',
    '',
    ['monitors', 'monitor']
  ],
  aeb: [
    'emergency brake',
    'A last-moment stop on one sensor, here the radar: an echo in the way whose time to contact falls below a threshold stops the robot. It needs no tracking, so it is fast, and it stops for whatever the sensor reports.',
    '',
    ['emergency brake']
  ],
  falsestop: [
    'false stop',
    'A stop for nothing there: a ghost, clutter, a wall the brake took for an obstacle in the way. The price of a fast safety function, counted against what it prevents.',
    '',
    ['stops for nothing', 'false stops', 'false stop']
  ],
  safecase: [
    'safety case',
    'The argument, with its evidence, that a system is acceptably safe for a given use: claims, how they are broken down, the evidence for each, and what they assume. Kept current as the system changes.',
    '',
    ['safety case', 'assurance argument']
  ],
  gsn: [
    'Goal Structuring Notation',
    'A way to draw a safety argument: goals (claims) as boxes, strategies as parallelograms, solutions (evidence) as circles, context, assumptions and justifications beside them.',
    '',
    ['Goal Structuring Notation', 'GSN']
  ],
  defeater: [
    'defeater',
    'A reason a claim might be false that the argument does not address. Finding them, and turning each into a claim with its own evidence, is how an argument improves.',
    '',
    ['defeaters', 'defeater']
  ],
  assumption: [
    'assumption',
    'Something a claim needs that nobody measured: people give way, the floor is dry. Made visible in the argument so that it can be checked, monitored or enforced by operating rules.',
    '',
    ['assumptions', 'assumption']
  ],
  oddmon: [
    'ODD monitor',
    "A check, running in operation, of what the robot can observe of its operating domain (the lidar's return share for the weather, a learned block's input) against the sheet; outside, a minimal-risk manoeuvre.",
    '',
    ['ODD monitor']
  ],
  mrm: [
    'minimal-risk manoeuvre',
    'What the system does when it can no longer carry on safely: here, crawl at 0.3 m/s or stop until it is back inside its domain.',
    '',
    ['minimal-risk manoeuvre']
  ],
  ruleof3: [
    'rule of three',
    'With no event in T hours, the rate is below 3 / T per hour with 95 % confidence; so a target of one per N hours needs about 3N hours without an event.',
    '',
    ['rule of three']
  ],
  poisson: [
    'Poisson interval',
    'The exact interval for a rate from a count of independent events: the rates for which the count seen would sit in the tails of the Poisson distribution.',
    '',
    ['Poisson interval', 'Poisson']
  ],
  impsamp: [
    'importance sampling',
    "Drawing more of the cases where the event is likely and weighting each by how much likelier the domain's own mix would have drawn it, so that the estimate still describes the domain.",
    '',
    ['importance sampling']
  ],
  effhours: [
    'effective hours',
    'What a weighted sample is worth in unweighted hours, (Σ w T)² / Σ w² T: less than it ran when the weights vary.',
    'h',
    ['effective hours']
  ],
  leadind: [
    'leading indicator',
    'A measure that rises with the harm but far more often than it happens, so it moves first: seconds very close to a person, a time to contact under 1 s. A safety performance indicator watched in operation.',
    '',
    ['leading indicators', 'leading indicator', 'safety performance indicators', 'safety performance indicator']
  ],
  spearman: [
    "Spearman's ρ",
    'The correlation of ranks: 1 when two measures order the runs the same way, 0 when their orders are unrelated.',
    '',
    ["Spearman's ρ", 'Spearman']
  ],
  avail: [
    'availability',
    'How much of its job the system still does: time spent moving rather than stopped or slowed, missions finished. What a mitigation usually pays with.',
    '',
    ['availability']
  ],
  // terms the lessons use before a chapter defines them
  frenet: [
    'Frenet equations',
    "The motion written in the path's own frame (the Frenet frame): distance along the path, lateral error <i>e</i>, heading error θ<sub>e</sub>. On a straight path ė = <i>v</i> sin θ<sub>e</sub> and θ̇<sub>e</sub> = ω; a curve of curvature κ subtracts the path's own turning from θ̇<sub>e</sub>.",
    '',
    ['Frenet equations', 'Frenet equation', 'Frenet frame', 'Frenet']
  ],
  inscribed: [
    'inscribed-angle theorem',
    "In a circle, the angle a chord subtends at the circumference is half the angle at the centre. It gives pure pursuit's arc through the carrot the curvature 2 sin α / <i>L</i>.",
    '',
    ['inscribed-angle theorem', 'inscribed angle theorem']
  ],
  argprinc: [
    'argument principle',
    "As <i>s</i> goes once round a closed contour, a function's value winds round 0 as many times as it has zeros inside minus poles inside. Applied to 1 + <i>L</i> on the right half plane, it is the Nyquist criterion.",
    '',
    ['argument principle']
  ],
  descfn: [
    'describing function',
    "The gain a nonlinearity shows to a sine of amplitude <i>A</i>: the first harmonic of its output over the input. A saturation's is 1 for small sines and falls as <i>A</i> grows, so a loop that clips acts as a loop with less gain.",
    '',
    ['describing function', 'describing-function']
  ],
  lyapunov: [
    'Lyapunov argument',
    'A proof of convergence without solving the motion: find an energy-like function of the errors (a Lyapunov function) that is positive away from the goal and never grows along the motion, so the errors cannot grow either.',
    '',
    ['Lyapunov argument', 'Lyapunov function', 'Lyapunov']
  ],
  pade: [
    'Padé approximation',
    'A ratio of polynomials that matches a pure delay <i>e</i><sup>−s<i>T</i></sup> at low frequency, for example (1 − s<i>T</i>/2) / (1 + s<i>T</i>/2), so that a delay can enter a design made for rational transfer functions.',
    '',
    ['Padé approximation', 'Padé']
  ],
  joseph: [
    'Joseph form',
    'The covariance update written as (<i>I</i> − <i>KH</i>) Σ (<i>I</i> − <i>KH</i>)<sup>T</sup> + <i>K Q K</i><sup>T</sup> (<i>Q</i> the measurement noise): the same result as (<i>I</i> − <i>KH</i>) Σ for the optimal gain, but it stays symmetric and positive in floating point.',
    '',
    ['Joseph form', "Joseph's form", 'Joseph']
  ],
  bresenham: [
    "Bresenham's algorithm",
    'Walking a straight line through a grid one cell at a time with integer steps only: the cells a beam crosses on its way to its end point.',
    '',
    ["Bresenham's algorithm", "Bresenham's walk", 'Bresenham']
  ],
  lockin: [
    'lock-in',
    'Measuring one frequency in a noisy signal: multiply it by a sine and a cosine at that frequency and average over whole cycles; what is left is the amplitude and phase at that frequency. How the injection test reads <i>L</i>(jω).',
    '',
    ['lock-in']
  ]
});
const LESSON_TERMS = {
  'What the stack was built for: the operating domain':
    'odd margin wallclear contacts sevclass speedplanner pf unlabeled costmap inflation lidar beacon fog track',
  'Hazards and risk: from situations to safety goals':
    'hara hazard hazevent opsit severity sevclass vrel exposure controllability ttcsafe asil safetygoal speedplanner socialforce contacts closest sotif',
  'Something breaks: detect it, react, in time':
    'fault ftti safetymech safestate faultsched fmea degraded lostguard lidar beacon pf sigx contacts sevclass speedplanner',
  'Learned blocks: the data is the specification':
    'slice coverage ood monitor recall distshift multimodal prederr mlp fog track speedplanner contacts lidar beam',
  'The safety argument: claims, evidence, and what breaks it':
    'safecase gsn defeater assumption oddmon mrm odd hazard contacts sevclass scenario scenset ruleof3 fog lidar ood',
  'How many hours make it safe enough':
    'ruleof3 poisson impsamp effhours leadind spearman exposure scenario refine sevclass contacts closest ttcsafe odd',
  'Mitigations, and what they cost':
    'aeb falsestop avail ttc radar doppler ghost clutter guard fog sotif trigcond safestate contacts sevclass scenset monitor',
  'Looking for the failures nobody wrote down':
    'scenario runmargin refine scenset odd fourareas trigcond sevclass contacts guard speedplanner',
  'Nothing breaks, and it still fails: triggering conditions':
    'sotif funcins trigcond fourareas fault speedplanner multimodal fog lidar track lostguard mirror unlabeled pf sonar deadzone guard ttcsafe degraded contacts sevclass',
  'GNSS: the noise is not white':
    'gnss gaussmarkov white bias augstate multipath outage gate d2 chi2 nees band2s overconf consistent ekf Hjac K odometry deadreck kidnap joseph',
  'Placing the poles on purpose: pole placement and LQR': 'poleplace lqr pole zeta wn Ke kth rwf DM pm overshoot ts plantgain hold pade',
  'Pose-graph SLAM: the map that closes the loop':
    'posegraph keyframe loopclosure icp scanmatch gaussnewton drift odometry covariance gyro lidar logodds frontier',
  'Scan matching: the lidar as a position sensor':
    'scanmatch gaussnewton lidar disttrans ekf kgain nees gate d2 kidnap covariance ellipse poserr beacon',
  'A gyro in the loop: heading is the expensive error':
    'gyro bias zupt deadreck odometry thetaerr sigx Modo poserr consistent nees band2s ekf beacon',
  'Dead reckoning drifts, and knows it':
    'deadreck odometry arc v w covariance mu gmot uodo Sigma Gjac Vjac Modo sigx t thetaerr ellipse poserr band2s consistent',
  'The Kalman update, and NEES as a lie detector':
    'beacon rb ekf nu z zhat kgain Sinn Hjac Qmeas K mu Sigma Iid nees eerr overconf bias assumed joseph',
  'Gating, and the kidnapped robot':
    'kidnap particle ellipse poserr unlabeled mahal gate d2 nu Sinn chi2 clutter ekf knownids pf inject hyp',
  'Particles: resampling, injection and symmetry':
    'pf motionmodel particle likelihood resample neff lowvar sumP wi Npart amcl wfs wavg inject globalloc mirror unlabeled lidar',
  'EKF-SLAM: the map is part of the state':
    'slam landmark xslam mlm Pslam nlm ppos rr bb Pmm Jxz Qmeas correlated drift deadreck loopclosure',
  'Log-odds mapping': 'lidar beam grid logodds clamp l lmeas lfh estframe deadreck bresenham',
  'Sonar: one number for a whole cone':
    'sonar cone specular deadzone crosstalk arcmodel conelik guard logodds lmeas pf likelihood contacts closest lidar',
  'Costmap: lethal cells and the inflation band': 'costmap disttrans lethal inflation dobs penalty winf edgecost frontier',
  'Tracking people: from lidar hits to tracks':
    'cluster lidar cvkf track mahal confirm coast xag pxy vxy Fcv Rproc Qtrk siga d2 pt pag vag t rt rag ggrow groundtruth',
  'Sensor latency: stale readings, moving prediction': 'latency tick lidar beacon nu Ts v nees ekf pf inject timestamp lagged biased',
  'A learned detector: people from the shape and motion of the hits':
    'conv1d precision recall distshift track cvkf cluster lidar logodds agent icp speedplanner odometry deadreck pf',
  'A learned predictor: three futures for each person':
    'mlp mixture resp wta multimodal prederr cvkf track speedplanner socialforce contacts closest groundtruth distshift',
  'Radar: speed from the echo':
    'radar doppler angres ghost egomotion ttc xconfirm fog cvkf track gate chi2 mahal ekf Hjac confirm coast speedplanner moose lidar joseph',
  'Velocity obstacles: steering around people in velocity space':
    'vo rvo track cvkf agent speedplanner socialforce contacts closest lidar costmap tracker',
  'People who react': 'socialforce Fsf v0p edir vp tausf sumO Asf rij dpp Bsf ndir contacts closest',
  'A*: the heuristic and ε': 'astar node fcost gcost hcost heur admissible eightconn octile eps weighted expansions',
  'RRT*: sampling, rewiring, and luck': 'rrtstar samples parent rewire neigh asym rrad ntree seed',
  'Hybrid A*: planning for a car': 'hybrid heading minturn arcs reverse heur hcost eps dijkstra rs analytic steerlimit fulllock tracker',
  'Replanning and the behaviour layer': 'fsm replan lethal estimate speedplanner agent states costmap',
  'An end-to-end policy: from the scan to a path, and why it is hard':
    'bc compounding dagger dart mlp mixture resp wta multimodal distshift astar costmap inflation tracker lidar precision speedplanner',
  'D* Lite: repairing the plan instead of starting over':
    'dstar rhs km astar heur expansions costmap lethal inflation penalty replan fsm eps node',
  'Frontier exploration: the robot picks its own goals':
    'frontier frontiercell floorseen logodds lethal inflation costmap fsm replan estimate',
  'Space-time A*: planning with time as a coordinate': 'sta refspeed horizon ijk kidx t dtst v0r cij pa rrobot speedplanner expansions',
  'The loop being analyzed':
    'tracker v0c integrator the gpl uc wturn delta Lwb ectl derivative opoint findiff hold latency actlag frenet zero',
  'Pure pursuit is a PD controller': 'pd carrot Ld alpha the ectl pp curv linearized wturn v0c Ls sL Td wc pm delta Lwb gpl inscribed',
  'Reading the Bode plot': 'bode Ls dB decade zero sL Ke v0c crossover wc pm zeta closedloop Tcl Ssens Ms piT nyqfreq lockin',
  'Nyquist and the −1 point': 'pole Ls m1 wfreq nyqcrit encircle Nenc Zun Pun Ms Td argprinc',
  'Delay margin: the latency budget': 'pm DT wc DM latency limitcycle steptest descfn',
  'Poles, damping and the step response': 'pole zdisc sL Tsamp zeta wn overshoot ts rwf v0c kth rootlocus rhp gm lyapunov',
  'Actuator lag, and what MPC assumes': 'firstorder tau wfreq mpc predmodel actlag pm Ms Kc',
  'Integral action and steady-state error': 'bias stepdist ess dbias Ke1 integrator pid Ki sL mpc',
  'Linear versus nonlinear': 'smallsig steerrate ratelim injsine descfn lockin',
  'Speed changes the plant: gain scheduling': 'plantgain v0c Lwb v delta the Ld L0 kpp wc rwf curv cruise gainsched pp',
  'The speed loop is open, except for MPC':
    'tracker cruise openloop latency actlag Gs Tlat tau bandwidth rise mpc aacc Kv vref aprev steptest',
  'The estimator in the loop': 'estimate ekf beacon odometry eest ectl Ls uc injection crossover',
  "When the wheels don't go where they point":
    'dynbike tyreslip slipang cornstiff understeer kus vch yawr v delta Lwb sideslip odometry deadreck gyro tracker cruise alatcap',
  'Running out of grip': 'mug ay alatcap curv tyreslip slipang understeer fulllock tracker cruise kus',
  'Gain scheduling breaks above v_ch': 'gainsched vch plantgain yawmode pp Ld rwf kth wc pm zeta Ms overshoot steptest kus v0c',
  'The moose test: an MPC that knows the tyres':
    'moose mpc predmodel tyrempc dynbike vch kus understeer yawr yawmode mug sideslip zeta pm Ms overshoot steptest wc cruise alatcap',
  'Curves: does the straight-line analysis hold?':
    'opoint findiff thdot gpl uc u0 edot v0c the pp rwf curv feedforward stanley pid offset steptest steerrate frenet'
};
const lessonTerms = L => (LESSON_TERMS[L.t] || '').split(' ').filter(id => GLOSS[id]);
// Wrap the first occurrence of each listed term in the lesson HTML (prose and the plain-text equations; not inside
// MathML) in a focusable .term span.
// Tags are copied through; a match must not continue a word or an index (θ̇ₑ is not θ, w_i is not w).
function glossMark(html, ids) {
  const pats = [];
  for (const id of ids)
    for (const p of GLOSS[id][3]) {
      const ci = /^[a-z][a-z -]{2,}$/.test(p);
      pats.push([p, id, ci]);
    }
  pats.sort((a, b) => b[0].length - a[0].length);
  // a neighbour continues the match if it is an index, a combining mark, or a letter of the same script:
  // "HΣHᵀ" and "−jωT_d" are products of symbols, but "grows" does not contain g
  const greek = c => /\p{Script=Greek}/u.test(c),
    joins = (c, e) =>
      !!c && c !== 'ᵀ' && (/[_\u2080-\u209C\u0300-\u036F]/u.test(c) || (/\p{L}/u.test(c) && (!/\p{L}/u.test(e) || greek(c) === greek(e))));
  const done = new Set(),
    n = html.length;
  let out = '',
    i = 0;
  while (i < n) {
    let hit = null;
    for (const [p, id, ci] of pats) {
      const s = html.substr(i, p.length);
      if (ci ? s.toLowerCase() !== p : s !== p) continue;
      const b = html[i - 1],
        a = html[i + p.length];
      if (b !== '>' && joins(b, p[0])) continue;
      if (a !== '<' && (joins(a, p[p.length - 1]) || /\d/.test(a || ''))) continue;
      if (html.startsWith('<sub>', i + p.length)) continue;
      if (p.length === 1 && /\d\s$/.test(html.slice(Math.max(0, i - 2), i))) continue; // "5 s", "7 m": a unit, not a symbol
      hit = [s, id];
      break;
    }
    if (hit) {
      const [s, id] = hit;
      out += done.has(id) ? s : `<span class="term" tabindex="0" data-g="${id}">${s}</span>`;
      done.add(id);
      i += s.length;
      continue;
    }
    if (html.startsWith('<math', i)) {
      // a formula (MathML from the lesson's TeX) is copied whole: a span inside it would not render
      const j = html.indexOf('</math>', i) + 7;
      out += html.slice(i, j);
      i = j;
      continue;
    }
    if (html[i] === '<' && /[A-Za-z\/!]/.test(html[i + 1] || '')) {
      const j = html.indexOf('>', i);
      out += html.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    out += html[i++];
  }
  return out;
}
const glossWord = id => /^[A-Za-z0-9 *–'-]{2,}$/.test(GLOSS[id][0]); // a word term, not a symbol: set in the text face
const glossDef = id => {
  const g = GLOSS[id];
  return `${g[1]}${g[2] ? ` <span class="unit">[${g[2]}]</span>` : ''}`;
};
// The lesson body with its terms marked, followed by the list of terms and symbols
const glossMarkFor = (L, html) => {
  const ids = lessonTerms(L);
  return ids.length ? glossMark(html, ids) : html;
};
function glossTermsHTML(L) {
  const ids = lessonTerms(L);
  if (!ids.length) return '';
  return `<details class="terms" open><summary>Terms and symbols</summary><dl>${ids.map(id => `<dt${glossWord(id) ? ' class="w"' : ''}>${GLOSS[id][0]}</dt><dd>${glossDef(id)}</dd>`).join('')}</dl></details>`;
}
function glossLesson(L) {
  return glossMarkFor(L, L.b) + glossTermsHTML(L);
}
